// bitGen Studio — lib/refWords.js (2.546.0): what an edit model calls its pictures, and a Blender scene + the References
// docker's pictures in one prompt.
//
// Tim: "allow user to use reference images from reference docker when generating an image from a blender scene when in
// image-edit docker, for example photo real blonde woman on a beach with face of woman in picture 1. if model needs image 1
// instead of picture 1 change automatically to image n."
//
//   wordingFor(style, base)   "qwen21" (Qwen Image 2.1: <image1>), "image" (FLUX.2 / FLUX 3 Klein: image 1), else
//                             "picture" (Qwen Image Edit 2509 / 2511: its encoder names them Picture 1, Picture 2 …)
//   tag(i, wording)           the model's own name for picture i
//   mentions(text)            the reference numbers the prompt names, in order: "picture 1", "image 2", "pic 3", "ref 1",
//                             "reference 2", "photo 1", "img 2", "#1"-style "picture #1", "<Picture 1>", "<image1>"
//   pickRefs(text, have, max, rule)
//                             which References docker pictures go along (1-based): rule "named" = the ones the prompt names
//                             (in the order named, at most max), "always" = the named ones, then the first ones, "never" = none
//   sceneRefsPrompt(text, picked, wording, descs)
//                             the scene is the model's picture 1, the references follow (picked[0] = picture 2 …): every
//                             mention of a picked reference is renumbered and renamed to the model's word ("picture 1" ->
//                             "image 2" for Klein), and a first line says which picture is which
//   retag(text, wording)      only the word: "picture 2" -> "image 2" / "<image2>" (the number kept)
"use strict";
const path = require("path");

const KLEIN = /klein|flux[._ -]?2|flux[._ -]?3/i;
function wordingFor(style, base) {
  const s = style || {};
  try { if (require("./qwenRefs").isQwen21Style(s, base || "")) return "qwen21"; } catch (e) { /* no graph to read */ }
  try { const R = require("./imageRefs"); if (R.isKlein9b(s) || R.isKlein3(s)) return "image"; } catch (e) { /* fine */ }
  if ([s.arch, s.model, s.workflow, s.name, s.id].some((v) => KLEIN.test(path.basename(String(v || ""))))) return "image";
  return "picture";
}
function tag(i, wording) {
  const n = Math.max(1, parseInt(i, 10) || 1);
  return wording === "qwen21" ? `<image${n}>` : wording === "image" ? `image ${n}` : `Picture ${n}`;
}
// "picture 1", "Picture #2", "<Picture 3>", "<image1>", "image 2", "img 2", "pic 1", "photo 1", "ref 2", "reference 1"
const MENTION = /<\s*(?:picture|image)\s*(\d{1,2})\s*>|\b(?:pictures?|images?|imgs?|pics?|photos?|refs?|references?)\s*(?:no\.?\s*|#\s*)?(\d{1,2})\b/gi;
function mentions(text) {
  const out = [];
  String(text || "").replace(MENTION, (_m, a, b) => { const n = parseInt(a || b, 10); if (n >= 1 && !out.includes(n)) out.push(n); return _m; });
  return out;
}
function pickRefs(text, have, max, rule) {
  const H = Math.max(0, parseInt(have, 10) || 0), M = Math.max(0, parseInt(max, 10) || 0);
  if (rule === "never" || !H || !M) return [];
  const named = mentions(text).filter((n) => n <= H);
  if (rule === "always") for (let i = 1; i <= H && named.length < M; i++) if (!named.includes(i)) named.push(i);
  return named.slice(0, M);
}
function sceneRefsPrompt(text, picked, wording, descs) {
  return withRefs(text, picked, wording, descs, "the 3D scene - keep its layout, camera angle, poses and composition");
}
/** 2.556.0: the same for any picture as the model's picture 1 (an Edit / a fill / a refine in the image editor): `first`
 *  says what picture 1 is; the References docker's numbers in the text become the model's (picked[0] = its picture 2) */
const EDIT_FIRST = "the picture to change - keep everything the instruction does not change";
function withRefs(text, picked, wording, descs, first) {
  const P = (picked || []).map((n) => parseInt(n, 10)).filter((n) => n >= 1);
  const at = (n) => P.indexOf(n);                       // docker number -> its place among the references
  const t = String(text || "").trim().replace(MENTION, (m, a, b) => {
    const n = parseInt(a || b, 10), k = at(n);
    return k < 0 ? m : tag(k + 2, wording);
  });
  const D = descs || [];
  const line = [`${tag(1, wording)} is ${first || EDIT_FIRST}`]
    .concat(P.map((n, k) => { const d = String(D[k] || "").replace(/\s+/g, " ").trim().slice(0, 120); return `${tag(k + 2, wording)} is a reference picture${d ? ` (${d})` : ""}`; }))
    .join("; ") + ".";
  return P.length ? `${line}\n${t}` : t;
}
function retag(text, wording) {
  return String(text || "").replace(/<\s*(?:picture|image)\s*(\d{1,2})\s*>|\b(?:picture|image)\s*(?:#\s*)?(\d{1,2})\b/gi, (_m, a, b) => tag(a || b, wording));
}

module.exports = { wordingFor, tag, mentions, pickRefs, sceneRefsPrompt, withRefs, EDIT_FIRST, retag, KLEIN };
