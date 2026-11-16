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
 *   2.686.0      a style that is no edit model: ✏ the picture's LINE ART first (/api/aiedit/preprocess), then the look
 *                generated from it through the style family's line-art ControlNet (lineart=1; lib/aiEdit.js lineArtNet); no
 *                such ControlNet / the line art fails = picture to picture (2.685.0), said
 *   2.685.0      Override style reaches a whole-picture refine with a checkpoint style (lib/infill.js whole - image to image
 *                with the style's own graph); the bar says what Override applied, or why not (j.override)
 *               the old menu is gone (its "With <style>" is the button's tooltip)
 *   2.805.0 (Tim: "in preview dialog add a style dropdown next to the change style button, add a checkbox next to it to use
 *               basic settings. use the last basic settings the style used to change the style of the preview picture (show
 *               change style dropdown , button and the new button and new dropdown only when in picture mode"):
 *               #lb_rsstyle = the image style that makes it ("✎ The prompt's style" = #styleSel, as before; kept,
 *               localStorage h3.restyle.style); ☐ Basic Settings (#lb_rsbasic, kept, h3.restyle.basic) = the Basic Settings
 *               that style last had (misc/basic_settings.tmp via H3StyleBasic - the live ones when it is the prompt's style
 *               now) ride on the render: steps, CFG, seed, checkpoint (+ the image LoRAs / temporary LoRAs when live).
 *               It replaces Basic Settings ▸ Override style here (that switch is for the prompt's own renders). The look,
 *               🎨 Change style, the style and the tick are shown only while a PICTURE is shown.
 * Pure (Node: scripts/test-restyle676.js, test-restyle677.js, test-restyle679.js, test-restyle805.js): LOOKS, promptFor(look,
 * how, orig), fit(w, h), pickHow(styleId, engines), barState(job, label), pairsAdd(map, result, source, look),
 * ovrFromBasic(basic, useModel), styleFor(pick, options, prompt). */
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
  /** 2.686.0: a style that is no edit model -> "lineart" when its family has a line-art ControlNet (net = GET
   *  /api/aiedit/lineart-net), else "refine" (picture to picture, 2.685.0) with the reason, else null (pure) */
  function chooseHow(how, net) {
    if (how === "edit") return { how, why: "" };
    if (net && net.model) return { how: "lineart", why: "" };
    const why = (net && net.error) || "";
    return { how: how === "refine" ? "refine" : null, why };
  }
  /** 2.805.0: a style's kept Basic Settings (field id -> value, H3BasicCfg.collect / basic_settings.tmp) -> what /api/aiedit's
   *  ovr takes {ovr: {steps, cfg, model}, seed, words} (pure); useModel false = the style's own checkpoint (Use model unticked) */
  function ovrFromBasic(b, useModel) {
    const v = b || {}, ovr = {}, words = [];
    const st = parseInt(v.imgSteps, 10); if (v.imgSteps !== "" && v.imgSteps != null && Number.isFinite(st) && st > 0) { ovr.steps = st; words.push(st + " steps"); }
    const cf = parseFloat(v.imgCfg); if (v.imgCfg !== "" && v.imgCfg != null && Number.isFinite(cf)) { ovr.cfg = cf; words.push("CFG " + cf); }
    const ck = String(v.imgCkpt == null ? "" : v.imgCkpt).trim(); if (ck && useModel !== false) { ovr.model = ck; words.push(ck.split(/[\\/]/).pop()); }
    const sd = parseInt(v.imgSeed, 10), seed = Number.isFinite(sd) ? sd : null;
    if (seed != null) words.push(seed >= 0 ? "seed " + seed : "random seed");
    return { ovr, seed, words: words.join(", ") };
  }
  /** 2.805.0: the style the preview's dropdown picks -> {id, name, own} ("" or a style no longer listed = the prompt's) (pure)
   *  options = [{id, name}], prompt = {id, name} */
  function styleFor(pick, options, prompt) {
    const o = (options || []).find((x) => x.id === pick && pick);
    const p = prompt || { id: "", name: "" };
    return o ? { id: o.id, name: o.name, own: o.id === p.id } : { id: p.id, name: p.name, own: true };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { LOOKS, KEEP, promptFor, fit, pickHow, chooseHow, barState, pairsAdd, ovrFromBasic, styleFor }; return; }

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
      // 2.805.0: the style that makes it + ☐ Basic Settings - the look dropdown's size
      + "#lb_rsstyle{width:auto;flex:none;max-width:84px;margin-left:-2px;box-sizing:border-box;padding:4px 4px 4px 7px;font:inherit;font-size:.76rem;line-height:normal;"
      + "background:var(--panel-2);color:var(--text);border:1px solid var(--line);border-radius:6px;cursor:pointer}#lb_rsstyle:hover{border-color:var(--tiger,#f59e2c)}"
      + "#lb_rsbasicw{display:inline-flex;align-items:center;gap:3px;margin-left:-2px;font-size:.7rem;white-space:nowrap;cursor:pointer;opacity:.9}#lb_rsbasicw input{margin:0;width:auto}"
      + "#lb_rsmsg:empty{display:none}#lb_rsmsg{font-size:11px;opacity:.85;max-width:34ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
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
  /* 2.805.0: the style that makes it (#lb_rsstyle) and ☐ Basic Settings (#lb_rsbasic) */
  const SK = "h3.restyle.style", BK = "h3.restyle.basic";
  function styleOpts() { const sel = $("styleSel"); return sel ? [...sel.options].filter((o) => o.value).map((o) => ({ id: o.value, name: o.textContent.trim() })) : []; }
  function chosen() { const s = $("lb_rsstyle"); return styleFor(s ? s.value : "", styleOpts(), styleNow()); }
  const ovrOn = () => { const c = $("lb_rsbasic"); return !!(c && c.checked); };
  const call = (n, ...a) => { try { const f = root[n] || (typeof globalThis[n] === "function" ? globalThis[n] : null); return typeof f === "function" ? f(...a) : undefined; } catch (e) { return undefined; } };
  /** the Basic Settings that style last had: the live ones when it is the prompt's style now, else misc/basic_settings.tmp's */
  function basicOf(st) {
    const SB = root.H3StyleBasic, BC = root.H3BasicCfg;
    if (st.own && BC && BC.collect) return { vals: BC.collect(), live: true };
    const e = SB && SB.file && (SB.file().styles || {})["image:" + st.id];
    return e && e.basic ? { vals: e.basic, live: false, saved: e.saved } : null;
  }
  function ovrBody(st) {
    const k = basicOf(st); if (!k) return null;
    const useModel = call("useMD", "image") !== false, r = ovrFromBasic(k.vals, useModel), o = r.ovr;
    if (k.live) {   // what only the live page has: the image LoRAs' weights, the temporary LoRAs, the Model manager's pick
      try { const touched = typeof imgTouched !== "undefined" && imgTouched.loras, h = $("imgLoras");   // eslint-disable-line no-undef
        if (touched && h) { const m = {}; h.querySelectorAll("input[data-lora]").forEach((x) => { m[x.dataset.lora] = parseFloat(x.value); }); if (Object.keys(m).length) o.lora_weights = m; } } catch (e) { /* fine */ }
      const extra = call("useTL", "image") !== false ? (call("tempLoras", "image") || []) : []; if (extra.length) o.extra_loras = extra;
      try { if (root.H3ModelMgr && root.H3ModelMgr.overriding && root.H3ModelMgr.overriding()) o.mm_override = true; } catch (e) { /* fine */ }
    }
    return { ovr: o, seed: r.seed, words: r.words, live: k.live };
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
    const st = chosen(), m = doc.createElement("div"); m.id = "lb_rsmenu"; m.setAttribute("role", "menu");
    const hd = doc.createElement("div"); hd.className = "hd";
    hd.textContent = "With " + (st.name || "the prompt's style") + (ovrOn() ? " + its Basic Settings" : " (its own settings)");
    m.appendChild(hd);
    LOOKS.forEach((L) => { const d = doc.createElement("div"); d.className = "it"; d.dataset.look = L.id; d.setAttribute("role", "menuitem"); d.textContent = L.label; d.onclick = () => { close(); run(L.id).catch((e) => say("🎨 " + (e.message || e))); }; m.appendChild(d); });
    (btn.closest("dialog") || doc.body).appendChild(m); S.menu = m;   // inside the preview: a modal dialog is on the top layer
    const r = btn.getBoundingClientRect(), W = root.innerWidth || 1200;
    m.style.left = Math.max(4, Math.min(r.left, W - m.offsetWidth - 4)) + "px"; m.style.top = Math.max(4, r.top - m.offsetHeight - 4) + "px";
  }
  async function engines() { const r = await fetch("/api/aiedit/engines"); return r.ok ? r.json() : { edit: [], inpaint: [] }; }
  const canvas = (w, h) => { const c = doc.createElement("canvas"); c.width = w; c.height = h; return c; };
  const blob = (c) => new Promise((ok) => c.toBlob(ok, "image/png"));
  /** 2.686.0: ✏ the picture's line art (a ComfyUI job) -> {blob, url, name}; shown in the preview after the picture */
  async function lineArt(c, it, L) {
    say("🎨 " + L.label + " - ✏ drawing the line art first…"); bar({ status: "queued" }, "✏ Line art");
    const fd = new FormData(); fd.append("image", await blob(c), "restyle.png"); fd.append("type", "lineart");
    const r = await fetch("/api/aiedit/preprocess", { method: "POST", body: fd }), j = await r.json();
    if (!r.ok || !j.job) throw new Error(j.error || "refused");
    let jj = null;
    for (let n = 0; n < 1500; n++) {
      await new Promise((ok) => setTimeout(ok, 1200));
      try { jj = await (await fetch("/api/jobs/" + encodeURIComponent(j.job))).json(); } catch (e) { continue; }
      bar(jj, "✏ Line art");
      if (jj.status && jj.status !== "running" && jj.status !== "queued") break;
    }
    const out = jj && jj.status === "done" && ((jj.outputs && jj.outputs[0]) || jj.output);
    if (!out) throw new Error("the preprocessor " + ((jj && jj.status) || "did not finish"));
    const url = "/outputs/" + encodeURIComponent(out), b = await (await fetch(url)).blob();
    const item = { url, kind: "image", name: out, look: "✏ line art" };
    try { if ($("lb").open && lb.items.indexOf(it) >= 0) { lb.items.splice(lb.items.indexOf(it) + 1, 0, item); if (typeof lbFilm === "function") lbFilm(); } } catch (e) { /* the strip only */ }   // eslint-disable-line no-undef
    S.line = item;
    return { blob: b, url, name: out };
  }
  async function run(lookId) {
    if (S.busy) { say("🎨 still making the last one"); return null; }
    const it = cur(), L = LOOKS.find((x) => x.id === lookId); if (!it || !L) return null;
    const st = chosen(); if (!st.id) throw new Error("pick an image style in the prompt or in the dropdown beside 🎨 Change style first");
    const E = await engines();
    let how = pickHow(st.id, E), net = null, why = "";
    // 2.686.0: no edit model = the picture's line art first, then the style renders the look through a line-art ControlNet
    if (how !== "edit") {
      try { const r = await fetch("/api/aiedit/lineart-net?style_id=" + encodeURIComponent(st.id)); net = await r.json(); } catch (e) { net = { error: "the ControlNet list could not be read" }; }
      ({ how, why } = chooseHow(how, net));
    }
    if (!how) throw new Error((st.name || "this style") + " can't remake a picture - pick an edit model (FLUX.2 Klein, Qwen Image Edit …) or an SDXL / FLUX style in the prompt" + (why ? " (" + why + ")" : ""));
    S.busy = true; $("lb_restyle").disabled = true;
    try {
      S.line = null; say("🎨 " + L.label + " - preparing…");
      // 2.807.0: this computer's ComfyUI started first - the line art and the render both need it (a pod render skips it)
      if (root.H3PodRoute && root.H3PodRoute.ready && !(await root.H3PodRoute.ready("image", st.id))) throw new Error("ComfyUI is not running and could not be started - Settings ▸ ComfyUI");
      const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("the picture could not be read")); im.src = it.url; });
      const sz = fit(img.naturalWidth, img.naturalHeight), c = canvas(sz.w, sz.h), g = c.getContext("2d");
      g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, sz.w, sz.h);
      let orig = ""; if (how === "refine" || how === "lineart") { try { const j = await (await fetch("/api/job-meta?name=" + encodeURIComponent(it.name))).json(); orig = (j && (j.prompt || (j.meta && j.meta.prompt))) || ""; } catch (e) { orig = ""; } }
      // 2.686.0: ✏ the line art first (ComfyUI's LineArtPreprocessor - /api/aiedit/preprocess); it fails = picture to picture
      let line = null;
      if (how === "lineart") {
        line = await lineArt(c, it, L).catch((e) => { why = "the line art could not be made (" + (e.message || e) + " - Settings ▸ Add-ons ▸ ControlNet installs its nodes)"; return null; });
        if (!line) { if (pickHow(st.id, E) !== "refine") throw new Error(why); how = "refine"; }
      }
      const fd = new FormData();
      fd.append("crop", await blob(c), "restyle.png");
      if (how !== "edit") { const empty = canvas(sz.w, sz.h); fd.append("mask", await blob(empty), "mask.png"); fd.append("rgba", await blob(empty), "hole.png"); }   // all of it is the selection
      const fields = { mode: how === "lineart" ? "generate" : how, prompt: promptFor(L, how === "lineart" ? "refine" : how, orig), style_id: st.id, strength: how === "edit" || how === "lineart" ? 100 : L.strength, count: 1, width: sz.w, height: sz.h, whole: "1" };
      if (how === "lineart") { fields.restyle = "1"; fields.lineart = "1"; fd.append("ctl0", line.blob, "lineart.png"); }
      // 2.805.0: ☐ Basic Settings = the settings this style last had ride along (none kept yet = its own, said)
      let bnote = "";
      if (ovrOn()) {
        const o = ovrBody(st);
        if (o) { fields.ovr = JSON.stringify(o.ovr); if (o.seed != null && o.seed >= 0) fields.seed = o.seed; S.basic = o; }
        else { bnote = "no Basic Settings kept for " + (st.name || "this style") + " yet - its own settings"; S.basic = null; }
      } else S.basic = null;
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
      say("🎨 " + L.label + " - queued (" + (st.name || st.id) + (how === "edit" ? ", edit" : how === "lineart" ? ", from the line art" : ", refine " + L.strength + " %") + ")" + ovw + (bnote ? " · " + bnote : "") + (why ? " · " + why : "") + "…");
      S.how = how; S.why = why;
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
        const li = S.line && how === "lineart" ? lb.items.indexOf(S.line) : -1, at = li >= 0 ? li : lb.items.indexOf(it), k = at >= 0 ? at : lb.i;
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
    const st = chosen(), L = LOOKS.find((x) => x.id === lookNow());
    b.title = "Make this picture again as " + L.label.replace(/^\S+\s/, "") + " - with " + (st.name || "the prompt's image style") + (ovrOn() ? " + the Basic Settings it last had" : " (its own settings)") + ". Pick another look in the dropdown first to change it.";
    const c = $("lb_rsbasicw"); if (c) { const k = st.id ? basicOf(st) : null, w = k ? ovrFromBasic(k.vals, call("useMD", "image") !== false).words : "";
      c.title = "Use the Basic Settings " + (st.name || "the style") + " last had" + (k ? (k.live ? " (the ones in Basic Settings now): " : ": ") + (w || "its own values") : " - none kept for it yet (it is used with its own settings until you render with it once)"); }
  }
  /** 2.805.0: the styles in the dropdown follow the prompt's list */
  function fillStyles() {
    const s = $("lb_rsstyle"); if (!s) return;
    const want = s.value || s.dataset.want || "", list = styleOpts(), sig = JSON.stringify(list);
    if (s.dataset.sig === sig) return;
    s.dataset.sig = sig; s.innerHTML = "";
    const own = doc.createElement("option"); own.value = ""; own.textContent = "✎ The prompt's style"; s.appendChild(own);
    list.forEach((x) => { const o = doc.createElement("option"); o.value = x.id; o.textContent = x.name; s.appendChild(o); });
    s.value = list.some((x) => x.id === want) ? want : "";
  }
  /** 2.805.0: the look, 🎨 Change style, the style and the tick - only while a picture is shown */
  function paintKind() {
    const it = cur(), hide = !it || it.kind !== "image";
    ["lb_rslook", "lb_restyle", "lb_rsstyle", "lb_rsbasicw", "lb_rsmsg"].forEach((id) => { const n = $(id); if (n) n.style.display = hide ? "none" : ""; });
    if (hide) close();
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
    // 2.805.0: the style that makes it + ☐ Basic Settings, beside 🎨 Change style
    const ss = doc.createElement("select"); ss.id = "lb_rsstyle"; ss.setAttribute("aria-label", "Style");
    ss.title = "The image style 🎨 Change style renders with - ✎ The prompt's style = the one picked in the prompt";
    try { ss.dataset.want = root.localStorage.getItem(SK) || ""; } catch (e) { ss.dataset.want = ""; }
    ss.onchange = () => { ss.dataset.want = ss.value; try { root.localStorage.setItem(SK, ss.value); } catch (e) { /* this session only */ } tip(); };
    const cw = doc.createElement("label"); cw.id = "lb_rsbasicw";
    const cb = doc.createElement("input"); cb.type = "checkbox"; cb.id = "lb_rsbasic";
    try { cb.checked = root.localStorage.getItem(BK) === "1"; } catch (e) { cb.checked = false; }
    cb.onchange = () => { try { root.localStorage.setItem(BK, cb.checked ? "1" : "0"); } catch (e) { /* this session only */ } tip(); };
    cw.appendChild(cb); cw.appendChild(doc.createTextNode("Basic Settings"));
    cw.onmouseenter = tip;
    save.parentNode.insertBefore(sel, save); save.parentNode.insertBefore(b, save); save.parentNode.insertBefore(ss, save); save.parentNode.insertBefore(cw, save); save.parentNode.insertBefore(msg, save);
    fillStyles(); ss.onfocus = fillStyles; ss.onmousedown = fillStyles;
    { const s0 = $("styleSel"); if (s0 && root.MutationObserver) new root.MutationObserver(() => { fillStyles(); tip(); }).observe(s0, { childList: true }); }
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
    const nm = $("lb_name"); if (nm && root.MutationObserver) new root.MutationObserver(() => { paintKind(); sbsPaint(); fillStyles(); tip(); }).observe(nm, { childList: true, characterData: true, subtree: true });
    // 2.805.0: also when the preview opens (the same name again fires nothing above)
    { const lbd = $("lb"); if (lbd && root.MutationObserver) new root.MutationObserver(() => { if (lbd.open) { paintKind(); fillStyles(); tip(); } }).observe(lbd, { attributes: true, attributeFilter: ["open"] }); }
    paintKind();
  }
  root.H3Restyle = { LOOKS, promptFor, fit, pickHow, barState, pairsAdd, ovrFromBasic, styleFor, bar, run, open: openMenu, close, look: lookNow, sbs: sbsToggle, sbsOff, pairs, chosen, basicOf, paintKind, fillStyles, state: () => S };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
