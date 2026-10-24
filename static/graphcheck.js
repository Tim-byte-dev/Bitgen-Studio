/* bitGen Studio — static/graphcheck.js (2.587.0): Settings ▸ ComfyUI ▸ Graphs - ⤒ IMPORT & CHECK a ComfyUI workflow,
 * the inputs it takes, and THE PICTURE OF THE GRAPH (window.H3GraphCheck - routes/graphCheck.js, lib/graphCheck.js).
 * Tim: "in settings -comfyui- graph can we add total number of input images,videos,audio and allow user to import a
 * comfy graph, bitgen checks the graph and adds the image/video/audio inputs as needed and saves the output and reports
 * missing nodes ... bitgen will do a run of the workflow and if successful it will save it to workflows if unsuccessful
 * it will report the errors" + "show the graph in the settings-comfyui-graph tab when file is imported".
 *   ⤒ Import & check…  a saved (UI) workflow or an API prompt: the check (inputs, the output - a preview made a save -,
 *                      missing nodes, missing model files, the controls it gets: Prompt / Negative / Seed / Steps / CFG /
 *                      Width / Height / Length), the graph drawn; ▶ Test run (a queue job with a test picture / sound /
 *                      video) -> worked = saved into comfy_workflows/ + a graph binding (picked in the tab, Generate ▸
 *                      ⚙ Graph runs it); failed = ComfyUI's errors, nothing saved.
 *   A workflow loaded in the tab (↻ Load / 📁 File / a graph picked): its inputs (🖼 · 🎞 · 🔊) and its picture.
 * Pure (scripts/test-graphcheck587.js): fit(nodes), mediaWords(counts), curve(a, b). */
(function (root) {
  "use strict";
  function fit(nodes, pad) {
    if (!nodes || !nodes.length) return { x: 0, y: 0, w: 400, h: 200 };
    var p = pad == null ? 40 : pad, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    nodes.forEach(function (n) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h); });
    return { x: x0 - p, y: y0 - p, w: Math.max(200, x1 - x0 + 2 * p), h: Math.max(120, y1 - y0 + 2 * p) };
  }
  function mediaWords(c) {
    var m = c || {}, n = function (k) { return +m[k] || 0; };
    return "🖼 " + n("images") + " picture" + (n("images") === 1 ? "" : "s") + " · 🎞 " + n("videos") + " video" + (n("videos") === 1 ? "" : "s") + " · 🔊 " + n("audio") + " sound" + (n("audio") === 1 ? "" : "s");
  }
  function curve(a, b) {
    var x0 = a.x + a.w, y0 = a.y + Math.min(30, a.h / 2), x1 = b.x, y1 = b.y + Math.min(30, b.h / 2), dx = Math.max(40, Math.abs(x1 - x0) / 2);
    return "M" + x0 + " " + y0 + " C" + (x0 + dx) + " " + y0 + " " + (x1 - dx) + " " + y1 + " " + x1 + " " + y1;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { fit: fit, mediaWords: mediaWords, curve: curve }; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var S = { token: "", res: null, timer: null, vb: null, viewOf: "" };
  var COL = { image: "#4c8fd6", video: "#9a6bd6", audio: "#2fa59a", output: "#5fae5f", missing: "#d65c5c", model: "#d6a23c", fixed: "#5fae5f", bypassed: "#666" };
  var CSS = "#gcBox{border:1px solid var(--line,#3a352e);border-radius:8px;padding:8px 10px;margin:0 0 10px}#gcBox h4{margin:0 0 6px;font-size:12.5px}"
    + "#gcBox .gcl{font-size:11.5px;margin:3px 0}#gcBox .bad{color:#e66}#gcBox .warn{color:#d6a23c}#gcBox .ok{color:#7c7}#gcBox .k{opacity:.7}"
    + "#gcView{position:relative;height:340px;border:1px solid var(--line,#3a352e);border-radius:6px;background:var(--bg,#151310);overflow:hidden;margin-top:6px;cursor:grab}"
    + "#gcView svg{width:100%;height:100%;display:block}#gcView .gcn rect{fill:var(--panel,#221e19);stroke:#555;stroke-width:1.5}#gcView .gcn text{fill:var(--text,#ddd);font:13px system-ui,sans-serif}"
    + "#gcView .gcn .ty{fill:var(--dim,#999);font-size:11px}#gcView path{fill:none;stroke:#7a7466;stroke-width:2;opacity:.75}"
    + "#gcLeg{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;margin-top:4px}#gcLeg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle}"
    + "#gcViewBar{position:absolute;right:6px;top:6px;display:flex;gap:4px}#gcViewBar button{font-size:11px;padding:1px 6px}#gcCap{position:absolute;left:8px;top:6px;font-size:11px;opacity:.75}";

  function boot() {
    var tab = $("ctab-graphs"); if (!tab || $("gcBox")) return !!tab;
    var st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);
    var box = doc.createElement("div"); box.id = "gcBox";
    box.innerHTML = '<h4>⤒ Import a ComfyUI workflow - bitGen checks it, test-runs it and saves it when it works</h4>'
      + '<div class="rowbtns" style="align-items:center"><button class="ghost" type="button" id="gcImport" title="A workflow saved from ComfyUI (Workflow ▸ Save / Export) or an API export (.json)">⤒ Import & check…</button>'
      + '<input type="file" id="gcFile" accept=".json,application/json" class="hidden"><span class="hint" id="gcCounts" style="flex:1"></span></div>'
      // 2.588.0: SolarRenderer's own workflows (Settings ▸ Add-ons ▸ SolarRenderer puts its node pack in custom_nodes)
      + '<div class="rowbtns" id="gcSolar" style="align-items:center"><span class="hint">☀ SolarRenderer</span><select id="gcSolarSel" aria-label="SolarRenderer workflow" hidden></select>'
      + '<button class="ghost" type="button" id="gcSolarGo" hidden title="The pack\'s workflow through ⤒ Import & check - its inputs counted, a test run, saved as a workflow when it works">⤒ Import & check</button><span class="hint" id="gcSolarHint"></span></div>'
      + '<div id="gcReport"></div>'
      + '<div id="gcView"><span id="gcCap"></span><div id="gcViewBar"><button class="ghost" type="button" id="gcFit" title="Fit the whole graph">⤢ Fit</button></div><svg id="gcSvg" xmlns="http://www.w3.org/2000/svg"></svg></div>'
      + '<div id="gcLeg">' + [["image", "picture input"], ["video", "video input"], ["audio", "sound input"], ["output", "saves the output"], ["missing", "node ComfyUI does not have"], ["model", "model file missing"], ["bypassed", "bypassed"]].map(function (x) { return "<span><i style=\"background:" + COL[x[0]] + "\"></i>" + x[1] + "</span>"; }).join("") + "</div>";
    var hint = tab.querySelector("p.hint"); if (hint) hint.after(box); else tab.prepend(box);
    $("gcImport").onclick = function () { $("gcFile").value = ""; $("gcFile").click(); };
    $("gcFile").onchange = function () { var f = this.files && this.files[0]; if (f) importFile(f); };
    $("gcFit").onclick = function () { if (S.view) { S.vb = fit(S.view.nodes); setVb(); } };
    wirePanZoom();
    solarBoot();
    // a workflow loaded in the tab (↻ Load / 📁 File / a graph picked): its inputs + its picture - an import's report
    // goes, unless it is the import just saved being picked (adopt)
    root.addEventListener("h3:graph-analyzed", function (e) {
      var f = e.detail && e.detail.file; if (!f) return;
      if (!S.adopting) { S.token = ""; clearTimeout(S.timer); var rep = $("gcReport"); if (rep) rep.innerHTML = ""; }
      showFile(f);
    });
    paintView(null, "");
    return true;
  }

  /* ---------------- the picture */
  function paintView(v, cap) {
    S.view = v; var svg = $("gcSvg"); if (!svg) return;
    $("gcCap").textContent = cap || (v ? "" : "import or load a workflow to see its graph");
    if (!v || !v.nodes || !v.nodes.length) { svg.innerHTML = ""; return; }
    var by = {}; v.nodes.forEach(function (n) { by[n.id] = n; });
    var h = '<g id="gcLinks">' + (v.links || []).map(function (l) { var a = by[l.from], b = by[l.to]; return a && b ? '<path d="' + curve(a, b) + '"/>' : ""; }).join("") + "</g>";
    h += v.nodes.map(function (n) {
      var t = n.tags || [], c = t.indexOf("missing") >= 0 ? COL.missing : t.indexOf("model") >= 0 ? COL.model : t.indexOf("image") >= 0 ? COL.image : t.indexOf("video") >= 0 ? COL.video : t.indexOf("audio") >= 0 ? COL.audio : t.indexOf("output") >= 0 ? COL.output : "";
      var dim = t.indexOf("bypassed") >= 0;
      return '<g class="gcn" data-id="' + esc(n.id) + '" transform="translate(' + n.x + "," + n.y + ')"' + (dim ? ' opacity=".45"' : "") + "><title>" + esc(n.type + " (node " + n.id + ")" + (t.length ? " - " + t.join(", ") : "")) + "</title>"
        + '<rect width="' + n.w + '" height="' + n.h + '" rx="7"' + (c ? ' style="stroke:' + c + ";stroke-width:3" + (t.indexOf("fixed") >= 0 ? ";stroke-dasharray:6 4" : "") + '"' : "") + "/>"
        + '<rect width="' + n.w + '" height="24" rx="7" style="fill:' + (c || "#3a352e") + ';opacity:.35;stroke:none"/>'
        + '<text x="8" y="17">' + esc(String(n.title).slice(0, Math.max(8, Math.floor(n.w / 8)))) + "</text>"
        + (n.title !== n.type ? '<text class="ty" x="8" y="40">' + esc(String(n.type).slice(0, Math.floor(n.w / 7))) + "</text>" : "") + "</g>";
    }).join("");
    svg.innerHTML = h;
    S.vb = fit(v.nodes); setVb();
  }
  function setVb() { var svg = $("gcSvg"); if (svg && S.vb) svg.setAttribute("viewBox", [S.vb.x, S.vb.y, S.vb.w, S.vb.h].map(function (x) { return Math.round(x); }).join(" ")); }
  function wirePanZoom() {
    var host = $("gcView"), drag = null;
    host.addEventListener("wheel", function (e) {
      if (!S.vb) return; e.preventDefault();
      var r = host.getBoundingClientRect(), k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      var nw = S.vb.w * k, nh = S.vb.h * k;
      S.vb = { x: S.vb.x + (S.vb.w - nw) * fx, y: S.vb.y + (S.vb.h - nh) * fy, w: nw, h: nh }; setVb();
    }, { passive: false });
    host.addEventListener("mousedown", function (e) { if (e.target.closest("button") || !S.vb) return; drag = { x: e.clientX, y: e.clientY, vb: Object.assign({}, S.vb) }; host.style.cursor = "grabbing"; });
    root.addEventListener("mousemove", function (e) { if (!drag) return; var r = host.getBoundingClientRect(); S.vb = Object.assign({}, drag.vb, { x: drag.vb.x - (e.clientX - drag.x) * drag.vb.w / r.width, y: drag.vb.y - (e.clientY - drag.y) * drag.vb.h / r.height }); setVb(); });
    root.addEventListener("mouseup", function () { drag = null; host.style.cursor = ""; });
  }

  /* ---------------- a workflow loaded in the tab */
  function showFile(file) {
    S.viewOf = file;
    return fetch("/api/graphs/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: file }) }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error || S.viewOf !== file) return;
      $("gcCounts").textContent = file.replace(/^comfy_workflows\//, "") + " takes " + mediaWords(j.counts) + (j.outputs && j.outputs.length ? " · saves: " + j.outputs.map(function (o) { return o.class_type; }).join(", ") : "");
      paintView(j.view, file.replace(/^comfy_workflows\//, ""));
    }).catch(function () { /* the view is a convenience */ });
  }

  /* ---------------- ☀ SolarRenderer (2.588.0): the pack's workflows, imported like a file */
  function solarBoot() {
    return fetch("/api/solar").then(function (r) { return r.json(); }).then(function (j) {
      var wf = (j && j.workflows) || [], sel = $("gcSolarSel"), go = $("gcSolarGo"), hint = $("gcSolarHint");
      if (!sel) return j;
      sel.innerHTML = wf.map(function (w) { return '<option value="' + esc(w.file) + '">' + esc(w.name) + "</option>"; }).join("");
      sel.hidden = go.hidden = !wf.length;
      hint.textContent = wf.length ? "the node pack's workflows - a structure video (+ a first frame) and the six-part prompt -> the clip in 4 steps"
        : j && j.pack ? "the node pack has no workflows/*.json" : "Settings ▸ Add-ons ▸ SolarRenderer installs its node pack and LoRAs, then its workflows are here";
      go.onclick = function () { solarImport(sel.value); };
      return j;
    }).catch(function () { var h = $("gcSolarHint"); if (h) h.textContent = "Settings ▸ Add-ons ▸ SolarRenderer"; });
  }
  function solarImport(file) {
    return fetch("/api/solar/workflow?file=" + encodeURIComponent(file)).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) { $("gcReport").innerHTML = '<div class="gcl bad">✗ ' + esc(j.error) + "</div>"; return j; }
      var txt = JSON.stringify(j.graph);
      return importFile({ name: j.name + ".json", text: function () { return Promise.resolve(txt); } });
    });
  }

  /* ---------------- ⤒ Import & check */
  function importFile(f) {
    S.token = ""; clearTimeout(S.timer);
    var rep = $("gcReport"); rep.innerHTML = '<div class="gcl k">reading ' + esc(f.name) + "…</div>";
    return f.text().then(function (txt) {
      var g; try { g = JSON.parse(txt); } catch (e) { rep.innerHTML = '<div class="gcl bad">' + esc(f.name) + " is not a workflow (JSON): " + esc(e.message) + "</div>"; return null; }
      rep.innerHTML = '<div class="gcl k">checking ' + esc(f.name) + " against ComfyUI…</div>";
      return fetch("/api/graphs/check", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ graph: g, name: f.name }) }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.view) paintView(j.view, f.name);
        if (j.counts) $("gcCounts").textContent = f.name + " takes " + mediaWords(j.counts);
        if (j.error) { rep.innerHTML = '<div class="gcl bad">✗ ' + esc(j.error) + "</div>"; return j; }
        S.token = j.token; S.res = j; paintReport(); return j;
      });
    });
  }
  function paintReport(test) {
    var j = S.res, r = j.report, rep = $("gcReport");
    var line = function (cls, t) { return '<div class="gcl ' + cls + '">' + t + "</div>"; };
    var h = '<div class="rowbtns" style="align-items:end;margin:4px 0"><div style="flex:1"><label class="f">Save as</label><input type="text" id="gcName" value="' + esc(j.name) + '"></div>'
      + '<div><label class="f">Shows in</label><select id="gcKind">' + ["any", "image", "video", "music"].map(function (k) { return "<option" + (k === j.kind ? " selected" : "") + ">" + k + "</option>"; }).join("") + "</select></div></div>";
    h += line("", "<b>" + (j.format === "ui" ? "A saved workflow" + (j.converted ? ", read with ComfyUI's node list" : "") : "An API workflow") + "</b> - " + r.node_count + " nodes");
    h += line("", "<b>Inputs:</b> " + mediaWords(r.media) + ' <span class="k">- the reference dock fills them in order; a loader with nothing in the dock is bypassed</span>');
    h += line(r.outputs.length ? "ok" : "bad", "<b>Output:</b> " + (r.outputs.length ? r.outputs.map(function (o) { return esc(o.class_type) + " (node " + esc(o.node) + ")"; }).join(", ") : "none"));
    (r.fixes || []).forEach(function (f) { h += line("ok", "✓ " + esc(f.from) + " (node " + esc(f.node) + ") → " + esc(f.to) + ' <span class="k">' + esc(f.why) + "</span>"); });
    if ((r.missing_nodes || []).length) h += line("bad", "<b>Missing nodes:</b> " + r.missing_nodes.map(esc).join(", ") + ' <span class="k">- install their node packs (ComfyUI-Manager ▸ Install Missing Custom Nodes), restart ComfyUI, import again</span>');
    if ((r.missing_models || []).length) h += line("warn", "<b>Missing model files:</b> " + r.missing_models.map(function (m) { return esc(m.value) + " (" + esc(m.class_type) + ")"; }).join(", "));
    if ((r.controls || []).length) h += line("", "<b>Controls it gets</b> (Basic Settings when the graph is picked): " + r.controls.map(function (c) { return esc(c.label) + (c.source ? ' <span class="k">(' + (c.source === "seed" ? "bitGen's seed" : c.source === "prompt" ? "the prompt box" : "the negative prompt") + ")</span>" : "") + " → " + c.targets.map(function (t) { return t.node + "." + t.input; }).join(", "); }).join(" · "));
    (r.problems || []).forEach(function (p) { h += line("bad", "✗ " + esc(p)); });
    (r.warnings || []).forEach(function (w) { h += line("warn", "! " + esc(w)); });
    var t = test || S.test;
    h += '<div class="rowbtns" style="margin-top:6px;align-items:center"><button type="button" id="gcTest"' + (r.ok && !(t && (t.status === "running" || t.status === "queued")) ? "" : " disabled") + ' title="A queue job: ComfyUI runs the workflow with a test picture / sound / video in every input - if it works, it is saved">▶ Test run</button><span id="gcTestMsg" class="hint" style="flex:1"></span></div>';
    rep.innerHTML = h;
    $("gcTest").onclick = runTest;
    paintTest(t);
  }
  function paintTest(t) {
    var m = $("gcTestMsg"); if (!m) return;
    S.test = t;
    if (!t) { m.textContent = S.res.report.ok ? "ComfyUI runs it once with test inputs - if it works it is saved into comfy_workflows/ and the Graph list" : "fix the problems above, then import again"; return; }
    if (t.status === "queued" || t.status === "running") { m.innerHTML = "⏳ " + esc(t.status) + "… " + esc((t.log || []).slice(-1)[0] || ""); return; }
    if (t.status === "done") {
      m.innerHTML = t.saved ? '<span class="ok">✓ it worked (' + esc(t.output || "") + ') - saved as ' + esc(t.saved.file) + (t.saved.graph ? " + the graph “" + esc(t.saved.graph.name) + "” - Generate ▸ ⚙ Graph runs it" : "") + "</span>" : '<span class="ok">✓ it worked - saving…</span>';
      return;
    }
    m.innerHTML = '<span class="bad">✗ the test run ' + esc(t.status) + " - not saved:</span><br>" + (t.errors || []).map(function (e) { return '<span class="bad">' + esc(e) + "</span>"; }).join("<br>");
  }
  function runTest() {
    $("gcTest").disabled = true;
    return fetch("/api/graphs/check/" + S.token + "/test", { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) { paintTest({ status: "refused", errors: [j.error] }); $("gcTest").disabled = false; return; }
      paintTest({ status: "queued" }); poll();
      if (typeof root.refreshJobs === "function") root.refreshJobs();
    });
  }
  function poll() {
    clearTimeout(S.timer);
    var tok = S.token;
    fetch("/api/graphs/check/" + tok).then(function (r) { return r.json(); }).then(function (j) {
      if (tok !== S.token) return;
      var t = j.job || { status: "gone", errors: [j.error || "no test job"] };
      if (t.status === "done" && !j.saved) {
        paintTest(t);
        return fetch("/api/graphs/check/" + tok + "/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: ($("gcName") || {}).value || S.res.name, kind: ($("gcKind") || {}).value || S.res.kind }) })
          .then(function (r) { return r.json(); }).then(function (s) {
            if (s.error) { paintTest({ status: "not saved", errors: [s.error] }); return; }
            t.saved = s; paintTest(t); adopt(s);
          });
      }
      if (t.status === "done") { t.saved = j.saved; paintTest(t); $("gcTest").disabled = false; return; }
      paintTest(t);
      if (t.status === "queued" || t.status === "running") S.timer = setTimeout(poll, 1500); else $("gcTest").disabled = false;
    }).catch(function () { S.timer = setTimeout(poll, 3000); });
  }
  /** the saved graph picked in the tab (the binding editor shows its controls) */
  function adopt(s) {
    var p = typeof root.refreshGraphs === "function" ? Promise.resolve(root.refreshGraphs()) : Promise.resolve();
    S.adopting = true;
    return p.then(function () {
      var sel = $("g_sel"); if (sel && s.graph) { sel.value = s.graph.id; sel.dispatchEvent(new Event("change")); }
      setTimeout(function () { S.adopting = false; }, 3000);
      if (typeof root.logLine === "function") root.logLine("[graph] imported + tested: " + s.file + (s.graph ? " - graph “" + s.graph.name + "”" : ""));
    });
  }
  root.H3GraphCheck = { importFile: importFile, solarImport: solarImport, solarBoot: solarBoot, showFile: showFile, state: function () { return S; }, fit: fit, mediaWords: mediaWords };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { if (!boot()) setTimeout(boot, 1500); }); else if (!boot()) setTimeout(boot, 1500);
})(typeof window !== "undefined" ? window : globalThis);
