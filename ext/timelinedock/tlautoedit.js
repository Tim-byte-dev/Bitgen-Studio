/* bitGen Studio — ext/timelinedock/tlautoedit.js (2.894.0): ✨ AUTO EDIT on the timeline (window.TlAutoEdit).
 * Tim (verbatim): "https://github.com/Vincentwei1021/video-shotcraft, can we add these to timeline to automate video editing?"
 * (he chose "Our own Auto edit": video-shotcraft's editing craft built with the timeline's own keyframes - no Remotion).
 *
 *   ✨ on the timeline bar opens the box:
 *     What to edit     the clips already on this timeline, or pictures / videos ticked from Assets
 *     Music            a sound on this timeline or in the project - its beats found (scripts/beats.py), every cut on a beat;
 *                      none = a steady pace (beats a minute)
 *     Length / feel    the song's length or the seconds typed (whole bars); calm / promo / hype
 *     Words            ☑ titles on screen, ☑ title cards; the brief (the prompt docker's words to start with)
 *     ✨ Plan          the LLM plans the shots (lib/autoEdit.js - else bitGen's own plan): a storyboard to change - each
 *                      shot's beats, picture / video, move, the seam into it, its words and how they show
 *     ✔ Build          the edit onto a NEW timeline ("Auto edit N", the one you had kept) or onto this one: videos on two
 *                      video layers and pictures on two picture layers taking turns, titles on top, the song on ✨ Music
 *                      (the clips' own sound off, faded out at the end) - every move and seam as keyframes, so the
 *                      preview and ⚙ Compile show the same; then the check (a cut off the beat, a title too short …)
 * 2.895.0 (part 2): ☑ 👁 look at them first (the vision model describes each one - /api/autoedit/describe - and the LLM picks
 * shots by what is in them), ☑ 🔊 sound effects (bitGen's own whooshes / impacts / riser -> impact -> sparkle, pinned to the
 * picture - /api/autoedit/media makes them with the white flash picture and the black base), the new moves and the flash cut
 * in the storyboard, and "auto edit …" / "cut these to the music" in the prompt docker opens the box with the words and plans.
 * The maths: static/autoedit.js (H3AutoEdit). */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlDlg && window.TlCanvas && window.H3AutoEdit && typeof tl === "object" && tl); } catch (e) { return false; } }
  var AE = function () { return window.H3AutoEdit; };
  var dlg = null, st = { plan: null, grid: null, assets: [], song: null, busy: false, passets: null };
  function say(t, bad) { var m = $("aeMsg"); if (m) { m.textContent = t; m.style.color = bad ? "#f08a7a" : ""; } if (t && typeof logLine === "function") logLine("[✨ auto edit] " + t); }
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (x) { if (!r.ok || x.ok === false) throw new Error(x.error || "HTTP " + r.status); return x; }); });
  }
  var r2 = function (v) { return Math.round(v * 100) / 100; };

  /* ---------------------------------------------------------------- what to edit */
  function fromTimeline() {
    var out = [], seen = {};
    var vid = function (c) {
      if (!c || !c.name || c.text || c.m3d || c.adjust || c.nul || c.shape || c.gen || c.karaoke || c.kar_n != null || (c.ae && c.ae.base) || /^autoedit-black-/.test(c.name)) return;
      var k = "v:" + c.name + ":" + (c.in || 0); if (seen[k]) return; seen[k] = 1;
      out.push({ name: c.name, kind: "video", src: c.src || "output", in: +c.in || 0, out: c.out != null ? +c.out : +c.dur || 5, dur: +c.dur || (+c.out || 5) });
    };
    (tl.video || []).forEach(vid);
    (tl.vlayers || []).forEach(function (L) { if (!L.karaoke) (L.clips || []).forEach(vid); });
    (tl.images || []).forEach(function (L) { (L.clips || []).forEach(function (c) { if (!c || !c.name || c.text || c.shape || c.gen || c.adjust || c.nul || seen["i:" + c.name]) return; seen["i:" + c.name] = 1; out.push({ name: c.name, kind: "picture" }); }); });
    return out;
  }
  function loadPassets() {
    if (st.passets) return Promise.resolve(st.passets);
    return fetch("/api/passets").then(function (r) { return r.json(); }).then(function (j) { st.passets = j || {}; return st.passets; });
  }
  function urlOf(a) { return a.kind === "picture" ? "/passets/images/" + encodeURIComponent(a.name) : a.src === "video" ? "/passets/video/" + encodeURIComponent(a.name) : "/outputs/" + encodeURIComponent(a.name) + (a.src === "final" ? "?where=final" : ""); }
  /** each picture's / video's size (and a video's length when not known) - the cover scale needs it */
  function measure(list) {
    return Promise.all(list.map(function (a) {
      return new Promise(function (ok) {
        var done = function () { ok(a); }, to = setTimeout(done, 8000);
        if (a.kind === "picture") { var im = new Image(); im.onload = function () { a.w = im.naturalWidth; a.h = im.naturalHeight; clearTimeout(to); done(); }; im.onerror = function () { clearTimeout(to); done(); }; im.src = urlOf(a); return; }
        var v = document.createElement("video"); v.preload = "metadata"; v.muted = true;
        v.onloadedmetadata = function () { a.w = v.videoWidth; a.h = v.videoHeight; if (!(a.dur > 0) && isFinite(v.duration)) a.dur = v.duration; if (a.out == null) a.out = a.dur; clearTimeout(to); v.removeAttribute("src"); try { v.load(); } catch (e) { /* gone */ } done(); };
        v.onerror = function () { clearTimeout(to); done(); }; v.src = urlOf(a);
      });
    }));
  }
  function picked() {
    if ($("aeSrc").value === "timeline") return fromTimeline();
    var P = st.passets || {}, out = [];
    document.querySelectorAll("#aeAssets input[type=checkbox]:checked").forEach(function (x) {
      var kind = x.dataset.kind, name = x.value;
      if (kind === "video") { var v = (P.video || []).find(function (q) { return q.name === name; }); out.push({ name: name, kind: "video", src: "video", in: 0, dur: v && v.duration || 0, out: v && v.duration || undefined }); }
      else out.push({ name: name, kind: "picture" });
    });
    return out;
  }
  function songs() {
    var out = [];
    (tl.audio || []).forEach(function (L, i) { (L.clips || []).forEach(function (c, j) { if (c && c.name) out.push({ id: "tl:" + i + ":" + j, label: "🎵 " + c.name + " (on this timeline)", name: c.name, in: +c.in || 0, dur: +c.dur || +c.out || 0, len: Math.max(0, (+c.out || +c.dur || 0) - (+c.in || 0)) }); }); });
    ((st.passets || {}).sound || []).forEach(function (s) { if (!out.some(function (o) { return o.name === s.name; })) out.push({ id: "snd:" + s.name, label: "🔊 " + s.name, name: s.name, in: 0, dur: +s.duration || 0, len: +s.duration || 0 }); });
    return out;
  }

  /* ---------------------------------------------------------------- the box */
  function board() {
    var p = st.plan, g = st.grid, A = AE(); if (!p) return "";
    var assetOpts = function (sel) { return st.assets.map(function (a, i) { return '<option value="' + esc(a.name) + '"' + (a.name === sel ? " selected" : "") + (a.note ? ' title="' + esc(a.note) + '"' : "") + ">" + (a.kind === "video" ? "🎞 " : "🖼 ") + esc(a.name) + "</option>"; }).join(""); };
    var opts = function (O, sel) { return Object.keys(O).map(function (k) { return '<option value="' + k + '"' + (k === sel ? " selected" : "") + ">" + esc(O[k].label) + "</option>"; }).join(""); };
    var b = 0;
    return '<table class="aetab"><tr><th>#</th><th>At</th><th>Beats</th><th>Picture / video</th><th>Move</th><th>Into it</th><th>Words</th><th>Shown as</th><th></th></tr>'
      + p.shots.map(function (s, i) {
        var t = g ? (b * g.spb) : 0; b += s.beats;
        return '<tr data-i="' + i + '"><td>' + (i + 1) + '</td><td class="n">' + t.toFixed(1) + ' s</td><td><input type="number" class="aeB" min="1" max="128" value="' + s.beats + '" style="width:52px"></td>'
          + '<td>' + (s.card ? '<i>title card</i>' : '<select class="aeA">' + assetOpts(s.asset) + "</select>") + "</td>"
          + '<td>' + (s.card ? "" : '<select class="aeM">' + opts(A.MOVES, s.move) + "</select>") + "</td>"
          + '<td><select class="aeE">' + opts(A.ENTERS, s.enter) + '</select></td><td><input class="aeT" value="' + esc(s.text) + '" placeholder="no words" style="width:150px"></td>'
          + '<td><select class="aeS">' + opts(A.TITLES, s.title) + '</select></td><td><button type="button" class="ghost aeDel" title="Take this shot out">✕</button></td></tr>';
      }).join("") + "</table>";
  }
  function readBoard() {
    if (!st.plan) return;
    document.querySelectorAll("#aeBoard tr[data-i]").forEach(function (tr) {
      var s = st.plan.shots[+tr.dataset.i]; if (!s) return;
      var q = function (c) { return tr.querySelector(c); };
      s.beats = Math.max(1, Math.round(+q(".aeB").value || s.beats));
      if (q(".aeA")) s.asset = q(".aeA").value; if (q(".aeM")) s.move = q(".aeM").value;
      s.enter = q(".aeE").value; s.text = q(".aeT").value; s.title = q(".aeS").value;
    });
  }
  function paintBoard(notes) {
    $("aeBoard").innerHTML = board();
    var p = st.plan, g = st.grid, sum = p ? p.shots.reduce(function (t, s) { return t + s.beats; }, 0) : 0;
    $("aeSum").textContent = p ? p.shots.length + " shots · " + sum + " of " + g.n + " beats · " + (g.n * g.spb).toFixed(1) + " s at " + g.tempo.toFixed(0) + " BPM" + (p.by === "llm" ? " · planned by the LLM" : " · bitGen's own plan") : "";
    $("aeBuild").disabled = !p;
    var n = notes || (p && p.notes) || [];
    $("aeNotes").innerHTML = n.length ? n.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") : "";
  }
  function paintSources() {
    var srcAssets = $("aeSrc").value === "assets";
    $("aeAssets").style.display = srcAssets ? "" : "none";
    if (srcAssets && !$("aeAssets").dataset.done) {
      $("aeAssets").innerHTML = "<i>reading Assets…</i>";
      loadPassets().then(function (P) {
        var row = function (kind, a) { return '<label class="aechk"><input type="checkbox" data-kind="' + kind + '" value="' + esc(a.name) + '" checked> ' + (kind === "video" ? "🎞 " : "🖼 ") + esc(a.name) + (a.duration ? " · " + (+a.duration).toFixed(1) + " s" : "") + "</label>"; };
        var html = (P.video || []).map(function (a) { return row("video", a); }).join("") + (P.images || []).map(function (a) { return row("picture", a); }).join("");
        $("aeAssets").innerHTML = (html || "<i>no pictures or videos in Assets</i>") + '<div><button type="button" class="ghost" id="aeAll">All</button><button type="button" class="ghost" id="aeNone">None</button></div>';
        $("aeAssets").dataset.done = "1";
      }).catch(function (e) { $("aeAssets").innerHTML = "✗ " + esc(e.message); });
    }
  }
  function paintSongs() {
    var keep = $("aeSong").value, L = songs();
    $("aeSong").innerHTML = '<option value="">— no music (a steady pace) —</option>' + L.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.label) + "</option>"; }).join("");
    if (keep && L.some(function (s) { return s.id === keep; })) $("aeSong").value = keep;
    else if (L.length && L[0].id.indexOf("tl:") === 0) $("aeSong").value = L[0].id;
    $("aeTempoRow").style.display = $("aeSong").value ? "none" : "";
  }

  /* ---------------------------------------------------------------- plan + build */
  function plan() {
    if (st.busy) return;
    var list = picked();
    if (!list.length) { say("✗ nothing to edit - put clips on the timeline, or pick pictures / videos from Assets", true); return; }
    st.busy = true; $("aePlan").disabled = true;
    var sid = $("aeSong").value, song = sid ? songs().find(function (s) { return s.id === sid; }) : null, want = +$("aeLen").value || 0;
    say("measuring " + list.length + " picture(s) / video(s)…");
    return measure(list).then(function (assets) {
      st.assets = assets; st.song = song || null;
      if (!$("aeLook").checked) return null;
      say("👁 the vision model is looking at " + Math.min(40, assets.length) + " picture(s) / video(s)…");
      return post("/api/autoedit/describe", { assets: assets }).then(function (r) {
        assets.forEach(function (a) { if (r.notes && r.notes[a.name]) a.note = r.notes[a.name]; });
        st.lookNotes = (r.errors || []).slice(0, 3);
      }).catch(function (e) { st.lookNotes = ["👁 " + e.message]; });
    }).then(function () {
      var song = st.song;
      if (!song) return { beats: [], tempo: +$("aeTempo").value || 120 };
      say("finding the beats of " + song.name + "…");
      return post("/api/tlai/beats", { name: song.name, start: song.in, dur: song.len || 0 }).then(function (r) { return { beats: r.beats || [], tempo: r.tempo }; });
    }).then(function (b) {
      st.gridIn = { beats: b.beats, tempo: b.tempo, total: want || (song ? song.len : 30) };   // the server's grid made again here for ✔ Build
      say(navigator.onLine === false ? "planning…" : "the LLM is planning the edit…");
      return post("/api/autoedit/plan", { assets: st.assets, beats: b.beats, tempo: b.tempo, total: want || (song ? song.len : 30), brief: $("aeBrief").value, feel: $("aeFeel").value,
        titles: $("aeTitles").checked, cards: $("aeCards").checked, llm: !$("aeNoLlm").checked });
    }).then(function (r) {
      st.plan = r.plan; st.grid = r.grid;
      if (st.lookNotes && st.lookNotes.length) st.plan.notes = st.plan.notes.concat(st.lookNotes.map(function (x) { return "👁 not looked at - " + x; }));
      paintBoard(); say("✔ " + r.plan.shots.length + " shots planned" + (r.by === "llm" ? " by the LLM" : " by bitGen") + " - change anything in the storyboard, then ✔ Build");
    }).catch(function (e) { say("✗ " + e.message, true); })
      .then(function () { st.busy = false; $("aePlan").disabled = false; });
  }
  function build() {
    if (!st.plan || st.busy) return;
    readBoard();
    var A = AE(), g = A.grid(st.gridIn);
    var p = A.clean(st.plan, st.assets, g, { titles: $("aeTitles").checked });
    var S = TlCanvas.state || {}, frame = { W: S.W || 1920, H: S.H || 1080 };
    var built = A.build(p, st.assets, g, frame, { song: st.song ? { name: st.song.name, in: st.song.in, dur: st.song.dur } : null });
    var issues = A.qa(built, p, g, st.assets);
    var baseClip = null, frameKeep = tl.frame;
    var apply = function () {
      if (frameKeep && !tl.frame) tl.frame = frameKeep;            // a new timeline keeps the frame size
      // what was on this timeline makes way (one ↶ step undoes it when built onto it); V1 = a black base (⚙ Compile needs a V1 clip)
      tl.video = baseClip ? [baseClip] : []; tl.vlayers = built.vlayers.map(function (L) { return mkLayer(L.name, L.clips); });
      built.vlayers.forEach(function (L, i) { if (L.muted) tl.vlayers[i].muted = true; });
      tl.images = built.images.map(function (L) { return mkLayer(L.name, L.clips); });
      tl.audio = built.audio.map(function (L) { return mkLayer(L.name, L.clips); });
      tl.sel = null; tl.selLayer = null;
      // each title's picture made for ⚙ Compile (the canvas draws it live; the compile reads text_<id>.png)
      tl.images.forEach(function (L) { L.clips.forEach(function (c) { if (c.text && TlCanvas.saveTextPng) TlCanvas.saveTextPng(c); }); });
      tlSave(); if (typeof renderTimeline === "function") renderTimeline();
      try { TlCanvas.mark(); TlCanvas.paintLayers(); TlCanvas.go(0); } catch (e) { /* closed */ }
    };
    st.busy = true;
    var wantSfx = $("aeSfx").checked;
    var go0 = post("/api/autoedit/media", { W: frame.W, H: frame.H, dur: built.total, sfx: wantSfx, white: true })
      .then(function (m) {
        // built again with the sound effects and the white flash picture now that they are on disk
        built = A.build(p, st.assets, g, frame, { song: st.song ? { name: st.song.name, in: st.song.in, dur: st.song.dur } : null, sfx: wantSfx ? m.sfx : null, white: m.white || null });
        issues = A.qa(built, p, g, st.assets);
        if (m.sfxError) issues.push("the sound effects were not made: " + m.sfxError);
        return m.base;
      })
      .then(function (r) { baseClip = { name: r.name, src: "video", in: 0, out: Math.round(built.total * 1e4) / 1e4, dur: r.dur, start: 0, opacity: 1, ae: { base: true } }; })
      .catch(function (e) { say("the black base for V1 was not made (" + e.message + ") - ⚙ Compile needs a V1 clip", true); });
    var go = go0.then(function () { return $("aeNewTl").checked && typeof tlSaveNamed === "function" && typeof EMPTY_TL === "function"
      ? tlSaveNamed(tlName, false).catch(function () { /* the old one stays as it was saved */ }).then(function () {
          var names = (typeof tlList !== "undefined" ? tlList : []).map(function (t) { return t.name; }), n = 1;
          while (names.indexOf("Auto edit " + n) >= 0) n++;
          tl = Object.assign(EMPTY_TL(), {}); apply();
          return tlSaveNamed("Auto edit " + n, true).then(function () { return "Auto edit " + n; });
        })
      : Promise.resolve().then(function () { apply(); return tlName; }); });
    go.then(function (name) {
      var notes = (p.notes || []).concat(issues.map(function (x) { return "⚠ " + x; }));
      paintBoard(notes);
      say("✔ built on \"" + name + "\": " + built.shots.length + " shots, " + built.total.toFixed(1) + " s, every cut on a beat" + (built.sfx && built.sfx.length ? ", " + built.sfx.length + " sound effects" : "") + (issues.length ? " - " + issues.length + " thing(s) to look at below" : " - the check found nothing") + ". ↶ undoes it.");
    }).catch(function (e) { say("✗ " + e.message, true); }).then(function () { st.busy = false; });
    return built;
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlAutoEditDlg", title: "✨ Auto edit", width: 980 });
      var css = document.createElement("style");
      css.textContent = "#tlAutoEditDlg .aerow{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:4px 0}#tlAutoEditDlg .aerow>span{color:var(--dim,#9aa)}"
        + "#tlAutoEditDlg #aeAssets{max-height:150px;overflow:auto;border:1px solid var(--line,#444);padding:4px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:2px 8px;font-size:12px}"
        + "#tlAutoEditDlg .aechk{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tlAutoEditDlg #aeBoard{max-height:46vh;overflow:auto;margin-top:6px}"
        + "#tlAutoEditDlg .aetab{border-collapse:collapse;width:100%;font-size:12px}#tlAutoEditDlg .aetab th{text-align:left;position:sticky;top:0;background:var(--panel,#222)}#tlAutoEditDlg .aetab td{padding:2px 3px;border-top:1px solid var(--line,#333)}"
        + "#tlAutoEditDlg .aetab select{max-width:170px}#tlAutoEditDlg .n{text-align:right;white-space:nowrap}#tlAutoEditDlg #aeNotes{font-size:12px;color:var(--dim,#9aa);margin:4px 0 0 16px}";
      document.head.appendChild(css);
      dlg.body.innerHTML = '<div class="aerow"><span>Edit</span><select id="aeSrc"><option value="timeline">the clips on this timeline</option><option value="assets">pictures and videos from Assets</option></select>'
        + '<span>Music</span><select id="aeSong" style="max-width:300px"></select><span id="aeTempoRow">pace <input type="number" id="aeTempo" value="120" min="40" max="240" style="width:58px"> beats a minute</span></div>'
        + '<div id="aeAssets" style="display:none"></div>'
        + '<div class="aerow"><span>Length</span><input type="number" id="aeLen" min="4" max="600" placeholder="the song" style="width:80px" title="Seconds - empty = the whole song (30 s without one); always whole bars">s'
        + '<span>Feel</span><select id="aeFeel"><option value="calm">Calm - longer shots</option><option value="promo" selected>Promo</option><option value="hype">Hype - short, punchy</option></select>'
        + '<label><input type="checkbox" id="aeTitles" checked> words on screen</label><label><input type="checkbox" id="aeCards" checked> title cards</label>'
        + '<label title="Plan without the LLM - bitGen fills the arc itself"><input type="checkbox" id="aeNoLlm"> no LLM</label>'
        + '<label title="The vision model looks at each picture and a video\'s middle frame first, so the LLM picks shots by what is in them (asked once per file)"><input type="checkbox" id="aeLook" checked> 👁 look at them first</label>'
        + '<label title="Whooshes on the pushes, an impact on a crash zoom, a riser into the sign-off - bitGen\'s own sounds, pinned to the picture"><input type="checkbox" id="aeSfx" checked> 🔊 sound effects</label></div>'
        + '<div class="aerow"><textarea id="aeBrief" rows="2" style="flex:1;min-width:300px" placeholder="What is it for? e.g. A 30 s promo for Rosie\'s Bakery - fresh sourdough every morning, open 7am, come visit"></textarea></div>'
        + '<div class="aerow"><button type="button" id="aePlan">✨ Plan</button><button type="button" id="aeBuild" disabled>✔ Build</button>'
        + '<label title="Off = the edit replaces this timeline (↶ undoes it)"><input type="checkbox" id="aeNewTl" checked> into a new timeline (this one kept)</label><span id="aeSum"></span></div>'
        + '<div id="aeMsg" class="tlp-note"></div><div id="aeBoard"></div><ul id="aeNotes"></ul>'
        + '<div class="tlp-note" style="font-size:11px">The editing craft of video-shotcraft (Vincentwei1021, Apache-2.0): music first - every cut on a beat; a held opening, one hero shot, a climb of high and low shots with title cards between, a peak finale and a held sign-off; one move per shot; each seam by the energy on both sides. Built with the timeline\'s own keyframes.</div>';
      dlg.foot.innerHTML = '<button type="button" id="aeDone">Done</button>';
      $("aeDone").onclick = function () { dlg.close(); };
      $("aeSrc").onchange = paintSources;
      $("aeSong").onchange = function () { $("aeTempoRow").style.display = $("aeSong").value ? "none" : ""; };
      $("aePlan").onclick = plan; $("aeBuild").onclick = build;
      dlg.body.addEventListener("click", function (e) {
        var t = e.target;
        if (t.id === "aeAll" || t.id === "aeNone") document.querySelectorAll("#aeAssets input[type=checkbox]").forEach(function (x) { x.checked = t.id === "aeAll"; });
        if (t.classList.contains("aeDel")) { readBoard(); st.plan.shots.splice(+t.closest("tr").dataset.i, 1); paintBoard(); }
      });
      dlg.body.addEventListener("change", function (e) { if (e.target.closest("#aeBoard")) { readBoard(); paintBoard(); } });
    }
    if (!$("aeBrief").value) { var p = $("prompt"); if (p && p.value.trim()) $("aeBrief").value = p.value.trim(); }
    if (!fromTimeline().length) $("aeSrc").value = "assets";
    paintSources();
    loadPassets().catch(function () { /* the timeline's sounds only */ }).then(paintSongs);
    dlg.open();
  }
  /* 2.895.0: the prompt docker - "auto edit …", "cut these to the music", "make a promo edit of …" opens the box with the words
     and plans (the storyboard to check, then ✔ Build) */
  var ASK = /\b(auto[- ]?edit|edit (?:my|these|the|our) (?:clips|videos|photos|pictures|footage)|cut (?:it|them|these|this|my \w+|the \w+)? ?to the (?:music|beat|beats|song)|make (?:a |an )?(?:promo |music |quick )?(?:edit|montage|video edit|sizzle reel|highlight reel) (?:of|from|with|for))\b/i;
  function wants(t) { return ASK.test(String(t || "")); }
  function route(text) {
    if (!wants(text) || !ready()) return Promise.resolve(null);
    var d = $("timelinedock"); if (d && d.classList.contains("dockgone") && typeof toggleDockGone === "function") { try { toggleDockGone("timelinedock"); } catch (e) { /* stays */ } }
    open();
    $("aeBrief").value = String(text).trim();
    if ($("aeSrc").value === "assets") return loadPassets().then(function () { paintSources(); return new Promise(function (ok) { setTimeout(ok, 400); }); }).then(go);
    return go();
    function go() {
      return Promise.resolve(plan()).then(function () {
        var p = st.plan;
        return p ? "✨ Auto edit is open on the timeline with your words: " + p.shots.length + " shots planned to " + (st.song ? st.song.name : "a steady pace") + " - check the storyboard (change any shot), then ✔ Build."
          : "✨ Auto edit is open on the timeline - " + ($("aeMsg").textContent || "pick what to edit, then ✨ Plan");
      });
    }
  }
  window.H3ChatRoutes = (window.H3ChatRoutes || []).concat([route]);
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlAutoEditBtn", "✨", "Auto edit: cut your pictures and videos to the music - the LLM plans the shots, moves, seams and words, every cut on a beat", open);
  }
  window.TlAutoEdit = { open: open, plan: plan, build: build, fromTimeline: fromTimeline, state: st, wants: wants, route: route };
  boot();
})();
