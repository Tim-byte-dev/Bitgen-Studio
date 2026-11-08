#!/usr/bin/env node
/* bitGen Studio — 2.731.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): the Music
 * docker's Sheet music tab ENGRAVES the score and saves it as a PDF.
 * Tim (verbatim): "in our music docker, sheet music tab can we have real sheet music with the notes drawn on the staff
 * with it's clefs etc. and save as pdf?"
 *   - GET /api/scores lists the project's .abc files (a score put in the output folder appears, newest first);
 *   - opening the tab draws the newest score: white pages of SVG (staff lines, clefs, notes...), the status says
 *     pages / bars / staves; the Score list picks another;
 *   - 💾 Save PDF: the status names the file in the project's pdf folder, GET /api/pdf/file/<name> is a real PDF with
 *     the score's title; "download too" downloads the same file;
 *   - ⛶ Read opens the pages full size; ‹/› ABC text shows the notation; 📂 Open .abc draws a file from the computer;
 *   - a file with no notes says so and greys out 💾 Save PDF.
 * The test's own files (the .abc, the PDFs) are removed afterwards. No server / no Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.731.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

const NAME = "E2E-Score731_20261108-120000.abc", OLDER = "E2E-Older731.abc";
const ABC = `X:1
T:
M:4/4
L:1/16
Q:1/4=92
V: Vocal clef=treble name="Vocal Melody" snm="Vocal"
V: Ins clef=treble name="Ins Melody" snm="Inst."
K:Gm
% verse
V: Vocal
"Gm"G2B2d2B2A2G2F4|"Eb"G2A2B2c2d2c2B4|"F"A2c2B2A2G2F2D4|"Gm"G2F2D2F2G4z4|
V: Ins
Z4|
% chorus
V: Vocal
"Bb"d2f2d2c2B2c2d4|"F"c2A2F2A2c4z4|"Cm"c2e2g2e2d2c2B4|"D7"A2^F2D2F2A4d4|
V: Ins
z8 [GBd]8|z8 [FAc]8|z8 [EGc]8|z8 [DF^A]8|
`;

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.731.0 browser test did not run"); process.exit(0); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.log("SKIP: the studio's output folder is not on this machine - the 2.731.0 browser test did not run"); process.exit(0); }
  const projDir = ((where.dirs || []).find((d) => d.where === "project") || {}).dir || path.dirname(out);
  const made = [path.join(out, NAME), path.join(out, OLDER)];
  fs.writeFileSync(path.join(out, OLDER), "X:1\nT:Older\nK:C\nC D E F|]\n");
  const t0 = Date.now() / 1000;
  fs.utimesSync(path.join(out, OLDER), t0 - 3600 * 24 * 400, t0 - 3600 * 24 * 400);
  fs.writeFileSync(path.join(out, NAME), ABC);
  const pdfs = [];
  const b = await chromium.launch();
  try {
    const list = await fetch(URL0 + "api/scores").then((r) => r.json());
    const names = (list.files || []).map((f) => f.name);
    check("GET /api/scores lists the project's .abc files, newest first", names[0] === NAME && names.includes(OLDER) && names.indexOf(OLDER) > 0, names.slice(0, 5));

    const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.MuScore && window.AbcScore && document.getElementById("muPaneSheet") && document.querySelector('button[data-mutab="sheet"]'), null, { timeout: 30000 });
    await ev(() => document.querySelector('button[data-mutab="sheet"]').click());
    await p.waitForFunction(() => document.querySelector("#muScore .muPaper svg"), null, { timeout: 15000 }).catch(() => {});
    const a = await ev(() => {
      const svg = document.querySelector("#muScore .muPaper svg");
      const sel = document.getElementById("muScoreList");
      return { pages: document.querySelectorAll("#muScore .muPaper").length, paths: svg ? svg.querySelectorAll("path").length : 0,
        texts: svg ? [...svg.querySelectorAll("text")].map((t) => t.textContent) : [], white: svg ? svg.querySelector("rect").getAttribute("fill") : "",
        status: document.getElementById("muSheetStatus").textContent, sel: sel.value, opts: [...sel.options].map((o) => o.value),
        pdfOff: document.getElementById("muScorePdf").disabled, abcHidden: document.getElementById("muAbc").classList.contains("hidden") };
    });
    check("opening the tab draws the newest score: a white page of SVG with the staves (hundreds of paths)", a.pages === 1 && a.paths > 150 && a.white === "#ffffff", a);
    check("…its title from the file (E2E-Score731), the voice names, chord symbols, Verse / Chorus, ♩ = 92",
      a.texts.includes("E2E-Score731") && a.texts.includes("Vocal Melody") && a.texts.includes("Ins Melody") && a.texts.includes("Gm") && a.texts.includes("D7")
      && a.texts.includes("Verse") && a.texts.includes("Chorus") && a.texts.includes("= 92"), a.texts);
    check("…the status says the file, 1 page, 8 bars, 2 staves; the Score list has it picked; 💾 Save PDF on; the ABC text hidden",
      /E2E-Score731_20261108-120000\.abc - 1 page, 8 bars, 2 staves/.test(a.status) && a.sel === NAME && a.opts.includes(OLDER) && !a.pdfOff && a.abcHidden, a);
    const geo = await ev(() => { const s = document.querySelector("#muScore .muPaper svg").getBoundingClientRect(); return { w: s.width, h: s.height }; });
    check("…the page keeps A4's proportions", geo.w > 100 && Math.abs(geo.h / geo.w - 841.89 / 595.28) < 0.02, geo);

    // the Score list
    await p.selectOption("#muScoreList", OLDER);
    await p.waitForFunction(() => /^🎼 E2E-Older731\.abc - /.test(document.getElementById("muSheetStatus").textContent), null, { timeout: 10000 }).catch(() => {});
    const o = await ev(() => ({ t: [...document.querySelectorAll("#muScore svg text")].map((x) => x.textContent), status: document.getElementById("muSheetStatus").textContent }));
    check("the Score list draws another score (T:Older - 1 bar, 1 staff)", o.t.includes("Older") && /1 bar, 1 staff/.test(o.status), o);
    await p.selectOption("#muScoreList", NAME);
    await p.waitForFunction(() => /^🎼 E2E-Score731_20261108-120000\.abc - /.test(document.getElementById("muSheetStatus").textContent), null, { timeout: 10000 }).catch(() => {});

    // 💾 Save PDF (+ download)
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), ev(() => document.querySelector("#muScorePdf").click())]);
    await p.waitForFunction(() => /saved in the project's pdf folder/.test(document.getElementById("muSheetStatus").textContent), null, { timeout: 15000 }).catch(() => {});
    const st = await ev(() => ({ status: document.getElementById("muSheetStatus").textContent, last: window.MuScore.state.last }));
    const pname = st.last && st.last.name;
    if (pname) pdfs.push(path.join(projDir, "pdf", pname));
    check("💾 Save PDF: 'E2E-Score731.pdf - 1 page - saved in the project's pdf folder'", pname === "E2E-Score731.pdf" && /📄 E2E-Score731\.pdf - 1 page - saved in the project's pdf folder/.test(st.status), st);
    const got = pname ? Buffer.from(await fetch(URL0 + "api/pdf/file/" + encodeURIComponent(pname)).then((r) => r.arrayBuffer())) : Buffer.alloc(0);
    const s = got.toString("latin1");
    check("…GET /api/pdf/file/E2E-Score731.pdf is the PDF: one A4 page, the title, the standard fonts only",
      s.startsWith("%PDF-1.4") && /\/MediaBox \[0 0 595\.28 841\.89\]/.test(s) && /\/Title \(E2E-Score731\)/.test(s) && /\/BaseFont \/Helvetica\b/.test(s) && !/FontFile/.test(s) && /%%EOF\s*$/.test(s), s.slice(0, 120));
    const listed = await fetch(URL0 + "api/pdf/list").then((r) => r.json()).catch(() => ({}));
    check("…and the image editor's PDF list has it (File ▸ Open PDF from Project)", (listed.files || []).some((f) => f.name === pname));
    let dlBytes = null;
    if (dl) { const fp = await dl.path().catch(() => null); if (fp) dlBytes = fs.readFileSync(fp); }
    check("…'download too' downloads the same file", !!dl && dl.suggestedFilename() === "E2E-Score731.pdf" && !!dlBytes && dlBytes.equals(got), dl && dl.suggestedFilename());

    // ⛶ Read
    await ev(() => document.querySelector("#muScoreBig").click());
    await p.waitForTimeout(300);
    const v = await ev(() => { const d = document.getElementById("muScoreView"); const s2 = d && d.querySelector("svg"); const r = s2 && s2.getBoundingClientRect();
      return { open: !!d && d.open, w: r ? r.width : 0, title: d ? document.getElementById("muSvTitle").textContent : "" }; });
    check("⛶ Read: the pages full size in a dialog (wider than 500 px), titled with the score", v.open && v.w > 500 && /E2E-Score731 - 1 page/.test(v.title), v);
    await ev(() => document.querySelector("#muSvClose").click());
    check("…✕ closes it", !(await ev(() => document.getElementById("muScoreView").open)));

    // ‹/› ABC text
    await ev(() => document.querySelector("#muAbcToggle").click());
    const at = await ev(() => ({ shown: !document.getElementById("muAbc").classList.contains("hidden"), pressed: document.getElementById("muAbcToggle").getAttribute("aria-pressed"), text: document.getElementById("muAbc").textContent }));
    await ev(() => document.querySelector("#muAbcToggle").click());
    check("‹/› ABC text shows the notation the score is drawn from (and hides it again)", at.shown && at.pressed === "true" && at.text.includes('V: Vocal clef=treble name="Vocal Melody"')
      && (await ev(() => document.getElementById("muAbc").classList.contains("hidden"))), at);

    // 📂 Open .abc
    await p.setInputFiles("#muAbcFile", { name: "from-disk.abc", mimeType: "text/plain", buffer: Buffer.from("X:1\nT:From Disk\nM:3/4\nL:1/8\nK:D clef=bass\nD,2 F,2 A,2|d6|]\n") });
    await p.waitForFunction(() => /from-disk\.abc/.test(document.getElementById("muSheetStatus").textContent), null, { timeout: 10000 }).catch(() => {});
    const fd = await ev(() => ({ t: [...document.querySelectorAll("#muScore svg text")].map((x) => x.textContent), status: document.getElementById("muSheetStatus").textContent }));
    check("📂 Open .abc draws a file from this computer (T:From Disk, 3/4, 2 bars)", fd.t.includes("From Disk") && fd.t.includes("3") && /📂 from-disk\.abc - 1 page, 2 bars, 1 staff/.test(fd.status), fd);

    // a file with no notes
    await p.setInputFiles("#muAbcFile", { name: "empty.abc", mimeType: "text/plain", buffer: Buffer.from("X:1\nT:Nothing here\nK:C\n") });
    await p.waitForFunction(() => /no notes/.test(document.getElementById("muScore").textContent), null, { timeout: 10000 }).catch(() => {});
    const em = await ev(() => ({ box: document.getElementById("muScore").textContent, pdfOff: document.getElementById("muScorePdf").disabled, bigOff: document.getElementById("muScoreBig").disabled }));
    check("a file with no notes says so; 💾 Save PDF and ⛶ Read grey out", /empty\.abc has no notes to draw/.test(em.box) && em.pdfOff && em.bigOff, em);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    for (const f of made.concat(pdfs)) { try { fs.unlinkSync(f); } catch { /* gone */ } }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
