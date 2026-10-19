/* bitGen Studio — ext/timelinedock/tlsizebar.js (2.513.0): THE TIMELINE'S MENU BAR - its frame size. window.TlSizeBar.
 *
 * Tim (verbatim): "add a menubar to the top of the timeline docker - width x height input and a size preset dropdown and
 * an aspect ratio dropdown" (+ "hide the cad tool button" - the CAD toolbar is switched here now).
 *
 *   Frame  [width] × [height]   the size the timeline is made at - the canvas, the bakes and ⚙ Compile (the movie);
 *                               V1 is fitted inside it (its own aspect kept, centred on black) - worker.py _fit_frame
 *   Preset ▾                    Auto (the V1 video's own size - as before), 4K, Full HD, HD, vertical, square, 4:5,
 *                               21:9, cinema … (static/framesize.js PRESETS)
 *   Aspect ▾                    Free, 16:9, 9:16, 1:1, 4:5, 4:3, 3:2, 2:3, 21:9, 2.39:1, 1.85:1 - kept while you type:
 *                               a new width works out the height (a new height the width)
 *   ☐ CAD toolbar               the Create / 3D / Sketch / Solid toolbar over the preview (its ⌬ button is hidden)
 * Kept on the timeline: tl.frame = {w, h, aspect} (none = Auto).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ready() { try { return !!(window.TlCanvas && window.H3FrameSize && $("timelinedock") && $("timelinedock").querySelector(".bbody") && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if ($("tlSizeBar")) return;
    var F = window.H3FrameSize, C = window.TlCanvas, body = $("timelinedock").querySelector(".bbody");
    var css = document.createElement("style");
    css.textContent = "#tlSizeBar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:3px 8px;border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b);font-size:.72rem}"
      + "#tlSizeBar input[type=number]{width:64px}#tlSizeBar select{max-width:230px}#tlSizeBar .tsb-l{color:var(--dim,#9a917f);text-transform:uppercase;letter-spacing:.08em;font-size:.65rem}"
      + "#tlSizeBar .tsb-sep{width:1px;height:16px;background:var(--line,#3a342a);margin:0 2px}#tlSizeBar label{display:inline-flex;align-items:center;gap:4px;margin:0}";
    document.head.appendChild(css);
    var bar = document.createElement("div"); bar.id = "tlSizeBar"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Timeline frame size");
    bar.innerHTML = '<span class="tsb-l">Frame</span>'
      + '<input type="number" id="tlFrW" min="64" max="8192" step="2" title="Width (pixels)" aria-label="Frame width"><span>×</span>'
      + '<input type="number" id="tlFrH" min="64" max="8192" step="2" title="Height (pixels)" aria-label="Frame height">'
      + '<span class="tsb-sep"></span><label>Preset <select id="tlFrPreset" title="A common size - Auto = the V1 video\'s own size"><option value="auto">Auto (the V1 video\'s size)</option><option value="">Custom</option>'
      + F.PRESETS.map(function (p) { return '<option value="' + p.id + '">' + esc(p.label) + "</option>"; }).join("") + "</select></label>"
      + '<label>Aspect <select id="tlFrAspect" title="Kept while you type a width or a height">' + F.ASPECTS.map(function (a) { return '<option value="' + a.id + '">' + esc(a.label) + "</option>"; }).join("") + "</select></label>"
      + '<span class="tsb-sep"></span><label title="The Create / 3D / Sketch / Solid toolbar over the preview"><input type="checkbox" id="tlFrCad"> CAD toolbar</label>'
      + '<span id="tlFrNote" style="color:var(--dim,#9a917f)"></span>';
    body.insertBefore(bar, body.firstChild);
    var q = function (id) { return $(id); };
    bar.querySelectorAll("input,select").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
    function paint(force) {
      var fr = tl.frame && F.normalize(tl.frame), W = C.state.W || 1280, H = C.state.H || 720;
      var w = fr ? fr.w : W, h = fr ? fr.h : H;
      if (force || document.activeElement !== q("tlFrW")) q("tlFrW").value = w;
      if (force || document.activeElement !== q("tlFrH")) q("tlFrH").value = h;
      q("tlFrPreset").value = fr ? (F.presetOf(fr.w, fr.h) || "") : "auto";
      q("tlFrAspect").value = (tl.frame && tl.frame.aspect) || F.aspectOf(w, h);
      q("tlFrNote").textContent = fr ? "" : "(Auto: " + W + " × " + H + ")";
      if (window.TlCadBar && TlCadBar.shown) q("tlFrCad").checked = !!TlCadBar.shown();
    }
    function apply(w, h, aspect) {
      var f = F.normalize({ w: w, h: h }); if (!f) return;
      tl.frame = { w: f.w, h: f.h, aspect: aspect || F.aspectOf(f.w, f.h) };
      changed();
    }
    function changed() {
      // what was baked at the old size is made again at the new one
      (window.TlParent && TlParent.all ? TlParent.all() : []).forEach(function (x) { delete x.c.bakeSig; delete x.c.vbakeSig; delete x.c.dbakeSig; delete x.c.mbakeSig; });
      if (typeof tlSave === "function") tlSave();
      try { C.mark(); C.draw(); } catch (e) { /* closed */ }
      setTimeout(function () { paint(true); }, 60);
    }
    var ratio = function () { var a = F.ASPECTS.filter(function (x) { return x.id === q("tlFrAspect").value; })[0]; return a ? a.r : 0; };
    var nowWH = function () { var fr = tl.frame && F.normalize(tl.frame); return fr ? [fr.w, fr.h] : [C.state.W, C.state.H]; };
    q("tlFrW").addEventListener("change", function () { var w = +q("tlFrW").value; if (F.even(w) === nowWH()[0]) return; var r = ratio(), h = r ? F.heightFor(w, r) : +q("tlFrH").value; apply(w, h, q("tlFrAspect").value); });
    q("tlFrH").addEventListener("change", function () { var h = +q("tlFrH").value; if (F.even(h) === nowWH()[1]) return; var r = ratio(), w = r ? F.widthFor(h, r) : +q("tlFrW").value; apply(w, h, q("tlFrAspect").value); });
    q("tlFrPreset").addEventListener("change", function () {
      var v = q("tlFrPreset").value;
      if (v === "auto") { delete tl.frame; changed(); return; }
      var p = F.PRESETS.filter(function (x) { return x.id === v; })[0]; if (p) apply(p.w, p.h, F.aspectOf(p.w, p.h));
    });
    q("tlFrAspect").addEventListener("change", function () {
      var r = ratio(), w = +q("tlFrW").value || C.state.W;
      if (r) apply(w, F.heightFor(w, r), q("tlFrAspect").value);
      else if (tl.frame) { tl.frame.aspect = "free"; if (typeof tlSave === "function") tlSave(); }
    });
    q("tlFrCad").addEventListener("change", function () { if (window.TlCadBar && TlCadBar.show) TlCadBar.show(q("tlFrCad").checked); });
    // the ⌬ CAD button in the tool column is hidden (the checkbox here switches the toolbar)
    var hideCad = function () { var b = $("tlCadBtn"); if (b) { b.style.display = "none"; return true; } return false; };
    if (!hideCad()) { var n = 0, t = setInterval(function () { if (hideCad() || ++n > 40) clearInterval(t); paint(); }, 500); }
    paint(); setInterval(function () { if (!bar.contains(document.activeElement)) paint(); }, 1500);
    window.TlSizeBar = { paint: paint, apply: apply, el: bar };
  }
})();
