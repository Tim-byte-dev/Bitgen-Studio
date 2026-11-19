// routes/charSheetH3.js — 2.870.0: the Character creator's 🪪 Character sheet, made by the H3 Character Sheet Designer
// (lib/charSheetH3.js builds the graph; lib/h3SheetAddon.js installs the pack + MiniMax H3 Image). Mounted from
// routes/index.js (never server.js). It replaces /api/characters/sheetgen and /api/characters/sheetstyles.
//   GET  /api/charsheet/h3            {installed, pack, note, items, catalog {views, presets, clothing, hands, feet, styles,
//                                      roles, parts, sizes}}
//   POST /api/charsheet/h3/preview    {choices, layout, style, refs: [bool ×3]} -> {width, height, megapixels, panels
//                                      [{id, rect, view}], defaults {view: instruction}, summary, experimental}
//                                      | {offline: true, summary} (ComfyUI not running) | {nopack: true, summary} | 400 {error}
//   POST /api/charsheet/h3/mannequin  {sex: male|female} -> {name, url, sheet, views, label, heads, height_cm} (2.873.0)
//   POST /api/charsheet/h3            multipart: image (the character), ref1..ref3 (part pictures); fields choices (JSON),
//                                      layout, style, tiled, seed, file (an earlier upload, for ↻), ref_files (JSON [3 names])
//                                      -> a graph job + {input, refs, summary} | 400 / 409 / 503 {error, needs?}
"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");

const IMG = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
function err(status, message, extra) { return Object.assign(new Error(message), { status, extra }); }
function wrap(fn) {
  return async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { res.status(e.status || 500).json(Object.assign({ error: e.message || String(e) }, e.extra || {})); }
  };
}
const truthy = (v) => v === true || v === "true" || v === "1" || v === 1;
function choicesOf(v) {
  if (v && typeof v === "object") return v;
  try { return JSON.parse(String(v || "{}")) || {}; } catch (e) { throw err(400, "the sheet's settings could not be read"); }
}

/** keep an uploaded picture in the project's images folder (multer temp file or memory) -> its name */
function keep(core, f, stem) {
  if (!f) return "";
  const ext = (path.extname(f.originalname || "") || ".png").toLowerCase();
  if (!IMG.includes(ext)) throw err(400, `${f.originalname || "that file"} is not a picture (PNG, JPG, WebP or BMP)`);
  const dir = core.pDir("images");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${stem}-${Date.now().toString(36)}${ext}`;
  if (f.buffer) fs.writeFileSync(path.join(dir, name), f.buffer);
  else fs.copyFileSync(f.path, path.join(dir, name));
  return name;
}
/** an earlier upload named by the page (↻ Regenerate) - only a plain file name in the project's images */
function again(core, name, what) {
  const n = path.basename(String(name || ""));
  if (!n) return "";
  if (!IMG.includes(path.extname(n).toLowerCase()) || !fs.existsSync(path.join(core.pDir("images"), n)))
    throw err(400, `${what} ${n} is not in this project's Images any more - load the picture again`);
  return n;
}

function mount(app) {
  const S = () => require("../lib/charSheetH3");
  const A = () => require("../lib/h3SheetAddon");
  const core = require("../lib/core");
  const J = express.json({ limit: "1mb" });
  const upload = require("../lib/tempUpload").tempUpload({ fileSize: 100 * 1024 * 1024 });

  app.get("/api/charsheet/h3", wrap(() => {
    const st = A().status();
    const s = S();
    return Object.assign({}, st, { catalog: { views: s.VIEWS, presets: s.PRESETS, clothing: s.CLOTHING, hands: s.HANDS,
      feet: s.FEET, styles: s.STYLES, roles: s.ROLES, parts: s.PARTS, sizes: s.SIZES }, pack: Object.assign({ present: st.pack }, s.PACK) });
  }));

  /* 2.873.0 (Tim: "create the mannequin character sheet using a 3d mannequin, for male and female"): bitGen Studio's own
     3D mannequin (static/mannequin3d.js, rendered by scripts/make_mannequins.js into static/mannequins/) kept in the
     project's Images as mannequin-<sex>.png - the sheet tab opens it as the start picture, Dress it sends it to an edit style */
  app.post("/api/charsheet/h3/mannequin", J, wrap(async (req) => {
    const sex = String((req.body || {}).sex || "");
    const M = require("../static/mannequin3d.js");
    // 2.874.0: one of YOUR mannequins ("own:<id>" - lib/sheetLibrary.js)
    if (sex.startsWith("own:")) {
      const LIB = require("../lib/sheetLibrary"), it = LIB.item("mannequins", sex.slice(4));
      if (!it) throw err(404, "that mannequin is not in your library any more");
      const dir0 = core.pDir("images"); fs.mkdirSync(dir0, { recursive: true });
      const nm = "mannequin-own-" + it.id + path.extname(it.file);
      fs.copyFileSync(LIB.file("mannequins", it.id), path.join(dir0, nm));
      return { name: nm, url: "/passets/images/" + encodeURIComponent(nm), label: it.name, own: true, w: it.w, h: it.h };
    }
    if (!M.SEXES.includes(sex)) throw err(400, "pick the male or the female mannequin");
    const src = path.join(core.BASE, "static", "mannequins", sex + "_front.png");
    if (!fs.existsSync(src)) throw err(500, "the mannequin picture is missing - run node scripts/make_mannequins.js");
    const dir = core.pDir("images");
    fs.mkdirSync(dir, { recursive: true });
    const name = "mannequin-" + sex + ".png";
    fs.copyFileSync(src, path.join(dir, name));
    const P = M.PROPS[sex];
    return { name, url: "/passets/images/" + encodeURIComponent(name), sheet: "/static/mannequins/" + sex + "_sheet.png",
      views: ["front", "side", "back"].map((v) => "/static/mannequins/" + sex + "_" + v + ".png"),
      label: P.label, heads: P.heads, height_cm: Math.round(P.height_m * 100) };
  }));

  app.post("/api/charsheet/h3/preview", J, wrap(async (req) => {
    const b = req.body || {};
    let st;
    try { st = S().state(choicesOf(b.choices)); } catch (e) { throw err(400, e.message); }
    const summary = S().summary(st);
    let url = "";
    try { url = require("../lib/comfy").comfyCfg().url; } catch (e) { url = ""; }
    if (!url) return { offline: true, summary };
    let r;
    try {
      r = await fetch(url + S().PREVIEW_PATH, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(S().previewBody(st, truthy(b.layout), b.style, b.refs)), signal: AbortSignal.timeout(8000) });
    } catch (e) { return { offline: true, summary }; }
    if (r.status === 404 || r.status === 405) return { nopack: true, summary };
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw err(400, (j && j.error && (j.error.message || j.error)) || `the designer answered HTTP ${r.status}`);
    const lay = j.semantic_layout || {};
    return { width: j.width, height: j.height, megapixels: j.megapixels, experimental: !!j.experimental, summary,
      panels: (lay.panels || []).map((p) => ({ id: p.id, rect: p.rect, view: p.view })), defaults: j.default_view_prompts || {} };
  }));

  app.post("/api/charsheet/h3", upload.fields([{ name: "image", maxCount: 1 }, { name: "ref1", maxCount: 1 },
                                               { name: "ref2", maxCount: 1 }, { name: "ref3", maxCount: 1 }]), wrap(async (req) => {
    const b = req.body || {};
    const files = req.files || {};
    const f1 = (k) => (files[k] && files[k][0]) || null;
    if (((core.getConfig().engine || {}).backend) !== "comfy")
      throw err(400, "The character sheet is drawn in ComfyUI - switch Settings ▸ ComfyUI ▸ Engine to ComfyUI first");
    let st;
    try { st = S().state(choicesOf(b.choices)); } catch (e) { throw err(400, e.message); }
    // the pictures: the character (new or the one from before) + up to three part pictures
    const input = f1("image") ? keep(core, f1("image"), "charsheet") : again(core, b.file, "the character picture");
    if (!input) throw err(400, "load a picture of the character first");
    let olds = Array.isArray(b.ref_files) ? b.ref_files : [];
    if (!olds.length && typeof b.ref_files === "string") { try { olds = JSON.parse(b.ref_files) || []; } catch (e) { olds = []; } }
    const refs = [1, 2, 3].map((n) => (f1("ref" + n) ? keep(core, f1("ref" + n), "charref" + n) : again(core, (olds || [])[n - 1], "part picture")));
    // what ComfyUI has
    let info;
    try { info = await require("../lib/comfy").objectInfo(15000); }
    catch (e) { throw err(503, "ComfyUI is not running - start it (the ComfyUI docker's ▶ Start), then press ▶ Generate sheet again", { needs: "comfy" }); }
    const rd = S().readiness(info);
    if (rd.missing.length) throw err(409, rd.missing.join(" · "), { needs: "h3sheet", missing: rd.missing });
    const style = String(b.style || "none");
    if (rd.styles.length && !rd.styles.includes(style)) throw err(409, `this version of the designer has no "${style}" style - update it (Settings ▸ Add-ons ▸ H3 Character Sheet Designer ⟳ Reinstall)`, { needs: "h3sheet" });
    const rolled = require("../lib/imageSeed").forRequest(b.seed === undefined || b.seed === "" ? null : Number(b.seed));
    const dir = core.pDir("images");
    // 2.874.0: a character sheet TEMPLATE from your library - its layout is followed (lib/charSheetH3.js graph)
    let template = null;
    if (b.template) {
      const LIB = require("../lib/sheetLibrary"), it = LIB.item("templates", String(b.template));
      if (!it) throw err(400, "that sheet template is not in your library any more - pick another or upload it again");
      template = { path: LIB.file("templates", it.id), w: it.w, h: it.h, name: it.name };
    }
    const built = S().graph({ state: st, layout: truthy(b.layout), style, seed: rolled.seed, names: rd.names, tiled: truthy(b.tiled),
      template, concat: !!(info && info.StringConcatenate),
      character: path.join(dir, input), refs: refs.map((n) => (n ? path.join(dir, n) : null)), prefix: "charsheet" });
    const summary = S().summary(st);
    const used = refs.filter(Boolean).length;
    const job = core.makeJob({
      mode: "graph", graph: built.graph,
      graph_name: "Character sheet: " + input,
      graph_file: "(H3 Character Sheet Designer " + S().PACK.version + " + MiniMax H3 Image)",
      graph_uploads: built.uploads,
      graph_warnings: template && !(info && info.StringConcatenate) ? ["this ComfyUI has no String Concatenate node - the template rides as the layout guide without its extra words (update ComfyUI)"] : [],
      graph_applied: [summary + (template ? " · template " + template.name : truthy(b.layout) ? " · layout guide" : "") + (style !== "none" ? " · style " + style : "")
        + (used ? ` · ${used} part picture${used > 1 ? "s" : ""}` : "") + " · seed " + rolled.seed],
      seed: rolled.seed, seed_random: rolled.random, prompt: "",
    });
    job.chunk = { i: 0, n: 1 };
    return Object.assign(core.jobDict(job), { input, refs, summary });
  }));
}
module.exports = { mount };
