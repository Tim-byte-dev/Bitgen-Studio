/* bitGen Studio — static/podsdock.js (2.756.0): THE PODS DOCKER (window.H3Pods; lib/pods.js, routes/pods.js).
 * Tim (verbatim): "can we get the list of public pods from runpod in a docker called PODS(like model manager), button and
 * docker only visible when runpod pods are selected as the generation engine? the user can choose/create a pod"
 *   The button "🖥 PODS" sits in Basic Settings ▸ GPU and, like the docker, shows only when Use remote generation is on and
 *   the engine is RunPod ▸ Pods (Basic Settings ▸ GPU ▸ Remote servers).
 *   TEMPLATES   RunPod's public templates - Official / Verified / Community, a search, "ComfyUI only" (on); each: its page ↗
 *   2.756.1 (Tim: "list all them templates filter them by search, have a card for each of them like comfyui does. now it says
 *               0 of 100 templates" - ComfyUI only was on, and none of the 100 Official ones run ComfyUI): ALL the templates
 *               at once (All = Official + Verified + Community, each with its count), a card each (a coloured tile with the
 *               template's initials, its kind NVIDIA / AMD / CPU, a ComfyUI badge; name, image, where it is from, disk,
 *               /workspace, its web ports; Create pod… + ↗ its page), searched as you type (every word: name, image, port,
 *               kind, source), a kind filter, ComfyUI only OFF by default. RunPod's API gives no pictures or descriptions
 *               for templates, so the tile is drawn here. Create pod… opens the form above the cards.
 *               and "Create pod…": the GPU (live price per hour + memory + availability on the cloud picked), Secure /
 *               Community cloud, how many GPUs, the container disk and /workspace's size, the price an hour -> Create pod
 *               (RunPod REST v2 POST /pods); the new pod then loads ("loading pod…" -> "pod loaded")
 *   MY PODS     every pod (🅱 = bitGen created or started it - those are the ones bitGen terminates when it exits, 2.757.0):
 *               ▶ Start / ⏹ Stop, Use it (render on it), Terminate (asks first: the pod and its files are deleted)
 *   Links open in the browser (target _blank).
 *   2.780.0 (Tim: "we drop the template browser completely"): THE TEMPLATE PARTS BELOW ARE GONE - no template cards, search,
 *               kind, ComfyUI only, For style or ★ Shortcuts. ＋ Create pod makes a bitGen pod from the one template bitGen picks
 *               (lib/pods.js bitgenTemplate); 🖥 My pods lists bitGen's pods, the account's others in one line under them.
 *   2.760.0 (Tim: "in pods docker add a button for my pods (only show my pods when this is clicked), when creating a pod hide
 *               all the templates, after the pod is created only show my pods"): 🖥 My pods (its count) beside the template
 *               tabs shows the pods alone (no templates, no search); the template tabs show the templates alone; Create pod…
 *               hides the cards and their filters (the form alone - ✕ Close or a tab goes back); a pod created -> My pods.
 *               The prices show in Settings ▸ General ▸ Currency (static/currency.js H3Money). */
(function (root) {
  "use strict";
  var doc = root.document, S = { stats: {}, g: null, src: "mine", tplB: null, tplErr: "", gpus: {}, pods: [], st: {}, watch: {}, form: null, kill: null, cuts: [], styles: [], forStyle: "", act: {}, actOpen: {} };
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
    + ".pdk .pdKill{width:100%;color:#e88}"
    + ".pdk .pdTabs .n{opacity:.65;margin-left:4px;font-size:.66rem}"
    + ".pdk .pdNew{border:1px solid var(--tiger,#f59e2c);border-radius:8px;padding:6px 8px;background:var(--panel,#1b1814)}.pdk .pdNew .pdForm{border:0;padding:4px 0 0;margin:0;background:none}"
    // 2.760.0 / 2.780.0: three views, one at a time - 🖥 My pods, 📦 Presets, ＋ Create pod (the form alone)
    + ".pdk:not(.pdMine) #pdMineBox{display:none}.pdk:not(.pdMaking) #pdCreate{display:none}.pdk:not(.pdPre) #pdPresetBox{display:none}"
    + ".pdk .pdOthers{margin:6px 0 0;font-size:.74rem}.pdk .pdOthers summary{cursor:pointer;color:var(--dim,#999)}.pdk .pdOthers .pdRow{opacity:.85}"
    // 2.761.0: My pods as an accordion (static/podsetup.js inside)
    + ".pdk .pdTop{display:flex;align-items:flex-start}.pdk .pdSel{flex:none;margin:9px 0 0 8px;width:auto}.pdk .pdAcc{display:block;padding:0;border:1px solid var(--line,#3a342a);border-radius:7px;margin:0 0 6px;background:var(--panel,#1b1814)}"
    + ".pdk .pdAcc.open{border-color:var(--tiger,#f59e2c)}"
    + ".pdk .pdHead{display:flex;gap:8px;align-items:flex-start;width:100%;text-align:left;background:none;border:0;padding:6px 8px;color:inherit;cursor:pointer;font:inherit}"
    + ".pdk .pdHead .ar{color:var(--tiger,#f59e2c);width:1em;flex:none}.pdk .pdHead .nm{flex:1;min-width:0}"
    + ".pdk .pdBodyIn{padding:2px 10px 8px 26px;display:flex;flex-direction:column;gap:6px}"
    // 2.772.0: a closed pod item really is closed (its display:flex had overridden the hidden attribute - every pod showed its body)
    + ".pdk .pdBodyIn[hidden]{display:none}"
    + ".pdk .psKinds,.pdk .psTools,.pdk .pdActs,.pdk .psLlm,.pdk .psNf{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}"
    + ".pdk .psKinds .chk{margin:0}.pdk .psTools [data-pssave]{margin-left:auto}.pdk .psTools [data-pssave]:disabled{opacity:.45}"
    + ".pdk .psInto select{width:auto;max-width:200px}"
    // 2.763.0: the pod's styles - a dropdown of yours (the Generate mode's, or All) + chips
    + ".pdk .psStyles{display:flex;flex-direction:column;gap:4px}.pdk .psStyles .f{margin:4px 0 0}.pdk .psPick{display:flex;gap:6px;align-items:center}.pdk .psPick select{flex:1;min-width:0;width:auto}"
    + ".pdk .psPick [data-psall].on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".pdk .psChips{display:flex;flex-wrap:wrap;gap:4px 6px}.pdk .psChip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line,#333);border-radius:12px;padding:1px 4px 1px 9px;font-size:12px}"
    + ".pdk .psChip button{padding:0 5px;line-height:1.2}"
    + ".pdk .psTools .psPrep{flex:1}"
    // 2.763.3: the waiting render's banner + the form's style / kind
    + ".pdk .pdAsk{border:1px solid var(--tiger,#f59e2c);border-radius:8px;padding:8px 10px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}.pdk .pdAsk[hidden]{display:none}.pdk .pdAsk .t{flex:1;min-width:220px}"
    + ".pdk .pdForm .pdKinds{display:flex;flex-wrap:wrap;gap:4px 12px}"
    // 2.763.4: the pod's load / memory / disks as bars; the summary before Create pod
    + ".pdk .pdStats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px 8px;margin:2px 0}.pdk .pdStatsHead{display:inline-flex;gap:6px;margin-left:6px;vertical-align:middle}"
    + ".pdk .pdBar{position:relative;display:block;height:16px;border-radius:4px;background:var(--panel-2,#26262c);overflow:hidden;font-size:11px;line-height:16px}"
    + ".pdk .pdBar i{position:absolute;left:0;top:0;bottom:0;background:var(--tiger,#f59e2c);opacity:.55}.pdk .pdBar.hi i{background:#e66;opacity:.7}"
    + ".pdk .pdBar b{position:relative;padding:0 6px;font-weight:normal;white-space:nowrap}.pdk .pdStatsHead .pdBar{width:92px;height:12px;line-height:12px;font-size:10px}"
    + ".pdk .pdSum{border:1px solid var(--line,#333);border-radius:6px;padding:6px 10px;display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:12px}.pdk .pdSum .k{color:var(--dim,#999)}"
    // 2.772.0: what the pod is doing now (its verb + what) and the finished tasks in a dropdown under it
    + ".pdk .pdDoing{margin:0 8px 6px 30px;font-size:12px;display:flex;flex-direction:column;gap:3px}.pdk .pdDoing:empty{display:none}"
    + ".pdk .pdNow{display:flex;gap:6px;align-items:baseline;min-width:0}.pdk .pdNow .ic{flex:none;width:1.3em;text-align:center}.pdk .pdNow .vb{flex:none;color:var(--tiger,#f59e2c);font-weight:600}"
    + ".pdk .pdNow .tx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pdk .pdNow .tm{flex:none;color:var(--dim,#999);font-variant-numeric:tabular-nums}"
    + ".pdk .pdNow.run .ic{animation:pdPulse 1.4s ease-in-out infinite}@keyframes pdPulse{50%{opacity:.35}}"
    + ".pdk .pdNow.ok .vb{color:#7c7}.pdk .pdNow.bad .vb{color:#e66}.pdk .pdNow.bad .tx{white-space:normal}"
    + ".pdk .pdDone summary{cursor:pointer;color:var(--dim,#999);list-style:none;width:max-content}.pdk .pdDone summary::-webkit-details-marker{display:none}.pdk .pdDone summary:before{content:'▸ ';color:var(--tiger,#f59e2c)}.pdk .pdDone[open] summary:before{content:'▾ '}"
    + ".pdk .pdDone ol{list-style:none;margin:3px 0 0;padding:0 0 0 14px;max-height:180px;overflow:auto;display:flex;flex-direction:column;gap:1px}"
    + ".pdk .pdDone li{display:flex;gap:6px;align-items:baseline}.pdk .pdDone li .tx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pdk .pdDone li .tm{flex:none;color:var(--dim,#999)}"
    + ".pdk .pdDone li.skipped{opacity:.6}.pdk .pdDone li.failed .st{color:#e66}.pdk .pdDone li .st{flex:none;width:1em;color:#7c7}";

  /* ---------------- where it shows */
  function wanted() { var g = S.g || {}; return !!(g.enabled && g.engine && g.engine.pods); }
  function buildBtn() {
    var box = $("sec-gpu"); if (!box || !$("gpuWhere")) return false;
    if ($("gpuPods")) return true;
    var b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.id = "gpuPods"; b.style.cssText = "margin:4px 0 0 6px;font-size:.72rem;display:none";
    b.title = "Show / hide the PODS docker: RunPod's public templates, create a pod, your pods"; b.textContent = "🖥 PODS";
    b.onclick = function () { show(); };
    ($("gpuOptBtns") || box).appendChild(b);   // 2.768.0: with the remote options (the ☁ Remote generation docker)
    // 2.761.0's 💲 line (what the pods cost) moved to the 💲 RunPod docker in 2.763.5 (static/runpoddock.js)
    return true;
  }
  /** 2.761.0: what each pod cost (RunPod's bill, once a minute while RunPod ▸ Pods is on) - for the pod rows' figures.
   *  2.763.5 (Tim: "move runpod balance and usage costs from the basic settings docker to the runpod docker"): no 💲 line in
   *  Basic Settings any more - the 💲 RunPod docker (static/runpoddock.js) shows the bill, the balance and the GPU prices */
  function costLine() {
    if (!wanted()) return;
    getj("/api/pods/costs").then(function (j) {
      if (!j) return;
      S.cost = j;
      if ($("pdPods") && S.pods.length) paintPods();
    }).catch(function () { /* offline */ });
  }
  function paintBtn() {
    var b = $("gpuPods"); if (!b) return;
    var on = wanted(), shown = !!(root.SecFloat && SecFloat.windows && SecFloat.windows.pods && (SecFloat.state("pods") || {}).shown);
    b.style.display = on ? "" : "none";
    b.setAttribute("aria-pressed", shown ? "true" : "false"); b.classList.toggle("on", shown);
    // 2.760.0: it closes when RunPod ▸ Pods is turned OFF - not when Remote generation's 🖥 PODS docker button opens it on another engine
    if (!on && shown && S.wanted0) SecFloat.show("pods", false);
    if (S.g) S.wanted0 = on;
  }
  function loadG() { return getj("/api/gpusplit").then(function (g) { if (g && g.where) { S.g = g; paintBtn(); } return g; }).catch(function () { /* offline */ }); }

  /* ---------------- the docker */
  /* 2.780.0 (Tim: "i think with using our clean pod template and uploading others we don't need to show any other pods except
     for our pods" … "i think we drop the template browser completely. it will make it less complicated"): no RunPod template
     browser (All / Official / Verified / Community / ★ Shortcuts, the search, the kind, ComfyUI only, For style) - a pod is a
     bitGen pod, made from the one template bitGen picks (RunPod's PyTorch one; bitGen installs ComfyUI, the nodes and the files -
     GET /api/pods/bitgen-template, lib/pods.js bitgenTemplate). Tabs: 🖥 My pods (bitGen's pods; the others on the account in
     one line), 📦 Presets, ＋ Create pod. */
  function body() {
    var d = doc.createElement("div"); d.className = "pdk"; d.id = "pdBody";
    d.innerHTML = '<div class="rowbtns pdTabs" style="align-items:center;flex-wrap:wrap">'
      + [["mine", "🖥 My pods"], ["presets", "📦 Presets"], ["create", "＋ Create pod"]].map(function (t) { return '<button type="button" class="ghost" data-pdsrc="' + t[0] + '">' + t[1] + '<span class="n"></span></button>'; }).join("")
      + '<span style="flex:1"></span><button type="button" class="ghost" id="pdRefresh" title="Ask RunPod again">🔄</button>'
      + '<button type="button" class="ghost" id="pdRpDock" title="The 💲 Costs docker on RunPod\'s list: your balance, what your pods cost, RunPod\'s GPU prices (← All costs: this computer and every platform)">💲 Costs</button></div>'
      + '<div id="pdAsk" class="pdAsk" hidden></div>'   // 2.763.3: a render waiting for a pod
      + '<div class="hint" id="pdMsg" aria-live="polite"></div>'
      + '<div id="pdXfer" hidden></div>'   // 2.766.0: a progress bar for each transfer to a pod (static/podxfer.js)
      + '<div id="pdCreate"></div>'
      + '<div id="pdMineBox"><div id="pdPods"></div><div id="pdOthers"></div><div id="pdStyPanel"></div>'
      + '<div class="hint">🅱 = bitGen made or started it. Running pods cost money every hour; a stopped pod still pays for its storage until you terminate it.</div></div>'
      + '<div id="pdPresetBox"></div>';   // 2.764.0: 📦 Presets (static/podpresets.js)
    return d;
  }
  function wire() {
    if (root.H3PodXfer) H3PodXfer.mount($("pdXfer"));   // 2.766.0
    getj("/api/pods/selected").then(function (j) { S.selPods = (j && j.selected) || []; if ($("pdPods") && S.pods && S.pods.length) paintPods(); }).catch(function () { S.selPods = []; });
    $("pdRpDock").onclick = function () { if (root.H3RunPod) H3RunPod.show(true, "runpod"); };   // 2.763.5; 2.771.0: the 💲 Costs docker on RunPod's list
    $("pdBody").querySelectorAll("[data-pdsrc]").forEach(function (b) { b.onclick = function () { go(b.dataset.pdsrc); }; });
    $("pdRefresh").onclick = function () { loadTpl(true); loadPods(); };
  }
  /** 2.760.0: a tab - 🖥 My pods, 📦 Presets or ＋ Create pod (2.780.0: the form alone) */
  function go(src, pre) {
    S.src = src;
    if (src === "create") openForm(pre); else if (S.form) { S.form = null; var c = $("pdCreate"); if (c) c.dataset.tpl = ""; paintForm(); }
    filter();
    // 2.764.0 (Tim: "in pods docker add a presets tab"): 📦 Presets - static/podpresets.js paints it
    if (root.H3PodPresets) { if (src === "presets") H3PodPresets.show($("pdPresetBox")).then(function () { filter(); }); else H3PodPresets.hide(); }
  }
  /** 2.760.0: the docker's view - 🖥 My pods, 📦 Presets or the Create pod form, one at a time */
  function view() {
    var b = $("pdBody"); if (!b) return;
    b.classList.toggle("pdMine", S.src === "mine");
    b.classList.toggle("pdPre", S.src === "presets");   // 2.764.0
    b.classList.toggle("pdMaking", S.src === "create");
  }
  function money(v, sfx) { return root.H3Money ? root.H3Money.usd(v, sfx) : "$" + (+v || 0).toFixed(2) + (sfx || ""); }
  function moneyHtml(v, sfx) { return root.H3Money ? root.H3Money.usdHtml(v, sfx) : esc(money(v, sfx)); }
  /** 2.780.0: the one template a bitGen pod is made from (the server picks it) */
  function loadTpl(refresh) {
    return getj("/api/pods/bitgen-template" + (refresh ? "?refresh=1" : "")).then(function (j) {
      S.tplB = j && !j.error ? j : null; S.tplErr = j && j.error ? j.error : "";
      if (S.form) { var c = $("pdCreate"); if (c) c.dataset.tpl = ""; paintForm(); }
    }).catch(function () { S.tplB = null; S.tplErr = "RunPod could not be reached"; });
  }
  /** 2.763.4 (Tim: "put the style in the dropdown as the selected style in the prompt docker"): the style picked for the
      Generate mode (🖼 Image -> #styleSel, 🎬 Video -> #videoStyleSel, 🎶 Music -> #musicSel) */
  function promptStyle() {
    var g = $("genModeSel"), m = g ? g.value : "image";
    var sel = $(m === "video" ? "videoStyleSel" : m === "audio" ? "musicSel" : "styleSel");
    return sel && sel.value ? sel.value : "";
  }
  function loadStyles() {
    return Promise.all([getj("/api/styles?kind=image"), getj("/api/styles?kind=video"), getj("/api/styles?kind=music")]).then(function (a) {
      S.styles = [].concat((a[0] || {}).styles || [], (a[1] || {}).styles || [], (a[2] || {}).styles || []).filter(function (x) { return x.runs_on !== "api" && x.runs_on !== "remote"; });
      if (S.form && $("pdStyle") && !$("pdStyle").options.length) { var c = $("pdCreate"); if (c) c.dataset.tpl = ""; paintForm(); }
    }).catch(function () { /* offline */ });
  }
  /** 2.780.0: My pods = bitGen's pods (made or started by bitGen); the account's others are one line under them (pure) */
  function split(pods) {
    var mine = [], other = [];
    (pods || []).forEach(function (p) { (p.bitgen ? mine : other).push(p); });
    return { mine: mine, other: other, otherHr: other.filter(function (p) { return /RUNNING/.test(p.status); }).reduce(function (a, p) { return a + (+p.cost_hr || 0); }, 0) };
  }
  function filter() {
    var sp = split(S.pods);
    $("pdBody").querySelectorAll("[data-pdsrc]").forEach(function (b) {
      var k = b.dataset.pdsrc, n = k === "presets" ? (root.H3PodPresets ? H3PodPresets.count() : 0) : k === "mine" ? sp.mine.length : "";
      b.classList.toggle("on", k === S.src); b.querySelector(".n").textContent = String(n);
    });
    view();
    var m = $("pdMsg"); if (!m) return;
    m.style.color = "";
    if (S.src === "mine") { m.textContent = sp.mine.length + " bitGen pod" + (sp.mine.length === 1 ? "" : "s"); return; }
    m.textContent = "";
  }
  function openForm(pre) {
    S.form = Object.assign({ cloud: "SECURE", disk: (S.tplB && S.tplB.disk) || 50, style: promptStyle(), kinds: [] }, pre || {});
    var cc = $("pdCreate"); if (cc) cc.dataset.tpl = "";
    paintForm(); view();
    gpus(S.form.cloud);
    if (!S.tplB) loadTpl();
  }
  function paintForm() {
    var c = $("pdCreate"); if (!c) return;
    if (!S.form) { c.innerHTML = ""; c.dataset.tpl = ""; return; }
    var t = S.tplB || { name: "", image: "", disk: 50, ports: [] }, key = t.id || "-";
    if ($("pdForm") && c.dataset.tpl === key) return;
    var keepG = $("pdGpu") && $("pdGpu").value; if (keepG) S.form.gpu = keepG;   // a repaint keeps the GPU picked
    c.dataset.tpl = key;
    // 2.780.0: the bitGen pod - what it is made from is one line (no template to pick)
    c.innerHTML = '<div class="pdNew"><div class="rowbtns" style="align-items:center"><span style="flex:1">Create a <b>bitGen pod</b></span></div>'
      + '<div class="hint" id="pdTplLine" style="margin:0 0 4px">' + (S.tplB ? "Made from RunPod's " + esc(t.name) + (t.install ? " - bitGen installs ComfyUI, the custom nodes your styles use and their files on it (a few minutes the first time, then kept in /workspace)" : " - its ComfyUI is updated and your styles made ready on it") : S.tplErr ? '<span style="color:#e66">' + esc(S.tplErr) + "</span>" : "asking RunPod which template to use…") + "</div>"
      + formHtml(t) + "</div>";
    wireForm();
    gpus(S.form.cloud);
  }
  function formHtml(t) {
    return '<div class="pdForm" id="pdForm"><label class="f" for="pdName" style="margin:0">Name</label><input type="text" id="pdName" value="' + esc(((S.form && S.form.name) || "bitGen pod").slice(0, 40)) + '" spellcheck="false">'
      + '<span class="f">Cloud</span><span><label class="chk" style="margin:0 10px 0 0" title="RunPod\'s own data centres"><input type="radio" name="pdCloud" value="SECURE" checked> Secure</label>'
      + '<label class="chk" style="margin:0" title="Machines run by RunPod\'s community hosts - usually cheaper"><input type="radio" name="pdCloud" value="COMMUNITY"> Community</label></span>'
      + '<label class="f" for="pdGpu" style="margin:0">GPU</label><select id="pdGpu"><option value="">asking RunPod…</option></select>'
      + '<label class="f" for="pdCount" style="margin:0">GPUs</label><input type="number" id="pdCount" min="1" max="8" value="' + ((S.form && S.form.count) || 1) + '" style="width:70px">'
      // 2.763.3 (Tim: "auto select the type and style"): the style it renders + the kinds of style it is the pod for
      + '<label class="f" for="pdStyle" style="margin:0">Style</label><select id="pdStyle" title="The style that renders on this pod (linked to it)"><option value="">— none —</option>'
      + (S.styles || []).map(function (x) { return '<option value="' + esc(x.id) + '"' + (S.form && S.form.style === x.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select>"
      + '<span class="f">For</span><span class="pdKinds" title="This pod renders every style of the kinds ticked that has no pod of its own - one pod per kind">'
      + [["image", "Image"], ["image_edit", "Image edit"], ["video", "Video"]].map(function (k) { return '<label class="chk" style="margin:0"><input type="checkbox" data-pdkind="' + k[0] + '"' + (S.form && (S.form.kinds || []).indexOf(k[0]) >= 0 ? " checked" : "") + "> " + k[1] + "</label>"; }).join("") + "</span>"
      // 2.775.0 (Tim: "when we create the pod can we have a button for tts, stt and demacus(sheet music)"): the audio engines
      // installed on the pod (lib/podAudio.js) - in remote mode these jobs then run there instead of this computer
      + '<span class="f">Audio</span><span class="pdKinds" title="Installed on the pod - in remote mode these jobs run there instead of on this computer">'
      + AUDIO.map(function (k) { return '<label class="chk" style="margin:0" title="' + esc(k[2]) + '"><input type="checkbox" data-pdaudio="' + k[0] + '"' + (S.form && (S.form.audio || []).indexOf(k[0]) >= 0 ? " checked" : "") + "> " + k[1] + "</label>"; }).join("") + "</span>"
      + '<label class="f" for="pdDisk" style="margin:0">Container disk</label><span><input type="number" id="pdDisk" min="10" max="1000" value="' + ((S.form && +S.form.disk) || +t.disk || 50) + '" style="width:80px"> GB <span class="hint">(wiped when the pod stops)</span></span>'
      + '<label class="f" for="pdVol" style="margin:0">/workspace</label><span><input type="number" id="pdVol" min="10" max="2000" value="' + ((S.form && S.form.volume) || 50) + '" style="width:80px"> GB <span class="hint">(kept while stopped - billed for storage)</span></span>'
      + '<span class="full hint" id="pdPrice"></span>'
      + '<div class="full pdSum" id="pdSum" aria-live="polite"></div>'
      + '<span class="full"><button type="button" id="pdGo">Create pod</button></span></div>';
  }
  function wireForm() {
    doc.querySelectorAll('input[name="pdCloud"]').forEach(function (r) { r.checked = r.value === S.form.cloud; r.onchange = function () { S.form.cloud = r.value; gpus(r.value); }; });
    ["pdGpu", "pdCount", "pdDisk", "pdVol", "pdStyle"].forEach(function (id) { var x = $(id); if (x) { x.addEventListener("change", price); x.addEventListener("input", price); } });
    doc.querySelectorAll("#pdForm [data-pdkind], #pdForm [data-pdaudio]").forEach(function (c) { c.addEventListener("change", price); });
    $("pdGo").onclick = create;
    $("pdForm").querySelectorAll("input,select").forEach(function (x) { x.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
  }
  function gpus(cloud) {
    var sel = $("pdGpu"); if (!sel) return;
    var fill = function (list) {
      sel.innerHTML = list.map(function (g) {
        return '<option value="' + esc(g.id) + '"' + (g.offered ? "" : " disabled") + ">" + esc(g.name) + " · " + g.memory + " GB · " + esc(money(g.price, "/h")) + (g.offered ? (g.availability ? " · " + g.availability.toLowerCase() : "") : " · none free") + "</option>";
      }).join("") || '<option value="">no GPUs offered</option>';
      var first = list.find(function (g) { return g.offered && g.memory >= 20; }) || list.find(function (g) { return g.offered; });
      if (S.form && S.form.gpu && list.some(function (g) { return g.id === S.form.gpu && g.offered; })) first = { id: S.form.gpu };   // 2.763.3: bitGen's pick for the waiting style
      if (first) sel.value = first.id;
      price();
    };
    if (S.gpus[cloud]) { fill(S.gpus[cloud]); return; }
    getj("/api/pods/gpus?cloud=" + cloud).then(function (j) { if (j.error) { say(j.error, false); return; } S.gpus[cloud] = j.gpus || []; fill(S.gpus[cloud]); });
  }
  /** 2.763.4 (Tim: "show all the details before i create the pod"): everything the pod will be, above Create pod */
  // 2.775.0: the audio engines a pod can hold (lib/podAudio.js KINDS) - the create form and static/podaudio.js (My pods)
  var AUDIO = [["tts", "Text to speech", "OmniVoice: speech, your cloned voices (sent from this computer when used), 🗣 Speech & dialog"],
    ["stt", "Speech to text", "faster-whisper: transcripts, lyric timing, a clone's words, ✨ Create's lyrics"],
    ["stems", "Song separation", "demucs: vocals / drums / bass / other - ✂ Split into layers, the Stems docker, sheet music"]];
  function cuOf(img) { var s = String(img || ""), m = /cuda[-_]?(\d{2})\.(\d)/i.exec(s) || /[-_:]cu(\d{2})(\d)\d?(?=[-_.]|$)/i.exec(s); return m ? m[1] + "." + m[2] : ""; }   // = lib/podInstall.js cudaOf
  function summary() {
    var el = $("pdSum"); if (!el || !S.form) return;
    var t = S.tplB || {}, list = S.gpus[S.form.cloud] || [], g = list.find(function (x) { return x.id === ($("pdGpu") || {}).value; }), n = +(($("pdCount") || {}).value) || 1;
    var st = ($("pdStyle") || {}).value, sty = (S.styles || []).find(function (x) { return x.id === st; }), ks = [];
    doc.querySelectorAll("#pdForm [data-pdkind]").forEach(function (c) { if (c.checked) ks.push(c.parentNode.textContent.trim()); });
    var cu = /cuda[\s_-]*13/i.test((t.name || "") + " " + (t.image || "")), web = (t.ports || []).join(", ");
    var rows = [["Template", (t.name || "?") + (t.image ? " (" + t.image + ")" : "")], ["GPU", g ? n + " × " + g.name + " · " + g.memory + " GB each" + (n > 1 ? " (" + (g.memory * n) + " GB in all)" : "") : "pick one"],
      ["Price", g ? money(g.price * n, "/h") + " while it runs (RunPod's price now) + storage" : "-"], ["Cloud", S.form.cloud === "COMMUNITY" ? "Community" : "Secure"],
      ["Container disk", (+(($("pdDisk") || {}).value) || 0) + " GB (wiped when it stops)"], ["/workspace", (+(($("pdVol") || {}).value) || 0) + " GB (kept while stopped)"],
      ["Host", cu ? "CUDA 13 or newer only" : cuOf(t.image) && !t.comfy ? "CUDA " + cuOf(t.image) + " or newer" : "any"], ["Ports", (web || "-") + (t.comfy ? "" : " + 8188 (ComfyUI)") + " + Jupyter (bitGen's own password)"],
      // 2.772.0: a template without ComfyUI (RunPod's PyTorch) - bitGen installs it there
      ["ComfyUI", t.comfy ? "the template's own" : "bitGen installs it on the pod - the newest ComfyUI from GitHub + ComfyUI-Manager, reusing the template's PyTorch (a few minutes the first time; kept in /workspace)"],
      ["Style", sty ? sty.name + (ks.length ? " · this pod renders " + ks.join(", ") + " styles with no pod of their own" : "") : (ks.length ? "renders " + ks.join(", ") + " styles with no pod of their own" : "none")],
      ["Audio", (function () { var a = []; doc.querySelectorAll("#pdForm [data-pdaudio]").forEach(function (c) { if (c.checked) a.push(c.parentNode.textContent.trim()); });
        return a.length ? a.join(", ") + " installed on it (in remote mode those jobs run on the pod)" : "none - text to speech, speech to text and song separation stay on this computer"; })()],
      ["Then", (sty ? "the custom nodes " + sty.name + "'s workflows use" : "the custom nodes its styles' workflows use") + (sty ? " and " + sty.name + "'s files" + (S.ask && S.askSize ? " (about " + S.askSize + " GB)" : "") : "") + " go on it"]];
    el.innerHTML = rows.map(function (r) { return '<span class="k">' + esc(r[0]) + "</span><span>" + esc(r[1]) + "</span>"; }).join("");
  }
  function price() {
    var el = $("pdPrice"), list = S.gpus[S.form && S.form.cloud] || [], g = list.find(function (x) { return x.id === ($("pdGpu") || {}).value; }), n = +(($("pdCount") || {}).value) || 1;
    if (el) { el.textContent = g ? "About " + money(g.price * n) + " an hour while it runs (RunPod's price now), plus storage" : ""; el.title = g && root.H3Money ? H3Money.usdText(g.price * n, H3Money.state()).title : ""; }
    summary();
  }
  function create() {
    var kinds = []; doc.querySelectorAll("#pdForm [data-pdkind]").forEach(function (c) { if (c.checked) kinds.push(c.dataset.pdkind); });
    var audio = []; doc.querySelectorAll("#pdForm [data-pdaudio]").forEach(function (c) { if (c.checked) audio.push(c.dataset.pdaudio); });   // 2.775.0
    var b = { for_style: ($("pdStyle") || {}).value || "", kinds: kinds, audio: audio, templateId: (S.tplB || {}).id || "", name: $("pdName").value, gpu: $("pdGpu").value, count: $("pdCount").value, cloud: S.form.cloud, disk: $("pdDisk").value, volume: $("pdVol").value, port: S.form.port };
    $("pdGo").disabled = true; say("creating the pod on RunPod…");
    post("/api/pods/create", b).then(function (r) {
      $("pdGo").disabled = false;
      if (r.error) { say(r.error, false); if (root.H3PodErr) H3PodErr.show(r); return; }   // 2.779.0: the real error in a dialog
      go("mine");   // 2.760.0: a pod created -> 🖥 My pods
      say("✓ pod created - loading pod…" + (r.preset ? " Kept as the preset " + r.preset + " (📦 Presets)." : ""), true);
      S.watch[r.pod.id] = "start"; S.port = S.port || {}; S.port[r.pod.id] = r.port; S.open = S.open || {}; S.open[r.pod.id] = true;
      loadPods().then(tick);
      if (S.ask && b.for_style === S.ask.style_id) answerAsk({ action: "use", pod_id: r.pod.id }, r.pod.name);   // 2.763.3: the waiting render goes there
    });
  }

  /* ---------------- my pods */
  function loadPods() {
    return getj("/api/pods/mine").then(function (j) { if (j.error) { $("pdPods").innerHTML = '<div class="hint">' + esc(j.error) + "</div>"; return; } S.pods = j.pods || [];
      S.pods.forEach(function (p) { if (/STARTING|PROVISIONING|CREATED/.test(p.status) && !S.watch[p.id]) S.watch[p.id] = "start"; });   // 2.758.0: its bar
      paintPods(); mineCount(); if ($("pdBody")) filter(); if (!S.ticking) tick(); }).catch(function () { /* offline */ });   // 2.780.0: filter = the tab counts + the line
  }
  function mineCount() { var b = $("pdBody") && $("pdBody").querySelector('[data-pdsrc="mine"] .n'); if (b) b.textContent = String(split(S.pods).mine.length); }
  /** 2.780.0: the RunPod account's other pods (not made / started by bitGen) - one line, so nothing runs unseen; opened: each
      with its state and ⏹ Stop while it runs (they still count in 💲 Costs) */
  function paintOthers(SP) {
    var box = $("pdOthers"); if (!box) return;
    if (!SP.other.length) { box.innerHTML = ""; return; }
    var was = box.querySelector("details"), open = was ? was.open : false;
    box.innerHTML = '<details class="pdOthers"' + (open ? " open" : "") + "><summary>" + SP.other.length + " other pod" + (SP.other.length === 1 ? "" : "s") + " on your RunPod account (not bitGen's)"
      + (SP.otherHr ? " · " + esc(money(SP.otherHr, "/h")) + " running" : "") + "</summary>"
      + SP.other.map(function (p) {
        var up = /RUNNING|STARTING|PROVISIONING/.test(p.status);
        return '<div class="pdRow" data-pdother="' + esc(p.id) + '"><span class="nm"><b>' + esc(p.name) + '</b><span class="sub">' + esc(p.gpu || "") + " · " + moneyHtml(+p.cost_hr || 0, "/h") + " · " + esc(String(p.status || "").toLowerCase()) + "</span></span>"
          + (up ? '<button type="button" class="ghost" data-pdostop>⏹ Stop</button>' : "") + "</div>";
      }).join("") + "</details>";
    box.querySelectorAll("[data-pdother]").forEach(function (r) {
      var p = SP.other.find(function (x) { return x.id === r.dataset.pdother; }), b = r.querySelector("[data-pdostop]");
      if (p && b) b.onclick = function () { b.disabled = true; act(p, "stop"); };
    });
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
  /* 2.761.0 (Tim: "make each pod name in my pods a accordian menuitem ..."): each pod is an item - its name (a button: ▸ / ▾,
     🅱, the GPU, $/h, the state) opens it; inside, what it is for + its styles (2.763.0) + 💾 Save (static/podsetup.js)
     and the pod's own buttons. A pod loading or just created opens by itself. */
  function paintPods() {
    var box = $("pdPods"); if (!box) return;
    // typing in an item: only the states change, the fields stay as they are
    var ae = doc.activeElement;
    if (ae && box.contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) && !/^(checkbox|radio)$/.test(ae.type || "")) { box.querySelectorAll(".pdRow[data-pod]").forEach(function (r) { var p = S.pods.find(function (x) { return x.id === r.dataset.pod; }); if (p) setSt(r.querySelector(".pdSt"), p); }); return; }
    S.open = S.open || {};
    var SP = split(S.pods);   // 2.780.0: bitGen's pods here, the account's others in one line under them (paintOthers)
    paintOthers(SP);
    box.innerHTML = SP.mine.map(function (p) {
      var up = /RUNNING|STARTING|PROVISIONING/.test(p.status) && S.watch[p.id] !== "stop";
      if (S.watch[p.id] === "start" && S.open[p.id] == null) S.open[p.id] = true;
      var open = !!S.open[p.id] || (!!S.ask && S.open[p.id] !== false), c = (S.cost && S.cost.pods && S.cost.pods[p.id]) || null;
      // 2.766.0 (Tim: "add a checkbox to the left of the pod name to select the pod(mulitple pods can be selected)"): ticked
      // pods are where Model manager's ⇪ sends a model (rgpu.pod_selected - routes/remoteModels.js)
      var ticked = (S.selPods || []).some(function (x) { return x.id === p.id; });
      return '<div class="pdRow pdAcc' + (open ? " open" : "") + '" data-pod="' + esc(p.id) + '"><div class="pdTop">'
        + '<input type="checkbox" class="pdSel" data-pdsel' + (ticked ? " checked" : "") + ' aria-label="Select ' + esc(p.name) + '" title="Select this pod - Model manager (remote mode) sends models to every ticked pod' + (/RUNNING/.test(p.status) ? "" : " (it has to be running to receive them)") + '">'
        + '<button type="button" class="pdHead" aria-expanded="' + (open ? "true" : "false") + '" title="' + (open ? "Close this pod" : "Open this pod") + '"><span class="ar">' + (open ? "▾" : "▸") + '</span><span class="nm"><b>' + esc(p.name) + "</b> " + (p.bitgen ? '<span class="bg" title="' + (p.made_by_bitgen ? "bitGen made it - it is set up by itself when it loads (its ComfyUI updated, its styles made ready)" : "bitGen created or started it") + '">🅱</span> ' : "")
        + '<span class="sub">' + esc(p.gpu || "") + (p.gpus > 1 ? " ×" + p.gpus : "") + " · " + moneyHtml(+p.cost_hr || 0, "/h") + ' · <span class="pdSt"></span>'
        + (c && c.month ? ' · <span title="RunPod\'s bill for this pod: today / this month">' + esc(money(c.today)) + " today, " + esc(money(c.month)) + " this month</span>" : "")
        + (/RUNNING/.test(p.status) ? '<span class="pdStatsHead" data-pdstath="' + esc(p.id) + '">' + statsHtml(S.stats[p.id], true) + "</span>" : "") + "</span></span></button></div>"
        // 2.769.1 (Tim: "... automatically treat it as such, don't wait for button press"): what bitGen does by itself on a pod it made
        + (S.act && S.act[p.id] ? "" : p.made_by_bitgen && p.setup && p.setup.note ? '<div class="hint pdMade" aria-live="polite" style="margin:2px 0 0 24px;font-size:.7rem">' + (p.setup.phase === "ready" ? "✓ " : p.setup.phase === "failed" ? "✗ " : "⏳ ") + "made by bitGen: " + esc(p.setup.note) + "</div>" : "")
        // 2.772.0 (Tim: "… show what is being done, then hide the completed tasks in a dropdown"): what it is doing now + the done ones
        + '<div class="pdDoing" data-pdactbox="' + esc(p.id) + '" aria-live="polite">' + actHtml(p.id) + "</div>"
        + '<div class="pdBodyIn"' + (open ? "" : " hidden") + ">"
        + (/RUNNING/.test(p.status) ? '<div class="pdStats" data-pdstats="' + esc(p.id) + '">' + statsHtml(S.stats[p.id], false) + "</div>" : "")
        + (open && root.H3PodSetup ? H3PodSetup.html(p) : "")
        + '<div class="pdActs"><button type="button" class="ghost" data-pdact="' + (up ? "stop" : "start") + '">' + (up ? "⏹ Stop" : "▶ Start") + "</button>"
        + (S.ask ? '<button type="button" data-pdfor title="The waiting render of ' + esc(S.ask.style_name) + ' goes to this pod, and the style stays linked to it">▶ Use for ' + esc(S.ask.style_name) + "</button>" : "")
        + '<button type="button" class="ghost" data-pduse title="Render on this pod (its ComfyUI)">Use it</button>'
        + (/RUNNING/.test(p.status) ? '<button type="button" class="ghost" data-pdsty title="P_ styles from the pod\'s models and saved workflows (2.758.0)">🎨 Styles</button>' : "")
        + (/RUNNING/.test(p.status) ? '<button type="button" class="ghost" data-pdmod title="Download a style\'s models (or single files) onto the pod (2.759.0)">⬇ Models</button>' : "")
        + (/RUNNING/.test(p.status) ? '<button type="button" class="ghost" data-pdfiles title="The model files on the pod - their sizes, the disk left; delete the ones you no longer need (2.781.2)">📁 Files</button>' : "")
        + (/RUNNING/.test(p.status) ? '<button type="button" class="ghost" data-pdcrs title="Stop the pod\'s ComfyUI and start it again (a render running on it stops) - press twice (2.781.3)">⟳ Restart ComfyUI</button>' : "")
        + '<button type="button" class="ghost" data-pdpre title="Keep this pod as a preset (📦 Presets): its template, GPU, how many, cloud, disks and styles - ▶ there makes it again after it is terminated">💾 Save as preset</button>'
        + '<button type="button" class="ghost" data-pdkill title="Delete the pod and everything on it">Terminate</button></div>'
        + '<div class="pdLoadBox"></div>'
        + (S.kill === p.id ? '<div class="pdKill">Terminate <b>' + esc(p.name) + "</b>? The pod and every file on it (models, outputs) are deleted - only a network volume survives. "
          + '<button type="button" class="ghost" data-pdkillyes>Terminate</button> <button type="button" class="ghost" data-pdkillno>Cancel</button></div>' : "")
        + "</div></div>";
    }).join("") || '<div class="hint">No bitGen pods yet - press ＋ Create pod.</div>';
    box.querySelectorAll(".pdRow[data-pod]").forEach(function (r) {
      var p = SP.mine.find(function (x) { return x.id === r.dataset.pod; }); if (!p) return;
      setSt(r.querySelector(".pdSt"), p);
      var sel = r.querySelector("[data-pdsel]"); if (sel) sel.onchange = function () { selectPod(p, sel.checked); };   // 2.766.0
      r.querySelector(".pdHead").onclick = function () { S.open[p.id] = !(S.open[p.id] || (!!S.ask && S.open[p.id] !== false)); paintPods(); };
      if (!(S.open[p.id] || (!!S.ask && S.open[p.id] !== false))) return;   // 2.763.3: open while a render waits
      if (root.H3PodSetup) H3PodSetup.wire(r, p, (S.port && S.port[p.id]) || 0, paintPods);
      // 2.758.0 (Tim: "can you show progess of pod loading?"): the stage + the timed bar while it loads (static/podload.js)
      var st = S.st[p.id], lb = r.querySelector(".pdLoadBox");
      if (lb && root.H3PodLoad && st && st.progress && (S.watch[p.id] === "start" || !st.ready || st.progress.took)) lb.innerHTML = H3PodLoad.bar(st);
      var sy = r.querySelector("[data-pdsty]"); if (sy) sy.onclick = function () { stylesFor(p); };
      var mo = r.querySelector("[data-pdmod]"); if (mo) mo.onclick = function () { modelsFor(p); };
      var fl = r.querySelector("[data-pdfiles]"); if (fl) fl.onclick = function () { filesFor(p); };   // 2.781.2
      var crs = r.querySelector("[data-pdcrs]"); if (crs && root.H3PodFiles) H3PodFiles.restartBtn(crs, p.id, (S.port && S.port[p.id]) || 0);   // 2.781.3
      var a = r.querySelector("[data-pdact]"); if (a) a.onclick = function () { act(p, a.dataset.pdact); };
      r.querySelector("[data-pduse]").onclick = function () { use(p); };
      var uf = r.querySelector("[data-pdfor]"); if (uf) uf.onclick = function () { answerAsk({ action: "use", pod_id: p.id }, p.name); };
      r.querySelector("[data-pdkill]").onclick = function () { S.kill = S.kill === p.id ? null : p.id; paintPods(); };
      var sp = r.querySelector("[data-pdpre]"); if (sp) sp.onclick = function () {   // 2.764.0
        sp.disabled = true;
        post("/api/podpresets/from-pod/" + encodeURIComponent(p.id), {}).then(function (j) { sp.disabled = false; if (j.error) { say(j.error, false); return; } say("✓ kept as the preset " + j.name + " (📦 Presets)", true); });
      };
      var y = r.querySelector("[data-pdkillyes]"); if (y) y.onclick = function () { S.kill = null; act(p, "terminate"); };
      var n = r.querySelector("[data-pdkillno]"); if (n) n.onclick = function () { S.kill = null; paintPods(); };
    });
  }
  /** 2.766.0: a pod ticked / unticked -> rgpu.pod_selected (kept by the server, read by Model manager's ⇪) */
  function selectPod(p, on) {
    var L = (S.selPods || []).filter(function (x) { return x.id !== p.id; });
    if (on) L.push({ id: p.id, name: p.name });
    S.selPods = L;
    post("/api/pods/selected", { pods: L }).then(function (j) { if (j && j.selected) S.selPods = j.selected; say(L.length ? "☑ " + L.length + " pod(s) ticked - Model manager's ⇪ sends models to them" : "no pods ticked", true); });
  }
  /** 2.758.0: 🎨 the pod's models + workflows -> P_ styles (static/podload.js), under the list so a repaint keeps it */
  function stylesFor(p) {
    var host = $("pdStyPanel"); if (!host || !root.H3PodLoad) return;
    if (S.sty === p.id && host.innerHTML) { S.sty = null; host.innerHTML = ""; return; }
    S.sty = p.id;
    H3PodLoad.styles(host, p, (S.port && S.port[p.id]) || 0);
  }
  /** 2.759.0: ⬇ Models (static/podload.js) in the same panel place */
  function modelsFor(p) {
    var host = $("pdStyPanel"); if (!host || !root.H3PodLoad) return;
    if (S.mod === p.id && host.innerHTML) { S.mod = null; host.innerHTML = ""; return; }
    S.mod = p.id; S.sty = null;
    H3PodLoad.models(host, p, (S.port && S.port[p.id]) || 0);
  }
  /** 2.781.2: 📁 Files - the pod's model files (static/podfiles.js) in the same panel place */
  function filesFor(p) {
    var host = $("pdStyPanel"); if (!host || !root.H3PodFiles) return;
    S.sty = null; S.mod = null;
    H3PodFiles.open(host, p, (S.port && S.port[p.id]) || 0);
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
  /* 2.763.4 (Tim: "in the pods docker show utilization, memory and disk visualizations and usage"): a running pod's GPU load,
     GPU memory, RAM, CPU and disks (GET /api/pods/:id/stats - lib/podStats.js) as bars - a small pair beside its name, all of
     them inside it - asked every 5 s while this docker is on screen */
  function gb(b) { return (Math.round((+b || 0) / 1e8) / 10).toFixed(1); }
  function bar(label, pct, title) {
    var p = Math.max(0, Math.min(100, Math.round(+pct || 0)));
    return '<span class="pdBar' + (p >= 90 ? " hi" : "") + '" title="' + esc(title || label) + '"><i style="width:' + p + '%"></i><b>' + esc(label) + "</b></span>";
  }
  function statsHtml(st, small) {
    if (!st) return small ? "" : '<span class="hint">asking the pod how busy it is…</span>';
    if (st.error && !(st.gpus || []).length) return small ? "" : '<span class="hint">' + esc(st.error) + "</span>";
    var out = [];
    (st.gpus || []).forEach(function (g, i) {
      var nm = (st.gpus.length > 1 ? "GPU" + (i + 1) : "GPU"), mp = g.mem_total ? 100 * g.mem_used / g.mem_total : 0;
      if (g.util != null) out.push(bar(nm + " " + g.util + "%", g.util, g.name + " - how busy it is"));
      out.push(bar((small ? "VRAM " : "VRAM ") + gb(g.mem_used) + "/" + gb(g.mem_total) + " GB", mp, g.name + " - its memory in use"));
    });
    if (small) return out.slice(0, 2).join("");
    if (st.ram) out.push(bar("RAM " + gb(st.ram.used) + "/" + gb(st.ram.total) + " GB", 100 * st.ram.used / (st.ram.total || 1), "the pod's memory in use"));
    if (st.cpu) out.push(bar("CPU " + st.cpu.load + "% (" + st.cpu.cores + " cores)", st.cpu.load, "the pod's processor load (1-minute average)"));
    (st.disks || []).forEach(function (d) { out.push(bar((d.path === "/" ? "Disk" : d.path) + " " + gb(d.used) + "/" + gb(d.total) + " GB", 100 * d.used / (d.total || 1), d.path === "/" ? "the container disk (wiped when the pod stops)" : "/workspace (kept while the pod is stopped)")); });
    return out.join("") || '<span class="hint">no figures from the pod yet</span>';
  }
  /* 2.772.0 (Tim: "in the pod that is installing and being used show what is being done, then hide the completed tasks in a
     dropdown so the pods details don't get too big. say what it is doing, downloading, loading, finding etc"): the pod's
     activity (GET /api/pods/activity - lib/podActivity.js): what it is doing NOW, one line each - its verb (Downloading,
     Installing, Loading, Finding …) + what + how long so far; when nothing runs, the last result (✓ / ✗); the finished tasks
     in a dropdown ("✓ 7 done"), closed unless you open it - it stays as you leave it while the list updates */
  function dur(s) { s = Math.max(0, Math.round(+s || 0)); return s < 60 ? s + " s" : s < 3600 ? Math.floor(s / 60) + " min" + (s % 60 ? " " + (s % 60) + " s" : "") : Math.floor(s / 3600) + " h " + Math.round((s % 3600) / 60) + " min"; }
  function actHtml(id) {
    var a = S.act && S.act[id]; if (!a) return "";
    var out = (a.now || []).map(function (x) {
      return '<div class="pdNow run"><span class="ic">' + esc(x.icon) + '</span><span class="vb">' + esc(x.verb) + '</span><span class="tx" title="' + esc(x.text) + '">' + esc(x.rest || x.text) + '</span><span class="tm">' + esc(dur(x.secs)) + "</span></div>";
    }).join("");
    if (!(a.now || []).length && a.last) out += '<div class="pdNow ' + (a.last.ok ? "ok" : "bad") + '"><span class="ic">' + (a.last.ok ? "✓" : "✗") + '</span><span class="vb">' + (a.last.ok ? "Done" : "Stopped") + '</span><span class="tx" title="' + esc(a.last.text) + '">' + esc(a.last.text) + "</span></div>";
    var done = (a.done || []).filter(function (x) { return !(x.result && a.last && !(a.now || []).length && x.text === a.last.text); });
    if (done.length) {
      var nOk = done.filter(function (x) { return x.state === "done"; }).length, nBad = done.filter(function (x) { return x.state === "failed"; }).length, nSk = done.filter(function (x) { return x.state === "skipped"; }).length;
      out += '<details class="pdDone" data-pddone="' + esc(id) + '"' + (S.actOpen && S.actOpen[id] ? " open" : "") + "><summary>✓ " + nOk + " done" + (nSk ? " · " + nSk + " already there" : "") + (nBad ? " · ✗ " + nBad + " failed" : "") + "</summary><ol>"
        + done.map(function (x) { return '<li class="' + esc(x.state) + '"><span class="st">' + (x.state === "failed" ? "✗" : x.state === "skipped" ? "–" : "✓") + "</span><span>" + esc(x.icon) + '</span><span class="tx" title="' + esc(x.text) + '"><b>' + esc(x.verb) + "</b> " + esc(x.rest || x.text) + '</span><span class="tm">' + (x.secs ? esc(dur(x.secs)) : "") + "</span></li>"; }).join("")
        + "</ol></details>";
    }
    return out;
  }
  function paintAct() {
    doc.querySelectorAll("[data-pdactbox]").forEach(function (b) {
      var id = b.dataset.pdactbox, d = b.querySelector("details.pdDone"), top = d ? d.querySelector("ol").scrollTop : 0, h = actHtml(id);
      if (b.innerHTML === h) return;
      b.innerHTML = h;
      var d2 = b.querySelector("details.pdDone"); if (d2 && top) d2.querySelector("ol").scrollTop = top;
      var mk = b.previousElementSibling; if (mk && mk.classList && mk.classList.contains("pdMade") && S.act[id]) mk.remove();
    });
  }
  function pollAct() {
    var vis = $("pdBody") && $("pdBody").offsetParent !== null;
    (vis ? getj("/api/pods/activity").then(function (j) { S.act = (j && j.pods) || {}; paintAct(); }).catch(function () { /* next time */ }) : Promise.resolve())
      .then(function () { setTimeout(pollAct, +(root.H3_POD_ACT_POLL || 2500)); });
  }
  function pollStats() {
    var vis = $("pdBody") && $("pdBody").offsetParent !== null;
    var ids = vis ? (S.pods || []).filter(function (p) { return /RUNNING/.test(p.status); }).map(function (p) { return p.id; }) : [];
    Promise.all(ids.map(function (id) {
      var pt = S.port && S.port[id];
      return getj("/api/pods/" + encodeURIComponent(id) + "/stats" + (pt ? "?port=" + pt : "")).then(function (st) {
        S.stats[id] = st;
        var h = doc.querySelector('[data-pdstath="' + id + '"]'), b = doc.querySelector('[data-pdstats="' + id + '"]');
        if (h) h.innerHTML = statsHtml(st, true);
        if (b) b.innerHTML = statsHtml(st, false);
      }).catch(function () { /* next time */ });
    })).then(function () { setTimeout(pollStats, +(root.H3_POD_STATS_POLL || 5000)); });
  }
  /* 2.763.3 (Tim: "if a pod doesn't exist for a style popup the pods docker to create the pod when generate button is
     pressed, auto select the type and style. let user select gpu and number of gpu's and let the user start and stop and
     terminate the pod from the docker"): a render waiting for a pod opens this docker - a banner names it, the create form
     opens on RunPod's ComfyUI CUDA 13 template with the style, its kind, bitGen's GPU pick and the disk filled in (GPU, how
     many, cloud all yours to change); ▶ Use for <style> on any of your pods; Cancel the render. o = the question's offer
     (lib/stylePods.js offer) */
  function forRender(o) {
    if (!o || !o.ask) return false;
    if (!(root.SecFloat && SecFloat.windows && SecFloat.windows.pods)) return false;
    S.ask = o.ask; S.askWas = o.was || null; S.askSize = o.size_gb || 0;
    show(true);   // (false when it is on screen already)
    paintAsk();
    var pre = { style: o.ask.style_id, kinds: [o.ask.kind], gpu: o.pick || "", volume: o.volume_gb || 50, count: o.count || 1, cloud: o.cloud || "SECURE" };
    // 2.780.0: the Create pod form of a bitGen pod, filled in (no template to wait for - the server picks it)
    Promise.resolve(loadStyles()).then(function () { go("create", Object.assign(pre, { name: ("bitGen " + o.ask.style_name).slice(0, 40) })); });
    paintPods();
    return true;
  }
  function paintAsk() {
    var b = $("pdAsk"); if (!b) return;
    if (!S.ask) { b.hidden = true; b.innerHTML = ""; return; }
    b.hidden = false;
    b.innerHTML = '<span class="t">⏳ ' + (S.askWas ? "The pod " + esc(S.askWas.name) + (S.askWas.gpu ? " (" + esc(S.askWas.gpu) + ")" : "") + " is gone on RunPod - the new one below is filled in the same way. " : "") + 'A render of <b>' + esc(S.ask.style_name) + "</b> is waiting for a pod. Create one below (the style and its kind are filled in - pick the GPU and how many), or open 🖥 My pods and press ▶ Use for " + esc(S.ask.style_name) + " on one of yours.</span>"
      + '<button type="button" class="ghost" id="pdAskMine">🖥 My pods</button><button type="button" class="ghost" id="pdAskNo" title="Do not render it now">Cancel the render</button>';
    $("pdAskMine").onclick = function () { go("mine"); };
    $("pdAskNo").onclick = function () { answerAsk({ action: "cancel" }); };
  }
  function answerAsk(b, podName) {
    var a = S.ask; if (!a) return;
    post("/api/stylepods/ask/" + encodeURIComponent(a.id), b).then(function (r) {
      if (r.error) { say(r.error, false); return; }
      S.ask = null; paintAsk(); paintPods();
      if (root.H3StylePodAsk && H3StylePodAsk.answered) H3StylePodAsk.answered(a.id);
      say(b.action === "cancel" ? "the render of " + a.style_name + " was cancelled" : "✓ " + a.style_name + " renders on " + (podName || b.pod_id) + " - it starts when the pod has loaded and has the style's files", b.action !== "cancel");
    });
  }
  function show(on) { if (!(root.SecFloat && SecFloat.windows && SecFloat.windows.pods)) return false; var r = SecFloat.show("pods", on); paintBtn(); return r; }

  function boot() {
    if (!(root.SecFloat && SecFloat.add && SecFloat.started) || !buildBtn()) { setTimeout(boot, 250); return; }
    if (!$("pdCss")) { var st = doc.createElement("style"); st.id = "pdCss"; st.textContent = CSS; doc.head.appendChild(st); }
    if (!$("pdBody")) {
      SecFloat.add({ id: "pods", title: "PODS", w: 760, h: 700, body: body(), onShow: function () { loadTpl(); loadPods(); loadStyles(); filter(); } });
      wire();
    }
    loadG().then(costLine);
    pollStats();   // 2.763.4
    pollAct();     // 2.772.0
    // 2.772.0: the done-list dropdown stays open / closed as you leave it while the activity updates
    doc.addEventListener("toggle", function (e) { var d = e.target; if (d && d.dataset && d.dataset.pddone) { S.actOpen = S.actOpen || {}; S.actOpen[d.dataset.pddone] = d.open; } }, true);
    setInterval(costLine, +(root.H3_POD_COST_POLL || 60000));
    doc.addEventListener("h3:rgpu", function () { loadG().then(costLine); });
    root.addEventListener("h3:currency", function () { if (!$("pdBody")) return; paintPods(); if (S.form && $("pdGpu") && S.gpus[S.form.cloud]) { var keep = $("pdGpu").value; gpus(S.form.cloud); if (keep) { $("pdGpu").value = keep; price(); } } });
    doc.addEventListener("change", function (e) { if (e.target && /^(gpuProv|gpuRunpod|gpuWhere)$/.test(e.target.name || "")) setTimeout(loadG, 500); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3Pods = { AUDIO: AUDIO, forRender: forRender, ask: function () { return S.ask; }, show: show, load: function () { loadG(); loadTpl(); loadPods(); }, state: function () { return S; }, split: split, go: go };
})(typeof window !== "undefined" ? window : globalThis);
