#!/usr/bin/env node
/* bitGen Studio — 2.438.0 in a REAL browser: the image editor's Layers / Colour groups as FLOATING DOCKERS, NAMED
 * DOCKERS (static/floatpanels.js, ext/imageeditdock/pcpanels.js), DIALOGS IN THE MIDDLE / WHERE THEY WERE LEFT
 * (static/dlglayout.js), the 🧰 Tools & Properties confined to the timeline docker, Shift+Del.
 * Tim: "in image docker make layers tab group and color tab group into floating dockers that can resize. create an
 * empty floating docker that can be named ..." / "put message boxes and dialogs in the center of the screen by
 * default. remember their locations if moved in file dialog_layout.cfg" / "tools and properties should be confined to
 * the timeline docker" / "shift+del deletes selected layer".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the floating dockers / dialogs browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const LAYF = ["dialog_layout.cfg", "panel_layout.cfg"].map((f) => path.join(ROOT, f));

(async () => {
  const keep = LAYF.map((f) => (fs.existsSync(f) ? fs.readFileSync(f) : null));
  LAYF.forEach((f) => fs.rmSync(f, { force: true }));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  /** the JSON file once ok(it) (the server may be slow under load) - up to 15 s */
  const fileWhen = async (f, ok) => { for (let i = 0; i < 60; i++) { try { const o = JSON.parse(fs.readFileSync(f, "utf8")); if (ok(o)) return o; } catch (e) { /* not yet */ } await p.waitForTimeout(250); } try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return {}; } };
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const boot = async () => {
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.panels && window.H3Panels, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
  };
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await boot();
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E; E.docs.setTabs(true); E.openDoc(300, 200, "panels.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 300, 200); }); E.addLayer(E.makeLayer("Second", 300, 200), "t", false); });

    /* 1 the editor's dialogs open in the middle of the screen */
    await ev(() => window.imageEditorInstance.E.ui.run("edit.fill")); await p.waitForTimeout(300);
    const d1 = await ev(() => { const d = document.querySelector(".kxdlg.pcd"), r = d.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, vw: innerWidth, vh: innerHeight }; });
    await shot("1-fill-centred");
    check("the editor's dialogs (Edit ▸ Fill…) open in the middle of the screen", Math.abs(d1.cx - d1.vw / 2) < 4 && Math.abs(d1.cy - d1.vh / 2) < 4, d1);
    // moved by its title -> kept in dialog_layout.cfg
    const h = await (await p.$(".kxdlg.pcd h4")).boundingBox();
    await p.mouse.move(h.x + 30, h.y + 8); await p.mouse.down(); await p.mouse.move(h.x - 270, h.y - 180, { steps: 8 }); await p.mouse.up();
    const moved = await ev(() => { const r = document.querySelector(".kxdlg.pcd").getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; });
    const cfg1 = await fileWhen(LAYF[0], (o) => o["@Fill"]);
    check("...dragged by its title: where it was left is kept in dialog_layout.cfg (by its title)", cfg1["@Fill"] && Math.abs(cfg1["@Fill"].x - moved.x) <= 2 && Math.abs(cfg1["@Fill"].y - moved.y) <= 2, { cfg1, moved });
    await ev(() => document.querySelector(".kxdlg.pcd .cn").click());
    await ev(() => window.imageEditorInstance.E.ui.run("edit.fill")); await p.waitForTimeout(300);
    const again = await ev(() => { const r = document.querySelector(".kxdlg.pcd").getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; });
    check("...opened again: where it was left", Math.abs(again.x - moved.x) <= 2 && Math.abs(again.y - moved.y) <= 2, { again, moved });
    await ev(() => document.querySelector(".kxdlg.pcd .cn").click());

    /* 2 Shift+Del deletes the selected layer */
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => document.getElementById("ieStage").focus()); await p.keyboard.press("Shift+Delete"); await p.waitForTimeout(200);
    const n1 = await ev(() => window.imageEditorInstance.E.S.layers.map((L) => L.name));
    check("Shift+Del deletes the selected layer", n1.length === n0 - 1 && !n1.includes("Second"), n1);

    /* 3 the Layers group floats, resizes, goes back */
    const fl = await ev(() => !!document.querySelector('#pcPanels .pcgrp[data-g="layers"] .pcfloat') && !!document.querySelector('#pcPanels .pcgrp[data-g="color"] .pcfloat'));
    check("⇱ on the Layers and Colour groups' tab strips", fl);
    await p.click('.pcgrp[data-g="layers"] .pcfloat'); await p.waitForTimeout(400);
    await shot("3-layers-floating");
    const f1 = await ev(() => { const w = document.querySelector('.h3fp[data-fp="ie.layers"]'), r = w.getBoundingClientRect(), kx = document.querySelector(".kx");
      return { inKx: kx.contains(w), shown: r.width > 100 && r.height > 100, hasLayers: !!w.querySelector("#pcLayers"), col: !!document.querySelector('#pcPanels .pcgrp[data-g="layers"]'), grips: w.querySelectorAll(".dfg").length, title: w.querySelector(".h3fp-n").textContent, r: [r.left, r.top, r.width, r.height] }; });
    check("⇱ Layers: a floating docker of its own inside the editor (its title, the layer list in it, out of the column), 8 resize grips", f1.inKx && f1.shown && f1.hasLayers && !f1.col && f1.grips === 8 && f1.title === "Layers", f1);
    // resize by the bottom-right corner
    const br = await ev(() => { const g = document.querySelector('.h3fp[data-fp="ie.layers"] .dfg-se').getBoundingClientRect(); return [g.left + g.width / 2, g.top + g.height / 2]; });
    await p.mouse.move(br[0], br[1]); await p.mouse.down(); await p.mouse.move(br[0] + 60, br[1] + 50, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(600);
    const f2 = await ev(() => { const r = document.querySelector('.h3fp[data-fp="ie.layers"]').getBoundingClientRect(); return [r.width, r.height]; });
    check("...every edge sizes it (the corner: +60 × +50)", Math.abs(f2[0] - f1.r[2] - 60) < 4 && Math.abs(f2[1] - f1.r[3] - 50) < 4, { before: f1.r, after: f2 });
    // dragged out of the editor: it stays inside it
    const tb = await (await p.$('.h3fp[data-fp="ie.layers"] .h3fp-t')).boundingBox();
    await p.mouse.move(tb.x + 40, tb.y + 10); await p.mouse.down(); await p.mouse.move(-400, -300, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
    const f3 = await ev(() => { const r = document.querySelector('.h3fp[data-fp="ie.layers"]').getBoundingClientRect(), k = document.querySelector(".kx").getBoundingClientRect(); return { r: [r.left, r.top], k: [k.left, k.top] }; });
    check("...dragged off the top-left: it stays inside the editor", f3.r[0] >= f3.k[0] - 1 && f3.r[1] >= f3.k[1] - 1, f3);

    /* 4 a named docker; the floating group docked in it as a tab */
    await ev(() => window.H3Panels.newDocker({ name: "My tools", confine: document.querySelector(".kx").id }));
    await p.waitForTimeout(300);
    const nd = await ev(() => { const d = window.H3Panels.list().find((x) => x.kind === "docker"); const w = document.querySelector(`.h3fp[data-fp="${d.id}"]`); return { id: d.id, title: w.querySelector(".h3fp-n").textContent, empty: !!w.querySelector(".h3fd-empty"), confine: d.confine, inKx: document.querySelector(".kx").contains(w) }; });
    check("a named docker: empty ('drag a floating docker here'), its name, confined to the image editor", nd.title === "My tools" && nd.empty && nd.confine === "ieKx" && nd.inKx, nd);
    // place it, then drag the Layers window by its title onto it
    await ev((id) => { const r = window.H3Panels.get(id); r.x = 200; r.y = 200; r.w = 320; r.h = 360; window.H3Panels.float(id, { x: 200, y: 200, w: 320, h: 360 }); }, nd.id);
    await p.waitForTimeout(200);
    const tb2 = await (await p.$('.h3fp[data-fp="ie.layers"] .h3fp-t')).boundingBox();
    await p.mouse.move(tb2.x + 40, tb2.y + 10); await p.mouse.down(); await p.mouse.move(300, 320, { steps: 10 });
    const lit = await ev((id) => document.querySelector(`.h3fp[data-fp="${id}"]`).classList.contains("drop"), nd.id);
    await p.mouse.up(); await p.waitForTimeout(400);
    await shot("4-docked-in-named");
    const dk = await ev((id) => { const r = window.H3Panels.get("ie.layers"), d = window.H3Panels.get(id); return { state: r.state, docker: r.docker, tabs: d.tabs, tab: [...document.querySelectorAll(`.h3fp[data-fp="${id}"] .h3fd-tab`)].map((x) => x.textContent), inPane: !!document.querySelector(`.h3fp[data-fp="${id}"] .h3fd-pane #pcLayers`) }; }, nd.id);
    check("...dragged over it by its title it lights up; dropped = docked in it as a tab (the layer list inside)", lit && dk.state === "in" && dk.docker === nd.id && dk.tabs.join() === "ie.layers" && /Layers/.test(dk.tab[0]) && dk.inPane, { lit, dk });
    // the Colour group in it too: two tabs, a click switches
    await ev((id) => window.H3Panels.dockInto("ie.color", id), nd.id); await p.waitForTimeout(200);
    await p.click(`.h3fp[data-fp="${nd.id}"] .h3fd-tab[data-t="ie.layers"] span`); await p.waitForTimeout(150);
    const tabs2 = await ev((id) => ({ t: [...document.querySelectorAll(`.h3fp[data-fp="${id}"] .h3fd-tab`)].map((x) => x.dataset.t + (x.classList.contains("on") ? "*" : "")), layersShown: document.querySelector('.h3fp[data-fp="ie.layers"]').getBoundingClientRect().height > 0, colorShown: document.querySelector('.h3fp[data-fp="ie.color"]').getBoundingClientRect().height > 0 }), nd.id);
    check("...the Colour group docked too: two tabs, a click shows that one", tabs2.t.join() === "ie.layers*,ie.color" && tabs2.layersShown && !tabs2.colorShown, tabs2);
    // ⚙: main docker / confined to … / rename / delete
    const m = await ev((id) => { const w = document.querySelector(`.h3fp[data-fp="${id}"] .h3fp-cfg`).getBoundingClientRect(); window.H3Panels.cfgMenu(id, w.left, w.bottom); return [...document.querySelectorAll(".h3fp-menu div")].map((x) => x.textContent); }, nd.id);
    await p.keyboard.press("Escape"); await p.mouse.click(5, 990); await ev(() => document.querySelectorAll(".h3fp-menu").forEach((x) => x.remove()));
    check("⚙ on a named docker: Rename…, Main docker, Confined to <each docker> (the timeline, the image editor …), Delete", m.includes("Rename…") && m.some((x) => /^Main docker/.test(x)) && m.some((x) => /Confined to .*Image editor/.test(x)) && m.some((x) => /Confined to/.test(x) && /Timeline|timelinedock/i.test(x)) && m.includes("Delete this docker"), m);
    await ev((id) => window.H3Panels.rename(id, "Layers & colour"), nd.id);
    const pl = await fileWhen(LAYF[1], (o) => o.dockers && o.dockers[nd.id] && o.dockers[nd.id].name === "Layers & colour");
    check("panel_layout.cfg keeps it: the named docker (name, confined to, tabs, active), each group's place", pl.dockers && pl.dockers[nd.id] && pl.dockers[nd.id].name === "Layers & colour" && pl.dockers[nd.id].confine === "ieKx" && pl.dockers[nd.id].tabs.join() === "ie.layers,ie.color"
      && pl.panels["ie.layers"].state === "in" && pl.panels["ie.layers"].docker === nd.id, pl);

    /* 5 a reload: everything back where it was */
    await p.reload({ waitUntil: "domcontentloaded" }); await boot(); await p.waitForTimeout(800);
    const back = await ev((id) => { const r = window.H3Panels.get("ie.layers"), d = window.H3Panels.get(id); return { st: r && r.state, dk: r && r.docker, name: d && d.title, tabs: d && d.tabs.join(), pane: !!document.querySelector(`.h3fp[data-fp="${id}"] #pcLayers`) }; }, nd.id);
    check("...after a reload the named docker is back, its name, both groups docked in it as before", back.st === "in" && back.dk === nd.id && back.name === "Layers & colour" && back.tabs === "ie.layers,ie.color" && back.pane, back);
    // float a tab out (⇱), then ⇲ home
    await ev(() => document.querySelector('.h3fd-tab[data-t="ie.color"] button').click()); await p.waitForTimeout(250);
    const out = await ev(() => window.H3Panels.get("ie.color").state);
    await ev(() => document.querySelector('.h3fp[data-fp="ie.color"] .h3fp-home').click()); await p.waitForTimeout(250);
    const hm = await ev(() => ({ st: window.H3Panels.get("ie.color").state, inCol: !!document.querySelector('#pcPanels .pcgrp[data-g="color"]') }));
    check("a tab's ⇱ floats it out again; ⇲ puts it back in the right column", out === "float" && hm.st === "home" && hm.inCol, { out, hm });
    // delete the named docker: what was in it goes back home
    await ev((id) => window.H3Panels.remove(id), nd.id); await p.waitForTimeout(250);
    const del = await ev(() => ({ st: window.H3Panels.get("ie.layers").state, dockers: window.H3Panels.list().filter((x) => x.kind === "docker").length }));
    check("Delete the docker: the groups in it go back to their place", del.st === "home" && del.dockers === 0, del);

    /* 6 a main-app message box in the middle; a main named docker anywhere */
    await p.click("#kxFull").catch(() => {}); await p.waitForTimeout(400);
    await ev(() => { appNote("hello from the test", "Note"); });
    await p.waitForTimeout(300);
    const nb = await ev(() => { const r = document.getElementById("notedlg").getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, vw: innerWidth, vh: innerHeight }; });
    await shot("6-note-centred");
    check("a message box (appNote) in the middle of the screen", Math.abs(nb.cx - nb.vw / 2) < 4 && Math.abs(nb.cy - nb.vh / 2) < 4, nb);
    await ev(() => { const d = document.getElementById("notedlg"); d.querySelector("button") ? d.querySelector("button").click() : d.close(); });

    /* 7 🧰 Tools & Properties stays inside the timeline docker */
    await ev(() => { const d = document.getElementById("timelinedock"); if (d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("timelinedock", "tTL"); if (/collapsed/.test(d.className)) toggleCollapse("timelinedock"); if (typeof setVar === "function") setVar("th", 560);
      const ie = document.getElementById("imageeditdock"); if (ie && !ie.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("imageeditdock", "tIE"); });   // the timeline gets the row's width
    await p.waitForTimeout(500);
    const tf = await ev(() => { const F = document.getElementById("tlFloat"); if (F.dataset.side) { const b = F.querySelector('.tsd-side[data-side="' + F.dataset.side + '"]'); if (b) b.click(); } if (F.classList.contains("off") && window.TlFloat && TlFloat.toggle) TlFloat.toggle(); else if (F.classList.contains("off")) document.dispatchEvent(new KeyboardEvent("keydown", { key: "1" })); return !F.classList.contains("off"); });
    await p.waitForTimeout(300);
    const tt = await (await p.$("#tlFloat .tsd-title")).boundingBox();
    await p.mouse.move(tt.x + 60, tt.y + 10); await p.mouse.down(); await p.mouse.move(20, 20, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
    await shot("7-toolbox-confined");
    const tc = await ev(() => { const r = document.getElementById("tlFloat").getBoundingClientRect(), t = document.getElementById("timelinedock").getBoundingClientRect(), s = document.getElementById("tlStage").getBoundingClientRect(); return { r: [r.left, r.top, r.right, r.bottom], t: [t.left, t.top, t.right, t.bottom], s: [s.left, s.top, s.right, s.bottom, s.width, s.height], vis: getComputedStyle(document.getElementById("tlFloat")).visibility }; });
    const inStage = tc.s[4] >= 220 && tc.s[5] >= 140;
    check("🧰 Tools & Properties dragged to the top of the window: it stays inside the timeline docker - over its preview row (the tracks and the menu bar stay free); always visible", tf && tc.vis === "visible" && (inStage ? tc.r[1] >= tc.s[1] - 1 && tc.r[0] >= tc.s[0] - 1 && tc.r[3] <= tc.s[3] + 1 : tc.r[0] >= tc.t[0] - 1 && tc.r[1] >= tc.t[1] - 1 && tc.r[2] <= tc.t[2] + 1 && tc.r[3] <= tc.t[3] + 1), tc);
    // collapsed, the timeline docker takes its toolbox with it
    await ev(() => toggleCollapse("timelinedock")); await p.waitForTimeout(1800);
    const hid = await ev(() => getComputedStyle(document.getElementById("tlFloat")).visibility);
    await ev(() => toggleCollapse("timelinedock")); await p.waitForTimeout(1800);
    const vis = await ev(() => getComputedStyle(document.getElementById("tlFloat")).visibility);
    check("...the timeline docker collapsed: the toolbox goes with it; opened again: back", hid === "hidden" && vis === "visible", { hid, vis });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    LAYF.forEach((f, i) => { if (keep[i]) fs.writeFileSync(f, keep[i]); else fs.rmSync(f, { force: true }); });
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
