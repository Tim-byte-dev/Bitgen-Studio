/* bitGen Studio — ext/pushpulldock/ppmatpick.js (2.651.0): THE SKETCHER'S MATERIAL PICKER + BACKGROUND (window.PPMatPick).
 * Tim (verbatim): "can we add material tools to sketcher, so wall_1 interior, wall_1 exterior, windows, etc, and use reference
 * images for the texture, background etc." (the background: a flat backdrop or a 360° sky - Tim's pick)
 *
 *   open(anchor, {value, A, title, onPick(val, add), onTex(id, {size, rot})})   a popup by anchor:
 *       a colour (the colour box), the built-in materials (brick, stone, timber, tiles ... their procedural textures), the
 *       model's PICTURES (A.tex - each a texture: Size = metres a repeat, Turn °) and new pictures from the 🖼 Refs docker,
 *       the project's images or a file. A new picture is saved in the project's images (POST /api/passets) first, then
 *       onPick("tex:<id>", entry) - the caller adds the entry to A.tex in its own undo step.
 *   swatch(val, size) -> an element showing a value (a colour, a material, a picture's thumbnail)
 *   bgPanel(box, {A, edit(fn)}) the background rows (None / Backdrop / 360° sky, the picture, Turn) for a panel
 *   applyBg(V, A)   the view's background from A.bg: a backdrop fills the view behind the model (cover - its own aspect kept),
 *                   a 360° sky (an equirectangular picture) wraps round the scene (Z up), turned by bg.rot; none = the theme's
 *   pure: newId(A), sources lists, coverRepeat(imgAspect, viewAspect) -> {rx, ry, ox, oy} */
(function (root) {
  "use strict";
  const doc = root.document;
  const F = () => root.PPFurn;
  const el = (t, c, txt) => { const e = doc.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };

  /** a free picture id: p1, p2 ... */
  function newId(A) { const used = new Set(((A && A.tex) || []).map((t) => t.id)); let i = 1; while (used.has("p" + i)) i++; return "p" + i; }
  /** a backdrop "cover": the picture fills the view, its aspect kept (the rest cropped) - texture repeat / offset */
  function coverRepeat(ia, va) {
    if (!(ia > 0) || !(va > 0)) return { rx: 1, ry: 1, ox: 0, oy: 0 };
    if (va > ia) { const ry = ia / va; return { rx: 1, ry, ox: 0, oy: (1 - ry) / 2 }; }
    const rx = va / ia; return { rx, ry: 1, ox: (1 - rx) / 2, oy: 0 };
  }

  /* ---- the pictures there are: the 🖼 Refs docker's (index.html's refs tray), the project's images */
  function refPictures() {
    let r = [];
    try { r = typeof refs !== "undefined" && Array.isArray(refs) ? refs : []; } catch (e) { r = []; }   // eslint-disable-line no-undef
    return r.filter((x) => x && x.file && /^image\//.test(x.file.type || "image/")).map((x) => ({ name: x.file.name || "reference", url: x.url, blob: x.file }));
  }
  async function projectPictures() {
    try { const j = await (await fetch("/api/passets?scope=project")).json(); return (j.images || []).map((a) => ({ name: a.name, url: "/passets/images/" + encodeURIComponent(a.name), src: "/passets/images/" + a.name })); }
    catch (e) { return []; }
  }
  /** a picture's average colour (#rrggbb) - the swatch / the floorplan / exports */
  function avgOf(url) {
    return new Promise((ok) => {
      const im = new Image(); im.onload = () => { try { const c = doc.createElement("canvas"); c.width = c.height = 8; const g = c.getContext("2d"); g.drawImage(im, 0, 0, 8, 8); const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; ok("#" + [r, gg, b].map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("")); } catch (e) { ok("#999999"); } };
      im.onerror = () => ok("#999999"); im.src = url;
    });
  }
  /** a picture into the project's images (once) -> its src "/passets/images/<name>" */
  async function keep(pic) {
    if (pic.src) return pic.src;
    const blob = pic.blob || (await (await fetch(pic.url)).blob());
    const fd = new FormData(); fd.append("file", blob, (pic.name || "picture").replace(/[^\w.\- ]+/g, "_") || "picture.png");
    const r = await fetch("/api/passets?scope=project", { method: "POST", body: fd }); const j = await r.json();
    if (!r.ok || !j.name) throw new Error(j.error || "the picture was not saved");
    return "/passets/images/" + j.name;
  }
  /** a new picture material entry (not yet in A.tex) */
  async function entryFor(A, pic) {
    const src = await keep(pic), avg = await avgOf(src.replace(/^\/passets\/images\/(.*)$/, (m, n) => "/passets/images/" + encodeURIComponent(n)));
    return { id: newId(A), name: String(pic.name || "Picture").replace(/\.[a-z0-9]+$/i, "").slice(0, 80), src, size: 1, rot: 0, avg };
  }
  const urlOf = (src) => String(src || "").replace(/^\/passets\/images\/(.*)$/, (m, n) => "/passets/images/" + encodeURIComponent(n));

  /** an element showing a value */
  function swatch(val, size, A) {
    const s = el("span", "ppmsw"); s.style.cssText = `display:inline-block;width:${size || 18}px;height:${size || 18}px;border-radius:3px;border:1px solid var(--line,#444);vertical-align:middle;background-size:cover;background-position:center`;
    const t = typeof val === "string" && val.startsWith("tex:") ? ((A && A.tex) || []).find((x) => x.id === val.slice(4)) || (F() && F().texInfo ? F().texInfo(val.slice(4)) : null) : null;
    if (t) { s.style.backgroundImage = `url("${urlOf(t.src)}")`; s.title = t.name; }
    else { s.style.background = F() ? F().hex(val) : val; if (typeof val === "string" && val.startsWith("mat:") && F()) { const m = F().materials().find((x) => "mat:" + x.key === val); s.title = m ? m.label : val; if (m && m.tex) s.style.backgroundImage = "repeating-linear-gradient(45deg, rgba(0,0,0,.18) 0 2px, transparent 2px 5px)"; } }
    return s;
  }

  let pop = null;
  function close() { if (pop) { pop.remove(); pop = null; doc.removeEventListener("pointerdown", outside, true); } }
  function outside(e) { if (pop && !pop.contains(e.target)) close(); }
  function css() {
    if (doc.getElementById("ppMatPickCss")) return;
    const st = el("style"); st.id = "ppMatPickCss";
    st.textContent = `.ppmp{position:fixed;z-index:2147483200;width:330px;max-height:min(560px,80vh);overflow:auto;background:var(--panel,#1d1a15);color:var(--text,#e8e2d6);border:1px solid var(--line,#3a342a);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.45);padding:8px;font-size:12px}
.ppmp h4{margin:8px 0 4px;font-size:11px;font-weight:600;opacity:.75;text-transform:uppercase;letter-spacing:.04em}.ppmp .g{display:flex;flex-wrap:wrap;gap:4px}
.ppmp .it{cursor:pointer;border:2px solid transparent;border-radius:4px;padding:0;background:none}.ppmp .it.on{border-color:var(--accent,#f59e2c)}.ppmp .it .ppmsw{width:34px;height:34px}
.ppmp .row{display:flex;align-items:center;gap:6px;margin:4px 0}.ppmp .row input[type=number]{width:64px}.ppmp .hint{opacity:.65;font-size:11px}.ppmp button.ghost{font-size:11px}`;
    doc.head.appendChild(st);
  }
  /** the picker */
  function open(anchor, o) {
    close(); css(); o = o || {};
    const A = o.A || {}, cur = o.value;
    pop = el("div", "ppmp"); pop.id = "ppMatPick"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Materials");
    const head = el("div", "row"); head.appendChild(swatch(cur, 22, A)); head.appendChild(el("b", "", o.title || "Material")); pop.appendChild(head);
    const pick = (v, add) => { try { o.onPick && o.onPick(v, add || null); } finally { close(); } };
    // a colour
    pop.appendChild(el("h4", "", "Colour"));
    const cr = el("div", "row"), ci = el("input"); ci.type = "color"; ci.value = /^#[0-9a-f]{6}$/i.test(String(cur)) ? cur : (F() ? F().hex(cur) : "#cccccc"); ci.title = "A plain colour";
    const cb = el("button", "ghost", "Use this colour"); cb.type = "button"; cb.onclick = () => pick(ci.value.toLowerCase()); cr.appendChild(ci); cr.appendChild(cb); pop.appendChild(cr);
    // the built-in materials
    if (F()) {
      pop.appendChild(el("h4", "", "Materials"));
      const g = el("div", "g");
      F().materials().forEach((m) => { const v = "mat:" + m.key, b = el("button", "it" + (v === cur ? " on" : "")); b.type = "button"; b.title = m.label; b.appendChild(swatch(v, 34, A)); b.onclick = () => pick(v); g.appendChild(b); });
      pop.appendChild(g);
    }
    // this model's pictures
    pop.appendChild(el("h4", "", "Pictures in this model"));
    const pg = el("div", "g");
    (A.tex || []).forEach((t) => { const v = "tex:" + t.id, b = el("button", "it" + (v === cur ? " on" : "")); b.type = "button"; b.title = t.name; b.appendChild(swatch(v, 34, A)); b.onclick = () => pick(v); pg.appendChild(b); });
    if (!(A.tex || []).length) pg.appendChild(el("span", "hint", "none yet - add one below"));
    pop.appendChild(pg);
    const t0 = typeof cur === "string" && cur.startsWith("tex:") ? (A.tex || []).find((t) => t.id === cur.slice(4)) : null;
    if (t0 && o.onTex) {                                                 // the picked picture: its size + turn
      const r = el("div", "row"); r.appendChild(el("span", "", "Size (m)"));
      const sz = el("input"); sz.type = "number"; sz.step = "0.05"; sz.min = "0.05"; sz.value = t0.size; r.appendChild(sz);
      r.appendChild(el("span", "", "Turn °")); const rt = el("input"); rt.type = "number"; rt.step = "15"; rt.value = t0.rot; r.appendChild(rt);
      const ap = () => o.onTex(t0.id, { size: Math.max(0.05, +sz.value || 1), rot: +rt.value || 0 }); sz.onchange = ap; rt.onchange = ap;
      pop.appendChild(r); pop.appendChild(el("div", "hint", "Size = how many metres one copy of the picture covers (it repeats)."));
    }
    // new pictures
    pop.appendChild(el("h4", "", "Add a picture as a texture"));
    const msg = el("div", "hint", "");
    const addPic = async (pic) => { msg.textContent = "saving the picture in the project…"; try { const e = await entryFor(A, pic); pick("tex:" + e.id, e); } catch (x) { msg.textContent = "⚠ " + (x.message || x); } };
    const rp = refPictures();
    if (rp.length) {
      const rg = el("div", "g"); rp.forEach((pic) => { const b = el("button", "it"); b.type = "button"; b.title = "From the Refs docker: " + pic.name; const s = swatch("#888", 34); s.style.backgroundImage = `url("${pic.url}")`; b.appendChild(s); b.onclick = () => addPic(pic); rg.appendChild(b); });
      pop.appendChild(el("div", "hint", "🖼 From the Refs docker:")); pop.appendChild(rg);
    } else pop.appendChild(el("div", "hint", "🖼 The Refs docker has no pictures loaded."));
    const br = el("div", "row");
    const pb = el("button", "ghost", "Project images…"); pb.type = "button";
    pb.onclick = async () => { pb.disabled = true; const list = await projectPictures(); const g = el("div", "g"); list.slice(0, 80).forEach((pic) => { const b = el("button", "it"); b.type = "button"; b.title = pic.name; const s = swatch("#888", 34); s.style.backgroundImage = `url("${pic.url}")`; b.appendChild(s); b.onclick = () => addPic(pic); g.appendChild(b); }); if (!list.length) g.appendChild(el("span", "hint", "no images in this project")); br.after(g); };
    const fb = el("button", "ghost", "From a file…"); fb.type = "button";
    const fi = el("input"); fi.type = "file"; fi.accept = "image/*"; fi.style.display = "none"; fi.onchange = () => { const f = fi.files && fi.files[0]; if (f) addPic({ name: f.name, blob: f, url: URL.createObjectURL(f) }); };
    fb.onclick = () => fi.click();
    br.appendChild(pb); br.appendChild(fb); br.appendChild(fi); pop.appendChild(br); pop.appendChild(msg);
    doc.body.appendChild(pop);
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 100, bottom: 100, top: 100 };
    const W = root.innerWidth, H = root.innerHeight, ph = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(W - 340, r.left)) + "px";
    pop.style.top = (r.bottom + ph + 8 < H ? r.bottom + 4 : Math.max(8, r.top - ph - 4)) + "px";
    setTimeout(() => doc.addEventListener("pointerdown", outside, true), 0);
    return pop;
  }

  /* ---- the background */
  const bgCache = new Map();
  function applyBg(V, A) {
    if (!V || !V.scene) return;
    const T = V.T, b = A && A.bg, sc = V.scene;
    if (!b) { if (sc.userData.ppBg) { sc.background = null; sc.userData.ppBg = null; if (V.R && V.clear != null) V.R.setClearColor(V.clear, 1); V.draw && V.draw(); } return; }
    const key = b.kind + "|" + b.src;
    let tex = bgCache.get(key);
    const fit = () => {
      if (!tex || !tex.image || !tex.image.width) return;
      if (b.kind === "backdrop") { const c = V.canvas || (V.R && V.R.domElement), va = c ? c.clientWidth / Math.max(1, c.clientHeight) : 1.6, q = coverRepeat(tex.image.width / tex.image.height, va); tex.repeat.set(q.rx, q.ry); tex.offset.set(q.ox, q.oy); }
      V.draw && V.draw();
    };
    if (!tex) {
      tex = new T.TextureLoader().load(urlOf(b.src), () => fit()); if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      if (b.kind === "sky") tex.mapping = T.EquirectangularReflectionMapping;
      bgCache.set(key, tex); if (bgCache.size > 12) bgCache.delete(bgCache.keys().next().value);
    }
    sc.background = tex; sc.userData.ppBg = key;
    // 2.652.0: a shot of another shape (the ✨ real photo) fits the backdrop to it; no argument = the view's again
    V.bgFit = (asp) => { const t = sc.background; if (!t || !t.image || !t.image.width || !String(sc.userData.ppBg || "").startsWith("backdrop|")) return; const c = V.canvas, q = coverRepeat(t.image.width / t.image.height, asp || c.clientWidth / Math.max(1, c.clientHeight)); t.repeat.set(q.rx, q.ry); t.offset.set(q.ox, q.oy); };
    if (b.kind === "sky" && sc.backgroundRotation) sc.backgroundRotation.set(Math.PI / 2, (b.rot || 0) * Math.PI / 180, 0);   // Z up: the panorama's horizon on the ground
    fit();
    if (!V._ppBgResize && root.addEventListener) { V._ppBgResize = true; root.addEventListener("resize", () => { const t = sc.background; if (t && sc.userData.ppBg && sc.userData.ppBg.startsWith("backdrop|") && t.image && t.image.width) { const c = V.canvas, q = coverRepeat(t.image.width / t.image.height, c.clientWidth / Math.max(1, c.clientHeight)); t.repeat.set(q.rx, q.ry); t.offset.set(q.ox, q.oy); V.draw && V.draw(); } }); }
  }
  /** the background rows in a panel: kind, picture, turn - edit(fn(A)) changes the model in one undo step */
  function bgPanel(box, o) {
    const A = o.A, b = A.bg || null;
    const row = (label, node) => { const r = el("div", "ppr"); r.appendChild(el("span", "", label)); r.appendChild(node); box.appendChild(r); return r; };
    const sel = el("select"); [["", "None (the theme's)"], ["backdrop", "Backdrop - a picture behind the model"], ["sky", "360° sky - a panorama round the scene"]].forEach(([v, t]) => { const op = el("option", "", t); op.value = v; sel.appendChild(op); });
    sel.value = b ? b.kind : ""; sel.id = "ppBgKind";
    sel.onchange = () => { const k = sel.value; if (!k) return o.edit((A2) => { A2.bg = null; }); if (b && b.src) return o.edit((A2) => { A2.bg = Object.assign({}, b, { kind: k }); }); chooseBg(sel, k); };
    row("Background", sel);
    const chooseBg = (anchor, kind) => open(anchor, { A, title: kind === "sky" ? "The 360° sky (a panorama picture)" : "The backdrop picture", value: b && b.src ? null : null,
      onPick: (v, add) => { const t = add || (A.tex || []).find((x) => "tex:" + x.id === v); if (!t) { sel.value = b ? b.kind : ""; return; } o.edit((A2) => { A2.bg = { kind, src: t.src, name: t.name, rot: 0 }; }); } });
    if (b) {
      const pb = el("button", "ghost"); pb.type = "button"; pb.title = "Another picture"; const s = swatch("#888", 18); s.style.backgroundImage = `url("${urlOf(b.src)}")`; pb.appendChild(s); pb.appendChild(doc.createTextNode(" " + b.name)); pb.onclick = () => chooseBg(pb, b.kind);
      row("Picture", pb);
      if (b.kind === "sky") { const n = el("input"); n.type = "number"; n.step = "15"; n.value = b.rot || 0; n.onchange = () => o.edit((A2) => { A2.bg = Object.assign({}, A2.bg, { rot: +n.value || 0 }); }); row("Turn (°)", n); }
      box.appendChild(el("div", "pphint", b.kind === "sky" ? "An equirectangular (2 : 1) panorama works best - its horizon on the ground." : "The picture fills the view behind the model, whatever the view's shape (cropped, never stretched)."));
    } else box.appendChild(el("div", "pphint", "A backdrop or a 360° sky from a reference picture - the ✨ real photo and the image editor's ✏ Edit see it too."));
  }

  root.PPMatPick = { open, close, swatch, bgPanel, applyBg, newId, coverRepeat, refPictures, projectPictures, entryFor, urlOf };
})(typeof window !== "undefined" ? window : globalThis);
