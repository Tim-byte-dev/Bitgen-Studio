/* bitGen Studio — static/lbrestyle.js (2.676.0): THE IMAGE PREVIEW'S 🎨 STYLE ▾ - the picture shown, made again in another
 * look: 📷 Photoreal, 🧸 Pixar, 🧊 2.5D, 🌸 Anime, 🖍 Cartoon (window.H3Restyle).
 * Tim (verbatim): "in the image preview dialog, add a button with a dropdown to change the style of the picture,
 * photoreal, pixar, 2.5D, anime,cartoon. use the style chosen in prompt unless overide is checked to generate the image
 * from the image being previewed"
 *   the model   the prompt's image style (#styleSel); with Basic Settings ▸ Override style ON its steps, CFG, seed,
 *               checkpoint, LoRAs ride along (index.html imgBasicsBody -> `ovr`; routes/aiedit.js + lib/imgOverride.js)
 *   how         an EDIT model (FLUX.2 Klein, Qwen Image Edit, FLUX Kontext …) = ✨ Edit with an instruction (the picture
 *               kept, only its look changed); an SDXL / Illustrious / FLUX.1 … style = Refine over the WHOLE picture
 *               (its look's words + the picture's own prompt, a strength that changes the look but keeps the layout);
 *               a style that can do neither = said (pick an edit model or an SDXL / FLUX style in the prompt)
 *   the result  an ordinary image job (the queue, the gallery, the log); when it is done it opens in this preview
 * Pure (Node: scripts/test-restyle676.js): LOOKS, promptFor(look, how, orig), fit(w, h), pickHow(styleId, engines). */
(function (root) {
  "use strict";
  const KEEP = "Keep the same picture: the composition, framing, subjects, their faces, poses, clothes and the background - change only the rendering style.";
  const LOOKS = [
    { id: "photoreal", label: "📷 Photoreal", strength: 55,
      edit: "Turn this into a photorealistic photograph: real-world materials and skin, natural light and shadows, true-to-life colours, shot on a full-frame camera with a 50 mm lens.",
      words: "photorealistic photograph, realistic lighting, detailed natural skin texture, real materials, sharp focus, 50mm photo" },
    { id: "pixar", label: "🧸 Pixar", strength: 70,
      edit: "Turn this into a Pixar-style 3D animated film still: stylised characters with large expressive eyes, soft rounded shapes, smooth subsurface-scattered skin, warm cinematic lighting, a high-quality CGI render.",
      words: "pixar style 3d animation, cgi render, stylized character, big expressive eyes, soft rounded shapes, subsurface scattering, cinematic lighting" },
    { id: "d25", label: "🧊 2.5D", strength: 65,
      edit: "Turn this into a 2.5D stylised illustration: a hand-painted 3D look with simplified forms, layered depth planes, soft volumetric light and painterly textures, like stylised game art.",
      words: "2.5d stylized illustration, painted 3d look, layered depth, volumetric light, painterly textures, stylized game art" },
    { id: "anime", label: "🌸 Anime", strength: 70,
      edit: "Turn this into an anime illustration: clean line art, cel shading, vibrant colours, expressive anime eyes, a polished anime key visual.",
      words: "anime style, anime key visual, clean line art, cel shading, vibrant colors, expressive eyes" },
    { id: "cartoon", label: "🖍 Cartoon", strength: 72,
      edit: "Turn this into a cartoon: bold clean outlines, flat bright colours, simplified shapes and playful exaggerated features, a western animation look.",
      words: "cartoon style, bold outlines, flat bright colors, simplified shapes, playful exaggerated features, western animation" },
  ];
  /** the words sent: an edit model's instruction; a Refine's look words + the picture's own prompt (pure) */
  function promptFor(look, how, orig) {
    const L = typeof look === "string" ? LOOKS.find((x) => x.id === look) : look; if (!L) return "";
    if (how === "edit") return L.edit + " " + KEEP;
    const o = String(orig || "").replace(/\s+/g, " ").trim().slice(0, 900);
    return L.words + (o ? ", " + o : "");
  }
  /** the render's size: about one megapixel, the picture's shape, multiples of 16 (pure) */
  function fit(w, h) {
    const W = Math.max(16, w | 0), H = Math.max(16, h | 0), k = Math.sqrt(1048576 / (W * H)), r = (v) => Math.max(256, Math.round(v * k / 16) * 16);
    return { w: r(W), h: r(H) };
  }
  /** how the prompt's style restyles: "edit" | "refine" | null  (engines = GET /api/aiedit/engines) (pure) */
  function pickHow(id, E) {
    if (!id || !E) return null;
    if ((E.edit || []).some((x) => x.id === id)) return "edit";
    if ((E.inpaint || []).some((x) => x.id === id && x.refine !== false)) return "refine";
    return null;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { LOOKS, KEEP, promptFor, fit, pickHow }; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const S = { busy: false, menu: null };
  const cur = () => { try { return lb && lb.items && lb.items[lb.i]; } catch (e) { return null; } };   // eslint-disable-line no-undef
  function say(t) { const n = $("lb_rsmsg"); if (n) { n.textContent = t || ""; n.title = t || ""; } }
  function css() {
    if ($("lbrsCss")) return;
    const st = doc.createElement("style"); st.id = "lbrsCss";
    st.textContent = "#lb_rsmenu{position:fixed;z-index:9400;background:var(--panel,#1c1915);border:1px solid var(--line,#3a342a);border-radius:6px;padding:4px 0;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:230px}"
      + "#lb_rsmenu .it{padding:6px 12px;cursor:pointer;white-space:nowrap}#lb_rsmenu .it:hover{background:#ffffff14}#lb_rsmenu .hd{padding:4px 12px 6px;opacity:.7;font-size:11px;white-space:normal;max-width:300px;border-bottom:1px solid var(--line,#3a342a);margin-bottom:3px}"
      + "#lb_rsmsg{font-size:11px;opacity:.85;max-width:34ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
    doc.head.appendChild(st);
  }
  function styleNow() {
    const sel = $("styleSel"), id = sel ? sel.value : "";
    const o = sel && sel.selectedOptions && sel.selectedOptions[0];
    return { id, name: o ? o.textContent.trim() : id };
  }
  const ovrOn = () => (typeof root.ovrStyleOn === "function" ? root.ovrStyleOn() : (typeof ovrStyleOn === "function" ? ovrStyleOn() : false));   // eslint-disable-line no-undef
  function ovrBody() {
    let b = {}; try { b = (typeof imgBasicsBody === "function" ? imgBasicsBody({}) : {}) || {}; } catch (e) { b = {}; }   // eslint-disable-line no-undef
    const o = {}; ["steps", "cfg", "model", "lora_weights", "extra_loras", "mm_override"].forEach((k) => { if (b[k] !== undefined) o[k] = b[k]; });
    return { ovr: o, seed: b.seed };
  }
  function close() { if (S.menu) { S.menu.remove(); S.menu = null; } }
  function openMenu(btn) {
    close(); css();
    const it = cur(); if (!it || it.kind !== "image") { say("🎨 pictures only"); return; }
    const st = styleNow(), m = doc.createElement("div"); m.id = "lb_rsmenu"; m.setAttribute("role", "menu");
    const hd = doc.createElement("div"); hd.className = "hd";
    hd.textContent = "With " + (st.name || "the prompt's style") + (ovrOn() ? " + Basic Settings (Override style is on)" : " (the prompt's style)");
    m.appendChild(hd);
    LOOKS.forEach((L) => { const d = doc.createElement("div"); d.className = "it"; d.dataset.look = L.id; d.setAttribute("role", "menuitem"); d.textContent = L.label; d.onclick = () => { close(); run(L.id).catch((e) => say("🎨 " + (e.message || e))); }; m.appendChild(d); });
    (btn.closest("dialog") || doc.body).appendChild(m); S.menu = m;   // inside the preview: a modal dialog is on the top layer
    const r = btn.getBoundingClientRect(), W = root.innerWidth || 1200;
    m.style.left = Math.max(4, Math.min(r.left, W - m.offsetWidth - 4)) + "px"; m.style.top = Math.max(4, r.top - m.offsetHeight - 4) + "px";
  }
  async function engines() { const r = await fetch("/api/aiedit/engines"); return r.ok ? r.json() : { edit: [], inpaint: [] }; }
  const canvas = (w, h) => { const c = doc.createElement("canvas"); c.width = w; c.height = h; return c; };
  const blob = (c) => new Promise((ok) => c.toBlob(ok, "image/png"));
  async function run(lookId) {
    if (S.busy) { say("🎨 still making the last one"); return null; }
    const it = cur(), L = LOOKS.find((x) => x.id === lookId); if (!it || !L) return null;
    const st = styleNow(); if (!st.id) throw new Error("pick an image style in the prompt first");
    const E = await engines(), how = pickHow(st.id, E);
    if (!how) throw new Error((st.name || "this style") + " can't remake a picture - pick an edit model (FLUX.2 Klein, Qwen Image Edit …) or an SDXL / FLUX style in the prompt");
    S.busy = true; $("lb_restyle").disabled = true;
    try {
      say("🎨 " + L.label + " - preparing…");
      const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("the picture could not be read")); im.src = it.url; });
      const sz = fit(img.naturalWidth, img.naturalHeight), c = canvas(sz.w, sz.h), g = c.getContext("2d");
      g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, sz.w, sz.h);
      let orig = ""; if (how === "refine") { try { const j = await (await fetch("/api/job-meta?name=" + encodeURIComponent(it.name))).json(); orig = (j && (j.prompt || (j.meta && j.meta.prompt))) || ""; } catch (e) { orig = ""; } }
      const fd = new FormData();
      fd.append("crop", await blob(c), "restyle.png");
      if (how === "refine") { const empty = canvas(sz.w, sz.h); fd.append("mask", await blob(empty), "mask.png"); fd.append("rgba", await blob(empty), "hole.png"); }   // all of it is the selection
      const fields = { mode: how, prompt: promptFor(L, how, orig), style_id: st.id, strength: how === "edit" ? 100 : L.strength, count: 1, width: sz.w, height: sz.h, whole: "1" };
      if (ovrOn()) { const o = ovrBody(); fields.ovr = JSON.stringify(o.ovr); if (o.seed != null && o.seed >= 0) fields.seed = o.seed; }
      Object.keys(fields).forEach((k) => fd.append(k, String(fields[k])));
      if (root.H3Neg && root.H3Neg.get && root.H3Neg.get()) fd.append("negative", root.H3Neg.get());
      S.sent = fields;
      const r = await fetch("/api/aiedit", { method: "POST", body: fd }), j = await r.json();
      if (!r.ok) throw new Error(j.error || "refused");
      const id = j.jobs && j.jobs[0] && j.jobs[0].id; if (!id) throw new Error("no job");
      if (typeof root.refreshJobs === "function") try { root.refreshJobs(); } catch (e) { /* fine */ }
      say("🎨 " + L.label + " - queued (" + (st.name || st.id) + (how === "edit" ? ", edit" : ", refine " + L.strength + " %") + ")…");
      try { if (root.H3TestEvent) root.H3TestEvent("restyle_queued", id); } catch (e) { /* fine */ }
      let jj = null;
      for (let n = 0; n < 3600; n++) {
        await new Promise((ok) => setTimeout(ok, 1200));
        try { jj = await (await fetch("/api/jobs/" + encodeURIComponent(id))).json(); } catch (e) { continue; }
        if (jj.status === "running" && root.H3Steps && jj.progress) say("🎨 " + L.label + " - " + root.H3Steps.text(jj.progress));
        if (jj.status && jj.status !== "running" && jj.status !== "queued") break;
      }
      if (!jj || jj.status !== "done") throw new Error("the render " + ((jj && jj.status) || "did not finish") + " - see the job log");
      const out = (jj.outputs && jj.outputs[0]) || jj.output; if (!out) throw new Error("the render made nothing");
      const item = { url: "/outputs/" + encodeURIComponent(out), kind: "image", name: out };
      if ($("lb").open) { lb.items.splice(lb.i + 1, 0, item); lb.i += 1; if (typeof lbFilm === "function") lbFilm(); if (typeof lbShow === "function") lbShow(); }   // eslint-disable-line no-undef
      say("🎨 " + L.label + " - done: " + out);
      return out;
    } finally { S.busy = false; const b = $("lb_restyle"); if (b) b.disabled = false; }
  }
  function boot() {
    const save = $("lb_save"); if (!save) { setTimeout(boot, 400); return; }
    if ($("lb_restyle")) return;
    css();
    const b = doc.createElement("button"); b.className = "ghost"; b.id = "lb_restyle"; b.type = "button"; b.textContent = "🎨 Style ▾";
    b.title = "Make this picture again in another look - Photoreal, Pixar, 2.5D, Anime, Cartoon (with the prompt's image style; Basic Settings' values when Override style is on)";
    b.onclick = (e) => { e.stopPropagation(); if (S.menu) close(); else openMenu(b); };
    const msg = doc.createElement("span"); msg.id = "lb_rsmsg";
    save.parentNode.insertBefore(b, save); save.parentNode.insertBefore(msg, save);
    doc.addEventListener("pointerdown", (e) => { if (S.menu && !S.menu.contains(e.target) && e.target !== b) close(); }, true);
    // only for pictures: hidden while a video / sound is shown
    const nm = $("lb_name"); if (nm && root.MutationObserver) new root.MutationObserver(() => { const it = cur(); b.style.display = it && it.kind !== "image" ? "none" : ""; close(); }).observe(nm, { childList: true, characterData: true, subtree: true });
  }
  root.H3Restyle = { LOOKS, promptFor, fit, pickHow, run, open: openMenu, close, state: () => S };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
