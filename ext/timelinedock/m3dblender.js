/* bitGen Studio — the BLENDER BRIDGE in the page (2.385.0), window.TlBlender.
 *
 * Tim (verbatim): "is it possible for us to create a blender to bitgen bridge?" - asked how much: "Add-on + Blender
 * render bake".
 *
 *   🟧 Blender (a 3D layer's Properties)   Render with: three.js (in the app, fast) | Blender (Eevee / Cycles, a local
 *                                          Blender renders it for the compile - lib/blender.js, scripts/blender_render.py);
 *                                          whether Blender was found; ⚙ Blender… = its path, engine, samples, GPU
 *   the inbox                              what the Blender add-on (blender/bitgen_bridge) sent: a new model with "Add as
 *                                          3D layer" becomes a layer at the position marker; a model already on the
 *                                          timeline is reloaded and its layers re-baked (the live link: Save in Blender)
 *   TlBlender.bake(c, {fps, onProgress})   what ext/timelinedock/m3d.js runs instead of the browser bake for such a layer:
 *                                          every frame's rotation / depth / scale (keyframes and spin worked out here, by
 *                                          static/m3d.js) -> POST /api/blender/render, then its progress until it is done
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && window.TlM3D && window.H3M3D && TlCanvas.onProps); } catch (e) { return false; } }
  function boot() { if (!$("tlCanvas")) return; if (!ready()) { setTimeout(boot, 60); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function j(r) { return r.json().then(function (x) { if (!r.ok) throw new Error(x.error || r.status); return x; }); }

  function start() {
    var C = window.TlCanvas, M = window.H3M3D, X = window.TlM3D;
    var info = null;
    function status() {
      return fetch("/api/blender/status").then(j).then(function (s) { info = s; return s; }).catch(function () { return info; });
    }
    /* ---- the bake */
    function frames(c, fps) {
      var len = Math.max(0, num(c.out, 0) - num(c.in, 0)) || num(c.dur, 0) || 5;
      var n = Math.max(1, Math.round(len * fps)), out = [];
      for (var i = 0; i < n; i++) {
        var t = i / fps, r = M.rotAt(c, t), p = M.placeAt(c, t);
        out.push({ t: Math.round(t * 10000) / 10000, rx: r.x, ry: r.y, rz: r.z, pz: p.pz, sx: p.sx, sy: p.sy, sz: p.sz });
      }
      return out;
    }
    function bake(c, o) {
      o = o || {};
      var fps = o.fps || 24, list = frames(c, fps), parts = {};
      M.parts(c).forEach(function (p) { parts[String(p.n)] = p.name; });
      var m = c.m3d;
      return fetch("/api/blender/render", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.mid, spec: m, w: num(m.w, 640), h: num(m.h, 640), fps: fps, frames: list, parts: parts }) })
        .then(j).then(function () {
          return new Promise(function (ok, no) {
            (function poll() {
              fetch("/api/blender/render/" + encodeURIComponent(c.mid)).then(j).then(function (s) {
                if (o.onProgress) o.onProgress(s.done || 0, s.of || list.length);
                if (s.state === "done") return ok(s.result);
                if (s.state === "error") return no(new Error("Blender: " + (s.error || "the render failed")));
                if (s.state === "none") return no(new Error("Blender: the render was lost"));
                setTimeout(poll, 800);
              }).catch(function (e) { poll.n = (poll.n || 0) + 1; if (poll.n > 20) no(e); else setTimeout(poll, 1500); });
            })();
          });
        });
    }

    /* ---- ⚙ Blender… */
    var dlg = null;
    function openSettings() {
      if (!dlg) {
        if (!$("blCss")) {
          var st = document.createElement("style"); st.id = "blCss";
          st.textContent = "#blSetDlg{width:min(520px,94vw);padding:0;overflow:hidden}"
            + "#blSetDlg .jm-title{display:flex;align-items:center;gap:8px;height:36px;padding:0 0 0 14px;border-bottom:1px solid var(--line);background:var(--panel-2)}"
            + "#blSetDlg .jm-title h2{margin:0;flex:1;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase}"
            + "#blSetDlg .jm-x{width:46px;height:36px;border:0;background:none;color:var(--text);font-size:15px;cursor:pointer}"
            + "#blSetDlg .jm-x:hover{background:#c42b1c}#blSetDlg .jm-body{padding:12px 16px 16px}";
          document.head.appendChild(st);
        }
        dlg = document.createElement("dialog");
        dlg.id = "blSetDlg"; dlg.className = "jmdlg"; dlg.setAttribute("aria-label", "Blender settings");
        dlg.innerHTML = '<div class="jm-title"><h2>🟧 Blender bridge</h2><button type="button" class="jm-x" id="blSetX" aria-label="Close">✕</button></div>'
          + '<div class="jm-body" style="font-size:.76rem;display:flex;flex-direction:column;gap:8px">'
          + '<label>Blender program <input type="text" id="blPath" placeholder="empty = find it (Program Files, /Applications, PATH)" style="width:100%"></label>'
          + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><label>Engine <select id="blEngine"><option value="eevee">Eevee (fast)</option>'
          + '<option value="cycles">Cycles (ray traced)</option><option value="workbench">Workbench (preview)</option></select></label>'
          + '<label title="0 = Blender\'s own default">Samples <input type="number" id="blSamples" min="0" max="4096" step="1" style="width:70px"></label>'
          + '<label title="Cycles: render on the graphics card"><input type="checkbox" id="blGpu"> GPU</label></div>'
          + '<div id="blFound" style="color:var(--dim)"></div>'
          + '<div style="display:flex;gap:8px"><button class="ghost" id="blSave" type="button">💾 Save</button>'
          + '<button class="ghost" id="blTest" type="button">🔍 Find / test</button></div>'
          + '<div style="color:var(--dim);line-height:1.45">The <b>bitGen add-on for Blender</b> (bitgen-blender-addon zip: Blender → Edit → Preferences → '
          + 'Add-ons → Install from Disk) adds a <b>bitGen</b> tab to the 3D view sidebar (N): <b>Send to bitGen</b> puts the selection here as a 3D '
          + 'layer; <b>Live link</b> sends it again every time you save, and the layer updates. Address: <code>http://127.0.0.1:' + esc(location.port || "8311") + '</code></div>'
          + "</div>";
        document.body.appendChild(dlg);
        $("blSetX").addEventListener("click", function () { dlg.close(); });
        var save = function (test) {
          var body = { path: $("blPath").value.trim(), engine: $("blEngine").value, samples: num($("blSamples").value, 0), gpu: $("blGpu").checked };
          $("blFound").textContent = "…";
          return fetch("/api/blender/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
            .then(j).then(function (s) { info = s; paint(); C.paintProps(); }).catch(function (e) { $("blFound").textContent = "⚠ " + (e.message || e); });
        };
        $("blSave").addEventListener("click", function () { save(); });
        $("blTest").addEventListener("click", function () { save(true); });
      }
      var paint = function () {
        var s = info || {};
        $("blPath").value = s.path || ""; $("blEngine").value = s.engine || "eevee"; $("blSamples").value = s.samples || 0; $("blGpu").checked = !!s.gpu;
        $("blFound").textContent = s.found ? "✓ Blender " + (s.version || "?") + " - " + s.found : "✗ Blender was not found" + (s.path ? " at " + s.path : "") + ".";
      };
      paint();
      if (!dlg.open) dlg.showModal();
      status().then(paint);
    }

    /* ---- the Properties section */
    C.onProps(function (P, c) {
      if (!c || !c.m3d) return;
      var m = c.m3d, s = info;
      var h = '<div class="tlp-t" style="margin-top:8px">🟧 Blender</div>'
        + '<div class="tlp-row"><label style="flex:1">Render with <select id="blRenderer" title="three.js draws it in the app; Blender renders it (Eevee / Cycles) for the compile - the canvas still shows the three.js preview">'
        + '<option value="three"' + (m.renderer === "blender" ? "" : " selected") + '>three.js (in the app)</option>'
        + '<option value="blender"' + (m.renderer === "blender" ? " selected" : "") + ">Blender</option></select></label>"
        + '<button class="ghost" id="blSet" title="Blender\'s path, engine, samples - and the add-on">⚙</button></div>'
        + '<div class="tlp-none" id="blState">' + (s ? (s.found ? "Blender " + esc(s.version || "") + " · " + esc(s.engine) : "Blender not found - ⚙ to set its path") : "…") + "</div>";
      P.insertAdjacentHTML("beforeend", h);
      $("blRenderer").addEventListener("change", function () {
        if ($("blRenderer").value === "blender") m.renderer = "blender"; else delete m.renderer;
        X.touch(c);
      });
      $("blSet").addEventListener("click", openSettings);
      if (!s) status().then(function (x) { var el = $("blState"); if (el && x) el.textContent = x.found ? "Blender " + (x.version || "") + " · " + x.engine : "Blender not found - ⚙ to set its path"; });
    });

    /* ---- the add-on's sends */
    var last = null, polling = false;
    function layersUsing(name) { return X.all().filter(function (c) { return c.m3d && c.m3d.type === "model" && c.m3d.model === name; }); }
    function take(it) {
      var using = layersUsing(it.name);
      if (using.length) {
        M.reload(it.name);
        using.forEach(function (c) { c.m3dBaked = null; X.schedule(c); });
        C.say("🟧 " + it.name + " updated from Blender");
        if (typeof logLine === "function") logLine("[blender] " + it.name + " updated - " + using.length + " layer(s) re-baking");
      } else if (it.layer) {
        X.listModels();
        X.add("model", it.name);
        if (typeof logLine === "function") logLine("[blender] " + it.name + " -> a new 3D layer");
      } else {
        X.listModels();
        if (typeof logLine === "function") logLine("[blender] " + it.name + " saved to this project's 3D models");
      }
    }
    function poll() {
      if (polling || document.hidden) return;
      polling = true;
      fetch("/api/blender/inbox?since=" + (last == null ? 0 : last)).then(j).then(function (r) {
        if (last == null) last = r.seq;                 // the first look only notes where the inbox is
        else { (r.items || []).forEach(take); last = r.seq; }
      }).catch(function () { /* the server is busy - next time */ }).then(function () { polling = false; });
    }
    poll();
    setInterval(poll, 2500);
    window.TlBlender = { bake: bake, frames: frames, status: status, openSettings: openSettings, poll: poll, take: take };
  }
})();
