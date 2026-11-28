/* pcming.js — 🧩 MING LAYERED DESIGN (3.9.0), window.PCMing.
 * Tim: "can u add this to image editor please. https://huggingface.co/inclusionAI/Ming-Image-0.2-Design . with a dialog with add
 * layer, this will have layer name and description of what goes in that layer for ming image. it is supposed to be able to
 * generate separate layers. please check it"
 *
 *   Layer ▸ 🧩 Ming Layered Design… - one row per layer (the FRONT at the top, as in the Layers panel): its name, what goes in it
 *   (quote any words it should show: "SALE 50%"; colours as #hex), where it sits; ＋ Add layer, ↑ ↓ to reorder, ✕.
 *     ✨ Make a design    Ming-Image-0.2-Design draws the whole design from the list (lib/mingLayers.js t2iPrompt), then
 *                         Ming-Image-0.1-Design-Layer splits it into those layers - each comes in as its own transparent layer,
 *                         named as you named it, in a 🧩 group (the flat design kept below it, hidden). Untick "Separate layers"
 *                         for the one picture only.
 *     ✂ Split the picture  the picture that is open (every visible layer) split into the layers you list - no new design
 *   🖥 ComfyUI on this computer (3.12.0 - Tim: "replace our ming image with this one, https://huggingface.co/Comfy-Org/Ming-Image":
 *   ComfyUI's own Ming-Image nodes with Comfy-Org's files; Settings ▸ Add-ons ▸ 🧩 Ming layered design, add-on "mingimage" - its
 *   Download box opens when they are missing) or ☁ OpenRouter (your key; Ming 0.1 Design + Design-Layer are free there - 0.2 is
 *   used when OpenRouter has it).
 *   POST /api/ming (routes/ming.js) -> a job (misc/ming_worker.py) -> its outputs.
 *   3.13.0 (Tim: "in image editor please add a button at the bottom of layers docker icon only to split layer into layers, add a
 *   template in ai generated dialog for layered image - use ming image for the layered image"):
 *     ✂ (icon only, the Layers panel's bottom bar) opens this box on "✂ Split the selected layer": the active layer alone
 *       (rendered - text, shapes, a group's contents) goes to Ming-Image-0.1-Design-Layer; the layers come back in a 🧩 group
 *       above it, cut to its own shape (what was transparent stays transparent), the layer itself hidden below.
 *     "Let Ming decide - just the number of layers" (the split modes): no list, Ming's own "Decompose this image into N layers."
 *     ✨ Create With the AI ▸ 🧩 Layered image (pccreate.js): the LLM plans the layers (POST /api/ming/plan, lib/mingPlan.js)
 *       and this box opens with them filled in to check, then ✨ Make.
 * Pure (Node: scripts/test-31200.js, scripts/test-31300.js): DEFAULT_ROWS, check, sortOutputs, autoRows, ADDON.
 */
(function (root) {
  "use strict";
  const ADDON = "mingimage";          // 3.12.0 (3.9.0's "ming" is Ming-3.0 TTS's add-on)
  const DEFAULT_ROWS = [
    { name: "Headline", desc: "The title text \"YOUR TITLE\" in bold white sans-serif, centred near the top", where: "top" },
    { name: "Subject", desc: "The main subject or product, large and centred", where: "centre" },
    { name: "Background", desc: "A soft gradient background", where: "all" },
  ];
  /** 3.13.0: "Let Ming decide": n rows named Layer 1 .. n (the last the background) - the names the layers come in with (pure) */
  function autoRows(n0) {
    const n = Math.max(2, Math.min(12, Math.round(+n0) || 3));
    return Array.from({ length: n }, (_, i) => ({ name: i === n - 1 ? "Background" : "Layer " + (i + 1), desc: "", where: "all" }));
  }
  /** the dialog's values checked -> "" (fine) | what is wrong (pure); mode make | split (the picture) | layer (3.13.0: the
   *  selected layer); auto (3.13.0) = just a number of layers for a split */
  function check(o) {
    const splitting = o.mode === "split" || o.mode === "layer";
    if (o.mode === "split" && !o.hasPicture) return "open a picture to split first (or ✨ Make a design)";
    if (o.mode === "layer" && !o.hasLayer) return "pick the layer to split in the Layers panel first";
    if (splitting && o.auto) { const n = Math.round(+o.count); return n >= 2 && n <= 12 ? "" : "2 to 12 layers"; }
    const rows = (o.rows || []).filter((r) => (r.name || "").trim() || (r.desc || "").trim());
    if (!rows.length) return "add at least one layer - its name and what goes in it";
    if (rows.length > 12) return "12 layers at most";
    if (splitting && rows.length < 2) return "splitting a picture needs at least two layers (the front ones and the background)";
    return "";
  }
  /** a job's outputs -> {flat, layers (front first)} (pure) */
  function sortOutputs(outs) {
    const L = [], flat = [];
    for (const n of outs || []) { const m = /_ming_L(\d\d)_/.exec(String(n)); if (m) L.push([+m[1], n]); else if (/\.png$/i.test(n)) flat.push(n); }
    return { flat: flat[0] || null, layers: L.sort((a, b) => a[0] - b[0]).map((x) => x[1]) };
  }
  const pure = { ADDON, DEFAULT_ROWS, check, sortOutputs, autoRows };

  function install(E) {
    const { S, win, say, store } = E, doc = E.doc || win.document;
    if (!E.ui || !E.ui.addCmd || !E.ui.dialog) return;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const sleep = (ms) => new Promise((ok) => win.setTimeout(ok, ms));
    const urlOf = (n) => "/outputs/" + String(n).split("/").map(encodeURIComponent).join("/");
    const loadImg = (url) => new Promise((ok, no) => { const im = new win.Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("a picture did not load: " + url)); im.src = url; });
    let busy = false, stopIt = false, info = null;
    const kept = () => { try { const r = JSON.parse(store.get("ming.rows", "null")); return Array.isArray(r) && r.length ? r : DEFAULT_ROWS; } catch (e) { return DEFAULT_ROWS; } };
    async function status() { try { const r = await win.fetch("/api/ming"); info = await r.json(); } catch (e) { info = null; } return info; }

    function rowHtml(r, where) {
      return `<div class="pmrow" style="display:grid;grid-template-columns:150px 1fr 120px auto;gap:4px;align-items:start;margin:3px 0">
        <input type="text" class="pmName" maxlength="60" placeholder="Layer name" value="${esc(r.name)}">
        <textarea class="pmDesc" rows="2" maxlength="600" placeholder='What goes in this layer - quote its words: "SALE 50%", colours as #hex' style="resize:vertical">${esc(r.desc)}</textarea>
        <select class="pmWhere" title="Where it sits on the canvas">${Object.entries(where).map(([k, v]) => `<option value="${k}"${k === (r.where || "all") ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>
        <span style="white-space:nowrap"><button type="button" class="ghost pmUp" title="Up (towards the front)">↑</button><button type="button" class="ghost pmDn" title="Down (towards the back)">↓</button><button type="button" class="ghost pmX" title="Remove this layer">✕</button></span></div>`;
    }
    function readRows(d) { return [...d.querySelectorAll(".pmrow")].map((x) => ({ name: x.querySelector(".pmName").value.trim(), desc: x.querySelector(".pmDesc").value.trim(), where: x.querySelector(".pmWhere").value })); }

    /** 3.13.0: the layer the ✂ split works on - the active one, not an adjustment / control layer */
    const splitLayer = () => { const L = E.layer && E.layer(); return L && L.type !== "adjust" && !L.control ? L : null; };
    /** opts (3.13.0): {mode make | split | layer, rows, style, lighting, w, h (the design's shape when no picture is open)} */
    async function dialog(opts) {
      const op = opts || {};
      if (busy) return say("🧩 Ming is working - ■ Stop Ming in the Layer menu");
      const st = (await status()) || { comfy: {}, openrouter: {}, where: { all: "Whole canvas" } };
      const here = st.comfy || st.local || {};
      // 3.12.0: "This computer" = ComfyUI (3.9.0 stored "local" - the same choice)
      const e0 = store.get("ming.engine", here.ready ? "comfy" : st.openrouter && st.openrouter.key ? "openrouter" : "comfy");
      const where = st.where || { all: "Whole canvas" }, eng = e0 === "openrouter" ? "openrouter" : "comfy";
      const SL = splitLayer();
      const m0 = op.mode || store.get("ming.mode", "make");
      const mode = m0 === "layer" && S.w && SL ? "layer" : m0 === "split" && S.w ? "split" : "make";
      const loc = here, orr = st.openrouter || {};
      const rows0 = Array.isArray(op.rows) && op.rows.length ? op.rows : kept();
      const a0 = store.get("ming.auto", null);                     // not set yet: ticked for a layer split
      const auto0 = op.rows ? false : a0 == null ? mode === "layer" : a0 === true || a0 === "true";
      const style0 = op.style != null ? op.style : store.get("ming.style", ""), light0 = op.lighting != null ? op.lighting : store.get("ming.light", "");
      const html = `<div class="kxrow" style="flex-wrap:wrap;gap:4px 16px">
          <label><input type="radio" name="pmMode" value="make"${mode === "make" ? " checked" : ""}> ✨ Make a design from these layers</label>
          <label title="${S.w ? "The picture that is open (every visible layer)" : "Open a picture first"}"><input type="radio" name="pmMode" value="split"${mode === "split" ? " checked" : ""}${S.w ? "" : " disabled"}> ✂ Split the open picture into these layers</label>
          <label title="${SL ? "The active layer alone (its text, shapes or a group's contents) - the layers come in above it, cut to its shape" : "Pick a layer in the Layers panel first"}"><input type="radio" name="pmMode" value="layer"${mode === "layer" ? " checked" : ""}${S.w && SL ? "" : " disabled"}> ✂ Split the selected layer${SL ? ` (${esc(SL.name)})` : ""}</label></div>
        <div class="pmAutoRow kxrow" style="gap:6px"><label title="No list: Ming-Image works out what goes in each layer"><input type="checkbox" id="pmAuto"${auto0 ? " checked" : ""}> Let Ming decide - just the number of layers</label>
          <input type="number" id="pmCount" min="2" max="12" style="width:60px" value="${esc(store.get("ming.count", "3"))}"></div>
        <div class="pmList"><div style="color:var(--pc-dim);margin:4px 0 2px">Layers - the <b>front</b> at the top, the background last (as in the Layers panel):</div>
        <div id="pmRows">${rows0.map((r) => rowHtml(r, where)).join("")}</div>
        <div class="kxrow"><button type="button" class="ghost" id="pmAdd">＋ Add layer</button><label style="margin-left:auto" class="pmMake" title="Untick for the one flat picture"><input type="checkbox" id="pmSplit"${store.get("ming.split", true) !== false ? " checked" : ""}> Separate layers</label></div></div>
        <div class="pmMake kxrow" style="flex-wrap:wrap;gap:4px 10px"><label style="flex:1;min-width:260px">Style <input type="text" id="pmStyle" style="width:100%" placeholder="e.g. flat vector poster, bold colours, crisp typography" value="${esc(style0)}"></label>
          <label style="flex:1;min-width:200px">Lighting <input type="text" id="pmLight" style="width:100%" placeholder="e.g. soft daylight from the left" value="${esc(light0)}"></label></div>
        <div class="kxrow" style="flex-wrap:wrap;gap:4px 14px">
          <label class="pmMake">Size <select id="pmLevel"><option value="1024">~1 MP (faster)</option><option value="2048"${store.get("ming.level", "1024") === "2048" ? " selected" : ""}>~4 MP (2K)</option></select></label>
          <label>Layers at <select id="pmRes"><option value="1024">1024</option><option value="512"${store.get("ming.res", "1024") === "512" ? " selected" : ""}>512 (faster)</option></select></label>
          <label>Seed <input type="number" id="pmSeed" min="0" style="width:90px" value="${esc(store.get("ming.seed", "42"))}"></label></div>
        <div class="kxrow" style="flex-wrap:wrap;gap:4px 16px;margin-top:4px">
          <label title="${esc(loc.note || "")}"><input type="radio" name="pmEng" value="comfy"${eng === "comfy" ? " checked" : ""}> 🖥 ComfyUI on this computer ${loc.ready ? "✓" : "(files not downloaded - its Download box opens)"}</label>
          <label title="Ming 0.1 Design + Design-Layer are free on OpenRouter (0.2 is used when OpenRouter has it)"><input type="radio" name="pmEng" value="openrouter"${eng === "openrouter" ? " checked" : ""}> ☁ OpenRouter ${orr.key ? "✓" : "(needs your key - 🖥 GPU ▸ Remote generation)"}</label></div>
        <div style="color:var(--pc-dim);margin-top:6px">Ming-Image Design draws the design from the list (in ComfyUI 0.1 - Comfy-Org has not published 0.2's text encoder yet; ☁ OpenRouter uses 0.2 when it has it); Ming-Image-0.1-Design-Layer splits it into your layers (transparent, each named as here). Both run in ComfyUI's own Ming-Image nodes (0.46.0 or newer) with Comfy-Org's files.</div>
        <div id="pmMsg" style="color:#e88;min-height:1em"></div>`;
      E.ui.dialog("🧩 Ming Layered Design", html, (d) => {
        const v = (id) => d.querySelector("#" + id), m = (d.querySelector('input[name="pmMode"]:checked') || {}).value || "make";
        const auto = m !== "make" && v("pmAuto").checked, count = Math.round(+v("pmCount").value);
        const o = { mode: m, rows: auto ? autoRows(count) : readRows(d), hasPicture: !!S.w, hasLayer: !!splitLayer(), auto, count };
        const bad = check(o); if (bad) { v("pmMsg").textContent = "⚠ " + bad; return false; }
        const e = (d.querySelector('input[name="pmEng"]:checked') || {}).value || "comfy";
        if (!auto) store.set("ming.rows", JSON.stringify(o.rows));
        store.set("ming.mode", m); store.set("ming.engine", e); store.set("ming.split", v("pmSplit").checked);
        store.set("ming.style", v("pmStyle").value); store.set("ming.light", v("pmLight").value); store.set("ming.level", v("pmLevel").value); store.set("ming.res", v("pmRes").value);
        store.set("ming.seed", v("pmSeed").value);
        if (m !== "make") { store.set("ming.auto", auto); store.set("ming.count", String(count)); }
        run({ mode: m, rows: o.rows, engine: e, split: m !== "make" || v("pmSplit").checked, style: v("pmStyle").value, lighting: v("pmLight").value, auto: auto ? count : 0,
          level: +v("pmLevel").value, layer_res: +v("pmRes").value, seed: v("pmSeed").value, w: op.w, h: op.h, layer: m === "layer" ? splitLayer() : null }).catch((er) => say("🧩 " + er.message));
        return true;
      }, { okLabel: "🧩 Go", wide: true, width: "880px", scroll: true, init: (d) => {
        const box = d.querySelector("#pmRows"), paintMode = () => {
          const md = (d.querySelector('input[name="pmMode"]:checked') || {}).value, mk = md !== "split" && md !== "layer", auto = !mk && d.querySelector("#pmAuto").checked;
          d.querySelectorAll(".pmMake").forEach((x) => { x.style.display = mk ? "" : "none"; });
          d.querySelector(".pmAutoRow").style.display = mk ? "none" : "";
          d.querySelector(".pmList").style.display = auto ? "none" : "";
        };
        d.querySelector("#pmAdd").onclick = () => { if (box.querySelectorAll(".pmrow").length >= (st.max || 12)) return; const t = doc.createElement("div"); t.innerHTML = rowHtml({ name: "", desc: "", where: "all" }, where); const r = t.firstElementChild; const last = box.lastElementChild; box.insertBefore(r, last && /background/i.test(last.querySelector(".pmName").value) ? last : null); r.querySelector(".pmName").focus(); };
        box.addEventListener("click", (ev) => {
          const r = ev.target.closest(".pmrow"); if (!r) return;
          if (ev.target.closest(".pmX")) r.remove();
          else if (ev.target.closest(".pmUp") && r.previousElementSibling) box.insertBefore(r, r.previousElementSibling);
          else if (ev.target.closest(".pmDn") && r.nextElementSibling) box.insertBefore(r.nextElementSibling, r);
        });
        d.querySelectorAll('input[name="pmMode"]').forEach((x) => x.addEventListener("change", paintMode));
        d.querySelector("#pmAuto").addEventListener("change", paintMode); paintMode();
      } });
    }

    /** 3.13.0: a layer alone as the picture Ming splits - rendered (text, shapes, a group's contents), on white where it is
     *  transparent (ComfyUI's LoadImage drops the alpha); -> {url, cut (the layer's own shape, to clip the layers to)} */
    function layerPicture(L) {
      const doc0 = { w: S.w, h: S.h, layers: S.layers };
      const look = L.type === "pixel" && !(E.D.hasStyles && E.D.hasStyles(L)) && !L.mask ? L.canvas : E.D.renderLayer(doc0, E.docEnv({ srcFor: (x) => x.canvas, maskSrc: null }), L);
      const c = doc.createElement("canvas"); c.width = S.w; c.height = S.h;
      const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, S.w, S.h); g.drawImage(look, 0, 0);
      return { url: c.toDataURL("image/png"), cut: look };
    }

    async function needInstall() {
      const A = root.H3Addons;
      if (A && A.act) { try { if (A.refresh) await A.refresh(); } catch (e) { /* the list */ } A.act(ADDON, "install"); }
      say("🧩 Ming needs Ming-Image's ComfyUI files - its Download box is open (tick the models); or pick ☁ OpenRouter");
    }
    async function run(o) {
      busy = true; stopIt = false;
      try {
        const body = { rows: o.rows, engine: o.engine, split: o.split, w: S.w || o.w || 1024, h: S.h || o.h || 1024, level: o.level, layer_res: o.layer_res, style: o.style, lighting: o.lighting, seed: o.seed,
          name: (o.mode === "layer" && o.layer ? o.layer.name : o.rows[0] && o.rows[0].name) || "design", auto: o.auto || 0 };
        if (o.mode === "split") body.image = E.flatten().toDataURL("image/png");
        if (o.mode === "layer") { if (!o.layer) throw new Error("pick the layer to split first"); const lp = layerPicture(o.layer); body.image = lp.url; o.cut = lp.cut; }
        say(o.mode === "layer" ? `🧩 splitting "${o.layer.name}" into ${o.rows.length} layers…` : o.mode === "split" ? `🧩 splitting the picture into ${o.rows.length} layers…` : `🧩 Ming is making the design${o.split ? " and its " + o.rows.length + " layers" : ""}…`);
        const r = await win.fetch("/api/ming", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), j = await r.json().catch(() => ({}));
        if (r.status === 409 && j.needs) { await needInstall(); return; }
        if (!r.ok || !j.job) throw new Error(j.error || "the job was refused");
        const id = j.job.id;
        for (;;) {
          await sleep(2000);
          if (stopIt) { try { await win.fetch("/api/jobs/" + encodeURIComponent(id) + "/cancel", { method: "POST" }); } catch (e) { /* gone */ } throw new Error("stopped"); }
          const jr = await win.fetch("/api/jobs/" + encodeURIComponent(id) + "?log_from=1000000"), jj = await jr.json().catch(() => ({}));
          if (jj.status === "done") { await bringIn(jj.outputs && jj.outputs.length ? jj.outputs : [jj.output].filter(Boolean), j.rows || o.rows, o); return; }
          if (jj.status === "failed" || jj.status === "cancelled" || !jr.ok) {
            let why = ""; try { const lg = (await (await win.fetch("/api/jobs/" + encodeURIComponent(id))).json()).log || []; why = String(lg.slice(-12).reverse().find((l) => /ERROR/.test(l)) || "").replace(/^.*ERROR:\s*/, ""); } catch (e) { /* the job went */ }
            throw new Error("Ming " + (jj.status || "went away") + (why ? ": " + why : ""));
          }
        }
      } finally { busy = false; }
    }
    /** the job's pictures into the editor: the layers in a 🧩 group (front on top), the flat design hidden below it */
    async function bringIn(outs, rows, o) {
      const P = sortOutputs(outs), name = "🧩 " + ((o.mode === "layer" && o.layer ? o.layer.name : rows[0] && rows[0].name) || "Ming");
      const flat = P.flat ? await loadImg(urlOf(P.flat)) : null, imgs = [];
      for (const n of P.layers) imgs.push(await loadImg(urlOf(n)));
      const first = flat || imgs[0]; if (!first) throw new Error("Ming made nothing");
      if (!S.w) E.openDoc(first.naturalWidth, first.naturalHeight, name.replace(/^🧩 /, ""), (g) => { if (flat) g.drawImage(flat, 0, 0); });
      // 3.13.0: a split layer's layers are cut to its own shape (what was transparent in it stays transparent)
      const draw = (L, im) => { const g = L.canvas.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, S.w, S.h);
        if (o.cut) { g.globalCompositeOperation = "destination-in"; g.drawImage(o.cut, 0, 0, S.w, S.h); g.globalCompositeOperation = "source-over"; } return L; };
      const src = o.mode === "layer" && o.layer && S.layers.includes(o.layer) ? o.layer : null;
      const base = S.layers.length === 1 && flat && o.mode !== "split" && S.layers[0].type === "pixel" && S.layers[0].ver === 0 ? S.layers[0] : null;
      E.structOp(imgs.length ? "🧩 Ming layers" : "🧩 Ming design", () => {
        let ref = src ? src.id : E.layer() ? E.layer().id : null;
        if (src && imgs.length) src.visible = false;                 // 3.13.0: the split layer stays, hidden below its layers
        if (flat && !base) { const F = draw(E.makeLayer(name + " (flat)"), flat); S.layers = E.D.insert(S.layers, F, ref, false); ref = F.id; if (imgs.length) F.visible = false; }
        if (base) { base.name = name + " (flat)"; if (imgs.length) base.visible = false; ref = base.id; }
        if (!imgs.length) return true;
        const G = E.makeLayer(name, S.w, S.h, "group"); S.layers = E.D.insert(S.layers, G, ref, false);
        let prev = null;
        for (let i = imgs.length - 1; i >= 0; i--) {               // the background first, the front on top
          const L = draw(E.makeLayer((rows[i] && rows[i].name) || "Layer " + (i + 1)), imgs[i]);
          S.layers = prev ? E.D.insert(S.layers, L, prev.id, false) : E.D.insert(S.layers, L, G.id, true); prev = L;
        }
        S.active = S.layers.indexOf(G);
        return true;
      });
      E.refresh(); E.renderLayersPanel();
      say(imgs.length ? `🧩 ${imgs.length} layers in "${name}"` + (imgs.length !== rows.length ? ` (you asked for ${rows.length} - the model gave ${imgs.length})` : "") + (flat ? " - the flat design is kept hidden below" : src ? ` - "${src.name}" is kept hidden below` : "")
        : `🧩 the design is in "${name} (flat)"`);
    }
    E.ui.addCmd("layer.ming", "🧩 Ming Layered Design…", "", () => dialog(), {}, ["Layer", "layer.newblend"]);
    E.ui.addCmd("layer.mingstop", "■ Stop Ming", "", () => { stopIt = true; say("🧩 stopping…"); }, { enabled: () => busy }, ["Layer", "layer.ming"]);
    // 3.13.0: Layer ▸ ✂ Split Layer Into Layers… and the icon-only ✂ at the bottom of the Layers panel
    E.ui.addCmd("layer.mingsplit", "✂ Split Layer Into Layers…", "", () => {
      if (!S.w) return say("✂ open a picture first");
      if (!splitLayer()) return say("✂ pick the layer to split in the Layers panel first");
      return dialog({ mode: "layer" });
    }, {}, ["Layer", "layer.ming"]);
    const bar = doc.querySelector(".kxlbtns"), del = doc.getElementById("kxLDel");
    if (bar && !doc.getElementById("kxLSplit")) {
      const bt = doc.createElement("button"); bt.className = "ghost"; bt.id = "kxLSplit"; bt.type = "button"; bt.textContent = "✂";
      bt.title = "Split this layer into layers (🧩 Ming-Image)"; bt.setAttribute("aria-label", bt.title);
      bt.onclick = () => E.ui.run("layer.mingsplit");
      bar.insertBefore(bt, del && del.parentNode === bar ? del : null);
    }
    E.ming = { dialog, run, bringIn, status, busy: () => busy, splitLayer };
  }

  const PCMing = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCMing;
  else root.PCMing = PCMing;
})(typeof window !== "undefined" ? window : globalThis);
