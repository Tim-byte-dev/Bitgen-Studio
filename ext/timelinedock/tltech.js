/* bitGen Studio 2.968.0 — the Timeline docker's TECHNICAL look (tltech.css) and ⚙ Timeline settings ▸ Look.
 *
 * Tim: "is it possible to make the timeline docker look technical like you did with the synth tab?"
 *
 * - #timelinedock gets the class tl-tech (the default); ⚙ Timeline settings ▸ Look ▸ Classic takes it off - saved in the
 *   settings file as ui.tl_look ("tech" | "classic"), the same for every browser.
 * - The layers' time grid: --tgrid on #tlinner = the px between two grid lines at the current zoom (1 s, 5 s or 15 s -
 *   the same steps as the ruler's labels), --tgrid2 a fifth of that for fainter lines (when 10 px or more apart), kept
 *   in step whenever the timeline is drawn again (a MutationObserver - the core page's renderTimeline is not touched).
 * window.TlLook = { look(), set(v), apply(), grid() } (tests)
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var dock = $("timelinedock");
  if (!dock) return;
  var LOOKS = ["tech", "classic"];
  var cur = null;                                     // what the settings say once they are known (null = not yet)

  function saved() {
    var u = (typeof cfg === "object" && cfg && cfg.ui) || null;
    if (!u) return null;
    return LOOKS.indexOf(u.tl_look) >= 0 ? u.tl_look : "tech";
  }
  function look() { return cur || saved() || "tech"; }
  function apply() { var on = look() !== "classic"; dock.classList.toggle("tl-tech", on); if (on) grid(); return on; }
  function set(v) { cur = LOOKS.indexOf(v) >= 0 ? v : "tech"; return apply(); }

  /** the grid step: the ruler's own (1 s at 96 px/s or more, 5 s at 24 or more, else 15 s), never closer than 12 px */
  function grid() {
    var inner = $("tlinner"); if (!inner) return 0;
    var pxs = typeof PXS === "number" && PXS > 0 ? PXS : 14;
    var step = pxs >= 96 ? 1 : pxs >= 24 ? 5 : 15;
    var px = Math.max(12, pxs * step), minor = px / 5 >= 10 ? px / 5 : px;   // the fainter lines: a fifth, if they are 10 px apart
    inner.style.setProperty("--tgrid", px + "px");
    inner.style.setProperty("--tgrid2", minor + "px");
    return px;
  }

  apply();
  // the settings file arrives a moment after the page: a saved Classic is put back as soon as it is known
  var tries = 0, wait = setInterval(function () {
    if (saved() !== null || ++tries > 120) { clearInterval(wait); if (cur === null) apply(); }
  }, 250);
  var inner = $("tlinner");
  if (inner && window.MutationObserver) new MutationObserver(function () { if (dock.classList.contains("tl-tech")) grid(); }).observe(inner, { childList: true });

  // ⚙ Timeline settings ▸ Look
  function addTab() {
    var TS = window.TimelineSettings;
    if (!TS || !TS.addTab) return false;
    TS.addTab({
      id: "look", label: "Look",
      html: function () {
        return '<fieldset><legend>Look</legend>'
          + '<label class="tls-row" style="grid-template-columns:auto 1fr"><input type="radio" name="tlsLook" id="tlsLookTech" value="tech" style="width:auto">'
          + '<span><b>Technical</b> - dark panels, glowing labels, LCD readouts and clips on a time grid, like the 🎹 Synth tab</span></label>'
          + '<label class="tls-row" style="grid-template-columns:auto 1fr"><input type="radio" name="tlsLook" id="tlsLookClassic" value="classic" style="width:auto">'
          + '<span><b>Classic</b> - the warm look of the rest of the app</span></label>'
          + '<p class="tls-hint">Only the colours, the light and the type change - every button stays where it is.</p></fieldset>';
      },
      open: function () { var t = look() !== "classic"; $("tlsLookTech").checked = t; $("tlsLookClassic").checked = !t; },
      read: function () { return { ui: { tl_look: $("tlsLookClassic").checked ? "classic" : "tech" } }; },
      saved: function (ui) { set(ui.tl_look); }
    });
    return true;
  }
  if (!addTab()) window.addEventListener("load", addTab);

  window.TlLook = { look: look, set: set, apply: apply, grid: grid };
})();
