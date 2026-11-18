#!/usr/bin/env node
/* bitGen Studio — 2.851.0 in a REAL browser (Tim: "the properties tab has dissappeared, the comments panel won't close. remove
 * the blender tab, make the blender button a dropdown with new scene, open, save, import and up to 5 recent files. open and new
 * scene will start blender. remove the ai tab, inpaint and outpaint are in the prompt docker edit mode. fix the calendar settings
 * dialog, allow user to align the table when user selects the table"):
 *   no ✨ AI tab, no 🟧 Blender tab; Properties in every view (WP View too); a Blender layer's settings + the 🔲 Zones box at the
 *   foot of Properties; Window ▸ ⏳ Pending; the 🟧 ▾ menu (New scene, Open, Save, Import off without a scene, the recent files,
 *   a recent file opens the scene tools - one not there leaves the list); the comments list's ✕ closes it; the calendar
 *   dialog's fields at their size and inside the dialog; a picked table aligned by ⯇ ↔ ⯈, the ribbon's align and Ctrl+L.
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
  p.on("dialog", (d) => d.dismiss().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const run = (id) => ev((i) => window.imageEditorInstance.E.ui.run(i), id);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.views && window.imageEditorInstance.E.blendLayer && window.imageEditorInstance.E.calendar, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    /* ---- the tabs */
    const tabs = await ev(() => [...document.querySelectorAll("#imageeditdock .pctabs [data-tab]")].map((t) => t.dataset.tab));
    const views = {};
    for (const v of ["wp", "vector", "image", "web"]) { await ev((x) => window.imageEditorInstance.E.views.apply(x), v); await p.waitForTimeout(400); views[v] = await ev(() => { const t = document.querySelector('#imageeditdock [data-tab="pcProps"]'); return !!(t && t.offsetParent); }); }
    check("no ✨ AI tab and no 🟧 Blender tab; Properties shown in WP, Vector, Image and Web View", !tabs.includes("kxAi") && !tabs.includes("kbl") && tabs.includes("pcProps") && Object.values(views).every(Boolean), { tabs: tabs.join(","), views });
    await ev(() => window.imageEditorInstance.E.ui.showTab("kxAi")); await p.waitForTimeout(100);
    const stay = await ev(() => document.getElementById("pcProps").classList.contains("on"));
    check("asking for the old ✨ AI tab leaves Properties showing; Window ▸ ⏳ Pending is a command", stay && await ev(() => window.imageEditorInstance.E.ui.CMD.has("win.pending")), stay);
    /* ---- the 🟧 ▾ menu */
    await ev(() => window.imageEditorInstance.E.store.set("bl.recent", ["/nowhere/a-room.blend", "/nowhere/b.blend"]));
    await p.click("#kblBtn"); await p.waitForTimeout(200);
    const m = await ev(() => [...document.querySelectorAll("#kblMenu button")].map((x) => [x.dataset.k, x.textContent.trim(), x.disabled]));
    check("🟧 ▾: New scene, Open, Save + Import off (no scene open), the 2 recent files by name", m.map((x) => x[0]).slice(0, 4).join() === "new,open,save,import" && m[2][2] && m[3][2] && !m[0][2]
      && m.filter((x) => x[0] === "recent").map((x) => x[1]).join("|") === "1  a-room.blend|2  b.blend", m);
    await p.click('#kblMenu button[data-k="new"]'); await p.waitForTimeout(200);
    const nd = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return d ? d.querySelector("h4").textContent + "|" + (d.querySelector("#kblNewName") || {}).value : ""; });
    await ev(() => { const c = document.querySelector(".kxdlg.pcd .cn"); if (c) c.click(); });
    check("🆕 New scene asks its name", /New Blender Scene\|New scene/.test(nd), nd);
    await p.click("#kblBtn"); await p.waitForTimeout(150); await p.mouse.click(700, 600); await p.waitForTimeout(150);
    const closed = await ev(() => !document.getElementById("kblMenu"));
    check("a click elsewhere closes the menu", closed);
    await p.click("#kblBtn"); await p.waitForTimeout(150);
    await p.click('#kblMenu button[data-k="recent"]'); await p.waitForTimeout(2500);
    const after = await ev(() => ({ open: window.imageEditorInstance.E.blendLayer.isOpen(), recent: window.imageEditorInstance.E.store.get("bl.recent", []) }));
    check("a recent file opens the scene tools (Blender asked to read it); a file that is not there leaves the list", after.recent.join() === "/nowhere/b.blend", after);
    await ev(() => { const B = window.imageEditorInstance.E.blendLayer; if (B.isOpen()) B.leave(); const n = document.getElementById("notedlg"); if (n && n.open) n.close(); });
    /* ---- a Blender layer's settings + Zones at the foot of Properties */
    await ev(() => { const E = window.imageEditorInstance.E; E.views.apply("image"); E.pages.newDocument({ preset: "Custom", wmm: 200, hmm: 150, orient: "landscape", dpi: 72 }, 1, "T851"); });
    await p.waitForTimeout(500);
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; const L = E.makeLayer("🟧 room", S.w, S.h, "pixel"); L.bscene = { stem: "room", source: "/x/room.blend" }; E.store.set("bl.live", false); S.layers.push(L); S.active = S.layers.length - 1; E.refresh(); E.renderLayersPanel(); E.ui.showTab("pcProps"); });
    await p.waitForTimeout(800);
    const bl = await ev(() => { const k = document.getElementById("kblBody"); return k ? { in: !!k.closest("#pcProps"), shown: !!k.offsetParent, txt: k.textContent.slice(0, 120) } : null; });
    await ev(() => { const E = window.imageEditorInstance.E; E.S.active = 0; E.renderLayersPanel(); E.setTool("zones"); });
    await p.waitForTimeout(800);
    const zn = await ev(() => { const z = document.getElementById("kxZones"), k = document.getElementById("kblBody"); return { in: !!(z && z.closest("#pcProps")), shown: !!(z && z.offsetParent), bl: !!(k && k.offsetParent) }; });
    check("Properties: a Blender layer picked = its 🟧 Blender settings (Edit from, References, Scene strength, Live)", bl && bl.in && bl.shown && /Edit from/.test(bl.txt), bl);
    check("Properties: the 🔲 Zones tool in hand = the Zones box; the Blender part gone with its layer not picked", zn.in && zn.shown && !zn.bl, zn);
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    /* ---- the comments list's ✕ */
    await run("file.newtextdoc"); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdnDpi").value = "96"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(900);
    const st0 = await ev(() => !!document.querySelector(".pcdocedit .pcdoc"));
    if (!st0) { await run("layer.docedit"); await p.waitForTimeout(400); }
    await ev(() => window.imageEditorInstance.E.docNotes.openPanel(false)); await p.waitForTimeout(200);
    const op = await ev(() => !!document.querySelector(".pdcPanel"));
    await p.click('.pdcPanel [data-act="close"]'); await p.waitForTimeout(200);
    const cl = await ev(() => !document.querySelector(".pdcPanel"));
    check("💬 the comments list opens and its ✕ closes it", op && cl && !errs.some((e) => /dataset|null/.test(e)), { op, cl, errs });
    /* ---- the table aligned */
    await ev(() => { const e = document.querySelector(".pcdocedit .pcdoc"); e.focus(); const s = getSelection(); s.selectAllChildren(e); s.collapseToEnd(); });
    await p.keyboard.type("Before the table");
    await run("doc.table.insert"); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pttR", "2"); await p.fill(".kxdlg.pcd #pttC", "2"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    await run("doc.table.select"); await p.waitForTimeout(200);
    const tb = () => ev(() => { const t = document.querySelector(".pcdocedit .pcdoc table"), ts = JSON.parse(t.getAttribute("data-ts") || "{}"); return { al: ts.align, w: ts.w, ml: t.style.marginLeft, mr: t.style.marginRight, on: [...document.querySelectorAll("#pcdtUi .pcdt-al.on")].map((x) => x.dataset.al).join() }; });
    const btnShown = await ev(() => [...document.querySelectorAll("#pcdtUi .pcdt-al")].filter((x) => x.offsetParent || getComputedStyle(x.parentNode).display !== "none").length);
    await p.click('#pcdtUi .pcdt-al[data-al="center"]'); await p.waitForTimeout(200); const a1 = await tb();
    await ev(() => window.imageEditorInstance.E.docText.exec("justifyRight")); await p.waitForTimeout(200); const a2 = await tb();
    await p.keyboard.press("Control+l"); await p.waitForTimeout(200); const a3 = await tb();
    const still = await ev(() => !!window.imageEditorInstance.E.docTable.selected());
    check("▦ a picked table: ⯇ ↔ ⯈ on its box; ↔ centres it (narrower than the frame, auto margins)", btnShown === 3 && a1.al === "center" && a1.w < 100 && a1.ml === "auto" && a1.mr === "auto" && a1.on === "center", { btnShown, a1 });
    check("▦ the align buttons (ribbon / formatting bar) align the picked table: right; Ctrl+L = left; still picked", a2.al === "right" && a2.ml === "auto" && a2.on === "right" && a3.al === "left" && a3.ml === "" && still, { a2, a3, still });
    await p.keyboard.press("Escape");
    await ev(() => { const E = window.imageEditorInstance.E; if (E.docText && E.docText.stop) E.docText.stop(); E.setTool("move"); });
    /* ---- the calendar settings dialog */
    await ev(() => { const E = window.imageEditorInstance.E; E.views.apply("web"); E.pages.newDocument({ preset: "Custom", wmm: 508, hmm: 317.5, orient: "landscape", dpi: 72 }, 1, "Cal851"); });
    await p.waitForTimeout(500);
    await ev(async () => { await window.imageEditorInstance.E.calendar.create(600, 400, { mode: "booking" }); });
    await p.waitForTimeout(800);
    await ev(() => { document.querySelectorAll(".kxdlg.pcd .cn").forEach((c) => c.click()); });
    await ev(() => { const E = window.imageEditorInstance.E; E.calendar.settings(E.S.layers.filter((l) => l.cal).pop()); }); await p.waitForTimeout(400);
    const geo = async () => ev(() => { const d = document.querySelector(".kxdlg.pcd"), r = d.getBoundingClientRect(), pane = [...d.querySelectorAll("[data-cpane]")].find((x) => x.style.display !== "none");
      const out = [...pane.querySelectorAll("input:not([type=checkbox]),select")].filter((x) => x.offsetParent).filter((x) => { const q = x.getBoundingClientRect(); return q.right > r.right + 1 || q.left < r.left - 1; }).map((x) => x.id || x.dataset.h || x.tagName);
      return { w: Math.round(r.width), name: Math.round(d.querySelector("#pccName").getBoundingClientRect().width), mode: Math.round(d.querySelector("#pccMode").getBoundingClientRect().width), out }; });
    const g1 = await geo();
    await p.click('.kxdlg.pcd [data-ctab="hours"]'); await p.waitForTimeout(150); const g2 = await geo();
    await p.click('.kxdlg.pcd [data-ctab="rules"]'); await p.waitForTimeout(150); const g3 = await geo();
    await ev(() => { const c = document.querySelector(".kxdlg.pcd .cn"); if (c) c.click(); });
    check("📅 Calendar Settings: wide enough (780 px), the fields at their size (Name, Mode), nothing outside the dialog on General / Opening hours / Services & rules",
      g1.w >= 700 && g1.name >= 150 && g1.mode >= 150 && !g1.out.length && !g2.out.length && !g3.out.length, { g1, g2, g3 });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
