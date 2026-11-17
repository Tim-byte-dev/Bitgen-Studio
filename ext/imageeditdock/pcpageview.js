/* pcpageview.js — SEVERAL PAGES IN THE WINDOW AT ONCE (2.813.0), window.PCPageView.
 *
 * Tim (verbatim): "allow user to change "view" to show multiple pages on the same window".
 *
 *   View ▸ Pages: One Page (as before) · Two Pages (side by side) · Many Pages (a grid, 4 across). The page in front is the
 *   live one (every tool works on it); the others are drawn around it in their places - pictures of each page, made
 *   again when something changes. A click on another page brings it to the front where it is; zoom (Ctrl+wheel / the
 *   zoom tool) and scrolling move the whole spread. One Page goes back to the single page, fitted.
 *   Pages of different sizes sit in cells the size of the biggest page.
 *
 * Pure (Node: scripts/test-pageview813.js): COLS, layout(sizes, mode, gap).
 */
(function (root) {
  "use strict";
  const MODES = [["one", "Pages: One Page"], ["two", "Pages: Two Pages"], ["many", "Pages: Many Pages"]];
  const COLS = { one: 1, two: 2, many: 4 };
  /** each page's place (doc px) in the spread: sizes [{w, h}] -> [{x, y, w, h}] (cells the size of the biggest page) */
  function layout(sizes, mode, gap) {
    const cols = COLS[mode] || 1, W = Math.max(1, ...sizes.map((s) => s.w)), H = Math.max(1, ...sizes.map((s) => s.h)), g = gap == null ? Math.round(W * 0.06) : gap;
    return sizes.map((s, i) => ({ x: (i % cols) * (W + g) + Math.round((W - s.w) / 2), y: Math.floor(i / cols) * (H + g), w: s.w, h: s.h }));
  }

  function install(E) {
    const { S, doc, store } = E; if (!doc || !E.pages || !E.ui || !E.ui.addCmd) return;
    const say = E.say || (() => {});
    let mode = store.get("pv.mode", "one"), box = null, shots = new Map(), lastCur = -1, view = null, busy = false, timer = 0;
    const multi = () => mode !== "one" && E.pages.count && E.pages.count() > 1 && (!S.pages || S.pages.editing == null);
    const sizes = () => E.pages.list().map((pg, i) => (i === E.pages.cur() ? { w: S.w, h: S.h } : (pg.st ? { w: pg.st.w || S.w, h: pg.st.h || S.h } : { w: S.w, h: S.h })));
    function host() {
      if (box && box.isConnected) return box;
      box = doc.createElement("div"); box.className = "pcpv";
      box.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:0";
      E.stage.insertBefore(box, E.stage.firstChild);
      return box;
    }
    /** the other pages' pictures (not while typing in a document frame - its page is swapped out meanwhile) */
    async function snap() {
      if (!multi() || busy || (E.docText && E.docText.editing && E.docText.editing())) return;
      busy = true;
      try {
        const cur = E.pages.cur(), out = new Map();
        await E.pages.eachPage(async (pg, i) => {
          if (i === cur) return;
          const f = E.flatten(); if (!f) return;
          const k = Math.min(1, 1400 / Math.max(f.width, f.height)), c = doc.createElement("canvas");
          c.width = Math.max(1, Math.round(f.width * k)); c.height = Math.max(1, Math.round(f.height * k));
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(f, 0, 0, c.width, c.height);
          out.set(i, c);
        });
        shots = out;
      } catch (e) { say("pages view: " + e.message); }
      finally { busy = false; }
      place();
    }
    const soon = () => { clearTimeout(timer); timer = setTimeout(snap, 700); };
    /** the pictures where their pages are, round the live page (the paper's own transform: S.panX / S.panY / S.zoom) */
    function place() {
      const b = host();
      if (!multi()) { b.innerHTML = ""; b.style.display = "none"; return; }
      b.style.display = "";
      const L = layout(sizes(), mode), cur = E.pages.cur(), me = L[cur], z = S.zoom;
      const have = new Set();
      L.forEach((p, i) => {
        if (i === cur) return;
        let el = b.querySelector(`[data-pv="${i}"]`);
        if (!el) { el = doc.createElement("div"); el.dataset.pv = i; el.style.cssText = "position:absolute;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.45);pointer-events:auto;cursor:pointer;overflow:hidden"; const no = i + 1; el.title = `Page ${no} - click to work on it`; b.appendChild(el); }
        const c = shots.get(i);
        if (c && el.firstChild !== c) { el.innerHTML = ""; c.style.cssText = "width:100%;height:100%;display:block"; el.appendChild(c); }
        el.style.left = Math.round(S.panX + (p.x - me.x) * z) + "px"; el.style.top = Math.round(S.panY + (p.y - me.y) * z) + "px";
        el.style.width = Math.round(p.w * z) + "px"; el.style.height = Math.round(p.h * z) + "px";
        have.add(String(i));
      });
      for (const el of [...b.children]) if (!have.has(el.dataset.pv)) el.remove();
      view = { z, ox: S.panX - me.x * z, oy: S.panY - me.y * z };       // where page 1's corner is on screen
    }
    /** the page in front changed (a click here, the Pages panel, a new page): it takes its place in the spread */
    function follow() {
      const cur = E.pages.cur();
      if (cur === lastCur) return false;
      lastCur = cur;
      if (!multi() || !view) return false;
      const L = layout(sizes(), mode), p = L[cur];
      S.zoom = view.z; S.panX = view.ox + p.x * view.z; S.panY = view.oy + p.y * view.z; S.userView = true;
      E.applyView(); soon();
      return true;
    }
    /** the whole spread fitted to the window (a row of it for Many Pages) */
    function fit() {
      if (!multi()) { lastCur = E.pages.cur(); view = null; E.fitView(); place(); return; }
      const L = layout(sizes(), mode), cols = COLS[mode], W = Math.max(...L.slice(0, cols).map((p) => p.x + p.w)), rows = Math.ceil(L.length / cols), H = Math.max(...L.map((p) => p.y + p.h));
      const aw = Math.max(50, E.stage.clientWidth - 40), ah = Math.max(50, E.stage.clientHeight - 40);
      const z = Math.min(1, aw / W, rows <= 2 ? ah / H : ah / (L[0].h * 1.15));
      const cur = E.pages.cur(), p = L[cur];
      S.zoom = z; S.panX = (E.stage.clientWidth - W * z) / 2 + p.x * z; S.panY = 20 + p.y * z - (rows <= 2 ? 0 : 0); S.userView = true;
      lastCur = cur; E.applyView(); snap();
    }
    function setMode(m) { mode = COLS[m] ? m : "one"; store.set("pv.mode", mode); if (mode !== "one" && E.pages.count() < 2) say("the document has one page - Two / Many Pages show when it has more"); fit(); }
    E.overlayHooks.push(() => { if (!follow()) place(); });
    const prevPush = E.onPush; E.onPush = function () { if (prevPush) prevPush.apply(this, arguments); if (multi()) soon(); };
    const prevUndo = E.onUndo; E.onUndo = function () { if (prevUndo) prevUndo.apply(this, arguments); if (multi()) soon(); };
    E.stage.addEventListener("pointerdown", (e) => {
      const el = e.target && e.target.closest ? e.target.closest("[data-pv]") : null; if (!el || !multi()) return;
      e.preventDefault(); e.stopPropagation();
      const i = +el.dataset.pv; place(); E.pages.go(i);
      // go() fits the page alone - put the spread back where it was
      follow();
    }, true);
    for (const [m, n] of MODES) E.ui.addCmd("view.pages." + m, n, "", () => setMode(m), { checked: () => mode === m });
    const V = E.ui.MENUS.find(([x]) => x === "View"); if (V) V[1].push(E.ui.sep, "view.pages.one", "view.pages.two", "view.pages.many");
    E.pageView = { mode: () => mode, setMode, fit, snap, layout: () => layout(sizes(), mode), ready: () => !busy && (!multi() || shots.size === E.pages.count() - 1) };
  }

  const PCPageView = { MODES, COLS, layout, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCPageView;
  if (root && root.document) root.PCPageView = PCPageView;
})(typeof window !== "undefined" ? window : globalThis);
