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
  // (2.991.0's REF1 / REFS - "give the whole picture its look - its place …" - are gone in 2.996.0: a reference handed over for
  //  the whole picture came back AS the picture. The model's own references now ride as SUBJ1 / SUBJS, the place in step 2)
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
  /* 2.989.0 - 2.995.0 asked ONE edit job to make the model real AND replace the grey with the prompt's place, gave it the
     reference pictures "for the whole picture's look", and pasted that job's model back under the fill. 2.996.0 (Tim: "photo or
     edit in sketcher from prompt produced 0/10 directed images ... sometime just the actual reference picture, sometime the
     right pose but gray background, sometimes a mannequin on the right background. please check to see if the logic statements
     don't conflict"): ONE JOB PER STEP, each checked.
     STEP 1 (promptFor) only makes the MODEL real - on the flat grey, which it is told to KEEP (nothing else is asked of it), or
       on the model's own backdrop / sky. It gets the materials board and the references FOR THE MODEL (person, face, clothing,
       object ... - groupRefs), never the place's: a picture given "its place, its look" came back as that picture.
     STEP 2 only makes the PLACE: the grey painted green and filled (the words, a "style" reference's look); with an
       "environment" reference the photo of the model is CUT OUT onto that very picture and only the band at its edge is
       blended (the ground under it, its shadow, its outline).
     CHECKED: step 1 must keep the render's outlines (edgeCorr - a copied reference has other outlines) AND change it
       (modelChange - a grey mannequin copied back does not): else once more, alone (no references). Step 2 must not leave grey
       / green (greyLeft): else once more, strict. Whatever still fails is said in the last message, never hidden. */
  const FILL = 0x808080;
  const KEEP_GREY = "Keep the flat plain grey background exactly as it is: plain grey with nothing drawn on it (the place around the model is added afterwards).";
  const OWN_BG = "Keep the background of {img1} the same place, made real.";
  const SUBJ1 = "{img3} is a reference for the model itself";
  const SUBJS = "{img3} is a board of references for the model itself (each tile says what it is for): use each for that part, in the render's pose, shapes and camera angle";
  /** step 1's words (pure): board = {tiles, bg, refs (the model's own references), single}; opt.own = the model's backdrop stays */
  function promptFor(text, board, scene, opt) {
    const t = String(text || "").trim(), words = t && t !== DEFAULT ? t : "", own = !!(opt && opt.own);
    const mats = board && ((board.tiles || []).length || board.bg), subj = board && (board.refs || []).length, r0 = subj ? board.refs[0] : null;
    return (scene ? leadFor(scene) : LEAD) + " " + DEPTH
      + (mats ? " " + BOARD + (board.bg ? BOARD_BG : "") + "." : "")
      + (subj ? " " + (board.single ? SUBJ1 + (r0.role ? " (" + r0.role + ")" : "") + ": the model looks like it - its face, body, hair, clothes or materials - in the render's pose, shapes and camera angle" : SUBJS) + "." : "")
      + " " + (own ? OWN_BG : KEEP_GREY)
      + (words ? "\nWhat the photo is for (use it for the model itself" + (own ? "" : " - keep the grey") + "): " + words : "");
  }
  /** the second try's words when step 1 failed its check (pure): short and direct, no references */
  function retryPrompt(text, p) {
    const t = String(text || "").trim(), w = t && t !== DEFAULT ? t : "", own = !!(p && p.mode === "own");
    return "Make {img1} a real photograph. Nothing may stay looking like a grey 3D model, a mannequin or a render: real skin, hair, clothes, real materials and textures, real light and shadows. Keep exactly the same shapes, pose, layout and camera angle ({img2} is its depth map). "
      + (own ? OWN_BG : KEEP_GREY) + (w ? "\nWhat the photo is for (use it for the model itself): " + w : "");
  }
  const ENV_RE = /^(environment|background|location|place|scene|setting)$/i, STYLE_RE = /^style$/i, FRAME_RE = /^(first|last) frame$/i;
  const roleOf = (r) => String((r && r.role) || "");
  /** the prompt docker's references by what they are for (pure): env = the first "environment" (the place - step 2), style =
   *  the first "style" (the place's look - step 2), subject = the rest (person, face, clothing, object, wall ... - step 1),
   *  unused = more environments / styles, first / last frames */
  function groupRefs(list) {
    const a = (Array.isArray(list) ? list : []).filter(Boolean), env = a.find((r) => ENV_RE.test(roleOf(r))) || null, style = a.find((r) => STYLE_RE.test(roleOf(r))) || null;
    const subject = a.filter((r) => !ENV_RE.test(roleOf(r)) && !STYLE_RE.test(roleOf(r)) && !FRAME_RE.test(roleOf(r)));
    return { env, style, subject, unused: a.filter((r) => r !== env && r !== style && !subject.includes(r)) };
  }
  /** how a photo is made (pure) - the same for both buttons: mode own (the model's backdrop / sky stays: step 1 alone) | place
   *  (an environment reference: step 1, then cut out onto it) | fill (step 1 on the grey, then the grey filled) */
  function plan(text, hasBg, refs) {
    const t = String(text || "").trim(), words = !!t && t !== DEFAULT, g = groupRefs(refs);
    const mode = hasBg ? "own" : g.env ? "place" : "fill";
    return { mode, words, env: mode === "place" ? g.env : null, style: mode === "fill" ? g.style : null, subject: g.subject,
      unused: g.unused.concat(mode === "own" ? [g.env, g.style].filter(Boolean) : mode === "place" && g.style ? [g.style] : []) };
  }
  /** what each reference is used for, in words (pure) - for the messages: "Reference 1 (person) → the model's look" */
  function refUse(p, list) {
    return (Array.isArray(list) ? list : []).filter(Boolean).map((r) => String(r.cap || "Reference").replace(/ \(.*$/, "") + " (" + (roleOf(r) || "person") + ") → "
      + (r === p.env ? "the place (the model is put into it)" : r === p.style ? "the look of the place"
        : (p.carriedOut || []).includes(r) ? "left out: the 👤 character in the scene was made from it - its head already carries that face"
        : (p.faceOut || []).includes(r) ? "left out: the camera sees the face at " + Math.round(p.faceAngle) + "° (more than " + FACE_LIMIT + "° from straight on) - the render's own head is kept"
        : p.subject.includes(r) ? "the model's look" + (p.mode === "own" ? "" : " - a place? set its Type to environment") : "not used here"));
  }
  /** how much the model changed between picture 1 and the photo (pure): the mean RGB difference 0..255 where the model is
   *  (alpha >= 128); a, b = RGBA data of the same size; -1 = no model in view. A grey 3D mannequin copied back comes out ~0 */
  function modelChange(a, b, alpha, step) {
    const k = Math.max(1, step | 0); let sum = 0, n = 0;
    for (let i = 0; i < alpha.length; i += k) { if (alpha[i] < 128) continue; const j = i * 4; sum += Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]); n++; }
    return n ? sum / (3 * n) : -1;
  }
  /** the luminance at 1 / s size (block means) */
  function lumaSmall(d, w, h, s) {
    const W = Math.max(1, Math.floor(w / s)), H = Math.max(1, Math.floor(h / s)), out = new Float32Array(W * H);
    for (let y = 0; y < H * s; y++) for (let x = 0; x < W * s; x++) { const i = (y * w + x) * 4; out[Math.floor(y / s) * W + Math.floor(x / s)] += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }
    for (let i = 0; i < out.length; i++) out[i] /= s * s;
    return { W, H, L: out };
  }
  /** do two pictures have the same OUTLINES round the model (pure): the correlation (-1..1) of their edge strengths at ~128 px,
   *  in the model's box (alpha >= 128, 8 % bigger). A real photo of the render keeps them; a copied reference picture or a
   *  different scene does not. 1 = no model in view (nothing to judge) */
  function edgeCorr(a, b, w, h, alpha) {
    const s = Math.max(1, Math.round(Math.max(w, h) / 128)), A = lumaSmall(a, w, h, s), B = lumaSmall(b, w, h, s), W = A.W, H = A.H;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H * s; y += s) for (let x = 0; x < W * s; x += s) if (alpha[y * w + x] >= 128) { const X = x / s, Y = y / s; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
    if (x1 < 0) return 1;
    const px = Math.round((x1 - x0) * 0.08) + 1, py = Math.round((y1 - y0) * 0.08) + 1;
    x0 = Math.max(1, x0 - px); y0 = Math.max(1, y0 - py); x1 = Math.min(W - 2, x1 + px); y1 = Math.min(H - 2, y1 + py);
    const mag = (L, x, y) => { const g = (X, Y) => L[Y * W + X];
      const gx = g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1) - g(x - 1, y - 1) - 2 * g(x - 1, y) - g(x - 1, y + 1), gy = g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1) - g(x - 1, y - 1) - 2 * g(x, y - 1) - g(x + 1, y - 1);
      return Math.sqrt(gx * gx + gy * gy); };
    let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const p = mag(A.L, x, y), q = mag(B.L, x, y); n++; sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q; }
    if (n < 16) return 1;
    const va = saa - sa * sa / n, vb = sbb - sb * sb / n;
    return va <= 1e-6 || vb <= 1e-6 ? 0 : (sab - sa * sb / n) / Math.sqrt(va * vb);
  }
  /** the part of the filled area that is still a plain backdrop (pure): 0..1 - the flat grey (±14), green, or a flat
   *  colourless studio grey / white (no texture); greenOnly = green alone (the edge band, where the place is real) */
  function greyLeft(data, sel, grey, greenOnly) {
    const G = grey == null ? 128 : grey; let bad = 0, n = 0;
    for (let i = 0; i < sel.length; i += 3) {
      if (!sel[i]) continue; n++; const j = i * 4, r = data[j], g = data[j + 1], b = data[j + 2];
      if (g > 180 && r < 90 && b < 90) { bad++; continue; }
      if (greenOnly) continue;
      if (Math.abs(r - G) <= 14 && Math.abs(g - G) <= 14 && Math.abs(b - G) <= 14) { bad++; continue; }
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), k = j + 4;
      if (mx - mn <= 10 && mx >= 90 && k + 2 < data.length && Math.abs(data[k] - r) <= 2 && Math.abs(data[k + 1] - g) <= 2 && Math.abs(data[k + 2] - b) <= 2) bad++;
    }
    return n ? bad / n : 0;
  }
  const UNCHANGED = 9, EDGE_OK = 0.25, GREY_LEFT = 0.3;
  /** step 1's check (pure): {ok, why} - why "shape" (other outlines: not the model - a copied reference) | "render" (still
   *  the 3D render: a grey mannequin) */
  function judge(change, corr) {
    if (change < 0) return { ok: true, why: "" };
    if (corr < EDGE_OK) return { ok: false, why: "shape" };
    if (change < UNCHANGED) return { ok: false, why: "render" };
    return { ok: true, why: "" };
  }
  /** the better of two step-1 photos (pure): a passing one; else the one that kept the shape; else the one that changed more */
  function better(a, b) {
    if (!b) return a; if (!a) return b;
    if (a.ok !== b.ok) return a.ok ? a : b;
    const sa = a.corr >= EDGE_OK, sb = b.corr >= EDGE_OK;
    if (sa !== sb) return sa ? a : b;
    return sa ? (b.change > a.change ? b : a) : (b.corr > a.corr ? b : a);
  }
  /* 2.999.0 (Tim: "when the angle is too different from the reference picture i get very bad picture"): an edit model can only
     copy a face it can SEE - a straight-on photo given for a head seen from the side makes it invent one. The camera's angle
     to the character's face is measured (faceAngle) and past FACE_LIMIT the references that carry a FACE (person, face, hair,
     expression) stay out of step 1 - the render's own head is kept, made real; clothing, body, objects … still go. */
  const FACE_LIMIT = 40, FACE_ROLES = /^(person|face|hair|expression|head)$/i;
  const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len: (a) => Math.hypot(a[0], a[1], a[2]) };
  /** how far (degrees, 0 = straight on) the camera is from looking the face in the eye (pure): head = the head bone, l / r = the
   *  eye bones, neck = the neck bone (the head's up), cam = the camera's position - all world [x, y, z]; null when unknown */
  function faceAngle(head, l, r, neck, cam) {
    if (!head || !l || !r || !neck || !cam) return null;
    const side = v3.sub(l, r), up = v3.sub(head, neck), mid = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, (l[2] + r[2]) / 2];
    let fwd = v3.cross(side, up); const n = v3.len(fwd); if (n < 1e-9) return null; fwd = fwd.map((x) => x / n);
    if (v3.dot(fwd, v3.sub(mid, head)) < 0) fwd = fwd.map((x) => -x);                    // toward the eyes
    const to = v3.sub(cam, mid), m = v3.len(to); if (m < 1e-9) return null;
    return Math.acos(Math.max(-1, Math.min(1, v3.dot(fwd, to) / m))) * 180 / Math.PI;
  }
  /** the model's own references for step 1 at this face angle (pure) -> {keep, out} - faces left out past FACE_LIMIT */
  function refsForAngle(subject, angle, carried) {
    const C = (Array.isArray(carried) ? carried : []).filter(Boolean), isC = (r) => C.some((c) => (c.url && c.url === r.src) || (c.name && c.name === r.name));
    const a = (Array.isArray(subject) ? subject : []).filter((r) => !isC(r)), carriedOut = (Array.isArray(subject) ? subject : []).filter(isC);   // 2.999.0: 👤 a character made from it
    if (angle == null || angle <= FACE_LIMIT) return { keep: a.slice(), out: [], carriedOut };
    return { keep: a.filter((r) => !FACE_ROLES.test(roleOf(r) || "person")), out: a.filter((r) => FACE_ROLES.test(roleOf(r) || "person")), carriedOut };
  }
  /** the reference to put the model INTO: the first one whose Type is "environment" (or null) */
  function envRef(list) { return groupRefs(list).env; }
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
  function fillPrompt(text, hasRef, strict, what) {
    const t = String(text || "").trim(), words = t && t !== DEFAULT ? t : "";
    return (strict ? "Every green pixel must become part of a real photographed place - not one may stay green or grey. " : "") + "The green area is the place around the person or object in {img1}: fill all of it with a real, detailed photographic place - ground, surroundings and sky - in the same light and perspective, so it is one photograph. Never leave green, grey, white or a plain backdrop. The person or object in {img1} stays exactly as it is."
      + (hasRef ? " {img2} is the reference picture: the place has its look - its kind of place, colours, light and mood." : "")
      + (words ? "\nThe place and the scene: " + words : what ? "\nA real place that suits " + what + "." : "");
  }
  /** 2.996.0: the edge band's words (the model cut out onto an environment picture): only the seam is new */
  function ringPrompt(text) {
    const t = String(text || "").trim(), words = t && t !== DEFAULT ? t : "";
    return "The green band in {img1} is the edge where the person or object meets the place around it: fill it so they stand naturally in that place - the ground under them, their contact shadows and their outline - matching the photo on both sides. Never leave green. Change nothing else."
      + (words ? "\nThe scene: " + words : "");
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
    if (root.PPProject && root.PPProject.tiles) root.PPProject.tiles(A).forEach((t) => { if (!used.has(t.id)) used.set(t.id, t); });   // 3.6.0: 📽 the projected pictures
    const tiles = [...used.values()].map((u) => Object.assign(u, { where: u.where.slice(0, 6) }));
    const bg = A.bg ? { src: A.bg.src, name: A.bg.name, kind: A.bg.kind } : null;
    return { tiles, bg };
  }
  /** the board's tile captions (pure): "Kitchen floor, Bed floor" … the background last */
  function boardCaptions(u) { return u.tiles.map((t) => t.where.join(", ")).concat(u.bg ? ["Background (" + (u.bg.kind === "sky" ? "360° sky" : "backdrop") + ")"] : []).concat((u.refs || []).map((r) => r.cap)); }
  /** 2.987.0 (pure): the prompt docker's reference pictures as board tiles - pictures only, 6 at most, "Reference n (its words)" */
  function refTiles(list) {
    return (Array.isArray(list) ? list : []).filter((r) => r && r.url && !(r.file && r.file.type && !/^image\//.test(r.file.type))).slice(0, 6)
      .map((r, i) => ({ src: r.url, name: String((r.file && r.file.name) || r.name || ""), role: r.role === "other" ? String(r.roleOther || "").trim() : String(r.role || ""), cap: "Reference " + (i + 1) + (r.desc ? " (" + String(r.desc).slice(0, 40) + ")" : r.role && r.role !== "person" ? " (" + r.role + ")" : "") }));   // 2.993.0: + role
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
  const api = { FACE_LIMIT, faceAngle, refsForAngle, KEEP_GREY, OWN_BG, SUBJ1, SUBJS, groupRefs, refUse, edgeCorr, judge, better, ringPrompt, EDGE_OK, plan, modelChange, greyLeft, retryPrompt, UNCHANGED, GREY_LEFT, envRef, bgMask, greenFill, fillPrompt, FILL, refTiles, sketcherStyle, DEFAULT, LEAD, DEPTH, BOARD, promptFor, sceneWords, leadFor, usedPictures, boardCaptions, linkedNow, pickEditStyle, shotSize, realName };
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
  /** a picture (src) cover-fitted to w x h (cropped to the shot's shape) -> RGBA data | null */
  async function coverData(src, w, h) {
    const im = await imgOf(src); if (!im) return null;
    const c = canvas(w, h), g = c.getContext("2d"), k = Math.max(w / im.width, h / im.height), sw = w / k, sh = h / k;
    g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, w, h);
    return g.getImageData(0, 0, w, h);
  }
  /** a reference picture as a blob, 1024 px at most */
  async function refBlobOf(src) {
    const im = src ? await imgOf(src) : null; if (!im) return null;
    const k = Math.min(1, 1024 / Math.max(im.width, im.height)), c = canvas(Math.round(im.width * k), Math.round(im.height * k));
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return blobOf(c);
  }
  /** send one picture job to /api/aiedit and wait for it -> {blob, job} (throws the server's / the job's words) */
  async function aiJob(fd, label, R) {
    const res = await root.fetch("/api/aiedit", { method: "POST", body: fd }), j = await res.json();
    if (!res.ok) { const e = new Error(j.error || "refused"); e.refused = true; throw e; }
    if (typeof root.refreshJobs === "function") try { root.refreshJobs(); } catch (e) { /* fine */ }   // it is in the queue
    const id = j.jobs && j.jobs[0] && j.jobs[0].id; if (!id) throw new Error("no job");
    const out = await waitJob(id, label);
    if (R) (R.outs = R.outs || []).push(out);   // 2.998.0: a step's picture - taken out of the gallery when the photo is done
    return { blob: await (await root.fetch("/outputs/" + encodeURIComponent(out))).blob(), job: id, out };
  }
  /** step 2: `base` (RGBA data) with `sel` painted GREEN, filled under a noise mask by the edit model (/api/aiedit fill_edit -
   *  the Krita AI plugin's "fill the green"); outside sel stays base's pixels exactly. o = {prompt(withRef, strict), ref (blob |
   *  null), greenOnly, label} - a fill still grey / green: once more, strict, without the reference.
   *  -> {data, job, left, again} | null (nothing to fill) */
  async function fillPass(R, base, sel, o) {
    const { w, h, style, tag } = R;
    let n = 0; for (let i = 0; i < sel.length; i++) n += sel[i];
    if (n < sel.length * 0.005) return null;
    const c = canvas(w, h), green = new ImageData(new Uint8ClampedArray(base.data), w, h); greenFill(green.data, sel); c.getContext("2d").putImageData(green, 0, 0);
    const m = canvas(w, h), mg = m.getContext("2d"), mi = mg.createImageData(w, h);
    for (let i = 0; i < sel.length; i++) mi.data[i * 4 + 3] = sel[i] ? 0 : 255;                // transparent = what is filled
    mg.putImageData(mi, 0, 0);
    const r = canvas(w, h), rg = r.getContext("2d"); rg.putImageData(base, 0, 0); rg.globalCompositeOperation = "destination-in"; rg.drawImage(m, 0, 0);
    const [cb, mb, rb] = [await blobOf(c), await blobOf(m), await blobOf(r)];
    const form = (withRef, strict) => {
      const fd = new FormData();
      fd.append("crop", cb, "sketcher_fill.png"); fd.append("mask", mb, "sketcher_fill_mask.png"); fd.append("rgba", rb, "sketcher_fill_hole.png");
      if (withRef) { fd.append("ref0", o.ref, "sketcher_reference.png"); fd.append("ref_desc", "the reference picture"); }
      const fields = { mode: "generate", fill_edit: "1", edit_style_id: style, fill_kind: "generate", style_id: style, prompt: o.prompt(withRef, strict), ref_raw: "1",
        strength: 100, count: 1, width: w, height: h, mask_grow: 0, mask_feather: Math.max(2, Math.round(0.008 * Math.max(w, h))) };
      Object.keys(fields).forEach((k) => fd.append(k, String(fields[k])));
      R.sent2 = S.sent2 = { prompt: fields.prompt, ref: !!withRef, filled: n, of: sel.length, strict: !!strict, ring: !!o.greenOnly };
      return fd;
    };
    say(o.label + "…");
    let got;
    try { got = await aiJob(form(!!o.ref, false), o.label, R); }
    catch (e) { if (!(e.refused && o.ref && /picture\(s\)|takes \d|at most|reference/i.test(e.message || ""))) throw e; got = await aiJob(form(false, false), o.label, R); }
    let f2 = await dataOf(got.blob, w, h); if (!f2) throw new Error("the filled photo could not be read");
    let left = greyLeft(f2.d.data, sel, FILL >> 16, o.greenOnly), job = got.job, again = false;
    if (left > GREY_LEFT) {
      say(tag + " the place came back " + Math.round(left * 100) + "% plain / green - filling it once more…"); again = true;
      try { const g2 = await aiJob(form(false, true), o.label + " (again)", R), f3 = await dataOf(g2.blob, w, h);
        if (f3) { const l3 = greyLeft(f3.d.data, sel, FILL >> 16, o.greenOnly); if (l3 < left) { f2 = f3; left = l3; job = g2.job; } } }
      catch (e) { /* the first fill stays */ }
    }
    const out = f2.d; for (let i = 0; i < sel.length; i++) if (!sel[i]) { out.data[i * 4] = base.data[i * 4]; out.data[i * 4 + 1] = base.data[i * 4 + 1]; out.data[i * 4 + 2] = base.data[i * 4 + 2]; out.data[i * 4 + 3] = 255; }
    R.shots.fill = { green: c, mask: m };
    return { data: out, job, left, again };
  }
  /** 2.999.0: the face angle of the DAZ character nearest the camera (degrees) | null (no character / no eye bones) */
  function headAngle(V) {
    try {
      const D = root.H3DazScene, cam = V && V.cam && V.cam(); if (!D || !cam) return null;
      const T = cam.position.constructor, wp = (b) => { const q = b.getWorldPosition(new T()); return [q.x, q.y, q.z]; }, cp = [cam.position.x, cam.position.y, cam.position.z];
      let best = null;
      for (const id of D.list()) {
        const r = D.rig(id); if (!r || !r.outer.visible || !r.bones) continue;
        const f = (rx) => { for (const [bid, b] of r.bones) if (rx.test(bid)) return b; return null; };
        const head = f(/^head$/i), l = f(/^(l_?eye|lEye|left_?eye)$/i), rr = f(/^(r_?eye|rEye|right_?eye)$/i), neck = f(/^(neck2|neckUpper|neck_?upper|neck)$/i) || f(/^neck/i);
        if (!head || !l || !rr || !neck) continue;
        const hp = wp(head), d = Math.hypot(hp[0] - cp[0], hp[1] - cp[1], hp[2] - cp[2]), a = faceAngle(hp, wp(l), wp(rr), wp(neck), cp);
        if (a != null && (!best || d < best.d)) best = { d, a };
      }
      return best ? best.a : null;
    } catch (e) { return null; }
  }
  /** 2.995.0: everything a photo needs, taken AT THE CLICK (the view, its shots, the prompt docker's references, the name) - so
   *  the next click can turn the view and queue another while this one is still being made */
  function capture(text) {
    const P = PP(), V = P && P.state && P.state.V; if (!V || !P.state.M) return null;
    const cv = V.canvas, sz = shotSize(cv.clientWidth, cv.clientHeight, 1024), w = sz.w, h = sz.h;
    const used = usedPictures(P.state.M.arch, P.state.M.f);
    const all = refTiles((() => { try { return typeof refs !== "undefined" ? refs : root.refs; } catch (e) { return root.refs; } })());   // eslint-disable-line no-undef - the prompt docker's (index.html's top-level `refs`)
    const p = plan(text, !!used.bg, all);
    p.faceAngle = headAngle(V);                                                                    // 2.999.0: the face's angle to the camera
    const fa = refsForAngle(p.subject, p.faceAngle, (() => { try { return root.H3DazTools && root.H3DazTools.carried ? root.H3DazTools.carried() : []; } catch (e) { return []; } })());
    p.faceOut = fa.out; p.carriedOut = fa.carriedOut;
    used.refs = fa.keep;                                                                           // 2.996.0: step 1 gets the model's own references only
    V.setSel({ f: [], e: [], k: [] }); if (P.state.A && P.state.A.setSel) P.state.A.setSel(null);
    let model, photo, depth;
    try {
      model = V.shot(w, h, { clean: true, transparent: true });                                   // the model alone (alpha from its silhouette)
      photo = V.shot(w, h, Object.assign({ clean: true, photo: true }, p.mode === "own" ? {} : { fill: FILL }));
      depth = V.shot(w, h, { clean: true, depth: true });
    } finally { V.setSel(P.state.sel); }
    const md = model.getContext("2d").getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = md[i * 4 + 3];
    const scene = sceneWords(P.state.M.arch, P.state.M.f, { furn: (t) => { try { const pc = root.PPFurn && root.PPFurn.pieces().find((x) => x.type === t); return pc ? pc.label : t; } catch (e) { return t; } },
      mat: (k) => { try { const m = root.H3HouseGeo && root.H3HouseGeo.MATERIALS[k]; return m ? m.label || k : k; } catch (e) { return k; } },
      daz: (() => { try { const D = root.H3DazScene; return D ? D.list().filter((id) => { const r = D.rig(id); return r && r.outer.visible; }).length : 0; } catch (e) { return 0; } })() });
    const name = realName(P.nameNow ? P.nameNow() : (($("ppName") || {}).value || "model"));
    return { k: ++S.seq, text, w, h, used, refs: all, plan: p, alpha, scene, name, shots: { photo, depth, model } };
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
    const { w, h, used, plan: p, text, scene, alpha } = R, tag = "📷 #" + R.k;
    R.style = style; R.tag = tag;
    const c = R.shots.photo; R.shots.sent = c; S.shots = R.shots;
    const blob = await blobOf(c), dblob = await blobOf(R.shots.depth);
    // ---- STEP 1: the model made real (on the grey, kept grey - or on its own backdrop); the board = its materials + its own references
    used.single = used.refs.length === 1 && !used.tiles.length && !used.bg;
    const bc = !used.single && (used.tiles.length || used.bg || used.refs.length) ? await boardPic(used) : used.single ? await refPic(used.refs[0].src) : null;
    const bblob = bc ? await blobOf(bc) : null;
    R.shots.board = bc; S.board = bc ? boardCaptions(used) : null;
    const form = (withBoard, prompt) => {
      const fd = new FormData();
      fd.append("crop", blob, "sketcher.png");
      fd.append("ref0", dblob, "sketcher_depth.png"); fd.append("ref_desc", "depth map"); fd.append("ref_raw", "1");
      if (withBoard) fd.append("ref1", bblob, "sketcher_materials.png");
      const fields = { mode: "edit", prompt: prompt || promptFor(text, withBoard ? used : null, scene, { own: p.mode === "own" }), style_id: style, strength: 100, count: 1, width: w, height: h, whole: "1" };
      Object.keys(fields).forEach((k) => fd.append(k, String(fields[k])));
      if (root.H3Neg && root.H3Neg.get && root.H3Neg.get()) fd.append("negative", root.H3Neg.get());
      R.sent = S.sent = { prompt: fields.prompt, board: !!withBoard, scene, mode: p.mode, retry: !!prompt };
      return fd;
    };
    const uses = refUse(p, R.refs), steps = p.mode === "own" ? 1 : 2;
    const label = tag + " step 1" + (steps > 1 ? " of 2" : "") + ": the model made real";
    say(tag + " queued (" + ((E.edit.find((x) => x.id === style) || {}).name || style) + ")" + (uses.length ? " - " + uses.join(" · ") : "") + "…");
    let board = !!bblob, got;
    try { got = await aiJob(form(board), label, R); }
    catch (e) {
      if (!(e.refused && bblob && /picture\(s\)|takes \d|at most/i.test(e.message || ""))) throw e;   // this edit model takes two pictures: without the board
      board = false; got = await aiJob(form(false), label, R);
      say(tag + " queued without the materials / references board - this edit model takes two pictures (Qwen Image Edit 2511 / FLUX.2 Klein take three)");
    }
    const sent = c.getContext("2d").getImageData(0, 0, w, h).data;
    const look = async (g) => { const d = await dataOf(g.blob, w, h); if (!d) return null; const change = modelChange(sent, d.d.data, alpha, 3), corr = edgeCorr(sent, d.d.data, w, h, alpha), j = judge(change, corr);
      return { d: d.d, job: g.job, change, corr, ok: j.ok, why: j.why }; };
    let best = await look(got), retried = false;
    if (!best) throw new Error("the photo could not be read");
    if (!best.ok) {   // a copied reference (other outlines) or the render back (a grey mannequin): once more, alone, short words
      retried = true;
      say(tag + (best.why === "shape" ? " the photo did not keep the model's shape (a reference copied?)" : " the photo still looks like the 3D model") + " - once more, without the references…");
      try { best = better(best, await look(await aiJob(form(false, retryPrompt(text, p)), label + " (again)", R))); } catch (e) { /* the first stays */ }
    }
    const notes = best.ok ? [] : [best.why === "shape" ? "step 1 did not keep the model's shape - try another edit model" : "it still looks like the 3D model - try another edit model or more words"];
    // ---- STEP 2: the place
    let out = best.d, fill = null, step2 = "none";
    if (p.mode !== "own") {
      const what = scene && scene.any ? (scene.building ? "a building with " : "") + listOf(scene.parts) : "";
      try {
        if (p.mode === "place") {   // the model cut out onto the environment picture, only its edge band blended
          const env = await coverData(p.env.src, w, h); if (!env) throw new Error("the environment picture could not be read");
          const L = Math.max(w, h), bg = bgMask(alpha, w, h, Math.max(1, Math.round(0.004 * L))), inv = new Uint8Array(alpha.length);
          for (let i = 0; i < inv.length; i++) inv[i] = alpha[i] >= 128 ? 0 : 255;
          const grown = bgMask(inv, w, h, Math.max(3, Math.round(0.03 * L))), ring = new Uint8Array(alpha.length), comp = new ImageData(new Uint8ClampedArray(best.d.data), w, h);
          for (let i = 0; i < bg.length; i++) { if (bg[i]) { comp.data[i * 4] = env.data[i * 4]; comp.data[i * 4 + 1] = env.data[i * 4 + 1]; comp.data[i * 4 + 2] = env.data[i * 4 + 2]; comp.data[i * 4 + 3] = 255; } ring[i] = grown[i] && bg[i] ? 1 : 0; }
          out = comp; step2 = "placed";
          fill = await fillPass(R, comp, ring, { prompt: () => ringPrompt(text), ref: null, greenOnly: true, label: tag + " step 2 of 2: the model put into the place" });
          if (fill) { out = fill.data; step2 = "placed+blended"; }
        } else {                    // the grey round the model painted green and filled
          const sel = bgMask(alpha, w, h, Math.max(2, Math.round(0.006 * Math.max(w, h)))), ref = p.style ? await refBlobOf(p.style.src) : null;
          fill = await fillPass(R, best.d, sel, { prompt: (withRef, strict) => fillPrompt(text, withRef, strict, what), ref, label: tag + " step 2 of 2: the place round the model" });
          if (fill) { out = fill.data; step2 = "filled"; }
        }
        if (fill && fill.left > GREY_LEFT) notes.push(p.mode === "place" ? "the edge band stayed green" : "some of the place is still a plain backdrop");
      } catch (e) {
        step2 = "failed";
        notes.push((p.mode === "place" ? "the edge band could not be blended (" : "the place could not be made (") + (e.message || e) + ")" + (p.mode === "place" ? " - the model is cut out onto the picture" : " - the background is still grey"));
      }
    }
    const oc = canvas(w, h); oc.getContext("2d").putImageData(out, 0, 0); R.shots.result = oc;
    const pic = await blobOf(oc);
    // a REAL image: the project's Image assets (+ a plain layer in the image editor when it is on screen)
    const up = new FormData(); up.append("file", new File([pic], R.name, { type: "image/png" }), R.name);
    const saved = await (await root.fetch("/api/passets", { method: "POST", body: up })).json();
    if (!saved || !saved.name) throw new Error((saved && saved.error) || "it could not be filed in the Image assets");
    if (typeof root.refreshAssets === "function") try { root.refreshAssets(); } catch (e) { /* fine */ }
    if (typeof root.loadPAssets === "function") try { root.loadPAssets(); } catch (e) { /* fine */ }
    // 2.998.0: the gallery shows the FINISHED photo only - its steps' pictures out of output/ (routes/sketcherPhoto.js)
    let gal = null;
    try { const gf = new FormData(); gf.append("file", new File([pic], R.name, { type: "image/png" }), R.name); gf.append("name", R.name); gf.append("drop", JSON.stringify(R.outs || []));
      gal = await (await root.fetch("/api/sketcher/photo", { method: "POST", body: gf })).json(); } catch (e) { gal = null; }
    if (typeof root.refreshGallery === "function") try { root.refreshGallery(); } catch (e) { /* fine */ }
    const url = "/passets/images/" + encodeURIComponent(saved.name), IE = root.imageEditorInstance && root.imageEditorInstance.E;
    if (IE && shown("imageeditdock")) try { IE.load(url, "📷 " + saved.name, !!(IE.S && IE.S.w)); } catch (e) { /* fine */ }
    say(tag + (notes.length ? " ⚠ " : " ") + "a real photo of the model - in the Image assets as " + saved.name + (notes.length ? " (" + notes.join("; ") + ")" : "") + (S.runs > 1 ? " · " + (S.runs - 1) + " more being made" : ""));
    S.last = { k: R.k, asset: saved.name, url, job: best.job, fillJob: fill ? fill.job : null, mode: p.mode, step2, change: best.change, corr: best.corr, ok: best.ok, why: best.why, retried,
      left: fill ? fill.left : null, fillAgain: !!(fill && fill.again), notes, uses, faceAngle: p.faceAngle, faceOut: (p.faceOut || []).length, gallery: gal && gal.name, steps: (R.outs || []).slice() };
    try { if (root.H3TestEvent) root.H3TestEvent("sketcher_real", saved.name); } catch (e) { /* fine */ }
    return S.last;
  }
  root.H3SketcherReal = Object.assign({ state, run, link, tick, last: () => S.last, linked: () => S.linked, shots: () => S.shots, runs: () => S.runs }, api);
  setInterval(tick, 700);
  doc.addEventListener("DOMContentLoaded", tick);
})(typeof window !== "undefined" ? window : globalThis);
