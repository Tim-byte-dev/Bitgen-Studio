#!/usr/bin/env node
/* bitGen Studio — 2.670.0 in a REAL browser: THE PROFILE EDITOR WITH BÉZIER CURVES - the Cove cornice is two nodes on its arc
 * (one curve); a click picks a segment; right-click ▸ Convert to curve / Convert to line; a curve's handles dragged;
 * double-click a segment = a new node; right-click a node ▸ Delete node; 💾 Save keeps the path (the project's library).
 * Tim (verbatim): "in the sketcher editors for cornice and skirting, change the arcs to bezier curves , a curved template with
 * only 2 vertices on the arc (start and finish) double click on the line adds a node, click on a segment to select the right
 * click to toggle convert to line/convert to curve in context menu"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: a picture. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.670.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_bezier670_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const st = () => ev(() => { const P = PPProfileDlg.state().p.path; return { n: P.n.length, curves: P.c.filter(Boolean).length, c: P.c, sel: PPProfileDlg.state().sel }; });
  const at = (fn) => ev(fn);                                     // a client point from the dialog's state
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPProfileDlg && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); PPArch.addRoom(A, PPArch.rectPts([0, 0], [4, 3]), { name: "Lounge" }); H3PushPull.commit("room", b0); });
    await ev(() => PPProfileDlg.open({ kind: "cornice", id: "preset:cornice-cove", A: H3PushPull.state.M.arch }));
    await p.waitForTimeout(400);
    let s = await st();
    check("the Cove cornice: 3 nodes, its arc ONE curve (only its start and finish on it)", s.n === 3 && s.curves === 1, s);
    if (process.env.H3_SHOT) await p.screenshot({ path: path.join(process.env.H3_SHOT, "bezier670-cove.png") });
    // a straight side: click = picked, right-click ▸ Convert to curve
    const li = s.c.findIndex((c) => !c);
    const mid = await ev((i) => { const P = PPProfileDlg.state().p.path, a = P.n[i], b2 = P.n[(i + 1) % P.n.length]; return PPProfileDlg.toClient([(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2]); }, li);
    await p.mouse.click(mid[0], mid[1]); await p.waitForTimeout(150);
    s = await st();
    check("a click on a straight side picks that segment", s.sel && s.sel.kind === "seg" && s.sel.i === li, s.sel);
    await p.mouse.click(mid[0], mid[1], { button: "right" }); await p.waitForTimeout(150);
    const menu = await ev(() => [...document.querySelectorAll("#ppPdMenu button")].map((x) => x.textContent));
    check("right-click on it: a menu - ◠ Convert to curve, ＋ Add a node here", menu.join("|") === "◠ Convert to curve|＋ Add a node here", menu);
    await p.click('#ppPdMenu button[data-act="toggle"]'); await p.waitForTimeout(150);
    s = await st();
    check("…Convert to curve: that side is a curve (two curves now), its two handles shown", s.curves === 2 && s.c[li] && await ev(() => document.getElementById("ppPdMenu") === null), s);
    // drag one of its handles
    const h0 = await ev((i) => PPProfileDlg.toClient(PPProfileDlg.state().p.path.c[i][0]), li), c0 = s.c[li][0];
    await p.mouse.move(h0[0], h0[1]); await p.mouse.down(); await p.mouse.move(h0[0] + 30, h0[1] - 25, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
    s = await st();
    check("…its handle dragged: the curve's shape changes (the handle moved, 1 mm grid)", s.c[li] && (s.c[li][0][0] !== c0[0] || s.c[li][0][1] !== c0[1]) && Math.abs(s.c[li][0][0] * 1000 - Math.round(s.c[li][0][0] * 1000)) < 1e-6, { was: c0, now: s.c[li][0] });
    // right-click the curve ▸ Convert to line
    const cm = await ev((i) => { const P = PPProfileDlg.state().p.path, q = PPProfile.bez(P.n[i], P.c[i][0], P.c[i][1], P.n[(i + 1) % P.n.length], 0.5); return PPProfileDlg.toClient(q); }, li);
    await p.mouse.click(cm[0], cm[1], { button: "right" }); await p.waitForTimeout(150);
    const menu2 = await ev(() => [...document.querySelectorAll("#ppPdMenu button")].map((x) => x.textContent));
    check("right-click on a curve: ╱ Convert to line", menu2[0] === "╱ Convert to line", menu2);
    await p.click('#ppPdMenu button[data-act="toggle"]'); await p.waitForTimeout(150);
    s = await st();
    check("…Convert to line: straight again (one curve - the cove's)", s.curves === 1 && s.c[li] === null, s);
    // double-click a side = a new node; right-click it ▸ Delete node
    const mid2 = await ev((i) => { const P = PPProfileDlg.state().p.path, a = P.n[i], b2 = P.n[(i + 1) % P.n.length]; return PPProfileDlg.toClient([(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2]); }, li);
    await p.mouse.dblclick(mid2[0], mid2[1]); await p.waitForTimeout(150);
    s = await st();
    check("double-click on a side: a new node there (4 nodes), picked", s.n === 4 && s.sel && s.sel.kind === "node", s);
    const nd = await ev((i) => PPProfileDlg.toClient(PPProfileDlg.state().p.path.n[i]), s.sel.i);
    await p.mouse.click(nd[0], nd[1], { button: "right" }); await p.waitForTimeout(150);
    const menu3 = await ev(() => [...document.querySelectorAll("#ppPdMenu button")].map((x) => x.textContent));
    await p.click('#ppPdMenu button[data-act="del"]'); await p.waitForTimeout(150);
    check("right-click on a node: 🗑 Delete node - gone (3 nodes)", menu3.join("|") === "🗑 Delete node" && (await st()).n === 3, menu3);
    // the cove's own curve: double-click on it = a node ON the arc, the shape kept
    const arc = await ev(() => { const P = PPProfileDlg.state().p.path, i = P.c.findIndex(Boolean); return { i, at: PPProfileDlg.toClient(PPProfile.bez(P.n[i], P.c[i][0], P.c[i][1], P.n[(i + 1) % P.n.length], 0.5)) }; });
    await p.mouse.dblclick(arc.at[0], arc.at[1]); await p.waitForTimeout(150);
    s = await st();
    const onArc = await ev((i) => { const q = PPProfileDlg.state().p.path.n[i]; return Math.abs(Math.hypot(q[0] - 0.09, q[1] - 0.09) - 0.09); }, s.sel.i);
    check("double-click on the arc: a node ON it (within 0.2 mm of the circle), two curves now", s.n === 4 && s.curves === 2 && onArc < 2e-4, { s, onArc });
    // save: the path kept in the library and the model
    await p.fill("#ppPdName", "My cove"); await p.click("#ppPdSave"); await p.waitForTimeout(700);
    const lib = await api("/api/pushpull-profiles");
    const mine = (lib.profiles || []).find((q) => q.name === "My cove");
    check("💾 Save: in the project's library WITH its path (4 nodes, 2 curves) and the flattened points", mine && mine.path && mine.path.n.length === 4 && mine.path.c.filter(Boolean).length === 2 && mine.pts.length > 20, mine && { n: mine.path && mine.path.n.length, pts: mine.pts.length });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
