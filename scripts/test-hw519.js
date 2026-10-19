#!/usr/bin/env node
/* bitGen Studio — 2.519.0 units: THE PACKAGE FOR THIS COMPUTER (lib/hwPlan.js, lib/setupGpu.js's extra detection,
 * lib/setupRun.js, electron/installer.html's hardware form + package page, scripts/setup-cli.js) and the DAILY SUPPLY
 * CHARGE (lib/power.js, static/powerstats.js).
 * Tim (verbatim): "add daily supply rate to the energy costs. in the initial setup ask the user for their gfx card, ram
 * and cpu if setup can't detect it. install a package with recommendations for the hardware the user has. our package
 * should be a powerful image and video editor even without the ai or using smaller models ... show the user what they
 * will be able to use and if they still want to install"
 * The wizard runs in jsdom with a stand-in h3setup bridge (the real engine's plan for a 12 GB card). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const G = require("../lib/setupGpu.js"), H = require("../lib/hwPlan.js"), PW = require("../lib/power.js"), PS = require("../static/powerstats.js");
const CAT = JSON.parse(read("lib", "modelCatalog.json"));

/* ---- detection */
const win = G.parseWinVideo(JSON.stringify([{ Name: "AMD Radeon RX 7900 XTX", AdapterRAM: 4293918720, Mem: 25753026560 }, { Name: "Microsoft Basic Display Adapter", AdapterRAM: 0 },
  { Name: "Intel(R) UHD Graphics 770", AdapterRAM: 2147483648 }]));
check("Windows: the display adapters with their real memory (the registry's qwMemorySize - AdapterRAM stops at 4 GB); the basic display driver dropped",
  win.length === 2 && win[0].vendor === "amd" && win[0].vram_mb === 24560 && win[0].vram_known && win[1].vendor === "intel" && win[1].vram_mb === 2048, win);
check("Windows: one adapter (an object, not a list) / junk", G.parseWinVideo('{"Name":"NVIDIA GeForce RTX 3060","AdapterRAM":4293918720}')[0].vram_mb === 0 && G.parseWinVideo("nope").length === 0);
const lsp = G.parseLspci("00:02.0 VGA compatible controller: Intel Corporation Raptor Lake-S GT1 [UHD Graphics 770] (rev 04)\n03:00.0 VGA compatible controller: Advanced Micro Devices, Inc. [AMD/ATI] Navi 31 [Radeon RX 7900 XT/7900 XTX] (rev c8)\n04:00.0 Audio device: x");
check("Linux: lspci's VGA / 3D controllers by vendor", lsp.length === 2 && lsp[0].vendor === "intel" && lsp[1].vendor === "amd" && /Navi 31/.test(lsp[1].name), lsp);
check("the CPU: os.cpus' model + threads; an unnamed CPU = ''", JSON.stringify(G.cpuInfo([{ model: " AMD  Ryzen 9 7950X " }, {}])) === JSON.stringify({ model: "AMD Ryzen 9 7950X", cores: 2 }) && G.cpuInfo([{ model: "unknown" }]).model === "");
const p0 = G.profile([], 0, "win32", { cpu: { model: "", cores: 0 } });
check("profile.missing: no card, no CPU name, no RAM -> the wizard asks for those", p0.missing.join() === "gpu,cpu,ram", p0.missing);
const p1 = G.profile(lsp, 32 * 1073741824, "linux", { cpu: { model: "i7", cores: 16 } });
check("a card whose memory is not known -> asks for its memory (vram); other = the card", p1.missing.join() === "vram" && p1.other.vendor === "intel" && !p1.cuda, p1.missing);
const pn = G.profile(G.parseNvidia("0, NVIDIA GeForce RTX 4090, 24564, 576.02, 8.9"), 64 * 1073741824, "win32", { cpu: { model: "R9", cores: 32 } });
check("an NVIDIA card found = nothing to ask", pn.missing.length === 0 && pn.tier === "high" && pn.cpu.model === "R9");

/* ---- answers -> a profile */
const a1 = H.fromAnswers({ gpu: "rtx3060", ram_gb: 32, cpu: "Ryzen 5 5600" }, "win32");
check("the wizard's answers: an RTX 3060 = NVIDIA 12 GB, CUDA 8.6, the low tier; RAM and CPU kept; manual", a1.cuda && a1.vram_gb === 12 && a1.cc === 8.6 && a1.tier === "low" && a1.ram_gb === 32 && a1.cpu.model === "Ryzen 5 5600" && a1.manual, a1);
const a2 = H.fromAnswers({ gpu: "other", gpu_name: "Radeon RX 6700 XT", vram_gb: 12, ram_gb: 16 }, "win32");
check("'Another card' takes its name + memory (Radeon -> AMD, not CUDA)", !a2.cuda && a2.other.vendor === "amd" && a2.other.vram_gb === 12 && a2.other.name === "Radeon RX 6700 XT", a2.other);
const a3 = H.fromAnswers({ gpu: "", ram_gb: 0, cpu: "" }, "win32", pn);
check("unanswered fields come from what was found (the detected card, RAM, CPU)", a3.cuda && a3.vram_gb === 24 && a3.ram_gb === 64 && a3.cpu.model === "R9", a3);
check("no graphics card = no GPU at all", H.fromAnswers({ gpu: "igpu", ram_gb: 16 }).gpus.length === 0 && H.aiMemory(H.fromAnswers({ gpu: "igpu", ram_gb: 16 })).kind === "none");
check("the card list: NVIDIA 50 / 40 / 30 / 20 series + workstation, AMD, Intel Arc, Apple Silicon, none, another", ["rtx5090", "rtx4090", "rtx3060", "rtx2080ti", "rtxa6000", "rx7900xtx", "arcb580", "apple", "igpu", "other"].every((id) => H.GPUS.some((g) => g.id === id)) && H.GPUS.every((g) => g.vendor !== "nvidia" || g.cc > 0));

/* ---- packages */
const P = (a) => H.fromAnswers(a, "win32");
check("the recommendation: no card -> Editor; 8 GB -> Editor + small AI; 12-16 GB -> mid-size; 24 GB+ -> Everything; Apple 32 GB -> small AI; AMD -> Editor",
  H.recommend(P({ gpu: "igpu", ram_gb: 16 })) === "editor" && H.recommend(P({ gpu: "rtx4060", ram_gb: 32 })) === "light" && H.recommend(P({ gpu: "rtx3060", ram_gb: 32 })) === "standard"
  && H.recommend(P({ gpu: "rtx4080", ram_gb: 64 })) === "standard" && H.recommend(P({ gpu: "rtx4090", ram_gb: 64 })) === "full" && H.recommend(P({ gpu: "apple", ram_gb: 32 })) === "light"
  && H.recommend(P({ gpu: "rx7900xtx", ram_gb: 64 })) === "editor");
const none = P({ gpu: "igpu", ram_gb: 16, cpu: "i5" });
const capE = H.capabilities(none, "editor"), st = (rows, id) => rows.find((r) => r.id === id);
check("Editor on a computer with no graphics card: every editing row ✓ and in the package; the AI that runs on a CPU is ✓ / ~ 'add later'; pictures + video ✗ with why",
  capE.filter((r) => r.group.startsWith("Editing")).every((r) => r.state === "yes" && r.included) && st(capE, "ai_stt").state === "yes" && st(capE, "ai_stt").later
  && st(capE, "ai_llm").state === "slow" && st(capE, "img_small").state === "no" && /graphics card/.test(st(capE, "img_small").why) && st(capE, "vid_h3").state === "no" && !st(capE, "vid_h3").later, capE.slice(5, 9));
const mid = P({ gpu: "rtx4080", ram_gb: 64 }), capS = H.capabilities(mid, "standard");
check("16 GB card, mid-size package: small + mid pictures ✓ in it, MiniMax H3 ~ (768x432, split) in it, Qwen Image Edit ✗ (needs 20 GB), the big models ~ 'add later'",
  st(capS, "img_small").state === "yes" && st(capS, "img_small").included && st(capS, "img_mid").included && st(capS, "vid_h3").state === "limited" && /768x432/.test(st(capS, "vid_h3").why) && st(capS, "vid_h3").included
  && st(capS, "img_qedit").state === "no" && /20 GB/.test(st(capS, "img_qedit").why) && st(capS, "img_big").state === "limited" && st(capS, "img_big").later, [st(capS, "vid_h3"), st(capS, "img_big")]);
const lowRam = P({ gpu: "rtx4090", ram_gb: 16 });
check("system RAM counts: a 24 GB card with 16 GB of RAM - MiniMax H3 ~ 'needs 32 GB of system RAM'", H.stateOf(H.FEATURES.find((f) => f.id === "vid_h3"), lowRam).state === "limited" && /32 GB of system RAM/.test(H.stateOf(H.FEATURES.find((f) => f.id === "vid_h3"), lowRam).why));
check("DLSS 5 needs an NVIDIA RTX card; on AMD the GPU AI is 'limited' (ComfyUI / ROCm, built on NVIDIA) but MiniMax H3 ✗",
  H.stateOf(H.FEATURES.find((f) => f.id === "vid_dlss"), P({ gpu: "rx7900xtx", ram_gb: 64 })).state === "no" && H.stateOf(H.FEATURES.find((f) => f.id === "img_small"), P({ gpu: "rx7900xtx", ram_gb: 64 })).state === "limited"
  && H.stateOf(H.FEATURES.find((f) => f.id === "vid_h3"), P({ gpu: "rx7900xtx", ram_gb: 64 })).state === "no");
const big = P({ gpu: "rtx5090", ram_gb: 128 });
check("Everything on a 32 GB card: every row ✓ and in the package", H.capabilities(big, "full").every((r) => r.state === "yes" && r.included));
const mE = H.packageModels(mid, "editor"), mL = H.packageModels(mid, "light"), mS = H.packageModels(mid, "standard"), mF = H.packageModels(big, "full");
check("the models each package ticks: Editor none; small AI = Anima + SDXL + a 4B assistant + OmniVoice; mid-size adds Krea 2 GGUF, FLUX 3, Kontext, Qwen 2.1, MiniMax H3; Everything adds Qwen Image Edit, FLUX.2 9B",
  mE.length === 0 && ["anima_aesthetic", "sdxl", "llm_4b", "omnivoice"].every((x) => mL.includes(x)) && !mL.includes("h3_ref2va")
  && ["krea2_turbo_gguf", "flux3_klein", "kontext", "qwen21", "h3_ref2va"].every((x) => mS.includes(x)) && !mS.includes("qwen_edit")
  && ["qwen_edit", "klein9b", "h3_ref2va", "ltx25_gguf"].every((x) => mF.includes(x)), { mL, mS: mS.length });
check("every model a package ticks is in the catalog", mL.concat(mS, mF).every((id) => CAT.models.some((m) => m.id === id)), mL.concat(mS, mF).filter((id) => !CAT.models.some((m) => m.id === id)));
const pl = H.plan(mid, CAT, { omnivoice: true });
check("plan(): four packages, the recommended one marked, sizes grow (0 < small < mid < everything), fits = not more than recommended",
  pl.packages.length === 4 && pl.recommended === "standard" && pl.packages.find((k) => k.recommended).id === "standard" && pl.packages[0].bytes === 0
  && pl.packages[1].bytes > 0 && pl.packages[2].bytes > pl.packages[1].bytes && pl.packages[3].bytes > pl.packages[2].bytes && pl.packages[2].fits && !pl.packages[3].fits
  && /RTX 4080/.test(pl.hardware.gpu) && pl.hardware.ram === "64 GB of RAM", pl.packages.map((k) => [k.id, k.bytes, k.fits]));

/* ---- daily supply charge */
check("supplyOf: $1.10 a day for 30 min = 1/48 = $0.02; none set = null", PW.supplyOf(1800, 1.1) === 0.02 && PW.supplyOf(60, 1.1) === 0.0008 && PW.supplyOf(1800, 0) === null);
const jc = PW.jobCost(125, 1500, { price_kwh: 0.35, supply_day: 1.1 });
check("jobCost: energy $0.04 + supply $0.02 = $0.06 (25 min); energy-only / supply-only too", jc.energy === 0.04 && jc.supply === 0.02 && jc.total === 0.06
  && PW.jobCost(125, 1500, { price_kwh: 0.35 }).supply === null && PW.jobCost(125, 1500, { supply_day: 1.1 }).total === 0.02 && PW.jobCost(1, 1, {}) === null, jc);
check("priceOf keeps supply_day (clamped, junk = 0)", PW.priceOf({ power: { price_kwh: 0.35, supply_day: "1.10", currency: "aud" } }).supply_day === 1.1 && PW.priceOf({ power: { supply_day: -2 } }).supply_day === 0);
const e = { wh: 125, gpu_wh: 125, cpu_wh: 0, gpu_measured: true, avg_w: 300, secs: 1500 };
check("the [power] line: 'cost $0.06 ($0.04 at $0.35/kWh + $0.02 of the $1.10/day supply charge)'; without supply the 2.518 words",
  / - cost \$0\.06 \(\$0\.04 at \$0\.35\/kWh \+ \$0\.02 of the \$1\.10\/day supply charge\)$/.test(PW.words(e, { price_kwh: 0.35, supply_day: 1.1, currency: "AUD" }))
  && / - cost \$0\.04 at \$0\.35\/kWh$/.test(PW.words(e, { price_kwh: 0.35, currency: "AUD" })), PW.words(e, { price_kwh: 0.35, supply_day: 1.1, currency: "AUD" }));
check("the page: the same sums; the card '⚡ 125 Wh · $0.06', its tooltip splits energy + supply",
  PS.supplyOf(1800, 1.1) === PW.supplyOf(1800, 1.1) && JSON.stringify(PS.jobCost(125, 1500, { price_kwh: 0.35, supply_day: 1.1 })) === JSON.stringify(jc)
  && PS.badgeText(e, { price_kwh: 0.35, supply_day: 1.1, currency: "AUD" }) === "⚡ 125 Wh · $0.06" && /energy \$0\.04 at \$0\.35 per kWh/.test(PS.badgeTitle(e, { price_kwh: 0.35, supply_day: 1.1, currency: "AUD" }))
  && /supply \$0\.02 \(its share of the \$1\.10 daily supply charge\)/.test(PS.badgeTitle(e, { price_kwh: 0.35, supply_day: 1.1, currency: "AUD" })) && PS.badgeText(e, { price_kwh: 0.35, currency: "AUD" }) === "⚡ 125 Wh · $0.04");

/* ---- the wizard in jsdom */
(async () => {
  const { JSDOM } = require("jsdom");
  const HTML = read("electron", "installer.html");
  const found = G.profile([], 16 * 1073741824, "win32", { cpu: { model: "", cores: 8 } });     // nothing found but RAM
  const calls = [];
  const DET = { platform: "win32", arch: "x64", gpu: found, plan: ["x", "y", "z", "w"], recommended: [], python: "py", git: "git", ffmpeg: "",
    comfy: { configured: "", defaultDir: "C:\\bitGen\\comfy" }, omnivoice: false, llama: false, done: false, gpu_list: H.GPUS, viggle: null };
  const api = {
    detect: async () => DET, browse: async () => "", inspect: async () => ({ ok: false, error: "x" }),
    packages: async (hw, o) => { calls.push(["packages", hw]); const p = hw ? H.fromAnswers(hw, "win32", found) : found; return Object.assign(H.plan(p, CAT, o), { gpu: p }); },
    install: async (plan) => { calls.push(["install", plan]); return { ok: true, steps: { python: { ok: true } }, warnings: [] }; },
    models: async (t, o) => { calls.push(["models", o]); return { groups: CAT.groups, rows: [] }; },
    token: async () => ({ ok: false }), disk: async () => 1e12, download: async () => ({ ok: true }), hfcli: async () => ({ found: false }),
    finish: async () => calls.push("finish"), skip: async () => {}, minimize: async () => {}, close: async () => {}, onEvent: () => {},
  };
  const tick = () => new Promise((r) => setTimeout(r, 40));
  const dom = new JSDOM(HTML, { runScripts: "dangerously", pretendToBeVisual: true, beforeParse(w) { w.h3setup = api; } });
  await tick();
  const w = dom.window, $ = (id) => w.document.getElementById(id), on = () => (w.document.querySelector(".page.on") || {}).id;
  check("page 1: setup could not find the card / CPU - the form is open and says what it needs; RAM filled in from what it found",
    $("hw_ask").style.display !== "none" && /could not find your graphics card, your processor/.test($("hw_ask_why").textContent) && $("hw_ram").value === "16"
    && $("hw_pick").options.length === H.GPUS.length + 1, $("hw_ask_why").textContent);
  await $("b_next").onclick(); await tick();
  check("Next without picking a card: it asks again (no package page yet)", on() === "pg_welcome" && /Pick your graphics card/.test($("hw_ask_why").textContent));
  $("hw_pick").value = "other"; $("hw_pick").onchange();
  check("'Another card' shows its name + memory boxes", $("hw_name").style.display !== "none" && $("hw_vram").style.display !== "none");
  $("hw_pick").value = "rtx3060"; $("hw_pick").onchange(); $("hw_cpu").value = "Ryzen 5 5600"; $("hw_ram").value = "32";
  await $("b_next").onclick(); await tick();
  const pc = calls.find((c) => c[0] === "packages");
  check("Next: the answers go to the engine (card, RAM, CPU) and the PACKAGE page opens", on() === "pg_package" && pc && pc[1].gpu === "rtx3060" && pc[1].ram_gb === 32 && pc[1].cpu === "Ryzen 5 5600", pc);
  const pk = () => [...w.document.querySelectorAll("#pkgs .pkg")].map((x) => ({ id: x.dataset.pkg, sel: x.classList.contains("sel"), text: x.textContent }));
  check("four packages, the recommended one (mid-size for a 12 GB card) picked and marked, sizes shown, Everything says it is more than this computer runs well",
    pk().length === 4 && pk().find((x) => x.sel).id === "standard" && /recommended for you/.test(pk().find((x) => x.id === "standard").text) && /no models to download/.test(pk()[0].text)
    && /GB of models/.test(pk()[1].text) && /more than this computer runs well/.test(pk()[3].text), pk().map((x) => [x.id, x.sel]));
  const caps = () => [...w.document.querySelectorAll("#caps .cap")].map((x) => ({ id: x.dataset.cap, cls: x.className, text: x.textContent }));
  const c1 = caps();
  check("what you'll be able to use: every editing row ✓, the AI rows ✓ / ~ / ✗ with why, 'in this package' / 'add later'",
    c1.length === H.FEATURES.length && c1.filter((c) => /^ed_/.test(c.id)).every((c) => /yes/.test(c.cls)) && /in this package/.test(c1.find((c) => c.id === "img_small").text)
    && /no/.test(c1.find((c) => c.id === "vid_h3").cls) && /14 GB/.test(c1.find((c) => c.id === "vid_h3").text) && /add later/.test(c1.find((c) => c.id === "img_3d").text)
    && /Install Editor \+ mid-size AI/.test($("b_install").textContent) && /RTX 3060/.test($("pkg_sub").textContent) && /as you told setup/.test($("pkg_sub").textContent), c1.slice(5, 12));
  const r4 = w.document.querySelector('#pkgs input[value="full"]'); r4.checked = true; r4.onchange(); await tick();
  check("picking more than recommended: the button says 'Install anyway'", /^Install anyway: Everything/.test($("b_install").textContent), $("b_install").textContent);
  const r1 = w.document.querySelector('#pkgs input[value="editor"]'); r1.checked = true; r1.onchange(); await tick();
  check("Editor: the ComfyUI card hides, OmniVoice / the assistant / whisper unticked, 'no models'", $("cm_card").style.display === "none" && !$("cb_omni").checked && !$("cb_llama").checked && /no models/.test($("pkg_tot").textContent));
  await $("b_install").onclick(); await tick();
  const inst = calls.find((c) => c[0] === "install");
  check("Install Editor: the plan says package editor, no ComfyUI (mode none), no check, the answers; then straight to Done (nothing to download)",
    inst && inst[1].package === "editor" && inst[1].comfy.mode === "none" && inst[1].check === false && inst[1].hw.gpu === "rtx3060" && on() === "pg_done" && !calls.some((c) => c[0] === "models"), inst && inst[1]);
  w.close();
  // a mid-size install: the models page ticks the package's models
  const dom2 = new JSDOM(HTML, { runScripts: "dangerously", pretendToBeVisual: true, beforeParse(x) { x.h3setup = api; } });
  await tick();
  const w2 = dom2.window, $2 = (id) => w2.document.getElementById(id);
  calls.length = 0;
  $2("hw_pick").value = "rtx4090"; await $2("b_next").onclick(); await tick();
  await $2("b_install").onclick(); await tick();
  const i2 = calls.find((c) => c[0] === "install"), m2 = calls.find((c) => c[0] === "models");
  check("Install Everything (recommended for a 4090): ComfyUI new in the app folder, the package + answers sent; the models page asks for THE PACKAGE's models",
    i2 && i2[1].package === "full" && i2[1].comfy.mode === "new" && m2 && m2[1].package === "full" && m2[1].hw.gpu === "rtx4090", { i2: i2 && i2[1], m2: m2 && m2[1] });
  w2.close();

  /* ---- wiring */
  const RUN = read("lib", "setupRun.js"), MAIN = read("electron", "main.js"), PRE = read("electron", "installer-preload.js"), CLI = read("scripts", "setup-cli.js"), HT = read("static", "index.html");
  check("setupRun: detect() gives the packages + the card list; packages(answers); install() uses the answers and skips ComfyUI / packs / the check for Editor; models() ticks the package's",
    /hw: Hw\.plan\(gpu, Models\.CATALOG/.test(RUN) && /gpu_list: Hw\.GPUS/.test(RUN) && /function packages\(answers, opts\)/.test(RUN) && /const gpu = hardware\(p\.hw\)/.test(RUN)
    && /const noComfy = pkg === "editor" \|\| \(p\.comfy \|\| \{\}\)\.mode === "none"/.test(RUN) && /if \(p\.check !== false && comfy\)/.test(RUN) && /Hw\.packageModels\(gpu, o\.package/.test(RUN)
    && /cfg\.engine\.comfy\.autostart = false/.test(RUN));
  check("electron: setup:packages handled + bridged; the CLI has --package / --packages / --gpu --vram --ram --cpu",
    /ipcMain\.handle\("setup:packages"/.test(MAIN) && /packages: \(hw, o\) => ipcRenderer\.invoke\("setup:packages", hw, o\)/.test(PRE) && /--package"\) o\.package = next\(\)/.test(CLI) && /--gpu"\)/.test(CLI) && /S\.packages\(o\.hw/.test(CLI));
  check("Settings -> General -> Energy cost has the daily supply charge box", /id="s_supply"/.test(HT) && /supply charge per day/.test(HT));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
