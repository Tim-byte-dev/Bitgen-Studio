/* bitGen Studio — ext/synthdock/synthpads.js (2.954.0): 🎹 THE SYNTH STATION's DRUM PADS (window.H3SynthPads), beside the looper.
 * Tim: "add a drum pad next to the hammerhead style looper".
 *   16 pads, 4 x 4, numbered from the bottom left like a hardware pad controller. Pads 1-8 ARE the looper's 8 rows (their
 *   sound, volume, pitch and pan - a row's colour); pads 9-16 have sounds of their own (kit, your samples, the project's SFX,
 *   the Sound assets, songs).
 *   Play     click / tap (nearer the middle = harder), the keys while the pads have the focus (Z X C V = 1-4, A S D F = 5-8,
 *            Q W E R = 9-12, 1 2 3 4 = 13-16 - never passed on to the synth's keys), a MIDI drum channel (10: notes 36-51)
 *   ⏺ Into loop   while the loop plays, a hit on pads 1-8 is written on the nearest step (hard = an accent)
 *   ✎ Edit   click a pad to pick it: its sound, volume and pitch (for 1-8 that is the row's)
 * The rules: PAD_KEYS, ORDER, DEFAULTS, cleanPads(j), velocity(x, y) - pure (scripts/test-954.js).
 * init({ctx(), dest(), msg(), loop (H3SynthLoop), saved, save(pads)})
 */
(function (root) {
  "use strict";
  var C = root.H3SynthCore;
  var PAD_KEYS = { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3, KeyA: 4, KeyS: 5, KeyD: 6, KeyF: 7, KeyQ: 8, KeyW: 9, KeyE: 10, KeyR: 11, Digit1: 12, Digit2: 13, Digit3: 14, Digit4: 15 };
  var KEY_LABEL = ["Z", "X", "C", "V", "A", "S", "D", "F", "Q", "W", "E", "R", "1", "2", "3", "4"];
  var ORDER = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3];        // the grid top-left to bottom-right: pad 13 at the top left
  var OWN_HUES = ["#ff8a5a", "#ffd9a0", "#9cf0ff", "#c8ff7a", "#ff9ad5", "#a8b8ff", "#ffe36e", "#7affd4"];
  var DEFAULTS = [{ snd: "kit:boom", vol: 0.85, pitch: 0 }, { snd: "kit:cowbell", vol: 0.7, pitch: 0 }, { snd: "kit:zap", vol: 0.7, pitch: 0 }, { snd: "kit:crash", vol: 0.6, pitch: 0 },
                  { snd: "kit:tom", vol: 0.8, pitch: 5 }, { snd: "kit:tom", vol: 0.8, pitch: -4 }, { snd: "kit:clap", vol: 0.75, pitch: -3 }, { snd: "kit:rim", vol: 0.7, pitch: 3 }];
  function cleanPads(j) {
    var a = Array.isArray(j) ? j : [];
    return DEFAULTS.map(function (d, i) {
      var x = a[i] || {}, ok = C && C.okSnd ? C.okSnd(x.snd) : null;
      return { snd: ok || d.snd, vol: Number.isFinite(+x.vol) ? Math.max(0, Math.min(1, +x.vol)) : d.vol, pitch: Number.isFinite(+x.pitch) ? Math.max(-24, Math.min(24, Math.round(+x.pitch))) : d.pitch };
    });
  }
  /** how hard: x, y = where on the pad (0..1 each) - the middle = 1, a corner = 0.45 */
  function velocity(x, y) {
    var d = Math.sqrt(Math.pow(x - 0.5, 2) + Math.pow(y - 0.5, 2)) / Math.SQRT1_2;
    return Math.round(Math.max(0.45, Math.min(1, 1 - 0.55 * d)) * 100) / 100;
  }
  var pure = { PAD_KEYS: PAD_KEYS, KEY_LABEL: KEY_LABEL, ORDER: ORDER, DEFAULTS: DEFAULTS, cleanPads: cleanPads, velocity: velocity };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, KN = root.H3SynthKnob;
  var $ = function (id) { return doc.getElementById(id); };
  var O = null, P = cleanPads(null), S = { rec: false, edit: false, sel: -1, lists: [], hits: 0, last: -1 };
  function LP() { return O && O.loop; }
  function nameOf(i) { return i < 8 ? (LP() ? LP().sndName(LP().loop().rows[i].snd) : "") : (LP() ? LP().sndName(P[i - 8].snd) : P[i - 8].snd); }
  function hue(i) { return i < 8 ? (LP() ? LP().HUES[i] : "#38e1ff") : OWN_HUES[i - 8]; }
  function flash(i) {
    var b = doc.querySelector('#syPadGrid [data-pad="' + i + '"]'); if (!b) return;
    b.classList.remove("on"); void b.offsetWidth; b.classList.add("on");
    root.setTimeout(function () { b.classList.remove("on"); }, 140);
  }
  /** play pad i (0-15) with velocity v */
  function hit(i, v) {
    if (!O || i < 0 || i > 15) return;
    v = v == null ? 0.9 : v; S.hits++; S.last = i;
    if (i < 8) {
      LP().hit(i, v);
      if (S.rec) { var k = LP().recordHit(i, v); if (k >= 0 && O.msg) O.msg("⏺ pad " + (i + 1) + " -> step " + (k + 1)); }
    } else {
      var pd = P[i - 8], ctx = O.ctx();
      LP().buffer(pd.snd).then(function (b) {
        var s = ctx.createBufferSource(), g = ctx.createGain();
        s.buffer = b; s.playbackRate.value = Math.pow(2, pd.pitch / 12); g.gain.value = pd.vol * v;
        s.connect(g); g.connect(O.dest()); s.start(ctx.currentTime + 0.003);
        s.onended = function () { try { g.disconnect(); } catch (e) { /* gone */ } };
      }).catch(function () { /* said */ });
    }
    flash(i);
    if (S.edit) pick(i);
  }
  function build() {
    var g = $("syPadGrid"); if (!g) return;
    g.innerHTML = "";
    ORDER.forEach(function (i) {
      var b = doc.createElement("button"); b.type = "button"; b.className = "sypad"; b.dataset.pad = i;
      b.style.setProperty("--pc", hue(i));
      b.innerHTML = '<i>' + (i + 1) + '</i><span></span><kbd>' + KEY_LABEL[i] + "</kbd>";
      g.appendChild(b);
    });
    paint();
  }
  function paint() {
    doc.querySelectorAll("#syPadGrid .sypad").forEach(function (b) {
      var i = +b.dataset.pad; b.style.setProperty("--pc", hue(i));
      b.querySelector("span").textContent = nameOf(i);
      b.title = "Pad " + (i + 1) + " - " + nameOf(i) + (i < 8 ? " (the looper's row " + (i + 1) + ")" : "") + " · key " + KEY_LABEL[i];
      b.setAttribute("aria-label", b.title);
      b.classList.toggle("sel", S.edit && S.sel === i);
    });
    var r = $("syPadRec"); if (r) { r.classList.toggle("on", S.rec); r.setAttribute("aria-pressed", S.rec ? "true" : "false"); }
    var e = $("syPadEdit"); if (e) { e.classList.toggle("on", S.edit); e.setAttribute("aria-pressed", S.edit ? "true" : "false"); }
    var box = $("syPadEd"); if (box) box.classList.toggle("on", S.edit && S.sel >= 0);
  }
  function opt(sel, v, t) { var o = doc.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }
  function soundSelect(cur, onPick) {
    var sel = doc.createElement("select"); sel.title = "This pad's sound";
    var g = doc.createElement("optgroup"); g.label = "Built-in kit"; sel.appendChild(g);
    C.KIT.forEach(function (k) { opt(g, "kit:" + k[0], k[1]); });
    var pre = { my: "my", sfx: "sfx", snd: "snd", out: "out" }, have = {};
    C.KIT.forEach(function (k) { have["kit:" + k[0]] = 1; });
    S.lists.forEach(function (grp) {
      if (!grp.items || !grp.items.length || !pre[grp.id]) return;
      var og = doc.createElement("optgroup"); og.label = grp.name; sel.appendChild(og);
      grp.items.slice(0, 300).forEach(function (it) { opt(og, grp.id + ":" + it.name, it.name); have[grp.id + ":" + it.name] = 1; });
    });
    if (cur && !have[cur]) opt(sel, cur, LP().sndName(cur));
    sel.value = cur;
    sel.onchange = function () { onPick(sel.value); };
    return sel;
  }
  /** ✎: pick pad i - its sound, volume, pitch */
  function pick(i) {
    S.sel = i; var box = $("syPadEd"); if (!box) return;
    box.innerHTML = "";
    var row = i < 8 ? LP().loop().rows[i] : null, pd = row || P[i - 8];
    var lab = doc.createElement("b"); lab.textContent = "Pad " + (i + 1) + (i < 8 ? " = row " + (i + 1) : ""); lab.style.color = hue(i);
    box.appendChild(lab);
    box.appendChild(soundSelect(pd.snd, function (v) {
      if (i < 8) LP().assign(i, v); else { P[i - 8].snd = v; LP().forget(v); save(); }
      paint(); hit(i, 0.9);
    }));
    var ks = doc.createElement("div"); ks.className = "sypadks";
    ks.appendChild(KN.knob({ label: "Vol", size: 30, color: hue(i), def: 0.8, get: function () { return pd.vol; }, set: function (n) { pd.vol = Math.round(n * 100) / 100; done(); }, text: function () { return Math.round(pd.vol * 100) + "%"; } }).el);
    ks.appendChild(KN.knob({ label: "Pitch", size: 30, color: hue(i), def: 0.5, steps: 49, bipolar: true, get: function () { return (pd.pitch + 24) / 48; }, set: function (n) { pd.pitch = Math.round(n * 48 - 24); done(); }, text: function () { return (pd.pitch > 0 ? "+" : "") + pd.pitch + " st"; } }).el);
    box.appendChild(ks);
    function done() { if (i < 8) { LP().paint(); if (LP().changed) LP().changed(); } else save(); }
    paint();
  }
  function save() { if (O && O.save) O.save(P); }
  function wire() {
    var g = $("syPadGrid"), box = $("syPadBox"); if (!g || !box) return;
    g.addEventListener("pointerdown", function (e) {
      var b = e.target.closest && e.target.closest(".sypad"); if (!b || e.button !== 0) return;
      e.preventDefault(); box.focus({ preventScroll: true });
      var r = b.getBoundingClientRect();
      hit(+b.dataset.pad, velocity((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
    });
    g.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest(".sypad"); if (b && e.detail === 0) hit(+b.dataset.pad, 0.9); });   // Enter / Space on a focused pad
    box.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      var i = PAD_KEYS[e.code]; if (i == null) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) hit(i, e.shiftKey ? 1 : 0.8);
    });
    box.addEventListener("keyup", function (e) { if (PAD_KEYS[e.code] != null) { e.preventDefault(); e.stopPropagation(); } });
    var r = $("syPadRec"); if (r) r.onclick = function () { S.rec = !S.rec; paint(); if (O.msg) O.msg(S.rec ? "⏺ Into loop: play pads 1-8 while the loop plays - each hit lands on the nearest step" : ""); };
    var ed = $("syPadEdit"); if (ed) ed.onclick = function () { S.edit = !S.edit; if (!S.edit) S.sel = -1; else if (S.sel < 0) pick(S.last >= 0 ? S.last : 0); paint(); };
  }
  function init(o) { O = o; P = cleanPads(o.saved); wire(); build(); }
  function setLists(groups) { S.lists = groups || []; paint(); if (S.edit && S.sel >= 0) pick(S.sel); }
  root.H3SynthPads = Object.assign({ setPads: function (j) { P = cleanPads(j); save(); paint(); }, init: init, hit: hit, flash: flash, paint: paint, setLists: setLists, pads: function () { return P; },
    info: function () { return { rec: S.rec, edit: S.edit, sel: S.sel, hits: S.hits, last: S.last, names: ORDER.map(function (i) { return nameOf(i); }), own: P.map(function (x) { return x.snd; }) }; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
