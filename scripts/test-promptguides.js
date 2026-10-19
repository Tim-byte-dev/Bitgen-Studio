#!/usr/bin/env node
// lib/promptGuides.js — the prompting guides the LLMs are taught (2.104.0).
// node scripts/test-promptguides.js
const fs = require("fs"), os = require("os"), path = require("path");
const G = require(path.join(__dirname, "..", "lib", "promptGuides"));
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

const all = G.load();
const ids = all.map((g) => g.id);
check("the seven requested families ship (plus qwen-image, which the app also runs)",
  ["minimax_h3", "minimax_music", "flux_klein", "sdxl", "pony", "illustrious", "z_image", "qwen_image"].every((i) => ids.includes(i)), ids);
check("every guide has rules and one example", all.every((g) => Array.isArray(g.rules) && g.rules.length >= 4 && g.example), all.map((g) => [g.id, (g.rules || []).length]));
const p = (sel) => (G.pick(all, sel) || {}).id;
check("SDXL arch + a Pony file name -> pony", p({ kind: "image", arch: "sdxl", model: "ponyDiffusionV6XL.safetensors" }) === "pony", null);
check("SDXL arch + an Illustrious / NoobAI file name -> illustrious",
  p({ kind: "image", arch: "sdxl", model: "illustriousXL_v01.safetensors" }) === "illustrious" && p({ kind: "image", arch: "sdxl", model: "noobaiXL.safetensors" }) === "illustrious", null);
check("SDXL arch + a plain fine-tune -> sdxl", p({ kind: "image", arch: "sdxl", model: "juggernautXL_v9.safetensors" }) === "sdxl", null);
check("flux2klein9b -> flux_klein; z-image -> z_image; qwen-image -> qwen_image",
  p({ kind: "image", arch: "flux2klein9b", model: "x.safetensors" }) === "flux_klein" && p({ kind: "image", arch: "z-image", model: "" }) === "z_image" && p({ kind: "image", arch: "qwen-image", model: "" }) === "qwen_image", null);
check("video always gets the H3 guide, music always the MiniMax Music guide",
  p({ kind: "video" }) === "minimax_h3" && p({ kind: "music", arch: "music3" }) === "minimax_music", null);
check("an unknown image arch gets NO guide (no guessing)", G.pick(all, { kind: "image", arch: "sd15", model: "dreamlike.ckpt" }) === null, null);
const t = G.render(G.pick(all, { kind: "video" }));
check("render: a titled block with dash rules and a fenced example",
  /^PROMPTING GUIDE — MiniMax H3/.test(t) && /\n- /.test(t) && /```\n[\s\S]+\n```$/.test(t), t.slice(0, 80));
check("the H3 guide teaches <Picture n>, single continuous shot, CUT n: for cuts, and forbids time ranges",
  /<Picture 1>/.test(t) && /continuous take/.test(t) && /CUT 1:/.test(t) && /time ranges/.test(t), null);
const py = G.render(G.pick(all, { kind: "image", arch: "sdxl", model: "pony.safetensors" }));
check("the Pony guide starts with score tags and a rating; Illustrious forbids them",
  /score_9, score_8_up, score_7_up/.test(py) && /rating_safe/.test(py)
  && /NO Pony score_ tags/.test(G.render(G.pick(all, { kind: "image", arch: "sdxl", model: "illustrious.safetensors" }))), null);
// user override at styles/prompt-guides.json replaces by id
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pg-"));
fs.writeFileSync(path.join(dir, "prompt-guides.json"), JSON.stringify({ guides: [
  { id: "sdxl", kind: "image", label: "My SDXL", match: ["sdxl"], rules: ["a", "b", "c", "d"], example: "e" },
  { id: "mine", kind: "image", label: "Mine", match: ["mymodel"], rules: ["x", "y", "z", "w"], example: "q" }] }));
const ov = G.load(dir);
check("an override file replaces a guide by id and can add a new family",
  ov.find((g) => g.id === "sdxl").label === "My SDXL" && ov.some((g) => g.id === "mine") && ov.find((g) => g.id === "pony"), ov.map((g) => g.id));
check("...and guideFor() uses it", /My SDXL/.test(G.guideFor(dir, { kind: "image", arch: "sdxl", model: "juggernaut" })), null);
// ---- VR SBS ADDENDA (2.118.0, Tim: "when i ask the llm for a sbs vr video,
// please help it develop the prompt, do not mirror, needs to be for vr") ----
// matched on the USER'S OWN TEXT, kind-gated, never on the selected style
const hit = (txt, kind) => G.matchAddenda(G.loadAddenda(null), kind || "video", txt).map((a) => a.id);
check("addenda: 'sbs vr video' fires vr_sbs", JSON.stringify(hit("make me a sbs vr video of a turtle")) === '["vr_sbs"]', hit("make me a sbs vr video of a turtle"));
check("addenda: a bare 'for VR' fires", hit("I want this for VR").length === 1, null);
check("addenda: 'stereoscopic' fires", hit("stereoscopic 3d please").length === 1, null);
check("addenda: 'side by side 3d' fires", hit("render it side by side 3d").length === 1, null);
check("addenda: 'stereo sound' does NOT fire (the H3 guide's own words must never trigger it)", hit("a car with punchy stereo sound").length === 0, null);
check("addenda: 'two dogs side by side' does NOT fire", hit("two dogs sitting side by side on a porch").length === 0, null);
check("addenda: 'side by side with stereo sound' does NOT fire (scene + audio, not a format — the e2e's adversarial phrase)", hit("two dogs side by side with stereo sound").length === 0, null);
check("addenda: 'side by side stereo' (no sound word) still fires", hit("side by side stereo of a reef").length === 1, null);
check("addenda: a vr HEADSET as a prop does NOT fire", hit("a man wearing a vr headset in a cafe").length === 0, null);
check("addenda: kind-gated — an image request never gets the video addendum", hit("sbs vr", "image").length === 0, null);
check("addenda: empty text is quiet", hit("").length === 0, null);
const ax = G.addendaFor(null, "video", "sbs vr please");
check("addenda: the rendered block carries the no-mirror rule, the 6.5 cm offset and a full example",
  ax.includes("NEVER A MIRROR") && ax.includes("6.5 cm") && ax.includes("centre seam") && /Example of a good prompt/.test(ax), null);
check("addenda: guideFor() itself is unchanged (the guide and the addendum are separate blocks)",
  !G.guideFor(null, { kind: "video", arch: "h3", model: "" }).includes("NEVER A MIRROR"), null);
// override file replaces an addendum by id and can add a new one
const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "pg-"));
fs.writeFileSync(path.join(dir2, "prompt-guides.json"), JSON.stringify({ addenda: [
  { id: "vr_sbs", kind: "video", label: "My VR", match_text: ["\\bsbs\\b"], rules: ["only mine"] },
  { id: "underwater", kind: "video", label: "UW", match_text: ["\\bunderwater\\b"], rules: ["housing"] }] }));
check("addenda: the styles override replaces by id and can add new addenda",
  G.addendaFor(dir2, "video", "sbs").includes("only mine")
  && !G.addendaFor(dir2, "video", "sbs").includes("NEVER A MIRROR")
  && G.addendaFor(dir2, "video", "underwater shot").includes("housing"), G.addendaFor(dir2, "video", "sbs"));
// ---- vr_360 (2.119.0, Tim: "is it possible to make a 360 vr video") ----
check("addenda: '360 vr video' fires vr_360 ONLY (not the SBS stereo addendum)",
  JSON.stringify(hit("make me a 360 vr video of a meadow")) === '["vr_360"]', hit("make me a 360 vr video of a meadow"));
check("addenda: 'equirectangular' fires vr_360", JSON.stringify(hit("an equirectangular render")) === '["vr_360"]', null);
check("addenda: '360\u00b0 video' fires vr_360", hit("a 360\u00b0 video of the market").includes("vr_360"), null);
check("addenda: 'sbs vr' still fires ONLY the stereo addendum", JSON.stringify(hit("a sbs vr clip")) === '["vr_sbs"]', hit("a sbs vr clip"));
check("addenda: 'the camera orbits 360 degrees' does NOT fire (a move, not a format)", hit("the camera orbits 360 degrees around her").length === 0, null);
check("addenda: 'xbox 360' does NOT fire", hit("an xbox 360 on a shelf").length === 0, null);
check("addenda: 'spins a full 360' does NOT fire", hit("he spins a full 360 on the board").length === 0, null);
check("addenda: the vr_360 rules carry the seam, pole, no-camera-move and 2:1 teachings",
  (() => { const x = G.addendaFor(null, "video", "a 360 vr video");
    return x.includes("edges connect seamlessly") && x.includes("poles") === false
      ? false : x.includes("middle band") && x.includes("NO camera moves") && x.includes("2:1"); })(), null);
// ---- continuous_video (2.126.0, Tim: "teach the llm how to make continuous
// videos with unlimited time"). The negative cases are the point: a single-clip
// direction must NOT drag in the whole chaining lecture.
check("addenda: 'a 3 minute video' fires continuous_video",
  JSON.stringify(hit("make me a 3 minute video of a viking story")) === '["continuous_video"]',
  hit("make me a 3 minute video of a viking story"));
check("addenda: 'continuous video' fires it", hit("i want a continuous video that never ends").includes("continuous_video"), null);
check("addenda: 'unlimited length' fires it", hit("a video of unlimited length").includes("continuous_video"), null);
check("addenda: 'longform' fires it", hit("a longform music video").includes("continuous_video"), null);
check("addenda: 'chain several clips' fires it", hit("chain several clips together").includes("continuous_video"), null);
check("addenda: 'continue the scene' fires it", hit("continue the scene from the last clip").includes("continuous_video"), null);
check("addenda: a duration OVER the ceiling fires it", hit("a 45 second video of a dog").includes("continuous_video"), null);
check("addenda: a duration UNDER the ceiling does NOT (one generation covers it)",
  hit("a 12 second video of a dog").length === 0, hit("a 12 second video of a dog"));
check("addenda: 'one continuous take' does NOT fire (that is a SINGLE clip)",
  hit("One continuous take, single shot, no cuts, of a woman on a boardwalk").length === 0,
  hit("One continuous take, single shot, no cuts, of a woman on a boardwalk"));
check("addenda: 'one continuous shot' does NOT fire", hit("one continuous shot of a car").length === 0, null);
check("addenda: 'a continuous pan' does NOT fire (a camera move)",
  hit("the camera does a continuous pan across the valley").length === 0, null);
check("addenda: the rules teach the ceiling, the tail-frame chain and identical wording",
  (() => { const x = G.addendaFor(null, "video", "a 3 minute video");
    return /15 s/.test(x) && /LAST FRAMES/.test(x) && /SAME wording/.test(x)
      && /one prompt per shot/i.test(x); })(), null);
check("addenda: the example is a numbered shot list that carries continuity forward",
  (() => { const x = G.addendaFor(null, "video", "a 3 minute video");
    return x.includes("[Shot 1]") && x.includes("[Shot 2]") && x.includes("Continuing from the previous frame"); })(), null);
check("the H3 guide itself now points at the chain rather than stopping at the ceiling",
  /LONGER THAN 15 s IS A CHAIN/.test(G.guideFor(null, { kind: "video", arch: "h3", model: "" }) || ""), null);

check("addenda: a broken regex source is skipped, not thrown",
  G.matchAddenda([{ id: "x", kind: "video", match_text: ["(["], rules: [] }], "video", "anything").length === 0, null);

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
