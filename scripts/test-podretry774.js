#!/usr/bin/env node
/* bitGen Studio — 2.774.0: A RENDER THAT FAILED ON ITS POD GOES AGAIN WHEN THE POD IS READY (lib/podRetry.js).
 * Held when the queue fails it for its pod (lib/core.js, gate error with retry); queued again by itself when the pod has
 * something new (a pod job ends well - lib/podActivity.js onFinish; a file sent lands - podModels) and is quiet; at most 3
 * tries; a render cleared from the Queue is not tried again. Stubbed core.
 * Tim (verbatim): "after the pod is setup for the style start the generation that initiated the create pod or select pod
 * dialog" + "yes, please do that" */
"use strict";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const RT = require("../lib/podRetry"), PA = require("../lib/podActivity");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ---- pure
  const H = [{ id: "a", pod: "p1", at: 100, tries: 0 }, { id: "b", pod: "p1", at: 50, tries: 0 }, { id: "c", pod: "p2", at: 10, tries: 0 }, { id: "d", pod: "p1", at: 300, tries: 0 }, { id: "e", pod: "p1", at: 90, tries: 3 }];
  check("due: the pod's held renders from before the change, oldest first - not another pod's, not later ones, not after 3 tries",
    JSON.stringify(RT.due(H, "p1", 200).map((h) => h.id)) === JSON.stringify(["b", "a"]), RT.due(H, "p1", 200));
  check("…not after 12 hours", RT.due([{ id: "x", pod: "p1", at: 0, tries: 0 }], "p1", RT.MAX_AGE + 1).length === 0);

  // ---- stubbed core
  const jobs = new Map(), made = [], logs = {};
  let busy = false;
  const C = { jobs, log: (j, t) => { (logs[j.id] = logs[j.id] || []).push(t); }, makeJob: (p, a, b, o) => { const j = { id: "n" + (made.length + 1), params: p, project: o.project }; made.push({ j, o }); jobs.set(j.id, j); return j; } };
  RT.setDeps({ core: () => C, busy: () => busy, wait: 20 });
  const job = (id, pod, extra) => { const j = { id, status: "failed", project: "proj1", params: Object.assign({ mode: "image", prompt: "a fox", style: { id: "qwen2_1", name: "Qwen 2.1" }, pod_job: { pod_id: pod } }, extra || {}) }; jobs.set(id, j); return j; };

  const j1 = job("j1", "podA");
  const h = RT.hold(j1, "podA", "qwen2_1 cannot render on the pod yet - these files are not on it: x.safetensors");
  check("a failed pod render is held: its settings kept (without the pod it was sent to), the log says it goes again when the pod is ready",
    h && RT.held("podA").length === 1 && !h.params.pod_job && h.params.prompt === "a fox" && /goes again by itself when the pod podA is ready/.test((logs.j1 || []).join("\n")), { h, logs: logs.j1 });
  check("…a ⚡ live render is never held", RT.hold(job("jl", "podA", { live: true }), "podA", "x") === null);

  // a pod job ends well while the pod is still busy: waits, then goes again
  busy = true;
  await sleep(5);
  PA.finish("podA", true, "set up and ready - ComfyUI 0.42.0");
  await sleep(120);
  check("…a pod job ends well while other pod work still runs: it waits for the pod to be quiet", made.length === 0, made.length);
  busy = false;
  await sleep(3200);
  const n1 = made[0] && made[0].j;
  check("…then it is queued again: same settings, its project, the try counted, the old job pointing at it",
    made.length === 1 && n1.params.prompt === "a fox" && n1.params._pod_retry === 1 && n1.params._pod_retry_of === "j1" && made[0].o.project === "proj1" && made[0].o.local === true && j1.retried_as === n1.id && RT.held("podA").length === 0,
    { made: made.map((m) => m.j.params), j1 });
  check("…its log says why it goes again", /again \(try 2\): Qwen 2\.1 failed on the pod podA .* the pod is ready now \(set up and ready/.test((logs[n1.id] || []).join("\n")), logs[n1.id]);

  // a failed pod job does not send it again; another pod's job does not either
  const j2 = job("j2", "podB"); RT.hold(j2, "podB", "x");
  await sleep(5);
  PA.finish("podB", false, "ComfyUI was not installed: git clone did not work");
  PA.finish("podZ", true, "set up and ready");
  await sleep(3200);
  check("…a pod job that FAILED, or another pod's, does not send it again", made.length === 1 && RT.held("podB").length === 1, { made: made.length, held: RT.held() });
  // a file sent from this computer lands on it
  check("…a file landing on the pod (changed) sends it again", RT.changed("podB", "x.safetensors is on the pod") === true);
  await sleep(3200);
  check("…queued again", made.length === 2 && made[1].j.params._pod_retry_of === "j2", made.length);

  // cleared from the Queue = not again
  const j3 = job("j3", "podC"); RT.hold(j3, "podC", "x"); jobs.delete("j3");
  await sleep(5);
  RT.changed("podC");
  await sleep(3200);
  check("…a failed render cleared from the Queue is not tried again", made.length === 2 && RT.held("podC").length === 0, made.length);

  // tries counted: the third failure stops it
  const j4 = job("j4", "podD", { _pod_retry: 3 });
  check("…after 3 tries it is not held again (the log says to press Generate when the pod is fixed)", RT.hold(j4, "podD", "x") === null && /not tried again/.test((logs.j4 || []).join("\n")), logs.j4);
  // a change with nothing held = nothing to do
  check("…a change on a pod with nothing held does nothing", RT.changed("podQ") === false);

  // ---- core.js holds it; the gate's failure carries the pod
  const fs = require("fs"), path = require("path"), src = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  check("core.js: a failed pod render (not cancelled, retry) is held by podRetry", /g\.retry && g\.pod_id\) \{ try \{ require\("\.\/podRetry"\)\.hold\(j, g\.pod_id, g\.error\)/.test(src("lib/core.js")));
  check("stylePods.gate: a failed pod setup / a model gate error carries the pod and retry", /return \{ error: R\.note, pod_id: R\.new_id \|\| pod, retry: true \}/.test(src("lib/stylePods.js")) && /mg\.error\) return Object\.assign\(\{\}, mg, \{ pod_id: use, retry: true \}\)/.test(src("lib/stylePods.js")));
  check("podModels: a file sent from this computer that lands on the pod tells podRetry", /require\("\.\/podRetry"\)\.changed\(w\.pod_id/.test(src("lib/podModels.js")));

  RT.setDeps(null);
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
