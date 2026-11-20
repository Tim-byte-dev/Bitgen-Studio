/* ext/imageeditdock/pccardsheet.js — 2.884.0: 📇 File ▸ Business Card Sheet… in the image editor - the open card (its Front page,
 * and its Back page when it has one) laid out as many times as fit on an A4 or US Letter sheet (10 Australian 90 × 55 mm cards on A4
 * portrait), with cut marks outside the cards, as a PDF to print at actual size: page 1 the fronts, page 2 the backs - mirrored so
 * they line up when the printer prints both sides (flipped on the long edge). Saved in the project's pdf folder and downloaded.
 * 2.896.0 (PARKED item 4, Tim: "continue next" / "lets do next") - Layout ▾:
 *   🖨 Home printer sheet    - as before (A4 / Letter, a gap, a bleed now made from the card's own edge pixels, not stretched)
 *   🏷 Label / card stock     - YOUR stock's sizes typed (paper, across × down, the card, top / left margin, the pitch; kept by name
 *                              in <install>/business/card_stocks.json - lib/cardStocks.js; no maker's templates copied); the card
 *                              fitted into each label when the sizes differ
 *   🏭 Print shop sheet       - SRA3 / SRA4 / A3 / 12 × 18 / 13 × 19 in / Tabloid / custom; a bleed on every card (3 mm), the gap at
 *                              least two bleeds, crop marks in registration colour, registration targets, a job line
 *   ✂ Print shop single card - one card a page, the page = the card + bleed (+ room for the crop marks), TrimBox / BleedBox set
 * and Cards ▾: the open card, or 📋 a card per row of a list (a team's names - pccardlist.js), each row's copies, as many sheets as
 * it takes; the pages of a many-page document as different cards (one side each).
 * Pure (Node: scripts/test-884.js, scripts/test-896.js): PAPERS, paperOf, sheetLayout, stockLayout, singleLayout, fitIn, backCell,
 * backPos, cutMarks, regMarks, paginate, guessCard. */
(function (root) {
  "use strict";
  const PAPERS = {
    a4: { label: "A4 (210 × 297 mm)", w: 210, h: 297, home: true },
    letter: { label: "US Letter (8.5 × 11 in)", w: 215.9, h: 279.4, home: true },
    a3: { label: "A3 (297 × 420 mm)", w: 297, h: 420 },
    sra4: { label: "SRA4 (225 × 320 mm)", w: 225, h: 320 },
    sra3: { label: "SRA3 (320 × 450 mm)", w: 320, h: 450 },
    tabloid: { label: "Tabloid (11 × 17 in)", w: 279.4, h: 431.8 },
    in12x18: { label: "12 × 18 in (305 × 457 mm)", w: 304.8, h: 457.2 },
    in13x19: { label: "13 × 19 in (330 × 483 mm)", w: 330.2, h: 482.6 },
    custom: { label: "Custom size…", w: 0, h: 0 },
  };
  const MIN_MARGIN = 10;   // most printers do not print the outer few mm; the marks need room too
  const r1 = (v) => Math.round(v * 10) / 10;
  /** the paper picked: {id, label, w, h} (custom = o.pw × o.ph in mm) */
  function paperOf(o0) {
    const o = o0 || {};
    if (o.paper === "custom") {
      const w = +o.pw, h = +o.ph;
      if (!(w >= 50 && h >= 50 && w <= 1300 && h <= 1300)) throw new Error("type the custom paper's width and height (50 - 1300 mm)");
      return { id: "custom", label: `${r1(w)} × ${r1(h)} mm`, w, h };
    }
    const id = PAPERS[o.paper] && o.paper !== "custom" ? o.paper : "a4";
    return Object.assign({ id }, PAPERS[id]);
  }
  /** the cards on a sheet: {paper, w, h, orient, cols, rows, n, x0, y0, cw, ch, gap, bleed, cells [{x, y, c, r}] in mm from the top
   *  left} - portrait or landscape, whichever holds more (portrait on a tie). o.mode "shop": the gap at least two bleeds (each card
   *  has its own), the margin o.margin (5 mm at least - the press's gripper + the marks) */
  function sheetLayout(cw, ch, o0) {
    const o = o0 || {}, P = paperOf(o), shop = o.mode === "shop", bleed = Math.max(0, Math.min(10, +o.bleed || 0));
    let gap = Math.max(0, Math.min(30, +o.gap || 0)); if (shop) gap = Math.max(gap, 2 * bleed);
    const m = shop ? Math.max(5, +o.margin || MIN_MARGIN) : Math.max(MIN_MARGIN, +o.margin || 0);
    if (!(cw > 0 && ch > 0)) throw new Error("the card has no size");
    const fit = (W, H) => { const cols = Math.max(0, Math.floor((W - 2 * m + gap + 1e-9) / (cw + gap))), rows = Math.max(0, Math.floor((H - 2 * m + gap + 1e-9) / (ch + gap))); return { W, H, cols, rows, n: cols * rows }; };
    const por = fit(P.w, P.h), land = fit(P.h, P.w), best = land.n > por.n ? Object.assign(land, { orient: "landscape" }) : Object.assign(por, { orient: "portrait" });
    if (!best.n) throw new Error(`a ${r1(cw)} × ${r1(ch)} mm card${shop && bleed ? ` with ${bleed} mm bleed` : ""} does not fit on ${P.label}`);
    const gw = best.cols * cw + (best.cols - 1) * gap, gh = best.rows * ch + (best.rows - 1) * gap, x0 = (best.W - gw) / 2, y0 = (best.H - gh) / 2, cells = [];
    for (let r = 0; r < best.rows; r++) for (let c = 0; c < best.cols; c++) cells.push({ c, r, x: x0 + c * (cw + gap), y: y0 + r * (ch + gap) });
    return { mode: shop ? "shop" : "home", paper: P.id, paperLabel: P.label, w: best.W, h: best.H, orient: best.orient, cols: best.cols, rows: best.rows, n: best.n, x0, y0, gw, gh, cw, ch, gap, bleed, cells };
  }
  /** a card fitted into a cell (the whole card seen, centred): {dx, dy, w, h, exact} */
  function fitIn(cw, ch, W, H) {
    if (Math.abs(cw - W) < 0.3 && Math.abs(ch - H) < 0.3) return { dx: 0, dy: 0, w: W, h: H, exact: true };
    const k = Math.min(W / cw, H / ch), w = cw * k, h = ch * k;
    return { dx: (W - w) / 2, dy: (H - h) / 2, w, h, exact: false };
  }
  /** YOUR label / card stock (lib/cardStocks.js clean() checks the same on the server) - the cells where the stock has them */
  function stockLayout(st, card) {
    const s = st || {}, pw = +(s.paper && s.paper.w), ph = +(s.paper && s.paper.h), cols = Math.round(+s.cols), rows = Math.round(+s.rows), cw = +s.cw, ch = +s.ch;
    const top = +s.top || 0, left = +s.left || 0, hp = cols > 1 ? +s.hpitch : cw, vp = rows > 1 ? +s.vpitch : ch;
    if (!(pw >= 50 && ph >= 50)) throw new Error("type the stock's paper size (mm)");
    if (!(cols >= 1 && rows >= 1 && cols <= 50 && rows <= 50)) throw new Error("across and down: 1 - 50");
    if (!(cw >= 5 && ch >= 5)) throw new Error("type the size of one card / label on the stock (mm)");
    if (!(hp >= cw - 0.01)) throw new Error(`the across pitch (${r1(hp)} mm) is less than the card's width - they would overlap`);
    if (!(vp >= ch - 0.01)) throw new Error(`the down pitch (${r1(vp)} mm) is less than the card's height - they would overlap`);
    const right = left + (cols - 1) * hp + cw, bottom = top + (rows - 1) * vp + ch;
    if (right > pw + 0.5) throw new Error(`the cards reach ${r1(right)} mm across - past the ${r1(pw)} mm paper`);
    if (bottom > ph + 0.5) throw new Error(`the cards reach ${r1(bottom)} mm down - past the ${r1(ph)} mm paper`);
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ c, r, x: left + c * hp, y: top + r * vp });
    const k = card && card.w > 0 ? fitIn(card.w, card.h, cw, ch) : fitIn(cw, ch, cw, ch);
    return { mode: "stock", paper: "stock", paperLabel: s.name || `${r1(pw)} × ${r1(ph)} mm`, w: pw, h: ph, orient: pw > ph ? "landscape" : "portrait", cols, rows, n: cols * rows,
      x0: left, y0: top, gw: right - left, gh: bottom - top, cw, ch, gap: hp - cw, vgap: vp - ch, bleed: 0, cells, fit: k };
  }
  /** ✂ a print shop's single card: one card a page - the page = the card + its bleed (+ 12 mm round it for the crop marks / job line) */
  function singleLayout(cw, ch, o0) {
    const o = o0 || {}, b = Math.max(0, Math.min(10, o.bleed == null ? 3 : +o.bleed)), slug = o.marks ? 12 : 0, e = b + slug;
    if (!(cw > 0 && ch > 0)) throw new Error("the card has no size");
    return { mode: "single", paper: "single", paperLabel: `${r1(cw + 2 * e)} × ${r1(ch + 2 * e)} mm`, w: cw + 2 * e, h: ch + 2 * e, orient: cw >= ch ? "landscape" : "portrait",
      cols: 1, rows: 1, n: 1, x0: e, y0: e, gw: cw, gh: ch, cw, ch, gap: 0, bleed: b, cells: [{ c: 0, r: 0, x: e, y: e }],
      trim: { x: e, y: e, w: cw, h: ch }, bleedBox: { x: e - b, y: e - b, w: cw + 2 * b, h: ch + 2 * b } };
  }
  /** the back of cell (c, r): the same row, the column mirrored (a duplex printer flips the sheet on its long edge) */
  const backCell = (L, cell) => L.cells.find((k) => k.r === cell.r && k.c === L.cols - 1 - cell.c);
  /** where a card's back goes on the back page: mirrored across the sheet (any layout - a stock's margins need not be even) */
  const backPos = (L, cell) => ({ x: L.w - cell.x - L.cw, y: cell.y });
  /** cut / crop marks: short lines in the margin on every cut line, outside the cards' bleed, never over a card - [{x1, y1, x2, y2}] mm */
  function cutMarks(L, o0) {
    const o = o0 || {}, off = o.offset != null ? o.offset : (L.bleed || 0) + 2, len = o.length != null ? o.length : 5, out = [];
    const xs = new Set(), ys = new Set();
    for (const c of L.cells) { xs.add(+c.x.toFixed(3)); xs.add(+(c.x + L.cw).toFixed(3)); ys.add(+c.y.toFixed(3)); ys.add(+(c.y + L.ch).toFixed(3)); }
    const top = Math.min(...L.cells.map((c) => c.y)), left = Math.min(...L.cells.map((c) => c.x)), bot = Math.max(...L.cells.map((c) => c.y)) + L.ch, right = Math.max(...L.cells.map((c) => c.x)) + L.cw;
    const room = (a) => Math.max(0, Math.min(len, a - off - 1));
    for (const x of xs) { const lt = room(top), lb = room(L.h - bot); if (lt) out.push({ x1: x, y1: top - off - lt, x2: x, y2: top - off }); if (lb) out.push({ x1: x, y1: bot + off, x2: x, y2: bot + off + lb }); }
    for (const y of ys) { const ll = room(left), lr = room(L.w - right); if (ll) out.push({ x1: left - off - ll, y1: y, x2: left - off, y2: y }); if (lr) out.push({ x1: right + off, y1: y, x2: right + off + lr, y2: y }); }
    return out;
  }
  /** 🏭 registration targets (a circle + cross, r mm) in the middle of each side's margin, slid along clear of the crop marks;
   *  a side without room has none */
  function regMarks(L, o0) {
    const o = o0 || {}, r = o.r || 2.5, off = (L.bleed || 0) + 2, out = [];
    const xs = [...new Set(L.cells.flatMap((c) => [c.x, c.x + L.cw]))], ys = [...new Set(L.cells.flatMap((c) => [c.y, c.y + L.ch]))];
    const top = Math.min(...L.cells.map((c) => c.y)), left = Math.min(...L.cells.map((c) => c.x)), bot = Math.max(...L.cells.map((c) => c.y)) + L.ch, right = Math.max(...L.cells.map((c) => c.x)) + L.cw;
    const clear = (v, lines, lo, hi) => { for (let d = 0; d < 200; d += 0.5) for (const s of [1, -1]) { const p = v + s * d; if (p - r >= lo && p + r <= hi && lines.every((q) => Math.abs(q - p) > r + 1)) return p; } return null; };
    const band = (a) => a - off;   // the room between the cards' bleed + gap and the paper's edge
    if (band(top) >= 2 * r + 2) { const x = clear(L.w / 2, xs, left, right); if (x != null) out.push({ x, y: top - off - Math.min(band(top) - r - 0.5, r + 3), r }); }
    if (band(L.h - bot) >= 2 * r + 2) { const x = clear(L.w / 2, xs, left, right); if (x != null) out.push({ x, y: bot + off + Math.min(band(L.h - bot) - r - 0.5, r + 3), r }); }
    if (band(left) >= 2 * r + 2) { const y = clear(L.h / 2, ys, top, bot); if (y != null) out.push({ x: left - off - Math.min(band(left) - r - 0.5, r + 3), y, r }); }
    if (band(L.w - right) >= 2 * r + 2) { const y = clear(L.h / 2, ys, top, bot); if (y != null) out.push({ x: right + off + Math.min(band(L.w - right) - r - 0.5, r + 3), y, r }); }
    return out;
  }
  /** the cards to print in sheets: variants [{copies}] -> [[variant index | null per cell]] (each variant's copies one after another) */
  function paginate(vars, n) {
    const items = []; (vars || [{ copies: n }]).forEach((v, i) => { for (let k = 0; k < Math.max(1, Math.round(+v.copies || 1)); k++) items.push(i); });
    const sheets = [];
    for (let i = 0; i < items.length; i += n) { const s = items.slice(i, i + n); while (s.length < n) s.push(null); sheets.push(s); }
    return sheets;
  }
  /** the card's size in mm from the open page (pcpages entry {wmm, hmm, orient}) or its pixels at its dpi */
  function guessCard(pg, wpx, hpx) {
    if (pg && pg.wmm > 0 && pg.hmm > 0) { const a = Math.min(pg.wmm, pg.hmm), b = Math.max(pg.wmm, pg.hmm), land = pg.orient === "landscape" || (pg.orient !== "portrait" && pg.wmm > pg.hmm); return land ? { w: b, h: a } : { w: a, h: b }; }
    const dpi = (pg && pg.dpi) || 300; return { w: Math.round(wpx / dpi * 254) / 10, h: Math.round(hpx / dpi * 254) / 10 };
  }
  const pure = { PAPERS, MIN_MARGIN, paperOf, sheetLayout, stockLayout, singleLayout, fitIn, backCell, backPos, cutMarks, regMarks, paginate, guessCard };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  const MODES = [["home", "🖨 Home printer sheet (A4 / Letter)"], ["stock", "🏷 Label / perforated card stock (your sizes)"], ["shop", "🏭 Print shop sheet (bleed + crop marks)"], ["single", "✂ Print shop: one card a page (bleed + crop marks)"]];
  function install(E) {
    const { S, doc, win } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.addCmd) return;
    const CL = () => root.PCCardList;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const store = { get: (k, d) => { try { const v = win.localStorage.getItem("pc.cardsheet." + k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { win.localStorage.setItem("pc.cardsheet." + k, v); } catch (e) { /* fine */ } } };
    let lib = null;
    const pdflib = () => lib || (lib = new Promise((ok, no) => { if (win.PDFLib) return ok(win.PDFLib); const s = doc.createElement("script"); s.src = "/static/vendor/pdf-lib.min.js"; s.onload = () => (win.PDFLib ? ok(win.PDFLib) : no(new Error("pdf-lib did not load"))); s.onerror = () => { lib = null; no(new Error("pdf-lib is missing")); }; doc.head.appendChild(s); }));
    const copyOf = (f) => { const c = E.newCanvas(f.width, f.height); c.getContext("2d").drawImage(f, 0, 0); return c; };
    const textLayers = () => S.layers.filter((L) => L && L.text && typeof L.text.str === "string");
    /** each page as a picture: [{canvas, name, pg}] */
    async function sides() {
      const out = [];
      const one = async (pg) => { out.push({ canvas: copyOf(E.flatten()), name: pg && pg.name ? pg.name : "", pg }); };
      if (E.pages && E.pages.eachPage && E.pages.count && E.pages.count() > 1) await E.pages.eachPage(one); else await one(E.pages && E.pages.current ? E.pages.current() : null);
      return out;
    }
    /** the words on the card's first two pages (front + back) - for the list's columns */
    async function sideTexts() {
      const out = [];
      const one = async (pg, i) => { if ((i || 0) < 2) textLayers().forEach((L) => out.push(L.text.str)); };
      if (E.pages && E.pages.eachPage && E.pages.count && E.pages.count() > 1) await E.pages.eachPage(one); else await one(null, 0);
      return out;
    }
    /** 📋 every variant's sides: [[front, back]] - the mapped words swapped on each side's text layers, drawn, put back */
    async function renderVariants(vars, nSides) {
      const res = vars.map(() => []), redraw = (L) => { if (root.PCLiveWarp && root.PCLiveWarp.dirty) root.PCLiveWarp.dirty(L); E.D.rasterize(L); };
      const one = async (pg, i0) => {
        const i = i0 || 0; if (i >= nSides) return;
        const base = copyOf(E.flatten()), tl = textLayers();
        for (let v = 0; v < vars.length; v++) {
          const was = [];
          for (const L of tl) { const nw = CL().applyRow(L.text.str, vars[v].pairs); if (nw !== L.text.str) { was.push([L, L.text.str]); L.text.str = nw; redraw(L); } }
          if (!was.length) { res[v][i] = base; continue; }
          try { res[v][i] = copyOf(E.flatten()); } finally { for (const [L, s] of was) { L.text.str = s; redraw(L); } }
        }
      };
      if (E.pages && E.pages.eachPage && E.pages.count && E.pages.count() > 1) await E.pages.eachPage(one); else await one(null, 0);
      if (E.refresh) E.refresh();
      return res;
    }
    /** the card with its own edge pixels carried out by bx / by px all round (a real bleed - nothing stretched or cut) */
    function bleedCanvas(src, bx, by) {
      const w = src.width, h = src.height, c = E.newCanvas(w + 2 * bx, h + 2 * by), g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(src, bx, by);
      if (bx || by) {
        g.drawImage(src, 0, 0, w, 1, bx, 0, w, by); g.drawImage(src, 0, h - 1, w, 1, bx, by + h, w, by);
        g.drawImage(src, 0, 0, 1, h, 0, by, bx, h); g.drawImage(src, w - 1, 0, 1, h, bx + w, by, bx, h);
        g.drawImage(src, 0, 0, 1, 1, 0, 0, bx, by); g.drawImage(src, w - 1, 0, 1, 1, bx + w, 0, bx, by);
        g.drawImage(src, 0, h - 1, 1, 1, 0, by + h, bx, by); g.drawImage(src, w - 1, h - 1, 1, 1, bx + w, by + h, bx, by);
      }
      return c;
    }
    const pngBytes = (c) => new Promise((ok, no) => c.toBlob((b) => (b ? b.arrayBuffer().then((ab) => ok(new Uint8Array(ab))) : no(new Error("no picture"))), "image/png"));
    /** the PDF: for each sheet the fronts, then (o.backs) the backs mirrored; marks / targets / the job line; ✂ single = TrimBox + BleedBox */
    async function buildPdf(L, sheets, faces, o) {
      const PL = await pdflib(), pdf = await PL.PDFDocument.create(), pt = (mm) => mm * 72 / 25.4;
      pdf.setTitle(o.title || "Business cards"); pdf.setCreator("bitGen Studio"); pdf.setProducer("bitGen Studio");
      const shopLike = L.mode === "shop" || L.mode === "single", ink = shopLike ? PL.cmyk(1, 1, 1, 1) : PL.rgb(0, 0, 0);   // crop marks in registration colour for a press
      const marks = o.marks ? cutMarks(L) : [], regs = o.reg && L.mode === "shop" ? regMarks(L) : [], embedded = new Map();
      const embed = async (c) => { if (!embedded.has(c)) embedded.set(c, await pdf.embedPng(await pngBytes(c))); return embedded.get(c); };
      const bleedOf = new Map(), bl = L.bleed || 0;
      const withBleed = (c) => { if (!bleedOf.has(c)) bleedOf.set(c, bleedCanvas(c, Math.round(c.width * bl / L.cw), Math.round(c.height * bl / L.ch))); return bleedOf.get(c); };
      const fit = L.fit || { dx: 0, dy: 0, w: L.cw, h: L.ch };
      const twoSided = o.backs && faces.some((f) => f[1]);
      for (let s = 0; s < sheets.length; s++) for (let side = 0; side < (twoSided ? 2 : 1); side++) {
        const page = pdf.addPage([pt(L.w), pt(L.h)]);
        if (L.mode === "single") {
          page.setTrimBox(pt(L.trim.x), pt(L.h - L.trim.y - L.trim.h), pt(L.trim.w), pt(L.trim.h));
          page.setBleedBox(pt(L.bleedBox.x), pt(L.h - L.bleedBox.y - L.bleedBox.h), pt(L.bleedBox.w), pt(L.bleedBox.h));
        }
        const placed = [];
        sheets[s].forEach((vi, k) => { if (vi == null || !faces[vi]) return; const f = faces[vi][side] || (side ? null : faces[vi][0]); if (!f) return; placed.push({ f, at: side ? backPos(L, L.cells[k]) : L.cells[k] }); });
        // the bleeds first (a neighbour's bleed never covers a card), then every card exactly on its trim
        if (bl) for (const p of placed) page.drawImage(await embed(withBleed(p.f)), { x: pt(p.at.x - bl), y: pt(L.h - p.at.y - L.ch - bl), width: pt(L.cw + 2 * bl), height: pt(L.ch + 2 * bl) });
        for (const p of placed) page.drawImage(await embed(p.f), { x: pt(p.at.x + fit.dx), y: pt(L.h - p.at.y - fit.dy - fit.h), width: pt(fit.w), height: pt(fit.h) });
        for (const k of marks) page.drawLine({ start: { x: pt(k.x1), y: pt(L.h - k.y1) }, end: { x: pt(k.x2), y: pt(L.h - k.y2) }, thickness: 0.25, color: ink });
        for (const g of regs) {
          page.drawCircle({ x: pt(g.x), y: pt(L.h - g.y), size: pt(g.r * 0.62), borderWidth: 0.25, borderColor: ink });
          page.drawLine({ start: { x: pt(g.x - g.r), y: pt(L.h - g.y) }, end: { x: pt(g.x + g.r), y: pt(L.h - g.y) }, thickness: 0.25, color: ink });
          page.drawLine({ start: { x: pt(g.x), y: pt(L.h - g.y - g.r) }, end: { x: pt(g.x), y: pt(L.h - g.y + g.r) }, thickness: 0.25, color: ink });
        }
        const what = twoSided ? (side ? (L.mode === "single" ? "BACK" : "BACKS (print on the back - flip on the long edge)") : (L.mode === "single" ? "FRONT" : "FRONTS")) : (L.mode === "single" ? "CARD" : "CARDS");
        const count = sheets[s].filter((v) => v != null).length, label = o.labels && o.labels.length > 1 && sheets[s][0] != null && L.mode === "single" ? ` · ${o.labels[sheets[s][0]]}` : "";
        const line = L.mode === "single"
          ? `${o.title || "Business card"}${label} · ${what} · ${r1(L.cw)} × ${r1(L.ch)} mm + ${bl} mm bleed${o.qty && o.qty[sheets[s][0]] ? ` · quantity ${o.qty[sheets[s][0]]}` : ""}`
          : `${what} · ${sheets.length > 1 ? `sheet ${s + 1} of ${sheets.length} · ` : ""}${count} × ${r1(L.cw)} × ${r1(L.ch)} mm${bl ? ` + ${bl} mm bleed` : ""} · ${L.paperLabel} · print at actual size (100 %)`;
        if (L.mode !== "single" || o.marks) {
          // the job line: ✂ under the crop marks; 🏭 in the band below the bottom crop marks (clear of them); else as 2.884.0 had it
          const below = L.h - Math.max(...L.cells.map((c) => c.y)) - L.ch - bl - 2 - (o.marks ? 5 : 0);
          const y = L.mode === "single" ? Math.max(1.5, L.trim.y - bl - 9) : L.mode === "shop" && below >= 3 ? Math.max(1, below / 2 - 0.8) : Math.max(2.5, Math.min(...L.cells.map((c) => c.y)) / 2 - 1.2);
          if (L.mode !== "shop" || o.slug !== false) page.drawText(line.slice(0, 160), { x: pt(L.mode === "single" ? 3 : Math.max(3, L.x0)), y: pt(y), size: L.mode === "single" ? 5 : 6, color: PL.rgb(0.45, 0.45, 0.45) });
        }
      }
      return await pdf.save();
    }
    /** the box's drawing: the paper, each card (coloured by whose card on a list), the marks, the targets; ✂ the trim inside the bleed */
    function preview(L, o, sheet, labels) {
      const k = 260 / Math.max(L.w, L.h), r = (v) => +(v * k).toFixed(2);
      const hue = (vi) => (vi * 67) % 360, fit = L.fit || { dx: 0, dy: 0, w: L.cw, h: L.ch };
      let s = `<svg width="${r(L.w)}" height="${r(L.h)}" viewBox="0 0 ${r(L.w)} ${r(L.h)}" style="background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">`;
      if (L.mode === "single") s += `<path d="M${r(L.bleedBox.x)} ${r(L.bleedBox.y)}h${r(L.bleedBox.w)}v${r(L.bleedBox.h)}h-${r(L.bleedBox.w)}z" fill="#f3c9c9"/>`;
      else if (L.bleed) s += L.cells.map((c) => `<path d="M${r(c.x - L.bleed)} ${r(c.y - L.bleed)}h${r(L.cw + 2 * L.bleed)}v${r(L.ch + 2 * L.bleed)}h-${r(L.cw + 2 * L.bleed)}z" fill="#f3c9c9"/>`).join("");
      if (L.mode === "stock") s += L.cells.map((c) => `<path d="M${r(c.x)} ${r(c.y)}h${r(L.cw)}v${r(L.ch)}h-${r(L.cw)}z" fill="none" stroke="#bbb" stroke-dasharray="2 2" stroke-width=".5"/>`).join("");
      s += L.cells.map((c, i) => {
        const vi = sheet ? sheet[i] : 0; if (vi == null) return "";
        const fill = labels && labels.length > 1 ? `hsl(${hue(vi)},55%,85%)` : "#dbe7f5", stroke = labels && labels.length > 1 ? `hsl(${hue(vi)},45%,40%)` : "#5b7fa8";
        return `<rect x="${r(c.x + fit.dx)}" y="${r(c.y + fit.dy)}" width="${r(fit.w)}" height="${r(fit.h)}" fill="${fill}" stroke="${stroke}" stroke-width=".6"/>`
          + (labels && labels.length > 1 ? `<text x="${r(c.x + fit.dx + 2)}" y="${r(c.y + fit.dy) + 9}" font-size="8" fill="#333">${esc(String(labels[vi]).slice(0, 14))}</text>` : "");
      }).join("");
      if (o.marks) s += cutMarks(L).map((m) => `<line x1="${r(m.x1)}" y1="${r(m.y1)}" x2="${r(m.x2)}" y2="${r(m.y2)}" stroke="#000" stroke-width=".6"/>`).join("");
      if (o.reg && L.mode === "shop") s += regMarks(L).map((g) => `<circle cx="${r(g.x)}" cy="${r(g.y)}" r="${r(g.r * 0.62)}" fill="none" stroke="#000" stroke-width=".5"/>`).join("");
      return s + `</svg>`;
    }
    const opts = (list, cur) => list.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(t)}</option>`).join("");
    const numIn = (id, label, v, w) => `<label class="pccs-n"><span>${esc(label)}</span><input type="number" id="${id}" step="0.1" min="0" value="${esc(v)}" style="width:${w || 62}px"></label>`;
    let stocks = [];
    async function loadStocks() { try { const r = await win.fetch("/api/cardstocks"); const j = await r.json(); stocks = j.stocks || []; } catch (e) { stocks = []; } return stocks; }
    async function open() {
      if (!S.w) return say("open or make a business card first (✨ Create ▸ 💳 Business card)");
      const pg = E.pages && E.pages.current ? E.pages.current() : null, card = guessCard(pg, S.w, S.h), n = E.pages && E.pages.count ? E.pages.count() : 1;
      const g = store.get, stock0 = g("stock", ""), o = { mode: g("mode", "home"), paper: g("paper", "a4"), gap: +g("gap", "0"), marks: g("marks", "1") === "1", bleed: +g("bleed", "0"),
        shopPaper: g("shopPaper", "sra3"), pw: g("pw", "320"), ph: g("ph", "450"), shopBleed: +g("shopBleed", "3"), shopGap: +g("shopGap", "0"), margin: +g("margin", "10"),
        reg: g("reg", "1") === "1", slug: g("slug", "1") === "1", singleBleed: +g("singleBleed", "3"), src: g("src", "one"), each: g("each", "sheet"), pages: g("pagesMode", "fb"), rows: g("rows", "") };
      const home0 = (() => { try { return sheetLayout(card.w, card.h, {}); } catch (e) { return null; } })();
      const st0 = { name: "", paper: { w: 210, h: 297 }, cols: home0 ? home0.cols : 1, rows: home0 ? home0.rows : 1, cw: card.w, ch: card.h, top: home0 ? r1(home0.y0) : 10, left: home0 ? r1(home0.x0) : 10, hpitch: card.w, vpitch: card.h };
      const html = `<div class="pccs">
        <div class="kxrow"><span>The card</span><b id="pccsCard">${+card.w.toFixed(1)} × ${+card.h.toFixed(1)} mm</b><span style="color:var(--pc-dim)">${n > 1 ? `${n} pages` : "one side"}</span>
          ${n > 1 ? `<select id="pccsPages">${opts([["fb", "pages 1 + 2 = front + back"], ["each", "each page is a different card (one side)"]], o.pages)}</select>` : ""}</div>
        <div class="kxrow"><span>Layout</span><select id="pccsMode">${opts(MODES, o.mode)}</select></div>
        <div class="kxrow pccs-m" data-m="home"><span>Paper</span><select id="pccsPaper">${opts(Object.entries(PAPERS).filter(([, p]) => p.home).map(([k, p]) => [k, p.label]), o.paper)}</select>
          <span>Gap between cards</span><select id="pccsGap">${opts([0, 2, 3, 5].map((v) => [v, v ? v + " mm (cut each side)" : "none (one cut between cards)"]), o.gap)}</select>
          <span>Bleed</span><select id="pccsBleed">${opts([0, 1, 2].map((v) => [v, v ? v + " mm (with a gap)" : "none"]), o.bleed)}</select></div>
        <div class="pccs-m" data-m="stock">
          <div class="kxrow"><span>Your stock</span><select id="pccsStock"><option value="">— type its sizes —</option></select>
            <input id="pccsStName" placeholder="name it (e.g. my 10-up card stock)" style="width:200px"><button class="ghost" id="pccsStSave" title="Keep these sizes under this name">💾 Keep</button><button class="ghost" id="pccsStDel" title="Delete this stock">🗑</button></div>
          <div class="kxrow pccs-grid">${numIn("pccsStPw", "Paper width", st0.paper.w)}${numIn("pccsStPh", "Paper height", st0.paper.h)}${numIn("pccsStCols", "Across", st0.cols, 48)}${numIn("pccsStRows", "Down", st0.rows, 48)}
            ${numIn("pccsStCw", "Card width", st0.cw)}${numIn("pccsStCh", "Card height", st0.ch)}${numIn("pccsStTop", "Top margin", st0.top)}${numIn("pccsStLeft", "Left margin", st0.left)}
            ${numIn("pccsStHp", "Across pitch", st0.hpitch)}${numIn("pccsStVp", "Down pitch", st0.vpitch)}</div>
          <div class="pccs-dim">${esc("All in mm, measured on your sheet or read off its packet. The pitch is from one card's left (top) edge to the next card's left (top) edge.")}</div></div>
        <div class="kxrow pccs-m" data-m="shop"><span>Paper</span><select id="pccsShopPaper">${opts(Object.entries(PAPERS).map(([k, p]) => [k, p.label]), o.shopPaper)}</select>
          <span id="pccsCustom">${numIn("pccsPw", "W", o.pw)}${numIn("pccsPh", "H", o.ph)}</span>
          <span>Bleed</span><select id="pccsShopBleed">${opts([2, 3, 5].map((v) => [v, v + " mm"]), o.shopBleed)}</select>
          <span>Gap</span><select id="pccsShopGap">${opts([[0, "two bleeds"], [8, "8 mm"], [10, "10 mm"], [15, "15 mm"]], o.shopGap)}</select>
          <span>Margin</span><select id="pccsMargin">${opts([5, 8, 10, 15].map((v) => [v, v + " mm"]), o.margin)}</select>
          <label><input type="checkbox" id="pccsReg"${o.reg ? " checked" : ""}> registration marks</label><label><input type="checkbox" id="pccsSlug"${o.slug ? " checked" : ""}> job line</label></div>
        <div class="kxrow pccs-m" data-m="single"><span>Bleed</span><select id="pccsSingleBleed">${opts([2, 3, 5].map((v) => [v, v + " mm"]), o.singleBleed)}</select>
          <span class="pccs-dim">${esc("Each card on its own page, trim and bleed boxes set - what most print shops ask for.")}</span></div>
        <div class="kxrow"><label><input type="checkbox" id="pccsMarks"${o.marks ? " checked" : ""}> <span id="pccsMarksL">cut marks</span></label>${n > 1 ? `<label><input type="checkbox" id="pccsBacks" checked> <span id="pccsBacksL">backs (mirrored for printing both sides)</span></label>` : ""}</div>
        <div class="kxrow"><span>Cards</span><select id="pccsSrc">${opts([["one", "this card"], ["list", "📋 a card per row of a list (a team's names)"]], o.src)}</select>
          <span>Copies of each</span><select id="pccsEach">${opts([["1", "1"], ["2", "2"], ["5", "5"], ["10", "10"], ["25", "25"], ["50", "50"], ["sheet", "a whole sheet"]], o.each)}</select></div>
        <div id="pccsListBox" class="pccs-list"><textarea id="pccsRows" rows="5" placeholder="${esc("Paste from a spreadsheet or type: the first row the column names, then a row per person, e.g.\nName, Role, Mobile, Email, Copies\nAlex Chen, Designer, 0412 345 678, alex@example.com, 50")}">${esc(o.rows)}</textarea>
          <div id="pccsMap"></div></div>
        <div class="kxrow" style="align-items:flex-start;gap:12px"><div id="pccsPrev"></div><div id="pccsInfo" style="max-width:280px;color:var(--pc-dim)"></div></div></div>`;
      const st = { map: null, headers: "", profile: null, lines: [], card, n };
      E.ui.dialog("📇 Business Card Sheet", html, (d) => { const v = read(d, st); if (v.err) { say("📇 " + v.err); return false; } make(st.card, v).catch((e) => say("📇 " + e.message)); }, { okLabel: "📇 Make the PDF", width: "min(880px, 96vw)", scroll: true, init: (d) => {
        const q = (id) => d.querySelector("#" + id);
        const paintStocks = (sel) => { q("pccsStock").innerHTML = `<option value="">— type its sizes —</option>` + stocks.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} (${s.cols} × ${s.rows}, ${r1(s.cw)} × ${r1(s.ch)} mm)</option>`).join(""); q("pccsStock").value = sel || ""; };
        const fillStock = (s) => { if (!s) return; q("pccsStName").value = s.name; [["pccsStPw", s.paper.w], ["pccsStPh", s.paper.h], ["pccsStCols", s.cols], ["pccsStRows", s.rows], ["pccsStCw", s.cw], ["pccsStCh", s.ch], ["pccsStTop", s.top], ["pccsStLeft", s.left], ["pccsStHp", s.hpitch], ["pccsStVp", s.vpitch]].forEach(([id, v]) => { q(id).value = v; }); };
        const paint = () => {
          const v = read(d, st), mode = v.mode;
          d.querySelectorAll(".pccs-m").forEach((x) => { x.style.display = x.dataset.m === mode ? "" : "none"; });
          q("pccsCustom").style.display = v.shopPaper === "custom" ? "" : "none";
          q("pccsMarksL").textContent = mode === "home" || mode === "stock" ? "cut marks" : "crop marks";
          q("pccsListBox").style.display = v.src === "list" && v.pages !== "each" ? "" : "none";
          q("pccsSrc").disabled = v.pages === "each";
          paintMap(d, st, v); v.map = st.map ? st.map.slice() : [];
          try {
            if (v.err) throw new Error(v.err);
            const P = plan(v, st);
            q("pccsPrev").innerHTML = preview(P.L, v, P.sheets[0], P.labels);
            const L = P.L, total = P.sheets.reduce((a, s) => a + s.filter((x) => x != null).length, 0), lines = [];
            if (mode === "single") lines.push(`One card a page: ${L.paperLabel} (the card ${r1(L.cw)} × ${r1(L.ch)} mm + ${L.bleed} mm bleed${v.marks ? " + room for the crop marks" : ""}), trim and bleed boxes set.`, `${P.labels.length} card${P.labels.length > 1 ? "s" : ""}${P.twoSided ? ", front + back pages" : ""}.`);
            else {
              lines.push(`${L.n} cards (${L.cols} × ${L.rows}) on ${L.mode === "stock" ? L.paperLabel : L.paperLabel.split(" (")[0]} ${L.orient}.`);
              if (P.sheets.length > 1 || total !== L.n) lines.push(`${total} card${total === 1 ? "" : "s"} on ${P.sheets.length} sheet${P.sheets.length > 1 ? "s" : ""}${P.labels.length > 1 ? ` (${P.labels.length} different)` : ""}.`);
              if (L.mode === "stock" && L.fit && !L.fit.exact) lines.push(`Your card is ${r1(st.card.w)} × ${r1(st.card.h)} mm, the stock's ${r1(L.cw)} × ${r1(L.ch)} mm - it is fitted inside each one.`);
              if (L.mode === "shop") lines.push(`Every card gets ${L.bleed} mm bleed from its own edges, ${r1(L.gap)} mm apart; crop marks in registration colour.`);
              lines.push('Print at actual size (100 %, not "fit to page").');
              if (P.twoSided) lines.push("For the backs print the next page on the back of the sheet, flipped on the long edge (or long-edge duplex).");
              if (L.mode === "home" || L.mode === "shop") lines.push(L.mode === "shop" ? "The print shop cuts on the crop marks." : "Cut along the marks with a ruler or a guillotine.");
              if (L.mode === "stock") lines.push("Print one sheet on plain paper first and hold it over the stock to check it lines up.");
            }
            if (P.note) lines.push(P.note);
            q("pccsInfo").innerHTML = lines.map((x) => `<div>${esc(x)}</div>`).join("");
            d.querySelector(".ok").disabled = false;
          } catch (e) { q("pccsPrev").innerHTML = ""; q("pccsInfo").textContent = e.message; d.querySelector(".ok").disabled = true; }
        };
        st.paint = paint;
        d.addEventListener("change", (e) => { if (e.target.id === "pccsStock") fillStock(stocks.find((s) => s.id === e.target.value)); paint(); });
        d.addEventListener("input", (e) => { if (e.target.id === "pccsRows" || (e.target.type === "number")) { clearTimeout(st.t); st.t = setTimeout(paint, 250); } });
        q("pccsStSave").onclick = async (e) => {
          e.preventDefault(); const v = read(d, st), s = Object.assign({ name: q("pccsStName").value.trim() }, v.stock);
          if (!s.name) { q("pccsStName").focus(); return say("📇 give the stock a name first"); }
          try { const r = await win.fetch("/api/cardstocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stock: s }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
            await loadStocks(); paintStocks(j.id); say(`📇 kept the stock "${j.name}"`); paint(); } catch (er) { say("📇 " + er.message); }
        };
        q("pccsStDel").onclick = async (e) => {
          e.preventDefault(); const id = q("pccsStock").value; if (!id) return say("📇 pick one of your stocks to delete");
          try { const r = await win.fetch("/api/cardstocks/" + encodeURIComponent(id), { method: "DELETE" }); if (!r.ok) throw new Error((await r.json()).error); await loadStocks(); paintStocks(""); say("📇 stock deleted"); paint(); } catch (er) { say("📇 " + er.message); }
        };
        paint();
        Promise.all([loadStocks(), sideTexts().catch(() => []), E.bizInfo && E.bizInfo.load ? E.bizInfo.load().catch(() => null) : null]).then(([, texts, prof]) => {
          st.lines = CL() ? CL().cardLines(texts) : [];
          const j = prof || {}; st.profile = (j.profiles || []).find((x) => x.id === j.last) || null;
          const sel = stock0; paintStocks(stocks.some((s) => s.id === sel) ? sel : ""); if (q("pccsStock").value) fillStock(stocks.find((s) => s.id === sel));
          st.headers = ""; paint();   // the card's lines + business details known now: guess again (hand choices kept)
        });
      } });
    }
    /** the column -> words table under the list (redrawn when the columns change; a change by hand kept) */
    function paintMap(d, st, v) {
      const box = d.querySelector("#pccsMap"); if (!box || v.src !== "list" || !CL()) { if (box) box.innerHTML = ""; return; }
      const P = CL().parseRows(v.rows), key = P.headers.join("\u0001");
      if (key !== st.headers) {   // new columns: guessed again - a column you set by hand keeps your choice (by its name)
        st.headers = key; st.hand = st.hand || {};
        st.map = CL().guessMap(P.headers, st.lines, st.profile).map((g0, i) => (Object.prototype.hasOwnProperty.call(st.hand, P.headers[i]) ? st.hand[P.headers[i]] : g0));
      }
      if (!P.headers.length) { box.innerHTML = `<div class="pccs-dim">${esc("Paste the list above - each column then replaces some words on the card.")}</div>`; return; }
      const choices = [["", "— not used —"], ["#copies", "how many cards (copies)"]].concat(st.lines.map((l) => [l, `replaces "${l.length > 38 ? l.slice(0, 36) + "…" : l}"`]));
      box.innerHTML = `<div class="pccs-dim">${esc(`${P.rows.length} row${P.rows.length === 1 ? "" : "s"}${P.cut ? ` (${P.cut} more left out)` : ""}. Each column replaces these words on the card (front and back):`)}</div>`
        + P.headers.map((h, i) => { const cur = st.map[i] || "", list = choices.some(([c]) => c === cur) ? choices : choices.concat([[cur, `replaces "${cur}"`]]);
          return `<div class="kxrow"><b style="min-width:110px">${esc(h)}</b><select data-col="${i}">${opts(list, cur)}</select><span class="pccs-dim">${esc(P.rows[0] ? (P.rows[0][i] || "") : "")}</span></div>`; }).join("");
      box.querySelectorAll("select[data-col]").forEach((s) => { s.onchange = (e) => { e.stopPropagation(); st.map[+s.dataset.col] = s.value; (st.hand = st.hand || {})[P.headers[+s.dataset.col]] = s.value; st.paint(); }; });
    }
    function read(d, st) {
      const q = (id) => d.querySelector("#" + id), val = (id, dflt) => (q(id) ? q(id).value : dflt), chk = (id) => !!(q(id) && q(id).checked);
      const v = { mode: val("pccsMode", "home"), paper: val("pccsPaper", "a4"), gap: +val("pccsGap", 0), bleed: +val("pccsBleed", 0), marks: chk("pccsMarks"), backs: chk("pccsBacks"),
        shopPaper: val("pccsShopPaper", "sra3"), pw: +val("pccsPw", 320), ph: +val("pccsPh", 450), shopBleed: +val("pccsShopBleed", 3), shopGap: +val("pccsShopGap", 0), margin: +val("pccsMargin", 10),
        reg: chk("pccsReg"), slug: chk("pccsSlug"), singleBleed: +val("pccsSingleBleed", 3), src: val("pccsSrc", "one"), each: val("pccsEach", "1"), pages: val("pccsPages", "fb"), rows: val("pccsRows", ""), stockId: val("pccsStock", "") };
      const n = (id) => +val(id, 0);
      v.stock = { paper: { w: n("pccsStPw"), h: n("pccsStPh") }, cols: n("pccsStCols"), rows: n("pccsStRows"), cw: n("pccsStCw"), ch: n("pccsStCh"), top: n("pccsStTop"), left: n("pccsStLeft"), hpitch: n("pccsStHp"), vpitch: n("pccsStVp"), name: val("pccsStName", "") };
      if (!v.gap) v.bleed = 0;   // touching cards: a bleed would run into the next card
      if (v.src === "list" && v.pages !== "each" && !CL()) v.err = "the list part (pccardlist.js) did not load";
      const S0 = store.set;
      [["mode", v.mode], ["paper", v.paper], ["gap", v.gap], ["marks", v.marks ? "1" : "0"], ["bleed", v.bleed], ["shopPaper", v.shopPaper], ["pw", v.pw], ["ph", v.ph], ["shopBleed", v.shopBleed], ["shopGap", v.shopGap],
        ["margin", v.margin], ["reg", v.reg ? "1" : "0"], ["slug", v.slug ? "1" : "0"], ["singleBleed", v.singleBleed], ["src", v.src], ["each", v.each], ["pagesMode", v.pages], ["rows", String(v.rows).slice(0, 20000)], ["stock", v.stockId]].forEach(([k, x]) => S0(k, String(x)));
      v.map = st && st.map ? st.map.slice() : [];
      return v;
    }
    /** the layout, the different cards and their sheets for the box's values: {L, vars, sheets, labels, twoSided, note} */
    function plan(v, st) {
      const card = st.card;
      const L = v.mode === "stock" ? stockLayout(v.stock, card)
        : v.mode === "shop" ? sheetLayout(card.w, card.h, { mode: "shop", paper: v.shopPaper, pw: v.pw, ph: v.ph, bleed: v.shopBleed, gap: v.shopGap, margin: v.margin })
        : v.mode === "single" ? singleLayout(card.w, card.h, { bleed: v.singleBleed, marks: v.marks })
        : sheetLayout(card.w, card.h, { paper: v.paper, gap: v.gap, bleed: v.bleed });
      const each = v.each === "sheet" || !v.each ? L.n : Math.max(1, +v.each || 1);   // "a whole sheet" (the default): one card fills it
      let vars, note = "";
      if (v.pages === "each" && st.n > 1) vars = Array.from({ length: st.n }, (_, i) => ({ label: `page ${i + 1}`, page: i, pairs: [], copies: each }));
      else if (v.src === "list") {
        const P = CL().parseRows(v.rows);
        if (!P.rows.length) throw new Error("paste the list (the first row the column names, then a row per card)");
        vars = CL().variants(P, v.map, each);
        if (!vars.some((x) => x.pairs.length)) note = "No column replaces any words yet - pick what each column replaces above.";
        if (v.each === "sheet" && v.map.indexOf("#copies") < 0) vars.forEach((x) => { x.copies = L.n; });
      } else vars = [{ label: "card", pairs: [], copies: each }];
      if (v.mode === "single") vars.forEach((x) => { x.qty = x.copies > 1 ? x.copies : 0; x.copies = 1; });   // the print shop prints the quantity
      const sheets = paginate(vars, L.n);
      if (sheets.length > 200) throw new Error(`that is ${sheets.length} sheets - at most 200 in one PDF`);
      const twoSided = v.backs && st.n > 1 && v.pages !== "each";
      return { L, vars, sheets, labels: vars.map((x) => x.label), twoSided, note };
    }
    async function make(card, v) {
      say("📇 drawing the cards…");
      const n = E.pages && E.pages.count ? E.pages.count() : 1, st = { card, n, map: v.map };
      const P = plan(v, st), all = await sides();
      let faces;
      if (v.pages === "each" && n > 1) faces = P.vars.map((x) => [all[x.page].canvas]);
      else if (P.vars.some((x) => x.pairs.length)) faces = await renderVariants(P.vars, P.twoSided ? 2 : 1);
      else faces = P.vars.map(() => (P.twoSided ? [all[0].canvas, all[1] && all[1].canvas] : [all[0].canvas]));
      const base = (S.name || "Business card").replace(/\.[a-z0-9]+$/i, "");
      const bytes = await buildPdf(P.L, P.sheets, faces, { marks: v.marks, reg: v.reg, slug: v.slug, backs: P.twoSided, title: base + (P.L.mode === "single" ? "" : " - card sheet"), labels: P.labels, qty: P.vars.map((x) => x.qty || x.copies) });
      const kind = { home: "card sheet", stock: "card stock", shop: "print shop sheet", single: "print shop cards" }[P.L.mode];
      const stem = String(S.bgiName || S.name || "business-card").replace(/\.[a-z0-9]+$/i, "").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60) + ` - ${kind}.pdf`;
      let saved = null;
      try { const r = await win.fetch("/api/pdf/save?name=" + encodeURIComponent(stem), { method: "POST", headers: { "Content-Type": "application/pdf" }, body: bytes }); const j = await r.json(); if (r.ok) saved = j; } catch (e) { /* downloaded anyway */ }
      const a = doc.createElement("a"); a.href = win.URL.createObjectURL(new win.Blob([bytes], { type: "application/pdf" })); a.download = saved ? saved.name : stem;
      doc.body.appendChild(a); a.click(); setTimeout(() => { win.URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      const total = P.sheets.reduce((s, x) => s + x.filter((y) => y != null).length, 0);
      E.cardSheet.last = { layout: P.L, size: bytes.length, sides: P.twoSided ? 2 : 1, sheets: P.sheets.length, cards: total, different: P.vars.length, pages: P.sheets.length * (P.twoSided ? 2 : 1), name: saved ? saved.name : stem };
      const where = P.L.mode === "single" ? `${P.vars.length} card${P.vars.length > 1 ? "s" : ""} a page each with ${P.L.bleed} mm bleed${v.marks ? " and crop marks" : ""}`
        : `${total} cards on ${P.sheets.length} sheet${P.sheets.length > 1 ? "s" : ""} of ${P.L.mode === "stock" ? P.L.paperLabel : P.L.paperLabel.split(" (")[0]}${P.vars.length > 1 ? ` (${P.vars.length} different)` : ""}`;
      say(`📇 ${where}${P.twoSided ? ", fronts + mirrored backs" : ""} - ${saved ? saved.name + " in the project's pdf folder, " : ""}downloaded. Print at actual size (100 %).`);
      return E.cardSheet.last;
    }
    const css = doc.createElement("style");
    css.textContent = ".pccs{display:flex;flex-direction:column;gap:6px;min-width:0}.pccs .kxrow{flex-wrap:wrap;min-width:0;gap:6px}.pccs .kxrow select{flex:0 1 auto;width:auto;max-width:100%;min-width:0}"
      + ".pccs-grid{gap:6px 10px}.pccs-n{display:inline-flex;flex-direction:column;font-size:11px;color:var(--pc-dim)}.pccs-dim{color:var(--pc-dim);font-size:11px}"
      + ".pccs-list textarea{width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;resize:vertical}.pccs-list select{max-width:330px}";
    doc.head.appendChild(css);
    E.ui.addCmd("file.cardsheet", "📇 Business Card Sheet…", "", () => open(), { enabled: () => !!S.w }, ["File", "file.printpreview"]);
    E.cardSheet = { open, make, sides, buildPdf, renderVariants, bleedCanvas, plan, loadStocks, last: null };
  }
  const PCCardSheet = Object.assign({ install }, pure);
  if (root && root.document) root.PCCardSheet = PCCardSheet;
})(typeof window !== "undefined" ? window : globalThis);
