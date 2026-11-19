/* pcpropsauto.js — PROPERTIES COME UP FOR A DRAWING OR TEXT (2.875.0), window.PCPropsAuto.
 * Tim (verbatim): "when user selects any drawing or text element show properties docker"
 * E.setActive is wrapped: when the picked layer becomes a drawing (a shape, a vector line, a sketch) or a text (type, a WP
 * frame), the Properties docker is shown and opened at its tab - a hidden / floating tab docker is brought back
 * (E.tabdock.reveal), else the tab is opened in its panel group (E.ui.showTab). Only when the pick CHANGES to such a layer,
 * so re-picking it does not keep pulling the tab forward.
 * Pure (Node: scripts/test-875.js): isDrawing(layer) */
(function (root) {
  "use strict";
  const KINDS = ["shape", "text", "sketch", "doc"];
  /** a drawing or a text layer? */
  function isDrawing(L) { return !!L && (KINDS.includes(L.type) || !!L.shape || !!L.text || !!L.sketch); }
  const pure = { isDrawing, KINDS };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }
  function install(E) {
    const S = E.S || E.state;
    if (!E.setActive || !E.ui || E.setActive._propsAuto) return;
    const base = E.setActive;
    let lastId = null;
    const show = () => {
      try { if (E.tabdock && E.tabdock.reveal && E.tabdock.reveal("pcProps")) return; } catch (e) { /* the plain way */ }
      if (E.ui.showTab) E.ui.showTab("pcProps");
    };
    const wrapped = function (i, mask) {
      const r = base.apply(this, arguments);
      try {
        const L = S && S.layers ? S.layers[S.active] : null;
        const id = L ? L.id : null;
        if (id !== lastId) { lastId = id; if (!mask && isDrawing(L)) show(); }
      } catch (e) { /* picking never breaks */ }
      return r;
    };
    wrapped._propsAuto = true;
    E.setActive = wrapped;
    E.propsAuto = { show, isDrawing };
  }
  const PCPropsAuto = Object.assign({ install }, pure);
  if (root && root.document) root.PCPropsAuto = PCPropsAuto;
})(typeof window !== "undefined" ? window : globalThis);
