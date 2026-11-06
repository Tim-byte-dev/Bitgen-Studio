#!/usr/bin/env node
/* bitGen Studio — 2.695.0 in a REAL browser: ROOF COVERINGS. A picked roof's Covering (pre-painted steel corrugated / ribbed /
 * standing seam, concrete / terracotta tiles, slate, shingles, polycarbonate): its colour + pattern on the roof, the minimum
 * pitch note (⚠ when too flat), the framing checks by its weight, kept by a save.
 * Tim (verbatim): "can we add roof material types like colourbond, concrete tiles , etc"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.695.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPArch && window.PPStruct && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await p.waitForFunction(() => /📂/.test((document.getElementById("ppMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); S.M.f = []; S.M.v = []; S.M.e = []; const A = S.M.arch;
      const R = PPArch.addRoom(A, PPArch.rectPts([0, 0], [8, 5]), true); const rf = PPArch.addRoof(A, [R.id], { type: "gable", pitch: 15 });
      H3PushPull.commit("roof", b0); S.T.use("select"); S.T.arch.setSel({ ak: "roof", id: rf.id }); S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(500);
    const row = (label) => ev((label) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === label); const i = r && r.querySelector("select, input"); return i ? i.value : null; }, label);
    const opts = () => ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === "Covering"); return r ? [...r.querySelectorAll("option")].map((o) => o.textContent) : []; });
    const setRow = async (label, v) => { await ev(([label, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === label); const i = r.querySelector("select, input"); i.value = v; i.dispatchEvent(new Event("change")); }, [label, v]); await p.waitForTimeout(350); };
    const look = () => ev(() => { const o = PPArch.build(H3PushPull.state.M.arch); return { col: (o.polys.find((q) => q.tag && q.tag.ak === "roof") || {}).col, lines: o.roofLines.length }; });
    const note = () => ev(() => { const d = document.querySelector("#ppProps [data-pproofmat]"); return d ? d.dataset.pproofmat + " " + d.textContent : ""; });
    const o0 = await opts(), l0 = await look();
    check("the roof panel's Covering: not set, + the 8 coverings by their generic names (pre-painted steel …, no brand names)", (await row("Covering")) === "" && o0.length === 9 && o0.some((t) => /Pre-painted steel - corrugated/.test(t)) && o0.some((t) => /Terracotta tiles/.test(t)) && !o0.some((t) => /colou?rbond/i.test(t)), o0);
    await setRow("Covering", "steel-corr");
    const l1 = await look(), n1 = await note();
    check("corrugated pre-painted steel: its colour on the roof + ribs down the slope; 15° is fine for it (✔ typical minimum 5°)", l1.col === "#5c6166" && l1.lines > l0.lines + 50 && /^ok ✔ .*5°/.test(n1), [l1, n1]);
    await setRow("Covering", "tile-terracotta");
    const l2 = await look(), n2 = await note();
    check("terracotta tiles at 15°: ⚠ usually needs at least 20° (check the maker's); its colour + tile courses", l2.col === "#b0562f" && l2.lines > l1.lines && /^low ⚠ Terracotta tiles usually needs at least 20° - this roof is 15°/.test(n2) && /Check the maker's minimum/.test(n2), [l2, n2]);
    const ut = await ev(() => { const A = H3PushPull.state.M.arch; return [PPStruct.roofFrames(A, A.roofs[0], PPArch.structH).checks.rafter.util, PPStruct.roofFrames(A, Object.assign({}, A.roofs[0], { mat: "steel-corr" }), PPArch.structH).checks.rafter.util]; });
    check("the rafter check carries the tiles' weight (more of its limit than under steel)", ut[0] > ut[1] * 1.5, ut);
    await setRow("Pitch (°)", "25");
    check("pitched up to 25°: ✔", /^ok/.test(await note()));
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    check("…↶ back to 15° (⚠ again)", await ev(() => H3PushPull.state.M.arch.roofs[0].pitch === 15));
    const kept = await ev(() => PPArch.clean(JSON.parse(JSON.stringify(H3PushPull.state.M.arch))).roofs[0].mat === "tile-terracotta");
    check("kept through a save / load (PPArch.clean)", kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
