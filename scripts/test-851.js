#!/usr/bin/env node
/* bitGen Studio — 2.851.0 units (Tim: "the properties tab has dissappeared, the comments panel won't close. remove the blender
 * tab, make the blender button a dropdown with new scene, open, save, import and up to 5 recent files. open and new scene will
 * start blender. remove the ai tab, inpaint and outpaint are in the prompt docker edit mode. fix the calendar settings dialog,
 * allow user to align the table when user selects the table"): the 🟧 ▾ menu (pure), lib/blendNew.js (the empty scene's plan,
 * its file name, Blender asked to build it), the tabs gone, Properties in WP View, the Properties foot (Blender + Zones), the
 * comments list's ✕, the calendar dialog's own layout, the picked table's alignment. The browser: test-ui851-ui.js. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  /* ---- the 🟧 ▾ menu */
  const B = require(path.join(ROOT, "ext/imageeditdock/pcblendlayer.js"));
  check("recent files: the one opened first, no doubles, 5 at most", B.recentWith(["a", "b", "c", "d", "e"], "c").join() === "c,a,b,d,e" && B.recentWith(["a", "b", "c", "d", "e"], "f").join() === "f,a,b,c,d" && B.recentWith([], "x").join() === "x");
  const m0 = B.menuItems({ open: false, has: false, layer: "", recent: [] }), m1 = B.menuItems({ open: true, has: true, recent: ["/a/room.blend", "C:\\s\\b.blend", "3", "4", "5", "6"] }), m2 = B.menuItems({ layer: "🟧 room" });
  check("the menu: New scene, Open, Save, Import (Save + Import off with no scene open); nothing more with no scene / layer / recent", m0.map((x) => x.k).join() === "new,open,save,import" && m0[2].off && m0[3].off && !m0[0].off, m0);
  check("...a scene open: Save + Import on, the recent files by name (5 at most, numbered), ✕ Close the scene tools", !m1[2].off && !m1[3].off && m1.filter((x) => x.k === "recent").map((x) => x.label).join("|") === "1  room.blend|2  b.blend|3  3|4  4|5  5" && m1[m1.length - 1].k === "close", m1);
  check("...a Blender layer picked (tools closed): 🟧 Scene tools - its name", m2[m2.length - 1].k === "tools" && /🟧 room/.test(m2[m2.length - 1].label), m2);
  const bl = src("ext/imageeditdock/pcblendlayer.js");
  check("the 🟧 button opens the menu; New / Open / a recent file start the scene tools with that file (a new Blender layer), remembered; a file not there leaves the list; File ▸ New / Open Blender Scene",
    /b\.onclick = \(\) => menu\(b\)/.test(bl) && /return start\(\{ path: p \}\)/.test(bl) && /target = o\.path \? null : cur\(\)/.test(bl) && /tb\.open\(o\.path\)\.then\(\(s2\) => \{ remember\(o\.path\)/.test(bl)
    && /forget\(o\.path\)/.test(bl) && /post\("\/api\/blendview\/new", \{ name \}\)/.test(bl) && /addCmd\("file\.blendnew"/.test(bl) && /addCmd\("file\.blendopen"/.test(bl) && /tb\.addModel\(n\)/.test(bl) && /tb\.save\(\)/.test(bl));
  check("no 🟧 Blender tab - its settings at the foot of Properties while a Blender layer is picked or the tools are open", !/dataset\.tab = "kbl"/.test(bl) && /E\.ui\.propsFoot\(body, \(\) => open \|\| !!cur\(\)\)/.test(bl) && /showTab\("pcProps"\)/.test(bl));
  /* ---- a new scene */
  const N = require(path.join(ROOT, "lib/blendNew.js")), pl = N.plan({ name: "My room" });
  check("the empty scene's plan: 5 s at 24 fps, 1280 x 720, a ground, the sun, a camera looking at the middle, no objects", pl.fps === 24 && pl.seconds === 5 && pl.width === 1280 && pl.height === 720 && pl.ground && pl.sun && pl.objects.length === 0 && pl.camera.keys.length === 1 && pl.title === "My room");
  check("its file name: safe, .blend", N.fileName("My room!") === "My_room.blend" && N.fileName("") === "scene.blend" && N.fileName("a.blend") === "a.blend" && N.fileName("../x/y").endsWith(".blend") && !/[\\/]/.test(N.fileName("../x/y")));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t851-")), ran = [];
  N.setBlendView({ dir: () => tmp, run: async (args) => { ran.push(args); fs.writeFileSync(args[2], "BLENDER-v300"); return { code: 0, error: null }; } });
  const a = await N.create({ name: "Room" }), b2 = await N.create({ name: "Room" });
  N.setBlendView({ dir: () => tmp, run: async () => ({ code: 1, error: "Blender was not found" }) });
  let err = ""; try { await N.create({ name: "Bad" }); } catch (e) { err = e.message; }
  check("create: Blender builds it into blender/scenes/<name>.blend (\"build\", the plan, the file), a name in use gets (2); the plan file removed; a failure said",
    a.path === path.join(tmp, "scenes", "Room.blend") && b2.name === "Room (2).blend" && ran[0][0] === "build" && /Room\.plan\.json$/.test(ran[0][1]) && !fs.readdirSync(path.join(tmp, "scenes")).some((f) => /plan\.json$/.test(f)) && /could not make the scene: Blender was not found/.test(err), { a, b2, ran, err });
  fs.rmSync(tmp, { recursive: true, force: true });
  check("POST /api/blendview/new in routes/blendView.js (not server.js)", /app\.post\("\/api\/blendview\/new"/.test(src("routes/blendView.js")) && /require\("\.\.\/lib\/blendNew"\)\.create/.test(src("routes/blendView.js")) && !/blendview\/new/.test(src("misc/server.js")));
  /* ---- the tabs */
  const ie = src("ext/imageeditdock/imageedit.js"), ui = src("ext/imageeditdock/pcui.js");
  check("no ✨ AI tab (its pane stays, never shown); asking for it changes nothing; Window lists no ✨ AI", !/tab\("props", "kxAi"/.test(ie) && /data-body="kxAi" id="kxAi"/.test(ie) && /if \(id === "kxAi"\) return;/.test(ui) && !/\["kxAi", "✨ AI"\]/.test(ui) && /if \(id === "kbl"\) id = "pcProps";/.test(ui));
  check("the Properties foot: parts kept at the end of Properties, put back after each repaint, each shown by its when()", /E\.ui\.propsFoot = \(node, when\)/.test(ui) && /placeExtras\(\);\n    \}\n    E\.ui\.props = props;/.test(ui) && /propsFor = null; placeExtras\(\); return;/.test(ui));
  check("the 🔲 Zones box at the foot of Properties (the Zones tool in hand / boxes there); Window ▸ ⏳ Pending", /E\.ui\.propsFoot\(box, \(\) => !!S\.w && \(S\.tool === "zones" \|\| zones\(\)\.length > 0\)\)/.test(src("ext/imageeditdock/pczones.js")) && /addCmd\("win\.pending", "⏳ Pending"/.test(src("ext/imageeditdock/pcpending.js")));
  const V = require(path.join(ROOT, "ext/imageeditdock/pcviews.js")), wp = (V.VIEWS || []).find((v) => v.id === "wp");
  check("WP View shows Properties (Tim: \"the properties tab has dissappeared\")", wp && wp.groups.props === true && wp.tabs.includes("pcProps"), wp && wp.groups);
  /* ---- the comments list's ✕ */
  const dn = src("ext/imageeditdock/pcdocnotes.js");
  check("💬 the comments list's ✕ closes it (read before the comment row it is not in)", /if \(a === "close"\) \{ closePanel\(\); return; \}/.test(dn) && /const row = b\.closest\("\.pdcItem"\), id = row \? row\.dataset\.cid : ""/.test(dn));
  /* ---- the calendar dialog */
  const cal = src("ext/imageeditdock/pccalendar.js");
  check("📅 Calendar Settings: its own size (780 px) and rows that flow (not the dialogs' two-column grid), panes scroll", /d\.classList\.add\("pccalDlg"\)/.test(cal) && /\.kxdlg\.pccalDlg\{width:780px/.test(cal) && /\.pccal \.rw\{display:flex!important/.test(cal) && /const html = `<div class="pccal">/.test(cal) && /\.pccal \[data-cpane\]\{max-height:62vh;overflow:auto/.test(cal));
  /* ---- the table aligned */
  const tb = src("ext/imageeditdock/pcdoctable.js");
  check("▦ a picked table: ⯇ ↔ ⯈ on its box, Ctrl+L / E / R, the align buttons (ribbon + bar through E.docText.exec) align it; a full-width table made narrower first; the ribbon keeps it picked",
    /data-al="left"/.test(tb) && /data-al="center"/.test(tb) && /data-al="right"/.test(tb) && /function alignSel\(a\)/.test(tb) && /if \(ts\.w >= 100 && al !== "left"\) ts\.w = 80;/.test(tb)
    && /const AL = \{ l: "left", e: "center", r: "right" \}/.test(tb) && /E\.docText\.exec = function \(cmd\) \{ if \(tsel && tsel\.isConnected && JUST\[cmd\]\) return alignSel\(JUST\[cmd\]\)/.test(tb)
    && /\(E\.docText && E\.docText\.exec \? E\.docText\.exec : exec\)\(id\)/.test(src("ext/imageeditdock/pcdoctext.js")) && /\(E\.stage && E\.stage\.contains\(e\.target\)\)/.test(tb));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
