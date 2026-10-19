#!/usr/bin/env node
/* bitGen Studio — 2.449.0 in a REAL browser: PER-CHARACTER TYPE in the image editor (pcruns.js). Tim: "more photoshop
 * features to close the gap" - per-character text styles. Against the running app (H3_URL, default :8311).
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the per-character type browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.runs, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => {
      const E = window.imageEditorInstance.E;
      E.docs.setTabs(true); E.openDoc(520, 220, "runs.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 520, 220); });
      E.setTool("type");
      const L = E.makeLayer("Text", 520, 220, "text"); L.text = Object.assign({}, E.D.TEXT_DEFAULT, { str: "Hello world", x: 20, y: 60, size: 40, color: "#000000", font: "Arial", weight: 400, align: "left" });
      E.D.rasterize(L); E.addLayer(L, "new text layer", false); E.renderOptions(); E.editText(L);
    });
    await p.waitForTimeout(300);
    const pick = (s, e) => ev(([s, e]) => { const ta = document.querySelector("textarea.pctext"); ta.focus(); ta.setSelectionRange(s, e); }, [s, e]);
    const T = () => ev(() => { const L = window.imageEditorInstance.E.layer(); return JSON.parse(JSON.stringify(L.text)); });
    /** red / black letter pixels: where they are */
    const inks = () => ev(() => { const L = window.imageEditorInstance.E.layer(), c = L.canvas, d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; const o = { red: [1e9, -1], black: [1e9, -1], nr: 0, nb: 0, top: 1e9, bottom: -1 };
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const x = (i / 4) % c.width, y = Math.floor(i / 4 / c.width); o.top = Math.min(o.top, y); o.bottom = Math.max(o.bottom, y);
        if (d[i] > 180 && d[i + 1] < 80 && d[i + 2] < 80) { o.nr++; o.red[0] = Math.min(o.red[0], x); o.red[1] = Math.max(o.red[1], x); } else if (d[i] < 70 && d[i + 1] < 70 && d[i + 2] < 70) { o.nb++; o.black[0] = Math.min(o.black[0], x); o.black[1] = Math.max(o.black[1], x); } }
      return o; });

    /* 1 letters picked + the options bar's colour: only those letters */
    await pick(0, 5);
    await ev(() => { const c = document.getElementById("ptTCol"); c.value = "#ff0000"; c.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(250);
    const t1 = await T(), k1 = await inks();
    await shot("1-red");
    check("letters 1-5 picked while typing + the options bar's colour: ONLY \"Hello\" turns red (a range on the layer, the layer's own colour kept)",
      JSON.stringify(t1.runs) === '[{"s":0,"e":5,"color":"#ff0000"}]' && t1.color === "#000000" && k1.nr > 100 && k1.nb > 100 && k1.red[1] < k1.black[0], { runs: t1.runs, k1 });
    const keep1 = await ev(() => { const ta = document.querySelector("textarea.pctext"); return !!ta && document.activeElement === ta && ta.selectionStart === 0 && ta.selectionEnd === 5; });
    check("...the typing box stays open with its letters still picked", keep1, keep1);

    /* 2 B (a real click on the options bar) on "world" */
    await pick(6, 11);
    await p.click("#ptBold"); await p.waitForTimeout(250);
    const t2 = await T(), keep2 = await ev(() => { const ta = document.querySelector("textarea.pctext"); return !!ta && ta.selectionStart === 6 && ta.selectionEnd === 11; });
    check("B clicked with \"world\" picked: bold only there (the click does not end the typing)", t2.runs.length === 2 && t2.runs[1].s === 6 && t2.runs[1].e === 11 && t2.runs[1].weight === 700 && (t2.weight || 400) === 400 && keep2, { runs: t2.runs, keep2 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(150);
    const u2 = await T();
    check("...one undo takes that range's bold away again", u2.runs.length === 1 && !u2.runs.some((r) => r.weight), u2.runs);
    await ev(() => window.imageEditorInstance.E.redo()); await p.waitForTimeout(150);

    /* 3 a bigger size for "Hello": the line grows, the letters share one baseline; the typing box floats above */
    const h0 = await inks();
    await pick(0, 5);
    await ev(() => { const s = document.getElementById("ptTSize"); s.value = "80"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(300);
    const t3 = await T(), k3 = await inks(), shaped = await ev(() => document.querySelector("textarea.pctext").classList.contains("pcshaped"));
    await shot("3-size");
    check("size 80 for \"Hello\" only: those letters twice as tall, the rest as they were (the layer's size kept); the typing box floats above it (sizes differ)",
      t3.runs[0].size === 80 && t3.size === 40 && (k3.bottom - k3.top) > (h0.bottom - h0.top) * 1.5 && shaped, { r: t3.runs, h0: [h0.top, h0.bottom], k3: [k3.top, k3.bottom], shaped });

    /* 4 typing inside a range takes its style */
    await ev(() => { const ta = document.querySelector("textarea.pctext"); ta.focus(); ta.setSelectionRange(2, 2); ta.setRangeText("XX", 2, 2, "end"); ta.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.waitForTimeout(200);
    const t4 = await T();
    check("typing \"XX\" inside \"Hello\": the ranges follow (red / 80 now covers \"HeXXllo\", bold \"world\" moved along)", t4.str === "HeXXllo world" && t4.runs[0].s === 0 && t4.runs[0].e === 7 && t4.runs[0].color === "#ff0000" && t4.runs[t4.runs.length - 1].s === 8 && t4.runs[t4.runs.length - 1].e === 13, t4.runs);

    /* 5 the Character panel: underline for letters 1-3 */
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcChar")); await p.waitForTimeout(250);
    await pick(0, 3);
    await p.click("#pcyU"); await p.waitForTimeout(250);
    const t5 = await T();
    check("the Character panel (Underline) with letters 1-3 picked: only those (the panel keeps the typing open)", t5.runs[0].s === 0 && t5.runs[0].e === 3 && t5.runs[0].underline === true && !t5.underline && !!(await ev(() => document.querySelector("textarea.pctext"))), t5.runs);

    /* 6 nothing picked = the whole layer, as before */
    await pick(4, 4);
    await ev(() => { const c = document.getElementById("ptTCol"); c.value = "#0000ff"; c.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(250);
    const t6 = await T();
    check("nothing picked (a caret only): the options bar changes the whole layer as before (its colour), the ranges kept", t6.color === "#0000ff" && t6.runs.length === t5.runs.length, { c: t6.color, n: t6.runs.length });

    /* 7 committed: kept; Clear Character Overrides */
    await ev(() => window.imageEditorInstance.E.endText()); await p.waitForTimeout(200);
    const t7 = await T();
    await ev(() => window.imageEditorInstance.E.ui.run("type.clearruns")); await p.waitForTimeout(200);
    const t8 = await T();
    check("committed (Esc / Ctrl+Enter): the ranges kept with the layer; Layer ▸ Type: Clear Character Overrides = every letter the layer's own again", t7.runs && t7.runs.length >= 3 && t7.str === "HeXXllo world" && !t8.runs, { t7: t7.runs, t8: t8.runs });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
