"use strict";
/**
 * refContext.js — THE REFERENCE DOCK, AS THE LLM SEES IT (2.354.0).
 *
 * Tim: "the llm now returns <filename.ext> instead of <picture 1>. can you have it look at the reference
 * picture descriptions <subject 1> is the woman from picture 1. keep the head, face and hair of woman in
 * <picture 1>, keep the body of the woman in <picture 2>. do action in <video x>, voice is <sound 1>".
 *
 * The prompt chat only ever saw pictures by FILE NAME (images.tmp's "[ava.png] a woman ..."), so it wrote
 * <ava.png>. Now the chat (and ✨ Enhance) get the reference dock in the order the video model receives it:
 *
 *     <Picture 1> - subject 1 (person), ava_face.png: a woman with long red hair, head and shoulders
 *     <Video 1> - dance.mp4 (reference video: the motion / action)
 *     <Audio 1> - voice.wav (reference sound: a voice or sound)
 *
 * with the writing rule (mapping lines, what each reference gives), and every reply is RETAGGED: a file
 * name written as a tag (<ava_face.png>) becomes its <Picture n> / <Video n> / <Audio n>, and <sound n> /
 * <voice n> / <picture n> / <video n> are written the way the model knows them (<Audio n>, <Picture n>,
 * <Video n>). The pictures are described once by the local vision model (lib/captioner) and cached by their
 * content in the project's chat folder (refdesc.json).
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MAX = { pictures: 9, videos: 3, audios: 3 };
const CACHE = "refdesc.json";
const DESCRIBE = "Describe this reference picture for a video prompt in ONE short sentence: who or what it is "
  + "(for example 'a woman with long red hair in a black jacket'), and which part it shows (head and face, "
  + "full body, clothing, a location, a prop). No file name, no preamble.";

const sha = (buf) => crypto.createHash("sha1").update(buf).digest("hex");
const base = (n) => String(n || "").split(/[\\/]/).pop().trim();   // a Windows path too
/* 2.539.0 (Tim: "add an input for all types of references so user can add a brief description of the references"):
   the user's own description (ctx.refs[].note, ctx.ref_notes {videos, audio}) beats the captioner's guess */
const noteOf = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, 200);
const pickDesc = (note, guess) => noteOf(note) || String(guess || "").trim();
const vNote = (c, name) => noteOf((((c || {}).ref_notes || {}).videos || {})[name]);
const aNote = (c, name) => noteOf(((((c || {}).ref_notes || {}).audio || ((c || {}).ref_notes || {}).audios) || {})[name]);

function loadCache(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, CACHE), "utf8")) || {}; } catch { return {}; }
}
function saveCache(dir, c) {
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, CACHE), JSON.stringify(c, null, 1)); } catch {}
}

/**
 * Descriptions for the dock's pictures (multer files, tray order). Cached by content; the missing ones are
 * described with lib/captioner when `describe` is on. -> {descs: [string|""], note}
 */
async function describePictures(core, dir, files, describe, captioner) {
  const list = (files || []).slice(0, MAX.pictures);
  const cache = loadCache(dir);
  const keys = list.map((f) => { try { return sha(f.buffer || fs.readFileSync(f.path)); } catch { return ""; } });
  const descs = keys.map((k) => (k && cache[k] ? cache[k].desc : ""));
  const todo = list.map((f, i) => i).filter((i) => !descs[i] && keys[i]);
  let note = "";
  if (todo.length && describe) {
    try {
      const cap = captioner || require("./captioner");
      const got = await cap.describe(core, todo.map((i) => ({ ...list[i], prompt: DESCRIBE, max_tokens: 120 })));
      todo.forEach((i, j) => {
        const d = String(got[j] || "").replace(/\s+/g, " ").trim();
        if (d) { descs[i] = d; cache[keys[i]] = { desc: d, name: base(list[i].originalname), at: new Date().toISOString() }; }
      });
      saveCache(dir, cache);
    } catch (e) {
      note = "the reference pictures could not be described (" + String((e && e.message) || e).slice(0, 160) + ")";
    }
  }
  return { descs, note };
}

/**
 * The dock as {pictures: [{n, name, subject, role, desc}], videos: [{n, name}], audios: [{n, name}]}.
 * ctx = {refs: [{name, subject, role}], ref_videos: [name], ref_audios: [name]}; descs = describePictures().
 */
function dock(ctx, descs, frameDesc) {
  const c = ctx || {};
  const op = opOf(c);
  if (op) return opDock(c, op, descs, frameDesc);
  const pictures = (Array.isArray(c.refs) ? c.refs : []).slice(0, MAX.pictures).map((r, i) => ({
    n: i + 1, name: base(r && r.name), subject: parseInt(r && r.subject, 10) || 1,
    role: String((r && r.role) || "person").trim() || "person", desc: pickDesc(r && r.note, (descs || [])[i]) }));
  const videos = (Array.isArray(c.ref_videos) ? c.ref_videos : []).slice(0, MAX.videos).map((x, i) => ({ n: i + 1, name: base(x), desc: vNote(c, base(x)) }));
  const audios = (Array.isArray(c.ref_audios) ? c.ref_audios : []).slice(0, MAX.audios).map((x, i) => ({ n: i + 1, name: base(x), desc: aNote(c, base(x)) }));
  return { pictures, videos, audios };
}

/* ------------------------------------------------------------------------------------------------------------------
 * 2.395.0 — APPEND / PREPEND, AS THE LLM SEES IT. Tim (verbatim): "when prepend or append video use fl2va not ref2a or
 * i2v . if there are pictures in the ref images tab label the first picture as picture 2. let the llm know the
 * details". A reference video set to Append / Prepend (context.ref_video_op = {name, op}) makes the render fl2va -
 * H3's first / last frame node - and the dock the LLM is shown becomes:
 *     <Picture 1> - the video's LAST frame (append: the new part STARTS on it) / FIRST frame (prepend: ENDS on it),
 *                   described by the local vision model like any picture (the frame is taken out with ffmpeg)
 *     <Picture 2> - the dock's picture the page sends (static/refroles.js frameOpPick): the other end
 * with the rule for writing an fl2va continuation (opBlock). The op video is joined, not a reference.
 * ------------------------------------------------------------------------------------------------------------------ */
/** context.ref_video_op -> {name, op} | null */
function opOf(ctx) { return require("./frameOp").parse(ctx && ctx.ref_video_op); }
function opDock(c, op, descs, frameDesc) {
  const which = op.op === "append" ? "last" : "first";
  const other = op.op === "append" ? "last" : "first";
  const pic = (Array.isArray(c.refs) ? c.refs : [])[0];
  const pictures = [{ n: 1, name: op.name, frame: which, subject: 0, role: which + " frame of " + op.name, desc: String(frameDesc || "").trim() }];
  if (pic) pictures.push({ n: 2, name: base(pic.name), subject: 0, role: other + " frame", desc: pickDesc(pic.note, (descs || [])[0]) });
  const videos = (Array.isArray(c.ref_videos) ? c.ref_videos : []).map(base).filter((x) => x && x !== op.name)
    .slice(0, MAX.videos).map((x, i) => ({ n: i + 1, name: x, desc: vNote(c, x) }));
  const audios = (Array.isArray(c.ref_audios) ? c.ref_audios : []).slice(0, MAX.audios).map((x, i) => ({ n: i + 1, name: base(x), desc: aNote(c, base(x)) }));
  return { pictures, videos, audios, op: { op: op.op, name: op.name, which, other, end: !!pic } };
}
/** the system-prompt block for an Append / Prepend render */
function opBlock(d) {
  const o = d.op, p1 = d.pictures[0], p2 = d.pictures[1];
  const desc = (p) => (p && p.desc) || "(not described - ask the user what it shows if it matters)";
  const L = [];
  if (o.op === "append") {
    L.push(`THIS RENDER APPENDS A NEW PART TO THE VIDEO ${o.name}. It is FIRST / LAST FRAME (fl2va): the video model gets `
      + `${p2 ? "two pictures as its first and last frame" : "one picture as its first frame"} - not References, not a plain image-to-video.`);
    L.push(`<Picture 1> - the LAST frame of ${o.name}: the new part STARTS exactly on it (it is played right after the video, as one clip): ${desc(p1)}`);
    if (p2) L.push(`<Picture 2> - ${p2.name ? "file " + p2.name + ", " : ""}the user's picture: the new part ENDS exactly on it: ${desc(p2)}`);
  } else {
    L.push(`THIS RENDER PREPENDS A NEW PART TO THE VIDEO ${o.name}. It is FIRST / LAST FRAME (fl2va): the video model gets `
      + `${p2 ? "two pictures as its first and last frame" : "one picture"} - not References, not a plain image-to-video.`);
    L.push(`<Picture 1> - the FIRST frame of ${o.name}: the new part ENDS exactly on it (it is played right before the video, as one clip): ${desc(p1)}`);
    if (p2) L.push(`<Picture 2> - ${p2.name ? "file " + p2.name + ", " : ""}the user's picture: the new part STARTS exactly on it: ${desc(p2)}`);
    else L.push("There is no start picture: the part is made forward from <Picture 1> and played BACKWARDS (silent), so it "
      + "ends on the video. Write motion that still reads naturally in reverse, and no speech.");
  }
  if (d.audios.length) L.push(d.audios.map((a) => `<Audio ${a.n}> - reference sound${a.name ? ", file " + a.name : ""} (only heard when the fl2va workflow loads sound)`).join("\n"));
  L.push("When you write the VIDEO prompt for it:");
  L.push(o.op === "append"
    ? `- one continuous shot that CARRIES ON from the last moment of ${o.name} (<Picture 1>): the same people, place, light, camera and direction of movement${p2 ? ", travelling to exactly what <Picture 2> shows" : ""}`
    : `- one continuous shot that LEADS INTO the first moment of ${o.name} (<Picture 1>)${p2 ? ", starting from exactly what <Picture 2> shows" : ""}: the same people, place, light and camera as the video's opening`);
  L.push("- describe in words what is in the pictures (from the descriptions above) and what moves and changes between them; "
    + "you may name " + (p2 ? "them as <Picture 1> / <Picture 2>" : "it as <Picture 1>") + ", never by file name and never another number");
  L.push("- NO <Subject n> mapping lines and no \"keep the face of ...\" lines: in fl2va the pictures are the first and last frames, "
    + "not subject references");
  L.push("- no cuts, no scene change, no new characters that are not in the pictures; the join to the video must be seamless");
  // speech: H3's dialogue syntax only (voiceStyle.TEACHING opens with subject mapping lines - not for fl2va)
  if (!(o.op === "prepend" && !p2)) L.push(require("./voiceStyle").ENHANCE_RULE);
  L.push("- then the camera, light and sound. One paragraph. This overrides any rule about mapping lines or <Subject n>.");
  return "\n\nTHE REFERENCE DOCK FOR THIS RENDER (fl2va):\n" + L.join("\n");
}
/** the op video's frame taken out (ffmpeg) into `dir` and described (cached by content) -> {desc, note} */
async function frameDesc(core, dir, op, videoDir, describe, opts) {
  const o = opts || {};
  const FO = require("./frameOp");
  const which = op.op === "append" ? "last" : "first";
  const video = path.join(videoDir, base(op.name));
  if (!fs.existsSync(video)) return { desc: "", note: `${op.name} is not in this project's Assets - its frame could not be described` };
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const out = path.join(dir, "frameop_llm.png");
  try { fs.rmSync(out, { force: true }); } catch {}
  const run = o.extract || ((args) => require("child_process").spawnSync("ffmpeg", args, { encoding: "utf8" }).status === 0);
  if (!run(FO.extractArgs(video, which, out)) || !fs.existsSync(out))
    return { desc: "", note: `could not take the ${which} frame out of ${op.name}` };
  const r = await describePictures(core, dir, [{ buffer: fs.readFileSync(out), originalname: `${base(op.name)}_${which}_frame.png` }],
    describe, o.captioner);
  return { desc: r.descs[0] || "", note: r.note };
}

const empty = (d) => !d || (!d.pictures.length && !d.videos.length && !d.audios.length);

/** The system-prompt block ("" with nothing in the dock). */
function block(d) {
  if (d && d.op) return opBlock(d);             // 2.395.0: Append / Prepend = fl2va
  if (empty(d)) return "";
  const lines = [];
  for (const p of d.pictures) {
    const who = p.role === "person" || p.role === "subject" ? "" : ` (${p.role})`;
    lines.push(`<Picture ${p.n}> - subject ${p.subject}${who}${p.name ? ", file " + p.name : ""}: `
      + (p.desc || "(not described - ask the user what it shows if it matters)"));
  }
  for (const v of d.videos) lines.push(`<Video ${v.n}> - reference video${v.name ? ", file " + v.name : ""} (its motion / action / camera)${v.desc ? ": " + v.desc : ""}`);
  for (const a of d.audios) lines.push(`<Audio ${a.n}> - reference sound${a.name ? ", file " + a.name : ""} (a voice, music or sound)${a.desc ? ": " + a.desc : ""}`);
  const subjects = [...new Set(d.pictures.map((p) => p.subject))];
  return "\n\nTHE REFERENCE DOCK (what the video model receives with a video prompt, in this order). Refer to "
    + "each reference ONLY by its tag - <Picture n>, <Video n>, <Audio n> - NEVER by its file name:\n"
    + lines.join("\n")
    + "\nWhen you write a VIDEO prompt that uses them:\n"
    + (subjects.length ? "- start with one mapping line per subject, named from the descriptions: "
      + `"<Subject 1> is the woman in <Picture 1>." (one subject may be in several pictures: face, body, clothing)\n`
      + "- then say what each reference gives, e.g. \"keep the head, face and hair of the woman in <Picture 1>, "
      + "keep the body of the woman in <Picture 2>\"\n" : "")
    + (d.videos.length ? "- the action / motion comes from the video: \"she does the action in <Video 1>\"\n" : "")
    // 2.363.0: a voice reference is a TIMBRE - the character never says its words; the lines are marked
    + (d.audios.length ? "- the voice or sound: \"her voice is <Audio 1>\" - a voice reference gives ONLY the timbre "
      + "(pitch, accent, texture), never words to say: never quote or reuse what the audio says\n"
      + "- every spoken line in the model's dialogue syntax, its emotion OUTSIDE the tags: \"she whispers, voice "
      + "trembling, in the timbre of <Audio 1>, <d>[English] Is someone there?</d>\" - prose speech renders as babble\n" : "")
    + "- then the shot itself (camera, light, sound). Never invent a number the dock does not have."
    // 2.365.0 (Tim: "can u teach the llm to write a proper formatted prompt please"): the exact shape + an example
    + "\n\n" + require("./voiceStyle").TEACHING;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A reply with its tags written the way the model knows them. -> {text, changed: [what]} */
function retag(text, d) {
  let t = String(text || "");
  const changed = [];
  const swap = (re, to, what) => { const n = t; t = t.replace(re, to); if (n !== t) changed.push(what); };
  if (d) {
    const byName = [...d.pictures.map((p) => [p.name, `<Picture ${p.n}>`]), ...d.videos.map((v) => [v.name, `<Video ${v.n}>`]),
                    ...d.audios.map((a) => [a.name, `<Audio ${a.n}>`])].filter(([n]) => n);
    for (const [name, tag] of byName) {
      const stem = name.replace(/\.[^.]+$/, "");
      // <ava_face.png>, <ava_face>, [ava_face.png], "picture ava_face.png"
      swap(new RegExp(`[<\\[]\\s*${esc(name)}\\s*[>\\]]`, "gi"), tag, `${name} -> ${tag}`);
      if (stem && stem !== name) swap(new RegExp(`<\\s*${esc(stem)}\\s*>`, "gi"), tag, `${stem} -> ${tag}`);
    }
  }
  swap(/<\s*(?:sound|voice|audio)\s*(\d)\s*>/gi, (m, n) => `<Audio ${n}>`, "<sound n> -> <Audio n>");
  swap(/<\s*picture\s*(\d)\s*>/gi, (m, n) => `<Picture ${n}>`, "<picture n> -> <Picture n>");
  swap(/<\s*video\s*(\d)\s*>/gi, (m, n) => `<Video ${n}>`, "<video n> -> <Video n>");
  return { text: t, changed: [...new Set(changed)] };
}

module.exports = { pickDesc, MAX, CACHE, DESCRIBE, dock, block, retag, describePictures, empty, opOf, opBlock, frameDesc };
