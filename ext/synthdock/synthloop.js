/* bitGen Studio — ext/synthdock/synthloop.js (2.953.0): 🎹 THE SYNTH STATION's LOOPER (window.H3SynthLoop) - a step drum
 * machine in the spirit of the classic free rhythm designers: 8 rows of sounds x 16 steps, 8 patterns (A-H), swing, ⛓ chain.
 *   A row     its sound (the built-in kit, 📂 your own samples, this project's SFX - or drop a file on the row), M(ute) / S(olo),
 *             volume, pitch (± 24 semitones), pan; 16 pads: click = on / off, Shift-click or right-click = an accent, drag to paint
 *   Playing   a look-ahead clock on the AudioContext (sample-exact, the screen just follows it); a new pattern or ⛓ starts at
 *             the next bar
 *   Out       render(passes) -> the loop played into an OfflineAudioContext -> {chans, sampleRate} (⬇ WAV, → SFX, → 🔊)
 * The rules (the pattern data, the times, the events) are synthcore.js; the station (synthdock.js) gives it the context and
 * where the sound goes: init({ctx() -> AudioContext, dest() -> AudioNode, msg(text, bad), changed(), upload(files, row)}).
 */
(function (root) {
  "use strict";
  var doc = root.document, C = root.H3SynthCore, KIT = root.H3SynthKit, KN = root.H3SynthKnob;
  if (!doc || !C || !KIT || !KN) return;
  var $ = function (id) { return doc.getElementById(id); };
  var HUES = ["#ff5a5a", "#ffae3a", "#ffd23a", "#5dff8a", "#38e1ff", "#4f9dff", "#b78cff", "#ff4fd8"];
  var O = null, L = C.newLoop(), bufs = {}, lists = { my: [], sfx: [] };
  var S = { playing: false, step: 0, barStart: 0, ord: 0, timer: 0, raf: 0, queue: [], now: -1, nowPat: -1, paint: null, hits: 0, playPat: 0 };
  var kitName = {}; C.KIT.forEach(function (k) { kitName[k[0]] = k[1]; });

  function changed() { if (O && O.changed) O.changed(); }
  function msg(t, bad) { if (O && O.msg) O.msg(t, bad); }
  function sndName(s) {
    var m = /^(kit|my|sfx|snd|out):(.*)$/.exec(s || ""); if (!m) return "?";
    return m[1] === "kit" ? (kitName[m[2]] || m[2]) : m[2].replace(/\.[a-z0-9]+$/i, "");
  }

  /* ---------------- the sounds ---------------- */
  function urlOf(s) {
    var m = /^(my|sfx|snd|out):(.+)$/.exec(s); if (!m) return null;
    if (m[1] === "snd" || m[1] === "out") return "/api/synth/source/" + m[1] + "/" + encodeURIComponent(m[2]);   // 2.954.0
    return (m[1] === "my" ? "/api/synth/samples/file/" : "/api/sfx/file/") + encodeURIComponent(m[2]);
  }
  /** the AudioBuffer of a sound (made / fetched once) - a promise */
  function buffer(s) {
    if (bufs[s]) return bufs[s];
    var ctx = O.ctx(), m = /^kit:(.+)$/.exec(s || "");
    if (m) {
      var x = KIT.make(m[1], ctx.sampleRate);
      if (!x) return Promise.reject(new Error("no such sound"));
      var b = ctx.createBuffer(1, x.length, ctx.sampleRate); b.copyToChannel(x, 0);
      bufs[s] = Promise.resolve(b); bufs[s].ready = b; return bufs[s];
    }
    var u = urlOf(s); if (!u) return Promise.reject(new Error("no such sound"));
    var pr = root.fetch(u).then(function (r) { if (!r.ok) throw new Error(sndName(s) + " is not there any more"); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (ok, no) { var q = ctx.decodeAudioData(ab, ok, function () { no(new Error(sndName(s) + ": this sound could not be read")); }); if (q && q.then) q.then(ok, function () { no(new Error(sndName(s) + ": this sound could not be read")); }); }); })
      .then(function (b) { pr.ready = b; return b; });
    pr.catch(function (e) { delete bufs[s]; msg(e.message, true); });
    bufs[s] = pr; return pr;
  }
  function forget(s) { delete bufs[s]; }
  function warm() { L.rows.forEach(function (r) { buffer(r.snd).catch(function () { /* said */ }); }); }

  /* ---------------- playing ---------------- */
  function voice(ctx, dest, r, vel, t, b) {
    var row = L.rows[r], src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.buffer = b; src.playbackRate.value = Math.pow(2, row.pitch / 12);
    g.gain.value = row.vol * vel;
    src.connect(g);
    if (p) { p.pan.value = row.pan; g.connect(p); p.connect(dest); } else g.connect(dest);
    src.start(t);
    src.onended = function () { try { g.disconnect(); if (p) p.disconnect(); } catch (e) { /* gone */ } };
  }
  /** one pad, now (a click on a row's sound = a listen) */
  function audition(r) {
    if (!O) return;
    var ctx = O.ctx(); buffer(L.rows[r].snd).then(function (b) { voice(ctx, out(), r, 0.9, ctx.currentTime + 0.005, b); }).catch(function () { /* said */ });
  }
  /** 2.954.0: a drum pad played a row now (its velocity) */
  function hit(r, vel) {
    if (!O || !L.rows[r]) return;
    var ctx = O.ctx(); buffer(L.rows[r].snd).then(function (b) { voice(ctx, out(), r, vel == null ? 0.9 : vel, ctx.currentTime + 0.003, b); }).catch(function () { /* said */ });
    flash(r);
  }
  /** 2.954.0: ⏺ Into loop - a pad hit while the loop plays is written on the nearest step of the pattern playing -> the step */
  function recordHit(r, vel) {
    if (!S.playing || !O || !L.rows[r]) return -1;
    var t = O.ctx().currentTime, bl = bar(), st = S.barStart;
    while (st > t) st -= bl;
    var k = Math.round((t - st) / C.stepDur(L.bpm)) % C.STEPS, p = S.nowPat >= 0 ? S.nowPat : L.pat;
    L.pats[p][r][k] = vel >= 0.85 ? 2 : 1; paintPads(); changed();
    return k;
  }
  function bar() { return 16 * C.stepDur(L.bpm); }
  /** 2.955.0: the looper's own bus (its rows and every drum pad) -> the mix; ⏺ Rec records it */
  var bus = null;
  // 2.973.0: the looper's own volume (its rows + the drum pads) - h3.synth.lvol, 0..150 %; the keyboard has its VOLUME knob
  var lvol = (function () { try { var v = parseFloat(root.localStorage.getItem("h3.synth.lvol")); return Number.isFinite(v) ? Math.max(0, Math.min(1.5, v)) : 1; } catch (e) { return 1; } })();
  function out() { var ctx = O.ctx(); if (!bus || bus.context !== ctx) { bus = ctx.createGain(); bus.gain.value = lvol; bus.connect(O.dest()); } return bus; }
  function setVol(v) {
    lvol = Math.max(0, Math.min(1.5, +v || 0));
    try { root.localStorage.setItem("h3.synth.lvol", String(lvol)); } catch (e) { /* fine */ }
    if (bus) { try { bus.gain.setTargetAtTime(lvol, bus.context.currentTime, 0.02); } catch (e) { bus.gain.value = lvol; } }
    return lvol;
  }
  /** 2.955.0 (Tim: "add a record button to looper and send button to send last recorded piece to timeline"): ⏺ Rec records the
   *  looper (the loop and the pads) from the loop's start; ⏺ again or ■ Stop ends the take; → 🎞 puts the last take on a new
   *  timeline layer */
  var R = { rec: null, take: null };
  function rec() {
    if (!O || !root.H3SynthRec) return false;
    if (R.rec && R.rec.on()) { endRec(); return false; }
    var ctx = O.ctx(); R.rec = root.H3SynthRec.create(ctx, out());
    if (S.playing) play(false);
    R.rec.start(); play(true); paintRec();
    msg("⏺ Recording the looper (the loop and the pads) - ⏺ or ■ Stop ends the take");
    return true;
  }
  function endRec() {
    if (!R.rec || !R.rec.on()) return null;
    var t = R.rec.stop({ trim: false }); R.rec = null;
    if (t) { R.take = t; if (O.onTake) O.onTake(t); msg("⏺ A " + t.seconds.toFixed(1) + " s take - → 🎞 Timeline puts it on a new layer"); } else msg("⏺ Nothing was recorded", true);
    if (S.playing) play(false);
    paintRec(); return t;
  }
  function paintRec() {
    var b = $("syLRec"), on = !!(R.rec && R.rec.on()); if (b) { b.classList.toggle("on", on); b.textContent = on ? "⏹ Stop rec" : "⏺ Rec"; b.setAttribute("aria-pressed", on ? "true" : "false"); }
    var sd = $("syLSend"); if (sd) sd.disabled = !R.take;
  }
  function tick() {
    if (!S.playing) return;
    var ctx = O.ctx(), ahead = ctx.currentTime + 0.14, ord = C.order(L);
    if (S.ord >= ord.length) S.ord = 0;
    while (true) {
      var p = ord[S.ord], t = S.barStart + C.stepTime(S.step, L.bpm, L.swing);
      if (t > ahead) break;
      if (t >= ctx.currentTime - 0.05) {
        for (var r = 0; r < C.NROWS; r++) {
          var v = L.pats[p][r][S.step];
          if (!v || !C.audible(L, r)) continue;
          var bp = buffer(L.rows[r].snd);
          if (bp.ready) { voice(ctx, out(), r, v === 2 ? 1 : 0.7, Math.max(t, ctx.currentTime), bp.ready); S.hits++; S.queue.push({ t: t, row: r }); }
        }
        S.queue.push({ t: t, step: S.step, pat: p });
      }
      S.step++;
      if (S.step >= C.STEPS) { S.step = 0; S.barStart += bar(); ord = C.order(L); S.ord = (S.ord + 1) % ord.length; }
    }
  }
  function frame() {
    if (!S.playing && !S.queue.length) { S.raf = 0; return; }
    var now = O.ctx().currentTime;
    while (S.queue.length && S.queue[0].t <= now) {
      var q = S.queue.shift();
      if (q.step != null) { S.now = q.step; S.nowPat = q.pat; paintNow(); }
      else flash(q.row);
    }
    S.raf = root.requestAnimationFrame(frame);
  }
  function play(on) {
    on = on == null ? !S.playing : !!on;
    if (on === S.playing) return S.playing;
    if (on) {
      var ctx = O.ctx(); warm();
      S.playing = true; S.step = 0; S.ord = 0; S.queue = []; S.barStart = ctx.currentTime + 0.06;
      var ord = C.order(L); var at = ord.indexOf(L.pat); S.ord = at >= 0 ? at : 0;
      tick(); S.timer = root.setInterval(tick, 25);
      if (!S.raf) S.raf = root.requestAnimationFrame(frame);
    } else {
      if (R.rec && R.rec.on()) { S.playing = false; endRec(); }
      S.playing = false; root.clearInterval(S.timer); S.timer = 0; S.queue = []; S.now = -1; S.nowPat = -1; paintNow();
    }
    var b = $("syPlay"); if (b) { b.classList.toggle("on", S.playing); b.textContent = S.playing ? "■ Stop" : "▶ Play"; b.setAttribute("aria-pressed", S.playing ? "true" : "false"); }
    return S.playing;
  }

  /** the loop played `passes` times into an OfflineAudioContext -> {chans: [L, R], sampleRate, seconds} */
  function render(passes, sr) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext; if (!OAC) return Promise.reject(new Error("this browser cannot render sound"));
    sr = sr || 48000;
    var ev = C.events(L, passes || 1), need = {};
    ev.events.forEach(function (e) { need[L.rows[e.row].snd] = 1; });
    var names = Object.keys(need);
    return Promise.all(names.map(function (s) { return buffer(s).then(function (b) { return [s, b]; }); })).then(function (pairs) {
      var got = {}, tail = 0;
      pairs.forEach(function (x) { got[x[0]] = x[1]; tail = Math.max(tail, x[1].duration); });
      var secs = ev.seconds + Math.min(3, tail), ctx = new OAC(2, Math.max(1, Math.round(sr * secs)), sr), dest = ctx.createDynamicsCompressor();
      dest.threshold.value = -2; dest.ratio.value = 12; dest.attack.value = 0.002; dest.release.value = 0.1; dest.connect(ctx.destination);
      ev.events.forEach(function (e) { voice(ctx, dest, e.row, e.vel, e.t, got[L.rows[e.row].snd]); });
      return ctx.startRendering().then(function (b) { return { chans: [b.getChannelData(0), b.getChannelData(1)], sampleRate: sr, seconds: secs, bars: ev.bars, hits: ev.events.length }; });
    });
  }

  /* ---------------- the screen ---------------- */
  var K = { rows: [], swing: null };
  function paintNow() {
    var on = S.playing && S.nowPat === L.pat ? S.now : -1;
    doc.querySelectorAll("#syRows .systeps button.now").forEach(function (b) { if (+b.dataset.s !== on) b.classList.remove("now"); });
    if (on >= 0) doc.querySelectorAll('#syRows .systeps button[data-s="' + on + '"]').forEach(function (b) { b.classList.add("now"); });
    doc.querySelectorAll("#syPats button").forEach(function (b) { b.classList.toggle("play", S.playing && +b.dataset.p === S.nowPat); });
  }
  function flash(r) {
    if (root.H3SynthPads) root.H3SynthPads.flash(r);   // 2.954.0: the pad of that row lights with it
    var el = doc.querySelector('#syRows .syr[data-r="' + r + '"]'); if (!el) return;
    el.classList.add("hit"); root.setTimeout(function () { el.classList.remove("hit"); }, 90);
  }
  function paintPads() {
    var g = L.pats[L.pat];
    doc.querySelectorAll("#syRows .systeps button").forEach(function (b) {
      var v = g[+b.dataset.r][+b.dataset.s];
      b.classList.toggle("v1", v === 1); b.classList.toggle("v2", v === 2);
      b.setAttribute("aria-pressed", v ? "true" : "false");
      b.setAttribute("aria-label", "Row " + (+b.dataset.r + 1) + " step " + (+b.dataset.s + 1) + (v === 2 ? " accent" : v ? " on" : " off"));
    });
    doc.querySelectorAll("#syPats button").forEach(function (b) { var p = +b.dataset.p; b.classList.toggle("on", p === L.pat); b.classList.toggle("has", C.hasSteps(L, p)); b.setAttribute("aria-pressed", p === L.pat ? "true" : "false"); });
    var ch = $("syChain"); if (ch) { ch.classList.toggle("on", L.chain); ch.setAttribute("aria-pressed", L.chain ? "true" : "false"); }
    var bpm = $("syBpm"); if (bpm && doc.activeElement !== bpm) bpm.value = L.bpm;
    if (K.swing) K.swing.draw();
    L.rows.forEach(function (row, r) {
      var el = doc.querySelector('#syRows .syr[data-r="' + r + '"]'); if (!el) return;
      el.querySelector(".sym.m").classList.toggle("on", row.mute); el.querySelector(".sym.s").classList.toggle("on", row.solo);
      var sel = el.querySelector("select"); if (sel.value !== row.snd) fillSelect(sel, row.snd);
      (K.rows[r] || []).forEach(function (k) { k.draw(); });
    });
    paintNow();
    if (root.H3SynthPads) root.H3SynthPads.paint();
  }
  function opt(sel, v, t) { var o = doc.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); return o; }
  function fillSelect(sel, cur) {
    sel.innerHTML = "";
    var g1 = doc.createElement("optgroup"); g1.label = "Built-in kit"; sel.appendChild(g1);
    C.KIT.forEach(function (k) { opt(g1, "kit:" + k[0], k[1]); });
    var have = {}; C.KIT.forEach(function (k) { have["kit:" + k[0]] = 1; });
    if (lists.my.length) { var g2 = doc.createElement("optgroup"); g2.label = "📂 My samples"; sel.appendChild(g2); lists.my.forEach(function (n) { opt(g2, "my:" + n, n); have["my:" + n] = 1; }); }
    if (lists.sfx.length) { var g3 = doc.createElement("optgroup"); g3.label = "💥 This project's SFX"; sel.appendChild(g3); lists.sfx.forEach(function (n) { opt(g3, "sfx:" + n, n); have["sfx:" + n] = 1; }); }
    if (cur && !have[cur]) opt(sel, cur, sndName(cur) + " (missing)");
    opt(sel, "add", "＋ Add a sample…");
    sel.value = cur;
  }
  function set(r, s, v) { L.pats[L.pat][r][s] = v; }
  function build() {
    var rows = $("syRows"), pats = $("syPats"); if (!rows || !pats) return;
    rows.innerHTML = ""; pats.innerHTML = ""; K.rows = [];
    for (var p = 0; p < C.NPAT; p++) (function (p) {
      var b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.dataset.p = p; b.textContent = C.PAT_NAMES.charAt(p);
      b.title = "Pattern " + C.PAT_NAMES.charAt(p) + (L.chain ? "" : " (while playing it starts at the next bar)");
      b.onclick = function () { L.pat = p; paintPads(); changed(); };
      pats.appendChild(b);
    })(p);
    L.rows.forEach(function (row, r) {
      var el = doc.createElement("div"); el.className = "syr"; el.dataset.r = r; el.style.setProperty("--rc", HUES[r]);
      var sel = doc.createElement("select"); sel.title = "This row's sound - the kit, your samples (📂) or this project's SFX; drop a sound file on the row to use it";
      fillSelect(sel, row.snd);
      sel.onchange = function () {
        if (sel.value === "add") { fillSelect(sel, L.rows[r].snd); if (O.pick) O.pick(r); return; }
        L.rows[r].snd = sel.value; buffer(sel.value).catch(function () { /* said */ }); audition(r); changed();
      };
      var lis = doc.createElement("button"); lis.type = "button"; lis.className = "ghost sym"; lis.textContent = "▸"; lis.title = "Listen"; lis.onclick = function () { audition(r); };
      var mb = doc.createElement("button"); mb.type = "button"; mb.className = "ghost sym m"; mb.textContent = "M"; mb.title = "Mute this row";
      mb.onclick = function () { L.rows[r].mute = !L.rows[r].mute; paintPads(); changed(); };
      var sb = doc.createElement("button"); sb.type = "button"; sb.className = "ghost sym s"; sb.textContent = "S"; sb.title = "Solo - only the solo rows play";
      sb.onclick = function () { L.rows[r].solo = !L.rows[r].solo; paintPads(); changed(); };
      el.appendChild(sel); el.appendChild(lis); el.appendChild(mb); el.appendChild(sb);
      var ks = [
        KN.knob({ label: "Vol", size: 26, color: HUES[r], def: 0.8, get: function () { return L.rows[r].vol; }, set: function (n) { L.rows[r].vol = Math.round(n * 100) / 100; changed(); }, text: function () { return Math.round(L.rows[r].vol * 100) + "%"; } }),
        KN.knob({ label: "Pitch", size: 26, color: HUES[r], def: 0.5, steps: 49, bipolar: true, get: function () { return (L.rows[r].pitch + 24) / 48; }, set: function (n) { L.rows[r].pitch = Math.round(n * 48 - 24); changed(); }, text: function () { var v = L.rows[r].pitch; return (v > 0 ? "+" : "") + v + " st"; } }),
        KN.knob({ label: "Pan", size: 26, color: HUES[r], def: 0.5, bipolar: true, get: function () { return (L.rows[r].pan + 1) / 2; }, set: function (n) { L.rows[r].pan = Math.round((n * 2 - 1) * 100) / 100; changed(); }, text: function () { var v = L.rows[r].pan; return Math.abs(v) < 0.02 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100); } }),
      ];
      ks[0].el.setAttribute("aria-label", "Row " + (r + 1) + " volume"); ks[1].el.setAttribute("aria-label", "Row " + (r + 1) + " pitch"); ks[2].el.setAttribute("aria-label", "Row " + (r + 1) + " pan");
      K.rows[r] = ks; ks.forEach(function (k) { el.appendChild(k.el); });
      var st = doc.createElement("div"); st.className = "systeps";
      for (var gi = 0; gi < 4; gi++) {
        var grp = doc.createElement("div"); grp.className = "grp";
        for (var k = 0; k < 4; k++) {
          var s = gi * 4 + k, b = doc.createElement("button"); b.type = "button"; b.dataset.r = r; b.dataset.s = s;
          grp.appendChild(b);
        }
        st.appendChild(grp);
      }
      el.appendChild(st);
      // a sound file dropped on the row: into the library and into this row
      el.addEventListener("dragover", function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], "Files") >= 0) { e.preventDefault(); el.classList.add("drop"); } });
      el.addEventListener("dragleave", function () { el.classList.remove("drop"); });
      el.addEventListener("drop", function (e) { el.classList.remove("drop"); if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); if (O.upload) O.upload(e.dataTransfer.files, r); });
      rows.appendChild(el);
    });
    var sw = $("sySwingK");
    var lv = $("syLVolK");   // 2.973.0
    if (lv) { lv.innerHTML = ""; K.lvol = KN.knob({ label: "Vol", size: 28, color: "#38e1ff", def: 1 / 1.5, get: function () { return lvol / 1.5; }, set: function (n) { setVol(Math.round(n * 150) / 100); }, text: function () { return Math.round(lvol * 100) + "%"; } });
      K.lvol.el.title = "The looper's volume - its rows and the drum pads (the keyboard has its own VOLUME knob)"; K.lvol.el.setAttribute("aria-label", "Looper volume"); lv.appendChild(K.lvol.el); }
    if (sw) { sw.innerHTML = ""; K.swing = KN.knob({ label: "Swing", size: 28, color: "#ffd23a", def: 0, get: function () { return L.swing / 0.5; }, set: function (n) { L.swing = Math.round(n * 50) / 100; changed(); }, text: function () { return Math.round(L.swing * 200) + "%"; } }); sw.appendChild(K.swing.el); }
    paintPads();
  }
  /** once: the pads (the rows are rebuilt, #syRows stays) */
  function wirePads() {
    var rows = $("syRows"); if (!rows) return;
    // the pads: click / right-click / Shift = accent; drag paints what the first pad became
    rows.addEventListener("pointerdown", function (e) {
      var b = e.target.closest && e.target.closest(".systeps button"); if (!b || (e.button !== 0 && e.button !== 2)) return;
      e.preventDefault();
      var r = +b.dataset.r, s = +b.dataset.s, v = C.toggle(L, L.pat, r, s, e.button === 2 || e.shiftKey);
      S.paint = v; paintPads(); changed();
    });
    rows.addEventListener("pointermove", function (e) {
      if (S.paint == null || !e.buttons) return;
      var el = doc.elementFromPoint(e.clientX, e.clientY), b = el && el.closest && el.closest(".systeps button"); if (!b) return;
      var r = +b.dataset.r, s = +b.dataset.s;
      if (L.pats[L.pat][r][s] !== S.paint) { set(r, s, S.paint); paintPads(); changed(); }
    });
    root.addEventListener("pointerup", function () { S.paint = null; });
    rows.addEventListener("contextmenu", function (e) { if (e.target.closest && e.target.closest(".systeps button")) e.preventDefault(); });
    rows.addEventListener("click", function (e) {   // Enter on a focused pad
      var b = e.target.closest && e.target.closest(".systeps button"); if (!b || e.detail !== 0) return;
      C.toggle(L, L.pat, +b.dataset.r, +b.dataset.s, e.shiftKey); paintPads(); changed();
    });
  }
  function wire() {
    var on = function (id, f) { var el = $(id); if (el) el.onclick = f; };
    on("syPlay", function () { play(); });
    on("syLRec", function () { rec(); });
    on("syLSend", function () { if (R.take && O.send) O.send(R.take, "Loop take"); });
    on("syChain", function () { L.chain = !L.chain; paintPads(); changed(); });
    on("syClear", function () { var g = L.pats[L.pat]; g.forEach(function (row) { for (var s = 0; s < row.length; s++) row[s] = 0; }); paintPads(); changed(); msg("Pattern " + C.PAT_NAMES.charAt(L.pat) + " cleared"); });
    on("syCopy", function () {
      if (L.pat >= C.NPAT - 1) { msg("H is the last pattern - pick an earlier one to copy forward", true); return; }
      L.pats[L.pat + 1] = L.pats[L.pat].map(function (row) { return row.slice(); }); L.pat++; paintPads(); changed();
      msg("Copied to " + C.PAT_NAMES.charAt(L.pat));
    });
    var bpm = $("syBpm");
    if (bpm) bpm.onchange = function () { var v = Math.round(+bpm.value); if (!(v >= 40 && v <= 240)) v = L.bpm; L.bpm = v; bpm.value = v; changed(); };
  }

  /* ---------------- the outside ---------------- */
  function init(o) { O = o; wire(); wirePads(); build(); paintRec(); }
  function setLists(my, sfx) {
    lists.my = (my || []).slice(); lists.sfx = (sfx || []).slice();
    doc.querySelectorAll("#syRows .syr select").forEach(function (sel) { fillSelect(sel, L.rows[+sel.closest(".syr").dataset.r].snd); });
  }
  function setLoop(j) { var was = S.playing; if (was) play(false); L = C.cleanLoop(j); build(); if (was) play(true); }
  function assign(r, snd) { if (!C.okSnd(snd) || !L.rows[r]) return false; L.rows[r].snd = snd; forget(snd); buffer(snd).catch(function () { /* said */ }); paintPads(); changed(); return true; }
  function info() {
    return { recording: !!(R.rec && R.rec.on()), take: R.take ? Math.round(R.take.seconds * 100) / 100 : 0, playing: S.playing, step: S.now, pat: L.pat, playPat: S.nowPat, bpm: L.bpm, swing: L.swing, chain: L.chain, hits: S.hits,
             rows: L.rows.map(function (r) { return { snd: r.snd, name: sndName(r.snd), vol: r.vol, pitch: r.pitch, pan: r.pan, mute: r.mute, solo: r.solo, ready: !!(bufs[r.snd] && bufs[r.snd].ready) }; }),
             on: L.pats[L.pat].map(function (row) { return row.join(""); }) };
  }
  root.H3SynthLoop = { init: init, play: play, playing: function () { return S.playing; }, render: render, buffer: buffer, forget: forget, setLists: setLists,
                       loop: function () { return L; }, setLoop: setLoop, assign: assign, audition: audition, hit: hit, recordHit: recordHit, flash: flash, changed: changed, bus: out, vol: function () { return lvol; }, setVol: function (v) { var r = setVol(v); if (K.lvol) K.lvol.draw(); return r; }, rec: rec, endRec: endRec, take: function () { return R.take; }, setTake: function (t) { R.take = t || null; paintRec(); }, info: info, paint: paintPads, sndName: sndName, HUES: HUES };
})(typeof window !== "undefined" ? window : globalThis);
