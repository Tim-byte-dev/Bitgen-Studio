/* audioviz.js — A RANDOM VISUALIZATION OF THE SONG IN THE PREVIEW AREA (2.106.0).
 *
 * Tim: "if user plays an audio file, show a random visualization of the song
 * in the preview area."
 *
 * Every <audio> the page plays — the Gallery's Audio tab, the Assets dock's ▶,
 * the Speech dock's test line, the lightbox — gets wired through one
 * AnalyserNode and a <canvas> that sits over #viewerwrap while the sound
 * plays. Each play picks a style at random from STYLES; pause/end fades it
 * out. Nothing about playback changes: the element still drives the audio,
 * the analyser only listens (source → analyser → destination).
 *
 * HOW ELEMENTS ARE CAUGHT. `play` does not bubble and `new Audio()` elements
 * are never in the DOM, so a document listener misses half the app. Instead
 * HTMLMediaElement.prototype.play is wrapped: any <audio> whose play() is
 * called is attached, unless it carries data-noviz (the timeline's own
 * audio tracks, which accompany the VIDEO in the same viewer and must not be
 * painted over). A MediaElementSourceNode can be created ONCE per element,
 * so the node is cached per element in a WeakMap.
 *
 * Kept out of index.html as its own file (like dockscroll.js) so the styles
 * can be tuned without a 10k-line edit, and so the jsdom tests can load it
 * in isolation. No dependencies.
 */
(function () {
  "use strict";
  const W = window;
  const NS = { ctx: null, analyser: null, canvas: null, raf: 0, current: null, style: null, srcs: new WeakMap(),
               lastStyle: -1, fadeT: 0, onframe: null };

  /* ---------- styles: (ctx2d, w, h, freq Uint8Array, wave Uint8Array, t seconds, meta) ---------- */
  const STYLES = [
    { id: "bars", name: "Spectrum bars", draw(g, w, h, f, _wv, t) {
        const n = 64, bw = w / n;
        for (let i = 0; i < n; i++) {
          const v = f[Math.floor(i * f.length / n / 2)] / 255;
          const bh = v * h * 0.85;
          g.fillStyle = `hsl(${(i * 4 + t * 40) % 360} 85% ${45 + v * 30}%)`;
          g.fillRect(i * bw + 1, h - bh, bw - 2, bh);
          g.fillStyle = "rgba(255,255,255,.25)";
          g.fillRect(i * bw + 1, h - bh - 3, bw - 2, 2);
        }
      } },
    { id: "wave", name: "Mirrored wave", draw(g, w, h, _f, wv, t) {
        g.lineWidth = 2;
        for (const [sign, hue] of [[1, 28], [-1, 200]]) {
          g.beginPath();
          g.strokeStyle = `hsl(${(hue + t * 20) % 360} 90% 60%)`;
          for (let i = 0; i < wv.length; i++) {
            const x = i / (wv.length - 1) * w, y = h / 2 + sign * (wv[i] - 128) / 128 * h * 0.45;
            i ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          g.stroke();
        }
        g.strokeStyle = "rgba(255,255,255,.15)"; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      } },
    { id: "radial", name: "Radial rings", draw(g, w, h, f, _wv, t) {
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.18, n = 96;
        let bass = 0; for (let i = 0; i < 8; i++) bass += f[i]; bass /= 8 * 255;
        g.lineWidth = 3;
        for (let i = 0; i < n; i++) {
          const v = f[Math.floor(i * f.length / n / 2)] / 255;
          const a = i / n * Math.PI * 2 + t * 0.3;
          const r0 = R * (1 + bass * 0.35), r1 = r0 + v * Math.min(w, h) * 0.3;
          g.strokeStyle = `hsl(${(i * 360 / n + t * 30) % 360} 90% ${50 + v * 25}%)`;
          g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
        }
        g.beginPath(); g.arc(cx, cy, R * (1 + bass * 0.35), 0, Math.PI * 2);
        g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 2; g.stroke();
      } },
    { id: "particles", name: "Particle field", init(s) { s.p = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, hue: Math.random() * 360 })); },
      draw(g, w, h, f, _wv, t, s) {
        let bass = 0; for (let i = 0; i < 10; i++) bass += f[i]; bass /= 10 * 255;
        let treb = 0; for (let i = 60; i < 120; i++) treb += f[i]; treb /= 60 * 255;
        for (const p of s.p) {
          p.vx += (Math.random() - 0.5) * 0.0006 + Math.sin(t + p.y * 6) * 0.0002 * treb;
          p.vy += (Math.random() - 0.5) * 0.0006 - bass * 0.0015;
          p.vx *= 0.97; p.vy *= 0.97; p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x += 1; if (p.x > 1) p.x -= 1; if (p.y < 0) p.y += 1; if (p.y > 1) p.y -= 1;
          const r = 1.5 + bass * 6;
          g.fillStyle = `hsla(${(p.hue + t * 10) % 360} 90% 65% / ${0.4 + treb * 0.6})`;
          g.beginPath(); g.arc(p.x * w, p.y * h, r, 0, Math.PI * 2); g.fill();
        }
      } },
    { id: "spectro", name: "Scrolling spectrogram", init(s) { s.col = 0; },
      draw(g, w, h, f, _wv, _t, s, cv) {
        // shift the existing image left by 2px, paint the newest column at the right edge
        if (s.snap) { g.drawImage(cv, -2, 0); }
        const x = w - 2, n = 128;
        for (let i = 0; i < n; i++) {
          const v = f[Math.floor(i * f.length / n / 2)] / 255;
          g.fillStyle = `hsl(${260 - v * 260} 90% ${8 + v * 60}%)`;
          g.fillRect(x, h - (i + 1) * h / n, 2, h / n + 1);
        }
        s.snap = true;
      }, keep: true },
    { id: "lissajous", name: "Lissajous strings", draw(g, w, h, f, wv, t) {
        const cx = w / 2, cy = h / 2, A = Math.min(w, h) * 0.4;
        let mid = 0; for (let i = 20; i < 60; i++) mid += f[i]; mid /= 40 * 255;
        g.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.strokeStyle = `hsla(${(k * 120 + t * 25) % 360} 90% 60% / .8)`;
          for (let i = 0; i < wv.length; i++) {
            const ph = i / wv.length * Math.PI * 2 * (2 + k), amp = (wv[i] - 128) / 128;
            const x = cx + Math.cos(ph * (1 + mid) + t) * A * (0.5 + amp * 0.5);
            const y = cy + Math.sin(ph * (2 + mid * 0.5) + t * 0.7) * A * 0.6 * (0.5 + amp * 0.5);
            i ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          g.stroke();
        }
      } },
  ];

  function ensureCanvas() {
    if (NS.canvas) return NS.canvas;
    const wrap = document.getElementById("viewerwrap");
    if (!wrap) return null;
    const cv = document.createElement("canvas");
    cv.id = "vizcanvas";
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:none;background:#0c0a08;"
      + "opacity:0;transition:opacity .35s;z-index:5;pointer-events:none";
    wrap.appendChild(cv);
    NS.canvas = cv;
    return cv;
  }

  function ensureAudio() {
    if (NS.ctx) return true;
    const AC = W.AudioContext || W.webkitAudioContext;
    if (!AC) return false;
    NS.ctx = new AC();
    NS.analyser = NS.ctx.createAnalyser();
    NS.analyser.fftSize = 1024;
    NS.analyser.smoothingTimeConstant = 0.82;
    NS.analyser.connect(NS.ctx.destination);
    return true;
  }

  function pickStyle() {
    let i = Math.floor(Math.random() * STYLES.length);
    if (STYLES.length > 1 && i === NS.lastStyle) i = (i + 1) % STYLES.length;
    NS.lastStyle = i;
    const st = { def: STYLES[i] };
    if (STYLES[i].init) STYLES[i].init(st);
    return st;
  }

  function loop() {
    const cv = NS.canvas, el = NS.current;
    if (!cv || !el) return;
    const g = cv.getContext("2d");
    const w = cv.clientWidth || 640, h = cv.clientHeight || 360;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; NS.style.snap = false; }
    const f = new Uint8Array(NS.analyser.frequencyBinCount), wv = new Uint8Array(NS.analyser.fftSize);
    NS.analyser.getByteFrequencyData(f); NS.analyser.getByteTimeDomainData(wv);
    const t = performance.now() / 1000;
    if (!NS.style.def.keep) { g.fillStyle = "rgba(12,10,8,.28)"; g.fillRect(0, 0, w, h); }
    NS.style.def.draw(g, w, h, f, wv, t, NS.style, cv);
    // the song's name + the style's, small, bottom-left
    g.font = "12px system-ui, sans-serif"; g.textBaseline = "bottom";
    const label = `${NS.current.dataset.vizName || decodeURIComponent((el.currentSrc || el.src || "").split("/").pop().split("?")[0])} · ${NS.style.def.name}`;
    g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(6, h - 22, g.measureText(label).width + 12, 18);
    g.fillStyle = "#fff"; g.fillText(label, 12, h - 7);
    if (NS.onframe) NS.onframe(f, wv);
    NS.raf = W.requestAnimationFrame(loop);
  }

  /** 2.253.0: the wrap fills the dock WHATEVER core is underneath. Already
   *  tall (the flex chain working) = hands off; short = min-height set to
   *  the pane's measured spare room (a 200px floor when even the pane has
   *  no height, e.g. jsdom). Idempotent — called on every resize. */
  function sizeGuard() {
    const cv = NS.canvas; if (!cv || cv.style.display === "none") { /* also primed pre-show */ }
    const wrap = cv && cv.parentElement; if (!wrap) return;
    const pane = wrap.parentElement;
    const paneH = (pane && pane.clientHeight) || 0;
    if (wrap.clientHeight >= 120 && wrap.clientHeight >= paneH - 80) {
      // the chain is doing its job — leave the layout alone
      if (wrap.dataset.vizMinh !== undefined && wrap.clientHeight > 120) return;
      return;
    }
    let spare = paneH;
    if (pane) for (const sib of pane.children) {
      if (sib !== wrap) spare -= sib.offsetHeight || 0;
    }
    spare -= 16;                                   // the pane's own padding room
    // 2.254.0: a pane with REAL height (e.g. the 100px strip while another
    // dock is maximized) gets exactly its spare room — the 200px floor is
    // only for heightless DOMs, where nothing can be measured at all.
    const h = paneH >= 60 ? Math.max(24, spare) : Math.max(200, spare);
    if (wrap.dataset.vizMinh === undefined) wrap.dataset.vizMinh = wrap.style.minHeight || "";
    wrap.style.minHeight = h + "px";
  }

  function show() {
    const cv = ensureCanvas(); if (!cv) return;
    /* 2.253.0 ("the visualizer got even smaller" — the 2.252 floor removal
       assumed the 2.251 flex CSS is always present; a core/ext version mix
       leaves the wrap with NO height at all): the visualiser now SIZES
       ITSELF and depends on nothing. sizeGuard() measures the wrap — if it
       already fills (the flex chain at work) it touches NOTHING; if it
       comes up short it computes the pane's real spare height (pane minus
       the control row) and sets that as the wrap's min-height, re-measured
       on EVERY dock resize while visible (so the handle drag tracks even
       in fallback mode). hide() restores whatever it set. */
    sizeGuard();
    if (W.ResizeObserver && !NS.ro) {
      NS.ro = new W.ResizeObserver(sizeGuard);
      const pane = cv.parentElement && cv.parentElement.parentElement;
      if (pane) NS.ro.observe(pane);
    }
    cv.style.display = "block";
    W.requestAnimationFrame(() => { cv.style.opacity = "1"; });
    W.cancelAnimationFrame(NS.raf);
    NS.raf = W.requestAnimationFrame(loop);
  }
  function hide() {
    const cv = NS.canvas; if (!cv) return;
    if (NS.ro) { NS.ro.disconnect(); NS.ro = null; }   // 2.253.0
    W.cancelAnimationFrame(NS.raf); NS.raf = 0;
    cv.style.opacity = "0";
    clearTimeout(NS.fadeT);
    NS.fadeT = setTimeout(() => {
      if (cv.style.opacity !== "0") return;
      cv.style.display = "none";
      // 2.253.0: put back whatever sizeGuard set (nothing, when the flex
      // chain was doing the work)
      const wrap = cv.parentElement;
      if (wrap && wrap.dataset.vizMinh !== undefined) {
        wrap.style.minHeight = wrap.dataset.vizMinh; delete wrap.dataset.vizMinh;
      }
    }, 400);
  }

  /** Wire one <audio>; safe to call on every play(). The visualization
   *  STARTS from the element's own "play" event (one start per play, one
   *  random style per play); attach() only wires. `opts.now` starts at once
   *  for an element that is already playing when attached by hand. */
  function attach(el, name, opts) {
    if (!el || el.tagName !== "AUDIO" || el.dataset.noviz === "1") return false;
    if (!ensureAudio()) return false;
    if (NS.ctx.state === "suspended") NS.ctx.resume().catch(() => {});
    if (!NS.srcs.has(el)) {
      try {
        const src = NS.ctx.createMediaElementSource(el);
        src.connect(NS.analyser);
        NS.srcs.set(el, src);
      } catch (e) {
        // cross-origin media or an element already owned by another context:
        // leave playback alone, no visualization
        return false;
      }
      el.addEventListener("pause", () => { if (NS.current === el) hide(); });
      el.addEventListener("ended", () => { if (NS.current === el) hide(); });
      el.addEventListener("play", () => start(el));
    }
    if (name) el.dataset.vizName = name;
    if (opts && opts.now && !el.paused) start(el);
    return true;
  }
  function start(el) {
    NS.current = el;
    NS.style = pickStyle();
    if (NS.canvas) { const g = NS.canvas.getContext("2d"); g.fillStyle = "#0c0a08"; g.fillRect(0, 0, NS.canvas.width, NS.canvas.height); }
    show();
  }

  /* 2.106.1: THE NATIVE CONTROLS. Clicking ▶ on an <audio controls> starts
     playback inside the browser without calling .play() from script, so the
     prototype wrapper below never saw the Gallery's songs. "play" does not
     bubble, but a CAPTURING listener on the document is delivered for every
     element in the DOM — attach there too (idempotent), then the element's
     own "play" listener starts the drawing. */
  if (W.document && W.document.addEventListener) {
    W.document.addEventListener("play", (e) => {
      const el = e.target;
      if (!el || el.tagName !== "AUDIO") return;
      try {
        const fresh = !NS.srcs.has(el);
        if (attach(el) && fresh) start(el);   // this play event predates the listener attach() just added
      } catch { /* never block playback */ }
    }, true);
  }

  /* every <audio>.play() in the page goes through here */
  if (W.HTMLMediaElement && !W.HTMLMediaElement.prototype.__vizWrapped) {
    const orig = W.HTMLMediaElement.prototype.play;
    W.HTMLMediaElement.prototype.play = function () {
      if (this.tagName === "AUDIO") { try { attach(this); } catch { /* never block playback */ } }
      return orig.apply(this, arguments);
    };
    W.HTMLMediaElement.prototype.__vizWrapped = true;
  }

  W.AudioViz = { attach, hide, styles: () => STYLES.map((s) => s.id), current: () => (NS.style ? NS.style.def.id : null),
                 _state: NS };
})();
