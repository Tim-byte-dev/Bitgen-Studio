#!/usr/bin/env node
/* bitGen Studio — 2.807.0: RunPod retired REST API v1 (Tim: "i just received a message that rest api in runpod has been retired,
 * to use v2"). Every RunPod REST call goes through lib/runpodApi.js on https://api.runpod.io/v2 with v2 bodies; no v1 host,
 * path or field is sent anywhere. Source scan + the volume resize body. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const files = [];
for (const d of ["lib", "routes", "static", "misc", "ext"]) {
  const walk = (p) => { for (const f of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, f.name); if (f.isDirectory()) { if (!/node_modules|vendor/.test(q)) walk(q); } else if (/\.(js|py|html)$/.test(f.name)) files.push(q); } };
  walk(path.join(ROOT, d));
}
const code = (t) => t.split("\n").filter((l) => !/^\s*(\/\/|\*|#|\/\*)/.test(l)).join("\n");   // comments may name v1
const v1 = files.filter((f) => /rest\.runpod\.io/.test(code(fs.readFileSync(f, "utf8")))).map((f) => path.relative(ROOT, f));
check("no code calls RunPod's REST v1 host (rest.runpod.io)", v1.length === 0, v1);
const RA = fs.readFileSync(path.join(ROOT, "lib/runpodApi.js"), "utf8");
check("lib/runpodApi.js: the v2 base https://api.runpod.io/v2; update = PATCH only (no v1 POST /pods/{id}/update)", /"https:\/\/api\.runpod\.io\/v2"/.test(RA) && !/p \+ "\/update"/.test(RA));
const LR = fs.readFileSync(path.join(ROOT, "lib/llmRepos.js"), "utf8");
check("a bigger pod volume = v2 mounts.persistent.size (not v1 volumeInGb)", /RA\.update\(id, \{ mounts: \{ persistent: \{ size: n \} \} \}, key\)/.test(LR) && !/RA\.update\(id, \{ volumeInGb/.test(LR));
const bodies = files.filter((f) => /(gpuTypeIds|volumeInGb|containerDiskInGb|imageName)\s*:/.test(code(fs.readFileSync(f, "utf8"))) && !/runpodImage|podRevive/.test(f)).map((f) => path.relative(ROOT, f));
check("no request body with v1 field names (gpuTypeIds, volumeInGb, containerDiskInGb, imageName)", bodies.length === 0, bodies);
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
