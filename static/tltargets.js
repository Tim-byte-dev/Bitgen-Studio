/* bitGen Studio — static/tltargets.js (2.412.0): TRACK TARGETING and LINKED SELECTION - the maths, shared by the page
 * (ext/timelinedock/targets.js), the route (/api/export: a video clip whose sound was taken out is silent) and the tests.
 * window.H3Targets / require().
 *
 * Tim: "do the smaller jobs and complete the 10 partly done jobs" (Premiere's "track targeting / linked selection
 * toggles" - before this V1's picture and sound were always one).
 *
 *   TARGETS  a layer may carry L.target = true (the ◎ in its header). Ctrl+K with no clip selected splits the clips under
 *            the position marker on EVERY targeted layer (none targeted = the highlighted layer, as before).
 *   SOUND OUT  separate(tl, c, kind) takes a video clip's sound out as its own clip on a sound layer ("<V> sound"),
 *            LINKED to the picture (c.link = a.link = id); the picture's own sound is then silent (c.soundOut).
 *   LINKED SELECTION  tl.linkSel (default on): a linked pair moves and trims together - sync(tl, snap) follows whichever
 *            of the two changed since the last look. Off = each moves on its own (the link is kept). unlink(tl, c)
 *            breaks the pair for good (both stay where they are); relink(tl, c) pairs them again; putBack(tl, c)
 *            removes the separate sound and gives the picture its sound back.
 */
(function (root) {
  "use strict";
  function n(v, d) { var x = Number(v); return Number.isFinite(x) ? x : d; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function bad(msg) { var e = new Error(msg); e.status = 400; return e; }
  function clipsOf(L) { return Array.isArray(L) ? L : (L && L.clips) || []; }
  function retimed(c) { var f = c && c.fx; return !!(f && (f.ramp || f.reverse || (f.speed != null && Math.abs(n(f.speed, 1) - 1) > 1e-4))); }
  var seq = 0;
  function newId() { seq = (seq + 1) % 1e6; return "ln" + Date.now().toString(36) + seq.toString(36); }

  /** the video clips (V1 + V2+) and the sound clips, each with where it lives */
  function all(tl) {
    var v = [], a = [];
    ((tl && tl.video) || []).forEach(function (c) { v.push({ c: c, kind: "v1", L: tl.v1 || null }); });
    ((tl && tl.vlayers) || []).forEach(function (L) { clipsOf(L).forEach(function (c) { v.push({ c: c, kind: "vl", L: L }); }); });
    ((tl && tl.audio) || []).forEach(function (L, i) { clipsOf(L).forEach(function (c) { a.push({ c: c, kind: "aud", L: L, i: i }); }); });
    return { v: v, a: a };
  }
  function partner(tl, c) {
    var id = c && (c.link || c.wasLink);
    if (!id) return null;
    var A = all(tl), hit = null;
    A.v.concat(A.a).forEach(function (x) { if (!hit && x.c !== c && (x.c.link === id || x.c.wasLink === id)) hit = x; });
    return hit;
  }
  /** the sound layer a separated sound goes on: one named "<picture layer> sound" with room at that time, else a new one */
  function soundLayer(tl, name, a0, a1) {
    tl.audio = tl.audio || [];
    for (var i = 0; i < tl.audio.length; i++) {
      var L = tl.audio[i];
      if (!L || Array.isArray(L) || L.name !== name) continue;
      var free = clipsOf(L).every(function (c) { var s = n(c.start, 0), e = s + Math.max(0, n(c.out, n(c.dur, 0)) - n(c.in, 0)); return e <= a0 + 1e-6 || s >= a1 - 1e-6; });
      if (free) return L;
    }
    var nl = { name: name, clips: [], opacity: 1, volume: 1, visible: true, solo: false, muted: false,
               transitionIn: { type: "none", dur: 0.5 }, transitionOut: { type: "none", dur: 0.5 } };
    tl.audio.push(nl);
    return nl;
  }
  /** a video clip's sound as its own clip, linked to it -> the sound clip */
  function separate(tl, c, kind, layerName) {
    if (!c || (kind !== "v1" && kind !== "vl")) throw bad("only a video clip's sound can be taken out");
    if (c.text || c.m3d || c.adjust) throw bad("that clip has no sound of its own");
    if (c.soundOut) throw bad("its sound is already a clip of its own");
    if (retimed(c)) throw bad("a 🎬 retimed clip's sound follows its speed - set it back to 100 % to take its sound out");
    var id = newId(), i0 = n(c.in, 0), o0 = n(c.out, n(c.dur, i0 + 5)), s0 = n(c.start, 0);
    var a = { name: c.name, src: c.src || "output", start: r4(s0), in: r4(i0), out: r4(o0), dur: c.dur != null ? n(c.dur, null) : null,
              volume: 1, role: "voice", link: id };
    var L = soundLayer(tl, (layerName || (kind === "v1" ? "V1" : "V")) + " sound", s0, s0 + (o0 - i0));
    L.clips.push(a);
    L.clips.sort(function (x, y) { return n(x.start, 0) - n(y.start, 0); });
    c.link = id; c.soundOut = true;
    return a;
  }
  function unlink(tl, c) {
    var p = partner(tl, c);
    if (!p || !c.link) throw bad("that clip is not linked");
    var id = c.link;
    delete c.link; delete p.c.link; c.wasLink = id; p.c.wasLink = id;
    return p.c;
  }
  function relink(tl, c) {
    var p = partner(tl, c);
    if (!p || !c.wasLink) throw bad("nothing to link it to");
    c.link = p.c.link = c.wasLink; delete c.wasLink; delete p.c.wasLink;
    return p.c;
  }
  /** the separate sound removed, the picture's own sound back */
  function putBack(tl, c) {
    var p = partner(tl, c);
    var vid = p && p.kind === "aud" ? c : p ? p.c : c, snd = p && p.kind === "aud" ? p.c : (p ? c : null);
    if (snd) (tl.audio || []).forEach(function (L) { if (!Array.isArray(L) && L.clips) L.clips = L.clips.filter(function (x) { return x !== snd; }); });
    tl.audio = (tl.audio || []).filter(function (L) { return clipsOf(L).length || !/ sound$/.test((L && L.name) || ""); });
    delete vid.soundOut; delete vid.link; delete vid.wasLink;
    return vid;
  }
  function pick(c) { return { start: n(c.start, 0), in: n(c.in, 0), out: c.out == null ? null : n(c.out, 0) }; }
  function same(a, b) { return a && b && Math.abs(a.start - b.start) < 1e-6 && Math.abs(a.in - b.in) < 1e-6 && (a.out === b.out || (a.out != null && b.out != null && Math.abs(a.out - b.out) < 1e-6)); }
  /** keep linked pairs together: whichever of the two changed since `snap` leads -> the new snap (pass it next time) */
  function sync(tl, snap) {
    var on = !tl || tl.linkSel !== false, A = all(tl), byId = {}, out = {};
    A.v.forEach(function (x) { if (x.c.link) (byId[x.c.link] = byId[x.c.link] || {}).v = x.c; });
    A.a.forEach(function (x) { if (x.c.link) (byId[x.c.link] = byId[x.c.link] || {}).a = x.c; });
    var moved = 0;
    Object.keys(byId).forEach(function (id) {
      var p = byId[id]; if (!p.v || !p.a) return;
      var s = snap && snap[id];
      if (on && s) {
        var vc = !same(pick(p.v), s.v), ac = !same(pick(p.a), s.a);
        var from = vc ? p.v : ac ? p.a : null, to = vc ? p.a : ac ? p.v : null;
        if (from) { to.start = from.start; to.in = from.in; to.out = from.out; moved++; }
      }
      out[id] = { v: pick(p.v), a: pick(p.a) };
    });
    out._moved = moved;
    return out;
  }
  /** the layers Ctrl+K works on when no clip is selected: the targeted ones (layer keys), else [fallback] */
  function targeted(tl, fallback) {
    var out = [];
    if (tl && tl.v1 && tl.v1.target) out.push("v1");
    ((tl && tl.vlayers) || []).forEach(function (L, i) { if (L && L.target) out.push("vl:" + i); });
    ((tl && tl.images) || []).forEach(function (L, i) { if (L && L.target) out.push("i:" + i); });
    ((tl && tl.audio) || []).forEach(function (L, i) { if (L && !Array.isArray(L) && L.target) out.push("a:" + i); });
    return out.length ? out : (fallback ? [fallback] : []);
  }
  /** for the compile: the stretches of a picture's own sound to silence (its sound taken out) - [[a, b]] */
  function silentSpans(clips, lenOf) {
    var out = [];
    (clips || []).forEach(function (c) {
      if (!c || !c.soundOut) return;
      var s = n(c.start, 0), len = lenOf ? lenOf(c) : Math.max(0, n(c.out, n(c.dur, 0)) - n(c.in, 0));
      if (len > 0) out.push([r4(s), r4(s + len)]);
    });
    return out;
  }
  var api = { separate: separate, unlink: unlink, relink: relink, putBack: putBack, partner: partner, sync: sync, targeted: targeted,
              silentSpans: silentSpans, retimed: retimed };
  root.H3Targets = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
