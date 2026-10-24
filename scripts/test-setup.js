#!/usr/bin/env node
/* bitGen Studio — the INSTALLER and SETUP WIZARD (2.331.0), offline.
 *
 * Tim: "create a windows 11 type installer for the package ... comfyui, input
 * with folder select button for existing comfyui package, comfyui nodes (if
 * existing) if not existing install all the custom nodes used in this
 * project, omnivoice, after installing all the packages offer a list of
 * models ... from HF ... before the list have an input for hf token. if no hf
 * token only download non-gated models. Do a gpu check, set up bitgen studio
 * for the hardware ... start using bitgen studio immediately after setup with
 * no further action needed" + "do number 1 but make it crossplatform".
 *
 * Nothing here touches the internet: a stub Hugging Face (http), local git
 * repos standing in for GitHub (git's url.insteadOf), a fake Node / uv for
 * the bootstrap, and the wizard page in jsdom.
 *   node scripts/test-setup.js
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawnSync, execFileSync } = require("child_process");

const APP = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); }
};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bgsetup-"));
const sh = (cmd, args, o) => spawnSync(cmd, args, Object.assign({ encoding: "utf8", timeout: 240000 }, o || {}));
// ASYNC run: anything that talks to the stub Hugging Face in THIS process
// must not block its event loop (spawnSync would deadlock)
const shA = (cmd, args, o) => new Promise((resolve) => {
  const c = require("child_process").spawn(cmd, args, Object.assign({}, o || {}));
  let stdout = "", stderr = "";
  c.stdout.on("data", (d) => { stdout += d; }); c.stderr.on("data", (d) => { stderr += d; });
  const t = setTimeout(() => c.kill("SIGKILL"), 240000);
  c.on("close", (status) => { clearTimeout(t); resolve({ status, stdout, stderr }); });
});

const Gpu = require("../lib/setupGpu");
const Tune = require("../lib/setupTune");
const Packs = require("../lib/setupPacks");
const Models = require("../lib/setupModels");
const Comfy = require("../lib/setupComfy");
const Llama = require("../lib/setupLlama");
const X = require("../lib/setupExec");

async function main() {
  // ================================================================ GPU
  const two = Gpu.parseNvidia("0, NVIDIA GeForce RTX 5090, 32607, 575.51, 12.0\n1, NVIDIA GeForce RTX 3060, 12288, 575.51, 8.6\n");
  check("nvidia-smi csv parses (2 cards)", two.length === 2 && two[0].vram_mb === 32607 && two[1].cc === 8.6, two);
  const pMax = Gpu.profile(two, 64 * 1073741824, "win32");
  check("RTX 5090 + 3060: tier max, the second card is the 3060", pMax.tier === "max" && pMax.second && pMax.second.index === 1 && pMax.second_vram_gb === 12, pMax);
  check("Blackwell -> cu130 / cu128 torch wheels", JSON.stringify(pMax.torch) === '["cu130","cu128"]', pMax.torch);
  const pMid = Gpu.profile(Gpu.parseNvidia("0, NVIDIA GeForce RTX 4080, 16376, 560.0, 8.9"), 32 * 1073741824, "linux");
  check("16 GB card: tier mid, Ada, a RAM note under 48 GB", pMid.tier === "mid" && pMid.generation === "Ada" && pMid.notes.some((n) => /RAM/.test(n)), pMid);
  const pLow = Gpu.profile(Gpu.parseNvidia("0, NVIDIA GeForce RTX 3070, 8192, 560.0, 8.6"), 64 * 1073741824, "linux");
  check("8 GB card: tier low with the short-clip note", pLow.tier === "low" && pLow.notes.some((n) => /640x352/.test(n)), pLow.notes);
  const pHigh = Gpu.profile(Gpu.parseNvidia("0, NVIDIA GeForce RTX 4090, 24564, 560.0, 8.9"), 64 * 1073741824, "win32");
  check("24 GB card: tier high, no second card", pHigh.tier === "high" && !pHigh.second, pHigh);
  const pNone = Gpu.profile([], 16 * 1073741824, "linux");
  check("no GPU: tier none, not cuda, the CPU note", pNone.tier === "none" && !pNone.cuda && /no NVIDIA GPU/.test(pNone.notes[0]), pNone);
  const mac = Gpu.parseMac(JSON.stringify({ SPDisplaysDataType: [{ sppci_model: "Apple M3 Max", spdisplays_vendor: "sppci_vendor_Apple" }] }));
  const pMac = Gpu.profile(mac, 64 * 1073741824, "darwin");
  check("Apple Silicon: parsed, tier none, the Metal note", mac[0].vendor === "apple" && pMac.tier === "none" && /Apple Silicon/.test(pMac.notes[0]), pMac);
  const det = Gpu.detect((cmd) => (cmd === "nvidia-smi" ? "0, NVIDIA RTX PRO 6000, 97887, 580.1, 12.0" : ""));
  check("detect() runs nvidia-smi through the injected exec", det.tier === "max" && det.main.name === "NVIDIA RTX PRO 6000", det.main);
  check("detect() with no nvidia-smi is an answer, not a throw", Gpu.detect(() => "").cuda === false || process.platform === "darwin");

  // ================================================================ TUNE
  const def = JSON.parse(fs.readFileSync(path.join(APP, "misc", "default.settings"), "utf8"));
  const leaves = (o, pre) => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? leaves(v, pre + k + ".") : [pre + k]));
  const has = (p) => p.split(".").reduce((x, k) => (x && typeof x === "object" && k in x ? x[k] : undefined), def) !== undefined;
  const pt = Tune.patch(pMax, { when: "t", python: "/py" });
  const unknown = leaves(pt, "").filter((k) => !k.startsWith("setup.") && !k.endsWith("_note") && !has(k));
  check("every setting the tuner writes is a REAL setting (default.settings has it)", !unknown.length, unknown);
  check("max: 960x544, no ceiling, no chunking, encoder placed by ComfyUI",
    pt.defaults.width === 960 && pt.engine.comfy.vram_ceiling === 0 && !pt.engine.comfy.chunk_on_oom && pt.engine.comfy.clip_device === "default", pt);
  check("two cards: the 14B LLM on cuda1, always on; the captioner beside it",
    pt.llm.device === "cuda1" && pt.llm.autostart === true && pt.captioner.device === "cuda1" && Tune.llmChoice(pMax).id === "llm_14b", pt.llm);
  const pm = Tune.patch(pMid);
  check("mid: 768x432, 209-frame runs, split on OOM", pm.defaults.width === 768 && pm.engine.comfy.vram_ceiling === 209 && pm.engine.comfy.chunk_on_oom, pm);
  const pl = Tune.patch(pLow);
  check("low: 640x352, 107 frames, the text encoder on the CPU", pl.defaults.height === 352 && pl.engine.comfy.vram_ceiling === 107 && pl.engine.comfy.clip_device === "cpu", pl);
  check("one 24 GB card: the 8B LLM, started on demand", Tune.llmChoice(pHigh).id === "llm_8b" && Tune.patch(pHigh).llm.autostart === false);
  check("one 16 GB card: the 4B LLM", Tune.llmChoice(pMid).id === "llm_4b");
  const pn = Tune.patch(pNone);
  check("no GPU: everything on the CPU, no GPU layers", pn.llm.device === "cpu" && pn.llm.gpu_layers === 0 && pn.tts.device === "cpu" && pn.asr.device === "cpu", pn);
  check("the python path rides along when given", pt.python === "/py" && !("python" in pm));
  const rec = Tune.recommend(pHigh, { omnivoice: true });
  const ids = new Set(Models.CATALOG.models.map((m) => m.id));
  check("recommendations: every id is in the catalog", rec.every((i) => ids.has(i)), rec.filter((i) => !ids.has(i)));
  check("a CUDA card gets the H3 set, its turbo LoRAs, the swap LoRA, the LLM and OmniVoice",
    ["h3_ref2va", "h3_fl2va", "h3_te", "h3_vvae", "h3_avae", "h3_turbo_ref", "h3_turbo_fl", "h3_swap_lora", "h3_charswap_lora", "llm_8b", "omnivoice"].every((i) => rec.includes(i)), rec);
  check("no GPU: no 60 GB of video weights pushed on it", !Tune.recommend(pNone, {}).includes("h3_ref2va"));
  const mg = Tune.merge({ a: { b: 1, c: 2 }, l: [1] }, { a: { b: 5 }, l: [9], n: { x: 1 } });
  check("deep merge keeps siblings, replaces arrays", mg.a.b === 5 && mg.a.c === 2 && mg.l[0] === 9 && mg.n.x === 1, mg);
  check("the hardware summary has 4 plain lines", Tune.summary(pMid).length === 4 && /768x432/.test(Tune.summary(pMid)[0]));

  // ================================================================ PACKS
  const L = Packs.LIST;
  check("21 node packs (2.338.0: + the LTX canvas's five; 2.342.0: + LTXVideo, RES4LYF for Ripple; 2.344.0: + Viggle-Animate-H3; 2.401.2: - ComfyMath, gone from GitHub), unique ids and folders", L.length === 21 && new Set(L.map((p) => p.id)).size === 21 && new Set(L.map((p) => p.folder.toLowerCase())).size === 21, L.length);
  check("every pack is a GitHub repo", L.every((p) => Packs.ghRepo(p.url)), L.filter((p) => !Packs.ghRepo(p.url)).map((p) => p.url));
  check("NativeAudioLock is a SUBFOLDER of its workflow repo", (L.find((p) => p.id === "nativeaudio") || {}).subdir === "custom_nodes/ComfyUI-H3-NativeAudioLock");
  check("comfy.js requiredNodes() reads the same list", require("../lib/comfy").requiredNodes().length === L.length);
  // which pack provides the classes the SHIPPED workflows use (no pack claims a class twice)
  const provided = L.flatMap((p) => p.provides || []);
  check("no node class is claimed by two packs", provided.length === new Set(provided).size);
  const wfClasses = new Set();
  for (const f of fs.readdirSync(path.join(APP, "comfy_workflows")).filter((f) => f.endsWith(".json"))) {
    try {
      const g = JSON.parse(fs.readFileSync(path.join(APP, "comfy_workflows", f), "utf8"));
      const nodes = Array.isArray(g.nodes) ? g.nodes.map((n) => n.type) : Object.values(g).map((n) => n && n.class_type);
      for (const c of nodes) if (c) wfClasses.add(c);
    } catch { /* not a graph */ }
  }
  for (const cls of ["MMH3LatentUpscaleWithModelParams", "Power Lora Loader (rgthree)", "VHS_LoadVideo"])
    check(`the pack for ${cls} is known (and the workflows do use it)`, !!Packs.packFor(cls) && wfClasses.has(cls), [cls, wfClasses.has(cls)]);
  // 2.338.0: Spectrum is spliced in by the app (the ⚙ accelerators), never
  // shipped in a workflow - only a generated *_tmp.json had it, so this check
  // depended on what an earlier gate left behind
  check("the pack for SpectrumApplyMiniMaxH3 is known (and the app splices it in)", !!Packs.packFor("SpectrumApplyMiniMaxH3")
    && ["lib", "scripts"].some((d) => fs.readdirSync(path.join(APP, d)).some((f) => /\.(js|py)$/.test(f) && !/^test-/.test(f)
      && fs.readFileSync(path.join(APP, d, f), "utf8").includes("SpectrumApplyMiniMaxH3"))));
  check("packFor(an unknown class) is null", Packs.packFor("NoSuchNode") === null);
  const cn = path.join(TMP, "cn");
  fs.mkdirSync(path.join(cn, "comfyui-kjnodes"), { recursive: true });                          // by name, other case
  fs.mkdirSync(path.join(cn, "my-vhs", ".git"), { recursive: true });                           // by remote
  fs.writeFileSync(path.join(cn, "my-vhs", ".git", "config"), '[remote "origin"]\n\turl = git@github.com:Kosinkadink/ComfyUI-VideoHelperSuite.git\n');
  fs.mkdirSync(path.join(cn, "rgthree-comfy.disabled"), { recursive: true });                   // Manager-disabled
  const st = Packs.status(cn);
  const S = (id) => st.find((p) => p.id === id);
  check("status: found by folder name (any case)", S("kjnodes").present && S("kjnodes").where === "comfyui-kjnodes");
  check("status: found by git remote (ssh form)", S("vhs").present && S("vhs").where === "my-vhs");
  check("status: a .disabled pack is flagged, not present", !S("rgthree").present && S("rgthree").disabled);
  check("missing() is the rest", Packs.missing(cn).length === 19);   // 21 packs - 2 found
  check("status of a folder that does not exist: everything missing", Packs.status(path.join(TMP, "nope")).every((p) => !p.present));

  // local git repos stand in for GitHub for the rest of the test
  const GH = path.join(TMP, "gh");
  const git = X.which("git");
  const gitEnv = { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: `url.${GH}/.insteadOf`, GIT_CONFIG_VALUE_0: "https://github.com/",
                   GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  Object.assign(process.env, gitEnv);
  const mkRepo = (url, files) => {
    const rel = url.replace(/^https:\/\/github\.com\//, "");
    const d = path.join(GH, rel);
    for (const [f, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), body); }
    execFileSync(git, ["init", "-q"], { cwd: d });
    execFileSync(git, ["add", "-A"], { cwd: d });
    execFileSync(git, ["commit", "-qm", "init"], { cwd: d, env: Object.assign({}, process.env) });
    return d;
  };
  for (const p of L) {
    const files = p.subdir ? { "README.md": "wf", [p.subdir + "/__init__.py"]: "NODE_CLASS_MAPPINGS = {}\n" } : { "__init__.py": "NODE_CLASS_MAPPINGS = {}\n" };
    if (p.id === "kjnodes") files["install.py"] = "open('INSTALLED', 'w').write('yes')\n";
    if (p.id === "spectrum") files["BROKEN"] = "1";
    mkRepo(p.url, files);
  }
  mkRepo("https://github.com/Comfy-Org/ComfyUI.git", {
    "comfy/__init__.py": "", "requirements.txt": "# nothing to install offline\n",
    "main.py": [
      "import os, sys",
      "here = os.path.dirname(os.path.abspath(__file__))",
      "cn = os.path.join(here, 'custom_nodes')",
      "for d in sorted(os.listdir(cn)) if os.path.isdir(cn) else []:",
      "    p = os.path.join(cn, d)",
      "    tag = ' (IMPORT FAILED)' if os.path.exists(os.path.join(p, 'BROKEN')) else ''",
      "    print('   0.0 seconds%s: %s' % (tag, p))",
      "sys.exit(0)", ""].join("\n"),
  });
  const cn2 = path.join(TMP, "cn2");
  const r1 = await Packs.install(L.find((p) => p.id === "kjnodes"), cn2, { git, python: X.which("python3") || X.which("python"), log: () => {} });
  check("a pack installs by git clone and runs its install.py", r1.ok && fs.existsSync(path.join(cn2, "ComfyUI-KJNodes", "__init__.py")) && fs.existsSync(path.join(cn2, "ComfyUI-KJNodes", "INSTALLED")), r1);
  const r2 = await Packs.install(L.find((p) => p.id === "nativeaudio"), cn2, { git, log: () => {} });
  check("a SUBFOLDER pack lands as its own folder", r2.ok && fs.existsSync(path.join(cn2, "ComfyUI-H3-NativeAudioLock", "__init__.py")) && !fs.existsSync(path.join(cn2, "ComfyUI-H3-NativeAudioLock", "README.md")), r2);
  const r3 = await Packs.install(L.find((p) => p.id === "kjnodes"), cn2, { git, log: () => {} });
  check("installing a pack that is there is a no-op", r3.ok && r3.skipped);

  // ================================================================ COMFY folder
  const port = path.join(TMP, "ComfyUI_windows_portable");
  fs.mkdirSync(path.join(port, "python_embeded"), { recursive: true });
  fs.mkdirSync(path.join(port, "ComfyUI", "comfy"), { recursive: true });
  fs.writeFileSync(path.join(port, "ComfyUI", "main.py"), "");
  fs.writeFileSync(path.join(port, "python_embeded", process.platform === "win32" ? "python.exe" : "python"), "");
  const ip = Comfy.inspectDir(port);
  check("the portable build: root = its top folder, python_embeded", ip.ok && ip.portable && ip.root === port && /python_embeded/.test(ip.python), ip);
  const ip2 = Comfy.inspectDir(path.join(port, "ComfyUI"));
  check("the ComfyUI folder itself is accepted", ip2.ok && ip2.main === path.join(port, "ComfyUI"));
  check("a folder that is not ComfyUI says so", !Comfy.inspectDir(TMP).ok && /not a ComfyUI folder/.test(Comfy.inspectDir(TMP).error));
  check("a folder that does not exist says so", /not found/.test(Comfy.inspectDir(path.join(TMP, "zz")).error));

  // ================================================================ llama.cpp asset pick
  const assets = ["llama-b7000-bin-win-cuda-12.4-x64.zip", "llama-b7000-bin-macos-arm64.zip", "llama-b7000-bin-macos-x64.zip",
                  "llama-b7000-bin-ubuntu-x64.zip", "llama-b7000-bin-ubuntu-vulkan-x64.zip"].map((name) => ({ name }));
  check("llama.cpp: Apple Silicon build on an M-series Mac", Llama.pickAsset(assets, "darwin", "arm64").name === "llama-b7000-bin-macos-arm64.zip");
  check("llama.cpp: the Vulkan build on Linux (NVIDIA + AMD)", Llama.pickAsset(assets, "linux", "x64").name === "llama-b7000-bin-ubuntu-vulkan-x64.zip");
  check("llama.cpp: the plain Linux build when there is no Vulkan one", Llama.pickAsset(assets.filter((a) => !/vulkan/.test(a.name)), "linux", "x64").name === "llama-b7000-bin-ubuntu-x64.zip");
  check("llama.cpp: nothing for win32 here (get-llama.ps1 does Windows)", Llama.pickAsset(assets, "win32", "x64") === null);

  // ================================================================ the stub Hugging Face
  const BLOB = Buffer.alloc(200000, 7);
  const REPOS = {
    "open/repo": { gated: false, files: { "sub/model.safetensors": BLOB, "x.gguf": BLOB } },
    "gated/repo": { gated: "auto", files: { "g.safetensors": BLOB } },
    "unsloth/Qwen3-4B-GGUF": { gated: false, files: { "Qwen3-4B-Q4_K_M.gguf": BLOB } },
  };
  const GOOD = "hf_good", NOACCESS = "hf_noaccess";
  const hf = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const tok = String(req.headers.authorization || "").replace(/^Bearer /, "");
    const json = (code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (u.pathname === "/api/whoami-v2") return tok === GOOD || tok === NOACCESS ? json(200, { name: "tim" }) : json(401, { error: "bad" });
    let m = /^\/api\/models\/([^/]+\/[^/]+)(\/tree\/main)?$/.exec(u.pathname);
    if (m) {
      const r = REPOS[m[1]];
      if (!r) return json(404, { error: "Repository not found" });
      if (m[2]) return json(200, Object.entries(r.files).map(([p, b]) => ({ type: "file", path: p, size: 100, lfs: { size: b.length } })));
      return json(200, { id: m[1], gated: r.gated, usedStorage: 400000 });
    }
    m = /^\/([^/]+\/[^/]+)\/resolve\/main\/(.+)$/.exec(u.pathname);
    if (m) {
      const r = REPOS[m[1]]; const b = r && r.files[decodeURIComponent(m[2])];
      if (!b) return json(404, {});
      if (r.gated && !tok) return json(401, {});
      if (r.gated && tok === NOACCESS) return json(403, {});
      if (u.searchParams.get("cut") === "1") { res.writeHead(200, { "content-length": b.length }); res.write(b.subarray(0, 1000)); return setTimeout(() => res.socket.destroy(), 100); }
      const rg = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
      if (rg) {
        const a = +rg[1], e = rg[2] ? +rg[2] : b.length - 1;
        if (a >= b.length) { res.writeHead(416); return res.end(); }
        res.writeHead(206, { "content-length": e - a + 1, "content-range": `bytes ${a}-${e}/${b.length}` });
        return res.end(b.subarray(a, e + 1));
      }
      res.writeHead(200, { "content-length": b.length }); return res.end(b);
    }
    json(404, {});
  });
  await new Promise((ok) => hf.listen(0, "127.0.0.1", ok));
  process.env.BITGEN_HF_BASE = `http://127.0.0.1:${hf.address().port}`;

  check("token: a good one names the account", (await Models.checkToken(GOOD)).name === "tim");
  const badTok = await Models.checkToken("hf_bad");
  check("token: a bad one says 401 and where to get one", !badTok.ok && /401/.test(badTok.error) && /settings\/tokens/.test(badTok.error), badTok);
  check("token: none is 'no token'", (await Models.checkToken("")).error === "no token");

  const paths = { comfyModels: path.join(TMP, "models"), app: path.join(TMP, "app") };
  const E = [
    { id: "o1", repo: "open/repo", file: "sub/model.safetensors", dest: "comfy/diffusion_models", size: 1 },
    { id: "o2", repo: "open/repo", file: "gone.safetensors", dest: "comfy/vae", size: 1 },
    { id: "g1", repo: "gated/repo", file: "g.safetensors", dest: "comfy/diffusion_models", size: 1 },
    { id: "n1", repo: "no/such", file: "a.bin", dest: "comfy/vae", size: 1 },
    { id: "a1", repo: "open/repo", file: "x.gguf", dest: "app/llm-models", as: "renamed.gguf", size: 1 },
  ];
  let rows = await Models.inspect(E, "", paths);
  const R = (id) => rows.find((r) => r.id === id);
  check("inspect: an open file is available with its LIVE size", R("o1").available && R("o1").size === BLOB.length && !R("o1").gated, R("o1"));
  check("inspect: a file the repo no longer has is flagged, not failed later", !R("o2").available && /no longer in/.test(R("o2").why), R("o2"));
  check("NO TOKEN: a gated model cannot be downloaded", !R("g1").available && R("g1").gated === "auto" && /token/.test(R("g1").why), R("g1"));
  check("inspect: a repo that is gone says so", !R("n1").available && /not on Hugging Face/.test(R("n1").why), R("n1"));
  rows = await Models.inspect(E, GOOD, paths);
  check("WITH a token (licence accepted): the gated model is available", R("g1").available, R("g1"));
  rows = await Models.inspect(E, NOACCESS, paths);
  check("with a token whose account has NOT accepted the licence: says so", !R("g1").available && /accepted this licence/.test(R("g1").why), R("g1"));
  check("destPath: comfy/<folder> and app/<folder> with the 'as' name",
    Models.destPath(E[0], paths) === path.join(paths.comfyModels, "diffusion_models", "model.safetensors")
    && Models.destPath(E[4], paths) === path.join(paths.app, "llm-models", "renamed.gguf"));

  const row1 = Object.assign({}, E[0], { size: BLOB.length, available: true });
  let prog = 0;
  const d1 = await Models.download(row1, { paths, onProgress: () => { prog++; } });
  const dest1 = Models.destPath(E[0], paths);
  check("download: the file lands whole, with progress", d1.ok && fs.statSync(dest1).size === BLOB.length && prog > 1, d1);
  check("download: present() now, and a second run skips it", Models.present(E[0], paths, BLOB.length) && (await Models.download(row1, { paths })).skipped);
  const row5 = Object.assign({}, E[4], { size: BLOB.length, available: true });
  const d5dest = Models.destPath(E[4], paths);
  fs.mkdirSync(path.dirname(d5dest), { recursive: true });
  fs.writeFileSync(d5dest + ".part", BLOB.subarray(0, 50000));
  const d5 = await Models.download(row5, { paths });
  check("download RESUMES a .part (Range) and the result is byte-exact", d5.ok && d5.resumed && fs.readFileSync(d5dest).equals(BLOB), d5);
  fs.rmSync(d5dest); fs.writeFileSync(d5dest + ".part", BLOB);
  const d6 = await Models.download(row5, { paths });
  check("download: a .part that is already whole (416) is finished, not refetched", d6.ok && fs.statSync(d5dest).size === BLOB.length, d6);
  const cut = await X.download(`${process.env.BITGEN_HF_BASE}/open/repo/resolve/main/x.gguf?cut=1`, path.join(TMP, "cut.bin"), {});
  check("a cut connection fails AND keeps the .part to resume", !cut.ok && fs.existsSync(path.join(TMP, "cut.bin.part")), cut);
  const g = await Models.download(Object.assign({}, E[2], { size: BLOB.length, available: true }), { paths });
  check("a gated download without a token explains the licence + token", !g.ok && /gated/.test(g.error), g);
  const sf = Models.settingsFor([{ llm: true, file: "a.gguf", size: 1 }, { llm: true, file: "b.gguf", size: 9 },
    { vision: "model", dest: "app/qwen3vl", file: "vl.gguf" }, { vision: "mmproj", dest: "app/qwen3vl", file: "mm.gguf" }], paths);
  check("settingsFor: the biggest LLM is the one loaded; vision model + projector", sf.llm.last_file === "b.gguf" && /vl\.gguf$/.test(sf.captioner.model) && /mm\.gguf$/.test(sf.captioner.mmproj), sf);

  // ================================================================ the catalog vs the workflows
  const C = Models.CATALOG;
  const gids = new Set(C.groups.map((x) => x.id));
  check("catalog: unique ids, known groups, a repo and a destination each",
    new Set(C.models.map((m) => m.id)).size === C.models.length
    && C.models.every((m) => gids.has(m.group) && /^[^/]+\/[^/]+$/.test(m.repo) && /^(comfy\/|app\/|hf-cache$)/.test(m.dest) && (m.file || m.dest === "hf-cache")),
    C.models.filter((m) => !gids.has(m.group) || !(m.file || m.dest === "hf-cache")).map((m) => m.id));
  check("catalog: every 'with' partner exists", C.models.filter((m) => m.with).every((m) => ids.has(m.with)));
  // 2.502.0: + FLUX 3 Image Klein (black-forest-labs/flux-3-image-klein-comfy - its three files, all gated)
  check("catalog: only FLUX.2 Klein + FLUX 3 Klein are expected to be gated (the rest download without a token)",
    C.models.filter((m) => /black-forest-labs/.test(m.repo)).map((m) => m.repo).join() === "black-forest-labs/FLUX.2-klein-9B"
      + ",black-forest-labs/flux-3-image-klein-comfy".repeat(3));
  const names = new Set(C.models.map((m) => {
    const base = m.as || path.basename(m.file || "");
    const sub = m.dest.split("/").slice(2).join("/");
    return sub ? `${sub}/${base}` : base;
  }));
  const need = new Set();
  for (const f of ["ref2va.json", "fl2va.json", "MiniMax_H3_Swap.json", "MM3_Characters.json", "audio_minimax_music3.json",
                   "audio_yue2.json", "img_flux2_9b_t2i_verified.json", "img_sdxl_t2i.json", "utility_seedvr2_7b_int8_upscale_image_api.json",
                   "img_qwen_edit_2511.json", "img_qwen21_edit.json", "img_flux_kontext_edit.json", "img_flux_fill_inpaint.json"]) {
    const t = fs.readFileSync(path.join(APP, "comfy_workflows", f), "utf8");
    // loader values only (a note's "  models/vae/x.safetensors" text is not one)
    for (const m of t.matchAll(/"([^"\s]+\.(?:safetensors|gguf|pt))"/g)) if (!/^models\//.test(m[1])) need.add(m[1].replace(/\\\\/g, "/"));
  }
  const uncovered = [...need].filter((n) => !names.has(n));
  check("every model file the shipped default workflows load is in the download list (same name, same subfolder)", !uncovered.length, uncovered);

  // ================================================================ END TO END: setup-cli in a copy of the app
  const A = path.join(TMP, "bitgen");
  fs.mkdirSync(A);
  // the app as a release carries it (not this checkout's data, models or runtime)
  const SKIP = new Set(["node_modules", "dist", "output", "projects", "models", "llm-models", "venvs", "comfy", "runtime", "datasets",
    "workspace", "loras", "music", "graphs", "styles", "custom.settings", "custom.settings.bak", "e2e-run.log", "__pycache__",
    ".setup-done", ".setup-pending", "setup.log", "setup.json", "llama-cpp", "qwen3vl", "sd-cpp", "components.txt"]);
  for (const f of fs.readdirSync(APP)) if (!SKIP.has(f)) fs.cpSync(path.join(APP, f), path.join(A, f), { recursive: true });
  fs.cpSync(path.join(APP, "node_modules"), path.join(A, "node_modules"), { recursive: true });
  const cliEnv = Object.assign({}, process.env, { BITGEN_SETUP_SKIP_TORCH: "1", PIP_NO_INDEX: "1", HF_TOKEN: "" });
  const cli = await shA(process.execPath, [path.join(A, "scripts", "setup-cli.js"), "--comfy", "new", "--no-omnivoice", "--no-llama",
    "--models", "llm_4b"], { env: cliEnv, cwd: A });
  const out = (cli.stdout || "") + (cli.stderr || "");
  fs.writeFileSync(path.join(TMP, "cli.log"), out);
  check("setup-cli: the whole setup runs to the end", cli.status === 0 && /is set up/.test(out), out.slice(-1500));
  const main = path.join(A, "comfy", "ComfyUI");
  check("ComfyUI: cloned into <app>/comfy/ComfyUI with its OWN venv and run.sh",
    fs.existsSync(path.join(main, "main.py")) && fs.existsSync(Comfy.venvPy(path.join(main, "venv"))) && fs.existsSync(path.join(main, process.platform === "win32" ? "run.bat" : "run.sh")));
  const got = fs.readdirSync(path.join(main, "custom_nodes"));
  check("EVERY custom node pack the project uses is installed", L.every((p) => got.includes(p.folder)), L.filter((p) => !got.includes(p.folder)).map((p) => p.folder));
  check("the import check caught the pack that fails to load", /failed to import in ComfyUI: ComfyUI-Spectrum-MiniMax-H3/.test(out), out.slice(-800));
  const cfg = JSON.parse(fs.readFileSync(path.join(A, "custom.settings"), "utf8"));
  check("Settings: ComfyUI folder (relative), started with the app", cfg.engine.comfy.dir === "comfy/ComfyUI" && cfg.engine.comfy.autostart === true, cfg.engine.comfy);
  check("Settings: tuned for THIS machine (setup.tier recorded, render size from the tier)",
    cfg.setup && cfg.setup.tier && cfg.defaults.width === Tune.TIERS[cfg.setup.tier].width, cfg.setup);
  check("the LLM downloaded to <app>/llm-models and is the one the assistant loads",
    fs.existsSync(path.join(A, "llm-models", "Qwen3-4B-Q4_K_M.gguf")) && cfg.llm.last_file === "Qwen3-4B-Q4_K_M.gguf", cfg.llm);
  check("setup is marked done: the next start opens the studio", fs.existsSync(path.join(A, ".setup-done")) && !fs.existsSync(path.join(A, ".setup-pending")));
  check("setup.log + setup.json are written", fs.existsSync(path.join(A, "setup.log")) && JSON.parse(fs.readFileSync(path.join(A, "setup.json"), "utf8")).comfy.main === main);
  const det2 = JSON.parse(sh(process.execPath, [path.join(A, "scripts", "setup-cli.js"), "--detect"], { env: cliEnv }).stdout);
  check("--detect: sees the configured ComfyUI and the finished setup", det2.comfy.configured === main && det2.done === true, det2.comfy);
  // 2.355.0: the Viggle (native) choice
  const comp = () => { try { return fs.readFileSync(path.join(A, "components.txt"), "utf8"); } catch { return ""; } };
  check("2.355.0: no --viggle -> components.txt viggle native=2 (do not install); --detect shows the download size",
    /\nviggle native=2\n/.test(comp()) && /viggle native=2 - the swap dialog/.test(out) && det2.viggle && det2.viggle.total_gb > 5 && det2.viggle.venv_gb === 5,
    { comp: comp(), viggle: det2.viggle });
  const again = sh(process.execPath, [path.join(A, "scripts", "setup-cli.js"), "--comfy", `existing:${main}`, "--no-omnivoice", "--no-llama", "--no-check",
    "--models", "none", "--viggle"], { env: cliEnv });
  check("2.355.0: --viggle -> viggle native=0 (the first start installs it), the size said", /\nviggle native=0\n/.test(comp())
    && /Viggle \(native\) installs when the studio opens - ~[0-9.]+ GB/.test(again.stdout || ""), (again.stdout || "").slice(-400));
  check("running setup again on the EXISTING ComfyUI: nothing to add", again.status === 0 && /every node pack is already there/.test(again.stdout), (again.stdout || "").slice(-600));
  const S2 = require(path.join(A, "lib", "setupRun"));
  check("setupRun.wanted: .setup-done -> the studio; H3_SETUP=1 forces the wizard",
    S2.wanted(true) === false && (process.env.H3_SETUP = "1", S2.wanted(false)) === true);
  delete process.env.H3_SETUP;

  // ================================================================ the Unix bootstrap (fake Node + uv)
  const FK = path.join(TMP, "fake");
  fs.mkdirSync(path.join(FK, "node-v0-linux-x64", "bin"), { recursive: true });
  fs.symlinkSync(process.execPath, path.join(FK, "node-v0-linux-x64", "bin", "node"));
  const npmReal = X.which("npm");
  fs.writeFileSync(path.join(FK, "node-v0-linux-x64", "bin", "npm"), `#!/bin/sh\nexec "${npmReal}" "$@"\n`, { mode: 0o755 });
  fs.mkdirSync(path.join(FK, "uv-x", ""), { recursive: true });
  const py3 = X.which("python3");
  fs.writeFileSync(path.join(FK, "uv-x", "uv"), `#!/bin/sh\n# fake uv: venv DIR --python V --seed\n[ "$1" = venv ] || exit 3\nexec "${py3}" -m venv "$2"\n`, { mode: 0o755 });
  execFileSync("tar", ["-czf", path.join(FK, "node.tgz"), "-C", FK, "node-v0-linux-x64"]);
  execFileSync("tar", ["-czf", path.join(FK, "uv.tgz"), "-C", FK, "uv-x"]);
  const B = path.join(TMP, "boot");
  fs.cpSync(A, B, { recursive: true, filter: (s) => !/[/\\](comfy|llm-models)$/.test(s) && !/\.setup-done$|custom\.settings$|setup\.(log|json)$/.test(s) });
  const HOME = path.join(TMP, "home");
  fs.mkdirSync(path.join(HOME, "Desktop"), { recursive: true });
  if (process.platform !== "win32") {
    const bs = sh("sh", [path.join(B, "installer", "bootstrap.sh"), "--no-launch"], {
      env: Object.assign({}, process.env, { HOME, XDG_DATA_HOME: "", BITGEN_NODE_URL: `file://${FK}/node.tgz`, BITGEN_UV_URL: `file://${FK}/uv.tgz`,
        BITGEN_NO_ELECTRON: "1", BITGEN_SKIP_PIP: "1", npm_config_offline: "true" }) });
    const bo = (bs.stdout || "") + (bs.stderr || "");
    fs.writeFileSync(path.join(TMP, "boot.log"), bo);
    check("bootstrap.sh: runs to the end", bs.status === 0 && /bootstrap done/.test(bo), bo.slice(-1500));
    check("bootstrap: Node.js unpacked into runtime/node", fs.existsSync(path.join(B, "runtime", "node", "bin", "node")));
    check("bootstrap: the app's Python environment in runtime/python", fs.existsSync(path.join(B, "runtime", "python", "bin", "python")));
    const bcfg = JSON.parse(fs.readFileSync(path.join(B, "custom.settings"), "utf8"));
    check("bootstrap: Settings -> python is the runtime python", bcfg.python === path.join(B, "runtime", "python", "bin", "python"), bcfg.python);
    check("bootstrap: the setup wizard opens on the first start (.setup-pending)", fs.existsSync(path.join(B, ".setup-pending")));
    const desk = path.join(HOME, ".local", "share", "applications", "bitgen-studio.desktop");
    check("bootstrap: a desktop entry in the app menu + on the desktop", fs.existsSync(desk) && fs.existsSync(path.join(HOME, "Desktop", "bitgen-studio.desktop"))
      && /Exec=".*bitgen-studio\.sh"/.test(fs.readFileSync(desk, "utf8")));
    fs.writeFileSync(path.join(B, ".setup-done"), "x"); fs.rmSync(path.join(B, ".setup-pending"));
    const bs2 = sh("sh", [path.join(B, "installer", "bootstrap.sh"), "--no-launch"], {
      env: Object.assign({}, process.env, { HOME, BITGEN_NO_ELECTRON: "1", BITGEN_SKIP_PIP: "1", npm_config_offline: "true" }) });
    check("bootstrap again (an UPGRADE): reuses runtime/, keeps the finished setup", bs2.status === 0 && /already in runtime\/node/.test(bs2.stdout)
      && /Python already/.test(bs2.stdout) && !fs.existsSync(path.join(B, ".setup-pending")), (bs2.stdout || "").slice(-800));
    // the launcher, browser mode: runtime/ on PATH, the server comes up
    const port = 18400 + Math.floor(Math.random() * 400);
    const { spawn } = require("child_process");
    const lp = spawn("sh", [path.join(B, "misc", "bitgen-studio.sh")], { env: Object.assign({}, process.env, { H3_NO_SHELL: "1", H3_PORT: String(port), PORT: String(port), HOME, DISPLAY: "" }), stdio: "ignore", detached: true });
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      await new Promise((r) => setTimeout(r, 500));
      up = await new Promise((r) => http.get(`http://127.0.0.1:${port}/api/health`, (res) => { res.resume(); r(res.statusCode === 200); }).on("error", () => r(false)));
    }
    try { process.kill(-lp.pid, "SIGTERM"); } catch { /* gone */ }
    check("bitgen-studio.sh (browser mode) starts the studio server", up);
  }

  // ================================================================ the installers themselves
  check("bootstrap.ps1: portable Node, uv Python 3.12, MinGit, ffmpeg, Electron, shortcuts, --bootstrap",
    (() => { const t = fs.readFileSync(path.join(APP, "installer", "bootstrap.ps1"), "utf8");
      return /nodejs\.org\/dist\/index\.json/.test(t) && /uv venv|& \$uv venv/.test(t) && /MinGit/.test(t) && /FFmpeg-Builds/.test(t)
        && /electron\\install\.js|node_modules\\electron\\install\.js/.test(t) && /CreateShortcut/.test(t) && /--bootstrap \$py/.test(t)
        && /\$ErrorActionPreference = "Continue"/.test(t) && !/[^\x00-\x7f]/.test(t); })());
  const makensis = X.which("makensis");
  if (makensis && process.platform !== "win32") {
    const SRC = path.join(TMP, "nsis-src");
    fs.mkdirSync(path.join(SRC, "installer"), { recursive: true });
    fs.copyFileSync(path.join(APP, "installer", "bitgen.ico"), path.join(SRC, "installer", "bitgen.ico"));
    fs.copyFileSync(path.join(APP, "LICENSE"), path.join(SRC, "LICENSE"));
    fs.writeFileSync(path.join(SRC, "start.bat"), "@echo off\r\n");
    const exe = path.join(TMP, "Setup.exe");
    const mk = sh(makensis, ["-V2", "-DVERSION=9.9.9", `-DSRC=${SRC}`, `-DOUT=${exe}`, path.join(APP, "installer", "windows", "bitgen-setup.nsi")]);
    check("the NSIS script compiles into a Setup.exe (MZ)", mk.status === 0 && fs.readFileSync(exe).subarray(0, 2).toString() === "MZ", (mk.stdout || "") + (mk.stderr || ""));
  } else check("NSIS compile (makensis not installed - skipped)", true);
  // the self-extracting Unix installer, built by build-installers.sh from a tiny "full zip"
  if (process.platform !== "win32") {
    const Z = path.join(TMP, "zip");
    fs.mkdirSync(path.join(Z, "installer"), { recursive: true });
    fs.writeFileSync(path.join(Z, "installer", "bootstrap.sh"), '#!/bin/sh\necho "BOOT $*" > "$(dirname "$0")/../booted"\n');
    fs.writeFileSync(path.join(Z, "LICENSE"), "x");
    fs.copyFileSync(path.join(APP, "installer", "bitgen.ico"), path.join(Z, "installer", "bitgen.ico"));
    const zipf = path.join(TMP, "bitgen-studio-v9.9.9-full.zip");
    sh("python3", ["-c", "import sys,zipfile,os\nz=zipfile.ZipFile(sys.argv[1],'w')\nfor r,d,f in os.walk(sys.argv[2]):\n  for n in f: p=os.path.join(r,n); z.write(p,os.path.relpath(p,sys.argv[2]))\nz.close()", zipf, Z]);
    const OUTD = path.join(TMP, "inst");
    const bi = sh("sh", [path.join(APP, "scripts", "build-installers.sh"), zipf, OUTD], { env: Object.assign({}, process.env, { PATH: process.env.PATH }) });
    const lin = path.join(OUTD, "bitgen-studio-setup-9.9.9-linux.sh");
    check("build-installers.sh: the Linux .sh and the macOS .command", bi.status === 0 && fs.existsSync(lin) && fs.existsSync(path.join(OUTD, "bitgen-studio-setup-9.9.9-macos.command")), (bi.stdout || "") + (bi.stderr || ""));
    const dest = path.join(TMP, "unpacked here");
    const run = sh("sh", [lin, "--dir", dest, "--no-launch"]);
    check("the Linux installer unpacks to --dir (a path with a space) and runs the bootstrap with --no-launch",
      run.status === 0 && fs.existsSync(path.join(dest, "LICENSE")) && /BOOT --no-launch/.test(fs.readFileSync(path.join(dest, "booted"), "utf8")), (run.stdout || "") + (run.stderr || ""));
    check("the installer's --help names the options", /--dir DIR/.test(sh("sh", [lin, "--help"]).stdout));
    if (makensis) check("build-installers.sh: the Windows Setup.exe too", fs.existsSync(path.join(OUTD, "bitGen-Studio-Setup-9.9.9.exe")));
  }

  // ================================================================ the wizard page (jsdom)
  const { JSDOM } = require("jsdom");
  const html = fs.readFileSync(path.join(APP, "electron", "installer.html"), "utf8");
  const calls = [];
  let evCb = null;
  const DET = { platform: "win32", arch: "x64", gpu: pHigh, plan: Tune.summary(pHigh), recommended: [], python: "py", git: "git", ffmpeg: "",
                comfy: { configured: "", defaultDir: "C:\\bitGen\\comfy" }, omnivoice: false, llama: true, done: false };
  const ROWS = [
    { id: "h3_ref2va", group: "video", label: "Ref2VA", available: true, present: false, ticked: true, recommended: true, size: 2e10, for: "scenes" },
    { id: "klein9b", group: "images", label: "Klein", available: false, gated: "auto", present: false, ticked: false, size: 1.8e10, why: "gated - needs a Hugging Face token" },
    { id: "sdxl", group: "images", label: "SDXL", available: true, present: true, ticked: false, size: 7e9 },
  ];
  const makeApi = (installResult, dlResult) => ({
    detect: async () => (calls.push("detect"), DET),
    browse: async () => "D:\\picked",
    inspect: async (d) => (calls.push("inspect:" + d), d === "D:\\ComfyUI" ? { ok: true, main: d, python: "p", how: "venv",
      packs: L.map((p, i) => ({ id: p.id, folder: p.folder, for: p.for, present: i < 10 })) } : { ok: false, error: "not a ComfyUI folder" }),
    install: async (plan) => { calls.push(["install", plan]); evCb({ type: "step", id: "python", state: "ok" }); evCb({ type: "log", line: "hello log" }); return installResult; },
    token: async (t) => (calls.push("token:" + t), t === "hf_good" ? { ok: true, name: "tim" } : { ok: false, error: "401" }),
    models: async (t) => (calls.push("models:" + t), { groups: Models.CATALOG.groups, rows: ROWS }),
    disk: async () => 5e11,
    download: async (ids, t) => { calls.push(["download", ids, t]); evCb({ type: "file", id: ids[0], state: "ok" }); return dlResult; },
    finish: async () => calls.push("finish"), skip: async () => calls.push("skip"),
    minimize: async () => {}, close: async () => calls.push("close"),
    onEvent: (cb) => { evCb = cb; },
  });
  const tick = () => new Promise((r) => setTimeout(r, 30));
  async function wizard(installResult, dlResult) {
    calls.length = 0;
    const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(w) { w.h3setup = makeApi(installResult, dlResult); } });
    await tick();
    return dom.window;
  }
  const OKRUN = { ok: true, steps: { python: { ok: true } }, warnings: [] };
  let w = await wizard(OKRUN, { ok: true, done: ["h3_ref2va"], failed: [] });
  const $ = (id) => w.document.getElementById(id);
  const on = () => (w.document.querySelector(".page.on") || {}).id;
  check("page 1: the GPU check is shown with the plan for it", /RTX 4090 - 24 GB/.test($("hw_gpu").textContent) && $("hw_plan").children.length === 4, $("hw_gpu").textContent);
  check("page 1: new ComfyUI by default, in the app's comfy folder; OmniVoice offered", $("cm_new").checked && $("dir_new").value === "C:\\bitGen\\comfy" && !!$("cb_omni"));
  check("page 1: the llama.cpp row says it is already installed", /already installed/.test($("cb_llama").nextElementSibling.textContent));
  $("cm_ex").checked = true; $("cm_ex").onchange(); await tick();
  check("existing ComfyUI: the folder box + its Browse button come alive", !$("dir_ex").disabled && !$("b_ex").disabled && $("dir_new").disabled);
  $("dir_ex").value = "E:\\nothing"; await $("dir_ex").onchange(); await tick();
  check("existing ComfyUI: a wrong folder says so", /not a ComfyUI folder/.test($("ex_note").textContent));
  $("dir_ex").value = "D:\\ComfyUI"; await $("dir_ex").onchange(); await tick();
  check("existing ComfyUI: every pack shown, the 11 missing marked to install (2.338.0: + the LTX canvas's five; 2.342.0: + LTXVideo, RES4LYF; 2.344.0: + Viggle; 2.401.2: - ComfyMath)",
    $("packs").children.length === 21 && w.document.querySelectorAll("#packs .chip.miss").length === 11 && /11 of the 21/.test($("packs_note").textContent), $("packs_note").textContent);
  await $("b_ex").onclick(); await tick();
  check("the Browse button (folder select) fills the box and re-inspects", $("dir_ex").value === "D:\\picked" && calls.includes("inspect:D:\\picked"));
  $("dir_ex").value = "D:\\ComfyUI"; await $("dir_ex").onchange(); await tick();
  await $("b_install").onclick(); await tick();
  const inst = calls.find((c) => Array.isArray(c) && c[0] === "install");
  check("Install sends the plan: existing ComfyUI, OmniVoice, the assistant", inst && inst[1].comfy.mode === "existing" && inst[1].comfy.dir === "D:\\ComfyUI" && inst[1].omnivoice === true && inst[1].llama === true, inst);
  check("installing: step rows + the live log", !!$("st_python") && /hello log/.test($("ilog").textContent));
  check("after the packages: the MODELS page, the token box BEFORE the list", on() === "pg_models"
    && ($("tok").compareDocumentPosition($("mlist")) & w.Node.DOCUMENT_POSITION_FOLLOWING) && calls.includes("models:"), on());
  check("no token: the gated model's box is disabled with the reason; downloaded ones too",
    $("m_klein9b").querySelector("input").disabled && /token/.test($("m_klein9b").textContent) && $("m_sdxl").querySelector("input").disabled);
  check("the recommended model is pre-ticked, with the total + free space", $("m_h3_ref2va").querySelector("input").checked && /1 file/.test($("mtot").textContent) && /free/.test($("mtot").textContent), $("mtot").textContent);
  $("tok").value = "hf_bad"; await $("b_tok").onclick(); await tick();
  check("a bad token: says so and keeps to the open models", /only the open models/.test($("tokmsg").textContent) && calls.includes("models:"));
  $("tok").value = "hf_good"; await $("b_tok").onclick(); await tick();
  check("a good token: signed in, the list asked again WITH it", /Signed in as tim/.test($("tokmsg").textContent) && calls.includes("models:hf_good"));
  await $("b_download").onclick(); await tick();
  const dl = calls.find((c) => Array.isArray(c) && c[0] === "download");
  check("Download sends the ticked ids and the token", dl && dl[1].join() === "h3_ref2va" && dl[2] === "hf_good", dl);
  check("all done, no notes: the studio OPENS BY ITSELF (countdown)", on() === "pg_done" && /Opening in/.test($("launch_in").textContent), $("launch_in").textContent);
  $("b_launch").onclick(); await tick();
  check("Start now: hands over to the studio", calls.includes("finish"));
  w.close();
  w = await wizard({ ok: true, steps: {}, warnings: ["node packs that did not install: X"] }, { ok: false, done: [], failed: [{ id: "h3_ref2va", error: "disk full" }] });
  await w.document.getElementById("b_install").onclick(); await tick();
  await w.document.getElementById("b_download").onclick(); await tick();
  check("with warnings: they are listed and nothing launches on its own",
    /did not install: X/.test(w.document.getElementById("done_list").textContent) && /disk full/.test(w.document.getElementById("done_list").textContent)
    && !/Opening in/.test(w.document.getElementById("launch_in").textContent));
  w.close();
  w = await wizard({ ok: false, steps: { comfy: { ok: false, error: "could not fetch ComfyUI" } }, warnings: [] }, {});
  await w.document.getElementById("b_install").onclick(); await tick();
  check("a failed ComfyUI install STOPS with the reason and a Close button",
    /Setup stopped/.test(w.document.getElementById("done_h").textContent) && /could not fetch ComfyUI/.test(w.document.getElementById("done_list").textContent)
    && w.document.getElementById("b_launch").textContent === "Close");
  w.close();

  // ================================================================ electron wiring
  const MAIN = fs.readFileSync(path.join(APP, "electron", "main.js"), "utf8");
  const PRE = fs.readFileSync(path.join(APP, "electron", "installer-preload.js"), "utf8");
  const chans = [...PRE.matchAll(/invoke\("(setup:[a-z]+)"/g)].map((m) => m[1]);
  check("every channel the wizard calls is handled in electron/main.js", chans.length >= 9 && chans.every((c) => MAIN.includes(`ipcMain.handle("${c}"`)), chans.filter((c) => !MAIN.includes(`ipcMain.handle("${c}"`)));
  check("electron puts runtime/ on PATH at start (shortcuts launch it directly)", /runtimeDirs\(\)/.test(MAIN));
  check("the setup gate is setupRun.wanted()", /Setup\(\)\.wanted\(/.test(MAIN));
  check("start.bat puts runtime\\ first on PATH (call set - no parse-time %PATH% in the block)", /call set "PATH=%%~D;%%PATH%%"/.test(fs.readFileSync(path.join(APP, "start.bat"), "utf8")));

  hf.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* keep */ }
}

main().then(() => {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, (e) => { console.log("FAIL: crashed: " + (e && e.stack || e)); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
