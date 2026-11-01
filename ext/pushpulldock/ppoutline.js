/* bitGen Studio — ext/pushpulldock/ppoutline.js (2.639.0): THE SKETCHER'S 🗂 OUTLINE DOCKER (window.PPOutline) - every
 * object of the building listed; rooms with their parts; room groups; 👁 hide / show.
 * Tim (verbatim): "add a docker to sketcher, show each object in the docker like ceilings - ceiling 1, ceiling 2 etc. when a
 * room is drawn show the walls,ceiling,doors,windows, floors,cornices,skirting/trim in the docker under room name (room 1,
 * room 2 etc) ... shift+click selects an entire room - allow user to make room groups and items in the groups
 * hidden/visible."
 *
 *   🗂 Outline (the Sketcher's bar) shows / hides the docker on the left of the view (remembered).
 *   ROOM GROUPS  ＋ makes one; a room's ⊞ puts it in a group (or out); a group's 👁 hides / shows all its rooms, ✎ renames,
 *                ✕ deletes the group (its rooms stay)
 *   ROOMS        Room 1 ▸ Wall 1 … Wall n, Floor 1, Ceiling 1, Skirting 1, Cornice 1, Floor slab 1, Door 1, Window 1 …
 *   ALSO         Walls (free-standing), Roofs, Floors (slabs), Stairs, Lights, Furniture, Cameras
 *   A click on a row picks it (as a click in the view does); 👁 on any row hides / shows it (undo-able, saved with the
 *   model - arch.hide keys, pparch.hiddenOf; arch.groups).
 * Pure (Node: scripts/test-outline639.js): tree(A), toggleKey(A, key), newGroup(A, name), setGroup(A, roomId, groupId),
 * removeGroup(A, id), renameGroup(A, id, name). */
(function (root) {
  "use strict";
  const P = () => root.PPArch;
  const LABEL = { door: "Door", window: "Window", opening: "Opening" };

  /** the outline: [{key, label, icon, sel?, hide?, group?, children?}] - hide = the key 👁 toggles (null: nothing to hide) */
  function tree(A) {
    if (!A) return [];
    const closed = A.rooms.filter((R) => R.closed), nOf = {}; closed.forEach((R, i) => { nOf[R.id] = i + 1; });
    const opN = { door: 0, window: 0, opening: 0 }, opNo = {};
    A.ops.forEach((o) => { opN[o.kind] = (opN[o.kind] || 0) + 1; opNo[o.id] = opN[o.kind]; });
    const roomNode = (R) => {
      const n = nOf[R.id] || 0, kids = [];
      if (R.closed) {
        const E = P().edgesOf(R);
        E.forEach((e) => kids.push({ key: "room:" + R.id + ":wall:" + e.i, label: "Wall " + (e.i + 1), icon: "▮", sel: { ak: "room", id: R.id, part: "wall", edge: e.i }, hide: "room:" + R.id + ":wall:" + e.i }));
        if (R.floorOn) kids.push({ key: "room:" + R.id + ":floor", label: "Floor " + n, icon: "▦", sel: { ak: "room", id: R.id, part: "floor" }, hide: "room:" + R.id + ":floor" });
        if (R.ceilOn) kids.push({ key: "room:" + R.id + ":ceil", label: "Ceiling " + n, icon: "⌓", sel: { ak: "room", id: R.id, part: "ceil" }, hide: "room:" + R.id + ":ceil" });
        if (R.skirtOn) kids.push({ key: "room:" + R.id + ":skirt", label: "Skirting " + n, icon: "▁", sel: { ak: "room", id: R.id, part: "skirt" }, hide: "room:" + R.id + ":skirt" });
        if (R.corniceOn) kids.push({ key: "room:" + R.id + ":cornice", label: "Cornice " + n, icon: "▔", sel: { ak: "room", id: R.id, part: "cornice" }, hide: "room:" + R.id + ":cornice" });
        if (R.slab) kids.push({ key: "room:" + R.id + ":slab", label: "Floor slab " + n, icon: "▬", sel: { ak: "room", id: R.id, part: "slab" }, hide: "room:" + R.id + ":slab" });
        A.ops.filter((o) => o.room === R.id).forEach((o) => kids.push({ key: "op:" + o.id, label: LABEL[o.kind] + " " + opNo[o.id], icon: o.kind === "window" ? "🪟" : o.kind === "door" ? "🚪" : "▯", sel: { ak: "op", id: o.id }, hide: "op:" + o.id }));
      } else P().edgesOf(R).forEach((e) => kids.push({ key: "room:" + R.id + ":wall:" + e.i, label: "Wall " + (e.i + 1), icon: "▮", sel: { ak: "room", id: R.id, part: "wall", edge: e.i }, hide: "room:" + R.id + ":wall:" + e.i }));
      return { key: "room:" + R.id, label: R.name, icon: R.closed ? "⌂" : "▮", sel: { ak: "room", id: R.id }, hide: "room:" + R.id, room: R.id, children: kids };
    };
    const grouped = new Set(), out = [];
    const groups = (A.groups || []).map((g) => { g.rooms.forEach((r) => grouped.add(r)); return { key: "group:" + g.id, label: g.name, icon: "📂", group: g.id, hidden: g.hidden, children: g.rooms.map((r) => A.rooms.find((R) => R.id === r)).filter(Boolean).map(roomNode) }; });
    out.push({ key: "sec:groups", label: "Room groups", icon: "🗂", section: "groups", children: groups });
    out.push({ key: "sec:rooms", label: "Rooms", icon: "⌂", section: "rooms", children: closed.filter((R) => !grouped.has(R.id)).map(roomNode) });
    const sec = (key, label, icon, list) => { if (list.length) out.push({ key, label, icon, section: key, children: list }); };
    sec("sec:walls", "Walls", "▮", A.rooms.filter((R) => !R.closed && !grouped.has(R.id)).map(roomNode));
    sec("sec:roofs", "Roofs", "△", A.roofs.map((x, i) => ({ key: "roof:" + x.id, label: "Roof " + (i + 1), icon: "△", sel: { ak: "roof", id: x.id }, hide: "roof:" + x.id })));
    sec("sec:slabs", "Floors", "▦", A.slabs.map((x, i) => ({ key: "slab:" + x.id, label: "Floor " + (i + 1), icon: "▦", sel: { ak: "slab", id: x.id }, hide: "slab:" + x.id })));
    sec("sec:stairs", "Stairs", "▟", A.stairs.map((x, i) => ({ key: "stair:" + x.id, label: "Stairs " + (i + 1), icon: "▟", sel: { ak: "stair", id: x.id }, hide: "stair:" + x.id })));
    sec("sec:lights", "Lights", "💡", A.lights.map((x, i) => ({ key: "light:" + x.id, label: "Light " + (i + 1) + " · " + x.type, icon: "💡", sel: { ak: "light", id: x.id }, hide: "light:" + x.id })));
    sec("sec:items", "Furniture", "🛋", (A.items || []).map((x) => ({ key: "item:" + x.id, label: root.PPFurn ? root.PPFurn.label(x) : x.type, icon: "🛋", sel: { ak: "item", id: x.id }, hide: "item:" + x.id })));
    sec("sec:cams", "Cameras", "📷", (A.cams || []).map((x) => ({ key: "cam:" + x.id, label: x.name, icon: "📷", sel: { ak: "cam", id: x.id }, hide: "cam:" + x.id })));
    return out;
  }
  function toggleKey(A, key) {
    const g = /^group:(\d+)$/.exec(key);
    if (g) { const G = (A.groups || []).find((x) => x.id === +g[1]); if (G) G.hidden = !G.hidden; return G ? !G.hidden : null; }
    A.hide = A.hide || [];
    const i = A.hide.indexOf(key);
    if (i >= 0) { A.hide.splice(i, 1); return true; }
    A.hide.push(key); return false;
  }
  const nextId = (A) => { const id = A.n || 1; A.n = id + 1; return id; };
  function newGroup(A, name, rooms) {
    A.groups = A.groups || [];
    const g = { id: nextId(A), name: String(name || "Group " + (A.groups.length + 1)).slice(0, 60), rooms: [], hidden: false, open: true };
    A.groups.push(g);
    (rooms || []).forEach((r) => setGroup(A, r, g.id));
    return g;
  }
  /** a room into a group (null: out of every group) - a room is in one group at a time */
  function setGroup(A, roomId, groupId) {
    (A.groups || []).forEach((g) => { g.rooms = g.rooms.filter((r) => r !== roomId); });
    const g = (A.groups || []).find((x) => x.id === groupId);
    if (g && A.rooms.some((R) => R.id === roomId)) g.rooms.push(roomId);
    return g || null;
  }
  function removeGroup(A, id) { const n = (A.groups || []).length; A.groups = (A.groups || []).filter((g) => g.id !== id); return A.groups.length < n; }
  function renameGroup(A, id, name) { const g = (A.groups || []).find((x) => x.id === id); if (g && String(name || "").trim()) g.name = String(name).trim().slice(0, 60); return g || null; }

  const api = { tree, toggleKey, newGroup, setGroup, removeGroup, renameGroup };
  if (typeof module !== "undefined" && module.exports && !root.document) { module.exports = api; return; }

  /* ---------------- the docker */
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const H = () => root.H3PushPull;
  const open = {};                        // which rows are unfolded (sections + rooms open by default, rooms' parts too)
  const ls = { get: (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { /* fine */ } } };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function arch() { const h = H(); return h && h.state && h.state.M ? (h.state.M.arch || null) : null; }
  function edit(label, fn) {
    const h = H(); if (!h || !h.state.M) return;
    const before = h.snapshot ? h.snapshot() : null;
    if (!h.state.M.arch) h.state.M.arch = P().empty();
    fn(h.state.M.arch);
    if (h.commit) h.commit(label, before);
    if (h.state.A) h.state.A.rebuild();
  }
  function selNow() { const h = H(); const t = h && h.state && h.state.T && h.state.T.arch ? h.state.T.arch.sel() : null; return t; }
  const sameSel = (a, b) => !!a && !!b && a.ak === b.ak && a.id === b.id && (a.part || "") === (b.part || "") && (a.edge == null ? null : a.edge) === (b.edge == null ? null : b.edge);
  /* 2.639.1: a narrow docker (a side column) keeps the view - there the outline is off until 🗂 opens it, and then it floats
     over the view's left side instead of taking its width (Tim: "everything is black in sketcher viewport" - the 200 px
     panel left the view no width) */
  const narrow = () => { const d = $("pushpulldock"); return !!(d && d.classList.contains("ppnarrow")); };
  function shown() { const v = ls.get("pp.outline"); return v == null ? !narrow() : v === "1"; }
  function resized() { const h = H(); if (h && h.state && h.state.V) setTimeout(() => { try { h.state.V.size(); } catch (e) { /* fine */ } }, 30); }
  function mount() {
    const main = $("ppMain"), view = $("ppView"); if (!main || !view) return null;
    let box = $("ppOutline");
    if (!box) {
      box = doc.createElement("div"); box.id = "ppOutline"; box.setAttribute("aria-label", "Outline");
      main.insertBefore(box, view);
      const st = doc.createElement("style"); st.textContent = "#ppOutline{width:200px;flex:none;overflow:auto;font-size:11px;border-right:1px solid var(--line,#444);padding:2px 2px 8px 2px;user-select:none}"
        + "#ppOutline.off{display:none}#pushpulldock.ppnarrow #ppOutline{position:absolute;left:72px;top:0;bottom:0;z-index:6;background:var(--panel,#1f1c17);box-shadow:6px 0 18px #0006;max-width:60%}#ppOutline .orow{display:flex;align-items:center;gap:3px;padding:1px 2px;border-radius:3px;cursor:default;white-space:nowrap}"
        + "#ppOutline .orow:hover{background:var(--ui-hover,#2f2a21)}#ppOutline .orow.on{background:var(--ui-on,#4a3414);color:var(--tiger,#f59e2c)}"
        + "#ppOutline .orow.dim .olab{opacity:.45}#ppOutline .ocar{width:11px;text-align:center;color:var(--dim,#999)}#ppOutline .olab{flex:1;overflow:hidden;text-overflow:ellipsis}"
        + "#ppOutline .osec{font-weight:600;color:var(--dim,#9a917f);margin-top:4px}#ppOutline button{background:none;border:0;color:inherit;padding:0 2px;cursor:pointer;font-size:11px;line-height:1}"
        + "#ppOutline button:hover{color:var(--tiger,#f59e2c)}#ppOutline .oeye.off{opacity:.5}#ppOutline .ohint{color:var(--dim,#999);padding:2px 6px}";
      doc.head.appendChild(st);
      box.addEventListener("click", onClick);
      const bar = $("ppBar"), cut = $("ppCut");
      if (bar && !$("ppOutlineBtn")) {
        const b = doc.createElement("button"); b.className = "ghost gbtn"; b.id = "ppOutlineBtn"; b.type = "button"; b.textContent = "🗂 Outline";
        b.title = "The outline docker: every room with its walls, floor, ceiling, skirting, cornice, doors and windows; room groups; 👁 hide / show";
        b.onclick = () => { ls.set("pp.outline", shown() ? "0" : "1"); paint(); resized(); };
        if (cut && cut.parentNode === bar) cut.after(b); else bar.appendChild(b);
      }
      // the docker narrowed / widened (ppframe.js sets ppnarrow): the outline's place changes - the view is sized again
      try { new root.MutationObserver(() => { paint(); resized(); }).observe($("pushpulldock"), { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* old */ }
      resized();
    }
    return box;
  }
  let nodesByKey = {};
  function paint() {
    const box = mount(); if (!box) return;
    const on = shown(); if (box.classList.contains("off") === on) { box.classList.toggle("off", !on); resized(); }
    const btn = $("ppOutlineBtn"); if (btn) btn.classList.toggle("on", on);
    if (!on) return;
    const A = arch() || P().empty(), hid = P().hiddenOf(A), sel = selNow(), T = tree(A), rows = [];
    nodesByKey = {};
    const walk = (n, depth, parentHidden) => {
      nodesByKey[n.key] = n;
      const kids = n.children || [], isOpen = open[n.key] != null ? open[n.key] : (n.section || n.group != null || (n.room != null && kids.length < 40));
      const me = n.group != null ? !!n.hidden : n.hide ? hid(n.hide) : false, own = n.group != null ? !!n.hidden : n.hide ? (A.hide || []).includes(n.hide) : false;
      const hiddenNow = parentHidden || me;
      const tools = n.section === "groups" ? '<button data-act="newgroup" title="A new room group">＋</button>'
        : n.group != null ? '<button data-act="rename" title="Rename the group">✎</button><button data-act="delgroup" title="Delete the group (its rooms stay)">✕</button>'
        : n.room != null ? '<button data-act="group" title="Put this room in a group (or out of one)">⊞</button>' : "";
      const eye = n.hide || n.group != null ? `<button class="oeye${hiddenNow ? " off" : ""}" data-act="eye" title="${own ? "Show it" : hiddenNow ? "Hidden with what it is in - click to hide it on its own too" : "Hide it"}">${hiddenNow ? "🚫" : "👁"}</button>` : "";
      rows.push(`<div class="orow${n.section ? " osec" : ""}${sel && n.sel && sameSel(sel, n.sel) ? " on" : ""}${hiddenNow ? " dim" : ""}" data-key="${esc(n.key)}" style="padding-left:${2 + depth * 11}px">`
        + `<span class="ocar" data-act="fold">${kids.length ? (isOpen ? "▾" : "▸") : ""}</span>${eye}<span>${n.icon || ""}</span><span class="olab" title="${esc(n.label)}">${esc(n.label)}${n.section ? ` <span style="font-weight:400">(${kids.length})</span>` : ""}</span>${tools}</div>`);
      if (isOpen) kids.forEach((k) => walk(k, depth + 1, hiddenNow));
      if (n.section === "groups" && isOpen && !kids.length) rows.push('<div class="ohint">＋ makes a group - then ⊞ on a room puts it in</div>');
    };
    T.forEach((n) => walk(n, 0, false));
    box.innerHTML = rows.join("");
  }
  function pick(n) {
    const h = H(); if (!h || !n.sel || !h.state.T) return;
    h.state.T.use("select");
    h.state.T.arch.setSel(n.sel);
  }
  function groupMenu(at, roomId) {
    const h = H(), A = arch(); if (!h || !A) return;
    const items = [{ head: "Put the room in a group" }].concat((A.groups || []).map((g) => ({ label: (g.rooms.includes(roomId) ? "✓ " : "") + g.name, run: () => edit("group", (A2) => setGroup(A2, roomId, g.id)) })));
    items.push({ label: "＋ A new group…", run: () => askName("New group", "Group " + ((A.groups || []).length + 1)).then((nm) => { if (nm) edit("group", (A2) => newGroup(A2, nm, [roomId])); }) });
    if ((A.groups || []).some((g) => g.rooms.includes(roomId))) items.push({ label: "⊖ Out of its group", run: () => edit("group", (A2) => setGroup(A2, roomId, null)) });
    h.menu(at, items);
  }
  function askName(title, v) { const F = root.H3PushPullFrame; return F && F.ask ? F.ask(title, v) : Promise.resolve(v); }
  function onClick(e) {
    const row = e.target.closest(".orow"); if (!row) return;
    const n = nodesByKey[row.dataset.key]; if (!n) return;
    const act = e.target.closest("[data-act]") ? e.target.closest("[data-act]").dataset.act : "";
    e.stopPropagation();
    if (act === "fold" || (!act && n.section)) { const kids = (n.children || []).length; if (kids || n.section) { const cur = open[n.key] != null ? open[n.key] : true; open[n.key] = !cur; paint(); } return; }
    if (act === "eye") { edit(n.group != null ? "group shown / hidden" : "shown / hidden", (A) => toggleKey(A, n.group != null ? "group:" + n.group : n.hide)); return; }
    if (act === "newgroup") { askName("New room group", "Group " + ((((arch() || {}).groups) || []).length + 1)).then((nm) => { if (nm) edit("group", (A) => newGroup(A, nm)); }); return; }
    if (act === "rename") { askName("Rename the group", n.label).then((nm) => { if (nm) edit("group", (A) => renameGroup(A, n.group, nm)); }); return; }
    if (act === "delgroup") { edit("group", (A) => removeGroup(A, n.group)); return; }
    if (act === "group") { groupMenu(e.target, n.room); return; }
    if (n.sel) pick(n);
  }
  function boot() {
    const h = H(); if (!h || !h.state || !h.state.booted || !$("ppMain")) return false;
    paint(); return true;
  }
  if (!boot()) { let k = 0; const t = setInterval(() => { if (boot() || ++k > 240) clearInterval(t); }, 500); }
  root.PPOutline = Object.assign({ paint, mount }, api);
})(typeof window !== "undefined" ? window : globalThis);
