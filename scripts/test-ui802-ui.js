#!/usr/bin/env node
/* bitGen Studio — 2.802.0 in a REAL browser: PRINT-READY PDF (pcdtpout.js) - the Export dialog's Print-ready box, bleed, marks, page
 * boxes, CMYK. Tim: "please go with next" (desktop publishing part 4). Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the print-ready browser test did not run"); process.exit(0); }
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui802-"));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.dtpOut && window.PCMode, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => document.getElementById("kxFull").click()); await p.waitForTimeout(800);
    await ev(() => {
      const E = window.imageEditorInstance.E, D = window.PCDoc;
      E.pages.newDocument({ preset: "A6", orient: "portrait", dpi: 72 }, 2, "Flyer");
      const P0 = E.makeLayer("Photo", E.S.w, E.S.h); const g = P0.canvas.getContext("2d"); g.fillStyle = "#00aa44"; g.fillRect(0, 0, E.S.w, 120); E.addLayer(P0, "photo", false);
      const B = E.makeLayer("Band", E.S.w, E.S.h, "shape"); B.shape = Object.assign({}, D.SHAPE_DEFAULT || {}, { kind: "rect", x: 0, y: E.S.h - 60, w: E.S.w, h: 60, fill: "#dd2222", fillOn: true, strokeOn: false }); D.rasterize(B); E.addLayer(B, "band", false);
      const T = E.makeLayer("Title", E.S.w, E.S.h, "text"); T.text = Object.assign({}, D.TEXT_DEFAULT, { str: "Print me", size: 28, x: 20, y: 160, color: "#000000" }); D.rasterize(T); E.addLayer(T, "title", false);
    });
    await p.waitForTimeout(300);

    /* 1 the dialog */
    await ev(() => window.imageEditorInstance.E.ui.run("file.exportdtp")); await p.waitForTimeout(200);
    let st = await ev(() => ({ box: getComputedStyle(document.getElementById("dtpPrintBox")).display, opts: document.getElementById("dtpPrintOpts").style.display }));
    await ev(() => { const c = document.getElementById("dtpPrint"); c.checked = true; c.dispatchEvent(new Event("change")); });
    const st2 = await ev(() => ({ opts: document.getElementById("dtpPrintOpts").style.display, bleed: document.getElementById("dtpBleed").value, crop: document.getElementById("dtpCrop").checked, reg: document.getElementById("dtpReg").checked, slug: document.getElementById("dtpSlug").checked, col: document.getElementById("dtpColour").value, press: document.getElementById("dtpPress").value }));
    await ev(() => { const f = document.getElementById("dtpFmt"); f.value = "svg"; f.dispatchEvent(new Event("change")); });
    const svgHides = await ev(() => document.getElementById("dtpPrintBox").style.display === "none");
    await ev(() => { const f = document.getElementById("dtpFmt"); f.value = "pdf"; f.dispatchEvent(new Event("change")); });
    check("Export dialog: a Print-ready box (off at first); ticked = bleed 3 mm, crop + registration marks, page information, CMYK on coated paper; not for SVG pages", st.opts === "none" && st2.opts === "" && st2.bleed === "3" && st2.crop && st2.reg && st2.slug && st2.col === "cmyk" && st2.press === "coated" && svgHides, { st, st2, svgHides });
    await ev(() => { document.getElementById("dtpName").value = "Flyer print"; document.getElementById("dtpGo").click(); });
    await p.waitForFunction(() => /exported/.test((document.getElementById("ieStatus") || {}).textContent || ""), null, { timeout: 30000 }).catch(() => {});
    const ls = await ev(() => fetch("/api/dtp/list").then((r) => r.json()));
    check("…⤓ Export: Flyer print.pdf saved in the project's dtp folder", ls.files.some((f) => f.name === "Flyer print.pdf"), ls);
    const status = await ev(() => (document.getElementById("ieStatus") || {}).textContent || "");
    check("…the message says print-ready CMYK, 3 mm bleed", /print-ready CMYK, 3 mm bleed/.test(status), status);

    /* 2 the file */
    const bytes = await ev(() => fetch("/api/dtp/file/" + encodeURIComponent("Flyer print.pdf")).then((r) => r.arrayBuffer()).then((ab) => Array.from(new Uint8Array(ab))));
    const f = path.join(tmp, "flyer.pdf"); fs.writeFileSync(f, Buffer.from(bytes));
    const PL = require("../static/vendor/pdf-lib.min.js"), d = await PL.PDFDocument.load(Buffer.from(bytes)), pg = d.getPage(0);
    const bx = (b) => [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10).join();
    const trim = bx(pg.getTrimBox()), bleed = bx(pg.getBleedBox()), media = bx(pg.getMediaBox());
    check("the PDF: 2 pages; TrimBox = A6 at 72 dpi (298 x 420), BleedBox 3 mm (8.5 pt) round it, MediaBox with room for the marks", d.getPageCount() === 2 && trim === "32.5,32.5,298,420" && bleed === "24,24,315,437" && media === "0,0,363,485", { trim, bleed, media });
    const raw = Buffer.from(bytes).toString("latin1");
    check("…pictures as CMYK images, no RGB picture; fonts embedded (a FontFile) or noted", /\/ColorSpace \/DeviceCMYK/.test(raw) && !/\/ColorSpace \/DeviceRGB/.test(raw) && (/\/FontFile2?|\/FontFile3/.test(raw) || /standard font/.test(status)), { cmyk: /DeviceCMYK/.test(raw) });
    if (has("pdftoppm")) {
      execFileSync("pdftoppm", ["-r", "72", "-f", "1", "-l", "1", "-png", f, path.join(tmp, "pg")]);
      const png = fs.readdirSync(tmp).find((x) => /^pg.*\.png$/.test(x));
      const px = await ev(async (b64) => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); const at = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3)); return { w: im.width, h: im.height, bleedTop: at(100, 27), bleedBottom: at(100, 485 - 27), outside: at(100, 10), mark: (() => { let n = 0; const d = g.getImageData(0, 0, 32, 32).data; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++; return n; })() }; }, fs.readFileSync(path.join(tmp, png)).toString("base64"));
      check("rendered (pdftoppm): the green photo carried into the top bleed, the red band into the bottom bleed, white outside, crop marks in the corner", Math.abs(px.w - 363) <= 1 && px.bleedTop[1] > 100 && px.bleedTop[0] < 100 && px.bleedBottom[0] > 150 && px.bleedBottom[1] < 100 && px.outside.every((v) => v > 240) && px.mark > 10, px);
    }
    if (has("pdftotext")) { const t = execFileSync("pdftotext", ["-f", "1", "-l", "1", f, "-"], { encoding: "utf8" }); check("…the title is real text; the slug names the document, the page, CMYK and the bleed", /Print me/.test(t) && /Flyer/.test(t) && /Page 1/.test(t) && /CMYK/.test(t) && /bleed 3 mm/.test(t), t); }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e && e.stack)); }
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
