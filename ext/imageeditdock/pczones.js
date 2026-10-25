/* pczones.js — 🔲 ZONES: boxes on the canvas, each with what goes in it (2.569.0), window.PCZones.
 *
 * Tim (verbatim): "can we add zones to the image editor - like put 3 boxes on the canvas, and tell the image model to
 * put kite in this box, dog in this box, bench in this box?" - asked how: "let me pick per run", on "both" an existing
 * picture and a blank canvas.
 *
 *   🔲 ZONES TOOL   (with the marquees, M) drag on the canvas = a new box (its own colour and number); drag a box = move
 *                   it, drag a corner / an edge = size it; Delete removes the picked one. The boxes belong to the
 *                   document (kept in its .bgi) and show over the canvas (☑ Show boxes) - they are never painted in.
 *   THE ✨ AI PANEL ▸ 🔲 Zones   one line per box (its colour, its number, what goes in it, ✕), the scene (the whole
 *                   picture, optional), HOW, ✨ Generate zones:
 *     ▣ One box at a time   each box is a ✨ Generate (Add content) in that box - the editor's own fill (the fill style,
 *                           👁 the edit model that sees around it): one render per box, all queued at once into ⏳ Pending;
 *                           ☑ Apply as they come puts each box's first result in as its own layer
 *     ✎ Edit model, one pass  the picture with the boxes drawn on it goes to the Edit model (Qwen Edit / Klein) once:
 *                           "Put a kite inside the red box. Put a dog inside the blue box ... Remove the coloured box
 *                           outlines" - one render, the light matches; the place is looser, an outline can be left
 *     ▦ Regional prompt, one pass  a NEW picture from the boxes: /api/genimage {regions} - one ComfyUI pass where each
 *                           box's words act only inside it (scripts/comfy_regions.py: ConditioningSetArea) with the
 *                           scene's words over the whole; best with SDXL-type styles, FLUX / Qwen follow it more loosely
 *   The method starts on ▦ Regional for a blank canvas, ▣ One box at a time for a picture.
 * 2.592.0 🎭 A BOX CAN CARRY A CHARACTER LoRA (Tim: "lets just add the regional character lora and prompt relay" - from
 * Nougan_Nodes, Settings ▸ Add-ons ▸ Nougan Nodes): in ▦ Regional each box line has 🎭 - a LoRA from ComfyUI's loras +
 * its strength. Two different LoRAs at most per picture (LoRA A / LoRA B), each only inside its boxes, so two characters
 * keep their own faces (scripts/comfy_regions.py: NouganRegionalCharacterLoRA). Best on FLUX.2 / Krea 2 / Qwen Image
 * styles with LoRAs made for that model.
 * Pure (Node: scripts/test-zones569.js, test-nougan592.js): COLORS, METHODS, normBox, hitZone, moveZone, rectMask,
 * isBlank, instruction, regionsOf, renderSize, defaultMethod, charLoras, LORAS_MAX.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const COLORS = [["red", "#ff2a2a"], ["blue", "#2a6bff"], ["green", "#20c050"], ["yellow", "#ffd400"], ["magenta", "#ff2ad4"], ["cyan", "#00d5ff"], ["orange", "#ff8a00"], ["purple", "#8b3dff"]];
  const MAX = 8;
  const METHODS = [["boxes", "▣ One box at a time"], ["edit", "✎ Edit model, one pass"], ["regional", "▦ Regional prompt, one pass"]];
  /** a dragged rectangle (any corner order) -> {x, y, w, h} in whole pixels, inside the picture */
  function normBox(x0, y0, x1, y1, W, H) {
    const cl = (v, m) => Math.max(0, Math.min(m, v));
    const a = cl(Math.min(x0, x1), W), b = cl(Math.min(y0, y1), H), c = cl(Math.max(x0, x1), W), d = cl(Math.max(y0, y1), H);
    return { x: Math.round(a), y: Math.round(b), w: Math.round(c - a), h: Math.round(d - b) };
  }
  /** what is under a point: {i, part} - part = "move" inside, "n" "s" "e" "w" "ne" "nw" "se" "sw" on an edge / corner
   *  (within tol), the top-most (last) box first; none = null */
  function hitZone(zones, x, y, tol) {
    const t = tol || 6;
    for (let i = (zones || []).length - 1; i >= 0; i--) {
      const z = zones[i];
      const inX = x >= z.x - t && x <= z.x + z.w + t, inY = y >= z.y - t && y <= z.y + z.h + t;
      if (!inX || !inY) continue;
      const n = Math.abs(y - z.y) <= t, s = Math.abs(y - (z.y + z.h)) <= t, w = Math.abs(x - z.x) <= t, e = Math.abs(x - (z.x + z.w)) <= t;
      const part = (n ? "n" : s ? "s" : "") + (w ? "w" : e ? "e" : "");
      return { i, part: part || "move" };
    }
    return null;
  }
  /** a box dragged by (dx, dy) on `part` from where it started (z0) -> the new box (at least 8 px, inside the picture) */
  function moveZone(z0, part, dx, dy, W, H) {
    if (part === "move") {
      return Object.assign({}, z0, { x: Math.round(Math.max(0, Math.min(W - z0.w, z0.x + dx))), y: Math.round(Math.max(0, Math.min(H - z0.h, z0.y + dy))) });
    }
    let x0 = z0.x, y0 = z0.y, x1 = z0.x + z0.w, y1 = z0.y + z0.h;
    if (/w/.test(part)) x0 = Math.min(x1 - 8, x0 + dx);
    if (/e/.test(part)) x1 = Math.max(x0 + 8, x1 + dx);
    if (/n/.test(part)) y0 = Math.min(y1 - 8, y0 + dy);
    if (/s/.test(part)) y1 = Math.max(y0 + 8, y1 + dy);
    return Object.assign({}, z0, normBox(x0, y0, x1, y1, W, H));
  }
  /** a box as a selection mask of the picture's size (255 inside) */
  function rectMask(z, W, H) {
    const m = new Uint8Array(W * H), x0 = Math.max(0, Math.round(z.x)), y0 = Math.max(0, Math.round(z.y));
    const x1 = Math.min(W, Math.round(z.x + z.w)), y1 = Math.min(H, Math.round(z.y + z.h));
    for (let y = y0; y < y1; y++) m.fill(255, y * W + x0, y * W + x1);
    return m;
  }
  /** an RGBA picture with nothing on it (one colour, or see-through) */
  function isBlank(rgba) {
    if (!rgba || rgba.length < 4) return true;
    let r0 = -1, g0 = 0, b0 = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] < 8) continue;
      if (r0 < 0) { r0 = rgba[i]; g0 = rgba[i + 1]; b0 = rgba[i + 2]; continue; }
      if (Math.abs(rgba[i] - r0) + Math.abs(rgba[i + 1] - g0) + Math.abs(rgba[i + 2] - b0) > 24) return false;
    }
    return true;
  }
  const words = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  /** the Edit model's instruction for one pass: each box by its colour, the scene, the outlines taken away */
  function instruction(zones, scene, blank) {
    const zs = (zones || []).filter((z) => words(z.text));
    const lines = zs.map((z) => `Put ${words(z.text).replace(/[.!]+$/, "")} inside the ${z.color || "red"} box.`);
    const sc = words(scene).replace(/[.!]+$/, "");
    return (blank && sc ? `Turn this blank canvas into a picture: ${sc}. ` : sc ? `The scene: ${sc}. ` : "")
      + lines.join(" ")
      + ` Each thing fills its box and sits naturally in the scene - its light, shadows and perspective match.`
      + ` Remove every coloured box outline completely; ${blank ? "nothing of the outlines is left" : "everything outside the boxes stays exactly the same"}.`;
  }
  /** the boxes for /api/genimage: fractions of the picture (2.592.0 + a box's 🎭 character LoRA and its strength) */
  function regionsOf(zones, W, H) {
    const k = (v) => Math.round(v * 10000) / 10000;
    return (zones || []).filter((z) => words(z.text) && z.w > 0 && z.h > 0).map((z) => {
      const o = { x: k(z.x / W), y: k(z.y / H), w: k(z.w / W), h: k(z.h / H), text: words(z.text) };
      if (z.lora && String(z.lora).trim()) { o.lora = String(z.lora).trim(); o.lora_strength = Number.isFinite(+z.lora_w) ? +z.lora_w : 1; }
      return o;
    });
  }
  /** 2.592.0: the different 🎭 character LoRAs of the boxes that have words (either slash, in order) */
  const LORAS_MAX = 2;
  function charLoras(zones) {
    const out = [];
    for (const z of zones || []) { const l = z && words(z.text) && z.lora ? String(z.lora).trim().replace(/\\/g, "/") : ""; if (l && !out.includes(l)) out.push(l); }
    return out;
  }
  /** the picture's shape at about one megapixel, on a 16-px grid */
  function renderSize(W, H, mp) {
    const a = (W || 1) / (H || 1), area = (mp || 1) * 1048576, r16 = (v) => Math.max(256, Math.round(v / 16) * 16);
    return { width: r16(Math.sqrt(area * a)), height: r16(Math.sqrt(area / a)) };
  }
  const defaultMethod = (blank) => (blank ? "regional" : "boxes");
  const pure = { COLORS, MAX, METHODS, normBox, hitZone, moveZone, rectMask, isBlank, instruction, regionsOf, renderSize, defaultMethod, charLoras, LORAS_MAX };

  /* ---------------- the tool in the tool column (before the editor starts) ---------------- */
  const UI = root.PCUI;
  if (UI && UI.GROUPS && !UI.__zones) {
    UI.__zones = true;
    const gm = UI.GROUPS.find((g) => g && g.k === "m");
    if (gm) gm.tools.push(["zones", "🔲 Zones Tool - boxes that say what the AI puts where"]);
    if (UI.ICON) UI.ICON.zones = '<rect x="3" y="3" width="8" height="7" rx="1"/><rect x="13" y="5" width="8" height="6" rx="1"/><rect x="6" y="13" width="12" height="8" rx="1"/>';
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, doc = E.doc || root.document, win = E.win || root, $ = E.$, say = E.say, store = E.store;
    if (!E.tools || !$("kxRun")) return;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const zones = () => S.zones || (S.zones = []);
    let picked = -1, drag = null, method = "", show = store.get("zones.show", true) !== false, autoApply = store.get("zones.auto", true) !== false;
    const nextColor = () => { const used = new Set(zones().map((z) => z.color)); return (COLORS.find(([n]) => !used.has(n)) || COLORS[zones().length % COLORS.length])[0]; };
    const hex = (name) => (COLORS.find(([n]) => n === name) || COLORS[0])[1];
    const blankNow = () => { if (!S.w) return true; try { const f = E.flatten(), k = Math.min(1, 96 / Math.max(S.w, S.h)), c = E.newCanvas(Math.max(1, Math.round(S.w * k)), Math.max(1, Math.round(S.h * k))), g = c.getContext("2d"); g.drawImage(f, 0, 0, c.width, c.height); return isBlank(g.getImageData(0, 0, c.width, c.height).data); } catch (e) { return false; } };

    /* ---- the panel: in the ✨ AI panel, under ✨ Generate */
    const box = doc.createElement("details"); box.id = "kxZones"; box.className = "kxzones";
    box.innerHTML = `<summary title="Boxes on the canvas, each with what goes in it - the AI puts each thing in its box">🔲 Zones <span id="pzN" class="pzn"></span></summary>
      <div class="pzb">
        <div class="pzrow"><button class="ghost" id="pzDraw" type="button" title="The 🔲 Zones tool: drag on the canvas for a box - drag a box to move it, its edges to size it, Delete removes it">🔲 Draw boxes</button>
          <label title="Show the boxes over the canvas (they are never painted in)"><input type="checkbox" id="pzShow"${show ? " checked" : ""}> Show boxes</label>
          <button class="ghost" id="pzClear" type="button" title="Remove every box">🗑</button></div>
        <div id="pzList" class="pzlist"></div>
        <div class="pzrow"><input type="text" id="pzScene" placeholder="the scene - the whole picture (optional): a sunny park in spring" title="What the whole picture is - used by ✎ Edit model and ▦ Regional (and for a blank canvas)" style="flex:1;min-width:0"></div>
        <div class="pzrow"><select id="pzMethod" title="How the boxes are filled">${METHODS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
          <select id="pzStyle" title="▦ Regional: the image style that makes the new picture (a ComfyUI style)" style="display:none;min-width:0;flex:1"></select></div>
        <div class="pzrow"><label id="pzAutoL" title="▣ One box at a time: each box's first result goes in as its own layer by itself (the others wait in ⏳ Pending)"><input type="checkbox" id="pzAuto"${autoApply ? " checked" : ""}> Apply as they come</label></div>
        <div class="pzhint" id="pzHint"></div>
        <button class="ghost kxrun" id="pzGo" type="button">✨ Generate zones</button>
      </div>`;
    const run = $("kxRun"); run.parentNode.insertBefore(box, ($("kxResBtns") || run).nextSibling);
    const css = doc.createElement("style"); css.id = "pczCss";
    css.textContent = ".kxzones{margin-top:6px;border:1px solid var(--pc-line,#3a3a3a);border-radius:5px;padding:2px 6px}.kxzones>summary{cursor:pointer;font-weight:600;padding:2px 0}.kxzones .pzn{font-weight:400;color:var(--pc-dim,#999)}"
      + ".kxzones .pzb{display:flex;flex-direction:column;gap:4px;padding:4px 0}.kxzones .pzrow{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.kxzones .pzlist{display:flex;flex-direction:column;gap:3px}"
      + ".kxzones .pzz{display:flex;gap:4px;align-items:center}.kxzones .pzz.on{outline:1px solid var(--pc-acc,#f59e2c);border-radius:3px}.kxzones .pzz .sw{flex:none;width:20px;height:18px;border-radius:3px;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;text-shadow:0 1px 1px #000;cursor:pointer}"
      + ".kxzones .pzz input{flex:1;min-width:0}.kxzones .pzhint{font-size:11px;color:var(--pc-dim,#999)}"
      + ".kxzones .pzl.on{color:var(--pc-acc,#f59e2c)}.kxzones .pzlr{display:flex;gap:4px;align-items:center;margin:0 0 2px 24px}.kxzones .pzlr .pzlc{flex:1;min-width:0}.kxzones .pzlr .pzlc select{max-width:100%}.kxzones .pzlr input[type=number]{width:52px;flex:none}";
    doc.head.appendChild(css);
    const q = (id) => box.querySelector("#" + id);
    // the image styles (/api/styles - the page's own list holds only the prompt docker's current kind)
    let styleCache = null;
    async function loadStyles() {
      try { const j = await (await win.fetch("/api/styles")).json(); styleCache = Array.isArray(j.styles) ? j.styles : []; } catch (e) { styleCache = styleCache || []; }
      paintStyles();
    }
    function paintStyles() {
      const all = styleCache || (Array.isArray(win.styleList) ? win.styleList : (typeof styleList !== "undefined" && Array.isArray(styleList) ? styleList : []));   // eslint-disable-line no-undef
      const s = q("pzStyle"), list = all.filter((x) => x && !x.chain && (x.kind || "image") === "image" && (x.engine || "comfy") === "comfy");
      const want = s.value || store.get("zones.style", "") || ($("styleSel") && doc.getElementById("styleSel") ? doc.getElementById("styleSel").value : "");
      s.innerHTML = list.length ? list.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("") : `<option value="">(no ComfyUI image style)</option>`;
      if (list.some((x) => x.id === want)) s.value = want;
    }
    function paintHint() {
      const m = q("pzMethod").value, blank = blankNow();
      q("pzStyle").style.display = m === "regional" ? "" : "none";
      q("pzAutoL").style.display = m === "boxes" ? "" : "none";
      box.querySelectorAll(".pzl,.pzlr").forEach((el) => { el.style.display = m === "regional" ? "" : "none"; });
      q("pzHint").textContent = m === "boxes" ? (blank ? "a blank canvas: each thing is drawn into white - ▦ Regional or ✎ Edit makes the whole scene" : "each box = one ✨ Generate (Add content) with the fill style above; all queued at once into ⏳ Pending")
        : m === "edit" ? `one render by the Edit model (${($("ieEditStyle") && $("ieEditStyle").selectedOptions[0] ? $("ieEditStyle").selectedOptions[0].textContent : "pick one above")}): the boxes are drawn on a copy of the picture and it is told what goes in each colour`
        : "a NEW picture from the boxes in one ComfyUI pass - the scene over the whole, each box's words only inside it (best with SDXL-type styles); it lands as a layer. 🎭 on a box = a character LoRA only inside it (two different ones at most - Settings ▸ Add-ons ▸ Nougan Nodes)";
    }
    function paintList() {
      const zs = zones();
      q("pzN").textContent = zs.length ? `(${zs.length})` : "";
      if (!zs.length) { q("pzList").innerHTML = `<span class="pzhint">no boxes yet - 🔲 Draw boxes, then drag on the canvas</span>`; return; }
      q("pzList").innerHTML = zs.map((z, i) => `<div class="pzz${i === picked ? " on" : ""}" data-z="${i}"><span class="sw" style="background:${hex(z.color)}" title="Box ${i + 1} (${z.color}) - click to pick it">${i + 1}</span>`
        + `<input type="text" data-zt="${i}" value="${esc(z.text || "")}" placeholder="what goes in box ${i + 1} - e.g. a red kite" aria-label="What goes in box ${i + 1}">`
        + `<button class="ghost pzl${z.lora ? " on" : ""}" type="button" data-zl="${i}" title="🎭 a character LoRA only inside box ${i + 1}${z.lora ? " - now: " + esc(z.lora) : ""} (▦ Regional; two different LoRAs at most - Settings ▸ Add-ons ▸ Nougan Nodes)">🎭</button>`
        + `<button class="ghost" type="button" data-zx="${i}" title="Remove box ${i + 1}">✕</button></div>`
        + (z._lo ? `<div class="pzlr" data-zlr="${i}"><span class="pzlc" id="pzLc${i}"></span><input type="text" id="pzLi${i}" value="${esc(z.lora || "")}" placeholder="loras\\character.safetensors" aria-label="Box ${i + 1}'s character LoRA" style="flex:1;min-width:0">`
          + `<input type="number" data-zlw="${i}" min="-4" max="4" step="0.05" value="${Number.isFinite(+z.lora_w) ? +z.lora_w : 1}" title="The LoRA's strength in this box (1 = as trained)" aria-label="Box ${i + 1}'s LoRA strength"></div>` : "")).join("");
      // 2.592.0: the 🎭 rows - ComfyUI's LoRA list (the page's model combo) when it is there, else the typed name
      zs.forEach((z, i) => {
        if (!z._lo) return;
        const host = q("pzLc" + i), inp = q("pzLi" + i);
        const set = () => { z.lora = inp.value.trim(); const b = box.querySelector(`[data-zl="${i}"]`); if (b) b.classList.toggle("on", !!z.lora); paintHint(); };
        if (typeof win.cmCombo === "function") { try { win.cmCombo(host, inp, ["loras"], { blank: "— no character LoRA —", title: "Box " + (i + 1) + "'s character LoRA", onChange: set }); inp.style.display = "none"; } catch (e) { host.style.display = "none"; } }
        else host.style.display = "none";
        inp.addEventListener("input", set);
        inp.addEventListener("keydown", (e) => e.stopPropagation());
      });
      q("pzList").querySelectorAll("[data-zlw]").forEach((inp) => {
        inp.addEventListener("input", () => { const z = zones()[+inp.dataset.zlw]; if (z) z.lora_w = parseFloat(inp.value); });
        inp.addEventListener("keydown", (e) => e.stopPropagation());
      });
      q("pzList").querySelectorAll("[data-zl]").forEach((b) => { b.onclick = () => { const z = zones()[+b.dataset.zl]; if (z) { z._lo = !z._lo; paintList(); paintHint(); } }; });
      q("pzList").querySelectorAll("[data-zt]").forEach((inp) => {
        inp.addEventListener("input", () => { const z = zones()[+inp.dataset.zt]; if (z) { z.text = inp.value.slice(0, 400); E.drawOverlay(); } });
        inp.addEventListener("keydown", (e) => e.stopPropagation());
        inp.addEventListener("focus", () => { picked = +inp.dataset.zt; box.querySelectorAll(".pzz").forEach((r) => r.classList.toggle("on", +r.dataset.z === picked)); E.drawOverlay(); });
      });
      q("pzList").querySelectorAll("[data-zx]").forEach((b) => { b.onclick = () => removeZone(+b.dataset.zx); });
      q("pzList").querySelectorAll(".sw").forEach((b) => { b.onclick = () => { picked = +b.parentNode.dataset.z; paintList(); E.drawOverlay(); }; });
    }
    /** the ✨ AI panel shown (it is a tab of the panel column) and the Zones section open */
    function showPanel() { try { if (E.ui && E.ui.showTab) E.ui.showTab("kxAi"); } catch (e) { /* no tabs */ } if (!box.open) box.open = true; }
    function removeZone(i) { zones().splice(i, 1); picked = -1; paintList(); E.drawOverlay(); }
    q("pzDraw").onclick = () => { E.setTool("zones"); if (!box.open) box.open = true; say("🔲 drag on the canvas for a box - then say what goes in it"); };
    q("pzShow").onchange = () => { show = q("pzShow").checked; store.set("zones.show", show); E.drawOverlay(); };
    q("pzAuto").onchange = () => { autoApply = q("pzAuto").checked; store.set("zones.auto", autoApply); };
    q("pzClear").onclick = () => { S.zones = []; picked = -1; paintList(); E.drawOverlay(); };
    q("pzMethod").onchange = () => { method = q("pzMethod").value; paintHint(); };
    q("pzStyle").onchange = () => store.set("zones.style", q("pzStyle").value);
    q("pzStyle").onfocus = () => { if (!styleCache) loadStyles(); else paintStyles(); };
    q("pzScene").addEventListener("keydown", (e) => e.stopPropagation());
    q("pzGo").onclick = () => generate();
    box.addEventListener("toggle", () => { if (box.open) { if (!method) q("pzMethod").value = defaultMethod(blankNow()); loadStyles(); paintHint(); paintList(); } });

    /* ---- the tool */
    E.tools.zones = {
      id: "zones", name: "Zones", cursor: "crosshair",
      options: () => `<span class="tn">🔲 Zones</span><span style="color:var(--pc-dim)">drag = a new box · drag a box = move it · its edges / corners = size it · Delete removes the picked one · say what goes in each in the ✨ AI panel ▸ 🔲 Zones</span>`,
      down(e, x, y) {
        if (!S.w) return false;
        const h = hitZone(zones(), x, y, 6 / (S.zoom || 1));
        if (h) { picked = h.i; drag = { i: h.i, part: h.part, x0: x, y0: y, z0: Object.assign({}, zones()[h.i]) }; paintList(); E.drawOverlay(); return true; }
        if (zones().length >= MAX) { say(`${MAX} boxes at most - ✕ one in the ✨ AI panel ▸ 🔲 Zones`); return false; }
        drag = { make: true, x0: x, y0: y };
        return true;
      },
      move(e, x, y) {
        if (!drag) return;
        if (drag.make) { drag.cur = normBox(drag.x0, drag.y0, x, y, S.w, S.h); E.drawOverlay(); return; }
        const z = zones()[drag.i]; if (!z) return;
        Object.assign(z, moveZone(drag.z0, drag.part, x - drag.x0, y - drag.y0, S.w, S.h));
        E.drawOverlay();
      },
      up() {
        if (drag && drag.make) {
          const b = drag.cur;
          if (b && b.w >= 8 && b.h >= 8) {
            zones().push(Object.assign(b, { text: "", color: nextColor() }));
            picked = zones().length - 1;
            showPanel();
            paintList();
            const inp = box.querySelector(`[data-zt="${picked}"]`); if (inp) inp.focus();
            say(`box ${picked + 1} (${zones()[picked].color}) - say what goes in it`);
          }
        }
        drag = null; E.drawOverlay();
      },
      key(e) {
        if ((e.key === "Delete" || e.key === "Backspace") && picked >= 0 && zones()[picked]) { removeZone(picked); return true; }
        return false;
      },
    };
    E.overlayHooks.push((g, px) => {
      const zs = zones(), t = drag && drag.make ? drag.cur : null;
      if (!S.w || (!show && S.tool !== "zones") || (!zs.length && !t)) return;
      const lw = 2 * px;
      zs.forEach((z, i) => {
        const c = hex(z.color);
        g.fillStyle = c; g.globalAlpha = 0.07; g.fillRect(z.x, z.y, z.w, z.h); g.globalAlpha = 1;
        g.lineWidth = i === picked ? lw * 1.6 : lw; g.strokeStyle = c; g.setLineDash(i === picked ? [] : [6 * px, 3 * px]); g.strokeRect(z.x, z.y, z.w, z.h); g.setLineDash([]);
        const label = `${i + 1}${z.text ? " " + String(z.text).slice(0, 28) : ""}`;
        g.font = `${Math.round(12 * px)}px system-ui,sans-serif`;
        const tw = g.measureText(label).width + 8 * px, th = 16 * px;
        g.fillStyle = c; g.fillRect(z.x, Math.max(0, z.y - th), tw, th);
        g.fillStyle = "#fff"; g.fillText(label, z.x + 4 * px, Math.max(0, z.y - th) + 12 * px);
        if (i === picked && S.tool === "zones") {
          g.fillStyle = "#fff"; g.strokeStyle = c; g.lineWidth = px;
          for (const [hx, hy] of [[z.x, z.y], [z.x + z.w, z.y], [z.x, z.y + z.h], [z.x + z.w, z.y + z.h]]) { g.fillRect(hx - 4 * px, hy - 4 * px, 8 * px, 8 * px); g.strokeRect(hx - 4 * px, hy - 4 * px, 8 * px, 8 * px); }
        }
      });
      if (t) { g.strokeStyle = hex(nextColor()); g.lineWidth = lw; g.setLineDash([4 * px, 4 * px]); g.strokeRect(t.x, t.y, t.w, t.h); g.setLineDash([]); }
    });

    /* ---- ✨ Generate zones */
    async function generate() {
      if (!S.w) return say("open a picture or make a blank canvas first (File ▸ New)");
      const zs = zones().filter((z) => words(z.text));
      if (!zs.length) return say(zones().length ? "say what goes in each box first" : "draw a box first - 🔲 Draw boxes, then drag on the canvas");
      const m = q("pzMethod").value || defaultMethod(blankNow()), scene = words(q("pzScene").value) || (E.api && E.api.mainPrompt && m !== "boxes" ? E.api.mainPrompt() : "");
      tev("ie_zones", `${m}:${zs.length}`);
      if (m === "boxes") {
        const pend = !!(E.pending && !E.pending.auto);
        say(`🔲 ${zs.length} box(es): one ✨ Generate each…`);
        for (const z of zs) {
          const i = zones().indexOf(z);
          const o = { zone: true, mode: "generate", sel: rectMask(z, S.w, S.h), prompt: words(z.text), fillKind: "add", label: `🔲 ${i + 1} ${z.color}`, autoApply, direct: !pend };
          if (pend) E.runAI(o); else await E.runAI(o);
        }
        return;
      }
      if (m === "edit") {
        const c = E.newCanvas(S.w, S.h), g = c.getContext("2d");
        g.drawImage(E.flatten(), 0, 0);
        const lw = Math.max(3, Math.round(Math.min(S.w, S.h) / 170));
        g.lineWidth = lw;
        for (const z of zs) { g.strokeStyle = hex(z.color); g.strokeRect(z.x + lw / 2, z.y + lw / 2, Math.max(1, z.w - lw), Math.max(1, z.h - lw)); }
        const editStyle = $("ieEditStyle") ? $("ieEditStyle").value : "";
        if (!editStyle) return say("pick an Edit model in the ✨ AI panel (Qwen Image Edit / FLUX.2 Klein …)");
        return E.runAI({ zone: true, mode: "edit", source: c, prompt: instruction(zs, scene, blankNow()), editStyle, noRefs: true, label: "🔲 zones (edit model)", autoApply, direct: !(E.pending && !E.pending.auto) });
      }
      // ▦ regional: a new picture from the boxes
      if (!styleCache) await loadStyles(); else paintStyles();
      const style = q("pzStyle").value;
      if (!style) return say("▦ Regional needs a ComfyUI image style (Settings ▸ Image) - pick it beside the method");
      const cl = charLoras(zs);
      if (cl.length > LORAS_MAX) return say(`🎭 ${LORAS_MAX} different character LoRAs at most in one picture (LoRA A and LoRA B) - these boxes have ${cl.length}`);
      const sz = renderSize(S.w, S.h, 1);
      const body = { prompt: scene || zs.map((z) => words(z.text)).join(", "), style_id: style, width: sz.width, height: sz.height, batch: 1, regions: regionsOf(zs, S.w, S.h) };
      if (win.H3Neg && win.H3Neg.get && win.H3Neg.get()) body.negative = win.H3Neg.get();
      let job = null;
      try {
        const r = await win.fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        job = await r.json().catch(() => ({}));
        if (!r.ok || job.error) return say("▦ regional: " + (job.error || "HTTP " + r.status));
      } catch (e) { return say("▦ regional: " + e.message); }
      const label = `🔲 regional (${zs.length} box${zs.length > 1 ? "es" : ""})`, T = E.layer();
      const pend = E.pending && !E.pending.auto;
      const thumb = (() => { const k = Math.min(1, 160 / Math.max(S.w, S.h)), c = E.newCanvas(Math.max(1, Math.round(S.w * k)), Math.max(1, Math.round(S.h * k))); c.getContext("2d").drawImage(E.flatten(), 0, 0, c.width, c.height); return c; })();
      const it = pend ? E.pending.add({ job: job.id, mode: "generate", prompt: body.prompt, label, target: T ? T.id : null, targetName: T ? T.name : "", info: { box: { x: 0, y: 0, w: S.w, h: S.h } }, base: thumb, n: 1, of: 1 }) : null;
      say(`▦ regional: ${zs.length} box(es) in one pass at ${sz.width}×${sz.height}${cl.length ? ` - 🎭 ${cl.length} character LoRA${cl.length > 1 ? "s" : ""}` : ""}…`);
      if (pend) E.pending.track();
      try {
        const url = await E.api.awaitResult(job.id, say);
        if (!url) { if (it) E.pending.fail(it); return; }
        const im = await E.imgOf(url), c = E.newCanvas(S.w, S.h);
        c.getContext("2d").drawImage(im, 0, 0, S.w, S.h);
        if (it) { E.pending.ready(it, c); if (autoApply) E.pending.apply(it); say("▦ regional: done - in ⏳ Pending" + (autoApply ? " (applied as a layer)" : "")); }
        else { const L = E.makeLayer(label); L.canvas.getContext("2d").drawImage(c, 0, 0); E.addLayer(L, "regional zones", false); E.refresh(); E.renderLayersPanel(); say("▦ regional: a new layer"); }
      } catch (e) { say("▦ regional failed: " + e.message); if (it) E.pending.fail(it); }
      finally { if (pend) E.pending.untrack(); }
    }
    function tev(n, w) { try { if (win.H3TestEvent) win.H3TestEvent(n, w); } catch (e) { /* the 🧪 list */ } }

    E.zones = { list: zones, generate, paint: () => { paintList(); paintHint(); }, open: () => { showPanel(); loadStyles(); paintHint(); paintList(); }, picked: () => picked };
    paintList();
  }
  const PCZones = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCZones;
  else root.PCZones = PCZones;
})(typeof window !== "undefined" ? window : globalThis);
