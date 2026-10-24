#!/usr/bin/env node
/* bitGen Studio — 2.573.0 units: ✂ the song strip's cut duration (static/segmap.js gridSpan / regrid, the strip's input),
 * ⤓ Update ComfyUI (lib/comfyUpdate.js, routes/comfyUpdate.js, static/comfyupdate.js), the update check on startup for
 * bitGen Studio and ComfyUI (static/startcheck.js, /api/update/settings), and FastH3 Omni (the style, the board Workflow,
 * the add-on, the catalog).
 * Tim: "add an input to the audio clip menu in storyboard to set the cut duration . add update comfyui button to comfyui
 * tab in settings. do an autocheck on startup for latest version of bitgen and comfyui" + "please add this workflow
 * https://www.fasth3-omni.com/en, fasth3 omni" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const wait = async (f, ms) => { for (let i = 0; i < (ms || 10000) / 25 && !f(); i++) await new Promise((ok) => setTimeout(ok, 25)); };
const sum = (a) => Math.round(a.reduce((s, x) => s + x, 0) * 1000) / 1000;

(async () => {
  /* 1 ✂ the cut duration */
  const SM = require(path.join(ROOT, "static", "segmap.js"));
  const g30 = SM.gridSpan(200, 29.9);
  check("gridSpan(200 s, 29.9): six 29.9 s segments + the 20.6 s rest, summing to the song", g30.length === 7 && g30.slice(0, 6).every((x) => x === 29.9) && sum(g30) === 200, g30);
  const tiny = SM.gridSpan(30.5, 15);
  check("...a rest under the 1 s floor joins the segment before it (30.5 / 15 -> 15 + 15.5)", tiny.length === 2 && tiny[1] === 15.5, tiny);
  check("...a bad grid falls back to 15", SM.gridSpan(40, 0).length === 3);
  const S = SM.from({ song: "s.wav", total: 100, durations: [15, 15, 22, 15, 15, 18], manual: [false, false, true, false, false, false] });
  const N = SM.regrid(S, 29.9);
  check("regrid keeps a LOCKED segment exactly where it is (30 s -> 52 s) and cuts the open runs on each side from their own start",
    N.durations.join(",") === "30,22,29.9,18.1" && N.manual.join(",") === "false,true,false,false", N.durations);
  check("...the map stays whole (sums to the song) with its boundaries rebuilt", sum(N.durations) === 100 && N.boundaries.length === N.durations.length - 1);
  const N2 = SM.regrid(SM.from({ song: "s", total: 60.5, durations: [15, 15, 15, 15.5], manual: [] }), 20);
  check("regrid with no locks: the whole song on the new grid (60.5 / 20 -> 20, 20, 20.5)", N2.durations.join(",") === "20,20,20.5", N2.durations);
  const H = rd("ext", "videodock", "dock.html"), A = rd("ext", "videodock", "audioseg.js");
  check("the strip's menubar: ✂ cut input (2-60 s, step 0.1, presets 10 / 15 / 20 / 29.9) before Transition",
    /id="vdSegCut"[^>]*min="2" max="60" step="0.1"/.test(H) && /<option value="29\.9">/.test(H) && H.indexOf('id="vdSegCut"') < H.indexOf('id="vdSegGap"'));
  check("audioseg.js: a change re-cuts the open song (SegMap.regrid), the value is remembered; a song with no .seg auto-cuts on it",
    /el\("vdSegCut"\)\.addEventListener\("change", recut\)/.test(A) && /localStorage\.setItem\(CUT_KEY/.test(A) && /!res\[1\]\.file && Math\.abs\(per - 15\) > 1e-6\) S = window\.SegMap\.regrid\(S, per\)/.test(A)
    && /719 frames/.test(A));

  /* 2 ⤓ Update ComfyUI */
  const CU = require(path.join(ROOT, "lib", "comfyUpdate.js"));
  check("parseVersion / channelOf", CU.parseVersion('__version__ = "0.42.0"\n') === "0.42.0" && CU.channelOf({}) === "latest" && CU.channelOf({ update: { comfy_channel: "stable" } }) === "stable");
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "cu573-"));
  try {
    // a portable build
    const P = path.join(T, "ComfyUI_windows_portable");
    const mk = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
    mk(path.join(P, "python_embeded", process.platform === "win32" ? "python.exe" : "python"), "");
    mk(path.join(P, "ComfyUI", "main.py"), ""); fs.mkdirSync(path.join(P, "ComfyUI", "comfy"), { recursive: true });
    mk(path.join(P, "ComfyUI", "comfyui_version.py"), '__version__ = "0.42.0"\n');
    mk(path.join(P, "update", "update.py"), "# updater\n");
    const W = CU.where({ dir: P });
    check("where(): the portable build - its updater, its python_embeded, the version", W.ok && W.portable && /update\.py$/.test(W.updater) && /python_embeded/.test(W.python) && W.version === "0.42.0", W);
    const getJson = async (u) => /releases\/latest/.test(u) ? { status: 200, json: { tag_name: "v0.43.0" } } : { status: 200, body: '__version__ = "0.44.0"' };
    const c1 = await CU.check({ where: W, getJson, fetch: false, channel: "latest" });
    const c2 = await CU.check({ where: W, getJson, fetch: false, channel: "stable" });
    check("check(): newest release 0.43.0, master 0.44.0, this 0.42.0 -> newer on both channels",
      c1.newer && c1.latest === "0.43.0" && c1.master === "0.44.0" && c1.current === "0.42.0" && c2.newer && c1.mode === "portable", c1);
    const calls = [];
    const run = async (cmd, args, o) => {
      calls.push([path.basename(cmd), args.map((a) => path.basename(String(a)))]);
      if (calls.length === 1) { fs.writeFileSync(path.join(P, "update", "update_new.py"), "# new\n"); }
      fs.writeFileSync(path.join(P, "ComfyUI", "comfyui_version.py"), '__version__ = "0.44.0"\n');
      (o.log || (() => {}))("pulled", false);
      return 0;
    };
    const ev = [];
    const comfy = { status: async () => ({ reachable: true, managed: true }), stop: () => { ev.push("stop"); return { stopped: true }; }, start: async () => { ev.push("start"); return {}; } };
    CU._reset();
    CU.start({ where: W, run, comfy, settle: 0, channel: "stable" });
    await wait(() => CU.job().state !== "running");
    const J = CU.job();
    check("portable update: ComfyUI's own update.py <ComfyUI> --stable, again with --skip_self_update after it updated itself (update_new.py -> update.py)",
      J.state === "done" && calls.length === 2 && calls[0][1].includes("--stable") && calls[1][1].includes("--skip_self_update")
      && !fs.existsSync(path.join(P, "update", "update_new.py")) && fs.readFileSync(path.join(P, "update", "update.py"), "utf8") === "# new\n", { J, calls });
    check("...the ComfyUI bitGen Studio started is stopped first and started again; the job says 0.42.0 -> 0.44.0",
      ev.join(",") === "stop,start" && J.from === "0.42.0" && J.to === "0.44.0" && J.restarted, { ev, J: { from: J.from, to: J.to } });
    CU._reset();
    CU.start({ where: W, run, comfy: { status: async () => ({ reachable: true, managed: false }), stop: () => {}, start: async () => {} }, settle: 0 });
    await wait(() => CU.job().state !== "running");
    check("a ComfyUI running outside bitGen Studio: refused - close it first (pip cannot replace the packages it holds)", CU.job().state === "error" && /did not start it - close its window first/.test(CU.job().error), CU.job());
    CU._reset();
    // a git clone
    const G = path.join(T, "ComfyUI");
    mk(path.join(G, "main.py"), ""); fs.mkdirSync(path.join(G, "comfy"), { recursive: true }); fs.mkdirSync(path.join(G, ".git"), { recursive: true });
    mk(path.join(G, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"), ""); mk(path.join(G, "requirements.txt"), "torch\n");
    mk(path.join(G, "comfyui_version.py"), '__version__ = "0.41.0"\n');
    const WG = CU.where({ dir: G });
    const gc = [];
    const grun = async (cmd, args, o) => {
      const a = args.filter((x) => x !== "-c" && x !== "gc.auto=0");
      gc.push(a.join(" "));
      if (/rev-parse --abbrev-ref HEAD/.test(a.join(" "))) o.log("master", false);
      if (/pip install -r/.test(a.join(" "))) fs.writeFileSync(path.join(G, "comfyui_version.py"), '__version__ = "0.44.0"\n');
      return 0;
    };
    CU.start({ where: WG, run: grun, git: "git", comfy: { status: async () => ({ reachable: false, managed: false }) }, settle: 0, channel: "latest" });
    await wait(() => CU.job().state !== "running");
    check("git clone, Newest: fetch --tags, fast-forward master (merge --ff-only origin/master), then pip install -r requirements.txt with ComfyUI's venv",
      CU.job().state === "done" && gc.some((x) => /fetch --tags origin/.test(x)) && gc.some((x) => /merge --ff-only origin\/master/.test(x)) && gc.some((x) => /-s -m pip install -r .*requirements\.txt/.test(x))
      && WG.git && /venv/.test(WG.python), { gc, job: CU.job() });
    CU._reset();
    const other = path.join(T, "plain"); mk(path.join(other, "main.py"), ""); fs.mkdirSync(path.join(other, "comfy"), { recursive: true });
    check("neither a git clone nor the portable build: refused with the way to update it", /ComfyUI-Manager/.test(CU.start({ where: CU.where({ dir: other }) }).error || ""));
  } finally { fs.rmSync(T, { recursive: true, force: true }); }
  const RC = rd("routes", "comfyUpdate.js"), RI = rd("routes", "index.js"), RU = rd("routes", "updater.js"), IX = rd("static", "index.html");
  check("routes/comfyUpdate.js: info / check / start / job / channel - mounted from routes/index.js (not server.js)",
    ["/api/comfy/update/info", "/api/comfy/update/check", "/api/comfy/update/start", "/api/comfy/update/job", "/api/comfy/update/channel"].every((u) => RC.includes(u))
    && /require\("\.\/comfyUpdate"\)\.mount\(app\)/.test(RI) && !/comfyUpdate/.test(rd("misc/server.js")));
  check("routes/updater.js: GET/POST /api/update/settings (the startup check's switch, on by default)", /app\.get\("\/api\/update\/settings"/.test(RU) && /auto_check: b\.auto_check !== false/.test(RU));
  const CS = rd("static", "comfyupdate.js"), SC = rd("static", "startcheck.js"), UP = rd("static", "updater.js");
  check("Settings ▸ ComfyUI ▸ Engine: ⟳ ComfyUI updates under ▶ Start / ■ Stop - channel, 🔍 Check, ⤓ Update ComfyUI, the log",
    /\$\("s_cstatus"\)/.test(CS) && /id="cuGo"/.test(CS) && /id="cuChannel"/.test(CS) && /\/api\/comfy\/update\/start/.test(CS) && /comfyupdate\.js/.test(IX));
  check("startup: one look for BOTH (bitGen /api/update/check + ComfyUI /api/comfy/update/check without git) -> a ⬆ status-bar chip + a card once per version; off = nothing",
    /\/api\/update\/check/.test(SC) && /\/api\/comfy\/update\/check", \{ fetch: false \}/.test(SC) && /id = "sbUpd"/.test(SC) && /h3\.update\.seen\./.test(SC)
    && /st\.auto_check === false/.test(SC) && /startcheck\.js/.test(IX));
  check("static/updater.js: the old console-only look no longer runs on boot; its box switches the startup check",
    !/setTimeout\(quiet/.test(UP) && /id="upAuto"/.test(UP) && /\/api\/update\/settings/.test(UP));

  /* 3 FastH3 Omni */
  const wf = JSON.parse(rd("comfy_workflows", "fasth3_omni_r2v.json"));
  const cls = Object.values(wf).map((v) => v.class_type);
  check("comfy_workflows/fasth3_omni_r2v.json: an API graph with the template's nodes (ReferenceToVideo, SigmaShift, backend, VSA, 8 steps)",
    Object.values(wf).every((v) => v && v.class_type && v.inputs) && ["MiniMaxH3ReferenceToVideo", "MiniMaxH3SigmaShift", "ModelAttentionBackend", "BlockSparseAttention", "SaveVideo"].every((c) => cls.includes(c)));
  const ST = require(path.join(ROOT, "lib", "styles.js"));
  const SD = fs.mkdtempSync(path.join(os.tmpdir(), "st573-"));
  try {
    const made = ST.restoreStarters(SD, ["FastH3 Omni"], "video");
    const st = ST.read(SD).find((x) => x.name === "FastH3 Omni");
    check("the starter video style FastH3 Omni (minimax-h3, the shipped graph)", made.includes("FastH3 Omni") && st && st.kind === "video" && st.arch === "minimax-h3" && st.workflow === "comfy_workflows/fasth3_omni_r2v.json", st);
  } finally { fs.rmSync(SD, { recursive: true, force: true }); }
  const EV = require(path.join(ROOT, "lib", "extendVideo.js"));
  check("lib/extendVideo: FastH3 Omni is a ref flow with its own graph; H3_Video_Ref keeps ref2va.json",
    EV.isRefFlow("FastH3 Omni") && EV.isRefFlow("H3_Video_Ref") && !EV.isRefFlow("MMH3_NativeAudio_MV") && EV.refWorkflow("FastH3 Omni") === "fasth3_omni_r2v.json" && EV.refWorkflow("H3_Video_Ref") === "ref2va.json");
  const RCH = rd("routes", "characters.js"), VCH = rd("ext", "videodock", "characters.js");
  check("the board: a FastH3 Omni scene queues through queueRefScene with ITS style and graph; the StoryBoard's Workflow list offers it",
    /extendVideo\.isRefFlow\(st\.style\)\)\s+\/\/ 2\.573\.0/.test(RCH) && /const wf = extendVideo\.refWorkflow\(flow\)/.test(RCH) && /x\.name === flow\)/.test(RCH) && /\["FastH3 Omni", "FastH3 Omni · ref2va 8-step"\]/.test(VCH));
  const cat = JSON.parse(rd("lib", "modelCatalog.json"));
  const m = cat.models.find((x) => x.id === "fasth3_omni_int8");
  check("the model list: group fasth3, the int8 file from FastVideo/FastH3-Omni-Comfy into ComfyUI's diffusion_models (the name the graph loads)",
    cat.groups.some((g) => g.id === "fasth3") && m && m.dest === "comfy/diffusion_models" && m.as === wf[Object.keys(wf).find((k) => wf[k].class_type === "UNETLoader")].inputs.unet_name, m);
  const FA = require(path.join(ROOT, "lib", "fasth3Addon.js"));
  const pl = { ok: true, models: path.join(os.tmpdir(), "nope-fasth3-" + Date.now()) };
  const s0 = FA.status(pl);
  check("add-on status: not installed; the int8 model + H3's shared encoder / VAEs listed", !s0.installed && s0.items.map((i) => i.id).join(",") === "int8,bf16,te,vae");
  const got = [];
  const r = await FA.install(() => {}, ["int8"], { place: pl, download: async (mm) => { got.push(mm.id); return { ok: true }; }, styles: () => [], comfy: async () => ({ online: true, vsa: false, kitchen: false }) });
  const logs = [];
  await FA.install((l) => logs.push(l), ["int8"], { place: pl, download: async () => ({ ok: true }), styles: () => [], comfy: async () => ({ online: true, vsa: false, kitchen: false }) });
  check("add-on install: the int8 model, H3's text encoder and both VAEs; a ComfyUI without VSA is told to update (Settings ▸ ComfyUI ▸ ⤓ Update)",
    r.ok && got.join(",") === "fasth3_omni_int8,h3_te,h3_vvae,h3_avae" && logs.some((l) => /no VSA sparse attention yet.*Update ComfyUI/.test(l)), { got, logs });
  check("add-ons list: FastH3 Omni registered", /id: "fasth3", label: "FastH3 Omni/.test(rd("lib", "addons.js")));
  const sup = await FA.comfySupport({ url: "http://x", fetch: async (u) => ({ ok: true, json: async () => /BlockSparse/.test(u)
    ? { BlockSparseAttention: { input: { required: { selection: ["COMFY_DYNAMICCOMBO_V3", { options: [{ key: "vsa" }] }] } } } }
    : { ModelAttentionBackend: { input: { required: { attention: [["pytorch attention", "comfy kitchen attention"]] } } } } }) });
  check("comfySupport: VSA + comfy kitchen read from ComfyUI's object_info", sup.online && sup.vsa && sup.kitchen, sup);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
