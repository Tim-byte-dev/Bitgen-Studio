/* bitGen Studio — static/pih3gen.js (3.5.0): THE PI-H3 VIDEO STYLES ASK FOR WHAT THEY NEED (window.H3PiH3).
 *
 * Tim (verbatim): "can u add https://hanshengchen.com/blog/pi-h3/ , when asking the user to download, let user choose which
 * model to dl". The "pi-H3 (2 steps)" / "pi-H3 (4 steps)" video styles render through /api/generate like every MiniMax H3
 * style (comfy_workflows/pi_h3_dwd_*.json, scripts/pih3.py). Before one renders, submitJob asks ensure(): the nodes, H3's
 * files and THIS style's adapter (2 or 4 steps, int8 or bf16) there = go on; else the Download / Cancel box
 * (H3NeedInstall "pih3", choose) lists every item of Settings ▸ Add-ons ▸ π pi-H3 to tick - this style's adapter ticked
 * first, the needed ones locked, the ones already here ✓ - and installs the ticked ones.
 *   style()        the picked video style when it is a pi-H3 one (else null)
 *   stepsOf(st)    2 | 4 (pure)
 *   readyFor(j, n) the status (GET /api/pih3) has what an n-step render needs (pure)
 *   ensure()       -> Promise<true = render, false = don't>
 *   paint()        the "ⓘ pi-H3" hint beside the video style select
 */
(function (root) {
  "use strict";
  function isPi(st) { return !!st && (/pi_h3_/i.test(String(st.workflow || "")) || /^pi-H3\b/i.test(String(st.name || ""))); }
  function stepsOf(st) { return /4step|4 steps/i.test(String((st && st.workflow) || "") + " " + String((st && st.name) || "")) ? 4 : 2; }
  function readyFor(j, n) { return !!(j && j.installed && j.have && j.have["dwd" + n]); }
  var pure = { isPi: isPi, stepsOf: stepsOf, readyFor: readyFor };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document;
  var $ = function (id) { return doc.getElementById(id); };
  function styles() { try { return typeof videoStyles !== "undefined" ? videoStyles : []; } catch (e) { return []; } }   // eslint-disable-line no-undef
  function style() {
    var sel = $("videoStyleSel"); if (!sel || !sel.value) return null;
    var st = styles().find(function (x) { return x.id === sel.value; });
    return isPi(st) ? st : null;
  }
  function ensure() {
    var st = style(); if (!st || !root.H3NeedInstall) return Promise.resolve(true);
    var n = stepsOf(st);
    return root.H3NeedInstall.ensure("pih3", st.name + " renders MiniMax H3 in " + n + " steps with pi-H3's " + n + "-step adapter in ComfyUI. Tick what to download:",
      { pick: ["dwd" + n], ready: function (j) { return readyFor(j, n); } }).then(function (ok) {
      if (ok === true) { try { if (typeof root.logLine === "function") root.logLine("[pi-H3] ready - restart ComfyUI once after installing so it loads the pi-H3 nodes"); } catch (e) { /* fine */ } }
      return ok;
    });
  }
  function paint() {
    var sel = $("videoStyleSel"); if (!sel || !sel.parentNode) return;
    var tip = $("pih3Tip");
    if (!tip) {
      tip = doc.createElement("span"); tip.id = "pih3Tip"; tip.className = "muted";
      tip.style.cssText = "margin-left:6px;font-size:11px;cursor:help";
      tip.textContent = "ⓘ pi-H3";
      tip.title = "pi-H3 renders MiniMax H3 in 2 or 4 steps (Hansheng Chen, Stanford / Luma AI) - your words, plus a First / Last frame picture if you add one, into video with sound; "
        + "the frames come straight from the model (no VAE decode). Up to 1344 x 768. Settings ▸ Add-ons ▸ π pi-H3 picks what to download. "
        + "MiniMax H3 Community License.";
      sel.parentNode.insertBefore(tip, sel.nextSibling);
      sel.addEventListener("change", paint);
    }
    tip.hidden = !style();
  }
  root.H3PiH3 = Object.assign({ style: style, ensure: ensure, paint: paint }, pure);
})(typeof window !== "undefined" ? window : globalThis);
