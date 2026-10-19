#!/usr/bin/env node
// Unit tests for lib/imageSeed.js — one press of Generate, one fresh seed.
// Run: node scripts/test-imageseed.js
//
// The bug this file guards against does not look like a bug from the outside:
// the render succeeds, the file appears, and it is simply the SAME picture as
// last time. Tim spent a release convinced the LoRA was not loading (2.78.0)
// because a frozen seed is indistinguishable from a look that never applies.
// So the checks below are about a number MOVING, and about the two ways of
// freezing it that have actually happened: a template value left in place, and
// an empty field arriving as Number("") === 0.
const fs = require("fs");
const path = require("path");
const S = require(path.join(__dirname, "..", "lib", "imageSeed"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

// ------------------------------------------------------------------ the roll
{
  const seen = new Set();
  for (let i = 0; i < 500; i += 1) seen.add(S.roll());
  check("500 rolls give 500 different seeds", seen.size === 500, seen.size);
  const all = [...seen];
  check("every roll is a plain non-negative integer",
    all.every((s) => Number.isInteger(s) && s >= 0), all.slice(0, 3));
  check("every roll is inside the range every backend accepts",
    all.every((s) => s <= S.MAX_SEED), Math.max(...all));
  check("the ceiling is 2**32-1, not int64 — a full int64 seed coincided with a "
    + "sampler crash (2.80.3)", S.MAX_SEED === 4294967295, S.MAX_SEED);
}
{
  // Not a distribution test — just that the top of the range is reachable, so
  // a bad exclusive/inclusive boundary cannot quietly cost a bit.
  let hi = 0;
  for (let i = 0; i < 20000; i += 1) hi = Math.max(hi, S.roll());
  check("the high end of the range is actually reachable",
    hi > S.MAX_SEED * 0.999, hi);
}

// ---------------------------------------------------------------- what pins
check("an absent seed is not pinned", S.pinned(undefined) === null, S.pinned(undefined));
check("null is not pinned", S.pinned(null) === null, S.pinned(null));
check("an EMPTY STRING is not pinned — Number('') is 0, and a seed of 0 would "
  + "freeze every render", S.pinned("") === null, S.pinned(""));
check("false is not pinned", S.pinned(false) === null, S.pinned(false));
check("-1 means random, not seed -1", S.pinned(-1) === null, S.pinned(-1));
check("any negative means random", S.pinned(-98765) === null, S.pinned(-98765));
check("gibberish is not pinned", S.pinned("banana") === null, S.pinned("banana"));
check("NaN is not pinned", S.pinned(NaN) === null, S.pinned(NaN));
check("Infinity is not pinned", S.pinned(Infinity) === null, S.pinned(Infinity));
check("ZERO IS A REAL SEED, not 'unset'", S.pinned(0) === 0, S.pinned(0));
check("a numeric string is pinned", S.pinned("316826193") === 316826193, S.pinned("316826193"));
check("a float seed is floored, not rounded to a float ComfyUI would refuse",
  S.pinned(42.7) === 42, S.pinned(42.7));
check("an over-large seed is clamped to the ceiling rather than refused",
  S.pinned(2 ** 53) === S.MAX_SEED, S.pinned(2 ** 53));

// ------------------------------------------------------------- forRequest()
{
  const a = S.forRequest(undefined), b = S.forRequest(undefined);
  check("two presses with no seed get two different seeds",
    a.seed !== b.seed, [a.seed, b.seed]);
  check("...and both are flagged as rolled here, so the log can say so",
    a.random === true && b.random === true, [a, b]);
}
{
  const a = S.forRequest(-1), b = S.forRequest(-1);
  check("an explicit -1 rolls too, and rolls differently each time",
    a.seed !== b.seed && a.random && b.random, [a.seed, b.seed]);
  check("a rolled seed is never negative — it has to be written into a graph "
    + "and into a filename", a.seed >= 0 && b.seed >= 0, [a.seed, b.seed]);
}
{
  const a = S.forRequest(7), b = S.forRequest(7);
  check("A PINNED SEED IS OBEYED, twice — otherwise 'give me that one again' "
    + "is impossible", a.seed === 7 && b.seed === 7, [a, b]);
  check("...and is not reported as random", a.random === false, a);
  const z = S.forRequest(0);
  check("a pinned 0 is obeyed as well", z.seed === 0 && z.random === false, z);
}

// --------------------------------------------------- the two files agree
{
  // The ceiling exists in two languages. If one moves and the other does not,
  // a seed can be rolled in Node that the Python patcher considers out of the
  // range it justified at length — the kind of drift that only shows up as a
  // crash on somebody else's machine.
  const py = fs.readFileSync(path.join(__dirname, "comfy_image.py"), "utf8");
  check("scripts/comfy_image.py caps rolled seeds at the same ceiling",
    /SEED_MAX\s*=\s*2\*\*32\s*-\s*1/.test(py),
    (py.match(/SEED_MAX\s*=.*/) || ["missing"])[0]);
  check("...and its own roll uses that constant rather than a repeated literal",
    /random\.randint\(0,\s*SEED_MAX\)/.test(py),
    (py.match(/random\.randint\([^)]*\)/) || ["missing"])[0]);
}
{
  // The route is the only caller that matters: if it stops asking, the seed
  // silently goes back to being decided in the worker, invisibly.
  const r = fs.readFileSync(path.join(__dirname, "..", "routes", "index.js"), "utf8");
  check("POST /api/genimage rolls through this helper",
    /imageSeed\.forRequest\(/.test(r), null);
  check("...and records where the number came from, for the log",
    /seed_random/.test(r), null);
}

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
