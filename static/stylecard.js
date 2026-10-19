/* static/stylecard.js — THE VIDEO STYLE CARD IN BASIC SETTINGS (2.401.0).
 *
 * Tim (verbatim): "show the selected video style settings with it's model in basic settings . allow user to quick
 * change the model".
 *
 * At the top of Basic Settings' video set: the style picked in the prompt docker's Video dropdown (the same choice -
 * changing it here changes it there), its kind (MiniMax H3 / Wan / LTX ...), every phase's MODEL as a ComfyUI model
 * dropdown (the Settings → Video picker: folder filter + 📁 browse) with that phase's steps / cfg / load precision, the
 * text encoder, the VAE, the LoRAs, the negative prompt. Picking another model SAVES it into the style
 * (POST /api/styles - the style file in styles/video/) so the next render uses it; ⚙ opens the full style editor.
 * "— template —" (no style) says the workflow's own models run.
 *
 * Uses the page's globals (index.html): videoStyles, videoArchs, cmCombo, loadComfyModels, cmData,
 * refreshVideoStyles, switchStab, vsPaintForm. StyleCard.paint() is called after every style refresh / pick. */
(function () {
  "use strict";
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const base = (p) => String(p || "").split(/[\\/]/).pop();
  const DTYPE = { "": "", default: "full precision", fp8_e4m3fn: "fp8", fp8_e4m3fn_fast: "fp8 fast", fp8_e5m2: "fp8 e5m2" };
  let saving = 0;

  // index.html's top-level lets (one global scope across the page's classic scripts)
  const styles = () => { try { return typeof videoStyles !== "undefined" ? videoStyles || [] : []; } catch { return []; } };
  const archs = () => { try { return typeof videoArchs !== "undefined" ? videoArchs || [] : []; } catch { return []; } };
  const cmCats = () => { try { return (typeof cmData !== "undefined" && cmData && cmData.model_categories) || null; } catch { return null; } };
  const current = () => { const s = el("videoStyleSel"); const id = s ? s.value : ""; return styles().find((x) => x.id === id) || null; };

  function msg(t, bad) { const m = el("bscMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } }

  /** The style object as POST /api/styles takes it back (the client-side extras stripped). */
  function body(st, phases) {
    const b = JSON.parse(JSON.stringify(st));
    for (const k of ["swap", "ltx", "_file"]) delete b[k];
    b.kind = "video";
    if (phases) b.phases = phases;
    return b;
  }

  async function saveModel(st, i, model) {
    const phases = (st.phases && st.phases.length ? st.phases : [{}]).map((p) => ({ ...p }));
    while (phases.length <= i) phases.push({ model: "", steps: null, cfg: null });   // Wan 2.2's low-noise phase, first set here
    const was = phases[i].model || "";
    if (was === model) return;
    phases[i].model = model;
    const my = ++saving;
    msg(`saving ${model || "the workflow's own model"} into "${st.name}"…`);
    try {
      const r = await fetch("/api/styles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body(st, phases)) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "save failed");
      delete infoCache[st.id];
      if (typeof window.refreshVideoStyles === "function") await window.refreshVideoStyles(st.id);
      if (my !== saving) return;
      paint();
      msg(`"${st.name}"${phases.length > 1 ? ` phase ${i + 1}` : ""}: ${model ? base(model) : "the workflow's own model"} - the next render uses it`);
      if (typeof window.logLine === "function") window.logLine(`[style] "${st.name}"${phases.length > 1 ? ` phase ${i + 1}` : ""} model: ${was || "(workflow's own)"} -> ${model || "(workflow's own)"} (saved in styles/video)`);
    } catch (e) {
      msg("not saved: " + e.message, true);
      paint();
    }
  }

  function phaseLabel(st, i, n) {
    if (st.arch === "wan22") return i === 0 ? "Model · high noise" : "Model · low noise";
    return n > 1 ? `Model · phase ${i + 1}` : "Model";
  }
  function ownLabel(info, i) {
    if (!info) return "— the workflow's own model —";
    if (info.auto) return "— auto: the Wan file ComfyUI lists —";
    return info.loaders && info.loaders[i] ? `— the workflow's own: ${base(info.loaders[i])} —` : "— the workflow's own model —";
  }
  function phaseRow(st, ph, i, n, info) {
    const row = document.createElement("div");
    row.className = "bscphase";
    const bits = [ph.steps != null ? `steps ${ph.steps}` : "", ph.cfg != null ? `cfg ${ph.cfg}` : "",
      DTYPE[ph.dtype || ""] ? `loads as ${DTYPE[ph.dtype]}` : ""].filter(Boolean).join(" · ");
    // the model this phase actually renders with, in full (the dropdown is narrow)
    const uses = ph.model ? base(ph.model) : info && info.auto ? "auto - the Wan file ComfyUI lists"
      : info && info.loaders && info.loaders[i] ? base(info.loaders[i]) + " (the workflow's own)" : "the workflow's own";
    row.innerHTML = `<label class="f">${phaseLabel(st, i, n)}</label><div class="bsccombo"></div>`
      + `<input type="text" class="bscmodel" hidden><div class="bscuse"><span class="dim">uses</span> ${esc(uses)}</div>`
      + (bits ? `<div class="bscnums">${esc(bits)}</div>` : "");
    const inp = row.querySelector(".bscmodel");
    inp.value = ph.model || "";
    const cats = cmCats() || ["diffusion_models", "checkpoints", "unet"];
    if (typeof window.cmCombo === "function") {
      window.cmCombo(row.querySelector(".bsccombo"), inp, cats, {
        blank: ownLabel(info, i), title: `Pick the model for "${st.name}"${n > 1 ? ` phase ${i + 1}` : ""}`,
        onChange: () => saveModel(st, i, inp.value.trim()) });
      const sel = row.querySelector("select.cmfile");
      if (sel) sel.title = `The model "${st.name}" renders with${n > 1 ? ` in phase ${i + 1}` : ""} - pick another to change it (saved into the style)`;
    } else {
      inp.hidden = false;
      inp.onchange = () => saveModel(st, i, inp.value.trim());
    }
    return row;
  }

  // GET /api/stylecard/:id - the workflow's own models (routes/styleCard.js); cached per style, dropped on a save
  const infoCache = {};
  function info(id) {
    if (infoCache[id]) return Promise.resolve(infoCache[id]);
    return fetch("/api/stylecard/" + encodeURIComponent(id)).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) infoCache[id] = j; return j; }).catch(() => null);
  }
  function paint() {
    const host = el("bsStyleCard");
    if (!host) return;
    const st = current();
    const list = styles();
    const sel = `<select id="bscSel" title="The video style Generate uses - the same choice as the prompt docker's Video dropdown">`
      + `<option value="">— template —</option>` + list.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("") + `</select>`;
    host.innerHTML = `<div class="bschead"><label class="f" style="margin:0">Video style</label>${sel}`
      + `<button class="ghost gbtn" id="bscEdit" type="button" title="Edit this style in Settings → Video (workflows, LoRAs, encoder, VAE, phases)">⚙</button></div>`
      + `<div class="bscbody"></div><div class="hint" id="bscMsg"></div>`;
    el("bscSel").value = st ? st.id : "";
    el("bscSel").onchange = () => {
      const p = el("videoStyleSel");
      if (!p) return;
      p.value = el("bscSel").value;
      p.dispatchEvent(new Event("change"));            // the prompt docker's own handler: inherit, LTX mode, Swap
      paint();
    };
    el("bscEdit").onclick = () => {
      try {
        el("openSettings").onclick();
        if (typeof window.switchStab === "function") window.switchStab("video");
        const s = current();
        if (s && el("s_vslist")) { el("s_vslist").value = s.id; if (typeof window.vsPaintForm === "function") window.vsPaintForm(s); }
      } catch { /* settings not ready */ }
    };
    const box = host.querySelector(".bscbody");
    if (!st) {
      box.innerHTML = `<div class="hint">No style - Generate runs the workflow template with its own models. Pick a style to see and change its model.</div>`;
      return;
    }
    const a = archs().find((x) => x.id === st.arch);
    const wf = Object.entries(st.workflows || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${base(v)}`).join(" · ");
    const kind = document.createElement("div");
    kind.className = "bsckind";
    kind.textContent = [(a && a.label) || st.arch || "", st.swap ? "character swap" : "", st.res ? st.res + "p" : "", st.aspect || "", wf].filter(Boolean).join(" · ");
    kind.title = wf ? "Workflows: " + wf : "";
    box.appendChild(kind);
    const phases = (st.phases && st.phases.length ? st.phases : [{}]).slice();
    if (st.arch === "wan22") while (phases.length < 2) phases.push({});        // high + low noise, always both
    const rows = document.createElement("div");
    box.appendChild(rows);
    const draw = (info) => {
      rows.innerHTML = "";
      phases.forEach((ph, i) => rows.appendChild(phaseRow(st, ph || {}, i, phases.length, info)));
      if (info && info.note) rows.title = info.note;
    };
    draw(infoCache[st.id] || null);
    info(st.id).then((inf) => { if (inf && current() && current().id === st.id && rows.isConnected) draw(inf); });
    const extra = document.createElement("div");
    extra.className = "bscextra";
    const te = (st.te || []).filter(Boolean).map(base).join(", ");
    const loras = (st.loras || []).filter((l) => l && l.path).map((l) => `${base(l.path)} ×${l.weight != null ? l.weight : 1}`);
    extra.innerHTML = `<div><b>Text encoder</b> ${esc(te || "the workflow's own")}</div>`
      + `<div><b>VAE</b> ${esc(st.vae ? base(st.vae) : "the workflow's own")}</div>`
      + `<div><b>LoRAs</b> ${esc(loras.length ? loras.join(", ") : "none")}</div>`
      + (st.negative ? `<div class="bscneg" title="${esc(st.negative)}"><b>Negative</b> ${esc(st.negative)}</div>` : "");
    box.appendChild(extra);
  }

  const css = document.createElement("style");
  css.textContent = `
    #bsStyleCard { border: 1px solid var(--line); border-left: 3px solid var(--tiger); border-radius: 6px; padding: 6px 8px; margin: 0 0 8px; background: rgba(255,255,255,.02); }
    #bsStyleCard .bschead { display: flex; gap: 6px; align-items: center; }
    #bsStyleCard .bschead select { flex: 1; min-width: 0; }
    #bsStyleCard .bscbody > .hint { font-size: .7rem; line-height: 1.35; color: var(--dim); }
    #bsStyleCard .bsckind { font-size: .66rem; color: var(--dim); margin: 3px 0 4px; overflow-wrap: anywhere; }
    #bsStyleCard .bscphase { margin: 2px 0 4px; }
    #bsStyleCard .cmcombo select.cmfolder { display: none; }   /* the card is narrow: the file list + 📁 browse */
    #bsStyleCard .cmcombo select.cmfile { flex: 1; min-width: 0; }
    #bsStyleCard .bscuse { font-size: .66rem; font-family: var(--mono); overflow-wrap: anywhere; margin-top: 2px; }
    #bsStyleCard .bscuse .dim { color: var(--dim); font-family: inherit; }
    #bsStyleCard .bscnums { font-size: .64rem; color: var(--dim); font-family: var(--mono); margin-top: 2px; }
    #bsStyleCard .bscextra { font-size: .66rem; color: var(--dim); display: grid; gap: 1px; }
    #bsStyleCard .bscextra b { color: var(--fg, inherit); font-weight: 600; margin-right: 4px; }
    #bsStyleCard .bscneg { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #bsStyleCard #bscMsg { font-size: .66rem; margin-top: 3px; }
    #bsStyleCard #bscMsg.bad { color: var(--bad, #c98b7a); }`;
  try { (document.head || document.documentElement || document.body).appendChild(css); } catch { /* a bare test document */ }
  window.StyleCard = { paint, saveModel, current, info };
})();
