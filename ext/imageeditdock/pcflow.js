/* pcflow.js — LINKED TEXT FRAMES (TEXT FLOW) AND TEXT WRAP (2.801.0), window.PCFlow.
 *
 * Tim (verbatim): "ok, next please" - desktop publishing part 3 of 4 (2.799.0's plan: "Linked text frames - paragraph text
 * flows from frame to frame and page to page; text wrap around objects").
 *
 *   A STORY      paragraph text (pctype.js - a type layer with a box) that goes on in other frames: t.flow = {id, idx}
 *                on each frame (idx 0 = the FIRST frame, which holds the whole story in its text; the others show what
 *                did not fit before them, worked out again after every change). Frames can be on any page (pcpages.js).
 *   ADD          Layer ▸ Text Flow: Add Frame Here (beside / under this one, the same size and type settings) · Add Frame
 *                on the Next Page (the same place; a new page if this is the last one). Also in the Properties panel.
 *   EDIT         type in any frame - the first one is the story itself; in a later frame your change goes back into the
 *                story at that frame's place (and flows on). Text Flow: Edit Story… = the whole story in a box.
 *   UNLINK       Text Flow: Unlink Frame - the chain breaks before this frame: the frames before keep their text, this
 *                one becomes the first frame of a new story with the rest.
 *   TEXT WRAP    Layer ▸ Text Wrap… (or the Properties panel) on any layer that is not paragraph text: paragraph text on
 *                the same page flows around it - a shape around its outline (rectangle, ellipse, polygon), anything
 *                else around the box of what it covers - with a gap (px). L.wrap = {on, off}.
 *   EXPORT       frames and wrapped text go to PDF / SVG as real text, line by line (pcdtpout.js).
 *
 * Pure (Node: scripts/test-flow801.js): boundaries, flow, clipPoly, shapePoly, rectPoly, holesFor.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** where a text may be cut between frames: 0 and after each word (before the spaces / line break after it) */
  function boundaries(text) {
    const out = [0], s = String(text || "");
    for (let i = 1; i <= s.length; i++) { const a = s[i - 1], b = s[i]; if (a !== " " && a !== "\n" && (i === s.length || b === " " || b === "\n")) out.push(i); }
    return out;
  }
  /** a story through its frames: fits(k, text) = frame k shows all of text. -> [{start, end, part}] in the story;
   *  the last frame gets all that is left (what does not fit there stays hidden, as in any paragraph text) */
  function flow(story, n, fits) {
    const s = String(story || ""), out = [];
    let pos = 0;
    for (let k = 0; k < n; k++) {
      const rest = s.slice(pos);
      if (k === n - 1) { out.push({ start: pos, end: s.length, part: rest }); pos = s.length; break; }
      const B = boundaries(rest);
      let lo = 0, hi = B.length - 1;                  // the last boundary that still fits (binary search)
      if (fits(k, rest)) lo = hi;
      else while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (fits(k, rest.slice(0, B[mid]))) lo = mid; else hi = mid - 1; }
      const cut = B[lo];
      out.push({ start: pos, end: pos + cut, part: rest.slice(0, cut) });
      let p = pos + cut;
      while (s[p] === " ") p++;
      if (s[p] === "\n") p++;
      pos = p;
    }
    while (out.length < n) out.push({ start: s.length, end: s.length, part: "" });
    return out;
  }
  /** a polygon clipped to a rectangle {x, y, w, h} (Sutherland–Hodgman) */
  function clipPoly(poly, r) {
    const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
    const edges = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]], [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
      [(p) => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]], [(p) => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]];
    let out = (poly || []).slice();
    for (const [inside, cross] of edges) {
      const inp = out; out = [];
      for (let i = 0; i < inp.length; i++) {
        const a = inp[(i + inp.length - 1) % inp.length], b = inp[i];
        if (inside(b)) { if (!inside(a)) out.push(cross(a, b)); out.push(b); } else if (inside(a)) out.push(cross(a, b));
      }
      if (!out.length) break;
    }
    return out;
  }
  const rectPoly = (b, off) => { const o = +off || 0; return [[b.x - o, b.y - o], [b.x + b.w + o, b.y - o], [b.x + b.w + o, b.y + b.h + o], [b.x - o, b.y + b.h + o]]; };
  /** a shape layer's outline as a polygon, grown by off px (rectangle, ellipse, polygon, triangle; anything else = its box) */
  function shapePoly(s, off) {
    const o = +off || 0, x = Math.min(s.x, s.x + s.w), y = Math.min(s.y, s.y + s.h), w = Math.abs(s.w), h = Math.abs(s.h);
    const cx = x + w / 2, cy = y + h / 2;
    if (s.kind === "ellipse") { const out = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; out.push([cx + Math.cos(a) * (w / 2 + o), cy + Math.sin(a) * (h / 2 + o)]); } return out; }
    if (s.kind === "polygon" || s.kind === "triangle") {
      const n = s.kind === "triangle" ? 3 : Math.max(3, Math.min(64, s.sides || 5)), out = [];
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; out.push([cx + Math.cos(a) * (w / 2 + o), cy + Math.sin(a) * (h / 2 + o)]); }
      return out;
    }
    return rectPoly({ x, y, w, h }, o);
  }
  /** the holes a frame {x, y, w, h} gets from obstacle polygons: those that reach into it, clipped to it */
  function holesFor(frame, polys) {
    const out = [];
    for (const p of polys || []) {
      if (!Array.isArray(p) || p.length < 3) continue;
      const c = clipPoly(p, frame);
      if (c.length > 2) { const xs = c.map((q) => q[0]), ys = c.map((q) => q[1]); if (Math.max(...xs) - Math.min(...xs) > 0.5 && Math.max(...ys) - Math.min(...ys) > 0.5) out.push(c.map(([a, b]) => [Math.round(a * 100) / 100, Math.round(b * 100) / 100])); }
    }
    return out;
  }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, say, ctx, newCanvas, kx } = E;
    if (!E.ui || !E.ui.addCmd) return;
    const $ = (id) => doc.getElementById(id) || E.$(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    const T = () => root.PCType;
    const isFrame = (L) => !!(L && L.type === "text" && L.text && L.text.box && L.text.box.w > 0);
    const scratch = ctx(newCanvas(8, 8));
    const fitsT = (t, text) => { const PT = T(); if (!PT) return true; const tt = Object.assign({}, t, { str: text }); return !PT.layout(tt, PT.canvasMeasure(tt, scratch)).overflow; };
    /** every layer list of the document: the page in front (S), the other pages' kept states (pcpages.js) */
    function places() {
      const out = [{ layers: S.layers, w: S.w, h: S.h, live: true, page: E.pages && E.pages.list().length ? E.pages.cur() : 0 }];
      const P = E.pages; if (!P) return out;
      const pp = S.pages; if (!pp) return out;
      if (pp.editing != null) out[0].master = true;
      pp.list.forEach((pg, i) => { if (pg.st && pg.st.layers && !(i === pp.cur && pp.editing == null)) out.push({ layers: pg.st.layers, w: pg.st.w, h: pg.st.h, live: false, page: i }); });
      return out.filter((x) => !x.master);
    }
    /** the stories: id -> [{L, place}] in frame order */
    function stories() {
      const m = new Map();
      for (const pl of places()) for (const L of pl.layers) if (isFrame(L) && L.text.flow && L.text.flow.id) { if (!m.has(L.text.flow.id)) m.set(L.text.flow.id, []); m.get(L.text.flow.id).push({ L, pl }); }
      for (const [, arr] of m) arr.sort((a, b) => (a.L.text.flow.idx || 0) - (b.L.text.flow.idx || 0) || (a.pl.page - b.pl.page));
      return m;
    }
    /* ---- text wrap: the holes of each frame on a page */
    const boxCache = new WeakMap();
    function alphaBoxOf(L) {
      const hit = boxCache.get(L); if (hit && hit.ver === L.ver && hit.c === L.canvas) return hit.b;
      let b = null;
      try { const c = L.canvas, d = ctx(c).getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; } if (x1 >= 0) b = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; } catch (e) { b = null; }
      boxCache.set(L, { ver: L.ver, c: L.canvas, b });
      return b;
    }
    function obstacles(layers) {
      const out = [];
      for (const L of layers) {
        if (!L.wrap || !L.wrap.on || L.visible === false || isFrame(L) || L.type === "group" || L.type === "adjust" || !D.shown(layers, L)) continue;
        const off = +L.wrap.off || 0;
        if (L.type === "shape" && L.shape && L.shape.kind !== "path" && L.shape.kind !== "line") out.push(shapePoly(L.shape, off));
        else if (L.type === "text" && L.text) { const b = D.textBox(L.text, scratch); if (b) out.push(rectPoly(b, off)); }
        else { const b = alphaBoxOf(L); if (b) out.push(rectPoly(b, off)); }
      }
      return out;
    }
    const sameHoles = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
    /** wrap + flow worked out again; the frames that change are drawn again. -> how many changed */
    const last = new Map();      // "<story>:<idx>" -> {part, start, end} as last given (to find a later frame typed in)
    let busyFlow = false;
    function reflow() {
      if (busyFlow || !S.w || !T()) return 0;
      busyFlow = true;
      let changed = 0, liveChanged = false;
      try {
        // 1 text wrap on every page
        for (const pl of places()) {
          const obs = obstacles(pl.layers);
          for (const L of pl.layers) {
            if (!isFrame(L)) continue;
            const t = L.text, holes = obs.length ? holesFor({ x: t.x, y: t.y, w: t.box.w, h: t.box.h }, obs) : [];
            if (!sameHoles(t.wrapHoles, holes)) { if (holes.length) t.wrapHoles = holes; else delete t.wrapHoles; D.rasterize(L); L.ver = (L.ver || 0) + 1; changed++; if (pl.live) liveChanged = true; }
          }
        }
        // 2 the stories
        for (const [id, arr] of stories()) {
          arr.forEach((f, i) => { f.L.text.flow = Object.assign({}, f.L.text.flow, { idx: i }); });
          const head = arr[0].L.text;
          delete head.flowSet;
          // a later frame typed in: its text goes back into the story at its place
          for (let i = 1; i < arr.length; i++) {
            // t.flowSet = the text this frame was given (kept in the layer, so an undo that brings a frame back brings it too
            // - only a frame typed in has str !== flowSet)
            const was = last.get(id + ":" + i), t = arr[i].L.text;
            if (was && t.flowSet != null && t.str !== t.flowSet && t.flowSet === was.part && head.str.slice(was.start, was.end) === was.part) {
              const merged = head.str.slice(0, was.start) + t.str + head.str.slice(was.end);
              t.flowSet = t.str;               // the frame as typed is "given" now - an undo of the story step below does not bring the typing back in
              if (arr[0].pl.live && E.setLayer) E.setLayer(arr[0].L, "type in frame " + (i + 1), (x) => { x.text.str = merged; });   // one undo step (Ctrl+Z takes it out again)
              else { head.str = merged; D.rasterize(arr[0].L); arr[0].L.ver = (arr[0].L.ver || 0) + 1; }
              changed++; if (arr[0].pl.live) liveChanged = true;
              break;
            }
          }
          if (arr.length === 1) { last.set(id + ":0", { part: head.str, start: 0, end: head.str.length }); continue; }
          const parts = flow(head.str, arr.length, (k, text) => fitsT(arr[k].L.text, text));
          parts.forEach((p, i) => {
            last.set(id + ":" + i, p);
            if (i === 0) return;
            const L = arr[i].L;
            if (L.text.str !== p.part) { L.text.str = p.part; L.text.flowSet = p.part; D.rasterize(L); L.ver = (L.ver || 0) + 1; changed++; if (arr[i].pl.live) liveChanged = true; }
            else L.text.flowSet = p.part;
          });
        }
      } catch (e) { say("text flow: " + e.message); }
      finally { busyFlow = false; }
      if (liveChanged) { E.refresh(); E.renderLayersPanel(); }
      return changed;
    }
    let timer = 0;
    const typing = () => { const a = doc.activeElement; return !!(a && (a.tagName === "TEXTAREA" || a.isContentEditable || (a.tagName === "INPUT" && kx.contains(a) && !/^(checkbox|radio|range|color|button)$/.test(a.type)))); };
    function soon() { clearTimeout(timer); timer = setTimeout(() => { if (typing()) { soon(); return; } reflow(); }, 300); }
    const prevPush = E.onPush;
    E.onPush = function () { if (prevPush) prevPush.apply(this, arguments); soon(); };
    const prevUndo = E.onUndo;   // 2.801.0: an undo / redo brings a frame or the story back - flow again
    E.onUndo = function () { if (prevUndo) prevUndo.apply(this, arguments); soon(); };
    let lastKey = null;
    const prevLP = E.renderLayersPanel;
    E.renderLayersPanel = function () { const r = prevLP.apply(this, arguments); const k = S.pages ? (S.pages.cur + ":" + S.pages.editing) : S.name; if (k !== lastKey) { lastKey = k; if (!busyFlow) soon(); } return r; };

    /* ---- the commands */
    const curFrame = () => { const L = E.layer(); return isFrame(L) ? L : null; };
    const newId = () => "s" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    function storyOf(L) { const id = L && L.text && L.text.flow && L.text.flow.id; return id ? stories().get(id) || [] : []; }
    /** a new frame continuing L's story, made in the page in S at (x, y) */
    function makeFrame(src, x, y, id, idx) {
      const t0 = src.text, F = E.makeLayer("Frame " + (idx + 1), S.w, S.h, "text");
      F.text = JSON.parse(JSON.stringify(Object.assign({}, t0, { str: "", x: Math.round(x), y: Math.round(y), flow: { id, idx } })));
      delete F.text.wrapHoles; delete F.text.tpl; delete F.text.shown;
      F.text.box = { w: Math.min(t0.box.w, S.w), h: Math.min(t0.box.h, S.h) };
      D.rasterize(F);
      return F;
    }
    function linkHead(L) { if (!L.text.flow) { const id = newId(); E.setLayer(L, "start a story", (x) => { x.text.flow = { id, idx: 0 }; }); } return L.text.flow.id; }
    /** + Frame here: beside the frame (or under it when there is no room), the same size and type */
    function addHere() {
      const L = curFrame(); if (!L) return say("pick a paragraph text frame first (a type layer with a box - Type: Convert to Paragraph Text)");
      const id = linkHead(L), arr = storyOf(L), idx = arr.length ? arr.length : 1, t = L.text;
      let x = t.x + t.box.w + 24, y = t.y;
      if (x + t.box.w > S.w) { x = t.x; y = t.y + t.box.h + 24; }
      if (y + Math.min(t.box.h, 40) > S.h) { x = Math.max(0, S.w - t.box.w); y = Math.max(0, S.h - t.box.h); }
      const F = makeFrame(L, x, y, id, idx);
      E.addLayer(F, "add a text frame", false);
      reflow();
      say(`frame ${idx + 1} of the story - the text goes on in it`);
      return F;
    }
    /** + Frame on the next page: the same place (a new page after the last one) */
    function addNextPage() {
      const L = curFrame(); if (!L) return say("pick a paragraph text frame first (a type layer with a box - Type: Convert to Paragraph Text)");
      if (!E.pages) return say("pages are not loaded");
      const id = linkHead(L), idx = storyOf(L).length || 1, src = { text: JSON.parse(JSON.stringify(L.text)) };
      const pp = E.pages.ensure(), cur = pp.editing != null ? null : pp.cur;
      if (cur == null) return say("go back to the pages first (← Pages)");
      if (cur >= pp.list.length - 1) E.pages.add(); else E.pages.go(cur + 1);
      const F = makeFrame(src, Math.min(src.text.x, Math.max(0, S.w - src.text.box.w)), Math.min(src.text.y, Math.max(0, S.h - src.text.box.h)), id, idx);
      E.addLayer(F, "add a text frame", false);
      reflow();
      say(`frame ${idx + 1} of the story on page ${E.pages.cur() + 1}`);
      return F;
    }
    /** Unlink: the chain breaks before this frame - it starts a new story with the rest */
    function unlink() {
      const L = curFrame(); if (!L || !L.text.flow) return say("this frame is not linked");
      reflow();
      const arr = storyOf(L), k = arr.findIndex((f) => f.L === L);
      if (k < 0) return;
      if (arr.length < 2) { E.setLayer(L, "unlink", (x) => { delete x.text.flow; }); return say("no other frames - it is plain paragraph text again"); }
      const id = L.text.flow.id, head = arr[0].L, p = last.get(id + ":" + k), story = head.text.str;
      if (k === 0) {   // the first frame: it keeps what it shows, the next frame starts a new story with the rest
        const p1 = last.get(id + ":1"), rest = p1 ? story.slice(p1.start) : "", nid = newId();
        E.setLayer(head, "unlink", (x) => { x.text.str = story.slice(0, p1 ? last.get(id + ":0").end : story.length); delete x.text.flow; });
        arr.slice(1).forEach((f, i) => { f.L.text.flow = { id: nid, idx: i }; if (i === 0) { f.L.text.str = rest; delete f.L.text.flowSet; } D.rasterize(f.L); });
      } else {
        const nid = newId(), rest = p ? story.slice(p.start) : L.text.str;
        E.setLayer(head, "unlink", (x) => { x.text.str = story.slice(0, p ? p.start : story.length).replace(/[ \n]+$/, ""); });
        arr.slice(k).forEach((f, i) => { f.L.text.flow = { id: nid, idx: i }; if (i === 0) { f.L.text.str = rest; delete f.L.text.flowSet; } D.rasterize(f.L); });
      }
      for (const key of [...last.keys()]) if (key.startsWith(id + ":")) last.delete(key);
      reflow(); E.refresh(); E.renderLayersPanel();
      say("unlinked: the frames before keep their text, this one starts a new story with the rest");
    }
    /** Edit Story…: the whole story in a box */
    function storyDialog() {
      const L = curFrame(); if (!L) return say("pick a paragraph text frame first");
      reflow();
      const arr = L.text.flow ? storyOf(L) : [{ L, pl: { live: true } }], head = arr[0].L;
      const old = $("pcStoryDlg"); if (old) old.remove();
      const d = doc.createElement("div"); d.id = "pcStoryDlg";
      d.style.cssText = "position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:9000;background:var(--pc-panel,#222);color:var(--pc-text,#eee);border:1px solid var(--pc-line,#444);border-radius:6px;padding:12px 14px;width:560px;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.5)";
      d.innerHTML = `<div style="font-weight:600;margin-bottom:8px">Edit story (${arr.length} frame${arr.length === 1 ? "" : "s"})</div>
        <textarea id="storyTxt" style="width:100%;height:300px;box-sizing:border-box;font-size:13px">${esc(head.text.str)}</textarea>
        <div class="kxrow" style="justify-content:flex-end;gap:6px;margin-top:6px"><button class="ghost" id="storyCancel">Cancel</button><button id="storyOk">OK</button></div>`;
      doc.body.appendChild(d);
      $("storyCancel").onclick = () => d.remove();
      $("storyOk").onclick = () => {
        const v = $("storyTxt").value; d.remove();
        const live = arr[0].pl.live;
        if (!live && E.pages) E.pages.go(arr[0].pl.page);
        const H = S.layers.find((x) => x === head) || head;
        E.setLayer(H, "edit story", (x) => { x.text.str = v; });
        reflow();
      };
      setTimeout(() => { const ta = $("storyTxt"); if (ta) ta.focus(); }, 30);
    }
    /** Text Wrap…: on / off and the gap for the active layer */
    function setWrap(L, on, off) {
      if (!L) return;
      L.wrap = { on: !!on, off: Math.max(0, Math.min(500, Math.round(+off || 0))) };
      if (E.onPush) { /* not an undo step - flow at once */ }
      reflow(); E.refresh();
    }
    function wrapDialog() {
      const L = E.layer(); if (!L || isFrame(L)) return say("pick the layer the text should flow around (a shape, a picture …)");
      const w = L.wrap || { on: false, off: 12 };
      const old = $("pcWrapDlg"); if (old) old.remove();
      const d = doc.createElement("div"); d.id = "pcWrapDlg";
      d.style.cssText = "position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:9000;background:var(--pc-panel,#222);color:var(--pc-text,#eee);border:1px solid var(--pc-line,#444);border-radius:6px;padding:12px 14px;min-width:300px;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.5)";
      d.innerHTML = `<div style="font-weight:600;margin-bottom:8px">Text wrap - ${esc(L.name)}</div>
        <label class="kxrow"><input type="checkbox" id="wrapOn"${w.on ? " checked" : ""}> Paragraph text flows around this layer</label>
        <div class="kxrow"><span>Gap</span><input type="number" id="wrapOff" value="${+w.off || 0}" min="0" max="500" style="width:70px"> px</div>
        <div class="kxrow" style="justify-content:flex-end;gap:6px"><button class="ghost" id="wrapCancel">Cancel</button><button id="wrapOk">OK</button></div>`;
      doc.body.appendChild(d);
      $("wrapCancel").onclick = () => d.remove();
      $("wrapOk").onclick = () => { const on = $("wrapOn").checked, off = $("wrapOff").value; d.remove(); setWrap(L, on, off); say(on ? `text flows around ${L.name}` : `text wrap off for ${L.name}`); };
    }

    /* ---- the Properties panel */
    E.ui.propsExtra = (E.ui.propsExtra || []).concat([(A, box) => {
      if (!A || A.type === "group" || A.type === "adjust") return;
      const row = doc.createElement("div"); row.id = "ppFlow"; row.style.marginTop = "6px";
      if (isFrame(A)) {
        const arr = A.text.flow ? storyOf(A) : [], nth = arr.findIndex((f) => f.L === A) + 1;
        row.innerHTML = `<div class="kxrow"><b>⛓ Text flow</b><span style="color:var(--pc-dim)">${arr.length > 1 ? `frame ${nth} of ${arr.length}` : "one frame"}</span></div>
          <div class="kxrow" style="flex-wrap:wrap;gap:4px"><button class="ghost" id="ppFlHere" title="A new frame beside this one - the text goes on in it">＋ Frame</button><button class="ghost" id="ppFlNext" title="A new frame on the next page, in the same place">＋ Next page</button><button class="ghost" id="ppFlStory" title="The whole story in a box">✎ Story…</button>${arr.length > 1 ? '<button class="ghost" id="ppFlUnlink" title="Break the chain before this frame">⛓ Unlink</button>' : ""}</div>`;
        box.appendChild(row);
        $("ppFlHere").onclick = () => addHere(); $("ppFlNext").onclick = () => addNextPage(); $("ppFlStory").onclick = () => storyDialog();
        if ($("ppFlUnlink")) $("ppFlUnlink").onclick = () => unlink();
      } else {
        const w = A.wrap || { on: false, off: 12 };
        row.innerHTML = `<div class="kxrow" title="Paragraph text on this page flows around this layer"><label><input type="checkbox" id="ppWrapOn"${w.on ? " checked" : ""}> Text wrap</label><span>gap</span><input type="number" id="ppWrapOff" value="${+w.off || 0}" min="0" max="500" style="width:56px"><span>px</span></div>`;
        box.appendChild(row);
        const apply = () => setWrap(A, $("ppWrapOn").checked, $("ppWrapOff").value);
        $("ppWrapOn").onchange = apply; $("ppWrapOff").onchange = apply;
      }
    }]);
    const C = E.ui.addCmd, has = () => !!curFrame();
    C("flow.here", "Text Flow: Add Frame Here", "", addHere, { enabled: has }, ["Layer", "type.workpath", true]);
    C("flow.next", "Text Flow: Add Frame on the Next Page", "", addNextPage, { enabled: has }, ["Layer", "flow.here"]);
    C("flow.story", "Text Flow: Edit Story…", "", storyDialog, { enabled: has }, ["Layer", "flow.next"]);
    C("flow.unlink", "Text Flow: Unlink Frame", "", unlink, { enabled: () => { const L = curFrame(); return !!(L && L.text.flow); } }, ["Layer", "flow.story"]);
    C("flow.wrap", "Text Wrap…", "", wrapDialog, { enabled: () => { const L = E.layer(); return !!L && !isFrame(L); } }, ["Layer", "flow.unlink"]);
    E.flow = { reflow, addHere, addNextPage, unlink, storyDialog, wrapDialog, setWrap, stories, isFrame };
  }

  const pure = { boundaries, flow, clipPoly, shapePoly, rectPoly, holesFor };
  const api = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCFlow = api;
})(typeof window !== "undefined" ? window : globalThis);
