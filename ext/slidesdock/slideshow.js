/* ext/slidesdock/slideshow.js — 🎞 SLIDES: PRESENTING - window.H3SlideShow.
 *
 *   start(i)      (2.831.0) the deck over the whole window (and full screen when the browser allows), from slide i; hidden
 *                 slides are skipped. Next: → ↓ Space Enter Page Down N, a click; back: ← ↑ Backspace Page Up P; Home / End;
 *                 a number + Enter = that slide; B / W = a black / white screen; Esc = the end. Each slide comes in with its
 *                 transition (fade / push / wipe / zoom, 450 ms). The pointer shows ◀ ▶ ✕ when moved.
 *   presenter(i)  (2.832.0, Tim: "yes please go ahead wth part 2") the PRESENTER VIEW: this screen shows the slide, the next one,
 *                 the speaker notes (A− / A+), a timer (⏸ / ↺), the clock and the buttons; the AUDIENCE window
 *                 (static/slideaudience.html - a second window, electron/main.js lets it open in the app) shows the slide only:
 *                 move it to the projector and double-click it for full screen. The same keys work in both windows.
 *   order(deck)   the slides shown (not hidden), pure.
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const S = () => root.H3Slides;
  const order = (deck) => deck.slides.map((s, i) => (s.hidden ? -1 : i)).filter((i) => i >= 0);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let show = null;
  const ANIM = (tr, dir) => ({ fade: "slFadeIn", zoom: "slZoomIn", wipe: "slWipeIn", push: dir < 0 ? "slPushInB" : "slPushIn" }[tr] || "slFadeIn") + " .45s ease";

  /** put a slide into a host (scaled by k), with its transition */
  function place(host, el, k, tr, dir) {
    const wrap = host.ownerDocument.createElement("div");
    el.style.transform = `scale(${k})`; el.style.transformOrigin = "0 0"; el.style.position = "absolute"; el.style.left = "0"; el.style.top = "0";
    wrap.className = "wrap"; wrap.style.cssText = "position:absolute;inset:0;overflow:hidden"; wrap.appendChild(el);
    const old = [...host.children];
    if (tr && tr !== "none") wrap.style.animation = ANIM(tr, dir);
    host.appendChild(wrap);
    setTimeout(() => old.forEach((o) => o.remove()), tr && tr !== "none" ? 460 : 0);
  }
  /** fit a host to the slide's shape inside W x H; its slides scaled with it */
  function fitBox(host, W, H) {
    const d = S().deck(), k = Math.max(0.01, Math.min(W / d.w, H / d.h));
    host.style.width = d.w * k + "px"; host.style.height = d.h * k + "px"; host.style.setProperty("--sl-w", d.w * k + "px");
    for (const w of host.children) if (w.firstChild && w.firstChild.style) w.firstChild.style.transform = `scale(${k})`;
    return k;
  }
  function size() {
    if (!show) return;
    if (show.mode === "show") show.k = fitBox(show.host, root.innerWidth, root.innerHeight);
    else { const c = show.box.querySelector(".pvcur"), n = show.box.querySelector(".pvnext"); show.k = fitBox(show.host, c.clientWidth, c.clientHeight); show.kn = fitBox(show.next, n.clientWidth, n.clientHeight); }
    fitAudience();
  }
  function fitAudience() {
    const a = show && show.aud; if (!a || a.closed) return;
    try { const h = a.document.getElementById("host"); if (!h) return; show.ka = fitBox(h, a.innerWidth, a.innerHeight); h.style.left = Math.round((a.innerWidth - parseFloat(h.style.width)) / 2) + "px"; h.style.top = Math.round((a.innerHeight - parseFloat(h.style.height)) / 2) + "px"; } catch (e) { /* closed */ }
  }
  function draw(dir) {
    const d = S().deck(), i = show.list[show.at], s = d.slides[i], tr = dir === 0 ? "none" : s.transition || "none";
    place(show.host, S().renderSlide(s, d, "show"), show.k || 1, tr, dir);
    if (show.mode === "presenter") {
      const ni = show.list[show.at + 1];
      show.next.innerHTML = "";
      if (ni != null) place(show.next, S().renderSlide(d.slides[ni], d, "show"), show.kn || 1, "none", 0);
      else show.next.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888;font:14px sans-serif;background:#111">the end</div>`;
      show.box.querySelector(".pvnotes").innerHTML = s.notes ? esc(s.notes).replace(/\n/g, "<br>") : `<span style="color:#777">no speaker notes for this slide</span>`;
      { const n = show.at + 1, of = show.list.length; show.box.querySelector(".pvcnt").textContent = `Slide ${n} of ${of}`; }
    }
    const a = show.aud;
    if (a && !a.closed) {
      try { const h = a.document.getElementById("host"); if (h) { h.style.visibility = ""; a.document.body.style.background = "#000"; place(h, a.document.importNode(S().renderSlide(s, d, "show"), true), show.ka || 1, tr, dir); } } catch (e) { /* the window is going */ }
    }
    if (show.cnt) show.cnt.textContent = `${show.at + 1} / ${show.list.length}`;
    if (show.mode === "show") show.box.style.background = "#000";
    show.blank = null; show.host.style.visibility = ""; show.endShown = false;
    if (root.H3Slides) root.H3Slides.St.cur = i;
  }
  function blankOn(white) {
    show.blank = true; show.host.style.visibility = "hidden"; if (show.mode === "show") show.box.style.background = white ? "#fff" : "#000";
    const a = show.aud; if (a && !a.closed) try { a.document.getElementById("host").style.visibility = "hidden"; a.document.body.style.background = white ? "#fff" : "#000"; } catch (e) { /* fine */ }
  }
  function blankOff() { show.blank = null; draw(0); }
  function go(at, dir) {
    if (!show) return;
    if (at >= show.list.length) {
      if (show.mode === "presenter") return;
      if (show.endShown) return stop();
      show.endShown = true; show.host.innerHTML = ""; const e = doc.createElement("div"); e.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#aaa;font:20px sans-serif"; e.textContent = "The end of the presentation - click or press a key to leave"; show.host.appendChild(e); if (show.cnt) show.cnt.textContent = ""; return;
    }
    show.at = Math.max(0, at); draw(dir == null ? 1 : dir);
  }
  function key(e) {
    if (!show) return;
    const k = e.key; if (k === "F11" || k === "F12") return;
    if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation();
    if (show.blank && k !== "Escape") return blankOff();
    if (/^[0-9]$/.test(k)) { show.num = (show.num || "") + k; return; }
    if (k === "Enter" && show.num) { const n = +show.num - 1; show.num = ""; return go(Math.min(show.list.length - 1, Math.max(0, n)), 0); }
    show.num = "";
    if (["ArrowRight", "ArrowDown", " ", "Enter", "PageDown", "n", "N"].includes(k)) return go(show.at + 1, 1);
    if (["ArrowLeft", "ArrowUp", "Backspace", "PageUp", "p", "P"].includes(k)) { if (show.endShown) { show.endShown = false; return go(show.at, 0); } return go(show.at - 1, -1); }
    if (k === "Home") return go(0, 0);
    if (k === "End") return go(show.list.length - 1, 0);
    if (["b", "B", ".", "w", "W", ","].includes(k)) return blankOn(/[wW,]/.test(k));
    if (k === "Escape") return stop();
  }
  function begin(from) {
    const ed = S(); if (!ed || !ed.deck()) return null;
    if (ed.St.edit) ed.endEdit();
    if (show) stop();
    const d = ed.deck(), list = order(d);
    if (!list.length) { ed.msg("every slide is hidden - nothing to show", true); return null; }
    let at = list.indexOf(from || 0); if (at < 0) at = Math.max(0, list.findIndex((i) => i > (from || 0)));
    return { list, at };
  }
  function wireBox(box) {
    box.tabIndex = 0; box.setAttribute("data-own-space", "1");             // Space = next (static/spaceplay.js leaves it)
    box.addEventListener("keydown", key, true);
    root.addEventListener("resize", size);
  }
  function start(from) {
    const st = begin(from); if (!st) return false;
    const box = doc.createElement("div"); box.id = "slShow";
    box.innerHTML = `<div class="host"></div><div class="cnt"></div><div class="bar"><button type="button" data-a="prev" title="Back">◀</button><button type="button" data-a="next" title="Next">▶</button><button type="button" data-a="end" title="End the show (Esc)">✕</button></div>`;
    doc.body.appendChild(box);
    show = Object.assign(st, { mode: "show", box, host: box.querySelector(".host"), cnt: box.querySelector(".cnt") });
    let hideT = 0;
    box.addEventListener("pointermove", () => { box.classList.add("ptr"); clearTimeout(hideT); hideT = setTimeout(() => box.classList.remove("ptr"), 1800); });
    box.addEventListener("click", (e) => { const a = e.target.closest("[data-a]"); if (a) { e.stopPropagation(); return ({ prev: () => go(show.at - 1, -1), next: () => go(show.at + 1, 1), end: stop })[a.dataset.a](); } if (show.blank) return blankOff(); go(show.at + 1, 1); });
    box.addEventListener("contextmenu", (e) => { e.preventDefault(); go(show.at - 1, -1); });
    wireBox(box);
    show.onFs = () => { if (show && show.fs && !doc.fullscreenElement) stop(); };
    doc.addEventListener("fullscreenchange", show.onFs);
    try { const p = box.requestFullscreen && box.requestFullscreen(); if (p && p.then) p.then(() => { if (show) show.fs = true; }).catch(() => { /* a window is enough */ }); } catch (e) { /* fine */ }
    size(); box.focus(); draw(0);
    return true;
  }
  /* ---------------------------------------------------------------- the presenter view */
  function clockText(ms) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
  function presenter(from) {
    const st = begin(from); if (!st) return false;
    const box = doc.createElement("div"); box.id = "slPresenter";
    box.innerHTML = `<div class="pvtop"><span class="pvtimer" title="Time since the start">0:00:00</span><button type="button" data-a="pause" title="Pause / go on with the timer">⏸</button><button type="button" data-a="reset" title="The timer from 0">↺</button><span class="pvclock" title="The time now"></span><span class="pvcnt"></span><span style="flex:1"></span>`
      + `<button type="button" data-a="prev" title="Back (←)">◀</button><button type="button" data-a="next" title="Next (→ / Space)">▶</button><button type="button" data-a="black" title="A black screen for the audience (B)">⬛</button><button type="button" data-a="aud" title="Open the audience window again">🖥 Audience</button><button type="button" data-a="end" title="End the presentation (Esc)">✕ End</button></div>`
      + `<div class="pvmain"><div class="pvcur"><div class="host"></div></div><div class="pvside"><div class="pvlbl">Next</div><div class="pvnext"></div><div class="pvlbl">Speaker notes <button type="button" data-a="fs-" title="Smaller notes">A−</button><button type="button" data-a="fs+" title="Bigger notes">A+</button></div><div class="pvnotes"></div></div></div>`;
    doc.body.appendChild(box);
    show = Object.assign(st, { mode: "presenter", box, host: box.querySelector(".pvcur .host"), next: box.querySelector(".pvnext"), t0: Date.now(), paused: 0, pausedAt: 0 });
    let fs = 18; try { fs = +root.localStorage.getItem("h3.slides.notesize") || 18; } catch (e) { /* fine */ }
    const notes = box.querySelector(".pvnotes"); notes.style.fontSize = fs + "px";
    const keepFs = () => { notes.style.fontSize = fs + "px"; try { root.localStorage.setItem("h3.slides.notesize", fs); } catch (er) { /* fine */ } };
    box.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]"); if (!a) { if (e.target.closest(".pvcur")) go(show.at + 1, 1); return; }
      e.stopPropagation();
      ({ prev: () => go(show.at - 1, -1), next: () => go(show.at + 1, 1), end: stop, aud: openAudience,
        black: () => (show.blank ? blankOff() : blankOn(false)),
        pause: () => { if (show.pausedAt) { show.paused += Date.now() - show.pausedAt; show.pausedAt = 0; a.textContent = "⏸"; } else { show.pausedAt = Date.now(); a.textContent = "▶"; } },
        reset: () => { show.t0 = Date.now(); show.paused = 0; if (show.pausedAt) show.pausedAt = Date.now(); },
        "fs-": () => { fs = Math.max(10, fs - 2); keepFs(); }, "fs+": () => { fs = Math.min(60, fs + 2); keepFs(); } })[a.dataset.a]();
    });
    wireBox(box);
    const tick = () => {
      if (!show || show.mode !== "presenter") return;
      box.querySelector(".pvtimer").textContent = clockText((show.pausedAt || Date.now()) - show.t0 - show.paused);
      box.querySelector(".pvclock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };
    show.timer = setInterval(tick, 500); tick();
    openAudience();
    size(); box.focus(); draw(0);
    return true;
  }
  function openAudience() {
    if (!show) return;
    let a = null;
    try { a = root.open("/static/slideaudience.html", "bitgenSlidesAudience", "popup,width=1280,height=760"); } catch (e) { a = null; }
    if (!a) { S().msg("the audience window did not open (a popup blocker?) - 🖥 Audience tries again", true); return; }
    show.aud = a;
    const ready = () => { try { return a.document && a.document.readyState === "complete" && a.H3AudReady && a.document.getElementById("host"); } catch (e) { return false; } };
    let n = 0;
    const wait = setInterval(() => { if (!show || show.aud !== a) return clearInterval(wait); if (ready()) { clearInterval(wait); fitAudience(); draw(0); } else if (++n > 100) clearInterval(wait); }, 100);
  }
  function stop() {
    if (!show) return;
    const s = show; show = null;
    root.removeEventListener("resize", size); clearInterval(s.timer);
    if (s.onFs) doc.removeEventListener("fullscreenchange", s.onFs);
    if (doc.fullscreenElement) { try { doc.exitFullscreen(); } catch (e) { /* fine */ } }
    if (s.aud && !s.aud.closed) { try { s.aud.close(); } catch (e) { /* fine */ } }
    s.box.remove();
    const ed = S(); if (ed) { ed.St.sel.clear(); ed.paint(); const w = doc.getElementById("slStageWrap"); if (w) w.focus({ preventScroll: true }); }
  }
  root.H3SlideShow = { start, presenter, stop, order, key, fitAudience, next: () => go(show ? show.at + 1 : 0, 1), prev: () => go(show ? show.at - 1 : 0, -1), go: (i) => go(i, 0),
    get on() { return !!show; }, get mode() { return show ? show.mode : ""; }, get at() { return show ? show.list[show.at] : -1; }, get audience() { return show ? show.aud : null; } };
})(window);
