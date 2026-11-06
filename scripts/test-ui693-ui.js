#!/usr/bin/env node
/* bitGen Studio — 2.693.0 in a REAL browser: THE SKETCHER'S WALL FRAMING. A picked room's 🪵 Wall framing (Frame timber / steel / none, studs,
 * spacing, noggings, braces, this room); 🪵 Show framing draws studs / plates / jambs / jacks / noggings / braces in the walls.
 * Tim (verbatim): "you choose, we will go one at a time"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.693.0 browser test did not run"); process.exit(0); }
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
      const R = PPArch.addRoom(A, PPArch.rectPts([0, 0], [6, 4]), true); PPArch.addOp(A, "window", { room: R.id, edge: 0, at: 3 }, { w: 1.8 }); PPArch.addOp(A, "door", { room: R.id, edge: 1, at: 2 });
      H3PushPull.commit("rooms", b0); S.T.use("select"); S.T.arch.setSel({ ak: "room", id: R.id }); S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(500);
    const row = (label) => ev((label) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === label); const i = r && r.querySelector("select, input"); return i ? (i.type === "checkbox" ? i.checked : i.value) : null; }, label);
    const setRow = async (label, v) => { await ev(([label, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === label); const i = r.querySelector("select, input"); if (i.type === "checkbox") { if (i.checked !== v) i.click(); } else { i.value = v; i.dispatchEvent(new Event("change")); } }, [label, v]); await p.waitForTimeout(350); };
    const frame = () => ev(() => { const o = PPArch.build(H3PushPull.state.M.arch); return o.polys.filter((q) => q.tag && q.tag.part === "frame").length; });
    const totals = () => ev(() => { const d = document.querySelector("#ppProps [data-ppframe]"); return d ? d.textContent : ""; });
    check("the room panel: 🪵 Wall framing - Timber, 90 × 35, 450 mm, noggings 1.2 m, braces, this room framed; the room's totals; sizes said to be unchecked",
      (await row("Frame")) === "timber" && (await row("Studs")) === "90x35" && (await row("Stud spacing")) === "0.45" && (await row("Frame this room's walls")) === true && /studs \(2 jamb|studs \(4 jamb/.test(await totals()) && await ev(() => /Stud sizes are NOT checked/.test(document.getElementById("ppProps").textContent)), await totals());
    check("not drawn while 🪵 Show framing is off", (await frame()) === 0);
    await setRow("🪵 Show framing (walls see-through)", true);
    const f1 = await frame();
    check("🪵 Show framing: the frame drawn in every wall", f1 > 500, f1);
    const t1 = await totals(); await setRow("Stud spacing", "0.6"); const t2 = await totals(), f2 = await frame();
    const n = (t) => +((t.match(/(\d+) studs/) || [])[1] || 0);
    check("600 mm spacing: fewer studs (the totals and the drawing)", n(t2) < n(t1) && f2 < f1, [t1, t2]);
    await setRow("Frame", "steel");
    check("Light-gauge steel: the C-section list instead of timber sizes, one top track", (await row("Steel studs")) === "c89" && (await row("Studs")) === null && await ev(() => PPStruct.wallFrames(H3PushPull.state.M.arch, H3PushPull.state.M.arch.rooms[0], PPArch.structH)[0].parts.filter((q) => q.part === "top plate").length === 1));
    await setRow("Frame this room's walls", false);
    check("this room not framed: nothing drawn for it", (await frame()) === 0 && (await totals()) === "");
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    check("…↶ framed again", (await frame()) > 0);
    const kept = await ev(() => { const c = PPArch.clean(JSON.parse(JSON.stringify(H3PushPull.state.M.arch))); return c.struct.frame === "steel" && c.struct.stud.at === 0.6 && c.struct.show; });
    check("kept through a save / load (PPArch.clean)", kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
