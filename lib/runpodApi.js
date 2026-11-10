// bitGen Studio — lib/runpodApi.js (2.755.0): RUNPOD'S REST API v2 - every pod / endpoint call the studio makes.
// RunPod retires REST v1 (rest.runpod.io/v1 - what lib/remoteGpu.js and lib/runpodImage.js called) on 15 November 2026
// (docs.runpod.io/api-reference-v2/migrate-from-v1). v2:
//   base          https://api.runpod.io/v2   (H3_RUNPOD_REST_API = another base - the tests' stand-in)
//   auth          Authorization: Bearer <API key>
//   GET  /pods                       {pods: [Pod], pagination: {nextCursor, hasNextPage}}  (cursor=, limit= up to 1000)
//   GET  /pods/{id}                  Pod + runtime {uptime (s since the container started), gpus, ports} (null unless RUNNING)
//   POST /pods/{id}/action           {action: start | stop | restart | terminate} -> 200 the Pod (204 terminate); 409 = not
//                                    valid now (start: EXITED / ERROR; stop: RUNNING / PROVISIONING / STARTING)
//   GET  /serverless                 the endpoints {endpoints?: [{id, image, ...}], pagination} (no GET by ID in v2)
//   Pod: id, name, status (PROVISIONING STARTING RUNNING EXITED ERROR TERMINATED), gpu {id: "NVIDIA GeForce RTX 4090",
//        count}, cost (USD / hour), ports ["8188/http"], startedAt, createdAt, template, image
//   The Serverless JOB API (api.runpod.ai/v2/<endpoint>/run - lib/runpodServerless.js) is a different API, not affected.
// Pure (scripts/test-runpodv2755.js): BASE, mapPod, statusWord, listOf.
"use strict";

const BASE = () => (process.env.H3_RUNPOD_REST_API || "https://api.runpod.io/v2").replace(/\/+$/, "");
/** a pod's HTTP port through RunPod's proxy; H3_RUNPOD_PROXY = a stand-in ("http://127.0.0.1:8399/proxy/{id}-{port}") */
function proxyUrl(id, port) {
  const i = String(id || "").replace(/[^a-z0-9]/gi, ""), pt = +port || 8188, t = process.env.H3_RUNPOD_PROXY;
  return t ? t.replace("{id}", i).replace("{port}", String(pt)) : `https://${i}-${pt}.proxy.runpod.net`;
}

/** a v2 (or an old v1) pod -> what the studio shows {id, name, status, gpu, gpus, cost_hr, url, started_at} (pure) */
function mapPod(p, port) {
  const g = p.gpu || p.machine || {};
  const cost = p.cost != null ? p.cost : (p.costPerHr != null ? p.costPerHr : (p.adjustedCostPerHr != null ? p.adjustedCostPerHr : 0));
  const gid = String(g.displayName || g.gpuDisplayName || g.id || p.gpuTypeId || "");
  return { id: p.id, name: p.name || p.id, status: String(p.status || p.desiredStatus || "").toUpperCase(),
    gpu: gid.replace(/^NVIDIA (GeForce )?/, ""), gpus: +(g.count || p.gpuCount || 1), cost_hr: +cost || 0,
    url: proxyUrl(p.id, port), started_at: p.startedAt || p.lastStartedAt || null };
}
/** what a status means to a person (pure) */
function statusWord(s) {
  return { PROVISIONING: "loading pod", STARTING: "loading pod", RUNNING: "pod running", EXITED: "stopped", ERROR: "error", TERMINATED: "terminated" }[String(s || "").toUpperCase()] || String(s || "").toLowerCase();
}
/** a v2 list page's items, whatever the collection is called (pure) */
function listOf(j, field) {
  if (Array.isArray(j)) return j;
  if (!j || typeof j !== "object") return [];
  if (Array.isArray(j[field])) return j[field];
  if (Array.isArray(j.data)) return j.data;
  const a = Object.values(j).find((v) => Array.isArray(v));
  return a || [];
}

async function call(method, p, key, body, opts) {
  const k = String(key || "").trim();
  if (!k) { const e = new Error("a RunPod API key first (runpod.io ▸ Settings ▸ API Keys - an \"All\" key for pods)"); e.status = 400; throw e; }
  const f = (opts && opts.fetch) || fetch;
  let r;
  try {
    r = await f(BASE() + p, { method, headers: { Authorization: "Bearer " + k, "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout((opts && opts.timeout) || 20000) });
  } catch (e) { const x = new Error("RunPod did not answer (" + ((e && e.message) || e) + ")"); x.status = 502; throw x; }
  const txt = r.status === 204 ? "" : await r.text().catch(() => "");
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = null; }
  if (r.status === 401 || r.status === 403) { const e = new Error("RunPod refused the API key" + (r.status === 403 ? " - it needs access to pods (an \"All\" key)" : "")); e.status = 401; throw e; }
  if (r.status === 404) { const e = new Error("RunPod does not know it (" + p + ")"); e.status = 404; throw e; }
  if (r.status === 409) { const e = new Error("RunPod: not possible in the pod's state now" + (j && (j.detail || j.message) ? " - " + (j.detail || j.message) : "")); e.status = 409; throw e; }
  if (!r.ok) { const e = new Error(`RunPod answered HTTP ${r.status}${j && (j.detail || j.message) ? ": " + String(j.detail || j.message).slice(0, 160) : ""}`); e.status = 502; throw e; }
  return j;
}
/** every page of a list */
async function listAll(p, key, field, opts) {
  const out = []; let cursor = "";
  for (let i = 0; i < 20; i++) {
    const j = await call("GET", p + (p.includes("?") ? "&" : "?") + "limit=1000" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), key, null, opts);
    out.push(...listOf(j, field));
    const pg = (j && j.pagination) || {};
    if (!pg.hasNextPage || !pg.nextCursor) break;
    cursor = pg.nextCursor;
  }
  return out;
}
const pods = (key, opts) => listAll("/pods", key, "pods", opts);
const pod = (id, key, opts) => call("GET", "/pods/" + encodeURIComponent(id), key, null, opts);
function action(id, act, key, opts) {
  if (!["start", "stop", "restart", "terminate"].includes(act)) { const e = new Error("start, stop, restart or terminate"); e.status = 400; throw e; }
  return call("POST", "/pods/" + encodeURIComponent(id) + "/action", key, { action: act }, opts);
}
/** the Docker image a Serverless endpoint runs ("" = not said) */
async function endpointImage(id, key, opts) {
  const list = await listAll("/serverless", key, "endpoints", opts);
  const ep = list.find((x) => x && x.id === id);
  if (!ep) { const e = new Error("RunPod does not know endpoint " + id); e.status = 404; throw e; }
  return String(ep.image || ((ep.template || {}).image) || ((ep.template || {}).imageName) || "");
}

module.exports = { BASE, proxyUrl, mapPod, statusWord, listOf, call, listAll, pods, pod, action, endpointImage };
