/* static/dlss5panel.js — THE ⚡ DLSS 5 PANEL (2.504.0), the SeedVR2 panel's sibling (static/seedvr2panel.js).
 *
 * Tim linked https://github.com/RH-RunningHub/ComfyUI-RH-DLSS5 with his "secret sauce" H3 workflow. The preview bar's
 * ⚡ DLSS 5 opens it for the video in the player:
 *
 *   Dlss5Panel.open({ name, from, anchor, onQueued })
 *
 * Size (DLAA 1x, 1.5x .. 3x, or 1K / 2K / 4K / 8K), style (default / natural / cinematic / off), detail and structure
 * strengths, frame generation (off, 2x .. 4x, or a frame rate); what it will make (POST /api/dlss5/plan) before
 * ⚡ Enhance queues it (POST /api/dlss5) and follows the job in the queue. The choices are the project's (dlss5.json);
 * the video docker's ⚙ Upscaler "DLSS 5" uses the same ones. */
(function () {
  "use strict";
  const ID = "dlPanel";
  const FIELDS = { mode: "dlMode", style: "dlStyle", detail: "dlDetail", structure: "dlStructure", fps: "dlFps" };
  const FROM_LABEL = { gallery: "gallery", asset: "Video assets", ref: "reference dock", preview: "preview" };
  let cur = { name: "", from: "", anchor: null, onQueued: null };
  let built = null, planSeq = 0;
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function build(choices) {
    if (built) return built;
    const st = document.createElement("style");
    st.textContent = `
      #dlPanel { position: fixed; z-index: 400; left: 0; top: 0; width: 290px; padding: 9px 10px;
                 background: var(--panel, #1c1915); border: 1px solid var(--line, #3a342c); border-radius: 8px;
                 box-shadow: 0 8px 24px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 6px; font-size: .74rem; }
      #dlPanel.hidden { display: none; }
      #dlPanel label { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      #dlPanel select, #dlPanel input { max-width: 150px; }
      #dlPanel .dlrow { display: flex; gap: 6px; align-items: baseline; justify-content: space-between; }
      #dlPanel .dldim { color: var(--dim, #8b8378); font-size: .68rem; overflow-wrap: anywhere; }`;
    try { (document.head || document.documentElement || document.body).appendChild(st); } catch { /* a bare test document */ }
    const opts = (list, lab) => list.map((v) => `<option value="${esc(v)}">${esc(lab ? lab(v) : v)}</option>`).join("");
    const p = document.createElement("div");
    p.id = ID; p.className = "hidden";
    p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "DLSS 5 enhance");
    p.innerHTML = `
      <div class="dlrow"><b>⚡ DLSS 5</b><span id="dlSrc" class="dldim"></span></div>
      <label>Size <select id="dlMode" title="1x = DLAA (enhance at the same size); 1.5x-3x NVIDIA's fixed factors; 1K / 2K / 4K / 8K = the smallest factor whose short side reaches 1080 / 1440 / 2160 / 4320 (a video already there stays 1x)">${opts(choices.modes)}</select></label>
      <label>Style <select id="dlStyle" title="natural stays closer to the source; cinematic pushes contrast; off = no neural rendering (upscale only)">${opts(choices.styles)}</select></label>
      <label>Detail <input id="dlDetail" type="number" min="0" max="2" step="0.05" value="1" title="0 = keep the original, 1 = the full DLSS result, up to 2 = more of its change"></label>
      <label>Structure <input id="dlStructure" type="number" min="0" max="2" step="0.05" value="1.5" title="local detail / structure reconstruction strength"></label>
      <label>Frame generation <select id="dlFps" title="DLSS frame generation: real in-between frames, not blends (2x / 3x / 4x, or a target frame rate up to 6x the source)">${opts(choices.fps, (v) => (v === "off" ? "off" : /x$/.test(v) ? v + " the frame rate" : v + " fps"))}</select></label>
      <div class="dldim">NVIDIA RTX only. Settings → ComfyUI → Install RH DLSS 5, and copy NVIDIA's DLLs into ComfyUI/models/dlss5/ (the pack's README).</div>
      <div id="dlPlan" class="dldim"></div>
      <div class="dlrow"><button id="dlGo" class="primary">⚡ Enhance</button><button id="dlClose" class="ghost">Close</button></div>`;
    document.body.appendChild(p);
    p.addEventListener("click", (ev) => ev.stopPropagation());
    p.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.addEventListener("click", () => close());
    el("dlClose").addEventListener("click", close);
    for (const id of Object.values(FIELDS)) el(id).addEventListener("change", plan);
    el("dlGo").addEventListener("click", go);
    window.addEventListener("resize", () => { if (shown()) place(); });
    built = p;
    return p;
  }
  const shown = () => !!built && !built.classList.contains("hidden");
  function opts() {
    const o = {};
    for (const [k, id] of Object.entries(FIELDS)) o[k] = el(id).value;
    o.detail = parseFloat(o.detail); o.structure = parseFloat(o.structure);
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
    el("dlSrc").textContent = name ? name + (FROM_LABEL[cur.from] ? " · " + FROM_LABEL[cur.from] : "") : "";
    el("dlGo").disabled = !name;
    if (!name) { el("dlPlan").textContent = "select a video first - play one in the preview"; return Promise.resolve(); }
    const seq = ++planSeq;
    return post("/api/dlss5/plan", Object.assign({ name, from: cur.from }, opts()))
      .then((j) => { if (seq === planSeq) { el("dlPlan").textContent = `${j.source.width}×${j.source.height} → about ${j.target.width}×${j.target.height} (×${j.target.factor})` + (el("dlFps").value !== "off" ? ` · frame generation ${el("dlFps").value}` : ""); el("dlGo").disabled = false; } })
      .catch((e) => { if (seq === planSeq) { el("dlPlan").textContent = e.message; el("dlGo").disabled = true; } });
  }
  function say(t) {
    const x = el("vtitle");
    if (x) x.textContent = t;
    if (typeof window.logLine === "function") { try { window.logLine("[dlss5] " + t); } catch { /* optional */ } }
  }
  function go() {
    const name = cur.name;
    if (!name) { plan(); return; }
    el("dlGo").disabled = true;
    post("/api/dlss5", Object.assign({ name, from: cur.from }, opts())).then((j) => {
      say(`⚡ DLSS 5 queued: ${name} → about ${j.target.width}×${j.target.height}`);
      close();
      if (typeof cur.onQueued === "function") { try { cur.onQueued(j); } catch { /* the caller's */ } }
      try { if (typeof refreshJobs === "function") refreshJobs(); if (typeof selectJob === "function") selectJob(j.id); } catch { /* the queue polls anyway */ }
    }).catch((e) => { el("dlPlan").textContent = "not queued: " + e.message; })
      .then(() => { if (shown()) el("dlGo").disabled = !cur.name; });
  }
  function open(o) {
    o = o || {};
    return fetch("/api/dlss5/settings").then((r) => r.json()).catch(() => ({})).then((d) => {
      build({ modes: (d && d.modes) || ["2K"], styles: (d && d.styles) || ["default"], fps: (d && d.fps) || ["off"] });
      cur = { name: String(o.name || ""), from: String(o.from || ""), anchor: o.anchor || null, onQueued: o.onQueued || null };
      const s = (d && d.settings) || {};
      for (const [k, id] of Object.entries(FIELDS)) if (s[k] != null) el(id).value = String(s[k]);
      built.classList.remove("hidden");
      el("dlPlan").textContent = cur.name ? "reading the video…" : "";
      el("dlGo").disabled = true;
      place();
      return plan().then(place);
    });
  }
  function close() { if (built) built.classList.add("hidden"); }
  function retarget(name, from) { if (!shown()) return; cur.name = String(name || ""); cur.from = String(from || ""); plan(); }
  window.Dlss5Panel = { open, close, retarget, shown, state: () => ({ name: cur.name, from: cur.from }) };
})();
