// bitGen Studio — lib/dazMuscle.js (2.979.0): 💪 MUSCLE REACTIONS FROM THE FIGURE'S OWN DAZ CONTENT (step 1 of
// claude/DAZ-SOFT-PHYSICS-PLAN.md). Used by lib/dazLib.js build(); the formula maths is static/dazformula.js (the page runs the
// same file live in 🧍 Pose). NOT A REPLACEMENT FOR DAZ STUDIO - light tasks; Daz Studio is a very powerful character creator.
//
//   index(figFile)            every modifier in the figure's data file + its Morphs/ folder: {mods Map id -> rec, formulas,
//                             skipped (formulas into bone centres etc. - not applied)}; each file read once (by mtime)
//   solve(figFile, set, o)    the rest pose: the dials + the ERCs they drive -> shape morphs; the values that follow a bone ->
//                             JCM morph targets + the model the page evaluates (only those formulas; other inputs = constants)
//   flex(fig, o)              no JCMs in the figure: our own bulge along each limb bone, driven by how far the next joint bends
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const F = require("../static/dazformula.js");

const MAX_JCM = 400;
const files = new Map();   // file -> {mtime, mods} (small records only - never the whole DSON)
function readJson(f) { let b = fs.readFileSync(f); if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b); return JSON.parse(b.toString("utf8")); }
function modsOf(f) {
  let st; try { st = fs.statSync(f); } catch { return []; }
  const c = files.get(f); if (c && c.mtime === st.mtimeMs) return c.mods;
  let j; try { j = readJson(f); } catch { files.set(f, { mtime: st.mtimeMs, mods: [] }); return []; }
  const mods = [];
  const take = (m, isNode) => {
    if (!m || !m.id) return;
    const ch = m.channel || {}, fl = (m.formulas || []).map((x) => F.compact(x));
    mods.push({ id: String(m.id), file: f, label: ch.label || m.label || m.name || m.id, value: +(ch.current_value != null ? ch.current_value : ch.value) || 0,
      min: ch.min != null ? +ch.min : null, max: ch.max != null ? +ch.max : null, clamped: ch.clamped === true, morph: !!(m.morph && ((m.morph.deltas || {}).values || []).length), node: !!isNode, visible: ch.visible !== false, group: String(m.group || ""),
      formulas: fl.filter(Boolean), skipped: fl.filter((x) => !x).length });
  };
  (j.modifier_library || []).forEach((m) => take(m));
  (j.node_library || []).forEach((n) => { if (n.formulas && n.formulas.length) take({ id: "@" + n.id, formulas: n.formulas }, true); });
  if (files.size > 20000) files.clear();
  files.set(f, { mtime: st.mtimeMs, mods });
  return mods;
}
function index(figFile) {
  const out = new Map(), formulas = []; let skipped = 0, n = 0;
  const add = (f) => { n++; for (const m of modsOf(f)) { skipped += m.skipped; formulas.push(...m.formulas); if (!m.node && !out.has(m.id)) out.set(m.id, m); } };
  add(figFile);
  const walk = (d, depth) => {
    if (depth > 7) return;
    let L = []; try { L = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of L) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f, depth + 1); else if (/\.dsf$/i.test(e.name)) add(f); }
  };
  walk(path.join(path.dirname(figFile), "Morphs"), 0);
  return { mods: out, formulas, skipped, files: n };
}
function deltasOf(rec) {
  try { const m = (readJson(rec.file).modifier_library || []).find((x) => String(x.id) === rec.id); return (m && m.morph && (m.morph.deltas || {}).values) || []; } catch { return []; }
}
const modelOf = (ix) => { const mods = {}; for (const [id, m] of ix.mods) mods[id] = { value: m.value, min: m.min, max: m.max, clamped: m.clamped }; return { mods, formulas: ix.formulas }; };

/** set = {id: value} (the dials, the .duf's own) -> {shape [{id, label, w, deltas}], jcm [{id, label, rest, deltas}], client, info} */
function solve(figFile, set, o) {
  const x = o || {}, ix = x.index || index(figFile), model = modelOf(ix), rest = F.evaluate(model, { set: set || {} });
  const shape = [];
  for (const [id, m] of ix.mods) if (m.morph && Math.abs(rest[id] || 0) > 1e-6) shape.push({ id, label: m.label, w: rest[id], deltas: deltasOf(m) });
  const drv = F.driven(model), jcm = [];
  for (const id of drv) { const m = ix.mods.get(id); if (m && m.morph && jcm.length < MAX_JCM) jcm.push({ id, label: m.label, rest: rest[id] || 0, deltas: deltasOf(m) }); }
  // the page's model: only what follows a bone; anything else it reads is fixed now (its rest value)
  const mods = {}, formulas = [];
  for (const id of drv) { const m = ix.mods.get(id) || {}; mods[id] = { value: id in (set || {}) ? +set[id] : m.value || 0, min: m.min, max: m.max, clamped: !!m.clamped }; }
  for (const f of ix.formulas) {
    if (!drv.has(f.out)) continue;
    formulas.push({ out: f.out, stage: f.stage, ops: f.ops.map((op) => (op.k && op.k[0] === "m" && !drv.has(op.k.slice(2)) ? { op: "push", val: rest[op.k.slice(2)] || 0 } : op)) });
  }
  return { shape, jcm, rest, client: { mods, formulas }, info: { files: ix.files, modifiers: ix.mods.size, formulas: ix.formulas.length, driven: drv.size, jcm: jcm.length, skipped: ix.skipped, more: Math.max(0, [...drv].filter((id) => (ix.mods.get(id) || {}).morph).length - jcm.length) } };
}

/** our own flex (figures with no JCMs): each limb bone with ONE child joint gets a bulge - its soft middle pushed out from the
 *  bone's line by up to 7%, at most when the child bends 110°. fig = figureData(); deltas in cm (Daz units) per vertex. */
function flex(fig, o) {
  const x = o || {}, V = (fig.geo.vertices || {}).values || [], bones = fig.bones, byId = new Map(bones.map((b) => [b.id, b]));
  const kids = new Map(); bones.forEach((b) => { if (b.parent && byId.has(b.parent)) { const L = kids.get(b.parent) || []; L.push(b); kids.set(b.parent, L); } });
  const W = new Map(); for (const jt of (fig.skin && fig.skin.joints) || []) W.set(String(jt.node || "").split("#").pop().replace(/%20/g, " "), new Map(((jt.node_weights || {}).values || []).map((q) => [q[0], q[1]])));
  const targets = [], formulas = [], mods = {}, amount = x.amount != null ? +x.amount : 0.07, deg = x.deg || 110;
  for (const p of bones) {
    const ch = kids.get(p.id) || []; if (ch.length !== 1 || !p.parent) continue;
    const c = ch[0], a = p.center, b = c.center, ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    if (L2 < 16) continue;                                  // shorter than 4 cm (finger joints): no bulge
    const w = W.get(p.id); if (!w) continue;
    const deltas = [];
    for (const [v, wt] of w) {
      if (!(wt >= 0.5) || !V[v]) continue;
      const q = V[v], aq = [q[0] - a[0], q[1] - a[1], q[2] - a[2]], t = (aq[0] * ab[0] + aq[1] * ab[1] + aq[2] * ab[2]) / L2;
      if (t < 0.15 || t > 0.85) continue;
      const r = [aq[0] - ab[0] * t, aq[1] - ab[1] * t, aq[2] - ab[2] * t], k = amount * wt * Math.sin(Math.PI * (t - 0.15) / 0.7);
      if (Math.hypot(r[0], r[1], r[2]) < 1e-6) continue;
      deltas.push([v, r[0] * k, r[1] * k, r[2] * k]);
    }
    if (deltas.length < 8) continue;
    const id = "flex_" + p.id;
    targets.push({ id, label: "💪 " + p.name + " (our own flex)", rest: 0, deltas });
    mods[id] = { value: 0, min: 0, max: 1, clamped: true };
    formulas.push({ out: id, stage: "sum", ops: [{ op: "push", k: "b:" + c.id + ":bend" }, { op: "push", val: [0, 0] }, { op: "push", val: [deg, 1] }, { op: "push", val: 2 }, { op: "spline_linear" }] });
    if (targets.length >= 60) break;
  }
  return { jcm: targets, client: { mods, formulas } };
}
module.exports = { MAX_JCM, index, solve, flex, modsOf, deltasOf, modelOf };
