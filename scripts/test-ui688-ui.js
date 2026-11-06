#!/usr/bin/env node
/* bitGen Studio — 2.688.0 in a REAL browser: FOUR SKETCHER CHANGES.
 *   1 the top bar (☰ File … toolstrip) always on screen: docked, a focus low in the docker no longer scrolls it away
 *   2 a click on a wall's END piece = the whole wall; a double-click on it = push / pull - a drag moves the wall's end
 *     along the wall (one ↶ step); the wall's panel reaches the end's own width
 *   3 Ctrl+drag = held to horizontal or vertical (the way it goes); Ctrl+click still adds to the picked
 *   4 ✨ Photo's prompt names only what is in the model (no windows = no "window" / "glass")
 * Tim (verbatim): "when scrolling keep the top menubar/toolstrip from scrolling - it should always be visible. if user clicks
 * on an end segment of a wall treat it as the whole wall, if the user doubleclicks the edge segment then push/pull from that
 * segment. ctrl +drag will snap to horizontal or vertical depending on which way it is dragged. only add the objects in the
 * scene to the photo generate - for example if there aren't any windows don't add windows to the prompt"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.688.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  let sentPrompt = null;
  await p.route("**/api/aiedit/engines", async (r) => { let j = {}; try { j = await (await r.fetch()).json(); } catch (e) { j = {}; } j.edit = [{ id: "st_e2e688", name: "E2E edit" }]; await r.fulfill({ json: j }); });   // the image editor reads it too
  await p.route("**/api/aiedit", async (r) => { const body = r.request().postDataBuffer().toString("utf8"); const m = /name="prompt"\r\n\r\n([\s\S]*?)\r\n--/.exec(body); sentPrompt = m ? m[1] : null; await r.fulfill({ json: { jobs: [{ id: "e2e688_job" }] } }); });
  await p.route("**/api/jobs/e2e688_job", (r) => r.fulfill({ json: { status: "failed", error: "e2e stub" } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock"); if (d.classList.contains("maxed")) H3PushPullFrame.toggleMaxed(false); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await p.waitForFunction(() => /📂/.test((document.getElementById("ppMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    // 1 docked: focus low in the docker - the bar stays on screen, the docker is never scrolled
    const bar = () => ev(() => { const d = document.getElementById("pushpulldock"), r = d.getBoundingClientRect(), br = document.getElementById("ppBar").getBoundingClientRect(); return { scroll: d.scrollTop + document.getElementById("ppBody").scrollTop, top: Math.round(br.top), dTop: Math.round(r.top), dBot: Math.round(r.bottom), maxed: d.classList.contains("maxed") }; });
    await ev(() => { const f = document.getElementById("ppFoot"); const x = f && f.querySelector("input,button,select"); if (x) x.focus(); });
    await p.waitForTimeout(200);
    const b1 = await bar();
    check("docked: focus in the docker's foot - the docker is not scrolled, the top bar still on screen inside it", !b1.maxed && b1.scroll === 0 && b1.top >= b1.dTop && b1.top < b1.dBot, b1);
    await ev(() => { document.getElementById("pushpulldock").scrollTop = 400; });
    check("…the docker cannot be scrolled at all (clipped)", (await ev(() => document.getElementById("pushpulldock").scrollTop)) === 0);
    // maximized from here on (the room in view)
    await ev(() => { localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); }); await p.waitForTimeout(600);
    const scr = (x, y, z) => ev(([x, y, z]) => { const S = H3PushPull.state, s = S.V.screen([x, y, z]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y, z]);
    // 2 a free wall 0,0 -> 4,0 (an end piece at each end)
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); PPArch.addRoom(S.M.arch, [[0, 0], [4, 0]], { closed: false }); H3PushPull.commit("wall", b0); S.T.use("select"); S.V.view("top"); S.V.extents(); });
    await p.waitForTimeout(500);
    const W = await ev(() => { const R = H3PushPull.state.M.arch.rooms[0]; return { t: R.t, h: R.h, z: R.z, ends: PPArch.joints(R).filter((j) => j.kind === "end").map((j) => ({ k: j.k, out: j.out })) }; });
    const endPt = [4 + W.t * 0.25, 0, W.z + W.h];
    let e1 = await scr(...endPt); await p.mouse.click(e1[0], e1[1]); await p.waitForTimeout(900);
    e1 = await scr(...endPt); await p.mouse.click(e1[0], e1[1]); await p.waitForTimeout(900);
    const sel = await ev(() => ({ s: H3PushPull.state.T.arch.sel(), head: (document.querySelector("#ppProps .pph") || {}).textContent, ends: [...document.querySelectorAll("#ppProps button")].map((x) => x.textContent).filter((t) => /end's width/.test(t)) }));
    check("a click on the wall's END piece picks the WHOLE wall (its panel), not the end piece", W.ends.length === 2 && sel.s && sel.s.ak === "room" && sel.s.part === "wall" && sel.s.edge === 0 && /Wall 1/.test(sel.head || ""), { W, sel });
    check("…the wall's panel reaches each end's own width (▪ Start / Far end's width…)", sel.ends.length === 2, sel.ends);
    e1 = await scr(...endPt); await p.mouse.dblclick(e1[0], e1[1]); await p.waitForTimeout(400);
    const armed = await ev(() => ({ msg: document.getElementById("ppMsg").textContent, n: H3PushPull.state.M.arch.rooms[0].pts.length }));
    check("double-click the end piece: push / pull armed (said), the wall NOT split", /push \/ pull/.test(armed.msg) && armed.n === 2, armed);
    e1 = await scr(...endPt); const e2 = await scr(endPt[0] + 1, 0, endPt[2]);
    await p.mouse.move(e1[0], e1[1]); await p.mouse.down(); await p.mouse.move(e1[0] + 6, e1[1] + 1, { steps: 2 }); await p.mouse.move(e2[0], e2[1] + 30, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
    const pulled = await ev(() => H3PushPull.state.M.arch.rooms[0].pts.map((q) => q.map((v) => +v.toFixed(3))));
    check("…dragged 1 m out (and off to one side): the end moved ALONG the wall only - 4 m -> 5 m, still straight", Math.abs(pulled[1][0] - 5) < 0.03 && pulled[1][1] === 0 && pulled[0][0] === 0, pulled);
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    check("…↶ one step: back to 4 m", (await ev(() => H3PushPull.state.M.arch.rooms[0].pts[1][0])) === 4);
    await ev(() => { document.getElementById("ppView").focus(); }); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    // 3 Ctrl+drag a piece of furniture diagonally = only along x; Ctrl+click another = added
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); const A = S.M.arch; A.items = [[2, 2], [6, 2]].map((q) => Object.assign(PPFurn.make("armchair", q, 0, 0), { id: A.n++ })); H3PushPull.commit("items", b0); S.T.use("select"); S.V.view("top"); S.V.extents(); });
    await p.waitForTimeout(600);
    const ids = await ev(() => H3PushPull.state.M.arch.items.map((x) => x.id));
    const c1 = await scr(2, 2, 0.4), c2 = await scr(3.2, 2.4, 0.4);
    await p.keyboard.down("Control"); await p.mouse.move(c1[0], c1[1]); await p.mouse.down(); await p.mouse.move(c1[0] + 8, c1[1] + 2, { steps: 2 }); await p.mouse.move(c2[0], c2[1], { steps: 10 }); await p.mouse.up(); await p.keyboard.up("Control");
    await p.waitForTimeout(400);
    const it = await ev(() => H3PushPull.state.M.arch.items.map((x) => [+x.x.toFixed(2), +x.y.toFixed(2)]));
    check("Ctrl+drag a piece 1.2 m across and 0.4 m up: held HORIZONTAL - it moved along x only", Math.abs(it[0][0] - 3.2) < 0.15 && it[0][1] === 2 && it[1][0] === 6, it);
    const c3 = await scr(...it[0], 0.4), c4 = await scr(6, 2, 0.4);
    await p.mouse.click(c3[0], c3[1]); await p.waitForTimeout(700);
    await p.keyboard.down("Control"); await p.mouse.click(c4[0], c4[1]); await p.keyboard.up("Control"); await p.waitForTimeout(300);
    const both = await ev(() => H3PushPull.state.T.arch.picked().map((x) => x.id));
    check("Ctrl+click (no drag) still adds to the picked: both pieces picked", both.length === 2 && ids.every((id) => both.includes(id)), both);
    const c5 = await scr(6, 2, 0.4), c6 = await scr(6.3, 3.5, 0.4);
    await p.mouse.click(c5[0], c5[1]); await p.waitForTimeout(700);
    await p.keyboard.down("Control"); await p.mouse.move(c5[0], c5[1]); await p.mouse.down(); await p.mouse.move(c5[0] + 1, c5[1] - 8, { steps: 2 }); await p.mouse.move(c6[0], c6[1], { steps: 10 }); await p.mouse.up(); await p.keyboard.up("Control");
    await p.waitForTimeout(400);
    const it2 = await ev(() => H3PushPull.state.M.arch.items.map((x) => [+x.x.toFixed(2), +x.y.toFixed(2)]));
    check("…Ctrl+drag mostly up: held VERTICAL - along y only", it2[1][0] === 6 && Math.abs(it2[1][1] - 3.5) < 0.15, it2);
    // 4 the photo prompt: a room with a door and no windows
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); PPArch.addRoom(S.M.arch, PPArch.rectPts([0, 0], [5, 4]), true); const R = S.M.arch.rooms[0]; PPArch.addOp(S.M.arch, "door", { room: R.id, edge: 0, at: 2.5 }); S.M.arch.items = [Object.assign(PPFurn.make("armchair", [2, 2], 0, 0), { id: S.M.arch.n++ })]; H3PushPull.commit("room", b0); S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(500);
    await ev(() => { const st = document.getElementById("styleSel"); if (st && ![...st.options].some((o) => o.value === "st_e2e688")) { const o = document.createElement("option"); o.value = "st_e2e688"; o.textContent = "E2E edit"; st.appendChild(o); } if (st) st.value = "st_e2e688"; });
    const runErr = await ev(() => H3SketcherReal.run("").then(() => "", (e) => String(e && e.stack || e))); await p.waitForTimeout(1500);
    if (runErr) console.log("      (run: " + runErr.slice(0, 300) + ")");
    if (!sentPrompt) console.log("      (the Sketcher said: " + await ev(() => document.getElementById("ppMsg").textContent) + ")");
    check("✨ Photo's prompt: the room, its door and the armchair - and no window / glass (the model has none)",
      !!sentPrompt && /a building with a room with walls/.test(sentPrompt) && /a door/.test(sentPrompt) && /armchair/i.test(sentPrompt) && !/window|glass/i.test(sentPrompt) && /add nothing else/.test(sentPrompt), sentPrompt);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
