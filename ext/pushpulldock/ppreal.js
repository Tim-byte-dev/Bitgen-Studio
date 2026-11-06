/* bitGen Studio — ext/pushpulldock/ppreal.js (2.626.0): THE ✏ SKETCHER WITH THE PROMPT DOCKER - A REAL PHOTO OF THE MODEL
 * (window.H3SketcherReal).
 * Tim: "change the name of push pull to Sketcher - when sketcher is open and prompt is open go to image mode in prompt and
 * edit - create a real photo of the model in view , when image is sent to timeline or image-editor send it as a sketcher
 * layer and when generated using prompt docker , make it a real image"
 *
 *   LINKED   the Sketcher docker on screen + the prompt docker on screen (and the image editor not on screen - it has its own
 *            ✏ Edit link - unless the Sketcher is maximized): the prompt docker goes to 🖼 Image, its style to an EDIT model
 *            (GET /api/aiedit/engines: the default edit model when the style picked cannot edit), an empty prompt gets
 *            DEFAULT ("create a real photo of the model in view"), its button reads "✏ Edit (Sketcher)" (index.html
 *            goLabel asks window.H3GoLabel; runGenerate asks window.H3TakeGenerate - both chained, the image editor's kept).
 *            The mode and the style it had come back when the link ends (unless changed meanwhile).
 *   GENERATE 2.627.0: a CLEAN render of the view (no outlines / grid / axes, shadows, a daylight sky) as picture 1 + its
 *            DEPTH map (near white, far black) as picture 2 -> POST /api/aiedit (mode edit, the whole picture, the edit
 *            model, ref_raw: the prompt is LEAD + DEPTH + the user's words, {img1} / {img2} in the model's word) -> the job -> the photo is a REAL IMAGE: filed in the project's Image assets (POST /api/passets),
 *            and with the image editor on screen also a plain layer there.
 * Pure (Node: scripts/test-sketcher626.js): linkedNow, pickEditStyle, shotSize, realName. */
(function (root) {
  "use strict";
  const DEFAULT = "create a real photo of the model in view";
  /** 2.627.0 (Tim: "before generating the picture do a clean render + depth and prepend the prompt to convert image n with Turn
      this 3D render into a photorealistic photograph of a building: real brick, timber, glass and concrete, natural daylight, soft
      shadows, no outlines, DSLR photo.") - {img1} / {img2}: the server puts the edit model's own word (<image1>, image 2 ...) */
  const LEAD = "Convert {img1}: Turn this 3D render into a photorealistic photograph of a building: real brick, timber, glass and concrete, natural daylight, soft shadows, no outlines, DSLR photo.";
  const DEPTH = "{img2} is the depth map of {img1} (near = white, far = black): keep exactly the same shapes, layout, proportions and camera angle.";
  /** the words sent: the lead + the depth line + the user's own (not the default words - the lead says it better) */
  /* 2.652.0 (Tim: "use reference images for the texture, background etc. and use our ai editor to create the scene"): the
     model's PICTURE materials and its backdrop go to the edit model too - the edit models take 3 pictures (the render, its
     depth, one more), so they ride as ONE labelled MATERIAL BOARD (picture 3): a tile each, where it is used written under it */
  const BOARD = "{img3} is a material board: each tile is a real material or picture, with where it goes written under it - use exactly those materials, textures and colours on those parts of the building";
  const BOARD_BG = "; the tile marked Background is what surrounds the building (keep it as the scene's background)";
  /* 2.688.0 (Tim: "only add the objects in the scene to the photo generate - for example if there aren't any windows don't
     add windows to the prompt"): LEAD named "a building: real brick, timber, glass and concrete" for every model - the edit
     model then added glass / brick that are not there. The lead is now written from the MODEL: what is in it (rooms, walls,
     doors, windows, roofs, stairs, furniture by name, people, pools, roads, ground …), the materials it really uses (its
     "mat:<key>" paints by name; glass only with windows / glass doors), and "add nothing that is not in the render". */
  const n = (k, one, many) => (k === 1 ? (/^[aeiou]/i.test(one) ? "an " : "a ") + one : k + " " + (many || one + "s"));
  const listOf = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  /** what is in the model, in words (pure) -> {parts: [...], materials: [...], building: bool, any: bool}
   *  deps = {furn(type) -> label, mat(key) -> label} (the page: PPFurn / H3HouseGeo; tests pass their own) */
  function sceneWords(A0, faces, deps) {
    const A = A0 || {}, d = deps || {}, parts = [], mats = new Set(), shown = (x) => x && x.hidden !== true;
    const mat = (v) => { if (typeof v !== "string" || !v.startsWith("mat:")) return; const k = v.slice(4), L = (d.mat ? d.mat(k) : k) || k; mats.add(String(L).toLowerCase()); };
    const rooms = (A.rooms || []).filter(shown), closed = rooms.filter((R) => R.closed !== false), free = rooms.filter((R) => R.closed === false);
    if (closed.length) parts.push(n(closed.length, "room") + " with walls" + (closed.some((R) => R.floorOn !== false) ? " and floors" : ""));
    if (free.length) parts.push(n(free.length, "free-standing wall"));
    const ops = A.ops || [], door = ops.filter((o) => o.kind === "door"), win = ops.filter((o) => o.kind === "window"), gap = ops.filter((o) => o.kind !== "door" && o.kind !== "window");
    if (door.length) parts.push(n(door.length, "door"));
    if (win.length) parts.push(n(win.length, "window"));
    if (gap.length) parts.push(n(gap.length, "open doorway"));
    const roofs = A.roofs || [];
    if (roofs.length) { const ty = [...new Set(roofs.map((r) => r.type || "gable"))]; const RM = root.PPStruct && root.PPStruct.ROOFMATS, mw = RM ? [...new Set(roofs.map((r) => RM[r.mat] && RM[r.mat].words).filter(Boolean))] : [];   // 2.695.0: + its covering
      parts.push((roofs.length === 1 ? "a " + ty[0] + " roof" : roofs.length + " roofs (" + ty.join(", ") + ")") + (mw.length ? " of " + mw.join(" and ") : "")); }
    if ((A.stairs || []).length) parts.push(n(A.stairs.length, "staircase"));
    if ((A.slabs || []).length) parts.push(n(A.slabs.length, "floor slab"));
    const items = (A.items || []).filter(shown), people = items.filter((it) => it.type === "person"), furn = items.filter((it) => it.type !== "person");
    const byName = new Map(); furn.forEach((it) => { const L = String((d.furn ? d.furn(it.type) : it.type) || it.type).toLowerCase(); byName.set(L, (byName.get(L) || 0) + 1); });
    const fl = [...byName.entries()].slice(0, 12).map(([L, k]) => n(k, L, /s$|sh$|ch$/.test(L) ? L + "es" : L + "s"));
    parts.push(...fl);
    if (people.length) parts.push(people.length === 1 ? "a person" : people.length + " people");
    if ((A.lights || []).length) parts.push(n(A.lights.length, "light fitting"));
    if ((A.pools || []).length) parts.push(n(A.pools.length, "swimming pool"));
    if ((A.drives || []).length) parts.push(n(A.drives.length, "driveway"));
    if ((A.roads || []).length) parts.push(n(A.roads.length, "road"));
    if (A.terrain) parts.push("the ground it stands on");
    const shapes = (faces || []).length;
    if (shapes && !rooms.length) parts.push("the modelled 3D shapes");
    // the materials it really uses
    const vals = (o) => (Array.isArray(o) ? o : o && typeof o === "object" ? Object.values(o) : []);   // wcol / wext: {wall index: colour}
    mat(A.ext); rooms.forEach((R) => { mat(R.wall); mat(R.floor); mat(R.ceilCol); vals(R.wcol).forEach(mat); vals(R.wext).forEach(mat); mat(R.skirtCol); mat(R.cornCol); });
    ops.forEach((o) => { mat(o.col); mat(o.trimCol); }); roofs.forEach((r) => mat(r.col)); (A.stairs || []).forEach((x) => mat(x.col)); (A.slabs || []).forEach((x) => mat(x.col));
    (faces || []).forEach((F) => mat(F && F.mat));
    if (win.length || door.some((o) => /glass|slid/i.test(String(o.style || "")))) mats.add("glass");
    return { parts, materials: [...mats], building: rooms.length > 0, any: parts.length > 0 };
  }
  /** the lead written from the model (pure) */
  function leadFor(w) {
    if (!w || !w.any) return LEAD;
    const what = w.building ? "a building with " + listOf(w.parts) : listOf(w.parts);
    return "Convert {img1}: Turn this 3D render into a photorealistic photograph of " + what + "."
      + (w.materials.length ? " Real materials: " + listOf(w.materials) + "." : " Real, natural materials.")
      + " Show only what is in the render and add nothing else. Natural daylight, soft shadows, no outlines, DSLR photo.";   // naming what NOT to add would prompt it
  }
  function promptFor(text, board, scene) {
    const t = String(text || "").trim();
    return (scene ? leadFor(scene) : LEAD) + " " + DEPTH + (board ? " " + BOARD + (board.bg ? BOARD_BG : "") + "." : "") + (t && t !== DEFAULT ? "\n" + t : "");
  }
  /** the pictures the model uses and where (pure): [{id, src, name, where: [...]}] (+ {bg} the backdrop / sky) - faces = the
   *  model's own faces' materials (M.f) */
  function usedPictures(A, faces) {
    if (!A) return { tiles: [], bg: null };
    const tex = new Map((A.tex || []).map((t) => [t.id, t])), used = new Map();
    const use = (v, where) => { if (typeof v !== "string" || !v.startsWith("tex:")) return; const t = tex.get(v.slice(4)); if (!t) return; if (!used.has(t.id)) used.set(t.id, { id: t.id, src: t.src, name: t.name, where: [] }); const u = used.get(t.id); if (!u.where.includes(where)) u.where.push(where); };
    use(A.ext, "outside walls");
    (A.rooms || []).forEach((R) => {
      const nm = R.name || "Room", n = (R.pts || []).length - (R.closed === false ? 1 : 0);
      use(R.wall, nm + " walls (inside)");
      for (let i = 0; i < n; i++) { if (R.wcol && R.wcol[i]) use(R.wcol[i], nm + " wall " + (i + 1) + " inside"); if (R.wext && R.wext[i]) use(R.wext[i], nm + " wall " + (i + 1) + " outside"); }
      if (R.closed !== false) { if (R.floorOn !== false) use(R.floor, nm + " floor"); if (R.ceilOn !== false) use(R.ceilCol, nm + " ceiling"); if (R.skirtOn) use(R.skirtCol, nm + " skirting"); if (R.corniceOn) use(R.cornCol, nm + " cornice"); }
    });
    (A.ops || []).forEach((o) => { const k = o.kind === "door" ? "door" : o.kind === "window" ? "window" : "opening"; use(o.col, k + (o.kind === "door" ? "" : " frame")); use(o.trimCol, k + " trim"); use(o.glass, k + " glass"); });
    (A.roofs || []).forEach((r) => use(r.col, "roof")); (A.stairs || []).forEach((x) => use(x.col, "stairs")); (A.slabs || []).forEach((x) => use(x.col, "floor slab"));
    (faces || []).forEach((F) => use(F && F.mat, "drawn shapes"));
    const tiles = [...used.values()].map((u) => Object.assign(u, { where: u.where.slice(0, 6) }));
    const bg = A.bg ? { src: A.bg.src, name: A.bg.name, kind: A.bg.kind } : null;
    return { tiles, bg };
  }
  /** the board's tile captions (pure): "Kitchen floor, Bed floor" … the background last */
  function boardCaptions(u) { return u.tiles.map((t) => t.where.join(", ")).concat(u.bg ? ["Background (" + (u.bg.kind === "sky" ? "360° sky" : "backdrop") + ")"] : []); }
  /** s = {sketcher, prompt, editor, maxed} (on screen) */
  function linkedNow(s) { return !!(s && s.sketcher && s.prompt && (s.maxed || !s.editor)); }
  /** 2.696.0 (Tim: "add a dropdown to the left of the photo button with image edit styles this will be exclusive to sketcher - keep
      the last one used as selected"): the Sketcher's own pick when it is still an edit style, else pickEditStyle */
  function sketcherStyle(own, cur, engines) { const E = (engines && engines.edit) || []; return own && E.some((x) => x.id === own) ? own : pickEditStyle(cur, engines); }
  /** the style to run: the prompt docker's when it is an edit model, else the engines' default edit model, else the first */
  function pickEditStyle(cur, engines) {
    const E = (engines && engines.edit) || []; if (!E.length) return "";
    if (E.some((x) => x.id === cur)) return cur;
    const d = engines.defaults && engines.defaults.edit; if (d && E.some((x) => x.id === d)) return d;
    return E[0].id;
  }
  /** the picture's size: the view's shape, its long side `long` (1024), both multiples of 16 */
  function shotSize(cw, ch, long) {
    const L = long || 1024, a = cw > 0 && ch > 0 ? cw / ch : 16 / 9;
    const w = a >= 1 ? L : L * a, h = a >= 1 ? L / a : L;
    return { w: Math.max(256, Math.round(w / 16) * 16), h: Math.max(256, Math.round(h / 16) * 16) };
  }
  const realName = (model) => "sketcher_real_" + String(model || "model").replace(/[^\w.-]+/g, "_").slice(0, 60) + ".png";

  /** 2.652.0: the material board picture (a canvas): up to 6 tiles, 3 a row, each picture cover-fitted + its caption */
  async function boardPic(u) {
    const items = u.tiles.map((t) => ({ src: t.src, cap: t.where.join(", ") })).concat(u.bg ? [{ src: u.bg.src, cap: "Background (" + (u.bg.kind === "sky" ? "360° sky" : "backdrop") + ")" }] : []).slice(0, 6);
    if (!items.length) return null;
    const url = (src) => String(src).replace(/^\/passets\/images\/(.*)$/, (m, n) => "/passets/images/" + encodeURIComponent(n));
    const imgs = await Promise.all(items.map((it) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url(it.src); })));
    const cols = Math.min(3, items.length), rows = Math.ceil(items.length / cols), T = 320, CAP = 44, G = 8;
    const c = root.document.createElement("canvas"); c.width = cols * T + (cols + 1) * G; c.height = rows * (T + CAP) + (rows + 1) * G;
    const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
    items.forEach((it, i) => {
      const x = G + (i % cols) * (T + G), y = G + Math.floor(i / cols) * (T + CAP + G), im = imgs[i];
      if (im) { const s = Math.max(T / im.width, T / im.height), sw = T / s, sh = T / s; g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, T, T); }
      else { g.fillStyle = "#cccccc"; g.fillRect(x, y, T, T); }
      g.fillStyle = "#111111"; g.font = "600 17px sans-serif"; g.textBaseline = "top";
      let t = it.cap; while (g.measureText(t).width > T - 4 && t.length > 4) t = t.slice(0, -2); if (t !== it.cap) t = t.slice(0, -1) + "…";
      g.fillText(t, x + 2, y + T + 10);
    });
    return c;
  }
  const api = { sketcherStyle, DEFAULT, LEAD, DEPTH, BOARD, promptFor, sceneWords, leadFor, usedPictures, boardCaptions, linkedNow, pickEditStyle, shotSize, realName };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const shown = (id) => { const d = $(id); return !!(d && !d.classList.contains("dockgone") && !d.classList.contains("collapsed") && d.getClientRects().length && d.getBoundingClientRect().width > 0); };
  const S = { linked: false, keep: null, engines: null, busy: false };
  function state() { return { sketcher: shown("pushpulldock"), prompt: shown("promptdock"), editor: shown("imageeditdock"), maxed: !!($("pushpulldock") && $("pushpulldock").classList.contains("maxed")) }; }
  const PP = () => root.H3PushPull;
  const say = (t) => { const P = PP(); if (P && P.state && $("ppMsg")) $("ppMsg").textContent = t; };
  async function engines() { if (S.engines) return S.engines; try { S.engines = await (await root.fetch("/api/aiedit/engines")).json(); } catch (e) { S.engines = { edit: [] }; } return S.engines; }
  const KEY = "pp.realStyle", kept = () => { try { return root.localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }, keep = (v) => { try { if (v) root.localStorage.setItem(KEY, v); } catch (e) { /* fine */ } };
  /** 2.696.0: the bar's Photo style dropdown - the edit styles, the last one used picked; refreshed when it is opened */
  async function fillStyles(force) {
    const sel = $("ppRealStyle"); if (!sel || (sel.dataset.filled && !force)) return;
    sel.dataset.filled = "1";
    if (force) S.engines = null;
    const E = await engines(), list = E.edit || [], st = $("styleSel"), now = sketcherStyle(sel.value || kept(), st ? st.value : "", E);
    sel.innerHTML = "";
    if (!list.length) { const o = document.createElement("option"); o.value = ""; o.textContent = "no edit model"; sel.appendChild(o); sel.disabled = true; return; }
    sel.disabled = false;
    list.forEach((x) => { const o = document.createElement("option"); o.value = x.id; o.textContent = x.name || x.id; sel.appendChild(o); });
    sel.value = now;
    if (!sel.dataset.wired) { sel.dataset.wired = "1"; sel.addEventListener("change", () => keep(sel.value)); sel.addEventListener("pointerdown", () => { if (Date.now() - (+sel.dataset.at || 0) > 5000) { sel.dataset.at = Date.now(); fillStyles(true); } }); }
  }
  const ownStyle = () => { const sel = $("ppRealStyle"); return (sel && sel.value) || kept(); };
  function setSel(id, v) { const s = $(id); if (!s || s.value === v) return; if (![...s.options].some((o) => o.value === v)) return; s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); }
  async function link(on) {
    if (on === S.linked) return;
    S.linked = on;
    const gm = $("genModeSel"), st = $("styleSel"), pr = $("prompt");
    if (on) {
      S.keep = { mode: gm ? gm.value : null, style: st ? st.value : null };
      if (gm) setSel("genModeSel", "image");
      const E = await engines(); const id = sketcherStyle(ownStyle(), st ? st.value : "", E);   // 2.696.0: the Sketcher's own style
      if (id && st) setSel("styleSel", id);
      S.keep.setStyle = st ? st.value : null; S.keep.setMode = gm ? gm.value : null;
      if (pr && !pr.value.trim()) { pr.value = DEFAULT; S.keep.text = DEFAULT; pr.dispatchEvent(new Event("input", { bubbles: true })); }
    } else if (S.keep) {
      // put back what was there - unless it was changed meanwhile
      if (st && S.keep.style != null && st.value === S.keep.setStyle) setSel("styleSel", S.keep.style);
      if (gm && S.keep.mode != null && gm.value === S.keep.setMode) setSel("genModeSel", S.keep.mode);
      if (pr && S.keep.text && pr.value === S.keep.text) { pr.value = ""; pr.dispatchEvent(new Event("input", { bubbles: true })); }
      S.keep = null;
    }
    if (typeof root.paintGoLabel === "function") try { root.paintGoLabel(); } catch (e) { /* fine */ }
  }
  /* the page's seams - chained (the image editor sets its own; whoever was there is asked when not linked) */
  function mineTake(gm, text) {
    if (S.linked && gm === "image") { run(text).catch((e) => say("📷 not made: " + (e.message || e))); return true; }
    return mineTake.prev ? mineTake.prev(gm, text) : false;
  }
  function mineLabel() {
    if (S.linked && $("genModeSel") && $("genModeSel").value === "image") return S.busy ? "⏳ Sketcher…" : "✏ Edit (Sketcher)";
    return mineLabel.prev ? mineLabel.prev() : null;
  }
  function seams() {
    if (root.H3TakeGenerate !== mineTake) { mineTake.prev = root.H3TakeGenerate || null; root.H3TakeGenerate = mineTake; }
    if (root.H3GoLabel !== mineLabel) { mineLabel.prev = root.H3GoLabel || null; root.H3GoLabel = mineLabel; }
  }
  function tick() { seams(); link(linkedNow(state())); fillStyles(false); }

  /* ---- the run */
  async function run(text) {
    const P = PP(), V = P && P.state && P.state.V; if (!V || !P.state.M) { say("📷 the Sketcher's view is not ready"); return; }
    if (S.busy) { say("📷 still making the last one"); return; }
    const E = await engines(), st = $("styleSel"), style = sketcherStyle(ownStyle(), st ? st.value : "", E);   // 2.696.0: the bar's Photo style
    if (style) keep(style);
    if (!style) { say("📷 no edit model - install one (Qwen Image Edit, FLUX Kontext, FLUX.2 Klein ...) in the Model manager"); return; }
    S.busy = true; if (typeof root.paintGoLabel === "function") root.paintGoLabel();
    try {
      const cv = V.canvas, sz = shotSize(cv.clientWidth, cv.clientHeight, 1024);
      V.setSel({ f: [], e: [], k: [] }); if (P.state.A && P.state.A.setSel) P.state.A.setSel(null);
      // 2.627.0: a CLEAN render (no outlines / grid, shadows, a daylight sky) = picture 1, its DEPTH map = picture 2
      const c = V.shot(sz.w, sz.h, { clean: true, photo: true }), dm = V.shot(sz.w, sz.h, { clean: true, depth: true }); V.setSel(P.state.sel);
      const blob = await new Promise((ok) => c.toBlob(ok, "image/png")), dblob = await new Promise((ok) => dm.toBlob(ok, "image/png"));
      S.shots = { photo: c, depth: dm };
      // 2.652.0: the model's pictures (materials, the backdrop) as a labelled board = picture 3
      // 2.688.0: the lead names only what the model has (sceneWords)
      const scene = sceneWords(P.state.M.arch, P.state.M.f, { furn: (t) => { try { const pc = root.PPFurn && root.PPFurn.pieces().find((x) => x.type === t); return pc ? pc.label : t; } catch (e) { return t; } },
        mat: (k) => { try { const m = root.H3HouseGeo && root.H3HouseGeo.MATERIALS[k]; return m ? m.label || k : k; } catch (e) { return k; } } });
      const used = usedPictures(P.state.M.arch, P.state.M.f), bc = used.tiles.length || used.bg ? await boardPic(used) : null;
      const bblob = bc ? await new Promise((ok) => bc.toBlob(ok, "image/png")) : null;
      S.shots.board = bc; S.board = bc ? boardCaptions(used) : null;
      const send = async (withBoard) => {
        const fd = new FormData();
        fd.append("crop", blob, "sketcher.png");
        fd.append("ref0", dblob, "sketcher_depth.png"); fd.append("ref_desc", "depth map"); fd.append("ref_raw", "1");
        if (withBoard) fd.append("ref1", bblob, "sketcher_materials.png");
        const fields = { mode: "edit", prompt: promptFor(text, withBoard ? used : null, scene), style_id: style, strength: 100, count: 1, width: sz.w, height: sz.h, whole: "1" };
        Object.keys(fields).forEach((k) => fd.append(k, String(fields[k])));
        if (root.H3Neg && root.H3Neg.get && root.H3Neg.get()) fd.append("negative", root.H3Neg.get());
        S.sent = { prompt: fields.prompt, board: !!withBoard, scene };
        const r = await root.fetch("/api/aiedit", { method: "POST", body: fd }); return { r, j: await r.json() };
      };
      say("📷 a real photo of the model" + (bblob ? " (+ its materials board)" : "") + " - queued (" + ((E.edit.find((x) => x.id === style) || {}).name || style) + ")…");
      let { r, j } = await send(!!bblob);
      if (!r.ok && bblob && /picture\(s\)|takes \d|at most/i.test(j.error || "")) {   // this edit model takes two pictures: without the board
        ({ r, j } = await send(false));
        if (r.ok) say("📷 queued without the materials board - this edit model takes two pictures (Qwen Image Edit 2511 / FLUX.2 Klein take three)");
      }
      if (!r.ok) throw new Error(j.error || "refused");
      if (typeof root.refreshJobs === "function") try { root.refreshJobs(); } catch (e) { /* fine */ }
      const id = j.jobs && j.jobs[0] && j.jobs[0].id; if (!id) throw new Error("no job");
      let jj = null;
      for (;;) {
        await new Promise((ok) => setTimeout(ok, 1200));
        try { jj = await (await root.fetch("/api/jobs/" + encodeURIComponent(id))).json(); } catch (e) { continue; }
        if (jj.status === "running" && root.H3Steps && jj.progress) say("📷 a real photo of the model - " + root.H3Steps.text(jj.progress));
        if (jj.status && jj.status !== "running" && jj.status !== "queued") break;
      }
      if (jj.status !== "done") throw new Error("the render " + jj.status + " - see the job log");
      const out = (jj.outputs && jj.outputs[0]) || jj.output; if (!out) throw new Error("the render made nothing");
      const url = "/outputs/" + encodeURIComponent(out);
      // a REAL image: the project's Image assets (+ a plain layer in the image editor when it is on screen)
      const pic = await (await root.fetch(url)).blob(), name = realName(P.state && P.nameNow ? P.nameNow() : (($("ppName") || {}).value || "model"));
      const up = new FormData(); up.append("file", new File([pic], name, { type: pic.type || "image/png" }), name);
      const saved = await (await root.fetch("/api/passets", { method: "POST", body: up })).json();
      if (!saved || !saved.name) throw new Error((saved && saved.error) || "it could not be filed in the Image assets");
      if (typeof root.refreshAssets === "function") try { root.refreshAssets(); } catch (e) { /* fine */ }
      if (typeof root.loadPAssets === "function") try { root.loadPAssets(); } catch (e) { /* fine */ }
      const IE = root.imageEditorInstance && root.imageEditorInstance.E;
      if (IE && shown("imageeditdock")) try { IE.load(url, "📷 " + saved.name, !!(IE.S && IE.S.w)); } catch (e) { /* fine */ }
      say("📷 a real photo of the model - in the Image assets as " + saved.name);
      S.last = { asset: saved.name, url, job: id };
      try { if (root.H3TestEvent) root.H3TestEvent("sketcher_real", saved.name); } catch (e) { /* fine */ }
    } finally { S.busy = false; if (typeof root.paintGoLabel === "function") root.paintGoLabel(); }
  }
  root.H3SketcherReal = Object.assign({ state, run, link, tick, last: () => S.last, linked: () => S.linked, shots: () => S.shots }, api);
  setInterval(tick, 700);
  doc.addEventListener("DOMContentLoaded", tick);
})(typeof window !== "undefined" ? window : globalThis);
