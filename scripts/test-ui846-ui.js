#!/usr/bin/env node
/* bitGen Studio — 2.846.0 in a REAL browser:
 *   ✒ the Pen (shape mode): three clicks = an open path - not filled, not closed; a click 4 px from the start closes it (filled);
 *   📄 Page Properties: the template A5 booklet -> the page 148 x 210 mm at 150 dpi with 15 mm margins (the guides drawn),
 *     💾 Save as template… -> listed, 🗑;
 *   📅 the Calendar dragged from the Web View's ribbon onto the canvas -> a calendar layer where it was dropped, its tables made
 *     in the project's MariaDB (when it is there); 📅 Calendar Settings (double-click): the month name's colour -> the canvas;
 *     🌐 Build (PHP) -> inc/calendar.php + bgcal() in the page.
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.calendar && window.imageEditorInstance.E.pageProps, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    /* ---- the pen */
    await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(400, 300, "pen846.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 400, 300); }); E.fitView(); E.S.fg = "#ff0000"; E.S.penMode = "shape"; E.S.penOp = "new"; E.setTool("pen"); });
    await p.waitForTimeout(300);
    const scr = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = document.getElementById("ieCanvas").getBoundingClientRect(); return [r.left + x * r.width / E.S.w, r.top + y * r.height / E.S.h]; }, [x, y]);
    for (const [x, y] of [[100, 100], [300, 100], [200, 250]]) { const [sx, sy] = await scr(x, y); await p.mouse.click(sx, sy); await p.waitForTimeout(120); }
    const open1 = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((l) => l.type === "shape"); E.refresh(); const px = L && L.canvas.getContext("2d").getImageData(200, 140, 1, 1).data; return { closed: L ? L.shape.path.subs[0].closed : null, a: px ? px[3] : -1 }; });
    // a click 12 screen px away from the start - not closed; then within 4 px - closed
    const [s0x, s0y] = await scr(100, 100);
    await p.mouse.click(s0x + 12, s0y); await p.waitForTimeout(150);
    const open2 = await ev(() => { const L = window.imageEditorInstance.E.S.layers.find((l) => l.type === "shape"); return { closed: L.shape.path.subs[0].closed, n: L.shape.path.subs[0].pts.length }; });
    await p.mouse.click(s0x + 3, s0y + 2); await p.waitForTimeout(200);
    const shut = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((l) => l.type === "shape"); E.refresh(); const px = L.canvas.getContext("2d").getImageData(200, 140, 1, 1).data; return { closed: L.shape.path.subs[0].closed, a: px[3], r: px[0] }; });
    check("✒ Pen: three clicks = open and NOT filled; a click 12 px from the start adds a point (still open); a click 3-4 px from it closes the shape - then filled",
      open1.closed === false && open1.a === 0 && open2.closed === false && open2.n === 4 && shut.closed === true && shut.a > 200, { open1, open2, shut });
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    /* ---- 📄 Page Properties */
    await ev(() => { const E = window.imageEditorInstance.E; E.pages.newDocument({ preset: "A4", orient: "portrait", dpi: 150 }, 2, "Props846"); E.fitView(); });
    await ev(() => window.imageEditorInstance.E.ui.run("page.props")); await p.waitForTimeout(500);
    const dlg0 = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return d ? { title: d.querySelector("h4").textContent, tpl: [...d.querySelectorAll("#ppTpl option")].map((o) => o.value).filter(Boolean) } : null; });
    await p.selectOption("#ppTpl", "A5 booklet"); await p.waitForTimeout(200);
    const filled = await ev(() => ({ preset: document.getElementById("ppPreset").value, dpi: document.getElementById("ppDpi").value, mt: document.getElementById("ppMt").value, px: document.getElementById("ppPx").textContent }));
    await p.check('input[name="ppAll"][value="1"]');
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(800);
    const after = await ev(() => { const E = window.imageEditorInstance.E; const L = E.pages.list(); return { w: E.S.w, h: E.S.h, pages: L.map((pg) => [pg.preset, pg.dpi, pg.margins && pg.margins.top]) }; });
    check("📄 Page Properties: a template dropdown (built-in pages); A5 booklet fills Size A5 / 150 dpi / 15 mm margins (= 874 × 1240 px); All pages -> both pages",
      dlg0 && dlg0.title === "📄 Page Properties" && dlg0.tpl.includes("Web page - desktop (1440 px)") && filled.preset === "A5" && filled.dpi === "150" && filled.mt === "15" && /874 × 1240/.test(filled.px)
      && after.w === 874 && after.h === 1240 && after.pages.every((x) => x[0] === "A5" && x[1] === 150 && x[2] === 15), { dlg0, filled, after });
    const guide = await ev(() => { const o = document.getElementById("ieOverlay"), g = o.getContext("2d"), E = window.imageEditorInstance.E; E.drawOverlay(); const r = o.getBoundingClientRect(), c = document.getElementById("ieCanvas").getBoundingClientRect(); const k = o.width / r.width; const x = Math.round((c.left - r.left + 88.6 * c.width / E.S.w) * k), y = Math.round((c.top - r.top + 600 * c.height / E.S.h) * k); let hit = 0; for (let dy = 0; dy <= 12; dy++) for (let dx = -3; dx <= 3; dx++) { const d = g.getImageData(x + dx, y + dy, 1, 1).data; if (d[3] > 0 && d[0] > 150 && d[2] > 120) hit++; } return hit; });
    check("📄 the margins shown on the page as dashed guides (15 mm = 89 px in)", guide > 0, guide);
    // save as a template of your own, then delete it
    await ev(() => window.imageEditorInstance.E.ui.run("page.props")); await p.waitForTimeout(400);
    await p.fill("#ppMt", "20"); await p.click("#ppSave"); await p.fill("#ppTplName", "T846 page"); await p.click("#ppNameOk"); await p.waitForTimeout(600);
    const listed = await (await fetch(URL_ + "api/pagetemplates")).json();
    const sel = await ev(() => document.getElementById("ppTpl").value);
    await p.click("#ppDel"); await p.waitForTimeout(500);
    const gone = await (await fetch(URL_ + "api/pagetemplates")).json();
    await p.click(".kxdlg.pcd .cn");
    check("📄 💾 Save as template… keeps it for every project (listed, picked), 🗑 deletes it", listed.templates.some((t) => t.name === "T846 page" && t.margins.top === 20) && sel === "T846 page" && !gone.templates.some((t) => t.name === "T846 page"), { listed, sel });
    /* ---- 📅 the calendar, dragged from the Web View's ribbon */
    await ev(() => { const E = window.imageEditorInstance.E; E.views.apply("web"); });
    await p.waitForTimeout(600);
    await ev(() => { const E = window.imageEditorInstance.E; E.pages.newDocument({ preset: "Custom", wmm: 508, hmm: 317.5, orient: "landscape", dpi: 72 }, 1, "T846 Clinic"); E.store.set("site.last", JSON.stringify({ name: "T846 Clinic", title: "T846 Clinic", stack: "php", lang: "en" })); E.fitView(); });
    await p.waitForTimeout(300);
    const draggable = await ev(() => { const b = document.querySelector('#pcViewRibbon .cbb[data-id="v_act_calendar"]'); return b ? b.draggable : null; });
    const [dx, dy] = await scr(1000, 450);
    await p.dragAndDrop('#pcViewRibbon .cbb[data-id="v_act_calendar"]', "#ieStage", { targetPosition: await ev(([x, y]) => { const r = document.getElementById("ieStage").getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; }, [dx, dy]) });
    await p.waitForTimeout(800);
    const cal = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((l) => l.cal); if (!L) return null; const b = L.cal.box; return { name: L.name, cx: b.x + b.w / 2, cy: b.y + b.h / 2, slug: L.cal.slug, db: L.cal.db, tz: L.cal.tz }; });
    check("📅 the ribbon's Calendar is draggable; dropped on the canvas = a calendar layer centred where it was dropped, its database site_t846_clinic",
      draggable === true && cal && cal.name === "📅 Appointments" && Math.abs(cal.cx - 1000) < 4 && Math.abs(cal.cy - 450) < 4 && cal.db.name === "site_t846_clinic" && cal.db.scope === "project", cal);
    const st = await (await fetch(URL_ + "api/db/status")).json();
    if (!st.server) console.log("SKIP: no MariaDB on the test server - the tables were not made (the Download box asks)");
    else {
      await p.waitForFunction(() => { const L = window.imageEditorInstance.E.S.layers.find((l) => l.cal); return L && L.cal.dbOk != null; }, null, { timeout: 60000 });
      const ok = await ev(() => window.imageEditorInstance.E.S.layers.find((l) => l.cal).cal.dbOk);
      const sch = await (await fetch(URL_ + "api/db/schema?scope=project&db=site_t846_clinic")).json();
      const names = JSON.stringify(sch).match(/bg_[a-z_]+/g) || [];
      check("📅 its tables made in the project's MariaDB as soon as it was dropped (bg_calendars, bg_cal_hours, bg_cal_closed, bg_cal_bookings + the view)",
        ok === true && ["bg_calendars", "bg_cal_hours", "bg_cal_closed", "bg_cal_bookings", "bg_cal_upcoming"].every((t) => names.includes(t)), { ok, names: [...new Set(names)] });
    }
    // settings by double-click: the month name red, each booking 60 min
    const [mx, my] = await scr(cal.cx, cal.cy);
    await p.mouse.dblclick(mx, my); await p.waitForTimeout(500);
    const tabs = await ev(() => [...document.querySelectorAll(".kxdlg.pcd [data-ctab]")].map((b) => b.textContent));
    await p.fill("#pccSlot", "60");
    await p.click('.kxdlg.pcd [data-ctab="style"]');
    const types = await ev(() => [...document.querySelectorAll(".pccal-style tr td:first-child")].map((t) => t.textContent));
    await ev(() => { const i = document.querySelector('[data-st="month.color"]'); i.value = "#ff0000"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.waitForTimeout(400);
    const live = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((l) => l.cal), b = L.cal.box, g = L.canvas.getContext("2d"), d = g.getImageData(b.x, b.y, b.w, Math.round(b.h * 0.12)).data; let red = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60 && d[i + 3] > 200) red++; return red; });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(600);
    const kept = await ev(() => { const L = window.imageEditorInstance.E.S.layers.find((l) => l.cal); return { c: L.cal.style.month.color, slot: L.cal.slot }; });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(300);
    const undone = await ev(() => { const L = window.imageEditorInstance.E.S.layers.find((l) => l.cal); return L ? { c: L.cal.style.month.color, slot: L.cal.slot } : null; });
    await ev(() => window.imageEditorInstance.E.redo()); await p.waitForTimeout(300);
    check("📅 Calendar Settings by double-click: General / Opening hours / Services & rules / Style / Database / Bookings; every object type in Style; the month name's colour shows on the canvas at once; OK keeps it, one undo takes it back",
      tabs.join() === "General,Opening hours,Services & rules,Style,Database,Bookings" && ["Month name", "Dates", "Today", "Available days", "Taken times", "Book button"].every((t) => types.includes(t)) && live > 20 && kept.c === "#ff0000" && kept.slot === 60 && undone && undone.c !== "#ff0000" && undone.slot === 30, { tabs, types, live, kept, undone });
    // 🌐 build (PHP, no AI): the calendar in the page
    const r = await ev(() => window.imageEditorInstance.E.site.build({ name: "T846 Clinic", title: "T846 Clinic", stack: "php", lang: "en", ai: false, open: false }));
    const z = await fetch(new URL("/api/sites/zip?name=T846%20Clinic", URL_)), zb = Buffer.from(await z.arrayBuffer());
    const JSZip = require(path.join(__dirname, "..", "node_modules", "jszip")), zz = await JSZip.loadAsync(zb);
    const idx = await zz.file("index.php").async("string"), css = await zz.file("css/site.css").async("string");
    const prev = await (await fetch(new URL(r.preview, URL_))).text();
    check("🌐 Build (PHP + MySQL): index.php loads inc/calendar.php and calls bgcal(); its style (the red month) in site.css; schema.sql with the tables; the preview shows the month",
      /require_once __DIR__ \. '\/inc\/calendar\.php'/.test(idx) && idx.includes(`bgcal('${cal.slug}'`) && !!zz.file("inc/calendar.php") && /\.bgcal-month\{[^}]*color:#ff0000/.test(css) && /bg_cal_bookings/.test(await zz.file("schema.sql").async("string")) && /class="bgcal bgcal-/.test(prev), { idx: idx.slice(0, 300) });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
