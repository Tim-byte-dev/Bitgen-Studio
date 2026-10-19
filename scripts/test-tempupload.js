#!/usr/bin/env node
/* bitGen Studio — 2.378.0: uploads land in the CURRENT project's temp/ and API errors answer JSON.
 * Run: node scripts/test-tempupload.js
 * Tim: "fix Unexpected token '<', "<!DOCTYPE "... is not valid JSON when trying to add new character".
 * (The character routes' upload folder was fixed at start - the temp/ of the project open then; after a ↺ Reset of that
 * project it was gone, multer failed with ENOENT and Express answered its HTML error page.)
 *   1. lib/tempUpload: the folder is resolved per request (created when missing) and follows a project switch;
 *   2. an upload error answers JSON (413 too big);
 *   3. the real character route: the start project's temp/ deleted (as a reset does) -> the new character's picture
 *      still uploads, JSON all the way;
 *   4. jsonErrors: an unknown /api address, a too-big or broken JSON body -> JSON, never an HTML page;
 *   5. no route builds its upload folder once at start any more. */
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
const TU = require(path.join(ROOT, "lib", "tempUpload"));

function send(port, method, u, body, type) {
  return new Promise((ok, no) => {
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: body ? { "Content-Type": type, "Content-Length": body.length } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; });
      res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = null; } ok({ status: res.statusCode, j, raw: b.slice(0, 120) }); });
    });
    r.on("error", no); if (body) r.write(body); r.end();
  });
}
function multipart(field, name, buf) {
  const bd = "----h3test" + Date.now();
  const body = Buffer.concat([Buffer.from(`--${bd}\r\nContent-Disposition: form-data; name="${field}"; filename="${name}"\r\n`
    + "Content-Type: image/png\r\n\r\n"), buf, Buffer.from(`\r\n--${bd}--\r\n`)]);
  return { body, type: "multipart/form-data; boundary=" + bd };
}
// a real 1x1 PNG
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082", "hex");

(async () => {
  const orig = core.getProject();
  const A = "zz_tu378a_" + process.pid, B = "zz_tu378b_" + process.pid;
  const express = require("express");
  try {
    core.ensureProject(A); core.ensureProject(B); core.setProject(A);
    // 1 + 2
    const app = express();
    const up = TU.tempUpload({ fileSize: 1000 });
    let seen = null;
    app.post("/api/t", up.single("file"), (req, res) => { seen = req.file && req.file.path; res.json({ ok: true }); });
    TU.jsonErrors(app);
    const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    fs.rmSync(path.join(core.projDir(A), "temp"), { recursive: true, force: true });
    let m = multipart("file", "a.png", PNG);
    let r = await send(port, "POST", "/api/t", m.body, m.type);
    check("tempUpload: the current project's temp/ is made when missing and the file lands there", r.status === 200 && seen
      && path.dirname(seen) === path.join(core.projDir(A), "temp") && fs.existsSync(seen), { r, seen });
    core.setProject(B);
    m = multipart("file", "b.png", PNG);
    r = await send(port, "POST", "/api/t", m.body, m.type);
    check("...a project switch moves the uploads to the new project's temp/", r.status === 200 && path.dirname(seen) === path.join(core.projDir(B), "temp"), seen);
    m = multipart("file", "big.png", Buffer.alloc(5000, 1));
    r = await send(port, "POST", "/api/t", m.body, m.type);
    check("an upload error answers JSON (413, the file is too big), never an HTML page", r.status === 413 && r.j && /too big/.test(r.j.error), r);
    m = multipart("other", "x.png", PNG);
    r = await send(port, "POST", "/api/t", m.body, m.type);
    check("...an unexpected field answers JSON 400", r.status === 400 && r.j && /upload failed/.test(r.j.error), r);
    srv.close();

    // 3 + 4: the real routes
    core.setProject(A);
    const app2 = express();
    require(path.join(ROOT, "routes", "index.js")).mount(app2);
    const srv2 = app2.listen(0, "127.0.0.1"); await new Promise((ok) => srv2.once("listening", ok));
    const p2 = srv2.address().port;
    fs.rmSync(path.join(core.projDir(A), "temp"), { recursive: true, force: true });   // what a reset does
    r = await send(p2, "POST", "/api/characters", Buffer.from(JSON.stringify({ name: "Zed" })), "application/json");
    m = multipart("file", "face.png", PNG);
    const r2 = await send(p2, "POST", "/api/characters/Zed/asset", m.body, m.type);
    check("the new character's picture uploads after the project's temp/ was deleted (JSON, not '<!DOCTYPE')",
      r.status === 200 && r2.status === 200 && r2.j && r2.j.ok === true && !/^\s*</.test(r2.raw), { r: r.raw, r2: r2.raw });
    r = await send(p2, "POST", "/api/nope-" + process.pid, Buffer.from("{}"), "application/json");
    check("jsonErrors: an /api address that does not exist answers a JSON 404", r.status === 404 && r.j && /no such API/.test(r.j.error), r);
    r = await send(p2, "POST", "/api/characters", Buffer.from(JSON.stringify({ x: "a".repeat(200000) })), "application/json");
    check("...a JSON body over the limit answers JSON 413", r.status === 413 && r.j && /too big/.test(r.j.error), r);
    r = await send(p2, "POST", "/api/characters", Buffer.from("{bad"), "application/json");
    check("...a broken JSON body answers JSON 400", r.status === 400 && r.j && typeof r.j.error === "string", r);
    srv2.close();
  } finally {
    try { core.setProject(orig); } catch { /* restored */ }
    for (const n of [A, B]) fs.rmSync(core.projDir(n), { recursive: true, force: true });
  }

  // 5
  const routes = fs.readdirSync(path.join(ROOT, "routes")).filter((f) => f.endsWith(".js"));
  const fixed = routes.filter((f) => /multer\(\{\s*dest:\s*core\.tempDir\(\)/.test(read("routes", f)));
  check("no route fixes its upload folder at start (multer({ dest: core.tempDir() }))", fixed.length === 0, fixed);
  check("characters / h3Viggle / remote use lib/tempUpload; routes/index mounts jsonErrors last",
    ["characters.js", "h3Viggle.js", "remote.js"].every((f) => /require\("\.\.\/lib\/tempUpload"\)\.tempUpload\(/.test(read("routes", f)))
    && /require\("\.\.\/lib\/tempUpload"\)\.jsonErrors\(app\);\s*\}\s*module\.exports/.test(read("routes", "index.js")));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
