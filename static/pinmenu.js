/* bitGen Studio — static/pinmenu.js (2.675.0): RIGHT-CLICK A DOCKER'S 📌 PIN ▸ ↺ Reset pin (window.H3PinMenu).
 * Tim (verbatim): "the red pins are resetting everytime i switch layout, they should only reset if i right click and click
 * reset in a context menu"
 * A layout - ⊞ Docker configs loading the open set's sizes, a 🗂 workspace, a 🗂 Layout applied, ↺ Reset in Settings ▸
 * Dockers - no longer touches a pin (index.html applyLayout keeps max_height / max_width; lib/layouts.js keeps them in
 * docker_status.json). A pin changes only by its own click (pin / unpin, as before) or here:
 *   right-click a 📌   pinned:   📌 Pinned at <n> px (a heading) · ↺ Reset pin (any size again)
 *                      unpinned: 📌 Pin at this size · ↺ Reset pin (greyed - nothing to reset)
 * index.html: dsEntry, togglePin, resetPin, SIDE_DOCKS (the side docks pin a width). Pure: items(entry, side). */
(function (root) {
  "use strict";
  /** the menu's rows for a docker's status entry (pure) -> [[label, act | null, on?]] */
  function items(e, side) {
    const k = side ? "max_width" : "max_height", v = (e && e[k]) || 0;
    return v > 0
      ? [["📌 Pinned at " + v + " px " + (side ? "wide" : "high"), null], ["↺ Reset pin (any size again)", "reset"]]
      : [["📌 Pin at this size", "pin"], ["↺ Reset pin", null]];
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { items }; return; }
  const doc = root.document;
  let open = null;
  function close() { if (open) { open.remove(); open = null; } }
  function show(id, x, y) {
    close();
    let side = false; try { side = !!(typeof SIDE_DOCKS !== "undefined" && SIDE_DOCKS[id]); } catch (e) { side = false; }   // eslint-disable-line no-undef
    const e = typeof root.dsEntry === "function" ? root.dsEntry(id) : {};
    const m = doc.createElement("div"); m.className = "h3fp-menu h3pin-menu"; m.setAttribute("role", "menu"); m.dataset.pin = id;
    m.style.cssText = "position:fixed;z-index:9400;background:var(--panel,#1c1915);border:1px solid var(--line,#3a342a);border-radius:6px;padding:4px 0;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:190px";
    items(e, side).forEach(([label, act]) => {
      const r = doc.createElement("div"); r.textContent = label; r.style.cssText = "padding:5px 12px;white-space:nowrap;" + (act ? "cursor:pointer" : "opacity:.55");
      if (act) { r.dataset.act = act; r.setAttribute("role", "menuitem"); r.onmouseenter = () => { r.style.background = "#ffffff14"; }; r.onmouseleave = () => { r.style.background = ""; }; }
      m.appendChild(r);
    });
    m.onclick = (ev) => {
      const r = ev.target.closest("[data-act]"); if (!r) return;
      close();
      if (r.dataset.act === "reset" && typeof root.resetPin === "function") root.resetPin(id);
      if (r.dataset.act === "pin" && typeof root.togglePin === "function") root.togglePin(id);
    };
    doc.body.appendChild(m); open = m;
    const W = root.innerWidth || 1200, H = root.innerHeight || 800;
    m.style.left = Math.max(4, Math.min(x, W - m.offsetWidth - 4)) + "px"; m.style.top = Math.max(4, Math.min(y, H - m.offsetHeight - 4)) + "px";
    return m;
  }
  doc.addEventListener("contextmenu", (ev) => {
    const b = ev.target && ev.target.closest && ev.target.closest(".pinbtn[data-pin]"); if (!b) return;
    ev.preventDefault(); ev.stopPropagation(); show(b.dataset.pin, ev.clientX, ev.clientY);
  }, true);
  doc.addEventListener("pointerdown", (ev) => { if (open && !open.contains(ev.target)) close(); }, true);
  doc.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && open) { ev.stopPropagation(); close(); } }, true);
  root.H3PinMenu = { show, close, items };
})(typeof window !== "undefined" ? window : globalThis);
