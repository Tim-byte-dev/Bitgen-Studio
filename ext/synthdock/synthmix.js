/* bitGen Studio — ext/synthdock/synthmix.js (2.958.0): 🎹 THE MIXER - a strip per timeline layer (window.H3SynthMix).
 * Tim: "continue" (the Cakewalk-style list: a mixer view with effects per layer and meters).
 * 🎚 Mixer in the timeline's bar opens it over the layers: each layer a strip in its colour - its meter (while ▶ plays), Vol and
 * Pan, the EQ (Low 200 Hz shelf, Mid 1 kHz, High 4.5 kHz shelf, ± 15 dB), Comp (how hard its compressor squeezes - with make-up
 * gain), Filter (a lowpass), Rev (its send to the shared reverb), M / S; the master strip: its level and its meter. Every knob is live while it plays,
 * kept in the timeline (layer.fx, tl.master) and in its .sfx file; undo covers it.
 *   level(analyser) -> {rms, peak} (0..1); dbText(v) (pure parts; the meters fall back 30 dB a second)
 */
(function (root) {
  "use strict";
  function level(an, buf) {
    if (!an) return { rms: 0, peak: 0 };
    buf = buf || new Float32Array(an.fftSize); an.getFloatTimeDomainData(buf);
    var s = 0, p = 0; for (var i = 0; i < buf.length; i++) { var v = Math.abs(buf[i]); s += v * v; if (v > p) p = v; }
    return { rms: Math.sqrt(s / buf.length), peak: p };
  }
  function db(v) { return v <= 0.00001 ? -100 : 20 * Math.log10(v); }
  var doc = root.document, KN = root.H3SynthKnob, T = root.H3SynthTLCore;
  if (!doc || !KN || !T) { root.H3SynthMix = { level: level, db: db }; return; }
  var $ = function (id) { return doc.getElementById(id); };
  var HUES = ["#38e1ff", "#ff4fd8", "#ffae3a", "#5dff8a", "#b78cff", "#ffd23a", "#4f9dff", "#ff5a5a"];
  var M = { open: false, raf: 0, hold: {}, buf: null };
  function TL() { return root.H3SynthTL; }
  function T0() { return root.H3SynthTLCore; }
  function fxKnob(label, color, get, set, lo, hi, def, txt, bip) {
    return KN.knob({ label: label, size: 26, color: color, def: (def - lo) / (hi - lo), bipolar: bip, get: function () { return (get() - lo) / (hi - lo); },
                     set: function (n) { set(Math.round((lo + n * (hi - lo)) * 100) / 100); TL().changedFx(); }, text: txt });
  }
  function build() {
    var box = $("syMix"); if (!box || !TL()) return;
    var tl = TL().tl(); box.innerHTML = "";
    tl.layers.forEach(function (l, i) {
      if (!l.fx) l.fx = T.cleanFx(null);
      var col = HUES[i % HUES.length], st = doc.createElement("div"); st.className = "systrip"; st.style.setProperty("--lc", col); st.dataset.l = i;
      st.innerHTML = '<b title="' + l.name.replace(/"/g, "&quot;") + '">' + l.name.replace(/</g, "&lt;") + '</b><div class="vm"><canvas class="symeter" width="18" height="110" data-m="' + i + '"></canvas><div class="vk"></div></div><div class="row r1"></div><div class="row r2"></div><div class="row r3"></div>';
      var dbt = function (v) { return (v > 0 ? "+" : "") + v.toFixed(1) + " dB"; };
      var vk = KN.knob({ label: "Vol", size: 34, color: col, def: 1 / 1.5, get: function () { return l.vol / 1.5; }, set: function (n) { l.vol = Math.round(n * 150) / 100; TL().changedFx(); }, text: function () { return Math.round(l.vol * 100) + "%"; } });
      vk.el.dataset.mix = "vol"; st.querySelector(".vk").appendChild(vk.el);
      var add = function (row, k, key) { k.el.dataset.mix = key; st.querySelector(row).appendChild(k.el); };
      add(".r1", fxKnob("Pan", col, function () { return l.pan; }, function (v) { l.pan = v; }, -1, 1, 0, function () { return Math.abs(l.pan) < 0.02 ? "C" : (l.pan < 0 ? "L" : "R") + Math.round(Math.abs(l.pan) * 100); }, true), "pan");
      add(".r1", fxKnob("Low", col, function () { return l.fx.lo; }, function (v) { l.fx.lo = v; }, -15, 15, 0, function () { return dbt(l.fx.lo); }, true), "lo");
      add(".r2", fxKnob("Mid", col, function () { return l.fx.mid; }, function (v) { l.fx.mid = v; }, -15, 15, 0, function () { return dbt(l.fx.mid); }, true), "mid");
      add(".r2", fxKnob("High", col, function () { return l.fx.hi; }, function (v) { l.fx.hi = v; }, -15, 15, 0, function () { return dbt(l.fx.hi); }, true), "hi");
      add(".r3", fxKnob("Comp", col, function () { return l.fx.comp; }, function (v) { l.fx.comp = v; }, 0, 1, 0, function () { return Math.round(l.fx.comp * 100) + "%"; }), "comp");
      add(".r3", KN.knob({ label: "Filter", size: 26, color: col, def: 1, get: function () { return T0().autoNorm("cut", l.fx.cut || 20000); },   // 2.959.0: lowpass, log scale
        set: function (n) { l.fx.cut = Math.round(T0().autoVal("cut", n)); TL().changedFx(); }, text: function () { var c = l.fx.cut || 20000; return c >= 19900 ? "Open" : c >= 1000 ? (c / 1000).toFixed(1) + "k" : c + ""; } }), "cut");
      add(".r3", fxKnob("Rev", col, function () { return l.fx.rev; }, function (v) { l.fx.rev = v; }, 0, 1, 0, function () { return Math.round(l.fx.rev * 100) + "%"; }), "rev");
      var ms = doc.createElement("div"); ms.className = "row";
      ms.innerHTML = '<button type="button" class="ghost sym m' + (l.mute ? " on" : "") + '" title="Mute">M</button><button type="button" class="ghost sym s' + (l.solo ? " on" : "") + '" title="Solo">S</button>';
      ms.querySelectorAll("button")[0].onclick = function () { l.mute = !l.mute; TL().changedFx(); if (TL().setTL) build(); };
      ms.querySelectorAll("button")[1].onclick = function () { l.solo = !l.solo; TL().changedFx(); build(); };
      st.appendChild(ms); box.appendChild(st);
    });
    var ma = doc.createElement("div"); ma.className = "systrip master";
    ma.innerHTML = '<b>Master</b><div class="vm"><canvas class="symeter" width="18" height="110" data-m="master"></canvas><div class="vk"></div></div>';
    var mk = KN.knob({ label: "Master", size: 34, color: "#f4f1e8", def: 1 / 1.5, get: function () { return (tl.master == null ? 1 : tl.master) / 1.5; }, set: function (n) { tl.master = Math.round(n * 150) / 100; TL().changedFx(); }, text: function () { return Math.round((tl.master == null ? 1 : tl.master) * 100) + "%"; } });
    mk.el.dataset.mix = "master"; ma.querySelector(".vk").appendChild(mk.el); box.appendChild(ma);
    meters();
  }
  function paintMeter(cv, lv, key) {
    var x = cv.getContext("2d"), w = cv.width, h = cv.height; if (!x) return;
    var now = (root.performance ? root.performance.now() : Date.now()) / 1000, hd = M.hold[key] || { v: -60, t: now };
    var d = Math.max(-60, db(lv.peak)); hd.v = d > hd.v ? d : Math.max(-60, hd.v - (now - hd.t) * 30); hd.t = now; M.hold[key] = hd;
    var r = Math.max(-60, db(lv.rms)), y = function (dv) { return h - (dv + 60) / 60 * h; };
    x.fillStyle = "#05070a"; x.fillRect(0, 0, w, h);
    var gr = x.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, "#2ecf6a"); gr.addColorStop(0.75, "#ffd23a"); gr.addColorStop(1, "#ff4040");
    x.fillStyle = gr; x.fillRect(3, y(r), w - 6, h - y(r));
    x.fillStyle = hd.v > -1 ? "#ff4040" : "#e6ebf5"; x.fillRect(2, y(hd.v), w - 4, 2);
    [-6, -12, -24, -48].forEach(function (dv) { x.fillStyle = "#ffffff22"; x.fillRect(0, y(dv), 3, 1); });
  }
  function meters() {
    root.cancelAnimationFrame(M.raf);
    if (!M.open) return;
    var mt = TL() && TL().meters(), cvs = doc.querySelectorAll("#syMix canvas.symeter");
    cvs.forEach(function (cv) {
      var k = cv.dataset.m, an = !mt ? null : k === "master" ? mt.master : mt.layers[+k];
      if (an && (!M.buf || M.buf.length !== an.fftSize)) M.buf = new Float32Array(an.fftSize);
      paintMeter(cv, an ? level(an, M.buf) : { rms: 0, peak: 0 }, k);
    });
    M.raf = root.requestAnimationFrame(meters);
  }
  function toggle(on) {
    M.open = on == null ? !M.open : !!on;
    var box = $("syMix"), b = $("syTMixBtn");
    if (box) box.classList.toggle("on", M.open); if (b) { b.classList.toggle("on", M.open); b.setAttribute("aria-pressed", M.open ? "true" : "false"); }
    if (M.open) build(); else root.cancelAnimationFrame(M.raf);
    return M.open;
  }
  root.H3SynthMix = { toggle: toggle, build: build, isOpen: function () { return M.open; }, level: level, db: db,
    info: function () { return { open: M.open, strips: doc.querySelectorAll("#syMix .systrip").length, hold: JSON.parse(JSON.stringify(M.hold)) }; } };
})(typeof window !== "undefined" ? window : globalThis);
