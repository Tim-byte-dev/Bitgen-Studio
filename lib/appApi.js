// bitGen Studio — lib/appApi.js (2.909.0): WHAT THE 📱 bitGen APP ASKS THIS COMPUTER FOR (routes/appApi.js).
//
// Tim: "lets do my pc first" - the phone app (mobile/) drives this computer's studio over the network, paired through
// Settings ▸ General ▸ Remote access (lib/remote.js, lib/remoteGuard.js). The app does not re-implement which endpoint
// each video model renders through - the prompt docker decides that in the page (LTX -> /api/ltx, H3 Long Video ->
// /api/h3long, PAN 2 -> /api/pan2, Swap -> /api/swap, everything else -> /api/generate, each with its own form). Here
// the same decision is made once for the app: POST /api/app/video takes ONE form and hands the right form to the right
// endpoint on this computer (127.0.0.1), so a render from the phone is the same job a render from the page is.
//   routeFor(style)               "ltx" | "h3long" | "pan2" | "swap" | "generate"
//   mapLines(n)                   the prompt docker's auto mapping for n pictures ("<subject 1> is in <Picture 1>" ...)
//   basicOf(b)                    the app's Override fields -> the `basic` JSON every video endpoint reads
//   formFor(route, b, pics)       -> {path, fields: [[k, v]], files: [[field, pic]]} (pure)
//   info()                        version, project, the styles (video / image / 2.910.0 music), defaults
//   submitVideo(b, pics, port)    the form sent to this computer's own endpoint -> {status, body}
//   writeSong(idea, style_id)     2.911.0: the PC's LLM writes {title, style, lyrics} (lib/songwriter.js)
// Pure (scripts/test-909.js): routeFor, mapLines, basicOf, formFor; songMessages (test-911.js).
"use strict";

const LTX_RX = /^ltx-2\.[35]$/;
function routeFor(st) {
  const s = st || {};
  if (s.role === "swap" || s.swap) return "swap";
  if (LTX_RX.test(String(s.arch || ""))) return "ltx";
  if (s.arch === "h3-long") return "h3long";
  if (s.arch === "pan2") return "pan2";
  return "generate";
}
function mapLines(n) {
  const out = [];
  for (let i = 1; i <= Math.min(9, n | 0); i++) out.push(`<subject ${i}> is in <Picture ${i}>`);
  return out.join("\n");
}
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
function basicOf(b) {
  const x = b || {};
  const on = x.override === true || x.override === "true" || x.override === "1" || x.override === 1;
  return JSON.stringify({ override: on, steps: Math.max(0, Math.round(num(x.steps, 0))), cfg: x.cfg === "" || x.cfg == null ? "" : num(x.cfg, 1),
    seed: Math.round(num(x.seed, -1)), model: "", loras: [] });
}
/** b = {prompt, style_id, width, height, seconds, steps, cfg, seed, override, negative}; pics = [{name, mime, buffer}] */
/** reference video / sound names (bare, at most 3) from an array or a JSON string (pure) */
function av(v) {
  let a = v; if (typeof a === "string") { try { a = JSON.parse(a); } catch { a = []; } }
  return (Array.isArray(a) ? a : []).map((n) => String(n || "").split(/[\\/]/).pop()).filter(Boolean).slice(0, 3);
}
function formFor(route, b, pics) {
  const x = b || {}, p = pics || [];
  const w = String(Math.round(num(x.width, 960))), h = String(Math.round(num(x.height, 544)));
  const secs = Math.max(1, num(x.seconds, 5)), seed = String(Math.round(num(x.seed, -1)));
  const steps = String(Math.max(0, Math.round(num(x.steps, 0)))), cfg = String(num(x.cfg, 1));
  const prompt = String(x.prompt || "").trim(), style = String(x.style_id || ""), basic = basicOf(x);
  const fields = [], files = [];
  const add = (k, v) => fields.push([k, String(v)]);
  if (route === "ltx") {
    add("prompt", prompt); add("ltx_mode", "auto"); add("transition", "auto");
    add("seconds", Math.max(1, Math.min(30, Math.round(secs)))); add("width", w); add("height", h); add("seed", seed);
    add("format", "mp4"); add("basic", basic); add("video_style_id", style); add("ref_videos", JSON.stringify(av(x.ref_videos))); add("ref_audios", JSON.stringify(av(x.ref_audios)));
    if (x.negative) add("negative", x.negative);
    p.slice(0, 3).forEach((f) => files.push(["references", f]));
    return { path: "/api/ltx", fields, files };
  }
  if (route === "h3long") {
    add("prompt", prompt); add("seconds", Math.min(120, secs)); add("width", w); add("height", h); add("seed", seed); add("steps", steps);
    add("upscale2k", "0"); add("video_style_id", style); add("basic", basic);
    if (p[0]) files.push(["first", p[0]]);
    p.slice(1, 5).forEach((f) => files.push(["refs", f]));
    return { path: "/api/h3long", fields, files };
  }
  if (route === "pan2") {
    add("prompt", prompt); add("seconds", Math.min(20, secs)); add("width", w); add("height", h); add("seed", seed); add("steps", steps);
    add("video_style_id", style); add("basic", basic);
    if (x.negative) add("negative", x.negative);
    if (p[0]) files.push(["first", p[0]]);
    return { path: "/api/pan2", fields, files };
  }
  // MiniMax H3 / Wan / the rest: /api/generate - pictures = References (ref2va) with the prompt docker's mapping
  const refs = p.slice(0, 9), vids = av(x.ref_videos), auds = av(x.ref_audios);   // 2.916.0: + the app's reference videos / sounds
  const m = refs.length ? mapLines(refs.length) : "";
  add("mode", refs.length || vids.length || auds.length ? "ref2va" : "t2va");
  if (vids.length) add("ref_videos", JSON.stringify(vids));
  if (auds.length) add("ref_audios", JSON.stringify(auds));
  add("prompt", m && !prompt.includes("is in <Picture") ? m + "\n\n" + prompt : prompt);
  if (x.negative) add("negative", x.negative);
  add("width", w); add("height", h); add("steps", steps); add("cfg", cfg); add("seed", seed); add("format", "mp4");
  add("frames", Math.max(1, Math.min(5760, Math.round(secs * 24))));
  if (style) add("video_style_id", style);
  add("basic", basic);
  refs.forEach((f) => files.push(["references", f]));
  return { path: "/api/generate", fields, files };
}

/* ---------------- live */
function info() {
  const core = require("./core"), styles = require("./styles");
  let version = "";
  try { version = require("../package.json").version; } catch { version = ""; }
  const brief = (s) => ({ id: s.id, name: s.name, arch: s.arch || "", route: routeFor(s) });
  let video = [], image = [];
  try { video = styles.read(core.STYLES_DIR, "video").map(brief); } catch { video = []; }
  try {
    image = styles.read(core.STYLES_DIR, "image").map((s) => Object.assign(brief(s), {
      slots: (() => { try { return styles.imageSlots(s, core.BASE); } catch { return 0; } })(),
      refs_optional: s.refs_optional === true }));
  } catch { image = []; }
  // 2.910.0 (Tim: "add music"): the song styles - their sound words (caption) and length fill the app's fields
  let music = [];
  try {
    music = styles.read(core.STYLES_DIR, "music").map((s) => ({ id: s.id, name: s.name, arch: s.arch || "",
      caption: String(s.caption || "").slice(0, 2000), seconds: +s.max_duration || 0,
      max_seconds: (() => { try { return +(((styles.musicArchById(s.arch) || {}).limits || {}).max_duration) || 600; } catch { return 600; } })() }));
  } catch { music = []; }
  const c = core.getConfig() || {}, d = c.defaults || {};
  return { app: "bitGen Studio", version, project: core.getProject(), video_styles: video, image_styles: image, music_styles: music,
           ui: { vstyle: ((c.ui || {}).vstyle) || "", style: ((c.ui || {}).style) || "", music: ((c.ui || {}).music) || "" },
           defaults: { width: d.width || 960, height: d.height || 544, seconds: d.frames ? Math.round(d.frames / 24 * 2) / 2 : 5 } };
}
async function submitVideo(b, pics, port) {
  const core = require("./core"), styles = require("./styles");
  const st = styles.byId(core.STYLES_DIR, String((b || {}).style_id || ""));
  if (!st) return { status: 400, body: { error: "pick a video style first" } };
  const route = routeFor(st);
  if (route === "swap") return { status: 400, body: { error: `"${st.name}" is a character-swap style - it needs a reference video; use it from the studio on the computer` } };
  const f = formFor(route, b, pics);
  const fd = new FormData();
  for (const [k, v] of f.fields) fd.append(k, v);
  for (const [k, pic] of f.files) fd.append(k, new Blob([pic.buffer], { type: pic.mime || "image/png" }), pic.name || "picture.png");
  const r = await fetch(`http://127.0.0.1:${port}${f.path}`, { method: "POST", body: fd });
  let body = {};
  try { body = await r.json(); } catch { body = { error: `${f.path} answered HTTP ${r.status}` }; }
  return { status: r.status, body: Object.assign({ route, endpoint: f.path }, body) };
}
/** 2.911.0 (Tim: "does the music prompt work the same as in bitgen? the llm writes it?"): ✨ Write the song - the PC's LLM
 *  writes TITLE / STYLE / LYRICS from an idea, the same songwriter the prompt chat uses for "make a song about ..."
 *  (lib/songwriter.js FORMAT_NOTE + parse); the music style's own sound words steer STYLE. -> {title, style, lyrics} */
function songMessages(idea, caption) {
  const sw = require("./songwriter");
  return [{ role: "system", content: "You are a songwriter for a music-generation model. Write singable, original lyrics with a clear verse /"
      + " chorus shape and no explanations." + (caption ? "\n\nThe music style it will be sung in: " + String(caption).slice(0, 600)
      + " - keep STYLE in that spirit unless the idea asks for something else." : "") + sw.FORMAT_NOTE },
    { role: "user", content: "Make a song: " + String(idea || "").slice(0, 2000) }];
}
async function writeSong(idea, styleId) {
  const core = require("./core"), styles = require("./styles"), llm = require("./llmChat"), sw = require("./songwriter");
  const text = String(idea || "").trim();
  if (!text) return { status: 400, body: { error: "say what the song is about first" } };
  let caption = "";
  try { const st = styleId ? styles.byId(core.STYLES_DIR, String(styleId)) : null; caption = (st && st.caption) || ""; } catch { caption = ""; }
  const out = await llm.complete(core, { messages: songMessages(text, caption), temperature: 0.8, max_tokens: 900 });
  if (!out || !out.ok) return { status: (out && out.status) || 502, body: { error: (out && out.error) || "the LLM did not answer" } };
  const song = sw.parse(out.text);
  if (!song) return { status: 502, body: { error: "the LLM answered, but not as a song (TITLE / STYLE / LYRICS) - try again, or another LLM", reply: String(out.text || "").slice(0, 1500) } };
  return { status: 200, body: song };
}
module.exports = { av, routeFor, mapLines, basicOf, formFor, info, submitVideo, songMessages, writeSong };
