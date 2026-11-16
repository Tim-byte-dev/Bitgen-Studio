#!/usr/bin/env node
/* bitGen Studio — 2.800.0 in a REAL browser: MASTER PAGES, PAGE NUMBERS, FACING PAGES (pcpages.js) + masters and spreads in the export
 * (pcdtpout.js). Tim: "go with the next version" (desktop publishing part 2). Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the masters browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const has = (bin) => { try { execSync("command -v " + bin, { stdio: "ignore" }); return true; } catch { return false; } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui800-"));
  const pdfText = async (opts) => {
    const r = await ev(async (o) => { const x = await window.imageEditorInstance.E.dtpOut.build("pdf", o); return { b: Array.from(x.bytes), notes: x.notes }; }, opts);
    const f = path.join(tmp, "d" + Math.random().toString(36).slice(2) + ".pdf"); fs.writeFileSync(f, Buffer.from(r.b));
    const PL = require("../static/vendor/pdf-lib.min.js"), d = await PL.PDFDocument.load(Buffer.from(r.b));
    const ocgs = d.catalog.lookup(PL.PDFName.of("OCProperties")).lookup(PL.PDFName.of("OCGs")).asArray().map((x) => d.context.lookup(x).lookup(PL.PDFName.of("Name")).decodeText());
    const pages = has("pdftotext") ? d.getPages().map((_, i) => execFileSync("pdftotext", ["-f", String(i + 1), "-l", String(i + 1), f, "-"], { encoding: "utf8" }).trim()) : null;
    return { sizes: d.getPages().map((pg) => Math.round(pg.getWidth()) + "x" + Math.round(pg.getHeight())), ocgs, pages, notes: r.notes };
  };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.pages && window.imageEditorInstance.E.pages.addMaster, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => document.getElementById("kxFull").click()); await p.waitForTimeout(800);
    await ev(() => window.imageEditorInstance.E.pages.newDocument({ preset: "A5", orient: "portrait", dpi: 72 }, 4, "Booklet"));
    await p.waitForTimeout(400);

    /* 1 ＋ Master: made, given to every page, opened to edit */
    await p.click("#pgMAdd"); await p.waitForTimeout(400);
    let st = await ev(() => { const E = window.imageEditorInstance.E; return { ed: E.pages.editing(), masters: E.pages.masters().map((m) => m.name), pages: E.pages.list().map((x) => x.master), head: (document.querySelector("#pcPagesPanel .pged b") || {}).textContent, w: E.S.w, layers: E.S.layers.map((L) => L.name) }; });
    check("＋ Master: A-Master (the page's size), given to all 4 pages, open to edit (⌂ A-Master in the panel, its own transparent layer)", st.ed === 0 && st.masters.join() === "A-Master" && st.pages.every((x) => x === st.pages[0] && x != null) && /A-Master/.test(st.head) && st.w === 420 && st.layers.join() === "Master", st);

    /* 2 on the master: a red header bar + # page number */
    await ev(() => {
      const E = window.imageEditorInstance.E, D = window.PCDoc;
      const B = E.makeLayer("Header", 420, 595, "shape"); B.shape = Object.assign({}, D.SHAPE_DEFAULT || {}, { kind: "rect", x: 0, y: 0, w: 420, h: 40, fill: "#cc0000", fillOn: true, strokeOn: false }); D.rasterize(B); E.addLayer(B, "header", false);
    });
    await p.click("#pgNumIns"); await p.waitForTimeout(300);
    st = await ev(() => window.imageEditorInstance.E.S.layers.map((L) => L.name + ":" + (L.text ? L.text.str : "")));
    check("# on the master: a Page number type layer reading {page} (as is, on the master)", st.join("|") === "Master:|Header:|Page number:{page}", st);

    /* 3 ← Pages: page 1 has the locked ⌂ A-Master layer above its Background, showing the header + its number */
    await p.click("#pgBack"); await p.waitForTimeout(500);
    const px = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data.slice(0, 3)), [x, y]);
    st = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers; return { ed: E.pages.editing(), names: L.map((x) => x.name), locked: !!(L[1] && L[1].locks && L[1].locks.all), master: L[1] && L[1].master }; });
    const red = await px(200, 20);
    check("← Pages: page 1 = Background, ⌂ A-Master (locked), the master's header shows on the page", st.ed === null && st.names.join() === "Background,⌂ A-Master" && st.locked && st.master != null && red[0] > 180 && red[1] < 40, { st, red });
    const numInk = async () => ev(() => { const E = window.imageEditorInstance.E, c = E.flatten(), g = c.getContext("2d"), d = g.getImageData(150, 540, 120, 40).data; let n = 0, s = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) { n++; s += i; } return n + ":" + s; });
    const ink1 = await numInk();
    await p.click('#pcPagesPanel [data-pgi="2"]'); await p.waitForTimeout(500);
    const ink3 = await numInk();
    check("…the page number: each page its own (page 1 and page 3 draw different digits at the bottom)", ink1 !== ink3 && !/^0:/.test(ink1) && !/^0:/.test(ink3), { ink1, ink3 });

    /* 4 page 2: no master; numbers as i ii iii from 1 */
    await p.click('#pcPagesPanel [data-pgi="1"]'); await p.waitForTimeout(400);
    await p.selectOption("#pgMaster", ""); await p.waitForTimeout(300);
    st = await ev(() => { const E = window.imageEditorInstance.E; return { names: E.S.layers.map((L) => L.name), m: E.pages.current().master }; });
    check("Master: None on page 2 - its ⌂ layer goes, the page keeps its own", st.names.join() === "Background" && st.m === null, st);
    await p.selectOption("#pgNumStyle", "i"); await p.waitForTimeout(400);
    const labels = await ev(() => [...document.querySelectorAll("#pcPagesPanel [data-pgi] .pn span")].map((x) => x.textContent));
    check("numbers i ii iii iv in the strip", labels.join() === "i,ii,iii,iv", labels);

    /* 5 {page} typed on a page shows its number */
    await p.click('#pcPagesPanel [data-pgi="3"]'); await p.waitForTimeout(400);
    await ev(() => { const E = window.imageEditorInstance.E, D = window.PCDoc; const T = E.makeLayer("Folio", 420, 595, "text"); T.text = Object.assign({}, D.TEXT_DEFAULT, { str: "p. {page} / {pages}", size: 18, x: 20, y: 60 }); D.rasterize(T); E.addLayer(T, "folio", false); });
    await p.waitForTimeout(900);
    st = await ev(() => { const L = window.imageEditorInstance.E.S.layers.find((x) => x.name === "Folio"); return { str: L.text.str, tpl: L.text.tpl }; });
    check("{page} / {pages} typed in a type layer on page 4 = p. iv / iv (the tokens kept)", st.str === "p. iv / iv" && st.tpl === "p. {page} / {pages}", st);
    st = await ev(() => window.imageEditorInstance.E.S.layers.map((L) => L.name));
    check("…a layer added on a page goes over its ⌂ master layer (the master stays right above the Background)", st.join() === "Background,⌂ A-Master,Folio", st);

    /* 6 export: masters as their own layers with each page's number; spreads */
    let r = await pdfText({});
    check("Export PDF: the master's layers on each page that uses it (Master / Header, Master / Page number), not on page 2", r.ocgs.includes("Page 1 / Master / Header") && r.ocgs.includes("Page 3 / Master / Page number") && !r.ocgs.some((n) => /^Page 2 \/ Master/.test(n)) && r.sizes.length === 4, r.ocgs);
    if (r.pages) check("…pdftotext: each page's own number as real text (i, iii, iv; page 4 also p. iv / iv)", r.pages[0] === "i" && r.pages[1] === "" && r.pages[2] === "iii" && /p\. iv \/ iv/.test(r.pages[3]) && /(^|\n)iv$/.test(r.pages[3]), r.pages);
    await p.click("#pgFacing"); await p.waitForTimeout(300);
    st = await ev(() => [...document.querySelectorAll("#pcPagesPanel .pgs")].map((row) => [...row.children].map((c) => (c.classList.contains("pgx") ? "_" : c.dataset.pgi)).join("")));
    check("☐ Facing: the strip shows spreads - page 1 alone on the right, then 2 + 3, then 4", st.join() === "_0,12,3_", st);
    r = await pdfText({ spreads: true });
    check("Export As spreads: 3 PDF pages - 1, 2 + 3 (840 wide), 4", r.sizes.join() === "420x595,840x595,420x595" && r.ocgs.includes("Page 2 + Page 3 / Page 3 / Master / Header"), r);
    await ev(() => window.imageEditorInstance.E.ui.run("file.exportdtp")); await p.waitForTimeout(200);
    const sp = await ev(() => !!document.getElementById("dtpSpreads")); await ev(() => document.getElementById("dtpCancel").click());
    check("…the Export dialog offers As spreads for a facing document", sp);
    await shot("6-facing");

    /* 7 .bgi keeps the master, who uses it, facing, the numbering */
    await p.click('#pcPagesPanel [data-mme="0"]'); await p.waitForTimeout(300);
    const bg = await ev(async () => { const E = window.imageEditorInstance.E, x = await E.bgi.toBytes(); const files = await window.BgZip.unzipAsync(x.bytes); return { b: Array.from(x.bytes), names: [...files.keys()].filter((n) => /^(pages|masters)\//.test(n)).sort(), ed: E.pages.editing() }; });
    check("Save Project (.bgi) while the master is open: it goes back to the pages first; masters/<id>.bgi + the other pages inside", bg.ed === null && bg.names.filter((n) => /^masters\//.test(n)).length === 1 && bg.names.filter((n) => /^pages\//.test(n)).length === 3, bg.names);
    await ev(async (a) => { await window.imageEditorInstance.E.bgi.openBytes(new Uint8Array(a), "Booklet.bgi"); }, bg.b);
    await p.waitForTimeout(700);
    st = await ev(() => { const E = window.imageEditorInstance.E; return { masters: E.pages.masters().map((m) => m.name), uses: E.pages.list().map((x) => x.master == null ? "-" : "M"), facing: E.pages.facing(), nb: E.pages.numbering() }; });
    check("…opened again: A-Master, used by pages 1 / 3 / 4, facing, i ii iii", st.masters.join() === "A-Master" && st.uses.join("") === "M-MM" && st.facing && st.nb.style === "i", st);
    await p.click('#pcPagesPanel [data-mme="0"]'); await p.waitForTimeout(400);
    st = await ev(() => window.imageEditorInstance.E.S.layers.map((L) => L.name));
    check("…and the master has its layers back", st.join() === "Master,Header,Page number", st);
    await p.click("#pgMAdd"); await p.waitForTimeout(300);
    st = await ev(() => ({ names: window.imageEditorInstance.E.pages.masters().map((m) => m.name) }));
    check("a second ＋ Master = B-Master (pages that have one keep theirs)", st.names.join() === "A-Master,B-Master", st);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e && e.stack)); }
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
