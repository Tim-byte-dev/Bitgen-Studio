/* bitGen Studio — ext/synthdock/synthtl.js (2.954.0): 🎹 THE SYNTH TAB's TIMELINE under the looper (window.H3SynthTL).
 * Tim: "add a timeline below that with waveforms that can be added from all sources, add knobs to each timeline layer for
 * volume. add keyframes to each layer, start volume end volume on each key frame".
 * 2.959.0 ("continue next please"): automation lanes (Pan / Filter / Rev points over a layer, picked per layer), a lowpass per
 * layer (fx.cut), ⤓ bounce (a layer rendered alone -> a sample -> a new layer, the original muted).
 * 2.960.0 ("lets do the next one"): ● Rec onto the armed layer (keys / looper + pads / mic, H3SynthRec with its clock),
 * ⟳ loop (a take a pass, the next pass mixed ahead - no gap), punch; take groups drawn as rows, comping by dragging across a
 * take, ▤ flatten.
 * 2.961.0 ("continue please"): ♩ the tempo track - a strip under the ruler (RULER = R0 + TS when on); tmap() drives the grid,
 * snapT (every snap), the click (T.beatTimes), the loop's 2 bars, the roll's grid and the bar.beat readout.
 * 2.962.0 ("lets do the last cakewalk item"): step clips (＋ ▦ Steps) - drawn as their hits, played hit by hit from the kit /
 * your samples on the tempo map, edited in synthsteps.js (double-click).
 *   Layers   each with its name, M(ute) / S(olo), a Vol knob (0-150%), a Pan knob, ◆ (a keyframe at the playhead), 🗑
 *   Sounds   ＋ Sound: the loop (made into a sample), the built-in kit, 📂 My samples, this project's SFX, the Sound assets
 *            (stems too), songs and the gallery's audio, or a file - click one to put it at the playhead on the picked
 *            layer, or drag it onto a layer; sound files dropped on a layer go there. Each clip shows its waveform.
 *   Clips    drag = move (to another layer too), drag an edge = trim, Delete = remove; ⌗ snaps to the looper's 16ths
 *   Keyframes double-click a layer (or ◆) = a keyframe there; drag its ◆ sideways = when, up / down = its START volume;
 *            drag the ● at the end of its line = its END volume; click one to set both with knobs; Delete removes it
 *   Out      ▶ plays it (the playhead runs; click the ruler to move it), ⬇ WAV, → 💥 SFX, → 🔊 Sound assets
 * The rules: synthtlcore.js. init({ctx(), dest(), msg(), loop (H3SynthLoop), bpm(), saved, save(tl), renderLoop(), toProject(),
 * blobOf(), upload(files, row), refresh()})
 */
(function (root) {
  "use strict";
  var doc = root.document, T = root.H3SynthTLCore, C = root.H3SynthCore, KN = root.H3SynthKnob;
  if (!doc || !T || !C || !KN) return;
  var $ = function (id) { return doc.getElementById(id); };
  var R0 = 22, TS = 22, RULER = 22, LH = 64, HUES = ["#38e1ff", "#ff4fd8", "#ffae3a", "#5dff8a", "#b78cff", "#ffd23a", "#4f9dff", "#ff5a5a"];
  var O = null, TLD = T.newTL(), sources = [], peaks = {}, dur = {};
  var S = { tpt: null, view: {}, apt: null, sel: 0, clip: null, key: null, ph: 0, playing: false, nodes: null, raf: 0, drag: null, scroll: 0, at: 0, from: 0,
            picked: false, only: null, missing: {} };   // 2.973.0: picked = a layer the user clicked; only = what ▶ plays; missing = sounds not found
  /* 2.973.0 (Tim: "the play button doesn't work for edit booth timeline, but add a dropdown to the left of the play button All and
     layer so either play all or only the selected layer, if no layer is selected play all. if keyboard and looper are playing let
     them play"). WHY ▶ did nothing: one clip whose sound file is gone (a deleted sample / take) made the whole start fail
     ("... is not there any more") - now the clips that can be played play, the missing ones are drawn struck through and named.
     ▶ never touches the keyboard or the looper - they go on under the timeline. */
  function playWhat() { var w = $("syTWhat"); return w && w.value === "layer" ? "layer" : "all"; }
  /** what ▶ plays: null = every layer (as mute / solo say), or the picked layer alone (heard even if muted or another is soloed) */
  function playOnly() { return playWhat() === "layer" && S.picked && S.sel >= 0 && S.sel < TLD.layers.length ? S.sel : null; }
  function paintWhat() {
    var w = $("syTWhat"); if (!w) return;
    var o = w.querySelector('option[value="layer"]'), t = S.picked && L(S.sel) ? "Layer: " + L(S.sel).name : "Layer (none picked = all)";
    if (o && o.textContent !== t) o.textContent = t;
  }
  function hue(i) { return HUES[i % HUES.length]; }
  function msg(t, bad) { if (O && O.msg) O.msg(t, bad); }
  function changed() { if (O && O.save) O.save(TLD); }
  function bpm() { return O && O.bpm ? O.bpm() : 120; }
  /* 2.961.0: the tempo track - the map the grid / snap / click / bars follow (the looper's BPM when it is off) */
  function tmap() { return TLD.tempoOn && TLD.tempo && TLD.tempo.length ? TLD.tempo : [{ t: 0, bpm: bpm(), ramp: false }]; }
  function snapT(t, on) { return T.snapBeat(tmap(), t, on, 4); }
  function layout() { RULER = R0 + (TLD.tempoOn ? TS : 0); }
  function L(i) { return TLD.layers[i]; }

  /* ---------------- sounds: buffers + waveforms ---------------- */
  function load(src) {
    return O.loop.buffer(src).then(function (b) {
      if (!peaks[src]) { var d = b.getChannelData(0); peaks[src] = T.peaks(d, b.sampleRate, 100); dur[src] = b.duration; }
      return b;
    });
  }
  function warm() { TLD.layers.forEach(function (l) { l.clips.forEach(function (c) { if (!c.kind && !peaks[c.src]) load(c.src).then(draw).catch(function () { /* said */ }); }); }); }
  /** a sound onto layer li at t (seconds) -> the clip (its length once the sound is read) */
  function addClip(src, li, t, name) {
    if (!T.okSrc(src)) return Promise.resolve(null);
    li = Math.max(0, Math.min(TLD.layers.length - 1, li == null ? S.sel : li));
    return load(src).then(function (b) {
      var c = { src: src, name: name || src.replace(/^\w+:/, "").replace(/\.[a-z0-9]+$/i, ""), start: snapT(t == null ? S.ph : t, TLD.snap), off: 0, len: b.duration, gain: 1, fi: 0, fo: 0 };
      L(li).clips.push(c); S.sel = li; S.clip = { l: li, c: L(li).clips.length - 1 }; S.key = null;
      changed(); heads(); draw(); msg("＋ " + c.name + " on " + L(li).name + " at " + T.fmt(c.start));
      return c;
    }).catch(function (e) { msg(e.message || String(e), true); return null; });
  }
  /** 🔁 the loop as it is now -> a sample in My samples -> a clip */
  function addLoop(li, t) {
    msg("Making the loop into a sample…");
    return O.renderLoop().then(function (r) {
      if (!r.hits) throw new Error("the loop is empty - put some steps on first");
      var lp = O.loop.loop(), name = "loop " + (lp.chain ? "chain" : C.PAT_NAMES.charAt(lp.pat)) + " " + lp.bpm + "bpm.wav";
      return O.upload([new root.File([C.wav(r.chans, r.sampleRate)], name, { type: "audio/wav" })], null);
    }).then(function (j) {
      var got = j && j.added && j.added[0]; if (!got) throw new Error("the loop could not be saved");
      return addClip("my:" + got.name, li, t);
    }).catch(function (e) { msg(e.message || String(e), true); return null; });
  }

  /* ---------------- the layers' heads ---------------- */
  function heads() {
    var box = $("syTHeads"); if (!box) return;
    box.innerHTML = '<div class="sytlrul" style="height:' + RULER + 'px">' + (TLD.tempoOn ? '<span class="sytltempo" style="top:' + R0 + 'px;height:' + TS + 'px">♩ Tempo</span>' : '') + '</div>';
    TLD.layers.forEach(function (l, i) {
      var h = doc.createElement("div"); h.className = "sytlhead" + (i === S.sel ? " sel" : ""); h.style.height = LH + "px"; h.style.setProperty("--lc", hue(i)); h.dataset.l = i;
      h.innerHTML = '<div class="sytlh1"><input maxlength="32" title="The layer\'s name"><button class="ghost sym m" type="button" title="Mute">M</button><button class="ghost sym s" type="button" title="Solo">S</button>'
        + '<button class="ghost sym" data-k type="button" title="◆ A keyframe at the playhead (start = end volume - drag them, or click it for its knobs)">◆</button><button class="ghost sym" data-x type="button" title="Delete this layer">🗑</button></div><div class="sytlh2"></div>';
      var inp = h.querySelector("input"); inp.value = l.name;
      inp.title = "This layer's name - click it and type a new one"; inp.setAttribute("aria-label", "Layer " + (i + 1) + " name");
      inp.onchange = function () { l.name = inp.value.replace(/[<>]/g, "").trim().slice(0, 32) || "Layer " + (i + 1); inp.value = l.name; changed(); keyEd(); draw(); };
      inp.addEventListener("keydown", function (e) { e.stopPropagation(); });
      var bs = h.querySelectorAll("button");
      bs[0].classList.toggle("on", l.mute); bs[1].classList.toggle("on", l.solo);
      bs[0].onclick = function () { l.mute = !l.mute; liveMix(); changed(); heads(); draw(); };
      bs[1].onclick = function () { l.solo = !l.solo; liveMix(); changed(); heads(); draw(); };
      bs[2].onclick = function () { var k = T.addKey(l, S.ph, T.end(TLD)); if (k >= 0) { S.sel = i; S.key = { l: i, k: k }; S.clip = null; keyEd(); changed(); heads(); draw(); } };
      bs[3].onclick = function () {
        if (TLD.layers.length <= 1) { msg("A timeline keeps at least one layer", true); return; }
        if (S.rec) { msg("Stop the recording first", true); return; }
        TLD.layers.splice(i, 1); S.sel = Math.min(S.sel, TLD.layers.length - 1); if (S.arm === i) S.arm = null; else if (S.arm > i) S.arm--; S.clip = null; S.key = null; keyEd(); changed(); heads(); draw();
      };
      // 2.959.0: which lane the layer shows: ◆ volume keyframes or an automation lane (pan / filter / reverb); ⤓ bounce
      var lane = doc.createElement("select"); lane.className = "sytlview"; lane.title = "What the line over this layer edits: ◆ volume keyframes, or the automation of Pan, Filter or Rev - double-click the layer to add a point";
      [["vol", "◆ Vol"], ["pan", "Pan"], ["cut", "Filter"], ["rev", "Rev"]].forEach(function (o) { var op = doc.createElement("option"); op.value = o[0]; op.textContent = o[0] !== "vol" && l.auto && l.auto[o[0]] && l.auto[o[0]].length ? o[1] + " •" : o[1]; lane.appendChild(op); });
      lane.value = view(i); lane.onchange = function () { S.view[i] = lane.value; S.apt = null; S.key = null; keyEd(); draw(); };
      lane.addEventListener("keydown", function (e) { e.stopPropagation(); });
      var bn = doc.createElement("button"); bn.type = "button"; bn.className = "ghost sym"; bn.dataset.bounce = i; bn.textContent = "⤓"; bn.title = "⤓ Bounce: this layer (its effects and lanes too) rendered to one sound on a new layer; this one is muted";
      bn.onclick = function () { bounce(i); };
      h.querySelector(".sytlh1").insertBefore(bn, h.querySelector("[data-x]"));
      // 2.960.0: ● arm - the layer ● Rec records onto (one at a time)
      var ar = doc.createElement("button"); ar.type = "button"; ar.className = "ghost sym arm" + (S.arm === i ? " on" : ""); ar.dataset.arm = i; ar.textContent = "●";
      ar.title = "● Arm: ● Rec (in the bar) records onto this layer - over a clip or takes it adds a take"; ar.setAttribute("aria-pressed", S.arm === i ? "true" : "false");
      ar.onclick = function () { if (S.rec) { msg("Stop the recording first", true); return; } S.arm = S.arm === i ? null : i; heads(); };
      h.querySelector(".sytlh1").insertBefore(ar, h.querySelector(".m"));
      var k2 = h.querySelector(".sytlh2");
      var kv = KN.knob({ label: "Vol", size: 30, color: hue(i), def: 1 / 1.5, get: function () { return l.vol / 1.5; }, set: function (n) { l.vol = Math.round(n * 150) / 100; liveMix(); changed(); }, text: function () { return Math.round(l.vol * 100) + "%"; } });
      var kp = KN.knob({ label: "Pan", size: 30, color: hue(i), def: 0.5, bipolar: true, get: function () { return (l.pan + 1) / 2; }, set: function (n) { l.pan = Math.round((n * 2 - 1) * 100) / 100; liveMix(); changed(); }, text: function () { return Math.abs(l.pan) < 0.02 ? "C" : (l.pan < 0 ? "L" : "R") + Math.round(Math.abs(l.pan) * 100); } });
      kv.el.setAttribute("aria-label", l.name + " volume"); kp.el.setAttribute("aria-label", l.name + " pan"); kv.el.dataset.vol = i;
      k2.appendChild(kv.el); k2.appendChild(kp.el); k2.appendChild(lane);
      h.addEventListener("pointerdown", function (e) { if (e.target.closest("button, select, .sykn")) return; var was = S.sel; S.sel = i; S.picked = true; paintWhat(); S.clip = null; S.key = null; S.tpt = null; S.apt = null; keyEd();
        if (was !== i) { if (e.target.closest("input")) box.querySelectorAll(".sytlhead").forEach(function (x) { x.classList.toggle("sel", x === h); }); else heads(); }   // typing a name: keep its box
        draw(); });   // 2.963.0: the panel edits this layer
      box.appendChild(h);
    });
    var add = doc.createElement("button"); add.type = "button"; add.className = "ghost sytladd"; add.textContent = "＋ Layer"; add.title = "Add a layer";
    add.onclick = function () { if (TLD.layers.length >= T.MAXL) { msg("16 layers at most", true); return; } TLD.layers.push(T.newLayer(TLD.layers.length)); S.sel = TLD.layers.length - 1; changed(); heads(); draw(); };
    box.appendChild(add);
    if (root.H3SynthMix && root.H3SynthMix.isOpen()) root.H3SynthMix.build();   // 2.958.0: the mixer follows the layers
  }

  /* ---------------- the canvas ---------------- */
  function px(t) { return t * TLD.zoom - S.scroll; }
  function tAt(x) { return Math.max(0, (x + S.scroll) / TLD.zoom); }
  function laneTop(i) { return RULER + i * LH; }
  function vy(i, v) { var top = laneTop(i) + 16, bot = laneTop(i) + LH - 5; return bot - (bot - top) * v; }
  function size() {
    var cv = $("syTCanvas"), sc = $("syTScroll"), sp = $("syTSpacer"); if (!cv || !sc) return null;
    var w = sc.clientWidth || 600, h = RULER + TLD.layers.length * LH, total = Math.max(w, (T.end(TLD) + 30) * TLD.zoom), dpr = Math.min(2, root.devicePixelRatio || 1);
    if (sp) sp.style.width = total + "px";
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px"; }
    var x = cv.getContext("2d"); if (!x) return null; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { x: x, w: w, h: h };
  }
  function rr(x, X, Y, W, H, r) { r = Math.min(r, W / 2, H / 2); x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  function draw() {
    var g = size(); if (!g) return;
    var x = g.x, w = g.w, endT = T.end(TLD);
    x.fillStyle = "#0b0d11"; x.fillRect(0, 0, w, g.h);
    // lanes
    TLD.layers.forEach(function (l, i) {
      x.fillStyle = i === S.sel ? "#161a22" : (i % 2 ? "#101318" : "#0d1014"); x.fillRect(0, laneTop(i), w, LH);
      x.fillStyle = "#1c2028"; x.fillRect(0, laneTop(i) + LH - 1, w, 1);
    });
    // the beat grid (the looper's BPM) + the ruler
    var tm = tmap(), t0 = tAt(0), t1 = tAt(w);   // 2.961.0: the beats from the tempo map
    for (var b = Math.floor(T.beatAt(tm, t0)), gn = 0; gn < 5000; b++, gn++) {
      var tb = T.timeAt(tm, b); if (tb > t1) break;
      var bar = b % 4 === 0, fine = (T.timeAt(tm, b + 1) - tb) * TLD.zoom > 14; if (!bar && !fine) continue;
      x.fillStyle = bar ? "#252a34" : "#171b22"; x.fillRect(Math.round(px(tb)), RULER, 1, g.h - RULER);
    }
    x.fillStyle = "#07090c"; x.fillRect(0, 0, w, RULER);
    var stepS = TLD.zoom > 80 ? 0.5 : TLD.zoom > 30 ? 1 : TLD.zoom > 12 ? 2 : TLD.zoom > 6 ? 5 : 10;
    x.font = "9px ui-monospace, Consolas, monospace"; x.textAlign = "left";
    for (var s = Math.floor(t0 / stepS) * stepS; s <= t1; s += stepS) {
      var sx = Math.round(px(s)); x.fillStyle = "#3a404c"; x.fillRect(sx, R0 - 7, 1, 7);
      x.fillStyle = "#8b95a7"; x.fillText(T.fmt(s).replace(/\.0$/, ""), sx + 3, 10);
    }
    if (TLD.tempoOn) drawTempo(x, w);
    // clips with their waveforms
    TLD.layers.forEach(function (l, i) {
      var col = hue(i), dim = !T.audible(TLD, i), fdl = T.fades(l.clips);
      l.clips.forEach(function (c, ci) {
        if (c.grp) return;   // 2.960.0: takes are drawn as their group (drawTakes)
        var X0 = px(c.start), W = c.len * TLD.zoom; if (X0 > w || X0 + W < 0) return;
        var Y = laneTop(i) + 3, H = LH - 7, sel = S.clip && S.clip.l === i && S.clip.c === ci;
        x.save(); x.globalAlpha = dim ? 0.45 : 1;
        rr(x, X0, Y, W, H, 5); x.fillStyle = col; x.globalAlpha *= 0.18; x.fill(); x.globalAlpha = dim ? 0.45 : 1;
        x.lineWidth = sel ? 2 : 1; x.strokeStyle = sel ? "#f4f1e8" : col; x.stroke();
        var p = c.kind === "notes" ? null : peaks[c.src];
        if (c.kind === "notes" && c.notes.length) {   // 2.957.0: a note clip = its notes as little bars
          x.save(); rr(x, X0, Y, W, H, 5); x.clip();
          var lo2 = 127, hi2 = 0; c.notes.forEach(function (n) { lo2 = Math.min(lo2, n.m); hi2 = Math.max(hi2, n.m); });
          var span = Math.max(12, hi2 - lo2 + 1), rowH = (H - 16) / span;
          x.fillStyle = col; x.globalAlpha = dim ? 0.4 : 0.9;
          c.notes.forEach(function (n) { if (n.t >= c.len) return; x.fillRect(X0 + n.t * TLD.zoom, Y + 14 + (hi2 + (span - (hi2 - lo2 + 1)) / 2 - n.m) * rowH, Math.max(2, Math.min(n.d, c.len - n.t) * TLD.zoom - 1), Math.max(2, rowH - 1)); });
          x.restore();
        }
        if (c.kind === "steps" && c.rows.length) {   // 2.962.0: its hits as little cells, a row each
          x.save(); rr(x, X0, Y, W, H, 5); x.clip();
          var srh = (H - 16) / c.rows.length, cw2 = Math.max(2, (60 / T.bpmAt(tmap(), c.start)) / c.div * TLD.zoom - 1.5);
          T.stepEvents(c, tmap()).forEach(function (ev) { var ex = X0 + ev.t * TLD.zoom; if (ex > w || ex + cw2 < 0) return; x.fillStyle = col; x.globalAlpha = (dim ? 0.4 : 0.95) * (ev.v >= 0.79 ? 1 : 0.6); x.fillRect(ex, Y + 14 + ev.row * srh, cw2, Math.max(2, srh - 1)); });
          x.restore();
        }
        if (p) {
          x.save(); rr(x, X0, Y, W, H, 5); x.clip();
          var mid = Y + H / 2 + 5, amp = (H - 14) / 2, a = Math.max(0, Math.floor(-X0)), bEnd = Math.min(W, w - X0);
          x.fillStyle = col; x.globalAlpha = dim ? 0.35 : 0.85;
          for (var k = a; k < bEnd; k++) {
            var ts = c.off + k / TLD.zoom, te = c.off + (k + 1) / TLD.zoom, ia = Math.floor(ts * 100), ib = Math.max(ia + 1, Math.floor(te * 100)), lo = 0, hi = 0;
            for (var q = ia; q < ib && q * 2 + 1 < p.length; q++) { if (p[q * 2] < lo) lo = p[q * 2]; if (p[q * 2 + 1] > hi) hi = p[q * 2 + 1]; }
            if (hi - lo > 0.002) x.fillRect(X0 + k, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp));
          }
          x.restore();
        }
        // 2.957.0: the fades (shaded, with a handle at each top corner) and the clip's gain
        var fd = fdl[ci];
        x.save(); rr(x, X0, Y, W, H, 5); x.clip(); x.fillStyle = "#000"; x.globalAlpha = 0.45;
        if (fd.fi > 0) { x.beginPath(); x.moveTo(X0, Y); x.lineTo(X0 + fd.fi * TLD.zoom, Y); x.lineTo(X0, Y + H); x.closePath(); x.fill(); }
        if (fd.fo > 0) { x.beginPath(); x.moveTo(X0 + W, Y); x.lineTo(X0 + W - fd.fo * TLD.zoom, Y); x.lineTo(X0 + W, Y + H); x.closePath(); x.fill(); }
        x.restore();
        if (sel || W > 30) { x.fillStyle = sel ? "#f4f1e8" : col; x.fillRect(X0 + fd.fi * TLD.zoom - 3, Y, 6, 6); x.fillRect(X0 + W - fd.fo * TLD.zoom - 3, Y, 6, 6); }
        x.fillStyle = "#e9eef6"; x.font = "600 10px system-ui, sans-serif"; x.textAlign = "left";
        var gl = (c.gain != null && Math.abs(c.gain - 1) > 0.005) ? "  " + (c.gain > 0 ? (20 * Math.log10(c.gain) >= 0 ? "+" : "") + (20 * Math.log10(c.gain)).toFixed(1) + " dB" : "-∞ dB") : "";
        var gone = !c.kind && S.missing[c.src];   // 2.973.0: its sound file is not there - struck through, red
        x.save(); rr(x, X0, Y, W, H, 5); x.clip(); x.fillText((c.kind === "notes" ? "♪ " : c.kind === "steps" ? "▦ " : "") + (gone ? "⚠ missing: " : "") + c.name + gl, Math.max(X0, 0) + 9, Y + 11);
        if (gone) { x.strokeStyle = "#ff4d5e"; x.lineWidth = 2; x.beginPath(); x.moveTo(X0, Y + H); x.lineTo(X0 + W, Y); x.moveTo(X0, Y); x.lineTo(X0 + W, Y + H); x.stroke(); }
        x.restore();
        x.restore();
      });
    });
    TLD.layers.forEach(function (l, i) { drawTakes(x, w, l, i); });
    drawLoop(x, w, g.h);
    // the keyframe lines (start / end volume) and their handles
    TLD.layers.forEach(function (l, i) {   // 2.959.0: an automation lane in view: its points and line
      var k = view(i); if (k === "vol") return;
      var pts = (l.auto && l.auto[k]) || [], col = hue(i), def = T.autoNorm(k, k === "pan" ? l.pan : k === "cut" ? ((l.fx || T.FX0).cut || 20000) : (l.fx || T.FX0).rev);
      x.save(); x.strokeStyle = col; x.lineWidth = 1.6; x.setLineDash([2, 3]); x.beginPath(); x.moveTo(px(0), vy(i, def)); x.lineTo(px(pts.length ? pts[0].t : T.end(TLD)), vy(i, def)); x.stroke(); x.setLineDash([]);
      if (pts.length) { x.beginPath(); x.moveTo(px(pts[0].t), vy(i, pts[0].v)); pts.forEach(function (p2) { x.lineTo(px(p2.t), vy(i, p2.v)); }); x.lineTo(px(Math.max(T.end(TLD), pts[pts.length - 1].t)), vy(i, pts[pts.length - 1].v)); x.stroke(); }
      pts.forEach(function (p2, j) { var sel = S.apt && S.apt.l === i && S.apt.p === j; x.beginPath(); x.arc(px(p2.t), vy(i, p2.v), 4.5, 0, Math.PI * 2); x.fillStyle = sel ? "#f4f1e8" : col; x.fill(); x.strokeStyle = "#07090c"; x.lineWidth = 1; x.stroke(); });
      x.fillStyle = col; x.font = "600 9px system-ui, sans-serif"; x.textAlign = "right"; x.fillText({ pan: "PAN", cut: "FILTER", rev: "REV" }[k] + " lane", w - 6, laneTop(i) + LH - 7);
      x.restore();
    });
    TLD.layers.forEach(function (l, i) {
      if (!l.keys.length || view(i) !== "vol") return;
      var col = hue(i);
      x.save(); x.strokeStyle = col; x.lineWidth = 1.6; x.shadowColor = col; x.shadowBlur = 4; x.globalAlpha = T.audible(TLD, i) ? 1 : 0.5;
      x.setLineDash([3, 3]); x.beginPath(); x.moveTo(px(0), vy(i, 1)); x.lineTo(px(l.keys[0].t), vy(i, 1)); x.stroke(); x.setLineDash([]);
      x.beginPath();
      l.keys.forEach(function (K, k) {
        var e = k + 1 < l.keys.length ? l.keys[k + 1].t : Math.max(endT, K.t);
        if (k === 0) x.moveTo(px(K.t), vy(i, 1));
        x.lineTo(px(K.t), vy(i, K.a)); x.lineTo(px(e), vy(i, K.b));
      });
      x.stroke(); x.shadowBlur = 0;
      l.keys.forEach(function (K, k) {
        var e = k + 1 < l.keys.length ? l.keys[k + 1].t : Math.max(endT, K.t), sel = S.key && S.key.l === i && S.key.k === k, X = px(K.t), Y = vy(i, K.a);
        x.beginPath(); x.moveTo(X, Y - 6); x.lineTo(X + 6, Y); x.lineTo(X, Y + 6); x.lineTo(X - 6, Y); x.closePath();
        x.fillStyle = sel ? "#f4f1e8" : col; x.fill(); x.strokeStyle = "#07090c"; x.lineWidth = 1; x.stroke();
        x.beginPath(); x.arc(px(e) - (k + 1 < l.keys.length ? 9 : 0), vy(i, K.b), 4, 0, Math.PI * 2); x.fillStyle = sel ? "#f4f1e8" : "#0b0d11"; x.fill(); x.strokeStyle = col; x.lineWidth = 1.6; x.stroke();
      });
      x.restore();
    });
    // 2.958.0: the markers - a flag on the ruler and a faint line down the layers
    (TLD.markers || []).forEach(function (m) {
      var mx = Math.round(px(m.t)); if (mx < -80 || mx > w) return;
      x.fillStyle = "#ffd23a44"; x.fillRect(mx, RULER, 1, g.h - RULER);
      x.font = "600 9px system-ui, sans-serif"; var tw = x.measureText(m.name).width + 8;
      x.fillStyle = "#ffd23a"; x.fillRect(mx, 11, tw, 11); x.fillStyle = "#07090c"; x.textAlign = "left"; x.fillText(m.name, mx + 4, 20);
    });
    // the playhead
    var P = px(S.ph); x.fillStyle = "#ffae3a"; x.fillRect(Math.round(P), 0, 1.5, g.h);
    x.beginPath(); x.moveTo(P - 5, 0); x.lineTo(P + 5, 0); x.lineTo(P, 7); x.closePath(); x.fill();
    var pos = $("syTPos"); if (pos) { var bb = T.barBeat(tmap(), S.ph); pos.textContent = T.fmt(S.ph) + " / " + T.fmt(endT) + "  ·  " + bb.bar + "." + bb.beat + (TLD.tempoOn ? "  ♩" + Math.round(T.bpmAt(tmap(), S.ph) * 10) / 10 : ""); }
  }

  /* ---------------- pointer: the ruler, clips, edges, keyframes ---------------- */
  function hit(mx, my) {
    if (my < R0) return { kind: "ruler" };
    if (my < RULER) {   // 2.961.0: the tempo strip
      var tb2 = null, td = 8; TLD.tempo.forEach(function (q, j) { var d2 = Math.abs(mx - px(q.t)); if (d2 < td) { td = d2; tb2 = j; } });
      return tb2 == null ? { kind: "tstrip" } : { kind: "tpt", p: tb2 };
    }
    var i = Math.floor((my - RULER) / LH), l = L(i); if (!l) return null;
    var endT = T.end(TLD);
    if (view(i) !== "vol") {   // 2.959.0: an automation lane - its points instead of the keyframes
      var lk = view(i), pts = (l.auto && l.auto[lk]) || [], ab = null, ad = 8;
      pts.forEach(function (p2, j) { var d2 = Math.hypot(mx - px(p2.t), my - vy(i, p2.v)); if (d2 < ad) { ad = d2; ab = { kind: "apt", l: i, p: j, k: lk }; } });
      if (ab) return ab;
    }
    var best = null, bd = 8;   // the nearest handle: a ◆ (when + start volume) or a ● (end volume) - they sit close together
    for (var k = 0; view(i) === "vol" && k < l.keys.length; k++) {
      var K = l.keys[k], e = k + 1 < l.keys.length ? l.keys[k + 1].t : Math.max(endT, K.t), ex = px(e) - (k + 1 < l.keys.length ? 9 : 0);
      var da = Math.hypot(mx - px(K.t), my - vy(i, K.a)), db = Math.hypot(mx - ex, my - vy(i, K.b));
      if (da < bd) { bd = da; best = { kind: "keyA", l: i, k: k }; }
      if (db < bd) { bd = db; best = { kind: "keyB", l: i, k: k }; }
    }
    if (best) return best;
    var th = hitTakes(l, i, mx, my); if (th) return th;   // 2.960.0
    var fdl = T.fades(l.clips), ty = laneTop(i) + 3, fb = null, fdd = 7;
    if (my <= ty + 9) l.clips.forEach(function (cl, c) {   // the nearest fade handle (neighbours' handles sit close together)
      if (cl.grp) return;
      var a = Math.abs(mx - (px(cl.start) + fdl[c].fi * TLD.zoom)), b = Math.abs(mx - (px(T.clipEnd(cl)) - fdl[c].fo * TLD.zoom));
      if (a < fdd) { fdd = a; fb = { kind: "fadeIn", l: i, c: c }; } if (b < fdd) { fdd = b; fb = { kind: "fadeOut", l: i, c: c }; }
    });
    if (fb) return fb;
    for (var c = l.clips.length - 1; c >= 0; c--) {
      var cl = l.clips[c], X0 = px(cl.start), X1 = px(T.clipEnd(cl)); if (cl.grp) continue;
      if (mx >= X0 - 2 && mx <= X1 + 2) {
        if (mx - X0 <= 6 && !cl.kind) return { kind: "trimA", l: i, c: c };
        if (X1 - mx <= 6) return { kind: "trimB", l: i, c: c };
        return { kind: "clip", l: i, c: c };
      }
    }
    return { kind: "lane", l: i };
  }
  function pos(e) { var r = $("syTCanvas").getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function wireCanvas() {
    var cv = $("syTCanvas"), sc = $("syTScroll"); if (!cv || !sc) return;
    sc.addEventListener("scroll", function () { S.scroll = sc.scrollLeft; draw(); });
    cv.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var p = pos(e), h = hit(p.x, p.y); if (!h) return;
      cv.focus({ preventScroll: true }); e.preventDefault();
      if (h.l != null && h.l >= 0) { S.picked = true; root.setTimeout(paintWhat, 0); }   // 2.973.0: a click in a layer picks it for ▶ Layer
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
      if (h.kind === "tpt") { S.tpt = h.p; S.clip = null; S.key = null; S.apt = null; keyEd(); var q0 = TLD.tempo[h.p]; S.drag = { kind: "tpt", p: h.p, x0: p.x, y0: p.y, bpm0: q0.bpm, t0: q0.t, axis: null }; draw(); return; }
      if (h.kind === "tstrip") { S.tpt = null; keyEd(); seek(tAt(p.x)); S.drag = { kind: "ruler" }; return; }
      if (h.kind === "ruler") {
        var mk = markerAt(p.x);
        if (e.shiftKey) { var t0 = snapT(tAt(p.x), TLD.snap); S.drag = { kind: "range", a: t0 }; TLD.loop = TLD.loop || T.cleanLoop(null); TLD.loop.a = t0; TLD.loop.b = t0; draw(); return; }   // 2.960.0
        if (mk >= 0) { seek(TLD.markers[mk].t); return; }   // 2.958.0: a marker = go there
        seek(tAt(p.x)); S.drag = { kind: "ruler" }; return;
      }
      S.sel = h.l; S.tpt = null;
      if (h.kind !== "apt") S.apt = null;
      if (h.kind === "tgroup") { var sp0 = T.span(L(h.l), h.grp); S.clip = { l: h.l, c: h.c }; S.key = null; keyEd(); S.drag = { kind: "tgroup", l: h.l, grp: h.grp, dx: tAt(p.x) - sp0[0], a0: sp0[0] }; heads(); draw(); return; }
      if (h.kind === "take") { var t1 = snapT(tAt(p.x), TLD.snap && !e.shiftKey); S.clip = { l: h.l, c: h.c }; S.key = null; keyEd(); S.drag = { kind: "comp", l: h.l, grp: h.grp, ci: h.c, a: t1, b: t1 }; heads(); draw(); return; }
      if (h.kind === "apt") { S.apt = { l: h.l, p: h.p, k: h.k }; S.key = null; S.clip = null; keyEd(); S.drag = { kind: "apt", l: h.l, p: h.p, k: h.k }; heads(); draw(); return; }
      if (h.kind === "keyA" || h.kind === "keyB") { S.key = { l: h.l, k: h.k }; S.clip = null; S.drag = { kind: h.kind, l: h.l, k: h.k }; keyEd(); }
      else if (h.kind === "clip" || h.kind === "trimA" || h.kind === "trimB" || h.kind === "fadeIn" || h.kind === "fadeOut") {
        var c = L(h.l).clips[h.c]; S.clip = { l: h.l, c: h.c }; S.key = null; keyEd();
        S.drag = { kind: h.kind, l: h.l, c: h.c, dx: tAt(p.x) - c.start };
      } else { S.clip = null; S.key = null; keyEd(); seek(snapT(tAt(p.x), TLD.snap)); }
      heads(); draw();
    });
    cv.addEventListener("pointermove", function (e) {
      var p = pos(e), d = S.drag;
      if (!d) { var h = hit(p.x, p.y); cv.style.cursor = !h ? "default" : h.kind === "trimA" || h.kind === "trimB" || h.kind === "fadeIn" || h.kind === "fadeOut" ? "ew-resize" : h.kind === "clip" ? "grab" : h.kind === "keyA" ? "move" : h.kind === "keyB" ? "ns-resize" : "default"; return; }
      var t = tAt(p.x);
      if (d.kind === "ruler") { seek(t); return; }
      if (d.kind === "range") { var rb = snapT(t, TLD.snap && !e.shiftKey); TLD.loop.a = Math.min(d.a, rb); TLD.loop.b = Math.max(d.a, rb); paintRecBar(); draw(); return; }
      if (d.kind === "tpt") {   // 2.961.0: up / down = its BPM, left / right = when (to the beat; not the first)
        var tq = TLD.tempo[d.p], dx = p.x - d.x0, dy = d.y0 - p.y;
        if (!d.axis && Math.abs(dx) + Math.abs(dy) > 4) d.axis = Math.abs(dy) >= Math.abs(dx) || d.p === 0 ? "y" : "x";
        if (d.axis === "y") tq.bpm = Math.max(20, Math.min(300, Math.round((d.bpm0 + dy * (e.shiftKey ? 0.1 : 0.5)) * 10) / 10));
        if (d.axis === "x") {
          var before = TLD.tempo.slice(0, d.p), lo3 = TLD.tempo[d.p - 1].t + 0.05, hi3 = d.p + 1 < TLD.tempo.length ? TLD.tempo[d.p + 1].t - 0.05 : 3600;
          tq.t = Math.max(lo3, Math.min(hi3, T.snapBeat(before, t, TLD.snap && !e.shiftKey, 1)));
        }
        keyEd(); draw(); msg("♩ " + tq.bpm + " BPM at " + T.fmt(tq.t)); return;
      }
      if (d.kind === "comp") { d.b = snapT(t, TLD.snap && !e.shiftKey); draw(); return; }
      if (d.kind === "tgroup") { var nl = L(d.l), cur = T.span(nl, d.grp)[0]; T.moveGroup(nl, d.grp, snapT(t - d.dx, TLD.snap && !e.shiftKey) - cur); draw(); return; }
      if (d.kind === "apt") {   // 2.959.0: an automation point - when (between its neighbours) and its value
        var pl = L(d.l).auto[d.k], P2 = pl[d.p], tp = laneTop(d.l) + 16, bt = laneTop(d.l) + LH - 5;
        var lo2 = d.p > 0 ? pl[d.p - 1].t + 0.005 : 0, hi2 = d.p + 1 < pl.length ? pl[d.p + 1].t - 0.005 : 3600;
        P2.t = Math.max(lo2, Math.min(hi2, snapT(t, TLD.snap && !e.shiftKey))); P2.v = Math.round(Math.max(0, Math.min(1, (bt - p.y) / (bt - tp))) * 1000) / 1000;
        msg(autoText(d.k, P2.v) + " at " + T.fmt(P2.t)); draw(); return;
      }
      if (d.kind === "keyA" || d.kind === "keyB") {
        var l = L(d.l), K = l.keys[d.k], top = laneTop(d.l) + 16, bot = laneTop(d.l) + LH - 5, v = Math.round(Math.max(0, Math.min(1, (bot - p.y) / (bot - top))) * 100) / 100;
        if (d.kind === "keyA") {
          var lo = d.k > 0 ? l.keys[d.k - 1].t + 0.01 : 0, hiT = d.k + 1 < l.keys.length ? l.keys[d.k + 1].t - 0.01 : 3600;
          K.t = Math.max(lo, Math.min(hiT, snapT(t, TLD.snap && !e.shiftKey))); K.a = v;
        } else K.b = v;
        keyEd(); draw(); return;
      }
      var c = L(d.l).clips[d.c]; if (!c) return;
      if (d.kind === "clip") {
        T.moveClip(c, snapT(t - d.dx, TLD.snap && !e.shiftKey));
        var li = Math.max(0, Math.min(TLD.layers.length - 1, Math.floor((p.y - RULER) / LH)));
        if (li !== d.l) { L(d.l).clips.splice(d.c, 1); L(li).clips.push(c); d.l = li; d.c = L(li).clips.length - 1; S.clip = { l: li, c: d.c }; S.sel = li; heads(); }
      } else if (d.kind === "fadeIn") c.fi = Math.max(0, Math.min(c.len - (c.fo || 0), t - c.start));
      else if (d.kind === "fadeOut") c.fo = Math.max(0, Math.min(c.len - (c.fi || 0), T.clipEnd(c) - t));
      else if (d.kind === "trimA") T.trimStart(c, snapT(t, TLD.snap && !e.shiftKey));
      else T.trimEnd(c, snapT(t, TLD.snap && !e.shiftKey), c.kind ? 3600 : dur[c.src]);
      if (d.kind !== "clip") keyEd();
      draw();
    });
    var up = function () {
      var d = S.drag; S.drag = null;
      if (d && d.kind === "comp") { compApply(d); return; }   // 2.960.0
      if (d && d.kind === "range") { TLD.loop = T.cleanLoop(TLD.loop); paintRecBar(); if (loopLen() >= 0.02) msg("Range " + T.fmt(TLD.loop.a) + " - " + T.fmt(TLD.loop.b) + " - ⟳ Loop plays it round, Punch records only inside it"); changed(); draw(); return; }
      if (d && d.kind !== "ruler") changed();
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("contextmenu", function (e) {   // 2.958.0: right-click a marker = gone
      var p = pos(e);
      if (p.y >= R0 && p.y < RULER) { var hq = hit(p.x, p.y); e.preventDefault(); if (hq && hq.kind === "tpt") delTempo(hq.p); return; }   // 2.961.0
      if (p.y >= RULER) { var ht = hit(p.x, p.y); if (ht && ht.kind === "take") { e.preventDefault(); T.dropTake(L(ht.l), ht.c); S.clip = null; keyEd(); changed(); draw(); msg("Take " + (ht.ti + 1) + " removed"); return; } }   // 2.960.0
      if (p.y >= RULER) { var ha = hit(p.x, p.y); if (ha && ha.kind === "apt") { e.preventDefault(); L(ha.l).auto[ha.k].splice(ha.p, 1); S.apt = null; changed(); heads(); draw(); msg("point removed"); } return; }   // 2.959.0
      var mk = markerAt(p.x); if (mk < 0) return;
      e.preventDefault(); var m = TLD.markers.splice(mk, 1)[0]; changed(); draw(); msg("⚑ " + m.name + " removed");
    });
    cv.addEventListener("dblclick", function (e) {
      var pr = pos(e);
      if (pr.y >= R0 && pr.y < RULER) {   // 2.961.0: a tempo change here (to the beat), at the tempo playing there
        var tm2 = tmap(), tt = T.snapBeat(tm2, tAt(pr.x), TLD.snap, 1), nb = Math.round(T.bpmAt(tm2, tt) * 10) / 10;
        if (TLD.tempo.some(function (q) { return Math.abs(q.t - tt) < 0.02; })) return;
        TLD.tempo.push({ t: tt, bpm: nb, ramp: false }); TLD.tempo = T.cleanTempo(TLD.tempo); S.tpt = TLD.tempo.findIndex(function (q) { return Math.abs(q.t - tt) < 1e-6; });
        keyEd(); changed(); draw(); msg("♩ A tempo change at " + T.fmt(tt) + " - drag it up / down for its BPM, sideways to move it"); return;
      }
      if (pr.y < RULER) {   // 2.958.0: double-click a marker = rename it; the ruler elsewhere = a marker there
        var mk = markerAt(pr.x);
        if (mk < 0) { addMarker(snapT(tAt(pr.x), TLD.snap)); return; }
        if (root.H3SynthFile) root.H3SynthFile.nameDialog({ title: "Rename the marker", value: TLD.markers[mk].name }).then(function (n) { if (!n) return; TLD.markers[mk].name = n.replace(/\.sfx$/i, "").slice(0, 32); changed(); draw(); });
        return;
      }
      var p = pos(e), h = hit(p.x, p.y); if (!h || h.kind === "ruler" || h.kind === "keyA" || h.kind === "keyB" || h.kind === "apt" || h.kind === "take" || h.kind === "tgroup") return;
      if (view(h.l) !== "vol") {   // 2.959.0: a point on the automation lane in view
        var k3 = view(h.l), la = L(h.l); la.auto = la.auto || T.cleanAuto(null);
        var tp3 = laneTop(h.l) + 16, bt3 = laneTop(h.l) + LH - 5, pt = { t: snapT(tAt(p.x), TLD.snap), v: Math.round(Math.max(0, Math.min(1, (bt3 - p.y) / (bt3 - tp3))) * 1000) / 1000 };
        la.auto[k3].push(pt); la.auto[k3].sort(function (a, b) { return a.t - b.t; }); S.apt = { l: h.l, p: la.auto[k3].indexOf(pt), k: k3 }; S.sel = h.l; changed(); heads(); draw();
        msg("● " + autoText(k3, pt.v) + " at " + T.fmt(pt.t) + " - drag it, right-click / Delete removes it"); return;
      }
      if (h.c != null && L(h.l).clips[h.c].kind === "notes") { openRoll(h.l, h.c); return; }
      if (h.c != null && L(h.l).clips[h.c].kind === "steps") { openSteps(h.l, h.c); return; }   // 2.962.0   // 2.957.0: a note clip -> the piano roll
      var l = L(h.l), k = T.addKey(l, snapT(tAt(p.x), TLD.snap), T.end(TLD)); if (k < 0) return;
      S.sel = h.l; S.key = { l: h.l, k: k }; S.clip = null; keyEd(); changed(); heads(); draw();
      msg("◆ a keyframe on " + l.name + " - drag the ◆ for when and its start volume, the ● for its end volume");
    });
    cv.addEventListener("keydown", function (e) {
      var k = e.key.toLowerCase();
      if (k === "delete" || k === "backspace") { e.preventDefault(); e.stopPropagation(); del(); return; }
      if (k === "s" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); split(); return; }          // 2.957.0
      if (k === "d" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); dup(); return; }
      if (k === "m" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); addMarker(); return; }   // 2.958.0
    });
    // 2.955.0 (Tim: "allow user to drag audio from gallery, assets, reference to timeline ask if track goes on the layer it is
    // dragged to or create a new layer"): a source from ＋ Sound, the gallery's / the assets' / the references' sounds (the
    // app's drag), several picked at once, or sound files from the computer - then: this layer or a new one?
    cv.addEventListener("dragover", function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; });
    cv.addEventListener("drop", function (e) {
      e.preventDefault(); e.stopPropagation();
      var p = pos(e), li = Math.max(0, Math.min(TLD.layers.length - 1, Math.floor((p.y - RULER) / LH))), t = snapT(tAt(p.x), TLD.snap);
      var got = dropped(e);
      if (!got.srcs.length && !got.files.length) { msg("Only sounds go on the timeline (audio from the gallery, the assets, the references, ＋ Sound or a file)", true); return; }
      var name = got.srcs.length ? got.srcs[0].replace(/^\w+:/, "") + (got.srcs.length > 1 ? " + " + (got.srcs.length - 1) : "") : got.files[0].name + (got.files.length > 1 ? " + " + (got.files.length - 1) : "");
      ask(e.clientX, e.clientY, li, name, function (where) {
        var place = function (srcs) { srcs.forEach(function (s2, n) { if (s2 === "loop") { if (where === "new") newLayer("The loop").then(function (ni) { addLoop(ni, t); }); else addLoop(li, t); return; }
          if (where === "new") newLayer(s2.replace(/^\w+:/, "").replace(/\.[a-z0-9]+$/i, "")).then(function (ni) { addClip(s2, ni, t); }); else addClip(s2, Math.min(TLD.layers.length - 1, li + n), t); }); };
        if (got.files.length) O.upload(got.files, null).then(function (j) { place(((j && j.added) || []).map(function (x) { return "my:" + x.name; })); });
        place(got.srcs);
      });
    });
    if (root.ResizeObserver) new root.ResizeObserver(function () { draw(); }).observe(sc);
  }
  /** what a drop brings: {srcs: ["out:a.wav", ...], files: [File]} */
  function dropped(e) {
    var dt = e.dataTransfer, srcs = [], files = [];
    var x = dt && dt.getData("text/x-h3snd"); if (x) srcs.push(x);
    var map = function (it) { if (!it || it.kind !== "sound" || !it.name) return null; return it.type === "output" ? "out:" + it.name : it.type === "asset" ? "snd:" + it.name : null; };
    var multi = null; try { multi = JSON.parse((dt && dt.getData("text/h3multi")) || "null"); } catch (er) { multi = null; }
    if (Array.isArray(multi)) multi.forEach(function (it) { var s2 = map(it); if (s2) srcs.push(s2); });
    var dp = null; try { dp = typeof dragPayload !== "undefined" ? dragPayload : null; } catch (er) { dp = null; }   // the app's own drags (index.html)
    if (!srcs.length && dp) { var s3 = map(dp); if (s3) srcs.push(s3); }
    if (!srcs.length && dt && dt.files && dt.files.length) [].forEach.call(dt.files, function (f) { if (/^audio\//.test(f.type) || /\.(wav|mp3|flac|ogg|oga|m4a|aac|opus|wma|aif|aiff|webm)$/i.test(f.name)) files.push(f); });
    return { srcs: srcs.filter(function (s4) { return s4 === "loop" || T.okSrc(s4); }), files: files };
  }
  /** this layer or a new one? - a small box where it was dropped */
  function ask(cx, cy, li, name, done) {
    var old = $("syTAsk"); if (old) old.remove();
    var box = doc.createElement("div"), host = $("syTL"), hr = host.getBoundingClientRect();
    box.id = "syTAsk"; box.className = "sytlask"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Where does it go?");
    box.style.left = Math.max(4, Math.min(hr.width - 250, cx - hr.left - 20)) + "px"; box.style.top = Math.max(4, cy - hr.top - 10) + "px";
    var esc2 = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    box.innerHTML = "<div>Put <b>" + esc2(name) + "</b> on…</div><div class=\"row\"><button type=\"button\" data-w=\"here\" class=\"sydk\">" + esc2(L(li).name) + " (here)</button>"
      + "<button type=\"button\" data-w=\"new\" class=\"sydk\">＋ A new layer</button><button type=\"button\" data-w=\"\" class=\"sydk\" title=\"Cancel\">✕</button></div>";
    if (TLD.layers.length >= T.MAXL) box.querySelector('[data-w="new"]').disabled = true;
    box.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; box.remove(); if (b.dataset.w) done(b.dataset.w); });
    box.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") box.remove(); });
    host.appendChild(box); var f = box.querySelector("button"); if (f) f.focus();
  }
  /** a new layer at the bottom -> its index (a promise, so it chains like addClip) */
  function newLayer(name) {
    if (TLD.layers.length >= T.MAXL) { msg("16 layers at most", true); return Promise.reject(new Error("16 layers at most")); }
    var l = T.newLayer(TLD.layers.length); if (name) l.name = String(name).replace(/[<>]/g, "").slice(0, 32);
    TLD.layers.push(l); S.sel = TLD.layers.length - 1; changed(); heads(); draw();
    return Promise.resolve(TLD.layers.length - 1);
  }
  /** → 🎞: a sound on a new layer of its own at the playhead */
  function addNewLayer(src, name, t) { return newLayer(name).then(function (li) { return addClip(src, li, t == null ? S.ph : t); }).catch(function () { return null; }); }
  /** ✂ the picked clip at the playhead (or every clip of the picked layer under it) */
  function split() {
    var sc = S.clip && L(S.clip.l).clips[S.clip.c];
    if (sc && sc.kind === "steps") { msg("▦ A step clip is not split - drag its right edge to make it shorter", true); return false; }
    if (sc && sc.grp) { msg("Takes are cut by comping - ▤ Flatten the comp first to split it", true); return false; }
    var targets = S.clip ? [S.clip] : L(S.sel).clips.map(function (c, i) { return { l: S.sel, c: i }; }).filter(function (q) { var c = L(q.l).clips[q.c]; return S.ph > c.start && S.ph < T.clipEnd(c); });
    var n = 0;
    targets = targets.filter(function (q) { var cq = L(q.l).clips[q.c]; return !cq.grp && cq.kind !== "steps"; });
    targets.sort(function (a, b) { return b.c - a.c; }).forEach(function (q) { var l = L(q.l), parts = T.splitClip(l.clips[q.c], S.ph); if (parts) { l.clips.splice(q.c, 1, parts[0], parts[1]); n++; S.clip = { l: q.l, c: q.c + 1 }; } });
    if (!n) { msg("✂ Put the playhead inside a clip (click the ruler), pick the clip, then ✂ Split (S)", true); return false; }
    keyEd(); changed(); draw(); msg("✂ split at " + T.fmt(S.ph)); return true;
  }
  function dup() {
    if (!S.clip) { msg("Pick a clip first", true); return false; }
    if (L(S.clip.l).clips[S.clip.c].grp) { msg("▤ Flatten the comp first to copy it", true); return false; }
    var l = L(S.clip.l), d = T.dupClip(l.clips[S.clip.c]); l.clips.push(d); S.clip = { l: S.clip.l, c: l.clips.length - 1 };
    keyEd(); changed(); draw(); msg("⧉ a copy at " + T.fmt(d.start)); return true;
  }
  /** 2.957.0: a note clip -> layer li (null = a new layer named `name`) at t; notes [{m, t, d, v}] from the clip's start */
  function addNotes(notes, name, patch, li, t, len) {
    var ns = T.cleanNotes(notes), end = ns.reduce(function (a, n) { return Math.max(a, n.t + n.d); }, 0);
    var c = { kind: "notes", name: name || "Notes", start: snapT(t == null ? S.ph : t, TLD.snap), off: 0, len: Math.max(len || 0, end, 60 / bpm() * 4), notes: ns, patch: patch || (O.patch ? O.patch() : null), gain: 1, fi: 0, fo: 0 };
    var put = function (i) { L(i).clips.push(c); S.sel = i; S.clip = { l: i, c: L(i).clips.length - 1 }; S.key = null; keyEd(); changed(); heads(); draw(); return c; };
    if (li == null) return newLayer(name).then(put); return Promise.resolve(put(Math.max(0, Math.min(TLD.layers.length - 1, li))));
  }
  /** ＋ ▦ Steps (2.962.0): a step clip of one bar at the playhead on the picked layer -> the step sequencer */
  function addSteps(li, t) {
    li = li == null ? S.sel : li; var l = L(li); if (!l) return null;
    if (l.clips.length >= 200) { msg("200 clips a layer at most", true); return null; }
    var st = snapT(t == null ? S.ph : t, TLD.snap), tm = tmap(), len = T.timeAt(tm, T.beatAt(tm, st) + 4) - st, c = T.newSteps(st, Math.round(len * 1e6) / 1e6);
    l.clips.push(c); S.sel = li; S.clip = { l: li, c: l.clips.length - 1 }; keyEd(); changed(); heads(); draw(); openSteps(li, l.clips.length - 1);
    msg("▦ A step clip - click the cells; drag its right edge to repeat the pattern longer"); return c;
  }
  function stepSounds() {
    var out = (C.KIT || []).map(function (k) { return ["kit:" + k[0], "🥁 " + k[1]]; });
    sources.forEach(function (g) { if (g.id === "my" || g.id === "sfx") g.items.slice(0, 200).forEach(function (it) { out.push([g.id + ":" + it.name, (g.id === "my" ? "🎙 " : "💥 ") + it.name]); }); });
    return out;
  }
  function openSteps(li, ci) {
    var c = L(li) && L(li).clips[ci]; if (!c || c.kind !== "steps" || !root.H3SynthSteps) return false;
    return root.H3SynthSteps.open(c, { color: hue(li), sounds: stepSounds(), changed: function () { changed(); draw(); },
      play: function () { if (S.playing) stop(); S.ph = c.start; play(); },
      // 2.992.0 🥁 Drumify: the clock, the tempo, what it can read (note clips, sound clips) and how to load a sound
      ctx: function () { return O.ctx(); }, dest: function () { return O.dest(); }, tmap: function () { return tmap(); }, load: load,
      noteClips: function () { return grooveClips("notes"); }, audioClips: function () { return grooveClips("audio"); } });
  }
  /** 2.992.0: the timeline's note clips / sound clips for 🥁 Drumify ({label, clip} | {label, src, start, off, len}) */
  function grooveClips(kind) {
    var out = [];
    TLD.layers.forEach(function (l, li) {
      l.clips.forEach(function (c) {
        if (kind === "notes" ? c.kind !== "notes" : c.kind) return;
        var label = l.name + " · " + c.name + " @ " + T.fmt(c.start);
        out.push(kind === "notes" ? { label: label, clip: c } : { label: label, src: c.src, start: c.start, off: c.off || 0, len: c.len });
      });
    });
    return out.slice(0, 200);
  }
  function openRoll(li, ci) {
    var l = L(li), c = l && l.clips[ci]; if (!c || c.kind !== "notes" || !root.H3SynthRoll) return false;
    S.sel = li; S.clip = { l: li, c: ci }; keyEd(); heads(); draw();
    root.H3SynthRoll.open(c, { bpm: T.bpmAt(tmap(), c.start), color: hue(li), changed: function () { c.len = Math.max(c.len, c.notes.reduce(function (a, n) { return Math.max(a, n.t + n.d); }, 0)); changed(); draw(); keyEd(); },
      play: function (m, v) { if (O.preview) O.preview(m, v, c.patch); } });
    return true;
  }
  function view(i) { return S.view[i] || "vol"; }
  /* ---------------- 2.960.0: takes + comping, the loop / punch range, ● Rec ---------------- */
  var TH = 12;   // a take group's top strip (its name; drag it to move the group)
  function takeGeo(l, i, grp) {
    var ids = T.groups(l)[grp] || [], Y = laneTop(i) + 3, H = LH - 7, rh = (H - TH) / Math.max(1, ids.length);
    return { ids: ids, Y: Y, H: H, rh: rh, row: function (ci) { return Y + TH + ids.indexOf(ci) * rh; } };
  }
  function drawTakes(x, w, l, i) {
    var gs = T.groups(l), col = hue(i), dim = !T.audible(TLD, i);
    Object.keys(gs).forEach(function (k) {
      var sp = T.span(l, k), G = takeGeo(l, i, k), X0 = px(sp[0]), W = (sp[1] - sp[0]) * TLD.zoom; if (X0 > w || X0 + W < 0) return;
      var segs = (l.comps && l.comps[k]) || [], def = T.newest(l, k), sel = S.clip && S.clip.l === i && l.clips[S.clip.c] && l.clips[S.clip.c].grp === k;
      x.save(); x.globalAlpha = dim ? 0.45 : 1;
      rr(x, X0, G.Y, W, G.H, 5); x.fillStyle = col; x.globalAlpha *= 0.1; x.fill(); x.globalAlpha = dim ? 0.45 : 1;
      x.lineWidth = sel ? 2 : 1; x.strokeStyle = sel ? "#f4f1e8" : col; x.stroke();
      x.save(); rr(x, X0, G.Y, W, G.H, 5); x.clip();
      x.fillStyle = col; x.globalAlpha = (dim ? 0.45 : 1) * 0.35; x.fillRect(X0, G.Y, W, TH);
      G.ids.forEach(function (ci) {
        var c = l.clips[ci], cx = px(c.start), cw = c.len * TLD.zoom, y = G.row(ci), rh = G.rh, p = peaks[c.src];
        x.globalAlpha = dim ? 0.45 : 1; x.fillStyle = "#07090c"; x.fillRect(cx, y, cw, 1);
        T.ranges(segs, c.ti, c.start, T.clipEnd(c), def).forEach(function (r) { x.fillStyle = col; x.globalAlpha = (dim ? 0.45 : 1) * 0.3; x.fillRect(px(r[0]), y + 1, (r[1] - r[0]) * TLD.zoom, rh - 1); });
        if (p) {
          var mid = y + rh / 2 + 0.5, amp = Math.max(1, rh / 2 - 1.5), a = Math.max(0, Math.floor(-cx)), bEnd = Math.min(cw, w - cx);
          for (var q = a; q < bEnd; q++) {
            var tt = c.start + q / TLD.zoom, ts = c.off + q / TLD.zoom, te = c.off + (q + 1) / TLD.zoom, ia = Math.floor(ts * 100), ib = Math.max(ia + 1, Math.floor(te * 100)), lo = 0, hi = 0;
            for (var z = ia; z < ib && z * 2 + 1 < p.length; z++) { if (p[z * 2] < lo) lo = p[z * 2]; if (p[z * 2 + 1] > hi) hi = p[z * 2 + 1]; }
            if (hi - lo <= 0.002) continue;
            x.fillStyle = col; x.globalAlpha = (dim ? 0.45 : 1) * (T.compAt(segs, tt, def) === c.ti ? 0.95 : 0.25);
            x.fillRect(cx + q, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp));
          }
        }
        x.globalAlpha = 0.8; x.fillStyle = "#e9eef6"; x.font = "600 8.5px system-ui, sans-serif"; x.textAlign = "left";
        if (rh >= 9) x.fillText(String(c.ti + 1), Math.max(cx, 0) + 3, y + Math.min(rh - 2, 9));
      });
      var cd = S.drag && S.drag.kind === "comp" && S.drag.l === i && S.drag.grp === k ? S.drag : null;
      if (cd) { var ry = G.row(cd.ci); x.globalAlpha = 0.5; x.fillStyle = "#f4f1e8"; x.fillRect(px(Math.min(cd.a, cd.b)), ry, Math.max(2, Math.abs(cd.b - cd.a) * TLD.zoom), G.rh); }
      x.restore();
      x.fillStyle = "#e9eef6"; x.font = "600 10px system-ui, sans-serif"; x.textAlign = "left"; x.globalAlpha = dim ? 0.45 : 1;
      x.save(); rr(x, X0, G.Y, W, G.H, 5); x.clip(); x.fillText("⧉ Takes · " + G.ids.length + "  (drag across a take = comp it in)", Math.max(X0, 0) + 8, G.Y + 9.5); x.restore();
      x.restore();
    });
  }
  function drawLoop(x, w, h) {
    var lp = TLD.loop; if (!lp || lp.b - lp.a < 0.02) return;
    var a = px(lp.a), b = px(lp.b), col = lp.on ? "#5dff8a" : lp.punch ? "#ff5a5a" : "#6c7688";
    x.save(); x.fillStyle = col; x.globalAlpha = lp.on || lp.punch ? 0.32 : 0.18; x.fillRect(a, 0, b - a, R0);
    x.globalAlpha = lp.on || lp.punch ? 0.06 : 0.03; x.fillRect(a, RULER, b - a, h - RULER);
    x.globalAlpha = 1; x.fillRect(a, 0, 2, R0); x.fillRect(b - 2, 0, 2, R0);
    x.font = "700 9px system-ui, sans-serif"; x.textAlign = "left"; if (b - a > 40) x.fillText(lp.on ? "⟳ LOOP" : lp.punch ? "PUNCH" : "range", a + 5, R0 - 4);
    x.restore();
  }
  /** which take group / take row is under (mx, my) on layer i -> hit or null */
  function hitTakes(l, i, mx, my) {
    var gs = T.groups(l), out = null;
    Object.keys(gs).forEach(function (k) {
      if (out) return;
      var sp = T.span(l, k); if (mx < px(sp[0]) || mx > px(sp[1])) return;
      var G = takeGeo(l, i, k);
      if (my < G.Y + TH) { out = { kind: "tgroup", l: i, grp: k, c: G.ids[0] }; return; }
      var r = Math.max(0, Math.min(G.ids.length - 1, Math.floor((my - G.Y - TH) / G.rh))), ci = G.ids[r], c = l.clips[ci];
      out = { kind: "take", l: i, grp: k, c: ci, ti: c.ti, inTake: mx >= px(c.start) && mx <= px(T.clipEnd(c)) };
    });
    return out;
  }
  function compApply(d) {
    var l = L(d.l), c = l.clips[d.ci]; if (!c) return;
    var sp = T.span(l, d.grp), a = Math.min(d.a, d.b), b = Math.max(d.a, d.b);
    if (b - a < 0.02) { a = c.start; b = T.clipEnd(c); }   // a click = the whole take
    a = Math.max(a, c.start); b = Math.min(b, T.clipEnd(c)); if (b - a < 0.005 || !sp) return;
    l.comps = l.comps || {}; l.comps[d.grp] = T.comp(l.comps[d.grp], a, b, c.ti, T.newest(l, d.grp));
    changed(); draw(); msg("⧉ Take " + (c.ti + 1) + " plays " + T.fmt(a) + " - " + T.fmt(b));
  }
  function flattenSel() {
    var c = S.clip && L(S.clip.l).clips[S.clip.c]; if (!c || !c.grp) { msg("Pick a take group first", true); return 0; }
    var n = T.flatten(L(S.clip.l), c.grp); S.clip = null; keyEd(); changed(); draw(); msg("▤ The comp is now " + n + " plain clip" + (n === 1 ? "" : "s")); return n;
  }
  function loopLen() { var lp = TLD.loop; return lp ? lp.b - lp.a : 0; }
  function setLoop(o) { TLD.loop = T.cleanLoop(Object.assign({}, TLD.loop, o)); paintRecBar(); changed(); draw(); }
  function toggleLoop(k) {
    var lp = TLD.loop || T.cleanLoop(null);
    if (lp.b - lp.a < 0.02) { var tm3 = tmap(), b0 = Math.floor(T.beatAt(tm3, S.ph) / 4 + 1e-9) * 4, a = T.timeAt(tm3, b0); lp = { on: false, punch: false, a: a, b: T.timeAt(tm3, b0 + 8) }; TLD.loop = T.cleanLoop(lp); }
    var o = {}; o[k] = !TLD.loop[k]; if (k === "on" && o.on) o.punch = false; if (k === "punch" && o.punch) o.on = false;
    setLoop(o); msg(k === "on" ? (TLD.loop.on ? "⟳ Loop " + T.fmt(TLD.loop.a) + " - " + T.fmt(TLD.loop.b) + " (Shift+drag the ruler to change it)" : "⟳ Loop off") : (TLD.loop.punch ? "Punch: ● Rec keeps only " + T.fmt(TLD.loop.a) + " - " + T.fmt(TLD.loop.b) : "Punch off"));
  }
  function paintRecBar() {
    var lp = TLD.loop || {}, b1 = $("syTLoop"), b2 = $("syTPunch"), b3 = $("syTRec");
    if (b1) { b1.classList.toggle("on", !!lp.on); b1.setAttribute("aria-pressed", lp.on ? "true" : "false"); }
    if (b2) { b2.classList.toggle("on", !!lp.punch); b2.setAttribute("aria-pressed", lp.punch ? "true" : "false"); }
    if (b3) { b3.classList.toggle("on", !!S.rec); b3.setAttribute("aria-pressed", S.rec ? "true" : "false"); b3.textContent = S.rec ? "■ Stop rec" : "● Rec"; }
  }
  /** what ● Rec records: keys (the synth), loop (the looper + pads), both, mic -> Promise<{node, done()}> */
  function recInput(kind, ctx) {
    var inp = ctx.createGain(); inp.channelCount = 2; inp.channelCountMode = "explicit"; inp.channelInterpretation = "speakers";
    var from = [], stream = null;
    var add = function (n) { if (n) { n.connect(inp); from.push(n); } };
    var done = function () { from.forEach(function (n) { try { n.disconnect(inp); } catch (e) { /* gone */ } }); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); };
    if (kind === "mic") {
      var md = root.navigator && root.navigator.mediaDevices; if (!md || !md.getUserMedia) return Promise.reject(new Error("no microphone here"));
      return md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (st) { stream = st; add(ctx.createMediaStreamSource(st)); return { node: inp, done: done }; });
    }
    if (kind !== "loop" && O.keysOut) add(O.keysOut());
    if (kind !== "keys" && O.loopOut) add(O.loopOut());
    return Promise.resolve({ node: inp, done: done });
  }
  function armed() { return S.arm != null && L(S.arm) ? S.arm : null; }
  function startRec() {
    if (S.rec) return endRec();
    var li = armed(); if (li == null) { S.arm = S.sel; li = S.sel; heads(); }
    var ctx = O.ctx(), kind = (($("syTIn") || {}).value) || "keys", lp = TLD.loop || {};
    if (S.playing) stop();
    return recInput(kind, ctx).then(function (inp) {
      var r = root.H3SynthRec.create(ctx, inp.node, { clock: true }); r.start();
      S.rec = { r: r, inp: inp, layer: li, loop: !!lp.on, punch: !!lp.punch, a: lp.a, b: lp.b, passes: [], from: null, at: null, kind: kind, t: Date.now() };
      if (lp.on) S.ph = lp.a;
      paintRecBar(); heads();
      msg("● Recording " + ({ keys: "the keyboard", loop: "the looper + pads", both: "the keyboard + looper", mic: "the microphone" }[kind] || kind) + " onto " + L(li).name + (lp.on ? " - every pass of the loop is a take" : lp.punch ? " (punch " + T.fmt(lp.a) + " - " + T.fmt(lp.b) + ")" : "") + " - ■ to stop");
      var go = function () { if (S.rec) play(); };
      if (O.countIn) O.countIn(go); else go();
      return true;
    }).catch(function (e) { S.rec = null; paintRecBar(); msg("● " + (e.message || String(e)), true); return false; });
  }
  /** ■ while recording: the recording -> takes (WAVs in My samples) on the armed layer */
  function endRec() {
    var R = S.rec; if (!R) return Promise.resolve(null);
    S.rec = null; if (S.playing) stop(); paintRecBar();
    var got = R.r.stop(); R.inp.done();
    if (!got || R.at == null) { msg("● Nothing recorded", true); return Promise.resolve(null); }
    var ctx = O.ctx(), lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0), sr = got.sampleRate, n = got.chans[0].length, takes = [];
    S.lastRec = { t0: got.t0, at: R.at, from: R.from, passes: R.passes.slice(), lat: lat, n: n, sr: sr, moved: got.moved || 0 };
    var cut = function (i0, i1) { return got.chans.map(function (ch) { return ch.slice(i0, i1); }); };
    if (R.loop) {
      T.passRanges(n, sr, got.t0, R.passes.map(function (p) { return p + lat; }), R.b - R.a).forEach(function (pr) { takes.push({ chans: cut(pr.i0, pr.i1), start: R.a + pr.lead }); });
    } else {
      var i0 = Math.max(0, Math.round((R.at + lat - got.t0) * sr)), secs = (n - i0) / sr;
      if (R.punch) { var pc = T.punchCut(R.from, secs, R.a, R.b); if (pc) takes.push({ chans: cut(i0 + Math.round(pc.skip * sr), i0 + Math.round((pc.skip + pc.len) * sr)), start: pc.start }); }
      else if (secs >= 0.05) takes.push({ chans: cut(i0, n), start: R.from });
    }
    takes = takes.filter(function (t) { return t.chans[0].length >= 0.05 * sr; });
    if (!takes.length) { msg("● Nothing recorded" + (R.punch ? " inside the punch range" : ""), true); return Promise.resolve(null); }
    var l = L(R.layer), stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "-"), base = "take " + l.name.replace(/[^\w\- ]+/g, "") + " " + stamp;
    var files = takes.map(function (t, k) { return new root.File([C.wav(t.chans, sr)], base + (takes.length > 1 ? " " + (k + 1) : "") + ".wav", { type: "audio/wav" }); });
    msg("● Saving " + takes.length + " take" + (takes.length > 1 ? "s" : "") + "…");
    return O.upload(files, null).then(function (j) {
      var add = (j && j.added) || []; if (add.length !== takes.length) throw new Error("the takes could not be saved");
      var list = takes.map(function (t, k) { var src = "my:" + add[k].name; dur[src] = t.chans[0].length / sr; peaks[src] = T.peaks(t.chans[0], sr, 100); return { src: src, name: add[k].name.replace(/\.wav$/i, ""), start: Math.round(t.start * 10000) / 10000, len: t.chans[0].length / sr }; });
      var res = T.addTakes(l, list);
      if (res.full) msg("Some takes did not fit (32 a group, 200 clips a layer)", true);
      if (res.added.length) S.clip = { l: R.layer, c: res.added[res.added.length - 1] };
      if (root.H3SynthLoop && O.refresh) O.refresh();
      keyEd(); changed(); heads(); draw();
      msg("● " + res.added.length + " take" + (res.added.length === 1 ? "" : "s") + " on " + l.name + (res.grp ? " - the newest plays; drag across another take to comp it in" : ""));
      return res;
    }).catch(function (e) { msg(e.message || String(e), true); return null; });
  }
  function autoText(k, v) { var x = T.autoVal(k, v); return k === "pan" ? (Math.abs(x) < 0.02 ? "Pan C" : "Pan " + (x < 0 ? "L" : "R") + Math.round(Math.abs(x) * 100)) : k === "cut" ? "Filter " + (x >= 1000 ? (x / 1000).toFixed(1) + " kHz" : Math.round(x) + " Hz") : "Rev " + Math.round(x * 100) + "%"; }
  /** ⤓ (2.959.0): layer i rendered alone (its effects, lanes, keyframes) -> a sample -> a new layer from 0; layer i muted */
  function bounce(i) {
    var l = L(i); if (!l || !l.clips.length) { msg("Nothing on that layer to bounce", true); return Promise.resolve(null); }
    if (TLD.layers.length >= T.MAXL) { msg("16 layers at most", true); return Promise.resolve(null); }
    msg("⤓ Bouncing " + l.name + "…");
    var name = "bounce " + l.name.replace(/[^\w\- ]+/g, "") + " " + new Date().toTimeString().slice(0, 8).replace(/:/g, "-") + ".wav";
    return render(48000, i).then(function (r) { return O.upload([new root.File([C.wav(r.chans, r.sampleRate)], name, { type: "audio/wav" })], null); })
      .then(function (j) { var got = j && j.added && j.added[0]; if (!got) throw new Error("the bounce could not be saved"); return addNewLayer("my:" + got.name, l.name + " (bounced)", 0); })
      .then(function (c) { if (c) { l.mute = true; liveMix(); changed(); heads(); draw(); msg("⤓ " + l.name + " bounced to a new layer (the original is muted - unmute it to go back)"); } return c; })
      .catch(function (e) { msg(e.message || String(e), true); return null; });
  }
  /** 2.965.0 (🎤 row): layer i rendered DRY - alone, unmuted, at 100% centre with no effects or lanes (its clips, fades and
   *  keyframes kept) - for ✂ separating and 🎤 singing; everything put back as it was */
  function renderDry(i) {
    var l = L(i); if (!l || !l.clips.length) return Promise.reject(new Error("Nothing on that layer - pick a layer with a song or a vocal on it"));
    var keep = TLD.layers.map(function (q) { return { mute: q.mute, solo: q.solo }; }), mine = { vol: l.vol, pan: l.pan, fx: l.fx, auto: l.auto };
    TLD.layers.forEach(function (q) { q.solo = false; }); l.mute = false; l.vol = 1; l.pan = 0; l.fx = T.cleanFx(null); l.auto = T.cleanAuto(null);
    var back = function () { TLD.layers.forEach(function (q, k) { if (keep[k]) { q.mute = keep[k].mute; q.solo = keep[k].solo; } }); l.vol = mine.vol; l.pan = mine.pan; l.fx = mine.fx; l.auto = mine.auto; };
    var p; try { p = render(48000, i); } catch (e) { back(); return Promise.reject(e); }
    return p.then(function (r) { back(); return r; }, function (e) { back(); throw e; });
  }
  /** 2.967.0 (🎤 ⧉ Mix): the layers in `list` rendered together AS THEY SIT in the mix (their Vol, Pan, effects and lanes),
   *  each heard even when muted or another layer is solo; mute / solo put back after */
  function renderMix(list) {
    list = [].concat(list).filter(function (i) { return L(i) && L(i).clips.length; });
    if (!list.length) return Promise.reject(new Error("Nothing to mix on those layers"));
    var keep = TLD.layers.map(function (q) { return { mute: q.mute, solo: q.solo }; });
    TLD.layers.forEach(function (q, k) { q.solo = false; if (list.indexOf(k) >= 0) q.mute = false; });
    var back = function () { TLD.layers.forEach(function (q, k) { if (keep[k]) { q.mute = keep[k].mute; q.solo = keep[k].solo; } }); };
    var p; try { p = render(48000, list); } catch (e) { back(); return Promise.reject(e); }
    return p.then(function (r) { back(); return r; }, function (e) { back(); throw e; });
  }
  /** 2.965.0: a layer's name / mute / role from outside (the 🎤 row) */
  function patchLayer(i, o) {
    var l = L(i); if (!l || !o) return null;
    if (o.name != null) l.name = String(o.name).replace(/[<>]/g, "").slice(0, 32) || l.name;
    if (o.mute != null) l.mute = !!o.mute;
    if (o.role !== undefined) { if (o.role) l.role = o.role; else delete l.role; }
    liveMix(); changed(); heads(); draw(); return l;
  }
  function delTempo(i) {
    if (!(i > 0) || !TLD.tempo[i]) { msg("The first tempo stays - change its BPM instead", true); return false; }
    TLD.tempo.splice(i, 1); TLD.tempo = T.cleanTempo(TLD.tempo); S.tpt = null; keyEd(); changed(); draw(); msg("♩ tempo change removed"); return true;
  }
  /** ♩ Tempo: the tempo strip under the ruler (its first tempo = the looper's BPM) */
  function toggleTempo(on) {
    TLD.tempoOn = on == null ? !TLD.tempoOn : !!on;
    if (TLD.tempoOn && !TLD.tempo.length) TLD.tempo = [{ t: 0, bpm: bpm(), ramp: false }];
    if (!TLD.tempoOn) S.tpt = null;
    layout(); paintTempoBtn(); keyEd(); heads(); changed(); draw();
    msg(TLD.tempoOn ? "♩ The tempo track: double-click its strip for a tempo change; the grid, ⌗ snap and 🕒 click follow it" : "♩ Tempo track off - the looper's BPM again");
  }
  function paintTempoBtn() { var b = $("syTTempo"); if (b) { b.classList.toggle("on", !!TLD.tempoOn); b.setAttribute("aria-pressed", TLD.tempoOn ? "true" : "false"); } }
  function drawTempo(x, w) {
    var mp = TLD.tempo, lo = Infinity, hi = -Infinity; mp.forEach(function (q) { lo = Math.min(lo, q.bpm); hi = Math.max(hi, q.bpm); });
    lo -= 10; hi += 10; var top = R0 + 3, bot = RULER - 3, Y = function (v) { return bot - (bot - top) * (v - lo) / (hi - lo); };
    x.save(); x.fillStyle = "#0e1117"; x.fillRect(0, R0, w, TS); x.fillStyle = "#262b35"; x.fillRect(0, RULER - 1, w, 1);
    x.strokeStyle = "#ffae3a"; x.lineWidth = 1.5; x.beginPath();
    mp.forEach(function (q, j) {
      var nx = j + 1 < mp.length ? mp[j + 1] : null, x0 = px(q.t), x1 = nx ? px(nx.t) : w + 10;
      if (j === 0) x.moveTo(x0, Y(q.bpm)); else x.lineTo(x0, Y(q.bpm));
      x.lineTo(x1, Y(q.ramp && nx ? nx.bpm : q.bpm));
    });
    x.stroke();
    x.font = "600 9px system-ui, sans-serif"; x.textAlign = "left";
    mp.forEach(function (q, j) {
      var qx = px(q.t); if (qx < -60 || qx > w) return;
      x.fillStyle = S.tpt === j ? "#f4f1e8" : "#ffae3a"; x.fillRect(qx - 3, Y(q.bpm) - 3, 6, 6);
      x.fillStyle = "#ffcf8a"; x.fillText((q.ramp ? "↗" : "") + (Math.round(q.bpm * 10) / 10), qx + 5, R0 + 10);
    });
    x.restore();
  }
  function del() {
    if (S.tpt != null) return delTempo(S.tpt);
    if (S.apt) { var la = L(S.apt.l); if (la && la.auto && la.auto[S.apt.k]) la.auto[S.apt.k].splice(S.apt.p, 1); S.apt = null; changed(); heads(); draw(); msg("point removed"); return true; }
    if (S.key) { var l = L(S.key.l); l.keys.splice(S.key.k, 1); S.key = null; keyEd(); changed(); draw(); msg("◆ keyframe removed"); return true; }
    if (S.clip) { var lc = L(S.clip.l), cc = lc.clips[S.clip.c], tk = cc && cc.grp; T.dropTake(lc, S.clip.c); S.clip = null; keyEd(); changed(); draw(); msg(tk ? "Take " + (cc.ti + 1) + " removed" : "Clip removed"); return true; }
    return false;
  }
  /* the picked keyframe: its start and end volume as knobs */
  /** 2.957.0: the picked clip: its gain and fades as knobs, ✂ split at the playhead, ⧉ duplicate, 🎹 piano roll, 🗑 */
  function clipEd(box) {
    var l = L(S.clip.l), c = l && l.clips[S.clip.c]; if (!c) { box.classList.remove("on"); return; }
    if (c.grp) {   // 2.960.0: a take - its group, which plays, flatten
      var tg = T.groups(l)[c.grp] || [], hb = doc.createElement("b"); hb.style.color = hue(S.clip.l); hb.textContent = "⧉ Take " + (c.ti + 1) + " of " + tg.length + " · " + T.fmt(T.span(l, c.grp)[0]) + " - " + T.fmt(T.span(l, c.grp)[1]); box.appendChild(hb);
      var hint = doc.createElement("span"); hint.className = "sytlhint"; hint.style.marginLeft = "6px"; hint.textContent = "Drag across a take to play it there · click a take = all of it · right-click / Delete = remove it"; box.appendChild(hint);
      var mk2 = function (t, title, f, id) { var x2 = doc.createElement("button"); x2.type = "button"; x2.className = "ghost"; x2.textContent = t; x2.title = title; x2.onclick = f; if (id) x2.id = id; box.appendChild(x2); };
      mk2("▶ Solo take", "This take plays all through (its whole length)", function () { compApply({ l: S.clip.l, grp: c.grp, ci: S.clip.c, a: 0, b: 0 }); }, "syTTakeAll");
      mk2("▤ Flatten", "The comp becomes plain clips (exactly what plays) - the other takes are gone", flattenSel, "syTFlat");
      mk2("🗑", "Remove this take (Delete)", del);
      return;
    }
    var col = hue(S.clip.l), b = doc.createElement("b"); b.style.color = col; b.textContent = (c.kind === "notes" ? "♪ " : c.kind === "steps" ? "▦ " : "") + c.name + " · " + T.fmt(c.start) + " - " + T.fmt(T.clipEnd(c)); box.appendChild(b);
    var kn = function (label, key, max, def, txt) {
      var k = KN.knob({ label: label, size: 30, color: col, def: def / max, get: function () { return (c[key] == null ? def : c[key]) / max; }, set: function (n) { c[key] = Math.round(n * max * 1000) / 1000; if (key === "fi") c.fi = Math.min(c.fi, c.len - (c.fo || 0)); if (key === "fo") c.fo = Math.min(c.fo, c.len - (c.fi || 0)); changed(); draw(); }, text: txt });
      k.el.dataset.clip = key; box.appendChild(k.el);
    };
    kn("Gain", "gain", 2, 1, function () { var g = c.gain == null ? 1 : c.gain; return g <= 0 ? "-∞ dB" : (20 * Math.log10(g) >= 0 ? "+" : "") + (20 * Math.log10(g)).toFixed(1) + " dB"; });
    kn("Fade in", "fi", Math.max(0.05, c.len), 0, function () { return Math.round((c.fi || 0) * 1000) + " ms"; });
    kn("Fade out", "fo", Math.max(0.05, c.len), 0, function () { return Math.round((c.fo || 0) * 1000) + " ms"; });
    var btn = function (t, title, f, id) { var x = doc.createElement("button"); x.type = "button"; x.className = "ghost"; x.textContent = t; x.title = title; x.onclick = f; if (id) x.id = id; box.appendChild(x); };
    btn("✂ Split", "Cut it at the playhead (S)", split, "syTSplit"); btn("⧉ Duplicate", "A copy right after it (Ctrl+D)", dup, "syTDup");
    if (c.kind === "steps") btn("▦ Steps", "Edit its pattern (or double-click the clip)", function () { openSteps(S.clip.l, S.clip.c); }, "syTStepBtn");
    if (c.kind === "notes") btn("🎹 Piano roll", "Edit its notes (or double-click the clip)", function () { openRoll(S.clip.l, S.clip.c); }, "syTRollBtn");
    btn("🗑", "Remove it (Delete)", del);
  }
  /** 2.963.0: nothing picked on it = the picked layer: its name (rename it here) and Vol / Pan / Filter */
  function layerEd(box) {
    var li = S.sel, l = L(li); if (!l) return;
    var col = hue(li), inp = doc.createElement("input"); inp.className = "sytlname"; inp.id = "syTLName"; inp.maxLength = 32; inp.value = l.name; inp.style.color = col;
    inp.title = "This layer's name - type a new one"; inp.setAttribute("aria-label", "Layer name");
    inp.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") inp.blur(); });
    inp.onchange = function () { l.name = inp.value.replace(/[<>]/g, "").trim().slice(0, 32) || "Layer " + (li + 1); inp.value = l.name; changed(); heads(); draw(); };
    box.appendChild(inp);
    var kn = function (label, key, k) { k.el.dataset.lay = key; k.el.setAttribute("aria-label", l.name + " " + label); box.appendChild(k.el); };
    kn("volume", "vol", KN.knob({ label: "Vol", size: 30, color: col, def: 1 / 1.5, get: function () { return l.vol / 1.5; }, set: function (n) { l.vol = Math.round(n * 150) / 100; liveMix(); changed(); heads(); }, text: function () { return Math.round(l.vol * 100) + "%"; } }));
    kn("pan", "pan", KN.knob({ label: "Pan", size: 30, color: col, def: 0.5, bipolar: true, get: function () { return (l.pan + 1) / 2; }, set: function (n) { l.pan = Math.round((n * 2 - 1) * 100) / 100; liveMix(); changed(); heads(); }, text: function () { return Math.abs(l.pan) < 0.02 ? "C" : (l.pan < 0 ? "L" : "R") + Math.round(Math.abs(l.pan) * 100); } }));
    kn("filter", "cut", KN.knob({ label: "Filter", size: 30, color: col, def: 1, get: function () { return T.autoNorm("cut", (l.fx || T.FX0).cut || 20000); }, set: function (n) { l.fx.cut = Math.round(T.autoVal("cut", n)); liveMix(); changed(); }, text: function () { var c = l.fx.cut || 20000; return c >= 19900 ? "Open" : c >= 1000 ? (c / 1000).toFixed(1) + "k" : c + ""; } }));
  }
  function tempoEd(box) {   // 2.961.0
    var q = TLD.tempo[S.tpt]; if (!q) { box.classList.remove("on"); return; }
    var bb = T.barBeat(TLD.tempo, q.t), b = doc.createElement("b"); b.style.color = "#ffae3a"; b.textContent = "♩ Tempo · " + T.fmt(q.t) + " · bar " + bb.bar + "." + bb.beat; box.appendChild(b);
    var lab = doc.createElement("label"); lab.textContent = " BPM "; var inp = doc.createElement("input"); inp.type = "number"; inp.min = 20; inp.max = 300; inp.step = 0.1; inp.value = q.bpm; inp.id = "syTBpm"; inp.style.width = "64px";
    inp.addEventListener("keydown", function (e) { e.stopPropagation(); }); inp.onchange = function () { q.bpm = Math.max(20, Math.min(300, Math.round((+inp.value || q.bpm) * 10) / 10)); inp.value = q.bpm; changed(); draw(); };
    lab.appendChild(inp); box.appendChild(lab);
    if (S.tpt + 1 < TLD.tempo.length) {
      var rl = doc.createElement("label"), rc = doc.createElement("input"); rc.type = "checkbox"; rc.id = "syTRamp"; rc.checked = !!q.ramp; rc.onchange = function () { q.ramp = rc.checked; changed(); draw(); };
      rl.appendChild(rc); rl.appendChild(doc.createTextNode(" Ramp to the next")); rl.title = "↗ The tempo moves evenly to the next change (an accelerando / ritardando) instead of jumping"; box.appendChild(rl);
    }
    if (S.tpt > 0) { var x = doc.createElement("button"); x.type = "button"; x.className = "ghost"; x.textContent = "🗑"; x.title = "Remove this tempo change (Delete)"; x.onclick = function () { delTempo(S.tpt); }; box.appendChild(x); }
  }
  function keyEd() {
    var box = $("syTKeyEd"); if (!box) return;
    box.innerHTML = ""; box.classList.add("on");
    if (S.tpt != null) { tempoEd(box); return; }
    if (!S.key) { if (S.clip) clipEd(box); else layerEd(box); return; }
    var l = L(S.key.l), K = l && l.keys[S.key.k]; if (!K) { box.classList.remove("on"); return; }
    var col = hue(S.key.l), b = doc.createElement("b"); b.style.color = col; b.textContent = "◆ " + l.name + " · " + T.fmt(K.t); box.appendChild(b);
    [["Start vol", "a"], ["End vol", "b"]].forEach(function (q) {
      var k = KN.knob({ label: q[0], size: 30, color: col, def: 1, get: function () { return K[q[1]]; }, set: function (n) { K[q[1]] = Math.round(n * 100) / 100; changed(); draw(); }, text: function () { return Math.round(K[q[1]] * 100) + "%"; } });
      k.el.dataset.key = q[1]; box.appendChild(k.el);
    });
    var x = doc.createElement("button"); x.type = "button"; x.className = "ghost"; x.textContent = "🗑"; x.title = "Remove this keyframe (Delete)"; x.onclick = del; box.appendChild(x);
  }
  /* ＋ Sound: every source */
  function picker() {
    var box = $("syTPick"); if (!box) return;
    var html = '<div class="sytlpg"><b>🔁 The loop</b><div><span draggable="true" data-src="loop" title="The looper\'s loop as it is now - made into a sample (📂 My samples), then put on the timeline">🔁 The loop (as a sample)</span></div></div>'
      + '<div class="sytlpg"><b>🥁 Built-in kit</b><div>' + C.KIT.map(function (k) { return '<span draggable="true" data-src="kit:' + k[0] + '">' + k[1] + "</span>"; }).join("") + "</div></div>";
    sources.forEach(function (g) {
      html += '<div class="sytlpg"><b>' + g.name.replace(/</g, "&lt;") + " (" + g.items.length + ")</b><div>" + (g.items.length ? g.items.slice(0, 200).map(function (it) {
        var n = it.name.replace(/[<>&"]/g, function (ch) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch]; });
        return '<span draggable="true" data-src="' + g.id + ":" + n + '" title="' + n + '">' + n + "</span>"; }).join("") : '<i>none yet</i>') + "</div></div>";
    });
    html += '<div class="sytlpg"><b>📂 From a file</b><div><span data-file="1">📂 Choose sound files…</span></div></div>';
    box.innerHTML = html;
  }
  function wirePicker() {
    var box = $("syTPick"); if (!box) return;
    box.addEventListener("click", function (e) {
      var s = e.target.closest && e.target.closest("span[data-src], span[data-file]"); if (!s) return;
      if (s.dataset.file) { $("syTFile").click(); return; }
      if (s.dataset.src === "loop") addLoop(S.sel, S.ph); else addClip(s.dataset.src, S.sel, S.ph);
    });
    box.addEventListener("dragstart", function (e) { var s = e.target.closest && e.target.closest("span[data-src]"); if (s && e.dataTransfer) e.dataTransfer.setData("text/x-h3snd", s.dataset.src); });
    var f = $("syTFile");
    if (f) f.onchange = function () { O.upload(f.files, null).then(function (j) { f.value = ""; ((j && j.added) || []).forEach(function (a) { addClip("my:" + a.name, S.sel, S.ph); }); }); };
  }

  /* ---------------- playing, the mix ---------------- */
  function seek(t) { if (S.rec) { msg("● Recording - ■ stop it first", true); return; } S.ph = Math.max(0, t); if (S.playing) { stop(); play(); } else draw(); }
  function liveMix() {
    if (!S.nodes) return;
    var t = O.ctx().currentTime;
    S.nodes.forEach(function (n, i) { var l = L(i); if (!n || !l) return; n.vol.gain.setTargetAtTime(T.audible(TLD, i) ? l.vol : 0, t, 0.02); if (n.pan.pan && !(l.auto && l.auto.pan && l.auto.pan.length)) n.pan.pan.setTargetAtTime(l.pan, t, 0.02); setFx(n, l, t); });
    if (S.master) S.master.gain.setTargetAtTime(TLD.master == null ? 1 : TLD.master, t, 0.02);
  }
  /** the timeline into a context: per layer volume (knob) -> pan -> its keyframe line -> dest; each clip with 5 ms fades */
  /** 2.958.0: the reverb the layers send to (made, not recorded) */
  function space(ctx) {
    var sr = ctx.sampleRate, n = Math.round(sr * 2.4), b = ctx.createBuffer(2, n, sr), r = root.H3SynthKit ? root.H3SynthKit.rng(4242) : Math.random;
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  }
  /** a layer's effects onto its nodes (the mixer's knobs - live while it plays) */
  function setFx(n, l, t) {
    var f = l.fx || T.FX0, set = function (prm, v) { if (t == null) prm.value = v; else prm.setTargetAtTime(v, t, 0.02); };
    set(n.lo.gain, f.lo); set(n.mid.gain, f.mid); set(n.hi.gain, f.hi);
    set(n.comp.threshold, -f.comp * 32); set(n.comp.ratio, 1 + f.comp * 9); set(n.make.gain, 1 + f.comp * 0.9);
    var au = l.auto || {}, has = function (k) { return au[k] && au[k].length; };
    if (!has("rev")) set(n.send.gain, f.rev * 0.9);
    if (!has("cut")) set(n.flt.frequency, f.cut || 20000);
  }
  /** 2.959.0: a layer's automation lanes onto its nodes, from `from` (timeline s) - `at` = when `from` plays */
  function autoInto(n, l, from, at) {
    var au = l.auto || {}, f = l.fx || T.FX0;
    T.AUTO.forEach(function (k) {
      var pts = au[k]; if (!pts || !pts.length) return;
      var prm = k === "pan" ? (n.pan.pan || null) : k === "cut" ? n.flt.frequency : n.send.gain; if (!prm) return;
      var def = T.autoNorm(k, k === "pan" ? l.pan : k === "cut" ? (f.cut || 20000) : f.rev), val = function (v) { var x = T.autoVal(k, v); return k === "rev" ? x * 0.9 : x; };
      T.autoOps(pts, from, def).forEach(function (op) {
        var when = at + Math.max(0, op.t - from);
        if (op.op === "set") prm.setValueAtTime(val(op.v), when);
        else if (k === "cut") prm.exponentialRampToValueAtTime(Math.max(40, val(op.v)), when); else prm.linearRampToValueAtTime(val(op.v), when);
      });
    });
  }
  function mixInto(ctx, dest, from, at, bufs, only, force) {
    var endT = T.end(TLD), nodes = [], srcs = [];
    // 2.958.0: master (its own level + a meter) and one reverb for every layer's send
    var master = ctx.createGain(); master.gain.value = TLD.master == null ? 1 : TLD.master; master.connect(dest);
    var mMeter = ctx.createAnalyser(); mMeter.fftSize = 1024; master.connect(mMeter);
    var verb = ctx.createConvolver(); verb.buffer = space(ctx); verb.connect(master);
    TLD.layers.forEach(function (l, i) {
      var vol = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(), ev = ctx.createGain();
      var lo = ctx.createBiquadFilter(), mid = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor(), make = ctx.createGain(), send = ctx.createGain(), meter = ctx.createAnalyser();
      lo.type = "lowshelf"; lo.frequency.value = 200; mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 0.8; hi.type = "highshelf"; hi.frequency.value = 4500;
      var flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.Q.value = 0.7;   // 2.959.0: the layer's filter (Filter knob / lane)
      comp.knee.value = 6; comp.attack.value = 0.005; comp.release.value = 0.15; meter.fftSize = 1024;
      var on = only == null ? T.audible(TLD, i) : ([].concat(only).indexOf(i) >= 0 && (!l.mute || force));   // 2.967.0: only = a layer or a list; 2.973.0: force = heard even if muted
      vol.gain.value = on ? l.vol : 0; if (pan.pan) pan.pan.value = l.pan;
      // vol -> EQ low / mid / high -> compressor (+ make-up) -> pan -> the keyframe line -> master (+ the reverb send)
      vol.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(flt); flt.connect(comp); comp.connect(make); make.connect(pan); pan.connect(ev);
      ev.connect(master); ev.connect(send); send.connect(verb); ev.connect(meter);
      T.automation(l.keys, from, endT).forEach(function (op) {
        var when = at + Math.max(0, op.t - from);
        if (op.op === "set") ev.gain.setValueAtTime(op.v, when); else ev.gain.linearRampToValueAtTime(op.v, when);
      });
      var nd = { flt: flt, vol: vol, pan: pan, ev: ev, lo: lo, mid: mid, hi: hi, comp: comp, make: make, send: send, meter: meter, on: on };
      setFx(nd, l); autoInto(nd, l, from, at); nodes.push(nd);
    });
    var gains = [];
    var fl = TLD.layers.map(function (l) { return T.fades(T.playable(l).map(function (p) { return p.c; })); }), engines = [];   // 2.960.0: takes as their comp
    T.schedule(TLD, from, force ? only : null).forEach(function (s) {
      if (s.dur <= 0 || !nodes[s.layer].on) return;
      var c = s.c || L(s.layer).clips[s.clip], f = fl[s.layer][s.pi == null ? s.clip : s.pi], g = ctx.createGain(), t0 = at + s.when;
      // 2.957.0: the clip's gain line - its gain, fade in / out (longer where it overlaps a neighbour: a crossfade), 5 ms at
      // least at each end (no click); started part-way = from where the line is
      var pts = T.clipEnv(c, Math.max(f.fi, 0.005), Math.max(f.fo, 0.005)), x0 = s.skip;
      g.gain.setValueAtTime(T.envAt(pts, x0), t0);
      pts.forEach(function (pt) { if (pt[0] > x0) g.gain.linearRampToValueAtTime(pt[1], t0 + (pt[0] - x0)); });
      g.connect(nodes[s.layer].vol); gains.push(g);
      if (c.kind === "steps") {   // 2.962.0: each hit of the pattern, its own level (row volume x accent)
        T.stepEvents(c, tmap()).forEach(function (ev) {
          if (ev.t < x0 - 1e-6) return; var bb = bufs[ev.src]; if (!bb) return;
          var hg = ctx.createGain(), sr2 = ctx.createBufferSource(); hg.gain.value = ev.v; sr2.buffer = bb; sr2.connect(hg); hg.connect(g);
          sr2.start(t0 + (ev.t - x0), 0, Math.min(bb.duration, c.len - ev.t + 0.002)); srcs.push(sr2);
        });
        return;
      }
      if (c.kind === "notes") {
        // 2.957.0: a note clip is played by the synth - its own engine with the clip's patch
        var V = root.H3SynthVoice; if (!V) return;
        var E = new V.Engine(ctx, { dest: g }); E.setAll(c.patch || (O.patch ? O.patch() : null) || C.defaults()); engines.push({ E: E, g: g });
        c.notes.forEach(function (n) {
          var ne = Math.min(n.t + n.d, c.len); if (ne <= x0 || n.t >= c.len) return;
          var on = t0 + Math.max(0, n.t - x0), off = t0 + (ne - x0);
          E.noteOn(n.m, n.v, on); E.noteOff(n.m, Math.max(on + 0.01, off));
        });
        return;
      }
      var b = bufs[s.src]; if (!b) return;
      var src = ctx.createBufferSource();
      src.buffer = b; src.connect(g);
      src.start(t0, Math.min(s.off, Math.max(0, b.duration - 0.001)), s.dur); srcs.push(src);
    });
    return { nodes: nodes, srcs: srcs, engines: engines, end: endT, master: master, mMeter: mMeter, gains: gains };
  }
  function buffersFor(from, force) {
    var need = {}; T.schedule(TLD, from || 0, force == null ? null : force).forEach(function (s) { if (s.kind === "steps") (s.c.rows || []).forEach(function (r) { need[r.src] = 1; }); else if (s.kind !== "notes") need[s.src] = 1; });
    var names = Object.keys(need);
    // 2.973.0: a sound that cannot be read no longer stops everything - the rest plays, the missing ones are said and marked
    return Promise.all(names.map(function (n) { return load(n).then(function (b) { delete S.missing[n]; return [n, b]; }, function () { S.missing[n] = true; return [n, null]; }); })).then(function (pairs) {
      var o = {}, gone = []; pairs.forEach(function (p) { if (p[1]) o[p[0]] = p[1]; else gone.push(p[0].replace(/^\w+:/, "")); });
      if (gone.length) msg("⚠ " + gone.length + " sound" + (gone.length === 1 ? " is" : "s are") + " not there any more - skipped (drawn struck through): " + gone.slice(0, 3).join(", ") + (gone.length > 3 ? "…" : "") + " - delete the clip or drop the file again", true);
      draw(); return o;
    });
  }
  /** 2.960.0: the beats' clicks from `from` to `until`, starting at `at` -> a canceller */
  function clickFor(ctx, from, until, at) {
    if (!(O.clickOn && O.clickOn() && root.H3SynthClick)) return null;
    return root.H3SynthClick.play(ctx, O.dest(), T.beatTimes(tmap(), from, until, 4).map(function (c) { return { t: c.t - from, accent: c.accent }; }), at);
  }
  function play() {
    if (S.playing) return stop();
    var ctx = O.ctx(), lp = TLD.loop || {}, looping = !!lp.on && lp.b - lp.a >= 0.02;
    var from = S.rec ? S.ph : (S.ph >= T.end(TLD) && !looping ? 0 : S.ph);
    if (looping && (from >= lp.b || (S.rec && S.rec.loop))) from = lp.a;
    S.playing = true; S.loopAB = looping ? { a: lp.a, b: lp.b } : null; S.only = S.rec ? null : playOnly(); paintPlay();
    return buffersFor(looping ? Math.min(from, lp.a) : from, S.only).then(function (bufs) {
      if (!S.playing) return;
      var at = ctx.currentTime + 0.08, m = mixInto(ctx, O.dest(), from, at, bufs, S.only, S.only != null);
      S.nodes = m.nodes; S.srcs = m.srcs; S.engines = m.engines; S.gains = m.gains; S.at = at; S.from = from; S.master = m.master; S.mMeter = m.mMeter; S.bufs = bufs;
      if (S.rec && S.rec.at == null) { S.rec.at = at; S.rec.from = from; }
      if (S.rec && S.rec.loop) S.rec.passes.push(at + (S.loopAB.a - from));
      S.click = clickFor(ctx, from, looping ? S.loopAB.b : m.end, at);
      var tick = function () {
        if (!S.playing) return;
        var AB = S.loopAB;
        if (S.next && ctx.currentTime >= S.next.at) swapPass();
        S.ph = S.from + Math.max(0, ctx.currentTime - S.at);
        if (AB && !S.next && S.ph >= AB.b - 0.35) nextPass(ctx, AB);   // 2.960.0: the next pass scheduled ahead - no gap
        if (!AB && !S.rec && S.ph >= m.end) { S.ph = m.end; stop(); return; }
        if (S.rec && Date.now() - S.rec.t > 600000) { endRec(); msg("● 10 minutes - the recording stopped there", true); return; }
        var sc = $("syTScroll"); if (sc) { var X = S.ph * TLD.zoom; if (X > sc.scrollLeft + sc.clientWidth - 40 || X < sc.scrollLeft) sc.scrollLeft = Math.max(0, X - 40); }
        draw(); S.raf = root.requestAnimationFrame(tick);
      };
      tick();
    }).catch(function (e) { S.playing = false; paintPlay(); msg(e.message || String(e), true); });
  }
  /** the loop's next pass, mixed to start the moment this one ends (at2); this pass's clips fade out there */
  function nextPass(ctx, AB) {
    var at2 = S.at + (AB.b - S.from), m2 = mixInto(ctx, O.dest(), AB.a, at2, S.bufs, S.only, S.only != null);
    (S.gains || []).forEach(function (g) { try { g.gain.cancelScheduledValues(at2 - 0.004); g.gain.setTargetAtTime(0, at2 - 0.004, 0.0012); } catch (e) { /* gone */ } });
    S.next = { at: at2, m: m2, click: clickFor(ctx, AB.a, AB.b, at2) };
    if (S.rec && S.rec.loop) S.rec.passes.push(at2);
  }
  function swapPass() {
    var old = { srcs: S.srcs, nodes: S.nodes, master: S.master, engines: S.engines, click: S.click }, n = S.next;
    S.nodes = n.m.nodes; S.srcs = n.m.srcs; S.engines = n.m.engines; S.gains = n.m.gains; S.master = n.m.master; S.mMeter = n.m.mMeter; S.click = n.click;
    S.at = n.at; S.from = S.loopAB.a; S.next = null;
    root.setTimeout(function () { teardown(old); }, 2600);   // the reverb's tail rings out first
  }
  function teardown(o) {
    (o.srcs || []).forEach(function (s) { try { s.stop(); } catch (e) { /* done */ } });
    (o.nodes || []).forEach(function (n) { try { n.ev.disconnect(); } catch (e) { /* gone */ } });
    if (o.click) o.click();
    if (o.master) { try { o.master.disconnect(); } catch (e) { /* gone */ } }
    (o.engines || []).forEach(function (x) { try { x.g.disconnect(); [x.E.lfo, x.E.cLfo, x.E.bendSrc].forEach(function (n) { if (n) n.stop(); }); } catch (e) { /* gone */ } });
  }
  function stop() {
    var was = S.playing; S.playing = false; root.cancelAnimationFrame(S.raf);
    if (S.next) { teardown({ srcs: S.next.m.srcs, nodes: S.next.m.nodes, master: S.next.m.master, engines: S.next.m.engines, click: S.next.click }); S.next = null; }
    teardown({ srcs: S.srcs, nodes: S.nodes, master: S.master, engines: S.engines, click: S.click });
    S.click = null; S.master = null; S.mMeter = null; S.gains = null; S.loopAB = null;
    S.srcs = null; S.nodes = null; S.engines = null; paintPlay(); draw();
    return was;
  }
  /** ▶ / ■ - ■ while recording ends the recording (the takes) */
  function toggle() { if (S.rec) return endRec(); return play(); }
  function paintPlay() { var b = $("syTPlay"); if (b) { b.classList.toggle("on", S.playing); b.textContent = S.playing ? "■ Stop" : "▶ Play"; b.setAttribute("aria-pressed", S.playing ? "true" : "false"); } }
  /** the whole timeline -> {chans, sampleRate, seconds} */
  function render(sr, only) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext; if (!OAC) return Promise.reject(new Error("this browser cannot render sound"));
    sr = sr || 48000;
    if (!T.schedule(TLD, 0).length) return Promise.reject(new Error("the timeline is empty (or every layer is muted) - add a sound first"));
    return buffersFor(0).then(function (bufs) {
      var secs = T.end(TLD) + 0.05, ctx = new OAC(2, Math.round(sr * secs), sr), lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -1; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1; lim.connect(ctx.destination);
      mixInto(ctx, lim, 0, 0, bufs, only);
      return ctx.startRendering().then(function (b) { return { chans: [b.getChannelData(0), b.getChannelData(1)], sampleRate: sr, seconds: secs }; });
    });
  }
  /** 2.958.0: ⬇ Stems - every layer with sounds on it (not muted) rendered alone, with its effects -> the Sound assets */
  function stems() {
    var list = TLD.layers.map(function (l, i) { return i; }).filter(function (i) { return !L(i).mute && L(i).clips.length; });
    if (!list.length) { msg("No layer has sounds on it (or they are all muted)", true); return Promise.resolve([]); }
    var base = (O.fileName && O.fileName() ? O.fileName().replace(/\.sfx$/i, "") : "timeline"), out = [];
    return list.reduce(function (pr, i) {
      return pr.then(function () {
        msg("⬇ Stems: " + L(i).name + " (" + (out.length + 1) + " / " + list.length + ")…");
        return render(48000, i).then(function (r) { return O.toProject(O.blobOf(r), "stem.wav", "sound", base + " - " + L(i).name); }).then(function (j) { out.push(j && j.name); });
      });
    }, Promise.resolve()).then(function () { msg("⬇ " + out.length + " stem" + (out.length === 1 ? "" : "s") + " in the Sound assets: " + out.join(", ")); return out; })
      .catch(function (e) { msg(e.message || String(e), true); return out; });
  }
  /** 2.958.0: markers - ＋ at the playhead (M), click on the ruler = go there, double-click = rename, right-click = gone */
  function addMarker(t, name) {
    TLD.markers = TLD.markers || [];
    if (TLD.markers.length >= 100) { msg("100 markers at most", true); return null; }
    var m = { t: Math.max(0, t == null ? S.ph : t), name: name || "Marker " + (TLD.markers.length + 1) };
    TLD.markers.push(m); TLD.markers.sort(function (a, b) { return a.t - b.t; }); changed(); draw(); msg("⚑ " + m.name + " at " + T.fmt(m.t)); return m;
  }
  function markerAt(mx) { var ms = TLD.markers || [], best = -1, bd = 7; ms.forEach(function (m, i) { var d = Math.abs(px(m.t) - mx); if (d < bd) { bd = d; best = i; } }); return best; }
  function exportTL(to) {
    msg("Mixing the timeline…");
    return render().then(function (r) {
      var blob = O.blobOf(r), name = "synth timeline " + new Date().toTimeString().slice(0, 5).replace(":", "-");
      if (!to) {
        var a = doc.createElement("a"), u = root.URL.createObjectURL(blob); a.href = u; a.download = name + ".wav"; doc.body.appendChild(a); a.click(); a.remove();
        root.setTimeout(function () { root.URL.revokeObjectURL(u); }, 4000);
        msg("⬇ " + name + ".wav (" + r.seconds.toFixed(1) + " s)"); return { name: name + ".wav", seconds: r.seconds };
      }
      return O.toProject(blob, "timeline.wav", to, name);
    }).catch(function (e) { msg(e.message || String(e), true); return null; });
  }
  /** 3.1.0 💾 Save song (Tim: "add a button to edit booth timeline to save as mp3 or wav. compile all the layers into a song"):
   *  every layer mixed (render(): their effects, lanes, keyframes, the limiter) -> /api/synth/song -> an MP3 / a WAV in the
   *  Sound assets + the gallery; a copy downloaded too when ticked */
  function saveSong(name, format, dl) {
    var fmt = format === "wav" ? "wav" : "mp3", nm = String(name || "").trim() || (O.fileName && O.fileName() ? O.fileName().replace(/\.sfx$/i, "") : "song");
    msg("💾 Mixing every layer into " + nm + "…");
    return render(48000).then(function (r) {
      msg("💾 Saving " + nm + " as " + fmt.toUpperCase() + " (" + r.seconds.toFixed(1) + " s)…");
      var fd = new root.FormData(); fd.append("name", nm); fd.append("format", fmt); fd.append("file", O.blobOf(r), "mix.wav");
      return root.fetch("/api/synth/song", { method: "POST", body: fd }).then(function (x) { return x.json(); });
    }).then(function (j) {
      if (!j || j.error) throw new Error((j && j.error) || "the song could not be saved");
      if (dl && j.url) { var a = doc.createElement("a"); a.href = j.url; a.download = j.name; doc.body.appendChild(a); a.click(); a.remove(); }
      if (O.refresh) try { O.refresh(); } catch (e) { /* fine */ }
      if (typeof root.refreshGallery === "function") try { root.refreshGallery(); } catch (e) { /* fine */ }
      msg("💾 " + j.note + (dl && j.url ? " - and in your Downloads" : "")); return j;
    }).catch(function (e) { msg(e.message || String(e), true); return null; });
  }
  function wire() {
    var on = function (id, f) { var el = $(id); if (el) el.onclick = f; };
    on("syTPlay", function () { O.ctx(); toggle(); });
    var wh = $("syTWhat");   // 2.973.0: ▶ plays All or the picked Layer (kept in this browser)
    if (wh) { try { wh.value = root.localStorage.getItem("h3.synth.tl.what") === "layer" ? "layer" : "all"; } catch (e) { /* fine */ }
      wh.onchange = function () { try { root.localStorage.setItem("h3.synth.tl.what", wh.value); } catch (e) { /* fine */ } if (S.playing) { stop(); play(); } paintWhat(); }; paintWhat(); }
    on("syTRec", function () { O.ctx(); startRec(); });   // 2.960.0
    on("syTLoop", function () { toggleLoop("on"); });
    on("syTTempo", function () { toggleTempo(); });   // 2.961.0
    on("syTSteps", function () { addSteps(); });   // 2.962.0
    on("syTPunch", function () { toggleLoop("punch"); });
    on("syTStart", function () { if (S.rec) { msg("● Recording - ■ stop it first", true); return; } var p = S.playing; stop(); S.ph = 0; var sc = $("syTScroll"); if (sc) sc.scrollLeft = 0; draw(); if (p) play(); });
    on("syTAddBtn", function () { var b = $("syTPick"); b.classList.toggle("on"); if (b.classList.contains("on") && O.refresh) O.refresh(); });
    on("syTOpen", function () { $("syTOpenFile").click(); });
    var of = $("syTOpenFile");
    if (of) of.onchange = function () {   // 2.955.0 (Tim: "allow user to open audio file to new layer"): each file on a layer of its own
      O.upload(of.files, null).then(function (j) { of.value = ""; ((j && j.added) || []).reduce(function (pr, a) { return pr.then(function () { return addNewLayer("my:" + a.name, a.name.replace(/\.[a-z0-9]+$/i, ""), S.ph); }); }, Promise.resolve()); });
    };
    on("syTMark", function () { addMarker(); });
    on("syTStems", function () { stems(); });
    on("sySong", function () { var bx = $("sySongBox"), open = bx.style.display === "none"; bx.style.display = open ? "" : "none"; if (open) { var n = $("sySongName"); if (!n.value) n.value = O.fileName && O.fileName() ? O.fileName().replace(/\.sfx$/i, "") : ""; try { $("sySongFmt").value = root.localStorage.getItem("h3.synth.song.fmt") === "wav" ? "wav" : "mp3"; } catch (e) { /* fine */ } n.focus(); } });
    on("sySongX", function () { $("sySongBox").style.display = "none"; });
    on("sySongGo", function () { var f = $("sySongFmt").value; try { root.localStorage.setItem("h3.synth.song.fmt", f); } catch (e) { /* fine */ } var b = $("sySongGo"); b.disabled = true; saveSong($("sySongName").value, f, $("sySongDl").checked).then(function (j) { b.disabled = false; if (j) $("sySongBox").style.display = "none"; }); });
    var sn = $("sySongName"); if (sn) sn.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); $("sySongGo").click(); } else if (e.key === "Escape") $("sySongBox").style.display = "none"; };
    on("syTMixBtn", function () { if (root.H3SynthMix) root.H3SynthMix.toggle(); });
    on("syTNotes", function () { addNotes([], "Notes", null, S.sel, S.ph).then(function (c) { var l = L(S.sel); openRoll(S.sel, l.clips.indexOf(c)); }); });
    on("syTSnap", function () { TLD.snap = !TLD.snap; paintSnap(); changed(); });
    on("syTZoomIn", function () { zoom(1.5); }); on("syTZoomOut", function () { zoom(1 / 1.5); });
    on("syTWav", function () { exportTL(null); }); on("syTToSfx", function () { exportTL("sfx"); }); on("syTToSound", function () { exportTL("sound"); });
  }
  function paintSnap() { var b = $("syTSnap"); if (b) { b.classList.toggle("on", TLD.snap); b.setAttribute("aria-pressed", TLD.snap ? "true" : "false"); } }
  function zoom(f) { TLD.zoom = Math.max(4, Math.min(400, TLD.zoom * f)); changed(); draw(); }
  function init(o) { O = o; TLD = T.cleanTL(o.saved); layout(); wire(); wireCanvas(); wirePicker(); heads(); picker(); paintSnap(); paintRecBar(); paintTempoBtn(); draw(); root.setTimeout(warm, 600); }
  function setSources(g) { sources = g || []; picker(); }
  root.H3SynthTL = { saveSong: saveSong, _ctx: function () { return O.ctx(); }, addSteps: addSteps, openSteps: openSteps, tempo: toggleTempo, tmap: function () { return tmap(); }, delTempo: delTempo, selTempo: function (i) { S.tpt = i; keyEd(); draw(); }, rec: startRec, endRec: endRec, recording: function () { return S.rec ? { layer: S.rec.layer, passes: S.rec.passes.slice(), at: S.rec.at, from: S.rec.from, loop: S.rec.loop, punch: S.rec.punch } : null; }, lastRec: function () { return S.lastRec || null; }, toggle: toggle, setLoop: setLoop, toggleLoop: toggleLoop, arm: function (i) { S.arm = i; heads(); }, comp: function (l, ci, a, b) { compApply({ l: l, ci: ci, grp: L(l).clips[ci].grp, a: a, b: b }); }, flatten: flattenSel, bounce: bounce, renderDry: renderDry, renderMix: renderMix, patchLayer: patchLayer, setView: function (i, k) { S.view[i] = k; heads(); draw(); }, stems: stems, addMarker: addMarker, setFxLive: function () { liveMix(); }, changedFx: function () { liveMix(); changed(); draw(); },
    meters: function () { return S.nodes ? { layers: S.nodes.map(function (n) { return n.meter; }), master: S.mMeter } : null; }, playing: function () { return S.playing; }, addNotes: addNotes, openRoll: openRoll, split: split, dup: dup, select: function (l, c) { S.sel = l; S.picked = l != null && l >= 0; paintWhat(); S.clip = c == null ? null : { l: l, c: c }; S.key = null; keyEd(); draw(); }, init: init, play: play, stop: stop, seek: seek, addClip: addClip, addLoop: addLoop, addNewLayer: addNewLayer, newLayer: newLayer, ask: ask, dropped: dropped, render: render, exportTL: exportTL, del: del, draw: draw, setSources: setSources,
    tl: function () { return TLD; }, setTL: function (j) { if (S.rec) endRec(); stop(); TLD = T.cleanTL(j); S.arm = null; S.tpt = null; S.picked = false; S.missing = {}; root.setTimeout(paintWhat, 0); layout(); paintTempoBtn(); S.sel = 0; S.clip = null; S.key = null; S.apt = null; S.view = {}; keyEd(); heads(); paintRecBar(); draw(); warm(); changed(); },
    geo: function () { return { RULER: RULER, LH: LH, zoom: TLD.zoom, scroll: S.scroll }; },
    info: function () { return { picked: S.picked, what: playWhat(), only: S.only, missing: Object.keys(S.missing), layers: TLD.layers.length, clips: TLD.layers.map(function (l) { return l.clips.length; }), keys: TLD.layers.map(function (l) { return l.keys.length; }), sel: S.sel,
      clip: S.clip, key: S.key, apt: S.apt, tpt: S.tpt == null ? null : S.tpt, tempoOn: !!TLD.tempoOn, tempo: TLD.tempo, bpmNow: T.bpmAt(tmap(), S.ph), arm: armed(), loop: TLD.loop, looping: !!S.loopAB, takes: TLD.layers.map(function (l) { var g = T.groups(l); return Object.keys(g).map(function (k) { return k + ":" + g[k].length; }).join(); }), views: TLD.layers.map(function (l, i) { return view(i); }), ph: S.ph, markers: (TLD.markers || []).map(function (m) { return m.name + "@" + m.t; }), clicking: !!S.click, playing: S.playing, end: T.end(TLD), snap: TLD.snap, zoom: TLD.zoom, waves: Object.keys(peaks).length }; } };
})(typeof window !== "undefined" ? window : globalThis);
