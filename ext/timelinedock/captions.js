/* bitGen Studio — ext/timelinedock/captions.js (2.406.0): the timeline's 💬 CAPTION track.
 *
 * Tim: "lets start closing the gap and go with your suggestions as you see fit" (caption tracks from the transcript).
 *
 * ✨ From speech: every clip that speaks (V1, the video layers, any sound layer whose role is 🗣 voice) is transcribed
 * on this machine (faster-whisper - POST /api/captions/build, lib/captions.js), its words placed where the clip sits
 * (its trim and its 🎬 speed too) and cut into readable cues. The cues are then edited here (times, words, ＋ / ✕),
 * styled (font, size, colour, outline or a box, top / middle / bottom), drawn on the canvas exactly where the compile
 * burns them (scripts/captions_ass.py - the same numbers), burned into the movie and / or written as a .srt beside it.
 *
 * Stored on the timeline: tl.captions = {cues: [{start, end, text}], style, burn, srt, visible}.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function log(t) { if (typeof logLine === "function") logLine("[captions] " + t); }
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onComp && window.TlDlg); } catch (e) { return false; } }
  var STYLE = { font: "Arial", size: 5.5, color: "#ffffff", outline: 2.5, outline_color: "#000000", box: false,
                box_color: "#000000", box_opacity: 0.6, position: "bottom", margin: 6, bold: true };
  var FONTS = ["Arial", "Helvetica", "Verdana", "Trebuchet MS", "Georgia", "Times New Roman", "Courier New", "Impact"];
  var dlg = null, info = null, busy = false;

  function C() {
    if (!tl.captions) tl.captions = { cues: [], style: Object.assign({}, STYLE), burn: true, srt: true, visible: true };
    var c = tl.captions;
    c.style = Object.assign({}, STYLE, c.style || {});
    c.cues = c.cues || [];
    return c;
  }
  function save() { if (typeof tlSave === "function") tlSave(); TlCanvas.mark(); }
  function tc(t) { t = Math.max(0, +t || 0); var m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2); }
  function cueAt(t) {
    var c = tl.captions;
    if (!c || c.visible === false || !c.cues) return null;
    for (var i = 0; i < c.cues.length; i++) { var q = c.cues[i]; if (t >= q.start && t < q.end) return q; }
    return null;
  }

  /* ---------------------------------------------------------------- drawn INTO the picture (= libass, scaled) */
  function hexA(h, a) {
    h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map(function (x) { return x + x; }).join("");
    var n = parseInt(h, 16) || 0;
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  function wrap(g, text, maxW) {
    var out = [];
    String(text).split("\n").forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = "";
      words.forEach(function (w) {
        var tryL = line ? line + " " + w : w;
        if (line && g.measureText(tryL).width > maxW) { out.push(line); line = w; } else line = tryL;
      });
      if (line) out.push(line);
    });
    return out;
  }
  function paint(g, t, dim) {
    var q = cueAt(t); if (!q) return;
    var st = Object.assign({}, STYLE, tl.captions.style || {}), W = dim.W, H = dim.H;
    var size = Math.max(8, Math.round(H * Math.max(1, Math.min(20, +st.size || 5.5)) / 100));
    var ol = Math.max(0, Math.min(20, +st.outline)) * H / 1080, mV = Math.round(H * Math.max(0, Math.min(40, +st.margin)) / 100), mL = Math.round(W * 0.06);
    g.save();
    g.font = (st.bold !== false ? "bold " : "") + size + "px \"" + st.font + "\", Arial, sans-serif";
    g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
    var lines = wrap(g, q.text, W - 2 * mL), lh = size * 1.15, total = lh * lines.length;
    var y0 = st.position === "top" ? mV + size * 0.9 : st.position === "middle" ? (H - total) / 2 + size * 0.9 : H - mV - total + size * 0.9;
    lines.forEach(function (ln, i) {
      var y = y0 + i * lh, w = g.measureText(ln).width;
      if (st.box) {
        var pad = size * 0.18;
        g.fillStyle = hexA(st.box_color, Math.max(0, Math.min(1, +st.box_opacity)));
        g.fillRect(W / 2 - w / 2 - pad, y - size * 0.9 - pad, w + 2 * pad, size * 1.15 + 2 * pad);
      } else if (ol > 0) {
        g.strokeStyle = st.outline_color; g.lineWidth = ol * 2; g.strokeText(ln, W / 2, y);
      }
      g.fillStyle = st.color; g.fillText(ln, W / 2, y);
    });
    g.restore();
  }

  /* ---------------------------------------------------------------- the dialog */
  function setBusy(on, msg) {
    busy = on;
    var b = $("tcapBuild"); if (b) { b.disabled = on; b.textContent = on ? "✨ transcribing…" : "✨ From speech"; }
    if (msg != null && $("tcapMsg")) $("tcapMsg").textContent = msg;
  }
  // only what the captions need (the server's JSON limit is small; keyframes / transforms stay home)
  function slim(c) { return { name: c.name, in: c.in, out: c.out, dur: c.dur, start: c.start, fx: c.fx && (c.fx.speed || c.fx.ramp || c.fx.reverse || c.fx.remap) ? { speed: c.fx.speed, ramp: c.fx.ramp, reverse: c.fx.reverse, remap: c.fx.remap } : undefined }; }
  function lay(L) { return L ? { muted: L.muted, visible: L.visible, role: L.role, clips: (L.clips || []).filter(function (c) { return !c.m3d && !c.text; }).map(slim) } : L; }
  function build() {
    if (busy) return;
    var c = C();
    if (c.cues.length && !confirm("Replace the " + c.cues.length + " caption(s) with new ones from the speech?")) return;
    setBusy(true, "Listening to everything that speaks on the timeline - the first time takes a while, later it is cached.");
    fetch("/api/captions/build", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tl: { video: tl.video.map(slim), v1: lay(tl.v1), vmute: tl.vmute, vlayers: (tl.vlayers || []).map(lay), audio: (tl.audio || []).map(lay) },
                             maxChars: +$("tcapMax").value || 42, language: $("tcapLang").value.trim() || undefined }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); })
      .then(function (j) {
        if (!(j.cues || []).length) {          // nothing heard: the captions there stay
          var why = (j.skipped || []).map(function (s) { return s.name + " (" + s.why + ")"; }).join(", ");
          setBusy(false, "No speech found" + (why ? " - " + why : "") + ".");
          return;
        }
        c.cues = j.cues;
        save();
        var sk = (j.skipped || []).map(function (s) { return s.name + " (" + s.why + ")"; });
        setBusy(false, c.cues.length + " caption(s) from " + (j.sources || []).length + " file(s)" + (sk.length ? " · skipped: " + sk.join(", ") : ""));
        log(c.cues.length + " caption(s) made from the speech");
        paintList();
      })
      .catch(function (e) { setBusy(false, "⚠ " + (e.message || e)); alert("Captions: " + (e.message || e)); });
  }
  function paintList() {
    var c = C(), L = $("tcapList"); if (!L) return;
    L.innerHTML = c.cues.length ? c.cues.map(function (q, i) {
      return '<div class="fx-row" data-i="' + i + '"><button class="ghost" data-go="' + i + '" title="Go there" style="padding:0 5px">▶</button>'
        + '<input type="number" step="0.05" min="0" data-k="start" value="' + q.start + '" style="width:64px" title="Starts (s)">'
        + '<input type="number" step="0.05" min="0" data-k="end" value="' + q.end + '" style="width:64px" title="Ends (s)">'
        + '<input type="text" data-k="text" value="' + esc(q.text) + '" style="flex:1;min-width:140px">'
        + '<button class="ghost" data-del="' + i + '" title="Delete this caption" style="padding:0 6px">✕</button></div>';
    }).join("") : '<div class="fx-dim">No captions yet - ✨ From speech, or ＋ one at the position marker.</div>';
    Array.prototype.forEach.call(L.querySelectorAll("input[data-k]"), function (el) {
      el.addEventListener("keydown", function (e) { e.stopPropagation(); });
      el.addEventListener("change", function () {
        var i = +el.closest("[data-i]").dataset.i, q = c.cues[i], k = el.dataset.k;
        q[k] = k === "text" ? el.value : Math.max(0, +el.value || 0);
        if (q.end <= q.start) q.end = +(q.start + 0.5).toFixed(2);
        c.cues.sort(function (a, b) { return a.start - b.start; });
        save(); if (k !== "text") paintList();
      });
    });
    Array.prototype.forEach.call(L.querySelectorAll("[data-go]"), function (b) { b.onclick = function () { TlCanvas.go(c.cues[+b.dataset.go].start + 0.01); }; });
    Array.prototype.forEach.call(L.querySelectorAll("[data-del]"), function (b) { b.onclick = function () { c.cues.splice(+b.dataset.del, 1); save(); paintList(); }; });
    var n = $("tcapCount"); if (n) n.textContent = c.cues.length + " caption(s)";
  }
  function paintDlg() {
    var c = C(), st = c.style;
    var opt = function (list, v) { return list.map(function (x) { var val = Array.isArray(x) ? x[0] : x, lab = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? " selected" : "") + ">" + esc(lab) + "</option>"; }).join(""); };
    dlg.body.innerHTML = ""
      + '<div class="fx-row"><button type="button" id="tcapBuild" title="Transcribe what is said on the timeline (on this machine) and make the captions">✨ From speech</button>'
      + '<label>max <input type="number" id="tcapMax" min="12" max="120" value="42" style="width:50px"> chars</label>'
      + '<label>language <input type="text" id="tcapLang" placeholder="auto" maxlength="8" style="width:56px"></label></div>'
      + '<div class="fx-dim" id="tcapMsg">' + (info && info.asr && !info.asr.installed ? "Speech-to-text (faster-whisper) is not installed yet - Settings → Audio installs it." : "") + "</div>"
      + '<fieldset><legend><span id="tcapCount"></span> <button class="ghost" type="button" id="tcapAdd" title="A new caption at the position marker">＋</button></legend><div id="tcapList" style="max-height:30vh;overflow:auto"></div></fieldset>'
      + "<fieldset><legend>Style</legend>"
      + '<div class="fx-row"><select id="tcapFont">' + opt(FONTS.concat(FONTS.indexOf(st.font) < 0 ? [st.font] : []), st.font) + "</select>"
      + '<label>size <input type="number" id="tcapSize" min="1" max="20" step="0.5" value="' + st.size + '" style="width:54px">%</label>'
      + '<input type="color" id="tcapColor" value="' + esc(st.color) + '" title="Text colour">'
      + '<label><input type="checkbox" id="tcapBold"' + (st.bold !== false ? " checked" : "") + "><b>B</b></label></div>"
      + '<div class="fx-row"><label>outline <input type="number" id="tcapOl" min="0" max="20" step="0.5" value="' + st.outline + '" style="width:50px"></label>'
      + '<input type="color" id="tcapOlC" value="' + esc(st.outline_color) + '" title="Outline colour">'
      + '<label><input type="checkbox" id="tcapBox"' + (st.box ? " checked" : "") + "> box</label>"
      + '<input type="color" id="tcapBoxC" value="' + esc(st.box_color) + '" title="Box colour">'
      + '<label><input type="number" id="tcapBoxO" min="0" max="100" value="' + Math.round(st.box_opacity * 100) + '" style="width:46px">%</label></div>'
      + '<div class="fx-row"><select id="tcapPos">' + opt([["bottom", "bottom"], ["middle", "middle"], ["top", "top"]], st.position) + "</select>"
      + '<label>margin <input type="number" id="tcapMargin" min="0" max="40" step="0.5" value="' + st.margin + '" style="width:50px">%</label></div></fieldset>'
      + "<fieldset><legend>Output</legend>"
      + '<div class="fx-row"><label><input type="checkbox" id="tcapVis"' + (c.visible !== false ? " checked" : "") + "> on (canvas + compile)</label>"
      + '<label><input type="checkbox" id="tcapBurn"' + (c.burn !== false ? " checked" : "") + "> burn into the movie</label>"
      + '<label><input type="checkbox" id="tcapSrt"' + (c.srt ? " checked" : "") + "> .srt beside it</label></div></fieldset>";
    $("tcapBuild").onclick = build;
    $("tcapAdd").onclick = function () {
      var t = TlCanvas.state.t || 0;
      c.cues.push({ start: +t.toFixed(2), end: +(t + 2).toFixed(2), text: "…" });
      c.cues.sort(function (a, b) { return a.start - b.start; }); save(); paintList();
    };
    var sty = function () {
      Object.assign(c.style, { font: $("tcapFont").value, size: +$("tcapSize").value || 5.5, color: $("tcapColor").value, bold: $("tcapBold").checked,
        outline: Math.max(0, +$("tcapOl").value || 0), outline_color: $("tcapOlC").value, box: $("tcapBox").checked, box_color: $("tcapBoxC").value,
        box_opacity: Math.max(0, Math.min(1, (+$("tcapBoxO").value || 0) / 100)), position: $("tcapPos").value, margin: Math.max(0, +$("tcapMargin").value || 0) });
      save();
    };
    ["tcapFont", "tcapSize", "tcapColor", "tcapBold", "tcapOl", "tcapOlC", "tcapBox", "tcapBoxC", "tcapBoxO", "tcapPos", "tcapMargin"].forEach(function (id) {
      $(id).addEventListener("input", sty); $(id).addEventListener("change", sty);
      $(id).addEventListener("keydown", function (e) { e.stopPropagation(); });
    });
    $("tcapVis").onchange = function () { c.visible = $("tcapVis").checked; save(); };
    $("tcapBurn").onchange = function () { c.burn = $("tcapBurn").checked; save(); };
    $("tcapSrt").onchange = function () { c.srt = $("tcapSrt").checked; save(); };
    paintList();
  }
  function srtDownload() {
    fetch("/api/captions/srt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cues: C().cues }) })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" }));
        a.download = ((typeof tlName !== "undefined" && tlName) || "timeline") + ".srt"; document.body.appendChild(a); a.click(); a.remove();
      });
  }
  function openDlg() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlCapDlg", title: "Captions", width: 620 });
      dlg.foot.innerHTML = '<button class="ghost" type="button" id="tcapClear" title="Remove every caption">Clear</button>'
        + '<button class="ghost" type="button" id="tcapDl" title="Download the captions as a .srt">⬇ .srt</button><span style="flex:1"></span>'
        + '<button type="button" id="tcapDone">Done</button>';
      $("tcapDone").onclick = function () { dlg.close(); };
      $("tcapDl").onclick = srtDownload;
      $("tcapClear").onclick = function () { if (confirm("Remove every caption?")) { C().cues = []; save(); paintList(); } };
    }
    fetch("/api/captions/info").then(function (r) { return r.json(); }).then(function (j) { info = j; if (j.fonts) FONTS = j.fonts; }).catch(function () { /* offline */ })
      .then(function () { paintDlg(); dlg.open(); });
  }

  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlCanvas.onComp(paint);
    TlDlg.button("tlCapBtn", "💬", "Captions", openDlg);
  }
  window.TlCaptions = { open: openDlg, cueAt: cueAt, paint: paint };
  boot();
})();
