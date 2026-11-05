#!/usr/bin/env node
/* bitGen Studio — 2.665.0 in a REAL browser: 📄 THE SKETCHER'S BUILDING PLANS - the bar's 📄 Plans opens the dialog (a title
 * bar that drags it), its options change the preview (sheet, scale, one sheet / one view per page, dimensions), 💾 Save PDF
 * writes the PDF into the project's pdf folder (GET /api/pdf/list + /api/pdf/file - its page count and size read back with
 * pdf-lib). Tim (verbatim): "add a button in sketcher top toolstrip to create building plans ... bring up a dialog with
 * titlebar for building plans custom so user can check if they want dimensions, all views on 1 a1 page, views of different
 * pages etc"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: a picture. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.665.0 browser test did not run"); process.exit(0); }
const LIB = require(path.join(__dirname, "..", "static/vendor/pdf-lib.min.js"));
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_plans665_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPSheets && window.PPSheetsDlg && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), localStorage.removeItem("pp.sheets"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    const bar = await ev(() => { const b = document.getElementById("ppPlans"); return b && { t: b.textContent, prev: b.previousElementSibling && b.previousElementSibling.id, shown: b.offsetWidth > 0 }; });
    check("the bar: 📄 Plans right after ✨ Photo", bar && bar.t === "📄 Plans" && bar.prev === "ppReal" && bar.shown, bar);
    // a house: two rooms + a loft, a door, a window, a roof
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty();
      const K = PPArch.addRoom(A, PPArch.rectPts([0, 0], [5, 4]), { name: "Kitchen" }), B = PPArch.addRoom(A, PPArch.rectPts([5, 0], [9, 4]), { name: "Bed 1" });
      PPArch.addOp(A, "door", 0.9, { room: K.id, edge: 0, at: 2 }); PPArch.addOp(A, "window", 1.2, { room: B.id, edge: 0, at: 2 });
      const L = PPArch.addRoom(A, PPArch.rectPts([0, 0], [5, 4]), { name: "Loft", z: 2.7 }); PPArch.addRoof(A, [L.id], { type: "gable" });
      H3PushPull.commit("house", b0); });
    await p.waitForTimeout(300); await ev(() => { document.getElementById("ppName").value = "Smith house"; });
    await ev(() => { try { window.H3DlgLayout && H3DlgLayout.reset("#ppSheetDlg"); } catch (e) { /* none */ } });   // a place kept by an earlier run: in the middle again
    await p.click("#ppPlans"); await p.waitForTimeout(500);
    const d1 = await ev(() => { const d = document.getElementById("ppSheetDlg"), bar = d && d.querySelector("[data-dlg-drag]"); return d && { open: d.open, modal: d.matches(":modal"), bar: bar && bar.textContent.replace(/\s+/g, " "), sub: document.getElementById("ppSdSub").textContent, page: document.getElementById("ppSdPage").textContent, info: document.getElementById("ppSdInfo").textContent, project: document.getElementById("ppSdProject").value, file: document.getElementById("ppSdFile").value, canvas: document.getElementById("ppSdCanvas").width }; });
    check("📄 Plans: the dialog opens (modal) with its title bar - 📄 Building plans · the model's name", d1 && d1.open && d1.modal && /📄 Building plans/.test(d1.bar) && /Smith house/.test(d1.sub), d1);
    check("…a preview of page 1 of 1 (all views on one sheet), A3 landscape, 7 views; project + file from the model's name", d1.page === "Page 1 of 1" && /A3 landscape · 1:\d+ · 7 views/.test(d1.info) && d1.project === "Smith house" && d1.file === "Smith house plans" && d1.canvas > 300, d1);
    // the preview has drawn something (not a blank page)
    const ink = await ev(() => { const c = document.getElementById("ppSdCanvas"), x = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < x.length; i += 16) if (x[i] < 120) n++; return n; });
    check("…the preview is drawn (dark lines / walls on the white sheet)", ink > 500, ink);
    // drag the title bar: the dialog moves
    const r0 = await ev(() => { const r = document.getElementById("ppSheetDlg").getBoundingClientRect(); return [r.left, r.top]; });
    const hb = await ev(() => { const r = document.querySelector("#ppSheetDlg .ppsd-bar b").getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
    await p.mouse.move(hb[0], hb[1]); await p.mouse.down(); await p.mouse.move(hb[0] - 60, hb[1] + 40, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    const r1 = await ev(() => { const r = document.getElementById("ppSheetDlg").getBoundingClientRect(); return [r.left, r.top]; });
    check("the title bar drags the dialog", Math.abs(r1[0] - r0[0] + 60) < 4 && Math.abs(r1[1] - r0[1] - 40) < 4, { r0, r1 });
    // A1, all on one sheet
    await p.selectOption("#ppSdSheet", "A1"); await p.waitForTimeout(400);
    const a1 = await ev(() => document.getElementById("ppSdInfo").textContent);
    check("Size A1: the preview says A1 landscape at 1:50 (the largest scale all 7 views fit at)", /^A1 landscape · 1:50 · 7 views$/.test(a1), a1);
    // one view per page
    await p.check("#ppSdMany"); await p.waitForTimeout(400);
    const many = await ev(() => ({ page: document.getElementById("ppSdPage").textContent, next: !document.getElementById("ppSdNext").disabled }));
    check("One view per page: Page 1 of 7, ▶ to the next", many.page === "Page 1 of 7" && many.next, many);
    await p.click("#ppSdNext"); await p.waitForTimeout(200);
    check("▶: Page 2 of 7", (await ev(() => document.getElementById("ppSdPage").textContent)) === "Page 2 of 7");
    // a fixed scale too big for A4 = the warning
    await p.selectOption("#ppSdSheet", "A4"); await p.check("#ppSdOne"); await p.selectOption("#ppSdScale", "20"); await p.waitForTimeout(400);
    const w = await ev(() => document.getElementById("ppSdWarn").textContent);
    check("A4 at 1:20, all on one sheet: ⚠ they do not fit - try a smaller scale ...", /do not fit on A4 at 1:20/.test(w), w);
    // dimensions off
    await p.selectOption("#ppSdScale", "auto"); await p.selectOption("#ppSdSheet", "A3"); await p.uncheck("#ppSdDims"); await p.waitForTimeout(400);
    const nd = await ev(() => PPSheetsDlg.state.res.pages[0].prims.filter((x) => x.t === "text" && /^\d{3,5}$/.test(x.str)).length);
    check("Dimensions off: no dimension numbers on the sheet", nd === 0, nd);
    await p.check("#ppSdDims"); await p.check("#ppSdMany"); await p.fill("#ppSdBy", "T. Paul"); await p.fill("#ppSdFile", "smith-plans-665");
    await p.waitForTimeout(300);
    // 💾 Save PDF
    const dl = p.waitForEvent("download", { timeout: 15000 }).catch(() => null);
    await p.click("#ppSdSave");
    await p.waitForFunction(() => PPSheetsDlg.state.last || !document.getElementById("ppSheetDlg").open, null, { timeout: 20000 }).catch(() => {});
    const last = await ev(() => ({ last: PPSheetsDlg.state.last, open: document.getElementById("ppSheetDlg").open, msg: document.getElementById("ppMsg").textContent }));
    check("💾 Save PDF: saved (smith-plans-665.pdf, 7 pages), the dialog closes, the Sketcher says so", last.last && last.last.name === "smith-plans-665.pdf" && last.last.pages === 7 && !last.open && /smith-plans-665\.pdf - 7 pages, A3/.test(last.msg), last);
    const d = await dl;
    check("…downloaded too (Download too ticked)", d && d.suggestedFilename() === "smith-plans-665.pdf", d && d.suggestedFilename());
    const L = await api("/api/pdf/list");
    check("…in the project's pdf folder (File ▸ Open PDF from Project lists it)", (L.files || []).some((f) => f.name === "smith-plans-665.pdf"), L);
    const buf = Buffer.from(await (await fetch(URL_ + "api/pdf/file/smith-plans-665.pdf")).arrayBuffer());
    const D = await LIB.PDFDocument.load(buf), sz = D.getPage(0).getSize();
    check("the saved PDF: 7 A3 landscape pages, author T. Paul", D.getPageCount() === 7 && Math.abs(sz.width - 1190.55) < 1 && Math.abs(sz.height - 841.89) < 1 && D.getAuthor() === "T. Paul", { n: D.getPageCount(), sz });
    // reopened: the options kept (one view per page), the date today
    await p.click("#ppPlans"); await p.waitForTimeout(400);
    const k = await ev(() => ({ many: document.getElementById("ppSdMany").checked, by: document.getElementById("ppSdBy").value, date: document.getElementById("ppSdDate").value }));
    check("reopened: the options kept (one view per page, drawn by), today's date", k.many && k.by === "T. Paul" && /^\d{4}-\d\d-\d\d$/.test(k.date), k);
    if (process.env.H3_SHOT) { await ev(() => { document.getElementById("ppSdOne").checked = true; PPSheetsDlg.update(); }); await p.waitForTimeout(400); await p.screenshot({ path: path.join(process.env.H3_SHOT, "plans665.png") }); }
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("Esc closes it", !(await ev(() => document.getElementById("ppSheetDlg").open)));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
