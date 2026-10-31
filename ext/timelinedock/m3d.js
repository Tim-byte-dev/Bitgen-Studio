/* bitGen Studio — the timeline canvas's 🧊 3D LAYERS (2.382.0), window.TlM3D.
 *
 * Tim (verbatim): "can we add 3d model(fbx, obj) to timeline canvas and 3d text?"
 *
 *   🧊 (the canvas toolbar, under T)   3D text, a 3D model file (.fbx / .obj - pick the .mtl and textures with it), or
 *                                      one of the project's models (projects/<p>/models3d)
 *   drop .fbx / .obj on the canvas     each model becomes a 3D layer where it was dropped (with what came beside it)
 *   Properties (a 3D layer selected)   text, font, bold / italic, depth, bevel | the model, keep its materials | colour,
 *                                      metal, rough, light | rotation X / Y / Z (◆ keyframed with ◇ Key) and spin °/s |
 *                                      the picture's size, the length | the bake state and 🧊 Bake
 * A 3D layer is a VIDEO-layer clip ({name: m3d_<id>.webm, src: "video", m3d: {...}}): the canvas draws it live
 * (static/m3d.js) and places it with X / Y / Scale / Rotation / Opacity like any video; the compile overlays its BAKE
 * (video/m3d_<id>.webm, see-through). A bake runs a moment after an edit, and ⚙ Compile waits for any that are due
 * (TlCanvas.beforeExport -> bakeAll).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return typeof tl === "object" && tl && window.TlCanvas && window.H3M3D; } catch (e) { return false; } }
  function boot() { if (!$("tlCanvas")) return; if (!ready()) { setTimeout(boot, 60); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function start() {
    var C = window.TlCanvas, M = window.H3M3D, S = C.state;
    var FONTS = ["Arial", "Arial Black", "Impact", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New", "Comic Sans MS"];
    var bakes = new WeakMap();      // clip -> {timer, running: Promise, done, n, of, error}
    var models = [];
    function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function log(t) { if (typeof logLine === "function") logLine(t); }
    function save() { if (typeof tlSave === "function") tlSave(); }
    function lenOf(c) { return Math.max(0.1, num(c.out, 5) - num(c.in, 0)); }
    function all3d() {
      var out = [];
      (tl.vlayers || []).forEach(function (L) { (L.clips || []).forEach(function (c) { if (c.m3d) out.push(c); }); });
      return out;
    }

    /* ---- the 🧊 button and its menu */
    var CSS = ""
      + ".m3dmenu{position:fixed;z-index:60;min-width:200px;background:var(--panel-2,#26221b);border:1px solid var(--line,#3a342a);"
      + "border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.5);font-size:.76rem}"
      + ".m3dmenu button{display:block;width:100%;text-align:left;padding:5px 9px;border:0;background:none;color:var(--text,#e8e2d6);border-radius:5px;cursor:pointer}"
      + ".m3dmenu button:hover{background:rgba(245,158,44,.16)}"
      + ".m3dmenu .m3d-sep{height:1px;background:var(--line,#3a342a);margin:4px 2px}"
      + ".m3dmenu .m3d-h{padding:2px 9px;color:var(--dim,#9a917f);font-size:.66rem;letter-spacing:.1em;text-transform:uppercase}"
      + "#tlProps .m3d-st{color:var(--dim);font-size:.68rem;margin-left:auto}";
    if (!$("m3dCss")) { var st = document.createElement("style"); st.id = "m3dCss"; st.textContent = CSS; document.head.appendChild(st); }
    var btn = document.createElement("button");
    btn.className = "ghost"; btn.id = "tlTool_m3d"; btn.type = "button"; btn.textContent = "🧊";
    btn.title = "3D - 3D text or a 3D model (.fbx / .obj / .glb / .gltf)"; btn.setAttribute("aria-label", "3D layer");
    var txt = $("tlTool_text");
    if (txt && txt.parentNode) txt.parentNode.insertBefore(btn, txt.nextSibling);
    var picker = document.createElement("input");
    picker.type = "file"; picker.multiple = true; picker.accept = ".fbx,.obj,.glb,.gltf,.bin,.mtl,.png,.jpg,.jpeg,.tga,.bmp,.webp"; picker.hidden = true; picker.id = "m3dFile";
    document.body.appendChild(picker);
    var menu = null;
    function closeMenu() { if (menu) { menu.remove(); menu = null; } }
    function openMenu() {
      closeMenu();
      menu = document.createElement("div");
      menu.className = "m3dmenu"; menu.id = "m3dMenu";
      var r = btn.getBoundingClientRect();
      menu.style.left = (r.right + 6) + "px"; menu.style.top = r.top + "px";
      menu.innerHTML = '<button type="button" data-m="text">🔤 3D text</button><button type="button" data-m="file" title=".fbx, .obj (+ .mtl), .glb, .gltf (+ .bin) and their textures">📦 3D model file…</button>';
      document.body.appendChild(menu);
      listModels().then(function (list) {
        if (!menu || !list.length) return;
        menu.insertAdjacentHTML("beforeend", '<div class="m3d-sep"></div><div class="m3d-h">This project</div>'
          + list.map(function (m) { return '<button type="button" data-m="model" data-name="' + esc(m.name) + '">🧊 ' + esc(m.name) + "</button>"; }).join(""));
      });
      menu.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-m]"); if (!b) return;
        var m = b.getAttribute("data-m");
        closeMenu();
        if (m === "text") add("text");
        else if (m === "file") picker.click();
        else add("model", b.getAttribute("data-name"));
      });
    }
    btn.addEventListener("click", function (e) { e.stopPropagation(); if (menu) closeMenu(); else openMenu(); });
    document.addEventListener("pointerdown", function (e) { if (menu && !menu.contains(e.target) && e.target !== btn) closeMenu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
    picker.addEventListener("change", function () {
      var files = Array.prototype.slice.call(picker.files || []);
      picker.value = "";
      if (files.length) upload(files).then(function (names) { names.forEach(function (n, i) { add("model", n, { x: i * 40, y: i * 40 }); }); });
    });

    function listModels() {
      return fetch("/api/tlcanvas/models").then(function (r) { return r.json(); })
        .then(function (j) { models = (j && j.models) || []; return models; }).catch(function () { return models; });
    }
    /* every file goes into models3d/ (an OBJ's .mtl and textures with it); resolves the MODEL files' names */
    function upload(files) {
      var names = [];
      return files.reduce(function (p, f) {
        return p.then(function () {
          return fetch("/api/tlcanvas/model?name=" + encodeURIComponent(f.name), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: f })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
            .then(function (j) { if (j.model) names.push(j.name); })
            .catch(function (e) { C.say(f.name + ": " + (e.message || e)); });
        });
      }, Promise.resolve()).then(function () { listModels(); return names; });
    }
    function takeDrop(files, t0, off) {
      if (!files.some(function (f) { return /\.(fbx|obj|glb|gltf)$/i.test(f.name); })) return false;
      upload(files).then(function (names) {
        names.forEach(function (n, i) { add("model", n, { x: off.x + i * 40, y: off.y + i * 40 }, t0); });
      });
      return true;
    }

    /* ---- a new 3D layer at the playhead */
    function add(type, modelName, at, t0, label) {      // 2.626.0: label - the layer's name (the Sketcher's "📏 Sketcher · <model>")
      var id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var spec = M.defaults(type, S.W, S.H);
      if (type === "model") spec.model = modelName || "";
      var start = t0 != null ? t0 : Math.round(num(S.t, 0) * 24) / 24;
      var c = { name: "m3d_" + id + ".webm", src: "video", mid: id, in: 0, out: 5, dur: 5, start: start, opacity: 1,
                tf: { x: Math.round((at && at.x) || 0), y: Math.round((at && at.y) || 0), scale: 1, rot: 0 }, m3d: spec };
      var n = all3d().length + 1;
      C.newLayer("video", c, label ? String(label).slice(0, 80) : "3D" + n);
      M.load().catch(function (e) { C.say(String(e.message || e)); });
      schedule(c);
      log("[canvas] 🧊 3D " + (type === "text" ? "text" : "model " + (modelName || "")) + " layer at " + start.toFixed(2) + "s");
      return c;
    }

    /* ---- the bake (what the compile overlays) */
    function stateOf(c) { var b = bakes.get(c); if (!b) { b = {}; bakes.set(c, b); } return b; }
    function due(c) { return c.m3dBaked !== M.sig(c); }
    function schedule(c, ms) {
      var b = stateOf(c);
      clearTimeout(b.timer);
      // a Blender render is slow: it waits for the edits to settle (8 s) - ⚙ Compile and 🧊 Bake never wait
      b.timer = setTimeout(function () { bake(c).catch(function () { /* shown in the 3D state line */ }); }, ms == null ? (c.m3d && c.m3d.renderer === "blender" ? 8000 : 1500) : ms);
      paintState(c);
    }
    function bake(c) {
      var b = stateOf(c);
      clearTimeout(b.timer); b.timer = null;
      if (b.running) return b.running.then(function () { return due(c) ? bake(c) : null; });
      if (!due(c)) return Promise.resolve(null);
      var want = M.sig(c);
      b.error = null; b.n = 0; b.of = 0;
      // 2.385.0: a layer set to "Render with Blender" is rendered by a local Blender (ext/timelinedock/m3dblender.js)
      var runner = c.m3d && c.m3d.renderer === "blender" && window.TlBlender ? TlBlender.bake : M.bake;
      b.running = runner(c, { fps: typeof TLFPS === "number" ? TLFPS : 24, onProgress: function (i, n) { b.n = i; b.of = n; paintState(c); } })
        .then(function (j) {
          b.running = null;
          if (M.sig(c) === want) { c.m3dBaked = want; save(); }
          paintState(c);
          if (due(c)) return bake(c);
          return j;
        })
        .catch(function (e) { b.running = null; b.error = String(e.message || e); paintState(c); log("[canvas] 🧊 bake failed: " + b.error); throw e; });
      paintState(c);
      return b.running;
    }
    /* ⚙ Compile: every 3D layer that is not baked as it is now, baked first */
    function bakeAll() {
      var list = all3d().filter(due);
      if (!list.length) return Promise.resolve(true);
      C.say("🧊 baking " + list.length + " 3D layer(s) for the compile…");
      return list.reduce(function (p, c) { return p.then(function () { return bake(c); }); }, Promise.resolve())
        .then(function () { C.say(""); return true; });
    }
    function paintState(c) {
      var el = $("tlp3State"); if (!el || el._for !== c) return;
      var b = stateOf(c);
      var by = c.m3d && c.m3d.renderer === "blender" ? " (Blender)" : "";
      el.textContent = b.error ? "⚠ " + b.error : b.running ? "baking" + by + " " + (b.n || 0) + "/" + (b.of || "…") : b.timer ? "bake due" : due(c) ? "not baked" : "baked" + by + " ✓";
    }

    /* ---- the Properties panel's 3D part */
    function rotKey(c, prop, v) {
      if (window.H3Keyframes && H3Keyframes.has(c.kf, prop)) return C.writeKeyed(c, prop, v);
      c.m3d[prop] = v; return false;
    }
    C.onProps(function (P, c) {
      if (!c || !c.m3d) return;
      var m = c.m3d, tau = Math.max(0, S.t - (c.start || 0));
      var K = window.H3Keyframes;
      var rv = function (p, d) { return K && K.has(c.kf, p) ? Math.round(num(K.value(c.kf, tau, p, d), d) * 10) / 10 : d; };
      var h = '<div class="tlp-t" style="margin-top:8px">🧊 3D</div>';
      if (m.type === "text") {
        h += '<textarea id="tlp3Text" rows="2" title="The 3D text">' + esc(m.text) + "</textarea>"
          + '<div class="tlp-row"><select id="tlp3Font" title="Font (this computer\'s fonts)">' + FONTS.map(function (f) { return "<option" + (f === m.font ? " selected" : "") + ">" + esc(f) + "</option>"; }).join("") + "</select>"
          + '<label><input type="checkbox" id="tlp3Bold"' + (m.bold ? " checked" : "") + "><b>B</b></label>"
          + '<label><input type="checkbox" id="tlp3Ital"' + (m.italic ? " checked" : "") + "><i>I</i></label></div>"
          + '<div class="tlp-row"><label>Depth <input type="number" id="tlp3Depth" min="0" max="5" step="0.05" value="' + num(m.depth, 0.25) + '" style="width:58px"></label>'
          + '<label>Bevel <input type="number" id="tlp3Bevel" min="0" max="0.5" step="0.01" value="' + num(m.bevel, 0) + '" style="width:58px"></label></div>'
          + (window.H3TextFx ? '<div class="tlp-row" id="tlp3FxRow"><span style="font-size:.72rem" title="A text effect preset on the 3D text: its look is the front face, the sides take its colour">Preset</span></div>' : "");   // 2.607.0
      } else {
        h += '<div class="tlp-row"><select id="tlp3Model" title="The model file (projects/&lt;p&gt;/models3d)">'
          + (models.some(function (x) { return x.name === m.model; }) || !m.model ? "" : '<option selected>' + esc(m.model) + "</option>")
          + models.map(function (x) { return "<option" + (x.name === m.model ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select>"
          + '<label title="Use the file\'s own materials and textures (off: one colour)"><input type="checkbox" id="tlp3Keep"' + (m.keepMat ? " checked" : "") + "> own materials</label>"
          + '<label title="Play the file\'s own animation"><input type="checkbox" id="tlp3Anim"' + (m.anim !== false ? " checked" : "") + "> anim</label></div>";
      }
      // 2.385.0: colour / metal / rough / the studio light moved to 🎨 Material and 💡 Lights (m3dlook.js)
      h += '<div class="tlp-g" style="margin-top:4px">'
        + '<span>Rot X°</span><input type="number" id="tlp3RX" step="1" value="' + rv("rx", num(m.rx, 0)) + '" title="Tilt (◆ keyed once a keyframe holds it)">'
        + '<span>Spin X</span><input type="number" id="tlp3SX" step="5" value="' + num(m.spinX, 0) + '" title="Degrees per second">'
        + '<span>Rot Y°</span><input type="number" id="tlp3RY" step="1" value="' + rv("ry", num(m.ry, 0)) + '" title="Turn">'
        + '<span>Spin Y</span><input type="number" id="tlp3SY" step="5" value="' + num(m.spinY, 0) + '" title="Degrees per second">'
        + '<span>Rot Z°</span><input type="number" id="tlp3RZ" step="1" value="' + rv("rz", num(m.rz, 0)) + '" title="Roll">'
        + '<span>Spin Z</span><input type="number" id="tlp3SZ" step="5" value="' + num(m.spinZ, 0) + '" title="Degrees per second">'
        + '<span>W</span><input type="number" id="tlp3W" min="16" max="4096" step="2" value="' + num(m.w, 640) + '" title="The 3D picture\'s width (px)">'
        + '<span>H</span><input type="number" id="tlp3H" min="16" max="4096" step="2" value="' + num(m.h, 640) + '" title="The 3D picture\'s height (px)">'
        + "</div>"
        + '<div class="tlp-row"><label>Length <input type="number" id="tlp3Len" min="0.1" step="0.1" value="' + lenOf(c).toFixed(2) + '" style="width:62px">s</label>'
        + '<button class="ghost" id="tlp3Bake" title="Bake it now (the compile uses the baked video; it also bakes by itself a moment after a change)">🧊 Bake</button>'
        + '<span class="m3d-st" id="tlp3State"></span></div>';
      P.insertAdjacentHTML("beforeend", h);
      $("tlp3State")._for = c; paintState(c);
      var touched = function (rebuild) {
        C.mark(); save(); schedule(c);
        if (rebuild && typeof renderTimeline === "function") renderTimeline();
        if (typeof C.paintLayers === "function") C.paintLayers();
      };
      var on = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, function () { fn(el); touched(); }); };
      // 2.607.0: a text effect preset on 3D text (static/m3d.js draws its picture on the front face)
      if ($("tlp3FxRow") && window.H3TextFx) $("tlp3FxRow").appendChild(H3TextFx.picker({ current: m.fx || "", say: function (t) { try { C.say(t); } catch (e) { /* fine */ } },
        onPick: function (id) { if (id) m.fx = id; else delete m.fx; touched(); } }));
      on("tlp3Text", "input", function (el) { m.text = el.value; });
      on("tlp3Font", "change", function (el) { m.font = el.value; });
      on("tlp3Bold", "change", function (el) { m.bold = el.checked; });
      on("tlp3Ital", "change", function (el) { m.italic = el.checked; });
      on("tlp3Depth", "input", function (el) { m.depth = Math.max(0, Math.min(5, num(el.value, 0.25))); });
      on("tlp3Bevel", "input", function (el) { m.bevel = Math.max(0, Math.min(0.5, num(el.value, 0))); });
      on("tlp3Model", "change", function (el) { m.model = el.value; });
      on("tlp3Keep", "change", function (el) { m.keepMat = el.checked; });
      on("tlp3Anim", "change", function (el) { m.anim = el.checked; });
      [["tlp3RX", "rx"], ["tlp3RY", "ry"], ["tlp3RZ", "rz"]].forEach(function (p) {
        on(p[0], "input", function (el) { rotKey(c, p[1], num(el.value, 0)); });
      });
      [["tlp3SX", "spinX"], ["tlp3SY", "spinY"], ["tlp3SZ", "spinZ"]].forEach(function (p) {
        on(p[0], "input", function (el) { m[p[1]] = num(el.value, 0); });
      });
      on("tlp3W", "change", function (el) { m.w = Math.max(16, Math.min(4096, Math.round(num(el.value, 640)))); });
      on("tlp3H", "change", function (el) { m.h = Math.max(16, Math.min(4096, Math.round(num(el.value, 640)))); });
      var ln = $("tlp3Len");
      if (ln) ln.addEventListener("change", function () {
        var L = Math.max(0.1, num(ln.value, 5));
        c.in = 0; c.out = L; c.dur = L;
        touched(true);
      });
      $("tlp3Bake").addEventListener("click", function () { bake(c).catch(function () { /* shown in the state line */ }); });
    });

    // a project's existing 3D layers that are not baked as they are (an older bake, a moved file) catch up quietly
    listModels().then(function () { all3d().filter(due).forEach(function (c) { schedule(c, 4000); }); });
    /* 2.385.0 for the 🎨 / 💡 sections and the 3D widgets: an edit saved + baked a moment later; a keyed property */
    function touch(c, rebuild) {
      C.mark(); save(); schedule(c);
      if (rebuild && typeof renderTimeline === "function") renderTimeline();
    }
    function keyed(c, prop, v) { return rotKey(c, prop, v); }
    window.TlM3D = { add: add, takeDrop: takeDrop, bake: bake, bakeAll: bakeAll, upload: upload, listModels: listModels,
                     openMenu: openMenu, due: due, all: all3d, touch: touch, keyed: keyed, schedule: schedule };
  }
})();
