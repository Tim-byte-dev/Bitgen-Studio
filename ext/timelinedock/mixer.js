/* bitGen Studio — ext/timelinedock/mixer.js (2.415.0): 🎚 the TRACK MIXER (window.TlMixer).
 *
 * Tim: "lets do the medium jobs now" (Premiere's track mixer with live meters + pan).
 *
 * A strip per track that sounds - V1, every video layer, every sound layer - and the MASTER: a fader (−∞ .. +6 dB,
 * the layer's volume 0 .. 2), a PAN (L 100 .. C .. R 100, the balance law of lib/mixer.js), M (mute), S (solo) and a
 * live LEVEL METER (left / right, peak + hold, dBFS) while the canvas plays. The compile pans and sets the master the
 * same way (scripts/mixfx.py).
 *
 * The preview: while the mixer is open - or once a track is panned / above 0 dB / the master moved - every playing
 * <video> / <audio> of the canvas is routed through WebAudio: element -> its track's bus (gain = the fader, a stereo
 * panner = the pan, two analysers = the meter) -> the master bus (gain + meter) -> the speakers. The element's own
 * volume then carries only the clip's level (canvas.js calls TlMixer.apply on every sync). Nothing is routed until
 * then, so a timeline that never uses the mixer plays exactly as before.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlDlg && window.TlCanvas && typeof tl !== "undefined"); } catch (e) { return false; } }
  function save() { if (typeof tlSave === "function") tlSave(); }
  var AC = null, buses = {}, master = null, routed = (typeof WeakMap === "function") ? new WeakMap() : null, dlg = null, raf = 0, hold = {};
  var CSS = "#tlMixerDlg .mx-row{display:flex;gap:6px;align-items:stretch;overflow-x:auto;padding:4px 0}"
    + "#tlMixerDlg .mx-s{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:74px;max-width:90px;padding:6px 4px;border:1px solid var(--line,#3a342a);border-radius:6px;background:rgba(255,255,255,.02)}"
    + "#tlMixerDlg .mx-s.master{border-color:var(--tiger,#f59e2c)}#tlMixerDlg .mx-n{font-size:.66rem;max-width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + "#tlMixerDlg .mx-mid{display:flex;gap:4px;align-items:flex-end;height:150px}"
    + "#tlMixerDlg input.mx-f{writing-mode:vertical-lr;direction:rtl;height:150px;width:22px;margin:0}"
    + "#tlMixerDlg canvas.mx-m{width:16px;height:150px;background:#0c0a08;border-radius:2px}"
    + "#tlMixerDlg input.mx-p{width:68px}#tlMixerDlg .mx-db,#tlMixerDlg .mx-pv{font-size:.62rem;color:var(--dim,#9a917f);font-variant-numeric:tabular-nums}"
    + "#tlMixerDlg .mx-b{display:flex;gap:3px}#tlMixerDlg .mx-b button{font-size:.62rem;padding:0 5px}"
    + "#tlMixerDlg .mx-b button.on{background:var(--tiger,#f59e2c);color:#000}";

  /* ---------------- the numbers (lib/mixer.js) */
  function gain(v, d) { var x = Number(v); if (!Number.isFinite(x)) x = d == null ? 1 : d; return Math.min(2, Math.max(0, x)); }
  function pan(v) { var p = Math.min(1, Math.max(-1, Number(v) || 0)); return Math.abs(p) < 1e-4 ? 0 : p; }
  function panGains(p) { var q = pan(p); return [q > 0 ? 1 - q : 1, q < 0 ? 1 + q : 1]; }
  function db(g) { return g < 1e-4 ? "−∞" : ((g >= 1 ? "+" : "") + (20 * Math.log10(g)).toFixed(1)); }
  function panLabel(p) { var q = Math.round(pan(p) * 100); return q === 0 ? "C" : (q < 0 ? "L " + (-q) : "R " + q); }

  /* ---------------- the tracks */
  function v1L() { return typeof v1 === "function" ? v1() : (tl.v1 = tl.v1 || { name: "V1" }); }
  function tracks() {
    var out = [{ lk: "v1", L: v1L(), name: (v1L().name || "V1"), kind: "video" }];
    (tl.vlayers || []).forEach(function (L, i) { if (L) out.push({ lk: "vl:" + i, L: L, name: L.name || "V" + (i + 2), kind: "video" }); });
    (tl.audio || []).forEach(function (L, i) { if (L) out.push({ lk: "a:" + i, L: L, name: L.name || "A" + (i + 1), kind: "sound" }); });
    return out;
  }
  function masterVol() { return gain(tl.master && tl.master.volume, 1); }
  /** must the preview go through WebAudio? (the mixer open, a pan, a fader above 0 dB, the master moved) */
  function need() {
    if (dlg && dlg.isOpen()) return true;
    if (Math.abs(masterVol() - 1) > 1e-4) return true;
    return tracks().some(function (t) { return pan(t.L.pan) !== 0 || gain(t.L.volume, 1) > 1 + 1e-4; });
  }

  /* ---------------- WebAudio */
  function ctx() {
    if (AC) return AC;
    var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    try { AC = new C(); } catch (e) { AC = null; return null; }
    master = bus(AC.destination, true);
    return AC;
  }
  function bus(dest, isMaster) {
    var g = AC.createGain(), p = AC.createStereoPanner ? AC.createStereoPanner() : null, sp = AC.createChannelSplitter(2);
    var aL = AC.createAnalyser(), aR = AC.createAnalyser(); aL.fftSize = aR.fftSize = 1024;
    var lastNode = g;
    if (p) { g.connect(p); lastNode = p; }
    lastNode.connect(dest); lastNode.connect(sp); sp.connect(aL, 0); sp.connect(aR, 1);
    return { in: g, g: g, p: p, aL: aL, aR: aR, buf: new Float32Array(1024), master: !!isMaster };
  }
  function busOf(lk) { if (!buses[lk]) buses[lk] = bus(master.in); return buses[lk]; }
  function setBus(lk, L) {
    var b = busOf(lk);
    b.g.gain.value = gain(L.volume, 1);
    if (b.p) b.p.pan.value = pan(L.pan);
    return b;
  }
  /** canvas.js, on every sync: route this element through its track's bus when the mixer is in use. clipVol = the
   *  clip's own level (the track's fader is the bus's). -> true when routed (the element's volume was set here) */
  function apply(el, lk, L, clipVol) {
    if (!el || !routed) return false;
    var r = routed.get(el);
    if (!r && !need()) return false;
    if (!ctx()) return false;
    if (AC.state === "suspended" && !el.paused) AC.resume().catch(function () { /* a gesture will */ });
    if (!r) {
      try { r = { src: AC.createMediaElementSource(el), lk: null }; } catch (e) { return false; }
      routed.set(el, r);
    }
    if (r.lk !== lk) { try { r.src.disconnect(); } catch (e) { /* first */ } r.src.connect(busOf(lk).in); r.lk = lk; }
    setBus(lk, L);
    master.g.gain.value = masterVol();
    try { el.volume = Math.max(0, Math.min(1, clipVol == null ? 1 : +clipVol)); } catch (e) { /* fine */ }
    return true;
  }
  function resume() { if (AC && AC.state === "suspended") AC.resume().catch(function () { /* later */ }); }
  /** the level now: {l, r} peak (0 .. ) of a bus */
  function level(b) {
    if (!b) return { l: 0, r: 0 };
    var pk = function (an) { an.getFloatTimeDomainData(b.buf); var m = 0; for (var i = 0; i < b.buf.length; i++) { var v = Math.abs(b.buf[i]); if (v > m) m = v; } return m; };
    return { l: pk(b.aL), r: pk(b.aR) };
  }
  function levels() {
    var out = {};
    tracks().forEach(function (t) { out[t.lk] = buses[t.lk] ? level(buses[t.lk]) : { l: 0, r: 0 }; });
    out.master = master ? level(master) : { l: 0, r: 0 };
    return out;
  }

  /* ---------------- the panel */
  function dbOf(peak) { return peak < 1e-5 ? -90 : 20 * Math.log10(peak); }
  function drawMeter(cv, lv, key) {
    var w = cv.width = 16, h = cv.height = 150, g = cv.getContext("2d");
    g.fillStyle = "#0c0a08"; g.fillRect(0, 0, w, h);
    var y = function (d) { return h - Math.max(0, Math.min(1, (d + 60) / 66)) * h; };   // -60 .. +6 dBFS
    [["l", 0], ["r", 8]].forEach(function (s) {
      var d = dbOf(lv[s[0]]), top = y(d);
      var grd = g.createLinearGradient(0, h, 0, 0); grd.addColorStop(0, "#2f9e44"); grd.addColorStop(0.75, "#e8c547"); grd.addColorStop(0.9, "#e8590c"); grd.addColorStop(1, "#c92a2a");
      g.fillStyle = grd; g.fillRect(s[1], top, 7, h - top);
      var hk = key + s[0], now = performance.now();
      if (!hold[hk] || d > hold[hk].d || now - hold[hk].t > 1500) hold[hk] = { d: d, t: now };
      g.fillStyle = hold[hk].d > -0.1 ? "#ff6b6b" : "#ddd"; g.fillRect(s[1], y(hold[hk].d), 7, 2);
    });
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(0, y(0), w, 1);
  }
  function loop() {
    raf = 0;
    if (!dlg || !dlg.isOpen()) return;
    var lv = levels();
    Array.prototype.forEach.call(document.querySelectorAll("#tlMixerDlg canvas.mx-m"), function (cv) { drawMeter(cv, lv[cv.dataset.lk] || { l: 0, r: 0 }, cv.dataset.lk); });
    raf = requestAnimationFrame(loop);
  }
  function strip(t) {
    var L = t.L, g = gain(L.volume, 1);
    return '<div class="mx-s" data-lk="' + t.lk + '"><div class="mx-n" title="' + esc(t.name) + '">' + (t.kind === "sound" ? "🔊 " : "🎞 ") + esc(t.name) + "</div>"
      + '<input type="range" class="mx-p" min="-100" max="100" step="1" value="' + Math.round(pan(L.pan) * 100) + '" title="Pan (double-click: centre)" aria-label="Pan ' + esc(t.name) + '">'
      + '<div class="mx-pv">' + panLabel(L.pan) + "</div>"
      + '<div class="mx-mid"><input type="range" class="mx-f" min="0" max="200" step="1" value="' + Math.round(g * 100) + '" title="Fader (double-click: 0 dB)" aria-label="Volume ' + esc(t.name) + '">'
      + '<canvas class="mx-m" data-lk="' + t.lk + '" width="16" height="150" aria-label="Level ' + esc(t.name) + '"></canvas></div>'
      + '<div class="mx-db">' + db(g) + " dB</div>"
      + '<div class="mx-b"><button type="button" class="ghost mx-mute' + (L.muted ? " on" : "") + '" title="Mute">M</button><button type="button" class="ghost mx-solo' + (L.solo ? " on" : "") + '" title="Solo">S</button></div></div>';
  }
  function paint() {
    if (!$("tlMixerCss")) { var st = document.createElement("style"); st.id = "tlMixerCss"; st.textContent = CSS; document.head.appendChild(st); }
    var mv = masterVol();
    dlg.body.innerHTML = '<div class="mx-row">' + tracks().map(strip).join("")
      + '<div class="mx-s master" data-lk="master"><div class="mx-n">MASTER</div><div class="mx-pv">&nbsp;</div><div class="mx-pv">&nbsp;</div>'
      + '<div class="mx-mid"><input type="range" class="mx-f" min="0" max="200" step="1" value="' + Math.round(mv * 100) + '" title="Master (double-click: 0 dB)" aria-label="Master volume">'
      + '<canvas class="mx-m" data-lk="master" width="16" height="150" aria-label="Master level"></canvas></div><div class="mx-db">' + db(mv) + " dB</div></div></div>"
      + '<div class="fx-dim">Play the canvas to see the levels (−60 .. +6 dBFS; the white tick holds the peak, red = over 0 dB). Faders go to +6 dB; pan uses the balance law - the compile pans and mixes the same way.</div>';
    Array.prototype.forEach.call(dlg.body.querySelectorAll(".mx-s"), function (el) {
      var lk = el.dataset.lk, t = tracks().find(function (x) { return x.lk === lk; });
      var f = el.querySelector(".mx-f"), p = el.querySelector(".mx-p");
      var setF = function (v) {
        var g = gain(v / 100, 1);
        if (lk === "master") { tl.master = Math.abs(g - 1) < 1e-4 ? undefined : { volume: g }; if (master) master.g.gain.value = g; }
        else { t.L.volume = g; if (buses[lk]) buses[lk].g.gain.value = g; }
        el.querySelector(".mx-db").textContent = db(g) + " dB";
      };
      f.addEventListener("input", function () { setF(+f.value); });
      f.addEventListener("change", function () { save(); if (typeof renderTimeline === "function") renderTimeline(); });
      f.addEventListener("dblclick", function () { f.value = 100; setF(100); save(); if (typeof renderTimeline === "function") renderTimeline(); });
      if (p) {
        var setP = function (v) { var q = pan(v / 100); t.L.pan = q || undefined; if (buses[lk] && buses[lk].p) buses[lk].p.pan.value = q; el.querySelector(".mx-pv").textContent = panLabel(q); };
        p.addEventListener("input", function () { setP(+p.value); });
        p.addEventListener("change", save);
        p.addEventListener("dblclick", function () { p.value = 0; setP(0); save(); });
      }
      var mb = el.querySelector(".mx-mute"), sb = el.querySelector(".mx-solo");
      if (mb) mb.onclick = function () { t.L.muted = !t.L.muted; mb.classList.toggle("on", !!t.L.muted); save(); if (typeof renderTimeline === "function") renderTimeline(); TlCanvas.mark(); };
      if (sb) sb.onclick = function () { t.L.solo = !t.L.solo; sb.classList.toggle("on", !!t.L.solo); save(); if (typeof renderTimeline === "function") renderTimeline(); TlCanvas.mark(); };
    });
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlMixerDlg", title: "Mixer", width: 760, onClose: function () { if (raf) cancelAnimationFrame(raf); raf = 0; } });
      dlg.foot.innerHTML = '<span class="fx-dim" style="flex:1">🎚 V1, the video layers and the sound layers</span><button type="button" id="tmxDone">Done</button>';
      $("tmxDone").onclick = function () { dlg.close(); };
    }
    ctx(); resume();
    paint(); dlg.open();
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlMixerBtn", "🎚", "Mixer: a fader, pan, mute / solo and a live level meter per track + the master", open);
  }
  window.TlMixer = { open: open, apply: apply, need: need, levels: levels, panGains: panGains, gain: gain, pan: pan, resume: resume,
    state: function () { return { ctx: AC ? AC.state : null, buses: Object.keys(buses), routed: !!routed }; } };
  boot();
})();
