/* pcpdf.js — PDF FILES IN THE IMAGE EDITOR: OPEN, EDIT, SAVE (2.424.0), window.PCPdf.
 *
 * Tim (verbatim): "add a pdf import/edit/save feature". Read in the page by pdf.js (Mozilla, Apache-2.0 -
 * static/vendor/pdf.min.js + pdf.worker.min.js), written by pdf-lib (MIT - static/vendor/pdf-lib.min.js), both loaded the
 * first time they are needed, never from the internet. A saved PDF is kept in the project's pdf folder (lib/pdfStore.js,
 * routes/pdf.js) and offered as a download.
 *
 *   OPEN       File ▸ Open PDF… (or drop a .pdf on the editor), File ▸ Open PDF from Project…: the PAGES panel (a strip
 *              of the pages; ✎ = changed); a click opens that page as a document: its picture WITHOUT its text as the
 *              Background (pdf.js draws the page once more with its text-drawing calls switched off - the text taken out
 *              of the page itself, not painted over; where that cannot be done the text boxes are filled with their
 *              paper's colour) and every LINE of its text as an
 *              editable type layer at its place - the font (serif / sans / mono, bold, italic), size, colour and width
 *              (tracking) matched. Resolution: 72 - 300 dpi (150).
 *   EDIT       with every tool; each page keeps its own layers and undo while you move between pages.
 *   SAVE       💾 Save PDF: the changed pages REPLACED in the original (the others untouched, still vector) - into the
 *              project file it came from, or as a new file (Save as New PDF…). A changed page = its picture (everything
 *              but the text) + its type layers as REAL PDF text (Helvetica / Times / Courier in the matching weight and
 *              style, its colour, its size, its tracking) - selectable, searchable. Type the standard fonts cannot
 *              write (other alphabets, warped / 3D / path text, layer styles) goes into the picture instead (said).
 *
 *   PAGES      each page keeps its own layers and undo (opening another picture keeps them too - File ▸ PDF Pages
 *              brings the strip back and a click reopens the page as you left it).
 *
 * The page maths is pure (Node: scripts/test-pspdf.js): fontOf, groupLines, inkColor, toPdf, winAnsi, stdName.
 */
(function (root) {
  "use strict";

  /* ================================ pure ================================ */
  /** a PDF font name / family -> ours: {font, weight, italic, std} (std = the standard-14 family to write it back in) */
  function fontOf(name, family) {
    const n = String(name || "").replace(/^[A-Z]{6}\+/, ""), f = String(family || "");
    const all = (n + " " + f).toLowerCase();
    const bold = /bold|black|heavy|semibold|demi/.test(all), italic = /italic|oblique/.test(all);
    let fam = "sans", font = "Arial";
    if (/courier|mono|consol|menlo|code/.test(all)) { fam = "mono"; font = "Courier New"; }
    else if (/times|serif|georgia|garamond|cambria|minion|book|roman|palatino/.test(all) && !/sans/.test(all)) { fam = "serif"; font = /georgia/.test(all) ? "Georgia" : "Times New Roman"; }
    else if (/verdana/.test(all)) font = "Verdana";
    else if (/trebuchet/.test(all)) font = "Trebuchet MS";
    else if (/segoe/.test(all)) font = "Segoe UI";
    else if (/impact/.test(all)) font = "Impact";
    const std = fam === "mono" ? "Courier" : fam === "serif" ? "Times" : "Helvetica";
    return { font, weight: bold ? 700 : 400, italic, fam, std };
  }
  /** pdf.js text items (already in page px: {str, x, y (baseline), size, w, font, angle}) -> lines: neighbours on the same
   *  baseline, the same font and size, close enough, joined (a space where there is a gap) */
  function groupLines(items) {
    const its = (items || []).filter((t) => t && t.str != null && String(t.str).length && t.size > 0).slice()
      .sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.size, b.size) * 0.3 ? a.y - b.y : a.x - b.x));
    const lines = [];
    for (const t of its) {
      const L = lines[lines.length - 1];
      const same = L && Math.abs(L.y - t.y) <= Math.min(L.size, t.size) * 0.3 && Math.abs(L.size - t.size) <= Math.max(L.size, t.size) * 0.15 && L.font === t.font && Math.abs(L.angle - t.angle) < 0.01;
      const gap = same ? t.x - (L.x + L.w) : Infinity;
      if (same && gap > -L.size * 0.5 && gap < L.size * 1.2) {
        const sp = gap > L.size * 0.18 && !/\s$/.test(L.str) && !/^\s/.test(t.str) ? " " : "";
        L.str += sp + t.str; L.w = t.x + t.w - L.x; L.parts.push(t);
      } else lines.push({ str: String(t.str), x: t.x, y: t.y, size: t.size, w: t.w, font: t.font, family: t.family, ascent: t.ascent, angle: t.angle || 0, parts: [t] });
    }
    return lines.map((l) => Object.assign(l, { str: l.str.replace(/\s+$/, "") })).filter((l) => l.str.length);
  }
  /** the ink colour of text in a box of rgba: the pixels farthest from the box's edge colour (its paper) */
  function inkColor(rgba, w, h, b) {
    const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y)), x1 = Math.min(w - 1, Math.ceil(b.x + b.w)), y1 = Math.min(h - 1, Math.ceil(b.y + b.h));
    if (x1 <= x0 || y1 <= y0) return "#000000";
    const edge = [], px = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * w + x) * 4, c = [rgba[i], rgba[i + 1], rgba[i + 2]]; if (y === y0 || y === y1 || x === x0 || x === x1) edge.push(c); else px.push(c); }
    const med = (k) => { const v = edge.map((c) => c[k]).sort((a, b) => a - b); return v[v.length >> 1] || 255; };
    const paper = [med(0), med(1), med(2)];
    const scored = px.map((c) => [Math.hypot(c[0] - paper[0], c[1] - paper[1], c[2] - paper[2]), c]).sort((a, b) => b[0] - a[0]);
    const top = scored.slice(0, Math.max(1, Math.round(scored.length * 0.12)));
    if (!top.length || top[0][0] < 30) return "#000000";
    const avg = [0, 1, 2].map((k) => Math.round(top.reduce((s, t) => s + t[1][k], 0) / top.length));
    return "#" + avg.map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  /** page px -> PDF points for a text layer's baseline: {x, y, size} (y from the bottom) */
  function toPdf(t, scale, pageH, ascent) {
    const a = ascent == null ? 0.8 : ascent;
    return { x: t.x / scale, y: pageH - (t.y + t.size * a) / scale, size: t.size / scale };
  }
  // WinAnsi (the standard fonts' encoding): ASCII + Latin-1 + the CP1252 extras
  const CP1252 = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
  const winAnsi = (s) => [...String(s)].every((ch) => { const c = ch.codePointAt(0); return (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || CP1252.includes(ch) || ch === "\n"; });
  const stdName = (f) => {
    const b = f.weight >= 600, i = !!f.italic;
    if (f.std === "Times") return b && i ? "TimesRomanBoldItalic" : b ? "TimesRomanBold" : i ? "TimesRomanItalic" : "TimesRoman";
    if (f.std === "Courier") return b && i ? "CourierBoldOblique" : b ? "CourierBold" : i ? "CourierOblique" : "Courier";
    return b && i ? "HelveticaBoldOblique" : b ? "HelveticaBold" : i ? "HelveticaOblique" : "Helvetica";
  };
  const pure = { fontOf, groupLines, inkColor, toPdf, winAnsi, stdName };
  if (typeof module !== "undefined" && module.exports) { module.exports = Object.assign({ install: null }, pure); return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, win, kx, $, say, ctx, newCanvas, store } = E;
    if (!E.ui || !E.ui.addCmd) return;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const libs = {};
    function loadScript(src, test) {
      if (test()) return Promise.resolve(test());
      if (libs[src]) return libs[src];
      libs[src] = new Promise((ok, no) => {
        const s = doc.createElement("script"); s.src = src;
        s.onload = () => (test() ? ok(test()) : no(new Error(src + " did not load")));
        s.onerror = () => { libs[src] = null; no(new Error(src + " is missing")); };
        doc.head.appendChild(s);
      });
      return libs[src];
    }
    const pdfjs = () => loadScript("/static/vendor/pdf.min.js", () => win.pdfjsLib).then((L) => { if (L.GlobalWorkerOptions && !L.GlobalWorkerOptions.workerSrc) L.GlobalWorkerOptions.workerSrc = "/static/vendor/pdf.worker.min.js"; return L; });
    const pdflib = () => loadScript("/static/vendor/pdf-lib.min.js", () => win.PDFLib);
    // 2.435.0: fontkit (MIT, static/vendor) lets pdf-lib embed a TrueType / OpenType font - the text's own font
    const fontkitLib = () => loadScript("/static/vendor/fontkit.umd.min.js", () => win.fontkit);

    /* ---------------- the session: one PDF at a time ---------------- */
    let P = null;            // {name, fromProject, bytes, pdf, n, dpi, cur, pages: Map(i -> {doc, undo, redo, scale, w, h, ptH, ptW})}
    const scaleOf = () => (P ? P.dpi / 72 : 150 / 72);
    async function openBuffer(buf, name, fromProject) {
      const L = await pdfjs();
      say(`opening ${name}…`);
      const bytes = new Uint8Array(buf.slice ? buf.slice(0) : buf);
      const pdf = await L.getDocument({ data: bytes.slice(0), isEvalSupported: false, disableFontFace: false }).promise;
      // 2.430.0: with documents (pcdocs.js) the PDF open now stays in its own window / tab - its session goes with it
      if (E.docs) E.docs.park();
      else if (P && P.pdf) { try { P.pdf.destroy(); } catch (e) { /* gone */ } }
      P = { name: String(name || "document.pdf"), fromProject: !!fromProject, bytes, pdf, n: pdf.numPages, dpi: +store.get("pdf.dpi", 150) || 150, cur: -1, pages: new Map(), thumbs: new Map(),
            // 2.488.0: the pages in order - {id, f (P.files index; -1 = a blank page), p (its page in that file), ptW, ptH}; pages / thumbs are kept by id
            files: [{ bytes, pdf, name }], order: Array.from({ length: pdf.numPages }, (_, i) => ({ id: i, f: 0, p: i })), nextId: pdf.numPages };
      showPanel();
      await openPage(0);
      thumbs();
      return { pages: P.n };
    }
    /** the page's picture without its text: pdf.js draws it again on a canvas whose fillText / strokeText do nothing
     *  (the glyphs of every font pdf.js loads as a font face are drawn by those two); where that fails, the full picture
     *  with each line's box filled with its paper's colour */
    async function textless(page, viewport, full, lines) {
      try {
        const c = newCanvas(full.width, full.height), cg = ctx(c);
        cg.fillStyle = "#ffffff"; cg.fillRect(0, 0, c.width, c.height);
        let calls = 0;
        cg.fillText = function () { calls++; }; cg.strokeText = function () { calls++; };
        await page.render({ canvasContext: cg, viewport }).promise;
        delete cg.fillText; delete cg.strokeText;
        if (lines.length && !calls) throw new Error("its text is drawn as shapes");
        return { canvas: c, how: "textless" };
      } catch (e) {
        const c = newCanvas(full.width, full.height), cg = ctx(c); cg.drawImage(full, 0, 0);
        const d = ctx(full).getImageData(0, 0, full.width, full.height).data;
        for (const l of lines) {
          const b = { x: l.x - 2, y: l.y - l.size * (l.ascent || 0.8) - 2, w: l.w + 4, h: l.size * 1.25 + 4 };
          const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y)), x1 = Math.min(full.width - 1, Math.ceil(b.x + b.w)), y1 = Math.min(full.height - 1, Math.ceil(b.y + b.h));
          if (x1 <= x0 || y1 <= y0) continue;
          const ring = []; for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) ring.push((y * full.width + x) * 4);
          const med = (k) => { const v = ring.map((i) => d[i + k]).sort((p, q) => p - q); return v[v.length >> 1] || 255; };
          cg.fillStyle = `rgb(${med(0)},${med(1)},${med(2)})`; cg.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        }
        return { canvas: c, how: "filled (" + e.message + ")" };
      }
    }
    const ent = (i) => (P && P.order ? P.order[i] : { id: i, f: 0, p: i });
    const pgOf = (i) => (P && i >= 0 && i < P.n ? P.pages.get(ent(i).id) : undefined);
    async function render(i) {
      const e = ent(i), scale0 = scaleOf();
      if (e.f < 0) {                                   // 2.488.0: a blank page
        const W = Math.round(e.ptW * scale0), H = Math.round(e.ptH * scale0), full = newCanvas(W, H), fg0 = ctx(full); fg0.fillStyle = "#ffffff"; fg0.fillRect(0, 0, W, H);
        return { full, bg: full, how: "a blank page", lines: [], W, H, scale: scale0, ptW: e.ptW, ptH: e.ptH };
      }
      const L = await pdfjs(), page = await P.files[e.f].pdf.getPage(e.p + 1), scale = scale0, viewport = page.getViewport({ scale });
      const W = Math.round(viewport.width), H = Math.round(viewport.height);
      const full = newCanvas(W, H), fg = ctx(full); fg.fillStyle = "#ffffff"; fg.fillRect(0, 0, W, H);
      await page.render({ canvasContext: fg, viewport }).promise;
      const tc = await page.getTextContent();
      const items = tc.items.filter((t) => t.str != null).map((t) => {
        const m = L.Util.transform(viewport.transform, t.transform), size = Math.hypot(m[2], m[3]), st = tc.styles[t.fontName] || {};
        let real = "";                                   // the font's own name ("ABCDEF+Calibri-Bold") - the styles only say serif / sans
        try { const fo = page.commonObjs.has(t.fontName) && page.commonObjs.get(t.fontName); real = (fo && fo.name) || ""; } catch (e) { real = ""; }
        return { str: t.str, x: m[4], y: m[5], size, w: t.width * scale, font: t.fontName, family: (real ? real + " " : "") + (st.fontFamily || ""), ascent: st.ascent || 0.8, angle: Math.atan2(m[1], m[0]) };
      });
      const lines = groupLines(items);
      const bg = await textless(page, viewport, full, lines);
      const ptView = page.getViewport({ scale: 1 });
      return { full, bg: bg.canvas, how: bg.how, lines, W, H, scale, ptW: ptView.width, ptH: ptView.height };
    }
    /** the page as a document: Background (no text) + a type layer per line */
    async function openPage(i) {
      if (!P || i < 0 || i >= P.n) return;
      stash();
      const kept = pgOf(i);
      if (kept && kept.doc) {
        opening = true;
        try { E.openDoc(kept.doc.w, kept.doc.h, pageName(i), null, { inPlace: P.cur >= 0 }); } finally { opening = false; }   // a fresh state (the views, the selection) for it
        E.putDoc(kept.doc); S.undo = kept.undo; S.redo = kept.redo; S.name = pageName(i); E.snapHistorySource();
        P.cur = i; S.userView = false; E.fitView(); E.refresh(); E.renderLayersPanel(); if (E.ui.history) E.ui.history(); paintPanel();
        return;
      }
      say(`page ${i + 1} of ${P.n} - reading its text…`);
      const r = await render(i);
      opening = true;
      try { E.openDoc(r.W, r.H, pageName(i), (g) => g.drawImage(r.bg, 0, 0), { inPlace: P.cur >= 0 }); } finally { opening = false; }
      const fd = ctx(r.full).getImageData(0, 0, r.W, r.H).data;
      let rotated = 0;
      for (const l of r.lines) {
        if (Math.abs(l.angle) > 0.02) {                         // turned text stays in the picture (copied back from the full page)
          const b = { x: l.x - l.size * 0.2, y: l.y - l.size * 1.4, w: l.w + l.size * 0.6, h: l.size * 2 };
          const bgL = S.layers[0], g = ctx(bgL.canvas); g.save(); g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip(); g.drawImage(r.full, 0, 0); g.restore(); bgL.ver++; rotated++;
          continue;
        }
        const f = fontOf(l.family, ""), T0 = E.makeLayer("T " + l.str.slice(0, 28), r.W, r.H, "text");
        const tt = { font: f.font, weight: f.weight, italic: f.italic, size: Math.max(4, l.size) };
        T0.text = Object.assign({}, D.TEXT_DEFAULT, { str: l.str, font: f.font, weight: f.weight, italic: f.italic, size: tt.size, x: l.x, y: l.y - baseOff(tt),
          color: inkColor(fd, r.W, r.H, { x: l.x, y: l.y - l.size * 0.85, w: l.w, h: l.size * 1.1 }), align: "left", leading: 1.2, tracking: 0 });
        // the width matched: tracking so our font is as wide as the PDF's line
        const g = ctx(T0.canvas); g.font = D.fontCss(T0.text);
        const mw = g.measureText(l.str).width, n = [...l.str].length;
        if (n > 1 && mw > 0) T0.text.tracking = Math.max(-150, Math.min(300, Math.round((l.w - mw) / (n - 1) / T0.text.size * 1000)));
        T0.pdf = { std: f.std, page: i };
        D.rasterize(T0);
        S.layers.push(T0);
      }
      S.active = S.layers.length - 1; S.undo = []; S.redo = [];
      P.cur = i; P.pages.set(ent(i).id, { doc: null, undo: [], redo: [], scale: r.scale, W: r.W, H: r.H, ptW: r.ptW, ptH: r.ptH, edited: false, how: r.how, fresh: true });
      E.snapHistorySource(); E.refresh(); E.renderLayersPanel(); if (E.ui.history) E.ui.history(); paintPanel();
      say(`page ${i + 1} of ${P.n}: ${r.lines.length - rotated} line(s) of text as type layers${rotated ? `, ${rotated} turned line(s) left in the picture` : ""} · picture ${r.how === "svg" ? "without its text" : r.how}`);
    }
    const pageName = (i) => `${P.name.replace(/\.pdf$/i, "")} — page ${i + 1}.png`;
    /** the open document IS the PDF's page P.cur (not a picture opened since) */
    const onPage = () => !!(P && P.cur >= 0 && S.w && S.name === pageName(P.cur));
    /** how far below a type layer's top (textBaseline "top", as pcdoc draws it) its baseline is, in px */
    function baseOff(t) {
      const g = ctx(newCanvas(4, 4)); g.font = D.fontCss(t);
      g.textBaseline = "top"; const a = g.measureText("Hg"); g.textBaseline = "alphabetic"; const b = g.measureText("Hg");
      const off = (b.fontBoundingBoxAscent != null && a.fontBoundingBoxAscent != null) ? b.fontBoundingBoxAscent - a.fontBoundingBoxAscent : NaN;
      return Number.isFinite(off) && off > 0 ? off : t.size * 0.8;
    }
    /** keep the open page's layers and undo before another page (or another picture) opens */
    let opening = false;
    function stash() {
      if (!onPage()) return;
      const pg = pgOf(P.cur); if (!pg) return;
      pg.doc = E.snapDoc(); pg.undo = S.undo; pg.redo = S.redo;
      pg.edited = pg.edited || S.undo.length > 0;
      pg.fresh = false;
    }
    const isEdited = (i) => { const pg = pgOf(i); if (!pg) return false; return i === P.cur && onPage() ? pg.edited || S.undo.length > 0 : pg.edited; };
    // another picture opened over a page: the page is kept as it was (File ▸ PDF Pages + a click brings it back)
    const prevBefore = E.beforeOpen;
    E.beforeOpen = (name) => { if (prevBefore) prevBefore(name); if (!opening && onPage()) { stash(); P.cur = -1; paintPanel(); } };

    /* ---------------- save ---------------- */
    /** a text layer the standard fonts can write as real text? */
    // anyText (2.435.0, Embed fonts): any alphabet - the embedded font decides; else only what the standard fonts can write
    const writable = (L, layers, anyText) => L.type === "text" && L.visible !== false && D.shown(layers, L) && L.text && !(root.PCText && root.PCText.wants(L.text)) && !(root.PCType && root.PCType.wants(L.text)) && !L.text.fx && !D.hasStyles(L) && !L.mask && !L.vmask && (anyText || winAnsi(L.text.str)) && (L.opacity == null || L.opacity >= 0.99) && (L.blend || "normal") === "normal";
    /** opts.embed (2.435.0): each text line in its OWN font, embedded (only the letters used) - the file from this
     *  computer (GET /api/fonts/file, lib/fontFiles.js); a font that is not here, or lacks a letter, = the standard font
     *  (when it can write the line) or the picture, as before */
    async function toBytes(opts) {
      const o = opts || {}, PL = await pdflib();
      stash();
      const out = await PL.PDFDocument.load(P.bytes, { ignoreEncryption: true });
      // 2.488.0: pages added, taken out or moved - a new document, the untouched pages copied over (still vector)
      const moved = P.order && (P.order.length !== P.files[0].pdf.numPages || P.order.some((e, i) => e.f !== 0 || e.p !== i));
      let out2 = null, srcDocs = null;
      if (moved) {
        out2 = await PL.PDFDocument.create(); srcDocs = [];
        for (const fl of P.files) srcDocs.push(fl === P.files[0] ? out : await PL.PDFDocument.load(fl.bytes, { ignoreEncryption: true }));
        try { const t = out.getTitle && out.getTitle(); if (t) out2.setTitle(t); } catch (e) { /* no title */ }
      }
      const target = moved ? out2 : out;
      const fonts = {}, custom = {};
      const font = async (name) => (fonts[name] = fonts[name] || await target.embedFont(PL.StandardFonts[name]));
      const notes = { pages: 0, real: 0, raster: 0, embedded: 0, fonts: [] };
      let fk = null;
      if (o.embed) { try { fk = await fontkitLib(); target.registerFontkit(fk); } catch (e) { fk = null; notes.embedError = e.message; } }
      const customFont = async (t) => {
        const fam = String(t.font || "").split(",")[0].replace(/["']/g, "").trim(), b = (t.weight || 400) >= 600, it = !!t.italic, key = fam + "|" + b + "|" + it;
        if (key in custom) return custom[key];
        custom[key] = null;
        try {
          const r = await win.fetch(`/api/fonts/file?family=${encodeURIComponent(fam)}&bold=${b ? 1 : 0}&italic=${it ? 1 : 0}`);
          if (r.ok) { custom[key] = await target.embedFont(new Uint8Array(await r.arrayBuffer()), { subset: true }); notes.fonts.push(decodeURIComponent(r.headers.get("X-Font-File") || fam)); }
        } catch (e) { custom[key] = null; }
        return custom[key];
      };
      /** the embedded font has every letter of the text */
      const covers = (pf, str) => { const F = pf && pf.embedder && pf.embedder.font; if (!F || typeof F.hasGlyphForCodePoint !== "function") return true; return [...String(str)].every((ch) => /\s/.test(ch) || F.hasGlyphForCodePoint(ch.codePointAt(0))); };
      for (let i = 0; i < P.n; i++) {
        if (!isEdited(i)) {
          if (!moved) continue;
          const e = ent(i);
          if (e.f < 0) target.addPage([e.ptW, e.ptH]);
          else { const [cp] = await target.copyPages(srcDocs[e.f], [e.p]); target.addPage(cp); }
          continue;
        }
        const pg = pgOf(i);
        // the page's layers: the open one's as they are; a stashed one's through its snapshot (copies, nothing shared)
        // (a kept page's layer objects are its own - nothing touches them while another page is open)
        const layers = i === P.cur && onPage() ? S.layers : pg.doc.layers.map((x) => x.snap.L);
        const W = pg.W, H = pg.H, text = layers.filter((L) => L.type === "text" && L.visible !== false && L.text && D.shown(layers, L));
        const plan = new Map(), real = [];
        for (const L of text.filter((x) => writable(x, layers, !!fk))) {
          if (fk) { const cf = await customFont(L.text); if (cf && covers(cf, L.text.str)) { plan.set(L, cf); real.push(L); continue; } }
          if (winAnsi(L.text.str)) { plan.set(L, null); real.push(L); }
        }
        // the picture: every visible layer but the real-text ones
        const hidden = real.map((L) => [L, L.visible]); real.forEach((L) => { L.visible = false; });
        const pic = D.render({ w: W, h: H, layers }, E.docEnv({ srcFor: (x) => x.canvas, maskSrc: null, skipControl: true }));
        hidden.forEach(([L, v]) => { L.visible = v; });
        const flat = newCanvas(W, H), fg = ctx(flat); fg.fillStyle = "#ffffff"; fg.fillRect(0, 0, W, H); fg.drawImage(pic, 0, 0);
        const png = await new Promise((ok) => flat.toBlob((b) => b.arrayBuffer().then((ab) => ok(new Uint8Array(ab))), "image/png"));
        const im = await target.embedPng(png);
        let page;
        if (moved) page = target.addPage([pg.ptW, pg.ptH]);
        else { out.removePage(i); page = out.insertPage(i, [pg.ptW, pg.ptH]); }
        page.drawImage(im, { x: 0, y: 0, width: pg.ptW, height: pg.ptH });
        const k = pg.scale;
        for (const L of real) {
          const t = L.text, f = fontOf(t.font + (t.weight >= 600 ? " bold" : "") + (t.italic ? " italic" : ""), ""), fn = plan.get(L) || await font(stdName(f)), c = t.color || "#000000";
          if (plan.get(L)) notes.embedded++;
          const rgb = PL.rgb(parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255);
          const size = t.size / k, lh = (t.leading || 1.2) * t.size, asc = baseOff(t) / t.size;
          String(t.str).split("\n").forEach((line, li) => {
            const p = toPdf({ x: t.x, y: t.y + li * lh, size: t.size }, k, pg.ptH, asc);
            let x = p.x; const wd = fn.widthOfTextAtSize(line, size) + (t.tracking || 0) / 1000 * size * Math.max(0, [...line].length - 1);
            if (t.align === "center") x -= wd / 2; else if (t.align === "right") x -= wd;
            if (t.tracking) page.pushOperators(PL.setCharacterSpacing((t.tracking / 1000) * size));
            page.drawText(line, { x, y: p.y, size, font: fn, color: rgb });
            if (t.tracking) page.pushOperators(PL.setCharacterSpacing(0));
          });
        }
        notes.pages++; notes.real += real.length; notes.raster += text.length - real.length;
      }
      if (moved) notes.structure = P.n;
      const bytes = await target.save();
      return { bytes, notes };
    }
    async function save(name, download, opts) {
      if (!P) return say("no PDF open");
      try {
        const { bytes, notes } = await toBytes(opts);
        const nm = String(name || P.name).replace(/\.pdf$/i, "") + ".pdf";
        const r = await win.fetch("/api/pdf/save?name=" + encodeURIComponent(nm), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: bytes });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || "the save was refused");
        if (download) { const a = doc.createElement("a"); a.href = win.URL.createObjectURL(new win.Blob([bytes], { type: "application/pdf" })); a.download = j.name; doc.body.appendChild(a); a.click(); setTimeout(() => { win.URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
        say(`saved ${j.name} (${Math.round(j.size / 1024)} KB): ${notes.pages} changed page(s) replaced, ${notes.real} line(s) of real text` + (notes.embedded ? ` (${notes.embedded} in their own embedded font${notes.fonts.length ? ": " + notes.fonts.join(", ") : ""})` : "")
          + (notes.raster ? `, ${notes.raster} type layer(s) ${opts && opts.embed ? "whose font is not on this computer (or lacks a letter)" : "the standard fonts cannot write"} went into the picture` : "") + (notes.embedError ? ` · fonts not embedded: ${notes.embedError}` : "") + (download ? " · downloaded" : ""));
        P.lastSaved = { name: j.name, bytes };
        return Object.assign({}, j, notes);
      } catch (e) { say("Save PDF failed: " + e.message); return null; }
    }

    /* ---------------- the Pages panel ---------------- */
    let panel = null;
    /* 2.430.0: the PDF session belongs to its document - pcdocs.js takes it away with a parked document and gives it
       back when that document is active again (the Pages panel follows) */
    E.pdfSession = {
      get: () => P,
      set(p) { P = p || null; if (P) showPanel(); else if (panel) panel.style.display = "none"; },
      drop(p) { if (p && p.pdf && p !== P) { for (const fl of p.files || [{ pdf: p.pdf }]) { try { fl.pdf.destroy(); } catch (e) { /* gone */ } } } },
    };
    function showPanel() {
      if (!panel) {
        panel = doc.createElement("div"); panel.className = "pdfpanel"; panel.id = "pcPdfPanel";
        const st = doc.getElementById("pcpdfCss") || (() => { const s = doc.createElement("style"); s.id = "pcpdfCss"; s.textContent = ".kx .pdfpanel{position:absolute;left:46px;top:70px;bottom:28px;width:150px;z-index:30;display:flex;flex-direction:column;background:var(--pc-panel);border:1px solid var(--pc-line);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.35)}"
          + ".kx .pdfpanel .pdh{display:flex;gap:4px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--pc-line);font-size:11px}.kx .pdfpanel .pdh b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
          + ".kx .pdfpanel .pdl{flex:1;overflow:auto;padding:6px;display:flex;flex-direction:column;gap:6px}.kx .pdfpanel .pdp{position:relative;cursor:pointer;border:2px solid transparent;border-radius:3px;background:#fff;min-height:40px}"
          + ".kx .pdfpanel .pdp.on{border-color:var(--pc-accent)}.kx .pdfpanel .pdp canvas{width:100%;display:block}.kx .pdfpanel .pdp span{position:absolute;left:3px;bottom:2px;font-size:10px;color:#222;background:rgba(255,255,255,.8);padding:0 3px;border-radius:2px}"
          + ".kx .pdfpanel .pdp i{position:absolute;right:3px;top:2px;font-style:normal;color:var(--pc-accent);font-size:12px}.kx .pdfpanel .pdb{display:flex;flex-wrap:wrap;gap:4px;padding:6px;border-top:1px solid var(--pc-line)}"; doc.head.appendChild(s); return s; })();
        void st;
        kx.appendChild(panel);
      }
      panel.style.display = "";
      paintPanel();
    }
    function paintPanel() {
      if (!panel || !P) return;
      panel.innerHTML = `<div class="pdh"><b title="${esc(P.name)}">📄 ${esc(P.name)}</b><span>${P.n} p.</span><button class="ghost" id="pdfHide" title="Hide the pages (File ▸ PDF Pages shows them again)">✕</button></div>
        <div class="pdl" id="pdfList">${Array.from({ length: P.n }, (_, i) => `<div class="pdp${i === P.cur ? " on" : ""}" data-pg="${i}" draggable="true" title="Click: open · drag: move"><canvas width="1" height="1"></canvas><span>${i + 1}</span>${isEdited(i) ? "<i>✎</i>" : ""}</div>`).join("")}</div>
        <div class="pdb pdops"><button class="ghost" id="pdfAdd" title="A blank page after this one">＋ Page</button><button class="ghost" id="pdfIns" title="The pages of another PDF, after this one">⤓ PDF…</button><button class="ghost" id="pdfUp" title="Move this page up">▲</button><button class="ghost" id="pdfDown" title="Move this page down">▼</button><button class="ghost" id="pdfDel" title="Take this page out">🗑</button></div>
        <div class="pdb"><button class="ghost" id="pdfSave" title="The changed pages replaced in the original (the project's copy) - and downloaded">💾 Save PDF</button><button class="ghost" id="pdfSaveAs" title="As a new file">Save as New…</button>
          <label title="How sharp a page opens (dots per inch)" style="font-size:11px">dpi <select id="pdfDpi">${[72, 100, 150, 200, 300].map((v) => `<option${v === P.dpi ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>`;
      panel.querySelectorAll("[data-pg]").forEach((d) => {
        d.ondragstart = (e) => { e.dataTransfer.setData("text/x-bg-pdfpage", d.dataset.pg); e.dataTransfer.effectAllowed = "move"; };
        d.ondragover = (e) => { if (Array.from(e.dataTransfer.types || []).includes("text/x-bg-pdfpage")) { e.preventDefault(); d.style.outline = "2px dashed var(--pc-accent)"; } };
        d.ondragleave = () => { d.style.outline = ""; };
        d.ondrop = (e) => { const from = +e.dataTransfer.getData("text/x-bg-pdfpage"); d.style.outline = ""; e.preventDefault(); if (Number.isFinite(from)) movePage(from, +d.dataset.pg); };
      });
      panel.querySelector("#pdfAdd").onclick = () => addBlank();
      panel.querySelector("#pdfIns").onclick = () => insertPdf();
      panel.querySelector("#pdfUp").onclick = () => { if (P.cur > 0) movePage(P.cur, P.cur - 1); };
      panel.querySelector("#pdfDown").onclick = () => { if (P.cur >= 0 && P.cur < P.n - 1) movePage(P.cur, P.cur + 1); };
      panel.querySelector("#pdfDel").onclick = () => deletePage(P.cur);
      panel.querySelectorAll("[data-pg]").forEach((d) => { d.onclick = () => openPage(+d.dataset.pg); const t = P.thumbs.get(ent(+d.dataset.pg).id); if (t) { const c = d.querySelector("canvas"); c.width = t.width; c.height = t.height; ctx(c).drawImage(t, 0, 0); } });
      panel.querySelector("#pdfHide").onclick = () => { panel.style.display = "none"; };
      panel.querySelector("#pdfSave").onclick = () => saveDialog(false);      // 2.435.0: the Save dialog (Embed fonts)
      panel.querySelector("#pdfSaveAs").onclick = () => saveDialog(true);
      panel.querySelector("#pdfDpi").onchange = (e) => { P.dpi = +e.target.value; store.set("pdf.dpi", P.dpi); say(`pages not opened yet will open at ${P.dpi} dpi`); };
    }
    async function thumbs() {
      if (!P) return; const L = await pdfjs(), me = P;
      for (const e of P.order.slice()) {
        if (P !== me) return; if (P.thumbs.has(e.id)) continue;
        let c;
        if (e.f < 0) { c = newCanvas(130, Math.max(1, Math.round(130 * e.ptH / e.ptW))); const g = ctx(c); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
        else {
          const page = await P.files[e.f].pdf.getPage(e.p + 1), vp0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 130 / vp0.width });
          if (!e.ptW) { e.ptW = vp0.width; e.ptH = vp0.height; }
          c = newCanvas(Math.round(vp.width), Math.round(vp.height)); const g = ctx(c); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext: g, viewport: vp }).promise;
        }
        P.thumbs.set(e.id, c);
        const i = P.order.indexOf(e), el = panel && i >= 0 && panel.querySelector(`[data-pg="${i}"] canvas`); if (el) { el.width = c.width; el.height = c.height; ctx(el).drawImage(c, 0, 0); }
      }
      void L;
    }
    /* ---------------- 2.488.0: pages added, taken out, moved ---------------- */
    /** a change to the page order, the open page kept open (its number - and so its document's name - may change) */
    function reorder(fn) {
      const was = onPage(), id = P.cur >= 0 && P.cur < P.n ? ent(P.cur).id : null;
      fn();
      P.n = P.order.length;
      P.cur = id == null ? -1 : P.order.findIndex((e) => e.id === id);
      if (was && P.cur >= 0) { S.name = pageName(P.cur); if (E.docs && E.docs.paint) E.docs.paint(); }
      P.structured = true;
      paintPanel(); thumbs();
    }
    const sizeHere = () => { const pg = pgOf(P.cur), e = P.cur >= 0 ? ent(P.cur) : null; return pg && pg.ptW ? [pg.ptW, pg.ptH] : e && e.ptW ? [e.ptW, e.ptH] : [595.28, 841.89]; };
    function addBlank(at) {
      if (!P) return say("no PDF open");
      const [w, h] = sizeHere(), pos = at == null ? (P.cur >= 0 ? P.cur + 1 : P.n) : at;
      reorder(() => P.order.splice(pos, 0, { id: P.nextId++, f: -1, p: -1, ptW: w, ptH: h }));
      say(`a blank page added as page ${pos + 1} of ${P.n}`);
      return pos;
    }
    async function insertBuffer(buf, name, at) {
      const L = await pdfjs(), bytes = new Uint8Array(buf.slice ? buf.slice(0) : buf);
      const pdf = await L.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
      const f = P.files.push({ bytes, pdf, name }) - 1, pos = at == null ? (P.cur >= 0 ? P.cur + 1 : P.n) : at;
      reorder(() => P.order.splice(pos, 0, ...Array.from({ length: pdf.numPages }, (_, k) => ({ id: P.nextId++, f, p: k }))));
      say(`${pdf.numPages} page(s) of ${name} added after page ${pos}`);
      return pdf.numPages;
    }
    function insertPdf() {
      if (!P) return say("no PDF open");
      const inp = doc.createElement("input"); inp.type = "file"; inp.accept = ".pdf,application/pdf"; inp.style.display = "none"; doc.body.appendChild(inp);
      inp.onchange = async () => { const fl = inp.files && inp.files[0]; inp.remove(); if (!fl) return; try { await insertBuffer(await fl.arrayBuffer(), fl.name); } catch (e) { say(`${fl.name}: could not read it as a PDF - ${e.message}`); } };
      inp.click();
    }
    function movePage(from, to) {
      if (!P || from === to || from < 0 || to < 0 || from >= P.n || to >= P.n) return;
      reorder(() => { const [e] = P.order.splice(from, 1); P.order.splice(to, 0, e); });
      say(`page ${from + 1} moved to ${to + 1}`);
    }
    async function deletePage(i) {
      if (!P) return say("no PDF open");
      if (i < 0 || i >= P.n) return say("open the page to take out (click it in the strip)");
      if (P.n < 2) return say("a PDF needs at least one page");
      if (isEdited(i) && !win.confirm(`Page ${i + 1} has changes. Take it out anyway?`)) return;
      const gone = ent(i);
      if (i === P.cur && onPage()) { const next = i + 1 < P.n ? i + 1 : i - 1; await openPage(next); }
      reorder(() => { P.order.splice(P.order.indexOf(gone), 1); P.pages.delete(gone.id); P.thumbs.delete(gone.id); });
      say(`page ${i + 1} taken out - ${P.n} left`);
    }
    /** 2.435.0 (Tim: "Give user option to embed fonts into pdf in the save dialog"): Save / Save as New - the name (as
     *  new only), Embed fonts (kept: store pdf.embed, on by default), also download */
    function saveDialog(asNew) {
      if (!P) return say("no PDF open");
      const nm = P.name.replace(/\.pdf$/i, "") + (asNew ? " (edited)" : "");
      const emb = store.get("pdf.embed", true) !== false;
      E.ui.dialog(asNew ? "Save as New PDF" : "Save PDF", `<div class="kxrow"><span>Name</span><input type="text" id="pfN" value="${esc(nm)}" style="flex:1" ${asNew ? "" : "readonly"}><span>.pdf</span></div>
        <div class="kxrow"><label title="Each line of text is written in its own font, embedded in the PDF (only the letters it uses) - the font file from this computer (or the install's fonts folder). Any alphabet stays real text. Off: the PDF's standard fonts (Latin letters only; other text goes into the picture)."><input type="checkbox" id="pfEmb" ${emb ? "checked" : ""}> Embed fonts (the text's own fonts, only the letters used)</label></div>
        <div class="kxrow"><label><input type="checkbox" id="pfDl" checked> also download it</label></div>
        <div class="kxrow" style="color:var(--pc-dim)">${asNew ? "A new file in the project's pdf folder." : "Replaces the project's copy of " + esc(P.name) + "."} Changed pages: their picture + their type as real text; the others as they were.</div>`,
      (d) => { const e = d.querySelector("#pfEmb").checked; store.set("pdf.embed", e); save(asNew ? (d.querySelector("#pfN").value.trim() || nm) : P.name, d.querySelector("#pfDl").checked, { embed: e }); }, { okLabel: "💾 Save" });
    }
    const saveAsDialog = () => saveDialog(true);

    /* ---------------- open: file, project, drop ---------------- */
    const input = doc.createElement("input"); input.type = "file"; input.accept = ".pdf,application/pdf"; input.style.display = "none"; input.id = "pcPdfFile";
    input.onchange = async () => { const f = input.files && input.files[0]; input.value = ""; if (f) { try { await openBuffer(await f.arrayBuffer(), f.name, false); } catch (e) { say(`${f.name}: could not open it as a PDF - ${e.message}`); } } };
    kx.appendChild(input);
    async function openFromProject(name) {
      try { const r = await win.fetch("/api/pdf/file/" + encodeURIComponent(name)); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "not found"); return await openBuffer(await r.arrayBuffer(), name, true); }
      catch (e) { say(`${name}: ${e.message}`); return null; }
    }
    async function projectDialog() {
      let files = []; try { files = (await (await win.fetch("/api/pdf/list")).json()).files || []; } catch { files = []; }
      E.ui.dialog("Open PDF from Project", files.length
        ? `<select id="pfList" size="${Math.min(10, Math.max(3, files.length))}" style="width:100%">${files.map((f, i) => `<option value="${esc(f.name)}"${i ? "" : " selected"}>${esc(f.name)} — ${Math.round(f.size / 1024)} KB</option>`).join("")}</select>`
        : `<div style="color:var(--pc-dim)">No PDF in this project yet - File ▸ Open PDF… then 💾 Save PDF keeps one here.</div>`,
      (d) => { const s = d.querySelector("#pfList"); if (s && s.value) openFromProject(s.value); }, { okLabel: "Open" });
    }
    const stage = E.stage;
    if (stage) stage.addEventListener("drop", (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && /\.pdf$/i.test(f.name)) { e.preventDefault(); e.stopImmediatePropagation(); f.arrayBuffer().then((b) => openBuffer(b, f.name, false)).catch((er) => say(f.name + ": " + er.message)); }
    }, true);
    const C = E.ui.addCmd, has = () => !!P;
    C("file.openpdf", "Open PDF…", "", () => input.click(), {}, ["File", "file.openpsdproj"]);
    C("file.openpdfproj", "Open PDF from Project…", "", () => projectDialog(), {}, ["File", "file.openpdf"]);
    C("file.savepdf", "Save PDF…", "", () => saveDialog(false), { enabled: has }, ["File", "file.savepsd"]);
    C("file.savepdfas", "Save as New PDF…", "", saveAsDialog, { enabled: has }, ["File", "file.savepdf"]);
    C("file.pdfpages", "PDF Pages", "", () => showPanel(), { enabled: has }, ["File", "file.savepdfas"]);
    C("pdf.addpage", "PDF: Add a Blank Page", "", () => addBlank(), { enabled: has });
    C("pdf.insertpdf", "PDF: Insert Pages from a PDF…", "", insertPdf, { enabled: has });
    C("pdf.deletepage", "PDF: Take Out This Page", "", () => deletePage(P.cur), { enabled: () => !!P && P.cur >= 0 && P.n > 1 });
    const FM = E.ui.MENUS.find(([n]) => n === "File");
    if (FM) { const at = FM[1].indexOf("file.pdfpages"); if (at >= 0) FM[1].splice(at + 1, 0, { label: "Add / Remove PDF Pages", items: ["pdf.addpage", "pdf.insertpdf", "pdf.deletepage"] }); }
    E.pdf = { openBuffer, openPage, openFromProject, save, toBytes, isEdited, onPage, state: () => P, panel: () => panel, addBlank, insertBuffer, movePage, deletePage };   // 2.488.0: + the page operations
  }
  root.PCPdf = Object.assign({ install }, pure);
})(typeof window !== "undefined" ? window : globalThis);
