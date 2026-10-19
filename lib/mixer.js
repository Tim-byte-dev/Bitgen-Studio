// bitGen Studio — lib/mixer.js (2.415.0): the 🎚 TRACK MIXER's numbers as the compile reads them.
//
// Tim: "lets do the medium jobs now" (Premiere's "Track mixer with live meters" + pan in the compile).
//
//   gain(v)       a fader: 0 .. 2 (1 = 0 dB, 2 = +6 dB) - a layer's volume, V1's, a sound clip's (its layer's x its own)
//   pan(v)        -1 (left) .. 0 .. 1 (right); anything else 0
//   panGains(p)   the BALANCE law (Premiere's for stereo tracks): the far side turned down, the near side kept at
//                 full -> [left, right] - static/mixer.js and scripts/mixfx.py use the same numbers
//   master(m)     tl.master = {volume} -> {volume} or null at 0 dB (nothing to do)
//   db(g)         a gain as dB (-inf below 0.0001)
// routes/index.js /api/export calls these; scripts/mixfx.py pans and sets the master in the compile; the page's mixer
// (ext/timelinedock/mixer.js) plays the same through WebAudio and meters it.
"use strict";

const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const r4 = (v) => Math.round(v * 10000) / 10000;

function gain(v, d) { return r4(Math.min(2, Math.max(0, num(v, d == null ? 1 : d)))); }
function pan(v) { const p = Math.min(1, Math.max(-1, num(v, 0))); return Math.abs(p) < 1e-4 ? 0 : r4(p); }
function panGains(p) { const q = pan(p); return [q > 0 ? r4(1 - q) : 1, q < 0 ? r4(1 + q) : 1]; }
function master(m) {
  if (!m || typeof m !== "object") return null;
  const v = gain(m.volume, 1);
  return Math.abs(v - 1) < 1e-4 ? null : { volume: v };
}
function db(g) { return g < 1e-4 ? -Infinity : Math.round(20 * Math.log10(g) * 10) / 10; }

module.exports = { gain, pan, panGains, master, db };
