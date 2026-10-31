#!/usr/bin/env node
/* bitGen Studio — 2.630.0 in a REAL browser: THE HOUSE BUILDER IS GONE - 🧍 PEOPLE IN THE SKETCHER, A SAVED HOUSE BROUGHT IN AS A
 * SKETCHER MODEL (☰ File ▸ 🏠 A house from the House builder…), NO 🏠 HOUSE WINDOW / BUTTON LEFT.
 * Tim: "add the furniture pack and asset pack from homebuilder to sketcher and delete homeluilder ext and docker ..."
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.630.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_house630_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN });
    await api("/api/projects/load", { name: PN });
    // a house the House builder saved before it went (its route still reads them)
    const ex = await (async () => { const H = require(path.join(__dirname, "..", "static", "housegeo.js")); const m = H.example(); m.name = "Beach house 630"; return m; })();
    const sv = await (await fetch(URL_ + "api/house", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(ex) })).json();
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPImport && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const gone = await ev(() => ({ h3: typeof window.H3House, sf: !!(window.SecFloat && SecFloat.windows && SecFloat.windows.house), btn: [...document.querySelectorAll("#statusbar button")].some((x) => /House/.test(x.textContent)), geo: !!window.H3HouseGeo }));
    check("the 🏠 House builder is gone - no window, no status-bar button (its geometry stays for the Sketcher)", gone.h3 === "undefined" && !gone.sf && !gone.btn && gone.geo, gone);
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A, null, { timeout: 40000 });
    await p.waitForTimeout(400);

    /* ☰ File ▸ 🏠 A house from the House builder… */
    await p.click("#ppFile"); await p.waitForTimeout(150);
    await ev(() => [...document.querySelectorAll(".ppmenu div")].find((d) => /A house from the House builder/.test(d.textContent)).click());
    await p.waitForTimeout(600);
    const listed = await ev(() => [...document.querySelectorAll(".ppmenu div")].map((d) => d.textContent));
    await ev(() => { const x = [...document.querySelectorAll(".ppmenu div")].find((d) => /Beach house 630/.test(d.textContent)); if (x) x.click(); });
    await p.waitForFunction(() => /Beach house 630/.test(document.getElementById("ppName").value) && H3PushPull.state.M.arch && H3PushPull.state.M.arch.rooms.length > 0, null, { timeout: 15000 }).catch(() => {});
    const im = await ev(() => { const S = H3PushPull.state, A = S.M.arch; return { name: document.getElementById("ppName").value, rooms: A.rooms.length, ops: A.ops.length, items: A.items.length, cams: A.cams.length, polys: S.A.built ? S.A.built.polys.length : 0, msg: document.getElementById("ppMsg").textContent }; });
    check("☰ File ▸ 🏠 A house from the House builder…: the project's houses listed; one becomes a Sketcher model - its rooms, doors / windows, furniture, cameras", sv.slug && listed.some((t) => /Beach house 630/.test(t)) && /Beach house 630/.test(im.name) && im.rooms === ex.rooms.length && im.ops === ex.openings.length && im.items === ex.items.length && im.cams === (ex.cameras || []).length && im.polys > 50, { listed, im });
    const saved = await api("/api/pushpull/" + encodeURIComponent(im.name));
    check("…kept as a Sketcher model of the project", saved && saved.model && saved.model.arch && saved.model.arch.rooms.length === ex.rooms.length, saved && saved.model && Object.keys(saved.model));

    /* 🧍 People */
    await ev(() => { const S = H3PushPull.state; S.V.view("top"); S.V.extents(); });
    await p.keyboard.press("a"); await p.waitForTimeout(150);
    await ev(() => { const s = [...document.querySelectorAll("#ppProps select")][0]; s.value = "People"; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(150);
    const poses = await ev(() => [...document.querySelectorAll("#ppProps button[data-pose]")].map((x) => x.dataset.pose));
    await ev(() => document.querySelector('#ppProps button[data-pose="wave"]').click());
    const R0 = await ev(() => { const R = H3PushPull.state.M.arch.rooms.find((x) => x.closed); const c = R.pts.reduce((a, q) => [a[0] + q[0] / R.pts.length, a[1] + q[1] / R.pts.length], [0, 0]); return { c, z: R.z }; });
    { const [x, y] = await ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [R0.c[0], R0.c[1], R0.z]); await p.mouse.move(x, y, { steps: 3 }); await p.mouse.click(x, y); await p.waitForTimeout(300); }
    const pe = await ev(() => { const A = H3PushPull.state.M.arch, it = A.items.find((x) => x.type === "person"); const f = H3PushPull.state.V.scene.getObjectByName("pp-furniture"); return { it, drawn: !!f && f.children.some((g) => g.userData.tag.id === (it && it.id) && g.children.length >= 1) }; });
    check("🛋 ▸ People: the poses (standing, sitting, walking, waving); a waving person placed on the room's floor, drawn as a mannequin", poses.join() === "stand,sit,walk,wave" && pe.it && pe.it.pose === "wave" && near(pe.it.z, R0.z) && pe.drawn, { poses, pe });
    await p.keyboard.press(" "); await p.waitForTimeout(100);
    const pn = await ev((id) => { H3PushPull.state.T.arch.setSel({ ak: "item", id }); return document.getElementById("ppProps").textContent; }, pe.it && pe.it.id);
    check("…picked: its panel - Name, Pose, Height", /🧍/.test(pn) && /Name/.test(pn) && /Pose/.test(pn) && /Height/.test(pn), pn.slice(0, 160));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { if (H3PushPullFrame.maxed()) H3PushPullFrame.toggleMaxed(false); }); } catch { /* fine */ }
    await b.close();
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
