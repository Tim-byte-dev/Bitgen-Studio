#!/usr/bin/env node
/* bitGen Studio — 2.993.0 in a REAL browser: ⤓ Import Daz content (the Sketcher's DAZ Library docker). Tim: "add an import button
 * next to my library, open a dialog, ... create new library folder, create a library structure in the selected folder, ... allow
 * user to select folders, look through all the folders for zip files, extract them to the right location."
 * Our own made-up product zips (no Daz content); the app's folder picker answers with the test's folders; the library folders
 * list is put back after. Against the running app on THIS machine (H3_URL). */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const walk = (d, top) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), top || d) : [path.relative(top || d, path.join(d, e.name)).split(path.sep).join("/")]) : [];
(async () => {
  if (!chromium) { console.log("FAIL: playwright is not installed here"); console.log("\nRESULT: 0 passed, 1 failed"); process.exit(1); }
  const JSZip = require(path.join(__dirname, "..", "node_modules", "jszip"));
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "ui993dz-")), src = path.join(T, "Downloads"), parent = path.join(T, "Libraries"), other = path.join(T, "Old library");
  fs.mkdirSync(path.join(src, "2026", "november"), { recursive: true }); fs.mkdirSync(parent); fs.mkdirSync(other);
  const mk = async (f, files) => { const z = new JSZip(); for (const [n, c] of Object.entries(files)) z.file(n, c); fs.writeFileSync(f, await z.generateAsync({ type: "nodebuffer" })); };
  await mk(path.join(src, "plain hair.zip"), { "data/UI993/Hair/bob.dsf": "d", "People/Genesis 9/Hair/UI993 Bob.duf": "h", "readme.txt": "r" });
  await mk(path.join(src, "2026", "november", "IM00099301-01_DimProp.zip"), { "Manifest.dsx": "m", "Supplement.dsx": "s", "Content/runtime/Textures/UI993/t.jpg": "t", "Content/Props/UI993/crate.duf": "p" });
  const iz = new JSZip(); iz.file("My Library/Environments/UI993 Park/park.duf", "e");
  await mk(path.join(src, "2026", "wrapped set.zip"), { "UI993 Set/Content/Light Presets/UI993/sun.duf": "l", "Part2.zip": await iz.generateAsync({ type: "nodebuffer" }) });
  fs.writeFileSync(path.join(src, "broken.zip"), "not a zip");
  fs.writeFileSync(path.join(src, "notes.txt"), "not a zip at all");
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1800, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let roots0 = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools && window.H3DazImport, null, { timeout: 60000 });
    roots0 = (await ev(() => fetch("/api/dazlib").then((r) => r.json()))).roots;
    await ev(() => { if (!document.getElementById("pushpulldock").classList.contains("dz-on")) H3DazTools.toggle(); });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });   // as test-ui983 (the queue dock floats over the docker here)
    await p.waitForFunction(() => document.getElementById("dzImport") && document.getElementById("dzImport").offsetParent, null, { timeout: 30000 });
    const head = await ev(() => { const h = document.getElementById("dzLibHead"), ids = [...h.querySelectorAll("button")].map((x) => x.id); return { ids, title: h.querySelector("b").textContent }; });
    check("the DAZ Library docker's title: ⤓ Import right beside 📁 (my library folders)", head.ids.indexOf("dzImport") === head.ids.indexOf("dzFolders") + 1, head);
    // the app's folder picker answers with our folders, in turn
    await ev(() => { window.__picks = []; window.FileDialog = Object.assign({}, window.FileDialog, { open: (o) => { const v = window.__picks.shift(); window.__asked = (window.__asked || []).concat([o.title]); return Promise.resolve(v ? { path: v } : null); } }); });
    await p.click("#dzImport");
    await p.waitForFunction(() => document.getElementById("dziDlg") && document.getElementById("dziDlg").open, null, { timeout: 5000 });
    const note = await p.textContent(".dzi-note");
    check("⤓ opens the Import dialog: 1 the library, 2 where the zips are, 3 Import - and says it is not a replacement for Daz Studio", /Not a replacement for Daz Studio/.test(note) && /light tasks/.test(note) && await p.locator("#dziLib").isVisible() && await p.locator("#dziAdd").isVisible() && await p.locator("#dziGo").isVisible() && await p.locator("#dziGo").isDisabled(), note);

    // ---- ＋ New library folder
    await p.click("#dziNew"); await ev((x) => { window.__picks.push(x); }, parent); await p.click("#dziParentPick");
    check("＋ New library folder…: the folder it goes in from the app's folder picker", (await p.inputValue("#dziParent")) === parent);
    await p.fill("#dziName", "UI993 Library"); await p.click("#dziNewGo");
    const lib = path.join(parent, "UI993 Library");
    await p.waitForFunction((l) => document.getElementById("dziLib").value === l, lib, { timeout: 5000 });
    const made = walk(lib), dirs = fs.readdirSync(lib).sort();
    check("…made with the Daz library layout (data, People, Props, Runtime/Textures …) and picked as the library", ["data", "People", "Props", "Runtime", "Environments", "Light Presets", "Scripts"].every((d) => dirs.indexOf(d) >= 0) && fs.existsSync(path.join(lib, "Runtime", "Textures")) && !made.length, dirs);
    const roots1 = (await ev(() => fetch("/api/dazlib").then((r) => r.json()))).roots;
    check("…and added to my library folders (the docker reads it)", roots1.indexOf(lib) >= 0, roots1);
    check("…the new-folder row closes after Create", !(await p.locator("#dziNewBox").isVisible()));

    // ---- ▦ the layout in a folder that is there
    await ev((x) => { window.__picks.push(x); }, other); await p.click("#dziPick"); await ev(() => { document.getElementById("dziAddRoot").checked = false; });
    await p.click("#dziMake"); await p.waitForFunction(() => /made|were all there/.test(document.getElementById("dziMsg").textContent), null, { timeout: 5000 });
    check("▦ Make the library folders here: the layout made in a folder picked with 📂 (nothing removed)", fs.existsSync(path.join(other, "People")) && fs.existsSync(path.join(other, "Runtime", "Support")) && /made/.test(await p.textContent("#dziMsg")));
    await p.selectOption("#dziLib", lib);

    // ---- the zips
    await ev((x) => { window.__picks.push(x); }, src); await p.click("#dziAdd");
    check("＋ Add a folder…: listed (a ✕ to take it off)", (await ev(() => H3DazImport.info().src)).join() === src && await p.locator("#dziSrc [data-del]").count() === 1);
    await p.click("#dziScan"); await p.waitForFunction(() => /zips? found/.test(document.getElementById("dziMsg").textContent), null, { timeout: 15000 });
    const rows = await ev(() => [...document.querySelectorAll("#dziList label")].map((l) => ({ t: l.querySelector("span").textContent.split(/[\\/]/).pop(), k: l.querySelector("small").textContent, on: l.querySelector("input").checked, off: l.querySelector("input").disabled })));
    const row = (n) => rows.find((r) => r.t === n) || {};
    check("🔍 Find the zips: every .zip in the folder AND its subfolders (4), nothing else", rows.length === 4 && !rows.some((r) => /notes/.test(r.t)), rows);
    check("…what each holds: a DIM package, Daz content, zips inside; a broken one can't be read and is not ticked",
      /DIM package/.test(row("IM00099301-01_DimProp.zip").k) && /Daz content/.test(row("plain hair.zip").k) && /Daz content|zips inside/.test(row("wrapped set.zip").k) && /can't read/.test(row("broken.zip").k) && row("broken.zip").off && !row("broken.zip").on && row("plain hair.zip").on, rows);
    check("⤓ Import is on once a library and zips are picked", await p.locator("#dziGo").isEnabled());
    await p.click("#dziGo"); await p.waitForFunction(() => /done/.test(document.getElementById("dziMsg").textContent), null, { timeout: 30000 });
    const got = walk(lib).sort();
    check("⤓ Import: each zip unpacked to the right place (its own top folders; a DIM package's Content/ dropped; wrappers dropped; a zip inside opened)",
      ["data/UI993/Hair/bob.dsf", "People/Genesis 9/Hair/UI993 Bob.duf", "Runtime/Textures/UI993/t.jpg", "Props/UI993/crate.duf", "Light Presets/UI993/sun.duf", "Environments/UI993 Park/park.duf"].every((f) => got.indexOf(f) >= 0), got);
    check("…nothing else: no readme / DIM notes at the library's root, no Content/ folder", !got.some((f) => /readme|Manifest|Supplement|^Content\//i.test(f)) && got.length === 6, got);
    const log = await p.textContent("#dziLog");
    check("…the log says each zip's files; the message the total + that the library is read again", /plain hair\.zip - 2 files/.test(log) && /wrapped set\.zip - 2 files, 1 zip\(s\) inside/.test(log) && /6 files into/.test(await p.textContent("#dziMsg")), log);
    fs.writeFileSync(path.join(lib, "People", "Genesis 9", "Hair", "UI993 Bob.duf"), "mine");
    await p.click("#dziGo"); await p.waitForFunction(() => /done/.test(document.getElementById("dziMsg").textContent) && /kept/.test(document.getElementById("dziMsg").textContent), null, { timeout: 30000 });
    check("again: files that are there are kept (not replaced) unless ☑ replace", fs.readFileSync(path.join(lib, "People", "Genesis 9", "Hair", "UI993 Bob.duf"), "utf8") === "mine" && /6 were there \(kept\)/.test(await p.textContent("#dziMsg")), await p.textContent("#dziMsg"));
    await p.check("#dziOver"); await p.click("#dziGo"); await p.waitForFunction(() => /done - 6 files/.test(document.getElementById("dziMsg").textContent), null, { timeout: 30000 });
    check("☑ replace files that are there: written again", fs.readFileSync(path.join(lib, "People", "Genesis 9", "Hair", "UI993 Bob.duf"), "utf8") === "h");
    if (process.env.SHOT) await p.locator("#dziDlg").screenshot({ path: process.env.SHOT });
    await p.keyboard.press("Escape");
    check("Esc closes it", !(await ev(() => H3DazImport.info().open)));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  finally {
    try { await ev(() => { try { H3PushPullFrame.toggleMaxed(false); localStorage.removeItem("h3.dockmax.off"); } catch (e) { /* fine */ } }); await p.waitForTimeout(900); } catch (e) { /* gone */ }
    try { if (roots0) await ev((r) => fetch("/api/dazlib/roots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roots: r }) }), roots0); } catch (e) { /* gone */ }
    await b.close();
    try { fs.rmSync(T, { recursive: true, force: true }); } catch (e) { /* fine */ }
  }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
