"use strict";
/**
 * qwenRefs.js — THE REFERENCE DOCK'S PICTURES AS QWEN IMAGE 2.1's (2.340.0).
 *
 * Tim: "allow qwen 2.1 to use reference docker images as it's reference
 * images. add a style , qwen2_1 , should be able to use up to 10 images".
 *
 * Qwen Image 2.1 (TextEncodeQwenImage21) names its pictures <image1>..<imageN>
 * in the prompt. The dock's own words are <Picture n> / <subject n> (H3's
 * mapping lines, prepended by the page), so for a Qwen 2.1 graph:
 *   - <Picture n> -> <imagen>, <subject n> -> "subject n";
 *   - a prompt that names no picture at all gets one line saying what each
 *     picture is, from its Type in the dock ("<image1> is the person, <image2>
 *     is the clothing ...") - otherwise Qwen has to guess.
 * Pure; routes/index.js /api/genimage calls it.
 */
const fs = require("fs");
const path = require("path");

const MAX_IMAGES = 10;
const CLASS = "TextEncodeQwenImage21";
/* 2.582.0: Fibo 2.0's TextEncodeFibo2 takes its pictures the same way (images.image_N) but names them <image_1>..<image_4>
   in the prompt - the same mapping, its own tag (fmt "fibo2") */
const FIBO_CLASS = "TextEncodeFibo2";
const TAG = { qwen21: (n) => `<image${n}>`, fibo2: (n) => `<image_${n}>` };

/** Does this API workflow (abs path) encode with Qwen Image 2.1? */
function hasClass(file, cls) {
  try {
    const g = JSON.parse(fs.readFileSync(file, "utf8"));
    return Object.values(g).some((n) => n && n.class_type === cls);
  } catch { return false; }
}
function isQwen21Workflow(file) { return hasClass(file, CLASS); }
const wfOf = (style, base) => { const rel = String((style && style.workflow) || "").trim(); return rel ? (path.isAbsolute(rel) ? rel : path.join(base, rel)) : ""; };
function isQwen21Style(style, base) { const f = wfOf(style, base); return !!f && isQwen21Workflow(f); }
/** 2.582.0: a Fibo 2.0 graph (TextEncodeFibo2)? */
function isFibo2Style(style, base) { const f = wfOf(style, base); return !!f && hasClass(f, FIBO_CLASS); }
/** the reference-tag format of a style's graph: "qwen21" | "fibo2" | "" */
function refFormat(style, base) { return isQwen21Style(style, base) ? "qwen21" : isFibo2Style(style, base) ? "fibo2" : ""; }

const ROLE_WORDS = {
  "person": "the person", "face": "the face to use", "body": "the body", "hair": "the hair",
  "clothing": "the clothing", "outfit detail": "an outfit detail", "pose": "the pose to copy",
  "expression": "the expression", "object": "an object to include", "environment": "the location / background",
  "style": "the art style to follow", "first frame": "the picture to edit", "last frame": "the target picture",
};
const roleWords = (r) => ROLE_WORDS[String(r || "").toLowerCase()] || (r ? `the ${String(r).toLowerCase()}` : "a reference");

/**
 * The prompt for a Qwen 2.1 render with n pictures and their dock Types.
 * -> { prompt, note }.
 */
function prompt(text, n, roles, fmt) {
  const tg = TAG[fmt] || TAG.qwen21, who = fmt === "fibo2" ? "Fibo" : "Qwen";
  let t = String(text || "");
  const own = fmt === "fibo2" ? /<\s*image_\d+\s*>/i : /<\s*image\d+\s*>/i;
  const had = own.test(t);
  t = t.replace(/<\s*(?:picture|image)\s*_?\s*(\d+)\s*>/gi, (_m, d) => tg(d))
       .replace(/<\s*subject\s*(\d+)\s*>/gi, (_m, d) => `subject ${d}`);
  const count = Math.max(0, Math.min(MAX_IMAGES, n | 0));
  if (!count) return { prompt: t, note: "" };
  const named = own.test(t);
  if (named) return { prompt: t, note: had ? "" : `the dock's <Picture n> tags written as ${who}'s ${tg("N")}` };
  const rs = Array.isArray(roles) ? roles : [];
  const line = Array.from({ length: count }, (_x, i) => `${tg(i + 1)} is ${roleWords(rs[i])}`).join(", ") + ".";
  return { prompt: line + "\n" + t.trim(), note: `the pictures named for ${who}: ${line}` };
}

module.exports = { MAX_IMAGES, CLASS, FIBO_CLASS, isQwen21Workflow, isQwen21Style, isFibo2Style, refFormat, roleWords, prompt };
