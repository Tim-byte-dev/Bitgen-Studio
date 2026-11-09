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
 * Pure (Node-tested): secPerTick, tickAt, secAt, barAt, activeAt, wordsAt (2.735.0), prevBar, nextBar, fmt, midiHz.
 * The browser: create({timing, audioUrl, offset, onFrame}) -> {play, pause, toggle, seek, back, forward, toStart, toEnd,
 * position, duration, playing, mode, setOffset, destroy}. onFrame(sec, tick) runs every frame while it plays and after
 * every seek - the tab paints the notes from it.
 * 2.737.0 (Tim: "have toggle buttons to play each instrument and vocals"): the synth asks o.isMuted(v) before it strikes a
 * staff's note and api.remix() cuts what is ringing and goes on with the new mix; o.tracks = [{key, url}] plays the song as
 * its stems (vocals + instrumental, in step - the first leads, the rest follow it) and api.setTrack(key, on) mutes one. */
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
  /** 2.735.0: the sung syllables at `tick` -> their ids (a word stays lit through the notes it holds) */
  function wordsAt(T, tick) {
    const out = [];
    if (tick < 0) return out;
    for (const w of T.words || []) { if (w.t0 > tick) break; if (tick < w.t1) out.push(w.id); }
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
    const tracks = Array.isArray(o.tracks) && o.tracks.length ? o.tracks : (o.audioUrl ? [{ key: "song", url: o.audioUrl }] : []);
    if (tracks.length) {
      const els = tracks.map((t) => { const x = new root.Audio(); x.preload = "auto"; x.src = t.url; x.muted = t.on === false; return { key: t.key, el: x }; });
      const a = els[0].el, rest = els.slice(1).map((t) => t.el);
      const follow = (hard) => rest.forEach((x) => {                 // the stems stay on the lead's clock
        if (!Number.isFinite(x.duration) && !hard) return;
        if (hard || Math.abs(x.currentTime - a.currentTime) > 0.06) { try { x.currentTime = a.currentTime; } catch (e) { /* not loaded yet */ } }
        if (!a.paused && x.paused && !a.ended) { const p = x.play(); if (p && p.catch) p.catch(() => {}); }
      });
      a.addEventListener("ended", () => { rest.forEach((x) => x.pause()); stopLoop(); frame(); });
      a.addEventListener("loadedmetadata", () => frame());
      eng = {
        mode: "song", el: a, els,
        pos: () => a.currentTime - offset,
        dur: () => (Number.isFinite(a.duration) && a.duration > 0 ? a.duration - offset : scoreEnd),
        playing: () => !a.paused && !a.ended,
        play: () => {
          const all = [a].concat(rest).map((x) => { const p = x.play(); return p && p.catch ? p : Promise.resolve(); });
          follow(true);
          return Promise.all(all).catch((e) => { if (o.onError) o.onError(e); });
        },
        pause: () => { a.pause(); rest.forEach((x) => x.pause()); },
        seek: (s) => { a.currentTime = Math.max(0, Math.min(s + offset, Number.isFinite(a.duration) ? a.duration : s + offset)); follow(true); },
        tick: () => follow(false),
        setTrack: (key, on) => { const t = els.find((x) => x.key === key); if (t) t.el.muted = !on; return !!t; },
        destroy: () => { [a].concat(rest).forEach((x) => { x.pause(); x.removeAttribute("src"); try { x.load(); } catch (e) { /* gone */ } }); },
      };
    } else {
      let ctx = null, startCtx = 0, startPos = 0, pos = 0, on = false, timer = 0, next = 0, voices = [];
      const struck = {};                                  // 2.737.0: notes struck per staff (what the mix let through)
      const sound = T.sound || [];
      const gainFor = (v) => (v === 0 ? 0.16 : 0.09);
      const strike = (n, at, from) => {
        const len = Math.max(0.05, secAt(T, n.t1) - Math.max(from, secAt(T, n.t0)));
        struck[n.v] = (struck[n.v] || 0) + 1;
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
          if (o.isMuted && o.isMuted(n.v)) continue;      // 2.737.0: that staff is off
          strike(n, startCtx + (Math.max(s0, p) - startPos), Math.max(s0, p));
        }
        if (p >= scoreEnd + 0.1) { pause(); pos = scoreEnd; frame(); }
      };
      const hush = () => { voices.slice().forEach((os) => { try { os.stop(); } catch (e) { /* stopped */ } }); voices = []; };
      eng = {
        mode: "synth", struck,
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
    function frame() { if (!dead) { if (eng.tick) eng.tick(); const s = eng.pos(); onFrame(s, tickAt(T, s)); } }
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
      // 2.737.0: the mix changed - the synth cuts what rings and strikes on without the muted staves; the song mutes a stem
      remix: () => { if (eng.mode === "synth" && eng.playing()) eng.seek(eng.pos()); },
      setTrack: (key, on) => (eng.setTrack ? eng.setTrack(key, on) : false),
      tracks: () => (eng.els ? eng.els.map((t) => ({ key: t.key, on: !t.el.muted, t: t.el.currentTime, paused: t.el.paused })) : []),
      struck: () => Object.assign({}, eng.struck || {}),
      destroy: () => { dead = true; stopLoop(); eng.destroy(); },
    };
    return api;
  }

  return { secPerTick, tickAt, secAt, barAt, activeAt, wordsAt, prevBar, nextBar, fmt, midiHz, create };
}));
