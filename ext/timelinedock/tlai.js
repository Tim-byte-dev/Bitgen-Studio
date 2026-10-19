/* bitGen Studio — ext/timelinedock/tlai.js (2.420.0): 🤖 AI INSIDE THE TIMELINE (window.TlAI).
 *
 * Tim: "yes, please add your 2 suggestions" - with "use the prompt docker for all prompts" (2.419.0): every render here
 * takes its words from the PROMPT DOCKER and its negative from the ⊖ NEGATIVE DOCKER, and renders with the selected
 * video style (MiniMax H3 / Wan through /api/generate, LTX through /api/ltx).
 *
 *   🔁 New take        the selected video clip rendered again in its own slot (same start, length, place, keyframes):
 *                      the old file stays a TAKE - ⇆ switches between them (c.takes / c.take); "start from its first
 *                      frame" keeps the shot's opening picture
 *   ⇥ Extend           N more seconds continuing from the clip's LAST frame, placed right after it (the clips after it
 *                      on its layer move on to make room)
 *   🎞 B-roll          the empty stretch of V1 under the position marker filled (optionally continuing from the clip
 *                      before it), or a CUTAWAY over the ruler selection on a new video layer (its sound off - V1's sound
 *                      carries on under it)
 *   ✂ Cut to the beat  the beats of a sound (scripts/beats.py): ⚑ beat markers, or the selected clip cut on every Nth
 *                      beat (pieces of the same file - no time removed)
 * The maths: static/tlai.js (H3TlAi); the server: lib/tlAi.js (frames, probe, beats). */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlDlg && window.TlCanvas && window.H3TlAi && typeof tl === "object" && tl); } catch (e) { return false; } }
  var dlg = null, busy = false, lastBeats = null;
  function A() { return H3TlAi; }
  function say(t) { var m = $("taiMsg"); if (m) m.textContent = t; if (t && typeof logLine === "function") logLine("[🤖] " + t); }
  function j(url, body) {
    return fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().then(function (x) { if (!r.ok || x.ok === false) throw new Error(x.error || "HTTP " + r.status); return x; }); });
  }
  function promptText() { var p = $("prompt"); return p ? p.value.trim() : ""; }
  function negText() { return window.H3Neg ? H3Neg.get() : ""; }
  function save() { if (typeof tlSave === "function") tlSave(); if (typeof renderTimeline === "function") renderTimeline(); try { TlCanvas.mark(); TlCanvas.paintLayers(); } catch (e) { /* closed */ } }
  function sel() { try { return TlCanvas.selClip ? TlCanvas.selClip() : null; } catch (e) { return null; } }
  function isVideo(s) { return !!(s && s.c && s.Ly && (s.Ly.kind === "v1" || s.Ly.kind === "vl") && !s.c.m3d && !s.c.text && !s.c.adjust && s.c.name); }
  function listOf(lk) { if (lk === "v1") return tl.video; var m = /^vl:(\d+)$/.exec(lk || ""); return m && tl.vlayers[+m[1]] ? tl.vlayers[+m[1]].clips : null; }
  function setList(lk, arr) { if (lk === "v1") tl.video = arr; else { var m = /^vl:(\d+)$/.exec(lk || ""); if (m && tl.vlayers[+m[1]]) tl.vlayers[+m[1]].clips = arr; } }

  /* ------------------------------------------------------------------ one render: the prompt docker + ⊖ + the style */
  function frameBlob(name, t) {
    return j("/api/tlai/frame", { name: name, t: t }).then(function (r) { return fetch(r.url); }).then(function (r) { if (!r.ok) throw new Error("the frame could not be read"); return r.blob(); });
  }
  /** -> Promise<{name, src, dur, w, h}> - a new video of `secs` seconds (first = a PNG blob for its first frame) */
  function render(secs, first, why) {
    var prompt = promptText();
    if (!prompt) return Promise.reject(new Error("write what to render in the prompt docker (P) first"));
    var S = TlCanvas.state, sz = A().size(S.W || 1280, S.H || 720, 1280);
    var ltx = typeof curLtxStyle === "function" ? curLtxStyle() : null, neg = negText();
    var fd = new FormData(), url;
    fd.append("prompt", prompt);
    if (neg) fd.append("negative", neg);
    if ($("videoStyleSel") && $("videoStyleSel").value) fd.append("video_style_id", $("videoStyleSel").value);
    fd.append("width", String(sz.w)); fd.append("height", String(sz.h)); fd.append("seed", "-1");
    if (ltx) {
      url = "/api/ltx";
      fd.append("seconds", String(Math.max(1, Math.min(30, Math.ceil(secs)))));
      fd.append("ltx_mode", first ? "i2v" : "t2v");
    } else {
      url = "/api/generate";
      fd.append("mode", first ? "fl2va" : "t2va");
      fd.append("frames", String(A().frames(secs, 24)));
      fd.append("format", "mp4");
      if ($("cfg")) fd.append("cfg", $("cfg").value);
    }
    if (first) fd.append("references", first, "tlai_first.png");
    say((why || "rendering") + " - " + secs.toFixed(1) + " s with " + (ltx ? ltx.name : ($("videoStyleSel") && $("videoStyleSel").selectedOptions[0] ? $("videoStyleSel").selectedOptions[0].textContent : "the video model")) + "…");
    return fetch(url, { method: "POST", body: fd }).then(function (r) { return r.json().then(function (x) { if (!r.ok) throw new Error(x.error || "the render was refused"); return x; }); })
      .then(function (x) {
        if (typeof refreshJobs === "function") refreshJobs();
        if (typeof awaitJob !== "function") throw new Error("the page's job poll is missing - reload");
        return awaitJob(x.id).then(function (st) {
          if (st !== "done") throw new Error("the render " + st + " - see the job log");
          return fetch("/api/jobs/" + encodeURIComponent(x.id)).then(function (r) { return r.json(); });
        });
      })
      .then(function (g) {
        var out = (g.outputs && g.outputs[0]) || g.output || "";
        if (!out) throw new Error("the render made no file");
        return j("/api/tlai/probe", { name: String(out).split(/[\\/]/).pop() });
      })
      .then(function (p) { if (typeof refreshAssets === "function") refreshAssets(); return p; });
  }
  function guard(fn) {
    if (busy) { say("one AI render at a time - wait for it"); return Promise.resolve(null); }
    busy = true; paintBusy();
    return Promise.resolve().then(fn).catch(function (e) { say("✗ " + (e && e.message || e)); return null; })
      .then(function (r) { busy = false; paintBusy(); return r; });
  }
  function paintBusy() { ["taiTake", "taiExtend", "taiBroll", "taiBeats", "taiCutBeats", "taiMarkBeats"].forEach(function (id) { var b = $(id); if (b) b.disabled = busy; }); }

  /* ------------------------------------------------------------------ 🔁 a new take */
  function newTake() {
    return guard(function () {
      var s = sel();
      if (!isVideo(s)) throw new Error("select a video clip on V1 or a video layer first");
      var c = s.c, lk = s.Ly.lk, secs = Math.max(1, A().len(c));
      var keep = $("taiKeepStart") ? $("taiKeepStart").checked : true;
      return (keep ? frameBlob(c.name, +c.in || 0) : Promise.resolve(null))
        .then(function (fb) { return render(secs, fb, "🔁 a new take of " + c.name); })
        .then(function (p) {
          var arr = listOf(lk); if (!arr) throw new Error("its layer is gone");
          var i = arr.indexOf(c); if (i < 0) { var hit = sel(); c = hit && hit.c; i = arr.indexOf(c); }
          if (i < 0) throw new Error("the clip moved while it rendered - nothing replaced (the take is in the assets)");
          var nc = A().addTake(c, { name: p.name, src: p.src, in: 0, out: p.dur, dur: p.dur });
          arr[i] = nc;
          try { tlSelClip = nc; } catch (e) { /* fine */ }
          save(); paintTakes();
          say("🔁 take " + nc.takes.length + " of " + nc.takes.length + " in place (" + p.name + ") - ⇆ switches takes");
          return nc;
        });
    });
  }
  function useTake(i) {
    var s = sel(); if (!s || !s.c.takes) return null;
    var arr = listOf(s.Ly.lk); var k = arr ? arr.indexOf(s.c) : -1; if (k < 0) return null;
    var nc = A().useTake(s.c, i); arr[k] = nc;
    try { tlSelClip = nc; } catch (e) { /* fine */ }
    save(); paintTakes(); say("⇆ take " + (i + 1) + " of " + nc.takes.length);
    return nc;
  }
  function paintTakes() {
    var el = $("taiTakes"); if (!el) return;
    var s = sel(), c = s && s.c, t = c && c.takes;
    if (!t || t.length < 2) { el.innerHTML = '<option value="">' + (isVideo(s) ? "one take" : "select a video clip") + "</option>"; el.disabled = true; return; }
    el.disabled = false;
    el.innerHTML = t.map(function (x, i) { return '<option value="' + i + '"' + (i === (c.take == null ? 0 : c.take) ? " selected" : "") + ">take " + (i + 1) + " · " + esc(x.name) + "</option>"; }).join("");
  }

  /* ------------------------------------------------------------------ ⇥ extend */
  function extend() {
    return guard(function () {
      var s = sel();
      if (!isVideo(s)) throw new Error("select a video clip on V1 or a video layer first");
      var c = s.c, lk = s.Ly.lk, secs = Math.max(1, Math.min(30, +($("taiExtSecs") || {}).value || 4));
      var outS = (c.out != null ? +c.out : +c.dur || 0);
      return frameBlob(c.name, Math.max(0, outS - 0.05))
        .then(function (fb) { return render(secs, fb, "⇥ extending " + c.name); })
        .then(function (p) {
          var arr = listOf(lk); if (!arr) throw new Error("its layer is gone");
          var end = (+c.start || 0) + A().len(c), use = Math.min(secs, p.dur);
          var moved = A().rippleAfter(arr, end, use);
          var nc = { name: p.name, src: p.src, in: 0, out: use, dur: p.dur, start: end, opacity: c.opacity == null ? 1 : c.opacity };
          if (c.tf) nc.tf = JSON.parse(JSON.stringify(c.tf));
          moved.push(nc);
          moved.sort(function (a, b) { return (+a.start || 0) - (+b.start || 0); });
          setList(lk, moved);
          if (lk === "v1" && typeof resolveOverlaps === "function") resolveOverlaps();
          save();
          say("⇥ " + use.toFixed(1) + " s more after " + c.name + " (" + p.name + ")");
          return nc;
        });
    });
  }

  /* ------------------------------------------------------------------ 🎞 B-roll */
  function endT() { try { return typeof sceneEnd === "function" ? sceneEnd() : 0; } catch (e) { return 0; } }
  function broll() {
    return guard(function () {
      var how = ($("taiBrollHow") || {}).value || "gap";
      var S = TlCanvas.state, t = S.t || 0;
      if (how === "cut") {
        var r = tl.sel && tl.sel.b > tl.sel.a ? { a: tl.sel.a, b: tl.sel.b } : null;
        if (!r) throw new Error("drag across the ruler to select where the cutaway goes");
        return render(r.b - r.a, null, "🎞 a cutaway").then(function (p) {
          var use = Math.min(r.b - r.a, p.dur);
          var L = mkLayer("B-roll", [{ name: p.name, src: p.src, in: 0, out: use, dur: p.dur, start: r.a, opacity: 1, tf: { x: 0, y: 0, scale: 1, rot: 0 } }]);
          L.muted = true;                                   // V1's sound carries on under the cutaway
          tl.vlayers.push(L);
          if (typeof tlKaraokeOnTop === "function") tlKaraokeOnTop();
          save();
          say("🎞 cutaway " + r.a.toFixed(2) + " - " + (r.a + use).toFixed(2) + " s on " + L.name + " (" + p.name + ", sound off)");
          return L;
        });
      }
      var g = A().gapAt(tl.video || [], t, tl.sel && tl.sel.b > t ? tl.sel.b : endT());
      if (!g) throw new Error("put the position marker in an empty stretch of V1 (or select up to where it should end)");
      var cont = $("taiBrollCont") ? $("taiBrollCont").checked : true;
      var before = (tl.video || []).filter(function (c) { return Math.abs((+c.start || 0) + A().len(c) - g.a) < 0.02; })[0] || null;
      var go = cont && before ? frameBlob(before.name, Math.max(0, (before.out != null ? +before.out : +before.dur || 0) - 0.05)) : Promise.resolve(null);
      return go.then(function (fb) { return render(g.b - g.a, fb, "🎞 B-roll for " + g.a.toFixed(2) + " - " + g.b.toFixed(2) + " s"); })
        .then(function (p) {
          var use = Math.min(g.b - g.a, p.dur);
          tl.video.push({ name: p.name, src: p.src, in: 0, out: use, dur: p.dur, start: g.a, opacity: 1 });
          tl.video.sort(function (a, b) { return (+a.start || 0) - (+b.start || 0); });
          save();
          say("🎞 B-roll in the gap " + g.a.toFixed(2) + " - " + (g.a + use).toFixed(2) + " s (" + p.name + ")");
          return p;
        });
    });
  }

  /* ------------------------------------------------------------------ ✂ cut to the beat */
  function beatSources() {
    var out = [];
    (tl.audio || []).forEach(function (L, i) { (L.clips || []).forEach(function (c, k) { out.push({ key: "a:" + i + ":" + k, label: (L.name || "A" + (i + 1)) + " · " + c.name, c: c }); }); });
    (tl.video || []).forEach(function (c, k) { out.push({ key: "v1:" + k, label: "V1 · " + c.name, c: c }); });
    return out;
  }
  function findBeats() {
    return guard(function () {
      var key = ($("taiBeatSrc") || {}).value, s = beatSources().find(function (x) { return x.key === key; }) || beatSources()[0];
      if (!s) throw new Error("put a song on a sound layer (or a clip on V1) first");
      var c = s.c, i0 = +c.in || 0, len = A().len(c);
      say("♪ finding the beats of " + c.name + "…");
      return j("/api/tlai/beats", { name: c.name, start: i0, dur: len }).then(function (r) {
        lastBeats = { src: s.key, name: c.name, off: +c.start || 0, beats: r.beats || [], tempo: r.tempo };
        say("♪ " + (r.beats || []).length + " beats at " + (+r.tempo).toFixed(1) + " BPM in " + c.name);
        var b = $("taiBeatInfo"); if (b) b.textContent = (r.beats || []).length + " beats · " + (+r.tempo).toFixed(1) + " BPM";
        return lastBeats;
      });
    });
  }
  function every() { return Math.max(1, Math.min(16, Math.round(+($("taiEvery") || {}).value || 1))); }
  function markBeats() {
    if (!lastBeats) { say("♪ find the beats first"); return 0; }
    var ts = A().beatMarks(lastBeats.beats, lastBeats.off, every(), 0, 1e9), L = (window.H3Marks && Array.isArray(tl.seqMarkers)) ? tl.seqMarkers : [];
    ts.forEach(function (t, i) { var r = H3Marks.add(L, t, { name: "♪ " + (i + 1), color: "purple", fps: typeof TLFPS === "number" ? TLFPS : 24 }); L = r.list; });
    tl.seqMarkers = L;
    save(); if (window.TlMarks && TlMarks.paint) TlMarks.paint();
    say("⚑ " + ts.length + " beat marker(s)");
    return ts.length;
  }
  function cutBeats() {
    var s = sel();
    if (!lastBeats) { say("♪ find the beats first"); return 0; }
    if (!isVideo(s)) { say("select the video clip to cut on the beats"); return 0; }
    var c = s.c, lk = s.Ly.lk;
    if (c.fx && window.H3ClipFx && H3ClipFx.retimed(c.fx)) { say("✂ a sped-up / reversed clip: cut it on the beat markers by hand (⚑ Beat markers, then Ctrl+K)"); return 0; }
    var ts = A().beatCuts(lastBeats.beats, c, every(), lastBeats.off);
    if (!ts.length || !window.H3TextEdit) { say("no beat falls inside " + c.name); return 0; }
    var i0 = +c.in || 0, t0 = +c.start || 0;
    var srcT = ts.map(function (t) { return i0 + (t - t0); });                    // a straight clip: source = in + (t - start)
    var pieces = H3TextEdit.splitAt(c, srcT);
    var arr = listOf(lk); var k = arr.indexOf(c); if (k < 0) return 0;
    arr.splice.apply(arr, [k, 1].concat(pieces));
    save();
    say("✂ " + c.name + " cut on " + (pieces.length - 1) + " beat(s) (every " + every() + ")");
    return pieces.length - 1;
  }

  /* ------------------------------------------------------------------ the dialog */
  function paintPrompt() {
    var el = $("taiPrompt"); if (!el) return;
    var p = promptText(), n = negText();
    el.innerHTML = '<div class="pbchip ' + (p ? "docker" : "none") + '" id="taiPromptChip" role="button" tabindex="0"><span class="pbk">✎ prompt docker:</span><span class="pbt">' + esc(p || "empty - write what to render there (P)") + "</span></div>"
      + '<div class="fx-dim" style="margin-top:3px">⊖ ' + (n ? esc(n.slice(0, 120)) : "no negative (the style's own) - 2 opens the negative docker") + "</div>";
    $("taiPromptChip").onclick = function () { if (window.H3PromptBind) H3PromptBind.open(); };
  }
  function paint() {
    var src = beatSources();
    dlg.body.innerHTML = '<fieldset><legend>The words</legend><div id="taiPrompt"></div></fieldset>'
      + '<fieldset><legend>🔁 A new take of the selected clip</legend>'
      + '<div class="fx-row"><button type="button" id="taiTake">🔁 New take</button><label><input type="checkbox" id="taiKeepStart" checked> start from its first frame</label>'
      + '<select id="taiTakes" title="⇆ the clip\'s takes" style="flex:1"></select></div></fieldset>'
      + '<fieldset><legend>⇥ Extend the selected clip</legend>'
      + '<div class="fx-row"><label>seconds <input type="number" id="taiExtSecs" value="4" min="1" max="30" step="1" style="width:56px"></label><button type="button" id="taiExtend">⇥ Extend from its last frame</button></div></fieldset>'
      + '<fieldset><legend>🎞 B-roll</legend>'
      + '<div class="fx-row"><select id="taiBrollHow"><option value="gap">fill the empty stretch of V1 at the position marker</option><option value="cut">a cutaway over the ruler selection (a new layer, sound off)</option></select>'
      + '<label><input type="checkbox" id="taiBrollCont" checked> continue from the clip before</label><button type="button" id="taiBroll">🎞 Make B-roll</button></div></fieldset>'
      + '<fieldset><legend>✂ Cut to the beat</legend>'
      + '<div class="fx-row"><select id="taiBeatSrc" style="flex:1">' + (src.length ? src.map(function (x) { return '<option value="' + esc(x.key) + '">' + esc(x.label) + "</option>"; }).join("") : '<option value="">no sound on the timeline</option>') + "</select>"
      + '<button type="button" id="taiBeats">♪ Find the beats</button><span class="fx-dim" id="taiBeatInfo"></span></div>'
      + '<div class="fx-row"><label>every <input type="number" id="taiEvery" value="1" min="1" max="16" style="width:48px"> beat(s)</label>'
      + '<button type="button" id="taiMarkBeats">⚑ Beat markers</button><button type="button" id="taiCutBeats">✂ Cut the selected clip on the beats</button></div></fieldset>'
      + '<div class="fx-dim" id="taiMsg"></div>';
    ["taiExtSecs", "taiEvery"].forEach(function (id) { $(id).addEventListener("keydown", function (e) { e.stopPropagation(); }); });
    $("taiTake").onclick = newTake;
    $("taiTakes").onchange = function () { if ($("taiTakes").value !== "") useTake(+$("taiTakes").value); };
    $("taiExtend").onclick = extend;
    $("taiBroll").onclick = broll;
    $("taiBeats").onclick = findBeats;
    $("taiMarkBeats").onclick = markBeats;
    $("taiCutBeats").onclick = cutBeats;
    if (lastBeats && $("taiBeatSrc").querySelector('option[value="' + lastBeats.src + '"]')) { $("taiBeatSrc").value = lastBeats.src; $("taiBeatInfo").textContent = lastBeats.beats.length + " beats · " + (+lastBeats.tempo).toFixed(1) + " BPM"; }
    paintPrompt(); paintTakes(); paintBusy();
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlAiDlg", title: "AI in the timeline", width: 640 });
      dlg.foot.innerHTML = '<button type="button" id="taiDone">Done</button>';
      $("taiDone").onclick = function () { dlg.close(); };
      setInterval(function () { if (dlg && dlg.isOpen()) { paintPrompt(); if (!busy) paintTakes(); } }, 800);
    }
    paint(); dlg.open();
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlAiBtn", "🤖", "AI in the timeline: a new take of a clip, extend it, B-roll for a gap, cut to the beat (the prompt + ⊖ negative dockers)", open);
  }
  window.TlAI = { open: open, newTake: newTake, useTake: useTake, extend: extend, broll: broll, findBeats: findBeats, markBeats: markBeats, cutBeats: cutBeats,
                  render: render, beats: function () { return lastBeats; } };
  boot();
})();
