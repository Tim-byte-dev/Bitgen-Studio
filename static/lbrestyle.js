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
 *   2.677.0 (Tim: "show the progress of the generation with a small bar below the picture"): #lb_rsbar under the picture
 *               (above the preview's bar) - queued / loading the models = a moving stripe, the sampler's steps = the bar
 *               filling ("🧸 Pixar · step 12 of 25 · 48 %"), done = full + green (it fades), failed = red
 *   2.679.0 (Tim: "after the style change render is complete in image preview, show the finished image in preview, add a
 *               sbs button so user can see before and after style change"): done = the result shown in the preview - opened
 *               again (the original before it) when it was closed meanwhile; ⇆ Before / after (#lb_sbs) beside 🎨 Style: the
 *               original and the result side by side (#lb_sbsview over the picture, labelled) - for every restyled picture
 *               (the pairs kept in localStorage h3.restyle.pairs, so a result opened later from the gallery has it too)
 *   2.681.0 (Tim: "when a style type is set in image preview keep that style in the dropdown, user will click the change
 *               style button next to it each time"): the looks are a DROPDOWN (#lb_rslook - the one picked is kept,
 *               localStorage h3.restyle.look) + 🎨 Change style (#lb_restyle) beside it renders the picked look each press;
 *   2.684.0      the dropdown as wide as its words (it filled the bar) - the bar's buttons' height, font and corners;
 *   2.685.0      Override style reaches a whole-picture refine with a checkpoint style (lib/infill.js whole - image to image
 *                with the style's own graph); the bar says what Override applied, or why not (j.override)
 *               the old menu is gone (its "With <style>" is the button's tooltip)
 * Pure (Node: scripts/test-restyle676.js, test-restyle677.js, test-restyle679.js): LOOKS, promptFor(look, how, orig),
 * fit(w, h), pickHow(styleId, engines), barState(job, label), pairsAdd(map, result, source, look). */
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
  /** 2.677.0: the bar for a job record (GET /api/jobs/:id) -> {pct (0-100) | null (a moving stripe), text, kind} (pure) */
  function barState(j, label) {
    const L = label ? label + " · " : "", st = j && j.status, pr = (j && j.progress) || null;
    if (!j || st === "queued" || !st) return { pct: null, text: L + "queued", kind: "wait" };
    if (st === "done") return { pct: 100, text: L + "done", kind: "done" };
    if (st !== "running") return { pct: 100, text: L + (st === "cancelled" ? "cancelled" : "failed - see the job log"), kind: "fail" };
    let pct = null;
    if (pr && pr.total > 0) pct = Math.max(0, Math.min(100, Math.round(100 * Math.min(+pr.step || 0, +pr.total) / pr.total)));
    else if (pr && Number.isFinite(+pr.pct) && +pr.pct > 0) pct = Math.max(0, Math.min(100, Math.round(+pr.pct)));
    const words = pr && pr.total > 0 ? "step " + Math.max(0, Math.min(+pr.step || 0, +pr.total)) + " of " + pr.total + " · " + pct + " %" : "loading the models";
    return { pct, text: L + words, kind: pct == null ? "wait" : "run" };
  }
  /** 2.679.0: remember which picture a result was made from (pure: a plain object, the newest 200 kept) */
  function pairsAdd(map, result, source, look) {
    const m = Object.assign({}, map || {}); if (!result || !source) return m;
    m[result] = { src: source.url, name: source.name, look: look || "", at: Date.now() };
    const keys = Object.keys(m); if (keys.length > 200) keys.sort((a, b) => (m[a].at || 0) - (m[b].at || 0)).slice(0, keys.length - 200).forEach((k) => delete m[k]);
    return m;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { LOOKS, KEEP, promptFor, fit, pickHow, barState, pairsAdd }; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const S = { busy: false, menu: null };
  const cur = () => { try { return lb && lb.items && lb.items[lb.i]; } catch (e) { return null; } };   // eslint-disable-line no-undef
  function say(t) { const n = $("lb_rsmsg"); if (n) { n.textContent = t || ""; n.title = t || ""; } }
  function css() {
    if ($("lbrsCss")) return;
    const st = doc.createElement("style"); st.id = "lbrsCss";
    st.textContent = "#lb_rsmenu{position:fixed;z-index:9400;background:var(--panel,#1c1915);border:1px solid var(--line,#3a342a);border-radius:6px;padding:4px 0;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:230px}"
      + "#lb_rsmenu .it{padding:6px 12px;cursor:pointer;white-space:nowrap}#lb_rsmenu .it:hover{background:#ffffff14}#lb_rsmenu .hd{padding:4px 12px 6px;opacity:.7;font-size:11px;white-space:normal;max-width:300px;border-bottom:1px solid var(--line,#3a342a);margin-bottom:3px}"
      // 2.684.0 (Tim: "fix the style dropdown in preview image it is too long and breaks the aesthetic"): the app's
      // select{width:100%} stretched it across the bar and folded every button onto two lines - now as wide as its words,
      // the height / font / corners of the bar's buttons
      + "#lb_rslook{width:auto;flex:none;max-width:150px;box-sizing:border-box;padding:4px 4px 4px 7px;font:inherit;font-size:.76rem;line-height:normal;"
      + "background:var(--panel-2);color:var(--text);border:1px solid var(--line);border-radius:6px;cursor:pointer;margin-right:-2px}"
      + "#lb_rslook:hover{border-color:var(--tiger,#f59e2c)}#lb_restyle,#lb_sbs{white-space:nowrap}"
      + "#lb_rsmsg{font-size:11px;opacity:.85;max-width:34ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      // 2.677.0: the progress bar under the picture
      + "#lb_rsbar{display:none;align-items:center;gap:8px;padding:3px 12px 2px;font-size:11px;transition:opacity .6s}#lb_rsbar.on{display:flex}#lb_rsbar.fade{opacity:0}"
      + "#lb_rsbar .tr{flex:1;height:5px;border-radius:3px;background:#ffffff1a;overflow:hidden;position:relative}"
      + "#lb_rsbar .fl{height:100%;width:0;background:var(--tiger,#f59e2c);border-radius:3px;transition:width .4s}"
      + "#lb_rsbar.wait .fl{width:30%;position:absolute;animation:lbrsSlide 1.3s ease-in-out infinite}#lb_rsbar.done .fl{background:#3fb950}#lb_rsbar.fail .fl{background:#d0383e}"
      + "#lb_rsbar .tx{white-space:nowrap;opacity:.85;min-width:0;overflow:hidden;text-overflow:ellipsis;max-width:46%}"
      + "@keyframes lbrsSlide{0%{left:-30%}100%{left:100%}}"
      // 2.679.0: before / after side by side
      + "#lb_sbsview{position:absolute;inset:0;display:flex;gap:6px;padding:6px;background:#000;z-index:5}#lb_sbsview figure{flex:1;margin:0;display:flex;flex-direction:column;min-width:0;min-height:0}"
      + "#lb_sbsview img{flex:1;min-height:0;width:100%;object-fit:contain}#lb_sbsview figcaption{font-size:11px;text-align:center;padding:4px;opacity:.85}#lb_sbs.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}";
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
  /* 2.679.0: the restyled pictures' originals (localStorage - a convenience; without it, this session's results only) */
  const PK = "h3.restyle.pairs";
  function pairs() { try { return JSON.parse(root.localStorage.getItem(PK) || "{}") || {}; } catch (e) { return S.pairs || {}; } }
  function remember(result, source, look) { const m = pairsAdd(pairs(), result, source, look); S.pairs = m; try { root.localStorage.setItem(PK, JSON.stringify(m)); } catch (e) { /* this session only */ } }
  const pairOf = (it) => (it && it.kind === "image" ? (it.before ? { src: it.before, name: it.beforeName || "", look: it.look || "" } : pairs()[it.name] || null) : null);
  function sbsOff() { const v = $("lb_sbsview"); if (v) v.remove(); const b = $("lb_sbs"); if (b) b.classList.remove("on"); }
  function sbsToggle() {
    if ($("lb_sbsview")) { sbsOff(); return false; }
    const it = cur(), p = pairOf(it), stage = $("lb_stage"); if (!p || !stage) return false;
    const v = doc.createElement("div"); v.id = "lb_sbsview";
    const fig = (src, cap) => { const f = doc.createElement("figure"), im = doc.createElement("img"), c = doc.createElement("figcaption"); im.src = src; im.alt = cap; c.textContent = cap; f.appendChild(im); f.appendChild(c); return f; };
    v.appendChild(fig(p.src, "Before" + (p.name ? " · " + p.name : ""))); v.appendChild(fig(it.url, "After" + (p.look ? " · " + p.look : "") + " · " + it.name));
    if (getComputedStyle(stage).position === "static") stage.style.position = "relative";
    stage.appendChild(v); $("lb_sbs").classList.add("on");
    return true;
  }
  function sbsPaint() { const b = $("lb_sbs"); if (!b) return; sbsOff(); b.style.display = pairOf(cur()) ? "" : "none"; }
  /** 2.677.0: paint the bar under the picture from a job record (null = hide it) */
  function bar(j, label) {
    const B = $("lb_rsbar"); if (!B) return;
    clearTimeout(S.fadeT); clearTimeout(S.hideT);
    if (j === null) { B.className = ""; return; }
    const b = barState(j, label);
    B.className = "on " + b.kind; B.dataset.kind = b.kind;
    B.querySelector(".fl").style.width = b.pct == null ? "" : b.pct + "%";
    B.querySelector(".tx").textContent = b.text; B.title = b.text;
    B.setAttribute("aria-valuenow", b.pct == null ? "" : String(b.pct));
    if (b.kind === "done") { S.fadeT = setTimeout(() => { B.classList.add("fade"); }, 2500); S.hideT = setTimeout(() => { B.className = ""; }, 3200); }
    if (b.kind === "fail") S.hideT = setTimeout(() => { B.className = ""; }, 12000);
  }
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
      // 2.685.0: what Basic Settings' Override put on it (or why not) - said, not only in the job log
      const oi = j.override, ovw = oi ? (oi.applied ? " · Override: " + oi.applied : oi.note ? "" : " · Override: the style's own values") + (oi.note ? " · " + oi.note : "") : "";
      S.override = oi || null;
      say("🎨 " + L.label + " - queued (" + (st.name || st.id) + (how === "edit" ? ", edit" : ", refine " + L.strength + " %") + ")" + ovw + "…");
      if (ovw) { const m = $("lb_rsmsg"); if (m) m.title = ovw.replace(/^ · /, ""); }
      bar({ status: "queued" }, L.label);
      try { if (root.H3TestEvent) root.H3TestEvent("restyle_queued", id); } catch (e) { /* fine */ }
      let jj = null;
      for (let n = 0; n < 3600; n++) {
        await new Promise((ok) => setTimeout(ok, 1200));
        try { jj = await (await fetch("/api/jobs/" + encodeURIComponent(id))).json(); } catch (e) { continue; }
        bar(jj, L.label);                                                   // 2.677.0: the bar under the picture
        if (jj.status === "running") say(ovw ? "🎨" + ovw.replace(/^ · /, " ") : "");   // the bar under the picture says the rest (2.677.0); 2.685.0: Override's words stay
        if (jj.status && jj.status !== "running" && jj.status !== "queued") break;
      }
      if (!jj || jj.status !== "done") { bar(jj || { status: "failed" }, L.label); throw new Error("the render " + ((jj && jj.status) || "did not finish") + " - see the job log"); }
      const out = (jj.outputs && jj.outputs[0]) || jj.output; if (!out) throw new Error("the render made nothing");
      const item = { url: "/outputs/" + encodeURIComponent(out), kind: "image", name: out, before: it.url, beforeName: it.name, look: L.label };
      remember(out, it, L.label);
      // 2.679.0: the finished picture shown in the preview - the preview opened again (the original first) if it was closed
      if ($("lb").open) {
        const at = lb.items.indexOf(it), k = at >= 0 ? at : lb.i;
        lb.items.splice(k + 1, 0, item); lb.i = k + 1; if (typeof lbFilm === "function") lbFilm(); if (typeof lbShow === "function") lbShow();   // eslint-disable-line no-undef
      } else if (typeof lbOpen === "function") lbOpen([{ url: it.url, kind: "image", name: it.name }, item], 1);   // eslint-disable-line no-undef
      say("🎨 " + L.label + " - done: " + out);
      return out;
    } finally { S.busy = false; const b = $("lb_restyle"); if (b) b.disabled = false; }
  }
  /* 2.681.0: the look picked stays picked */
  const LK = "h3.restyle.look";
  function lookNow() { const s = $("lb_rslook"); return s && LOOKS.some((l) => l.id === s.value) ? s.value : LOOKS[0].id; }
  function tip() {
    const b = $("lb_restyle"); if (!b) return;
    const st = styleNow(), L = LOOKS.find((x) => x.id === lookNow());
    b.title = "Make this picture again as " + L.label.replace(/^\S+\s/, "") + " - with " + (st.name || "the prompt's image style") + (ovrOn() ? " + Basic Settings (Override style is on)" : " (the prompt's style)") + ". Pick another look in the dropdown first to change it.";
  }
  function boot() {
    const save = $("lb_save"); if (!save) { setTimeout(boot, 400); return; }
    if ($("lb_restyle")) return;
    css();
    const sel = doc.createElement("select"); sel.id = "lb_rslook"; sel.title = "The look 🎨 Change style makes - it stays picked"; sel.setAttribute("aria-label", "Look");
    LOOKS.forEach((L) => { const o = doc.createElement("option"); o.value = L.id; o.textContent = L.label; sel.appendChild(o); });
    let keep = ""; try { keep = root.localStorage.getItem(LK) || ""; } catch (e) { keep = ""; }
    sel.value = LOOKS.some((l) => l.id === keep) ? keep : LOOKS[0].id;
    sel.onchange = () => { try { root.localStorage.setItem(LK, sel.value); } catch (e) { /* this session only */ } tip(); };
    const b = doc.createElement("button"); b.className = "ghost"; b.id = "lb_restyle"; b.type = "button"; b.textContent = "🎨 Change style";
    b.onclick = (e) => { e.stopPropagation(); close(); const it = cur(); if (!it || it.kind !== "image") { say("🎨 pictures only"); return; } run(lookNow()).catch((er) => say("🎨 " + (er.message || er))); };
    b.onmouseenter = tip; b.onfocus = tip; tip();
    const msg = doc.createElement("span"); msg.id = "lb_rsmsg";
    save.parentNode.insertBefore(sel, save); save.parentNode.insertBefore(b, save); save.parentNode.insertBefore(msg, save);
    // 2.679.0: ⇆ Before / after - a restyled picture beside the one it was made from
    const sb = doc.createElement("button"); sb.className = "ghost"; sb.id = "lb_sbs"; sb.type = "button"; sb.textContent = "⇆ Before / after"; sb.style.display = "none";
    sb.title = "The picture this one was restyled from, side by side with it (click again to go back)";
    sb.onclick = (e) => { e.stopPropagation(); sbsToggle(); };
    save.parentNode.insertBefore(sb, sel);
    // 2.677.0: the progress bar - under the picture, above the preview's bar
    const pb = doc.createElement("div"); pb.id = "lb_rsbar"; pb.setAttribute("role", "progressbar"); pb.setAttribute("aria-valuemin", "0"); pb.setAttribute("aria-valuemax", "100");
    pb.innerHTML = '<div class="tr"><div class="fl"></div></div><span class="tx"></span>';
    const lbbar = save.closest(".lbbar"); if (lbbar && lbbar.parentNode) lbbar.parentNode.insertBefore(pb, lbbar);
    doc.addEventListener("pointerdown", (e) => { if (S.menu && !S.menu.contains(e.target) && e.target !== b) close(); }, true);
    // only for pictures: hidden while a video / sound is shown
    const nm = $("lb_name"); if (nm && root.MutationObserver) new root.MutationObserver(() => { const it = cur(), hide = it && it.kind !== "image"; b.style.display = hide ? "none" : ""; sel.style.display = hide ? "none" : ""; close(); sbsPaint(); tip(); }).observe(nm, { childList: true, characterData: true, subtree: true });
  }
  root.H3Restyle = { LOOKS, promptFor, fit, pickHow, barState, pairsAdd, bar, run, open: openMenu, close, look: lookNow, sbs: sbsToggle, sbsOff, pairs, state: () => S };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
