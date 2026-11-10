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
 *     MY PODS    🔄 your RunPod pods (your API key) - ▶ start / ⏹ stop / Use it (pod + its ComfyUI port)
 *     SHORTCUTS  RunPod templates you add by pasting their link - Deploy ↗ opens RunPod's deploy page with the template
 *                and bitGen's referral code; Explore RunPod templates ↗; after deploying, 🔄 lists the new pod
 *     ⚙          Settings ▸ Remote generation
 *   Links open in the browser (target _blank - electron/main.js setWindowOpenHandler). */
(function (root) {
  "use strict";
  var doc = root.document, S = { on: null, g: null, pods: [], cuts: [], explore: "", msg: "", st: {}, watch: {} };
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
      + '<h4>My pods</h4>'
      + '<div class="rowbtns" style="align-items:center"><button type="button" class="ghost" id="rgdPods" title="Ask RunPod for your pods (your API key - Settings ▸ Remote generation)">🔄 My pods</button>'
      + '<span class="hint" id="rgdMsg" aria-live="polite" style="flex:1"></span></div>'
      + '<div id="rgdPodList"></div>'
      + '<h4>Pod shortcuts</h4>'
      + '<div class="hint">RunPod templates you deploy as your own pods. Paste a template\'s link from its page on RunPod, give it a name and add it. Deploy ↗ opens RunPod with it picked; then 🔄 My pods lists the new pod.</div>'
      + '<div id="rgdCuts"></div>'
      + '<div class="rgdAdd"><input type="text" id="rgdCutName" placeholder="Name, e.g. MiniMax H3 ComfyUI" spellcheck="false">'
      + '<input type="text" id="rgdCutLink" placeholder="The template\'s link (runpod.io/console/explore/…)" spellcheck="false">'
      + '<button type="button" class="ghost" id="rgdCutAdd">＋ Add</button></div>'
      + '<div><a class="rgdLink" id="rgdExplore" href="https://www.runpod.io/console/explore" target="_blank" rel="noopener">Explore RunPod templates ↗</a></div>'
      + '<div class="rowbtns" style="margin-top:4px"><button type="button" class="ghost" id="rgdSettings">⚙ Settings ▸ Remote generation</button></div>';
    return d;
  }
  function wire() {
    $("rgdPods").onclick = pods;
    $("rgdCutAdd").onclick = addCut;
    $("rgdCutLink").addEventListener("keydown", function (e) { if (e.key === "Enter") addCut(); });
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
  // 2.755.0 (Tim: "show loading pod, pod loaded, stopping pod"): a pod being started / stopped is watched (GET
  // /api/remotegpu/pod/:id - RunPod REST v2 + its ComfyUI answering) until it is loaded / stopped
  /** a pod's state, written into its .rgdSt (each case its own words - the UI translations read them) */
  function setSt(el, p) {
    var st = S.st[p.id], w = S.watch[p.id];
    if (w === "stop" && (!st || st.status !== "EXITED")) { el.textContent = "stopping pod…"; return; }
    if (w === "start" && (!st || st.status !== "RUNNING")) { el.textContent = "loading pod…"; return; }
    if (st && st.status === "RUNNING") {
      var sec = +st.uptime || 0, cost = (sec / 3600 * (+st.cost_hr || 0)).toFixed(2), m = Math.round(sec / 60), h = Math.floor(m / 60), mm = m % 60;
      if (!st.ready) { el.textContent = sec ? "loading pod… · running " + m + " min" : "loading pod…"; return; }
      if (!sec) { el.textContent = "pod loaded"; return; }
      if (m < 60) { el.textContent = "pod loaded · running " + m + " min · ≈ $" + cost; return; }
      el.textContent = "pod loaded · running " + h + " h " + mm + " min · ≈ $" + cost; return;
    }
    if (st) { el.textContent = st.word; return; }
    if (/RUNNING/.test(p.status)) { el.textContent = "running"; return; }
    if (/EXITED/.test(p.status)) { el.textContent = "stopped"; return; }
    el.textContent = String(p.status || "").toLowerCase();
  }
  function watch(id, want) { S.watch[id] = want; paintPods(); if (!S.ticking) tick(); }
  function tick() {
    var ids = Object.keys(S.watch); S.ticking = ids.length > 0; if (!ids.length) return;
    Promise.all(ids.map(function (id) {
      return getj("/api/remotegpu/pod/" + encodeURIComponent(id)).then(function (st) {
        if (!st || st.error) return;
        S.st[id] = st;
        var p = S.pods.find(function (x) { return x.id === id; }); if (p) p.status = st.status;
        if ((S.watch[id] === "start" && st.ready) || (S.watch[id] === "stop" && st.status === "EXITED")) {
          delete S.watch[id];
          var m = $("rgdMsg"), nm = st.name || "the pod";
          if (st.ready) { m.style.color = "#7c7"; m.textContent = "✓ " + nm + " - pod loaded"; }
          else { m.style.color = ""; m.textContent = "⏹ " + nm + " stopped - storage is still billed until you terminate it on RunPod"; }
        }
      }).catch(function () { /* next time */ });
    })).then(function () { paintPods(); if (Object.keys(S.watch).length) setTimeout(tick, +(root.H3_POD_POLL || 4000)); else S.ticking = false; });
  }
  function paintPods() {
    var box = $("rgdPodList"); if (!box) return;
    box.innerHTML = S.pods.map(function (p) {
      var up = /RUNNING|STARTING|PROVISIONING/.test(p.status) && S.watch[p.id] !== "stop";
      return '<div class="rgdRow" data-pod="' + esc(p.id) + '"><span class="nm"><b>' + esc(p.name) + "</b> · " + esc(p.gpu || "") + " · $" + (+p.cost_hr || 0).toFixed(2) + '/h · <span class="rgdSt"></span></span>'
        + '<button type="button" class="ghost" data-rgdpod="' + esc(p.id) + '" data-act="' + (up ? "stop" : "start") + '">' + (up ? "⏹ Stop" : "▶ Start") + "</button>"
        + '<button type="button" class="ghost" data-rgduse="' + esc(p.id) + '" title="Render on this pod (its ComfyUI)">Use it</button></div>';
    }).join("");
    box.querySelectorAll(".rgdRow[data-pod]").forEach(function (r) { var p = S.pods.find(function (x) { return x.id === r.dataset.pod; }); if (p) setSt(r.querySelector(".rgdSt"), p); });
    box.querySelectorAll("[data-rgdpod]").forEach(function (b) { b.onclick = function () {
      var id = b.dataset.rgdpod, act = b.dataset.act;
      delete S.st[id]; S.watch[id] = act; paintPods();
      post("/api/remotegpu/pod/" + encodeURIComponent(id) + "/" + act).then(function (r) {
        if (r.error) { delete S.watch[id]; say(r.error, false); paintPods(); return; }
        say(act === "start" ? "▶ loading pod - RunPod is starting it, then its ComfyUI" : "⏹ stopping pod…");
        if (!S.ticking) tick();                  // watched only once RunPod has the action
      });
    }; });
    box.querySelectorAll("[data-rgduse]").forEach(function (b) { b.onclick = function () {
      var p = S.pods.find(function (x) { return x.id === b.dataset.rgduse; }) || {};
      getj("/api/remotegpu").then(function (v) {
        var port = +((v.runpod || {}).port) || 8188;
        return post("/api/remotegpu/save", { runpod: { pod_id: p.id, pod_name: p.name, cost_hr: p.cost_hr, port: port } });
      }).then(function () { return post("/api/remotegpu/use", { mode: "runpod" }); }).then(function (v) {
        if (v.error) { say(v.error, false); return; }
        var m = $("rgdMsg"); m.style.color = "#7c7"; m.textContent = "✓ rendering on " + (p.name || "the pod"); changed(); load();
      });
    }; });
  }
  function pods() {
    say("asking RunPod…");
    return post("/api/remotegpu/pods", {}).then(function (r) {
      if (r.error) { say(/key/i.test(r.error) || /401|403|refused/i.test(r.error) ? "RunPod refused - your API key (an All key) goes in Settings ▸ Remote generation" : r.error, false); return; }
      S.pods = r.pods || []; paintPods();
      var m = $("rgdMsg"); m.style.color = ""; m.textContent = S.pods.length ? S.pods.length + " pod(s)" : "no pods yet - deploy one (a shortcut below, or on RunPod)";
    });
  }
  function paintCuts() {
    var box = $("rgdCuts"); if (!box) return;
    box.innerHTML = S.cuts.map(function (c) {
      return '<div class="rgdRow"><span class="nm"><a class="rgdLink" href="' + esc(c.page) + '" target="_blank" rel="noopener" title="The template\'s page on RunPod">' + esc(c.name) + "</a></span>"
        + '<a class="btn ghost rgdDeploy" href="' + esc(c.deploy) + '" target="_blank" rel="noopener" title="RunPod\'s deploy page with this template picked (bitGen\'s referral link)">Deploy ↗</a>'
        + '<button type="button" class="ghost" data-rgdcut="' + esc(c.id) + '" title="Remove this shortcut">✕</button></div>';
    }).join("") || '<div class="hint">No shortcuts yet.</div>';
    box.querySelectorAll("[data-rgdcut]").forEach(function (b) { b.onclick = function () { post("/api/remotegen/shortcuts", { remove: b.dataset.rgdcut }).then(function (r) { if (!r.error) { S.cuts = r.shortcuts; paintCuts(); } }); }; });
  }
  function addCut() {
    var name = $("rgdCutName").value, link = $("rgdCutLink").value;
    post("/api/remotegen/shortcuts", { add: { name: name, link: link } }).then(function (r) {
      if (r.error) { say(r.error, false); return; }
      S.cuts = r.shortcuts; paintCuts(); $("rgdCutName").value = ""; $("rgdCutLink").value = ""; say("✓ shortcut added", true);
    });
  }
  function load() {
    return Promise.all([getj("/api/remotegen"), getj("/api/gpusplit")]).then(function (a) {
      var x = a[0] || {}, g = a[1] || {};
      S.on = !!x.enabled; S.cuts = x.shortcuts || []; S.g = g;
      paintOn(); paintNow(); paintCuts();
    }).catch(function () { /* offline */ });
  }
  function show(on) { if (!(root.SecFloat && SecFloat.show && SecFloat.windows && SecFloat.windows.rgen)) return false; var r = SecFloat.show("rgen", on); paintBtn(); return r; }

  function boot() {
    var ready = root.SecFloat && SecFloat.add && SecFloat.started;
    var sw = buildSwitch(), bt = buildBtn();
    if (!ready || !sw || !bt) { setTimeout(boot, 250); return; }
    if (!$("rgdCss")) { var st = doc.createElement("style"); st.id = "rgdCss"; st.textContent = CSS; doc.head.appendChild(st); }
    if (!$("rgdBody")) {
      SecFloat.add({ id: "rgen", title: "Remote generation", w: 460, h: 560, body: body(), onShow: function () { load(); if (!S.pods.length) pods(); } });
      wire();
    }
    load();
    doc.addEventListener("h3:rgpu", function () { load(); });
    var tb = doc.querySelector('#settings .stabs [data-stab="rgpu"]'); if (tb) tb.addEventListener("click", load);
    doc.addEventListener("click", function (e) { if (e.target && e.target.closest && e.target.closest(".df-x, .sf-x, [data-sfclose]")) setTimeout(paintBtn, 50); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RemoteDock = { load: load, show: show, setOn: setOn, pods: pods, state: function () { return S; } };
})(typeof window !== "undefined" ? window : globalThis);
