// bitGen Studio — lib/amtNotes.js (3.11.0): ✍ CONTINUE - a note clip's notes in, the next bars out (pure; scripts/test-31100.js).
// Tim: "okay let go with 1" - the Anticipatory Music Transformer (Thickstun, Hall, Donahue, Liang - Stanford CRFM, Apache-2.0)
// for ✍ Continue, step 2 of "our own Magenta" in the 🎹 Edit Booth (step 1 was 🥁 Drumify, 2.992.0).
//
// The model reads music as events in 10 ms steps (time, duration, instrument x 128 + pitch), at most 100 s in a sequence and a
// note at most 10 s long; it writes what comes next. A clip's notes are {m (MIDI pitch), t (s from the clip's start), d (s),
// v (0..1)} (ext/synthdock/synthtlcore.js).
//   plan(notes, o)   -> {start, end, offset, notes [{m, t, d}] (from the window's start), from, to, bars, bpm} | {error}
//                       o = {bpm, bars 1..8, beats 4 (a bar), window 60 (s of music the model reads)}
//                       start = where the music stops (the end of its last note) up to the next beat; 0 for an empty clip
//   back(gen, p, o)  -> the model's notes in the clip's own time, cut to [start, end), each its velocity (o.v, else 0.75);
//                       drum hits (instrument 128 - when "one instrument" is off) left out
//   velOf(notes)     -> the clip's mean velocity (what the new notes get - the model writes none)
//   INSTR            the instruments it can be told the notes are (General MIDI programs)
"use strict";

const RES = 100, MAX_S = 100, MAX_D = 9.99;
const INSTR = [
  { id: 0, label: "Piano" }, { id: 4, label: "Electric piano" }, { id: 16, label: "Organ" }, { id: 24, label: "Guitar" },
  { id: 33, label: "Bass" }, { id: 48, label: "Strings" }, { id: 61, label: "Brass" }, { id: 73, label: "Flute" },
  { id: 80, label: "Synth lead" }, { id: 88, label: "Synth pad" },
];
const r2 = (v) => Math.round(v * RES) / RES;
const num = (v, d) => (Number.isFinite(+v) ? +v : d);

/** the notes safe to read: pitch 0..127, times >= 0, a length > 0 */
function clean(notes) {
  return (Array.isArray(notes) ? notes : []).filter((n) => n && Number.isFinite(+n.m) && Number.isFinite(+n.t))
    .map((n) => ({ m: Math.max(0, Math.min(127, Math.round(+n.m))), t: Math.max(0, +n.t), d: Math.max(0.01, num(n.d, 0.25)), v: Math.max(0.05, Math.min(1, num(n.v, 0.75))) }))
    .sort((a, b) => a.t - b.t || a.m - b.m);
}
function velOf(notes) { const c = clean(notes); return c.length ? Math.round(c.reduce((a, n) => a + n.v, 0) / c.length * 100) / 100 : 0.75; }

/** what the model gets: the last `window` s of music before the start (moved to 0), where to start and stop writing */
function plan(notes0, o) {
  const x = o || {}, bpm = Math.max(20, Math.min(300, num(x.bpm, 120))), beat = 60 / bpm, bars = Math.max(1, Math.min(8, Math.round(num(x.bars, 2)))), beats = Math.max(1, Math.round(num(x.beats, 4)));
  const notes = clean(notes0), win = Math.max(5, Math.min(80, num(x.window, 60)));
  const endOfMusic = notes.reduce((a, n) => Math.max(a, n.t + n.d), 0);
  const from = notes.length ? Math.ceil(endOfMusic / beat - 1e-6) * beat : 0, to = from + bars * beats * beat;
  if (to - from > MAX_S - 10) return { error: "that is too long to write at once - fewer bars" };
  const offset = Math.max(0, from - win);
  const kept = notes.filter((n) => n.t >= offset && n.t < from).map((n) => ({ m: n.m, t: r2(n.t - offset), d: r2(Math.min(MAX_D, Math.max(0.01, n.d))) }));
  return { start: r2(from - offset), end: r2(to - offset), offset, from, to, bars, bpm, notes: kept };
}
/** the model's notes back in the clip's time - only what falls in [from, to), cut at `to`, the clip's velocity */
function back(gen, p, o) {
  const v = Math.max(0.05, Math.min(1, num(o && o.v, 0.75)));
  return (Array.isArray(gen) ? gen : []).filter((n) => n && +n.instr !== 128)      // drum hits (instrument 128): their "pitch" is a drum, not a note
    .map((n) => ({ m: Math.round(+n.m), t: +n.t + p.offset, d: +n.d }))
    .filter((n) => Number.isFinite(n.t) && n.m >= 0 && n.m <= 127 && n.t >= p.from - 0.005 && n.t < p.to - 0.005)
    .map((n) => ({ m: n.m, t: Math.round(n.t * 1000) / 1000, d: Math.round(Math.max(0.02, Math.min(n.d, p.to - n.t)) * 1000) / 1000, v }))
    .sort((a, b) => a.t - b.t || a.m - b.m);
}

module.exports = { RES, INSTR, clean, velOf, plan, back };
