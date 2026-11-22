/* bitGen Studio — static/timeest.js (2.908.0): ⏱ THE TIME ESTIMATE BESIDE GENERATE (window.H3TimeEst).
 *
 * Tim: "the time estimate will be good" - how long the render will take on THIS computer, from its own finished renders
 * (📊 Statistics; lib/timeEstimate.js scales the same style's last renders to the size, length, steps and CFG asked).
 *   A small line at the foot of the prompt docker's Generate button (its tooltip says what it is from): "⏱ about 6 min (5 min – 7½ min)", its tooltip says what it is from;
 *   "⏱ no time yet …" before the first render of the style. It follows Generate's mode (🎬 Video / 🖼 Image / 2.910.0 🎶 Music), the style,
 *   Basic Settings' size, seconds, steps and CFG (a quiet look every 2 s - only a change asks the server), and a render
 *   finishing (the job list's count) asks again.
 * Pure (Node): requestOf(ui) -> the POST body, or null for a mode with no estimate (Speech, Graph, Chat). */
(function (root) {
  "use strict";
  /** ui = {mode, vstyle, vname, istyle, iname, width, height, seconds, steps, cfg, iw, ih, isteps, icfg, override} */
  function requestOf(ui) {
    var u = ui || {};
    if (u.mode === "video") {
      return { kind: "video", style: u.vstyle || "", name: u.vname || "", width: +u.width || 0, height: +u.height || 0,
               seconds: +u.seconds || 0, steps: +u.steps || 0, cfg: u.cfg === "" || u.cfg == null ? null : +u.cfg };
    }
    if (u.mode === "image") {
      return { kind: "image", style: u.istyle || "", name: u.iname || "", width: u.override ? +u.iw || 0 : 0, height: u.override ? +u.ih || 0 : 0,
               frames: 1, steps: u.override ? +u.isteps || 0 : 0, cfg: u.override && u.icfg !== "" && u.icfg != null ? +u.icfg : null };
    }
    if (u.mode === "audio") {                           // 2.910.0: 🎶 Music - the song's length (the Music dock's duration)
      return { kind: "music", style: u.mstyle || "", name: u.mname || "", seconds: +u.mdur || 0 };
    }
    return null;
  }
  var API = { requestOf: requestOf };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = API; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  function val(id) { var e = $(id); return e ? e.value : ""; }
  function optName(id) { var s = $(id); var o = s && s.options && s.options[s.selectedIndex]; return o && o.value ? String(o.textContent || "").trim() : ""; }
  function ui() {
    var iwh = null;
    try { if (typeof root.imgWhFromUi === "function") iwh = root.imgWhFromUi(); } catch (e) { iwh = null; }
    var ov = $("ovrStyle");
    return { mode: val("genModeSel") || "video", vstyle: val("videoStyleSel"), vname: optName("videoStyleSel"), istyle: val("styleSel"), iname: optName("styleSel"),
             width: val("width"), height: val("height"), seconds: val("seconds"), steps: val("steps"), cfg: val("cfg"),
             iw: iwh ? iwh.width : 0, ih: iwh ? iwh.height : 0, isteps: val("imgSteps"), icfg: val("imgCfg"), override: !!(ov && ov.checked),
             mstyle: val("musicSel"), mname: optName("musicSel"), mdur: val("muDur") };
  }
  /** the estimate rides IN the Generate button (2.908.0): a small line at its foot (#go[data-est]::after - no height
   *  taken from the prompt docker, whose column ends at the button), the tooltip on the button; #goEst (hidden) keeps the
   *  text + tooltip for the tests and the 🧪 list */
  function line() {
    var el = $("goEst");
    if (el) return el;
    var go = $("go"); if (!go || !go.parentNode) return null;
    if (!$("goEstCss")) {
      var st = doc.createElement("style"); st.id = "goEstCss";
      st.textContent = "#go{position:relative}#go[data-est]::after{content:attr(data-est);position:absolute;left:0;right:0;bottom:3px;"
        + "font-size:.6rem;line-height:1;font-weight:400;letter-spacing:0;text-transform:none;opacity:.8;pointer-events:none;"
        + "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px}";
      doc.head.appendChild(st);
    }
    el = doc.createElement("span"); el.id = "goEst"; el.hidden = true;
    go.parentNode.insertBefore(el, go);
    return el;
  }
  function show(text, title) {
    var go = $("go"), el = line(); if (!go || !el) return;
    el.textContent = text || ""; el.title = title || "";
    if (text) { go.setAttribute("data-est", text); go.title = title || ""; }
    else { go.removeAttribute("data-est"); if (go.title && /^Estimated from|this computer's own renders/.test(go.title)) go.title = ""; }
  }
  var lastKey = "", seq = 0, jobsSeen = -1;
  function ask(force) {
    var el = line(); if (!el) return;
    var body = requestOf(ui());
    if (!body) { show("", ""); el.dataset.off = "1"; lastKey = ""; return; }
    el.dataset.off = "";
    var key = JSON.stringify(body);
    if (!force && key === lastKey) return;
    lastKey = key;
    var my = ++seq;
    root.fetch("/api/timeestimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: key })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (my !== seq || !j || j.error) return;
        show(j.text, j.title || "");
        el.dataset.ms = j.estimate ? String(j.estimate.ms) : "";
        try { if (root.H3TestEvent) root.H3TestEvent("time_estimate", j.text); } catch (e) { /* the 🧪 list */ }
      }).catch(function () { /* the next look */ });
  }
  /** a render finished -> ask again (its time is in the statistics now) */
  function jobsTick() {
    root.fetch("/api/jobs?all=1").then(function (r) { return r.json(); }).then(function (d) {
      var l = Array.isArray(d) ? d : (d && d.jobs) || [];
      var done = l.filter(function (x) { return x && x.status === "done"; }).length;
      if (jobsSeen >= 0 && done !== jobsSeen) ask(true);
      jobsSeen = done;
    }).catch(function () { /* fine */ });
  }
  function boot() {
    if (!$("go")) { root.setTimeout(boot, 500); return; }
    ask(true);
    root.setInterval(function () { ask(false); }, 2000);
    root.setInterval(jobsTick, 15000);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3TimeEst = Object.assign(API, { ask: ask, ui: ui });
})(typeof window !== "undefined" ? window : globalThis);
