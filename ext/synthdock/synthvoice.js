/* bitGen Studio — ext/synthdock/synthvoice.js (2.953.0): 🎹 THE SYNTH STATION's SOUND - a WebAudio synth (window.H3SynthVoice).
 * One engine per AudioContext (the live one, or an OfflineAudioContext for 🎙 Sample it):
 *   per voice  oscillator A + oscillator B (each up to 7 unison copies, spread in cents), a sub an octave down, noise
 *              -> its filter (low / high / band pass, key tracking, its own ADSR) -> its amp (ADSR, velocity)
 *   the synth  drive -> tremolo (LFO amp) -> pan (LFO pan) -> chorus -> delay (feedback) + space (a made reverb) -> volume
 *   the mix    the synth + whatever else plays into .mix (the looper) -> a limiter -> the scope (an AnalyserNode) -> the speakers
 *   LFO        one for the synth: cutoff / pitch / amp / pan; the mod wheel adds to its depth
 *   noteOn(midi, vel 0..1, when) / noteOff(midi, when) / allOff() / sustain(on) / bend(-1..1) / mod(0..1) / set(id, v) / setAll(p)
 *   poly (10 voices, the oldest gives way) or mono (one voice; Glide slides from the last note)
 */
(function (root) {
  "use strict";
  var C = root.H3SynthCore;
  var MAXV = 10, BEND = 200;   // ± cents a full bend
  function wave(w) { return w === "saw" ? "sawtooth" : w; }
  function Engine(ctx, opt) {
    opt = opt || {};
    var E = this; E.ctx = ctx; E.p = C.defaults(); E.voices = []; E.held = {}; E.sus = false; E.susHeld = {}; E.bendV = 0; E.modV = 0; E.last = null;
    var g = function (v) { var n = ctx.createGain(); n.gain.value = v == null ? 1 : v; return n; };
    // ---- the synth bus
    E.voiceIn = g(1);
    E.shaper = ctx.createWaveShaper(); E.shaper.oversample = "2x";
    E.trem = g(1);
    E.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : g(1);
    E.pre = g(1);
    E.voiceIn.connect(E.shaper); E.shaper.connect(E.trem); E.trem.connect(E.pan); E.pan.connect(E.pre);
    // chorus: two short delays swaying against each other
    E.cDry = g(1); E.cWet = g(0); E.post = g(1);
    E.pre.connect(E.cDry); E.cDry.connect(E.post);
    E.cLfo = ctx.createOscillator(); E.cLfo.frequency.value = 0.55; E.cLfoG = g(0.0025); E.cLfo.connect(E.cLfoG);
    [0.012, 0.019].forEach(function (d, i) {
      var dl = ctx.createDelay(0.05); dl.delayTime.value = d;
      var sp = ctx.createStereoPanner ? ctx.createStereoPanner() : g(1); if (sp.pan) sp.pan.value = i ? 0.7 : -0.7;
      if (i) { var inv = g(-1); E.cLfoG.connect(inv); inv.connect(dl.delayTime); } else E.cLfoG.connect(dl.delayTime);
      E.pre.connect(dl); dl.connect(sp); sp.connect(E.cWet);
    });
    E.cWet.connect(E.post);
    // delay + space
    E.out = g(0.7);
    E.post.connect(E.out);
    E.dSend = g(0); E.dl = ctx.createDelay(2.5); E.dFb = g(0.35); E.dTone = ctx.createBiquadFilter(); E.dTone.type = "lowpass"; E.dTone.frequency.value = 5200;
    E.post.connect(E.dSend); E.dSend.connect(E.dl); E.dl.connect(E.dTone); E.dTone.connect(E.dFb); E.dFb.connect(E.dl); E.dTone.connect(E.out);
    E.rSend = g(0); E.verb = ctx.createConvolver(); E.post.connect(E.rSend); E.rSend.connect(E.verb); E.verb.connect(E.out);
    // ---- the LFO, the bend
    E.lfo = ctx.createOscillator(); E.lfoCut = g(0); E.lfoPitch = g(0); E.lfoAmp = g(0); E.lfoPan = g(0);
    [E.lfoCut, E.lfoPitch, E.lfoAmp, E.lfoPan].forEach(function (n) { E.lfo.connect(n); });
    E.lfoAmp.connect(E.trem.gain); if (E.pan.pan) E.lfoPan.connect(E.pan.pan);
    E.bendSrc = ctx.createConstantSource ? ctx.createConstantSource() : null; if (E.bendSrc) E.bendSrc.offset.value = 0;
    // ---- the mix: the synth + the looper -> a limiter -> the scope -> out
    E.mix = g(1);
    E.out.connect(E.mix);
    E.lim = ctx.createDynamicsCompressor(); E.lim.threshold.value = -3; E.lim.knee.value = 2; E.lim.ratio.value = 12; E.lim.attack.value = 0.002; E.lim.release.value = 0.12;
    E.scope = ctx.createAnalyser(); E.scope.fftSize = 2048; E.scope.smoothingTimeConstant = 0.6;
    E.mix.connect(E.lim); E.lim.connect(E.scope); E.scope.connect(opt.dest || ctx.destination);
    E.cLfo.start(); E.lfo.start(); if (E.bendSrc) E.bendSrc.start();
    E._ir = null;
    E.setAll(E.p);
  }
  Engine.prototype.now = function () { return this.ctx.currentTime; };
  /** the reverb's own impulse: stereo noise fading over `sec` (made, not recorded) */
  Engine.prototype.space = function (sec) {
    var ctx = this.ctx, sr = ctx.sampleRate, n = Math.max(1, Math.round(sr * Math.min(8, Math.max(0.2, sec)))), b = ctx.createBuffer(2, n, sr), r = root.H3SynthKit ? root.H3SynthKit.rng(1234) : Math.random;
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    this.verb.buffer = b; this._ir = sec;
  };
  function curve(k) {
    var n = 1024, c = new Float32Array(n), a = 1 + k * 24;
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(a * x) / Math.tanh(a); }
    return c;
  }
  Engine.prototype.set = function (id, v) {
    var E = this, p = E.p, t = E.now(), ctx = E.ctx;
    if (C.BY[id]) p[id] = C.cleanValue(id, v);
    var tc = function (param, val) { try { param.setTargetAtTime(val, t, 0.015); } catch (e) { param.value = val; } };
    switch (id) {
      case "drive": E.shaper.curve = p.drive > 0.01 ? curve(p.drive) : null; break;
      case "chorus": tc(E.cWet.gain, p.chorus * 0.9); tc(E.cDry.gain, 1 - p.chorus * 0.35); break;
      case "dTime": tc(E.dl.delayTime, p.dTime); break;
      case "dFb": tc(E.dFb.gain, p.dFb); break;
      case "dMix": tc(E.dSend.gain, p.dMix); break;
      case "rMix": tc(E.rSend.gain, p.rMix * 0.8); break;
      case "rSize": if (E._ir !== p.rSize) E.space(p.rSize); break;
      case "vol": tc(E.out.gain, p.vol); break;
      case "lRate": tc(E.lfo.frequency, p.lRate); break;
      case "lWave": E.lfo.type = p.lWave; break;
      case "lTarget": case "lDepth": E.lfoRoute(); break;
      default: E.live(id);
    }
  };
  Engine.prototype.setAll = function (o) {
    var E = this; E.p = C.cleanPatch(o);
    C.PARAMS.forEach(function (q) { E.set(q.id, E.p[q.id]); });
  };
  Engine.prototype.lfoRoute = function () {
    var E = this, p = E.p, d = Math.min(1, p.lDepth + E.modV), t = E.now(), set = function (n, v) { try { n.gain.setTargetAtTime(v, t, 0.02); } catch (e) { n.gain.value = v; } };
    set(E.lfoCut, p.lTarget === "cutoff" ? d * 3600 : 0);
    set(E.lfoPitch, p.lTarget === "pitch" ? d * 120 : 0);
    set(E.lfoAmp, p.lTarget === "amp" ? d * 0.5 : 0);
    set(E.lfoPan, p.lTarget === "pan" ? d : 0);
    try { E.trem.gain.setTargetAtTime(p.lTarget === "amp" ? 1 - d * 0.5 : 1, t, 0.02); } catch (e) { /* fine */ }
  };
  Engine.prototype.mod = function (v) { this.modV = Math.max(0, Math.min(1, +v || 0)); this.lfoRoute(); };
  Engine.prototype.bend = function (v) {
    this.bendV = Math.max(-1, Math.min(1, +v || 0));
    if (this.bendSrc) try { this.bendSrc.offset.setTargetAtTime(this.bendV * BEND, this.now(), 0.01); } catch (e) { this.bendSrc.offset.value = this.bendV * BEND; }
  };
  /** the filter's resting cutoff for a note (key tracking) and its peak (the envelope) */
  Engine.prototype.cutFor = function (m) {
    var p = this.p, base = p.cut * Math.pow(C.freq(m) / 261.63, p.kTrack);
    base = Math.max(30, Math.min(20000, base));
    return { base: base, peak: Math.max(30, Math.min(20000, base * Math.pow(2, p.fEnv * 7))), sus: Math.max(30, Math.min(20000, base * Math.pow(2, p.fEnv * 7 * p.fS))) };
  };
  /** a knob turned while notes sound: the playing voices follow */
  Engine.prototype.live = function (id) {
    var E = this, p = E.p, t = E.now();
    E.voices.forEach(function (v) {
      if (v.dead) return;
      if (id === "fType") v.f.type = p.fType;
      else if (id === "res") v.f.Q.setTargetAtTime(p.res, t, 0.02);
      else if (id === "cut" || id === "kTrack" || id === "fEnv" || id === "fS") { if (!v.rel) v.f.frequency.setTargetAtTime(E.cutFor(v.m).sus, t, 0.03); }
      else if (id === "aWave" || id === "bWave") v.o.forEach(function (o) { if (o.which === id.charAt(0)) o.n.type = wave(p[id]); });
      else if (id === "aLvl" || id === "bLvl" || id === "sub" || id === "noise") {
        v.o.forEach(function (o) { var lv = o.which === "a" ? p.aLvl / Math.sqrt(o.u) : o.which === "b" ? p.bLvl / Math.sqrt(o.u) : o.which === "s" ? p.sub : p.noise * 0.5; o.g.gain.setTargetAtTime(lv, t, 0.02); });
      } else if (id === "aOct" || id === "aDet" || id === "bSemi" || id === "bDet" || id === "spread") v.o.forEach(function (o) { if (o.n.detune) o.n.detune.setTargetAtTime(E.cents(o), t, 0.02); });
    });
  };
  Engine.prototype.cents = function (o) {
    var p = this.p, sp = o.u > 1 ? (o.k / (o.u - 1) - 0.5) * 2 * p.spread : 0;
    return o.which === "a" ? p.aOct * 1200 + p.aDet + sp : o.which === "b" ? p.bSemi * 100 + p.bDet + sp : 0;
  };
  Engine.prototype.noiseBuf = function () {
    if (this._nb) return this._nb;
    var ctx = this.ctx, n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = root.H3SynthKit ? root.H3SynthKit.rng(99) : Math.random;
    for (var i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return (this._nb = b);
  };
  Engine.prototype.voice = function (m, vel, t) {
    var E = this, ctx = E.ctx, p = E.p, f = C.freq(m), v = { m: m, t: t, o: [], vel: vel, rel: false, dead: false };
    v.mix = ctx.createGain(); v.f = ctx.createBiquadFilter(); v.vca = ctx.createGain(); v.vca.gain.value = 0;
    v.f.type = p.fType; v.f.Q.value = p.res;
    v.mix.connect(v.f); v.f.connect(v.vca); v.vca.connect(E.voiceIn);
    E.lfoCut.connect(v.f.detune);
    var add = function (which, type, u, k, freq, lvl) {
      var n = ctx.createOscillator(), gn = ctx.createGain(), o = { which: which, n: n, g: gn, u: u, k: k };
      n.type = type; n.frequency.value = freq; n.detune.value = E.cents(o); gn.gain.value = lvl;
      E.lfoPitch.connect(n.detune); if (E.bendSrc) E.bendSrc.connect(n.detune);
      n.connect(gn); gn.connect(v.mix); n.start(t); v.o.push(o);
    };
    var uni = Math.max(1, p.uni);
    if (p.aLvl > 0.001) for (var i = 0; i < uni; i++) add("a", wave(p.aWave), uni, i, f, p.aLvl / Math.sqrt(uni));
    if (p.bLvl > 0.001) for (var j = 0; j < uni; j++) add("b", wave(p.bWave), uni, j, f, p.bLvl / Math.sqrt(uni));
    if (p.sub > 0.001) add("s", "sine", 1, 0, f / 2, p.sub);
    if (p.noise > 0.001) {
      var ns = ctx.createBufferSource(), ng = ctx.createGain(); ns.buffer = E.noiseBuf(); ns.loop = true; ng.gain.value = p.noise * 0.5;
      ns.connect(ng); ng.connect(v.mix); ns.start(t, Math.random() * 1.5); v.o.push({ which: "n", n: ns, g: ng, u: 1, k: 0 });
    }
    // the envelopes
    var cf = E.cutFor(m), A = p.fA, amp = 0.32 * (0.35 + 0.65 * vel);
    v.f.frequency.setValueAtTime(cf.base, t);
    v.f.frequency.exponentialRampToValueAtTime(cf.peak, t + A);
    v.f.frequency.setTargetAtTime(cf.sus, t + A, p.fD / 3);
    v.vca.gain.setValueAtTime(0, t);
    v.vca.gain.linearRampToValueAtTime(amp, t + p.aA);
    v.vca.gain.setTargetAtTime(amp * p.aS, t + p.aA, p.aD / 3);
    v.amp = amp;
    return v;
  };
  function hold(param, t) {
    if (param.cancelAndHoldAtTime) { try { param.cancelAndHoldAtTime(t); return; } catch (e) { /* older */ } }
    var x = param.value; param.cancelScheduledValues(t); param.setValueAtTime(x, t);
  }
  Engine.prototype.release = function (v, t, fast) {
    if (v.rel) return; v.rel = true;
    var E = this, p = E.p, R = fast ? 0.02 : p.aR, FR = fast ? 0.02 : p.fR;
    hold(v.vca.gain, t); v.vca.gain.setTargetAtTime(0, t, R / 4);
    hold(v.f.frequency, t); v.f.frequency.setTargetAtTime(Math.max(30, E.cutFor(v.m).base), t, FR / 4);
    var end = t + R * 1.6 + 0.05;
    v.o.forEach(function (o) { try { o.n.stop(end); } catch (e) { /* stopped */ } });
    var first = v.o[0] && v.o[0].n;
    var bye = function () { if (v.dead) return; v.dead = true; try { v.vca.disconnect(); v.mix.disconnect(); v.f.disconnect(); } catch (e) { /* gone */ } E.voices = E.voices.filter(function (x) { return x !== v; }); };
    if (first) first.onended = bye; else bye();
  };
  Engine.prototype.noteOn = function (m, vel, when) {
    var E = this, t = when == null ? E.now() : when, p = E.p;
    m = Math.round(m); vel = vel == null ? 0.8 : Math.max(0.05, Math.min(1, vel));
    E.held[m] = true; delete E.susHeld[m];
    if (p.mode === "mono") {
      var cur = E.voices.filter(function (x) { return !x.rel; })[0];
      if (cur) {
        // slide (Glide) or jump to the new note - the envelopes carry on (legato)
        var f = C.freq(m), gt = Math.max(0.001, p.glide / 3);
        cur.o.forEach(function (o) { if (o.which === "n") return; var to = o.which === "s" ? f / 2 : f; if (p.glide > 0.001) { hold(o.n.frequency, t); o.n.frequency.setTargetAtTime(to, t, gt); } else o.n.frequency.setValueAtTime(to, t); });
        var cf = E.cutFor(m); cur.f.frequency.setTargetAtTime(cf.sus, t, 0.03);
        cur.m = m; E.last = m; return cur;
      }
    } else {
      // the same note again: the old one lets go; too many: the oldest goes
      E.voices.forEach(function (x) { if (x.m === m && !x.rel) E.release(x, t, true); });
      var live = E.voices.filter(function (x) { return !x.rel; });
      while (live.length >= MAXV) { E.release(live.shift(), t, true); }
    }
    var v = E.voice(m, vel, t);
    E.voices.push(v); E.last = m;
    return v;
  };
  Engine.prototype.noteOff = function (m, when) {
    var E = this, t = when == null ? E.now() : when; m = Math.round(m);
    delete E.held[m];
    if (E.sus) { E.susHeld[m] = true; return; }
    if (E.p.mode === "mono") {
      var still = Object.keys(E.held).map(Number);
      var cur = E.voices.filter(function (x) { return !x.rel; })[0];
      if (cur && still.length) { if (cur.m === m) E.noteOn(still[still.length - 1], cur.vel, t); return; }   // back to a key still down
      if (cur && cur.m !== m) return;
    }
    E.voices.forEach(function (x) { if (x.m === m && !x.rel) E.release(x, t); });
  };
  Engine.prototype.sustain = function (on) {
    var E = this; E.sus = !!on;
    if (!E.sus) { Object.keys(E.susHeld).forEach(function (m) { if (!E.held[m]) E.noteOff(+m); }); E.susHeld = {}; }
  };
  Engine.prototype.allOff = function () {
    var E = this, t = E.now(); E.held = {}; E.susHeld = {}; E.sus = false;
    E.voices.slice().forEach(function (v) { E.release(v, t, true); });
  };
  Engine.prototype.sounding = function () { return this.voices.filter(function (v) { return !v.rel; }).length; };

  /** 🎙 Sample it: one note of this patch played into an OfflineAudioContext -> {chans, sampleRate, seconds} */
  function sampleNote(patch, m, holdSec, sr) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext; if (!OAC) return Promise.reject(new Error("this browser cannot render sound"));
    var p = C.cleanPatch(patch); sr = sr || 48000; holdSec = Math.max(0.05, Math.min(6, holdSec || 1));
    var tail = Math.min(4, p.aR * 1.6 + 0.1 + (p.rMix > 0.02 ? Math.min(3, p.rSize) * 0.6 : 0) + (p.dMix > 0.02 ? p.dTime * 3 : 0));
    var secs = Math.min(10, holdSec + tail), ctx = new OAC(2, Math.round(sr * secs), sr), E = new Engine(ctx);
    E.setAll(p); E.noteOn(m, 0.9, 0.01); E.noteOff(m, 0.01 + holdSec);
    return ctx.startRendering().then(function (b) { return { chans: [b.getChannelData(0), b.getChannelData(1)], sampleRate: sr, seconds: secs }; });
  }
  root.H3SynthVoice = { Engine: Engine, sampleNote: sampleNote, MAXV: MAXV };
})(typeof window !== "undefined" ? window : globalThis);
