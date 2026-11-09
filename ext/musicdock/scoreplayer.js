/* bitGen Studio — the sheet music PLAYER (2.733.0): window.ScorePlayer.
 *
 * Tim (verbatim): "in sheet music tab add media buttons play/pause, rewind,rewind to start,foward , foward to end buttons
 * for the songs sheet music and highlight the notes as the song is played"
 *
 * The score's timing comes from the engraver (AbcScore.render(...).timing: ticks, the tempo, each written note's time
 * and id, each bar's time and place, the notes to sound). Two ways to hear it:
 *   song   the song the score belongs to (the audio file beside the .abc - the same name), in an <audio>; the score's
 *          clock is the song's time minus a Sync offset (seconds of intro before bar 1);
 *   synth  the notes themselves, played by the browser (Web Audio oscillators, nothing loaded) - for a score with no
 *          song (🎼 Write, 📂 Open .abc) or to check the written notes.
 * Pure (Node-tested): secPerTick, tickAt, secAt, barAt, activeAt, prevBar, nextBar, fmt, midiHz.
 * The browser: create({timing, audioUrl, offset, onFrame}) -> {play, pause, toggle, seek, back, forward, toStart, toEnd,
 * position, duration, playing, mode, setOffset, destroy}. onFrame(sec, tick) runs every frame while it plays and after
 * every seek - the tab paints the notes from it. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(null);
  else root.ScorePlayer = factory(root);
}(typeof window !== "undefined" ? window : this, function (root) {
  "use strict";
  const secPerTick = (T) => 60 / ((T.qpm || 120) * (T.tpq || 480));
  const tickAt = (T, sec) => sec / secPerTick(T);
  const secAt = (T, tick) => tick * secPerTick(T);
  /** the bar sounding at `tick` (the last one at the end; -1 before bar 1) */
  function barAt(T, tick) {
    const b = T.barStarts || [];
    if (!b.length || tick < 0) return -1;
    let lo = 0, hi = b.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (b[m] <= tick) lo = m; else hi = m - 1; }
    return lo;
  }
  /** the written notes sounding at `tick` -> their ids (a tied-over note lights when its own time comes) */
  function activeAt(T, tick) {
    const out = [];
    if (tick < 0 || tick >= T.total) return out;
    for (const n of T.notes || []) { if (n.t0 > tick) break; if (tick < n.t1) out.push(n.id); }
    return out;
  }
  /** ⏪: the start of this bar - or the bar before when it is within half a second of this one's start */
  function prevBar(T, sec) {
    const i = barAt(T, tickAt(T, sec));
    if (i <= 0) return 0;
    const s0 = secAt(T, T.barStarts[i]);
    return sec - s0 > 0.5 ? s0 : secAt(T, T.barStarts[i - 1]);
  }
  /** ⏩: the start of the next bar (the end after the last) */
  function nextBar(T, sec) {
    const i = barAt(T, tickAt(T, sec) + 1e-6);
    const b = T.barStarts || [];
    return i + 1 < b.length ? secAt(T, b[i + 1]) : secAt(T, T.total);
  }
  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec + 1e-6));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ── the browser: the two engines behind one set of buttons ──
  function create(o) {
    const T = o.timing, onFrame = o.onFrame || (() => {});
    let offset = +o.offset || 0, raf = 0, dead = false;
    const scoreEnd = secAt(T, T.total);
    let eng;
    if (o.audioUrl) {
      const a = new root.Audio();
      a.preload = "auto"; a.src = o.audioUrl;
      a.addEventListener("ended", () => { stopLoop(); frame(); });
      a.addEventListener("loadedmetadata", () => frame());
      eng = {
        mode: "song", el: a,
        pos: () => a.currentTime - offset,
        dur: () => (Number.isFinite(a.duration) && a.duration > 0 ? a.duration - offset : scoreEnd),
        playing: () => !a.paused && !a.ended,
        play: () => { const p = a.play(); return p && p.catch ? p.catch((e) => { if (o.onError) o.onError(e); }) : Promise.resolve(); },
        pause: () => a.pause(),
        seek: (s) => { a.currentTime = Math.max(0, Math.min(s + offset, Number.isFinite(a.duration) ? a.duration : s + offset)); },
        destroy: () => { a.pause(); a.removeAttribute("src"); try { a.load(); } catch (e) { /* gone */ } },
      };
    } else {
      let ctx = null, startCtx = 0, startPos = 0, pos = 0, on = false, timer = 0, next = 0, voices = [];
      const sound = T.sound || [];
      const gainFor = (v) => (v === 0 ? 0.16 : 0.09);
      const strike = (n, at, from) => {
        const len = Math.max(0.05, secAt(T, n.t1) - Math.max(from, secAt(T, n.t0)));
        const g = ctx.createGain(), peak = gainFor(n.v);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
        g.gain.exponentialRampToValueAtTime(peak * 0.55, at + Math.min(0.25, len * 0.6));
        g.gain.setValueAtTime(peak * 0.55, at + Math.max(0.02, len - 0.06));
        g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.05);
        g.connect(ctx.destination);
        const hz = midiHz(n.midi);
        [["triangle", 1, 1], ["sine", 2, 0.25]].forEach(([w, mul, lvl]) => {
          const os = ctx.createOscillator(), og = ctx.createGain();
          os.type = w; os.frequency.value = hz * mul; og.gain.value = lvl;
          os.connect(og); og.connect(g);
          os.start(at); os.stop(at + len + 0.08);
          voices.push(os);
          os.onended = () => { const k = voices.indexOf(os); if (k >= 0) voices.splice(k, 1); };
        });
      };
      const now = () => (on ? startPos + (ctx.currentTime - startCtx) : pos);
      const schedule = () => {                            // a second ahead, every 100 ms
        if (!on) return;
        const p = now(), until = p + 1.2;
        while (next < sound.length && secAt(T, sound[next].t0) < until) {
          const n = sound[next++], s0 = secAt(T, n.t0), s1 = secAt(T, n.t1);
          if (s1 <= p) continue;                          // already over
          strike(n, startCtx + (Math.max(s0, p) - startPos), Math.max(s0, p));
        }
        if (p >= scoreEnd + 0.1) { pause(); pos = scoreEnd; frame(); }
      };
      const hush = () => { voices.slice().forEach((os) => { try { os.stop(); } catch (e) { /* stopped */ } }); voices = []; };
      eng = {
        mode: "synth",
        pos: () => now(), dur: () => scoreEnd,
        playing: () => on,
        play: () => {
          if (!ctx) { const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return Promise.reject(new Error("this browser has no Web Audio")); ctx = new AC(); }
          if (pos >= scoreEnd - 0.01) pos = 0;
          return Promise.resolve(ctx.resume && ctx.resume()).then(() => {
            startCtx = ctx.currentTime + 0.05; startPos = pos; on = true;
            next = 0;
            while (next < sound.length && secAt(T, sound[next].t1) <= pos) next++;
            // a note already sounding at pos is struck from pos
            schedule(); clearInterval(timer); timer = setInterval(schedule, 100);
          });
        },
        pause: () => { if (on) { pos = now(); on = false; } clearInterval(timer); hush(); },
        seek: (s) => { const was = on; if (was) { on = false; clearInterval(timer); hush(); } pos = Math.max(0, Math.min(s, scoreEnd)); if (was) eng.play(); },
        destroy: () => { on = false; clearInterval(timer); hush(); if (ctx && ctx.close) ctx.close().catch(() => {}); ctx = null; },
      };
    }
    function frame() { if (!dead) { const s = eng.pos(); onFrame(s, tickAt(T, s)); } }
    function loop() { frame(); raf = eng.playing() ? root.requestAnimationFrame(loop) : 0; }
    function startLoop() { if (!raf) raf = root.requestAnimationFrame(loop); }
    function stopLoop() { if (raf) root.cancelAnimationFrame(raf); raf = 0; }
    function play() { return Promise.resolve(eng.play()).then(() => { startLoop(); }); }
    function pause() { eng.pause(); stopLoop(); frame(); }
    function seek(s) { eng.seek(s); frame(); }
    const api = {
      mode: eng.mode, audio: eng.el || null,
      play, pause, seek,
      toggle: () => (eng.playing() ? (pause(), Promise.resolve()) : play()),
      back: () => seek(prevBar(T, eng.pos())),
      forward: () => seek(Math.min(nextBar(T, eng.pos()), eng.dur())),
      toStart: () => seek(0),
      toEnd: () => { pause(); seek(eng.dur()); },
      position: () => eng.pos(), duration: () => eng.dur(), playing: () => eng.playing(),
      setOffset: (v) => { const p = eng.pos(); offset = +v || 0; if (eng.mode === "song") frame(); return p; },
      destroy: () => { dead = true; stopLoop(); eng.destroy(); },
    };
    return api;
  }

  return { secPerTick, tickAt, secAt, barAt, activeAt, prevBar, nextBar, fmt, midiHz, create };
}));
