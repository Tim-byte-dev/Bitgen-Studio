// bitGen Studio 2.904.0 - OVERRIDE STYLE IS EVERYTHING BUT WHAT THE TWO BOXES SAY (Tim: "the overide settings are not working.
// when overide is checked overide style settings even when loras and checkpoint are unchecked. all the other overide settings
// remain, size, aspect ratio,seed,cfg,sampler,scheduler will still overide style , only the unchecked values won't change the
// styles values"):
//   - routes/ltx.js: the 2.902.0 comment that sat mid-line and took ltxMode / vid with it (every LTX render failed)
//   - PAN 2 (lib/pan2.js withBasic, routes/pan2.js, static/pan2gen.js, static/samplerset.js): Basic Settings' steps / CFG /
//     seed / sampler / scheduler; the model and LoRAs only as Use model / Use temporary LoRAs send them
//   - the board (ext/videodock/characters.js scBasic, lib/renderSettings.js, lib/sceneSeed.js, lib/boardBasic.js,
//     lib/core.js): + the seed and the sampler / scheduler
// The real browser run: scripts/test-ui904-ui.js. Run: node scripts/test-904.js
"use strict";
const fs = require("fs"), path = require("path");
let ok = 0, fail = 0;
const check = (n, c, x) => { if (c) { ok++; console.log("ok   ", n); } else { fail++; console.log("FAIL ", n, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

// 1. LTX: ltxMode and vid are declared in code, not in a comment
const lx = R("routes/ltx.js").split("\n");
const decl = lx.find((l) => /ltxMode = String\(b\.ltx_mode/.test(l)) || "";
check("routes/ltx.js: ltxMode = String(b.ltx_mode ...) is code (before any // on its line)", decl && decl.indexOf("ltxMode = String(") < (decl.indexOf("//") < 0 ? Infinity : decl.indexOf("//")), decl);
const vl = lx.find((l) => /\bvid = v0 \?/.test(l)) || "";
check("routes/ltx.js: vid = v0 ? ... is code too", vl && (vl.indexOf("//") < 0 || vl.indexOf("vid = v0") < vl.indexOf("//")), vl);
// the same slip anywhere: a line comment that swallowed an assignment that the rest of the line needed
const swallowed = [];
for (const dir of ["routes", "lib"]) for (const f of fs.readdirSync(path.join(__dirname, "..", dir)).filter((x) => x.endsWith(".js"))) {
  R(dir + "/" + f).split("\n").forEach((l, i) => {
    const at = l.indexOf("   // "); if (at < 0) return;
    const code = l.slice(0, at).trim(), cm = l.slice(at);
    if (/,\s*[A-Za-z_$][\w$]*$/.test(code) && /^ +\/\/ [^\n]*= [^\n]*;\s*$/.test(cm)) swallowed.push(dir + "/" + f + ":" + (i + 1));
  });
}
check("no other line ends its declaration with ', name' and a comment holding the '= ...;' that belonged to it", swallowed.length === 0, swallowed);

// 2. PAN 2
const L = require("../lib/pan2");
const st = { id: "p2", name: "PAN 2", arch: "pan2", kind: "video", phases: [{ model: "pan2.safetensors" }], loras: [{ path: "own.safetensors", weight: 1 }], seed_mode: "random" };
const on = (o) => JSON.stringify(Object.assign({ override: true, steps: 0, cfg: null, seed: -1, model: "", loras: [] }, o));
let w = L.withBasic(st, on({ steps: 9, cfg: 3.5, seed: 777 }), { seed: "-1", steps: "0" });
check("withBasic: Override on, both boxes unticked (no model, no LoRAs sent) - steps / CFG / seed are Basic Settings'", w.steps === 9 && w.cfg === 3.5 && w.seed === 777, w);
check("...and the style keeps its own model and LoRAs", w.style.phases[0].model === "pan2.safetensors" && w.style.loras.length === 1 && w.style === st);
w = L.withBasic(st, on({ model: "pan2_other.safetensors", loras: [{ path: "temp.safetensors", weight: 0.5 }] }), {});
check("withBasic: Use model / Use temporary LoRAs ticked - the model is phase 1's, the LoRAs go after the style's", w.style.phases[0].model === "pan2_other.safetensors"
  && w.style.loras.map((l) => l.path).join() === "own.safetensors,temp.safetensors" && st.phases[0].model === "pan2.safetensors");
check("withBasic: steps 0 / CFG blank / seed -1 = the style's own (0, 0, random)", w.steps === 0 && w.cfg === 0 && w.seed === -1, w);
w = L.withBasic(st, "", { seed: "5", steps: "12", cfg: "4" });
check("withBasic: Override off - the request's own fields, as before", w.bo === null && w.seed === 5 && w.steps === 12 && w.cfg === 4 && w.style === st, w);
w = L.withBasic(Object.assign({}, st, { seed_mode: "fixed", seed: 4242 }), on({ seed: -1 }), {});
check("withBasic: Override on with a random seed - a style's fixed seed is not used (lib/seedPick override)", w.seed === -1, w);
const p = L.params({ style: L.withBasic(st, on({ steps: 9, cfg: 3.5, seed: 7, model: "m2.safetensors", loras: [{ path: "t.safetensors", weight: 0.5 }] }), {}).style,
  caption: "x", width: 640, height: 384, seconds: 2, steps: 9, cfg: 3.5, seed: 7 });
check("params: the job renders the override's model + both LoRAs at 640x384, 9 steps, CFG 3.5, seed 7", p.model === "m2.safetensors" && p.loras.length === 2 && p.width === 640 && p.height === 384 && p.steps === 9 && p.cfg === 3.5 && p.seed === 7, p);
const rp = R("routes/pan2.js");
check("routes/pan2.js: the job is made from withBasic (style, seed, steps, cfg) and logs what the override decided",
  /const ov = L\(\)\.withBasic\(st, b\.basic, b\)/.test(rp) && /style: ov\.style/.test(rp) && /seed: ov\.seed, steps: ov\.steps, cfg: ov\.cfg/.test(rp) && /note\(bo, "PAN 2"\)/.test(rp));
const pg = R("static/pan2gen.js");
check("static/pan2gen.js: Generate sends Basic Settings' Override (H3Basic.json - the boxes decide the model / LoRAs)", /fd\.append\("basic", root\.H3Basic\.json\(\)\)/.test(pg));
const SS = require("../static/samplerset.js");
check("samplerset: PAN 2's render carries the sampler / scheduler header, its caption call does not", SS.kindOfUrl("/api/pan2") === "video" && SS.kindOfUrl("http://studio.example:8311/api/pan2?x=1") === "video"
  && SS.kindOfUrl("/api/pan2/caption") === "" && SS.kindOfUrl("/api/generate") === "video" && SS.kindOfUrl("/api/genimage") === "image");
const pw = R("misc/pan2_worker.py");
check("pan2_worker: its [meta] says the sampler / scheduler it was given", /os\.environ\.get\("BITGEN_SAMPLER"\)/.test(pw) && /"sampler": smp \+ " \/ " \+ sch/.test(pw) && /^import os$/m.test(pw));

// 3. the board
const RS = require("../lib/renderSettings");
const bp = RS.basicPatch({ override: true, steps: 9, cfg: 3, seed: 55, sampler: "euler", scheduler: "karras", model: "", width: 640, height: 384 });
check("basicPatch: + the seed and the sampler / scheduler", bp.basic_seed === 55 && bp.basic_sampler === "euler" && bp.basic_scheduler === "karras" && bp.basic_steps === 9 && bp.basic_width === 640, bp);
const bad = RS.basicPatch({ override: true, seed: "x", sampler: "eu ler;rm", scheduler: "<b>" });
check("basicPatch: junk is the style's own (seed -1, no sampler)", bad.basic_seed === -1 && bad.basic_sampler === "" && bad.basic_scheduler === "", bad);
const nz = RS.normalize({ basic_override: true, basic_seed: "12", basic_sampler: "dpmpp_2m", basic_scheduler: "" });
check("normalize: keeps them (defaults: -1, '', '')", nz.basic_seed === 12 && nz.basic_sampler === "dpmpp_2m" && RS.normalize({}).basic_seed === -1 && RS.normalize({}).basic_sampler === "", nz);
const BB = require("../lib/boardBasic");
check("boardBasic.pickFor: Override on + a pick -> it; off, or nothing picked -> null", JSON.stringify(BB.pickFor({ basic_override: true, basic_sampler: "euler", basic_scheduler: "" })) === '{"sampler":"euler","scheduler":""}'
  && BB.pickFor({ basic_override: false, basic_sampler: "euler" }) === null && BB.pickFor({ basic_override: true }) === null);
const core = require("../lib/core");
const P = "zz_t904_" + process.pid, orig = core.getProject();
core.ensureProject(P); core.setProject(P);
const pd = core.projDir(P);
try {
  const scenes = require("../lib/scenes"), Seed = require("../lib/sceneSeed");
  let s0 = scenes.load(P);
  s0.list = [{ n: 1, id: "clip_01", prompt: ["a"], status: "idle" }, { n: 2, id: "clip_02", prompt: ["b"], status: "idle" }];
  scenes.save(s0, P);
  RS.rememberBasic(pd, { override: true, steps: 9, cfg: 3, seed: 555, sampler: "euler", scheduler: "karras", model: "" });
  RS.save(pd, { seed_mode: "same", seed: 111 });
  check("seedFor: Override on + a seed - it beats the ⚙'s same seed", Seed.seedFor(P, scenes.at(scenes.load(P), 2), -1).seed === 555, Seed.seedFor(P, scenes.at(scenes.load(P), 2), -1));
  Seed.setSceneSeed(P, 1, 4242);
  check("...a scene's own seed (its card) still wins", Seed.seedFor(P, scenes.at(scenes.load(P), 1), -1).seed === 4242);
  RS.rememberBasic(pd, { override: true, steps: 9, cfg: 3, seed: -1, sampler: "euler", scheduler: "karras", model: "" });
  check("...Override's seed -1 (random) leaves the ⚙'s rule", Seed.seedFor(P, scenes.at(scenes.load(P), 2), -1).seed === 111);
  RS.rememberBasic(pd, { override: false, steps: 9, cfg: 3, seed: 555, sampler: "euler", scheduler: "karras", model: "" });
  check("...Override off: the ⚙'s rule", Seed.seedFor(P, scenes.at(scenes.load(P), 2), -1).seed === 111);
  RS.rememberBasic(pd, { override: true, steps: 9, cfg: 3, seed: -1, sampler: "euler", scheduler: "karras", model: "" });
  const prm = { scene: { n: 2 }, seed: -1 };
  const note = BB.beforeJob(prm, P);
  check("beforeJob: a board job gets the kept sampler / scheduler (comfy_sampler) and says so", prm.comfy_sampler && prm.comfy_sampler.sampler === "euler" && prm.comfy_sampler.scheduler === "karras" && /sampler euler, scheduler karras/.test(note), [prm, note]);
  const own = { scene: { n: 2 }, comfy_sampler: { sampler: "lcm", scheduler: "" } };
  check("...a render that brought its own pick keeps it; a job that is not the board's gets nothing", BB.beforeJob(own, P) === null && own.comfy_sampler.sampler === "lcm" && BB.beforeJob({ mode: "t2va" }, P) === null);
  RS.rememberBasic(pd, { override: false, steps: 9, cfg: 3, seed: -1, sampler: "euler", scheduler: "karras", model: "" });
  check("...Override off: nothing", BB.beforeJob({ scene: { n: 2 } }, P) === null);
} finally {
  core.setProject(orig);
  fs.rmSync(pd, { recursive: true, force: true });
}
const cj = R("lib/core.js");
check("core.makeJob asks lib/boardBasic before the header's pick", /require\("\.\/boardBasic"\)\.beforeJob\(params, proj\)/.test(cj) && cj.indexOf('require("./boardBasic")') < cj.indexOf('require("./samplers").current()'));
const ch = R("ext/videodock/characters.js");
check("the board's ▶ sends Basic Settings' seed and sampler / scheduler with Override", /out\.seed = sd && sd\.value !== "" \? parseInt\(sd\.value, 10\) : -1;/.test(ch) && /W\.H3Samplers\.pick\("video"\)/.test(ch) && /out\.sampler = sp \? sp\.sampler : ""; out\.scheduler = sp \? sp\.scheduler : "";/.test(ch));

// 4. the paths that already did it stay as they are: the boxes only gate the model and the LoRAs
const ix = R("static/index.html");
const ib = ix.slice(ix.indexOf("function imgBasicsBody(body)"), ix.indexOf("window.imgBasicsBody = imgBasicsBody;"));
check("imgBasicsBody: size / steps / CFG / seed are sent with Override whatever the boxes say; Use model / Use temporary LoRAs gate only the checkpoint / LoRAs",
  /if \(wh\) \{ body\.width = wh\.width; body\.height = wh\.height; \}/.test(ib) && /body\.steps = /.test(ib) && /body\.cfg = /.test(ib) && /body\.seed = /.test(ib)
  && (ib.match(/useMD\(|useTL\(/g) || []).length === 2 && /if \(ck && useMD\("image"\)\) body\.model = ck;/.test(ib));
const bs = R("static/basicset.js");
check("basicset collect: steps / CFG / seed always; the model and LoRAs by the boxes", /steps: st \? parseInt\(st\.value, 10\) \|\| 0 : 0,/.test(bs) && /seed: sd && sd\.value !== ""/.test(bs) && /H3OvrUse\.model\("video"\)/.test(bs) && /H3OvrUse\.loras\("video"\)/.test(bs));

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
