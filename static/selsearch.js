/* bitGen Studio — static/selsearch.js (2.478.0): SEARCH IN EVERY DROPDOWN LIST, window.SelSearch.
 *
 * Tim (verbatim): "add a search/filter input to the dropdown lists like the comfyui nodes".
 *
 *   Every dropdown list (<select>) with enough items - anywhere in the app: the dockers, the image editor, the
 *   timeline, Settings, every dialog - opens a list of its own with a search box on top instead of the plain one:
 *     type      the list narrows as you type, best matches first (the start of a word, then anywhere, then the
 *               letters in order - "flx2" finds "FLUX.2 [dev]"); the letters that matched are lit; a group's name
 *               (an <optgroup>) matches too; the count "12 of 340" beside the box
 *     ↑ ↓ PgUp PgDn   move the lit row (Ctrl+Home / Ctrl+End = the first / last);  Enter / click = pick it;  Tab = pick
 *               the lit row and go on;  Esc / a click outside = close, nothing changed
 *     keys on a closed list:  any letter opens it already searching for that letter; Alt+↓ / F4 / Space / Enter
 *               open it; ↑ ↓ still step through it as before
 *   The pick sets the list's value and sends "input" + "change" as a pick by hand would, so everything that listens
 *   to the list works as before. Lists filled when they get the focus are filled first; a list that changes while
 *   open is redrawn.
 *   Settings ▸ General ▸ Dropdown lists: "Search in lists with N or more items" (default 8; 0 = never) - kept in
 *   this browser (localStorage "bg.selsearch"). A list with data-nosearch keeps the plain one.
 * Pure (Node: scripts/test-selsearch.js): match(query, text) -> {score, hits} | null, rank(items, query),
 *   itemsOf(select-like), eligible(select-like, min), DEFAULT_MIN.
 */
(function (root) {
  "use strict";
  const DEFAULT_MIN = 8, MAX_ROWS = 400, KEY = "bg.selsearch";

  /** fuzzy match like a node search: -> {score (higher = better), hits: [[from, to], …]} or null. Empty query = 1. */
  function match(query, text) {
    const q = String(query || "").trim().toLowerCase(), t = String(text || ""), tl = t.toLowerCase();
    if (!q) return { score: 1, hits: [] };
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1) {                                   // every word must match; the scores add up
      let score = 0; const hits = [];
      for (const w of words) { const m = match(w, t); if (!m) return null; score += m.score; hits.push(...m.hits); }
      return { score, hits: merge(hits) };
    }
    const isStart = (i) => i === 0 || /[^a-z0-9]/i.test(t[i - 1]) || (/[a-z]/.test(t[i - 1]) && /[A-Z]/.test(t[i]));
    if (tl === q) return { score: 1000, hits: [[0, t.length]] };
    let i = tl.indexOf(q);
    if (i === 0) return { score: 900 - t.length * 0.01, hits: [[0, q.length]] };
    let best = -1;
    for (let k = i; k >= 0; k = tl.indexOf(q, k + 1)) if (isStart(k)) { best = k; break; }
    if (best > 0) return { score: 800 - best - t.length * 0.01, hits: [[best, best + q.length]] };
    if (i > 0) return { score: 600 - i - t.length * 0.01, hits: [[i, i + q.length]] };
    // the letters in order (word starts count more, gaps count against)
    const hits = []; let pos = 0, score = 300, last = -2;
    for (const ch of q) {
      if (/\s/.test(ch)) continue;
      let k = -1;
      for (let j = pos; j < tl.length; j++) if (tl[j] === ch && isStart(j)) { k = j; break; }   // prefer a word start…
      const plain = tl.indexOf(ch, pos);
      if (k < 0 || (plain >= 0 && plain === last + 1)) k = plain;                               // …unless it runs on
      if (k < 0) return null;
      score += k === last + 1 ? 6 : isStart(k) ? 4 : -Math.min(8, k - last);
      if (hits.length && hits[hits.length - 1][1] === k) hits[hits.length - 1][1] = k + 1; else hits.push([k, k + 1]);
      last = k; pos = k + 1;
    }
    return { score: score - t.length * 0.01, hits };
  }
  function merge(h) {
    const s = h.slice().sort((a, b) => a[0] - b[0]), out = [];
    for (const r of s) { const p = out[out.length - 1]; if (p && r[0] <= p[1]) p[1] = Math.max(p[1], r[1]); else out.push(r.slice()); }
    return out;
  }
  /** the options of a <select> (or anything shaped like one): [{i, value, text, group, disabled, title}] */
  function itemsOf(sel) {
    const out = [];
    const opts = sel && sel.options ? Array.from(sel.options) : [];
    opts.forEach((o, i) => {
      const g = o.parentNode && o.parentNode.tagName === "OPTGROUP" ? o.parentNode.label || "" : (o.group || "");
      out.push({ i, value: o.value, text: (o.label || o.text || "").trim(), group: g, disabled: !!(o.disabled || (o.parentNode && o.parentNode.disabled)), title: o.title || "", hidden: !!o.hidden,
        ...(o.style && o.style.fontFamily ? { font: o.style.fontFamily } : {}) });   // 2.608.0: a font list's row is written in its own font (static/fontlist.js)
    });
    return out.filter((x) => !x.hidden);
  }
  /** -> the items to show for a query, best first (an empty query keeps the list's own order); each with its hits */
  function rank(items, query) {
    const q = String(query || "").trim();
    if (!q) return items.map((x) => Object.assign({}, x, { hits: [] }));
    const out = [];
    for (const x of items) {
      let m = match(q, x.text), viaGroup = false;
      if (!m && x.group) { const g = match(q, x.group + " " + x.text); if (g) { m = { score: g.score - 50, hits: [] }; viaGroup = true; } }
      if (!m && x.value && x.value !== x.text) { const v = match(q, x.value); if (v) m = { score: v.score - 100, hits: [] }; }
      if (m) out.push(Object.assign({}, x, { score: m.score, hits: viaGroup ? [] : m.hits }));
    }
    return out.sort((a, b) => b.score - a.score || a.i - b.i);
  }
  /** should this list open with a search box? */
  function eligible(sel, min) {
    if (!sel || sel.tagName !== "SELECT" || sel.multiple || sel.disabled || (sel.size && sel.size > 1)) return false;
    if (sel.dataset && (sel.dataset.nosearch != null)) return false;
    const m = min == null ? DEFAULT_MIN : min;
    if (!(m > 0)) return false;
    return sel.options.length >= m;
  }
  const pure = { DEFAULT_MIN, match, rank, itemsOf, eligible, merge };

  /* ------------------------------------------------------------------ the page */
  function install(doc) {
    const win = doc.defaultView || root;
    if (win.__selSearch) return win.__selSearch;
    let min = DEFAULT_MIN;
    try { const v = JSON.parse(win.localStorage.getItem(KEY) || "null"); if (v && typeof v.min === "number") min = v.min; } catch (e) { /* none */ }
    const css = doc.createElement("style");
    css.textContent = `
.selsearch{position:fixed;z-index:2147483000;inset:auto;margin:0;padding:0;display:flex;flex-direction:column;min-width:180px;max-width:min(560px,96vw);
  background:var(--panel,#1d1a15);color:var(--text,#e8e2d6);border:1px solid var(--tiger,#f59e2c);border-radius:6px;
  box-shadow:0 10px 30px rgba(0,0,0,.55);font:12.5px var(--body,system-ui,sans-serif);overflow:hidden}
.selsearch .ssbar{display:flex;align-items:center;gap:6px;padding:5px 6px;border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}
.selsearch .ssbar input{flex:1;min-width:0;background:var(--ink,#14120f);color:inherit;border:1px solid var(--line,#3a342a);border-radius:4px;padding:4px 7px;font:inherit;outline:none}
.selsearch .ssbar input:focus{border-color:var(--tiger,#f59e2c)}
.selsearch .sscount{color:var(--dim,#9a917f);font:11px var(--mono,monospace);white-space:nowrap}
.selsearch .sslist{overflow:auto;max-height:340px;padding:3px 0}
.selsearch .ssrow{padding:4px 10px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:8px;align-items:baseline}
.selsearch .ssrow .t{flex:1;overflow:hidden;text-overflow:ellipsis}
.selsearch .ssrow .g{color:var(--dim,#9a917f);font-size:10.5px;flex:none}
.selsearch .ssrow b{color:var(--tiger,#f59e2c);font-weight:700}
.selsearch .ssrow.lit{background:var(--ui-on,#4a3414)}
.selsearch .ssrow.cur .t::before{content:"✓ ";color:var(--tiger,#f59e2c)}
.selsearch .ssrow.dis{opacity:.45;cursor:default}
.selsearch .ssgrp{padding:5px 10px 2px;color:var(--dim,#9a917f);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em}
.selsearch .ssnone,.selsearch .ssmore{padding:6px 10px;color:var(--dim,#9a917f);font-style:italic}`;
    (doc.head || doc.documentElement).appendChild(css);
    let open = null;     // {sel, box, input, list, rows, lit, obs}

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const lit = (text, hits) => { if (!hits || !hits.length) return esc(text); let o = "", p = 0; for (const [a, b] of hits) { o += esc(text.slice(p, a)) + "<b>" + esc(text.slice(a, b)) + "</b>"; p = b; } return o + esc(text.slice(p)); };

    function draw() {
      const o = open; if (!o) return;
      const all = itemsOf(o.sel), q = o.input.value, shown = rank(all, q);
      const cur = o.sel.selectedIndex;
      o.count.textContent = q.trim() ? `${shown.length} of ${all.length}` : `${all.length}`;
      let html = "", lastG = null;
      const grouped = !q.trim() && all.some((x) => x.group);
      shown.slice(0, MAX_ROWS).forEach((x, k) => {
        if (grouped && x.group !== lastG) { lastG = x.group; if (x.group) html += `<div class="ssgrp">${esc(x.group)}</div>`; }
        html += `<div class="ssrow${x.disabled ? " dis" : ""}${x.i === cur ? " cur" : ""}" data-k="${k}" data-i="${x.i}"${x.title ? ` title="${esc(x.title)}"` : ""}><span class="t"${x.font ? ` style="font-family:${esc(x.font)};font-size:13.5px"` : ""}>${lit(x.text || x.value || "—", x.hits)}</span>${!grouped && x.group ? `<span class="g">${esc(x.group)}</span>` : ""}</div>`;
      });
      if (!shown.length) html = `<div class="ssnone">Nothing matches "${esc(q)}"</div>`;
      else if (shown.length > MAX_ROWS) html += `<div class="ssmore">… ${shown.length - MAX_ROWS} more - type to narrow the list</div>`;
      o.list.innerHTML = html;
      o.rows = Array.from(o.list.querySelectorAll(".ssrow"));
      // the lit row: the current value when nothing is typed, else the best match
      let k = -1;
      if (!q.trim()) k = o.rows.findIndex((r) => +r.dataset.i === cur);
      if (k < 0) k = o.rows.findIndex((r) => !r.classList.contains("dis"));
      setLit(k, true);
    }
    function setLit(k, center) {
      const o = open; if (!o) return;
      if (o.rows[o.lit]) o.rows[o.lit].classList.remove("lit");
      o.lit = k;
      const r = o.rows[k]; if (!r) return;
      r.classList.add("lit");
      const L = o.list, top = r.offsetTop, bot = top + r.offsetHeight;
      if (center) L.scrollTop = Math.max(0, top - L.clientHeight / 2 + r.offsetHeight / 2);
      else if (top < L.scrollTop) L.scrollTop = top; else if (bot > L.scrollTop + L.clientHeight) L.scrollTop = bot - L.clientHeight;
    }
    function step(d) {
      const o = open; if (!o || !o.rows.length) return;
      let k = o.lit;
      for (let n = 0; n < o.rows.length; n++) {
        k = Math.max(0, Math.min(o.rows.length - 1, k + d));
        if (!o.rows[k].classList.contains("dis")) break;
        if (k === 0 || k === o.rows.length - 1) break;
      }
      if (!o.rows[k].classList.contains("dis")) setLit(k);
    }
    function place() {
      const o = open; if (!o) return;
      const r = o.sel.getBoundingClientRect(), vw = win.innerWidth, vh = win.innerHeight;
      o.box.style.minWidth = Math.max(180, Math.round(r.width)) + "px";
      const h = Math.min(400, o.box.offsetHeight || 380), below = vh - r.bottom - 6, above = r.top - 6;
      const up = below < Math.min(h, 220) && above > below;
      o.list.style.maxHeight = Math.max(120, Math.min(340, (up ? above : below) - 44)) + "px";
      const bh = o.box.offsetHeight;
      o.box.style.top = Math.round(up ? Math.max(4, r.top - bh - 2) : Math.min(vh - bh - 4, r.bottom + 2)) + "px";
      o.box.style.left = Math.round(Math.max(4, Math.min(vw - o.box.offsetWidth - 4, r.left))) + "px";
    }
    function pick(i) {
      const o = open; if (!o) return;
      const sel = o.sel, opt = sel.options[i];
      close();
      if (!opt || opt.disabled) return;
      if (sel.selectedIndex !== i) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new win.Event("input", { bubbles: true }));
        sel.dispatchEvent(new win.Event("change", { bubbles: true }));
      }
      try { sel.focus({ preventScroll: true }); } catch (e) { sel.focus(); }
    }
    function close() {
      const o = open; if (!o) return;
      open = null;
      if (o.obs) o.obs.disconnect();
      try { if (o.box.matches(":popover-open")) o.box.hidePopover(); } catch (e) { /* not a popover */ }
      o.box.remove();
      win.removeEventListener("resize", onAway, true);
      win.removeEventListener("scroll", onScroll, true);
      doc.removeEventListener("pointerdown", onOutside, true);
    }
    // 2.533.0: only the WINDOW being resized closes it - a <video>'s own "resize" event (a preview playing: its picture
    // size known / changed) reaches a capturing listener too and closed the list at random; and only a scroll that moves
    // the list's select (the page, or a box the select is in) - not the log or a gallery scrolling by itself
    const onAway = (e) => { if (!e || e.target === win || e.target === doc) close(); };
    const onScroll = (e) => {
      if (!open || open.box.contains(e.target)) return;
      const t = e.target;
      if (t === doc || t === win || t === doc.documentElement || t === doc.body || (t && t.contains && t.contains(open.sel))) close();
    };
    const onOutside = (e) => { if (open && !open.box.contains(e.target) && e.target !== open.sel) close(); };

    function onKey(e) {
      const o = open; if (!o) return;
      if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
      else if (e.key === "PageDown") { e.preventDefault(); step(10); }
      else if (e.key === "PageUp") { e.preventDefault(); step(-10); }
      else if (e.ctrlKey && e.key === "Home") { e.preventDefault(); setLit(0); }
      else if (e.ctrlKey && e.key === "End") { e.preventDefault(); setLit(o.rows.length - 1); }
      else if (e.key === "Enter") { e.preventDefault(); const r = o.rows[o.lit]; if (r) pick(+r.dataset.i); else close(); }
      else if (e.key === "Tab") { const r = o.rows[o.lit]; if (r && o.input.value.trim()) { e.preventDefault(); pick(+r.dataset.i); } else close(); }
      else if (e.key === "Escape") { e.preventDefault(); const sel = o.sel; close(); try { sel.focus({ preventScroll: true }); } catch (x) { /* fine */ } }
    }
    // the search list is the app's while it is open: presses and keys inside it go nowhere else (not the dock, not a
    // popover that closes on an outside press, not the editor's shortcuts) - caught first, on the window
    ["pointerdown", "mousedown", "touchstart"].forEach((t) => win.addEventListener(t, (e) => {
      if (!open || !open.box.contains(e.target)) return;
      e.stopPropagation();
      if (e.target !== open.input && t !== "touchstart") e.preventDefault();             // keep the focus in the box
    }, true));
    ["keydown", "keyup", "keypress"].forEach((t) => win.addEventListener(t, (e) => {
      if (!open || !open.box.contains(e.target)) return;
      e.stopPropagation();
      if (t === "keydown") onKey(e);
    }, true));

    function show(sel, query) {
      if (open) close();
      const box = doc.createElement("div");
      box.className = "selsearch"; box.setAttribute("role", "listbox");
      box.innerHTML = `<div class="ssbar"><input type="text" spellcheck="false" autocomplete="off" placeholder="🔍 Search…" aria-label="Search the list"><span class="sscount"></span></div><div class="sslist"></div>`;
      // 2.533.0 (Tim: "the select lora dialog folder dropdown is opening behind the dialog"): a dialog opened with
      // showModal() sits in the browser's top layer - over any z-index - and makes the rest of the page inert, so a list
      // put in <body> was drawn behind it and could not be clicked. It goes in the list's own dialog (or the open modal
      // one), and into the top layer itself as a popover where the browser has them.
      hostOf(sel).appendChild(box);
      try { if (typeof box.showPopover === "function") { box.setAttribute("popover", "manual"); box.showPopover(); } } catch (e) { /* no popovers: the dialog holds it */ }
      const input = box.querySelector("input");
      open = { sel, box, input, list: box.querySelector(".sslist"), count: box.querySelector(".sscount"), rows: [], lit: -1, obs: null };
      input.value = query || "";
      draw(); place();
      input.focus();
      try { const n = input.value.length; input.setSelectionRange(n, n); } catch (e) { /* fine */ }
      input.addEventListener("input", () => { draw(); });
      open.list.addEventListener("click", (e) => { const r = e.target.closest(".ssrow"); if (r && !r.classList.contains("dis")) pick(+r.dataset.i); });
      open.list.addEventListener("pointermove", (e) => { const r = e.target.closest(".ssrow"); if (r && open && !r.classList.contains("dis")) { const k = +r.dataset.k; if (k !== open.lit) setLit(k); } });
      // a list that is filled or changed while open is redrawn
      try { open.obs = new win.MutationObserver(() => { if (open) { draw(); place(); } }); open.obs.observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "label"] }); } catch (e) { /* no observer */ }
      win.addEventListener("resize", onAway, true);
      win.addEventListener("scroll", onScroll, true);
      doc.addEventListener("pointerdown", onOutside, true);
      return box;
    }
    /** where an open list goes: the select's own open dialog, else the top modal dialog, else <body> */
    function hostOf(sel) {
      const own = sel && sel.closest ? sel.closest("dialog[open]") : null;
      if (own) return own;
      const modal = [...doc.querySelectorAll("dialog[open]")].filter((d) => { try { return d.matches(":modal"); } catch (e) { return false; } }).pop();
      return modal || doc.body;
    }
    function openFor(sel, query) {
      if (!eligibleNow(sel)) return false;
      try { sel.focus({ preventScroll: true }); } catch (e) { sel.focus(); }     // "focus" fills lazy lists
      win.setTimeout(() => { if (doc.contains(sel)) show(sel, query || ""); }, 0);
      return true;
    }
    // lists filled on focus have few items before - so a list is eligible if it has items now or will be filled
    const eligibleNow = (sel) => eligible(sel, min);

    doc.addEventListener("mousedown", (e) => {
      const sel = e.target && e.target.closest ? e.target.closest("select") : null;
      if (!sel || e.button !== 0) return;
      if (open && open.sel === sel) { e.preventDefault(); close(); return; }
      if (!eligibleNow(sel)) return;
      e.preventDefault();
      openFor(sel, "");
    }, true);
    doc.addEventListener("keydown", (e) => {
      const sel = e.target;
      if (!sel || sel.tagName !== "SELECT" || e.ctrlKey || e.metaKey || !eligibleNow(sel)) return;
      const k = e.key;
      const opener = (e.altKey && (k === "ArrowDown" || k === "ArrowUp")) || k === "F4" || k === " " || k === "Enter";
      const letter = !e.altKey && k.length === 1 && /\S/.test(k);
      if (!opener && !letter) return;
      e.preventDefault(); e.stopPropagation();
      openFor(sel, letter ? k : "");
    }, true);

    const api = {
      get min() { return min; },
      setMin(n) { min = Math.max(0, Math.round(+n || 0)); try { win.localStorage.setItem(KEY, JSON.stringify({ min })); } catch (e) { /* private window */ } return min; },
      open: (sel, q) => { if (!sel) return null; try { sel.focus({ preventScroll: true }); } catch (e) { /* fine */ } return show(sel, q || ""); },
      close, isOpen: () => !!open, current: () => open && open.sel, hostOf,
      shown: () => (open ? open.rows.map((r) => r.querySelector(".t").textContent) : []),
      lit: () => (open && open.rows[open.lit] ? +open.rows[open.lit].dataset.i : -1),
    };
    win.__selSearch = api;
    settingsBlock(doc, api);
    return api;
  }

  /** Settings ▸ General ▸ Dropdown lists */
  function settingsBlock(doc, api) {
    const add = () => {
      const pane = doc.getElementById("stab-general");
      if (!pane || doc.getElementById("s_selsearch")) return !!pane;
      const wrap = doc.createElement("div");
      wrap.innerHTML = `<label class="f" style="margin-top:14px">Dropdown lists</label>
<div class="scale" style="gap:8px;align-items:center;flex-wrap:wrap">
  <label style="display:flex;align-items:center;gap:6px">🔍 Search in lists with <input type="number" id="s_selsearch" min="0" max="999" step="1" style="width:60px"> or more items</label>
  <button class="ghost" id="s_selsearchreset" type="button">Default (${DEFAULT_MIN})</button>
</div>
<p class="hint help" style="margin-top:6px">A long dropdown list opens with a search box on top, like the node search: type to narrow it
  (the start of a word first, then the letters in order), ↑ ↓ and Enter to pick, Esc to close. 0 = always the plain list.
  Kept in this browser.</p>`;
      pane.appendChild(wrap);
      const inp = doc.getElementById("s_selsearch");
      inp.value = api.min;
      inp.addEventListener("change", () => { inp.value = api.setMin(inp.value); });
      doc.getElementById("s_selsearchreset").onclick = () => { inp.value = api.setMin(DEFAULT_MIN); };
      return true;
    };
    if (!add()) {
      const t = (doc.defaultView || root).setInterval(() => { if (add()) (doc.defaultView || root).clearInterval(t); }, 1000);
      (doc.defaultView || root).setTimeout(() => (doc.defaultView || root).clearInterval(t), 60000);
    }
  }

  const SelSearch = Object.assign({ install, KEY }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = SelSearch;
  else {
    root.SelSearch = SelSearch;
    const go = () => install(root.document);
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", go); else go();
  }
})(typeof window !== "undefined" ? window : globalThis);
