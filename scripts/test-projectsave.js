#!/usr/bin/env node
/* bitGen Studio — 2.372.0: Save project keeps EVERYTHING, Save as copies everything, Open brings it all back.
 * Run: node scripts/test-projectsave.js
 * Tim: "when i click save project the song and scenes in videodocker get cleared. everything should be saving
 * including the prompt and prompt chat and all the dockers, references, assets, galleries etc. when i load the
 * project it should load everything from where i saved it".
 *   1. lib/projects.mergeState: the page's keys replace theirs, the server-owned keys (scenes = the board and its
 *      song, chapterRefs) survive;
 *   2. lib/projects.copy (Save as): the whole folder (sound, chat, scenes mirror ...) copied, the .prj renamed to
 *      the new folder, absolute paths pointed at the copy, the recycle bin left behind, an existing project refused;
 *   3. the route: POST /api/projects/save (JSON and multipart) keeps the board; a new name copies and switches;
 *   4. the page: Save as / Open reopen on the project, the leaving project saved first, the dock fields saved. */
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
const core = require(path.join(ROOT, "lib", "core"));
const projects = require(path.join(ROOT, "lib", "projects"));

function req(port, method, u, body) {
  return new Promise((ok, no) => {
    const data = body == null ? null : JSON.stringify(body);
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; });
      res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = { raw: b }; } ok({ status: res.statusCode, j }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}

(async () => {
  const tag = "zzps" + process.pid;
  const SRC = tag + "-src", DST = tag + " copy", OTHER = tag + "-other";
  const orig = core.getProject();
  const cleanup = () => { for (const n of [SRC, DST, OTHER]) fs.rmSync(core.projDir(n), { recursive: true, force: true }); };
  cleanup();
  try {
    // 1
    const m = projects.mergeState({ scenes: { audio: "song.wav", list: [1, 2] }, chapterRefs: { a: 1 }, prompt: "old" },
                                  { prompt: "new", music: { lyrics: "la" }, gone: undefined });
    check("mergeState: the page's keys win, the board (scenes) and chapterRefs survive",
      m.prompt === "new" && m.music.lyrics === "la" && m.scenes.audio === "song.wav" && m.chapterRefs.a === 1 && !("gone" in m), m);

    // 2
    core.ensureProject(SRC);
    const sdir = core.projDir(SRC);
    fs.writeFileSync(core.prjPath(SRC), JSON.stringify({ prompt: "p", scenes: { audio: "song.wav", list: [{ n: 1 }] },
      where: path.join(sdir, "sound", "song.wav") }, null, 2));
    fs.writeFileSync(path.join(sdir, "sound", "song.wav"), "RIFF");
    fs.mkdirSync(path.join(sdir, "chat"), { recursive: true });
    fs.writeFileSync(path.join(sdir, "chat", "2026-10-06_100000.chat"), "{\"role\":\"user\",\"text\":\"hi\"}\n");
    fs.mkdirSync(path.join(sdir, "recycle_bin"), { recursive: true });
    fs.writeFileSync(path.join(sdir, "recycle_bin", "old.mp4"), "x");
    const c = projects.copy(SRC, DST);
    const ddir = core.projDir(DST);
    let dprj = {};
    try { dprj = JSON.parse(fs.readFileSync(core.prjPath(DST), "utf8")); } catch { /* checked below */ }
    check("copy: the .prj is renamed to the new folder and keeps the board + its song",
      c.name === DST && fs.existsSync(core.prjPath(DST)) && !fs.existsSync(path.join(ddir, path.basename(sdir) + ".prj"))
      && dprj.scenes && dprj.scenes.audio === "song.wav" && dprj.prompt === "p", dprj);
    check("copy: the sound, the chat and the other folders come along; the recycle bin stays behind",
      fs.existsSync(path.join(ddir, "sound", "song.wav")) && fs.existsSync(path.join(ddir, "chat", "2026-10-06_100000.chat"))
      && !fs.existsSync(path.join(ddir, "recycle_bin", "old.mp4")));
    check("copy: an absolute path to the old folder now points at the copy", dprj.where === path.join(ddir, "sound", "song.wav"), dprj.where);
    check("copy: the original is untouched", JSON.parse(fs.readFileSync(core.prjPath(SRC), "utf8")).where === path.join(sdir, "sound", "song.wav"));
    let err = null;
    try { projects.copy(SRC, DST); } catch (e) { err = e; }
    check("copy: an existing project is never overwritten (409)", err && err.status === 409, err && err.message);
    err = null;
    try { projects.copy(SRC, "bad/name"); } catch (e) { err = e; }
    check("copy: a bad name is refused (400)", err && err.status === 400);

    // 3
    const express = require("express");
    const app = express();
    require(path.join(ROOT, "routes", "index.js")).mount(app);
    const srv = app.listen(0, "127.0.0.1");
    await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    core.ensureProject(OTHER);
    core.setProject(SRC);
    let r = await req(port, "POST", "/api/projects/save", { data: { prompt: "saved prompt", docks: { muTitle: "T" } } });
    let after = JSON.parse(fs.readFileSync(core.prjPath(SRC), "utf8"));
    check("POST /api/projects/save keeps the scene board and its song (the bug: they were wiped)",
      r.status === 200 && after.scenes && after.scenes.audio === "song.wav" && after.scenes.list.length === 1, after.scenes);
    check("...and stores the page's state, the dock fields included",
      after.prompt === "saved prompt" && after.docks && after.docks.muTitle === "T" && after.saved);
    r = await req(port, "POST", "/api/projects/save", { name: SRC, data: { prompt: "same name" } });
    check("...the same name saves in place (no copy)", r.status === 200 && r.j.name === SRC && !r.j.copied_from && core.getProject() === SRC, r.j);
    fs.rmSync(ddir, { recursive: true, force: true });
    r = await req(port, "POST", "/api/projects/save", { name: DST, data: { prompt: "copy prompt" } });
    after = {}; try { after = JSON.parse(fs.readFileSync(core.prjPath(DST), "utf8")); } catch { /* checked */ }
    check("a NEW name = Save as: the project is copied, the server switches to the copy, the board comes along",
      r.status === 200 && r.j.copied_from === SRC && r.j.name === DST && core.getProject() === DST
      && after.scenes && after.scenes.audio === "song.wav" && after.prompt === "copy prompt"
      && fs.existsSync(path.join(ddir, "sound", "song.wav")), [r.j, after.scenes]);
    check("...the original keeps its own prompt", JSON.parse(fs.readFileSync(core.prjPath(SRC), "utf8")).prompt === "same name");
    r = await req(port, "POST", "/api/projects/save", { name: OTHER, data: { prompt: "x" } });
    check("...Save as onto ANOTHER existing project is refused (409) and nothing switches",
      r.status === 409 && core.getProject() === DST && /already exists/.test(r.j.error || ""), r);
    srv.close();
  } finally {
    try { core.setProject(orig); } catch { /* restored below */ }
    cleanup();
  }

  // 4
  const H = read("static", "index.html");
  const at = (k) => H.indexOf(k);
  const save = H.slice(at('$("projSave").onclick'), at('$("projSave").onclick') + 900);
  check("the page: Save as (copied_from) reopens on the copy", /if \(j\.copied_from\) \{ freshReload\(j\.name, /.test(save));
  const load = H.slice(at('$("projLoad").onclick'), at('$("projLoad").onclick') + 1800);
  check("the page: Open saves the project being left FIRST, then reopens on the loaded project",
    load.indexOf("await saveLeavingState()") > 0 && load.indexOf("await saveLeavingState()") < load.indexOf('fetch("/api/projects/load"')
    && /freshReload\(jj\.name, /.test(load));
  check("the reload note: the boot logs the opened project once and drops the flag",
    /sessionStorage\.getItem\("h3\.openedProject"\)/.test(H) && /sessionStorage\.removeItem\("h3\.openedProject"\)/.test(H)
    && /every docker loaded from the project as it was saved/.test(H));
  check("the dock fields are in the project state and applied on load (selects retried until their options arrive)",
    /docks: dockFieldsState\(\)/.test(H) && /const DOCK_FIELDS = \[[^\]]*"muTitle"[^\]]*"enhancedText"[^\]]*"stSong"/.test(H)
    && /if \(d\.docks\) applyDockFields\(d\.docks\);/.test(H) && /setTimeout\(again, 750\)/.test(H));
  check("the routes: save merges into the .prj and copies on a new name",
    /projects\.mergeState\(prev, data\)/.test(read("routes", "index.js")) && /projects\.copy\(cur, want\)/.test(read("routes", "index.js")));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
