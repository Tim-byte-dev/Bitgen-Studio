/* bitGen Studio — lib/podWatchdog.js (2.781.0): A NEW POD THAT SHOWS NO SIGN OF LIFE FOR 5 MINUTES ON ITS FIRST START IS
 * TERMINATED AND MADE AGAIN THE SAME WAY.
 * Tim (verbatim, after a new pod's Jupyter never started a kernel): "seems the pod may have been faulty, check pod for activity,
 * if no activity after 5 minutes terminate the pod and start a new pod (this is only on first run for the pod, if the pod
 * successfully installs and runs then terminate only when user presses terminate button)"
 *   Only a pod bitGen made (rgpu.pod_made) that has not run yet: started by lib/podMade.js watch; it ends for good once the pod's
 *   ComfyUI answers (installed and running - rgpu.pod_made[id].proven_at) or the pod is set up (setup_at). From then on only the
 *   user's Terminate ends it.
 *   ACTIVITY = anything the pod itself does: its state on RunPod (PROVISIONING -> RUNNING, the container started), its Jupyter
 *   answering, the install / setup lines bitGen reads from it (lib/podActivity.js).
 *   bitGen's own "waiting for the pod" / "loading pod" lines are not, nor a line whose only change is a number (a clock). No change in LIMIT (5 min) -> the pod is replaced:
 *     1 said in the pod's activity line, 2 terminated on RunPod (charges end), 3 a new pod from its recipe (the same template,
 *     GPU, count, cloud, disks, port, CUDA), 4 everything moves to it: the styles linked to it and its kinds (lib/podRevive.js
 *     moveStyles), its audio kinds, its preset, the renders waiting for it (lib/podRetry.js move) - the new one is watched the
 *     same way. At most MAX_GEN replacements in a row (2): then it is said and left for you.
 *   start(id, port)  stop(id)  status(id) -> {phase: watching | replacing | replaced | stopped | proven | gave up, note, idle_s}
 * Pure (scripts/test-podwatchdog781.js): signOf, quiet, LIMIT.
 */
"use strict";
const LIMIT = () => +(process.env.H3_POD_DOG_MS || 5 * 60000);
const POLL = () => +(process.env.H3_POD_DOG_POLL || 30000);
const MAX_GEN = 2;
const DOGS = {};
const pid = (x) => String(x || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
/** bitGen's own waiting words - not the pod doing anything (pure) */
function quiet(text) { return /^(waiting for|loading pod|checking the pod|asking runpod)/i.test(String(text || "").trim()); }
/** what the pod shows now, as one string - a change = activity (pure).
 *  s = {status, runtime, jupyter, comfy, lines: [activity texts newest last]} */
function signOf(s) {
  const o = s || {};
  // numbers left out: a line whose only change is a clock ("… (3 min)") is not the pod doing anything; install lines change words
  const real = (o.lines || []).filter((t) => t && !quiet(t)).slice(-3).map((t) => String(t).replace(/\d+([.,]\d+)?/g, "#"));
  return [String(o.status || "").toUpperCase(), o.runtime ? "rt" : "", o.jupyter ? "ju" : "", o.comfy ? "cf" : "", real.join(" | ")].join("~");
}

let D = null;
function deps() {
  return D || {
    made: (id) => ((((require("./core").getConfig() || {}).rgpu) || {}).pod_made || {})[pid(id)] || null,
    mark: (id, f) => { const C = require("./core"), c = C.getConfig(), r = c.rgpu = c.rgpu || {}, k = pid(id); r.pod_made = Object.assign({}, r.pod_made || {}); if (r.pod_made[k]) r.pod_made[k] = Object.assign({}, r.pod_made[k], f); C.setConfig(c); },
    look: async (id, port) => {
      const out = { status: "", runtime: false, jupyter: false, comfy: false, lines: [] };
      try { const key = String((((require("./core").getConfig() || {}).rgpu || {}).runpod || {}).key || ""); const p = await require("./runpodApi").pod(id, key);
        out.status = String((p && (p.desiredStatus || p.status)) || ""); out.runtime = !!(p && (p.runtime || p.lastStartedAt || p.startedAt)); out.gone = !p || /TERMINATED/i.test(out.status); } catch (e) { if (e && e.status === 404) out.gone = true; }
      try { const a = await require("./podModels").alive(id, port); out.jupyter = a.jupyter; out.comfy = a.comfy; } catch { /* not answering */ }
      try { const v = require("./podActivity").view(id); if (v) out.lines = [...(v.done || [])].reverse().concat(v.now || []).map((t) => t.text); } catch { /* none */ }
      return out;
    },
    say: (id, t) => { try { require("./podActivity").note(id, t); } catch { /* fine */ } },
    replace: replaceDefault,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  };
}
function setDeps(d) { D = d ? Object.assign({}, deps(), d) : null; }

/** watch a pod bitGen just made until it shows it runs - or replace it */
function start(id, port) {
  // off with H3_POD_DOG=off; the test gate's own studio (H3_E2E, stand-in pods that never install) only when H3_POD_DOG_MS is set
  if (process.env.H3_POD_DOG === "off" || (process.env.H3_E2E && !process.env.H3_POD_DOG_MS)) return null;
  const k = pid(id), d = deps(), m = d.made(k);
  if (!k || !m || m.setup_at || m.proven_at || (DOGS[k] && DOGS[k].running)) return DOGS[k] || null;
  const W = DOGS[k] = { running: true, phase: "watching", note: "watching the new pod for signs of life", sig: "", last: d.now(), idle_s: 0 };
  W.promise = (async () => {
    try {
      for (;;) {
        const mm = d.made(k);
        if (!mm) { W.phase = "stopped"; W.note = "no longer a pod bitGen made"; return; }
        if (mm.setup_at || mm.proven_at) { W.phase = "proven"; W.note = "it runs - only your Terminate ends it"; return; }
        const s = await d.look(k, port).catch(() => ({}));
        if (s.gone) { W.phase = "stopped"; W.note = "the pod is gone on RunPod"; return; }
        if (s.comfy) { d.mark(k, { proven_at: d.now() }); W.phase = "proven"; W.note = "its ComfyUI runs - only your Terminate ends it now"; return; }
        const sig = signOf(s), now = d.now();
        if (sig !== W.sig) { W.sig = sig; W.last = now; }
        W.idle_s = Math.round((now - W.last) / 1000);
        if (now - W.last >= LIMIT()) {
          const gen = +mm.dog_gen || 0;
          if (gen >= MAX_GEN) {
            W.phase = "gave up";
            W.note = "no activity from the pod for " + Math.round(LIMIT() / 60000) + " minutes - it was made again " + gen + " times already, so it is left for you: terminate it in PODS ▸ My pods, or create one on another GPU";
            d.say(k, W.note); return;
          }
          W.phase = "replacing";
          W.note = "no activity from the pod for " + Math.round(LIMIT() / 60000) + " minutes on its first start - it looks faulty: terminating it and making a new one the same way";
          d.say(k, W.note);
          const r = await d.replace(k, port, gen + 1).catch((e) => ({ ok: false, why: String((e && e.message) || e) }));
          W.phase = r && r.ok ? "replaced" : "gave up";
          W.note = r && r.ok ? "replaced by the pod " + r.id + " (" + (r.name || "") + ")" : "it could not be made again: " + ((r && r.why) || "?");
          W.new_id = r && r.id;
          d.say(k, W.note);
          return;
        }
        await d.sleep(POLL());
      }
    } catch (e) { W.phase = "stopped"; W.note = String((e && e.message) || e).slice(0, 300); }
    finally { W.running = false; }
  })();
  return W;
}
/** terminate the quiet pod, make the new one from its recipe and move everything to it -> {ok, id, name, why} */
async function replaceDefault(old, port, gen) {
  const P = require("./pods"), PR = require("./podRevive"), C = require("./core");
  const rc = await PR.recipe(old);
  if (!rc) return { ok: false, why: "bitGen has no recipe for it" };
  let audio = []; try { audio = require("./podAudio").kinds(old); } catch { audio = []; }
  let presets = []; try { presets = require("./podPresets").all().filter((p) => p.pod_id === pid(old)); } catch { presets = []; }
  try { await P.act(old, "terminate"); } catch (e) { return { ok: false, why: "RunPod did not terminate it (" + String((e && e.message) || e) + ") - nothing new was made" }; }
  let made;
  try {
    made = await P.create({ templateId: rc.template_id, name: rc.name || "bitGen pod", gpu: rc.gpu, count: rc.count, cloud: rc.cloud, disk: rc.disk, volume: rc.volume,
      port: rc.port, cuda: rc.cuda || undefined, preset: presets.length ? presets[0].name : "watchdog", audio });
  } catch (e) {
    const why = String((e && e.problem && e.problem.title) || (e && e.message) || e);
    for (const h of require("./podRetry").held(old)) { const j = C.jobs.get(h.id); if (j) C.log(j, "[pod] the pod " + pid(old) + " showed no activity and was terminated; a new one could not be made: " + why + " - create one in PODS"); }
    return { ok: false, why };
  }
  const nid = made.pod.id, name = made.pod.name;
  try { PR.moveStyles(old, nid, name); } catch { /* the links stay to be fixed by hand */ }
  try { if (audio.length) require("./podAudio").setKinds(nid, audio); } catch { /* fine */ }
  try { const PP = require("./podPresets"); for (const p of presets) PP.write(Object.assign({}, p, { pod_id: nid })); } catch { /* fine */ }
  try { require("./podRetry").move(old, nid); } catch { /* the renders say why */ }
  try { const c = C.getConfig(), r = c.rgpu = c.rgpu || {}; r.pod_made = Object.assign({}, r.pod_made || {}); if (r.pod_made[pid(nid)]) r.pod_made[pid(nid)] = Object.assign({}, r.pod_made[pid(nid)], { dog_gen: gen, replaces: pid(old) }); delete r.pod_made[pid(old)]; C.setConfig(c); } catch { /* fine */ }
  try { require("./podActivity").note(nid, "made again in place of " + pid(old) + " (it showed no activity on its first start)"); } catch { /* fine */ }
  return { ok: true, id: nid, name };
}
function stop(id) { const W = DOGS[pid(id)]; if (W) W.stopped = true; }
function status(id) { const W = DOGS[pid(id)]; return W ? { phase: W.phase, note: W.note, idle_s: W.idle_s, new_id: W.new_id || "" } : null; }
module.exports = { LIMIT, MAX_GEN, signOf, quiet, start, stop, status, setDeps, replaceDefault, DOGS };
