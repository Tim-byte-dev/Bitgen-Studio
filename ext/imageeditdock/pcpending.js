/* pcpending.js — ⏳ PENDING: the AI results waiting to be applied (2.556.0), window.PCPending.
 *
 * Tim: "allow user to add multiple generations, edits, refine, fills, etc to queue, place those images in another
 * floating docker that is confined to the image-editor, call it pending - add apply button and delete button to each
 * image, apply will apply create a layer above the one selected. multiple layers can be added over that layer but make it
 * a group for the changes on that selected layer."
 *
 *   QUEUE       ✨ Generate / Edit / Refine / Fill / Remove / New background / Compose never wait for the last one: each
 *               press queues its renders (the job list runs them in turn) and the editor stays free
 *   ⏳ PENDING  a floating docker INSIDE the image editor (dragged by its title, kept inside the editor, ✕ hides it, the
 *               ✨ AI panel's ⏳ button and every new render bring it back): one card per render - a thumbnail (click =
 *               preview it over the canvas), what it was, which layer it belongs to, ✔ Apply, 🗑 Delete; ✔ all / 🗑 all
 *   ✔ APPLY     a new layer ABOVE the layer that was selected when the render was asked for, inside ONE group per layer -
 *               "✨ changes: <layer>" (made the first time, then every applied result goes on top inside it); one undo
 *               step each. A result for a shape / mask fill (✨ Generate Fill in Shape) still goes into that shape.
 *   E.pending.auto = true (window.__H3_PENDING_AUTO before the page loads): the old behaviour (results straight in / the
 *               results row) - the browser tests of older releases use it.
 *   The References docker's pictures (2.556.0, imageedit.js runAI / runCompose): "picture N" / "image N" in the prompt (the
 *               docker's numbers) or the ↳ reference dropdown go along with an Edit, and Generate / Fill / Remove / New
 *               background / Refine then run through the edit model; ✨ Compose takes "ref N" / "reference N".
 * Pure (Node: scripts/test-pending556.js): groupFor(layers, targetId), clampPos(pos, size, box), caption(item).
 */
(function (root) {
  "use strict";
  /** the changes group for a target: {group, owner} - a layer inside a changes group (or the group itself) belongs to the
   *  group's owner; else the existing group of the target (or none yet) */
  function groupFor(layers, targetId) {
    const L = (layers || []).find((x) => x.id === targetId) || null;
    if (!L) return { owner: null, group: null };
    if (L.type === "group" && L.changesOf != null) return { owner: (layers.find((x) => x.id === L.changesOf) || null), group: L };
    const par = L.parent != null ? layers.find((x) => x.id === L.parent) : null;
    if (par && par.changesOf != null) return { owner: layers.find((x) => x.id === par.changesOf) || L, group: par };
    return { owner: L, group: layers.find((x) => x.type === "group" && x.changesOf === L.id) || null };
  }
  /** a floating box kept inside the editor: pos {x, y}, size {w, h}, box {w, h} -> {x, y} */
  function clampPos(pos, size, box) {
    const x = Math.max(0, Math.min(Math.max(0, box.w - size.w), Math.round(pos.x || 0)));
    const y = Math.max(0, Math.min(Math.max(0, box.h - Math.min(size.h, 40)), Math.round(pos.y || 0)));
    return { x, y };
  }
  const MODE = { generate: "✨ Generate", edit: "✏ Edit", refine: "🔁 Refine", remove: "🧽 Remove", background: "🖼 Background", compose: "🧩 Compose" };
  function caption(it) {
    const p = String(it.prompt || "").replace(/\s+/g, " ").trim();
    return `${it.label || MODE[it.mode] || it.mode}${it.of > 1 ? ` ${it.n}/${it.of}` : ""}${p ? ": " + (p.length > 48 ? p.slice(0, 46) + "…" : p) : ""}`;
  }
  const pure = { groupFor, clampPos, caption };

  function install(E) {
    const { S, D, doc, win, store } = E;
    const kx = E.kx;
    if (!kx || !D) return;
    const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
    const items = [];
    let uid = 0, running = 0, previewing = null;
    // ---- the docker
    if (!doc.getElementById("pcPendCss")) {
      const st = doc.createElement("style"); st.id = "pcPendCss";
      st.textContent = `.pcpend{position:absolute;z-index:60;width:262px;max-height:70%;display:flex;flex-direction:column;background:var(--pc-panel,#323232);color:var(--pc-text,#ddd);border:1px solid var(--pc-sep,#555);border-radius:6px;box-shadow:0 6px 22px rgba(0,0,0,.45);font:12px system-ui,sans-serif}
.pcpend.off{display:none}.pcpend .pph{display:flex;align-items:center;gap:4px;padding:5px 6px;cursor:move;background:var(--pc-panel2,#3c3c3c);border-radius:6px 6px 0 0;user-select:none}
.pcpend .pph b{flex:1;font-weight:600;white-space:nowrap}.pcpend .pph #ppN{font-size:11px;color:var(--pc-dim,#999);white-space:nowrap}.pcpend .pph button{white-space:nowrap}.pcpend .pph button,.pcpend .ppc button{background:none;border:1px solid var(--pc-sep,#555);color:inherit;border-radius:4px;padding:1px 6px;cursor:pointer;font:inherit}
.pcpend .pph button:hover,.pcpend .ppc button:hover{background:var(--pc-hover,#454545)}.pcpend .ppl{overflow:auto;padding:4px;display:flex;flex-direction:column;gap:4px}
.pcpend .ppc{display:grid;grid-template-columns:72px 1fr;gap:6px;padding:4px;border:1px solid var(--pc-line,#1d1d1d);border-radius:4px;background:var(--pc-input,#232323)}
.pcpend .ppc.on{outline:2px solid var(--pc-accent,#2680eb)}.pcpend .ppc canvas{width:72px;height:72px;cursor:pointer;background:#111;border-radius:3px}
.pcpend .ppt{display:flex;flex-direction:column;gap:3px;min-width:0}.pcpend .ppt .cap{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pcpend .ppt .sub{color:var(--pc-dim,#999);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcpend .ppt .row{display:flex;gap:4px}.pcpend .ppe{padding:10px;color:var(--pc-dim,#999);text-align:center}`;
      doc.head.appendChild(st);
    }
    if (win.getComputedStyle && win.getComputedStyle(kx).position === "static") kx.style.position = "relative";
    const box = doc.createElement("div"); box.className = "pcpend off"; box.id = "pcPend";
    box.innerHTML = `<div class="pph" id="ppHead" title="⏳ Pending - drag to move (it stays inside the editor)"><b>⏳ Pending</b><span id="ppN"></span>
      <button type="button" id="ppAll" title="Apply every finished result (each a layer in its layer's changes group)">✔ all</button>
      <button type="button" id="ppDelAll" title="Delete every result here">🗑 all</button>
      <button type="button" id="ppHide" title="Hide (⏳ in the ✨ AI panel brings it back)">✕</button></div>
      <div class="ppl" id="ppList"></div>`;
    kx.appendChild(box);
    const $p = (id) => box.querySelector("#" + id);
    let pos = store.get("pending.pos", null);
    const place = () => {
      const r = { w: kx.clientWidth || 800, h: kx.clientHeight || 600 };
      if (!pos) pos = { x: r.w - 260, y: 64 };
      pos = clampPos(pos, { w: box.offsetWidth || 244, h: box.offsetHeight || 120 }, r);
      box.style.left = pos.x + "px"; box.style.top = pos.y + "px";
    };
    // drag by the title (inside the editor only)
    // 2.609.0: over the panel column = its drop line, let go there = docked in the column (pccoldock.js); docked, its
    // column bar moves it (this title is just a title there)
    $p("ppHead").addEventListener("pointerdown", (e) => {
      if (e.target.closest("button") || box.closest(".pcfd")) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, p0 = Object.assign({}, pos);
      const mv = (ev) => { pos = { x: p0.x + ev.clientX - sx, y: p0.y + ev.clientY - sy }; place(); if (E.coldock) E.coldock.hover(ev.clientX, ev.clientY); };
      const up = (ev) => { win.removeEventListener("pointermove", mv); win.removeEventListener("pointerup", up); store.set("pending.pos", pos); if (E.coldock && ev) E.coldock.drop(ev.clientX, ev.clientY); };
      win.addEventListener("pointermove", mv); win.addEventListener("pointerup", up);
    });
    win.addEventListener("resize", () => { if (!box.classList.contains("off")) place(); });
    function show() { box.classList.remove("off"); if (!box.closest(".pcfd")) place(); }
    /** 2.609.0: out of the panel column, floating at (at.x, at.y) on the screen */
    function moveTo(at) { if (!at) return; const kr = kx.getBoundingClientRect(); pos = { x: Math.round(at.x - kr.left), y: Math.round(at.y - kr.top) }; place(); store.set("pending.pos", pos); }
    function hide() { box.classList.add("off"); if (previewing) unpreview(); }
    $p("ppHide").onclick = hide;
    $p("ppAll").onclick = () => applyAll();
    $p("ppDelAll").onclick = () => clear();
    // the ✨ AI panel's ⏳ button
    const run = E.$ ? E.$("kxRun") : null;
    let btn = null;
    if (run && run.parentNode) {
      btn = doc.createElement("button"); btn.type = "button"; btn.className = "ghost"; btn.id = "kxPendBtn";
      btn.title = "⏳ Pending - the queued AI results; ✔ Apply puts one above its layer (in that layer's changes group)";
      btn.textContent = "⏳ Pending"; btn.onclick = () => (box.classList.contains("off") ? show() : hide());
      run.after(btn);
    }
    function preview(it) {
      if (!it || !it.layer) return;
      previewing = previewing === it ? null : it;
      if (E.setPreview) E.setPreview(previewing ? it.layer : null);
      render();
    }
    function unpreview() { previewing = null; if (E.setPreview) E.setPreview(null); }
    function thumb(it) {
      const c = E.newCanvas(144, 144), g = c.getContext("2d");
      const b = (it.info && it.info.box) || { x: 0, y: 0, w: S.w, h: S.h }, k = Math.min(144 / b.w, 144 / b.h);
      const dx = (144 - b.w * k) / 2, dy = (144 - b.h * k) / 2;
      if (it.base) g.drawImage(it.base, 0, 0, it.base.width, it.base.height, dx, dy, b.w * k, b.h * k);
      if (it.layer) g.drawImage(it.layer, b.x, b.y, b.w, b.h, dx, dy, b.w * k, b.h * k);
      return c;
    }
    function render() {
      const list = $p("ppList"); list.innerHTML = "";
      const ready = items.filter((x) => x.layer).length, wait = items.filter((x) => !x.layer && !x.failed).length;
      $p("ppN").textContent = items.length ? `${ready}/${items.length}${wait ? ` · ${wait} rendering` : ""}` : "";
      if (btn) btn.textContent = items.length ? `⏳ Pending (${items.length})` : "⏳ Pending";
      if (!items.length) { const e = doc.createElement("div"); e.className = "ppe"; e.textContent = running ? "rendering…" : "nothing waiting - every ✨ result lands here first"; list.appendChild(e); return; }
      for (const it of items) {
        const card = doc.createElement("div"); card.className = "ppc" + (previewing === it ? " on" : ""); card.dataset.pid = String(it.pid);
        const t = thumb(it); t.title = it.layer ? "click: show it over the picture (again: hide)" : it.failed ? "this render failed - see the job log" : "rendering…";
        t.onclick = () => preview(it);
        const T = S.layers.find((x) => x.id === it.target);
        const tx = doc.createElement("div"); tx.className = "ppt";
        tx.innerHTML = `<span class="cap"></span><span class="sub"></span><span class="row"><button type="button" data-a="apply">✔ Apply</button><button type="button" data-a="del">🗑 Delete</button></span>`;
        tx.querySelector(".cap").textContent = caption(it); tx.querySelector(".cap").title = it.prompt || "";
        tx.querySelector(".sub").textContent = it.failed ? "✕ failed - see the job log" : !it.layer ? waitText(it) : `→ above ${T ? T.name : it.targetName || "the selected layer"}`;
        const ap = tx.querySelector('[data-a="apply"]'); ap.disabled = !it.layer; ap.title = "a new layer above that layer, in its ✨ changes group";
        ap.onclick = () => apply(it);
        tx.querySelector('[data-a="del"]').onclick = () => remove(it);
        card.appendChild(t); card.appendChild(tx); list.appendChild(card);
      }
      if (!box.classList.contains("off") && !box.closest(".pcfd")) place();
    }
    /* 2.574.0 (Tim: "show step number of steps for all generations"): a card still rendering says its step - its job
       (it.job) is followed by the page's job poll ("h3:jobtick"); only that card's line changes, no re-render */
    function waitText(it) { const pr = it.progress; return "⏳ rendering" + (pr && pr.total ? ` · step ${pr.step} of ${pr.total}` : pr ? " · loading the models" : "…"); }
    doc.addEventListener("h3:jobtick", (ev) => {
      const j = (ev && ev.detail) || {}, it = items.find((x) => x.job && x.job === j.id);
      if (!it || it.layer || it.failed) return;
      it.progress = j.status === "running" ? j.progress || null : null;
      const card = $p("ppList") && $p("ppList").querySelector(`.ppc[data-pid="${it.pid}"] .sub`);
      if (card) card.textContent = waitText(it);
    });
    function add(o) {
      const it = Object.assign({ pid: ++uid, layer: null, failed: false }, o || {});
      items.push(it); show(); render(); tev("ie_pending_add", String(items.length));
      return it;
    }
    function ready(it, layerCanvas) { if (!it) return; it.layer = layerCanvas; render(); tev("ie_pending_ready", String(it.pid)); }
    function fail(it) { if (!it) return; it.failed = true; render(); }
    function remove(it, quiet) {
      const i = items.indexOf(it); if (i < 0) return false;
      if (previewing === it) unpreview();
      items.splice(i, 1); render();
      if (!quiet) E.say("removed from ⏳ Pending");
      return true;
    }
    function clear() { if (previewing) unpreview(); items.length = 0; render(); }
    /** ✔ Apply: a new layer above the target, in its "✨ changes: <layer>" group */
    function apply(it) {
      if (!it || !it.layer || !S.w) return false;
      if (previewing) unpreview();
      const into = it.info && it.info.into, T0 = into ? S.layers.find((x) => x.id === into.id) : null;
      const name = `${caption(it)}`.slice(0, 60);
      if (T0 && win.PCGenFill) {                                 // a shape / mask fill: into that shape as before
        const L = E.makeLayer(name); L.canvas.getContext("2d").drawImage(it.layer, 0, 0);
        win.PCGenFill.placeOnto(E, L, T0, into.how);
        remove(it, true); E.refresh(); if (E.renderLayersPanel) E.renderLayersPanel();
        E.say(`applied inside ${T0.name}`); return true;
      }
      let { owner, group } = groupFor(S.layers, it.target);
      if (!owner) owner = E.layer();
      let L = null;
      const ok = E.structOp("apply AI result", () => {
        if (!owner) {                                            // the layer is gone: a plain new layer on top
          L = E.makeLayer(name); L.canvas.getContext("2d").drawImage(it.layer, 0, 0);
          S.layers = D.insert(S.layers, L, null, false); S.active = S.layers.indexOf(L); return;
        }
        if (!group || !S.layers.includes(group)) {
          group = E.makeLayer(`✨ changes: ${owner.name}`, S.w, S.h, "group"); group.changesOf = owner.id;
          S.layers = D.insert(S.layers, group, owner.id, false);
        }
        L = E.makeLayer(name); L.canvas.getContext("2d").drawImage(it.layer, 0, 0);
        S.layers = D.insert(S.layers, L, group.id, true);
        S.active = S.layers.indexOf(L);
      });
      if (!ok) return false;
      remove(it, true);
      E.say(owner ? `applied above ${owner.name} - in its group "✨ changes: ${owner.name}" (Ctrl+Z takes it out)` : "applied as a new layer");
      tev("ie_pending_apply", owner ? owner.name : "-");
      return L;
    }
    function applyAll() { let n = 0; for (const it of items.slice()) if (it.layer && apply(it)) n++; E.say(n ? `${n} result(s) applied` : "nothing finished yet"); return n; }
    E.pending = { auto: !!win.__H3_PENDING_AUTO, items, add, ready, fail, apply, remove, clear, applyAll, show, hide, render, moveTo,
                  track: () => { running++; render(); }, untrack: () => { running = Math.max(0, running - 1); render(); }, running: () => running, panel: box };
    render();
  }
  const PCPending = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCPending;
  else root.PCPending = PCPending;
})(typeof window !== "undefined" ? window : globalThis);
