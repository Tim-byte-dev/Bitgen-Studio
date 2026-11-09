/* static/imgupscalepanel.js — THE ⏫ PICTURE UPSCALE PANEL (2.733.0): window.ImgUpscalePanel.
 *
 * Tim (verbatim): "if we select an image thumbnail and press the enhance buton can we upscale the image"
 *
 * The prompt docker's ⏫ Enhance opens it when the last thing clicked was a picture (static/selvideo.js SelVideo.kind()
 * === "image": a gallery image, an Image asset, a reference-dock picture); a video still opens the SeedVR2 panel.
 *   ImgUpscalePanel.open({name, from, url, anchor})   from: gallery | asset | ref (url = the picture in the browser -
 *                                                     sent first: POST /api/imgupscale/upload)
 * Size (×2 / ×3 / ×4 / 1080 / 1440 / 2160 short side), Way (SeedVR2 / an upscale model / Lanczos), Model, Colour match,
 * Denoise; what it will make (POST /api/imgupscale/plan) before ⏫ Upscale queues it (POST /api/imgupscale). The result
 * lands in the gallery's Images as <name>_upscaled_<w>x<h>.png. The choices are the project's (imgupscale.json). */
(function () {
  "use strict";
  const ID = "iuPanel";
  const FIELDS = { size: "iuSize", method: "iuMethod", model: "iuModel", color: "iuColor", denoise: "iuDenoise" };
  const FROM_LABEL = { gallery: "gallery", asset: "Image assets", ref: "reference dock", upload: "reference dock" };
  let cur = { name: "", from: "", url: "", anchor: null, upload: null };
  let built = null, planSeq = 0, lists = { seedvr2: [], model: [] };
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function build() {
    if (built) return built;
    const st = document.createElement("style");
    st.textContent = `
      #iuPanel { position: fixed; z-index: 400; left: 0; top: 0; width: 290px; padding: 9px 10px;
                 background: var(--panel, #1c1915); border: 1px solid var(--line, #3a342c); border-radius: 8px;
                 box-shadow: 0 8px 24px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 6px; font-size: .74rem; }
      #iuPanel.hidden { display: none; }
      #iuPanel label { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      #iuPanel label.iuoff { opacity: .45; }
      #iuPanel select, #iuPanel input { max-width: 160px; }
      #iuPanel .iurow { display: flex; gap: 6px; align-items: baseline; justify-content: space-between; }
      #iuPanel .iudim { color: var(--dim, #8b8378); font-size: .68rem; overflow-wrap: anywhere; }`;
    try { (document.head || document.documentElement || document.body).appendChild(st); } catch { /* a bare test document */ }
    const p = document.createElement("div");
    p.id = ID; p.className = "hidden";
    p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Upscale the picture");
    p.innerHTML = `
      <div class="iurow"><b>⏫ Upscale picture</b><span id="iuSrc" class="iudim"></span></div>
      <label>Size <select id="iuSize" title="A factor, or the short side in pixels (the shape kept)">
        <option value="x2">×2</option><option value="x3">×3</option><option value="x4">×4</option>
        <option value="1080">1080 px</option><option value="1440">1440 px</option><option value="2160">2160 px (4K)</option></select></label>
      <label>Way <select id="iuMethod" title="SeedVR2 restores detail (slow, ComfyUI); an upscale model is quick and sharp (ComfyUI's models/upscale_models); Lanczos needs no ComfyUI but adds no detail">
        <option value="seedvr2">SeedVR2 (restores detail)</option><option value="model">Upscale model</option><option value="lanczos">Lanczos (no ComfyUI)</option></select></label>
      <label id="iuModelL">Model <select id="iuModel" title="The file ComfyUI uses"><option value="">best available</option></select></label>
      <label id="iuColorL">Colour match <select id="iuColor" title="Match the result's colours to the original - lab is the most faithful; none skips it">
        <option value="lab">lab</option><option value="wavelet">wavelet</option><option value="adain">adain</option><option value="none">none</option></select></label>
      <label id="iuDenoiseL">Denoise <input id="iuDenoise" type="number" min="0.05" max="1" step="0.05" value="1" title="1 = full restore; lower keeps more of the original's texture"></label>
      <div id="iuPlan" class="iudim" aria-live="polite"></div>
      <div class="iurow"><button id="iuGo" class="primary">⏫ Upscale</button><button id="iuClose" class="ghost">Close</button></div>`;
    document.body.appendChild(p);
    p.addEventListener("click", (ev) => ev.stopPropagation());
    p.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.addEventListener("click", () => close());
    el("iuClose").addEventListener("click", close);
    for (const id of Object.values(FIELDS)) el(id).addEventListener("change", (e) => { if (e.target.id === "iuMethod") fillModels(); look(); plan(); });
    el("iuGo").addEventListener("click", go);
    window.addEventListener("resize", () => { if (shown()) place(); });
    built = p;
    return p;
  }
  const shown = () => !!built && !built.classList.contains("hidden");
  function opts() {
    const o = {};
    for (const [k, id] of Object.entries(FIELDS)) o[k] = el(id).value;
    o.denoise = parseFloat(o.denoise) || 1;
    return o;
  }
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(new Error(j.error || r.statusText)))));
  }
  function place() {
    if (!built) return;
    const a = cur.anchor && cur.anchor.getBoundingClientRect ? cur.anchor.getBoundingClientRect() : { left: 40, top: 80, bottom: 80 };
    const h = built.offsetHeight, w = built.offsetWidth;
    let top = a.top - h - 6;
    if (top < 8) top = Math.min(window.innerHeight - h - 8, a.bottom + 6);
    built.style.left = Math.max(8, Math.min(a.left, window.innerWidth - w - 8)) + "px";
    built.style.top = Math.max(8, top) + "px";
  }
  /** the Model list for the way picked: SeedVR2 files (diffusion_models) or upscale models (upscale_models) */
  function fillModels() {
    const m = el("iuMethod").value, sel = el("iuModel"), keep = sel.dataset.want || sel.value;
    const files = m === "seedvr2" ? lists.seedvr2 : m === "model" ? lists.model : [];
    sel.innerHTML = `<option value="">${m === "model" ? "the first listed" : "best available"}</option>` + files.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    if (keep && files.includes(keep)) sel.value = keep;
    sel.dataset.want = "";
  }
  function look() {
    const m = el("iuMethod").value;
    el("iuModelL").classList.toggle("iuoff", m === "lanczos"); el("iuModel").disabled = m === "lanczos";
    for (const id of ["iuColor", "iuDenoise"]) { el(id).disabled = m !== "seedvr2"; el(id + "L").classList.toggle("iuoff", m !== "seedvr2"); }
  }
  function models() {
    return fetch("/api/comfymodels").then((r) => r.json()).then((d) => {
      const c = (d || {}).categories || {};
      lists.seedvr2 = ((c.diffusion_models || {}).files || []).map((f) => f.name).filter((n) => /seedvr/i.test(n));
      lists.model = ((c.upscale_models || {}).files || []).map((f) => f.name);
      fillModels();
      return lists;
    }).catch(() => lists);
  }
  const label = () => (cur.from === "ref" ? cur.name : cur.name) + (FROM_LABEL[cur.from] ? " · " + FROM_LABEL[cur.from] : "");
  /** a reference-dock picture is in the browser: send it once, then it has a name the server knows */
  function ensureUpload() {
    if (cur.from !== "ref") return Promise.resolve({ name: cur.name, from: cur.from });
    if (cur.upload) return Promise.resolve(cur.upload);
    if (!cur.url) return Promise.reject(new Error("the reference picture is gone"));
    return fetch(cur.url).then((r) => r.blob()).then((b) => fetch("/api/imgupscale/upload?name=" + encodeURIComponent(cur.name || "picture"), {
      method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: b }))
      .then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(new Error(j.error || r.statusText)))))
      .then((j) => { cur.upload = { name: j.name, from: "upload" }; return cur.upload; });
  }
  function plan() {
    el("iuSrc").textContent = cur.name ? label() : "";
    el("iuGo").disabled = !cur.name;
    if (!cur.name) {
      el("iuPlan").textContent = "select a picture first - click one in the gallery's Images, the Image assets or the reference dock";
      return Promise.resolve();
    }
    const seq = ++planSeq;
    return ensureUpload().then((src) => post("/api/imgupscale/plan", Object.assign({}, src, opts())))
      .then((j) => { if (seq === planSeq) { el("iuPlan").textContent = `${j.source.width}×${j.source.height} → ${j.target.width}×${j.target.height} (×${j.target.mult})`; el("iuGo").disabled = false; } })
      .catch((e) => { if (seq === planSeq) { el("iuPlan").textContent = e.message; el("iuGo").disabled = true; } });
  }
  function say(t) {
    const x = el("vtitle");
    if (x) x.textContent = t;
    if (typeof window.logLine === "function") { try { window.logLine("[upscale] " + t); } catch { /* optional */ } }
  }
  function go() {
    if (!cur.name) { plan(); return; }
    el("iuGo").disabled = true;
    const name = cur.name;
    ensureUpload().then((src) => post("/api/imgupscale", Object.assign({}, src, opts()))).then((j) => {
      say(`⏫ picture upscale queued: ${name} → ${j.target.width}×${j.target.height} (${j.output})`);
      try { if (window.H3TestEvent) window.H3TestEvent("img_upscale", j.output); } catch { /* the 🧪 list */ }
      close();
      try { if (typeof refreshJobs === "function") refreshJobs(); if (typeof selectJob === "function") selectJob(j.id); } catch { /* the queue polls anyway */ }
    }).catch((e) => { el("iuPlan").textContent = "not queued: " + e.message; })
      .then(() => { if (shown()) el("iuGo").disabled = !cur.name; });
  }
  function open(o) {
    o = o || {};
    build();
    cur = { name: String(o.name || ""), from: String(o.from || ""), url: String(o.url || ""), anchor: o.anchor || null, upload: null };
    built.classList.remove("hidden");
    el("iuSrc").textContent = cur.name ? label() : "";
    el("iuPlan").textContent = cur.name ? "reading the picture…" : "";
    el("iuGo").disabled = true;
    planSeq++;
    place();
    return fetch("/api/imgupscale/settings").then((r) => r.json()).then((d) => {
      const s = (d && d.settings) || {};
      for (const [k, id] of Object.entries(FIELDS)) if (s[k] != null && k !== "model") el(id).value = String(s[k]);
      el("iuModel").dataset.want = s.model || "";
    }).catch(() => {}).then(models).then(() => { look(); return plan(); }).then(place);
  }
  function close() { if (built) built.classList.add("hidden"); }
  function retarget(p) {
    if (!shown() || !p) return;
    cur.name = String(p.name || ""); cur.from = String(p.from || ""); cur.url = String(p.url || ""); cur.upload = null;
    plan();
  }
  window.ImgUpscalePanel = { open, close, retarget, shown, state: () => ({ name: cur.name, from: cur.from, upload: cur.upload }) };
})();
