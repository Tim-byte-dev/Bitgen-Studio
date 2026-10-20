/* bitGen Studio — 2.545.0 / 2.549.0: ▣ Docker - an empty docker the other dockers drop into (H3DockGroup).
 * Tim (2.545.0): "do we have a way to add an empty docker with dropzones for other dockers. should be able to be horizontal
 * or vertical with a editable titlebar, ctrl+alt+D can open it and add the button to the statustbar list of dockers".
 * Tim (2.549.0): "newly created docker is useless, all other dockers are below it and can't be dragged into it and it
 * doesn't dock. it keeps it's name when open but the button is still called docker. add another 2 buttons to the new
 * docker titlebar - delete (removes the docker and it's button), make permanent. changes the titlebar to the regular
 * dockers titlebar".
 *   ▣ <name> (the statusbar, after Queue) / Ctrl+Alt+D  shows / hides it - made the first time (a named docker of
 *                  static/floatpanels.js: id fd-dockers, side by side). The button carries the docker's NAME (2.549.0).
 *   DRAG A MAIN DOCKER IN BY ITS TITLE BAR (2.549.0): press on Preview / Timeline / Music … 's title bar and drag - over
 *                  a ▣ docker an orange line shows where it goes, let go = in it (no ⇱ needed; a plain click still
 *                  folds the docker). ⇱ on the title bar floats it (it had no ⇱ on it since 2.545.0 - a comment ate
 *                  the label); ⇲ in its title puts it back in the main window.
 *   📌 Make permanent (2.549.0): the docker becomes a REGULAR docker in the main column - the regular title bar (▾ fold,
 *                  ⛶ maximize, ⇱ float it again, 🗑 delete), its statusbar button hides / shows it like the others, a
 *                  grip under it sets its height; floating dockers still drop into it.
 *   🗑 Delete (2.549.0): asks, then the dockers in it go back where they came from, and the docker and its button go.
 *   The layout (⇆ side by side / ⇅ stacked / tabs), its name, what is in it, the sizes, permanent or not are kept in
 *   panel_layout.cfg.
 * Pure (Node: scripts/test-dockgroup545.js, test-dockgroup549.js): isToggleKey, titleOf, CANDIDATES, GROUP, isGroup,
 *   btnIdFor, nextGroupId, dragged. */
(function (root) {
  "use strict";
  const GROUP = "fd-dockers";
  const CANDIDATES = ["previewdock", "timelinedock", "imageeditdock", "comfydock", "musicdock", "stemsdock", "sfxdock", "chatdock", "consoledock"];
  /** Ctrl+Alt+D (not with Shift / Meta; an AltGr layout's own character on D is left alone) */
  function isToggleKey(e) {
    if (!e || !e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return false;
    const k = String(e.key || "");
    return e.code === "KeyD" ? (k.length !== 1 || k.toLowerCase() === "d") : k.toLowerCase() === "d";
  }
  /** a docker's name from its title bar's own words (not its buttons, not ▾ / ▸) */
  function titleOf(texts, fallback) {
    const t = (texts || []).join(" ").replace(/[▾▸]/g, "").replace(/\s+/g, " ").trim();
    return t || fallback || "";
  }
  /** 2.549.0: a ▣ docker's id (fd-dockers, fd-dockers-2 …) */
  const isGroup = (id) => /^fd-dockers(-\d+)?$/.test(String(id || ""));
  /** its statusbar button's id - the first keeps "tDG" */
  const btnIdFor = (id) => (id === GROUP ? "tDG" : "tDG_" + String(id).replace(/[^\w-]/g, "_"));
  /** the next free ▣ docker id for the ids there are */
  function nextGroupId(ids) {
    const have = new Set(ids || []);
    if (!have.has(GROUP)) return GROUP;
    for (let k = 2; k < 999; k++) if (!have.has(GROUP + "-" + k)) return GROUP + "-" + k;
    return GROUP + "-" + Date.now();
  }
  /** a press moved far enough to be a drag (not a click that folds the docker) */
  const dragged = (x0, y0, x, y) => Math.hypot(x - x0, y - y0) > 8;
  const API = { GROUP, CANDIDATES, isToggleKey, titleOf, isGroup, btnIdFor, nextGroupId, dragged };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const P = () => root.H3Panels;
  const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
  const permId = (id) => "dgp_" + String(id).replace(/[^\w-]/g, "_");
  const groups = () => (P() ? P().list().filter((d) => d.kind === "docker" && isGroup(d.id)).map((d) => P().get(d.id)).filter(Boolean) : []);
  const shownOf = (r) => !!r && (r.perm ? !!$(permId(r.id)) && !$(permId(r.id)).classList.contains("dockgone") : !!r.win && !r.win.classList.contains("off"));
  function shown(id) { return shownOf(P() && P().get(id || GROUP)); }

  /* ---- the statusbar buttons: one per ▣ docker, named after it */
  function paint() {
    const sb = $("statusbar"); if (!sb) return;
    const gs = groups(), want = new Set(gs.map((r) => btnIdFor(r.id)));
    if (!gs.length) want.add("tDG");                                   // nothing yet: ▣ Docker makes the first
    sb.querySelectorAll("button[data-dg]").forEach((b) => { if (!want.has(b.id)) b.remove(); });
    let after = $("tQ");
    const list = gs.length ? gs : [null];
    for (const r of list) {
      const bid = r ? btnIdFor(r.id) : "tDG";
      let b = $(bid);
      if (!b) {
        b = doc.createElement("button"); b.id = bid; b.type = "button"; b.dataset.dg = r ? r.id : GROUP;
        b.onclick = () => toggle(null, b.dataset.dg);
        sb.insertBefore(b, after ? after.nextSibling : $("sbdot"));
      }
      b.dataset.dg = r ? r.id : GROUP;
      const name = r ? r.title : "Docker", text = "▣ " + name;
      if (b.textContent !== text) b.textContent = text;
      b.title = name + (r && r.perm ? " - a permanent docker: show / hide it" : " (Ctrl+Alt+D) - an empty docker: drag other dockers in by their title bar - side by side or stacked, double-click its title to rename it");
      const on = !!r && shownOf(r); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      after = b;
    }
    for (const r of gs) { chrome(r); if (r.perm) paintPerm(r); }
  }
  /** show / hide a ▣ docker (Ctrl+Alt+D: the latest floating one; none = a new one) */
  async function toggle(on, which) {
    const p = P(); if (!p) return;
    try { await p.load(); } catch (e) { /* no saved layout */ }
    let id = which;
    if (!id) { const fl = groups().filter((r) => !r.perm); id = fl.length ? fl[fl.length - 1].id : nextGroupId(groups().map((r) => r.id)); }
    let r = p.get(id);
    const want = on == null ? !shownOf(r) : !!on;
    if (!r) {
      if (!want) return;
      const n = groups().length, w = Math.min(820, root.innerWidth - 80), h = Math.min(440, root.innerHeight - 160);
      r = p.newDocker({ id, name: n ? "Docker " + (n + 1) : "Docker", layout: "row" });
      p.float(id, { x: Math.max(20, (root.innerWidth - w) / 2 + n * 24), y: Math.max(50, (root.innerHeight - h) / 2 - 40 + n * 24), w, h });
    } else if (r.perm) {
      const d = $(permId(id)), bid = btnIdFor(id);
      if (d && typeof root.toggleDockGone === "function" && d.classList.contains("dockgone") === want) root.toggleDockGone(permId(id), bid);
      else if (d) d.classList.toggle("dockgone", !want);
      if (d) p.setPerm(id, { hidden: d.classList.contains("dockgone") });
    } else if (want && r.state === "in") p.float(id);          // it was dropped in another docker - out again
    else p.show(id, want);
    watch(); paint();
    tev("docker_group", want ? "shown" : "hidden");
  }
  const watched = new WeakSet();
  function watch() {
    for (const r of groups()) {
      if (!r.win || watched.has(r.win)) continue;
      watched.add(r.win);
      try { new root.MutationObserver(paint).observe(r.win, { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* the 1 s look */ }
      try { new root.MutationObserver(paint).observe(r.win.querySelector(".h3fp-n"), { childList: true, characterData: true, subtree: true }); } catch (e) { /* renamed: the 1 s look */ }
    }
  }
  root.addEventListener("keydown", (e) => { if (isToggleKey(e)) { e.preventDefault(); e.stopPropagation(); toggle(); } }, true);

  /* ---- 📌 / 🗑 in a ▣ docker's title bar */
  function chrome(r) {
    if (!r.win || r.win.querySelector(".h3fp-perm")) return;
    const bar = r.win.querySelector(".h3fp-t"), cfg = bar && bar.querySelector(".h3fp-cfg"); if (!bar) return;
    const mk = (cls, txt, title, fn) => { const b = doc.createElement("button"); b.type = "button"; b.className = cls; b.textContent = txt; b.title = title; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
    const pin = mk("h3fp-perm", "📌", "Make permanent - a regular docker in the main column (its title bar, its statusbar button)", () => makePerm(r.id));
    const del = mk("h3fp-del", "🗑", "Delete this docker and its statusbar button (the dockers in it go back where they came from)", () => remove(r.id));
    bar.insertBefore(pin, cfg || bar.lastElementChild); bar.insertBefore(del, cfg || bar.lastElementChild);
    bar.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); menu(r.id, e.clientX, e.clientY); });   // 2.550.0
  }
  /** 2.550.0 (Tim: "add a right click context menu when user right clicks the new titlebar to delete docker (after it was
   *  made permanent) this applies only to user made custom dockers"): right-click a ▣ docker's title bar - floating or
   *  permanent - for Rename, its layout, Make permanent / Float it again, Delete docker */
  function menu(id, x, y) {
    const p = P(), r = p && p.get(id); if (!r) return null;
    doc.querySelectorAll(".h3fp-menu").forEach((m) => m.remove());
    const L = r.layout || "tabs", m = doc.createElement("div"); m.className = "h3fp-menu dg-menu";
    const items = [["Rename…", () => p.rename(id).then(() => paint())], ["-"], ["h", "Layout:"],
      ["Side by side", () => p.setLayout(id, "row"), L === "row"], ["Stacked", () => p.setLayout(id, "col"), L === "col"], ["Tabs", () => p.setLayout(id, "tabs"), L === "tabs"], ["-"],
      r.perm ? ["⇱ Float it again", () => unPerm(id)] : ["📌 Make permanent", () => makePerm(id)],
      ["🗑 Delete docker", () => remove(id)]];
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    m.innerHTML = items.map((it, i) => (it[0] === "-" ? "<hr>" : it[0] === "h" ? `<div class="h">${esc(it[1])}</div>` : `<div data-i="${i}"${it[2] ? ' class="on"' : ""}>${esc(it[0])}</div>`)).join("");
    doc.body.appendChild(m);
    m.style.left = Math.max(4, Math.min(x, root.innerWidth - 200)) + "px"; m.style.top = Math.max(4, Math.min(y, root.innerHeight - 26 * items.length)) + "px";
    m.onclick = (e) => { const d = e.target.closest("[data-i]"); if (!d) return; m.remove(); items[+d.dataset.i][1](); };
    root.setTimeout(() => root.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target)) { m.remove(); root.removeEventListener("pointerdown", off, true); } }, true), 0);
    tev("docker_group_menu", id);
    return m;
  }
  async function remove(id, quiet) {
    const p = P(), r = p && p.get(id); if (!r) return false;
    if (!quiet) {
      const ask = typeof root.appConfirm === "function" ? root.appConfirm : (t) => Promise.resolve(root.confirm(t));
      if (!(await ask(`Delete the docker "${r.title}"? The dockers in it go back where they came from; its statusbar button goes too.`, "Delete docker"))) return false;
    }
    const d = $(permId(id));
    if (r.perm && r.win && r.win.parentNode !== doc.body) doc.body.appendChild(r.win);
    p.remove(id);
    if (d) { const s = d.nextElementSibling; d.remove(); if (s && s.classList.contains("dgp-grip")) s.remove(); }
    try { const G = root.H3GoneDocks; if (G) delete G[btnIdFor(id)]; } catch (e) { /* fine */ }
    paint(); tev("docker_group_deleted", id);
    try { root.dispatchEvent(new root.Event("resize")); } catch (e) { /* fine */ }
    return true;
  }

  /* ---- 📌 Make permanent: a regular docker in the main column */
  function makePerm(id, restoring) {
    const p = P(), r = p && p.get(id), main = $("maincol"); if (!r || !main || !r.win) return null;
    css();
    if (r.state === "in" && r.docker) p.float(id);                      // out of another docker first
    let d = $(permId(id));
    if (!d) {
      d = doc.createElement("div"); d.className = "bdock dgperm"; d.id = permId(id); d.dataset.dg = id;
      d.innerHTML = '<div class="bhead"></div><div class="bbody"></div>';
      const grip = doc.createElement("div"); grip.className = "dgp-grip"; grip.title = "Drag to set its height";
      // 2.550.0: where the window was - before the main docker under its middle (appended at the bottom it could sit
      // below the room the column has, out of sight); restored = where it was kept
      const before = placeFor(r, main, restoring && r.perm && r.perm.before);
      main.insertBefore(d, before); main.insertBefore(grip, before);
      const head = d.querySelector(".bhead");
      head.dataset.collapse = d.id;
      head.appendChild(doc.createTextNode("▾ " + r.title));
      const mk = (cls, txt, title, fn) => { const b = doc.createElement("button"); b.type = "button"; b.className = cls; b.textContent = txt; b.title = title; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
      head.appendChild(mk("dgfloat dgp-unperm", "⇱", "Float it again (no longer a permanent docker)", () => unPerm(id)));
      head.appendChild(mk("dgfloat dgp-del", "🗑", "Delete this docker and its statusbar button", () => remove(id)));
      const mx = mk("maxbtn", "⛶", "Maximize", () => { if (typeof root.toggleMax === "function") root.toggleMax(d.id); });
      mx.dataset.max = d.id; head.appendChild(mx);
      head.onclick = (e) => { if (e.target.closest("button, select, input")) return; if (typeof root.toggleCollapse === "function") { root.toggleCollapse(d.id); p.setPerm(id, { collapsed: d.classList.contains("collapsed") }); } };
      head.ondblclick = (e) => { if (e.target.closest("button")) return; p.rename(id).then(() => paint()); };
      head.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); menu(id, e.clientX, e.clientY); };   // 2.550.0
      gripDrag(grip, d, id);
      try { if (root.H3GoneDocks) root.H3GoneDocks[btnIdFor(id)] = d.id; } catch (e) { /* fine */ }
    }
    d.querySelector(".bbody").appendChild(r.win);
    r.win.classList.add("dg-perm"); r.win.classList.remove("off");
    const keep = restoring && r.perm ? r.perm : {};
    p.setPerm(id, { h: keep.h > 80 ? keep.h : r.perm && r.perm.h > 80 ? r.perm.h : 320, hidden: !!keep.hidden, collapsed: !!keep.collapsed });
    d.style.height = ""; d.style.flex = "1 1 " + r.perm.h + "px";   // 2.550.0: takes room but gives way when the column is full
    p.setPerm(id, { before: (() => { const n = d.nextElementSibling && d.nextElementSibling.nextElementSibling; return n && n.id ? n.id : ""; })() });
    d.classList.toggle("dockgone", !!r.perm.hidden);
    d.classList.toggle("collapsed", !!r.perm.collapsed);
    paint(); paintPerm(r);
    if (!restoring) tev("docker_group_perm", id);
    try { root.dispatchEvent(new root.Event("resize")); } catch (e) { /* fine */ }
    return d;
  }
  /** 2.550.0: the main-column child a permanent docker goes before - the kept one, else the docker under the window's middle */
  function placeFor(r, main, keptId) {
    if (keptId) { const k = $(keptId); if (k && k.parentNode === main) return k; }
    const b = r.win ? r.win.getBoundingClientRect() : null, y = b && b.height ? b.top + b.height / 2 : null;
    if (y != null) for (const c of [...main.children]) { if (!c.classList.contains("bdock") || c.classList.contains("dgperm")) continue; const cb = c.getBoundingClientRect(); if (cb.height && cb.top + cb.height / 2 > y) return c; }
    return null;
  }
  function paintPerm(r) {
    const d = $(permId(r.id)); if (!d) return;
    const head = d.querySelector(".bhead"), t = [...head.childNodes].find((n) => n.nodeType === 3);
    const want = (d.classList.contains("collapsed") ? "▸ " : "▾ ") + r.title;
    if (t && t.textContent !== want) t.textContent = want;
    else if (!t) head.insertBefore(doc.createTextNode(want), head.firstChild);
  }
  function unPerm(id) {
    const p = P(), r = p && p.get(id); if (!r) return;
    const d = $(permId(id)), b = d ? d.getBoundingClientRect() : null;
    if (d && d.classList.contains("maxed") && typeof root.toggleMax === "function") root.toggleMax(d.id, false);
    r.win.classList.remove("dg-perm"); doc.body.appendChild(r.win);
    p.setPerm(id, false);
    p.float(id, b && b.width > 100 ? { x: b.left + 20, y: Math.max(50, b.top - 40), w: Math.min(b.width, root.innerWidth - 60), h: Math.max(260, b.height) } : null);
    if (d) { const s = d.nextElementSibling; d.remove(); if (s && s.classList.contains("dgp-grip")) s.remove(); }
    try { if (root.H3GoneDocks) delete root.H3GoneDocks[btnIdFor(id)]; } catch (e) { /* fine */ }
    paint(); try { root.dispatchEvent(new root.Event("resize")); } catch (e) { /* fine */ }
  }
  function gripDrag(grip, d, id) {
    grip.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const y0 = e.clientY, h0 = d.getBoundingClientRect().height;
      const mv = (m) => { d.style.flex = "0 0 " + Math.max(80, Math.round(h0 + m.clientY - y0)) + "px"; };
      const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); const h = Math.round(d.getBoundingClientRect().height); d.style.flex = "1 1 " + h + "px"; P().setPerm(id, { h }); try { root.dispatchEvent(new root.Event("resize")); } catch (er) { /* fine */ } };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    };
  }

  /* ---- ⇱ on the main dockers + dragging them in by their title bar */
  function headText(h) { return titleOf([...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent)); }
  function css() {
    if ($("dgCss")) return;
    const s = doc.createElement("style"); s.id = "dgCss";
    s.textContent = ".dgfloat{background:var(--panel-2);border:1px solid var(--line);color:var(--dim);border-radius:5px;padding:1px 7px;font-size:.8rem;line-height:1.3;cursor:pointer;font-family:var(--body);letter-spacing:normal;text-transform:none;flex-shrink:0;margin-left:6px}"
      + ".dgfloat:hover{border-color:var(--tiger);color:var(--tiger)}.bhead>.dgfloat:first-child{margin-left:auto}"
      + ".h3fp .bdock.dg-floating{flex:1 1 auto!important;height:auto!important;min-height:0!important;max-height:none!important;display:flex;flex-direction:column;width:auto!important}"
      + ".h3fp .bdock.dg-floating>.bhead{display:none}.h3fp .bdock.dg-floating>.bbody{flex:1 1 auto;min-height:0;overflow:auto;display:block}"
      + ".h3fp:has(>.h3fp-b>.bdock.dg-floating.dockgone){display:none!important}"   // its statusbar button hides the whole window
      // 2.549.0: a permanent ▣ docker - its window fills a regular docker in the main column
      + ".bdock.dgperm{min-height:180px}.bdock.dgperm>.bbody{padding:0;min-height:0;overflow:hidden}.bdock.dgperm.maxed{flex:1 1 auto!important;height:auto!important}.bdock.dgperm.collapsed{flex:0 0 30px!important;min-height:0}"
      + ".h3fp.dg-perm{position:relative!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;flex:1 1 auto;min-height:0;z-index:auto!important;box-shadow:none!important;border:0!important;border-radius:0!important;display:flex;flex-direction:column}"
      + ".h3fp.dg-perm>.h3fp-t{display:none!important}.h3fp.dg-perm>.h3fp-b{flex:1 1 auto;min-height:0}"
      + ".dgp-grip{flex:0 0 5px;cursor:row-resize;background:var(--line)}.dgp-grip:hover{background:var(--tiger)}.bdock.dgperm.collapsed+.dgp-grip,.bdock.dgperm.dockgone+.dgp-grip{display:none}"
      + ".h3fp-perm,.h3fp-del{background:none;border:0;color:inherit;cursor:pointer;padding:0 3px;font-size:12px;opacity:.85}.h3fp-perm:hover,.h3fp-del:hover{opacity:1}"
      + "#dgDragTag{position:fixed;z-index:100000;pointer-events:none;padding:2px 8px;border-radius:4px;background:var(--panel-2,#2a2620);border:1px solid var(--tiger,#f59e2c);color:var(--tiger,#f59e2c);font-size:11px}"
      + "#dgDropLine{position:fixed;z-index:99999;pointer-events:none;background:var(--tiger,#f59e2c);border-radius:2px}";
    doc.head.appendChild(s);
  }
  function floatDock(id) {
    const p = P(), d = $(id); if (!p || !d) return;
    if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(id);
    const r = p.get("bd." + id), w = Math.min(720, root.innerWidth - 80), hh = Math.min(520, root.innerHeight - 140);
    p.float("bd." + id, r && r.w ? null : { x: Math.max(20, root.innerWidth - w - 40), y: 70, w, h: hh });
    tev("docker_float", id);
  }
  function adoptDock(id) {
    const p = P(), d = $(id); if (!p || !d || $("dgFloat_" + id)) return !!$("dgFloat_" + id);
    const h = d.querySelector(":scope > .bhead"); if (!h) return false;
    css();
    const name = headText(h) || id;
    const b = doc.createElement("button");
    b.className = "dgfloat";                       // not .maxbtn: toggleMax re-labels every .maxbtn ⛶
    b.id = "dgFloat_" + id; b.type = "button"; b.textContent = "⇱";   // 2.549.0: the label (a comment had eaten it)
    b.title = "Float the " + name + " docker - a window of its own. Or drag its title bar onto a ▣ docker to put it in there. ⇲ in its title puts it back";
    b.onclick = (e) => { e.stopPropagation(); e.preventDefault(); floatDock(id); };
    const mx = [...h.querySelectorAll(":scope > .maxbtn")].pop(); if (mx) h.insertBefore(b, mx.nextSibling); else h.appendChild(b);   // after ⛶ (it keeps the margin-left:auto)
    p.adopt({ id: "bd." + id, title: name, el: d, home: { parent: d.parentNode, before: d.nextElementSibling },
      onState: (s) => {
        d.classList.toggle("dg-floating", s !== "home");
        if (s !== "home") d.classList.remove("dockgone", "collapsed");
        if (typeof root.paintDockButtons === "function") { try { root.paintDockButtons(); } catch (er) { /* fine */ } }
        try { root.dispatchEvent(new root.Event("resize")); } catch (er) { /* fine */ }
      } });
    headDrag(h, id);
    return true;
  }
  /** 2.549.0: drag a main docker's title bar onto a ▣ docker (shown) = it goes in, where the orange line is */
  function groupAt(x, y, skip) {
    let best = null;
    for (const r of groups()) {
      if (!shownOf(r) || !r.win || r.id === skip) continue;
      const fd = r.win.querySelector(".h3fd"); if (!fd) continue;
      const b = fd.getBoundingClientRect(); if (!b.width || x < b.left || x > b.right || y < b.top || y > b.bottom) continue;
      const z = +(root.getComputedStyle(r.win).zIndex) || 0;
      if (!best || z >= best.z) best = { r, z };
    }
    return best ? best.r : null;
  }
  function headDrag(h, id) {
    h.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button, select, input, textarea")) return;
      const d = $(id); if (!d || d.classList.contains("dg-floating")) return;
      const x0 = e.clientX, y0 = e.clientY; let on = false, tag = null, line = null, over = null, slot = null;
      const mv = (m) => {
        if (!on) { if (!dragged(x0, y0, m.clientX, m.clientY)) return; on = true; css();
          tag = doc.createElement("div"); tag.id = "dgDragTag"; tag.textContent = "⇱ " + (headText(h) || id) + " - drop it on a ▣ docker"; doc.body.appendChild(tag);
          line = doc.createElement("div"); line.id = "dgDropLine"; line.style.display = "none"; doc.body.appendChild(line); }
        m.preventDefault();
        tag.style.left = (m.clientX + 14) + "px"; tag.style.top = (m.clientY + 10) + "px";
        over = groupAt(m.clientX, m.clientY);
        slot = over ? P().slotOf(over.id, m.clientX, m.clientY) : null;
        if (over) { const L = slot ? slot.line : (() => { const b = over.win.querySelector(".h3fd").getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })();
          Object.assign(line.style, { display: "", left: L.x + "px", top: L.y + "px", width: Math.max(4, L.w) + "px", height: Math.max(4, L.h) + "px", opacity: slot ? "1" : ".25" });
          tag.textContent = "⇱ " + (headText(h) || id) + " → " + over.title; }
        else { line.style.display = "none"; tag.textContent = "⇱ " + (headText(h) || id) + " - drop it on a ▣ docker"; }
      };
      const up = () => {
        root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true);
        if (tag) tag.remove(); if (line) line.remove();
        if (!on) return;
        // the click that follows a drag must not fold the docker
        const eat = (c) => { c.stopPropagation(); c.preventDefault(); root.removeEventListener("click", eat, true); };
        root.addEventListener("click", eat, true); root.setTimeout(() => root.removeEventListener("click", eat, true), 300);
        if (!over) return;
        if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(id);
        P().dockInto("bd." + id, over.id, slot ? slot.index : undefined);
        tev("docker_dragged_in", id + ">" + over.id);
      };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    });
  }
  let tries = 0;
  function adoptAll() {
    if (!P()) return;
    const left = CANDIDATES.filter((id) => !adoptDock(id));
    if (left.length && ++tries < 40) root.setTimeout(adoptAll, 1500);  // the extension dockers load late
  }
  function start() {
    css();
    paint();
    const p = P(); if (!p) return;
    p.load().then(() => { for (const r of groups()) if (r.perm) makePerm(r.id, true); watch(); paint(); }).catch(() => {});
    adoptAll();
    root.setInterval(() => { try { watch(); paint(); } catch (e) { /* fine */ } }, 1000);
  }
  root.H3DockGroup = Object.assign(API, { menu, toggle, shown, adoptDock, makePerm, unPerm, remove, groups: () => groups().map((r) => r.id), floatDock });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
