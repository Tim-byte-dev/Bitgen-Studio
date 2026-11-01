/* bitGen Studio — THE ASSETS DOCK: select, group, send, delete (2.327.0).
 *
 * Tim (verbatim): "allow user to select multiple items from the asset
 * folder and group them. allow user to delete assets (send to recycle bin)
 * create new folders for groups, allow user to add assets to group or send
 * asset to a group". Answers: groups are FOLDERS IN THE DOCK (the files stay
 * where they are, so nothing that uses them breaks) · one group can mix
 * pictures, videos and sounds (each tab shows the group with its items of
 * that kind) · ADD = also in that group, SEND = moves out of the group it
 * was picked in.
 *
 *   SELECT   the ☐ on a tile, Ctrl/⌘-click, Shift-click for a range; once
 *            something is selected a plain click toggles too. Ctrl+A in the
 *            dock selects the tab, Esc clears. (A plain click with nothing
 *            selected still opens the lightbox, as before.)
 *   THE BAR  📁＋ New group · then, with a selection: 🗂 Group (a new group
 *            of the selection) · ＋ Add to ▾ · ➜ Send to ▾ · ⊖ Out of group
 *            · 🗑 Delete · ✕
 *   GROUPS   a folder header per group (▾ collapse, ⋯ Rename / Select all /
 *            Delete group - its assets stay); drop tiles on a header to SEND
 *            them there, hold Ctrl while dropping to ADD instead
 *   DELETE   🗑 or the Delete key: to projects/<name>/recycle_bin (never a
 *            hard delete); asks first when Settings -> Confirm delete is on
 *            or when the project still uses a file (a scene take, a
 *            timeline clip, a reference)
 * Server: routes/assets.js + lib/assetGroups.js.
 *
 * 2.635.0 (Tim: "add a dropdown to the top of assets dialog, Global, Project or All, global assets will be kept in
 * project root/Assets, project assets will be kept in project name/Assets, folders in the assets folders will be a
 * group" + "new uploads live in project name/assets, right click context menu will have "move to Global""):
 *   SCOPE    the dock's head: Project ▾ | Global | All (remembered) - GET /api/passets?scope= and its groups
 *   GROUPS   now the FOLDERS of <projects root>/Assets (🌐 global) and projects/<name>/Assets (📁 project) -
 *            SEND moves the file into the folder, ADD links it there too, ⊖ puts it back in the Assets folder itself
 *   RIGHT-CLICK a tile (or the selection): 🌐 Move to Global / 📁 Move to Project, 🗂 Group, 🗑 Delete
 *   UPLOADS  into the project's Assets folder (the Global view: the global one)
 *   lib/assetLibrary.js does the files (and keeps each in the project's type folder under its name).
 *
 * window.AssetGroups = {
 *   install(ctx)   ctx = { $, assetItem(kind, a), refresh(), confirm(msg),
 *                  ask(title, label, value), note(msg), cfg(), drag() }
 *   paint(kind, pane, list)  the tab's sections (called by refreshAssets)
 *   load()         GET the groups
 *   sections(kind, list, groups) (pure) -> [{id, name, items, total}]
 *   state          { groups, sel: Map, anchor }
 * } */
(function () {
  "use strict";
  var S = { groups: [], sel: new Map(), anchor: null, last: {}, ctx: null, scope: "project" };
  try { var sc0 = localStorage.getItem("ag.scope"); if (sc0 === "global" || sc0 === "all" || sc0 === "project") S.scope = sc0; } catch (e) { /* project */ }
  function scope() { return S.scope; }
  function setScope(v) {
    S.scope = v === "global" || v === "all" ? v : "project";
    try { localStorage.setItem("ag.scope", S.scope); } catch (e) { /* this session only */ }
    var sel = document.getElementById("assetScope"); if (sel) sel.value = S.scope;
    S.sel.clear();
    return Promise.resolve(S.ctx && S.ctx.refresh ? S.ctx.refresh() : null);
  }
  var itemOf = function (s) { return { kind: s.kind, name: s.name, from: s.from || "" }; };
  var keyOf = function (kind, name) { return kind + "/" + name; };
  function col(id, v) {
    try {
      if (v === undefined) return localStorage.getItem("ag.col." + id) === "1";
      localStorage.setItem("ag.col." + id, v ? "1" : "0");
    } catch (e) { return false; }
  }

  /** The tab's sections: every group (with its items of THIS kind, even
   *  when that is none - it is still a place to drop into), then Ungrouped. */
  function sections(kind, list, groups) {
    var by = {};
    (list || []).forEach(function (a) { by[a.name] = a; });
    var grouped = {};
    var out = (groups || []).map(function (g) {
      var its = (g.items || []).filter(function (it) { return it.kind === kind && by[it.name]; })
        .map(function (it) { grouped[it.name] = true; return by[it.name]; });
      return { id: g.id, name: g.name, scope: g.scope || "project", items: its, total: (g.items || []).length };
    });
    var rest = (list || []).filter(function (a) { return !grouped[a.name]; });
    out.push({ id: "", name: "Ungrouped", items: rest, total: rest.length });
    return out;
  }

  function api(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); });
  }
  function load() {
    return fetch("/api/passets/groups?scope=" + S.scope).then(function (r) { return r.json(); })
      .then(function (j) { S.groups = (j && j.groups) || []; return S.groups; })
      .catch(function () { return S.groups; });
  }
  function selected() {
    var out = [];
    S.sel.forEach(function (v) { out.push(v); });
    return out;
  }
  /** Done-lines go in the bar for a few seconds; ⚠ refusals (a clashing
   *  group name ...) also open the app's note dialog so they are not missed. */
  function note(t) {
    if (!t) return;
    var m = document.querySelector("#agBar .agmsg");
    if (m) {
      m.textContent = t; m.title = t;
      clearTimeout(S.msgT); S.msgT = setTimeout(function () { m.textContent = ""; }, 5000);
    }
    if (/^⚠/.test(t) && S.ctx && S.ctx.note) S.ctx.note(t.replace(/^⚠\s*/, ""));
  }

  // ------------------------------------------------------------ painting
  function paint(kind, pane, list) {
    S.last[kind] = { pane: pane, list: list };
    pane.innerHTML = "";
    var secs = sections(kind, list, S.groups);
    var any = secs.some(function (s) { return s.items.length; }) || S.groups.length;
    if (!any) { pane.innerHTML = '<span class="modehint">empty — drop files above</span>'; return; }
    secs.forEach(function (sec) {
      var plain = !S.groups.length && !sec.id;
      var body = pane;
      if (!plain) {
        var shut = col(sec.id || "__ungrouped");
        var h = document.createElement("div");
        h.className = "aghead" + (sec.id ? "" : " agun");
        h.dataset.gid = sec.id;
        h.title = sec.id ? sec.name + " — " + sec.items.length + " here, " + sec.total + " in the group (drop assets here to move them in; hold Ctrl to add)" : "Assets in no group";
        h.innerHTML = '<span class="agcar">' + (shut ? "▸" : "▾") + '</span><span class="agic">' + (sec.id ? (sec.scope === "global" ? "🌐" : "📁") : "🗃") + "</span>"
          + '<span class="agnm"></span><span class="agn">' + sec.items.length + "</span>"
          + (sec.id ? '<button type="button" class="agmore" title="Group menu" aria-label="Group menu">⋯</button>' : "");
        h.querySelector(".agnm").textContent = sec.name;
        pane.appendChild(h);
        body = document.createElement("div");
        body.className = "agbody";
        body.dataset.gid = sec.id;
        if (shut) body.style.display = "none";
        pane.appendChild(body);
        wireHead(h, body, sec, kind);
        if (!sec.items.length && sec.id) {
          var e = document.createElement("div"); e.className = "modehint agempty";
          e.textContent = "no " + (kind === "images" ? "pictures" : kind === "video" ? "videos" : "sounds") + " in this group — drop some here";
          body.appendChild(e);
        }
      }
      sec.items.forEach(function (a) { body.appendChild(tile(kind, a, sec.id)); });
    });
  }
  function tile(kind, a, from) {
    var el = S.ctx.assetItem(kind, a);
    var k = keyOf(kind, a.name);
    el.dataset.agkey = k; el.dataset.agkind = kind; el.dataset.agname = a.name; el.dataset.from = from || "";
    el.dataset.agscope = a.scope || "project";
    if (a.scope === "global") {                                        // 2.635.0: a global asset says so
      var gb = document.createElement("span"); gb.className = "agglob"; gb.textContent = "🌐"; gb.title = "Global asset - every project has it";
      el.appendChild(gb);
    }
    var chk = document.createElement("span");
    chk.className = "agchk"; chk.setAttribute("role", "checkbox"); chk.title = "Select";
    el.appendChild(chk);
    if (S.sel.has(k)) { el.classList.add("agsel"); chk.setAttribute("aria-checked", "true"); }
    return el;
  }
  function repaint() {
    Object.keys(S.last).forEach(function (k) { paint(k, S.last[k].pane, S.last[k].list); });
    bar();
  }
  function markSel() {
    Array.prototype.forEach.call(document.querySelectorAll("#assetsdock [data-agkey]"), function (el) {
      var on = S.sel.has(el.dataset.agkey);
      el.classList.toggle("agsel", on);
      var c = el.querySelector(".agchk"); if (c) c.setAttribute("aria-checked", on ? "true" : "false");
    });
    var dock = document.getElementById("assetsdock");
    if (dock) dock.classList.toggle("agselecting", S.sel.size > 0);
    bar();
  }

  // ------------------------------------------------------------ the bar
  function bar() {
    var b = document.getElementById("agBar"); if (!b) return;
    var n = S.sel.size;
    b.querySelector(".agcount").textContent = n ? n + " selected" : "";
    Array.prototype.forEach.call(b.querySelectorAll("[data-needsel]"), function (x) { x.style.display = n ? "" : "none"; });
    var fromAny = selected().some(function (s) { return s.from; });
    var out = b.querySelector('[data-act="ungroup"]'); if (out) out.disabled = !fromAny;
  }
  function menu(anchor, items) {
    closeMenu();
    var m = document.createElement("div"); m.className = "agmenu";
    items.forEach(function (it) {
      if (it === "-") { m.appendChild(document.createElement("hr")); return; }
      var b = document.createElement("button"); b.type = "button"; b.textContent = it[0];
      if (it[2]) b.disabled = true;
      b.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); it[1](); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.left = Math.min(r.left, window.innerWidth - 220) + "px";
    m.style.top = Math.min(r.bottom + 2, window.innerHeight - 30 * items.length - 10) + "px";
    setTimeout(function () { document.addEventListener("mousedown", outside, true); }, 0);
  }
  function outside(e) { var m = document.querySelector(".agmenu"); if (m && !m.contains(e.target)) closeMenu(); }
  function closeMenu() {
    var m = document.querySelector(".agmenu"); if (m) m.remove();
    document.removeEventListener("mousedown", outside, true);
  }

  // ------------------------------------------------------------ operations
  function after(j, msg) {
    if (j && j.groups) S.groups = j.groups;
    if (j && j.error) { note("⚠ " + j.error); repaint(); return j; }
    if (msg) note(msg);
    repaint();
    return j;
  }
  function newGroup(withSel) {
    var its = withSel ? selected().map(itemOf) : [];
    return Promise.resolve(S.ctx.ask("New group", "Group name", "Group " + (S.groups.length + 1))).then(function (name) {
      if (name == null || !String(name).trim()) return null;
      return api("/api/passets/groups", { op: "create", name: name, items: its, scope: S.scope === "global" ? "global" : "project" }).then(function (j) {
        if (!j.error && withSel) S.sel.clear();
        return after(j, j.error ? "" : "group “" + name.trim() + "” made" + (its.length ? " with " + its.length + " asset(s)" : ""));
      });
    });
  }
  function addTo(gid, list) {
    var its = (list || selected()).map(function (s) { return { kind: s.kind, name: s.name }; });
    return api("/api/passets/groups", { op: "add", id: gid, items: its, scope: S.scope }).then(function (j) {
      var g = (j.groups || []).find(function (x) { return x.id === gid; });
      return after(j, j.error ? "" : its.length + " asset(s) added to “" + (g ? g.name : "the group") + "”");
    });
  }
  /** SEND: out of the group each was picked in (Ungrouped ones just join). */
  function sendTo(gid, list) {
    var sel = list || selected();
    var byFrom = {};
    sel.forEach(function (s) { var f = s.from || ""; (byFrom[f] = byFrom[f] || []).push({ kind: s.kind, name: s.name }); });
    var chain = Promise.resolve({});
    Object.keys(byFrom).forEach(function (f) {
      if (f === gid) return;
      chain = chain.then(function () {
        return api("/api/passets/groups", { op: "send", id: gid, items: byFrom[f], from: f, scope: S.scope });   // 2.635.0: "" = out of the Assets folder itself
      });
    });
    return chain.then(function (j) {
      if (!list) S.sel.clear();
      var g = ((j && j.groups) || S.groups).find(function (x) { return x.id === gid; });
      return after(j, j && j.error ? "" : sel.length + " asset(s) moved to “" + (g ? g.name : "the group") + "”");
    });
  }
  function ungroup() {
    var byFrom = {};
    selected().forEach(function (s) { if (s.from) (byFrom[s.from] = byFrom[s.from] || []).push({ kind: s.kind, name: s.name }); });
    var chain = Promise.resolve({});
    Object.keys(byFrom).forEach(function (f) {
      chain = chain.then(function () { return api("/api/passets/groups", { op: "ungroup", id: f, items: byFrom[f], scope: S.scope }); });
    });
    return chain.then(function (j) { S.sel.clear(); return after(j, "taken out of the group (the files stay)"); });
  }
  function del() {
    var its = selected().map(function (s) { return { kind: s.kind, name: s.name }; });
    if (!its.length) return Promise.resolve(null);
    return api("/api/passets/usage", { items: its }).then(function (u) {
      var used = (u && u.inUse) || [];
      var ask = ((S.ctx.cfg() || {}).ui || {}).confirm_delete || used.length;
      var msg = "Move " + its.length + " asset(s) to the recycle bin?"
        + (used.length ? "\n\nStill used in this project (a scene, the timeline or a reference): "
          + used.map(function (x) { return x.name; }).join(", ") + " — those places will show them missing." : "")
        + "\n\nThey can be taken back from projects/<name>/recycle_bin.";
      return Promise.resolve(ask ? S.ctx.confirm(msg) : true);
    }).then(function (go) {
      if (!go) return null;
      return api("/api/passets/recycle", { items: its, scope: S.scope }).then(function (j) {
        if (j && j.groups) S.groups = j.groups;
        S.sel.clear();
        note(j && j.error ? "⚠ " + j.error : (j.moved || []).length + " asset(s) moved to the recycle bin");
        return Promise.resolve(S.ctx.refresh()).then(function () { bar(); return j; });
      });
    });
  }
  /** 2.635.0: 🌐 Move to Global / 📁 Move to Project - the files move between the Assets folders (their group kept) */
  function moveScope(list, to) {
    var its = list.map(itemOf);
    return api("/api/passets/scope", { items: its, to: to, scope: S.scope }).then(function (j) {
      S.sel.clear();
      note(j && j.error ? "⚠ " + j.error : (j.moved || []).length + " asset(s) moved to " + (to === "global" ? "Global" : "the project")
        + ((j.failed || []).length ? " - ⚠ " + j.failed.map(function (f) { return f.error; }).join(", ") : ""));
      return Promise.resolve(S.ctx.refresh()).then(function () { bar(); return j; });
    });
  }
  function tileMenu(e) {
    var el = e.target.closest && e.target.closest("[data-agkey]");
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    var me = { kind: el.dataset.agkind, name: el.dataset.agname, from: el.dataset.from || "", scope: el.dataset.agscope || "project" };
    if (!S.sel.has(el.dataset.agkey)) { S.sel.clear(); S.sel.set(el.dataset.agkey, me); markSel(); }
    var list = [];
    S.sel.forEach(function (v, k) {
      var t = document.querySelector('#assetsdock [data-agkey="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
      list.push(Object.assign({}, v, { scope: v.scope || (t ? t.dataset.agscope : "project") }));
    });
    var proj = list.filter(function (x) { return x.scope !== "global"; }), glob = list.filter(function (x) { return x.scope === "global"; });
    var at = { getBoundingClientRect: function () { return { left: e.clientX, bottom: e.clientY }; } };
    menu(at, [
      ["🌐 Move to Global" + (list.length > 1 ? " (" + proj.length + ")" : ""), function () { moveScope(proj, "global"); }, !proj.length],
      ["📁 Move to Project" + (list.length > 1 ? " (" + glob.length + ")" : ""), function () { moveScope(glob, "project"); }, !glob.length],
      "-",
      ["🗂 New group with " + (list.length > 1 ? "these" : "this") + "…", function () { newGroup(true); }],
      ["🗑 Delete…", function () { del(); }],
    ]);
  }
  function groupMenu(btn, sec, kind) {
    menu(btn, [
      ["Rename…", function () {
        Promise.resolve(S.ctx.ask("Rename group", "Group name", sec.name)).then(function (name) {
          if (name == null || !String(name).trim() || name.trim() === sec.name) return;
          api("/api/passets/groups", { op: "rename", id: sec.id, name: name, scope: S.scope }).then(function (j) { after(j, j.error ? "" : "group renamed"); });
        });
      }],
      ["Select all in this group", function () {
        sec.items.forEach(function (a) { S.sel.set(keyOf(kind, a.name), { kind: kind, name: a.name, from: sec.id, scope: a.scope || "project" }); });
        markSel();
      }],
      "-",
      ["Delete group (the assets stay)", function () {
        Promise.resolve(S.ctx.confirm("Delete the group “" + sec.name + "”? Its folder goes - its assets move back into the " + (sec.scope === "global" ? "global" : "project's") + " Assets folder (nothing is deleted).")).then(function (ok) {
          if (!ok) return;
          api("/api/passets/groups", { op: "delete", id: sec.id, scope: S.scope }).then(function (j) { after(j, j.error ? "" : "group deleted — its assets stay"); });
        });
      }],
    ]);
  }
  function groupPick(btn, how) {
    var items = S.groups.map(function (g) { return [(g.scope === "global" ? "🌐 " : "📁 ") + g.name, function () { return how === "add" ? addTo(g.id) : sendTo(g.id); }]; });
    if (items.length) items.push("-");
    items.push(["New group…", function () {
      Promise.resolve(S.ctx.ask("New group", "Group name", "Group " + (S.groups.length + 1))).then(function (name) {
        if (name == null || !String(name).trim()) return;
        api("/api/passets/groups", { op: "create", name: name, scope: S.scope === "global" ? "global" : "project" }).then(function (j) {
          if (j.error) return after(j);
          S.groups = j.groups;
          return how === "add" ? addTo(j.group.id) : sendTo(j.group.id);
        });
      });
    }]);
    menu(btn, items);
  }

  // ------------------------------------------------------------ wiring
  function wireHead(h, body, sec, kind) {
    h.addEventListener("click", function (e) {
      if (e.target.closest(".agmore")) { e.stopPropagation(); groupMenu(e.target.closest(".agmore"), sec, kind); return; }
      var shut = body.style.display !== "none";
      body.style.display = shut ? "none" : "";
      h.querySelector(".agcar").textContent = shut ? "▸" : "▾";
      col(sec.id || "__ungrouped", shut);
    });
    if (!sec.id) return;
    h.addEventListener("dblclick", function (e) { e.preventDefault(); });
    h.addEventListener("dragover", function (e) {
      var d = S.ctx.drag();
      if (!d || d.type !== "asset") return;
      e.preventDefault(); e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move"; h.classList.add("agdrop");
    });
    h.addEventListener("dragleave", function () { h.classList.remove("agdrop"); });
    h.addEventListener("drop", function (e) {
      h.classList.remove("agdrop");
      var d = S.ctx.drag();
      if (!d || d.type !== "asset") return;
      e.preventDefault(); e.stopPropagation();
      var k = keyOf(d.kind, d.name);
      var list = S.sel.has(k) ? selected() : [{ kind: d.kind, name: d.name, from: S.dragFrom || "" }];
      if (e.ctrlKey || e.metaKey) addTo(sec.id, list); else sendTo(sec.id, list);
    });
  }

  function onClick(e) {
    var el = e.target.closest && e.target.closest("[data-agkey]");
    if (!el) return;
    if (e.target.closest(".atr") || (e.target.closest("button") && !e.target.closest(".agchk"))) return;
    var onChk = !!e.target.closest(".agchk");
    if (!onChk && !e.ctrlKey && !e.metaKey && !e.shiftKey && !S.sel.size) return;   // the lightbox, as before
    e.preventDefault(); e.stopPropagation();
    var k = el.dataset.agkey, it = { kind: el.dataset.agkind, name: el.dataset.agname, from: el.dataset.from || "", scope: el.dataset.agscope || "project" };
    if (e.shiftKey && S.anchor) {
      var pane = el.closest("[data-apane]");
      var tiles = Array.prototype.slice.call(pane.querySelectorAll("[data-agkey]"));
      var a = tiles.indexOf(S.anchor.el), b = tiles.indexOf(el);
      if (a >= 0 && b >= 0) {
        tiles.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(function (t) {
          S.sel.set(t.dataset.agkey, { kind: t.dataset.agkind, name: t.dataset.agname, from: t.dataset.from || "", scope: t.dataset.agscope || "project" });
        });
        markSel(); return;
      }
    }
    if (S.sel.has(k)) S.sel.delete(k); else S.sel.set(k, it);
    S.anchor = { el: el };
    markSel();
  }
  function onKey(e) {
    var a = document.activeElement;
    var typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
    if (typing || document.querySelector("dialog[open]")) return;
    var dock = document.getElementById("assetsdock");
    var inDock = dock && (dock.contains(a) || dock.matches(":hover"));
    if (e.key === "Delete" && S.sel.size) {
      e.preventDefault(); e.stopImmediatePropagation(); del(); return;
    }
    if (e.key === "Escape" && S.sel.size) { S.sel.clear(); markSel(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && inDock) {
      e.preventDefault();
      var pane = dock.querySelector("[data-apane].active");
      if (!pane) return;
      Array.prototype.forEach.call(pane.querySelectorAll("[data-agkey]"), function (t) {
        S.sel.set(t.dataset.agkey, { kind: t.dataset.agkind, name: t.dataset.agname, from: t.dataset.from || "", scope: t.dataset.agscope || "project" });
      });
      markSel();
    }
  }

  function install(ctx) {
    S.ctx = ctx;
    var tabs = document.getElementById("assettabs");
    if (tabs && !document.getElementById("agBar")) {
      var b = document.createElement("div");
      b.id = "agBar"; b.className = "agbar";
      b.innerHTML = '<button type="button" class="ghost gbtn" data-act="new" title="New group — a folder in this dock (the files stay where they are)">📁＋</button>'
        + '<span class="agcount"></span>'
        + '<button type="button" class="ghost gbtn" data-act="group" data-needsel title="Group — a new group holding the selected assets">🗂 Group</button>'
        + '<button type="button" class="ghost gbtn" data-act="add" data-needsel title="Add to a group — they stay in any group they are already in">＋ Add to ▾</button>'
        + '<button type="button" class="ghost gbtn" data-act="send" data-needsel title="Send to a group — moves them out of the group they were picked in">➜ Send to ▾</button>'
        + '<button type="button" class="ghost gbtn" data-act="ungroup" data-needsel title="Take out of the group they were picked in (the files stay)">⊖</button>'
        + '<button type="button" class="ghost gbtn" data-act="del" data-needsel title="Delete — move to the project\'s recycle bin (Delete key)">🗑</button>'
        + '<button type="button" class="ghost gbtn" data-act="clear" data-needsel title="Clear the selection (Esc)">✕</button>'
        + '<span class="agmsg" aria-live="polite"></span>';
      tabs.parentNode.insertBefore(b, tabs.nextSibling);
      b.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-act]"); if (!btn) return;
        var act = btn.dataset.act;
        if (act === "new") newGroup(false);
        else if (act === "group") newGroup(true);
        else if (act === "add") groupPick(btn, "add");
        else if (act === "send") groupPick(btn, "send");
        else if (act === "ungroup") ungroup();
        else if (act === "del") del();
        else if (act === "clear") { S.sel.clear(); markSel(); }
      });
      bar();
    }
    var head = document.querySelector("#assetsdock .dockhead");
    if (head && !document.getElementById("assetScope")) {          // 2.635.0: Project | Global | All
      var sel = document.createElement("select");
      sel.id = "assetScope"; sel.className = "agscope";
      sel.title = "Which assets: this project's (projects/<name>/Assets), the global ones every project has (<projects>/Assets), or both";
      sel.innerHTML = '<option value="project">📁 Project</option><option value="global">🌐 Global</option><option value="all">All</option>';
      sel.value = S.scope;
      sel.addEventListener("change", function () { setScope(sel.value); });
      head.appendChild(sel);
    }
    var scroll = document.getElementById("assetscroll");
    if (scroll) {
      scroll.addEventListener("contextmenu", tileMenu, true);   // 2.635.0: Move to Global / Project
      scroll.addEventListener("click", onClick, true);
      scroll.addEventListener("dragstart", function (e) {
        var t = e.target.closest && e.target.closest("[data-agkey]");
        S.dragFrom = t ? t.dataset.from || "" : "";
      }, true);
    }
    window.addEventListener("keydown", onKey, true);
  }

  window.AssetGroups = { install: install, paint: paint, load: load, sections: sections, repaint: repaint,
                         state: S, newGroup: newGroup, addTo: addTo, sendTo: sendTo, ungroup: ungroup, del: del,
                         markSel: markSel, scope: scope, setScope: setScope, moveScope: moveScope };
})();
