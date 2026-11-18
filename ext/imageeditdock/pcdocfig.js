/* pcdocfig.js — 📄 A DOCUMENT'S FIGURES: DRAGGED TO A NEW PLACE IN THE TEXT, BESIDE THE TEXT (2.839.0), window.PCDocFig.
 *
 * Tim (verbatim, the 2.838.0 offers he took): "Drag a figure's layer to move its place in the text. Let text wrap beside a
 * figure instead of each one taking the full width."
 *   A figure = a layer anchored to its place in a WP story (L.anchor {flow, fig, src} - pcdoctext.js, made by ✨ Write With
 *   the AI - pcdocai.js). Its place is a paragraph <p data-fig> whose padding-top is the picture and whose words are the
 *   caption under it (2.838.0 places - a height + a caption paragraph after - are turned into that when touched).
 *   DRAG   the Move tool drags the figure's layer: let go and its place moves in the story to where it was dropped (between
 *          the paragraphs there - in any frame of the story on this page); the reflow puts the figure exactly there. A figure
 *          beside the text dropped on the frame's left / right half goes to that side. One undo step.
 *   WRAP   right-click the figure (or Layer ▸): ▭ Full Width, ◧ Left - Text Beside, ◨ Right - Text Beside, ＋ / － Bigger /
 *          Smaller (a quarter to three quarters of the column) - the text flows beside it; its caption stays under it.
 * Pure (Node + jsdom: scripts/test-839.js): blockIndexAt, relocate, layout, tidy.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const isCaptionP = (n) => !!(n && n.nodeType === 1 && n.tagName === "P" && !n.getAttribute("data-fig") && n.children.length === 1 && n.children[0].tagName === "I" && n.textContent.trim() === n.children[0].textContent.trim());
  /** a 2.838.0 place (height + a caption paragraph after it) -> the picture as padding-top and the caption inside */
  function tidy(p) {
    if (!p) return p;
    const h = parseFloat(p.style.height);
    if (h > 0) { p.style.removeProperty("height"); if (!(parseFloat(p.style.paddingTop) > 0)) p.style.paddingTop = Math.round(h) + "px"; }
    const nx = p.nextElementSibling;
    if (isCaptionP(nx) && !p.textContent.trim()) { p.innerHTML = ""; p.appendChild(nx.children[0]); nx.remove(); }
    if (!p.childNodes.length) p.appendChild(p.ownerDocument.createElement("br"));
    return p;
  }
  /** blocks [{top, bottom, fig}] (story order) + a story y -> the index to put a figure before (blocks.length = at the end);
   *  the figure's own block (skip) never counts */
  function blockIndexAt(blocks, y, skip) {
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]; if (skip && b.fig === skip) continue;
      if (y < (b.top + b.bottom) / 2) return i;
    }
    return blocks.length;
  }
  function box(html, document) { const d = document || root.document, el = d.createElement("div"); el.innerHTML = String(html || ""); return el; }
  /** the figure's place (+ its caption) moved to before top-level block `before` (an index into the story as it is) -> html */
  function relocate(html, figId, before, document) {
    const el = box(html, document), kids = [...el.children], p = kids.find((x) => x.getAttribute("data-fig") === figId);
    if (!p) return null;
    const target = kids[before] || null;
    const cap = isCaptionP(p.nextElementSibling) ? p.nextElementSibling : null;
    if (target === p || (cap && target === cap) || (target && target === p.nextElementSibling && !cap) || (!target && (cap || p) === kids[kids.length - 1])) return null;   // stays where it is
    tidy(p);
    if (target) el.insertBefore(p, target); else el.appendChild(p);
    return el.innerHTML;
  }
  /** the figure's place laid out: mode full | left | right, frac of the column (beside the text), colW CSS px, aspect h / w */
  function layout(html, figId, mode, frac, colW, aspect, document) {
    const el = box(html, document), p = [...el.children].find((x) => x.getAttribute("data-fig") === figId);
    if (!p) return null;
    tidy(p);
    const f = mode === "full" ? 1 : Math.max(0.25, Math.min(0.75, +frac || 0.5)), a = aspect > 0 ? aspect : 0.6;
    for (const k of ["float", "width", "margin-left", "margin-right", "height"]) p.style.removeProperty(k);
    if (mode === "left" || mode === "right") {
      p.style.cssFloat = mode; p.style.width = Math.round(f * 1000) / 10 + "%";
      if (mode === "left") p.style.marginRight = "14px"; else p.style.marginLeft = "14px";
    }
    p.style.paddingTop = Math.max(30, Math.round(colW * f * a)) + "px";
    return el.innerHTML;
  }
  /** how a place is laid out now: {mode, frac} */
  function modeOf(html, figId, document) {
    const p = [...box(html, document).children].find((x) => x.getAttribute("data-fig") === figId); if (!p) return null;
    const fl = p.style.cssFloat || p.style.float, w = parseFloat(p.style.width);
    return { mode: fl === "left" || fl === "right" ? fl : "full", frac: fl && w > 0 ? w / 100 : 1 };
  }
  const pure = { blockIndexAt, relocate, layout, modeOf, tidy, isCaptionP };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc } = E, say = E.say || (() => {});
    if (!E.docText || !E.ui || !E.ui.addCmd) return;
    const T = root.PCDocText;
    const anchored = (L) => !!(L && L.anchor && L.anchor.flow && L.anchor.fig);
    /** the story a figure belongs to: {head, frames (on this page), k} */
    function storyOfFig(L) {
      const F0 = S.layers.find((x) => x.type === "doc" && x.doc && x.doc.flow && x.doc.flow.id === L.anchor.flow)
        || (E.docText.storyOf ? null : null);
      let all = F0 ? E.docText.storyOf(F0) : null;
      if (!all) {                                                         // its frames may all be on other pages
        const pp = S.pages; if (pp && pp.list) for (const pg of pp.list) { const f = pg.st && pg.st.layers && pg.st.layers.find((x) => x.type === "doc" && x.doc && x.doc.flow && x.doc.flow.id === L.anchor.flow); if (f) { all = E.docText.storyOf(f); break; } }
      }
      if (!all || !all.length) return null;
      return { head: all[0], frames: all.filter((f) => S.layers.includes(f)), k: all[0].doc.k || 1 };
    }
    /** where the layer's pixels are now (alpha box) -> its middle */
    function middleOf(L) {
      const c = L.canvas, w = c.width, h = c.height, d = c.getContext("2d").getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? null : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    }
    function setHtml(st, html, label) {
      E.structOp(label, () => { st.head.doc.html = E.docText.sanitize(html); });
      E.docText.reflow(st.head.doc.flow.id);
    }
    /** the figure's layer was dragged: its place goes where it was let go */
    function dropped(L) {
      const st = storyOfFig(L); if (!st || !st.frames.length) return;
      const m = middleOf(L); if (!m) return;
      let F = st.frames.find((f) => m.x >= f.doc.x && m.x <= f.doc.x + f.doc.w && m.y >= f.doc.y && m.y <= f.doc.y + f.doc.h);
      if (!F) { let best = 1e18; for (const f of st.frames) { const dx = Math.max(f.doc.x - m.x, 0, m.x - f.doc.x - f.doc.w), dy = Math.max(f.doc.y - m.y, 0, m.y - f.doc.y - f.doc.h), dd = dx * dx + dy * dy; if (dd < best) { best = dd; F = f; } } }
      const fd = F.doc, k = st.k, y = (fd.top || 0) + (Math.max(fd.y, Math.min(fd.y + fd.h, m.y)) - fd.y) / k - (fd.rep ? fd.repH || 0 : 0);
      const hd = st.head.doc, meas = T.measure(doc, hd.html, hd.w / k);
      const at = blockIndexAt(meas.blocks || [], y, L.anchor.fig);
      let html = relocate(hd.html, L.anchor.fig, at, doc);
      const mo = modeOf(html || hd.html, L.anchor.fig, doc);
      if (mo && mo.mode !== "full") {                                     // beside the text: the half it was dropped on = its side
        const side = m.x < fd.x + fd.w / 2 ? "left" : "right";
        if (side !== mo.mode) { const b = L.anchor.box; html = layout(html || hd.html, L.anchor.fig, side, mo.frac, hd.w / k, b ? b.h / b.w : 0.6, doc); }
      }
      L.anchor.box = null;                                                 // drawn again at its (new) place, sharp
      if (html) setHtml(st, html, "move figure in the text");
      else E.docText.reflow(hd.flow.id);
      say(html ? "the figure moved in the text - Ctrl+Z puts it back" : "the figure stays at its place in the text");
    }
    function setMode(mode, delta) {
      const L = E.layer(); if (!anchored(L)) return say("pick a figure of a document (a chart / picture layer the AI wrote into a WP layer)");
      const st = storyOfFig(L); if (!st) return;
      const hd = st.head.doc, k = st.k, mo = modeOf(hd.html, L.anchor.fig, doc); if (!mo) return say("that figure's place is no longer in the text");
      const b = L.anchor.box, aspect = b ? b.h / b.w : 0.6;
      let m2 = mode || mo.mode, f = mo.mode === "full" ? 0.5 : mo.frac;
      if (delta) { if (m2 === "full") return say("a full-width figure is as big as the column - ◧ / ◨ puts it beside the text"); f = Math.max(0.25, Math.min(0.75, f + delta)); }
      const html = layout(hd.html, L.anchor.fig, m2, f, hd.w / k, aspect, doc);
      if (!html) return;
      L.anchor.box = null;
      setHtml(st, html, m2 === "full" ? "figure: full width" : "figure: beside the text");
    }
    const prevPush = E.onPush;
    E.onPush = function (e) {
      if (prevPush) prevPush.apply(this, arguments);
      if (!e || e.label !== "move") return;
      const list = e.t === "multi" ? e.list || [] : [e];
      const Ls = [...new Set(list.filter((x) => x && x.t === "px" && anchored(x.L) && x.L.anchor.src).map((x) => x.L))];
      if (Ls.length) root.setTimeout(() => { for (const L of Ls) { try { dropped(L); } catch (er) { say("figure: " + er.message); } } }, 0);
    };
    const on = () => anchored(E.layer());
    E.ui.addCmd("figure.full", "▭ Figure: Full Width", "", () => setMode("full"), { enabled: on }, ["Layer", "layer.docai"]);
    E.ui.addCmd("figure.left", "◧ Figure: Left - Text Beside", "", () => setMode("left"), { enabled: on }, ["Layer", "figure.full"]);
    E.ui.addCmd("figure.right", "◨ Figure: Right - Text Beside", "", () => setMode("right"), { enabled: on }, ["Layer", "figure.left"]);
    E.ui.addCmd("figure.bigger", "＋ Figure Bigger", "", () => setMode(null, 1 / 12), { enabled: on }, ["Layer", "figure.right"]);
    E.ui.addCmd("figure.smaller", "－ Figure Smaller", "", () => setMode(null, -1 / 12), { enabled: on }, ["Layer", "figure.bigger"]);
    const items = ["figure.full", "figure.left", "figure.right", "figure.bigger", "figure.smaller"];
    // only on a figure: hidden in the menus otherwise (not five greyed lines on every right-click)
    for (const id of items) { const c = E.ui.CMD && E.ui.CMD.get && E.ui.CMD.get(id); if (c) Object.defineProperty(c, "hidden", { get: () => !on(), configurable: true }); }
    E.ui.stageCtxItems = (E.ui.stageCtxItems || []).concat(items);
    E.ui.layerCtxItems = (E.ui.layerCtxItems || []).concat(items);
    E.docFig = { dropped, setMode, storyOfFig };
  }
  const PCDocFig = Object.assign({ install }, pure);
  root.PCDocFig = PCDocFig;
})(typeof window !== "undefined" ? window : globalThis);
