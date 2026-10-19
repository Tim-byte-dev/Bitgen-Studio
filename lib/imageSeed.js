"use strict";
/**
 * bitGen Studio — THE image seed roll (2.83.0).
 *
 * ONE PRESS OF GENERATE IMAGE = ONE FRESH SEED. That is the whole file.
 *
 * WHY IT LIVES HERE AND NOT IN THE WORKER.
 * scripts/comfy_image.py already rolls a seed when it is handed -1, and it
 * still does (a worker run by hand, or by a test, must not produce the same
 * picture twice either). But a seed drawn down there is drawn AFTER the job
 * has been created, so:
 *   - job.json — the record of what was rendered — says `-1`, not the number
 *     that was actually used, so the one field you need to reproduce a picture
 *     is the one field the job does not carry;
 *   - the output FILENAME cannot contain it, because the name is chosen in the
 *     same breath;
 *   - the sd-cli engine took a different path entirely: -1 was passed straight
 *     through to sd-cli, which rolled its own seed, never reported it, and made
 *     the batch walk (`seed + i`) a no-op — a batch of four with no seed was
 *     four rolls of the dice rather than four deliberate neighbours.
 * Deciding the number at the REQUEST is what makes "this render, that seed,
 * that file" one fact instead of three guesses.
 *
 * THE RANGE IS 0..2**32-1, deliberately, and it must stay in step with
 * SEED_MAX in scripts/comfy_image.py — see the long note there. Short version:
 * that is the range ComfyUI's own UI, A1111 and numpy.random.seed accept, huge
 * seeds buy nothing, and a full int64 seed once coincided with a sampler
 * crash. If one of the two files changes, change both.
 *
 * A REQUEST-PINNED SEED IS OBEYED. Typing a seed in means "give me that
 * picture again", and re-rolling it would make reproduction impossible. Only an
 * absent or negative seed is rolled. A seed stored on a STYLE is deliberately
 * NOT treated as pinned: a style is a look, reused across many prompts, and a
 * frozen seed inside one turns every render made with it into the same picture
 * — which is exactly the bug this file exists to end.
 */
const crypto = require("crypto");

/** Inclusive ceiling. Keep in step with scripts/comfy_image.py SEED_MAX. */
const MAX_SEED = 2 ** 32 - 1;

/** The previous roll, so two presses can never hand back the same number.
 *  1 in 4.3 billion is not "never", and "unique every time" is the promise. */
let LAST = null;

/** A fresh seed, never equal to the one before it. */
function roll() {
  // randomInt's max is EXCLUSIVE, hence +1: seed 4294967295 must be reachable.
  let s = crypto.randomInt(0, MAX_SEED + 1);
  for (let i = 0; i < 8 && s === LAST; i += 1) s = crypto.randomInt(0, MAX_SEED + 1);
  LAST = s;
  return s;
}

/**
 * A seed the caller pinned on purpose, or null.
 *
 * `Number("")` is 0 and `Number(null)` is 0, so an empty field would pin seed 0
 * and freeze every render — the same shape of bug as `+v || fallback`. Checked
 * explicitly, like numOrNull() in lib/styles.js.
 */
function pinned(v) {
  if (v === null || v === undefined || v === "" || v === false) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;                       // -1 (or any negative) = random
  return Math.min(MAX_SEED, Math.floor(n));
}

/**
 * Decide the seed for one Generate press.
 * @returns {{seed:number, random:boolean}} `random` is true when this number
 *          was rolled here, so the log can say where it came from.
 */
function forRequest(requested) {
  const n = pinned(requested);
  if (n !== null) return { seed: n, random: false };
  return { seed: roll(), random: true };
}

module.exports = { MAX_SEED, roll, pinned, forRequest };
