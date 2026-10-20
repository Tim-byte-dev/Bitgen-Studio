#!/usr/bin/env node
/* bitGen Studio — 2.545.0 in a REAL browser: ▣ Docker (static/dockgroup.js + static/floatpanels.js's row / column layout).
 * Tim: "do we have a way to add an empty docker with dropzones for other dockers. should be able to be horizontal or
 * vertical with a editable titlebar, ctrl+alt+D can open it and add the button to the statustbar list of dockers.
 * Storyboard docker changes it's name back to videodocker, keep it as storyboard throughout".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the ▣ Docker browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const LAYF = path.join(ROOT, "panel_layout.cfg");

(async () => {
  const keep = fs.existsSync(LAYF) ? fs.readFileSync(LAYF) : null;
  fs.rmSync(LAYF, { force: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  /** what the server keeps (panel_layout.cfg through /api/layout/panel) once ok(it) - up to 30 s (a busy server saves late) */
  const fileWhen = async (ok) => { let o = {}; for (let i = 0; i < 60; i++) { try { o = await ev(() => fetch("/api/layout/panel").then((r) => r.json())); if (ok(o)) return o; } catch (e) { /* not yet */ } await p.waitForTimeout(500); } return o; };
  try {
    await p.goto(URL_, { waitUntil: "load" });
    await p.waitForFunction(() => window.H3DockGroup && document.getElementById("tDG") && document.getElementById("dgFloat_musicdock") && document.getElementById("dgFloat_stemsdock"), null, { timeout: 60000 });
    const q = await ev(() => { const b = document.getElementById("tDG"); return { after: b.previousElementSibling && b.previousElementSibling.id, text: b.textContent, on: b.classList.contains("on") }; });
    check("▣ Docker is in the statusbar's dockers (after Queue), dark while hidden", q.after === "tQ" && q.text === "▣ Docker" && !q.on, q);

    await p.keyboard.press("Control+Alt+KeyD");
    await p.waitForFunction(() => window.H3DockGroup.shown(), null, { timeout: 8000 }).catch(() => {});
    const g = await ev(() => { const r = H3Panels.get("fd-dockers"); const w = r && r.win; return { shown: H3DockGroup.shown(), name: r && r.title, layout: r && r.layout, empty: w && w.querySelector(".h3fd-empty").textContent, lay: w && w.querySelector(".h3fp-lay").textContent, lit: document.getElementById("tDG").classList.contains("on"), row: !!(w && w.querySelector(".h3fd.lay-row")) }; });
    check("Ctrl+Alt+D shows an EMPTY docker - \"Docker\", side by side (⇆), saying what to drop in; the button lights", g.shown && g.name === "Docker" && g.layout === "row" && g.row && /Drag a floating docker here/.test(g.empty) && g.lay === "⇆" && g.lit, g);
    await shot("545-empty");

    // the title edited in place
    await p.dblclick('.h3fp[data-fp="fd-dockers"] > .h3fp-t .h3fp-n');
    const inp = await p.$('.h3fp[data-fp="fd-dockers"] > .h3fp-t .h3fp-n input');
    check("double-click its title = a box in the title bar", !!inp);
    if (inp) { await inp.fill("My dockers"); await p.keyboard.press("Enter"); }
    const nm = await ev(() => ({ t: H3Panels.get("fd-dockers").title, txt: document.querySelector('.h3fp[data-fp="fd-dockers"] > .h3fp-t .h3fp-n').textContent }));
    check("Enter keeps the new name (the title bar shows it)", nm.t === "My dockers" && nm.txt === "My dockers", nm);
    await p.dblclick('.h3fp[data-fp="fd-dockers"] > .h3fp-t .h3fp-n');
    await p.keyboard.type("zzz"); await p.keyboard.press("Escape");
    check("Esc drops an edit", (await ev(() => H3Panels.get("fd-dockers").title)) === "My dockers");

    // float Music and Stems with ⇱, drag them in
    const box = async () => ev(() => { const r = document.querySelector('.h3fp[data-fp="fd-dockers"] .h3fd-pane').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const dragIn = async (id, fx, fy) => {
      const t = await ev((i) => { const r = document.querySelector('.h3fp[data-fp="' + i + '"] > .h3fp-t').getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; }, id);
      await p.mouse.move(t.x, t.y); await p.mouse.down();
      const B = await box();
      await p.mouse.move(B.x + B.w * fx, B.y + B.h * fy, { steps: 12 });
      const mk = await ev(() => { const m = [...document.querySelectorAll("div")].find((d) => d.style && d.style.position === "fixed" && /2px|4px/.test(d.style.width + d.style.height) && d.style.display !== "none" && d.offsetWidth > 0); return !!m; });
      await p.mouse.up();
      return mk;
    };
    await ev(() => document.getElementById("dgFloat_musicdock").click());   // under the floating windows here
    await p.waitForFunction(() => (H3Panels.get("bd.musicdock") || {}).state === "float", null, { timeout: 8000 }).catch(() => {});
    const fl = await ev(() => ({ st: H3Panels.get("bd.musicdock").state, inWin: !!document.querySelector('.h3fp[data-fp="bd.musicdock"] #musicdock'), head: getComputedStyle(document.querySelector("#musicdock > .bhead")).display }));
    check("⇱ on Music's title bar floats it - a window of its own (its own header hidden: the window's title)", fl.st === "float" && fl.inWin && fl.head === "none", fl);
    await dragIn("bd.musicdock", 0.5, 0.5);
    let m = await ev(() => ({ st: H3Panels.get("bd.musicdock").state, d: H3Panels.get("bd.musicdock").docker, tabs: H3Panels.get("fd-dockers").tabs }));
    check("dragged by its title over the docker = in it", m.st === "in" && m.d === "fd-dockers" && m.tabs.join() === "bd.musicdock", m);
    await ev(() => document.getElementById("dgFloat_stemsdock").click());
    await p.waitForFunction(() => (H3Panels.get("bd.stemsdock") || {}).state === "float", null, { timeout: 8000 }).catch(() => {});
    const mk = await dragIn("bd.stemsdock", 0.1, 0.5);
    m = await ev(() => { const d = H3Panels.get("fd-dockers"); const ws = d.tabs.map((t) => H3Panels.get(t).win.getBoundingClientRect()); return { tabs: d.tabs, x: ws.map((r) => Math.round(r.left)), y: ws.map((r) => Math.round(r.top)), vis: ws.map((r) => r.width > 50 && r.height > 50), splits: document.querySelectorAll('.h3fp[data-fp="fd-dockers"] .h3fd-split').length }; });
    check("a drop on the LEFT side goes before Music (the orange line showed where) - both show, side by side, a splitter between",
      mk && m.tabs.join() === "bd.stemsdock,bd.musicdock" && m.x[0] < m.x[1] && Math.abs(m.y[0] - m.y[1]) < 3 && m.vis.every(Boolean) && m.splits === 1, { mk, m });
    await shot("545-row");

    // the splitter sizes them
    const sp = await ev(() => { const r = document.querySelector('.h3fp[data-fp="fd-dockers"] .h3fd-split').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const w0 = await ev(() => H3Panels.get("bd.stemsdock").win.getBoundingClientRect().width);
    await p.mouse.move(sp.x, sp.y); await p.mouse.down(); await p.mouse.move(sp.x + 120, sp.y, { steps: 8 }); await p.mouse.up();
    const w1 = await ev(() => ({ w: H3Panels.get("bd.stemsdock").win.getBoundingClientRect().width, g: H3Panels.get("bd.stemsdock").grow }));
    check("dragging the splitter sizes them (kept as each one's share)", w1.w > w0 + 60 && w1.g > 1, { w0, w1 });

    // vertical
    await p.click('.h3fp[data-fp="fd-dockers"] > .h3fp-t .h3fp-lay');
    m = await ev(() => { const d = H3Panels.get("fd-dockers"); const ws = d.tabs.map((t) => H3Panels.get(t).win.getBoundingClientRect()); return { layout: d.layout, lay: d.win.querySelector(".h3fp-lay").textContent, x: ws.map((r) => Math.round(r.left)), y: ws.map((r) => Math.round(r.top)) }; });
    check("⇆ -> ⇅ = stacked (vertical): one above the other", m.layout === "col" && m.lay === "⇅" && m.y[0] < m.y[1] && Math.abs(m.x[0] - m.x[1]) < 3, m);
    await shot("545-col");
    const saved = await fileWhen((o) => o.dockers && o.dockers["fd-dockers"] && o.dockers["fd-dockers"].layout === "col");
    const sd = (saved.dockers || {})["fd-dockers"] || {};
    check("panel_layout.cfg keeps it: the name, stacked, what is in it in order, the sizes", sd.name === "My dockers" && sd.layout === "col" && (sd.tabs || []).join() === "bd.stemsdock,bd.musicdock" && ((saved.panels || {})["bd.stemsdock"] || {}).grow > 1, sd);

    // tabs from ⚙
    await ev(() => H3Panels.setLayout("fd-dockers", "tabs"));
    const tb = await ev(() => { const w = H3Panels.get("fd-dockers").win; return { tabs: w.querySelectorAll(".h3fd-tabs > *").length, hid: [...w.querySelectorAll(".h3fd-pane > .h3fp.in")].filter((x) => x.classList.contains("hid")).length }; });
    check("⚙ Layout: Tabs - one shows at a time again", tb.tabs >= 2 && tb.hid === 1, tb);
    await ev(() => H3Panels.setLayout("fd-dockers", "row"));

    // ⇲ puts Music back
    await p.click('.h3fp[data-fp="bd.musicdock"] > .h3fp-t .h3fp-home');
    const back = await ev(() => ({ st: H3Panels.get("bd.musicdock").state, home: document.getElementById("musicdock").parentNode.id, cls: document.getElementById("musicdock").classList.contains("dg-floating"), tabs: H3Panels.get("fd-dockers").tabs }));
    check("⇲ in Music's title puts it back in the main window", back.st === "home" && !back.cls && back.tabs.join() === "bd.stemsdock", back);

    // the button hides it again
    await p.click("#tDG");
    const off = await ev(() => ({ shown: H3DockGroup.shown(), lit: document.getElementById("tDG").classList.contains("on") }));
    check("▣ Docker in the statusbar hides it (dark again)", !off.shown && !off.lit, off);
    await p.keyboard.press("Control+Alt+KeyD");
    check("...and Ctrl+Alt+D shows it again (the same one, Stems still in it)", (await ev(() => H3DockGroup.shown() && H3Panels.get("fd-dockers").tabs.join())) === "bd.stemsdock");

    // the StoryBoard keeps its name
    const sb = await ev(() => {
      const h = document.querySelector("#videodock > .bhead"), out = [], txt = () => [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
      out.push(txt()); toggleCollapse("videodock"); out.push(txt()); toggleCollapse("videodock"); out.push(txt());
      return { out, btn: document.getElementById("tV").textContent };
    });
    check("the StoryBoard stays \"StoryBoard\" - collapsed and opened again (it said \"videodock\")", sb.out[0] === "▾ StoryBoard" && sb.out[1] === "▸ StoryBoard" && sb.out[2] === "▾ StoryBoard" && sb.btn === "StoryBoard", sb);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    if (keep) fs.writeFileSync(LAYF, keep); else fs.rmSync(LAYF, { force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
