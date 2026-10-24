#!/usr/bin/env node
/* bitGen Studio — 2.562.0 units: a scene's job interrupted by a restart comes back to its scene when it is resumed in the
 * Queue docker (lib/sceneResume.js; routes/characters.js syncJobs, lib/sceneEdit.js harvest, routes/index.js resume /
 * discard, lib/scenes.js safe).
 * Tim: "when server is restarted and the job is resumed in the queue docker replace ⚠ the job vanished (server
 * restarted?) in the scene in storyboard docker with the progressbar". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const SR = require(path.join(ROOT, "lib", "sceneResume.js"));
const scenes = require(path.join(ROOT, "lib", "scenes.js"));
const sceneEdit = require(path.join(ROOT, "lib", "sceneEdit.js"));
const core = require(path.join(ROOT, "lib", "core.js"));
const jobsInfo = require(path.join(ROOT, "lib", "jobsInfo.js"));

/* 1 pure */
check("safeLost: only job / upjob / qedit with a job-like id; nothing = undefined",
  JSON.stringify(SR.safeLost({ job: "j_1", upjob: "bad id!", x: "y" })) === '{"job":"j_1"}' && SR.safeLost({}) === undefined && SR.safeLost(null) === undefined);
const row = { n: 3, status: "running", job: "j_abc" };
const w1 = SR.lost(row, "job", "j_abc", true), w2 = SR.lost({ n: 1 }, "job", "j_x", false);
check("lost: the row keeps the job id it lost; resumable -> \"↻ Resume it in the Queue docker\", else the old words",
  row.lost.job === "j_abc" && /↻ Resume it in the Queue docker/.test(w1) && w2 === "the job vanished (server restarted?)", { row, w1, w2 });
const list = [
  { n: 1, status: "idle", job: "", error: SR.WORDS.resumable, lost: { job: "j_a" } },
  { n: 2, status: "idle", job: "j_new", error: "", lost: { job: "j_a" } },                       // a newer render took its place
  { n: 3, status: "rendered", upjob: "", lost: { upjob: "j_a" } },
  { n: 4, qedit: { job: "", status: "failed", error: SR.WORDS.resumable }, lost: { qedit: "j_a", job: "j_b" } },
];
const back = SR.relinkRows(list, "j_a");
check("relinkRows: the render job = running again (no ⚠ - the card's progress bar), the upscale job, the ✎ First frame job; not where a newer job sits; other lost ids stay",
  list[0].job === "j_a" && list[0].status === "running" && list[0].error === "" && !list[0].lost
  && list[1].job === "j_new" && !list[1].lost && list[2].upjob === "j_a" && list[3].qedit.job === "j_a" && list[3].qedit.status === "running" && list[3].qedit.error === ""
  && list[3].lost.job === "j_b" && back.map((b) => b.n + b.kind).join() === "1job,3upjob,4qedit", { list, back });
const l2 = [{ n: 1, error: SR.WORDS.resumable, lost: { job: "j_z" } }];
check("forgetRows: a discarded entry - the row stops waiting, its words say so", SR.forgetRows(l2, "j_z") === 1 && !l2[0].lost && /discarded/.test(l2[0].error), l2);
const S = scenes.safe({ list: [{ n: 1, id: "clip_01", lost: { job: "j_q", junk: 1 } }] });
check("scenes.safe keeps row.lost (cleaned)", JSON.stringify(S.list[0].lost) === '{"job":"j_q"}', S.list[0].lost);

/* 2 the ✎ First frame harvest with a job gone after a restart */
const qrow = { n: 5, qedit: { prompt: "x", job: "j_q1", status: "running" } };
sceneEdit.harvest([qrow], { jobs: new Map(), outputPath: () => null, setFirst: () => ({ ok: true }), resumable: (id) => id === "j_q1" });
check("sceneEdit.harvest: the ✎ job gone after a restart -> the row keeps it (lost.qedit) and says how to resume it",
  qrow.qedit.job === "" && qrow.qedit.status === "failed" && /↻ Resume/.test(qrow.qedit.error) && qrow.lost && qrow.lost.qedit === "j_q1", qrow);

/* 3 a real board: lost -> relink -> saved; jobs.info resumable */
const P = "__t562_resume";
const pdir = core.projDir(P);
try {
  fs.mkdirSync(pdir, { recursive: true });
  scenes.save(scenes.safe({ list: [{ n: 1, id: "clip_01", status: "idle", error: SR.WORDS.resumable, lost: { job: "j_res1" } }] }), P);
  fs.writeFileSync(path.join(pdir, jobsInfo.FILE), JSON.stringify([{ id: "j_res1", state: "pending", status: "running", params: { mode: "t2v" } }, { id: "j_done", state: "done", status: "done" }]));
  check("resumable: an interrupted pending entry with its params in jobs.info (not a done one, not an unknown id)",
    SR.resumable(pdir, "j_res1") && !SR.resumable(pdir, "j_done") && !SR.resumable(pdir, "nope"));
  const r = SR.relink(P, "j_res1");
  const st = scenes.load(P);
  check("relink(project, id): the board takes the job back and is saved (running, no ⚠, nothing lost any more)",
    r.length === 1 && st.list[0].job === "j_res1" && st.list[0].status === "running" && st.list[0].error === "" && !st.list[0].lost, st.list[0]);
} finally { fs.rmSync(pdir, { recursive: true, force: true }); }

/* 4 wiring */
const RC = rd("routes", "characters.js"), RI = rd("routes", "index.js");
check("syncJobs: a vanished render job is kept on the CURRENT row (st reassigned in the loop) with the resumable words; the upscale job too; the ✎ harvest gets resumable()",
  /sceneResume\.lost\(st\.list\.find\(\(x\) => x\.n === r\.n\) \|\| r, "job", r\.job, sceneResume\.resumable\(/.test(RC) && /sceneResume\.lost\(st\.list\.find\(\(x\) => x\.n === r\.n\) \|\| r, "upjob", r\.upjob, false\)/.test(RC)
  && /resumable: \(id\) => sceneResume\.resumable\(/.test(RC));
check("↻ Resume (POST /api/jobs/history/:id/resume) relinks the scenes; Discard forgets them; nothing in server.js",
  /require\("\.\.\/lib\/sceneResume"\)\.relink\(core\.getProject\(\), e\.id\)/.test(RI) && /require\("\.\.\/lib\/sceneResume"\)\.forget\(core\.getProject\(\), req\.params\.id\)/.test(RI) && !/sceneResume/.test(rd("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
