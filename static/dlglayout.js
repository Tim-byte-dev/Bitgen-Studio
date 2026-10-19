/* bitGen Studio — static/dlglayout.js (2.438.0): DIALOGS AND MESSAGE BOXES OPEN IN THE MIDDLE OF THE SCREEN, AND WHERE
 * THEY WERE LEFT, window.H3DlgLayout (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "put message boxes and dialogs in the center of the screen by default. remember their locations if
 * moved in file dialog_layout.cfg/ load their last positions from that file".
 *   WHICH       every <dialog> of the app (message boxes, Settings, the timeline's dialogs, the file dialog, 📦 …) and
 *               the image editor's dialogs (.kxdlg) - as each opens. data-no-layout on one leaves it alone.
 *   WHERE       the middle of the window - or, once it has been moved, where it was left (kept by its key: its id, else
 *               its title), pulled back inside the window if that has become smaller.
 *   MOVING      by its title (bar); a dialog with a title bar of its own (the editor's, the timeline's, the file
 *               dialog) moves as before. Dropped somewhere else = kept in dialog_layout.cfg (lib/layoutCfg.js,
 *               routes/layout.js: GET / POST /api/layout/dialog) for next time - and for every later start.
 *   H3DlgLayout.reset(key?)   forget one (or all) - it opens in the middle again
 * Pure (Node: scripts/test-dlglayout.js): keyOf, center, clamp.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** the key a dialog is kept by: its id, else its title (first heading / aria-label), else null (not kept) */
  function keyOf(el) {
    if (!el) return null;
    if (el.id) return "#" + el.id;
    const lab = el.getAttribute && el.getAttribute("aria-label");
    if (lab) return "@" + String(lab).trim().slice(0, 60);
    const h = el.querySelector && el.querySelector("h1,h2,h3,h4,.fx-title,.bgp-t,.fd-title");
    const t = h ? String(h.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) : "";
    return t ? "@" + t : null;
  }
  /** the middle of a vw x vh window for a w x h box (never above / left of 0) */
  function center(w, h, vw, vh) { return { x: Math.max(0, Math.round((vw - w) / 2)), y: Math.max(0, Math.round((vh - h) / 2)) }; }
  /** p pulled back so the box stays reachable: its title row on screen, at least `keep` px of it inside */
  function clamp(p, w, h, vw, vh, keep) {
    const k = keep == null ? 80 : keep;
    return { x: Math.round(Math.max(Math.min(0, vw - w), Math.min(vw - Math.min(w, k), p.x))), y: Math.round(Math.max(0, Math.min(vh - 36, p.y))) };
  }
  const SELF_DRAG = /(^|\s)(kxdlg|tlfxdlg|fdlg)(\s|$)/;          // they move by their own title bar already
  const HANDLE = "h1,h2,h3,h4,.fx-title,.bgp-t,.fd-title,[data-dlg-drag]";

  /* ================================ the page ================================ */
  let saved = {}, ready = false, timer = null;
  const managed = (el) => !!el && el.nodeType === 1 && !(el.dataset && el.dataset.noLayout != null)
    && (el.tagName === "DIALOG" || (el.classList && el.classList.contains("kxdlg")));
  const isOpen = (el) => (el.tagName === "DIALOG" ? el.open : el.isConnected && el.getClientRects().length > 0);   // (offsetParent is null for a fixed one)
  function apply(el, p) {
    const s = el.style;
    s.position = "fixed"; s.margin = "0"; s.inset = "auto"; s.right = "auto"; s.bottom = "auto"; s.transform = "none";
    s.left = p.x + "px"; s.top = p.y + "px";
    el._dl = { x: p.x, y: p.y };
  }
  function place(el) {
    if (!managed(el) || !isOpen(el)) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const vw = root.innerWidth, vh = root.innerHeight, k = keyOf(el), s = k && saved[k];
    apply(el, s ? clamp(s, r.width, r.height, vw, vh) : center(r.width, r.height, vw, vh));
    // 2.438.0 (the gate): a dialog that grows after it opened (its contents filled in) is put back inside the window
    if (!el._dlro && typeof root.ResizeObserver === "function") {
      el._dlro = new root.ResizeObserver(() => {
        if (!isOpen(el)) return;
        const q = el.getBoundingClientRect();
        if (q.bottom > root.innerHeight + 1 || q.right > root.innerWidth + 1) place(el);
      });
      el._dlro.observe(el);
    }
  }
  const soon = (el) => { root.requestAnimationFrame(() => place(el)); };
  function persist(k, p) {
    saved[k] = { x: p.x, y: p.y };
    clearTimeout(timer);
    timer = setTimeout(() => {
      root.fetch("/api/layout/dialog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ set: { [k]: saved[k] } }) }).catch(() => {});
    }, 250);
  }
  function openOnes() { return [...root.document.querySelectorAll("dialog[open], .kxdlg")].filter((el) => managed(el) && isOpen(el)); }
  /** after any drag: each open dialog that is not where it was put = moved by the user -> kept */
  function noteMoves() {
    for (const el of openOnes()) {
      if (!el._dl) continue;
      const r = el.getBoundingClientRect();
      if (Math.abs(r.left - el._dl.x) > 2 || Math.abs(r.top - el._dl.y) > 2) {
        const k = keyOf(el); el._dl = { x: Math.round(r.left), y: Math.round(r.top) };
        if (k) persist(k, el._dl);
      }
    }
  }
  function dragFrom(ev) {
    if (ev.button !== 0) return;
    const h = ev.target && ev.target.closest && ev.target.closest(HANDLE); if (!h) return;
    const el = h.closest("dialog, .kxdlg"); if (!managed(el) || SELF_DRAG.test(el.className || "")) return;
    if (ev.target.closest("button,input,select,textarea,a")) return;
    const r = el.getBoundingClientRect(); if (h.getBoundingClientRect().top - r.top > 48) return;   // a heading lower down is not the title
    ev.preventDefault();
    const ox = ev.clientX - r.left, oy = ev.clientY - r.top;
    const mv = (m) => { apply(el, clamp({ x: m.clientX - ox, y: m.clientY - oy }, r.width, r.height, root.innerWidth, root.innerHeight)); };
    const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); };
    root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    el._dl = { x: Math.round(r.left), y: Math.round(r.top) };
    const keep = el._dl;
    // apply() moves _dl along; put back where the drag started so noteMoves sees the move
    root.addEventListener("pointerup", () => { const nr = el.getBoundingClientRect(); el._dl = keep; if (Math.abs(nr.left - keep.x) > 2 || Math.abs(nr.top - keep.y) > 2) noteMoves(); }, { once: true, capture: true });
  }
  function start() {
    const doc = root.document;
    root.fetch("/api/layout/dialog").then((r) => r.json()).then((o) => { saved = Object.assign(o && typeof o === "object" ? o : {}, saved); /* a move made while it loaded wins */ ready = true; openOnes().forEach(place); }).catch(() => { ready = true; });
    new root.MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "attributes" && managed(m.target) && m.target.open) soon(m.target);
        else if (m.type === "childList") for (const n of m.addedNodes) {
          if (managed(n)) soon(n);
          else if (n.nodeType === 1 && n.querySelectorAll) n.querySelectorAll("dialog[open], .kxdlg").forEach((x) => managed(x) && soon(x));
        }
      }
    }).observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    doc.addEventListener("pointerdown", dragFrom, true);
    // a dialog with its own title bar moved by it: noted when the pointer comes up
    doc.addEventListener("pointerup", () => setTimeout(noteMoves, 0), true);
    root.addEventListener("resize", () => openOnes().forEach((el) => { const r = el.getBoundingClientRect(); apply(el, clamp({ x: r.left, y: r.top }, r.width, r.height, root.innerWidth, root.innerHeight)); }));
  }
  function reset(key) {
    if (key) delete saved[key]; else saved = {};
    return root.fetch("/api/layout/dialog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(key ? { set: { [key]: null } } : { all: {} }) }).catch(() => {});
  }

  const H3DlgLayout = { keyOf, center, clamp, place, reset, saved: () => Object.assign({}, saved), ready: () => ready };
  if (typeof module !== "undefined" && module.exports) module.exports = H3DlgLayout;
  else { root.H3DlgLayout = H3DlgLayout; if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start); else start(); }
})(typeof window !== "undefined" ? window : globalThis);
