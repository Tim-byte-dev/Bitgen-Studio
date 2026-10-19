/* bitGen Studio — ext/timelinedock/multicam.js (2.416.0): 🎥 MULTI-CAMERA editing (window.TlMulticam).
 *
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
 *
 *   1. Put the camera angles on the timeline (any layers), open 🎥, tick them (the first = the reference) and pick
 *      whose sound the cut plays -> ⇆ Sync by sound (lib/multicam.js + scripts/audiosync.py): the angles line up.
 *   2. V1 becomes the PROGRAM - the cut between the angles (static/multicam.js program) - and a "🎥 Sound" layer plays
 *      the chosen angle's sound under it (the angles' own sound is out). Clips that were on V1 and are not angles go
 *      to a hidden layer "V1 before multi-camera"; the angles' own clips leave their layers.
 *   3. Play, and press 1 - 9 (or click an angle) to cut to that angle at that moment - live, Premiere's multi-camera
 *      monitor. The grid shows every angle in step with the position marker; the one playing is outlined.
 *   ⇲ Flatten keeps the cuts as ordinary clips and ends multi-camera.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlDlg && window.TlCanvas && window.H3Multicam && typeof tl !== "undefined" && typeof mkLayer === "function"); } catch (e) { return false; } }
  var X = function () { return window.H3Multicam; };
  var dlg = null, raf = 0, vids = [];
  var CSS = "#tlMulticamDlg .tmc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}"
    + "#tlMulticamDlg .tmc-tile{position:relative;border:2px solid transparent;border-radius:6px;overflow:hidden;background:#000;cursor:pointer;aspect-ratio:16/9}"
    + "#tlMulticamDlg .tmc-tile.on{border-color:#e03131}#tlMulticamDlg .tmc-tile video{width:100%;height:100%;object-fit:contain;display:block}"
    + "#tlMulticamDlg .tmc-tile .lb{position:absolute;left:4px;top:3px;font-size:.7rem;background:rgba(0,0,0,.6);padding:0 5px;border-radius:3px}"
    + "#tlMulticamDlg .tmc-tile.out video{opacity:.25}#tlMulticamDlg .tmc-tile .us{position:absolute;right:4px;top:3px;font-size:.62rem;background:#7a4a10;padding:0 4px;border-radius:3px}";
  function fps() { return (tl.tc && +tl.tc.fps) || 25; }
  function mc() { return tl.multicam || null; }
  function say(t) { var m = $("tmcMsg"); if (m) m.textContent = t || ""; }
  function save() { if (typeof tlSave === "function") tlSave(); }
  function urlOf(a) {
    if (window.TlProxy) { var p = TlProxy.url({ name: a.name, src: a.src }); if (p) return p; }
    return a.src === "output" ? "/outputs/" + encodeURIComponent(a.name) : "/passets/video/" + encodeURIComponent(a.name);
  }
  /** the video clips on the timeline that could be angles */
  function candidates() {
    var out = [];
    (tl.video || []).forEach(function (c) { if (c && !c.m3d && !c.text && !c.nest) out.push({ c: c, lk: "v1", where: "V1" }); });
    (tl.vlayers || []).forEach(function (L, i) { if (!L || L.karaoke) return; (L.clips || []).forEach(function (c) { if (c && !c.m3d && !c.text) out.push({ c: c, lk: "vl:" + i, where: L.name || "V" + (i + 2) }); }); });
    return out;
  }
  /** V1 = the program, the "🎥 Sound" layer = the sound angle - the clips already there are kept (and updated) where
   *  they match, so the canvas does not reload the angles at every cut */
  function rebuild() {
    var m = mc(); if (!m) return;
    var old = (tl.video || []).filter(function (c) { return c && c.mc != null; }), prog = X().program(m, fps());
    tl.video = prog.map(function (p) {
      var o = old.find(function (q) { return q.mc === p.mc && Math.abs(q.start - p.start) < 1e-3 && q.name === p.name; });
      return o ? Object.assign(o, p) : p;
    });
    var sc = X().soundClip(m), L = (tl.audio || []).find(function (x) { return x && x.mcSound; });
    if (!L) { L = mkLayer("🎥 Sound", []); L.mcSound = true; L.role = "voice"; tl.audio = tl.audio || []; tl.audio.unshift(L); }
    var keep = L.clips[0];
    L.clips = sc ? [keep && keep.name === sc.name ? Object.assign(keep, sc) : sc] : [];
    save();
    if (typeof renderTimeline === "function") renderTimeline();
    TlCanvas.mark();
  }
  /** cut to angle i at the position marker */
  function cut(i) {
    var m = mc(); if (!m || !m.angles[i]) return;
    var t = (TlCanvas.state && TlCanvas.state.t) || 0;
    m.cuts = X().switchAt(m, t, i, fps());
    rebuild(); mark();
    if (typeof logLine === "function") logLine("[multicam] angle " + (i + 1) + " from " + t.toFixed(2) + " s");
  }
  function make() {
    var cand = candidates(), picked = [];
    Array.prototype.forEach.call(document.querySelectorAll("#tmcPick input[data-i]"), function (b) { if (b.checked) picked.push(cand[+b.dataset.i]); });
    if (picked.length < 2) { say("Tick at least two angles."); return; }
    if (picked.length > 9) { say("At most 9 angles (the keys 1 - 9)."); return; }
    var snd = Math.max(0, Math.min(picked.length - 1, +$("tmcSound").value || 0));
    say("Syncing " + picked.length + " angles by their sound…"); $("tmcMake").disabled = true;
    fetch("/api/multicam/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names: picked.map(function (p) { return p.c.name; }) }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); })
      .then(function (j) {
        var res = X().fromSync(picked.map(function (p) { return p.c; }), j.results || []);
        var m = { angles: res.angles, sound: snd, cuts: [] };
        m.cuts = [{ t: X().range(m).a, a: 0 }];
        // the angles leave their layers; what else was on V1 goes to a hidden layer
        var set = picked.map(function (p) { return p.c; });
        var restV1 = (tl.video || []).filter(function (c) { return set.indexOf(c) < 0; });
        (tl.vlayers || []).forEach(function (L) { L.clips = (L.clips || []).filter(function (c) { return set.indexOf(c) < 0; }); });
        tl.vlayers = (tl.vlayers || []).filter(function (L, i) { return (L.clips || []).length || !picked.some(function (p) { return p.lk === "vl:" + i; }); });
        if (restV1.length) { var H = mkLayer("V1 before multi-camera", restV1); H.visible = false; tl.vlayers.unshift(H); }
        tl.video = [];
        tl.multicam = m;
        rebuild(); paint();
        say(res.bad.length ? "⚠ not synced (left where they were): " + res.bad.map(function (b) { return b.name + " - " + b.why; }).join("; ") : "Synced by sound: " + j.results.map(function (r) { return r.name + " +" + r.lag.toFixed(2) + " s"; }).join(", ") + ". Play and press 1 - " + m.angles.length + ".");
      })
      .catch(function (e) { say("⚠ " + (e.message || e)); if ($("tmcMake")) $("tmcMake").disabled = false; });
  }
  function flatten() {
    var m = mc(); if (!m) return;
    (tl.video || []).forEach(function (c) { delete c.mc; });
    (tl.audio || []).forEach(function (L) { if (L.mcSound) { delete L.mcSound; L.name = "Sound"; (L.clips || []).forEach(function (c) { delete c.mcSound; }); } });
    delete tl.multicam; save();
    if (typeof renderTimeline === "function") renderTimeline();
    TlCanvas.mark(); paint();
  }
  function mark() {
    var m = mc(); if (!m) return;
    var t = (TlCanvas.state && TlCanvas.state.t) || 0, a = X().angleAt(m, t);
    Array.prototype.forEach.call(document.querySelectorAll("#tlMulticamDlg .tmc-tile"), function (el, i) { el.classList.toggle("on", i === a); });
  }
  function loop() {
    raf = 0;
    if (!dlg || !dlg.isOpen() || !mc()) return;
    var m = mc(), S = TlCanvas.state || {}, t = S.t || 0, pl = !!S.playing;
    vids.forEach(function (v, i) {
      var A = m.angles[i]; if (!A || !v) return;
      var want = t - A.off, inside = want >= 0 && want <= A.dur;
      v.parentNode.classList.toggle("out", !inside);
      if (!inside) { if (!v.paused) v.pause(); return; }
      if (pl) { if (Math.abs((v.currentTime || 0) - want) > 0.3) { try { v.currentTime = want; } catch (e) { /* not ready */ } } if (v.paused) v.play().catch(function () { /* fine */ }); }
      else { if (!v.paused) v.pause(); if (Math.abs((v.currentTime || 0) - want) > 0.04 && !v.seeking) { try { v.currentTime = want; } catch (e) { /* not ready */ } } }
    });
    mark();
    raf = requestAnimationFrame(loop);
  }
  function paint() {
    if (!$("tmcCss")) { var st = document.createElement("style"); st.id = "tmcCss"; st.textContent = CSS; document.head.appendChild(st); }
    vids.forEach(function (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) { /* gone */ } }); vids = [];
    var m = mc(), B = dlg.body;
    if (!m) {
      var cand = candidates();
      B.innerHTML = '<div class="fx-dim">Put every camera angle of the same moment on the timeline (any layers), tick them here - the first ticked is the reference - and pick whose sound the cut plays.</div>'
        + '<div id="tmcPick" style="max-height:36vh;overflow:auto">' + (cand.length ? cand.map(function (x, i) {
          return '<div class="fx-row"><label><input type="checkbox" data-i="' + i + '"' + (i < 9 ? " checked" : "") + "> " + esc(x.c.name) + ' <span class="fx-dim">· ' + esc(x.where) + " · " + (+x.c.start || 0).toFixed(2) + " s</span></label></div>";
        }).join("") : '<div class="fx-dim">No video clips on the timeline.</div>') + "</div>"
        + '<div class="fx-row"><label>sound from the <select id="tmcSound">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (k) { return '<option value="' + (k - 1) + '">' + (k === 1 ? "1st" : k === 2 ? "2nd" : k === 3 ? "3rd" : k + "th") + "</option>"; }).join("") + "</select> ticked angle</label>"
        + '<span style="flex:1"></span><button type="button" id="tmcMake"' + (cand.length < 2 ? " disabled" : "") + '>⇆ Sync by sound → multi-camera</button></div><div class="fx-dim" id="tmcMsg" aria-live="polite"></div>';
      $("tmcMake").onclick = make;
      return;
    }
    B.innerHTML = '<div class="tmc-grid">' + m.angles.map(function (a, i) {
      return '<div class="tmc-tile" data-a="' + i + '" title="Cut to this angle at the position marker (key ' + (i + 1) + ')"><video muted playsinline preload="auto"></video><span class="lb">' + (i + 1) + " · " + esc(a.name) + "</span>"
        + (a.unsynced ? '<span class="us">not synced</span>' : "") + "</div>";
    }).join("") + "</div>"
      + '<div class="fx-row"><label>sound from <select id="tmcSnd">' + m.angles.map(function (a, i) { return '<option value="' + i + '"' + (i === (m.sound || 0) ? " selected" : "") + ">" + (i + 1) + " · " + esc(a.name) + "</option>"; }).join("") + "</select></label>"
      + '<span class="fx-dim">' + m.cuts.length + " cut(s)</span><span style=\"flex:1\"></span>"
      + '<button type="button" class="ghost" id="tmcFlat" title="Keep the cuts as ordinary clips and end multi-camera">⇲ Flatten</button></div>'
      + '<div class="fx-dim">▶ Play the canvas and press <b>1 - ' + m.angles.length + '</b> (or click an angle) to cut to it there - live. The red outline = the angle playing at the position marker.</div><div class="fx-dim" id="tmcMsg" aria-live="polite"></div>';
    Array.prototype.forEach.call(B.querySelectorAll(".tmc-tile"), function (el) {
      var i = +el.dataset.a, v = el.querySelector("video"); v.src = urlOf(m.angles[i]); vids[i] = v;
      el.onclick = function () { cut(i); };
    });
    $("tmcSnd").onchange = function () { m.sound = +$("tmcSnd").value; rebuild(); };
    $("tmcFlat").onclick = flatten;
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function onKey(e) {
    if (!dlg || !dlg.isOpen() || !mc() || e.ctrlKey || e.metaKey || e.altKey) return;
    var tg = e.target; if (tg && (/INPUT|TEXTAREA|SELECT/.test(tg.tagName) || tg.isContentEditable)) return;
    var k = /^Digit([1-9])$/.exec(e.code || "") || /^Numpad([1-9])$/.exec(e.code || "");
    if (!k) return;
    var i = +k[1] - 1; if (!mc().angles[i]) return;
    e.preventDefault(); e.stopPropagation(); cut(i);
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlMulticamDlg", title: "Multi-camera", width: 760, onClose: function () { if (raf) cancelAnimationFrame(raf); raf = 0; vids.forEach(function (v) { try { v.pause(); } catch (e) { /* fine */ } }); } });
      dlg.foot.innerHTML = '<span style="flex:1"></span><button type="button" id="tmcDone">Done</button>';
      $("tmcDone").onclick = function () { dlg.close(); };
      document.addEventListener("keydown", onKey, true);
    }
    paint(); dlg.open();
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlMulticamBtn", "🎥", "Multi-camera: angles synced by their sound, cut between them live (1 - 9)", open);
  }
  window.TlMulticam = { open: open, cut: cut, rebuild: rebuild, flatten: flatten, state: function () { return mc(); } };
  boot();
})();
