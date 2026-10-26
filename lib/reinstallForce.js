/* bitGen Studio — lib/reinstallForce.js (2.601.0): ⟳ REINSTALL MEANS "FETCH IT AGAIN".
 *
 * Tim (verbatim): "if an addon/package/model has been installed change the button to reinstall".
 * A Reinstall that skipped every file "already there" would only pretend, so while a reinstall runs this flag is on
 * and the downloaders (lib/setupModels.download and the add-ons' own "already there" checks) fetch the files again
 * instead of skipping them. One add-on job runs at a time (lib/addons.startJob), so a counter is enough.
 *   on()            a reinstall is running
 *   run(fn)         fn() with the flag on (async-safe; it goes off when fn settles, even on a throw)
 *   wrap(job)       an add-on job (log) => ... run with the flag on
 */
"use strict";
let depth = 0;
const on = () => depth > 0;
async function run(fn) {
  depth++;
  try { return await fn(); } finally { depth = Math.max(0, depth - 1); }
}
const wrap = (job) => (log) => run(() => {
  if (typeof log === "function") log("[..] reinstall - every file is fetched again, nothing is skipped as \"already there\"", false);
  return job(log);
});
module.exports = { on, run, wrap, _reset: () => { depth = 0; } };
