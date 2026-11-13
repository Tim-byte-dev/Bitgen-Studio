/* bitGen Studio — lib/podInstall.js (2.772.0): COMFYUI INSTALLED FROM SCRATCH ON A BLANK POD.
 *
 * Tim (verbatim): "is there an empty pod template that we can install our comfy ui on from scratch" + (asked which is better:
 * a blank pod with bitGen installing ComfyUI, kept for bitGen's own new pods) "lets do that"
 *   Why: RunPod's ready-made ComfyUI templates keep their own ComfyUI copy in their own state (too old for a style, listing no
 *   nodes, crashed - 2.766.3 … 2.770.1). On RunPod's official PyTorch template (Python + PyTorch + CUDA + Jupyter, nothing
 *   else) bitGen knows exactly what is there.
 *
 *   blankTemplate(list)   RunPod's PyTorch template in the template list (pure): runpod/pytorch images, not ComfyUI ones; CUDA
 *                         12.8 / 12.9 first (RTX 50-series and older run it; a CUDA 13 image needs a CUDA 13 host), the newest
 *                         PyTorch, an Official one first
 *   cudaOf(image)         "12.8" from runpod/pytorch:2.8.0-py3.11-cuda12.8.1 or …-cu1281-torch280-… (pure) - the pod is put
 *                         on a host whose driver runs it (lib/pods.js create: gpu.minCudaVersion)
 *   torchOf(image)        "2.8.0" (pure)
 *   installCode(o)        the pod's job (its own process - lib/podJob.js), status .bitgen_inst.json, each step said:
 *                           find      what the pod has: Python, PyTorch + CUDA, the GPU, free space, git (installed if missing)
 *                           download  ComfyUI from GitHub into /workspace/ComfyUI (kept while the pod is stopped)
 *                           venv      its own Python environment in ComfyUI/venv that REUSES the pod's PyTorch
 *                                     (--system-site-packages - no second multi-GB PyTorch download)
 *                           pip       what ComfyUI needs (requirements.txt) - once per ComfyUI version (.bitgen_pip_ok, the
 *                                     same mark lib/podComfyUpdate.js uses)
 *                           manager   ComfyUI-Manager in custom_nodes (restarts, its own installs)
 *                           start     ComfyUI started on its port (8188) with that Python, its log .bitgen_comfy.log
 *                           load      ComfyUI loading - until it answers (/system_stats)
 *                         Every step that is already done is skipped ("already there") - so after the pod restarts the
 *                         same job only starts ComfyUI again (a blank template does not start it by itself).
 *   ensure(id, port, say) bitGen's side: waits for the pod's Jupyter, runs the job, follows its steps (lib/podActivity.js -
 *                         the PODS docker shows each step), waits for ComfyUI to answer -> {ok, why, version, already}
 *                         One run per pod; a second caller waits for it. Only for pods bitGen made from a template that has no
 *                         ComfyUI (rgpu.pod_made[id].install - lib/pods.js create).
 * Pure (scripts/test-podinstall772.js, the job run for real with python3 against a stand-in ComfyUI repo): blankTemplate,
 * cudaOf, torchOf, installCode, stepsView.
 */
"use strict";
const COMFY_REPO = "https://github.com/comfyanonymous/ComfyUI";
const MANAGER_REPO = "https://github.com/Comfy-Org/ComfyUI-Manager";

function nums(s) { return String(s || "").split(".").map((x) => +x || 0); }
function cmpV(a, b) { const x = nums(a), y = nums(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; }
/** "12.8" from a runpod/pytorch image name (pure) - "" when it does not say */
function cudaOf(image) {
  const s = String(image || "");
  let m = /cuda[-_]?(\d{2})\.(\d)/i.exec(s); if (m) return m[1] + "." + m[2];
  m = /[-_:]cu(\d{2})(\d)\d?(?=[-_.]|$)/i.exec(s); if (m) return m[1] + "." + m[2];
  return "";
}
/** "2.8.0" from a runpod/pytorch image name (pure) */
function torchOf(image) {
  const s = String(image || "");
  let m = /torch[-_]?(\d)(\d)(\d)(?=[-_.]|$)/i.exec(s); if (m) return m[1] + "." + m[2] + "." + m[3];
  m = /:(\d+\.\d+\.\d+)-py/i.exec(s); if (m) return m[1];
  return "";
}
/** RunPod's PyTorch template to install ComfyUI on (pure) - null when the list has none */
function blankTemplate(list) {
  const fits = (list || []).filter((t) => t && !t.comfy && /^runpod\/pytorch:/i.test(String(t.image || "")) && torchOf(t.image));
  const cls = (t) => { const c = cudaOf(t.image); return !c ? 3 : cmpV(c, "12.8") >= 0 && cmpV(c, "13.0") < 0 ? 0 : cmpV(c, "13.0") >= 0 ? 1 : 2; };
  const src = (t) => { const i = ["official", "verified", "community"].indexOf(t.source); return i < 0 ? 3 : i; };
  return fits.slice().sort((a, b) => (cls(a) - cls(b)) || (src(a) - src(b)) || -cmpV(torchOf(a.image), torchOf(b.image)) || String(a.name).localeCompare(String(b.name)))[0] || null;
}
const STEPS = [
  ["find", "finding what the pod has"],
  ["download", "downloading ComfyUI"],
  ["venv", "making ComfyUI's Python environment"],
  ["pip", "installing what ComfyUI needs"],
  ["manager", "installing ComfyUI-Manager"],
  ["start", "starting ComfyUI"],
  ["load", "loading ComfyUI"],
];
/** the pod's job (pure) - o = {dir, port, repo, manager} */
function installCode(o) {
  const x = o || {};
  const job = { dir: String(x.dir || ""), port: +x.port || 8188, repo: String(x.repo || process.env.H3_POD_INSTALL_REPO || COMFY_REPO),
    manager: String(x.manager === undefined ? (process.env.H3_POD_INSTALL_MANAGER || MANAGER_REPO) : x.manager), load_s: +x.load_s || 900 };
  return [
    "import json, os, re, shutil, subprocess, sys, threading, time, urllib.request",
    `J = json.loads(${JSON.stringify(JSON.stringify(job))})`,
    "P = os.path.join(os.getcwd(), '.bitgen_inst.json')",
    "S = {'running': True, 'state': 'waiting', 'steps': [], 'log': ''}",
    "ESC = re.compile(r'\\x1b\\[[0-9;]*[A-Za-z]')",
    "def save():",
    "    t = P + '.tmp'",
    "    open(t, 'w').write(json.dumps(S)); os.replace(t, P)",
    "def st(key, label, state='running', note=''):",
    "    now = time.time()",
    "    for x in S['steps']:",
    "        if x['key'] == key:",
    "            x['label'] = label; x['state'] = state; x['note'] = note",
    "            if state != 'running': x['t1'] = now",
    "            break",
    "    else:",
    "        S['steps'].append({'key': key, 'label': label, 'state': state, 'note': note, 't0': now, 't1': 0 if state == 'running' else now})",
    "    S['state'] = label + (' - ' + note if note else ''); save()",
    "def nt(key, note):",
    "    for x in S['steps']:",
    "        if x['key'] == key: x['note'] = note[:160]",
    "    S['state'] = [x['label'] for x in S['steps'] if x['key'] == key][0] + ' - ' + note[:160]; save()",
    "def fail(key, label, why):",
    "    st(key, label, 'failed', why[:300]); S['state'] = 'failed: ' + label + ' - ' + why[:300]; S['running'] = False; save()",
    // a command whose output is read as it comes (git's progress uses \r) - each line to `on`
    "def stream(cmd, cwd=None, env=None, on=None, limit=3600):",
    "    S['log'] = (S['log'] + '\\n$ ' + ' '.join(cmd))[-4000:]",
    "    try: p = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)",
    "    except Exception as e: S['log'] += '\\n' + str(e); return 127, [str(e)]",
    "    buf = b''; lines = []; t0 = time.time(); last = 0",
    "    while True:",
    "        ch = p.stdout.read1(4096) if hasattr(p.stdout, 'read1') else p.stdout.read(4096)",
    "        if not ch: break",
    "        buf += ch; parts = re.split(rb'[\\r\\n]', buf); buf = parts.pop()",
    "        for ln in parts:",
    "            l = ESC.sub('', ln.decode('utf-8', 'replace')).strip()",
    "            if not l or '[notice]' in l: continue",
    "            lines.append(l); del lines[:-200]",
    "            if on and time.time() - last > 0.7:",
    "                last = time.time()",
    "                try: on(l)",
    "                except Exception: pass",
    "        if time.time() - t0 > limit: p.kill(); lines.append('stopped after ' + str(limit) + ' s'); break",
    "    rc = p.wait()",
    "    S['log'] = (S['log'] + '\\n' + '\\n'.join(lines[-12:]))[-4000:]; save()",
    "    return rc, lines",
    // git / pip say the reason on a fatal: / error: line - the lines after it are advice
    "def last_of(lines):",
    "    l = [x for x in (lines or []) if x.lower().startswith(('fatal:', 'error:'))]",
    "    return (l or lines or [''])[-1][:200]",
    "def answers():",
    "    try:",
    "        with urllib.request.urlopen('http://127.0.0.1:' + str(J['port']) + '/system_stats', timeout=5) as r: return r.status == 200 and 'system' in json.loads(r.read() or b'{}')",
    "    except Exception: return False",
    "def ver(d):",
    "    try: return open(os.path.join(d, 'comfyui_version.py')).read().split('=')[-1].strip().strip('\"').strip(\"'\")",
    "    except Exception: return ''",
    "def head(d):",
    "    try: return subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=d, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=60).stdout.strip()",
    "    except Exception: return ''",
    "def gb(n): return str(round(n / 1e9, 1)) + ' GB'",
    "def run():",
    "    try: run0()",
    "    except Exception as e:",
    "        S['state'] = 'failed: ' + str(S.get('state') or 'the install') + ' stopped - ' + type(e).__name__ + ': ' + str(e)[:200]; S['running'] = False; save()",
    "def run0():",
    "    d = J['dir'] or ('/workspace/ComfyUI' if os.path.isdir('/workspace') else os.path.join(os.path.expanduser('~'), 'ComfyUI'))",
    "    S['comfy'] = d; py = sys.executable",
    // ---- find
    "    st('find', 'finding what the pod has')",
    "    bits = ['Python ' + sys.version.split()[0]]",
    "    try:",
    "        r = subprocess.run([py, '-c', 'import torch, json; print(json.dumps([torch.__version__, torch.version.cuda]))'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=180)",
    "        tv = json.loads((r.stdout or '').strip().splitlines()[-1]); S['torch'] = tv[0]; S['cuda'] = tv[1] or ''",
    "        bits.append('PyTorch ' + tv[0] + (' (CUDA ' + str(tv[1]) + ')' if tv[1] else ''))",
    "    except Exception: S['torch'] = ''; bits.append('no PyTorch - ComfyUI installs it (a few GB)')",
    "    try:",
    "        r = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=30)",
    "        g = [l.strip() for l in (r.stdout or '').splitlines() if l.strip()]",
    "        if g: S['gpu'] = g[0]; bits.append(g[0] + (' x' + str(len(g)) if len(g) > 1 else ''))",
    "    except Exception: pass",
    "    try:",
    "        root = os.path.dirname(d) if os.path.isdir(os.path.dirname(d)) else os.getcwd()",
    "        S['free'] = shutil.disk_usage(root).free; bits.append(gb(S['free']) + ' free')",
    "    except Exception: pass",
    "    if os.path.isfile(os.path.join(d, 'main.py')): bits.append('ComfyUI is already in ' + d)",
    "    st('find', 'finding what the pod has', 'running', ' · '.join(bits))",
    "    if not shutil.which('git'):",
    "        nt('find', 'git is not on the pod - installing it')",
    "        if shutil.which('apt-get'):",
    "            stream(['apt-get', 'update', '-qq'], limit=600); stream(['apt-get', 'install', '-y', '-qq', 'git'], limit=900)",
    "        if not shutil.which('git'): return fail('find', 'finding what the pod has', 'git is not on the pod and could not be installed')",
    "    st('find', 'found what the pod has', 'done', ' · '.join(bits))",
    // ---- download
    "    if os.path.isfile(os.path.join(d, 'main.py')):",
    "        st('download', 'downloading ComfyUI', 'skipped', 'already there' + (' (' + ver(d) + ')' if ver(d) else ''))",
    "    else:",
    "        st('download', 'downloading ComfyUI', 'running', 'from ' + J['repo'])",
    "        if os.path.isdir(d) and not os.listdir(d): os.rmdir(d)",
    "        def on_git(l):",
    "            if l.startswith('Receiving objects') or l.startswith('Resolving deltas') or l.startswith('Updating files'): nt('download', l.split(':', 1)[0].lower() + ' ' + l.split(':', 1)[-1].strip())",
    "        rc, out = stream(['git', 'clone', '--depth', '1', '--progress', J['repo'], d], on=on_git, limit=1800)",
    "        if rc != 0 or not os.path.isfile(os.path.join(d, 'main.py')): return fail('download', 'downloading ComfyUI', 'git clone did not work - ' + last_of(out))",
    "        st('download', 'downloaded ComfyUI', 'done', ver(d) or 'its latest')",
    // ---- venv
    "    vd = os.path.join(d, 'venv'); vpy = os.path.join(vd, 'bin', 'python')",
    "    if os.path.exists(vpy):",
    "        st('venv', \"making ComfyUI's Python environment\", 'skipped', 'already there')",
    "    else:",
    "        st('venv', \"making ComfyUI's Python environment\", 'running', \"it reuses the pod's PyTorch\" if S.get('torch') else '')",
    "        rc, out = stream([py, '-m', 'venv', '--system-site-packages', vd], limit=600)",
    "        if rc != 0 or not os.path.exists(vpy):",
    "            nt('venv', 'the venv module is missing - trying virtualenv')",
    "            shutil.rmtree(vd, ignore_errors=True)",
    "            stream([py, '-m', 'pip', 'install', '-q', 'virtualenv'], limit=600)",
    "            rc, out = stream([py, '-m', 'virtualenv', '--system-site-packages', vd], limit=600)",
    "        if not os.path.exists(vpy): return fail('venv', \"making ComfyUI's Python environment\", 'no Python environment could be made - ' + last_of(out))",
    "        st('venv', \"made ComfyUI's Python environment\", 'done', \"it reuses the pod's PyTorch\" if S.get('torch') else '')",
    "    S['python'] = vpy",
    // ---- pip
    "    h = head(d); okf = os.path.join(d, '.bitgen_pip_ok')",
    "    try: pipped = open(okf).read().strip()",
    "    except Exception: pipped = ''",
    "    if h and pipped == h:",
    "        st('pip', 'installing what ComfyUI needs', 'skipped', 'already installed')",
    "    else:",
    "        st('pip', 'installing what ComfyUI needs', 'running', 'requirements.txt')",
    "        n = {'c': 0, 'have': 0}",
    "        def on_pip(l):",
    "            if l.startswith('Collecting '): n['c'] += 1; nt('pip', 'collecting ' + l[11:].split()[0] + ' (' + str(n['c']) + ')')",
    "            elif l.startswith('Downloading '): nt('pip', 'downloading ' + l[12:].split('/')[-1][:90])",
    "            elif l.startswith('Requirement already satisfied'): n['have'] += 1",
    "            elif l.startswith('Installing collected packages'): nt('pip', 'installing ' + str(len(l.split(':', 1)[-1].split(','))) + ' packages')",
    "            elif l.startswith('Building wheel'): nt('pip', l[:120].lower())",
    "        rc, out = stream([vpy, '-m', 'pip', 'install', '--progress-bar', 'off', '-r', os.path.join(d, 'requirements.txt')], cwd=d, on=on_pip, limit=3000)",
    "        if rc != 0 and any('No module named pip' in l for l in out):",
    "            stream([vpy, '-m', 'ensurepip', '--upgrade'], limit=600)",
    "            rc, out = stream([vpy, '-m', 'pip', 'install', '--progress-bar', 'off', '-r', os.path.join(d, 'requirements.txt')], cwd=d, on=on_pip, limit=3000)",
    "        if rc != 0: return fail('pip', 'installing what ComfyUI needs', 'pip install -r requirements.txt did not work - ' + last_of(out))",
    "        try: open(okf, 'w').write(h)",
    "        except Exception: pass",
    "        got = [l for l in out if l.startswith('Successfully installed')]",
    "        st('pip', 'installed what ComfyUI needs', 'done', (str(len(got[-1].split()) - 2) + ' packages added' if got else 'nothing new') + (', ' + str(n['have']) + ' already there' if n['have'] else ''))",
    // ---- manager (not needed to render - a failure is said and the install goes on)
    "    md = os.path.join(d, 'custom_nodes', 'ComfyUI-Manager')",
    "    if not J['manager']: st('manager', 'installing ComfyUI-Manager', 'skipped', 'not wanted')",
    "    elif os.path.isdir(md): st('manager', 'installing ComfyUI-Manager', 'skipped', 'already there')",
    "    else:",
    "        st('manager', 'installing ComfyUI-Manager', 'running', 'downloading it')",
    "        os.makedirs(os.path.dirname(md), exist_ok=True)",
    "        rc, out = stream(['git', 'clone', '--depth', '1', J['manager'], md], limit=900)",
    "        if rc != 0: st('manager', 'installing ComfyUI-Manager', 'failed', 'git clone did not work - ' + last_of(out) + ' (ComfyUI works without it)')",
    "        else:",
    "            rq = os.path.join(md, 'requirements.txt')",
    "            if os.path.isfile(rq):",
    "                nt('manager', 'installing its requirements')",
    "                rc, out = stream([vpy, '-m', 'pip', 'install', '--progress-bar', 'off', '-r', rq], cwd=md, limit=1200)",
    "            st('manager', 'installed ComfyUI-Manager', 'done' if rc == 0 else 'failed', '' if rc == 0 else 'its requirements did not install - ' + last_of(out))",
    // ---- start + load
    "    try: open(os.path.join(d, '.bitgen_install.json'), 'w').write(json.dumps({'by': 'bitGen', 'version': ver(d), 'at': time.time(), 'python': vpy}))",
    "    except Exception: pass",
    "    if answers():",
    "        st('start', 'starting ComfyUI', 'skipped', 'already running'); st('load', 'loading ComfyUI', 'skipped', 'it answers')",
    "    else:",
    "        st('start', 'starting ComfyUI', 'running', 'port ' + str(J['port']))",
    "        lgp = os.path.join(os.getcwd(), '.bitgen_comfy.log'); lg = open(lgp, 'ab'); off = lg.tell()",
    "        pr = subprocess.Popen([vpy, 'main.py', '--listen', '0.0.0.0', '--port', str(J['port'])], cwd=d, env=dict(os.environ), stdin=subprocess.DEVNULL, stdout=lg, stderr=subprocess.STDOUT, start_new_session=True)",
    "        S['comfy_pid'] = pr.pid",
    "        st('start', 'started ComfyUI', 'done', 'port ' + str(J['port']))",
    "        st('load', 'loading ComfyUI', 'running', 'its nodes and custom nodes')",
    "        t0 = time.time(); seen = ''",
    "        while time.time() - t0 < J['load_s']:",
    "            if answers(): break",
    "            if pr.poll() is not None: break",
    "            try:",
    // this start's own lines only (the log is kept across starts)
    "                f = open(lgp, errors='replace'); f.seek(off); tail = [l.strip() for l in f.read().splitlines()[-30:] if l.strip()]; f.close()",
    "                if tail and tail[-1] != seen: seen = tail[-1]; nt('load', seen[:150])",
    "            except Exception: pass",
    "            time.sleep(1)",
    "        if not answers():",
    "            try: f = open(lgp, errors='replace'); f.seek(off); tail = [l for l in f.read().splitlines() if l.strip()][-4:]; f.close()",
    "            except Exception: tail = []",
    "            why = ('it stopped' if pr.poll() is not None else 'it did not answer in ' + str(J['load_s']) + ' s') + (' - its log ends: ' + ' / '.join(tail)[-300:] if tail else '')",
    "            return fail('load', 'loading ComfyUI', why)",
    "        st('load', 'ComfyUI loaded', 'done', 'in ' + str(int(time.time() - t0)) + ' s')",
    "    S['version'] = ver(d); S['state'] = 'done'; S['running'] = False; save()",
    "save(); threading.Thread(target=run, daemon=True).start()",
    "print('bitgen-inst-started')",
  ].join("\n");
}
/** the job's steps as bitGen shows them (pure) -> [{key, text, state, secs}] */
function stepsView(s, now) {
  const t = now === undefined ? Date.now() / 1000 : +now / 1000;
  return ((s && s.steps) || []).map((x) => ({ key: String(x.key), text: String(x.label || "") + (x.note ? " - " + x.note : ""), state: String(x.state || "running"),
    secs: Math.max(0, Math.round(((+x.t1 || t) - (+x.t0 || t)))) }));
}

/* ---------------- live */
function core() { return require("./core"); }
const pid = (x) => String(x || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
function madeOf(id) { return ((((core().getConfig() || {}).rgpu) || {}).pod_made || {})[pid(id)] || null; }
/** is this a pod bitGen installs ComfyUI on? (made by bitGen from a template without ComfyUI) */
function installable(id) { const m = madeOf(id); return !!(m && m.install); }
function mark(id, fields) {
  const C = core(), c = C.getConfig(), r = c.rgpu = c.rgpu || {}, k = pid(id);
  if (!(r.pod_made || {})[k]) return;
  r.pod_made = Object.assign({}, r.pod_made); r.pod_made[k] = Object.assign({}, r.pod_made[k], fields); C.setConfig(c);
}
const RUNS = {};   // pod -> {running, note, steps, ok, why, version, at, promise}
function status(id) { const R = RUNS[pid(id)]; return R ? { running: R.running, note: R.note, steps: R.steps, ok: R.ok, why: R.why, version: R.version, at: R.at } : null; }
function defaults() {
  const PM = require("./podModels");
  return {
    ways: (id, port) => PM.ways(id, port),
    kernel: (w, code) => PM.runKernel(w.jupyter_url, PM.jupyterOf(w.pod_id), code),
    read: (w) => PM.readCwdJson(w.pod_id, ".bitgen_inst.json").catch(() => null),
    at: (id, port) => PM.comfyAt(id, port),
    mark, sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    record: (o) => { try { require("./genStats").recordPrep(o); } catch { /* never block */ } },
  };
}
/** ComfyUI on the pod - installed (or started) when it is not there; one run per pod -> {ok, why, version, already} */
async function ensure(id, port, say, deps) {
  const k = pid(id);
  if (RUNS[k] && RUNS[k].running && RUNS[k].promise) {
    let last = "";
    const R0 = RUNS[k], D0 = Object.assign(defaults(), deps || {});
    while (R0.running) { if (say && R0.note !== last) { last = R0.note; try { say(R0.note); } catch { /* fine */ } } await D0.sleep(+(process.env.H3_POD_INSTALL_POLL || 3000) > 1000 ? 1000 : 20); }
    return R0.result || { ok: !!R0.ok, why: R0.why || "", version: R0.version || "" };
  }
  const R = RUNS[k] = { running: true, note: "checking the pod", steps: [], at: Date.now() };
  R.promise = run(k, +port || 8188, say, Object.assign(defaults(), deps || {}), R);
  try { R.result = await R.promise; return R.result; }
  catch (e) { R.result = { ok: false, why: String((e && e.message) || e) }; return R.result; }
  finally { R.running = false; R.at = Date.now(); Object.assign(R, { ok: !!(R.result || {}).ok, why: (R.result || {}).why || "", version: (R.result || {}).version || "" }); }
}
async function run(k, port, say, D, R) {
  const PA = require("./podActivity"), PJ = require("./podJob");
  const POLL = +(process.env.H3_POD_INSTALL_POLL || 3000), t0 = Date.now();
  const tell = (t) => { R.note = t; R.at = Date.now(); if (say) try { say(t); } catch { /* fine */ } };
  // 1 the pod's Jupyter (bitGen installs through it) - or ComfyUI already answering
  let w = null;
  for (let i = 0; ; i++) {
    let why = "";
    try { w = await D.ways(k, port); } catch (e) { if (e && (e.code === "not_answering" || e.status === 409) && e.code !== "stopped") { w = null; why = String(e.message || e); } else throw e; }
    if (w && w.comfy_answers) { if (i) PA.step(k, "jupyter", "the pod answers", "done"); return { ok: true, already: true, version: w.comfy_version || "" }; }
    if (w && w.jupyter) { if (i) PA.step(k, "jupyter", "the pod's Jupyter answers", "done"); break; }
    if (w && !w.jupyter_saved) return { ok: false, why: "bitGen installs ComfyUI through the pod's Jupyter, and has no password for it - paste the one RunPod shows under the pod's Connect button (⬇ Models)" };
    if (Date.now() - t0 > +(process.env.H3_POD_INSTALL_WAIT || 20 * 60000)) return { ok: false, why: "the pod's Jupyter did not answer in 20 minutes" + (why ? " (" + why + ")" : "") };
    const t = "waiting for the pod's Jupyter (bitGen installs ComfyUI through it)";
    PA.step(k, "jupyter", t, "running"); tell(t);
    await D.sleep(POLL);
  }
  // 2 the job
  tell("installing ComfyUI on the pod");
  const said = await D.kernel(w, PJ.detach(module.exports.installCode({ port, dir: (madeOf(k) || {}).comfy_dir_want || "" })));
  if (PJ.failed(said) || !/bitgen-inst-started/.test(said)) {
    const why = "the pod did not start the ComfyUI install" + (PJ.failed(said) ? ": " + PJ.failed(said) : "");
    PA.finish(k, false, why); return { ok: false, why };
  }
  const mem = {}, seen = {};
  let s = null;
  for (let i = 0; i < Math.ceil(+(process.env.H3_POD_INSTALL_MAX || 90 * 60000) / POLL); i++) {
    await D.sleep(POLL);
    s = PJ.track(mem, await D.read(w), Date.now());
    if (!s) continue;
    R.steps = stepsView(s);
    for (const x of R.steps) { const sig = x.state + "|" + x.text; if (seen[x.key] !== sig) { seen[x.key] = sig; PA.step(k, "inst:" + x.key, x.text, x.state); } }
    if (s.state) tell(String(s.state).replace(/^failed: /, "install failed: "));
    if (!s.running) break;
  }
  const done = { ms: Date.now() - t0 };
  const record = (problems) => D.record({ pod: k, kind: "install", at: t0, end: Date.now(), phases: phasesOf(s), styles: [], problems: problems || [] });
  if (!s || s.running) { const why = "the ComfyUI install did not finish in " + Math.round(+(process.env.H3_POD_INSTALL_MAX || 90 * 60000) / 60000) + " minutes"; PA.finish(k, false, why); record([why]); return { ok: false, why }; }
  if (s.dead) { PA.finish(k, false, s.dead); record([s.dead]); return { ok: false, why: s.dead }; }
  if (s.state !== "done") {
    const why = (/^failed/.test(String(s.state)) ? String(s.state).replace(/^failed: /, "") : "the install stopped while " + s.state) + (s.log && !/its log ends/.test(String(s.state)) ? " - the pod's log ends: " + String(s.log).trim().split("\n").slice(-2).join(" / ").slice(0, 240) : "");
    PA.finish(k, false, "ComfyUI was not installed: " + why); record([why]); return { ok: false, why };
  }
  // 3 ComfyUI answering through RunPod's proxy
  let ver = String(s.version || "");
  for (let i = 0; i < 40; i++) {
    const a = await D.at(k, port).catch(() => ({ url: "" }));
    if (a && a.url) { ver = String((((a.j || {}).system) || {}).comfyui_version || "") || ver; break; }
    if (i === 39) { const why = "ComfyUI runs on the pod but does not answer through RunPod's proxy on port " + port + " - is the port open (8188/http)?"; PA.finish(k, false, why); record([why]); return { ok: false, why }; }
    if (i === 0) tell("waiting for ComfyUI to answer through RunPod's proxy");
    await D.sleep(POLL);
  }
  // installed now = the latest ComfyUI: no update after it (lib/podComfyUpdate.js auto)
  try { D.mark(k, { comfy_ok: true, installed_at: Date.now(), comfy_dir: s.comfy || "", comfy_version: ver }); } catch { /* fine */ }
  const fresh = (s.steps || []).some((x) => x.key === "download" && x.state === "done");
  const words = fresh ? "ComfyUI " + (ver ? ver + " " : "") + "installed and running" + (s.torch ? " (PyTorch " + s.torch + ")" : "") : "ComfyUI " + (ver ? ver + " " : "") + "started";
  PA.finish(k, true, words);
  record([]);
  void done;
  return { ok: true, version: ver, fresh, steps: R.steps };
}
/** the job's steps -> statistics phases (pure): install (finding … ComfyUI-Manager), start (starting + loading) */
function phasesOf(s) {
  const out = {};
  for (const x of (s && s.steps) || []) {
    const ms = Math.max(0, Math.round(((+x.t1 || 0) - (+x.t0 || 0)) * 1000)); if (!ms) continue;
    const ph = x.key === "start" || x.key === "load" ? "start" : "install";
    out[ph] = (out[ph] || 0) + ms;
  }
  return out;
}
module.exports = { COMFY_REPO, MANAGER_REPO, STEPS, cudaOf, torchOf, blankTemplate, installCode, stepsView, phasesOf, installable, ensure, status, RUNS };
