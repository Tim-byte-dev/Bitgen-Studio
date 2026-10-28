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
        setNewFx(id || "");                              // 2.607.0: the next new text gets it too
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
  /* 2.607.0 - Tim (verbatim): "add text presets to timeline and other text tools as well". The T tool's NEW text starts
     with the preset last picked (here, or in Properties ▸ Preset of any text); with nothing selected, Properties shows
     "New text ▸ Preset" to pick it before clicking the canvas. Kept in the browser (localStorage h3.tl.newTextFx). */
  var NEW_KEY = "h3.tl.newTextFx";
  function newFx() { try { var v = localStorage.getItem(NEW_KEY) || ""; return v && (!window.H3TextFx || !H3TextFx.list().length || H3TextFx.byId(v)) ? v : ""; } catch (e) { return ""; } }
  function setNewFx(id) { try { if (id) localStorage.setItem(NEW_KEY, id); else localStorage.removeItem(NEW_KEY); } catch (e) { /* private window */ } }
  function newTextRow(P) {
    if (!P || !window.H3TextFx || $("tlpNewFx")) return;
    var d = document.createElement("div"); d.id = "tlpNewFx"; d.style.cssText = "margin-top:8px";
    d.innerHTML = '<div class="tlp-t">New text (T tool)</div><div class="tlp-row" id="tlpNewFxRow"><span style="font-size:.72rem" title="The text effect preset a new text starts with (the T tool)">Preset</span></div>';
    d.querySelector("#tlpNewFxRow").appendChild(H3TextFx.picker({ current: newFx(), say: say, onPick: function (id) { setNewFx(id || ""); say(id ? "new text will use the preset " + ((H3TextFx.byId(id) || {}).name || id) : "new text: no preset"); } }));
    P.appendChild(d);
  }
  function boot() { if (!ready()) { setTimeout(boot, 120); return; } TlCanvas.onProps(hook); H3TextFx.load(); try { TlCanvas.paintProps(); } catch (e) { /* fine */ } }
  window.TlTextFx = { hook: hook, newFx: newFx, setNewFx: setNewFx, newTextRow: newTextRow };
  boot();
})();
