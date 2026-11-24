/* bitGen Studio — ext/chasedock/chasesound.js (2.943.0): POLICE CHASE - all the sound, made in code (window.H3ChaseSound).
 *
 * Tim: "before we start, are u able to add sound and sfx to police chase?" -> the list -> "please add your suggestions.
 * i am too lazy right now to create my own". Everything is synthesised with Web Audio on the spot - no sound files, nothing
 * to license; the tunes are our own (nothing that resembles a known game's music).
 *   MUSIC       an arcade chase loop from a small step sequencer on the AudioContext clock (bass, drums, lead): far from
 *               the police only bass + drums; closer = faster and fuller (the lead comes in, sixteenth hats, fills); a
 *               POWER variation while the 🚀 launcher lasts (pumping bass, rising arpeggio, four on the floor); quiet and
 *               muffled while you pause (P / Esc); stopped on the title and GAME OVER
 *   ENGINE      a saw + square pair, low-passed, its pitch follows the getaway car (idle when stopped, low on spikes, a
 *               roar during ⚡); off while busted
 *   SQUEALS     filtered noise on a hard turn at speed and when a police car dodges
 *   EXPLOSIONS  layered: a deep sub boom, a crack, a crackling fire tail, debris clinks 0.4-0.9 s later; crash (your car)
 *               the biggest, kaboom (a police car) big, boom (a rocket at a wall) small; panned to where it happened
 *   MIXER       music and effects volumes (0-100, h3.chase.music / h3.chase.sfx) and "start with sound on"
 *               (h3.chase.startsound); M stays the master switch (h3.chase.sound - used when the box was never set)
 * One AudioContext; nothing is made until the sound is on; stopAll() + suspend when off, paused for any other reason than
 * a deliberate pause, hidden, or the docker closed.
 *
 * Pure (Node tests, scripts/test-943.js): SFX, NAMES, BLAST, gainOf, clampVol, prefs, bpmFor, intensityFor, stepNotes,
 * musicMix, engineNote, turned, debrisTimes, panOf, midiHz.  Web Audio: create(win) -> the player (see the bottom).
 */
(function (root) {
  "use strict";

  /* ================= the pure parts ================= */
  var DEF = { music: 60, sfx: 80 };
  function clampVol(v, d) { if (v === "" || v == null) return d; v = Number(v); if (!isFinite(v)) return d; return Math.max(0, Math.min(100, Math.round(v))); }
  /** a 0-100 slider -> a bus gain (squared: the slider feels even); the effects' default (80) = 1, as loud as before 2.943.0 */
  function gainOf(v) { v = clampVol(v, 0); return v <= 0 ? 0 : 1.6 * Math.pow(v / 100, 2); }
  /** the kept settings from a get(key, default) -> {music, sfx, start}; start null = never set (the last M decides) */
  function prefs(get) {
    var st = get("startsound", null);
    return { music: clampVol(get("music", DEF.music), DEF.music), sfx: clampVol(get("sfx", DEF.sfx), DEF.sfx),
             start: st === "1" ? true : st === "0" ? false : null };
  }
  function midiHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* ---- the music: 8 bars of 16 steps (sixteenths) ---- */
  var STEPS = 16, BARS = 8;
  // the chords (A minor: Am F G Em, twice) - roots for the bass, the notes for the power arpeggio
  var CHORDS = [[45, [57, 60, 64]], [41, [53, 57, 60]], [43, [55, 59, 62]], [40, [52, 55, 59]]];
  var _ = null;
  var BASS = [0, _, 0, 12, _, 0, 7, _, 0, _, 0, 12, _, 10, 7, _];
  // our own lead - a call (bars 1-4) and an answer (bars 5-8)
  var LEAD = [
    [76, _, _, 74, 72, _, 69, _, 72, _, 74, _, 76, _, _, _],
    [77, _, _, 76, 74, _, 72, _, 69, _, 72, _, 77, _, 76, _],
    [79, _, _, 77, 76, _, 74, _, 71, _, 74, _, 79, _, _, _],
    [76, _, 74, _, 71, _, 67, _, 71, _, 74, _, 76, _, _, _],
    [81, _, 79, _, 76, _, 79, _, 81, _, 84, _, 83, _, 81, _],
    [77, _, 81, _, 84, _, 81, _, 77, _, 76, _, 74, _, 72, _],
    [74, _, 79, _, 83, _, 79, _, 74, _, 79, _, 83, _, 86, _],
    [83, _, _, 81, 79, _, 76, _, 74, _, 71, _, 76, _, _, _],
  ];
  var KICK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  var SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
  /** how close the nearest police car is (tiles; Infinity = none chasing) -> 0 (far) .. 1 (on your tail) */
  function intensityFor(near) { if (!(near < Infinity)) return 0; return Math.max(0, Math.min(1, (12 - near) / 10)); }
  /** the tempo: 126 bpm far away, up to 166 close; the power variation never slower than 150 */
  function bpmFor(intensity, power) { var b = 126 + 40 * Math.max(0, Math.min(1, intensity || 0)); return Math.round(power ? Math.max(150, b) : b); }
  /** what plays on one step -> [{v: kick|snare|hat|ohat|bass|lead|arp, n: midi, len: steps, vel}] */
  function stepNotes(bar, step, o) {
    o = o || {}; bar = ((bar % BARS) + BARS) % BARS; step = ((step % STEPS) + STEPS) % STEPS;
    var k = Math.max(0, Math.min(1, o.intensity || 0)), out = [], ch = CHORDS[bar % 4], fill = bar === BARS - 1 && step >= 12;
    if (o.power) {
      if (step % 4 === 0) out.push({ v: "kick", vel: 1 });
      if (step % 8 === 4) out.push({ v: "snare", vel: 0.9 });
      if (step % 4 === 2) out.push({ v: "ohat", vel: 0.8 });
      if (fill && step % 2) out.push({ v: "snare", vel: 0.6 });
      out.push({ v: "bass", n: ch[0] + (step % 2 ? 12 : 0), len: 1, vel: 0.9 });
      var arp = ch[1][step % 3] + 12 + (step >= 8 ? 12 : 0);
      out.push({ v: "arp", n: arp, len: 1, vel: 0.75 });
      return out;
    }
    if (KICK[step] || (k > 0.55 && (step === 10 || step === 14))) out.push({ v: "kick", vel: 1 });
    if (SNARE[step]) out.push({ v: "snare", vel: 0.85 });
    if (fill && k > 0.45 && !SNARE[step]) out.push({ v: "snare", vel: 0.35 + 0.1 * (step - 12) });
    if (step % 2 === 0 || k > 0.6) out.push({ v: "hat", vel: step % 4 === 2 ? 0.9 : step % 2 ? 0.45 : 0.6 });
    if (BASS[step] != null) out.push({ v: "bass", n: ch[0] + BASS[step], len: BASS[step + 1] === undefined || BASS[step + 1] == null ? 2 : 1, vel: 0.85 });
    if (k >= 0.25) {
      var line = LEAD[bar], n = line[step];
      if (n != null) { var len = 1; while (step + len < STEPS && line[step + len] == null && len < 4) len++; out.push({ v: "lead", n: n, len: len, vel: 0.5 + 0.5 * k }); }
    }
    return out;
  }
  /** the music bus: open while playing (brighter the closer they are), muffled and quiet while paused, ducked while busted */
  function musicMix(o) {
    o = o || {};
    if (o.paused) return { cut: 700, gain: 0.35 };
    if (o.busted) return { cut: 1200, gain: 0.3 };
    var k = Math.max(0, Math.min(1, o.intensity || 0));
    return { cut: o.power ? 14000 : Math.round(3000 + 9000 * k), gain: 1 };
  }

  /* ---- the engine ---- */
  /** {play, moving, speed, base, turbo, slowed} -> {on, f, g, cut}: idle when stopped, pitch with the speed, ⚡ roars */
  function engineNote(o) {
    o = o || {};
    if (!o.play) return { on: false, f: 0, g: 0, cut: 0 };
    if (!o.moving) return { on: true, f: 42, g: 0.035, cut: 380 };
    var r = Math.max(0.3, Math.min(2, (o.speed || 0) / (o.base || 5.2)));
    return { on: true, f: Math.round(48 + 62 * r), g: +(0.05 + 0.02 * r + (o.turbo ? 0.02 : 0)).toFixed(3),
             cut: Math.round(o.turbo ? 2400 : (450 + 900 * r) * (o.slowed ? 0.7 : 1)) };
  }
  /** a hard turn at speed -> 0 (none), 0.7 (a right angle), 1 (a U-turn) */
  function turned(prev, dir, moving, ratio) {
    if (!(prev >= 0) || !(dir >= 0) || prev === dir || !moving || !(ratio >= 0.6)) return 0;
    return (prev + 2) % 4 === dir ? 1 : 0.7;
  }

  /* ---- the explosions ---- */
  // sub [from Hz, to Hz, s, gain] · crack [s, gain] · fire [s, gain] · debris clinks
  var BLAST = {
    crash: { sub: [95, 24, 1.3, 0.55], crack: [0.14, 0.6], body: [0.9, 0.35], fire: [1.7, 0.24], debris: 6 },
    kaboom: { sub: [110, 28, 0.9, 0.42], crack: [0.11, 0.5], body: [0.6, 0.28], fire: [1.1, 0.17], debris: 4 },
    boom: { sub: [140, 40, 0.45, 0.24], crack: [0.07, 0.34], body: [0.3, 0.16], fire: [0.45, 0.08], debris: 2 },
  };
  /** n debris clinks between 0.4 and 0.9 s after the blast, in order */
  function debrisTimes(n, rnd) { rnd = rnd || Math.random; var t = []; for (var i = 0; i < n; i++) t.push(+(0.4 + 0.5 * rnd()).toFixed(3)); return t.sort(function (a, b) { return a - b; }); }
  /** where it happened on the screen (-1 left .. 1 right) -> the stereo pan (never hard left / right) */
  function panOf(x) { x = Number(x); if (!isFinite(x)) return 0; return Math.max(-0.7, Math.min(0.7, x * 0.7)); }

  /* ---- the effects (each a list of layers: [wave, from Hz, to Hz, s, gain, delay] or ["noise", s, gain, delay]) ---- */
  var SFX = {
    cash: [["square", 1046, 1046, 0.05, 0.05]], cash2: [["square", 1318, 1318, 0.05, 0.05]],
    fire: [["noise", 0.12, 0.08], ["sawtooth", 900, 200, 0.25, 0.05]],
    boom: "blast", kaboom: "blast", crash: "blast",
    block: [["square", 160, 120, 0.12, 0.06]],
    nitro: [["sawtooth", 300, 1200, 0.5, 0.05]],
    spikes: [["triangle", 1800, 1500, 0.08, 0.04], ["triangle", 1800, 1500, 0.08, 0.04, 0.1]],
    slow: [["noise", 0.3, 0.12], ["square", 500, 120, 0.4, 0.05]],
    shield: [["sine", 1500, 2200, 0.2, 0.07]],
    jammer: [["sawtooth", 220, 1400, 0.35, 0.07], ["sine", 1400, 300, 0.3, 0.05, 0.3]],
    tag: [["noise", 0.18, 0.18], ["square", 180, 60, 0.2, 0.08], ["sine", 660, 1320, 0.15, 0.05, 0.12]],
    dodge: [["noise", 0.18, 0.06], ["square", 1400, 900, 0.18, 0.03]],
    turbo: [["sawtooth", 200, 1600, 0.45, 0.06], ["sine", 800, 2400, 0.3, 0.04, 0.1]],
    turbocop: [["sawtooth", 600, 150, 0.4, 0.05]],
    boostup: [["sine", 1760, 2637, 0.1, 0.04]],
    busted: [["noise", 0.4, 0.25]].concat([880, 660, 880, 660].map(function (f, i) { return ["triangle", f, f, 0.22, 0.07, 0.25 + i * 0.25]; })),
    clear: [523, 659, 784, 1046].map(function (f, i) { return ["square", f, f, 0.12, 0.05, i * 0.1]; }),
    bonus: [["sine", 784, 1568, 0.25, 0.08]],
    bonusup: [["sine", 1568, 1568, 0.08, 0.04], ["sine", 2093, 2093, 0.08, 0.04, 0.09]],
    start: [392, 523, 659].map(function (f, i) { return ["triangle", f, f, 0.14, 0.06, i * 0.13]; }),
    over: [392, 330, 262, 196].map(function (f, i) { return ["triangle", f, f, 0.25, 0.07, i * 0.22]; }),
  };
  SFX.extra = SFX.clear;
  var NAMES = Object.keys(SFX).filter(function (n) { return n !== "cash2"; }).sort();

  /* ================= the Web Audio player ================= */
  function create(win) {
    win = win || root;
    var A = null, on = false, mix = { music: DEF.music, sfx: DEF.sfx }, blip = 0;
    var M = { timer: 0, next: 0, bar: 0, step: 0, srcs: [], k: 0, power: false, wanted: false };
    var E = null, S = null, live = 0, made = 0, sq = 0, last = null;
    function track(n) { live++; made++; n.onended = function () { live--; }; return n; }
    function ctx() {
      if (!on) return null;
      if (!A) {
        var AC = win.AudioContext || win.webkitAudioContext; if (!AC) return null;
        try {
          var c = new AC(), master = c.createGain(), mBus = c.createGain(), mF = c.createBiquadFilter(), mDuck = c.createGain(), fx = c.createGain();
          master.gain.value = 0.35; master.connect(c.destination);
          mF.type = "lowpass"; mF.frequency.value = 3000; mBus.connect(mF); mF.connect(mDuck); mDuck.connect(master);
          fx.connect(master);
          A = { c: c, master: master, mBus: mBus, mF: mF, mDuck: mDuck, fx: fx, noise: null, crackle: null };
          mBus.gain.value = gainOf(mix.music) * 0.6; fx.gain.value = gainOf(mix.sfx);
          A.noise = buf(c, 2, function () { return Math.random() * 2 - 1; });
          A.crackle = crackleBuf(c, 2);
        } catch (e) { A = null; return null; }
      }
      if (A.c.state === "suspended") { try { A.c.resume(); } catch (e) { /* the next key */ } }
      return A;
    }
    function buf(c, secs, f) { var n = Math.floor(c.sampleRate * secs), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = f(i, n); return b; }
    /** a fire's crackle: sparse pops, each a few hundred microseconds of decaying noise */
    function crackleBuf(c, secs) {
      var n = Math.floor(c.sampleRate * secs), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), i = 0;
      while (i < n) { i += Math.floor(c.sampleRate * (0.004 + Math.random() * 0.03)); var a = 0.3 + Math.random() * 0.7, L = 12 + Math.floor(Math.random() * 40);
        for (var j = 0; j < L && i + j < n; j++) d[i + j] = (Math.random() * 2 - 1) * a * Math.exp(-j / (L / 4)); }
      return b;
    }
    /** an output for one sound: the effects bus, through a panner when panned */
    function out(a, pan) {
      if (!pan || !a.c.createStereoPanner) return a.fx;
      var p = a.c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(a.fx); return p;
    }
    function tone(a, dest, type, f0, f1, dur, vol, at) {
      var t = a.c.currentTime + (at || 0), o = track(a.c.createOscillator()), g = a.c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
      return o;
    }
    /** a burst of noise (or crackle) through a filter, fading out */
    function hiss(a, dest, dur, vol, at, filt, f, q, src) {
      var t = a.c.currentTime + (at || 0), s = track(a.c.createBufferSource()), g = a.c.createGain(), node = s;
      s.buffer = src || a.noise; s.loop = true;
      if (filt) { var bq = a.c.createBiquadFilter(); bq.type = filt; bq.frequency.value = f; if (q) bq.Q.value = q; s.connect(bq); node = bq; }
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      node.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
      return s;
    }
    /** a layered explosion: sub boom, crack, body, the fire's crackle tail, debris clinks */
    function blast(a, kind, pan) {
      var B = BLAST[kind] || BLAST.boom, d = out(a, pan);
      tone(a, d, "sine", B.sub[0], B.sub[1], B.sub[2], B.sub[3]);
      hiss(a, d, B.crack[0], B.crack[1], 0, "highpass", 900);
      hiss(a, d, B.body[0], B.body[1], 0.01, "lowpass", 700);
      hiss(a, d, B.fire[0], B.fire[1], 0.12, "bandpass", 2200, 0.8, a.crackle);
      hiss(a, d, B.fire[0] * 0.8, B.fire[1] * 0.5, 0.15, "lowpass", 400);
      debrisTimes(B.debris).forEach(function (t) {
        var f = 2400 + Math.random() * 2800;
        tone(a, d, Math.random() < 0.5 ? "triangle" : "sine", f, f * 0.92, 0.07, 0.035 + 0.01 * (B.debris / 2), t);
        hiss(a, d, 0.03, 0.05, t, "bandpass", f, 3);
      });
    }
    /** a tyre squeal: a narrow band of noise that slides down; 1 = a U-turn, 0.7 = a corner */
    function squeal(k, pan) {
      var a = ctx(); if (!a || !(k > 0)) return;
      sq++;
      var d = out(a, pan), t = a.c.currentTime, s = track(a.c.createBufferSource()), bq = a.c.createBiquadFilter(), g = a.c.createGain(), dur = 0.18 + 0.14 * k;
      s.buffer = a.noise; s.loop = true; bq.type = "bandpass"; bq.Q.value = 9; bq.frequency.setValueAtTime(2900, t); bq.frequency.exponentialRampToValueAtTime(1900, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * k, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bq); bq.connect(g); g.connect(d); s.start(t, Math.random()); s.stop(t + dur + 0.02);
    }
    function play(name, o) {
      var a = ctx(); if (!a) return false;
      if (name === "unlock") return true;
      if (name === "cash") { blip ^= 1; name = blip ? "cash" : "cash2"; }
      var r = SFX[name]; if (!r) return false;
      var pan = o && o.pan || 0, m0 = made;
      if (r === "blast") { blast(a, name, pan); if (name === "crash") tone(a, out(a, pan), "sawtooth", 200, 40, 0.5, 0.06); }
      else {
        var d = out(a, pan);
        r.forEach(function (L) { if (L[0] === "noise") hiss(a, d, L[1], L[2], L[3]); else tone(a, d, L[0], L[1], L[2], L[3], L[4], L[5]); });
        if (name === "dodge") squeal(0.8, pan);
      }
      last = { name: name.replace(/2$/, ""), layers: made - m0, pan: pan };
      return true;
    }

    /* ---- the music's sequencer: a look-ahead on the AudioContext clock ---- */
    function voice(a, v, t, sd) {
      var mb = a.mBus, keep = function (n) { var was = n.onended; n.onended = function () { if (was) was(); n._done = true; }; M.srcs.push(n); };
      if (v.v === "kick") { var o = track(a.c.createOscillator()), g = a.c.createGain(); o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.9 * v.vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(mb); o.start(t); o.stop(t + 0.22); keep(o); return; }
      if (v.v === "snare" || v.v === "hat" || v.v === "ohat") {
        var s = track(a.c.createBufferSource()), f = a.c.createBiquadFilter(), gg = a.c.createGain(), dur = v.v === "snare" ? 0.16 : v.v === "ohat" ? 0.14 : 0.04;
        s.buffer = a.noise; s.loop = true; f.type = "highpass"; f.frequency.value = v.v === "snare" ? 1200 : 7000;
        gg.gain.setValueAtTime((v.v === "snare" ? 0.38 : 0.11) * v.vel, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(gg); gg.connect(mb); s.start(t, Math.random()); s.stop(t + dur + 0.02); keep(s);
        if (v.v === "snare") { var b = track(a.c.createOscillator()), bg = a.c.createGain(); b.type = "triangle"; b.frequency.value = 190;
          bg.gain.setValueAtTime(0.12 * v.vel, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); b.connect(bg); bg.connect(mb); b.start(t); b.stop(t + 0.1); keep(b); }
        return;
      }
      var len = Math.max(1, v.len || 1) * sd, osc = track(a.c.createOscillator()), lp = a.c.createBiquadFilter(), env = a.c.createGain(), hz = midiHz(v.n);
      var vol = v.v === "bass" ? 0.2 : v.v === "lead" ? 0.075 : 0.06;
      osc.type = v.v === "bass" ? "sawtooth" : v.v === "lead" ? "square" : "triangle"; osc.frequency.value = hz;
      lp.type = "lowpass"; lp.frequency.value = v.v === "bass" ? 500 + 1100 * M.k : 3200;
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vol * v.vel, t + 0.008);
      env.gain.setValueAtTime(vol * v.vel, t + len * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + len * 0.95);
      osc.connect(lp); lp.connect(env); env.connect(mb); osc.start(t); osc.stop(t + len); keep(osc);
    }
    function tick() {
      var a = A; if (!a || !M.timer) return;
      if (M.next < a.c.currentTime) M.next = a.c.currentTime + 0.02;          // the tab slept: start again from now
      while (M.next < a.c.currentTime + 0.15) {
        var sd = 60 / bpmFor(M.k, M.power) / 4;
        stepNotes(M.bar, M.step, { intensity: M.k, power: M.power }).forEach(function (v) { voice(a, v, M.next, sd); });
        M.next += sd; M.step++; if (M.step >= STEPS) { M.step = 0; M.bar = (M.bar + 1) % BARS; }
      }
      M.srcs = M.srcs.filter(function (n) { return !n._done; });
      if (M.srcs.length > 400) M.srcs.splice(0, M.srcs.length - 400);
    }
    function musicStart() {
      var a = ctx(); if (!a || M.timer) return;
      M.next = a.c.currentTime + 0.06; M.bar = 0; M.step = 0;
      a.mDuck.gain.cancelScheduledValues(a.c.currentTime); a.mDuck.gain.setValueAtTime(1, a.c.currentTime);
      M.timer = win.setInterval(tick, 40); tick();
    }
    function musicStop() {
      if (M.timer) { win.clearInterval(M.timer); M.timer = 0; }
      M.srcs.forEach(function (n) { try { n.stop(); } catch (e) { /* done */ } }); M.srcs = [];
    }
    /* ---- the engine and the siren: two held voices ---- */
    function engineSet(n) {
      if (!n.on) { if (E) { var e = E; E = null; try { e.g.gain.setTargetAtTime(0, A.c.currentTime, 0.03); e.a.stop(A.c.currentTime + 0.15); e.b.stop(A.c.currentTime + 0.15); } catch (x) { /* stopped */ } } return; }
      var a = ctx(); if (!a) return;
      var t = a.c.currentTime;
      if (!E) {
        var o1 = track(a.c.createOscillator()), o2 = track(a.c.createOscillator()), lp = a.c.createBiquadFilter(), g = a.c.createGain();
        o1.type = "sawtooth"; o2.type = "square"; lp.type = "lowpass"; lp.Q.value = 2; g.gain.value = 0;
        o1.frequency.value = n.f; o2.frequency.value = n.f * 0.502;
        o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(a.fx); o1.start(); o2.start();
        E = { a: o1, b: o2, lp: lp, g: g };
      }
      E.a.frequency.setTargetAtTime(n.f, t, 0.08); E.b.frequency.setTargetAtTime(n.f * 0.502, t, 0.08);
      E.lp.frequency.setTargetAtTime(n.cut, t, 0.1); E.g.gain.setTargetAtTime(n.g, t, 0.08);
    }
    function sirenSet(near) {
      var v = near === Infinity || !(near >= 0) ? 0 : Math.max(0, Math.min(0.06, 0.06 * (1 - near / 10)));
      if (!(near < Infinity)) { if (S) { try { S.o.stop(); } catch (e) { /* stopped */ } S = null; } return; }
      var a = ctx(); if (!a) return;
      if (!S) { var o = track(a.c.createOscillator()), g = a.c.createGain(); o.type = "sine"; g.gain.value = 0; o.connect(g); g.connect(a.fx); o.start(); S = { o: o, g: g }; }
      var t = a.c.currentTime;
      S.g.gain.setTargetAtTime(v, t, 0.1);
      S.o.frequency.setTargetAtTime(Math.floor(t / 0.45) % 2 ? 960 : 720, t, 0.02);
    }
    function stopAll() { musicStop(); engineSet({ on: false }); sirenSet(Infinity); }

    return {
      /** the master switch (M / 🔇): off = everything stopped and the context suspended */
      on: function (v) { on = !!v; if (!on) { stopAll(); if (A && A.c.state === "running") { try { A.c.suspend(); } catch (e) { /* fine */ } } } return on; },   // made on first use (a key / click)
      unlock: function () { return !!ctx(); },
      play: play, squeal: squeal,
      mix: function (music, sfx) {
        mix.music = clampVol(music, mix.music); mix.sfx = clampVol(sfx, mix.sfx);
        if (A) { var t = A.c.currentTime; A.mBus.gain.setTargetAtTime(gainOf(mix.music) * 0.6, t, 0.03); A.fx.gain.setTargetAtTime(gainOf(mix.sfx), t, 0.03); }
        return { music: mix.music, sfx: mix.sfx };
      },
      /** once a frame (and four times a second): st = {music, paused, busted, near, power, engine {play, moving, speed, base,
       *  turbo, slowed}, siren} - what should sound now; anything not asked for stops */
      frame: function (st) {
        if (!on) return;
        st = st || {};
        var want = st.music || (st.engine && st.engine.play) || st.siren;
        if (!want) { stopAll(); return; }
        var a = ctx(); if (!a) return;                                       // (wakes a resting context)
        M.k = st.busted || st.paused ? M.k : intensityFor(st.near); M.power = !!st.power;
        if (st.music) musicStart(); else musicStop();
        var mm = musicMix({ paused: st.paused, busted: st.busted, intensity: M.k, power: M.power }), t = a.c.currentTime;
        a.mF.frequency.setTargetAtTime(mm.cut, t, 0.15); a.mDuck.gain.setTargetAtTime(mm.gain, t, 0.15);
        engineSet(engineNote(st.engine));
        sirenSet(st.siren ? st.near : Infinity);
      },
      stopAll: stopAll,
      /** off-screen / the window in the background: stop and let the sound card rest */
      rest: function () { stopAll(); if (A && A.c.state === "running") { try { A.c.suspend(); } catch (e) { /* fine */ } } },
      info: function () { return { ctx: A ? A.c.state : "none", on: on, music: !!M.timer, engine: !!E, siren: !!S, live: live, made: made, k: M.k, power: M.power,
                                   bpm: bpmFor(M.k, M.power), mix: { music: mix.music, sfx: mix.sfx },
                                   squeals: sq, last: last, engineHz: E ? E.a.frequency.value : 0, cut: A ? A.mF.frequency.value : 0 }; },
    };
  }

  var API = { DEF: DEF, SFX: SFX, NAMES: NAMES, BLAST: BLAST, STEPS: STEPS, BARS: BARS, LEAD: LEAD, BASS: BASS, CHORDS: CHORDS,
              clampVol: clampVol, gainOf: gainOf, prefs: prefs, midiHz: midiHz, intensityFor: intensityFor, bpmFor: bpmFor,
              stepNotes: stepNotes, musicMix: musicMix, engineNote: engineNote, turned: turned, debrisTimes: debrisTimes,
              panOf: panOf, create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.H3ChaseSound = API;
})(typeof window !== "undefined" ? window : this);
