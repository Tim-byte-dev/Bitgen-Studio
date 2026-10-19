/* bitGen Studio — ext/timelinedock/tlblend.js (2.491.0): BLEND MODES and TRACK MATTES on the timeline's layers.
 * window.TlBlendMode.
 *
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested" - AFTER-EFFECTS-GAP.md item 6: "Track mattes (alpha / luma,
 * inverted) and blending modes on timeline layers".
 *
 *   Blend   (Properties, for the selected clip's LAYER) Normal, Multiply, Screen, Overlay, Darken, Lighten, Color
 *           Dodge, Color Burn, Hard Light, Soft Light, Difference, Exclusion, Add - how the layer mixes with what is
 *           under it; 2.495.0: + Hue, Saturation, Color, Luminosity (brightness Y and colour U V, full-range BT.601:
 *           Luminosity = the layer's Y on the base's colour, Color = the other way round, Hue = the layer's colour
 *           direction at the base's strength, Saturation = the base's direction at the layer's strength)
 *   Matte   None, Alpha, Alpha Inverted, Luma, Luma Inverted - the layer shows only where the layer RIGHT ABOVE it is
 *           (its alpha or its brightness), or only where it is not; that matte layer is then not drawn itself
 *           (even when hidden it still works as the matte)
 * The canvas (canvas.js drawLayer / applyMatte) and the compile (worker.py _composite_ops: ffmpeg blend + alphamerge)
 * draw the same; the layer keys travel through timelinedock.js tlLayerKeys -> lib/tlKeys.layerKeys.
 */
(function () {
  "use strict";
  var BL = [["normal", "Normal"], ["multiply", "Multiply"], ["screen", "Screen"], ["overlay", "Overlay"], ["darken", "Darken"], ["lighten", "Lighten"],
            ["color-dodge", "Color Dodge"], ["color-burn", "Color Burn"], ["hard-light", "Hard Light"], ["soft-light", "Soft Light"], ["difference", "Difference"],
            ["exclusion", "Exclusion"], ["add", "Add"],
            // 2.495.0 (Tim: "is there someway to get hue saturation, clor, luminosity blend modes to work?"): the colour
            // modes - worked out in YUV by the canvas (canvas.js blendYUV) and the compile (worker.py _hsl_blend) alike
            ["hue", "Hue"], ["saturation", "Saturation"], ["color", "Color"], ["luminosity", "Luminosity"]];
  var MT = [["", "None"], ["alpha", "Alpha"], ["alphainv", "Alpha Inverted"], ["luma", "Luma"], ["lumainv", "Luma Inverted"]];
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.drawLayer && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (window.TlBlendMode) return;
    var C = window.TlCanvas;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function above(Ly) { var st = C.stack(), k = st.findIndex(function (x) { return x.L === Ly.L; }); return k >= 0 ? st[k + 1] || null : null; }
    function set(L, k, v) {
      if (!v || v === "normal") delete L[k]; else L[k] = v;
      if (typeof tlSave === "function") tlSave();
      C.mark(); C.paintLayers(); if (typeof renderTimeline === "function") renderTimeline();
    }
    C.onProps(function (P, c, sel) {
      if (!sel || !sel.Ly || sel.Ly.kind === "v1" || sel.Ly.kind === "aud" || !P) return;
      var L = sel.Ly.L, up = above(sel.Ly), d = document.createElement("div"); d.className = "tlp-blend";
      d.innerHTML = '<div class="tlp-row"><span title="How this layer mixes with what is under it">◐ Blend</span><select id="tlpBlend" style="flex:1">'
        + BL.map(function (b) { return '<option value="' + b[0] + '"' + ((L.blend || "normal") === b[0] ? " selected" : "") + ">" + b[1] + "</option>"; }).join("") + "</select></div>"
        + '<div class="tlp-row"><span title="Show this layer only where the layer right above it is (or is not)">▣ Matte</span><select id="tlpMatte" style="flex:1"' + (up ? "" : " disabled") + ">"
        + MT.map(function (m) { return '<option value="' + m[0] + '"' + ((L.matte || "") === m[0] ? " selected" : "") + ">" + m[1] + "</option>"; }).join("") + "</select>"
        + '<span class="tlp-none" title="The matte layer">' + (up ? "↑ " + esc(up.L.name || up.lk) : "no layer above") + "</span></div>";
      P.appendChild(d);
      document.getElementById("tlpBlend").addEventListener("change", function (e) { set(L, "blend", e.target.value); });
      document.getElementById("tlpMatte").addEventListener("change", function (e) { set(L, "matte", e.target.value); });
    });
    window.TlBlendMode = { BLENDS: BL, MATTES: MT, set: set, above: above };
  }
})();
