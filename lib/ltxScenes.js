"use strict";
/**
 * ltxScenes.js — A SCENE ON THE BOARD, RENDERED BY LTX 2.5 (2.338.0).
 *
 * Tim: "can we add ltx2.5 for our music video and screenplay and first/last
 * frame ...". The Video docker's Workflow "LTX 2.5" (scenes.style = FLOW)
 * sends queueScene here (routes/characters.js). Each scene is one LTX clip;
 * its MODE follows the scene card:
 *
 *   pictures it opens / ends on                 no song        board song
 *   none (Ref, nothing set)                     t2v            a2v
 *   the First picture, or the frame it          i2v            lipsync
 *     continues from (First / Cont / Trans)
 *   + the Last picture (or Trans: its first     flf            fl_lipsync
 *     scene picture - the new location)
 *
 * First pictures come from the scene's First slot (a picked frame, a
 * gallery picture, or 2.337.0's ✎ First frame (Qwen 2.1)) before the
 * continuation frame (lib/sceneFrames). With the board's song the scene's
 * slice of it (lib/sceneTimeline.windowFor) is the audio the clip lip-syncs
 * to - the music video. The prompt is the scene's text with @tags written as
 * the characters' names (LTX has no reference sheets; the look comes from the
 * first frame). Length = the song slice, else the row's frames / 24, whole
 * seconds.
 *
 * Returns {job, note} or {error}; the caller marks the row running.
 */
const path = require("path");
const LTX = require("./ltx");

const FLOW = "LTX25";
const isLtxFlow = (style) => String(style || "") === FLOW;

/** "@ava walks in" -> "Ava walks in" (cast names by tag). */
function untag(text, cast) {
  let t = String(text || "");
  for (const c of cast || []) {
    const tag = String(c.tag || "").toLowerCase();
    if (!tag) continue;
    t = t.replace(new RegExp("@" + tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi"), c.name);
  }
  return t.replace(/<\/?d>/g, "").replace(/\[\s*shot\s*\d+\s*\]/gi, "").replace(/\s+\n/g, "\n").trim();
}

/**
 * The job params for scene row r, or {error}. d = {
 *   project, st, r, style, base (app dir), cast:[{name, tag}],
 *   first (abs|null: the First slot), last (abs|null: the Last slot),
 *   cont (abs|null: the continuation frame), place (abs|null: Trans' first
 *   scene picture), song (abs|null), win {start, dur}|null, width, height }
 */
function plan(d) {
  const r = d.r;
  const anchor = String(r.anchor || "reference");
  const opening = d.first || (["first", "continue", "transition", "last"].includes(anchor) ? d.cont : null);
  const closing = d.last || (anchor === "transition" ? d.place : null);
  const images = [opening, closing].filter(Boolean);
  if (!opening && closing) images.length = 0;         // a last frame alone is not a mode
  const song = d.song && d.win ? { path: d.song, start: Math.max(0, +d.win.start || 0) } : null;
  const secs = song && d.win && d.win.dur ? d.win.dur : (Number.isFinite(r.length) && r.length > 0 ? r.length / LTX.FPS : 5);
  const mode = LTX.autoMode({ images: images.length, audio: !!song });
  const p = LTX.jobParams({
    style: d.style, workflow: LTX.workflowFor(d.style, d.base), mode,
    prompt: untag((r.prompt || []).join("\n"), d.cast), images, audio: song,
    seconds: secs, width: d.width, height: d.height, seed: r.seed === "" ? -1 : r.seed,
    scene: { n: r.n, chapter: r.chapter, ltx: true },
    basic: d.basic || null,                                   // 2.409.0: Override style's steps / cfg
  });
  if (p.error) return p;
  const why = [opening ? (d.first ? "its First picture" : "the frame it continues from") : "",
               closing ? (d.last ? "its Last picture" : "its location picture") : "",
               song ? `the song from ${song.start}s` : ""].filter(Boolean);
  return { params: p, note: `scene ${r.n}: ${LTX.summary(p)}` + (why.length ? ` (${why.join(" + ")})` : "") };
}

module.exports = { FLOW, isLtxFlow, untag, plan };
