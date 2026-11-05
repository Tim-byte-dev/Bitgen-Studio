#!/usr/bin/env node
/* bitGen Studio — 2.664.0 in a REAL browser: THE MANNEQUIN MODEL (dimasalcalde / zahers, CGTrader) - placed from Furniture ▸
 * People ▸ mannequin (model), built from ext/pushpulldock/assets/mannequin-female.json at the person's height; credited in
 * Settings ▸ About. Without the file (it is not in the public repo): SKIP of the model checks.
 * Tim (verbatim): "can you use these models for our mannequins - and give credit to ... dimasalcalde ... and ... zahers"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: a picture. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.664.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_mq664_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const scrG = (x, y) => ev(([x, y]) => { const S = H3PushPull.state, t = S.M.arch.terrain, z = t ? PPTerrain.at(t, x, y) : 0, s = S.V.screen([x, y, z]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y]);
  const setNum = (label, v) => ev(([l, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === l); const i = r.querySelector("input,select"); i.value = String(v); i.dispatchEvent(new Event("change")); }, [label, v]);
  try {
    const has = (await fetch(URL_ + "ext/pushpulldock/assets/mannequin-female.json")).ok;
    const ab = await api("/api/about");
    const sec = (ab.sections || []).find((s) => s.title === "3D models");
    check("Settings ▸ About's credits: 3D models - dimasalcalde and zahers on CGTrader (their links)", sec && sec.items.some((i) => /cgtrader\.com\/designers\/dimasalcalde/.test(i.url)) && sec.items.some((i) => /cgtrader\.com\/designers\/zahers/.test(i.url)), sec);
    if (!has) { console.log("SKIP: ext/pushpulldock/assets/mannequin-female.json is not here (it ships apart) - the model checks did not run"); }
    else {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPFurn && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); PPArch.addRoom(A, PPArch.rectPts([0, 0], [4, 3]), true); H3PushPull.commit("room", b0); S.T.use("furniture"); });
    await p.waitForTimeout(200);
    await setNum("Category", "People"); await p.waitForTimeout(200);
    const btn = await ev(() => { const b = document.querySelector('#ppProps button[data-pose="mannequin"]'); return b && b.textContent; });
    check("Furniture ▸ People: 🧍 mannequin (model) among the poses", btn === "🧍 mannequin (model)", btn);
    await ev(() => document.querySelector('#ppProps button[data-pose="mannequin"]').click()); await p.waitForTimeout(150);
    const c = await ev(() => { const S = H3PushPull.state, s = S.V.screen([2, 1.5, 0]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; });
    await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.click(c[0], c[1]); await p.waitForTimeout(800);
    const it = await ev(() => { const A = H3PushPull.state.M.arch, x = (A.items || [])[0]; return x && { type: x.type, pose: x.pose, h: x.h, label: PPFurn.label(x) }; });
    check("…clicked in the room: a person, pose mannequin (its label says so)", it && it.type === "person" && it.pose === "mannequin" && /mannequin \(model\)/.test(it.label), it);
    await p.waitForFunction(() => PPFurn.hasMannequin(), null, { timeout: 10000 }).catch(() => {});
    const g = await ev(() => { const A = H3PushPull.state.M.arch, x = A.items[0], P = PPFurn.parts(H3PushPull.state.V.T, x); const b = P[0].g; b.computeBoundingBox(); const bb = b.boundingBox; return { n: P.length, tris: b.index.count / 3, h: +(bb.max.z - bb.min.z).toFixed(3), z0: +bb.min.z.toFixed(3) }; });
    check("…built from the model: one mesh of its ~6000 triangles, the person's height (1.75 m), feet on the floor", g.n === 1 && g.tris > 5000 && Math.abs(g.h - 1.75) < 0.01 && Math.abs(g.z0) < 0.01, g);
    if (process.env.H3_SHOT) { await ev(() => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel(null); S.M.arch.hide = ["room:" + S.M.arch.rooms[0].id]; S.A.rebuild(); S.V.view("front"); S.V.frameBox({ min: [1.4, 1, 0], max: [2.6, 2, 1.9] }); }); await p.waitForTimeout(500); await p.screenshot({ path: path.join(process.env.H3_SHOT, "mq664.png") }); }
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
