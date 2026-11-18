/* ext/slidesdock/slidesdock.js — 🎞 SLIDES (2.831.0): the docker - the slide list, the slide being edited, the tools, the
 * files. window.H3Slides. Tim: "can you add the slides now please".
 *
 *   THE LIST    a picture of every slide; click = that slide; drag = a new place; right-click = new slide (a layout) /
 *               duplicate / delete / hide in the show / move; Ctrl+M a new slide, Delete deletes the slide (list focused)
 *   THE SLIDE   click = pick (Shift / Ctrl = more), drag = move (snaps to the slide's middle / edges and other items - pink
 *               lines), the white squares = size (Shift = keep its shape; a picture keeps it unless Shift), a drag on the
 *               empty slide = a box picking what it touches; double-click (or Enter / F2) a text or shape = type in it
 *               (Esc / a click outside = done); arrows nudge (Shift = 10 px), Ctrl+D duplicate, Ctrl+C / X / V, Ctrl+A,
 *               Delete; Ctrl+B / I / U; Page Up / Down = the slide before / after; F5 present, Shift+F5 from here
 *   PICTURES    🖼 Picture, a drop of picture files, Ctrl+V of a picture - into the slide's empty picture box when it has
 *               one; kept once in deck.media (scaled to 1920 px at most)
 *   LOOKS       the theme (🎨: background, colours, fonts), a slide's own background, font / size / B I U / colour /
 *               align / top-middle-bottom / bullets, a shape's fill / outline, front / back, the slide's transition
 *   FILES       📄 New ▾ (a theme, 16:9 / 4:3), 📂 Open ▾, 💾 Save (Ctrl+S) -> projects/<p>/slides/<name>.bgk; what you do
 *               is kept in this browser as you go (a draft); ⤓ PowerPoint = POST /api/slides/export/pptx
 *   UNDO        Ctrl+Z / Ctrl+Y (80 steps; the pictures are not copied by a step)
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const K = () => root.SlideCore;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const St = { deck: null, cur: 0, sel: new Set(), undo: [], redo: [], dirty: false, name: "Presentation", edit: null, drag: null, clip: null, booted: false, scale: 1, noteStep: false };
  const D = () => St.deck;
  const slide = () => D().slides[St.cur];
  const item = (id) => (slide().items || []).find((i) => i.id === id);
  const picked = () => slide().items.filter((i) => St.sel.has(i.id));

  /* ---------------------------------------------------------------- the model */
  function snapshot() { const d = D(); return JSON.stringify({ w: d.w, h: d.h, theme: d.theme, slides: d.slides, cur: St.cur }); }
  function step() { St.undo.push(snapshot()); if (St.undo.length > 80) St.undo.shift(); St.redo = []; }
  function undo(redo) {
    if (St.edit) endEdit(true);
    const from = redo ? St.redo : St.undo, to = redo ? St.undo : St.redo;
    if (!from.length) return msg(redo ? "nothing to redo" : "nothing to undo");
    to.push(snapshot()); const s = JSON.parse(from.pop()), d = D();
    d.w = s.w; d.h = s.h; d.theme = s.theme; d.slides = s.slides; St.cur = Math.min(s.cur, d.slides.length - 1); St.sel.clear();
    changed();
  }
  let draftT = 0;
  function draft() { clearTimeout(draftT); draftT = setTimeout(() => { try { root.localStorage.setItem("h3.slides.draft", JSON.stringify({ name: St.name, deck: D() })); } catch (e) { /* too big for the browser - Save keeps it */ } }, 700); }
  function changed(noDraft) { St.dirty = true; if (!noDraft) draft(); paint(); }
  const mediaUrl = (src) => (src && src.startsWith("media:") ? D().media[src.slice(6)] || "" : "");

  /* ---------------------------------------------------------------- drawing a slide */
  /** a slide as DOM, w x h slide px. mode: "edit" (hints, placeholders shown) | "show" | "thumb" */
  function renderSlide(s, deck, mode) {
    const T = K().theme(deck), el = doc.createElement("div");
    el.className = "slslide"; el.style.width = deck.w + "px"; el.style.height = deck.h + "px"; el.style.background = K().bgOf(s, deck);
    el.style.setProperty("--sl-accent", T.accent);
    for (const it of s.items) el.appendChild(renderItem(it, deck, mode));
    return el;
  }
  function textHtml(it, deck, mode) {
    const L = K().textLook(it, deck), t = String(it.text || "");
    const box = `font-family:'${L.font}',sans-serif;font-size:${L.size}px;color:${L.color};font-weight:${L.b ? 700 : 400};font-style:${L.i ? "italic" : "normal"};text-decoration:${L.u ? "underline" : "none"};text-align:${L.align};justify-content:${{ top: "flex-start", middle: "center", bottom: "flex-end" }[L.valign]}`;
    let inner;
    if (!t && it.role && mode === "edit") inner = `<div class="p hint">${esc(K().HINTS[it.role] || "")}</div>`;
    else inner = t.split("\n").map((p) => `<div class="p">${esc(p)}</div>`).join("");
    return `<div class="tx${L.bullets ? " bul" : ""}" style="${box}">${inner}</div>`;
  }
  function renderItem(it, deck, mode) {
    const e = doc.createElement("div");
    e.className = "it " + it.type; e.dataset.id = it.id;
    e.style.cssText = `left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px;${it.rot ? `transform:rotate(${it.rot}deg);` : ""}`;
    const empty = it.type === "image" ? !mediaUrl(it.src) : !String(it.text || "");
    if (it.role && empty && mode === "edit") e.classList.add("ph");
    if (it.type === "text") e.innerHTML = textHtml(it, deck, mode);
    else if (it.type === "shape") {
      const S = K().shapeLook(it, deck), line = it.shape === "line";
      const stroke = line ? (S.fill === "none" ? S.line : S.fill) : S.line, sw = line ? Math.max(1, it.lw || 4) : S.lw;
      e.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${K().shapePath(it.shape)}" fill="${line || S.fill === "none" ? "none" : S.fill}" stroke="${stroke === "none" || !sw ? "none" : stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/></svg>`
        + (String(it.text || "") ? textHtml(Object.assign({}, it, { st: Object.assign({ align: "center", valign: "middle", color: "#ffffff" }, it.st || {}) }), deck, mode) : "");
      if (String(it.text || "")) e.lastChild.style.position = "relative";
    } else if ((it.type === "table" || it.type === "chart") && root.H3SlideData) {   // 2.835.0: slidedata.js
      e.innerHTML = root.H3SlideData.html(it, deck, mode);
    } else if (it.type === "image") {
      const u = mediaUrl(it.src);
      if (u) e.innerHTML = `<img alt="" draggable="false" src="${u}" style="object-fit:${it.fit === "contain" ? "contain" : "cover"}">`;
      else if (mode === "edit") { e.classList.add("empty"); e.textContent = it.role ? K().HINTS.pic : "🖼"; }
    }
    return e;
  }

  /* ---------------------------------------------------------------- painting */
  let raf = 0;
  function paint() { if (raf) return; raf = root.requestAnimationFrame(() => { raf = 0; paintNow(); }); }
  function paintNow() {
    if (!St.booted || !D()) return;
    if (St.cur >= D().slides.length) St.cur = D().slides.length - 1;
    paintStage(); paintList(); bars();
  }
  function fit() {
    const w = $("slStageWrap"); if (!w) return 1;
    const W = w.clientWidth - 24, H = w.clientHeight - 24;
    return Math.max(0.05, Math.min(W / D().w, H / D().h));
  }
  function paintStage() {
    const st = $("slStage"), w = $("slStageWrap"); if (!st || !w) return;
    if (St.edit) return;                                   // typing: leave the box alone
    const s = St.scale = fit();
    st.innerHTML = ""; st.style.width = D().w + "px"; st.style.height = D().h + "px";
    st.style.transform = `scale(${s})`;
    st.style.left = Math.round((w.clientWidth - D().w * s) / 2) + "px"; st.style.top = Math.round((w.clientHeight - D().h * s) / 2) + "px";
    st.appendChild(renderSlide(slide(), D(), "edit"));
    for (const id of St.sel) {
      const it = item(id); if (!it) { St.sel.delete(id); continue; }
      const el = st.querySelector(`.it[data-id="${id}"]`); if (el) el.classList.add("on");
    }
    if (St.sel.size === 1) handles(st, item([...St.sel][0]));
    if (St.guides) for (const g of St.guides) { const d = doc.createElement("div"); d.className = "guide"; const px = 1 / s; if (g.v) d.style.cssText = `left:${g.at}px;top:0;width:${px}px;height:${D().h}px`; else d.style.cssText = `top:${g.at}px;left:0;height:${px}px;width:${D().w}px`; st.appendChild(d); }
    if (St.band) { const b = St.band, d = doc.createElement("div"); d.className = "band"; d.style.cssText = `left:${Math.min(b.x0, b.x1)}px;top:${Math.min(b.y0, b.y1)}px;width:${Math.abs(b.x1 - b.x0)}px;height:${Math.abs(b.y1 - b.y0)}px`; st.appendChild(d); }
    $("slNotes").value = slide().notes || "";
  }
  const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  /** the 8 size handles + (2.832.0) the round turn handle above the box - in a frame turned with the item */
  function handles(st, it) {
    if (!it) return;
    const k = 6 / St.scale, fr = doc.createElement("div");
    fr.className = "hbox"; fr.style.cssText = `position:absolute;left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px;pointer-events:none;z-index:5;${it.rot ? `transform:rotate(${it.rot}deg);` : ""}`;
    for (const h of HANDLES) {
      const x = h.includes("w") ? 0 : h.includes("e") ? it.w : it.w / 2, y = h.includes("n") ? 0 : h.includes("s") ? it.h : it.h / 2;
      const d = doc.createElement("div"); d.className = "hd"; d.dataset.h = h;
      d.style.cssText = `left:${x - k}px;top:${y - k}px;width:${2 * k}px;height:${2 * k}px;border-width:${2 / St.scale}px;pointer-events:auto;cursor:${{ nw: "nwse", se: "nwse", ne: "nesw", sw: "nesw", n: "ns", s: "ns", e: "ew", w: "ew" }[h]}-resize`;
      fr.appendChild(d);
    }
    const up = 28 / St.scale, r = 7 / St.scale;
    const ln = doc.createElement("div"); ln.className = "rotl"; ln.style.cssText = `left:${it.w / 2 - 0.5 / St.scale}px;top:${-up}px;width:${1 / St.scale}px;height:${up}px`; fr.appendChild(ln);
    const rt = doc.createElement("div"); rt.className = "rot"; rt.title = "Turn (Shift = 15° steps)"; rt.style.cssText = `left:${it.w / 2 - r}px;top:${-up - r}px;width:${2 * r}px;height:${2 * r}px;border-width:${2 / St.scale}px;pointer-events:auto`; fr.appendChild(rt);
    st.appendChild(fr);
  }
  let listT = 0;
  function paintList() {
    clearTimeout(listT); listT = setTimeout(paintListNow, St.drag ? 250 : 30);
  }
  function paintListNow() {
    const L = $("slList"); if (!L || !D()) return;
    const TW = Math.max(60, L.clientWidth - 30), k = TW / D().w, TH = Math.round(D().h * k), top = L.scrollTop;
    L.innerHTML = "";
    D().slides.forEach((s, i) => {
      const th = doc.createElement("div"); th.className = "th" + (i === St.cur ? " on" : "") + (s.hidden ? " hid" : ""); th.dataset.i = i;
      { const nm = K().titleOf(s) || `Slide ${i + 1}`; th.title = s.hidden ? `${nm} (hidden in the show)` : nm; }
      th.innerHTML = `<span class="n">${i + 1}</span><div class="pv" style="height:${TH}px"></div>`;
      const sl = renderSlide(s, D(), "thumb"); sl.style.transform = `scale(${k})`; sl.style.transformOrigin = "0 0"; sl.style.position = "absolute"; sl.style.pointerEvents = "none";
      th.querySelector(".pv").appendChild(sl); L.appendChild(th);
    });
    const add = doc.createElement("button"); add.className = "ghost add"; add.type = "button"; add.id = "slListAdd"; add.textContent = "＋ New slide"; add.title = "A new slide at the end (right-click: pick its layout)"; L.appendChild(add);
    L.scrollTop = top;
    const on = L.querySelector(".th.on"); if (on && !St.listKeep) { const r = on.getBoundingClientRect(), lr = L.getBoundingClientRect(); if (r.top < lr.top || r.bottom > lr.bottom) on.scrollIntoView({ block: "nearest" }); }
    St.listKeep = false;
  }
  function bars() {
    const its = picked(), first = its[0], L = first && first.type !== "image" ? K().textLook(first, D()) : null;
    const set = (id, v) => { const e = $(id); if (e && doc.activeElement !== e) e.value = v; };
    set("slFont", L ? L.font : K().theme(D()).font); set("slSize", L ? L.size : "");
    for (const [id, k] of [["slB", "b"], ["slI", "i"], ["slU", "u"], ["slBul", "bullets"]]) { const b = $(id); if (b) b.classList.toggle("on", !!(L && L[k])); }
    for (const [id, a] of [["slAL", "left"], ["slAC", "center"], ["slAR", "right"]]) { const b = $(id); if (b) b.classList.toggle("on", !!(L && L.align === a)); }
    set("slColor", L ? L.color : K().theme(D()).text);
    const sh = its.find((i) => i.type === "shape"), SL = sh ? K().shapeLook(sh, D()) : null;
    set("slFill", SL && SL.fill !== "none" ? SL.fill : K().theme(D()).accent); set("slLine", SL && SL.line !== "none" ? SL.line : "#000000"); set("slLw", SL ? SL.lw : 0);
    set("slTrans", slide().transition || "none"); set("slBg", K().bgOf(slide(), D()));
    const f = $("slFile"); if (f && doc.activeElement !== f) f.value = St.name;
  }
  function msg(t, bad) { const m = $("slMsg"); if (!m) return; m.textContent = t || ""; m.classList.toggle("bad", !!bad); m.title = t || ""; }

  /* ---------------------------------------------------------------- slides */
  function go(i) { if (St.edit) endEdit(); St.cur = Math.max(0, Math.min(D().slides.length - 1, i)); St.sel.clear(); paint(); }
  function addSlide(layout, at) { if (St.edit) endEdit(); step(); const s = K().newSlide(layout || (slide() && slide().layout !== "title" ? slide().layout : "content"), D()); const i = at == null ? St.cur + 1 : at; D().slides.splice(i, 0, s); St.cur = i; St.sel.clear(); changed(); msg("＋ slide " + (i + 1) + " - " + K().LAYOUTS[s.layout]); return s; }
  function dupSlide(i) { step(); const c = K().copySlide(D().slides[i]); D().slides.splice(i + 1, 0, c); St.cur = i + 1; St.sel.clear(); changed(); }
  function delSlide(i) {
    if (D().slides.length < 2) return msg("a presentation keeps at least one slide", true);
    step(); D().slides.splice(i, 1); St.cur = Math.min(i, D().slides.length - 1); St.sel.clear(); changed();
  }
  function moveSlide(i, j) { if (i === j || j < 0 || j >= D().slides.length) return; step(); K().moveSlide(D(), i, j); St.cur = j; changed(); }

  /* ---------------------------------------------------------------- items */
  function addItem(it, edit) {
    if (St.edit) endEdit(); step(); slide().items.push(it); St.sel = new Set([it.id]); changed();
    if (edit) setTimeout(() => startEdit(it.id, true), 40);
    return it;
  }
  function addText() { const d = D(); return addItem({ id: K().uid(), type: "text", x: Math.round(d.w / 2 - 260), y: Math.round(d.h / 2 - 40), w: 520, h: 80, text: "", st: { size: 32 } }, true); }
  function addShape(kind) {
    const d = D(), line = kind === "line";
    return addItem({ id: K().uid(), type: "shape", shape: kind, x: Math.round(d.w / 2 - 140), y: Math.round(d.h / 2 - (line ? 10 : 90)), w: 280, h: line ? 20 : 180, text: "", lw: line ? 4 : 0 });
  }
  function delItems() {
    if (!St.sel.size) return;
    step(); const s = slide();
    // a placeholder is emptied, not removed, the first time (it keeps the layout); a second Delete removes it
    s.items = s.items.filter((i) => { if (!St.sel.has(i.id)) return true; if (i.role && (i.text || i.src)) { i.text = i.type === "image" ? undefined : ""; if (i.type === "image") i.src = ""; return true; } return false; });
    St.sel.clear(); changed();
  }
  function dupItems() {
    const its = picked(); if (!its.length) return; step();
    const ids = new Set();
    for (const it of its) { const c = JSON.parse(JSON.stringify(it)); c.id = K().uid(); c.x += 20; c.y += 20; delete c.role; slide().items.push(c); ids.add(c.id); }
    St.sel = ids; changed();
  }
  function order(front) {
    const its = picked(); if (!its.length) return; step();
    const rest = slide().items.filter((i) => !St.sel.has(i.id));
    slide().items = front ? rest.concat(its) : its.concat(rest); changed();
  }
  function nudge(dx, dy) { const its = picked(); if (!its.length) return; step(); for (const it of its) { it.x += dx; it.y += dy; } changed(); }
  function style(fn, label) {
    if (St.edit) endEdit();
    const its = picked().filter((i) => i.type !== "image"); if (!its.length) return msg("pick a text box or a shape first", true);
    step(); for (const it of its) { it.st = Object.assign({}, it.st || {}); fn(it.st, it); } changed(); if (label) msg(label);
  }
  function shapeStyle(fn) { const its = picked().filter((i) => i.type === "shape"); if (!its.length) return msg("pick a shape first", true); step(); for (const it of its) fn(it); changed(); }
  function copyItems(cut) {
    const its = picked(); if (!its.length) return false;
    const media = {}; for (const it of its) if (it.src) media[it.src.slice(6)] = D().media[it.src.slice(6)];
    St.clip = JSON.stringify({ items: its, media });
    try { root.localStorage.setItem("h3.slides.clip", St.clip.length < 3e6 ? St.clip : ""); } catch (e) { /* fine */ }
    if (cut) { step(); slide().items = slide().items.filter((i) => !St.sel.has(i.id)); St.sel.clear(); changed(); }
    msg(cut ? "✂ cut" : "copied"); return true;
  }
  function pasteItems() {
    let c = St.clip; if (!c) try { c = root.localStorage.getItem("h3.slides.clip"); } catch (e) { c = null; }
    if (!c) return false;
    const j = JSON.parse(c); step(); const ids = new Set();
    Object.assign(D().media, j.media || {});
    for (const it of j.items) { const n = Object.assign({}, it, { id: K().uid() }); delete n.role; if (slide().items.some((x) => x.x === n.x && x.y === n.y)) { n.x += 20; n.y += 20; } slide().items.push(n); ids.add(n.id); }
    St.sel = ids; changed(); return true;
  }

  /* ---------------------------------------------------------------- pictures */
  function readPicture(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error("could not read " + file.name));
      fr.onload = () => {
        const url = String(fr.result);
        if (/^data:image\/svg/.test(url)) return res({ url, w: 800, h: 600 });
        const im = new Image();
        im.onload = () => {
          const MAXS = 1920, k = Math.min(1, MAXS / Math.max(im.naturalWidth, im.naturalHeight));
          if (k >= 1 && url.length < 6e6) return res({ url, w: im.naturalWidth, h: im.naturalHeight });
          const c = doc.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          res({ url: /jpe?g/i.test(file.type) ? c.toDataURL("image/jpeg", 0.9) : c.toDataURL("image/png"), w: c.width, h: c.height });
        };
        im.onerror = () => rej(new Error(file.name + " is not a picture this browser can show"));
        im.src = url;
      };
      fr.readAsDataURL(file);
    });
  }
  async function addPictures(files, at) {
    const list = [...files].filter((f) => /^image\//.test(f.type)); if (!list.length) return msg("no picture in that", true);
    if (St.edit) endEdit();
    let first = true;
    for (const f of list) {
      let p; try { p = await readPicture(f); } catch (e) { msg("✗ " + e.message, true); continue; }
      const id = "m" + K().uid().slice(1); D().media[id] = p.url;
      if (first) step(); first = false;
      const s = slide(), d = D(), holder = s.items.find((i) => i.type === "image" && St.sel.has(i.id) && !mediaUrl(i.src)) || s.items.find((i) => i.type === "image" && i.role === "pic" && !mediaUrl(i.src));
      if (holder) { holder.src = "media:" + id; St.sel = new Set([holder.id]); continue; }
      const k = Math.min(1, d.w * 0.6 / p.w, d.h * 0.6 / p.h), w = Math.round(p.w * k), h = Math.round(p.h * k);
      const x = at ? Math.round(at.x - w / 2) : Math.round((d.w - w) / 2), y = at ? Math.round(at.y - h / 2) : Math.round((d.h - h) / 2);
      const it = { id: K().uid(), type: "image", x, y, w, h, src: "media:" + id, fit: "cover" }; s.items.push(it); St.sel = new Set([it.id]);
    }
    changed(); msg("🖼 picture added - drag its corners to size it");
  }

  /* ---------------------------------------------------------------- typing in a box */
  function startEdit(id, fresh) {
    const it = item(id); if (!it || it.type === "image") return;
    if (St.edit) endEdit();
    St.sel = new Set([id]); paintNow();
    const el = $("slStage").querySelector(`.it[data-id="${id}"]`); if (!el) return;
    let tx = el.querySelector(".tx");
    if (!tx) { el.insertAdjacentHTML("beforeend", textHtml(Object.assign({}, it, { st: Object.assign({ align: "center", valign: "middle", color: "#ffffff" }, it.st || {}) }), D(), "show")); tx = el.querySelector(".tx"); tx.style.position = "relative"; }
    St.edit = { id, before: it.text || "", fresh };
    el.classList.add("edit"); el.classList.remove("ph");
    tx.textContent = it.text || ""; tx.style.whiteSpace = "pre-wrap"; tx.style.display = "block";
    tx.contentEditable = "plaintext-only"; if (tx.contentEditable !== "plaintext-only") tx.contentEditable = "true";
    tx.spellcheck = true; tx.focus();
    const r = doc.createRange(); r.selectNodeContents(tx); if (it.text) r.collapse(false); const sel = root.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    tx.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); endEdit(); $("slStageWrap").focus(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); endEdit(); save(); }
      else if ((e.ctrlKey || e.metaKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) { e.preventDefault(); const k = { b: "b", i: "i", u: "u" }[e.key.toLowerCase()]; endEdit(); style((s) => { s[k] = !s[k] || undefined; }); startEdit(id); }
    });
    msg("typing - Esc or a click outside the box = done");
  }
  function endEdit(quiet) {
    const E = St.edit; if (!E) return;
    St.edit = null;
    const el = $("slStage").querySelector(`.it[data-id="${E.id}"] .tx`), it = item(E.id);
    if (el && it) {
      const t = (el.innerText || "").replace(/\r/g, "").replace(/\n$/, "");
      if (t !== (it.text || "")) { St.undo.push(JSON.stringify(Object.assign(JSON.parse(snapshot()), { slides: JSON.parse(snapshot()).slides.map((s) => (s.items.some((i) => i.id === E.id) ? Object.assign({}, s, { items: s.items.map((i) => (i.id === E.id ? Object.assign({}, i, { text: E.before }) : i)) }) : s)) }))); St.redo = []; it.text = t; St.dirty = true; draft(); }
      else if (E.fresh && !t && !it.role) { slide().items = slide().items.filter((i) => i.id !== E.id); St.sel.clear(); }
    }
    if (!quiet) msg("");
    paint();
  }

  /* ---------------------------------------------------------------- the pointer on the slide */
  const toSlide = (e) => { const r = $("slStage").getBoundingClientRect(); return { x: (e.clientX - r.left) / St.scale, y: (e.clientY - r.top) / St.scale }; };
  function snapMove(boxes, dx, dy) {
    // the picked items' bounding box snaps its edges / middle to the slide's and the other items' (6 screen px)
    const tol = 6 / St.scale, d = D(), others = slide().items.filter((i) => !St.sel.has(i.id));
    const bx = { x0: Math.min(...boxes.map((b) => b.x)) + dx, y0: Math.min(...boxes.map((b) => b.y)) + dy, x1: Math.max(...boxes.map((b) => b.x + b.w)) + dx, y1: Math.max(...boxes.map((b) => b.y + b.h)) + dy };
    const vx = [0, d.w / 2, d.w].concat(...others.map((o) => [o.x, o.x + o.w / 2, o.x + o.w])), vy = [0, d.h / 2, d.h].concat(...others.map((o) => [o.y, o.y + o.h / 2, o.y + o.h]));
    const guides = [];
    const best = (mine, lines) => { let b = null; for (const m of mine) for (const l of lines) { const dd = l - m; if (Math.abs(dd) <= tol && (!b || Math.abs(dd) < Math.abs(b.d))) b = { d: dd, at: l }; } return b; };
    const sx = best([bx.x0, (bx.x0 + bx.x1) / 2, bx.x1], vx), sy = best([bx.y0, (bx.y0 + bx.y1) / 2, bx.y1], vy);
    if (sx) { dx += sx.d; guides.push({ v: true, at: sx.at }); }
    if (sy) { dy += sy.d; guides.push({ v: false, at: sy.at }); }
    return { dx, dy, guides };
  }
  function onStageDown(e) {
    if (e.button !== 0) return;
    const p = toSlide(e), hd = e.target.closest(".hd"), itEl = e.target.closest(".it");
    if (St.edit) { if (itEl && itEl.dataset.id === St.edit.id) return; endEdit(); }
    $("slStageWrap").focus({ preventScroll: true });
    if (e.target.closest(".rot") && St.sel.size === 1) { const it = item([...St.sel][0]); St.drag = { kind: "rot", it, r0: it.rot || 0 }; e.preventDefault(); return; }
    if (hd && St.sel.size === 1) {
      const it = item([...St.sel][0]); St.drag = { kind: "size", h: hd.dataset.h, it, b0: { x: it.x, y: it.y, w: it.w, h: it.h }, p0: p }; e.preventDefault(); return;
    }
    if (itEl) {
      const id = itEl.dataset.id;
      if (e.shiftKey || e.ctrlKey || e.metaKey) { if (St.sel.has(id)) St.sel.delete(id); else St.sel.add(id); paint(); return; }
      if (!St.sel.has(id)) St.sel = new Set([id]);
      St.drag = { kind: "move", p0: p, boxes: picked().map((i) => ({ it: i, x: i.x, y: i.y, w: i.w, h: i.h })) };
      paint(); e.preventDefault(); return;
    }
    if (!(e.shiftKey || e.ctrlKey)) St.sel.clear();
    St.drag = { kind: "band", p0: p, keep: new Set(St.sel) }; St.band = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; paint();
  }
  function onMove(e) {
    const d = St.drag; if (!d) return;
    const p = toSlide(e);
    if (d.kind === "move") {
      let dx = p.x - d.p0.x, dy = p.y - d.p0.y;
      if (!d.moved && Math.hypot(dx, dy) * St.scale < 3) return;
      if (!d.moved) { step(); d.moved = true; }
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const s = e.altKey ? { dx, dy, guides: [] } : snapMove(d.boxes, dx, dy);
      for (const b of d.boxes) { b.it.x = Math.round(b.x + s.dx); b.it.y = Math.round(b.y + s.dy); }
      St.guides = s.guides; paintStage();
    } else if (d.kind === "size") {
      if (!d.moved) { step(); d.moved = true; }
      const b = d.b0, it = d.it, h = d.h, gx = p.x - d.p0.x, gy = p.y - d.p0.y;
      // 2.832.0: in the item's own (turned) frame - the opposite side stays where it is on the slide
      const th = (it.rot || 0) * Math.PI / 180, co = Math.cos(th), si = Math.sin(th), dx = gx * co + gy * si, dy = -gx * si + gy * co;
      let x0 = 0, y0 = 0, x1 = b.w, y1 = b.h;
      if (h.includes("w")) x0 += dx; if (h.includes("e")) x1 += dx; if (h.includes("n")) y0 += dy; if (h.includes("s")) y1 += dy;
      const keep = it.type === "image" ? !e.shiftKey : e.shiftKey;
      if (keep && h.length === 2) {                        // a corner keeps the shape
        const k = Math.max(Math.abs(x1 - x0) / b.w, Math.abs(y1 - y0) / b.h);
        const nw = b.w * k, nh = b.h * k;
        if (h.includes("w")) x0 = x1 - nw; else x1 = x0 + nw; if (h.includes("n")) y0 = y1 - nh; else y1 = y0 + nh;
      }
      const nw = Math.max(4, Math.abs(x1 - x0)), nh = Math.max(4, Math.abs(y1 - y0)), sx = (x0 + x1) / 2 - b.w / 2, sy = (y0 + y1) / 2 - b.h / 2;
      const cx = b.x + b.w / 2 + sx * co - sy * si, cy = b.y + b.h / 2 + sx * si + sy * co;
      it.x = Math.round(cx - nw / 2); it.y = Math.round(cy - nh / 2); it.w = Math.round(nw); it.h = Math.round(nh);
      paintStage();
    } else if (d.kind === "rot") {
      if (!d.moved) { step(); d.moved = true; }
      const it = d.it, cx = it.x + it.w / 2, cy = it.y + it.h / 2;
      let a = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
      if (e.shiftKey) a = Math.round(a / 15) * 15; else for (const q of [0, 90, 180, 270, 360, -90]) if (Math.abs(a - q) < 3) a = q;
      a = ((Math.round(a) + 540) % 360) - 180;
      if (a) it.rot = a; else delete it.rot;
      msg(`turned ${a}°`); paintStage();
    } else if (d.kind === "band") {
      const B = St.band; B.x1 = p.x; B.y1 = p.y;
      const x0 = Math.min(B.x0, B.x1), x1 = Math.max(B.x0, B.x1), y0 = Math.min(B.y0, B.y1), y1 = Math.max(B.y0, B.y1);
      St.sel = new Set(d.keep); for (const it of slide().items) if (it.x < x1 && it.x + it.w > x0 && it.y < y1 && it.y + it.h > y0) St.sel.add(it.id);
      paintStage();
    } else if (d.kind === "list") listMove(e);
  }
  function onUp(e) {
    const d = St.drag; if (!d) return;
    St.drag = null; St.guides = null; St.band = null;
    if (d.moved) changed(); else paint();
  }

  /* ---------------------------------------------------------------- the slide list */
  function listDown(e) {
    const th = e.target.closest(".th");
    if (e.target.closest("#slListAdd")) { addSlide(null, D().slides.length); return; }
    if (!th || e.button !== 0) return;
    const i = +th.dataset.i; St.listKeep = true; go(i); $("slList").focus({ preventScroll: true });
    St.drag = { kind: "list", from: i, y0: e.clientY };
  }
  function dropIndex(y) {
    const ths = [...$("slList").querySelectorAll(".th")];
    for (const t of ths) { const r = t.getBoundingClientRect(); if (y < r.top + r.height / 2) return +t.dataset.i; }
    return ths.length;
  }
  function listMove(e) {
    const d = St.drag; if (!d.moved && Math.abs(e.clientY - d.y0) < 6) return; d.moved = true;
    const at = dropIndex(e.clientY); d.at = at;
    $("slList").querySelectorAll(".th").forEach((t) => t.classList.toggle("drop", +t.dataset.i === at));
  }
  function listMenu(i, x, y) {
    const s = D().slides[i];
    const m = menu(x, y, `<div data-a="new">＋ New slide after this</div>${Object.entries(K().LAYOUTS).map(([k, n]) => `<div data-a="new:${k}" style="padding-left:28px">${esc(n)}</div>`).join("")}<hr>`
      + `<div data-a="dup">⧉ Duplicate slide</div><div data-a="hide">${s.hidden ? "👁 Show in the presentation" : "🙈 Hide in the presentation"}</div><div data-a="up">▲ Move up</div><div data-a="down">▼ Move down</div><hr><div data-a="del">🗑 Delete slide</div>`);
    m.addEventListener("click", (e) => {
      const a = (e.target.closest("[data-a]") || {}).dataset; if (!a || !a.a) return; m.remove();
      if (a.a === "new") addSlide(null, i + 1); else if (a.a.startsWith("new:")) addSlide(a.a.slice(4), i + 1);
      else if (a.a === "dup") dupSlide(i); else if (a.a === "del") delSlide(i);
      else if (a.a === "up") moveSlide(i, i - 1); else if (a.a === "down") moveSlide(i, i + 1);
      else if (a.a === "hide") { step(); s.hidden = !s.hidden || undefined; changed(); }
    });
  }

  /* ---------------------------------------------------------------- menus */
  function menu(x, y, html) {
    doc.querySelectorAll(".slmenu").forEach((m) => m.remove());
    const m = doc.createElement("div"); m.className = "slmenu"; m.innerHTML = html; m.style.left = Math.round(x) + "px"; m.style.top = Math.round(y) + "px";
    doc.body.appendChild(m);
    const r = m.getBoundingClientRect(); if (r.bottom > root.innerHeight) m.style.top = Math.max(4, root.innerHeight - r.height - 4) + "px"; if (r.right > root.innerWidth) m.style.left = Math.max(4, root.innerWidth - r.width - 4) + "px";
    setTimeout(() => doc.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target)) { m.remove(); doc.removeEventListener("pointerdown", off, true); } }, true), 0);
    return m;
  }
  const below = (btn, html) => { const r = btn.getBoundingClientRect(); return menu(r.left, r.bottom + 2, html); };
  function themeSw(id) { const T = K().THEMES[id]; return `<span class="sw" style="background:${T.bg};border-left:6px solid ${T.accent}"></span>`; }
  function layoutMenu(btn, onPick) {
    const m = below(btn, Object.entries(K().LAYOUTS).map(([k, n]) => `<div data-l="${k}"${slide().layout === k && !onPick ? ' class="on"' : ""}>${esc(n)}</div>`).join(""));
    m.addEventListener("click", (e) => { const it = e.target.closest("[data-l]"); if (!it) return; m.remove(); (onPick || ((l) => { if (St.edit) endEdit(); step(); K().relayout(slide(), l, D()); St.sel.clear(); changed(); msg("▤ " + K().LAYOUTS[l]); }))(it.dataset.l); });
  }
  function themeMenu(btn) {
    const m = below(btn, Object.entries(K().THEMES).map(([k, T]) => `<div data-t="${k}"${D().theme === k ? ' class="on"' : ""}>${themeSw(k)} ${esc(T.name)} <span style="color:var(--dim);font-family:'${T.font}'">${esc(T.font)}</span></div>`).join(""));
    m.addEventListener("click", (e) => { const it = e.target.closest("[data-t]"); if (!it) return; m.remove(); step(); D().theme = it.dataset.t; changed(); msg("🎨 " + K().THEMES[it.dataset.t].name); });
    if (root.H3SlideBrand) root.H3SlideBrand.extend(m);                   // 2.835.0: brand themes (slidebrand.js)
  }
  const SHAPE_NAMES = { rect: "▭ Rectangle", round: "▢ Rounded rectangle", ellipse: "◯ Ellipse", triangle: "△ Triangle", diamond: "◇ Diamond", rarrow: "➜ Arrow right", larrow: "⬅ Arrow left", star: "☆ Star", line: "╱ Line" };
  function shapeMenu(btn) { const m = below(btn, K().SHAPES.map((k) => `<div data-s="${k}">${SHAPE_NAMES[k]}</div>`).join("")); m.addEventListener("click", (e) => { const it = e.target.closest("[data-s]"); if (!it) return; m.remove(); addShape(it.dataset.s); }); }
  function stageMenu(x, y) {
    const n = St.sel.size;
    const m = menu(x, y, (n ? `<div data-a="cut">✂ Cut</div><div data-a="copy">⧉ Copy</div>` : "") + `<div data-a="paste">📋 Paste</div>` + (picked().some((i) => i.type === "table" || i.type === "chart") ? `<div data-a="data">✎ Edit ${picked().some((i) => i.type === "chart") ? "chart data" : "table"}…</div>` : "") + (n ? `<div data-a="dup">⧉ Duplicate</div><hr><div data-a="front">⇡ Bring to front</div><div data-a="back">⇣ Send to back</div>` + (picked().some((i) => i.type === "image") ? `<div data-a="fit">⤢ Fit / fill the box</div>` : "") + `<hr><div data-a="del">🗑 Delete</div>` : `<hr><div data-a="text">🅃 Text box</div><div data-a="pic">🖼 Picture…</div><div data-a="layout">▤ Layout…</div>`));
    m.addEventListener("click", (e) => {
      const a = (e.target.closest("[data-a]") || {}).dataset; if (!a || !a.a) return; m.remove();
      if (a.a === "data") { const t = picked().find((i) => i.type === "table" || i.type === "chart"); if (t && root.H3SlideData) root.H3SlideData.edit(t); return; }   // 2.835.0
      ({ cut: () => copyItems(true), copy: () => copyItems(false), paste: () => pasteItems() || msg("nothing copied yet"), dup: dupItems, front: () => order(true), back: () => order(false), del: delItems,
        text: addText, pic: () => $("slPicFile").click(), layout: () => layoutMenu($("slLayout")),
        fit: () => { step(); for (const it of picked()) if (it.type === "image") it.fit = it.fit === "contain" ? "cover" : "contain"; changed(); } })[a.a]();
    });
  }

  /* ---------------------------------------------------------------- files */
  async function api(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) throw new Error((j && j.error) || "HTTP " + r.status);
    return j || {};
  }
  async function save() {
    if (St.edit) endEdit();
    const name = ($("slFile").value || "Presentation").trim();
    try { const r = await api("POST", "/api/slides/file", { name, deck: D() }); St.name = r.name.replace(/\.bgk$/i, ""); St.dirty = false; draft(); bars(); msg("💾 saved " + r.name); return r; }
    catch (e) { msg("✗ " + e.message, true); return null; }
  }
  async function okToLeave() { return !St.dirty || typeof root.appConfirm !== "function" || await root.appConfirm(`"${St.name}" has changes that are not saved. Leave it?`, "Not saved"); }
  function load(deck, name) {
    St.deck = K().clean(deck); St.name = name || "Presentation"; St.cur = 0; St.sel.clear(); St.undo = []; St.redo = []; St.dirty = false;
    draft(); paint();
  }
  async function openMenu(btn) {
    let files = []; try { files = (await api("GET", "/api/slides")).files || []; } catch (e) { return msg("✗ " + e.message, true); }
    const m = below(btn, files.length ? files.map((f) => `<div data-f="${esc(f.name)}" data-noi18n>🎞 ${esc(f.name.replace(/\.bgk$/i, ""))} <span style="color:var(--dim)">${new Date(f.mtime).toLocaleString()}</span></div>`).join("") : `<div style="color:var(--dim)">no presentations in this project yet - 💾 Save one</div>`);
    m.addEventListener("click", async (e) => {
      const it = e.target.closest("[data-f]"); if (!it) return; m.remove();
      if (!(await okToLeave())) return;
      try { const d = await api("GET", "/api/slides/file?name=" + encodeURIComponent(it.dataset.f)); load(d, it.dataset.f.replace(/\.bgk$/i, "")); msg("📂 " + it.dataset.f); } catch (er) { msg("✗ " + er.message, true); }
    });
  }
  function newMenu(btn) {
    const m = below(btn, Object.entries(K().THEMES).map(([k, T]) => `<div data-t="${k}">${themeSw(k)} ${esc(T.name)}</div>`).join("") + `<hr><label style="display:flex;gap:6px;padding:2px 12px"><input type="radio" name="slNewSz" value="16:9" checked> 16:9</label><label style="display:flex;gap:6px;padding:2px 12px"><input type="radio" name="slNewSz" value="4:3"> 4:3</label>`);
    m.addEventListener("click", async (e) => {
      const it = e.target.closest("[data-t]"); if (!it) return;
      const sz = (m.querySelector("input[name=slNewSz]:checked") || {}).value || "16:9"; m.remove();
      if (!(await okToLeave())) return;
      load(K().newDeck(it.dataset.t, sz), "Presentation"); msg("📄 a new presentation - " + K().THEMES[it.dataset.t].name);
    });
  }
  async function exportPptx() {
    if (St.edit) endEdit();
    const name = ($("slFile").value || St.name || "Presentation").trim();
    msg("⤓ making the PowerPoint file…");
    try {
      const r = await fetch("/api/slides/export/pptx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, deck: D() }) });
      if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) { j = null; } throw new Error((j && j.error) || "HTTP " + r.status); }
      const blob = await r.blob(), fn = decodeURIComponent(r.headers.get("X-File-Name") || name + ".pptx");
      const a = doc.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fn; doc.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      msg("⤓ " + fn + " - downloaded and kept in the slides folder");
      return { name: fn, size: blob.size };
    } catch (e) { msg("✗ " + e.message, true); return null; }
  }

  /* ---------------------------------------------------------------- keys */
  function onStageKey(e) {
    if (St.edit) return;
    const k = e.key, c = e.ctrlKey || e.metaKey;
    const done = () => { e.preventDefault(); e.stopPropagation(); };
    if (c && k.toLowerCase() === "z") { done(); return undo(e.shiftKey); }
    if (c && k.toLowerCase() === "y") { done(); return undo(true); }
    if (c && k.toLowerCase() === "s") { done(); return save(); }
    if (c && k.toLowerCase() === "m") { done(); return addSlide(); }
    if (c && k.toLowerCase() === "a") { done(); St.sel = new Set(slide().items.map((i) => i.id)); return paint(); }
    if (c && k.toLowerCase() === "d") { done(); return dupItems(); }
    if (c && k.toLowerCase() === "c") { if (copyItems(false)) done(); return; }
    if (c && k.toLowerCase() === "x") { if (copyItems(true)) done(); return; }
    if (c && ["b", "i", "u"].includes(k.toLowerCase())) { done(); const kk = k.toLowerCase(); return style((s) => { s[kk] = !s[kk] || undefined; }); }
    if (k === "F5" && e.altKey) { done(); return root.H3SlideShow && root.H3SlideShow.presenter(St.cur); }   // 2.832.0: Alt+F5 = the presenter view
    if (k === "F5") { done(); return root.H3SlideShow && root.H3SlideShow.start(e.shiftKey ? St.cur : 0); }
    if (k === "Delete" || k === "Backspace") { if (St.sel.size) { done(); delItems(); } return; }
    if (k === "Escape") { if (St.sel.size) { done(); St.sel.clear(); paint(); } return; }
    if ((k === "Enter" || k === "F2") && St.sel.size === 1) { done(); return startEdit([...St.sel][0]); }
    if (k === "PageDown") { done(); return go(St.cur + 1); }
    if (k === "PageUp") { done(); return go(St.cur - 1); }
    const ar = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (ar) { done(); if (!St.sel.size) return go(St.cur + (ar[0] || ar[1])); const n = e.shiftKey ? 10 : 1; return nudge(ar[0] * n, ar[1] * n); }
  }
  function onListKey(e) {
    const k = e.key, c = e.ctrlKey || e.metaKey, done = () => { e.preventDefault(); e.stopPropagation(); };
    if (k === "ArrowDown" || k === "PageDown") { done(); St.listKeep = false; return go(St.cur + 1); }
    if (k === "ArrowUp" || k === "PageUp") { done(); return go(St.cur - 1); }
    if (k === "Home") { done(); return go(0); } if (k === "End") { done(); return go(D().slides.length - 1); }
    if (k === "Delete" || k === "Backspace") { done(); return delSlide(St.cur); }
    if (c && k.toLowerCase() === "d") { done(); return dupSlide(St.cur); }
    if (c && k.toLowerCase() === "m") { done(); return addSlide(); }
    if (c && k.toLowerCase() === "z") { done(); return undo(e.shiftKey); }
    if (c && k.toLowerCase() === "y") { done(); return undo(true); }
    if (c && k.toLowerCase() === "s") { done(); return save(); }
    if (k === "Enter") { done(); return addSlide(); }
    if (k === "F5") { done(); return root.H3SlideShow && root.H3SlideShow.start(e.shiftKey ? St.cur : 0); }
  }

  /* ---------------------------------------------------------------- wiring */
  function wire() {
    const d = $("slidesdock"); if (!d) return;
    try { if (root.localStorage.getItem("h3.g.slidesdock") == null) { root.localStorage.setItem("h3.g.slidesdock", "1"); d.classList.add("dockgone"); } } catch (e) { /* fine */ }
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    on("slCloseBtn", "click", (e) => { e.stopPropagation(); if (typeof root.toggleDockGone === "function") root.toggleDockGone("slidesdock", "tX_slidesdock"); });
    $("slFont").innerHTML = K().FONTS.map((f) => `<option value="${esc(f)}" style="font-family:'${esc(f)}'" data-noi18n>${esc(f)}</option>`).join("");
    const wrap = $("slStageWrap");
    wrap.addEventListener("pointerdown", onStageDown);
    wrap.addEventListener("dblclick", (e) => { const el = e.target.closest(".it"); if (el) { const it = item(el.dataset.id); if (it && it.type === "image") { if (!mediaUrl(it.src)) { St.sel = new Set([it.id]); $("slPicFile").click(); } } else if (it && (it.type === "table" || it.type === "chart") && root.H3SlideData) root.H3SlideData.edit(it); else startEdit(el.dataset.id); } else if (!e.target.closest(".hd, .rot")) addText(); });
    wrap.addEventListener("contextmenu", (e) => { e.preventDefault(); const el = e.target.closest(".it"); if (el && !St.sel.has(el.dataset.id)) { St.sel = new Set([el.dataset.id]); paint(); } stageMenu(e.clientX, e.clientY); });
    wrap.addEventListener("keydown", onStageKey);
    wrap.addEventListener("paste", (e) => { if (St.edit) return; const fs = [...(e.clipboardData && e.clipboardData.files) || []].filter((f) => /^image\//.test(f.type)); if (fs.length) { e.preventDefault(); addPictures(fs); return; } if (pasteItems()) e.preventDefault(); });
    wrap.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
    wrap.addEventListener("drop", (e) => { const fs = e.dataTransfer && e.dataTransfer.files; if (fs && fs.length) { e.preventDefault(); const el = e.target.closest(".it"); if (el) { const it = item(el.dataset.id); if (it && it.type === "image" && !mediaUrl(it.src)) St.sel = new Set([it.id]); } addPictures(fs, toSlide(e)); } });
    doc.addEventListener("pointermove", onMove); doc.addEventListener("pointerup", (e) => { const dd = St.drag; if (dd && dd.kind === "list") { St.drag = null; $("slList").querySelectorAll(".th.drop").forEach((t) => t.classList.remove("drop")); if (dd.moved && dd.at != null) { const to = dd.at > dd.from ? dd.at - 1 : dd.at; moveSlide(dd.from, to); } return; } onUp(e); });
    if (root.ResizeObserver) { new root.ResizeObserver(() => { if (!St.edit) paint(); }).observe(wrap); new root.ResizeObserver(paintList).observe($("slList")); }
    const L = $("slList");
    L.addEventListener("pointerdown", listDown);
    L.addEventListener("contextmenu", (e) => { e.preventDefault(); const th = e.target.closest(".th"); if (th) { go(+th.dataset.i); listMenu(+th.dataset.i, e.clientX, e.clientY); } else if (e.target.closest("#slListAdd")) { const r = e.target.getBoundingClientRect(); const m = menu(r.left, r.bottom + 2, Object.entries(K().LAYOUTS).map(([k, n]) => `<div data-l="${k}">${esc(n)}</div>`).join("")); m.addEventListener("click", (ev) => { const it = ev.target.closest("[data-l]"); if (it) { m.remove(); addSlide(it.dataset.l, D().slides.length); } }); } });
    L.addEventListener("keydown", onListKey);
    on("slNew", "click", (e) => newMenu(e.currentTarget));
    on("slOpen", "click", (e) => openMenu(e.currentTarget));
    on("slSave", "click", save);
    on("slFile", "keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") save(); });
    on("slFile", "change", () => { St.name = ($("slFile").value || "Presentation").trim(); draft(); });
    on("slUndo", "click", () => undo(false)); on("slRedo", "click", () => undo(true));
    on("slPlay", "click", () => root.H3SlideShow && root.H3SlideShow.start(0));
    on("slPlayHere", "click", () => root.H3SlideShow && root.H3SlideShow.start(St.cur));
    on("slExport", "click", exportPptx);
    on("slAddSlide", "click", (e) => layoutMenu(e.currentTarget, (l) => addSlide(l)));
    on("slLayout", "click", (e) => layoutMenu(e.currentTarget));
    on("slTheme", "click", (e) => themeMenu(e.currentTarget));
    on("slBg", "change", (e) => { step(); slide().bg = e.target.value; changed(); });
    on("slBgReset", "click", () => { step(); delete slide().bg; changed(); });
    on("slAddText", "click", addText);
    on("slAddShape", "click", (e) => shapeMenu(e.currentTarget));
    on("slAddPic", "click", (e) => (root.H3SlideIO ? root.H3SlideIO.picMenu(e.currentTarget) : $("slPicFile").click()));   // 2.832.0: ▾ the Gallery / Assets too
    on("slPicFile", "change", (e) => { const fs = e.target.files; if (fs && fs.length) addPictures(fs); e.target.value = ""; });
    on("slFont", "change", (e) => style((s) => { s.font = e.target.value; }));
    on("slSize", "change", (e) => { const v = Math.max(6, Math.min(300, Math.round(+e.target.value || 0))); if (v) style((s) => { s.size = v; }); });
    on("slB", "click", () => style((s) => { s.b = !s.b || undefined; })); on("slI", "click", () => style((s) => { s.i = !s.i || undefined; })); on("slU", "click", () => style((s) => { s.u = !s.u || undefined; }));
    on("slColor", "change", (e) => style((s) => { s.color = e.target.value; }));
    for (const [id, a] of [["slAL", "left"], ["slAC", "center"], ["slAR", "right"]]) on(id, "click", () => style((s) => { s.align = a; }));
    on("slVA", "click", () => style((s, it) => { const v = K().textLook(it, D()).valign; s.valign = { top: "middle", middle: "bottom", bottom: "top" }[v]; }));
    on("slBul", "click", () => style((s) => { s.bullets = !s.bullets || undefined; }));
    on("slFill", "change", (e) => shapeStyle((it) => { it.fill = e.target.value; }));
    on("slLine", "change", (e) => shapeStyle((it) => { it.line = e.target.value; if (!it.lw) it.lw = 2; }));
    on("slLw", "change", (e) => shapeStyle((it) => { it.lw = Math.max(0, Math.min(40, Math.round(+e.target.value || 0))); }));
    on("slFront", "click", () => order(true)); on("slBack", "click", () => order(false)); on("slDel", "click", delItems);
    on("slTrans", "change", (e) => { step(); slide().transition = e.target.value; changed(); msg("this slide comes in with: " + e.target.value); });
    on("slNotes", "focus", () => { St.noteStep = false; });
    on("slNotes", "input", (e) => { if (!St.noteStep) { step(); St.noteStep = true; } slide().notes = e.target.value; St.dirty = true; draft(); });
    on("slNotes", "keydown", (e) => e.stopPropagation());
    // the draft kept in this browser comes back
    try { const dr = JSON.parse(root.localStorage.getItem("h3.slides.draft") || "null"); if (dr && dr.deck) { St.deck = K().clean(dr.deck); St.name = dr.name || "Presentation"; } } catch (e) { /* a fresh deck */ }
    if (!St.deck) St.deck = K().newDeck("plain");
    const boot = () => { if (St.booted) return; St.booted = true; paint(); };
    const seen = () => !d.classList.contains("dockgone") && !d.classList.contains("collapsed");
    if (root.MutationObserver) new MutationObserver(() => { if (seen()) { boot(); paint(); } }).observe(d, { attributes: true, attributeFilter: ["class"] });
    if (seen()) boot();
  }
  root.H3Slides = { St, deck: D, slide, go, addSlide, dupSlide, delSlide, moveSlide, addText, addShape, addItem, addPictures, delItems, dupItems, order, style, startEdit, endEdit, save, load, openMenu, exportPptx, undo, paint, paintNow, renderSlide, mediaUrl, msg, step, changed };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else setTimeout(wire, 0);
})(window);
