/* pcgenfill.js — ✨ GENERATE FILL IN A SHAPE / IN A MASK (2.437.0), window.PCGenFill.
 *
 * Tim (verbatim): "continue with the photoshop gap closure, allow user to generate fill inside a selected shape or mask".
 * Pick a layer and:
 *   ✨ Generate Fill in Shape…   inside the layer's own outline - a shape, a text, a pixel layer's content, a smart
 *                                object (a vector mask's path when the layer has one) - the result lands as a NEW layer
 *                                CLIPPED to it (↳), right above it (after the layers already clipped to it): the
 *                                shape stays a live shape, the fill can be moved, masked or regenerated.
 *   ✨ Generate Fill in Mask…    inside the layer's mask (white = where) - the result lands as a new layer above it
 *                                with a copy of that mask.
 * The prompt (the ✨ AI panel's, or the prompt docker's), how many results; then it is the ✨ AI panel's Generate:
 * the outline becomes the selection, the results come in there, click one to compare, ✔ Apply (Enter) places it.
 * Layer menu, the layer's right-click menu, and the Properties panel (✨ in shape / ✨ in mask).
 *
 * Pure (Node: scripts/test-genfill.js): areaFromAlpha, areaFromMask, invert, count, chainEnd.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** an RGBA picture -> where it has pixels (its alpha, 0 - 255) */
  function areaFromAlpha(rgba) { const n = rgba.length >> 2, o = new Uint8Array(n); for (let i = 0; i < n; i++) o[i] = rgba[i * 4 + 3]; return o; }
  /** a mask picture (grey: white = shown) -> 0 - 255, its alpha counted (a transparent part = hidden) */
  function areaFromMask(rgba) { const n = rgba.length >> 2, o = new Uint8Array(n); for (let i = 0; i < n; i++) o[i] = Math.round(rgba[i * 4] * rgba[i * 4 + 3] / 255); return o; }
  function invert(a) { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = 255 - a[i]; return o; }
  /** how many pixels are (more than half) in */
  function count(a) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] > 127) n++; return n; }
  /** a tree list (pcdoc toTree) and the index of the base: the last node of the clipping chain on it (the base itself if none) */
  function chainEnd(list, i) { let j = i; while (j + 1 < list.length && list[j + 1].L && list[j + 1].L.clip) j++; return j; }
  const SHAPED = new Set(["pixel", "shape", "text", "smart", "fill"]);
  /** can this layer be filled in its shape / its mask? */
  const canShape = (L) => !!L && (SHAPED.has(L.type) || !!(L.vmask && L.vmask.path)) && L.type !== "adjust";
  const canMask = (L) => !!(L && L.mask && L.mask.canvas);

  /* ================================ the editor ================================ */
  /** the result layer `L` placed onto `T`: clipped above it (how = shape) or with a copy of its mask (how = mask) - one undo step */
  function placeOnto(E, L, T, how) {
    const S = E.S, D = E.D || root.PCDoc;
    if (how === "frame" && E.frames) return E.frames.placeResult(L, T);   // 2.442.0: ✨ Generate with a closed shape active (pcframes.js)
    const before = E.snapStruct();
    if (how === "mask" && T.mask) {
      const m = E.newMask("#ffffff", T.mask.canvas.width, T.mask.canvas.height), g = m.canvas.getContext("2d");
      g.clearRect(0, 0, m.canvas.width, m.canvas.height); g.drawImage(T.mask.canvas, 0, 0);
      Object.assign(m, { on: true, density: T.mask.density == null ? 1 : T.mask.density, feather: T.mask.feather || 0, linked: true });
      L.mask = m; L.clip = false;
    } else L.clip = true;
    const tree = D.toTree(S.layers), r = D.findNode(tree, T.id);
    const above = r ? r.list[chainEnd(r.list, r.i)].L.id : T.id;
    S.layers = D.insert(S.layers, L, above, false);
    S.active = S.layers.indexOf(L);
    E.push({ t: "struct", before, after: E.snapStruct(), label: how === "mask" ? "generate fill in mask" : "generate fill in shape" });
    S.maskEdit = false;
    return L;
  }

  function install(E) {
    const S = E.S, doc = E.doc || root.document, say = E.say, $ = E.$ || ((id) => doc.getElementById(id));
    if (!E.ui || !E.ui.addCmd) return;
    const L = () => (S.w ? E.layer() : null);
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    /** where to generate: Uint8Array (S.w x S.h) */
    function areaOf(T, how) {
      if (how === "mask") { const c = T.mask.canvas; return areaFromMask(c.getContext("2d").getImageData(0, 0, c.width, c.height).data); }
      if (T.type !== "shape" && T.vmask && T.vmask.path && root.PCPath) {
        const a = root.PCPath.areaMask(T.vmask.path, S.w, S.h, E.cv);
        return T.vmask.invert ? invert(a) : a;
      }
      const c = T.canvas; return areaFromAlpha(c.getContext("2d").getImageData(0, 0, c.width, c.height).data);
    }
    /** run it: the area as the selection, the ✨ AI panel's Generate with `prompt` / `n` results, the target remembered */
    function run(T, how, prompt, n) {
      if (!T) return say("pick a layer first");
      if (how === "mask" ? !canMask(T) : !canShape(T)) return say(how === "mask" ? `${T.name} has no layer mask - Layer ▸ Layer Mask first` : `${T.name} has no shape to fill (a group / an adjustment layer)`);
      if (S.busy) return say("still working on the last one");
      const a = areaOf(T, how);
      if (a.length !== S.w * S.h || !count(a)) return say(`nothing in ${T.name}'s ${how === "mask" ? "mask" : "shape"} to fill`);
      E.applyShape(a, "replace", how === "mask" ? "select the mask" : "select the shape");
      if (prompt != null && $("iePrompt")) $("iePrompt").value = prompt;
      if (n) { S.count = Math.max(1, Math.min(4, n | 0)); if ($("kxCount")) $("kxCount").value = String(S.count); }
      E.setAiMode("generate");
      if (E.ui.showTab) E.ui.showTab("kxAi");
      S.genInto = { id: T.id, how };
      if (E.flattenCache) E.flattenCache();
      return E.runAI();
    }
    function dialog(how) {
      const T = L(); if (!T) return say("open a picture first");
      if (how === "mask" ? !canMask(T) : !canShape(T)) return run(T, how);
      const p0 = ($("iePrompt") && $("iePrompt").value) || "";
      E.ui.dialog(how === "mask" ? "✨ Generate Fill in Mask" : "✨ Generate Fill in Shape", `<div class="kxrow" style="color:var(--pc-dim)">${how === "mask"
        ? `Inside <b>${esc(T.name)}</b>'s mask (white = where). The result: a new layer above it with the same mask.`
        : `Inside <b>${esc(T.name)}</b>'s outline. The result: a new layer clipped to it (↳) - the ${T.type === "shape" ? "shape stays a live shape" : "layer stays as it is"}.`}</div>
        <div class="kxrow"><textarea id="gfP" rows="3" style="width:100%" placeholder="What should fill it (empty = the prompt docker's prompt)">${esc(p0)}</textarea></div>
        <div class="kxrow"><span>Results</span><select id="gfN">${[1, 2, 3, 4].map((k) => `<option${k === (S.count || 1) ? " selected" : ""}>${k}</option>`).join("")}</select>
        <span style="color:var(--pc-dim)">then click one in ✨ AI to compare, ✔ Apply (Enter) places it</span></div>`,
      (d) => { run(T, how, d.querySelector("#gfP").value.trim(), +d.querySelector("#gfN").value || 1); }, { okLabel: "✨ Generate" });
      const ta = doc.getElementById("gfP"); if (ta) { ta.addEventListener("keydown", (e) => e.stopPropagation()); ta.focus(); }
    }
    E.ui.addCmd("layer.genshape", "✨ Generate Fill in Shape…", "", () => dialog("shape"), { enabled: () => canShape(L()) }, ["Layer", "layer.clip", true]);
    E.ui.addCmd("layer.genmask", "✨ Generate Fill in Mask…", "", () => dialog("mask"), { enabled: () => canMask(L()) }, ["Layer", "layer.genshape"]);
    E.ui.layerCtxItems = (E.ui.layerCtxItems || []).concat(["layer.genshape", "layer.genmask"]);
    E.ui.propsExtra = (E.ui.propsExtra || []).concat([(A, box) => {
      if (!canShape(A) && !canMask(A)) return;
      const row = doc.createElement("div"); row.className = "kxrow"; row.id = "ppGenFill"; row.style.marginTop = "6px";
      row.innerHTML = (canShape(A) ? `<button class="ghost" id="ppGenShape" title="Generate inside this layer's outline - the result clipped to it">✨ fill in shape</button>` : "")
        + (canMask(A) ? `<button class="ghost" id="ppGenMask" title="Generate inside this layer's mask - the result with the same mask">✨ fill in mask</button>` : "");
      box.appendChild(row);
      if (doc.getElementById("ppGenShape")) doc.getElementById("ppGenShape").onclick = () => dialog("shape");
      if (doc.getElementById("ppGenMask")) doc.getElementById("ppGenMask").onclick = () => dialog("mask");
    }]);
    E.genFill = { run, dialog, areaOf };
  }

  const PCGenFill = { areaFromAlpha, areaFromMask, invert, count, chainEnd, canShape, canMask, placeOnto, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCGenFill;
  else root.PCGenFill = PCGenFill;
})(typeof window !== "undefined" ? window : globalThis);
