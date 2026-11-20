/* bitGen Studio — static/autoedit.js (2.894.0): ✨ AUTO EDIT - the maths of an automatic edit on the timeline (window.H3AutoEdit;
 * the page's ext/timelinedock/tlautoedit.js, the server's lib/autoEdit.js and the unit tests all use this one file).
 *
 * Tim (verbatim): "https://github.com/Vincentwei1021/video-shotcraft, can we add these to timeline to automate video editing?"
 * - he chose "Our own Auto edit": video-shotcraft (Vincentwei1021, Apache-2.0) is a Claude Code / Codex skill that writes a
 * Remotion (React) promo film; bitGen takes its EDITING CRAFT, not its code or Remotion - the music first (a beat grid, every
 * cut on a beat, the timeline written in beats, frames only at the end), its promo energy arc (a low brand opening held >= 1 s,
 * one hero shot, a feature climb alternating high / low energy with breathing title cards every one or two shots, 2-4 of them,
 * a peak finale with a sign-off held >= 1 s), one move per shot that is never the same twice in a row, and the seam between
 * two shots picked by the energy on either side (a dissolve for calm, a push / whip for fast-to-fast, a zoom on a climax) -
 * and builds it with the timeline's own keyframes (static/keyframes.js), so the preview and ⚙ Compile draw the same thing.
 *
 *   grid({beats, tempo, total})          the beat grid: beat i -> seconds (the song's beats, extended at its tempo after the
 *                                         last one; no song = a steady grid at `tempo`); total beats in whole bars of 4
 *   MOVES / ENTERS / TITLES / ARC        the recipes (each says which video-shotcraft card it comes from)
 *   catalogue()                          the recipes as words for the LLM (lib/autoEdit.js)
 *   fallback(assets, g, o)               a plan without an LLM - the arc filled in order
 *   clean(plan, assets, g, o)            any plan (the LLM's, the user's edits) made valid: real assets, whole beats that add up to
 *                                         the length, a video never asked for more than it has, no move twice in a row, the
 *                                         first shot cut in, the last held >= 1 s
 *   build(plan, assets, g, frame, o)     -> {vlayers, images, audio, cuts, shots}: the layers to put on the timeline - videos on
 *                                         two video layers and pictures on two picture layers taking turns (so a seam can
 *                                         overlap), titles on their own layer on top, the song on a music layer faded at the end
 *   qa(built, plan, g)                   -> the problems found (a cut off the beat, a video past its end, a title too short ...)
 * Pure; Node: scripts/test-894.js. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./keyframes.js"));
  else root.H3AutoEdit = factory(root.H3Keyframes);
})(typeof self !== "undefined" ? self : this, function (KF) {
  "use strict";
  var FPS = 24, BAR = 4;
  var r4 = function (v) { return Math.round(v * 1e4) / 1e4; };
  var clampN = function (v, a, b, d) { v = +v; return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  var EASE = { inout: [0.45, 0, 0.55, 1], out: [0.16, 1, 0.3, 1], whipIn: [0.6, 0, 1, 0.55], whipOut: [0, 0.6, 0.15, 1], brake: [0.62, 0, 0.16, 1] };

  /* ------------------------------------------------------------------ the beat grid */
  function grid(o) {
    var a = o || {}, tempo = clampN(a.tempo, 40, 240, 120), spb = 60 / tempo;
    var beats = (Array.isArray(a.beats) ? a.beats : []).map(Number).filter(Number.isFinite).sort(function (x, y) { return x - y; });
    // the song's first beat is the edit's 0 (a beat at 0.12 s would leave a gap); the steady grid fills before / after
    var off = beats.length ? beats[0] : 0;
    beats = beats.map(function (b) { return r4(b - off); });
    if (beats.length > 2) { var d = (beats[beats.length - 1] - beats[0]) / (beats.length - 1); if (d > 0.2 && d < 1.6) spb = d; }
    var want = clampN(a.total, 0, 3600, 0);                       // seconds wanted (0 = as long as the song's beats go)
    var n = want ? Math.round(want / spb) : Math.max(0, beats.length - 1);
    n = Math.max(BAR, Math.floor(n / BAR) * BAR);                 // whole bars
    function at(i) { if (i < beats.length) return beats[i]; var last = beats.length ? beats[beats.length - 1] : 0, k = beats.length ? i - (beats.length - 1) : i; return r4(last + k * spb); }
    return { tempo: r4(60 / spb), spb: r4(spb), offset: r4(off), n: n, bars: n / BAR, at: at, total: at(n), fromSong: !!(a.beats && a.beats.length) };
  }

  /* ------------------------------------------------------------------ the recipes */
  // a MOVE is what the camera does over one shot; v(t, d, s) gives each property's own keys (t seconds into the shot, d its
  // length, s the "cover" scale that fills the frame) as [{at, prop, val, ease}]
  var MOVES = {
    hold: { label: "Hold (still)", energy: 1, credit: "R1 hold rule", use: "a calm moment, the opening / sign-off hold, text that must be read",
      keys: function () { return []; } },
    push: { label: "Slow push in", energy: 1, credit: "camera / tension-camera-moves", use: "draw the eye in slowly - openings, a hero shot, emotion",
      keys: function (d, s) { return [{ at: 0, p: "scale", v: s, e: "inout" }, { at: d, p: "scale", v: s * 1.12 }]; } },
    pull: { label: "Pull out (reveal)", energy: 1, credit: "opening / crane-rise-reveal", use: "reveal the whole scene, a calm ending",
      keys: function (d, s) { return [{ at: 0, p: "scale", v: s * 1.15, e: "inout" }, { at: d, p: "scale", v: s }]; } },
    panL: { label: "Pan left", energy: 2, credit: "camera / steep-tilt-glide", use: "travel across a wide picture, a landscape, a row of things",
      keys: function (d, s, W) { return [{ at: 0, p: "scale", v: s * 1.15 }, { at: 0, p: "x", v: W * 0.06, e: "inout" }, { at: d, p: "x", v: -W * 0.06 }]; } },
    panR: { label: "Pan right", energy: 2, credit: "camera / steep-tilt-glide", use: "the other way - alternate with Pan left",
      keys: function (d, s, W) { return [{ at: 0, p: "scale", v: s * 1.15 }, { at: 0, p: "x", v: -W * 0.06, e: "inout" }, { at: d, p: "x", v: W * 0.06 }]; } },
    rise: { label: "Rise (tilt up)", energy: 2, credit: "camera / overhead-camera-moves", use: "a tall subject, a building, a person head to toe",
      keys: function (d, s, W, H) { return [{ at: 0, p: "scale", v: s * 1.15 }, { at: 0, p: "y", v: -H * 0.06, e: "inout" }, { at: d, p: "y", v: H * 0.06 }]; } },
    kenburns: { label: "Ken Burns (zoom + drift)", energy: 2, credit: "camera / depth-layer-moves", use: "still pictures - life in a photo",
      keys: function (d, s, W, H) { return [{ at: 0, p: "scale", v: s * 1.06, e: "inout" }, { at: d, p: "scale", v: s * 1.2 }, { at: 0, p: "x", v: W * 0.03, e: "inout" }, { at: d, p: "x", v: -W * 0.03 }, { at: 0, p: "y", v: H * 0.02, e: "inout" }, { at: d, p: "y", v: -H * 0.02 }]; } },
    drift: { label: "Drift (turn + float)", energy: 1, credit: "camera / space-camera-moves", use: "dreamy, slow, between busier shots",
      keys: function (d, s) { return [{ at: 0, p: "scale", v: s * 1.08 }, { at: 0, p: "rot", v: -1.2, e: "inout" }, { at: d, p: "rot", v: 1.2 }]; } },
    crash: { label: "Crash zoom (a punch in on a beat)", energy: 3, credit: "camera / crash-zoom-punch", use: "name the one thing that matters - a punch on a strong beat", min: 3.2,
      // the wide held >= 30 frames, 6 frames in to 1.6x, 4 % overshoot back, the close-up held >= 45 frames
      keys: function (d, s, W, H, hit) { var t = Math.max(30 / FPS, Math.min(hit == null ? d * 0.4 : hit, d - 51 / FPS)); return [{ at: 0, p: "scale", v: s, e: "hold" }, { at: t, p: "scale", v: s, e: "out" }, { at: t + 6 / FPS, p: "scale", v: s * 1.66, e: "inout" }, { at: t + 10 / FPS, p: "scale", v: s * 1.6 }]; } },
    steps: { label: "Step zoom on the beats (1x - 1.4x - 1.9x)", energy: 3, credit: "rhythm / beat-cut-moves", use: "hard reframes on three beats - a highlight, a key number", min: 2,
      // three crops of the same picture, each landing on a beat with a 6-frame shutter after-shock (1.03 -> 1)
      keys: function (d, s, W, H, hit, beats) {
        var b = (beats || []).filter(function (t) { return t > 0.05 && t < d - 0.2; }), out = [{ at: 0, p: "scale", v: s, e: "hold" }], z = [1.4, 1.9];
        for (var i = 0; i < Math.min(2, b.length); i++) out.push({ at: b[i], p: "scale", v: s * z[i] * 1.03, e: "out" }, { at: b[i] + 6 / FPS, p: "scale", v: s * z[i], e: "hold" });
        return out;
      } },
    pulse: { label: "Pulse on every beat", energy: 3, credit: "rhythm / type-rhythm-sync", use: "a fast montage - the picture bumps on each beat",
      keys: function (d, s, W, H, hit, beats) {
        var out = [{ at: 0, p: "scale", v: s * 1.04, e: "out" }];
        (beats || []).forEach(function (t) { if (t > 0.05 && t < d - 0.1) out.push({ at: t, p: "scale", v: s * 1.07, e: "out" }, { at: Math.min(d, t + 6 / FPS), p: "scale", v: s * 1.04 }); });
        return out;
      } },
  };
  // an ENTER is the seam into a shot: o = how long the two shots overlap (seconds - taken from the shot before); the incoming
  // shot arrives fully ON THE BEAT. in(o, W) / out(o, W) give the extra keys for the shot coming in and the one going out;
  // opacity changes always go on whichever of the two is UPPER in the layer stack (so it reads the same either way round)
  var ENTERS = {
    cut: { label: "Cut", energy: 0, credit: "transition / transition-hidden-cut", use: "the default - most seams", o: function () { return 0; } },
    dissolve: { label: "Dissolve", energy: 1, credit: "transition / grain-dissolve", use: "calm to calm, time passing", o: function (spb) { return Math.min(0.6, Math.max(0.3, spb)); }, fade: true },
    push: { label: "Push (slide)", energy: 2, credit: "transition / bottom-push-stack-wipe", use: "one idea to the next at the same pace", o: function () { return 10 / FPS; },
      inn: function (o, W) { return [{ at: 0, p: "x", dv: W, e: "inout" }, { at: o, p: "x", dv: 0 }]; }, outk: function (o, W) { return [{ at: -o, p: "x", dv: 0, e: "inout" }, { at: 0, p: "x", dv: -W }]; } },
    whip: { label: "Whip pan", energy: 3, credit: "transition / shot-transitions (B, the whip)", use: "fast to fast - a high-energy run", o: function () { return 6 / FPS; },
      inn: function (o, W) { return [{ at: 0, p: "x", dv: W * 1.1, e: "brake" }, { at: o, p: "x", dv: 0 }]; }, outk: function (o, W) { return [{ at: -o, p: "x", dv: 0, e: "whipIn" }, { at: 0, p: "x", dv: -W * 1.1 }]; } },
    zoom: { label: "Zoom through", energy: 3, credit: "transition / transition-travel", use: "into a climax, a reveal", o: function () { return 8 / FPS; }, fade: true,
      innScale: [1.5, 1], outScale: [1, 1.6] },
  };
  var TITLES = {
    rise: { label: "Title - rises in, centre", credit: "typography / type-entrance-moves", size: 0.085, y: 0 },
    lower: { label: "Lower third - near the bottom", credit: "typography / title-demote-to-label", size: 0.055, y: 0.34 },
    card: { label: "Title card - big, on its own", credit: "typography / paper-title-card", size: 0.1, y: 0 },
  };
  var ARC = [
    { id: "open", label: "Opening (low, held)", share: 0.1, energy: 1 },
    { id: "hero", label: "Hero shot (medium, slow)", share: 0.14, energy: 2 },
    { id: "climb", label: "The climb (high and low taking turns, title cards between)", share: 0.61, energy: 2.5 },
    { id: "finale", label: "Finale (the peak, then the sign-off held)", share: 0.15, energy: 3 }];
  var FEEL = { calm: 2, promo: 1, hype: 0.5 };          // beats per shot x this

  function catalogue() {
    var L = ["MOVES (one per shot - never the same twice in a row; energy 1 calm .. 3 punchy):"];
    Object.keys(MOVES).forEach(function (k) { var m = MOVES[k]; L.push("- " + k + ": " + m.label + " - " + m.use + " (energy " + m.energy + (m.min ? ", needs " + m.min + " s or more" : "") + ")"); });
    L.push("ENTERS (the seam into a shot):");
    Object.keys(ENTERS).forEach(function (k) { var m = ENTERS[k]; L.push("- " + k + ": " + m.label + " - " + m.use); });
    L.push("TITLES (how a shot's words are shown):");
    Object.keys(TITLES).forEach(function (k) { L.push("- " + k + ": " + TITLES[k].label); });
    L.push("THE ARC (share of the length):");
    ARC.forEach(function (a) { L.push("- " + a.id + " " + Math.round(a.share * 100) + " %: " + a.label); });
    return L.join("\n");
  }

  /* ------------------------------------------------------------------ plans */
  var key = function (s) { return String(s || "").trim().toLowerCase(); };
  function findAsset(assets, ref, used) {
    if (ref == null || ref === "") return null;
    if (typeof ref === "number" || /^\d+$/.test(String(ref).trim())) return assets[+ref - 1] || null;    // the LLM's 1-based number
    var k = key(ref);
    return assets.find(function (x) { return key(x.name) === k; }) || assets.find(function (x) { return key(x.name).indexOf(k) >= 0 || k.indexOf(key(x.name).replace(/\.[a-z0-9]+$/, "")) >= 0; }) || null;
  }
  function room(a) { return a.kind === "video" ? Math.max(0, (a.out != null ? a.out : a.dur) - (a.in || 0)) : Infinity; }
  /** the shot lengths for one section: whole beats, `per` each (the last takes the rest) */
  function split(beats, per) { var out = []; while (beats > 0) { var b = beats - per < Math.max(2, per / 2) ? beats : Math.min(per, beats); out.push(b); beats -= b; } return out; }
  function fallback(assets, g, o0) {
    var o = o0 || {}, f = FEEL[o.feel] || 1, n = g.n, shots = [], ai = 0, titles = o.titles !== false;
    if (!assets.length) return { title: "", shots: [] };
    var next = function (kind) { var a = assets[ai % assets.length]; ai++; return a; };
    var secB = ARC.map(function (s) { return Math.max(BAR, Math.round(n * s.share / BAR) * BAR); });
    secB[2] = Math.max(BAR, n - secB[0] - secB[1] - secB[3]);
    if (secB[0] + secB[1] + secB[2] + secB[3] !== n) secB[2] += n - (secB[0] + secB[1] + secB[2] + secB[3]);
    var words = String(o.brief || "").split(/\n+|(?<=[.!?])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var climbMoves = ["panL", "crash", "kenburns", "pulse", "panR", "steps", "rise"], ci = 0, shotN = 0;
    ARC.forEach(function (sec, si) {
      var per = Math.max(1, Math.round((si === 0 ? 8 : si === 1 ? 8 : si === 2 ? 4 : 4) * f));
      split(secB[si], si < 2 ? secB[si] : per).forEach(function (b, k) {
        var a = next(), mv = si === 0 ? "push" : si === 1 ? (a.kind === "picture" ? "kenburns" : "panR") : si === 2 ? climbMoves[ci++ % climbMoves.length] : "pulse";
        var en = shotN === 0 ? "cut" : si === 0 ? "dissolve" : si === 2 ? (k % 2 ? "push" : "cut") : si === 3 ? "whip" : "dissolve";
        var sh = { asset: a.name, beats: b, move: mv, enter: en, section: sec.id, text: "", title: "rise" };
        if (titles && si === 0 && words[0]) sh.text = words[0].slice(0, 80);
        shots.push(sh); shotN++;
      });
    });
    var last = shots[shots.length - 1];
    if (last) { last.move = "hold"; if (titles) { last.text = (o.cta || words[words.length > 1 ? words.length - 1 : 0] || "").slice(0, 80); last.title = "card"; } }
    return { title: words[0] || "Auto edit", shots: shots, by: "bitGen" };
  }
  function clean(p0, assets, g, o0) {
    var o = o0 || {}, p = p0 && typeof p0 === "object" ? p0 : {}, notes = [];
    var raw = Array.isArray(p.shots) ? p.shots : [];
    var shots = [], usedAt = {};
    raw.forEach(function (s0, i) {
      var s = s0 || {}, card = !!s.card || (!s.asset && !!s.text);
      var a = card ? null : findAsset(assets, s.asset, usedAt);
      if (!card && !a) { a = assets[i % Math.max(1, assets.length)] || null; if (s.asset) notes.push('shot ' + (i + 1) + ': "' + s.asset + '" is not one of the pictures / videos - ' + (a ? a.name : "none") + " used"); }
      if (!card && !a) return;
      var mv = MOVES[s.move] ? s.move : a && a.kind === "picture" ? "kenburns" : "push", en = ENTERS[s.enter] ? s.enter : "cut";
      shots.push({ asset: a ? a.name : "", card: card, beats: Math.max(1, Math.round(clampN(s.beats, 1, 128, 4))), move: card ? "hold" : mv, enter: en,
        text: String(s.text || "").replace(/\s+/g, " ").trim().slice(0, 90), title: TITLES[s.title] ? s.title : card ? "card" : "rise", section: String(s.section || "").slice(0, 12) });
    });
    if (!shots.length) return Object.assign(fallback(assets, g, o), { notes: ["the plan had no shots - bitGen's own plan"] });
    // a video never asked for more than it has (its beats cut down; the next shot takes the time)
    shots.forEach(function (s) {
      var a = findAsset(assets, s.asset); if (!a || a.kind !== "video") return;
      var max = Math.floor((room(a) - 0.75 * g.spb) / g.spb); if (max < 1) max = 1;
      if (s.beats > max) { notes.push(a.name + " is " + room(a).toFixed(1) + " s - its shot cut to " + max + " beat(s)"); s.beats = max; }
    });
    // the beats add up to the length: short = the shots that can grow take beats in turn (pictures / cards first); long = taken from the end
    var sum = function () { return shots.reduce(function (t, s) { return t + s.beats; }, 0); };
    var guard = 0;
    while (sum() < g.n && guard++ < 10000) {
      var grow = shots.filter(function (s) { var a = findAsset(assets, s.asset); return s.card || !a || a.kind !== "video" || (s.beats + 1) * g.spb + 0.75 * g.spb <= room(a); });
      if (!grow.length) { var a0 = assets[shots.length % assets.length]; shots.splice(shots.length - 1, 0, { asset: a0.name, card: false, beats: Math.min(g.n - sum(), a0.kind === "video" ? Math.max(1, Math.floor(room(a0) / g.spb) - 1) : 4), move: a0.kind === "picture" ? "kenburns" : "panL", enter: "cut", text: "", title: "rise", section: "climb" }); continue; }
      grow.sort(function (x, y) { return x.beats - y.beats; })[0].beats++;
    }
    while (sum() > g.n) { var big = shots.slice().sort(function (x, y) { return y.beats - x.beats; })[0]; if (big.beats <= 1) { shots.pop(); continue; } big.beats--; }
    // the craft rules
    shots[0].enter = "cut";
    // a move that needs more time than the shot has gives way first (crash zoom 3.2 s: the 30-frame wide + the 45-frame close-up)
    shots.forEach(function (s) { var m = MOVES[s.move]; if (m && m.min && s.beats * g.spb < m.min) { notes.push("shot " + (shots.indexOf(s) + 1) + ": " + s.move + " needs " + m.min + " s - " + (s.move === "crash" ? "push" : "pulse")); s.move = s.move === "crash" ? "push" : "pulse"; } });
    for (var i = 1; i < shots.length; i++) {
      if (shots[i].move === shots[i - 1].move && shots[i].move !== "hold") { var alt = shots[i].move === "panL" ? "panR" : shots[i].move === "panR" ? "panL" : shots[i].move === "push" ? "pull" : "drift"; notes.push("shot " + (i + 1) + ": " + shots[i].move + " twice in a row - " + alt); shots[i].move = alt; }
    }
    var last = shots[shots.length - 1];
    if (last.beats * g.spb < 1 && shots.length > 1) { var give = Math.ceil(1 / g.spb) - last.beats, prev = shots[shots.length - 2]; var can = Math.min(give, prev.beats - 1); if (can > 0) { prev.beats -= can; last.beats += can; } }
    return { title: String(p.title || "").slice(0, 120), shots: shots, by: p.by || "llm", notes: notes.concat(Array.isArray(p.notes) ? p.notes : []).slice(0, 30) };
  }

  /* ------------------------------------------------------------------ build */
  var addK = function (kf, at, p, v, e) { var k = { at: r4(Math.max(0, at)) }; k[p] = r4(v); if (e === "hold" || e === "linear") k.ease = e; else if (EASE[e]) { k.ease = "bezier"; k.bz = EASE[e].slice(); } kf.push(k); };
  /** the move's keys for a shot of d seconds (its beats inside it, seconds from its start) */
  function moveKeys(mv, d, s, W, H, beats) { var m = MOVES[mv] || MOVES.hold; return m.keys(d, s, W, H, beats && beats.length ? beats[Math.floor(beats.length / 2)] : null, beats); }
  function valueAt(keys, p, t, fb) { var kf = []; keys.filter(function (k) { return k.p === p; }).forEach(function (k) { addK(kf, k.at, p, k.v, k.e); }); return kf.length ? KF.value(kf, t, p, fb) : fb; }
  function build(plan, assets, g, frame, o0) {
    var o = o0 || {}, W = +((frame || {}).W) || 1920, H = +((frame || {}).H) || 1080;
    var layers = { vA: { name: "✨ Video A", clips: [] }, vB: { name: "✨ Video B", clips: [] }, iA: { name: "✨ Pictures A", clips: [] }, iB: { name: "✨ Pictures B", clips: [] }, txt: { name: "✨ Titles", clips: [] } };
    var RANK = { vA: 0, vB: 1, iA: 2, iB: 3, txt: 4 }, turn = { video: 0, picture: 0 }, uses = {}, cuts = [], out = [];
    var b = 0;
    plan.shots.forEach(function (s, i) {
      var t0 = g.at(b), t1 = g.at(b + s.beats), d = r4(t1 - t0), en = ENTERS[s.enter] || ENTERS.cut;
      var o = i === 0 ? 0 : Math.min(r4(en.o(g.spb)), d * 0.5, out[i - 1] ? out[i - 1].d * 0.5 : 0);
      var inBeats = []; for (var k = b + 1; k < b + s.beats; k++) inBeats.push(r4(g.at(k) - t0));
      var rec = { i: i, t0: t0, t1: t1, d: d, o: o, shot: s, clip: null, layer: null, beatsIn: inBeats };
      cuts.push(t0);
      if (!s.card) {
        var a = findAsset(assets, s.asset), kind = a.kind === "video" ? "video" : "picture";
        var lk = (kind === "video" ? "v" : "i") + (turn[kind]++ % 2 ? "B" : "A");
        var nw = +a.w || W, nh = +a.h || H;
        var base = kind === "picture" ? Math.min(nw, W) : nw, bh = kind === "picture" ? nh * base / nw : nh;   // the canvas's own scale-1 size
        var cover = r4(Math.max(W / base, H / bh));
        var keys = moveKeys(s.move, d + o, cover, W, H, inBeats.map(function (t) { return t + o; })).map(function (k) { return Object.assign({}, k); });
        var len = r4(d + o), clip;
        if (kind === "video") {
          var u = uses[a.name] || 0, span = room(a), from = (a.in || 0) + Math.max(0, Math.min(span - len, u * len * 0.9));   // a second use takes the next stretch
          if (u && from + len > (a.in || 0) + span) from = a.in || 0;
          uses[a.name] = u + 1;
          clip = { name: a.name, src: a.src || "video", in: r4(from), out: r4(from + len), dur: a.dur, start: r4(t0 - o), opacity: 1, tf: { x: 0, y: 0, scale: cover, rot: 0 }, kf: [], ae: { shot: i + 1, move: s.move } };
        } else clip = { name: a.name, start: r4(t0 - o), len: len, opacity: 1, tf: { x: 0, y: 0, scale: cover, rot: 0 }, kf: [], ae: { shot: i + 1, move: s.move } };
        rec.clip = clip; rec.layer = lk; rec.keys = keys; rec.cover = cover;
        layers[lk].clips.push(clip);
      }
      out.push(rec); b += s.beats;
    });
    // the seams: the incoming shot's extra keys, the outgoing's, the fade on the upper one
    out.forEach(function (r, i) {
      if (!i || !r.o) return;
      var p = out[i - 1], en = ENTERS[r.shot.enter] || ENTERS.cut;
      if (en.inn && r.clip) en.inn(r.o, W).forEach(function (k) { r.keys.push({ at: k.at, p: k.p, add: k.dv, e: k.e }); });
      if (en.outk && p.clip) en.outk(r.o, W).forEach(function (k) { p.keys.push({ at: p.d + p.o + k.at, p: k.p, add: k.dv, e: k.e }); });
      var upIn = !p.clip || (r.clip && RANK[r.layer] > RANK[p.layer]);
      if (en.fade) {
        if (upIn && r.clip) r.keys.push({ at: 0, p: "op", v: 0, e: "linear" }, { at: r.o, p: "op", v: 1 });
        else if (p.clip) p.keys.push({ at: p.d + p.o - r.o, p: "op", v: 1, e: "linear" }, { at: p.d + p.o, p: "op", v: 0 });
      }
      if (en.innScale && upIn && r.clip) r.keys.push({ at: 0, p: "scale", mul: en.innScale[0], e: "out" }, { at: r.o, p: "scale", mul: 1 });
      else if (en.outScale && p.clip) p.keys.push({ at: p.d + p.o - r.o, p: "scale", mul: 1, e: "inout" }, { at: p.d + p.o, p: "scale", mul: en.outScale[1] });
    });
    // the keys onto the clips: the move's own keys, with a seam's offsets added to the move's value at that moment
    out.forEach(function (r) {
      if (!r.clip) return;
      var mv = r.keys.filter(function (k) { return k.v != null && !k.add && !k.mul && k.p !== "op"; }), extra = r.keys.filter(function (k) { return k.add != null || k.mul != null; });
      var base = { x: 0, y: 0, scale: r.cover, rot: 0 };
      ["scale", "x", "y", "rot"].forEach(function (p) {
        var own = mv.filter(function (k) { return k.p === p; }), ex = extra.filter(function (k) { return k.p === p; });
        if (!ex.length) { own.forEach(function (k) { addK(r.clip.kf, k.at, p, k.v, k.e); }); return; }
        var lo = Math.min.apply(null, ex.map(function (k) { return k.at; })), hi = Math.max.apply(null, ex.map(function (k) { return k.at; }));
        own.filter(function (k) { return k.at < lo - 1e-6 || k.at > hi + 1e-6; }).forEach(function (k) { addK(r.clip.kf, k.at, p, k.v, k.e); });
        ex.forEach(function (k) { var mvv = valueAt(own, p, k.at, base[p]); addK(r.clip.kf, k.at, p, k.mul != null ? mvv * k.mul : mvv + k.add, k.e); });
        // the move's own keys inside the seam are dropped; its value at the seam's end continues it
      });
      r.keys.filter(function (k) { return k.p === "op"; }).forEach(function (k) { addK(r.clip.kf, k.at, "op", k.v, k.e); });
      r.clip.kf.sort(function (a, b) { return a.at - b.at; });
      if (!r.clip.kf.length) delete r.clip.kf;
    });
    // the words: titles over their shot (from its beat, not during the seam), cards on their own
    out.forEach(function (r) {
      var s = r.shot; if (!s.text) return;
      var ts = TITLES[s.title] || TITLES.rise, start = r4(r.t0 + (r.clip ? 0 : 0)), len = r4(Math.max(0.5, r.d - (r === out[out.length - 1] ? 0 : 4 / FPS)));
      var c = { start: start, len: len, opacity: 1, text: { content: s.text, font: "Arial", size: Math.round(H * ts.size), color: "#ffffff", bold: true, italic: false, stroke: "#000000", strokeW: Math.max(1, Math.round(H * 0.003)), shadow: true, align: "center" },
        tf: { x: 0, y: r4(H * ts.y), scale: 1, rot: 0 }, kf: [], ae: { shot: r.i + 1, title: s.title } };
      var rise = Math.min(10 / FPS, len / 4);
      addK(c.kf, 0, "op", 0, "out"); addK(c.kf, rise, "op", 1); addK(c.kf, 0, "y", r4(H * ts.y + H * 0.035), "out"); addK(c.kf, rise, "y", r4(H * ts.y));
      if (s.title === "card") { addK(c.kf, 0, "scale", 0.9, "out"); addK(c.kf, rise * 1.5, "scale", 1); }
      if (r !== out[out.length - 1]) { addK(c.kf, Math.max(rise, len - 6 / FPS), "op", 1, "linear"); addK(c.kf, len, "op", 0); }
      c.kf.sort(function (a, b) { return a.at - b.at; });
      layers.txt.clips.push(c);
    });
    var music = null;
    if (o.song) {
      var total = g.at(g.n), fade = r4(Math.min(1.5, 2 * g.spb)), sin = r4((+o.song.in || 0) + g.offset);
      music = { name: "✨ Music", clips: [{ name: o.song.name, start: 0, in: sin, out: r4(sin + total), dur: o.song.dur || total, kf: [{ at: r4(total - fade), vol: 1, ease: "linear" }, { at: r4(total), vol: 0 }], ae: { music: true } }] };
    }
    var vl = [layers.vA, layers.vB].filter(function (L) { return L.clips.length; }), im = [layers.iA, layers.iB, layers.txt].filter(function (L) { return L.clips.length; });
    if (music) vl.forEach(function (L) { L.muted = true; });      // the song carries the sound
    return { vlayers: vl, images: im, audio: music ? [music] : [], cuts: cuts, shots: out.map(function (r) { return { i: r.i + 1, t0: r.t0, t1: r.t1, o: r.o, asset: r.shot.asset, card: r.shot.card, move: r.shot.move, enter: r.shot.enter, text: r.shot.text, layer: r.layer }; }), total: g.at(g.n) };
  }

  /* ------------------------------------------------------------------ check */
  function qa(built, plan, g, assets) {
    var issues = [], tol = 0.5 / FPS, beats = []; for (var i = 0; i <= g.n; i++) beats.push(g.at(i));
    built.shots.forEach(function (s) {
      if (!beats.some(function (t) { return Math.abs(t - s.t0) <= tol; })) issues.push("shot " + s.i + " does not start on a beat (" + s.t0.toFixed(3) + " s)");
      if (s.t1 - s.t0 < 0.3) issues.push("shot " + s.i + " is only " + (s.t1 - s.t0).toFixed(2) + " s");
    });
    built.vlayers.forEach(function (L) { L.clips.forEach(function (c) { var a = findAsset(assets || [], c.name); if (a && c.out > (a.out != null ? a.out : a.dur) + 0.01) issues.push(c.name + " is asked for past its end (" + c.out.toFixed(2) + " s of " + (a.out != null ? a.out : a.dur).toFixed(2) + ")"); }); });
    built.images.forEach(function (L) { L.clips.forEach(function (c) { if (c.text && c.len < 1.2 && (c.ae || {}).title !== "card") issues.push('"' + c.text.content.slice(0, 30) + '" is on screen ' + c.len.toFixed(1) + " s - too short to read"); }); });
    var sh = built.shots, last = sh[sh.length - 1];
    if (sh.length && sh[0].t1 - sh[0].t0 < 1) issues.push("the opening is held under 1 s");
    if (last && last.t1 - last.t0 < 1) issues.push("the sign-off is held under 1 s");
    var cards = sh.filter(function (s) { return s.card; }).length; if (cards > 4) issues.push(cards + " title cards - 2 to 4 read best");
    for (var j = 1; j < sh.length; j++) if (sh[j].move === sh[j - 1].move && sh[j].move !== "hold") issues.push("shots " + j + " and " + (j + 1) + " both " + sh[j].move);
    if (Math.abs(built.total - g.at(g.n)) > tol) issues.push("the edit is not the length asked for");
    return issues;
  }
  return { FPS: FPS, BAR: BAR, EASE: EASE, MOVES: MOVES, ENTERS: ENTERS, TITLES: TITLES, ARC: ARC, FEEL: FEEL, grid: grid, catalogue: catalogue, findAsset: findAsset, fallback: fallback, clean: clean, build: build, qa: qa, moveKeys: moveKeys };
});
