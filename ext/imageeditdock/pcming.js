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
 *   🖥 This computer (Settings ▸ Add-ons ▸ 🧩 Ming layered design - its Download box opens when it is missing) or ☁ OpenRouter
 *   (your key; Ming 0.1 Design + Design-Layer are free there - 0.2 is used when OpenRouter has it).
 *   POST /api/ming (routes/ming.js) -> a job (misc/ming_worker.py) -> its outputs.
 * Pure (Node: scripts/test-3900.js): DEFAULT_ROWS, check, sortOutputs.
 */
(function (root) {
  "use strict";
  const DEFAULT_ROWS = [
    { name: "Headline", desc: "The title text \"YOUR TITLE\" in bold white sans-serif, centred near the top", where: "top" },
    { name: "Subject", desc: "The main subject or product, large and centred", where: "centre" },
    { name: "Background", desc: "A soft gradient background", where: "all" },
  ];
  /** the dialog's values checked -> "" (fine) | what is wrong (pure) */
  function check(o) {
    const rows = (o.rows || []).filter((r) => (r.name || "").trim() || (r.desc || "").trim());
    if (!rows.length) return "add at least one layer - its name and what goes in it";
    if (rows.length > 12) return "12 layers at most";
    if (o.mode === "split" && rows.length < 2) return "splitting a picture needs at least two layers (the front ones and the background)";
    if (o.mode === "split" && !o.hasPicture) return "open a picture to split first (or ✨ Make a design)";
    return "";
  }
  /** a job's outputs -> {flat, layers (front first)} (pure) */
  function sortOutputs(outs) {
    const L = [], flat = [];
    for (const n of outs || []) { const m = /_ming_L(\d\d)_/.exec(String(n)); if (m) L.push([+m[1], n]); else if (/\.png$/i.test(n)) flat.push(n); }
    return { flat: flat[0] || null, layers: L.sort((a, b) => a[0] - b[0]).map((x) => x[1]) };
  }
  const pure = { DEFAULT_ROWS, check, sortOutputs };

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

    async function dialog() {
      if (busy) return say("🧩 Ming is working - ■ Stop Ming in the Layer menu");
      const st = (await status()) || { local: {}, openrouter: {}, where: { all: "Whole canvas" } };
      const where = st.where || { all: "Whole canvas" }, eng = store.get("ming.engine", st.local && st.local.ready ? "local" : st.openrouter && st.openrouter.key ? "openrouter" : "local");
      const mode = S.w && store.get("ming.mode", "make") === "split" ? "split" : "make";
      const loc = st.local || {}, orr = st.openrouter || {};
      const html = `<div class="kxrow" style="flex-wrap:wrap;gap:4px 16px">
          <label><input type="radio" name="pmMode" value="make"${mode === "make" ? " checked" : ""}> ✨ Make a design from these layers</label>
          <label title="${S.w ? "The picture that is open (every visible layer)" : "Open a picture first"}"><input type="radio" name="pmMode" value="split"${mode === "split" ? " checked" : ""}${S.w ? "" : " disabled"}> ✂ Split the open picture into these layers</label></div>
        <div style="color:var(--pc-dim);margin:4px 0 2px">Layers - the <b>front</b> at the top, the background last (as in the Layers panel):</div>
        <div id="pmRows">${kept().map((r) => rowHtml(r, where)).join("")}</div>
        <div class="kxrow"><button type="button" class="ghost" id="pmAdd">＋ Add layer</button><label style="margin-left:auto" title="Untick for the one flat picture"><input type="checkbox" id="pmSplit"${store.get("ming.split", true) !== false ? " checked" : ""}> Separate layers</label></div>
        <div class="pmMake kxrow" style="flex-wrap:wrap;gap:4px 10px"><label style="flex:1;min-width:260px">Style <input type="text" id="pmStyle" style="width:100%" placeholder="e.g. flat vector poster, bold colours, crisp typography" value="${esc(store.get("ming.style", ""))}"></label>
          <label style="flex:1;min-width:200px">Lighting <input type="text" id="pmLight" style="width:100%" placeholder="e.g. soft daylight from the left" value="${esc(store.get("ming.light", ""))}"></label></div>
        <div class="kxrow" style="flex-wrap:wrap;gap:4px 14px">
          <label class="pmMake">Size <select id="pmLevel"><option value="1024">~1 MP (faster)</option><option value="2048"${store.get("ming.level", "1024") === "2048" ? " selected" : ""}>~4 MP (2K)</option></select></label>
          <label>Layers at <select id="pmRes"><option value="1024">1024</option><option value="512"${store.get("ming.res", "1024") === "512" ? " selected" : ""}>512 (faster)</option></select></label>
          <label>Seed <input type="number" id="pmSeed" min="0" style="width:90px" value="${esc(store.get("ming.seed", "42"))}"></label></div>
        <div class="kxrow" style="flex-wrap:wrap;gap:4px 16px;margin-top:4px">
          <label title="${esc(loc.note || "")}"><input type="radio" name="pmEng" value="local"${eng === "local" ? " checked" : ""}> 🖥 This computer ${loc.ready ? "✓" : "(not installed - its Download box opens)"}</label>
          <label><select id="pmGpus" title="The language model spread over every NVIDIA card (5090 + 3090 = 56 GB), or the first card only"><option value="all">all cards</option><option value="1"${store.get("ming.gpus", "all") === "1" ? " selected" : ""}>first card only</option></select></label>
          <label title="Ming 0.1 Design + Design-Layer are free on OpenRouter (0.2 is used when OpenRouter has it)"><input type="radio" name="pmEng" value="openrouter"${eng === "openrouter" ? " checked" : ""}> ☁ OpenRouter ${orr.key ? "✓" : "(needs your key - 🖥 GPU ▸ Remote generation)"}</label></div>
        <div style="color:var(--pc-dim);margin-top:6px">Ming-Image-0.2-Design draws the design from the list; Ming-Image-0.1-Design-Layer splits it into your layers (transparent, each named as here). inclusionAI ran them on one 80 GB card - here the language model is spread over all your cards; with less memory use ☁ OpenRouter.</div>
        <div id="pmMsg" style="color:#e88;min-height:1em"></div>`;
      E.ui.dialog("🧩 Ming Layered Design", html, (d) => {
        const v = (id) => d.querySelector("#" + id), m = (d.querySelector('input[name="pmMode"]:checked') || {}).value || "make";
        const o = { mode: m, rows: readRows(d), hasPicture: !!S.w };
        const bad = check(o); if (bad) { v("pmMsg").textContent = "⚠ " + bad; return false; }
        const e = (d.querySelector('input[name="pmEng"]:checked') || {}).value || "local";
        store.set("ming.rows", JSON.stringify(o.rows)); store.set("ming.mode", m); store.set("ming.engine", e); store.set("ming.split", v("pmSplit").checked);
        store.set("ming.style", v("pmStyle").value); store.set("ming.light", v("pmLight").value); store.set("ming.level", v("pmLevel").value); store.set("ming.res", v("pmRes").value);
        store.set("ming.seed", v("pmSeed").value); store.set("ming.gpus", v("pmGpus").value);
        run({ mode: m, rows: o.rows, engine: e, split: m === "split" || v("pmSplit").checked, style: v("pmStyle").value, lighting: v("pmLight").value,
          level: +v("pmLevel").value, layer_res: +v("pmRes").value, seed: v("pmSeed").value, gpus: v("pmGpus").value === "1" ? "1" : "all" }).catch((er) => say("🧩 " + er.message));
        return true;
      }, { okLabel: "🧩 Go", wide: true, width: "880px", scroll: true, init: (d) => {
        const box = d.querySelector("#pmRows"), paintMode = () => { const mk = (d.querySelector('input[name="pmMode"]:checked') || {}).value !== "split"; d.querySelectorAll(".pmMake").forEach((x) => { x.style.display = mk ? "" : "none"; }); };
        d.querySelector("#pmAdd").onclick = () => { if (box.querySelectorAll(".pmrow").length >= (st.max || 12)) return; const t = doc.createElement("div"); t.innerHTML = rowHtml({ name: "", desc: "", where: "all" }, where); const r = t.firstElementChild; const last = box.lastElementChild; box.insertBefore(r, last && /background/i.test(last.querySelector(".pmName").value) ? last : null); r.querySelector(".pmName").focus(); };
        box.addEventListener("click", (ev) => {
          const r = ev.target.closest(".pmrow"); if (!r) return;
          if (ev.target.closest(".pmX")) r.remove();
          else if (ev.target.closest(".pmUp") && r.previousElementSibling) box.insertBefore(r, r.previousElementSibling);
          else if (ev.target.closest(".pmDn") && r.nextElementSibling) box.insertBefore(r.nextElementSibling, r);
        });
        d.querySelectorAll('input[name="pmMode"]').forEach((x) => x.addEventListener("change", paintMode)); paintMode();
      } });
    }

    async function needInstall() {
      const A = root.H3Addons;
      if (A && A.act) { try { if (A.refresh) await A.refresh(); } catch (e) { /* the list */ } A.act("ming", "install"); }
      say("🧩 Ming needs its add-on (Ming-Image) on this computer - its Download box is open (tick the models); or pick ☁ OpenRouter");
    }
    async function run(o) {
      busy = true; stopIt = false;
      try {
        const body = { rows: o.rows, engine: o.engine, split: o.split, w: S.w || 1024, h: S.h || 1024, level: o.level, layer_res: o.layer_res, style: o.style, lighting: o.lighting, seed: o.seed, gpus: o.gpus,
          name: (o.rows[0] && o.rows[0].name) || "design" };
        if (o.mode === "split") body.image = E.flatten().toDataURL("image/png");
        say(o.mode === "split" ? `🧩 splitting the picture into ${o.rows.length} layers…` : `🧩 Ming is making the design${o.split ? " and its " + o.rows.length + " layers" : ""}…`);
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
      const P = sortOutputs(outs), name = "🧩 " + ((rows[0] && rows[0].name) || "Ming");
      const flat = P.flat ? await loadImg(urlOf(P.flat)) : null, imgs = [];
      for (const n of P.layers) imgs.push(await loadImg(urlOf(n)));
      const first = flat || imgs[0]; if (!first) throw new Error("Ming made nothing");
      if (!S.w) E.openDoc(first.naturalWidth, first.naturalHeight, name.replace(/^🧩 /, ""), (g) => { if (flat) g.drawImage(flat, 0, 0); });
      const draw = (L, im) => { const g = L.canvas.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, S.w, S.h); return L; };
      const base = S.layers.length === 1 && flat && o.mode !== "split" && S.layers[0].type === "pixel" && S.layers[0].ver === 0 ? S.layers[0] : null;
      E.structOp(imgs.length ? "🧩 Ming layers" : "🧩 Ming design", () => {
        let ref = E.layer() ? E.layer().id : null;
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
      say(imgs.length ? `🧩 ${imgs.length} layers in "${name}"` + (imgs.length !== rows.length ? ` (you asked for ${rows.length} - the model gave ${imgs.length})` : "") + (flat ? " - the flat design is kept hidden below" : "")
        : `🧩 the design is in "${name} (flat)"`);
    }
    E.ui.addCmd("layer.ming", "🧩 Ming Layered Design…", "", () => dialog(), {}, ["Layer", "layer.newblend"]);
    E.ui.addCmd("layer.mingstop", "■ Stop Ming", "", () => { stopIt = true; say("🧩 stopping…"); }, { enabled: () => busy }, ["Layer", "layer.ming"]);
    E.ming = { dialog, run, bringIn, status, busy: () => busy };
  }

  const PCMing = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCMing;
  else root.PCMing = PCMing;
})(typeof window !== "undefined" ? window : globalThis);
