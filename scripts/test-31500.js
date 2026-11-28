#!/usr/bin/env node
/* bitGen Studio — 3.15.0: every queued job keeps the Settings it was QUEUED with (lib/queueSnap.js, lib/core.js makeJob /
 * pump) - a change made while the queue runs reaches only the jobs queued after it.
 * Tim: "save settings for every queued item separately so queued item doesn't take on settings that change while the queue
 * is running" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const Q = require(path.join(ROOT, "lib/queueSnap.js"));

const cfgA = { engine: { backend: "comfy", comfy: { url: "http://127.0.0.1:8188", free_before_gen: true, low_vram: false } }, models: { ref2va: "a.gguf" }, apis: { k1: { key: "old" } } };
const job = { id: "j1", params: { mode: "ref2va" } };
Q.take(job, cfgA, { h3_fit: "down" });
check("take: the copy rides the job NON-enumerable - never in JSON, Object.keys or a spread", !Object.keys(job).includes(Q.KEY) && !JSON.stringify(job).includes("free_before_gen") && !("_queuedSettings" in Object.assign({}, job)));
check("…without the API keys (they are not kept with a waiting job)", !("apis" in job[Q.KEY].cfg));
// the Settings change while it waits
const cfgB = structuredClone(cfgA); cfgB.engine.comfy.free_before_gen = false; cfgB.engine.comfy.low_vram = true; cfgB.models.ref2va = "b.gguf"; cfgB.apis.k1.key = "new";
const u = Q.use(job, cfgB);
check("use: the job renders with the Settings it was queued with", u.queued && u.config.engine.comfy.free_before_gen === true && u.config.engine.comfy.low_vram === false && u.config.models.ref2va === "a.gguf", u.config);
check("…the API keys are today's (a key fixed while it waited still works)", u.config.apis.k1.key === "new");
check("…what changed is said (engine.comfy.free_before_gen, engine.comfy.low_vram, models.ref2va) and the H3 size fit kept", u.changed.join() === "engine.comfy.free_before_gen,engine.comfy.low_vram,models.ref2va" && u.h3_fit === "down", u);
check("…the copy is dropped once used (a second start = the live Settings)", !Q.use(job, cfgB).queued);
check("a job with no copy (restored after a restart): the live Settings, nothing said", (() => { const r = Q.use({ id: "x" }, cfgB); return !r.queued && r.config === cfgB && !r.changed.length; })());
check("nothing changed: nothing said", (() => { const j = {}; Q.take(j, cfgA, {}); return Q.use(j, cfgA).changed.length === 0; })());
// two jobs queued either side of a change keep their own
const j1 = {}, j2 = {}; Q.take(j1, cfgA, {}); Q.take(j2, cfgB, {});
check("two queued jobs, the Settings changed between them: each keeps its own", Q.use(j1, cfgB).config.models.ref2va === "a.gguf" && Q.use(j2, cfgA).config.models.ref2va === "b.gguf");
const core = fs.readFileSync(path.join(ROOT, "lib/core.js"), "utf8");
check("lib/core.js: makeJob takes the copy (+ the H3 size fit); the start uses it and says what changed", /require\("\.\/queueSnap"\)\.take\(job, resolvedConfig\(\), \{ h3_fit: fit \}\)/.test(core)
  && /require\("\.\/queueSnap"\)\.use\(job, resolvedConfig\(\)\)/.test(core) && /it renders with the ones it was queued with/.test(core) && /job\.params\.h3_fit \|\| qs\.h3_fit/.test(core));
console.log("\n" + pass + " passed, " + fail + " failed");
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
