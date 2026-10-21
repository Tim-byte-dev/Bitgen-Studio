// bitGen Studio — lib/jobSteps.js (2.574.0): A RUNNING JOB'S STEP for the rows that only carry a job id.
//
// Tim: "show step number of steps for all generations(image,music,video) in all places that show it".
// The scene board, the swap dialog and the 3D-to-real chains keep job ids in their own records; their answers now carry
// the job's progress (lib/jobMeta.progress: {step, total, pct, elapsed, chunk}) beside the id, so a card that says
// "⏫ upscaling…" / "✎ making…" can say "step n of total" (static/stepstext.js words it).
//   progressOf(id, jobs?)   -> the progress of a RUNNING job, else null (jobs: a Map, default core.jobs)
"use strict";

function progressOf(id, jobs) {
  if (!id) return null;
  let J = jobs;
  if (!J) { try { J = require("./core").jobs; } catch { return null; } }
  const j = J && typeof J.get === "function" ? J.get(String(id)) : null;
  if (!j || j.status !== "running") return null;
  try { return require("./jobMeta").progress(j); } catch { return null; }
}

module.exports = { progressOf };
