/* bitGen Studio — ext/timelinedock/tltextfill.js (2.608.0): A TIMELINE TEXT IN A SHAPE LAYER. window.TlTextFill.
 *
 * Tim (verbatim): "can we fill shapes with text" -> all three kinds, in the image editor AND the timeline. Here:
 *   🔤 In a shape (a text layer's Properties): pick a shape layer, then
 *     Stretch   the letters bent and stretched to fill its outline top to bottom (a heart, a circle, a star of letters)
 *     Flow      the words wrapped inside its outline line by line (Fit = the biggest size that still fits them all)
 *   ⌖ Place on it: the text takes the shape's place, size and turn (it can be moved on its own after). The shape's form is
 *   read at each moment, so an animated shape carries the text with it; the text keeps its colour, outline, shadow and
 *   its text preset (Preset ▾). Repeat (rows of text as a shape's fill) is the shape layer's own 🅰 Text fill (tlshape.js).
 *   c.text.inshape = {mode: "stretch" | "flow", uid (the shape layer), fit, align}
 *   The compile: baked by the page like text animators (TlParent.bake - tlparent.js asks live()).
 */
(function (root) {
  "use strict";
  var live = function (c) { var o = c && c.text && c.text.inshape; return !!(o && (o.mode === "stretch" || o.mode === "flow") && o.uid); };
  root.TlTextFill = { live: live };
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.renderText && window.TlParent && TlParent.all && window.H3TextFill && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlTextFill.ready) return;
    var C = window.TlCanvas, F = window.H3TextFill;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    function shapeOf(uid) { var hit = TlParent.all().filter(function (x) { return x.c.uid === uid && x.c.shape; })[0]; return hit || null; }
    /** the shape layer's outline at tau (px, round its middle, at its scale) */
    function outline(o, tau) {
      var hit = shapeOf(o.uid); if (!hit || !window.TlShape) return null;
      var sc = (hit.c.tf && hit.c.tf.scale) || 1, O = TlShape.outlines(TlShape.at(hit.c, Math.max(0, tau - 0)), tau), best = null, ba = 0;
      (O.lines || []).forEach(function (L) { var a = 0; for (var i = 0; i < L.length; i++) { var q = L[(i + 1) % L.length]; a += L[i][0] * q[1] - q[0] * L[i][1]; } if (Math.abs(a) > ba) { ba = Math.abs(a); best = L; } });
      return best ? best.map(function (p) { return [p[0] * sc, p[1] * sc]; }) : null;
    }
    var cache = new WeakMap();
    function fontOf(t, size) { return (t.italic ? "italic " : "") + (t.bold ? "bold " : "") + Math.max(1, size) + "px \"" + (t.font || "Arial") + "\", sans-serif"; }
    function inkOf(cv) {
      var W = cv.width, H = cv.height, d = cv.getContext("2d").getImageData(0, 0, W, H).data, x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    /** the text's picture in the shape at tau (s into the clip) */
    function picture(c, tau) {
      var o = c.text.inshape, t = (C.textAt ? C.textAt(c, (c.start || 0) + tau) : c.text) || c.text, poly = outline(o, tau);
      if (!poly) return C.renderText(t);
      var sig = JSON.stringify([t, poly.length, poly[0], poly[Math.floor(poly.length / 2)]]), was = cache.get(c);
      if (was && was.sig === sig) return was.cv;
      // the picture is centred on the shape's own middle (its position), so the text sits exactly in it
      var pb0 = F.polyBox(poly), pad = 6, hx = Math.max(Math.abs(pb0.x), Math.abs(pb0.x + pb0.w)), hy = Math.max(Math.abs(pb0.y), Math.abs(pb0.y + pb0.h)), cv = document.createElement("canvas");
      cv.width = Math.max(2, Math.ceil(2 * (hx + pad))); cv.height = Math.max(2, Math.ceil(2 * (hy + pad)));
      var P = poly.map(function (p) { return [p[0] + hx + pad, p[1] + hy + pad]; }), pb = F.polyBox(P), g = cv.getContext("2d"), fast = false;
      if (o.mode === "stretch") {
        var src = C.renderText(Object.assign({}, t, { inshape: null })), ink = inkOf(src);
        if (ink) F.drawEnvelope(g, src, ink, P);
        fast = !!(t.fx && window.H3TextFx && !(H3TextFx.isSharp && H3TextFx.isSharp()));   // a preset's quick picture: not kept
      } else {
        var size = Math.max(4, Math.min(1000, +t.size || 48)), mg = document.createElement("canvas").getContext("2d");
        var lay = function (sz) { mg.font = fontOf(t, sz); return F.wrapIn(t.content, function (s) { return mg.measureText(s).width; }, P, sz * 1.22, o.align || "center"); };
        if (o.fit) size = F.fitSize(function (sz) { var r = lay(sz); return !r.overflow && r.lines.length > 0; }, 4, Math.max(8, Math.min(600, Math.round(pb.h))));
        var L = lay(size), sw = Math.max(0, +t.strokeW || 0) * size / Math.max(1, +t.size || 48), sh = t.shadow ? Math.max(2, Math.round(size * 0.06)) : 0;
        g.font = fontOf(t, size); g.textBaseline = "top"; g.lineJoin = "round";
        L.lines.forEach(function (ln) {
          if (t.shadow && !t.fx) { g.save(); g.shadowColor = "rgba(0,0,0,.65)"; g.shadowBlur = sh * 1.5; g.shadowOffsetX = sh * 0.5; g.shadowOffsetY = sh * 0.5; g.fillStyle = t.color || "#fff"; g.fillText(ln.text, ln.x, ln.y); g.restore(); }
          if (sw > 0 && !t.fx) { g.strokeStyle = t.stroke || "#000"; g.lineWidth = sw * 2; g.strokeText(ln.text, ln.x, ln.y); }
          g.fillStyle = t.color || "#fff"; g.fillText(ln.text, ln.x, ln.y);
        });
        if (t.fx && window.H3TextFx && H3TextFx.faceLive) {     // the text preset over the flowed lines
          var spec = { text: "Hg", font: t.font || "Arial", size: size, weight: t.bold ? 700 : 400, italic: !!t.italic, leading: 1.22 };
          var r = H3TextFx.faceLive("tf:" + (c.tid || ""), sig, t.fx, function () { return { canvas: cv, hRef: H3TextFx.inkHeight(spec), color: t.color || "#ffffff" }; }, function () { try { C.mark(); } catch (e) { /* fine */ } });
          if (r) {
            var E = Math.max(0, -Math.floor(r.x), -Math.floor(r.y), Math.ceil(r.x + r.canvas.width - cv.width), Math.ceil(r.y + r.canvas.height - cv.height));
            var out = document.createElement("canvas"); out.width = cv.width + 2 * E; out.height = cv.height + 2 * E; out.getContext("2d").drawImage(r.canvas, r.x + E, r.y + E);
            if (!r.fast) cache.set(c, { sig: sig, cv: out });
            return out;
          }
          fast = true;
        }
      }
      if (!fast) cache.set(c, { sig: sig, cv: cv });
      return cv;
    }
    /* ---- 🔤 In a shape (the text's Properties) */
    C.onProps(function (Pn, c, sel) {
      if (!c || !c.text || !Pn || !sel) return;
      var o = c.text.inshape || {}, shs = TlParent.all().filter(function (x) { return x.c.shape && x.c !== c; });
      shs.forEach(function (x) { if (!x.c.uid) x.c.uid = "u" + Math.random().toString(36).slice(2, 10); });
      var d = document.createElement("div"); d.className = "tlp-tinshape";
      d.innerHTML = '<div class="tlp-t">🔤 In a shape</div><div class="tlp-row" style="flex-wrap:wrap">'
        + '<select id="tlpTsMode" title="Stretch = the letters fill the shape\'s outline; Flow = the words wrap inside it"><option value="">none</option><option value="stretch"' + (o.mode === "stretch" ? " selected" : "") + ">Stretch to fill</option><option value=\"flow\"" + (o.mode === "flow" ? " selected" : "") + ">Flow inside</option></select>"
        + '<select id="tlpTsShape"><option value="">' + (shs.length ? "(pick a shape layer)" : "(no shape layers - ◆ Q makes one)") + "</option>" + shs.map(function (x) { return '<option value="' + esc(x.c.uid) + '"' + (o.uid === x.c.uid ? " selected" : "") + ">" + esc(x.L.name || x.lk) + "</option>"; }).join("") + "</select>"
        + (o.mode === "flow" ? '<label title="The biggest size that still fits every word"><input type="checkbox" id="tlpTsFit"' + (o.fit ? " checked" : "") + "> Fit</label><select id=\"tlpTsAlign\">" + [["center", "centre"], ["left", "left"], ["right", "right"]].map(function (a) { return '<option value="' + a[0] + '"' + ((o.align || "center") === a[0] ? " selected" : "") + ">" + a[1] + "</option>"; }).join("") + "</select>" : "")
        + '<button class="ghost" id="tlpTsPlace" title="Put the text where the shape is (its place, size and turn)">⌖ Place on it</button></div>';
      Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      var save = function (repaint) { delete c.bakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); };
      var set = function (k, v) { c.text.inshape = Object.assign({ mode: "", uid: "", fit: true, align: "center" }, c.text.inshape || {}); c.text.inshape[k] = v; if (!c.text.inshape.mode) delete c.text.inshape; };
      q("tlpTsMode").addEventListener("change", function () { set("mode", q("tlpTsMode").value); if (c.text.inshape && !c.text.inshape.uid && shs.length) { c.text.inshape.uid = shs[0].c.uid; place(); } save(true); });
      q("tlpTsShape").addEventListener("change", function () { set("uid", q("tlpTsShape").value); place(); save(true); });
      if (q("tlpTsFit")) q("tlpTsFit").addEventListener("change", function () { set("fit", q("tlpTsFit").checked); save(false); });
      if (q("tlpTsAlign")) q("tlpTsAlign").addEventListener("change", function () { set("align", q("tlpTsAlign").value); save(false); });
      function place() {
        var o2 = c.text.inshape, hit = o2 && shapeOf(o2.uid); if (!hit) return;
        var tf = hit.c.tf || {}; c.tf = Object.assign({}, c.tf || {}, { x: tf.x || 0, y: tf.y || 0, rot: tf.rot || 0, scale: 1 });
        if (c.start == null || c.start > (hit.c.start || 0)) c.start = hit.c.start || 0;
        say("🔤 the text is on " + (hit.L.name || "the shape") + " - " + (o2.mode === "flow" ? "its words flow inside it" : "its letters fill it"));
      }
      q("tlpTsPlace").addEventListener("click", function () { place(); save(true); });
    });
    Object.assign(root.TlTextFill, { ready: true, picture: picture, outline: outline });
  }
})(typeof window !== "undefined" ? window : globalThis);
