/* static/refreorder.js — 2.898.0: drag the References docker's pictures, videos and sounds to change their order.
 * Tim (verbatim): "allow user to drag reference images , videos and audio to change their order, like dragging from picture 6 to
 * picture 1 changes picture 6 to picture 1 etc"
 *   A picture (the tray's .slot), a video or a sound (#refvids / #refauds .aitem) dropped on another of its own kind TAKES THAT
 *   PLACE: picture 6 dropped on picture 1 becomes picture 1 and pictures 1 - 5 become 2 - 6 (dropped in the empty space after
 *   the last one = the last). A line shows where it lands while dragging. The prompt's <Picture n> / <Video n> / <Audio n> tags
 *   follow the move (a tag that meant the moved picture still means it). Several pictures picked (static/multisel.js) still drag
 *   onto the timeline together - that is not a reorder. Dragging a picture onto the timeline / the editor works as before.
 *   The page's arrays (index.html: refs, refVids, refAuds) are changed in place; renderTray / renderRefLists repaint and
 *   refkeep.js keeps the new order.
 * Pure (Node: scripts/test-898.js): move, positions, retag. */
(function (root) {
  "use strict";
  /** the list with item `from` taken out and put at `to` (both 0-based, clamped) - a new array */
  function move(list, from, to) {
    const a = (list || []).slice(), n = a.length; if (!n) return a;
    const f = Math.max(0, Math.min(n - 1, from | 0)), t = Math.max(0, Math.min(n - 1, to | 0));
    if (f === t) return a;
    const [x] = a.splice(f, 1); a.splice(t, 0, x); return a;
  }
  /** where each old place (0-based) ends up after move(n items, from, to) */
  function positions(n, from, to) { const order = move(Array.from({ length: n }, (_, i) => i), from, to), out = new Array(n); order.forEach((old, i) => { out[old] = i; }); return out; }
  /** the prompt's <Picture n> (kind "Picture" | "Video" | "Audio") tags after the move - each still names the same reference */
  function retag(text, kind, n, from, to) {
    const pos = positions(n, from, to), re = new RegExp("<" + kind + " (\\d+)>", "g");
    return String(text == null ? "" : text).replace(re, (m, d) => { const k = +d - 1; return k >= 0 && k < n ? `<${kind} ${pos[k] + 1}>` : m; });
  }
  const pure = { move, positions, retag };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  const doc = root.document;
  const G = (name) => { try { return (0, eval)(name); } catch (e) { return undefined; } };   // eslint-disable-line no-eval
  const call = (name, ...a) => { const f = G(name); if (typeof f === "function") { try { return f(...a); } catch (e) { /* the page */ } } return undefined; };
  const LISTS = [
    { id: "tray", item: ".slot", arr: "refs", kind: "Picture", word: "picture", after: () => { call("normalizeSubjects"); call("renderTray"); call("renderRefLists"); } },
    { id: "refvids", item: ".aitem", arr: "refVids", kind: "Video", word: "video", after: () => { call("renderRefLists"); call("renderTray"); } },
    { id: "refauds", item: ".aitem", arr: "refAuds", kind: "Audio", word: "sound", after: () => { call("renderRefLists"); } },
  ];
  let drag = null;            // {L, from, el}
  const items = (L) => { const box = doc.getElementById(L.id); return box ? [...box.querySelectorAll(":scope > " + L.item)] : []; };
  const clear = () => doc.querySelectorAll(".ro-before, .ro-after, .ro-end").forEach((x) => x.classList.remove("ro-before", "ro-after", "ro-end"));
  const editable = (t) => !!(t && t.closest && t.closest("input, textarea, select, [contenteditable=true], .refdesc"));
  /** the place the pointer means in this list: the item under it, else past the last one */
  function target(L, e) {
    const its = items(L), it = e.target.closest && e.target.closest(L.item);
    if (it && its.includes(it)) return its.indexOf(it);
    return its.length ? its.length - 1 : -1;
  }
  function wire(L) {
    const box = doc.getElementById(L.id); if (!box || box.dataset.roWired) return;
    box.dataset.roWired = "1";
    box.addEventListener("dragstart", (e) => {
      const it = e.target.closest && e.target.closest(L.item); drag = null;
      if (!it || !items(L).includes(it)) return;
      if (editable(e.target)) { if (L.id !== "tray") e.preventDefault(); return; }    // typing in a description is not a drag
      if (L.id === "tray" && it.classList.contains("rsel") && box.querySelectorAll(".slot.rsel").length > 1) return;   // several picked: onto the timeline
      drag = { L, from: items(L).indexOf(it), el: it };
      try { e.dataTransfer.setData("application/x-h3reforder", L.id); e.dataTransfer.effectAllowed = "copyMove"; } catch (er) { /* fine */ }
      it.classList.add("ro-dragging");
    }, true);
    box.addEventListener("dragover", (e) => {
      if (!drag || drag.L !== L) return;
      const to = target(L, e); if (to < 0) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      clear();
      const its = items(L), over = e.target.closest && e.target.closest(L.item);
      if (to !== drag.from) its[to].classList.add(!over ? "ro-end" : to < drag.from ? "ro-before" : "ro-after");
    });
    box.addEventListener("dragleave", (e) => { if (!box.contains(e.relatedTarget)) clear(); });
    box.addEventListener("drop", (e) => {
      if (!drag || drag.L !== L) return;
      e.preventDefault(); e.stopPropagation(); clear();
      const to = target(L, e), from = drag.from; drag.el.classList.remove("ro-dragging"); drag = null;
      reorder(L, from, to);
    });
    box.addEventListener("dragend", () => { clear(); if (drag && drag.el) drag.el.classList.remove("ro-dragging"); drag = null; });
  }
  /** the move itself (also for tests / the voice chat): list "tray" | "refvids" | "refauds", 0-based */
  function reorder(id, from, to) {
    const L = typeof id === "string" ? LISTS.find((x) => x.id === id) : id, arr = L && G(L.arr);
    if (!L || !Array.isArray(arr) || from < 0 || from >= arr.length || to < 0) return false;
    to = Math.min(to, arr.length - 1);                          // the "+ add" tile after the last = the last
    if (from === to) return false;
    const n = arr.length, now = move(arr, from, to);
    arr.splice(0, n, ...now);                                   // in place: the page's own array
    const p = doc.getElementById("prompt");
    if (p) { const t = retag(p.value, L.kind, n, from, to); if (t !== p.value) { p.value = t; p.dispatchEvent(new root.Event("input", { bubbles: true })); } }
    L.after();
    const a = from + 1, b = to + 1, msg = L.id === "tray" ? `Picture ${a} is now picture ${b}` : L.id === "refvids" ? `Video ${a} is now video ${b}` : `Sound ${a} is now sound ${b}`;
    call("refDropSay", msg, "good");
    const said = doc.getElementById("refdrop");                 // (written here too, so the app's translations find the words)
    if (said) said.textContent = L.id === "tray" ? `Picture ${a} is now picture ${b}` : L.id === "refvids" ? `Video ${a} is now video ${b}` : `Sound ${a} is now sound ${b}`;
    try { root.dispatchEvent(new root.CustomEvent("h3refreorder", { detail: { list: L.id, from, to } })); } catch (e) { /* old */ }
    return true;
  }
  /** a video / sound item can be picked up (the pictures already are) - after every repaint */
  function draggables() { for (const L of LISTS.slice(1)) items(L).forEach((it) => { it.draggable = true; if (!it.title || !/drag/i.test(it.title)) it.title = (it.title ? it.title + " - " : "") + "drag onto another to change the order"; }); }
  function start() {
    LISTS.forEach(wire);
    const f = G("renderRefLists");
    if (typeof f === "function" && !f._ro) { const w = function () { const r = f.apply(this, arguments); try { draggables(); } catch (e) { /* fine */ } return r; }; w._ro = true; root.renderRefLists = w; }
    draggables();
    if (!doc.getElementById("roCss")) {
      const css = doc.createElement("style"); css.id = "roCss";
      css.textContent = ".ro-dragging{opacity:.45;cursor:grabbing}.reflist .aitem.ro-before,#tray .slot.ro-before{box-shadow:inset 0 3px 0 var(--tiger,#f59e2c),-3px 0 0 var(--tiger,#f59e2c)}"
        + ".reflist .aitem.ro-after,.reflist .aitem.ro-end,#tray .slot.ro-after,#tray .slot.ro-end{box-shadow:inset 0 -3px 0 var(--tiger,#f59e2c),3px 0 0 var(--tiger,#f59e2c)}";
      doc.head.appendChild(css);
    }
  }
  const ready = () => typeof G("renderRefLists") === "function" && doc.getElementById("tray");
  const go = () => { if (ready()) start(); else setTimeout(go, 300); };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go); else go();
  root.H3RefOrder = Object.assign({ reorder, start }, pure);
})(typeof window !== "undefined" ? window : globalThis);
