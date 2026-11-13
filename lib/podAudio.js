/* bitGen Studio — lib/podAudio.js (2.775.0): TEXT TO SPEECH, SPEECH TO TEXT AND SONG SEPARATION ON A RUNPOD POD.
 * Tim (verbatim): "when we create the pod can we have a button for tts, stt and demacus(sheet music) and allow bitgen to clone
 * voices and store the voice locally until user selects that voice" + "i am hoping for the same functionality for people with
 * minipc or gpu poor, if they are willing to rent gpu's"
 *
 *   A pod can hold the audio engines bitGen otherwise runs on this computer - its own copies of the same programs:
 *     tts    OmniVoice (scripts/omnivoice_local.py + ta_compat.py): speech, voice clones, designed voices, 🗣 Speech & dialog
 *     stt    faster-whisper (scripts/asr_local.py): transcripts, lyric timing, a clone's words, ✨ Create's lyrics
 *     stems  demucs (scripts/stems_local.py): vocals / drums / bass / other - ✂ Split, the Stems docker, sheet music
 *   rgpu.pod_audio = {pod: ["tts", "stt", "stems"]} - ticked in 🖥 PODS ▸ Create pod… or on a pod in My pods.
 *   wanted(kind)  in remote mode (Basic Settings ▸ GPU Remote / Both, RunPod ▸ Pods) a pod ticked for the kind takes it -
 *                 the pod in use first. Local = this computer, as before.
 *   install       a pod job (lib/podJob.js detach): ffmpeg if missing, then per engine a venv under
 *                 /workspace/bitgen-audio/venvs/<name> that reuses the pod's PyTorch (--system-site-packages), its packages
 *                 (the same ones misc/worker.py installs here), an import test; /workspace = kept while the pod is stopped.
 *                 Started when the pod is set up (lib/podMade.js) and before a job if not done yet.
 *   run(kind, job)  the helper's own JSON job: its input files go up (named by their contents - a voice clip is sent once and
 *                 kept on the pod; the voice itself stays in this computer's voice store until you pick it), the helper
 *                 runs on the pod as a pod job, its output files are written into the pod ComfyUI's output folder and
 *                 fetched back through ComfyUI's /view to where this computer would have written them; the JSON answer has
 *                 this computer's paths. The caller cannot tell it from venv.runJson.
 * Pure (Node: scripts/test-podaudio775.js): KINDS, kindsOf, pick, filesOf, rewrite, mapBack, installCode, runCode.
 */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const KINDS = {
  tts: { label: "Text to speech", venv: "omnivoice", pkgs: ["omnivoice", "soundfile"], test: "import omnivoice", helpers: ["omnivoice_local.py", "ta_compat.py"], helper: "omnivoice_local.py" },
  stt: { label: "Speech to text", venv: "whisper", pkgs: ["faster-whisper", "av<19", "nvidia-cublas-cu12", "nvidia-cudnn-cu12"], test: "import faster_whisper", helpers: ["asr_local.py"], helper: "asr_local.py" },
  stems: { label: "Song separation", venv: "demucs", pkgs: ["demucs", "soundfile"], test: "import demucs.separate", helpers: ["stems_local.py"], helper: "stems_local.py" },
};
const ROOT = "/workspace/bitgen-audio";
const pid = (x) => String(x || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }

/* ================================ pure ================================ */
/** a pod's audio kinds, cleaned (pure) */
function kindsOf(list) { return [...new Set((Array.isArray(list) ? list : []).map(String).filter((k) => KINDS[k]))]; }
/** which pod takes a `kind` job (pure): r = rgpu, on = remote generation on, eng = {pods}, where = the split's where
 *  -> pod id | "" (the pod in use first, then any pod ticked for it) */
function pick(r, kind, on, eng, where) {
  if (!on || !eng || !eng.pods || !where || where === "local") return "";
  const pa = (r && r.pod_audio) || {}, use = pid(((r && r.runpod) || {}).pod_id);
  if (use && kindsOf(pa[use]).includes(kind)) return use;
  return Object.keys(pa).find((k) => kindsOf(pa[k]).includes(kind)) || "";
}
/** the local input files a helper's job reads (pure): [{key path, file}] - top-level audio / file / ref_audio and each
 *  item's ref_audio (🗣 Speech & dialog's batch) */
function filesOf(job) {
  const out = [], j = job || {};
  for (const k of ["audio", "file", "ref_audio"]) if (typeof j[k] === "string" && j[k]) out.push({ at: [k], file: j[k] });
  (Array.isArray(j.items) ? j.items : []).forEach((it, i) => { if (it && typeof it.ref_audio === "string" && it.ref_audio) out.push({ at: ["items", i, "ref_audio"], file: it.ref_audio }); });
  return out;
}
const setAt = (o, at, v) => { let x = o; for (let i = 0; i < at.length - 1; i++) x = x[at[i]]; x[at[at.length - 1]] = v; };
/** the job as the pod runs it (pure): inputs -> their pod paths (up: {local file: pod path}), outputs (out, out_dir, each
 *  item's out) -> the pod's output folder; prompt_cache dropped (a file of this computer) */
function rewrite(job, up, outDir) {
  const j = JSON.parse(JSON.stringify(job || {}));
  for (const f of filesOf(job)) if (up[f.file]) setAt(j, f.at, up[f.file]);
  if (typeof j.out === "string" && j.out) j.out = outDir + "/" + path.basename(j.out);
  if (typeof j.out_dir === "string" && j.out_dir) j.out_dir = outDir;
  if (Array.isArray(j.items)) j.items.forEach((it) => { if (it && typeof it.out === "string") it.out = outDir + "/" + path.basename(it.out); });
  if ("prompt_cache" in j) j.prompt_cache = null;
  return j;
}
/** the pod's answer with this computer's paths (pure): every string that is a file in the pod's output folder -> where the
 *  local job wanted it (job.out / an item's out by name, else beside job.out_dir / job.out) -> {answer, files: [{pod, local}]} */
function mapBack(answer, job, outDir) {
  const files = [], j = job || {};
  const want = {};
  if (typeof j.out === "string" && j.out) want[path.basename(j.out)] = j.out;
  (Array.isArray(j.items) ? j.items : []).forEach((it) => { if (it && typeof it.out === "string") want[path.basename(it.out)] = it.out; });
  const dir = j.out_dir || (j.out ? path.dirname(j.out) : "");
  const walk = (v) => {
    if (typeof v === "string" && v.startsWith(outDir + "/")) {
      const nm = v.slice(outDir.length + 1), local = want[nm] || (dir ? path.join(dir, nm) : "");
      if (local) { if (!files.some((f) => f.pod === v)) files.push({ pod: v, local }); return local; }
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); return o; }
    return v;
  };
  return { answer: walk(answer), files };
}
/** the pod job that installs the engines (pure) -> Python for lib/podJob.js detach */
function installCode(kinds) {
  const spec = {}; for (const k of kindsOf(kinds)) spec[k] = { venv: KINDS[k].venv, pkgs: KINDS[k].pkgs, test: KINDS[k].test };
  return [
    "import json, os, shutil, subprocess, sys, threading, time",
    `SPEC = json.loads(${JSON.stringify(JSON.stringify(spec))}); ROOT = ${JSON.stringify(ROOT)}`,
    "P = os.path.join(os.getcwd(), '.bitgen_aud_inst.json')",
    "S = {'running': True, 'state': 'starting', 'done': [], 'failed': {}}",
    "def save():",
    "    t = P + '.tmp'",
    "    open(t, 'w').write(json.dumps(S)); os.replace(t, P)",
    "def sh(cmd):",
    "    r = subprocess.run(cmd, capture_output=True, text=True)",
    "    return r.returncode, ((r.stdout or '') + (r.stderr or ''))",
    "def last(t):",
    "    ls = [x for x in str(t).splitlines() if x.strip()]",
    "    e = [x for x in ls if x.startswith('ERROR') or 'Error' in x]",
    "    return (e[-1] if e else (ls[-1] if ls else 'no output'))[:300]",
    "def run():",
    "    try:",
    "        if not shutil.which('ffmpeg'):",
    "            S['state'] = 'installing ffmpeg'; save()",
    "            sh(['bash', '-lc', 'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg'])",
    "        for k, sp in SPEC.items():",
    "            vd = os.path.join(ROOT, 'venvs', sp['venv']); py = os.path.join(vd, 'bin', 'python')",
    "            if os.path.exists(py) and sh([py, '-c', sp['test']])[0] == 0:",
    "                S['done'].append(k); S['state'] = k + ' already there'; save(); continue",
    "            S['state'] = 'installing ' + k + ' (' + ', '.join(sp['pkgs']) + ')'; save()",
    "            if not os.path.exists(py):",
    "                c, o = sh([sys.executable, '-m', 'venv', '--system-site-packages', vd])",
    "                if c != 0: S['failed'][k] = 'could not make its Python environment - ' + last(o); save(); continue",
    "            c, o = sh([py, '-m', 'pip', 'install', '--progress-bar', 'off'] + sp['pkgs'])",
    "            if c != 0: S['failed'][k] = 'pip install did not work - ' + last(o); save(); continue",
    "            c, o = sh([py, '-c', sp['test']])",
    "            if c != 0: S['failed'][k] = 'installed, but it does not load - ' + last(o); save(); continue",
    "            S['done'].append(k); save()",
    "        S['state'] = 'done'",
    "    except Exception as e:",
    "        S['state'] = 'failed: ' + str(e)[:300]",
    "    S['running'] = False; save()",
    "save(); threading.Thread(target=run, daemon=True).start()",
    "print('bitgen-aud-inst-started')",
  ].join("\n");
}
/** the pod job that runs one helper (pure): writes its JSON job, runs the venv's Python on it, keeps the log's end */
function runCode(o) {
  const x = o || {};
  return [
    "import json, os, subprocess, threading, time",
    `JOB = json.loads(${JSON.stringify(JSON.stringify(x.job || {}))}); PY = ${JSON.stringify(String(x.python || ""))}; HELPER = ${JSON.stringify(String(x.helper || ""))}; JD = ${JSON.stringify(String(x.dir || ""))}; OUT = ${JSON.stringify(String(x.out || ""))}`,
    `P = os.path.join(os.getcwd(), '.bitgen_aud_${pid(x.id) || "job"}.json')`,
    "S = {'running': True, 'log': [], 'result': None, 'error': ''}",
    "def save():",
    "    t = P + '.tmp'",
    "    open(t, 'w').write(json.dumps(S)); os.replace(t, P)",
    "def run():",
    "    try:",
    "        os.makedirs(JD, exist_ok=True); os.makedirs(OUT, exist_ok=True)",
    "        jf = os.path.join(JD, 'job.json'); json.dump(JOB, open(jf, 'w'))",
    "        lf = open(os.path.join(JD, 'log.txt'), 'w'); of = open(os.path.join(JD, 'out.txt'), 'w')",
    "        p = subprocess.Popen([PY, HELPER, jf], stdout=of, stderr=lf, cwd=JD)",
    "        while p.poll() is None:",
    "            time.sleep(2)",
    "            try: S['log'] = [x for x in open(os.path.join(JD, 'log.txt'), errors='replace').read().splitlines() if x.strip()][-40:]; save()",
    "            except Exception: pass",
    "        lf.close(); of.close()",
    "        S['log'] = [x for x in open(os.path.join(JD, 'log.txt'), errors='replace').read().splitlines() if x.strip()][-40:]",
    "        ls = [x for x in open(os.path.join(JD, 'out.txt'), errors='replace').read().splitlines() if x.strip().startswith('{')]",
    "        if ls: S['result'] = json.loads(ls[-1])",
    "        elif p.returncode != 0: S['error'] = (S['log'][-1] if S['log'] else 'it stopped (exit ' + str(p.returncode) + ')')[:600]",
    "        else: S['error'] = 'it gave no answer'",
    "    except Exception as e:",
    "        S['error'] = str(e)[:600]",
    "    S['running'] = False; save()",
    "save(); threading.Thread(target=run, daemon=True).start()",
    "print('bitgen-aud-started')",
  ].join("\n");
}

/* ================================ the pod ================================ */
let D = null;
function deps() {
  if (D) return D;
  const PM = require("./podModels"), PJ = require("./podJob"), G = require("./gpuSplit");
  return {
    split: () => ({ on: G.enabled(), eng: G.engineOf(rg()), where: (G.split() || {}).where }),
    portOf: (p) => { try { return require("./stylePods").portOf(rg(), p); } catch { return 8188; } },
    ready: async (p, port, say, noStart) => {   // started if stopped (unless noStart), its ComfyUI waited for (installed on a blank pod)
      const P = require("./pods"), A = require("./runpodApi");
      const x = ((await P.mine()).pods || []).find((q) => q.id === p);
      if (!x || /TERMINATED/.test(String(x.status))) throw Object.assign(new Error(`the pod ${p} for audio is gone on RunPod - tick Text to speech / Speech to text / Song separation on another pod (🖥 PODS ▸ My pods)`), { status: 404 });
      if (/EXITED|STOPPED/.test(String(x.status)) && noStart) throw Object.assign(new Error("the pod is stopped - its audio is installed when it next runs"), { status: 409, stopped: true });
      if (/EXITED|STOPPED/.test(String(x.status))) { say("starting the stopped pod " + (x.name || p)); await A.action(p, "start", String((rg().runpod || {}).key || "")); }
      return require("./podRevive").waitReady(p, port, say);
    },
    kernel: (w, code) => PM.runKernel(w.jupyter_url, PM.jupyterOf(w.pod_id), code),
    status: (p, name) => PM.readCwdJson(p, name),
    put: async (w, file, dir, name) => {   // up through Jupyter (chunks), then moved into place (it may keep files elsewhere)
      const pw = PM.jupyterOf(w.pod_id), H = { Authorization: "token " + pw, "Content-Type": "application/json" }, st = fs.statSync(file);
      const tmp = "bitgen-audio-" + Date.now().toString(36) + "-" + name, CH = 16 << 20, n = Math.max(1, Math.ceil(st.size / CH)), fd = fs.openSync(file, "r");
      try {
        for (let i = 0; i < n; i++) {
          const buf = Buffer.alloc(Math.min(CH, st.size - i * CH)); fs.readSync(fd, buf, 0, buf.length, i * CH);
          const r = await PM.hit(w.jupyter_url + "/api/contents/" + encodeURIComponent(tmp), { method: "PUT", headers: H, ms: 600000,
            body: JSON.stringify({ type: "file", format: "base64", name: tmp, path: tmp, content: buf.toString("base64"), chunk: i === n - 1 ? -1 : i + 1 }) });
          if (r.status >= 300) throw new Error(`the pod's Jupyter refused ${name} (HTTP ${r.status})`);
        }
      } finally { fs.closeSync(fd); }
      const said = await PM.runKernel(w.jupyter_url, pw, PM.moveCode(tmp, dir, name));
      if (!/bitgen-moved/.test(said)) throw new Error(`${name} reached the pod but could not be put in place`);
    },
    get: async (w, podFile, local) => {   // back through the pod ComfyUI's /view (its output folder)
      const out = String(w.comfy_dir || "").replace(/\/+$/, "") + "/output/";
      if (!podFile.startsWith(out)) throw new Error("not in the pod ComfyUI's output folder: " + podFile);
      const rel = podFile.slice(out.length), sub = path.posix.dirname(rel), fn = path.posix.basename(rel);
      const u = w.comfy_url + "/view?type=output&filename=" + encodeURIComponent(fn) + "&subfolder=" + encodeURIComponent(sub === "." ? "" : sub);
      const r = await fetch(u, { headers: { "User-Agent": "bitGen-Studio" } });
      if (!r.ok) throw new Error(`could not fetch ${fn} from the pod (HTTP ${r.status})`);
      fs.mkdirSync(path.dirname(local), { recursive: true });
      fs.writeFileSync(local, Buffer.from(await r.arrayBuffer()));
    },
    sleep, poll: +(process.env.H3_POD_AUDIO_POLL || 2500),
  };
}
function setDeps(d) { D = null; if (d) D = Object.assign({}, deps(), d); }

/** the pod that takes a `kind` job now, or "" (this computer) */
function podFor(kind) { const s = deps().split(); return pick(rg(), kind, s.on, s.eng, s.where); }
function wanted(kind) { return !!podFor(kind); }
/** a pod's ticks (🖥 PODS) */
function kinds(pod) { return kindsOf((rg().pod_audio || {})[pid(pod)]); }
function setKinds(pod, list) {
  const C = core(), c = C.getConfig(), r = c.rgpu = c.rgpu || {}, k = pid(pod);
  r.pod_audio = Object.assign({}, r.pod_audio || {}); const l = kindsOf(list);
  if (l.length) r.pod_audio[k] = l; else delete r.pod_audio[k];
  C.setConfig(c);
  return kinds(k);
}
const INST = {};   // pod -> {running, state, done, failed, promise}
/** the engines on the pod (installed once; checked each run of the app) */
async function install(pod, list, say, opt) {
  const k = pid(pod), want = kindsOf(list || kinds(k)), d = deps(), tell = (t) => { try { if (say) say(t); require("./podActivity").note(k, t); } catch { /* fine */ } };
  if (!want.length) return { ok: true, done: [] };
  const R0 = INST[k];
  if (R0 && R0.running && R0.promise) return R0.promise;
  if (R0 && !R0.running && want.every((x) => (R0.done || []).includes(x))) return { ok: true, done: R0.done };
  const R = INST[k] = { running: true, state: "starting", done: [], failed: {} };
  R.promise = (async () => {
    try {
      const w = await d.ready(k, d.portOf(k), tell, !!(opt && opt.noStart));
      tell("installing on the pod: " + want.map((x) => KINDS[x].label.toLowerCase()).join(", "));
      const code = installCode(want), said = await d.kernel(w, require("./podJob").detach(code), code);   // (the program itself - tests)
      const why = require("./podJob").failed(said); if (why) throw new Error("the install did not start: " + why);
      let s = null;
      for (let i = 0; i < 2400; i++) {
        await d.sleep(d.poll * 2);
        s = await d.status(k, ".bitgen_aud_inst.json").catch(() => null);
        if (s) { R.state = s.state; tell(String(s.state || "")); if (!s.running) break; }
      }
      R.done = (s && s.done) || []; R.failed = (s && s.failed) || {};
      const bad = Object.keys(R.failed).map((x) => KINDS[x].label + ": " + R.failed[x]);
      try { require("./podActivity").finish(k, !bad.length, bad.length ? "audio on the pod - " + bad.join("; ") : "audio ready on the pod: " + R.done.map((x) => KINDS[x].label.toLowerCase()).join(", ")); } catch { /* fine */ }
      return { ok: !bad.length, done: R.done, failed: R.failed, why: bad.join("; ") };
    } catch (e) {
      const why = String((e && e.message) || e);
      if (e && e.stopped) return { ok: false, done: [], failed: {}, why, later: true };   // ticked on a stopped pod: when it runs
      try { require("./podActivity").finish(k, false, "audio on the pod - " + why); } catch { /* fine */ }
      return { ok: false, done: [], failed: {}, why };
    } finally { R.running = false; }
  })();
  return R.promise;
}
function status(pod) { const R = INST[pid(pod)]; return { kinds: kinds(pod), install: R ? { running: R.running, state: R.state, done: R.done, failed: R.failed } : null }; }
const SENT = {};   // pod -> Set of content names already on it (this run of the app)
/** a helper's job on the pod -> its JSON answer with this computer's paths (venv.runJson's contract) */
async function run(kind, job, opts) {
  const o = opts || {}, d = deps(), K = KINDS[kind], k = podFor(kind);
  if (!K || !k) throw new Error("no pod takes " + kind + " jobs");
  const log = (t) => { try { if (o.onLog) o.onLog(t); } catch { /* fine */ } };
  log(`[pod] ${K.label.toLowerCase()} on the pod ${k}`);
  const ins = await install(k, [kind], log);
  if (!(ins.done || []).includes(kind)) throw new Error(`${K.label} could not be set up on the pod ${k}` + (ins.why ? " - " + ins.why : ""));
  const w = await d.ready(k, d.portOf(k), log);
  if (!w || !w.comfy_dir) throw new Error("the pod's ComfyUI folder was not found - its results are fetched through ComfyUI");
  // the helpers (this computer's copy - the same code on both sides)
  const sdir = ROOT + "/scripts";
  SENT[k] = SENT[k] || new Set();
  for (const h of K.helpers) {   // sent again when this computer's copy changed (its contents' hash)
    const src = path.join(core().BASE, "scripts", h), key = "helper:" + h + ":" + crypto.createHash("sha1").update(fs.readFileSync(src)).digest("hex");
    if (!SENT[k].has(key)) { await d.put(w, src, sdir, h); SENT[k].add(key); }
  }
  // the inputs, named by their contents (a voice clip goes up once)
  const up = {};
  for (const f of filesOf(job)) {
    if (up[f.file] || !fs.existsSync(f.file)) continue;
    const h = crypto.createHash("sha1").update(fs.readFileSync(f.file)).digest("hex").slice(0, 16), nm = h + path.extname(f.file).toLowerCase(), at = ROOT + "/in/" + nm;
    if (!(SENT[k] = SENT[k] || new Set()).has(at)) { log("[pod] sending " + path.basename(f.file)); await d.put(w, f.file, ROOT + "/in", nm); SENT[k].add(at); }
    up[f.file] = at;
  }
  const id = Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), outDir = String(w.comfy_dir).replace(/\/+$/, "") + "/output/bitgen-audio/" + id;
  const pj = rewrite(job, up, outDir);
  const code = runCode({ id, job: pj, python: ROOT + "/venvs/" + K.venv + "/bin/python", helper: sdir + "/" + K.helper, dir: ROOT + "/jobs/" + id, out: outDir });
  const said = await d.kernel(w, require("./podJob").detach(code), code);
  const why = require("./podJob").failed(said); if (why) throw new Error("the job did not start on the pod: " + why);
  const t0 = Date.now(), max = +o.timeout_ms || 900000; let s = null, lastLine = null;
  for (;;) {
    await d.sleep(d.poll);
    s = await d.status(k, ".bitgen_aud_" + id + ".json").catch(() => null);
    if (!s && Date.now() - t0 > +(process.env.H3_POD_AUDIO_LOST || 300000)) throw new Error(`the pod's ${K.label.toLowerCase()} job could not be followed (no status from the pod for 5 minutes)`);
    if (s && Array.isArray(s.log) && s.log.length) { const L = s.log, i = lastLine === null ? -1 : L.lastIndexOf(lastLine); for (const l of L.slice(i + 1)) log(l); lastLine = L[L.length - 1]; }
    if (s && !s.running) break;
    if (Date.now() - t0 > max) throw new Error(`the pod's ${K.label.toLowerCase()} did not finish in ${Math.round(max / 60000)} minutes`);
  }
  if (s.error) throw new Error("on the pod: " + s.error);
  const m = mapBack(s.result || {}, job, outDir);
  for (const f of m.files) await d.get(w, f.pod, f.local);
  return m.answer;
}

module.exports = { KINDS, ROOT, kindsOf, pick, filesOf, rewrite, mapBack, installCode, runCode, podFor, wanted, kinds, setKinds, install, status, run, setDeps, INST, SENT };
