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
 *   2.760.0 (Tim: "in pods docker add a button for my pods (only show my pods when this is clicked), when creating a pod hide
 *               all the templates, after the pod is created only show my pods"): 🖥 My pods (its count) beside the template
 *               tabs shows the pods alone (no templates, no search); the template tabs show the templates alone; Create pod…
 *               hides the cards and their filters (the form alone - ✕ Close or a tab goes back); a pod created -> My pods.
 *               The prices show in Settings ▸ General ▸ Currency (static/currency.js H3Money). */
(function (root) {
  "use strict";
  var doc = root.document, S = { stats: {}, g: null, src: "all", comfy: false, kind: "", q: "", all: [], counts: {}, failed: [], tpl: [], gpus: {}, pods: [], st: {}, watch: {}, form: null, kill: null, cuts: [], styles: [], forStyle: "" };
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
    // 2.756.1: the template cards
    + ".pdk .pdTabs .n{opacity:.65;margin-left:4px;font-size:.66rem}"
    + ".pdk .pdGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:8px;align-content:start}"
    + ".pdk .pdCard{display:flex;flex-direction:column;border:1px solid var(--line,#3a342a);border-radius:8px;overflow:hidden;background:var(--panel,#1b1814);min-width:0}"
    + ".pdk .pdCard:hover,.pdk .pdCard.sel{border-color:var(--tiger,#f59e2c)}"
    + ".pdk .pdArt{position:relative;height:64px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,hsl(var(--h) 42% 30%),hsl(calc(var(--h) + 38) 48% 16%))}"
    + ".pdk .pdGlyph{font-size:1.55rem;font-weight:800;letter-spacing:.02em;color:rgba(255,255,255,.88);text-shadow:0 1px 2px rgba(0,0,0,.4)}"
    + ".pdk .pdCat,.pdk .pdCfy{position:absolute;top:5px;font-size:.6rem;font-weight:700;border-radius:4px;padding:1px 5px}"
    + ".pdk .pdCat{left:5px;background:rgba(0,0,0,.45);color:#ddd}.pdk .pdCfy{right:5px;background:var(--tiger,#f59e2c);color:#111}"
    + ".pdk .pdInfo{padding:6px 8px 4px;display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}"
    + ".pdk .pdName{color:var(--text,#eee);font-weight:600;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}"
    + ".pdk .pdImg{color:var(--dim,#999);font-size:.64rem;font-family:ui-monospace,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".pdk .pdChips{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px}.pdk .pdChips span{font-size:.6rem;border:1px solid var(--line,#3a342a);border-radius:4px;padding:0 4px;color:var(--dim,#aaa)}"
    + ".pdk .pdAct{display:flex;gap:4px;align-items:center;padding:4px 8px 7px}.pdk .pdAct button{flex:1;font-size:.7rem}.pdk .pdAct a{text-decoration:none;padding:0 4px}"
    + ".pdk .pdAct button.pdStar{flex:0 0 auto;font-size:.9rem;padding:0 6px;color:var(--tiger,#f59e2c)}.pdk .pdAct a.pdDeploy{flex:0 0 auto;font-size:.7rem;padding:2px 6px}"
    + ".pdk .pdFits{font-size:.68rem;color:#7fd17f}"
    + ".pdk .pdNew{border:1px solid var(--tiger,#f59e2c);border-radius:8px;padding:6px 8px;background:var(--panel,#1b1814)}.pdk .pdNew .pdForm{border:0;padding:4px 0 0;margin:0;background:none}"
    // 2.760.0: two views - the templates, or 🖥 My pods; Create pod… shows the form alone
    + ".pdk:not(.pdMine) #pdMineBox{display:none}.pdk.pdMine #pdTpl,.pdk.pdMine #pdCreate,.pdk.pdMine .pdTplOnly,.pdk.pdMine #pdStarAdd{display:none!important}"
    + ".pdk.pdMaking #pdTpl,.pdk.pdMaking .pdTplOnly,.pdk.pdMaking #pdStarAdd{display:none!important}"
    + ".pdk:not(.pdPre) #pdPresetBox{display:none}.pdk.pdPre #pdTpl,.pdk.pdPre #pdCreate,.pdk.pdPre .pdTplOnly,.pdk.pdPre #pdStarAdd,.pdk.pdPre #pdMineBox{display:none!important}"
    + ".pdk .pdTabs button[data-pdsrc=mine]{margin-left:6px}"
    // 2.761.0: My pods as an accordion (static/podsetup.js inside)
    + ".pdk .pdAcc{display:block;padding:0;border:1px solid var(--line,#3a342a);border-radius:7px;margin:0 0 6px;background:var(--panel,#1b1814)}"
    + ".pdk .pdAcc.open{border-color:var(--tiger,#f59e2c)}"
    + ".pdk .pdHead{display:flex;gap:8px;align-items:flex-start;width:100%;text-align:left;background:none;border:0;padding:6px 8px;color:inherit;cursor:pointer;font:inherit}"
    + ".pdk .pdHead .ar{color:var(--tiger,#f59e2c);width:1em;flex:none}.pdk .pdHead .nm{flex:1;min-width:0}"
    + ".pdk .pdBodyIn{padding:2px 10px 8px 26px;display:flex;flex-direction:column;gap:6px}"
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
    + ".pdk .pdSum{border:1px solid var(--line,#333);border-radius:6px;padding:6px 10px;display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:12px}.pdk .pdSum .k{color:var(--dim,#999)}";

  /* ---------------- where it shows */
  function wanted() { var g = S.g || {}; return !!(g.enabled && g.engine && g.engine.pods); }
  function buildBtn() {
    var box = $("sec-gpu"); if (!box || !$("gpuWhere")) return false;
    if ($("gpuPods")) return true;
    var b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.id = "gpuPods"; b.style.cssText = "margin:4px 0 0 6px;font-size:.72rem;display:none";
    b.title = "Show / hide the PODS docker: RunPod's public templates, create a pod, your pods"; b.textContent = "🖥 PODS";
    b.onclick = function () { show(); };
    box.appendChild(b);
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
  function body() {
    var d = doc.createElement("div"); d.className = "pdk"; d.id = "pdBody";
    d.innerHTML = '<div class="rowbtns" style="align-items:center">'
      + '<input type="search" id="pdQ" class="pdTplOnly" placeholder="Search templates - name, image, port, kind" spellcheck="false" style="flex:1;min-width:140px">'
      + '<button type="button" class="ghost" id="pdRefresh" title="Ask RunPod again">🔄</button>'
      + '<button type="button" class="ghost" id="pdRpDock" title="The 💲 RunPod docker: your balance, what your pods cost, RunPod\'s GPU prices">💲 RunPod</button></div>'
      + '<div class="rowbtns pdTabs" style="align-items:center;flex-wrap:wrap">'
      + [["all", "All"], ["official", "Official"], ["verified", "Verified"], ["community", "Community"], ["star", "★ Shortcuts"], ["mine", "🖥 My pods"], ["presets", "📦 Presets"]].map(function (t) { return '<button type="button" class="ghost" data-pdsrc="' + t[0] + '">' + t[1] + '<span class="n"></span></button>'; }).join("")
      + '<select id="pdKind" class="pdTplOnly" title="The kind of machine the template is made for" style="width:auto"><option value="">Every kind</option><option value="NVIDIA">NVIDIA</option><option value="AMD">AMD</option><option value="CPU">CPU</option></select>'
      + '<label class="chk pdTplOnly" style="margin:0" title="Only templates that run ComfyUI - the ones bitGen can render with"><input type="checkbox" id="pdComfy"> ComfyUI only</label>'
      + '<select id="pdFor" class="pdTplOnly" title="Templates that look made for this bitGen style first - a pod created this way renders the style (linked to it)" style="width:auto"><option value="">For any style</option></select></div>'
      + '<div id="pdAsk" class="pdAsk" hidden></div>'   // 2.763.3: a render waiting for a pod
      + '<div class="hint" id="pdMsg" aria-live="polite"></div>'
      + '<div id="pdStarAdd" class="rowbtns" style="align-items:center;display:none"><input type="text" id="pdCutLink" placeholder="A template that is not listed: paste its RunPod link" spellcheck="false" style="flex:1;min-width:160px">'
      + '<button type="button" class="ghost" id="pdCutAdd">＋ Add</button><a class="pdLink" href="https://www.runpod.io/console/explore" target="_blank" rel="noopener">Explore RunPod templates ↗</a></div>'
      + '<div id="pdCreate"></div>'
      + '<div class="pdGrid" id="pdTpl"></div>'
      + '<div id="pdMineBox"><div id="pdPods"></div><div id="pdStyPanel"></div>'
      + '<div class="hint">🅱 = bitGen created or started it. Running pods cost money every hour; a stopped pod still pays for its storage until you terminate it.</div></div>'
      + '<div id="pdPresetBox"></div>';   // 2.764.0: 📦 Presets (static/podpresets.js)
    return d;
  }
  function wire() {
    $("pdRpDock").onclick = function () { if (root.H3RunPod) H3RunPod.show(true); };   // 2.763.5
    $("pdBody").querySelectorAll("[data-pdsrc]").forEach(function (b) { b.onclick = function () { go(b.dataset.pdsrc); }; });
    $("pdComfy").onchange = function () { S.comfy = $("pdComfy").checked; filter(); };
    $("pdKind").onchange = function () { S.kind = $("pdKind").value; filter(); };
    $("pdFor").onchange = function () { S.forStyle = $("pdFor").value; S.forUser = true; filter(); };
    var t = null; $("pdQ").addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { S.q = $("pdQ").value; filter(); }, 120); });
    $("pdRefresh").onclick = function () { loadTpl(true); loadPods(); };
    $("pdCutAdd").onclick = function () { star({ link: $("pdCutLink").value, name: "" }, true).then(function (ok) { if (ok) $("pdCutLink").value = ""; }); };
    $("pdCutLink").addEventListener("keydown", function (e) { if (e.key === "Enter") $("pdCutAdd").onclick(); });
    $("pdBody").querySelectorAll("input,select").forEach(function (x) { x.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
  }
  /** 2.760.0: a tab - a template source, or "mine" (🖥 My pods); it leaves an open Create pod form */
  function go(src) {
    if (S.form) { S.form = null; var c = $("pdCreate"); if (c) c.dataset.tpl = ""; paintForm(); }
    S.src = src; filter();
    // 2.764.0 (Tim: "in pods docker add a presets tab"): 📦 Presets - static/podpresets.js paints it
    if (root.H3PodPresets) { if (src === "presets") H3PodPresets.show($("pdPresetBox")).then(function () { filter(); }); else H3PodPresets.hide(); }
  }
  /** 2.760.0: the docker's view - the templates, the form alone, or 🖥 My pods alone */
  function view() {
    var b = $("pdBody"); if (!b) return;
    b.classList.toggle("pdMine", S.src === "mine");
    b.classList.toggle("pdPre", S.src === "presets");   // 2.764.0
    b.classList.toggle("pdMaking", S.src !== "mine" && !!S.form);
  }
  function money(v, sfx) { return root.H3Money ? root.H3Money.usd(v, sfx) : "$" + (+v || 0).toFixed(2) + (sfx || ""); }
  function moneyHtml(v, sfx) { return root.H3Money ? root.H3Money.usdHtml(v, sfx) : esc(money(v, sfx)); }
  /** every template, from all three sources, once; the filters then run here as you type */
  function loadTpl(refresh) {
    say("asking RunPod for its templates…");
    return getj("/api/pods/templates?source=all" + (refresh ? "&refresh=1" : "")).then(function (j) {
      if (j.error) { say(j.error, false); S.all = []; S.counts = {}; filter(); return; }
      S.all = j.templates || []; S.counts = j.counts || {}; S.failed = j.failed || []; filter();
    }).catch(function () { say("RunPod could not be reached", false); });
  }
  /* 2.758.0 (Tim: "can you remove this My pods ... Pod shortcuts ... from remote generation docker and add to pod's card in
     pods docker can bitgen fill in the template link automatically?"): a pod shortcut is a ☆ on a template's card - its link
     is the template's own (lib/podShortcuts.js takes the ID); ★ Shortcuts lists them (Deploy ↗ = RunPod's deploy page with
     bitGen's referral code); a template that is not listed (a private one) can still be added by its link there */
  /* 2.759.0 (Tim: "how do i choose what model comfyui template to use"): For style - the templates whose name / image carry the
     style's model family come first (lib/podModels.js templateScore - the same words) */
  var WORDS = { "qwen-image": ["qwen"], "z-image": ["z-image", "zimage", "z image", "zit", "z_image"], krea2: ["krea"], flux: ["flux"],
    flux2klein9b: ["flux.2", "flux2", "flux-2", "klein"], flux3klein: ["flux 3", "flux3", "klein"], sdxl: ["sdxl", "sd xl", "illustrious", "pony"], sd3: ["sd3", "sd 3"],
    "minimax-h3": ["h3", "minimax"], wan: ["wan"], "ltx-2.3": ["ltx"], ltx: ["ltx"], anima: ["anima"], moss: ["moss"], ph3: ["p-h3", "ph3"] };
  function templateScore(t, st) {
    st = st || {}; var hay = [t.name, t.image].join(" ").toLowerCase(), a = String(st.arch || "").toLowerCase(), fam = WORDS[a] || WORDS[a.split("-")[0]] || [], s = 0;
    fam.forEach(function (w) { if (hay.indexOf(w) >= 0) s += 10; });
    if (s && t.comfy) s += 3;
    return s;
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
      var sel = $("pdFor"); if (!sel) return;
      if (!S.forUser) S.forStyle = promptStyle() || S.forStyle;   // follows the prompt docker until you pick one here
      var keep = S.forStyle || sel.value;
      sel.innerHTML = '<option value="">For any style</option>' + S.styles.map(function (x) { return '<option value="' + esc(x.id) + '">For ' + esc(x.name) + "</option>"; }).join("");
      sel.value = keep;
    }).catch(function () { /* offline */ });
  }
  function forSt() { return S.forStyle ? (S.styles || []).find(function (x) { return x.id === S.forStyle; }) : null; }
  function loadCuts() { return getj("/api/remotegen").then(function (j) { S.cuts = (j && j.shortcuts) || []; filter(); }).catch(function () { /* offline */ }); }
  function isStar(id) { return (S.cuts || []).some(function (c) { return c.id === id; }); }
  /** add {id|link, name} (add = true) or remove {id} a shortcut -> promise of ok */
  function star(o, add) {
    return post("/api/remotegen/shortcuts", add ? { add: { link: o.link || o.id, name: o.name || "" } } : { remove: o.id }).then(function (r) {
      if (r.error) { say(r.error, false); return false; }
      S.cuts = r.shortcuts || []; filter();
      var m = $("pdMsg"); if (m) { m.style.color = "#7c7"; m.textContent = add ? "★ kept under ★ Shortcuts" : "☆ removed from ★ Shortcuts"; }
      return true;
    });
  }
  /* the words a search looks through - the same as lib/pods.js searchText / matches */
  function hay(t) { return [t.name, t.image, (t.ports || []).join(" "), t.category, t.source, t.id, t.comfy ? "comfyui comfy" : ""].join(" ").toLowerCase(); }
  function matches(t, q) { var w = String(q || "").toLowerCase().split(/\s+/).filter(Boolean), h = hay(t); return w.every(function (x) { return h.indexOf(x) >= 0; }); }
  var SRC_WORD = { official: "Official", verified: "Verified", community: "Community" };
  function filter() {
    var pre = S.all.filter(function (t) { return (!S.comfy || t.comfy) && (!S.kind || t.category === S.kind) && matches(t, S.q); });
    S.tpl = pre.filter(function (t) { return S.src === "all" || (S.src === "star" ? isStar(t.id) : t.source === S.src); });
    var fs = forSt();
    if (fs) S.tpl = S.tpl.map(function (t, i) { return { t: t, s: templateScore(t, fs), i: i }; }).sort(function (x, y) { return y.s - x.s || x.i - y.i; }).map(function (x) { return x.t; });
    // ★: a shortcut whose template is not in RunPod's lists (a private one) gets a plain card of its own
    if (S.src === "star") (S.cuts || []).forEach(function (c) { if (!S.all.some(function (t) { return t.id === c.id; }) && matches({ name: c.name, id: c.id }, S.q)) S.tpl.push({ id: c.id, name: c.name, page: c.page, deploy: c.deploy, image: "", ports: [], source: "", cut: true }); });
    var sa = $("pdStarAdd"); if (sa) sa.style.display = S.src === "star" ? "" : "none";
    $("pdBody").querySelectorAll("[data-pdsrc]").forEach(function (b) {
      var k = b.dataset.pdsrc, n = k === "presets" ? (root.H3PodPresets ? H3PodPresets.count() : 0) : k === "mine" ? (S.pods || []).length : k === "all" ? pre.length : k === "star" ? (S.cuts || []).length : pre.filter(function (t) { return t.source === k; }).length;
      b.classList.toggle("on", k === S.src); b.querySelector(".n").textContent = String(n);
    });
    paintTpl(); view();
    var m = $("pdMsg"); if (!m) return;
    m.style.color = "";
    if (S.src === "presets") { m.textContent = ""; return; }
    if (S.src === "mine") { m.textContent = (S.pods || []).length + " pod" + ((S.pods || []).length === 1 ? "" : "s") + " on your RunPod account"; return; }
    m.textContent = S.failed.length ? S.tpl.length + " of " + S.all.length + " templates · RunPod did not answer for: " + S.failed.map(function (k) { return SRC_WORD[k] || k; }).join(", ")
      : S.tpl.length + " of " + S.all.length + " templates";
  }
  /** a template's tile colour (from its image's name, so one maker's templates look alike) and initials */
  function hue(s) { var h = 0, x = String(s || "").split(":")[0]; for (var i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) % 360; return h; }
  function initials(n) { var w = String(n || "").replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean); return ((w[0] || "?").charAt(0) + (w[1] ? w[1].charAt(0) : (w[0] || "").charAt(1))).toUpperCase(); }
  function card(t) {
    var web = (t.ports || []).filter(function (p) { return /\/http$/.test(p); });
    return '<div class="pdCard' + (S.form && S.form.id === t.id ? " sel" : "") + '" data-tpl="' + esc(t.id) + '">'
      + '<div class="pdArt" style="--h:' + hue(t.image || t.name) + '"><span class="pdGlyph">' + esc(initials(t.name)) + "</span>"
      + (t.category ? '<span class="pdCat">' + esc(t.category) + "</span>" : "") + (t.comfy ? '<span class="pdCfy" title="Runs ComfyUI - bitGen can render on it">ComfyUI</span>' : "") + "</div>"
      + '<div class="pdInfo"><span class="pdName" title="' + esc(t.name) + '">' + esc(t.name) + "</span>"
      + (forSt() && templateScore(t, forSt()) ? '<span class="pdFits" title="Its name says it has this style\'s model family">✓ fits ' + esc(forSt().name) + "</span>" : "")
      + '<span class="pdImg" title="' + esc(t.image) + '">' + esc(t.image) + "</span>"
      + '<div class="pdChips"><span>' + esc(SRC_WORD[t.source] || t.source) + "</span>"
      + (t.disk ? `<span title="Container disk">${t.disk} GB disk</span>` : "")
      + (t.volume ? `<span title="Kept while the pod is stopped">${t.volume} GB /workspace</span>` : "")
      + web.slice(0, 3).map(function (p) { return "<span>" + esc(p) + "</span>"; }).join("") + "</div></div>"
      + '<div class="pdAct">' + (t.cut ? "" : '<button type="button" class="ghost" data-pdcreate="' + esc(t.id) + '">Create pod…</button>')
      + (isStar(t.id) ? '<a class="btn ghost pdDeploy" href="' + esc((S.cuts.find(function (c) { return c.id === t.id; }) || {}).deploy || "") + '" target="_blank" rel="noopener" title="RunPod\'s deploy page with this template picked (bitGen\'s referral link)">Deploy ↗</a>' : "")
      + '<button type="button" class="ghost pdStar" data-pdstar="' + esc(t.id) + '" aria-pressed="' + (isStar(t.id) ? "true" : "false") + '" title="' + (isStar(t.id) ? "Remove it from ★ Shortcuts" : "Keep it under ★ Shortcuts - its link is filled in for you") + '">' + (isStar(t.id) ? "★" : "☆") + "</button>"
      + (t.page ? '<a class="pdLink" href="' + esc(t.page) + '" target="_blank" rel="noopener" title="Its page on RunPod">↗</a>' : "") + "</div></div>";
  }
  function paintTpl() {
    var box = $("pdTpl"); if (!box) return;
    box.innerHTML = S.tpl.map(card).join("") || '<div class="hint">' + (S.src === "star" ? "No shortcuts yet - press ☆ on a template to keep it here." : S.all.length ? "No template matches - try fewer words, another kind, or untick ComfyUI only." : "No templates here.") + "</div>";
    box.querySelectorAll("[data-pdcreate]").forEach(function (b) { b.onclick = function () { openForm(b.dataset.pdcreate); }; });
    box.querySelectorAll("[data-pdstar]").forEach(function (b) { b.onclick = function () {
      var id = b.dataset.pdstar, t = S.tpl.find(function (x) { return x.id === id; }) || {};
      star({ id: id, name: t.name || "" }, !isStar(id));
    }; });
    paintForm();
  }
  function openForm(id, pre) {
    var t = S.all.find(function (x) { return x.id === id; }); if (!t) return;
    S.form = S.form && S.form.id === t.id && !pre ? null : Object.assign({ id: t.id, port: t.port, cloud: "SECURE", disk: t.disk || 50, style: S.forStyle || promptStyle(), kinds: [] }, pre || {});
    var cc = $("pdCreate"); if (cc && pre) cc.dataset.tpl = "";
    box2sel(); paintForm(); view();
    if (S.form) { gpus(S.form.cloud); var c = $("pdCreate"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest" }); }
  }
  function box2sel() { $("pdTpl").querySelectorAll(".pdCard").forEach(function (c) { c.classList.toggle("sel", !!(S.form && S.form.id === c.dataset.tpl)); }); }
  function paintForm() {
    var c = $("pdCreate"); if (!c) return;
    var t = S.form && S.all.find(function (x) { return x.id === S.form.id; });
    if (!t) { S.form = null; c.innerHTML = ""; return; }
    if ($("pdForm") && c.dataset.tpl === t.id) return;
    c.dataset.tpl = t.id;
    c.innerHTML = '<div class="pdNew"><div class="rowbtns" style="align-items:center"><span style="flex:1">Create a pod from <b>' + esc(t.name) + "</b></span>"
      + '<button type="button" class="ghost" id="pdClose" title="Close">✕ Close</button></div>' + formHtml(t) + "</div>";
    $("pdClose").onclick = function () { S.form = null; c.dataset.tpl = ""; box2sel(); paintForm(); view(); };
    wireForm();
  }
  function formHtml(t) {
    return '<div class="pdForm" id="pdForm"><label class="f" for="pdName" style="margin:0">Name</label><input type="text" id="pdName" value="' + esc(t.name.slice(0, 40)) + '" spellcheck="false">'
      + '<span class="f">Cloud</span><span><label class="chk" style="margin:0 10px 0 0" title="RunPod\'s own data centres"><input type="radio" name="pdCloud" value="SECURE" checked> Secure</label>'
      + '<label class="chk" style="margin:0" title="Machines run by RunPod\'s community hosts - usually cheaper"><input type="radio" name="pdCloud" value="COMMUNITY"> Community</label></span>'
      + '<label class="f" for="pdGpu" style="margin:0">GPU</label><select id="pdGpu"><option value="">asking RunPod…</option></select>'
      + '<label class="f" for="pdCount" style="margin:0">GPUs</label><input type="number" id="pdCount" min="1" max="8" value="' + ((S.form && S.form.count) || 1) + '" style="width:70px">'
      // 2.763.3 (Tim: "auto select the type and style"): the style it renders + the kinds of style it is the pod for
      + '<label class="f" for="pdStyle" style="margin:0">Style</label><select id="pdStyle" title="The style that renders on this pod (linked to it)"><option value="">— none —</option>'
      + (S.styles || []).map(function (x) { return '<option value="' + esc(x.id) + '"' + (S.form && S.form.style === x.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select>"
      + '<span class="f">For</span><span class="pdKinds" title="This pod renders every style of the kinds ticked that has no pod of its own - one pod per kind">'
      + [["image", "Image"], ["image_edit", "Image edit"], ["video", "Video"]].map(function (k) { return '<label class="chk" style="margin:0"><input type="checkbox" data-pdkind="' + k[0] + '"' + (S.form && (S.form.kinds || []).indexOf(k[0]) >= 0 ? " checked" : "") + "> " + k[1] + "</label>"; }).join("") + "</span>"
      + '<label class="f" for="pdDisk" style="margin:0">Container disk</label><span><input type="number" id="pdDisk" min="10" max="1000" value="' + (+t.disk || 50) + '" style="width:80px"> GB <span class="hint">(wiped when the pod stops)</span></span>'
      + '<label class="f" for="pdVol" style="margin:0">/workspace</label><span><input type="number" id="pdVol" min="10" max="2000" value="' + ((S.form && S.form.volume) || 50) + '" style="width:80px"> GB <span class="hint">(kept while stopped - billed for storage)</span></span>'
      + '<span class="full hint" id="pdPrice"></span>'
      + '<div class="full pdSum" id="pdSum" aria-live="polite"></div>'
      + '<span class="full"><button type="button" id="pdGo">Create pod</button></span></div>';
  }
  function wireForm() {
    doc.querySelectorAll('input[name="pdCloud"]').forEach(function (r) { r.checked = r.value === S.form.cloud; r.onchange = function () { S.form.cloud = r.value; gpus(r.value); }; });
    ["pdGpu", "pdCount", "pdDisk", "pdVol", "pdStyle"].forEach(function (id) { var x = $(id); if (x) { x.addEventListener("change", price); x.addEventListener("input", price); } });
    doc.querySelectorAll("#pdForm [data-pdkind]").forEach(function (c) { c.addEventListener("change", price); });
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
  function summary() {
    var el = $("pdSum"); if (!el || !S.form) return;
    var t = S.all.find(function (x) { return x.id === S.form.id; }) || {}, list = S.gpus[S.form.cloud] || [], g = list.find(function (x) { return x.id === ($("pdGpu") || {}).value; }), n = +(($("pdCount") || {}).value) || 1;
    var st = ($("pdStyle") || {}).value, sty = (S.styles || []).find(function (x) { return x.id === st; }), ks = [];
    doc.querySelectorAll("#pdForm [data-pdkind]").forEach(function (c) { if (c.checked) ks.push(c.parentNode.textContent.trim()); });
    var cu = /cuda[\s_-]*13/i.test((t.name || "") + " " + (t.image || "")), web = (t.ports || []).join(", ");
    var rows = [["Template", (t.name || "?") + (t.image ? " (" + t.image + ")" : "")], ["GPU", g ? n + " × " + g.name + " · " + g.memory + " GB each" + (n > 1 ? " (" + (g.memory * n) + " GB in all)" : "") : "pick one"],
      ["Price", g ? money(g.price * n, "/h") + " while it runs (RunPod's price now) + storage" : "-"], ["Cloud", S.form.cloud === "COMMUNITY" ? "Community" : "Secure"],
      ["Container disk", (+(($("pdDisk") || {}).value) || 0) + " GB (wiped when it stops)"], ["/workspace", (+(($("pdVol") || {}).value) || 0) + " GB (kept while stopped)"],
      ["Host", cu ? "CUDA 13 or newer only" : "any"], ["Ports", (web || "-") + " + Jupyter (bitGen's own password)"],
      ["Style", sty ? sty.name + (ks.length ? " · this pod renders " + ks.join(", ") + " styles with no pod of their own" : "") : (ks.length ? "renders " + ks.join(", ") + " styles with no pod of their own" : "none")],
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
    var b = { for_style: ($("pdStyle") || {}).value || "", kinds: kinds, templateId: S.form.id, name: $("pdName").value, gpu: $("pdGpu").value, count: $("pdCount").value, cloud: S.form.cloud, disk: $("pdDisk").value, volume: $("pdVol").value, port: S.form.port };
    $("pdGo").disabled = true; say("creating the pod on RunPod…");
    post("/api/pods/create", b).then(function (r) {
      $("pdGo").disabled = false;
      if (r.error) { say(r.error, false); return; }
      S.form = null; box2sel(); paintForm(); S.src = "mine"; filter();   // 2.760.0: a pod created -> 🖥 My pods
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
      paintPods(); mineCount(); if (!S.ticking) tick(); }).catch(function () { /* offline */ });
  }
  function mineCount() { var b = $("pdBody") && $("pdBody").querySelector('[data-pdsrc="mine"] .n'); if (b) b.textContent = String((S.pods || []).length); }
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
    box.innerHTML = S.pods.map(function (p) {
      var up = /RUNNING|STARTING|PROVISIONING/.test(p.status) && S.watch[p.id] !== "stop";
      if (S.watch[p.id] === "start" && S.open[p.id] == null) S.open[p.id] = true;
      var open = !!S.open[p.id] || (!!S.ask && S.open[p.id] !== false), c = (S.cost && S.cost.pods && S.cost.pods[p.id]) || null;
      return '<div class="pdRow pdAcc' + (open ? " open" : "") + '" data-pod="' + esc(p.id) + '">'
        + '<button type="button" class="pdHead" aria-expanded="' + (open ? "true" : "false") + '" title="' + (open ? "Close this pod" : "Open this pod") + '"><span class="ar">' + (open ? "▾" : "▸") + '</span><span class="nm"><b>' + esc(p.name) + "</b> " + (p.bitgen ? '<span class="bg" title="bitGen created or started it">🅱</span> ' : "")
        + '<span class="sub">' + esc(p.gpu || "") + (p.gpus > 1 ? " ×" + p.gpus : "") + " · " + moneyHtml(+p.cost_hr || 0, "/h") + ' · <span class="pdSt"></span>'
        + (c && c.month ? ' · <span title="RunPod\'s bill for this pod: today / this month">' + esc(money(c.today)) + " today, " + esc(money(c.month)) + " this month</span>" : "")
        + (/RUNNING/.test(p.status) ? '<span class="pdStatsHead" data-pdstath="' + esc(p.id) + '">' + statsHtml(S.stats[p.id], true) + "</span>" : "") + "</span></span></button>"
        + '<div class="pdBodyIn"' + (open ? "" : " hidden") + ">"
        + (/RUNNING/.test(p.status) ? '<div class="pdStats" data-pdstats="' + esc(p.id) + '">' + statsHtml(S.stats[p.id], false) + "</div>" : "")
        + (open && root.H3PodSetup ? H3PodSetup.html(p) : "")
        + '<div class="pdActs"><button type="button" class="ghost" data-pdact="' + (up ? "stop" : "start") + '">' + (up ? "⏹ Stop" : "▶ Start") + "</button>"
        + (S.ask ? '<button type="button" data-pdfor title="The waiting render of ' + esc(S.ask.style_name) + ' goes to this pod, and the style stays linked to it">▶ Use for ' + esc(S.ask.style_name) + "</button>" : "")
        + '<button type="button" class="ghost" data-pduse title="Render on this pod (its ComfyUI)">Use it</button>'
        + (/RUNNING/.test(p.status) ? '<button type="button" class="ghost" data-pdsty title="P_ styles from the pod\'s models and saved workflows (2.758.0)">🎨 Styles</button>' : "")
        + (/RUNNING/.test(p.status) ? '<button type="button" class="ghost" data-pdmod title="Download a style\'s models (or single files) onto the pod (2.759.0)">⬇ Models</button>' : "")
        + '<button type="button" class="ghost" data-pdpre title="Keep this pod as a preset (📦 Presets): its template, GPU, how many, cloud, disks and styles - ▶ there makes it again after it is terminated">💾 Save as preset</button>'
        + '<button type="button" class="ghost" data-pdkill title="Delete the pod and everything on it">Terminate</button></div>'
        + '<div class="pdLoadBox"></div>'
        + (S.kill === p.id ? '<div class="pdKill">Terminate <b>' + esc(p.name) + "</b>? The pod and every file on it (models, outputs) are deleted - only a network volume survives. "
          + '<button type="button" class="ghost" data-pdkillyes>Terminate</button> <button type="button" class="ghost" data-pdkillno>Cancel</button></div>' : "")
        + "</div></div>";
    }).join("") || '<div class="hint">No pods yet - pick a template (All, Official …) and press Create pod….</div>';
    box.querySelectorAll(".pdRow[data-pod]").forEach(function (r) {
      var p = S.pods.find(function (x) { return x.id === r.dataset.pod; }); if (!p) return;
      setSt(r.querySelector(".pdSt"), p);
      r.querySelector(".pdHead").onclick = function () { S.open[p.id] = !(S.open[p.id] || (!!S.ask && S.open[p.id] !== false)); paintPods(); };
      if (!(S.open[p.id] || (!!S.ask && S.open[p.id] !== false))) return;   // 2.763.3: open while a render waits
      if (root.H3PodSetup) H3PodSetup.wire(r, p, (S.port && S.port[p.id]) || 0, paintPods);
      // 2.758.0 (Tim: "can you show progess of pod loading?"): the stage + the timed bar while it loads (static/podload.js)
      var st = S.st[p.id], lb = r.querySelector(".pdLoadBox");
      if (lb && root.H3PodLoad && st && st.progress && (S.watch[p.id] === "start" || !st.ready || st.progress.took)) lb.innerHTML = H3PodLoad.bar(st);
      var sy = r.querySelector("[data-pdsty]"); if (sy) sy.onclick = function () { stylesFor(p); };
      var mo = r.querySelector("[data-pdmod]"); if (mo) mo.onclick = function () { modelsFor(p); };
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
    var openIt = function () {
      if (!o.template) { go("mine"); say(o.template_error || "RunPod's ComfyUI CUDA 13 template was not found - pick a template, or use one of your pods", false); return; }
      if (!S.all.some(function (t) { return t.id === o.template.id; })) { setTimeout(openIt, 400); return; }
      S.src = "all"; filter();
      openForm(o.template.id, pre);
      var nm = $("pdName"); if (nm) nm.value = ("bitGen " + o.ask.style_name).slice(0, 40);
    };
    Promise.resolve(loadStyles()).then(function () { S.forStyle = o.ask.style_id; S.forUser = true; var f = $("pdFor"); if (f) f.value = o.ask.style_id; openIt(); });
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
      SecFloat.add({ id: "pods", title: "PODS", w: 760, h: 700, body: body(), onShow: function () { loadTpl(); loadPods(); loadCuts(); loadStyles(); } });
      wire();
    }
    loadG().then(costLine);
    pollStats();   // 2.763.4
    setInterval(costLine, +(root.H3_POD_COST_POLL || 60000));
    doc.addEventListener("h3:rgpu", function () { loadG().then(costLine); });
    root.addEventListener("h3:currency", function () { if (!$("pdBody")) return; paintPods(); if (S.form && $("pdGpu") && S.gpus[S.form.cloud]) { var keep = $("pdGpu").value; gpus(S.form.cloud); if (keep) { $("pdGpu").value = keep; price(); } } });
    doc.addEventListener("change", function (e) { if (e.target && /^(gpuProv|gpuRunpod|gpuWhere)$/.test(e.target.name || "")) setTimeout(loadG, 500); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3Pods = { forRender: forRender, ask: function () { return S.ask; }, show: show, load: function () { loadG(); loadTpl(); loadPods(); }, state: function () { return S; }, matches: matches, initials: initials };
})(typeof window !== "undefined" ? window : globalThis);
