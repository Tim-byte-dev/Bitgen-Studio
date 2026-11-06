#!/usr/bin/env node
/* bitGen Studio — 2.694.0 in a REAL browser: THE SKETCHER'S ROOF FRAMING. A picked roof's 🪵 Roof framing: rafters (checked ✔ / ✗,
 * ✔ Size them), the underpurlin rule, ceiling joists, or trusses (layout); 🪵 Show framing draws them with the roof see-through.
 * Tim (verbatim): "go ahead"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.694.0 browser test did not run"); process.exit(0); }
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
      const R = PPArch.addRoom(A, PPArch.rectPts([0, 0], [8, 5]), true); const rf = PPArch.addRoof(A, [R.id], { type: "hip", pitch: 25 });
      H3PushPull.commit("roof", b0); S.T.use("select"); S.T.arch.setSel({ ak: "roof", id: rf.id }); S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(500);
    const row = (label) => ev((label) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === label); const i = r && r.querySelector("select, input"); return i ? (i.type === "checkbox" ? i.checked : i.value) : null; }, label);
    const setRow = async (label, v) => { await ev(([label, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === label); const i = r.querySelector("select, input"); if (i.type === "checkbox") { if (i.checked !== v) i.click(); } else { i.value = v; i.dispatchEvent(new Event("change")); } }, [label, v]); await p.waitForTimeout(350); };
    const checks = () => ev(() => [...document.querySelectorAll("#ppProps [data-ppcheck]")].map((d) => d.dataset.ppcheck));
    const tot = () => ev(() => { const d = document.querySelector("#ppProps [data-pproof]"); return d ? d.textContent : ""; });
    const drawn = () => ev(() => { const o = PPArch.build(H3PushPull.state.M.arch); return { frame: o.polys.filter((q) => q.tag && q.tag.ak === "roof" && q.tag.part === "frame").length, clear: o.polys.some((q) => q.layer === "roof" && q.alpha === 0.25) }; });
    check("the roof panel: 🪵 Roof framing - Rafters 140 × 45 @ 600, ceiling joists 120 × 35, both ✔, the totals (4 hip rafters)",
      (await row("Roof frame")) === "rafters" && (await row("Rafters")) === "140x45" && (await row("Rafter spacing")) === "0.6" && JSON.stringify(await checks()) === '["ok","ok"]' && /4 hip \/ valley rafters/.test(await tot()), [await checks(), await tot()]);
    check("not drawn until 🪵 Show framing", (await drawn()).frame === 0);
    await setRow("🪵 Show framing (walls see-through)", true);
    const d1 = await drawn();
    check("🪵 Show framing: the roof frame drawn, the roof see-through", d1.frame > 300 && d1.clear, d1);
    await setRow("Underpurlin when a slope runs past (0 = never) (m)", "0"); await setRow("Rafters", "70x35");
    check("no underpurlin + 70 × 35 rafters: ✗", (await checks())[0] === "no");
    await ev(() => { [...document.querySelectorAll("#ppProps button")].find((x) => /Size them/.test(x.textContent)).click(); }); await p.waitForTimeout(400);
    const fixed = await ev(() => ({ c: [...document.querySelectorAll("#ppProps [data-ppcheck]")].map((d) => d.dataset.ppcheck), r: H3PushPull.state.M.arch.roofs[0].fr.rafter }));
    check("✔ Size them: rafters big enough for the whole slope, ✔", fixed.c[0] === "ok" && fixed.r.D > 70, fixed);
    await setRow("Roof frame", "trusses");
    const t2 = await tot();
    check("Trusses: their layout (count @ spacing, the truss maker's design), no rafter checks", /trusses @ 600 mm - the truss maker designs them/.test(t2) && (await checks()).length === 0 && (await row("Truss spacing (m)")) === "0.6", t2);
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    check("…↶ back to rafters", await ev(() => H3PushPull.state.M.arch.roofs[0].fr.kind === "rafters"));
    const kept = await ev(() => { const c = PPArch.clean(JSON.parse(JSON.stringify(H3PushPull.state.M.arch))); return c.roofs[0].fr.kind === "rafters" && c.roofs[0].fr.purlin === 0; });
    check("kept through a save / load (PPArch.clean)", kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
