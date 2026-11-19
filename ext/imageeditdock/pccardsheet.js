/* ext/imageeditdock/pccardsheet.js — 2.884.0: 📇 File ▸ Business Card Sheet… in the image editor - the open card (its Front page,
 * and its Back page when it has one) laid out as many times as fit on an A4 or US Letter sheet (10 Australian 90 × 55 mm cards on A4
 * portrait), with cut marks outside the cards, as a PDF to print at actual size: page 1 the fronts, page 2 the backs - their columns
 * mirrored so they line up when the printer prints both sides (flipped on the long edge). Saved in the project's pdf folder and
 * downloaded. A gap between the cards (cut twice) or none (one cut between two cards); a bleed of the card's own edge pixels.
 * Pure (Node: scripts/test-884.js): PAPERS, sheetLayout, cutMarks, guessCard.
 * Tim (verbatim): "will the business cards be printable" -> offered "a home A4 10-up sheet with cut marks" -> "yes, please add the next steps" */
(function (root) {
  "use strict";
  const PAPERS = { a4: { label: "A4 (210 × 297 mm)", w: 210, h: 297 }, letter: { label: "US Letter (8.5 × 11 in)", w: 215.9, h: 279.4 } };
  const MIN_MARGIN = 10;   // most printers do not print the outer few mm; the marks need room too
  /** the cards on a sheet: {paper, w, h, orient, cols, rows, n, x0, y0, cw, ch, gap, cells [{x, y, c, r}] in mm from the top left} -
   *  portrait or landscape, whichever holds more (portrait on a tie) */
  function sheetLayout(cw, ch, o0) {
    const o = o0 || {}, P = PAPERS[o.paper] || PAPERS.a4, gap = Math.max(0, Math.min(10, +o.gap || 0)), m = Math.max(MIN_MARGIN, +o.margin || 0);
    if (!(cw > 0 && ch > 0)) throw new Error("the card has no size");
    const fit = (W, H) => { const cols = Math.max(0, Math.floor((W - 2 * m + gap) / (cw + gap))), rows = Math.max(0, Math.floor((H - 2 * m + gap) / (ch + gap))); return { W, H, cols, rows, n: cols * rows }; };
    const por = fit(P.w, P.h), land = fit(P.h, P.w), best = land.n > por.n ? Object.assign(land, { orient: "landscape" }) : Object.assign(por, { orient: "portrait" });
    if (!best.n) throw new Error(`a ${cw} × ${ch} mm card does not fit on ${P.label}`);
    const gw = best.cols * cw + (best.cols - 1) * gap, gh = best.rows * ch + (best.rows - 1) * gap, x0 = (best.W - gw) / 2, y0 = (best.H - gh) / 2, cells = [];
    for (let r = 0; r < best.rows; r++) for (let c = 0; c < best.cols; c++) cells.push({ c, r, x: x0 + c * (cw + gap), y: y0 + r * (ch + gap) });
    return { paper: o.paper && PAPERS[o.paper] ? o.paper : "a4", w: best.W, h: best.H, orient: best.orient, cols: best.cols, rows: best.rows, n: best.n, x0, y0, gw, gh, cw, ch, gap, cells };
  }
  /** the back of cell (c, r): the same row, the column mirrored (a duplex printer flips the sheet on its long edge) */
  const backCell = (L, cell) => L.cells.find((k) => k.r === cell.r && k.c === L.cols - 1 - cell.c);
  /** cut marks: short lines in the margin on every cut line, never over a card - [{x1, y1, x2, y2}] in mm */
  function cutMarks(L, o0) {
    const o = o0 || {}, off = o.offset != null ? o.offset : 2, len = o.length != null ? o.length : 5, out = [];
    const xs = new Set(), ys = new Set();
    for (let c = 0; c < L.cols; c++) { const x = L.x0 + c * (L.cw + L.gap); xs.add(+x.toFixed(3)); xs.add(+(x + L.cw).toFixed(3)); }
    for (let r = 0; r < L.rows; r++) { const y = L.y0 + r * (L.ch + L.gap); ys.add(+y.toFixed(3)); ys.add(+(y + L.ch).toFixed(3)); }
    const top = L.y0, bot = L.y0 + L.gh, left = L.x0, right = L.x0 + L.gw;
    const room = (a) => Math.max(0, Math.min(len, a - off - 1));
    for (const x of xs) { const lt = room(top), lb = room(L.h - bot); if (lt) out.push({ x1: x, y1: top - off - lt, x2: x, y2: top - off }); if (lb) out.push({ x1: x, y1: bot + off, x2: x, y2: bot + off + lb }); }
    for (const y of ys) { const ll = room(left), lr = room(L.w - right); if (ll) out.push({ x1: left - off - ll, y1: y, x2: left - off, y2: y }); if (lr) out.push({ x1: right + off, y1: y, x2: right + off + lr, y2: y }); }
    return out;
  }
  /** the card's size in mm from the open page (pcpages entry {wmm, hmm, orient}) or its pixels at its dpi */
  function guessCard(pg, wpx, hpx) {
    if (pg && pg.wmm > 0 && pg.hmm > 0) { const a = Math.min(pg.wmm, pg.hmm), b = Math.max(pg.wmm, pg.hmm), land = pg.orient === "landscape" || (pg.orient !== "portrait" && pg.wmm > pg.hmm); return land ? { w: b, h: a } : { w: a, h: b }; }
    const dpi = (pg && pg.dpi) || 300; return { w: Math.round(wpx / dpi * 254) / 10, h: Math.round(hpx / dpi * 254) / 10 };
  }
  const pure = { PAPERS, MIN_MARGIN, sheetLayout, backCell, cutMarks, guessCard };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  function install(E) {
    const { S, doc, win } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.addCmd) return;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const store = { get: (k, d) => { try { const v = win.localStorage.getItem("pc.cardsheet." + k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { win.localStorage.setItem("pc.cardsheet." + k, v); } catch (e) { /* fine */ } } };
    let lib = null;
    const pdflib = () => lib || (lib = new Promise((ok, no) => { if (win.PDFLib) return ok(win.PDFLib); const s = doc.createElement("script"); s.src = "/static/vendor/pdf-lib.min.js"; s.onload = () => (win.PDFLib ? ok(win.PDFLib) : no(new Error("pdf-lib did not load"))); s.onerror = () => { lib = null; no(new Error("pdf-lib is missing")); }; doc.head.appendChild(s); }));
    /** the card's pages as pictures (Front, Back) at their own pixels */
    async function sides() {
      const out = [];
      const one = async (pg) => { const f = E.flatten(), c = E.newCanvas(f.width, f.height); c.getContext("2d").drawImage(f, 0, 0); out.push({ canvas: c, name: pg && pg.name ? pg.name : "", pg }); };
      if (E.pages && E.pages.eachPage && E.pages.count && E.pages.count() > 1) await E.pages.eachPage(one); else await one(E.pages && E.pages.current ? E.pages.current() : null);
      return out.slice(0, 2);
    }
    const pngBytes = (c) => new Promise((ok, no) => c.toBlob((b) => (b ? b.arrayBuffer().then((ab) => ok(new Uint8Array(ab))) : no(new Error("no picture"))), "image/png"));
    /** the PDF: page 1 the fronts, page 2 the backs (mirrored columns), cut marks on both */
    async function buildPdf(L, faces, o) {
      const PL = await pdflib(), pdf = await PL.PDFDocument.create(), pt = (mm) => mm * 72 / 25.4;
      pdf.setTitle(o.title || "Business cards"); pdf.setCreator("bitGen Studio"); pdf.setProducer("bitGen Studio");
      const marks = o.marks ? cutMarks(L) : [];
      for (let s = 0; s < faces.length; s++) {
        const page = pdf.addPage([pt(L.w), pt(L.h)]), img = await pdf.embedPng(await pngBytes(faces[s].canvas)), bl = o.bleed || 0;
        for (const cell of L.cells) {
          const at = s === 0 ? cell : backCell(L, cell) || cell;
          // the bleed: the card drawn a little bigger underneath (its edge colours run into the gap), then exactly on top
          if (bl) page.drawImage(img, { x: pt(at.x - bl), y: pt(L.h - at.y - L.ch - bl), width: pt(L.cw + 2 * bl), height: pt(L.ch + 2 * bl) });
          page.drawImage(img, { x: pt(at.x), y: pt(L.h - at.y - L.ch), width: pt(L.cw), height: pt(L.ch) });
        }
        for (const k of marks) page.drawLine({ start: { x: pt(k.x1), y: pt(L.h - k.y1) }, end: { x: pt(k.x2), y: pt(L.h - k.y2) }, thickness: 0.3, color: PL.rgb(0, 0, 0) });
        page.drawText(`${faces.length > 1 ? (s === 0 ? "FRONTS" : "BACKS (print on the back - flip on the long edge)") : "CARDS"} · ${L.n} × ${+L.cw.toFixed(1)} × ${+L.ch.toFixed(1)} mm · print at actual size (100 %)`,
          { x: pt(L.x0), y: pt(Math.max(2.5, L.y0 / 2 - 1.2)), size: 6, color: PL.rgb(0.45, 0.45, 0.45) });
      }
      return await pdf.save();
    }
    function preview(L, o) {
      const k = 260 / Math.max(L.w, L.h), r = (v) => +(v * k).toFixed(2);
      return `<svg width="${r(L.w)}" height="${r(L.h)}" viewBox="0 0 ${r(L.w)} ${r(L.h)}" style="background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">`
        + L.cells.map((c) => `<rect x="${r(c.x)}" y="${r(c.y)}" width="${r(L.cw)}" height="${r(L.ch)}" fill="#dbe7f5" stroke="#5b7fa8" stroke-width=".6"/>`).join("")
        + (o.marks ? cutMarks(L).map((m) => `<line x1="${r(m.x1)}" y1="${r(m.y1)}" x2="${r(m.x2)}" y2="${r(m.y2)}" stroke="#000" stroke-width=".6"/>`).join("") : "") + `</svg>`;
    }
    async function open() {
      if (!S.w) return say("open or make a business card first (✨ Create ▸ 💳 Business card)");
      const pg = E.pages && E.pages.current ? E.pages.current() : null, card = guessCard(pg, S.w, S.h), n = E.pages && E.pages.count ? E.pages.count() : 1;
      const o = { paper: store.get("paper", "a4"), gap: +store.get("gap", "0"), marks: store.get("marks", "1") === "1", backs: n > 1, bleed: +store.get("bleed", "0") };
      E.ui.dialog("📇 Business Card Sheet", `<div class="kxrow"><span>The card</span><b id="pccsCard">${+card.w.toFixed(1)} × ${+card.h.toFixed(1)} mm</b><span style="color:var(--pc-dim)">${n > 1 ? "Front + Back (pages 1 and 2)" : "one side"}</span></div>
        <div class="kxrow"><span>Paper</span><select id="pccsPaper">${Object.entries(PAPERS).map(([k, p]) => `<option value="${k}"${k === o.paper ? " selected" : ""}>${esc(p.label)}</option>`).join("")}</select>
          <span>Gap between cards</span><select id="pccsGap">${[0, 2, 3, 5].map((g) => `<option value="${g}"${g === o.gap ? " selected" : ""}>${g ? g + " mm (cut each side)" : "none (one cut between cards)"}</option>`).join("")}</select></div>
        <div class="kxrow"><label><input type="checkbox" id="pccsMarks"${o.marks ? " checked" : ""}> cut marks</label>${n > 1 ? `<label><input type="checkbox" id="pccsBacks" checked> backs on page 2 (mirrored for printing both sides)</label>` : ""}
          <span>Bleed</span><select id="pccsBleed">${[0, 1, 2].map((b) => `<option value="${b}"${b === o.bleed ? " selected" : ""}>${b ? b + " mm (with a gap)" : "none"}</option>`).join("")}</select></div>
        <div class="kxrow" style="align-items:flex-start;gap:12px"><div id="pccsPrev"></div><div id="pccsInfo" style="max-width:260px;color:var(--pc-dim)"></div></div>`, (d) => {
        make(card, read(d)).catch((e) => say("📇 " + e.message));
      }, { okLabel: "📇 Make the PDF", init: (d) => {
        const paint = () => {
          const v = read(d);
          try {
            const L = sheetLayout(card.w, card.h, v);
            d.querySelector("#pccsPrev").innerHTML = preview(L, v);
            d.querySelector("#pccsInfo").innerHTML = `<div>${esc(`${L.n} cards (${L.cols} × ${L.rows}) on ${PAPERS[L.paper].label.split(" (")[0]} ${L.orient}.`)}</div><div>${esc('Print at actual size (100 %, not "fit to page").')}</div>`
              + (v.backs ? `<div>${esc("For the backs print page 2 on the back of the sheet, flipped on the long edge (or both sides at once: long-edge duplex).")}</div>` : "") + `<div>${esc("Cut along the marks with a ruler or a guillotine.")}</div>`;
            d.querySelector(".ok").disabled = false;
          } catch (e) { d.querySelector("#pccsPrev").innerHTML = ""; d.querySelector("#pccsInfo").textContent = e.message; d.querySelector(".ok").disabled = true; }
        };
        d.querySelectorAll("select,input").forEach((x) => x.addEventListener("change", paint)); paint();
      } });
    }
    function read(d) {
      const q = (id) => d.querySelector("#" + id);
      const v = { paper: q("pccsPaper").value, gap: +q("pccsGap").value, marks: q("pccsMarks").checked, backs: !!(q("pccsBacks") && q("pccsBacks").checked), bleed: +q("pccsBleed").value };
      if (!v.gap) v.bleed = 0;   // touching cards: a bleed would run into the next card
      store.set("paper", v.paper); store.set("gap", String(v.gap)); store.set("marks", v.marks ? "1" : "0"); store.set("bleed", String(v.bleed));
      return v;
    }
    async function make(card, v) {
      say("📇 drawing the card…");
      const L = sheetLayout(card.w, card.h, v), faces = await sides();
      const use = v.backs ? faces : faces.slice(0, 1);
      const bytes = await buildPdf(L, use, { marks: v.marks, bleed: v.bleed, title: (S.name || "Business card") + " - card sheet" });
      const stem = String(S.bgiName || S.name || "business-card").replace(/\.[a-z0-9]+$/i, "").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60) + " - card sheet.pdf";
      let saved = null;
      try { const r = await win.fetch("/api/pdf/save?name=" + encodeURIComponent(stem), { method: "POST", headers: { "Content-Type": "application/pdf" }, body: bytes }); const j = await r.json(); if (r.ok) saved = j; } catch (e) { /* downloaded anyway */ }
      const a = doc.createElement("a"); a.href = win.URL.createObjectURL(new win.Blob([bytes], { type: "application/pdf" })); a.download = saved ? saved.name : stem;
      doc.body.appendChild(a); a.click(); setTimeout(() => { win.URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      E.cardSheet.last = { layout: L, size: bytes.length, sides: use.length, name: saved ? saved.name : stem };
      say(`📇 ${L.n} cards on ${PAPERS[L.paper].label.split(" (")[0]} (${use.length > 1 ? "fronts + mirrored backs" : "one side"}${v.marks ? ", cut marks" : ""}) - ${saved ? saved.name + " in the project's pdf folder, " : ""}downloaded. Print at actual size (100 %).`);
      return E.cardSheet.last;
    }
    E.ui.addCmd("file.cardsheet", "📇 Business Card Sheet…", "", () => open(), { enabled: () => !!S.w }, ["File", "file.printpreview"]);
    E.cardSheet = { open, make, sides, buildPdf, last: null };
  }
  const PCCardSheet = Object.assign({ install }, pure);
  if (root && root.document) root.PCCardSheet = PCCardSheet;
})(typeof window !== "undefined" ? window : globalThis);
