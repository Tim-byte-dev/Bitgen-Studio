#!/usr/bin/env node
// lib/jobsInfo.js — per-project job queue on disk (2.113.0).
const fs = require("fs"), os = require("os"), path = require("path");
const J = require(path.join(__dirname, "..", "lib", "jobsInfo"));
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const d = fs.mkdtempSync(path.join(os.tmpdir(), "ji-"));
const job = { id: "abc123", status: "queued", params: { mode: "t2va", prompt: "a fox", width: 960, height: 544 }, created: 1, started: null, finished: null, output: null };
check("state: queued/running are pending; done/failed/cancelled are done", J.stateOf("queued") === "pending" && J.stateOf("running") === "pending" && J.stateOf("done") === "done" && J.stateOf("failed") === "done" && J.stateOf("cancelled") === "done", null);
J.record(d, job);
check("record writes projects/<p>/jobs.info with the job as pending, params kept for a resume",
  fs.existsSync(path.join(d, "jobs.info")) && J.read(d)[0].state === "pending" && J.read(d)[0].params.prompt === "a fox", J.read(d));
job.status = "running"; job.started = 2; J.record(d, job);
check("a second record UPSERTS (one entry), status updated", J.read(d).length === 1 && J.read(d)[0].status === "running", J.read(d));
job.status = "done"; job.finished = 3; job.output = "x.mp4"; J.record(d, job);
const e = J.read(d)[0];
check("done: state done, output kept, params dropped", e.state === "done" && e.output === "x.mp4" && !("params" in e), e);
J.record(d, { id: "zz9", status: "queued", params: { mode: "image", prompt: "p" } });
const h = J.history(d, ["abc123"]);
check("history() hides jobs still in memory and marks a pending one from a previous run as interrupted",
  h.length === 1 && h[0].id === "zz9" && h[0].interrupted === true && h[0].status === "interrupted" && h[0].params, h);
check("remove() drops one entry, false when absent", J.remove(d, "zz9") === true && J.read(d).length === 1 && J.remove(d, "zz9") === false, null);
check("a broken file reads as []", (fs.writeFileSync(path.join(d, "jobs.info"), "{nope"), J.read(d).length === 0), null);
console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
