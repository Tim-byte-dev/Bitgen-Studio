/* bitGen Studio — ext/timelinedock/colourpanel.js (2.407.0): the 🎨 COLOUR dialog - lift / gamma / gain WHEELS, CURVES
 * (master, R, G, B), HSL SECONDARIES and live SCOPES (waveform, RGB parade, vectorscope, histogram).
 *
 * Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do".
 *
 * It edits the selected clip's fx.grade (static/clipfx.js normalizes it; the whole look is baked into one LUT, so the
 * canvas and the compile stay identical). The scopes read the canvas's own picture (TlCanvas.paintComp at the marker),
 * a few times a second while the dialog is open.
 * 2.416.0: ◯ MASK / POWER WINDOW (Tim: "continue with the next part please the gap is getting smaller"): an ellipse or a
 * box (centre, size, rotation, feather, invert) - the grade and the effects after it only inside it (or outside); its
 * outline drawn on the canvas while this panel is open; 🎯 Track follows what it sits on from the position marker to the
 * clip's end (lib/track.js, POST /api/clipfx/track) - fx.mask.track, seconds into the clip.
 * 2.415.0: 🎯 MATCH (Tim: "lets do the medium jobs now" - Premiere's colour match): pick another clip on the timeline;
 * this clip's R / G / B curves are set so its tones match that clip's frame as the movie shows it (lib/colourMatch.js,
 * POST /api/clipfx/colourmatch) - each clip's frame at the position marker when it is there, else its middle frame.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && TlCanvas.paintComp && window.TlDlg && window.H3ClipFx); } catch (e) { return false; } }
  var F = function () { return window.H3ClipFx; };
  var dlg = null, timer = 0, chan = "m", scope = "waveform", clip = null;
  var CSS = ".tcp-grid{display:grid;grid-template-columns:auto 330px;gap:12px}"
    + ".tcp-wheels{display:flex;gap:10px}.tcp-wheel{text-align:center;font-size:.68rem}.tcp-wheel canvas{cursor:crosshair;border-radius:50%}"
    + ".tcp-wheel input{width:110px}.tcp-tabs button{padding:0 8px}.tcp-tabs button.on{outline:1px solid var(--tiger,#f59e2c)}"
    + ".tcp-hsl .fx-row span{min-width:44px}.tcp-sw{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle}"
    + "#tcpCurve{background:#111;cursor:crosshair}#tcpScope{background:#000;width:320px;height:200px}";
  function css() { if (!$("tcpCss")) { var st = document.createElement("style"); st.id = "tcpCss"; st.textContent = CSS; document.head.appendChild(st); } }

  function sel() {
    var s = TlCanvas.selClip && TlCanvas.selClip();
    if (!s || !s.c || s.c.m3d || s.c.text || (s.Ly.kind === "img" && !s.c.adjust) || s.Ly.kind === "aud") return null;   // 2.409.0: + adjustment layers
    return s.c;
  }
  function grade() { clip.fx = clip.fx || {}; clip.fx.grade = clip.fx.grade || {}; return clip.fx.grade; }
  function commit(final) {
    var n = F().normalize(clip.fx || {});
    var look = clip.fx && clip.fx.look;
    if (n) { if (look && !n.look) n.look = look; clip.fx = n; } else delete clip.fx;
    TlCanvas.mark();
    if (final && typeof tlSave === "function") tlSave();
    if (final && TlCanvas.paintProps) TlCanvas.paintProps();     // the Properties panel's own copy follows
  }

  /* ---------------- wheels */
  function drawWheel(cv, w) {
    var g = cv.getContext("2d"), R = cv.width / 2;
    var img = g.createImageData(cv.width, cv.height);
    for (var y = 0; y < cv.height; y++) for (var x = 0; x < cv.width; x++) {
      var dx = (x - R) / R, dy = (R - y) / R, d = Math.hypot(dx, dy), i = (y * cv.width + x) * 4;
      if (d > 1) { img.data[i + 3] = 0; continue; }
      var h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, c = F().hslToRgb(h, d, 0.5 + (1 - d) * 0.25);
      img.data[i] = c[0] * 255; img.data[i + 1] = c[1] * 255; img.data[i + 2] = c[2] * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    var px = R + (w.x || 0) * R, py = R - (w.y || 0) * R;
    g.strokeStyle = "#000"; g.lineWidth = 3; g.beginPath(); g.arc(px, py, 6, 0, 7); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, 6, 0, 7); g.stroke();
  }
  function wireWheel(k) {
    var cv = $("tcpW_" + k), sl = $("tcpL_" + k);
    var cur = function () { return (grade().wheels || {})[k] || { x: 0, y: 0, l: 0 }; };
    var set = function (o, final) {
      var G = grade(); G.wheels = G.wheels || {}; G.wheels[k] = Object.assign({}, cur(), o);
      commit(final); drawWheel(cv, cur()); sl.value = cur().l;
    };
    drawWheel(cv, cur()); sl.value = cur().l;
    var on = false;
    var at = function (e) {
      var r = cv.getBoundingClientRect(), R = r.width / 2;
      var x = (e.clientX - r.left - R) / R, y = (R - (e.clientY - r.top)) / R, h = Math.hypot(x, y);
      if (h > 1) { x /= h; y /= h; }
      return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
    };
    cv.addEventListener("pointerdown", function (e) { on = true; cv.setPointerCapture(e.pointerId); set(at(e), false); });
    cv.addEventListener("pointermove", function (e) { if (on) set(at(e), false); });
    cv.addEventListener("pointerup", function (e) { on = false; set(at(e), true); });
    cv.addEventListener("dblclick", function () { set({ x: 0, y: 0 }, true); });
    sl.addEventListener("input", function () { set({ l: +sl.value }, false); });
    sl.addEventListener("change", function () { set({ l: +sl.value }, true); });
  }

  /* ---------------- curves */
  var CCOL = { m: "#ddd", r: "#ff5a5a", g: "#56d364", b: "#58a6ff", hh: "#f2f2f2", hs: "#f2f2f2" };
  // 2.412.0: "hh" / "hs" = hue vs hue / hue vs saturation (grade.hcurves; x = the hue, y 0.5 = unchanged; the ends wrap)
  function isHue(k) { return k === "hh" || k === "hs"; }
  function store(k) { var G = grade(); return isHue(k) ? (G.hcurves || {}) : (G.curves || {}); }
  function dflt(k) { return isHue(k) ? [[0, 0.5], [1, 0.5]] : [[0, 0], [1, 1]]; }
  function pts() { var c = store(chan)[chan]; return c ? c.map(function (p) { return p.slice(); }) : dflt(chan); }
  function setPts(p, final) {
    var G = grade();
    if (isHue(chan)) { G.hcurves = G.hcurves || {}; G.hcurves[chan] = p; } else { G.curves = G.curves || {}; G.curves[chan] = p; }
    commit(final); drawCurve();
  }
  function drawCurve() {
    var cv = $("tcpCurve"); if (!cv) return;
    var g = cv.getContext("2d"), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H); g.fillStyle = "#111"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#333"; g.lineWidth = 1;
    for (var i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * W / 4, 0); g.lineTo(i * W / 4, H); g.moveTo(0, i * H / 4); g.lineTo(W, i * H / 4); g.stroke(); }
    if (isHue(chan)) {                                   // a rainbow under the hue curves, the middle line = unchanged
      for (var hx = 0; hx < W; hx += 2) { g.fillStyle = "hsl(" + Math.round(hx / W * 360) + ",80%,45%)"; g.globalAlpha = 0.28; g.fillRect(hx, 0, 2, H); }
      g.globalAlpha = 1; g.strokeStyle = "#666"; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    } else { g.strokeStyle = "#444"; g.beginPath(); g.moveTo(0, H); g.lineTo(W, 0); g.stroke(); }
    var cu = store(chan);
    (isHue(chan) ? [chan] : ["m", "r", "g", "b"]).forEach(function (k) {
      if (k !== chan && !cu[k]) return;
      var p = cu[k] || dflt(k), f = F().curveFn(p);
      g.strokeStyle = CCOL[k]; g.globalAlpha = k === chan ? 1 : 0.35; g.lineWidth = k === chan ? 2 : 1;
      g.beginPath();
      for (var x = 0; x <= W; x++) { var y = H - Math.max(0, Math.min(1, f(x / W))) * H; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    });
    g.globalAlpha = 1;
    pts().forEach(function (q) { g.fillStyle = CCOL[chan]; g.fillRect(q[0] * W - 4, H - q[1] * H - 4, 8, 8); });
    Array.prototype.forEach.call(document.querySelectorAll(".tcp-tabs [data-ch]"), function (b) { b.classList.toggle("on", b.dataset.ch === chan); });
  }
  function wireCurve() {
    var cv = $("tcpCurve"), drag = -1, p = null;
    var at = function (e) { var r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height))]; };
    cv.addEventListener("pointerdown", function (e) {
      p = pts(); var q = at(e), best = -1, bd = 0.05;
      p.forEach(function (o, i) { var d = Math.hypot(o[0] - q[0], o[1] - q[1]); if (d < bd) { bd = d; best = i; } });
      if (best < 0) { if (p.length >= 16) return; p.push(q); p.sort(function (a, b) { return a[0] - b[0]; }); best = p.indexOf(q); }
      drag = best; cv.setPointerCapture(e.pointerId); setPts(p, false);
    });
    cv.addEventListener("pointermove", function (e) {
      if (drag < 0) return;
      var q = at(e), lo = drag > 0 ? p[drag - 1][0] + 0.01 : 0, hi = drag < p.length - 1 ? p[drag + 1][0] - 0.01 : 1;
      if (drag === 0) q[0] = Math.min(q[0], hi); else if (drag === p.length - 1) q[0] = Math.max(q[0], lo); else q[0] = Math.max(lo, Math.min(hi, q[0]));
      if (isHue(chan) && (drag === 0 || drag === p.length - 1)) { q[0] = drag === 0 ? 0 : 1; p[drag === 0 ? p.length - 1 : 0][1] = Math.round(q[1] * 1000) / 1000; }   // red wraps
      p[drag] = [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]; setPts(p, false);
    });
    cv.addEventListener("pointerup", function () { if (drag >= 0) { drag = -1; setPts(p, true); } });
    cv.addEventListener("dblclick", function (e) {       // a point away from the ends: removed
      var q = at(e), pp = pts();
      for (var i = 1; i < pp.length - 1; i++) if (Math.hypot(pp[i][0] - q[0], pp[i][1] - q[1]) < 0.05) { pp.splice(i, 1); setPts(pp, true); return; }
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tcp-tabs [data-ch]"), function (b) { b.onclick = function () { chan = b.dataset.ch; drawCurve(); }; });
    $("tcpCurveReset").onclick = function () { var G = grade(), S = isHue(chan) ? G.hcurves : G.curves; if (S) delete S[chan]; commit(true); drawCurve(); };
  }

  /* ---------------- HSL secondaries */
  function paintHsl() {
    var L = $("tcpHsl"), list = grade().hsl || [];
    L.innerHTML = list.map(function (q, i) {
      var c = F().hslToRgb(q.hue, 1, 0.5).map(function (v) { return Math.round(v * 255); });
      var row = function (k, lab, mn, mx, st) { return '<div class="fx-row"><span>' + lab + '</span><input type="range" data-i="' + i + '" data-k="' + k + '" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + q[k] + '"><span class="fx-dim" data-v="' + i + k + '">' + q[k] + "</span></div>"; };
      return '<fieldset><legend><span class="tcp-sw" style="background:rgb(' + c.join(",") + ')"></span> range ' + (i + 1)
        + ' <button class="ghost" type="button" data-del="' + i + '">✕</button></legend>'
        + row("hue", "hue", 0, 360, 1) + row("width", "width", 10, 180, 1) + row("shift", "shift", -180, 180, 1) + row("sat", "sat", -100, 100, 1) + row("lum", "light", -100, 100, 1) + "</fieldset>";
    }).join("") || '<div class="fx-dim">No ranges - ＋ picks a hue range (skies, skin, foliage) and pushes only that.</div>';
    Array.prototype.forEach.call(L.querySelectorAll("input[data-k]"), function (r) {
      var upd = function (final) {
        var G = grade(); G.hsl = (G.hsl || []).map(function (q) { return Object.assign({}, q); });
        G.hsl[+r.dataset.i][r.dataset.k] = +r.value;
        var v = L.querySelector('[data-v="' + r.dataset.i + r.dataset.k + '"]'); if (v) v.textContent = r.value;
        // keep a range that is not doing anything yet (normalize drops it) while it is being set up
        var keep = G.hsl; commit(final); if (clip.fx && clip.fx.grade) clip.fx.grade.hsl = keep; else { grade().hsl = keep; }
        if (final && r.dataset.k === "hue") paintHsl();
      };
      r.addEventListener("input", function () { upd(false); });
      r.addEventListener("change", function () { upd(true); });
    });
    Array.prototype.forEach.call(L.querySelectorAll("[data-del]"), function (b) {
      b.onclick = function () { var G = grade(); G.hsl = (G.hsl || []).slice(); G.hsl.splice(+b.dataset.del, 1); commit(true); paintHsl(); };
    });
  }

  /* ---------------- 2.416.0: ◯ the mask */
  var MK = [["x", "centre ←→", -0.5, 1.5, 0.005, 100, "%"], ["y", "centre ↑↓", -0.5, 1.5, 0.005, 100, "%"], ["w", "width", 0.02, 2, 0.005, 100, "%"],
            ["h", "height", 0.02, 2, 0.005, 100, "%"], ["rot", "rotation", -180, 180, 1, 1, "°"], ["feather", "feather", 0, 0.5, 0.005, 100, "%"]];
  function mask() { return clip && clip.fx && clip.fx.mask || null; }
  function tauNow() { var t = (TlCanvas.state && TlCanvas.state.t) || 0; return t - (+clip.start || 0); }
  function paintMask() {
    var M = $("tcpMask"); if (!M) return;
    var m = mask(), sh = m ? m.shape : "";
    var at = m ? F().maskAt(m, Math.max(0, tauNow())) : null;
    M.innerHTML = '<div class="fx-row"><select id="tcpMaskShape" title="The look (the grade + the effects after it) only inside this shape">'
      + [["", "no mask - the whole picture"], ["ellipse", "◯ ellipse"], ["rect", "▭ box"]].map(function (o) { return '<option value="' + o[0] + '"' + (sh === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>"
      + (m ? '<label title="The look OUTSIDE the shape instead"><input type="checkbox" id="tcpMaskInv"' + (m.invert ? " checked" : "") + "> invert</label>" : "") + "</div>"
      + (m ? MK.map(function (k) {
          var v = (k[0] === "x" || k[0] === "y") && at ? at[k[0]] : m[k[0]];
          return '<div class="fx-row"><span style="min-width:70px">' + k[1] + '</span><input type="range" data-mk="' + k[0] + '" min="' + k[2] + '" max="' + k[3] + '" step="' + k[4] + '" value="' + v + '" style="flex:1">'
            + '<span class="fx-dim" data-mkv="' + k[0] + '" style="min-width:44px">' + Math.round(v * k[5]) + k[6] + "</span></div>";
        }).join("")
        + '<div class="fx-row"><button type="button" id="tcpMaskTrack"' + (clip.adjust ? " disabled" : "") + ' title="Follow what the mask sits on - from the position marker to the clip\'s end">🎯 Track</button>'
        + '<button type="button" class="ghost" id="tcpMaskUntrack"' + (m.track ? "" : " disabled") + ' title="The mask stays where it is (no track)">✕ track</button>'
        + '<span class="fx-dim" id="tcpMaskMsg">' + (m.track ? "tracked: " + m.track.length + " samples" : "") + "</span></div>" : "");
    $("tcpMaskShape").onchange = function () {
      var v = $("tcpMaskShape").value; clip.fx = clip.fx || {};
      if (!v) delete clip.fx.mask;
      else clip.fx.mask = Object.assign({ x: 0.5, y: 0.5, w: 0.5, h: 0.5, rot: 0, feather: 0.06 }, clip.fx.mask || {}, { shape: v });
      commit(true); paintMask();
    };
    if (!m) return;
    $("tcpMaskInv").onchange = function () { clip.fx.mask.invert = $("tcpMaskInv").checked; commit(true); };
    Array.prototype.forEach.call(M.querySelectorAll("[data-mk]"), function (r) {
      var k = MK.find(function (q) { return q[0] === r.dataset.mk; });
      var set = function (final) {
        var mm = clip.fx.mask, v = +r.value;
        if ((k[0] === "x" || k[0] === "y") && mm.track && mm.track.length) {
          // a tracked mask moved: the whole track shifts by the same (it keeps following, offset)
          var cur = F().maskAt(mm, Math.max(0, tauNow()))[k[0]], d = v - cur;
          mm.track.forEach(function (q) { q[k[0]] = q[k[0]] + d; });
        } else mm[k[0]] = v;
        M.querySelector('[data-mkv="' + k[0] + '"]').textContent = Math.round(v * k[5]) + k[6];
        commit(final);
      };
      r.addEventListener("input", function () { set(false); });
      r.addEventListener("change", function () { set(true); });
    });
    $("tcpMaskUntrack").onclick = function () { var at2 = F().maskAt(clip.fx.mask, Math.max(0, tauNow())); delete clip.fx.mask.track; clip.fx.mask.x = at2.x; clip.fx.mask.y = at2.y; commit(true); paintMask(); };
    $("tcpMaskTrack").onclick = function () { track(); };
  }
  /** 🎯: from the clip's frame at the position marker to its end; the answer (source seconds) into seconds into the clip */
  function track() {
    var c = clip, m = c.fx.mask, L = F().clipLen(c) || 0, loc = Math.max(0, Math.min(L, tauNow()));
    if (loc >= L - 0.05) { $("tcpMaskMsg").textContent = "Put the position marker on the clip where the mask sits right, then 🎯."; return; }
    var a = F().srcTime(c, loc), b = F().srcTime(c, L - 1e-3), at = F().maskAt(m, loc);
    $("tcpMaskTrack").disabled = true; $("tcpMaskMsg").textContent = "Tracking…";
    fetch("/api/clipfx/track", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: c.name, from: Math.min(a, b), to: Math.max(a, b), x: at.x, y: at.y, w: Math.min(1, m.w), h: Math.min(1, m.h) }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); })
      .then(function (j) {
        if (clip !== c) return;
        var full = Object.assign({}, c, { out: c.out != null ? c.out : c.dur }), pts = [];
        (j.track || []).forEach(function (q) { var tau = F().localTime(full, q.t); if (tau != null) pts.push({ at: Math.round(tau * 10000) / 10000, x: q.x, y: q.y }); });
        var keep = (m.track || []).filter(function (q) { return q.at < loc - 1e-3; });
        c.fx.mask.track = keep.concat(pts).sort(function (p1, p2) { return p1.at - p2.at; });
        commit(true); paintMask();
        $("tcpMaskMsg").textContent = "tracked " + pts.length + " samples (" + j.method + ")" + (j.gaps && j.gaps.length ? " - lost for a moment " + j.gaps.length + "×, held there" : "");
        if (typeof logLine === "function") logLine("[colour] mask tracked on " + c.name + ": " + pts.length + " samples");
      })
      .catch(function (e) { if ($("tcpMaskMsg")) $("tcpMaskMsg").textContent = "⚠ " + (e.message || e); })
      .then(function () { if ($("tcpMaskTrack")) $("tcpMaskTrack").disabled = false; });
  }
  /** the mask's outline on the canvas (screen coordinates; the clip's own picture box, or the frame for an adjustment) */
  function outline(ctx, o) {
    if (!dlg || !dlg.isOpen() || !clip || !clip.fx || !clip.fx.mask) return;
    var m = F().normMask(clip.fx.mask); if (!m) return;
    var tau = tauNow(), at = F().maskAt(m, tau), b;
    if (clip.adjust) b = { cx: o.W / 2, cy: o.H / 2, w: o.W, h: o.H, rot: 0 };
    else { var L = TlCanvas.layerOf(clip); b = L && TlCanvas.box(clip, L.kind, TlCanvas.state.t); }
    if (!b) return;
    var r = m.rot * Math.PI / 180, br = (b.rot || 0) * Math.PI / 180, pts = [];
    for (var i = 0; i <= 64; i++) {
      var u = i / 64 * Math.PI * 2, lx, ly;
      if (m.shape === "rect") { var q = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]][Math.min(4, Math.floor(i / 16))], q2 = [[1, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]][Math.min(4, Math.floor(i / 16))], f = (i % 16) / 16;
        lx = (q[0] + (q2[0] - q[0]) * f) * m.w / 2; ly = (q[1] + (q2[1] - q[1]) * f) * m.h / 2; }
      else { lx = Math.cos(u) * m.w / 2; ly = Math.sin(u) * m.h / 2; }
      var px = (at.x + lx * Math.cos(r) - ly * Math.sin(r) - 0.5) * b.w, py = (at.y + lx * Math.sin(r) + ly * Math.cos(r) - 0.5) * b.h * (1);
      var sx = b.cx + px * Math.cos(br) - py * Math.sin(br), sy = b.cy + px * Math.sin(br) + py * Math.cos(br);
      pts.push(o.toScreen(sx, sy));
    }
    ctx.save(); ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = "#f59e2c"; ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
    var ct = o.toScreen(b.cx + ((at.x - 0.5) * b.w) * Math.cos(br) - ((at.y - 0.5) * b.h) * Math.sin(br), b.cy + ((at.x - 0.5) * b.w) * Math.sin(br) + ((at.y - 0.5) * b.h) * Math.cos(br));
    ctx.setLineDash([]); ctx.beginPath(); ctx.arc(ct.x, ct.y, 3, 0, 7); ctx.stroke(); ctx.restore();
  }

  /* ---------------- 2.415.0: 🎯 match */
  function videoClips() {
    var out = [];
    (tl.video || []).forEach(function (c) { if (c && !c.m3d) out.push({ c: c, where: "V1" }); });
    (tl.vlayers || []).forEach(function (L, i) { ((L && L.clips) || []).forEach(function (c) { if (c && !c.m3d && !c.text) out.push({ c: c, where: L.name || "V" + (i + 2) }); }); });
    return out;
  }
  /** the source second to sample: the clip's frame at the position marker when it is there, else its middle */
  function atOf(c) {
    var t = (TlCanvas.state && TlCanvas.state.t) || 0, L = F().clipLen(c) || 0, loc = t - (+c.start || 0);
    if (!(loc >= 0 && loc < L)) loc = L / 2;
    return F().srcTime(c, loc);
  }
  function paintMatch() {
    var M = $("tcpMatch"); if (!M) return;
    var others = videoClips().filter(function (x) { return x.c !== clip; });
    M.innerHTML = others.length
      ? '<div class="fx-row"><select id="tcpMatchRef" style="max-width:260px">' + others.map(function (x, i) {
          return '<option value="' + i + '">' + String(x.c.name).replace(/</g, "&lt;") + " · " + String(x.where).replace(/</g, "&lt;") + " · " + (+x.c.start || 0).toFixed(2) + " s</option>"; }).join("") + "</select>"
        + '<label title="How far toward the other clip">strength <input type="range" id="tcpMatchK" min="10" max="100" step="5" value="100" style="width:70px"></label>'
        + '<button type="button" id="tcpMatchGo" title="Set this clip\'s R / G / B curves so its tones match the other clip">🎯 Match</button></div><div class="fx-dim" id="tcpMatchMsg"></div>'
      : '<div class="fx-dim">Put another video clip on the timeline to match this one to it.</div>';
    if (!others.length) return;
    $("tcpMatchGo").onclick = function () {
      var ref = others[+$("tcpMatchRef").value].c, me = clip;
      $("tcpMatchGo").disabled = true; $("tcpMatchMsg").textContent = "Matching…";
      fetch("/api/clipfx/colourmatch", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clip: { name: me.name, at: atOf(me), fx: me.fx || null }, ref: { name: ref.name, at: atOf(ref), fx: ref.fx || null }, strength: +$("tcpMatchK").value }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); })
        .then(function (j) {
          if (clip !== me) return;
          var G = grade(), cu = Object.assign({}, G.curves || {}, j.curves); delete cu.m; G.curves = cu;
          commit(true); chan = "r"; drawCurve();
          var sw = function (c) { return '<span class="tcp-sw" style="background:rgb(' + c.map(Math.round).join(",") + ')"></span>'; };
          $("tcpMatchMsg").innerHTML = "Matched to " + String(ref.name).replace(/</g, "&lt;") + " (" + j.strength + " %): " + sw(j.before) + " was → " + sw(j.after) + " now · the other clip " + sw(j.target)
            + " - the R / G / B curves hold it (tweak them; reset to undo).";
          if (typeof logLine === "function") logLine("[colour] " + me.name + " matched to " + ref.name + " (" + j.strength + " %)");
        })
        .catch(function (e) { $("tcpMatchMsg").textContent = "⚠ " + (e.message || e); })
        .then(function () { if ($("tcpMatchGo")) $("tcpMatchGo").disabled = false; });
    };
  }

  /* ---------------- scopes */
  var off = null;
  function frame() {
    var S = TlCanvas.state, W = 192, H = Math.max(1, Math.round(W * S.H / S.W));
    if (!off) off = document.createElement("canvas");
    off.width = W; off.height = H;
    var g = off.getContext("2d", { willReadFrequently: true });
    g.save(); g.scale(W / S.W, H / S.H);
    try { TlCanvas.paintComp(g, S.t); } catch (e) { /* not ready */ }
    g.restore();
    return { d: g.getImageData(0, 0, W, H).data, W: W, H: H };
  }
  function drawScope() {
    var cv = $("tcpScope"); if (!cv || !dlg || !dlg.isOpen()) return;
    var f = frame(), d = f.d, g = cv.getContext("2d"), W = cv.width, H = cv.height;
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    var img = g.getImageData(0, 0, W, H), o = img.data;
    var add = function (x, y, r, gg, b) { x = x | 0; y = y | 0; if (x < 0 || y < 0 || x >= W || y >= H) return; var i = (y * W + x) * 4; o[i] = Math.min(255, o[i] + r); o[i + 1] = Math.min(255, o[i + 1] + gg); o[i + 2] = Math.min(255, o[i + 2] + b); o[i + 3] = 255; };
    var px, i;
    if (scope === "waveform" || scope === "parade") {
      for (px = 0; px < d.length; px += 4) {
        var col = (px / 4) % f.W, R = d[px], G = d[px + 1], B = d[px + 2];
        if (scope === "waveform") { var Y = 0.2126 * R + 0.7152 * G + 0.0722 * B; add(col / f.W * W, H - 1 - Y / 255 * (H - 1), 30, 60, 30); }
        else { var w3 = W / 3; add(col / f.W * w3, H - 1 - R / 255 * (H - 1), 70, 10, 10); add(w3 + col / f.W * w3, H - 1 - G / 255 * (H - 1), 10, 70, 10); add(2 * w3 + col / f.W * w3, H - 1 - B / 255 * (H - 1), 10, 10, 70); }
      }
    } else if (scope === "vectorscope") {
      var cx = W / 2, cy = H / 2, rad = H / 2 - 4;
      for (px = 0; px < d.length; px += 4) {
        var r = d[px] / 255, gg = d[px + 1] / 255, b = d[px + 2] / 255;
        var cb = -0.1146 * r - 0.3854 * gg + 0.5 * b, cr = 0.5 * r - 0.4542 * gg - 0.0458 * b;
        add(cx + cb * 2 * rad, cy - cr * 2 * rad, 40, 60, 40);
      }
    } else {
      var hist = [new Array(256).fill(0), new Array(256).fill(0), new Array(256).fill(0)], mx = 1;
      for (px = 0; px < d.length; px += 4) for (i = 0; i < 3; i++) { var hv = ++hist[i][d[px + i]]; if (hv > mx) mx = hv; }
      for (i = 0; i < 256; i++) for (var c = 0; c < 3; c++) {
        var hgt = Math.round(Math.sqrt(hist[c][i] / mx) * (H - 2)), x0 = Math.floor(i / 256 * W);
        for (var yy = 0; yy < hgt; yy++) add(x0, H - 1 - yy, c === 0 ? 90 : 0, c === 1 ? 90 : 0, c === 2 ? 90 : 0);
      }
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1;
    if (scope === "vectorscope") { g.beginPath(); g.arc(W / 2, H / 2, H / 2 - 4, 0, 7); g.stroke(); g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(W / 2 + Math.cos(-2.18) * (H / 2 - 4), H / 2 + Math.sin(-2.18) * (H / 2 - 4)); g.stroke(); }
    else if (scope !== "histogram") { [0.25, 0.5, 0.75].forEach(function (v) { g.beginPath(); g.moveTo(0, H * v); g.lineTo(W, H * v); g.stroke(); }); }
    $("tcpScope").dataset.drawn = String((+$("tcpScope").dataset.drawn || 0) + 1);
  }

  function paint() {
    css();
    clip = sel();
    var B = dlg.body;
    if (!clip) { B.innerHTML = '<div class="fx-dim">Select a video clip (V1 or a video layer) on the timeline canvas, then open 🎨 again.</div>'; return; }
    B.innerHTML = '<div class="fx-dim" style="margin-bottom:6px">' + String(clip.name).replace(/</g, "&lt;") + "</div>"
      + '<div class="tcp-grid"><div>'
      + '<fieldset><legend>Wheels <button class="ghost" type="button" id="tcpWReset">reset</button></legend><div class="tcp-wheels">'
      + ["lift", "gamma", "gain"].map(function (k) {
        return '<div class="tcp-wheel"><canvas id="tcpW_' + k + '" width="110" height="110" title="Drag the puck toward a colour; double-click centres it"></canvas><br>'
          + (k === "lift" ? "Lift (shadows)" : k === "gamma" ? "Gamma (mids)" : "Gain (highlights)")
          + '<br><input type="range" id="tcpL_' + k + '" min="-1" max="1" step="0.01" title="Darker / brighter"></div>';
      }).join("") + "</div></fieldset>"
      + '<fieldset><legend>Curves <span class="tcp-tabs"><button class="ghost" type="button" data-ch="m">Master</button><button class="ghost" type="button" data-ch="r">R</button>'
      + '<button class="ghost" type="button" data-ch="g">G</button><button class="ghost" type="button" data-ch="b">B</button>'
      + '<button class="ghost" type="button" data-ch="hh" title="Hue vs hue: move one colour toward another (up = later on the wheel)">H/H</button>'
      + '<button class="ghost" type="button" data-ch="hs" title="Hue vs saturation: more or less of one colour (up = richer, down = grey)">H/S</button></span> <button class="ghost" type="button" id="tcpCurveReset">reset</button></legend>'
      + '<canvas id="tcpCurve" width="240" height="180" title="Click adds a point, drag moves it, double-click removes it"></canvas></fieldset>'
      + '<fieldset class="tcp-hsl"><legend>HSL secondaries <button class="ghost" type="button" id="tcpHslAdd">＋</button></legend><div id="tcpHsl"></div></fieldset>'
      + "</div><div>"
      + '<fieldset><legend>◯ Mask (power window)</legend><div id="tcpMask"></div></fieldset>'
      + '<fieldset><legend>🎯 Match to another clip</legend><div id="tcpMatch"></div></fieldset>'
      + '<fieldset><legend>Scopes <select id="tcpScopeSel"><option value="waveform">waveform</option><option value="parade">RGB parade</option>'
      + '<option value="vectorscope">vectorscope</option><option value="histogram">histogram</option></select></legend>'
      + '<canvas id="tcpScope" width="320" height="200"></canvas><div class="fx-dim">The picture at the position marker, as the movie gets it.</div></fieldset>'
      + "</div></div>";
    ["lift", "gamma", "gain"].forEach(wireWheel);
    $("tcpWReset").onclick = function () { delete grade().wheels; commit(true); ["lift", "gamma", "gain"].forEach(function (k) { drawWheel($("tcpW_" + k), { x: 0, y: 0 }); $("tcpL_" + k).value = 0; }); };
    wireCurve(); drawCurve();
    paintHsl(); paintMatch(); paintMask();
    $("tcpHslAdd").onclick = function () { var G = grade(); G.hsl = (G.hsl || []).concat([{ hue: 210, width: 50, shift: 0, sat: 0, lum: 0 }]); paintHsl(); };
    $("tcpScopeSel").value = scope;
    $("tcpScopeSel").onchange = function () { scope = $("tcpScopeSel").value; drawScope(); };
    drawScope();
  }
  function open() {
    if (!dlg) dlg = TlDlg.make({ id: "tlColourDlg", title: "Colour", width: 760, onClose: function () { clearInterval(timer); timer = 0; if (TlCanvas.paintProps) TlCanvas.paintProps(); } });
    paint(); dlg.open();
    clearInterval(timer); timer = setInterval(drawScope, 250);
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlColourBtn", "🎨", "Colour: wheels, curves, HSL, mask, match, scopes", open);
    if (TlCanvas.onDraw) TlCanvas.onDraw(outline);             // 2.416.0: the mask's outline while this panel is open
  }
  window.TlColour = { open: open, drawScope: drawScope, refresh: function () { if (dlg && dlg.isOpen() && sel() !== clip) paint(); } };
  boot();
})();
