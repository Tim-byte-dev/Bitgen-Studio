#!/usr/bin/env node
/* bitGen Studio — 2.755.0 units: RUNPOD'S REST API v2 (lib/runpodApi.js) - REST v1 retires on 15 November 2026.
 * Tim's ask that led here: "show loading pod, pod loaded, stopping pod" (+ create pods, costs - next releases).
 *   base api.runpod.io/v2 (H3_RUNPOD_REST_API = a stand-in); Bearer key; pods listed page by page ({pods, pagination});
 *   POST /pods/{id}/action {action}; 401 / 403 / 404 / 409 said plainly; a v2 pod mapped (status, gpu.id without
 *   "NVIDIA GeForce", cost, startedAt) and an old v1 one still read; the states in words; the proxy address (and its
 *   stand-in H3_RUNPOD_PROXY); the endpoint's image from GET /serverless; nothing left calling rest.runpod.io/v1. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
delete process.env.H3_RUNPOD_REST_API; delete process.env.H3_RUNPOD_PROXY;
const A = require("../lib/runpodApi");
check("base: https://api.runpod.io/v2 (H3_RUNPOD_REST_API = another)", A.BASE() === "https://api.runpod.io/v2" && (process.env.H3_RUNPOD_REST_API = "http://stand.in/v2/", A.BASE()) === "http://stand.in/v2");
const m = A.mapPod({ id: "p1", name: "H3", status: "RUNNING", gpu: { id: "NVIDIA GeForce RTX 4090", count: 2 }, cost: 1.38, startedAt: "2026-11-10T01:00:00Z" }, 8188);
check("mapPod (v2): status, the GPU without NVIDIA GeForce, its count, cost per hour, started, the proxy address", m.status === "RUNNING" && m.gpu === "RTX 4090" && m.gpus === 2 && m.cost_hr === 1.38 && m.started_at === "2026-11-10T01:00:00Z" && m.url === "https://p1-8188.proxy.runpod.net", m);
const o = A.mapPod({ id: "p2", desiredStatus: "exited", machine: { gpuDisplayName: "RTX A5000" }, costPerHr: 0.36 });
check("…an old v1 pod still read (desiredStatus, machine.gpuDisplayName, costPerHr)", o.status === "EXITED" && o.gpu === "RTX A5000" && o.cost_hr === 0.36, o);
check("statusWord: loading pod / pod running / stopped / error / terminated", A.statusWord("PROVISIONING") === "loading pod" && A.statusWord("starting") === "loading pod" && A.statusWord("RUNNING") === "pod running" && A.statusWord("EXITED") === "stopped" && A.statusWord("TERMINATED") === "terminated");
check("listOf: the named list, data, the first array, an array as it is", A.listOf({ pods: [1] }, "pods")[0] === 1 && A.listOf({ data: [2] }, "x")[0] === 2 && A.listOf({ endpoints: [3], pagination: {} }, "x")[0] === 3 && A.listOf([4])[0] === 4 && A.listOf(null).length === 0);
check("proxyUrl: RunPod's proxy; H3_RUNPOD_PROXY a stand-in pattern", A.proxyUrl("p1", 3000) === "https://p1-3000.proxy.runpod.net" && (process.env.H3_RUNPOD_PROXY = "http://h/proxy/{id}-{port}", A.proxyUrl("p1", 3000)) === "http://h/proxy/p1-3000");
delete process.env.H3_RUNPOD_PROXY;

(async () => {
  const calls = [];
  const resp = (status, j) => ({ status, ok: status >= 200 && status < 300, text: async () => (j == null ? "" : JSON.stringify(j)) });
  const fetch = async (url, o) => {
    calls.push({ url, method: o.method, auth: o.headers.Authorization, body: o.body });
    if (/\/pods\?limit=1000$/.test(url)) return resp(200, { pods: [{ id: "a", name: "A", status: "EXITED" }], pagination: { nextCursor: "n2", hasNextPage: true } });
    if (/\/pods\?limit=1000&cursor=n2$/.test(url)) return resp(200, { pods: [{ id: "b", name: "B", status: "RUNNING" }], pagination: { nextCursor: null, hasNextPage: false } });
    if (/\/pods\/a\/action$/.test(url)) return JSON.parse(o.body).action === "stop" ? resp(409, { detail: "pod is not running" }) : resp(200, { id: "a", status: "STARTING" });
    if (/\/serverless\?limit=1000$/.test(url)) return resp(200, { endpoints: [{ id: "ep1", image: "runpod/worker-comfyui:5.10.0-sdxl" }], pagination: { hasNextPage: false } });
    if (/\/pods\/x$/.test(url)) return resp(404, {});
    return resp(403, {});
  };
  const all = await A.pods("rpa_K", { fetch });
  check("pods: every page (cursor), Bearer key", all.map((x) => x.id).join() === "a,b" && calls.every((c) => c.auth === "Bearer rpa_K") && calls[1].url === "http://stand.in/v2/pods?limit=1000&cursor=n2", calls.map((c) => c.url));
  const st = await A.action("a", "start", "rpa_K", { fetch });
  const last = calls[calls.length - 1];
  check("action: POST /pods/{id}/action with {action: start} -> the pod", st.status === "STARTING" && last.method === "POST" && /\/pods\/a\/action$/.test(last.url) && JSON.parse(last.body).action === "start", last);
  let e409 = null; try { await A.action("a", "stop", "rpa_K", { fetch }); } catch (e) { e409 = e; }
  check("…409 said plainly (not possible in the pod's state now + RunPod's reason)", e409 && e409.status === 409 && /not possible in the pod's state now - pod is not running/.test(e409.message), e409 && e409.message);
  let eAct = null; try { A.action("a", "explode", "k"); } catch (e) { eAct = e; }
  check("…only start / stop / restart / terminate", eAct && eAct.status === 400);
  let e403 = null; try { await A.call("GET", "/nothing", "rpa_K", null, { fetch }); } catch (e) { e403 = e; }
  check("403: refused, saying the key needs pod access (an All key)", e403 && e403.status === 401 && /needs access to pods \(an "All" key\)/.test(e403.message), e403 && e403.message);
  let e404 = null; try { await A.pod("x", "rpa_K", { fetch }); } catch (e) { e404 = e; }
  let eKey = null; try { await A.pods("", { fetch }); } catch (e) { eKey = e; }
  check("404 = RunPod does not know it; no key = says where to get one", e404 && e404.status === 404 && eKey && eKey.status === 400 && /API key first/.test(eKey.message));
  check("endpointImage: from GET /serverless (v2 has no GET by ID)", (await A.endpointImage("ep1", "rpa_K", { fetch })) === "runpod/worker-comfyui:5.10.0-sdxl");
  const left = [];
  for (const d of ["lib", "routes", "static"]) for (const f of fs.readdirSync(path.join(ROOT, d))) if (/\.js$/.test(f) && /rest\.runpod\.io\/v1/.test(fs.readFileSync(path.join(ROOT, d, f), "utf8").replace(/\/\/.*$/gm, ""))) left.push(d + "/" + f);
  check("nothing in lib / routes / static calls REST v1 (rest.runpod.io/v1) any more", left.length === 0, left);
  check("lib/remoteGpu.js + lib/runpodImage.js go through lib/runpodApi.js; the pod-state route is mounted", /require\("\.\/runpodApi"\)\.pods/.test(fs.readFileSync(path.join(ROOT, "lib", "remoteGpu.js"), "utf8"))
    && /require\("\.\/runpodApi"\)\.endpointImage/.test(fs.readFileSync(path.join(ROOT, "lib", "runpodImage.js"), "utf8")) && /app\.get\("\/api\/remotegpu\/pod\/:id"/.test(fs.readFileSync(path.join(ROOT, "routes", "remoteGpu.js"), "utf8")));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
