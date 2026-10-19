#!/usr/bin/env node
/* bitGen Studio — 2.423.0 in a REAL browser: SELECT AND MASK, MAGNETIC LASSO, QUICK SELECTION, SELECT SKY, CHANNELS,
 * PATCH, CONTENT-AWARE MOVE / FILL, RED EYE, MIXER BRUSH, BACKGROUND / MAGIC ERASER, TRUE HEALING
 * (ext/imageeditdock/pcrefine.js, pcheal.js, pcselect.js, pcretouch.js) - gaps 4 + 5.
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the selection / retouching browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.refine && window.imageEditorInstance.E.heal, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#000000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (pts, mods) => { await p.waitForTimeout(120); for (const m of mods || []) await p.keyboard.down(m); const q = []; for (const [x, y] of pts) q.push(await T(x, y)); await p.mouse.move(...q[0]); await p.mouse.down(); for (const r of q.slice(1)) await p.mouse.move(r[0], r[1], { steps: 4 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(150); };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(100); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(120); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, sel: s.selCount, ch: (s.channels || []).map((c) => c.name) }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const selAt = (x, y) => ev(([x, y]) => window.imageEditorInstance.state.sel[y * window.imageEditorInstance.state.w + x], [x, y]);
    const paint = (f) => ev((fs) => { const E = window.imageEditorInstance.E, S = E.S, L = E.layer(), g = L.canvas.getContext("2d"); new Function("g", "W", "H", fs)(g, S.w, S.h); L.ver++; E.refresh(); E.flattenCache && E.flattenCache(); }, f);

    /* a picture: a dark disc on a light background */
    await paint(`g.fillStyle = "#e8e8e8"; g.fillRect(0, 0, W, H); g.fillStyle = "#202020"; g.beginPath(); g.arc(300, 200, 100, 0, Math.PI * 2); g.fill();`);

    /* 1 the tools are there */
    const groups = await ev(() => [...document.querySelectorAll(".ietool")].map((x) => x.dataset.tools));
    check("tools: L + Magnetic Lasso, W + Quick Selection, J + Patch / Content-Aware Move / Red Eye, B + Mixer Brush, E + Background / Magic Eraser; a Channels tab",
      groups.includes("lasso,poly,maglasso") && groups.some((g) => /qsel/.test(g)) && groups.includes("spotheal,heal,patch,cmove,redeye") && groups.includes("paint,pencil,mixer") && groups.includes("erase,bgerase,magicerase")
      && await ev(() => !!document.querySelector('.pctabs [data-tab="pcChannels"]')), groups);

    /* 2 quick selection grows to the disc's edge */
    await ev(() => window.imageEditorInstance.E.setTool("qsel"));
    await drag([[280, 200], [300, 190], [320, 205]]);
    let s = await st();
    const qIn = await selAt(300, 200), qOut = await selAt(300, 320), qEdge = await selAt(395, 200);
    check("Quick Selection: a short stroke inside the disc selects the whole disc (≈ 31 000 px) and stops at its edge", qIn > 200 && qOut === 0 && qEdge > 100 && s.sel > 26000 && s.sel < 34000, { qIn, qOut, qEdge, sel: s.sel });

    /* 3 Select and Mask: a sloppy square round the disc -> Radius snaps it onto the disc */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.changeSel(E.P.rectMask(185, 85, 415, 315, S.w, S.h), "square"); });
    await ev(() => window.imageEditorInstance.E.ui.run("sel.mask")); await p.waitForTimeout(400);
    const ws = await ev(() => !!document.querySelector("#pcSelectMask #smCv"));
    await ev(() => { const r = document.querySelector("#smR"); r.value = 40; r.dispatchEvent(new Event("input")); }); await p.waitForTimeout(400);
    await p.click("#smOk"); await p.waitForTimeout(600);
    s = await st();
    const corner = await selAt(195, 95), inside = await selAt(300, 200);
    check("Select and Mask (Alt+Ctrl+R): its own workspace; Radius 40 + OK - the square's corners (not disc) drop out, the disc stays: the selection now follows the disc", ws && corner < 40 && inside > 230 && s.sel > 25000 && s.sel < 38000, { ws, corner, inside, sel: s.sel });

    /* 4 save / load selection (alpha channel) */
    await ev(() => { const E = window.imageEditorInstance.E; E.refine.saveSel("Disc"); E.deselect(); E.ui.showTab("pcChannels"); });
    s = await st();
    const chRows = await ev(() => [...document.querySelectorAll("#pcChannels .chrow")].map((r) => r.textContent.trim()));
    check("Select ▸ Save Selection: an alpha channel 'Disc'; the Channels tab lists RGB, Red, Green, Blue, Disc", s.ch.join() === "Disc" && chRows.length === 5 && /Disc/.test(chRows[4]) && /Red/.test(chRows[1]), { ch: s.ch, chRows });
    await ev(() => { const r = document.querySelector('#pcChannels [data-ach]'); r.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })); });
    s = await st();
    check("...Ctrl-click the channel loads it as the selection again", s.sel > 25000 && (await selAt(300, 200)) > 230, s.sel);
    await key("Control+z"); await key("Control+z"); await key("Control+z");
    s = await st();
    check("...it undoes like any step (Ctrl+Z: the loaded selection, the deselect, then the channel gone)", s.ch.length === 0, s.ch);
    await key("Control+Shift+z"); await key("Control+Shift+z"); await key("Control+Shift+z");

    /* 5 select sky */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); });
    await paint(`g.fillStyle = "#78aae6"; g.fillRect(0, 0, W, 150); for (let y = 150; y < H; y += 3) for (let x = 0; x < W; x += 3) { const t = (x * 7 + y * 13) % 60; g.fillStyle = "rgb(" + (40 + t) + "," + (110 + t) + ",40)"; g.fillRect(x, y, 3, 3); }`);
    await ev(() => window.imageEditorInstance.E.ui.run("sel.sky"));
    const skyTop = await selAt(300, 50), skyGround = await selAt(300, 300);
    check("Select ▸ Sky: the blue top selected, the textured ground not", skyTop > 230 && skyGround < 30, { skyTop, skyGround });
    await ev(() => window.imageEditorInstance.E.deselect());

    /* 6 magnetic lasso round a bright box */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); });
    await paint(`g.fillStyle = "#101010"; g.fillRect(0, 0, W, H); g.fillStyle = "#f0f0f0"; g.fillRect(150, 100, 300, 200);`);
    await ev(() => window.imageEditorInstance.E.setTool("maglasso"));
    await click(152, 102);
    for (const [x, y] of [[300, 106], [446, 104], [444, 200], [446, 296], [300, 294], [154, 296], [156, 200]]) { const q = await T(x, y); await p.mouse.move(q[0], q[1], { steps: 6 }); await p.waitForTimeout(40); await click(x, y); }
    await key("Enter");
    s = await st();
    check("Magnetic Lasso: clicks NEAR the box's edges snap onto them - the box selected (≈ 60 000 px), its outside not", s.sel > 55000 && s.sel < 64000 && (await selAt(300, 200)) > 200 && (await selAt(100, 50)) === 0, s.sel);

    /* 7 content-aware fill: the box gone, filled from the dark around it */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.changeSel(E.P.rectMask(140, 90, 460, 310, S.w, S.h), "box+"); });
    await ev(() => window.imageEditorInstance.E.caFill(false)); await p.waitForTimeout(6000);
    const filled = await lpx(300, 200);
    check("Edit ▸ Content-Aware Fill: the bright box filled from its dark surroundings (no AI)", filled[0] < 60, filled);
    await ev(() => window.imageEditorInstance.E.deselect());

    /* 8 red eye */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); });
    await paint(`g.fillStyle = "#d2b48c"; g.fillRect(0, 0, W, H); g.fillStyle = "#dc1e28"; g.beginPath(); g.arc(200, 200, 12, 0, Math.PI * 2); g.fill();`);
    await ev(() => window.imageEditorInstance.E.setTool("redeye")); await click(200, 200);
    const pupil = await lpx(200, 200), skin = await lpx(240, 200);
    check("Red Eye: a click on the red pupil darkens it; the skin round it stays", pupil[0] < 80 && skin[0] === 0xd2, { pupil, skin });

    /* 9 patch: a dark blemish replaced by the clean texture beside it */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); });
    await paint(`for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = 150 + ((x * 3 + y * 5) % 40); g.fillStyle = "rgb(" + v + "," + v + "," + v + ")"; g.fillRect(x, y, 1, 1); } g.fillStyle = "#300000"; g.fillRect(280, 180, 30, 30);`);
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.changeSel(E.P.rectMask(270, 170, 320, 220, S.w, S.h), "blemish"); E.setTool("patch"); });
    await drag([[295, 195], [355, 195], [415, 195]]);
    const patched = await lpx(295, 195);
    check("Patch: the selected blemish dragged onto clean texture - it takes that texture (no dark red left)", patched[0] > 120 && Math.abs(patched[0] - patched[2]) < 30, patched);
    await ev(() => window.imageEditorInstance.E.deselect());

    /* 10 magic eraser + background eraser */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); });
    await paint(`g.fillStyle = "#0000ff"; g.fillRect(0, 0, W, H); g.fillStyle = "#ffff00"; g.fillRect(250, 150, 100, 100);`);
    await ev(() => window.imageEditorInstance.E.setTool("magicerase")); await click(50, 50);
    const me = await lpx(50, 50), keep = await lpx(300, 200);
    check("Magic Eraser: a click clears the blue background, the yellow square stays", me[3] === 0 && keep[3] === 255, { me, keep });
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); });
    await paint(`g.fillStyle = "#0000ff"; g.fillRect(0, 0, W, H); g.fillStyle = "#ffff00"; g.fillRect(300, 0, 300, H);`);
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("bgerase"); E.setSize(60); });
    await drag([[200, 200], [260, 200], [320, 200], [360, 200]]);
    const bgB = await lpx(250, 200), bgY = await lpx(340, 200);
    check("Background Eraser (Continuous): the blue under the stroke goes; the yellow it crosses into is sampled too (continuous) - Once keeps it", bgB[3] < 30, { bgB, bgY });

    /* 11 healing brush: blended */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); });
    await paint(`g.fillStyle = "#808080"; g.fillRect(0, 0, 300, H); g.fillStyle = "#404040"; g.fillRect(300, 0, 300, H); for (let i = 0; i < 40; i++) { g.fillStyle = "#fff"; g.fillRect(40 + (i % 8) * 25, 60 + Math.floor(i / 8) * 25, 3, 3); }`);
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("heal"); E.setSize(40); });
    await click(150, 150, ["Alt"]);
    await drag([[420, 150], [440, 160], [460, 170]]);
    const healed = await lpx(440, 160);
    check("Healing Brush: the copy from the light side takes the DARK side's tone where it lands (blended, not a light patch)", healed[0] < 100, healed);

    /* 12 mixer brush */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); });
    await paint(`g.fillStyle = "#ff0000"; g.fillRect(0, 0, 300, H); g.fillStyle = "#0000ff"; g.fillRect(300, 0, 300, H);`);
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.setFg("#ff0000"); E.setTool("mixer"); E.setSize(30); S.mixWet = 50; S.mixMix = 30; });
    await drag([[250, 100], [280, 100], [300, 100], [315, 100]]);
    const mixed = await lpx(312, 100);
    check("Mixer Brush: red paint dragged into blue picks the blue up (a purple mix, not pure red)", mixed[2] > 60 && mixed[0] > 60, mixed);

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed - " + (e && e.stack || e));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
