#!/usr/bin/env node
/* bitGen Studio — 2.341.0: the LTX canvas's other files in the model catalog,
 * the Hugging Face CLI as a downloader, and the catalog inside the studio.
 * Run: node scripts/test-hfcli.js
 * Tim: "yes please add these downloads to setup, also add the hf cli to
 * download direct from hf".
 *   1. lib/modelCatalog.json: the six files (OmniNFT, Transition, Union
 *      Control, Detailer, Gemma 4 E2B, TAE LTX 2.3) and where they land;
 *   2. lib/hfCli: find (beside the Python / on PATH), download through a fake
 *      `hf` (the token in HF_TOKEN, never argv; staged, moved, progress; a
 *      failure in words), setupModels.download's engine choice;
 *   3. routes/setup.js live on express with a fake setupRun (models, token,
 *      hfcli, download in the background, state, one run at a time);
 *   4. the wiring: setupRun, the wizard (IPC + page), setup-cli's flags, the
 *      Settings button, routes/index.js;
 *   5. static/modelsdlg.js in jsdom. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hfcli-"));
const IS_WIN = process.platform === "win32";

(async () => {
  // ---- 1. the catalog
  const SM = require(path.join(ROOT, "lib", "setupModels"));
  const want = {
    ltx23_omninft: ["Kijai/LTX2.3_comfy", "loras/LTX-2.3-OmniNFT-RL-Lora_bf16.safetensors", "loras"],
    ltx23_transition: ["valiantcat/LTX-2.3-Transition-LORA", "ltx2.3-transition.safetensors", "loras"],
    ltx23_union: ["Lightricks/LTX-2.3-22b-IC-LoRA-Union-Control", "ltx-2.3-22b-ic-lora-union-control-ref0.5.safetensors", "loras"],
    ltx2_detailer: ["Lightricks/LTX-2-19b-IC-LoRA-Detailer", "ltx-2-19b-ic-lora-detailer.safetensors", "loras"],
    gemma4_e2b: ["Comfy-Org/gemma-4", "text_encoders/gemma4_e2b_it_bf16.safetensors", "text_encoders"],
    taeltx23: ["Kijai/LTX2.3_comfy", "vae/taeltx2_3.safetensors", "vae"],
  };
  const paths = { comfyModels: path.join(TMP, "models"), app: TMP };
  const bad = Object.entries(want).filter(([id, [repo, file, dir]]) => {
    const m = SM.byId(id);
    return !m || m.repo !== repo || m.file !== file || m.group !== "video_ltx" || !(m.size > 0)
      || SM.destPath(m, paths) !== path.join(paths.comfyModels, dir, path.basename(file));
  });
  check("the catalog: the canvas's six other files (OmniNFT, Transition, Union Control, Detailer, Gemma 4 E2B, TAE LTX 2.3) in the LTX group, each landing in ComfyUI's models/<folder>",
    bad.length === 0, bad.map((b) => b[0]));
  const canvas = read("comfy_workflows", "LTX25_All_In_One.json");
  check("...every one of them is a file Tim's canvas loads", Object.values(want).every(([, f]) => canvas.includes(path.basename(f))));
  check("the catalog ids stay unique", new Set(SM.CATALOG.models.map((m) => m.id)).size === SM.CATALOG.models.length);

  // ---- 2. the CLI
  const HFC = require(path.join(ROOT, "lib", "hfCli"));
  // a fake python dir with a fake `hf` beside it
  const pyDir = path.join(TMP, "python");
  fs.mkdirSync(path.join(pyDir, IS_WIN ? "Scripts" : "bin"), { recursive: true });
  const fakeHf = path.join(pyDir, IS_WIN ? "Scripts" : "bin", IS_WIN ? "hf.cmd" : "hf");
  const HFJS = path.join(TMP, "fakehf.js");
  fs.writeFileSync(HFJS, `
const fs = require("fs"), path = require("path");
const a = process.argv.slice(2);
fs.writeFileSync(process.env.FAKE_HF_LOG, JSON.stringify({ argv: a, token: process.env.HF_TOKEN || "" }));
if (a[0] !== "download") process.exit(2);
if (process.env.FAKE_HF_FAIL) { console.error("401 Client Error: Unauthorized"); process.exit(1); }
const dir = a[a.indexOf("--local-dir") + 1];
const out = path.join(dir, ...a[2].split("/"));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.alloc(4096, 7));
console.log("Downloading: 100%|##########| 4.00k/4.00k [00:00<00:00, 4.00MB/s]");
console.log(out);
`);
  if (IS_WIN) fs.writeFileSync(fakeHf, `@"${process.execPath}" "${HFJS}" %*\r\n`);
  else { fs.writeFileSync(fakeHf, `#!/bin/sh\nexec "${process.execPath}" "${HFJS}" "$@"\n`); fs.chmodSync(fakeHf, 0o755); }
  const fakePy = path.join(pyDir, IS_WIN ? "python.exe" : "python3");
  check("find: an hf beside the app's Python (python/Scripts or bin) wins", (await HFC.find(fakePy, [])).cmd === fakeHf);
  check("find: nothing there and no huggingface_hub in a missing Python -> null",
    (await HFC.find(path.join(TMP, "nope", "python"), [path.join(TMP, "nope")])) === null);
  check("version compare: hf appeared in huggingface_hub 0.34", HFC.cmp(HFC.parseVer("0.34.4"), HFC.MIN_VERSION) >= 0
    && HFC.cmp(HFC.parseVer("0.30.2"), HFC.MIN_VERSION) < 0 && HFC.cmp(HFC.parseVer("1.0.0rc1"), HFC.MIN_VERSION) > 0);
  const cli = { cmd: fakeHf, args: [], how: fakeHf };
  const m = SM.byId("ltx23_omninft");
  const dest = SM.destPath(m, paths);
  const logs = [], prog = [];
  process.env.FAKE_HF_LOG = path.join(TMP, "hf.json");
  let r = await HFC.download(m, dest, { cli, token: "hf_SECRET", log: (l) => logs.push(l), onProgress: (p) => prog.push(p) });
  const seen = JSON.parse(fs.readFileSync(process.env.FAKE_HF_LOG, "utf8"));
  check("download: hf download <repo> <file> --local-dir <staging beside dest>", r.ok
    && JSON.stringify(seen.argv) === JSON.stringify(["download", m.repo, m.file, "--local-dir", HFC.stageFor(m, dest)]), { r, seen });
  check("...the token in HF_TOKEN, never on the command line or in the log", seen.token === "hf_SECRET"
    && !seen.argv.join(" ").includes("hf_SECRET") && !logs.join("\n").includes("hf_SECRET"));
  check("...the file MOVED to models/loras/<name>, the staging folder gone, the progress bar lines kept out of the log",
    fs.statSync(dest).size === 4096 && !fs.existsSync(HFC.stageFor(m, dest)) && !logs.some((l) => /4\.00MB\/s/.test(l))
    && prog.length && prog[prog.length - 1].got === 4096, { logs, prog });
  process.env.FAKE_HF_FAIL = "1";
  r = await HFC.download(SM.byId("taeltx23"), SM.destPath(SM.byId("taeltx23"), paths), { cli, token: "", log: () => {} });
  delete process.env.FAKE_HF_FAIL;
  check("a failed hf download says so in words (and that a gated repo needs a token)", !r.ok && /hf download exited 1 - a gated repo needs a token/.test(r.error), r);
  // setupModels.download: the engine
  fs.rmSync(dest, { force: true });
  const m2 = { ...m, available: true };
  r = await SM.download(m2, { token: "", paths, engine: "hf", cli, log: () => {} });
  check("setupModels.download engine hf -> the CLI", r.ok && fs.existsSync(dest));
  fs.rmSync(dest, { force: true });
  const L2 = [];
  process.env.BITGEN_HF_BASE = "http://127.0.0.1:9";          // the fallback fails fast - nothing leaves the machine
  r = await SM.download(m2, { token: "", paths, engine: "hf", cli: null, log: (l) => L2.push(l) });
  delete process.env.BITGEN_HF_BASE;
  check("...no CLI installed -> said, the built-in downloader instead", L2.some((l) => /the Hugging Face CLI is not installed - using the built-in downloader/.test(l)));
  fs.writeFileSync(process.env.FAKE_HF_LOG, "{}");
  process.env.BITGEN_HF_BASE = "http://127.0.0.1:9";
  r = await SM.download(m2, { token: "", paths, engine: "builtin", cli, log: () => {} });
  delete process.env.BITGEN_HF_BASE;
  check("...engine builtin never runs the CLI", fs.readFileSync(process.env.FAKE_HF_LOG, "utf8") === "{}" && !r.ok);

  // ---- 3. routes/setup.js live
  const runPath = require.resolve(path.join(ROOT, "lib", "setupRun"));
  const calls = [];
  require.cache[runPath] = { id: runPath, filename: runPath, loaded: true, exports: {
    models: async (t) => { calls.push(["models", t]); return { groups: [{ id: "g", label: "G" }], paths, rows: [{ id: "a", group: "g", label: "A", size: 10, available: true }] }; },
    freeSpace: () => 123,
    hfCli: async () => ({ found: false, how: "", version: "", python: "/py" }),
    hfCliInstall: async (emit) => { emit({ type: "log", line: "pip install huggingface_hub" }); return { ok: true, version: "0.35.0", found: true }; },
    download: async (ids, t, emit, o) => {
      calls.push(["download", ids, t, o]);
      await new Promise((res) => setTimeout(res, 60));
      for (const id of ids) emit({ type: "file", id, state: "ok" });
      emit({ type: "done", ok: true, done: ids, failed: [] });
      return { ok: true };
    },
  } };
  const express = require("express");
  const app = express(); app.use(express.json());
  require(path.join(ROOT, "routes", "setup")).mount(app);
  const srv = app.listen(0, "127.0.0.1");
  await new Promise((res) => srv.once("listening", res));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const J = (u, b) => new Promise((res) => {
    const body = b === undefined ? null : JSON.stringify(b);
    const q = http.request(base + u, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {} }, (s) => {
      let d = ""; s.on("data", (c) => { d += c; }); s.on("end", () => res({ status: s.statusCode, j: JSON.parse(d || "{}") }));
    });
    if (body) q.write(body);
    q.end();
  });
  let x = await J("/api/setup/models", { token: " hf_x " });
  check("POST /api/setup/models: the catalog (setupRun.models with the trimmed token) + the free space", x.status === 200 && x.j.rows.length === 1 && x.j.free === 123
    && calls[0][1] === "hf_x");
  x = await J("/api/setup/download", { ids: [] });
  check("POST /api/setup/download refuses an empty tick list in words", x.status === 400 && /tick at least one/.test(x.j.error));
  x = await J("/api/setup/download", { ids: ["a"], token: "t", engine: "hf" });
  const x2 = await J("/api/setup/download", { ids: ["a"], engine: "hf" });
  check("POST /api/setup/download: in the background (busy), the engine passed through; a second run while busy = 409",
    x.status === 200 && x.j.busy === true && x2.status === 409 && calls.find((c) => c[0] === "download")[3].engine === "hf");
  await new Promise((res) => setTimeout(res, 120));
  x = await J("/api/setup/state");
  check("GET /api/setup/state: the files, the result, not busy", !x.j.busy && x.j.files.a.state === "ok" && x.j.result.ok === true);
  x = await J("/api/setup/hfcli/install", {});
  await new Promise((res) => setTimeout(res, 40));
  const st = (await J("/api/setup/state")).j;
  check("POST /api/setup/hfcli/install runs in the background, its log + the new state show up",
    x.j.ok && st.what === "hfcli" && !st.busy && st.hf.version === "0.35.0" && st.log.some((l) => /pip install/.test(l.line)));
  srv.close();
  delete require.cache[runPath];

  // ---- 4. the wiring
  const RUN = read("lib", "setupRun.js"), MAIN = read("electron", "main.js"), PRE = read("electron", "installer-preload.js");
  const WIZ = read("electron", "installer.html"), CLI = read("scripts", "setup-cli.js"), IH = read("static", "index.html"), RI = read("routes", "index.js");
  check("setupRun: download(ids, token, emit, {engine}), hfCli, hfCliInstall, freeSpace", /async function download\(ids, token, emit, opts\)/.test(RUN)
    && RUN.includes("engine, force, dirs: runtimeDirs(),") && /hfCli, hfCliInstall, freeSpace \};/.test(RUN));
  check("the wizard: IPC setup:hfcli / setup:hfcli-install, the engine rides setup:download; the disk check is setupRun.freeSpace",
    MAIN.includes('ipcMain.handle("setup:hfcli", () => Setup().hfCli());') && MAIN.includes('Setup().download(ids, t, setupEmit, o)')
    && MAIN.includes('ipcMain.handle("setup:disk", () => Setup().freeSpace());') && PRE.includes('hfcliInstall: () => ipcRenderer.invoke("setup:hfcli-install")'));
  check("the wizard's Models page: Download with (auto / hf / built-in) + Install hf CLI", WIZ.includes('<select id="dl_engine">')
    && WIZ.includes('<button class="b" id="b_hfcli">Install hf CLI</button>') && WIZ.includes('h3setup.download(ids, token, { engine: $("dl_engine").value })'));
  check("setup-cli: --downloader, --install-hf-cli, --only-models, --list-models", ["--downloader", "--install-hf-cli", "--only-models", "--list-models"].every((f) => CLI.includes(`a === "${f}"`))
    && CLI.includes("S.download(ids, o.token, show, { engine: o.downloader })"));
  check("the studio: Settings -> Models -> ⤓ Model catalog (static/modelsdlg.js); routes/setup mounted from routes/index.js",
    IH.includes('id="mm_catalog"') && IH.includes('<script src="/static/modelsdlg.js"></script>') && RI.includes('require("./setup").mount(app);')
    && !read("misc/server.js").includes("setup"));

  // ---- 5. the dialog (jsdom)
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dialog checks are skipped)"); return done(); }
  const dom = new JSDOM('<!doctype html><body><button id="mm_catalog">⤓ Model catalog</button></body>', { runScripts: "outside-only", url: "http://127.0.0.1/" });
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  const posts = [];
  let STATE = { busy: false, what: "", files: {}, log: [], result: null, hf: null, started: 0 };
  w.fetch = async (url, o) => {
    const body = o && o.body ? JSON.parse(o.body) : null;
    posts.push({ url, body });
    const R = (j) => ({ ok: true, json: async () => j });
    if (url === "/api/setup/hfcli") return R({ found: false, python: "C:/bitgen/runtime/python/python.exe" });
    if (url === "/api/setup/token") return R(body.token === "hf_good" ? { ok: true, name: "tim" } : { ok: false, error: "401" });
    if (url === "/api/setup/models") return R({ groups: [{ id: "video_ltx", label: "Video - LTX 2.5" }, { id: "llm", label: "LLM" }], free: 5e12,
      rows: [{ id: "ltx23_omninft", group: "video_ltx", label: "OmniNFT", size: 616948520, available: true, present: false, for: "row 1" },
             { id: "ltx25_int8", group: "video_ltx", label: "int8", size: 23e9, available: false, gated: "auto", why: "gated - needs a token" },
             { id: "taeltx23", group: "video_ltx", label: "TAE", size: 23531296, available: true, present: true }] });
    if (url === "/api/setup/download") { STATE = { ...STATE, busy: true, what: "download", files: { ltx23_omninft: { state: "run", got: 3e8, total: 616948520 } } }; return R({ ok: true }); }
    if (url === "/api/setup/state") return R(STATE);
    return R({});
  };
  w.eval(read("static", "modelsdlg.js"));
  d.getElementById("mm_catalog").click();
  await new Promise((res) => setTimeout(res, 80));
  const dlg = d.querySelector("dialog.mdlg[open]");
  check("⤓ Model catalog opens the dialog: the list by group, a gated one off with its reason, a downloaded one tagged",
    dlg && dlg.querySelectorAll(".mGrp").length === 1 && dlg.querySelectorAll(".mItem").length === 3
    && dlg.querySelector('.mItem[data-id="ltx25_int8"]').classList.contains("off") && /needs a token/.test(dlg.querySelector('.mItem[data-id="ltx25_int8"] .why').textContent)
    && dlg.querySelector('.mItem[data-id="taeltx23"] .tag.have'));
  check("the hf CLI line: not installed, Install hf CLI", /not installed/.test(dlg.querySelector(".mHfMsg").textContent) && dlg.querySelector(".mHf").textContent === "Install hf CLI");
  check("the engine choice: auto / hf / built-in", Array.from(dlg.querySelector(".mEng").options).map((o) => o.value).join() === "auto,hf,builtin");
  dlg.querySelector(".mTok").value = "hf_good";
  await w.ModelsDialog._api.useToken();
  check("Use token: checked, kept for this tab only (sessionStorage), the list asked again with it",
    /Signed in as tim/.test(dlg.querySelector(".mTokMsg").textContent) && w.sessionStorage.getItem("bitgen.hfToken") === "hf_good"
    && posts.filter((p) => p.url === "/api/setup/models").pop().body.token === "hf_good");
  const cb = dlg.querySelector('.mItem[data-id="ltx23_omninft"] input');
  cb.checked = true; cb.dispatchEvent(new w.Event("change"));
  check("the totals: 1 file, its size, the free space", /^1 file\(s\), 617 MB · 5000\.0 GB free/.test(dlg.querySelector(".mTot").textContent), dlg.querySelector(".mTot").textContent);
  dlg.querySelector(".mEng").value = "hf";
  await w.ModelsDialog._api.go();
  await new Promise((res) => setTimeout(res, 30));
  const dp = posts.filter((p) => p.url === "/api/setup/download").pop();
  check("⤓ Download: the ticked ids, the token, the engine", dp && JSON.stringify(dp.body) === JSON.stringify({ ids: ["ltx23_omninft"], token: "hf_good", engine: "hf", force: false }), dp && dp.body);
  check("...the progress shows on its row (bytes of total)", /300 MB of 617 MB/.test(dlg.querySelector('.mItem[data-id="ltx23_omninft"] .why').textContent));
  dlg.querySelector(".mClose").click();
  done();
})().catch((e) => { fail++; console.log("FAIL: crashed: " + (e && e.stack || e)); done(); });

function done() {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
