// bitGen Studio — lib/scenePictures.js (2.563.0): every StoryBoard scene's own pictures, by scene, for the pickers.
//
// Tim: "in the scene frame in storyboard, allow user to add reference images to each scene, include images from
// previous scenes".
// The pictures a scene holds live in projects/<p>/scene_refs/<scene id>/ (lib/sceneRefs): its reference pictures
// (refs), its First / Last frames (fl_first / fl_last) and its ✎ First frame pictures (qe_pica / qe_location /
// qe_prop_*). The picker's 🎬 Scenes tab lists them per scene number (not by folder id), each with the project-relative
// path the pickers already take (kind "project", rel) - so a picture of scene 2 becomes scene 5's reference, Picture A,
// location, prop or First / Last frame through the same endpoints.
//   list(project, st, except)  -> [{n, chapter, take, items: [{rel, label, what, url}]}] (scene `except` left out;
//                                 only files on disk)
"use strict";
const fs = require("fs");
const path = require("path");
const sceneRefs = require("./sceneRefs");

function list(project, st, except) {
  const out = [];
  const rows = ((st && st.list) || []).filter((r) => r && r.id && r.n !== except).sort((a, b) => a.n - b.n);
  for (const r of rows) {
    const d = sceneRefs.dir(project, r.id), folder = path.basename(d);
    const items = [];
    const push = (file, label, what, url) => {
      if (!file || !fs.existsSync(path.join(d, path.basename(file)))) return;
      items.push({ rel: `scene_refs/${folder}/${path.basename(file)}`, label: String(label || file).slice(0, 80), what, url });
    };
    const fileUrl = (kind, f) => `/api/scenes/${r.n}/${kind}/${encodeURIComponent(path.basename(f))}`;
    for (const sl of sceneRefs.SLOTS) {
      const x = r["fl_" + sl];
      if (x && x.file) push(x.file, `${sl === "first" ? "First" : "Last"} frame${x.label ? " - " + x.label : ""}`, sl, `/api/scenes/${r.n}/fl/${sl}`);
    }
    for (const x of r.refs || []) if (x && x.file) push(x.file, x.label || x.file, "ref", fileUrl("refs", x.file));
    const q = r.qedit || {};
    if (q.pica && q.pica.file) push(q.pica.file, `Picture A${q.pica.label ? " - " + q.pica.label : ""}`, "pica", fileUrl("qedit/pic", q.pica.file));
    if (q.location && q.location.file) push(q.location.file, `✎ location${q.location.label ? " - " + q.location.label : ""}`, "location", fileUrl("qedit/pic", q.location.file));
    for (const p of q.props || []) if (p && p.file) push(p.file, `✎ prop${p.label ? " - " + p.label : ""}`, "prop", fileUrl("qedit/pic", p.file));
    if (items.length || r.output) out.push({ n: r.n, chapter: r.chapter || "", take: !!r.output, items });
  }
  return out;
}

module.exports = { list };
