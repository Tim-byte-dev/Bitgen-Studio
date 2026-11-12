/* bitGen Studio — lib/podTransfers.js (2.766.0): EVERY TRANSFER TO A POD, for its progress bar.
 *
 * Tim (verbatim): "go with your suggestions and add a progress bar for each transfer to the pod"
 *
 *   begin({pod, pod_name, name, how, from, size}) -> id     how: "download" (the pod fetches it: Hugging Face, Civitai, a link)
 *                                                            | "upload" (this computer sends it to the pod)
 *                                                            | "hf" (this computer puts it in your private Hugging Face repo)
 *   step(id, done, size?)       bytes so far
 *   end(id, "done" | "failed: why")
 *   list()                      the running ones + the ones that ended in the last 10 minutes, newest first, each with its
 *                               rate (bytes/s over the last ~20 s) and the time left
 *   Who calls: lib/podSend.js (uploads, Civitai / remote list downloads), lib/podPrep.js (a style's downloads),
 *   lib/remoteModels.js (Model manager ⇪ to the selected pods), lib/hfUpload.js (your Hugging Face repo).
 *   GET /api/pods/transfers (routes/remoteModels.js) -> static/podxfer.js draws a bar for each.
 * Pure (scripts/test-remotemodels766.js): rateOf, leftOf, view.
 */
"use strict";
const T = new Map();
let seq = 0;
const KEEP = () => +(process.env.H3_POD_XFER_KEEP || 600000);

/** bytes / s from the samples [[t, done]] of the last 20 s (pure) */
function rateOf(samples, now) {
  const s = (samples || []).filter((x) => now - x[0] <= 20000);
  if (s.length < 2) return 0;
  const a = s[0], b = s[s.length - 1], dt = (b[0] - a[0]) / 1000;
  return dt > 0 && b[1] > a[1] ? (b[1] - a[1]) / dt : 0;
}
/** seconds left (pure) - 0 = not known */
function leftOf(done, size, rate) { return rate > 0 && size > done ? Math.round((size - done) / rate) : 0; }
/** what the page gets for one (pure) */
function view(x, now) {
  const rate = x.state === "running" ? rateOf(x.samples, now) : 0;
  return { id: x.id, pod: x.pod, pod_name: x.pod_name || x.pod, name: x.name, how: x.how, from: x.from || "", size: x.size || 0, done: x.done || 0,
    pct: x.size ? Math.min(100, Math.floor(100 * (x.done || 0) / x.size)) : (x.state === "done" ? 100 : 0),
    state: x.state, rate: Math.round(rate), left: leftOf(x.done || 0, x.size || 0, rate), started: x.started, ended: x.ended || 0 };
}

function begin(o) {
  const id = "x" + (++seq) + "-" + Date.now().toString(36), now = Date.now();
  T.set(id, { id, pod: String(o.pod || ""), pod_name: String(o.pod_name || ""), name: String(o.name || ""), how: o.how || "download", from: String(o.from || ""),
    size: +o.size || 0, done: 0, state: "running", started: now, samples: [[now, 0]] });
  return id;
}
function step(id, done, size) {
  const x = T.get(id); if (!x || x.state !== "running") return;
  if (+size > 0) x.size = +size;
  x.done = Math.max(0, +done || 0);
  const now = Date.now();
  x.samples.push([now, x.done]);
  while (x.samples.length > 2 && now - x.samples[0][0] > 25000) x.samples.shift();
}
function end(id, state) {
  const x = T.get(id); if (!x) return;
  x.state = state === "done" ? "done" : String(state || "failed").slice(0, 300);
  if (x.state === "done" && x.size) x.done = x.size;
  x.ended = Date.now();
}
function list() {
  const now = Date.now();
  for (const [k, x] of T) if (x.ended && now - x.ended > KEEP()) T.delete(k);
  return [...T.values()].sort((a, b) => b.started - a.started).map((x) => view(x, now));
}
function clear() { for (const [k, x] of T) if (x.state !== "running") T.delete(k); }
module.exports = { rateOf, leftOf, view, begin, step, end, list, clear };
