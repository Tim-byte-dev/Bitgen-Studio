/* bitGen Studio — ext/synthdock/synthscore.js (2.954.0): 🎹 THE SCORE SCREEN in the middle of the keyboard (window.H3SynthScore).
 * Tim: "the black rectangle in the middle will be to record sheet music live from the keyboard or load sheet music so user can
 * learn to play."
 *   ● Rec     every note you play (the keys on screen, the computer keys, a MIDI keyboard) is written as sheet music while you
 *             play - from your first note, to the 16th note at the looper's BPM, chords together, rests in the gaps, notes
 *             tied over the bar; ■ stops. Drawn by the app's own engraver (static/abcscore.js - ABC in, staves out).
 *   📂 Open   an .abc sheet (the 🎼 Sheet music tab's files, or any ABC 2.1 tune); 💾 Save = the sheet as .abc
 *   ▶ Play    the synth plays the sheet - each note lit on the staff and its key lit on the keyboard
 *   🎓 Learn  the next note(s) lit on the staff and on the keys (the keyboard moves to their octave); it waits for you to play
 *             them, then goes on; a wrong key flashes and is counted; at the end: how many you got right first time
 *   ⏮        back to the start
 * Pure (Node: scripts/test-954.js): abcPitch(midi), toAbc(notes, {bpm, title}) (notes = [{m, t0, t1}] seconds), steps(timing)
 * (the notes to play, chords together).
 * init({engine(), base() / setOct(o) (the keyboard), bpm(), msg(), guide(set of midi), saved, save(abc)})
 */
(function (root) {
  "use strict";
  var NAMES = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];
  /** a MIDI note as ABC: 60 = C, 72 = c, 84 = c', 48 = C, ; sharps (K:C) */
  function abcPitch(m) {
    m = Math.round(m);
    var pc = ((m % 12) + 12) % 12, oct = Math.floor(m / 12) - 1, n = NAMES[pc], acc = n.length > 1 ? "^" : "", L = n.slice(-1);
    if (oct >= 5) return acc + L.toLowerCase() + new Array(oct - 4).join("'");
    return acc + L + new Array(Math.max(0, 4 - oct) + 1).join(",");
  }
  function len(u) { return u === 1 ? "" : String(u); }
  /** played notes [{m, t0, t1}] (seconds) -> an ABC tune: L:1/16 at `bpm`, from the first note, 16 sixteenths a bar */
  function toAbc(notes, o) {
    o = o || {};
    var bpm = Math.max(30, Math.min(300, Math.round(o.bpm || 120))), sixteenth = 60 / bpm / 4, BAR = 16, MAXQ = BAR * 64;
    var ns = (notes || []).filter(function (n) { return n && Number.isFinite(n.m) && Number.isFinite(n.t0); }).slice().sort(function (a, b) { return a.t0 - b.t0; });
    var head = "X:1\nT:" + String(o.title || "Played").replace(/[\r\n]/g, " ").slice(0, 60) + "\nM:4/4\nL:1/16\nQ:1/4=" + bpm + "\nK:C\n";
    if (!ns.length) return head + "z16|]\n";
    var start = ns[0].t0, ev = {};
    ns.forEach(function (n) {
      var q = Math.round((n.t0 - start) / sixteenth); if (q >= MAXQ) return;
      var l = Math.max(1, Math.round(((n.t1 != null ? n.t1 : n.t0 + sixteenth) - n.t0) / sixteenth));
      var e = ev[q] || (ev[q] = { q: q, ms: [], l: 0 });
      if (e.ms.indexOf(n.m) < 0) e.ms.push(n.m);
      e.l = Math.max(e.l, l);
    });
    var list = Object.keys(ev).map(function (k) { return ev[k]; }).sort(function (a, b) { return a.q - b.q; });
    list.forEach(function (e, i) { var nx = list[i + 1]; if (nx) e.l = Math.min(e.l, nx.q - e.q); e.ms.sort(function (a, b) { return a - b; }); });
    var out = [], pos = 0;
    function put(sym, l, tie) {       // across the bar lines: a note is tied over, a rest just goes on
      while (l > 0) {
        var room = BAR - (pos % BAR), take = Math.min(room, l);
        l -= take; out.push(sym + len(take) + (l > 0 && tie ? "-" : "")); pos += take;
        if (pos % BAR === 0) out.push("|");
      }
    }
    list.forEach(function (e) {
      if (e.q > pos) put("z", e.q - pos, false);
      var sym = e.ms.length > 1 ? "[" + e.ms.map(abcPitch).join("") + "]" : abcPitch(e.ms[0]);
      put(sym, e.l, e.ms.length === 1);
    });
    if (pos % BAR) put("z", BAR - (pos % BAR), false);
    if (out[out.length - 1] === "|") out[out.length - 1] = "|]"; else out.push("|]");
    // four bars a line
    var lines = [], cur = [], bars = 0;
    out.forEach(function (t) { cur.push(t); if (t === "|" || t === "|]") { bars++; if (bars % 4 === 0) { lines.push(cur.join(" ")); cur = []; } } });
    if (cur.length) lines.push(cur.join(" "));
    return head + lines.join("\n").replace(/ \|/g, " |") + "\n";
  }
  /** the engraver's timing -> the steps to play: [{t0, t1, midis: [...]}] (a chord = one step) */
  function steps(timing) {
    var by = {}, out = [];
    ((timing && timing.sound) || []).forEach(function (s) { var e = by[s.t0] || (by[s.t0] = { t0: s.t0, t1: s.t1, midis: [] }); if (e.midis.indexOf(s.midi) < 0) e.midis.push(s.midi); e.t1 = Math.max(e.t1, s.t1); });
    Object.keys(by).forEach(function (k) { out.push(by[k]); });
    return out.sort(function (a, b) { return a.t0 - b.t0; });
  }
  var pure = { abcPitch: abcPitch, toAbc: toAbc, steps: steps };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, A = null;   // static/abcscore.js (window.AbcScore) - read when first drawn (it may load after this)
  var $ = function (id) { return doc.getElementById(id); };
  var LOOK = { paper: { color: "#0a0f15" }, ink: "#dbe7f5" };
  var O = null, Z = { abc: "", r: null, st: [], mode: "idle", rec: [], held: {}, t0: 0, li: 0, hit: {}, wrong: 0, firstTry: 0, missed: false, play: null, redrawT: 0, els: {} };
  function msg(t, bad) { var m = $("syScoreMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } }
  function setMode(m) {
    Z.mode = m; var box = $("syScoreBox"); if (box) box.dataset.mode = m;
    [["syScRec", "rec"], ["syScPlay", "play"], ["syScLearn", "learn"]].forEach(function (x) { var b = $(x[0]); if (b) { b.classList.toggle("on", m === x[1]); b.setAttribute("aria-pressed", m === x[1] ? "true" : "false"); } });
  }
  /** draw the sheet into the screen (dark paper, light ink); notes keep their ids (data-n) for lighting */
  function draw() {
    var v = $("syScoreView"); if (!v) return;
    Z.els = {}; A = A || root.AbcScore;
    if (!A || !Z.abc) { v.innerHTML = '<div class="syscorehint">● Rec and play - your notes are written here as sheet music.<br>📂 Open an .abc sheet, then 🎓 Learn to play it, or ▶ to hear it.</div>'; Z.r = null; Z.st = []; return; }
    try {
      var vw = v.clientWidth || 380;   // drawn at about 1.4x - readable on the small screen
      Z.r = A.render(Z.abc, { pageW: Math.max(240, Math.round(vw / 1.4)), pageH: 2400, mt: 18, mb: 14, ml: 12, mr: 12 });
      Z.st = steps(Z.r.timing);
      v.innerHTML = Z.r.pages.map(function (pg, i) { return A.toSVG(pg, { look: LOOK, id: "sy" + i }); }).join("");
      v.querySelectorAll("path[data-n]").forEach(function (el) { var n = el.getAttribute("data-n"); (Z.els[n] = Z.els[n] || []).push(el); });
    } catch (e) { v.innerHTML = '<div class="syscorehint bad">This sheet could not be read - ' + String(e.message || e).replace(/</g, "&lt;") + "</div>"; Z.r = null; Z.st = []; }
  }
  /** light the written notes that sound at tick t0 (and scroll them into view) */
  function lightAt(t0) {
    doc.querySelectorAll("#syScoreView path.lit").forEach(function (el) { el.classList.remove("lit"); });
    if (!Z.r || t0 == null) return;
    var first = null;
    Z.r.timing.notes.forEach(function (n) { if (n.t0 === t0) (Z.els[n.id] || []).forEach(function (el) { el.classList.add("lit"); first = first || el; }); });
    if (first) { var v = $("syScoreView"), r = first.getBoundingClientRect(), vr = v.getBoundingClientRect(); if (r.top < vr.top + 10 || r.bottom > vr.bottom - 10) v.scrollTop += r.top - vr.top - vr.height / 3; }
  }
  function guide(ms) { if (O && O.guide) O.guide(ms || []); }
  function keep() { if (O && O.save) O.save(Z.abc); }

  /* ---- ● Rec */
  function rec() {
    if (Z.mode === "rec") return stop();
    stop(); Z.rec = []; Z.held = {}; Z.t0 = 0; setMode("rec");
    msg("● Recording - play; the sheet is written from your first note (" + (O.bpm ? O.bpm() : 120) + " BPM, the looper's). ■ stops.");
  }
  function now() { return (root.performance ? root.performance.now() : Date.now()) / 1000; }
  function noteOn(m) {
    if (Z.mode === "rec") { var t = now(); Z.held[m] = { m: m, t0: t, t1: null }; Z.rec.push(Z.held[m]); }
    else if (Z.mode === "learn") learnHit(m);
  }
  function noteOff(m) {
    if (Z.mode === "rec" && Z.held[m]) { Z.held[m].t1 = now(); delete Z.held[m]; root.clearTimeout(Z.redrawT); Z.redrawT = root.setTimeout(writeRec, 150); }
  }
  function writeRec() {
    var t = now(); Z.rec.forEach(function (n) { if (n.t1 == null) n.t1 = t; });
    Z.abc = toAbc(Z.rec.map(function (n) { return { m: n.m, t0: n.t0, t1: n.t1 }; }), { bpm: O.bpm ? O.bpm() : 120, title: "Played " + new Date().toTimeString().slice(0, 5) });
    Object.keys(Z.held).forEach(function (k) { Z.held[k].t1 = null; });   // still down: keeps growing
    draw(); var v = $("syScoreView"); if (v) v.scrollTop = v.scrollHeight;
  }
  /* ---- ▶ the synth plays the sheet */
  function play() {
    if (Z.mode === "play") return stop();
    stop(); if (!Z.st.length) { msg("No notes to play - ● Rec or 📂 Open a sheet first", true); return; }
    var E = O.engine(), ctx = E.ctx, T = Z.r.timing, spt = 60 / ((T.qpm || 120) * (T.tpq || 480)), at = ctx.currentTime + 0.12;
    Z.st.forEach(function (s) { s.midis.forEach(function (m) { E.noteOn(m, 0.75, at + s.t0 * spt); E.noteOff(m, at + s.t1 * spt - 0.01); }); });
    setMode("play"); Z.play = { at: at, spt: spt, i: -1 };
    var tick = function () {
      if (Z.mode !== "play") return;
      var t = (ctx.currentTime - Z.play.at) / Z.play.spt, i = -1;
      for (var k = 0; k < Z.st.length && Z.st[k].t0 <= t; k++) i = k;
      if (i !== Z.play.i) { Z.play.i = i; if (i >= 0) { lightAt(Z.st[i].t0); guide(Z.st[i].midis); } }
      if (i >= 0 && i === Z.st.length - 1 && t > Z.st[i].t1) { stop(); msg("▶ played to the end"); return; }
      Z.play.raf = root.requestAnimationFrame(tick);
    };
    tick(); msg("▶ Playing the sheet");
  }
  /* ---- 🎓 Learn */
  function learn() {
    if (Z.mode === "learn") return stop();
    stop(); if (!Z.st.length) { msg("Nothing to learn yet - 📂 Open a sheet (or ● Rec one)", true); return; }
    setMode("learn"); Z.li = 0; Z.wrong = 0; Z.firstTry = 0; Z.hit = {}; Z.missed = false; learnShow();
  }
  function learnShow() {
    var s = Z.st[Z.li]; if (!s) return;
    lightAt(s.t0); guide(s.midis);
    var lo = Math.min.apply(null, s.midis), hi = Math.max.apply(null, s.midis), b = O.base();
    if (lo < b || hi > b + 48) O.setOct(Math.max(0, Math.min(7, Math.floor(lo / 12) - 1)));
    msg("🎓 " + (Z.li + 1) + " / " + Z.st.length + " - play " + s.midis.map(function (m) { return root.H3SynthCore.noteName(m); }).join(" + ") + (Z.wrong ? " · wrong keys " + Z.wrong : ""));
  }
  function learnHit(m) {
    var s = Z.st[Z.li]; if (!s) return;
    if (s.midis.indexOf(m) < 0) { Z.wrong++; Z.missed = true; var b = $("syScoreBox"); if (b) { b.classList.add("wrong"); root.setTimeout(function () { b.classList.remove("wrong"); }, 220); } learnShow(); return; }
    Z.hit[m] = true;
    if (s.midis.every(function (x) { return Z.hit[x]; })) {
      if (!Z.missed) Z.firstTry++;
      Z.li++; Z.hit = {}; Z.missed = false;
      if (Z.li >= Z.st.length) { var n = Z.st.length; stop(); msg("🎓 Well played! " + Z.firstTry + " of " + n + " right first time" + (Z.wrong ? " · " + Z.wrong + " wrong key" + (Z.wrong === 1 ? "" : "s") : " - not one wrong key")); return; }
      learnShow();
    }
  }
  function stop() {
    var was = Z.mode;
    if (was === "rec") { writeRec(); keep(); msg("■ " + Z.st.length + " note" + (Z.st.length === 1 ? "" : "s") + " written - 💾 Save keeps the sheet, 🎓 Learn plays it back with you"); }
    if (was === "play" && Z.play) { root.cancelAnimationFrame(Z.play.raf); try { O.engine().allOff(); } catch (e) { /* fine */ } }
    setMode("idle"); guide([]); lightAt(null);
    return was;
  }
  function toStart() { var m = Z.mode; stop(); var v = $("syScoreView"); if (v) v.scrollTop = 0; if (m === "learn") learn(); }
  function open(text, name) {
    stop(); Z.abc = String(text || ""); draw();
    if (!Z.st.length) { msg((name || "That file") + " has no notes I can read (an ABC sheet: X:, T:, K: and the notes)", true); return false; }
    keep(); msg("📂 " + (Z.r.title || name || "Sheet") + " - " + Z.st.length + " notes. 🎓 Learn, or ▶ to hear it"); return true;
  }
  function save() {
    if (!Z.abc) { msg("Nothing to save yet", true); return null; }
    var name = ((Z.r && Z.r.title) || "sheet").replace(/[^\w\- ]+/g, "").trim() || "sheet";
    var a = doc.createElement("a"), u = root.URL.createObjectURL(new root.Blob([Z.abc], { type: "text/plain" }));
    a.href = u; a.download = name + ".abc"; doc.body.appendChild(a); a.click(); a.remove(); root.setTimeout(function () { root.URL.revokeObjectURL(u); }, 4000);
    msg("💾 " + name + ".abc"); return name + ".abc";
  }
  function wire() {
    var on = function (id, f) { var el = $(id); if (el) el.onclick = f; };
    on("syScRec", rec); on("syScPlay", play); on("syScStop", function () { stop(); }); on("syScStart", toStart); on("syScLearn", learn); on("syScSave", save);
    on("syScOpen", function () { $("syScoreFile").click(); });
    var f = $("syScoreFile");
    if (f) f.onchange = function () { var file = f.files && f.files[0]; if (!file) return; file.text().then(function (t) { open(t, file.name); f.value = ""; }); };
  }
  function init(o) { O = o; wire(); Z.abc = o.saved || ""; draw(); setMode("idle"); }
  root.H3SynthScore = Object.assign({ init: init, noteOn: noteOn, noteOff: noteOff, rec: rec, play: play, stop: stop, learn: learn, open: open, save: save, toStart: toStart, draw: draw,
    abc: function () { return Z.abc; },
    info: function () { return { mode: Z.mode, abc: Z.abc, steps: Z.st.length, li: Z.li, wrong: Z.wrong, firstTry: Z.firstTry, recorded: Z.rec.length, lit: doc.querySelectorAll("#syScoreView path.lit").length, next: Z.st[Z.li] ? Z.st[Z.li].midis.slice() : null }; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
