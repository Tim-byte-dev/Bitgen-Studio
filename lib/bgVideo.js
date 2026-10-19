// bitGen Studio — lib/bgVideo.js (2.436.0): the VIDEO PROJECT as a .bgv file (XML).
//
// Tim (verbatim): "save video project as .bgv" (+ "bgv XML"). A .bgv is the timeline the page has open - every layer,
// clip, keyframe, effect, caption, marker and setting exactly as bitGen keeps it (static/bgxml.js's value XML, read
// back to the same JSON) - plus the NESTED timelines its nest clips use (lib/nest.js; through nests inside nests) and
// a MEDIA list: every file the clips play, the folder it was found in and whether it was there when saved. Opening one
// makes it a named timeline of the open project; its nested timelines are added when the project has none of that
// name, and a file the project does not have is reported (add it to the assets - the clip is kept and plays once the
// file is there).
//
//   <bitgen-video version="1" app="2.436.0" name="main" project="P" saved="ISO time">
//     <timeline name="main"><o>…the timeline…</o></timeline>
//     <nested name="intro"><o>…</o></nested>…
//     <media><file name="a.mp4" folder="video" kind="video" found="true"/>…</media>
//   </bitgen-video>
//
//   clipsOf(tl)                    every clip: [{c, kind}] (V1, video layers, sound layers, picture layers)
//   mediaOf(tl, find)              [{name, folder, kind, found}] - one per file (find(name, kind) -> folder | null)
//   nestsOf(tl)                    the timeline names its nest clips use (directly)
//   toXml({tl, name, project, app, nested: {name: tl}, media})   -> the file's text
//   fromXml(text)                  -> {name, project, app, saved, tl, nested: {name: tl}, media}  (throws 400 when it is not one)
//   finder(pdir)                   find(name, kind) over a project folder: where the file is (video, output, images, sound, final, the root)
"use strict";
const fs = require("fs");
const path = require("path");
const X = require("../static/bgxml.js");

const VERSION = 1;
const IMG = /\.(png|jpe?g|webp|bmp|gif|tiff?|jxl)$/i, SND = /\.(wav|mp3|ogg|flac|m4a|aac|opus)$/i;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

function clipsOf(tl) {
  const t = tl || {}, out = [];
  (t.video || []).forEach((c) => c && out.push({ c, kind: "video" }));
  (t.vlayers || []).forEach((L) => ((L && L.clips) || []).forEach((c) => c && out.push({ c, kind: "video" })));
  (t.audio || []).forEach((L) => ((L && L.clips) || []).forEach((c) => c && out.push({ c, kind: "audio" })));
  (t.images || []).forEach((L) => ((L && L.clips) || []).forEach((c) => c && out.push({ c, kind: "image" })));
  return out;
}
function kindOfName(n, k) { return IMG.test(n) ? "image" : SND.test(n) ? "audio" : k || "video"; }
function mediaOf(tl, find) {
  const seen = new Map();
  for (const { c, kind } of clipsOf(tl)) {
    if (!c.name || c.text || c.adjust || c.mogrt || c.textfx || c.solid) continue;      // made by bitGen, not a file
    const n = path.basename(String(c.name)), k = kindOfName(n, kind);
    if (!n || seen.has(n)) continue;
    const folder = find ? find(n, k, c) : null;
    seen.set(n, { name: n, folder: folder || (c.src ? String(c.src) : ""), kind: k, found: !!folder });
  }
  return [...seen.values()];
}
function nestsOf(tl) { const s = new Set(); for (const { c } of clipsOf(tl)) if (c.nest) s.add(String(c.nest)); return [...s]; }

function toXml(o) {
  const parts = [`\n  <timeline name="${X.attr(o.name || "main")}">${X.toXml(o.tl || {}, null, null, 2)}\n  </timeline>`];
  for (const [n, t] of Object.entries(o.nested || {})) parts.push(`\n  <nested name="${X.attr(n)}">${X.toXml(t || {}, null, null, 2)}\n  </nested>`);
  parts.push("\n  <media>" + (o.media || []).map((m) => `\n    <file name="${X.attr(m.name)}" folder="${X.attr(m.folder || "")}" kind="${X.attr(m.kind || "")}" found="${m.found ? "true" : "false"}"/>`).join("") + "\n  </media>");
  return X.doc("bitgen-video", { version: VERSION, app: o.app || "", name: o.name || "main", project: o.project || "", saved: o.saved || new Date().toISOString() }, parts);
}
function fromXml(text) {
  let t;
  try { t = X.parse(String(text || "")); } catch (e) { throw bad("not a .bgv file: " + e.message); }
  const root = X.child(t, "bitgen-video");
  if (!root) throw bad("not a .bgv file (no <bitgen-video>)");
  if (+root.attrs.version > VERSION) throw bad(`this .bgv was written by a newer bitGen (file version ${root.attrs.version})`);
  const tlEl = X.child(root, "timeline");
  const tl = tlEl ? X.fromXml(tlEl) : null;
  if (!tl || typeof tl !== "object" || Array.isArray(tl)) throw bad("the .bgv has no timeline");
  const nested = {};
  for (const n of X.children(root, "nested")) { const v = X.fromXml(n); if (n.attrs.name && v && typeof v === "object") nested[n.attrs.name] = v; }
  const media = X.children(X.child(root, "media"), "file").map((f) => ({ name: f.attrs.name, folder: f.attrs.folder || "", kind: f.attrs.kind || "", found: f.attrs.found === "true" }));
  return { name: root.attrs.name || (tlEl && tlEl.attrs.name) || "imported", project: root.attrs.project || "", app: root.attrs.app || "", saved: root.attrs.saved || "", version: +root.attrs.version || 1, tl, nested, media };
}
const FOLDERS = ["video", "output", "images", "sound", "final", ""];
function finder(pdir) {
  return (name, kind, c) => {
    const n = path.basename(String(name || "")); if (!n) return null;
    const first = c && c.src && FOLDERS.includes(String(c.src)) ? [String(c.src)] : [];
    const pref = kind === "image" ? ["images"] : kind === "audio" ? ["sound", "video"] : [];
    for (const d of [...first, ...pref, ...FOLDERS]) {
      try { if (fs.statSync(path.join(pdir, d, n)).isFile()) return d || "."; } catch { /* next */ }
    }
    return null;
  };
}

module.exports = { VERSION, clipsOf, mediaOf, nestsOf, toXml, fromXml, finder };
