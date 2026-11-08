/* bitGen Studio — static/modelsfound.js (2.719.0): MODELS NOT FOUND - asked before a render starts (window.H3ModelsFound).
 *
 * Tim (verbatim): "check if models are in a model path before render - create a list of found models so it can be a quick
 * check save the list as /misc/models_found.json. if models are not found bring up a msgbox to download/cancel model names
 * not found"
 *
 *   ensure(req) -> Promise<true = render, false = don't>    req = what the render will send (kind image | music | video,
 *                 the style, the mode, Basic Settings' model / LoRAs) - POST /api/models/check (routes/modelsFound.js)
 *                 compares the files it will load with misc/models_found.json. All found (or not checkable, or the check
 *                 itself failed) = true at once.
 *   THE MESSAGE BOX  each file not found: its name, the folder it goes in, and either its download (the 📦 model catalogue
 *                 has it: size + repo) or "not in bitGen's download list". ⬇ Download fetches the downloadable ones through
 *                 Settings ▸ Models' downloader (POST /api/setup/download, the saved Hugging Face token) with a progress bar
 *                 each, then checks again: all there = the render goes on by itself; still missing = the box says which.
 *                 Cancel (or Esc, or Enter - it has the focus) = no render; a download already running keeps going (Settings ▸ Models shows it).
 *   A QUEUE       a Cancel is remembered for 20 s for the same missing files, so the next queued renders of that style are
 *                 refused with a console line instead of asking again.
 *   refresh()     scan the model paths again (🧩 ⟳ calls it)
 *   2.719.1 EVERY RENDER: the page's fetch is wrapped - any POST to /api/genimage, /api/genmusic, /api/generate,
 *                 /api/aiedit(/compose) is checked first, whoever sends it (the image editor's ✨ AI, the StoryBoard, the
 *                 characters, the timeline …); Cancel = 409 {error, models_missing} to that caller. Just checked = not
 *                 asked again for 10 s. "X-Models-Check: skip" = not checked (the 🩺 Style doctor).
 */
(function (root) {
  "use strict";
  var doc = root.document;
  var declined = {}, okAt = {};
  var realFetch = root.fetch ? root.fetch.bind(root) : null;      // 2.719.1: our own calls never go through the wrapper below
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[models] " + t); } catch (e) { /* no console */ } }
  function jpost(u, b) {
    return realFetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }
  function gb(n) { n = +n || 0; return n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : n >= 1e6 ? Math.round(n / 1e6) + " MB" : n ? Math.round(n / 1e3) + " KB" : ""; }
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function css() {
    if (doc.getElementById("mfcss")) return;
    var s = el("style"); s.id = "mfcss";
    s.textContent = "dialog.mfdlg{width:min(720px,94vw);max-height:86vh;padding:14px 16px;display:flex;flex-direction:column;gap:8px}"
      + "dialog.mfdlg:not([open]){display:none}"
      + ".mfdlg h2{margin:0;font-size:1rem}"
      + ".mfdlg .mflist{list-style:none;margin:0;padding:0;overflow:auto;max-height:52vh;border:1px solid var(--line);border-radius:6px}"
      + ".mfdlg .mflist li{padding:8px 10px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:3px}"
      + ".mfdlg .mflist li:first-child{border-top:0}"
      + ".mfdlg .mfname{font-family:var(--mono);font-size:.78rem;word-break:break-all;user-select:text}"
      + ".mfdlg .mfwhere{font-size:.74rem;opacity:.8}"
      + ".mfdlg .mfsrc{font-size:.74rem}"
      + ".mfdlg .mfsrc.none{opacity:.75}"
      + ".mfdlg .mferr{font-size:.74rem;color:#e66}"
      + ".mfdlg .mfbar{height:6px;border-radius:3px;background:var(--line);overflow:hidden;display:none}"
      + ".mfdlg .mfbar i{display:block;height:100%;width:0;background:var(--tiger)}"
      + ".mfdlg .mfnote{font-size:.76rem;margin:0}"
      + ".mfdlg .rowbtns{display:flex;gap:6px;justify-content:flex-end}";
    doc.head.appendChild(s);
  }

  /** the box -> Promise<true | false>; r = the check's answer, req = the render's request (checked again after a download) */
  function box(r, req) {
    css();
    var old = doc.getElementById("mfDlg"); if (old) old.remove();
    var d = el("dialog", "mfdlg"); d.id = "mfDlg";
    var h = el("h2"); h.textContent = "Models not found";
    var p = el("p", "mfnote");
    var ul = el("ul", "mflist"); ul.id = "mfList";
    var note = el("p", "mfnote"); note.id = "mfNote";
    var btns = el("div", "rowbtns");
    var go = el("button", "ghost", "⬇ Download"); go.id = "mfDownload"; go.type = "button";
    go.style.cssText = "border-color:var(--tiger);color:var(--tiger)";
    var no = el("button", "ghost", "Cancel"); no.id = "mfCancel"; no.type = "button";
    btns.appendChild(go); btns.appendChild(no);
    d.appendChild(h); d.appendChild(p); d.appendChild(ul); d.appendChild(note); d.appendChild(btns);
    doc.body.appendChild(d);
    var rows = {};
    function paint(res) {
      var miss = res.missing || [];
      p.textContent = miss.length === 1 ? "This render needs " + miss.length + " model file that is not in any of ComfyUI's model paths:"
        : "This render needs " + miss.length + " model files that are not in any of ComfyUI's model paths:";
      ul.textContent = ""; rows = {};
      miss.forEach(function (m) {
        var li = el("li"); li.dataset.name = m.name;
        li.appendChild(el("span", "mfname", m.name));
        var where = el("span", "mfwhere");
        where.textContent = m.from === "basic" ? "goes in " + m.folder + " (Basic Settings)" : m.from === "style" ? "goes in " + m.folder + " (the style)" : "goes in " + m.folder + " (the workflow)";
        li.appendChild(where);
        var src = el("span", m.source ? "mfsrc" : "mfsrc none");
        if (m.source) src.textContent = "⬇ " + (gb(m.source.size) ? gb(m.source.size) + " - " : "") + "Hugging Face: " + m.source.repo;
        else src.textContent = "Not in bitGen's download list - download it yourself (Civitai, Hugging Face) into " + m.folder;
        li.appendChild(src);
        var bar = el("div", "mfbar"); bar.appendChild(el("i"));
        var err = el("span", "mferr"); err.style.display = "none";
        li.appendChild(bar); li.appendChild(err);
        ul.appendChild(li);
        if (m.source) rows[m.source.id] = { li: li, bar: bar, err: err };
      });
      var n = Object.keys(rows).length;
      var total = miss.reduce(function (t, m) { return t + (m.source ? +m.source.size || 0 : 0); }, 0);
      go.textContent = "⬇ Download" + (n > 1 ? " " + n : "") + (total ? " (" + gb(total) + ")" : "");
      go.disabled = !n;
      note.textContent = n ? "" : "None of these can be downloaded from here. Put the files in the folders above, then press Generate again";
    }
    paint(r);
    return new Promise(function (resolve) {
      var busy = false, timer = 0, closed = false;
      function done(v) {
        if (closed) return; closed = true;
        if (timer) clearInterval(timer);
        if (!v) declined[keyOf(req, r)] = Date.now();
        try { d.close(); } catch (e) { /* closed */ }
        d.remove();
        resolve(v);
      }
      no.onclick = function () {
        if (busy) log("the download keeps going - Settings ▸ Models shows it; press Generate again when it is done");
        else log("render cancelled - " + (r.missing || []).length + " model file(s) not found");
        done(false);
      };
      d.addEventListener("cancel", function (e) { e.preventDefault(); no.onclick(); });
      go.onclick = function () {
        var ids = Object.keys(rows);
        if (!ids.length || busy) return;
        busy = true; go.disabled = true; note.textContent = "Downloading…";
        ids.forEach(function (id) { rows[id].bar.style.display = "block"; rows[id].err.style.display = "none"; });
        jpost("/api/setup/download", { ids: ids }).then(function () {
          timer = setInterval(function () {
            realFetch("/api/setup/state").then(function (x) { return x.json(); }).then(function (st) {
              Object.keys(rows).forEach(function (id) {
                var f = (st.files || {})[id]; if (!f) return;
                var pc = f.state === "ok" ? 100 : f.total ? Math.min(100, Math.floor(100 * f.got / f.total)) : 0;
                rows[id].bar.firstChild.style.width = pc + "%";
                if (f.state === "err") { rows[id].err.textContent = f.error || "the download failed"; rows[id].err.style.display = ""; }
              });
              if (st.busy || !st.result) return;
              clearInterval(timer); timer = 0; busy = false;
              note.textContent = "Checking again…";
              jpost("/api/models/check", req).then(function (r2) {
                if (!r2.checked || !(r2.missing || []).length) { log("the missing models are in place - the render goes on"); done(true); return; }
                r = r2; paint(r2);
                var failed = (st.result.failed || []).map(function (x) { return x.id; });
                failed.forEach(function (id) { var f = (st.files || {})[id]; if (rows[id] && f && f.error) { rows[id].err.textContent = f.error; rows[id].err.style.display = ""; } });
                note.textContent = "Still not found: " + r2.missing.length + ". " + (failed.length ? "A download failed - the line under it says why." : "");
              }).catch(function (e) { note.textContent = "Could not check again: " + e.message; go.disabled = false; });
            }).catch(function () { /* next tick */ });
          }, 800);
        }).catch(function (e) { busy = false; go.disabled = false; note.textContent = "The download did not start: " + e.message; });
      };
      d.showModal();
      no.focus();                                     // Enter = Cancel: a 10 GB download is never one stray key away
    });
  }

  function keyOf(req, r) {
    return [req.kind, req.style_id || req.video_style_id || "", (r.missing || []).map(function (m) { return m.name; }).sort().join("|")].join("\u0000");
  }

  /** the check before a render -> Promise<boolean> */
  function ensure(req) {
    req = req || {};
    var rk = JSON.stringify(req);
    if (okAt[rk] && Date.now() - okAt[rk] < 10000) return Promise.resolve(true);   // just checked (Generate, then its request)
    return jpost("/api/models/check", req).then(function (r) {
      if (!r.checked) { if (r.why && r.why !== "no style picked") log("not checked - " + r.why); return true; }
      if (!(r.missing || []).length) { okAt[rk] = Date.now(); return true; }
      var k = keyOf(req, r);
      if (declined[k] && Date.now() - declined[k] < 20000) {
        log("refused - " + r.missing.length + " model file(s) not found (cancelled a moment ago): " + r.missing.map(function (m) { return m.name; }).join(", "));
        return false;
      }
      log(r.missing.length + " model file(s) not found: " + r.missing.map(function (m) { return m.name; }).join(", "));
      return box(r, req);
    }).catch(function (e) { log("the check did not run (" + ((e && e.message) || e) + ") - rendering anyway"); return true; });
  }
  function refresh() { return realFetch("/api/models/found?refresh=1&names=0").then(function (r) { return r.json(); }).catch(function () { return null; }); }

  /* 2.719.1 - EVERY RENDER, WHEREVER IT IS STARTED. 2.719.0 asked only from the prompt docker's Generate; a render the image
     editor's ✨ AI sent (Tim's log: "1 render(s) queued from the References docker's picture 1" -> ComfyUI: "Value not in
     list [lora_name] = turbo8_lora_step2500.safetensors") went straight to ComfyUI. Now every POST that starts a render in
     this page is checked first, whoever sends it: the prompt docker, the image editor, the StoryBoard, the characters,
     the timeline, the music docker, Push/Pull … A Cancel answers the caller with 409 {error, models_missing} - it shows
     its own "not rendered" message. "X-Models-Check: skip" = not checked (the 🩺 Style doctor reports it in its table). */
  var RENDERS = { "/api/genimage": "image", "/api/genmusic": "music", "/api/generate": "video", "/api/aiedit": "aiedit", "/api/aiedit/compose": "aiedit" };
  function field(body, k) {
    if (!body) return undefined;
    if (typeof FormData !== "undefined" && body instanceof FormData) { var v = body.get(k); return v == null || typeof v !== "string" ? undefined : v; }
    return body[k];
  }
  function loras(v) { if (typeof v === "string") { try { v = JSON.parse(v || "[]"); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; }
  /** the check's request from a render request -> {kind, ...} or null (a body this cannot read = not checked) */
  function reqFrom(kind, raw) {
    var body = raw;
    if (typeof raw === "string") { try { body = JSON.parse(raw); } catch (e) { return null; } }
    else if (!(typeof FormData !== "undefined" && raw instanceof FormData)) return null;
    if (!body || typeof body !== "object") return null;
    var f = function (k) { return field(body, k); };
    if (kind === "video") return { kind: "video", video_style_id: f("video_style_id") || "", mode: f("mode") || "ref2va", basic: f("basic") || "", extra_loras: loras(f("extra_loras")) };
    if (kind === "aiedit") return { kind: "aiedit", style_id: f("style_id") || "", mode: f("mode") || "", fill_edit: f("fill_edit") || "", edit_style_id: f("edit_style_id") || "" };
    if (kind === "music") return { kind: "music", style_id: f("style_id") || "" };
    var q = { kind: "image", style_id: f("style_id") || "" };
    if (f("model")) q.model = f("model");
    var ex = loras(f("extra_loras")); if (ex.length) q.extra_loras = ex;
    return q;
  }
  function skipHeader(h) {
    if (!h) return false;
    try { if (typeof h.get === "function") return /skip/i.test(h.get("X-Models-Check") || ""); } catch (e) { /* not Headers */ }
    for (var k in h) if (/^x-models-check$/i.test(k) && /skip/i.test(String(h[k]))) return true;
    return false;
  }
  function wrap(win) {
    if (!win || !win.fetch || win.fetch.__h3mf) return;
    var orig = win.fetch.bind(win);
    var w = function (input, init) {
      var kind = null, q = null;
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        var method = String((init && init.method) || (input && typeof input !== "string" && input.method) || "GET").toUpperCase();
        var path = new URL(url, (win.location && win.location.href) || "http://localhost/").pathname;
        kind = method === "POST" ? RENDERS[path] : null;
        if (kind && !skipHeader(init && init.headers)) q = reqFrom(kind, init && init.body);
      } catch (e) { q = null; }
      if (!q) return orig(input, init);
      return ensure(q).then(function (go) {
        if (go) return orig(input, init);
        return new Response(JSON.stringify({ error: "Not rendered - model files it needs are not in ComfyUI's model paths (cancelled). The Console lists them.", models_missing: true }),
          { status: 409, headers: { "Content-Type": "application/json" } });
      });
    };
    w.__h3mf = true;
    win.fetch = w;
  }
  if (root.fetch && typeof root.Response !== "undefined") wrap(root);

  root.H3ModelsFound = { ensure: ensure, refresh: refresh, box: box, wrap: wrap, reqFrom: reqFrom };
})(typeof window !== "undefined" ? window : globalThis);
