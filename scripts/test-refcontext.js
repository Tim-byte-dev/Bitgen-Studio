#!/usr/bin/env node
/* bitGen Studio — 2.354.0: the reference dock for the prompt LLM.
 * Run: node scripts/test-refcontext.js
 * Tim: "the llm now returns <filename.ext> instead of <picture 1>. can you have it look at the reference picture
 * descriptions <subject 1> is the woman from picture 1. keep the head, face and hair of woman in <picture 1>,
 * keep the body of the woman in <picture 2>. do action in <video x>, voice is <sound 1>".
 *   1. lib/refContext: the dock (tray order, subjects, roles, descriptions, videos, sounds, caps), the system
 *      block (tags only, the mapping-line rule, what each reference gives), the retag of a reply (file names ->
 *      <Picture n> / <Video n> / <Audio n>, <sound n> -> <Audio n>, <picture n> -> <Picture n>);
 *   2. the descriptions: described once by the vision model, cached by content (refdesc.json), describe off /
 *      a failing vision model said in words;
 *   3. the wiring: /api/chat + /api/enhance (routes/index.js), the chat brief, the images.tmp banner, the page
 *      sending the dock. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 700) : "")); }
}
const ROOT = path.join(__dirname, "..");
const RC = require(path.join(ROOT, "lib", "refContext"));
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

// ---- 1. dock / block / retag
const ctx = { refs: [{ name: "C:\\pics\\ava_face.png", subject: 1, role: "person" }, { name: "ava_body.png", subject: "1", role: "body" },
                     { name: "beach.jpg", subject: 2, role: "location" }],
              ref_videos: ["dance.mp4", "b.mp4", "c.mp4", "d.mp4"], ref_audios: ["voice.wav"] };
const d = RC.dock(ctx, ["a woman with long red hair, head and shoulders", "", "a sandy beach at sunset"]);
check("dock: the pictures in tray order as <Picture n> with subject, role, file name, description; videos capped at 3; the sound",
  d.pictures.length === 3 && d.pictures[0].name === "ava_face.png" && d.pictures[1].subject === 1 && d.pictures[2].role === "location"
  && d.videos.length === 3 && d.videos[0].name === "dance.mp4" && d.audios[0].n === 1, d);
const b = RC.block(d);
check("block: every reference by its tag (the file name only as information), the description, the not-described note",
  b.includes("THE REFERENCE DOCK") && b.includes("<Picture 1> - subject 1, file ava_face.png: a woman with long red hair")
  && b.includes("<Picture 2> - subject 1 (body), file ava_body.png: (not described") && b.includes("<Picture 3> - subject 2 (location)")
  && b.includes("<Video 1> - reference video, file dance.mp4") && b.includes("<Audio 1> - reference sound, file voice.wav")
  && b.includes("NEVER by its file name"), b);
check("block: the writing rule Tim gave - a mapping line per subject, then what each reference gives (head/face/hair, body, action, voice)",
  b.includes('"<Subject 1> is the woman in <Picture 1>."') && b.includes("keep the head, face and hair of the woman in <Picture 1>, keep the body of the woman in <Picture 2>")
  && b.includes("she does the action in <Video 1>") && b.includes("her voice is <Audio 1>"), b);
check("block: nothing in the dock -> nothing; no video / sound -> no video / sound rule",
  RC.block(RC.dock({}, [])) === "" && !RC.block(RC.dock({ refs: [{ name: "a.png" }] }, [])).includes("<Video 1>"));
const reply = "```video\n<subject 1> is the woman in <ava_face.png>. Keep the head, face and hair of the woman in <ava_face.png>, keep the body "
  + "of the woman in <ava_body.png>, on [beach.jpg]. She does the action in <dance.mp4>, her voice is <sound 1>; <voice.wav> and <picture 2>, <video 1>.\n```";
const rt = RC.retag(reply, d);
check("retag: file names written as tags -> their tags; <sound 1> -> <Audio 1>; <picture n> / <video n> -> the model's spelling",
  rt.text === "```video\n<subject 1> is the woman in <Picture 1>. Keep the head, face and hair of the woman in <Picture 1>, keep the body "
  + "of the woman in <Picture 2>, on <Picture 3>. She does the action in <Video 1>, her voice is <Audio 1>; <Audio 1> and <Picture 2>, <Video 1>.\n```"
  && rt.changed.length >= 5, rt);
check("retag: a stem written as a tag (<ava_face>) too; the right tags untouched; no dock -> only the spelling fixes",
  RC.retag("<ava_face> <Picture 1>", d).text === "<Picture 1> <Picture 1>" && RC.retag("<Picture 1> <Audio 1>", d).changed.length === 0
  && RC.retag("<ava_face.png> <sound 2>", null).text === "<ava_face.png> <Audio 2>");

// ---- 2. descriptions, cached
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "refctx_"));
  const f1 = { buffer: Buffer.from("picture one"), originalname: "ava_face.png", mimetype: "image/png" };
  const f2 = { buffer: Buffer.from("picture two"), originalname: "ava_body.png", mimetype: "image/png" };
  let calls = 0, asked = [];
  const cap = { describe: async (_core, files) => { calls++; asked = files; return files.map((f) => `described ${f.originalname}`); } };
  let r = await RC.describePictures({}, dir, [f1, f2], true, cap);
  check("described once by the vision model with the reference-picture question (one sentence: who / what, which part)",
    r.descs.join("|") === "described ava_face.png|described ava_body.png" && calls === 1 && asked[0].prompt === RC.DESCRIBE && asked[0].max_tokens === 120
    && fs.existsSync(path.join(dir, RC.CACHE)), r);
  r = await RC.describePictures({}, dir, [f2, { ...f1, originalname: "renamed.png" }], true, cap);
  check("the next chat: both from the cache (by content - a renamed file too), the vision model not started", calls === 1
    && r.descs.join("|") === "described ava_body.png|described ava_face.png", r);
  const f3 = { buffer: Buffer.from("picture three"), originalname: "new.png", mimetype: "image/png" };
  r = await RC.describePictures({}, dir, [f3], false, cap);
  check("describe off: nothing described, no vision model", calls === 1 && r.descs[0] === "" && !r.note);
  r = await RC.describePictures({}, dir, [f3], true, { describe: async () => { throw new Error("the vision model is not installed"); } });
  check("a failing vision model: said in words, the chat goes on without the description", r.descs[0] === "" && /could not be described \(the vision model is not installed\)/.test(r.note), r);
  fs.rmSync(dir, { recursive: true, force: true });

  // ---- 3. the wiring
  const IDX = read("routes", "index.js"), CH = read("lib", "llmChat.js"), CAP = read("lib", "captioner.js"), H = read("static", "index.html");
  check("/api/chat: takes the dock's pictures (ref_images), describes them (the 🖼 Describe flag), puts the dock in the system context, retags the reply before it is stored",
    IDX.includes('upload.fields([{ name: "images", maxCount: 9 }, { name: "ref_images", maxCount: 9 }])')
    && IDX.includes("const dsc = await refContext.describePictures(core, dir, ((req.files || {}).ref_images) || [],")
    && IDX.includes("        + refBlock\n") && IDX.indexOf("out.text = refContext.retag(out.text, refDock).text;") < IDX.indexOf('chatStore.append(dir, session, "assistant", out.text);'));
  check("/api/enhance: the dock's videos + sounds as <Video n> / <Audio n> lines, the what-each-gives rule, the reply retagged",
    IDX.includes("<Video ${v.n}> is the reference video") && IDX.includes("<Audio ${a.n}> is the reference sound")
    && IDX.includes("never write a file name as a tag") && IDX.includes("const tagged = refContext.retag(out.text, eDock).text;"));   // 2.364.0: then the speech is marked
  check("the chat brief: <Video n> / <Audio n>, never a file name as a tag, the <subject n> mapping line (no longer 'never write <subject n>')",
    CH.includes("Never write a FILE NAME as a tag") && CH.includes('\\"<Subject 1> is the woman in <Picture 1>.\\"') && !CH.includes("never write <subject n>")
    && CAP.includes("never write a file name as a tag in a prompt"));
  check("the page: a video chat sends the tray (Reference mode) with names / subjects / roles + its pictures, and the dock's videos / sounds; ✨ Enhance sends them too",
    H.includes('if (dockPics.length) chatCtx.refs = dockPics.map((r) => ({ name: (r.file && r.file.name) || "", subject: r.subject, role: roleOf(r), note: r.desc || "" }));')   // 2.539.0: + note (its description)
    && H.includes('pdForm.append("ref_images", r.file, r.file.name || "picture.png")') && H.includes("ref_videos: refVids.slice(0, 3), ref_audios: refAuds.slice(0, 3),"));
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
