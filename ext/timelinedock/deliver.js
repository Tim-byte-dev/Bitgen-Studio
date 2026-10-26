/* bitGen Studio — ext/timelinedock/deliver.js (2.407.0): the 📤 EXPORT queue - every format the movie should come out
 * in, made in ONE compile from its master: MP4 H.264 / H.265, MOV ProRes 422 HQ / DNxHR HQ, WebM VP9, GIF, WAV / MP3,
 * each at a size, a reframe (9:16, 1:1, 4:5, 21:9 - crop, pad or a blurred fill), a frame rate, a quality; plus the
 * start TIMECODE. Stored on the timeline (tl.deliver, tl.deliverOn, tl.tc); ⚙ Compile sends it (forCompile()) and
 * scripts/deliver.py makes the files beside <project>.mp4; the dialog lists them to download.
 * Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do".
 * 2.410.0 (Tim: "continue with the next stages of the premier gap closure"): RANGE - the whole movie or only the In /
 * Out part (the ruler selection: I / O, ⟦ In / Out ⟧) for every format (tl.deliverRange "io"; <stem>_<name>_io.<ext>);
 * 🖼 FRAME - the picture at the position marker as a PNG beside the movies (Ctrl+Shift+E; still()).
 * 2.512.0: ⤓ LOTTIE (JSON) - the picture / text layers as a Lottie animation beside the movies (tllottie.js). */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlDlg && window.H3Timecode && $("tlExport")); } catch (e) { return false; } }
  var P = null, dlg = null, once = false;
  var FPS = ["23.976", "24", "25", "29.97", "30", "50", "59.94", "60"];
  var PACKS = {
    // 2.597.0 (Tim: "our mp4 and avi files are rejected" - "yes please build the preset"): the MP4 · Social media preset
    // (scripts/social.py - what Facebook / Instagram / TikTok take, checked after): Reels 9:16, the Facebook feed 4:5, 1:1, 16:9
    "social": [{ preset: "social", aspect: "9:16", size: "1080", fit: "blur" }, { preset: "social", aspect: "4:5", size: "1080", fit: "crop" },
               { preset: "social", aspect: "1:1", size: "1080", fit: "crop" }, { preset: "social", aspect: "16:9", size: "1080", fit: "pad" }],
    "edit": [{ preset: "prores", size: "source" }, { preset: "wav" }],
    "web": [{ preset: "h265", size: "1080" }, { preset: "webm", size: "1080" }, { preset: "gif", size: "480" }],
    "small": [{ preset: "av1", size: "1080" }, { preset: "av1", size: "720", quality: "small" }],                   // 2.411.0
    "overlay": [{ preset: "prores4444", size: "source" }],                                                            // 2.412.0
    "hdr": [{ preset: "h265_10", colour: "hdr10" }, { preset: "h265_10", colour: "hlg" }],                              // 2.417.0
  };
  function save() { if (typeof tlSave === "function") tlSave(); }
  function list() { tl.deliver = Array.isArray(tl.deliver) ? tl.deliver : []; return tl.deliver; }
  function opt(vals, v, labels) { return vals.map(function (x, i) { return '<option value="' + esc(x) + '"' + (String(x) === String(v) ? " selected" : "") + ">" + esc(labels ? labels[i] : x) + "</option>"; }).join(""); }

  function paintRows() {
    var L = $("tdlRows"); if (!L || !P) return;
    var ids = P.presets.map(function (p) { return p.id; }), labs = P.presets.map(function (p) { return p.label; });
    L.innerHTML = list().length ? list().map(function (d, i) {
      var pr = P.presets.find(function (p) { return p.id === d.preset; }) || {};
      return '<div class="fx-row" data-i="' + i + '"><select data-k="preset" title="' + esc(pr.note || "") + '">' + opt(ids, d.preset, labs) + "</select>"
        + (pr.video === false ? '<span class="fx-dim">sound only</span>' :
          '<select data-k="size" title="The short side">' + opt(P.sizes, d.size || "source", P.sizes.map(function (s) { return s === "source" ? "source size" : s + "p"; })) + "</select>"
          + '<select data-k="aspect" title="Reframe">' + opt(P.aspects, d.aspect || "source", P.aspects.map(function (a) { return a === "source" ? "as is" : a; })) + "</select>"
          + '<select data-k="fit" title="How a reframe fills: crop the middle, pad with black, a blurred copy behind, or follow - the crop follows the subject (faces, people, what stands out)"' + ((d.aspect || "source") === "source" ? " disabled" : "") + ">" + opt(P.fits, d.fit || "crop") + "</select>"
          + '<select data-k="fps" title="Frame rate">' + opt(P.fps, d.fps || "source", P.fps.map(function (f) { return f === "source" ? "same fps" : f + " fps"; })) + "</select>"
          + (/^(h264|h264_10|h265|h265_10|av1|webm|social)$/.test(d.preset) ? '<select data-k="quality">' + opt(P.qualities, d.quality || "standard") + "</select>" : "")
          // 2.417.0: the colour - HDR10 (PQ), HLG or Rec.2020 SDR on the 10-bit presets (scripts/hdr.py)
          + (pr.wide && P.colours ? '<select data-k="colour" title="The colour it is made in: Rec.709 SDR as graded, or placed into HDR10 / HLG (BT.2020, 10-bit, the master\'s white at 203 nits) or Rec.2020 SDR (wide gamut)">'
             + opt(P.colours, d.colour || "sdr", P.colours.map(function (c) { return (P.colourLabels || {})[c] || c; })) + "</select>" : ""))
        + '<button class="ghost" type="button" data-del="' + i + '" title="Remove">✕</button></div>';
    }).join("") : '<div class="fx-dim">Only the master (MP4 · H.264). ＋ adds a format; the packs add a few at once.</div>';
    Array.prototype.forEach.call(L.querySelectorAll("select[data-k]"), function (s) {
      s.onchange = function () { var d = list()[+s.closest("[data-i]").dataset.i]; d[s.dataset.k] = s.value; save(); paintRows(); };
    });
    Array.prototype.forEach.call(L.querySelectorAll("[data-del]"), function (b) { b.onclick = function () { list().splice(+b.dataset.del, 1); save(); paintRows(); }; });
  }
  function paintFiles() {
    var L = $("tdlFiles"); if (!L) return;
    fetch("/api/deliver/files").then(function (r) { return r.json(); }).then(function (j) {
      var fs = j.files || [];
      L.innerHTML = fs.length ? fs.map(function (f) {
        return '<div class="fx-row"><a href="/api/deliver/file/' + encodeURIComponent(f.name) + '" download>⬇ ' + esc(f.name) + '</a><span class="fx-dim">'
          + (f.size > 1048576 ? (f.size / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(f.size / 1024)) + " KB") + " · " + new Date(f.mtime).toLocaleString() + "</span></div>";
      }).join("") : '<div class="fx-dim">Nothing compiled yet.</div>';
    }).catch(function () { L.textContent = ""; });
  }
  function paint() {
    var tc = tl.tc || { start: "00:00:00:00", fps: 25 };
    dlg.body.innerHTML = '<fieldset><legend>Formats <button class="ghost" type="button" id="tdlAdd">＋</button>'
      + ' <select id="tdlPack"><option value="">＋ a pack…</option><option value="social">social media (9:16 Reels · 4:5 feed · 1:1 · 16:9)</option><option value="edit">for editing (ProRes + WAV)</option><option value="web">web (H.265 · WebM · GIF)</option><option value="small">smallest (AV1 1080 + 720)</option><option value="overlay">overlay (ProRes 4444 with alpha)</option><option value="hdr">HDR (HDR10 + HLG)</option></select></legend>'
      + '<div id="tdlRows"></div>'
      + '<div class="fx-row"><label><input type="checkbox" id="tdlOn"' + (tl.deliverOn !== false ? " checked" : "") + "> make them on every ⚙ Compile</label>"
      + '<label title="NVENC (NVIDIA), Quick Sync (Intel), AMF (AMD) for H.264 / H.265 / AV1 - each is tried first; none that works = the software encoder (the log says which)"><input type="checkbox" id="tdlHw"'
      + (tl.deliverHw ? " checked" : "") + "> use the graphics card's encoder when it has one</label></div></fieldset>"
      + '<fieldset><legend>Range</legend><div class="fx-row"><label><input type="radio" name="tdlRange" value="all"' + (tl.deliverRange !== "io" ? " checked" : "") + '> the whole movie</label>'
      + '<label title="The ruler selection - I / O over the layers, or ⟦ In / Out ⟧"><input type="radio" name="tdlRange" value="io"' + (tl.deliverRange === "io" ? " checked" : "") + '> In / Out only <span class="fx-dim" id="tdlIo"></span></label></div>'
      + '<div class="fx-row"><button class="ghost" type="button" id="tdlStill" title="The picture at the position marker as a PNG beside the movies (Ctrl+Shift+E)">🖼 Export frame</button>'
      + '<span class="fx-dim">the frame at the position marker, as the preview canvas draws it</span></div>'
      + '<div class="fx-row"><button class="ghost" type="button" id="tdlLottie" title="The picture and text layers as a Lottie animation (JSON) for the web and apps - beside the movies">⤓ Lottie (JSON)</button>'
      + '<span class="fx-dim" id="tdlLottieMsg">moves, scales, turns and fades stay animated layers; effects go in as frames; video is left out</span></div></fieldset>'
      + '<fieldset><legend>Timecode</legend><div class="fx-row"><label>starts at <input type="text" id="tdlTc" value="' + esc(tc.start) + '" style="width:92px" title="HH:MM:SS:FF"></label>'
      + '<label>at <select id="tdlFps">' + opt(FPS, String(tc.fps)) + "</select> fps</label>"
      + '<label title="29.97 / 59.94 only: the timecode skips frame numbers so it keeps up with the clock (HH:MM:SS;FF)"><input type="checkbox" id="tdlDrop"' + (H3Timecode.isDrop(tc, tc.fps) ? " checked" : "") + "> drop-frame</label>"
      + "<span class=\"fx-dim\">written into MP4 / MOV, the XML / EDL, and shown on the timeline</span></div></fieldset>"
      + '<fieldset><legend>Delivered <button class="ghost" type="button" id="tdlRefresh" title="Refresh">↻</button></legend><div id="tdlFiles"></div></fieldset>';
    $("tdlAdd").onclick = function () { list().push({ preset: "h264", size: "source", aspect: "source", fit: "crop", fps: "source", quality: "standard" }); save(); paintRows(); };
    $("tdlPack").onchange = function () { (PACKS[$("tdlPack").value] || []).forEach(function (d) { list().push(Object.assign({ size: "source", aspect: "source", fit: "crop", fps: "source", quality: "standard" }, d)); }); $("tdlPack").value = ""; save(); paintRows(); };
    $("tdlOn").onchange = function () { tl.deliverOn = $("tdlOn").checked; save(); };
    $("tdlHw").onchange = function () { tl.deliverHw = $("tdlHw").checked; save(); };                 // 2.411.0
    var setTc = function () {
      var s = $("tdlTc").value.trim(), f = +$("tdlFps").value;
      var can = H3Timecode.canDrop(f), dr = can && ($("tdlDrop").checked || (/;/.test(s) && this && this.id === "tdlTc"));
      $("tdlDrop").disabled = !can; if (!can) $("tdlDrop").checked = false; else $("tdlDrop").checked = dr;
      var n = H3Timecode.norm(s.replace(/;/g, ":"), f, false);          // the frame NUMBER typed, written the kind chosen
      if (n == null) { $("tdlTc").style.outline = "1px solid #c42b1c"; return; }
      var st = dr ? n.replace(/:(\d\d)$/, ";$1") : n;
      if (!isFinite(H3Timecode.parse(st, f))) { $("tdlTc").style.outline = "1px solid #c42b1c"; return; }   // a dropped number
      $("tdlTc").style.outline = ""; $("tdlTc").value = st;
      tl.tc = dr ? { start: st, fps: f, drop: true } : { start: st, fps: f }; save();
    };
    $("tdlTc").onchange = setTc; $("tdlFps").onchange = setTc; $("tdlDrop").onchange = setTc;
    $("tdlDrop").disabled = !H3Timecode.canDrop(+tc.fps);
    $("tdlTc").addEventListener("keydown", function (e) { e.stopPropagation(); });
    $("tdlRefresh").onclick = paintFiles;
    Array.prototype.forEach.call(document.querySelectorAll('input[name="tdlRange"]'), function (r) {
      r.onchange = function () { tl.deliverRange = r.value === "io" ? "io" : "all"; save(); paintIo(); };
    });
    $("tdlStill").onclick = function () { still(); };
    $("tdlLottie").onclick = function () {               // 2.512.0
      var m = $("tdlLottieMsg"), say = function (t) { if (m) m.textContent = t; };
      if (!window.TlLottie || !TlLottie.export) { say("the Lottie export is not loaded"); return; }
      say("⤓ making the Lottie…");
      TlLottie.export(function (k, n) { say("⤓ drawing frames " + k + " / " + n + "…"); }).then(function (j) {
        say("✓ " + j.name + " - " + j.layers + " layer(s), " + Math.max(1, Math.round(j.size / 1024)) + " KB" + (j.skipped.length ? " · left out: " + j.skipped.join("; ") : ""));
        if (typeof logLine === "function") logLine("[export] Lottie -> " + j.name + (j.skipped.length ? " (left out: " + j.skipped.join("; ") + ")" : ""));
        paintFiles();
      }).catch(function (e) { say("⚠ " + (e.message || e)); });
    };
    paintIo(); paintRows(); paintFiles();
  }
  function paintIo() {
    var e = $("tdlIo"); if (!e) return;
    var s = tl.sel;
    e.textContent = s ? "(" + (+s.a).toFixed(2) + " – " + (+s.b).toFixed(2) + " s, " + (s.b - s.a).toFixed(2) + " s)" : "(no selection yet - the whole movie is made)";
  }
  /** 🖼 the frame at the position marker -> a PNG beside the movies */
  function still() {
    if (!window.TlCanvas || !TlCanvas.snapshot) return Promise.resolve(null);
    var t = TlCanvas.state ? +TlCanvas.state.t || 0 : 0, fps = (tl.tc && +tl.tc.fps) || 25;
    var url;
    try { url = TlCanvas.snapshot(); } catch (e) { if (typeof appNote === "function") appNote("Could not draw the frame: " + (e.message || e), "Export frame"); return Promise.resolve(null); }
    var bin = atob(url.split(",")[1]), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return fetch("/api/deliver/still?t=" + t.toFixed(4) + "&fps=" + fps, { method: "POST", headers: { "Content-Type": "image/png" }, body: u8 })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (j) {
        if (typeof logLine === "function") logLine("[export] frame at " + t.toFixed(2) + " s -> " + j.name);
        if ($("sblog")) $("sblog").textContent = "🖼 " + j.name + " saved beside the movies (📤 Export lists it)";
        if (dlg && dlg.isOpen()) paintFiles();
        return j;
      }).catch(function (e) { if (typeof appNote === "function") appNote("The frame was not saved: " + (e.message || e), "Export frame"); return null; });
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlDeliverDlg", title: "Export", width: 720 });
      dlg.foot.innerHTML = '<span class="fx-dim" style="flex:1">The master is always &lt;project&gt;.mp4; each format is made from it.</span>'
        + '<button type="button" id="tdlGo">⚙ Compile + export</button><button class="ghost" type="button" id="tdlDone">Done</button>';
      $("tdlDone").onclick = function () { dlg.close(); };
      $("tdlGo").onclick = function () { once = true; $("tlExport").click(); setTimeout(paintFiles, 1500); };
    }
    var go = P ? Promise.resolve() : fetch("/api/deliver/presets").then(function (r) { return r.json(); }).then(function (j) { P = j; });
    go.then(function () { paint(); dlg.open(); });
  }
  /** what ⚙ Compile sends: the queue when it is on (or when 📤's own button asked once), else nothing */
  function forCompile() {
    var l = Array.isArray(tl.deliver) ? tl.deliver : [];
    var use = once || tl.deliverOn !== false;
    once = false;
    return use && l.length ? l : undefined;
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlDeliverBtn", "📤", "Export: formats, sizes, reframes, timecode", open);
  }
  window.TlDeliver = { open: open, forCompile: forCompile, files: paintFiles, still: still };
  boot();
})();
