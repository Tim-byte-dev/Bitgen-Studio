#!/usr/bin/env node
/* bitGen Studio — 2.371.0: a NEW project starts fresh in every docker.
 * Run: node scripts/test-freshproject.js
 * Tim: "when user creates a new project clear all the dockers. so the project is fresh and new, clear all the
 * references, characters/actors, chats, assets, gallery etc".
 *   1. the queue: GET /api/jobs lists the CURRENT project's finished jobs only - queued / running work stays
 *      listed whatever project it belongs to (it still holds the GPU); ?all=1 lists everything;
 *   2. the page: New project saves the project being left, creates the new one, then reloads so every docker
 *      (the core page and each extension dock) starts from the new, empty project folder - the unload save is
 *      skipped for that reload, the timeline's local copy and the music dock's last song name are cleared, and the
 *      boot says so in the log. (2.372.0: Open reloads the same way, as an open.) */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

function get(port, u) {
  return new Promise((ok, no) => http.get({ host: "127.0.0.1", port, path: u }, (r) => {
    let b = ""; r.on("data", (c) => { b += c; }); r.on("end", () => { try { ok(JSON.parse(b)); } catch (e) { no(e); } });
  }).on("error", no));
}

(async () => {
  // 1
  const express = require("express");
  const core = require(path.join(ROOT, "lib", "core"));
  const app = express();
  require(path.join(ROOT, "routes", "index.js")).mount(app);
  const srv = app.listen(0, "127.0.0.1");
  await new Promise((ok) => srv.once("listening", ok));
  const port = srv.address().port;
  const cur = core.getProject();
  const base = { dir: "/tmp/none", log: [], progress: 0, created: Date.now() / 1000 };
  const fake = [
    { id: "fp_mine_done", status: "done", project: cur },
    { id: "fp_old_done", status: "done", project: "fp-some-other-project" },
    { id: "fp_old_failed", status: "failed", project: "fp-some-other-project" },
    { id: "fp_old_running", status: "running", project: "fp-some-other-project" },
    { id: "fp_old_queued", status: "queued", project: "fp-some-other-project" },
  ];
  for (const j of fake) { core.jobs.set(j.id, Object.assign({}, base, j)); core.order.push(j.id); }
  let ids = [];
  try { ids = (await get(port, "/api/jobs")).map((j) => j.id); } catch (e) { ids = ["error " + e.message]; }
  check("the queue: this project's finished jobs are listed", ids.includes("fp_mine_done"), ids);
  check("...another project's finished / failed jobs are not (a new project's queue starts empty)",
    !ids.includes("fp_old_done") && !ids.includes("fp_old_failed"), ids);
  check("...queued / running work is listed whatever project it belongs to",
    ids.includes("fp_old_running") && ids.includes("fp_old_queued"), ids);
  let all = [];
  try { all = (await get(port, "/api/jobs?all=1")).map((j) => j.id); } catch (e) { all = ["error " + e.message]; }
  check("?all=1 lists every job in memory", fake.every((j) => all.includes(j.id)), all);
  for (const j of fake) { core.jobs.delete(j.id); const i = core.order.indexOf(j.id); if (i >= 0) core.order.splice(i, 1); }
  srv.close();

  // 2
  const H = read("static", "index.html");
  const npAt = H.indexOf('$("npCreate").onclick');
  const np = H.slice(npAt, H.indexOf("};", npAt));
  check("New project: the project being left is saved FIRST (while the server still points at it)",
    np.indexOf("await saveLeavingState()") > 0 && np.indexOf("await saveLeavingState()") < np.indexOf('fetch("/api/projects/new"'), np.slice(0, 400));
  check("...then the page reloads on the new, empty project (every docker starts again)",
    /freshReload\(j\.name\)/.test(np) && /function freshReload\(name, kind\) \{[\s\S]{0,900}location\.reload\(\)/.test(H));
  check("...the reload resets the workspace (timeline local copy) and forgets the music dock's song name",
    /function freshReload\(name, kind\) \{[\s\S]{0,300}resetWorkspace\(\)[\s\S]{0,300}store\.set\("musong", ""\)/.test(H));
  check("...the unload save is skipped for that reload (it would write the old state into the new project)",
    /let skipUnloadSave = false;/.test(H) && /addEventListener\("beforeunload", \(\) => \{\s*if \(skipUnloadSave\) return;/.test(H)
    && /skipUnloadSave = true;/.test(H));
  check("...saveLeavingState posts the state without reference media (the manifest on disk is kept)",
    /async function saveLeavingState\(\) \{[\s\S]{0,200}delete d\.references;[\s\S]{0,200}fetch\("\/api\/projects\/save"/.test(H));
  check("...the boot logs the fresh start once and drops the flag",
    /sessionStorage\.getItem\("h3\.freshProject"\)/.test(H) && /sessionStorage\.removeItem\("h3\.freshProject"\)/.test(H)
    && /every docker starts empty/.test(H));
  // 2.372.0: Open now reopens through the same reload (the loaded project's dockers), flagged as an OPEN
  check("Open reloads as an OPEN, not a fresh start (2.372.0)",
    /freshReload\(jj\.name, /.test(H.slice(H.indexOf('$("projLoad").onclick'), H.indexOf('$("projLoad").onclick') + 1800))
    && /kind \? "h3\.openedProject" : "h3\.freshProject"/.test(H));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
