/* pcblendlayer.js — A BLENDER LAYER: THE TIMELINE'S BLENDER SCENE TOOLS IN THE IMAGE EDITOR (2.542.0), window.PCBlendLayer.
 *
 * Tim (verbatim): "add blender button to open scene tools to image-editor as a blender layer - open blender scene etc. the
 * same as the timeline docker - when user clicks the edit button in prompt use the current scene as the reference to
 * generate the image from. create a new layer. right now the canvas is getting the rendered image and it cannot be
 * deleted."
 *
 *   🟧 Blender (the editor's menu bar) / Layer ▸ New Blender Layer (Scene Tools)…
 *       the timeline's Blender scene tools (ext/timelinedock/blendview.js - TlBlend, lent with TlBlend.attach) cover the
 *       canvas: 📂 Open a .blend, 🎥 Scene camera / 🧭 Free view (drag = orbit, right-drag = pan, wheel = zoom, F = frame
 *       all), click an object, ✥ ⟲ ⤡ (G R S) move / rotate / scale, keys, hide / duplicate / delete, ＋ Model, ✨ Build a
 *       scene with AI, 💾 Save … - the same scene and the same edits as the timeline. Their Properties sit in the 🟧
 *       Blender tab. The scene becomes a BLENDER LAYER (L.bscene = {stem, source, view, frame}) holding the view as shown;
 *       ✕ (or 🟧 again, or Esc) closes the tools and the layer keeps the view - an ordinary layer: hide it, move it, delete
 *       it. Pick the layer and 🟧 Scene tools opens them again.
 *   BLENDER MODE = a Blender layer picked: the prompt docker's ✏ Edit / 🔁 Refine (pcimgop.js) start from the scene -
 *       Reference: "The view as shown" (instant; the tools open = the live view, closed = the layer's last view) or a
 *       Blender render of that view (Solid / EEVEE - lib/blendView.still) - and every result lands as a NEW LAYER above
 *       it (runAI direct - nothing is left over the canvas); the Blender layer stays picked.
 * Pure (Node: scripts/test-blendlayer542.js): REFS, refOf, docSize.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const REFS = [["view", "The view as shown (instant)"], ["WORKBENCH", "Blender render - Solid"], ["EEVEE", "Blender render - EEVEE"]];
  const refOf = (v) => (REFS.some((r) => r[0] === v) ? v : "view");
  /** a new picture for a scene of w x h: the long side 1280, at least 64 */
  function docSize(w, h) {
    const W = Math.max(1, +w || 16), H = Math.max(1, +h || 9), k = 1280 / Math.max(W, H);
    return [Math.max(64, Math.round(W * k)), Math.max(64, Math.round(H * k))];
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, doc = E.doc || root.document, say = E.say, kx = E.kx, stage = E.stage, store = E.store;
    if (!E.ui || !kx || !stage) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const TB = () => root.TlBlend || null;
    const isBL = (L) => !!(L && L.bscene && typeof L.bscene === "object");   // (not L.blend - that is a layer's blend MODE)
    const cur = () => { const L = S.w ? E.layer() : null; return isBL(L) ? L : null; };
    let open = false, target = null, watch = 0;

    /* ---- the overlay over the canvas (a sibling of the stage: the editor's tools never see its pointer) */
    const main = stage.parentElement;
    if (main && root.getComputedStyle && root.getComputedStyle(main).position === "static") main.style.position = "relative";
    const wrap = doc.createElement("div"); wrap.id = "ieBlendWrap";
    wrap.style.cssText = "position:absolute;z-index:30;display:none;background:#16181c";
    main.appendChild(wrap);
    const fit = () => { wrap.style.left = stage.offsetLeft + "px"; wrap.style.top = stage.offsetTop + "px"; wrap.style.width = stage.offsetWidth + "px"; wrap.style.height = stage.offsetHeight + "px"; };
    try { new root.ResizeObserver(fit).observe(stage); } catch (e) { /* old */ }
    // the editor's own keys (G, R, S, Delete, Ctrl+Z …) stay out while the scene has them; Esc closes the tools
    wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); leave(); } e.stopPropagation(); });
    ["pointerdown", "wheel", "contextmenu"].forEach((t) => wrap.addEventListener(t, (e) => e.stopPropagation()));

    /* ---- the 🟧 Blender tab (Properties group): our part on top, the timeline's Properties under it while open */
    const grp = kx.querySelector('.pcgrp .pctabs [data-tab="kxCtl"]');
    let body = null;
    if (grp) {
      const tabs = grp.parentElement, holder = tabs.parentElement;
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "kbl"; b.dataset.grp = "props"; b.textContent = "🟧 Blender";
      b.onclick = () => E.ui.showTab("kbl");
      grp.after(b);
      body = doc.createElement("div"); body.className = "pcbody kxsec"; body.dataset.body = "kbl"; body.id = "kblBody";
      body.innerHTML = '<div id="kblOwn"></div><div id="kblTl"></div>';
      holder.appendChild(body);
      const css = doc.createElement("style");
      css.textContent = "#kblBody{padding:6px 8px;font-size:11px}#kblOwn .r{display:flex;gap:4px;align-items:center;margin:3px 0;flex-wrap:wrap}#kblOwn .r>span:first-child{min-width:54px;color:var(--pc-dim)}"
        + "#kblOwn .dim{color:var(--pc-dim)}#kblOwn button.on{background:var(--pc-accent);color:#000}#kblMsg{color:var(--pc-dim);min-height:14px;margin-top:4px}"
        + "#kblBtn.on{background:#f5792c;color:#000;border-color:#f5792c}";
      doc.head.appendChild(css);
    }
    let msg = "";
    const status = (t) => { msg = t || ""; const m = $("kblMsg"); if (m) m.textContent = msg; };
    function paint() {
      const own = $("kblOwn"); if (!own) return;
      const L = cur(), b = L ? L.bscene : null, tb = TB();
      own.innerHTML = !tb ? `<div class="dim">The Blender scene tools come with the timeline docker (its 🟧 tool) - it is not loaded here.</div>`
        : `<div class="r"><button type="button" class="${open ? "on" : "ghost"}" id="kblOpen" title="The timeline's Blender scene tools over the canvas - ✕ / Esc closes them, the layer keeps the view">🟧 ${open ? "Close the scene tools" : "Scene tools"}</button></div>
        <div class="r"><span class="dim">${L ? "Blender layer: <b>" + esc(L.name) + "</b>" + (b && b.stem ? " · " + esc(b.stem) : "") : open ? "the scene becomes a Blender layer when it is open" : "no Blender layer picked - 🟧 makes one"}</span></div>
        <div class="r"><span>Edit from</span><select id="kblRef" title="What the prompt docker's ✏ Edit / 🔁 Refine start from while a Blender layer is picked">${REFS.map(([v, t]) => `<option value="${v}"${refOf(store.get("bl.ref", "view")) === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
        <div class="r dim">Blender mode: pick this layer, type in the prompt docker, ▾ Edit (or Refine) - each result comes in as a new layer above it.</div>
        <div id="kblMsg">${esc(msg)}</div>`;
      const o = $("kblOpen"); if (o) o.onclick = () => (open ? leave() : start());
      const r = $("kblRef"); if (r) r.onchange = (e) => store.set("bl.ref", refOf(e.target.value));
      const btn = $("kblBtn"); if (btn) btn.classList.toggle("on", open);
    }

    /* ---- the layer: the view as shown, one undo step */
    function sceneInfo() { const tb = TB(), st = tb && tb.state && tb.state.st; return st ? { stem: st.stem, source: st.source, meta: tb.state.meta || {} } : null; }
    function ensureDoc(info) {
      if (S.w) return;
      const m = (info && info.meta) || {}, [w, h] = docSize(m.width || 1280, m.height || 720);
      E.openDoc(w, h, ((info && info.stem) || "blender") + ".png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, g.canvas.width, g.canvas.height); });
    }
    /** the view -> the Blender layer (made when there is none picked) */
    function keepView(label) {
      const tb = TB(), info = sceneInfo(); if (!tb || !info) return null;
      ensureDoc(info);
      const snap = tb.snapshot(S.w, S.h); if (!snap) return null;
      let L = target && S.layers.includes(target) ? target : cur();
      const meta = { stem: info.stem, source: info.source, view: tb.view ? tb.view() : null, frame: tb.state.frame, sceneCam: tb.state.view === "scene" };
      if (!L) {
        E.structOp("new Blender layer", () => {
          L = E.makeLayer("🟧 " + info.stem, S.w, S.h, "pixel");
          L.bscene = meta;
          const A = E.layer();
          S.layers = E.D.insert(S.layers, L, A ? A.id : null, false);
          S.active = S.layers.indexOf(L);
        });
        L.canvas.getContext("2d").drawImage(snap, 0, 0);
        E.refresh(); E.renderLayersPanel();
        if (root.H3TestEvent) { try { root.H3TestEvent("ie_blendlayer", "new"); } catch (e) { /* the 🧪 list */ } }
      } else {
        const before = E.snapStruct(), copy = E.beginPx(L);
        L.bscene = meta;
        const g = L.canvas.getContext("2d"); g.clearRect(0, 0, S.w, S.h); g.drawImage(snap, 0, 0);
        const px = E.endPx(L, copy, null, label || "Blender view");
        E.push({ t: "multi", list: [px, { t: "struct", before, after: E.snapStruct() }].filter(Boolean), label: label || "Blender view" });
        E.refresh(); E.renderLayersPanel();
      }
      target = L;
      return L;
    }

    /* ---- open / close the scene tools */
    function start() {
      const tb = TB();
      if (!tb || !tb.attach) { say("the Blender scene tools come with the timeline docker (its 🟧 tool) - it is not loaded"); paint(); return null; }
      target = cur();
      open = true; fit(); wrap.style.display = "block";
      if (E.ui.showTab) E.ui.showTab("kbl");
      const host = { wrap, props: $("kblTl") || body, onShow: (on) => { if (!on && open) leave(true); }, onTaken: () => { if (open) leave(true, true); } };
      paint();
      say("🟧 the Blender scene tools: 📂 Open a .blend (or the open scene), drag = orbit · right-drag = pan · wheel = zoom · click an object, G / R / S - ✕ or Esc keeps the view as a layer");
      const p = tb.attach(host).then((st) => {
        if (st && st.stem) { if (target && target.bscene && target.bscene.stem !== st.stem && target.bscene.source) return tb.open(target.bscene.source).then(afterLoad); afterLoad(); }
        return st;
      }).catch((e) => { status("Blender: " + (e.message || e)); });
      // a scene opened INSIDE the tools (📂 Open / ✨ Build) -> its layer as soon as the view can draw it
      root.clearInterval(watch);
      watch = root.setInterval(() => { if (!open) { root.clearInterval(watch); return; } if (!target && sceneInfo() && TB().snapshot(16, 16)) afterLoad(); }, 1200);
      return p;
    }
    function afterLoad() {
      const info = sceneInfo(); if (!info || !open) return;
      root.setTimeout(() => { if (open && (!target || !S.layers.includes(target))) keepView("new Blender layer"); paint(); status(`scene ${info.stem} - the layer follows the view when the tools close`); }, 400);
    }
    function leave(fromTools, taken) {
      if (!open) return;
      open = false; root.clearInterval(watch);
      const tb = TB();
      try { if (tb && sceneInfo()) keepView("Blender view"); } catch (e) { status("Blender: " + (e.message || e)); }
      wrap.style.display = "none";
      if (tb && !taken && tb.host && tb.host()) tb.detach();
      paint(); E.refresh();
      if (!fromTools || !taken) say(target ? `🟧 ${target.name}: the view is on the layer - pick it and ▾ Edit in the prompt docker to make a picture from the scene` : "the Blender scene tools are closed");
    }

    /* ---- BLENDER MODE: the prompt docker's Edit / Refine start from the scene */
    async function reference(L) {
      const how = refOf(store.get("bl.ref", "view")), tb = TB();
      if (how === "view") {
        if (open && tb && sceneInfo() && L === target) { const c = tb.snapshot(S.w, S.h); if (c) return c; }
        const c = E.newCanvas(S.w, S.h); c.getContext("2d").drawImage(L.canvas, 0, 0); return c;      // the layer's view
      }
      const b = L.bscene || {};
      if (!b.stem) throw new Error("this layer has no Blender scene");
      status(`🟧 Blender renders the view (${how === "EEVEE" ? "EEVEE" : "Solid"}) ${S.w} x ${S.h}…`); say(`🟧 Blender renders the scene (${how === "EEVEE" ? "EEVEE" : "Solid"})…`);
      const post = (u, x) => root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) }).then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || r.statusText); return j; }));
      if (open && tb && tb.state && tb.state.st && tb.state.st.stem === b.stem) await post("/api/blendview/edits", { stem: b.stem, edits: tb.state.E });
      const view = open && tb && tb.state.view === "free" ? tb.view() : b.sceneCam ? null : b.view;
      const { id } = await post("/api/blendview/still", { stem: b.stem, frame: open && tb ? tb.state.frame : b.frame, view, engine: how, w: S.w, h: S.h });
      let st = null;
      for (let i = 0; i < 2000; i++) {
        await new Promise((r) => root.setTimeout(r, i < 10 ? 300 : 700));
        st = await (await root.fetch("/api/blendview/still/" + id)).json();
        if (st.state !== "running") break;
      }
      if (!st || st.state !== "done") throw new Error((st && st.error) || "Blender wrote no picture");
      const img = await new Promise((res, rej) => { const im = new root.Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("the render did not load")); im.src = st.png; });
      const c = E.newCanvas(S.w, S.h), g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, S.w, S.h);
      return c;
    }
    async function editFromScene(L, text, mode, editStyle) {
      if (!isBL(L)) { say("pick a Blender layer first"); return null; }
      const t = String(text || "").trim();
      if (!t && mode === "edit") { say("type in the prompt docker what to make of the scene (e.g. \"a photo of a cosy living room, evening light\")"); return null; }
      if (S.busy) { say("still working on the last one"); return null; }
      let c = null;
      try { c = await reference(L); } catch (e) { status("Blender: " + e.message); say("Blender: " + e.message); return null; }
      status(`🟧 the scene goes to ${mode === "edit" ? "the edit model" : "Refine"} with the prompt - each result is a new layer`);
      if (root.H3TestEvent) { try { root.H3TestEvent("ie_blendlayer", mode); } catch (e) { /* the 🧪 list */ } }
      if (S.aiMode !== mode && E.setAiMode) E.setAiMode(mode);
      await E.runAI({ prompt: t, editStyle: editStyle || "", source: c, whole: true, into: false, direct: true, keep: L, label: "🟧 " + (L.bscene.stem || L.name) + " " + mode });
      return c;
    }

    /* ---- the button + the command; the tab follows the picked layer */
    const mr = $("kxFull") ? $("kxFull").parentNode : null;
    if (mr) {
      const b = doc.createElement("button"); b.className = "ghost"; b.id = "kblBtn"; b.type = "button"; b.textContent = "🟧";
      b.title = "Blender scene tools (as in the timeline) - open a .blend, look around, move objects; the view becomes a Blender layer, and ▾ Edit in the prompt docker makes a picture from it";
      b.onclick = () => (open ? leave() : start());
      mr.insertBefore(b, $("kxFull"));
    }
    E.ui.addCmd("layer.newblend", "New Blender Layer (Scene Tools)…", "", () => start(), {}, ["Layer", null, true]);
    const prevHist = E.ui.history;
    E.ui.history = function () { const r = prevHist ? prevHist.apply(this, arguments) : undefined; try { paint(); } catch (er) { /* fine */ } return r; };
    const prevShow = E.ui.showTab;
    E.ui.showTab = function (id) { const r = prevShow.apply(this, arguments); if (id === "kbl") paint(); return r; };
    paint();
    E.blendLayer = { isCurrent: () => !!cur(), current: cur, start, leave, isOpen: () => open, keepView, editFromScene, reference, paint, wrap };
  }

  const PCBlendLayer = { REFS, refOf, docSize, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCBlendLayer;
  else root.PCBlendLayer = PCBlendLayer;
})(typeof window !== "undefined" ? window : globalThis);
