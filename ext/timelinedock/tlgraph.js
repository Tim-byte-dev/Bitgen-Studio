/* bitGen Studio — ext/timelinedock/tlgraph.js (2.489.0): the GRAPH EDITOR, EASY EASE, the ANCHOR POINT and Bézier
 * MOTION PATHS on the timeline's canvas layers. window.TlGraph.
 *
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested. we a getting close to building a fully featured professional
 * app" - AFTER-EFFECTS-GAP.md item 1: "Graph editor: value + speed graphs, Bézier keyframe handles, Easy Ease with
 * influence" + "keyframes on any property (anchor point) + spatial Bézier motion paths drawn on the canvas".
 *
 *   📈 Graph Editor     a panel over the timeline: one property of the selected clip (position X / Y, scale, rotation,
 *                       opacity, anchor X / Y) as its VALUE graph or its SPEED graph; ■ keys - drag them (time, value);
 *                       the Bézier handles of the selected key's tweens - drag them (static/keyframes.js ease "bezier",
 *                       bz [x1, y1, x2, y2]); double-click = a key there; Delete = take it out; F9 = Easy Ease
 *   Easy Ease (F9)      the key at the playhead eases in and out (influence 33.3 %); Ease In / Ease Out one side only
 *   Anchor X / Y        what position places and scale / rotation pivot on (pixels from the clip's centre); changing it
 *                       keeps the layer where it is (its position moves to match) unless position is keyframed
 *   Motion path         the selected clip's position path on the canvas, its keys as ■; drag a ■ to move that key;
 *                       Alt-drag a ■ pulls out its Bézier handles (a curve through it); drag a handle ● to bend the
 *                       path (Alt = only that side); "↝ Smooth path" gives every position key smooth handles
 * The compile draws the same curves (worker.py _kf_bezier / _kf_expr / _kf_perspective / _tf_chain).
 */
(function () {
  "use strict";
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.onDraw && TlCanvas.onGrab && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();

  function install() {
    if (window.TlGraph) return;
    var KF = window.H3Keyframes, C = window.TlCanvas, FPS = KF.FPS || 24, EASY = (KF.EASY || [0.333, 0, 0.667, 1]).slice();
    var PROPS = { x: ["Position X", 1, "px"], y: ["Position Y", 1, "px"], scale: ["Scale", 100, "%"], rot: ["Rotation", 1, "°"], op: ["Opacity", 100, "%"], ax: ["Anchor X", 1, "px"], ay: ["Anchor Y", 1, "px"] };
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    function changed(c) { try { C.keysChanged(c); } catch (e) { /* fine */ } if (typeof renderTimeline === "function") renderTimeline(); paint(); }
    function sorted(c) { return (c.kf || []).slice().sort(function (a, b) { return a.at - b.at; }); }
    function fallback(c, p) { var tf = c.tf || {}; if (p.charAt(0) === "@" && window.H3AnyKeys) { var av = H3AnyKeys.get(c, p.slice(1)); return av != null && Number.isFinite(+av) ? +av : 0; } /* 2.516.0: any keyed setting */ var ta = /^ta(\d+)_(\w+)$/.exec(p); if (ta) { var an = ((c.text || {}).anim || [])[+ta[1]] || {}; return an[ta[2]] != null ? +an[ta[2]] : window.TlTextAnim ? +TlTextAnim.DEFAULTS[ta[2]] || 0 : 0; } if (/^tp_/.test(p)) { var tk = p.slice(3), tpo = (c.text || {}).onpath || {}; return tpo[tk] != null ? +tpo[tk] : tk === "r" ? 220 : 0; } if (/^sh_/.test(p)) { var sk = p.slice(3), sv = (c.shape || {})[sk]; return sv != null ? +sv : window.TlShape ? +TlShape.DEFAULTS[sk] || 0 : 0; } return p === "op" ? (c.opacity == null ? 1 : +c.opacity) : p === "scale" ? (tf.scale == null ? 1 : +tf.scale) : +(tf[p] || 0); }
    function lenOf(c, kind) { try { return kind === "img" ? (typeof imgLen === "function" ? imgLen(c) : +c.len || 3) : (typeof effDur === "function" ? effDur(c) : 5); } catch (e) { return 5; } }
    function asBezier(k) { if (k.ease !== "bezier" || !KF.okBz(k.bz)) { k.bz = KF.bzOf(k) || EASY.slice(); k.ease = "bezier"; } return k.bz; }

    /* ---------------- Easy Ease ---------------- */
    /** the key at `at` (seconds into the clip) eases out of itself (mode out / both) and into itself (in / both) */
    function easeKey(c, at, mode) {
      var ks = sorted(c), i = -1;
      for (var j = 0; j < ks.length; j++) if (Math.abs(ks[j].at - at) < 0.5 / FPS) { i = j; break; }
      if (i < 0) return false;
      var m = mode || "both";
      if ((m === "both" || m === "out") && i < ks.length - 1) { var b = asBezier(ks[i]); b[0] = EASY[0]; b[1] = EASY[1]; }
      if ((m === "both" || m === "in") && i > 0) { var b2 = asBezier(ks[i - 1]); b2[2] = EASY[2]; b2[3] = EASY[3]; }
      return true;
    }
    function easeHere(mode) {
      var sel = C.selClip(); if (!sel || !sel.c.kf) return say("select a clip with keyframes");
      var tau = C.tauOf(sel.c, sel.Ly.kind);
      if (!easeKey(sel.c, tau, mode)) return say("put the playhead on a keyframe (◀ ▶)");
      changed(sel.c); say("Easy Ease" + (mode === "in" ? " In" : mode === "out" ? " Out" : "") + " on the keyframe at +" + tau.toFixed(2) + "s");
    }
    /** every position key gets smooth (Catmull-Rom) handles - a curved path through them */
    function smoothPath(c) {
      var ks = KF.keysFor(c.kf, "x"); if (ks.length < 2) return false;
      var live = sorted(c).filter(function (k) { return k.x != null; });
      live.forEach(function (k, i) {
        var p = live[i - 1] || k, n = live[i + 1] || k, dx = (n.x - p.x) / 6, dy = (n.y - p.y) / 6;
        if (i < live.length - 1) k.to = [Math.round(dx * 100) / 100, Math.round(dy * 100) / 100]; else delete k.to;
        if (i > 0) k.ti = [Math.round(-dx * 100) / 100, Math.round(-dy * 100) / 100]; else delete k.ti;
      });
      return true;
    }

    /* ---------------- Properties: anchor + ease + graph ---------------- */
    C.onProps(function (P, c, sel) {
      if (!sel || !sel.Ly || sel.Ly.kind === "v1" || sel.Ly.kind === "aud" || !P) return;
      var tf = C.tfAt(c), d = document.createElement("div");
      d.className = "tlp-graph";
      d.innerHTML = '<div class="tlp-row"><span title="What position places and scale / rotation pivot on - pixels from the clip\'s centre">⊕ Anchor</span>'
        + '<input type="number" id="tlpAX" step="1" value="' + Math.round(tf.ax || 0) + '" style="width:62px" title="Anchor X (px from the centre)">'
        + '<input type="number" id="tlpAY" step="1" value="' + Math.round(tf.ay || 0) + '" style="width:62px" title="Anchor Y (px from the centre)"></div>'
        + '<div class="tlp-row" style="flex-wrap:wrap"><button class="ghost" id="tlpEase" title="Easy Ease the keyframe at the playhead (F9)">Easy Ease</button>'
        + '<button class="ghost" id="tlpEaseIn" title="Ease into the keyframe at the playhead">Ease In</button><button class="ghost" id="tlpEaseOut" title="Ease out of the keyframe at the playhead">Ease Out</button>'
        + '<button class="ghost" id="tlpGraph" title="The Graph Editor: value and speed graphs, Bézier handles">📈 Graph</button>'
        + '<button class="ghost" id="tlpSmooth" title="Smooth handles on every position key: a curved motion path">↝ Smooth path</button></div>';
      P.appendChild(d);
      var anc = function () {
        var ax = +document.getElementById("tlpAX").value || 0, ay = +document.getElementById("tlpAY").value || 0, now = C.tfAt(c), o = { ax: ax, ay: ay };
        // keep the layer where it is: the position moves with the anchor (unless position is keyframed)
        if (!KF.has(c.kf, "x") && !KF.has(c.kf, "ax")) {
          var r = now.rot * Math.PI / 180, dx = ax - (now.ax || 0), dy = ay - (now.ay || 0);
          o.x = Math.round((now.x + now.scale * (dx * Math.cos(r) - dy * Math.sin(r))) * 100) / 100;
          o.y = Math.round((now.y + now.scale * (dx * Math.sin(r) + dy * Math.cos(r))) * 100) / 100;
        }
        C.writeTf(c, o); if (typeof tlSave === "function") tlSave(); C.mark(); C.paintProps(true);
      };
      document.getElementById("tlpAX").addEventListener("change", anc); document.getElementById("tlpAY").addEventListener("change", anc);
      document.getElementById("tlpEase").addEventListener("click", function () { easeHere("both"); });
      document.getElementById("tlpEaseIn").addEventListener("click", function () { easeHere("in"); });
      document.getElementById("tlpEaseOut").addEventListener("click", function () { easeHere("out"); });
      document.getElementById("tlpGraph").addEventListener("click", function () { open(c); });
      document.getElementById("tlpSmooth").addEventListener("click", function () { if (smoothPath(c)) { changed(c); say("a smooth motion path through the position keys"); } else say("key the position twice first (◇ Key)"); });
    });

    /* ---------------- the Graph Editor ---------------- */
    var G = { el: null, c: null, kind: "img", prop: "x", mode: "value", sel: -1, drag: null, map: null };
    var css = document.createElement("style");
    css.textContent = "#tlGraph{position:fixed;left:120px;bottom:120px;width:620px;z-index:9000;background:var(--panel,#1e1f24);border:1px solid var(--line,#3a3d46);border-radius:6px;box-shadow:0 8px 28px rgba(0,0,0,.5);font-size:12px;color:var(--fg,#ddd)}"
      + "#tlGraph .tgh{display:flex;gap:6px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--line,#3a3d46);cursor:move}#tlGraph .tgh b{flex:1}"
      + "#tlGraph .tgb{display:flex;gap:6px;align-items:center;padding:5px 8px;flex-wrap:wrap}#tlGraph canvas{display:block;width:604px;height:260px;margin:0 8px 8px;background:#15161a;border-radius:4px;cursor:crosshair;outline:none}";
    document.head.appendChild(css);
    function open(c) {
      var sel = C.selClip(); c = c || (sel && sel.c); if (!c) return say("select a clip on the canvas first");
      G.c = c; G.kind = sel && sel.c === c ? sel.Ly.kind : "img"; G.sel = -1;
      var keyed = Object.keys(PROPS).filter(function (p) { return KF.has(c.kf, p); });
      if (keyed.indexOf(G.prop) < 0) G.prop = keyed[0] || "x";
      if (!G.el) {
        G.el = document.createElement("div"); G.el.id = "tlGraph"; document.body.appendChild(G.el);
      }
      G.el.style.display = "";
      G.el.innerHTML = '<div class="tgh"><b>📈 Graph Editor</b><span id="tgName"></span><button class="ghost" id="tgClose" title="Close">✕</button></div>'
        + '<div class="tgb"><select id="tgProp">' + Object.keys(PROPS).map(function (p) { return '<option value="' + p + '"' + (p === G.prop ? " selected" : "") + ">" + PROPS[p][0] + (KF.has(c.kf, p) ? " ◆" : "") + "</option>"; }).join("") + "</select>"
        + '<label><input type="radio" name="tgMode" value="value"' + (G.mode === "value" ? " checked" : "") + "> value</label><label><input type=\"radio\" name=\"tgMode\" value=\"speed\"" + (G.mode === "speed" ? " checked" : "") + "> speed</label>"
        + '<button class="ghost" id="tgEase" title="Easy Ease the selected key (F9)">Easy Ease</button><button class="ghost" id="tgLin" title="The selected key\'s tween: straight">Linear</button><button class="ghost" id="tgRove" title="Rove across time: this position key\'s time follows the path so the layer moves at an even speed between the keys that do not rove">Rove</button><button class="ghost" id="tgHold" title="The selected key holds its value until the next">Hold</button>'
        + '<span id="tgInfo" style="margin-left:auto;color:var(--dim,#999)"></span></div><canvas id="tgCv" width="1208" height="520" tabindex="0"></canvas>';
      document.getElementById("tgClose").onclick = close;
      document.getElementById("tgProp").onchange = function (e) { G.prop = e.target.value; G.sel = -1; paint(); };
      G.el.querySelectorAll('input[name="tgMode"]').forEach(function (r) { r.onchange = function () { G.mode = r.value; paint(); }; });
      document.getElementById("tgEase").onclick = function () { selEase("ease"); };
      document.getElementById("tgLin").onclick = function () { selEase("linear"); };
      document.getElementById("tgHold").onclick = function () { selEase("hold"); };
      document.getElementById("tgRove").onclick = function () { roveSel(); };
      dragPanel(G.el.querySelector(".tgh"), G.el);
      wireCanvas(document.getElementById("tgCv"));
      paint();
    }
    function close() { if (G.el) G.el.style.display = "none"; G.c = null; }
    function dragPanel(h, el) {
      h.onpointerdown = function (e) {
        if (e.target.tagName === "BUTTON") return;
        var r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
        var mv = function (ev) { el.style.left = Math.max(0, ev.clientX - ox) + "px"; el.style.top = Math.max(0, ev.clientY - oy) + "px"; el.style.bottom = "auto"; };
        var up = function () { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
      };
    }
    function propKeys() { return G.c ? sorted(G.c).filter(function (k) { return k[G.prop] != null; }) : []; }
    /** 2.496.0: the selected POSITION key roves across time (again = it stays put) */
    function roveSel() {
      var ks = propKeys(), k = ks[G.sel]; if (!k) return say("click a key in the graph first");
      if (G.prop !== "x" && G.prop !== "y") return say("Rove: a position key (x / y)");
      var pos = sorted(G.c).filter(function (q) { return q.x != null && q.y != null; });
      if (k === pos[0] || k === pos[pos.length - 1]) return say("Rove: the first and last position keys stay where they are");
      if (k.rove) delete k.rove; else k.rove = true;
      var on = !!k.rove; changed(G.c);
      say(on ? "⇢ the key roves: its time follows the path (an even speed between the keys around it)" : "the key stays at its time now");
    }
    function selEase(how) {
      var ks = propKeys(), k = ks[G.sel]; if (!k) return say("click a key in the graph first");
      if (how === "ease") easeKey(G.c, k.at, "both");
      else if (how === "linear") { delete k.ease; delete k.bz; }
      else { k.ease = "hold"; delete k.bz; }
      changed(G.c);
    }
    /** graph coordinates: time (seconds into the clip) ↔ x, value (display units) ↔ y */
    function mapping(cv) {
      var c = G.c, p = G.prop, k = PROPS[p][1], len = Math.max(0.5, lenOf(c, G.kind)), fb = fallback(c, p), W = cv.width, H = cv.height, pad = 30;
      var vals = [];
      for (var i = 0; i <= 200; i++) { var t = len * i / 200; vals.push(G.mode === "speed" ? KF.speed(c.kf, t, p, fb) * k : KF.value(c.kf, t, p, fb) * k); }
      if (G.mode === "value") propKeys().forEach(function (kk, i, ks) { var b = kk.ease === "bezier" && KF.okBz(kk.bz) ? kk.bz : null, nx = ks[i + 1]; vals.push(kk[p] * k); if (b && nx) { var dv = (nx[p] - kk[p]) * k; vals.push(kk[p] * k + b[1] * dv, kk[p] * k + b[3] * dv); } });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (hi - lo < 1e-6) { lo -= 1; hi += 1; } var m = (hi - lo) * 0.1; lo -= m; hi += m;
      return { len: len, k: k, fb: fb, lo: lo, hi: hi, W: W, H: H, pad: pad,
        tx: function (t) { return pad + t / len * (W - 2 * pad); }, xt: function (x) { return (x - pad) / (W - 2 * pad) * len; },
        vy: function (v) { return H - pad - (v - lo) / (hi - lo) * (H - 2 * pad); }, yv: function (y) { return lo + (H - pad - y) / (H - 2 * pad) * (hi - lo); } };
    }
    function handles(M) {
      var ks = propKeys(), p = G.prop, out = [];
      var i = G.sel, a = ks[i], b = ks[i + 1];
      if (G.mode !== "value" || !a) return out;
      if (b && a.ease !== "hold") { var bz = KF.bzOf(a) || EASY, dt = b.at - a.at, dv = (b[p] - a[p]) * M.k;
        out.push({ side: 0, key: a, x: M.tx(a.at + bz[0] * dt), y: M.vy(a[p] * M.k + bz[1] * dv), ox: M.tx(a.at), oy: M.vy(a[p] * M.k) });
        out.push({ side: 1, key: a, x: M.tx(a.at + bz[2] * dt), y: M.vy(a[p] * M.k + bz[3] * dv), ox: M.tx(b.at), oy: M.vy(b[p] * M.k) }); }
      return out;
    }
    function paint() {
      if (!G.el || G.el.style.display === "none" || !G.c) return;
      var cv = document.getElementById("tgCv"); if (!cv) return;
      var g = cv.getContext("2d"), M = mapping(cv), c = G.c, p = G.prop;
      G.map = M;
      g.clearRect(0, 0, M.W, M.H);
      g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 1; g.fillStyle = "rgba(255,255,255,.45)"; g.font = "18px sans-serif";
      for (var i = 0; i <= 4; i++) { var v = M.lo + (M.hi - M.lo) * i / 4, y = M.vy(v); g.beginPath(); g.moveTo(M.pad, y); g.lineTo(M.W - M.pad, y); g.stroke(); g.fillText((Math.round(v * 10) / 10) + (G.mode === "speed" ? PROPS[p][2] + "/s" : PROPS[p][2]), 4, y - 3); }
      // the playhead
      var tau = (C.state.t || 0) - (c.start || 0); if (tau >= 0 && tau <= M.len) { g.strokeStyle = "#f59e2c"; g.beginPath(); g.moveTo(M.tx(tau), 0); g.lineTo(M.tx(tau), M.H); g.stroke(); }
      // the curve
      g.strokeStyle = G.mode === "speed" ? "#5ec4ff" : "#7ee787"; g.lineWidth = 3; g.beginPath();
      for (var x = M.pad; x <= M.W - M.pad; x += 2) { var t = M.xt(x), val = G.mode === "speed" ? KF.speed(c.kf, t, p, M.fb) * M.k : KF.value(c.kf, t, p, M.fb) * M.k, yy = M.vy(val); if (x === M.pad) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.stroke();
      // the keys + the selected key's handles
      var ks = propKeys();
      ks.forEach(function (k, j) { var kx = M.tx(k.at), ky = M.vy(G.mode === "speed" ? KF.speed(c.kf, k.at, p, M.fb) * M.k : k[p] * M.k); g.fillStyle = j === G.sel ? "#f59e2c" : "#ffffff"; g.fillRect(kx - 6, ky - 6, 12, 12); });
      handles(M).forEach(function (h) { g.strokeStyle = "#f59e2c"; g.lineWidth = 2; g.beginPath(); g.moveTo(h.ox, h.oy); g.lineTo(h.x, h.y); g.stroke(); g.beginPath(); g.arc(h.x, h.y, 7, 0, Math.PI * 2); g.fillStyle = "#f59e2c"; g.fill(); });
      var nm = document.getElementById("tgName"); if (nm) nm.textContent = c.text ? (c.text.content || "").slice(0, 24) : (c.name || "");
      var inf = document.getElementById("tgInfo"); if (inf) { var s = ks[G.sel]; inf.textContent = s ? "key +" + s.at.toFixed(2) + "s = " + (Math.round(s[p] * M.k * 100) / 100) + PROPS[p][2] + (s.ease ? " · " + s.ease + (s.ease === "bezier" && s.bz ? " [" + s.bz.map(function (v) { return Math.round(v * 100) / 100; }).join(", ") + "]" : "") : "") : ks.length + " key(s)"; }
    }
    function wireCanvas(cv) {
      var at = function (e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
      cv.onpointerdown = function (e) {
        var M = G.map; if (!M) return; var q = at(e), ks = propKeys(), p = G.prop;
        var hs = handles(M), hh = hs.filter(function (h) { return Math.hypot(h.x - q.x, h.y - q.y) < 14; })[0];
        if (hh) { G.drag = { h: hh }; cv.setPointerCapture(e.pointerId); return; }
        var hit = -1; ks.forEach(function (k, j) { var ky = M.vy(G.mode === "speed" ? KF.speed(G.c.kf, k.at, p, M.fb) * M.k : k[p] * M.k); if (Math.abs(M.tx(k.at) - q.x) < 12 && Math.abs(ky - q.y) < 12) hit = j; });
        G.sel = hit; paint();
        if (hit >= 0) { G.drag = { key: ks[hit], t0: ks[hit].at }; cv.setPointerCapture(e.pointerId); }
      };
      cv.onpointermove = function (e) {
        if (!G.drag) return; var M = G.map, q = at(e), p = G.prop, ks = propKeys();
        if (G.drag.h) {
          var h = G.drag.h, a = h.key, i = ks.indexOf(a), b = ks[i + 1]; if (!b) return;
          var bz = asBezier(a), dt = b.at - a.at, dv = (b[p] - a[p]) * M.k, tt = (M.xt(q.x) - a.at) / dt, vv = M.yv(q.y) - a[p] * M.k;
          var fx = Math.max(0, Math.min(1, tt)), fy = Math.abs(dv) > 1e-9 ? Math.max(-2, Math.min(3, vv / dv)) : bz[h.side * 2 + 1];
          bz[h.side * 2] = Math.round(fx * 1000) / 1000; bz[h.side * 2 + 1] = Math.round(fy * 1000) / 1000;
        } else if (G.mode === "value") {
          var k = G.drag.key, nt = Math.max(0, Math.round(M.xt(q.x) * FPS) / FPS), clash = (G.c.kf || []).some(function (o) { return o !== k && Math.abs(o.at - nt) < 0.5 / FPS; });
          if (!clash) k.at = Math.min(M.len, nt);
          k[p] = Math.round(M.yv(q.y) / M.k * 10000) / 10000;
          if (p === "scale") k[p] = Math.max(0.01, k[p]); if (p === "op") k[p] = Math.max(0, Math.min(1, k[p]));
          G.c.kf.sort(function (x, y) { return x.at - y.at; }); G.sel = propKeys().indexOf(k);
        }
        C.mark(); paint();
      };
      cv.onpointerup = function () { if (G.drag) { G.drag = null; changed(G.c); } };
      cv.ondblclick = function (e) {
        var M = G.map; if (!M || G.mode !== "value") return; var q = at(e), t = Math.max(0, Math.min(M.len, M.xt(q.x))), o = {};
        o[G.prop] = KF.value(G.c.kf, t, G.prop, M.fb);
        if (G.prop === "x" || G.prop === "y") { o.x = KF.value(G.c.kf, t, "x", fallback(G.c, "x")); o.y = KF.value(G.c.kf, t, "y", fallback(G.c, "y")); }
        G.c.kf = KF.set(G.c.kf, t, o, FPS); G.sel = propKeys().findIndex(function (k) { return Math.abs(k.at - KF.snap(t)) < 0.5 / FPS; }); changed(G.c);
      };
      cv.onkeydown = function (e) {
        if (e.key === "F9") { e.preventDefault(); selEase("ease"); }
        else if ((e.key === "Delete" || e.key === "Backspace") && propKeys()[G.sel]) { e.preventDefault(); var k = propKeys()[G.sel]; delete k[G.prop]; if (G.prop === "x") delete k.y; if (G.prop === "y") delete k.x; G.c.kf = G.c.kf.filter(function (o) { return Object.keys(o).some(function (q) { return KF.NUM.indexOf(q) >= 0 || q === "color"; }); }); G.sel = -1; changed(G.c); }
      };
    }
    // F9 anywhere over the timeline (not typing): Easy Ease the key at the playhead
    window.addEventListener("keydown", function (e) {
      if (e.key !== "F9" || e.defaultPrevented) return;
      var a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if (!document.querySelector("#timelinedock") || (a && a.id === "tgCv")) return;
      var sel = C.selClip(); if (!sel || !sel.c.kf) return;
      e.preventDefault(); easeHere(e.shiftKey ? (e.ctrlKey ? "out" : "in") : "both");
    });

    /* ---------------- the motion path on the canvas ---------------- */
    function pathOf(sel) {
      var c = sel.c; if (!KF.has(c.kf, "x")) return null;
      var len = lenOf(c, sel.Ly.kind), pts = [];
      for (var t = 0; t <= len + 1e-6; t += 1 / FPS) { var tf = C.tfAt(c, (c.start || 0) + t); pts.push([C.state.W / 2 + tf.x, C.state.H / 2 + tf.y]); }
      return { pts: pts, keys: sorted(c).filter(function (k) { return k.x != null; }) };
    }
    C.onDraw(function (ctx, o) {
      paint();
      var sel = C.selClip(); if (!sel || !sel.Ly || sel.Ly.kind === "v1" || sel.Ly.kind === "aud") return;
      var P = pathOf(sel); if (!P) return;
      var cx = C.state.W / 2, cy = C.state.H / 2;
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = "rgba(245,158,44,.9)"; ctx.lineWidth = 1.5; ctx.beginPath();
      P.pts.forEach(function (q, i) { var s = o.toScreen(q[0], q[1]); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); }); ctx.stroke(); ctx.setLineDash([]);
      P.pts.forEach(function (q, i) { if (i % 2) return; var s = o.toScreen(q[0], q[1]); ctx.fillStyle = "rgba(245,158,44,.6)"; ctx.fillRect(s.x - 1, s.y - 1, 2, 2); });
      P.keys.forEach(function (k) {
        var s = o.toScreen(cx + k.x, cy + k.y);
        [["to", 1], ["ti", 1]].forEach(function (hd) { var t = k[hd[0]]; if (!KF.okT(t)) return; var e = o.toScreen(cx + k.x + t[0], cy + k.y + t[1]); ctx.strokeStyle = "#5ec4ff"; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.fillStyle = "#5ec4ff"; ctx.beginPath(); ctx.arc(e.x, e.y, 4, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#f59e2c"; ctx.fillRect(s.x - 4, s.y - 4, 8, 8); ctx.strokeRect(s.x - 4, s.y - 4, 8, 8);
      });
      ctx.restore();
    });
    function pathHit(sel, p) {
      var P = pathOf(sel); if (!P) return null;
      var r = 8 / Math.max(0.01, C.state.view.z), cx = C.state.W / 2, cy = C.state.H / 2, best = null;
      P.keys.forEach(function (k) {
        ["to", "ti"].forEach(function (h) { var t = k[h]; if (KF.okT(t) && Math.hypot(cx + k.x + t[0] - p.x, cy + k.y + t[1] - p.y) < r) best = { k: k, h: h }; });
        if (!best && Math.hypot(cx + k.x - p.x, cy + k.y - p.y) < r) best = { k: k, h: null };
      });
      return best;
    }
    C.onGrab({
      down: function (ev, p, sel) {
        if (!sel || !sel.Ly || sel.Ly.kind === "v1") return null;
        var hit = pathHit(sel, p); if (!hit) return null;
        var c = sel.c, k = hit.k, cx = C.state.W / 2, cy = C.state.H / 2, pull = !hit.h && ev.altKey;
        return {
          move: function (e2, q) {
            if (hit.h || pull) {
              var h = hit.h || "to", v = [Math.round((q.x - cx - k.x) * 100) / 100, Math.round((q.y - cy - k.y) * 100) / 100];
              if (h === "ti" && pull) v = [-v[0], -v[1]];
              k[h] = v; if (!e2.altKey || pull) k[h === "to" ? "ti" : "to"] = [-v[0], -v[1]];
            } else { k.x = Math.round((q.x - cx) * 100) / 100; k.y = Math.round((q.y - cy) * 100) / 100; }
            C.mark();
          },
          up: function () { changed(c); }
        };
      },
      hover: function (ev, p, sel) { return sel && sel.Ly && sel.Ly.kind !== "v1" && pathHit(sel, p) ? "pointer" : null; }
    });

    function addProp(k, label, mul, unit) { if (!PROPS[k]) PROPS[k] = [label, mul || 1, unit || ""]; }   // 2.492.0: more keyable numbers (a shape's)
    window.TlGraph = { addProp: addProp, easeKey: easeKey, easeHere: easeHere, smoothPath: smoothPath, open: open, close: close, state: G, paint: paint, pathOf: pathOf };
  }
})();
