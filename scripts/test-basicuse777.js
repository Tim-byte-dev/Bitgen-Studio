#!/usr/bin/env node
/* bitGen Studio — 2.777.0: BASIC SETTINGS ▸ "USE MODEL" / "USE TEMPORARY LORAS" (lib/basicUse.js, static/ovruse.js, the request
 * body gates) + THE POD DOCKER'S "⬆ NODES ITS STYLES NEED" / "⬆ UPDATE COMFYUI" BUTTONS GONE (the pod's setup does both).
 * Tim (verbatim): "i think we can remove styles this pod needs and update comfyui buttons from the pods docker, bitgen does this
 * automaically when the pod is created. add a checkbox over the checkpoint "Use Model", and another over loras "Use Temporary
 * Lora's this will allow the style to be more versatile, we can send overide settings without changing the base model or use
 * loras if we want with the styles model or the overide model" */
"use strict";
const fs = require("fs"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
let CFG = {};
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; } });
const B = require("../lib/basicUse");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

check("default: all four on (as before)", JSON.stringify(B.get()) === '{"image_model":true,"image_loras":true,"video_model":true,"video_loras":true}', B.get());
B.set({ video_loras: false });
check("set one flag: saved in config.basic_use, the others stay on", CFG.basic_use.video_loras === false && CFG.basic_use.image_loras === true && !B.loras("video") && B.loras("image") && B.model("video"));
B.set({ image_model: 0, junk: 1 });
check("…unknown keys ignored, values made true / false", !B.model("image") && !("junk" in CFG.basic_use) && CFG.basic_use.image_model === false);
let routes = {}; B.mount({ get: (p, f) => { routes["GET " + p] = f; }, post: (p, f) => { routes["POST " + p] = f; } });
let out; routes["POST /api/basic-use"]({ body: { video_loras: true } }, { json: (j) => { out = j; }, status: () => ({ json: (j) => { out = j; } }) });
check("POST /api/basic-use sets and answers the four flags; GET reads them", out && out.video_loras === true && out.image_model === false && typeof routes["GET /api/basic-use"] === "function");
check("mounted from routes/index.js (not server.js)", /require\("\.\.\/lib\/basicUse"\)\.mount\(app\)/.test(rd("routes/index.js")) && !/basicUse/.test(rd("misc/server.js")));

const O = require("../static/ovruse.js");
check("ovruse: four boxes - Use model over the checkpoint / video model, Use temporary LoRAs over each LoRA list",
  O.SPOTS.map((s) => s[1] + ":" + s[3]).join(",") === "useImgModel:imgCkptCombo,useImgLoras:tliAdd,useVidModel:vidModel,useVidLoras:tlvAdd");
check("ovruse fieldsOf: on unless false (a missing answer = all on)", O.fieldsOf(null).image_model === true && O.fieldsOf({ video_model: false }).video_model === false);

const H = rd("static/index.html");
check("index.html loads ovruse.js and asks it before sending the checkpoint / the temporary LoRAs",
  /<script src="\/static\/ovruse\.js">/.test(H) && /function useTL\(kind\)/.test(H) && /function useMD\(kind\)/.test(H)
  && /if \(ck && useMD\("image"\)\) body\.model = ck;/.test(H) && (H.match(/useTL\("video"\)/g) || []).length >= 3 && /useTL\("image"\) \? tempLoras\("image"\)/.test(H));
check("basicset.js / lorasel.js / videodock characters ask it too; the server's scene renders read the flag",
  /H3OvrUse\.loras\("video"\)/.test(rd("static/basicset.js")) && /H3OvrUse\.model\("video"\)/.test(rd("static/basicset.js"))
  && /root\.H3OvrUse\.loras\(k\)/.test(rd("static/lorasel.js")) && /H3OvrUse/.test(rd("ext/videodock/characters.js"))
  && (rd("routes/characters.js").match(/basicUse"\)\.loras\("video"\)/g) || []).length >= 3);
check("basic.cfg leaves the boxes alone (.ovrUse in its SKIP - put back from the file they undid an untick)", require("../static/basiccfg.js").SKIP.includes(".ovrUse"));
const P = rd("static/podsetup.js");
check("pod docker: ⬆ Nodes its styles need / ⬆ Update ComfyUI buttons gone (routes kept for the setup)",
  !/data-psnodes|data-pscomfy/.test(P) && /stylepods\/nodes/.test(rd("routes/index.js") + rd("lib/stylePods.js") + fs.readdirSync(path.join(ROOT, "routes")).map((f) => rd("routes/" + f)).join("")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
