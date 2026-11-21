// bitGen Studio — lib/boardBasic.js (2.904.0): BASIC SETTINGS' SAMPLER / SCHEDULER FOR THE BOARD'S RENDERS.
//
// Tim (verbatim): "the overide settings are not working. when overide is checked overide style settings even when loras
// and checkpoint are unchecked. all the other overide settings remain, size, aspect ratio,seed,cfg,sampler,scheduler will
// still overide style , only the unchecked values won't change the styles values"
//   The prompt docker's renders carry the sampler / scheduler in the X-Bitgen-Sampler header (static/samplerset.js,
//   lib/samplers.js). The board's renders do not go through it (their requests, and scenes queued for later), so the
//   board's ▶ sends them with Basic Settings (ext/videodock/characters.js scBasic) and lib/renderSettings.js keeps them
//   (basic_sampler / basic_scheduler, with basic_override). A board job (params.scene) gets them here from lib/core.js
//   makeJob - while Override style is on, and only when the render did not already bring its own pick.
//   pickFor(settings) -> {sampler, scheduler} | null (pure)       beforeJob(params, project) -> the log line | null
"use strict";

/** the pick a board render goes with (pure): Override style on and a sampler or scheduler set, else null */
function pickFor(s) {
  const x = s || {};
  if (!x.basic_override) return null;
  const sampler = String(x.basic_sampler || ""), scheduler = String(x.basic_scheduler || "");
  return sampler || scheduler ? { sampler, scheduler } : null;
}

function beforeJob(params, project) {
  if (!params || !params.scene || params.comfy_sampler) return null;
  const RS = require("./renderSettings"), core = require("./core");
  const pick = pickFor(RS.read(core.projDir(project || core.getProject())));
  if (!pick) return null;
  params.comfy_sampler = pick;
  return "Basic Settings (Override style): sampler " + (pick.sampler || "the style's own") + ", scheduler " + (pick.scheduler || "the style's own");
}

module.exports = { pickFor, beforeJob };
