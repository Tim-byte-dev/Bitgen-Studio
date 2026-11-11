/* bitGen Studio — static/remotedock.js (2.754.0): THE REMOTE GENERATION DOCKER + USE REMOTE GENERATION (window.H3RemoteDock;
 * routes/remoteDock.js, lib/podShortcuts.js, lib/gpuSplit.js enabled).
 * Tim (verbatim): "can you make a remote generation floating docker, add the toggle for it under the basic settings gpu menu
 * item not in the statusbar. add a checkbox in the settings- remote geneation tab, to use remote generation, if checked show
 * the gpu menu item in basic settings if unchecked hide the gpu menu item ... no point confusing people . i would like to add
 * public pods to my account is it possible to have a shortcut to them?"
 *   Settings ▸ Remote generation  ☐ Use remote generation, first in the tab. Off: the rest of the tab, Basic Settings ▸ GPU
 *                                 and this docker are hidden, and everything runs on this computer (lib/gpuSplit.js).
 *   Basic Settings ▸ GPU          "☁ Remote generation docker" shows / hides it (no status-bar button).
 *   The docker (SecFloat "rgen": floats, docks, remembered like the others)
 *     NOW        where the work runs (Basic Settings ▸ GPU), the remote GPU, the LLM
 *     🖥 PODS    opens the PODS docker - since 2.758.0 your pods, their loading bars and the pod shortcuts (☆ on a
 *                template's card, ★ Shortcuts) live there only (Tim: "can you remove this My pods ... from remote generation
 *                docker and add to pod's card in pods docker")
 *     ⚙          Settings ▸ Remote generation
 *   Links open in the browser (target _blank - electron/main.js setWindowOpenHandler). */
(function (root) {
  "use strict";
  var doc = root.document, S = { on: null, g: null, msg: "" };
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function changed() { try { doc.dispatchEvent(new Event("h3:rgpu")); } catch (e) { /* fine */ } }
  var CSS = "#stab-rgpu.rgOff>*:not(.rgEnRow){display:none!important}"
    + ".rgd{display:flex;flex-direction:column;gap:8px;font-size:.76rem;height:100%;min-height:0;overflow:auto;padding:2px}"
    + ".rgd h4{margin:4px 0 2px;font-size:.72rem;color:var(--dim,#999);font-weight:600}"
    + ".rgd .rgdNow{border:1px solid var(--line,#3a342a);border-radius:7px;padding:6px 8px;background:var(--panel,#1b1814);line-height:1.5}"
    + ".rgd .rgdRow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05)}"
    + ".rgd .rgdRow .nm{flex:1;min-width:140px}.rgd .rgdRow .nm b{color:var(--text,#eee)}"
    + ".rgd a.rgdLink{color:var(--tiger,#f59e2c)}.rgd .rgdAdd{display:flex;gap:4px;flex-wrap:wrap}.rgd .rgdAdd input{flex:1;min-width:120px}";

  /* ---------------- Settings ▸ Remote generation: Use remote generation */
  function buildSwitch() {
    var tab = $("stab-rgpu"); if (!tab || !$("rgMode")) return false;
    if ($("rgEnabled")) return true;
    var row = doc.createElement("div"); row.className = "rgEnRow"; row.style.cssText = "margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid var(--line)";
    row.innerHTML = '<label class="chk" style="margin:0;font-weight:600"><input type="checkbox" id="rgEnabled"> Use remote generation</label>'
      + '<div class="hint" style="margin-top:2px">Render, or run the LLM, somewhere else: a RunPod GPU, OpenRouter or another computer. Off: everything runs on this computer, and Basic Settings ▸ GPU is hidden.</div>';
    tab.insertBefore(row, tab.firstChild);
    $("rgEnabled").onchange = function () { setOn($("rgEnabled").checked); };
    return true;
  }
  function setOn(on) {
    return post("/api/remotegen/enabled", { on: !!on }).then(function (v) {
      if (v && v.error) { if ($("rgEnabled")) $("rgEnabled").checked = !on; return v; }
      S.on = !!(v && v.enabled); S.g = v; paintOn(); changed();
      if (root.H3RemoteGpu && H3RemoteGpu.load) H3RemoteGpu.load();
      return v;
    });
  }
  /** the switch's effect on the page: the tab, Basic Settings ▸ GPU, the docker */
  function paintOn() {
    var on = !!S.on;
    if ($("rgEnabled")) $("rgEnabled").checked = on;
    var tab = $("stab-rgpu"); if (tab) tab.classList.toggle("rgOff", !on);
    var head = doc.querySelector('h2.sec.drop[data-sec="gpu"]'), body = $("sec-gpu");
    if (head) head.style.display = on ? "" : "none";
    if (body) body.style.display = on ? "" : "none";
    if (!on && root.SecFloat && SecFloat.windows && SecFloat.windows.rgen && (SecFloat.state("rgen") || {}).shown) SecFloat.show("rgen", false);
    paintBtn();
  }

  /* ---------------- Basic Settings ▸ GPU: the docker's toggle */
  function buildBtn() {
    var box = $("sec-gpu"); if (!box || !$("gpuWhere")) return false;
    if ($("gpuDock")) return true;
    var b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.id = "gpuDock"; b.style.cssText = "margin-top:4px;font-size:.72rem";
    b.title = "Show / hide the Remote generation docker: your pods, pod shortcuts and where the work runs";
    b.textContent = "☁ Remote generation docker";
    b.onclick = function () { show(); };
    box.appendChild(b);
    return true;
  }
  function paintBtn() {
    var b = $("gpuDock"); if (!b) return;
    var shown = !!(root.SecFloat && SecFloat.windows && SecFloat.windows.rgen && (SecFloat.state("rgen") || {}).shown);
    b.setAttribute("aria-pressed", shown ? "true" : "false");
    b.classList.toggle("on", shown);
  }

  /* ---------------- the docker */
  function body() {
    var d = doc.createElement("div"); d.className = "rgd"; d.id = "rgdBody";
    d.innerHTML = '<div class="rgdNow" id="rgdNow" aria-live="polite"></div>'
      // 2.758.0 (Tim: "can you remove this My pods ... Pod shortcuts ... from remote generation docker and add to pod's card in
      // pods docker"): your pods, their loading bars and the shortcuts (☆ on a template's card) live in the PODS docker
      + '<span class="hint" id="rgdMsg" aria-live="polite"></span>'
      + '<div class="rowbtns" style="margin-top:4px"><button type="button" class="ghost" id="rgdPodsDock" title="Your RunPod pods, the templates and the ★ shortcuts">🖥 PODS docker</button>'
      + '<button type="button" class="ghost" id="rgdSettings">⚙ Settings ▸ Remote generation</button></div>';
    return d;
  }
  function wire() {
    $("rgdPodsDock").onclick = function () { if (root.H3Pods && H3Pods.show) H3Pods.show(true); };
    $("rgdSettings").onclick = function () {
      var o = $("openSettings"); if (o && o.onclick) o.onclick();
      setTimeout(function () { var t = doc.querySelector('#settings .stabs [data-stab="rgpu"]'); if (t) t.click(); }, 60);
    };
    $("rgdBody").querySelectorAll("input").forEach(function (x) { x.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
  }
  function say(t, ok) { var m = $("rgdMsg"); if (m) { m.textContent = t || ""; m.style.color = ok === true ? "#7c7" : ok === false ? "#e66" : ""; } }
  function where(w) { return w === "remote" ? "Remote" : w === "both" ? "Both" : "Local"; }
  function paintNow() {
    var n = $("rgdNow"), g = S.g; if (!n || !g) return;
    n.innerHTML = "<div><b>Where the work runs:</b> " + esc(where(g.where)) + "</div>"
      + "<div><b>Remote GPU:</b> " + esc(g.remote ? g.remote.label : "none set up") + "</div>"
      + "<div><b>LLM:</b> " + esc(g.routes && g.routes.llm === "remote" ? (g.llm_label || "remote") : "this computer") + "</div>";
  }
  function load() {
    return Promise.all([getj("/api/remotegen"), getj("/api/gpusplit")]).then(function (a) {
      var x = a[0] || {}, g = a[1] || {};
      S.on = !!x.enabled; S.g = g;
      paintOn(); paintNow();
    }).catch(function () { /* offline */ });
  }
  function show(on) { if (!(root.SecFloat && SecFloat.show && SecFloat.windows && SecFloat.windows.rgen)) return false; var r = SecFloat.show("rgen", on); paintBtn(); return r; }

  function boot() {
    var ready = root.SecFloat && SecFloat.add && SecFloat.started;
    var sw = buildSwitch(), bt = buildBtn();
    if (!ready || !sw || !bt) { setTimeout(boot, 250); return; }
    if (!$("rgdCss")) { var st = doc.createElement("style"); st.id = "rgdCss"; st.textContent = CSS; doc.head.appendChild(st); }
    if (!$("rgdBody")) {
      SecFloat.add({ id: "rgen", title: "Remote generation", w: 460, h: 560, body: body(), onShow: function () { load(); } });
      wire();
    }
    load();
    doc.addEventListener("h3:rgpu", function () { load(); });
    var tb = doc.querySelector('#settings .stabs [data-stab="rgpu"]'); if (tb) tb.addEventListener("click", load);
    doc.addEventListener("click", function (e) { if (e.target && e.target.closest && e.target.closest(".df-x, .sf-x, [data-sfclose]")) setTimeout(paintBtn, 50); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RemoteDock = { load: load, show: show, setOn: setOn, state: function () { return S; } };
})(typeof window !== "undefined" ? window : globalThis);
