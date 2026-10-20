#!/usr/bin/env node
/* bitGen Studio — 2.549.0 in a REAL browser: ▣ Docker made useful (static/dockgroup.js + floatpanels.js setPerm), Ctrl+G
 * after a click in the Layers panel, a picture dropped on the canvas asks (imageedit.js).
 * Tim: "dragging an image onto the canvas from gallery,assets or references should give user option to add as layer or
 * add as new document ... newly created docker is useless, all other dockers are below it and can't be dragged into it
 * and it doesn't dock. it keeps it's name when open but the button is still called docker. add another 2 buttons to the
 * new docker titlebar - delete (removes the docker and it's button), make permanent. changes the titlebar to the regular
 * dockers titlebar ... group layers work from the context menu but not with the shortcut keys".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.549.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const LAYF = path.join(ROOT, "panel_layout.cfg");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const keep = fs.existsSync(LAYF) ? fs.readFileSync(LAYF) : null;
  fs.rmSync(LAYF, { force: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const open = async () => {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DockGroup && document.getElementById("dgFloat_musicdock") && document.getElementById("tDG"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
  };
  const serverLay = async (ok) => { let o = {}; for (let i = 0; i < 40; i++) { o = await ev(() => fetch("/api/layout/panel").then((r) => r.json())); if (ok(o)) return o; await p.waitForTimeout(400); } return o; };
  try {
    await open();
    const fl = await ev(() => { const b = document.getElementById("dgFloat_musicdock"); return { text: b.textContent, w: b.offsetWidth }; });
    check("⇱ on a main docker's title bar has its label again (it was an empty button since 2.545.0)", fl.text === "⇱" && fl.w > 10, fl);
    // the music docker open, a ▣ docker
    await ev(() => { const d = document.getElementById("musicdock"); if (d.classList.contains("dockgone")) toggleDockGone("musicdock", "tMu"); if (d.classList.contains("collapsed")) toggleCollapse("musicdock");
      const pd = document.getElementById("promptdock"); if (pd && !pd.classList.contains("dockgone")) { toggleDockGone("promptdock", "tP"); window.__pdHid = true; } });   // the floating prompt docker sits over Music's title bar in this layout
    await p.keyboard.press("Control+Alt+KeyD");
    await p.waitForFunction(() => window.H3DockGroup.shown(), null, { timeout: 8000 });
    // the ▣ docker somewhere it does not cover Music's title bar (Tim: "all other dockers are below it")
    await ev(() => { const h = document.querySelector("#musicdock > .bhead").getBoundingClientRect(), y = h.top > 470 ? 50 : h.bottom + 40; H3Panels.float("fd-dockers", { x: 300, y, w: 900, h: 380 }); });
    await p.waitForTimeout(300);

    /* 1 drag Music in by its own title bar */
    // a spot of Music's title bar nothing covers (the floating prompt docker sits over part of it in this layout)
    const head = await ev(() => { const h = document.querySelector("#musicdock > .bhead"), r = h.getBoundingClientRect(), y = r.top + r.height / 2;
      for (let x = r.left + 6; x < r.right - 6; x += 8) { const e = document.elementFromPoint(x, y); if (e && h.contains(e) && !e.closest("button")) return { x, y }; } return { x: r.left + 60, y }; });
    const tgt = await ev(() => { const r = document.querySelector('.h3fp[data-fp="fd-dockers"] .h3fd-pane').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const col0 = await ev(() => document.getElementById("musicdock").classList.contains("collapsed"));
    await p.mouse.move(head.x, head.y); await p.mouse.down(); await p.mouse.move(tgt.x, tgt.y, { steps: 14 });
    const mid = await ev(() => ({ tag: !!document.getElementById("dgDragTag") && document.getElementById("dgDragTag").textContent, line: !!document.getElementById("dgDropLine") && document.getElementById("dgDropLine").style.display !== "none" }));
    await p.mouse.up(); await p.waitForTimeout(400);
    const m1 = await ev(() => ({ st: (H3Panels.get("bd.musicdock") || {}).state, d: (H3Panels.get("bd.musicdock") || {}).docker, col: document.getElementById("musicdock").classList.contains("collapsed"), inWin: !!document.querySelector('.h3fp[data-fp="fd-dockers"] #musicdock') }));
    check("Music dragged by its OWN title bar (no ⇱ first) over ▣ Docker: a tag follows the pointer, the orange line shows where; let go = in it (not folded by the drag)",
      /→ Docker/.test(mid.tag || "") && mid.line && m1.st === "in" && m1.d === "fd-dockers" && m1.inWin && m1.col === col0, { mid, m1, col0 });

    /* 2 a click on a title bar still folds the docker */
    await ev(() => { const d = document.getElementById("consoledock"); if (d.classList.contains("dockgone")) toggleDockGone("consoledock", "tC"); });
    const c0 = await ev(() => document.getElementById("consoledock").classList.contains("collapsed"));
    await ev(() => document.querySelector("#consoledock > .bhead").click()); await p.waitForTimeout(200);
    check("a plain click on a title bar still folds / opens it", (await ev(() => document.getElementById("consoledock").classList.contains("collapsed"))) !== c0);
    await ev(() => document.querySelector("#consoledock > .bhead").click());

    /* 3 renamed: the statusbar button follows */
    await ev(() => H3Panels.rename("fd-dockers", "Audio")); await p.waitForTimeout(1300);
    check("renamed \"Audio\": its statusbar button says ▣ Audio", (await ev(() => document.getElementById("tDG").textContent)) === "▣ Audio");
    const tb = await ev(() => { const w = H3Panels.get("fd-dockers").win; return { perm: !!w.querySelector(".h3fp-perm"), del: !!w.querySelector(".h3fp-del") }; });
    check("its title bar has 📌 Make permanent and 🗑 Delete", tb.perm && tb.del, tb);

    /* 4 📌 Make permanent */
    await ev(() => H3Panels.get("fd-dockers").win.querySelector(".h3fp-perm").click()); await p.waitForTimeout(600);
    const pm = await ev(() => { const d = document.getElementById("dgp_fd-dockers"); if (!d) return null; const h = d.querySelector(".bhead");
      return { parent: d.parentNode.id, head: [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(""), btns: [...h.querySelectorAll("button")].map((x) => x.textContent),
        winIn: d.contains(H3Panels.get("fd-dockers").win), music: !!d.querySelector("#musicdock"), titleShown: getComputedStyle(H3Panels.get("fd-dockers").win.querySelector(".h3fp-t")).display, hgt: d.getBoundingClientRect().height }; });
    check("📌 Make permanent: a REGULAR docker in the main column - the regular title bar \"▾ Audio\" (⇱ 🗑 ⛶), the floating title gone, Music still in it",
      pm && pm.parent === "maincol" && pm.head === "▾ Audio" && pm.btns.join() === "⇱,🗑,⛶" && pm.winIn && pm.music && pm.titleShown === "none" && pm.hgt >= 170, pm);
    await ev(() => document.getElementById("tDG").click()); await p.waitForTimeout(300);
    const hid = await ev(() => ({ gone: document.getElementById("dgp_fd-dockers").classList.contains("dockgone"), lit: document.getElementById("tDG").classList.contains("on") }));
    await ev(() => document.getElementById("tDG").click()); await p.waitForTimeout(300);
    const shownAgain = await ev(() => !document.getElementById("dgp_fd-dockers").classList.contains("dockgone"));
    check("its statusbar button hides / shows it like the other dockers", hid.gone && !hid.lit && shownAgain, hid);
    await ev(() => document.querySelector("#dgp_fd-dockers > .bhead").click()); await p.waitForTimeout(200);
    const folded = await ev(() => ({ c: document.getElementById("dgp_fd-dockers").classList.contains("collapsed"), head: [...document.querySelector("#dgp_fd-dockers > .bhead").childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("") }));
    await ev(() => document.querySelector("#dgp_fd-dockers > .bhead").click()); await p.waitForTimeout(200);
    check("its title bar folds it (▸ Audio) and opens it again, like the others", folded.c && folded.head === "▸ Audio" && !(await ev(() => document.getElementById("dgp_fd-dockers").classList.contains("collapsed"))), folded);
    const lay = await serverLay((o) => o.dockers && o.dockers["fd-dockers"] && o.dockers["fd-dockers"].perm);
    check("kept in panel_layout.cfg: permanent, its height", !!((lay.dockers || {})["fd-dockers"] || {}).perm && lay.dockers["fd-dockers"].perm.h > 80, (lay.dockers || {})["fd-dockers"]);

    /* 5 opened again: still permanent, Music in it */
    await open(); await p.waitForTimeout(1500);
    const re = await ev(() => { const d = document.getElementById("dgp_fd-dockers"); return d ? { parent: d.parentNode.id, music: !!d.querySelector("#musicdock"), btn: document.getElementById("tDG") && document.getElementById("tDG").textContent } : null; });
    check("the app opened again: still a permanent docker in the main column, Music in it, the button ▣ Audio", re && re.parent === "maincol" && re.music && re.btn === "▣ Audio", re);
    // a floating docker dropped into the permanent one (its h3fp title over it)
    await ev(() => window.H3DockGroup.floatDock("stemsdock")); await p.waitForTimeout(400);
    const sh = await ev(() => { const r = document.querySelector('.h3fp[data-fp="bd.stemsdock"] > .h3fp-t').getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; });
    const pt = await ev(() => { const r = document.querySelector("#dgp_fd-dockers .h3fd-pane").getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
    await p.mouse.move(sh.x, sh.y); await p.mouse.down(); await p.mouse.move(pt.x, pt.y, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(400);
    check("a floating docker (Stems) dropped on the permanent docker goes in (at the left)", (await ev(() => H3Panels.get("fd-dockers").tabs.join())) === "bd.stemsdock,bd.musicdock");

    /* 6 ⇱ floats it again; 🗑 deletes it and its button, the dockers go home */
    await ev(() => document.querySelector("#dgp_fd-dockers .dgp-unperm").click()); await p.waitForTimeout(400);
    const un = await ev(() => ({ perm: !!document.getElementById("dgp_fd-dockers"), st: H3Panels.get("fd-dockers").state, title: getComputedStyle(H3Panels.get("fd-dockers").win.querySelector(".h3fp-t")).display }));
    check("⇱ on its title bar: a floating docker again (its own title bar back)", !un.perm && un.st === "float" && un.title !== "none", un);
    await ev(() => H3Panels.get("fd-dockers").win.querySelector(".h3fp-del").click());
    await p.waitForSelector("#note_ok", { state: "visible", timeout: 8000 }); await p.click("#note_ok"); await p.waitForTimeout(600);
    const del = await ev(() => ({ rec: !!H3Panels.get("fd-dockers"), btns: [...document.querySelectorAll("#statusbar button[data-dg]")].map((b) => b.id + ":" + b.textContent), musicHome: document.getElementById("musicdock").parentNode.id, stemsHome: document.getElementById("stemsdock").parentNode.id }));
    check("🗑 Delete (asked first): the docker is gone; Music and Stems back in the main column; the statusbar is back to ▣ Docker (makes a new one)",
      !del.rec && del.musicHome === "maincol" && del.stemsHome === "maincol" && del.btns.join() === "tDG:▣ Docker", del);

    await ev(() => { if (window.__pdHid) toggleDockGone("promptdock", "tP"); });
    /* 7 Ctrl+G after clicks in the Layers panel */
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForFunction(() => window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.multi, null, { timeout: 30000 });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 300; c.height = 200; window.imageEditorInstance.load(c.toDataURL("image/png"), "g549"); setTimeout(ok, 700); }));
    await ev(() => { const E = window.imageEditorInstance.E; for (const n of ["A", "B", "C"]) { E.newLayer(); E.layer().name = n; } E.multi.clear(); E.renderLayersPanel(); document.getElementById("prompt").focus(); });
    const row = async (nm, mods) => { const i = await ev((nm) => window.imageEditorInstance.E.S.layers.findIndex((L) => L.name === nm), nm); for (const m of mods || []) await p.keyboard.down(m); await p.click(`#kxLayers .kxlayer[data-i="${i}"] .nm`); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(150); };
    await row("A"); await row("C", ["Control"]);
    const before = await ev(() => ({ active: document.activeElement && (document.activeElement.id || document.activeElement.tagName), picks: window.imageEditorInstance.E.multi.list().map((L) => L.name) }));
    await p.keyboard.press("Control+g"); await p.waitForTimeout(300);
    const g = await ev(() => { const S = window.imageEditorInstance.E.S, G = S.layers.find((L) => L.type === "group"); return { group: G && G.name, kids: G ? S.layers.filter((L) => L.parent === G.id).map((L) => L.name) : [] }; });
    check("clicks in the Layers panel (A, Ctrl-click C - the focus was in the prompt box), then Ctrl+G: the keys reach the editor - A and C grouped",
      before.picks.sort().join() === "A,C" && g.group && g.kids.sort().join() === "A,C", { before, g });
    await p.keyboard.press("Control+g"); await p.waitForTimeout(300);
    check("...Ctrl+G again (the group selected): ungrouped", (await ev(() => window.imageEditorInstance.E.S.layers.some((L) => L.type === "group"))) === false);

    /* 8 a picture dropped on the canvas asks */
    const drop = async () => { await ev(() => { dragPayload = { type: "asset", kind: "images", name: "nope.png" }; const st = document.getElementById("ieStage"), dt = new DataTransfer(); dt.setData("text/plain", "x"); const r = st.getBoundingClientRect();
      st.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt })); st.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 50, clientY: r.top + 50 })); dragPayload = null; }); };
    // a real picture in the project's images to drop
    await ev(async () => { const c = document.createElement("canvas"); c.width = 64; c.height = 40; c.getContext("2d").fillRect(0, 0, 64, 40); const bl = await new Promise((r) => c.toBlob(r, "image/png")); const fd = new FormData(); fd.append("file", new File([bl], "drop549.png", { type: "image/png" })); window.__dn = (await (await fetch("/api/passets", { method: "POST", body: fd })).json()).name; });
    const dropReal = async () => { await ev(() => { dragPayload = { type: "asset", kind: "images", name: window.__dn }; const st = document.getElementById("ieStage"), dt = new DataTransfer(); dt.setData("text/plain", "x"); const r = st.getBoundingClientRect();
      st.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 50, clientY: r.top + 50 })); dragPayload = null; }); };
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length), d0 = await ev(() => (window.imageEditorInstance.E.docs && window.imageEditorInstance.E.docs.list ? window.imageEditorInstance.E.docs.list().length : 1));
    await dropReal();
    await p.waitForSelector("#ieDropAsk", { timeout: 5000 });
    const ask = await ev(() => [...document.querySelectorAll("#ieDropAsk [data-as]")].map((x) => x.textContent));
    check("a picture from the assets dropped on the open canvas ASKS: ▦ Add as a layer / 🗋 Open as a new document", ask.join("|") === "▦ Add as a layer|🗋 Open as a new document", ask);
    await p.click("#ieDropAsk [data-as=layer]");
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length > n, n0, { timeout: 8000 }).catch(() => {});   // the picture loads first
    const L1 = await ev(() => ({ n: window.imageEditorInstance.E.S.layers.length, w: window.imageEditorInstance.E.S.w, name: window.imageEditorInstance.E.layer().name }));
    check("...▦ Add as a layer: a new layer in the open picture (300 wide, still)", L1.n === n0 + 1 && L1.w === 300, L1);
    await dropReal(); await p.waitForSelector("#ieDropAsk", { timeout: 5000 }); await p.click("#ieDropAsk [data-as=doc]"); await p.waitForTimeout(900);
    const D1 = await ev(() => ({ w: window.imageEditorInstance.E.S.w, h: window.imageEditorInstance.E.S.h, docs: window.imageEditorInstance.E.docs && window.imageEditorInstance.E.docs.list ? window.imageEditorInstance.E.docs.list().length : null }));
    check("...🗋 Open as a new document: the picture opens as its own document (64 x 40)", D1.w === 64 && D1.h === 40 && (D1.docs == null || D1.docs === d0 + 1), { D1, d0 });
    await dropReal(); await p.waitForSelector("#ieDropAsk", { timeout: 5000 }); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    check("...Esc: neither (the menu gone, nothing added)", !(await ev(() => !!document.getElementById("ieDropAsk"))) && (await ev(() => window.imageEditorInstance.E.S.w)) === 64);
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
