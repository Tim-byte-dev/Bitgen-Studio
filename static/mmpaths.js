/* bitGen Studio — static/mmpaths.js (2.580.0): the 🧩 Model manager's 📁 MODEL PATHS tab (window.H3ModelPaths) - every
 * group of ComfyUI's extra_model_paths.yaml (lib/extraPaths.js, routes/extraPaths.js): ➕ a new group (other_ui<n>),
 * each path changed / added / removed, a group renamed, made default or 🗑 deleted, and ⟳ Restart ComfyUI (it reads the
 * file only when it starts). Tim: "in modelmanager add a tab with comfyui extra model paths listed, allow user to add new
 * group of paths and chenge individual paths and delete a group of paths - group of paths will be other_ui<n> etc" +
 * "add restart comfy button in this tab".
 *   render(host, say)   paints into the Model manager's #mmPaths (static/modelmgr.js calls it for the paths tab)
 *   load()              reads the file again; state(); relTo(base, abs) (pure)
 * Unsaved edits in one group survive a save / delete of another (S.drafts). */
(function (root) {
  "use strict";
  /** abs inside base -> "models/x" (forward slashes), else abs unchanged (pure) */
  function relTo(base, abs) {
    var b = String(base || "").replace(/[\\/]+$/, ""), a = String(abs || "");
    if (!b) return a;
    var nb = b.replace(/\\/g, "/").toLowerCase(), na = a.replace(/\\/g, "/");
    if (na.toLowerCase().indexOf(nb + "/") === 0) return na.slice(nb.length + 1);
    return a;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { relTo: relTo }; return; }

  var S = { data: null, drafts: {}, host: null, say: null, busy: false, loading: null };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var jget = function (u) { return fetch(u).then(function (r) { return r.json(); }); };
  var jpost = function (u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; if (r.status === 409) j.conflict = true; return j; }); }); };
  var say = function (t, cls) { if (S.say) S.say(t, cls); };

  var CSS = ".mmgr .mmpaths{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}"
    + ".mmgr .mmpaths .xph{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.mmgr .mmpaths .xph code{flex:1;min-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.7rem}"
    + ".mmgr .mmpaths .xpn{color:var(--dim,#999);font-size:.7rem}.mmgr .mmpaths .xpw{color:#e9b14a;font-size:.7rem}"
    + ".mmgr .mmpaths .xpg{border:1px solid var(--line,#3a342a);border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:4px;background:rgba(255,255,255,.02)}"
    + ".mmgr .mmpaths .xpg.dirty{border-color:var(--tiger,#f59e2c)}"
    + ".mmgr .mmpaths .gh{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.mmgr .mmpaths .gh .xpname{font-weight:600;width:150px}.mmgr .mmpaths .gh .sp{flex:1}"
    + ".mmgr .mmpaths .r{display:flex;gap:4px;align-items:center}.mmgr .mmpaths .r .lab{width:150px;color:var(--dim,#999)}.mmgr .mmpaths .r .xpkey{width:150px}.mmgr .mmpaths .r .xpval,.mmgr .mmpaths .r .xpbase{flex:1;min-width:120px;font-family:var(--mono,monospace);font-size:.7rem}"
    + ".mmgr .mmpaths .ok{color:#7c7}.mmgr .mmpaths .bad{color:#e66}.mmgr .mmpaths .unk{color:var(--dim,#999)}.mmgr .mmpaths .st{width:16px;text-align:center}";
  function css() { if (document.getElementById("mmPathsCss")) return; var st = document.createElement("style"); st.id = "mmPathsCss"; st.textContent = CSS; document.head.appendChild(st); }

  function load() {
    S.loading = jget("/api/comfy/extrapaths").then(function (j) { S.data = j; S.loading = null; paint(); return j; })
      .catch(function (e) { S.data = { error: String(e.message || e) }; S.loading = null; paint(); });
    return S.loading;
  }
  function render(host, sayFn) {
    S.host = host; S.say = sayFn || S.say; css();
    if (!S.data && !S.loading) load(); else paint();
  }

  function rowHtml(p, known) {
    var st = known ? (p.exists ? '<span class="st ok" title="' + esc(p.abs) + ' - the folder is there">✓</span>' : '<span class="st bad" title="' + esc(p.abs) + ' - no such folder">✗</span>') : '<span class="st unk" title="not saved yet">…</span>';
    return '<div class="r xprow"><input class="xpkey" list="xpKeys" value="' + esc(p.key) + '" placeholder="checkpoints" aria-label="Folder type">'
      + '<input class="xpval" value="' + esc(p.value) + '" placeholder="models/checkpoints - or a full path" aria-label="Path">'
      + '<button class="ghost" type="button" data-xppick title="Pick the folder">📁</button>' + st
      + '<button class="ghost" type="button" data-xpdelrow title="Remove this path (💾 Save writes it)">🗑</button></div>';
  }
  function groupHtml(g) {
    var d = S.drafts[g.name], v = d || { rename: g.name, base_path: g.base_path, is_default: g.is_default, paths: g.paths };
    return '<div class="xpg' + (d ? " dirty" : "") + '" data-xpg="' + esc(g.name) + '"><div class="gh">'
      + '<input class="xpname" value="' + esc(v.rename) + '" aria-label="Group name" title="The group\'s name in the file">'
      + '<label title="is_default: ComfyUI lists these folders first and saves into them"><input type="checkbox" class="xpdef"' + (v.is_default ? " checked" : "") + '> is_default</label>'
      + (g.managed ? '<span class="xpn">' + esc(g.managed) + "</span>" : "") + '<span class="sp"></span>'
      + '<button class="ghost" type="button" data-xpsave' + (d ? "" : " disabled") + '>💾 Save</button>'
      + '<button class="ghost" type="button" data-xprevert' + (d ? "" : " disabled") + ' title="Forget the changes">↶</button>'
      + '<button class="ghost" type="button" data-xpdelg title="Delete this group from the file">🗑 Delete group</button></div>'
      + '<div class="r"><span class="lab">base_path</span><input class="xpbase" value="' + esc(v.base_path) + '" placeholder="the folder the paths below are inside" aria-label="base_path">'
      + '<button class="ghost" type="button" data-xppick="base" title="Pick the folder">📁</button>'
      + (d ? '<span class="st unk">…</span>' : (g.base_path ? (g.base_exists ? '<span class="st ok" title="' + esc(g.base_abs) + '">✓</span>' : '<span class="st bad" title="' + esc(g.base_abs) + ' - no such folder">✗</span>') : '<span class="st"></span>')) + '<span style="width:26px"></span></div>'
      + v.paths.map(function (p) { return rowHtml(p, !d); }).join("")
      + '<div><button class="ghost" type="button" data-xpadd>+ path</button></div></div>';
  }
  function paint() {
    var h = S.host; if (!h) return;
    var j = S.data;
    if (!j) { h.innerHTML = '<div class="xpn">reading extra_model_paths.yaml…</div>'; return; }
    var head = '<div class="xph"><b>📄</b><code title="' + esc(j.file || "") + '">' + esc(j.file || "no file") + '</code>'
      + (j.error ? "" : (j.exists ? "" : '<span class="xpn">(not made yet - ➕ makes it)</span>'))
      + '<button class="ghost" type="button" id="xpNew"' + (j.error ? " disabled" : "") + ' title="A new group of paths - pick its base folder">➕ New group (' + esc(j.next || "other_ui1") + ')</button>'
      + '<button class="ghost" type="button" id="xpRestart" title="ComfyUI reads extra_model_paths.yaml only when it starts - stop it and start it again">⟳ Restart ComfyUI</button>'
      + '<button class="ghost" type="button" id="xpReload" title="Read the file again">↻</button></div>';
    var body = "";
    if (j.error) body = '<div class="xpw">' + esc(j.error) + "</div>";
    else {
      body += '<div class="xpn">ComfyUI reads this file when it starts - ⟳ Restart ComfyUI after a change. A path is relative to its group\'s base_path. The previous file is kept as extra_model_paths.yaml.bak.</div>';
      if ((j.also_found || []).length) body += '<div class="xpw">also found (ComfyUI does not read these): ' + j.also_found.map(esc).join(" · ") + "</div>";
      (j.warnings || []).forEach(function (w) { body += '<div class="xpw">⚠ ' + esc(w) + "</div>"; });
      body += (j.groups || []).length ? j.groups.map(groupHtml).join("") : '<div class="xpn">no groups yet - ➕ New group adds one</div>';
      body += '<datalist id="xpKeys">' + (j.keys || []).map(function (k) { return '<option value="' + esc(k) + '">'; }).join("") + "</datalist>";
    }
    h.innerHTML = head + body;
    bind();
  }

  function collect(card) {
    return { name: card.dataset.xpg, rename: card.querySelector(".xpname").value.trim(), base_path: card.querySelector(".xpbase").value.trim(),
      is_default: card.querySelector(".xpdef").checked,
      paths: [].map.call(card.querySelectorAll(".xprow"), function (r) { return { key: r.querySelector(".xpkey").value.trim(), value: r.querySelector(".xpval").value.trim() }; }) };
  }
  function dirty(card) {
    S.drafts[card.dataset.xpg] = collect(card);
    card.classList.add("dirty");
    card.querySelector("[data-xpsave]").disabled = false; card.querySelector("[data-xprevert]").disabled = false;
  }
  function after(j, okMsg) {
    S.busy = false;
    if (j.conflict) { say(j.error, "bad"); return load(); }
    if (j.error) { say(j.error, "bad"); return; }
    S.data = j; paint();
    var m = okMsg + " - ⟳ Restart ComfyUI to use it", done = function () { say(m, "ok"); };
    say(m, "ok");
    // the cards read the folders again (the Models / LoRAs tabs); its own "N models" line must not hide what was saved
    try { if (root.H3ModelMgr && root.H3ModelMgr.load) return Promise.resolve(root.H3ModelMgr.load(true)).then(done, done); } catch (e) { /* fine */ }
  }
  function pick(title, start) {
    if (root.FileDialog && root.FileDialog.open) return root.FileDialog.open({ mode: "dir", title: title, okLabel: "Select", key: "extrapaths", start: start || "" }).then(function (x) { return x ? (x.path || x.dir || "") : ""; });
    var t = root.prompt(title, start || ""); return Promise.resolve(t ? t.trim() : "");
  }
  function newGroup() {
    var j = S.data || {};
    return pick("The base folder of " + (j.next || "the new group") + " (another UI's install, a model drive …)", "").then(function (dir) {
      if (!dir) { say("➕ no folder picked - no group added"); return; }
      return jpost("/api/comfy/extrapaths/group", { base_path: dir, mtime: j.mtime }).then(function (r) { after(r, "➕ " + (r.name || "") + " added with " + ((r.groups || []).filter(function (g) { return g.name === r.name; })[0] || { paths: [] }).paths.length + " paths"); });
    });
  }
  function save(card) {
    var d = collect(card);
    return jpost("/api/comfy/extrapaths/save", Object.assign({ mtime: S.data.mtime }, d)).then(function (r) {
      if (!r.error) { delete S.drafts[d.name]; if (r.name !== d.name) delete S.drafts[r.name]; }
      after(r, "💾 " + (r.name || d.name) + " saved");
    });
  }
  function delGroup(card) {
    var name = card.dataset.xpg;
    var ask = "Delete the group “" + name + "” from extra_model_paths.yaml?\nThe folders and models stay on the disk - ComfyUI just stops looking in them after a restart.";
    var c = root.appConfirm ? root.appConfirm(ask) : Promise.resolve(root.confirm(ask));
    return Promise.resolve(c).then(function (ok) {
      if (!ok) return;
      return jpost("/api/comfy/extrapaths/delete", { name: name, mtime: S.data.mtime }).then(function (r) { if (!r.error) delete S.drafts[name]; after(r, "🗑 " + name + " deleted"); });
    });
  }
  function restart() {
    var b = document.getElementById("xpRestart"); if (b) b.disabled = true;
    say("⟳ restarting ComfyUI…");
    return jpost("/api/comfy/restart", {}).then(function (r) {
      if (b) b.disabled = false;
      if (r.error) { say("⟳ " + r.error, "bad"); return r; }
      if (!r.ok) { say("⟳ " + (r.reason || "not restarted"), "bad"); return r; }
      say(r.restarted ? "⟳ ComfyUI stopped and starting again - it reads the model paths as it starts (the app console shows it)" : "⟳ ComfyUI was not running - it is starting now", "ok");
      return r;
    }).catch(function (e) { if (b) b.disabled = false; say("⟳ " + e.message, "bad"); });
  }

  function bind() {
    var h = S.host;
    h.onkeydown = function (e) { e.stopPropagation(); };   // typing a path is not an app shortcut
    var q = function (id) { return document.getElementById(id); };
    if (q("xpNew")) q("xpNew").onclick = newGroup;
    if (q("xpRestart")) q("xpRestart").onclick = restart;
    if (q("xpReload")) q("xpReload").onclick = function () { S.drafts = {}; load(); };
    h.querySelectorAll(".xpg").forEach(function (card) {
      card.addEventListener("input", function () { dirty(card); });
      card.addEventListener("change", function () { dirty(card); });
      card.addEventListener("click", function (e) {
        var t = e.target.closest("button"); if (!t || t.disabled) return;
        if (t.hasAttribute("data-xpsave")) return save(card);
        if (t.hasAttribute("data-xprevert")) { delete S.drafts[card.dataset.xpg]; paint(); return; }
        if (t.hasAttribute("data-xpdelg")) return delGroup(card);
        if (t.hasAttribute("data-xpdelrow")) { t.closest(".xprow").remove(); dirty(card); return; }
        if (t.hasAttribute("data-xpadd")) {
          var w = document.createElement("div"); w.innerHTML = rowHtml({ key: "", value: "" }, false);
          t.parentNode.parentNode.insertBefore(w.firstChild, t.parentNode); dirty(card);
          var rows = card.querySelectorAll(".xprow"); rows[rows.length - 1].querySelector(".xpkey").focus(); return;
        }
        if (t.hasAttribute("data-xppick")) {
          var isBase = t.getAttribute("data-xppick") === "base", inp = isBase ? card.querySelector(".xpbase") : t.closest(".xprow").querySelector(".xpval");
          var base = card.querySelector(".xpbase").value.trim();
          pick(isBase ? "The base folder of " + card.dataset.xpg : "The folder for " + (t.closest(".xprow").querySelector(".xpkey").value || "this path"), isBase ? inp.value : base).then(function (dir) {
            if (!dir) return; inp.value = isBase ? dir : relTo(base, dir); dirty(card);
          });
        }
      });
    });
  }

  root.H3ModelPaths = { render: render, load: load, state: function () { return S; }, restart: restart, relTo: relTo };
})(typeof window !== "undefined" ? window : this);
