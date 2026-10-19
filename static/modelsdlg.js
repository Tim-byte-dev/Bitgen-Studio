/* bitGen Studio — THE MODEL CATALOG DIALOG (2.341.0).
 *
 * Tim: "yes please add these downloads to setup, also add the hf cli to
 * download direct from hf". Settings -> Models -> ⤓ Model catalog opens the
 * setup wizard's Models page inside the studio (routes/setup.js): the
 * Hugging Face token, the downloader (the Hugging Face CLI when installed,
 * the built-in one otherwise) with Install hf CLI, every catalog file by
 * group (sizes, gated, already downloaded), Download, per-file progress and
 * the log. The token lives in this tab's sessionStorage only.
 */
(function () {
  "use strict";
  var CSS = ""
    + "dialog.mdlg{width:min(900px,96vw);max-height:90vh;padding:0;display:flex;flex-direction:column;overflow:hidden}"
    + "dialog.mdlg:not([open]){display:none}"
    + ".mdlg .mHead{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line,#333)}"
    + ".mdlg .mHead h2{margin:0;font-size:.95rem;flex:1}"
    + ".mdlg .mBody{padding:10px 12px;overflow:auto;display:flex;flex-direction:column;gap:8px;min-height:0}"
    + ".mdlg .mRow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}"
    + ".mdlg .mRow input[type=password]{flex:1;min-width:220px}"
    + ".mdlg .mMsg{font-size:.78rem;color:var(--dim,#999)}.mdlg .mMsg.ok{color:#7c7}.mdlg .mMsg.bad{color:#e66}"
    + ".mdlg .mList{border:1px solid var(--line,#333);border-radius:6px;max-height:44vh;overflow:auto}"
    + ".mdlg .mGrp{padding:4px 8px;font-weight:600;font-size:.8rem;background:rgba(255,255,255,.04);position:sticky;top:0}"
    + ".mdlg .mItem{display:grid;grid-template-columns:22px 1fr 80px;gap:4px 6px;padding:4px 8px;border-top:1px solid rgba(255,255,255,.05);font-size:.8rem;align-items:center}"
    + ".mdlg .mItem.off{opacity:.55}.mdlg .mItem .why{grid-column:2/4;color:var(--dim,#999);font-size:.72rem}.mdlg .mItem .why.bad{color:#e66}"
    + ".mdlg .mItem .sz{text-align:right;color:var(--dim,#999)}"
    + ".mdlg .tag{font-size:.66rem;border:1px solid var(--line,#444);border-radius:8px;padding:0 5px;margin-left:5px}"
    + ".mdlg .tag.have{color:#7c7;border-color:#474}.mdlg .tag.gate{color:#ec6;border-color:#763}.mdlg .tag.rec{color:var(--tiger,#f59e2c)}"
    + ".mdlg .mBar{grid-column:2/4;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}.mdlg .mBar>div{height:100%;width:0;background:var(--tiger,#f59e2c)}"
    + ".mdlg .mLog{font:11px/1.35 ui-monospace,monospace;background:#0b0b0b;border:1px solid var(--line,#333);border-radius:6px;height:110px;overflow:auto;padding:4px 6px;white-space:pre-wrap}"
    + ".mdlg .mLog .e{color:#e88}.mdlg .mFoot{display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid var(--line,#333)}"
    + ".mdlg .mFoot .sp{flex:1}";
  var cur = null;
  function $(c) { return cur.dlg.querySelector("." + c); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function gbs(b) { b = +b || 0; return b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? Math.round(b / 1e6) + " MB" : b ? Math.round(b / 1e3) + " kB" : ""; }
  function jget(u) { return fetch(u).then(function (r) { return r.json(); }); }
  function jpost(u, b) {
    return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); });
  }
  var ss = { get: function (k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } },
             set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private window */ } } };

  function build() {
    if (!document.getElementById("mdlgCss")) { var st = document.createElement("style"); st.id = "mdlgCss"; st.textContent = CSS; document.head.appendChild(st); }
    var dlg = document.createElement("dialog");
    dlg.className = "mdlg";
    dlg.innerHTML = '<div class="mHead"><h2>⤓ Model catalog · Hugging Face</h2><button type="button" class="ghost mClose" title="Close (downloads keep running)">✕</button></div>'
      + '<div class="mBody">'
      + '<div class="mRow"><label>Token</label><input type="password" class="mTok" spellcheck="false" placeholder="hf_… (read access, huggingface.co/settings/tokens) - optional">'
      + '<button type="button" class="ghost mUseTok">Use token</button></div>'
      + '<div class="mMsg mTokMsg">Without a token only the models that are not gated can be downloaded.</div>'
      + '<div class="mRow"><label>Download with <select class="mEng">'
      + '<option value="auto">Hugging Face CLI when installed, else built-in</option>'
      + '<option value="hf">Hugging Face CLI (hf download)</option><option value="builtin">Built-in downloader</option></select></label>'
      + '<button type="button" class="ghost mHf">Install hf CLI</button></div>'
      + '<div class="mMsg mHfMsg">Checking for the Hugging Face CLI…</div>'
      + '<div class="mList"><div class="mMsg" style="padding:8px">Asking Hugging Face about each model…</div></div>'
      + '<div class="mLog" aria-label="Log"></div></div>'
      + '<div class="mFoot"><span class="mMsg mTot"></span><span class="sp"></span>'
      + '<button type="button" class="ghost mRefresh">↻ Refresh</button><button type="button" class="mGo">⤓ Download</button></div>';
    document.body.appendChild(dlg);
    cur = { dlg: dlg, rows: [], token: ss.get("bitgen.hfToken"), poll: 0 };
    $("mTok").value = cur.token;
    $("mClose").onclick = function () { dlg.close(); };
    $("mUseTok").onclick = useToken;
    $("mRefresh").onclick = load;
    $("mHf").onclick = installHf;
    $("mGo").onclick = go;
    try { $("mEng").value = localStorage.getItem("bitgen.dlEngine") || "auto"; } catch (e) { /* none */ }
    $("mEng").onchange = function () { try { localStorage.setItem("bitgen.dlEngine", this.value); } catch (e) { /* none */ } };
    dlg.addEventListener("close", function () { clearTimeout(cur.poll); });
    return cur;
  }
  function msg(cls, text, kind) { var m = $(cls); m.className = "mMsg " + cls + (kind ? " " + kind : ""); m.textContent = text; }

  function useToken() {
    var t = $("mTok").value.trim();
    msg("mTokMsg", "Checking…");
    return jpost("/api/setup/token", { token: t }).then(function (r) {
      if (r.ok) { cur.token = t; ss.set("bitgen.hfToken", t); msg("mTokMsg", "Signed in as " + r.name + " - gated models you have accepted can be downloaded.", "ok"); }
      else { cur.token = ""; ss.set("bitgen.hfToken", ""); msg("mTokMsg", (r.error || "not accepted") + " - only the open models for now.", "bad"); }
      return load();
    });
  }
  function hfPaint(r) {
    r = r || {};
    msg("mHfMsg", r.found ? "Hugging Face CLI ready (huggingface_hub " + (r.version || "?") + ") - big files come down faster and resume by themselves."
      : "The Hugging Face CLI is not installed - Install hf CLI adds it to the studio's Python (" + (r.python || "?") + "), or keep the built-in downloader.", r.found ? "ok" : "");
    $("mHf").textContent = r.found ? "Update hf CLI" : "Install hf CLI";
  }
  function installHf() {
    $("mHf").disabled = true;
    msg("mHfMsg", "Installing huggingface_hub…");
    return jpost("/api/setup/hfcli/install", {}).then(function (r) {
      if (r.error) { $("mHf").disabled = false; msg("mHfMsg", r.error, "bad"); return r; }
      poll();
      return r;
    });
  }
  function load() {
    $("mList").innerHTML = '<div class="mMsg" style="padding:8px">Asking Hugging Face about each model…</div>';
    jget("/api/setup/hfcli").then(hfPaint, function () {});
    return jpost("/api/setup/models", { token: cur.token }).then(function (r) {
      if (r.error) { $("mList").innerHTML = '<div class="mMsg bad" style="padding:8px">' + esc(r.error) + "</div>"; return r; }
      cur.rows = r.rows || []; cur.free = r.free || 0;
      var by = {};
      cur.rows.forEach(function (m) { (by[m.group] = by[m.group] || []).push(m); });
      $("mList").innerHTML = (r.groups || []).filter(function (g) { return by[g.id]; }).map(function (g) {
        // 2.520.0 (Tim: "go with all 3 of your recommendations" - grouped downloads): the group's own box ticks / unticks
        // every file in it that can be downloaded, with the group's size
        var can = by[g.id].filter(function (m) { return m.available && !m.present; }), gsz = can.reduce(function (a, m) { return a + (m.size || 0); }, 0);
        return '<div class="mGrp"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-grp="' + esc(g.id) + '"' + (can.length ? "" : " disabled")
          + ' title="Tick / untick the whole group">' + esc(g.label) + ' <span class="sz" data-grpsz="' + esc(g.id) + '" style="margin-left:auto;font-weight:400">' + (can.length ? can.length + " to get · " + gbs(gsz) : "nothing to get") + "</span></label></div>" + by[g.id].map(function (m) {
          var ok = m.available && !m.present;
          var tags = (m.recommended ? '<span class="tag rec">for your GPU</span>' : "") + (m.present ? '<span class="tag have">downloaded</span>' : "")
            + (m.gated ? '<span class="tag gate">gated</span>' : "");
          return '<label class="mItem' + (ok ? "" : " off") + '" data-id="' + esc(m.id) + '"><input type="checkbox" data-id="' + esc(m.id) + '" data-in="' + esc(g.id) + '"' + (ok ? "" : " disabled") + ">"
            + '<span class="nm">' + esc(m.label) + tags + '</span><span class="sz">' + gbs(m.size) + "</span>"
            + '<span class="why' + (m.available ? "" : " bad") + '">' + esc(m.available ? (m.for || "") : m.why) + "</span>"
            + '<div class="mBar"><div></div></div></label>';
        }).join("");
      }).join("");
      Array.prototype.forEach.call(cur.dlg.querySelectorAll(".mList input[data-id]"), function (c) { c.onchange = totals; });
      Array.prototype.forEach.call(cur.dlg.querySelectorAll(".mList input[data-grp]"), function (c) {
        c.onchange = function () {
          Array.prototype.forEach.call(cur.dlg.querySelectorAll('.mList input[data-in="' + c.dataset.grp + '"]:not(:disabled)'), function (x) { x.checked = c.checked; });
          totals();
        };
      });
      totals();
      poll();
      return r;
    });
  }
  function ticked() { return Array.prototype.map.call(cur.dlg.querySelectorAll(".mList input[data-id]:checked"), function (c) { return c.dataset.id; }); }
  function totals() {
    var ids = ticked();
    // each group's box: ticked when all its files are, half when some are (2.520.0)
    Array.prototype.forEach.call(cur.dlg.querySelectorAll(".mList input[data-grp]"), function (g) {
      var all = cur.dlg.querySelectorAll('.mList input[data-in="' + g.dataset.grp + '"]:not(:disabled)'), on = 0;
      Array.prototype.forEach.call(all, function (x) { if (x.checked) on++; });
      g.checked = all.length > 0 && on === all.length; g.indeterminate = on > 0 && on < all.length;
    });
    var sum = cur.rows.filter(function (r) { return ids.indexOf(r.id) >= 0; }).reduce(function (a, r) { return a + (r.size || 0); }, 0);
    $("mTot").textContent = ids.length + " file(s), " + (gbs(sum) || "0 B") + (cur.free ? " · " + gbs(cur.free) + " free on the models drive" : "")
      + (cur.free && sum > cur.free ? " - NOT ENOUGH SPACE" : "");
    $("mGo").disabled = !ids.length;
  }
  function go() {
    var ids = ticked();
    if (!ids.length) return Promise.resolve(null);
    $("mGo").disabled = true;
    return jpost("/api/setup/download", { ids: ids, token: cur.token, engine: $("mEng").value }).then(function (r) {
      if (r.error) { $("mGo").disabled = false; paintLog([{ line: "[error] " + r.error, err: true }]); return r; }
      poll();
      return r;
    });
  }
  function paintLog(lines) {
    var el = $("mLog");
    el.innerHTML = (lines || []).map(function (l) { return '<div class="' + (l.err ? "e" : "") + '">' + esc(l.line) + "</div>"; }).join("");
    el.scrollTop = el.scrollHeight;
  }
  function poll() {
    clearTimeout(cur.poll);
    return jget("/api/setup/state").then(function (s) {
      paintLog(s.log);
      Object.keys(s.files || {}).forEach(function (id) {
        var f = s.files[id], row = cur.dlg.querySelector('.mItem[data-id="' + id + '"]');
        if (!row) return;
        var bar = row.querySelector(".mBar > div"), why = row.querySelector(".why");
        if (f.state === "run" && f.total) { bar.style.width = Math.round(100 * f.got / f.total) + "%"; why.textContent = gbs(f.got) + " of " + gbs(f.total); }
        else if (f.state === "ok") { bar.style.width = "100%"; why.textContent = "✓ downloaded"; why.className = "why"; }
        else if (f.state === "err") { why.textContent = "✕ " + (f.error || "failed"); why.className = "why bad"; }
        else if (f.state === "wait") why.textContent = "waiting…";
      });
      if (s.hf && s.what === "hfcli" && !s.busy) { $("mHf").disabled = false; hfPaint(s.hf); }
      if (s.busy) { $("mGo").disabled = true; if (cur.dlg.open) cur.poll = setTimeout(poll, 1000); }
      else if (s.what === "download" && s.result && cur.seenRun !== s.started) {
        // a run just ended: the list again (what is downloaded now) - once per run
        var first = cur.seenRun === undefined;
        cur.seenRun = s.started; $("mGo").disabled = false;
        if (!first) load();
      }
      return s;
    }, function () { if (cur.dlg.open) cur.poll = setTimeout(poll, 3000); });
  }

  function open() {
    if (!cur) build();
    if (!cur.dlg.open) { if (cur.dlg.showModal) cur.dlg.showModal(); else cur.dlg.setAttribute("open", ""); }
    return load();
  }
  window.ModelsDialog = { open: open, _state: function () { return cur; }, _api: { load: load, go: go, useToken: useToken, installHf: installHf, poll: poll, totals: totals }, gbs: gbs };
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("#mm_catalog");
    if (b) { e.preventDefault(); open(); }
  });
})();
