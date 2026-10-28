/* pctextfill.js — THE IMAGE EDITOR: FILL A SHAPE WITH TEXT (2.608.0), window.PCTextFill.
 *
 * Tim (verbatim): "can we fill shapes with text" - all three ways (static/textfill.js does the drawing):
 *   🅰 Fill with Text… (right-click a shape, Layer ▸ Fill Shape with Text…, the shape tools' options bar)
 *     Flow inside       a new text layer whose lines wrap INSIDE the shape's outline (Photoshop's area type - pctype.js
 *                       t.area); Fit = the biggest size that still fits all the words
 *     Stretch to fill   a new text layer whose letters are bent and stretched to fill the outline top to bottom
 *                       (pctext.js t.env) - a heart, a circle, a star filled by the word
 *     Repeat as fill    the SHAPE's own fill becomes the text in rows (angle, line spacing, every other row shifted),
 *                       clipped to the shape - it stays a shape (L.shape.tfill), the text editable here again
 *   Flow / Stretch take a text effect preset too (Preset ▾) and stay ordinary text layers (type into them, warp them).
 *   Hide the shape: the outline only holds the text.
 *   shape.tfill = {on, str, font, size, weight, italic, color, leading, angle, stagger, sep}
 * The page: fillShape(g, s, drawShape0) (pcdoc.drawShape), dialog(SL), install(E).
 */
(function (root) {
  "use strict";
  const TFILL_DEFAULT = { on: true, str: "TEXT", font: "Arial", size: 28, weight: 700, italic: false, color: "#ffffff", leading: 1.15, angle: 0, stagger: true, sep: "  ·  " };
  const api = { TFILL_DEFAULT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root || !root.document) return;

  function newC(ref, w, h) { const c = (ref && ref.ownerDocument || root.document).createElement("canvas"); c.width = w; c.height = h; return c; }
  /** pcdoc.drawShape: the rows of text clipped to the shape (its stroke drawn again on top) */
  function fillShape(g, s, drawShape0) {
    const F = root.H3TextFill; if (!F || !s.tfill) return;
    const W = g.canvas.width, H = g.canvas.height, T = newC(g.canvas, W, H), tg = T.getContext("2d");
    F.repeatRows(tg, Object.assign({}, TFILL_DEFAULT, s.tfill));
    const M = newC(g.canvas, W, H);
    drawShape0(M.getContext("2d"), Object.assign({}, s, { fill: "#ffffff", fillOn: true, strokeOn: false, tfill: null }));
    tg.globalCompositeOperation = "destination-in"; tg.drawImage(M, 0, 0);
    g.drawImage(T, 0, 0);
    if (s.strokeOn && (+s.strokeW || 0) > 0) drawShape0(g, Object.assign({}, s, { fillOn: false, tfill: null }));
  }

  function install(E) {
    const { S, D, doc, say } = E; if (!E.ui || !E.ui.dialog) return;
    const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const isShape = (L) => !!L && L.type === "shape" && !!L.shape;
    const polyOf = (SL) => (E.type && E.type.areaOfShape ? E.type.areaOfShape(SL) : null);
    const ctxOf = (L) => L.canvas.getContext("2d");
    function dialog(SL0) {
      const SL = SL0 || E.layer();
      if (!isShape(SL)) return say("Fill with Text: pick a shape layer first (the shape tools make one)");
      const poly = polyOf(SL);
      const tf = SL.shape.tfill || {}, FONTS = Object.keys(D.FONT_STACK).filter((f) => !/^(serif|sans-serif|monospace)$/.test(f));
      const font0 = tf.font || (S.typeFont || "Arial"), mode0 = tf.on ? "repeat" : poly ? "flow" : "repeat";
      const html = `<div class="rw"><span>Fill the shape</span><select id="tfMode" style="grid-column:2/4">
          <option value="flow"${mode0 === "flow" ? " selected" : ""}${poly ? "" : " disabled"}>Flow the text inside it (lines wrap in the outline)</option>
          <option value="stretch"${poly ? "" : " disabled"}>Stretch the text to fill it (the letters take its form)</option>
          <option value="repeat"${mode0 === "repeat" ? " selected" : ""}>Repeat the text as its fill (rows - it stays a shape)</option></select></div>
        <div class="rw" style="align-items:start"><span>Text</span><textarea id="tfStr" rows="3" style="grid-column:2/4;resize:vertical">${esc(tf.str || "Your text fills the shape")}</textarea></div>
        <div class="rw"><span>Font</span><select id="tfFont" class="h3-font" style="grid-column:2/4">${FONTS.concat(FONTS.includes(font0) ? [] : [font0]).map((f) => `<option${f === font0 ? " selected" : ""}>${esc(f)}</option>`).join("")}</select></div>
        <div class="rw"><span>Size (px)</span><input type="number" id="tfSize" min="4" max="1000" value="${Math.round(tf.size || S.typeSize || 36)}"><label id="tfFitL"><input type="checkbox" id="tfFit" checked> Fit to the shape</label></div>
        <div class="rw"><span>Style</span><label><input type="checkbox" id="tfBold" ${tf.weight === 400 ? "" : "checked"}> Bold</label><label><input type="checkbox" id="tfItal" ${tf.italic ? "checked" : ""}> Italic</label></div>
        <div class="rw"><span>Colour</span><input type="color" id="tfCol" value="${esc(tf.color || S.fg || "#ffffff")}"><span id="tfFxBox" style="grid-column:3"></span></div>
        <div id="tfRep"><div class="rw"><label>Angle (°)</label><input type="range" id="tfAng" min="-90" max="90" value="${+tf.angle || 0}"><input type="number" id="tfAngN" min="-90" max="90" value="${+tf.angle || 0}"></div>
          <div class="rw"><label>Line spacing</label><input type="number" id="tfLead" min="0.6" max="4" step="0.05" value="${tf.leading || 1.15}"><label><input type="checkbox" id="tfStag" ${tf.stagger === false ? "" : "checked"}> Shift every other row</label></div>
          <div class="rw"><label><input type="checkbox" id="tfBg" ${SL.shape.fillOn === false ? "" : "checked"}> Keep the shape's colour behind the text</label></div></div>
        <div id="tfNew"><div class="rw"><label><input type="checkbox" id="tfHide"> Hide the shape (it only holds the text)</label></div>
          <div class="rw"><span>Align</span><select id="tfAlign"><option value="center" selected>Centre</option><option value="left">Left</option><option value="right">Right</option></select></div></div>
        <div style="color:var(--pc-dim);font-size:11px;margin-top:4px">Flow / Stretch make a text layer you can type into, warp and give a preset; Repeat keeps the shape and fills it.</div>`;
      let fx = "";
      E.ui.dialog("Fill Shape with Text", html, (d) => apply(d), { wide: true, init(d) {
        const q = (id) => d.querySelector("#" + id);
        const show = () => { const m = q("tfMode").value; q("tfRep").style.display = m === "repeat" ? "" : "none"; q("tfNew").style.display = m === "repeat" ? "none" : ""; q("tfFitL").style.display = m === "flow" ? "" : "none"; q("tfFxBox").style.display = m === "repeat" ? "none" : ""; };
        q("tfMode").addEventListener("change", show); show();
        q("tfAng").addEventListener("input", () => { q("tfAngN").value = q("tfAng").value; });
        q("tfAngN").addEventListener("change", () => { q("tfAng").value = q("tfAngN").value; });
        if (root.H3TextFx && root.H3TextFx.picker) q("tfFxBox").appendChild(root.H3TextFx.picker({ current: "", say, onPick: (id) => { fx = id || ""; } }));
        d.querySelector("#tfStr").addEventListener("keydown", (e) => e.stopPropagation());
      } });
      function apply(d) {
        const q = (id) => d.querySelector("#" + id), m = q("tfMode").value, str = q("tfStr").value;
        const spec = { str, font: q("tfFont").value, size: Math.max(4, Math.min(1000, +q("tfSize").value || 36)), weight: q("tfBold").checked ? 700 : 400, italic: q("tfItal").checked, color: q("tfCol").value };
        if (m === "repeat") {
          E.setLayer(SL, "fill with text", (x) => {
            x.shape.tfill = Object.assign({}, TFILL_DEFAULT, spec, { on: true, angle: +q("tfAngN").value || 0, leading: Math.max(0.6, +q("tfLead").value || 1.15), stagger: q("tfStag").checked });
            x.shape.fillOn = q("tfBg").checked;
          });
          say(`🅰 ${SL.name} is filled with the text - it stays a shape (right-click ▸ Fill with Text… changes it, Layer ▸ Remove Text Fill takes it off)`);
          return;
        }
        const P = polyOf(SL); if (!P) { say("this shape has no closed outline to fill"); return false; }
        const F = root.H3TextFill, pb = F.polyBox(P), align = q("tfAlign").value;
        const L = E.makeLayer(m === "flow" ? "Text in " + SL.name : "Text filling " + SL.name, S.w, S.h, "text");
        const base = Object.assign({}, D.TEXT_DEFAULT, E.typeSettings ? E.typeSettings() : {}, spec, { align, x: Math.round(pb.x), y: Math.round(pb.y) });
        delete base.fx;
        const rel = (x0, y0) => P.map(([x, y]) => [Math.round((x - x0) * 100) / 100, Math.round((y - y0) * 100) / 100]);
        if (m === "flow") {
          base.box = { w: Math.ceil(pb.w), h: Math.ceil(pb.h) };
          base.area = { poly: rel(base.x, base.y), from: SL.name };
          if (q("tfFit").checked && E.type && E.type.layout) {
            const fits = (sz) => { const t = Object.assign({}, base, { size: sz }); const lay = E.type.layout(t); return !!lay && !lay.overflow && lay.lines.some((l) => l.text && l.text.trim()); };
            base.size = F.fitSize(fits, 4, Math.max(8, Math.min(600, Math.round(pb.h))));
          }
        } else {
          const lines = Math.max(1, String(str).split("\n").length);
          base.size = Math.max(8, Math.min(600, Math.round(pb.h / lines / 1.15)));
          base.env = { poly: rel(base.x, base.y), from: SL.name };
        }
        if (fx) base.fx = fx;
        L.text = base;
        E.structOp("fill shape with text", () => {
          D.rasterize(L);
          S.layers = D.insert(S.layers, L, SL.id, false); S.active = S.layers.indexOf(L);
          if (q("tfHide").checked) SL.visible = false;
        });
        E.renderOptions();
        say(m === "flow" ? `🅰 the text flows inside ${SL.name} at ${base.size} px - type into it with the Type tool (T)` : `🅰 the text is stretched to fill ${SL.name} - type into it with the Type tool (T); ⌒ Shape / 3D… and ⌗ Warp Grid work on it too`);
        return true;
      }
    }
    E.textFillDialog = dialog;
    // the Shape tool's options bar (a shape layer picked): 🅰 Fill with Text… and ⌗ Warp Grid
    const TS = E.tools && E.tools.shape;
    if (TS && TS.options) {
      const bo = TS.options, bb = TS.bindOptions;
      TS.options = function () {
        return bo.call(this) + (isShape(E.layer()) ? `<span class="sep"></span><button class="ghost" id="ptSTextFill" title="Fill this shape with text - flow it inside, stretch it to fill the outline, or repeat it as the fill">🅰 Fill with Text…</button>`
          + `<button class="ghost" id="ptSWarp" title="⌗ Warp Grid - bend the shape by hand (it stays a shape); 16 presets">⌗ Warp Grid</button>` : "");
      };
      TS.bindOptions = function (o) {
        if (bb) bb.call(this, o);
        const a = o.querySelector("#ptSTextFill"); if (a) a.onclick = () => dialog();
        const w = o.querySelector("#ptSWarp"); if (w) w.onclick = () => { if (E.quadTransform) E.quadTransform("warp"); };
      };
    }
    if (E.ui.addCmd) {
      const C = E.ui.addCmd, shp = () => isShape(E.layer());
      C("shape.textfill", "🅰 Fill Shape with Text…", "", () => dialog(), { enabled: shp }, ["Layer", null, true]);
      C("shape.textfilloff", "Remove Text Fill", "", () => { const L = E.layer(); E.setLayer(L, "remove text fill", (x) => { delete x.shape.tfill; x.shape.fillOn = true; }); },
        { enabled: () => shp() && !!(E.layer().shape.tfill && E.layer().shape.tfill.on) }, ["Layer", "shape.textfill"]);
      E.ui.stageCtxItems = (E.ui.stageCtxItems || []).concat(["shape.textfill"]);
    }
    void doc; void ctxOf;
  }
  Object.assign(api, { fillShape, install });
  root.PCTextFill = api;
})(typeof window !== "undefined" ? window : globalThis);
