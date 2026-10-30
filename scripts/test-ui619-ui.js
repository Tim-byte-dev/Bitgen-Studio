#!/usr/bin/env node
/* bitGen Studio — 2.619.0 in a REAL browser (WebGL): THE 📏 PUSHPULL DOCKER - SketchUp-style modelling, with the mouse.
 * Tim: "can we add a final docker, i feel this one will complete bitgen, then just repairs and fixes - ... ingetrazo -
 * looks like a sketchup made for linux" - picked: our own SketchUp-style docker.
 *   R + two clicks + "3,2" = a 3 × 2 m face; P + a click + "2.5" = a box; P on its top again = the sides stretch; a rectangle
 *   drawn on the top + P down = a pocket, pushed to the floor = a hole through; F Offset + P = walls; Select + M Move with
 *   Ctrl = a copy; G group, double-click inside, Esc out; B paint; E eraser; ↶ ↷; 💾 kept in the project, ＋ New, 📂 Open;
 *   ⤓ .glb in the project's 3D models, 🎞 a 3D layer on the timeline, 🖼 a picture in the image editor; the tools' keys
 *   stay in the docker (P / 2 do not open the prompt / negative prompt dockers).
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.619.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const P = "zz_pp_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1800, height: 1500 }, acceptDownloads: true });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => {
      const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock");
      document.getElementById("ppMain").style.minHeight = "700px";
      const pd = document.getElementById("promptdock"); if (pd && !pd.classList.contains("dockgone")) toggleDockGone("promptdock", "tP");
    });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.T, null, { timeout: 40000 });
    await p.waitForTimeout(800);
    const S = () => ev(() => { const s = H3PushPull.state, M = s.M; return { f: M.f.length, e: M.e.length, g: M.g.length, zmax: M.v.length ? Math.max(...M.v.map((v) => v[2])) : null, zmin: M.v.length ? Math.min(...M.v.map((v) => v[2])) : null, msg: document.getElementById("ppMsg").textContent, tool: s.T.name() }; });
    const fit = () => ev(() => { document.getElementById("ppView").scrollIntoView({ block: "center" }); H3PushPull.state.V.size(); H3PushPull.state.V.extents(); });
    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const hover = async (w) => { const [x, y] = await scr(w); await p.mouse.move(x, y, { steps: 4 }); };
    const click = async (w, o) => { await hover(w); const [x, y] = await scr(w); await p.mouse.click(x, y, o); await p.waitForTimeout(120); };
    const vcb = async (t) => { await p.keyboard.type(t); await p.keyboard.press("Enter"); await p.waitForTimeout(250); };
    await fit();
    const ui = await ev(() => ({ tools: [...document.querySelectorAll("#ppTools button")].map((b) => b.id.replace("ppT_", "")).slice(0, 15), sw: document.querySelectorAll("#ppSw button").length, ready: !!document.querySelector("#ppView canvas") }));
    check("the 📏 PushPull docker (its status-bar button too): 15 tools, a colour palette, the 3D view",
      ui.ready && ui.tools.join() === "select,line,rect,circle,polygon,pushpull,move,rotate,scale,offset,tape,paint,eraser,orbit,pan" && ui.sw === 16, ui);

    /* a box */
    await hover([0, 0, 0]); await p.keyboard.press("r");
    await click([0, 0, 0]); await hover([2, 1.5, 0]); await vcb("3,2");
    let s = await S();
    const v1 = await ev(() => H3PushPull.state.M.v.map((v) => v.join(",")).sort());
    check("R, a click on the origin (it snaps there), \"3,2\" typed = a 3 × 2 m face on the ground", s.f === 1 && JSON.stringify(v1) === JSON.stringify(["0,0,0", "0,2,0", "3,0,0", "3,2,0"]) && /a face/.test(s.msg), { s, v1 });
    await fit();
    await p.keyboard.press("p"); await click([1.5, 1, 0]); await hover([1.5, 1, 1]); await vcb("2.5");
    s = await S();
    check("P, a click on the face, \"2.5\" = a box 2.5 m high (6 faces)", s.f === 6 && Math.abs(s.zmax - 2.5) < 1e-9 && /a solid/.test(s.msg), s);
    await fit();
    await click([1.5, 1, 2.5]); await hover([1.5, 1, 3]); await vcb("0.5");
    s = await S();
    check("P on its top again: the sides stretch (still 6 faces, 3 m)", s.f === 6 && Math.abs(s.zmax - 3) < 1e-9 && /stretched/.test(s.msg), s);
    const noKeys = await ev(() => ({ prompt: document.getElementById("promptdock").classList.contains("dockgone"), neg: !document.querySelector(".secfloat:not(.sf-hidden)[data-sf=\"negprompt\"], #sf-negprompt:not(.sf-hidden)") }));
    check("its keys stay in the docker: P did not open the prompt docker, the 2 / . typed went into the Measurements box (no negative prompt window)", noKeys.prompt && noKeys.neg, noKeys);

    /* a pocket, then through */
    await fit();
    await p.keyboard.press("r"); await click([1, 0.5, 3]); await hover([2, 1.5, 3]); await vcb("1,1");
    await p.keyboard.press("p"); await click([1.5, 1, 3]); await hover([1.5, 1, 2.5]); await vcb("1");
    s = await S();
    check("a rectangle drawn ON the top + P down 1 m = a pocket (11 faces)", s.f === 11 && /-1 m|−1 m|-100 cm/.test(s.msg + "") || (s.f === 11), s);
    const sign = await ev(() => H3PushPull.state.M.v.some((v) => Math.abs(v[2] - 2) < 1e-9));
    await ev(() => H3PushPull.state.V.view("top"));                    // the pocket's floor seen from above
    await p.keyboard.press("p"); await click([1.5, 1, 2]); await ev(() => H3PushPull.state.V.view("iso")); await hover([1.5, 1, 1]); await vcb("2");
    s = await S();
    check("…the pocket's floor pushed to the far side = a HOLE THROUGH the box (10 faces)", sign && s.f === 10 && /hole through/.test(s.msg), s);

    /* undo / redo */
    await p.keyboard.press("Control+z"); await p.waitForTimeout(150); const u1 = (await S()).f;
    await p.keyboard.press("Control+y"); await p.waitForTimeout(150); const u2 = (await S()).f;
    check("Ctrl+Z / Ctrl+Y: the hole undone (11 faces) and back (10)", u1 === 11 && u2 === 10, { u1, u2 });

    /* offset + walls on a new model */
    await ev(() => H3PushPull.newModel()); await p.waitForTimeout(500); await fit();
    await hover([0, 0, 0]); await p.keyboard.press("r"); await click([0, 0, 0]); await hover([4, 3, 0]); await vcb("5,4"); await fit();
    await p.keyboard.press("f"); await click([2.5, 2, 0]); await hover([2.5, 1.5, 0]); await vcb("0.25");
    s = await S();
    const ring = await ev(() => H3PushPull.state.M.f.map((F) => F.loops.length).sort().join(","));
    check("＋ New; F Offset 25 cm inside a 5 × 4 m face = a ring + the room's floor", s.f === 2 && ring === "1,2" && /offset/.test(s.msg), { s, ring });
    await p.keyboard.press("p"); await click([0.1, 2, 0]); await hover([0.1, 2, 1]); await vcb("2.7");
    s = await S();
    check("…P on the ring = walls 2.7 m high round the room", Math.abs(s.zmax - 2.7) < 1e-9 && s.f >= 11, s);

    if (process.env.PP_SHOT) { await fit(); await p.waitForTimeout(300); await p.screenshot({ path: process.env.PP_SHOT, clip: await ev(() => { const r = document.getElementById("pushpulldock").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 1000) }; }) }); }
    /* select, copy, group, paint, erase */
    await fit();
    await ev(() => H3PushPull.state.V.view("top"));
    await p.keyboard.press(" "); await click([2.5, 2, 0]);
    await ev(() => H3PushPull.state.V.view("iso"));
    const sel1 = await ev(() => H3PushPull.state.sel.f.length);
    await p.keyboard.press("m");
    await click([0, 0, 0]);
    await p.keyboard.down("Control"); await p.keyboard.up("Control"); await hover([3, 0, 0]);
    await vcb("0,0,3");
    s = await S();
    check("Select the room's floor, M Move with Ctrl = a COPY of it 3 m up (\"0,0,3\")", sel1 === 1 && /copied/.test(s.msg) && Math.abs(s.zmax - 3) < 1e-9, s);
    await p.keyboard.press(" "); await ev(() => { const M = H3PushPull.state.M, top = M.f.filter((F) => F.loops[0].every((i) => M.v[i][2] === 3)); H3PushPull.state.sel = { f: top.map((F) => F.id), e: [], k: [] }; H3PushPull.state.V.setSel(H3PushPull.state.sel); });
    await p.keyboard.press("g"); await p.waitForTimeout(200);
    s = await S();
    const g1 = await ev(() => { const M = H3PushPull.state.M; return M.f.filter((F) => F.grp).length; });
    await ev(() => H3PushPull.enterGroup(H3PushPull.state.M.g[0].id)); const inG = await ev(() => document.getElementById("ppGrp").style.display);
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    const outG = await ev(() => ({ grp: H3PushPull.state.group, d: document.getElementById("ppGrp").style.display }));
    check("G = a group of what is picked; editing inside it shows the banner, Esc leaves", s.g === 1 && g1 === 1 && inG === "block" && !outG.grp && outG.d === "none", { s, g1, inG, outG });
    await ev(() => H3PushPull.setColor("#b5523b")); await fit();
    await click([2.5, 2, 0]);
    const painted = await ev(() => H3PushPull.state.M.f.some((F) => F.mat === "#b5523b"));
    await p.keyboard.press("e"); await ev(() => H3PushPull.state.V.view("top"));
    const before = (await S()).f;
    await click([2.5, 2, 3]);
    const after = (await S()).f;
    check("B Paint: a face takes the colour; E Eraser: a click erases (the group on top goes)", painted && after < before, { painted, before, after });

    /* circle sides, a line that splits a face, the tape, rotate */
    await ev(() => H3PushPull.newModel()); await p.waitForTimeout(400); await fit();
    await hover([0, 0, 0]); await p.keyboard.press("c"); await vcb("36s");
    await click([0, 0, 0]); await hover([1, 0.3, 0]); await vcb("1");
    const circ = await ev(() => { const M = H3PushPull.state.M, F = M.f[0]; return { f: M.f.length, n: F && F.loops[0].length, r: F && Math.hypot(...M.v[F.loops[0][0]].slice(0, 2)) }; });
    check("C Circle: \"36s\" = 36 sides, a click on the centre + \"1\" = radius 1 m", circ.f === 1 && circ.n === 36 && Math.abs(circ.r - 1) < 1e-6, circ);
    await ev(() => H3PushPull.newModel()); await p.waitForTimeout(400); await fit();
    await hover([0, 0, 0]); await p.keyboard.press("r"); await click([0, 0, 0]); await hover([4, 2, 0]); await vcb("4,2"); await fit();
    await ev(() => H3PushPull.state.V.view("top"));
    await p.keyboard.press("l"); await click([2, 0, 0]); await click([2, 2, 0]);
    const sp = await S(); await p.keyboard.press("Escape");   // 2.620.0: Esc in a tool with nothing going = back to Select
    check("L Line from the middle of one edge to the middle of the other (Midpoint inference) = the face split in two", sp.f === 2 && /split/.test(sp.msg), sp);
    await p.keyboard.press("t"); await click([0, 0, 0]); await click([4, 0, 0]);
    const tape = await S();
    check("T Tape: the distance between two corners (4 m)", /📏 4 m/.test(tape.msg), tape.msg);
    await p.keyboard.press("Control+a"); await p.keyboard.press("q"); await click([0, 0, 0]); await click([4, 0, 0]); await hover([0, 4, 0]); await vcb("90");
    const rot = await ev(() => H3PushPull.state.M.v.some((v) => Math.abs(v[0]) < 1e-6 && Math.abs(v[1] - 4) < 1e-6) && H3PushPull.state.M.v.every((v) => v[0] <= 1e-6));
    check("Ctrl+A, Q Rotate round the origin, \"90\" = turned a quarter (the 4 m corner now at 0, 4)", rot, await S());

    /* files */
    await ev(() => H3PushPull.save(false)); await p.waitForTimeout(400);
    const list = await api("/api/pushpull");
    const name = await ev(() => document.getElementById("ppName").value);
    const saved = (list.models || []).find((x) => x.name === name);
    const back = await api("/api/pushpull/" + encodeURIComponent(name));
    check("💾 the model is kept in the project (projects/<project>/pushpull/<name>.pp3d) with its view", !!saved && back.model && back.model.f.length === (await S()).f && Array.isArray(back.view && back.view.p), { list, name });
    await ev(() => H3PushPull.newModel()); await p.waitForTimeout(400);
    await ev((n) => H3PushPull.open(n), name); await p.waitForTimeout(400);
    check("＋ New then 📂 Open brings it back", (await S()).f === back.model.f.length);

    /* out into bitGen */
    const glb = await ev(() => H3PushPull.toProject("glb"));
    const models = await api("/api/tlcanvas/models");
    check("⤓ .glb into the project's 3D models", /^pp_.*\.glb$/.test(glb) && (models.models || []).some((x) => x.name === glb && x.size > 500), { glb, models });
    const imp = await ev(async (n) => { const f0 = H3PushPull.state.M.f.length; await H3PushPull.importModel(n); const M = H3PushPull.state.M; return { added: M.f.length - f0, soft: M.g.some((g) => g.soft), msg: document.getElementById("ppMsg").textContent }; }, glb);
    check("⤒ Import: a project 3D model (the .glb just made) comes in as a group (its triangles, drawn as surfaces)", imp.added > 0 && imp.soft && /as the group/.test(imp.msg), imp);
    const tl1 = await ev(async () => { const d = document.getElementById("timelinedock"); if (/collapsed|dockgone/.test(d.className)) toggleDockGone("timelinedock", "tTL"); const n0 = JSON.stringify(tl).length; await H3PushPull.toTimeline(); await new Promise((r) => setTimeout(r, 800)); return { has: JSON.stringify(tl).includes("pp_"), grew: JSON.stringify(tl).length > n0, msg: document.getElementById("ppMsg").textContent }; });
    check("🎞 → the timeline: a 3D layer of the model", tl1.has && /timeline/.test(tl1.msg), tl1);
    const ie = await ev(async () => { await H3PushPull.toEditor(false); await new Promise((r) => setTimeout(r, 1200)); const E = window.imageEditorInstance && window.imageEditorInstance.E; return { w: E && E.S.w, layers: E && E.S.layers.length, msg: document.getElementById("ppMsg").textContent }; });
    check("🖼 → the image editor: a picture of the view", ie.w > 100 && /image editor/.test(ie.msg), ie);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/delete", { name: P }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
