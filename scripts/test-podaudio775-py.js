#!/usr/bin/env node
/* bitGen Studio — 2.775.0: the pod's job program that runs an audio helper (lib/podAudio.js runCode), run for real with python3
 * the way lib/podJob.js runs it on a pod (its own program, run() in the main thread): it writes the helper's JSON job, runs the
 * helper with it, keeps the log's end and the helper's JSON answer; a helper that fails gives its last log line.
 * Tim (verbatim): "when we create the pod can we have a button for tts, stt and demacus(sheet music)" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
if (spawnSync("python3", ["-c", "print(1)"]).status !== 0) { console.log("SKIP: no python3"); process.exit(0); }
const A = require("../lib/podAudio"), PJ = require("../lib/podJob");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pa775py-"));
const helper = path.join(tmp, "fake_helper.py");
fs.writeFileSync(helper, [
  "import json, sys",
  "job = json.load(open(sys.argv[1]))",
  "print('loading the model', file=sys.stderr)",
  "if job.get('boom'):",
  "    print('RuntimeError: CUDA out of memory', file=sys.stderr); sys.exit(3)",
  "open(job['out'], 'w').write('WAV ' + job['text'])",
  "print('noise on stdout')",
  "print(json.dumps({'ok': True, 'out': job['out'], 'seconds': 1.5}))",
].join("\n"));
const run = (id, job) => {
  const code = A.runCode({ id, job, python: "python3", helper, dir: path.join(tmp, "jobs", id), out: path.join(tmp, "out", id) });
  const r = spawnSync("python3", ["-c", PJ.jobProgram(code)], { cwd: tmp, encoding: "utf8", timeout: 60000 });
  let s = null; try { s = JSON.parse(fs.readFileSync(path.join(tmp, ".bitgen_aud_" + id + ".json"), "utf8")); } catch { s = null; }
  return { r, s };
};
const out1 = path.join(tmp, "out", "j1", "tts_x.wav");
const a = run("j1", { text: "hello", out: out1 });
check("runCode on python3: the helper ran with its JSON job; its answer (the last JSON line on stdout) kept; the file written; running false",
  a.s && a.s.running === false && a.s.result && a.s.result.ok === true && a.s.result.out === out1 && fs.readFileSync(out1, "utf8") === "WAV hello" && !a.s.error, { s: a.s, err: a.r.stderr });
check("…the helper's stderr is the job's log (its end)", a.s && a.s.log.includes("loading the model"), a.s && a.s.log);
const b = run("j2", { text: "x", out: path.join(tmp, "out", "j2", "y.wav"), boom: true });
check("…a helper that fails: no answer, the error is its last log line", b.s && b.s.running === false && b.s.result === null && /CUDA out of memory/.test(b.s.error), b.s);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
