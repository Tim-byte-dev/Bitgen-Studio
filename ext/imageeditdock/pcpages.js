/* pcpages.js — PAGES: A DOCUMENT OF MANY PAGES, EACH WITH ITS OWN LAYERS (2.799.0), window.PCPages.
 *
 * Tim (verbatim): "i want to give the editor full desktop publishing ability like coreldraw, user can add multiple pages
 * each page will have it's own layers. export to cdr, ai,pdf" (pages + per-page layers first; master pages, linked text
 * frames and print-ready PDF follow as their own releases).
 *
 *   A PAGE        a size (A3 / A4 / A5 / A6 / Letter / Legal / Tabloid / Business card / DL / Square, or your own in mm),
 *                 portrait or landscape, a resolution (72 - 300 dpi) and its OWN layers, selection, paths, channels,
 *                 layer comps and undo. The page in front is live in the editor (S); the others are kept by reference
 *                 (PAGE_KEYS - the document's keys without its name, view and file settings).
 *   NEW           File ▸ New Document with Pages… (size, orientation, dpi, how many pages). Any open picture becomes a
 *                 one-page document the first time you add a page (its size read back as the nearest page size).
 *   THE PAGES     Window ▸ Pages (it shows by itself for a document of more than one page): a strip of the pages -
 *     PANEL       click = that page, drag = move it, double-click the name = rename; ＋ Page (after this one, the same
 *                 size), ⧉ Duplicate (its layers copied), ▲ ▼, 🗑 (click twice), Page setup (size, orientation, dpi -
 *                 the page's canvas follows: Canvas Size centred, Image Size for another dpi - undoable),
 *                 ⤓ Export… (pcdtpout.js: PDF / .ai / SVG / CorelDRAW pack).
 *   .bgi          a document of pages saves every page (pcbgi.js: pages/<id>.bgi inside, the page in front as the
 *                 main document so an older bitGen still opens it) and opens them all again.
 *
 * Pure (Node: scripts/test-pages799.js): PAGE_SIZES, DPIS, pagePx, guess, cleanPage, moveIdx, pageKeys, sizeLabel.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const PAGE_SIZES = [["A3", 297, 420], ["A4", 210, 297], ["A5", 148, 210], ["A6", 105, 148], ["Letter", 215.9, 279.4], ["Legal", 215.9, 355.6],
    ["Tabloid", 279.4, 431.8], ["Business card", 90, 55], ["DL", 99, 210], ["Square", 210, 210]];
  const DPIS = [72, 96, 150, 200, 300];
  const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  /** a page record's size settings, checked: {name, preset, wmm, hmm, orient, dpi} */
  function cleanPage(p) {
    const o = p && typeof p === "object" ? p : {};
    const ps = PAGE_SIZES.find((x) => x[0] === o.preset);
    let wmm = num(o.wmm, 10, 5000, ps ? ps[1] : 210), hmm = num(o.hmm, 10, 5000, ps ? ps[2] : 297);
    if (ps) { wmm = ps[1]; hmm = ps[2]; }
    const orient = o.orient === "landscape" ? "landscape" : o.orient === "portrait" ? "portrait" : (wmm > hmm ? "landscape" : "portrait");
    return { name: String(o.name || "").slice(0, 80), preset: ps ? ps[0] : "Custom", wmm, hmm, orient, dpi: DPIS.includes(+o.dpi) ? +o.dpi : num(o.dpi, 36, 600, 150) };
  }
  /** the page's canvas in px: the preset's sides turned to its orientation, at its dpi */
  function pagePx(p) {
    const c = cleanPage(p);
    let a = c.wmm, b = c.hmm;
    if (c.preset !== "Custom") { const lo = Math.min(a, b), hi = Math.max(a, b); if (c.orient === "landscape") { a = hi; b = lo; } else { a = lo; b = hi; } }
    else if ((c.orient === "landscape") !== (a > b) && a !== b) { const t = a; a = b; b = t; }
    return { w: Math.max(1, Math.min(16384, Math.round((a / 25.4) * c.dpi))), h: Math.max(1, Math.min(16384, Math.round((b / 25.4) * c.dpi))) };
  }
  /** a picture of w x h px read as a page at dpi: the page size it is (within 1 %) or Custom in mm */
  function guess(w, h, dpi) {
    const d = dpi || 150, wmm = (w / d) * 25.4, hmm = (h / d) * 25.4, orient = w > h ? "landscape" : "portrait";
    for (const [n, a, b] of PAGE_SIZES) {
      const lo = Math.min(a, b), hi = Math.max(a, b), x = Math.min(wmm, hmm), y = Math.max(wmm, hmm);
      if (Math.abs(x - lo) / lo < 0.01 && Math.abs(y - hi) / hi < 0.01) return cleanPage({ preset: n, orient, dpi: d });
    }
    return cleanPage({ preset: "Custom", wmm: Math.round(wmm * 10) / 10, hmm: Math.round(hmm * 10) / 10, orient, dpi: d });
  }
  /** the page in front after moving page `from` to `to` */
  function moveIdx(cur, from, to) {
    if (cur === from) return to;
    if (from < cur && to >= cur) return cur - 1;
    if (from > cur && to <= cur) return cur + 1;
    return cur;
  }
  /** what a page keeps of its own: the document's keys without its name, its view and its file settings */
  const DOC_ONLY = new Set(["name", "zoom", "panX", "panY", "userView", "bgiName", "pages", "results", "preview", "previewIndex", "fileInfo", "imgMode", "imgModeOpt", "picks"]);
  const FALLBACK_KEYS = ["w", "h", "layers", "active", "sel", "selVer", "selCount", "undo", "redo", "float", "pts", "maskEdit", "fmaskEdit", "qm", "qmDirty", "qmBefore", "lastSel",
    "histSrc", "paths", "work", "ptarget", "channels", "lastPaint", "viewMask", "cloneSrc", "cloneOff", "cloneMark", "savedTop", "comps", "compOn", "compSel", "compLast", "guides", "dimScale",
    "samplers", "notes", "counts", "zones"];
  const pageKeys = (docKeys) => (Array.isArray(docKeys) && docKeys.length ? docKeys.filter((k) => !DOC_ONLY.has(k)) : FALLBACK_KEYS.slice());
  const r1 = (v) => Math.round(v * 10) / 10;
  /** "A4 ▯ 150 dpi" / "120 x 80 mm ▭ 300 dpi" */
  function sizeLabel(p) { const c = cleanPage(p); return (c.preset === "Custom" ? `${r1(c.wmm)} × ${r1(c.hmm)} mm` : c.preset) + (c.orient === "landscape" ? " ▭" : " ▯") + ` ${c.dpi} dpi`; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, say, ctx, newCanvas, kx } = E;
    const $ = (id) => doc.getElementById(id) || E.$(id);   // the dialogs live on the page body, outside the editor
    if (!E.ui || !E.ui.addCmd) return;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    const DOCS = root.PCDocs;
    const KEYS = pageKeys(DOCS && DOCS.DOC_KEYS);
    const blank = () => (DOCS && DOCS.blank ? DOCS.blank() : { layers: [], undo: [], redo: [], paths: [], channels: [], histSrc: new Map(), comps: [], guides: [], samplers: [], notes: [], zones: [], pts: [] });
    const take = () => { const o = {}; for (const k of KEYS) o[k] = S[k]; return o; };
    const giveSt = (st) => { const b = blank(); for (const k of KEYS) S[k] = st && k in st ? st[k] : b[k]; };
    /** a never-opened page: its size, a white Background */
    function blankState(pg) {
      const { w, h } = pagePx(pg), st = blank();
      const L = E.makeLayer("Background", w, h); const g = ctx(L.canvas); if (g) { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); }
      return Object.assign(st, { w, h, layers: [L], active: 0, undo: [], redo: [], sel: new Uint8Array(w * h), histSrc: new Map() });
    }
    const P = () => S.pages || null;
    const count = () => (P() ? P().list.length : (S.w ? 1 : 0));
    function newEntry(spec) { const pp = P(); const id = ++pp.uid; return Object.assign(cleanPage(spec), { id, name: (spec && spec.name) || "Page " + (pp.list.length + 1), st: null, thumb: null }); }
    /** a document without pages becomes one of a single page (its size read back) */
    function ensure() {
      if (P() || !S.w) return P();
      const g = guess(S.w, S.h, 150);
      S.pages = { list: [], cur: 0, uid: 0 };
      S.pages.list.push(newEntry(Object.assign(g, { name: "Page 1" })));
      return S.pages;
    }
    function thumbOf() {
      try { const f = E.flatten(); if (!f) return null; const tw = 120, th = Math.max(1, Math.round(tw * f.height / f.width)); const c = newCanvas(tw, th); const g = ctx(c); g.fillStyle = "#fff"; g.fillRect(0, 0, tw, th); g.drawImage(f, 0, 0, tw, th); return c; } catch (e) { return null; }
    }
    /** the editor shows what is in S now (the steps pcdocs.js takes when a document comes to the front) */
    function show() {
      E.sizeCanvases();
      E.setSel(S.sel && S.sel.length === S.w * S.h ? S.sel : new Uint8Array(S.w * S.h), true);
      if (!S.histSrc || !S.histSrc.size) E.snapHistorySource();
      S.userView = false; E.fitView(); E.refresh(); E.renderLayersPanel();
      if (E.ui.history) E.ui.history();
      if (E.ui.comps) E.ui.comps();
      if (E.pathsIdle) E.pathsIdle();
    }
    function leave() { const pp = P(), pg = pp.list[pp.cur]; if (!pg) return; pg.thumb = thumbOf() || pg.thumb; pg.st = take(); }
    function enter(i, snap) {
      const pp = P(), pg = pp.list[i];
      giveSt(pg.st || blankState(pg)); pg.st = null; pp.cur = i;
      if (snap) { E.putDoc(snap); S.undo = []; S.redo = []; }
      S.drag = null; S.stroke = null;
      show(); paint();
    }
    const busy = () => (E.smartBusy && E.smartBusy()) ? (say("finish editing the smart object's contents first (✔ Done / ✕ Cancel)"), true) : false;
    function go(i) {
      const pp = P(); if (!pp || i === pp.cur || i < 0 || i >= pp.list.length || busy()) return false;
      if (S.drag && S.drag.paint && E.endStroke) { try { E.endStroke(0, 0); } catch (e) { /* no stroke */ } }
      leave(); enter(i);
      say(`page ${i + 1} of ${pp.list.length}: ${pp.list[i].name} · ${sizeLabel(pp.list[i])}`);
      return true;
    }
    /** a new page after this one (the same size unless spec says) - and to it */
    function add(spec) {
      if (!S.w) return say("open or make a document first");
      if (busy()) return;
      const pp = ensure(), at = pp.cur + 1;
      const base = Object.assign({}, pp.list[pp.cur], spec || {}, { name: (spec && spec.name) || "" });
      const e = newEntry(base); pp.list.splice(at, 0, e);
      leave(); enter(at);
      say(`added ${e.name} (${sizeLabel(e)}) - its own layers`);
      return e;
    }
    function duplicate() {
      if (!S.w || busy()) return;
      const pp = ensure(), src = pp.list[pp.cur], snap = E.snapDoc();
      const e = newEntry(Object.assign({}, src, { name: src.name + " copy" })); pp.list.splice(pp.cur + 1, 0, e);
      leave(); enter(pp.cur + 1, snap);
      say(`${e.name}: a copy of ${src.name} with its layers`);
      return e;
    }
    let armed = null;
    function remove(i, sure) {
      const pp = P(); if (!pp || pp.list.length < 2) { say("a document keeps at least one page"); return false; }
      const k = i == null ? pp.cur : i;
      if (!sure) { const id = pp.list[k].id; armed = id; setTimeout(() => { if (armed === id) { armed = null; paint(); } }, 3500); paint(); say(`click 🗑 again to delete ${pp.list[k].name}`); return false; }
      armed = null;
      const gone = pp.list[k];
      if (k === pp.cur) { const to = k > 0 ? k - 1 : 1; leave(); enter(to); }
      const idx = pp.list.indexOf(gone); pp.list.splice(idx, 1); if (pp.cur > idx) pp.cur--;
      paint(); say(`deleted ${gone.name}`);
      return true;
    }
    function move(from, to) {
      const pp = P(); if (!pp || from === to || from < 0 || to < 0 || from >= pp.list.length || to >= pp.list.length) return;
      const [e] = pp.list.splice(from, 1); pp.list.splice(to, 0, e); pp.cur = moveIdx(pp.cur, from, to); paint();
    }
    function rename(i, name) { const pp = P(); if (!pp || !pp.list[i]) return; pp.list[i].name = String(name || "").trim().slice(0, 80) || pp.list[i].name; paint(); }
    /** the page in front gets another size / orientation / dpi - its canvas follows (undoable steps) */
    function setup(spec) {
      if (!S.w || busy()) return;
      const pp = ensure(), pg = pp.list[pp.cur], next = cleanPage(Object.assign({}, pg, spec));
      if (E.img && next.dpi !== pg.dpi) { const k = next.dpi / pg.dpi; E.img.size(Math.round(S.w * k), Math.round(S.h * k)); }
      const t = pagePx(next);
      if (E.img && (t.w !== S.w || t.h !== S.h)) { const bg = S.bg; S.bg = "#ffffff"; try { E.img.canvas(t.w, t.h, 0.5, 0.5); } finally { S.bg = bg; } }
      Object.assign(pg, next, { name: pg.name });
      paint(); say(`${pg.name}: ${sizeLabel(pg)} (${S.w} × ${S.h} px)`);
    }
    /** run fn(page, i) with each page live in S in turn (no screen changes), then the page in front back - for the
     *  export and the .bgi; a document without pages = fn(null, 0) once */
    async function eachPage(fn) {
      const pp = P(); if (!pp) return [await fn(null, 0)];
      const home = take(), cur = pp.cur, out = [];
      try {
        for (let i = 0; i < pp.list.length; i++) {
          const pg = pp.list[i];
          giveSt(i === cur ? home : (pg.st || blankState(pg)));
          out.push(await fn(pg, i));
        }
      } finally { giveSt(home); }
      return out;
    }
    const meta = (pg) => ({ id: pg.id, name: pg.name, preset: pg.preset, wmm: pg.wmm, hmm: pg.hmm, orient: pg.orient, dpi: pg.dpi });
    /** pcbgi.js: every other page as its own .bgi inside (put(name, bytes) -> name) */
    async function toBgi(nestedBytes, put) {
      const pp = P(); if (!pp || pp.list.length < 2) return null;
      const list = [];
      await eachPage(async (pg, i) => { const r = meta(pg); if (i !== pp.cur) r.file = put(`pages/${pg.id}.bgi`, await nestedBytes()); list.push(r); });
      return { cur: pp.cur, list };
    }
    /** pcbgi.js: the pages back (the page in front is already open; openNested(bytes) opens one in place) */
    async function fromBgi(rec, files, openNested) {
      if (!rec || !Array.isArray(rec.list) || rec.list.length < 2) return;
      const cur = Math.max(0, Math.min(rec.list.length - 1, rec.cur | 0));
      S.pages = { list: [], cur, uid: 0 };
      for (const r of rec.list) { const e = Object.assign(cleanPage(r), { id: 0, name: r.name || "Page", st: null, thumb: null }); e.id = ++S.pages.uid; S.pages.list.push(e); }
      for (let i = 0; i < rec.list.length; i++) {
        if (i === cur || !rec.list[i].file) continue;
        const b = files.get(rec.list[i].file); if (!b) continue;
        const home = take();
        try { await openNested(b); S.pages.list[i].st = take(); S.pages.list[i].thumb = thumbOf(); } catch (e) { say(`page ${i + 1} could not be read: ${e.message}`); } finally { giveSt(home); }
      }
      show(); showPanel();
    }

    /* ---------------- the Pages panel ---------------- */
    let panel = null, thumbTimer = 0;
    function css() {
      if (doc.getElementById("pcpagesCss")) return;
      const s = doc.createElement("style"); s.id = "pcpagesCss";
      s.textContent = ".kx .pgpanel{position:absolute;left:46px;top:70px;bottom:28px;width:160px;z-index:30;display:flex;flex-direction:column;background:var(--pc-panel);border:1px solid var(--pc-line);border-radius:4px;box-shadow:0 4px 18px rgba(0,0,0,.35);font-size:11px;color:var(--pc-text)}"
        + ".kx .pgpanel .pgh{display:flex;gap:4px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--pc-line)}.kx .pgpanel .pgh b{flex:1}"
        + ".kx .pgpanel .pgl{flex:1;overflow:auto;padding:6px;display:flex;flex-direction:column;gap:8px}"
        + ".kx .pgpanel .pgp{cursor:pointer;border:2px solid transparent;border-radius:3px}.kx .pgpanel .pgp.on{border-color:var(--pc-accent)}"
        + ".kx .pgpanel .pgp canvas{width:100%;display:block;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}.kx .pgpanel .pgp .pn{display:flex;gap:4px;padding:2px 1px;color:var(--pc-dim)}.kx .pgpanel .pgp.on .pn{color:var(--pc-text)}"
        + ".kx .pgpanel .pgp .pn b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-weight:500}"
        + ".kx .pgpanel .pgb{display:flex;flex-wrap:wrap;gap:4px;padding:6px;border-top:1px solid var(--pc-line)}.kx .pgpanel .pgb button{padding:2px 6px}.kx .pgpanel .pgb button.arm{background:#a33;color:#fff}";
      doc.head.appendChild(s);
    }
    function showPanel() {
      if (E.pdfSession && E.pdfSession.get()) { say("this is a PDF's page - its own Pages strip is on the left (File ▸ PDF Pages)"); return; }
      css();
      if (!panel) { panel = doc.createElement("div"); panel.className = "pgpanel"; panel.id = "pcPagesPanel"; kx.appendChild(panel); }
      panel.style.display = ""; paint();
    }
    const shown = () => !!(panel && panel.style.display !== "none");
    function hidePanel() { if (panel) panel.style.display = "none"; }
    function paint() {
      if (!shown()) return;
      if (!S.w) { panel.innerHTML = '<div class="pgh"><b>📑 Pages</b><button class="ghost" id="pgHide">✕</button></div><div class="pgl" style="color:var(--pc-dim)">No document open.</div>'; $("pgHide").onclick = hidePanel; return; }
      const pp = P(), list = pp ? pp.list : [Object.assign(guess(S.w, S.h, 150), { id: 0, name: "Page 1" })], cur = pp ? pp.cur : 0;
      panel.innerHTML = `<div class="pgh"><b>📑 Pages</b><span>${list.length}</span><button class="ghost" id="pgHide" title="Hide (Window ▸ Pages shows it again)">✕</button></div>
        <div class="pgl" id="pgList">${list.map((pg, i) => `<div class="pgp${i === cur ? " on" : ""}" data-pgi="${i}" draggable="true" title="Click: this page · drag: move · double-click the name: rename"><canvas width="1" height="1"></canvas><div class="pn"><span>${i + 1}</span><b data-pgn="${i}">${esc(pg.name)}</b></div><div class="pn" style="font-size:10px">${esc(sizeLabel(pg))}</div></div>`).join("")}</div>
        <div class="pgb"><button class="ghost" id="pgAdd" title="A new page after this one, the same size - its own layers">＋ Page</button><button class="ghost" id="pgDup" title="A copy of this page with its layers">⧉</button><button class="ghost" id="pgUp" title="Move this page up">▲</button><button class="ghost" id="pgDown" title="Move this page down">▼</button><button class="ghost${pp && armed === list[cur].id ? " arm" : ""}" id="pgDel" title="Delete this page (click twice)">🗑</button></div>
        <div class="pgb"><button class="ghost" id="pgSetup" title="This page's size, orientation and resolution">📐 Page setup…</button><button class="ghost" id="pgExport" title="Every page with its layers: PDF, .ai, SVG pages, or a pack for .cdr">⤓ Export…</button></div>`;
      $("pgHide").onclick = hidePanel;
      panel.querySelectorAll("[data-pgi]").forEach((d) => {
        const i = +d.dataset.pgi, pg = list[i];
        const t = i === cur ? null : pg.thumb, c = d.querySelector("canvas");
        if (t) { c.width = t.width; c.height = t.height; ctx(c).drawImage(t, 0, 0); } else { const { w, h } = pagePx(pg); c.width = 120; c.height = Math.max(1, Math.round(120 * h / w)); }
        d.onclick = () => { if (pp) go(i); };
        d.ondragstart = (e) => { e.dataTransfer.setData("text/x-bg-page", String(i)); e.dataTransfer.effectAllowed = "move"; };
        d.ondragover = (e) => { if (Array.from(e.dataTransfer.types || []).includes("text/x-bg-page")) { e.preventDefault(); d.style.outline = "2px dashed var(--pc-accent)"; } };
        d.ondragleave = () => { d.style.outline = ""; };
        d.ondrop = (e) => { d.style.outline = ""; const from = +e.dataTransfer.getData("text/x-bg-page"); e.preventDefault(); if (pp && Number.isFinite(from)) move(from, i); };
      });
      panel.querySelectorAll("[data-pgn]").forEach((b) => { b.ondblclick = (e) => { e.stopPropagation(); renameBox(+b.dataset.pgn, b); }; });
      $("pgAdd").onclick = () => add();
      $("pgDup").onclick = () => duplicate();
      $("pgUp").onclick = () => { if (pp && pp.cur > 0) move(pp.cur, pp.cur - 1); };
      $("pgDown").onclick = () => { if (pp && pp.cur < pp.list.length - 1) move(pp.cur, pp.cur + 1); };
      $("pgDel").onclick = () => { if (!pp) return say("a document keeps at least one page"); remove(pp.cur, armed === pp.list[pp.cur].id); };
      $("pgSetup").onclick = () => setupDialog();
      $("pgExport").onclick = () => (E.dtpOut ? E.dtpOut.dialog() : say("the export is not loaded"));
      curThumb();
    }
    function renameBox(i, el) {
      const inp = doc.createElement("input"); inp.value = (P() ? P().list[i].name : "Page 1"); inp.style.cssText = "width:100%;font-size:11px"; el.replaceWith(inp); inp.focus(); inp.select();
      const done = (ok) => { if (ok) { ensure(); rename(i, inp.value); } else paint(); };
      inp.onkeydown = (e) => { if (e.key === "Enter") done(true); else if (e.key === "Escape") done(false); e.stopPropagation(); };
      inp.onblur = () => done(true);
    }
    function curThumb() {
      if (!shown() || !S.w) return;
      const pp = P(), cur = pp ? pp.cur : 0, el = panel.querySelector(`[data-pgi="${cur}"] canvas`), t = thumbOf();
      if (el && t) { el.width = t.width; el.height = t.height; ctx(el).drawImage(t, 0, 0); }
    }
    // a document to the front / a layer changed: the strip follows (the page in front's picture a moment later)
    let lastPages;
    const prevLP = E.renderLayersPanel;
    E.renderLayersPanel = function () {
      const r = prevLP.apply(this, arguments);
      if (S.pages !== lastPages) { lastPages = S.pages; if (S.pages && S.pages.list.length > 1 && !(E.pdfSession && E.pdfSession.get())) showPanel(); else paint(); }
      else if (shown()) { clearTimeout(thumbTimer); thumbTimer = setTimeout(curThumb, 700); }
      return r;
    };
    // a new document starts without pages (pcdocs.js parks the old one's with it)
    const prevBefore = E.docBefore;
    E.docBefore = function (inPlace) { const r = prevBefore ? prevBefore.apply(this, arguments) : undefined; if (!inPlace) S.pages = null; return r; };

    function sizeRows(c, pre) {
      return `<div class="kxrow"><span style="width:74px">Size</span><select id="${pre}Preset">${PAGE_SIZES.map(([n, a, b]) => `<option${n === c.preset ? " selected" : ""} value="${esc(n)}">${esc(n)} (${a} × ${b} mm)</option>`).join("")}<option value="Custom"${c.preset === "Custom" ? " selected" : ""}>Custom…</option></select></div>
        <div class="kxrow" id="${pre}Custom"${c.preset === "Custom" ? "" : ' style="display:none"'}><span style="width:74px">W × H mm</span><input type="number" id="${pre}W" value="${r1(c.wmm)}" min="10" max="5000" style="width:70px"> × <input type="number" id="${pre}H" value="${r1(c.hmm)}" min="10" max="5000" style="width:70px"></div>
        <div class="kxrow"><span style="width:74px">Orientation</span><label><input type="radio" name="${pre}Or" value="portrait"${c.orient !== "landscape" ? " checked" : ""}> ▯ Portrait</label><label><input type="radio" name="${pre}Or" value="landscape"${c.orient === "landscape" ? " checked" : ""}> ▭ Landscape</label></div>
        <div class="kxrow"><span style="width:74px">Resolution</span><select id="${pre}Dpi">${DPIS.map((v) => `<option${v === c.dpi ? " selected" : ""}>${v}</option>`).join("")}</select> dpi <span id="${pre}Px" style="color:var(--pc-dim)"></span></div>`;
    }
    function readRows(pre) {
      const or = doc.querySelector(`input[name="${pre}Or"]:checked`);
      return cleanPage({ preset: $(pre + "Preset").value, wmm: $(pre + "W").value, hmm: $(pre + "H").value, orient: or ? or.value : "portrait", dpi: +$(pre + "Dpi").value });
    }
    function wireRows(pre) {
      const upd = () => { $(pre + "Custom").style.display = $(pre + "Preset").value === "Custom" ? "" : "none"; const p = pagePx(readRows(pre)); $(pre + "Px").textContent = `= ${p.w} × ${p.h} px`; };
      [pre + "Preset", pre + "W", pre + "H", pre + "Dpi"].forEach((id) => { $(id).oninput = upd; $(id).onchange = upd; });
      doc.querySelectorAll(`input[name="${pre}Or"]`).forEach((r) => { r.onchange = upd; });
      upd();
    }
    function box(id, title, body) {
      const old = $(id); if (old) old.remove();
      const d = doc.createElement("div"); d.id = id;
      d.style.cssText = "position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:9000;background:var(--pc-panel,#222);color:var(--pc-text,#eee);border:1px solid var(--pc-line,#444);border-radius:6px;padding:12px 14px;min-width:360px;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.5)";
      d.innerHTML = `<div style="font-weight:600;margin-bottom:8px">${esc(title)}</div>${body}`;
      doc.body.appendChild(d); return d;
    }
    function setupDialog() {
      if (!S.w) return say("open or make a document first");
      const pp = ensure(), pg = pp.list[pp.cur];
      const d = box("pcPageSetup", `Page setup - ${pg.name}`, sizeRows(pg, "psu") + `<div style="color:var(--pc-dim);margin:6px 0">The page's canvas follows: another size = Canvas Size (centred, new room white), another dpi = Image Size. Both can be undone.</div>
        <div class="kxrow" style="justify-content:flex-end;gap:6px"><button class="ghost" id="psuCancel">Cancel</button><button id="psuOk">Apply</button></div>`);
      wireRows("psu");
      $("psuCancel").onclick = () => d.remove();
      $("psuOk").onclick = () => { const spec = readRows("psu"); d.remove(); setup(spec); };
    }
    function newDialog() {
      const d = box("pcPagesNew", "New document with pages", `<div class="kxrow"><span style="width:74px">Name</span><input id="pgnName" value="Document" style="flex:1"></div>` + sizeRows(cleanPage({ preset: "A4", orient: "portrait", dpi: 150 }), "pgn")
        + `<div class="kxrow"><span style="width:74px">Pages</span><input type="number" id="pgnN" value="2" min="1" max="200" style="width:70px"></div>
        <div class="kxrow" style="justify-content:flex-end;gap:6px"><button class="ghost" id="pgnCancel">Cancel</button><button id="pgnOk">Create</button></div>`);
      wireRows("pgn");
      $("pgnCancel").onclick = () => d.remove();
      $("pgnOk").onclick = () => { const spec = readRows("pgn"), n = Math.max(1, Math.min(200, Math.round(+$("pgnN").value || 1))), nm = $("pgnName").value; d.remove(); newDocument(spec, n, nm); };
    }
    /** a new document of n pages, all of one size */
    function newDocument(spec, n, name) {
      const c = cleanPage(spec), { w, h } = pagePx(c);
      E.openDoc(w, h, (String(name || "Document").trim() || "Document").replace(/\.png$/i, "") + ".png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); });
      S.pages = { list: [], cur: 0, uid: 0 };
      for (let i = 0; i < Math.max(1, n | 0); i++) S.pages.list.push(newEntry(Object.assign({}, c, { name: "Page " + (i + 1) })));
      lastPages = S.pages; showPanel();
      say(`${S.pages.list.length} page(s), ${sizeLabel(c)} (${w} × ${h} px) - each page has its own layers; ⤓ Export… for PDF / .ai / SVG / .cdr`);
      return S.pages;
    }

    const C = E.ui.addCmd;
    C("file.newpages", "New Document with Pages…", "", newDialog, {});
    C("win.pages", "Pages", "", () => (shown() ? hidePanel() : showPanel()), { checked: () => shown() });
    C("page.add", "Add Page", "", () => add(), { enabled: () => !!S.w });
    const M = (n) => E.ui.MENUS.find(([x]) => x === n);
    const F = M("File"); if (F) { const it = F[1], at = it.indexOf("file.new"); it.splice(at >= 0 ? at + 1 : 0, 0, "file.newpages"); }
    const W = M("Window"); if (W) { const it = W[1], at = it.indexOf("win.panels"); it.splice(at >= 0 ? at + 1 : it.length, 0, "win.pages"); }
    E.pages = { ensure, count, go, add, duplicate, remove, move, rename, setup, eachPage, toBgi, fromBgi, newDocument, newDialog, setupDialog, showPanel, hidePanel, shown,
      list: () => (P() ? P().list : []), cur: () => (P() ? P().cur : 0), current: () => (P() ? P().list[P().cur] : null), panel: () => panel };
  }

  const pure = { PAGE_SIZES, DPIS, cleanPage, pagePx, guess, moveIdx, pageKeys, sizeLabel, DOC_ONLY };
  const api = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCPages = api;
})(typeof window !== "undefined" ? window : globalThis);
