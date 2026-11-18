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
 *   MASTERS       2.800.0 (Tim: "go with the next version" - master pages + page numbers + facing pages): ＋ Master
 *                 (A-Master, B-Master … the size of the page in front) - its own layers, drawn under the layers of
 *                 every page that uses it (a locked "⌂ A-Master" layer just above the page's Background, made again
 *                 when the master changes); ✎ edits it like a page (← Pages goes back); each page picks its master
 *                 (None / A-Master …; All / Odd / Even give it to those pages). The export writes a master's own
 *                 layers (paths, real text) as "Master / <layer>" on each page.
 *   PAGE NUMBERS  {page} / {pages} / {name} in any type layer - on a master (shown as is there, each page's own number
 *                 on the pages) or on a page (it shows the number; type the token again to change it). # Page number
 *                 adds one (bottom centre). Numbers: 1 2 3 / i ii iii / I II III / a b c / A B C, starting at any number.
 *   FACING PAGES  ☐ Facing: the strip shows spreads (page 1 alone on the right, then 2 + 3 …); Export ▸ As spreads
 *                 writes each spread as one PDF / SVG page.
 *   .bgi          a document of pages saves every page (pcbgi.js: pages/<id>.bgi inside, the page in front as the
 *                 main document so an older bitGen still opens it) and opens them all again.
 *
 * Pure (Node: scripts/test-pages799.js, test-masters800.js): PAGE_SIZES, DPIS, pagePx, guess, cleanPage, moveIdx, pageKeys,
 * sizeLabel, fmtNum, resolveTokens, hasTokens, spreadsOf, targets, masterName.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const PAGE_SIZES = [["A3", 297, 420], ["A4", 210, 297], ["A5", 148, 210], ["A6", 105, 148], ["Letter", 215.9, 279.4], ["Legal", 215.9, 355.6],
    ["Tabloid", 279.4, 431.8], ["Business card", 90, 55], ["DL", 99, 210], ["Square", 210, 210]];
  const DPIS = [72, 96, 150, 200, 300];
  const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  /** 2.846.0: a page's margins in mm {top, right, bottom, left} (pcpageprops.js) - null = none set */
  function cleanMargins(m) { if (!m || typeof m !== "object") return null; const o = {}; for (const k of ["top", "right", "bottom", "left"]) o[k] = Math.round(num(m[k], 0, 500, 0) * 10) / 10; return o; }
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

  /* 2.800.0: page numbers, spreads, masters */
  const ROMAN = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  const NUM_STYLES = [["1", "1 2 3"], ["i", "i ii iii"], ["I", "I II III"], ["a", "a b c"], ["A", "A B C"]];
  /** a page number in a style: "1" | "i" | "I" | "a" | "A" */
  function fmtNum(n, style) {
    n = Math.round(Number(n)); if (!Number.isFinite(n)) return "";
    if (style === "i" || style === "I") { if (n < 1 || n > 3999) return String(n); let r = "", x = n; for (const [v, l] of ROMAN) while (x >= v) { r += l; x -= v; } return style === "I" ? r.toUpperCase() : r; }
    if (style === "a" || style === "A") { if (n < 1) return String(n); let r = "", x = n; while (x > 0) { x--; r = String.fromCharCode(97 + (x % 26)) + r; x = Math.floor(x / 26); } return style === "A" ? r.toUpperCase() : r; }
    return String(n);
  }
  const TOKEN_RE = /\{(page|pages|name)\}/g;
  const hasTokens = (s) => typeof s === "string" && /\{(page|pages|name)\}/.test(s);
  /** {page} {pages} {name} filled in: ctx {page, pages, name} */
  const resolveTokens = (s, c) => String(s == null ? "" : s).replace(TOKEN_RE, (m, k) => (c && c[k] != null ? String(c[k]) : m));
  /** the pages as they are seen: facing = page 1 alone (a right-hand page), then 2 + 3, 4 + 5 …; else one by one */
  function spreadsOf(n, facing) {
    const out = [];
    if (!facing) { for (let i = 0; i < n; i++) out.push([i]); return out; }
    if (n > 0) out.push([0]);
    for (let i = 1; i < n; i += 2) out.push(i + 1 < n ? [i, i + 1] : [i]);
    return out;
  }
  /** which pages a master goes to: "this" (cur) | "all" | "odd" | "even" (page numbers as people count: 1 = odd) */
  function targets(n, how, cur) {
    const out = [];
    for (let i = 0; i < n; i++) if (how === "all" || (how === "odd" && i % 2 === 0) || (how === "even" && i % 2 === 1) || (how === "this" && i === cur)) out.push(i);
    return out;
  }
  /** the next master's name: A-Master, B-Master … (the first letter not taken) */
  function masterName(taken) { const t = new Set(taken || []); for (let i = 0; i < 26; i++) { const n = String.fromCharCode(65 + i) + "-Master"; if (!t.has(n)) return n; } return "Master " + (t.size + 1); }

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
    const P = () => norm(S.pages || null);
    const count = () => (P() ? P().list.length : (S.w ? 1 : 0));
    function newEntry(spec) { const pp = P(); const id = ++pp.uid; return Object.assign(cleanPage(spec), { id, name: (spec && spec.name) || "Page " + (pp.list.length + 1), margins: cleanMargins(spec && spec.margins), st: null, thumb: null, master: spec && spec.master != null ? spec.master : null, mdirty: !!(spec && spec.master != null) }); }
    /** 2.800.0: what a pages record has (a 2.799.0 one gets masters, facing, numbering) */
    function norm(pp) { if (!pp) return pp; if (!Array.isArray(pp.masters)) pp.masters = []; if (pp.editing === undefined) pp.editing = null; if (pp.facing == null) pp.facing = false; if (!pp.numbering) pp.numbering = { style: "1", start: 1 }; return pp; }
    /** a document without pages becomes one of a single page (its size read back) */
    function ensure() {
      if (P() || !S.w) return P();
      const g = guess(S.w, S.h, 150);
      S.pages = norm({ list: [], cur: 0, uid: 0 });
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
    function leave() { const pp = P(); if (pp.editing != null) { leaveMaster(); return; } const pg = pp.list[pp.cur]; if (!pg) return; pg.thumb = thumbOf() || pg.thumb; pg.st = take(); }
    function enter(i, snap) {
      const pp = P(), pg = pp.list[i];
      giveSt(pg.st || blankState(pg)); pg.st = null; pp.cur = i; pp.editing = null;
      if (snap) { E.putDoc(snap); S.undo = []; S.redo = []; }
      S.drag = null; S.stroke = null;
      fieldsLive(i);
      show(); paint();
    }

    /* ---------------- 2.800.0: page numbers + masters ---------------- */
    const ctxOf = (i) => { const pp = P(), nb = pp.numbering, pg = pp.list[i]; return { page: fmtNum(nb.start + i, nb.style), pages: fmtNum(nb.start + pp.list.length - 1, nb.style), name: pg ? pg.name : "" }; };
    const masterById = (id) => (P() ? P().masters.find((m) => m.id === id) || null : null);
    const isMasterL = (L) => !!(L && L.master != null);
    function blankMasterState(m) {
      const st = blank(), L = E.makeLayer("Master", m.w, m.h);
      return Object.assign(st, { w: m.w, h: m.h, layers: [L], active: 0, undo: [], redo: [], sel: new Uint8Array(m.w * m.h), histSrc: new Map() });
    }
    const mState = (m) => (m.st = m.st || blankMasterState(m));
    /** the page's own type layers with {page} / {pages} / {name}: shown filled in (t.tpl keeps the tokens; typing over it = plain text) */
    function resolveOwn(layers, i) {
      let n = 0;
      for (const L of layers || []) {
        if (L.type !== "text" || !L.text || isMasterL(L)) continue;
        const t = L.text;
        if (t.tpl != null && t.str !== t.shown) { if (hasTokens(t.str)) t.tpl = t.str; else { delete t.tpl; delete t.shown; continue; } }
        else if (t.tpl == null) { if (hasTokens(t.str)) t.tpl = t.str; else continue; }
        const v = resolveTokens(t.tpl, ctxOf(i));
        if (v !== t.str || t.shown !== v) { t.str = v; t.shown = v; try { E.D.rasterize(L); } catch (e) { /* drawn on the next refresh */ } L.ver = (L.ver || 0) + 1; n++; }
      }
      return n;
    }
    /** run fn with master m live in S, its tokens filled in for page i (then put back) */
    async function withMaster(m, i, fn) {
      const pp = P(), live = pp.editing != null && pp.masters[pp.editing] === m, home = live ? null : take();
      if (!live) giveSt(mState(m));
      const tmp = [];
      try {
        if (i >= 0) for (const L of S.layers) if (L.type === "text" && L.text && hasTokens(L.text.str)) { tmp.push([L, L.text.str]); L.text.str = resolveTokens(L.text.str, ctxOf(i)); try { E.D.rasterize(L); } catch (e) { /* later */ } }
        return await fn();
      } finally {
        for (const [L, s0] of tmp) { L.text.str = s0; try { E.D.rasterize(L); } catch (e) { /* later */ } }
        if (!live) giveSt(home);
      }
    }
    function withMasterSync(m, i, fn) {
      const pp = P(), live = pp.editing != null && pp.masters[pp.editing] === m, home = live ? null : take();
      if (!live) giveSt(mState(m));
      const tmp = [];
      try {
        for (const L of S.layers) if (L.type === "text" && L.text && hasTokens(L.text.str)) { tmp.push([L, L.text.str]); L.text.str = resolveTokens(L.text.str, ctxOf(i)); try { E.D.rasterize(L); } catch (e) { /* later */ } }
        return fn();
      } finally {
        for (const [L, s0] of tmp) { L.text.str = s0; try { E.D.rasterize(L); } catch (e) { /* later */ } }
        if (!live) giveSt(home);
      }
    }
    /** master m as page i shows it (a canvas of the master's size) */
    function masterPic(m, i) {
      return withMasterSync(m, i, () => {
        const pic = E.D.render({ w: S.w, h: S.h, layers: S.layers }, E.docEnv({ srcFor: (x) => x.canvas, maskSrc: null, skipControl: true }));
        if (!pic) return null;
        const c = newCanvas(pic.width, pic.height); ctx(c).drawImage(pic, 0, 0); return c;
      });
    }
    /** the page in S gets its master layer (made, refreshed, renamed or taken out) - page i, record pg */
    function syncMasterLive(pg, i) {
      const m = pg.master != null ? masterById(pg.master) : null, act = S.layers[S.active];
      const at = S.layers.findIndex(isMasterL);
      if (!m) { if (at >= 0) S.layers.splice(at, 1); }
      else {
        let L = at >= 0 ? S.layers[at] : null;
        if (!L) {
          L = E.makeLayer("⌂ " + m.name, S.w, S.h); L.master = m.id; L.locks = { all: true };
          const b = S.layers[0] && S.layers[0].type === "pixel" && /^background$/i.test(S.layers[0].name) ? 1 : 0;
          S.layers.splice(b, 0, L);
        }
        L.master = m.id; L.name = "⌂ " + m.name; L.locks = { all: true };
        if (L.canvas.width !== S.w || L.canvas.height !== S.h) L.canvas = newCanvas(S.w, S.h);
        const pic = masterPic(m, i), g = ctx(L.canvas);
        g.clearRect(0, 0, S.w, S.h); if (pic) g.drawImage(pic, 0, 0, S.w, S.h);
        L.ver = (L.ver || 0) + 1;
      }
      pinMaster();
      const k = S.layers.indexOf(act); S.active = k >= 0 ? k : Math.min(S.active, S.layers.length - 1);
      pg.mdirty = false;
    }
    /** the ⌂ master layer stays right above the Background (new layers go over it) */
    function pinMaster() {
      const at = S.layers.findIndex(isMasterL); if (at < 0) return false;
      const b = S.layers[0] && at !== 0 && S.layers[0].type === "pixel" && /^background$/i.test(S.layers[0].name) ? 1 : 0;
      if (at === b) return false;
      const act = S.layers[S.active], [L] = S.layers.splice(at, 1); L.parent = null; S.layers.splice(b, 0, L);
      S.active = Math.max(0, S.layers.indexOf(act));
      return true;
    }
    const mismatch = (pg) => { const L = S.layers.find(isMasterL); return pg.master == null ? !!L : (!L || L.master !== pg.master); };
    /** the page in S (page i): its master layer if it needs it, its own numbers */
    function fieldsLive(i) {
      const pg = P().list[i]; if (!pg) return;
      if (pg.mdirty || mismatch(pg)) syncMasterLive(pg, i); else pinMaster();
      resolveOwn(S.layers, i);
    }
    const masterTokens = (m) => { const L = m === (P().editing != null ? P().masters[P().editing] : null) ? S.layers : (m.st ? m.st.layers : []); return (L || []).some((x) => x.type === "text" && x.text && hasTokens(x.text.str)); };
    /** the page numbers changed (pages added / moved / taken out, the numbering): masters with numbers are made again */
    function renumbered() {
      const pp = P(); if (!pp) return;
      for (const pg of pp.list) if (pg.master != null) { const m = masterById(pg.master); if (m && masterTokens(m)) pg.mdirty = true; }
      if (pp.editing == null && S.w) { fieldsLive(pp.cur); E.refresh(); E.renderLayersPanel(); }
    }
    function leaveMaster() { const pp = P(), m = pp.masters[pp.editing]; if (!m) return null; m.thumb = thumbOf() || m.thumb; m.st = take(); return m; }
    function markPagesOf(id) { for (const pg of P().list) if (pg.master === id) pg.mdirty = true; }
    /** back from a master to the pages (the pages that use it are made again) */
    function closeMaster() {
      const pp = P(); if (!pp || pp.editing == null) return false;
      const m = leaveMaster(); pp.editing = null;
      if (m) markPagesOf(m.id);
      enter(pp.cur);
      return true;
    }
    /** a master to the front, to edit like a page */
    function editMaster(mi) {
      const pp = P(); if (!pp || !pp.masters[mi] || busy()) return false;
      if (pp.editing === mi) return true;
      if (S.drag && S.drag.paint && E.endStroke) { try { E.endStroke(0, 0); } catch (e) { /* no stroke */ } }
      leave();
      if (pp.editing != null) markPagesOf(pp.masters[pp.editing].id);
      const m = pp.masters[mi];
      giveSt(mState(m)); m.st = null; pp.editing = mi;
      S.drag = null; S.stroke = null;
      show(); paint();
      say(`editing ${m.name} - what you put here shows under every page that uses it ({page} / {pages} in type = the page's number); ← Pages to go back`);
      return true;
    }
    /** ＋ Master: the size of the page in front, given to every page without one, then opened */
    function addMaster() {
      if (!S.w || busy()) return null;
      const pp = ensure();
      const w = S.w, h = S.h, id = ++pp.uid;
      const m = { id, name: masterName(pp.masters.map((x) => x.name)), w, h, st: null, thumb: null };
      pp.masters.push(m);
      for (const pg of pp.list) if (pg.master == null) { pg.master = id; pg.mdirty = true; }
      editMaster(pp.masters.length - 1);
      return m;
    }
    let armedM = null;
    function removeMaster(mi, sure) {
      const pp = P(); if (!pp || !pp.masters[mi]) return false;
      const m = pp.masters[mi];
      if (!sure) { armedM = m.id; setTimeout(() => { if (armedM === m.id) { armedM = null; paint(); } }, 3500); paint(); say(`click 🗑 again to delete ${m.name} (its pages keep their own layers)`); return false; }
      armedM = null;
      if (pp.editing === mi) closeMaster();
      pp.masters.splice(mi, 1);
      for (const pg of pp.list) if (pg.master === m.id) { pg.master = null; pg.mdirty = true; }
      if (pp.editing != null && pp.editing > mi) pp.editing--;
      if (pp.editing == null) { fieldsLive(pp.cur); E.refresh(); E.renderLayersPanel(); }
      paint(); say(`deleted ${m.name}`);
      return true;
    }
    function renameMaster(mi, name) { const pp = P(), m = pp && pp.masters[mi]; if (!m) return; m.name = String(name || "").trim().slice(0, 60) || m.name; markPagesOf(m.id); if (pp.editing == null) { fieldsLive(pp.cur); E.renderLayersPanel(); } paint(); }
    /** pages get a master (id, or null = none): how = "this" | "all" | "odd" | "even" */
    function assign(id, how) {
      const pp = ensure(); if (!pp) return [];
      if (id != null && !masterById(id)) return [];
      const idx = targets(pp.list.length, how || "this", pp.cur);
      for (const i of idx) { pp.list[i].master = id; pp.list[i].mdirty = true; }
      if (pp.editing == null && idx.includes(pp.cur)) { fieldsLive(pp.cur); E.refresh(); E.renderLayersPanel(); }
      paint();
      const m = id != null ? masterById(id) : null;
      say(`${idx.length} page(s): ${m ? m.name : "no master"}`);
      return idx;
    }
    function setFacing(on) { const pp = ensure(); if (!pp) return; pp.facing = !!on; paint(); say(on ? "facing pages: the strip shows spreads (page 1 on the right); Export can write each spread as one page" : "single pages"); }
    function setNumbering(style, start) {
      const pp = ensure(); if (!pp) return;
      pp.numbering = { style: NUM_STYLES.some(([v]) => v === style) ? style : pp.numbering.style, start: Math.max(-9999, Math.min(9999, Math.round(Number(start)) || 0)) };
      if (start == null || start === "") pp.numbering.start = 1;
      renumbered(); paint();
    }
    /** 2.813.0 (Tim: "fix the pagination, page number shows on page 1, but not on page 2. Also add formatting for page
     *  numbers"): the page number goes on the MASTER (made and given to every page when there is none), so every page -
     *  and every page added later (a new page takes this page's master) - shows its own number. o = {format, pos (b|t +
     *  l|c|r), size, color, font}; the number layer on the master is updated when there is one. A number put on a page
     *  by itself before (2.800.0) is taken off that page. */
    const NUM_FORMATS = ["{page}", "Page {page}", "Page {page} of {pages}", "{page} / {pages}", "- {page} -"];
    const isNumL = (L) => L && L.type === "text" && L.text && L.name === "Page number";
    function numText(o, w, h) {
      const D = E.D, size = Math.max(6, Math.round(+o.size || Math.max(10, Math.round(h / 50)))), pos = String(o.pos || "bc");
      const align = pos[1] === "l" ? "left" : pos[1] === "r" ? "right" : "center", m = Math.round(w * 0.08);
      return Object.assign({}, D.TEXT_DEFAULT, { str: String(o.format || "{page}"), size, align, font: o.font || "Arial", color: o.color || "#333333",
        x: align === "left" ? m : align === "right" ? w - m : Math.round(w / 2), y: pos[0] === "t" ? Math.round(size * 2) : Math.round(h - size * 2.6) });
    }
    function placeNumber(o) {
      const L = S.layers.find(isNumL), t = numText(o, S.w, S.h);
      if (L) { L.text = Object.assign(L.text, t); delete L.text.tpl; delete L.text.shown; E.D.rasterize(L); E.refresh(); E.renderLayersPanel(); return L; }
      const T = E.makeLayer("Page number", S.w, S.h, "text"); T.text = t; E.D.rasterize(T); E.addLayer(T, "page number", false); return T;
    }
    function insertNumber(opts) {
      if (!S.w) return say("open or make a document first");
      const o = Object.assign({ format: "{page}", pos: "bc" }, opts || {});
      const pp = ensure();
      if (pp.editing != null) { placeNumber(o); renumbered(); say("{page} on the master - each page shows its own number"); return; }
      // the page's own old numbers go (they showed on that page only)
      for (const pg of pp.list) if (pg.st && pg.st.layers) pg.st.layers = pg.st.layers.filter((L) => !isNumL(L));
      const own = S.layers.filter(isNumL); if (own.length) { S.layers = S.layers.filter((L) => !isNumL(L)); E.refresh(); E.renderLayersPanel(); }
      const pg = pp.list[pp.cur];
      let mi = pg.master != null ? pp.masters.findIndex((m) => m.id === pg.master) : -1;
      if (mi < 0) { addMaster(); mi = pp.masters.length - 1; for (const x of pp.list) if (x.master == null) { x.master = pp.masters[mi].id; x.mdirty = true; } }
      else editMaster(mi);
      placeNumber(o);
      closeMaster(); renumbered(); paint();
      say(`page numbers on ${pp.masters[mi].name} - every page using it shows its own (${o.format}); new pages take it too`);
    }
    function numberDialog() {
      if (!S.w) return say("open or make a document first");
      const st = E.store, last = (st && st.get("pg.numfmt", null)) || { format: "{page}", pos: "bc", size: 0, color: "#333333", font: "Arial" };
      const pp = ensure(), nb = pp.numbering;
      const fonts = Object.keys(E.D.FONT_STACK || {}).filter((f) => !/^(serif|sans-serif|monospace)$/.test(f));
      const POS = [["bc", "Bottom centre"], ["br", "Bottom right"], ["bl", "Bottom left"], ["tc", "Top centre"], ["tr", "Top right"], ["tl", "Top left"]];
      E.ui.dialog("Page Numbers", `<div class="kxrow"><span>Format</span><select id="pgnF">${NUM_FORMATS.map((f) => `<option${f === last.format ? " selected" : ""}>${esc(f)}</option>`).join("")}<option value="">Your own…</option></select><input id="pgnFC" value="${esc(NUM_FORMATS.includes(last.format) ? "" : last.format)}" placeholder="e.g. Section 2 - {page}" style="width:150px"></div>
        <div class="kxrow"><span>Numbers</span><select id="pgnS">${NUM_STYLES.map(([v, l]) => `<option value="${v}"${v === nb.style ? " selected" : ""}>${esc(l)}</option>`).join("")}</select> <span>start at</span> <input type="number" id="pgnStart" value="${nb.start}" style="width:60px"></div>
        <div class="kxrow"><span>Position</span><select id="pgnP">${POS.map(([v, l]) => `<option value="${v}"${v === last.pos ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="kxrow"><span>Font</span><select id="pgnFont" class="h3-font">${fonts.map((f) => `<option${f === last.font ? " selected" : ""}>${esc(f)}</option>`).join("")}</select> <span>Size</span> <input type="number" id="pgnSize" min="0" value="${last.size || ""}" placeholder="auto" style="width:60px"> <input type="color" id="pgnC" value="${last.color || "#333333"}" title="Colour"></div>
        <div class="kxrow" style="color:var(--pc-dim)">{page} = the page's number, {pages} = how many pages, {name} = the page's name. They go on the master, so every page shows its own.</div>`, (d) => {
        const q = (id) => d.querySelector("#" + id), fmt = q("pgnF").value || q("pgnFC").value.trim() || "{page}";
        const o = { format: fmt, pos: q("pgnP").value, size: +q("pgnSize").value || 0, color: q("pgnC").value, font: q("pgnFont").value };
        if (st) st.set("pg.numfmt", o);
        setNumbering(q("pgnS").value, q("pgnStart").value);
        insertNumber(o);
      }, { okLabel: "# Apply" });
    }
    /** close a master edit before the pages are read (the export, the .bgi) */
    function settle() { const pp = P(); if (pp && pp.editing != null) closeMaster(); }
    /** the export: master id's own layers for page i (fn builds the export page from S) */
    async function masterOut(id, i, fn) { const m = masterById(id); if (!m) return null; return withMaster(m, i, fn); }
    const needsBgi = () => { const pp = P(); return !!(pp && (pp.list.length > 1 || pp.masters.length || pp.facing || pp.numbering.style !== "1" || pp.numbering.start !== 1 || pp.list.some((x) => x.master != null))); };
    const busy = () => (E.smartBusy && E.smartBusy()) ? (say("finish editing the smart object's contents first (✔ Done / ✕ Cancel)"), true) : false;
    function go(i) {
      const pp = P(); if (!pp || (i === pp.cur && pp.editing == null) || i < 0 || i >= pp.list.length || busy()) return false;
      if (S.drag && S.drag.paint && E.endStroke) { try { E.endStroke(0, 0); } catch (e) { /* no stroke */ } }
      if (pp.editing != null) { const m = leaveMaster(); pp.editing = null; if (m) markPagesOf(m.id); } else leave();
      enter(i);
      say(`page ${i + 1} of ${pp.list.length}: ${pp.list[i].name} · ${sizeLabel(pp.list[i])}`);
      return true;
    }
    /** a new page after this one (the same size unless spec says) - and to it */
    function add(spec) {
      if (!S.w) return say("open or make a document first");
      if (busy()) return;
      settle();
      const pp = ensure(), at = pp.cur + 1;
      const base = Object.assign({}, pp.list[pp.cur], spec || {}, { name: (spec && spec.name) || "" });
      const e = newEntry(base); pp.list.splice(at, 0, e);
      leave(); enter(at); renumbered();
      say(`added ${e.name} (${sizeLabel(e)}) - its own layers`);
      return e;
    }
    function duplicate() {
      if (!S.w || busy()) return;
      settle();
      const pp = ensure(), src = pp.list[pp.cur], snap = E.snapDoc();
      const e = newEntry(Object.assign({}, src, { name: src.name + " copy" })); pp.list.splice(pp.cur + 1, 0, e);
      leave(); enter(pp.cur + 1, snap); renumbered();
      say(`${e.name}: a copy of ${src.name} with its layers`);
      return e;
    }
    let armed = null;
    function remove(i, sure) {
      const pp = P(); if (!pp || pp.list.length < 2) { say("a document keeps at least one page"); return false; }
      settle();
      const k = i == null ? pp.cur : i;
      if (!sure) { const id = pp.list[k].id; armed = id; setTimeout(() => { if (armed === id) { armed = null; paint(); } }, 3500); paint(); say(`click 🗑 again to delete ${pp.list[k].name}`); return false; }
      armed = null;
      const gone = pp.list[k];
      if (k === pp.cur) { const to = k > 0 ? k - 1 : 1; leave(); enter(to); }
      const idx = pp.list.indexOf(gone); pp.list.splice(idx, 1); if (pp.cur > idx) pp.cur--;
      renumbered(); paint(); say(`deleted ${gone.name}`);
      return true;
    }
    function move(from, to) {
      const pp = P(); if (!pp || from === to || from < 0 || to < 0 || from >= pp.list.length || to >= pp.list.length) return;
      settle();
      const [e] = pp.list.splice(from, 1); pp.list.splice(to, 0, e); pp.cur = moveIdx(pp.cur, from, to); renumbered(); paint();
    }
    function rename(i, name) { const pp = P(); if (!pp || !pp.list[i]) return; pp.list[i].name = String(name || "").trim().slice(0, 80) || pp.list[i].name; renumbered(); paint(); }
    /** the page in front gets another size / orientation / dpi - its canvas follows (undoable steps) */
    function setup(spec) {
      if (!S.w || busy()) return;
      settle();
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
      const home = take(), cur = pp.cur, out = [], onMaster = pp.editing != null;
      try {
        for (let i = 0; i < pp.list.length; i++) {
          const pg = pp.list[i];
          if (i === cur && !onMaster) giveSt(home); else { pg.st = pg.st || blankState(pg); giveSt(pg.st); }
          fieldsLive(i);
          out.push(await fn(pg, i));
        }
      } finally { giveSt(home); }
      return out;
    }
    const meta = (pg) => ({ id: pg.id, name: pg.name, preset: pg.preset, wmm: pg.wmm, hmm: pg.hmm, orient: pg.orient, dpi: pg.dpi, master: pg.master == null ? null : pg.master, margins: pg.margins || null });
    /** pcbgi.js: every other page as its own .bgi inside (put(name, bytes) -> name) */
    async function toBgi(nestedBytes, put) {
      settle();
      const pp = P(); if (!pp || !needsBgi()) return null;
      const list = [], masters = [];
      await eachPage(async (pg, i) => { const r = meta(pg); if (i !== pp.cur) r.file = put(`pages/${pg.id}.bgi`, await nestedBytes()); list.push(r); });
      for (const m of pp.masters) masters.push(await withMaster(m, -1, async () => ({ id: m.id, name: m.name, w: m.w, h: m.h, file: put(`masters/${m.id}.bgi`, await nestedBytes()) })));
      return { cur: pp.cur, list, masters, facing: !!pp.facing, numbering: Object.assign({}, pp.numbering), uid: pp.uid };
    }
    /** pcbgi.js: the pages back (the page in front is already open; openNested(bytes) opens one in place) */
    async function fromBgi(rec, files, openNested) {
      if (!rec || !Array.isArray(rec.list) || !rec.list.length) return;
      const cur = Math.max(0, Math.min(rec.list.length - 1, rec.cur | 0));
      S.pages = norm({ list: [], cur, uid: 0, facing: !!rec.facing, numbering: rec.numbering && typeof rec.numbering === "object" ? { style: NUM_STYLES.some(([v]) => v === rec.numbering.style) ? rec.numbering.style : "1", start: Number.isFinite(+rec.numbering.start) ? Math.round(+rec.numbering.start) : 1 } : null });
      let top = 0;
      for (const r of rec.list) { const e = Object.assign(cleanPage(r), { id: +r.id > 0 ? +r.id : 0, name: r.name || "Page", margins: cleanMargins(r.margins), st: null, thumb: null, master: r.master != null ? +r.master : null, mdirty: false }); S.pages.list.push(e); top = Math.max(top, e.id); }
      for (const m of Array.isArray(rec.masters) ? rec.masters : []) { const e = { id: +m.id > 0 ? +m.id : 0, name: String(m.name || "Master"), w: Math.max(1, +m.w || S.w), h: Math.max(1, +m.h || S.h), st: null, thumb: null }; S.pages.masters.push(e); top = Math.max(top, e.id); }
      S.pages.uid = Math.max(top, +rec.uid || 0);
      for (const x of S.pages.list.concat(S.pages.masters)) if (!x.id) x.id = ++S.pages.uid;
      for (let mi = 0; mi < S.pages.masters.length; mi++) {
        const f = rec.masters[mi] && rec.masters[mi].file, b = f && files.get(f); if (!b) continue;
        const home = take();
        try { await openNested(b); S.pages.masters[mi].st = take(); S.pages.masters[mi].thumb = thumbOf(); } catch (e) { say(`master ${mi + 1} could not be read: ${e.message}`); } finally { giveSt(home); }
      }
      for (let i = 0; i < rec.list.length; i++) {
        if (i === cur || !rec.list[i].file) continue;
        const b = files.get(rec.list[i].file); if (!b) continue;
        const home = take();
        try { await openNested(b); S.pages.list[i].st = take(); S.pages.list[i].thumb = thumbOf(); } catch (e) { say(`page ${i + 1} could not be read: ${e.message}`); } finally { giveSt(home); }
      }
      show(); showPanel();
    }

    /* ---------------- the Pages panel ---------------- */
    let panel = null, thumbTimer = 0, fieldTimer = 0;
    function css() {
      if (doc.getElementById("pcpagesCss")) return;
      const s = doc.createElement("style"); s.id = "pcpagesCss";
      s.textContent = ".kx .pgpanel{position:absolute;left:46px;top:70px;bottom:28px;width:184px;z-index:30;display:flex;flex-direction:column;background:var(--pc-panel);border:1px solid var(--pc-line);border-radius:4px;box-shadow:0 4px 18px rgba(0,0,0,.35);font-size:11px;color:var(--pc-text)}"
        + ".kx .pgpanel .pgh{display:flex;gap:4px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--pc-line)}.kx .pgpanel .pgh b{flex:1}"
        + ".kx .pgpanel .pgl{flex:1;overflow:auto;padding:6px;display:flex;flex-direction:column;gap:8px}"
        + ".kx .pgpanel .pgp{cursor:pointer;border:2px solid transparent;border-radius:3px}.kx .pgpanel .pgp.on{border-color:var(--pc-accent)}"
        + ".kx .pgpanel .pgp canvas{width:100%;display:block;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}.kx .pgpanel .pgp .pn{display:flex;gap:4px;padding:2px 1px;color:var(--pc-dim)}.kx .pgpanel .pgp.on .pn{color:var(--pc-text)}"
        + ".kx .pgpanel .pgp .pn b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-weight:500}"
        + ".kx .pgpanel .pgb{display:flex;flex-wrap:wrap;gap:4px;padding:6px;border-top:1px solid var(--pc-line)}.kx .pgpanel .pgb button{padding:2px 6px}.kx .pgpanel .pgb button.arm{background:#a33;color:#fff}"
        + ".kx .pgpanel .pgs{display:flex;gap:2px}.kx .pgpanel .pgs > *{flex:1 1 0;min-width:0}.kx .pgpanel .pgh.pged{background:var(--pc-accent);color:#000}"
        + ".kx .pgpanel .pgm{align-items:center}.kx .pgpanel .pgm select{flex:1 0 110px;min-width:0}.kx .pgpanel .pgms{padding:0 6px 4px;display:flex;flex-direction:column;gap:2px}"
        + ".kx .pgpanel .pgmr{display:flex;gap:4px;align-items:center}.kx .pgpanel .pgmr b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}.kx .pgpanel .pgmr.on b{color:var(--pc-accent)}"
        + ".kx .pgpanel .pgmr .dim{color:var(--pc-dim)}.kx .pgpanel .pgmr button{padding:0 4px}.kx .pgpanel .pgmr button.arm{background:#a33;color:#fff}.kx .pgpanel .pgb input[type=number]{padding:1px 2px}";
      doc.head.appendChild(s);
    }
    function showPanel() {
      if (E.pdfSession && E.pdfSession.get()) { say("this is a PDF's page - its own Pages strip is on the left (File ▸ PDF Pages)"); return; }
      css();
      if (!panel) {
        panel = doc.createElement("div"); panel.className = "pgpanel"; panel.id = "pcPagesPanel"; kx.appendChild(panel);
        // 2.844.0: over the canvas's own corner - below a ribbon / the tool options, right of the tools (it covered the WP / Web View's ribbon)
        if (root.ResizeObserver && E.stage) new root.ResizeObserver(placePanel).observe(E.stage); else if (root.addEventListener) root.addEventListener("resize", placePanel);
      }
      panel.style.display = ""; placePanel(); paint();
    }
    function placePanel() {
      if (!panel || !E.stage || !E.stage.getBoundingClientRect) return;
      const st = E.stage.getBoundingClientRect(), k = kx.getBoundingClientRect(); if (!st.width) return;
      panel.style.top = Math.round(st.top - k.top + 4) + "px"; panel.style.left = Math.round(st.left - k.left + 4) + "px";
    }
    const shown = () => !!(panel && panel.style.display !== "none");
    function hidePanel() { if (panel) panel.style.display = "none"; }
    function paint() {
      if (!shown()) return;
      if (!S.w) { panel.innerHTML = '<div class="pgh"><b>📑 Pages</b><button class="ghost" id="pgHide">✕</button></div><div class="pgl" style="color:var(--pc-dim)">No document open.</div>'; $("pgHide").onclick = hidePanel; return; }
      const pp = P(), list = pp ? pp.list : [Object.assign(guess(S.w, S.h, 150), { id: 0, name: "Page 1", master: null })], cur = pp ? pp.cur : 0;
      const masters = pp ? pp.masters : [], ed = pp ? pp.editing : null, nb = pp ? pp.numbering : { style: "1", start: 1 }, facing = !!(pp && pp.facing);
      const card = (pg, i) => `<div class="pgp${i === cur && ed == null ? " on" : ""}" data-pgi="${i}" draggable="true" title="Click: this page · drag: move · double-click the name: rename"><canvas width="1" height="1"></canvas><div class="pn"><span>${esc(fmtNum(nb.start + i, nb.style))}</span><b data-pgn="${i}">${esc(pg.name)}</b></div><div class="pn" style="font-size:10px">${esc(sizeLabel(pg))}${pg.master != null && masterById(pg.master) ? " · ⌂ " + esc(masterById(pg.master).name) : ""}</div></div>`;
      const rows = spreadsOf(list.length, facing).map((g) => (facing ? `<div class="pgs">${g.length === 1 && g[0] === 0 ? '<div class="pgx"></div>' : ""}${g.map((i) => card(list[i], i)).join("")}${g.length === 1 && g[0] !== 0 ? '<div class="pgx"></div>' : ""}</div>` : card(list[g[0]], g[0]))).join("");
      const curM = list[cur] ? list[cur].master : null;
      panel.innerHTML = `<div class="pgh"><b>📑 Pages</b><span>${list.length}</span><button class="ghost" id="pgHide" title="Hide (Window ▸ Pages shows it again)">✕</button></div>
        ${ed != null && masters[ed] ? `<div class="pgh pged"><b>⌂ ${esc(masters[ed].name)}</b><button class="ghost" id="pgBack" title="Back to the pages (the pages that use this master are made again)">← Pages</button></div>` : ""}
        <div class="pgl" id="pgList">${rows}</div>
        <div class="pgb pgm"><span>Master</span><select id="pgMaster" title="The master this page sits on (its layers under the page's)"><option value="">None</option>${masters.map((m) => `<option value="${m.id}"${m.id === curM ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select><button class="ghost" id="pgMAll" title="This master for every page">All</button><button class="ghost" id="pgMOdd" title="This master for the odd pages (1, 3, 5 … right-hand)">Odd</button><button class="ghost" id="pgMEven" title="This master for the even pages (2, 4, 6 … left-hand)">Even</button></div>
        <div class="pgms">${masters.map((m, mi) => `<div class="pgmr${mi === ed ? " on" : ""}"><span>⌂</span><b data-mmn="${mi}" title="Double-click: rename">${esc(m.name)}</b><span class="dim">${list.filter((x) => x.master === m.id).length} p.</span><button class="ghost" data-mme="${mi}" title="Edit this master - what is on it shows under its pages">✎</button><button class="ghost${armedM === m.id ? " arm" : ""}" data-mmd="${mi}" title="Delete this master (click twice)">🗑</button></div>`).join("")}<button class="ghost" id="pgMAdd" title="A master page: its layers show under every page that uses it (headers, footers, page numbers, a background)">＋ Master</button></div>
        <div class="pgb"><label title="Show and export the pages as spreads (page 1 alone on the right)"><input type="checkbox" id="pgFacing"${facing ? " checked" : ""}> Facing</label><select id="pgNumStyle" title="How page numbers are written">${NUM_STYLES.map(([v, l]) => `<option value="${v}"${v === nb.style ? " selected" : ""}>${esc(l)}</option>`).join("")}</select><input type="number" id="pgNumStart" value="${nb.start}" style="width:44px" title="The first page's number"><button class="ghost" id="pgNumIns" title="Page numbers on every page: format, numbers, position, font, size, colour">#</button></div>
        <div class="pgb"><button class="ghost" id="pgAdd" title="A new page after this one, the same size - its own layers">＋ Page</button><button class="ghost" id="pgDup" title="A copy of this page with its layers">⧉</button><button class="ghost" id="pgUp" title="Move this page up">▲</button><button class="ghost" id="pgDown" title="Move this page down">▼</button><button class="ghost${pp && armed === list[cur].id ? " arm" : ""}" id="pgDel" title="Delete this page (click twice)">🗑</button></div>
        <div class="pgb"><button class="ghost" id="pgSetup" title="This page's size, orientation and resolution">📐 Page setup…</button><button class="ghost" id="pgExport" title="Every page with its layers: PDF, .ai, SVG pages, or a pack for .cdr">⤓ Export…</button></div>`;
      $("pgHide").onclick = hidePanel;
      panel.querySelectorAll("[data-pgi]").forEach((d) => {
        const i = +d.dataset.pgi, pg = list[i];
        const t = i === cur && ed == null ? null : pg.thumb, c = d.querySelector("canvas");
        if (t) { c.width = t.width; c.height = t.height; ctx(c).drawImage(t, 0, 0); } else { const { w, h } = pagePx(pg); c.width = 120; c.height = Math.max(1, Math.round(120 * h / w)); }
        d.onclick = () => { if (pp) go(i); };
        d.ondragstart = (e) => { e.dataTransfer.setData("text/x-bg-page", String(i)); e.dataTransfer.effectAllowed = "move"; };
        d.ondragover = (e) => { if (Array.from(e.dataTransfer.types || []).includes("text/x-bg-page")) { e.preventDefault(); d.style.outline = "2px dashed var(--pc-accent)"; } };
        d.ondragleave = () => { d.style.outline = ""; };
        d.ondrop = (e) => { d.style.outline = ""; const from = +e.dataTransfer.getData("text/x-bg-page"); e.preventDefault(); if (pp && Number.isFinite(from)) move(from, i); };
      });
      panel.querySelectorAll("[data-pgn]").forEach((b) => { b.ondblclick = (e) => { e.stopPropagation(); renameBox(+b.dataset.pgn, b); }; });
      $("pgAdd").onclick = () => add();
      if ($("pgBack")) $("pgBack").onclick = () => closeMaster();
      $("pgMaster").onchange = (e) => assign(e.target.value === "" ? null : +e.target.value, "this");
      const pick = () => ($("pgMaster").value === "" ? null : +$("pgMaster").value);
      $("pgMAll").onclick = () => assign(pick(), "all"); $("pgMOdd").onclick = () => assign(pick(), "odd"); $("pgMEven").onclick = () => assign(pick(), "even");
      $("pgMAdd").onclick = () => addMaster();
      panel.querySelectorAll("[data-mme]").forEach((b) => { b.onclick = () => editMaster(+b.dataset.mme); });
      panel.querySelectorAll("[data-mmd]").forEach((b) => { b.onclick = () => { const mi = +b.dataset.mmd; removeMaster(mi, armedM === (P().masters[mi] || {}).id); }; });
      panel.querySelectorAll("[data-mmn]").forEach((b) => { b.ondblclick = () => { const mi = +b.dataset.mmn, inp = doc.createElement("input"); inp.value = P().masters[mi].name; inp.style.cssText = "width:100%;font-size:11px"; b.replaceWith(inp); inp.focus(); inp.select(); const done = (ok) => { if (ok) renameMaster(mi, inp.value); else paint(); }; inp.onkeydown = (e) => { if (e.key === "Enter") done(true); else if (e.key === "Escape") done(false); e.stopPropagation(); }; inp.onblur = () => done(true); }; });
      $("pgFacing").onchange = (e) => setFacing(e.target.checked);
      $("pgNumStyle").onchange = () => setNumbering($("pgNumStyle").value, $("pgNumStart").value);
      $("pgNumStart").onchange = () => setNumbering($("pgNumStyle").value, $("pgNumStart").value);
      $("pgNumIns").onclick = () => numberDialog();
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
      const pp = P(); if (pp && pp.editing != null) return;
      const cur = pp ? pp.cur : 0, el = panel.querySelector(`[data-pgi="${cur}"] canvas`), t = thumbOf();
      if (el && t) { el.width = t.width; el.height = t.height; ctx(el).drawImage(t, 0, 0); }
    }
    // a document to the front / a layer changed: the strip follows (the page in front's picture a moment later)
    let lastPages;
    const prevLP = E.renderLayersPanel;
    E.renderLayersPanel = function () {
      const r = prevLP.apply(this, arguments);
      if (S.pages !== lastPages) { lastPages = S.pages; if (S.pages && S.pages.list.length > 1 && !(E.pdfSession && E.pdfSession.get())) showPanel(); else paint(); }
      else if (shown()) { clearTimeout(thumbTimer); thumbTimer = setTimeout(curThumb, 700); }
      fieldsSoon();
      return r;
    };
    // 2.800.0: {page} typed into a type layer on a page shows the number (not while the type is being typed) - after any
    // undo step (E.onPush) or a layers-panel repaint from outside
    function fieldsSoon() {
      clearTimeout(fieldTimer);
      fieldTimer = setTimeout(() => {
        const pp = S.pages, a = doc.activeElement;
        if (!pp || pp.editing != null || !pp.list[pp.cur] || (a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && kx.contains(a)) || a.isContentEditable))) return;
        const moved = pinMaster();
        if (resolveOwn(S.layers, pp.cur) || moved) E.refresh();
        if (moved) E.renderLayersPanel();
        if (shown()) curThumb();
      }, 400);
    }
    const prevPush = E.onPush;
    E.onPush = function () { if (prevPush) prevPush.apply(this, arguments); if (S.pages) fieldsSoon(); };
    const prevUndo = E.onUndo;   // 2.801.0: page numbers after an undo / redo too
    E.onUndo = function () { if (prevUndo) prevUndo.apply(this, arguments); if (S.pages) fieldsSoon(); };
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
      S.pages = norm({ list: [], cur: 0, uid: 0 });
      for (let i = 0; i < Math.max(1, n | 0); i++) S.pages.list.push(newEntry(Object.assign({}, c, { name: "Page " + (i + 1) })));
      lastPages = S.pages; showPanel();
      say(`${S.pages.list.length} page(s), ${sizeLabel(c)} (${w} × ${h} px) - each page has its own layers; ⤓ Export… for PDF / .ai / SVG / .cdr`);
      return S.pages;
    }

    const C = E.ui.addCmd;
    C("file.newpages", "New Document with Pages…", "", newDialog, {});
    C("win.pages", "Pages", "", () => (shown() ? hidePanel() : showPanel()), { checked: () => shown() });
    C("page.add", "Add Page", "", () => add(), { enabled: () => !!S.w });
    C("page.master", "New Master Page", "", () => addMaster(), { enabled: () => !!S.w });
    C("page.number", "Page Numbers…", "", () => numberDialog(), { enabled: () => !!S.w });
    const M = (n) => E.ui.MENUS.find(([x]) => x === n);
    const F = M("File"); if (F) { const it = F[1], at = it.indexOf("file.new"); it.splice(at >= 0 ? at + 1 : 0, 0, "file.newpages"); }
    const W = M("Window"); if (W) { const it = W[1], at = it.indexOf("win.panels"); it.splice(at >= 0 ? at + 1 : it.length, 0, "win.pages"); }
    E.pages = { ensure, count, go, add, duplicate, remove, move, rename, setup, eachPage, toBgi, fromBgi, newDocument, newDialog, setupDialog, showPanel, hidePanel, shown,
      addMaster, editMaster, closeMaster, removeMaster, renameMaster, assign, setFacing, setNumbering, insertNumber, numberDialog, settle, masterOut, needsBgi, masterPic: (id, i) => { const m = masterById(id); return m ? masterPic(m, i) : null; },
      masters: () => (P() ? P().masters : []), editing: () => (P() ? P().editing : null), facing: () => !!(P() && P().facing), numbering: () => (P() ? P().numbering : { style: "1", start: 1 }), spreads: () => spreadsOf(count(), !!(P() && P().facing)),
      list: () => (P() ? P().list : []), cur: () => (P() ? P().cur : 0), current: () => (P() ? P().list[P().cur] : null), panel: () => panel };
  }

  const pure = { PAGE_SIZES, DPIS, cleanPage, cleanMargins, pagePx, guess, moveIdx, pageKeys, sizeLabel, DOC_ONLY, NUM_STYLES, fmtNum, resolveTokens, hasTokens, spreadsOf, targets, masterName };
  const api = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCPages = api;
})(typeof window !== "undefined" ? window : globalThis);
