#!/usr/bin/env node
/* bitGen Studio — 2.671.0 in a REAL browser: THE GUTTER PROFILE EDITOR - a picked roof's panel: Gutters (the built-in ones),
 * Gutter profile (pictures), ✎ Gutter profiles… = the profile editor for kind Gutter (the same Bézier editing as the skirting /
 * cornice: double-click = a node, right-click ▸ Convert to curve); 💾 Save = the roof's gutter is that profile (the model's
 * own copy, its curves kept), built round the roof.
 * Tim (verbatim): "create an editor for gutter profile in the same way,"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: pictures. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.671.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_gutter671_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const roof = () => ev(() => { const r = H3PushPull.state.M.arch.roofs[0]; return { gutter: r.gutter, gutterP: r.gutterP }; });
  const gutters = () => ev(() => PPArch.build(H3PushPull.state.M.arch).polys.filter((q) => q.tag && q.tag.part === "gutter").length);
  const pickRoof = () => ev(() => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel({ ak: "roof", id: S.M.arch.roofs[0].id }); S.T.arch.props(); });
  const labels = () => ev(() => [...document.querySelectorAll("#ppProps .ppr > span")].map((s) => s.textContent));
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPProfileDlg && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), localStorage.removeItem("pp.archopt"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); const R = PPArch.addRoom(A, PPArch.rectPts([0, 0], [8, 5]), { name: "Hall" }); PPArch.addRoof(A, [R.id], { type: "gable", pitch: 30, over: 0.45, eave: "boxed", fascia: true, gutter: "quad" }); H3PushPull.commit("room", b0); });
    await pickRoof(); await p.waitForTimeout(250);
    const opts = await ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === "Gutters"); return [...r.querySelectorAll("option")].map((o) => o.textContent); });
    check("the roof's Gutters: None, Quad (box), Half round, OG (ogee front), Square line (deep)", opts.join("|") === "None|Quad (box)|Half round|OG (ogee front)|Square line (deep)", opts);
    const lab = await labels();
    check("…a Gutter profile row (the picture dropdown) and ✎ Gutter profiles…", lab.includes("Gutter profile") && await ev(() => !!document.querySelector('#ppProps .ppprof[data-kind="gutter"] .ppprof-btn svg') && [...document.querySelectorAll("#ppProps button")].some((x) => x.textContent === "✎ Gutter profiles…")), lab);
    // pick OG from the pictures
    await p.click('#ppProps .ppprof[data-kind="gutter"] .ppprof-btn'); await p.waitForTimeout(200);
    const lst = await ev(() => [...document.querySelectorAll('.ppprof-list[data-kind="gutter"] .ppprof-opt')].map((x) => x.dataset.id));
    check("its list: the four built-in gutters as pictures", lst.join() === "preset:gutter-quad,preset:gutter-half,preset:gutter-ogee,preset:gutter-square", lst);
    await p.click('.ppprof-list[data-kind="gutter"] .ppprof-opt[data-id="preset:gutter-ogee"]'); await p.waitForTimeout(250);
    check("picked OG: the roof's gutter is OG, built (its curved front)", (await roof()).gutter === "ogee" && (await gutters()) > 20, [await roof(), await gutters()]);
    // the editor
    await ev(() => [...document.querySelectorAll("#ppProps button")].find((x) => x.textContent === "✎ Gutter profiles…").click()); await p.waitForTimeout(400);
    const dk = await ev(() => ({ open: document.getElementById("ppProfDlg").open, kind: document.getElementById("ppPdKind").value, sub: document.querySelector("#ppProfDlg .pppd-sub").textContent, n: PPProfileDlg.state().p.path.n.length, c: PPProfileDlg.state().p.path.c.filter(Boolean).length }));
    check("✎ Gutter profiles…: the profile editor, kind Gutter, OG open in it (10 nodes, 2 curves)", dk.open && dk.kind === "gutter" && /^Gutter · x out from the fascia, y up from its bottom/.test(dk.sub) && dk.n === 10 && dk.c === 2, dk);
    if (process.env.H3_SHOT) await p.screenshot({ path: path.join(process.env.H3_SHOT, "gutter671-editor.png") });
    // the bottom (a straight side): right-click ▸ Convert to curve; double-click the back = a new node
    const seg = (i) => ev((i) => { const P = PPProfileDlg.state().p.path, a = P.n[i], c = P.n[(i + 1) % P.n.length]; return PPProfileDlg.toClient([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]); }, i);
    const bot = await ev(() => { const P = PPProfileDlg.state().p.path; return P.n.findIndex((q, i) => { const r = P.n[(i + 1) % P.n.length]; return !P.c[i] && Math.abs(q[1]) < 1e-9 && Math.abs(r[1]) < 1e-9; }); });
    const m1 = await seg(bot);
    await p.mouse.click(m1[0], m1[1], { button: "right" }); await p.waitForTimeout(150);
    await p.click('#ppPdMenu button[data-act="toggle"]'); await p.waitForTimeout(150);
    check("right-click the bottom ▸ Convert to curve: three curves", await ev(() => PPProfileDlg.state().p.path.c.filter(Boolean).length) === 3);
    const m2 = await seg(0);
    await p.mouse.dblclick(m2[0], m2[1]); await p.waitForTimeout(150);
    check("double-click the back: a node there (11)", await ev(() => PPProfileDlg.state().p.path.n.length) === 11);
    await p.fill("#ppPdName", "My OG"); await p.click("#ppPdSave"); await p.waitForTimeout(800);
    const r2 = await roof(), own = await ev((id) => { const q = (H3PushPull.state.M.arch.profiles || []).find((x) => x.id === id); return q && { kind: q.kind, n: q.path && q.path.n.length, c: q.path && q.path.c.filter(Boolean).length }; }, r2.gutterP);
    check("💾 Save: the roof's gutter = My OG (custom), the model's copy WITH its curves (11 nodes, 3 curves)", r2.gutter === "custom" && own && own.kind === "gutter" && own.n === 11 && own.c === 3, { r2, own });
    const lib = await api("/api/pushpull-profiles");
    check("…in the project's library as a gutter", (lib.profiles || []).some((q) => q.name === "My OG" && q.kind === "gutter" && q.path));
    await ev(() => { const d = document.getElementById("ppProfDlg"); if (d.open) d.close(); }); await pickRoof(); await p.waitForTimeout(250);
    const gsel = await ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === "Gutters"); return r.querySelector("select").selectedOptions[0].textContent; });
    check("the panel: Gutters shows My OG, the picture dropdown too; built round the roof", gsel === "My OG" && await ev(() => document.querySelector('#ppProps .ppprof[data-kind="gutter"] .ppprof-name').textContent) === "My OG" && (await gutters()) > 20, gsel);
    if (process.env.H3_SHOT) { await ev(() => { const S = H3PushPull.state; S.T.arch.setSel(null); const n = [0.35, -0.75, -0.56], L = Math.hypot(...n); S.V.lookAlong(n.map((x) => x / L), [7.2, -0.2, 2.55], 2.6); }); await p.waitForTimeout(400); await p.screenshot({ path: path.join(process.env.H3_SHOT, "gutter671-roof.png"), clip: { x: 300, y: 100, width: 1000, height: 820 } }); }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
