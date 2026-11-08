/* static/flowhmrpanel.js — THE 🕺 MOTION PANEL (2.730.0): FlowHMR motion capture for the video in the player.
 *
 * Tim (verbatim): "and one more for today https://flowhmr.github.io/ . we can add a reference video for motion?" + "add it
 * to addons with a disclaimer that it is for non commercial use only".
 *
 *   FlowHmrPanel.open({ name, from, anchor })
 *
 * Camera (moving - VGGT-Omega every 1 / 5 / 10 frames - or still), steps; the NON-COMMERCIAL notice always shown; when
 * FlowHMR is not ready, what is missing and where (Settings ▸ Add-ons ▸ FlowHMR) instead of the button. 🕺 Capture motion
 * queues the job (POST /api/flowhmr); the motion lands in the project's models3d/ (.fbx + .npz). */
(function () {
  "use strict";
  const ID = "fhPanel";
  const FROM_LABEL = { gallery: "gallery", asset: "Video assets", ref: "reference dock", preview: "preview" };
  let cur = { name: "", from: "", anchor: null }, built = null, ready = false;
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function build() {
    if (built) return built;
    const st = document.createElement("style");
    st.textContent = `
      #fhPanel { position: fixed; z-index: 400; left: 0; top: 0; width: 320px; padding: 9px 10px;
                 background: var(--panel, #1c1915); border: 1px solid var(--line, #3a342c); border-radius: 8px;
                 box-shadow: 0 8px 24px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 6px; font-size: .74rem; }
      #fhPanel.hidden { display: none; }
      #fhPanel label { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      #fhPanel select, #fhPanel input { max-width: 170px; }
      #fhPanel .fhrow { display: flex; gap: 6px; align-items: baseline; justify-content: space-between; }
      #fhPanel .fhdim { color: var(--dim, #8b8378); font-size: .68rem; overflow-wrap: anywhere; }
      #fhPanel .fhwarn { color: #e8b04a; font-size: .68rem; border: 1px solid #6b5420; border-radius: 4px; padding: 4px 6px; }`;
    try { (document.head || document.documentElement || document.body).appendChild(st); } catch { /* a bare test document */ }
    const p = document.createElement("div");
    p.id = ID; p.className = "hidden";
    p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "FlowHMR motion capture");
    p.innerHTML = `
      <div class="fhrow"><b>🕺 Motion (FlowHMR)</b><span id="fhSrc" class="fhdim"></span></div>
      <div id="fhNotice" class="fhwarn">⚠ Non-commercial use only.</div>
      <label>Camera <select id="fhCamera" title="moving: the camera is estimated (VGGT-Omega) so the person's path in the world is right; still: a fixed camera - the lightest">
        <option value="moving">moving</option><option value="still">still (tripod)</option></select></label>
      <label>Camera every <select id="fhEvery" title="How often the moving camera is estimated - every frame is the most exact and needs about 30 GB of VRAM; every 10 frames is much lighter">
        <option value="1">frame</option><option value="5">5 frames</option><option value="10">10 frames</option></select></label>
      <label>Steps <input id="fhSteps" type="number" min="1" max="100" step="1" value="20" title="FlowHMR's sampling steps (20 = the model's own)"></label>
      <div id="fhState" class="fhdim"></div>
      <div class="fhrow"><button id="fhGo" class="primary">🕺 Capture motion</button><button id="fhClose" class="ghost">Close</button></div>`;
    document.body.appendChild(p);
    p.addEventListener("click", (ev) => ev.stopPropagation());
    p.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.addEventListener("click", () => close());
    el("fhClose").addEventListener("click", close);
    el("fhCamera").addEventListener("change", () => { el("fhEvery").disabled = el("fhCamera").value === "still"; });
    el("fhGo").addEventListener("click", go);
    window.addEventListener("resize", () => { if (shown()) place(); });
    built = p;
    return p;
  }
  const shown = () => !!built && !built.classList.contains("hidden");
  function place() {
    if (!built) return;
    const a = cur.anchor && cur.anchor.getBoundingClientRect ? cur.anchor.getBoundingClientRect() : { left: 40, top: 80, bottom: 80 };
    const h = built.offsetHeight, w = built.offsetWidth;
    let top = a.top - h - 6;
    if (top < 8) top = Math.min(window.innerHeight - h - 8, a.bottom + 6);
    built.style.left = Math.max(8, Math.min(a.left, window.innerWidth - w - 8)) + "px";
    built.style.top = Math.max(8, top) + "px";
  }
  function paint() {
    el("fhSrc").textContent = cur.name ? cur.name + (FROM_LABEL[cur.from] ? " · " + FROM_LABEL[cur.from] : "") : "";
    el("fhGo").disabled = !ready || !cur.name;
    if (ready && !cur.name) el("fhState").textContent = "select a video first - play one in the preview";
  }
  function say(t) {
    const x = el("vtitle");
    if (x) x.textContent = t;
    if (typeof window.logLine === "function") { try { window.logLine("[flowhmr] " + t); } catch { /* optional */ } }
  }
  function go() {
    if (!cur.name || !ready) return;
    el("fhGo").disabled = true;
    const body = { name: cur.name, from: cur.from, camera: el("fhCamera").value, every: parseInt(el("fhEvery").value, 10), steps: parseInt(el("fhSteps").value, 10) };
    fetch("/api/flowhmr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(new Error(j.error || r.statusText)))))
      .then((j) => {
        say(`🕺 FlowHMR queued: ${cur.name} → models3d/ (.fbx + .npz)`);
        close();
        try { if (typeof refreshJobs === "function") refreshJobs(); if (typeof selectJob === "function") selectJob(j.id); } catch { /* the queue polls anyway */ }
      })
      .catch((e) => { el("fhState").textContent = "not queued: " + e.message; })
      .then(() => { if (shown()) el("fhGo").disabled = !ready || !cur.name; });
  }
  function open(o) {
    o = o || {};
    return fetch("/api/flowhmr/status").then((r) => r.json()).catch(() => ({})).then((d) => {
      d = d || {};
      build();
      cur = { name: String(o.name || ""), from: String(o.from || ""), anchor: o.anchor || null };
      ready = !!d.installed;
      el("fhNotice").textContent = "⚠ " + (d.notice || "Non-commercial use only.");
      const df = d.defaults || {};
      if (df.camera) el("fhCamera").value = df.camera;
      if (df.every) el("fhEvery").value = String(df.every);
      if (df.steps) el("fhSteps").value = String(df.steps);
      el("fhEvery").disabled = el("fhCamera").value === "still";
      el("fhState").innerHTML = ready ? "The motion lands in the project's <b>models3d</b> (.fbx for the timeline's 3D layers and Blender, .npz SMPL-H)."
        : "FlowHMR is not ready - <b>Settings ▸ Add-ons ▸ FlowHMR</b>" + ((d.missing || []).length ? ": " + d.missing.map((m) => esc(m.what)).join(", ") + " missing." : ".");
      built.classList.remove("hidden");
      paint();
      place();
    });
  }
  function close() { if (built) built.classList.add("hidden"); }
  function retarget(name, from) { if (!shown()) return; cur.name = String(name || ""); cur.from = String(from || ""); paint(); }
  window.FlowHmrPanel = { open, close, retarget, shown, state: () => ({ name: cur.name, from: cur.from, ready }) };
})();
