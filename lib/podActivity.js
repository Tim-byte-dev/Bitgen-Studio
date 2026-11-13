/* bitGen Studio — lib/podActivity.js (2.772.0): WHAT A POD IS DOING NOW, AND WHAT IT HAS DONE.
 *
 * Tim (verbatim): "in the pod that is installing and being used show what is being done, then hide the completed tasks in a
 * dropdown so the pods details don't get too big. say what it is doing, downloading, loading, finding etc"
 *   One list of tasks per pod, in the order they happen. Whatever works on a pod says what it is doing (lib/podInstall.js -
 *   ComfyUI installed on a blank pod, lib/podMade.js - a new pod set up, lib/podComfyUpdate.js - ComfyUI updated,
 *   lib/podPrep.js - styles made ready, lib/stylePods.js / lib/podRevive.js - a render waiting for its pod):
 *     note(pod, text)        a new thing being done - the task before it is done; the same thing again (only its numbers
 *                            changed: "downloading x - 45%" -> "- 46%") updates it in place
 *     step(pod, key, text, state)   a task with a fixed key (the installer's steps) - running / done / skipped / failed
 *     finish(pod, ok, text)  the end of a run: nothing is running any more; the result is the last line (✓ / ✗)
 *     view(pod)              {now: [running], done: [finished, newest first], last, at} - the PODS docker shows `now` on the
 *                            pod (its verb - Downloading, Installing, Loading, Finding …) and `done` in a dropdown
 *   verbOf(text)             the verb + icon a task is shown with (pure)
 * In memory (the tasks of this session); at most 60 per pod. Pure parts tested in scripts/test-podactivity772.js.
 */
"use strict";

// the first word(s) of what is said -> how it is shown. Anchored at the start first, then anywhere.
const START = [
  [/^(downloading|downloaded|fetching|cloning)\b/i, "Downloading", "⬇"],
  [/^(installing|installed|adding)\b/i, "Installing", "📦"],
  [/^(sending|uploading|putting)\b/i, "Sending", "⇪"],
  [/^(looking for|finding|found|searching|asking)\b/i, "Finding", "🔍"],
  [/^restarting\b/i, "Restarting", "🔄"],
  [/^(loading|loaded|waiting for (its|the pod's) comfyui|comfyui starting)\b/i, "Loading", "⏳"],
  [/^(starting|started)\b/i, "Starting", "▶"],
  [/^(updating|update)\b/i, "Updating", "⬆"],
  [/^repairing\b/i, "Repairing", "🛠"],
  [/^(linking|linked)\b/i, "Linking", "🔗"],
  [/^checking\b/i, "Checking", "🔎"],
  [/^(making|preparing)\b.*\bready\b/i, "Preparing", "🧩"],
  [/^(making|made|creating)\b/i, "Creating", "✨"],
  [/^waiting\b/i, "Waiting", "⏸"],
];
const ANY = [
  [/\bdownload/i, "Downloading", "⬇"],
  [/\b(pip|install)/i, "Installing", "📦"],
  [/\b(loading|loaded)\b/i, "Loading", "⏳"],
  [/\bupdat/i, "Updating", "⬆"],
];
/** {verb, icon, rest} - rest = the text without its leading verb word when the verb says it already (pure) */
function verbOf(text) {
  const t = String(text || "").trim();
  for (const [re, verb, icon] of START) {
    const m = re.exec(t);
    if (m) {
      const first = m[0].split(/\s+/)[0];
      const drop = first && verb.toLowerCase().startsWith(first.toLowerCase().slice(0, 5));
      return { verb, icon, rest: drop ? t.slice(first.length).replace(/^[\s:-]+/, "") : t };
    }
  }
  for (const [re, verb, icon] of ANY) if (re.test(t)) return { verb, icon, rest: t };
  return { verb: "Working", icon: "⚙", rest: t };
}
/** the same task whatever its numbers say now (pure): "downloading a.safetensors - 45% (3 min)" ~ "… - 46% (2 min)" */
function keyOf(text) {
  return String(text || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/(^|[\s/-])\d+([.,]\d+)?\s*(%|s|ms|min|h|gb|mb|kb|b\/s|mb\/s|mib\/s|of)?(?=[\s,)/]|$)/g, "$1#").replace(/[\s#.,:-]+/g, " ").trim().slice(0, 120);
}
const MAX = 60;
const LOG = {};
const ENDS = [];   // 2.774.0: (pod, ok, text) when a run on a pod ends (lib/podRetry.js)
function onFinish(fn) { if (typeof fn === "function" && !ENDS.includes(fn)) ENDS.push(fn); }   // pod -> {tasks: [{key, verb, icon, text, state, t0, t1, at}], at, last}
const pid = (x) => String(x || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
function logOf(pod) { const k = pid(pod); return k ? (LOG[k] = LOG[k] || { tasks: [], at: 0, last: null }) : null; }
function trim(L) { while (L.tasks.length > MAX) { const i = L.tasks.findIndex((t) => t.state !== "running"); L.tasks.splice(i < 0 ? 0 : i, 1); } }
function close(t, state, now) { t.state = state || "done"; t.t1 = now; }
/** a new thing being done on the pod (or the same one, further on) */
function note(pod, text, now) {
  const L = logOf(pod), t = String(text || "").trim(), at = now === undefined ? Date.now() : +now;
  if (!L || !t) return null;
  const key = keyOf(t);
  const cur = L.tasks.filter((x) => x.state === "running" && !x.fixed).pop();
  L.at = at; L.last = null;
  if (cur && cur.key === key) { cur.text = t; cur.at = at; Object.assign(cur, shown(t)); return cur; }
  if (cur) close(cur, "done", at);
  const n = Object.assign({ key, text: t, state: "running", t0: at, t1: 0, at }, shown(t));
  L.tasks.push(n); trim(L);
  return n;
}
function shown(t) { const v = verbOf(t); return { verb: v.verb, icon: v.icon, rest: v.rest }; }
/** a task with its own key (an installer step): running / done / skipped / failed */
function step(pod, key, text, state, now) {
  const L = logOf(pod), at = now === undefined ? Date.now() : +now;
  if (!L) return null;
  const k = "step:" + String(key || ""), st = ["running", "done", "skipped", "failed"].includes(state) ? state : "running";
  let t = L.tasks.find((x) => x.key === k && x.state === "running");
  for (const x of L.tasks) if (x.state === "running" && !x.fixed) close(x, "done", at);   // a loose note before it is over
  if (!t) { t = { key: k, fixed: true, text: String(text || ""), state: "running", t0: at, t1: 0, at }; Object.assign(t, shown(t.text)); L.tasks.push(t); trim(L); }
  // a step keeps the verb it started with ("finding what the pod has" -> "found what the pod has - Python 3.11 …")
  if (text) { t.text = String(text); t.rest = shown(t.text).rest; }
  t.at = at; L.at = at; L.last = null;
  if (st !== "running") close(t, st, at); else t.state = "running";
  return t;
}
/** the end of a run: everything still running is done (or failed), the result is the last line */
function finish(pod, ok, text, now) {
  const L = logOf(pod), at = now === undefined ? Date.now() : +now;
  if (!L) return null;
  for (const x of L.tasks) if (x.state === "running") close(x, ok === false && x === L.tasks[L.tasks.length - 1] ? "failed" : "done", at);
  const t = String(text || "").trim();
  L.at = at;
  L.last = t ? Object.assign({ ok: ok !== false, text: t, at }, shown(t)) : null;
  if (t) { L.tasks.push(Object.assign({ key: keyOf(t), text: t, state: ok === false ? "failed" : "done", t0: at, t1: at, at, result: true }, shown(t))); trim(L); }
  for (const f of ENDS) { try { f(pid(pod), ok !== false, t); } catch { /* a listener never breaks the log */ } }   // 2.774.0
  return L.last;
}
/** what the PODS docker shows (pure apart from the log): now = running tasks, done = the rest, newest first */
function view(pod, now) {
  const L = LOG[pid(pod)], at = now === undefined ? Date.now() : +now;
  if (!L || !L.tasks.length) return null;
  const out = (x) => ({ verb: x.verb, icon: x.icon, text: x.text, rest: x.rest, state: x.state, secs: Math.max(0, Math.round(((x.t1 || at) - x.t0) / 1000)), result: !!x.result });
  return { now: L.tasks.filter((x) => x.state === "running").map(out), done: L.tasks.filter((x) => x.state !== "running").map(out).reverse(), last: L.last, at: L.at };
}
/** every pod with something to show -> {pod: view} */
function all() { const o = {}; for (const k of Object.keys(LOG)) { const v = view(k); if (v) o[k] = v; } return o; }
function clear(pod) { delete LOG[pid(pod)]; }
module.exports = { verbOf, keyOf, note, step, finish, view, all, clear, onFinish, LOG, MAX };
