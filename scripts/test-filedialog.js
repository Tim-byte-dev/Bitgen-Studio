#!/usr/bin/env node
/* bitGen Studio — 2.326.0: THE WINDOWS-11-STYLE FILE / FOLDER DIALOG.
 * Run: node scripts/test-filedialog.js
 * Tim: "please create a file select and folder select dialog that looks and
 * behaves like the windows 11 ones, but build it with nodejs and python. we
 * will replace all the folder select and file select with these dialogs".
 *   1. lib/fileDialog on a real temp tree: list / search / mkdir / rename /
 *      stat / names / loopback;
 *   2. the wiring (routes mounted from routes/index.js, loopback-only,
 *      the setting, the old pickers gone);
 *   3. static/filedialog.js in jsdom, answered by lib/fileDialog itself:
 *      the pure helpers, the dialog (address bar, pane, sort, open a
 *      folder, back, select + Open, multi, folder mode, typed paths,
 *      *.png filter, search, new folder + rename, Esc), the upload shim. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const FD = require(path.join(ROOT, "lib", "fileDialog"));

const T = fs.mkdtempSync(path.join(os.tmpdir(), "fdlg-"));
const mk = (rel, body) => { const p = path.join(T, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body || "x"); return p; };
mk("Pictures/cat.png", "png"); mk("Pictures/dog.JPG", "jpg"); mk("Pictures/notes.txt", "t");
mk("Pictures/img10.png"); mk("Pictures/img2.png"); mk("Pictures/.hidden.png");
mk("Pictures/Trips/beach.png"); mk("Pictures/Trips/deep/sunset.png"); mk("Videos/clip.mp4", "v".repeat(3000));
fs.mkdirSync(path.join(T, "Empty"));

try {
  // ---- 1. lib/fileDialog
  check("kindOf / typeLabel: Explorer's words",
    FD.kindOf("a.PNG") === "image" && FD.kindOf("a.mp4") === "video" && FD.kindOf("a.safetensors") === "model"
    && FD.kindOf("x", true) === "folder" && FD.typeLabel("a.png") === "PNG File" && FD.typeLabel("x", true) === "File folder"
    && FD.typeLabel("README") === "File");
  check("parseExts: .png,JPG, *.webp / * / empty",
    JSON.stringify(FD.parseExts(".png,JPG, *.webp")) === '[".png",".jpg",".webp"]' && !FD.parseExts("*").length && !FD.parseExts("").length);
  check("validName: Windows' rules everywhere (chars, reserved names, trailing dot / space, empty)",
    !FD.validName("Renders 2026") && FD.validName("a:b") && FD.validName("CON") && FD.validName("com1.txt")
    && FD.validName("x.") && FD.validName("x ") && FD.validName("  ") && FD.validName("a/b") && !FD.validName("con2"));
  const L = FD.list(path.join(T, "Pictures"), { exts: ".png" });
  const names = L.entries.map((e) => e.name).sort();
  check("list: folders always, files by the filter, hidden files out",
    JSON.stringify(names) === JSON.stringify(["Trips", "cat.png", "img10.png", "img2.png"]) && !L.error, names);
  const cat = L.entries.find((e) => e.name === "cat.png"), trips = L.entries.find((e) => e.name === "Trips");
  check("list: each entry carries size, mtime, kind, type; a folder has no size",
    cat.size === 3 && cat.mtime > 0 && cat.kind === "image" && cat.type === "PNG File" && trips.dir && trips.size === null && trips.type === "File folder");
  check("list: the parent, the separator and the root",
    L.parent === T && L.sep === path.sep && L.root === path.parse(T).root);
  check("list: hidden=1 shows the dot file; foldersOnly lists only folders",
    FD.list(path.join(T, "Pictures"), { hidden: true }).entries.some((e) => e.name === ".hidden.png")
    && FD.list(path.join(T, "Pictures"), { foldersOnly: true }).entries.every((e) => e.dir));
  check("list: a FILE path opens its folder; a missing path opens the nearest folder that exists",
    FD.list(path.join(T, "Pictures", "cat.png")).dir === path.join(T, "Pictures")
    && FD.list(path.join(T, "Pictures", "nope", "deeper")).dir === path.join(T, "Pictures"));
  check("resolveDir: relative = against the app folder; \"\" = the start folder",
    FD.resolveDir("models", "/app") === path.resolve("/app/models") && FD.resolveDir("", "/app") === path.resolve("/app"));
  const S1 = FD.search(T, "png", { exts: ".png" });
  check("search: under the folder and every subfolder, with each hit's folder and path",
    S1.results.length === 5 && S1.results.some((r) => r.name === "sunset.png" && r.folder === path.join(T, "Pictures", "Trips", "deep")
      && r.path === path.join(T, "Pictures", "Trips", "deep", "sunset.png")) && S1.done, S1.results.map((r) => r.name));
  check("search: * / ? patterns, folders too, the limit",
    FD.search(T, "img?.png").results.map((r) => r.name).join() === "img2.png"
    && FD.search(T, "trips").results.some((r) => r.dir) && FD.search(T, "png", { limit: 2 }).results.length === 2
    && FD.search(T, "png", { limit: 2 }).done === false && FD.search(T, "").results.length === 0);
  const n1 = FD.mkdir(path.join(T, "Empty")), n2 = FD.mkdir(path.join(T, "Empty"));
  check("mkdir: \"New folder\", then \"New folder (2)\" - never over an existing one",
    n1.ok && n1.name === "New folder" && n2.name === "New folder (2)" && fs.existsSync(path.join(T, "Empty", "New folder (2)")));
  check("mkdir: a named folder; an existing name / a bad name / a missing parent are refused in words",
    FD.mkdir(path.join(T, "Empty"), "Renders").ok && /already exists/.test(FD.mkdir(path.join(T, "Empty"), "Renders").error)
    && /cannot contain/.test(FD.mkdir(path.join(T, "Empty"), "a?b").error) && /no such folder/.test(FD.mkdir(path.join(T, "nope")).error));
  const r1 = FD.rename(path.join(T, "Empty"), "New folder", "Takes");
  check("rename: in place; refuses to replace, refuses a bad name, a gone item, a path as the item",
    r1.ok && fs.existsSync(path.join(T, "Empty", "Takes")) && /already exists/.test(FD.rename(path.join(T, "Empty"), "Takes", "Renders").error)
    && /reserved/.test(FD.rename(path.join(T, "Empty"), "Takes", "NUL").error) && /is gone/.test(FD.rename(path.join(T, "Empty"), "zzz", "q").error)
    && /which item/.test(FD.rename(path.join(T, "Empty"), "../x", "q").error));
  check("rename: a case-only rename is allowed", FD.rename(path.join(T, "Empty"), "Takes", "takes").ok);
  const st = FD.stat(path.join(T, "Videos", "clip.mp4"));
  check("stat: a typed path -> exists / folder / size", st.exists && !st.dir && st.size === 3000
    && FD.stat(path.join(T, "Videos")).dir && !FD.stat(path.join(T, "nope")).exists);
  check("isLoopback: 127.0.0.1 / ::1 / ::ffff:127.0.0.1 only",
    FD.isLoopback({ socket: { remoteAddress: "127.0.0.1" } }) && FD.isLoopback({ socket: { remoteAddress: "::1" } })
    && FD.isLoopback({ socket: { remoteAddress: "::ffff:127.0.0.1" } }) && !FD.isLoopback({ socket: { remoteAddress: "192.168.1.20" } }));
  const np = FD.nodePlaces();
  check("nodePlaces: the fallback when Python cannot answer (home, sep, quick[], drives[])",
    np.home && np.sep === path.sep && Array.isArray(np.quick) && np.drives.length >= 1 && np.from === "node");
  const ap = FD.appPlaces({ BASE: T, projDir: () => path.join(T, "Pictures"), getProject: () => "p" }, path.join(T, "Videos"));
  check("appPlaces: bitGen Studio, This project, ComfyUI (only those that exist)",
    ap.map((x) => x.id).join() === "app,project,comfy" && FD.appPlaces({ BASE: T, projDir: () => "/nope", getProject: () => "" }, "").length === 1);

  // ---- 2. wiring
  const IX = read("static", "index.html"), RI = read("routes", "index.js"), RF = read("routes", "filedialog.js");
  check("routes/index.js mounts routes/filedialog.js; server.js untouched",
    /require\("\.\/filedialog"\)\.mount\(app\)/.test(RI) && !/filedialog|fdlg/.test(read("misc/server.js")));
  check("the routes: places / list / search / stat / thumb / file / mkdir / rename, behind the loopback guard",
    ["/api/fdlg/places", "/api/fdlg/list", "/api/fdlg/search", "/api/fdlg/stat", "/api/fdlg/thumb", "/api/fdlg/file",
     "/api/fdlg/mkdir", "/api/fdlg/rename"].every((r) => RF.includes('"' + r + '"'))
    && /app\.use\("\/api\/fdlg", \(req, res, next\) => \{\s*if \(fdlg\.isLoopback\(req\)\) return next\(\);/.test(RF));
  check("the page loads static/filedialog.js; the old #fsdlg browser and the Windows-only pickers are gone",
    IX.includes('<script src="/static/filedialog.js"></script>') && !IX.includes('<dialog id="fsdlg">')
    && !IX.includes("/api/comfy/pickdir") && !IX.includes('id="s_cdirwin"') && !IX.includes("function fsLoad("));
  check("openFsPicker (every 📁 beside a path box) opens the file dialog and writes an app-relative path",
    /function openFsPicker\(inp, mode, exts, onPick\) \{[\s\S]*window\.FileDialog\.open\(\{/.test(IX)
    && IX.includes("inp.value = fsRelify(r.path, r.base, r.sep);"));
  check("Settings -> General: the built-in dialogs switch (ui.builtin_dialogs, default ON in core + default.settings)",
    IX.includes('id="s_fdlg" checked') && IX.includes("body: JSON.stringify({ ui: { builtin_dialogs: on } })")
    && IX.includes("window.FileDialog.enabled = on;") && /builtin_dialogs: true/.test(read("lib", "core.js"))
    && JSON.parse(read("misc/default.settings")).ui.builtin_dialogs === true);

  // ---- 3. the dialog in jsdom
  (async () => {
    let JSDOM;
    try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dialog checks are skipped)"); return; }
    const dom = new JSDOM("<!doctype html><head></head><body></body>",
      { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1:8311/" });
    const w = dom.window;
    w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    w.HTMLElement.prototype.scrollIntoView = function () {};
    const calls = [];
    const json = (o) => ({ ok: true, json: async () => o });
    // the page's fetch, answered by lib/fileDialog itself
    w.fetch = async (url, o) => {
      calls.push(url);
      const u = new URL("http://x" + url), qp = (k) => u.searchParams.get(k) || "";
      if (u.pathname === "/api/fdlg/places") return json({ quick: [{ id: "pictures", name: "Pictures", path: path.join(T, "Pictures") }],
        drives: [{ path: path.parse(T).root, label: "Local Disk", kind: "fixed", total: 100, free: 40 }], app: [{ id: "app", name: "bitGen Studio", path: T }],
        start: T, home: T, sep: path.sep });
      if (u.pathname === "/api/fdlg/list") return json(FD.list(qp("dir"), { exts: qp("exts"), foldersOnly: qp("folders") === "1" }));
      if (u.pathname === "/api/fdlg/search") return json(FD.search(qp("dir"), qp("q"), { exts: qp("exts") }));
      if (u.pathname === "/api/fdlg/stat") return json(FD.stat(qp("path")));
      if (u.pathname === "/api/fdlg/mkdir") { const b = JSON.parse(o.body); return json(FD.mkdir(b.dir, b.name)); }
      if (u.pathname === "/api/fdlg/rename") { const b = JSON.parse(o.body); return json(FD.rename(b.dir, b.from, b.to)); }
      if (u.pathname === "/api/fdlg/file") {
        const p = qp("path"), buf = fs.readFileSync(p);
        return { ok: true, headers: { get: (h) => (h === "X-File-Mtime" ? "1700000000000" : null) },
                 blob: async () => new w.Blob([buf], { type: p.endsWith(".png") ? "image/png" : "" }) };
      }
      return { ok: false, json: async () => ({}) };
    };
    w.eval(read("static", "filedialog.js"));
    const F = w.FileDialog;
    const tick = (ms) => new Promise((r) => setTimeout(r, ms || 20));

    // pure helpers
    const pa = F.parseAccept("image/*");
    check("parseAccept: image/* -> Image files (+ All files last)", pa[0].label === "Image files" && pa[0].exts.includes(".webp") && pa[pa.length - 1].label === "All files");
    const pb = F.parseAccept("image/png,image/jpeg,image/webp");
    check("parseAccept: mime types -> their extensions", pb[0].label === "Image files" && JSON.stringify(pb[0].exts) === '[".png",".jpg",".jpeg",".webp"]');
    const pc = F.parseAccept("image/*,video/*");
    check("parseAccept: mixed -> Supported files, then one per family, then All files",
      pc[0].label === "Supported files" && pc[1].label === "Image files" && pc[2].label === "Video files" && pc[3].label === "All files");
    check("parseAccept: .json / nothing", F.parseAccept(".json")[0].exts.join() === ".json" && F.parseAccept("")[0].label === "All files");
    check("filterLabel: Windows' (*.png;*.jpg) and (*.*)", F.filterLabel({ label: "Image files", exts: [".png", ".jpg"] }) === "Image files (*.png;*.jpg)"
      && F.filterLabel({ label: "All files", exts: [] }) === "All files (*.*)");
    const cw = F.crumbs("C:\\Users\\Tim\\Videos", "\\"), cp = F.crumbs("/home/tim/Videos", "/");
    check("crumbs: C: › Users › Tim › Videos and / › home › tim › Videos, each with its own path",
      cw.map((c) => c.name).join("|") === "C:|Users|Tim|Videos" && cw[0].path === "C:\\" && cw[2].path === "C:\\Users\\Tim"
      && cp.map((c) => c.name).join("|") === "/|home|tim|Videos" && cp[3].path === "/home/tim/Videos");
    const so = F.sortEntries([{ name: "img10.png" }, { name: "B", dir: true }, { name: "img2.png" }, { name: "a", dir: true }], "name");
    check("sortEntries: folders first, natural order (img2 before img10); desc flips within the groups",
      so.map((e) => e.name).join() === "a,B,img2.png,img10.png"
      && F.sortEntries([{ name: "a", size: 5 }, { name: "b", size: 9 }, { name: "D", dir: true }], "size", true).map((e) => e.name).join() === "D,b,a");
    check("fmtSize: Explorer's whole KB, grouped", F.fmtSize(3) === "1 KB" && F.fmtSize(1536000) === "1,500 KB" && F.fmtSize(0) === "0 KB" && F.fmtSize(null) === "");
    check("parseNames / quoteNames round-trip", JSON.stringify(F.parseNames('"a b.png" "c.png"')) === '["a b.png","c.png"]'
      && F.quoteNames(["a.png", "b.png"]) === '"a.png" "b.png"' && F.quoteNames(["a.png"]) === "a.png" && F.parseNames("x.png")[0] === "x.png");
    check("isLocalPage: 127.0.0.1 / localhost yes, a LAN address no",
      F.isLocalPage({ hostname: "127.0.0.1" }) && F.isLocalPage({ hostname: "localhost" }) && !F.isLocalPage({ hostname: "192.168.1.9", protocol: "http:" }));

    // the dialog
    let P = F.open({ mode: "file", filters: F.parseAccept("image/*"), start: path.join(T, "Pictures"), key: "t" });
    let c = F.current();
    await c.ready;
    const d = c.dialog, $ = (s) => d.querySelector(s);
    check("open: the Windows 11 parts - title, ← → ↑ ↻, address bar, search, New folder, Rename, views, pane, list, File name, filter, Open / Cancel",
      $(".fd-ttl").textContent === "Open" && $(".fd-back") && $(".fd-fwd") && $(".fd-up") && $(".fd-ref") && $(".fd-crumbs")
      && $(".fd-search input").placeholder === "Search Pictures" && $(".fd-new") && $(".fd-rename") && $(".fd-vdet") && $(".fd-vico")
      && $(".fd-side") && $(".fd-main") && $(".fd-name") && $(".fd-filter").options[0].textContent.startsWith("Image files (*.png")
      && $(".fd-ok").textContent === "Open" && $(".fd-cancel"));
    check("the navigation pane: Quick access, bitGen Studio, This PC with a space bar; the current place highlighted",
      /Quick access[\s\S]*Pictures[\s\S]*bitGen Studio[\s\S]*This PC[\s\S]*Local Disk/.test($(".fd-side").textContent)
      && $(".fd-bar i").style.width === "60%" && $(".fd-si.cur").dataset.path === path.join(T, "Pictures"));
    check("the address bar: one button per folder", $(".fd-crumbs").querySelectorAll(".fd-crumb").length === F.crumbs(path.join(T, "Pictures"), path.sep).length
      && [...$(".fd-crumbs").querySelectorAll(".fd-crumb")].pop().textContent === "Pictures");
    const rowNames = () => [...d.querySelectorAll(".fd-row .n span")].map((s) => s.textContent);
    check("details: folders first, then the filtered files in natural order, Type and Size columns",
      rowNames().join() === "Trips,cat.png,dog.JPG,img2.png,img10.png" && /PNG File/.test($(".fd-list").textContent)
      && /1 KB/.test($(".fd-list").textContent) && /5 items/.test($(".fd-count").textContent), rowNames());
    $('[data-sort="name"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    check("a column header sorts (Name ▼ keeps folders first)", rowNames().join() === "Trips,img10.png,img2.png,dog.JPG,cat.png", rowNames());
    $('[data-sort="name"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    const rowOf = (n) => [...d.querySelectorAll(".fd-row")].find((r) => r.querySelector(".n span").textContent === n);
    rowOf("Trips").dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true }));
    await tick(40);
    check("double-click a folder: it opens, the address bar and search follow, Back lights up",
      c.state.dir === path.join(T, "Pictures", "Trips") && rowNames().join() === "deep,beach.png"
      && $(".fd-search input").placeholder === "Search Trips" && !$(".fd-back").disabled);
    $(".fd-back").click(); await tick(40);
    check("Back returns; Forward lights up", c.state.dir === path.join(T, "Pictures") && !$(".fd-fwd").disabled);
    rowOf("cat.png").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, button: 0 }));
    check("a click selects and fills File name", $(".fd-name").value === "cat.png" && rowOf("cat.png").classList.contains("sel"));
    rowOf("dog.JPG").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, button: 0, ctrlKey: true }));
    check("single-select here: Ctrl-click does not add a second file", $(".fd-name").value === "dog.JPG");
    $(".fd-ok").click();
    let r = await P;
    check("Open resolves the chosen file (+ the folder, the app folder and the separator for the caller)",
      r && r.path === path.join(T, "Pictures", "dog.JPG") && r.paths.length === 1 && r.base === T && r.sep === path.sep && !d.isConnected);

    // multi
    P = F.open({ mode: "file", multi: true, start: path.join(T, "Pictures"), key: "m" }); c = F.current(); await c.ready;
    const D2 = c.dialog, row2 = (n) => [...D2.querySelectorAll(".fd-row")].find((x) => x.querySelector(".n span").textContent === n);
    row2("cat.png").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, button: 0 }));
    row2("img10.png").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, button: 0, shiftKey: true }));
    row2("dog.JPG").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, button: 0, ctrlKey: true }));
    check("multi: Shift-click takes the range, Ctrl-click toggles one out; File name lists them quoted",
      D2.querySelector(".fd-name").value === '"cat.png" "img2.png" "img10.png"' && /3 selected/.test(D2.querySelector(".fd-count").textContent),
      D2.querySelector(".fd-name").value);
    D2.querySelector(".fd-ok").click();
    r = await P;
    check("multi: Open resolves every file", r && r.paths.length === 3 && r.paths[2] === path.join(T, "Pictures", "img10.png"));

    // typed names / paths / *.png
    P = F.open({ mode: "file", start: path.join(T, "Pictures"), key: "ty" }); c = F.current(); await c.ready;
    const D3 = c.dialog;
    D3.querySelector(".fd-name").value = "Trips"; await c.ok(); await tick(30);
    check("typing a folder's name + Open goes into it (Windows behaviour)", c.state.dir === path.join(T, "Pictures", "Trips") && D3.querySelector(".fd-name").value === "");
    D3.querySelector(".fd-name").value = "*.txt"; await c.ok(); await tick(30);
    check("typing *.txt becomes the file-type filter", D3.querySelector(".fd-filter").options[0].textContent.startsWith("*.txt") && c.state.fi === 0);
    D3.querySelector(".fd-name").value = "missing.png"; await c.ok();
    check("a name that is not there is said, the dialog stays open", /File not found: missing\.png/.test(D3.querySelector(".fd-msg").textContent) && D3.isConnected);
    D3.querySelector(".fd-name").value = path.join(T, "Videos", "clip.mp4"); await c.ok();
    r = await P;
    check("a typed full path opens that file", r && r.path === path.join(T, "Videos", "clip.mp4"));

    // folder mode
    P = F.open({ mode: "dir", start: path.join(T, "Pictures"), key: "d" }); c = F.current(); await c.ready;
    const D4 = c.dialog;
    check("folder mode: Select Folder, Folder:, folders only, no file-type filter",
      D4.querySelector(".fd-ok").textContent === "Select Folder" && D4.querySelector(".fd-nl").textContent === "Folder:"
      && [...D4.querySelectorAll(".fd-row .n span")].map((s) => s.textContent).join() === "Trips"
      && D4.querySelector(".fd-filter").style.display === "none" && calls.some((u) => /folders=1/.test(u)));
    D4.querySelector(".fd-ok").click();
    r = await P;
    check("folder mode: nothing selected = the folder shown", r && r.path === path.join(T, "Pictures"));
    P = F.open({ mode: "dir", start: path.join(T, "Pictures"), key: "d" }); c = F.current(); await c.ready;
    c.dialog.querySelector(".fd-row").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, button: 0 }));
    c.dialog.querySelector(".fd-ok").click();
    r = await P;
    check("folder mode: a selected folder is the answer", r && r.path === path.join(T, "Pictures", "Trips"));

    // search, new folder + rename, Esc
    P = F.open({ mode: "file", start: T, key: "s" }); c = F.current(); await c.ready;
    const D5 = c.dialog;
    D5.querySelector(".fd-search input").value = "sunset"; c.runSearch(); await tick(40);
    check("search: results from the subfolders, the Folder column shows where",
      [...D5.querySelectorAll(".fd-row .n span")].map((s) => s.textContent).join() === "sunset.png"
      && D5.querySelector(".fd-hdr").textContent.includes("Folder") && D5.querySelector(".fd-list").textContent.includes(path.join("Trips", "deep")));
    D5.querySelector(".fd-search input").value = ""; c.runSearch();
    await c.go(path.join(T, "Empty"));
    c.newFolder(); await tick(60);
    const ren = D5.querySelector(".fd-ren");
    check("New folder: made on disk, selected, its name open for typing", !!ren && /^New folder/.test(ren.value) && fs.existsSync(path.join(T, "Empty", ren.value)));
    ren.value = "Final cut"; ren.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await tick(60);
    check("rename: Enter renames on disk and the list follows", fs.existsSync(path.join(T, "Empty", "Final cut"))
      && [...D5.querySelectorAll(".fd-row .n span")].some((s) => s.textContent === "Final cut"));
    D5.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    r = await P;
    check("Esc cancels: null, the dialog is gone", r === null && !D5.isConnected);

    // the upload shim
    Object.defineProperty(w.HTMLInputElement.prototype, "files", { configurable: true,
      get() { return this._files || []; }, set(v) { this._files = v; } });
    w.DataTransfer = class { constructor() { const a = []; this.items = { add: (f) => a.push(f) }; this.files = a; } };
    const inp = w.document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.id = "up1";
    w.document.body.appendChild(inp);
    let changed = 0; inp.addEventListener("change", () => changed++);
    F.enabled = true;
    inp.click();                                         // code calling .click() - the patched prototype
    c = F.current();
    check("the shim: <input type=file>.click() opens OUR dialog, with the input's accept as the filter and its multiple",
      !!c && c.state.multi === true && c.dialog.querySelector(".fd-filter").options[0].textContent.startsWith("Image files"));
    await c.ready; await c.go(path.join(T, "Pictures"));
    const rw = (n) => [...c.dialog.querySelectorAll(".fd-row")].find((x) => x.querySelector(".n span").textContent === n);
    rw("cat.png").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, button: 0 }));
    rw("img2.png").dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, button: 0, ctrlKey: true }));
    c.dialog.querySelector(".fd-ok").click();
    for (let i = 0; i < 40 && !changed; i++) await tick(20);
    check("the shim: the picked files are READ from disk into input.files and change fires - the upload code runs untouched",
      changed === 1 && inp.files.length === 2 && inp.files[0].name === "cat.png" && inp.files[0].size === 3
      && inp.files[0].type === "image/png" && calls.filter((u) => u.startsWith("/api/fdlg/file")).length === 2);
    const nat = w.document.createElement("input"); nat.type = "file"; nat.setAttribute("data-native-picker", "");
    w.document.body.appendChild(nat); nat.click();
    check("data-native-picker opts an input out (the browser's own picker)", !F.current());
    F.enabled = false; inp.click();
    check("Settings off: the browser's own picker again", !F.current());
    F.enabled = true; F.local = false; inp.click();
    check("a page NOT on this machine (phone, LAN) keeps the browser's picker", !F.current());
    F.local = true;
    const vis = w.document.createElement("input"); vis.type = "file"; w.document.body.appendChild(vis);
    const ev = new w.MouseEvent("click", { bubbles: true, cancelable: true });
    vis.dispatchEvent(ev);
    check("a click ON a visible Choose File input (or its label) is caught too - the browser's dialog never opens",
      ev.defaultPrevented && !!F.current());
    F.current().cancel();
  })().then(() => {
    fs.rmSync(T, { recursive: true, force: true });
    console.log(`RESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }).catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); fs.rmSync(T, { recursive: true, force: true }); process.exit(1); });
} catch (e) { console.log("FAIL: crashed " + e.stack); process.exit(1); }
