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
    /* 2.605.0 (Tim: "when user hovers over text don't show the thick bounding box,do this with all drawing objects show
       the same one as the move tool, if user clicks on the element select it and automatically go to the move tool"):
       the object under the pointer shows THE MOVE TOOL'S FRAME (the picked one's thin dashed frame, canvas.js) - with the
       Move tool, the Text tool (texts) and the drawing tools (Shape, Freehand); a click (no drag) on an object with one
       of those tools picks it and switches to the Move tool (a drag still draws a new one) */
    var HOVER_TOOLS = ["move", "text", "shape", "freehand"], DRAW_TOOLS = ["shape", "freehand"];
    function hoverOk() { return HOVER_TOOLS.indexOf(S.tool) >= 0; }
    function count() { var n = 0; (tl.vlayers || []).concat(tl.images || []).forEach(function (L) { n += (L.clips || []).length; }); return n; }
    cv.addEventListener("pointermove", function (ev) {
      if (!hoverOk() || ev.buttons || S.drag) { if (hover) { hover = null; C.mark(); } return; }
      var h = C.hit(toComp(ev)), sel = C.selClip && C.selClip();
      var nh = h && h.Ly.kind !== "v1" && !(S.tool === "move" && sel && sel.c === h.c) && !(S.tool === "text" && !h.c.text) ? h : null;
      if ((nh && nh.c) !== (hover && hover.c)) { hover = nh; C.mark(); }
    });
    cv.addEventListener("pointerleave", function () { if (hover) { hover = null; C.mark(); } });
    var press = null;
    cv.addEventListener("pointerdown", function (ev) {
      if (hover) { hover = null; C.mark(); }
      press = null;
      if (ev.button !== 0 || S.spaceHand) return;
      var h = null; try { h = C.hit(toComp(ev)); } catch (e) { h = null; }
      if (h && h.Ly.kind === "v1") h = null;
      if (S.tool === "text" && h) {                      // the Text tool on an object: picked, the Move tool (no new text)
        ev.stopImmediatePropagation(); ev.preventDefault();
        pick(h); return;
      }
      // a drawing tool pressed ON an object: held back - a click picks it (below), a drag draws as always (started here)
      var T = DRAW_TOOLS.indexOf(S.tool) >= 0 && h && C.extTool ? C.extTool(S.tool) : null;
      if (T) {
        ev.stopImmediatePropagation(); ev.preventDefault();
        press = { tool: S.tool, T: T, at: [ev.clientX, ev.clientY], p: toComp(ev), ev: ev, h: h, id: ev.pointerId };
        try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
      }
    }, true);
    cv.addEventListener("pointermove", function (ev) {
      var d = press; if (!d || d.started) return;
      if (Math.hypot(ev.clientX - d.at[0], ev.clientY - d.at[1]) < 4) return;
      d.started = true;                                    // a drag after all: the tool draws from the press
      S.drag = { kind: "ext", tool: d.T };
      try { d.T.down(d.p, d.ev); } catch (e) { /* the tool says why */ }
    }, true);
    window.addEventListener("pointerup", function (ev) {
      var d = press; press = null; if (!d) return;
      if (d.started) return;                               // the canvas ends the tool's drag (its own pointerup)
      try { cv.releasePointerCapture(d.id); } catch (e) { /* fine */ }
      pick(d.h);                                           // a click: picked + the Move tool, nothing drawn
    });
    function pick(h) {
      try { C.select(h.c, C.layerOf ? C.layerOf(h.c) : h.Ly); } catch (e) { /* fine */ }
      if (C.setTool) C.setTool("move");
      hover = null; C.mark();
      if (C.say) C.say((h.c.text ? "the text" : "the layer") + " picked - the Move tool");
    }
    C.onDraw(function (ctx) {
      if (!hover || !hoverOk()) return;
      var b = C.box(hover.c, hover.Ly.kind); if (!b) return;
      var cs = corners(b).map(function (p) { return C.toScreen(p.x, p.y); });
      ctx.save();
      ctx.beginPath(); cs.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath();
      ctx.strokeStyle = "rgba(245,158,44,.9)"; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.stroke();   // = the picked frame (canvas.js)
      ctx.restore();
    });
    window.TlSelHl = { HOVER: HOVER, HOVER_TOOLS: HOVER_TOOLS, hover: function () { return hover; } };
  }
})();
