/* bitGen Studio — static/podload.js (2.758.0): A POD'S LOADING BAR + ITS P_ STYLES (window.H3PodLoad), used by the PODS docker
 * (static/podsdock.js) and the Remote generation docker (static/remotedock.js).
 * Tim (verbatim): "can you show progess of pod loading?" (asked: "Stages + timed bar") + "when pods are chosen only show pod
 * styles, I am trying with this pod ComfyUI - Qwen Image - ZiT - Boogu - Krea , how can i choose the model?" (asked: "Both").
 *   bar(st)            the progress lib/remoteGpu.js podState() sends (lib/podProgress.js): "2/3 ComfyUI starting · 3 min of
 *                      about 7" + a bar (the time against this pod's - or its image's - last load; none = by stage)
 *   styles(host, pod)  🎨 the pod's models (the bitGen style each fits) and its saved workflows, ticked -> Make P_ styles
 *                      (GET /api/pods/:id/comfy, POST /api/pods/:id/styles - lib/podStyles.js)
 * Pure (scripts/test-pods758.js): mins, line. */
(function (root) {
  "use strict";
  var doc = root.document;
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /** seconds -> "40 s" / "3 min" / "1 h 5 min" (pure) */
  function mins(s) { s = Math.max(0, Math.round(+s || 0)); if (s < 60) return s + " s"; var m = Math.round(s / 60); return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"; }
  /** the words under the bar (pure) - each case its own words (the UI translations read them) */
  function line(p) {
    if (!p) return "";
    var n = (p.stage + 1) + "/" + (p.of + 1);
    if (p.stage >= p.of) return p.took ? `pod loaded in ${mins(p.took)}` : "pod loaded";
    var w = p.stage === 0 ? `waiting for a GPU machine` : p.stage === 1 ? `starting the container` : `ComfyUI starting (the template may be downloading its models)`;
    return n + " " + w + " · " + (p.expect ? `${mins(p.elapsed)} of about ${mins(p.expect)}` : `${mins(p.elapsed)} so far`);
  }
  var CSS = ".pdLoad{margin:3px 0 1px;font-size:.7rem;color:var(--dim,#aaa);width:100%}"
    + ".pdLoad .bar{height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;margin:2px 0}"
    + ".pdLoad .bar i{display:block;height:100%;background:var(--tiger,#f59e2c);transition:width .8s ease}"
    + ".pdLoad.done .bar i{background:#5fae5f}"
    + ".pdStyles{border:1px solid var(--line,#3a342a);border-radius:7px;padding:6px 8px;margin:4px 0;font-size:.74rem;width:100%;box-sizing:border-box}"
    + ".pdStyles h5{margin:4px 0 2px;font-size:.72rem;color:var(--dim,#aaa)}.pdStyles label{display:flex;gap:6px;align-items:baseline;margin:1px 0}"
    + ".pdStyles .fit{color:var(--dim,#999)}.pdStyles .no{opacity:.55}.pdStyles .btns{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}";
  function css() { if (doc && !doc.getElementById("pdLoadCss")) { var s = doc.createElement("style"); s.id = "pdLoadCss"; s.textContent = CSS; doc.head.appendChild(s); } }
  /** the bar's HTML for a pod state ({progress}) - "" when there is nothing loading */
  function bar(st) {
    var p = st && st.progress; if (!p) return "";
    css();
    return '<div class="pdLoad' + (p.stage >= p.of ? " done" : "") + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (+p.pct || 0) + '">'
      + '<div class="bar"><i style="width:' + Math.max(2, Math.min(100, +p.pct || 0)) + '%"></i></div><span class="pdLoadT">' + esc(line(p)) + "</span></div>";
  }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  /** 🎨 the panel inside `host` for pod {id, name}, its ComfyUI port */
  function styles(host, pod, port) {
    css();
    host.innerHTML = `<div class="pdStyles"><span class="hint">Reading the pod's ComfyUI…</span></div>`;
    var box = host.firstChild;
    return getj("/api/pods/" + encodeURIComponent(pod.id) + "/comfy" + (port ? "?port=" + port : "")).then(function (c) {
      if (c.error) { box.innerHTML = '<span class="hint" style="color:#e88">' + esc(c.error) + "</span>"; return c; }
      var known = c.known || [], wfs = c.workflows || [];
      var h = `<h5>The pod's models</h5>`;
      h += known.length ? known.map(function (k) {
        return '<label class="' + (k.starter ? "" : "no") + '"><input type="checkbox" data-pm="' + esc(k.file) + '"' + (k.starter ? " checked" : " disabled") + "> " + esc(k.file)
          + ' <span class="fit">' + (k.starter ? "→ " + esc(k.starter) : `bitGen has no workflow for it - use a workflow below`) + "</span></label>";
      }).join("") : `<span class="hint">No model files found on the pod yet - a template may still be downloading them.</span>`;
      h += `<h5>The pod's saved workflows</h5>`;
      h += wfs.length ? wfs.map(function (w) { return '<label><input type="checkbox" data-pw="' + esc(w) + '" checked> ' + esc(w) + "</label>"; }).join("")
        : `<span class="hint">No workflows saved in the pod's ComfyUI.</span>`;
      h += `<div class="btns"><button type="button" data-pmake>🎨 Make P_ styles</button><button type="button" class="ghost" data-pclose>Close</button></div><div class="hint" data-pmsg aria-live="polite"></div>`;
      box.innerHTML = h;
      box.querySelector("[data-pclose]").onclick = function () { host.innerHTML = ""; };
      box.querySelector("[data-pmake]").onclick = function () {
        var ms = [].slice.call(box.querySelectorAll("[data-pm]:checked")).map(function (i) { return i.getAttribute("data-pm"); });
        var ws = [].slice.call(box.querySelectorAll("[data-pw]:checked")).map(function (i) { return i.getAttribute("data-pw"); });
        var msg = box.querySelector("[data-pmsg]");
        if (!ms.length && !ws.length) { msg.textContent = `Tick a model or a workflow first.`; return; }
        msg.textContent = `Making the styles…`;
        post("/api/pods/" + encodeURIComponent(pod.id) + "/styles", { models: ms, workflows: ws, pod_name: pod.name || "", port: port || 0 }).then(function (r) {
          if (r.error) { msg.style.color = "#e88"; msg.textContent = r.error; return; }
          msg.style.color = "";
          msg.textContent = (r.made.length ? `Made: ${r.made.join(", ")}.` : `No styles made.`)
            + (r.skipped.length ? " " + `Skipped: ${r.skipped.map(function (s) { return s.what + " (" + s.why + ")"; }).join("; ")}` : "");
          try { if (typeof root.refreshStyles === "function") root.refreshStyles(); } catch (e) { /* fine */ }
          try { doc.dispatchEvent(new Event("h3:rgpu")); } catch (e) { /* fine */ }
        });
      };
      return c;
    }).catch(function (e) { box.innerHTML = '<span class="hint" style="color:#e88">' + esc(e.message || e) + "</span>"; });
  }
  /* Tim (verbatim): "use overide settings when pods load but disable checkpoints and lora loader, overide settings will be
     for step, seed and cfg and the size and aspect ratio" - with a P_ style picked, Basic Settings' checkpoint / model box
     and its LoRA rows are switched off (the pod's own are used; the server leaves them out too - routes/index.js), and
     picking RunPod ▸ Pods ticks Override style so its steps / seed / CFG / size / aspect go with the render. */
  // 2.762.0: Basic Settings' checkpoint is open again on a P_ style - it is sent to the pod once and used there
  var LOCKS = { image: ["imgLoras", "tliRows"], video: ["vidModel", "tlvRows"] };
  function isPod(selId) { var s = doc.getElementById(selId), o = s && s.options && s.options[s.selectedIndex]; return !!(o && /^P_/.test(String(o.textContent || "").trim())); }
  function lockBasics() {
    var want = { image: isPod("styleSel"), video: isPod("videoStyleSel") };
    Object.keys(LOCKS).forEach(function (k) {
      LOCKS[k].forEach(function (id) {
        var el = doc.getElementById(id); if (!el) return;
        var list = el.matches && el.matches("input,select,button,textarea") ? [el] : [].slice.call(el.querySelectorAll("input,select,button,textarea"));
        list.forEach(function (x) { if (want[k]) { if (!x.disabled) { x.disabled = true; x.setAttribute("data-podlock", "1"); } } else if (x.getAttribute("data-podlock")) { x.disabled = false; x.removeAttribute("data-podlock"); } });
        var note = doc.getElementById(id + "PodNote");
        if (want[k] && !note) { note = doc.createElement("div"); note.id = id + "PodNote"; note.className = "hint"; note.textContent = k === "image" ? `A P_ pod style: the pod's own LoRAs are used. A checkpoint picked below is sent to the pod once (unless it has it) and used there.` : `A P_ pod style: the pod's own model and LoRAs are used.`; (el.parentNode || el).insertBefore(note, el.nextSibling); }
        if (!want[k] && note) note.remove();
      });
    });
    return want;
  }
  if (doc && doc.addEventListener) {
    doc.addEventListener("change", function (e) {
      var t = e.target || {};
      if (t.id === "styleSel" || t.id === "videoStyleSel") lockBasics();
      if (t.name === "gpuRunpod" && t.value === "pods" && t.checked) {
        var o = doc.getElementById("ovrStyle");
        if (o && !o.checked) { o.checked = true; o.dispatchEvent(new Event("change", { bubbles: true })); }
      }
    });
    doc.addEventListener("h3:rgpu", function () { setTimeout(lockBasics, 600); });
    // the lists are filled (and refilled) after start: watch them
    var watchSel = function () {
      ["styleSel", "videoStyleSel"].forEach(function (id) {
        var el = doc.getElementById(id);
        if (el && !el._podObs && root.MutationObserver) { el._podObs = new MutationObserver(function () { lockBasics(); }); el._podObs.observe(el, { childList: true }); }
      });
      lockBasics();
    };
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", watchSel); else setTimeout(watchSel, 0);
  }
  /* 2.759.0 (Tim: "if i select a pod, how do i choose what model comfyui template to use and to dl it?"): ⬇ Models - a
     bitGen style's files (or single files from bitGen's download list) downloaded into the pod's ComfyUI through its
     ComfyUI-Manager (its own list only) or its Jupyter (any file; bitGen's own password on pods it creates, else pasted) */
  function gb(n) { n = +n || 0; return n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : n >= 1e6 ? Math.round(n / 1e6) + " MB" : n ? Math.round(n / 1e3) + " KB" : ""; }
  function models(host, pod, port) {
    css();
    var q = port ? "?port=" + port : "";
    host.innerHTML = `<div class="pdStyles"><span class="hint">Asking the pod how files can reach it…</span></div>`;
    var box = host.firstChild, S = { files: [], timer: null };
    function stop() { if (S.timer) { clearTimeout(S.timer); S.timer = null; } }
    function paintState(st) {
      var el = box.querySelector("[data-pmprog]"); if (!el) return;
      el.innerHTML = (st.files || []).map(function (f) {
        var pct = f.size ? Math.min(100, Math.round(f.done / f.size * 100)) : (f.state === "done" ? 100 : 0);
        return '<div class="pdLoad' + (/done|there already/.test(f.state) ? " done" : "") + '"><div class="bar"><i style="width:' + Math.max(2, pct) + '%"></i></div><span>' + esc(f.name) + " · " + esc(f.state) + (f.size ? " · " + gb(f.done) + " of " + gb(f.size) : "") + "</span></div>";
      }).join("") + (st.running ? "" : (st.files || []).length ? `<div class="btns"><button type="button" data-pmsty>🎨 Make P_ styles from the pod</button></div>` : "");
      var b = el.querySelector("[data-pmsty]"); if (b) b.onclick = function () { stop(); styles(host, pod, port); };
      if (st.kept === false) el.insertAdjacentHTML("beforeend", `<div class="hint">ComfyUI on this pod is not under /workspace - the files go when the pod stops.</div>`);
    }
    function poll() { getj("/api/pods/" + encodeURIComponent(pod.id) + "/models" + q).then(function (st) { if (!st.error) paintState(st); if (st.running) S.timer = setTimeout(poll, +(root.H3_POD_POLL || 3000)); }).catch(function () { S.timer = setTimeout(poll, 5000); }); }
    return Promise.all([getj("/api/pods/" + encodeURIComponent(pod.id) + "/ways" + q), getj("/api/styles?kind=image"), getj("/api/pods/catalog")]).then(function (a) {
      var w = a[0] || {}, sts = ((a[1] || {}).styles || []).filter(function (x) { return x.runs_on !== "api" && x.runs_on !== "pod"; }), cat = (a[2] || {}).files || [];
      if (w.error) { box.innerHTML = '<span class="hint" style="color:#e88">' + esc(w.error) + "</span>"; return; }
      var how = w.jupyter ? `Downloads go through the pod's Jupyter - any file.` : w.manager ? `Downloads go through ComfyUI-Manager - only the models in its own list. Paste the pod's Jupyter password to fetch any file.` : `This pod has no ComfyUI-Manager - paste its Jupyter password (RunPod ▸ the pod ▸ Connect) to download onto it.`;
      var h = `<h5>Download models onto the pod</h5><div class="hint">${how}</div>`;
      if (!w.jupyter) h += `<div class="btns"><input type="password" data-pmpw autocomplete="off" placeholder="The pod's Jupyter password" style="flex:1;min-width:140px"><button type="button" class="ghost" data-pmpwgo>Use it</button></div>`;
      h += `<h5>For a style</h5><select data-pmstyle><option value="">— pick a bitGen style —</option>` + sts.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + "</option>"; }).join("") + "</select>";
      h += `<h5>Files</h5><input type="search" data-pmq placeholder="Search bitGen's download list" style="width:100%"><div data-pmlist style="max-height:220px;overflow:auto"></div>`;
      h += `<div class="btns"><button type="button" data-pmgo>⬇ Download ticked</button><button type="button" class="ghost" data-pclose>Close</button></div>`;
      // + Tim: "add mounting the model in the pod from the hdd or link?" - one file from a link or from this computer (needs Jupyter)
      h += `<h5>A file from a link or from this computer</h5><div class="btns"><select data-pmfold title="The ComfyUI models folder it goes in">`
        + ["checkpoints", "diffusion_models", "unet", "loras", "vae", "text_encoders", "clip", "clip_vision", "controlnet", "upscale_models", "embeddings"].map(function (f) { return '<option value="' + f + '"' + (f === "loras" ? " selected" : "") + ">" + f + "</option>"; }).join("")
        + `</select><input type="text" data-pmlink placeholder="A link to the file (Civitai, Hugging Face, any web address)" spellcheck="false" style="flex:1;min-width:160px"><button type="button" class="ghost" data-pmlinkgo>⬇ From the link</button>`
        + `<button type="button" class="ghost" data-pmup title="Send a file from this computer to the pod (your upload speed decides how long)">⬆ From this computer…</button></div>`
        + `<div class="hint" data-pmmsg aria-live="polite"></div><div data-pmprog></div>`;
      box.innerHTML = h;
      var picked = {};
      function list(qs) {
        var w2 = String(qs || "").toLowerCase().split(/\s+/).filter(Boolean);
        var rows = cat.filter(function (f) { var hay = (f.label + " " + f.name + " " + f.group).toLowerCase(); return w2.every(function (x) { return hay.indexOf(x) >= 0; }); });
        rows.sort(function (x, y) { return (picked[y.name] ? 1 : 0) - (picked[x.name] ? 1 : 0); });
        box.querySelector("[data-pmlist]").innerHTML = rows.slice(0, 80).map(function (f) {
          return '<label><input type="checkbox" data-pmf="' + esc(f.name) + '"' + (picked[f.name] ? " checked" : "") + "> " + esc(f.label) + ' <span class="fit">' + esc(f.folder) + " · " + gb(f.size) + "</span></label>";
        }).join("") || `<span class="hint">Nothing in bitGen's download list matches.</span>`;
        box.querySelectorAll("[data-pmf]").forEach(function (i) { i.onchange = function () { if (i.checked) picked[i.getAttribute("data-pmf")] = true; else delete picked[i.getAttribute("data-pmf")]; }; });
      }
      list("");
      box.querySelector("[data-pmq]").addEventListener("input", function (e) { list(e.target.value); });
      box.querySelector("[data-pmq]").addEventListener("keydown", function (e) { e.stopPropagation(); });
      box.querySelector("[data-pmstyle]").onchange = function (e) {
        var id = e.target.value, msg = box.querySelector("[data-pmmsg]"); if (!id) return;
        post("/api/pods/plan", { styles: [id] }).then(function (p) {
          (p.files || []).forEach(function (f) { picked[f.name] = true; });
          list(box.querySelector("[data-pmq]").value);
          msg.textContent = (p.files || []).length ? `Ticked the style's ${p.files.length} file(s), ${gb(p.files.reduce(function (n, f) { return n + (f.size || 0); }, 0))}.` : `bitGen's download list has none of this style's files.`;
          if ((p.unknown || []).length) msg.textContent += " " + `Not in bitGen's list: ${p.unknown.join(", ")}`;
        });
      };
      var pw = box.querySelector("[data-pmpwgo]");
      if (pw) pw.onclick = function () {
        var v = box.querySelector("[data-pmpw]").value.trim(); if (!v) return;
        S.pw = v; box.querySelector("[data-pmmsg]").textContent = `The password is kept (encrypted) and used for the download.`;
      };
      box.querySelector("[data-pclose]").onclick = function () { stop(); host.innerHTML = ""; };
      box.querySelector("[data-pmlink]").addEventListener("keydown", function (e) { e.stopPropagation(); });
      var after = function (r, what) {
        var msg = box.querySelector("[data-pmmsg]");
        if (r.error) { msg.style.color = "#e88"; msg.textContent = r.error; return; }
        msg.style.color = ""; msg.textContent = what; stop(); poll();
      };
      box.querySelector("[data-pmlinkgo]").onclick = function () {
        var u = box.querySelector("[data-pmlink]").value.trim(), f = box.querySelector("[data-pmfold]").value;
        if (!u) { box.querySelector("[data-pmmsg]").textContent = `Paste a link first.`; return; }
        post("/api/pods/" + encodeURIComponent(pod.id) + "/link", { url: u, folder: f, port: port || 0, jupyter_password: S.pw || "" }).then(function (r) { after(r, r.name ? `Downloading ${r.name} into models/${f}.` : ""); });
      };
      box.querySelector("[data-pmup]").onclick = function () {
        var f = box.querySelector("[data-pmfold]").value;
        if (!(root.FileDialog && FileDialog.open)) return;
        FileDialog.open({ mode: "file", title: "A model file to send to the pod", okLabel: "Send", key: "podupload", filters: [{ label: "Model files", exts: ["safetensors", "gguf", "ckpt", "pt", "pth", "bin", "sft"] }] }).then(function (sel) {
          if (!sel || !sel.path) return;
          post("/api/pods/" + encodeURIComponent(pod.id) + "/upload", { path: sel.path, folder: f, port: port || 0, jupyter_password: S.pw || "" }).then(function (r) { after(r, r.name ? `Sending ${r.name} (${gb(r.size)}) to models/${f} - your upload speed decides how long.` : ""); });
        });
      };
      box.querySelector("[data-pmgo]").onclick = function () {
        var names = Object.keys(picked), msg = box.querySelector("[data-pmmsg]");
        var files = cat.filter(function (f) { return names.indexOf(f.name) >= 0; }).map(function (f) { return { name: f.name, folder: f.folder, url: f.url, size: f.size }; });
        if (!files.length) { msg.textContent = `Tick a style or a file first.`; return; }
        msg.textContent = `Starting the downloads on the pod…`;
        post("/api/pods/" + encodeURIComponent(pod.id) + "/models", { files: files, port: port || 0, jupyter_password: S.pw || "" }).then(function (r) {
          if (r.error) { msg.style.color = "#e88"; msg.textContent = r.error; return; }
          msg.style.color = "";
          msg.textContent = (r.way === "jupyter" ? `Downloading ${r.started} file(s) through the pod's Jupyter.` : `ComfyUI-Manager is downloading ${r.started} file(s).`)
            + ((r.not || []).length ? " " + `Not in ComfyUI-Manager's list: ${r.not.join(", ")}` : "");
          poll();
        });
      };
      if ((w.jupyter || w.manager)) poll();
    }).catch(function (e) { box.innerHTML = '<span class="hint" style="color:#e88">' + esc(e.message || e) + "</span>"; });
  }
  root.H3PodLoad = { bar: bar, line: line, mins: mins, styles: styles, lockBasics: lockBasics, models: models, gb: gb };
})(typeof window !== "undefined" ? window : globalThis);
