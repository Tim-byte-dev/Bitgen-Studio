/* bitGen Studio — ext/timelinedock/tlctx.js (2.604.0): THE TIMELINE CANVAS'S RIGHT-CLICK MENU (window.TlCtx).
 *
 * Tim (verbatim): "remove the thick bounding box when text or element is selected in timeline and image-editor add a
 * rightclick context menu with rasterize text".
 *   A right-click on the preview canvas picks the layer under the pointer (as a click does) and opens a small menu:
 *     🅰 Rasterize Text   a text layer becomes a plain picture layer: its picture (projects/<p>/images/text_<id>.png,
 *                         written sharp first) stays exactly where it is, its letters can no longer be typed into -
 *                         one timeline undo step (↶ / Ctrl+Z, tlrange.js)
 *   The menu goes on Esc, a click elsewhere, or the wheel. Not a text = the item is greyed with why.
 * Pure (Node): rasterized(c) -> the clip as a picture (text, tid and the text-only keys gone).
 */
(function (root) {
  "use strict";
  var TEXT_ONLY = ["text", "tid"];          // the letters, their animators (inside text) and the picture's id
  function rasterized(c) {
    var o = {}; Object.keys(c || {}).forEach(function (k) { if (TEXT_ONLY.indexOf(k) < 0) o[k] = c[k]; });
    return o;
  }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { rasterized: rasterized, TEXT_ONLY: TEXT_ONLY }; return; }

  function $(id) { return document.getElementById(id); }
  var menu = null;
  function close() { if (menu) { menu.remove(); menu = null; } }
  function css() {
    if ($("tlctxCss")) return;
    var s = document.createElement("style"); s.id = "tlctxCss";
    s.textContent = ".tlctx{position:fixed;z-index:2147483000;min-width:190px;padding:4px;background:var(--panel,#1c1a17);border:1px solid var(--line,#3a352d);border-radius:6px;box-shadow:0 8px 28px rgba(0,0,0,.55);font-size:.78rem}"
      + ".tlctx button{display:block;width:100%;text-align:left;padding:5px 10px;background:none;border:0;color:var(--fg,#e8e2d6);border-radius:4px;cursor:pointer}"
      + ".tlctx button:hover:not(:disabled){background:rgba(245,158,44,.18)}.tlctx button:disabled{opacity:.45;cursor:default}"
      + ".tlctx .why{padding:2px 10px 4px;color:var(--dim,#9a917f);font-size:.68rem}";
    document.head.appendChild(s);
  }
  function say(t) { try { if (root.TlCanvas && TlCanvas.say) TlCanvas.say(t); } catch (e) { /* fine */ } }

  /** the text clip -> a picture clip: the PNG written sharp first, then the text-only keys dropped (one undo step) */
  function rasterize(c, Ly) {
    if (!c || !c.text) { say("only a text layer can be rasterized"); return Promise.resolve(false); }
    var C = root.TlCanvas;
    var up = C && C.uploadText ? C.uploadText(c) : Promise.resolve(true);
    return Promise.resolve(up).then(function (ok) {
      if (ok === false) { say("🅰 the text's picture could not be saved - not rasterized"); return false; }
      var r = rasterized(c);
      Object.keys(c).forEach(function (k) { delete c[k]; });
      Object.assign(c, r);
      var L = Ly && Ly.L;
      if (L && L.text && !(L.clips || []).some(function (x) { return x.text; })) delete L.text;
      if (typeof tlSave === "function") tlSave();
      if (typeof renderTimeline === "function") renderTimeline();
      try { if (C.mark) C.mark(); if (C.paintProps) C.paintProps(); } catch (e) { /* fine */ }
      say("🅰 rasterized: " + (L && L.name ? L.name : "the text") + " is a picture now (" + c.name + ") - ↶ / Ctrl+Z undoes");
      if (typeof root.H3TestEvent === "function") root.H3TestEvent("tl_rasterize", c.name);
      return true;
    });
  }
  function open(ev, hit) {
    css(); close();
    var m = document.createElement("div"); m.className = "tlctx"; m.setAttribute("role", "menu");
    var isText = !!(hit && hit.c && hit.c.text);
    var b = document.createElement("button"); b.type = "button"; b.id = "tlctxRaster"; b.setAttribute("role", "menuitem");
    b.textContent = "🅰 Rasterize Text"; b.disabled = !isText;
    b.onclick = function () { close(); rasterize(hit.c, hit.Ly); };
    m.appendChild(b);
    if (!isText) { var w = document.createElement("div"); w.className = "why"; w.textContent = hit ? "this layer is not a text" : "nothing under the pointer"; m.appendChild(w); }
    document.body.appendChild(m);
    var r = m.getBoundingClientRect();
    m.style.left = Math.min(ev.clientX, innerWidth - r.width - 4) + "px";
    m.style.top = Math.min(ev.clientY, innerHeight - r.height - 4) + "px";
    menu = m;
    if (!b.disabled) b.focus();
  }
  function start() {
    var cv = $("tlCanvas"), C = root.TlCanvas, S = C.state;
    function toComp(ev) { var r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left - S.view.ox) / S.view.z, y: (ev.clientY - r.top - S.view.oy) / S.view.z }; }
    cv.addEventListener("contextmenu", function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var h = null;
      try { h = C.hit(toComp(ev)); } catch (e) { h = null; }
      if (h && h.Ly && h.Ly.kind === "v1") h = null;
      if (h && C.select) { try { C.select(h.c, C.layerOf ? C.layerOf(h.c) : undefined); } catch (e) { /* the menu still opens */ } }
      open(ev, h);
    });
    document.addEventListener("pointerdown", function (ev) { if (menu && !menu.contains(ev.target)) close(); }, true);
    document.addEventListener("keydown", function (ev) { if (menu && ev.key === "Escape") { ev.preventDefault(); close(); } }, true);
    document.addEventListener("wheel", function () { close(); }, { capture: true, passive: true });
  }
  function boot() { if (!$("tlCanvas") || !root.TlCanvas || !TlCanvas.hit) { setTimeout(boot, 80); return; } start(); }
  root.TlCtx = { rasterized: rasterized, rasterize: rasterize, close: close };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
