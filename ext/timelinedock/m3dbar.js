/* bitGen Studio — the 3D TOOLBAR over the preview canvas (2.386.0), window.Tl3DBar.
 *
 * Tim (verbatim): "can we have a top toolbar when user selects a 3d layer for 3d operations?"
 *
 * A bar along the TOP of the preview canvas, shown only while a 3D layer is selected (and gone again when it is not):
 *   ✥ ⟲ ⤡ ○     the widget: move (G) / rotate (R) / scale (S) / none - the same as the keys and the Properties
 *   🧲          snap every turn to 15° (Shift does it for one drag)
 *   views       ⬛ front, ◧ left, ◨ right, ⬒ top, ⬓ bottom, ↺ back (the rotation set to that view), ⟲0 no rotation
 *   ⟳ spin      turns round Y by itself (30°/s) / stops it
 *   ⤢ reset     depth 0, its own scale 100% (X / Y / Z)
 *   🎨          a material preset (or Custom)
 *   ☀ + slider  the studio lights on / off and their brightness;  ＋💡 adds a light (Point / Spot / Sun / Ambient / Sky)
 *   ◇ Key       a keyframe at the position marker (rotation, depth, scale, position…)
 *   🟧          render with Blender on / off, ⚙ its settings;  🧊 Bake now
 * Every change goes through the same paths as the Properties (TlM3D.keyed / touch), so the floating Properties, the
 * widgets and the bake all follow.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && window.TlM3D && window.H3M3D && window.TlGizmo && window.TlM3DLook); } catch (e) { return false; } }
  function boot() { if (!$("tlCanvas")) return; if (!ready()) { setTimeout(boot, 60); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var VIEWS = [["front", "⬛", "Front - facing you", 0, 0], ["left", "◧", "From the left", 0, 90], ["right", "◨", "From the right", 0, -90],
               ["top", "⬒", "From above", 90, 0], ["bottom", "⬓", "From below", -90, 0], ["back", "↺", "From behind", 0, 180]];

  function start() {
    var C = window.TlCanvas, M = window.H3M3D, X = window.TlM3D, G = window.TlGizmo, LK = window.TlM3DLook, S = C.state, K = window.H3Keyframes;
    var CSS = ""
      // one row (it scrolls sideways in a narrow canvas) - never eats the canvas's height
      + "#tl3dBar{display:none;align-items:center;gap:4px;flex:none;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;"
      + "padding:3px 6px;border:1px solid var(--line);border-radius:6px;background:#16130f;font-size:.7rem;white-space:nowrap}"
      + "#tl3dBar > *{flex:none}"
      + "#tl3dBar.on{display:flex}"
      + "#tl3dBar .t3-name{color:var(--tiger);font-weight:600;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
      + "#tl3dBar button{padding:1px 6px;font-size:.78rem;line-height:1.4;min-width:0}"
      + "#tl3dBar button.on{background:var(--tiger);color:#14120f;border-color:var(--tiger)}"
      + "#tl3dBar .t3-sep{width:1px;height:18px;background:var(--line);margin:0 3px}"
      + "#tl3dBar select{font-size:.7rem;padding:1px 3px;max-width:120px}"
      + "#tl3dBar input[type=range]{width:70px}";
    if (!$("tl3dCss")) { var st = document.createElement("style"); st.id = "tl3dCss"; st.textContent = CSS; document.head.appendChild(st); }
    var col = $("tlCanvasCol"), wrap = $("tlCanvasWrap");
    if (!col || !wrap || $("tl3dBar")) return;
    var bar = document.createElement("div");
    bar.id = "tl3dBar"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "3D tools");
    var modes = [["move", "✥", "Move widget (G) - X / Y across, Z toward the camera"], ["rotate", "⟲", "Rotate widget (R) - tumble, X / Y rings, roll"],
                 ["scale", "⤡", "Scale widget (S) - its own X / Y / Z, or evenly"], ["off", "○", "No widget"]];
    bar.innerHTML = '<span class="t3-name" id="t3Name">🧊</span><span class="t3-sep"></span>'
      + modes.map(function (m) { return '<button class="ghost" type="button" data-t3mode="' + m[0] + '" title="' + m[2] + '">' + m[1] + "</button>"; }).join("")
      + '<button class="ghost" type="button" id="t3Snap" title="Snap every turn to 15° (Shift does it for one drag)">🧲</button><span class="t3-sep"></span>'
      + VIEWS.map(function (v) { return '<button class="ghost" type="button" data-t3view="' + v[0] + '" title="View: ' + v[2] + '">' + v[1] + "</button>"; }).join("")
      + '<button class="ghost" type="button" id="t3Zero" title="No rotation (X / Y / Z 0°)">⟲0</button>'
      + '<button class="ghost" type="button" id="t3Spin" title="Spin round Y by itself (30°/s) - again to stop">⟳</button>'
      + '<button class="ghost" type="button" id="t3Reset" title="Depth 0 and its own scale back to 100%">⤢</button><span class="t3-sep"></span>'
      + '<select id="t3Mat" title="🎨 Material preset"><option value="">🎨 Custom</option>'
      + Object.keys(M.PRESETS).map(function (k) { return '<option value="' + k + '">' + esc(M.PRESETS[k].label) + "</option>"; }).join("") + "</select>"
      + '<button class="ghost" type="button" id="t3Studio" title="Studio lights on / off">☀</button>'
      + '<input type="range" id="t3Bright" min="0" max="4" step="0.05" title="Studio lights brightness">'
      + '<select id="t3Light" title="Add a light"><option value="">＋💡</option>'
      + Object.keys(M.LIGHT_TYPES).map(function (k) { return '<option value="' + k + '">' + esc(M.LIGHT_TYPES[k]) + "</option>"; }).join("") + "</select>"
      + '<span class="t3-sep"></span><button class="ghost" type="button" id="t3Key" title="◇ Keyframe the 3D layer here (rotation, depth, scale, position…)">◇ Key</button>'
      + '<span class="t3-sep"></span><button class="ghost" type="button" id="t3Blender" title="Render it with Blender for the compile (the canvas keeps the quick preview)">🟧</button>'
      + '<button class="ghost" type="button" id="t3BlSet" title="Blender settings">⚙</button>'
      + '<button class="ghost" type="button" id="t3Bake" title="🧊 Bake it now">🧊 Bake</button>';
    col.insertBefore(bar, wrap);

    var cur = null;
    function sel() {
      var s = C.selClip && C.selClip();
      return s && s.c && s.c.m3d && s.Ly.kind === "vl" ? s : null;
    }
    function tau(c) { return Math.max(0, S.t - (c.start || 0)); }
    function val(c, p, d) { var m = c.m3d; return K && K.has(c.kf, p) ? num(K.value(c.kf, tau(c), p, num(m[p], d)), d) : num(m[p], d); }
    function changed(c, rebuild) { X.touch(c, rebuild); C.paintProps(); paint(); }
    function paint() {
      var s = sel();
      bar.classList.toggle("on", !!s);
      cur = s ? s.c : null;
      if (!s) return;
      var c = s.c, m = c.m3d;
      $("t3Name").textContent = "🧊 " + (s.Ly.L.name || s.Ly.lk) + " · " + (m.type === "text" ? "3D text" : "3D model");
      $("t3Name").title = m.type === "text" ? String(m.text || "") : String(m.model || "");
      var md = G.mode();
      bar.querySelectorAll("[data-t3mode]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-t3mode") === md); });
      $("t3Snap").classList.toggle("on", G.snap());
      var rx = val(c, "rx", 0), ry = val(c, "ry", 0);
      bar.querySelectorAll("[data-t3view]").forEach(function (b) {
        var v = VIEWS.filter(function (x) { return x[0] === b.getAttribute("data-t3view"); })[0];
        b.classList.toggle("on", Math.abs(rx - v[3]) < 0.5 && Math.abs(ry - v[4]) < 0.5 && Math.abs(val(c, "rz", 0)) < 0.5);
      });
      $("t3Spin").classList.toggle("on", num(m.spinY, 0) !== 0);
      $("t3Mat").value = (m.mat && m.mat.preset) || "";
      $("t3Studio").classList.toggle("on", m.studio !== false);
      if (document.activeElement !== $("t3Bright")) $("t3Bright").value = num(m.light, 1);
      $("t3Blender").classList.toggle("on", m.renderer === "blender");
    }
    G.onMode(paint);
    var lastSel = undefined;
    C.onDraw(function () {                // the selection changed (or the time moved past a view's rotation)
      var s = sel(), c = s ? s.c : null;
      if (c !== lastSel) { lastSel = c; paint(); }
    });

    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || !cur) return;
      var c = cur, m = c.m3d;
      var md = b.getAttribute("data-t3mode");
      if (md) { if (S.tool !== "move") C.setTool("move"); G.setMode(md); return; }
      var vw = b.getAttribute("data-t3view");
      if (vw) {
        var v = VIEWS.filter(function (x) { return x[0] === vw; })[0];
        X.keyed(c, "rx", v[3]); X.keyed(c, "ry", v[4]); X.keyed(c, "rz", 0);
        return changed(c, !!c.kf);
      }
      switch (b.id) {
        case "t3Snap": G.snap(!G.snap()); paint(); break;
        case "t3Zero": X.keyed(c, "rx", 0); X.keyed(c, "ry", 0); X.keyed(c, "rz", 0); changed(c, !!c.kf); break;
        case "t3Spin": m.spinY = num(m.spinY, 0) !== 0 ? 0 : 30; changed(c); break;
        case "t3Reset": X.keyed(c, "pz", 0); ["sx", "sy", "sz"].forEach(function (p) { X.keyed(c, p, 1); }); changed(c, !!c.kf); break;
        case "t3Studio": if (m.studio === false) delete m.studio; else m.studio = false; changed(c); break;
        case "t3Key":
          if (typeof kfAdd !== "function" || !(C.at && C.at(c, "vl", S.t))) return;
          kfAdd(c, tau(c), "video", C.layerOf(c).lk);
          if (C.keysChanged) C.keysChanged(c);
          if (typeof renderTimeline === "function") renderTimeline();
          paint();
          break;
        case "t3Blender": if (m.renderer === "blender") delete m.renderer; else m.renderer = "blender"; changed(c); break;
        case "t3BlSet": if (window.TlBlender) TlBlender.openSettings(); break;
        case "t3Bake": X.bake(c).catch(function () { /* the 3D state line says why */ }); break;
      }
    });
    $("t3Mat").addEventListener("change", function () {
      var c = cur; if (!c) return;
      var m = c.m3d, k = $("t3Mat").value, P0 = M.PRESETS[k];
      m.mat = m.mat || {};
      if (!P0) { delete m.mat.preset; return changed(c); }
      ["emissive", "glow", "clearcoat", "glass", "ior", "wire"].forEach(function (x) { delete m.mat[x]; });
      if (P0.color) m.color = P0.color;
      m.metal = P0.metal; m.rough = P0.rough;
      ["emissive", "glow", "clearcoat", "glass", "ior", "wire"].forEach(function (x) { if (P0[x] != null) m.mat[x] = P0[x]; });
      m.mat.preset = k;
      if (m.type === "model") m.keepMat = false;
      changed(c);
    });
    $("t3Bright").addEventListener("input", function () {
      var c = cur; if (!c) return;
      c.m3d.light = Math.max(0, Math.min(4, num($("t3Bright").value, 1)));
      C.mark();
    });
    $("t3Bright").addEventListener("change", function () { if (cur) changed(cur); });
    $("t3Light").addEventListener("change", function () {
      var c = cur, t = $("t3Light").value; $("t3Light").value = "";
      if (!c || !t) return;
      c.m3d.lights = (Array.isArray(c.m3d.lights) ? c.m3d.lights : []).concat([LK.newLight(t)]);
      changed(c);
    });
    paint();
    window.Tl3DBar = { paint: paint, el: bar };
  }
})();
