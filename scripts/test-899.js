#!/usr/bin/env node
/* bitGen Studio — 2.899.0 units: the LLM names the reference pictures the SELECTED model's way, never by file name.
 * Tim: "fix the way the llm returns a picture name for different video types and image models. it is returning the
 * filename instead of picture 1 or image 1".
 *   lib/refTags.js: profile (H3 <Picture 1>, LTX / Wan / PAN 2 "picture 1", Klein "image 1", Qwen 2.1 <image1>, Fibo
 *   <image_1>, Qwen Image Edit "Picture 1", a style with no reference pictures), names (a file name bare / quoted / in
 *   brackets, every numbered form -> the model's), imagePrompt (/api/genimage), enhanceSystem; lib/refContext.js block +
 *   retag with a profile; the wiring (routes/index.js, the page sends the dock in Image mode too, the guides). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const T = require("../lib/refTags"), RC = require("../lib/refContext"), ST = require("../lib/styles");
const SD = path.join(ROOT, "styles"), all = ST.read(SD);
const idOf = (n) => (all.find((s) => s.name === n) || {}).id;
const prof = (mode, name) => T.profile(SD, ROOT, mode === "image" ? { gen_mode: "image", image_style_id: idOf(name) } : { gen_mode: "video", video_style_id: name ? idOf(name) : "" });

// ---- 1. the profile: the selected model's word
const P = {
  h3: prof("video", "H3_Video_Ref"), none: prof("video", ""), ltx: prof("video", "LTX 2.5"), wan: prof("video", "Wan 2.2"), pan: prof("video", "PAN 2"),
  klein: prof("image", "FLUX.2 Klein 9B"), klein3: prof("image", "FLUX 3 Klein edit"), q21: prof("image", "Qwen Image 2.1 edit"),
  fibo: prof("image", "Fibo 2.0 Edit Turbo"), qedit: prof("image", "Qwen Image Edit 2511"), sdxl: prof("image", "SDXL"),
};
check("video: MiniMax H3 (picked or none) = <Picture 1> / <Video 1> / <Audio 1>, mapping lines", P.h3.pic(1) === "<Picture 1>" && P.h3.vid(2) === "<Video 2>" && P.h3.aud(1) === "<Audio 1>" && P.h3.mapping && P.none.mapping && P.none.pic(3) === "<Picture 3>");
check("video: LTX / Wan / PAN 2 = plain picture 1 / video 1 / audio 1, no mapping lines", [P.ltx, P.wan, P.pan].every((p) => p.pic(1) === "picture 1" && p.vid(1) === "video 1" && p.aud(1) === "audio 1" && !p.mapping && p.kind === "video") && P.ltx.word === "ltx" && P.wan.word === "wan" && P.pan.word === "pan2", [P.ltx.word, P.wan.word, P.pan.word]);
check("image: FLUX.2 Klein / FLUX 3 Klein = image 1", P.klein.pic(1) === "image 1" && P.klein3.pic(2) === "image 2" && P.klein.refs && P.klein.kind === "image");
check("image: Qwen Image 2.1 = <image1>, Fibo 2.0 = <image_1>, Qwen Image Edit 2511 = Picture 1", P.q21.pic(1) === "<image1>" && P.fibo.pic(1) === "<image_1>" && P.qedit.pic(1) === "Picture 1");
check("image: a style that takes no reference pictures (SDXL) says so", !P.sdxl.refs && P.sdxl.key === "none" && /takes NO reference pictures/.test(T.rule(P.sdxl)));
check("image mode with no style picked: Picture 1", T.profile(SD, ROOT, { gen_mode: "image" }).pic(1) === "Picture 1");

// ---- 2. names(): a file name in any shape, every numbered form -> the model's
const files = ["ava_face.png", "beach.jpg", "IMG_2041.webp"];
const N = (t, p) => T.names(t, files, p, 3).text;
check("Tim's bug: a bare file name -> the model's picture (H3 <Picture 1>, Klein image 1, Qwen 2.1 <image1>)",
  N("The woman from ava_face.png on the beach from beach.jpg", P.h3) === "The woman from <Picture 1> on the beach from <Picture 2>"
  && N("The woman from ava_face.png on the beach from beach.jpg", P.klein) === "The woman from image 1 on the beach from image 2"
  && N("The woman from ava_face.png", P.q21) === "The woman from <image1>", N("The woman from ava_face.png on the beach from beach.jpg", P.klein));
check("...in < > [ ] ( ) and quotes, with or without the extension",
  N("face of <ava_face.png>, dress in [IMG_2041.webp], place in (beach.jpg), hair from \"ava_face\" and <beach>", P.klein) === "face of image 1, dress in image 3, place in image 2, hair from image 1 and image 2");
check("...a bare stem only when it cannot be a word (ava_face, IMG_2041 yes - 'beach' stays a word)",
  N("the woman in ava_face wearing IMG_2041 on a beach", P.klein) === "the woman in image 1 wearing image 3 on a beach");
check("...'the picture ava_face.png' / 'the file named beach.jpg' -> image 1 / image 2 (no 'picture image 1')",
  N("the picture ava_face.png and the file named beach.jpg", P.klein) === "image 1 and image 2");
check("...a path in front goes with it (C:\\pics\\ava_face.png, ./input/beach.jpg)", N("from C:\\pics\\ava_face.png and ./input/beach.jpg", P.klein) === "from image 1 and image 2", N("from C:\\pics\\ava_face.png and ./input/beach.jpg", P.klein));
check("numbered forms -> the model's: <Picture 1>, image 2, <image3>, <image_2>, img 3, Picture #1 (Klein)",
  N("<Picture 1>, image 2, <image3>, <image_2>, img 3, Picture #1", P.klein) === "image 1, image 2, image 3, image 2, image 3, image 1");
check("...Qwen 2.1: picture 2 -> <image2>, its own <image1> unchanged; Fibo: Picture 1 -> <image_1>",
  N("<image1> with the dress from picture 2", P.q21) === "<image1> with the dress from <image2>" && N("Picture 1", P.fibo) === "<image_1>");
check("...a number the model does not get is left alone (image 12, picture 4 of 3)", N("image 12 and picture 4", P.klein) === "image 12 and picture 4");
check("...H3's <Subject n> stays for H3, becomes 'subject n' for an image model; H3's own tags map onto themselves",
  N("<Subject 1> is the woman in <Picture 1>.", P.h3) === "<Subject 1> is the woman in <Picture 1>." && N("<Subject 1> is the woman in <Picture 1>.", P.klein) === "subject 1 is the woman in image 1.");
check("...LTX: the file name and <Picture 1> -> picture 1", N("start on <Picture 1>, end on beach.jpg", P.ltx) === "start on picture 1, end on picture 2");
const twice = N(N("from ava_face.png and Picture 2", P.q21), P.q21);
check("idempotent: retagging twice changes nothing more", twice === "from <image1> and <image2>", twice);
check("changed says what was done", T.names("from ava_face.png", files, P.klein, 3).changed.join() === "ava_face.png -> image 1");

// ---- 3. refContext: the block + retag with a profile
const d = RC.dock({ refs: [{ name: "ava_face.png", subject: 1, role: "face" }, { name: "beach.jpg", subject: 1, role: "environment" }], ref_videos: ["dance.mp4"], ref_audios: ["voice.wav"] }, ["a woman with red hair", "a sunny beach"]);
const bk = RC.block(d, P.klein), bh = RC.block(d, P.h3), bl = RC.block(d, P.ltx), bs = RC.block(d, P.sdxl);
check("Klein's block: image 1 / image 2 with the descriptions, the file name only as what the user may call it, no <Picture n>, no mapping lines, no videos",
  /image 1 \(face\): a woman with red hair \(the user may call it "ava_face\.png" - never write that name\)/.test(bk) && /image 2 \(environment\): a sunny beach/.test(bk)
  && !/<Picture 1>/.test(bk) && !/<Subject 1>/.test(bk) && !/dance\.mp4/.test(bk) && /FLUX\.2 Klein 9B/.test(bk), bk);
check("H3's block unchanged: <Picture n> with the mapping-line rule", /<Picture 1> - subject 1 \(face\), file ava_face\.png/.test(bh) && /<Subject 1> is the woman in <Picture 1>/.test(bh));
check("LTX's block: picture 1, video 1, audio 1 - frames, describe in words", /picture 1 \(face\)/.test(bl) && /video 1 - reference video/.test(bl) && /audio 1 - reference sound/.test(bl) && /gets the pictures as frames/.test(bl) && !/<Video/.test(bl));
check("SDXL's block: no reference pictures - describe them in words, no numbers", /takes NO reference pictures/.test(bs) && /no numbers at all/.test(bs));
const r1 = RC.retag("Keep the face from ava_face.png, dance like dance.mp4, sing like <sound 1>", d, P.h3);
check("retag (H3): bare picture + video names -> <Picture 1> / <Video 1>, <sound 1> -> <Audio 1>", r1.text === "Keep the face from <Picture 1>, dance like <Video 1>, sing like <Audio 1>", r1);
const r2 = RC.retag("The woman from <Picture 1> on (beach.jpg)", d, P.klein);
check("retag (Klein): image 1 / image 2", r2.text === "The woman from image 1 on image 2", r2);
const r3 = RC.retag("she does <Video 1> with <Audio 1> from ava_face.png", d, P.wan);
check("retag (Wan): video 1, audio 1, picture 1 - no tags", r3.text === "she does video 1 with audio 1 from picture 1", r3);
check("retag with no profile = H3 as before; with no dock only H3's own tags tidied", RC.retag("from ava_face.png", d).text === "from <Picture 1>" && RC.retag("<picture 1>", null).text === "<Picture 1>");
const od = RC.dock({ refs: [{ name: "end.png" }], ref_video_op: { name: "clip.mp4", op: "append" } }, ["the end"], "a frame");
check("an fl2va (append) dock: the video's name in brackets is its frame <Picture 1>, bare it stays the video's; the picture's own name -> <Picture 2>",
  RC.retag("from <clip.mp4> after clip.mp4 to end.png", od, P.h3).text === "from <Picture 1> after clip.mp4 to <Picture 2>");

// ---- 4. /api/genimage + Enhance's system
check("imagePrompt: Klein with 2 pictures: <Picture 1> / Picture 2 -> image 1 / image 2, said in the note",
  T.imagePrompt("the woman in <Picture 1> on the beach of Picture 2", all.find((s) => s.name === "FLUX.2 Klein 9B"), ROOT, 2).prompt === "the woman in image 1 on the beach of image 2"
  && /image n/.test(T.imagePrompt("<Picture 1>", all.find((s) => s.name === "FLUX.2 Klein 9B"), ROOT, 1).note));
check("...Qwen Image Edit 2511: <Picture 1> -> Picture 1 (no brackets); no pictures = untouched; Qwen 2.1 left to qwenRefs",
  T.imagePrompt("<Picture 1>", all.find((s) => s.name === "Qwen Image Edit 2511"), ROOT, 1).prompt === "Picture 1"
  && T.imagePrompt("<Picture 1>", all.find((s) => s.name === "Qwen Image Edit 2511"), ROOT, 0).prompt === "<Picture 1>"
  && T.imagePrompt("<Picture 1>", all.find((s) => s.name === "qwen2_1"), ROOT, 1).prompt === "<Picture 1>");
const es = T.enhanceSystem(SD, P.klein, { gen_mode: "image", image_style_id: idOf("FLUX.2 Klein 9B") }, "a woman");
check("Enhance for Klein: written for the Klein style, the image-1 rule, a still (no dialogue), the Klein guide (which now says image 1)",
  /prompts for FLUX\.2 Klein 9B/.test(es) && /ONLY as image 1, image 2/.test(es) && /no camera movement/.test(es) && /Reference pictures are image 1, image 2/.test(es) && !/MiniMax H3/.test(es), es.slice(0, 600));
const el = T.enhanceSystem(SD, P.ltx, { gen_mode: "video", video_style_id: idOf("LTX 2.5") }, "a woman");
check("Enhance for LTX: plain words, the LTX guide", /prompts for LTX 2\.5/.test(el) && /no <d> dialogue tags/.test(el) && /starting frame/i.test(el));

// ---- 5. the wiring
const IX = src("routes/index.js"), H = src("static/index.html"), CH = src("lib/llmChat.js"), G = src("lib/promptGuides.json");
check("routes/index.js: refTags required; Enhance by profile (an H3-only fl2va op, its own system for another model, the speech formatted for H3 only, the reply retagged)",
  IX.includes('const refTags = require("../lib/refTags");') && IX.includes("const eProf = refTags.profile(core.STYLES_DIR, core.BASE, req.body || {});")
  && IX.includes("const eop = eProf.mapping ? refContext.opOf(req.body || {}) : null;") && IX.includes("refTags.enhanceSystem(core.STYLES_DIR, eProf, req.body || {}, prompt)")
  && IX.includes("const rt = refContext.retag(out.text, eDock, eProf), tagged = rt.text;") && IX.includes("const ms = eProf.mapping ? vs.formatSpeech("));
check("...the chat: the profile, the block + retag with it", IX.includes("const rProf = refTags.profile(core.STYLES_DIR, core.BASE, rctx);") && IX.includes("refContext.block(refDock, rProf)")
  && IX.indexOf("out.text = refContext.retag(out.text, refDock, rProf).text;") > 0 && IX.indexOf("out.text = refContext.retag(out.text, refDock, rProf).text;") < IX.indexOf('chatStore.append(dir, session, "assistant", out.text);'));
check("...genimage: Klein / the edit graphs named their way after Qwen 2.1 / Fibo", /\} else if \(\(p\.images \|\| \[\]\)\.length\) \{\n[^\n]*\n\s*const q = refTags\.imagePrompt\(p\.prompt, styled, core\.BASE, p\.images\.length\);/.test(IX));
check("the page: Image mode sends the dock's pictures to the chat and to Enhance (no fl2va op there)",
  H.includes('(chatCtx.gen_mode === "video" && mode === "ref2va") || chatCtx.gen_mode === "image" ? refs.slice(0, 9) : [];')
  && H.includes('if (chatCtx.gen_mode === "image" && dockPics.length) chatCtx.refs = dockPics.map(')
  && H.includes(': mode === "ref2va" || imgMode') && H.includes("...(curFrameOp() && !imgMode ? { ref_video_op: curFrameOp().op } : {}),"));
check("the chat brief + the Klein guide: each model's own word, never a file name",
  CH.includes("image 1 for FLUX Klein, <image1> for Qwen Image 2.1") && CH.includes("NEVER write a FILE NAME") && !G.includes("Reference pictures are <Picture n>.") && G.includes("Reference pictures are image 1, image 2"));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
