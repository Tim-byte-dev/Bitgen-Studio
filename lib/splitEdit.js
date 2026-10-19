// bitGen Studio — lib/splitEdit.js (2.407.0): J / L CUTS - a clip's sound starting before its picture (J, `lead`)
// or running on after it (L, `tail`), over the neighbour, whose own sound is silenced for that stretch (as an editor's
// split edit does).
// Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do".
//
// The page stores clip.split = {lead, tail} (seconds, 0..10) (ext/timelinedock/clipfx.js, 🎧 Sound).
// forJob(raw V1 clips, the route's mapped V1 clips, volume) -> {track: an extra sound track (the extra sound, from the
// clip's own file, role voice) | null, mute: [[a, b] ...] - V1's own sound silenced there (worker.py `v1_mute`)}.
//
// 2.412.0 (Tim: "do the smaller jobs and complete the 10 partly done jobs"):
//   - every VIDEO LAYER (V2+) too: forLayers(raw layers, mapped layers, add) - the extra sound joins the same track, and
//     the clips on that layer that the J / L runs over get `amute: [[a, b]]` (their sound silenced there - worker.py)
//   - RETIMED clips (🎬 speed / reverse / ramp): the extra sound is the source beside the trim AT THE CLIP'S SPEED at that
//     end (a ramp: the speed at its first / last frame) - `tempo` (atempo) and `rev` (played backwards) on the extra
//     clip; a reversed clip's J is the source AFTER its out-point (played backwards), its L the source before its in.
"use strict";
const FX = require("../static/clipfx.js");

function norm(s) {
  if (!s || typeof s !== "object") return null;
  const lead = Math.max(0, Math.min(10, Number(s.lead) || 0)), tail = Math.max(0, Math.min(10, Number(s.tail) || 0));
  return lead > 0.01 || tail > 0.01 ? { lead: +lead.toFixed(3), tail: +tail.toFixed(3) } : null;
}
const r3 = (v) => +(+v).toFixed(3);

/** one clip's J / L pieces: [{path, start, in, out, dur, tempo?, rev?, split: "J"|"L", a, b (the timeline stretch)}] */
function pieces(raw, m, volume) {
  const sp = norm(raw && raw.split);
  if (!sp || !m) return [];
  const fx = FX.normalize(raw.fx);
  const i0 = Math.max(0, +m.in || 0);
  const o0 = m.out != null ? +m.out : (m.dur != null ? +m.dur : null);
  if (o0 == null) return [];
  const dur = m.dur != null ? +m.dur : null;
  const ret = FX.retimed(fx), rev = !!(fx && fx.reverse);
  // the speed at the clip's first / last played frame (source seconds per timeline second)
  const sFirst = ret ? (fx.ramp ? FX.speedAt(fx, 0) : (fx.speed || 1)) : 1;
  const sLast = ret ? (fx.ramp ? FX.speedAt(fx, 1) : (fx.speed || 1)) : 1;
  const tlLen = ret ? FX.timelineLen(Math.max(0, o0 - i0), fx) : Math.max(0, o0 - i0);
  const start = Math.max(0, +m.start || 0), end = start + tlLen;
  const out = [];
  const mk = (kind, tlA, secs, srcA, srcB, s) => {
    const p = { path: m.path, start: r3(tlA), in: r3(srcA), out: r3(srcB), dur: m.dur, volume, role: "voice", split: kind, a: r3(tlA), b: r3(tlA + secs) };
    if (Math.abs(s - 1) > 1e-3) p.tempo = r3(s);
    if (rev) p.rev = true;
    out.push(p);
  };
  // J: the sound that would come BEFORE the first frame
  if (sp.lead > 0.01) {
    const room = rev ? (dur != null ? Math.max(0, dur - o0) : 0) : i0;          // source seconds there is
    const lead = Math.min(sp.lead, room / sFirst, start);                      // timeline seconds
    if (lead > 0.01) {
      const src = lead * sFirst;
      if (rev) mk("J", start - lead, lead, o0, o0 + src, sFirst);
      else mk("J", start - lead, lead, i0 - src, i0, sFirst);
    }
  }
  // L: the sound that would come AFTER the last frame
  if (sp.tail > 0.01) {
    const room = rev ? i0 : (dur != null ? Math.max(0, dur - o0) : sp.tail * sLast);
    const tail = Math.min(sp.tail, room / sLast);
    if (tail > 0.01) {
      const src = tail * sLast;
      if (rev) mk("L", end, tail, i0 - src, i0, sLast);
      else mk("L", end, tail, o0, o0 + src, sLast);
    }
  }
  return out;
}
const clean = (p) => { const c = Object.assign({}, p); delete c.a; delete c.b; return c; };

function forJob(raw, mapped, volume) {
  const clips = [], mute = [];
  (raw || []).forEach((c, i) => {
    pieces(c, mapped[i], volume).forEach((p) => { clips.push(clean(p)); mute.push([p.a, p.b]); });
  });
  return { track: clips.length ? { clips } : null, mute };
}

/** 2.412.0: the video layers (V2+). rawLayers / mappedLayers line up (the route maps them in order); each J / L adds
 * its sound to `extra` (an array of sound clips) and silences the OTHER clips of that layer under it (clip.amute) */
function forLayers(rawLayers, mappedLayers, extra) {
  let n = 0;
  (rawLayers || []).forEach((L, li) => {
    const raw = (L && L.clips) || [], mp = (mappedLayers[li] && mappedLayers[li].clips) || [];
    if (mappedLayers[li] && (mappedLayers[li].muted || !(+mappedLayers[li].volume > 0))) return;
    const vol = mappedLayers[li] ? mappedLayers[li].volume : 1;
    raw.forEach((c, i) => {
      pieces(c, mp[i], vol).forEach((p) => {
        extra.push(clean(p)); n++;
        mp.forEach((o, j) => {
          if (j === i) return;
          const s = +o.start || 0, e = s + (o.tl_len != null ? +o.tl_len : Math.max(0, (+o.out || +o.dur || 0) - (+o.in || 0)));
          const a = Math.max(p.a, s), b = Math.min(p.b, e);
          if (b - a > 0.005) (o.amute = o.amute || []).push([r3(a), r3(b)]);
        });
      });
    });
  });
  return n;
}

module.exports = { norm, forJob, forLayers, pieces };
