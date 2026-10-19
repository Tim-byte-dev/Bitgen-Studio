/* bitGen Studio — ext/timelinedock/textedit.js (2.408.0): 📝 EDIT BY TRANSCRIPT and ✂ SCENE CUTS on the timeline.
 *
 * Tim: "... continue with the premier catchup - do whats most useful next".
 *
 * 📝 Transcript (the timeline's toolbar): the selected clip's words (its file transcribed once on this machine -
 * POST /api/textedit/words, the same cache as 💬 Captions). Click words to choose them (shift-click = a run, or drag
 * across them), double-click one to go there; then ✂ Cut them, ⇥ Keep only them, remove the pauses longer than N s or
 * the filler words (um, uh …). The clip becomes pieces of the same file and the clips after it move up (ripple).
 * Every piece of that file on that layer stays in the list, so cuts can be made again and again; ↺ undoes the last.
 * ✂ Scene cuts (the same dialog): where the clip's shots change (POST /api/textedit/scenecuts) -> split it there.
 * The cutting is static/textedit.js (shared with the unit tests).
 * 2.414.0 (Tim: "lets do the medium jobs now"): the SCOPE - this clip / its whole layer / the whole sequence (V1, every
 * video layer and every 🗣 voice sound layer, in the order they play) as ONE transcript. A cut takes the words out of
 * whichever clip says them; the clips after it on that layer move up - and for the whole sequence, on EVERY layer (the
 * music, the pictures stay in step). Words are chosen per clip (data-u = the clip, data-i = the word in its file).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlDlg && window.H3TextEdit && window.TlCanvas && TlCanvas.selClip); } catch (e) { return false; } }
  var X = function () { return window.H3TextEdit; };
  var dlg = null, target = null, words = [], wordsBy = {}, chosen = {}, anchor = null, undo = [], busy = false, scope = "clip", us = [];
  var CSS = ".tte-text{line-height:1.9;max-height:44vh;overflow:auto;border:1px solid var(--line,#3a342a);border-radius:6px;padding:6px 8px;user-select:text}"
    + ".tte-w{padding:1px 2px;border-radius:3px;cursor:pointer}.tte-w:hover{background:rgba(255,255,255,.08)}"
    + ".tte-w.on{background:#c42b1c;color:#fff;text-decoration:line-through}.tte-w.fill{color:var(--dim,#9a917f);font-style:italic}"
    + ".tte-gap{display:inline-block;color:var(--dim,#9a917f);font-size:.62rem;padding:0 3px}.tte-piece{display:block;margin:6px 0 2px;color:var(--dim,#9a917f);font-size:.64rem}";
  function css() { if (!$("tteCss")) { var st = document.createElement("style"); st.id = "tteCss"; st.textContent = CSS; document.head.appendChild(st); } }
  function log(t) { if (typeof logLine === "function") logLine("[transcript] " + t); }
  function say(t) { var m = $("tteMsg"); if (m) m.textContent = t || ""; }
  function n(v, d) { var x = Number(v); return Number.isFinite(x) ? x : d; }
  function outOf(c) { return c.out != null ? n(c.out, 0) : n(c.dur, n(c.in, 0) + 5); }

  /** the selected clip's layer + every piece of its file on that layer */
  function pick() {
    var s = TlCanvas.selClip && TlCanvas.selClip();
    if (s && s.c && !s.c.m3d && !s.c.text && s.Ly.kind !== "img") { last = { name: s.c.name, kind: s.Ly.kind, L: s.Ly.L, lk: s.Ly.lk }; return last; }
    // no clip selected: the highlighted layer's clip under the position marker (or its first) - V1 when no layer is
    // highlighted (2.414.0) - else the last one used
    var lk = tl.selLayer || "v1", ph = (typeof playhead === "number" && isFinite(playhead)) ? playhead : 0, L = null, kind = "", list = [];
    if (lk === "v1") { kind = "v1"; L = typeof v1 === "function" ? v1() : tl.v1; list = tl.video || []; }
    else if (/^vl:\d+$/.test(lk)) { kind = "vl"; L = (tl.vlayers || [])[+lk.slice(3)]; list = (L && L.clips) || []; }
    else if (/^a:\d+$/.test(lk)) { kind = "aud"; L = (tl.audio || [])[+lk.slice(2)]; list = (L && L.clips) || []; }
    list = list.filter(function (c) { return c && !c.m3d && !c.text; });
    if (L && list.length) {
      var c = list.find(function (x) { return ph >= n(x.start, 0) && ph < n(x.start, 0) + (outOf(x) - n(x.in, 0)); }) || list[0];
      last = { name: c.name, kind: kind, L: L, lk: lk }; return last;
    }
    if (last && (last.kind === "v1" ? tl.video : (last.L.clips || [])).some(function (c) { return c.name === last.name; })) return last;
    if (scope === "seq" && X().units(tl, "seq").length) { var u0 = X().units(tl, "seq")[0]; last = { name: u0.c.name, kind: u0.lk === "v1" ? "v1" : /^a:/.test(u0.lk) ? "aud" : "vl", L: u0.lk === "v1" ? tl.v1 : null, lk: u0.lk }; return last; }
    return null;
  }
  var last = null;
  function lkOf(t) { return t.lk || (t.kind === "v1" ? "v1" : ""); }
  /** the clips the transcript covers now (2.414.0: by the scope) */
  function units() { us = X().units(tl, scope, { lk: lkOf(target), name: target.name }); return us; }
  function wordsOf(c) { return wordsBy[c.name] || []; }
  function key(u, i) { return u + "|" + i; }
  function chosenFor(u) { var out = []; Object.keys(chosen).forEach(function (k) { var p = k.split("|"); if (+p[0] === u) out.push(+p[1]); }); return out.sort(function (a, b) { return a - b; }); }
  function layerName(lk) {
    if (lk === "v1") return (tl.v1 && tl.v1.name) || "V1";
    var m = /^(vl|a):(\d+)$/.exec(lk); if (!m) return lk;
    var L = (m[1] === "vl" ? tl.vlayers : tl.audio)[+m[2]]; return (L && L.name) || lk;
  }

  function paintText() {
    var T = $("tteText"); if (!T) return;
    var list = units(), h = "", missing = [];
    if (!list.length) { T.innerHTML = '<div class="fx-dim">' + (scope === "clip" ? "That clip is no longer on the layer." : "Nothing on " + (scope === "seq" ? "the sequence" : "the layer") + " speaks.") + "</div>"; return; }
    list.forEach(function (u, k) {
      var p = u.c, wf = wordsBy[p.name];
      if (!wf) { missing.push(p.name); }
      var ws = X().within(wf || [], p), fill = {}; X().fillers(wf || []).forEach(function (i) { fill[i] = true; });
      h += '<span class="tte-piece">' + (scope === "clip" ? (list.length > 1 ? "piece " + (k + 1) + " · " : "") : esc(p.name) + " · " + esc(layerName(u.lk)) + " · ")
        + n(p.start, 0).toFixed(2) + " s on the timeline</span>";
      ws.forEach(function (w, j) {
        if (j && w.start - ws[j - 1].end >= 0.8) h += '<span class="tte-gap" title="a pause">⏸ ' + (w.start - ws[j - 1].end).toFixed(1) + "s</span> ";
        h += '<span class="tte-w' + (chosen[key(k, w.i)] ? " on" : "") + (fill[w.i] ? " fill" : "") + '" data-u="' + k + '" data-i="' + w.i + '" title="' + X().tlAt(p, w.start).toFixed(2) + ' s">' + esc(w.word) + "</span> ";
      });
      if (!wf) h += '<span class="fx-dim">(listening…)</span>';
      else if (!ws.length) h += '<span class="fx-dim">(no words in this ' + (scope === "clip" ? "piece" : "clip") + ")</span>";
    });
    T.innerHTML = h;
    var nsel = Object.keys(chosen).length;
    $("tteCut").disabled = !nsel; $("tteKeep").disabled = !nsel;
    $("tteSel").textContent = nsel ? nsel + " word(s) chosen" : "";
    $("tteUndo").disabled = !undo.length;
  }
  /** the chosen marks + the buttons, without rebuilding the words (a rebuild between two clicks loses the double-click) */
  function marks() {
    Array.prototype.forEach.call(document.querySelectorAll("#tteText .tte-w"), function (s) { s.classList.toggle("on", !!chosen[key(+s.dataset.u, +s.dataset.i)]); });
    var nsel = Object.keys(chosen).length;
    $("tteCut").disabled = !nsel; $("tteKeep").disabled = !nsel;
    $("tteSel").textContent = nsel ? nsel + " word(s) chosen" : "";
  }
  function wordAt(el) { var w = el && el.closest && el.closest(".tte-w"); return w ? { u: +w.dataset.u, i: +w.dataset.i, el: w } : null; }
  function wireText() {
    var T = $("tteText");
    T.addEventListener("click", function (e) {
      var w = wordAt(e.target); if (!w) return;
      var sel = window.getSelection && window.getSelection();
      if (!e.shiftKey && sel && !sel.isCollapsed && T.contains(sel.anchorNode)) return;   // a drag-selection: handled on mouseup
      if (e.shiftKey && sel) sel.removeAllRanges();
      if (e.shiftKey && anchor) {                     // a run: every word between the two in reading order (across clips too)
        var all = Array.prototype.slice.call(T.querySelectorAll(".tte-w")), a = all.indexOf(anchor.el), b = all.indexOf(w.el);
        if (a < 0) a = b;
        for (var k = Math.min(a, b); k <= Math.max(a, b); k++) chosen[key(+all[k].dataset.u, +all[k].dataset.i)] = true;
      } else if (chosen[key(w.u, w.i)]) delete chosen[key(w.u, w.i)]; else chosen[key(w.u, w.i)] = true;
      anchor = w; marks();
    });
    T.addEventListener("mouseup", function (e) {
      var sel = window.getSelection && window.getSelection();
      if (e.shiftKey || !sel || sel.isCollapsed || !T.contains(sel.anchorNode)) return;
      var r = sel.getRangeAt(0);
      Array.prototype.forEach.call(T.querySelectorAll(".tte-w"), function (s) { if (r.intersectsNode(s)) chosen[key(+s.dataset.u, +s.dataset.i)] = true; });
      sel.removeAllRanges(); marks();
    });
    T.addEventListener("dblclick", function (e) {
      var w = wordAt(e.target); if (!w) return;
      var u = us[w.u], wf = u && wordsOf(u.c); if (!u || !wf || !wf[w.i]) return;
      var t = X().tlAt(u.c, wf[w.i].start);
      try { if (typeof setPlayhead === "function") setPlayhead(t); } catch (x) { /* older core */ } TlCanvas.go(t);
    });
  }
  /** a snapshot of every layer's clips (↺) */
  function snap() {
    return { video: (tl.video || []).map(function (c) { return Object.assign({}, c); }),
      lay: X().layerKeys(tl).filter(function (k) { return k !== "v1"; }).map(function (k) { return { k: k, clips: X().listOf(tl, k).map(function (c) { return Object.assign({}, c); }) }; }) };
  }
  function restore(b) { tl.video = b.video; b.lay.forEach(function (x) { X().setList(tl, x.k, x.clips); }); }

  /** apply `rangesFor(unit, k)` (source ranges to take out) to every clip in the scope, last first (2.414.0: static/textedit.js applyUnits) */
  function apply(what, rangesFor) {
    var before = snap(), r;
    var list = units().map(function (u, k) { return Object.assign({ k: k }, u); });
    try { r = X().applyUnits(tl, list, function (u) { return rangesFor(u, u.k); }, scope === "seq"); }
    catch (e) { alert(e.message || e); return; }
    if (!r.made) { say("Nothing to take out."); return; }
    undo.push(before);
    chosen = {}; anchor = null;
    if (typeof resolveOverlaps === "function" && (scope === "seq" || lkOf(target) === "v1")) resolveOverlaps();
    if (typeof tlSave === "function") tlSave();
    if (typeof renderTimeline === "function") renderTimeline();
    TlCanvas.mark();
    say(what + ": " + r.total.toFixed(2) + " s taken out" + (r.made > 1 ? " of " + r.made + " clips" : "") + ", the clips after it moved up" + (scope === "seq" ? " on every layer." : "."));
    log(what + " - " + r.total.toFixed(2) + " s out of " + (scope === "clip" ? target.name : scope === "seq" ? "the sequence" : layerName(lkOf(target))));
    paintText();
  }
  function cutChosen() { var nn = Object.keys(chosen).length; apply("Cut " + nn + " word(s)", function (u, k) { var c = chosenFor(k); return c.length ? X().wordRanges(wordsOf(u.c), c) : []; }); }
  function keepChosen() {
    var nn = Object.keys(chosen).length;
    apply("Kept " + nn + " word(s)", function (u, k) { return X().keepRanges(wordsOf(u.c), chosenFor(k), n(u.c.in, 0), outOf(u.c)); });
  }
  function cutPauses() {
    var m = Math.max(0.2, +$("ttePause").value || 0.8);
    apply("Pauses over " + m + " s", function (u) { return wordsBy[u.c.name] ? X().pauseRanges(X().within(wordsOf(u.c), u.c), m, 0.15, n(u.c.in, 0), outOf(u.c)) : []; });
  }
  function cutFillers() {
    var any = false;
    apply("Filler words", function (u) { var f = X().fillers(wordsOf(u.c)); if (f.length) any = true; return f.length ? X().wordRanges(wordsOf(u.c), f) : []; });
    if (!any) say("No filler words (um, uh, erm, hmm …) heard.");
  }
  function doUndo() {
    var b = undo.pop(); if (!b) return;
    restore(b);
    if (typeof tlSave === "function") tlSave();
    if (typeof renderTimeline === "function") renderTimeline();
    TlCanvas.mark(); say("Undone."); paintText();
  }
  /* ✂ scene cuts stay with the clip (pieces of target.name on its layer) */
  function clipsOfT() { return X().listOf(tl, lkOf(target)); }
  function setClips(list) { X().setList(tl, lkOf(target), list); }
  function pieces() { return clipsOfT().filter(function (c) { return c.name === target.name; }).sort(function (a, b) { return n(a.start, 0) - n(b.start, 0); }); }
  function tlTime(piece, src) { return X().tlAt(piece, src); }
  function sceneCuts() {
    var ps = pieces(); if (!ps.length || busy) return;
    if (scope !== "clip") { say("Scene cuts work on one clip - set the scope to “this clip”."); return; }
    if (target.kind === "aud") { say("Scene cuts are for pictures - this is a sound clip."); return; }
    busy = true; say("Looking for shot changes…");
    fetch("/api/textedit/scenecuts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: target.name, threshold: +$("tteScene").value || 0.3 }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (j) {
        if ($("tteSceneMk") && $("tteSceneMk").checked && window.TlMarks) {      // 2.410.0: markers, the clip untouched
          var n0 = TlMarks.list().length;
          pieces().forEach(function (p) {
            (j.cuts || []).forEach(function (c) { if (c > n(p.in, 0) + 1e-3 && c < outOf(p) - 1e-3) TlMarks.add(tlTime(p, c), { name: "shot " + c.toFixed(2) + " s", color: "cyan" }); });
          });
          var made = TlMarks.list().length - n0;
          say(made ? "⚑ " + made + " marker(s) at the shot changes - the clip is not cut." : j.cuts.length ? "No shot change inside the clip's trim." : "No shot changes found (try a lower sensitivity number).");
          if (made) log("scene cuts: " + made + " marker(s) on " + target.name);
          return;
        }
        var before = snap(), splits = 0;
        try {
          pieces().forEach(function (p) {
            var parts = X().splitAt(p, j.cuts);
            if (parts.length > 1) { setClips(X().replace(clipsOfT(), p, parts, 0, false)); splits += parts.length - 1; }
          });
        } catch (e) { say(e.message || e); return; }
        if (!splits) { say(j.cuts.length ? "No shot change inside the clip's trim." : "No shot changes found (try a lower sensitivity number)."); return; }
        undo.push(before);
        if (typeof tlSave === "function") tlSave();
        if (typeof renderTimeline === "function") renderTimeline();
        TlCanvas.mark();
        say("Split at " + splits + " shot change(s).");
        log("scene cuts: " + target.name + " split " + splits + " time(s)");
        paintText();
      })
      .catch(function (e) { say("⚠ " + (e.message || e)); })
      .then(function () { busy = false; });
  }
  /** every file in the scope transcribed (each once - the server's cache; a fresh ↻ asks again) */
  function load(fresh) {
    chosen = {}; anchor = null;
    if (fresh) wordsBy = {};
    var names = units().map(function (u) { return u.c.name; }).filter(function (v, i, a) { return a.indexOf(v) === i && !wordsBy[v]; });
    paintText();
    if (!names.length) { words = wordsBy[target.name] || []; say(heard()); return Promise.resolve(); }
    say("Listening to " + names.length + " file(s)… (the first time takes a while; it is remembered)");
    if (!units().length || names.length === units().length) $("tteText").innerHTML = '<div class="fx-dim">Listening to ' + esc(names.join(", ")) + "… (the first time takes a while; it is remembered)</div>";
    var errs = [];
    return names.reduce(function (p, nm) {
      return p.then(function () {
        return fetch("/api/textedit/words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm, fresh: !!fresh }) })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
          .then(function (j) { wordsBy[nm] = j.words || []; if (scope !== "clip") paintText(); })
          .catch(function (e) { wordsBy[nm] = []; errs.push(nm + ": " + (e.message || e)); });
      });
    }, Promise.resolve()).then(function () {
      words = wordsBy[target.name] || [];
      if (errs.length && errs.length === names.length && scope === "clip") { $("tteText").innerHTML = '<div class="fx-dim">⚠ ' + esc(errs[0].replace(/^[^:]+: /, "")) + "</div>"; say(""); return; }
      paintText(); say(heard() + (errs.length ? " ⚠ " + errs.join("; ") : ""));
    });
  }
  function heard() {
    var list = units(), nw = 0; list.forEach(function (u) { nw += X().within(wordsOf(u.c), u.c).length; });
    if (scope === "clip") return words.length ? words.length + " word(s) heard in the file." : "No speech heard in this clip.";
    return nw ? nw + " word(s) across " + list.length + " clip(s)." : "No speech heard.";
  }
  function paint() {
    css();
    var p = pick();
    if (!p) { dlg.body.innerHTML = '<div class="fx-dim">Select a video or sound clip on the timeline canvas (or a layer above it), then open 📝 again.</div>'; dlg.foot.querySelector("#tteUndo") && (dlg.foot.querySelector("#tteUndo").disabled = true); return; }
    if (!target || target.name !== p.name || target.L !== p.L) { target = p; undo = []; }
    dlg.body.innerHTML = '<div class="fx-row"><b>' + esc(scope === "seq" ? "the whole sequence" : scope === "layer" ? "the whole layer" : target.name) + '</b><span class="fx-dim">'
      + (scope === "seq" ? "V1, the video layers and the 🗣 voice sound layers" : (target.kind === "aud" ? "sound" : "video") + " · " + esc((target.L && target.L.name) || target.lk)) + "</span>"
      + '<span style="flex:1"></span><label class="fx-dim" title="2.414.0: one transcript for this clip, its whole layer, or the whole sequence (a cut there moves every layer up)">scope '
      + '<select id="tteScope"><option value="clip">this clip</option><option value="layer">its whole layer</option><option value="seq">the whole sequence</option></select></label>'
      + '<button class="ghost" type="button" id="tteRe" title="Transcribe again">↻</button></div>'
      + '<div class="tte-text" id="tteText"></div>'
      + '<div class="fx-row"><span class="fx-dim" id="tteSel"></span><span style="flex:1"></span>'
      + '<button type="button" id="tteCut" title="Take the chosen words out (and close the gap)">✂ Cut them</button>'
      + '<button type="button" class="ghost" id="tteKeep" title="Keep only the chosen words">⇥ Keep only them</button></div>'
      + '<div class="fx-row"><button type="button" class="ghost" id="ttePauses">Remove pauses over</button><input type="number" id="ttePause" min="0.2" max="10" step="0.1" value="0.8" style="width:56px">s'
      + '<button type="button" class="ghost" id="tteFillers" title="um, uh, erm, hmm …">Remove filler words</button>'
      + '<span style="flex:1"></span><button type="button" class="ghost" id="tteScenes" title="Split the clip where its shots change">✂ Scene cuts</button>'
      + '<label class="fx-dim" title="Lower finds more (softer) changes">sensitivity <input type="number" id="tteScene" min="0.05" max="0.9" step="0.05" value="0.3" style="width:52px"></label>'
      + '<label class="fx-dim" title="2.410.0: drop a ⚑ marker at every shot change instead of cutting the clip"><input type="checkbox" id="tteSceneMk"> as markers</label></div>'
      + '<div class="fx-dim" id="tteMsg" aria-live="polite"></div>'
      + '<div class="fx-dim">Click words to choose them (shift-click a run, or drag across them); double-click one to go there.</div>';
    wireText();
    $("tteCut").onclick = cutChosen; $("tteKeep").onclick = keepChosen; $("ttePauses").onclick = cutPauses; $("tteFillers").onclick = cutFillers;
    $("tteScenes").onclick = sceneCuts; $("tteRe").onclick = function () { load(true); };
    $("tteScope").value = scope;
    $("tteScope").onchange = function () { scope = $("tteScope").value; chosen = {}; anchor = null; paint(); };
    ["ttePause", "tteScene"].forEach(function (id) { $(id).addEventListener("keydown", function (e) { e.stopPropagation(); }); });
    load(false);
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlTextDlg", title: "Transcript", width: 680 });
      dlg.foot.innerHTML = '<button class="ghost" type="button" id="tteUndo" title="Undo the last cut">↺ Undo</button><span style="flex:1"></span><button type="button" id="tteDone">Done</button>';
      $("tteUndo").onclick = doUndo; $("tteDone").onclick = function () { dlg.close(); };
    }
    paint(); dlg.open();
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlTextBtn", "📝", "Transcript: cut by words, pauses, fillers; scene cuts", open);
  }
  window.TlTextEdit = { open: open, setScope: function (v) { scope = v === "seq" || v === "layer" ? v : "clip"; if (dlg && dlg.isOpen()) paint(); return scope; },
    state: function () { return { words: words, wordsBy: wordsBy, chosen: chosen, target: target, undo: undo.length, scope: scope, units: us.length }; } };
  boot();
})();
