#!/usr/bin/env node
/* bitGen Studio — 2.763.2 units: a render that goes to a RunPod pod skips this computer's ComfyUI (lib/stylePods.js willUsePod,
 * GET /api/stylepods/route, routes/modelsFound.js, static/podroute.js, index.html) and a failed render says why.
 * Tim (his log): "[comfy] launching via run.bat … [generate] Image · house — that one failed." */
"use strict";
const fs = require("fs"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let CFG = { rgpu: { enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" } } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: "/nonexistent", BASE: ROOT, resolvePath: (p) => path.resolve(p) };
require.cache[coreP] = fake;
const SP = require("../lib/stylePods"), PR = require("../static/podroute.js");
const st = { id: "s1", name: "Krea", kind: "image", engine: "comfy" }, vs = { id: "v1", name: "H3", kind: "video", engine: "comfy" };
check("willUsePod: Remote + Pods = a pod for image, video and song styles; a P_ style = a pod; API_ / R_ styles = not",
  SP.willUsePod("image", st).pod && SP.willUsePod("t2va", vs).pod && SP.willUsePod("music", { id: "m", kind: "music" }).pod && SP.willUsePod("image", { runs_on: "pod" }).pod
  && !SP.willUsePod("image", { id: "a", runs_on: "api" }).pod && !SP.willUsePod("image", { id: "r", runs_on: "remote" }).pod && !SP.willUsePod("image", null).pod);
CFG.rgpu.split = { where: "both" };
check("…Both: only with the box ticked or a pod for the style / its kind", !SP.willUsePod("image", st).pod && (CFG.rgpu.split.image = true, SP.willUsePod("image", st).pod)
  && (CFG.rgpu.split = { where: "both" }, CFG.rgpu.pod_cfg = { p1: { kinds: ["image"] } }, SP.willUsePod("image", st).pod) && !SP.willUsePod("t2va", vs).pod);
CFG.rgpu.split = { where: "local" };
check("…Local, or Remote generation off, or Serverless = never", !SP.willUsePod("image", st).pod && (CFG.rgpu.split = { where: "remote" }, CFG.rgpu.enabled = false, !SP.willUsePod("image", st).pod)
  && (CFG.rgpu.enabled = true, CFG.rgpu.engine = { provider: "runpod", runpod: "serverless" }, !SP.willUsePod("image", st).pod));
check("reasonLines: the [pod] / [gpu] lines and error-looking ones, the last few", JSON.stringify(PR.reasonLines(["[worker] start", "[pod] checking the pod", "[gpu] x renders on RunPod pod p", "ok", "[pod] the pod for Krea is gone", "Traceback (most recent call last):", "[bitgen-studio] worker exited with code 1."], 3))
  === JSON.stringify(["[pod] the pod for Krea is gone", "Traceback (most recent call last):", "[bitgen-studio] worker exited with code 1."]));
const H = rd("static", "index.html"), RT = rd("routes", "stylePods.js"), MF = rd("routes", "modelsFound.js");
check("index.html: image / video / song / swap / LTX renders ask H3PodRoute first and then neither start this computer's ComfyUI nor check the style against its dropdowns",
  /const onPod = window\.H3PodRoute \? await H3PodRoute\.isPod\("image", id\) : false;/.test(H) && /if \(!onPod && \(st\.engine \|\| "comfy"\) === "comfy"/.test(H) && /const why = onPod \? null : await comfyPreflight\(st\);/.test(H)
  && /if \(!onPodV && !\(await ensureComfyReady\(\)\)\) return;/.test(H) && /const why = onPodM \? null : await comfyPreflight\(st\);/.test(H) && (H.match(/H3PodRoute\.isPod\("t2va"/g) || []).length === 3
  && /<script src="\/static\/podroute\.js"><\/script>/.test(H));
check("index.html: 'that one failed' is followed by the job's reason (H3PodRoute.why), or says it was never sent", /H3PodRoute\.why\(it\.jobId\)\.then/.test(H) && /it was not sent - see the message above/.test(H));
check("routes: GET /api/stylepods/route; the models-not-found check skips a style that renders on a pod", /app\.get\("\/api\/stylepods\/route"/.test(RT) && /willUsePod\(kind === "music"/.test(MF));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
