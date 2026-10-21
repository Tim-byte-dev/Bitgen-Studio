#!/usr/bin/env node
/* bitGen Studio — 2.568.0 units: the storyboard picture written by the LLM from its scene, with the character and the
 * scene before's last frame as references (lib/storyboard.js roleOf / llmMessages / cleanPrompt, lib/storyboardPlan.js
 * plan); changing it (routes/storyboard.js /set /upload, the scene picker's slot "sb"); the whole card is the picture
 * (ext/videodock/sbgrid.js).
 * Tim: "in the scene editor send the scene created by the llm back to the llm to create an image for the scene thumbnail -
 * reference image will be character and last frame of previous video if the previous video doesn't exist it will be of the
 * character + scene description - this image can be changed - make the entire card the thumnail because we get the scene
 * frame when we click the thumbnail anyway" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const SB = require(path.join(ROOT, "lib", "storyboard.js"));
const SP = require(path.join(ROOT, "lib", "storyboardPlan.js"));
const G = require(path.join(ROOT, "ext", "videodock", "sbgrid.js"));
const core = require(path.join(ROOT, "lib", "core.js"));
const scenes = require(path.join(ROOT, "lib", "scenes.js"));

(async () => {
  /* 1 the pieces */
  check("roleOf: the scene before's frame, a character sheet, a location, a scene's / the film's reference picture - in words",
    /scene 1's last frame - the moment just before this scene/.test(SB.roleOf("images/sb_prev_c2.png", "Previous scene", "scene 1's last frame")) && SB.roleOf("characters/m/a.png", "Characters · Mara") === "Mara's character sheet (how Mara looks)"
    && SB.roleOf("locations/x/v.png", "Locations · The Docks") === "the location The Docks" && /this scene/.test(SB.roleOf("scene_refs/c2/r.png", "Scene refs")) && /the film/.test(SB.roleOf("refs/a.png", "References")));
  const m1 = SB.llmMessages({ roles: ["scene 1's last frame …", "Mara's character sheet"], sceneText: "Mara climbs", prevText: "Mara walks", hasPrev: true, prefix: "A noir film." });
  const m2 = SB.llmMessages({ roles: ["Mara's character sheet"], sceneText: "Mara climbs", hasPrev: false });
  check("llmMessages: the opening frame of THIS scene, the pictures as Picture n, one paragraph, a still (no camera moves); with the scene before's frame = continue from it, without = the place from the scene's words",
    /OPENING FRAME/.test(m1[0].content) && /Picture 1 = scene 1's last frame/.test(m1[1].content) && /Picture 2 = Mara's character sheet/.test(m1[1].content) && /continues from that moment/.test(m1[0].content)
    && /The scene before:\nMara walks/.test(m1[1].content) && /A noir film\./.test(m1[1].content) && /This scene:\nMara climbs$/.test(m1[1].content)
    && /no frame of a previous scene: describe the place from this scene's words/.test(m2[0].content) && !/The scene before/.test(m2[1].content) && /no camera moves/.test(m2[0].content));
  check("cleanPrompt: no think block / fence / \"Prompt:\" / quotes / markdown; Picture n kept only for pictures sent (<image1> -> Picture 1); a JSON answer = nothing",
    SB.cleanPrompt('<think>hm</think>```\nPrompt: "**Mara** from <image2> climbs Picture 1, picture 7."\n```', 2) === "Mara from Picture 2 climbs Picture 1, the picture."
    && SB.cleanPrompt('{ "shots": [] }', 2) === "" && SB.cleanPrompt('Here: {"prompt": "x"}', 1) === "");

  /* 2 plan(): a real project board; the LLM and the frame grab stand in */
  const P = "__t568_sbplan", d = core.projDir(P);
  try {
    fs.mkdirSync(path.join(d, "characters", "mara"), { recursive: true });
    fs.writeFileSync(path.join(d, "characters", "mara", "Mara.profile"), "{}");
    fs.copyFileSync(path.join(ROOT, "static", "pose-sheets", "human.png"), path.join(d, "characters", "mara", "sheet.png"));
    scenes.save(scenes.safe({ plan: { prompt_prefix: "A rainy noir." }, list: [{ n: 1, id: "c1", prompt: ["[Shot 1] Mara walks through the market"] }, { n: 2, id: "c2", prompt: ["[Shot 2] Mara climbs the fire escape"] }] }), P);
    const asked = [];
    const llm = (text) => async (m) => { asked.push(m); return { ok: true, text }; };
    const grab = () => { const t = path.join(core.tempDir(), "zz568_" + Date.now() + ".png"); fs.copyFileSync(path.join(ROOT, "static", "pose-sheets", "dog.png"), t); return { file: t, label: "scene 1's last frame" }; };
    const a = await SP.plan(P, 2, {}, { contFrame: grab, complete: llm("Mara from Picture 2 climbs the fire escape seen in Picture 1, wet neon light, wide shot.") });
    const prevFile = path.join(d, "images", "sb_prev_c2.png");
    check("plan with a take before it: the scene before's LAST FRAME first (kept as images/sb_prev_<id>.png), then the character's sheet; the LLM's prompt (it knew both pictures and the scene before)",
      a.images[0] === "sb_prev_c2.png" && fs.existsSync(prevFile) && a.picked[1].group === "Characters · Mara" && a.prev === "scene 1's last frame" && a.llm
      && a.prompt === "Mara from Picture 2 climbs the fire escape seen in Picture 1, wet neon light, wide shot." && /Picture 1 = scene 1's last frame/.test(asked[0][1].content) && /The scene before:\nMara walks through the market/.test(asked[0][1].content), a);
    const b = await SP.plan(P, 1, {}, { contFrame: () => null, complete: llm("Mara from Picture 1 walks through the rainy market at night, lanterns glowing.") });
    check("...no take before it (the first scene / not rendered yet): the character's sheet + the scene's words (the LLM told there is no frame before)",
      b.images.length === 1 && b.picked[0].group === "Characters · Mara" && !b.prev && /no frame of a previous scene/.test(asked[1][0].content) && /Picture 1 = Mara's character sheet/.test(asked[1][1].content), b);
    const c = await SP.plan(P, 2, { prev: false, llm: false }, { contFrame: grab, complete: llm("never") });
    check("...☐ Previous last frame / ☐ LLM writes it: neither (the scene's own words, as before 2.568.0)", !c.prev && c.images[0] === "sheet.png" && !c.llm && c.prompt === SB.promptFor({ prompt: ["[Shot 2] Mara climbs the fire escape"] }) && asked.length === 2, c);
    const e1 = await SP.plan(P, 2, {}, { contFrame: () => null, complete: async () => ({ ok: false, error: "no LLM running" }) });
    const e2 = await SP.plan(P, 2, {}, { contFrame: () => null, complete: async () => ({ ok: true, text: '{"shots": []}' }) });
    check("...no LLM / a useless answer: the scene's own words, and a note that says why", !e1.llm && /did not answer \(no LLM running\)/.test(e1.note) && e1.prompt.includes("fire escape") && !e2.llm && /nothing usable/.test(e2.note), { e1, e2 });
    let threw = null; try { await SP.plan(P, 9, {}, {}); } catch (e) { threw = e; }
    check("...no such scene = 404", threw && threw.status === 404);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }

  /* 3 the card IS the picture */
  const c1 = G.cardHtml({ n: 3, prompt: ["[Shot 3] Mara looks"], status: "rendered", output: "a.mp4" }, { n: 3, at: 9, prompt: "Mara from Picture 1 at dawn" }, {});
  const c2 = G.cardHtml({ n: 4, prompt: ["x"] }, null, {});
  check("cardHtml: the picture fills the card (data-pic), the name + text over it, its tooltip = the whole text + the prompt the picture was made from; 📁 change it; no picture = no data-pic",
    /data-pic="1"/.test(c1) && /<div class="cap"><div class="nm">Scene 3/.test(c1) && /🖼 the picture: Mara from Picture 1 at dawn/.test(c1) && /data-sbgpick="3"/.test(c1) && !/data-pic/.test(c2) && /📁 picks one/.test(c2));
  const SG = rd("ext", "videodock", "sbgrid.js");
  check("...CSS: a 16:9 card, the picture over all of it, the caption on a gradient at the bottom, the buttons over the picture (on hover / focus, always without a picture)",
    /\.sbgcard\{position:relative;width:var\(--sbw,224px\);aspect-ratio:16\/9/.test(SG) && /#sbGrid \.th\{position:absolute;inset:0/.test(SG) && /#sbGrid \.cap\{position:absolute;left:0;right:0;bottom:0/.test(SG)
    && /\.sbgcard:hover \.bt,#sbGrid \.sbgcard:focus-within \.bt,#sbGrid \.sbgcard:not\(\[data-pic\]\) \.bt\{opacity:1\}/.test(SG) && /H\.change\(\+b\.dataset\.sbgpick\)/.test(SG));

  /* 4 the wiring */
  const RS = rd("routes", "storyboard.js"), ST = rd("ext", "videodock", "storyboard.js"), CH = rd("ext", "videodock", "characters.js");
  check("routes: plan = lib/storyboardPlan (async); /set (a project picture / a take's frame) and /upload (a file) change it; fromjob keeps the prompt; nothing in server.js",
    /await sbPlan\.plan\(b\.project, req\.params\.n, \{ sheets: b\.sheets, locations: b\.locations, refs: b\.refs, prev: b\.prev, llm: b\.llm, style_id: b\.style_id \}\)/.test(RS)
    && /app\.post\("\/api\/storyboard\/:n\/set"/.test(RS) && /app\.post\("\/api\/storyboard\/:n\/upload", upload\.single\("image"\)/.test(RS) && /b\.style, b\.prompt\)/.test(RS) && !/storyboardPlan/.test(rd("server.js")));
  check("the StoryBoard bar: ☑ LLM writes it, ☑ Previous last frame (both on by default) sent with the image model; the prompt kept; 📁 = the scene picker's slot sb (its 🎬 / 🎞 / 📁 / ⤒ tabs post to /api/storyboard) -> picked() (Start on it = its First frame)",
    /llm: true, prev: true/.test(ST) && /prev: opts\.prev, llm: opts\.llm, style_id: style/.test(ST) && /prompt: plan\.prompt \}/.test(ST) && /root\.bgScenes\.pickPicture\(n, "sb"\)/.test(ST)
    && /var isSb = slot === "sb"/.test(CH) && /isSb \? "\/api\/storyboard\/" \+ n \+ "\/set"/.test(CH) && /isSb \? "\/api\/storyboard\/" \+ n \+ "\/upload"/.test(CH) && /pickPicture: scFlPicker/.test(CH)
    && /if \(opts\.autoFirst\) await useAs\(n, "first", \{ anchor: true, quiet: true \}\);\n  \}\n  async function allMissing/.test(ST));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
