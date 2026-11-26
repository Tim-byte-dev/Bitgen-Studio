/* bitGen Studio 2.969.0 — the Timeline docker's 🎛 DECK: a hardware-style controller beside the layers (tldeck.css).
 *
 * Tim: "can you add knobs and sliders and slide wheels like and jog wheels? for a cool aesthetic?" - every control works:
 *   LCD          the position (H:MM:SS:FF), playing / shuttling / stopped, the zoom
 *   keys         ⏮ ◀◀ ■ ▶ ▶▶ ⏭ (the canvas transport: TlCanvas go / shuttle / stop / play / pause, #tlCEnd)
 *   JOG          turn the middle of the wheel: a frame per 15° notch (TlCanvas.step); the mouse wheel / ← → too, Shift = 10
 *   SHUTTLE      hold the outer ring left or right: 1x, 2x, 4x, 8x backwards / forwards; let go and it springs back to stop
 *   ZOOM wheel   rolls the timeline's zoom (#tlZoom - the same 0..100 as its slider)
 *   SPEED wheel  a notch at a time through 0.125x .. 8x - what ▶ / Space play at (#tlCSpeed, tlranges.js)
 *   knobs        the picked layer's OPACITY (not audio layers), FADE IN and FADE OUT (its transitions' length; all the
 *                way down = a cut - a fade is used when it had none)
 *   fader        the picked layer's VOLUME (not image layers); 0 = muted
 * The knobs and the fader write the layer the same way its header's ◐ / 🔊 / ⇥ / ⇤ do (L.opacity, L.volume + L.muted,
 * L.transitionIn / Out through trNorm) and save once you let go. The DECK tab at the layers' left edge shows / hides it
 * (h3.tl.deck; never a menu-bar button - one more there can wrap the bar onto another row and push the layers down);
 * when the docker is short the deck's three sections go side by side (data-cols 2 / 3) instead of scrolling.
 * window.TlDeck = { show(on), shown(), info(), jog(n), shuttle(rate), zoom(v), speed(i), set(k, v), layout() } (tests)
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var deck = $("tlDeck"), row = $("tlDeckRow");
  if (!deck || !row) return;
  var FPS = typeof TLFPS === "number" ? TLFPS : 24;
  var RATES = [0.125, 0.25, 0.5, 1, 2, 4, 8], SHUT = [1, 2, 4, 8];
  var LSK = "h3.tl.deck";
  var G = { jogA: 0, jogAcc: 0, shut: 0, shutA: 0, shutting: false, zoomAcc: 0, speedAcc: 0, sig: "", last: 0, saveT: 0 };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var cv = function () { return window.TlCanvas && TlCanvas.state ? TlCanvas : null; };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };

  /* ---------------- the position, the transport ---------------- */
  function now() { var c = cv(); if (c && c.state.playing) return c.state.t || 0; return typeof playhead === "number" && isFinite(playhead) ? playhead : 0; }
  function tc(t) { var f = Math.max(0, Math.round(t * FPS)), s = Math.floor(f / FPS); return Math.floor(s / 3600) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60) + ":" + pad(f % FPS); }
  function seek(t) { var c = cv(); if (c) { c.pause(); c.go(Math.max(0, t)); } else if (typeof tlSeek === "function") tlSeek(t); }
  /** n frames on (the jog) - paused */
  function jog(n) {
    var c = cv();
    if (c && c.step) return c.step(n);
    if (typeof tlSeek === "function") return tlSeek(now() + n / FPS);
    return now();
  }
  /** the shuttle ring: 0 = stop (only what the ring started), else play at that rate (-8 .. 8) */
  function shuttle(rate) {
    var c = cv(); if (!c) return 0;
    rate = rate ? clamp(rate, -8, 8) : 0;
    if (!rate) { if (G.shutting) c.pause(); G.shutting = false; G.shut = 0; return 0; }
    if (c.state.playing && c.state.rate === rate) { G.shut = rate; return rate; }
    if (c.state.playing) c.pause();
    c.play(rate); G.shutting = true; G.shut = rate;
    return rate;
  }
  function wireKeys() {
    var k = function (id, fn) { var b = $(id); if (b) b.addEventListener("click", function () { fn(); paint(true); }); };
    k("tlDeckStart", function () { seek(0); });
    k("tlDeckRew", function () { var c = cv(); if (c) c.shuttle(-1); });
    k("tlDeckStop", function () { var c = cv(); if (c) c.stop(); });
    k("tlDeckPlay", function () { var c = cv(); if (!c) return; if (c.state.playing) c.pause(); else c.play(); });
    k("tlDeckFwd", function () { var c = cv(); if (c) c.shuttle(1); });
    k("tlDeckEnd", function () { var e = $("tlCEnd"); if (e) e.click(); });
  }

  /* ---------------- drawing ---------------- */
  function fit(c) {
    var r = window.devicePixelRatio || 1, w = c.clientWidth || +c.getAttribute("width"), h = c.clientHeight || +c.getAttribute("height");
    if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); }
    var x = c.getContext("2d"); x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, w, h);
    return { x: x, w: w, h: h };
  }
  var A0 = Math.PI * 0.75, A1 = Math.PI * 2.25;
  function drawKnob(c, v, col, live) {
    var f = fit(c), x = f.x, m = f.w / 2, r = m - 4;
    x.lineCap = "round";
    x.lineWidth = 3; x.strokeStyle = "#23272f"; x.beginPath(); x.arc(m, m, r, A0, A1); x.stroke();
    if (live && v > 0.001) { x.save(); x.shadowColor = col; x.shadowBlur = 7; x.strokeStyle = col; x.beginPath(); x.arc(m, m, r, A0, A0 + (A1 - A0) * v); x.stroke(); x.restore(); }
    for (var i = 0; i <= 10; i++) { var a = A0 + (A1 - A0) * i / 10; x.strokeStyle = "#3a404c"; x.lineWidth = 1; x.beginPath(); x.moveTo(m + Math.cos(a) * (r + 2.5), m + Math.sin(a) * (r + 2.5)); x.lineTo(m + Math.cos(a) * (r + 4), m + Math.sin(a) * (r + 4)); x.stroke(); }
    var g = x.createRadialGradient(m - 4, m - 5, 2, m, m, r - 5);
    g.addColorStop(0, "#4a4f5a"); g.addColorStop(0.7, "#22252c"); g.addColorStop(1, "#121418");
    x.fillStyle = g; x.beginPath(); x.arc(m, m, r - 5, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#000"; x.lineWidth = 1; x.stroke();
    var p = A0 + (A1 - A0) * v;
    x.lineWidth = 2.5; x.strokeStyle = live ? "#fff" : "#6c7688";
    x.beginPath(); x.moveTo(m + Math.cos(p) * 4, m + Math.sin(p) * 4); x.lineTo(m + Math.cos(p) * (r - 8), m + Math.sin(p) * (r - 8)); x.stroke();
  }
  /** a slide wheel (like a keyboard's pitch / mod wheel): ridges that roll with `off`, a lit mark at `mark` (0..1) */
  function drawWheel(c, off, col, mark) {
    var f = fit(c), x = f.x, w = f.w, h = f.h;
    x.fillStyle = "#050608"; x.fillRect(0, 0, w, h);
    var g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#0c0d10"); g.addColorStop(0.3, "#3c4049"); g.addColorStop(0.5, "#565b66"); g.addColorStop(0.7, "#3c4049"); g.addColorStop(1, "#0c0d10");
    x.fillStyle = g; x.fillRect(3, 2, w - 6, h - 4);
    for (var y = ((off % 7) + 7) % 7; y < h; y += 7) {                     // the ridges, squeezed toward the ends (a cylinder)
      var k = (y - h / 2) / (h / 2), yy = h / 2 + Math.sin(k * Math.PI / 2) * (h / 2 - 2);
      x.strokeStyle = "rgba(0,0,0," + (0.55 + Math.abs(k) * 0.35) + ")"; x.lineWidth = 1.2 - Math.abs(k) * 0.6;
      x.beginPath(); x.moveTo(4, yy); x.lineTo(w - 4, yy); x.stroke();
    }
    var sh = x.createLinearGradient(0, 0, 0, h);
    sh.addColorStop(0, "rgba(0,0,0,.75)"); sh.addColorStop(0.18, "rgba(0,0,0,0)"); sh.addColorStop(0.82, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.75)");
    x.fillStyle = sh; x.fillRect(0, 0, w, h);
    if (mark != null) {
      var my = h - 6 - mark * (h - 12);
      x.save(); x.shadowColor = col; x.shadowBlur = 8; x.fillStyle = col; x.fillRect(4, my - 1.5, w - 8, 3); x.restore();
    }
  }
  function drawJog() {
    var c = $("tlDeckJog"); if (!c) return;
    var f = fit(c), x = f.x, m = f.w / 2, R = m - 2, c2 = cv(), playing = !!(c2 && c2.state.playing);
    // the shuttle ring
    var g = x.createRadialGradient(m, m, R - 16, m, m, R);
    g.addColorStop(0, "#1a1c21"); g.addColorStop(0.5, "#2b2e35"); g.addColorStop(1, "#14161a");
    x.fillStyle = g; x.beginPath(); x.arc(m, m, R, 0, Math.PI * 2); x.fill();
    for (var i = -4; i <= 4; i++) {                                          // the speed marks: 0 at the top, 1 2 4 8 each way
      var a = -Math.PI / 2 + i * (Math.PI * 0.75 / 4), lit = G.shut && Math.sign(i) === Math.sign(G.shut) && Math.abs(i) === SHUT.indexOf(Math.abs(G.shut)) + 1;
      x.strokeStyle = lit ? "#ffa63d" : i === 0 ? "#5dff8a" : "#4a505c"; x.lineWidth = lit ? 3 : 2;
      if (lit) { x.save(); x.shadowColor = "#ffa63d"; x.shadowBlur = 8; }
      x.beginPath(); x.moveTo(m + Math.cos(a) * (R - 3), m + Math.sin(a) * (R - 3)); x.lineTo(m + Math.cos(a) * (R - 10), m + Math.sin(a) * (R - 10)); x.stroke();
      if (lit) x.restore();
    }
    // the ring's grip, where the shuttle sits
    var sa = -Math.PI / 2 + G.shutA;
    x.fillStyle = G.shut ? "#ffa63d" : "#8d939e";
    x.beginPath(); x.arc(m + Math.cos(sa) * (R - 7), m + Math.sin(sa) * (R - 7), 3.2, 0, Math.PI * 2); x.fill();
    // the jog disc
    var r = R - 17;
    x.fillStyle = "#000"; x.beginPath(); x.arc(m, m, r + 1.5, 0, Math.PI * 2); x.fill();
    var d = x.createRadialGradient(m - r * 0.3, m - r * 0.4, 4, m, m, r);
    d.addColorStop(0, "#4b505b"); d.addColorStop(0.6, "#23262d"); d.addColorStop(1, "#15171b");
    x.fillStyle = d; x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "rgba(255,255,255,.06)"; x.lineWidth = 1;
    for (var k = 0; k < 48; k++) { var b = G.jogA + k * Math.PI * 2 / 48; x.beginPath(); x.moveTo(m + Math.cos(b) * (r - 10), m + Math.sin(b) * (r - 10)); x.lineTo(m + Math.cos(b) * (r - 2), m + Math.sin(b) * (r - 2)); x.stroke(); }
    // the finger dimple
    var da = G.jogA - Math.PI / 2, dx = m + Math.cos(da) * (r - 14), dy = m + Math.sin(da) * (r - 14);
    var dg = x.createRadialGradient(dx + 1, dy + 1, 1, dx, dy, 7);
    dg.addColorStop(0, "#0b0c0f"); dg.addColorStop(1, "#2e323a");
    x.fillStyle = dg; x.beginPath(); x.arc(dx, dy, 7, 0, Math.PI * 2); x.fill();
    // the hub: lit while something plays
    x.save(); if (playing) { x.shadowColor = G.shut < 0 ? "#ffa63d" : "#38e1ff"; x.shadowBlur = 12; }
    x.strokeStyle = playing ? (G.shut < 0 ? "#ffa63d" : "#38e1ff") : "#2d3340"; x.lineWidth = 2;
    x.beginPath(); x.arc(m, m, 12, 0, Math.PI * 2); x.stroke(); x.restore();
    x.fillStyle = "#0b0c0f"; x.beginPath(); x.arc(m, m, 10.5, 0, Math.PI * 2); x.fill();
  }

  /* ---------------- the jog wheel and the shuttle ring ---------------- */
  function wireJog() {
    var c = $("tlDeckJog"); if (!c) return;
    var mode = null, last = 0;
    var ang = function (e) { var b = c.getBoundingClientRect(); return Math.atan2(e.clientX - b.left - b.width / 2, -(e.clientY - b.top - b.height / 2)); };
    var dist = function (e) { var b = c.getBoundingClientRect(); return Math.hypot(e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2) / (b.width / 2); };
    var shutFrom = function (a) {                                            // the ring's angle -> a rate (the dead zone at the top = 0)
      var deg = a * 180 / Math.PI, s = Math.sign(deg), ad = Math.min(135, Math.abs(deg));
      if (ad < 15) return 0;
      return s * SHUT[Math.min(3, Math.floor((ad - 15) / 30))];
    };
    c.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); c.focus(); c.setPointerCapture(e.pointerId);
      mode = dist(e) > 0.76 ? "shuttle" : "jog"; last = ang(e); G.jogAcc = 0;
      if (mode === "shuttle") { G.shutA = clamp(last, -Math.PI * 0.75, Math.PI * 0.75); shuttle(shutFrom(last)); }
      paint(true);
    });
    c.addEventListener("pointermove", function (e) {
      if (!mode) return;
      var a = ang(e);
      if (mode === "shuttle") { G.shutA = clamp(a, -Math.PI * 0.75, Math.PI * 0.75); var r = shutFrom(a); if (r !== G.shut) shuttle(r); drawJog(); return; }
      var d = a - last; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      last = a; G.jogA += d; G.jogAcc += d;
      var notch = Math.PI / 12;                                                // 15° = a frame
      while (Math.abs(G.jogAcc) >= notch) { var n = Math.sign(G.jogAcc); jog(n); G.jogAcc -= n * notch; }
      paint(true);
    });
    var up = function () {
      if (mode === "shuttle") { shuttle(0); springBack(); }
      mode = null; paint(true);
    };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", function (e) { e.preventDefault(); var n = (e.deltaY > 0 ? 1 : -1) * (e.shiftKey ? 10 : 1); G.jogA += n * Math.PI / 12; jog(n); paint(true); }, { passive: false });
    c.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); var n = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1); G.jogA += n * Math.PI / 12; jog(n); paint(true); }
    });
  }
  function springBack() {                                                    // the ring returns to the top, eased
    var a0 = G.shutA, t0 = performance.now();
    (function step() {
      var k = Math.min(1, (performance.now() - t0) / 220);
      G.shutA = a0 * (1 - k) * (1 - k); drawJog();
      if (k < 1) requestAnimationFrame(step);
    })();
  }

  /* ---------------- the slide wheels ---------------- */
  function zoomV() { var z = $("tlZoom"); return z ? +z.value || 0 : 30; }
  function zoom(v) {
    var z = $("tlZoom"); if (!z) return 0;
    v = Math.round(clamp(v, +z.min || 0, +z.max || 100));
    if (+z.value !== v) { z.value = String(v); z.dispatchEvent(new Event("input", { bubbles: true })); }
    return v;
  }
  function speedI() {
    var s = $("tlCSpeed"), c = cv(), r = s ? +s.value : (c && c.state.prate) || 1;
    var i = RATES.indexOf(r); return i < 0 ? 3 : i;
  }
  function speed(i) {
    i = clamp(Math.round(i), 0, RATES.length - 1);
    var s = $("tlCSpeed"), c = cv();
    if (s) { if (s.value !== String(RATES[i])) { s.value = String(RATES[i]); s.dispatchEvent(new Event("change", { bubbles: true })); } }
    else if (c && c.setRate) c.setRate(RATES[i]);
    return RATES[i];
  }
  function wireWheel(id, o) {
    var c = $(id); if (!c) return;
    var y0 = null;
    c.addEventListener("pointerdown", function (e) { if (e.button !== 0) return; e.preventDefault(); c.focus(); c.setPointerCapture(e.pointerId); y0 = e.clientY; });
    c.addEventListener("pointermove", function (e) { if (y0 == null) return; var dy = y0 - e.clientY; y0 = e.clientY; o.roll(dy * (e.shiftKey ? 0.25 : 1)); paint(true); });
    var up = function () { y0 = null; if (o.end) o.end(); };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", function (e) { e.preventDefault(); o.notch(e.deltaY < 0 ? 1 : -1); paint(true); }, { passive: false });
    c.addEventListener("keydown", function (e) { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); o.notch(e.key === "ArrowUp" ? 1 : -1); paint(true); } });
    c.addEventListener("dblclick", function () { o.home(); paint(true); });
  }

  /* ---------------- the picked layer: knobs and the fader ---------------- */
  function lk() { return typeof tl === "object" && tl ? tl.selLayer || null : null; }
  function layer() { var k = lk(); if (!k || typeof lkLayer !== "function") return null; try { return lkLayer(k) || null; } catch (e) { return null; } }
  function kind(k) { return !k ? "" : k === "v1" || /^vl:/.test(k) ? "video" : /^a:/.test(k) ? "audio" : /^i:/.test(k) ? "image" : ""; }
  function trMax() { return (typeof TRCAT === "object" && TRCAT && TRCAT.max_duration) || 4; }
  function trMin() { return (typeof TRCAT === "object" && TRCAT && TRCAT.min_duration) || 0.08; }
  function trOf(L, key) { var t = typeof trNorm === "function" ? trNorm(L[key]) : (L[key] || { type: "none", dur: 0.5 }); var on = typeof trActive === "function" ? trActive(t) : t.type !== "none"; return { t: t, on: on }; }
  var CTL = {
    opacity: { col: "#38e1ff", has: function (k) { return kind(k) === "video" || kind(k) === "image"; }, get: function (L) { return L.opacity == null ? 1 : +L.opacity; },
               put: function (L, v) { L.opacity = Math.round(v * 100) / 100; var el = document.querySelector('#tlinner .tltrack[data-lk="' + lk() + '"]'); if (el) el.style.opacity = Math.max(0.25, L.opacity); },
               show: function (v) { return Math.round(v * 100) + "%"; }, def: 1 },
    fin: { col: "#5dff8a", has: function (k) { return !!kind(k); }, get: function (L) { var o = trOf(L, "transitionIn"); return o.on ? o.t.dur / trMax() : 0; },
           put: function (L, v) { putTr(L, "transitionIn", v); }, show: function (v) { return v * trMax() < trMin() ? "CUT" : (v * trMax()).toFixed(2) + " s"; }, def: 0 },
    fout: { col: "#ffa63d", has: function (k) { return !!kind(k); }, get: function (L) { var o = trOf(L, "transitionOut"); return o.on ? o.t.dur / trMax() : 0; },
            put: function (L, v) { putTr(L, "transitionOut", v); }, show: function (v) { return v * trMax() < trMin() ? "CUT" : (v * trMax()).toFixed(2) + " s"; }, def: 0 },
    volume: { col: "#38e1ff", has: function (k) { return kind(k) === "video" || kind(k) === "audio"; }, get: function (L) { return L.muted ? 0 : (L.volume == null ? 1 : +L.volume); },
              put: function (L, v) { L.volume = Math.round(v * 100) / 100; L.muted = L.volume === 0; }, show: function (v) { return v <= 0 ? "MUTE" : Math.round(v * 100) + "%"; }, def: 1 }
  };
  function putTr(L, key, v) {
    var o = trOf(L, key), dur = v * trMax();
    var raw = dur < trMin() ? { type: "none", dur: o.t.dur } : { type: o.on ? o.t.type : "fade", dur: dur };
    L[key] = typeof trNorm === "function" ? trNorm(raw) : raw;
  }
  /** a knob or the fader moved: write the layer now (the canvas redraws), save + redraw the layers when it settles */
  function set(k, v, settle) {
    var L = layer(), c = CTL[k]; if (!L || !c || !c.has(lk())) return null;
    v = clamp(v, 0, 1); c.put(L, v);
    try { if (window.TlCanvas && TlCanvas.mark) TlCanvas.mark(); } catch (e) { /* fine */ }
    paint(true);
    clearTimeout(G.saveT);
    var done = function () { try { if (typeof tlSave === "function") tlSave(); if (typeof renderTimeline === "function") renderTimeline(); } catch (e) { /* next save */ } };
    if (settle) done(); else G.saveT = setTimeout(done, 400);
    return c.get(L);
  }
  function wireCtl(el, k, sens) {
    if (!el) return;
    var y0 = null, v0 = 0;
    var cur = function () { var L = layer(); return L ? CTL[k].get(L) : 0; };
    el.addEventListener("pointerdown", function (e) { if (e.button !== 0 || !layer()) return; e.preventDefault(); el.setPointerCapture(e.pointerId); (el.focus || function () {}).call(el); y0 = e.clientY; v0 = cur(); });
    el.addEventListener("pointermove", function (e) { if (y0 == null) return; G.dragging = true; set(k, v0 + (y0 - e.clientY) / (e.shiftKey ? sens * 4 : sens), false); clearTimeout(G.saveT); });
    var up = function () { if (y0 == null) return; y0 = null; G.dragging = false; set(k, cur(), true); };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", function (e) { if (!layer()) return; e.preventDefault(); set(k, cur() + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.01 : 0.05), false); }, { passive: false });
    el.addEventListener("keydown", function (e) {
      var d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); e.stopPropagation(); set(k, cur() + d * (e.shiftKey ? 0.01 : 0.05), false); }
      else if (e.key === "Home" || e.key === "End") { e.preventDefault(); e.stopPropagation(); set(k, e.key === "End" ? 1 : 0, true); }
    });
    el.addEventListener("dblclick", function () { if (layer()) set(k, CTL[k].def, true); });
  }

  /* ---------------- painting ---------------- */
  function paint(force) {
    if (deck.hidden) return;
    var c = cv(), playing = !!(c && c.state.playing), rate = playing ? (c.state.rate || 1) : 0;
    var t = now(); $("tlDeckTc").textContent = tc(t);
    var st = $("tlDeckState");
    st.textContent = !playing ? "■ STOP" : (rate < 0 ? "◀ " : "▶ ") + (Math.abs(rate) === 1 ? "PLAY" : Math.abs(rate) + "×");
    st.className = !playing ? "" : rate < 0 ? "back" : "play";
    $("tlDeckZoomV").textContent = "ZOOM " + zoomV();
    var pb = $("tlDeckPlay"); pb.textContent = playing ? "⏸" : "▶"; pb.classList.toggle("on", playing && rate > 0);
    $("tlDeckRew").classList.toggle("on", playing && rate < 0);
    $("tlDeckFwd").classList.toggle("on", playing && rate > 1);
    $("tlDeckSpeedV").textContent = RATES[speedI()] + "×";
    drawJog();
    drawWheel($("tlDeckZoom"), zoomV() * 1.5, "#38e1ff", zoomV() / 100);
    drawWheel($("tlDeckSpeed"), speedI() * 7, "#ffa63d", speedI() / (RATES.length - 1));
    // the picked layer
    var k = lk(), L = layer(), sig = k + "|" + (L ? [L.name, L.opacity, L.volume, L.muted, JSON.stringify(L.transitionIn || ""), JSON.stringify(L.transitionOut || ""), L.hue].join("|") : "");
    if (!force && sig === G.sig) return;
    G.sig = sig;
    var nm = $("tlDeckLayer");
    nm.classList.toggle("none", !L);
    var lab = typeof lkLabel === "function" ? String(lkLabel(k)) : k;
    nm.textContent = L ? lab + (L.name && L.name.toLowerCase() !== lab.toLowerCase() && L.name !== k ? " · " + L.name : "") : "no layer picked - click a layer";
    var h = L && Number.isFinite(L.hue) ? L.hue : null;
    nm.style.setProperty("--tdk-lc", h == null ? "#38e1ff" : "hsl(" + h + " 58% 56%)");
    Array.prototype.forEach.call(deck.querySelectorAll(".tdk-knob"), function (el) {
      var key = el.dataset.k, cfg = CTL[key], live = !!(L && cfg.has(k)), v = live ? cfg.get(L) : 0;
      el.classList.toggle("off", !live);
      var cnv = el.querySelector("canvas"); drawKnob(cnv, v, cfg.col, live);
      cnv.setAttribute("aria-valuenow", String(Math.round(v * 100))); cnv.setAttribute("aria-valuetext", live ? cfg.show(v) : "-");
      el.querySelector(".tdk-val").textContent = live ? cfg.show(v) : "-";
    });
    var fd = deck.querySelector(".tdk-fader"), fl = !!(L && CTL.volume.has(k)), fv = fl ? CTL.volume.get(L) : 0;
    fd.classList.toggle("off", !fl);
    var slot = fd.querySelector(".tdk-slot"), sh = slot.clientHeight || 86;
    fd.querySelector(".tdk-cap").style.top = ((1 - fv) * sh) + "px";
    fd.querySelector(".tdk-fill").style.height = Math.max(0, fv * (sh - 4)) + "px";
    fd.setAttribute("aria-valuenow", String(Math.round(fv * 100))); fd.setAttribute("aria-valuetext", fl ? CTL.volume.show(fv) : "-");
    fd.querySelector(".tdk-val").textContent = fl ? CTL.volume.show(fv) : "-";
  }
  function loop() {
    requestAnimationFrame(loop);
    var n = performance.now(); if (n - G.last < 66) return; G.last = n;        // ~15 times a second is plenty for an LCD
    if (deck.hidden || !deck.offsetParent) return;                            // hidden, or the docker folded / gone
    paint(false);
  }

  /* ---------------- show / hide, columns ---------------- */
  function show(on) {
    on = on == null ? deck.hidden : !!on;
    deck.hidden = !on;
    try { localStorage.setItem(LSK, on ? "1" : "0"); } catch (e) { /* fine */ }
    var b = $("tlDeckTog"); if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    if (on) { layout(); paint(true); } else space();
    return on;
  }
  function shown() { return !deck.hidden; }
  /** one column when the docker is tall enough for all three sections, else 2 or 3 side by side - but the layers come
   *  first: more columns only while the deck stays within 40% of the row, and when the layers would be left under
   *  ROOM px wide (or the row is under MINH px tall) the deck steps aside (data-squeezed; 🎛 says so) until there is room */
  var COLW = 242, ROOM = 520, MINH = 120;                                     // MINH: under it not even the jog wheel fits
  function layout() {
    if (deck.hidden) return 0;
    var secs = deck.querySelectorAll(".tdk-sec"); if (secs.length < 3) return 1;
    if (!row.offsetParent) return 0;                                         // the docker is folded / gone: next time
    var w = row.clientWidth, h = row.clientHeight, squeezed = w - COLW - 6 < ROOM || h < MINH;
    if (squeezed !== (deck.dataset.squeezed === "1")) {
      if (squeezed) deck.dataset.squeezed = "1"; else delete deck.dataset.squeezed;
      var b = $("tlDeckTog"); if (b) { b.classList.toggle("squeezed", squeezed); b.title = squeezed ? "Deck - no room beside the layers here: make the timeline bigger (or maximize it) and it comes back" : TOGTIP; }
    }
    if (squeezed) { space(); return 0; }
    var hs = Array.prototype.map.call(secs, function (s) { return s.offsetHeight; }), gap = 6, padY = 14;
    var avail = row.clientHeight, cols;
    if (avail >= hs[0] + hs[1] + hs[2] + gap * 2 + padY) cols = 1;
    else if (avail >= Math.max(hs[0] + hs[2] + gap, hs[1]) + padY) cols = 2;
    else cols = 3;
    cols = Math.max(1, Math.min(cols, Math.floor(w * 0.4 / COLW)));
    if (deck.dataset.cols !== String(cols)) deck.dataset.cols = String(cols);
    space();
    return cols;
  }
  /** the room the (absolutely placed) deck needs beside the layers */
  function space() {
    var sp = $("tlDeckSpace"); if (!sp) return;
    var w = deck.hidden || deck.dataset.squeezed === "1" ? 0 : deck.offsetWidth;
    sp.style.width = w + "px";
  }
  var TOGTIP = "Deck - the jog wheel, the shuttle, zoom and speed wheels, and the picked layer's knobs and fader: show / hide";

  function info() {
    var L = layer(), k = lk(), c = cv();
    var v = function (key) { return L && CTL[key].has(k) ? Math.round(CTL[key].get(L) * 1000) / 1000 : null; };
    return { shown: shown(), squeezed: deck.dataset.squeezed === "1", cols: +deck.dataset.cols || 1, tc: $("tlDeckTc").textContent, state: $("tlDeckState").textContent, layer: k,
             opacity: v("opacity"), fin: v("fin"), fout: v("fout"), volume: v("volume"), zoom: zoomV(), speed: RATES[speedI()],
             shut: G.shut, playing: !!(c && c.state.playing), rate: c && c.state.playing ? c.state.rate : 0, jogA: G.jogA };
  }

  wireKeys(); wireJog();
  wireWheel("tlDeckZoom", {
    roll: function (dy) { G.zoomAcc += dy * 0.4; var n = Math.trunc(G.zoomAcc); if (n) { G.zoomAcc -= n; zoom(zoomV() + n); } },
    notch: function (d) { zoom(zoomV() + d * 3); }, home: function () { zoom(30); }
  });
  wireWheel("tlDeckSpeed", {
    roll: function (dy) { G.speedAcc += dy; if (Math.abs(G.speedAcc) >= 16) { var n = Math.trunc(G.speedAcc / 16); G.speedAcc -= n * 16; speed(speedI() + n); } },
    notch: function (d) { speed(speedI() + d); }, home: function () { speed(3); }, end: function () { G.speedAcc = 0; }
  });
  Array.prototype.forEach.call(deck.querySelectorAll(".tdk-knob"), function (el) { wireCtl(el.querySelector("canvas"), el.dataset.k, 150); });
  wireCtl(deck.querySelector(".tdk-fader"), "volume", 82);
  $("tlDeckTog").addEventListener("click", function () { show(); });
  // the deck's own keys stay out of the timeline's shortcuts (← / → nudge a clip, Space plays...)
  deck.addEventListener("keydown", function (e) { if (/^(Arrow|Home|End)/.test(e.key) && e.target !== deck) e.stopPropagation(); });

  var keep = "1"; try { keep = localStorage.getItem(LSK) || "1"; } catch (e) { /* fine */ }
  show(keep !== "0");
  if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(row);
  requestAnimationFrame(loop);

  window.TlDeck = { show: show, shown: shown, info: info, jog: jog, shuttle: shuttle, zoom: zoom, speed: speed, layout: layout,
                    set: function (k, v) { return set(k, v, true); }, paint: function () { paint(true); return info(); } };
})();
