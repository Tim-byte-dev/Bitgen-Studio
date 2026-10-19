#!/usr/bin/env node
/* bitGen Studio — 2.359.0: SAVE / SAVE AS (the preview dialog's 💾 Save, the gallery tiles' Save as).
 * Run: node scripts/test-saveas.js
 * Tim: "add a save button to the image preview dialog next to the open externally button. add a save as button
 * to the top left of the thumbnails in the gallery button. on save the file to the last save as location".
 *   1. lib/saveAs: the URL -> file map, Save as (copies + remembers the folder), Save (the last folder, a free
 *      name - never an overwrite), overwrite on request, a missing / gone folder = need_dir;
 *   2. routes/saveAs.js LIVE on an express app: /last, a server-side copy, the upload path, 404 for a file the
 *      server does not serve, the loopback-only guard;
 *   3. jsdom: the file dialog's Save As mode (Save, File name prefilled, the replace question, a folder name
 *      goes in); static/saveas.js (Save -> Save as when there is no folder, uploads a blob:, a remote page
 *      downloads);
 *   4. the wiring in static/index.html + routes/index.js. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 900) : "")); }
}
const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const SA = require(path.join(ROOT, "lib", "saveAs"));

const memo = SA.file();
const memoSnap = fs.existsSync(memo) ? fs.readFileSync(memo) : null;
const T = fs.mkdtempSync(path.join(os.tmpdir(), "saveas359_"));
const outDir = core.pDir("output"); fs.mkdirSync(outDir, { recursive: true });
const imgDir = core.pDir("images"); fs.mkdirSync(imgDir, { recursive: true });
const SRC = "e2e_saveas359.png", ASSET = "e2e_saveas359_asset.png";
fs.writeFileSync(path.join(outDir, SRC), "PNGDATA-1");
fs.writeFileSync(path.join(imgDir, ASSET), "ASSET-1");
const D1 = path.join(T, "Exports"), D2 = path.join(T, "Other");
fs.mkdirSync(D1); fs.mkdirSync(D2);

(async () => {
try {
  // ---- 1. the module
  try { fs.unlinkSync(memo); } catch {}
  check("resolve: /outputs/<name> (output/), /passets/<kind>/<name>, /api/fdlg/file?path=; anything else null",
    SA.resolve(`/outputs/${encodeURIComponent(SRC)}`) === path.join(outDir, SRC)
    && SA.resolve(`/passets/images/${ASSET}`) === path.join(imgDir, ASSET)
    && SA.resolve(`/api/fdlg/file?path=${encodeURIComponent(path.join(outDir, SRC))}`) === path.join(outDir, SRC)
    && SA.resolve("/outputs/nope.png") === null && SA.resolve("blob:http://x/abc") === null && SA.resolve("/static/x.js") === null);
  check("safeName / freeName: no folders or reserved characters; a taken name gets (2), (3)",
    SA.safeName("../a:b?.png") === "a_b_.png" && SA.safeName("") === "file"
    && (() => { fs.writeFileSync(path.join(T, "x.png"), "1"); fs.writeFileSync(path.join(T, "x (2).png"), "1");
                return SA.freeName(T, "x.png") === "x (3).png" && SA.freeName(T, "y.png") === "y.png"; })());
  let r = SA.copyOut(path.join(outDir, SRC), {});
  check("Save with no save-as folder yet: need_dir (409), nothing written", r.need_dir === true && r.status === 409 && SA.last().dir === "", r);
  r = SA.copyOut(path.join(outDir, SRC), { dest: path.join(D1, "hero.png") });
  check("Save as: the picked folder + name, the folder becomes the last save-as location",
    r.ok && fs.readFileSync(path.join(D1, "hero.png"), "utf8") === "PNGDATA-1" && SA.last().dir === D1 && SA.last().exists, r);
  r = SA.copyOut(path.join(outDir, SRC), {});
  const r2 = SA.copyOut(path.join(outDir, SRC), {});
  check("Save: into the last folder under its own name; a second Save never overwrites (name (2))",
    r.ok && r.path === path.join(D1, SRC) && r2.ok && r2.name === "e2e_saveas359 (2).png" && r2.renamed === true, [r, r2]);
  fs.writeFileSync(path.join(outDir, SRC), "PNGDATA-2");
  r = SA.copyOut(path.join(outDir, SRC), { dest: path.join(D1, "hero.png"), overwrite: true });
  check("Save as onto an existing file with overwrite (the dialog asked): replaced",
    r.ok && r.name === "hero.png" && fs.readFileSync(path.join(D1, "hero.png"), "utf8") === "PNGDATA-2", r);
  r = SA.copyOut(path.join(outDir, SRC), { dest: path.join(D1, "hero.png") });
  check("...without overwrite it is never replaced (a free name instead)", r.ok && r.name === "hero (2).png", r);
  SA.remember(path.join(T, "gone"));
  r = SA.copyOut(path.join(outDir, SRC), {});
  check("Save when the last folder is gone: need_dir, said in words", r.need_dir && /folder is gone/.test(r.error), r);
  check("a source that is not on disk: 404 in words", SA.copyOut(path.join(T, "nope.png"), { dest: path.join(D1, "z.png") }).status === 404);
  SA.remember(D1);

  // ---- 2. the routes LIVE
  const express = require("express");
  const app = express(); app.use(express.json());
  require(path.join(ROOT, "routes", "saveAs")).mount(app);
  const srv = app.listen(0, "127.0.0.1");
  await new Promise((ok) => srv.once("listening", ok));
  const port = srv.address().port;
  const req = (method, p, body, headers) => new Promise((ok) => {
    const data = body == null ? null : (Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)));
    const rq = http.request({ host: "127.0.0.1", port, path: p, method,
      headers: { ...(data && !headers ? { "Content-Type": "application/json" } : {}), ...(headers || {}),
                 ...(data ? { "Content-Length": data.length } : {}) } }, (rs) => {
      let b = ""; rs.on("data", (c) => (b += c)); rs.on("end", () => { let j = null; try { j = JSON.parse(b); } catch {} ok({ status: rs.statusCode, j }); });
    });
    if (data) rq.write(data); rq.end();
  });
  let a = await req("GET", "/api/save-as/last");
  check("GET /api/save-as/last: the remembered folder", a.status === 200 && a.j.dir === D1 && a.j.exists === true, a);
  a = await req("POST", "/api/save-as", { url: `/outputs/${SRC}?v=12`.replace("?v=12", ""), name: SRC });
  check("POST /api/save-as {url}: Save copies into the last folder, the note says where",
    a.status === 200 && a.j.ok && a.j.dir === D1 && /^saved e2e_saveas359 \(3\)\.png to /.test(a.j.note) && /already there/.test(a.j.note), a);
  a = await req("POST", "/api/save-as", { url: `/passets/images/${ASSET}`, dest: path.join(D2, "asset copy.png") });
  check("POST /api/save-as {url, dest}: Save as copies an asset and moves the last folder",
    a.status === 200 && fs.readFileSync(path.join(D2, "asset copy.png"), "utf8") === "ASSET-1" && SA.last().dir === D2, a);
  a = await req("POST", "/api/save-as", { url: "/somewhere/else.png" });
  check("a URL the server does not serve from disk: 404 {upload: true} (the page uploads it instead)", a.status === 404 && a.j.upload === true, a);
  const B = "----bnd359";
  const mp = Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="name"\r\n\r\nref picture.png\r\n`
    + `--${B}\r\nContent-Disposition: form-data; name="file"; filename="blob"\r\nContent-Type: image/png\r\n\r\nBLOBBYTES\r\n--${B}--\r\n`);
  a = await req("POST", "/api/save-as/upload", mp, { "Content-Type": `multipart/form-data; boundary=${B}` });
  check("POST /api/save-as/upload: a picture only the page holds is saved into the last folder under its name",
    a.status === 200 && a.j.ok && fs.readFileSync(path.join(D2, "ref picture.png"), "utf8") === "BLOBBYTES", a);
  SA.remember(path.join(T, "gone2"));
  a = await req("POST", "/api/save-as", { url: `/outputs/${SRC}` });
  check("Save with the folder gone: 409 {need_dir} (the page asks with Save as)", a.status === 409 && a.j.need_dir === true, a);
  srv.close();
  // the guard
  const app2 = express(); app2.use(express.json());
  const fdlg = require(path.join(ROOT, "lib", "fileDialog"));
  const real = fdlg.isLoopback; fdlg.isLoopback = () => false;
  require(path.join(ROOT, "routes", "saveAs")).mount(app2);
  const srv2 = app2.listen(0, "127.0.0.1"); await new Promise((ok) => srv2.once("listening", ok));
  const g = await new Promise((ok) => http.get({ host: "127.0.0.1", port: srv2.address().port, path: "/api/save-as/last" },
    (rs) => { let b = ""; rs.on("data", (c) => (b += c)); rs.on("end", () => ok({ s: rs.statusCode, b })); }));
  fdlg.isLoopback = real; srv2.close();
  check("loopback only: another device gets a 403 in words (its page downloads through the browser)",
    g.s === 403 && /computer running bitGen Studio/.test(g.b), g);

  // ---- 3. jsdom
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the page checks are skipped)"); }
  if (JSDOM) {
    const FD = require(path.join(ROOT, "lib", "fileDialog"));
    const dom = new JSDOM("<!doctype html><head></head><body></body>",
      { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1:8311/" });
    const w = dom.window;
    w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    w.HTMLElement.prototype.scrollIntoView = function () {};
    const posts = [];
    const json = (o, st) => ({ ok: !st || st < 400, status: st || 200, json: async () => o });
    let saveAnswer = null;
    w.fetch = async (url, o) => {
      const u = new URL(String(url).startsWith("http") || String(url).startsWith("blob") ? "http://x/blob" : "http://x" + url);
      const qp = (k) => u.searchParams.get(k) || "";
      if (o && o.method === "POST") posts.push({ url: String(url), body: o.body && typeof o.body === "string" ? JSON.parse(o.body) : "form" });
      if (u.pathname === "/api/fdlg/places") return json({ quick: [], drives: [], app: [], start: T, home: T, sep: path.sep });
      if (u.pathname === "/api/fdlg/list") return json(FD.list(qp("dir"), { exts: qp("exts"), foldersOnly: qp("folders") === "1" }));
      if (u.pathname === "/api/fdlg/stat") return json(FD.stat(qp("path")));
      if (u.pathname === "/api/save-as/last") return json({ dir: D1, exists: true });
      if (u.pathname === "/api/save-as") { const a1 = saveAnswer ? saveAnswer.shift() : null;
        return json(a1 || { ok: true, dir: D1, path: path.join(D1, "x.png"), note: "saved x.png to " + D1 }, a1 && a1._st); }
      if (u.pathname === "/api/save-as/upload") return json({ ok: true, dir: D1, note: "saved ref.png to " + D1 });
      if (u.pathname === "/blob") return { ok: true, blob: async () => new w.Blob(["abc"], { type: "image/png" }) };
      return json({}, 404);
    };
    w.eval(read("static", "filedialog.js"));
    w.eval(read("static", "saveas.js"));
    const F = w.FileDialog;
    F.local = true;
    const tick = (ms) => new Promise((ok) => setTimeout(ok, ms || 30));
    // the Save As mode
    let P = F.open({ mode: "save", name: "hero.png", start: D1, key: "sv" });
    let c = F.current(); await c.ready;
    const d = c.dialog, q = (s) => d.querySelector(s);
    check("Save As mode: titled Save As, the button says Save, File name starts as the file's name, the folder's files are listed",
      q(".fd-ttl").textContent === "Save As" && q(".fd-ok").textContent === "Save" && q(".fd-name").value === "hero.png"
      && q(".fd-nl").textContent === "File name:" && [...d.querySelectorAll(".fd-row .n span")].some((s) => s.textContent === "hero.png"),
      { t: q(".fd-ttl").textContent, ok: q(".fd-ok").textContent, n: q(".fd-name").value });
    await c.ok(); await tick();
    check("an existing name asks once in the footer and stays open", /hero\.png already exists\. Press Save again to replace it\./.test(q(".fd-msg").textContent) && d.isConnected);
    await c.ok();
    let res = await P;
    check("...Save again replaces it: the path with overwrite: true", res && res.path === path.join(D1, "hero.png") && res.overwrite === true, res);
    P = F.open({ mode: "save", name: "new one.png", start: D1, key: "sv" }); c = F.current(); await c.ready;
    c.dialog.querySelector(".fd-name").value = "new one.png"; await c.ok();
    res = await P;
    check("a new name: Save resolves its path at once (it need not exist), overwrite false",
      res && res.path === path.join(D1, "new one.png") && res.overwrite === false, res);
    P = F.open({ mode: "save", name: "x.png", start: T, key: "sv2" }); c = F.current(); await c.ready;
    c.dialog.querySelector(".fd-name").value = "Other"; await c.ok(); await tick();
    check("typing a folder's name goes into it and puts the file's name back", c.state.dir === D2 && c.dialog.querySelector(".fd-name").value === "x.png");
    c.dialog.querySelector(".fd-name").value = "bad?.png"; await c.ok();
    check("a reserved character is refused in words", /can't contain/.test(c.dialog.querySelector(".fd-msg").textContent));
    c.cancel(); res = await P;
    check("Cancel resolves null", res === null);
    // static/saveas.js
    const S = w.SaveAs;
    posts.length = 0;
    await S.save({ url: `/outputs/${SRC}?v=99`, name: SRC });
    check("SaveAs.save: one POST /api/save-as {url (no ?v=), name} - no dialog",
      posts.length === 1 && posts[0].url === "/api/save-as" && posts[0].body.url === `/outputs/${SRC}` && posts[0].body.name === SRC && !F.current(), posts);
    posts.length = 0;
    saveAnswer = [{ error: "no save-as location yet", need_dir: true, _st: 409 }, null];
    const pr = S.save({ url: `/outputs/${SRC}`, name: SRC });
    await tick(80);
    c = F.current();
    const asked = !!c && c.dialog.querySelector(".fd-ttl").textContent === "Save As" && c.dialog.querySelector(".fd-name").value === SRC;
    if (c) { await c.ready; c.dialog.querySelector(".fd-name").value = "first.png"; await c.ok(); }
    await pr;
    check("SaveAs.save with no folder yet asks once with Save As, then copies to the picked path",
      asked && posts.length === 2 && posts[1].body.dest === path.join(c ? c.state.dir : "", "first.png") && posts[1].body.overwrite === false, posts);
    posts.length = 0;
    await S.save({ url: "blob:http://127.0.0.1:8311/abc", name: "ref.png" });
    check("a blob: picture is uploaded (multipart) into the last folder", posts.length === 1 && posts[0].url === "/api/save-as/upload" && posts[0].body === "form", posts);
    let said = "";
    w.document.addEventListener("saveas:said", (e) => { said = e.detail.text; });
    await S.save({ url: `/outputs/${SRC}`, name: SRC });
    check("the result is said in a toast", /saved x\.png to /.test(said) && !!w.document.querySelector(".svas-toast"), said);
    F.local = false; posts.length = 0;
    let clicked = null;
    w.HTMLAnchorElement.prototype.click = function () { clicked = { href: this.getAttribute("href"), dl: this.getAttribute("download") }; };
    await S.save({ url: `/outputs/${SRC}`, name: SRC });
    check("a page that is not on this computer downloads through the browser (no server write)",
      posts.length === 0 && clicked && clicked.dl === SRC && /Downloads/.test(said), { clicked, said });
  }

  // ---- 4. the wiring
  const IX = read("static", "index.html"), RI = read("routes", "index.js");
  const bar = IX.slice(IX.indexOf('<div class="lbbar">'), IX.indexOf('<div class="lbfilm"'));
  check("the preview dialog: 💾 Save sits right next to ↗ Open externally; Shift-click = Save as; the tooltip names the folder",
    bar.indexOf('id="lb_save"') > 0 && bar.indexOf('id="lb_save"') < bar.indexOf('id="lb_open"')
    && !/<button[^>]*>[^<]*<\/button>\s*<button class="ghost" id="lb_open"/.test(bar.replace(/<button class="ghost" id="lb_save"[\s\S]*?<\/button>/, ""))
    && IX.includes("(e.shiftKey ? SaveAs.saveAs(it) : SaveAs.save(it)).then(lbSaveTip);")
    && IX.includes("`Save a copy to ${l.dir} (the last Save-as folder) - Shift-click: Save as…`"));
  // 2.362.0: icon only, minimal (no box / border), named for screen readers
  const btn = '<button class="gsave" type="button" title="Save as… - pick a folder and a name (it becomes the folder 💾 Save uses)" aria-label="Save as">💾</button>';
  check("the gallery: every tile (video, image, song) has 💾 Save as - first in the tile (top left), a song's in its name row",
    IX.includes("el.innerHTML = `" + btn + "<video") && IX.includes("el.innerHTML = `" + btn + "<img")
    && IX.includes('<div class="gmeta">' + btn + '<span class="gname"') && (IX.match(/gallerySaveAs\(el, f\);/g) || []).length === 3
    && /\.thumb \.gsave \{ position: absolute; top: 3px; left: 3px;[^}]*border: none;[^}]*background: none;/.test(IX)
    && IX.includes("if (window.SaveAs) SaveAs.saveAs({ url: `/outputs/${encodeURIComponent(f.name)}`, name: f.name });"));
  check("static/saveas.js loads after the file dialog; routes/saveAs mounted from routes/index.js (never server.js)",
    IX.indexOf('<script src="/static/saveas.js"></script>') > IX.indexOf('<script src="/static/filedialog.js"></script>')
    && RI.includes('require("./saveAs").mount(app);') && !read("server.js").includes("saveAs"));
} catch (e) {
  fail++; console.log("FAIL: the test crashed :: " + (e && e.stack || e));
} finally {
  for (const f of [path.join(outDir, SRC), path.join(imgDir, ASSET)]) try { fs.unlinkSync(f); } catch {}
  if (memoSnap) fs.writeFileSync(memo, memoSnap); else try { fs.unlinkSync(memo); } catch {}
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
})();
