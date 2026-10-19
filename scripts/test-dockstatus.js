#!/usr/bin/env node
/* bitGen Studio — 2.381.0: docker_status.json (lib/dockerStatus.js, routes/dockerStatus.js, static/dockstatus.js).
 * Run: node scripts/test-dockstatus.js
 * Tim: "create a file for docker status - docker_status.json / keep docker open, closed, hidden, height, width,
 * max-height,max-width, maximized values in this file ... add a pin button to the left of each docker ... the height
 * and the width of the dockers will be the current height, this will be loaded first".
 *   1. the record: every dock (11 bottom + 5 side) with the seven values, junk clamped, one maximized dock;
 *   2. merge: per dock, the dock just maximized wins;
 *   3. the first run folds in ui.docks (settings) then dockers.json, and writes the file; after that the file rules;
 *   4. the page gets the record in its head (inject), before any script;
 *   5. the routes (GET / POST /api/docker-status, "/" carries the record), mounted from routes/index.js;
 *   6. the 📌 / reflow rules (static/dockstatus.js). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const D = require(path.join(ROOT, "lib", "dockerStatus"));
const S = require(path.join(ROOT, "static", "dockstatus.js"));

// 1
const def = D.defaults();
const KEYS = ["state", "hidden", "height", "width", "max_height", "max_width", "maximized"];
check("defaults: 16 docks, each with state / hidden / height / width / max_height / max_width / maximized",
  Object.keys(def.docks).length === 16 && Object.values(def.docks).every((e) => KEYS.every((k) => k in e))
  && def.docks.consoledock.state === "closed" && def.docks.timelinedock.state === "open" && def.docks.ldock.width === 300, def.docks.timelinedock);
const n = D.normalize({ docks: { timelinedock: { height: 99999, max_height: -5, state: "max", maximized: true }, musicdock: { maximized: true, hidden: true },
  ldock: { width: 5, max_width: 9999, state: "closed", maximized: true }, nope: { height: 1 } } });
check("normalize: junk clamped (height <= 4000, a negative max = 0 unpinned, side width 140..640), unknown docks dropped, side docks never maximized / closed",
  n.docks.timelinedock.height === 4000 && n.docks.timelinedock.max_height === 0 && n.docks.timelinedock.state === "open"
  && n.docks.ldock.width === 140 && n.docks.ldock.max_width === 640 && n.docks.ldock.state === "open" && n.docks.ldock.maximized === false
  && !n.docks.nope && n.docks.musicdock.hidden === true, n.docks);
check("...ONE maximized dock (the last in dock order)", n.docks.musicdock.maximized === true && n.docks.timelinedock.maximized === false);

// 2
const m = D.merge(n, { docks: { timelinedock: { maximized: true, max_height: 210 } } });
check("merge: per dock; the dock JUST maximized wins over the one before", m.docks.timelinedock.maximized && !m.docks.musicdock.maximized
  && m.docks.timelinedock.max_height === 210 && m.docks.musicdock.hidden === true);

// 3
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dstat-"));
fs.writeFileSync(path.join(tmp, "dockers.json"), JSON.stringify({ docks: { timelinedock: { height: 333, state: "max" }, musicdock: { state: "min" }, chatdock: { height: 211, state: "normal" } } }));
const r1 = D.load(tmp, { uiDocks: { chatdock: { height: 201, state: "closed" }, promptdock: { height: 121, state: "open" }, ldock: { width: 311, state: "closed" } } });
check("first run: ui.docks folded in, then dockers.json over it (timeline 333 maximized, music closed, chat 211 open, prompt 121, left dock 311 hidden)",
  r1.docks.timelinedock.height === 333 && r1.docks.timelinedock.maximized && r1.docks.musicdock.state === "closed"
  && r1.docks.chatdock.height === 211 && r1.docks.chatdock.state === "open" && r1.docks.promptdock.height === 121
  && r1.docks.ldock.width === 311 && r1.docks.ldock.hidden === true, r1.docks);
check("...and docker_status.json is written at the install root", fs.existsSync(path.join(tmp, "docker_status.json")));
fs.writeFileSync(path.join(tmp, "dockers.json"), JSON.stringify({ docks: { timelinedock: { height: 99 } } }));
const r2 = D.save(tmp, { docks: { promptdock: { max_height: 121 }, rdock: { max_width: 280 } } });
check("after that the FILE rules (the older records are not read again); save merges + writes atomically",
  r2.docks.timelinedock.height === 333 && r2.docks.promptdock.max_height === 121 && r2.docks.rdock.max_width === 280
  && JSON.parse(fs.readFileSync(path.join(tmp, "docker_status.json"), "utf8")).docks.promptdock.max_height === 121
  && !fs.existsSync(path.join(tmp, "docker_status.json.tmp")), r2.docks.timelinedock);

// 4
const page = D.inject("<!doctype html>\n<html><head>\n<title>x</title><script>1</script></head></html>", { version: 1, docks: { a: { s: "</script>" } } });
check("inject: the record is the FIRST thing in <head> (window.H3_DOCK_STATUS), a </script> in it cannot break out",
  /<head>\n<script>window\.H3_DOCK_STATUS = \{/.test(page) && page.indexOf("H3_DOCK_STATUS") < page.indexOf("<title>") && !/"<\/script>"/.test(page), page.slice(0, 160));

// 6
const e = { max_height: 0 };
check("📌 togglePin: unpinned -> max = the current size; pinned -> 0", S.togglePin(e, 187.4) === 187 && e.max_height === 187 && S.togglePin(e, 50) === 0 && e.max_height === 0);
check("...a side dock pins its width", (() => { const w = { max_width: 0 }; return S.togglePin(w, 260, true) === 260 && w.max_width === 260; })());
check("shown: the height, or the max when that is less", S.shown(300, 0) === 300 && S.shown(300, 200) === 200 && S.shown(150, 200) === 150);
check("clampDrag: the floor / ceiling, and never past a pin", S.clampDrag(500, 60, 400, 0) === 400 && S.clampDrag(500, 60, 400, 250) === 250 && S.clampDrag(10, 60, 400, 250) === 60);
check("reflowOrder: the UNPINNED docks other than the one just opened; else every unpinned; else all",
  JSON.stringify(S.reflowOrder(["a", "b", "c"], { b: { max_height: 100 } }, "c")) === '["a"]'
  && JSON.stringify(S.reflowOrder(["b", "c"], { b: { max_height: 100 } }, "c")) === '["c"]'
  && JSON.stringify(S.reflowOrder(["b"], { b: { max_height: 100 } }, null)) === '["b"]');

(async () => {
  // 5
  const core = require(path.join(ROOT, "lib", "core"));
  const f = D.fileOf(core.BASE), had = fs.existsSync(f) ? fs.readFileSync(f) : null;
  const express = require("express");
  const app = express(); app.use(express.json());
  require(path.join(ROOT, "routes", "index.js")).mount(app);
  const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
  const port = srv.address().port;
  const send = (method, u, body) => new Promise((ok, no) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const rq = http.request({ host: "127.0.0.1", port, path: u, method, headers: data ? { "Content-Type": "application/json", "Content-Length": data.length } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; }); res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = b; } ok({ status: res.statusCode, j }); });
    });
    rq.on("error", no); if (data) rq.write(data); rq.end();
  });
  try {
    let r = await send("POST", "/api/docker-status", { docks: { sfxdock: { height: 222, max_height: 222, state: "open" } } });
    check("POST /api/docker-status merges a dock and answers the whole record", r.status === 200 && r.j.docks.sfxdock.max_height === 222 && Object.keys(r.j.docks).length === 16, r);
    r = await send("GET", "/api/docker-status");
    check("GET /api/docker-status reads it back", r.status === 200 && r.j.docks.sfxdock.height === 222, r.j.docks && r.j.docks.sfxdock);
    r = await send("POST", "/api/docker-status", { nope: 1 });
    check("...a body without docks: 400 in JSON", r.status === 400 && /docks/.test(r.j.error), r);
    r = await send("GET", "/");
    check('"/" carries the record in its head (window.H3_DOCK_STATUS, with the saved sfx pin)', r.status === 200 && /window\.H3_DOCK_STATUS = \{[^<]*"sfxdock":\{[^}]*"max_height":222/.test(r.j), String(r.j).slice(0, 200));
  } finally {
    srv.close();
    if (had) fs.writeFileSync(f, had); else fs.rmSync(f, { force: true });
  }
  const IDX = read("routes", "index.js"), H = read("static", "index.html");
  check("wiring: routes/dockerStatus mounted from routes/index.js (never server.js); the page loads static/dockstatus.js",
    /require\("\.\/dockerStatus"\)\.mount\(app\)/.test(IDX) && /require\("\.\/dockerStatus"\)\.page\(extensions\.pageHtml\(\)\)/.test(IDX)
    && !/dockerStatus/.test(read("server.js")) && H.includes('<script src="/static/dockstatus.js"></script>'));
  check("the packages leave docker_status.json out (user state, like dockers.json)",
    /! -name "docker_status\.json"/.test(read("scripts", "make_zips.sh")) && /^docker_status\.json$/m.test(read(".gitignore")));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e2) => { console.log("FAIL: crashed " + e2.stack); process.exit(1); });
