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
  /* 2.987.0 (Tim: "when rendering from sketcher use the reference images and prompt in prompt docker if there are any"): the
     prompt docker's reference pictures ride on the same board (picture 3), each marked "Reference n" */
  const REF1 = "{img3} is the reference picture: give the whole picture its look - its place, ground, surroundings, sky, style, colours, lighting and mood - with the 3D model standing in it, its shapes kept";   // 2.991.0: ONE reference, sent whole
  const REFS = "{img3} also holds reference pictures (the tiles marked Reference): give the scene their look - their style, materials, colours, lighting and mood - while keeping the 3D render's shapes";
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
    // 2.985.0: + the DAZ characters standing in the scene (d.daz = how many are shown)
    const folk = people.length + (+d.daz || 0);
    if (folk) parts.push(folk === 1 ? "a person" : folk + " people");
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
    return { parts, materials: [...mats], building: rooms.length > 0, any: parts.length > 0, people: +d.daz || 0 };
  }
  /** the lead written from the model (pure) */
  function leadFor(w) {
    if (!w || !w.any) return LEAD;
    const what = w.building ? "a building with " + listOf(w.parts) : listOf(w.parts);
    return "Convert {img1}: Turn this 3D render into a photorealistic photograph of " + what + "."
      + (w.materials.length ? " Real materials: " + listOf(w.materials) + "." : " Real, natural materials.")
      + (w.people ? " Each person is a real person in exactly the same pose, body shape, hair and clothes, with real skin." : "")   // 2.985.0
      + " Show only what is in the render and add nothing else. Natural daylight, soft shadows, no outlines, DSLR photo.";   // naming what NOT to add would prompt it
  }
  /* 2.989.0 (Tim: "when photo button is pressed or edit in sketcher button in prompt docker is pressed then follow the full
     prompt, location, setting, other characters etc."): with the user's words the lead no longer says "add nothing else" -
     the model's shapes and camera stay, the PROMPT decides the place, the setting, the light, the people and things around */
  // 2.990.0 (Tim: "woman standing in a park ... it just renders a white background not a park"): with words, picture 1 is drawn
  // on a flat grey (no sky, no ground) and the model is told that grey is EMPTY - to be replaced by the prompt's place
  const EMPTY = "In {img1} the flat plain grey around the 3D model is empty space, not a wall or a backdrop: replace all of it with the place the prompt describes - its ground, its surroundings and its sky - never keep a plain, grey or white background.";
  const FILL = 0x808080;
  const FOLLOW = "Follow the prompt below in full: its location, setting, surroundings, time of day, weather, lighting, mood and any other people, animals or objects it names are added around the 3D model - the model itself keeps its shapes, layout and camera angle.";
  /* 2.993.0 (Tim: "it still produces a gray background but it does use the reference picture"): an edit model copies what is
     IN picture 1 - a grey there comes back grey whatever the words say. So the place is put INTO the pictures:
     - a reference whose Type is "environment" = picture 1 is the model drawn over that picture (PLACED - one pass);
     - else (words / other references) the first photo is made as before, then the grey round the model is painted GREEN and
       filled again under a noise mask (pass 2, the Krita AI plugin's "fill the green" through /api/aiedit fill_edit) with the
       prompt's place and the references' look (fillPrompt). */
  const PLACED = "{img1} already shows the 3D model standing in its place (the reference picture behind it): make it one real photograph - the place stays as it is, the model gets its light, shadows, colours and perspective, its feet / base on the ground.";
  function promptFor(text, board, scene, opt) {
    const t = String(text || "").trim(), placed = !!(opt && opt.placed);
    if (t && t !== DEFAULT) {
      const lead = (scene ? leadFor(scene) : LEAD).replace(" Show only what is in the render and add nothing else.", "");
      const mats = board && ((board.tiles || []).length || board.bg), refs = board && (board.refs || []).length;
      return lead + " " + DEPTH + (mats ? " " + BOARD + (board.bg ? BOARD_BG : "") + "." : "") + (refs ? " " + (board.single ? REF1 : REFS) + "." : "") + " " + FOLLOW + (board && board.bg ? "" : " " + (placed ? PLACED : EMPTY)) + "\nThe prompt: " + t;   // a backdrop / sky of your own stays
    }
    const mats = board && ((board.tiles || []).length || board.bg), refs = board && (board.refs || []).length, fill = !placed && !!(opt && opt.fill);
    const lead0 = scene ? leadFor(scene) : LEAD;
    return (placed ? lead0.replace(" Show only what is in the render and add nothing else.", "") : fill ? lead0.replace(" Show only what is in the render and add nothing else.", " " + KEEP_MODEL) : lead0) + " " + DEPTH + (mats ? " " + BOARD + (board.bg ? BOARD_BG : "") + "." : "") + (refs ? " " + (board.single ? REF1 : REFS) + "." : "") + (placed ? " " + PLACED : "") + (fill ? " " + EMPTY_ANY : "") + (t && t !== DEFAULT ? "\n" + t : "");
  }
  /* 2.995.0 (Tim: "please check the conditional statements for edit sketcher button and photo button in sketcher, i am getting
     mixed results, sometimes correct, sometimes with a gray mannequin, sometimes with gray bg"): ONE rule for both buttons (plan),
     every way: the model's own backdrop / sky = one pass as it is; an "environment" reference = the model drawn into it (one
     pass); ANYTHING else - words or not, references or not - = the model on the flat grey + pass 2 fills the grey (no more
     "no words = the pale sky colour", which came back as a grey background). */
  const KEEP_MODEL = "Add nothing to the model itself that is not in the render.";   // (2.688.0's rule, for the model - the place round it is new)
  const EMPTY_ANY = "In {img1} the flat plain grey around the 3D model is empty space, not a wall or a backdrop: replace all of it with a real place that suits the model - its ground, its surroundings and its sky - never keep a plain, grey or white background.";
  /** the way a photo is made (pure): {mode: "own" | "placed" | "fill", words, env} - hasBg = the model's own backdrop / sky */
  function plan(text, hasBg, refs) {
    const t = String(text || "").trim(), words = !!t && t !== DEFAULT;
    if (hasBg) return { mode: "own", words, env: null };
    const env = envRef(refs);
    return env ? { mode: "placed", words, env } : { mode: "fill", words, env: null };
  }
  /** how much the model changed between picture 1 and the photo (pure): the mean RGB difference 0..255 where the model is
   *  (alpha >= 128); a, b = RGBA data of the same size; -1 = no model in view. A grey 3D mannequin copied back comes out ~0 */
  function modelChange(a, b, alpha, step) {
    const k = Math.max(1, step | 0); let sum = 0, n = 0;
    for (let i = 0; i < alpha.length; i += k) { if (alpha[i] < 128) continue; const j = i * 4; sum += Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]); n++; }
    return n ? sum / (3 * n) : -1;
  }
  /** the part of the filled area that is still flat grey or green (pure): 0..1 - data RGBA, sel 1 = filled */
  function greyLeft(data, sel, grey) {
    const G = grey == null ? 128 : grey; let bad = 0, n = 0;
    for (let i = 0; i < sel.length; i += 3) { if (!sel[i]) continue; n++; const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if ((Math.abs(r - G) <= 14 && Math.abs(g - G) <= 14 && Math.abs(b - G) <= 14) || (g > 180 && r < 90 && b < 90)) bad++; }
    return n ? bad / n : 0;
  }
  const UNCHANGED = 9, GREY_LEFT = 0.3;
  /** the second try's words when the first photo came back still the 3D render (a grey mannequin): short and direct */
  function retryPrompt(text, p) {
    const t = String(text || "").trim(), w = t && t !== DEFAULT ? t : "";
    return "Make {img1} a real photograph. Nothing may stay looking like a grey 3D model, a mannequin or a render: real skin, hair, clothes, real materials and textures, real light and shadows. Keep exactly the same shapes, pose, layout and camera angle ({img2} is its depth map)."
      + (p && p.mode === "fill" ? " Replace the flat grey around it with a real place." : p && p.mode === "placed" ? " The place behind it stays as it is." : "")
      + (w ? "\nThe prompt: " + w : "");
  }
  /** the reference to put the model INTO: the first one whose Type is "environment" (or null) */
  function envRef(list) { return (Array.isArray(list) ? list : []).find((r) => r && /^(environment|background|location|place|scene|setting)$/i.test(String(r.role || ""))) || null; }
  /** pass 2's selection: 1 = the background (no model there: alpha < 128), grown `grow` px INTO the model's edge so a grey
   *  halo is painted over too. alpha = Uint8Array w x h (the model alone, transparent round it) */
  function bgMask(alpha, w, h, grow) {
    const sel = new Uint8Array(w * h); for (let i = 0; i < sel.length; i++) sel[i] = alpha[i] < 128 ? 1 : 0;
    const g = Math.max(0, Math.round(grow || 0)); if (!g) return sel;
    const row = new Uint8Array(w * h);   // a square grow, rows then columns (a running count)
    for (let y = 0; y < h; y++) { let n = 0; for (let x = -g; x < w; x++) { if (x + g < w && sel[y * w + x + g]) n++; if (x - g - 1 >= 0 && sel[y * w + x - g - 1]) n--; if (x >= 0) row[y * w + x] = n > 0 ? 1 : 0; } }
    const out = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) { let n = 0; for (let y = -g; y < h; y++) { if (y + g < h && row[(y + g) * w + x]) n++; if (y - g - 1 >= 0 && row[(y - g - 1) * w + x]) n--; if (y >= 0) out[y * w + x] = n > 0 ? 1 : 0; } }
    return out;
  }
  /** paint the selection green in RGBA data (Krita FillMode.green); -> how many pixels */
  function greenFill(data, sel) { let n = 0; for (let i = 0; i < sel.length; i++) if (sel[i]) { data[i * 4] = 0; data[i * 4 + 1] = 255; data[i * 4 + 2] = 0; data[i * 4 + 3] = 255; n++; } return n; }
  /** pass 2's words (after the route's "Fill the green spaces according to the image."): the place from the prompt, the
   *  reference's look, the model kept. {img2} = the reference when one goes along */
  function fillPrompt(text, hasRef, strict) {
    const t = String(text || "").trim(), words = t && t !== DEFAULT ? t : "";
    return (strict ? "Every green pixel must become part of a real photographed place - not one may stay green or grey. " : "") + "The green area is the place around the person or object in {img1}: fill all of it with a real, detailed photographic place - ground, surroundings and sky - in the same light and perspective, so it is one photograph. Never leave green, grey, white or a plain backdrop. The person or object in {img1} stays exactly as it is."
      + (hasRef ? " {img2} is the reference picture: the place has its look - its kind of place, colours, light and mood." : "")
      + (words ? "\nThe place and the scene: " + words : "");
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
  function boardCaptions(u) { return u.tiles.map((t) => t.where.join(", ")).concat(u.bg ? ["Background (" + (u.bg.kind === "sky" ? "360° sky" : "backdrop") + ")"] : []).concat((u.refs || []).map((r) => r.cap)); }
  /** 2.987.0 (pure): the prompt docker's reference pictures as board tiles - pictures only, 6 at most, "Reference n (its words)" */
  function refTiles(list) {
    return (Array.isArray(list) ? list : []).filter((r) => r && r.url && !(r.file && r.file.type && !/^image\//.test(r.file.type))).slice(0, 6)
      .map((r, i) => ({ src: r.url, role: r.role === "other" ? String(r.roleOther || "").trim() : String(r.role || ""), cap: "Reference " + (i + 1) + (r.desc ? " (" + String(r.desc).slice(0, 40) + ")" : r.role && r.role !== "person" ? " (" + r.role + ")" : "") }));   // 2.993.0: + role
  }
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
  /** 2.991.0: one reference picture, whole (its own shape, 1024 px at most) */
  async function refPic(src) {
    const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }); if (!im) return null;
    const k = Math.min(1, 1024 / Math.max(im.width, im.height)), c = root.document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return c;
  }
  async function boardPic(u) {
    const items = u.tiles.map((t) => ({ src: t.src, cap: t.where.join(", ") })).concat(u.bg ? [{ src: u.bg.src, cap: "Background (" + (u.bg.kind === "sky" ? "360° sky" : "backdrop") + ")" }] : []).slice(0, 6)
      .concat((u.refs || []).slice(0, 9)).slice(0, 9);                    // 2.987.0: + the prompt docker's references (a 3 × 3 board at most)
    if (!items.length) return null;
    const url = (src) => /^blob:|^data:/.test(String(src)) ? String(src) : String(src).replace(/^\/passets\/images\/(.*)$/, (m, n) => "/passets/images/" + encodeURIComponent(n));
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
  const api = { KEEP_MODEL, EMPTY_ANY, plan, modelChange, greyLeft, retryPrompt, UNCHANGED, GREY_LEFT, PLACED, envRef, bgMask, greenFill, fillPrompt, REF1, EMPTY, FILL, FOLLOW, REFS, refTiles, sketcherStyle, DEFAULT, LEAD, DEPTH, BOARD, promptFor, sceneWords, leadFor, usedPictures, boardCaptions, linkedNow, pickEditStyle, shotSize, realName };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const shown = (id) => { const d = $(id); return !!(d && !d.classList.contains("dockgone") && !d.classList.contains("collapsed") && d.getClientRects().length && d.getBoundingClientRect().width > 0); };
  const S = { linked: false, keep: null, engines: null, runs: 0, seq: 0 };   // 2.995.0: runs = how many photos are being made (each click queues its own)
  function state() { return { sketcher: shown("pushpulldock"), prompt: shown("promptdock"), editor: shown("imageeditdock"), maxed: !!($("pushpulldock") && $("pushpulldock").classList.contains("maxed")) }; }
  const PP = () => root.H3PushPull;
  const say = (t) => { const P = PP(); if (P && P.state && $("ppMsg")) $("ppMsg").textContent = t; };
  // 2.985.0: an empty / failed answer is not kept (a model installed later, or the server busy at the first ask, works on the next ✨)
  async function engines() { if (S.engines && S.engines.edit && S.engines.edit.length) return S.engines; try { S.engines = await (await root.fetch("/api/aiedit/engines")).json(); } catch (e) { S.engines = { edit: [] }; } if (!S.engines || !Array.isArray(S.engines.edit)) S.engines = { edit: [] }; return S.engines; }
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
    if (S.linked && $("genModeSel") && $("genModeSel").value === "image") return "✏ Edit (Sketcher)" + (S.runs ? " · " + S.runs + " making" : "");
    return mineLabel.prev ? mineLabel.prev() : null;
  }
  function seams() {
    if (root.H3TakeGenerate !== mineTake) { mineTake.prev = root.H3TakeGenerate || null; root.H3TakeGenerate = mineTake; }
    if (root.H3GoLabel !== mineLabel) { mineLabel.prev = root.H3GoLabel || null; root.H3GoLabel = mineLabel; }
  }
  function tick() { seams(); link(linkedNow(state())); fillStyles(false); }

  /** 2.985.0: why a render failed - the models it could not find, else the last lines of its log that say what went wrong */
  async function whyFailed(id, jj) {
    if (jj && Array.isArray(jj.models_missing) && jj.models_missing.length) return ": a model file is missing - " + jj.models_missing.slice(0, 3).map((m) => (m && (m.name || m.file)) || m).join(", ");
    try {
      const L = (await (await root.fetch("/api/jobs/" + encodeURIComponent(id) + "?log_from=0")).json()).log || [];
      const lines = L.map((x) => String(x && x.text != null ? x.text : x)).filter((x) => x.trim());
      const bad = lines.filter((x) => /error|failed|missing|not found|out of memory|exception/i.test(x)).slice(-2);
      const say = (bad.length ? bad : lines.slice(-2)).join(" · ").slice(0, 400);
      return say ? ": " + say : " - see the job log";
    } catch (e) { return " - see the job log"; }
  }
  /** wait for a job -> its first output's name (throws the job's own words) */
  async function waitJob(id, label) {
    let jj = null;
    for (;;) {
      await new Promise((ok) => setTimeout(ok, 1200));
      try { jj = await (await root.fetch("/api/jobs/" + encodeURIComponent(id))).json(); } catch (e) { continue; }
      if (jj.status === "running" && root.H3Steps && jj.progress) say(label + " - " + root.H3Steps.text(jj.progress));
      if (jj.status && jj.status !== "running" && jj.status !== "queued") break;
    }
    if (jj.status !== "done") throw new Error("the render " + jj.status + (await whyFailed(id, jj)));   // 2.985.0: the job's own words, not just "see the job log"
    const out = (jj.outputs && jj.outputs[0]) || jj.output; if (!out) throw new Error("the render made nothing");
    return out;
  }
  function canvas(w, h) { const c = root.document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function imgOf(src) {
    const u = /^blob:|^data:/.test(String(src)) ? String(src) : String(src).replace(/^\/passets\/images\/(.*)$/, (m, n) => "/passets/images/" + encodeURIComponent(n));
    return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = u; });
  }
  const blobOf = (cv) => new Promise((ok) => cv.toBlob(ok, "image/png"));
  /** a picture (blob) drawn at w x h -> its canvas + RGBA data */
  async function dataOf(blob, w, h) {
    const u = URL.createObjectURL(blob), im = await imgOf(u); URL.revokeObjectURL(u); if (!im) return null;
    const c = canvas(w, h), g = c.getContext("2d"); g.drawImage(im, 0, 0, w, h); return { c, d: g.getImageData(0, 0, w, h) };
  }
  /** 2.993.0: picture 1 for an "environment" reference - that picture (filling the shot, cropped to its shape) with the model
   *  alone drawn over it */
  async function placedPic(src, model) {
    const im = await imgOf(src); if (!im || !model) return null;
    const w = model.width, h = model.height, c = canvas(w, h), g = c.getContext("2d"), k = Math.max(w / im.width, h / im.height), sw = w / k, sh = h / k;
    g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, w, h);
    g.drawImage(model, 0, 0, w, h);
    return c;
  }
  /** send one picture job to /api/aiedit and wait for it -> {blob, job} (throws the server's / the job's words) */
  async function aiJob(fd, label) {
    const res = await root.fetch("/api/aiedit", { method: "POST", body: fd }), j = await res.json();
    if (!res.ok) { const e = new Error(j.error || "refused"); e.refused = true; throw e; }
    if (typeof root.refreshJobs === "function") try { root.refreshJobs(); } catch (e) { /* fine */ }   // it is in the queue
    const id = j.jobs && j.jobs[0] && j.jobs[0].id; if (!id) throw new Error("no job");
    const out = await waitJob(id, label);
    return { blob: await (await root.fetch("/outputs/" + encodeURIComponent(out))).blob(), job: id };
  }
  /** 2.993.0 pass 2: the first photo with the background (where the model is not, grown into its edge) painted GREEN, filled
   *  under a noise mask by the same edit model with the prompt's place and the first reference's look; the model's own pixels
   *  from the first photo are kept. 2.995.0: the model's coverage from the silhouette (R.alpha), and a fill that still left grey
   *  / green is tried once more (strict, no reference). -> {blob, job, left} | null (no background to fill) */
  async function fillPass(R, pic) {
    const { w, h, alpha, text, style, used, tag } = R;
    const fp = await dataOf(pic, w, h); if (!fp) throw new Error("the first photo could not be read");
    const first = fp.d, sel = bgMask(alpha, w, h, Math.max(2, Math.round(0.006 * Math.max(w, h))));
    let n = 0; for (let i = 0; i < sel.length; i++) n += sel[i];
    if (n < sel.length * 0.01) return null;
    const c = canvas(w, h), g = c.getContext("2d"), green = new ImageData(new Uint8ClampedArray(first.data), w, h); greenFill(green.data, sel); g.putImageData(green, 0, 0);
    const m = canvas(w, h), mg = m.getContext("2d"), mi = mg.createImageData(w, h);
    for (let i = 0; i < sel.length; i++) mi.data[i * 4 + 3] = sel[i] ? 0 : 255;                // transparent = what is filled
    mg.putImageData(mi, 0, 0);
    const r = canvas(w, h), rg = r.getContext("2d"); rg.putImageData(first, 0, 0); rg.globalCompositeOperation = "destination-in"; rg.drawImage(m, 0, 0);
    const ref = used.refs.length ? await imgOf(used.refs[0].src) : null;
    const refBlob = ref ? await (() => { const k = Math.min(1, 1024 / Math.max(ref.width, ref.height)), rc = canvas(Math.round(ref.width * k), Math.round(ref.height * k)); rc.getContext("2d").drawImage(ref, 0, 0, rc.width, rc.height); return blobOf(rc); })() : null;
    const [cb, mb, rb] = [await blobOf(c), await blobOf(m), await blobOf(r)];
    const form = (withRef, strict) => {
      const fd = new FormData();
      fd.append("crop", cb, "sketcher_fill.png"); fd.append("mask", mb, "sketcher_fill_mask.png"); fd.append("rgba", rb, "sketcher_fill_hole.png");
      if (withRef) { fd.append("ref0", refBlob, "sketcher_reference.png"); fd.append("ref_desc", "the reference picture"); }
      const fields = { mode: "generate", fill_edit: "1", edit_style_id: style, fill_kind: "generate", style_id: style, prompt: fillPrompt(text, withRef, strict), ref_raw: "1",
        strength: 100, count: 1, width: w, height: h, mask_grow: 0, mask_feather: Math.max(2, Math.round(0.008 * Math.max(w, h))) };
      Object.keys(fields).forEach((k) => fd.append(k, String(fields[k])));
      S.sent2 = { prompt: fields.prompt, ref: !!withRef, filled: n, of: sel.length, strict: !!strict };
      return fd;
    };
    const label = tag + " step 2: the place round the model";
    say(label + "…");
    let got;
    try { got = await aiJob(form(!!refBlob, false), label); }
    catch (e) { if (!(e.refused && refBlob && /picture\(s\)|takes \d|at most|reference/i.test(e.message || ""))) throw e; got = await aiJob(form(false, false), label); }
    let f2 = await dataOf(got.blob, w, h); if (!f2) throw new Error("the filled photo could not be read");
    let left = greyLeft(f2.d.data, sel, FILL >> 16), job = got.job, again = false;
    if (left > GREY_LEFT) {   // 2.995.0: the grey / green is still there - once more, strict, without the reference
      say(tag + " the place came back " + Math.round(left * 100) + "% grey / green - filling it once more…"); again = true;
      try { const g2 = await aiJob(form(false, true), label + " (again)"), f3 = await dataOf(g2.blob, w, h);
        if (f3) { const l3 = greyLeft(f3.d.data, sel, FILL >> 16); if (l3 < left) { f2 = f3; left = l3; job = g2.job; } } }
      catch (e) { /* the first fill stays */ }
    }
    // the model itself from the first photo (only the filled part is new)
    const fd2 = f2.d; for (let i = 0; i < sel.length; i++) if (!sel[i]) { fd2.data[i * 4] = first.data[i * 4]; fd2.data[i * 4 + 1] = first.data[i * 4 + 1]; fd2.data[i * 4 + 2] = first.data[i * 4 + 2]; fd2.data[i * 4 + 3] = 255; }
    f2.c.getContext("2d").putImageData(fd2, 0, 0);
    R.shots.fill = { green: c, mask: m, result: f2.c };
    return { blob: await blobOf(f2.c), job, left, again };
  }
  /** 2.995.0: everything a photo needs, taken AT THE CLICK (the view, its shots, the prompt docker's references, the name) - so
   *  the next click can turn the view and queue another while this one is still being made */
  function capture(text) {
    const P = PP(), V = P && P.state && P.state.V; if (!V || !P.state.M) return null;
    const cv = V.canvas, sz = shotSize(cv.clientWidth, cv.clientHeight, 1024), w = sz.w, h = sz.h;
    const used = usedPictures(P.state.M.arch, P.state.M.f);
    used.refs = refTiles((() => { try { return typeof refs !== "undefined" ? refs : root.refs; } catch (e) { return root.refs; } })());   // eslint-disable-line no-undef - the prompt docker's (index.html's top-level `refs`)
    const p = plan(text, !!used.bg, used.refs);
    V.setSel({ f: [], e: [], k: [] }); if (P.state.A && P.state.A.setSel) P.state.A.setSel(null);
    let model, photo, depth;
    try {
      model = V.shot(w, h, { clean: true, transparent: true });                                   // the model alone (alpha from its silhouette)
      photo = V.shot(w, h, Object.assign({ clean: true, photo: true }, p.mode === "fill" ? { fill: FILL } : {}));
      depth = V.shot(w, h, { clean: true, depth: true });
    } finally { V.setSel(P.state.sel); }
    const md = model.getContext("2d").getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = md[i * 4 + 3];
    const scene = sceneWords(P.state.M.arch, P.state.M.f, { furn: (t) => { try { const pc = root.PPFurn && root.PPFurn.pieces().find((x) => x.type === t); return pc ? pc.label : t; } catch (e) { return t; } },
      mat: (k) => { try { const m = root.H3HouseGeo && root.H3HouseGeo.MATERIALS[k]; return m ? m.label || k : k; } catch (e) { return k; } },
      daz: (() => { try { const D = root.H3DazScene; return D ? D.list().filter((id) => { const r = D.rig(id); return r && r.outer.visible; }).length : 0; } catch (e) { return 0; } })() });
    const name = realName(P.nameNow ? P.nameNow() : (($("ppName") || {}).value || "model"));
    return { k: ++S.seq, text, w, h, used, plan: p, alpha, scene, name, shots: { photo, depth, model } };
  }
  function paintBusy() {
    if (typeof root.paintGoLabel === "function") try { root.paintGoLabel(); } catch (e) { /* fine */ }
    const b = $("ppReal"); if (b) b.textContent = "✨ Photo" + (S.runs ? " · " + S.runs : "");
  }
  /* ---- the run: the ✨ Photo button and the prompt docker's ✏ Edit (Sketcher) both come here - the same rule (plan) */
  async function run(text) {
    const R = capture(text); if (!R) { say("📷 the Sketcher's view is not ready"); return; }
    S.runs++; paintBusy();
    try { return await make(R); } finally { S.runs = Math.max(0, S.runs - 1); paintBusy(); }
  }
  async function make(R) {
    const E = await engines(), st = $("styleSel"), style = sketcherStyle(ownStyle(), st ? st.value : "", E);   // 2.696.0: the bar's Photo style
    if (style) keep(style);
    if (!style) { say("📷 no edit model - install one (Qwen Image Edit, FLUX Kontext, FLUX.2 Klein ...) in the Model manager"); return; }
    const { w, h, used, plan: p, text, scene } = R, tag = "📷 #" + R.k;
    R.style = style; R.tag = tag;
    let c = R.shots.photo;
    if (p.mode === "placed") { const pc = await placedPic(p.env.src, R.shots.model); if (pc) c = pc; }
    R.shots.sent = c; S.shots = R.shots;
    const blob = await blobOf(c), dblob = await blobOf(R.shots.depth);
    // 2.652.0: the model's pictures (materials, the backdrop) as a labelled board = picture 3; 2.991.0: ONE reference alone = that picture, whole
    used.single = used.refs.length === 1 && !used.tiles.length && !used.bg;
    const bc = !used.single && (used.tiles.length || used.bg || used.refs.length) ? await boardPic(used) : used.single ? await refPic(used.refs[0].src) : null;
    const bblob = bc ? await blobOf(bc) : null;
    R.shots.board = bc; S.board = bc ? boardCaptions(used) : null;
    const form = (withBoard, prompt) => {
      const fd = new FormData();
      fd.append("crop", blob, "sketcher.png");
      fd.append("ref0", dblob, "sketcher_depth.png"); fd.append("ref_desc", "depth map"); fd.append("ref_raw", "1");
      if (withBoard) fd.append("ref1", bblob, "sketcher_materials.png");
      const fields = { mode: "edit", prompt: prompt || promptFor(text, withBoard ? used : null, scene, { placed: p.mode === "placed", fill: p.mode === "fill" }), style_id: style, strength: 100, count: 1, width: w, height: h, whole: "1" };
      Object.keys(fields).forEach((k) => fd.append(k, String(fields[k])));
      if (root.H3Neg && root.H3Neg.get && root.H3Neg.get()) fd.append("negative", root.H3Neg.get());
      S.sent = { prompt: fields.prompt, board: !!withBoard, scene, placed: p.mode === "placed", fill: p.mode === "fill", mode: p.mode, retry: !!prompt };
      return fd;
    };
    const what = [used.tiles.length || used.bg ? "its materials" : "", used.refs.length ? used.refs.length + " reference picture" + (used.refs.length > 1 ? "s" : "") : "", p.words ? "your prompt" : ""].filter(Boolean);
    const label = tag + " a real photo of the model" + (p.mode === "fill" ? " (step 1 of 2)" : "");
    say(tag + " a real photo of the model" + (what.length ? " + " + what.join(" + ") : " (the scene only)") + " - queued (" + ((E.edit.find((x) => x.id === style) || {}).name || style) + ")…");
    let board = !!bblob, got;
    try { got = await aiJob(form(board), label); }
    catch (e) {
      if (!(e.refused && bblob && /picture\(s\)|takes \d|at most/i.test(e.message || ""))) throw e;   // this edit model takes two pictures: without the board
      board = false; got = await aiJob(form(false), label);
      say(tag + " queued without the materials / references board - this edit model takes two pictures (Qwen Image Edit 2511 / FLUX.2 Klein take three)");
    }
    // 2.995.0: the photo came back still the 3D render (a grey mannequin) - once more with short, direct words
    const sent = c.getContext("2d").getImageData(0, 0, w, h).data;
    let pic = got.blob, job = got.job, change = -1, retried = false;
    const d1 = await dataOf(pic, w, h); if (d1) change = modelChange(sent, d1.d.data, R.alpha, 3);
    if (change >= 0 && change < UNCHANGED) {
      retried = true; say(tag + " the photo came back still looking like the 3D model - trying once more…");
      try { const g2 = await aiJob(form(board, retryPrompt(text, p)), label + " (again)"), d2 = await dataOf(g2.blob, w, h), c2 = d2 ? modelChange(sent, d2.d.data, R.alpha, 3) : -1;
        if (c2 > change) { pic = g2.blob; job = g2.job; change = c2; } }
      catch (e) { /* the first stays */ }
    }
    let fill = null;
    if (p.mode === "fill") {   // 2.993.0: pass 2 - the place round the model
      try { fill = await fillPass(R, pic); if (fill) pic = fill.blob; }
      catch (e) { say(tag + " the place round the model could not be filled (" + (e.message || e) + ") - keeping the first photo"); await new Promise((ok) => setTimeout(ok, 1500)); }
    }
    // a REAL image: the project's Image assets (+ a plain layer in the image editor when it is on screen)
    const up = new FormData(); up.append("file", new File([pic], R.name, { type: pic.type || "image/png" }), R.name);
    const saved = await (await root.fetch("/api/passets", { method: "POST", body: up })).json();
    if (!saved || !saved.name) throw new Error((saved && saved.error) || "it could not be filed in the Image assets");
    if (typeof root.refreshAssets === "function") try { root.refreshAssets(); } catch (e) { /* fine */ }
    if (typeof root.loadPAssets === "function") try { root.loadPAssets(); } catch (e) { /* fine */ }
    const url = "/passets/images/" + encodeURIComponent(saved.name), IE = root.imageEditorInstance && root.imageEditorInstance.E;
    if (IE && shown("imageeditdock")) try { IE.load(url, "📷 " + saved.name, !!(IE.S && IE.S.w)); } catch (e) { /* fine */ }
    const still = [change >= 0 && change < UNCHANGED ? "it still looks like the 3D model - try another edit model or more words" : "", fill && fill.left > GREY_LEFT ? "some of the place is still grey" : ""].filter(Boolean);
    say(tag + " a real photo of the model - in the Image assets as " + saved.name + (still.length ? " (" + still.join("; ") + ")" : "") + (S.runs > 1 ? " · " + (S.runs - 1) + " more being made" : ""));
    S.last = { k: R.k, asset: saved.name, url, job, fillJob: fill ? fill.job : null, placed: p.mode === "placed", fill: p.mode === "fill", mode: p.mode, change, retried, left: fill ? fill.left : null, fillAgain: !!(fill && fill.again) };
    try { if (root.H3TestEvent) root.H3TestEvent("sketcher_real", saved.name); } catch (e) { /* fine */ }
    return S.last;
  }
  root.H3SketcherReal = Object.assign({ state, run, link, tick, last: () => S.last, linked: () => S.linked, shots: () => S.shots, runs: () => S.runs }, api);
  setInterval(tick, 700);
  doc.addEventListener("DOMContentLoaded", tick);
})(typeof window !== "undefined" ? window : globalThis);
