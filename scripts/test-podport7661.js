#!/usr/bin/env node
/* bitGen Studio — 2.766.1: a pod's ComfyUI found on the port that answers (lib/podModels.js comfyAt), a stopped pod said at
 * once, a busy pod waited for (lib/podSend.js whenUp, the bar's note), Override's checkpoint / LoRAs fetched on the pod's own
 * port (podRevive.modelGate).
 * Tim (verbatim): "when trying to send a model from civitai to th pod it fails. it works for the style model it generated. but
 * overide styles still doesn't work with remote, failed: the pod's ComfyUI is not answering yet - wait for "pod loaded"" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
let CFG = { rgpu: { runpod: { key: "rpa_T", port: 8188 } } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: os.tmpdir() };
require.cache[coreP] = fake;
const hits = [];
let comfyUp = true;
const srv = http.createServer((q, s) => {
  hits.push(q.url);
  const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
  if (q.url === "/v2/pods/podA") return send(200, { id: "podA", desiredStatus: "RUNNING", ports: ["3000/http", "8888/http", "22/tcp"] });
  if (q.url === "/v2/pods/podS") return send(200, { id: "podS", desiredStatus: "EXITED", ports: ["8188/http"] });
  const m = /^\/proxy\/(\w+)-(\d+)(\/.*)$/.exec(q.url);
  if (m && m[1] === "podA" && m[2] === "3000" && m[3] === "/system_stats" && comfyUp) return send(200, { system: { argv: ["/workspace/ComfyUI/main.py"] } });
  send(502, {});
});
srv.listen(0, "127.0.0.1", async () => {
  const P = srv.address().port;
  process.env.H3_RUNPOD_PROXY = "http://127.0.0.1:" + P + "/proxy/{id}-{port}";
  process.env.H3_RUNPOD_REST_API = "http://127.0.0.1:" + P + "/v2";
  const PM = require("../lib/podModels"), SD = require("../lib/podSend"), PT = require("../lib/podTransfers");
  try {
    const a = await PM.comfyAt("podA", 0);
    check("comfyAt: 8188 does not answer -> RunPod is asked for the pod's ports -> ComfyUI found on 3000 (8888 = Jupyter, skipped)", a.url.endsWith("/proxy/podA-3000") && a.port === 3000 && hits.includes("/v2/pods/podA") && !hits.some((h) => /podA-8888\/system_stats/.test(h)), { a, hits });
    hits.length = 0;
    const a2 = await PM.comfyAt("podA", 0);
    check("…remembered: the next time 3000 is asked first (RunPod not asked again)", a2.port === 3000 && hits[0] === "/proxy/podA-3000/system_stats" && !hits.includes("/v2/pods/podA"), hits);
    const st = await PM.comfyAt("podS", 0);
    check("a pod RunPod says is stopped -> stopped (no waiting for it)", st.url === "" && st.stopped === true);
    let e = null; try { await PM.ways("podS", 0); } catch (x) { e = x; }
    check("ways: a stopped pod is said - ▶ Start it", e && e.code === "stopped" && /the pod is stopped on RunPod - ▶ Start it/.test(e.message), e && e.message);
    comfyUp = false; delete PM.PORTS.podA;
    e = null; try { await PM.ways("podA", 0); } catch (x) { e = x; }
    check("…ComfyUI not answering on any port (and no Jupyter password): which ports were tried and how", e && e.code === "not_answering" && /tried port 8188: HTTP 502, 3000: HTTP 502/.test(e.message), e && e.message);
    let e2 = null; try { await require("../lib/podStyles").contents("podA", 0); } catch (x) { e2 = x; }
    check("…the pod's model lists (podStyles.contents) the same way", e2 && e2.code === "not_answering" && /tried port/.test(e2.message), e2 && e2.message);

    /* whenUp: a busy pod is waited for */
    process.env.H3_POD_WAIT_STEP = "5"; process.env.H3_POD_WAIT_MS = "2000";
    let n = 0; const waits = [];
    const r = await SD.whenUp(async () => { n++; if (n < 3) throw Object.assign(new Error("not answering"), { code: "not_answering" }); return "ok"; }, (why) => waits.push(why));
    check("whenUp: 'not answering' is tried again (the wait said each time) until it answers", r === "ok" && n === 3 && waits.length === 2);
    let e3 = null; n = 0; try { await SD.whenUp(async () => { n++; throw Object.assign(new Error("stopped"), { code: "stopped" }); }); } catch (x) { e3 = x; }
    check("…any other failure (a stopped pod) is not waited for", e3 && e3.code === "stopped" && n === 1);
    process.env.H3_POD_WAIT_MS = "30"; let e4 = null;
    try { await SD.whenUp(async () => { throw Object.assign(new Error("still busy"), { code: "not_answering" }); }); } catch (x) { e4 = x; }
    check("…after the wait (3 min in the app) the reason", e4 && /still busy/.test(e4.message));
    const x = PT.begin({ pod: "p", name: "a", how: "download" }); PT.note(x, "waiting for the pod to answer (20 s)");
    check("the bar's note while it waits (podTransfers.note -> view.note; podxfer shows it)", PT.list().find((y) => y.id === x).note === "waiting for the pod to answer (20 s)" && require("../static/podxfer.js").rowText({ state: "running", done: 0, note: "waiting for the pod to answer (20 s)" }) === "waiting for the pod to answer (20 s)");
    const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
    check("pullWait waits for a busy pod (fromLink in whenUp, the note); ensure waits for the pod's model lists", /await whenUp\(\(\) => PM\.fromLink\(/.test(src("lib/podSend.js")) && /const have = await whenUp\(\(\) => PS\.contents\(id, port\)/.test(src("lib/podSend.js")));
    check("Override's checkpoint / LoRAs on the pod's OWN port (stylePods passes portOf; it was Settings' port)", /modelGate\(st, use, portOf\(rg\(\), use\)\)/.test(src("lib/stylePods.js")) && /SD\.ensure\(podId, \+port \|\| \+st\.pod_port \|\| 0,/.test(src("lib/podRevive.js")));
    check("ways: ComfyUI busy but the pod's Jupyter answers -> downloads still go (Jupyter finds ComfyUI's folder)", /if \(!url && !jupyter\) \{/.test(src("lib/podModels.js")) && /comfy_answers: !!url/.test(src("lib/podModels.js")));
  } catch (x) { check("no error", false, String(x && x.stack)); }
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});
