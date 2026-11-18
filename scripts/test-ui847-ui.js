#!/usr/bin/env node
/* bitGen Studio — 2.847.0 in a REAL browser:
 *   🧲 the snap toggle buttons on the top strip (🧲 ┼ ◰ ▤): pressed / not, a kind dimmed while snapping is off;
 *     a point near a WP frame's edge snaps onto it (E.snapPoint), not when ▤ is off;
 *   ⟷ Page Width + ▯ (the margins left out): the area between the margins fills the view, ▯ again = the whole page;
 *   ▦ a table: ⊞ the handle at the caret, ⊞ Select Table -> the selection box; ◢ (Shift) -> narrower; a row's bottom edge
 *     dragged -> taller; 🎨 Table Style (width, banded rows); Del deletes it, Ctrl+Z brings it back;
 *   📅 the calendar: WP View ▸ Insert = a printed month (no database, only General + Style), Web View = a booking
 *     calendar, the tool column's 📅 (Image View) = a printed month.
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.calendar && window.imageEditorInstance.E.snapPoint, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    const run = (c) => ev((c) => window.imageEditorInstance.E.ui.run(c), c);
    /* ---- 🧲 the snap buttons */
    const btns = () => ev(() => [...document.querySelectorAll("#pcSnapBtns [data-snapk]")].map((x) => [x.dataset.snapk, x.textContent, x.getAttribute("aria-pressed"), x.style.opacity]));
    const b0 = await btns();
    await p.click('#pcSnapBtns [data-snapk="snap"]'); const b1 = await btns();
    await p.click('#pcSnapBtns [data-snapk="snap"]'); const b2 = await btns();
    check("🧲 the snap buttons on the top strip (🧲 ┼ ◰ ▤); 🧲 off dims the kinds, on again lights them",
      b0.map((x) => x[1]).join("") === "🧲┼◰▤" && b0[0][2] === "true" && b0[3][2] === "true" && b1[0][2] === "false" && b1.slice(1).every((x) => x[3] === "0.45") && b2[0][2] === "true" && b2[1][3] === "", { b0, b1, b2 });
    /* ---- a WP document */
    await run("file.newtextdoc"); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdnDpi").value = "96"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(900);
    const fr = await ev(() => { const L = window.imageEditorInstance.E.S.layers.find((l) => l.type === "doc" && l.doc); return L ? { x: L.doc.x, y: L.doc.y, w: L.doc.w, h: L.doc.h } : null; });
    const s1 = await ev(([x, y]) => window.imageEditorInstance.E.snapPoint([x, y], null), [fr.x + 3, fr.y + 300]);
    await p.click('#pcSnapBtns [data-snapk="frames"]');
    const s2 = await ev(([x, y]) => window.imageEditorInstance.E.snapPoint([x, y], null), [fr.x + 3, fr.y + 300]);
    const fOff = await ev(() => document.querySelector('#pcSnapBtns [data-snapk="frames"]').getAttribute("aria-pressed"));
    await p.click('#pcSnapBtns [data-snapk="frames"]');
    check("🧲 ▤ snap to WP frames: a point 3 px inside the frame's left edge goes onto it; ▤ off = it stays", fr && s1[0] === fr.x && s2[0] === fr.x + 3 && fOff === "false", { fr, s1, s2, fOff });
    /* ---- ⟷ Page Width without the margins */
    await ev(() => window.imageEditorInstance.E.store.set("pw.margins", true));
    await run("view.pagewidth"); await p.waitForTimeout(200);
    const z1 = await ev(() => ({ z: window.imageEditorInstance.E.S.zoom, on: document.getElementById("kxPageWM").classList.contains("on") }));
    await p.click("#kxPageWM"); await p.waitForTimeout(250);
    const z2 = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((l) => l.type === "doc" && l.doc), c = document.getElementById("ieCanvas").getBoundingClientRect(), st = document.getElementById("ieStage").getBoundingClientRect(); return { z: E.S.zoom, left: c.left + L.doc.x * c.width / E.S.w - st.left, right: st.right - (c.left + (L.doc.x + L.doc.w) * c.width / E.S.w), kept: E.store.get("pw.margins", true) }; });
    await p.click("#kxPageWM"); await p.waitForTimeout(250);
    const z3 = await ev(() => window.imageEditorInstance.E.S.zoom);
    check("⟷ Page Width with ▯ off: the page between its margins fills the view (bigger zoom, the frame's sides near the view's sides), kept; ▯ on = the whole page again",
      z2.z > z1.z * 1.05 && z2.left < 40 && z2.right < 40 && z2.kept === false && Math.abs(z3 - z1.z) < 0.01, { z1, z2, z3 });
    /* ---- ▦ the table */
    const st0 = await ev(() => ({ tool: window.imageEditorInstance.E.S.tool, ed: !!document.querySelector(".pcdocedit .pcdoc") }));
    if (!st0.ed) { await run("layer.docedit"); await p.waitForTimeout(400); }
    await ev(() => { const e = document.querySelector(".pcdocedit .pcdoc"); e.focus(); const s = getSelection(); s.selectAllChildren(e); s.collapseToEnd(); });
    await p.keyboard.type("Before the table");
    await run("doc.table.insert"); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pttR", "3"); await p.fill(".kxdlg.pcd #pttC", "3"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const handle = await ev(() => { const h = document.querySelector("#pcdtUi .pcdt-h"); return h ? getComputedStyle(h).display : null; });
    await run("doc.table.select"); await p.waitForTimeout(200);
    const box = await ev(() => { const bx = document.querySelector("#pcdtUi .pcdt-box"), t = document.querySelector(".pcdocedit .pcdoc table"), r = t.getBoundingClientRect(), q = bx.getBoundingClientRect(); return { d: bx.style.display, dl: Math.abs(q.left - r.left), dw: Math.abs(q.width - r.width) }; });
    check("▦ ⊞ the handle shows at the table with the caret; ⊞ Select Table = the selection box round it", handle === "block" && box.d === "block" && box.dl < 4 && box.dw < 6, { handle, box });
    const g = await ev(() => { const r = document.querySelector("#pcdtUi .pcdt-grip").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.keyboard.down("Shift"); await p.mouse.move(g[0], g[1]); await p.mouse.down(); await p.mouse.move(g[0] - 150, g[1], { steps: 5 }); await p.mouse.up(); await p.keyboard.up("Shift"); await p.waitForTimeout(200);
    const w1 = await ev(() => { const t = document.querySelector(".pcdocedit .pcdoc table"); return { w: JSON.parse(t.getAttribute("data-ts") || "{}").w, sw: t.style.width }; });
    check("▦ ◢ dragged left (Shift = the width only): the table narrower (a % of the frame, kept as its style)", w1.w > 10 && w1.w < 95 && w1.sw === w1.w + "%", w1);
    await ev(() => window.imageEditorInstance.E.docTable.deselect());
    const re = await ev(() => { const tr = document.querySelectorAll(".pcdocedit .pcdoc table tbody tr")[0], r = tr.getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.bottom - 1, h: r.height }; });
    await p.mouse.move(re.x, re.y); await p.waitForTimeout(80);
    const cur = await ev(() => getComputedStyle(document.querySelector(".pcdocedit .pcdoc")).cursor);
    await p.mouse.down(); await p.mouse.move(re.x, re.y + 40, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
    const rh = await ev(() => { const tr = document.querySelectorAll(".pcdocedit .pcdoc table tbody tr")[0]; return { h: tr.getBoundingClientRect().height, st: tr.style.height }; });
    check("▦ a row's bottom edge: the row-resize cursor; dragged down 40 px = that row taller (its own height)", /row-resize/.test(cur) && rh.h > re.h + 25 && /px$/.test(rh.st), { cur, re, rh });
    await ev(() => { const td = document.querySelector(".pcdocedit .pcdoc table tbody td"), s = getSelection(); s.setBaseAndExtent(td, 0, td, 0); });
    await run("doc.table.style"); await p.waitForTimeout(250);
    await p.fill(".kxdlg.pcd #tsW", "50"); await p.check(".kxdlg.pcd #tsBand"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(250);
    const sty = await ev(() => { const t = document.querySelector(".pcdocedit .pcdoc table"), rows = t.querySelectorAll("tbody tr"); return { w: t.style.width, ts: JSON.parse(t.getAttribute("data-ts")), b1: rows[1] && rows[1].cells[0].style.backgroundColor, b0: rows[0].cells[0].style.backgroundColor }; });
    check("▦ 🎨 Table Style: 50 % wide, banded rows (the second body row shaded)", sty.w === "50%" && sty.ts.band === true && !!sty.b1 && sty.b1 !== sty.b0, sty);
    await run("doc.table.select"); await p.waitForTimeout(150);
    await p.keyboard.press("Delete"); await p.waitForTimeout(250);
    const gone = await ev(() => !document.querySelector(".pcdocedit .pcdoc table"));
    await p.keyboard.press("Control+z"); await p.waitForTimeout(400);
    const back = await ev(() => !!document.querySelector(".pcdocedit .pcdoc table"));
    check("▦ Del deletes the picked table; Ctrl+Z brings it back", gone && back, { gone, back });
    await p.keyboard.press("Escape"); await ev(() => { const E = window.imageEditorInstance.E; if (E.docText && E.docText.stop) E.docText.stop(); E.setTool("move"); });
    await p.waitForTimeout(300);
    /* ---- 📅 the calendar on any page */
    await ev(() => window.imageEditorInstance.E.views.apply("wp")); await p.waitForTimeout(400);
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.filter((l) => l.cal).length);
    await p.click('#pcViewRibbon .cbtab[data-tab="insert"]'); await p.waitForTimeout(300);
    const wpBtn = await ev(() => { const x = document.querySelector('#pcViewRibbon .cbb[data-id="v_act_calendar"]'); if (x) x.click(); return !!(x && x.draggable); }); await p.waitForTimeout(600);
    const pc = await ev(() => { const L = window.imageEditorInstance.E.S.layers.filter((l) => l.cal).pop(); return L ? { mode: L.cal.mode, month: L.cal.month, dbOk: L.cal.dbOk, name: L.name } : null; });
    await ev(() => { const E = window.imageEditorInstance.E; E.calendar.settings(E.S.layers.filter((l) => l.cal).pop()); }); await p.waitForTimeout(400);
    const tabs = await ev(() => [...document.querySelectorAll(".kxdlg.pcd [data-ctab]")].filter((x) => x.style.display !== "none").map((x) => x.textContent));
    await p.selectOption("#pccMode", "booking"); await p.waitForTimeout(400);
    const tabs2 = await ev(() => [...document.querySelectorAll(".kxdlg.pcd [data-ctab]")].filter((x) => x.style.display !== "none").map((x) => x.textContent));
    await p.click('.kxdlg.pcd [data-ctab="rules"]');
    const rules = await ev(() => ["pccSvcAdd", "pccBuffer", "pccMaxDay", "pccApprove", "pccCancelH", "pccEmails", "pccClosedAdd"].every((id) => !!document.getElementById(id)));
    await p.click("#pccSvcAdd"); const svc = await ev(() => document.querySelectorAll("#pccSvc [data-svc]").length);
    await p.click(".kxdlg.pcd .cn"); await p.waitForTimeout(200);
    check("📅 WP View ▸ Insert ▸ Calendar: a printed month (this month, no database); its settings show General + Style only; Mode ▸ booking shows Opening hours, Services & rules (＋ Service), Database, Bookings",
      n0 + 1 === (await ev(() => window.imageEditorInstance.E.S.layers.filter((l) => l.cal).length)) && pc && pc.mode === "print" && /^\d{4}-\d{2}$/.test(pc.month) && pc.dbOk === undefined && pc.name === "📅 Calendar"
      && wpBtn && tabs.join() === "General,Style" && tabs2.join() === "General,Opening hours,Services & rules,Style,Database,Bookings" && rules && svc === 1, { pc, tabs, tabs2, rules, svc });
    await ev(() => window.imageEditorInstance.E.views.apply("web")); await p.waitForTimeout(400);
    await ev(() => document.querySelector('#pcViewRibbon .cbb[data-id="v_act_calendar"]').click()); await p.waitForTimeout(600);
    const wc = await ev(() => { const L = window.imageEditorInstance.E.S.layers.filter((l) => l.cal).pop(); return { mode: L.cal.mode, name: L.name }; });
    check("📅 Web View ▸ Calendar: a website booking calendar", wc.mode === "booking" && wc.name === "📅 Appointments", wc);
    await ev(() => window.imageEditorInstance.E.views.apply("image")); await p.waitForTimeout(400);
    const vis = await ev(() => { const x = document.getElementById("pcCalTool"); return !!(x && x.offsetParent); });
    await p.click("#pcCalTool"); await p.waitForTimeout(600);
    const ic = await ev(() => { const L = window.imageEditorInstance.E.S.layers.filter((l) => l.cal).pop(); return { mode: L.cal.mode, name: L.name }; });
    check("📅 at the foot of the tool column (Image View): a printed month", vis && ic.mode === "print" && /^📅 Calendar/.test(ic.name), { vis, ic });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
