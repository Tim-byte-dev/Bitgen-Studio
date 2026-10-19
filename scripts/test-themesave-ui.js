#!/usr/bin/env node
/* bitGen Studio — 2.435.0 in a REAL browser: SAVED THEMES (Settings ▸ Themes ▸ Customize / 💾 Save theme / load /
 * delete / Import - themes/<name>.json; static/themes.js + routes/themes.js + lib/themeStore.js) and the PDF Save
 * dialog's EMBED FONTS (ext/imageeditdock/pcpdf.js + static/vendor/fontkit + routes/fonts.js + lib/fontFiles.js).
 * Tim: "allow user to save/load themes (save themes to themes\theme name.json) . Give user option to embed fonts into
 * pdf in the save dialog". Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the saved themes / PDF fonts browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const NAME = "zz test theme " + process.pid, OUT = "zz_pdffonts_" + process.pid;

(async () => {
  const PL = require(path.join(ROOT, "static", "vendor", "pdf-lib.min.js"));
  const doc = await PL.PDFDocument.create();
  const hv = await doc.embedFont(PL.StandardFonts.Helvetica);
  const p1 = doc.addPage([612, 792]);
  p1.drawText("Hello there", { x: 72, y: 700, size: 24, font: hv, color: PL.rgb(0, 0, 0) });
  p1.drawText("Second line", { x: 72, y: 650, size: 18, font: hv, color: PL.rgb(0, 0, 0) });
  const pdfBytes = Buffer.from(await doc.save());
  const fonts = await api("/api/fonts");
  const FAMILY = ["DejaVu Sans", "Arial", "Liberation Sans", "Segoe UI", "Helvetica", "FreeSans"].find((f) => (fonts.families || []).includes(f)) || (fonts.families || [])[0];

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await api("/api/themes/delete", { name: NAME }); } catch { /* none */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { for (const k of ["h3.theme", "h3.accent", "h3.scale", "h3.themeVars", "h3.themeName"]) localStorage.removeItem(k); } catch (e) { /* fine */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Theme && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.pdf, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const css = (v) => ev((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), v);

    /* 1 Customize */
    await ev(() => { document.getElementById("settings").showModal(); document.querySelector('#settings [data-stab="themes"]').click(); });
    await p.waitForTimeout(250);
    const cu = await ev(() => [...document.querySelectorAll("#s_thcustom input[data-tv]")].map((x) => x.dataset.tv));
    check("Settings ▸ Themes ▸ Customize: a colour for each part (background, panels, lines, text, dim, ok, error, hover, canvas, selected)", cu.length === 11 && cu.includes("ink") && cu.includes("panel") && !cu.includes("tiger"), cu);
    await p.fill('#s_thcustom input[data-tv="panel"]', "#203040"); await p.dispatchEvent('#s_thcustom input[data-tv="panel"]', "input");
    await p.fill("#s_accent", "#22aa66"); await p.dispatchEvent("#s_accent", "input");
    const c1 = { panel: await css("--panel"), th: await css("--th-panel"), tiger: await css("--tiger"), lit: await ev(() => document.querySelector('#s_thcustom input[data-tv="panel"]').closest("label").classList.contains("chg")) };
    check("...a colour changed = the app's (and the editor's --th-*) at once, marked as changed; the accent too", c1.panel === "#203040" && c1.th === "#203040" && c1.tiger === "#22aa66" && c1.lit, c1);

    /* 2 💾 Save theme -> themes/<name>.json */
    await p.fill("#s_thname", NAME); await p.click("#s_thsave");
    await p.waitForFunction((n) => [...document.querySelectorAll("#s_thsaved [data-th-load]")].some((x) => x.dataset.thLoad === n), NAME, { timeout: 60000 }).catch(() => null);   // a project with many gallery pictures queues the request behind their thumbnails
    const file = path.join(ROOT, "themes", NAME + ".json");
    const onDisk = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    check("💾 Save theme writes themes/<name>.json (the colours, the accent, the theme it started from, the UI size) and lists it as a card",
      !!onDisk && onDisk.vars.panel === "#203040" && onDisk.accent === "#22aa66" && onDisk.base === "dark" && onDisk.scale === 100 && await ev((n) => !!document.querySelector(`#s_thsaved .thsaved.on [data-th-load="${n}"]`), NAME), onDisk);

    /* 3 another theme, then load the saved one */
    await p.click('#s_themes [data-theme-id="light"]'); await p.waitForTimeout(100);
    const lt = await css("--panel");
    await p.click(`#s_thsaved [data-th-load="${NAME}"]`); await p.waitForTimeout(200);
    const back = { panel: await css("--panel"), tiger: await css("--tiger"), name: await ev(() => H3Theme.current().name) };
    check("Light, then a click on the saved card: its colours + accent back, its name kept", lt === "#ffffff" && back.panel === "#203040" && back.tiger === "#22aa66" && back.name === NAME, { lt, back });
    await p.reload({ waitUntil: "domcontentloaded" }); await p.waitForFunction(() => window.H3Theme, null, { timeout: 30000 });
    check("...kept after a reload (before the page paints)", await css("--panel") === "#203040");
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.pdf, null, { timeout: 60000 });
    await p.waitForTimeout(600);

    /* 4 import + delete */
    await ev(() => { document.getElementById("settings").showModal(); document.querySelector('#settings [data-stab="themes"]').click(); });
    await p.setInputFiles("#s_thfile", { name: "mine.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ name: "Imported", base: "slate", vars: { panel: "#334455" }, accent: "#ff8800", scale: 110 })) });
    await p.waitForTimeout(300);
    const imp = { panel: await css("--panel"), tiger: await css("--tiger"), root: await ev(() => getComputedStyle(document.documentElement).fontSize) };
    check("⤒ Import a theme .json: used at once (its base Slate, its colours, accent, UI size 110 %)", imp.panel === "#334455" && imp.tiger === "#ff8800" && imp.root === "15.4px", imp);
    await p.click(`#s_thsaved [data-th-del="${NAME}"]`); await p.waitForTimeout(400);
    check("✕ deletes themes/<name>.json (and its card)", !fs.existsSync(file) && await ev((n) => !document.querySelector(`#s_thsaved [data-th-load="${n}"]`), NAME));
    await ev(() => { H3Theme.choose("dark", "", {}, ""); if (window.applyUiScale) applyUiScale(100); document.getElementById("settings").close(); });

    /* 5 the PDF Save dialog: Embed fonts */
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.setInputFiles("#pcPdfFile", { name: "fonts.pdf", mimeType: "application/pdf", buffer: pdfBytes });
    await p.waitForFunction(() => { const P = window.imageEditorInstance.E.pdf.state(); return P && P.cur === 0 && window.imageEditorInstance.state.layers.length > 1; }, null, { timeout: 30000 });
    await p.waitForTimeout(500);
    // the first line: Cyrillic in an installed font; the second left in Arial (not on every computer)
    await ev((fam) => { const E = window.imageEditorInstance.E, S = E.S, T = S.layers.filter((L) => L.type === "text"); E.setLayer(T[0], "edit", (x) => { x.text.str = "Привет мир"; x.text.font = fam; }); }, FAMILY);
    await p.click("#pdfSave"); await p.waitForTimeout(200);
    const dlg = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return d ? { title: d.querySelector("h4").textContent, emb: !!d.querySelector("#pfEmb"), on: d.querySelector("#pfEmb").checked, ro: d.querySelector("#pfN").readOnly } : null; });
    check("💾 Save PDF opens the Save dialog: the name, Embed fonts (on), also download", dlg && dlg.title === "Save PDF" && dlg.emb && dlg.on && dlg.ro, dlg);
    await ev(() => document.querySelector(".kxdlg.pcd").remove());
    const sv = await ev((n) => window.imageEditorInstance.E.pdf.save(n, false, { embed: true }), OUT);
    const saved = fs.readFileSync(path.join(ROOT, "projects", await (await fetch(URL_ + "api/projects/current").then((r) => r.json()).catch(() => ({ name: "default" }))).name || "default", "pdf", OUT + ".pdf"));
    // the saved PDF's objects (pdf-lib packs them in object streams): a font descriptor with a FontFile2 / 3, a subset name
    const sd = await PL.PDFDocument.load(saved), N = (n) => PL.PDFName.of(n);
    let ff = false, base = [];
    for (const [, obj] of sd.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PL.PDFDict)) continue;
      if (obj.get(N("FontFile2")) || obj.get(N("FontFile3"))) ff = true;
      const bf = obj.get(N("BaseFont")); if (bf) base.push(String(bf));
    }
    check("Embed fonts: the Cyrillic line is REAL text in its own embedded font (" + FAMILY + ", only its letters - a subset), the PDF holds the font file",
      sv && sv.embedded >= 1 && sv.raster === 0 && ff && base.some((x) => x.replace(/[^A-Za-z]/g, "").includes(FAMILY.replace(/[^A-Za-z]/g, ""))) && saved.length < 200 * 1024, { sv, ff, base, size: saved.length });
    const sv2 = await ev((n) => window.imageEditorInstance.E.pdf.save(n + "_std", false, { embed: false }), OUT);
    check("...without Embed fonts the Cyrillic line goes into the picture (the standard fonts can not write it)", sv2 && sv2.embedded === 0 && sv2.raster === 1, sv2);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the browser run finished\n      got " + JSON.stringify(String(e && e.stack || e)).slice(0, 900));
  } finally {
    try { await api("/api/themes/delete", { name: NAME }); } catch { /* fine */ }
    await b.close();
    for (const s of ["", "_std"]) for (const d of fs.readdirSync(path.join(ROOT, "projects"))) { try { fs.rmSync(path.join(ROOT, "projects", d, "pdf", OUT + s + ".pdf"), { force: true }); } catch { /* fine */ } }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
