#!/usr/bin/env node
/* bitGen Studio — 2.732.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): the sheet
 * music's PAPER.  Tim (verbatim): "allow user to choose background color/material tiling for the sheet music"
 *   - 🎨 Paper opens the row: colour + 7 swatches, Material (8 materials, then Pictures: from this computer + the project's),
 *     Tile size, Texture, Ink, "in the PDF too", ↺ Plain white;
 *   - Parchment on Antique: the pages get a pattern of a JPEG tile the size asked for, the ink dark;
 *   - the Night swatch: dark paper, auto ink = light (every path of the page in it);
 *   - 💾 Save PDF on the paper = a tiling pattern with one DCTDecode image; "in the PDF too" off = plain white;
 *   - a picture from this computer as the material (its aspect kept in the repeat);
 *   - the choice is remembered after a reload; ↺ Plain white goes back.
 * No server / no Playwright = SKIP. The test's files are removed afterwards. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.732.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const NAME = "E2E-Paper732_20261109-120000.abc";
const ABC = "X:1\nM:4/4\nL:1/8\nV: Vocal name=\"Vocal Melody\"\nK:G\n% verse\n\"G\"G2B2 d2B2|\"C\"c2e2 g4|\"D\"f2a2 d'4|\"G\"g8|]\n";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAL0lEQVR4XmOUi1rAMBCAaSAsBYFRi+kGRoOabmA0qOkGRoOabmA0qOkGRoOabgAAG1cBQA/FmKoAAAAASUVORK5CYII=", "base64");     // 40 x 20, blue

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.732.0 browser test did not run"); process.exit(0); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.log("SKIP: the studio's output folder is not on this machine"); process.exit(0); }
  const projDir = ((where.dirs || []).find((d) => d.where === "project") || {}).dir || path.dirname(out);
  fs.writeFileSync(path.join(out, NAME), ABC);
  const pdfs = [];
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const open = async () => {
      await p.goto(URL0);
      await p.waitForFunction(() => window.MuScore && window.ScorePaper && document.querySelector('button[data-mutab="sheet"]'), null, { timeout: 30000 });
      await ev(() => document.querySelector('button[data-mutab="sheet"]').click());
      await p.waitForFunction(() => document.querySelector("#muScore .muPaper svg"), null, { timeout: 15000 }).catch(() => {});
      await p.selectOption("#muScoreList", NAME).catch(() => {});
      await p.waitForFunction((n) => document.getElementById("muSheetStatus").textContent.indexOf(n) >= 0 && document.querySelector("#muScore .muPaper svg"), NAME, { timeout: 15000 }).catch(() => {});
    };
    await open();
    await ev(() => { try { localStorage.removeItem("h3.muScorePaper"); } catch (e) { /* */ } return window.MuScore.setPaper({}); });
    await ev(() => document.getElementById("muPaperBtn").click());
    const row = await ev(() => { const s = document.getElementById("muPaperMat"); return { shown: !document.getElementById("muPaperRow").classList.contains("hidden"), pressed: document.getElementById("muPaperBtn").getAttribute("aria-pressed"),
      mats: [...s.querySelectorAll('optgroup[label="Materials"] option')].map((o) => o.textContent), pics: [...s.querySelectorAll('optgroup[label="Pictures"] option')].map((o) => o.value),
      sw: [...document.querySelectorAll("#muPaperSwatches button")].map((x) => x.title), ink: [...document.getElementById("muPaperInk").options].map((o) => o.value),
      pdf: document.getElementById("muPaperPdf").checked, size: document.getElementById("muPaperSize").disabled }; });
    check("🎨 Paper opens the row: 8 materials, a picture from this computer, 7 paper colours, 5 inks, 'in the PDF too' ticked; plain = no tile size",
      row.shown && row.pressed === "true" && row.mats.join() === "Plain,Parchment,Linen,Laid paper,Recycled,Watercolour,Canvas,Kraft" && row.pics[0] === "file:" && row.sw.length === 7
      && row.ink.join() === "auto,black,sepia,navy,white" && row.pdf && row.size === true, row);

    // Parchment on Antique, 240 pt repeats
    await ev(() => document.querySelector('#muPaperSwatches button[title="Antique"]').click());
    await p.waitForTimeout(200);
    await ev(() => { document.getElementById("muPaperSize").value = "240"; document.getElementById("muPaperSize").dispatchEvent(new Event("change", { bubbles: true })); });
    await p.selectOption("#muPaperMat", "parchment");
    await p.waitForFunction(() => document.querySelector("#muScore .muPaper svg pattern image"), null, { timeout: 15000 }).catch(() => {});
    const pa = await ev(() => { const svg = document.querySelector("#muScore .muPaper svg"); const pt = svg.querySelector("pattern"); const im = pt && pt.querySelector("image");
      return { bg: svg.querySelector("rect").getAttribute("fill"), w: pt && pt.getAttribute("width"), h: pt && pt.getAttribute("height"), href: im ? im.getAttribute("href").slice(0, 23) : "",
        ink: svg.querySelector("path:not([fill=none])").getAttribute("fill"), status: document.getElementById("muSheetStatus").textContent, sizeOn: !document.getElementById("muPaperSize").disabled }; });
    check("Parchment on Antique: the page is #f3e6c8 under a 240 x 240 pt pattern of a JPEG tile, the ink near-black; the status says so",
      pa.bg === "#f3e6c8" && pa.w === "240" && pa.h === "240" && pa.href === "data:image/jpeg;base64," && pa.ink === "#141414" && /🎨 paper: Parchment on #f3e6c8, ink #141414/.test(pa.status) && pa.sizeOn, pa);

    // Night: auto ink light
    await ev(() => document.querySelector('#muPaperSwatches button[title="Night"]').click());
    await p.waitForFunction(() => document.querySelector("#muScore .muPaper svg rect").getAttribute("fill") === "#22262f", null, { timeout: 15000 }).catch(() => {});
    const ni = await ev(() => { const svg = document.querySelector("#muScore .muPaper svg"); const fills = new Set([...svg.querySelectorAll("path")].map((x) => x.getAttribute("fill")).filter((f) => f !== "none"));
      return { bg: svg.querySelector("rect").getAttribute("fill"), fills: [...fills], pressed: document.querySelector('#muPaperSwatches button[title="Night"]').getAttribute("aria-pressed") }; });
    check("the Night swatch: dark paper, the auto ink turns light - every filled path #f5f0e4", ni.bg === "#22262f" && ni.fills.join() === "#f5f0e4" && ni.pressed === "true", ni);

    // the PDF on the paper, then plain
    const save = async () => {
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), ev(() => document.getElementById("muScorePdf").click())]);
      await p.waitForFunction(() => /saved in the project's pdf folder/.test(document.getElementById("muSheetStatus").textContent), null, { timeout: 15000 }).catch(() => {});
      const last = await ev(() => window.MuScore.state.last);
      if (last) pdfs.push(path.join(projDir, "pdf", last.name));
      const fp = dl ? await dl.path().catch(() => null) : null;
      return fp ? fs.readFileSync(fp).toString("latin1") : "";
    };
    const s1 = await save();
    check("💾 Save PDF on the paper: a tiling pattern of one JPEG (DCTDecode), the light ink", /\/PatternType 1/.test(s1) && (s1.match(/\/Filter \/DCTDecode/g) || []).length === 1
      && /\/Pattern cs \/P1 scn/.test(s1) && /0\.961 0\.941 0\.894 rg/.test(s1), s1.slice(0, 120));
    await ev(() => document.getElementById("muPaperPdf").click());
    await p.waitForTimeout(300);
    const s2 = await save();
    check("'in the PDF too' off: the PDF is plain white with black ink (for printing); the screen keeps the paper",
      s2.startsWith("%PDF") && !/\/Pattern/.test(s2) && !/DCTDecode/.test(s2) && /\n0 0 0 rg 0 0 0 RG/.test(s2)
      && (await ev(() => document.querySelector("#muScore .muPaper svg rect").getAttribute("fill"))) === "#22262f");
    await ev(() => document.getElementById("muPaperPdf").click());

    // a picture from this computer
    await p.setInputFiles("#muPaperFile", { name: "blue-tile.png", mimeType: "image/png", buffer: PNG });
    await p.waitForFunction(() => /🖼 blue-tile\.png/.test(document.getElementById("muSheetStatus").textContent), null, { timeout: 15000 }).catch(() => {});
    const pic = await ev(() => { const pt = document.querySelector("#muScore .muPaper svg pattern"); const s = document.getElementById("muPaperMat");
      return { w: pt && pt.getAttribute("width"), h: pt && pt.getAttribute("height"), sel: s.value, opt: s.options[s.selectedIndex] && s.options[s.selectedIndex].textContent, status: document.getElementById("muSheetStatus").textContent }; });
    check("📂 a picture from this computer becomes the material: a 40 x 20 picture repeats 240 x 120 pt (its aspect kept)", pic.w === "240" && pic.h === "120" && pic.sel === "picture" && /blue-tile\.png/.test(pic.opt), pic);

    // remembered after a reload; ↺ Plain white
    await ev(() => { document.querySelector('#muPaperSwatches button[title="Cream"]').click(); });
    await p.waitForTimeout(200);
    await p.selectOption("#muPaperMat", "linen");
    await p.waitForTimeout(800);
    await open();
    await p.waitForFunction(() => document.querySelector("#muScore .muPaper svg pattern"), null, { timeout: 15000 }).catch(() => {});
    const kept = await ev(() => ({ bg: document.querySelector("#muScore .muPaper svg rect").getAttribute("fill"), pat: !!document.querySelector("#muScore .muPaper svg pattern"), saved: JSON.parse(localStorage.getItem("h3.muScorePaper") || "{}") }));
    check("the choice is remembered after a reload (Linen on Cream)", kept.bg === "#fbf6e8" && kept.pat && kept.saved.material === "linen", kept);
    await ev(() => document.getElementById("muPaperBtn").click());
    await ev(() => document.getElementById("muPaperReset").click());
    await p.waitForFunction(() => !document.querySelector("#muScore .muPaper svg pattern"), null, { timeout: 15000 }).catch(() => {});
    const back = await ev(() => ({ bg: document.querySelector("#muScore .muPaper svg rect").getAttribute("fill"), ink: document.querySelector("#muScore .muPaper svg path:not([fill=none])").getAttribute("fill"), mat: document.getElementById("muPaperMat").value }));
    check("↺ Plain white: white paper, black ink, no pattern", back.bg === "#ffffff" && back.ink === "#141414" && back.mat === "plain", back);
    await ev(() => window.MuScore.openView());
    await p.waitForTimeout(300);
    const vw = await ev(() => { const s = document.querySelector("#muSvPages svg"); return { bg: s && s.querySelector("rect").getAttribute("fill") }; });
    check("⛶ Read shows the same paper", vw.bg === "#ffffff", vw);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    for (const f of [path.join(out, NAME)].concat(pdfs)) { try { fs.unlinkSync(f); } catch { /* gone */ } }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
