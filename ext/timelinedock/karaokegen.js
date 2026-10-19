/* bitGen Studio — the timeline's 🎤 KARAOKE GENERATOR (2.380.0).
 *
 * Tim (verbatim): "add a karaoke generator to timeline".
 *
 * 🎤 in the timeline's menu bar opens a dialog (titlebar): the song (a sound clip on the timeline, or a sound asset),
 * the part (the whole clip / song, or the ruler selection), its lyrics (lyrics/<song>.txt - edited here, saved on
 * Generate), 🎤 Style (static/karaokestyle.js) and Generate. POST /api/karaoke/song (lib/karaoke.queueSong) renders a
 * transparent overlay at the canvas's picture size; when the job is done it goes on the Karaoke layer
 * (tlPlaceKaraoke), lined up with the song on the timeline. Explanations: ❔ help (static/help/timeline.html#karaoke).
 *
 * 2.408.0 (Tim: "please add an edit lyrics box to the kareoke dialog - some of the words are wrong"): ✎ Edit lyrics -
 * when the song has no lyrics on file the box is filled with the words speech-to-text heard (the karaoke showed exactly
 * those), so the wrong ones can be corrected; ⏱ Words & timing lists every word the overlay will show with its time
 * (▶ hears it) - a word, or its start / end, corrected there is kept for this song (POST /api/karaoke/words) until its
 * lyrics change. Saving lyrics re-times the words against the song.
 *
 * 2.410.0 (Tim: "make the kareoke and tools dialog into floating dockers, it will dock next to the preview canvas,
 * either left or right. this will make it easier to edit the words and timing while previewing"): 🎤 Karaoke is a
 * DOCKER now (TlStageDock - stagedock.js), not a dialog: it floats, or docks left / right of the preview canvas (◧ ◨,
 * or dragged to the canvas's edge; the first time it docks on the right), so the canvas keeps playing beside it.
 * ⏱ Words & timing follows the preview: the word being sung is lit (the list scrolls to it while it plays), its time
 * is a button that puts the preview there, ⤓ beside a start / end sets it to where the preview is, and 👁 draws the
 * corrected words over the canvas (a draft - the canvas only, never the movie) so a fix is seen at once.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return typeof tl === "object" && tl && typeof renderTimeline === "function" && !!window.TlStageDock && !!window.TlCanvas && !!$("tlCanvasCol"); } catch (e) { return false; } }
  function boot() { if (!$("tlKaraokeGen")) return; if (!ready()) { setTimeout(boot, 50); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function start() {
    var choices = [], lyricsWas = "";
    var dlg = null, panel = null;
    var CSS = ""
      + "#kgDlg .kg-tabs{display:flex;gap:4px;align-items:center;margin-bottom:4px;flex-wrap:wrap}#kgDlg .kg-tabs button{padding:1px 8px;font-size:.7rem}"
      + "#kgDlg .kg-tabs button.on{outline:1px solid var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
      + "#kgDlg .kg-tabs label{display:inline-flex;gap:3px;align-items:center;font-size:.68rem;color:var(--dim,#9a917f);margin-left:auto}"
      + "#kgDlg .kg-note{color:var(--dim,#9a917f);font-size:.68rem;flex-basis:100%}"
      + "#kgDlg .kg-lyr{display:flex;flex-direction:column;flex:1;min-height:0}"
      + "#kgDlg #kgWords{flex:1;min-height:80px;overflow:auto;border:1px solid var(--line,#3a342a);border-radius:4px;padding:2px 4px}"
      + "#kgDlg .kg-w{display:grid;grid-template-columns:22px 50px minmax(56px,1fr) 52px 18px 52px 18px 18px 18px;gap:3px;align-items:center;padding:1px 0;border-radius:3px}"
      // 2.433.0: ◀ ▶ nudges; the line under the preview marker lit
      + "#kgDlg .kg-w .nd{padding:0;font-size:.6rem}#kgDlg .kg-w.nowln{background:rgba(245,158,44,.10);box-shadow:inset 3px 0 0 var(--tiger,#f59e2c)}"
      + "#kgDlg .kg-nud{display:flex;gap:4px;align-items:center;font-size:.68rem;color:var(--dim,#9a917f);margin-bottom:3px;flex-wrap:wrap}#kgDlg .kg-nud input{width:58px;font-size:.7rem}"
      + "#kgDlg .kg-w.ln{border-top:1px dashed var(--line,#3a342a);margin-top:2px;padding-top:3px}"
      + "#kgDlg .kg-w.now{background:rgba(245,158,44,.22)}#kgDlg .kg-w.now input[data-k=text]{color:var(--tiger,#f59e2c);font-weight:600}"
      + "#kgDlg .kg-w input{font-size:.72rem;min-width:0;width:100%}#kgDlg .kg-w button{padding:0 3px;font-size:.66rem;min-width:0}"
      + "#kgDlg .kg-w .t{font-family:var(--mono,monospace);color:var(--dim,#9a917f);font-size:.64rem;border:0;background:none;text-align:left;cursor:pointer}"
      + "#kgDlg .kg-w .t:hover{color:var(--tiger,#f59e2c);text-decoration:underline}"
      + "#kgDlg .kg-body{display:flex;flex-direction:column;gap:8px;padding:10px 12px;font-size:.78rem;flex:1;min-height:0;overflow:auto}"
      + "#kgDlg .kg-row{display:grid;grid-template-columns:52px 1fr;gap:8px;align-items:center}"
      + "#kgDlg .kg-row.grow{align-items:stretch;flex:1;min-height:0}"
      + "#kgDlg select,#kgDlg textarea{width:100%;font-size:.76rem;min-width:0}"
      + "#kgDlg textarea{flex:1;min-height:120px;resize:none;font-family:var(--body)}"
      + "#kgDlg .kg-foot{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:6px;padding:8px 12px 10px;border-top:1px solid var(--line,#3a342a);flex:none}"
      + "#kgDlg .kg-msg{margin-right:auto;color:var(--dim,#9a917f);font-size:.72rem;align-self:center;flex-basis:100%}";

    function build() {
      if (dlg) return dlg;
      if (!$("kgStyle")) { var st = document.createElement("style"); st.id = "kgStyle"; st.textContent = CSS; document.head.appendChild(st); }
      // 2.410.0: a docker beside the preview canvas (stagedock.js), the first time on its right
      panel = TlStageDock.make({ id: "kgDlg", key: "kg", title: "🎤 Karaoke", label: "Karaoke", titleId: "kgTitle", closeId: "kgClose",
                                 w: 440, h: 620, side: "R", onShow: function (on) { if (on) followOn(); else followOff(); } });
      dlg = panel.el;
      var body = document.createElement("div");
      body.className = "kg-body";
      body.innerHTML = '<label class="kg-row" for="kgSong"><span>Song</span><select id="kgSong"></select></label>'
        + '<label class="kg-row" for="kgPart"><span>Part</span><select id="kgPart"><option value="all">Whole</option><option value="sel">Ruler selection</option></select></label>'
        + '<div class="kg-row grow"><span>Lyrics</span><div class="kg-lyr">'
        + '<div class="kg-tabs"><button type="button" class="ghost on" id="kgTabText" title="The song\'s lyrics - correct any wrong word here, then Generate">✎ Edit lyrics</button>'
        + '<button type="button" class="ghost" id="kgTabWords" title="Every word the overlay will show, with its time - fix one word or its timing while the preview plays">⏱ Words &amp; timing</button>'
        + '<label title="Draw the words over the preview canvas while you correct them (the canvas only - never the movie)"><input type="checkbox" id="kgDraft"> 👁 on canvas</label>'
        + '<span class="kg-note" id="kgNote"></span></div>'
        + '<textarea id="kgLyrics" spellcheck="true" aria-label="Edit lyrics"></textarea><div id="kgWords" hidden></div></div></div>';
      var foot = document.createElement("div");
      foot.className = "kg-foot";
      foot.innerHTML = '<span class="kg-msg" id="kgMsg" aria-live="polite"></span>'
        + '<button type="button" class="ghost" id="kgStyleBtn">🎤 Style</button>'
        + '<button type="button" class="ghost" id="kgSave" title="Keep the corrected lyrics / words for this song without making an overlay now (the video docker\'s scene overlays use them too)">💾 Save words</button>'
        + '<button type="button" class="go" id="kgGo" style="width:auto;margin-top:0;padding:6px 22px">Generate</button>';
      dlg.appendChild(body); dlg.appendChild(foot);
      $("kgSave").addEventListener("click", function () { saveOnly(); });   // 2.408.0
      $("kgStyleBtn").addEventListener("click", function () { if (window.KaraokeStyle) window.KaraokeStyle.open(); });
      $("kgSong").addEventListener("change", loadLyrics);
      $("kgTabText").addEventListener("click", function () { tab("text"); });
      $("kgTabWords").addEventListener("click", function () { tab("words"); });
      $("kgLyrics").addEventListener("keydown", function (e) { e.stopPropagation(); });
      $("kgDraft").checked = sget("kg.draft", "1") !== "0";
      $("kgDraft").addEventListener("change", function () { sset("kg.draft", $("kgDraft").checked ? "1" : "0"); mark(); });
      $("kgGo").addEventListener("click", generate);
      return dlg;
    }
    function sget(k, d) { try { return typeof store === "object" ? store.get(k, d) : d; } catch (e) { return d; } }
    function sset(k, v) { try { if (typeof store === "object") store.set(k, v); } catch (e) { /* fine */ } }
    function mark() { try { if (window.TlCanvas) TlCanvas.mark(); } catch (e) { /* fine */ } }
    function shown() { return !!(panel && panel.shown()); }
    function say(t) { if ($("kgMsg")) $("kgMsg").textContent = t || ""; }
    function clipLen(c) { try { return typeof effDur === "function" ? effDur(c) : Math.max(0, (+c.out || 0) - (+c.in || 0)); } catch (e) { return 0; } }
    /* the songs: every sound clip on the timeline (placed: its start / in / length), then the other sound assets */
    function gather() {
      var out = [];
      (tl.audio || []).forEach(function (L, i) {
        (L.clips || []).forEach(function (c) {
          out.push({ song: String(c.name || "").split(/[\\/]/).pop(), clip: c,
                     label: (L.name || "A" + (i + 1)) + " · " + c.name + " @ " + (+c.start || 0).toFixed(2) + "s" });
        });
      });
      return fetch("/api/passets").then(function (r) { return r.json(); }).then(function (j) {
        var have = {}; out.forEach(function (o) { have[o.song] = true; });
        ((j && j.sound) || []).forEach(function (a) {
          if (!have[a.name] && /\.(wav|mp3|flac|ogg|opus|m4a|aac)$/i.test(a.name)) out.push({ song: a.name, clip: null, label: a.name });
        });
        return out;
      }).catch(function () { return out; });
    }
    /* 2.408.0: the lyrics box, the word list */
    var words = null, wordsDirty = false, fixedNow = false, audio = null;
    function note(t) { if ($("kgNote")) $("kgNote").textContent = t || ""; }
    function tab(which) {
      $("kgTabText").classList.toggle("on", which === "text"); $("kgTabWords").classList.toggle("on", which === "words");
      $("kgLyrics").hidden = which !== "text"; $("kgWords").hidden = which !== "words";
      if (which === "words") loadWords();
      mark();
    }
    function fetchWords(song, fresh) {
      return fetch("/api/karaoke/words?song=" + encodeURIComponent(song) + (fresh ? "&fresh=1" : ""))
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
    }
    function loadLyrics() {
      var ch = choices[+$("kgSong").value]; if (!ch) return;
      $("kgLyrics").value = ""; lyricsWas = ""; words = null; wordsDirty = false; note(""); tab("text");
      fetch("/api/karaoke/lyrics?song=" + encodeURIComponent(ch.song)).then(function (r) { return r.json(); })
        .then(function (j) {
          $("kgLyrics").value = (j && j.text) || ""; lyricsWas = $("kgLyrics").value;
          if (lyricsWas.trim()) { note("The lyrics on file (lyrics/" + ch.song.replace(/\.[^.]+$/, "") + ".txt) - correct any word, then Generate."); return; }
          // no lyrics on file: the karaoke shows what speech-to-text heard - put those words in the box to be corrected
          note("No lyrics on file - listening to the song for its words…");
          return fetchWords(ch.song).then(function (w) {
            if (choices[+$("kgSong").value] !== ch) return;
            words = w.words; fixedNow = !!w.fixed;
            if (!$("kgLyrics").value.trim()) $("kgLyrics").value = w.text || "";
            note(w.lyrics ? "" : "No lyrics on file - these are the words speech-to-text heard. Correct the wrong ones (or paste the real lyrics), then Generate.");
          }).catch(function (e) { note("No lyrics on file - type or paste them here (" + (e.message || e) + ")."); });
        }).catch(function () { /* none */ });
    }
    function tc(t) { t = Math.max(0, +t || 0); var m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2); }
    function hear(ch, w) {
      try { if (audio) audio.pause(); } catch (e) { /* gone */ }
      audio = new Audio("/passets/sound/" + encodeURIComponent(ch.song));
      var from = Math.max(0, w.start - 0.4), to = w.end + 0.4;
      audio.currentTime = from;
      audio.addEventListener("timeupdate", function () { if (audio.currentTime >= to) audio.pause(); });
      audio.play().catch(function () { /* autoplay */ });
    }
    function paintWords(ch) {
      var L = $("kgWords"), onTl = !!(ch && ch.clip);
      var nS = KGN() ? KGN().DEF.small : 0.05, nB = KGN() ? KGN().DEF.big : 0.25;
      L.innerHTML = '<div class="kg-nud" title="◀ ▶ on a word: click = the word by the nudge · Shift+click = by the larger nudge · Ctrl+click = the word and every word after it · Shift+Ctrl+click = them all by the larger nudge">'
        + 'Nudge <input type="number" id="kgNudge" min="0.01" max="5" step="0.01" value="' + sget("kg.nudge", String(nS)) + '" aria-label="Nudge (s)"> s'
        + ' · Shift <input type="number" id="kgNudgeBig" min="0.01" max="10" step="0.01" value="' + sget("kg.nudgeBig", String(nB)) + '" aria-label="Larger nudge (s)"> s'
        + ' <span>· Ctrl = this + the words after it</span></div>'
        + (fixedNow ? '<div class="kg-tabs"><span class="kg-note">These include your corrections.</span>'
        + '<button type="button" class="ghost" id="kgUndoWords">↺ undo my corrections</button></div>' : "")
        + (onTl ? "" : '<div class="kg-note">This song is not on the timeline - put it on a sound layer to time the words against the preview.</div>')
        + words.map(function (w, i) {
          var ln = i && w.line !== words[i - 1].line;
          return '<div class="kg-w' + (ln ? " ln" : "") + '" data-i="' + i + '"><button type="button" class="ghost" data-hear="' + i + '" title="Hear it">▶</button>'
            + '<button type="button" class="t" data-go="' + i + '" title="' + (onTl ? "Put the preview here" : "The word starts here (in the song)") + '">' + tc(w.start) + "</button>"
            + '<input type="text" data-k="text" value="' + String(w.text).replace(/"/g, "&quot;") + '" aria-label="Word">'
            + '<input type="number" data-k="start" step="0.05" min="0" value="' + w.start + '" title="Starts (s in the song)" aria-label="Starts">'
            + '<button type="button" class="ghost" data-set="start" title="Starts where the preview is">⤓</button>'
            + '<input type="number" data-k="end" step="0.05" min="0" value="' + w.end + '" title="Ends (s in the song)" aria-label="Ends">'
            + '<button type="button" class="ghost" data-set="end" title="Ends where the preview is">⤓</button>'
            + '<button type="button" class="ghost nd" data-nd="-1" title="Nudge left (earlier) - Shift: the larger nudge · Ctrl: + every word after it" aria-label="Nudge left">◀</button>'
            + '<button type="button" class="ghost nd" data-nd="1" title="Nudge right (later) - Shift: the larger nudge · Ctrl: + every word after it" aria-label="Nudge right">▶</button></div>';
        }).join("");
      Array.prototype.forEach.call(L.querySelectorAll("input[data-k]"), function (el) {
        el.addEventListener("keydown", function (e) { e.stopPropagation(); });
        el.addEventListener("change", function () {
          var w = words[+el.closest("[data-i]").dataset.i];
          w[el.dataset.k] = el.dataset.k === "text" ? el.value.trim() : Math.max(0, +el.value || 0);
          corrected(el.closest("[data-i]"), w);
        });
      });
      Array.prototype.forEach.call(L.querySelectorAll("[data-hear]"), function (b) { b.onclick = function () { hear(ch, words[+b.dataset.hear]); }; });
      Array.prototype.forEach.call(L.querySelectorAll("[data-go]"), function (b) { b.onclick = function () { goWord(ch, words[+b.dataset.go]); }; });
      Array.prototype.forEach.call(L.querySelectorAll("[data-set]"), function (b) { b.onclick = function () { setFromPreview(ch, b); }; });
      // 2.433.0: ◀ ▶ - the word (and with Ctrl every word after it) by the nudge / the larger one (Shift)
      Array.prototype.forEach.call(L.querySelectorAll("[data-nd]"), function (b) { b.onclick = function (e) { nudgeWord(+b.closest("[data-i]").dataset.i, +b.dataset.nd, e); }; });
      ["kgNudge", "kgNudgeBig"].forEach(function (id) {
        var el = $(id); if (!el) return;
        el.addEventListener("keydown", function (e) { e.stopPropagation(); });
        el.addEventListener("change", function () { var v = Math.max(0.01, +el.value || 0); el.value = v; sset(id === "kgNudge" ? "kg.nudge" : "kg.nudgeBig", String(v)); });
      });
      var u = $("kgUndoWords");
      if (u) u.onclick = function () {
        fetch("/api/karaoke/words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ song: ch.song, words: [] }) })
          .then(function () { words = null; wordsDirty = false; loadWords(); });
      };
      nowRow = -1; follow(true); mark();
    }
    function KGN() { return window.KGNudge || null; }
    function nudgeWord(i, dir, e) {
      if (!words || !KGN()) return;
      var pl = KGN().plan(e, dir, +($("kgNudge") || {}).value, +($("kgNudgeBig") || {}).value);
      var was = +words[i].start || 0, moved = KGN().nudge(words, i, pl.amount, pl.following), did = Math.round((words[i].start - was) * 100) / 100;
      if (!moved.length) { note("Already at the start of the song."); return; }
      moved.forEach(function (k) {
        var row = $("kgWords").querySelector('.kg-w[data-i="' + k + '"]'); if (!row) return;
        row.querySelector('input[data-k="start"]').value = words[k].start; row.querySelector('input[data-k="end"]').value = words[k].end;
        var t = row.querySelector(".t"); if (t) t.textContent = tc(words[k].start);
      });
      corrected(null, words[i]);
      note((moved.length > 1 ? moved.length + " words" : "\u201c" + words[i].text + "\u201d") + " moved " + (did > 0 ? "+" : "") + did.toFixed(2) + " s" + (did !== pl.amount ? " (to the start of the song)" : "") + " - Generate keeps these times for this song.");
      follow(true);
    }
    function corrected(row, w) {
      wordsDirty = true; note("Corrected - Generate keeps these words and times for this song.");
      if (row) { var t = row.querySelector(".t"); if (t) t.textContent = tc(w.start); }
      mark();
    }
    /* 2.410.0: the song <-> the preview. The song's clip on the timeline maps the preview's time to the song's seconds
       (TlCanvas.srcAt - a 🎬 retimed clip too) and back. */
    function chNow() { return choices[+(($("kgSong") || {}).value)] || null; }
    function clipLive(ch) {
      if (!ch || !ch.clip) return null;
      var ok = (tl.audio || []).some(function (L) { return (L.clips || []).indexOf(ch.clip) >= 0; });
      return ok ? ch.clip : null;
    }
    function pvT() { try { return +TlCanvas.state.t || 0; } catch (e) { return 0; } }
    function songAt(ch, t) {
      var c = clipLive(ch); if (!c) return null;
      var s0 = +c.start || 0, len = clipLen(c);
      if (t < s0 - 1e-3 || (len && t > s0 + len + 1e-3)) return null;
      try { return TlCanvas.srcAt ? TlCanvas.srcAt(c, t) : (+c.in || 0) + (t - s0); } catch (e) { return (+c.in || 0) + (t - s0); }
    }
    function tlAt(ch, st) {
      var c = clipLive(ch); if (!c) return null;
      var s0 = +c.start || 0, len = clipLen(c) || 0, fx = c.fx || {};
      if (!(fx.reverse || fx.ramp || fx.remap)) {
        var r = +fx.speed > 0 ? +fx.speed : 1, t = s0 + (st - (+c.in || 0)) / r;
        return t >= s0 - 1e-3 && t <= s0 + len + 1e-3 ? t : null;
      }
      var best = null, bd = 1e9;                       // reversed / ramped: the closest frame
      for (var k = 0; k <= Math.ceil(len * 50); k++) { var tt = s0 + k / 50, d = Math.abs(songAt(ch, tt) - st); if (d < bd) { bd = d; best = tt; } }
      return bd < 0.1 ? best : null;
    }
    function goWord(ch, w) {
      var t = tlAt(ch, w.start);
      if (t == null) { note(clipLive(ch) ? "That word is outside the song clip's trim on the timeline." : "Put the song on the timeline to preview its words."); return; }
      TlCanvas.go(t);
      follow(true);
    }
    function setFromPreview(ch, b) {
      var row = b.closest("[data-i]"), w = words[+row.dataset.i], st = songAt(ch, pvT());
      if (st == null) { note(clipLive(ch) ? "The preview is not inside the song clip - move it over the song first." : "Put the song on the timeline to time its words against the preview."); return; }
      st = Math.round(st * 100) / 100;
      if (b.dataset.set === "start") { w.start = st; if (w.end <= st) w.end = Math.round((st + 0.2) * 100) / 100; }
      else { w.end = Math.max(st, w.start + 0.05); w.end = Math.round(w.end * 100) / 100; }
      row.querySelector('input[data-k="start"]').value = w.start; row.querySelector('input[data-k="end"]').value = w.end;
      corrected(row, w);
    }
    /** the word being sung at the preview's position (-1: none) */
    var nowRow = -1, followT = null;
    function wordAt(st) {
      if (!words || st == null) return -1;
      var hit = -1;
      for (var i = 0; i < words.length; i++) { if (words[i].start <= st + 1e-3) hit = i; else break; }
      if (hit >= 0 && st > words[hit].end + 0.6 && (hit + 1 >= words.length || words[hit + 1].start - st > 0.3)) return -1;   // a pause
      return hit;
    }
    var nowLine = null;
    function follow(force) {
      if (!shown() || !words || $("kgWords").hidden) return;
      var st = songAt(chNow(), pvT()), i = wordAt(st);
      // 2.433.0: the line under the marker - every word of it lit
      var la = KGN() ? KGN().lineAt(words, st) : null, ln = la ? la.line : null;
      if (i === nowRow && ln === nowLine && !force) return;
      nowRow = i; nowLine = ln;
      Array.prototype.forEach.call($("kgWords").querySelectorAll(".kg-w.nowln"), function (r) { r.classList.remove("nowln"); });
      if (ln != null) words.forEach(function (w, k) { if (w.line === ln) { var rr = $("kgWords").querySelector('.kg-w[data-i="' + k + '"]'); if (rr) rr.classList.add("nowln"); } });
      Array.prototype.forEach.call($("kgWords").querySelectorAll(".kg-w.now"), function (r) { r.classList.remove("now"); });
      var row = i >= 0 ? $("kgWords").querySelector('.kg-w[data-i="' + i + '"]') : null;
      if (!row) return;
      row.classList.add("now");
      var a = document.activeElement, busy = a && $("kgWords").contains(a) && a.tagName === "INPUT";
      if (!busy && (force || (TlCanvas.state && TlCanvas.state.playing))) {
        var L = $("kgWords"), top = row.offsetTop - L.offsetTop;
        if (top < L.scrollTop || top + row.offsetHeight > L.scrollTop + L.clientHeight) L.scrollTop = Math.max(0, top - L.clientHeight / 3);
      }
    }
    function followOn() { if (!followT) followT = setInterval(function () { follow(false); }, 90); }
    function followOff() { if (followT) { clearInterval(followT); followT = null; } mark(); }
    /* 👁 the draft: the line being sung over the canvas (TlCanvas.onDraw - the view only, never the picture or a snapshot) */
    function draftWords() { return words && words.length ? words : null; }
    function paintDraft(ctx, v) {
      if (!shown() || !$("kgDraft") || !$("kgDraft").checked) return;
      var ch = chNow(), ws = draftWords(); if (!ws) return;
      var st = songAt(ch, pvT()); if (st == null) return;
      var la = KGN() ? KGN().lineAt(ws, st) : null;       // 2.433.0: the same line the list lights
      if (!la) return;
      var ln = la.line, line = ws.filter(function (w) { return w.line === ln; });
      if (!line.length) return;
      var z = v.view.z, fs = Math.max(10, Math.round(v.H * 0.055 * z)), p = v.toScreen(v.W / 2, v.H * 0.13);
      ctx.save();
      ctx.font = "700 " + fs + "px Arial, sans-serif"; ctx.textBaseline = "middle";
      var parts = line.map(function (w) { return { w: w, txt: String(w.text || "") }; }), sp = ctx.measureText(" ").width;
      var total = parts.reduce(function (a, q) { q.wd = ctx.measureText(q.txt).width; return a + q.wd; }, 0) + sp * (parts.length - 1);
      var x = p.x - total / 2;
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x - fs * 0.5, p.y - fs * 0.75, total + fs, fs * 1.5);
      ctx.lineWidth = Math.max(2, fs / 8); ctx.strokeStyle = "rgba(0,0,0,.85)";
      parts.forEach(function (q) {
        ctx.strokeText(q.txt, x, p.y);
        ctx.fillStyle = q.w.start <= st ? "#f59e2c" : "#ffffff";
        ctx.fillText(q.txt, x, p.y);
        x += q.wd + sp;
      });
      ctx.font = "600 " + Math.max(9, Math.round(fs * 0.35)) + "px Arial, sans-serif"; ctx.fillStyle = "rgba(245,158,44,.9)"; ctx.textBaseline = "top";
      ctx.fillText("🎤 draft", p.x - total / 2 - fs * 0.45, p.y + fs * 0.78);
      ctx.restore();
    }
    if (window.TlCanvas && TlCanvas.onDraw) TlCanvas.onDraw(paintDraft);
    function loadWords() {
      var ch = choices[+$("kgSong").value]; if (!ch) return;
      var text = $("kgLyrics").value;
      if (text.trim() && text !== lyricsWas) {
        // the box was edited: save it first, so the list is the new lyrics timed against the song
        $("kgWords").innerHTML = '<div class="kg-note">Timing the edited lyrics…</div>';
        return saveLyricsNow(ch, text).then(function () { words = null; return loadWords(); });
      }
      if (words) { paintWords(ch); return; }
      $("kgWords").innerHTML = '<div class="kg-note">Timing the words…</div>';
      fetchWords(ch.song).then(function (w) { words = w.words; fixedNow = !!w.fixed; wordsDirty = false; paintWords(ch); note(w.how); })
        .catch(function (e) { $("kgWords").innerHTML = '<div class="kg-note">' + String(e.message || e).replace(/</g, "&lt;") + "</div>"; });
    }
    function saveLyricsNow(ch, text) {
      return fetch("/api/karaoke/lyrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ song: ch.song, text: text }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); lyricsWas = text; return j; }); });
    }
    /* 2.408.0: open({song, onSaved}) - the video docker's ✎ opens it on the board's song and remakes its scenes'
       overlays once the words are saved; a click on the timeline's 🎤 passes an event (no options) */
    var afterSave = null;
    function open(opts) {
      var o = opts && opts.song !== undefined ? opts : {};
      afterSave = typeof o.onSaved === "function" ? o.onSaved : null;
      build(); say("");
      gather().then(function (list) {
        choices = list;
        $("kgSong").innerHTML = list.length ? list.map(function (o, i) { return '<option value="' + i + '">' + String(o.label).replace(/</g, "&lt;") + "</option>"; }).join("")
          : '<option value="">-</option>';
        if (o.song) { var hit = list.findIndex(function (c) { return c.song === o.song; }); if (hit >= 0) $("kgSong").value = String(hit); }
        $("kgPart").value = tl.sel ? "sel" : "all";
        $("kgPart").options[1].disabled = !tl.sel;
        $("kgGo").disabled = !list.length;
        panel.show(true);                              // 2.410.0: a docker - the preview keeps playing beside it
        loadLyrics();
      });
    }
    /* what to render: the song's own seconds [start, start + dur] and where it goes on the timeline */
    function plan(ch) {
      var useSel = $("kgPart").value === "sel" && tl.sel;
      if (ch.clip) {
        var c = ch.clip, s0 = +c.start || 0, len = clipLen(c) || 0, a = s0, b = s0 + len;
        if (useSel) { a = Math.max(a, tl.sel.a); b = Math.min(b, tl.sel.b); }
        if (len && b - a < 0.2) return { error: "the ruler selection does not cover that song clip" };
        return { start: (+c.in || 0) + (a - s0), dur: len ? b - a : 0, at: a };
      }
      if (useSel) return { start: 0, dur: tl.sel.b - tl.sel.a, at: tl.sel.a };
      return { start: 0, dur: 0, at: 0 };
    }
    /** the edited lyrics box (re-timed) or the corrected word rows, kept for the song -> a promise */
    function saveWordsNow(ch) {
      var text = $("kgLyrics").value;
      return text.trim() && text !== lyricsWas ? saveLyricsNow(ch, text)
        : wordsDirty && words ? fetch("/api/karaoke/words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ song: ch.song, words: words }) })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); wordsDirty = false; return j; }); })
          : Promise.resolve(null);
    }
    function saveOnly() {
      var ch = choices[+$("kgSong").value]; if (!ch) return;
      say("…");
      saveWordsNow(ch).then(function (r) {
        say(r ? "saved - new overlays use these words" : "nothing changed");
        if (r && afterSave) { try { afterSave(ch.song); } catch (e) { /* the caller's */ } }
      }).catch(function (e) { say(String(e.message || e)); });
    }
    function generate() {
      var ch = choices[+$("kgSong").value]; if (!ch) return;
      var p = plan(ch); if (p.error) { say(p.error); return; }
      var S = (window.TlCanvas && TlCanvas.state) || {};
      $("kgGo").disabled = true; say("…");
      // the edited lyrics box re-times the words; otherwise corrected words (⏱) are kept as they are
      saveWordsNow(ch).then(function (saved) {
        if (saved && afterSave) { try { afterSave(ch.song); } catch (e) { /* the caller's */ } }
        return fetch("/api/karaoke/song", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ song: ch.song, start: p.start, dur: p.dur, width: S.W || 1280, height: S.H || 720 }) });
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
        .then(function (j) {
          $("kgGo").disabled = false; say("Rendering the overlay - it goes on the Karaoke layer when it is done.");
          if (typeof logLine === "function") logLine("[karaoke] " + ch.song + ": " + j.words + " word(s), " + j.how + " - rendering the overlay");
          if (typeof refreshJobs === "function") refreshJobs();
          var wait = typeof awaitJob === "function" ? awaitJob(j.job) : Promise.resolve("done");
          return wait.then(function (st) {
            if (st !== "done") { if (typeof appNote === "function") appNote("The karaoke overlay " + st + " - see the job log.", "Karaoke"); return; }
            return fetch("/api/jobs/" + encodeURIComponent(j.job)).then(function (r) { return r.json(); }).then(function (jj) {
              var out = String(jj.output || "").split(/[\\/]/).pop(); if (!out) return;
              if (typeof window.tlPlaceKaraoke === "function")
                window.tlPlaceKaraoke({ name: out, start: p.at, dur: j.dur, label: ch.song });
              say("The overlay is on the Karaoke layer (" + out + ").");
              if (typeof refreshAssets === "function") refreshAssets();
            });
          });
        }).catch(function (e) { $("kgGo").disabled = false; say(String(e.message || e)); });
    }
    $("tlKaraokeGen").addEventListener("click", open);
    window.TlKaraokeGen = { open: open, plan: function (i) { return plan(choices[i]); }, tab: tab, words: function () { return words; },
                            // 2.410.0: the docker
                            close: function () { if (panel) panel.show(false); }, shown: shown, dock: function (s) { build(); panel.dock(s); },
                            side: function () { return panel ? panel.side() : ""; }, nowRow: function () { return nowRow; },
                            songAt: function (t) { return songAt(chNow(), t); }, follow: follow };
  }
})();
