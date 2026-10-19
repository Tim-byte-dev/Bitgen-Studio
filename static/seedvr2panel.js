/* static/seedvr2panel.js — THE ⏫ SEEDVR2 PANEL (2.401.0), shared by every door that upscales a video.
 *
 * 2.400.0 put it in the preview dock; Tim (2.401.0): "use the enhance button in the prompt docker to upscale the
 * selected video - the selected video will be the one selected from gallery, assets or reference". So the panel is
 * built here, once, and opened from the preview bar's ⏫ SeedVR2 AND the prompt docker's ⏫ Enhance:
 *
 *   SeedVR2Panel.open({ name, from, anchor, onQueued })
 *     name   the video's file name (a gallery output, a Video asset, a reference video)
 *     from   "gallery" | "asset" | "ref" | "preview" - which folder wins a name clash (lib/seedvr2.resolve)
 *     anchor the button it opens beside (fixed position, kept inside the window)
 *
 * Size / colour match / temporal split / model / denoise; what it will make (POST /api/seedvr2/plan) before
 * ⏫ Upscale queues it (POST /api/seedvr2) and follows the job in the queue docker. The choices are the project's
 * (seedvr2.json) - the video docker's ⚙ Upscaler "SeedVR2 (video)" uses the same ones. */
(function () {
  "use strict";
  const ID = "svPanel";
  const FIELDS = { size: "svSize", color: "svColor", chunk: "svChunk", model: "svModel", denoise: "svDenoise" };
  const FROM_LABEL = { gallery: "gallery", asset: "Video assets", ref: "reference dock", preview: "preview" };
  let cur = { name: "", from: "", anchor: null, onQueued: null };
  let built = null, planSeq = 0;

  const el = (id) => document.getElementById(id);
  function build() {
    if (built) return built;
    const st = document.createElement("style");
    st.textContent = `
      #svPanel { position: fixed; z-index: 400; left: 0; top: 0; width: 280px; padding: 9px 10px;
                 background: var(--panel, #1c1915); border: 1px solid var(--line, #3a342c); border-radius: 8px;
                 box-shadow: 0 8px 24px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 6px; font-size: .74rem; }
      #svPanel.hidden { display: none; }
      #svPanel label { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      #svPanel select, #svPanel input { max-width: 150px; }
      #svPanel .svrow { display: flex; gap: 6px; align-items: baseline; justify-content: space-between; }
      #svPanel .svdim { color: var(--dim, #8b8378); font-size: .68rem; overflow-wrap: anywhere; }`;
    try { (document.head || document.documentElement || document.body).appendChild(st); } catch { /* a bare test document */ }
    const p = document.createElement("div");
    p.id = ID; p.className = "hidden";
    p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "SeedVR2 upscale");
    p.innerHTML = `
      <div class="svrow"><b>⏫ SeedVR2</b><span id="svSrc" class="svdim"></span></div>
      <label>Size <select id="svSize" title="The upscaled short side (the aspect kept), or a factor">
        <option value="720">720p</option><option value="1080">1080p</option><option value="1440">1440p</option>
        <option value="2160">2160p (4K)</option><option value="x2">×2</option><option value="x3">×3</option><option value="x4">×4</option></select></label>
      <label>Colour match <select id="svColor" title="Match the result's colours to the original - lab is the most faithful; none skips it">
        <option value="lab">lab</option><option value="wavelet">wavelet</option><option value="adain">adain</option><option value="none">none</option></select></label>
      <label>Temporal split <select id="svChunk" title="auto: a long clip is sampled in pieces that fit the free VRAM, cross-faded back together; off: the whole clip at once">
        <option value="auto">auto (fits VRAM)</option><option value="21">21 frames a piece</option><option value="45">45 frames</option><option value="81">81 frames</option><option value="off">off</option></select></label>
      <label>Model <select id="svModel" title="ComfyUI's SeedVR2 files (models/diffusion_models). Best available = the sharp 7B fp16, else any 7B, else the 3B"><option value="">best available</option></select></label>
      <label>Denoise <input id="svDenoise" type="number" min="0.05" max="1" step="0.05" value="1" title="1 = full restore (the template's); lower keeps more of the original's texture"></label>
      <div id="svPlan" class="svdim"></div>
      <div class="svrow"><button id="svGo" class="primary">⏫ Upscale</button><button id="svClose" class="ghost">Close</button></div>`;
    document.body.appendChild(p);
    p.addEventListener("click", (ev) => ev.stopPropagation());
    p.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.addEventListener("click", () => close());
    el("svClose").addEventListener("click", close);
    for (const id of Object.values(FIELDS)) el(id).addEventListener("change", plan);
    el("svGo").addEventListener("click", go);
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
  function models() {
    return fetch("/api/comfymodels").then((r) => r.json()).then((d) => {
      const files = ((((d || {}).categories || {}).diffusion_models || {}).files || []).map((f) => f.name)
        .filter((n) => /seedvr/i.test(n));
      const sel = el("svModel"), keep = sel.value;
      sel.innerHTML = '<option value="">best available</option>'
        + files.map((n) => `<option value="${n.replace(/"/g, "&quot;")}">${n.replace(/</g, "&lt;")}</option>`).join("");
      if (keep && !files.includes(keep)) {
        const o = document.createElement("option"); o.value = keep; o.textContent = keep + " (not found)"; sel.appendChild(o);
      }
      sel.value = keep;
      return files;
    }).catch(() => null);
  }
  function plan() {
    const name = cur.name;
    el("svSrc").textContent = name ? name + (FROM_LABEL[cur.from] ? " · " + FROM_LABEL[cur.from] : "") : "";
    el("svGo").disabled = !name;
    if (!name) {
      el("svPlan").textContent = "select a video first - click one in the gallery, the Video assets or the reference dock";
      return Promise.resolve();
    }
    const seq = ++planSeq;
    return post("/api/seedvr2/plan", Object.assign({ name, from: cur.from }, opts()))
      .then((j) => { if (seq === planSeq) { el("svPlan").textContent = `${j.source.width}×${j.source.height} → ${j.target.width}×${j.target.height} (×${j.target.mult})`; el("svGo").disabled = false; } })
      .catch((e) => { if (seq === planSeq) { el("svPlan").textContent = e.message; el("svGo").disabled = true; } });
  }
  function say(t) {
    const x = el("vtitle");
    if (x) x.textContent = t;
    if (typeof window.logLine === "function") { try { window.logLine("[seedvr2] " + t); } catch { /* the console is optional */ } }
  }
  function go() {
    const name = cur.name;
    if (!name) { plan(); return; }
    el("svGo").disabled = true;
    post("/api/seedvr2", Object.assign({ name, from: cur.from }, opts())).then((j) => {
      say(`⏫ SeedVR2 queued: ${name} → ${j.target.width}×${j.target.height}`);
      close();
      if (typeof cur.onQueued === "function") { try { cur.onQueued(j); } catch { /* the caller's */ } }
      try { if (typeof refreshJobs === "function") refreshJobs(); if (typeof selectJob === "function") selectJob(j.id); } catch { /* the queue polls anyway */ }
    }).catch((e) => { el("svPlan").textContent = "not queued: " + e.message; })
      .then(() => { if (shown()) el("svGo").disabled = !cur.name; });
  }
  function open(o) {
    o = o || {};
    build();
    cur = { name: String(o.name || ""), from: String(o.from || ""), anchor: o.anchor || null, onQueued: o.onQueued || null };
    built.classList.remove("hidden");
    // this video's name at once, the old numbers gone (the settings + the plan come back in a moment)
    el("svSrc").textContent = cur.name ? cur.name + (FROM_LABEL[cur.from] ? " · " + FROM_LABEL[cur.from] : "") : "";
    el("svPlan").textContent = cur.name ? "reading the video…" : "";
    el("svGo").disabled = true;
    planSeq++;
    place();
    return fetch("/api/seedvr2/settings").then((r) => r.json()).then((d) => {
      const s = (d && d.settings) || {};
      for (const [k, id] of Object.entries(FIELDS)) {
        if (s[k] == null) continue;
        const f = el(id);
        if (f.tagName === "SELECT" && ![].some.call(f.options, (x) => x.value === String(s[k]))) {
          const x = document.createElement("option"); x.value = String(s[k]); x.textContent = k === "chunk" ? `${s[k]} frames` : String(s[k]); f.appendChild(x);
        }
        f.value = String(s[k]);
      }
    }).catch(() => {}).then(models).then((files) => {
      if (files && !files.length) el("svPlan").textContent = "ComfyUI lists no SeedVR2 model yet - Setup -> Models -> Upscaling has seedvr2_7b_sharp_fp16 (16.5 GB) and the VAE";
    }).then(plan).then(place);
  }
  function close() { if (built) built.classList.add("hidden"); }
  /** Another video became the selection while the panel is open -> its own numbers. */
  function retarget(name, from) {
    if (!shown()) return;
    cur.name = String(name || ""); cur.from = String(from || "");
    plan();
  }
  window.SeedVR2Panel = { open, close, retarget, shown, state: () => ({ name: cur.name, from: cur.from }) };
})();
