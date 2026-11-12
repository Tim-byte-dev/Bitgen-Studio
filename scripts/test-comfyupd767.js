#!/usr/bin/env node
/* bitGen Studio — 2.767.0 units: updating ComfyUI on a pod (lib/podComfyUpdate.js) - a FAILED update may be tried again at once
 * (2.766.3 waited an hour and hid why), only a success within the hour stops a second automatic try (and then says restart the
 * pod), the pod's log end in the reason, a checkout that cannot fast-forward goes to ComfyUI's own master, PODS ▸ My pods ▸
 * ⬆ Update ComfyUI (start / state, routes/remotePrep.js, static/podsetup.js).
 * Tim (verbatim): "can we update to the latest version of comfyui on the pod? … its ComfyUI lacks TextEncodeQwenImage21 (this
 * pod's ComfyUI 0.30.0 is older than qwen2_1 needs (TextEncodeQwenImage21) and was not updated: ComfyUI on this pod was updated
 * less than an hour ago and still lacks it)" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const CU = require("../lib/podComfyUpdate");
(async () => {
  process.env.H3_POD_REVIVE_POLL = "1";
  const w = { pod_id: "podU", jupyter: true, comfy_dir: "/workspace/ComfyUI", comfy_port: 8188, jupyter_url: "j" };
  let runs = 0, result = { running: false, state: "failed: git could not update it - fatal: not a git repository", log: "$ git pull --ff-only\nfatal: refusing to merge" };
  const deps = (extra) => Object.assign({ kernel: async () => { runs++; return "bitgen-cupd-started"; }, read: async () => result, sleep: async () => {}, at: async () => ({ url: "u", j: { system: { comfyui_version: "0.36.0" } } }) }, extra || {});
  const r1 = await CU.update(w, 8188, null, deps());
  check("a failed update says why - with the end of the pod's log", !r1.ok && /git could not update it/.test(r1.why) && /the pod's log ends: \$ git pull --ff-only \/ fatal: refusing to merge/.test(r1.why), r1);
  result = { running: false, state: "done", to: "0.36.0" };
  const r2 = await CU.update(w, 8188, null, deps());
  check("…and is tried again at once (2.766.3 waited an hour after ANY try)", runs === 2 && r2.ok && r2.version === "0.36.0", { runs, r2 });
  const r3 = await CU.update(w, 8188, null, deps());
  check("after a success within the hour, a second automatic try is not made - it says restart the pod (the new ComfyUI may not be the one running)", runs === 2 && !r3.ok && /updated to 0\.36\.0 less than an hour ago and still lacks it - restart the pod/.test(r3.why), r3);
  const r4 = await CU.update(w, 8188, null, deps({ force: true }));
  check("…⬆ Update ComfyUI (forced) always runs", runs === 3 && r4.ok);
  const code = CU.updateCode("/workspace/ComfyUI", 8188);
  check("updateCode: a pull that cannot fast-forward -> ComfyUI's own master (checkout --force -B master origin/master); the versions before / after", /'git', 'checkout', '--force', '-B', 'master', 'origin\/master'/.test(code) && /S\['from'\] = ver\(\)/.test(code) && /S\['to'\] = ver\(\)/.test(code) && /comfyui_version\.py/.test(code));
  const RR = fs.readFileSync(path.join(ROOT, "routes", "remotePrep.js"), "utf8"), PS = fs.readFileSync(path.join(ROOT, "static", "podsetup.js"), "utf8");
  check("PODS ▸ My pods ▸ ⬆ Update ComfyUI: POST / GET /api/pods/:id/comfy-update, the button shows how far", /app\.post\("\/api\/pods\/:id\/comfy-update"/.test(RR) && /app\.get\("\/api\/pods\/:id\/comfy-update"/.test(RR) && /data-pscomfy/.test(PS) && /⬆ Update ComfyUI/.test(PS) && /\/comfy-update"\)\.then\(function \(j\)/.test(PS));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
