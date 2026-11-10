/* bitGen Studio — static/podsdock.js (2.756.0): THE PODS DOCKER (window.H3Pods; lib/pods.js, routes/pods.js).
 * Tim (verbatim): "can we get the list of public pods from runpod in a docker called PODS(like model manager), button and
 * docker only visible when runpod pods are selected as the generation engine? the user can choose/create a pod"
 *   The button "🖥 PODS" sits in Basic Settings ▸ GPU and, like the docker, shows only when Use remote generation is on and
 *   the engine is RunPod ▸ Pods (Basic Settings ▸ GPU ▸ Remote servers).
 *   TEMPLATES   RunPod's public templates - Official / Verified / Community, a search, "ComfyUI only" (on); each: its page ↗
 *               and "Create pod…": the GPU (live price per hour + memory + availability on the cloud picked), Secure /
 *               Community cloud, how many GPUs, the container disk and /workspace's size, the price an hour -> Create pod
 *               (RunPod REST v2 POST /pods); the new pod then loads ("loading pod…" -> "pod loaded")
 *   MY PODS     every pod (🅱 = bitGen created or started it - those are the ones bitGen terminates when it exits, 2.757.0):
 *               ▶ Start / ⏹ Stop, Use it (render on it), Terminate (asks first: the pod and its files are deleted)
 *   Links open in the browser (target _blank). */
(function (root) {
  "use strict";
  var doc = root.document, S = { g: null, src: "official", comfy: true, q: "", tpl: [], gpus: {}, pods: [], st: {}, watch: {}, form: null, kill: null };
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function say(t, ok) { var m = $("pdMsg"); if (m) { m.textContent = t || ""; m.style.color = ok === true ? "#7c7" : ok === false ? "#e66" : ""; } }
  var CSS = ".pdk{display:flex;flex-direction:column;gap:6px;font-size:.76rem;height:100%;min-height:0;overflow:auto;padding:2px}"
    + ".pdk h4{margin:6px 0 2px;font-size:.72rem;color:var(--dim,#999);font-weight:600}"
    + ".pdk .pdTabs button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".pdk .pdRow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)}"
    + ".pdk .pdRow .nm{flex:1;min-width:150px}.pdk .pdRow .nm b{color:var(--text,#eee)}.pdk .pdRow .sub{display:block;color:var(--dim,#999);font-size:.68rem;word-break:break-all}"
    + ".pdk a.pdLink{color:var(--tiger,#f59e2c)}.pdk .pdForm{width:100%;border:1px solid var(--line,#3a342a);border-radius:7px;padding:6px 8px;margin:4px 0;background:var(--panel,#1b1814);display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center}"
    + ".pdk .pdForm .full{grid-column:1/3}.pdk .bg{font-size:.65rem;border:1px solid var(--tiger,#f59e2c);color:var(--tiger,#f59e2c);border-radius:4px;padding:0 3px}"
    + ".pdk .pdKill{width:100%;color:#e88}";

  /* ---------------- where it shows */
  function wanted() { var g = S.g || {}; return !!(g.enabled && g.engine && g.engine.pods); }
  function buildBtn() {
    var box = $("sec-gpu"); if (!box || !$("gpuWhere")) return false;
    if ($("gpuPods")) return true;
    var b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.id = "gpuPods"; b.style.cssText = "margin:4px 0 0 6px;font-size:.72rem;display:none";
    b.title = "Show / hide the PODS docker: RunPod's public templates, create a pod, your pods"; b.textContent = "🖥 PODS";
    b.onclick = function () { show(); };
    box.appendChild(b);
    return true;
  }
  function paintBtn() {
    var b = $("gpuPods"); if (!b) return;
    var on = wanted(), shown = !!(root.SecFloat && SecFloat.windows && SecFloat.windows.pods && (SecFloat.state("pods") || {}).shown);
    b.style.display = on ? "" : "none";
    b.setAttribute("aria-pressed", shown ? "true" : "false"); b.classList.toggle("on", shown);
    if (!on && shown) SecFloat.show("pods", false);
  }
  function loadG() { return getj("/api/gpusplit").then(function (g) { if (g && g.where) { S.g = g; paintBtn(); } return g; }).catch(function () { /* offline */ }); }

  /* ---------------- the docker */
  function body() {
    var d = doc.createElement("div"); d.className = "pdk"; d.id = "pdBody";
    d.innerHTML = '<div class="rowbtns pdTabs" style="align-items:center;flex-wrap:wrap">'
      + [["official", "Official"], ["verified", "Verified"], ["community", "Community"]].map(function (t) { return '<button type="button" class="ghost" data-pdsrc="' + t[0] + '">' + t[1] + "</button>"; }).join("")
      + '<input type="search" id="pdQ" placeholder="Search templates" spellcheck="false" style="flex:1;min-width:120px">'
      + '<label class="chk" style="margin:0" title="Only templates that run ComfyUI - the ones bitGen can render with"><input type="checkbox" id="pdComfy" checked> ComfyUI only</label>'
      + '<button type="button" class="ghost" id="pdRefresh" title="Ask RunPod again">🔄</button></div>'
      + '<div class="hint" id="pdMsg" aria-live="polite"></div>'
      + '<div class="pdList" id="pdTpl"></div>'
      + '<h4>My pods</h4><div id="pdPods"></div>'
      + '<div class="hint">🅱 = bitGen created or started it. Running pods cost money every hour; a stopped pod still pays for its storage until you terminate it.</div>';
    return d;
  }
  function wire() {
    $("pdBody").querySelectorAll("[data-pdsrc]").forEach(function (b) { b.onclick = function () { S.src = b.dataset.pdsrc; S.form = null; loadTpl(); }; });
    $("pdComfy").onchange = function () { S.comfy = $("pdComfy").checked; loadTpl(); };
    var t = null; $("pdQ").addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { S.q = $("pdQ").value; loadTpl(); }, 300); });
    $("pdRefresh").onclick = function () { loadTpl(true); loadPods(); };
    $("pdBody").querySelectorAll("input,select").forEach(function (x) { x.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
  }
  function loadTpl(refresh) {
    say("asking RunPod for its templates…");
    $("pdBody").querySelectorAll("[data-pdsrc]").forEach(function (b) { b.classList.toggle("on", b.dataset.pdsrc === S.src); });
    return getj("/api/pods/templates?source=" + S.src + (S.comfy ? "&comfy=1" : "") + (S.q ? "&q=" + encodeURIComponent(S.q) : "") + (refresh ? "&refresh=1" : "")).then(function (j) {
      if (j.error) { say(j.error, false); S.tpl = []; paintTpl(); return; }
      S.tpl = j.templates || []; paintTpl();
      var m = $("pdMsg"); m.style.color = ""; m.textContent = S.tpl.length + " of " + j.total + " templates";
    }).catch(function () { say("RunPod could not be reached", false); });
  }
  function paintTpl() {
    var box = $("pdTpl"); if (!box) return;
    box.innerHTML = S.tpl.map(function (t) {
      var f = S.form && S.form.id === t.id;
      return '<div class="pdRow" data-tpl="' + esc(t.id) + '"><span class="nm"><a class="pdLink" href="' + esc(t.page) + '" target="_blank" rel="noopener" title="Its page on RunPod">' + esc(t.name) + "</a>"
        + '<span class="sub">' + esc(t.image) + (t.ports.length ? " · " + esc(t.ports.join(", ")) : "") + "</span></span>"
        + '<button type="button" class="ghost" data-pdcreate="' + esc(t.id) + '">' + (f ? "✕ Close" : "Create pod…") + "</button>"
        + (f ? formHtml(t) : "") + "</div>";
    }).join("") || '<div class="hint">No templates here.</div>';
    box.querySelectorAll("[data-pdcreate]").forEach(function (b) { b.onclick = function () {
      var t = S.tpl.find(function (x) { return x.id === b.dataset.pdcreate; }); if (!t) return;
      S.form = S.form && S.form.id === t.id ? null : { id: t.id, port: t.port, cloud: "SECURE", disk: t.disk || 50 };
      paintTpl(); if (S.form) gpus(S.form.cloud);
    }; });
    if (S.form) wireForm();
  }
  function formHtml(t) {
    return '<div class="pdForm" id="pdForm"><label class="f" for="pdName" style="margin:0">Name</label><input type="text" id="pdName" value="' + esc(t.name.slice(0, 40)) + '" spellcheck="false">'
      + '<span class="f">Cloud</span><span><label class="chk" style="margin:0 10px 0 0" title="RunPod\'s own data centres"><input type="radio" name="pdCloud" value="SECURE" checked> Secure</label>'
      + '<label class="chk" style="margin:0" title="Machines run by RunPod\'s community hosts - usually cheaper"><input type="radio" name="pdCloud" value="COMMUNITY"> Community</label></span>'
      + '<label class="f" for="pdGpu" style="margin:0">GPU</label><select id="pdGpu"><option value="">asking RunPod…</option></select>'
      + '<label class="f" for="pdCount" style="margin:0">GPUs</label><input type="number" id="pdCount" min="1" max="8" value="1" style="width:70px">'
      + '<label class="f" for="pdDisk" style="margin:0">Container disk</label><span><input type="number" id="pdDisk" min="10" max="1000" value="' + (+t.disk || 50) + '" style="width:80px"> GB <span class="hint">(wiped when the pod stops)</span></span>'
      + '<label class="f" for="pdVol" style="margin:0">/workspace</label><span><input type="number" id="pdVol" min="10" max="2000" value="50" style="width:80px"> GB <span class="hint">(kept while stopped - billed for storage)</span></span>'
      + '<span class="full hint" id="pdPrice"></span>'
      + '<span class="full"><button type="button" id="pdGo">Create pod</button></span></div>';
  }
  function wireForm() {
    doc.querySelectorAll('input[name="pdCloud"]').forEach(function (r) { r.checked = r.value === S.form.cloud; r.onchange = function () { S.form.cloud = r.value; gpus(r.value); }; });
    ["pdGpu", "pdCount"].forEach(function (id) { $(id).addEventListener("change", price); });
    $("pdGo").onclick = create;
    $("pdForm").querySelectorAll("input,select").forEach(function (x) { x.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
  }
  function gpus(cloud) {
    var sel = $("pdGpu"); if (!sel) return;
    var fill = function (list) {
      sel.innerHTML = list.map(function (g) {
        return '<option value="' + esc(g.id) + '"' + (g.offered ? "" : " disabled") + ">" + esc(g.name) + " · " + g.memory + " GB · $" + g.price.toFixed(2) + "/h" + (g.offered ? (g.availability ? " · " + g.availability.toLowerCase() : "") : " · none free") + "</option>";
      }).join("") || '<option value="">no GPUs offered</option>';
      var first = list.find(function (g) { return g.offered && g.memory >= 20; }) || list.find(function (g) { return g.offered; });
      if (first) sel.value = first.id;
      price();
    };
    if (S.gpus[cloud]) { fill(S.gpus[cloud]); return; }
    getj("/api/pods/gpus?cloud=" + cloud).then(function (j) { if (j.error) { say(j.error, false); return; } S.gpus[cloud] = j.gpus || []; fill(S.gpus[cloud]); });
  }
  function price() {
    var el = $("pdPrice"), list = S.gpus[S.form && S.form.cloud] || [], g = list.find(function (x) { return x.id === ($("pdGpu") || {}).value; }), n = +(($("pdCount") || {}).value) || 1;
    if (el) el.textContent = g ? "About $" + (g.price * n).toFixed(2) + " an hour while it runs (RunPod's price now), plus storage" : "";
  }
  function create() {
    var b = { templateId: S.form.id, name: $("pdName").value, gpu: $("pdGpu").value, count: $("pdCount").value, cloud: S.form.cloud, disk: $("pdDisk").value, volume: $("pdVol").value, port: S.form.port };
    $("pdGo").disabled = true; say("creating the pod on RunPod…");
    post("/api/pods/create", b).then(function (r) {
      $("pdGo").disabled = false;
      if (r.error) { say(r.error, false); return; }
      say("✓ pod created - loading pod…", true); S.form = null; paintTpl();
      S.watch[r.pod.id] = "start"; S.port = S.port || {}; S.port[r.pod.id] = r.port;
      loadPods().then(tick);
    });
  }

  /* ---------------- my pods */
  function loadPods() {
    return getj("/api/pods/mine").then(function (j) { if (j.error) { $("pdPods").innerHTML = '<div class="hint">' + esc(j.error) + "</div>"; return; } S.pods = j.pods || []; paintPods(); }).catch(function () { /* offline */ });
  }
  function setSt(el, p) {
    var st = S.st[p.id], w = S.watch[p.id];
    if (w === "terminate") { el.textContent = "terminating…"; return; }
    if (w === "stop" && (!st || st.status !== "EXITED")) { el.textContent = "stopping pod…"; return; }
    if (w === "start" && (!st || st.status !== "RUNNING" || !st.ready)) { el.textContent = "loading pod…"; return; }
    if (st && st.status === "RUNNING") { el.textContent = st.ready ? "pod loaded" : "loading pod…"; return; }
    if (st) { el.textContent = st.word; return; }
    if (/RUNNING/.test(p.status)) { el.textContent = "running"; return; }
    if (/EXITED/.test(p.status)) { el.textContent = "stopped"; return; }
    el.textContent = String(p.status || "").toLowerCase();
  }
  function paintPods() {
    var box = $("pdPods"); if (!box) return;
    box.innerHTML = S.pods.map(function (p) {
      var up = /RUNNING|STARTING|PROVISIONING/.test(p.status) && S.watch[p.id] !== "stop";
      return '<div class="pdRow" data-pod="' + esc(p.id) + '"><span class="nm"><b>' + esc(p.name) + "</b> " + (p.bitgen ? '<span class="bg" title="bitGen created or started it">🅱</span> ' : "")
        + '<span class="sub">' + esc(p.gpu || "") + (p.gpus > 1 ? " ×" + p.gpus : "") + " · $" + (+p.cost_hr || 0).toFixed(2) + '/h · <span class="pdSt"></span></span></span>'
        + '<button type="button" class="ghost" data-pdact="' + (up ? "stop" : "start") + '">' + (up ? "⏹ Stop" : "▶ Start") + "</button>"
        + '<button type="button" class="ghost" data-pduse title="Render on this pod (its ComfyUI)">Use it</button>'
        + '<button type="button" class="ghost" data-pdkill title="Delete the pod and everything on it">Terminate</button>'
        + (S.kill === p.id ? '<div class="pdKill">Terminate <b>' + esc(p.name) + "</b>? The pod and every file on it (models, outputs) are deleted - only a network volume survives. "
          + '<button type="button" class="ghost" data-pdkillyes>Terminate</button> <button type="button" class="ghost" data-pdkillno>Cancel</button></div>' : "")
        + "</div>";
    }).join("") || '<div class="hint">No pods yet - create one from a template above.</div>';
    box.querySelectorAll(".pdRow[data-pod]").forEach(function (r) {
      var p = S.pods.find(function (x) { return x.id === r.dataset.pod; }); if (!p) return;
      setSt(r.querySelector(".pdSt"), p);
      var a = r.querySelector("[data-pdact]"); if (a) a.onclick = function () { act(p, a.dataset.pdact); };
      r.querySelector("[data-pduse]").onclick = function () { use(p); };
      r.querySelector("[data-pdkill]").onclick = function () { S.kill = S.kill === p.id ? null : p.id; paintPods(); };
      var y = r.querySelector("[data-pdkillyes]"); if (y) y.onclick = function () { S.kill = null; act(p, "terminate"); };
      var n = r.querySelector("[data-pdkillno]"); if (n) n.onclick = function () { S.kill = null; paintPods(); };
    });
  }
  function act(p, a) {
    delete S.st[p.id]; S.watch[p.id] = a; paintPods();
    post("/api/pods/" + encodeURIComponent(p.id) + "/" + a).then(function (r) {
      if (r.error) { delete S.watch[p.id]; say(r.error, false); paintPods(); return; }
      if (a === "terminate") { delete S.watch[p.id]; var m = $("pdMsg"); m.style.color = "#7c7"; m.textContent = "✓ " + p.name + " terminated - no more charges for it"; loadPods(); return; }
      say(a === "start" ? "▶ loading pod - RunPod is starting it, then its ComfyUI" : "⏹ stopping pod…");
      if (!S.ticking) tick();
    });
  }
  function tick() {
    var ids = Object.keys(S.watch).filter(function (id) { return S.watch[id] === "start" || S.watch[id] === "stop"; }); S.ticking = ids.length > 0; if (!ids.length) return;
    Promise.all(ids.map(function (id) {
      var pt = S.port && S.port[id];
      return getj("/api/remotegpu/pod/" + encodeURIComponent(id) + (pt ? "?port=" + pt : "")).then(function (st) {
        if (!st || st.error) return;
        S.st[id] = st;
        var p = S.pods.find(function (x) { return x.id === id; }); if (p) p.status = st.status;
        if ((S.watch[id] === "start" && st.ready) || (S.watch[id] === "stop" && st.status === "EXITED")) {
          delete S.watch[id];
          var m = $("pdMsg"), nm = st.name || "the pod";
          if (st.ready) { m.style.color = "#7c7"; m.textContent = "✓ " + nm + " - pod loaded"; }
          else { m.style.color = ""; m.textContent = "⏹ " + nm + " stopped - storage is still billed until you terminate it on RunPod"; }
        }
      }).catch(function () { /* next time */ });
    })).then(function () { paintPods(); if (Object.keys(S.watch).length) setTimeout(tick, +(root.H3_POD_POLL || 4000)); else S.ticking = false; });
  }
  function use(p) {
    var port = (S.port && S.port[p.id]) || 8188;
    post("/api/remotegpu/save", { runpod: { pod_id: p.id, pod_name: p.name, cost_hr: p.cost_hr, port: port } }).then(function () { return post("/api/remotegpu/use", { mode: "runpod" }); }).then(function (v) {
      if (v.error) { say(v.error, false); return; }
      var m = $("pdMsg"); m.style.color = "#7c7"; m.textContent = "✓ rendering on " + p.name;
      try { doc.dispatchEvent(new Event("h3:rgpu")); } catch (e) { /* fine */ }
    });
  }
  function show(on) { if (!(root.SecFloat && SecFloat.windows && SecFloat.windows.pods)) return false; var r = SecFloat.show("pods", on); paintBtn(); return r; }

  function boot() {
    if (!(root.SecFloat && SecFloat.add && SecFloat.started) || !buildBtn()) { setTimeout(boot, 250); return; }
    if (!$("pdCss")) { var st = doc.createElement("style"); st.id = "pdCss"; st.textContent = CSS; doc.head.appendChild(st); }
    if (!$("pdBody")) {
      SecFloat.add({ id: "pods", title: "PODS", w: 560, h: 640, body: body(), onShow: function () { loadTpl(); loadPods(); } });
      wire();
    }
    loadG();
    doc.addEventListener("h3:rgpu", loadG);
    doc.addEventListener("change", function (e) { if (e.target && /^(gpuProv|gpuRunpod|gpuWhere)$/.test(e.target.name || "")) setTimeout(loadG, 500); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3Pods = { show: show, load: function () { loadG(); loadTpl(); loadPods(); }, state: function () { return S; } };
})(typeof window !== "undefined" ? window : globalThis);
