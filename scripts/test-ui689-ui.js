#!/usr/bin/env node
/* bitGen Studio — 2.689.0 in a REAL browser: THE SKETCHER'S 🗄 CUPBOARDS & SHELVING. The Furniture tool's "Cupboards & shelving"
 * category (the templates: built in + yours), the 🗄 dialog (a template loaded, sizes / a bay changed - the front view follows,
 * 💾 Save as template -> /api/pushpull-joinery, in every project), placed against a room's wall facing in (flush into a corner),
 * built in 3D (boards, rails, drawers), its floorplan symbol (runs, a dashed hanging rail), its panel (↔ Fit the wall, ✎ Design…
 * -> Apply = one ↶ step), kept through a save / load (PPFurn.clean).
 * Tim (verbatim): "add a shelf/cupboard dialog for builtin cupboards, walk-in robes etc. must be customizable and be able to save
 * as template"
 * Against the running app (H3_URL). No Playwright = SKIP. SHOT=<file.png> saves the dialog + the view. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.689.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const get = async (u) => (await fetch(URL_ + u.replace(/^\//, ""))).json();
const TPL = "E2E robe 689";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPJoinery && window.PPJoineryDlg && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await p.waitForFunction(() => /📂/.test((document.getElementById("ppMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); PPArch.addRoom(S.M.arch, PPArch.rectPts([0, 0], [4, 3]), true); H3PushPull.commit("room", b0); S.V.view("top"); S.V.extents(); });
    await p.waitForTimeout(400);
    // the Furniture tool - Cupboards & shelving
    await ev(() => H3PushPull.state.T.use("furniture")); await p.waitForTimeout(200);
    await ev(() => { const s = [...document.querySelectorAll("#ppProps select")].find((x) => [...x.options].some((o) => o.value === "Cupboards & shelving")); s.value = "Cupboards & shelving"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(300);
    const tpls = await ev(() => [...document.querySelectorAll("#ppJnPick button")].map((x) => x.textContent));
    check("🛋 Furniture ▸ Cupboards & shelving: the built-in templates (robes, walk-in robes U / L, linen, pantry, broom, bookshelf, shelving)",
      tpls.length >= 9 && ["Built-in robe · sliding doors", "Walk-in robe · U", "Walk-in robe · L", "Linen cupboard", "Pantry", "Bookshelf"].every((n) => tpls.includes(n)), tpls);
    // the dialog
    await ev(() => [...document.querySelectorAll("#ppProps button")].find((x) => /Design \/ change/.test(x.textContent)).click()); await p.waitForTimeout(300);
    check("🗄 Design / change… opens the dialog (templates down the side, the form, a front view + the plan)", await ev(() => document.getElementById("ppJnDlg").open && document.querySelectorAll("#ppJnList button").length >= 9 && !!document.querySelector("#ppJnElev svg") && !!document.querySelector("#ppJnPlan svg")));
    await ev(() => [...document.querySelectorAll("#ppJnList button")].find((x) => x.textContent === "Walk-in robe · U").click()); await p.waitForTimeout(200);
    const u = await ev(() => ({ layout: document.getElementById("ppJnLayout").value, tabs: [...document.querySelectorAll("#ppJnRuns button")].map((x) => x.textContent.split(" ·")[0]), side: !!document.getElementById("ppJnSide") }));
    check("…a template loaded: Walk-in robe · U - three runs (Back / Left / Right), its robe depth", u.layout === "U" && u.tabs.join() === "Back,Left,Right" && u.side, u);
    await p.fill("#ppJnW", "3000"); await p.press("#ppJnW", "Tab"); await p.waitForTimeout(150);
    const n0 = await ev(() => document.querySelectorAll("#ppJnBays tr[data-bay]").length);
    await p.click("#ppJnAdd"); await p.waitForTimeout(150);
    await ev(() => { const r = [...document.querySelectorAll("#ppJnBays tr[data-bay]")].pop(), k = r.querySelector("select.bk"); k.value = "drawers"; k.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(150);
    const ed = await ev(() => ({ w: PPJoineryDlg.state().spec.w, bays: PPJoineryDlg.state().spec.runs[0].bays.map((x) => x.kind), drawers: document.querySelectorAll("#ppJnElev .ppj-drawer").length, dim: (document.querySelector("#ppJnElev .ppj-dim") || {}).textContent }));
    check("…width 3000 mm, ＋ a bay made drawers: the design + its front view follow (drawers drawn, 3000 mm)", ed.w === 3 && ed.bays.length === n0 + 1 && ed.bays[ed.bays.length - 1] === "drawers" && ed.drawers >= 3 && /3000 ×/.test(ed.dim || ""), ed);
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT.replace(/\.png$/, "-dialog.png") });
    // save as template
    await p.fill("#ppJnTplName", TPL); await p.click("#ppJnSave");
    await p.waitForFunction((n) => [...document.querySelectorAll("#ppJnList button")].some((x) => x.textContent === n), TPL, { timeout: 8000 }).catch(() => {});
    const saved = await get("/api/pushpull-joinery"), mine = (saved.templates || []).find((t) => t.name === TPL);
    check("💾 Save as template: in /api/pushpull-joinery (U, 3 m, the drawers bay), listed under Yours", !!mine && mine.spec.layout === "U" && mine.spec.w === 3 && mine.spec.runs[0].bays.some((x) => x.kind === "drawers") && await ev((n) => [...document.querySelectorAll("#ppJnList button")].some((x) => x.textContent === n), TPL), mine);
    await p.click("#ppJnOK"); await p.waitForTimeout(300);
    const opt = await ev(() => ({ open: document.getElementById("ppJnDlg").open, name: JSON.parse(localStorage.getItem("pp.archopt")).furniture.spec.name, star: [...document.querySelectorAll("#ppJnPick button")].some((x) => /★/.test(x.textContent)) }));
    check("…Use it: the dialog closes, the Furniture tool holds it; your template is in the tool's list (★)", !opt.open && opt.name === TPL && opt.star, opt);
    // put it down: in the room, near the bottom wall
    const scr = (x, y, z) => ev(([x, y, z]) => { const S = H3PushPull.state, s = S.V.screen([x, y, z]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y, z]);
    const c1 = await scr(2.2, 0.6, 0); await p.mouse.move(c1[0], c1[1]); await p.waitForTimeout(100); await p.mouse.click(c1[0], c1[1]); await p.waitForTimeout(500);
    const it = await ev(() => { const A = H3PushPull.state.M.arch, R = A.rooms[0], x = (A.items || [])[0]; return x && { type: x.type, rot: x.rot, x: x.x, y: x.y, w: x.w, d: x.d, layout: x.spec.layout, t: R.t, against: "against" in x }; });
    check("a click inside the room by the bottom wall: the robe is put with its BACK against that wall's inside face, facing in (0°)",
      it && it.type === "joinery" && it.layout === "U" && it.rot === 0 && Math.abs((it.y - it.d / 2) - it.t / 2) < 0.01 && it.w === 3 && !it.against, it);
    const g3 = await ev(() => { let n = 0, parts = {}; H3PushPull.state.V.scene.getObjectByName("pp-furniture").traverse((o) => { if (o.isMesh) { n++; parts[o.userData.part] = 1; } }); return { n, parts: Object.keys(parts).sort() }; });
    check("…built in 3D: boards, shelves, hanging rails, drawers, plinths (one mesh each)", g3.n > 40 && ["base", "drawer", "plinth", "rail", "shelf", "side", "top"].every((k) => g3.parts.includes(k)), g3);
    const sym = await ev(() => { const A = H3PushPull.state.M.arch, o = PPPlan.symbols(A, 0, { footprint: PPFurn.footprint, label: PPFurn.label }); return { dashed: o.lines.filter((l) => l.k === "furn" && l.dash).length, solid: o.lines.filter((l) => l.k === "furn" && !l.dash).length, fills: o.fills.filter((f) => f.k === "furn").length }; });
    check("the floorplan: three run outlines (filled), the bays, the hanging rails dashed - not one box over the whole room", sym.fills === 3 && sym.dashed >= 4 && sym.solid >= 12, sym);
    // its panel: ↔ Fit the wall, ✎ Design… -> Apply
    await ev(() => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel ? 0 : 0; }); await p.waitForTimeout(100);
    const c2 = await scr(it.x - it.w / 2 + 0.3, it.y + it.d / 2 - 0.3, 1.2); await p.mouse.click(c2[0], c2[1]); await p.waitForTimeout(700);
    const pan = await ev(() => ({ head: (document.querySelector("#ppProps .pph") || {}).textContent, btns: [...document.querySelectorAll("#ppProps button")].map((x) => x.textContent) }));
    check("picked: its own panel - 🗄 the name, ✎ Design…, ↔ Fit the wall", /🗄 E2E robe 689/.test(pan.head || "") && pan.btns.includes("✎ Design…") && pan.btns.includes("↔ Fit the wall"), pan);
    await ev(() => [...document.querySelectorAll("#ppProps button")].find((x) => x.textContent === "↔ Fit the wall").click()); await p.waitForTimeout(300);
    const fit = await ev(() => { const A = H3PushPull.state.M.arch, x = A.items[0], R = A.rooms[0]; return { w: x.w, d: x.d, side: x.spec.side, t: R.t, x: x.x }; });
    check("↔ Fit the wall: as wide as the wall inside (4 m - the wall), as deep as the room (3 m - the wall), centred on it",
      Math.abs(fit.w - (4 - fit.t)) < 0.005 && Math.abs(fit.d - (3 - fit.t)) < 0.005 && Math.abs(fit.x - 2) < 0.01, fit);
    await ev(() => [...document.querySelectorAll("#ppProps button")].find((x) => x.textContent === "✎ Design…").click()); await p.waitForTimeout(300);
    await p.selectOption("#ppJnDoors", "hinged"); await p.waitForTimeout(150); await p.click("#ppJnOK"); await p.waitForTimeout(300);
    const after = await ev(() => H3PushPull.state.M.arch.items[0].spec.doors);
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    const undone = await ev(() => H3PushPull.state.M.arch.items[0].spec.doors);
    check("✎ Design… ▸ hinged doors ▸ Apply: the robe changes; ↶ one step puts it back", after === "hinged" && undone === "none", { after, undone });
    const kept = await ev(() => { const A = H3PushPull.state.M.arch, back = PPFurn.clean(JSON.parse(JSON.stringify(A.items))); return back.length === 1 && back[0].type === "joinery" && back[0].spec.name === "E2E robe 689" && back[0].spec.layout === "U"; });
    check("kept through a save / load (PPFurn.clean keeps the design)", kept);
    if (process.env.SHOT) { await ev(() => { const S = H3PushPull.state; S.V.view("iso"); S.V.extents(); }); await p.waitForTimeout(500); await p.screenshot({ path: process.env.SHOT }); }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  try { const all = await get("/api/pushpull-joinery"); for (const t of all.templates || []) if (t.name === TPL) await fetch(URL_ + "api/pushpull-joinery/" + t.id, { method: "DELETE" }); } catch { /* fine */ }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
