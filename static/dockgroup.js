/* bitGen Studio — 2.545.0: ▣ Docker - an empty docker the other dockers drop into (H3DockGroup).
 * Tim: "do we have a way to add an empty docker with dropzones for other dockers. should be able to be horizontal or
 * vertical with a editable titlebar, ctrl+alt+D can open it and add the button to the statustbar list of dockers".
 *   ▣ Docker (the statusbar, after Queue) / Ctrl+Alt+D  shows / hides it - made the first time (a named docker of
 *                  static/floatpanels.js: id fd-dockers, side by side). Lit while it shows.
 *   ⇱ on a main docker's title bar (Preview, Timeline, Image editor, ComfyUI, Music, Stems, SFX, Chat, Console - the
 *                  StoryBoard has its own) floats it; drag it by its title over ▣ Docker - an orange line shows where it
 *                  goes. ⇲ in its title puts it back in the main window.
 *   The layout (⇆ side by side / ⇅ stacked / tabs), its name (double-click the title), what is in it and the sizes are
 *   kept in panel_layout.cfg with the other floating dockers.
 * Pure (Node: scripts/test-dockgroup545.js): isToggleKey, titleOf, CANDIDATES, GROUP. */
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
  const API = { GROUP, CANDIDATES, isToggleKey, titleOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const P = () => root.H3Panels;
  const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
  function shown() { const r = P() && P().get(GROUP); return !!(r && r.win && !r.win.classList.contains("off")); }
  function paint() {
    const b = $("tDG"); if (!b) return;
    const on = shown(); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
  }
  let watched = null;
  function watch() {
    const r = P() && P().get(GROUP); if (!r || !r.win || watched === r.win) return;
    watched = r.win;
    try { new root.MutationObserver(paint).observe(r.win, { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* the button repaints on its own presses */ }
  }
  /** show / hide ▣ Docker (made the first time) */
  async function toggle(on) {
    const p = P(); if (!p) return;
    try { await p.load(); } catch (e) { /* no saved layout */ }
    let r = p.get(GROUP);
    const want = on == null ? !shown() : !!on;
    if (!r) {
      if (!want) return;
      const w = Math.min(820, root.innerWidth - 80), h = Math.min(440, root.innerHeight - 160);
      r = p.newDocker({ id: GROUP, name: "Docker", layout: "row" });
      p.float(GROUP, { x: Math.max(20, (root.innerWidth - w) / 2), y: Math.max(50, (root.innerHeight - h) / 2 - 40), w, h });
    } else if (want && r.state === "in") p.float(GROUP);          // it was dropped in another docker - out again
    else p.show(GROUP, want);
    watch(); paint();
    tev("docker_group", want ? "shown" : "hidden");
  }
  /* ---- the statusbar button, the key */
  function button() {
    if ($("tDG")) return;
    const sb = $("statusbar"); if (!sb) return;
    const b = doc.createElement("button"); b.id = "tDG"; b.type = "button"; b.textContent = "▣ Docker";
    b.title = "Docker (Ctrl+Alt+D) - an empty docker: drag other dockers in by their title bar (⇱ floats a main docker) - side by side or stacked, double-click its title to rename it";
    b.onclick = () => toggle();
    const q = $("tQ"); sb.insertBefore(b, q ? q.nextSibling : $("sbdot"));
  }
  root.addEventListener("keydown", (e) => { if (isToggleKey(e)) { e.preventDefault(); e.stopPropagation(); toggle(); } }, true);
  /* ---- ⇱ on the main dockers: a floating window of their own (then into ▣ Docker) */
  function headText(h) { return titleOf([...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent)); }
  function css() {
    if ($("dgCss")) return;
    const s = doc.createElement("style"); s.id = "dgCss";
    s.textContent = ".dgfloat{background:var(--panel-2);border:1px solid var(--line);color:var(--dim);border-radius:5px;padding:1px 7px;font-size:.8rem;line-height:1.3;cursor:pointer;font-family:var(--body);letter-spacing:normal;text-transform:none;flex-shrink:0;margin-left:6px}"
      + ".dgfloat:hover{border-color:var(--tiger);color:var(--tiger)}.bhead>.dgfloat:first-child{margin-left:auto}"
      + ".h3fp .bdock.dg-floating{flex:1 1 auto!important;height:auto!important;min-height:0!important;max-height:none!important;display:flex;flex-direction:column;width:auto!important}"
      + ".h3fp .bdock.dg-floating>.bhead{display:none}.h3fp .bdock.dg-floating>.bbody{flex:1 1 auto;min-height:0;overflow:auto;display:block}"
      + ".h3fp:has(>.h3fp-b>.bdock.dg-floating.dockgone){display:none!important}";   // its statusbar button hides the whole window
    doc.head.appendChild(s);
  }
  function adoptDock(id) {
    const p = P(), d = $(id); if (!p || !d || $("dgFloat_" + id)) return !!$("dgFloat_" + id);
    const h = d.querySelector(":scope > .bhead"); if (!h) return false;
    css();
    const name = headText(h) || id;
    const b = doc.createElement("button"); b.className = "dgfloat"; b.id = "dgFloat_" + id;   // not .maxbtn: toggleMax re-labels every .maxbtn ⛶ b.type = "button"; b.textContent = "⇱";
    b.title = "Float the " + name + " docker - a window of its own; drag it into ▣ Docker (Ctrl+Alt+D) by its title. ⇲ in its title puts it back";
    b.onclick = (e) => {
      e.stopPropagation(); e.preventDefault();
      if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(id);
      const r = p.get("bd." + id), w = Math.min(720, root.innerWidth - 80), hh = Math.min(520, root.innerHeight - 140);
      p.float("bd." + id, r && r.w ? null : { x: Math.max(20, root.innerWidth - w - 40), y: 70, w, h: hh });
      tev("docker_float", id);
    };
    const mx = [...h.querySelectorAll(":scope > .maxbtn")].pop(); if (mx) h.insertBefore(b, mx.nextSibling); else h.appendChild(b);   // after ⛶ (it keeps the margin-left:auto)
    p.adopt({ id: "bd." + id, title: name, el: d, home: { parent: d.parentNode, before: d.nextElementSibling },
      onState: (s) => {
        d.classList.toggle("dg-floating", s !== "home");
        if (s !== "home") d.classList.remove("dockgone", "collapsed");
        if (typeof root.paintDockButtons === "function") { try { root.paintDockButtons(); } catch (er) { /* fine */ } }
        try { root.dispatchEvent(new root.Event("resize")); } catch (er) { /* fine */ }
      } });
    return true;
  }
  let tries = 0;
  function adoptAll() {
    if (!P()) return;
    const left = CANDIDATES.filter((id) => !adoptDock(id));
    if (left.length && ++tries < 40) root.setTimeout(adoptAll, 1500);  // the extension dockers load late
  }
  function start() {
    css();
    button();
    const p = P(); if (!p) return;
    p.load().then(() => { watch(); paint(); }).catch(() => {});
    adoptAll();
  }
  root.H3DockGroup = Object.assign(API, { toggle, shown, adoptDock });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
