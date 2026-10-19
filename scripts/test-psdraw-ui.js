#!/usr/bin/env node
/* bitGen Studio — 2.428.0 in a REAL browser: CORELDRAW'S SHAPE TOOLS (F6), ARTISTIC MEDIA (F5), DIMENSIONS AND
 * CONNECTORS (F8) - ext/imageeditdock/pcdraw.js.
 * Tim: "i would like all the drawing tools from coreldraw and the tool dockers" - the agreed order: the drawing tools
 * after Actions. Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the CorelDRAW drawing tools browser test did not run"); process.exit(0); }
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
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.cdraw, null, { timeout: 60000 });
    await p.evaluate(() => { const E = window.imageEditorInstance.E; if (E.selHl) E.selHl.hold(true); });   // 2.470.0: these draw and then keep using the tool (no switch to the Move tool after drawing)
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(900, 560, "draw.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 900, 560); }); E.setFg("#102040"); E.setBg("#e0b040"); const S = E.S; S.vlFillOn = true; S.vlW = 3; S.cd.corners = [0, 0, 0, 0]; S.cd.cornerStyle = "round"; S.cd.sides = 5; S.cd.points = 5; S.cd.sharp = 53; S.cd.cpoints = 9; S.cd.csharp = 2; S.cd.unit = "px"; S.cd.dec = 0; S.cd.conn = "right"; S.cd.rlock = true; });
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (a, c, mods) => { await p.waitForTimeout(120); for (const m of mods || []) await p.keyboard.down(m); const s = await T(...a), e = await T(...c); await p.mouse.move(...s); await p.mouse.down(); await p.mouse.move(...e, { steps: 6 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(180); };
    const click = async (x, y) => { await p.waitForTimeout(100); const q = await T(x, y); await p.mouse.click(...q); await p.waitForTimeout(120); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(150); };
    const tool = (t) => ev((t) => window.imageEditorInstance.E.setTool(t), t);
    const A = () => ev(() => { const S = window.imageEditorInstance.state, L = S.layers[S.active], sh = L && L.shape, Q = window.PCPath; return { n: S.layers.length, name: L && L.name, gen: sh && sh.gen ? JSON.parse(JSON.stringify(sh.gen)) : null, media: !!(sh && sh.media), line: sh && sh.line ? JSON.parse(JSON.stringify(sh.line)) : null, subs: sh && sh.path ? sh.path.subs.map((q) => ({ n: q.pts.length, closed: q.closed, plain: !!q.plain })) : null, box: sh && sh.path ? Q.bbox(sh.path) : null, undo: S.undo.length }; });
    const px = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);

    /* 1 keys + the column */
    await key("F6"); const t1 = await ev(() => window.imageEditorInstance.state.tool); await key("F6"); const t2 = await ev(() => window.imageEditorInstance.state.tool);
    await key("F8"); const t3 = await ev(() => window.imageEditorInstance.state.tool);
    const groups = await ev(() => [...document.querySelectorAll("#kxTools .ietool")].map((x) => x.dataset.tools));
    check("F6 = the Rectangle tool (again = 3-Point Rectangle), F8 = the dimension / connector tools; Artistic Media in the F5 group",
      t1 === "crect" && t2 === "crect3" && t3 === "cdimpar" && groups.includes("crect,crect3,cellipse,cellipse3,cpolygon,cstar,ccstar,cspiral,cgraph,ccommon") && groups.includes("cdimpar,cdimhv,cdimchain,cdimang,ccallout,cconnect") && groups.some((g) => /,cmedia$/.test(g)), [t1, t2, t3]);

    /* 2 Rectangle: live corners */
    await tool("crect"); await drag([50, 50], [250, 170]);
    let a = await A();
    check("Rectangle: a vector line shape, LIVE (gen rect), its box", a.gen && a.gen.type === "rect" && a.line && Math.round(a.box.w) === 200 && Math.round(a.box.h) === 120 && a.subs[0].closed, a);
    const corner0 = await px(52, 52);
    await p.fill("#kxOpts #cdR0", "30"); await p.dispatchEvent("#kxOpts #cdR0", "change"); await p.waitForTimeout(200);
    a = await A();
    const corner1 = await px(52, 52);
    check("...the bar's corner radius changes it (all four with 🔒; one undo step): the corner rounded away", a.gen.corners.join() === "30,30,30,30" && a.subs[0].n === 8 && corner0[2] < 150 && corner1.every((v) => v > 240), [a.gen, corner0, corner1]);
    await ev(() => { document.querySelector("#kxOpts #cdCS").value = "chamfer"; document.querySelector("#kxOpts #cdCS").dispatchEvent(new Event("change")); }); await p.waitForTimeout(150);
    check("...corner style Chamfer", (await A()).gen.style === "chamfer");
    await drag([300, 60], [380, 100], ["Control"]);
    a = await A();
    check("...Ctrl draws a square", Math.abs(a.box.w - a.box.h) < 0.6, a.box);

    /* 3 the others */
    const kinds = [];
    for (const [t, from, to] of [["cellipse", [420, 50], [560, 150]], ["cpolygon", [600, 50], [720, 170]], ["cstar", [740, 50], [860, 170]], ["ccstar", [50, 220], [190, 360]], ["cspiral", [220, 220], [360, 360]], ["cgraph", [400, 220], [560, 340]], ["ccommon", [600, 220], [760, 340]]]) {
      await tool(t); await drag(from, to); a = await A(); kinds.push([t, a.gen && a.gen.type, a.subs.length, a.subs.map((s) => s.n).join("/")]);
    }
    check("Ellipse, Polygon (5), Star (5 points = 10 nodes), Complex Star (even-odd), Spiral (open), Graph Paper (4 x 3 cells), Common Shape (an arrow)",
      kinds[0][1] === "ellipse" && kinds[1][3] === "5" && kinds[2][3] === "10" && kinds[3][1] === "cstar" && kinds[4][1] === "spiral" && kinds[5][2] === 12 && kinds[6][1] === "common", kinds);
    const cs = await A();
    await ev(() => window.imageEditorInstance.E.setActive(window.imageEditorInstance.state.layers.findIndex((x) => x.name === "Complex Star 1")));
    check("...the complex star is filled even-odd (its middle open)", (await ev(() => window.imageEditorInstance.E.layer().shape.line.evenodd)) === true && (await px(120, 290))[0] > 240, await px(120, 290));
    void cs;
    // a live polygon: the bar's sides
    await ev(() => window.imageEditorInstance.E.setActive(window.imageEditorInstance.state.layers.findIndex((x) => x.name === "Polygon 1")));
    await tool("cpolygon"); await p.fill("#kxOpts #cdSides", "8"); await p.dispatchEvent("#kxOpts #cdSides", "change"); await p.waitForTimeout(150);
    a = await A();
    check("...a picked Polygon: 8 sides from the bar (regenerated in its place)", a.gen.sides === 8 && a.subs[0].n === 8 && Math.abs(a.box.x - 600) < 20, a);
    await key("Control+q");
    a = await A();
    check("...Ctrl+Q (Convert to Curves) ends its live settings - plain curves", !a.gen && a.subs[0].n === 8, a);

    /* 4 3-point rectangle / ellipse */
    await tool("crect3"); await drag([80, 420], [220, 380]); await p.mouse.move(...(await T(250, 470)), { steps: 3 }); await click(250, 470);
    a = await A();
    check("3-Point Rectangle: a side at an angle + a height - turned (rot ≠ 0)", a.gen && a.gen.type === "rect" && Math.abs(a.gen.frame.rot) > 0.2 && a.gen.frame.h > 40, a.gen);
    await tool("cellipse3"); await drag([300, 420], [420, 420]); await click(380, 470);
    a = await A();
    check("3-Point Ellipse: the axis + the other radius", a.gen && a.gen.type === "ellipse" && Math.round(a.gen.frame.w) === 120 && Math.round(a.gen.frame.h) === 50, a.gen);

    /* 5 Artistic Media */
    await tool("cmedia"); await drag([460, 520], [640, 440]);
    a = await A();
    check("Artistic Media (preset taper): a filled outline round the stroke, kept live (media)", a.media && a.subs[0].closed && a.box.w > 150, a);
    await p.fill("#kxOpts #cdMW", "40"); await p.dispatchEvent("#kxOpts #cdMW", "change"); await p.waitForTimeout(150);
    const area = () => ev(() => { const L = window.imageEditorInstance.E.layer(), Q = window.PCPath; return Math.abs(Q.signedArea(Q.flatten(L.shape.path.subs[0], 0.5))); });
    const a0 = await ev(() => 0) || 0; void a0;
    const wide = await area();
    await key("Control+z"); const narrow = await area(); await key("Control+Shift+z");
    check("...its width from the bar (the outline regenerated: more than twice the area)", wide > narrow * 2, [narrow, wide]);
    await ev(() => { const s = document.querySelector("#kxOpts #cdMM"); s.value = "sprayer"; s.dispatchEvent(new Event("change")); }); await p.waitForTimeout(250);
    a = await A();
    check("...Sprayer: the same stroke as sprayed stars", a.media && a.subs.length >= 4, a.subs.length);

    /* 6 dimensions + callout */
    await tool("cdimhv"); await click(50, 50); await click(250, 50); await click(150, 30);
    a = await ev(() => { const E = window.imageEditorInstance.E, G = E.dimGroups.groupOf(E.layer()); if (!G) return null; const k = E.S.layers.filter((x) => x.parent === G.id);
      return { kind: G.dimg.kind, parts: k.map((x) => x.dimPart + ":" + x.shape.line.start + "/" + x.shape.line.end).sort().join(), text: k.find((x) => x.dimPart === "line").shape.line.labels[0].text }; });
    check("Horizontal / Vertical Dimension (2.457.0: a dimension group): 2 extension lines (no arrows) + the dimension line with its two arrowheads, horizontal, labelled 200 px",
      a && a.kind === "horizontal" && a.parts === "ext1:none/none,ext2:none/none,line:arrow/arrow" && a.text === "200 px", a);
    await tool("cdimang"); await click(620, 520); await click(760, 520); await click(620, 380); await click(680, 470);
    a = await A();
    check("Angular Dimension: the arms and the arc, 90°", a.line.labels[0].text === "90°" && a.subs.length === 3, a.line.labels);
    await ev(() => { window.imageEditorInstance.E.S.cd.ctext = "Look here"; }); await tool("ccallout"); await click(560, 300); await click(600, 380); await click(700, 380);
    a = await A();
    check("3-Point Callout: an arrow at the point, the text after the end", a.line.start === "arrow" && a.line.end === "none" && a.line.labels[0].text === "Look here" && a.subs[0].n === 3, a.line);

    /* 7 a connector follows */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.setActive(S.layers.findIndex((x) => x.name === "Rectangle 1")); });
    await tool("cconnect"); await drag([250, 110], [420, 100]);
    a = await A();
    const c0 = a.box;
    check("Connector: from the rectangle's right side to the ellipse's left side (right-angle), connected to both", a.line.connect && a.line.connect.a.at === "e" && a.line.connect.b.at === "w" && a.line.connect.kind === "right", a.line.connect);
    // move the ellipse down with the Move tool: the connector follows
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.setActive(S.layers.findIndex((x) => x.name === "Ellipse 1")); }); await tool("move");
    await drag([490, 100], [490, 220]);
    await p.waitForTimeout(400);
    const c1 = await ev(() => { const S = window.imageEditorInstance.state, L = S.layers.find((x) => x.name === "Connector 1"); return window.PCPath.bbox(L.shape.path); });
    check("...the ellipse moved down 120 px: the connector re-routed to it", Math.round(c1.y + c1.h) > Math.round(c0.y + c0.h) + 80, [c0, c1]);

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the run stopped: " + (e && e.stack || e));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
