/* bitGen Studio — static/seedctl.js (2.598.0): THE SEED with a 🎲 Random / 📌 Fixed TOGGLE - Basic Settings (video and
 * image) and the style editors (image, video, music) (window.H3Seed).
 *
 * Tim (verbatim): "add seed input in basic settings docker and in the styles - have a toggle button for random/fixed".
 *   the toggle      🎲 Random (every render a new seed - the number box is greyed, "random") / 📌 Fixed (that number every
 *                   render). Random -> Fixed takes back the number it had, else the last seed used, else a new one;
 *                   typing a number makes it Fixed; ♻ = the last seed used, Fixed
 *   Basic Settings  video: the hidden #seed keeps the old contract (-1 = random) so every reader of $("seed").value
 *                   works as before - and a value SET from elsewhere (a project, ♻) repaints the toggle; image: #imgSeed,
 *                   sent with the image settings while Override style is on (remembered in this browser)
 *   the styles      a Seed row in each editor -> seed_mode + seed on the style (lib/seedPick.js: Basic Settings' fixed
 *                   seed wins, then the style's fixed seed, else random)
 * Pure (Node): valueOf(state), fromValue(v), next(state, last, roll), clean(v). */
(function (root) {
  "use strict";
  var MAX = 4294967295;
  function clean(v) { if (v === "" || v === null || v === undefined) return null; var n = Number(v); return Number.isInteger(n) && n >= 0 && n <= MAX ? n : null; }
  /** {mode, seed} -> the number a render reads (-1 = random) */
  function valueOf(st) { return st && st.mode === "fixed" && clean(st.seed) !== null ? clean(st.seed) : -1; }
  /** a number (-1 / "" = random) -> {mode, seed} */
  function fromValue(v, keep) { var n = clean(v); return n !== null ? { mode: "fixed", seed: n } : { mode: "random", seed: clean(keep) }; }
  /** the toggle pressed: random -> fixed (its own number, else the last used, else a new one); fixed -> random (kept) */
  function next(st, last, roll) {
    if (st.mode === "fixed") return { mode: "random", seed: st.seed };
    var n = clean(st.seed); if (n === null) n = clean(last); if (n === null) n = roll ? roll() : Math.floor(Math.random() * 2147483647);
    return { mode: "fixed", seed: n };
  }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { valueOf: valueOf, fromValue: fromValue, next: next, clean: clean }; return; }

  var $ = function (id) { return document.getElementById(id); };
  function css() {
    if ($("seedCtlCss")) return;
    var s = document.createElement("style"); s.id = "seedCtlCss";
    s.textContent = ".seedctl{display:flex;gap:3px;align-items:center}.seedctl .seedmode{white-space:nowrap;min-width:84px}"
      + ".seedctl .seedmode[aria-pressed=true]{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
      + ".seedctl input[type=number]{flex:1;min-width:0}.seedctl input[type=number]:disabled{opacity:.55}";
    document.head.appendChild(s);
  }
  function lastSeed() { try { return typeof lastSeedSeen !== "undefined" ? lastSeedSeen : null; } catch (e) { return null; } }   // eslint-disable-line no-undef

  /** the controls' HTML (ids from a prefix): the toggle, the number, ♻ */
  function html(pre, title) {
    return '<div class="seedctl" id="' + pre + 'Ctl">'
      + '<button class="ghost seedmode" id="' + pre + 'Mode" type="button" aria-pressed="false" title="' + (title || "Random: every render a new seed. Fixed: the number beside it every render (the same picture again with the same settings)") + '">🎲 Random</button>'
      + '<input type="number" id="' + pre + 'Num" min="0" max="' + MAX + '" step="1" placeholder="random" title="The seed - typing one makes it Fixed">'
      + '<button class="ghost" id="' + pre + 'Last" type="button" title="Use the last seed used (Fixed)" aria-label="Use the last seed">♻</button></div>';
  }
  /** wire a toggle + number (+ ♻) to a state; opts {mode, num, last, value (the hidden input that carries -1 / n), onChange, key} */
  function bind(o) {
    css();
    var st = { mode: "random", seed: null }, painting = false;
    function paint() {
      painting = true;
      o.mode.textContent = st.mode === "fixed" ? "📌 Fixed" : "🎲 Random";
      o.mode.setAttribute("aria-pressed", st.mode === "fixed" ? "true" : "false");
      o.num.disabled = st.mode !== "fixed";
      o.num.value = st.mode === "fixed" ? String(st.seed) : "";
      var l = lastSeed();
      o.num.placeholder = st.mode === "fixed" ? "a seed" : "random" + (l != null ? " (last " + l + ")" : "");
      if (o.last) o.last.disabled = l == null;
      if (o.value) setRaw(String(valueOf(st)));
      painting = false;
    }
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    function setRaw(v) { if (o.value) desc.set.call(o.value, v); }
    function set(s, quiet) {
      st = { mode: s.mode === "fixed" && clean(s.seed) !== null ? "fixed" : "random", seed: clean(s.seed) };
      paint();
      if (o.key) { try { localStorage.setItem(o.key, JSON.stringify(st)); } catch (e) { /* fine */ } }
      if (!quiet && o.onChange) o.onChange(st);
      if (!quiet && o.value) o.value.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (o.value) {
      // a value SET from elsewhere (a project restored, ♻, the old 🎲) repaints the toggle; reading stays the input's own
      Object.defineProperty(o.value, "value", { configurable: true,
        get: function () { return desc.get.call(this); },
        set: function (v) { desc.set.call(this, v); if (!painting) { var f = fromValue(v, st.seed); st = f; paint(); } } });
    }
    o.mode.onclick = function () { set(next(st, lastSeed())); };
    o.num.onchange = function () { var n = clean(o.num.value); set(n === null ? { mode: "random", seed: st.seed } : { mode: "fixed", seed: n }); };
    if (o.last) o.last.onclick = function () { var l = clean(lastSeed()); if (l !== null) set({ mode: "fixed", seed: l }); };
    var init = o.value ? fromValue(desc.get.call(o.value)) : { mode: "random", seed: null };
    if (o.key) { try { var sv = JSON.parse(localStorage.getItem(o.key) || "null"); if (sv && sv.mode) init = sv; } catch (e) { /* fine */ } }
    set(init, true);
    setInterval(function () { if (o.mode.isConnected && document.activeElement !== o.num) paint(); }, 3000);   // the last seed's hint
    return { get: function () { return { mode: st.mode, seed: st.seed }; }, set: function (s) { set(s, true); }, value: function () { return valueOf(st); }, paint: paint };
  }

  /* ---------------- Basic Settings */
  var C = {};
  function basic() {
    if ($("seedMode") && $("seed") && !C.video) C.video = bind({ mode: $("seedMode"), num: $("seedNum"), last: $("seedLast"), value: $("seed") });
    if ($("imgSeedMode") && !C.image) C.image = bind({ mode: $("imgSeedMode"), num: $("imgSeedNum"), last: $("imgSeedLast"), value: $("imgSeed"), key: "h3.imgSeed" });
  }

  /* ---------------- the style editors: a Seed row after the given field's row; their read / paint functions wrapped */
  var FORMS = [
    { pre: "s_stseed", after: "s_stcfg", read: "readStyleForm", paint: "paintStyleForm" },
    { pre: "s_vsseed", after: "s_vsrole", read: "vsReadForm", paint: "vsPaintForm" },
    { pre: "s_museed", after: "s_mucfg", read: "readMusicForm", paint: "paintMusicForm" },
  ];
  function styles() {
    FORMS.forEach(function (f) {
      if (C[f.pre] || !$(f.after) || typeof root[f.read] !== "function" || typeof root[f.paint] !== "function") return;
      var row = $(f.after).closest(".grid3") || $(f.after).parentNode;
      var box = document.createElement("div");
      box.className = "grid3"; box.style.cssText = "align-items:end;margin-top:6px";
      box.innerHTML = '<div style="grid-column:1 / span 2"><label class="f" title="Random: a new seed every render (the style is a look). Fixed: this style always renders with the same seed - Basic Settings\' own Fixed seed still wins">Seed</label>'
        + html(f.pre, "Random: every render with this style gets a new seed. Fixed: always this seed (Basic Settings' Fixed seed still wins)") + "</div><div></div>";
      row.parentNode.insertBefore(box, row.nextSibling);
      var ctl = C[f.pre] = bind({ mode: $(f.pre + "Mode"), num: $(f.pre + "Num"), last: $(f.pre + "Last") });
      var read = root[f.read], paint = root[f.paint];
      root[f.read] = function () { var b = read.apply(this, arguments); if (b && typeof b === "object" && !b.chain) { var s = ctl.get(); b.seed_mode = s.mode; b.seed = s.seed; } return b; };
      root[f.paint] = function (st) { var r = paint.apply(this, arguments); ctl.set({ mode: st && st.seed_mode === "fixed" ? "fixed" : "random", seed: st ? st.seed : null }); return r; };
    });
  }
  function boot() { basic(); styles(); }
  // after index.html's own script (its form functions exist then)
  var go = function () { setTimeout(function () { boot(); setTimeout(boot, 1500); }, 0); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  root.H3Seed = { bind: bind, html: html, valueOf: valueOf, fromValue: fromValue, next: next, clean: clean, controls: C, boot: boot };
})(typeof window !== "undefined" ? window : globalThis);
