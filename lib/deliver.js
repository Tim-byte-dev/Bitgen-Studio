// bitGen Studio — lib/deliver.js (2.407.0): the 📤 EXPORT queue's server side. The presets (lib/exportPresets.json -
// scripts/deliver.py reads the same file), the deliverables as the compile takes them (normalize), and the files a
// compile delivered (the project root: <stem>.mp4 + <stem>_<name>.<ext>).
// Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do".
// 2.410.0 (Tim: "continue with the next stages of the premier gap closure"): range() - the deliverables of the In / Out
// part only (tl.deliverRange "io" + the ruler selection tl.sel); saveStill() - 🖼 the frame at the position marker as
// a PNG beside the movies (<stem>_frame_<HHhMMmSSsFF>.png).
// 2.412.0: tc() keeps drop-frame (29.97 / 59.94: "HH:MM:SS;FF").
// 2.417.0: a deliverable's colour (sdr | hdr10 | hlg | rec2020) on the 10-bit presets.
"use strict";
const fs = require("fs");
const path = require("path");
const P = require("./exportPresets.json");

const IDS = P.presets.map((p) => p.id);
const pick = (v, list, d) => (list.includes(String(v)) ? String(v) : d);
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

/** one deliverable -> {preset, size, aspect, fit, fps, quality, name} or null */
function one(d) {
  if (!d || typeof d !== "object" || !IDS.includes(d.preset)) return null;
  const o = { preset: d.preset, size: pick(d.size, P.sizes, "source"), aspect: pick(d.aspect, P.aspects, "source"),
              fit: pick(d.fit, P.fits, "crop"), fps: pick(d.fps, P.fps, "source"), quality: pick(d.quality, P.qualities, "standard") };
  // 2.417.0: HDR10 / HLG / Rec.2020 SDR - a 10-bit ('wide') preset only (scripts/hdr.py)
  const pre = P.presets.find((x) => x.id === o.preset);
  const col = pre && pre.wide ? pick(d.colour, P.colours || ["sdr"], "sdr") : "sdr";
  if (col !== "sdr") o.colour = col;
  const bits = [o.preset];
  if (o.aspect !== "source") bits.push(o.aspect.replace(":", "x"));
  if (o.size !== "source") bits.push(o.size + "p");
  if (o.fps !== "source") bits.push(o.fps + "fps");
  if (o.colour) bits.push(o.colour);
  o.name = bits.join("_");
  return o;
}
/** the queue for the compile: valid ones, names made unique, 12 at most */
function normalize(list) {
  if (!Array.isArray(list)) return [];
  const seen = {};
  return list.map(one).filter(Boolean).slice(0, 12).map((d) => {
    seen[d.name] = (seen[d.name] || 0) + 1;
    if (seen[d.name] > 1) d.name += "_" + seen[d.name];
    return d;
  });
}
const TC = /^(\d{2}):([0-5]\d):([0-5]\d)[:;](\d{2})$/;
const TCM = require("../static/timecode.js");
/** tl.tc = {start: "HH:MM:SS:FF", fps, drop} -> the same or null; 2.412.0: drop-frame (29.97 / 59.94) written
 * "HH:MM:SS;FF" (a ";" asked for on another rate = non-drop) */
function tc(t) {
  if (!t || typeof t !== "object") return null;
  const s = String(t.start || "").trim();
  if (!TC.test(s)) return null;
  const f = Number(t.fps), fps = Number.isFinite(f) && f > 0 && f <= 120 ? f : 25;
  const drop = TCM.isDrop({ start: s, fps, drop: t.drop }, fps);
  const start = TCM.norm(s, fps, drop);
  if (!start) return null;
  return drop ? { start, fps, drop: true } : { start, fps };
}

/** tl.deliverRange ("io" = the In / Out part) + tl.sel {a, b} -> {a, b} (seconds) or null (the whole movie) */
function range(mode, sel) {
  if (mode !== "io" || !sel || typeof sel !== "object") return null;
  const a = Number(sel.a), b = Number(sel.b);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b - a < 0.04 || b > 86400) return null;
  return { a: Math.round(a * 10000) / 10000, b: Math.round(b * 10000) / 10000 };
}
/** a PNG's bytes -> its file beside the movies; t (s) and fps name it by its timecode -> {name, size} */
function saveStill(dir, stem, buf, t, fps) {
  if (!Buffer.isBuffer(buf) || buf.length < 60 || buf.readUInt32BE(0) !== 0x89504e47) throw bad("that is not a PNG picture");
  if (buf.length > 64 * 1024 * 1024) throw bad("that picture is too big (64 MB at most)", 413);
  const f = Number.isFinite(Number(fps)) && Number(fps) > 0 ? Math.round(Number(fps)) : 25;
  const n = Math.max(0, Math.round((Number(t) || 0) * f));
  const p2 = (v) => String(v).padStart(2, "0");
  const name = `${stem}_frame_${p2(Math.floor(n / (3600 * f)))}h${p2(Math.floor(n / (60 * f)) % 60)}m${p2(Math.floor(n / f) % 60)}s${p2(n % f)}.png`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  return { name, size: buf.length };
}

/** the movies a compile made for this project: the master + its deliverables (newest first) */
function files(dir, stem) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { names = []; }
  const re = new RegExp("^" + stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:(_[A-Za-z0-9_x]+)?\\.(mp4|mov|webm|gif|wav|mp3|srt|png)|_lottie\\.json)$");   // 2.512.0: + <stem>_lottie.json
  return names.filter((n) => re.test(n)).map((n) => {
    const st = fs.statSync(path.join(dir, n));
    return { name: n, size: st.size, mtime: Math.round(st.mtimeMs) };
  }).sort((a, b) => b.mtime - a.mtime);
}
function filePath(dir, stem, name) {
  const n = path.basename(String(name || ""));
  if (!files(dir, stem).some((f) => f.name === n)) throw bad("no delivered file called " + n, 404);
  return path.join(dir, n);
}

module.exports = { PRESETS: P, normalize, one, tc, range, saveStill, files, filePath };
