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
 */
(function (root) {
  "use strict";
  var doc = root.document;
  var declined = {};
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[models] " + t); } catch (e) { /* no console */ } }
  function jpost(u, b) {
    return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })
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
            fetch("/api/setup/state").then(function (x) { return x.json(); }).then(function (st) {
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
    return jpost("/api/models/check", req).then(function (r) {
      if (!r.checked) { if (r.why && r.why !== "no style picked") log("not checked - " + r.why); return true; }
      if (!(r.missing || []).length) return true;
      var k = keyOf(req, r);
      if (declined[k] && Date.now() - declined[k] < 20000) {
        log("refused - " + r.missing.length + " model file(s) not found (cancelled a moment ago): " + r.missing.map(function (m) { return m.name; }).join(", "));
        return false;
      }
      log(r.missing.length + " model file(s) not found: " + r.missing.map(function (m) { return m.name; }).join(", "));
      return box(r, req);
    }).catch(function (e) { log("the check did not run (" + ((e && e.message) || e) + ") - rendering anyway"); return true; });
  }
  function refresh() { return fetch("/api/models/found?refresh=1&names=0").then(function (r) { return r.json(); }).catch(function () { return null; }); }

  root.H3ModelsFound = { ensure: ensure, refresh: refresh, box: box };
})(typeof window !== "undefined" ? window : globalThis);
