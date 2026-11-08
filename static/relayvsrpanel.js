/* static/relayvsrpanel.js — THE 🔁 RelayVSR PANEL (2.728.0), the SeedVR2 panel's sibling (static/seedvr2panel.js).
 *
 * Tim (verbatim): "yes please add a 1920x1080 automatic preset and add https://github.com/kopperx/RelayVSR"
 * ComfyUI's core RelayVSR nodes (lib/relayvsr.js). The preview bar's 🔁 RelayVSR opens it for the video in the player:
 *
 *   RelayVsrPanel.open({ name, from, anchor, onQueued })
 *
 * Size (SeedVR2's list - the 1920 x 1080 frame first - or "the model's own x2 / x4"), model (auto = the smallest pair
 * that reaches the size), detail (the Flash decoder's 0..1); what it will make (POST /api/relayvsr/plan) before
 * 🔁 Upscale queues it (POST /api/relayvsr). The choices are the project's (relayvsr.json); the video docker's
 * ⚙ Upscaler "RelayVSR" uses the same model + detail. */
(function () {
  "use strict";
  const ID = "rvPanel";
  const FROM_LABEL = { gallery: "gallery", asset: "Video assets", ref: "reference dock", preview: "preview" };
  const SIZE_LABEL = { native: "the model's own (x2 / x4)", 720: "720p", 1080: "1080p", 1440: "1440p", 2160: "2160p (4K)",
    x2: "×2", x3: "×3", x4: "×4", "1920x1080": "1920 × 1080 (16:9 exact)" };
  const SIZE_ORDER = ["1920x1080", "native", "720", "1080", "1440", "2160", "x2", "x3", "x4"];
  let cur = { name: "", from: "", anchor: null, onQueued: null };
  let built = null, planSeq = 0;
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function build() {
    if (built) return built;
    const st = document.createElement("style");
    st.textContent = `
      #rvPanel { position: fixed; z-index: 400; left: 0; top: 0; width: 300px; padding: 9px 10px;
                 background: var(--panel, #1c1915); border: 1px solid var(--line, #3a342c); border-radius: 8px;
                 box-shadow: 0 8px 24px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 6px; font-size: .74rem; }
      #rvPanel.hidden { display: none; }
      #rvPanel label { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      #rvPanel select, #rvPanel input { max-width: 170px; }
      #rvPanel .rvrow { display: flex; gap: 6px; align-items: baseline; justify-content: space-between; }
      #rvPanel .rvdim { color: var(--dim, #8b8378); font-size: .68rem; overflow-wrap: anywhere; }`;
    try { (document.head || document.documentElement || document.body).appendChild(st); } catch { /* a bare test document */ }
    const p = document.createElement("div");
    p.id = ID; p.className = "hidden";
    p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "RelayVSR upscale");
    p.innerHTML = `
      <div class="rvrow"><b>🔁 RelayVSR</b><span id="rvSrc" class="rvdim"></span></div>
      <label>Size <select id="rvSize" title="1920 × 1080 = exactly that frame (upscaled until it covers it, the overhang trimmed off the middle); a short side keeps the aspect; the model's own = just x2 / x4"></select></label>
      <label>Model <select id="rvModel" title="auto = the smallest RelayVSR pair that reaches the size (x2 for a 960x544 clip to 1080p, x4 for 4K); x2 is LightX2V's, trained on MiniMax H3 clips">
        <option value="auto">auto</option><option value="x2">x2 (LightX2V, H3 clips)</option><option value="x4">x4 (the original)</option></select></label>
      <label>Detail <input id="rvDetail" type="number" min="0" max="1" step="0.05" value="1" title="How much of the detail the decoder adds is kept - 1 = the full model output, lower = closer to a plain (bicubic) upscale"></label>
      <div id="rvNote" class="rvdim"></div>
      <div id="rvPlan" class="rvdim"></div>
      <div class="rvrow"><button id="rvGo" class="primary">🔁 Upscale</button><button id="rvClose" class="ghost">Close</button></div>`;
    document.body.appendChild(p);
    p.addEventListener("click", (ev) => ev.stopPropagation());
    p.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.addEventListener("click", () => close());
    el("rvClose").addEventListener("click", close);
    for (const id of ["rvSize", "rvModel", "rvDetail"]) el(id).addEventListener("change", plan);
    el("rvGo").addEventListener("click", go);
    window.addEventListener("resize", () => { if (shown()) place(); });
    built = p;
    return p;
  }
  const shown = () => !!built && !built.classList.contains("hidden");
  const values = () => ({ size: el("rvSize").value, model: el("rvModel").value, detail: parseFloat(el("rvDetail").value) });
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
    el("rvSrc").textContent = name ? name + (FROM_LABEL[cur.from] ? " · " + FROM_LABEL[cur.from] : "") : "";
    el("rvGo").disabled = !name;
    if (!name) { el("rvPlan").textContent = "select a video first - play one in the preview"; return Promise.resolve(); }
    const seq = ++planSeq;
    return post("/api/relayvsr/plan", Object.assign({ name, from: cur.from }, values()))
      .then((j) => {
        if (seq !== planSeq) return;
        const t = j.target, m = t.made || t;
        el("rvPlan").textContent = `${j.source.width}×${j.source.height} → ${m.width}×${m.height} (RelayVSR ${t.model})`
          + (t.scaled ? ` → ${t.width}×${t.height}` + (t.fit === "crop" ? " (edges trimmed)" : "") : "");
        el("rvGo").disabled = false;
      })
      .catch((e) => { if (seq === planSeq) { el("rvPlan").textContent = e.message; el("rvGo").disabled = true; } });
  }
  function say(t) {
    const x = el("vtitle");
    if (x) x.textContent = t;
    if (typeof window.logLine === "function") { try { window.logLine("[relayvsr] " + t); } catch { /* optional */ } }
  }
  function go() {
    const name = cur.name;
    if (!name) { plan(); return; }
    el("rvGo").disabled = true;
    post("/api/relayvsr", Object.assign({ name, from: cur.from }, values())).then((j) => {
      say(`🔁 RelayVSR queued: ${name} → ${j.target.width}×${j.target.height}`);
      close();
      if (typeof cur.onQueued === "function") { try { cur.onQueued(j); } catch { /* the caller's */ } }
      try { if (typeof refreshJobs === "function") refreshJobs(); if (typeof selectJob === "function") selectJob(j.id); } catch { /* the queue polls anyway */ }
    }).catch((e) => { el("rvPlan").textContent = "not queued: " + e.message; })
      .then(() => { if (shown()) el("rvGo").disabled = !cur.name; });
  }
  function open(o) {
    o = o || {};
    return fetch("/api/relayvsr/settings").then((r) => r.json()).catch(() => ({})).then((d) => {
      d = d || {};
      build();
      const sizes = (d.sizes || SIZE_ORDER).slice().sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
      el("rvSize").innerHTML = sizes.map((v) => `<option value="${esc(v)}">${esc(SIZE_LABEL[v] || v)}</option>`).join("");
      const s = d.settings || {}, live = d.live || {}, addon = d.addon || {};
      el("rvSize").value = s.size || "1920x1080";
      el("rvModel").value = s.model || "auto";
      if (s.detail != null) el("rvDetail").value = String(s.detail);
      const notes = [];
      if (live.online && !live.nodes) notes.push("This ComfyUI has no RelayVSR nodes yet - update it (Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI, \"latest\") and restart it.");
      if (addon && addon.installed === false) notes.push("The model files are not downloaded yet - Settings ▸ Add-ons ▸ RelayVSR.");
      el("rvNote").textContent = notes.join(" ") || d.note || "";
      cur = { name: String(o.name || ""), from: String(o.from || ""), anchor: o.anchor || null, onQueued: o.onQueued || null };
      built.classList.remove("hidden");
      el("rvPlan").textContent = cur.name ? "reading the video…" : "";
      el("rvGo").disabled = true;
      place();
      return plan().then(place);
    });
  }
  function close() { if (built) built.classList.add("hidden"); }
  function retarget(name, from) { if (!shown()) return; cur.name = String(name || ""); cur.from = String(from || ""); plan(); }
  window.RelayVsrPanel = { open, close, retarget, shown, state: () => ({ name: cur.name, from: cur.from }) };
})();
