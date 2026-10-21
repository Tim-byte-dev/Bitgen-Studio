// bitGen Studio — lib/storyboard.js (2.456.0): THE STORYBOARD - one picture per scene of the video docker (now the
// floating "StoryBoard" docker), made with the selected IMAGE model from the scene's prompt.
//
// Tim (verbatim): "convert video docker into floating docker - change it's name to StoryBoard - Add Thumbnails to each
// scene generated with the selected image model,give user the option to use the character sheet and location images
// added reference images as reference images for the storyboard images - give user the option in each scene to use
// storyboard image as the first or last image"
//
//   projects/<p>/storyboard/<scene id>.<ext>   the picture (by the scene's stable id - its number shifts)
//   projects/<p>/storyboard/index.json         {version, items: {<scene id>: {file, label, style, at}}}
//   pickRefs(row, images, opts)    which project pictures ride as references (pure): the CHARACTER SHEETS of the
//                                  characters the scene's prompt names, the LOCATION pictures of the locations it names,
//                                  the scene's own reference pictures + the project's References (opts.sheets /
//                                  .locations / .refs), at most MAX_REFS
//   promptFor(row)                 the scene's prompt lines as one picture prompt
//   setFromFile / clear / list / file
//   2.568.0 (Tim: "in the scene editor send the scene created by the llm back to the llm to create an image for the scene
//   thumbnail - reference image will be character and last frame of previous video if the previous video doesn't exist it
//   will be of the character + scene description - this image can be changed"):
//   roleOf(rel, group, prevLabel)  what a reference picture is, in words for the LLM ("Mara's character sheet" …)
//   llmMessages(o)                 the LLM writes the picture's prompt: the opening frame of THIS scene, the pictures by
//                                  Picture n, continuing from the scene before's last frame when it rides along (else the
//                                  place from the scene's own words); o = {roles, sceneText, prevText, hasPrev, prefix}
//   cleanPrompt(text, nImages)     its answer as one prompt (no quotes / markdown / "Prompt:", only pictures that exist)
//   setFromFile(..., prompt)       keeps the prompt the picture was made from (the card's tooltip)
// The picture is made by the ordinary image route (/api/genimage) - the client asks routes/storyboard.js for the plan,
// queues the job, and hands the finished job back (fromjob). "Use as first / last frame" is the scene's own slot
// (POST /api/scenes/:n/fl {kind: "project", rel: "storyboard/<file>"}).
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX_REFS = 8, IMG_RE = /\.(png|jpe?g|webp|bmp|gif)$/i;
const safeId = (id) => String(id || "").replace(/[^\w-]/g, "_").slice(0, 64) || "scene";
function dir(project) { const d = path.join(core.projDir(project || core.getProject()), "storyboard"); fs.mkdirSync(d, { recursive: true }); return d; }
function readIndex(project) {
  try { const j = JSON.parse(fs.readFileSync(path.join(dir(project), "index.json"), "utf8")); return j && j.items && typeof j.items === "object" ? j.items : {}; }
  catch { return {}; }
}
function writeIndex(project, items) {
  const f = path.join(dir(project), "index.json"), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, items }, null, 1)); fs.renameSync(tmp, f);
}
/** the scene's prompt as one picture prompt (its lines joined; tags like [Verse] / (camera …) kept as words) */
function promptFor(row) {
  const lines = (row && Array.isArray(row.prompt) ? row.prompt : [String((row && row.prompt) || "")]).map((s) => String(s).trim()).filter(Boolean);
  return lines.join(" ").replace(/\s+/g, " ").slice(0, 1800);
}
const words = (s) => String(s || "").toLowerCase();
/** the pictures to send with it (project-relative paths). images = projectMedia.scan(project).images
 *  [{rel, group, name}]; opts = {sheets, locations, refs} (each on unless false) */
function pickRefs(row, images, opts) {
  const o = Object.assign({ sheets: true, locations: true, refs: true }, opts || {}), text = words(promptFor(row)), out = [];
  const add = (rel) => { if (rel && !out.includes(rel) && out.length < MAX_REFS) out.push(rel); };
  const byGroup = new Map();
  for (const im of images || []) { if (!im || !IMG_RE.test(im.rel || "")) continue; const g = String(im.group || ""); if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(im); }
  const named = (prefix) => [...byGroup.keys()].filter((g) => g.startsWith(prefix + " · ")).map((g) => [g.slice(prefix.length + 3), byGroup.get(g)])
    .filter(([name]) => name && name.length > 1 && new RegExp("(^|[^a-z0-9])" + name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(text));
  // the best n of a list: the earlier regex that matches the name wins (then by name)
  const score = (name, res) => { const i = res.findIndex((re) => re.test(name)); return i < 0 ? res.length : i; };
  const best = (list, res, n) => list.slice().sort((a, b) => score(String(a.name), res) - score(String(b.name), res) || String(a.name).localeCompare(String(b.name))).slice(0, n);
  if (o.sheets !== false) for (const [, list] of named("Characters")) best(list, [/sheet/i, /turn/i, /front/i], 2).forEach((x) => add(x.rel));
  if (o.locations !== false) for (const [, list] of named("Locations")) best(list, [/wide|main/i, /view/i, /front/i], 2).forEach((x) => add(x.rel));
  if (o.refs !== false) {
    for (const r of (row && row.refs) || []) if (r && r.file) add("scene_refs/" + safeId(row.id) + "/" + path.basename(String(r.file)));
    best(byGroup.get("References") || [], [], 2).forEach((x) => add(x.rel));
  }
  return out;
}
/** 2.568.0: a reference picture in words (rel = project-relative path, group = projectMedia's group) */
function roleOf(rel, group, prevLabel) {
  const g = String(group || ""), r = String(rel || "");
  if (prevLabel && /(^|\/)sb_prev_/.test(r)) return `${prevLabel} - the moment just before this scene (where it continues from)`;
  let m = /^Characters · (.+)$/.exec(g); if (m) return `${m[1]}'s character sheet (how ${m[1]} looks)`;
  m = /^Locations · (.+)$/.exec(g); if (m) return `the location ${m[1]}`;
  if (/^scene_refs\//.test(r)) return "a reference picture of this scene";
  if (g === "References") return "a reference picture of the film";
  return "a reference picture";
}
/** 2.568.0: the LLM writes the storyboard picture's prompt from the scene */
function llmMessages(o) {
  const x = o || {}, roles = (x.roles || []).map((r, i) => `Picture ${i + 1} = ${r}`).join("\n");
  const one = (t, n) => String(t || "").replace(/\s+/g, " ").trim().slice(0, n);
  const sys = "You write the prompt for an image model that draws the OPENING FRAME of one scene of a film - one still picture, "
    + "the scene's storyboard picture and the frame its video starts on. The pictures the model gets are listed as Picture 1, "
    + "Picture 2 ... - refer to them only by exactly those names. Write one paragraph of 2 to 5 plain sentences (no lists, no "
    + "quotes, no markdown, under 700 characters): who is in the frame (each character by name and their picture, e.g. Mara from "
    + "Picture 2), what they are doing at this first moment, where it is, the camera framing, the light and the mood. "
    + (x.hasPrev
      ? "A previous scene's last frame is listed: this scene continues from that moment - keep its place, light and look the same "
        + "unless this scene clearly moves somewhere else. "
      : "There is no frame of a previous scene: describe the place from this scene's words (and the film's global prompt). ")
    + "It is a still picture: no camera moves, no sounds, no dialogue, no scene numbers. Answer with the prompt only.";
  const user = `Pictures:\n${roles || "(none)"}\n\nGlobal prompt of the film:\n${one(x.prefix, 1200) || "(none)"}\n\n`
    + (x.prevText ? `The scene before:\n${one(x.prevText, 600)}\n\n` : "")
    + `This scene:\n${one(x.sceneText, 1200) || "(no text)"}`;
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}
/** 2.568.0: the LLM's answer as one picture prompt */
function cleanPrompt(text, nImages) {
  let t = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```[a-z]*\n?|```/gi, "").replace(/^\s*(image\s+)?prompt\s*:\s*/i, "")
    .replace(/\*\*?|__/g, "").replace(/\s+/g, " ").trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();
  t = t.replace(/<\s*(?:picture|image)\s*(\d{1,2})\s*>|\b(?:picture|image)\s*#?\s*(\d{1,2})\b/gi, (m, a, b) => { const d = +(a || b); return d >= 1 && d <= (nImages || 0) ? `Picture ${d}` : "the picture"; });
  if (/^[{\[]/.test(t) || /"\s*:\s*[\[{"]/.test(t.slice(0, 200))) return "";   // a JSON answer (not a picture prompt)
  return t.slice(0, 1800);
}
/** keep src as the scene's storyboard picture (a copy) */
function setFromFile(project, row, src, label, style, prompt) {
  if (!row || !src || !fs.existsSync(src) || !IMG_RE.test(src)) return { ok: false, error: "no picture to keep" };
  const items = readIndex(project), id = safeId(row.id || "n" + row.n), ext = path.extname(src).toLowerCase(), d = dir(project);
  const old = items[id]; if (old && old.file && old.file !== id + ext) { try { fs.unlinkSync(path.join(d, path.basename(old.file))); } catch { /* gone */ } }
  fs.copyFileSync(src, path.join(d, id + ext));
  items[id] = { file: id + ext, label: String(label || path.basename(src)).slice(0, 120), style: String(style || "").slice(0, 120), at: Date.now() };
  if (prompt) items[id].prompt = String(prompt).slice(0, 1800);                // 2.568.0
  writeIndex(project, items);
  return { ok: true, item: Object.assign({ n: row.n, id: row.id, rel: "storyboard/" + id + ext }, items[id]) };
}
function clear(project, row) {
  const items = readIndex(project), id = safeId(row && (row.id || "n" + row.n)), it = items[id];
  if (!it) return false;
  try { fs.unlinkSync(path.join(dir(project), path.basename(it.file))); } catch { /* gone */ }
  delete items[id]; writeIndex(project, items); return true;
}
/** the storyboard of the board's rows: [{n, id, file, label, style, at, rel}] (only scenes that have one) */
function list(project, rows) {
  const items = readIndex(project), out = [];
  for (const r of rows || []) {
    const it = items[safeId(r.id || "n" + r.n)];
    if (it && fs.existsSync(path.join(dir(project), path.basename(it.file)))) out.push(Object.assign({ n: r.n, id: r.id, rel: "storyboard/" + it.file }, it));
  }
  return out;
}
function file(project, row) {
  const it = readIndex(project)[safeId(row && (row.id || "n" + row.n))];
  if (!it) return null;
  const f = path.join(dir(project), path.basename(it.file));
  return fs.existsSync(f) ? f : null;
}
module.exports = { MAX_REFS, safeId, promptFor, pickRefs, roleOf, llmMessages, cleanPrompt, setFromFile, clear, list, file, dir };
