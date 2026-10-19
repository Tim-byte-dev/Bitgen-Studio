#!/usr/bin/env node
/* bitGen Studio — SETUP without a window (2.331.0): the same engine as the
 * wizard (lib/setupRun.js), for a headless Linux box, a server, or anyone
 * who prefers a terminal. The installer bootstraps call it with --detect.
 *
 *   node scripts/setup-cli.js --detect                  the machine, as JSON
 *   node scripts/setup-cli.js --bootstrap PYTHON        (the installers) use this
 *        python for the app and open the setup wizard at the next start
 *   node scripts/setup-cli.js [--comfy new[:DIR] | --comfy existing:DIR]
 *        [--no-omnivoice] [--whisper] [--no-llama] [--no-check] [--viggle | --no-viggle]
 *        [--models recommended|none|id,id,...] [--hf-token TOKEN]
 *        [--downloader auto|hf|builtin] [--install-hf-cli]
 *   node scripts/setup-cli.js --only-models --models id,id,... [--hf-token TOKEN]
 *        [--downloader hf]      (2.341.0) just the model files, into an
 *        installed studio - no Python / ComfyUI / pack steps
 *   node scripts/setup-cli.js --list-models           the catalog ids
 *   2.519.0: --package editor|light|standard|full     the package (lib/hwPlan.js; editor = no ComfyUI, no models);
 *        --packages prints what this computer can use with each; --gpu ID --vram GB --ram GB --cpu "NAME" tell
 *        setup the hardware it could not find (the ids: --packages lists them)
 *
 * --downloader hf = the Hugging Face CLI (`hf download`, huggingface_hub
 * >= 0.34 in the app's Python; --install-hf-cli pip-installs it first);
 * auto (the default) uses it when it is there, else the built-in downloader.
 *
 * --viggle (2.355.0): Viggle (native) installs at the studio's first start (components.txt viggle
 * native=0); without it components.txt says viggle native=2 (do not install). --detect shows its size.
 *
 * HF_TOKEN in the environment works like --hf-token. With no token only the
 * models that are not gated are downloaded. */
"use strict";
const S = require("../lib/setupRun");

function args(argv) {
  const o = { comfy: { mode: "new", dir: "" }, omnivoice: true, whisper: false, llama: true, check: true, viggle: false,
              models: "recommended", token: process.env.HF_TOKEN || "", detect: false,
              downloader: "auto", installHf: false, onlyModels: false, listModels: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i] || "";
    if (a === "--detect") o.detect = true;
    else if (a === "--bootstrap") o.bootstrap = next();
    else if (a === "--comfy") {
      const v = next();
      const [mode, ...rest] = v.split(":");
      o.comfy = { mode: mode === "existing" ? "existing" : "new", dir: rest.join(":") };
    } else if (a === "--no-omnivoice") o.omnivoice = false;
    else if (a === "--whisper") o.whisper = true;
    else if (a === "--no-llama") o.llama = false;
    else if (a === "--no-check") o.check = false;
    else if (a === "--viggle") o.viggle = true;                           // 2.355.0
    else if (a === "--no-viggle") o.viggle = false;
    else if (a === "--models") o.models = next();
    else if (a === "--hf-token") o.token = next();
    else if (a === "--downloader") o.downloader = next();                 // 2.341.0
    else if (a === "--install-hf-cli") o.installHf = true;
    else if (a === "--only-models") o.onlyModels = true;
    else if (a === "--list-models") o.listModels = true;
    else if (a === "--package") o.package = next();                       // 2.519.0
    else if (a === "--packages") o.packages = true;
    else if (a === "--gpu") (o.hw = o.hw || {}).gpu = next();
    else if (a === "--vram") (o.hw = o.hw || {}).vram_gb = +next();
    else if (a === "--ram") (o.hw = o.hw || {}).ram_gb = +next();
    else if (a === "--cpu") (o.hw = o.hw || {}).cpu = next();
    else if (a === "-h" || a === "--help") o.help = true;
  }
  return o;
}

/** installer/bootstrap.ps1 / .sh: settings.python = the runtime python they
 *  set up, and .setup-pending so the app opens the setup wizard first. */
function bootstrap(py) {
  const fs = require("fs"), path = require("path");
  if (!py || !fs.existsSync(py)) { console.error(`--bootstrap: no python at "${py}"`); return 1; }
  const core = require("../lib/core");
  const cfg = core.getConfig();
  cfg.python = py;
  core.setConfig(cfg);
  // an UPGRADE over a set-up install keeps .setup-done: no wizard again
  // (H3_SETUP=1, or deleting .setup-done, opens it again)
  if (!fs.existsSync(path.join(S.ROOT, ".setup-done")))
    fs.writeFileSync(path.join(S.ROOT, ".setup-pending"), new Date().toISOString() + "\n");
  console.log(`[ok] app python: ${py}`);
  return 0;
}

async function main() {
  const o = args(process.argv.slice(2));
  if (o.help) { console.log(require("fs").readFileSync(__filename, "utf8").split("*/")[0]); return 0; }
  if (o.bootstrap !== undefined) return bootstrap(o.bootstrap);
  if (o.detect) { console.log(JSON.stringify(S.detect(), null, 2)); return 0; }
  if (o.packages) {                                                       // 2.519.0
    const pk = S.packages(o.hw || null);
    console.log(`${pk.hardware.gpu} · ${pk.hardware.ram} · ${pk.hardware.cpu}` + (pk.missing.length ? `  (not found: ${pk.missing.join(", ")} - add --gpu / --vram / --ram / --cpu)` : ""));
    for (const k of pk.packages) {
      console.log(`\n${k.id === pk.recommended ? "*" : " "} ${k.id} - ${k.label}: ${k.bytes ? Math.round(k.bytes / 1e9) + " GB of models" : "no models"}${k.fits ? "" : " (more than this computer runs well)"}`);
      for (const r of k.rows) if (!r.group.startsWith("Editing")) console.log(`    ${r.state === "yes" ? "yes " : r.state === "no" ? "no  " : "~   "}${r.included ? "+" : r.later ? "later" : " "}  ${r.label.slice(0, 90)}${r.why ? " - " + r.why : ""}`);
    }
    console.log("\ncards for --gpu: " + require("../lib/hwPlan").GPUS.map((g) => g.id).join(", "));
    return 0;
  }
  const show = (e) => {
    if (e.type === "log") console.log((e.err ? "! " : "  ") + e.line);
    else if (e.type === "step") console.log(`== ${e.id}: ${e.state}${e.error ? " - " + e.error : ""}`);
    else if (e.type === "file" && e.state !== "run") console.log(`== model ${e.id}: ${e.state}${e.error ? " - " + e.error : ""}`);
  };
  if (o.listModels) {
    const M = require("../lib/setupModels");
    for (const m of M.CATALOG.models) console.log(`${m.id.padEnd(22)} ${m.group.padEnd(14)} ${m.repo}/${m.file || ""}`);
    return 0;
  }
  if (!["auto", "hf", "builtin"].includes(o.downloader)) { console.error(`--downloader must be auto, hf or builtin`); return 1; }
  if (o.installHf) {
    const h = await S.hfCliInstall(show);
    if (!h.ok) { console.log("the Hugging Face CLI could not be installed - " + h.error); if (o.downloader === "hf") return 1; }
  }
  const r = o.onlyModels ? { steps: {}, warnings: [] }
    : await S.install({ comfy: o.comfy, omnivoice: o.omnivoice, whisper: o.whisper, llama: o.llama, check: o.check, viggle: o.viggle,
                        package: o.package, hw: o.hw }, show);                       // 2.519.0
  if (o.package === "editor") { console.log("the Editor package: no models to download"); return 0; }
  if ((r.steps.python && !r.steps.python.ok) || (r.steps.comfy && !r.steps.comfy.ok)) {
    console.log("setup stopped - see above"); return 1;
  }
  if (o.models !== "none") {
    if (o.token) {
      const t = await require("../lib/setupModels").checkToken(o.token);
      console.log(t.ok ? `Hugging Face token OK (${t.name})` : `token: ${t.error} - only open models`);
      if (!t.ok) o.token = "";
    }
    const list = await S.models(o.token, { omnivoice: o.omnivoice, package: o.package, hw: o.hw });
    const ids = o.models === "recommended" ? list.rows.filter((r) => r.ticked).map((r) => r.id)
      : o.models.split(",").map((x) => x.trim()).filter(Boolean);
    for (const r of list.rows) if (ids.includes(r.id) && !r.available) console.log(`skip ${r.id}: ${r.why}`);
    const d = await S.download(ids, o.token, show, { engine: o.downloader });
    if (o.onlyModels) return d.ok ? 0 : 1;
  }
  if (o.onlyModels) return 0;
  S.finish();
  for (const w of r.warnings || []) console.log("warning: " + w);
  console.log("bitGen Studio is set up - start it with the bitGen Studio shortcut (or start.sh / start.bat).");
  return 0;
}

main().then((c) => process.exit(c || 0), (e) => { console.error(e && e.stack || e); process.exit(1); });
