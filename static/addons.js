/* bitGen Studio — static/addons.js (2.540.4): Settings ▸ ADD-ONS (window.H3Addons).
 * Tim: "can we add an add ons tab to settings - install yue2?" - the optional engines (lib/addons.js): what each is
 * for, what it needs, how big it is, installed or not, and ⤓ Install / ⟳ Reinstall / 🗑 Remove; the running install's
 * log streams in the tab (one at a time). Viggle (native) uses its own installer - its job shows in the Queue.
 * API: GET /api/addons, POST /api/addons/:id/install|remove, GET /api/addons/job?from=N (routes/addons.js).
 * 2.557.0: an add-on with a list (AI fill models - lib/aiFillAddon.js) shows its items with checkboxes, sizes and ✓
 * downloaded; ⤓ Download ticked sends {items} and 🗑 Remove models deletes the files.
 * Exports H3Addons {open, refresh, act, state}. */
(function () {
  "use strict";
  var S = { list: [], job: null, lines: [], next: 0, timer: null, picks: {} };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function j(r) { return r.json(); }
  var CSS = "#stab-addons .ao{border:1px solid var(--line,#3a352e);border-radius:6px;padding:8px 10px;margin:0 0 8px}"
    + "#stab-addons .ao h4{margin:0 0 4px;font-size:13px;display:flex;gap:8px;align-items:center}"
    + "#stab-addons .ao .st{font-size:11px;padding:1px 7px;border-radius:9px;border:1px solid var(--line,#3a352e)}"
    + "#stab-addons .ao .st.on{color:#7fd17f;border-color:#3d6b3d}#stab-addons .ao .st.off{color:var(--dim,#999)}#stab-addons .ao .st.busy{color:var(--tiger,#f59e2c);border-color:var(--tiger,#f59e2c)}"
    + "#stab-addons .ao .kv{font-size:11.5px;color:var(--dim,#aaa);margin:2px 0}#stab-addons .ao .kv b{color:var(--text,#ddd);font-weight:600}"
    + "#stab-addons .ao .btns{display:flex;gap:6px;margin-top:6px}"
    + "#aoLog{max-height:260px;overflow:auto;font:11px ui-monospace,monospace;background:var(--bg,#151310);border:1px solid var(--line,#3a352e);border-radius:4px;padding:6px;white-space:pre-wrap;margin:6px 0 0}"
    + "#aoLog .e{color:#e88}"
    + "#stab-addons .ao .its{display:grid;gap:3px;margin:6px 0 0;font-size:11.5px}#stab-addons .ao .its label{display:flex;gap:6px;align-items:baseline;cursor:pointer}"
    + "#stab-addons .ao .its .sz{color:var(--dim,#999)}#stab-addons .ao .its .ok{color:#7fd17f}";
  function boot() {
    var dlg = $("settings"), tabs = dlg && dlg.querySelector(".stabs");
    if (!tabs || $("stab-addons")) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var b = document.createElement("button"); b.dataset.stab = "addons"; b.textContent = "Add-ons"; b.type = "button";
    var ext = tabs.querySelector('[data-stab="extensions"]');
    if (ext) ext.after(b); else tabs.appendChild(b);
    var pane = document.createElement("div"); pane.className = "stab"; pane.id = "stab-addons";
    pane.innerHTML = '<p class="hint help" style="margin:0 0 8px">Optional engines that are not part of the main install. Each goes into its own folder '
      + "next to the app and can be removed again. One install runs at a time; its log shows below.</p>"
      + '<div id="aoList">…</div><div id="aoJob"></div>';
    var all = dlg.querySelectorAll(".stab"); if (all.length) all[all.length - 1].after(pane); else tabs.after(pane);
    b.onclick = function () {
      dlg.querySelectorAll(".stabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
      document.querySelectorAll(".stab").forEach(function (t) { t.classList.toggle("active", t.id === "stab-addons"); });
      refresh();
    };
  }
  function refresh() {
    return fetch("/api/addons").then(j).then(function (r) {
      S.list = r.addons || []; S.job = r.job;
      paint();
      if (S.job && S.job.state === "running") follow();
      return r;
    }).catch(function (e) { var L = $("aoList"); if (L) L.textContent = "Could not read the add-ons: " + e.message; });
  }
  function badge(a) {
    if (a.busy) return '<span class="st busy">installing…</span>';
    return a.installed ? '<span class="st on">✓ installed</span>' : '<span class="st off">not installed</span>';
  }
  function paint() {
    var L = $("aoList"); if (!L) return;
    var running = S.job && S.job.state === "running";
    L.innerHTML = S.list.map(function (a) {
      var btn = function (act, label, title) { return '<button type="button" class="ghost" data-ao="' + esc(a.id) + '" data-act="' + act + '"' + (running || a.busy ? " disabled" : "") + ' title="' + esc(title) + '">' + label + "</button>"; };
      var hasItems = Array.isArray(a.items) && a.items.length;
      var acts = (a.actions || []).map(function (x) {
        if (hasItems) {                                   // 2.557.0: an add-on with a list - download what is ticked
          return x === "install" || x === "reinstall" ? btn("install", "⤓ Download ticked", "Download the ticked models (and a node pack the add-on needs, if missing)")
            : x === "remove" ? btn("remove", "🗑 Remove models", "Delete its downloaded model files (the node pack stays in ComfyUI)") : "";
        }
        return x === "install" ? btn("install", "⤓ Install", a.external ? "Starts its installer - follow it in the Queue" : "Install " + a.label + " (" + a.size + ")")
          : x === "reinstall" ? btn("install", "⟳ Reinstall", "Install it again over the top (the same pinned versions)")
          : x === "remove" ? btn("remove", "🗑 Remove", "Delete its folder (its venv and packages; the model cache stays)") : "";
      }).join("");
      var its = hasItems ? '<div class="its">' + a.items.map(function (it) {
        // 2.566.0: an item every style needs (need) is always downloaded - ticked, not untickable
        var on = it.need || (S.picks[a.id] ? S.picks[a.id].indexOf(it.id) >= 0 : (!it.present && it.dflt));
        return '<label title="' + esc(it.for) + '"><input type="checkbox" data-aoi="' + esc(a.id) + '" value="' + esc(it.id) + '"' + (on ? " checked" : "") + (running || a.busy || it.need ? " disabled" : "") + "> "
          + esc(it.label) + ' <span class="sz">' + esc(it.size) + "</span>" + (it.need ? ' <span class="sz">(needed)</span>' : "") + (it.present ? ' <span class="ok">✓ downloaded</span>' : "") + "</label>";
      }).join("") + "</div>" : "";
      return '<div class="ao" data-addon="' + esc(a.id) + '"><h4>' + esc(a.label) + " " + badge(a) + "</h4>"
        + '<div class="kv"><b>For</b> ' + esc(a.for) + "</div>"
        + '<div class="kv"><b>Needs</b> ' + esc(a.needs) + "</div>"
        + '<div class="kv"><b>Size</b> ' + esc(a.size) + "</div>"
        + (a.note ? '<div class="kv"><b>State</b> ' + esc(a.note) + "</div>" : "")
        + its + '<div class="btns">' + acts + "</div></div>";
    }).join("") || "No add-ons.";
    Array.prototype.forEach.call(L.querySelectorAll("[data-aoi]"), function (el) {
      el.onchange = function () { S.picks[el.dataset.aoi] = picked(el.dataset.aoi); };
    });
    Array.prototype.forEach.call(L.querySelectorAll("[data-ao]"), function (el) {
      el.onclick = function () { act(el.dataset.ao, el.dataset.act); };
    });
    paintJob();
  }
  function paintJob() {
    var J = $("aoJob"); if (!J) return;
    if (!S.job) { J.innerHTML = ""; return; }
    var head = S.job.state === "running" ? "⏳ " + S.job.action + "ing " + S.job.id + "…" : S.job.state === "done" ? "✓ " + S.job.id + " " + (S.job.action === "remove" ? "removed" : "installed") : "✗ " + S.job.id + ": " + (S.job.error || "failed");
    J.innerHTML = '<div class="kv" id="aoHead" style="margin-top:6px"><b>' + esc(head) + "</b></div>"
      + '<div id="aoLog">' + S.lines.map(function (l) { return l.charAt(0) === "!" ? '<span class="e">' + esc(l.slice(2)) + "</span>" : esc(l); }).join("\n") + "</div>";
    var lg = $("aoLog"); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  /** the ticked items of an add-on with a list */
  function picked(id) {
    var L = $("aoList"); if (!L) return [];
    return Array.prototype.filter.call(L.querySelectorAll('[data-aoi="' + id + '"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
  }
  function act(id, action, items) {
    var a = S.list.find(function (x) { return x.id === id; }) || {};
    var hasItems = Array.isArray(a.items) && a.items.length;
    var picks = items || (hasItems ? picked(id) : null);
    if (hasItems && action === "install" && !picks.length) { if (typeof window.toast === "function") window.toast("tick the models to download first"); else alert("tick the models to download first"); return Promise.resolve(null); }
    if (action === "remove" && !confirm(hasItems ? "Remove the downloaded " + (a.label || id) + "? The model files are deleted (a node pack and the styles stay)." : "Remove " + (a.label || id) + "? Its folder (venv + packages) is deleted; you can install it again later.")) return Promise.resolve(null);
    if (hasItems && action === "install" && !items) {
      var sel = a.items.filter(function (it) { return picks.indexOf(it.id) >= 0; });
      if (!confirm("Download for " + (a.label || id) + "?\n\n" + sel.map(function (it) { return "• " + it.label + " - " + it.size + (it.present ? " (already there)" : ""); }).join("\n") + "\n\nNeeds: " + a.needs)) return Promise.resolve(null);
    } else if (action === "install" && !a.external && !a.installed && !hasItems && !confirm("Install " + (a.label || id) + "?\n\nSize: " + a.size + "\nNeeds: " + a.needs)) return Promise.resolve(null);
    S.lines = []; S.next = 0;
    var opt = { method: "POST" };
    if (hasItems && action === "install") { opt.headers = { "Content-Type": "application/json" }; opt.body = JSON.stringify({ items: picks }); }
    return fetch("/api/addons/" + encodeURIComponent(id) + "/" + action, opt).then(j).then(function (r) {
      if (r.error) { if (typeof window.toast === "function") window.toast(r.error); else alert(r.error); return r; }
      if (window.H3TestEvent) window.H3TestEvent("addon_" + action, id);
      if (r.external) { if (typeof window.toast === "function") window.toast(a.label + ": its install is in the Queue"); return refresh(); }
      S.job = r.job; paint(); follow(); return r;
    });
  }
  function follow() {
    clearTimeout(S.timer);
    fetch("/api/addons/job?from=" + S.next).then(j).then(function (r) {
      if (!r.job) return;
      S.lines = S.lines.concat(r.lines || []); S.next = r.next; S.job = Object.assign({}, S.job || {}, r.job);
      paintJob();
      if (r.job.state === "running") S.timer = setTimeout(follow, 1200);
      else refresh();
    }).catch(function () { S.timer = setTimeout(follow, 3000); });
  }
  function open() {
    var dlg = $("settings"); if (!dlg) return;
    if (!dlg.open) { if (typeof window.openSettings === "function") window.openSettings(); else dlg.showModal(); }
    var b = dlg.querySelector('[data-stab="addons"]'); if (b) b.click();
  }
  window.H3Addons = { open: open, refresh: refresh, act: act, state: S };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
