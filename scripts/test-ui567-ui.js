#!/usr/bin/env node
/* bitGen Studio — 2.567.0 in a REAL browser: the theme editor's Text ▸ Align, the words' Padding / Margin, Box ▸ Corners /
 * Padding / Margin (static/themeedit.js). Tim: "in theme editor add alignment options for text" / "add padding and
 * margins for selected objects and text, and rounded corners for objects".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the theme alignment browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const setv = (id, v) => ev(([id, v]) => { const x = document.getElementById(id); x.value = v; x.dispatchEvent(new Event(x.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }, [id, v]);
  const radio = (name, v) => p.click(`#thEditPanel input[name=${name}][value="${v}"] >> xpath=..`);
  // where the words sit inside the element: {dx, dy} from its left / top, {rx, ry} from its right / bottom
  const at = (id) => ev((id) => { const el = document.getElementById(id), rg = document.createRange(), lb = el.querySelector(".h3lb") || el; rg.selectNodeContents(lb); const t = rg.getBoundingClientRect(), o = el.getBoundingClientRect(); return { dx: Math.round(t.left - o.left), dy: Math.round(t.top - o.top), rx: Math.round(o.right - t.right), ry: Math.round(o.bottom - t.bottom), al: el.dataset.h3al || "" }; }, id);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit && document.getElementById("thEditBtn"), null, { timeout: 60000 });
    await ev(() => window.H3ThemeEdit.setStyles({}));
    await ev(() => {                         // a stand-in corner of the app: a button, a flex row, a flex column, a block
      const h = document.createElement("div"); h.id = "zzAl"; h.style.cssText = "position:fixed;left:40px;top:120px;z-index:50;background:#222;padding:10px;display:flex;gap:10px;align-items:flex-start";
      h.innerHTML = '<button id="zzAlBtn" type="button" style="width:220px;height:90px">💾 Save me</button>'
        + '<div id="zzAlRow" style="display:flex;width:220px;height:90px;background:#333;color:#fff"><b>one</b><i>two</i></div>'
        + '<div id="zzAlCol" style="display:flex;flex-direction:column;width:220px;height:90px;background:#333;color:#fff"><b>one</b><i>two</i></div>'
        + '<div id="zzAlBlk" style="width:220px;height:90px;background:#333;color:#fff">a block of words</div>';
      document.body.appendChild(h);
    });
    const b0 = await at("zzAlBtn");

    /* 1 a button: right / bottom, then centre / top - with the panel's own buttons */
    await ev(() => window.H3ThemeEdit.pick(document.getElementById("zzAlBtn"))); await p.waitForTimeout(800);
    if (await p.$("#thrNo")) { await p.click("#thrNo"); await p.waitForTimeout(200); }   // a .tmp an earlier run left: thrown away
    const ui = await ev(() => ({ al: [...document.querySelectorAll("#teAl label")].map((l) => l.textContent).join(""), va: [...document.querySelectorAll("#teVa label")].map((l) => l.textContent).join(""),
      sides: ["tePad", "teMar", "teTPad", "teTMar", "teCr"].map((k) => document.querySelectorAll(`#thEditPanel input[id^="${k}_"]`).length).join(),
      fits: (() => { const pn = document.getElementById("thEditPanel"); return pn.scrollWidth <= pn.clientWidth + 1; })() }));
    check("the Style panel: Align ⇤ ↔ ⇥ ☰ and ⤒ ↕ ⤓ (– = none), four boxes each for padding / margins (the element's and its words') and the corners - it fits the panel's width",
      ui.al === "–⇤↔⇥☰" && ui.va === "–⤒↕⤓" && ui.sides === "4,4,4,4,4" && ui.fits, ui);
    await radio("teAl", "right"); await radio("teVa", "bottom"); await p.waitForTimeout(250);
    const b1 = await at("zzAlBtn");
    const r1 = await ev(() => window.H3ThemeEdit.styles()["#zzAlBtn"]);
    check("a button: ⇥ ⤓ = its words at the bottom right (the button made a flex box for it), the rule says align right / valign bottom",
      b1.rx < 12 && b1.ry < 12 && b1.dx > b0.dx + 20 && /^btnb?$/.test(b1.al) && r1.align === "right" && r1.valign === "bottom", { b0, b1, r1 });
    await radio("teAl", "center"); await radio("teVa", "top"); await p.waitForTimeout(250);
    const b2 = await at("zzAlBtn");
    check("...↔ ⤒ = centred at the top", Math.abs(b2.dx - b2.rx) < 4 && b2.dy < 12, b2);
    await radio("teVa", ""); await p.waitForTimeout(250);
    const b3 = await at("zzAlBtn");
    check("...– = its own again (middle), no flex box any more", Math.abs(b3.dy - b3.ry) < 4 && !b3.al && !("valign" in (await ev(() => window.H3ThemeEdit.styles()["#zzAlBtn"]))), b3);

    /* 2 the words' padding / margins (the words wrapped as .h3lb), the button's padding, margins, corners */
    await setv("teTPad_l", "30"); await setv("teTMar_t", "6"); await setv("tePad_t", "3"); await p.click("#thEditPanel button[data-eq=tePad]");
    await setv("teMar_l", "15"); await setv("teCr_tl", "20"); await setv("teCr_br", "4"); await p.waitForTimeout(250);
    const sp = await ev(() => { const el = document.getElementById("zzAlBtn"), c = getComputedStyle(el), lb = el.querySelector(".h3lb"), l = lb && getComputedStyle(lb);
      return { pad: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].join(), ml: c.marginLeft, tl: c.borderTopLeftRadius, br: c.borderBottomRightRadius, tr: c.borderTopRightRadius,
        lb: l && [l.display, l.paddingLeft, l.marginTop].join(), txt: el.textContent }; });
    check("Padding T then = : all four 3 px; Margin L 15 px; Corners ↖ 20 ↘ 4 (the others its own); the words' padding-left 30 / margin-top 6 on their own box - the button's text unchanged",
      sp.pad === "3px,3px,3px,3px" && sp.ml === "15px" && sp.tl === "20px" && sp.br === "4px" && sp.tr !== "20px" && sp.lb === "inline-block,30px,6px" && sp.txt === "💾 Save me", sp);
    await shot("1-button");

    /* 3 a flex row, a flex column, a block */
    for (const id of ["zzAlRow", "zzAlCol", "zzAlBlk"]) { await ev((id) => window.H3ThemeEdit.setRule("#" + id, { align: "right", valign: "bottom" }), id); }
    await p.waitForTimeout(300);
    const row = await at("zzAlRow"), col = await at("zzAlCol"), blk = await at("zzAlBlk");
    check("⇥ ⤓ on a flex row (justify-content / align-items), a flex column (the other way round) and a block of words (text-align / align-content): bottom right in each",
      row.al === "row" && row.rx < 4 && row.ry < 4 && col.al === "col" && col.rx < 4 && col.ry < 4 && blk.rx < 4 && blk.ry < 4 && !blk.al, { row, col, blk });
    await ev(() => { const el = document.getElementById("zzAlRow"); el.innerHTML = "<b>three</b>"; });
    await ev(() => { document.getElementById("zzAlCol").removeAttribute("data-h3al"); document.getElementById("zzAlCol").appendChild(document.createElement("i")); }); await p.waitForTimeout(400);
    const again = await ev(() => document.getElementById("zzAlCol").dataset.h3al || "");
    check("...the app re-drawing it: marked again (the watcher)", again === "col", again);
    await shot("2-boxes");

    /* 4 saved with the theme: the store's cleaner keeps them */
    const kept = await ev(async () => { const post = (u, o) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
      const r = await post("/api/themes/save", { name: "zzal567", theme: { name: "zzal567", vars: { ink: "#101010" }, styles: window.H3ThemeEdit.styles() } }); if (!r.ok) return { st: r.status };
      const g = await (await fetch("/api/themes/zzal567")).json(); await post("/api/themes/delete", { name: "zzal567" }); return (g.theme || g).styles || null; });
    check("💾 the theme file keeps them (alignment, padding, margins, the words' padding, corners)",
      kept && kept["#zzAlBtn"] && kept["#zzAlBtn"].align === "center" && kept["#zzAlBtn"].pad.l === 3 && kept["#zzAlBtn"].tpad.l === 30 && kept["#zzAlBtn"].corners.tl === 20 && kept["#zzAlRow"].valign === "bottom", kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed - " + e.message);
  } finally {
    try { await ev(() => { window.H3ThemeEdit.setStyles({}); window.H3ThemeEdit.toggle(false, { force: true }); const h = document.getElementById("zzAl"); if (h) h.remove(); }); } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
