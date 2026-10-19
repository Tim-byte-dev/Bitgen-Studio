#!/usr/bin/env node
/* bitGen Studio — 2.374.0: the left dock's 🗑 Recycle bin dialog and ↺ Reset project.
 * Run: node scripts/test-recyclebin-dlg.js
 * Tim: "add a recycle bin(icon only) button to the menubar in the left docker, create a dialog for the recycle bin,
 * add a menubar to the dialog, restore, delete, empty buttons to the menubar. add a titlebar to the recycle bin
 * dialog. add a reset button to the menubar in the left docker - delete the current project folder and re-create
 * it from the original name and description - this needs a verify msgbox".
 *   1. lib/recycleBin: a binned file records where it came from; list (newest first, old files guessed by kind),
 *      restore (back to its folder, a taken name -> name-1), delete for good, empty; nothing outside the bin;
 *   2. lib/projects.reset: the folder deleted and made again with the same name + description; refused for a name
 *      that is not the current project and while one of its jobs is queued / running;
 *   3. the routes on a real mount;
 *   4. the page: 🗑 and ↺ icon-only in the left dock's menubar, the dialog's titlebar + menubar (Restore / Delete /
 *      Empty), Delete / Empty / Reset ask first, the reset reopens the page. */
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
const rb = require(path.join(ROOT, "lib", "recycleBin"));
const projects = require(path.join(ROOT, "lib", "projects"));

function req(port, method, u, body) {
  return new Promise((ok, no) => {
    const data = body == null ? null : JSON.stringify(body);
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; });
      res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = { raw: b.slice(0, 80) }; } ok({ status: res.statusCode, j }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}

(async () => {
  const orig = core.getProject();
  const P = "zzrb" + process.pid;
  const pdir = core.projDir(P);
  try {
    core.ensureProject(P);
    core.setProject(P);
    const put = (rel, body) => { const f = path.join(pdir, ...rel.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); return f; };
    // 1
    rb.recycle(put("output/clip.mp4", "v1"));
    await new Promise((ok) => setTimeout(ok, 15));
    rb.recycle(put("images/pic.png", "i1"));
    const bin = rb.binDir();
    fs.writeFileSync(path.join(bin, "old_song.wav"), "a");                // binned before the records
    let L = rb.list();
    const by = (n) => L.find((e) => e.name === n);
    check("recycle records the origin; list = name, from, when, size, kind (newest first)",
      L.length === 3 && by("clip.mp4").from === "output/clip.mp4" && by("clip.mp4").kind === "video" && by("clip.mp4").size === 2
      && by("pic.png").from === "images/pic.png" && L[0].name !== "clip.mp4", L);
    check("a file binned before the records: guessed into its kind's asset folder, flagged",
      by("old_song.wav").from === "sound/old_song.wav" && by("old_song.wav").guessed === true);
    check("the record file is never listed", !L.some((e) => e.name.startsWith(".")));
    put("output/clip.mp4", "NEW");                                       // the name is taken again meanwhile
    let r = rb.restore(undefined, ["clip.mp4", "old_song.wav", "nope.png", "../escape.txt"]);
    check("restore: back where it came from; a taken name gets name-1; unknown names reported",
      r.restored.length === 2 && r.restored[0].to === "output/clip-1.mp4" && fs.readFileSync(path.join(pdir, "output", "clip-1.mp4"), "utf8") === "v1"
      && fs.readFileSync(path.join(pdir, "output", "clip.mp4"), "utf8") === "NEW" && r.restored[1].to === "sound/old_song.wav"
      && r.missing.join() === "nope.png,../escape.txt", r);
    check("...and they are out of the bin (and its records)", rb.list().map((e) => e.name).join() === "pic.png"
      && !Object.prototype.hasOwnProperty.call(JSON.parse(fs.readFileSync(path.join(bin, rb.MANIFEST), "utf8")), "clip.mp4"));
    rb.recycle(put("video/take.mp4", "t"));
    r = rb.remove(undefined, ["pic.png", ".recycle.json"]);
    check("delete: for good; the record file can never be deleted through it", r.deleted.join() === "pic.png"
      && !fs.existsSync(path.join(bin, "pic.png")) && fs.existsSync(path.join(bin, rb.MANIFEST)) && r.missing.join() === ".recycle.json", r);
    rb.recycle(put("sound/x.wav", "x"));
    r = rb.empty();
    check("empty: every file in the bin gone", r.deleted === 2 && rb.list().length === 0, r);
    check("filePath never leaves the bin", rb.filePath(undefined, "../" + P + ".prj") === null && rb.filePath(undefined, ".recycle.json") === null);

    // 2
    fs.writeFileSync(core.prjPath(P), JSON.stringify({ description: "A film about rain", created: "2026-01-02T00:00:00Z", prompt: "x" }));
    put("chat/a.chat", "{}");
    let err = null;
    try { await projects.reset("not-" + P); } catch (e) { err = e; }
    check("reset: a name that is not the current project is refused (400)", err && err.status === 400);
    // 2.378.0: a queued / running job of the project no longer refuses the reset - it is stopped (lib/projectReset)
    const q1 = { id: "j1", status: "queued", project: P }, other = new Map([["j1", q1], ["j2", { id: "j2", status: "running", project: "someone-else" }],
      ["j3", { id: "j3", status: "done", project: P }]]);
    const rr = await projects.reset(P, { jobs: other, queue: [q1], order: ["j1", "j2", "j3"] });
    const prj = JSON.parse(fs.readFileSync(core.prjPath(P), "utf8"));
    check("reset: the folder is deleted and made again - same name, the description kept, nothing else",
      rr.name === P && core.getProject() === P && prj.description === "A film about rain" && prj.prompt === undefined
      && prj.reset_from === "2026-01-02T00:00:00Z" && !fs.existsSync(path.join(pdir, "chat", "a.chat"))
      && !fs.existsSync(path.join(pdir, "output", "clip.mp4")) && fs.existsSync(path.join(pdir, "sound")), prj);
    check("reset: its queued job stopped, its jobs out of memory; another project's job untouched",
      rr.stopped === 1 && rr.jobs_cleared === 2 && q1.status === "cancelled" && [...other.keys()].join() === "j2", { rr, keys: [...other.keys()] });

    // 3
    const express = require("express");
    const app = express();
    require(path.join(ROOT, "routes", "index.js")).mount(app);
    const srv = app.listen(0, "127.0.0.1");
    await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    rb.recycle(put("images/a.png", "a"));
    rb.recycle(put("images/b.png", "b"));
    let g = await req(port, "GET", "/api/recyclebin");
    check("GET /api/recyclebin: the current project's bin, count and size", g.status === 200 && g.j.project === P && g.j.count === 2 && g.j.size === 2, g.j);
    let f = await req(port, "GET", "/api/recyclebin/file/a.png");
    check("GET /api/recyclebin/file/:name serves a binned file; anything else 404", f.status === 200
      && (await req(port, "GET", "/api/recyclebin/file/zz.png")).status === 404);
    let x = await req(port, "POST", "/api/recyclebin/restore", { names: ["a.png"] });
    check("POST restore", x.status === 200 && x.j.restored[0].to === "images/a.png" && fs.existsSync(path.join(pdir, "images", "a.png")), x.j);
    check("POST restore / delete with nothing picked: 400", (await req(port, "POST", "/api/recyclebin/restore", {})).status === 400
      && (await req(port, "POST", "/api/recyclebin/delete", { names: [] })).status === 400);
    x = await req(port, "POST", "/api/recyclebin/delete", { names: ["b.png"] });
    check("POST delete", x.status === 200 && x.j.deleted.join() === "b.png");
    rb.recycle(put("images/c.png", "c"));
    x = await req(port, "POST", "/api/recyclebin/empty", {});
    check("POST empty", x.status === 200 && x.j.deleted === 1 && rb.list().length === 0);
    x = await req(port, "POST", "/api/projects/reset", { name: "wrong" });
    check("POST /api/projects/reset: the wrong name is refused", x.status === 400 && /current project/.test(x.j.error));
    put("video/v.mp4", "v");
    x = await req(port, "POST", "/api/projects/reset", { name: P });
    check("POST /api/projects/reset: the folder made again, the description kept",
      x.status === 200 && x.j.name === P && x.j.data.description === "A film about rain" && !fs.existsSync(path.join(pdir, "video", "v.mp4")), x.j);
    srv.close();
  } finally {
    try { core.setProject(orig); } catch { /* restored */ }
    fs.rmSync(pdir, { recursive: true, force: true });
  }

  // 4
  const JS = read("static", "recyclebin.js"), H = read("static", "index.html"), IDX = read("routes", "index.js");
  check("routes/recycleBin.js is mounted from routes/index.js", /require\("\.\/recycleBin"\)\.mount\(app\)/.test(IDX));
  check("the page loads static/recyclebin.js", /<script src="\/static\/recyclebin\.js"><\/script>/.test(H));
  check("🗑 and ↺ go in the left dock's menubar (before ⚙), icon only, named by title + aria-label",
    /#menubar \.projbtns, #ldock \.dockhead \.projbtns/.test(JS) && /bin\.id = "projBin"[^\n]*bin\.textContent = "🗑"/.test(JS)
    && /rst\.id = "projReset"[^\n]*rst\.textContent = "↺"/.test(JS) && /bar\.insertBefore\(bin, before\); bar\.insertBefore\(rst, before\);/.test(JS)
    && /setAttribute\("aria-label", "Recycle bin"\)/.test(JS) && /setAttribute\("aria-label", "Reset project"\)/.test(JS));
  check("the dialog: a titlebar (title, count + size, ✕) and a menubar with Restore, Delete, Empty",
    /class="rb-title" id="rbTitle"><h2>🗑 Recycle bin<\/h2><span class="rb-sum" id="rbSum"><\/span>/.test(JS)
    && /class="rb-x" id="rbClose"/.test(JS) && /class="rb-menu" id="rbMenu" role="toolbar"/.test(JS)
    && /id="rbRestore"[^>]*>↩ Restore</.test(JS) && /id="rbDelete"[^>]*>✕ Delete</.test(JS) && /id="rbEmpty"[^>]*>🧹 Empty</.test(JS));
  check("Delete and Empty ask first (for good); Reset asks with the verify box, then reopens the page",
    /function deleteSel\(\)[\s\S]{0,300}confirmBox\(/.test(JS) && /function emptyBin\(\)[\s\S]{0,200}confirmBox\(/.test(JS)
    && /function resetProject\(\)[\s\S]{0,1200}confirmBox\("Reset the project/.test(JS)
    && /post\("\/api\/projects\/reset", \{ name: name \}\)/.test(JS) && /window\.freshReload\(j\.name, "reset"\)/.test(JS));
  check("the boot names the reset", /o\.kind === "reset"\) \{\s*logLine\(`\[project\] "\$\{o\.name \|\| ""\}" reset - its folder was deleted and created again/.test(H));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
