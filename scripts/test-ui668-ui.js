#!/usr/bin/env node
/* bitGen Studio — 2.668.0 in a REAL browser: THE SKETCHER'S EAVES, FASCIAS, GUTTERS - a roof from the Roof tool has boxed eaves,
 * a fascia and quad gutters with downpipes; the picked roof's panel shows the eaves as pictures (Simple / Open / Boxed /
 * Closed), Fascia + barge boards, Fascia height, Gutters, Downpipes and their colours. H3_SHOT=<dir>: close-ups.
 * Tim (verbatim): "please add eaves and eave styles to sketcher like open eaves, boxed eaves,closed eaves, and facias and gutters"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.668.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_eaves668_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const set = (label, v) => ev(([l, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent.startsWith(l)); const i = r.querySelector("input,select"); if (i.type === "checkbox") i.checked = !!v; else i.value = String(v); i.dispatchEvent(new Event("change")); }, [label, v]);
  const parts = () => ev(() => { const c = {}; PPArch.build(H3PushPull.state.M.arch).polys.forEach((q) => { if (q.tag && q.tag.ak === "roof" && q.tag.part) c[q.tag.part] = (c[q.tag.part] || 0) + 1; }); return c; });
  const pickRoof = () => ev(() => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel({ ak: "roof", id: S.M.arch.roofs[0].id }); S.T.arch.props(); });
  const shot = async (name) => { if (!process.env.H3_SHOT) return; await ev(() => { const S = H3PushPull.state; S.T.arch.setSel(null); const n = [0.35, -0.75, -0.56], L = Math.hypot(...n); S.V.lookAlong(n.map((x) => x / L), [7.2, -0.2, 2.55], 2.6); }); await p.waitForTimeout(400); await p.screenshot({ path: path.join(process.env.H3_SHOT, "eave668-" + name + ".png"), clip: { x: 300, y: 100, width: 1000, height: 820 } }); await pickRoof(); };
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), localStorage.removeItem("pp.archopt"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); PPArch.addRoom(A, PPArch.rectPts([0, 0], [8, 5]), { name: "Hall" }); H3PushPull.commit("room", b0); S.T.use("roof"); });
    await p.waitForTimeout(250);
    const tp = await ev(() => [...document.querySelectorAll("#ppProps .ppeaves button")].map((x) => ({ t: x.dataset.eave, on: x.classList.contains("on"), svg: !!x.querySelector("svg") })));
    check("the Roof tool's panel: the eaves as four pictures - Simple, Open, Boxed (on), Closed", tp.map((x) => x.t).join() === "plain,open,boxed,closed" && tp.every((x) => x.svg) && tp.find((x) => x.on).t === "boxed", tp);
    const c = await ev(() => { const S = H3PushPull.state, s = S.V.screen([4, 2.5, 0]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; });
    await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.click(c[0], c[1]); await p.waitForTimeout(500);
    const rf = await ev(() => { const r = H3PushPull.state.M.arch.roofs[0]; return r && { eave: r.eave, fascia: r.fascia, gutter: r.gutter, downpipes: r.downpipes }; });
    const p1 = await parts();
    check("a roof from the Roof tool: boxed eaves, a fascia, quad gutters, downpipes - all built", rf && rf.eave === "boxed" && rf.fascia && rf.gutter === "quad" && rf.downpipes && p1.soffit > 0 && p1.fascia > 0 && p1.gutter > 0 && p1.downpipe > 0, { rf, p1 });
    await pickRoof(); await p.waitForTimeout(200);
    const lab = await ev(() => [...document.querySelectorAll("#ppProps .ppr > span")].map((s) => s.textContent));
    check("the picked roof's panel: Eaves, Fascia + barge boards, Fascia height, Gutters, Downpipes, Fascia / soffit colour, Gutter colour", ["Eaves", "Fascia + barge boards", "Fascia height", "Gutters", "Downpipes", "Fascia / soffit colour", "Gutter colour"].every((l) => lab.some((x) => x.startsWith(l))), lab);
    await shot("boxed");
    await ev(() => document.querySelector('#ppProps .ppeaves button[data-eave="open"]').click()); await p.waitForTimeout(250);
    const p2 = await parts();
    check("Open: rafter tails, no soffit", p2.rafter > 0 && !p2.soffit, p2);
    await shot("open");
    await ev(() => document.querySelector('#ppProps .ppeaves button[data-eave="closed"]').click()); await p.waitForTimeout(250);
    check("Closed: a lining on the slope (a soffit), no rafters", await ev(() => { const B = PPArch.build(H3PushPull.state.M.arch).polys.filter((q) => q.tag && q.tag.part === "soffit" && q.n[2] > 0.5); return B.length > 0 && B.every((q) => { const z = q.rings[0].map((v) => v[2]); return Math.max(...z) - Math.min(...z) > 0.1; }); }) && !(await parts()).rafter);
    await shot("closed");
    await set("Gutters", "half"); await p.waitForTimeout(200); await set("Downpipes", false); await p.waitForTimeout(200);
    const p3 = await parts();
    check("Gutters: Half round, Downpipes off", (await ev(() => H3PushPull.state.M.arch.roofs[0].gutter)) === "half" && p3.gutter > 20 && !p3.downpipe, p3);
    await set("Fascia + barge boards", false); await p.waitForTimeout(200);
    check("Fascia off: no fascia boards", !(await parts()).fascia);
    await ev(() => H3PushPull.undo()); await p.waitForTimeout(250);
    check("↶ one undo step: the fascia back", (await parts()).fascia > 0);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
