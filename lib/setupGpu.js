// bitGen Studio — SETUP: what hardware is this? (2.331.0)
//
// Tim (verbatim): "Do a gpu check, set up bitgen studio for the hardware the
// user is using. I would like the user to be able to start using bitgen
// studio immediately after setup with no further action needed".
//
// detect() asks the machine (nvidia-smi on Windows / Linux, system_profiler
// on macOS, the OS for RAM) and returns ONE profile the installer shows and
// lib/setupTune.js turns into settings. parseNvidia / parseMac / profile are
// pure (tested with captured outputs); detect() is the only thing that runs
// commands, and it never throws - no GPU is an answer, not an error.
//
// 2.519.0 (Tim: "in the initial setup ask the user for their gfx card, ram and cpu if setup can't detect it"):
// + the CPU (os.cpus: its model and cores) and graphics cards that are NOT NVIDIA (Windows: the display adapters +
// their memory from the registry's qwMemorySize - Win32_VideoController's AdapterRAM stops at 4 GB; Linux: lspci +
// /sys/class/drm/*/mem_info_vram_total for AMD). profile().missing = what could not be found ("gpu", "vram", "cpu",
// "ram") - the wizard asks for exactly those (lib/hwPlan.js builds a profile from the answers).
"use strict";
const os = require("os");
const { spawnSync } = require("child_process");

/** nvidia-smi --query-gpu=index,name,memory.total,driver_version,compute_cap
 *  --format=csv,noheader,nounits  ->  [{index, name, vram_mb, driver, cc}] */
function parseNvidia(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [index, name, mem, driver, cc] = l.split(",").map((x) => (x || "").trim());
    return { vendor: "nvidia", index: parseInt(index, 10) || 0, name: name || "NVIDIA GPU",
             vram_mb: parseInt(mem, 10) || 0, driver: driver || "", cc: parseFloat(cc) || 0 };
  }).filter((g) => g.vram_mb > 0);
}

/** system_profiler SPDisplaysDataType -json (macOS) -> [{vendor, name, vram_mb, unified}] */
function parseMac(json) {
  let d;
  try { d = typeof json === "string" ? JSON.parse(json) : json; } catch { return []; }
  const list = (d && d.SPDisplaysDataType) || [];
  return list.map((g, i) => {
    const name = g.sppci_model || g._name || "GPU";
    const apple = /apple/i.test(name) || /apple/i.test(g.spdisplays_vendor || "");
    const vr = String(g.spdisplays_vram || g.spdisplays_vram_shared || "");
    const m = /(\d+)\s*(GB|MB)/i.exec(vr);
    const vram_mb = m ? parseInt(m[1], 10) * (/GB/i.test(m[2]) ? 1024 : 1) : 0;
    return { vendor: apple ? "apple" : "other", index: i, name, vram_mb, unified: apple, cc: 0, driver: "" };
  });
}

/** Windows: Get-CimInstance Win32_VideoController (+ the registry's memory) as JSON -> [{vendor, name, vram_mb}]
 *  json = [{Name, AdapterRAM, Mem}] (Mem = HardwareInformation.qwMemorySize when the registry had it) */
function parseWinVideo(json) {
  let d;
  try { d = typeof json === "string" ? JSON.parse(json || "[]") : json; } catch { return []; }
  const list = Array.isArray(d) ? d : d ? [d] : [];
  return list.map((g, i) => {
    const name = String(g.Name || g.name || "").trim();
    const mem = +g.Mem || 0, ad = +g.AdapterRAM || 0;
    // AdapterRAM is a uint32: a 4 GB+ card reads ~4095 MB (or wraps) - only trusted under that
    const vram_mb = mem > 0 ? Math.round(mem / 1048576) : ad > 0 && ad < 4000000000 ? Math.round(ad / 1048576) : 0;
    return { vendor: vendorOf(name), index: i, name: name || "GPU", vram_mb, cc: 0, driver: "", vram_known: mem > 0 || (ad > 0 && ad < 4000000000) };
  }).filter((g) => g.name && !/basic display|remote display|virtual|parsec|meta virtual/i.test(g.name));
}
/** Linux: `lspci` lines -> [{vendor, name}] (the VGA / 3D / Display controllers) */
function parseLspci(text) {
  return String(text || "").split(/\r?\n/).filter((l) => /(VGA compatible controller|3D controller|Display controller)/i.test(l)).map((l, i) => {
    const name = l.replace(/^.*?(VGA compatible controller|3D controller|Display controller)[^:]*:\s*/i, "").replace(/\s*\(rev [^)]*\)\s*$/, "").trim();
    return { vendor: vendorOf(name), index: i, name, vram_mb: 0, cc: 0, driver: "", vram_known: false };
  });
}
function vendorOf(name) {
  const n = String(name || "");
  return /nvidia|geforce|quadro|rtx|tesla/i.test(n) ? "nvidia" : /amd|radeon|advanced micro/i.test(n) ? "amd" : /intel|arc\b|iris|uhd graphics/i.test(n) ? "intel"
    : /apple/i.test(n) ? "apple" : "other";
}
/** the CPU: os.cpus() -> {model, cores} (model "" when the OS does not say) */
function cpuInfo(cpus) {
  const c = cpus || os.cpus() || [];
  const model = String((c[0] && c[0].model) || "").replace(/\s+/g, " ").trim();
  return { model: /^(unknown|0|cpu)$/i.test(model) ? "" : model, cores: c.length || 0 };
}

/** The CUDA generation from a compute capability (for the torch wheels and
 *  the notes): 12.x Blackwell (RTX 50), 8.9 Ada (RTX 40), 8.6 Ampere
 *  (RTX 30), 7.5 Turing (RTX 20). */
function generation(cc) {
  if (cc >= 12) return "Blackwell";
  if (cc >= 10) return "Blackwell (datacenter)";
  if (cc >= 9) return "Hopper";
  if (cc >= 8.9) return "Ada";
  if (cc >= 8) return "Ampere";
  if (cc >= 7.5) return "Turing";
  if (cc > 0) return "older";
  return "";
}

/** The PyTorch CUDA wheel indexes to try, best first. Blackwell (sm_120)
 *  has NO kernels in CUDA 12.4/12.6 builds - it needs 12.8+. Older cards
 *  run anything from 12.6 up. */
function torchIndexes(cc) {
  if (!(cc > 0)) return [];
  if (cc >= 12) return ["cu130", "cu128"];
  if (cc >= 7.5) return ["cu128", "cu126"];
  return ["cu126"];
}

/**
 * THE profile: the platform, every GPU, the MAIN one (most VRAM), system RAM
 * and plain-language notes. tier: "none" | "low" (< 14 GB) | "mid" (14-20)
 * | "high" (20-30) | "max" (30+) - lib/setupTune.js keys off it.
 */
function profile(gpus, ramBytes, platform, extra) {
  const plat = platform || process.platform;
  const ex = extra || {};
  const all = (gpus || []).slice().sort((a, b) => b.vram_mb - a.vram_mb);
  const nv = all.filter((g) => g.vendor === "nvidia");
  const main = nv[0] || null;
  const second = nv[1] || null;
  const vramGb = main ? Math.round(main.vram_mb / 102.4) / 10 : 0;
  const ramGb = Math.round((ramBytes || 0) / 1073741824);
  const tier = !main ? "none" : vramGb >= 30 ? "max" : vramGb >= 20 ? "high" : vramGb >= 14 ? "mid" : "low";
  const notes = [];
  if (main) {
    notes.push(`${main.name} with ${vramGb} GB${main.cc ? ` (${generation(main.cc)}, CUDA ${main.cc})` : ""}`
      + (second ? ` + ${second.name} ${Math.round(second.vram_mb / 102.4) / 10} GB - the LLM goes on the second card` : ""));
    if (tier === "low") notes.push("under 14 GB of VRAM: MiniMax H3 runs short clips at a small size - "
      + "expect 4-8 second scenes at 640x352; 24 GB or more is what it is built for");
    if (tier === "mid") notes.push("14-20 GB of VRAM: scenes render at 768x432 and long ones are split to fit");
  } else if (plat === "darwin" && all.some((g) => g.vendor === "apple")) {
    notes.push("Apple Silicon: ComfyUI runs on Metal (MPS). MiniMax H3 is built for NVIDIA CUDA - on a Mac "
      + "it is experimental and very slow; images, music, speech and the LLM work");
  } else {
    notes.push("no NVIDIA GPU found: generation would run on the CPU (extremely slow). "
      + "bitGen Studio is built for an NVIDIA card with 16 GB or more");
  }
  if (ramGb && ramGb < 48) notes.push(`${ramGb} GB of system RAM: MiniMax H3 streams ~40 GB of weights - `
    + "64 GB of RAM is recommended; the first loads will be slow");
  // 2.519.0: what setup could not find - the wizard asks for these
  const missing = [];
  if (!all.length) missing.push("gpu");
  else if (!main && !all.some((g) => g.vendor === "apple") && !all.some((g) => g.vram_mb > 0)) missing.push("vram");
  const cpu = ex.cpu || { model: "", cores: 0 };
  if (!cpu.model) missing.push("cpu");
  if (!ramGb) missing.push("ram");
  const other = all.find((g) => g.vendor !== "nvidia") || null;
  return { platform: plat, arch: process.arch, gpus: all, main, second, vram_gb: vramGb, cpu, missing, manual: !!ex.manual,
           other: other ? { vendor: other.vendor, name: other.name, vram_gb: other.vram_mb ? Math.round(other.vram_mb / 102.4) / 10 : 0 } : null,
           second_vram_gb: second ? Math.round(second.vram_mb / 102.4) / 10 : 0,
           ram_gb: ramGb, tier, cuda: !!main, cc: main ? main.cc : 0,
           generation: main ? generation(main.cc) : "", torch: torchIndexes(main ? main.cc : 0), notes };
}

function run(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 15000, windowsHide: true });
    return r.status === 0 ? String(r.stdout || "") : "";
  } catch { return ""; }
}

/** Ask the machine. `exec` is injectable for the tests. */
function detect(exec) {
  const ex = exec || run;
  let gpus = parseNvidia(ex("nvidia-smi", ["--query-gpu=index,name,memory.total,driver_version,compute_cap",
                                             "--format=csv,noheader,nounits"]));
  if (!gpus.length && process.platform === "darwin")
    gpus = parseMac(ex("system_profiler", ["SPDisplaysDataType", "-json"]));
  // 2.519.0: a card that is not NVIDIA (AMD, Intel) - its name, and its memory where the OS says
  if (!gpus.length && process.platform === "win32") {
    const ps = "$m=@{};Get-ItemProperty 'HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue"
      + " | ForEach-Object { if ($_.DriverDesc) { $m[$_.DriverDesc]=$_.'HardwareInformation.qwMemorySize' } };"
      + "Get-CimInstance Win32_VideoController | ForEach-Object { [pscustomobject]@{Name=$_.Name;AdapterRAM=$_.AdapterRAM;Mem=$m[$_.Name]} } | ConvertTo-Json -Compress";
    gpus = parseWinVideo(ex("powershell", ["-NoProfile", "-Command", ps]));
  } else if (!gpus.length && process.platform === "linux") {
    gpus = parseLspci(ex("lspci", []));
    // AMD's driver says how much memory the card has
    try {
      const fs = require("fs");
      const vr = fs.readdirSync("/sys/class/drm").filter((d) => /^card\d+$/.test(d))
        .map((d) => { try { return +fs.readFileSync(`/sys/class/drm/${d}/device/mem_info_vram_total`, "utf8"); } catch { return 0; } }).filter((x) => x > 0);
      const amd = gpus.filter((g) => g.vendor === "amd");
      amd.forEach((g, i) => { if (vr[i]) { g.vram_mb = Math.round(vr[i] / 1048576); g.vram_known = true; } });
    } catch { /* no sysfs */ }
  }
  return profile(gpus, os.totalmem(), process.platform, { cpu: cpuInfo() });
}

module.exports = { parseNvidia, parseMac, parseWinVideo, parseLspci, vendorOf, cpuInfo, generation, torchIndexes, profile, detect };
