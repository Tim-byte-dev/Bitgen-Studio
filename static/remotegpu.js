/* bitGen Studio — static/remotegpu.js (2.520.0): Settings -> REMOTE GPU (window.H3RemoteGpu, lib/remoteGpu.js).
 * Tim (verbatim): "add a remote gpu tab in settings in case users can use a remote machine or runpod headless etc."
 *   Render with   ◉ This computer · ◉ Remote URL · ◉ RunPod · ◉ SSH tunnel - "Use it" switches the ComfyUI the app
 *                 renders with (the old one comes back with This computer)
 *   Remote URL    http(s)://host:port of a ComfyUI (another PC, a VPN / Tailscale address, a cloud proxy) + its $/hour
 *   RunPod        the API key, 🔄 your pods (GPU, $/hour, status) - pick one, ▶ start / ⏹ stop it; its ComfyUI port
 *   SSH tunnel    host, user, port, key file, the remote ComfyUI port, a local port - the app keeps ssh -N -L open
 *   RunPod Serverless (2.743.0, Tim: "can we try using a runpod serverless gpu?")  the API key (the same one) + the
 *                 endpoint ID + its $/hour; ✓ Test = RunPod's /health (workers ready / running, jobs waiting); each job
 *                 goes to the endpoint through lib/runpodServerless.js
 *                 2.744.0 (Tim: "if user is using runpod only show the styles that will work with runpod"): which
 *                 ComfyUI the endpoint's image carries (#rgSlsComfy), "it has node packs - show every style" (#rgSlsAll),
 *                 and how many styles it can render with the others and why (#rgSlsStyles) - static/rpstyles.js hides
 *                 them in the style lists. Use it / a save fire document "h3:rgpu".
 *   🧠 LLM on RunPod (2.745.0, Basic Settings ▸ GPU - lib/gpuSplit.js): a RunPod vLLM endpoint (RunPod's vLLM worker,
 *                 OpenAI-compatible) for the LLM, another (or the same) for the vision LLM, the served model names (blank =
 *                 asked of the endpoint), ✓ Test each. The three key boxes are one RunPod key (typing in one fills the
 *                 others).
 *   ✓ Test        the machine's GPU + VRAM + ComfyUI version (<url>/system_stats)
 */
(function (root) {
  "use strict";
  var S = { v: null, pods: [] };
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function post(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function say(id, t, ok) { var m = $(id); if (m) { m.textContent = t || ""; m.style.color = ok === true ? "#7c7" : ok === false ? "#e66" : ""; } }
  function load() { return fetch("/api/remotegpu").then(function (r) { return r.json(); }).then(function (v) { if (!v || !v.mode) return v; S.v = v; paint(); return v; }).catch(function () { /* offline */ }); }
  function build() {
    var h = $("stab-rgpu"); if (!h || $("rgMode")) return;
    h.innerHTML = '<label class="f">Render with</label>'
      + '<div id="rgMode" class="rowbtns" role="radiogroup" aria-label="Render with" style="margin-top:4px;align-items:center;flex-wrap:wrap">'
      + [["local", "This computer"], ["url", "Remote URL"], ["runpod", "RunPod pod"], ["serverless", "RunPod Serverless"], ["ssh", "SSH tunnel"]].map(function (m) {
        return '<label class="chk" style="margin:0 10px 0 0"><input type="radio" name="rgmode" value="' + m[0] + '"> ' + m[1] + "</label>"; }).join("")
      + '<span id="rgNow" class="hint" style="flex:1"></span></div>'
      // URL
      + '<div class="rgsec" data-rg="url"><label class="f" style="margin-top:12px">Remote ComfyUI</label>'
      + '<div class="rowbtns" style="align-items:center"><input type="text" id="rgUrl" spellcheck="false" placeholder="http://192.168.1.50:8188 or https://my-box.tailnet.ts.net:8188" style="flex:1">'
      + '<input type="number" id="rgCost" min="0" step="0.01" placeholder="$/h" title="What the machine costs per hour (0 = free) - the usage log adds it" style="width:80px;flex:none"><span class="hint" style="flex:none">$/hour</span></div></div>'
      // RunPod
      + '<div class="rgsec" data-rg="runpod"><label class="f" style="margin-top:12px">RunPod</label>'
      + '<div class="rowbtns" style="align-items:center"><input type="password" id="rgKey" spellcheck="false" autocomplete="off" placeholder="RunPod API key (runpod.io → Settings → API Keys)" style="flex:1">'
      + '<button type="button" class="ghost" id="rgPods" style="flex:none">🔄 My pods</button>'
      + '<input type="number" id="rgPort" min="1" max="65535" value="8188" title="ComfyUI\'s port on the pod (the template\'s HTTP port)" style="width:80px;flex:none"><span class="hint" style="flex:none">port</span></div>'
      + '<div id="rgPodList" style="margin-top:6px"></div></div>'
      // RunPod Serverless (2.743.0)
      + '<div class="rgsec" data-rg="serverless"><label class="f" style="margin-top:12px">RunPod Serverless</label>'
      + '<div class="rowbtns" style="align-items:center"><input type="password" id="rgSlsKey" spellcheck="false" autocomplete="off" placeholder="RunPod API key (runpod.io → Settings → API Keys)" style="flex:1"></div>'
      + '<div class="rowbtns" style="align-items:center;margin-top:4px"><input type="text" id="rgEndpoint" spellcheck="false" placeholder="endpoint ID (Serverless → your endpoint, e.g. abc123xyz)" style="flex:1">'
      + '<input type="number" id="rgSlsCost" min="0" step="0.01" placeholder="$/h" title="What a worker of the endpoint costs per hour of running (RunPod lists it per second - × 3600) - the usage log adds it" style="width:80px;flex:none"><span class="hint" style="flex:none">$/hour</span></div>'
      + '<div class="rowbtns" style="align-items:center;margin-top:6px;flex-wrap:wrap"><label class="f" for="rgSlsComfy" style="margin:0">ComfyUI in the endpoint\'s image</label>'
      + '<select id="rgSlsComfy" style="flex:1;min-width:220px"><option value="0.34.0">ComfyUI 0.34.0 - RunPod\'s worker image 5.10.0</option><option value="latest">A newer ComfyUI (an image you built)</option></select></div>'
      + '<label class="chk" style="margin-top:4px"><input type="checkbox" id="rgSlsAll"> My image has extra node packs - show every style</label>'
      + '<div id="rgSlsStyles" class="hint" aria-live="polite" style="margin-top:4px"></div>'
      + '<ul class="hint help" id="rgSlsHelp" style="margin:6px 0 0;padding-left:18px">'
      + '<li>No machine to start or stop: each render is one job, paid only while a worker runs it.</li>'
      + '<li>The first job after a quiet spell waits for a worker to start - a cold start can take minutes.</li>'
      + '<li>The endpoint runs RunPod\'s ComfyUI worker (worker-comfyui 5.x), with the models on a network volume (/runpod-volume/models/…, the same folders as ComfyUI\'s) and the custom nodes your styles use in its image.</li>'
      + '<li>Pictures, videos and songs all come back - videos and songs are saved through ComfyUI\'s own Save Video node on the way.</li>'
      + '<li>A job and its input files must be under 10 MB - long reference videos are better on a pod. There are no live steps while it runs.</li>'
      + '</ul></div>'
      // SSH
      + '<div class="rgsec" data-rg="ssh"><label class="f" style="margin-top:12px">SSH tunnel</label>'
      + '<div class="grid3" style="align-items:center;gap:6px"><input type="text" id="rgHost" placeholder="host (or IP)" spellcheck="false"><input type="text" id="rgUser" placeholder="user" spellcheck="false"><input type="number" id="rgSshPort" placeholder="22" min="1" max="65535">'
      + '<input type="text" id="rgKeyFile" placeholder="key file (optional) e.g. C:\\Users\\me\\.ssh\\id_ed25519" spellcheck="false" style="grid-column:1/3"><span></span>'
      + '<input type="number" id="rgRemotePort" placeholder="remote ComfyUI port 8188" min="1" max="65535"><input type="number" id="rgLocalPort" placeholder="local port 8189" min="1" max="65535"><span></span></div>'
      + '<div class="rowbtns" style="margin-top:4px;align-items:center"><button type="button" class="ghost" id="rgTunOn">▶ Open the tunnel</button><button type="button" class="ghost" id="rgTunOff">⏹ Close</button><span class="hint" id="rgTun" style="flex:1"></span></div></div>'
      // test + use
      + '<div class="rowbtns" style="margin-top:12px;align-items:center"><button type="button" class="ghost" id="rgTest">✓ Test</button><button type="button" id="rgUse">Use it</button>'
      + '<span id="rgMsg" class="hint" aria-live="polite" style="flex:1"></span></div>'
      + '<p class="hint help" style="margin-top:8px">The app sends the pictures and fetches the results over ComfyUI\'s own HTTP API, so every job renders on '
      + 'the remote machine the same way. Its <b>models must be on that machine</b> (the 🧩 Model manager shows this computer\'s folders). '
      + 'ComfyUI on this computer is not started while a remote one is in use. The power meters read this computer only: a remote job\'s cost is its '
      + 'time × the $/hour (RunPod: the pod\'s own price) in 📊 Usage. A RunPod pod needs a ComfyUI template with its port exposed over HTTP; '
      + 'for the LoRA trainer on a pod, ⤓ Export job and run it with ai-toolkit there. Keep a remote ComfyUI off the open internet - use a VPN, '
      + 'Tailscale or the SSH tunnel.</p>'
      // 2.745.0: the LLMs on RunPod (vLLM) - Basic Settings ▸ GPU says when they are used
      + '<div id="rgVllm" style="margin-top:14px;border-top:1px solid var(--line);padding-top:10px"><label class="f">🧠 LLM on RunPod (vLLM)</label>'
      + '<div class="rowbtns" style="align-items:center"><input type="password" id="rgVkey" spellcheck="false" autocomplete="off" placeholder="RunPod API key (the same key)" style="flex:1"></div>'
      + '<div class="rowbtns" style="align-items:center;margin-top:4px"><input type="text" id="rgVep" spellcheck="false" placeholder="LLM endpoint ID" style="flex:1">'
      + '<input type="text" id="rgVmodel" spellcheck="false" placeholder="model name (blank = ask the endpoint)" style="flex:1"><button type="button" class="ghost" id="rgVtest" style="flex:none">✓ Test</button></div>'
      + '<div class="rowbtns" style="align-items:center;margin-top:4px"><input type="text" id="rgVvep" spellcheck="false" placeholder="Vision LLM endpoint ID (blank = the LLM\'s)" style="flex:1">'
      + '<input type="text" id="rgVvmodel" spellcheck="false" placeholder="model name (blank = ask the endpoint)" style="flex:1"><button type="button" class="ghost" id="rgVvtest" style="flex:none">✓ Test</button></div>'
      + '<div id="rgVmsg" class="hint" aria-live="polite" style="margin-top:4px"></div>'
      + '<ul class="hint help" style="margin:6px 0 0;padding-left:18px">'
      + '<li>Make the endpoint on runpod.io: Serverless ▸ New Endpoint ▸ Deploy LLM API (RunPod\'s vLLM worker), with the Hugging Face model it should run.</li>'
      + '<li>The vision LLM must be a vision-language model (one that takes pictures, such as Qwen2.5-VL). One vision-language endpoint can serve both - leave the vision endpoint blank.</li>'
      + '<li>Basic Settings ▸ GPU decides when they are used: Remote, or Both with LLM / Vision LLM ticked.</li>'
      + '</ul></div>';
    h.querySelectorAll('input[name="rgmode"]').forEach(function (r) { r.onchange = function () { paintSecs(); }; });
    $("rgTest").onclick = test; $("rgUse").onclick = use;
    $("rgPods").onclick = pods;
    $("rgTunOn").onclick = function () { save().then(function () { return post("/api/remotegpu/tunnel", { on: true }); }).then(function (t) { S.v.tunnel = t; paintTun(); setTimeout(load, 3000); }); };
    $("rgTunOff").onclick = function () { post("/api/remotegpu/tunnel", { on: false }).then(function (t) { S.v.tunnel = t; paintTun(); }); };
    $("rgSlsComfy").addEventListener("change", save);   // 2.744.0
    // 2.745.0: one RunPod key in three boxes
    ["rgKey", "rgSlsKey", "rgVkey"].forEach(function (id) { $(id).addEventListener("input", function () { var v = $(id).value; ["rgKey", "rgSlsKey", "rgVkey"].forEach(function (o) { if (o !== id) $(o).value = v; }); }); });
    ["rgVep", "rgVmodel", "rgVvep", "rgVvmodel"].forEach(function (id) { $(id).addEventListener("change", saveVllm); });
    $("rgVtest").onclick = function () { testVllm("llm"); }; $("rgVvtest").onclick = function () { testVllm("vlm"); };
    h.querySelectorAll("input").forEach(function (el) { if (el.type !== "radio") el.addEventListener("change", save); el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
    var tb = document.querySelector('#settings .stabs [data-stab="rgpu"]'); if (tb) tb.addEventListener("click", load);
  }
  function mode() { var r = document.querySelector('input[name="rgmode"]:checked'); return r ? r.value : "local"; }
  function paintSecs() { var m = mode(); document.querySelectorAll("#stab-rgpu .rgsec").forEach(function (s) { s.style.display = s.dataset.rg === m ? "" : "none"; }); $("rgUse").textContent = m === "local" ? "Use this computer" : "Use it"; }
  function paintTun() { var t = (S.v && S.v.tunnel) || {}; $("rgTun").textContent = (t.state || "stopped") + (t.log && t.log.length ? " · " + t.log[t.log.length - 1] : ""); }
  function paint() {
    var v = S.v; if (!v || !$("rgMode")) return;
    var r = document.querySelector('input[name="rgmode"][value="' + v.mode + '"]'); if (r && !document.querySelector('input[name="rgmode"]:focus')) r.checked = true;
    $("rgNow").textContent = "now: " + v.current.label + (v.comfy_url ? " · " + v.comfy_url : "");
    $("rgUrl").value = v.url || ""; $("rgCost").value = v.cost_hr || "";
    $("rgKey").value = (v.runpod || {}).key || ""; $("rgPort").value = (v.runpod || {}).port || 8188;
    $("rgSlsKey").value = (v.runpod || {}).key || ""; $("rgEndpoint").value = (v.serverless || {}).endpoint || ""; $("rgSlsCost").value = (v.serverless || {}).cost_hr || "";
    $("rgSlsComfy").value = (v.serverless || {}).comfy || "0.34.0"; $("rgSlsAll").checked = !!(v.serverless || {}).show_all;
    $("rgVkey").value = (v.runpod || {}).key || "";
    loadVllm();
    paintStyles();
    var s = v.ssh || {}; $("rgHost").value = s.host || ""; $("rgUser").value = s.user || ""; $("rgSshPort").value = s.port || ""; $("rgKeyFile").value = s.key || "";
    $("rgRemotePort").value = s.remote_port || ""; $("rgLocalPort").value = s.local_port || "";
    paintSecs(); paintTun(); paintPods();
  }
  function save() {
    var key = $("rgKey").value;      // one RunPod key for pods, serverless and vLLM (the three boxes mirror each other)
    return post("/api/remotegpu/save", { url: $("rgUrl").value, cost_hr: $("rgCost").value,
      runpod: { key: key, port: +$("rgPort").value || 8188 },
      serverless: { endpoint: $("rgEndpoint").value, cost_hr: $("rgSlsCost").value, comfy: $("rgSlsComfy").value, show_all: $("rgSlsAll").checked },
      ssh: { host: $("rgHost").value, user: $("rgUser").value, port: +$("rgSshPort").value || 22, key: $("rgKeyFile").value, remote_port: +$("rgRemotePort").value || 8188, local_port: +$("rgLocalPort").value || 8189 } })
      .then(function (v) { if (!v.error) { S.v = v; changed(); } return v; });
  }
  /** 2.744.0: the style lists follow (static/rpstyles.js) and this tab says what the endpoint can render */
  /* 2.745.0: the vLLM endpoint(s) */
  function loadVllm() {
    fetch("/api/gpusplit").then(function (r) { return r.json(); }).then(function (g) {
      var x = (g && g.vllm) || {};
      [["rgVep", "endpoint"], ["rgVmodel", "model"], ["rgVvep", "vlm_endpoint"], ["rgVvmodel", "vlm_model"]].forEach(function (p) { if (document.activeElement !== $(p[0])) $(p[0]).value = x[p[1]] || ""; });
    }).catch(function () { /* offline */ });
  }
  function saveVllm() {
    return save().then(function () { return post("/api/gpusplit/vllm", { endpoint: $("rgVep").value, model: $("rgVmodel").value, vlm_endpoint: $("rgVvep").value, vlm_model: $("rgVvmodel").value }); })
      .then(function (g) { changed(); return g; });
  }
  function testVllm(kind) {
    say("rgVmsg", "asking RunPod…");
    saveVllm().then(function () { return post("/api/gpusplit/vllm/test", { kind: kind }); }).then(function (r) {
      say("rgVmsg", r.ok ? "✓ " + (kind === "vlm" ? "Vision LLM: " : "LLM: ") + r.model + " · " + r.line : "✗ " + r.error, !!r.ok);
    });
  }
  function changed() { try { document.dispatchEvent(new Event("h3:rgpu")); } catch (e) { /* fine */ } setTimeout(paintStyles, 400); }
  function paintStyles() {
    var box = $("rgSlsStyles"); if (!box) return;
    fetch("/api/remotegpu/serverless/styles").then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.styles) { box.textContent = ""; return; }
      var all = Object.keys(j.styles).map(function (k) { return j.styles[k]; }), no = all.filter(function (x) { return !x.ok; });
      box.innerHTML = "";
      var line = document.createElement("div");
      line.textContent = j.show_all ? "Every style shows - the endpoint's image has node packs the studio cannot see."
        : "This endpoint can render " + (all.length - no.length) + " of " + all.length + " styles; the style lists show only those while RunPod Serverless is in use.";
      box.appendChild(line);
      if (!no.length || j.show_all) return;
      var d = document.createElement("details"), sm = document.createElement("summary");
      sm.textContent = "The styles it cannot render, and why"; d.appendChild(sm);
      var ul = document.createElement("ul"); ul.style.cssText = "margin:4px 0 0;padding-left:18px";
      no.forEach(function (x) { var li = document.createElement("li"), b = document.createElement("b"); b.textContent = x.name; li.appendChild(b); li.appendChild(document.createTextNode(" (" + x.kind + ") - " + x.why)); ul.appendChild(li); });
      d.appendChild(ul); box.appendChild(d);
    }).catch(function () { /* offline */ });
  }
  function urlFor(m) {
    var v = S.v || {};
    if (m === "url") return $("rgUrl").value;
    if (m === "runpod") { var id = (v.runpod || {}).pod_id; return id ? "https://" + id + "-" + (+$("rgPort").value || 8188) + ".proxy.runpod.net" : ""; }
    if (m === "ssh") return "http://127.0.0.1:" + (+$("rgLocalPort").value || 8189);
    return v.mode === "local" && v.comfy_url ? v.comfy_url : "http://127.0.0.1:8188";
  }
  function test() {
    var m = mode(), u = urlFor(m);
    if (m === "serverless") {
      if (!$("rgEndpoint").value.trim()) { say("rgMsg", "the endpoint ID first", false); return; }
      say("rgMsg", "asking RunPod…");
      save().then(function () { return post("/api/remotegpu/serverless/test", {}); }).then(function (r) {
        say("rgMsg", r.ok ? "✓ " + r.line : "✗ " + r.error, !!r.ok);
      });
      return;
    }
    if (!u) { say("rgMsg", m === "runpod" ? "pick a pod first" : "the address first", false); return; }
    say("rgMsg", "asking " + u + "…");
    save().then(function () { return post("/api/remotegpu/test", { url: u }); }).then(function (r) {
      say("rgMsg", r.ok ? "✓ " + (r.devices || []).map(function (d) { return d.name + (d.vram_gb ? " " + d.vram_gb + " GB" : ""); }).join(", ") + (r.comfyui ? " · ComfyUI " + r.comfyui : "") : "✗ " + r.error, !!r.ok);
    });
  }
  function use() {
    var m = mode();
    save().then(function () { return post("/api/remotegpu/use", { mode: m }); }).then(function (v) {
      if (v.error) { say("rgMsg", v.error, false); return; }
      S.v = v; paint(); changed();
      try { if (typeof cfg !== "undefined" && cfg && cfg.engine && cfg.engine.comfy) { cfg.engine.comfy.url = v.comfy_url; } } catch (e) { /* fine */ }
      try { if ($("s_curl")) $("s_curl").value = v.comfy_url; } catch (e) { /* fine */ }   // 2.744.0: the ComfyUI tab shows the one in use
      say("rgMsg", m === "local" ? "✓ rendering on this computer again" : "✓ rendering with " + v.current.label + " - ✓ Test it", true);
    });
  }
  function pods() {
    say("rgMsg", "asking RunPod…");
    save().then(function () { return post("/api/remotegpu/pods", { key: $("rgKey").value, port: +$("rgPort").value || 8188 }); }).then(function (r) {
      if (r.error) { say("rgMsg", r.error, false); return; }
      S.pods = r.pods || []; say("rgMsg", S.pods.length + " pod(s)"); paintPods();
    });
  }
  function paintPods() {
    var box = $("rgPodList"); if (!box) return;
    var sel = ((S.v || {}).runpod || {}).pod_id;
    box.innerHTML = S.pods.length ? S.pods.map(function (p) {
      return '<div class="rowbtns" style="align-items:center;margin:2px 0"><label class="chk" style="margin:0;flex:1"><input type="radio" name="rgpod" value="' + esc(p.id) + '"' + (p.id === sel ? " checked" : "") + "> <b>" + esc(p.name) + "</b> · " + esc(p.gpu) + (p.gpus > 1 ? " x" + p.gpus : "")
        + " · $" + (+p.cost_hr || 0).toFixed(2) + "/h · " + esc(p.status) + "</label>"
        + '<button type="button" class="ghost" data-pod="' + esc(p.id) + '" data-act="start" style="flex:none">▶ start</button><button type="button" class="ghost" data-pod="' + esc(p.id) + '" data-act="stop" style="flex:none">⏹ stop</button></div>';
    }).join("") : (sel ? '<div class="hint">pod ' + esc(((S.v || {}).runpod || {}).pod_name || sel) + " - 🔄 My pods lists them</div>" : "");
    box.querySelectorAll('input[name="rgpod"]').forEach(function (r) { r.onchange = function () {
      var p = S.pods.find(function (x) { return x.id === r.value; }) || {};
      post("/api/remotegpu/save", { runpod: { pod_id: p.id, pod_name: p.name, cost_hr: p.cost_hr, port: +$("rgPort").value || 8188 } }).then(function (v) { S.v = v; say("rgMsg", "pod " + p.name + " picked - Use it"); });
    }; });
    box.querySelectorAll("[data-act]").forEach(function (b) { b.onclick = function () {
      post("/api/remotegpu/pod/" + encodeURIComponent(b.dataset.pod) + "/" + b.dataset.act).then(function (r) { say("rgMsg", r.error || (b.dataset.act === "start" ? "▶ starting - give it a minute, then ✓ Test" : "⏹ stopping"), r.error ? false : null); setTimeout(pods, 4000); });
    }; });
  }
  function start() {
    if (!$("stab-rgpu")) { setTimeout(start, 200); return; }
    build(); load();
  }
  root.H3RemoteGpu = { load: load, state: function () { return S; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
