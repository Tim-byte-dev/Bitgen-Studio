/* pcsam.js — SEGMENT ANYTHING in the image editor + the picked layers -> the reference dock (2.390.0), window.PCSam.
 *
 * Tim (verbatim): "yes, please do these steps and maybe add sam to segment the image on the layer and add an option to
 * put segments on different layers" - the steps: layers as references (✨ Compose, imageedit.js), "mask the persons
 * head" from a prompt, PSD files (pcpsd.js), Generate in the prompt docker with the editor's layers.
 *
 *   OBJECT SELECTION TOOL (W)   click a thing = it is selected (Segment Anything finds its outline); Shift-click adds
 *                               another, Alt-click takes one away; drag a box around something = the thing in the box.
 *                               The options bar: the selection modes, Sample All Layers, and "Find" - words -> selection
 *   SELECT ▸ SUBJECT…           words ("the person's head", "dog, car") -> a selection, the active layer's MASK, or each
 *                               match on its own layer (CLIPSeg finds where, SAM draws the exact outline)
 *   LAYER ▸ SEGMENT LAYER…      everything in the layer (or only the words given) -> a layer per segment, in a group,
 *                               copied or cut out of the layer
 *   ✨ AI panel: 🎯 Select / ◐ Mask from the prompt box
 *   LAYER ▸ SEND TO REFERENCES  the picked layers (Ctrl-click; else the active one) into the reference dock - Generate
 *                               in the prompt docker (video or image) uses them
 *   SELECT ▸ SEGMENT ANYTHING SETTINGS…   install (venvs/segment), the SAM model, a checkpoint you already have
 * The server side is lib/segment.js + routes/segment.js; masks come back as PNGs (255 = the segment).
 * The pure parts (a mask picture -> a selection, the layer names) are tested in Node.
 */
(function (root) {
  "use strict";

  /** a mask picture's pixels (RGBA, the R channel) -> a selection (0..255) */
  function maskFromRGBA(data, n) {
    const m = new Uint8Array(n);
    for (let i = 0; i < n; i++) m[i] = data[i * 4] > 127 ? 255 : 0;
    return m;
  }
  /** a layer name for a segment: its label, unique among the names given */
  function segName(label, taken) {
    const raw = String(label || "Segment").replace(/\s+/g, " ").trim().slice(0, 40) || "Segment";
    const base = raw.charAt(0).toUpperCase() + raw.slice(1);
    let n = base, k = 2;
    while (taken.has(n)) n = `${base} (${k++})`;
    taken.add(n);
    return n;
  }

  function install(E) {
    const { S, P, D, doc, win, kx, $, say, store, newCanvas, ctx } = E;
    if (!E.ui || !E.ui.addCmd) return;
    const api = E.api || null;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    S.segAll = store.get("seg.all", false);
    let busy = false;

    /* ---------------- the server ---------------- */
    function source() {
      const L = E.layer();
      if (S.segAll || !L || L.type !== "pixel") return E.flatten();
      return L.canvas;
    }
    async function request(op, fields, src) {
      const c = src || source();
      const fd = new win.FormData();
      fd.append("image", await E.blobOf(c), "picture.png");
      fd.append("op", op);
      for (const [k, v] of Object.entries(fields || {})) if (v != null) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      const r = await win.fetch("/api/segment", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({ error: "the segment server did not answer" }));
      if (!r.ok) {
        if (r.status === 409) { say(j.error); settingsDialog(j.error); return null; }
        throw new Error(j.error || "refused");
      }
      return j;
    }
    /** a mask (its URL) -> a selection the picture's size */
    async function maskOf(url) {
      const im = await E.imgOf(url);
      const c = newCanvas(S.w, S.h), g = ctx(c);
      g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, S.w, S.h);
      return maskFromRGBA(g.getImageData(0, 0, S.w, S.h).data, S.w * S.h);
    }
    async function union(masks) {
      const u = new Uint8Array(S.w * S.h);
      for (const m of masks) { const a = await maskOf(m.url); for (let i = 0; i < u.length; i++) if (a[i]) u[i] = 255; }
      return u;
    }
    const feathered = (m) => { const f = S.selFeather || 0; return f > 0 ? P.feather(P.morph(m, S.w, S.h, Math.round(f / 2)), S.w, S.h, f) : m; };
    function applySel(m, mode, label) {
      const next = S.sel ? Uint8Array.from(S.sel) : new Uint8Array(S.w * S.h);
      E.changeSel(P.combine(next, feathered(m), mode), label);
    }
    async function guarded(what, f) {
      if (!S.w) return say("open a picture first");
      if (busy) return say("Segment Anything is still working on the last one");
      busy = true; kx.classList.add("segbusy"); say(what + " - Segment Anything is looking (the first time loads the model)…");
      try { return await f(); } catch (e) { say(what + " failed: " + e.message); return null; }
      finally { busy = false; kx.classList.remove("segbusy"); }
    }

    /* ---------------- words -> a selection / a mask / layers ---------------- */
    async function byWords(words, out, o) {
      const opt = o || {};
      return guarded(`"${words}"`, async () => {
        const j = await request("text", { prompt: words, threshold: opt.threshold, instances: out === "layers" || !!opt.instances, refine: opt.refine !== false });
        if (!j) return null;
        if (!j.masks.length) { say(`"${words}": nothing found - try other words or a lower threshold`); return j; }
        if (out === "layers") { await toLayers(j.masks, { cut: !!opt.cut, group: opt.group !== false, title: words }); return j; }
        const m = await union(j.masks);
        if (out === "mask") { await toMask(m, words); return j; }
        applySel(m, opt.mode || "replace", "select: " + words);
        say(`selected "${words}" (${j.masks.length} region${j.masks.length === 1 ? "" : "s"}) - ${j.note}${j.fake ? "" : ""} · Layer ▸ Layer Mask ▸ Reveal Selection makes it a mask`);
        return j;
      });
    }
    /** the active layer's mask = m (a new mask, or its mask painted over) */
    async function toMask(m, label) {
      const L = E.layer(); if (!L) return say("pick a layer first");
      if (!L.mask) { const keep = S.sel ? Uint8Array.from(S.sel) : null; E.setSel(m, true); E.addMask("selection"); E.setSel(keep || new Uint8Array(S.w * S.h), true); E.drawOverlay(); say(`"${label}" is now ${L.name}'s layer mask (white shows) - Alt-click the mask to see it`); return; }
      const copy = E.beginPx(L, "mask"), g = ctx(L.mask.canvas), id = g.createImageData(S.w, S.h);
      for (let i = 0; i < m.length; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = m[i]; id.data[i * 4 + 3] = 255; }
      g.putImageData(id, 0, 0);
      const px = E.endPx(L, copy, null, "mask: " + label, "mask"); if (px) E.push(px);
      E.refresh(); E.renderLayersPanel();
      say(`${L.name}'s layer mask now shows "${label}"`);
    }
    /** each mask -> its own layer (the source's pixels under it), in a group; cut = taken out of the source layer */
    async function toLayers(masks, o) {
      const src = E.layer();
      const fromLayer = !S.segAll && src && src.type === "pixel";
      const pix = fromLayer ? src.canvas : E.flatten();
      const taken = new Set(S.layers.map((x) => x.name));
      const made = [];
      for (const mk of masks) {
        const m = await maskOf(mk.url);
        const L = E.makeLayer(segName(mk.label, taken), S.w, S.h, "pixel");
        const g = ctx(L.canvas); g.drawImage(pix, 0, 0);
        const d = g.getImageData(0, 0, S.w, S.h);
        for (let i = 0; i < m.length; i++) d.data[i * 4 + 3] = Math.round(d.data[i * 4 + 3] * m[i] / 255);
        g.putImageData(d, 0, 0);
        made.push({ L, m });
      }
      if (!made.length) return say("no segment to make a layer of");
      const list = [];
      const before = E.snapStruct();
      let cutPx = null;
      if (o.cut && fromLayer) {
        const copy = E.beginPx(src, null), g = ctx(src.canvas), d = g.getImageData(0, 0, S.w, S.h);
        for (const { m } of made) for (let i = 0; i < m.length; i++) if (m[i]) d.data[i * 4 + 3] = Math.round(d.data[i * 4 + 3] * (255 - m[i]) / 255);
        g.putImageData(d, 0, 0);
        cutPx = E.endPx(src, copy, null, "cut the segments out", null);
      }
      let anchor = src ? src.id : null;
      if (o.group !== false) {
        const G = E.makeLayer(`Segments of ${fromLayer ? src.name : "the picture"}${o.title ? ` (${String(o.title).slice(0, 24)})` : ""}`, S.w, S.h, "group");
        S.layers = D.insert(S.layers, G, anchor, false);
        for (let k = made.length - 1; k >= 0; k--) S.layers = D.insert(S.layers, made[k].L, G.id, true);
        S.active = S.layers.indexOf(G);
      } else {
        for (let k = made.length - 1; k >= 0; k--) S.layers = D.insert(S.layers, made[k].L, anchor, false);
        S.active = S.layers.indexOf(made[0].L);
      }
      if (cutPx) list.push(cutPx);
      list.push({ t: "struct", before, after: E.snapStruct() });
      E.push({ t: "multi", list, label: `segment: ${made.length} layer(s)` });
      E.refresh(); E.renderLayersPanel();
      say(`${made.length} segment${made.length === 1 ? "" : "s"} on ${made.length === 1 ? "its own layer" : "their own layers"}${o.group !== false ? " in a group" : ""}${cutPx ? ", cut out of " + src.name : ""} - hide (👁) or move them one by one`);
    }

    /* ---------------- the Object Selection tool ---------------- */
    let box = null;
    E.tools.objsel = {
      id: "objsel", name: "Object Selection", cursor: "crosshair",
      options: () => ["replace", "add", "subtract", "intersect"].map((m) => `<button class="ghost kxsm${S.mode === m ? " on" : ""}" data-sm="${m}" title="${{ replace: "New selection", add: "Add (Shift-click)", subtract: "Subtract (Alt-click)", intersect: "Intersect (Shift+Alt)" }[m]}">${{ replace: "▢", add: "⊕", subtract: "⊖", intersect: "⊗" }[m]}</button>`).join("")
        + `<label title="Look at every visible layer, not only the active one"><input type="checkbox" id="pcSegAll" ${S.segAll ? "checked" : ""}> Sample All Layers</label>`
        + `<span class="sep"></span><label title="Words -> a selection: 'the person's head', 'dog, car'">Find <input type="text" id="pcSegWords" placeholder="the person's head" style="width:150px"></label>`
        + `<button class="ghost" id="pcSegFind" title="Select what the words say (Enter)">🎯 Select</button><button class="ghost" id="pcSegMask" title="Make it the active layer's mask">◐ Mask</button>`
        + `<span class="sep"></span><button class="ghost" id="pcSegSet" title="Segment Anything settings: install, model">⚙</button>`
        + `<span style="color:var(--pc-dim)">click = the thing under it · drag = the thing in the box</span>`,
      bindOptions(o) {
        o.querySelectorAll("[data-sm]").forEach((b) => { b.onclick = () => { S.mode = b.dataset.sm; E.renderOptions(); }; });
        o.querySelector("#pcSegAll").onchange = (e) => { S.segAll = e.target.checked; store.set("seg.all", S.segAll); };
        const w = o.querySelector("#pcSegWords");
        w.value = store.get("seg.words", "");
        w.onchange = () => store.set("seg.words", w.value);
        w.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") o.querySelector("#pcSegFind").click(); };
        o.querySelector("#pcSegFind").onclick = () => { if (w.value.trim()) byWords(w.value.trim(), "select", { mode: S.mode }); else say("type what to select first"); };
        o.querySelector("#pcSegMask").onclick = () => { if (w.value.trim()) byWords(w.value.trim(), "mask"); else say("type what to mask first"); };
        o.querySelector("#pcSegSet").onclick = () => settingsDialog();
      },
      down(e, fx, fy) { box = { x0: fx, y0: fy, x1: fx, y1: fy, mode: e.shiftKey && e.altKey ? "intersect" : e.shiftKey ? "add" : e.altKey ? "subtract" : S.mode }; },
      move(e, fx, fy) { if (box) { box.x1 = fx; box.y1 = fy; E.drawOverlay(); } },
      up(e, fx, fy) {
        const b = box; box = null; E.drawOverlay();
        if (!b) return;
        const dragged = Math.abs(fx - b.x0) * S.zoom > 6 || Math.abs(fy - b.y0) * S.zoom > 6;
        const f = dragged ? { box: [Math.min(b.x0, fx), Math.min(b.y0, fy), Math.max(b.x0, fx), Math.max(b.y0, fy)].map(Math.round) }
                          : { points: [[Math.round(fx), Math.round(fy), 1]] };
        guarded("object selection", async () => {
          const j = await request("points", f); if (!j || !j.masks.length) { if (j) say("nothing found there"); return; }
          applySel(await maskOf(j.masks[0].url), b.mode, "object selection");
          say(`object selected (${j.note}) - Shift-click adds another, Alt-click takes one away`);
        });
      },
    };
    E.overlayHooks.push((g, px) => {
      if (!box || S.tool !== "objsel") return;
      g.lineWidth = px; g.setLineDash([4 * px, 3 * px]); g.strokeStyle = "#fff";
      g.strokeRect(Math.min(box.x0, box.x1), Math.min(box.y0, box.y1), Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0));
    });

    /* ---------------- dialogs ---------------- */
    function subjectDialog() {
      const d = E.ui.dialog("Select Subject (Segment Anything)", `
        <div class="kxrow"><span>Find</span><input type="text" id="sdW" value="${esc(store.get("seg.words", ""))}" placeholder="the person's head" style="flex:1"></div>
        <div class="kxrow" style="color:var(--pc-dim)">a thing or a part of one: "head", "the woman's hair", "sky", "dog, car" (commas = several)</div>
        <div class="kxrow"><span>Into</span><select id="sdOut"><option value="select">a selection</option><option value="mask">the active layer's mask</option><option value="layers">each match on its own layer</option></select></div>
        <div class="kxrow"><label><input type="checkbox" id="sdAll" ${S.segAll ? "checked" : ""}> Sample All Layers</label>
          <label title="Each separate match its own selection region / layer"><input type="checkbox" id="sdEach"> each match separately</label></div>
        <div class="kxrow"><span title="How sure the words must be (lower = more is found)">Threshold</span><input type="range" id="sdThr" min="5" max="90" value="${Math.round(store.get("seg.thr", 0.35) * 100)}"><span id="sdThrV"></span></div>
        <div class="kxrow"><label title="SAM draws the exact outline of what the words found (off = the rough area only)"><input type="checkbox" id="sdRef" checked> exact outline (SAM)</label>
          <label title="With 'each match on its own layer': take them out of the layer"><input type="checkbox" id="sdCut"> cut out of the layer</label></div>`,
        (dd) => {
          const words = dd.querySelector("#sdW").value.trim(); if (!words) { say("type what to find"); return false; }
          store.set("seg.words", words); S.segAll = dd.querySelector("#sdAll").checked; store.set("seg.all", S.segAll);
          const thr = +dd.querySelector("#sdThr").value / 100; store.set("seg.thr", thr);
          byWords(words, dd.querySelector("#sdOut").value, { threshold: thr, instances: dd.querySelector("#sdEach").checked, refine: dd.querySelector("#sdRef").checked, cut: dd.querySelector("#sdCut").checked });
        }, { okLabel: "🎯 Find", init: (dd) => { const r = dd.querySelector("#sdThr"), v = dd.querySelector("#sdThrV"); const p = () => { v.textContent = (r.value / 100).toFixed(2); }; r.oninput = p; p(); } });
      return d;
    }
    function segmentDialog() {
      const L = E.layer();
      return E.ui.dialog("Segment Layer (Segment Anything)", `
        <div class="kxrow" style="color:var(--pc-dim)">${L && L.type === "pixel" && !S.segAll ? `the layer "${esc(L.name)}"` : "the whole picture (every visible layer)"} - every thing in it found by SAM</div>
        <div class="kxrow"><span>Only</span><input type="text" id="sgW" placeholder="(empty = everything) or: person, dog, car" style="flex:1"></div>
        <div class="kxrow"><span title="The most segments to keep (biggest first)">At most</span><input type="number" id="sgMax" min="1" max="256" value="${store.get("seg.max", 24)}">
          <span title="Smaller pieces are left out (% of the picture)">min size %</span><input type="number" id="sgMin" min="0" max="50" step="0.1" value="${store.get("seg.min", 0.5)}"></div>
        <div class="kxrow"><label><input type="checkbox" id="sgLayers" checked> each segment on its own layer</label></div>
        <div class="kxrow"><label><input type="checkbox" id="sgGroup" checked> in a group</label><label><input type="checkbox" id="sgCut"> cut out of the layer</label>
          <label><input type="checkbox" id="sgAll" ${S.segAll ? "checked" : ""}> Sample All Layers</label></div>
        <div class="kxrow" style="color:var(--pc-dim)">off = one selection of all of them</div>`,
        (dd) => {
          const words = dd.querySelector("#sgW").value.trim(), mx = +dd.querySelector("#sgMax").value || 24, mn = +dd.querySelector("#sgMin").value || 0;
          store.set("seg.max", mx); store.set("seg.min", mn); S.segAll = dd.querySelector("#sgAll").checked; store.set("seg.all", S.segAll);
          const asLayers = dd.querySelector("#sgLayers").checked, group = dd.querySelector("#sgGroup").checked, cut = dd.querySelector("#sgCut").checked;
          if (words) { byWords(words, asLayers ? "layers" : "select", { instances: true, cut, group }); return; }
          guarded("segment layer", async () => {
            const j = await request("auto", { max: mx, min_area: mn }); if (!j) return;
            if (!j.masks.length) return say("no segments found - lower the min size");
            if (asLayers) await toLayers(j.masks, { cut, group });
            else { applySel(await union(j.masks), "replace", "segments"); say(`${j.masks.length} segments selected`); }
          });
        }, { okLabel: "✂ Segment" });
    }
    let poll = null;
    async function settingsDialog(why) {
      let st = null; try { st = await (await win.fetch("/api/segment/status")).json(); } catch { st = null; }
      if (!st) return say("the segment status did not answer");
      const models = Object.entries(st.models).map(([k, m]) => `<option value="${k}"${k === st.model ? " selected" : ""}>${esc(m.label)} - ${esc(m.size)}${m.found ? " ✔ here" : ""}</option>`).join("");
      const d = E.ui.dialog("Segment Anything", `
        ${why ? `<div class="kxrow" style="color:#e0a030">${esc(why)}</div>` : ""}
        <div class="kxrow" style="color:var(--pc-dim)">Meta's Segment Anything + CLIPSeg (words), on this machine in their own venv (venvs/segment). ⬇ Install downloads them once (torch, ~2.5 GB with an NVIDIA card; the SAM model below); after that nothing goes online.</div>
        <div class="kxrow"><span>State</span><b id="ssState">${st.ready ? "ready" : st.venv_ready ? "installed - the model file is missing" : "not installed"}${st.server && st.server.running ? ` · running on ${esc(st.server.device || "…")}` : ""}</b></div>
        <div class="kxrow"><span>Model</span><select id="ssModel">${models}</select></div>
        <div class="kxrow"><span title="A SAM .pth you already have (ComfyUI's models/sams is looked in by itself)">Checkpoint</span><input type="text" id="ssCk" value="${esc(st.checkpoint_found ? st.checkpoint : "")}" placeholder="${esc(st.checkpoint)}" style="flex:1"></div>
        <div class="kxrow"><button class="ghost" id="ssInstall">⬇ Install / repair</button><label><input type="checkbox" id="ssCpu"> CPU only</label></div>
        <pre id="ssLog" style="max-height:160px;overflow:auto;font-size:11px;white-space:pre-wrap;margin:4px 0">${esc(((st.installing || {}).log || []).join("\n"))}</pre>`,
        (dd) => {
          const body = { model: dd.querySelector("#ssModel").value, checkpoint: dd.querySelector("#ssCk").value.trim() };
          win.fetch("/api/segment/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
            .then((r) => r.json()).then((j) => say(j.error ? j.error : `Segment Anything: ${j.models[j.model].label}${j.ready ? " ready" : " - not ready yet (⬇ Install)"}`));
        }, { okLabel: "Save", wide: true, cancel: () => { clearInterval(poll); poll = null; } });
      const paint = (s) => { d.querySelector("#ssLog").textContent = ((s.installing || {}).log || []).join("\n"); d.querySelector("#ssState").textContent = s.ready ? "ready" : (s.installing && s.installing.state === "running") ? "installing…" : s.installing && s.installing.state === "error" ? "the install failed: " + s.installing.error : "not installed"; };
      d.querySelector("#ssInstall").onclick = async () => {
        const r = await win.fetch("/api/segment/install", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: d.querySelector("#ssModel").value, device: d.querySelector("#ssCpu").checked ? "cpu" : "auto" }) });
        paint(await r.json());
        clearInterval(poll);
        poll = setInterval(async () => {
          if (!d.isConnected) { clearInterval(poll); poll = null; return; }
          let s = null; try { s = await (await win.fetch("/api/segment/status")).json(); } catch { return; }
          paint(s); if (!s.installing || s.installing.state !== "running") { clearInterval(poll); poll = null; }
        }, 2000);
      };
      return d;
    }

    /* ---------------- → References ---------------- */
    async function sendToRefs() {
      if (!S.w) return say("open a picture first");
      if (!api || !api.toRefs) return say("the reference dock is not connected (reload the page)");
      const list = (E.picked ? E.picked() : []);
      const ls = list.length ? list : [E.layer()].filter(Boolean);
      const items = [];
      for (const L of ls) items.push({ blob: await E.blobOf(E.onWhite(E.layerPicture(L), 2, L !== ls[0] || ls.length > 1)), name: `${String(L.name).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 40) || "layer"}.png` });
      const n = api.toRefs(items);
      say(`${n} layer${n === 1 ? "" : "s"} in the reference dock (Image tab) - Generate in the prompt docker uses ${n === 1 ? "it" : "them"} as <Picture n>`);
    }

    /* ---------------- commands + menus + the ✨ AI panel ---------------- */
    const docOpen = () => !!S.w, hasL = () => !!(S.w && E.layer());
    const add = E.ui.addCmd;
    add("sel.subject", "Subject…", "", () => subjectDialog(), { enabled: docOpen }, ["Select", "sel.range"]);
    add("sel.objsel", "Object Selection Tool", "", () => E.setTool("objsel"), { enabled: docOpen }, ["Select", "sel.subject"]);
    add("sel.segset", "Segment Anything Settings…", "", () => settingsDialog(), {}, ["Select", null, true]);
    add("layer.segment", "Segment Layer…", "", () => segmentDialog(), { enabled: hasL }, ["Layer", "layer.del", true]);
    add("layer.torefs", "Send to References (Prompt Docker)", "", () => sendToRefs(), { enabled: hasL }, ["Layer", "layer.segment"]);
    add("layer.picksclear", "Un-pick Layers", "", () => E.clearPicks && E.clearPicks(), { enabled: () => !!(S.picks && S.picks.length) }, ["Layer", "layer.torefs"]);

    const run = $("kxRun");
    if (run && !$("kxSegRow")) {
      const row = doc.createElement("div"); row.className = "kxrow"; row.id = "kxSegRow";
      row.title = "Segment Anything: the prompt box's words -> a selection, or the active layer's mask (\"the person's head\")";
      row.innerHTML = `<button class="ghost" id="kxSegSel">🎯 Select from prompt</button><button class="ghost" id="kxSegMask">◐ Mask from prompt</button>`;
      run.parentNode.insertBefore(row, run.nextSibling);
      const words = () => $("iePrompt").value.trim();
      $("kxSegSel").onclick = () => (words() ? byWords(words(), "select") : say("write what to select in the prompt box (\"the person's head\")"));
      $("kxSegMask").onclick = () => (words() ? byWords(words(), "mask") : say("write what to mask in the prompt box (\"the person's head\")"));
    }
    if ($("kxPicksRefs")) $("kxPicksRefs").onclick = () => sendToRefs();
    if ($("kxPicksClear")) $("kxPicksClear").onclick = () => E.clearPicks && E.clearPicks();
    const paintPicks = () => {
      const t = $("kxPicksTxt"); if (!t) return;
      const p = E.picked ? E.picked() : [];
      t.textContent = p.length ? p.map((L, k) => `${k + 1} ${L.name}`).join(" · ") : "Ctrl-click layers to pick them (1 = the scene)";
    };
    if (E.togglePick) { const tp = E.togglePick; E.togglePick = (Ly) => { tp(Ly); paintPicks(); }; }
    if (E.clearPicks) { const cp = E.clearPicks; E.clearPicks = () => { cp(); paintPicks(); }; }

    Object.assign(E, { segRequest: request, segByWords: byWords, segToLayers: toLayers, segToMask: toMask, segSettings: settingsDialog,
                       segSubject: subjectDialog, segLayer: segmentDialog, sendToRefs, segBusy: () => busy });
  }

  const api = { install, maskFromRGBA, segName };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCSam = api;
})(typeof window !== "undefined" ? window : globalThis);
