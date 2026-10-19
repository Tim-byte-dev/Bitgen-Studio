/* bitGen Studio — static/cadbar.js (2.470.0): a CAD RIBBON (Fusion 360 style) docked along the top of a work area,
 * window.CadBar. Used by the image editor (ext/imageeditdock/pccadbar.js) and the timeline (ext/timelinedock/tlcadbar.js).
 *
 * Tim (verbatim): "make the sketch toolbar a top docker like fusion 360 in image editor and timeline".
 *
 *   CadBar.create(host, spec, opts) -> {el, setTab(id), tab(), refresh(), collapse(bool), destroy()}
 *     spec  = {tabs: [{id, label, groups: [{label, items: [item...], show?: n (big buttons shown, default 3),
 *                                            inline?: true (all items as small buttons, no menu)}]}]}
 *     item  = {id, label, icon (text or an <svg>), key?, run(), enabled?() -> bool, active?() -> bool, sep?: true,
 *              hidden?() -> bool (2.494.0: not shown while true - e.g. Create Sketch while a sketch is being edited)}
 *     opts  = {store: {get, set} (remembers the tab + collapsed), key: "cadbar.<name>", after: an element to insert after,
 *              right: [item...] (small buttons at the right end, e.g. ⚙)}
 *   A tab strip (SKETCH · SHAPES · SOLID …) over the ribbon; each group shows its first items as big buttons with the
 *   label under them and "LABEL ▾" opening every item of the group (icon, name, key). ⌃ folds the ribbon to the tabs.
 *   refresh() re-reads enabled / active (call it when the tool or the selection changes).
 * Pure helpers (Node: scripts/test-cadbar.js): normalize(spec) - every tab / group / item made sane; firstEnabled.
 */
(function (root) {
  "use strict";
  function normalize(spec) {
    const tabs = (spec && Array.isArray(spec.tabs) ? spec.tabs : []).filter((t) => t && t.id).map((t) => ({
      id: String(t.id), label: String(t.label || t.id).toUpperCase(),
      groups: (Array.isArray(t.groups) ? t.groups : []).filter((g) => g && Array.isArray(g.items) && g.items.length).map((g) => ({
        label: String(g.label || "").toUpperCase(), inline: !!g.inline, show: g.show == null ? 3 : Math.max(0, +g.show | 0),
        items: g.items.filter((i) => i && (i.sep || (i.id && typeof i.run === "function"))).map((i) => (i.sep ? { sep: true } : Object.assign({ label: i.id, icon: "•" }, i))),
      })).filter((g) => g.items.some((i) => !i.sep)),
    }));
    return { tabs };
  }
  const firstEnabled = (items) => items.find((i) => !i.sep && !isHidden(i) && (!i.enabled || i.enabled())) || null;
  /** 2.494.0: an item hidden for now (its hidden() says so) */
  function isHidden(i) { try { return !!(i && i.hidden && i.hidden()); } catch (e) { return false; } }
  /** the items to show now: hidden ones dropped, no separator first / last / twice */
  function visible(items) { const v = items.filter((i) => !isHidden(i)), out = []; for (const i of v) { if (i.sep && (!out.length || out[out.length - 1].sep)) continue; out.push(i); } while (out.length && out[out.length - 1].sep) out.pop(); return out; }
  const CSS = ".cadbar{display:flex;flex-direction:column;background:var(--pc-panel,#24211d);border-bottom:1px solid var(--pc-line,#3a352e);user-select:none;flex:none;font:11px system-ui,sans-serif;color:var(--pc-text,#ddd);position:relative;z-index:6}"
    + ".cadbar .cbtabs{display:flex;align-items:center;gap:2px;padding:2px 6px 0}.cadbar .cbtab{background:none;border:0;border-bottom:2px solid transparent;color:var(--pc-dim,#999);padding:3px 10px;font:600 11px system-ui,sans-serif;letter-spacing:.06em;cursor:pointer}"
    + ".cadbar .cbtab.on{color:var(--pc-text,#eee);border-bottom-color:var(--pc-accent,#f59e2c)}.cadbar .cbtab:hover{color:var(--pc-text,#eee)}.cadbar .cbsp{flex:1}.cadbar .cbsmall{background:none;border:0;color:var(--pc-dim,#999);cursor:pointer;padding:2px 6px;font-size:12px}"
    + ".cadbar .cbsmall:hover{color:var(--pc-text,#eee)}.cadbar .cbrib{display:flex;align-items:stretch;gap:0;padding:3px 6px 2px;overflow-x:auto;overflow-y:hidden}.cadbar.folded .cbrib{display:none}"
    + ".cadbar .cbgrp{display:flex;flex-direction:column;align-items:center;padding:0 6px;border-right:1px solid var(--pc-line,#3a352e)}.cadbar .cbgrp:last-child{border-right:0}"
    + ".cadbar .cbbig{display:flex;gap:2px;align-items:flex-start}.cadbar .cbb{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:42px;max-width:64px;padding:3px 3px 2px;background:none;border:1px solid transparent;border-radius:4px;color:var(--pc-text,#ddd);cursor:pointer;font:10px system-ui,sans-serif;line-height:1.1}"
    + ".cadbar .cbb:hover{border-color:var(--pc-line,#4a443b);background:var(--pc-bg,#1b1916)}.cadbar .cbb.on{border-color:var(--pc-accent,#f59e2c);color:var(--pc-accent,#f59e2c)}.cadbar .cbb:disabled{opacity:.4;cursor:default}"
    + ".cadbar .cbb .ic{font-size:17px;height:22px;display:flex;align-items:center;justify-content:center}.cadbar .cbb .ic svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}"
    + ".cadbar .cbb .lb{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62px}.cadbar .cbin{display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,22px);gap:1px 2px}"
    + ".cadbar .cbin .cbb{min-width:24px;padding:1px;flex-direction:row}.cadbar .cbin .cbb .ic{font-size:13px;height:18px}.cadbar .cbin .cbb .ic svg{width:16px;height:16px}"
    + ".cadbar .cbgl{margin-top:1px;background:none;border:0;color:var(--pc-dim,#999);font:600 10px system-ui,sans-serif;letter-spacing:.05em;cursor:pointer;padding:0 4px}.cadbar .cbgl:hover{color:var(--pc-text,#eee)}"
    + ".cbmenu{position:fixed;z-index:10080;min-width:200px;max-height:70vh;overflow:auto;background:var(--pc-panel,#24211d);border:1px solid var(--pc-line,#3a352e);border-radius:4px;padding:4px 0;box-shadow:0 8px 24px rgba(0,0,0,.5);font:12px system-ui,sans-serif;color:var(--pc-text,#ddd)}"
    + ".cbmenu .mi{display:flex;align-items:center;gap:8px;padding:4px 12px;cursor:pointer}.cbmenu .mi:hover{background:var(--pc-bg,#1b1916)}.cbmenu .mi.dis{opacity:.4;cursor:default}.cbmenu .mi .ic{width:20px;text-align:center}"
    + ".cbmenu .mi .ic svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.cbmenu .mi .ky{margin-left:auto;color:var(--pc-dim,#999);font-size:11px}.cbmenu .sp{height:1px;background:var(--pc-line,#3a352e);margin:3px 0}";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const iconHtml = (ic) => (/^\s*<svg/.test(String(ic || "")) ? String(ic) : esc(ic || "•"));

  function create(host, spec0, opts0) {
    const doc = (host && host.ownerDocument) || root.document, opts = opts0 || {}, store = opts.store || null, key = opts.key || "cadbar";
    if (!doc.getElementById("cadbarCss")) { const st = doc.createElement("style"); st.id = "cadbarCss"; st.textContent = CSS; doc.head.appendChild(st); }
    let spec = normalize(spec0), cur = (store && store.get(key + ".tab", null)) || (spec.tabs[0] && spec.tabs[0].id), menu = null;
    const el = doc.createElement("div"); el.className = "cadbar"; el.dataset.cadbar = key;
    if (store && store.get(key + ".folded", false)) el.classList.add("folded");
    if (opts.after && opts.after.parentNode) opts.after.parentNode.insertBefore(el, opts.after.nextSibling); else host.appendChild(el);
    const closeMenu = () => { if (menu) { menu.remove(); menu = null; } };
    doc.addEventListener("pointerdown", (e) => { if (menu && !menu.contains(e.target)) closeMenu(); }, true);
    const can = (i) => !i.enabled || !!i.enabled();
    const on = (i) => !!(i.active && i.active());
    function openMenu(g, anchor) {
      closeMenu();
      menu = doc.createElement("div"); menu.className = "cbmenu";
      menu.innerHTML = g.items.map((i, k) => (isHidden(i) ? "" : i.sep ? `<div class="sp"></div>` : `<div class="mi${can(i) ? "" : " dis"}" data-k="${k}"><span class="ic">${iconHtml(i.icon)}</span><span>${esc(i.label)}</span><span class="ky">${esc(i.key || "")}</span></div>`)).join("");
      doc.body.appendChild(menu);
      const r = anchor.getBoundingClientRect(); menu.style.left = Math.max(4, r.left) + "px"; menu.style.top = r.bottom + 2 + "px";
      menu.querySelectorAll(".mi").forEach((m) => { m.onclick = () => { const i = g.items[+m.dataset.k]; if (!can(i)) return; closeMenu(); i.run(); refresh(); }; });
    }
    function btn(i, small) {
      return `<button type="button" class="cbb${on(i) ? " on" : ""}" data-id="${esc(i.id)}" title="${esc(i.label)}${i.key ? " (" + esc(i.key) + ")" : ""}"${can(i) ? "" : " disabled"}><span class="ic">${iconHtml(i.icon)}</span>${small ? "" : `<span class="lb">${esc(i.label)}</span>`}</button>`;
    }
    function render() {
      lastHidden = hiddenSig();
      const tab = spec.tabs.find((t) => t.id === cur) || spec.tabs[0]; if (tab) cur = tab.id;
      el.innerHTML = `<div class="cbtabs">${spec.tabs.map((t) => `<button type="button" class="cbtab${t.id === cur ? " on" : ""}" data-tab="${esc(t.id)}">${esc(t.label)}</button>`).join("")}<span class="cbsp"></span>`
        + (opts.right || []).map((i, k) => `<button type="button" class="cbsmall" data-right="${k}" title="${esc(i.label)}">${iconHtml(i.icon)}</button>`).join("")
        + `<button type="button" class="cbsmall" data-fold="1" title="Fold / unfold the toolbar">${el.classList.contains("folded") ? "⌄" : "⌃"}</button></div>`
        + `<div class="cbrib">${tab ? tab.groups.map((g, gi) => {
          const items = visible(g.items).filter((i) => !i.sep);
          const body = g.inline ? `<div class="cbin">${items.map((i) => btn(i, true)).join("")}</div>` : `<div class="cbbig">${items.slice(0, g.show).map((i) => btn(i, false)).join("")}</div>`;
          return `<div class="cbgrp" data-g="${gi}">${body}<button type="button" class="cbgl" data-menu="${gi}" title="All of ${esc(g.label)}">${esc(g.label)} ▾</button></div>`;
        }).join("") : ""}</div>`;
      el.querySelectorAll("[data-tab]").forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });
      el.querySelectorAll("[data-right]").forEach((b) => { b.onclick = (e) => { const i = opts.right[+b.dataset.right]; i.run(e, b); }; });
      el.querySelector("[data-fold]").onclick = () => collapse(!el.classList.contains("folded"));
      el.querySelectorAll(".cbb[data-id]").forEach((b) => { b.onclick = () => { const i = findItem(b.dataset.id); if (i && can(i)) { i.run(); refresh(); } }; });
      el.querySelectorAll("[data-menu]").forEach((b) => { b.onclick = () => { const g = tab.groups[+b.dataset.menu]; if (menu && menu.__g === g) return closeMenu(); openMenu(g, b); menu.__g = g; }; });
    }
    function findItem(id) { const tab = spec.tabs.find((t) => t.id === cur); if (!tab) return null; for (const g of tab.groups) for (const i of g.items) if (i.id === id) return i; return null; }
    const hiddenSig = () => { const tab = spec.tabs.find((t) => t.id === cur); return tab ? tab.groups.map((g) => g.items.map((i) => (isHidden(i) ? 1 : 0)).join("")).join("|") : ""; };
    let lastHidden = "";
    function refresh() {
      const tab = spec.tabs.find((t) => t.id === cur); if (!tab) return;
      const hs = hiddenSig(); if (hs !== lastHidden) { closeMenu(); render(); return; }       // something came / went: drawn again
      el.querySelectorAll(".cbb[data-id]").forEach((b) => { const i = findItem(b.dataset.id); if (!i) return; b.disabled = !can(i); b.classList.toggle("on", on(i)); });
    }
    function setTab(id) { if (!spec.tabs.some((t) => t.id === id)) return; cur = id; if (store) store.set(key + ".tab", id); closeMenu(); render(); }
    function collapse(f) { el.classList.toggle("folded", !!f); if (store) store.set(key + ".folded", !!f); render(); }
    function setSpec(s) { spec = normalize(s); render(); }
    render();
    return { el, setTab, tab: () => cur, refresh, collapse, setSpec, destroy: () => { closeMenu(); el.remove(); }, spec: () => spec };
  }
  const CadBar = { create, normalize, firstEnabled, visible, isHidden, CSS };
  if (typeof module !== "undefined" && module.exports) module.exports = CadBar;
  else root.CadBar = CadBar;
})(typeof window !== "undefined" ? window : globalThis);
