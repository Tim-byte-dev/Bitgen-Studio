/* bitGen Studio — ext/synthdock/synthinst.js (2.972.0): 🎹 THE KEYBOARD'S INSTRUMENTS (window.H3SynthInst) - pure, no DOM, no
 * WebAudio (Node: scripts/test-972.js). Loaded before synthcore.js, which adds these to its PRESETS.
 *
 * Tim: "Add preset instruments to the keyboard like piano, organ, and all the other synthesized sounds on the electronic
 * keyboards" - the voice list of a home keyboard (pianos, electric pianos, mallets, organs, guitars, basses, strings, choir,
 * brass, reeds, pipes, leads, pads, world), every one MADE here (no recordings, no sample files, generic names only).
 *
 * Four ways of making a sound besides the plain synth (synthcore.js PARAMS "tone", set by these presets - no knob):
 *   fm      two-operator FM: osc A is the carrier, a sine modulator at fmR x the note, its depth fmI falling (fmD, fmS) -
 *           electric pianos, mallets, bells, kalimba, rubber bass
 *   organ   drawbars: nine sine "pipes" (16' 5 1/3' 8' 4' 2 2/3' 2' 1 3/5' 1 1/3' 1'), each 0-8 like a tonewheel organ's
 *           bars (bars "888000000"), one PeriodicWave; + a key click
 *   pluck   a plucked string (Karplus-Strong): a burst of noise round a delay as long as one period, losing its highs every
 *           pass (kDamp = brightness, kSus = seconds to fade) - guitars, basses, harp, harpsichord, clav, koto, pizzicato
 *   strike  a struck string: up to 48 partials, slightly sharp as they go up (stB, the stiffness of a piano string), each
 *           dying faster than the one below in two stages, two strings a few cents apart (stDet - the beating), the hammer's
 *           thump (stHam), a hole at the 7th partial (where the hammer hits) - pianos, music box, timpani
 *   pluck / strike notes are made once per zone of 3 keys (like a keyboard's multisamples) and played a semitone up / down
 *   from there; the engine (synthvoice.js) keeps them.
 *
 *   CATS          the voice buttons on the deck, in order: [id, label, icon]
 *   INSTRUMENTS   [{name, cat, p}] - p = the knobs that differ from the defaults (BASE per tone added by synthcore)
 *   BASE          what every instrument of a tone starts from (no delay, no drive, the filter open...)
 *   drawbars(bars)            -> {real, imag} (Float32Array 17) for createPeriodicWave - played an octave down (16' = 1st)
 *   pluck(f, sr, o)           -> Float32Array (o: damp, sus, seed)
 *   strike(f, sr, o)          -> Float32Array (o: damp, sus, B, ham, det, seed)
 *   zone(m)                   -> the key a note's sound is made at (every 3rd key)
 */
(function (root) {
  "use strict";
  var CATS = [["Piano", "PIANO", "🎹"], ["Mallets", "MALLET", "🔔"], ["Organ", "ORGAN", "⛪"], ["Guitar", "GUITAR", "🎸"], ["Bass", "BASS", "🎸"],
              ["Strings", "STRINGS", "🎻"], ["Choir", "CHOIR", "🗣"], ["Brass", "BRASS", "🎺"], ["Reed", "REED", "🎷"], ["Pipe", "PIPE", "🪈"],
              ["Lead", "LEAD", "⚡"], ["Pad", "PAD", "🌫"], ["World", "WORLD", "🌏"], ["Synth", "SYNTH", "🎛"]];
  // every instrument starts open and dry; then what its tone needs
  var DRY = { drive: 0, dMix: 0, chorus: 0, rMix: 0.18, res: 0, fEnv: 0, kTrack: 0, cut: 18000, uni: 1 };
  var BASE = {
    synth: DRY,
    fm: Object.assign({}, DRY, { tone: "fm", aWave: "sine", bLvl: 0, aA: 0.001, aD: 2.5, aS: 0, aR: 0.4 }),
    organ: Object.assign({}, DRY, { tone: "organ", aWave: "sine", aLvl: 0.8, bLvl: 0, aA: 0.005, aD: 0.1, aS: 1, aR: 0.06, click: 0.35 }),
    pluck: Object.assign({}, DRY, { tone: "pluck", aLvl: 0, bLvl: 0, aA: 0.001, aD: 1, aS: 1, aR: 0.25 }),
    strike: Object.assign({}, DRY, { tone: "strike", aLvl: 0, bLvl: 0, aA: 0.001, aD: 1, aS: 1, aR: 0.35 }),
  };
  function I(name, cat, tone, p) { return { name: name, cat: cat, p: Object.assign({}, BASE[tone], p || {}) }; }
  var VIB = function (rate, depth) { return { lTarget: "pitch", lWave: "sine", lRate: rate, lDepth: depth }; };
  var M = function () { var o = {}; for (var i = 0; i < arguments.length; i++) Object.assign(o, arguments[i]); return o; };

  var INSTRUMENTS = [
    // ---- pianos
    I("Grand Piano", "Piano", "strike", { kDamp: 0.55, kSus: 2.6, stB: 0.0004, stHam: 0.35, stDet: 1.2, fVel: 0.7, cut: 9000, kTrack: 0.3, rMix: 0.22, rSize: 2.4 }),
    I("Bright Piano", "Piano", "strike", { kDamp: 0.82, kSus: 2.2, stB: 0.0005, stHam: 0.45, stDet: 1.4, fVel: 0.5, cut: 14000, kTrack: 0.3, rMix: 0.2 }),
    I("Mellow Piano", "Piano", "strike", { kDamp: 0.3, kSus: 2.8, stB: 0.0003, stHam: 0.25, stDet: 1, fVel: 0.8, cut: 5000, kTrack: 0.4, rMix: 0.28, rSize: 2.8 }),
    I("Honky-Tonk Piano", "Piano", "strike", { kDamp: 0.62, kSus: 2, stB: 0.0005, stHam: 0.4, stDet: 5.5, fVel: 0.5, cut: 10000, chorus: 0.15, rMix: 0.15 }),
    I("Electric Grand", "Piano", "strike", { kDamp: 0.66, kSus: 1.8, stB: 0.0002, stHam: 0.2, stDet: 2, fVel: 0.4, cut: 9000, chorus: 0.45, rMix: 0.2 }),
    I("Tine E.Piano", "Piano", "fm", { fmR: 1, fmI: 2.4, fmD: 0.8, fmS: 0.15, bWave: "sine", bSemi: 24, bLvl: 0.1, aD: 4, aR: 0.45, fVel: 0.4, cut: 6000, lTarget: "pan", lRate: 3.5, lDepth: 0.45, chorus: 0.25 }),
    I("Reed E.Piano", "Piano", "fm", { fmR: 1, fmI: 3.5, fmD: 0.35, fmS: 0.25, aD: 3, aR: 0.3, drive: 0.35, fVel: 0.6, cut: 5000, lTarget: "amp", lRate: 5.5, lDepth: 0.25 }),
    I("Glass E.Piano", "Piano", "fm", { fmR: 14, fmI: 1.2, fmD: 0.25, fmS: 0, bWave: "sine", bSemi: 0, bDet: 0, bLvl: 0.55, aD: 3.5, aS: 0.05, aR: 0.6, chorus: 0.4, rMix: 0.25 }),
    I("Harpsichord", "Piano", "pluck", { kDamp: 0.95, kSus: 3, cut: 12000, aR: 0.15, rMix: 0.25, rSize: 2 }),
    I("Funk Clav", "Piano", "pluck", { kDamp: 0.9, kSus: 1.2, fType: "bandpass", cut: 1800, res: 2, fEnv: 0.4, fA: 0.001, fD: 0.25, fS: 0.5, fVel: 0.5, aR: 0.08, drive: 0.2, rMix: 0.08 }),
    // ---- mallets and bells
    I("Vibraphone", "Mallets", "fm", { fmR: 4, fmI: 0.8, fmD: 0.15, fmS: 0, aD: 4, aR: 1.2, lTarget: "amp", lRate: 5, lDepth: 0.3, rMix: 0.25 }),
    I("Marimba", "Mallets", "fm", { fmR: 4, fmI: 1.8, fmD: 0.05, fmS: 0, aD: 0.9, aR: 0.3, rMix: 0.2 }),
    I("Xylophone", "Mallets", "fm", { fmR: 4, fmI: 3, fmD: 0.04, fmS: 0, aOct: 1, aD: 0.45, aR: 0.2, rMix: 0.22 }),
    I("Glockenspiel", "Mallets", "fm", { fmR: 3.5, fmI: 1.5, fmD: 0.3, fmS: 0.1, aOct: 1, aD: 3, aR: 1, rMix: 0.28 }),
    I("Celesta", "Mallets", "fm", { fmR: 3, fmI: 1.2, fmD: 0.2, fmS: 0, aOct: 1, aD: 1.8, aR: 0.5, rMix: 0.3 }),
    I("Music Box", "Mallets", "strike", { kDamp: 0.9, kSus: 1.4, stB: 0.006, stHam: 0.1, stDet: 0, aOct: 1, cut: 14000, rMix: 0.3, rSize: 2.6 }),
    I("Tubular Bells", "Mallets", "fm", { fmR: 3.5, fmI: 3, fmD: 1.5, fmS: 0.2, aD: 5, aR: 3, rMix: 0.35, rSize: 3.5 }),
    I("Steel Drum", "Mallets", "fm", { fmR: 1, fmI: 1.5, fmD: 0.2, fmS: 0.1, bWave: "sine", bSemi: 12, bDet: 0, bLvl: 0.3, aA: 0.004, aD: 1.4, aR: 0.4, rMix: 0.2 }),
    I("Timpani", "Mallets", "strike", { aOct: -1, kDamp: 0.3, kSus: 2, stB: 0.002, stHam: 0.8, stDet: 3, cut: 2500, rMix: 0.35, rSize: 3 }),
    // ---- organs
    I("Drawbar Organ", "Organ", "organ", { bars: "888000000", chorus: 0.35, lTarget: "amp", lRate: 6.5, lDepth: 0.1 }),
    I("Jazz Organ", "Organ", "organ", { bars: "888000004", click: 0.5, chorus: 0.3, lTarget: "amp", lRate: 6.5, lDepth: 0.12 }),
    I("Full Organ", "Organ", "organ", { bars: "888888888", click: 0.3, chorus: 0.4 }),
    I("Rock Organ", "Organ", "organ", { bars: "888800000", drive: 0.45, click: 0.45, chorus: 0.5, lTarget: "amp", lRate: 6.8, lDepth: 0.2 }),
    I("Gospel Organ", "Organ", "organ", { bars: "888600005", chorus: 0.5, lTarget: "amp", lRate: 6.8, lDepth: 0.25 }),
    I("Church Organ", "Organ", "organ", { bars: "878646448", click: 0, aA: 0.06, aR: 0.5, rMix: 0.55, rSize: 6 }),
    I("Soft Pipe Organ", "Organ", "organ", { bars: "080800000", click: 0, aA: 0.08, aR: 0.4, rMix: 0.5, rSize: 5.5 }),
    I("Reed Organ", "Organ", "organ", { bars: "006808606", click: 0, aA: 0.05, aR: 0.15, rMix: 0.25 }),
    I("Accordion", "Organ", "organ", { bars: "008808000", click: 0, uni: 3, spread: 22, aA: 0.03, aR: 0.1, lTarget: "amp", lRate: 5, lDepth: 0.06 }),
    I("Harmonica", "Organ", "synth", M({ aWave: "square", bLvl: 0, fType: "bandpass", cut: 1600, res: 4, kTrack: 0.6, noise: 0.05, aA: 0.04, aD: 0.3, aS: 0.9, aR: 0.1, mode: "mono", glide: 0.02 }, VIB(5, 0.03))),
    // ---- guitars
    I("Nylon Guitar", "Guitar", "pluck", { kDamp: 0.35, kSus: 2.5, cut: 6000, rMix: 0.2 }),
    I("Steel Guitar", "Guitar", "pluck", { kDamp: 0.7, kSus: 3.2, chorus: 0.1, rMix: 0.18 }),
    I("12-String Guitar", "Guitar", "pluck", { kDamp: 0.75, kSus: 3, chorus: 0.65, rMix: 0.22 }),
    I("Jazz Guitar", "Guitar", "pluck", { kDamp: 0.25, kSus: 2, cut: 2500, kTrack: 0.4, rMix: 0.15 }),
    I("Clean Electric", "Guitar", "pluck", { kDamp: 0.6, kSus: 3.5, chorus: 0.45, dMix: 0.1, dTime: 0.3, dFb: 0.25, rMix: 0.2 }),
    I("Muted Guitar", "Guitar", "pluck", { kDamp: 0.45, kSus: 0.25, cut: 3500, aR: 0.05, rMix: 0.1 }),
    I("Overdrive Guitar", "Guitar", "pluck", { kDamp: 0.7, kSus: 6, drive: 0.55, cut: 4500, res: 1, aR: 0.15, rMix: 0.15 }),
    I("Distortion Guitar", "Guitar", "pluck", { kDamp: 0.8, kSus: 8, drive: 0.85, cut: 3800, res: 2, chorus: 0.15, aR: 0.15, rMix: 0.15 }),
    // ---- basses
    I("Acoustic Bass", "Bass", "pluck", { aOct: -1, kDamp: 0.3, kSus: 1.8, cut: 2000, rMix: 0.1 }),
    I("Finger Bass", "Bass", "pluck", { aOct: -1, kDamp: 0.45, kSus: 2.5, cut: 2500, rMix: 0.08 }),
    I("Pick Bass", "Bass", "pluck", { aOct: -1, kDamp: 0.8, kSus: 2.2, cut: 4000, rMix: 0.08 }),
    I("Slap Bass", "Bass", "pluck", { aOct: -1, kDamp: 0.95, kSus: 1.5, cut: 1500, res: 3, fEnv: 0.5, fA: 0.001, fD: 0.1, fS: 0.3, fVel: 0.6, rMix: 0.08 }),
    I("Fretless Bass", "Bass", "synth", { aWave: "triangle", bWave: "sine", bLvl: 0.3, bDet: 0, aOct: -1, cut: 900, fEnv: 0.2, aA: 0.02, aD: 1.5, aS: 0.6, aR: 0.2, mode: "mono", glide: 0.08, rMix: 0.1 }),
    I("Rubber Bass", "Bass", "fm", { aOct: -1, fmR: 1, fmI: 4, fmD: 0.15, fmS: 0.1, aD: 0.8, aS: 0.5, aR: 0.12, mode: "mono", rMix: 0.05 }),
    // ---- strings
    I("String Ensemble", "Strings", "synth", M({ aWave: "saw", bWave: "saw", bDet: -10, bLvl: 0.7, uni: 4, spread: 22, cut: 3200, aA: 0.25, aD: 0.5, aS: 0.9, aR: 0.9, chorus: 0.5, rMix: 0.4, rSize: 3.5 }, VIB(5, 0.04))),
    I("Slow Strings", "Strings", "synth", M({ aWave: "saw", bWave: "saw", bDet: -10, bLvl: 0.7, uni: 4, spread: 24, cut: 2600, aA: 1.2, aD: 0.8, aS: 0.9, aR: 1.8, chorus: 0.55, rMix: 0.5, rSize: 4.5 }, VIB(4.8, 0.035))),
    I("Violin", "Strings", "synth", M({ aWave: "saw", bWave: "saw", bLvl: 0.2, bDet: 4, cut: 3800, res: 1, kTrack: 0.5, aA: 0.12, aD: 0.4, aS: 0.95, aR: 0.3, mode: "mono", glide: 0.05, rMix: 0.3 }, VIB(5.5, 0.06))),
    I("Cello", "Strings", "synth", M({ aWave: "saw", bWave: "saw", bLvl: 0.2, bDet: 4, aOct: -1, cut: 2200, res: 1, kTrack: 0.5, aA: 0.14, aD: 0.4, aS: 0.95, aR: 0.35, mode: "mono", glide: 0.05, rMix: 0.3 }, VIB(5, 0.05))),
    I("Pizzicato Strings", "Strings", "pluck", { kDamp: 0.4, kSus: 0.6, chorus: 0.2, rMix: 0.35, rSize: 3 }),
    I("Harp", "Strings", "pluck", { kDamp: 0.5, kSus: 3, rMix: 0.35, rSize: 3.5 }),
    // ---- voices
    I("Choir Aahs", "Choir", "synth", M({ aWave: "saw", bWave: "saw", bDet: 9, bLvl: 0.8, uni: 5, spread: 25, fType: "bandpass", cut: 900, res: 2, kTrack: 0.3, aA: 0.5, aD: 0.6, aS: 0.9, aR: 1.2, chorus: 0.6, rMix: 0.5, rSize: 4.5 }, VIB(5, 0.03))),
    I("Voice Oohs", "Choir", "synth", { aWave: "triangle", bWave: "sine", bLvl: 0.5, uni: 3, spread: 14, cut: 900, res: 1, aA: 0.35, aD: 0.5, aS: 0.9, aR: 1, chorus: 0.5, rMix: 0.45, rSize: 4 }),
    // ---- brass
    I("Trumpet", "Brass", "synth", M({ aWave: "saw", bWave: "saw", bLvl: 0.3, bDet: 3, cut: 1400, res: 2, fEnv: 0.6, fA: 0.04, fD: 0.25, fS: 0.55, kTrack: 0.6, fVel: 0.5, aA: 0.03, aD: 0.3, aS: 0.9, aR: 0.12, mode: "mono", glide: 0.02, rMix: 0.25 }, VIB(5.5, 0.03))),
    I("Trombone", "Brass", "synth", M({ aWave: "saw", bWave: "saw", bLvl: 0.3, bDet: 3, aOct: -1, cut: 900, res: 2, fEnv: 0.6, fA: 0.06, fD: 0.3, fS: 0.55, kTrack: 0.6, fVel: 0.5, aA: 0.04, aD: 0.3, aS: 0.9, aR: 0.15, mode: "mono", glide: 0.06, rMix: 0.25 }, VIB(5, 0.025))),
    I("French Horn", "Brass", "synth", { aWave: "saw", bWave: "triangle", bLvl: 0.5, bDet: 2, cut: 700, res: 0.5, fEnv: 0.4, fA: 0.1, fD: 0.4, fS: 0.6, kTrack: 0.5, aA: 0.08, aD: 0.4, aS: 0.9, aR: 0.3, rMix: 0.4, rSize: 3 }),
    I("Brass Section", "Brass", "synth", { aWave: "saw", bWave: "saw", bDet: 8, bLvl: 0.8, uni: 3, spread: 12, cut: 1300, fEnv: 0.6, fA: 0.05, fD: 0.3, fS: 0.5, kTrack: 0.4, fVel: 0.4, aA: 0.04, aD: 0.4, aS: 0.85, aR: 0.2, rMix: 0.3 }),
    I("Tuba", "Brass", "synth", { aWave: "saw", bWave: "triangle", bLvl: 0.5, aOct: -1, cut: 500, fEnv: 0.4, fA: 0.08, fD: 0.4, fS: 0.6, kTrack: 0.5, aA: 0.06, aD: 0.4, aS: 0.9, aR: 0.2, mode: "mono", glide: 0.04, rMix: 0.25 }),
    // ---- reeds
    I("Alto Sax", "Reed", "synth", M({ aWave: "saw", bWave: "square", bLvl: 0.35, fType: "bandpass", cut: 1300, res: 3, fEnv: 0.3, fA: 0.05, fD: 0.3, fS: 0.7, kTrack: 0.5, fVel: 0.4, noise: 0.06, drive: 0.25, aA: 0.04, aD: 0.3, aS: 0.9, aR: 0.12, mode: "mono", glide: 0.03, rMix: 0.25 }, VIB(5, 0.04))),
    I("Tenor Sax", "Reed", "synth", M({ aWave: "saw", bWave: "square", bLvl: 0.35, aOct: -1, fType: "bandpass", cut: 900, res: 3, fEnv: 0.3, fA: 0.05, fD: 0.3, fS: 0.7, kTrack: 0.5, fVel: 0.4, noise: 0.06, drive: 0.3, aA: 0.04, aD: 0.3, aS: 0.9, aR: 0.12, mode: "mono", glide: 0.03, rMix: 0.25 }, VIB(4.8, 0.04))),
    I("Soprano Sax", "Reed", "synth", M({ aWave: "saw", bWave: "square", bLvl: 0.3, fType: "bandpass", cut: 1800, res: 2, fEnv: 0.25, fA: 0.04, fD: 0.3, fS: 0.7, kTrack: 0.5, noise: 0.05, drive: 0.2, aA: 0.04, aD: 0.3, aS: 0.9, aR: 0.12, mode: "mono", glide: 0.03, rMix: 0.25 }, VIB(5.2, 0.04))),
    I("Clarinet", "Reed", "synth", M({ aWave: "square", bLvl: 0, cut: 1800, res: 1, fEnv: 0.15, kTrack: 0.6, noise: 0.03, aA: 0.04, aD: 0.3, aS: 0.95, aR: 0.1, mode: "mono", glide: 0.02, rMix: 0.25 }, VIB(5, 0.02))),
    I("Oboe", "Reed", "synth", M({ aWave: "saw", bWave: "square", bSemi: 12, bLvl: 0.2, fType: "bandpass", cut: 1500, res: 5, kTrack: 0.6, noise: 0.02, aA: 0.05, aD: 0.3, aS: 0.95, aR: 0.1, mode: "mono", glide: 0.02, rMix: 0.28 }, VIB(5.5, 0.03))),
    I("Bassoon", "Reed", "synth", M({ aWave: "saw", bWave: "square", bSemi: 12, bLvl: 0.2, aOct: -1, fType: "bandpass", cut: 700, res: 4, kTrack: 0.6, noise: 0.02, aA: 0.05, aD: 0.3, aS: 0.95, aR: 0.12, mode: "mono", glide: 0.03, rMix: 0.25 }, VIB(5, 0.025))),
    // ---- pipes
    I("Flute", "Pipe", "synth", M({ aWave: "sine", bWave: "triangle", bSemi: 12, bDet: 0, bLvl: 0.12, noise: 0.12, cut: 4000, kTrack: 0.6, aA: 0.06, aD: 0.3, aS: 0.95, aR: 0.15, mode: "mono", glide: 0.02, rMix: 0.3 }, VIB(5, 0.035))),
    I("Piccolo", "Pipe", "synth", M({ aWave: "sine", bWave: "triangle", bSemi: 12, bDet: 0, bLvl: 0.1, aOct: 1, noise: 0.1, cut: 6000, kTrack: 0.6, aA: 0.05, aD: 0.3, aS: 0.95, aR: 0.12, mode: "mono", glide: 0.02, rMix: 0.3 }, VIB(5.5, 0.03))),
    I("Recorder", "Pipe", "synth", M({ aWave: "triangle", bLvl: 0, noise: 0.07, cut: 3000, kTrack: 0.5, aA: 0.03, aD: 0.3, aS: 0.95, aR: 0.1, mode: "mono", rMix: 0.25 }, VIB(5, 0.015))),
    I("Pan Flute", "Pipe", "synth", M({ aWave: "sine", bLvl: 0, noise: 0.35, cut: 2500, kTrack: 0.5, aA: 0.08, aD: 0.3, aS: 0.9, aR: 0.25, rMix: 0.4, rSize: 3.5 }, VIB(5, 0.03))),
    I("Ocarina", "Pipe", "synth", M({ aWave: "sine", bLvl: 0, noise: 0.04, cut: 2500, aA: 0.04, aD: 0.3, aS: 0.95, aR: 0.12, mode: "mono", rMix: 0.3 }, VIB(5.5, 0.03))),
    // ---- leads and pads
    I("Square Lead", "Lead", "synth", { aWave: "square", bWave: "square", bDet: 6, bLvl: 0.5, cut: 4000, res: 2, fEnv: 0.2, aA: 0.003, aD: 0.3, aS: 0.85, aR: 0.15, mode: "mono", glide: 0.03, dMix: 0.12 }),
    I("Saw Lead", "Lead", "synth", { aWave: "saw", bWave: "saw", bDet: 10, bLvl: 0.7, uni: 2, spread: 12, cut: 5000, res: 3, fEnv: 0.3, aA: 0.003, aD: 0.3, aS: 0.85, aR: 0.15, mode: "mono", glide: 0.03, dMix: 0.15 }),
    I("Polysynth", "Pad", "synth", { aWave: "saw", bWave: "saw", bDet: 9, bLvl: 0.7, uni: 3, spread: 16, cut: 2600, res: 2, fEnv: 0.4, fA: 0.01, fD: 0.5, fS: 0.4, aA: 0.01, aD: 0.5, aS: 0.8, aR: 0.5, chorus: 0.4, rMix: 0.3 }),
    I("Warm Pad", "Pad", "synth", { aWave: "saw", bWave: "triangle", bLvl: 0.6, uni: 4, spread: 20, cut: 1100, res: 1, aA: 1, aD: 1, aS: 0.9, aR: 2, chorus: 0.6, rMix: 0.5, rSize: 5, lTarget: "cutoff", lRate: 0.2, lDepth: 0.15 }),
    I("Halo Pad", "Pad", "synth", { aWave: "triangle", bWave: "sine", bSemi: 12, bLvl: 0.5, noise: 0.04, uni: 5, spread: 24, cut: 2000, aA: 1.5, aD: 1.5, aS: 0.9, aR: 3, chorus: 0.7, rMix: 0.6, rSize: 6.5 }),
    // ---- world
    I("Koto", "World", "pluck", { kDamp: 0.85, kSus: 1.8, rMix: 0.3, rSize: 2.8 }),
    I("Banjo", "World", "pluck", { kDamp: 0.97, kSus: 0.9, cut: 16000, rMix: 0.15 }),
    I("Kalimba", "World", "fm", { fmR: 6, fmI: 1, fmD: 0.06, fmS: 0, aD: 1.4, aR: 0.4, rMix: 0.25 }),
  ];

  /* ---------------- the drawbar organ ---------------- */
  // the nine bars as harmonics of the note an octave DOWN (16' = 1): 16' 5 1/3' 8' 4' 2 2/3' 2' 1 3/5' 1 1/3' 1'
  var BAR_H = [1, 3, 2, 4, 6, 8, 10, 12, 16];
  function drawbars(bars) {
    var s = /^[0-8]{9}$/.test(String(bars)) ? String(bars) : "888000000", real = new Float32Array(17), imag = new Float32Array(17);
    for (var i = 0; i < 9; i++) { var d = +s.charAt(i); if (d) imag[BAR_H[i]] += Math.pow(10, (d - 8) * 3 / 20); }   // 3 dB a step, like the real bars
    return { real: real, imag: imag };
  }

  /* ---------------- the strings ---------------- */
  function rng(seed) { var a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function finish(out, sr) {
    var pk = 0, i, n = out.length, fade = Math.min(n, Math.round(sr * 0.04));
    for (i = 0; i < n; i++) { var a = Math.abs(out[i]); if (a > pk) pk = a; }
    var k = pk > 1e-9 ? 0.9 / pk : 0;
    for (i = 0; i < n; i++) out[i] *= k;
    for (i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;     // never a click at the end
    return out;
  }
  /** a plucked string: Karplus-Strong with a fractional delay. o.damp 0..1 = brightness, o.sus = seconds to fade 60 dB */
  function pluck(f, sr, o) {
    o = o || {}; f = clamp(+f || 220, 20, sr / 4);
    var damp = clamp(o.damp == null ? 0.5 : +o.damp, 0, 1), sus = clamp(+o.sus || 2, 0.05, 20);
    var N = Math.round(sr * clamp(sus * 1.1 + 0.1, 0.25, 6)), out = new Float32Array(N), P = sr / f;
    var b = 0.5 * (1 - damp * 0.92);                       // the loop's averaging: more = darker, faster-dying highs
    var D = P - b, g = Math.pow(10, -3 / (sus * f));       // the delay that keeps it in tune; the loss a pass
    var r = rng(o.seed || 7), L = Math.ceil(P) + 2, a = 0.08 + 0.92 * damp, y = 0, mean = 0, exc = new Float32Array(L), i;
    for (i = 0; i < L; i++) { y += a * ((r() * 2 - 1) - y); exc[i] = y; mean += y; }
    mean /= L; for (i = 0; i < L; i++) exc[i] -= mean;
    for (var n = 0; n < N; n++) {
      var t = n - D, i0 = Math.floor(t), fr = t - i0;
      var y0 = i0 >= 0 ? out[i0] : 0, y1 = i0 + 1 >= 0 && i0 + 1 < n ? out[i0 + 1] : 0, ym = i0 - 1 >= 0 ? out[i0 - 1] : 0;
      var cur = y0 + (y1 - y0) * fr, prev = ym + (y0 - ym) * fr;
      out[n] = (n < L ? exc[n] : 0) + g * ((1 - b) * cur + b * prev);
    }
    return finish(out, sr);
  }
  /** a struck string (a piano): partials sharpened by B, each fading faster than the last in two stages, two strings det cents
   *  apart, the hammer's thump. o.damp = brightness, o.sus = seconds (at middle C; lower notes last longer) */
  function strike(f, sr, o) {
    o = o || {}; f = clamp(+f || 220, 20, sr / 4);
    var damp = clamp(o.damp == null ? 0.5 : +o.damp, 0, 1), sus = clamp(+o.sus || 2, 0.05, 20), B = clamp(+o.B || 0, 0, 0.05);
    var ham = clamp(o.ham == null ? 0.3 : +o.ham, 0, 1), det = clamp(+o.det || 0, 0, 20);
    var Tn = clamp(sus * Math.pow(261.63 / f, 0.55), 0.12, 25), N = Math.round(sr * clamp(Tn * 1.3 + 0.08, 0.25, 6)), out = new Float32Array(N);
    var K = Math.min(48, Math.floor(0.45 * sr / f)), att = Math.max(1, Math.round(sr * 0.0015)), TWO = 2 * Math.PI;
    for (var k = 1; k <= K; k++) {
      var fk = f * k * Math.sqrt(1 + B * k * k); if (fk >= 0.45 * sr) break;
      var amp = (1 / Math.sqrt(k)) * Math.exp(-(k - 1) * 0.35 * (1 - damp)) * (Math.abs(Math.sin(Math.PI * k / 7)) + 0.12);
      var Tk = Tn / (1 + 0.25 * (k - 1)), r1 = Math.exp(-1 / (sr * Tk * 0.22)), r2 = Math.exp(-1 / (sr * Tk));   // prompt + aftersound
      var strings = k <= 12 && det > 0 ? 2 : 1;
      for (var s = 0; s < strings; s++) {
        var cents = strings === 2 ? (s ? det / 2 : -det / 2) : 0, w = TWO * fk * Math.pow(2, cents / 1200) / sr, cw = Math.cos(w), sw = Math.sin(w);
        var c = Math.cos(s * 0.7 + k), si = Math.sin(s * 0.7 + k), e1 = 0.65 * amp / strings, e2 = 0.35 * amp / strings;
        for (var n = 0; n < N; n++) {
          var nc = c * cw - si * sw; si = c * sw + si * cw; c = nc;
          out[n] += si * (e1 + e2); e1 *= r1; e2 *= r2;
          if ((n & 4095) === 4095) { var m = 1 / Math.sqrt(c * c + si * si); c *= m; si *= m; }   // keep the rotation on the circle
        }
      }
    }
    // the hammer: a short dark thump of noise
    if (ham > 0) { var r = rng(o.seed || 11), y = 0, he = ham * 0.6, hr = Math.exp(-1 / (sr * 0.006)); for (var h = 0; h < Math.min(N, sr * 0.06); h++) { y += 0.25 * ((r() * 2 - 1) - y); out[h] += y * he; he *= hr; } }
    for (var q = 0; q < att && q < N; q++) out[q] *= q / att;
    return finish(out, sr);
  }
  /** the key a note's sound is made at: every 3rd key (a semitone either way is played from it) */
  function zone(m) { return Math.round(m / 3) * 3; }

  var api = { CATS: CATS, BASE: BASE, INSTRUMENTS: INSTRUMENTS, BAR_H: BAR_H, drawbars: drawbars, pluck: pluck, strike: strike, zone: zone, rng: rng };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthInst = api;
})(typeof window !== "undefined" ? window : globalThis);
