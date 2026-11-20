#!/usr/bin/env node
/* bitGen Studio — 2.896.0 in a REAL browser: 📇 card sheet extras - a two-page 90 × 55 mm card (Front red with "Tim Paul" and
 * "0412 999 888", Back blue) in the image editor, File ▸ 📇 Business Card Sheet…:
 *   🏭 Print shop sheet: SRA3, 21 cards with 3 mm bleed, 4 registration targets; the PDF's page is SRA3 and the bleed is the card's red
 *   ✂ one card a page: 120 × 85 mm pages, TrimBox 90 × 55 mm and BleedBox 96 × 61 mm (read back with pdf-lib)
 *   🏷 your stock: the sizes typed, 💾 Keep under a name (the server keeps it, a reopened box lists it), 🗑 deletes it; a wrong pitch said
 *   📋 a card per row of a list: two people with 3 + 2 copies, the phone guessed, the name picked by hand - 5 cards on one sheet, the
 *   first three the same and different from the fourth (read back with pdf.js), the card's own words put back after.
 * Tim (2026-11-19 PARKED item 4) -> "lets do next" */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 }, acceptDownloads: true });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const openBox = async () => { await ev(() => window.imageEditorInstance.E.cardSheet.open()); await p.waitForSelector("#pccsMode", { timeout: 10000 }); await p.waitForTimeout(600); };
  const info = () => ev(() => document.getElementById("pccsInfo").textContent);
  const makePdf = async () => {
    await ev(() => { window.imageEditorInstance.E.cardSheet.last = null; });
    const dl = p.waitForEvent("download", { timeout: 30000 });
    await p.click(".kxdlg.pcd .ok");
    const d = await dl;
    await p.waitForFunction(() => window.imageEditorInstance.E.cardSheet.last, null, { timeout: 30000 });
    return { file: d.suggestedFilename(), last: await ev(() => window.imageEditorInstance.E.cardSheet.last) };
  };
  const loadPdfJs = () => ev(async () => {
    if (!window.pdfjsLib) { const s = document.createElement("script"); s.src = "/static/vendor/pdf.min.js"; document.head.appendChild(s); await new Promise((ok) => { s.onload = ok; }); }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/static/vendor/pdf.worker.min.js";
  });
  let stockId = "";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.cardSheet && window.imageEditorInstance.E.pages && window.PCCardList, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await ev(async () => {
      const E = window.imageEditorInstance.E;
      E.pages.newDocument({ preset: "Custom", wmm: 90, hmm: 55, orient: "landscape", dpi: 300 }, 2, "UI896 card");
      E.pages.rename(0, "Front"); E.pages.rename(1, "Back");
      for (const [i, col] of [[0, "#d02020"], [1, "#2040d0"]]) {
        E.pages.go(i); const L = E.S.layers[0], g = L.canvas.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, L.canvas.width, L.canvas.height);
        if (i === 0) for (const [str, y] of [["Tim Paul", 120], ["0412 999 888", 330]]) {
          const T = E.makeLayer(str, E.S.w, E.S.h, "text");
          T.text = Object.assign({}, E.D.TEXT_DEFAULT, { str, font: "Arial", size: 110, weight: "bold", color: "#ffffff", align: "left", leading: 1.2, x: 80, y, box: { w: 950, h: 160 } });
          E.D.rasterize(T); E.addLayer(T, "ui896", false);
        }
        E.refresh();
      }
      E.pages.go(0);
    });

    // 🏭 the print shop sheet
    await openBox();
    const modes = await ev(() => [...document.querySelectorAll("#pccsMode option")].map((o) => o.value).join(","));
    check("📇 the box has Layout ▾: home printer sheet, label / card stock, print shop sheet, one card a page", modes === "home,stock,shop,single", modes);
    await p.selectOption("#pccsMode", "shop"); await p.selectOption("#pccsShopPaper", "sra3"); await p.selectOption("#pccsShopBleed", "3");
    await p.waitForTimeout(300);
    const shop = await ev(() => ({ info: document.getElementById("pccsInfo").textContent, rects: document.querySelectorAll("#pccsPrev rect").length, bleeds: document.querySelectorAll("#pccsPrev path").length, regs: document.querySelectorAll("#pccsPrev circle").length, shown: getComputedStyle(document.querySelector('.pccs-m[data-m="shop"]')).display !== "none", home: getComputedStyle(document.querySelector('.pccs-m[data-m="home"]')).display }));
    check("🏭 SRA3 with 3 mm bleed: '21 cards (3 × 7) on SRA3 portrait', 21 cards each with its bleed, 4 registration targets; only the shop's settings shown", /^21 cards \(3 × 7\) on SRA3 portrait/.test(shop.info) && shop.rects === 21 && shop.bleeds === 21 && shop.regs === 4 && shop.shown && shop.home === "none" && /3 mm bleed/.test(shop.info), shop);
    let m = await makePdf();
    check("🏭 Make the PDF: '<card> - print shop sheet.pdf', 21 cards, fronts + backs (2 pages)", /print shop sheet\.pdf$/.test(m.file) && m.last.cards === 21 && m.last.pages === 2 && m.last.layout.mode === "shop", m);
    await loadPdfJs();
    const shopPdf = await ev(async (name) => {
      const doc = await window.pdfjsLib.getDocument("/api/pdf/file/" + encodeURIComponent(name)).promise, pg = await doc.getPage(1), vp = pg.getViewport({ scale: 2 });
      const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height); await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      const g = c.getContext("2d"), k = 2 * 72 / 25.4, at = (x, y) => [...g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data].slice(0, 3);
      // card 0 sits at x 19, y 14.5 (mm): its bleed 1.5 mm outside the trim, the margin left of every bleed, the paper's corner
      const txt = (await pg.getTextContent()).items.map((x) => x.str).join(" ");
      return { pages: doc.numPages, w: Math.round(pg.getViewport({ scale: 1 }).width), h: Math.round(pg.getViewport({ scale: 1 }).height), bleed: at(17.5, 40), outside: at(10, 40), corner: at(2, 2), txt };
    }, m.last.name);
    check("...read back: SRA3 (907 × 1276 pt), the bleed outside the trim is the card's red (its own edge carried out), white outside the bleeds and in the corner, the job line", shopPdf.pages === 2 && shopPdf.w === 907 && shopPdf.h === 1276
      && shopPdf.bleed[0] > 180 && shopPdf.bleed[2] < 90 && shopPdf.outside.every((v) => v > 230) && shopPdf.corner.every((v) => v > 230) && /3 mm bleed/.test(shopPdf.txt) && /SRA3/.test(shopPdf.txt), shopPdf);

    // ✂ one card a page
    await openBox();
    await p.selectOption("#pccsMode", "single"); await p.waitForTimeout(300);
    const single = await info();
    check("✂ one card a page: 120 × 85 mm pages (the card + 3 mm bleed + room for the crop marks), trim and bleed boxes", /One card a page: 120 × 85 mm/.test(single) && /front \+ back pages/.test(single), single);
    m = await makePdf();
    const boxes = await ev(async (name) => {
      if (!window.PDFLib) { const s = document.createElement("script"); s.src = "/static/vendor/pdf-lib.min.js"; document.head.appendChild(s); await new Promise((ok) => { s.onload = ok; }); }
      const bytes = await (await fetch("/api/pdf/file/" + encodeURIComponent(name))).arrayBuffer(), d = await window.PDFLib.PDFDocument.load(bytes), pg = d.getPage(0), mm = (v) => Math.round(v * 25.4 / 72 * 10) / 10;
      const t = pg.getTrimBox(), bl = pg.getBleedBox(), s = pg.getSize();
      return { pages: d.getPageCount(), size: [mm(s.width), mm(s.height)], trim: [mm(t.x), mm(t.y), mm(t.width), mm(t.height)], bleed: [mm(bl.width), mm(bl.height)] };
    }, m.last.name);
    check("...read back with pdf-lib: 2 pages (front, back) 120 × 85 mm, TrimBox 90 × 55 mm at 15 mm, BleedBox 96 × 61 mm", boxes.pages === 2 && boxes.size.join() === "120,85" && boxes.trim.join() === "15,15,90,55" && boxes.bleed.join() === "96,61", boxes);

    // 🏷 your stock
    await openBox();
    await p.selectOption("#pccsMode", "stock"); await p.waitForTimeout(200);
    for (const [id, v] of [["pccsStCols", "2"], ["pccsStRows", "5"], ["pccsStCw", "85"], ["pccsStCh", "54"], ["pccsStTop", "13.5"], ["pccsStLeft", "15"], ["pccsStHp", "95"], ["pccsStVp", "54"]]) await p.fill("#" + id, v);
    await p.waitForTimeout(500);
    const stock = await info();
    check("🏷 your stock typed (2 × 5 of 85 × 54 mm, 95 mm across pitch): '10 cards (2 × 5)', the 90 × 55 card fitted inside each, the check-on-plain-paper tip", /^10 cards \(2 × 5\)/.test(stock) && /fitted inside/.test(stock) && /plain paper/.test(stock), stock);
    await p.fill("#pccsStHp", "70"); await p.waitForTimeout(500);
    const badPitch = await ev(() => ({ info: document.getElementById("pccsInfo").textContent, off: document.querySelector(".kxdlg.pcd .ok").disabled }));
    check("...a pitch less than the card's width is said (the cards would overlap) and Make the PDF is off", /would overlap/.test(badPitch.info) && badPitch.off, badPitch);
    await p.fill("#pccsStHp", "95"); await p.fill("#pccsStName", "UI896 stock");
    await p.click("#pccsStSave"); await p.waitForTimeout(800);
    const kept = await (await fetch(URL_ + "api/cardstocks")).json(), ks = (kept.stocks || []).find((s) => s.name === "UI896 stock"); stockId = ks ? ks.id : "";
    check("💾 Keep: the server keeps it (85 × 54, 2 × 5, pitch 95 × 54) and the box picks it", !!ks && ks.cw === 85 && ks.cols === 2 && ks.hpitch === 95 && await ev((id) => document.getElementById("pccsStock").value === id, stockId), kept);
    await p.click(".kxdlg.pcd .cn");
    await openBox();
    const again = await ev(() => ({ opts: [...document.querySelectorAll("#pccsStock option")].map((o) => o.textContent), sel: document.getElementById("pccsStock").value, cw: document.getElementById("pccsStCw").value }));
    check("...a reopened box lists it and picks it again with its sizes", again.opts.some((t) => /UI896 stock \(2 × 5, 85 × 54 mm\)/.test(t)) && again.sel === stockId && again.cw === "85", again);
    m = await makePdf();
    check("🏷 its PDF: '<card> - card stock.pdf', 10 cards on one A4 sheet", /card stock\.pdf$/.test(m.file) && m.last.cards === 10 && m.last.layout.w === 210 && m.last.layout.mode === "stock", m);
    await openBox();
    await p.click("#pccsStDel"); await p.waitForTimeout(800);
    const gone = await (await fetch(URL_ + "api/cardstocks")).json();
    check("🗑 deletes your stock", !(gone.stocks || []).some((s) => s.id === stockId), gone); if (!(gone.stocks || []).some((s) => s.id === stockId)) stockId = "";

    // 📋 a card per row of a list
    await p.selectOption("#pccsMode", "home");
    await p.selectOption("#pccsSrc", "list"); await p.waitForTimeout(400);
    await p.fill("#pccsRows", "Name, Mobile, Copies\nAlex Chen, 0400 111 222, 3\nSam Lee, 0400 333 444, 2");
    await p.waitForTimeout(900);
    const map = await ev(() => [...document.querySelectorAll("#pccsMap select[data-col]")].map((s) => s.value));
    check("📋 the list's columns: Mobile guessed to replace the card's phone number, Copies = how many", map.length === 3 && map[1] === "0412 999 888" && map[2] === "#copies", map);
    await p.selectOption('#pccsMap select[data-col="0"]', "Tim Paul"); await p.waitForTimeout(400);
    const list = await ev(() => ({ info: document.getElementById("pccsInfo").textContent, labels: [...document.querySelectorAll("#pccsPrev text")].map((t) => t.textContent), rects: document.querySelectorAll("#pccsPrev rect").length }));
    check("...Name picked by hand: '5 cards on 1 sheet (2 different)', the preview names them Alex Chen ×3, Sam Lee ×2", /5 cards on 1 sheet \(2 different\)/.test(list.info) && list.labels.join("|") === "Alex Chen|Alex Chen|Alex Chen|Sam Lee|Sam Lee" && list.rects === 5, list);
    await ev(() => { window.__aeLog = []; const A = window.PCCardList.applyRow; window.__aeApply = A; window.PCCardList.applyRow = (s0, pr) => { const r = A(s0, pr); if (r !== s0) window.__aeLog.push(r); return r; }; });
    m = await makePdf();   // (the click on OK leaves the list's box: its change must not undo the column picked by hand)
    const swapped = await ev(() => { window.PCCardList.applyRow = window.__aeApply; return window.__aeLog; });
    check("...every person's words drawn on their card: the name picked by hand AND the phone (the list box's blur on OK keeps the hand pick)", ["Alex Chen", "0400 111 222", "Sam Lee", "0400 333 444"].every((w) => swapped.includes(w)), swapped);
    check("📋 its PDF: 5 cards, 2 different, fronts + backs", m.last.cards === 5 && m.last.different === 2 && m.last.pages === 2, m.last);
    const listPdf = await ev(async (name) => {
      const doc = await window.pdfjsLib.getDocument("/api/pdf/file/" + encodeURIComponent(name)).promise, pg = await doc.getPage(1), vp = pg.getViewport({ scale: 2 });
      const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height); await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      const g = c.getContext("2d"), k = 2 * 72 / 25.4;
      // A4 10-up: cells at x 15 / 105, y 11 + 55 r; a card's words region summed
      const sum = (x, y) => { const d = g.getImageData(Math.round((x + 2) * k), Math.round((y + 2) * k), Math.round(80 * k), Math.round(30 * k)).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i + 1]; return s; };
      return { c0: sum(15, 11), c1: sum(105, 11), c2: sum(15, 66), c3: sum(105, 66), c5: sum(15, 176) };
    }, m.last.name);
    check("...read back: cards 1 and 3 the same (Alex, one column), card 2 (Alex) and card 4 (Sam) in the other column different, the sixth cell empty", listPdf.c0 === listPdf.c2 && Math.abs(listPdf.c3 - listPdf.c1) > 10000 && listPdf.c5 > listPdf.c0, listPdf);
    const words = await ev(() => { const E = window.imageEditorInstance.E; return E.S.layers.filter((L) => L.text).map((L) => L.text.str); });
    check("...the card's own words put back after (Tim Paul, 0412 999 888)", words.join("|") === "Tim Paul|0412 999 888", words);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    if (stockId) { try { await fetch(URL_ + "api/cardstocks/" + stockId, { method: "DELETE" }); } catch { /* gone */ } }
    await ev(() => { try { ["mode", "src", "rows", "stock", "each"].forEach((k) => localStorage.removeItem("pc.cardsheet." + k)); } catch (e) { /* fine */ } }).catch(() => {});
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
