#!/usr/bin/env node
/* bitGen Studio — 2.769.1: a pod bitGen made is stored as bitGen's (rgpu.pod_made + the env mark BITGEN_MADE=1 on the pod) and
 * set up by itself once it loads - its ComfyUI updated, its styles made ready, used when nothing else is - no render or
 * button needed (lib/podMade.js, lib/pods.js, lib/podComfyUpdate.js auto). Stubbed pod.
 * Tim (verbatim): "when the pod is made with bitgen store that it was made with bitgen and automatically treat it as such, don't
 * wait for button press" */
"use strict";
const fs = require("fs"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
let CFG = { rgpu: { pod_made: {} } };
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT });
const PM = require("../lib/podMade"), P = require("../lib/pods");

(async () => {
  check("isMadeEnv: bitGen's mark in each shape RunPod gives env in; none = not bitGen's",
    PM.isMadeEnv({ env: { BITGEN_MADE: "1" } }) && PM.isMadeEnv({ env: ["A=b", "BITGEN_MADE=1"] }) && PM.isMadeEnv({ env: [{ key: "BITGEN_MADE", value: "1" }] }) && !PM.isMadeEnv({ env: { X: "1" } }) && !PM.isMadeEnv({}));
  const b = P.createBody({ templateId: "abcd1234", gpu: "X", jupyter: "pw" });
  check("createBody: every pod bitGen makes carries BITGEN_MADE=1 (with its Jupyter password)", b.env.BITGEN_MADE === "1" && b.env.JUPYTER_PASSWORD === "pw");

  /* ---- set up by itself when it loads */
  CFG.rgpu.pod_made.podA = { port: 8188, name: "bitGen A" };
  const seen = []; let ups = 0;
  const D = { up: async () => (++ups >= 3), sleep: async () => {},
    autoUpdate: async (id, port, say) => { seen.push("update " + id); say("updating ComfyUI on the new pod first"); return { ok: true, version: "0.42.0" }; },
    styles: () => [{ id: "s1", name: "qwen2_1" }], prepare: async (id, port, st) => { seen.push("prepare " + st.map((x) => x.name).join()); return { problems: [], notThere: [] }; },
    useIfNone: (id) => { seen.push("use " + id); return true; } };
  const W = PM.watch("podA", 8188, D);
  await W.promise;
  check("watch(): waits for the pod to load, then BY ITSELF - its ComfyUI updated, its linked styles made ready, used (nothing else was); marked set up",
    ups === 3 && seen.join("|") === "update podA|prepare qwen2_1|use podA" && W.phase === "ready" && /set up - ComfyUI 0\.42\.0, its styles ready/.test(W.note) && CFG.rgpu.pod_made.podA.setup_at > 0, { seen, W });
  check("…its state for PODS ▸ My pods", PM.status("podA").phase === "ready");
  check("resume(): a pod already set up is not watched again", PM.resume(D).length === 0);
  CFG.rgpu.pod_made.podB = { port: 8188 };
  D.autoUpdate = async () => ({ ok: false, why: "restart needed: ComfyUI is the pod's main process" }); D.up = async () => true;
  const back = PM.resume(D);
  await PM.WATCH.podB.promise;
  check("resume() (bitGen restarted): a pod it made that was never set up is watched again; a failed update is said in its line", back.join() === "podB" && PM.status("podB").phase === "failed" && /ComfyUI not updated: restart needed/.test(PM.status("podB").note), PM.status("podB"));
  delete CFG.rgpu.pod_made.podB;
  CFG.rgpu.pod_made.podC = { port: 8188 };
  const W2 = PM.watch("podC", 8188, Object.assign({}, D, { up: async () => { delete CFG.rgpu.pod_made.podC; return false; } }));
  await W2.promise;
  check("…a pod no longer recorded (terminated) stops being watched", W2.phase === "failed" && /no longer a pod bitGen made/.test(W2.note));

  /* ---- known again from RunPod's list */
  let watched = ""; const w0 = PM.watch; PM.watch = (id) => { watched = id; return {}; };
  const got = PM.adopt({ id: "podZ", name: "bitGen Z", env: { BITGEN_MADE: "1" } }, 8188);
  check("adopt(): a pod with bitGen's mark this computer has no record of (another install, a lost config) - recorded and set up", got && CFG.rgpu.pod_made.podZ.recovered === true && watched === "podZ" && (CFG.rgpu.pods_bitgen || []).some((x) => x.id === "podZ"));
  check("…not twice; a pod without the mark is not adopted", !PM.adopt({ id: "podZ", env: { BITGEN_MADE: "1" } }, 8188) && !PM.adopt({ id: "podQ", env: {} }, 8188));
  PM.watch = w0;

  /* ---- the automatic ComfyUI update is tried again when it failed (3 times at most) */
  const CU = require("../lib/podComfyUpdate");
  CFG.rgpu.pod_made.podF = { port: 8188, comfy_auto: 1, comfy_tries: 1, comfy_ok: false };
  const s0 = CU.start; let started = 0; CU.RUNS.podF = undefined;
  // (start is internal; RUNS shows the run) - a stand-in run that ends at once
  stub("../lib/podSend", { whenUp: async () => { throw new Error("offline here"); } });
  const R = CU.auto("podF", 8188); started = R ? 1 : 0;
  check("auto(): the earlier automatic update failed ('restart needed …') - tried again", started === 1 && CFG.rgpu.pod_made.podF.comfy_tries === 2, CFG.rgpu.pod_made.podF);
  await new Promise((r) => setTimeout(r, 50));
  CFG.rgpu.pod_made.podF.comfy_tries = 3;
  check("…not after 3 tries; never once it worked", CU.auto("podF", 8188) === null && (CFG.rgpu.pod_made.podG = { comfy_ok: true }, CU.auto("podG", 8188) === null));
  void s0;
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  check("lib/pods.js: create watches the new pod; its list marks pods bitGen made (made_by_bitgen, its set-up state) and adopts a marked one; routes/index.js resumes after a restart; My pods shows the line",
    /require\("\.\/podMade"\)\.watch\(p\.id, port\)/.test(src("lib/pods.js")) && /PMd\.adopt\(p, port\)/.test(src("lib/pods.js")) && /made_by_bitgen: /.test(src("lib/pods.js"))
    && /require\("\.\.\/lib\/podMade"\)\.resume\(\)/.test(src("routes/index.js")) && /"made by bitGen: " \+ esc\(p\.setup\.note\)/.test(src("static/podsdock.js")));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
