/* bitGen Studio — ext/timelinedock/textfx.js (2.411.0): the text layer's PRESETS ▾ in the timeline's Properties - text
 * effects made from PSD text effects (＋ Import a PSD text effect… adds your own), the classic looks (Gold, Chrome ...).
 * The look is drawn by static/textfx.js (H3TextFx), LIVE while typing: canvas.js's renderText asks it for the picture
 * (a quick one while the words change, the sharp one when typing pauses); ⚙ Compile gets the sharp one.
 * Tim: "are you able to add these styles to a presets dropdown in the text tool properties in timeline docker and image
 * editor?" ... "it would be nice if it was live". */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.saveTextPng && window.H3TextFx); } catch (e) { return false; } }
  function say(t) { try { if (TlCanvas.say) TlCanvas.say(t); } catch (e) { /* fine */ } if ($("sblog")) $("sblog").textContent = t; }
  function hook(P, c) {
    if (!c || !c.text || !P) return;
    const font = $("tlpFont"); if (!font) return;
    const row = document.createElement("div");
    row.className = "tlp-row"; row.id = "tlpFxRow";
    row.innerHTML = '<span style="font-size:.72rem" title="Text effect presets - from PSD text effects, live as you type">Preset</span>';
    row.appendChild(H3TextFx.picker({
      current: c.text.fx || "", say,
      onPick: function (id) {
        if (id) c.text.fx = id; else delete c.text.fx;
        TlCanvas.saveTextPng(c); TlCanvas.mark();
        if (typeof tlSave === "function") tlSave();
        note();
      },
    }));
    const n = document.createElement("div");
    n.className = "tlp-note"; n.id = "tlpFxNote"; n.style.cssText = "font-size:.66rem;color:var(--dim,#9a917f);margin:-2px 0 4px";
    const note = function () {
      const p = c.text.fx && H3TextFx.byId(c.text.fx);
      n.textContent = p ? "The preset draws its own colours, outline and shadow" + (p.font && p.font.family ? " (its PSD used the font " + p.font.family + ")" : "") + "." : "";
      ["tlpShadow", "tlpStroke", "tlpStrokeW"].forEach(function (id) { const el = $(id); if (el) el.disabled = !!p; });
    };
    const after = font.closest(".tlp-row");
    after.parentNode.insertBefore(row, after.nextSibling);
    row.parentNode.insertBefore(n, row.nextSibling);
    note();
  }
  function boot() { if (!ready()) { setTimeout(boot, 120); return; } TlCanvas.onProps(hook); H3TextFx.load(); }
  window.TlTextFx = { hook };
  boot();
})();
