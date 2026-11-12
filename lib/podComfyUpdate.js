/* bitGen Studio — lib/podComfyUpdate.js (2.766.3): A POD WHOSE COMFYUI IS TOO OLD FOR A STYLE IS UPDATED.
 *
 * Tim (verbatim, with the job log): "[pod] qwen2_1 cannot render on the pod yet - these files are not on it: … (this pod's
 * ComfyUI cannot run qwen2_1 yet - no node pack bitGen knows adds TextEncodeQwenImage21 …) but the files are already
 * transferred"
 *   TextEncodeQwenImage21 is not a node pack's - it is BUILT INTO a newer ComfyUI (lib/comfyCoreNodes.json "latest", not
 *   0.34.0): the pod's ComfyUI is older than the style's workflow.
 *
 *   coreMissing(classes)   the classes a newer ComfyUI has built in (pure)
 *   updateCode(comfy)      the pod's job (its own process - lib/podJob.js): git pull in its ComfyUI folder (on the branch it is
 *                          on; a detached checkout goes to master), pip install -r requirements.txt with the Python the running
 *                          ComfyUI uses, then ComfyUI restarted - the running main.py stopped and started again with the same
 *                          command, folder and environment (unless something brings it back by itself, or it is the
 *                          container's first process - then the pod needs a restart, said). Status: .bitgen_cupd.json
 *   update(w, say)         runs it, waits (20 min at most), then for ComfyUI to answer again (5 min) -> {ok, why, version}
 * Pure (scripts/test-podcomfyupd7663.js): coreMissing, updateCode.
 */
"use strict";
let LATEST = null;
function latestCore() {
  if (!LATEST) { try { const j = require("./comfyCoreNodes.json"); LATEST = new Set(((j.versions || {}).latest || {}).nodes || []); } catch { LATEST = new Set(); } }
  return LATEST;
}
/** (pure) the classes in `miss` that a newer ComfyUI has built in */
function coreMissing(miss) { const L = latestCore(); return [...new Set((miss || []).filter((c) => L.has(c)))]; }
function updateCode(comfy, port) {
  const job = { comfy: String(comfy || ""), port: +port || 8188 };
  return [
    "import json, os, subprocess, sys, threading, time, signal, urllib.request",
    `J = json.loads(${JSON.stringify(JSON.stringify(job))})`,
    "P = os.path.join(os.getcwd(), '.bitgen_cupd.json')",
    "S = {'running': True, 'state': 'waiting', 'log': ''}",
    "def save():",
    "    t = P + '.tmp'",
    "    open(t, 'w').write(json.dumps(S)); os.replace(t, P)",
    "def sh(cmd, cwd=None, env=None):",
    "    r = subprocess.run(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=1500)",
    "    S['log'] = (S['log'] + '\\n$ ' + ' '.join(cmd) + '\\n' + (r.stdout or ''))[-4000:]; save()",
    "    return r.returncode, r.stdout or ''",
    "def comfy_proc():",
    "    want = os.path.realpath(J['comfy'])",
    "    for pid in os.listdir('/proc'):",
    "        if not pid.isdigit(): continue",
    "        try:",
    "            argv = open('/proc/' + pid + '/cmdline', 'rb').read().split(b'\\0'); argv = [a.decode('utf-8', 'replace') for a in argv if a]",
    "            cwd = os.readlink('/proc/' + pid + '/cwd')",
    "        except Exception: continue",
    "        for a in argv:",
    "            if a.endswith('main.py') and os.path.realpath(os.path.join(cwd, a)) == os.path.join(want, 'main.py'):",
    "                env = {}",
    "                try:",
    "                    for kv in open('/proc/' + pid + '/environ', 'rb').read().split(b'\\0'):",
    "                        if b'=' in kv: k, v = kv.split(b'=', 1); env[k.decode('utf-8', 'replace')] = v.decode('utf-8', 'replace')",
    "                except Exception: env = dict(os.environ)",
    "                return int(pid), argv, cwd, env",
    "    return None",
    "def answers():",
    "    try:",
    "        with urllib.request.urlopen('http://127.0.0.1:' + str(J['port']) + '/system_stats', timeout=5) as r: return r.status == 200",
    "    except Exception: return False",
    "def run():",
    "    c = J['comfy']",
    "    if not os.path.isdir(os.path.join(c, '.git')):",
    "        S['state'] = 'failed: ' + c + ' is not a git checkout - update ComfyUI on the pod yourself (ComfyUI-Manager > Update ComfyUI)'; S['running'] = False; save(); return",
    "    S['state'] = 'updating ComfyUI (git pull)'; save()",
    "    rc, out = sh(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=c)",
    "    if out.strip() == 'HEAD': sh(['git', 'checkout', 'master'], cwd=c)",
    "    sh(['git', 'fetch', '--tags', 'origin'], cwd=c)",
    "    def ver():",
    "        try: return open(os.path.join(c, 'comfyui_version.py')).read().split('=')[-1].strip().strip('\"').strip(\"'\")",
    "        except Exception: return ''",
    "    S['from'] = ver()",
    "    rc, out = sh(['git', 'pull', '--ff-only'], cwd=c)",
    // 2.767.0 (Tim: "can we update to the latest version of comfyui on the pod?" - his pod stayed on 0.30.0): a pull that cannot
    // fast-forward (a pinned or edited checkout) is replaced by ComfyUI's own master; ComfyUI's own files only - models and
    // custom_nodes are not in its git
    "    if rc != 0:",
    "        S['state'] = 'updating ComfyUI (to its latest master)'; save()",
    "        sh(['git', 'fetch', 'origin', 'master'], cwd=c)",
    "        rc, out = sh(['git', 'checkout', '--force', '-B', 'master', 'origin/master'], cwd=c)",
    "    if rc != 0:",
    "        S['state'] = 'failed: git could not update it - ' + (out.strip().splitlines() or [''])[-1][:160]; S['running'] = False; save(); return",
    "    S['to'] = ver()",
    "    p = comfy_proc(); py = p[1][0] if p and os.path.basename(p[1][0]).startswith('python') else sys.executable",
    "    S['state'] = 'installing what the new ComfyUI needs (pip)'; save()",
    "    rc, out = sh([py, '-m', 'pip', 'install', '-r', os.path.join(c, 'requirements.txt')], cwd=c)",
    "    if rc != 0:",
    "        S['state'] = 'failed: pip install -r requirements.txt did not work - ' + (out.strip().splitlines() or [''])[-1][:160]; S['running'] = False; save(); return",
    "    if not p:",
    "        S['state'] = 'restart needed: ComfyUI is updated, but bitGen did not find its running process - restart the pod'; S['running'] = False; save(); return",
    "    pid, argv, cwd, env = p",
    "    if pid == 1:",
    "        S['state'] = 'restart needed: ComfyUI is updated - it is the pod\\'s main process, so restart the pod (PODS > My pods) to load it'; S['running'] = False; save(); return",
    "    S['state'] = 'restarting ComfyUI'; save()",
    "    try: os.kill(pid, signal.SIGTERM)",
    "    except Exception: pass",
    "    for i in range(30):",
    "        time.sleep(1)",
    "        if not os.path.exists('/proc/' + str(pid)): break",
    "    time.sleep(15)",
    "    if not answers():",
    "        lg = open(os.path.join(os.getcwd(), '.bitgen_comfy.log'), 'ab')",
    "        subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=lg, stderr=subprocess.STDOUT, start_new_session=True)",
    "    for i in range(300):",
    "        if answers(): break",
    "        time.sleep(1)",
    "    S['state'] = 'done' if answers() else 'failed: ComfyUI did not come back after the update (see .bitgen_comfy.log on the pod)'",
    "    S['running'] = False; save()",
    "save(); threading.Thread(target=run, daemon=True).start()",
    "print('bitgen-cupd-started')",
  ].join("\n");
}
/** 2.767.0: ComfyUI on the pod restarted (python lines for other pod jobs - lib/podLlm.js): restart_comfy(dir, port) ->
 *  'done' | why - the running main.py found in /proc, stopped, started again with its own command / folder / environment
 *  unless something brings it back by itself; the pod's first process is not stopped (the pod needs a restart) */
const RESTART_PY = [
  "def _cp_proc(comfy):",
  "    want = os.path.realpath(comfy)",
  "    for pid in os.listdir('/proc'):",
  "        if not pid.isdigit(): continue",
  "        try:",
  "            argv = [a.decode('utf-8', 'replace') for a in open('/proc/' + pid + '/cmdline', 'rb').read().split(b'\\0') if a]",
  "            cwd = os.readlink('/proc/' + pid + '/cwd')",
  "        except Exception: continue",
  "        for a in argv:",
  "            if a.endswith('main.py') and os.path.realpath(os.path.join(cwd, a)) == os.path.join(want, 'main.py'):",
  "                env = {}",
  "                try:",
  "                    for kv in open('/proc/' + pid + '/environ', 'rb').read().split(b'\\0'):",
  "                        if b'=' in kv: k, v = kv.split(b'=', 1); env[k.decode('utf-8', 'replace')] = v.decode('utf-8', 'replace')",
  "                except Exception: env = dict(os.environ)",
  "                return int(pid), argv, cwd, env",
  "    return None",
  "def _cp_up(port):",
  "    try:",
  "        with urllib.request.urlopen('http://127.0.0.1:' + str(port) + '/system_stats', timeout=5) as r: return r.status == 200",
  "    except Exception: return False",
  "def restart_comfy(comfy, port):",
  "    p = _cp_proc(comfy)",
  "    if not p: return 'restart needed: bitGen did not find ComfyUI\\'s running process - restart the pod'",
  "    pid, argv, cwd, env = p",
  "    if pid == 1: return 'restart needed: ComfyUI is the pod\\'s main process - restart the pod (PODS > My pods)'",
  "    try: os.kill(pid, signal.SIGTERM)",
  "    except Exception: pass",
  "    for i in range(30):",
  "        time.sleep(1)",
  "        if not os.path.exists('/proc/' + str(pid)): break",
  "    time.sleep(15)",
  "    if not _cp_up(port):",
  "        lg = open(os.path.join(os.getcwd(), '.bitgen_comfy.log'), 'ab')",
  "        subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=lg, stderr=subprocess.STDOUT, start_new_session=True)",
  "    for i in range(300):",
  "        if _cp_up(port): return 'done'",
  "        time.sleep(1)",
  "    return 'ComfyUI did not come back (see .bitgen_comfy.log on the pod)'",
];
const UPDATED = {};   // pod -> {at, ok, why, version} - 2.767.0: only a SUCCESS stops a second try within the hour
const RUNS = {};      // pod -> {running, note, ok, why, version, at} - PODS ▸ My pods ▸ ⬆ Update ComfyUI
/** ⬆ Update ComfyUI (PODS ▸ My pods): the pod's ComfyUI updated now, in the background -> its state */
function start(podId, port) {
  const id = String(podId || "").replace(/[^A-Za-z0-9]/g, "");
  if (RUNS[id] && RUNS[id].running) return RUNS[id];
  const R = RUNS[id] = { running: true, note: "asking the pod what it has", at: Date.now() };
  (async () => {
    try {
      const PM = require("./podModels");
      const w = await require("./podSend").whenUp(() => PM.ways(id, port), (why) => { R.note = "waiting for the pod - " + why; });
      R.from = w.comfy_version || "";
      const u = await update(w, port, (t) => { R.note = t; R.at = Date.now(); }, { force: true });
      Object.assign(R, { ok: !!u.ok, why: u.why || "", version: u.version || "", note: u.ok ? "ComfyUI on the pod is updated" + (u.version ? " to " + u.version : "") + (R.from ? " (was " + R.from + ")" : "") : "not updated: " + u.why });
    } catch (e) { Object.assign(R, { ok: false, why: String((e && e.message) || e), note: "not updated: " + String((e && e.message) || e) }); }
    R.running = false; R.at = Date.now();
  })();
  return R;
}
function state(podId) { return RUNS[String(podId || "").replace(/[^A-Za-z0-9]/g, "")] || null; }
async function update(w, port, say, deps) {
  const PM = require("./podModels"), PJ = require("./podJob");
  const D = Object.assign({ kernel: (ww, code) => PM.runKernel(ww.jupyter_url, PM.jupyterOf(ww.pod_id), code), read: (ww) => PM.readCwdJson(ww.pod_id, ".bitgen_cupd.json").catch(() => null),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)), at: (id, p) => PM.comfyAt(id, p) }, deps || {});
  const tell = (t) => { if (say) try { say(t); } catch { /* fine */ } };
  if (!w || !w.jupyter || !w.comfy_dir) return { ok: false, why: "bitGen updates ComfyUI through the pod's Jupyter - paste its password in ⬇ Models" };
  const last = UPDATED[w.pod_id], force = !!(deps && deps.force);
  if (!force && last && last.ok && Date.now() - last.at < 3600000) return { ok: false, why: "ComfyUI on this pod was updated" + (last.version ? " to " + last.version : "") + " less than an hour ago and still lacks it - restart the pod (PODS ▸ My pods) so the new ComfyUI is the one running" };
  const out = await update0(w, port, say, D, tell);
  UPDATED[w.pod_id] = { at: Date.now(), ok: !!out.ok, why: out.why || "", version: out.version || "" };
  return out;
}
async function update0(w, port, say, D, tell) {
  const PJ = require("./podJob");
  const said = await D.kernel(w, PJ.detach(updateCode(w.comfy_dir, w.comfy_port || port || 8188)));
  if (PJ.failed(said) || !/bitgen-cupd-started/.test(said)) return { ok: false, why: "the pod did not start the update" + (PJ.failed(said) ? ": " + PJ.failed(said) : "") };
  const mem = {}, POLL = +(process.env.H3_POD_REVIVE_POLL || 5000);
  let s = null;
  for (let i = 0; i < Math.ceil(1200000 / POLL); i++) {
    await D.sleep(POLL);
    s = PJ.track(mem, await D.read(w), Date.now());
    if (s && s.state) tell(s.state === "waiting" ? "updating ComfyUI on the pod" : s.state.replace(/^failed: /, "update failed: "));
    if (s && !s.running) break;
  }
  if (!s || s.running) return { ok: false, why: "the update did not finish in 20 minutes" };
  if (s.dead) return { ok: false, why: s.dead };
  if (s.state !== "done") return { ok: false, why: String(s.state).replace(/^failed: /, "") + (s.log ? " - the pod's log ends: " + String(s.log).trim().split("\n").slice(-2).join(" / ").slice(0, 200) : ""), restart: /^restart needed/.test(String(s.state)) };
  for (let i = 0; i < 60; i++) { const a = await D.at(w.pod_id, port).catch(() => ({ url: "" })); if (a.url) return { ok: true, version: String((((a.j || {}).system) || {}).comfyui_version || "") }; await D.sleep(POLL); }
  return { ok: false, why: "ComfyUI did not answer again after the update" };
}
module.exports = { latestCore, coreMissing, updateCode, update, start, state, UPDATED, RUNS, RESTART_PY };
