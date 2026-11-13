/* bitGen Studio — static/podpresets.js (2.764.0): 🖥 PODS ▸ 📦 PRESETS - each preset an accordion item: ▶ ⏹ 🗑 ✕ in its
 * title bar, every detail editable inside, the loading sequence, running, $/h, hours used and the total cost.
 * window.H3PodPresets (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "in pods docker add a presets tab, save all the pods details with the styles it holds and gpu and number of
 * gpu's etc in a <preset name>.pod file in a folder called runpod\pods\presets. display the presets as accordian items. if user
 * clicks the preset menu item , show all the details of whats in the pod, allow user to edit details , remove styles, add
 * styles to preset. in the menu item titlebar show a play button a stop button and a delete button(delete button terminates
 * the pod) icon only. show loading sequence, show running, show cost/hr, hrs used and total cost under the pod details"
 * + "delete should only terminate the pod x should delete the preset"
 *
 *   ▶  start the preset's pod; terminated = a new pod with every detail + every style's files (lib/podPresets.js play); its GPU
 *      not free = the GPUs with as much memory or more to pick from, then ▶ again
 *   ⏹  stop it (the GPU charge ends; /workspace stays)      🗑  terminate the pod (asks first; the preset stays)
 *   ✕  delete the preset (asks first; the pod is left as it is)
 *   Asked again every 5 s while a preset loads, else every 20 s while the tab shows (GET /api/podpresets).
 * Pure (Node: scripts/test-podpresets764.js): hoursText, stateWord, stepIcon, dirty.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  function hoursText(h) { h = +h || 0; if (h < 1 / 60) return "0 min"; if (h < 1) return Math.round(h * 60) + " min"; var H = Math.floor(h), M = Math.round((h - H) * 60); return H + " h" + (M ? " " + M + " min" : ""); }
  var WORDS = { running: "running", loading: "loading", stopped: "stopped", terminated: "terminated - ▶ makes it again", none: "no pod yet - ▶ makes it", failed: "running - something did not finish" };
  function stateWord(s) { return WORDS[s] || String(s || ""); }
  function stepIcon(st) { return { done: "✓", doing: "◐", failed: "✕", todo: "○" }[st] || "○"; }
  /** the form differs from the preset (the fields one can edit) */
  var FIELDS = ["name", "template_id", "gpu", "count", "cloud", "disk", "volume", "cuda", "kinds", "styles"];
  function dirty(a, b) { return FIELDS.some(function (k) { return JSON.stringify(a && a[k]) !== JSON.stringify(b && b[k]); }); }
  var api = { hoursText: hoursText, stateWord: stateWord, stepIcon: stepIcon, dirty: dirty, FIELDS: FIELDS };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  /* ================================ the page ================================ */
  var doc = root.document;
  var S = { host: null, list: [], open: {}, edit: {}, ask: {}, gpus: {}, tpls: null, styles: null, timer: null, msg: {}, need: {} };
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function send(m, u, b) { return root.fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(function (r) { return r.json(); }); }
  function money(v, s) { return root.H3Money ? root.H3Money.usdHtml(v, s) : esc("$" + (+v || 0).toFixed(2) + (s || "")); }
  function u(name) { return "/api/podpresets/" + encodeURIComponent(name); }
  var CSS = ".ppList{display:flex;flex-direction:column;gap:6px}.ppItem{border:1px solid var(--line,#3a342a);border-radius:6px;overflow:hidden}"
    + ".ppHead{display:flex;align-items:center;gap:8px;padding:4px 6px;background:var(--panel-2,#26221b)}.ppTog{flex:1;min-width:0;text-align:left;background:none;border:0;color:inherit;font:inherit;font-weight:600;cursor:pointer;padding:3px 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".ppChip{font-size:11px;padding:1px 7px;border-radius:9px;border:1px solid var(--line,#444);white-space:nowrap}.ppChip.running{border-color:#5a5;color:#8d8}.ppChip.loading{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}.ppChip.failed{border-color:#c66;color:#e88}"
    + ".ppRate{font-size:11px;color:var(--dim,#999);white-space:nowrap}.ppIcons{display:flex;gap:2px}.ppIc{background:none;border:1px solid transparent;color:inherit;cursor:pointer;font-size:14px;line-height:1;padding:3px 5px;border-radius:4px}"
    + ".ppIc:hover:not(:disabled){border-color:var(--line,#555)}.ppIc:focus-visible{outline:2px solid var(--tiger,#f59e2c)}.ppIc:disabled{opacity:.35;cursor:default}"
    + ".ppBody{padding:8px 10px;display:flex;flex-direction:column;gap:8px}.ppGrid{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center}.ppGrid>label{color:var(--dim,#999)}"
    + ".ppGrid input[type=number]{width:80px}.ppSty{display:flex;flex-wrap:wrap;gap:4px}.ppSty span{border:1px solid var(--line,#444);border-radius:10px;padding:1px 4px 1px 8px;display:inline-flex;gap:4px;align-items:center}"
    + ".ppSty span.miss{border-style:dashed;opacity:.7}.ppSty button{background:none;border:0;color:inherit;cursor:pointer;padding:0 3px}.ppSteps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}"
    + ".ppSteps li{display:grid;grid-template-columns:18px 1fr;gap:4px}.ppSteps li.doing{color:var(--tiger,#f59e2c)}.ppSteps li.done{color:#8d8}.ppSteps li.failed{color:#e88}.ppSteps .nt{grid-column:2;color:var(--dim,#999);font-size:11px}"
    + ".ppRun{display:grid;grid-template-columns:auto 1fr;gap:2px 12px}.ppRun .k{color:var(--dim,#999)}.ppAsk{border:1px solid #c66;border-radius:6px;padding:6px 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}"
    + ".ppMsg{min-height:1em}.ppMsg.bad{color:#e88}.ppMsg.ok{color:#7c7}";

  function css() { if (!doc.getElementById("ppCss")) { var st = doc.createElement("style"); st.id = "ppCss"; st.textContent = CSS; doc.head.appendChild(st); } }
  function loadAux() {
    if (!S.tpls) S.tpls = getj("/api/pods/templates?source=all").then(function (j) { return (j.templates || []).filter(function (t) { return t.comfy; }); }).catch(function () { return []; });
    if (!S.styles) S.styles = Promise.all(["image", "video"].map(function (k) { return getj("/api/styles?kind=" + k).then(function (j) { return j.styles || []; }).catch(function () { return []; }); }))
      .then(function (a) { return a[0].concat(a[1]).filter(function (x) { return x.runs_on !== "api" && x.runs_on !== "remote" && x.runs_on !== "pod"; }); });
    return Promise.all([S.tpls, S.styles]);
  }
  function gpusOf(cloud) {
    if (!S.gpus[cloud]) S.gpus[cloud] = getj("/api/pods/gpus?cloud=" + cloud).then(function (j) { return j.gpus || []; }).catch(function () { return []; });
    return S.gpus[cloud];
  }
  function load() {
    return getj("/api/podpresets").then(function (j) {
      // a form nobody changed follows the preset (a style added from the "no pod" dialog shows at once)
      S.list.forEach(function (p) { if (S.edit[p.name] && !dirty(S.edit[p.name], p)) delete S.edit[p.name]; });
      S.list = j.presets || []; S.dir = j.dir || ""; S.err = j.error || "";
      paint();
      root.clearTimeout(S.timer);
      if (S.host && S.host.offsetParent !== null) S.timer = root.setTimeout(load, S.list.some(function (p) { return p.state === "loading" || (p.job && p.job.phase === "working"); }) ? +(root.H3_PP_POLL || 5000) : 20000);
      return S.list;
    }).catch(function () { if (S.host) S.host.querySelector(".ppMsgTop").textContent = "bitGen could not be asked for the presets"; });
  }
  function formOf(p) { return S.edit[p.name] || (S.edit[p.name] = JSON.parse(JSON.stringify({ name: p.name, template_id: p.template_id, template_name: p.template_name, gpu: p.gpu, gpu_name: p.gpu_name, count: p.count, cloud: p.cloud, disk: p.disk, volume: p.volume, cuda: p.cuda, cuda_was: p.cuda, kinds: p.kinds, styles: p.styles }))); }
  function stepsHtml(p) {
    var J = p.job;
    if (!J) return p.state === "running" ? '<div class="hint">Running - its styles were made ready when they were added or first rendered.</div>' : "";
    return '<ul class="ppSteps" aria-label="Loading sequence">' + J.steps.map(function (s) { return '<li class="' + esc(s.state) + '"><span aria-hidden="true">' + stepIcon(s.state) + "</span><span>" + esc(s.label) + "</span>" + (s.note && s.state !== "todo" ? '<span class="nt">' + esc(s.note) + "</span>" : "") + "</li>"; }).join("") + "</ul>";
  }
  function itemHtml(p) {
    var open = !!S.open[p.name], f = formOf(p), pod = p.pod, up = p.state === "running" || p.state === "loading" || p.state === "failed", hasPod = !!pod;
    var h = '<div class="ppItem' + (open ? " open" : "") + '" data-pp="' + esc(p.name) + '"><div class="ppHead">'
      + '<button type="button" class="ppTog" aria-expanded="' + open + '">' + (open ? "▾ " : "▸ ") + esc(p.name) + "</button>"
      + '<span class="ppChip ' + esc(p.state) + '">' + esc(p.state === "terminated" ? "terminated" : p.state === "none" ? "no pod" : p.state) + "</span>"
      + (pod && pod.cost_hr && up ? '<span class="ppRate">' + money(pod.cost_hr, "/h") + "</span>" : "")
      + '<span class="ppIcons">'
      + '<button type="button" class="ppIc" data-ppplay title="Start' + (hasPod ? "" : " - makes the pod again with every style on it") + '" aria-label="Start ' + esc(p.name) + '"' + (up ? " disabled" : "") + ">▶</button>"
      + '<button type="button" class="ppIc" data-ppstop title="Stop - the GPU charge ends, /workspace stays" aria-label="Stop ' + esc(p.name) + '"' + (up && p.state !== "loading" ? "" : " disabled") + ">⏹</button>"
      + '<button type="button" class="ppIc" data-ppkill title="Terminate the pod - everything on it is deleted; the preset stays" aria-label="Terminate the pod of ' + esc(p.name) + '"' + (hasPod ? "" : " disabled") + ">🗑</button>"
      + '<button type="button" class="ppIc" data-ppdel title="Delete the preset (the pod is left as it is)" aria-label="Delete the preset ' + esc(p.name) + '">✕</button></span></div>';
    var ask = S.ask[p.name];
    if (ask) h += '<div class="ppAsk" role="alert">' + (ask === "kill" ? "Terminate <b>" + esc(pod ? pod.name : p.name) + "</b>? The pod and every file on it are deleted. The preset stays - ▶ makes it again."
      : "Delete the preset <b>" + esc(p.name) + "</b>?" + (hasPod ? " Its pod is left as it is (🗑 terminates it)." : ""))
      + '<button type="button" data-ppyes>' + (ask === "kill" ? "Terminate" : "Delete preset") + '</button><button type="button" class="ghost" data-ppno>Keep it</button></div>';
    var need = S.need[p.name];
    if (need) h += '<div class="ppAsk" role="alert"><span>' + esc(p.gpu_name || p.gpu) + (need.count > 1 ? " × " + need.count : "") + " is not free on RunPod's " + (need.cloud === "COMMUNITY" ? "Community" : "Secure") + " cloud now. Pick one with as much memory or more:</span>"
      + '<select data-ppneed>' + (need.options || []).map(function (g) { return '<option value="' + esc(g.id) + '">' + esc(g.name) + " · " + g.memory + " GB · " + esc(root.H3Money ? H3Money.usd(g.price, "/h") : "$" + g.price + "/h") + "</option>"; }).join("") + "</select>"
      + '<button type="button" data-ppneedgo' + ((need.options || []).length ? "" : " disabled") + '>▶ Use it</button><button type="button" class="ghost" data-ppneedno>Not now</button></div>';
    h += '<div class="ppMsg' + (S.msg[p.name] && S.msg[p.name].bad ? " bad" : S.msg[p.name] && S.msg[p.name].ok ? " ok" : "") + '" aria-live="polite">' + esc(S.msg[p.name] ? S.msg[p.name].t : "") + "</div>";
    if (!open) return h + "</div>";
    h += '<div class="ppBody">'
      + '<div class="ppGrid">'
      + '<label for="ppN_' + esc(p.name) + '">Name</label><input type="text" id="ppN_' + esc(p.name) + '" data-ppf="name" maxlength="60" value="' + esc(f.name) + '">'
      + '<label>Template</label><select data-ppf="template_id"><option value="' + esc(f.template_id) + '">' + esc(f.template_name || f.template_id) + "</option></select>"
      + '<label>Cloud</label><select data-ppf="cloud"><option value="SECURE"' + (f.cloud === "SECURE" ? " selected" : "") + '>Secure</option><option value="COMMUNITY"' + (f.cloud === "COMMUNITY" ? " selected" : "") + ">Community</option></select>"
      + '<label>GPU</label><select data-ppf="gpu"><option value="' + esc(f.gpu) + '">' + esc(f.gpu_name || f.gpu) + "</option></select>"
      + '<label>GPUs</label><input type="number" data-ppf="count" min="1" max="8" value="' + f.count + '">'
      + '<label>Container disk</label><span><input type="number" data-ppf="disk" min="10" max="1000" value="' + f.disk + '"> GB (wiped when the pod stops)</span>'
      + '<label>/workspace</label><span><input type="number" data-ppf="volume" min="10" max="2000" value="' + f.volume + '"> GB (the models - kept while it is stopped)</span>'
      + '<label>Host</label><label class="chk" style="color:inherit"><input type="checkbox" data-ppf="cuda"' + (f.cuda ? " checked" : "") + "> CUDA " + esc(f.cuda || f.cuda_was || "13.0") + " or newer hosts only (the template's image needs it)</label>"
      + '<label>Kinds</label><span>' + [["image", "Image"], ["image_edit", "Image edit"], ["video", "Video"]].map(function (k) { return '<label class="chk" style="color:inherit;margin-right:8px"><input type="checkbox" data-ppkind="' + k[0] + '"' + (f.kinds.indexOf(k[0]) >= 0 ? " checked" : "") + "> " + k[1] + "</label>"; }).join("") + "</span>"
      + "</div>"
      + '<div><div class="hint" style="margin-bottom:3px">Styles on this pod</div><div class="ppSty">'
      + (f.styles.length ? f.styles.map(function (id) { var sn = (p.style_names || []).filter(function (x) { return x.id === id; })[0]; var nm = sn ? sn.name : (S.styleName && S.styleName[id]) || id;
          return '<span' + (sn && sn.missing ? ' class="miss" title="This style is no longer in bitGen"' : "") + ">" + esc(nm) + '<button type="button" data-ppsrm="' + esc(id) + '" aria-label="Remove ' + esc(nm) + '" title="Take it off the preset">✕</button></span>'; }).join("") : '<span class="hint" style="border:0">none yet</span>')
      + '</div><div class="rowbtns" style="align-items:center;margin-top:4px"><select data-ppsadd style="width:auto;min-width:180px"><option value="">＋ Add a style…</option></select></div></div>'
      + '<div class="rowbtns"><button type="button" data-ppsave' + (dirty(f, p) ? "" : " disabled") + '>💾 Save changes</button><button type="button" class="ghost" data-ppundo' + (dirty(f, p) ? "" : " disabled") + ">Undo</button>"
      + '<span class="hint">Styles change on a running pod at once; the GPU, template and disks the next time the pod is made.</span></div>'
      + stepsHtml(p)
      + '<div class="ppRun"><span class="k">Pod</span><span>' + (pod ? esc(pod.name) + " · " + esc(pod.id) + " · " + esc(String(pod.status || "").toLowerCase()) : p.pod_id ? "terminated (" + esc(p.pod_id) + ")" : "not made yet") + "</span>"
      + '<span class="k">Cost / hour</span><span>' + (pod && pod.cost_hr ? money(pod.cost_hr, "/h") : "-") + "</span>"
      + '<span class="k">Hours used</span><span data-pphours>' + esc(hoursText(p.hours)) + "</span>"
      + '<span class="k">Total cost</span><span data-pptotal>' + money(p.total_usd) + (p.bill_month ? ' <span class="hint">(RunPod\'s bill this month: ' + money(p.bill_month) + ")</span>" : "") + "</span></div>"
      + "</div></div>";
    return h;
  }
  function paint() {
    var host = S.host; if (!host) return;
    var keep = doc.activeElement && host.contains(doc.activeElement) && doc.activeElement.matches("input[type=text],input[type=number]") ? { sel: doc.activeElement.closest("[data-pp]") && doc.activeElement.closest("[data-pp]").dataset.pp, f: doc.activeElement.dataset.ppf } : null;
    if (keep) return;   // typing in a field - the next refresh paints it
    host.innerHTML = '<div class="rowbtns" style="align-items:center"><button type="button" class="ghost" data-ppnew>＋ New preset</button><span class="hint ppMsgTop" style="flex:1">'
      + esc(S.err ? S.err : S.list.length + " preset" + (S.list.length === 1 ? "" : "s") + " in runpod/pods/presets") + "</span></div>"
      + '<div class="ppList">' + (S.list.length ? S.list.map(itemHtml).join("") : '<div class="hint">No presets yet. 💾 Save as preset on a pod in 🖥 My pods, ＋ New preset, or create a pod for a style - it is kept here.</div>') + "</div>";
    wire();
  }
  function say(name, t, bad) { S.msg[name] = { t: t, bad: !!bad, ok: !bad && !!t }; var it = S.host && S.host.querySelector('[data-pp="' + cssq(name) + '"] .ppMsg'); if (it) { it.textContent = t; it.className = "ppMsg" + (bad ? " bad" : t ? " ok" : ""); } }
  function cssq(s) { return String(s).replace(/["\\]/g, "\\$&"); }
  function play(p, gpu) {
    say(p.name, "starting…");
    send("POST", u(p.name) + "/play", gpu ? { gpu: gpu } : {}).then(function (r) {
      if (r.error) { say(p.name, r.error, true); return; }
      if (r.need_gpu) { S.need[p.name] = r; S.open[p.name] = true; say(p.name, ""); paint(); return; }
      delete S.need[p.name];
      say(p.name, r.state === "creating" ? "▶ making the pod again - then every style's files go on it" : r.state === "running" ? "it is running" : "▶ starting the pod");
      S.open[p.name] = true; load();
    }).catch(function (e) { say(p.name, String(e), true); });
  }
  function fill(it, p) {
    var f = formOf(p);
    loadAux().then(function (a) {
      var tsel = it.querySelector('[data-ppf="template_id"]');
      if (tsel) { var tl = a[0]; if (!tl.some(function (t) { return t.id === f.template_id; }) && f.template_id) tl = [{ id: f.template_id, name: f.template_name || f.template_id }].concat(tl);
        tsel.innerHTML = tl.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === f.template_id ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join(""); }
      var add = it.querySelector("[data-ppsadd]"); S.styleName = {};
      a[1].forEach(function (s) { S.styleName[s.id] = s.name; });
      if (add) add.innerHTML = '<option value="">＋ Add a style…</option>' + a[1].filter(function (s) { return f.styles.indexOf(s.id) < 0; }).map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>"; }).join("");
    });
    gpusOf(f.cloud).then(function (gl) {
      var g = it.querySelector('[data-ppf="gpu"]'); if (!g) return;
      var l = gl.slice(); if (f.gpu && !l.some(function (x) { return x.id === f.gpu; })) l.unshift({ id: f.gpu, name: f.gpu_name || f.gpu, memory: 0, price: 0, offered: false });
      g.innerHTML = l.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === f.gpu ? " selected" : "") + ">" + esc(x.name) + (x.memory ? " · " + x.memory + " GB" : "") + (x.price ? " · " + esc(root.H3Money ? H3Money.usd(x.price, "/h") : "$" + x.price + "/h") : "") + (x.offered ? "" : " · none free now") + "</option>"; }).join("");
    });
  }
  function wire() {
    var host = S.host;
    var nw = host.querySelector("[data-ppnew]"); if (nw) nw.onclick = newPreset;
    host.querySelectorAll("[data-pp]").forEach(function (it) {
      var name = it.dataset.pp, p = S.list.filter(function (x) { return x.name === name; })[0]; if (!p) return;
      var f = formOf(p), re = function () { paint(); };
      it.querySelector(".ppTog").onclick = function () { S.open[name] = !S.open[name]; paint(); };
      it.querySelector("[data-ppplay]").onclick = function () { play(p); };
      it.querySelector("[data-ppstop]").onclick = function () { say(name, "stopping…"); send("POST", u(name) + "/stop").then(function (r) { say(name, r.error || "⏹ stopped - the GPU charge ended; /workspace stays", !!r.error); load(); }); };
      it.querySelector("[data-ppkill]").onclick = function () { S.ask[name] = S.ask[name] === "kill" ? null : "kill"; re(); };
      it.querySelector("[data-ppdel]").onclick = function () { S.ask[name] = S.ask[name] === "del" ? null : "del"; re(); };
      var y = it.querySelector("[data-ppyes]");
      if (y) y.onclick = function () {
        var a = S.ask[name]; S.ask[name] = null;
        if (a === "kill") send("POST", u(name) + "/terminate").then(function (r) { say(name, r.error || "🗑 the pod is terminated - no more charges; ▶ makes it again", !!r.error); load(); });
        else send("DELETE", u(name)).then(function (r) { if (r.error) { say(name, r.error, true); return; } delete S.edit[name]; delete S.open[name]; load(); });
      };
      var no = it.querySelector("[data-ppno]"); if (no) no.onclick = function () { S.ask[name] = null; re(); };
      var ng = it.querySelector("[data-ppneedgo]"); if (ng) ng.onclick = function () { var g = it.querySelector("[data-ppneed]").value; delete S.need[name]; delete S.edit[name]; play(p, g); };
      var nn = it.querySelector("[data-ppneedno]"); if (nn) nn.onclick = function () { delete S.need[name]; re(); };
      if (!S.open[name]) return;
      fill(it, p);
      var mark = function () { var d = dirty(f, p); it.querySelector("[data-ppsave]").disabled = !d; it.querySelector("[data-ppundo]").disabled = !d; };
      it.querySelectorAll("[data-ppf]").forEach(function (el) {
        var k = el.dataset.ppf;
        el.oninput = el.onchange = function () {
          if (k === "count" || k === "disk" || k === "volume") f[k] = parseInt(el.value, 10) || 0;
          else if (k === "cuda") f.cuda = el.checked ? (f.cuda_was || "13.0") : "";
          else f[k] = el.value;
          if (k === "template_id") f.template_name = el.selectedOptions[0] ? el.selectedOptions[0].textContent : "";
          if (k === "gpu") f.gpu_name = el.selectedOptions[0] ? el.selectedOptions[0].textContent.split(" · ")[0] : "";
          if (k === "cloud" && el.type !== "text") { fill(it, p); }
          mark();
        };
      });
      it.querySelectorAll("[data-ppkind]").forEach(function (c) { c.onchange = function () { var k = c.dataset.ppkind; f.kinds = f.kinds.filter(function (x) { return x !== k; }); if (c.checked) f.kinds.push(k); mark(); }; });
      it.querySelectorAll("[data-ppsrm]").forEach(function (b) { b.onclick = function () { var id = b.dataset.ppsrm; f.styles = f.styles.filter(function (x) { return x !== id; }); re(); }; });
      var add = it.querySelector("[data-ppsadd]"); if (add) add.onchange = function () { if (add.value && f.styles.indexOf(add.value) < 0) f.styles.push(add.value); re(); };
      it.querySelector("[data-ppundo]").onclick = function () { delete S.edit[name]; re(); };
      it.querySelector("[data-ppsave]").onclick = function () {
        say(name, "saving…");
        send("POST", "/api/podpresets", { was: name, preset: f }).then(function (r) {
          if (r.error) { say(name, r.error, true); return; }
          delete S.edit[name]; if (r.name !== name) { S.open[r.name] = true; delete S.open[name]; S.msg[r.name] = { t: "✓ saved", ok: true }; } else say(name, "✓ saved");
          load();
        });
      };
    });
  }
  function cuOf(img) { var s = String(img || ""), m = /cuda[-_]?(\d{2})\.(\d)/i.exec(s) || /[-_:]cu(\d{2})(\d)\d?(?=[-_.]|$)/i.exec(s); return m ? m[1] + "." + m[2] : ""; }   // = lib/podInstall.js cudaOf
  function newPreset() {
    var n = "Preset " + (S.list.length + 1), taken = S.list.map(function (p) { return p.name; }), k = S.list.length + 1;
    while (taken.indexOf(n) >= 0) n = "Preset " + (++k);
    Promise.all([loadAux(), gpusOf("SECURE")]).then(function (a) {
      // 2.772.0: RunPod's PyTorch template first (CUDA 12.8) - bitGen installs ComfyUI on it (lib/podInstall.js); else ComfyUI CUDA 13
      var pt = a[0][0].filter(function (x) { return !x.comfy && /^runpod\/pytorch:/i.test(x.image || "") && /^12\.[89]$/.test(cuOf(x.image)); })[0];
      var t = pt || a[0][0].filter(function (x) { return /cuda[\s_-]*13/i.test(x.name + " " + (x.image || "")); })[0] || a[0][0][0] || {};
      var g = a[1].filter(function (x) { return x.offered && x.memory >= 24; }).sort(function (x, y) { return x.price - y.price; })[0] || {};
      return send("POST", "/api/podpresets", { preset: { name: n, template_id: t.id || "", template_name: t.name || "", gpu: g.id || "", gpu_name: g.name || "", count: 1, cloud: "SECURE", disk: 50, volume: 100, cuda: pt ? cuOf(t.image) : /cuda[\s_-]*13/i.test(t.name || "") ? "13.0" : "", kinds: [], styles: [] } });
    }).then(function (r) { if (r && r.error) { var m = S.host.querySelector(".ppMsgTop"); if (m) m.textContent = r.error; return; } S.open[n] = true; load(); });
  }
  /** the tab shows in `host` */
  function show(host) { css(); S.host = host; paint(); return load(); }
  function hide() { root.clearTimeout(S.timer); }
  root.H3PodPresets = Object.assign({ show: show, hide: hide, load: load, state: function () { return S; }, count: function () { return S.list.length; } }, api);
})(typeof window !== "undefined" ? window : globalThis);
