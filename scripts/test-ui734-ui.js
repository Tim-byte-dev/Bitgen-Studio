#!/usr/bin/env node
/* bitGen Studio — 2.734.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): the WORDS tick.
 * Tim (verbatim): "can we add a checkbox in the sheetmusic tab to add the words, add the lyrics of the song that is being
 * worked on in the lyrics input"
 *   - "words" in the Sheet Music tab's bar, off at first; ticked = the Song tab's lyrics under the vocal staff (section by
 *     section), the status says how many notes got words; editing the lyrics draws them again; unticked = gone;
 *   - empty lyrics = said; the tick is remembered after a reload; ⛶ Read and the PDF carry the words.
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.734.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAME = "E2E-Words734_20261109-120000.abc";
const ABC = `X:1
M:4/4
L:1/4
V: Vocal clef=treble name="Vocal Melody" snm="Vocal"
V: Ins clef=treble name="Ins Melody" snm="Inst."
K:C
% verse
V: Vocal
C D E F|G A B c|
V: Ins
Z2|
% chorus
V: Vocal
c B A G|F E D C|
V: Ins
Z2|
`;
const LYRICS = "[verse]\nWalking down the empty street\n[chorus]\nHold me close tonight my love";

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.734.0 browser test did not run"); process.exit(0); }
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
      await p.waitForFunction(() => window.MuScore && document.getElementById("muScoreWords") && document.getElementById("muLyrics"), null, { timeout: 30000 });
      await ev(() => document.querySelector('button[data-mutab="sheet"]').click());
      await sleep(900);
      await ev(() => MuScore.refresh());
      await p.selectOption("#muScoreList", NAME);
      await p.waitForFunction((n) => document.getElementById("muSheetStatus").textContent.indexOf(n) >= 0, NAME, { timeout: 15000 }).catch(() => {});
    };
    await open();
    await ev(() => { try { localStorage.removeItem("h3.muScoreWords"); } catch (e) { /* */ } });
    await ev((t) => { const l = document.getElementById("muLyrics"); l.value = t; }, LYRICS);
    const words = (sel) => ev((s) => [...document.querySelectorAll(s + " svg text")].filter((x) => x.getAttribute("font-size") === "10" && /Times/.test(x.getAttribute("font-family")) && x.getAttribute("font-weight") === "normal").map((x) => x.textContent), sel || "#muScore");
    const w0 = await ev(() => ({ checked: document.getElementById("muScoreWords").checked, label: document.getElementById("muScoreWords").parentElement.textContent.trim() }));
    check("the Sheet Music tab has a 'words' tick, off at first, no words drawn", !w0.checked && w0.label === "words" && (await words()).length === 0, w0);
    await p.check("#muScoreWords");
    await p.waitForFunction(() => /words:/.test(document.getElementById("muSheetStatus").textContent), null, { timeout: 10000 }).catch(() => {});
    const w1 = await words(), st1 = await ev(() => document.getElementById("muSheetStatus").textContent);
    check("ticked: the Song tab's lyrics under the vocal staff, verse then chorus, hyphens between syllables (Walk-ing, emp-ty, to-night)",
      JSON.stringify(w1.filter((x) => x !== "-")) === JSON.stringify(["Walk", "ing", "down", "the", "emp", "ty", "street", "Hold", "me", "close", "to", "night", "my", "love"]) && w1.filter((x) => x === "-").length === 3, w1);
    check("…the status says 14 of 16 sung notes under Vocal Melody", /words: 14 of 16 sung notes under Vocal Melody/.test(st1), st1);
    await ev(() => { const l = document.getElementById("muLyrics"); l.value = l.value.replace("Walking", "Strolling"); l.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.waitForFunction(() => [...document.querySelectorAll("#muScore svg text")].some((x) => x.textContent === "Strol"), null, { timeout: 5000 }).catch(() => {});
    const w2 = await words();
    check("editing the lyrics draws the words again a moment later (Walk-ing -> Strol-ling)", w2.includes("Strol") && !w2.includes("Walk"), w2);
    await ev(() => MuScore.openView());
    await sleep(300);
    const wv = await words("#muSvPages");
    check("⛶ Read has the words too", wv.includes("Hold") && wv.includes("Strol"), wv);
    await ev(() => document.getElementById("muScoreView").close());
    await ev(() => document.getElementById("muScorePdf").click());
    await p.waitForFunction(() => /saved in the project's pdf folder/.test(document.getElementById("muSheetStatus").textContent), null, { timeout: 15000 }).catch(() => {});
    const last = await ev(() => MuScore.state.last);
    if (last) pdfs.push(path.join(projDir, "pdf", last.name));
    const pdf = last ? Buffer.from(await fetch(URL0 + "api/pdf/file/" + encodeURIComponent(last.name)).then((r) => r.arrayBuffer())).toString("latin1") : "";
    check("💾 Save PDF carries the words", /\(Hold\) Tj/.test(pdf) && /\(Strol\) Tj/.test(pdf), pdf.length);
    await ev(() => { const l = document.getElementById("muLyrics"); l.value = ""; l.dispatchEvent(new Event("input", { bubbles: true })); });
    await sleep(1100);
    const st3 = await ev(() => document.getElementById("muSheetStatus").textContent);
    check("empty lyrics: no words, the status says the Song tab's lyrics are empty", (await words()).length === 0 && /words: the Song tab's lyrics are empty/.test(st3), st3);
    await ev((t) => { document.getElementById("muLyrics").value = t; }, LYRICS);
    await open();
    await ev((t) => { document.getElementById("muLyrics").value = t; MuScore.load(document.getElementById("muScoreList").value); }, LYRICS);
    await sleep(1200);
    const kept = await ev(() => document.getElementById("muScoreWords").checked);
    check("the tick is remembered after a reload (and the words drawn)", kept && (await words()).includes("Walk"), kept);
    await p.uncheck("#muScoreWords");
    await sleep(300);
    check("unticked: the words are gone", (await words()).length === 0);
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
