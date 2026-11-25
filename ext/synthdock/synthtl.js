/* bitGen Studio — ext/synthdock/synthtl.js (2.954.0): 🎹 THE SYNTH TAB's TIMELINE under the looper (window.H3SynthTL).
 * Tim: "add a timeline below that with waveforms that can be added from all sources, add knobs to each timeline layer for
 * volume. add keyframes to each layer, start volume end volume on each key frame".
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
  var RULER = 22, LH = 64, HUES = ["#38e1ff", "#ff4fd8", "#ffae3a", "#5dff8a", "#b78cff", "#ffd23a", "#4f9dff", "#ff5a5a"];
  var O = null, TLD = T.newTL(), sources = [], peaks = {}, dur = {};
  var S = { sel: 0, clip: null, key: null, ph: 0, playing: false, nodes: null, raf: 0, drag: null, scroll: 0, at: 0, from: 0 };
  function hue(i) { return HUES[i % HUES.length]; }
  function msg(t, bad) { if (O && O.msg) O.msg(t, bad); }
  function changed() { if (O && O.save) O.save(TLD); }
  function bpm() { return O && O.bpm ? O.bpm() : 120; }
  function L(i) { return TLD.layers[i]; }

  /* ---------------- sounds: buffers + waveforms ---------------- */
  function load(src) {
    return O.loop.buffer(src).then(function (b) {
      if (!peaks[src]) { var d = b.getChannelData(0); peaks[src] = T.peaks(d, b.sampleRate, 100); dur[src] = b.duration; }
      return b;
    });
  }
  function warm() { TLD.layers.forEach(function (l) { l.clips.forEach(function (c) { if (!peaks[c.src]) load(c.src).then(draw).catch(function () { /* said */ }); }); }); }
  /** a sound onto layer li at t (seconds) -> the clip (its length once the sound is read) */
  function addClip(src, li, t, name) {
    if (!T.okSrc(src)) return Promise.resolve(null);
    li = Math.max(0, Math.min(TLD.layers.length - 1, li == null ? S.sel : li));
    return load(src).then(function (b) {
      var c = { src: src, name: name || src.replace(/^\w+:/, "").replace(/\.[a-z0-9]+$/i, ""), start: T.snap(t == null ? S.ph : t, bpm(), TLD.snap), off: 0, len: b.duration };
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
    box.innerHTML = '<div class="sytlrul" style="height:' + RULER + 'px"></div>';
    TLD.layers.forEach(function (l, i) {
      var h = doc.createElement("div"); h.className = "sytlhead" + (i === S.sel ? " sel" : ""); h.style.height = LH + "px"; h.style.setProperty("--lc", hue(i)); h.dataset.l = i;
      h.innerHTML = '<div class="sytlh1"><input maxlength="32" title="The layer\'s name"><button class="ghost sym m" type="button" title="Mute">M</button><button class="ghost sym s" type="button" title="Solo">S</button>'
        + '<button class="ghost sym" data-k type="button" title="◆ A keyframe at the playhead (start = end volume - drag them, or click it for its knobs)">◆</button><button class="ghost sym" data-x type="button" title="Delete this layer">🗑</button></div><div class="sytlh2"></div>';
      var inp = h.querySelector("input"); inp.value = l.name;
      inp.onchange = function () { l.name = inp.value.replace(/[<>]/g, "").trim().slice(0, 32) || "Layer " + (i + 1); changed(); draw(); };
      inp.addEventListener("keydown", function (e) { e.stopPropagation(); });
      var bs = h.querySelectorAll("button");
      bs[0].classList.toggle("on", l.mute); bs[1].classList.toggle("on", l.solo);
      bs[0].onclick = function () { l.mute = !l.mute; liveMix(); changed(); heads(); draw(); };
      bs[1].onclick = function () { l.solo = !l.solo; liveMix(); changed(); heads(); draw(); };
      bs[2].onclick = function () { var k = T.addKey(l, S.ph, T.end(TLD)); if (k >= 0) { S.sel = i; S.key = { l: i, k: k }; S.clip = null; keyEd(); changed(); heads(); draw(); } };
      bs[3].onclick = function () {
        if (TLD.layers.length <= 1) { msg("A timeline keeps at least one layer", true); return; }
        TLD.layers.splice(i, 1); S.sel = Math.min(S.sel, TLD.layers.length - 1); S.clip = null; S.key = null; keyEd(); changed(); heads(); draw();
      };
      var k2 = h.querySelector(".sytlh2");
      var kv = KN.knob({ label: "Vol", size: 30, color: hue(i), def: 1 / 1.5, get: function () { return l.vol / 1.5; }, set: function (n) { l.vol = Math.round(n * 150) / 100; liveMix(); changed(); }, text: function () { return Math.round(l.vol * 100) + "%"; } });
      var kp = KN.knob({ label: "Pan", size: 30, color: hue(i), def: 0.5, bipolar: true, get: function () { return (l.pan + 1) / 2; }, set: function (n) { l.pan = Math.round((n * 2 - 1) * 100) / 100; liveMix(); changed(); }, text: function () { return Math.abs(l.pan) < 0.02 ? "C" : (l.pan < 0 ? "L" : "R") + Math.round(Math.abs(l.pan) * 100); } });
      kv.el.setAttribute("aria-label", l.name + " volume"); kp.el.setAttribute("aria-label", l.name + " pan"); kv.el.dataset.vol = i;
      k2.appendChild(kv.el); k2.appendChild(kp.el);
      h.addEventListener("pointerdown", function (e) { if (e.target.closest("button, input, .sykn")) return; S.sel = i; heads(); draw(); });
      box.appendChild(h);
    });
    var add = doc.createElement("button"); add.type = "button"; add.className = "ghost sytladd"; add.textContent = "＋ Layer"; add.title = "Add a layer";
    add.onclick = function () { if (TLD.layers.length >= T.MAXL) { msg("16 layers at most", true); return; } TLD.layers.push(T.newLayer(TLD.layers.length)); S.sel = TLD.layers.length - 1; changed(); heads(); draw(); };
    box.appendChild(add);
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
    var beat = 60 / bpm(), t0 = tAt(0), t1 = tAt(w), fine = beat * TLD.zoom > 14;
    for (var b = Math.floor(t0 / beat); b * beat <= t1; b++) {
      var X = px(b * beat), bar = b % 4 === 0; if (!bar && !fine) continue;
      x.fillStyle = bar ? "#252a34" : "#171b22"; x.fillRect(Math.round(X), RULER, 1, g.h - RULER);
    }
    x.fillStyle = "#07090c"; x.fillRect(0, 0, w, RULER);
    var stepS = TLD.zoom > 80 ? 0.5 : TLD.zoom > 30 ? 1 : TLD.zoom > 12 ? 2 : TLD.zoom > 6 ? 5 : 10;
    x.font = "9px ui-monospace, Consolas, monospace"; x.textAlign = "left";
    for (var s = Math.floor(t0 / stepS) * stepS; s <= t1; s += stepS) {
      var sx = Math.round(px(s)); x.fillStyle = "#3a404c"; x.fillRect(sx, RULER - 7, 1, 7);
      x.fillStyle = "#8b95a7"; x.fillText(T.fmt(s).replace(/\.0$/, ""), sx + 3, 10);
    }
    // clips with their waveforms
    TLD.layers.forEach(function (l, i) {
      var col = hue(i), dim = !T.audible(TLD, i);
      l.clips.forEach(function (c, ci) {
        var X0 = px(c.start), W = c.len * TLD.zoom; if (X0 > w || X0 + W < 0) return;
        var Y = laneTop(i) + 3, H = LH - 7, sel = S.clip && S.clip.l === i && S.clip.c === ci;
        x.save(); x.globalAlpha = dim ? 0.45 : 1;
        rr(x, X0, Y, W, H, 5); x.fillStyle = col; x.globalAlpha *= 0.18; x.fill(); x.globalAlpha = dim ? 0.45 : 1;
        x.lineWidth = sel ? 2 : 1; x.strokeStyle = sel ? "#f4f1e8" : col; x.stroke();
        var p = peaks[c.src];
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
        x.fillStyle = "#e9eef6"; x.font = "600 10px system-ui, sans-serif"; x.textAlign = "left";
        x.save(); rr(x, X0, Y, W, H, 5); x.clip(); x.fillText(c.name, Math.max(X0, 0) + 5, Y + 11); x.restore();
        x.restore();
      });
    });
    // the keyframe lines (start / end volume) and their handles
    TLD.layers.forEach(function (l, i) {
      if (!l.keys.length) return;
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
    // the playhead
    var P = px(S.ph); x.fillStyle = "#ffae3a"; x.fillRect(Math.round(P), 0, 1.5, g.h);
    x.beginPath(); x.moveTo(P - 5, 0); x.lineTo(P + 5, 0); x.lineTo(P, 7); x.closePath(); x.fill();
    var pos = $("syTPos"); if (pos) pos.textContent = T.fmt(S.ph) + " / " + T.fmt(endT);
  }

  /* ---------------- pointer: the ruler, clips, edges, keyframes ---------------- */
  function hit(mx, my) {
    if (my < RULER) return { kind: "ruler" };
    var i = Math.floor((my - RULER) / LH), l = L(i); if (!l) return null;
    var endT = T.end(TLD);
    var best = null, bd = 8;   // the nearest handle: a ◆ (when + start volume) or a ● (end volume) - they sit close together
    for (var k = 0; k < l.keys.length; k++) {
      var K = l.keys[k], e = k + 1 < l.keys.length ? l.keys[k + 1].t : Math.max(endT, K.t), ex = px(e) - (k + 1 < l.keys.length ? 9 : 0);
      var da = Math.hypot(mx - px(K.t), my - vy(i, K.a)), db = Math.hypot(mx - ex, my - vy(i, K.b));
      if (da < bd) { bd = da; best = { kind: "keyA", l: i, k: k }; }
      if (db < bd) { bd = db; best = { kind: "keyB", l: i, k: k }; }
    }
    if (best) return best;
    for (var c = l.clips.length - 1; c >= 0; c--) {
      var cl = l.clips[c], X0 = px(cl.start), X1 = px(T.clipEnd(cl));
      if (mx >= X0 - 2 && mx <= X1 + 2) {
        if (mx - X0 <= 6) return { kind: "trimA", l: i, c: c };
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
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
      if (h.kind === "ruler") { seek(tAt(p.x)); S.drag = { kind: "ruler" }; return; }
      S.sel = h.l;
      if (h.kind === "keyA" || h.kind === "keyB") { S.key = { l: h.l, k: h.k }; S.clip = null; S.drag = { kind: h.kind, l: h.l, k: h.k }; keyEd(); }
      else if (h.kind === "clip" || h.kind === "trimA" || h.kind === "trimB") {
        var c = L(h.l).clips[h.c]; S.clip = { l: h.l, c: h.c }; S.key = null; keyEd();
        S.drag = { kind: h.kind, l: h.l, c: h.c, dx: tAt(p.x) - c.start };
      } else { S.clip = null; S.key = null; keyEd(); seek(T.snap(tAt(p.x), bpm(), TLD.snap)); }
      heads(); draw();
    });
    cv.addEventListener("pointermove", function (e) {
      var p = pos(e), d = S.drag;
      if (!d) { var h = hit(p.x, p.y); cv.style.cursor = !h ? "default" : h.kind === "trimA" || h.kind === "trimB" ? "ew-resize" : h.kind === "clip" ? "grab" : h.kind === "keyA" ? "move" : h.kind === "keyB" ? "ns-resize" : "default"; return; }
      var t = tAt(p.x);
      if (d.kind === "ruler") { seek(t); return; }
      if (d.kind === "keyA" || d.kind === "keyB") {
        var l = L(d.l), K = l.keys[d.k], top = laneTop(d.l) + 16, bot = laneTop(d.l) + LH - 5, v = Math.round(Math.max(0, Math.min(1, (bot - p.y) / (bot - top))) * 100) / 100;
        if (d.kind === "keyA") {
          var lo = d.k > 0 ? l.keys[d.k - 1].t + 0.01 : 0, hiT = d.k + 1 < l.keys.length ? l.keys[d.k + 1].t - 0.01 : 3600;
          K.t = Math.max(lo, Math.min(hiT, T.snap(t, bpm(), TLD.snap && !e.shiftKey))); K.a = v;
        } else K.b = v;
        keyEd(); draw(); return;
      }
      var c = L(d.l).clips[d.c]; if (!c) return;
      if (d.kind === "clip") {
        T.moveClip(c, T.snap(t - d.dx, bpm(), TLD.snap && !e.shiftKey));
        var li = Math.max(0, Math.min(TLD.layers.length - 1, Math.floor((p.y - RULER) / LH)));
        if (li !== d.l) { L(d.l).clips.splice(d.c, 1); L(li).clips.push(c); d.l = li; d.c = L(li).clips.length - 1; S.clip = { l: li, c: d.c }; S.sel = li; heads(); }
      } else if (d.kind === "trimA") T.trimStart(c, T.snap(t, bpm(), TLD.snap && !e.shiftKey));
      else T.trimEnd(c, T.snap(t, bpm(), TLD.snap && !e.shiftKey), dur[c.src]);
      draw();
    });
    var up = function () { if (S.drag && S.drag.kind !== "ruler") changed(); S.drag = null; };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("dblclick", function (e) {
      var p = pos(e), h = hit(p.x, p.y); if (!h || h.kind === "ruler" || h.kind === "keyA" || h.kind === "keyB") return;
      var l = L(h.l), k = T.addKey(l, T.snap(tAt(p.x), bpm(), TLD.snap), T.end(TLD)); if (k < 0) return;
      S.sel = h.l; S.key = { l: h.l, k: k }; S.clip = null; keyEd(); changed(); heads(); draw();
      msg("◆ a keyframe on " + l.name + " - drag the ◆ for when and its start volume, the ● for its end volume");
    });
    cv.addEventListener("keydown", function (e) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault(); e.stopPropagation(); del();
    });
    // a source dragged from ＋ Sound, or sound files from the computer
    cv.addEventListener("dragover", function (e) { e.preventDefault(); });
    cv.addEventListener("drop", function (e) {
      e.preventDefault(); e.stopPropagation();
      var p = pos(e), li = Math.max(0, Math.min(TLD.layers.length - 1, Math.floor((p.y - RULER) / LH))), t = T.snap(tAt(p.x), bpm(), TLD.snap);
      var src = e.dataTransfer && e.dataTransfer.getData("text/x-h3snd");
      if (src === "loop") { addLoop(li, t); return; }
      if (src) { addClip(src, li, t); return; }
      if (e.dataTransfer && e.dataTransfer.files.length) O.upload(e.dataTransfer.files, null).then(function (j) { ((j && j.added) || []).forEach(function (a, n) { addClip("my:" + a.name, Math.min(TLD.layers.length - 1, li + n), t); }); });
    });
    if (root.ResizeObserver) new root.ResizeObserver(function () { draw(); }).observe(sc);
  }
  function del() {
    if (S.key) { var l = L(S.key.l); l.keys.splice(S.key.k, 1); S.key = null; keyEd(); changed(); draw(); msg("◆ keyframe removed"); return true; }
    if (S.clip) { L(S.clip.l).clips.splice(S.clip.c, 1); S.clip = null; changed(); draw(); msg("Clip removed"); return true; }
    return false;
  }
  /* the picked keyframe: its start and end volume as knobs */
  function keyEd() {
    var box = $("syTKeyEd"); if (!box) return;
    box.innerHTML = ""; box.classList.toggle("on", !!S.key);
    if (!S.key) return;
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
  function seek(t) { S.ph = Math.max(0, t); if (S.playing) { stop(); play(); } else draw(); }
  function liveMix() {
    if (!S.nodes) return;
    var t = O.ctx().currentTime;
    S.nodes.forEach(function (n, i) { var l = L(i); if (!n || !l) return; n.vol.gain.setTargetAtTime(T.audible(TLD, i) ? l.vol : 0, t, 0.02); if (n.pan.pan) n.pan.pan.setTargetAtTime(l.pan, t, 0.02); });
  }
  /** the timeline into a context: per layer volume (knob) -> pan -> its keyframe line -> dest; each clip with 5 ms fades */
  function mixInto(ctx, dest, from, at, bufs) {
    var endT = T.end(TLD), nodes = [], srcs = [];
    TLD.layers.forEach(function (l, i) {
      var vol = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(), ev = ctx.createGain();
      vol.gain.value = T.audible(TLD, i) ? l.vol : 0; if (pan.pan) pan.pan.value = l.pan;
      vol.connect(pan); pan.connect(ev); ev.connect(dest);
      T.automation(l.keys, from, endT).forEach(function (op) {
        var when = at + Math.max(0, op.t - from);
        if (op.op === "set") ev.gain.setValueAtTime(op.v, when); else ev.gain.linearRampToValueAtTime(op.v, when);
      });
      nodes.push({ vol: vol, pan: pan, ev: ev });
    });
    T.schedule(TLD, from).forEach(function (s) {
      var b = bufs[s.src]; if (!b || s.dur <= 0) return;
      var src = ctx.createBufferSource(), g = ctx.createGain(), t0 = at + s.when, fade = Math.min(0.005, s.dur / 4);
      src.buffer = b; src.connect(g); g.connect(nodes[s.layer].vol);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + fade); g.gain.setValueAtTime(1, t0 + s.dur - fade); g.gain.linearRampToValueAtTime(0, t0 + s.dur);
      src.start(t0, Math.min(s.off, Math.max(0, b.duration - 0.001)), s.dur); srcs.push(src);
    });
    return { nodes: nodes, srcs: srcs, end: endT };
  }
  function buffersFor(from) {
    var need = {}; T.schedule(TLD, from || 0).forEach(function (s) { need[s.src] = 1; });
    var names = Object.keys(need);
    return Promise.all(names.map(function (n) { return load(n).then(function (b) { return [n, b]; }); })).then(function (pairs) { var o = {}; pairs.forEach(function (p) { o[p[0]] = p[1]; }); return o; });
  }
  function play() {
    if (S.playing) return stop();
    var ctx = O.ctx(), from = S.ph >= T.end(TLD) ? 0 : S.ph;
    S.playing = true; paintPlay();
    return buffersFor(from).then(function (bufs) {
      if (!S.playing) return;
      var at = ctx.currentTime + 0.08, m = mixInto(ctx, O.dest(), from, at, bufs);
      S.nodes = m.nodes; S.srcs = m.srcs; S.at = at; S.from = from;
      var tick = function () {
        if (!S.playing) return;
        S.ph = S.from + Math.max(0, ctx.currentTime - S.at);
        if (S.ph >= m.end) { S.ph = m.end; stop(); return; }
        var sc = $("syTScroll"); if (sc) { var X = S.ph * TLD.zoom; if (X > sc.scrollLeft + sc.clientWidth - 40) sc.scrollLeft = X - 40; }
        draw(); S.raf = root.requestAnimationFrame(tick);
      };
      tick();
    }).catch(function (e) { S.playing = false; paintPlay(); msg(e.message || String(e), true); });
  }
  function stop() {
    var was = S.playing; S.playing = false; root.cancelAnimationFrame(S.raf);
    (S.srcs || []).forEach(function (s) { try { s.stop(); } catch (e) { /* done */ } });
    (S.nodes || []).forEach(function (n) { try { n.ev.disconnect(); } catch (e) { /* gone */ } });
    S.srcs = null; S.nodes = null; paintPlay(); draw();
    return was;
  }
  function paintPlay() { var b = $("syTPlay"); if (b) { b.classList.toggle("on", S.playing); b.textContent = S.playing ? "■ Stop" : "▶ Play"; b.setAttribute("aria-pressed", S.playing ? "true" : "false"); } }
  /** the whole timeline -> {chans, sampleRate, seconds} */
  function render(sr) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext; if (!OAC) return Promise.reject(new Error("this browser cannot render sound"));
    sr = sr || 48000;
    if (!T.schedule(TLD, 0).length) return Promise.reject(new Error("the timeline is empty (or every layer is muted) - add a sound first"));
    return buffersFor(0).then(function (bufs) {
      var secs = T.end(TLD) + 0.05, ctx = new OAC(2, Math.round(sr * secs), sr), lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -1; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1; lim.connect(ctx.destination);
      mixInto(ctx, lim, 0, 0, bufs);
      return ctx.startRendering().then(function (b) { return { chans: [b.getChannelData(0), b.getChannelData(1)], sampleRate: sr, seconds: secs }; });
    });
  }
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
  function wire() {
    var on = function (id, f) { var el = $(id); if (el) el.onclick = f; };
    on("syTPlay", function () { O.ctx(); play(); });
    on("syTStart", function () { var p = S.playing; stop(); S.ph = 0; var sc = $("syTScroll"); if (sc) sc.scrollLeft = 0; draw(); if (p) play(); });
    on("syTAddBtn", function () { var b = $("syTPick"); b.classList.toggle("on"); if (b.classList.contains("on") && O.refresh) O.refresh(); });
    on("syTSnap", function () { TLD.snap = !TLD.snap; paintSnap(); changed(); });
    on("syTZoomIn", function () { zoom(1.5); }); on("syTZoomOut", function () { zoom(1 / 1.5); });
    on("syTWav", function () { exportTL(null); }); on("syTToSfx", function () { exportTL("sfx"); }); on("syTToSound", function () { exportTL("sound"); });
  }
  function paintSnap() { var b = $("syTSnap"); if (b) { b.classList.toggle("on", TLD.snap); b.setAttribute("aria-pressed", TLD.snap ? "true" : "false"); } }
  function zoom(f) { TLD.zoom = Math.max(4, Math.min(400, TLD.zoom * f)); changed(); draw(); }
  function init(o) { O = o; TLD = T.cleanTL(o.saved); wire(); wireCanvas(); wirePicker(); heads(); picker(); paintSnap(); draw(); root.setTimeout(warm, 600); }
  function setSources(g) { sources = g || []; picker(); }
  root.H3SynthTL = { init: init, play: play, stop: stop, seek: seek, addClip: addClip, addLoop: addLoop, render: render, exportTL: exportTL, del: del, draw: draw, setSources: setSources,
    tl: function () { return TLD; }, setTL: function (j) { stop(); TLD = T.cleanTL(j); S.sel = 0; S.clip = null; S.key = null; keyEd(); heads(); draw(); warm(); changed(); },
    geo: function () { return { RULER: RULER, LH: LH, zoom: TLD.zoom, scroll: S.scroll }; },
    info: function () { return { layers: TLD.layers.length, clips: TLD.layers.map(function (l) { return l.clips.length; }), keys: TLD.layers.map(function (l) { return l.keys.length; }), sel: S.sel,
      clip: S.clip, key: S.key, ph: S.ph, playing: S.playing, end: T.end(TLD), snap: TLD.snap, zoom: TLD.zoom, waves: Object.keys(peaks).length }; } };
})(typeof window !== "undefined" ? window : globalThis);
