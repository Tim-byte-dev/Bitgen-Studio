/* bitGen Studio — ext/timelinedock/tlremap.js (2.501.0): ⏱ TIME REMAPPING ON A CURVE for a video clip. window.TlRemap.
 *
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." -
 * AFTER-EFFECTS-GAP.md: "time remapping on a curve".
 *
 *   ⏱ Time remap (in a video clip's 🎬 Speed)
 *     on            the clip gets a remap curve that plays as it does now (its speed / ramp / reverse kept as keys)
 *     the curve     across = time on the timeline (the clip's own seconds), up = which second of the source shows.
 *                   Drag a key; double-click the curve to add one, a key to remove it. Rising = forward, falling =
 *                   backwards, flat = a freeze, steeper = faster. The last key's time is the clip's length.
 *     ◇ Key         a key at the playhead (on the curve where it is)
 *     ❄ Freeze      the frame at the playhead held for <n> s (the rest of the clip moves later)
 *     the key row   the chosen key's time and source second typed in; ✕ removes it
 *   The compile     static/clipfx.js segments (one per key pair) -> scripts/clipfx_render.py remap_graph (each piece
 *                   trimmed, played forward / reversed / held, joined); its sound: the same pieces (a freeze is silent),
 *                   heard in the preview through the retimed-sound file
 * Pure (Node: scripts/test-remap.js): start(c, F) (the keys that play the clip as it is), addKey, freeze, moveKey,
 *   delKey, len.
 */
(function (root) {
  "use strict";
  var r4 = function (v) { return Math.round(v * 1e4) / 1e4; };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  function srcLenOf(c) { return Math.max(0, (c.out != null ? +c.out : (+c.dur || 0)) - (+c.in || 0)); }
  /** the remap keys that play c exactly as it plays now (straight, a speed, reversed, a ramp: sampled) */
  function start(c, F) {
    var L = srcLenOf(c), cc = Object.assign({}, c, { out: c.out != null ? c.out : c.dur });
    var T = (F.clipLen(cc) || L), i0 = +c.in || 0, n = c.fx && c.fx.ramp ? 9 : 2, out = [];
    for (var i = 0; i < n; i++) { var t = T * i / (n - 1); out.push({ t: r4(t), q: r4(clamp(F.srcTime(cc, t) - i0, 0, L)) }); }
    return out;
  }
  function len(rm) { return rm && rm.length ? rm[rm.length - 1].t : 0; }
  function qAt(rm, t) {
    if (t <= rm[0].t) return rm[0].q;
    for (var i = 1; i < rm.length; i++) if (t <= rm[i].t) { var a = rm[i - 1], b = rm[i]; return a.q + (b.q - a.q) * (t - a.t) / Math.max(1e-9, b.t - a.t); }
    return rm[rm.length - 1].q;
  }
  function copy(rm) { return rm.map(function (k) { return { t: k.t, q: k.q }; }); }
  /** a key at t on the curve (nothing when one is that close already); -> {rm, i} */
  function addKey(rm, t) {
    var o = copy(rm); t = clamp(t, 0, len(o));
    for (var j = 0; j < o.length; j++) if (Math.abs(o[j].t - t) < 0.02) return { rm: o, i: j };
    var k = { t: r4(t), q: r4(qAt(o, t)) }; o.push(k); o.sort(function (a, b) { return a.t - b.t; });
    return { rm: o, i: o.indexOf(k) };
  }
  /** the frame at t held for d s: a flat stretch, every later key d s later */
  function freeze(rm, t, d) {
    d = clamp(+d || 1, 0.04, 60); t = clamp(t, 0, len(rm));
    var q = r4(qAt(rm, t)), o = [];
    rm.forEach(function (k) { if (k.t < t - 0.005) o.push({ t: k.t, q: k.q }); });
    o.push({ t: r4(t), q: q }, { t: r4(t + d), q: q });
    rm.forEach(function (k) { if (k.t > t + 0.005) o.push({ t: r4(k.t + d), q: k.q }); });
    return o;
  }
  /** key i moved to (t, q): the first stays at 0, a key never passes its neighbours, q inside the source */
  function moveKey(rm, i, t, q, L) {
    var o = copy(rm); if (!o[i]) return o;
    var lo = i > 0 ? o[i - 1].t + 0.02 : 0, hi = i < o.length - 1 ? o[i + 1].t - 0.02 : 86400;
    o[i] = { t: r4(i === 0 ? 0 : clamp(t, lo, hi)), q: r4(clamp(q, 0, L)) };
    return o;
  }
  function delKey(rm, i) { if (rm.length <= 2 || i === 0) return copy(rm); var o = copy(rm); o.splice(i, 1); return o; }
  var pure = { start: start, len: len, qAt: qAt, addKey: addKey, freeze: freeze, moveKey: moveKey, delKey: delKey };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page (called from clipfx.js's 🎬 Speed) ---------------- */
  var sel = 0, frz = 1;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  /** the ⏱ Time remap block's HTML for the clip's fx */
  function html(c, fx) {
    var on = !!(fx && fx.remap), k = on ? fx.remap[Math.min(sel, fx.remap.length - 1)] : null;
    return '<div class="tlp-remap" id="tfxRemap"><div class="tlp-row"><label title="Which source second shows at each moment of the clip - forward, backwards, frozen, faster, slower"><input type="checkbox" id="tfxRmOn"' + (on ? " checked" : "") + "> ⏱ Time remap</label>"
      + (on ? '<button class="ghost" id="tfxRmKey" title="A key at the playhead">◇ Key</button><button class="ghost" id="tfxRmFrz" title="Hold the frame at the playhead">❄ Freeze</button><input type="number" id="tfxRmFrzD" min="0.04" max="60" step="0.25" value="' + frz + '" style="width:46px" title="seconds to hold"> s' : "") + "</div>"
      + (on ? '<canvas id="tfxRmCv" width="240" height="110" style="width:100%;max-width:240px;height:110px;background:var(--bg2,#1c1a17);border:1px solid var(--line,#3a352d);border-radius:4px;cursor:crosshair;touch-action:none" title="Across: the clip\'s time. Up: the source second. Drag a key; double-click to add / remove one"></canvas>'
        + '<div class="tlp-row"><span class="fxdim">key ' + (sel + 1) + "/" + fx.remap.length + '</span><label>at <input type="number" id="tfxRmT" step="0.05" min="0" value="' + esc(k.t) + '" style="width:58px"' + (sel === 0 ? " disabled" : "") + '> s</label><label>shows <input type="number" id="tfxRmQ" step="0.05" min="0" value="' + esc(k.q) + '" style="width:58px"> s</label><button class="ghost" id="tfxRmDel" title="Remove this key"' + (sel === 0 || fx.remap.length <= 2 ? " disabled" : "") + ">✕</button></div>" : "")
      + "</div>";
  }
  /** wire the block: d = the clip's fx draft, commit(structural), after() = refresh texts */
  function wire(c, d, commit, after) {
    var $ = function (id) { return document.getElementById(id); };
    var F = window.H3ClipFx, L = srcLenOf(c);
    var repaint = function () { if (window.TlCanvas && TlCanvas.paintProps) TlCanvas.paintProps(); };
    var set = function (rm, structural) { d.remap = rm; commit(structural !== false); if (after) after(); };
    var here = function () { var p = (typeof playhead === "number" && isFinite(playhead)) ? playhead : 0; return p - (+c.start || 0); };
    var say = function (t) { try { TlCanvas.say(t); } catch (e) { /* fine */ } };
    if ($("tfxRmOn")) $("tfxRmOn").addEventListener("change", function () {
      if ($("tfxRmOn").checked) { var tmp = Object.assign({}, c, { fx: F.normalize(Object.assign({}, d, { remap: null })) }); d.remap = start(tmp, F); sel = 0; say("⏱ time remap on: drag the keys on the curve (up = a later source second)"); }
      else delete d.remap;
      commit(true); if (after) after(); repaint();
    });
    if (!d.remap) return;
    sel = Math.min(sel, d.remap.length - 1);
    var stop = function (el) { if (el) el.addEventListener("keydown", function (ev) { ev.stopPropagation(); }); };
    ["tfxRmT", "tfxRmQ", "tfxRmFrzD"].forEach(function (id) { stop($(id)); });
    $("tfxRmKey").addEventListener("click", function () { var r = addKey(d.remap, here()); sel = r.i; set(r.rm, false); repaint(); });
    $("tfxRmFrzD").addEventListener("input", function () { var v = +$("tfxRmFrzD").value; if (v > 0) frz = v; });
    $("tfxRmFrz").addEventListener("click", function () { set(freeze(d.remap, here(), frz)); say("❄ the frame at the playhead held for " + frz + " s"); repaint(); });
    var num = function () { var t = +$("tfxRmT").value, q = +$("tfxRmQ").value; if (!Number.isFinite(t) || !Number.isFinite(q)) return; set(moveKey(d.remap, sel, t, q, L)); draw(); row(); };
    $("tfxRmT").addEventListener("change", num); $("tfxRmQ").addEventListener("change", num);
    $("tfxRmDel").addEventListener("click", function () { set(delKey(d.remap, sel)); sel = Math.max(0, sel - 1); draw(); row(); });
    /* the curve */
    var cv = $("tfxRmCv"), g = cv.getContext("2d"), P = 8, W = cv.width, H = cv.height, held = 0;
    var T = function () { return held || Math.max(0.5, len(d.remap) * 1.15); };   // the scale holds still while a key is dragged
    var X = function (t) { return P + t / T() * (W - 2 * P); }, Y = function (q) { return H - P - q / Math.max(0.01, L) * (H - 2 * P); };
    var tOf = function (x) { return (x - P) / (W - 2 * P) * T(); }, qOf = function (y) { return (H - P - y) / (H - 2 * P) * L; };
    function draw() {
      var rm = d.remap; g.clearRect(0, 0, W, H);
      g.strokeStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(Math.min(T(), L)), Y(Math.min(T(), L))); g.stroke();   // the straight line (100 %)
      g.strokeStyle = "rgba(255,255,255,.18)"; g.strokeRect(P, P, W - 2 * P, H - 2 * P);
      var ph = here(); if (ph >= 0 && ph <= len(rm)) { g.strokeStyle = "#e05a4f"; g.beginPath(); g.moveTo(X(ph), P); g.lineTo(X(ph), H - P); g.stroke(); }
      g.strokeStyle = "#f59e2c"; g.lineWidth = 2; g.beginPath(); rm.forEach(function (k, i) { if (i) g.lineTo(X(k.t), Y(k.q)); else g.moveTo(X(k.t), Y(k.q)); }); g.stroke(); g.lineWidth = 1;
      rm.forEach(function (k, i) { g.fillStyle = i === sel ? "#fff" : "#f59e2c"; g.beginPath(); g.moveTo(X(k.t), Y(k.q) - 5); g.lineTo(X(k.t) + 5, Y(k.q)); g.lineTo(X(k.t), Y(k.q) + 5); g.lineTo(X(k.t) - 5, Y(k.q)); g.closePath(); g.fill(); });
      g.fillStyle = "rgba(255,255,255,.45)"; g.font = "9px sans-serif"; g.fillText("source " + L.toFixed(1) + " s", P + 2, P + 9); g.fillText(len(rm).toFixed(2) + " s", Math.min(W - 40, X(len(rm)) - 14), H - 1);
    }
    function row() {                                           // the chosen key's row, in place (the panel is not rebuilt mid-gesture)
      var k = d.remap[sel]; if (!k) return;
      var lab = document.querySelector("#tfxRemap .fxdim"); if (lab) lab.textContent = "key " + (sel + 1) + "/" + d.remap.length;
      if ($("tfxRmT")) { $("tfxRmT").value = k.t; $("tfxRmT").disabled = sel === 0; }
      if ($("tfxRmQ")) $("tfxRmQ").value = k.q;
      if ($("tfxRmDel")) $("tfxRmDel").disabled = sel === 0 || d.remap.length <= 2;
    }
    var pos = function (ev) { var b = cv.getBoundingClientRect(); return { x: (ev.clientX - b.left) * W / Math.max(1, b.width), y: (ev.clientY - b.top) * H / Math.max(1, b.height) }; };
    var hit = function (p) { var best = -1, bd = 9; d.remap.forEach(function (k, i) { var dd = Math.hypot(X(k.t) - p.x, Y(k.q) - p.y); if (dd < bd) { bd = dd; best = i; } }); return best; };
    var drag = -1, moved = false;
    cv.addEventListener("pointerdown", function (ev) { var i = hit(pos(ev)); if (i < 0) return; drag = i; sel = i; moved = false; held = T(); try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ } ev.preventDefault(); draw(); row(); });
    cv.addEventListener("pointermove", function (ev) {
      if (drag < 0) return; var p = pos(ev); moved = true;
      d.remap = moveKey(d.remap, drag, tOf(p.x), qOf(p.y), L); draw(); row();
      commit(false);
    });
    cv.addEventListener("pointerup", function () { if (drag < 0) return; drag = -1; held = 0; if (moved) set(d.remap); draw(); });
    cv.addEventListener("dblclick", function (ev) {
      var p = pos(ev), i = hit(p);
      if (i >= 0) { set(delKey(d.remap, i)); sel = Math.max(0, Math.min(i - 1, d.remap.length - 1)); }
      else { var r = addKey(d.remap, tOf(p.x)); r.rm = moveKey(r.rm, r.i, r.rm[r.i].t, qOf(p.y), L); sel = r.i; set(r.rm); }
      draw(); row();
    });
    root.TlRemap.redraw = draw;
    draw();
  }
  root.TlRemap = Object.assign({ html: html, wire: wire }, pure);
})(typeof window !== "undefined" ? window : globalThis);
