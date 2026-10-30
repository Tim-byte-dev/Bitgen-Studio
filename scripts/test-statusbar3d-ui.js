#!/usr/bin/env node
/* bitGen Studio — 2.386.0 in a REAL browser: the statusbar's docker buttons and the 3D toolbar over the canvas.
 * Tim: "if a docker is visible, either open or closed, highlight the toggle button in the statusbar, the statusbar buttons
 * toggle the dockers on and off - make buttons for all dockers (not floating dockers). can we have a top toolbar when
 * user selects a 3d layer for 3d operations?"
 * Run against the running app (H3_URL, default the e2e server on :8311); a project of its own, "default" back after.
 * No Playwright here = SKIP (exit 0).
 *   1. every docker (the 11 in the column, the 5 side ones) has a statusbar button; lit while it is on screen;
 *   2. collapsing a docker keeps its button lit; the button hides it (dark) and shows it again (lit);
 *   3. Stems, SFX and Chat have buttons now; a side docker's button too;
 *   4. the 3D toolbar: only while a 3D layer is selected, along the top of the canvas; its widget / snap / views /
 *      no-rotation / spin / reset / material / studio / brightness / ＋ light / ◇ Key / Blender buttons do their job. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the statusbar / 3D toolbar browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const P = "zz_sb3d_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); }
};
const api = async (u, body) => {
  for (let i = 0; ; i++) {
    try { return await (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json(); }
    catch (e) { if (i >= 5) throw e; await new Promise((ok) => setTimeout(ok, 500 * (i + 1))); }
  }
};

(async () => {
  const orig = await api("/api/docker-status");
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await api("/api/projects/load", { name: P });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.Tl3DBar && window.TlGizmo && typeof dsReady !== "undefined" && dsReady, null, { timeout: 30000 });
    await p.waitForTimeout(800);

    // 1
    const all = await p.evaluate(() => {
      const docks = [...document.querySelectorAll("#maincol > .bdock")];
      const pd = document.getElementById("promptdock");          // 2.389.0: the prompt floats (or sits in a .pf-row) by default
      if (pd && !docks.includes(pd)) docks.push(pd);
      const col = docks.map((d) => ({ id: d.id, btn: dockBtnFor(d.id), lit: !!dockBtnFor(d.id) && document.getElementById(dockBtnFor(d.id)).classList.contains("on"), gone: d.classList.contains("dockgone") }));
      const side = Object.values(SIDE_DOCKS).map(([, cls, bt]) => ({ bt, ok: !!document.getElementById(bt), lit: document.getElementById(bt).classList.contains("on"), hidden: document.getElementById("app").classList.contains(cls) }));
      return { col, side };
    });
    check("every docker in the column (+ the floating prompt) has a statusbar button (12 - 2.619.0: + 📏 PushPull)", all.col.length === 12 && all.col.every((x) => x.btn), all.col);
    check("...lit exactly while it is on screen", all.col.every((x) => x.lit === !x.gone) && all.side.every((x) => x.ok && x.lit === !x.hidden), all);
    // 2
    const two = await p.evaluate(() => {
      const d = document.getElementById("musicdock"), btn = document.getElementById("tMu"), out = {};
      if (d.classList.contains("dockgone")) btn.click();
      if (d.classList.contains("collapsed")) toggleCollapse("musicdock");
      toggleCollapse("musicdock");
      out.collapsedLit = d.classList.contains("collapsed") && btn.classList.contains("on");
      btn.click();
      out.hiddenDark = d.classList.contains("dockgone") && !btn.classList.contains("on") && d.offsetHeight === 0;
      btn.click();
      out.backLit = !d.classList.contains("dockgone") && btn.classList.contains("on") && d.offsetHeight > 0;
      return out;
    });
    check("a COLLAPSED docker keeps its button lit (it is on screen)", two.collapsedLit, two);
    check("...its button hides it (dark) and shows it again (lit)", two.hiddenDark && two.backLit, two);
    // 3
    const three = await p.evaluate(() => {
      const r = {};
      for (const [b, id] of [["tSt", "stemsdock"], ["tSfx", "sfxdock"], ["tCh", "chatdock"]]) {
        const btn = document.getElementById(b), d = document.getElementById(id);
        if (!btn || !d) { r[b] = "missing"; continue; }
        const was = d.classList.contains("dockgone");
        btn.click(); const a = d.classList.contains("dockgone") === !was && btn.classList.contains("on") === was;
        btn.click(); const c = d.classList.contains("dockgone") === was && btn.classList.contains("on") === !was;
        r[b] = a && c;
      }
      const L = document.getElementById("tL"), app = document.getElementById("app"), w0 = app.classList.contains("no-left");
      L.click(); const s1 = app.classList.contains("no-left") === !w0 && L.classList.contains("on") === w0;
      L.click(); r.tL = s1 && app.classList.contains("no-left") === w0 && L.classList.contains("on") === !w0;
      return r;
    });
    check("Stems, SFX and Chat have statusbar buttons that hide / show them; a side docker's (⟨) too",
      three.tSt === true && three.tSfx === true && three.tCh === true && three.tL === true, three);
    const st = await api("/api/docker-status");
    check("...hidden / shown is still written to docker_status.json", st.docks && typeof st.docks.stemsdock.hidden === "boolean", st.docks && st.docks.stemsdock);

    // 4 ---- the 3D toolbar
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (d.classList.contains("dockgone")) toggleDockGone("timelinedock", "tT");
      if (d.classList.contains("collapsed")) toggleCollapse("timelinedock");
      setVar("th", 760);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); setPlayhead(1);
      TlCanvas.select(null, null); TlCanvas.draw();
    });
    await p.waitForTimeout(300);
    check("no 3D layer selected: no 3D toolbar", await p.evaluate(() => !document.getElementById("tl3dBar").classList.contains("on")));
    await p.evaluate(() => { const c = TlM3D.add("text"); c.out = 5; c.dur = 5; window.__c = c; TlCanvas.draw(); });
    await p.waitForTimeout(400);
    const geo = await p.evaluate(() => {
      const bar = document.getElementById("tl3dBar").getBoundingClientRect(), cv = document.getElementById("tlCanvasWrap").getBoundingClientRect();
      return { on: document.getElementById("tl3dBar").classList.contains("on"), above: bar.bottom <= cv.top + 1 && bar.height > 15 && Math.abs(bar.left - cv.left) < 2,
               name: document.getElementById("t3Name").textContent };
    });
    check("a 3D layer selected: the 3D toolbar along the TOP of the canvas, with the layer's name", geo.on && geo.above && /3D text/.test(geo.name), geo);
    await p.click('#tl3dBar [data-t3mode="rotate"]');
    check("...✥ ⟲ ⤡ ○ pick the widget (and the R / G / S keys light the bar)", await p.evaluate(() => TlGizmo.mode() === "rotate"
      && document.querySelector('#tl3dBar [data-t3mode="rotate"]').classList.contains("on")));
    await p.evaluate(() => TlGizmo.setMode("scale"));
    check("...and follows the widget when it changes elsewhere (keys, Properties)", await p.evaluate(() => document.querySelector('#tl3dBar [data-t3mode="scale"]').classList.contains("on")));
    await p.click("#t3Snap");
    check("...🧲 snaps every turn to 15°", await p.evaluate(() => TlGizmo.snap() === true && document.getElementById("t3Snap").classList.contains("on")));
    await p.click("#t3Snap");
    await p.click('#tl3dBar [data-t3view="left"]');
    const v1 = await p.evaluate(() => [__c.m3d.rx, __c.m3d.ry, __c.m3d.rz, document.querySelector('#tl3dBar [data-t3view="left"]').classList.contains("on")]);
    await p.click('#tl3dBar [data-t3view="top"]');
    const v2 = await p.evaluate(() => [__c.m3d.rx, __c.m3d.ry]);
    await p.click("#t3Zero");
    const v3 = await p.evaluate(() => [__c.m3d.rx, __c.m3d.ry, __c.m3d.rz]);
    check("...views: left = Y 90°, top = X 90°, ⟲0 = no rotation", v1[1] === 90 && v1[0] === 0 && v1[3] && v2[0] === 90 && v2[1] === 0 && v3.every((x) => x === 0), [v1, v2, v3]);
    await p.click("#t3Spin");
    const sp1 = await p.evaluate(() => __c.m3d.spinY);
    await p.click("#t3Spin");
    check("...⟳ spins it round Y (30°/s) and stops it", sp1 === 30 && await p.evaluate(() => __c.m3d.spinY === 0), sp1);
    await p.evaluate(() => { __c.m3d.pz = 1.2; __c.m3d.sx = 2; });
    await p.click("#t3Reset");
    check("...⤢ depth 0, its own scale 100%", await p.evaluate(() => __c.m3d.pz === 0 && __c.m3d.sx === 1 && __c.m3d.sy === 1 && __c.m3d.sz === 1));
    await p.selectOption("#t3Mat", "chrome");
    check("...🎨 a material preset (Chrome)", await p.evaluate(() => __c.m3d.mat.preset === "chrome" && __c.m3d.metal === 1 && __c.m3d.color === "#ffffff"));
    await p.click("#t3Studio");
    const so = await p.evaluate(() => __c.m3d.studio);
    await p.click("#t3Studio");
    check("...☀ studio lights off / on", so === false && await p.evaluate(() => __c.m3d.studio === undefined), so);
    await p.$eval("#t3Bright", (el) => { el.value = "2.5"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); });
    await p.selectOption("#t3Light", "sun");
    check("...the studio brightness slider and ＋💡 (a Sun light added)", await p.evaluate(() => __c.m3d.light === 2.5 && __c.m3d.lights.length === 1 && __c.m3d.lights[0].type === "sun"));
    await p.click("#t3Key");
    check("...◇ Key: a keyframe at the position marker (holding the rotation, depth, scale)", await p.evaluate(() => (__c.kf || []).length === 1 && "ry" in __c.kf[0] && "pz" in __c.kf[0] && "sx" in __c.kf[0]));
    await p.click("#t3Blender");
    check("...🟧 render with Blender on", await p.evaluate(() => __c.m3d.renderer === "blender" && document.getElementById("t3Blender").classList.contains("on")));
    await p.click("#t3Blender");
    await p.evaluate(() => { TlCanvas.select(null, null); TlCanvas.draw(); });
    await p.waitForTimeout(200);
    check("...deselected: the 3D toolbar goes away", await p.evaluate(() => !document.getElementById("tl3dBar").classList.contains("on")));
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 800));
  } finally {
    await b.close();
    try { await api("/api/docker-status", orig); await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
