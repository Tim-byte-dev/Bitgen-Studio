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
 * 2.546.0 THE REFERENCES DOCKER TOO (Tim: "allow user to use reference images from reference docker when generating an
 *       image from a blender scene when in image-edit docker, for example photo real blonde woman on a beach with face of
 *       woman in picture 1. if model needs image 1 instead of picture 1 change automatically to image n"): ✏ Edit from a
 *       Blender layer (or a 3D layer, pc3d.js) with "picture 1" / "image 2" / "ref 1" … in the prompt sends the scene AND
 *       those References docker pictures (at most 2 - the edit models take three pictures) to the edit model as a compose
 *       (/api/aiedit/compose scene_refs): the scene is the model's picture 1, the references follow, and the server
 *       renumbers + renames them in the model's own words (lib/refWords.js: FLUX.2 Klein "image 2", Qwen 2.1 "<image2>",
 *       Qwen 2511 "Picture 2"). The 🟧 Blender tab's "References" picks when: named in the prompt (default) / always / never.
 * 2.806.0 (Tim: "when in image editor and a blender layer is being worked on an the generate button is pressed, then generate
 *       the image from the blender scene and the prompt and reference images if any ... if a blender scene is on a layer, if
 *       user clicks away from that layer and returns show the blender scene edited blender layers are raster layers but the
 *       blender scene layer is live"):
 *   ✨ GENERATE FROM THE SCENE  the prompt docker's ✨ Generate with a Blender layer picked = generateFromScene(): the scene
 *       (as Edit from says) + the prompt + the References docker's pictures, if any (all of them up to 2 - named ones first;
 *       the 🟧 tab's References "Never" keeps them out). How (genHow, pure): the prompt docker's style an edit model = that
 *       model, the scene as picture 1; references there = the editor's ✏ Edit model (only an edit model takes pictures);
 *       else a picture style that can redraw = Refine the scene with it at the 🟧 tab's Scene strength (the layout kept,
 *       the look new); else the Edit model. Each result is a new RASTER layer above the Blender layer.
 *   THE BLENDER LAYER IS LIVE  picking it (Layers panel, a click) opens its scene in the tools again - the scene it was made
 *       from, with its edits; picking another layer closes them and the Blender layer keeps the view (🟧 tab ☑ Live).
 *       pcbridgeoff.js still closes the scene for a hidden / deleted Blender layer; a hidden one is not opened.
 * Pure (Node: scripts/test-blendlayer542.js, test-scenerefs546.js, test-blendgen806.js): REFS, refOf, docSize, RULES, ruleOf,
 * mentions, pickRefs, genHow, strengthOf, liveStep.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const REFS = [["view", "The view as shown (instant)"], ["WORKBENCH", "Blender render - Solid"], ["EEVEE", "Blender render - EEVEE"]];
  const refOf = (v) => (REFS.some((r) => r[0] === v) ? v : "view");
  /* 2.546.0: when the References docker's pictures go along (the same rules as lib/refWords.js) */
  const RULES = [["named", "When the prompt names them (picture 1 …)"], ["always", "Always (the named ones, else the first)"], ["never", "Never"]];
  const ruleOf = (v) => (RULES.some((r) => r[0] === v) ? v : "named");
  const MENTION = /<\s*(?:picture|image)\s*(\d{1,2})\s*>|\b(?:pictures?|images?|imgs?|pics?|photos?|refs?|references?)\s*(?:no\.?\s*|#\s*)?(\d{1,2})\b/gi;
  function mentions(text) {
    const out = [];
    String(text || "").replace(MENTION, (m, a, b) => { const n = parseInt(a || b, 10); if (n >= 1 && !out.includes(n)) out.push(n); return m; });
    return out;
  }
  function pickRefs(text, have, max, rule) {
    const H = Math.max(0, parseInt(have, 10) || 0), M = Math.max(0, parseInt(max, 10) || 0);
    if (rule === "never" || !H || !M) return [];
    const named = mentions(text).filter((n) => n <= H);
    if (rule === "always") for (let i = 1; i <= H && named.length < M; i++) if (!named.includes(i)) named.push(i);
    return named.slice(0, M);
  }
  /** 2.806.0: how ✨ Generate makes a picture from the scene (pure). style = the prompt docker's style id, eng = the editor's
   *  engines {edit, inpaint}, refs = how many References docker pictures go along, editId = the editor's ✏ Edit model
   *  -> {how: "edit" | "refine" | null, style, why} */
  function genHow(style, eng, refs, editId) {
    const E = eng || {}, isEdit = (id) => !!id && (E.edit || []).some((x) => x.id === id);
    if (isEdit(style)) return { how: "edit", style, why: "" };
    const pic = (E.inpaint || []).find((x) => x.id === style && x.refine !== false);
    const ed = isEdit(editId) ? editId : ((E.edit || [])[0] || {}).id || "";
    if (refs > 0 && ed) return { how: "edit", style: ed, why: pic ? "the References docker's pictures go along - only an edit model takes pictures, so the ✏ Edit model makes it" : "" };
    if (pic) return { how: "refine", style, why: "" };
    if (ed) return { how: "edit", style: ed, why: style ? "the prompt docker's style cannot redraw a picture - the ✏ Edit model makes it" : "" };
    return { how: null, style: "", why: "no edit model or picture style that can redraw a picture is installed" };
  }
  /** the 🟧 tab's Scene strength (pure): 20-95 %, 60 by default */
  function strengthOf(v) { const n = Math.round(+v); return Number.isFinite(n) && n > 0 ? Math.max(20, Math.min(95, n)) : 60; }
  /** 2.806.0: the layer picked changed (pure) -> "open" | "close" | "" . L = {blender, shown} of the layer picked now,
   *  open = the scene tools are open, same = it is the layer they are on, live = ☑ Live */
  function liveStep(L, open, same, live) {
    if (!live) return "";
    if (open && !same) return "close";
    if (!open && L && L.blender && L.shown) return "open";
    return "";
  }
  /** 2.851.0: the recent list with p first (pure): no doubles, 5 at most */
  function recentWith(list, p) { const out = [String(p)]; for (const x of list || []) if (typeof x === "string" && x && x !== p && out.length < 5) out.push(x); return out; }
  /** 2.851.0: the 🟧 ▾ menu (pure). s = {open, has (a scene in the tools), layer (a Blender layer's name), recent} */
  function menuItems(s) {
    const x = s || {}, base = (p) => String(p).split(/[\\/]/).pop();
    const it = [{ k: "new", label: "🆕 New scene…", tip: "Blender makes an empty scene and the scene tools open it" },
      { k: "open", label: "📂 Open…", tip: "A .blend - Blender reads it and the scene tools open it" },
      { k: "save", label: "💾 Save", off: !x.has, tip: x.has ? "Save the scene's changes (as the scene tools' Save mode says)" : "open a scene first" },
      { k: "import", label: "⤒ Import model…", off: !x.has, tip: x.has ? "A .glb / .gltf into the open scene" : "open a scene first" }];
    const rc = (x.recent || []).slice(0, 5);
    if (rc.length) { it.push({ sep: true }, { head: "Recent" }); rc.forEach((p, i) => it.push({ k: "recent", path: p, label: `${i + 1}  ${base(p)}` })); }
    it.push({ sep: true });
    if (x.open) it.push({ k: "close", label: "✕ Close the scene tools", tip: "The view stays on its Blender layer" });
    else if (x.layer) it.push({ k: "tools", label: "🟧 Scene tools - " + x.layer, tip: "Open the picked Blender layer's scene again" });
    else it.pop();
    return it;
  }
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

    /* ---- the Blender layer's settings: 2.851.0 (Tim: "remove the blender tab") at the foot of the Properties tab while a
       Blender layer is picked or the scene tools are open - our part on top, the timeline's Properties under it while open */
    const body = doc.createElement("div"); body.className = "kxsec"; body.id = "kblBody";
    body.innerHTML = '<div style="font-weight:600;margin:8px 0 2px;border-top:1px solid var(--pc-line);padding-top:6px">🟧 Blender</div><div id="kblOwn"></div><div id="kblTl"></div>';
    if (E.ui.propsFoot) E.ui.propsFoot(body, () => open || !!cur());
    {
      const css = doc.createElement("style");
      css.textContent = "#kblBody{padding:0 0 6px;font-size:11px}#kblOwn .r{display:flex;gap:4px;align-items:center;margin:3px 0;flex-wrap:wrap}#kblOwn .r>span:first-child{min-width:54px;color:var(--pc-dim)}"
        + "#kblOwn .dim{color:var(--pc-dim)}#kblOwn button.on{background:var(--pc-accent);color:#000}#kblMsg{color:var(--pc-dim);min-height:14px;margin-top:4px}"
        + "#kblBtn.on{background:#f5792c;color:#000;border-color:#f5792c}"
        + "#kblMenu{position:fixed;z-index:10070;min-width:230px;background:var(--pc-panel,#222);border:1px solid var(--pc-line,#444);border-radius:5px;padding:4px 0;box-shadow:0 6px 18px rgba(0,0,0,.45);font-size:12px}"
        + "#kblMenu button{display:block;width:100%;text-align:left;background:none;border:0;padding:5px 12px;color:var(--pc-text,#ddd);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}"
        + "#kblMenu button:hover:not(:disabled){background:var(--pc-accent,#f59e2c);color:#000}#kblMenu button:disabled{opacity:.45;cursor:default}"
        + "#kblMenu .sep{height:1px;background:var(--pc-line,#444);margin:4px 0}#kblMenu .hd{padding:3px 12px;color:var(--pc-dim,#999);font-size:11px}";
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
        <div class="r"><span>References</span><select id="kblRefs" title="✏ Edit sends the References docker's pictures with the scene - e.g. &quot;photo real blonde woman on a beach with the face of the woman in picture 1&quot; (the model's own words are put in: image 2, Picture 2 …)">${RULES.map(([v, t]) => `<option value="${v}"${ruleOf(store.get("bl.refs", "named")) === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select><span class="dim" id="kblRefN">${refsHave()} in the References docker</span></div>
        <div class="r"><span>Scene strength</span><input type="range" id="kblStr" min="20" max="95" step="5" value="${strengthOf(store.get("bl.str", 60))}" title="✨ Generate with a picture style (SDXL, FLUX …): how much of the scene it redraws - low keeps the scene, high makes it new"><span id="kblStrV">${strengthOf(store.get("bl.str", 60))}%</span></div>
        <div class="r"><label title="Picking a Blender layer opens its scene again (live); picking another layer closes the tools and the layer keeps the view"><input type="checkbox" id="kblLive"${store.get("bl.live", true) !== false ? " checked" : ""}> Live - pick the layer = its scene</label></div>
        <div class="r dim">Blender mode: pick this layer, type in the prompt docker, ✨ Generate (the scene + the prompt + the References docker's pictures) or ▾ Edit / Refine - each result comes in as a new layer above it.</div>
        <div id="kblMsg">${esc(msg)}</div>`;
      const o = $("kblOpen"); if (o) o.onclick = () => (open ? leave() : start());
      const r = $("kblRef"); if (r) r.onchange = (e) => store.set("bl.ref", refOf(e.target.value));
      const rr = $("kblRefs"); if (rr) rr.onchange = (e) => store.set("bl.refs", ruleOf(e.target.value));
      const ks = $("kblStr"); if (ks) ks.oninput = (e) => { store.set("bl.str", strengthOf(e.target.value)); const v = $("kblStrV"); if (v) v.textContent = strengthOf(e.target.value) + "%"; };
      const kl = $("kblLive"); if (kl) kl.onchange = (e) => store.set("bl.live", !!e.target.checked);
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
      const lk = tb.look ? tb.look() : null;   // 2.807.0: + where the free view looks (its orbit centre) - restoreView puts it back
      const meta = { stem: info.stem, source: info.source, view: tb.view ? tb.view() : null, target: lk && lk.target ? lk.target : null, frame: tb.state.frame, sceneCam: tb.state.view === "scene" };
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
    function start(opts) {
      const o = opts || {}, tb = TB();
      if (!tb || !tb.attach) { say("the Blender scene tools come with the timeline docker (its 🟧 tool) - it is not loaded"); paint(); return null; }
      target = o.path ? null : cur();     // 2.851.0: New / Open / a recent file = a new Blender layer
      if (o.path && open) leave(false, false);
      open = true; fit(); wrap.style.display = "block";
      if (E.ui.showTab) E.ui.showTab("pcProps");
      if (E.ui.placeExtras) E.ui.placeExtras();
      const host = { wrap, props: body.querySelector("#kblTl") || body, onShow: (on) => { if (!on && open) leave(true); }, onTaken: () => { if (open) leave(true, true); } };
      paint();
      say("🟧 the Blender scene tools: 📂 Open a .blend (or the open scene), drag = orbit · right-drag = pan · wheel / Alt+drag = zoom · ⌖ (Z) zoom to the object · click an object, G / R / S - ✕ or Esc keeps the view as a layer");
      const p = tb.attach(host).then((st) => {
        if (o.path) return tb.open(o.path).then((s2) => { remember(o.path); afterLoad(); return s2; }, (e) => { if (/not there|not a Blender file/i.test(String(e && e.message))) forget(o.path); throw e; });
        if (st && st.stem) { if (target && target.bscene && target.bscene.stem !== st.stem && target.bscene.source) return tb.open(target.bscene.source).then(afterLoad); afterLoad(); }
        // 2.618.0: the scene was closed (its layer hidden / deleted, then shown / undone) - this layer's scene opens again
        else if (target && target.bscene && target.bscene.source) return tb.open(target.bscene.source).then(afterLoad);
        return st;
      }).catch((e) => { status("Blender: " + (e.message || e)); });
      // a scene opened INSIDE the tools (📂 Open / ✨ Build) -> its layer as soon as the view can draw it
      root.clearInterval(watch);
      watch = root.setInterval(() => { if (!open) { root.clearInterval(watch); return; } if (!target && sceneInfo() && TB().snapshot(16, 16)) afterLoad(); }, 1200);
      return p;
    }
    /** 2.807.0: the layer's own view back (camera, orbit centre, frame) when its scene opens again */
    function putView(L) {
      const tb = TB(), b = L && L.bscene;
      if (!tb || !tb.restoreView || !b || (!b.view && !b.sceneCam)) return false;
      try { return tb.restoreView({ matrix: b.view && b.view.matrix, fov: b.view && b.view.fov, target: b.target, sceneCam: b.sceneCam, frame: b.frame }); } catch (e) { return false; }
    }
    function afterLoad() {
      const info = sceneInfo(); if (!info || !open) return;
      if (target && target.bscene && target.bscene.stem === info.stem) putView(target);
      root.setTimeout(() => { if (open && (!target || !S.layers.includes(target))) keepView("new Blender layer"); paint(); status(`scene ${info.stem} - the layer follows the view when the tools close`); }, 400);
    }
    function leave(fromTools, taken, drop) {
      if (!open) return;
      open = false; root.clearInterval(watch);
      const tb = TB();
      // 2.618.0 drop: the layer was deleted / hidden - nothing is kept (keeping the view would make a NEW layer)
      if (drop) { target = null; wrap.style.display = "none"; if (tb && tb.host && tb.host()) tb.detach(); paint(); E.refresh(); return; }
      try { if (tb && sceneInfo()) keepView("Blender view"); } catch (e) { status("Blender: " + (e.message || e)); }
      wrap.style.display = "none";
      if (tb && !taken && tb.host && tb.host()) tb.detach();
      paint(); E.refresh();
      if (!fromTools || !taken) say(target ? `🟧 ${target.name}: the view is on the layer - pick it and ▾ Edit in the prompt docker to make a picture from the scene` : "the Blender scene tools are closed");
    }

    /* ---- 2.546.0: the scene + the References docker's pictures -> the edit model as one compose (the scene = picture 1) */
    function refsAll() { try { return root.H3Refs ? root.H3Refs.images() || [] : []; } catch (e) { return []; } }
    function refsHave() { return refsAll().length; }
    async function canvasOf(r) {
      const blob = r.file ? r.file : await (await root.fetch(r.url)).blob();
      const bmp = await root.createImageBitmap(blob);
      const c = E.newCanvas(bmp.width, bmp.height); c.getContext("2d").drawImage(bmp, 0, 0); return c;
    }
    /** -> true when it went as a compose with references (false = nothing named / none to send: the caller edits alone) */
    async function sceneWithRefs(scene, text, editStyle, keep, label, ruleOver) {
      const all = refsAll(), rule0 = ruleOf(store.get("bl.refs", "named")), rule = rule0 === "never" ? "never" : ruleOver || rule0;
      const want = mentions(text), picked = pickRefs(text, all.length, 2, rule);
      const missing = rule === "never" ? [] : want.filter((n) => n > all.length);
      if (missing.length) say(`the References docker has ${all.length} picture(s) - picture ${missing.join(", ")} is not there${picked.length ? "" : " (the scene goes alone)"}`);
      if (!picked.length || !E.runCompose) return false;
      if (want.filter((n) => n <= all.length).length > 2) say("the edit models take three pictures - the scene + the first 2 references named go");
      const pics = [{ canvas: scene, name: "the 3D scene" }];
      try { for (const n of picked) { const r = all[n - 1]; pics.push({ canvas: await canvasOf(r), name: String(r.desc || r.name || `reference ${n}`).slice(0, 60) }); } }
      catch (e) { say("a reference picture did not load: " + (e.message || e)); return false; }
      const es = $("ieEditStyle"); if (es && editStyle && [...es.options].some((o) => o.value === editStyle)) es.value = editStyle;
      status(`🟧 the scene is picture 1, the References docker's picture ${picked.join(" + ")} come${picked.length > 1 ? "" : "s"} along - each result is a new layer`);
      if (root.H3TestEvent) { try { root.H3TestEvent("ie_scene_refs", picked.join(",")); } catch (e) { /* the 🧪 list */ } }
      await E.runCompose({ pics, sceneRefs: picked, prompt: text, direct: true, keep, label: label + " + 🖼 " + picked.join("+") });
      return true;
    }
    E.sceneRefs = { run: sceneWithRefs, pick: (text) => pickRefs(text, refsAll().length, 2, ruleOf(store.get("bl.refs", "named"))), rule: () => ruleOf(store.get("bl.refs", "named")) };

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
      if (mode === "edit" && await sceneWithRefs(c, t, editStyle, L, "🟧 " + (L.bscene.stem || L.name) + " edit")) return c;   // 2.546.0
      status(`🟧 the scene goes to ${mode === "edit" ? "the edit model" : "Refine"} with the prompt - each result is a new layer`);
      if (root.H3TestEvent) { try { root.H3TestEvent("ie_blendlayer", mode); } catch (e) { /* the 🧪 list */ } }
      if (S.aiMode !== mode && E.setAiMode) E.setAiMode(mode);
      await E.runAI({ prompt: t, editStyle: editStyle || "", source: c, whole: true, into: false, direct: true, keep: L, label: "🟧 " + (L.bscene.stem || L.name) + " " + mode });
      return c;
    }

    /* ---- 2.806.0: ✨ Generate from the scene + the prompt + the References docker's pictures (if any) */
    /** Basic Settings ▸ Override style on = its steps / CFG / checkpoint / LoRAs ride along (as the prompt docker's Generate) */
    function ovrNow() {
      try {
        if (typeof root.ovrStyleOn === "function" && !root.ovrStyleOn()) return null;
        const b = typeof root.imgBasicsBody === "function" ? root.imgBasicsBody({}) || {} : {}, o = {};
        ["steps", "cfg", "model", "lora_weights", "extra_loras", "mm_override"].forEach((k) => { if (b[k] !== undefined) o[k] = b[k]; });
        return Object.keys(o).length ? o : null;
      } catch (e) { return null; }
    }
    async function generateFromScene(L, text, style) {
      if (!isBL(L)) { say("pick a Blender layer first"); return null; }
      const t = String(text || "").trim();
      if (!t) { say("type in the prompt docker what to make of the scene (e.g. \"a photo of a cosy living room, evening light\")"); return null; }
      if (S.busy && !(E.pending && !E.pending.auto)) { say("still working on the last one"); return null; }
      const rule = ruleOf(store.get("bl.refs", "named"));
      const nRefs = rule === "never" ? 0 : Math.min(2, refsHave());
      const g = genHow(style || "", S.engines || {}, nRefs, ($("ieEditStyle") || {}).value || "");
      if (!g.how) { status(g.why); say("✨ " + g.why); return null; }
      let c = null;
      try { c = await reference(L); } catch (e) { status("Blender: " + e.message); say("Blender: " + e.message); return null; }
      const label = "✨ " + (L.bscene.stem || L.name);
      if (g.why) say("✨ " + g.why);
      if (root.H3TestEvent) { try { root.H3TestEvent("ie_blendgen", g.how + (nRefs ? "+" + nRefs : "")); } catch (e) { /* the 🧪 list */ } }
      if (g.how === "edit") {
        if (nRefs && await sceneWithRefs(c, t, g.style, L, label, "always")) return c;
        status("🟧 the scene + the prompt go to the edit model - each result is a new layer");
        await E.runAI({ mode: "edit", prompt: t, editStyle: g.style, source: c, whole: true, into: false, direct: true, keep: L, label, noRefs: true, ovr: ovrNow() });
        return c;
      }
      const k = strengthOf(store.get("bl.str", 60));
      status(`🟧 the scene is redrawn with the prompt's picture style at ${k} % - each result is a new layer`);
      await E.runAI({ mode: "refine", prompt: t, style: g.style, strength: k, source: c, whole: true, into: false, direct: true, keep: L, label, ovr: ovrNow() });
      return c;
    }

    /* ---- 2.806.0: THE BLENDER LAYER IS LIVE - picked = its scene open again, another layer picked = closed (the view kept) */
    let lastPick = null;
    function followPick() {
      const L = S.w ? E.layer() : null;
      if (L === lastPick) return;
      lastPick = L;
      if (!TB() || !TB().attach) return;
      const shown = L ? (E.D && E.D.shown ? E.D.shown(S.layers, L) : L.visible !== false) : false;
      const step = liveStep(L ? { blender: isBL(L), shown } : null, open, !!L && L === target, store.get("bl.live", true) !== false);
      if (step === "close") leave(false, false);
      else if (step === "open" && !S.busy) { start(); if (root.H3TestEvent) { try { root.H3TestEvent("ie_blendlive", L.bscene.stem || ""); } catch (e) { /* the 🧪 list */ } } }
    }
    const prevPanel = E.renderLayersPanel;
    if (typeof prevPanel === "function") E.renderLayersPanel = function () { const r = prevPanel.apply(this, arguments); try { root.setTimeout(followPick, 0); } catch (e) { /* fine */ } return r; };
    root.setInterval(() => { try { followPick(); } catch (e) { /* fine */ } }, 700);

    /* ---- 2.851.0 THE 🟧 BLENDER ▾ MENU (Tim: "make the blender button a dropdown with new scene, open, save, import and up to
       5 recent files. open and new scene will start blender"): 🆕 New scene (Blender makes an empty scene - lib/blendNew.js),
       📂 Open… (a .blend), 💾 Save, ⤒ Import model… (a .glb / .gltf into the open scene), the last 5 scenes opened; New, Open and
       a recent file start the scene tools (Blender reads the scene) and make a new Blender layer */
    const RECENT = "bl.recent";
    const recent = () => { const r = store.get(RECENT, []); return Array.isArray(r) ? r.filter((x) => typeof x === "string" && x).slice(0, 5) : []; };
    function remember(p) { if (!p) return; store.set(RECENT, recentWith(recent(), p)); }
    function forget(p) { store.set(RECENT, recent().filter((x) => x !== p)); }
    const post = (u, x) => root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x || {}) }).then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || r.statusText); return j; }));
    function needTools() { if (TB() && TB().attach) return true; say("the Blender scene tools come with the timeline docker (its 🟧 tool) - it is not loaded"); return false; }
    function openFile(p) {
      if (!needTools() || !p) return null;
      say("🟧 Blender is reading " + String(p).split(/[\\/]/).pop() + " …");
      return start({ path: p });
    }
    function openDialog() {
      if (!needTools()) return;
      const FD = root.FileDialog;
      if (!FD || !FD.open) { E.ui.dialog("📂 Open a Blender Scene", '<div class="rw"><span>The .blend file</span><input id="kblPath" style="flex:1" placeholder="C:\\scenes\\room.blend"></div>', (d) => { const v = d.querySelector("#kblPath").value.trim(); if (v) openFile(v); return true; }, { okLabel: "Open" }); return; }
      FD.open({ mode: "file", title: "Open a Blender scene", okLabel: "Open", key: "blend", filters: [{ label: "Blender scenes", exts: [".blend"] }] }).then((r) => { if (r && r.path) openFile(r.path); });
    }
    function newScene() {
      if (!needTools()) return;
      E.ui.dialog("🆕 New Blender Scene", '<div class="rw"><span>Name</span><input id="kblNewName" value="New scene" maxlength="60" style="flex:1"></div><div style="color:var(--pc-dim);margin:4px 0">Blender makes an empty scene - a ground, the sun and a camera - in the project\'s blender/scenes folder, and the scene tools open it.</div>', (d) => {
        const name = d.querySelector("#kblNewName").value.trim() || "New scene";
        say("🟧 Blender is making " + name + " …"); status("Blender is making the scene …");
        post("/api/blendview/new", { name }).then((r) => { say("🟧 " + r.name + " made - opening it"); return openFile(r.path); })
          .catch((e) => { status("Blender: " + (e.message || e)); say("🟧 " + (e.message || e)); });
        return true;
      }, { okLabel: "Make it" });
    }
    function saveScene() {
      const tb = TB(); if (!open || !tb || !sceneInfo()) return say("open a Blender scene first (🟧 ▾ New scene / Open)");
      tb.save(); say("🟧 Blender is saving " + sceneInfo().stem + " …");
    }
    function importModel() {
      const tb = TB(); if (!open || !tb || !sceneInfo()) return say("open a Blender scene first - Import puts a model into it");
      root.fetch("/api/tlcanvas/models").then((r) => r.json()).then((j) => {
        const list = (j.models || []).map((m) => (typeof m === "string" ? m : m.name)).filter((n) => /\.(glb|gltf)$/i.test(n || ""));
        E.ui.dialog("⤒ Import a 3D Model", `<div class="rw"><span>From the project</span><select id="kblImp" style="flex:1">${list.length ? list.map((n) => `<option>${esc(n)}</option>`).join("") : '<option value="">- no .glb / .gltf models yet -</option>'}</select></div>
          <div class="rw"><button type="button" class="ghost" id="kblImpPc">📁 From this computer…</button><span id="kblImpNote" style="color:var(--pc-dim)"></span><input type="file" id="kblImpFile" accept=".glb,.gltf" style="display:none"></div>
          <div style="color:var(--pc-dim);margin:4px 0">The model goes into the open scene, 1 m tall, on the ground where the view looks - move it with G / R / S.</div>`, (d) => {
          const n = d.querySelector("#kblImp").value; if (!n) return say("pick a model (or 📁 From this computer)"), false;
          tb.addModel(n).then((id) => say(id ? `🟧 ${n} is in the scene as ${id}` : "the model did not go in"));
          return true;
        }, { okLabel: "Import", init: (d) => {
          const f = d.querySelector("#kblImpFile");
          d.querySelector("#kblImpPc").onclick = () => f.click();
          f.onchange = async () => {
            const file = f.files && f.files[0]; if (!file) return;
            d.querySelector("#kblImpNote").textContent = "sending " + file.name + " …";
            try {
              const r = await root.fetch("/api/tlcanvas/model?name=" + encodeURIComponent(file.name), { method: "POST", body: file });
              const jj = await r.json(); if (!r.ok) throw new Error(jj.error || r.statusText);
              const sel = d.querySelector("#kblImp"), nm = jj.name || file.name;
              if (![...sel.options].some((o) => o.value === nm)) { if (sel.options.length === 1 && !sel.options[0].value) sel.innerHTML = ""; sel.insertAdjacentHTML("afterbegin", `<option>${esc(nm)}</option>`); }
              sel.value = nm; d.querySelector("#kblImpNote").textContent = "✓ " + nm + " - Import puts it in";
            } catch (e) { d.querySelector("#kblImpNote").textContent = "✗ " + (e.message || e); }
          };
        } });
      }).catch((e) => say("the project's models did not load: " + (e.message || e)));
    }
    let menuEl = null;
    function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
    function menu(at) {
      if (menuEl) { closeMenu(); return; }
      const has = open && !!sceneInfo(), L = cur();
      const items = menuItems({ open, has, layer: L ? L.name : "", recent: recent() });
      menuEl = doc.createElement("div"); menuEl.id = "kblMenu";
      menuEl.innerHTML = items.map((it) => (it.sep ? '<div class="sep"></div>' : it.head ? `<div class="hd">${esc(it.head)}</div>`
        : `<button type="button" data-k="${esc(it.k)}"${it.path ? ` data-p="${esc(it.path)}"` : ""}${it.off ? " disabled" : ""} title="${esc(it.tip || it.path || "")}">${esc(it.label)}</button>`)).join("");
      doc.body.appendChild(menuEl);
      const r = at.getBoundingClientRect(), mw = menuEl.offsetWidth;
      menuEl.style.left = Math.max(4, Math.min(r.left, (root.innerWidth || 1600) - mw - 4)) + "px"; menuEl.style.top = Math.round(r.bottom + 2) + "px";
      menuEl.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-k]"); if (!b || b.disabled) return;
        const k = b.dataset.k, p = b.dataset.p; closeMenu();
        if (k === "new") newScene(); else if (k === "open") openDialog(); else if (k === "save") saveScene(); else if (k === "import") importModel();
        else if (k === "recent") openFile(p); else if (k === "tools") start(); else if (k === "close") leave();
      });
      const off = (e) => { if (menuEl && (menuEl.contains(e.target) || at.contains(e.target))) return; closeMenu(); doc.removeEventListener("pointerdown", off, true); };
      root.setTimeout(() => doc.addEventListener("pointerdown", off, true), 0);
    }
    doc.addEventListener("keydown", (e) => { if (menuEl && e.key === "Escape") { e.stopPropagation(); closeMenu(); } }, true);
    const mr = $("kxFull") ? $("kxFull").parentNode : null;
    if (mr) {
      const b = doc.createElement("button"); b.className = "ghost"; b.id = "kblBtn"; b.type = "button"; b.textContent = "🟧 ▾";
      b.title = "Blender: New scene, Open, Save, Import a model, the last 5 scenes - the scene tools open over the canvas and the view becomes a Blender layer";
      b.onclick = () => menu(b);
      mr.insertBefore(b, $("kxFull"));
    }
    E.ui.addCmd("layer.newblend", "New Blender Layer (Scene Tools)…", "", () => start(), {}, ["Layer", null, true]);
    const prevHist = E.ui.history;
    E.ui.history = function () { const r = prevHist ? prevHist.apply(this, arguments) : undefined; try { paint(); } catch (er) { /* fine */ } return r; };
    const prevShow = E.ui.showTab;
    E.ui.showTab = function (id) { const r = prevShow.apply(this, arguments); if (id === "kbl" || id === "pcProps") paint(); return r; };
    paint();
    E.ui.addCmd("file.blendnew", "🟧 New Blender Scene…", "", () => newScene(), {}, ["File", null, true]);
    E.ui.addCmd("file.blendopen", "🟧 Open Blender Scene…", "", () => openDialog(), {}, ["File", "file.blendnew"]);
    E.blendLayer = { menu: (at) => menu(at || $("kblBtn")), closeMenu, newScene, openFile, openDialog, saveScene, importModel, recent, remember,
      isCurrent: () => !!cur(), current: cur, start, leave, putView, isOpen: () => open, keepView, editFromScene, generateFromScene, followPick, reference, paint, wrap, target: () => target };
  }

  const PCBlendLayer = { recentWith, menuItems, REFS, refOf, docSize, RULES, ruleOf, mentions, pickRefs, genHow, strengthOf, liveStep, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCBlendLayer;
  else root.PCBlendLayer = PCBlendLayer;
})(typeof window !== "undefined" ? window : globalThis);
