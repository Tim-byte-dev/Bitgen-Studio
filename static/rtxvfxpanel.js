/* static/rtxvfxpanel.js — THE ✨ RTX VFX PANEL (2.708.0), the DLSS 5 panel's sibling (static/dlss5panel.js).
 *
 * Tim: "Add the RTX upscale" - the DENO pack's DenoRTXVFXVideoFinisher (NVIDIA RTX Video Super Resolution / Deblur /
 * High Bitrate). The preview bar's ✨ RTX VFX opens it for the video in the player:
 *
 *   RtxVfxPanel.open({ name, from, anchor, onQueued })
 *
 * Preset A (one VSR pass) / B (Deblur, then High Bitrate) / Custom (the four pass dropdowns - what THIS ComfyUI's node
 * offers, from GET /api/rtxvfx/settings's live lists), scale (1-4x) and frames per batch (lower = less RAM); what it will
 * make (POST /api/rtxvfx/plan) before ✨ Finish queues it (POST /api/rtxvfx). The choices are the project's (rtxvfx.json);
 * the video docker's ⚙ Upscaler "RTX VFX" uses the same passes. */
(function () {
  "use strict";
  const ID = "rxPanel";
  const PASS = { first_pass: "rxFirst", first_quality: "rxFirstQ", upscale_pass: "rxUp", upscale_quality: "rxUpQ" };
  const FROM_LABEL = { gallery: "gallery", asset: "Video assets", ref: "reference dock", preview: "preview" };
  let cur = { name: "", from: "", anchor: null, onQueued: null };
  let built = null, planSeq = 0, presets = {};
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const opts = (list) => list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");

  function build() {
    if (built) return built;
    const st = document.createElement("style");
    st.textContent = `
      #rxPanel { position: fixed; z-index: 400; left: 0; top: 0; width: 300px; padding: 9px 10px;
                 background: var(--panel, #1c1915); border: 1px solid var(--line, #3a342c); border-radius: 8px;
                 box-shadow: 0 8px 24px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 6px; font-size: .74rem; }
      #rxPanel.hidden { display: none; }
      #rxPanel label { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      #rxPanel select, #rxPanel input { max-width: 160px; }
      #rxPanel .rxrow { display: flex; gap: 6px; align-items: baseline; justify-content: space-between; }
      #rxPanel .rxdim { color: var(--dim, #8b8378); font-size: .68rem; overflow-wrap: anywhere; }`;
    try { (document.head || document.documentElement || document.body).appendChild(st); } catch { /* a bare test document */ }
    const p = document.createElement("div");
    p.id = ID; p.className = "hidden";
    p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "RTX VFX finisher");
    p.innerHTML = `
      <div class="rxrow"><b>✨ RTX VFX</b><span id="rxSrc" class="rxdim"></span></div>
      <label>Preset <select id="rxPreset" title="A = one Super Resolution pass; B = a Deblur pass first, then the High Bitrate upscale; Custom = pick the passes below"></select></label>
      <label>First pass <select id="rxFirst" title="Runs before the upscale (Off = none)"></select></label>
      <label>First quality <select id="rxFirstQ"></select></label>
      <label>Upscale pass <select id="rxUp" title="The upscaling pass"></select></label>
      <label>Upscale quality <select id="rxUpQ"></select></label>
      <label>Scale <input id="rxScale" type="number" min="1" max="4" step="0.25" value="2" title="Each side times this (1x = clean up at the same size)"></label>
      <label>Frames per batch <input id="rxBatch" type="number" min="0" max="4096" step="1" value="48" title="How many frames go through ComfyUI in one run - the runs are joined without re-encoding. Lower uses less memory; 0 = every frame in one run"></label>
      <div id="rxNote" class="rxdim"></div>
      <div id="rxPlan" class="rxdim"></div>
      <div class="rxrow"><button id="rxGo" class="primary">✨ Finish</button><button id="rxClose" class="ghost">Close</button></div>`;
    document.body.appendChild(p);
    p.addEventListener("click", (ev) => ev.stopPropagation());
    p.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.addEventListener("click", () => close());
    el("rxClose").addEventListener("click", close);
    el("rxPreset").addEventListener("change", () => { applyPreset(); plan(); });
    for (const id of Object.values(PASS)) el(id).addEventListener("change", () => { el("rxPreset").value = "custom"; plan(); });
    for (const id of ["rxScale", "rxBatch"]) el(id).addEventListener("change", plan);
    el("rxGo").addEventListener("click", go);
    window.addEventListener("resize", () => { if (shown()) place(); });
    built = p;
    return p;
  }
  /** fill a pass dropdown: the live list when ComfyUI said one, else the presets' values; the current value always kept */
  function fill(id, list, keep) {
    const l = list.slice();
    if (keep && !l.includes(keep)) l.push(keep);
    el(id).innerHTML = opts(l);
    if (keep) el(id).value = keep;
  }
  function applyPreset() {
    const pr = presets[el("rxPreset").value];
    if (!pr) return;
    for (const [k, id] of Object.entries(PASS)) { if (![...el(id).options].some((o) => o.value === pr[k])) el(id).insertAdjacentHTML("beforeend", opts([pr[k]])); el(id).value = pr[k]; }
  }
  const shown = () => !!built && !built.classList.contains("hidden");
  function values() {
    const o = { preset: el("rxPreset").value, scale: parseFloat(el("rxScale").value), batch: parseInt(el("rxBatch").value, 10) };
    for (const [k, id] of Object.entries(PASS)) o[k] = el(id).value;
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
  function plan() {
    const name = cur.name;
    el("rxSrc").textContent = name ? name + (FROM_LABEL[cur.from] ? " · " + FROM_LABEL[cur.from] : "") : "";
    el("rxGo").disabled = !name;
    if (!name) { el("rxPlan").textContent = "select a video first - play one in the preview"; return Promise.resolve(); }
    const seq = ++planSeq;
    return post("/api/rtxvfx/plan", Object.assign({ name, from: cur.from }, values()))
      .then((j) => { if (seq === planSeq) { el("rxPlan").textContent = `${j.source.width}×${j.source.height} → about ${j.target.width}×${j.target.height} (×${j.target.factor})`; el("rxGo").disabled = false; } })
      .catch((e) => { if (seq === planSeq) { el("rxPlan").textContent = e.message; el("rxGo").disabled = true; } });
  }
  function say(t) {
    const x = el("vtitle");
    if (x) x.textContent = t;
    if (typeof window.logLine === "function") { try { window.logLine("[rtxvfx] " + t); } catch { /* optional */ } }
  }
  function go() {
    const name = cur.name;
    if (!name) { plan(); return; }
    el("rxGo").disabled = true;
    post("/api/rtxvfx", Object.assign({ name, from: cur.from }, values())).then((j) => {
      say(`✨ RTX VFX queued: ${name} → about ${j.target.width}×${j.target.height}`);
      close();
      if (typeof cur.onQueued === "function") { try { cur.onQueued(j); } catch { /* the caller's */ } }
      try { if (typeof refreshJobs === "function") refreshJobs(); if (typeof selectJob === "function") selectJob(j.id); } catch { /* the queue polls anyway */ }
    }).catch((e) => { el("rxPlan").textContent = "not queued: " + e.message; })
      .then(() => { if (shown()) el("rxGo").disabled = !cur.name; });
  }
  function open(o) {
    o = o || {};
    return fetch("/api/rtxvfx/settings").then((r) => r.json()).catch(() => ({})).then((d) => {
      d = d || {};
      build();
      presets = d.presets || { vsr: { first_pass: "Off", first_quality: "Ultra", upscale_pass: "VSR", upscale_quality: "High" } };
      const labels = d.labels || {};
      el("rxPreset").innerHTML = [...Object.keys(presets), "custom"].map((k) => `<option value="${esc(k)}">${esc(labels[k] || k)}</option>`).join("");
      const s = d.settings || {}, live = d.live || {}, lo = live.options || {};
      for (const [k, id] of Object.entries(PASS)) {
        const fromPresets = [...new Set(Object.values(presets).map((p) => p[k]).filter(Boolean))];
        fill(id, lo[k] && lo[k].length ? lo[k] : fromPresets, s[k] || (presets.vsr || {})[k]);
      }
      el("rxPreset").value = s.preset || "vsr";
      if (s.scale != null) el("rxScale").value = String(s.scale);
      if (s.batch != null) el("rxBatch").value = String(s.batch);
      el("rxNote").textContent = (live.online && !live.pack ? "This ComfyUI has no DenoRTXVFXVideoFinisher yet. " : "") + (d.note || "NVIDIA RTX on Windows only.");
      cur = { name: String(o.name || ""), from: String(o.from || ""), anchor: o.anchor || null, onQueued: o.onQueued || null };
      built.classList.remove("hidden");
      el("rxPlan").textContent = cur.name ? "reading the video…" : "";
      el("rxGo").disabled = true;
      place();
      return plan().then(place);
    });
  }
  function close() { if (built) built.classList.add("hidden"); }
  function retarget(name, from) { if (!shown()) return; cur.name = String(name || ""); cur.from = String(from || ""); plan(); }
  window.RtxVfxPanel = { open, close, retarget, shown, state: () => ({ name: cur.name, from: cur.from }) };
})();
