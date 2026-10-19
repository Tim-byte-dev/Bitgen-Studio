"use strict";
/**
 * sceneFrames.js — THE FRAME A SCENE CONTINUES FROM (2.338.0; from 2.337.0's
 * routes/sceneedit.js). The frame picked on a filmstrip (the row's cont_src +
 * cont_time), else the scene before's last frame - taken from that take's
 * tail PNGs first (lib/tailFrames), else pulled from its video (the lossless
 * master when there is one, lib/sceneRefs.extractFrame). Shared by the ✎
 * First frame (routes/sceneedit.js) and LTX 2.5 scenes (lib/ltxScenes.js).
 */
const fs = require("fs");
const path = require("path");
const core = require("./core");
const sceneRefs = require("./sceneRefs");
const tailFrames = require("./tailFrames");

const takeOf = (row) => row && row.output
  ? (path.isAbsolute(row.output) ? row.output : path.join(core.pDir("video"), path.basename(row.output))) : "";

/** The scene this one continues from and the second to take ({row, t}), or null. */
function contSource(st, row) {
  let src = null, t = null;
  if (Number.isFinite(row.cont_src) && Number.isFinite(row.cont_time)) {
    src = (st.list || []).find((x) => x && x.n === row.cont_src) || null;
    t = row.cont_time;
  }
  if (!src) src = (st.list || []).filter((x) => x && x.n < row.n).sort((a, b) => b.n - a.n)[0] || null;
  if (!src || !src.output || !["rendered", "kept"].includes(src.status)) return null;
  if (!fs.existsSync(takeOf(src))) return null;
  return { row: src, t };
}

/** The continuation frame as a temp PNG: {file, label} or null. */
function contFrame(project, st, row) {
  const c = contSource(st, row);
  if (!c) return null;
  const label = `scene ${c.row.n}'s ${c.t == null ? "last frame" : "frame at " + c.t + "s"}`;
  const tp = tailFrames.pick(project, st, c.row, c.t);
  if (tp && fs.existsSync(tp.file)) {
    const tmp = path.join(core.tempDir(), `cont_${row.n}_${Date.now()}.png`);
    try { fs.copyFileSync(tp.file, tmp); return { file: tmp, label }; } catch {}
  }
  const f = sceneRefs.extractFrame(takeOf(c.row), c.t);
  return f ? { file: f, label } : null;
}

module.exports = { takeOf, contSource, contFrame };
