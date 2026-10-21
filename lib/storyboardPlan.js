// bitGen Studio — lib/storyboardPlan.js (2.568.0): what a scene's storyboard picture is made from - its references and its
// prompt, written by the LLM from the scene. Used by routes/storyboard.js (POST /api/storyboard/:n/plan).
//
// Tim (verbatim): "in the scene editor send the scene created by the llm back to the llm to create an image for the scene
// thumbnail - reference image will be character and last frame of previous video if the previous video doesn't exist it
// will be of the character + scene description - this image can be changed"
//
//   plan(project, n, o, deps) -> {n, id, prompt, images: [asset names], picked: [{rel, group}], roles, prev, llm, note}
//     o = {sheets, locations, refs, prev, llm, style_id}  (each on unless false)
//     1 the references: the scene before's LAST FRAME first (o.prev - lib/sceneFrames.contFrame: the frame its filmstrip
//       picked, else the last frame of the scene before's take; none when that scene has no take yet), then the bar's
//       ticked ones (lib/storyboard.pickRefs: the named characters' sheets, the named locations, the reference pictures) -
//       as many as the image model takes (at least 3, like /api/genimage)
//     2 the prompt: o.llm -> the LLM gets the scene (+ the scene before's words, the film's global prompt, what each
//       picture is) and writes the opening frame's prompt (lib/storyboard.llmMessages / cleanPrompt), the pictures named
//       in the image model's own words (lib/refWords: Picture n / image n / <imagen>); no LLM / no answer = the scene's
//       own words (lib/storyboard.promptFor) and a note saying so
//   The last frame is kept as images/sb_prev_<scene id>.png (an Images asset - /api/genimage sends assets; replaced
//   each time).
//   deps = {complete(messages) -> Promise<{ok, text, error}>, contFrame(project, st, row) -> {file, label} | null} (tests)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const scenes = require("./scenes");
const projectMedia = require("./projectMedia");
const sb = require("./storyboard");

const bad = (msg, status) => { const e = new Error(msg); e.status = status || 400; return e; };
const textOf = (row) => sb.promptFor(row).replace(/\[[^\]]*\]\s*/g, "").trim();

/** how many pictures the image model takes (as /api/genimage slices them) */
function capFor(styleId) {
  if (!styleId) return 8;
  try {
    const styles = require("./styles"), st = styles.byId(core.STYLES_DIR, String(styleId));
    return Math.max(3, Math.min(10, styles.imageSlots(st, core.BASE)));
  } catch (e) { return 3; }
}
function wordingFor(styleId) {
  if (!styleId) return "picture";
  try { return require("./refWords").wordingFor(require("./styles").byId(core.STYLES_DIR, String(styleId)), core.BASE); } catch (e) { return "picture"; }
}
/** the scene before (by number) */
const before = (st, row) => (st.list || []).filter((x) => x && x.n < row.n).sort((a, b) => b.n - a.n)[0] || null;

async function plan(project, n, o, deps) {
  const x = Object.assign({ sheets: true, locations: true, refs: true, prev: true, llm: true }, o || {}), d = deps || {};
  const st = scenes.load(project), r = scenes.at(st, n);
  if (!r) throw bad(`no scene ${n}`, 404);
  const own = sb.promptFor(r);
  if (!own) throw bad(`scene ${r.n} has no prompt yet - write it first`);
  const cap = capFor(x.style_id), picked = [], images = [];
  const take = (rel, group) => {
    if (images.length >= cap) return;
    let name = null;
    try { const a = projectMedia.adopt(project, rel); name = a && a.ok ? a.name : null; } catch (e) { name = null; }
    if (typeof name === "string" && name) { images.push(path.basename(name)); picked.push({ rel, group }); }
  };
  // 1 the scene before's last frame
  let prev = null;
  if (x.prev !== false) {
    let f = null;
    try { f = (d.contFrame || require("./sceneFrames").contFrame)(project, st, r); } catch (e) { f = null; }
    if (f && f.file && fs.existsSync(f.file)) {
      const dir = path.join(core.projDir(project || core.getProject()), "images"), name = `sb_prev_${sb.safeId(r.id || "n" + r.n)}${path.extname(f.file).toLowerCase() || ".png"}`;
      try {
        fs.mkdirSync(dir, { recursive: true });
        const dest = path.join(dir, name);
        try { fs.unlinkSync(dest); } catch (e) { /* first time */ }
        fs.copyFileSync(f.file, dest);
        prev = f.label || "the last frame of the scene before";
        take("images/" + name, "Previous scene");
      } catch (e) { prev = null; }
      if (f.tmp !== false && f.file.startsWith(core.tempDir())) try { fs.unlinkSync(f.file); } catch (e) { /* gone */ }
    }
  }
  // 2 the bar's references
  const media = projectMedia.scan(project).images;
  for (const rel of sb.pickRefs(r, media, { sheets: x.sheets !== false, locations: x.locations !== false, refs: x.refs !== false })) take(rel, projectMedia.groupFor(project, rel));
  const roles = picked.map((p) => sb.roleOf(p.rel, p.group, prev));
  // 3 the prompt
  let prompt = own, llm = false, note = "";
  if (x.llm !== false) {
    const pb = before(st, r);
    const messages = sb.llmMessages({ roles, sceneText: textOf(r), prevText: pb ? textOf(pb) : "", hasPrev: !!prev, prefix: (st.plan || {}).prompt_prefix });
    try {
      const complete = d.complete || ((m) => { const llmChat = require("./llmChat"); return llmChat.complete(core, { messages: m, temperature: 0.6, max_tokens: 500 }).then((rr) => (rr && rr.ok !== false ? { ok: true, text: llmChat.stripThinking(rr.text || "") } : rr)); });
      const rr = await complete(messages);
      const t = rr && rr.ok !== false ? sb.cleanPrompt(rr.text, images.length) : "";
      if (t && t.length > 20) { prompt = require("./refWords").retag(t, wordingFor(x.style_id)); llm = true; }
      else if (!rr || rr.ok === false) note = `the LLM did not answer${rr && rr.error ? " (" + rr.error + ")" : ""} - the scene's own words were used (Settings ▸ LLM starts one)`;
      else note = "the LLM answered nothing usable - the scene's own words were used";
    } catch (e) { note = "the LLM did not answer (" + (e.message || e) + ") - the scene's own words were used"; }
  }
  return { n: r.n, id: r.id, prompt, images, picked, roles, prev, llm, note };
}

module.exports = { plan, capFor, before };
