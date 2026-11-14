/* bitGen Studio — lib/podVram.js (2.781.2): HOW A POD'S COMFYUI USES ITS GPU MEMORY.
 *
 * Tim (verbatim, with a screenshot of an A40 pod - GPU 100%, VRAM 4.3 / 48.3 GB, the pod's RAM 54.8 GB used): "krea model
 * generates image, in about 1min 40sec after first run on the A40gpu ... I think comfy is not using vram thats why the renders
 * are so slow"
 *   A ComfyUI installed today (bitGen installs the latest on a new pod) runs "Dynamic VRAM" (comfy-aimdo) by default: model
 *   weights stay in the pod's RAM and are streamed onto the card as needed, and after a switch between workflows (Krea 2,
 *   then YuE2, then Krea 2 again) it can load the model again on every render. That suits a small card; a pod's card has room.
 *   The 4.3 GB on the screenshot is YuE2's own int8 model while it ran - that alone proves nothing; the render's log now says
 *   what ComfyUI did (scripts/comfy_client.py load_report: "loaded completely / partially", its own time).
 *
 *   MODES      rgpu.pod_vram: "gpu" (default) = the models kept on the card - ComfyUI started with --disable-dynamic-vram
 *              when its card has 24 GB or more AND that ComfyUI knows the flag (read from its comfy/cli_args.py - an unknown
 *              flag would stop ComfyUI starting); "dynamic" = ComfyUI's own default.
 *   PY         python lines for the pod's start code: comfy_extra(comfy_dir, mode) -> the extra arguments
 *   apply(id, port)   the RUNNING ComfyUI restarted with the arguments of the mode now (its own command otherwise kept) -
 *              {ok, same, args, why}; nothing restarted when it already runs that way
 * Pure (scripts/test-podvram7812.js): modeOf, PY. Server: routes/podVram.js. Page: the PODS docker's line (static/podfiles.js).
 */
"use strict";
const MODES = ["gpu", "dynamic"];
const MIN_GB = 24;
function core() { return require("./core"); }
/** (pure) the mode in a config */
function modeOf(cfg) { const m = String((((cfg || {}).rgpu) || {}).pod_vram || ""); return MODES.includes(m) ? m : "gpu"; }
function mode() { return modeOf(core().getConfig() || {}); }
function setMode(m) {
  if (!MODES.includes(m)) { const e = new Error("pick gpu or dynamic"); e.status = 400; throw e; }
  const c = core().getConfig(); c.rgpu = c.rgpu || {}; c.rgpu.pod_vram = m; core().setConfig(c); return m;
}
const PY = [
  "def _gpu_gb():",
  "    try:",
  "        import subprocess as _sp",
  "        o = _sp.run(['nvidia-smi', '--query-gpu=memory.total', '--format=csv,noheader,nounits'], stdout=_sp.PIPE, stderr=_sp.DEVNULL, text=True, timeout=20).stdout",
  "        v = [float(x) for x in o.split() if x.replace('.', '', 1).isdigit()]",
  "        return min(v) / 1024.0 if v else 0.0",
  "    except Exception: return 0.0",
  "def _knows(comfy_dir, flag):",
  "    try: return flag in open(os.path.join(comfy_dir, 'comfy', 'cli_args.py'), errors='replace').read()",
  "    except Exception: return False",
  "def comfy_extra(comfy_dir, mode):",
  "    if mode != 'gpu': return []",
  `    if _gpu_gb() < ${MIN_GB}: return []`,
  "    return ['--disable-dynamic-vram'] if _knows(comfy_dir, '--disable-dynamic-vram') else []",
];
const OURS = ["--disable-dynamic-vram"];
/** the kernel's code that restarts the running ComfyUI with the mode's arguments (prints bitgen-vram <json>) */
function applyCode(comfyDir, port, m) {
  const RP = require("./podComfyUpdate").RESTART_PY;
  return ["import json, os, signal, subprocess, time, urllib.request"].concat(RP, PY, [
    `C = ${JSON.stringify(String(comfyDir || ""))}; PORT = ${+port || 8188}; MODE = ${JSON.stringify(m)}`,
    "def out(o): print('bitgen-vram ' + json.dumps(o))",
    "p = _cp_proc(C, PORT)",
    "if not p: out({'ok': False, 'why': 'bitGen did not find ComfyUI running on the pod'})",
    "else:",
    "    pid, argv, cwd, env = p",
    "    d = os.path.dirname(os.path.realpath(os.path.join(cwd, next((a for a in argv if a.endswith('main.py')), 'main.py'))))",
    `    keep = [a for a in argv if a not in ${JSON.stringify(OURS)}]`,
    "    extra = comfy_extra(d, MODE); new = keep + extra",
    "    if new == argv: out({'ok': True, 'same': True, 'args': extra})",
    "    elif pid == 1: out({'ok': False, 'why': 'ComfyUI is the pod\\'s main process - restart the pod (PODS > My pods)'})",
    "    else:",
    "        try: os.kill(pid, signal.SIGTERM)",
    "        except Exception: pass",
    "        for i in range(40):",
    "            time.sleep(1)",
    "            if not os.path.exists('/proc/' + str(pid)): break",
    "        lg = open(os.path.join(os.getcwd(), '.bitgen_comfy.log'), 'ab')",
    "        subprocess.Popen(new, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=lg, stderr=subprocess.STDOUT, start_new_session=True)",
    "        out({'ok': True, 'same': False, 'args': extra})",
  ]).join("\n");
}
const APPLY = {};   // pod -> {running, note, ok, why, at}
/** the running ComfyUI restarted the mode's way (background) -> its state */
function apply(podId, port) {
  const id = String(podId || "").replace(/[^A-Za-z0-9]/g, "");
  if (APPLY[id] && APPLY[id].running) return APPLY[id];
  const R = APPLY[id] = { running: true, note: "asking the pod", at: Date.now(), mode: mode() };
  (async () => {
    try {
      const PM = require("./podModels"), w = await PM.ways(id, port);
      if (!w.jupyter) throw new Error("the pod's Jupyter does not answer - bitGen restarts ComfyUI through it");
      R.note = R.mode === "gpu" ? "restarting ComfyUI with the models kept on the card" : "restarting ComfyUI with its own Dynamic VRAM";
      const said = await PM.runKernel(w.jupyter_url, PM.jupyterOf(w.pod_id), applyCode(w.comfy_dir, w.comfy_port || port || 8188, R.mode));
      const m = /bitgen-vram (\{.*\})/.exec(said); const j = m ? JSON.parse(m[1]) : { ok: false, why: "the pod did not answer" };
      if (!j.ok) throw new Error(j.why || "it did not work");
      if (j.same) { R.note = "already running that way" + (j.args.length ? " (" + j.args.join(" ") + ")" : ""); R.ok = true; return; }
      R.note = "waiting for ComfyUI to answer again";
      const t0 = Date.now();
      for (;;) {
        await new Promise((ok) => setTimeout(ok, +(process.env.H3_POD_VRAM_POLL || 5000)));
        const a = await PM.alive(id, port).catch(() => ({}));
        if (a.comfy) break;
        if (Date.now() - t0 > +(process.env.H3_POD_VRAM_WAIT || 300000)) throw new Error("ComfyUI did not come back in 5 minutes (see .bitgen_comfy.log on the pod)");
      }
      R.ok = true; R.note = "ComfyUI restarted" + (j.args.length ? " with " + j.args.join(" ") : " with its own memory handling");
      try { require("./podActivity").note(id, R.note); } catch { /* fine */ }
    } catch (e) { R.ok = false; R.why = String((e && e.message) || e).slice(0, 300); R.note = "✗ " + R.why; }
    finally { R.running = false; }
  })();
  return R;
}
function state(podId) { return APPLY[String(podId || "").replace(/[^A-Za-z0-9]/g, "")] || null; }
module.exports = { MODES, MIN_GB, PY, OURS, modeOf, mode, setMode, applyCode, apply, state, APPLY };
