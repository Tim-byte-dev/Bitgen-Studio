#!/usr/bin/env node
/* bitGen Studio — 2.756.1 units: the PODS docker lists EVERY template (lib/pods.js mergeSources / sortTemplates / matches /
 * searchText, templates({source: "all"})) and draws a card for each (static/podsdock.js).
 * Tim (verbatim): "list all them templates filter them by search, have a card for each of them like comfyui does. now it
 * says 0 of 100 templates" (ComfyUI only was on, and none of the 100 Official templates run ComfyUI). */
"use strict";
const fs = require("fs"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

// a stand-in config (only the RunPod key) so the live part runs without the studio
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => ({ rgpu: { runpod: { key: "rpa_test" } } }), setConfig: () => {} };
require.cache[coreP] = fake;
const A = require("../lib/runpodApi");
const P = require("../lib/pods");

const RAW = {
  official: [{ id: "pt1", name: "PyTorch 2.8", image: "runpod/pytorch:2.8", disk: 50, ports: ["8888/http", "22/tcp"], category: "NVIDIA", startSsh: true, startJupyter: true, allowedCudaVersions: ["12.8"] },
    { id: "sv1", name: "A serverless one", image: "x/y", serverless: true, ports: [] },
    { id: "cf1", name: "ComfyUI", image: "runpod/comfyui:latest", disk: 40, ports: ["8188/http"], category: "NVIDIA" }],
  verified: [{ id: "rc1", name: "ROCm PyTorch", image: "rocm/pytorch:6.4", disk: 30, ports: ["8888/http"], category: "AMD" }, { id: "cf1", name: "ComfyUI again", image: "runpod/comfyui:latest", ports: ["8188/http"] }],
  community: [{ id: "h31", name: "MiniMax H3 ComfyUI", image: "someone/h3:1", disk: 80, ports: ["3000/http"], mounts: { persistent: { size: 120, path: "/workspace" } }, category: "NVIDIA" }],
};

const all = P.mergeSources(RAW);
check("mergeSources: all three sources, pods only (no serverless template), each template once (the first source wins)",
  all.map((t) => t.id + "@" + t.source).join() === "pt1@official,cf1@official,rc1@verified,h31@community", all.map((t) => t.id + "@" + t.source));
const h3 = all.find((t) => t.id === "h31"), pt = all.find((t) => t.id === "pt1");
check("templateView now also: /workspace's size, SSH / Jupyter, the CUDA versions, the kind", h3.volume === 120 && pt.ssh && pt.jupyter && pt.cuda.join() === "12.8" && h3.category === "NVIDIA" && h3.comfy && h3.port === 3000, { h3, pt });
check("sortTemplates: ComfyUI ones first, then Official / Verified / Community, then by name", P.sortTemplates(all).map((t) => t.id).join() === "cf1,h31,pt1,rc1", P.sortTemplates(all).map((t) => t.id));
check("matches: every word, anywhere in name / image / ports / kind / source / id; blank = all",
  P.matches(pt, "") && P.matches(pt, "pytorch") && P.matches(all[2], "pytorch rocm") && !P.matches(pt, "pytorch rocm") && P.matches(h3, "3000") && P.matches(all[2], "amd")
  && P.matches(h3, "community h3") && P.matches(all[1], "comfy") && P.matches(pt, "RUNPOD/PYTORCH") && !P.matches(pt, "comfyui"));
check("searchText: lower case, the ComfyUI word for ComfyUI ones", /comfyui/.test(P.searchText(h3)) && P.searchText(pt) === P.searchText(pt).toLowerCase());

(async () => {
  const asked = [];
  A.templates = async (src) => { asked.push(src); if (src === "verified" && global.FAIL_VERIFIED) throw new Error("RunPod answered HTTP 500"); return RAW[src]; };
  let r = await P.templates({});
  check("templates(): the default is ALL - asks RunPod for each source, lists every pod template with a count per source; ComfyUI only is not assumed",
    r.source === "all" && asked.sort().join() === "community,official,verified" && r.total === 4 && r.templates.length === 4 && JSON.stringify(r.counts) === JSON.stringify({ official: 2, verified: 1, community: 1 }) && r.failed.length === 0, r);
  asked.length = 0;
  r = await P.templates({ comfy: true, q: "h3" });
  check("…cached 10 minutes (no new requests); comfy + a search still work on the server", asked.length === 0 && r.templates.map((t) => t.id).join() === "h31" && r.total === 4, { asked, r });
  r = await P.templates({ source: "official" });
  check("…one source still works (Official: 2)", r.source === "official" && r.templates.map((t) => t.id).join() === "cf1,pt1" && r.total === 2, r.templates.map((t) => t.id));
  global.FAIL_VERIFIED = true;
  r = await P.templates({ refresh: true });
  check("…a source RunPod does not answer for is named in failed; the others still list", r.failed.join() === "verified" && r.templates.length === 3 && /500/.test(r.error_detail), r);
  A.templates = async () => { throw Object.assign(new Error("RunPod refused the API key"), { status: 401 }); };
  let err = null; try { await P.templates({ refresh: true }); } catch (e) { err = e; }
  check("…all three failing = the error itself (the docker shows it)", err && err.status === 401 && /refused/.test(err.message));

  // 2.780.0 (Tim: "we drop the template browser completely"): the server's template list stays (the bitGen pod's template is
  // picked from it - lib/pods.js bitgenTemplate); the docker's template browser is gone
  const D = rd("static", "podsdock.js");
  check("static/podsdock.js: no template browser any more (no All / Official / Verified / Community tabs, search, kind, ComfyUI only, cards, ★ Shortcuts)",
    !/\["all", "All"\]/.test(D) && !/id="pdKind"/.test(D) && !/id="pdComfy"/.test(D) && !/id="pdQ"/.test(D) && !/class="pdCard/.test(D) && !/data-pdstar/.test(D) && /\["create", "＋ Create pod"\]/.test(D) && /\/api\/pods\/bitgen-template/.test(D));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); process.exit(1); });
