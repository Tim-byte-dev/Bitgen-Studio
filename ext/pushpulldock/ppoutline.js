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
 * 2.667.0 (Tim: "add construction to the objects panel as a heading, planes and construction lines will live in that dropdown,
 * add shapes, for all shapes that are created - user can rename anything in the objects panel, when user clicks a shape allow
 * user to push/pull the shape when dragged"):
 *   SHAPES        every shape the drawing tools made (ppcons.js shapes(M): Solid n / Shape n / Lines n / each group) - a click
 *                 picks it (➤ Select); drag one of its faces in the view = push / pull (ppedit.js - a group's face too)
 *   CONSTRUCTION  the sketch plane in use (📌 keeps it), Planes (a click = draw in it again, ⊥ = look at it) and
 *                 Construction lines (📏 Tape measure + Ctrl) - 👁, 🗑; ＋ makes a plane (ground / front / side / the sketch plane)
 *   RENAME        double-click any row's name (or F2 on the picked row): rooms, groups, walls, floors, roofs, lights, furniture,
 *                 cameras, shapes, planes, lines - Enter keeps it, Esc does not. Rows without a name of their own keep it in
 *                 arch.labels {key: name} (pparch.cleanLabels).
 * Pure (Node: scripts/test-outline639.js, test-cons667.js): tree(A, M), toggleKey(A, key), newGroup(A, name), setGroup(A,
 * roomId, groupId), removeGroup(A, id), renameGroup(A, id, name), rename(A, M, node, name). */
(function (root) {
  "use strict";
  const P = () => root.PPArch;
  const LABEL = { door: "Door", window: "Window", opening: "Opening" };

  /** the outline: [{key, label, icon, sel?, hide?, group?, children?}] - hide = the key 👁 toggles (null: nothing to hide) */
  function tree(A, M) {
    if (!A) return [];
    const lab = A.labels || {}, L = (key, def) => lab[key] || def;           // 2.667.0: a name given in the panel
    const closed = A.rooms.filter((R) => R.closed), nOf = {}; closed.forEach((R, i) => { nOf[R.id] = i + 1; });
    const opN = { door: 0, window: 0, opening: 0 }, opNo = {};
    A.ops.forEach((o) => { opN[o.kind] = (opN[o.kind] || 0) + 1; opNo[o.id] = opN[o.kind]; });
    const roomNode = (R) => {
      const n = nOf[R.id] || 0, kids = [];
      if (R.closed) {
        const E = P().edgesOf(R);
        E.forEach((e) => !P().isGone(R, e.i) && kids.push({ key: "room:" + R.id + ":wall:" + e.i, label: L("room:" + R.id + ":wall:" + e.i, "Wall " + (e.i + 1)), icon: "▮", sel: { ak: "room", id: R.id, part: "wall", edge: e.i }, hide: "room:" + R.id + ":wall:" + e.i }));
        if (R.floorOn) kids.push({ key: "room:" + R.id + ":floor", label: L("room:" + R.id + ":floor", "Floor " + n), icon: "▦", sel: { ak: "room", id: R.id, part: "floor" }, hide: "room:" + R.id + ":floor" });
        if (R.ceilOn) kids.push({ key: "room:" + R.id + ":ceil", label: L("room:" + R.id + ":ceil", "Ceiling " + n), icon: "⌓", sel: { ak: "room", id: R.id, part: "ceil" }, hide: "room:" + R.id + ":ceil" });
        if (R.skirtOn) kids.push({ key: "room:" + R.id + ":skirt", label: L("room:" + R.id + ":skirt", "Skirting " + n), icon: "▁", sel: { ak: "room", id: R.id, part: "skirt" }, hide: "room:" + R.id + ":skirt" });
        if (R.corniceOn) kids.push({ key: "room:" + R.id + ":cornice", label: L("room:" + R.id + ":cornice", "Cornice " + n), icon: "▔", sel: { ak: "room", id: R.id, part: "cornice" }, hide: "room:" + R.id + ":cornice" });
        if (R.slab) kids.push({ key: "room:" + R.id + ":slab", label: L("room:" + R.id + ":slab", "Floor slab " + n), icon: "▬", sel: { ak: "room", id: R.id, part: "slab" }, hide: "room:" + R.id + ":slab" });
        A.ops.filter((o) => o.room === R.id).forEach((o) => kids.push({ key: "op:" + o.id, label: L("op:" + o.id, LABEL[o.kind] + " " + opNo[o.id]), icon: o.kind === "window" ? "🪟" : o.kind === "door" ? "🚪" : "▯", sel: { ak: "op", id: o.id }, hide: "op:" + o.id }));
      } else P().edgesOf(R).forEach((e) => !P().isGone(R, e.i) && kids.push({ key: "room:" + R.id + ":wall:" + e.i, label: L("room:" + R.id + ":wall:" + e.i, "Wall " + (e.i + 1)), icon: "▮", sel: { ak: "room", id: R.id, part: "wall", edge: e.i }, hide: "room:" + R.id + ":wall:" + e.i }));
      return { key: "room:" + R.id, label: R.name, icon: R.closed ? "⌂" : "▮", sel: { ak: "room", id: R.id }, hide: "room:" + R.id, room: R.id, children: kids };
    };
    const grouped = new Set(), out = [];
    const groups = (A.groups || []).map((g) => { g.rooms.forEach((r) => grouped.add(r)); return { key: "group:" + g.id, label: g.name, icon: "📂", group: g.id, hidden: g.hidden, children: g.rooms.map((r) => A.rooms.find((R) => R.id === r)).filter(Boolean).map(roomNode) }; });
    out.push({ key: "sec:groups", label: "Room groups", icon: "🗂", section: "groups", children: groups });
    out.push({ key: "sec:rooms", label: "Rooms", icon: "⌂", section: "rooms", children: closed.filter((R) => !grouped.has(R.id)).map(roomNode) });
    const sec = (key, label, icon, list) => { if (list.length) out.push({ key, label, icon, section: key, children: list }); };
    sec("sec:walls", "Walls", "▮", A.rooms.filter((R) => !R.closed && !grouped.has(R.id)).map(roomNode));
    sec("sec:roofs", "Roofs", "△", A.roofs.map((x, i) => ({ key: "roof:" + x.id, label: L("roof:" + x.id, "Roof " + (i + 1)), icon: "△", sel: { ak: "roof", id: x.id }, hide: "roof:" + x.id })));
    sec("sec:slabs", "Floors", "▦", A.slabs.map((x, i) => ({ key: "slab:" + x.id, label: L("slab:" + x.id, "Floor " + (i + 1)), icon: "▦", sel: { ak: "slab", id: x.id }, hide: "slab:" + x.id })));
    sec("sec:stairs", "Stairs", "▟", A.stairs.map((x, i) => ({ key: "stair:" + x.id, label: L("stair:" + x.id, "Stairs " + (i + 1)), icon: "▟", sel: { ak: "stair", id: x.id }, hide: "stair:" + x.id })));
    sec("sec:lights", "Lights", "💡", A.lights.map((x, i) => ({ key: "light:" + x.id, label: L("light:" + x.id, "Light " + (i + 1) + " · " + x.type), icon: "💡", sel: { ak: "light", id: x.id }, hide: "light:" + x.id })));
    sec("sec:items", "Furniture", "🛋", (A.items || []).map((x) => ({ key: "item:" + x.id, label: L("item:" + x.id, root.PPFurn ? root.PPFurn.label(x) : x.type), icon: "🛋", sel: { ak: "item", id: x.id }, hide: "item:" + x.id })));
    sec("sec:cams", "Cameras", "📷", (A.cams || []).map((x) => ({ key: "cam:" + x.id, label: x.name, icon: "📷", sel: { ak: "cam", id: x.id }, hide: "cam:" + x.id })));
    // 2.667.0: the shapes the drawing tools made, and the construction
    const CS = root.PPCons;
    if (CS && M) sec("sec:shapes", "Shapes", "⬛", CS.shapes(M).map((sh) => ({ key: sh.key, label: CS.shapeName(M, sh), icon: { group: "▣", solid: "⬛", shape: "▭", lines: "╱" }[sh.kind], shape: sh })));
    const C = A.cons || { planes: [], lines: [] }, SP = root.PPSketchPlane && root.PPSketchPlane.get ? root.PPSketchPlane.get() : null;
    const kids = [];
    if (SP && !C.planes.some((P) => CS && CS.samePlane(P, SP.n, SP.p))) kids.push({ key: "cons:active", label: "Sketch plane - " + SP.label, icon: "✎", active: true });
    kids.push({ key: "sec:cplanes", label: "Planes", icon: "▱", folder: "planes", children: C.planes.map((P) => ({ key: "cplane:" + P.id, label: P.name, icon: "▱", cons: { kind: "plane", id: P.id }, hidden: P.hidden, on: !!(SP && CS && CS.samePlane(P, SP.n, SP.p)) })) });
    kids.push({ key: "sec:clines", label: "Construction lines", icon: "┄", folder: "lines", children: C.lines.map((x) => ({ key: "cline:" + x.id, label: x.name, icon: "┄", cons: { kind: "line", id: x.id }, hidden: x.hidden })) });
    out.push({ key: "sec:cons", label: "Construction", icon: "📐", section: "cons", children: kids });
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

  /** 2.667.0: rename what a row is (node from tree) - its own name where it has one, else arch.labels[key] */
  function rename(A, M, n, name) {
    const t = String(name == null ? "" : name).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, 60); if (!t || !n || n.section || n.folder || n.active) return false;
    if (n.group != null) return !!renameGroup(A, n.group, t);
    if (n.shape) return root.PPCons ? root.PPCons.renameShape(M, n.shape, t) : false;
    if (n.cons) { const C = A.cons || { planes: [], lines: [] }, x = (n.cons.kind === "plane" ? C.planes : C.lines).find((q) => q.id === n.cons.id); if (!x) return false; x.name = t; return true; }
    const m = /^(room|cam):(\d+)$/.exec(n.key);
    if (m) { const x = (m[1] === "room" ? A.rooms : A.cams || []).find((q) => q.id === +m[2]); if (!x) return false; x.name = t; return true; }
    if (!/^[a-z]+:\d+(:[a-z]+(:\d+)?)?$/.test(n.key)) return false;
    A.labels = A.labels || {}; A.labels[n.key] = t; return true;
  }
  const api = { tree, toggleKey, newGroup, setGroup, removeGroup, renameGroup, rename };
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
      box.addEventListener("dblclick", (e) => { const r = e.target.closest(".orow"); if (r && !e.target.closest("button")) { e.preventDefault(); startRename(r); } });   // 2.667.0
      box.tabIndex = -1;
      box.addEventListener("keydown", (e) => { if (e.key === "F2") { const r = box.querySelector(".orow.on:not(.osec)"); if (r) { e.preventDefault(); e.stopPropagation(); startRename(r); } } });
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
    const h0 = H(), M0 = h0 && h0.state ? h0.state.M : null, gsel = h0 && h0.state ? h0.state.sel : null;
    const A = arch() || P().empty(), hid = P().hiddenOf(A), sel = selNow(), T = tree(A, M0), rows = [];
    const shapeOn = (sh) => !!(gsel && !sel && sh.f.concat(sh.e).length && sh.f.every((id) => (gsel.f || []).includes(id)) && sh.e.every((id) => (gsel.e || []).includes(id)) && (gsel.f || []).length === sh.f.length);
    nodesByKey = {};
    const walk = (n, depth, parentHidden) => {
      nodesByKey[n.key] = n;
      const kids = n.children || [], isOpen = open[n.key] != null ? open[n.key] : (n.section || n.folder || n.group != null || (n.room != null && kids.length < 40));
      const me = n.group != null || n.cons ? !!n.hidden : n.hide ? hid(n.hide) : false, own = n.group != null || n.cons ? !!n.hidden : n.hide ? (A.hide || []).includes(n.hide) : false;
      const hiddenNow = parentHidden || me;
      const tools = n.section === "cons" ? '<button data-act="newcons" title="A construction plane: ground / front / side, or keep the sketch plane · a construction line: 📏 Tape measure with Ctrl">＋</button>'
        : n.active ? '<button data-act="keep" title="Keep this plane in Construction">📌</button>'
        : n.cons ? (n.cons.kind === "plane" ? '<button data-act="look" title="Look straight at it">⊥</button>' : "") + '<button data-act="delcons" title="Delete it">🗑</button>'
        : n.section === "groups" ? '<button data-act="newgroup" title="A new room group">＋</button>'
        : n.group != null ? '<button data-act="rename" title="Rename the group">✎</button><button data-act="delgroup" title="Delete the group (its rooms stay)">✕</button>'
        : n.room != null ? '<button data-act="group" title="Put this room in a group (or out of one)">⊞</button>' : "";
      const eye = n.hide || n.group != null || n.cons ? `<button class="oeye${hiddenNow ? " off" : ""}" data-act="eye" title="${own ? "Show it" : hiddenNow ? "Hidden with what it is in - click to hide it on its own too" : "Hide it"}">${hiddenNow ? "🚫" : "👁"}</button>` : "";
      const isOn = (sel && n.sel && sameSel(sel, n.sel)) || (n.shape && shapeOn(n.shape)) || (n.cons && (n.on || (n.cons.kind === "line" && root.PPCons && root.PPCons.selLine() === n.cons.id))) || n.active;
      rows.push(`<div class="orow${n.section ? " osec" : ""}${n.folder ? " ofold" : ""}${isOn ? " on" : ""}${hiddenNow ? " dim" : ""}" data-key="${esc(n.key)}" style="padding-left:${2 + depth * 11}px">`
        + `<span class="ocar" data-act="fold">${kids.length ? (isOpen ? "▾" : "▸") : ""}</span>${eye}<span>${n.icon || ""}</span><span class="olab" title="${esc(n.label)}${n.section || n.folder || n.active ? "" : " - double-click to rename"}">${esc(n.label)}${n.section || n.folder ? ` <span style="font-weight:400">(${n.section === "cons" ? kids.reduce((a, k) => a + ((k.children || []).length || (k.active ? 1 : 0)), 0) : kids.length})</span>` : ""}</span>${tools}</div>`);
      if (isOpen) kids.forEach((k) => walk(k, depth + 1, hiddenNow));
      if (n.section === "groups" && isOpen && !kids.length) rows.push('<div class="ohint">＋ makes a group - then ⊞ on a room puts it in</div>');
      if (n.folder === "planes" && isOpen && !kids.length) rows.push(`<div class="ohint" style="padding-left:${8 + depth * 11}px">click a face (➤ Select), then 📌 - or ＋</div>`);
      if (n.folder === "lines" && isOpen && !kids.length) rows.push(`<div class="ohint" style="padding-left:${8 + depth * 11}px">📏 Tape measure: hold Ctrl on the second click</div>`);
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
    // 2.667.0: the second click of a double-click lands on the row painted again by the first - rename from here
    if (e.detail === 2 && !act && !n.section && !n.folder && !n.active) { startRename(row); return; }
    if (act === "fold" || (!act && (n.section || n.folder))) { const kids = (n.children || []).length; if (kids || n.section) { const cur = open[n.key] != null ? open[n.key] : true; open[n.key] = !cur; paint(); } return; }
    if (act === "eye" && n.cons) { edit("shown / hidden", (A) => { const C = A.cons || { planes: [], lines: [] }, x = (n.cons.kind === "plane" ? C.planes : C.lines).find((q) => q.id === n.cons.id); if (x) x.hidden = !x.hidden; }); if (root.PPCons) root.PPCons.paint(); return; }
    if (act === "eye") { edit(n.group != null ? "group shown / hidden" : "shown / hidden", (A) => toggleKey(A, n.group != null ? "group:" + n.group : n.hide)); return; }
    if (act === "newcons") { consMenu(e.target); return; }
    if (act === "keep") { if (root.PPCons) root.PPCons.keepPlane(); return; }
    if (act === "delcons") { edit("delete", (A) => root.PPCons && root.PPCons.removeCons(A, n.cons.kind, n.cons.id)); if (root.PPCons) { if (n.cons.kind === "line" && root.PPCons.selLine() === n.cons.id) root.PPCons.pickLine(null); root.PPCons.paint(); } return; }
    if (act === "look" || (!act && n.cons && n.cons.kind === "plane")) { const x = consItem(n); if (x && root.PPCons) { root.PPCons.use(x); if (act === "look" && root.PPSketchPlane) root.PPSketchPlane.lookAt(); } paint(); return; }
    if (!act && n.cons && n.cons.kind === "line") { if (root.PPCons) root.PPCons.pickLine(root.PPCons.selLine() === n.cons.id ? null : n.cons.id); paint(); return; }
    if (!act && n.shape) { pickShape(n.shape); return; }
    if (act === "newgroup") { askName("New room group", "Group " + ((((arch() || {}).groups) || []).length + 1)).then((nm) => { if (nm) edit("group", (A) => newGroup(A, nm)); }); return; }
    if (act === "rename") { askName("Rename the group", n.label).then((nm) => { if (nm) edit("group", (A) => renameGroup(A, n.group, nm)); }); return; }
    if (act === "delgroup") { edit("group", (A) => removeGroup(A, n.group)); return; }
    if (act === "group") { groupMenu(e.target, n.room); return; }
    if (n.sel) pick(n);
  }
  function consItem(n) { const A = arch(), C = A && A.cons ? A.cons : { planes: [], lines: [] }; return (n.cons.kind === "plane" ? C.planes : C.lines).find((q) => q.id === n.cons.id) || null; }
  function consMenu(at) {
    const h = H(); if (!h) return;
    const SP = root.PPSketchPlane && root.PPSketchPlane.get ? root.PPSketchPlane.get() : null, CS = root.PPCons; if (!CS) return;
    const items = [{ head: "A construction plane" }];
    if (SP) items.push({ label: "📌 The sketch plane (" + SP.label + ")", run: () => CS.keepPlane() });
    items.push({ label: "▱ Ground (XY) through the origin", run: () => CS.standardPlane("xy") }, { label: "▱ Front (XZ) through the origin", run: () => CS.standardPlane("xz") }, { label: "▱ Side (YZ) through the origin", run: () => CS.standardPlane("yz") });
    items.push({ head: "A construction line" }, { label: "📏 Tape measure - Ctrl on the second click", run: () => { h.tool("tape"); h.msg("📏 click a point, hold Ctrl and click another - a construction line through both"); } });
    h.menu(at, items);
  }
  /** 2.667.0: a shape picked from the panel - drag one of its faces in the view to push / pull it */
  function pickShape(sh) {
    const h = H(); if (!h || !h.state.T) return;
    h.state.T.use("select"); if (h.state.T.arch) h.state.T.arch.setSel(null);
    if (h.setSel) h.setSel({ f: sh.f.slice(), e: sh.e.slice() });
    h.msg((sh.kind === "group" ? "▣ " : "⬛ ") + "picked - drag one of its faces to push / pull it" + (sh.kind === "group" ? " · double-click it to edit inside" : ""));
    paint();
  }
  /** 2.667.0: rename a row in place (double-click its name / F2) */
  function startRename(row) {
    const n = nodesByKey[row.dataset.key]; if (!n || n.section || n.folder || n.active) return;
    const lab = row.querySelector(".olab"); if (!lab || row.querySelector("input.oren")) return;
    const inp = doc.createElement("input"); inp.type = "text"; inp.className = "oren"; inp.value = n.label; inp.maxLength = 60;
    inp.style.cssText = "flex:1;min-width:0;font-size:11px;padding:0 2px;height:16px";
    lab.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (keep) => {
      if (done) return; done = true;
      const v = inp.value.trim();
      if (keep && v && v !== n.label) {
        const h = H(); if (!h || !h.state.M) return paint();
        const before = h.snapshot ? h.snapshot() : null; if (!h.state.M.arch) h.state.M.arch = P().empty();
        if (rename(h.state.M.arch, h.state.M, n, v)) { if (h.commit) h.commit("rename", before); if (h.state.A) h.state.A.rebuild(); }
      }
      paint();
    };
    inp.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") { ev.preventDefault(); finish(true); } if (ev.key === "Escape") { ev.preventDefault(); finish(false); } });
    inp.addEventListener("blur", () => finish(true));
    inp.addEventListener("click", (ev) => ev.stopPropagation());
  }
  function boot() {
    const h = H(); if (!h || !h.state || !h.state.booted || !$("ppMain")) return false;
    paint(); return true;
  }
  if (!boot()) { let k = 0; const t = setInterval(() => { if (boot() || ++k > 240) clearInterval(t); }, 500); }
  root.PPOutline = Object.assign({ paint, mount, startRename: (key) => { const b = $("ppOutline"), r = b && [...b.querySelectorAll(".orow")].find((x) => x.dataset.key === key); if (r) startRename(r); return !!r; } }, api);
})(typeof window !== "undefined" ? window : globalThis);
