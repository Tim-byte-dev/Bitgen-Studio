#!/usr/bin/env node
/* bitGen Studio — 2.781.0: BASIC SETTINGS ▸ SAMPLER / SCHEDULER. lib/samplers.js (the lists, the request's pick -> the job ->
 * the worker's environment), static/samplerset.js (the rows, the header on a render), scripts/comfy_client.py (written into the
 * graph - scripts/test-samplers781.py, run from here). Tim (verbatim): "want to stry different models - choose a style and use
 * the basic settings docker to quickly change your model, add loras or change the sampler settings ... please add a list of
 * samplers to the basic settings docker above the checkpoint dropdowns." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const S = require("../lib/samplers"), UI = require("../static/samplerset.js");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

(async () => {
  check("clean: ComfyUI-looking names only; both 'style's own' = nothing", JSON.stringify(S.clean({ sampler: "dpmpp_2m", scheduler: "karras" })) === '{"sampler":"dpmpp_2m","scheduler":"karras"}'
    && JSON.stringify(S.clean('{"sampler":"euler"}')) === '{"sampler":"euler","scheduler":""}' && S.clean({ sampler: "a b;rm", scheduler: "" }) === null && S.clean({}) === null && S.clean("junk") === null);
  check("comboOf: both /object_info shapes", S.comboOf([["a", "b"], {}]).join() === "a,b" && S.comboOf(["COMBO", { options: ["x"] }]).join() === "x" && S.comboOf(null).length === 0);
  let asked = [];
  const ok = await S.list({ refresh: true, urls: ["http://pod", "http://local"], fetch: async (u) => { asked.push(u); if (/pod/.test(u)) return { ok: false }; return { ok: true, json: async () => ({ KSampler: { input: { required: { sampler_name: [["euler", "my_new_sampler"]], scheduler: [["simple", "karras"]] } } } }) }; } });
  check("the lists: ComfyUI's own (the first that answers - the pod in use, then this computer's)", ok.from === "comfyui" && ok.samplers.join() === "euler,my_new_sampler" && ok.schedulers.join() === "simple,karras" && ok.url === "http://local" && asked.length === 2, ok);
  const bi = await S.list({ refresh: true, urls: ["http://none"], fetch: async () => { throw new Error("down"); } });
  check("…no ComfyUI answering: ComfyUI's standard names", bi.from === "builtin" && bi.samplers.includes("dpmpp_2m_sde") && bi.schedulers.includes("karras") && bi.samplers.length > 30);

  // the request's pick reaches the job - a JSON body and a multipart upload (the video render's FormData)
  const express = require("express"), multer = require("multer");
  const app = express(); app.use(express.json()); app.use(S.middleware);
  const got = {};
  app.post("/j", (req, res) => Promise.resolve().then(() => { got.j = S.current(); res.json({}); }));
  app.post("/m", multer({ storage: multer.memoryStorage() }).any(), (req, res) => setTimeout(() => { got.m = S.current(); res.json({}); }, 5));
  app.post("/n", (req, res) => { got.n = S.current(); res.json({}); });
  const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const B = "http://127.0.0.1:" + srv.address().port, H = { "X-Bitgen-Sampler": '{"sampler":"dpmpp_2m","scheduler":"karras"}' };
  await fetch(B + "/j", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: "{}" });
  const fd = new FormData(); fd.append("a", "1"); fd.append("file", new Blob(["x".repeat(300000)]), "ref.png");
  await fetch(B + "/m", { method: "POST", headers: H, body: fd });
  await fetch(B + "/n", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  srv.close();
  check("the header's pick is the request's (JSON) and survives a multipart upload (the video render's FormData)", got.j && got.j.sampler === "dpmpp_2m" && got.m && got.m.scheduler === "karras", got);
  check("…no header: none", got.n === null, got.n);
  check("the job keeps it (lib/core.js makeJob -> params.comfy_sampler + a log line) and its worker gets BITGEN_SAMPLER / BITGEN_SCHEDULER",
    /require\("\.\/samplers"\)\.current\(\)/.test(rd("lib/core.js")) && /params\.comfy_sampler = sp/.test(rd("lib/core.js")) && /\.\.\.require\("\.\/samplers"\)\.envOf\(job\.params\)/.test(rd("lib/core.js"))
    && JSON.stringify(S.envOf({ comfy_sampler: { sampler: "euler", scheduler: "" } })) === '{"BITGEN_SAMPLER":"euler","BITGEN_SCHEDULER":""}' && JSON.stringify(S.envOf({})) === "{}");
  check("routes: the middleware + GET /api/samplers from routes/index.js (after the JSON parser; not server.js)", /app\.use\(require\("\.\.\/lib\/samplers"\)\.middleware\)/.test(rd("routes/index.js")) && /require\("\.\.\/lib\/samplers"\)\.mount\(app\)/.test(rd("routes/index.js")) && !/samplers/.test(rd("misc/server.js")));

  // the page
  check("page: which renders carry it - pictures (/api/genimage, /api/aiedit…) and video (/api/generate, /api/ltx); nothing else",
    UI.kindOfUrl("/api/genimage") === "image" && UI.kindOfUrl("http://x:1/api/aiedit/compose?a=1") === "image" && UI.kindOfUrl("/api/generate") === "video" && UI.kindOfUrl("/api/ltx") === "video" && UI.kindOfUrl("/api/genmusic") === "" && UI.kindOfUrl("/api/generated") === "");
  check("…the header: both style's own = none; a kept pick ComfyUI no longer lists stays shown", UI.headerOf({ sampler: "", scheduler: "" }) === "" && UI.headerOf({ sampler: "euler" }) === '{"sampler":"euler","scheduler":""}' && UI.merge(["a"], "z").join() === "z,a" && UI.merge(["a"], "a").join() === "a");
  const P = rd("static/samplerset.js");
  check("…the rows above the checkpoint / video model (above the Use model tick); only while Override style is on", /\["image", "imgSampler", "imgScheduler", "useImgModel", "imgCkptCombo"\]/.test(P) && /\["video", "vidSampler", "vidScheduler", "useVidModel", "vidModel"\]/.test(P) && /root\.ovrStyleOn\(\)/.test(P) && /<script src="\/static\/samplerset\.js">/.test(rd("static/index.html")));
  check("the standard names agree (lib/samplers.js = static/samplerset.js)", JSON.stringify(S.BUILTIN) === JSON.stringify(UI.BUILTIN));

  const py = require("child_process").spawnSync("python3", [path.join(__dirname, "test-samplers781.py")], { encoding: "utf8" });
  check("scripts/test-samplers781.py (written into the graph): " + ((py.stdout || "").trim().split("\n").pop() || py.error), py.status === 0, (py.stdout || "") + (py.stderr || ""));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
