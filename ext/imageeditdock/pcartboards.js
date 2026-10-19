/* pcartboards.js — ARTBOARDS IN THE IMAGE EDITOR (2.447.0), window.PCArtboards.
 *
 * Tim (verbatim): "and more photoshop features to close the gap" - asked which: "Artboards" (with the Content-Aware Fill
 * workspace, per-character type, warp grid + liquify extras - one release each).
 *
 *   AN ARTBOARD  a group with L.artboard = {x, y, w, h, bg} (picture px; bg "#rrggbb" or "" = transparent): its layers
 *                show only inside its rectangle, over its background colour; its name and outline are drawn above it
 *                on the canvas. Like Photoshop: several in one document, each a page of its own size.
 *   NEW          Layer ▸ New ▸ Artboard… (a name, a size - presets or your own -, the background, "with the picked /
 *                active layers in it"): placed to the right of the last one; the canvas grows to hold it (Canvas Size,
 *                anchored top-left - its own undo step). Layer ▸ New ▸ Artboard from Group: the active group becomes
 *                one, its rectangle = what is in it. The Artboard tool (in the Move tool's group - V cycles it): drag a
 *                rectangle = a new artboard there.
 *   EDIT         Properties of an artboard: name, X / Y / W / H, background (+ none), ⇱ fit to its contents; moving it
 *                with the Move tool (or the arrows) moves its contents and its rectangle together.
 *   EXPORT       File ▸ Export ▸ Artboards to Files…: each artboard as its own PNG (its rectangle of the picture as it
 *                shows - only its own layers: the others hidden while it is drawn), saved into the project's Images
 *                (<picture>-<artboard>.png) and / or downloaded.
 *   .bgi keeps them (L.artboard is an own field); Canvas Size / Image Size move / scale them (pctools.js).
 *
 * Pure (Node: scripts/test-artboards.js): PRESETS, cleanBoard, nextPlace, docFor, unionBox, safeName.
 */
(function (root) {
  "use strict";
  const PRESETS = [["Instagram post 1080 x 1080", 1080, 1080], ["Story / Reel 1080 x 1920", 1080, 1920], ["Full HD 1920 x 1080", 1920, 1080],
    ["4K UHD 3840 x 2160", 3840, 2160], ["A4 at 150 dpi 1240 x 1754", 1240, 1754], ["YouTube thumbnail 1280 x 720", 1280, 720], ["Twitter / X post 1600 x 900", 1600, 900]];
  const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
  function cleanBoard(a) {
    const o = a && typeof a === "object" ? a : {}, n = (v, lo, hi, d) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
    return { x: n(o.x, -16384, 16384, 0), y: n(o.y, -16384, 16384, 0), w: n(o.w, 1, 16384, 1080), h: n(o.h, 1, 16384, 1080), bg: isHex(o.bg) ? o.bg.toLowerCase() : "" };
  }
  /** where a new w x h artboard goes: right of the rightmost one (gap px), at the top of the first; none = 0, 0 */
  function nextPlace(boards, w, h, gap) {
    const list = (boards || []).map(cleanBoard); if (!list.length) return { x: 0, y: 0 };
    const g = gap == null ? 80 : gap, right = Math.max(...list.map((b) => b.x + b.w)), top = Math.min(...list.map((b) => b.y));
    return { x: right + g, y: top };
  }
  /** the document size that holds every board (never smaller than it is) */
  function docFor(boards, W, H) {
    let w = W, h = H;
    for (const b of (boards || []).map(cleanBoard)) { w = Math.max(w, b.x + b.w); h = Math.max(h, b.y + b.h); }
    return { w: Math.min(16384, w), h: Math.min(16384, h) };
  }
  function unionBox(boxes) {
    const bs = (boxes || []).filter(Boolean); if (!bs.length) return null;
    const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y)), x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
    return { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) };
  }
  const safeName = (t) => String(t || "artboard").replace(/[^\w .()&+-]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 60) || "artboard";

  /** an artboard's look: its background, its layers clipped to its rectangle (pcdoc.js contentOf calls it) */
  function content(env, node, W, H, renderList) {
    const a = cleanBoard(node.L.artboard), out = env.newCanvas(W, H), g = out.getContext("2d");
    if (a.bg) { g.fillStyle = a.bg; g.fillRect(a.x, a.y, a.w, a.h); }
    const kids = env.newCanvas(W, H); renderList(env, node.kids, kids, W, H);
    g.save(); g.beginPath(); g.rect(a.x, a.y, a.w, a.h); g.clip(); g.drawImage(kids, 0, 0); g.restore();
    return out;
  }

  function install(E) {
    const { S, D, doc, say, store } = E;
    if (!E.ui || !E.ui.addCmd || !E.tools) return;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const boards = () => S.layers.filter((L) => L.type === "group" && L.artboard);
    const isBoard = (L) => !!(L && L.type === "group" && L.artboard);
    const boardOf = (L) => { const byId = new Map(S.layers.map((x) => [x.id, x])); let p = L, n = 0; while (p && n++ < 60) { if (isBoard(p)) return p; p = p.parent != null ? byId.get(p.parent) : null; } return null; };

    /* ---- make one */
    function create(name, rect, bg, ids) {
      const a = cleanBoard(Object.assign({}, rect, { bg })), need = docFor([a], S.w, S.h);
      if (need.w > S.w || need.h > S.h) { if (E.img && E.img.canvas) E.img.canvas(need.w, need.h, 0, 0); }
      return E.structOp("new artboard", () => {
        const G = E.makeLayer(name || ("Artboard " + (boards().length + 1)), S.w, S.h, "group");
        G.artboard = a; G.blend = "pass-through"; G.open = true;
        const move = (ids || []).filter((id) => { const L = S.layers.find((x) => x.id === id); return L && !isBoard(L) && !boardOf(L); });
        if (move.length) S.layers = D.group(S.layers, move, G);
        else S.layers = D.insert(S.layers, G, S.layers.length ? S.layers[S.layers.length - 1].id : null, false);
        S.active = S.layers.indexOf(G);
      });
    }
    function newDialog() {
      if (!S.w) return say("open a picture first");
      const picked = (E.picked ? E.picked() : []).filter(Boolean), act = E.layer();
      const movers = picked.length ? picked : act && !isBoard(act) && act.type !== "group" ? [act] : [];
      const first = !boards().length;
      E.ui.dialog("New Artboard", `<div class="rw"><span>Name</span><input type="text" id="abN" value="Artboard ${boards().length + 1}"></div>
        <div class="rw"><span>Size</span><select id="abP"><option value="doc">${first ? "The picture" : "Like the picture"} ${S.w} x ${S.h}</option>${PRESETS.map(([n, w, h], i) => `<option value="${i}">${esc(n)}</option>`).join("")}<option value="custom">Custom…</option></select></div>
        <div class="rw"><span>W x H (px)</span><input type="number" id="abW" value="${S.w}" min="1" max="16384"><input type="number" id="abH" value="${S.h}" min="1" max="16384"></div>
        <div class="rw"><span>Background</span><input type="color" id="abBg" value="#ffffff"><label><input type="checkbox" id="abBgOn" checked> on (off = transparent)</label></div>
        <div class="rw"><label><input type="checkbox" id="abMove"${movers.length ? " checked" : ""}${movers.length ? "" : " disabled"}> Put ${movers.length ? esc(movers.map((x) => x.name).join(", ").slice(0, 60)) : "the picked layers"} in it</label></div>
        <div style="color:var(--pc-dim)">${first ? "The first artboard sits at the picture's top-left." : "It goes to the right of the last one; the canvas grows to hold it."}</div>`,
      (d) => {
        const w = +d.querySelector("#abW").value || S.w, h = +d.querySelector("#abH").value || S.h;
        const at = first ? { x: 0, y: 0 } : nextPlace(boards().map((L) => L.artboard), w, h);
        create(d.querySelector("#abN").value.trim(), { x: at.x, y: at.y, w, h }, d.querySelector("#abBgOn").checked ? d.querySelector("#abBg").value : "", d.querySelector("#abMove").checked ? movers.map((x) => x.id) : []);
        say("artboard made - File ▸ Export ▸ Artboards to Files… saves each as its own picture");
      }, { init(d) {
        d.querySelector("#abP").onchange = (e) => { const v = e.target.value; if (v === "doc") { d.querySelector("#abW").value = S.w; d.querySelector("#abH").value = S.h; } else if (v !== "custom") { const p = PRESETS[+v]; d.querySelector("#abW").value = p[1]; d.querySelector("#abH").value = p[2]; } };
      } });
    }
    function fromGroup() {
      const G = E.layer(); if (!G || G.type !== "group" || G.artboard) return say("pick a group (not an artboard)");
      const box = unionBox(D.descendants(S.layers, G.id).map((L) => (E.dockers ? E.dockers.boxOf(L) : null)));
      if (!box) return say("the group is empty");
      E.structOp("artboard from group", () => { G.artboard = cleanBoard({ x: box.x, y: box.y, w: box.w, h: box.h, bg: "" }); });
    }
    function fitContents(G) {
      const box = unionBox(D.descendants(S.layers, G.id).map((L) => (E.dockers ? E.dockers.boxOf(L) : null)));
      if (!box) return say("nothing in it");
      E.structOp("fit artboard", () => { G.artboard = cleanBoard(Object.assign({}, G.artboard, box)); });
    }

    /* ---- export: each artboard as its own PNG */
    async function render(G) {
      const a = cleanBoard(G.artboard);
      const keep = S.layers.map((L) => L.visible);
      // only its own layers: everything outside this artboard hidden while it is drawn
      const mine = new Set([G.id, ...D.descendants(S.layers, G.id).map((L) => L.id)]);
      const byId = new Map(S.layers.map((x) => [x.id, x]));
      const anc = new Set(); let p = G.parent; while (p != null && byId.has(p)) { anc.add(p); p = byId.get(p).parent; }
      S.layers.forEach((L) => { if (!mine.has(L.id) && !anc.has(L.id)) L.visible = false; });
      let full;
      try { full = D.render({ w: S.w, h: S.h, layers: S.layers }, E.docEnv({ srcFor: (x) => x.canvas, maskSrc: null, skipControl: true })); }
      finally { S.layers.forEach((L, i) => { L.visible = keep[i]; }); }
      const c = E.newCanvas(a.w, a.h); c.getContext("2d").drawImage(full, a.x, a.y, a.w, a.h, 0, 0, a.w, a.h);
      return c;
    }
    async function exportAll(toImages, download) {
      const list = boards(); if (!list.length) return say("no artboards - Layer ▸ New ▸ Artboard… first");
      const base = safeName((S.name || "picture").replace(/\.[a-z0-9]+$/i, "")), out = [];
      for (const G of list) {
        const c = await render(G), blob = await new Promise((r) => c.toBlob(r, "image/png")), name = `${base}-${safeName(G.name)}.png`;
        if (toImages && E.api && E.api.save) out.push(await E.api.save(blob, name));
        if (download) { const a = doc.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
      }
      say(`${list.length} artboard(s) exported${toImages ? " into Images" : ""}${download ? " (downloaded)" : ""}`);
      return out;
    }
    function exportDialog() {
      if (!boards().length) return say("no artboards - Layer ▸ New ▸ Artboard… first");
      E.ui.dialog("Export Artboards", `<div style="color:var(--pc-dim)">${boards().length} artboard(s): ${esc(boards().map((L) => L.name).join(", ").slice(0, 120))} - each as its own PNG.</div>
        <div class="rw"><label><input type="checkbox" id="abxI" checked> Into the project's Images</label></div>
        <div class="rw"><label><input type="checkbox" id="abxD"> Download them too</label></div>`,
      (d) => { exportAll(d.querySelector("#abxI").checked, d.querySelector("#abxD").checked); }, { okLabel: "⇪ Export" });
    }

    /* ---- the Artboard tool: drag a rectangle */
    let dr = null;
    E.tools.artboard = {
      id: "artboard", name: "Artboard", cursor: "crosshair",
      options: () => `<span style="color:var(--pc-dim)">Drag a rectangle for a new artboard (Layer ▸ New ▸ Artboard… for a set size)</span>`,
      down(e, fx, fy) { dr = { x0: fx, y0: fy, x1: fx, y1: fy }; },
      move(e, fx, fy) { if (dr) { dr.x1 = fx; dr.y1 = fy; E.drawOverlay(); } },
      up(e, fx, fy) {
        if (!dr) return; const r = { x: Math.round(Math.min(dr.x0, fx)), y: Math.round(Math.min(dr.y0, fy)), w: Math.round(Math.abs(fx - dr.x0)), h: Math.round(Math.abs(fy - dr.y0)) }; dr = null;
        if (r.w < 8 || r.h < 8) { E.drawOverlay(); return say("drag a bigger rectangle"); }
        create("Artboard " + (boards().length + 1), r, "#ffffff", []);
      },
    };

    /* ---- the canvas: each artboard's outline + name; the one being drawn */
    E.overlayHooks.push((g, px) => {
      if (!S.w) return;
      const act = E.layer(), on = act ? boardOf(act) : null;
      for (const G of boards()) {
        if (!D.shown(S.layers, G)) continue;
        const a = cleanBoard(G.artboard);
        g.save(); g.lineWidth = (G === on ? 2 : 1) * px; g.strokeStyle = G === on ? "#2680eb" : "rgba(160,160,160,.8)"; g.strokeRect(a.x, a.y, a.w, a.h);
        g.font = `${11 * px}px system-ui, sans-serif`;
        if (a.y >= 15 * px) { g.fillStyle = G === on ? "#2680eb" : "#9a9a9a"; g.textBaseline = "bottom"; g.fillText(G.name, a.x, a.y - 3 * px); }
        else {                                                  // no room above it (the canvas' top): a chip inside its corner
          const tw = g.measureText(G.name).width + 8 * px; g.fillStyle = G === on ? "rgba(38,128,235,.85)" : "rgba(80,80,80,.75)"; g.fillRect(a.x, a.y, tw, 15 * px);
          g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(G.name, a.x + 4 * px, a.y + 7.5 * px);
        }
        g.restore();
      }
      if (dr) { g.save(); g.lineWidth = px; g.setLineDash([5 * px, 4 * px]); g.strokeStyle = "#2680eb"; g.strokeRect(Math.min(dr.x0, dr.x1), Math.min(dr.y0, dr.y1), Math.abs(dr.x1 - dr.x0), Math.abs(dr.y1 - dr.y0)); g.restore(); }
    });

    /* ---- moving an artboard moves its rectangle with its layers (imageedit's group move / nudge call this) */
    E.moveBoard = (G, dx, dy) => { if (isBoard(G) && (dx || dy)) G.artboard = Object.assign({}, G.artboard, { x: G.artboard.x + dx, y: G.artboard.y + dy }); };
    if (E.dockers && E.dockers.xformLayer) {
      const prev = E.dockers.xformLayer;
      E.dockers.xformLayer = (L, m, list) => { prev(L, m, list); if (isBoard(L) && Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[3] - 1) < 1e-9 && !m[1] && !m[2]) E.moveBoard(L, m[4], m[5]); };
    }

    /* ---- Properties: an artboard's settings */
    E.ui.propsExtra = (E.ui.propsExtra || []).concat([(A, box) => {
      if (!isBoard(A)) return;
      const a = cleanBoard(A.artboard), row = doc.createElement("div"); row.id = "ppArtboard"; row.style.marginTop = "6px";
      row.innerHTML = `<div class="kxrow"><b>▭ Artboard</b></div>
        <div class="kxrow"><span>X</span><input type="number" id="ppAbX" value="${a.x}" style="width:64px"><span>Y</span><input type="number" id="ppAbY" value="${a.y}" style="width:64px"></div>
        <div class="kxrow"><span>W</span><input type="number" id="ppAbW" value="${a.w}" style="width:64px"><span>H</span><input type="number" id="ppAbH" value="${a.h}" style="width:64px"></div>
        <div class="kxrow"><span>Background</span><input type="color" id="ppAbBg" value="${a.bg || "#ffffff"}"><label><input type="checkbox" id="ppAbBgOn"${a.bg ? " checked" : ""}> on</label><button class="ghost" id="ppAbFit" title="Its rectangle = what is in it">⇱ Fit</button></div>`;
      box.appendChild(row);
      const $ = (id) => doc.getElementById(id);
      const apply = () => E.structOp("artboard", () => { A.artboard = cleanBoard({ x: $("ppAbX").value, y: $("ppAbY").value, w: $("ppAbW").value, h: $("ppAbH").value, bg: $("ppAbBgOn").checked ? $("ppAbBg").value : "" }); });
      ["ppAbX", "ppAbY", "ppAbW", "ppAbH", "ppAbBg", "ppAbBgOn"].forEach((id) => { $(id).onchange = apply; });
      $("ppAbFit").onclick = () => fitContents(A);
    }]);

    /* ---- the menus */
    const C = E.ui.addCmd;
    C("layer.newartboard", "Artboard…", "", newDialog, { enabled: () => !!S.w }, ["Layer"]);
    C("layer.artboardgroup", "Artboard from Group", "", fromGroup, { enabled: () => { const L = E.layer(); return !!L && L.type === "group" && !L.artboard; } });
    C("file.exportboards", "Artboards to Files…", "", exportDialog, { enabled: () => boards().length > 0 });
    const M = (n) => E.ui.MENUS.find(([x]) => x === n);
    const L0 = M("Layer"); if (L0) {
      const items = L0[1]; const i = items.indexOf("layer.newartboard"); if (i >= 0) items.splice(i, 1);
      const sub = items.find((x) => x && x.label === "New"); if (sub) sub.items.splice(2, 0, "layer.newartboard", "layer.artboardgroup"); else items.push("layer.newartboard", "layer.artboardgroup");
    }
    const F = M("File"); if (F) { const items = F[1], at = items.indexOf("file.export"); items.splice(at >= 0 ? at + 1 : items.length, 0, "file.exportboards"); }
    E.artboards = { list: boards, create, newDialog, fromGroup, fitContents, render, exportAll, exportDialog, isBoard, boardOf };
  }

  const PCArtboards = { PRESETS, cleanBoard, nextPlace, docFor, unionBox, safeName, content, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCArtboards;
  else root.PCArtboards = PCArtboards;
})(typeof window !== "undefined" ? window : globalThis);
