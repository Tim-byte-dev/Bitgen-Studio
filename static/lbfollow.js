/* bitGen Studio — static/lbfollow.js (2.534.0): A RENDER THAT FINISHES WHILE THE PREVIEW IS OPEN JOINS IT.
 *
 * Tim (verbatim): "if user is in the preview dialog and a new generation completes add it to the preview dialog"
 *
 *   The preview (#lb, the lightbox in index.html) slides through the list its thumbnail was clicked in - the Gallery,
 *   the image tray, an Assets tab ([data-lb-group]). While it is open that list is watched: when the dock adds files
 *   (a job finished and the gallery repainted) they join the preview's strip at once - in the dock's order, the
 *   picture you are looking at stays on screen, the position "3 / 12" follows - and a "✨ 1 new" chip in its top bar
 *   jumps to the newest one. Files the dock drops while it is open stay in the preview until it closes.
 * Pure (Node: scripts/test-lbfollow534.js): merge(oldItems, newItems, curUrl) -> {items, i, added}.
 */
(function (root) {
  "use strict";
  /** the dock's list now + what the preview had -> the preview's new list (pure) */
  function merge(old, now, curUrl) {
    const seen = {}, items = [];
    (now || []).forEach(function (x) { if (x && x.url && !seen[x.url]) { seen[x.url] = 1; items.push(x); } });
    const had = {}; (old || []).forEach(function (x) { had[x.url] = 1; });
    const added = items.filter(function (x) { return !had[x.url]; });
    (old || []).forEach(function (x) { if (!seen[x.url]) { seen[x.url] = 1; items.push(x); } });   // what the dock dropped stays while open
    let i = items.findIndex(function (x) { return x.url === curUrl; });
    if (i < 0) i = 0;
    return { items: items, i: i, added: added };
  }
  const pure = { merge: merge };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  const $ = (id) => document.getElementById(id);
  const S = { group: null, obs: null, t: null, newest: null, count: 0 };
  function lbState() { try { return lb; } catch (e) { return null; } }       // index.html's `const lb` (the global lexical scope)
  function chip() {
    let c = $("lb_newc");
    if (!c) {
      const top = document.querySelector("#lb .lbtop"); if (!top) return null;
      c = document.createElement("button"); c.type = "button"; c.className = "ghost"; c.id = "lb_newc";
      c.style.cssText = "display:none;border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c);margin-left:8px";
      c.title = "A render finished while this was open - show the newest";
      c.onclick = () => { const L = lbState(); if (!L || !S.newest) return; const i = L.items.findIndex((x) => x.url === S.newest.url); if (i >= 0) { L.i = i; lbShow(); } hideChip(); };
      const pos = $("lb_pos"); if (pos && pos.parentElement === top) pos.after(c); else top.appendChild(c);
    }
    return c;
  }
  function hideChip() { S.count = 0; S.newest = null; const c = $("lb_newc"); if (c) c.style.display = "none"; }
  function sync() {
    const L = lbState(), d = $("lb");
    if (!L || !d || !d.open || !S.group || !document.contains(S.group)) return 0;
    const any = S.group.querySelector("[data-lb-url]"); if (!any) return 0;
    const now = lbItemsFrom(any), cur = L.items[L.i];
    const r = merge(L.items, now, cur && cur.url);
    if (!r.added.length) return 0;
    const film = $("lb_film"), sl = film ? film.scrollLeft : 0;
    L.items = r.items; L.i = r.i;
    lbFilm(); if (film) film.scrollLeft = sl; lbFilmMark();
    $("lb_pos").textContent = L.items.length > 1 ? `${L.i + 1} / ${L.items.length}` : "";
    ["lb_prev", "lb_next", "lb_pv", "lb_nx"].forEach((id) => { if ($(id)) $(id).disabled = L.items.length < 2; });
    S.count += r.added.length; S.newest = r.added[0];
    const c = chip(); if (c) { c.textContent = "✨ " + S.count + " new"; c.style.display = ""; }
    return r.added.length;
  }
  function watch() {
    if (S.obs) { S.obs.disconnect(); S.obs = null; }
    if (!S.group || typeof MutationObserver !== "function") return;
    S.obs = new MutationObserver(() => { clearTimeout(S.t); S.t = setTimeout(sync, 120); });
    S.obs.observe(S.group, { childList: true, subtree: true });
  }
  function start() {
    const d = $("lb"); if (!d || typeof lbItemsFrom !== "function") { setTimeout(start, 200); return; }
    // which list the preview was opened from (capture: before index.html's own click handler opens it)
    document.addEventListener("click", (e) => {
      const el = e.target && e.target.closest ? e.target.closest("[data-lb-url]") : null;
      if (el && !d.open) S.group = el.closest("[data-lb-group]");
    }, true);
    new MutationObserver(() => { if (d.open) { hideChip(); watch(); } else { if (S.obs) S.obs.disconnect(); S.obs = null; hideChip(); } })
      .observe(d, { attributes: true, attributeFilter: ["open"] });
  }
  root.H3LbFollow = Object.assign({ sync, state: () => S, from: (el) => { S.group = el && el.closest ? el.closest("[data-lb-group]") : null; if ($("lb") && $("lb").open) watch(); } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
