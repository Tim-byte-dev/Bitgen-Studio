/* bitGen Studio — ext/synthdock/synthcore.js (2.953.0): 🎹 THE SYNTH STATION's rules (window.H3SynthCore) - pure, no DOM,
 * no WebAudio (Node: scripts/test-953.js).
 * Tim: "can we add a synthstation that looks something like this in Audio docker with a midi keyboard and hammer head style
 * looper that the user can add new samples to ?" - our own synth (its own names and sounds), a MIDI keyboard and a step
 * looper with rows of samples.
 *   Notes     freq(midi), noteName(midi), KEYS (the computer keys -> semitones above the keyboard's octave)
 *   The synth PARAMS (every knob: section, range, curve, default), toNorm / fromNorm (a knob's 0..1 <-> its value),
 *             defaults(), PRESETS (our own patches), patch(name) / cleanPatch(p)
 *   The loop  ROWS (8 rows of sounds), newLoop(), cleanLoop(j) (a save / an import made safe), toggle(), audible(),
 *             stepTime(i, bpm, swing), order(loop) (the patterns a pass plays: ⛓ chain = every pattern with a step on),
 *             events(loop, passes) (every hit with its time - the ⬇ WAV render)
 *   WAV       wav(channels, sampleRate) -> Uint8Array (16-bit PCM)
 */
(function (root) {
  "use strict";
  var NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function noteName(m) { m = Math.round(m); return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
  function isBlack(m) { return [1, 3, 6, 8, 10].indexOf(((m % 12) + 12) % 12) >= 0; }
  // two rows of the computer keyboard as a piano (KeyboardEvent.code - the same on every layout): Z row = the octave shown,
  // Q row = the one above; the black keys on the row above each
  var KEYS = { KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
               Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
               KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22,
               KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28, BracketLeft: 29, Equal: 30, BracketRight: 31 };

  /* ---------------- the synth's knobs ---------------- */
  var WAVES = ["saw", "square", "triangle", "sine"];
  // sec = the panel it sits on; c = curve (lin | exp | int); ch = a choice (its values)
  var PARAMS = [
    { id: "aWave", sec: "osc", label: "Wave A", ch: WAVES, def: "saw" },
    { id: "aOct", sec: "osc", label: "Oct A", min: -2, max: 2, def: 0, c: "int" },
    { id: "aDet", sec: "osc", label: "Fine A", min: -50, max: 50, def: 0, unit: "ct" },
    { id: "aLvl", sec: "osc", label: "Level A", min: 0, max: 1, def: 0.8 },
    { id: "bWave", sec: "osc", label: "Wave B", ch: WAVES, def: "square" },
    { id: "bSemi", sec: "osc", label: "Semi B", min: -24, max: 24, def: 0, c: "int", unit: "st" },
    { id: "bDet", sec: "osc", label: "Fine B", min: -50, max: 50, def: 7, unit: "ct" },
    { id: "bLvl", sec: "osc", label: "Level B", min: 0, max: 1, def: 0.4 },
    { id: "sub", sec: "osc", label: "Sub", min: 0, max: 1, def: 0 },
    { id: "noise", sec: "osc", label: "Noise", min: 0, max: 1, def: 0 },
    { id: "uni", sec: "osc", label: "Unison", min: 1, max: 7, def: 1, c: "int" },
    { id: "spread", sec: "osc", label: "Spread", min: 0, max: 60, def: 18, unit: "ct" },
    { id: "fType", sec: "filter", label: "Type", ch: ["lowpass", "highpass", "bandpass"], def: "lowpass" },
    { id: "cut", sec: "filter", label: "Cutoff", min: 40, max: 18000, def: 2400, c: "exp", unit: "Hz" },
    { id: "res", sec: "filter", label: "Reso", min: 0, max: 20, def: 2 },
    { id: "fEnv", sec: "filter", label: "Env amt", min: -1, max: 1, def: 0.35 },
    { id: "kTrack", sec: "filter", label: "Key trk", min: 0, max: 1, def: 0.4 },
    { id: "drive", sec: "filter", label: "Drive", min: 0, max: 1, def: 0.1 },
    { id: "fA", sec: "fenv", label: "A", min: 0.001, max: 5, def: 0.005, c: "exp", unit: "s" },
    { id: "fD", sec: "fenv", label: "D", min: 0.005, max: 5, def: 0.35, c: "exp", unit: "s" },
    { id: "fS", sec: "fenv", label: "S", min: 0, max: 1, def: 0.3 },
    { id: "fR", sec: "fenv", label: "R", min: 0.005, max: 8, def: 0.4, c: "exp", unit: "s" },
    { id: "aA", sec: "aenv", label: "A", min: 0.001, max: 5, def: 0.004, c: "exp", unit: "s" },
    { id: "aD", sec: "aenv", label: "D", min: 0.005, max: 5, def: 0.3, c: "exp", unit: "s" },
    { id: "aS", sec: "aenv", label: "S", min: 0, max: 1, def: 0.75 },
    { id: "aR", sec: "aenv", label: "R", min: 0.005, max: 8, def: 0.35, c: "exp", unit: "s" },
    { id: "lTarget", sec: "lfo", label: "Target", ch: ["cutoff", "pitch", "amp", "pan"], def: "cutoff" },
    { id: "lWave", sec: "lfo", label: "Shape", ch: ["sine", "triangle", "square", "sawtooth"], def: "sine" },
    { id: "lRate", sec: "lfo", label: "Rate", min: 0.05, max: 20, def: 2, c: "exp", unit: "Hz" },
    { id: "lDepth", sec: "lfo", label: "Depth", min: 0, max: 1, def: 0 },
    { id: "chorus", sec: "fx", label: "Chorus", min: 0, max: 1, def: 0.15 },
    { id: "dTime", sec: "fx", label: "Delay", min: 0.03, max: 1.2, def: 0.33, c: "exp", unit: "s" },
    { id: "dFb", sec: "fx", label: "Feedback", min: 0, max: 0.9, def: 0.35 },
    { id: "dMix", sec: "fx", label: "Dly mix", min: 0, max: 1, def: 0.12 },
    { id: "rSize", sec: "fx", label: "Space", min: 0.3, max: 8, def: 2.2, c: "exp", unit: "s" },
    { id: "rMix", sec: "fx", label: "Rev mix", min: 0, max: 1, def: 0.2 },
    { id: "mode", sec: "master", label: "Voices", ch: ["poly", "mono"], def: "poly" },
    { id: "glide", sec: "master", label: "Glide", min: 0, max: 1, def: 0, unit: "s" },
    { id: "vol", sec: "master", label: "Volume", min: 0, max: 1, def: 0.7 },
  ];
  var BY = {}; PARAMS.forEach(function (p) { BY[p.id] = p; });
  // the panels, left to right, and their glow
  var SECTIONS = [
    { id: "osc", name: "Oscillators", color: "#38e1ff" }, { id: "filter", name: "Filter", color: "#ff4fd8" },
    { id: "fenv", name: "Filter env", color: "#b78cff" }, { id: "aenv", name: "Amp env", color: "#ffae3a" },
    { id: "lfo", name: "LFO", color: "#5dff8a" }, { id: "fx", name: "Effects", color: "#4f9dff" }, { id: "master", name: "Master", color: "#f4f1e8" },
  ];
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  /** a knob's position 0..1 for a value (a choice: its index spread over 0..1) */
  function toNorm(id, v) {
    var p = BY[id]; if (!p) return 0;
    if (p.ch) { var i = p.ch.indexOf(v); return p.ch.length > 1 ? Math.max(0, i) / (p.ch.length - 1) : 0; }
    v = clamp(Number(v), p.min, p.max);
    if (p.c === "exp") return Math.log(v / p.min) / Math.log(p.max / p.min);
    return (v - p.min) / (p.max - p.min);
  }
  /** the value at a knob position 0..1 (whole numbers for an int knob, a choice's value) */
  function fromNorm(id, n) {
    var p = BY[id]; if (!p) return 0;
    n = clamp(Number(n) || 0, 0, 1);
    if (p.ch) return p.ch[Math.round(n * (p.ch.length - 1))];
    var v = p.c === "exp" ? p.min * Math.pow(p.max / p.min, n) : p.min + n * (p.max - p.min);
    if (p.c === "int") return Math.round(v);
    return Math.round(v * 10000) / 10000;
  }
  /** one value made safe: in range, a known choice, else the default */
  function cleanValue(id, v) {
    var p = BY[id]; if (!p) return undefined;
    if (p.ch) return p.ch.indexOf(v) >= 0 ? v : p.def;
    var n = Number(v);
    if (!Number.isFinite(n)) return p.def;
    n = clamp(n, p.min, p.max);
    return p.c === "int" ? Math.round(n) : n;
  }
  function defaults() { var o = {}; PARAMS.forEach(function (p) { o[p.id] = p.def; }); return o; }
  /** a patch from anywhere (a save, a preset file): every knob there, every value safe; unknown keys dropped */
  function cleanPatch(j) {
    var o = defaults(), src = j && typeof j === "object" ? j : {};
    PARAMS.forEach(function (p) { if (src[p.id] !== undefined) o[p.id] = cleanValue(p.id, src[p.id]); });
    return o;
  }
  function show(id, v) {
    var p = BY[id]; if (!p) return String(v);
    if (p.ch) return String(v);
    if (p.unit === "Hz") return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + " kHz" : (v < 10 ? v.toFixed(2) : Math.round(v)) + " Hz";
    if (p.unit === "s") return v < 1 ? Math.round(v * 1000) + " ms" : v.toFixed(2) + " s";
    if (p.unit === "ct") return Math.round(v) + " ct";
    if (p.unit === "st") return (v > 0 ? "+" : "") + Math.round(v) + " st";
    if (p.c === "int") return (p.min < 0 && v > 0 ? "+" : "") + Math.round(v);
    if (p.min < 0) return (v > 0 ? "+" : "") + Math.round(v * 100) + "%";
    if (p.max === 1) return Math.round(v * 100) + "%";
    return (Math.round(v * 100) / 100).toString();
  }

  // our own patches (named by us) - each is the knobs that differ from the defaults
  var PRESETS = [
    { name: "Init", p: {} },
    { name: "Neon Lead", p: { aWave: "saw", bWave: "saw", bDet: 12, bLvl: 0.6, uni: 3, spread: 14, cut: 3800, res: 4, fEnv: 0.3, aR: 0.25, glide: 0.04, lTarget: "pitch", lRate: 5.5, lDepth: 0.08, dMix: 0.18, rMix: 0.18 } },
    { name: "Glass Pad", p: { aWave: "triangle", bWave: "sine", bSemi: 12, bLvl: 0.5, uni: 5, spread: 22, cut: 2600, res: 1, fEnv: 0.15, fA: 1.2, fD: 2, fS: 0.6, aA: 1.4, aD: 1.5, aS: 0.85, aR: 2.6, chorus: 0.55, rSize: 5.5, rMix: 0.5, dMix: 0.1 } },
    { name: "Deep Sub Bass", p: { aWave: "sine", aOct: -1, bWave: "triangle", bLvl: 0.25, sub: 0.7, cut: 420, res: 1, fEnv: 0.2, aA: 0.002, aD: 0.4, aS: 0.9, aR: 0.12, mode: "mono", glide: 0.03, chorus: 0, rMix: 0, dMix: 0 } },
    { name: "Silver Pluck", p: { aWave: "saw", bWave: "square", bSemi: 12, bLvl: 0.3, cut: 900, res: 6, fEnv: 0.7, fA: 0.001, fD: 0.22, fS: 0, aA: 0.001, aD: 0.45, aS: 0, aR: 0.3, dTime: 0.375, dFb: 0.42, dMix: 0.28, rMix: 0.22 } },
    { name: "Acid Line", p: { aWave: "saw", bLvl: 0, cut: 380, res: 15, fEnv: 0.8, fA: 0.001, fD: 0.18, fS: 0.05, aA: 0.001, aD: 0.25, aS: 0.6, aR: 0.08, drive: 0.55, mode: "mono", glide: 0.06, chorus: 0, rMix: 0.08, dMix: 0.15 } },
    { name: "Warm Strings", p: { aWave: "saw", bWave: "saw", bDet: -9, bLvl: 0.7, uni: 5, spread: 26, cut: 1900, res: 0.5, fEnv: 0.1, aA: 0.45, aD: 0.8, aS: 0.85, aR: 1.2, lTarget: "pitch", lRate: 4.8, lDepth: 0.04, chorus: 0.45, rSize: 3.5, rMix: 0.35 } },
    { name: "Bell Keys", p: { aWave: "sine", bWave: "sine", bSemi: 19, bDet: 3, bLvl: 0.45, cut: 7000, res: 0, fEnv: 0, aA: 0.001, aD: 1.8, aS: 0.05, aR: 1.6, chorus: 0.2, rSize: 3, rMix: 0.32, dMix: 0.14 } },
    { name: "Wobble Bass", p: { aWave: "saw", aOct: -1, bWave: "square", bSemi: -12, bLvl: 0.5, sub: 0.4, cut: 700, res: 9, fEnv: 0.1, lTarget: "cutoff", lWave: "triangle", lRate: 3, lDepth: 0.75, drive: 0.4, mode: "mono", glide: 0.05, chorus: 0, rMix: 0.05, dMix: 0 } },
    { name: "Brass Stab", p: { aWave: "saw", bWave: "saw", bDet: 8, bLvl: 0.8, uni: 2, spread: 10, cut: 1200, res: 2, fEnv: 0.55, fA: 0.03, fD: 0.3, fS: 0.35, aA: 0.02, aD: 0.4, aS: 0.7, aR: 0.2, rMix: 0.2 } },
    { name: "Soft Organ", p: { aWave: "sine", bWave: "sine", bSemi: 12, bLvl: 0.6, sub: 0.35, cut: 5000, res: 0, fEnv: 0, aA: 0.01, aD: 0.1, aS: 1, aR: 0.12, lTarget: "amp", lRate: 6, lDepth: 0.15, chorus: 0.35, rMix: 0.25 } },
    { name: "Dream Choir", p: { aWave: "triangle", bWave: "saw", bSemi: 7, bLvl: 0.25, uni: 7, spread: 30, noise: 0.05, fType: "bandpass", cut: 1400, res: 3, fEnv: 0.05, aA: 0.9, aD: 1, aS: 0.9, aR: 2.2, lTarget: "cutoff", lRate: 0.4, lDepth: 0.3, chorus: 0.6, rSize: 6.5, rMix: 0.55 } },
    { name: "Chip Lead", p: { aWave: "square", bWave: "square", bSemi: 12, bDet: 0, bLvl: 0.2, cut: 9000, res: 0, fEnv: 0, aA: 0.001, aD: 0.1, aS: 0.8, aR: 0.05, mode: "mono", glide: 0.02, lTarget: "pitch", lRate: 7, lDepth: 0.06, chorus: 0, rMix: 0.08, dMix: 0.12, dTime: 0.18 } },
    { name: "Noise Sweep", p: { aLvl: 0.2, bLvl: 0, noise: 0.9, fType: "bandpass", cut: 300, res: 10, fEnv: 0.9, fA: 1.5, fD: 2, fS: 0.2, aA: 0.6, aD: 1.5, aS: 0.6, aR: 1.8, rSize: 5, rMix: 0.5, dMix: 0.2 } },
  ];
  function patch(name) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].name === name) { var o = cleanPatch(PRESETS[i].p); return o; }
    return null;
  }

  /* ---------------- the loop ---------------- */
  var STEPS = 16, NPAT = 8, NROWS = 8, PAT_NAMES = "ABCDEFGH";
  // the built-in kit (synthkit.js makes the sounds); a row's sound is "kit:<id>", "my:<file>" (the samples library) or
  // "sfx:<file>" (this project's sound effects); 2.954.0: "snd:<file>" (the Sound assets) and "out:<file>" (songs, the gallery)
  var KIT = [["kick", "Kick"], ["boom", "Boom (808)"], ["snare", "Snare"], ["clap", "Clap"], ["chat", "Hat closed"], ["ohat", "Hat open"],
             ["tom", "Tom"], ["rim", "Rim"], ["cowbell", "Cowbell"], ["shaker", "Shaker"], ["zap", "Zap"], ["crash", "Crash"]];
  var ROWS = ["kit:kick", "kit:snare", "kit:clap", "kit:chat", "kit:ohat", "kit:tom", "kit:rim", "kit:shaker"];
  function grid(fill) { var g = []; for (var r = 0; r < NROWS; r++) { var row = []; for (var s = 0; s < STEPS; s++) row.push(0); g.push(row); } if (fill) fill(g); return g; }
  function on(g, r, steps, v) { steps.forEach(function (s) { g[r][s] = v || 1; }); }
  function newLoop() {
    var pats = [];
    pats.push(grid(function (g) { on(g, 0, [0, 4, 8, 12]); on(g, 2, [4, 12]); on(g, 3, [2, 6, 10, 14]); on(g, 4, [14]); on(g, 7, [1, 3, 5, 7, 9, 11, 13, 15]); g[0][0] = 2; }));   // A: four on the floor
    pats.push(grid(function (g) { on(g, 0, [0, 6, 10]); on(g, 1, [4, 12]); g[1][12] = 2; on(g, 3, [0, 2, 4, 6, 8, 10, 12, 14]); on(g, 6, [7, 15]); on(g, 5, [14, 15]); }));     // B: a break
    pats.push(grid(function (g) { on(g, 0, [0, 3, 8, 11]); on(g, 1, [4, 12]); on(g, 3, [0, 2, 4, 6, 8, 10, 12, 14]); g[3][6] = 2; on(g, 2, [12]); }));                           // C: hip-hop
    for (var i = 3; i < NPAT; i++) pats.push(grid());
    return { v: 1, bpm: 120, swing: 0, pat: 0, chain: false,
             rows: ROWS.map(function (snd) { return { snd: snd, vol: 0.8, pitch: 0, pan: 0, mute: false, solo: false }; }), pats: pats };
  }
  function okSnd(s) { return typeof s === "string" && /^(kit|my|sfx|snd|out):[^\u0000-\u001f<>]{1,160}$/.test(s) && s.indexOf("..") < 0 ? s : null; }
  /** a loop from a save / a file: always 8 rows x 16 steps x 8 patterns, values 0 / 1 / 2, ranges kept */
  function cleanLoop(j) {
    var d = newLoop();
    if (!j || typeof j !== "object") return d;
    var o = { v: 1, bpm: clamp(Math.round(Number(j.bpm) || d.bpm), 40, 240), swing: clamp(Number(j.swing) || 0, 0, 0.5),
              pat: clamp(Math.floor(Number(j.pat) || 0), 0, NPAT - 1), chain: !!j.chain, rows: [], pats: [] };
    for (var r = 0; r < NROWS; r++) {
      var x = (Array.isArray(j.rows) && j.rows[r]) || {}, dr = d.rows[r];
      o.rows.push({ snd: okSnd(x.snd) || dr.snd, vol: Number.isFinite(+x.vol) ? clamp(+x.vol, 0, 1) : dr.vol,
                    pitch: Number.isFinite(+x.pitch) ? clamp(Math.round(+x.pitch), -24, 24) : 0, pan: Number.isFinite(+x.pan) ? clamp(+x.pan, -1, 1) : 0,
                    mute: !!x.mute, solo: !!x.solo });
    }
    for (var p = 0; p < NPAT; p++) {
      var src = Array.isArray(j.pats) ? j.pats[p] : null;
      o.pats.push(grid(function (g) {
        for (var rr = 0; rr < NROWS; rr++) for (var s = 0; s < STEPS; s++) {
          var v = src && src[rr] ? Math.round(Number(src[rr][s])) : (Array.isArray(j.pats) ? 0 : d.pats[p][rr][s]);
          g[rr][s] = v === 1 || v === 2 ? v : 0;
        }
      }));
    }
    return o;
  }
  /** a pad: click = on / off; accent = on with an accent / back to plain */
  function toggle(loop, p, r, s, accent) {
    var g = loop.pats[p], v = g[r][s];
    g[r][s] = accent ? (v === 2 ? 1 : 2) : (v ? 0 : 1);
    return g[r][s];
  }
  function audible(loop, r) {
    var solo = loop.rows.some(function (x) { return x.solo; }), x = loop.rows[r];
    return !!x && !x.mute && (!solo || x.solo);
  }
  function stepDur(bpm) { return 60 / bpm / 4; }
  /** when step i (0..15) of a bar starts (seconds from the bar's start) - the off-beats pushed by the swing (0.33 ~ triplets) */
  function stepTime(i, bpm, swing) { var d = stepDur(bpm); return i * d + (i % 2 === 1 ? clamp(swing || 0, 0, 0.5) * d : 0); }
  function hasSteps(loop, p) { return loop.pats[p].some(function (row) { return row.some(function (v) { return v > 0; }); }); }
  /** the patterns one pass plays: ⛓ chain = every pattern with a step on, in order (none = the one picked); else the one picked */
  function order(loop) {
    if (!loop.chain) return [loop.pat];
    var o = []; for (var p = 0; p < NPAT; p++) if (hasSteps(loop, p)) o.push(p);
    return o.length ? o : [loop.pat];
  }
  /** every hit of `passes` passes: [{t, row, vel, bar, step}] (accent = 1, plain = 0.7), silent rows left out; + the length */
  function events(loop, passes) {
    var ord = order(loop), bar = 16 * stepDur(loop.bpm), out = [], n = 0;
    passes = Math.max(1, Math.min(64, Math.floor(passes) || 1));
    for (var k = 0; k < passes; k++) ord.forEach(function (p) {
      for (var s = 0; s < STEPS; s++) for (var r = 0; r < NROWS; r++) {
        var v = loop.pats[p][r][s];
        if (v && audible(loop, r)) out.push({ t: n * bar + stepTime(s, loop.bpm, loop.swing), row: r, vel: v === 2 ? 1 : 0.7, bar: n, step: s, pat: p });
      }
      n++;
    });
    out.sort(function (a, b) { return a.t - b.t || a.row - b.row; });
    return { events: out, seconds: n * bar, bars: n };
  }

  /* ---------------- WAV ---------------- */
  /** 16-bit PCM WAV of one or more channels (Float32Array / arrays, -1..1, clipped) */
  function wav(chans, sr) {
    chans = chans && chans.length ? chans : [new Float32Array(0)];
    var nc = chans.length, n = chans[0].length, bytes = 44 + n * nc * 2, buf = new ArrayBuffer(bytes), v = new DataView(buf), o = 0;
    function s(t) { for (var i = 0; i < t.length; i++) v.setUint8(o++, t.charCodeAt(i)); }
    function u32(x) { v.setUint32(o, x, true); o += 4; }
    function u16(x) { v.setUint16(o, x, true); o += 2; }
    s("RIFF"); u32(bytes - 8); s("WAVE"); s("fmt "); u32(16); u16(1); u16(nc); u32(sr); u32(sr * nc * 2); u16(nc * 2); u16(16); s("data"); u32(n * nc * 2);
    for (var i = 0; i < n; i++) for (var c = 0; c < nc; c++) {
      var x = Number(chans[c][i]) || 0; x = x > 1 ? 1 : x < -1 ? -1 : x;
      v.setInt16(o, x < 0 ? Math.round(x * 32768) : Math.round(x * 32767), true); o += 2;
    }
    return new Uint8Array(buf);
  }

  var api = { NAMES: NAMES, freq: freq, noteName: noteName, isBlack: isBlack, KEYS: KEYS, WAVES: WAVES, PARAMS: PARAMS, BY: BY, SECTIONS: SECTIONS,
              toNorm: toNorm, fromNorm: fromNorm, cleanValue: cleanValue, defaults: defaults, cleanPatch: cleanPatch, show: show, PRESETS: PRESETS, patch: patch,
              STEPS: STEPS, NPAT: NPAT, NROWS: NROWS, PAT_NAMES: PAT_NAMES, KIT: KIT, ROWS: ROWS, newLoop: newLoop, cleanLoop: cleanLoop, okSnd: okSnd, toggle: toggle,
              audible: audible, stepDur: stepDur, stepTime: stepTime, hasSteps: hasSteps, order: order, events: events, wav: wav, clamp: clamp };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthCore = api;
})(typeof window !== "undefined" ? window : globalThis);
