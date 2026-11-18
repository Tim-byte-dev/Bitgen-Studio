/* pcdoctext.js — WORD-PROCESSOR TEXT IN THE IMAGE EDITOR (2.811.0), window.PCDocText.
 *
 * Tim (verbatim): "is there a way to add word editing to image editor? like ms word and export as docx? with all the
 * alignment, text editing/formatting / table options?" + "i would actually like to keep comments, footnotes and mail merge
 * - after we get this right". Release 1 of the plan (HANDOVER "## 2.811.0"): word-processor text frames; then tables,
 * then .docx out / in (+ margins, headers, footers), then comments, footnotes, mail merge.
 *
 *   A DOCUMENT FRAME   a layer of type "doc": L.doc = {html, x, y, w, h, k, top, flow: {id, idx}, auto}. The words are a
 *                      small, cleaned HTML (paragraph styles, runs, lists - sanitize()) laid out by the page itself (the
 *                      browser's own line breaking, justification, lists), drawn onto the layer through an SVG picture
 *                      (foreignObject - Chromium keeps such a canvas readable). k = CSS px -> canvas px (the page's dpi /
 *                      96), so 11 pt is 11 pt on the printed page.
 *   TYPING             the Document Text tool (T group): drag a box = a new frame, click a frame = type in it (the Move
 *                      tool: double-click). The frame turns into a live editable page over the canvas; Esc / a click
 *                      outside ends it - one undo step. The options bar: paragraph style (Normal, Title, Subtitle,
 *                      Heading 1-3, Quote, Code), font, size (pt), bold / italic / underline / strikethrough, sub /
 *                      superscript, text colour, highlight, align left / centre / right / justify, line spacing, space
 *                      before / after, bullets, numbering, indent - / +, clear formatting; the frame's W x H.
 *   FLOW               frames share a story (flow.id; idx 0 holds it): the story is laid out once at the frames' width
 *                      and each frame shows the next run of whole lines (windows() - a line never cut in half). ⤵ Next
 *                      page adds a frame on the next page; a document made with File ▸ New Text Document… adds pages by
 *                      itself while you type (auto) and drops the empty ones it added.
 *
 * Pure (Node + jsdom: scripts/test-doctext811.js): STYLES, CSS, sanitize, bands, windows, ptOf.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const STYLES = [["normal", "Normal", "P"], ["title", "Title", "P"], ["subtitle", "Subtitle", "P"], ["h1", "Heading 1", "H1"], ["h2", "Heading 2", "H2"],
    ["h3", "Heading 3", "H3"], ["quote", "Quote", "BLOCKQUOTE"], ["code", "Code", "PRE"]];
  const BASE_FONT = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";
  const CSS = `.pcdoc{font-family:${BASE_FONT};font-size:11pt;line-height:1.15;color:#000;overflow-wrap:break-word;white-space:normal;text-align:left;outline:none}
.pcdoc p,.pcdoc h1,.pcdoc h2,.pcdoc h3,.pcdoc blockquote,.pcdoc pre{margin:0 0 8pt}
.pcdoc p[data-style="title"]{font-size:26pt;line-height:1.1;margin:0 0 4pt;letter-spacing:-0.3pt}
.pcdoc p[data-style="subtitle"]{font-size:15pt;color:#5a5a5a;margin:0 0 8pt}
.pcdoc h1{font-size:16pt;font-weight:600;color:#2f5496;margin:12pt 0 4pt}
.pcdoc h2{font-size:13pt;font-weight:600;color:#2f5496;margin:8pt 0 4pt}
.pcdoc h3{font-size:12pt;font-weight:600;color:#1f3763;margin:8pt 0 4pt}
.pcdoc blockquote{margin:8pt 24pt;font-style:italic;color:#404040}
.pcdoc pre{font-family:Consolas,'Courier New',monospace;font-size:10pt;white-space:pre-wrap}
.pcdoc ul,.pcdoc ol{margin:0 0 8pt;padding-left:24pt}
.pcdoc li{margin:0}
.pcdoc li>p{margin:0}
.pcdoc a{color:#0563c1;text-decoration:underline}
.pcdoc hr{border:0;border-top:1px solid #999;margin:6pt 0}
.pcdoc table{border-collapse:collapse;margin:0 0 8pt;table-layout:fixed}
.pcdoc td,.pcdoc th{border:1px solid #888;padding:2pt 5pt;vertical-align:top;overflow-wrap:break-word}
.pcdoc th{font-weight:600;background-color:#f2f2f2;text-align:left}
.pcdoc td>p,.pcdoc th>p{margin:0}
.pcdoc sup[data-fn]{font-size:.7em;line-height:0}
.pcdoc span[data-cid]{background:#fff0a0;border-bottom:1px solid #e0b000}
.pcdoc span[data-cid][data-done],.pcnocmt span[data-cid]{background:none;border-bottom:0}
.pcdoc span[data-field]{background:#e3ecfa;border-radius:2px}
.pcfn{font-size:9pt;line-height:1.15}
.pcfn p{margin:0 0 2pt}
.pcfnrule{width:33%;border-top:0.75px solid #555;margin:0 0 3pt}`;
  const TAGS = new Set(["P", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "PRE", "UL", "OL", "LI", "BR", "HR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL",
    "SUB", "SUP", "SPAN", "A", "CODE", "MARK", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "COLGROUP", "COL"]);   // 2.812.0: + colgroup / col (column widths)
  const STYLE_KEYS = ["font-family", "font-size", "font-weight", "font-style", "text-decoration", "text-decoration-line", "color", "background-color",
    "text-align", "line-height", "margin-top", "margin-bottom", "margin-left", "text-indent", "list-style-type", "vertical-align", "width", "border", "border-style", "border-width", "border-color", "padding", "table-layout"];
  const DATA_STYLES = new Set(["title", "subtitle"]);
  const SIZE_WORDS = { "xx-small": 7, "x-small": 7.5, small: 10, medium: 12, large: 13.5, "x-large": 18, "xx-large": 24, "xxx-large": 36 };
  /** a CSS font-size -> pt (null = not one we know) */
  function ptOf(v) {
    const s = String(v || "").trim().toLowerCase(), m = /^([\d.]+)(pt|px|em|rem|%)?$/.exec(s);
    if (SIZE_WORDS[s]) return SIZE_WORDS[s];
    if (!m) return null;
    const n = +m[1], u = m[2] || "px";
    return Math.round((u === "pt" ? n : u === "px" ? n * 0.75 : u === "%" ? n / 100 * 11 : n * 11) * 2) / 2;
  }
  const safeCss = (v) => !/url\s*\(|expression|javascript:|[<>]/i.test(v);
  /** the words kept, everything else out: only TAGS (others unwrapped, their words kept), a few style keys, links to
   *  http(s) / mailto, colspan / rowspan, data-style title / subtitle. FONT -> SPAN, DIV -> P (contentEditable's own). */
  function sanitize(html, document) {
    const d = document || root.document, box = d.createElement("div");
    box.innerHTML = String(html || "");
    const out = d.createElement("div");
    const copy = (src, dst) => {
      for (const n of [...src.childNodes]) {
        if (n.nodeType === 3) { dst.appendChild(d.createTextNode(n.nodeValue)); continue; }
        if (n.nodeType !== 1) continue;
        let tag = n.tagName.toUpperCase();
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME" || tag === "OBJECT" || tag === "IMG" || tag === "SVG") continue;
        if (tag === "FONT") tag = "SPAN";
        if (tag === "DIV") tag = n.closest && n.parentElement && n.parentElement.closest("li") ? "SPAN" : "P";
        if (!TAGS.has(tag)) { copy(n, dst); continue; }
        const e = d.createElement(tag.toLowerCase());
        const st = [];
        if (n.style) for (const k of STYLE_KEYS) { const v = n.style.getPropertyValue(k); if (v && safeCss(v)) st.push(k + ":" + v); }
        if (n.tagName.toUpperCase() === "FONT") {
          const c = n.getAttribute("color"), f = n.getAttribute("face"); if (c && safeCss(c)) st.push("color:" + c); if (f && safeCss(f)) st.push("font-family:" + f);
        }
        if (st.length) e.setAttribute("style", st.join(";"));
        const ds = n.getAttribute && n.getAttribute("data-style"); if (ds && DATA_STYLES.has(ds) && tag === "P") e.setAttribute("data-style", ds);
        if (tag === "A") { const h = n.getAttribute("href") || ""; if (/^(https?:|mailto:)/i.test(h)) e.setAttribute("href", h); }
        // 2.815.0: a footnote's mark (sup data-fn), a comment's words (span data-cid, data-done); 2.816.0: a merge field (span data-field)
        const ga = (a) => (n.getAttribute ? n.getAttribute(a) : null);
        if (tag === "SUP" && /^[\w-]{1,24}$/.test(ga("data-fn") || "")) e.setAttribute("data-fn", ga("data-fn"));
        if (tag === "SPAN" && /^[\w-]{1,24}$/.test(ga("data-cid") || "")) { e.setAttribute("data-cid", ga("data-cid")); if (ga("data-done") === "1") e.setAttribute("data-done", "1"); }
        if (tag === "SPAN" && ga("data-field") && /^[^<>"]{1,60}$/.test(ga("data-field"))) e.setAttribute("data-field", ga("data-field"));
        if (tag === "TD" || tag === "TH") for (const a of ["colspan", "rowspan"]) { const v = +n.getAttribute(a); if (v > 1) e.setAttribute(a, String(Math.min(64, v | 0))); }
        dst.appendChild(e);
        if (tag !== "BR" && tag !== "HR" && tag !== "COL") copy(n, e);
      }
    };
    copy(box, out);
    // loose words at the top level go into paragraphs
    const fixed = d.createElement("div"); let para = null;
    for (const n of [...out.childNodes]) {
      const block = n.nodeType === 1 && /^(P|H1|H2|H3|H4|BLOCKQUOTE|PRE|UL|OL|TABLE|HR)$/.test(n.tagName.toUpperCase());
      if (block) { para = null; fixed.appendChild(n); continue; }
      if (n.nodeType === 3 && !n.nodeValue.trim() && !para) continue;
      if (!para) { para = d.createElement("p"); fixed.appendChild(para); }
      para.appendChild(n);
    }
    for (const p of fixed.querySelectorAll("p,h1,h2,h3,h4,li")) if (!p.childNodes.length) p.appendChild(d.createElement("br"));   // an empty paragraph keeps its line
    const s = fixed.innerHTML;
    return s || "<p><br></p>";
  }
  /** vertical boxes [{top, bottom}] -> the line bands (overlapping boxes merged), sorted */
  function bands(rects) {
    const r = (rects || []).filter((b) => b && b.bottom > b.top).map((b) => ({ top: b.top, bottom: b.bottom })).sort((a, b) => a.top - b.top);
    const out = [];
    for (const b of r) { const l = out[out.length - 1]; if (l && b.top < l.bottom - 0.5) l.bottom = Math.max(l.bottom, b.bottom); else out.push({ top: b.top, bottom: b.bottom }); }
    return out;
  }
  /** each frame's window into the story: [{top, h, lines, overflow}] - whole lines only (a line taller than a frame
   *  still goes in); heights = the frames' heights (CSS px). The last frame's overflow = lines left over. */
  function windows(bs, heights, headAt) {
    const out = []; let i = 0;
    heights.forEach((H0, k) => {
      const top = i < bs.length ? bs[i].top : (bs.length ? bs[bs.length - 1].bottom : 0);
      // 2.812.0: a frame that starts inside a table with a header row shows that row again at its top - less room
      const head = k > 0 && headAt ? headAt(top) : null, H = Math.max(1, H0 - (head ? head.h : 0));
      let j = i;
      while (j < bs.length && (bs[j].bottom - top <= H + 0.5 || j === i)) j++;
      if (i < bs.length && bs[i].bottom - top > H + 0.5 && j === i + 1) { /* one tall line - shown, cut */ }
      out.push({ top, h: H0, lines: j - i, overflow: false, head: head || null });
      i = j;
      if (k === heights.length - 1 && i < bs.length) out[k].overflow = true;
    });
    return out;
  }

  /* 2.815.0: footnotes - the marks numbered in story order; notes no mark points at any more dropped */
  function renumber(html, notes, document) {
    const d = document || root.document, box = d.createElement("div"); box.innerHTML = String(html || "");
    const ids = [], seen = new Set();
    for (const x of box.querySelectorAll("sup[data-fn]")) {
      const id = x.getAttribute("data-fn");
      if (seen.has(id) || !(notes && Object.prototype.hasOwnProperty.call(notes, id))) { x.removeAttribute("data-fn"); if (!x.textContent.trim() || /^\d+$/.test(x.textContent)) x.remove(); continue; }
      seen.add(id); ids.push(id); x.textContent = String(ids.length);
    }
    const kept = {}; for (const id of ids) kept[id] = notes[id];
    return { html: box.innerHTML, ids, notes: kept };
  }
  const escH = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  /** the notes at the foot of a frame: [[number, text]] -> HTML */
  function notesBlock(list) { return list.length ? '<div class="pcfnrule"></div>' + list.map(([n, t]) => `<p><sup>${n}</sup> ${escH(t).replace(/\n/g, "<br>")}</p>`).join("") : ""; }

  /* ================================ the page ================================ */
  const cache = new WeakMap();      // layer -> {key, img, pending} (2.812.0: by the layer itself - ids repeat across pages)
  let measureHost = null;
  function cssOnce(doc) {
    if (doc.getElementById("pcdocCss")) return;
    const s = doc.createElement("style"); s.id = "pcdocCss"; s.textContent = CSS + "\n.pcdocm{position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none}" +
      "\n.pcdocedit{position:absolute;overflow:hidden;outline:1px dashed #2680eb;z-index:6;background:transparent}" +
      "\n.pcdocedit .pcdoc{transform-origin:0 0;caret-color:#2680eb;cursor:text}" +
      "\n.pcdocedit .pcdoc ::selection{background:rgba(38,128,235,.3)}";
    doc.head.appendChild(s);
  }
  /** the story laid out at width wCss: its line bands (CSS px, from its top) */
  function measure(doc, html, wCss) {
    cssOnce(doc);
    if (!measureHost) { measureHost = doc.createElement("div"); measureHost.className = "pcdocm"; doc.body.appendChild(measureHost); }
    measureHost.innerHTML = `<div class="pcdoc" style="width:${wCss}px">${html}</div>`;
    const el = measureHost.firstChild, r0 = el.getBoundingClientRect(), rects = [];
    const walker = doc.createTreeWalker(el, 4 /* SHOW_TEXT */);
    const range = doc.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue.length) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.height > 0) rects.push({ top: r.top - r0.top, bottom: r.bottom - r0.top });
    }
    for (const e of el.querySelectorAll("br,hr,tr,li")) {
      const r = e.getBoundingClientRect(); if (r.height <= 0) continue;
      if (e.tagName === "BR") { const p = e.parentElement; if (p && p.textContent === "") { const pr = p.getBoundingClientRect(); rects.push({ top: pr.top - r0.top, bottom: pr.bottom - r0.top }); } continue; }
      if (e.tagName === "LI") { const fr = e.getClientRects()[0]; if (fr) rects.push({ top: fr.top - r0.top, bottom: Math.min(fr.bottom, fr.top + 2) - r0.top }); continue; }
      rects.push({ top: r.top - r0.top, bottom: r.bottom - r0.top });
    }
    // 2.812.0: tables with a header row (thead) - repeated at the top of a later frame that starts inside them
    const heads = [];
    for (const t of el.querySelectorAll("table")) {
      const th = t.tHead; if (!th || !th.rows.length) continue;
      const tr = t.getBoundingClientRect(), hr = th.getBoundingClientRect();
      const c = t.cloneNode(false); c.style.margin = "0";
      for (const ch of t.children) if (ch.tagName === "COLGROUP" || ch.tagName === "THEAD") c.appendChild(ch.cloneNode(true));
      heads.push({ top: tr.top - r0.top, bottom: tr.bottom - r0.top, headBottom: hr.bottom - r0.top, h: hr.height, html: c.outerHTML });
    }
    // 2.815.0: where each footnote mark sits (story order)
    const refs = [...el.querySelectorAll("sup[data-fn]")].map((x) => ({ id: x.getAttribute("data-fn"), top: x.getBoundingClientRect().top - r0.top }));
    return { bands: bands(rects), height: el.getBoundingClientRect().height, heads, refs };
  }
  function xhtmlOf(doc, html) {
    const box = doc.createElement("div"); box.innerHTML = html;
    const ser = new root.XMLSerializer();
    return [...box.childNodes].map((n) => ser.serializeToString(n)).join("");
  }
  const keyOf = (D) => [D.view || D.html, D.w, D.h, D.k, D.top, D.rep || "", D.fn || "", PCDocText.showComments !== false].join("|");
  /** draw a doc layer from its cached picture; a new picture is made when it changed (then it is drawn again) */
  function draw(g, L) {
    const D = L.doc; if (!D) return;
    if (PCDocText.editing === L.id) return;                            // the live page is over it
    const c = cache.get(L), key = keyOf(D), doc = g.canvas.ownerDocument || root.document;
    if (c && c.img && c.key === key) { g.drawImage(c.img, Math.round(D.x), Math.round(D.y)); return; }
    if (c && c.img) g.drawImage(c.img, Math.round(D.x), Math.round(D.y));   // the old one until the new one is in
    if (c && c.pending === key) return;
    if (!doc || !root.Image) return;
    const k = D.k || 1, wC = D.w / k, hC = D.h / k;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(D.w)}" height="${Math.ceil(D.h)}"><foreignObject x="0" y="0" width="${Math.ceil(D.w)}" height="${Math.ceil(D.h)}">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" class="${PCDocText.showComments === false ? "pcnocmt" : ""}" style="position:relative;width:${wC}px;height:${hC}px;overflow:hidden;transform:scale(${k});transform-origin:0 0"><style>${CSS.replace(/</g, "")}</style>`
      + (D.rep ? `<div class="pcdoc" style="width:${wC}px">${xhtmlOf(doc, D.rep)}</div>` : "")                 // 2.812.0: the repeated header row
      + `<div style="width:${wC}px;height:${Math.max(0, hC - (D.rep ? D.repH || 0 : 0) - (D.fn ? D.fnH || 0 : 0))}px;overflow:hidden"><div class="pcdoc" style="width:${wC}px;margin-top:${-(D.top || 0)}px">${xhtmlOf(doc, D.view || D.html || "")}</div></div>`
      + (D.fn ? `<div class="pcdoc pcfn" style="position:absolute;left:0;top:${hC - (D.fnH || 0)}px;width:${wC}px">${xhtmlOf(doc, D.fn)}</div>` : "")   // 2.815.0: this frame's footnotes
      + `</div></foreignObject></svg>`;
    const img = new root.Image();
    const entry = c || { key: null, img: null, pending: null }; entry.pending = key; cache.set(L, entry);
    img.onload = () => { if (entry.pending !== key) return; entry.img = img; entry.key = key; entry.pending = null; try { root.dispatchEvent(new root.CustomEvent("h3docready", { detail: { id: L.id, L } })); } catch (e) { /* jsdom */ } };
    img.onerror = () => { if (entry.pending === key) entry.pending = null; };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  /** whether every frame picture is up to date (tests wait on this) */
  function ready(layers) { return (layers || []).filter((L) => L.type === "doc" && L.doc).every((L) => { const c = cache.get(L); return c && c.key === keyOf(L.doc) && !c.pending; }); }

  function install(E) {
    const { S, D, doc, win, store, kx } = E;
    if (!doc || !E.ui || !E.ui.addCmd) return;
    cssOnce(doc);
    const say = E.say || (() => {}), sep = E.ui.sep;
    const isDoc = (L) => !!(L && L.type === "doc" && L.doc);
    const kNow = () => { const pg = E.pages && E.pages.current ? E.pages.current() : null; return ((pg && pg.dpi) || 150) / 96; };
    const newId = () => "d" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    // a picture came in: that frame drawn again - on the page in front or on another page (its layer kept there)
    win.addEventListener("h3docready", (e) => {
      for (const pl of places()) { const L = pl.layers.find((x) => x === e.detail.L); if (!L) continue; D.rasterize(L); if (pl.live) { E.refresh(); if (E.renderLayersPanel && !S.drag) E.renderLayersPanel(); } return; }
    });

    /* ---- stories over every page (like pcflow.js) */
    function places() {
      const out = [{ layers: S.layers, live: true, page: E.pages && E.pages.list().length ? E.pages.cur() : 0 }];
      const pp = S.pages; if (!pp || !E.pages) return out;
      pp.list.forEach((pg, i) => { if (pg.st && pg.st.layers && !(i === pp.cur && pp.editing == null)) out.push({ layers: pg.st.layers, live: false, page: i }); });
      return out;
    }
    function stories() {
      const m = new Map();
      for (const pl of places()) for (const L of pl.layers) if (isDoc(L) && L.doc.flow && L.doc.flow.id) { const id = L.doc.flow.id; if (!m.has(id)) m.set(id, []); m.get(id).push({ L, pl }); }
      for (const [, arr] of m) arr.sort((a, b) => (a.L.doc.flow.idx || 0) - (b.L.doc.flow.idx || 0) || a.pl.page - b.pl.page);
      return m;
    }
    const storyOf = (L) => (L && L.doc && L.doc.flow ? stories().get(L.doc.flow.id) || [{ L, pl: places()[0] }] : [{ L, pl: places()[0] }]);
    /** the story laid out again; each frame's window set; drawn again where it changed. -> {overflow, empties} */
    function flowStory(arr) {
      const head = arr[0].L.doc, k = head.k || 1, w = head.w;
      arr.forEach((f, i) => { const d = f.L.doc; d.flow = Object.assign({}, d.flow, { idx: i }); if (i) { d.html = head.html; d.w = w; d.k = k; } });
      // 2.815.0: footnote marks numbered, notes nothing points at dropped
      if (head.notes || /data-fn=/.test(head.html)) { const rn = renumber(head.html, head.notes || {}, doc); if (rn.html !== head.html) { head.html = rn.html; arr.forEach((f, i) => { if (i) f.L.doc.html = head.html; }); } head.notes = rn.notes; }
      // 2.816.0: what the frames show can differ from the story (mail merge's Preview Results - PCDocText.viewOf)
      const view = PCDocText.viewOf ? PCDocText.viewOf(head) : null;
      const m = measure(doc, view || head.html, w / k);
      const headAt = (top) => m.heads.find((t) => top >= t.headBottom - 0.5 && top < t.bottom - 0.5) || null;
      // each frame keeps room at its foot for the notes of the marks it shows (worked out again until it settles)
      let fnH = arr.map(() => 0), wins = null, fnOf = arr.map(() => []);
      for (let it = 0; it < 5; it++) {
        wins = windows(m.bands, arr.map((f, i) => Math.max(12, f.L.doc.h / k - fnH[i])), headAt);
        fnOf = arr.map(() => []);
        m.refs.forEach((r, n) => { let fi = wins.findIndex((wv, i) => i === wins.length - 1 || r.top < wins[i + 1].top - 0.5); if (fi < 0) fi = wins.length - 1; fnOf[fi].push([n + 1, (head.notes || {})[r.id]]); });
        if (!m.refs.length) break;
        const nh = fnOf.map((l) => (l.length ? measure(doc, `<div class="pcfn">${notesBlock(l)}</div>`, w / k).height + 4 : 0));
        if (nh.every((v, i) => Math.abs(v - fnH[i]) < 1)) break;
        fnH = nh;
      }
      let changed = false;
      arr.forEach((f, i) => {
        const d = f.L.doc, t = wins[i].top; if (d.top !== t) { d.top = t; changed = true; } d.lines = wins[i].lines;
        if (wins[i].head) { d.rep = wins[i].head.html; d.repH = wins[i].head.h; } else { delete d.rep; delete d.repH; }
        if (view) { if (d.view !== view) changed = true; d.view = view; } else if (d.view) { delete d.view; changed = true; }
        if (fnOf[i].length) { const fh = notesBlock(fnOf[i]); if (d.fn !== fh) changed = true; d.fn = fh; d.fnH = fnH[i]; } else if (d.fn) { delete d.fn; delete d.fnH; changed = true; }
        D.rasterize(f.L);                          // 2.812.0: frames on other pages too (they were left stale)
      });
      const last = wins[wins.length - 1];
      return { overflow: !!(last && last.overflow), empties: arr.filter((f, i) => i > 0 && wins[i].lines === 0), changed };
    }
    let busy = false;
    function reflow(onlyId) {
      if (busy || !S.w) return; busy = true;
      try {
        for (const [id, arr] of stories()) {
          if (onlyId && id !== onlyId) continue;
          let r = flowStory(arr);
          // auto pages: a document made with New Text Document grows / shrinks its own pages
          if (arr[0].L.doc.auto && E.pages && !editing) {
            let guard = 0;
            while (r.overflow && guard++ < 40) { if (!addPageFrame(arr[arr.length - 1])) break; arr.length = 0; arr.push(...stories().get(id)); r = flowStory(arr); }
            dropEmptyAuto(arr);
          }
        }
      } catch (e) { say("document text: " + e.message); }
      finally { busy = false; }
      E.refresh();
    }
    function addPageFrame(lastF) {
      if (!E.pages) return false;
      const pp = E.pages.ensure(), back = E.pages.cur(), d0 = lastF.L.doc;
      if (lastF.pl.page !== back) return false;          // only from the page in front (pages hold their own layers)
      const at = back + 1;
      if (at < pp.list.length) E.pages.go(at); else E.pages.add();
      const F = makeFrame(d0.x, d0.y, d0.w, d0.h, { flow: { id: d0.flow.id, idx: (d0.flow.idx || 0) + 1 }, auto: true, html: d0.html, k: d0.k });
      S.layers.push(F); S.layers = D.normalize(S.layers); S.active = S.layers.indexOf(F); D.rasterize(F);
      E.pages.go(back);
      return true;
    }
    function dropEmptyAuto(arr) {
      // the auto pages at the end that hold nothing but their empty frame go again (never the first)
      const pp = S.pages; if (!pp || !E.pages) return;
      for (let i = arr.length - 1; i > 0; i--) {
        const f = arr[i]; if (!f.L.doc.auto || f.L.doc.lines) break;
        if (f.pl.live) break;
        const st = pp.list[f.pl.page] && pp.list[f.pl.page].st; if (!st) break;
        const others = st.layers.filter((x) => x !== f.L && x.name !== "Background");
        if (others.length) { st.layers.splice(st.layers.indexOf(f.L), 1); continue; }
        if (E.pages.remove) E.pages.remove(f.pl.page, true);
      }
    }
    let timer = 0;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => { if (!editing) reflow(); }, 250); };
    const prevPush = E.onPush; E.onPush = function () { if (prevPush) prevPush.apply(this, arguments); soon(); };
    const prevUndo = E.onUndo; E.onUndo = function () { if (prevUndo) prevUndo.apply(this, arguments); soon(); };

    /* ---- frames */
    function makeFrame(x, y, w, h, more) {
      const L = E.makeLayer("WP layer", S.w, S.h, "doc");   // 2.829.0 (Tim: "make the word processor a wp layer") - was "Document text"
      L.doc = Object.assign({ html: "<p><br></p>", x: Math.round(x), y: Math.round(y), w: Math.max(40, Math.round(w)), h: Math.max(30, Math.round(h)), k: kNow(), top: 0, flow: { id: newId(), idx: 0 } }, more || {});
      return L;
    }
    function addFrame(x, y, w, h, more, startEdit) {
      const L = makeFrame(x, y, w, h, more);
      D.rasterize(L);
      E.addLayer(L, "new document frame", false);
      if (startEdit) begin(L);
      return L;
    }

    /* ---- typing: the live page over the frame */
    let editing = null, before = null, overlay = null, ed = null, savedRange = null, edTimer = 0, startHtml = "";
    PCDocText.editing = null;
    function place() {
      if (!overlay || !editing) return;
      const d = editing.doc, z = S.zoom, k = d.k || 1;
      overlay.style.left = (S.panX + d.x * z) + "px"; overlay.style.top = (S.panY + d.y * z) + "px";
      overlay.style.width = (d.w * z) + "px"; overlay.style.height = (d.h * z) + "px";
      ed.style.width = (d.w / k) + "px"; ed.style.transform = `scale(${k * z})`;
      ed.style.minHeight = (d.h / k) + "px";
    }
    function begin(L) {
      if (!isDoc(L)) return;
      if (editing === L) return;
      end();
      const arr = storyOf(L), head = arr[0].L;
      before = E.snapStruct(); editing = L; PCDocText.editing = L.id; startHtml = head.doc.html;
      overlay = doc.createElement("div"); overlay.className = "pcdocedit";
      ed = doc.createElement("div"); ed.className = "pcdoc"; ed.contentEditable = "true"; ed.spellcheck = true; ed.innerHTML = head.doc.html;
      overlay.appendChild(ed); E.stage.appendChild(overlay);
      // the editor's own canvas handlers (focus to the stage, pointer capture, its right-click menu) stay out of the page
      for (const t of ["pointerdown", "pointermove", "pointerup", "dblclick", "contextmenu", "wheel"]) overlay.addEventListener(t, (e) => { if (t !== "wheel" || !(e.ctrlKey || e.metaKey)) e.stopPropagation(); });
      try { doc.execCommand("defaultParagraphSeparator", false, "p"); doc.execCommand("styleWithCSS", false, true); } catch (e) { /* older */ }
      place();
      overlay.scrollTop = (L.doc.top || 0) * (L.doc.k || 1) * S.zoom;
      D.rasterize(L); E.refresh();
      ed.addEventListener("input", () => { clearTimeout(edTimer); edTimer = setTimeout(live, 350); });
      ed.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(); return; }
        // 2.812.0: Tab never leaves the page - in a table the next cell (pcdoctable.js), else a wide space
        if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); if (!(E.docText && E.docText.tab && E.docText.tab(e.shiftKey))) doc.execCommand("insertText", false, "\u2003\u2003"); return; }
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          const k = e.key.toLowerCase(), map = { b: "bold", i: "italic", u: "underline", l: "justifyLeft", e: "justifyCenter", r: "justifyRight", j: "justifyFull" };
          if (map[k] && !e.shiftKey) { e.preventDefault(); exec(map[k]); return; }
          if (k === "z" || k === "y") { e.stopPropagation(); return; }     // the page's own undo while typing
        }
        e.stopPropagation();
      });
      ed.addEventListener("paste", (e) => {
        const dt = e.clipboardData; if (!dt) return;
        const h = dt.getData("text/html"), t = dt.getData("text/plain");
        e.preventDefault();
        if (h) doc.execCommand("insertHTML", false, sanitize(h, doc));
        else doc.execCommand("insertText", false, t || "");
      });
      doc.addEventListener("selectionchange", keepSel);
      setTimeout(() => { if (!ed) return; try { ed.focus({ preventScroll: true }); } catch (e) { ed.focus(); } }, 0);   // 2.829.0: ended before it ran (begin + end at once) = nothing to focus
      if (S.tool !== "doctext") E.setTool("doctext"); else E.renderOptions();
      say("typing in the WP layer - Esc or a click outside it ends (one undo step)");
    }
    function keepSel() { const s = doc.getSelection(); if (s && s.rangeCount && ed && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); }
    function live() {
      if (!editing || !ed) return;
      const arr = storyOf(editing), head = arr[0].L;
      head.doc.html = sanitizeLight(ed.innerHTML);
      flowStory(arr.map((f) => f)); E.refresh();
    }
    const sanitizeLight = (h) => sanitize(h, doc);
    function end() {
      if (!editing) return;
      clearTimeout(edTimer);
      const L = editing, arr = storyOf(L), head = arr[0].L;
      head.doc.html = sanitizeLight(ed.innerHTML);
      doc.removeEventListener("selectionchange", keepSel);
      overlay.remove(); overlay = null; ed = null; savedRange = null;
      editing = null; PCDocText.editing = null;
      const changed = head.doc.html !== startHtml;
      reflow(head.doc.flow && head.doc.flow.id);
      for (const f of arr) if (f.pl.live) D.rasterize(f.L);
      if (changed && before) E.push({ t: "struct", before, after: E.snapStruct(), label: "document text" });
      before = null;
      E.refresh(); E.renderLayersPanel(); if (S.tool === "doctext") E.renderOptions();
    }
    E.overlayHooks.push(() => { if (editing) place(); });

    /* ---- formatting (on the live page's selection) */
    function restoreSel() {
      if (!ed) return false;
      const s = doc.getSelection();
      // the caret is still in the page (a key, a bar button that keeps the focus): leave it where it is - the kept
      // range is only for after a dropdown / colour box took the focus
      if (doc.activeElement === ed && s && s.rangeCount && ed.contains(s.anchorNode)) return true;
      try { ed.focus({ preventScroll: true }); } catch (e) { ed.focus(); }
      if (savedRange && s) { s.removeAllRanges(); s.addRange(savedRange); }
      return true;
    }
    /** the selection as character counts from the page's start (they survive the page moving its nodes about) */
    function textSel() {
      const s = doc.getSelection(); if (!s || !s.rangeCount || !ed.contains(s.anchorNode)) return null;
      const n = (node, off) => { const r = doc.createRange(); r.setStart(ed, 0); try { r.setEnd(node, off); } catch (e) { return 0; } return r.toString().length; };
      return [n(s.anchorNode, s.anchorOffset), n(s.focusNode, s.focusOffset)];
    }
    function pointAt(k) {
      const w = doc.createTreeWalker(ed, 4); let left = k, last = null;
      for (let t = w.nextNode(); t; t = w.nextNode()) { last = t; if (left <= t.nodeValue.length) return [t, left]; left -= t.nodeValue.length; }
      return last ? [last, last.nodeValue.length] : [ed, 0];
    }
    function setTextSel(at) { try { const a = pointAt(at[0]), f = pointAt(at[1]); doc.getSelection().setBaseAndExtent(a[0], a[1], f[0], f[1]); } catch (e) { /* fine */ } }
    /** a list made inside a paragraph (<p><ul>) is lifted out of it */
    function tidyLists() {
      const s = doc.getSelection(), keep = s && s.rangeCount ? [s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset] : null;
      let moved = false;
      for (const l of ed.querySelectorAll("p > ul, p > ol")) { const pa = l.parentElement; if ([...pa.childNodes].every((n) => n === l || (n.nodeType === 3 && !n.nodeValue.trim()) || n.nodeName === "BR")) { pa.replaceWith(l); moved = true; } }
      if (moved && keep && ed.contains(keep[0])) { try { s.setBaseAndExtent(keep[0], keep[1], keep[2], keep[3]); } catch (e) { /* fine */ } }   // the nodes moved - the caret goes back where it was
    }
    function exec(cmd, val) { if (!restoreSel()) return say("click into a document frame first"); try { doc.execCommand("styleWithCSS", false, true); } catch (e) { /* older */ } const lists = /List$|dent$/.test(cmd), at = lists ? textSel() : null;
      doc.execCommand(cmd, false, val);
      if (lists) { tidyLists(); if (at) setTextSel(at); }   // the page puts the caret at the start of the list item - put it back (the words did not move)
      keepSel(); clearTimeout(edTimer); edTimer = setTimeout(live, 200); }
    function blocksInSel() {
      const s = doc.getSelection(); if (!ed || !s || !s.rangeCount) return [];
      const r = s.getRangeAt(0), out = [];
      for (const b of ed.querySelectorAll("p,h1,h2,h3,h4,blockquote,pre,li")) if (r.intersectsNode(b) && !(b.tagName !== "LI" && b.querySelector("p,h1,h2,h3,li"))) out.push(b);
      if (!out.length) { let n = s.anchorNode; while (n && n !== ed) { if (n.nodeType === 1 && /^(P|H1|H2|H3|H4|BLOCKQUOTE|PRE|LI)$/.test(n.tagName)) { out.push(n); break; } n = n.parentNode; } }
      return out;
    }
    function blockStyle(prop, val) { if (!restoreSel()) return; for (const b of blocksInSel()) b.style.setProperty(prop, val); keepSel(); live(); }
    function setStyle(id) {
      const st = STYLES.find((x) => x[0] === id); if (!st || !restoreSel()) return;
      doc.execCommand("formatBlock", false, st[2]);
      for (const b of blocksInSel()) { if (b.tagName === "P") { if (DATA_STYLES.has(id)) b.setAttribute("data-style", id); else b.removeAttribute("data-style"); } }
      keepSel(); live();
    }
    function setSize(pt) {
      if (!restoreSel()) return;
      doc.execCommand("styleWithCSS", false, true); doc.execCommand("fontSize", false, "7");
      for (const e of ed.querySelectorAll('[style*="xxx-large"],font[size="7"]')) { if (e.tagName === "FONT") { const sp = doc.createElement("span"); sp.style.fontSize = pt + "pt"; while (e.firstChild) sp.appendChild(e.firstChild); e.replaceWith(sp); } else e.style.fontSize = pt + "pt"; }
      keepSel(); live();
    }
    function indent(dir) {
      if (!restoreSel()) return;
      const bs = blocksInSel();
      if (bs.some((b) => b.tagName === "LI")) { doc.execCommand(dir > 0 ? "indent" : "outdent"); }
      else for (const b of bs) { const cur = parseFloat(b.style.marginLeft) || 0; const v = Math.max(0, cur + dir * 18); b.style.marginLeft = v ? v + "pt" : ""; }
      keepSel(); live();
    }
    function current() {
      const s = doc.getSelection(); let n = s && s.anchorNode; if (!ed || !n || !ed.contains(n)) return null;
      if (n.nodeType === 3) n = n.parentElement;
      const cs = win.getComputedStyle(n), b = blocksInSel()[0];
      const style = b ? (b.tagName === "P" ? (b.getAttribute("data-style") || "normal") : ({ H1: "h1", H2: "h2", H3: "h3", BLOCKQUOTE: "quote", PRE: "code" }[b.tagName] || "normal")) : "normal";
      return { size: ptOf(cs.fontSize), font: (cs.fontFamily || "").split(",")[0].replace(/["']/g, "").trim(), style, align: b ? win.getComputedStyle(b).textAlign : "left" };
    }

    /* ---- the tool + its bar */
    const FONTS = Object.keys(D.FONT_STACK || {}).filter((f) => !/^(serif|sans-serif|monospace)$/.test(f));
    const BTN = (id, label, title) => `<button class="ghost pdq" data-dq="${id}" title="${title}">${label}</button>`;
    let drag = null;
    E.tools.doctext = {
      id: "doctext", name: "Document Text", cursor: "text",
      options() {
        const L = E.layer(), dd = isDoc(L) ? L.doc : null, c = editing ? current() : null;
        const sizes = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
        return `<label title="Paragraph style"><select id="pdqStyle">${STYLES.map(([id, n]) => `<option value="${id}"${c && c.style === id ? " selected" : ""}>${n}</option>`).join("")}</select></label>`
          + `<label title="Font"><select id="pdqFont" class="h3-font"><option value="">Font…</option>${FONTS.map((f) => `<option${c && c.font === f ? " selected" : ""}>${f}</option>`).join("")}</select></label>`
          + `<label title="Size (pt)"><select id="pdqSize">${sizes.map((s) => `<option${(c && c.size ? c.size : 11) === s ? " selected" : ""}>${s}</option>`).join("")}${c && c.size && !sizes.includes(c.size) ? `<option selected>${c.size}</option>` : ""}</select></label>`
          + BTN("bold", "<b>B</b>", "Bold (Ctrl+B)") + BTN("italic", "<i>I</i>", "Italic (Ctrl+I)") + BTN("underline", "<u>U</u>", "Underline (Ctrl+U)") + BTN("strikeThrough", "<s>S</s>", "Strikethrough")
          + BTN("subscript", "x₂", "Subscript") + BTN("superscript", "x²", "Superscript")
          + `<label title="Text colour"><input type="color" id="pdqColor" value="#000000"></label><label title="Highlight"><input type="color" id="pdqHi" value="#ffff00"></label>`
          + `<span class="sep"></span>` + BTN("justifyLeft", "⯇≡", "Align left (Ctrl+L)") + BTN("justifyCenter", "≡", "Centre (Ctrl+E)") + BTN("justifyRight", "≡⯈", "Align right (Ctrl+R)") + BTN("justifyFull", "☰", "Justify (Ctrl+J)")
          + `<label title="Line spacing"><select id="pdqLine"><option value="">↕</option>${["1", "1.15", "1.5", "2", "2.5", "3"].map((v) => `<option>${v}</option>`).join("")}</select></label>`
          + `<label title="Space before / after the paragraph (pt)"><select id="pdqSpace"><option value="">¶ space</option><option value="0,0">0 / 0</option><option value="0,8">0 / 8</option><option value="6,6">6 / 6</option><option value="12,12">12 / 12</option><option value="12,0">12 / 0</option></select></label>`
          + BTN("insertUnorderedList", "•≡", "Bullets") + BTN("insertOrderedList", "1≡", "Numbering") + BTN("outdent", "⇤", "Decrease indent") + BTN("indent", "⇥", "Increase indent") + BTN("removeFormat", "⌫A", "Clear formatting")
          + `<span class="sep"></span>` + (dd ? `<label title="Frame width (px)">W <input type="number" id="pdqW" min="40" value="${Math.round(dd.w)}" style="width:62px"></label><label title="Frame height (px)">H <input type="number" id="pdqH" min="30" value="${Math.round(dd.h)}" style="width:62px"></label>`
            + `<button class="ghost" id="pdqNext" title="Continue this story in a frame on the next page (a new page if this is the last)">⤵ Next page</button>` : `<span style="color:var(--pc-dim)">drag a box to make a document frame - or File ▸ New Text Document…</span>`);
      },
      bindOptions(o) {
        o.querySelectorAll("[data-dq]").forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { const id = b.dataset.dq; if (id === "indent" || id === "outdent") indent(id === "indent" ? 1 : -1); else if (id === "removeFormat") { exec("removeFormat"); setStyle("normal"); } else exec(id); }; });
        const q = (id) => o.querySelector("#" + id);
        q("pdqStyle").onchange = (e) => setStyle(e.target.value);
        q("pdqFont").onchange = (e) => { const f = e.target.value; if (f) exec("fontName", (D.FONT_STACK && D.FONT_STACK[f]) || f); };
        q("pdqSize").onchange = (e) => setSize(+e.target.value);
        q("pdqColor").onchange = (e) => exec("foreColor", e.target.value);
        q("pdqHi").onchange = (e) => exec("hiliteColor", e.target.value);
        q("pdqLine").onchange = (e) => { if (e.target.value) blockStyle("line-height", e.target.value); };
        q("pdqSpace").onchange = (e) => { if (!e.target.value) return; const [a, b] = e.target.value.split(","); if (!restoreSel()) return; for (const bl of blocksInSel()) { bl.style.marginTop = a + "pt"; bl.style.marginBottom = b + "pt"; } keepSel(); live(); };
        const L = E.layer();
        if (q("pdqW")) q("pdqW").onchange = (e) => resize(L, +e.target.value, null);
        if (q("pdqH")) q("pdqH").onchange = (e) => resize(L, null, +e.target.value);
        if (q("pdqNext")) q("pdqNext").onclick = () => nextPage(L);
      },
      down(e, fx, fy) {
        const hit = frameAt(fx, fy);
        if (hit) { if (editing === hit) return false; E.setActive(S.layers.indexOf(hit)); begin(hit); return false; }
        if (editing) { end(); return false; }
        drag = { x0: fx, y0: fy, x1: fx, y1: fy };
      },
      move(e, fx, fy) { if (drag) { drag.x1 = fx; drag.y1 = fy; E.drawOverlay(); } },
      up() {
        const d = drag; drag = null; E.drawOverlay(); if (!d) return;
        let x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
        if (w < 8 || h < 8) { w = Math.min(S.w - x, Math.max(200, S.w * 0.5)); h = Math.min(S.h - y, Math.max(120, S.h * 0.3)); }
        addFrame(x, y, w, h, null, true);
      },
      key(e) { if (e.key === "Escape" && editing) { end(); return true; } return false; },
      leave() { end(); drag = null; },
    };
    E.overlayHooks.push((g, px) => {
      if (drag) { g.save(); g.strokeStyle = "#2680eb"; g.lineWidth = px; g.setLineDash([4 * px, 3 * px]); g.strokeRect(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0)); g.restore(); }
      if (S.tool === "doctext" || S.tool === "move") {
        for (const L of S.layers) if (isDoc(L) && L.visible !== false && L !== editing) {
          const d = L.doc; g.save(); g.strokeStyle = L === E.layer() ? "rgba(38,128,235,.9)" : "rgba(38,128,235,.35)"; g.lineWidth = px; g.setLineDash([3 * px, 3 * px]); g.strokeRect(d.x, d.y, d.w, d.h);
          if (d.flow && storyOf(L).length && d.lines !== undefined) { const arr = storyOf(L); if (arr[arr.length - 1].L === L && arr.length && overflowOf(arr)) { g.fillStyle = "#e5484d"; g.fillRect(d.x + d.w - 9 * px, d.y + d.h - 9 * px, 9 * px, 9 * px); } }
          g.restore();
        }
      }
    });
    const overflowOf = (arr) => { try { const head = arr[0].L.doc, k = head.k || 1, m = measure(doc, head.html, head.w / k), w = windows(m.bands, arr.map((f) => f.L.doc.h / k)); return w[w.length - 1].overflow; } catch (e) { return false; } };
    function frameAt(x, y) { for (let i = S.layers.length - 1; i >= 0; i--) { const L = S.layers[i]; if (isDoc(L) && L.visible !== false) { const d = L.doc; if (x >= d.x && y >= d.y && x <= d.x + d.w && y <= d.y + d.h) return L; } } return null; }
    // the Move tool: a double-click on a document frame types in it
    E.stage.addEventListener("dblclick", (e) => { if (S.tool !== "move") return; const [x, y] = E.pos(e), L = frameAt(x, y); if (L) { e.preventDefault(); e.stopPropagation(); E.setActive(S.layers.indexOf(L)); begin(L); } }, true);
    // 2.836.0 (Tim: "if user clicks a wp layer the go back to word processing mode"): a click (no drag) on a WP frame with the
    // Move tool / no tool, or a click on a WP layer's row in Layers = the Document Text tool + typing in it (a drag still moves it)
    const wpMode = (L) => { if (!isDoc(L) || editing === L) return; if (S.tool !== "doctext" && E.setTool) E.setTool("doctext"); E.setActive(S.layers.indexOf(L)); begin(L); say("📄 word processing - typing in " + (L.name || "the WP layer")); };
    let wpDown = null;
    win.addEventListener("pointerdown", (e) => { wpDown = E.stage.contains(e.target) && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && ["move", "none", "", null, undefined].includes(S.tool) ? { x: e.clientX, y: e.clientY } : null; }, true);
    win.addEventListener("pointerup", (e) => {                              // the window's capture: the tools stop the stage's
      const d = wpDown; wpDown = null; if (!d || editing || !E.stage.contains(e.target) || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
      const [x, y] = E.pos(e), L = frameAt(x, y); if (L) setTimeout(() => wpMode(L), 0);
    }, true);
    doc.addEventListener("click", (e) => {
      const row = e.target && e.target.closest ? e.target.closest(".kxlayer[data-i]") : null;
      if (!row || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.target.closest("button, input, .eye, .lk, [data-eye], [data-lock]")) return;
      const L = S.layers[+row.dataset.i]; if (isDoc(L)) setTimeout(() => wpMode(L), 0);
    });
    // a press outside the live page ends it
    E.stage.addEventListener("pointerdown", (e) => { if (editing && overlay && !overlay.contains(e.target) && S.tool !== "doctext") end(); }, true);
    function resize(L, w, h) {
      if (!isDoc(L)) return;
      const arr = storyOf(L);
      E.structOp("frame size", () => { for (const f of arr) { if (w) f.L.doc.w = Math.max(40, Math.round(w)); if (h && f.L === L) f.L.doc.h = Math.max(30, Math.round(h)); } });
      reflow(L.doc.flow && L.doc.flow.id);
    }
    function nextPage(L) {
      if (!isDoc(L)) return;
      if (!E.pages) return say("pages are not loaded");
      end();
      const arr = storyOf(L), last = arr[arr.length - 1];
      if (last.L !== L) return say("this story already goes on in a later frame - pick its last frame");
      const d0 = L.doc, pp = E.pages.ensure(), cur = E.pages.cur();
      if (cur >= pp.list.length - 1) E.pages.add(); else E.pages.go(cur + 1);
      const F = addFrame(d0.x, d0.y, d0.w, d0.h, { flow: { id: d0.flow.id, idx: (d0.flow.idx || 0) + 1 }, html: d0.html, k: d0.k }, false);
      reflow(d0.flow.id);
      E.setActive(S.layers.indexOf(F));
      say(`the story goes on here - frame ${arr.length + 1}, page ${E.pages.cur() + 1}`);
    }

    /* ---- File ▸ New Text Document… */
    function newTextDocument() {
      if (!E.pages) return say("pages are not loaded");
      const SIZES = (win.PCPages && win.PCPages.PAGE_SIZES) || [["A4", 210, 297], ["Letter", 215.9, 279.4]];
      E.ui.dialog("New Text Document", `<div class="kxrow"><span>Page</span><select id="pdnSize">${SIZES.map(([n]) => `<option${n === "A4" ? " selected" : ""}>${n}</option>`).join("")}</select>
        <select id="pdnOrient"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
        <div class="kxrow"><span>Margins (mm)</span><input type="number" id="pdnMargin" value="25" min="0" max="80" style="width:70px"></div>
        <div class="kxrow"><span>Resolution</span><select id="pdnDpi"><option>96</option><option selected>150</option><option>200</option><option>300</option></select></div>
        <div class="kxrow" style="color:var(--pc-dim)">One frame inside the margins; pages are added as you type.</div>`, (dlg) => {
        const name = dlg.querySelector("#pdnSize").value, sz = SIZES.find((s) => s[0] === name) || SIZES[0], dpi = +dlg.querySelector("#pdnDpi").value || 150, mm = Math.max(0, +dlg.querySelector("#pdnMargin").value || 0);
        E.pages.newDocument({ preset: name, wmm: sz[1], hmm: sz[2], orient: dlg.querySelector("#pdnOrient").value, dpi }, 1, "Document");
        const m = Math.round(mm / 25.4 * dpi);
        E.setTool("doctext");
        addFrame(m, m, S.w - 2 * m, S.h - 2 * m, { auto: true, k: dpi / 96 }, true);
      }, { okLabel: "📄 Create" });
    }
    E.ui.addCmd("file.newtextdoc", "📄 New Text Document…", "", newTextDocument, null, ["File", "file.new"]);
    E.ui.addCmd("layer.newdocframe", "📄 WP Layer (word processor)", "", () => { E.setTool("doctext"); say("drag a box on the canvas for the WP layer's frame - then type"); });
    // 2.829.0 (Tim: "make the word processor a wp layer that the user can edit and change it's position in the stack"): the WP layer
    // in Layer ▸ New, ✎ Type in it on the right-click menus (pcui's Layers row: its thumbnail double-clicked types in it too)
    { const lm = (E.ui.MENUS || []).find(([n]) => n === "Layer"), nw = lm && lm[1].find((x) => x && x.label === "New"); if (nw && !nw.items.includes("layer.newdocframe")) nw.items.splice(nw.items.indexOf("layer.newgroup") + 1, 0, "layer.newdocframe"); }
    E.ui.addCmd("layer.docedit", "✎ Type in This WP Layer", "", () => { const L = E.layer(); if (isDoc(L)) begin(L); }, { enabled: () => isDoc(E.layer()) });
    E.ui.layerCtxItems = (E.ui.layerCtxItems || []).concat(["layer.docedit"]);
    E.docText = { wpMode, ed: () => ed, restoreSel, keepSel, live, exec, sanitize: (h) => sanitize(h, doc), begin, end, reflow, editing: () => editing, addFrame, nextPage, newTextDocument, frameAt, ready: () => ready(S.layers), storyOf: (L) => storyOf(L).map((f) => f.L) };
  }

  const PCDocText = { STYLES, CSS, sanitize, bands, windows, ptOf, measure, draw, ready, install, renumber, notesBlock, editing: null, showComments: true, viewOf: null };
  if (typeof module !== "undefined" && module.exports) module.exports = PCDocText;
  if (root && root.document) root.PCDocText = PCDocText;
})(typeof window !== "undefined" ? window : globalThis);
