/* ext/slidesdock/slideshow.js — 🎞 SLIDES (2.831.0): PRESENTING - window.H3SlideShow.
 *
 *   start(i)  the deck over the whole window (and full screen when the browser allows), from slide i; hidden slides are
 *             skipped. Next: → ↓ Space Enter Page Down N, a click; back: ← ↑ Backspace Page Up P; Home / End; a number +
 *             Enter = that slide; B / W = a black / white screen; Esc = the end (back to the slide shown in the editor).
 *             Each slide comes in with its transition (fade / push / wipe / zoom, 450 ms). The pointer shows ◀ ▶ ✕ when moved.
 *   order(deck) the slides shown (not hidden), pure.
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const K = () => root.SlideCore, S = () => root.H3Slides;
  const order = (deck) => deck.slides.map((s, i) => (s.hidden ? -1 : i)).filter((i) => i >= 0);
  let show = null;
  function size() {
    if (!show) return;
    const d = S().deck(), k = Math.min(root.innerWidth / d.w, root.innerHeight / d.h);
    show.k = k; show.host.style.width = d.w * k + "px"; show.host.style.height = d.h * k + "px";
    show.host.style.setProperty("--sl-w", d.w * k + "px");
    for (const w of show.host.children) if (w.firstChild && w.firstChild.style) w.firstChild.style.transform = `scale(${k})`;
  }
  /** the slide at show.at - in a wrapper the transition plays on (the slide inside it is scaled to the screen) */
  function draw(dir) {
    const d = S().deck(), i = show.list[show.at], s = d.slides[i];
    const el = S().renderSlide(s, d, "show"), wrap = doc.createElement("div");
    el.style.transform = `scale(${show.k || 1})`; el.style.transformOrigin = "0 0"; el.style.position = "absolute"; el.style.left = "0"; el.style.top = "0";
    wrap.style.cssText = "position:absolute;inset:0;overflow:hidden"; wrap.appendChild(el);
    const old = [...show.host.children], tr = dir === 0 ? "none" : s.transition || "none";
    if (tr !== "none") wrap.style.animation = ({ fade: "slFadeIn", zoom: "slZoomIn", wipe: "slWipeIn", push: dir < 0 ? "slPushInB" : "slPushIn" }[tr] || "slFadeIn") + " .45s ease";
    show.host.appendChild(wrap);
    setTimeout(() => old.forEach((o) => o.remove()), tr === "none" ? 0 : 460);
    show.cnt.textContent = `${show.at + 1} / ${show.list.length}`;
    show.box.style.background = "#000"; show.blank = null; show.host.style.visibility = "";
    if (root.H3Slides) root.H3Slides.St.cur = i;
  }
  function go(at, dir) {
    if (!show) return;
    if (at >= show.list.length) { if (show.endShown) return stop(); show.endShown = true; show.host.innerHTML = ""; const e = doc.createElement("div"); e.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#aaa;font:20px sans-serif"; e.textContent = "The end of the presentation - click or press a key to leave"; show.host.appendChild(e); show.cnt.textContent = ""; return; }
    show.endShown = false;
    show.at = Math.max(0, at); draw(dir == null ? (at >= show.at ? 1 : -1) : dir);
  }
  function key(e) {
    if (!show) return;
    const k = e.key; e.preventDefault(); e.stopPropagation();
    if (show.blank && k !== "Escape") { show.blank = null; show.box.style.background = "#000"; show.host.style.visibility = ""; return; }
    if (/^[0-9]$/.test(k)) { show.num = (show.num || "") + k; return; }
    if (k === "Enter" && show.num) { const n = +show.num - 1; show.num = ""; return go(Math.min(show.list.length - 1, Math.max(0, n)), 0); }
    show.num = "";
    if (["ArrowRight", "ArrowDown", " ", "Enter", "PageDown", "n", "N"].includes(k)) return go(show.at + 1, 1);
    if (["ArrowLeft", "ArrowUp", "Backspace", "PageUp", "p", "P"].includes(k)) { if (show.endShown) { show.endShown = false; return go(show.at, 0); } return go(show.at - 1, -1); }
    if (k === "Home") return go(0, 0);
    if (k === "End") return go(show.list.length - 1, 0);
    if (k === "b" || k === "B" || k === "." || k === "w" || k === "W" || k === ",") { show.blank = true; show.host.style.visibility = "hidden"; show.box.style.background = /[wW,]/.test(k) ? "#fff" : "#000"; return; }
    if (k === "Escape") return stop();
  }
  function start(from) {
    const ed = S(); if (!ed || !ed.deck()) return;
    if (ed.St.edit) ed.endEdit();
    if (show) stop();
    const d = ed.deck(), list = order(d);
    if (!list.length) return ed.msg("every slide is hidden - nothing to show", true);
    let at = list.indexOf(from || 0); if (at < 0) at = Math.max(0, list.findIndex((i) => i > (from || 0)));
    const box = doc.createElement("div"); box.id = "slShow"; box.tabIndex = 0; box.setAttribute("data-own-space", "1");   // Space = next (static/spaceplay.js leaves it)
    box.innerHTML = `<div class="host"></div><div class="cnt"></div><div class="bar"><button type="button" data-a="prev" title="Back">◀</button><button type="button" data-a="next" title="Next">▶</button><button type="button" data-a="end" title="End the show (Esc)">✕</button></div>`;
    doc.body.appendChild(box);
    show = { box, host: box.querySelector(".host"), cnt: box.querySelector(".cnt"), list, at };
    let hideT = 0;
    box.addEventListener("pointermove", () => { box.classList.add("ptr"); clearTimeout(hideT); hideT = setTimeout(() => box.classList.remove("ptr"), 1800); });
    box.addEventListener("click", (e) => { const a = e.target.closest("[data-a]"); if (a) { e.stopPropagation(); return ({ prev: () => go(show.at - 1, -1), next: () => go(show.at + 1, 1), end: stop })[a.dataset.a](); } if (show.blank) { show.blank = null; show.box.style.background = "#000"; show.host.style.visibility = ""; return; } go(show.at + 1, 1); });
    box.addEventListener("contextmenu", (e) => { e.preventDefault(); go(show.at - 1, -1); });
    box.addEventListener("keydown", key, true);
    show.onFs = () => { if (show && show.fs && !doc.fullscreenElement) stop(); };
    doc.addEventListener("fullscreenchange", show.onFs);
    root.addEventListener("resize", size);
    try { const p = box.requestFullscreen && box.requestFullscreen(); if (p && p.then) p.then(() => { if (show) show.fs = true; }).catch(() => { /* a window is enough */ }); } catch (e) { /* fine */ }
    size(); box.focus(); draw(0);
    return true;
  }
  function stop() {
    if (!show) return;
    const s = show; show = null;
    doc.removeEventListener("fullscreenchange", s.onFs); root.removeEventListener("resize", size);
    if (doc.fullscreenElement) { try { doc.exitFullscreen(); } catch (e) { /* fine */ } }
    s.box.remove();
    const ed = S(); if (ed) { ed.St.sel.clear(); ed.paint(); const w = doc.getElementById("slStageWrap"); if (w) w.focus({ preventScroll: true }); }
  }
  root.H3SlideShow = { start, stop, order, go: (i) => go(i, 0), get on() { return !!show; }, get at() { return show ? show.list[show.at] : -1; } };
})(window);
