#!/usr/bin/env node
/* bitGen Studio — 2.763.4 units + LIVE: the PODS docker's figures and a gone pod that asks.
 *   lib/podStats.js (parse / fromComfy / CODE), uploads with names Jupyter accepts (never hidden), kernels shut down after use,
 *   a style whose pod RunPod no longer has asks (filled in from how the old pod was made) instead of making one by itself.
 * Tim (verbatim): "the pod was created automatically, i didn't get to choose the gpu pod, show all the details before i create
 * the pod. in the pods docker show utilization, memory and disk visualizations and usage. put the style in the dropdown as the
 * selected style in the prompt docker" + "[pod] sending Krea2/krea2WRC10.safetensors to the pod: failed: the pod's Jupyter
 * refused part 1 (HTTP 400)" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const PS = require("../lib/podStats");
const s1 = PS.parse('junk\nbitgen-stats {"gpus":[{"name":"NVIDIA A40","util":87.4,"mem_used":10737418240,"mem_total":48318382080}],"ram":{"used":3e10,"total":2e11},"cpu":{"load":8,"cores":16},"disks":[{"path":"/","used":1e10,"total":5e10},{"path":"/workspace","used":4e10,"total":1e11}]}');
check("parse: each GPU's load + memory, RAM, CPU load as % of its cores, both disks", s1 && s1.gpus[0].util === 87 && s1.gpus[0].mem_total === 48318382080 && s1.cpu.load === 50 && s1.disks.length === 2 && s1.ram.total === 2e11 && s1.how === "jupyter", s1);
check("parse: nothing usable = null", PS.parse("no stats here") === null && PS.parse("bitgen-stats {bad") === null);
const s2 = PS.fromComfy({ system: { ram_total: 2e11, ram_free: 1.5e11 }, devices: [{ name: "cuda:0 NVIDIA A40 : cudaMallocAsync", type: "cuda", vram_total: 4.8e10, vram_free: 3e10 }] });
check("fromComfy (no Jupyter): RAM + each GPU's memory from /system_stats, no load", s2.gpus[0].name === "NVIDIA A40" && s2.gpus[0].util === null && s2.gpus[0].mem_used === 1.8e10 && s2.ram.used === 5e10 && s2.how === "comfy", s2);
{ const f = path.join(os.tmpdir(), "ps7634.py"); fs.writeFileSync(f, PS.CODE);
  const r = require("child_process").spawnSync("python3", [f], { encoding: "utf8" });
  const o = PS.parse(r.stdout);
  check("CODE runs (here: no GPU) - RAM, CPU, the disk of /", o && o.ram && o.ram.total > 0 && o.cpu && o.cpu.cores > 0 && o.disks.some((d) => d.path === "/"), r.stdout + r.stderr); }
const PM = rd("lib", "podModels.js"), PN = rd("lib", "podNodes.js");
check("uploads: the part file is \"bitgen-upload-<name>\" (Jupyter refuses hidden names with HTTP 400), node zips \"bitgen-nodes-…\"; every kernel shut down after it answers",
  /tmp = "bitgen-upload-" \+ name;/.test(PM) && !/"\.bitgen_up_"/.test(PM) && /k\.zip = "bitgen-nodes-"/.test(PN) && /method: "DELETE"/.test(PM));
const PD = rd("static", "podsdock.js"), PSU = rd("static", "podsetup.js"), RT = rd("routes", "pods.js");
check("the docker: GET /api/pods/:id/stats bars (GPU %, VRAM, RAM, CPU, disks) beside a running pod's name + inside it, every 5 s while on screen; the summary before Create pod; the prompt docker's style picked",
  /app\.get\("\/api\/pods\/:id\/stats"/.test(RT) && /function statsHtml\(st, small\)/.test(PD) && /function pollStats\(\)/.test(PD) && /id="pdSum"/.test(PD) && /function summary\(\)/.test(PD)
  && /function promptStyle\(\)/.test(PD) && /function promptStyleId\(\)/.test(PSU) && /s\.id === ps \? " selected"/.test(PSU));

/* ---------------- live: a style whose pod is gone */
let CFG = { rgpu: { runpod: { key: "rpa_T7634", pod_id: "gone7634", pod_name: "Old" }, enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" },
  style_pods: { s7634: "gone7634" }, pod_cfg: { gone7634: { kinds: ["image"] } },
  pod_made: { gone7634: { template_id: "tplOld7634", template_name: "ComfyUI - CUDA 13.0", gpu: "NVIDIA A40", count: 2, cloud: "COMMUNITY", disk: 40, volume: 120, port: 8188, name: "bitGen Krea" } } } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: path.join(os.tmpdir(), "nostyles7634"), BASE: ROOT, resolvePath: (p) => path.resolve(p) };
require.cache[coreP] = fake;
const seen = [];
const srv = http.createServer((q, s) => {
  seen.push(q.method + " " + q.url);
  const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
  if (q.method === "GET" && /^\/v2\/pods\?limit=1000/.test(q.url)) return send(200, { pods: [] });
  if (q.method === "GET" && /^\/v2\/pods\/gone7634/.test(q.url)) return send(404, {});
  if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: q.url.includes("official") ? [{ id: "tplOld7634", name: "ComfyUI - CUDA 13.0", ports: ["8188/http"] }, { id: "tplCu13x", name: "ComfyUI CUDA 13" }] : [], pagination: { hasNextPage: false } });
  if (/^\/v2\/catalog\/gpus/.test(q.url)) return send(200, { gpus: [{ id: "NVIDIA A40", name: "A40", memory: 48, price: { secure: 0.44, community: 0.35 }, availability: "HIGH", secure: true, community: true },
    { id: "NVIDIA RTX A5000", name: "RTX A5000", memory: 24, price: { secure: 0.27, community: 0.16 }, availability: "HIGH", secure: true, community: true }] });
  if (q.method === "POST" && q.url === "/v2/pods") { seen.push("CREATE"); return send(201, { id: "new7634" }); }
  send(404, {});
});
srv.listen(0, "127.0.0.1", async () => {
  process.env.H3_RUNPOD_REST_API = "http://127.0.0.1:" + srv.address().port + "/v2";
  process.env.H3_RUNPOD_PROXY = "http://127.0.0.1:" + srv.address().port + "/proxy/{id}-{port}";
  const SP = require("../lib/stylePods");
  const job = { mode: "image", style: { id: "s7634", name: "Krea 2 Raw", kind: "image", engine: "comfy" } };
  try {
    let g = SP.gate(job), notes = [g && g.note];
    for (let i = 0; i < 100 && g && g.wait && !g.ask; i++) { await new Promise((r) => setTimeout(r, 100)); g = SP.gate(job); if (g && g.note) notes.push(g.note); }
    check("the style's pod is gone on RunPod: NOT made again by itself - its links go and the render asks (the PODS docker)", g && g.ask && !seen.includes("CREATE") && !CFG.rgpu.style_pods.s7634
      && !(CFG.rgpu.pod_cfg.gone7634.kinds || []).length && !CFG.rgpu.runpod.pod_id, { g, notes, seen, links: CFG.rgpu.style_pods });
    const o = await SP.offer(g.ask);
    check("…the question's offer starts from how the old pod was made: its template (still listed), its GPU (A40, not the cheaper A5000), 2 GPUs, Community, its 120 GB disk - and names the old pod",
      o.template && o.template.id === "tplOld7634" && o.pick === "NVIDIA A40" && o.count === 2 && o.cloud === "COMMUNITY" && o.volume_gb === 120 && o.was && o.was.name === "bitGen Krea" && o.gpus.length === 2, o);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
