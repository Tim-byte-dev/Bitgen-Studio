#!/usr/bin/env node
/* bitGen Studio — 2.637.0: SHIFT+RIGHT-CLICK LEAVES 🎨 ARTIST MODE (ext/imageeditdock/pcfocus.js) - pure + in jsdom.
 * Tim: "when in artist mode add a shift+right click to exit artist mode - the current shortcut does a windows operation" */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const FO = require(path.join(R0, "ext", "imageeditdock", "pcfocus.js"));
const m = (o) => Object.assign({ button: 2, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false }, o);
check("Shift + the right button in artist mode = exit", FO.mouseAction(m({}), { on: true }) === "exit");
check("…not outside artist mode, not a plain right click, not the left button, not with Ctrl / Alt / Meta",
  FO.mouseAction(m({}), { on: false }) === null && FO.mouseAction(m({ shiftKey: false }), { on: true }) === null && FO.mouseAction(m({ button: 0 }), { on: true }) === null
  && FO.mouseAction(m({ ctrlKey: true }), { on: true }) === null && FO.mouseAction(m({ altKey: true }), { on: true }) === null && FO.mouseAction(m({ metaKey: true }), { on: true }) === null);
check("Ctrl+Esc / Ctrl+Shift+F still leave it", FO.keyAction({ ctrlKey: true, key: "Escape" }, { on: true }) === "exit" && FO.keyAction({ ctrlKey: true, shiftKey: true, key: "f" }, { on: true }) === "exit");

/* in a page: the press leaves artist mode first (capture), the editor never sees it, the context menu is swallowed */
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<!doctype html><body><div id="imageeditdock"><div id="pcMenus"></div><div id="stage" tabindex="0"></div></div></body>', { pretendToBeVisual: true });
const w = dom.window, d = w.document;
let editorSaw = 0, menuShown = 0;
d.getElementById("stage").addEventListener("pointerdown", () => { editorSaw++; });
d.addEventListener("contextmenu", (e) => { if (!e.defaultPrevented) menuShown++; });
const E = { stage: d.getElementById("stage"), S: { fg: "#000000", bg: "#ffffff", size: 10, opacity: 1, flow: 1 }, ui: null,
  kx: d.getElementById("imageeditdock"), $: (id) => d.getElementById(id), store: { get: () => null, set: () => {} }, win: w, doc: d };
FO.install(E);
const setOn = () => E.focus && E.focus.set(true);
// 2.648.0: the press, its context menu, then the release (artist mode is left on the RELEASE - a Shift + right-DRAG zooms)
const press = (o, dy) => { const st = d.getElementById("stage"), ev = (t, x) => new w.MouseEvent(t, Object.assign({ bubbles: true, cancelable: true, button: 2, clientX: 100, clientY: 100 + (x || 0) }, o));
  st.dispatchEvent(ev("pointerdown")); st.dispatchEvent(ev("contextmenu")); if (dy) st.dispatchEvent(ev("pointermove", dy)); st.dispatchEvent(ev("pointerup", dy || 0)); };
if (!E.focus) { check("installed in a page", false, "E.focus missing - install needs another context"); }
else {
  setOn();
  check("artist mode on", E.focus.on() && d.body.classList.contains("ie-focus"));
  press({ shiftKey: false });
  check("a plain right click in artist mode: still in it (the editor gets it)", E.focus.on() && editorSaw === 1);
  press({ shiftKey: true }, 60);
  check("Shift + right-DRAG (2.648.0 - it zooms): still in artist mode, no context menu", E.focus.on() && editorSaw === 1 && menuShown === 1, { on: E.focus.on(), editorSaw, menuShown });
  press({ shiftKey: true });
  check("Shift+right-click: out of artist mode, the editor never saw the press, no context menu", !E.focus.on() && !d.body.classList.contains("ie-focus") && editorSaw === 1 && menuShown === 1, { on: E.focus.on(), editorSaw, menuShown });
  press({ shiftKey: true });
  check("outside artist mode Shift+right-click is left alone", editorSaw === 2 && menuShown === 2, { editorSaw, menuShown });
}
const PF = fs.readFileSync(path.join(R0, "ext", "imageeditdock", "pcfocus.js"), "utf8"), SC = JSON.parse(fs.readFileSync(path.join(R0, "docs", "shortcuts.json"), "utf8"));
check("its tooltip / note say Shift+right-click; the shortcuts list has it", /Shift\+right-click \(or Ctrl\+Esc\) back/.test(PF) && [].concat(...SC.groups.map((g) => g.rows)).some((r) => /^Shift\+right-click/.test(r[0])));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
