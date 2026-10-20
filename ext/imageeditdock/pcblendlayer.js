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
 * Pure (Node: scripts/test-blendlayer542.js, test-scenerefs546.js): REFS, refOf, docSize, RULES, ruleOf, mentions, pickRefs.
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
        <div class="r"><span>References</span><select id="kblRefs" title="✏ Edit sends the References docker's pictures with the scene - e.g. &quot;photo real blonde woman on a beach with the face of the woman in picture 1&quot; (the model's own words are put in: image 2, Picture 2 …)">${RULES.map(([v, t]) => `<option value="${v}"${ruleOf(store.get("bl.refs", "named")) === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select><span class="dim" id="kblRefN">${refsHave()} in the References docker</span></div>
        <div class="r dim">Blender mode: pick this layer, type in the prompt docker, ▾ Edit (or Refine) - each result comes in as a new layer above it.</div>
        <div id="kblMsg">${esc(msg)}</div>`;
      const o = $("kblOpen"); if (o) o.onclick = () => (open ? leave() : start());
      const r = $("kblRef"); if (r) r.onchange = (e) => store.set("bl.ref", refOf(e.target.value));
      const rr = $("kblRefs"); if (rr) rr.onchange = (e) => store.set("bl.refs", ruleOf(e.target.value));
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
      say("🟧 the Blender scene tools: 📂 Open a .blend (or the open scene), drag = orbit · right-drag = pan · wheel / Alt+drag = zoom · ⌖ (Z) zoom to the object · click an object, G / R / S - ✕ or Esc keeps the view as a layer");
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

    /* ---- 2.546.0: the scene + the References docker's pictures -> the edit model as one compose (the scene = picture 1) */
    function refsAll() { try { return root.H3Refs ? root.H3Refs.images() || [] : []; } catch (e) { return []; } }
    function refsHave() { return refsAll().length; }
    async function canvasOf(r) {
      const blob = r.file ? r.file : await (await root.fetch(r.url)).blob();
      const bmp = await root.createImageBitmap(blob);
      const c = E.newCanvas(bmp.width, bmp.height); c.getContext("2d").drawImage(bmp, 0, 0); return c;
    }
    /** -> true when it went as a compose with references (false = nothing named / none to send: the caller edits alone) */
    async function sceneWithRefs(scene, text, editStyle, keep, label) {
      const all = refsAll(), rule = ruleOf(store.get("bl.refs", "named"));
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

  const PCBlendLayer = { REFS, refOf, docSize, RULES, ruleOf, mentions, pickRefs, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCBlendLayer;
  else root.PCBlendLayer = PCBlendLayer;
})(typeof window !== "undefined" ? window : globalThis);
