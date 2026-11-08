/* bitGen Studio — static/lbaudio.js (2.725.0): SOUND IN THE PREVIEW - A VISUALIZATION WHILE IT PLAYS, NEXT = THE NEXT SOUND,
 * window.H3LbAudio (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "when user starts to play an audio show a random visualization, next button will play the next audio in
 * the docker the file was clicked in our preview dialog where we show pictures when a picture is clicked not the preview
 * docker with the button in statusbar"
 *
 *   The preview (#lb, index.html's lightbox - opened by clicking a file in the Gallery, Assets or References): a song /
 *   sound now fills the stage with a canvas. ▶ (its player) starts a visualization picked at random - bars, mirror,
 *   waveform, a ring, stars, ripples - never the same look twice in a row; 🎲 picks another while it plays. It moves with
 *   the sound (Web Audio: the <audio> -> an AnalyserNode -> the speakers); paused it holds still, dimmed.
 *   ‹ › / Prev / Next / ← → on a sound go to the PREVIOUS / NEXT SOUND in the list it was clicked in (the docker's own
 *   order; pictures and videos between them are skipped, the end wraps to the start) and PLAY it. On a picture or a video
 *   they page as before. The filmstrip still opens anything.
 *   Not the Preview docker (the status bar's button) - only this dialog: the dialog's <audio> carries data-noviz, so
 *   ext/previewdock/audioviz.js (which paints every other sound in the Preview docker) leaves it to this file.
 * Pure (Node: scripts/test-lbaudio725.js): VIZ, CALM, pick, nextAudio.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const VIZ = ["bars", "mirror", "wave", "ring", "stars", "ripples"];
  const CALM = ["bars", "mirror", "wave"];              // prefers-reduced-motion: no fly-through, no pulsing rings
  /** a look at random from `list`, never `last` again (unless it is the only one); rnd() in [0, 1) */
  function pick(list, last, rnd) {
    const l = (list && list.length ? list : VIZ).filter((v) => v !== last);
    const from = l.length ? l : (list && list.length ? list : VIZ);
    const r = typeof rnd === "function" ? rnd() : Math.random();
    return from[Math.min(from.length - 1, Math.max(0, Math.floor(r * from.length)))];
  }
  /** the next (d = 1) / previous (d = -1) SOUND after items[i], wrapping; i itself when it is the only sound; -1 = none */
  function nextAudio(items, i, d) {
    const n = (items || []).length; if (!n) return -1;
    const step = d < 0 ? -1 : 1;
    for (let k = 1; k <= n; k++) {
      const j = ((i + step * k) % n + n) % n;
      if (items[j] && items[j].kind === "audio") return j;
    }
    return -1;
  }
  const api = { VIZ, CALM, pick, nextAudio };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  /* ================================ the page ================================ */
  const doc = root.document;
  const S = { ctx: null, srcs: new WeakMap(), an: null, freq: null, wave: null, raf: 0, viz: null, last: null, el: null,
    canvas: null, autoplay: false, stars: null, t0: 0, frames: 0 };
  const calm = () => { try { return root.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const accent = () => { try { return root.getComputedStyle(doc.documentElement).getPropertyValue("--tiger").trim() || "#f59e2c"; } catch (e) { return "#f59e2c"; } };

  function css() {
    if (doc.getElementById("lbaStyle")) return;
    const s = doc.createElement("style"); s.id = "lbaStyle";
    s.textContent = ".lbaud.lbviz{position:absolute;inset:0;justify-content:flex-end;padding-bottom:22px;gap:10px}"
      + ".lbaud.lbviz canvas.lbcv{position:absolute;inset:0;width:100%;height:100%;display:block;transition:opacity .25s}"
      + ".lbaud.lbviz.paused canvas.lbcv{opacity:.45}"
      + ".lbaud.lbviz>:not(canvas){position:relative;z-index:1}"
      + ".lbaud.lbviz .lbarow{display:flex;align-items:center;gap:8px;width:min(620px,86%)}.lbaud.lbviz .lbarow audio{flex:1;width:auto}"
      + ".lbaud.lbviz .lbanm{color:var(--fg,#e8e2d6);text-shadow:0 1px 3px #000;max-width:86%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".lbaud.lbviz.playing .big{display:none}";
    doc.head.appendChild(s);
  }

  /* ---- the sound -> analyser (one AudioContext; one source per <audio> - the browser allows only one) */
  function hook(a) {
    try {
      if (!S.ctx) { const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false; S.ctx = new AC(); }
      if (S.ctx.state === "suspended") S.ctx.resume().catch(() => {});
      if (!S.srcs.has(a)) {
        const src = S.ctx.createMediaElementSource(a), an = S.ctx.createAnalyser();
        an.fftSize = 2048; an.smoothingTimeConstant = 0.78;
        src.connect(an); an.connect(S.ctx.destination);
        S.srcs.set(a, an);
      }
      S.an = S.srcs.get(a);
      S.freq = new Uint8Array(S.an.frequencyBinCount); S.wave = new Uint8Array(S.an.fftSize);
      return true;
    } catch (e) { return false; }
  }

  /* ---- the looks: draw(g, w, h, freq, wave, t) - freq / wave 0..255 */
  const band = (f, a, b) => { let s = 0, n = 0; for (let i = a; i < b && i < f.length; i++) { s += f[i]; n++; } return n ? s / n / 255 : 0; };
  const hue = (base, t) => `hsl(${(base + t * 18) % 360} 90% 58%)`;
  function baseHue() {
    const c = accent(); const m = /^#?([0-9a-f]{6})$/i.exec(c); if (!m) return 33;
    const r = parseInt(m[1].slice(0, 2), 16) / 255, g = parseInt(m[1].slice(2, 4), 16) / 255, b = parseInt(m[1].slice(4), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 33;
    const d = mx - mn; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h;
  }
  const DRAW = {
    bars(g, w, h, f, wv, t, H) {
      const n = 64, bw = w / n;
      for (let i = 0; i < n; i++) {
        const v = band(f, Math.floor(Math.pow(i / n, 1.6) * f.length * 0.7), Math.floor(Math.pow((i + 1) / n, 1.6) * f.length * 0.7) + 1);
        const bh = Math.max(2, v * h * 0.82);
        g.fillStyle = `hsl(${(H + i * 2.2 + t * 12) % 360} 90% ${44 + v * 22}%)`;
        g.fillRect(i * bw + 1, h - bh, bw - 2, bh);
      }
    },
    mirror(g, w, h, f, wv, t, H) {
      const n = 48, bw = w / (n * 2), cy = h / 2;
      for (let i = 0; i < n; i++) {
        const v = band(f, Math.floor(Math.pow(i / n, 1.7) * f.length * 0.6), Math.floor(Math.pow((i + 1) / n, 1.7) * f.length * 0.6) + 1);
        const bh = Math.max(2, v * h * 0.44);
        g.fillStyle = `hsl(${(H + 180 - i * 3 + t * 10) % 360} 85% ${45 + v * 20}%)`;
        for (const x of [w / 2 + i * bw, w / 2 - (i + 1) * bw]) g.fillRect(x + 1, cy - bh, bw - 2, bh * 2);
      }
    },
    wave(g, w, h, f, wv, t, H) {
      const loud = band(f, 0, 64);
      for (let pass = 0; pass < 2; pass++) {
        g.beginPath();
        for (let i = 0; i < wv.length; i += 2) {
          const x = (i / (wv.length - 1)) * w, y = h / 2 + ((wv[i] - 128) / 128) * h * (0.38 + loud * 0.1);
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.strokeStyle = pass ? hue(H, t) : `hsl(${H} 90% 60% / .25)`;
        g.lineWidth = pass ? 2.2 : 10 + loud * 14; g.lineJoin = "round"; g.stroke();
      }
    },
    ring(g, w, h, f, wv, t, H) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * (0.2 + band(f, 0, 12) * 0.08), n = 120;
      for (let i = 0; i < n; i++) {
        const v = band(f, Math.floor((i / n) * f.length * 0.5), Math.floor(((i + 1) / n) * f.length * 0.5) + 1);
        const a = (i / n) * Math.PI * 2 + t * 0.15, L = 4 + v * Math.min(w, h) * 0.26;
        g.strokeStyle = `hsl(${(H + (i / n) * 300 + t * 20) % 360} 90% ${50 + v * 18}%)`; g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R + L), cy + Math.sin(a) * (R + L)); g.stroke();
      }
      g.beginPath(); g.arc(cx, cy, R - 6, 0, Math.PI * 2); g.strokeStyle = `hsl(${H} 90% 60% / .5)`; g.lineWidth = 2; g.stroke();
    },
    stars(g, w, h, f, wv, t, H) {
      if (!S.stars || S.stars.length !== 260) S.stars = Array.from({ length: 260 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
      const bass = band(f, 0, 10), sp = 0.004 + bass * 0.03, cx = w / 2, cy = h / 2;
      for (const s of S.stars) {
        s.z -= sp; if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; }
        const px = cx + (s.x / s.z) * cx, py = cy + (s.y / s.z) * cy, r = Math.max(0.6, (1 - s.z) * 3.2);
        if (px < 0 || py < 0 || px > w || py > h) { s.z = 0; continue; }
        g.fillStyle = `hsl(${(H + s.x * 60 + t * 15) % 360} 90% ${60 + (1 - s.z) * 30}%)`;
        g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
      }
    },
    ripples(g, w, h, f, wv, t, H) {
      const cx = w / 2, cy = h / 2, M = Math.hypot(w, h) / 2, k = 9;
      for (let i = 0; i < k; i++) {
        const v = band(f, Math.floor((i / k) * f.length * 0.4), Math.floor(((i + 1) / k) * f.length * 0.4) + 1);
        const r = ((i / k + t * 0.06) % 1) * M;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
        g.strokeStyle = `hsl(${(H + i * 28) % 360} 90% 60% / ${0.15 + v * 0.8})`; g.lineWidth = 2 + v * 16; g.stroke();
      }
    },
  };

  function size(cv) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), Hh = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    return { w: W, h: Hh };
  }
  function frame() {
    S.raf = 0;
    const cv = S.canvas; if (!cv || !cv.isConnected || !S.an) return;
    const g = cv.getContext("2d"), { w, h } = size(cv);
    S.an.getByteFrequencyData(S.freq); S.an.getByteTimeDomainData(S.wave);
    g.fillStyle = S.viz === "stars" ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.28)";   // a short trail
    g.fillRect(0, 0, w, h);
    try { DRAW[S.viz](g, w, h, S.freq, S.wave, (root.performance.now() - S.t0) / 1000, S.hue); } catch (e) { /* a look never breaks the player */ }
    S.frames++;
    if (S.el && !S.el.paused && !S.el.ended) S.raf = root.requestAnimationFrame(frame);
  }
  function start(a) {
    if (!hook(a)) return;
    if (!S.viz) setViz(pick(calm() ? CALM : VIZ, S.last));
    S.hue = baseHue();
    const box = a.closest(".lbaud"); if (box) { box.classList.add("playing"); box.classList.remove("paused"); }
    if (!S.raf) S.raf = root.requestAnimationFrame(frame);
  }
  function setViz(v) {
    S.viz = v; S.last = v; S.stars = null; S.t0 = root.performance.now();
    if (S.canvas) { S.canvas.dataset.viz = v; const g = S.canvas.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, S.canvas.width, S.canvas.height); }
  }
  function another() { if (S.el) { setViz(pick(calm() ? CALM : VIZ, S.viz)); if (!S.el.paused && !S.raf) S.raf = root.requestAnimationFrame(frame); } }

  /** index.html's lbShow, on a sound: the <audio> it made, inside .lbaud in the stage */
  function mount(a) {
    if (!a) return;
    css();
    const box = a.closest(".lbaud"); if (!box) return;
    if (S.raf) { root.cancelAnimationFrame(S.raf); S.raf = 0; }
    // ext/previewdock/audioviz.js wires EVERY <audio> the page plays into the Preview docker (the status bar's) - not this
    // one: its picture belongs in this dialog, and an element can feed only one MediaElementSource
    a.dataset.noviz = "1";
    S.el = a; S.viz = null; S.frames = 0;
    box.classList.add("lbviz", "paused");
    const cv = doc.createElement("canvas"); cv.className = "lbcv"; cv.setAttribute("aria-hidden", "true");
    box.prepend(cv); S.canvas = cv;
    const nm = box.querySelector(":scope > span:not(.big)"); if (nm) nm.classList.add("lbanm");
    const row = doc.createElement("div"); row.className = "lbarow";
    const dice = doc.createElement("button"); dice.type = "button"; dice.className = "ghost"; dice.id = "lb_viz";
    dice.textContent = "🎲"; dice.title = "Another visualization";
    dice.onclick = (e) => { e.stopPropagation(); another(); };
    box.insertBefore(row, a); row.appendChild(a); row.appendChild(dice);
    a.addEventListener("play", () => start(a));
    a.addEventListener("pause", () => { const b = a.closest(".lbaud"); if (b) { b.classList.add("paused"); b.classList.remove("playing"); } });
    if (S.autoplay) {
      S.autoplay = false;
      if (S.startAt > 0) { const at = S.startAt; a.addEventListener("loadedmetadata", () => { try { a.currentTime = at; } catch (e) { /* fine */ } }, { once: true }); }
      S.startAt = 0;
      const p = a.play(); if (p && p.catch) p.catch(() => {});
    }
  }
  function lbState() { try { return lb; } catch (e) { return null; } }       // index.html's `const lb` (the global lexical scope)
  /** index.html's lbGo: on a sound, ‹ › go to the previous / next SOUND and play it; true = handled */
  function go(d) {
    const L = lbState();
    if (!L || !L.items || !L.items[L.i] || L.items[L.i].kind !== "audio") return false;
    const j = nextAudio(L.items, L.i, d); if (j < 0) return false;
    L.i = j; S.autoplay = true;
    try { lbShow(); } catch (e) { return false; }                          // index.html's lightbox
    return true;
  }
  /* 2.725.1 (Tim: "it's not working, i clicked play on a song in the gallery and nothing"): the Gallery's songs have a
   * player of their own on the tile, so ▶ there played the song in the list and the preview never opened. Now a sound
   * that starts playing in a tile the preview can open ([data-lb-url], kind audio - the Gallery's Audio tab) stops there
   * and goes on in the preview, from the same second, with its visualization; Next / Prev then walk that tab's songs. */
  function fromTile(e) {
    const a = e.target;
    if (!a || a.tagName !== "AUDIO" || a.closest("#lb")) return;
    const tile = a.closest('[data-lb-url][data-lb-kind="audio"]'); if (!tile) return;
    let items = null; try { items = lbItemsFrom(tile); } catch (err) { return; }      // index.html's lightbox
    const i = items.findIndex((x) => x.url === tile.dataset.lbUrl); if (i < 0) return;
    const at = a.currentTime || 0;
    try { a.pause(); } catch (err) { /* fine */ }
    S.autoplay = true; S.startAt = at > 0.3 ? at : 0;
    try { lbOpen(items, i); } catch (err) { S.autoplay = false; }
  }
  doc.addEventListener("play", fromTile, true);
  function state() { return { viz: S.viz, last: S.last, frames: S.frames, playing: !!(S.el && !S.el.paused), hooked: !!S.an, ctx: S.ctx ? S.ctx.state : null }; }

  root.H3LbAudio = Object.assign({ mount, go, another, state, DRAW }, api);
})(typeof window !== "undefined" ? window : globalThis);
