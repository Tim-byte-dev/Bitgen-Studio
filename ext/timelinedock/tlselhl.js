/* bitGen Studio — the timeline canvas: the layer under the pointer outlined (2.470.0), window.TlSelHl.
 *
 * Tim (verbatim): "on mouseover of a shape or object or smart object, highlight the border of the shape to show it can
 * be selected, then use a different highlight color when it is selected ... impliment standard drawing/cad".
 *
 * With the Move tool, the clip under the pointer (not V1, not the one already picked) shows its box in HOVER blue; the
 * picked one keeps its orange box + handles (canvas.js); a click on nothing picks nothing (canvas.js already).
 */
(function () {
  "use strict";
  var HOVER = "#3aa0ff";
  function $(id) { return document.getElementById(id); }
  function boot() { if (!$("tlCanvas")) return; if (!window.TlCanvas) { setTimeout(boot, 60); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  function corners(b) {
    var a = (b.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), hw = b.w / 2, hh = b.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(function (p) { return { x: b.cx + p[0] * cs - p[1] * sn, y: b.cy + p[0] * sn + p[1] * cs }; });
  }
  function start() {
    var C = window.TlCanvas, S = C.state, cv = $("tlCanvas"), hover = null;
    function toComp(ev) { var r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left - S.view.ox) / S.view.z, y: (ev.clientY - r.top - S.view.oy) / S.view.z }; }
    cv.addEventListener("pointermove", function (ev) {
      if (S.tool !== "move" || ev.buttons || S.drag) { if (hover) { hover = null; C.mark(); } return; }
      var h = C.hit(toComp(ev)), sel = C.selClip && C.selClip();
      var nh = h && h.Ly.kind !== "v1" && !(sel && sel.c === h.c) ? h : null;
      if ((nh && nh.c) !== (hover && hover.c)) { hover = nh; C.mark(); }
    });
    cv.addEventListener("pointerleave", function () { if (hover) { hover = null; C.mark(); } });
    cv.addEventListener("pointerdown", function () { if (hover) { hover = null; C.mark(); } });
    C.onDraw(function (ctx) {
      if (!hover || S.tool !== "move") return;
      var b = C.box(hover.c, hover.Ly.kind); if (!b) return;
      var cs = corners(b).map(function (p) { return C.toScreen(p.x, p.y); });
      ctx.save();
      ctx.beginPath(); cs.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 2; ctx.stroke();   // 2.604.0: thin (was 3.5 + 1.6)
      ctx.strokeStyle = HOVER; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    });
    window.TlSelHl = { HOVER: HOVER, hover: function () { return hover; } };
  }
})();
