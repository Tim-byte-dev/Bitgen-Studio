/* pcactionsx.js — MORE ACTIONS (2.468.0), window.PCActionsX: recorded BRUSH STROKES and HAND-MADE SELECTIONS,
 * CONDITIONAL steps, File ▸ Scripts ▸ IMAGE PROCESSOR, DROPLETS. The Actions panel itself is pcactions.js (E.actions).
 *
 * Tim (verbatim): "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor"
 * - the gap row "recording brush strokes / hand-made selections, droplets, Image Processor, conditional steps".
 *
 *   STROKE     while recording, a stroke of the Brush / Eraser / Pencil / any brush tool is a step {tool, pts (0..1 of
 *              the picture), size, preset, opacity, flow, fg, bg, w, h}; played, it is drawn again at the same place on
 *              the picture it plays on (its size scaled with the picture)
 *   SEL        a selection made by hand (marquee, lasso, wand, quick selection, quick mask ...) is a step: its outline as
 *              a path (0..1 of the picture) - played, the same selection on any picture size
 *   COND       Insert Conditional…: If <the document is landscape / portrait / square, there is a selection / none, the
 *              layer is a pixel / text / shape / adjustment layer, there are several layers> play one action, else another
 *   IMAGE PROCESSOR   pictures (files or a folder) -> each opened, an action played (or not), saved as JPEG (quality,
 *              resize to fit W x H) and / or PNG (resize to fit) - to the project's batch folder or downloaded
 *   DROPLETS   Automate: Create Droplet…: an action + where its pictures go, kept as a tile in the Actions panel - drop
 *              pictures on it (or click it) and they are processed (the Batch)
 *
 * Pure (Node: scripts/test-actionsx.js): rel / abs (points 0..1), thin (points no closer than a step), CONDS + condOf
 * (a test against the document's facts), normPath / scalePath (a path 0..1 <-> px), fitSize.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const rel = (pts, w, h) => pts.map(([x, y]) => [Math.round(x / w * 1e5) / 1e5, Math.round(y / h * 1e5) / 1e5]);
  const abs = (pts, w, h) => pts.map(([x, y]) => [x * w, y * h]);
  /** points no closer than d (the last always kept), at most max */
  function thin(pts, d, max) {
    if (pts.length < 3) return pts.slice();
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) { const l = out[out.length - 1]; if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= d) out.push(pts[i]); }
    out.push(pts[pts.length - 1]);
    if (max && out.length > max) { const k = out.length / max, o2 = []; for (let i = 0; i < max - 1; i++) o2.push(out[Math.floor(i * k)]); o2.push(out[out.length - 1]); return o2; }
    return out;
  }
  const CONDS = [["landscape", "the document is landscape"], ["portrait", "the document is portrait"], ["square", "the document is square"], ["sel", "there is a selection"], ["nosel", "there is no selection"],
    ["pixel", "the layer is a pixel layer"], ["text", "the layer is a text layer"], ["shape", "the layer is a shape layer"], ["adjust", "the layer is an adjustment layer"], ["many", "there are several layers"]];
  /** facts {w, h, sel (bool), type, layers} -> does the test hold */
  function condOf(test, f) {
    switch (test) {
      case "landscape": return f.w > f.h;
      case "portrait": return f.h > f.w;
      case "square": return f.w === f.h;
      case "sel": return !!f.sel;
      case "nosel": return !f.sel;
      case "pixel": case "text": case "shape": case "adjust": return f.type === test;
      case "many": return f.layers > 1;
    }
    return false;
  }
  const mapPath = (p, f) => ({ subs: (p.subs || []).map((s) => Object.assign({}, s, { pts: s.pts.map((a) => { const [x, y] = f(a.x, a.y), [ix, iy] = f(a.ix, a.iy), [ox, oy] = f(a.ox, a.oy); return Object.assign({}, a, { x, y, ix, iy, ox, oy }); }) })) });
  const r5 = (v) => Math.round(v * 1e5) / 1e5;
  const normPath = (p, w, h) => mapPath(p, (x, y) => [r5(x / w), r5(y / h)]);
  const scalePath = (p, w, h) => mapPath(p, (x, y) => [x * w, y * h]);
  /** w x h fitted inside W x H (never larger) */
  function fitSize(w, h, W, H) { if (!(W > 0) && !(H > 0)) return [w, h]; const k = Math.min(W > 0 ? W / w : Infinity, H > 0 ? H / h : Infinity, 1); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; }
  const pure = { rel, abs, thin, CONDS, condOf, normPath, scalePath, fitSize };

  /* ================================ the editor ================================ */
  function install(E) {
    const { S, doc, say, store } = E, A = E.actions;
    if (!A || !E.ui || !E.ui.addCmd || !E.stage) return;
    const win = doc.defaultView || root, stage = E.stage;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const tick = (ms) => new Promise((r) => win.setTimeout(r, ms || 0));
    const docPos = (e) => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left - S.panX) / S.zoom, (e.clientY - r.top - S.panY) / S.zoom]; };
    const SEL_TOOLS = new Set(["qsel", "brush"]);
    const strokeTool = (t) => t === "paint" || t === "erase" || (!!E.tools[t] && !!E.tools[t].brush && !SEL_TOOLS.has(t));

    /* ---------------- recording: brush strokes ---------------- */
    let cur = null;
    stage.addEventListener("pointerdown", (e) => {
      if (!A.recording() || A.playing() || !S.w || e.button !== 0 || S.space || !strokeTool(S.tool)) return;
      if ((S.tool === "paint" || S.tool === "erase") && (e.altKey || e.ctrlKey || e.metaKey)) return;        // picking a colour
      cur = { tool: S.tool, pts: [docPos(e)], set: { preset: S.preset, size: S.size, opacity: S.opacity, flow: S.flow, fg: S.fg, bg: S.bg }, w: S.w, h: S.h };
    }, true);
    stage.addEventListener("pointermove", (e) => { if (cur && (e.buttons & 1)) cur.pts.push(docPos(e)); }, true);
    const endRec = (e) => {
      if (!cur) return; const c = cur; cur = null;
      if (e && e.clientX != null) c.pts.push(docPos(e));
      const pts = thin(c.pts, 1, 600);
      const name = c.tool === "paint" ? "Brush" : c.tool === "erase" ? "Eraser" : (E.tools[c.tool] && E.tools[c.tool].name) || c.tool;
      A.record(Object.assign({ kind: "stroke", tool: c.tool, label: name + " Stroke", pts: rel(pts, c.w, c.h), w: c.w, h: c.h }, c.set));
    };
    stage.addEventListener("pointerup", endRec, true); stage.addEventListener("pointercancel", endRec, true);

    /* ---------------- recording: hand-made selections (every selection step that is no command's) ---------------- */
    const basePush = E.onPush;
    E.onPush = (entry) => {
      if (basePush) basePush(entry);
      if (!entry || entry.t !== "sel" || !A.recording() || A.playing() || A.inCmd() || A.dialogsOpen()) return;
      const Q = root.PCPath, m = entry.after; if (!Q || !m) return;
      let n = 0; for (let i = 0; i < m.length; i++) if (m[i] > 127) { n = 1; break; }
      const path = n ? Q.fromMask(m, S.w, S.h, 0.75, 2) : { subs: [] };
      A.record({ kind: "sel", path: normPath(path, S.w, S.h), how: String(entry.label || "by hand").slice(0, 40) });
    };

    /* ---------------- playing ---------------- */
    A.addKind("stroke", async (st) => {
      if (!S.w) throw new Error("no picture");
      const keep = { tool: S.tool, preset: S.preset, size: S.size, opacity: S.opacity, flow: S.flow, fg: S.fg, bg: S.bg };
      const k = st.w && st.h ? Math.min(S.w / st.w, S.h / st.h) : 1, pts = abs(st.pts, S.w, S.h);
      const cap = stage.setPointerCapture;
      const fe = { button: 0, buttons: 1, pressure: 0.5, pointerType: "mouse", pointerId: 1, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {} };
      try {
        stage.setPointerCapture = () => {};
        if (E.tools[st.tool] || st.tool === "paint" || st.tool === "erase") E.setTool(st.tool); else throw new Error("no " + st.tool + " tool here");
        if (st.preset != null) S.preset = st.preset;
        S.size = Math.max(1, (+st.size || S.size) * k); if (st.opacity != null) S.opacity = st.opacity; if (st.flow != null) S.flow = st.flow; if (st.fg) S.fg = st.fg; if (st.bg) S.bg = st.bg;
        const [x0, y0] = pts[0], last = pts[pts.length - 1];
        if (st.tool === "paint" || st.tool === "erase") {
          if (E.beginStroke(fe, x0, y0) === false) throw new Error("nothing to paint on (no pixel layer)");
          for (const [x, y] of pts.slice(1)) S.stroke.add(x, y, 0.5);
          E.endStroke(last[0], last[1]);
        } else {
          const T = E.tools[st.tool]; S.drag = { ext: T };
          if (T.down(fe, x0, y0) === false) S.drag = null;
          else { for (const [x, y] of pts.slice(1)) if (T.move) T.move(fe, x, y); if (T.up) T.up(fe, last[0], last[1]); S.drag = null; }
        }
      } finally {
        stage.setPointerCapture = cap; S.drag = null;
        S.preset = keep.preset; S.size = keep.size; S.opacity = keep.opacity; S.flow = keep.flow; S.fg = keep.fg; S.bg = keep.bg;
        E.setTool(keep.tool); E.refresh(); E.renderLayersPanel();
      }
      await tick(0);
    });
    A.addKind("sel", async (st) => {
      if (!S.w) throw new Error("no picture");
      if (!st.path.subs.length) { E.changeSel(new Uint8Array(S.w * S.h), "deselect"); return; }
      const Q = root.PCPath, m = Q.areaMask(scalePath(st.path, S.w, S.h), S.w, S.h, E.cv);
      E.changeSel(m, "set selection");
    });
    let depth = 0;
    const facts = () => { const L = E.layer(); return { w: S.w, h: S.h, sel: E.hasSel(), type: L ? L.type : "", layers: S.layers.length }; };
    A.addKind("cond", async (st) => {
      if (!S.w) throw new Error("no picture");
      const which = condOf(st.test, facts()) ? st.then : st.else;
      if (!which) return;
      const a = A.find(which[0], which[1]); if (!a) throw new Error(`no action "${which.join(" ▸ ")}"`);
      if (depth > 6) throw new Error("conditionals call each other too deep");
      depth++;
      try { for (const s2 of a.steps) if (s2.on !== false) await A.runStep(s2); } finally { depth--; }
    });

    /* ---------------- Insert Conditional… ---------------- */
    const allActs = () => A.sets().flatMap((s) => s.actions.map((a) => [s.name, a.name]));
    function dlgCond(st0) {
      const c = A.current(); if (!c.action && !st0) return say("pick an action first");
      const acts = allActs(), opt = (sel) => `<option value="">None</option>` + acts.map(([s, a]) => { const v = JSON.stringify([s, a]); return `<option value="${esc(v)}"${sel && JSON.stringify(sel) === v ? " selected" : ""}>${esc(s + " ▸ " + a)}</option>`; }).join("");
      E.ui.dialog("Conditional Action", `<div class="rw"><span>If</span><select id="cdT" style="grid-column:2/4">${CONDS.map(([k, n]) => `<option value="${k}"${st0 && st0.test === k ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
        <div class="rw"><span>Then play</span><select id="cdA" style="grid-column:2/4">${opt(st0 && st0.then)}</select></div>
        <div class="rw"><span>Else play</span><select id="cdB" style="grid-column:2/4">${opt(st0 && st0.else)}</select></div>`, (d) => {
        const v = (id) => { const x = d.querySelector(id).value; return x ? JSON.parse(x) : null; };
        const st = { kind: "cond", test: d.querySelector("#cdT").value, then: v("#cdA"), else: v("#cdB") };
        if (!st.then && !st.else) { say("pick an action to play"); return false; }
        if (st0) { Object.assign(st0, st); A.setSets(A.sets()); } else A.insert(st);
      }, { okLabel: st0 ? "OK" : "Insert" });
    }

    /* ---------------- Image Processor ---------------- */
    const loadImg = (file) => new Promise((ok, no) => { const u = URL.createObjectURL(file), im = new win.Image(); im.onload = () => { ok(im); win.setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error("not a picture the browser can read")); }; im.src = u; });
    const baseName = (n) => String(n || "picture").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^\w .()-]+/g, "_").slice(0, 90);
    async function processImages(o) {
      const rep = { done: 0, errors: [], saved: [] };
      for (const f of o.files) {
        let opened = null;
        try {
          const img = await loadImg(f); E.openImage(img, f.name); opened = E.docs ? E.docs.live() : null; await tick(30);
          if (o.action) { const r = await A.play(o.action, 0, true); if (!r.ok) throw new Error(r.error); }
          const src = E.flatten();
          for (const fmt of o.formats) {
            const [w, h] = fmt.fit ? fitSize(src.width, src.height, fmt.W, fmt.H) : [src.width, src.height];
            const c = doc.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
            if (fmt.kind === "jpg") { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); }        // JPEG has no transparency
            g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, w, h);
            const blob = await new Promise((ok) => c.toBlob(ok, fmt.kind === "jpg" ? "image/jpeg" : "image/png", (fmt.quality || 10) / 12));
            const name = baseName(f.name) + "." + fmt.kind;
            if (o.dest === "project") {
              const res = await win.fetch(`/api/batch/save?run=${encodeURIComponent(o.run + "-" + (fmt.kind === "jpg" ? "JPEG" : "PNG"))}&name=${encodeURIComponent(name)}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob });
              const j = await res.json(); if (!res.ok) throw new Error(j.error || "the save was refused"); rep.saved.push(j.run + "/" + j.name);
            } else { const a = doc.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click(); win.setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); rep.saved.push(name); }
          }
          rep.done++;
        } catch (e) { rep.errors.push(`${f.name}: ${e.message}`); }
        if (opened && E.docs && E.docs.live() === opened) E.docs.closeNow(opened);
      }
      say(`Image Processor: ${rep.done} of ${o.files.length} picture(s), ${rep.saved.length} file(s) saved${rep.errors.length ? ", " + rep.errors.length + " error(s)" : ""}`);
      E.processorReport = rep;
      return rep;
    }
    function dlgProcessor() {
      const acts = allActs();
      const d = E.ui.dialog("Image Processor", `<div class="rw"><span>1 Pictures</span><button class="ghost" id="ipFiles">Choose files…</button><button class="ghost" id="ipFolder">Choose a folder…</button></div>
        <div class="rw"><span></span><span id="ipN" style="grid-column:2/4;color:var(--pc-dim)">no pictures picked</span></div>
        <div class="rw"><span>2 Where</span><select id="ipD" style="grid-column:2/4"><option value="project" selected>Project folder (batch/&lt;name&gt;-JPEG, -PNG)</option><option value="download">Download each</option></select></div>
        <div class="rw"><span>Name</span><input type="text" id="ipR" value="processed-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}" style="grid-column:2/4"></div>
        <div class="rw"><span>3 JPEG</span><label><input type="checkbox" id="ipJ" checked> Save as JPEG</label><label>Quality <input type="number" id="ipQ" min="1" max="12" value="8" style="width:46px"></label></div>
        <div class="rw"><span></span><label><input type="checkbox" id="ipJR"> Resize to fit</label><label>W <input type="number" id="ipJW" min="1" value="1920" style="width:64px"></label><label>H <input type="number" id="ipJH" min="1" value="1080" style="width:64px"></label></div>
        <div class="rw"><span>PNG</span><label><input type="checkbox" id="ipP"> Save as PNG</label></div>
        <div class="rw"><span></span><label><input type="checkbox" id="ipPR"> Resize to fit</label><label>W <input type="number" id="ipPW" min="1" value="1024" style="width:64px"></label><label>H <input type="number" id="ipPH" min="1" value="1024" style="width:64px"></label></div>
        <div class="rw"><span>4 Action</span><select id="ipA" style="grid-column:2/4"><option value="">None</option>${acts.map(([s, a]) => `<option value="${esc(JSON.stringify([s, a]))}">${esc(s + " ▸ " + a)}</option>`).join("")}</select></div>`, (dd) => {
        const files = dd.__files || []; if (!files.length) { say("pick the pictures first (files or a folder)"); return false; }
        const q = (id) => dd.querySelector(id), formats = [];
        if (q("#ipJ").checked) formats.push({ kind: "jpg", quality: Math.max(1, Math.min(12, +q("#ipQ").value || 8)), fit: q("#ipJR").checked, W: +q("#ipJW").value, H: +q("#ipJH").value });
        if (q("#ipP").checked) formats.push({ kind: "png", fit: q("#ipPR").checked, W: +q("#ipPW").value, H: +q("#ipPH").value });
        if (!formats.length) { say("tick JPEG and / or PNG"); return false; }
        const av = q("#ipA").value, act = av ? A.find(...JSON.parse(av)) : null;
        processImages({ files, formats, action: act, dest: q("#ipD").value, run: q("#ipR").value.trim() || "processed" });
      }, { okLabel: "▶ Run", wide: true });
      const pick = (dir) => {
        const inp = doc.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = "image/*"; if (dir) { inp.webkitdirectory = true; inp.setAttribute("webkitdirectory", ""); }
        inp.style.display = "none"; E.kx.appendChild(inp);
        inp.onchange = () => { d.__setFiles([...(inp.files || [])].filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|jxl)$/i.test(f.name))); inp.remove(); };
        inp.click();
      };
      d.__setFiles = (fs) => { d.__files = fs; d.querySelector("#ipN").textContent = `${fs.length} picture(s)`; };
      d.querySelector("#ipFiles").onclick = () => pick(false); d.querySelector("#ipFolder").onclick = () => pick(true);
      return d;
    }

    /* ---------------- droplets ---------------- */
    const drops = () => store.get("actions.droplets", []) || [];
    const saveDrops = (x) => store.set("actions.droplets", x);
    function runDroplet(dr, files) {
      const a = A.find(dr.set, dr.action); if (!a) return say(`droplet "${dr.name}": its action "${dr.set} ▸ ${dr.action}" is gone`);
      const pics = [...(files || [])].filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|jxl)$/i.test(f.name));
      if (!pics.length) return say(`droplet "${dr.name}": drop pictures on it`);
      return A.batch({ action: a, files: pics, onError: "log", dest: dr.dest, run: dr.run || dr.name, suffix: dr.suffix || "", format: dr.format, quality: (dr.quality || 90) / 100 });
    }
    function dlgDroplet() {
      const acts = allActs(); if (!acts.length) return say("record an action first");
      const c = A.current(), curV = c.action && c.set ? JSON.stringify([c.set.name, c.action.name]) : "";
      E.ui.dialog("Create Droplet", `<div class="rw"><span>Name</span><input type="text" id="dpN" value="${esc(c.action ? c.action.name : "Droplet")}" style="grid-column:2/4"></div>
        <div class="rw"><span>Action</span><select id="dpA" style="grid-column:2/4">${acts.map(([s, a]) => { const v = JSON.stringify([s, a]); return `<option value="${esc(v)}"${v === curV ? " selected" : ""}>${esc(s + " ▸ " + a)}</option>`; }).join("")}</select></div>
        <div class="rw"><span>Destination</span><select id="dpD" style="grid-column:2/4"><option value="project" selected>Project folder (batch)</option><option value="gallery">Image gallery</option><option value="download">Download each</option></select></div>
        <div class="rw"><span>File name</span><input type="text" id="dpS" value="-edited"><select id="dpF"><option value="png">PNG</option><option value="jpg">JPEG</option></select></div>
        <div style="color:var(--pc-dim)">It is kept in the Actions panel: drop pictures on it (or click it to choose some).</div>`, (d) => {
        const [set, action] = JSON.parse(d.querySelector("#dpA").value);
        const dr = { id: Date.now().toString(36), name: d.querySelector("#dpN").value.trim().slice(0, 40) || action, set, action, dest: d.querySelector("#dpD").value, suffix: d.querySelector("#dpS").value.slice(0, 30), format: d.querySelector("#dpF").value, run: "droplet-" + (d.querySelector("#dpN").value.trim() || action) };
        saveDrops(drops().concat([dr])); A.paint(); if (E.ui.showTab) E.ui.showTab("pcActions"); say(`droplet "${dr.name}" made - drop pictures on it in the Actions panel`);
      }, { okLabel: "💧 Create" });
    }
    A.panelHooks.push((box) => {
      const list = drops(); if (!list.length) return;
      const wrap = doc.createElement("div"); wrap.className = "actdrops"; wrap.style.cssText = "margin-top:6px;display:flex;flex-wrap:wrap;gap:4px";
      wrap.innerHTML = `<div style="width:100%;color:var(--pc-dim);font-size:11px">Droplets - drop pictures on one</div>` + list.map((dr) => `<div class="actdrop" data-drop="${esc(dr.id)}" title="${esc(dr.set + " ▸ " + dr.action)} → ${esc(dr.dest)} (${esc(dr.format)}) - drop pictures here or click" style="border:1px dashed var(--pc-line);border-radius:6px;padding:6px 8px;cursor:pointer;font-size:12px">💧 ${esc(dr.name)} <span data-dropdel="${esc(dr.id)}" title="Delete the droplet" style="color:var(--pc-dim);margin-left:4px">✕</span></div>`).join("");
      box.appendChild(wrap);
      wrap.querySelectorAll("[data-drop]").forEach((el) => {
        const dr = list.find((x) => x.id === el.dataset.drop);
        el.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); el.style.borderColor = "var(--pc-accent)"; };
        el.ondragleave = () => { el.style.borderColor = ""; };
        el.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); el.style.borderColor = ""; runDroplet(dr, e.dataTransfer && e.dataTransfer.files); };
        el.onclick = (e) => {
          if (e.target.dataset.dropdel) { saveDrops(drops().filter((x) => x.id !== dr.id)); A.paint(); return; }
          const inp = doc.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = "image/*"; inp.style.display = "none"; E.kx.appendChild(inp);
          inp.onchange = () => { runDroplet(dr, inp.files); inp.remove(); }; inp.click();
        };
      });
    });

    /* ---------------- commands ---------------- */
    const C = E.ui.addCmd;
    C("act.cond", "Actions: Insert Conditional…", "", () => dlgCond(null), { enabled: () => !!A.current().action });
    C("act.processor", "Scripts: Image Processor…", "", dlgProcessor, {}, ["File", "act.batch"]);
    C("act.droplet", "Automate: Create Droplet…", "", dlgDroplet, {}, ["File", "act.processor"]);
    E.actionsX = { dlgCond, dlgProcessor, processImages, dlgDroplet, runDroplet, droplets: drops, facts };
  }

  const PCActionsX = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCActionsX;
  else root.PCActionsX = PCActionsX;
})(typeof window !== "undefined" ? window : globalThis);
