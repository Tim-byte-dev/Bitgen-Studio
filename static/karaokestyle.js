/* bitGen Studio — the KARAOKE STYLE dialog (2.380.0), opened from the video docker's ⚙ and the timeline's ⚙.
 *
 * Tim (verbatim): "add karaoke options to settings in videodocker and timelinedocker settings - font, font-size,
 * color, text-shadow, border color, background color, background opacity, font-opacity, background-border color,
 * background-border width, box shadow, ball size, ball color, ball outline color, background-height,
 * position-top:n px".
 *
 * A titlebar, the fields, a live preview, Defaults / Cancel / Save. GET / POST /api/karaoke/style (lib/karaokeStyle.js
 * normalizes it; it lives in the settings file). Every NEW overlay uses it - scenes, and the timeline's 🎤 generator.
 * No explanations in here (docs/help: static/help/timeline.html).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var dlg = null, defaults = null;
  var FIELDS = [
    // [key, label, type, extra]
    ["font", "Font", "font"], ["font_size", "Font size (px, 0 = auto)", "num", [0, 400]],
    ["color", "Colour", "color"], ["highlight", "Sung colour", "color"],
    ["font_opacity", "Font opacity %", "num", [0, 100]], ["text_shadow", "Text shadow (px)", "num", [0, 40]],
    ["border_color", "Border colour", "color"], ["border_width", "Border width (px)", "num", [0, 30]],
    ["bg_color", "Background colour", "color"], ["bg_opacity", "Background opacity %", "num", [0, 100]],
    ["bg_border_color", "Background border colour", "color"], ["bg_border_width", "Background border (px)", "num", [0, 40]],
    ["box_shadow", "Box shadow (px)", "num", [0, 80]], ["bg_height", "Background height (px, 0 = auto)", "num", [0, 2000]],
    ["position_top", "Position top (px, -1 = auto)", "num", [-1, 4000]],
    ["ball_size", "Ball size (px, 0 = auto)", "num", [0, 200]], ["ball_color", "Ball colour", "color"],
    ["ball_outline_color", "Ball outline colour", "color"]
  ];
  var FONTS = ["", "Arial", "Arial Black", "Verdana", "Tahoma", "Trebuchet MS", "Georgia", "Times New Roman",
               "Impact", "Comic Sans MS", "Segoe UI", "Calibri", "Liberation Sans", "DejaVu Sans"];

  var CSS = ""
    + "dialog.ksdlg{width:min(720px,94vw);padding:0;overflow:hidden}"
    + ".ksdlg .ks-title{display:flex;align-items:center;gap:8px;height:36px;padding:0 0 0 14px;user-select:none;"
    + "border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}"
    + ".ksdlg .ks-title h2{margin:0;flex:1;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase}"
    + ".ksdlg .ks-x{width:46px;height:36px;border:0;border-radius:0 10px 0 0;background:none;color:var(--text,#e8e2d6);font-size:15px;cursor:pointer}"
    + ".ksdlg .ks-x:hover{background:#c42b1c}"
    + ".ksdlg .ks-body{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;padding:12px 16px;font-size:.76rem;max-height:56vh;overflow:auto}"
    + ".ksdlg .ks-row{display:grid;grid-template-columns:1fr 110px;gap:6px;align-items:center}"
    + ".ksdlg .ks-row input,.ksdlg .ks-row select{width:100%;font-size:.74rem}"
    + ".ksdlg .ks-row input[type=color]{height:24px;padding:0}"
    + ".ksdlg .ks-prev{margin:0 16px;height:150px;border:1px solid var(--line,#3a342a);border-radius:6px;position:relative;overflow:hidden;"
    + "background:linear-gradient(135deg,#35506e,#7a5a3a)}"
    + ".ksdlg .ks-band{position:absolute;left:0;right:0}"
    + ".ksdlg .ks-l1,.ksdlg .ks-l2{position:absolute;left:0;right:0;text-align:center;font-weight:bold;white-space:nowrap}"
    + ".ksdlg .ks-ball{position:absolute;border-radius:50%}"
    + ".ksdlg .ks-foot{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px 14px}"
    + ".ksdlg .ks-msg{margin-right:auto;color:var(--dim,#9a917f);font-size:.72rem;align-self:center}";

  function build() {
    if (dlg) return dlg;
    if (!$("ksStyle")) { var st = document.createElement("style"); st.id = "ksStyle"; st.textContent = CSS; document.head.appendChild(st); }
    dlg = document.createElement("dialog");
    dlg.className = "ksdlg"; dlg.id = "ksDlg"; dlg.setAttribute("aria-label", "Karaoke style");
    var rows = FIELDS.map(function (f) {
      var id = "ks_" + f[0], inp;
      if (f[2] === "color") inp = '<input type="color" id="' + id + '">';
      else if (f[2] === "font") inp = '<select id="' + id + '">' + FONTS.map(function (n) { return '<option value="' + n + '">' + (n || "Default") + "</option>"; }).join("") + "</select>";
      else inp = '<input type="number" id="' + id + '" min="' + f[3][0] + '" max="' + f[3][1] + '" step="1">';
      return '<label class="ks-row" for="' + id + '"><span>' + f[1] + "</span>" + inp + "</label>";
    }).join("");
    dlg.innerHTML = '<div class="ks-title"><h2>🎤 Karaoke style</h2><button type="button" class="ks-x" id="ksClose" aria-label="Close" title="Close">✕</button></div>'
      + '<div class="ks-body">' + rows + "</div>"
      + '<div class="ks-prev" id="ksPrev"><div class="ks-band" id="ksBand"></div><div class="ks-l1" id="ksL1">'
      + '<span id="ksSung">Hello neon </span><span id="ksTodo">city tonight</span></div><div class="ks-l2" id="ksL2">We dance until the light</div>'
      + '<div class="ks-ball" id="ksBall"></div></div>'
      + '<div class="ks-foot"><span class="ks-msg" id="ksMsg" aria-live="polite"></span>'
      + '<button type="button" class="ghost" id="ksDefaults">Defaults</button>'
      + '<button type="button" class="ghost" id="ksCancel">Cancel</button>'
      + '<button type="button" class="go" id="ksSave" style="width:auto;margin-top:0;padding:6px 22px">Save</button></div>';
    document.body.appendChild(dlg);
    $("ksClose").addEventListener("click", function () { dlg.close(); });
    $("ksCancel").addEventListener("click", function () { dlg.close(); });
    $("ksSave").addEventListener("click", save);
    $("ksDefaults").addEventListener("click", function () { if (defaults) { fill(defaults); preview(); } });
    FIELDS.forEach(function (f) { $("ks_" + f[0]).addEventListener("input", preview); $("ks_" + f[0]).addEventListener("change", preview); });
    return dlg;
  }
  function fill(s) {
    FIELDS.forEach(function (f) {
      var el = $("ks_" + f[0]); if (!el) return;
      var v = s[f[0]];
      if (f[2] === "font" && v && ![].some.call(el.options, function (o) { return o.value === v; })) {
        var o = document.createElement("option"); o.value = v; o.textContent = v; el.appendChild(o);
      }
      el.value = v == null ? "" : v;
    });
  }
  function read() {
    var o = {};
    FIELDS.forEach(function (f) { var el = $("ks_" + f[0]); o[f[0]] = f[2] === "num" ? Number(el.value) : el.value; });
    return o;
  }
  function rgba(hex, a) {
    var h = String(hex || "#000000").replace("#", "");
    return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")";
  }
  /* the preview: the overlay's look at the preview's height, scaled from a 720-high picture */
  function preview() {
    var s = read(), P = $("ksPrev"); if (!P) return;
    var H = P.clientHeight || 150, k = H / 720;
    var size = (s.font_size > 0 ? s.font_size : 54) * k, nsize = size * 0.82, pad = Math.max(6 * k, size * 0.35);
    var content = size * 1.05 + nsize * 1.15;
    var top, bh;
    if (s.position_top >= 0) { top = s.position_top * k; bh = s.bg_height > 0 ? s.bg_height * k : content + pad * 2; }
    else { var yc = H * 0.8; top = yc - size * 1.05 - pad; bh = s.bg_height > 0 ? s.bg_height * k : (yc + size * 1.15) - top + pad * 0.6; }
    var yCur = top + Math.max(0, (bh - content) / 2) + size * 1.05;
    if (s.position_top < 0) yCur = H * 0.8;
    var band = $("ksBand"), op = Math.max(0, Math.min(100, s.bg_opacity)) / 100;
    band.style.display = op > 0 ? "" : "none";
    band.style.top = top + "px"; band.style.height = bh + "px";
    band.style.background = rgba(s.bg_color, op);
    var bw = Math.max(0, s.bg_border_width) * k;
    band.style.borderTop = band.style.borderBottom = bw ? (bw + "px solid " + s.bg_border_color) : "none";
    band.style.boxShadow = s.box_shadow > 0 ? ("0 " + (s.box_shadow * k / 2) + "px " + (s.box_shadow * k) + "px rgba(0,0,0,.6)") : "none";
    var fo = Math.max(0, Math.min(100, s.font_opacity)) / 100;
    var outline = Math.max(0, s.border_width) * k, sh = Math.max(0, s.text_shadow) * k;
    var fam = (s.font ? '"' + s.font + '",' : "") + "Arial, sans-serif";
    var deco = function (el, px) {
      el.style.fontFamily = fam; el.style.fontSize = px + "px"; el.style.opacity = String(fo);
      el.style.webkitTextStroke = outline ? (outline + "px " + s.border_color) : "0";
      el.style.textShadow = sh ? (sh + "px " + sh + "px 0 rgba(0,0,0,.5)") : "none";
      el.style.paintOrder = "stroke fill";
    };
    var L1 = $("ksL1"), L2 = $("ksL2");
    deco(L1, size); deco(L2, nsize);
    L1.style.top = (yCur - size * 1.05) + "px";
    L2.style.top = (yCur + nsize * 0.1) + "px"; L2.style.color = s.color; L2.style.opacity = String(fo * 0.78);
    $("ksSung").style.color = s.highlight; $("ksTodo").style.color = s.color;
    var r = (s.ball_size > 0 ? s.ball_size : 54 * 0.2) * k * (s.font_size > 0 ? 1 : 1);
    var B = $("ksBall");
    B.style.width = B.style.height = (r * 2) + "px";
    B.style.background = s.ball_color; B.style.border = Math.max(1, r / 4) + "px solid " + s.ball_outline_color;
    B.style.left = "calc(50% + " + (size * 0.5) + "px)"; B.style.top = (yCur - size * 0.88 - r * 2 - size * 0.4) + "px";
  }
  function say(t) { $("ksMsg").textContent = t || ""; }
  function open() {
    build();
    say("");
    fetch("/api/karaoke/style").then(function (r) { return r.json(); }).then(function (j) {
      defaults = j.defaults || null;
      fill(j.style || j.defaults || {});
      if (!dlg.open) dlg.showModal();
      requestAnimationFrame(preview);
    }).catch(function (e) { if (!dlg.open) dlg.showModal(); say("could not read the style: " + (e.message || e)); });
  }
  function save() {
    say("saving…");
    fetch("/api/karaoke/style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ style: read() }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (j) {
        try { if (typeof cfg === "object" && cfg) cfg.ui = Object.assign({}, cfg.ui || {}, { karaoke_style: j.style }); } catch (e) { /* next load */ }
        if (typeof logLine === "function") logLine("[karaoke] style saved - new overlays use it");
        dlg.close();
      }).catch(function (e) { say("not saved: " + (e.message || e)); });
  }
  window.KaraokeStyle = { open: open, read: function () { return dlg ? read() : null; } };
})();
