/* bitGen Studio — static/multisel.js (2.571.0): SELECT SEVERAL clips in the Gallery, the Assets dock and the References
 * dock and DRAG THEM ALL onto the timeline at once, window.H3Multi.
 *
 * Tim (verbatim): "allow user to select multiple clips from gallery,assets or references with shift click for range and
 * ctrl click to add or remove items, drag the clips to the timeline top clip will be oldest, bottom clip will be newest"
 *
 *   SELECT   click = that one; Ctrl (⌘) + click = add / take away; Shift + click = everything from the last clicked one
 *            to this one (Ctrl + Shift = add that range). Gallery: its tiles (.thumb.sel, every tab); Assets: its own
 *            selection (static/assetgroups.js - ☐, Ctrl / Shift already); References: the picture tray (.slot.rsel).
 *            A selection survives the list being drawn again.
 *   DRAG     dragging one of the selected = all of them ("text/h3multi" + the drag picture says how many). Dropped on
 *            the timeline's tracks or on the preview canvas, they are laid down OLDEST FIRST (the file's date): each on
 *            its own new layer, the oldest on the top one, one after the other from where it was dropped (no gap) -
 *            videos (V1 while it is empty), pictures on picture layers, sounds on sound layers. Gallery stills / songs
 *            are adopted into the project first, reference pictures uploaded (as one at a time always was).
 *   Dragging an item that is NOT selected drags just that one, as before.
 * Pure (Node: scripts/test-multisel571.js): pick, orderByDate, clipFor.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** the selection after a click: sel = the keys selected (in order), anchor = the last plain / Ctrl click, keys = every
   *  key in the list's order, key = the one clicked, mods = {shift, ctrl} -> {sel, anchor} */
  function pick(sel, anchor, keys, key, mods) {
    const m = mods || {}, cur = Array.isArray(sel) ? sel.slice() : [];
    if (m.shift) {
      const a = keys.indexOf(anchor != null && keys.includes(anchor) ? anchor : (cur[0] != null ? cur[0] : key)), b = keys.indexOf(key);
      if (b < 0) return { sel: cur, anchor };
      const lo = Math.min(a < 0 ? b : a, b), hi = Math.max(a < 0 ? b : a, b), range = keys.slice(lo, hi + 1);
      const out = m.ctrl ? cur.concat(range.filter((k) => !cur.includes(k))) : range;
      return { sel: out, anchor: anchor != null && keys.includes(anchor) ? anchor : key };
    }
    if (m.ctrl) {
      const i = cur.indexOf(key);
      if (i >= 0) cur.splice(i, 1); else cur.push(key);
      return { sel: cur, anchor: key };
    }
    return { sel: [key], anchor: key };
  }
  /** oldest first by the file's date (mtime, seconds or ms - only compared with each other); no date = after the
   *  dated ones, in the order they were selected */
  function orderByDate(items) {
    return (items || []).map((it, i) => ({ it, i, t: Number.isFinite(+it.mtime) && +it.mtime > 0 ? +it.mtime : Infinity }))
      .sort((a, b) => a.t - b.t || a.i - b.i).map((x) => x.it);
  }
  /** a resolved item -> the timeline clip it becomes at `at` and how long it lasts: {kind: video | images | sound, clip, len} */
  function clipFor(r, at) {
    const start = Math.round((+at || 0) * 24) / 24;
    if (r.kind === "images") return { kind: "images", clip: { name: r.name, start, len: 3, opacity: 1 }, len: 3 };
    const d = +r.duration > 0 ? +r.duration : 5;
    if (r.kind === "sound") return { kind: "sound", clip: { name: r.name, dur: d, start, in: 0, out: d }, len: d };
    return { kind: "video", clip: { name: r.name, dur: d, in: 0, out: d, opacity: 1, start, src: r.src || "video" }, len: d };
  }
  const pure = { pick, orderByDate, clipFor };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = pure; return; }

  /* ================================ the page ================================ */
  const doc = root.document, $ = (id) => doc.getElementById(id);
  let drag = null;                                        // the items being dragged (a multi-drag), until shortly after dragend
  const kindOfTile = (t) => ({ video: "video", image: "images", audio: "sound" }[t.dataset.lbKind] || "video");
  const editing = () => { const a = doc.activeElement; return !!(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)); };

  /** the drag picture: "N clips" */
  function badge(n) {
    const c = doc.createElement("canvas"); c.width = 120; c.height = 34;
    const g = c.getContext("2d"); g.fillStyle = "#f59e2c"; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, 120, 34, 8); else g.rect(0, 0, 120, 34); g.fill();
    g.fillStyle = "#1b1814"; g.font = "bold 15px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${n} clips`, 60, 17);
    c.style.cssText = "position:fixed;left:-500px;top:-500px"; doc.body.appendChild(c); setTimeout(() => c.remove(), 0);
    return c;
  }
  function start(e, items) {
    drag = items;
    try { e.dataTransfer.setData("text/h3multi", JSON.stringify(items.map((x) => ({ type: x.type, kind: x.kind, name: x.name })))); } catch (er) { /* fine */ }
    try { e.dataTransfer.setDragImage(badge(items.length), 60, 17); } catch (er) { /* fine */ }
    e.dataTransfer.effectAllowed = "copy";
  }
  doc.addEventListener("dragend", () => { if (drag) setTimeout(() => { drag = null; }, 80); }, true);

  /* ---- the Gallery: its tiles */
  const G = { sel: [], anchor: null };
  function galleryWire() {
    const gal = $("gallery"); if (!gal || gal.dataset.msel) return;
    gal.dataset.msel = "1";
    const tiles = () => [...gal.querySelectorAll(".thumb[data-name]")];
    const paint = () => { for (const t of tiles()) t.classList.toggle("sel", G.sel.includes(t.dataset.name)); };
    gal.addEventListener("click", (e) => {
      const t = e.target.closest(".thumb"); if (!t || !gal.contains(t) || e.target.closest("button, input, select, a")) return;
      const key = t.dataset.name; if (!key) return;
      const mods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
      const r = pick(G.sel.filter((k) => tiles().some((x) => x.dataset.name === k)), G.anchor, tiles().map((x) => x.dataset.name), key, mods);
      G.sel = r.sel; G.anchor = r.anchor;
      if (mods.shift || mods.ctrl) { e.preventDefault(); e.stopImmediatePropagation(); paint(); }   // the plain click: the gallery's own (one tile)
    }, true);
    gal.addEventListener("dragstart", (e) => {
      const t = e.target.closest && e.target.closest(".thumb"); if (!t) return;
      const sel = tiles().filter((x) => x.classList.contains("sel"));
      if (!t.classList.contains("sel") || sel.length < 2) { drag = null; return; }
      start(e, sel.map((x) => ({ type: "output", kind: kindOfTile(x), name: x.dataset.name, duration: +x.dataset.dur || 0, mtime: +x.dataset.mtime || 0, where: x.dataset.where || "" })));
    }, true);
    new root.MutationObserver(() => { if (G.sel.length) paint(); }).observe(gal, { childList: true, subtree: true });
  }

  /* ---- the Assets dock: its own selection (assetgroups.js) */
  function assetsWire() {
    const dock = $("assetsdock"); if (!dock || dock.dataset.msel) return;
    dock.dataset.msel = "1";
    dock.addEventListener("dragstart", (e) => {
      const t = e.target.closest && e.target.closest(".aitem"); if (!t) return;
      const AG = root.AssetGroups, sel = AG && AG.state && AG.state.sel;
      if (!sel || sel.size < 2 || !t.classList.contains("agsel")) { drag = null; return; }
      const items = [...sel.values()].map((v) => {
        const tile = dock.querySelector(`.aitem[data-agkey="${String(v.kind + "/" + v.name).replace(/["\\]/g, "\\$&")}"]`);
        return { type: "asset", kind: v.kind, name: v.name, duration: tile ? +tile.dataset.dur || 0 : 0, mtime: tile ? +tile.dataset.mtime || 0 : 0 };
      });
      start(e, items);
    }, true);
  }

  /* ---- the References dock: the picture tray */
  const R = { sel: [], anchor: null };                    // the ref objects themselves (refs[] entries)
  function refsWire() {
    const tray = $("tray"); if (!tray || tray.dataset.msel) return;
    tray.dataset.msel = "1";
    const list = () => (typeof refs !== "undefined" && Array.isArray(refs) ? refs : []);   // eslint-disable-line no-undef
    const slots = () => [...tray.querySelectorAll(".slot")];
    const paint = () => { const L = list(); slots().forEach((s, i) => s.classList.toggle("rsel", R.sel.includes(L[i]))); };
    tray.addEventListener("click", (e) => {
      const s = e.target.closest(".slot"); if (!s || e.target.closest("select, input, textarea, button, .x, .tag, .refdesc")) return;
      const L = list(), i = slots().indexOf(s); if (i < 0 || !L[i]) return;
      const mods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
      const r = pick(R.sel.filter((x) => L.includes(x)), L.includes(R.anchor) ? R.anchor : null, L.slice(0, slots().length), L[i], mods);
      if (mods.shift || mods.ctrl) { R.sel = r.sel; R.anchor = r.anchor; e.preventDefault(); e.stopImmediatePropagation(); paint(); }
      else { R.sel = []; R.anchor = L[i]; paint(); }        // a plain click: the picture opens as before
    }, true);
    tray.addEventListener("dragstart", (e) => {
      const s = e.target.closest && e.target.closest(".slot"); if (!s) return;
      const L = list(), sel = R.sel.filter((x) => L.includes(x));
      if (!s.classList.contains("rsel") || sel.length < 2) { drag = null; return; }
      start(e, sel.map((r) => ({ type: "refimg", kind: "images", refIndex: L.indexOf(r), name: (r.file && r.file.name) || "reference", mtime: r.file && r.file.lastModified ? r.file.lastModified / 1000 : 0 })));
    }, true);
    new root.MutationObserver(() => { if (R.sel.length) paint(); }).observe(tray, { childList: true });
    const css = doc.createElement("style"); css.id = "mselCss";
    css.textContent = "#tray .slot.rsel{outline:2px solid var(--tiger,#f59e2c);outline-offset:-2px;border-radius:6px}";
    doc.head.appendChild(css);
  }
  doc.addEventListener("keydown", (e) => {                 // Esc clears the gallery's / the tray's selection (Assets has its own)
    if (e.key !== "Escape" || editing() || doc.querySelector("dialog[open]")) return;
    if (G.sel.length > 1) { G.sel = []; const g = $("gallery"); if (g) g.querySelectorAll(".thumb.sel").forEach((t) => t.classList.remove("sel")); }
    if (R.sel.length) { R.sel = []; const t = $("tray"); if (t) t.querySelectorAll(".slot.rsel").forEach((s) => s.classList.remove("rsel")); }
  });

  /* ---- the drop: the timeline (index.html ondrop) / the preview canvas (canvas.js) */
  async function resolve(it) {
    if (it.type === "asset") return { kind: it.kind, name: it.name, duration: it.duration, src: "video" };
    if (it.type === "output" && it.kind === "video") return { kind: "video", name: it.name, duration: it.duration, src: it.where === "final" ? "final" : "output" };
    if (it.type === "output") { const a = await adoptOutput(it.name, it.kind); return { kind: a.kind, name: a.name, duration: a.duration, src: "video", adopted: true }; }   // eslint-disable-line no-undef
    if (it.type === "refimg") {
      const r = (typeof refs !== "undefined" ? refs : [])[it.refIndex]; if (!r) return null;   // eslint-disable-line no-undef
      const up = await uploadAsset(new File([r.file], `ref_${Date.now().toString(36)}_${it.refIndex}.png`, { type: "image/png" }), true);   // eslint-disable-line no-undef
      return up ? { kind: "images", name: up.name, adopted: true } : null;
    }
    return null;
  }
  /** lay the dragged items down from `sec`: oldest first, each on a new layer, one after the other */
  async function dropAt(sec) {
    const items = orderByDate(drag || []); drag = null;
    if (!items.length) return 0;
    let at = Math.max(0, +sec || 0), n = 0, adopted = false, v1 = false;
    const fails = [];
    for (const it of items) {
      let r = null;
      try { r = await resolve(it); } catch (e) { fails.push(`${it.name}: ${e.message}`); continue; }
      if (!r) { fails.push(it.name); continue; }
      adopted = adopted || !!r.adopted;
      const p = clipFor(r, at);
      /* eslint-disable no-undef */
      if (p.kind === "video") {
        if (!tl.video.length && !v1) { tl.video.push(p.clip); v1 = true; }          // V1 while it is empty (the top row)
        else tl.vlayers.push(mkLayer("V" + (tl.vlayers.length + 2), [p.clip]));
      } else if (p.kind === "images") tl.images.push(mkLayer("I" + (tl.images.length + 1), [p.clip]));
      else tl.audio.push(mkLayer("A" + (tl.audio.length + 1), [p.clip]));
      at += p.len; n++;
    }
    if (typeof tlKaraokeOnTop === "function") tlKaraokeOnTop();
    if (typeof resolveOverlaps === "function") resolveOverlaps();
    tlSave(); renderTimeline();
    if (adopted && typeof refreshAssets === "function") refreshAssets();
    if (root.TlCanvas && TlCanvas.mark) TlCanvas.mark();
    /* eslint-enable no-undef */
    if (fails.length) alert(`${fails.length} of ${items.length} could not be added:\n${fails.slice(0, 6).join("\n")}`);
    try { if (root.H3TestEvent) root.H3TestEvent("multi_drop", String(n)); } catch (e) { /* the 🧪 list */ }
    return n;
  }
  const has = () => !!(drag && drag.length > 1);
  function wireAll() { galleryWire(); assetsWire(); refsWire(); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wireAll); else wireAll();
  root.setTimeout(wireAll, 1500);
  root.H3Multi = Object.assign({ has, dropAt, items: () => (drag || []).slice(), gallery: () => G.sel.slice(), refsSel: () => R.sel.slice() }, pure);
})(typeof window !== "undefined" ? window : globalThis);
