/* bitGen Studio — THE STORYBOARD (2.456.0), window.H3Story.
 *
 * Tim (verbatim): "convert video docker into floating docker - change it's name to StoryBoard - Add Thumbnails to each
 * scene generated with the selected image model,give user the option to use the character sheet and location images
 * added reference images as reference images for the storyboard images - give user the option in each scene to use
 * storyboard image as the first or last image"
 *
 *   STORYBOARD   the video docker is called "StoryBoard" (its header and the status bar button) and FLOATS: ⇱ in its
 *                header = a window of its own over the app (static/floatpanels.js - its title drags it, every edge
 *                sizes it, it docks as a tab in a named docker, ⇲ puts it back under the timeline).
 *   THE BAR      🖼 the image model (the prompt docker's image style until another is picked) · ☑ Character sheets
 *                ☑ Locations ☑ Reference images (what rides with each picture as references) · 🖼 All missing.
 *   EACH SCENE   a thumbnail (its storyboard picture, or an empty frame) with 🖼 make / ↻ redo it, → First / → Last
 *                (the scene's own first / last frame slot - its render starts / ends on the picture) and ✕.
 *   HOW          POST /api/storyboard/:n/plan (the prompt + the references adopted into Images assets) -> the ordinary
 *                /api/genimage job (the Queue shows it) -> polled -> POST /api/storyboard/:n/fromjob keeps it in
 *                projects/<p>/storyboard/. lib/storyboard.js, routes/storyboard.js.
 * Pure (Node: scripts/test-storyboard.js): slotBody, thumbHtml.
 */
(function (root) {
  "use strict";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /** the body that sets scene n's first / last frame to its storyboard picture */
  const slotBody = (item, slot) => ({ slot: slot === "last" ? "last" : "first", kind: "project", rel: item.rel });
  /** a scene's thumbnail box (item = its storyboard picture or null; busy = being made) */
  function thumbHtml(n, item, busy) {
    const img = item ? `<img src="/api/storyboard/${n}/thumb?v=${encodeURIComponent(String(item.at || ""))}" alt="Storyboard picture of scene ${n}" title="${esc((item.label || "") + (item.style ? " · " + item.style : ""))}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:3px">` : `<span class="hint" style="font-size:.62rem;text-align:center;padding:2px">${busy ? "⏳ making…" : "no picture"}</span>`;
    return `<div class="sbthumb" data-sbthumb="${n}" style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">`
      + `<div style="width:112px;height:63px;flex:none;border:1px dashed #3a4050;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#111318">${img}</div>`
      + `<div style="display:flex;flex-direction:column;gap:2px">`
      + `<button class="ghost gbtn" data-sbgen="${n}" type="button" ${busy ? "disabled " : ""}title="${item ? "Make scene " + n + "'s storyboard picture again" : "Make scene " + n + "'s storyboard picture"} with the StoryBoard's image model" aria-label="Storyboard picture for scene ${n}" style="font-size:.66rem;padding:1px 5px">${busy ? "⏳" : item ? "↻ 🖼" : "🖼 make"}</button>`
      + (item ? `<span style="display:flex;gap:2px"><button class="ghost gbtn" data-sbfirst="${n}" type="button" title="Use it as scene ${n}'s FIRST frame (the render starts on it)" aria-label="Use as the first frame of scene ${n}" style="font-size:.62rem;padding:1px 4px">→ First</button>`
        + `<button class="ghost gbtn" data-sblast="${n}" type="button" title="Use it as scene ${n}'s LAST frame (the render ends on it)" aria-label="Use as the last frame of scene ${n}" style="font-size:.62rem;padding:1px 4px">→ Last</button>`
        + `<button class="ghost gbtn" data-sbdel="${n}" type="button" title="Remove scene ${n}'s storyboard picture" aria-label="Remove the storyboard picture of scene ${n}" style="font-size:.62rem;padding:1px 4px">✕</button></span>` : "")
      + `</div></div>`;
  }
  const H3Story = { slotBody, thumbHtml };
  if (typeof module !== "undefined" && module.exports) { module.exports = H3Story; return; }
  root.H3Story = H3Story;

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const store = { get: (k, d) => { try { const v = root.localStorage.getItem("sb." + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { root.localStorage.setItem("sb." + k, JSON.stringify(v)); } catch { /* private mode */ } } };
  const opts = Object.assign({ sheets: true, locations: true, refs: true, style: "" }, store.get("opts", {}) || {});
  const items = new Map(), busy = new Set();
  let say = (t) => { const n = $("sbMsg"); if (n) n.textContent = t || ""; };
  const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; });
  const imageStyles = () => (typeof root.styleList !== "undefined" && Array.isArray(root.styleList) ? root.styleList : (typeof styleList !== "undefined" ? styleList : [])).filter((s) => s && !s.chain && s.kind !== "music");   // eslint-disable-line no-undef
  const styleNow = () => opts.style || ($("styleSel") ? $("styleSel").value : "");

  function rename() {
    const d = $("videodock"); if (!d) return;
    const h = d.querySelector(":scope > .bhead");
    if (h) for (const n of h.childNodes) if (n.nodeType === 3 && /Video/.test(n.textContent)) { n.textContent = n.textContent.replace(/Video/, "StoryBoard"); break; }
    const b = $("tV"); if (b) { b.textContent = "StoryBoard"; b.title = "StoryBoard - the scenes with their storyboard pictures, the cast, 360° environments"; }
  }
  /* ---- floating: the whole docker as a floatpanels panel */
  function floating() {
    const P = root.H3Panels, d = $("videodock"); if (!P || !d || $("sbFloatBtn")) return;
    const h = d.querySelector(":scope > .bhead"); if (!h) return;
    const css = doc.createElement("style"); css.id = "sbCss";
    css.textContent = ".h3fp #videodock{flex:1 1 auto!important;height:auto!important;min-height:0!important;display:flex;flex-direction:column}.h3fp #videodock > .bhead{display:none}"
      + ".h3fp #videodock > .bbody{flex:1 1 auto;min-height:0;overflow:auto}#videodock .sbbar select{max-width:170px}";
    doc.head.appendChild(css);
    const b = doc.createElement("button"); b.className = "dgfloat"; b.id = "sbFloatBtn";   // 2.545.0: not .maxbtn (toggleMax re-labelled it ⛶); styled by static/dockgroup.js b.type = "button"; b.title = "Float the StoryBoard - a window of its own (⇲ in its title puts it back)"; b.textContent = "⇱";
    b.onclick = (e) => { e.stopPropagation(); e.preventDefault(); if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse("videodock"); P.float("sb.dock", (P.get("sb.dock") || {}).w ? null : { x: Math.max(20, root.innerWidth - 760), y: 70, w: 700, h: Math.min(720, root.innerHeight - 120) }); };
    const mx = [...h.querySelectorAll(":scope > .maxbtn")].pop(); if (mx) h.insertBefore(b, mx.nextSibling); else h.appendChild(b);
    P.adopt({ id: "sb.dock", title: "StoryBoard", el: d, home: { parent: d.parentNode, before: d.nextElementSibling },
      onState: (s) => { d.classList.toggle("sb-floating", s !== "home"); if (s !== "home") d.classList.remove("dockgone", "collapsed"); try { root.dispatchEvent(new root.Event("resize")); } catch (er) { /* fine */ } } });
  }
  /* ---- the bar */
  function bar() {
    const pick = $("scPickRow"); if (!pick || $("sbBar")) return;
    const row = doc.createElement("div"); row.className = "grpbar sbbar"; row.id = "sbBar"; row.style.cssText = "gap:6px;align-items:center;flex-wrap:wrap";
    row.innerHTML = `<b style="font-size:.75rem">🖼 StoryBoard</b><select id="sbStyle" title="The image model the storyboard pictures are made with (the prompt docker's image style until you pick another)" aria-label="Storyboard image model"></select>`
      + `<label class="chk" title="The character sheets of the characters a scene's prompt names ride as reference pictures"><input type="checkbox" id="sbSheets"${opts.sheets ? " checked" : ""}> Character sheets</label>`
      + `<label class="chk" title="The pictures of the locations a scene's prompt names ride as reference pictures"><input type="checkbox" id="sbLocs"${opts.locations ? " checked" : ""}> Locations</label>`
      + `<label class="chk" title="The scene's own reference pictures and the project's References ride as reference pictures"><input type="checkbox" id="sbRefs"${opts.refs ? " checked" : ""}> Reference images</label>`
      + `<button class="ghost gbtn" id="sbAll" type="button" title="Make the storyboard picture of every scene that has none yet (one after another)">🖼 All missing</button><span class="hint" id="sbMsg" style="font-size:.7rem"></span>`;
    pick.parentNode.insertBefore(row, pick);
    const q = (id) => row.querySelector("#" + id);
    const keep = () => store.set("opts", opts);
    q("sbSheets").onchange = () => { opts.sheets = q("sbSheets").checked; keep(); };
    q("sbLocs").onchange = () => { opts.locations = q("sbLocs").checked; keep(); };
    q("sbRefs").onchange = () => { opts.refs = q("sbRefs").checked; keep(); };
    q("sbStyle").onchange = () => { opts.style = q("sbStyle").value; keep(); };
    q("sbStyle").onfocus = paintStyles;
    q("sbAll").onclick = () => allMissing();
    paintStyles();
  }
  function paintStyles() {
    const s = $("sbStyle"); if (!s) return;
    const list = imageStyles(), main = $("styleSel") ? $("styleSel").value : "", cur = opts.style;
    s.innerHTML = `<option value="">= the prompt docker's (${esc((list.find((x) => x.id === main) || {}).name || "none")})</option>` + list.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
    s.value = cur && list.some((x) => x.id === cur) ? cur : "";
  }
  /* ---- the thumbnails on the scene cards (the board repaints #scList - added again each time) */
  function paintCards() {
    const list = $("scList"); if (!list) return;
    list.querySelectorAll(".sccard[data-sc]").forEach((c) => {
      const n = +c.dataset.sc, it = items.get(n) || null, key = (it ? it.at : "-") + (busy.has(n) ? "b" : "");
      let box = c.querySelector(":scope > .sbthumb");
      if (box && box.dataset.k === key) return;
      const w = doc.createElement("div"); w.innerHTML = thumbHtml(n, it, busy.has(n)); const nb = w.firstChild; nb.dataset.k = key;
      if (box) box.replaceWith(nb); else c.appendChild(nb);
      nb.addEventListener("click", (e) => e.stopPropagation());
      const on = (sel, f) => { const x = nb.querySelector(sel); if (x) x.onclick = (e) => { e.stopPropagation(); f(); }; };
      on("[data-sbgen]", () => make(n));
      on("[data-sbfirst]", () => useAs(n, "first"));
      on("[data-sblast]", () => useAs(n, "last"));
      on("[data-sbdel]", () => post(`/api/storyboard/${n}/clear`, {}).then(() => { items.delete(n); paintCards(); say(`scene ${n}'s storyboard picture removed`); }).catch((e) => say("⚠ " + e.message)));
    });
  }
  async function refresh() {
    try { const j = await (await fetch("/api/storyboard")).json(); items.clear(); for (const it of j.items || []) items.set(it.n, it); } catch { /* the server's */ }
    paintCards();
  }
  async function make(n) {
    if (busy.has(n)) return;
    const style = styleNow();
    if (!style) { say("pick an image model first (Settings ▸ Image makes one)"); return; }
    const st = imageStyles().find((x) => x.id === style) || {};
    busy.add(n); paintCards(); say(`scene ${n}: making its storyboard picture with ${st.name || "the image model"}…`);
    try {
      if ((st.engine || "comfy") === "comfy" && typeof root.ensureComfyReady === "function" && !(await root.ensureComfyReady({ need: true }))) throw new Error("ComfyUI is not running");
      const plan = await post(`/api/storyboard/${n}/plan`, { sheets: opts.sheets, locations: opts.locations, refs: opts.refs });
      const body = { prompt: plan.prompt, style_id: style, batch: 1 };
      if (plan.images && plan.images.length) body.images = plan.images;
      const job = await post("/api/genimage", body);
      say(`scene ${n}: queued (${plan.images.length} reference picture${plan.images.length === 1 ? "" : "s"}: ${plan.picked.map((p) => p.group).join(", ") || "none"})`);
      let j = null;
      for (let i = 0; i < 1800; i++) {                  // up to an hour
        await new Promise((r) => setTimeout(r, i < 10 ? 500 : 2000));
        try { j = await (await fetch("/api/jobs/" + job.id)).json(); } catch { j = null; }
        if (j && /^(done|failed|error|cancelled|canceled)$/.test(j.status)) break;
      }
      if (!j || j.status !== "done") throw new Error(`the picture job ${j ? j.status : "did not answer"}`);
      const it = await post(`/api/storyboard/${n}/fromjob`, { job: job.id, style: st.name || style });
      items.set(n, it); say(`scene ${n}: storyboard picture ready`);
    } catch (e) { say(`⚠ scene ${n}: ${e.message}`); }
    finally { busy.delete(n); paintCards(); }
  }
  async function allMissing() {
    const ns = [...($("scList") || doc).querySelectorAll(".sccard[data-sc]")].map((c) => +c.dataset.sc).filter((n) => !items.has(n));
    if (!ns.length) return say("every scene has its storyboard picture");
    for (const n of ns) await make(n);
  }
  async function useAs(n, slot) {
    const it = items.get(n); if (!it) return;
    try {
      await post(`/api/scenes/${n}/fl`, slotBody(it, slot));
      say(`scene ${n}: its storyboard picture is its ${slot} frame now`);
      if (root.bgScenes && typeof root.bgScenes.refresh === "function") root.bgScenes.refresh();   // characters.js: the board again (the slot shows)
    } catch (e) { say("⚠ " + e.message); }
  }
  function start() {
    if (!$("videodock") || !$("scList")) return false;
    rename(); bar(); floating();
    const list = $("scList");
    if (root.MutationObserver) new root.MutationObserver(() => paintCards()).observe(list, { childList: true });
    refresh();
    root.setInterval(refresh, 20000);
    H3Story.refresh = refresh; H3Story.make = make; H3Story.useAs = useAs; H3Story.items = () => [...items.values()]; H3Story.opts = opts; H3Story.allMissing = allMissing;
    return true;
  }
  const boot = () => { if (!start()) root.setTimeout(boot, 300); };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
