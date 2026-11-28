/* pclayerscene.js — 🏞 SCENE IN LAYERS (3.14.0), window.PCLayerScene (E.layerScene once installed).
 *
 * Tim (verbatim): "can we use code to create the layers using an image model, like background scenic lake, horse, cabin,
 * road, text layers, etc, we have the ability to add layers, we push generate in the dialog, it generates the scene in
 * different layers, horse layer will be a full horse adjusted to the position of the road, we can move the horse up and down
 * the road, and maybe add a perspective tool?" -> "lets do both, it will be one for a photo composition and one for creating
 * posters and artwork etc"
 *
 * Layer ▸ 🏞 Scene in Layers… (and ✨ Create With the AI ▸ 🏞 Scene in layers): one row per layer - a background, the objects
 * (each its own movable layer, made WHOLE), the words (real text layers). 🤖 Plan with the AI fills the rows from a sentence
 * (POST /api/layerscene/plan, lib/layerScene.js). Two ways, both with the prompt docker's image style:
 *   📷 Photo composition   ONE picture of the whole scene (so the light and look match), then the edit model (the ✨ AI
 *                          panel's / the prompt docker's) pulls it apart: the background with the objects taken out, and
 *                          each object alone - whole, its hidden parts finished - cut out (the AI matte when installed,
 *                          else built in) where it stood. The scene is kept, hidden, at the bottom.
 *   🎨 Poster / artwork    each layer made on its own: the background empty, each object alone on a plain backdrop, cut
 *                          out and put where its row says, the size it says - regenerate any one of them later.
 * Cutting out: the AI matte (BiRefNet, Select ▸ Subject Settings) when installed; else the plain backdrop keyed out
 * (backdropKey - the model was asked for a flat light grey one); else the built-in subject finder.
 * Objects that stand on the ground get a 🌑 shadow layer and the horizon (pcground.js): 🛤 Ground & Perspective moves them
 * along the ground, smaller toward the horizon.
 * Pure (Node: scripts/test-31400.js): ROWS0, check, anchorOf, fitBox, prompts, order, textBox, backdropKey.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const WHERE = { all: [0.5, 0.5], top: [0.5, 0.2], middle: [0.5, 0.5], bottom: [0.5, 0.8], left: [0.25, 0.5], right: [0.75, 0.5], centre: [0.5, 0.55],
    "top-left": [0.25, 0.25], "top-right": [0.75, 0.25], "bottom-left": [0.25, 0.75], "bottom-right": [0.75, 0.75] };
  const KINDS = { background: "🏞 Background", object: "🐎 Object", text: "🔤 Text" };
  const ROWS0 = [
    { name: "Background", kind: "background", desc: "a calm mountain lake at golden hour, a dirt road winding from the foreground to the far shore", where: "all", size: 100, ground: false },
    { name: "Cabin", kind: "object", desc: "a small log cabin with a stone chimney", where: "right", size: 22, ground: true },
    { name: "Horse", kind: "object", desc: "a chestnut horse standing side-on, facing left", where: "bottom-left", size: 38, ground: true },
    { name: "Title", kind: "text", desc: "WILD COUNTRY", where: "top", size: 10, ground: false },
  ];
  const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  /** the dialog's rows checked -> "" | what is wrong */
  function check(o) {
    const rows = (o.rows || []).filter((r) => (r.name || "").trim() || (r.desc || "").trim());
    if (!rows.length) return "add the layers - a background, the things in the scene, any words";
    if (rows.filter((r) => r.kind === "background").length !== 1) return "one row must be the background (exactly one)";
    if (!rows.some((r) => r.kind === "object")) return "add at least one object (the things in the scene, each its own layer)";
    if (rows.some((r) => r.kind === "text" && !(r.desc || "").trim())) return "a text row needs its words";
    if (rows.length > 10) return "10 layers at most";
    if (o.mode === "photo" && !o.editStyle) return "📷 Photo composition needs an edit model (the ✨ AI panel's Edit model, or an edit style in the prompt docker) - or pick 🎨 Poster / artwork";
    if (!o.style) return "pick an image style in the prompt docker first";
    return "";
  }
  /** where a row stands: {x (its middle), y (its feet for a ground object, else its middle), h (its height, px)} */
  function anchorOf(r, W, H, horizonY) {
    const [fx, fy] = WHERE[r.where] || WHERE.centre, h = clip(+r.size || 30, 3, 100) / 100 * H;
    if (r.kind === "object" && r.ground) {
      const foot = clip(fy * H + h / 2, (horizonY || 0) + H * 0.04, H * 0.98);   // its feet: below its box's middle, under the horizon
      return { x: fx * W, y: foot, h, ground: true };
    }
    return { x: fx * W, y: fy * H, h, ground: false };
  }
  /** a cut-out (iw x ih) into its anchor: the height asked, its own shape, inside the picture -> {x, y, w, h} */
  function fitBox(iw, ih, a, W, H) {
    let h = a.h, w = h * iw / Math.max(1, ih);
    if (w > W * 0.95) { w = W * 0.95; h = w * ih / Math.max(1, iw); }
    const x = clip(a.x - w / 2, 0, Math.max(0, W - w)), y = a.ground ? a.y - h : clip(a.y - h / 2, 0, Math.max(0, H - h));
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }
  const look = (p) => [p.style, p.lighting && "Lighting: " + p.lighting, p.camera && "Seen " + p.camera].filter(Boolean).join(". ");
  const where = (r) => ({ all: "", top: "at the top", middle: "in the middle", bottom: "at the bottom", left: "on the left", right: "on the right", centre: "in the centre",
    "top-left": "top left", "top-right": "top right", "bottom-left": "bottom left", "bottom-right": "bottom right" })[r.where] || "";
  /** the prompts - p = {rows, style, lighting, camera} */
  const prompts = {
    scene(p) {
      const bg = p.rows.find((r) => r.kind === "background"), obs = p.rows.filter((r) => r.kind === "object");
      return `${bg.desc}. In the scene: ${obs.map((r) => `${r.name} (${r.desc})${where(r) ? " " + where(r) : ""}`).join("; ")}. Every one of them whole and clearly visible. ${look(p)}. A single photograph, no text, no words, no letters.`;
    },
    plate(p) {
      const obs = p.rows.filter((r) => r.kind === "object").map((r) => r.name.toLowerCase());
      return `Remove the ${obs.join(", the ")} from the picture and fill where they were so the place continues naturally. Keep everything else exactly the same.`;
    },
    extract(r) {
      return `Show only the ${r.name.toLowerCase()} (${r.desc}) - all of it, whole and complete with any hidden parts finished, exactly as it looks in the picture, in the same place and the same size, on a plain flat light grey background. Remove everything else.`;
    },
    background(p) {
      const obs = p.rows.filter((r) => r.kind === "object").map((r) => r.name.toLowerCase());
      return `${p.rows.find((r) => r.kind === "background").desc}. The empty place only - no ${obs.join(", no ")}, nothing standing in front. ${look(p)}. No text, no words, no letters.`;
    },
    object(r, p) {
      return `${r.desc}. The whole ${r.name.toLowerCase()}, all of it in the picture, nothing cut off, alone in the middle with empty space all around it, on a plain flat light grey background, no ground, no other objects. ${look(p)}. No text, no words, no letters.`;
    },
  };
  /** the order layers go in: the background, the objects far to near (feet higher up = further), the words on top */
  function order(items) {
    const rank = (it) => (it.kind === "background" ? -1e9 : it.kind === "text" ? 1e9 : (it.foot != null ? it.foot : 0));
    return items.slice().sort((a, b) => rank(a) - rank(b));
  }
  /** a text row's box: its letter height (% of H), centred at its place */
  function textBox(r, W, H) {
    const size = Math.round(clip(+r.size || 8, 3, 20) / 100 * H), w = Math.round(W * 0.9), lines = String(r.desc).split("\n").length;
    const [fx, fy] = WHERE[r.where] || WHERE.top, h = Math.round(size * 1.25 * lines + size * 0.3);
    return { size, x: Math.round(clip(fx * W - w / 2, 0, W - w)), y: Math.round(clip(fy * H - h / 2, 0, H - h)), w, h };
  }
  /** an object on a PLAIN backdrop (what 🎨 asks the model for) -> its alpha (0 - 255): the backdrop's colour from the border
   *  (the median), every pixel's distance from it eased to alpha; null when the border is not plain (then the AI matte or the
   *  built-in subject finder decides) */
  function backdropKey(d, w, h, o) {
    const ring = [], push = (x, y) => { const i = (y * w + x) * 4; ring.push([d[i], d[i + 1], d[i + 2]]); };
    const step = Math.max(1, Math.round((w + h) / 400));
    for (let x = 0; x < w; x += step) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y += step) { push(0, y); push(w - 1, y); }
    const med = [0, 1, 2].map((k) => ring.map((c) => c[k]).sort((a, b) => a - b)[ring.length >> 1]);
    const dist = (r, g, b) => Math.sqrt((r - med[0]) ** 2 + (g - med[1]) ** 2 + (b - med[2]) ** 2);
    const far = ring.filter((c) => dist(c[0], c[1], c[2]) > 28).length / ring.length;
    if (far > ((o && o.maxFar) || 0.12)) return null;                 // the border is busy: not a plain backdrop
    const lo = (o && o.lo) || 22, hi = (o && o.hi) || 52, m = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) { const t = (dist(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - lo) / (hi - lo); m[i] = Math.round(255 * Math.max(0, Math.min(1, t))); }
    return m;
  }
  const pure = { WHERE, KINDS, ROWS0, check, anchorOf, fitBox, prompts, order, textBox, backdropKey };

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, store = E.store, doc = E.doc || root.document, win = doc.defaultView || root, D = E.D || root.PCDoc;
    const say = (t) => (E.say ? E.say(t) : null), $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const sleep = (ms) => new Promise((ok) => win.setTimeout(ok, ms));
    let busy = false, stopIt = false;
    const styleNow = () => ($("styleSel") || {}).value || "";
    function editStyleNow() {
      const sel = $("styleSel"), eng = S.engines && S.engines.edit;
      if (sel && eng && eng.some((x) => x.id === sel.value)) return sel.value;
      return ($("ieEditStyle") || {}).value || store.get("editstyle", "") || "";
    }
    async function json(r) { const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; }
    async function waitJob(id) {
      for (;;) {
        if (stopIt) throw new Error("stopped");
        await sleep(1500);
        const j = await (await win.fetch("/api/jobs/" + encodeURIComponent(id))).json();
        if (j.status === "done") { const n = (j.outputs && j.outputs[0]) || j.output; if (!n) throw new Error("the job gave no picture"); return "/outputs/" + String(n).split("/").map(encodeURIComponent).join("/"); }
        if (j.status === "error" || j.status === "failed" || j.status === "cancelled") throw new Error(j.error || "the job " + j.status);
      }
    }
    const r16 = (v) => Math.max(256, Math.min(2048, Math.round(v / 16) * 16));
    let pinned = { style: "", edit: "" };   // the styles a run started with - every layer of it uses the same ones
    async function generate(prompt, w, h) {
      const j = await json(await win.fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, style_id: pinned.style || styleNow(), batch: 1, width: r16(w), height: r16(h) }) }));
      return waitJob(j.id || (j.jobs && j.jobs[0] && j.jobs[0].id));
    }
    async function edit(canvas, prompt) {
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png")), fd = new win.FormData();
      fd.append("crop", blob, "scene.png"); fd.append("mode", "edit"); fd.append("prompt", prompt); fd.append("style_id", pinned.edit || editStyleNow());
      fd.append("width", String(r16(canvas.width))); fd.append("height", String(r16(canvas.height))); fd.append("count", "1"); fd.append("whole", "1");
      const j = await json(await win.fetch("/api/aiedit", { method: "POST", body: fd }));
      return waitJob((j.jobs && j.jobs[0] && j.jobs[0].id) || j.id);
    }
    const loadImg = (url) => new Promise((ok, no) => { const im = new win.Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("the picture did not load")); im.src = url; });
    const canvasOf = (im, w, h) => { const c = doc.createElement("canvas"); c.width = w || im.naturalWidth; c.height = h || im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return c; };
    /** the subject of a picture on a plain backdrop, as its alpha: the AI matte (when installed), else built in */
    async function cutOut(c) {
      let m = null;
      try {
        const png = await new Promise((ok) => c.toBlob(ok, "image/png"));
        const r = await win.fetch("/api/subject/matte?model=" + encodeURIComponent(store.get("subject.model", "birefnet-general")), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: png });
        if (r.ok) { const im = await loadImg(win.URL.createObjectURL(await r.blob())), mc = canvasOf(im, c.width, c.height), d = mc.getContext("2d").getImageData(0, 0, c.width, c.height).data; m = new Uint8Array(c.width * c.height); for (let i = 0; i < m.length; i++) m[i] = d[i * 4]; }
      } catch (e) { m = null; }
      if (!m) { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; m = backdropKey(d, c.width, c.height);   // the plain backdrop asked for
        if (!m && root.PCSubject && root.PCSubject.subjectMask) m = root.PCSubject.subjectMask(d, c.width, c.height, {}); }
      if (!m) throw new Error("could not cut the object out");
      const g = c.getContext("2d"), id = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < m.length; i++) id.data[i * 4 + 3] = Math.round(id.data[i * 4 + 3] * m[i] / 255);
      g.putImageData(id, 0, 0); return c;
    }
    /** a canvas trimmed to what it shows */
    function trim(c) {
      const b = E.alphaBox(c); if (!b || b.w < 2) return null;
      const t = doc.createElement("canvas"); t.width = b.w; t.height = b.h; t.getContext("2d").drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h); return t;
    }
    function pixelLayer(name, draw) {
      const L = E.makeLayer(name, S.w, S.h), g = L.canvas.getContext("2d"); g.imageSmoothingQuality = "high"; draw(g); return L;
    }
    function textLayer(r) {
      const b = textBox(r, S.w, S.h), L = E.makeLayer("🔤 " + r.name, S.w, S.h, "text");
      L.text = Object.assign({}, D.TEXT_DEFAULT, { str: r.desc, font: "Arial", size: b.size, weight: 800, color: "#ffffff", align: "center", leading: 1.25, x: b.x, y: b.y, box: { w: b.w, h: b.h } });
      D.rasterize(L); return L;
    }

    /** run it: o = {mode, rows, style, lighting, camera, horizon (%), shadows, name} */
    async function run(o) {
      if (busy) return say("🏞 still making the last scene - ■ Stop Scene in the Layer menu");
      const bad = check({ mode: o.mode, rows: o.rows, style: styleNow(), editStyle: editStyleNow() }); if (bad) return say("🏞 " + bad);
      busy = true; stopIt = false; pinned = { style: styleNow(), edit: editStyleNow() };
      const rows = o.rows.filter((r) => (r.name || "").trim() || (r.desc || "").trim()), bg = rows.find((r) => r.kind === "background"), obs = rows.filter((r) => r.kind === "object"), words = rows.filter((r) => r.kind === "text");
      try {
        if (!S.w) E.openDoc(o.w || 1360, o.h || 768, o.name || "Scene", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, o.w || 1360, o.h || 768); });
        const W = S.w, H = S.h, horizonY = Math.round(clip(+o.horizon || 45, 5, 95) / 100 * H);
        S.groundH = horizonY;
        const made = [];   // {L, kind, foot, ground}
        const total = o.mode === "photo" ? 2 + obs.length : 1 + obs.length;
        let step = 0;
        const tick = (what) => say(`🏞 ${++step}/${total} ${what}…`);
        if (o.mode === "photo") {
          tick("the whole scene (one picture - the light and look match)");
          const scene = canvasOf(await loadImg(await generate(prompts.scene({ rows, style: o.style, lighting: o.lighting, camera: o.camera }), W, H)), W, H);
          const ref = pixelLayer("📷 Scene (all of it)", (g) => g.drawImage(scene, 0, 0)); ref.visible = false; made.push({ L: ref, kind: "background", foot: -2e9 });
          tick("the background - the objects taken out");
          const plate = canvasOf(await loadImg(await edit(scene, prompts.plate({ rows }))), W, H);
          made.push({ L: pixelLayer("🏞 " + bg.name, (g) => g.drawImage(plate, 0, 0)), kind: "background" });
          for (const r of obs) {
            tick(`${r.name} - pulled out whole`);
            const c = await cutOut(canvasOf(await loadImg(await edit(scene, prompts.extract(r))), W, H));
            const L = pixelLayer("🐎 " + r.name, (g) => g.drawImage(c, 0, 0)), b = E.alphaBox(L.canvas);
            made.push({ L, kind: "object", foot: b ? b.y + b.h : 0, ground: r.ground });
          }
        } else {
          tick("the background, empty");
          const back = await loadImg(await generate(prompts.background({ rows, style: o.style, lighting: o.lighting, camera: o.camera }), W, H));
          made.push({ L: pixelLayer("🏞 " + bg.name, (g) => g.drawImage(back, 0, 0, W, H)), kind: "background" });
          for (const r of obs) {
            tick(`${r.name} - on its own, whole`);
            const a = anchorOf(r, W, H, horizonY), side = Math.max(a.h, 768), ar = 1;
            const im = await loadImg(await generate(prompts.object(r, { style: o.style, lighting: o.lighting, camera: o.camera }), side * ar, side));
            const cut = trim(await cutOut(canvasOf(im)));
            if (!cut) { say(`🏞 ${r.name}: nothing to cut out - skipped`); continue; }
            const bx = fitBox(cut.width, cut.height, a, W, H);
            made.push({ L: pixelLayer("🐎 " + r.name, (g) => g.drawImage(cut, bx.x, bx.y, bx.w, bx.h)), kind: "object", foot: bx.y + bx.h, ground: r.ground });
          }
        }
        for (const r of words) made.push({ L: textLayer(r), kind: "text" });
        // into the document: one group, the background at the bottom, far to near, the words on top - one undo step
        const name = "🏞 " + (o.name || bg.name || "Scene"), G = E.makeLayer(name, S.w, S.h, "group");
        E.structOp(name, () => {
          let A = E.layer(); while (A && A.parent) A = S.layers.find((x) => x.id === A.parent) || null;   // at the top level, above what is picked
          S.layers = D.insert(S.layers, G, A ? A.id : null, false); let ref = G.id, first = true;
          for (const it of order(made)) { S.layers = D.insert(S.layers, it.L, ref, first); ref = it.L.id; first = false; if (it.L.type === "pixel" || it.L.type === "text") it.L.ground = it.ground ? { h: horizonY } : undefined; }
          S.active = S.layers.indexOf(made.filter((x) => x.kind === "object").map((x) => x.L).pop() || G);
        });
        if (o.shadows !== false && E.ground) for (const it of made) if (it.kind === "object" && it.ground) E.ground.addShadow(it.L);
        E.refresh(); E.renderLayersPanel();
        say(`🏞 ${made.filter((x) => x.L.visible !== false).length} layers in "${name}" - 🛤 Layer ▸ Ground & Perspective Tool moves an object along the ground`);
        return G;
      } catch (e) { say("🏞 " + (e.message === "stopped" ? "stopped" : "the scene stopped: " + e.message)); return null; }
      finally { busy = false; }
    }

    function rowHtml(r) {
      return `<div class="lsrow" style="display:grid;grid-template-columns:120px 110px 1fr 110px 62px 66px 24px 24px 24px;gap:4px;align-items:center;margin:2px 0">
        <input class="lsName" placeholder="name" value="${esc(r.name)}">
        <select class="lsKind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${r.kind === k ? " selected" : ""}>${v}</option>`).join("")}</select>
        <input class="lsDesc" placeholder="what it looks like (a text row: its words)" value="${esc(r.desc)}">
        <select class="lsWhere">${Object.keys(WHERE).map((k) => `<option${r.where === k ? " selected" : ""}>${k}</option>`).join("")}</select>
        <input class="lsSize" type="number" min="3" max="100" title="An object: its height, % of the picture. A text: its letter height, %" value="${esc(r.size)}">
        <label title="It stands on the ground (a shadow; 🛤 moves it with perspective)"><input type="checkbox" class="lsGround"${r.ground ? " checked" : ""}> 🛤</label>
        <button type="button" class="ghost lsUp" title="Up">↑</button><button type="button" class="ghost lsDn" title="Down">↓</button><button type="button" class="ghost lsX" title="Remove">✕</button></div>`;
    }
    const readRows = (d) => [...d.querySelectorAll(".lsrow")].map((x) => ({ name: x.querySelector(".lsName").value.trim(), kind: x.querySelector(".lsKind").value, desc: x.querySelector(".lsDesc").value.trim(),
      where: x.querySelector(".lsWhere").value, size: +x.querySelector(".lsSize").value || 30, ground: x.querySelector(".lsGround").checked }));
    const kept = () => { try { const r = JSON.parse(store.get("lscene.rows", "") || "null"); return Array.isArray(r) && r.length ? r : ROWS0; } catch (e) { return ROWS0; } };

    /** opts: {ask, plan (auto-plan the ask), mode} */
    function dialog(opts) {
      const op = opts || {};
      if (busy) return say("🏞 still making the last scene");
      const mode = op.mode || store.get("lscene.mode", "photo");
      const html = `<div class="kxrow" style="gap:4px 16px;flex-wrap:wrap">
          <label title="ONE picture of the whole scene, then the edit model pulls it apart - the light and look match"><input type="radio" name="lsMode" value="photo"${mode === "photo" ? " checked" : ""}> 📷 Photo composition</label>
          <label title="Each layer made on its own and put where its row says - for posters and artwork"><input type="radio" name="lsMode" value="poster"${mode === "poster" ? " checked" : ""}> 🎨 Poster / artwork</label></div>
        <div class="kxrow" style="gap:6px"><input type="text" id="lsAsk" style="flex:1" placeholder="Describe the scene - e.g. a horse on a road by a log cabin at a mountain lake, the title WILD COUNTRY" value="${esc(op.ask || "")}"><button type="button" class="ghost" id="lsPlan">🤖 Plan with the AI</button></div>
        <div style="color:var(--pc-dim);margin:4px 0 2px">Layers - one background, the things in it (each its own layer, made whole), the words:</div>
        <div id="lsRows">${kept().map(rowHtml).join("")}</div>
        <div class="kxrow"><button type="button" class="ghost" id="lsAdd">＋ Add layer</button></div>
        <div class="kxrow" style="flex-wrap:wrap;gap:4px 10px"><label style="flex:2;min-width:240px">Style <input type="text" id="lsStyle" style="width:100%" value="${esc(store.get("lscene.style", ""))}" placeholder="e.g. a sharp natural photograph / a bold flat vector poster"></label>
          <label style="flex:1;min-width:180px">Lighting <input type="text" id="lsLight" style="width:100%" value="${esc(store.get("lscene.light", ""))}" placeholder="e.g. late sun from the left"></label>
          <label style="flex:1;min-width:150px">Camera <input type="text" id="lsCam" style="width:100%" value="${esc(store.get("lscene.cam", ""))}" placeholder="e.g. eye level"></label></div>
        <div class="kxrow" style="gap:4px 14px;flex-wrap:wrap"><label title="Where the horizon is, % from the top - objects on the ground stand below it">Horizon <input type="number" id="lsHor" min="5" max="95" style="width:60px" value="${esc(store.get("lscene.hor", "45"))}"> %</label>
          <label><input type="checkbox" id="lsShadow"${store.get("lscene.shadows", true) !== false ? " checked" : ""}> 🌑 Shadows under the objects on the ground</label></div>
        <div style="color:var(--pc-dim);margin-top:4px">The pictures use the prompt docker's image style${mode === "photo" ? "" : ""}; 📷 also its edit model (the ✨ AI panel's Edit model). The words are real text layers.</div>
        <div id="lsMsg" style="color:#e88;min-height:1em"></div>`;
      E.ui.dialog("🏞 Scene in Layers", html, (d) => {
        const v = (id) => d.querySelector("#" + id), m = (d.querySelector('input[name="lsMode"]:checked') || {}).value || "photo", rows = readRows(d);
        const bad = check({ mode: m, rows, style: styleNow(), editStyle: editStyleNow() }); if (bad) { v("lsMsg").textContent = "⚠ " + bad; return false; }
        store.set("lscene.rows", JSON.stringify(rows)); store.set("lscene.mode", m); store.set("lscene.style", v("lsStyle").value); store.set("lscene.light", v("lsLight").value);
        store.set("lscene.cam", v("lsCam").value); store.set("lscene.hor", v("lsHor").value); store.set("lscene.shadows", v("lsShadow").checked);
        const p = d.lsPlan || {};
        run({ mode: m, rows, style: v("lsStyle").value, lighting: v("lsLight").value, camera: v("lsCam").value, horizon: +v("lsHor").value, shadows: v("lsShadow").checked, w: p.w, h: p.h, name: v("lsAsk").value.slice(0, 40) || rows[0].name });
        return true;
      }, { okLabel: "🏞 Make the layers", wide: true, width: "980px", scroll: true, init: (d) => {
        const box = d.querySelector("#lsRows");
        d.querySelector("#lsAdd").onclick = () => { if (box.querySelectorAll(".lsrow").length >= 10) return; const t = doc.createElement("div"); t.innerHTML = rowHtml({ name: "", kind: "object", desc: "", where: "centre", size: 30, ground: true }); box.appendChild(t.firstElementChild); };
        box.addEventListener("click", (ev) => {
          const r = ev.target.closest(".lsrow"); if (!r) return;
          if (ev.target.closest(".lsX")) r.remove();
          else if (ev.target.closest(".lsUp") && r.previousElementSibling) box.insertBefore(r, r.previousElementSibling);
          else if (ev.target.closest(".lsDn") && r.nextElementSibling) box.insertBefore(r.nextElementSibling, r);
        });
        const plan = async () => {
          const ask = d.querySelector("#lsAsk").value.trim(), msg = d.querySelector("#lsMsg"), btn = d.querySelector("#lsPlan");
          if (!ask) { msg.textContent = "⚠ describe the scene first"; return; }
          btn.disabled = true; msg.style.color = "var(--pc-dim)"; msg.textContent = "🤖 the LLM is planning the layers…";
          try {
            const m = (d.querySelector('input[name="lsMode"]:checked') || {}).value || "photo";
            const j = await json(await win.fetch("/api/layerscene/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ask, mode: m }) }));
            const p = j.plan; d.lsPlan = p;
            box.innerHTML = p.rows.map(rowHtml).join("");
            if (p.style) d.querySelector("#lsStyle").value = p.style; if (p.lighting) d.querySelector("#lsLight").value = p.lighting; if (p.camera) d.querySelector("#lsCam").value = p.camera;
            d.querySelector("#lsHor").value = p.horizon; msg.textContent = `🤖 ${p.rows.length} layers planned - change any of them, then 🏞 Make the layers`;
          } catch (e) { msg.style.color = "#e88"; msg.textContent = "⚠ " + e.message; } finally { btn.disabled = false; }
        };
        d.querySelector("#lsPlan").onclick = plan;
        if (op.plan && op.ask) plan();
      } });
    }

    E.ui.addCmd("layer.layerscene", "🏞 Scene in Layers…", "", () => dialog(), {}, ["Layer", "layer.ming"]);
    E.ui.addCmd("layer.layerscenestop", "■ Stop Scene", "", () => { stopIt = true; say("🏞 stopping…"); }, { enabled: () => busy }, ["Layer", "layer.layerscene"]);
    E.layerScene = { dialog, run, busy: () => busy };
  }

  const PCLayerScene = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCLayerScene;
  else root.PCLayerScene = PCLayerScene;
})(typeof window !== "undefined" ? window : globalThis);
