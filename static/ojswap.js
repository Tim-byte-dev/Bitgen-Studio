/* bitGen Studio — static/ojswap.js (2.949.0): THE ⇄ SWAP DIALOG'S OPENJUTSU BAR.
 *
 * Tim: "is this worth adding? https://github.com/D3voz/openjutsu" -> "lets do it".
 * With Engine ▸ OpenJutsu, a bar opens under the dialog's video menubar (static/swapdlg.js calls paint() after every
 * state update):
 *   row 1  Mode (Simple / Advanced 1-4 characters / One pass per person / Object) and its fields: who is replaced and
 *          what SAM follows (Simple); characters 2-4 (click = a picture, ✕ = drop it) + a role for each (Advanced);
 *          change / remove / background, what, what it becomes, only the biggest, keep the outline (Object)
 *   row 2  Size (480p ... 1080p or custom WxH), motion reference, mask margin, hat fix, no lip-sync, clip seconds,
 *          DMAD + steps, ⚡ Spectrum (without DMAD) · 👁 Check mask (the box) · 🎨 Fix colours / 🙂 Fix faces (the
 *          previewed take; 🙂 needs "I accept" - InsightFace non-commercial, YOLO AGPL-3.0) · the add-on's state
 * Server: routes/openjutsu.js (settings, pictures, mask, fix) - every change is saved at once into the dialog's record.
 *
 * window.H3OjSwap = { paint(c, st), patch(o), _build(c) }  (c = SwapDialog.state())
 */
(function () {
  "use strict";
  var addon = null, addonAt = 0;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function api() { return (window.SwapDialog && window.SwapDialog._api) || {}; }
  function msg(t, bad) { var a = api(); if (a.msg) a.msg(t, bad); }
  function jpost(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); });
  }
  function apply(j) { var a = api(); if (j && j.error) { msg("⚠ " + j.error, true); return j; } if (a.apply) a.apply(j); return j; }

  var CSS = ".swdlg .swOjBar{display:flex;flex-direction:column;gap:4px;border:1px solid var(--line,#333);border-radius:6px;padding:5px 7px;"
    + "background:var(--panel-2,#222);font-size:.72rem}"
    + ".swdlg .swOjBar[hidden]{display:none}"
    + ".swdlg .ojRow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}"
    + ".swdlg .ojRow input[type=text]{width:150px}.swdlg .ojRow input[type=number]{width:58px}"
    + ".swdlg .ojPic{width:34px;height:34px;border:1px dashed var(--line,#555);border-radius:5px;display:inline-flex;align-items:center;"
    + "justify-content:center;cursor:pointer;background-size:cover;background-position:center;color:var(--dim,#999);position:relative}"
    + ".swdlg .ojPic.on{border-style:solid;border-color:var(--tiger,#f59e2c)}"
    + ".swdlg .ojPic .x{position:absolute;top:-6px;right:-6px;font-size:10px;line-height:12px;width:12px;height:12px;border-radius:6px;"
    + "background:#c44;color:#fff;text-align:center}"
    + ".swdlg .ojState{color:var(--dim,#999)}.swdlg .ojState.bad{color:#ff8b6b}"
    + ".swdlg .ojLic{color:#ffb36b}";

  function injectCss() {
    if (document.getElementById("ojswapCss")) return;
    var s = document.createElement("style"); s.id = "ojswapCss"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function modeOptions(st) {
    return (st.oj_modes || []).map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.label) + "</option>"; }).join("");
  }

  function build(c, st) {
    injectCss();
    var bar = document.createElement("div");
    bar.className = "swOjBar";
    bar.setAttribute("aria-label", "OpenJutsu settings");
    var pics = [2, 3, 4].map(function (n) {
      return '<span class="ojPic" data-n="' + n + '" tabindex="0" role="button" title="Character ' + n + ' - click to pick a picture (drop an Image asset here too)">' + n + "</span>";
    }).join("");
    var roles = [1, 2, 3, 4].map(function (n) {
      return '<input type="text" class="ojRoleN" data-i="' + (n - 1) + '" placeholder="role ' + n + '" title="Who character ' + n + ' replaces - e.g. the drummer (blank = by screen time). Text after \' - \' only helps find them">';
    }).join("");
    bar.innerHTML =
      '<div class="ojRow"><b title="OpenJutsu by D3voz (MIT) - its own ComfyUI workflows, run by bitGen">OpenJutsu</b>'
      + '<label>Mode <select class="ojMode">' + modeOptions(st) + "</select></label>"
      + '<span class="ojSimple"><label title="Who the character replaces - blank lets the describer name the main person">Replace <input type="text" class="ojRole" placeholder="the main person"></label>'
      + '<label title="What SAM 3.1 tracks - the biggest one is replaced (person, cat ...)">Track <input type="text" class="ojTarget" placeholder="person"></label></span>'
      + '<span class="ojAdv"><span title="Character 1 is the picture on the left">Characters 2-4 </span>' + pics + " " + roles + "</span>"
      + '<span class="ojObj"><select class="ojOMode" title="Change = it becomes something else; Remove = it goes, the space behind shows; Background = everything but it is replaced">'
      + '<option value="change">Change</option><option value="remove">Remove</option><option value="background">Background</option></select>'
      + '<label title="What SAM tracks - several separated by commas (for Background: what STAYS)">What <input type="text" class="ojOTarget" placeholder="hair, top"></label>'
      + '<label title="What it becomes (or what shows instead) - or leave it blank and pick a picture of it on the left">Becomes <input type="text" class="ojOTo" placeholder="short pink hair, a black leather jacket"></label>'
      + '<label title="One of each thing - the biggest"><input type="checkbox" class="ojOBig"> only the biggest</label>'
      + '<label title="Change: send the grey shape - keeps the face and hands around it, but also the old outline"><input type="checkbox" class="ojOOut"> keep outline</label></span></div>'
      + '<div class="ojRow">'
      + '<label title="The short edge of the swap; the shape follows the video. 480p is a quick preview, 1080p is about 2.5x slower than 736p">Size <select class="ojRes">'
      + "<option>480p</option><option>576p</option><option>736p</option><option>768p</option><option>1080p</option><option value=\"custom\">custom</option></select></label>"
      + '<span class="ojCustom"><input type="number" class="ojW" min="256" max="2048" step="32"> × <input type="number" class="ojH" min="256" max="2048" step="32"></span>'
      + '<label title="The long edge of the grey-mannequin motion reference H3 follows">Motion <select class="ojMotion"><option value="512">512</option><option value="768">768</option><option value="1376">1376</option></select></label>'
      + '<label title="How far the repainted area reaches past the person">Margin <select class="ojMargin"><option value="tight">tight</option><option value="normal">normal</option><option value="loose">loose</option></select></label>'
      + '<label title="Also repaint the main person\'s hat"><input type="checkbox" class="ojHat"> hat fix</label>'
      + '<label title="The people do not sing or talk along: H3 hears silence, sees their faces and is told nobody sings"><input type="checkbox" class="ojNoLip"> no lip-sync</label>'
      + '<label title="The longest clip per H3 generation - OpenJutsu chains them with an overlap">Clip <input type="number" class="ojClip" min="2.5" max="15" step="0.5"> s</label>'
      + '<label title="The DMAD 4-step LoRA: 6 steps. Off: 20+ steps, slower"><input type="checkbox" class="ojDmad"> DMAD</label>'
      + '<label>Steps <input type="number" class="ojSteps" min="1" max="100" step="1"></label>'
      + '<label title="Spectrum speed-up (approximate) - only without DMAD"><input type="checkbox" class="ojSpec"> ⚡ Spectrum</label>'
      + '<button type="button" class="ghost gbtn ojMask" title="👁 What OpenJutsu will repaint in the box: cyan = regenerated, orange = the tracked person, beside the grey mannequin">👁 Check mask</button>'
      + '<button type="button" class="ghost gbtn ojColor" title="🎨 Fix the colours of the take in the result preview: softens H3\'s crunchy detail and grades it (OpenJutsu\'s H3 soft) - a new take">🎨 Fix colours</button>'
      + '<button type="button" class="ghost gbtn ojFace" title="🙂 Regenerate the face of the person in the picture on the take in the result preview - a new take">🙂 Fix faces</button>'
      + '<label class="ojLic" title=""><input type="checkbox" class="ojFaceOk"> I accept</label>'
      + '<span class="ojState"></span></div>'
      + '<input type="file" class="ojPicIn" accept="image/png,image/jpeg,image/webp,image/bmp" hidden>';
    var mid = c.q("swMid") || c.dlg;
    var after = mid.querySelector(".swVrBar") || mid.querySelector(".swBar");
    if (after && after.parentNode) after.parentNode.insertBefore(bar, after.nextSibling); else mid.appendChild(bar);
    wire(c, bar);
    return bar;
  }

  function q(bar, cls) { return bar.querySelector("." + cls); }

  /** save a patch of st.oj, then repaint the dialog */
  function patch(o) { return jpost("/api/openjutsu/settings", { oj: o }).then(apply); }

  function wire(c, bar) {
    function on(cls, ev, fn) { var e = q(bar, cls); if (e) e.addEventListener(ev, fn); }
    on("ojMode", "change", function () { patch({ mode: this.value }); });
    on("ojRole", "change", function () { patch({ role: this.value }); });
    on("ojTarget", "change", function () { patch({ target: this.value }); });
    Array.prototype.forEach.call(bar.querySelectorAll(".ojRoleN"), function (inp) {
      inp.addEventListener("change", function () { var r = ["", "", "", ""].map(function () { return null; }); r[+inp.dataset.i] = inp.value; patch({ roles: r }); });
    });
    on("ojOMode", "change", function () { patch({ object: { mode: this.value } }); });
    on("ojOTarget", "change", function () { patch({ object: { target: this.value } }); });
    on("ojOTo", "change", function () { patch({ object: { change_to: this.value } }); });
    on("ojOBig", "change", function () { patch({ object: { biggest: this.checked } }); });
    on("ojOOut", "change", function () { patch({ object: { outline: this.checked } }); });
    on("ojRes", "change", function () { patch({ resolution: this.value }); });
    on("ojW", "change", function () { patch({ width: +this.value }); });
    on("ojH", "change", function () { patch({ height: +this.value }); });
    on("ojMotion", "change", function () { patch({ motion: +this.value }); });
    on("ojMargin", "change", function () { patch({ margin: this.value }); });
    on("ojHat", "change", function () { patch({ hat: this.checked }); });
    on("ojNoLip", "change", function () { patch({ nolip: this.checked }); });
    on("ojClip", "change", function () { patch({ clip: +this.value }); });
    on("ojDmad", "change", function () { patch({ dmad: this.checked, steps: this.checked ? 6 : 20 }); });
    on("ojSteps", "change", function () { patch({ steps: +this.value }); });
    on("ojSpec", "change", function () { patch({ spectrum: this.checked }); });
    on("ojFaceOk", "change", function () {
      var box = this;
      if (box.checked && !window.confirm(licence(c) + "\n\nTurn 🙂 Fix faces on?")) { box.checked = false; return; }
      patch({ face: { ok: box.checked } });
    });
    on("ojMask", "click", function () { mask(c); });
    on("ojColor", "click", function () { fix(c, "color"); });
    on("ojFace", "click", function () { fix(c, "face"); });
    // characters 2-4
    var want = 0, fin = q(bar, "ojPicIn");
    bar.addEventListener("click", function (e) {
      var x = e.target.closest(".ojPic .x");
      if (x) { e.stopPropagation(); return jpost("/api/openjutsu/picture", { n: +x.parentNode.dataset.n, clear: true }).then(apply); }
      var p = e.target.closest(".ojPic");
      if (p) { want = +p.dataset.n; fin.dataset.n = String(want); fin.value = ""; fin.click(); }   // the app's file dialog (the upload shim) answers
    });
    fin.addEventListener("change", function () {
      var f = fin.files && fin.files[0];
      want = +fin.dataset.n || want;
      if (!f || !want) return;
      var fd = new FormData(); fd.append("n", String(want)); fd.append("image", f, f.name);
      msg("uploading character " + want + "…");
      fetch("/api/openjutsu/picture", { method: "POST", body: fd }).then(function (r) { return r.json(); }).then(function (j) {
        apply(j); if (!j.error) msg("character " + want + " set - give it a role (e.g. the drummer)");
      });
    });
    bar.addEventListener("dragover", function (e) { if (e.target.closest(".ojPic")) e.preventDefault(); });
    bar.addEventListener("drop", function (e) {
      var p = e.target.closest(".ojPic"); if (!p) return;
      e.preventDefault();
      var name = "";
      try { name = e.dataTransfer.getData("text/x-h3-asset") || e.dataTransfer.getData("text/plain") || ""; } catch (er) { name = ""; }
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { var fd = new FormData(); fd.append("n", p.dataset.n); fd.append("image", f, f.name); fetch("/api/openjutsu/picture", { method: "POST", body: fd }).then(function (r) { return r.json(); }).then(apply); }
      else if (name) jpost("/api/openjutsu/picture", { n: +p.dataset.n, asset: name.replace(/^.*\//, "") }).then(apply);
    });
  }

  function licence(c) { return ((c.st || {}).oj_licence || {}).face || "🙂 Fix faces uses non-commercial and AGPL-3.0 models."; }

  function mask(c) {
    var s = c.sel || {};
    msg("👁 queueing the mask check…");
    return jpost("/api/openjutsu/mask", { start: s.start, dur: s.dur }).then(function (j) { apply(j); if (!j.error) msg(j.note || "queued"); return j; });
  }
  function fix(c, kind) {
    var r = c.out;
    if (!r || !r.id) { msg("preview a finished take on the right first (▶ on its row)", true); return Promise.resolve(null); }
    if (kind === "face" && !(((c.st || {}).oj || {}).face || {}).ok) { msg("⚠ " + licence(c) + " Tick \"I accept\" first.", true); return Promise.resolve(null); }
    msg((kind === "color" ? "🎨" : "🙂") + " queueing…");
    return jpost("/api/openjutsu/fix", { id: r.id, kind: kind }).then(function (j) { apply(j); if (!j.error) msg(j.note || "queued"); return j; });
  }

  function setVal(bar, cls, v) {
    var e = q(bar, cls); if (!e || document.activeElement === e) return;
    if (e.type === "checkbox") e.checked = !!v; else e.value = v == null ? "" : String(v);
  }

  function addonState(bar) {
    var now = Date.now();
    if (now - addonAt < 30000 && addon) return show(addon);
    addonAt = now;
    fetch("/api/openjutsu").then(function (r) { return r.json(); }).then(function (j) { addon = j.addon || null; show(addon); }).catch(function () {});
    function show(a) {
      var el = q(bar, "ojState"); if (!el || !a) return;
      el.textContent = a.installed ? "✓ " + a.note : "⚠ " + (a.note || "not installed") + " - Settings ▸ Add-ons ▸ OpenJutsu swap";
      el.classList.toggle("bad", !a.installed);
    }
  }

  function paint(c, st) {
    if (!c || !st) return;
    var bar = c.dlg.querySelector(".swOjBar");
    var onOj = st.engine === "openjutsu";
    if (!onOj) { if (bar) bar.hidden = true; return; }
    if (!bar) bar = build(c, st);
    bar.hidden = false;
    var oj = st.oj || {};
    var mode = oj.mode || "simple";
    setVal(bar, "ojMode", mode);
    q(bar, "ojSimple").hidden = mode !== "simple";
    q(bar, "ojAdv").hidden = !(mode === "advanced" || mode === "maxq");
    q(bar, "ojObj").hidden = mode !== "object";
    setVal(bar, "ojRole", oj.role); setVal(bar, "ojTarget", oj.target);
    Array.prototype.forEach.call(bar.querySelectorAll(".ojRoleN"), function (inp) {
      var i = +inp.dataset.i;
      inp.hidden = mode === "maxq" ? i > 1 : false;
      if (document.activeElement !== inp) inp.value = (oj.roles || [])[i] || "";
    });
    var pics = oj.pictures || [];
    Array.prototype.forEach.call(bar.querySelectorAll(".ojPic"), function (p) {
      var n = +p.dataset.n, f = pics[n - 2];
      p.hidden = mode === "maxq" && n > 2;
      p.classList.toggle("on", !!f);
      p.style.backgroundImage = f ? "url('/api/openjutsu/picture/" + n + "?v=" + encodeURIComponent(f) + "')" : "";
      p.innerHTML = f ? '<span class="x" title="Drop character ' + n + '">✕</span>' : String(n);
    });
    var o = oj.object || {};
    setVal(bar, "ojOMode", o.mode); setVal(bar, "ojOTarget", o.target); setVal(bar, "ojOTo", o.change_to);
    setVal(bar, "ojOBig", o.biggest); setVal(bar, "ojOOut", o.outline);
    q(bar, "ojOOut").parentNode.hidden = o.mode !== "change";
    setVal(bar, "ojRes", oj.resolution);
    q(bar, "ojCustom").hidden = oj.resolution !== "custom";
    setVal(bar, "ojW", oj.width); setVal(bar, "ojH", oj.height);
    setVal(bar, "ojMotion", oj.motion); setVal(bar, "ojMargin", oj.margin);
    setVal(bar, "ojHat", oj.hat); setVal(bar, "ojNoLip", oj.nolip);
    q(bar, "ojHat").parentNode.hidden = mode === "object";
    q(bar, "ojNoLip").parentNode.hidden = mode === "object";
    setVal(bar, "ojClip", oj.clip); setVal(bar, "ojDmad", oj.dmad); setVal(bar, "ojSteps", oj.steps); setVal(bar, "ojSpec", oj.spectrum);
    q(bar, "ojSpec").disabled = !!oj.dmad;
    var face = oj.face || {};
    setVal(bar, "ojFaceOk", face.ok);
    q(bar, "ojFaceOk").parentNode.title = licence(c);
    q(bar, "ojFace").disabled = !face.ok;                // 🎨 / 🙂 act on the previewed take (fix() says when there is none)
    addonState(bar);
  }

  window.H3OjSwap = { paint: paint, patch: patch, _build: build, _mask: mask, _fix: fix };
})();
