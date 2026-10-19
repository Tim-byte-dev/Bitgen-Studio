/* bitGen Studio — static/negprompt.js (2.419.0): THE NEGATIVE PROMPT DOCKER (window.H3Neg).
 *
 * Tim: "add a negative prompt docker - "2" toggles negative prompt docker. put the negative prompts the llm creates in
 * this docker. use negative prompts with models that accept it".
 *
 *   2             shows / hides it (or Negative in the statusbar; not while typing, not with a dialog open, not while the 🎥 multi-camera dialog
 *                 is open - there 1-9 cut between the angles); a dockable window like Basic Settings (static/secfloat.js:
 *                 floats, docks beside / inside a docker; docker_status.json floats.negprompt)
 *   the text      goes with EVERY generation (image, H3, LTX, Wan, the image editor's / ✨ Fill's AI edits) as `negative`;
 *                 empty = the style's own negative, as before. The status line says whether the selected model USES it:
 *                 SDXL / Pony / Illustrious (and any ComfyUI image style at cfg > 1), LTX, Wan 2.1 / 2.2, MiniMax H3 at
 *                 cfg > 1 (true CFG) - not FLUX / Qwen / Z-Image (distilled, cfg 1), music or speech
 *   ↺ style       puts the selected style's own negative here to edit
 *   the LLM       a reply's "Negative: ..." line never goes into the positive prompt any more: split() takes it out and
 *                 (with "put the LLM's negatives here" on) it lands in this docker - the chat's ⬇ To prompt, a ```image /
 *                 ```video fence, Generate itself
 *
 *   pure (Node + page): split(text) -> {positive, negative}; accepts(ctx) -> {use, why}; clean(s)
 */
(function (root) {
  "use strict";
  var MAX = 2000;
  var NEG_LINE = /^[ \t>*_-]*(?:\*\*|__)?\s*neg(?:ative)?(?:[ \t]+prompt)?\s*(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.*)$/i;

  function clean(s) { return String(s == null ? "" : s).replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX); }
  /** a reply / prompt -> {positive (without its Negative: lines), negative (those lines' text, joined)} */
  function split(text) {
    var lines = String(text == null ? "" : text).replace(/\r/g, "").split("\n"), pos = [], neg = [];
    for (var i = 0; i < lines.length; i++) {
      var m = NEG_LINE.exec(lines[i]);
      if (!m) { pos.push(lines[i]); continue; }
      var parts = [m[1]];
      // the negative may run on to the next lines until a blank one (a list of phrases)
      while (i + 1 < lines.length && lines[i + 1].trim() && !NEG_LINE.test(lines[i + 1]) && /^[ \t]*[-*•]/.test(lines[i + 1])) { parts.push(lines[++i].replace(/^[ \t]*[-*•][ \t]*/, "")); }
      var t = parts.filter(function (x) { return String(x).trim(); }).join(", ").replace(/(\*\*|__)\s*$/, "").replace(/^["'`]+|["'`]+$/g, "").trim();
      if (t && neg.indexOf(t) < 0) neg.push(t);
    }
    return { positive: pos.join("\n").replace(/\n{3,}/g, "\n\n").trim(), negative: clean(neg.join(", ")) };
  }
  /** does the model that will run use a negative prompt? ctx = {mode, imageStyle, imageArch, videoStyle, cfg} */
  function accepts(ctx) {
    var c = ctx || {}, mode = String(c.mode || "video");
    if (mode === "image") {
      var st = c.imageStyle, ar = c.imageArch;
      if (!st) return { use: false, why: "pick an image style" };
      if (ar && ar.negative) return { use: true, why: (ar.label || st.arch || "this model") + " uses it" };
      if (String(st.engine) === "comfy" && +st.cfg > 1) return { use: true, why: "its ComfyUI workflow's negative input (cfg " + st.cfg + ")" };
      return { use: false, why: (ar && ar.label ? ar.label : (st.arch || "this model")) + " is distilled (cfg 1) - it has no negative" };
    }
    if (mode === "video" || mode === "swap") {
      if (mode === "swap") return { use: false, why: "a swap does not use one" };
      var vs = c.videoStyle, arch = String((vs && vs.arch) || "minimax-h3").toLowerCase();
      if (vs && (vs.ltx || /ltx/.test(arch))) return { use: true, why: "LTX uses it" };
      if (/wan/.test(arch)) return { use: true, why: "Wan uses it" };
      var cfg = +c.cfg || 1;
      if (cfg > 1) return { use: true, why: "MiniMax H3 at cfg " + cfg + " (true CFG - about 2x the time)" };
      return { use: false, why: "MiniMax H3 at cfg 1 has no negative - raise cfg above 1 in Basic Settings to use it" };
    }
    if (mode === "audio") return { use: false, why: "music does not use one" };
    if (mode === "speech") return { use: false, why: "speech does not use one" };
    return { use: false, why: "not used in " + mode + " mode" };
  }
  var pure = { split: split, accepts: accepts, clean: clean, MAX: MAX };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "h3.neg", AUTO = "h3.negAuto";
  var CSS = ".negdock{display:flex;flex-direction:column;gap:6px;height:100%;min-height:0}"
    + ".negdock .nrow{display:flex;align-items:center;gap:6px;font-size:.72rem}"
    + ".negdock .nuse{flex:1;min-width:0;color:var(--dim,#9a917f);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".negdock .nuse.on{color:#3fbf5f}.negdock .nuse.off{color:#e8a23a}"
    + ".negdock textarea{flex:1 1 auto;min-height:60px;width:100%;resize:none;font-size:.8rem}"
    + ".negdock .nauto{font-size:.68rem;color:var(--dim,#9a917f)}"
    + "#negBtn.on{color:var(--tiger,#f59e2c)}";
  function ss(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }
  function ta() { return $("negPrompt"); }
  function get() { var t = ta(); return clean(t ? t.value : (ss(KEY) || "")); }
  function set(text, why) {
    var t = ta(), v = clean(text);
    if (t) t.value = v;
    ss(KEY, v);
    paint();
    if (why && typeof logLine === "function") logLine("[negative] " + why + (v ? ": " + v.slice(0, 90) + (v.length > 90 ? "…" : "") : " - cleared"));
  }
  function auto() { var a = $("negAuto"); return a ? a.checked : ss(AUTO) !== "0"; }
  /** take a reply / prompt's Negative: lines out -> the positive; the negative lands here (auto on) */
  function take(text) {
    var s = split(text);
    if (s.negative && auto()) set(s.negative, "from the LLM");
    return s.positive;
  }
  function ctx() {
    var mode = $("genModeSel") ? $("genModeSel").value : "video";
    var is = null, ia = null, vs = null;
    try { is = (typeof styleList !== "undefined" ? styleList : []).find(function (x) { return x.id === ($("styleSel") || {}).value; }) || null; } catch (e) { is = null; }
    try { ia = is && typeof imgCat !== "undefined" && imgCat ? ((imgCat.archs || imgCat).find ? (imgCat.archs || imgCat).find(function (a) { return a.id === is.arch; }) : (imgCat.archs || imgCat)[is.arch]) : null; } catch (e) { ia = null; }
    try { vs = (typeof videoStyles !== "undefined" ? videoStyles : []).find(function (x) { return x.id === ($("videoStyleSel") || {}).value; }) || null; } catch (e) { vs = null; }
    return { mode: mode, imageStyle: is, imageArch: ia, videoStyle: vs, cfg: $("cfg") ? +$("cfg").value : 1 };
  }
  function status() { return accepts(ctx()); }
  function paint() {
    var u = $("negUse"); if (!u) return;
    var a = status(), has = !!get();
    u.textContent = (a.use ? "✓ " : "✗ ") + a.why + (a.use && !has ? " · empty = the style's own" : "");
    u.className = "nuse " + (a.use ? "on" : "off");
    u.title = u.textContent;
    var b = $("negBtn"); if (b) b.title = "Negative prompt docker (2)" + (has ? " - " + get().slice(0, 80) : "");
  }
  function styleNeg() {
    var c = ctx(), st = c.mode === "image" ? c.imageStyle : c.videoStyle;
    return st && st.negative ? String(st.negative) : "";
  }
  function show(on) { if (window.SecFloat && SecFloat.show) return SecFloat.show("negprompt", on); return false; }
  function build() {
    var body = document.createElement("div"); body.className = "negdock"; body.id = "negDock";
    body.innerHTML = '<div class="nrow"><span id="negUse" class="nuse"></span>'
      + '<button type="button" class="ghost" id="negStyle" title="Put the selected style\'s own negative here to edit">↺ style</button>'
      + '<button type="button" class="ghost" id="negClear" title="Clear (the style\'s own negative is used)">🧹</button></div>'
      + '<textarea id="negPrompt" rows="4" spellcheck="false" placeholder="What the picture must NOT have - e.g. blurry, deformed hands, extra fingers, text, watermark"></textarea>'
      + '<label class="nauto"><input type="checkbox" id="negAuto"' + (ss(AUTO) === "0" ? "" : " checked") + '> put the LLM\'s "Negative:" lines here</label>';
    return body;
  }
  function start() {
    if (!window.SecFloat || !SecFloat.add || !SecFloat.started || !$("tP")) { setTimeout(start, 120); return; }
    if ($("negDock")) return;
    if (!$("negCss")) { var st = document.createElement("style"); st.id = "negCss"; st.textContent = CSS; document.head.appendChild(st); }
    var body = build();
    // the statusbar, beside Prompt (where every docker's toggle is) - not in the prompt docker's bar: a wider bar wraps
    // and the floating prompt docker grows over the timeline
    var btn = document.createElement("button"); btn.type = "button"; btn.id = "negBtn"; btn.textContent = "Negative";
    btn.setAttribute("aria-label", "Negative prompt docker (2)");
    $("tP").parentNode.insertBefore(btn, $("tP").nextSibling);
    SecFloat.add({ id: "negprompt", title: "Negative prompt", key: "2", w: 380, h: 210, body: body, button: btn, free: true,
      skip: function () { var m = $("tlMulticamDlg"); return !!(m && (m.open || m.hasAttribute("open"))); },   // its 1 - 9 cut cameras
      onShow: function () { paint(); setTimeout(function () { var t = ta(); if (t) t.focus(); }, 30); } });
    var t = ta();
    t.value = clean(ss(KEY) || "");
    t.addEventListener("input", function () { ss(KEY, t.value); paint(); });
    t.addEventListener("keydown", function (e) { e.stopPropagation(); });
    $("negAuto").onchange = function () { ss(AUTO, $("negAuto").checked ? "1" : "0"); };
    $("negClear").onclick = function () { set("", "cleared"); };
    $("negStyle").onclick = function () { var s = styleNeg(); set(s, s ? "the style's own" : "the style has none"); };
    ["genModeSel", "styleSel", "videoStyleSel", "cfg"].forEach(function (id) { var el = $(id); if (el) { el.addEventListener("change", paint); el.addEventListener("input", paint); } });
    paint();
    setInterval(paint, 3000);                       // styles load late; Basic Settings may be switched from elsewhere
  }
  root.H3Neg = { pure: pure, split: split, accepts: accepts, clean: clean, get: get, set: set, take: take, status: status, paint: paint, show: show, ctx: ctx };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
