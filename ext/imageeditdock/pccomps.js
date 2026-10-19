/* pccomps.js — LAYER COMPS: saved states of the layers (visibility, position, appearance) to switch between
 * (2.434.0), window.PCComps.
 *
 * Tim (verbatim, the 2.430.0 message): "add anything else in our gap list that will fit this turn" - the gap list's
 * "Artboards, layer comps" (docs/PHOTOSHOP-GAP.md): the layer comps half.
 *
 *   A COMP        {id, name, note, vis, pos, look, layers: {layerId: {v (shown), x / y (where its content starts),
 *                 op (opacity), blend, styles, fill}}} - what it applies is what was ticked when it was made
 *                 (Visibility / Position / Appearance), like Photoshop's.
 *   THE PANEL     Window ▸ Layer Comps (the Comps tab beside History / Actions): ▣ = applied; a click on a comp's ▶
 *                 applies it (one undo step); ◀ ▶ = the previous / next comp; ↻ = update it from the layers now;
 *                 ＋ = a new comp (name, what it keeps, a comment); 🗑 = delete. "Last Document State" = the layers as
 *                 they were before the first comp was applied. Each document keeps its own comps.
 *
 * Pure (Node: scripts/test-pscomps.js): capture (layers + boxes -> a comp's layers), planOf (a comp vs the layers now
 * -> what changes: visible, moves, looks).
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  /** the layers -> {id: {v, x, y, op, blend, styles, fill}}; boxOf(L) -> {x, y, w, h} | null */
  function capture(layers, boxOf) {
    const out = {};
    for (const L of layers || []) {
      const b = boxOf ? boxOf(L) : null;
      out[L.id] = { v: L.visible !== false, x: b ? Math.round(b.x) : null, y: b ? Math.round(b.y) : null, op: L.opacity == null ? 1 : L.opacity, blend: L.blend || "normal",
        styles: clone(L.styles || null), fill: L.fillOpacity == null ? null : L.fillOpacity };
    }
    return out;
  }
  /** what applying comp c to the layers changes: [{id, v?, dx?, dy?, look?}] (layers the comp does not know are left alone) */
  function planOf(c, layers, boxOf) {
    const out = [];
    if (!c || !c.layers) return out;
    for (const L of layers || []) {
      const r = c.layers[L.id]; if (!r) continue;
      const step = { id: L.id };
      if (c.vis !== false && r.v !== (L.visible !== false)) step.v = r.v;
      if (c.pos && r.x != null) { const b = boxOf ? boxOf(L) : null; if (b) { const dx = Math.round(r.x - b.x), dy = Math.round(r.y - b.y); if (dx || dy) { step.dx = dx; step.dy = dy; } } }
      if (c.look) {
        const same = (r.op === (L.opacity == null ? 1 : L.opacity)) && r.blend === (L.blend || "normal") && JSON.stringify(r.styles) === JSON.stringify(L.styles || null) && r.fill === (L.fillOpacity == null ? null : L.fillOpacity);
        if (!same) step.look = { op: r.op, blend: r.blend, styles: clone(r.styles), fill: r.fill };
      }
      if (Object.keys(step).length > 1) out.push(step);
    }
    return out;
  }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, $, say } = E;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!doc.getElementById("pccompsCss")) {
      const st = doc.createElement("style"); st.id = "pccompsCss";
      st.textContent = ".kx .lcrow{display:flex;gap:6px;align-items:center;padding:3px 6px;border-bottom:1px solid var(--pc-line);cursor:default}.kx .lcrow .ap{width:20px;min-width:0;padding:0;border:0;background:none;color:var(--pc-dim);cursor:pointer}"
        + ".kx .lcrow.on .ap{color:var(--pc-accent)}.kx .lcrow .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kx .lcrow .k{color:var(--pc-dim);font-size:10px}.kx .lcrow.sel{background:var(--pc-on)}"
        + ".kx .lcrow .nt{display:block;color:var(--pc-dim);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kx .lcbar{display:flex;gap:4px;padding:6px;justify-content:flex-end}";
      doc.head.appendChild(st);
    }
    S.comps = S.comps || []; S.compOn = null; S.compSel = null; S.compLast = null;
    let uid = 0;
    const boxOf = (L) => (E.dockers && E.dockers.boxOf ? E.dockers.boxOf(L) : null);
    const comps = () => (S.comps = S.comps || []);
    const lastNow = () => ({ id: "last", name: "Last Document State", vis: true, pos: true, look: true, layers: capture(S.layers, boxOf) });
    function make(name, o) {
      if (!S.compLast) S.compLast = lastNow();
      const c = { id: "lc" + Date.now().toString(36) + (++uid), name: String(name || "Layer Comp " + (comps().length + 1)).slice(0, 60), note: String((o && o.note) || "").slice(0, 200),
        vis: !o || o.vis !== false, pos: !!(o && o.pos), look: !!(o && o.look), layers: capture(S.layers, boxOf) };
      comps().push(c); S.compOn = c.id; S.compSel = c.id; paint();
      return c;
    }
    function update(id) {
      const c = comps().find((x) => x.id === (id || S.compSel)); if (!c) return say("pick a layer comp first");
      c.layers = capture(S.layers, boxOf); S.compOn = c.id; paint(); say(`"${c.name}" now keeps the layers as they are`);
    }
    function remove(id) {
      const i = comps().findIndex((x) => x.id === (id || S.compSel)); if (i < 0) return;
      comps().splice(i, 1); if (S.compOn === id) S.compOn = null; S.compSel = comps()[Math.min(i, comps().length - 1)] ? comps()[Math.min(i, comps().length - 1)].id : null; paint();
    }
    /** apply comp (or "last"): visibility / position / appearance, one undo step */
    function apply(id) {
      if (!S.w) return false;
      const last = id === "last";
      const c = last ? S.compLast : comps().find((x) => x.id === id);
      if (!c) return false;
      // "Last Document State" = the layers as they were before a comp was applied over changes of your own
      const on = comps().find((x) => x.id === S.compOn);
      if (!last && (!on || planOf(Object.assign({}, on, { vis: true, pos: true, look: true }), S.layers, boxOf).length)) S.compLast = lastNow();
      const plan = planOf(c, S.layers, boxOf);
      const before = E.snapStruct(), list = [];
      for (const st of plan) {
        const L = S.layers.find((x) => x.id === st.id); if (!L) continue;
        if (st.v != null) L.visible = st.v;
        if (st.dx || st.dy) E.shiftLayer(L, st.dx || 0, st.dy || 0, list);
        if (st.look) { L.opacity = st.look.op; L.blend = st.look.blend; if (st.look.styles) L.styles = st.look.styles; else delete L.styles; if (st.look.fill == null) delete L.fillOpacity; else L.fillOpacity = st.look.fill; }
      }
      list.push({ t: "struct", before, after: E.snapStruct() });
      E.push({ t: "multi", list, label: "layer comp: " + c.name });
      S.compOn = last ? null : c.id; if (!last) S.compSel = c.id;
      E.refresh(); E.renderLayersPanel(); paint();
      say(`${c.name}: ${plan.length} layer${plan.length === 1 ? "" : "s"} changed`);
      return true;
    }
    function step(dir) {
      const L = comps(); if (!L.length) return;
      const i = L.findIndex((x) => x.id === (S.compOn || S.compSel));
      const n = i < 0 ? (dir > 0 ? 0 : L.length - 1) : (i + dir + L.length) % L.length;
      apply(L[n].id);
    }
    function dlgNew(edit) {
      const c = edit ? comps().find((x) => x.id === S.compSel) : null;
      E.ui.dialog(c ? "Layer Comp Options" : "New Layer Comp", `<div class="rw"><span>Name</span><input type="text" id="lcName" value="${esc(c ? c.name : "Layer Comp " + (comps().length + 1))}" style="grid-column:1/3"></div>
        <div class="rw"><span style="grid-column:1/3">Apply to layers:</span></div>
        <div class="rw"><label><input type="checkbox" id="lcVis" ${!c || c.vis !== false ? "checked" : ""}> Visibility</label></div>
        <div class="rw"><label><input type="checkbox" id="lcPos" ${c && c.pos ? "checked" : ""}> Position</label></div>
        <div class="rw"><label><input type="checkbox" id="lcLook" ${c && c.look ? "checked" : ""}> Appearance (Layer Style, opacity, blend mode)</label></div>
        <div class="rw"><span style="grid-column:1/3">Comment</span><textarea id="lcNote" rows="2" style="grid-column:1/3">${esc(c ? c.note : "")}</textarea></div>`,
      (d) => {
        const o = { vis: d.querySelector("#lcVis").checked, pos: d.querySelector("#lcPos").checked, look: d.querySelector("#lcLook").checked, note: d.querySelector("#lcNote").value };
        const nm = d.querySelector("#lcName").value.trim();
        if (c) { Object.assign(c, o, { name: nm || c.name }); paint(); } else make(nm, o);
      }, { init: (d) => { d.querySelectorAll("input[type=text],textarea").forEach((x) => { x.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter" && x.tagName === "INPUT") d.querySelector(".ok").click(); }; }); } });
    }
    function paint() {
      const box = $("pcComps"); if (!box) return;
      const L = comps();
      const row = (c, last) => `<div class="lcrow${S.compOn === c.id || (last && !S.compOn && S.compLast) ? " on" : ""}${S.compSel === c.id ? " sel" : ""}" data-lc="${c.id}"><button class="ap" data-ap="${c.id}" title="Apply it">${(last ? !S.compOn : S.compOn === c.id) ? "▣" : "▶"}</button>`
        + `<span class="nm" title="${esc(c.note || c.name)}">${esc(c.name)}${c.note ? `<span class="nt">${esc(c.note)}</span>` : ""}</span>${last ? "" : `<span class="k">${[c.vis !== false ? "👁" : "", c.pos ? "↔" : "", c.look ? "fx" : ""].join("")}</span>`}</div>`;
      box.innerHTML = (S.compLast ? row(S.compLast, true) : "") + (L.length ? L.map((c) => row(c, false)).join("") : `<div style="color:var(--pc-dim);padding:8px">No layer comps yet: set the layers up (shown / hidden, where they are, their look), then ＋ keeps that state to come back to.</div>`)
        + `<div class="lcbar"><button class="ghost" id="lcPrev" title="The previous comp">◀</button><button class="ghost" id="lcNext" title="The next comp">▶</button><button class="ghost" id="lcUpd" title="Update the picked comp from the layers now">↻</button><button class="ghost" id="lcNew" title="New Layer Comp…">＋</button><button class="ghost" id="lcDel" title="Delete the picked comp">🗑</button></div>`;
      box.querySelectorAll("[data-ap]").forEach((b) => { b.onclick = (e) => { e.stopPropagation(); apply(b.dataset.ap); }; });
      box.querySelectorAll("[data-lc]").forEach((r) => { r.onclick = () => { if (r.dataset.lc !== "last") { S.compSel = r.dataset.lc; paint(); } }; r.ondblclick = () => { if (r.dataset.lc !== "last") { S.compSel = r.dataset.lc; dlgNew(true); } }; });
      $("lcPrev").onclick = () => step(-1); $("lcNext").onclick = () => step(1);
      $("lcUpd").onclick = () => update(); $("lcNew").onclick = () => (S.w ? dlgNew(false) : say("open a picture first")); $("lcDel").onclick = () => remove(S.compSel);
    }
    E.ui.comps = paint;
    const C = E.ui.addCmd;
    C("lc.new", "Layer Comps: New Layer Comp…", "", () => dlgNew(false), { enabled: () => !!S.w });
    C("lc.next", "Layer Comps: Apply Next", "", () => step(1), { enabled: () => comps().length > 0 });
    C("lc.prev", "Layer Comps: Apply Previous", "", () => step(-1), { enabled: () => comps().length > 0 });
    C("lc.update", "Layer Comps: Update", "", () => update(), { enabled: () => !!S.compSel });
    E.comps = { make, update, remove, apply, step, paint, list: comps, capture, planOf };
  }

  const PCComps = { capture, planOf, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCComps;
  else root.PCComps = PCComps;
})(typeof window !== "undefined" ? window : globalThis);
