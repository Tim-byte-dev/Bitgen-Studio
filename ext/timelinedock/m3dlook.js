/* bitGen Studio — a 3D layer's MATERIAL and LIGHTS (2.385.0), the Properties panel's 🎨 and 💡 sections.
 *
 * Tim (verbatim): "allow user to add lights to 3d scene - allow user to change the brightness of the lights - allow
 * user to add materials to 3d objects".
 *
 *   🎨 Material   a preset (gold, chrome, glass, neon …) or your own: colour, metal, rough, glow (emissive colour +
 *                 strength), see-through (opacity), clear coat, glass (transmission + IOR), wireframe, flat shading,
 *                 a texture picture (models3d/) and how often it repeats. A MODEL's parts each take the file's own
 *                 material, the layer's, or a preset.
 *   💡 Lights     the studio lights (on / off + brightness) and the layer's own: ＋ Point / Spot / Sun / Ambient / Sky,
 *                 each on / off, colour, BRIGHTNESS (slider), where it is (X / Y / Z around the object), a spot's cone, ✕
 * Everything lives in the clip's m3d spec (static/m3d.js draws it; a Blender bake renders the same spec) - an edit is
 * saved and the layer re-baked a moment later, like the other 3D properties.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && window.TlM3D && window.H3M3D && TlCanvas.onProps); } catch (e) { return false; } }
  function boot() { if (!$("tlCanvas")) return; if (!ready()) { setTimeout(boot, 60); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var ICON = { point: "💡", spot: "🔦", sun: "☀", ambient: "◌", sky: "⛅" };
  /* a new light: somewhere sensible around the object (it is 1 unit across; the camera looks from +Z) */
  function newLight(type) {
    var L = { id: "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: type, on: true, color: "#ffffff", power: 1 };
    if (type === "point") { L.x = 2; L.y = 2; L.z = 3; }
    else if (type === "spot") { L.x = -2; L.y = 3; L.z = 3; L.angle = 30; }
    else if (type === "sun") { L.x = 3; L.y = 4; L.z = 5; L.color = "#fff4e0"; }
    else if (type === "sky") { L.color = "#bcd8ff"; L.power = 0.8; }
    else { L.power = 0.5; }
    return L;
  }

  function start() {
    var C = window.TlCanvas, M = window.H3M3D, X = window.TlM3D;
    var textures = [];
    var CSS = ""
      + "#tlProps .m3l-h{display:flex;align-items:center;gap:6px;margin-top:8px}"
      + "#tlProps .m3l-h .tlp-t{margin:0}"
      + "#tlProps .m3l-h select,#tlProps .m3l-h button{width:auto;margin-left:auto}"
      + "#tlProps .m3l-light{border:1px solid var(--line);border-radius:6px;padding:4px 6px;margin-top:4px}"
      + "#tlProps .m3l-light.off{opacity:.55}"
      + "#tlProps .m3l-light .tlp-row{margin-top:2px}"
      + "#tlProps .m3l-light input[type=range]{flex:1}"
      + "#tlProps .m3l-light .m3l-x{margin-left:auto;padding:0 6px}"
      + "#tlProps .m3l-xyz{display:grid;grid-template-columns:auto 1fr auto 1fr auto 1fr;gap:3px 4px;align-items:center;margin-top:2px}"
      + "#tlProps .m3l-parts{max-height:150px;overflow:auto;margin-top:3px}"
      + "#tlProps .m3l-parts .tlp-row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
      + "#tlProps .m3l-parts select{width:118px}";
    if (!$("m3lCss")) { var st = document.createElement("style"); st.id = "m3lCss"; st.textContent = CSS; document.head.appendChild(st); }
    function listTextures() {
      return fetch("/api/tlcanvas/textures").then(function (r) { return r.json(); })
        .then(function (j) { textures = (j && j.textures) || []; return textures; }).catch(function () { return textures; });
    }
    var picker = document.createElement("input");
    picker.type = "file"; picker.accept = "image/png,image/jpeg,image/webp,image/bmp"; picker.hidden = true; picker.id = "m3lTexFile";
    document.body.appendChild(picker);
    var pickFor = null;
    picker.addEventListener("change", function () {
      var f = picker.files && picker.files[0]; picker.value = "";
      if (!f || !pickFor) return;
      var c = pickFor; pickFor = null;
      fetch("/api/tlcanvas/model?name=" + encodeURIComponent(f.name), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: f })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
        .then(function (j) { c.m3d.mat = c.m3d.mat || {}; c.m3d.mat.map = j.name; X.touch(c); listTextures().then(function () { C.paintProps(); }); })
        .catch(function (e) { C.say("texture: " + (e.message || e)); });
    });

    function presetOpts(sel, extra) {
      var o = (extra || []).map(function (e) { return '<option value="' + e[0] + '"' + (sel === e[0] ? " selected" : "") + ">" + e[1] + "</option>"; }).join("");
      return o + Object.keys(M.PRESETS).map(function (k) { return '<option value="' + k + '"' + (sel === k ? " selected" : "") + ">" + esc(M.PRESETS[k].label) + "</option>"; }).join("");
    }

    C.onProps(function (P, c) {
      if (!c || !c.m3d) return;
      var m = c.m3d, x = m.mat || {};
      /* ---------------- 🎨 Material */
      var h = '<div class="m3l-h"><div class="tlp-t">🎨 Material</div><select id="m3lPreset" title="A ready-made material - pick one, then change anything below">'
        + presetOpts(x.preset || "", [["", "Custom"]]) + "</select></div>"
        + '<div class="tlp-row"><input type="color" id="tlp3Color" value="' + esc(m.color || "#ffffff") + '" title="Colour">'
        + '<label>Metal <input type="number" id="tlp3Metal" min="0" max="1" step="0.05" value="' + num(m.metal, 0.25) + '" style="width:52px"></label>'
        + '<label>Rough <input type="number" id="tlp3Rough" min="0" max="1" step="0.05" value="' + num(m.rough, 0.35) + '" style="width:52px"></label></div>'
        + '<div class="tlp-row"><label title="Glow - the material gives off its own light">Glow <input type="color" id="m3lEmis" value="' + esc(x.emissive || "#000000") + '"></label>'
        + '<input type="range" id="m3lGlow" min="0" max="10" step="0.1" value="' + num(x.glow, 0) + '" title="Glow strength" style="flex:1">'
        + '<span id="m3lGlowV" style="width:28px;text-align:right">' + num(x.glow, 0) + "</span></div>"
        + '<div class="tlp-row"><label title="1 = solid, 0 = invisible">Opacity <input type="number" id="m3lOpac" min="0" max="1" step="0.05" value="' + num(x.opacity, 1) + '" style="width:52px"></label>'
        + '<label title="A clear lacquer layer on top">Coat <input type="number" id="m3lCoat" min="0" max="1" step="0.05" value="' + num(x.clearcoat, 0) + '" style="width:52px"></label></div>'
        + '<div class="tlp-row"><label title="Light passes through it (0 = none, 1 = glass)">Glass <input type="number" id="m3lGlass" min="0" max="1" step="0.05" value="' + num(x.glass, 0) + '" style="width:52px"></label>'
        + '<label title="Index of refraction (water 1.33, glass 1.5, diamond 2.4)">IOR <input type="number" id="m3lIor" min="1" max="2.33" step="0.01" value="' + num(x.ior, 1.5) + '" style="width:58px"></label></div>'
        + '<div class="tlp-row"><label><input type="checkbox" id="m3lWire"' + (x.wire ? " checked" : "") + "> wireframe</label>"
        + '<label><input type="checkbox" id="m3lFlat"' + (x.flat ? " checked" : "") + "> flat shading</label></div>"
        + '<div class="tlp-row"><select id="m3lMap" title="A texture picture (in the project\'s models3d)" style="flex:1"><option value="">no texture</option>'
        + (x.map && !textures.some(function (t) { return t.name === x.map; }) ? '<option selected>' + esc(x.map) + "</option>" : "")
        + textures.map(function (t) { return "<option" + (t.name === x.map ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") + "</select>"
        + '<button class="ghost" id="m3lMapAdd" title="Add a texture picture">＋</button>'
        + '<label title="How many times the texture repeats">×<input type="number" id="m3lRep" min="0.1" max="50" step="0.1" value="' + num(x.repeat, 1) + '" style="width:46px"></label></div>';
      if (m.type === "model") {
        var parts = M.parts(c);
        h += '<div class="tlp-row"><label title="Use the file\'s own materials and textures wherever a part says nothing else">'
          + '<input type="checkbox" id="tlp3Keep"' + (m.keepMat ? " checked" : "") + "> the file's own materials</label></div>";
        if (parts.length > 1) {
          h += '<div class="tlp-t" style="margin-top:4px">Parts (' + parts.length + ")</div><div class=\"m3l-parts\">"
            + parts.slice(0, 60).map(function (pt) {
              var use = (m.parts || {})[String(pt.n)] || "";
              return '<div class="tlp-row"><span title="' + esc(pt.name) + '">' + esc(pt.name) + '</span><select data-m3lpart="' + pt.n + '">'
                + presetOpts(use, [["", "(as above)"], ["own", "file's own"], ["layer", "this material"]]) + "</select></div>";
            }).join("") + "</div>";
        }
      }
      /* ---------------- 💡 Lights */
      var lights = Array.isArray(m.lights) ? m.lights : [];
      h += '<div class="m3l-h"><div class="tlp-t">💡 Lights</div><select id="m3lAdd" title="Add a light to this 3D scene"><option value="">＋ Add light</option>'
        + Object.keys(M.LIGHT_TYPES).map(function (t) { return '<option value="' + t + '">' + ICON[t] + " " + M.LIGHT_TYPES[t] + "</option>"; }).join("") + "</select></div>"
        + '<div class="m3l-light' + (m.studio === false ? " off" : "") + '"><div class="tlp-row"><label title="The three built-in lights (key, fill, ambient)">'
        + '<input type="checkbox" id="m3lStudio"' + (m.studio === false ? "" : " checked") + "> Studio lights</label></div>"
        + '<div class="tlp-row"><span>Brightness</span><input type="range" id="tlp3Light" min="0" max="4" step="0.05" value="' + num(m.light, 1) + '">'
        + '<span id="tlp3LightV" style="width:30px;text-align:right">' + num(m.light, 1) + "</span></div></div>";
      lights.forEach(function (L, i) {
        var pos = L.type !== "ambient" && L.type !== "sky";
        h += '<div class="m3l-light' + (L.on === false ? " off" : "") + '" data-m3li="' + i + '">'
          + '<div class="tlp-row"><label><input type="checkbox" data-m3lk="on"' + (L.on === false ? "" : " checked") + "> " + ICON[L.type] + " " + esc(M.LIGHT_TYPES[L.type] || L.type) + "</label>"
          + '<input type="color" data-m3lk="color" value="' + esc(L.color || "#ffffff") + '" title="Colour">'
          + '<button class="ghost m3l-x" data-m3lx title="Remove this light">✕</button></div>'
          + '<div class="tlp-row"><span>Brightness</span><input type="range" data-m3lk="power" min="0" max="20" step="0.1" value="' + num(L.power, 1) + '">'
          + '<input type="number" data-m3lk="power" min="0" max="20" step="0.1" value="' + num(L.power, 1) + '" style="width:50px"></div>'
          + (pos ? '<div class="m3l-xyz"><span>X</span><input type="number" data-m3lk="x" step="0.25" value="' + num(L.x, 0) + '" title="Right of the object">'
            + '<span>Y</span><input type="number" data-m3lk="y" step="0.25" value="' + num(L.y, 0) + '" title="Above the object">'
            + '<span>Z</span><input type="number" data-m3lk="z" step="0.25" value="' + num(L.z, 0) + '" title="In front of the object (toward the camera)"></div>' : "")
          + (L.type === "spot" ? '<div class="tlp-row"><span>Cone°</span><input type="number" data-m3lk="angle" min="1" max="89" step="1" value="' + num(L.angle, 30) + '" style="width:56px"></div>' : "")
          + "</div>";
      });
      P.insertAdjacentHTML("beforeend", h);
      if (!textures.length && !P._m3lAsked) { P._m3lAsked = true; listTextures().then(function (t) { if (t.length) C.paintProps(); }); }

      var mat = function () { if (!m.mat) m.mat = {}; return m.mat; };
      var custom = function () { if (m.mat && m.mat.preset) { delete m.mat.preset; var ps = $("m3lPreset"); if (ps) ps.value = ""; } };
      var on = function (id, ev, fn, keepPreset) {
        var el = $(id); if (!el) return;
        el.addEventListener(ev, function () { if (!keepPreset) custom(); fn(el); X.touch(c); });
      };
      on("m3lPreset", "change", function (el) {
        var P0 = M.PRESETS[el.value];
        if (!P0) { if (m.mat) delete m.mat.preset; return; }
        var x2 = mat();
        ["emissive", "glow", "clearcoat", "glass", "ior", "wire"].forEach(function (k) { delete x2[k]; });
        if (P0.color) m.color = P0.color;
        m.metal = P0.metal; m.rough = P0.rough;
        ["emissive", "glow", "clearcoat", "glass", "ior", "wire"].forEach(function (k) { if (P0[k] != null) x2[k] = P0[k]; });
        x2.preset = el.value;
        if (m.type === "model") m.keepMat = false;      // a preset on a model paints it (its parts can still keep their own)
        setTimeout(function () { C.paintProps(); }, 0);
      }, true);
      on("tlp3Color", "input", function (el) { m.color = el.value; });
      on("tlp3Metal", "input", function (el) { m.metal = clamp(num(el.value, 0.25), 0, 1); });
      on("tlp3Rough", "input", function (el) { m.rough = clamp(num(el.value, 0.35), 0, 1); });
      on("m3lEmis", "input", function (el) { mat().emissive = el.value; if (!num(mat().glow, 0)) { mat().glow = 1; var g = $("m3lGlow"); if (g) g.value = 1; } });
      on("m3lGlow", "input", function (el) { mat().glow = clamp(num(el.value, 0), 0, 10); $("m3lGlowV").textContent = mat().glow; });
      on("m3lOpac", "input", function (el) { mat().opacity = clamp(num(el.value, 1), 0, 1); });
      on("m3lCoat", "input", function (el) { mat().clearcoat = clamp(num(el.value, 0), 0, 1); });
      on("m3lGlass", "input", function (el) { mat().glass = clamp(num(el.value, 0), 0, 1); });
      on("m3lIor", "input", function (el) { mat().ior = clamp(num(el.value, 1.5), 1, 2.33); });
      on("m3lWire", "change", function (el) { mat().wire = el.checked; });
      on("m3lFlat", "change", function (el) { mat().flat = el.checked; });
      on("m3lMap", "change", function (el) { if (el.value) mat().map = el.value; else delete mat().map; }, true);
      on("m3lRep", "input", function (el) { mat().repeat = clamp(num(el.value, 1), 0.1, 50); }, true);
      var ma = $("m3lMapAdd"); if (ma) ma.addEventListener("click", function () { pickFor = c; picker.click(); });
      on("tlp3Keep", "change", function (el) { m.keepMat = el.checked; }, true);
      P.querySelectorAll("[data-m3lpart]").forEach(function (sel) {
        sel.addEventListener("change", function () {
          m.parts = m.parts || {};
          if (sel.value) m.parts[sel.getAttribute("data-m3lpart")] = sel.value; else delete m.parts[sel.getAttribute("data-m3lpart")];
          if (!Object.keys(m.parts).length) delete m.parts;
          X.touch(c);
        });
      });
      // lights
      on("m3lStudio", "change", function (el) { if (el.checked) delete m.studio; else m.studio = false; el.closest(".m3l-light").classList.toggle("off", !el.checked); }, true);
      on("tlp3Light", "input", function (el) { m.light = clamp(num(el.value, 1), 0, 4); $("tlp3LightV").textContent = m.light; }, true);
      var add = $("m3lAdd");
      if (add) add.addEventListener("change", function () {
        if (!add.value) return;
        m.lights = (Array.isArray(m.lights) ? m.lights : []).concat([newLight(add.value)]);
        X.touch(c); C.paintProps();
      });
      P.querySelectorAll("[data-m3li]").forEach(function (box) {
        var L = m.lights[+box.getAttribute("data-m3li")];
        box.querySelectorAll("[data-m3lk]").forEach(function (inp) {
          var k = inp.getAttribute("data-m3lk");
          inp.addEventListener(inp.type === "checkbox" ? "change" : "input", function () {
            if (k === "on") { L.on = inp.checked; box.classList.toggle("off", !inp.checked); }
            else if (k === "color") L.color = inp.value;
            else if (k === "power") {
              L.power = clamp(num(inp.value, 1), 0, 20);
              box.querySelectorAll('[data-m3lk="power"]').forEach(function (o) { if (o !== inp) o.value = L.power; });
            } else if (k === "angle") L.angle = clamp(num(inp.value, 30), 1, 89);
            else L[k] = clamp(num(inp.value, 0), -100, 100);
            X.touch(c);
          });
        });
        box.querySelector("[data-m3lx]").addEventListener("click", function () {
          m.lights = m.lights.filter(function (y) { return y !== L; });
          if (!m.lights.length) delete m.lights;
          X.touch(c); C.paintProps();
        });
      });
    });
    // a model's parts are known once it has loaded: the list appears then
    M.onChange(function () {
      var s = C.selClip && C.selClip();
      var P = $("tlProps");
      if (s && s.c.m3d && s.c.m3d.type === "model" && P && !P.querySelector(".m3l-parts") && M.parts(s.c).length > 1
          && !(document.activeElement && P.contains(document.activeElement))) C.paintProps();
    });
    window.TlM3DLook = { newLight: newLight, listTextures: listTextures };
  }
})();
