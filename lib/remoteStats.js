/* bitGen Studio — lib/remoteStats.js (2.773.0): THE LEFT DOCKER'S SYSTEM STATS ARE THE POD'S IN REMOTE MODE.
 *
 * Tim (verbatim): "when in remote mode , show the remote gpus/ram/cpu/hdd stats in the left docker instead of the local stats"
 *   now()        Basic Settings ▸ GPU on Remote (remote generation on) with RunPod ▸ Pods and a pod in use -> that pod's figures
 *                (lib/podStats.js - its Jupyter: nvidia-smi incl. temperature, /proc/meminfo, the load average, the disks of /
 *                and /workspace; kept 4 s) in the shape of /api/stats (MB for RAM / VRAM) + its disks;
 *                -> {remote: null} (local, Both, Serverless, OpenRouter) | {remote: {pod_id, name, error?}, stats?}
 *   shape(ps)    podStats -> the /api/stats shape (pure)
 *   GET /api/pods/remote-stats (routes/pods.js) - static/remotestats.js puts it in the left docker's charts.
 * Pure (scripts/test-remotestats773.js): shape, which.
 */
"use strict";
const MB = 1048576;
/** podStats -> /api/stats' shape (pure): cpu %, ram MB, gpus [{name, util, temp, mem_used MB, mem_total MB}], disks (bytes) */
function shape(ps) {
  const p = ps || {};
  return {
    cpu: p.cpu ? Math.round(+p.cpu.load || 0) : null, cpu_temp: null, cores: p.cpu ? +p.cpu.cores || 0 : 0,
    ram_used: p.ram ? Math.round((+p.ram.used || 0) / MB) : null, ram_total: p.ram ? Math.round((+p.ram.total || 0) / MB) : null,
    gpus: (p.gpus || []).map((g, i) => ({ index: i, name: String(g.name || "GPU"), util: g.util == null ? null : Math.round(+g.util), temp: g.temp == null ? null : Math.round(+g.temp),
      mem_used: Math.round((+g.mem_used || 0) / MB), mem_total: Math.round((+g.mem_total || 0) / MB) })),
    disks: (p.disks || []).map((d) => ({ path: String(d.path || ""), used: +d.used || 0, total: +d.total || 0 })),
    how: String(p.how || ""),
  };
}
/** which pod the stats are of (pure): remote mode with Pods and a pod in use -> {pod_id, name, port} | {none: why} | null (local) */
function which(rgpu, on, split, engine) {
  const r = rgpu || {};
  if (!on || !split || split.where !== "remote") return null;
  if (!(engine || {}).pods) return { none: (engine || {}).provider === "openrouter" ? "OpenRouter has no machine of yours to show" : "RunPod Serverless has no machine of yours to show" };
  const rp = r.runpod || {}, id = String(rp.pod_id || "").replace(/[^A-Za-z0-9]/g, "");
  if (!id) return { none: "no pod in use yet - PODS ▸ My pods ▸ Use it" };
  return { pod_id: id, name: String(rp.pod_name || id), port: +rp.port || 8188 };
}

/* ---------------- live */
async function now() {
  const C = require("./core"), G = require("./gpuSplit"), r = ((C.getConfig() || {}).rgpu) || {};
  let w = null; try { w = which(r, G.enabled(), G.split(), G.engineOf(r)); } catch { w = null; }
  if (!w) return { remote: null };
  if (w.none) return { remote: { none: w.none } };
  const ps = await require("./podStats").stats(w.pod_id, w.port).catch((e) => ({ error: String((e && e.message) || e) }));
  const out = { remote: { pod_id: w.pod_id, name: w.name } };
  if (ps.error && !(ps.gpus || []).length && !ps.ram) out.remote.error = ps.error;
  else out.stats = shape(ps);
  return out;
}
module.exports = { shape, which, now };
