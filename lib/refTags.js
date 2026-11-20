"use strict";
/**
 * refTags.js — THE SELECTED MODEL'S OWN WORDS FOR THE REFERENCES, FOR THE LLM (2.899.0).
 *
 * Tim: "fix the way the llm returns a picture name for different video types and image models. it is returning the
 * filename instead of picture 1 or image 1".
 *
 * The prompt chat and ✨ Enhance always taught MiniMax H3's tags (<Picture n>), the dock's lines carried each file name,
 * and a picture's file name was only put back when the LLM wrote it inside < > or [ ]. In IMAGE mode the dock was never
 * sent at all, so the LLM knew the pictures only by images.tmp's [file] names. Now the words follow the selected model:
 *
 *     video  MiniMax H3 / H3 Long         <Picture 1>  <Video 1>  <Audio 1>  <Subject 1> (mapping lines)
 *            LTX / Wan / PAN 2            picture 1    video 1    audio 1    (the pictures are frames - say what they show)
 *     image  Qwen Image 2.1               <image1>
 *            Fibo 2.0                     <image_1>
 *            FLUX.2 / FLUX 3 Klein        image 1
 *            Qwen Image Edit 2511 / other edit graphs   Picture 1
 *            a style that takes no reference pictures  picture 1 (and: describe them in words)
 *
 *   profile(stylesDir, base, ctx)  -> {key, kind, label, refs, pic(n), vid(n), aud(n), subj(n), mapping, word}
 *   names(text, files, prof, count)
 *                                  every way a reply can name a reference picture - its file name (bare, quoted, in
 *                                  < > [ ] ( ), with or without the extension), <Picture n>, picture #n, image n, img n,
 *                                  <image1>, <image_1> - written the model's way. -> {text, changed: [what]}
 *   imagePrompt(text, style, base, n)
 *                                  the prompt /api/genimage sends a reference-taking image model that is not Qwen 2.1 /
 *                                  Fibo (those have lib/qwenRefs.js): Klein "image n", the edit graphs "Picture n"
 * Pure apart from reading the style's graph (lib/refWords.wordingFor).
 */
const path = require("path");

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const base = (n) => String(n || "").split(/[\\/]/).pop().trim();

const TAGS = {
  h3: { pic: (n) => `<Picture ${n}>`, vid: (n) => `<Video ${n}>`, aud: (n) => `<Audio ${n}>`, subj: (n) => `<Subject ${n}>` },
  plain: { pic: (n) => `picture ${n}`, vid: (n) => `video ${n}`, aud: (n) => `audio ${n}`, subj: (n) => `subject ${n}` },
  qwen21: { pic: (n) => `<image${n}>` }, fibo2: { pic: (n) => `<image_${n}>` },
  image: { pic: (n) => `image ${n}` }, picture: { pic: (n) => `Picture ${n}` },
};

/** the video style's family: "h3" (MiniMax H3, H3 Long, none picked) | "ltx" | "wan" | "pan2" */
function videoFamily(style) {
  const s = style || {};
  const a = String(s.arch || "").toLowerCase();
  if (s.ltx || /ltx/.test(a)) return "ltx";
  if (/^wan/.test(a)) return "wan";
  if (/pan2|pan-2/.test(a)) return "pan2";
  return "h3";
}
const VIDEO_LABEL = { h3: "MiniMax H3", ltx: "LTX", wan: "Wan", pan2: "PAN 2" };
const IMAGE_LABEL = { qwen21: "Qwen Image 2.1", fibo2: "Fibo 2.0", image: "FLUX Klein", picture: "the edit model" };

/** does an image style take reference pictures (a LoadImage slot, or the Klein reference swap)? */
function takesRefs(style, baseDir) {
  try { if (require("./styles").imageSlots(style, baseDir) > 0) return true; } catch (e) { /* no graph */ }
  try { const R = require("./imageRefs"); if (R.isKlein9b(style) && R.resolve(style, 1, baseDir).swapped) return true; } catch (e) { /* fine */ }
  try { return !!require("./qwenRefs").refFormat(style, baseDir); } catch (e) { return false; }
}

function make(key, kind, label, refs, word) {
  const t = TAGS[key === "h3" ? "h3" : key === "video" || key === "none" ? "plain" : key];
  const P = TAGS.plain;
  return { key, kind, label, refs, word: word || key,
    pic: t.pic, vid: t.vid || P.vid, aud: t.aud || P.aud, subj: t.subj || P.subj, mapping: key === "h3" };
}

/**
 * The words for this selection. ctx = the chat / Enhance context: {gen_mode, image_style_id, video_style_id}.
 * Image mode -> the image style's word; anything else -> the video style's (H3 when none is picked).
 */
function profile(stylesDir, baseDir, ctx) {
  const c = ctx || {};
  const pick = (id) => { if (!id) return null; try { return require("./styles").byId(stylesDir, String(id)); } catch (e) { return null; } };
  if (String(c.gen_mode || "") === "image") {
    const st = pick(c.image_style_id);
    if (!st) return make("picture", "image", "the image model", true, "picture");
    const name = String(st.name || st.id || "the image model");
    if (!takesRefs(st, baseDir)) return make("none", "image", name, false, "none");
    let w = "picture";
    try { w = require("./refWords").wordingFor(st, baseDir); } catch (e) { w = "picture"; }
    const fam = IMAGE_LABEL[w] && w !== "picture" && !name.toLowerCase().includes(IMAGE_LABEL[w].split(" ").pop().toLowerCase()) ? ` (${IMAGE_LABEL[w]})` : "";
    return make(TAGS[w] ? w : "picture", "image", name + fam, true, w);
  }
  const vs = pick(c.video_style_id);
  const fam = videoFamily(vs);
  const label = vs ? `${vs.name || vs.id} (${VIDEO_LABEL[fam]})` : VIDEO_LABEL.h3;
  return fam === "h3" ? make("h3", "video", label, true, "h3") : make("video", "video", label, true, fam);
}

/* every way to name picture n: <Picture 1>, [Picture 1], picture #1, Picture No. 1, image 1, <image1>, <image_1>, img 1,
   pic 1, photo 1, ref 1, reference 1 - one pass, so the model's own form maps onto itself */
const PIC = /[<[]\s*(?:pictures?|images?|imgs?|pics?|photos?)\s*_?\s*#?\s*(\d{1,2})\s*[>\]]|\b(?:pictures?|images?|imgs?|pics?|photos?|refs?|references?)\s*(?:no\.?\s*|#\s*|_\s*)?(\d{1,2})\b/gi;
const SUBJ = /<\s*subject\s*(\d{1,2})\s*>/gi;

/**
 * A reply with every reference picture named the model's way.
 * files = the pictures' file names in their order (picture 1 first); count = how many pictures the model gets
 * (numbers above it are left alone - "image 12" in prose is not a reference). -> {text, changed}
 */
function names(text, files, prof, count) {
  let t = String(text || "");
  const P = prof || profile("", "", {});
  const changed = [];
  const swap = (re, to, what) => { const n = t; t = t.replace(re, to); if (n !== t) changed.push(what); };
  const list = (files || []).map(base);
  const N = Math.max(0, parseInt(count, 10) || list.length);
  // 1. file names, longest first ("ava_face.png" before "ava.png"); "the picture ava.png" -> "image 1", not "picture image 1"
  const byLen = list.map((f, i) => [f, i + 1]).filter(([f]) => f).sort((a, b) => b[0].length - a[0].length);
  const lead = "(?:(?:the\\s+)?(?:picture|image|photo|file|reference(?:\\s+picture)?)\\s+(?:named\\s+|called\\s+)?)?";
  for (const [f, n] of byLen) {
    const tag = P.pic(n), stem = f.replace(/\.[^.]+$/, "");
    // in < > [ ] ( ) quotes or backticks, with or without the extension
    for (const nm of stem && stem !== f ? [f, stem] : [f]) {
      swap(new RegExp(`${lead}(?:<\\s*|\\[\\s*|\\(\\s*|"|'|\`|“|‘)${esc(nm)}(?:\\s*>|\\s*\\]|\\s*\\)|"|'|\`|”|’)`, "gi"), tag, `${nm} -> ${tag}`);
    }
    // bare, with the extension - and a path in front of it (C:\pics\ava.png, ./input/ava.png) goes with it
    swap(new RegExp(`${lead}(?<![\\w./\\\\-])(?:[A-Za-z]:)?(?:[\\w.-]*[\\\\/])*${esc(f)}(?![\\w-])`, "gi"), tag, `${f} -> ${tag}`);
    // bare stem: only one that cannot be an ordinary word (ava_face, IMG-2041, shot3) - "woman" stays a word
    if (stem && stem !== f && /[_\-0-9.]/.test(stem) && stem.length >= 3)
      swap(new RegExp(`${lead}(?<![\\w./\\\\-])${esc(stem)}(?![\\w-])`, "gi"), tag, `${stem} -> ${tag}`);
  }
  // 2. the numbered forms -> the model's form (only numbers the model gets)
  swap(PIC, (m, a, b) => { const n = parseInt(a || b, 10); return n >= 1 && n <= N ? P.pic(n) : m; }, `picture n -> ${P.pic("n")}`);
  // 3. H3's other tags in a model that does not read them
  if (!P.mapping) swap(SUBJ, (_m, n) => P.subj(n), `<Subject n> -> ${P.subj("n")}`);
  return { text: t, changed: [...new Set(changed)] };
}

/** the system-prompt lines that say which word to use (the dock block's opening for a model that is not H3) */
function rule(prof) {
  const P = prof;
  if (P.kind === "image" && !P.refs) return `The selected image style (${P.label}) takes NO reference pictures: describe in words what `
    + "you want from them (who, clothing, place, style) - never a file name, never a picture number.";
  if (P.kind === "image") return `Refer to each reference picture ONLY as ${P.pic(1)}, ${P.pic(2)} … - the way ${P.label} names `
    + "its pictures - NEVER by its file name and never as <Picture n>. Say what each one gives inside the sentence, e.g. "
    + `"the woman from ${P.pic(1)} wearing the dress from ${P.pic(2)}". No <Subject n> mapping lines.`;
  return `${P.label} gets the pictures as frames (a first / last frame, a start picture), not as tagged references: describe in `
    + `words what they show and what moves. If you must point at one, write ${P.pic(1)} - NEVER its file name, never a < > tag, `
    + "and no <Subject n> mapping lines.";
}

/**
 * /api/genimage: the prompt for a reference-taking image model with n pictures. Qwen 2.1 / Fibo are lib/qwenRefs.js's;
 * here Klein's "image n" and the edit graphs' "Picture n" (a <Picture n> from the dock / the LLM would be read as text).
 * -> {prompt, note}
 */
function imagePrompt(text, style, baseDir, n) {
  const t = String(text || "");
  if (!(parseInt(n, 10) > 0)) return { prompt: t, note: "" };
  let w = "picture";
  try { w = require("./refWords").wordingFor(style, baseDir); } catch (e) { w = "picture"; }
  if (w === "qwen21" || w === "fibo2") return { prompt: t, note: "" };
  const P = make(TAGS[w] ? w : "picture", "image", "", true, w);
  const r = names(t, [], P, n);
  return { prompt: r.text, note: r.text !== t ? `the pictures named ${P.pic("n")}` : "" };
}

/**
 * ✨ Enhance's system prompt for a model that is not MiniMax H3 (H3 keeps routes/index.js's own, with its dialogue
 * syntax): what to write for, the words for the pictures, and the model's prompting guide (lib/promptGuides.json).
 */
function enhanceSystem(stylesDir, prof, ctx, rough) {
  const P = prof, c = ctx || {}, G = require("./promptGuides");
  const pick = (id) => { if (!id) return null; try { return require("./styles").byId(stylesDir, String(id)); } catch (e) { return null; } };
  const kind = P.kind === "image" ? "image" : "video";
  const st = pick(kind === "image" ? c.image_style_id : c.video_style_id);
  const arch = kind === "image" ? String((st && st.arch) || "") : (P.word === "ltx" ? "ltx" : P.word);
  const guide = G.guideFor(stylesDir, { kind, arch, model: String((st && (kind === "image" ? st.model : st.name)) || "") });
  return [
    `You rewrite rough ${kind === "image" ? "image" : "video"}-generation prompts into detailed prompts for ${P.label}.`,
    "Rules:",
    "- " + rule(P),
    kind === "image" ? "- A still picture: no camera movement, no sound, no dialogue markup." : "- Plain words: no <d> dialogue tags and no <Subject n> / <Picture n> tags - this model reads none of them.",
    "- One paragraph. No headings, no options, no commentary.",
    "- Output ONLY the final prompt text.",
    "",
    guide,
    G.addendaFor(stylesDir, kind, rough),
  ].filter(Boolean).join("\n");
}

module.exports = { profile, videoFamily, takesRefs, names, rule, imagePrompt, enhanceSystem, TAGS, PIC };
