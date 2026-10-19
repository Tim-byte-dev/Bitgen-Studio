/* bitGen Studio — the 3D WIDGETS on the preview canvas (2.385.0), window.TlGizmo.
 *
 * Tim (verbatim): "add 3d interactive rotate and transform and move widgets to 3d objects placed in the preview canvas"
 * - and, asked what the move widget's depth arrow does: "Move toward/away camera".
 *
 * With the Move tool and a 3D layer selected (at the playhead), one widget is drawn over the object:
 *   ✥ MOVE   (G)   red ⟶ X and green ↑ Y move the layer across the picture, the square moves it freely (Shift = one
 *                  axis); the blue ↙ Z arrow moves the object toward / away from the camera (depth, pz)
 *   ⟲ ROTATE (R)   drag inside the ball = tumble it (left / right turns it round Y, up / down tilts it round X); the red
 *                  ring = X only, the green ring = Y only, the blue outer ring = roll round Z (Shift = 15° steps)
 *   ⤡ SCALE  (S)   the red / green / blue handles at the ends of the object's OWN axes stretch it along that axis; the
 *                  centre disc scales it evenly
 * The same key again (or ○ in the Properties) hides the widget. Values are the clip's m3d rx / ry / rz / pz / sx / sy /
 * sz (keyed when a ◆ already holds them - static/m3d.js tweens them) and its X / Y; the bake follows a moment later.
 * The picture -> canvas mapping: static/m3d.js's view(c) (the object in its own picture) through the layer's box (X, Y,
 * scale, rotation) and the canvas zoom.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && window.TlM3D && window.H3M3D && TlCanvas.onGrab); } catch (e) { return false; } }
  function boot() { if (!$("tlCanvas")) return; if (!ready()) { setTimeout(boot, 60); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
  var COL = { x: "#ff5a52", y: "#62d26f", z: "#4f9dff", c: "#f5d36b" };
  var MODES = { move: ["✥", "Move", "g"], rotate: ["⟲", "Rotate", "r"], scale: ["⤡", "Scale", "s"] };

  function start() {
    var C = window.TlCanvas, M = window.H3M3D, X = window.TlM3D, S = C.state, K = window.H3Keyframes;
    var mode = "move";
    try { mode = typeof store === "object" ? store.get("tlg.mode", "move") : "move"; } catch (e) { mode = "move"; }
    if (mode !== "off" && !MODES[mode]) mode = "move";
    var cv = $("tlCanvas");
    if (!$("tlg3Css")) {
      var st = document.createElement("style"); st.id = "tlg3Css";
      st.textContent = "#tlProps .tlg3-modes{flex-wrap:wrap}#tlProps .tlg3-modes button{padding:1px 7px;font-size:.72rem}"
        + "#tlProps .tlg3-modes button.on{background:var(--tiger);color:#14120f;border-color:var(--tiger)}";
      document.head.appendChild(st);
    }

    var modeFns = [], snapAll = false;          // 2.386.0: the 3D toolbar follows the mode; its 🧲 snaps every turn to 15°
    function setMode(m) {
      mode = m;
      modeFns.forEach(function (fn) { try { fn(m); } catch (e) { /* fine */ } });
      try { if (typeof store === "object") store.set("tlg.mode", m); } catch (e) { /* fine */ }
      Object.keys(MODES).concat(["off"]).forEach(function (k) { var b = $("tlg3_" + k); if (b) b.classList.toggle("on", k === m); });
      C.mark();
    }
    function sel3d() {
      var s = C.selClip && C.selClip();
      if (!s || !s.c || !s.c.m3d || s.Ly.kind !== "vl") return null;
      if (C.at && !C.at(s.c, s.Ly.kind, S.t)) return null;
      return s;
    }
    function tau(c) { return Math.max(0, S.t - (c.start || 0)); }
    function val(c, p, d) { var m = c.m3d; return K && K.has(c.kf, p) ? num(K.value(c.kf, tau(c), p, num(m[p], d)), d) : num(m[p], d); }
    function put(c, p, v) { X.keyed(c, p, v); }

    /* the object's place on the SCREEN: centre, radius, its axes, the widget's size */
    function geo(c) {
      var v = M.view(c), b = C.box(c, "vl");
      if (!v || !b || !v.w || !v.h) return null;
      var a = b.rot * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), kx = b.w / v.w, ky = b.h / v.h, z = S.view.z;
      var vec = function (dx, dy) { var x = dx * kx, y = dy * ky; return [(x * cs - y * sn) * z, (x * sn + y * cs) * z]; };
      var pt = function (u, w) {
        var d = vec(u - v.w / 2, w - v.h / 2);
        var q = C.toScreen(b.cx, b.cy);
        return [q.x + d[0], q.y + d[1]];
      };
      var ctr = pt(v.cx, v.cy), rs = Math.max(4, v.r * Math.abs(kx) * z);
      var R = Math.max(46, Math.min(170, rs * 1.25));
      var ax = {};
      ["x", "y", "z"].forEach(function (k) { var d = vec(v.ax[k][0], v.ax[k][1]); ax[k] = d; });
      return { c: ctr, rs: rs, R: R, ax: ax };
    }
    function mouse(ev) { var r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    function segDist(p, a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      var t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    }
    /* the scale handles: along the object's own axes (a nearly head-on axis gets a fixed, readable direction) */
    function scaleHandles(g) {
      var out = {}, fb = { x: [1, 0], y: [0, -1], z: [-0.7071, 0.7071] };
      ["x", "y", "z"].forEach(function (k) {
        var d = g.ax[k], L = Math.hypot(d[0], d[1]);
        var u = L > 18 ? [d[0] / L, d[1] / L] : fb[k];
        var len = Math.max(g.R * 0.55, Math.min(g.R, L > 18 ? L : g.R * 0.8));
        out[k] = { u: u, len: len, p: [g.c[0] + u[0] * len, g.c[1] + u[1] * len] };
      });
      return out;
    }
    /* which handle is under the pointer */
    function pick(g, p) {
      var dx = p[0] - g.c[0], dy = p[1] - g.c[1], d = Math.hypot(dx, dy), R = g.R;
      if (mode === "move") {
        if (Math.abs(dx) <= 9 && Math.abs(dy) <= 9) return "free";
        if (segDist(p, g.c, [g.c[0] + R, g.c[1]]) <= 7) return "x";
        if (segDist(p, g.c, [g.c[0], g.c[1] - R]) <= 7) return "y";
        if (segDist(p, g.c, [g.c[0] - 0.7071 * R, g.c[1] + 0.7071 * R]) <= 7) return "z";
        return null;
      }
      if (mode === "rotate") {
        if (Math.abs(d - R) <= 7) return "roll";
        var e = function (a, b) { return Math.abs(Math.sqrt((dx / a) * (dx / a) + (dy / b) * (dy / b)) - 1) * Math.min(a, b); };
        if (e(R * 0.82, R * 0.26) <= 6) return "ry";
        if (e(R * 0.26, R * 0.82) <= 6) return "rx";
        if (d < R * 0.82) return "ball";
        return null;
      }
      if (mode === "scale") {
        var H = scaleHandles(g);
        for (var k in H) if (Math.abs(p[0] - H[k].p[0]) <= 8 && Math.abs(p[1] - H[k].p[1]) <= 8) return "s" + k;
        if (d <= R * 0.3) return "suni";
        return null;
      }
      return null;
    }

    /* ---- the pointer: a handle grabbed */
    C.onGrab({
      hover: function (ev) {
        if (mode === "off") return null;
        var s = sel3d(); if (!s) return null;
        var g = geo(s.c); if (!g) return null;
        var h = pick(g, mouse(ev));
        if (!h) return null;
        return h === "free" ? "move" : h === "x" ? "ew-resize" : h === "y" ? "ns-resize" : h === "z" ? "nesw-resize"
          : h === "roll" ? "alias" : h === "ball" || h === "rx" || h === "ry" ? "grab" : "nwse-resize";
      },
      down: function (ev) {
        if (mode === "off" || ev.button !== 0) return null;
        var s = sel3d(); if (!s) return null;
        var g = geo(s.c); if (!g) return null;
        var p0 = mouse(ev), h = pick(g, p0);
        if (!h) return null;
        var c = s.c, m = c.m3d, tf0 = C.tfAt(c);
        var v0 = { rx: val(c, "rx", 0), ry: val(c, "ry", 0), rz: val(c, "rz", 0), pz: val(c, "pz", 0),
                   sx: val(c, "sx", 1), sy: val(c, "sy", 1), sz: val(c, "sz", 1) };
        var a0 = Math.atan2(p0[1] - g.c[1], p0[0] - g.c[0]), d0 = Math.max(4, Math.hypot(p0[0] - g.c[0], p0[1] - g.c[1]));
        var kdeg = 180 / (Math.PI * g.R), H = mode === "scale" ? scaleHandles(g) : null;
        var snap = function (a, on) { return on || snapAll ? Math.round(a / 15) * 15 : Math.round(a * 10) / 10; };   // 2.386.0: 🧲 in the 3D bar
        S.gizmoDrag = h;
        return {
          move: function (e2) {
            var p = mouse(e2), dx = p[0] - p0[0], dy = p[1] - p0[1], z = S.view.z || 1;
            if (h === "free" || h === "x" || h === "y") {
              var nx = tf0.x + dx / z, ny = tf0.y + dy / z;
              if (h === "x" || (h === "free" && e2.shiftKey && Math.abs(dx) > Math.abs(dy))) ny = tf0.y;
              if (h === "y" || (h === "free" && e2.shiftKey && Math.abs(dy) >= Math.abs(dx))) nx = tf0.x;
              C.writeTf(c, { x: Math.round(nx), y: Math.round(ny) });
            } else if (h === "z") {
              var along = (dx * -0.7071 + dy * 0.7071);               // out along the arrow = toward the camera
              put(c, "pz", Math.round((v0.pz + along / Math.max(8, g.rs)) * 1000) / 1000);
            } else if (h === "roll") {
              var a = Math.atan2(p[1] - g.c[1], p[0] - g.c[0]);
              put(c, "rz", snap(v0.rz - (a - a0) * 180 / Math.PI, e2.shiftKey));
            } else if (h === "ball" || h === "rx" || h === "ry") {
              if (h !== "rx") put(c, "ry", snap(v0.ry + dx * kdeg, e2.shiftKey));
              if (h !== "ry") put(c, "rx", snap(v0.rx + dy * kdeg, e2.shiftKey));
            } else if (h === "suni") {
              var k = Math.max(0.02, Math.hypot(p[0] - g.c[0], p[1] - g.c[1]) / d0);
              ["sx", "sy", "sz"].forEach(function (q) { put(c, q, Math.round(Math.max(0.01, Math.min(50, v0[q] * k)) * 1000) / 1000); });
            } else if (h.charAt(0) === "s") {
              var ax = h.charAt(1), hh = H[ax], d = dx * hh.u[0] + dy * hh.u[1];
              put(c, "s" + ax, Math.round(Math.max(0.01, Math.min(50, v0["s" + ax] * (hh.len + d) / hh.len)) * 1000) / 1000);
            }
            C.mark();
          },
          up: function () { S.gizmoDrag = null; X.touch(c, !!c.kf); paintInputs(c, true); }
        };
      }
    });

    /* ---- drawing */
    function arrow(g, ctx, to, col, label) {
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(g.c[0], g.c[1]); ctx.lineTo(to[0], to[1]); ctx.stroke();
      var a = Math.atan2(to[1] - g.c[1], to[0] - g.c[0]);
      ctx.beginPath(); ctx.moveTo(to[0] + 9 * Math.cos(a), to[1] + 9 * Math.sin(a));
      ctx.lineTo(to[0] + 7 * Math.cos(a + 2.4), to[1] + 7 * Math.sin(a + 2.4));
      ctx.lineTo(to[0] + 7 * Math.cos(a - 2.4), to[1] + 7 * Math.sin(a - 2.4)); ctx.closePath(); ctx.fill();
      if (label) { ctx.font = "600 11px sans-serif"; ctx.fillText(label, to[0] + 12 * Math.cos(a) - 4, to[1] + 12 * Math.sin(a) + 4); }
    }
    function ellipse(ctx, g, a, b, col, w) {
      ctx.strokeStyle = col; ctx.lineWidth = w || 2;
      ctx.beginPath(); ctx.ellipse(g.c[0], g.c[1], a, b, 0, 0, Math.PI * 2); ctx.stroke();
    }
    C.onDraw(function (ctx) {
      if (mode === "off" || S.tool !== "move") return;
      var s = sel3d(); if (!s) return;
      var g = geo(s.c); if (!g) return;
      var R = g.R, hot = S.gizmoDrag;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 3;
      if (mode === "move") {
        arrow(g, ctx, [g.c[0] + R, g.c[1]], hot === "x" ? "#fff" : COL.x, "X");
        arrow(g, ctx, [g.c[0], g.c[1] - R], hot === "y" ? "#fff" : COL.y, "Y");
        arrow(g, ctx, [g.c[0] - 0.7071 * R, g.c[1] + 0.7071 * R], hot === "z" ? "#fff" : COL.z, "Z");
        ctx.fillStyle = hot === "free" ? "#fff" : COL.c; ctx.globalAlpha = 0.85;
        ctx.fillRect(g.c[0] - 7, g.c[1] - 7, 14, 14);
      } else if (mode === "rotate") {
        ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.beginPath(); ctx.arc(g.c[0], g.c[1], R * 0.82, 0, Math.PI * 2); ctx.fill();
        ellipse(ctx, g, R, R, hot === "roll" ? "#fff" : COL.z, 3);
        ellipse(ctx, g, R * 0.82, R * 0.26, hot === "ry" ? "#fff" : COL.y, 2);
        ellipse(ctx, g, R * 0.26, R * 0.82, hot === "rx" ? "#fff" : COL.x, 2);
        // the object's own axes, to see which way it faces
        ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9;
        ["x", "y", "z"].forEach(function (k) {
          ctx.strokeStyle = COL[k]; ctx.beginPath(); ctx.moveTo(g.c[0], g.c[1]);
          ctx.lineTo(g.c[0] + g.ax[k][0], g.c[1] + g.ax[k][1]); ctx.stroke();
        });
      } else if (mode === "scale") {
        var H = scaleHandles(g);
        ["x", "y", "z"].forEach(function (k) {
          var h = H[k], col = hot === "s" + k ? "#fff" : COL[k];
          ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(g.c[0], g.c[1]); ctx.lineTo(h.p[0], h.p[1]); ctx.stroke();
          ctx.fillRect(h.p[0] - 6, h.p[1] - 6, 12, 12);
          ctx.font = "600 11px sans-serif"; ctx.fillText(k.toUpperCase(), h.p[0] + 9, h.p[1] - 7);
        });
        ctx.strokeStyle = hot === "suni" ? "#fff" : COL.c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(g.c[0], g.c[1], R * 0.3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.font = "10px sans-serif"; ctx.fillStyle = "rgba(0,0,0,.6)";
      var tag = MODES[mode][0] + " " + MODES[mode][1] + " · G move  R rotate  S scale";
      var tw = ctx.measureText(tag).width;
      ctx.fillRect(g.c[0] - tw / 2 - 5, g.c[1] + R + 8, tw + 10, 15);
      ctx.fillStyle = "#e8e2d6"; ctx.fillText(tag, g.c[0] - tw / 2, g.c[1] + R + 19);
      ctx.restore();
      if (S.gizmoDrag) paintInputs(s.c);
    });

    /* ---- keys: G / R / S over the canvas (the same key again hides the widget) */
    function typing() {
      var a = document.activeElement;
      return a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    }
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || typing() || document.querySelector("dialog[open]")) return;
      if (!(C.keysAt && C.keysAt()) && document.activeElement !== $("tlCanvasWrap")) return;
      var k = e.key.toLowerCase(), m = null;
      Object.keys(MODES).forEach(function (id) { if (MODES[id][2] === k) m = id; });
      if (!m || !sel3d()) return;
      e.preventDefault();
      setMode(mode === m ? "off" : m);
    });

    /* ---- the Properties: the widget buttons, depth, the object's own scale */
    function paintInputs(c, force) {
      var set = function (id, v) { var el = $(id); if (el && (force || document.activeElement !== el)) el.value = v; };
      set("tlp3PZ", Math.round(val(c, "pz", 0) * 100) / 100);
      set("tlp3SXo", Math.round(val(c, "sx", 1) * 1000) / 10);
      set("tlp3SYo", Math.round(val(c, "sy", 1) * 1000) / 10);
      set("tlp3SZo", Math.round(val(c, "sz", 1) * 1000) / 10);
      set("tlp3RX", Math.round(val(c, "rx", 0) * 10) / 10);
      set("tlp3RY", Math.round(val(c, "ry", 0) * 10) / 10);
      set("tlp3RZ", Math.round(val(c, "rz", 0) * 10) / 10);
    }
    C.onProps(function (P, c) {
      if (!c || !c.m3d) return;
      var h = '<div class="tlp-t" style="margin-top:8px">✥ 3D widgets</div><div class="tlp-row tlg3-modes">'
        + Object.keys(MODES).map(function (k) {
          return '<button class="ghost' + (mode === k ? " on" : "") + '" id="tlg3_' + k + '" title="' + MODES[k][1] + " widget on the canvas (" + MODES[k][2].toUpperCase() + ')">'
            + MODES[k][0] + " " + MODES[k][1] + "</button>";
        }).join("")
        + '<button class="ghost' + (mode === "off" ? " on" : "") + '" id="tlg3_off" title="No widget">○</button></div>'
        + '<div class="tlp-g" style="margin-top:4px">'
        + '<span>Depth</span><input type="number" id="tlp3PZ" step="0.05" value="' + Math.round(val(c, "pz", 0) * 100) / 100 + '" title="Toward (+) / away from (-) the camera, in the object\'s size (◆ keyed once a keyframe holds it)">'
        + '<span>Scale X%</span><input type="number" id="tlp3SXo" step="1" min="1" value="' + Math.round(val(c, "sx", 1) * 1000) / 10 + '" title="The object\'s own width">'
        + '<span>Scale Y%</span><input type="number" id="tlp3SYo" step="1" min="1" value="' + Math.round(val(c, "sy", 1) * 1000) / 10 + '" title="The object\'s own height">'
        + '<span>Scale Z%</span><input type="number" id="tlp3SZo" step="1" min="1" value="' + Math.round(val(c, "sz", 1) * 1000) / 10 + '" title="The object\'s own depth">'
        + "</div>";
      P.insertAdjacentHTML("beforeend", h);
      Object.keys(MODES).concat(["off"]).forEach(function (k) {
        var b = $("tlg3_" + k); if (b) b.addEventListener("click", function () { setMode(k); });
      });
      var inp = function (id, p, conv) {
        var el = $(id); if (!el) return;
        el.addEventListener("input", function () { var v = Number(el.value); if (!Number.isFinite(v)) return; put(c, p, conv(v)); C.mark(); });
        el.addEventListener("change", function () { X.touch(c, !!c.kf); });
      };
      inp("tlp3PZ", "pz", function (v) { return Math.max(-50, Math.min(50, v)); });
      inp("tlp3SXo", "sx", function (v) { return Math.max(0.01, Math.min(50, v / 100)); });
      inp("tlp3SYo", "sy", function (v) { return Math.max(0.01, Math.min(50, v / 100)); });
      inp("tlp3SZo", "sz", function (v) { return Math.max(0.01, Math.min(50, v / 100)); });
    });
    window.TlGizmo = { mode: function () { return mode; }, setMode: setMode, onMode: function (fn) { modeFns.push(fn); },
                       snap: function (on) { if (on !== undefined) snapAll = !!on; return snapAll; }, geo: function (c) { return geo(c); },
                       pick: function (c, x, y) { var g = geo(c); return g ? pick(g, [x, y]) : null; } };
  }
})();
