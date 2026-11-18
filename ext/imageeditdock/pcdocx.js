/* pcdocx.js — DOCUMENT TEXT AS A WORD FILE (.docx) AND BACK (2.814.0), window.PCDocx.
 *
 * Tim (verbatim): "is there a way to add word editing to image editor? like ms word and export as docx? with all the
 * alignment, text editing/formatting / table options?" then "lets do next" - the WORD PLAN's step 3 (HANDOVER "## 2.811.0"):
 * the document text (pcdoctext.js / pcdoctable.js) saved as a .docx with its page size, margins, header and footer, and a
 * .docx opened as a new text document.
 *
 *   SAVE    File ▸ Export ▸ Word Document (.docx)… - the story of the picked document frame (else the first one) is
 *           turned into a plain model (toModel - paragraphs with their style, alignment, spacing, indent, list level and
 *           runs; tables with column widths, header rows, merged cells, shading, borders), the page (its size, the
 *           first frame's place = the margins) and the master's type layers: those in the top fifth of the page = the
 *           header, the bottom fifth = the footer ({page} / {pages} = Word's own page fields). The server writes it
 *           (lib/docxFiles.js, `docx`) into the project's docs folder and the page downloads it.
 *   OPEN    File ▸ Open Word Document (.docx)… - the server reads it (`mammoth`) into the same cleaned HTML; a new
 *           text document (the page size + margins asked) gets one frame holding it, pages added as it needs.
 *
 * Word lays pages out itself - its page breaks can fall a line or two away from bitGen's.
 * Pure (Node + jsdom: scripts/test-docx814.js): toModel, runsOf, pageOf, headFoot, splitTokens, ptOf.
 */
(function (root) {
  "use strict";
  const BLOCK = new Set(["P", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "PRE"]);
  const STYLE_OF = { H1: "h1", H2: "h2", H3: "h3", H4: "h3", BLOCKQUOTE: "quote", PRE: "code" };
  /** a CSS length -> pt (null = none / unknown) */
  function ptOf(v) {
    const m = /^(-?[\d.]+)(pt|px|em|rem|%)?$/.exec(String(v || "").trim().toLowerCase());
    if (!m) return null;
    const n = +m[1], u = m[2] || "px";
    return Math.round((u === "pt" ? n : u === "px" ? n * 0.75 : u === "%" ? n / 100 * 11 : n * 11) * 10) / 10;
  }
  const firstFont = (f) => String(f || "").split(",")[0].trim().replace(/^['"]|['"]$/g, "") || null;
  const isBold = (w) => w === "bold" || w === "bolder" || +w >= 600;
  /** a run's look from one element over the one it sits in */
  function lookOf(el, base) {
    const o = Object.assign({}, base), tag = el.tagName, st = el.style || {};
    if (tag === "B" || tag === "STRONG") o.b = true;
    if (tag === "I" || tag === "EM") o.i = true;
    if (tag === "U") o.u = true;
    if (tag === "S" || tag === "STRIKE" || tag === "DEL") o.s = true;
    if (tag === "SUB") { o.sub = true; delete o.sup; }
    if (tag === "SUP") { o.sup = true; delete o.sub; }
    if (tag === "MARK") o.hi = o.hi || "#ffff00";
    if (tag === "CODE") o.font = "Consolas";
    if (tag === "A" && /^(https?:|mailto:)/i.test(el.getAttribute("href") || "")) { o.link = el.getAttribute("href"); o.u = true; o.color = o.color || "#0563c1"; }
    if (tag === "SPAN" && el.getAttribute("data-cid")) o.cmt = el.getAttribute("data-cid");   // 2.815.0: a comment's words
    if (tag === "SPAN" && el.getAttribute("data-field")) o.field = el.getAttribute("data-field");   // 2.816.0: a merge field
    if (st.fontFamily) o.font = firstFont(st.fontFamily);
    if (st.fontSize) { const p = ptOf(st.fontSize); if (p) o.size = p; }
    if (st.color) o.color = st.color;
    if (st.backgroundColor && !/transparent|rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(st.backgroundColor)) o.hi = st.backgroundColor;
    if (st.fontWeight) { if (isBold(st.fontWeight)) o.b = true; else if (st.fontWeight === "normal" || +st.fontWeight < 600) delete o.b; }
    if (st.fontStyle) { if (st.fontStyle === "italic") o.i = true; else if (st.fontStyle === "normal") delete o.i; }
    const dec = String(st.textDecorationLine || st.textDecoration || "");
    if (/underline/.test(dec)) o.u = true;
    if (/line-through/.test(dec)) o.s = true;
    if (st.verticalAlign === "sub") o.sub = true; else if (st.verticalAlign === "super") o.sup = true;
    return o;
  }
  /** the runs of an element's words (block children and lists left out - `skip`) */
  function runsOf(el, base, skip) {
    const out = [];
    const walk = (n, look) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { const t = c.nodeValue.replace(/[\r\n\t]+/g, " "); if (t) out.push(Object.assign({ text: t }, look)); continue; }
        if (c.nodeType !== 1) continue;
        if (skip && skip(c)) continue;
        if (c.tagName === "BR") { out.push(Object.assign({ text: "", br: true }, look)); continue; }
        if (c.tagName === "SUP" && c.getAttribute("data-fn")) { const o = Object.assign({ text: "", fn: c.getAttribute("data-fn") }, look); delete o.sup; out.push(o); continue; }   // 2.815.0: a footnote mark
        walk(c, lookOf(c, look));
      }
    };
    walk(el, base || {});
    // neighbours that look the same joined; a lone trailing break (contentEditable's own) dropped
    const j = [];
    for (const r of out) { const p = j[j.length - 1]; if (p && !r.br && !p.br && !r.fn && !p.fn && sameLook(p, r)) p.text += r.text; else j.push(r); }
    if (j.length && j[j.length - 1].br && !j[j.length - 1].text) j.pop();
    return j;
  }
  const LOOK_KEYS = ["b", "i", "u", "s", "sub", "sup", "font", "size", "color", "hi", "link", "cmt", "field"];
  const sameLook = (a, b) => LOOK_KEYS.every((k) => (a[k] || null) === (b[k] || null));
  /** paragraph settings from an element's own style */
  function paraOf(el, extra) {
    const st = el.style || {}, b = Object.assign({ t: "p" }, extra || {});
    const ds = el.getAttribute && el.getAttribute("data-style");
    if (ds === "title" || ds === "subtitle") b.style = ds; else if (STYLE_OF[el.tagName]) b.style = STYLE_OF[el.tagName];
    const al = String(st.textAlign || el.getAttribute && el.getAttribute("align") || "").toLowerCase();
    if (/^(left|center|right|justify)$/.test(al)) b.align = al; else if (al === "start") b.align = "left"; else if (al === "end") b.align = "right";
    if (st.lineHeight) { const s = String(st.lineHeight).trim(); const n = /^[\d.]+$/.test(s) ? +s : /%$/.test(s) ? parseFloat(s) / 100 : null; if (n && n > 0.5 && n < 5) b.lineHeight = n; }
    const mt = ptOf(st.marginTop), mb = ptOf(st.marginBottom), ml = ptOf(st.marginLeft), ti = ptOf(st.textIndent);
    if (mt != null) b.before = Math.max(0, mt);
    if (mb != null) b.after = Math.max(0, mb);
    if (ml || ti) b.indent = Math.max(0, (ml || 0) + (ti > 0 ? ti : 0));
    return b;
  }
  /** a table: widths %, header rows, cells (spans, shading, alignment, the blocks inside), borders */
  function tableOf(t, blocksIn) {
    const rows = [], head = t.tHead ? t.tHead.rows.length : 0;
    const all = [...t.querySelectorAll("tr")].filter((tr) => tr.closest("table") === t);
    let hdr = head;
    if (!hdr) { for (const tr of all) { if ([...tr.cells].length && [...tr.cells].every((c) => c.tagName === "TH")) hdr++; else break; } }
    for (const tr of all) {
      rows.push([...tr.cells].map((c) => {
        const o = { blocks: blocksIn(c) };
        // a header cell looks as the page draws it (.pcdoc th: bold on light grey) unless it says otherwise
        if (c.tagName === "TH") { for (const bl of o.blocks) for (const r of bl.runs || []) if (r.b === undefined && !(c.style.fontWeight && !isBold(c.style.fontWeight))) r.b = true; if (!c.style.backgroundColor) o.shade = "#f2f2f2"; }
        const cs = +c.getAttribute("colspan") || 1, rs = +c.getAttribute("rowspan") || 1;
        if (cs > 1) o.cs = cs; if (rs > 1) o.rs = rs;
        if (c.style.backgroundColor) o.shade = c.style.backgroundColor;
        const va = String(c.style.verticalAlign || "").toLowerCase(); if (va === "middle" || va === "bottom" || va === "top") o.valign = va;
        return o;
      }));
    }
    const widths = [...t.querySelectorAll("col")].filter((c) => c.closest("table") === t).map((c) => parseFloat(c.style.width) || 0);
    const cells = [...t.querySelectorAll("td,th")].filter((c) => c.closest("table") === t);
    const none = (s) => /none/.test(String(s.borderStyle || s.border || ""));
    let borders = "all";
    if (cells.length && cells.every((c) => none(c.style))) borders = none(t.style) ? "none" : (t.style.border || t.style.borderStyle) ? "outside" : "none";
    const colSrc = (cells.find((c) => c.style.borderColor || /\d/.test(c.style.border || "")) || t).style;
    const out = { t: "table", rows, headerRows: Math.min(hdr, rows.length), borders };
    if (widths.length && widths.every((w) => w > 0)) { const s = widths.reduce((a, b) => a + b, 0); out.widths = widths.map((w) => Math.round(w / s * 1000) / 10); }
    const bc = colSrc.borderColor || (/(#[0-9a-f]{3,6}|rgb[^)]*\))/i.exec(colSrc.border || "") || [])[1];
    if (bc) out.borderColor = bc;
    return out;
  }
  /** the cleaned story HTML (pcdoctext sanitize) -> the model's blocks */
  function toModel(html, document) {
    const d = document || root.document, box = d.createElement("div");
    box.innerHTML = String(html || "");
    const isList = (n) => n.tagName === "UL" || n.tagName === "OL";
    function listItems(list, level, out) {
      const kind = list.tagName === "OL" ? "ol" : "ul";
      for (const li of list.children) {
        if (li.tagName !== "LI") { if (isList(li)) listItems(li, level + 1, out); continue; }
        // a li's words: its own inline words, or its first paragraph's (mammoth puts <p> in li sometimes)
        const blocks = [...li.children].filter((c) => BLOCK.has(c.tagName));
        const para = paraOf(blocks[0] || li, { list: { kind, level } });
        para.runs = runsOf(li, {}, (c) => isList(c) || (BLOCK.has(c.tagName) && c !== blocks[0]) ? true : false);
        if (blocks[0]) delete para.style;
        out.push(para);
        for (const b of blocks.slice(1)) { const p = paraOf(b, { indent: 18 * (level + 1) }); p.runs = runsOf(b); out.push(p); }
        for (const sub of [...li.children].filter(isList)) listItems(sub, level + 1, out);
      }
    }
    function blocksIn(parent) {
      const out = [];
      let loose = null;   // words straight in a cell / the story (no paragraph round them) gathered into one
      const flush = () => { if (loose) { const p = { t: "p", runs: runsOf(loose) }; if (p.runs.length) out.push(p); loose = null; } };
      for (const n of [...parent.childNodes]) {
        const tag = n.nodeType === 1 ? n.tagName : null;
        if (tag && (BLOCK.has(tag) || isList(n) || tag === "TABLE" || tag === "HR")) {
          flush();
          if (tag === "P" && n.getAttribute("data-fig")) { out.push({ t: "img", fig: n.getAttribute("data-fig") }); continue; }   // 2.838.0: a figure's place (its picture filled in by modelOf)
          if (BLOCK.has(tag)) { const p = paraOf(n); p.runs = runsOf(n); out.push(p); }
          else if (isList(n)) listItems(n, 0, out);
          else if (tag === "TABLE") out.push(tableOf(n, blocksIn));
          else out.push({ t: "hr" });
          continue;
        }
        if (n.nodeType === 3 && !n.nodeValue.trim() && !loose) continue;
        if (!loose) loose = d.createElement("p");
        loose.appendChild(n.cloneNode(true));
      }
      flush();
      return out;
    }
    return blocksIn(box);
  }
  /** "Page {page} of {pages}" -> runs with Word's page fields */
  function splitTokens(s, look, name) {
    const out = [];
    String(s || "").split(/(\{page\}|\{pages\}|\{name\}|\n)/).forEach((p) => {
      if (!p) return;
      if (p === "{page}") out.push(Object.assign({ field: "page" }, look));
      else if (p === "{pages}") out.push(Object.assign({ field: "pages" }, look));
      else if (p === "\n") out.push(Object.assign({ text: "", br: true }, look));
      else out.push(Object.assign({ text: p === "{name}" ? String(name || "") : p }, look));
    });
    return out;
  }
  /** the master's type layers -> {header, footer}: the top fifth of the page = header, the bottom fifth = footer */
  function headFoot(layers, W, H, dpi, name) {
    const header = [], footer = [];
    const ts = (layers || []).filter((L) => L && L.type === "text" && L.text && L.visible !== false).sort((a, b) => (a.text.y || 0) - (b.text.y || 0));
    for (const L of ts) {
      const t = L.text, y = +t.y || 0, where = y < H * 0.2 ? header : y > H * 0.8 ? footer : null;
      if (!where) continue;
      const look = {};
      if (t.font) look.font = t.font;
      if (t.size) look.size = Math.round(t.size * 72 / (dpi || 150) * 2) / 2;
      if (t.color) look.color = t.color;
      if (t.bold || isBold(t.weight)) look.b = true;
      if (t.italic) look.i = true;
      const p = { t: "p", runs: splitTokens(t.tpl != null ? t.tpl : t.str, look, name) };
      if (/^(left|center|right)$/.test(t.align)) p.align = t.align;
      if (p.runs.length) where.push(p);
    }
    return { header, footer };
  }
  /** the page (canvas px at its dpi) + the first frame -> the page model in mm */
  function pageOf(W, H, dpi, fr) {
    const mm = (px) => Math.round(px / (dpi || 150) * 25.4 * 10) / 10;
    const wmm = mm(W), hmm = mm(H), f = fr || { x: 0, y: 0, w: W, h: H };
    const cl = (v) => Math.max(0, Math.min(200, v));
    return { wmm, hmm, landscape: W > H, margins: { top: cl(mm(f.y)), left: cl(mm(f.x)), right: cl(Math.round((wmm - mm(f.x + f.w)) * 10) / 10), bottom: cl(Math.round((hmm - mm(f.y + f.h)) * 10) / 10) } };
  }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, win } = E;
    if (!E.docText || !E.ui || !E.ui.addCmd || !doc) return;
    const say = E.say || (() => {});
    const isDoc = (L) => !!(L && L.type === "doc" && L.doc);
    /** every story's first frame, the picked one's first */
    function heads() {
      const out = [], seen = new Set();
      const pp = S.pages, lists = [S.layers].concat(pp && pp.list ? pp.list.map((pg, i) => (i !== pp.cur && pg.st && pg.st.layers) || []) : []);
      const act = S.layers[S.active];
      const firstOf = (L) => { const arr = E.docText.storyOf ? E.docText.storyOf(L) : [L]; return arr[0] || L; };
      if (isDoc(act)) { const h = firstOf(act); out.push(h); seen.add(h.doc.flow ? h.doc.flow.id : h); }
      for (const ls of lists) for (const L of ls) if (isDoc(L)) { const h = firstOf(L), id = h.doc.flow ? h.doc.flow.id : h; if (!seen.has(id)) { seen.add(id); out.push(h); } }
      return out;
    }
    function pageSetup() {
      const pg = E.pages && E.pages.current ? E.pages.current() : null;
      return { dpi: (pg && pg.dpi) || 150, name: (pg && pg.name) || "" };
    }
    function masterLayers() {
      const pp = S.pages; if (!pp || !pp.list || !pp.list.length) return [];
      const pg = pp.list[pp.cur] || pp.list[0], m = pg.master != null ? (pp.masters || []).find((x) => x.id === pg.master) : null;
      if (!m) return [];
      if (pp.editing != null && pp.masters[pp.editing] === m) return S.layers;
      return (m.st && m.st.layers) || [];
    }
    /** the model of the picked (else first) story */
    function modelNow() {
      const hs = heads(); if (!hs.length) return null;
      return { model: modelOf(hs[0]), more: hs.length - 1 };
    }
    /** 2.838.0: each figure's place gets the pixels of the layer anchored to it (on any page) as a PNG at its size in the
     *  text; a place with no drawn layer is left out */
    function figsInto(blocks, h) {
      const flow = h.doc.flow && h.doc.flow.id, k = h.doc.k || 1;
      const lists = [S.layers].concat(S.pages && S.pages.list ? S.pages.list.map((pg) => pg.st && pg.st.layers).filter(Boolean) : []);
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i]; if (b.t !== "img") continue;
        let L = null; for (const ls of lists) { L = ls.find((x) => x.anchor && x.anchor.flow === flow && x.anchor.fig === b.fig && x.anchor.box && x.anchor.drawn); if (L) break; }
        if (!L) { blocks.splice(i, 1); continue; }
        const bx = L.anchor.box, c = doc.createElement("canvas"); c.width = bx.w; c.height = bx.h;
        c.getContext("2d").drawImage(L.canvas, bx.x, bx.y, bx.w, bx.h, 0, 0, bx.w, bx.h);
        b.png = c.toDataURL("image/png").split(",")[1]; b.w = bx.w / k; b.h = bx.h / k; delete b.fig;
      }
    }
    /** a story's model (its first frame) */
    function modelOf(h) {
      const { dpi, name } = pageSetup();
      const blocks = toModel(E.docText.sanitize(h.doc.html || ""), doc);
      const hf = headFoot(masterLayers(), S.w, S.h, dpi, name);
      // 2.815.0: the story's comments and footnotes go with it
      const used = new Set(), fns = new Set();
      const walk = (bl) => { for (const b of bl) { for (const r of b.runs || []) { if (r.cmt) used.add(r.cmt); if (r.fn) fns.add(r.fn); } for (const row of b.rows || []) for (const c of row) walk(c.blocks || []); } };
      walk(blocks);
      const comments = (h.doc.comments || []).filter((c) => used.has(c.id)).map((c) => ({ id: c.id, author: c.author, text: c.text, date: c.date }));
      const footnotes = {}; for (const id of fns) footnotes[id] = String((h.doc.notes || {})[id] || "");
      figsInto(blocks, h);
      return { title: S.name || name || "Document", page: pageOf(S.w, S.h, dpi, h.doc), blocks, header: hf.header, footer: hf.footer, comments, footnotes };
    }
    async function exportDocx() {
      if (!S.w) return say("open or make a document first");
      if (E.docText.editing && E.docText.editing()) E.docText.end();
      const m = modelNow();
      if (!m) return say("there is no document text to save - File ▸ New Text Document… or the Document Text tool makes some");
      const base = String(S.name || "document").replace(/\.[a-z0-9]+$/i, "");
      const nBlocks = m.model.blocks.length, nMore = m.more, hd = m.model.header.length ? "✓" : "—", ft = m.model.footer.length ? "✓" : "—";
      E.ui.dialog("Save as Word Document", `<div class="kxrow"><span>Name</span><input id="pdxName" value="${base.replace(/"/g, "&quot;")}" style="width:220px">.docx</div>
        <div class="kxrow" style="color:var(--pc-dim)">${nBlocks} paragraphs / tables</div>
        <div class="kxrow" style="color:var(--pc-dim)">Header from the master's type: ${hd} · Footer: ${ft}</div>${m.more ? `
        <div class="kxrow" style="color:var(--pc-dim)">Other stories left out: ${nMore} - pick a frame to save its story</div>` : ""}
        <div class="kxrow" style="color:var(--pc-dim)">Word lays out pages itself - its page breaks can fall a line or two away from these.</div>`, async (dlg) => {
        const name = dlg.querySelector("#pdxName").value.trim() || base;
        say("saving the Word document…");
        try {
          const r = await win.fetch("/api/docx/export?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: m.model }) });
          const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status);
          const a = doc.createElement("a"); a.href = j.url; a.download = j.name; doc.body.appendChild(a); a.click(); a.remove();
          say(`${j.name} saved in the project's docs folder and downloaded`);
          PCDocx.last = j;
        } catch (e) { say("could not save the Word document: " + e.message); }
      }, { okLabel: "💾 Save" });
    }
    async function openDocxBytes(buf, fname) {
      const r = await win.fetch("/api/docx/import", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: buf });
      const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status);
      const html = E.docText.sanitize(String(j.html || "").replace(/<(\/?)h[56]\b/gi, "<$1h3")) || "<p><br></p>";
      return { html, messages: j.messages || [], name: String(fname || "Document").replace(/\.docx$/i, ""), comments: j.comments || [], notes: j.notes || {} };
    }
    function placeOpened(o, opts) {
      const SIZES = (win.PCPages && win.PCPages.PAGE_SIZES) || [["A4", 210, 297]];
      const sz = SIZES.find((s) => s[0] === opts.size) || SIZES[0], dpi = opts.dpi || 150;
      E.pages.newDocument({ preset: sz[0], wmm: sz[1], hmm: sz[2], orient: opts.orient || "portrait", dpi }, 1, o.name);
      const m = Math.round((opts.margin == null ? 25 : opts.margin) / 25.4 * dpi);
      const more = { auto: true, k: dpi / 96, html: o.html };
      if (o.comments && o.comments.length) more.comments = o.comments;
      if (o.notes && Object.keys(o.notes).length) more.notes = o.notes;
      const L = E.docText.addFrame(m, m, S.w - 2 * m, S.h - 2 * m, more, false);
      E.docText.reflow(L.doc.flow && L.doc.flow.id);
      return L;
    }
    function openDocx() {
      if (!E.pages) return say("pages are not loaded");
      const SIZES = (win.PCPages && win.PCPages.PAGE_SIZES) || [["A4", 210, 297], ["Letter", 215.9, 279.4]];
      E.ui.dialog("Open Word Document", `<div class="kxrow"><span>File</span><input type="file" id="pdxFile" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></div>
        <div class="kxrow"><span>Page</span><select id="pdxSize">${SIZES.map(([n]) => `<option${n === "A4" ? " selected" : ""}>${n}</option>`).join("")}</select>
        <select id="pdxOrient"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
        <div class="kxrow"><span>Margins (mm)</span><input type="number" id="pdxMargin" value="25" min="0" max="80" style="width:70px"></div>
        <div class="kxrow" style="color:var(--pc-dim)">The words, styles, lists and tables come in; pictures are left out for now.</div>`, async (dlg) => {
        const f = dlg.querySelector("#pdxFile").files[0]; if (!f) return say("pick a .docx file");
        say("reading " + f.name + "…");
        try {
          const o = await openDocxBytes(await f.arrayBuffer(), f.name);
          placeOpened(o, { size: dlg.querySelector("#pdxSize").value, orient: dlg.querySelector("#pdxOrient").value, margin: +dlg.querySelector("#pdxMargin").value });
          say(`${f.name} opened as document text` + (o.messages.length ? ` - ${o.messages.length} note(s): ${o.messages[0]}` : ""));
        } catch (e) { say("could not open the Word document: " + e.message); }
      }, { okLabel: "📂 Open" });
    }
    const C = E.ui.addCmd, MENUS = E.ui.MENUS || [];
    const F = MENUS.find(([x]) => x === "File"), has = (id) => !!(F && F[1].includes(id));
    C("file.opendocx", "📂 Open Word Document (.docx)…", "", openDocx, null, ["File", has("file.newtextdoc") ? "file.newtextdoc" : "file.new"]);
    C("file.exportdocx", "Word Document (.docx)…", "", exportDocx, { enabled: () => !!S.w }, ["File", has("file.exportdtp") ? "file.exportdtp" : "file.export"]);
    E.docx = { model: () => { const m = modelNow(); return m && m.model; }, modelOf, exportDocx, openDocx, openBytes: openDocxBytes, place: placeOpened, heads };
  }

  const PCDocx = { toModel, runsOf, pageOf, headFoot, splitTokens, ptOf, install, last: null };
  if (typeof module !== "undefined" && module.exports) module.exports = PCDocx;
  if (root && root.document) root.PCDocx = PCDocx;
})(typeof window !== "undefined" ? window : globalThis);
