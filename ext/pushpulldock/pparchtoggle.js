/* bitGen Studio — ext/pushpulldock/pparchtoggle.js (2.985.0): THE SKETCHER'S 🏛 ARCHITECTURE BUTTON (window.H3PPArch).
 * Tim (verbatim): "add and architecture button to the top toolbar, hide/show all the architecture tools when toggled".
 *
 *   🏛 Architecture (#ppArchBtn, the Sketcher's top bar, before 📐 Plan) - lit = shown. Off hides every architecture tool:
 *   the toolbox's BUILD and GROUND parts (ppdock.js marks them .pparch) and the bar's 📐 Plan + its storey, ⌂ Cut-away,
 *   🧱 Wall types, 📄 Plans. A building tool that is in use when they hide goes back to ➤ Select. Kept (h3.pparch.on).
 *   The building itself stays in the model and in view - only the tools hide.
 * Pure (tested): BAR (the bar buttons it hides). */
(function (root) {
  "use strict";
  const BAR = ["ppPlan", "ppPlanLvl", "ppCut", "ppWTBtn", "ppPlans"];
  const KEY = "h3.pparch.on";
  const doc = root.document;
  if (!doc) { if (typeof module !== "undefined") module.exports = { BAR, KEY }; return; }
  const $ = (id) => doc.getElementById(id);
  const isOn = () => { try { return root.localStorage.getItem(KEY) !== "0"; } catch (e) { return true; } };
  function css() {
    if ($("ppArchCss")) return;
    const s = doc.createElement("style"); s.id = "ppArchCss";
    s.textContent = "#pushpulldock.pp-noarch .pparch{display:none!important}#ppArchBtn.on{background:var(--tiger-deep,#a8601a);color:#fff}";
    doc.head.appendChild(s);
  }
  function mark() { BAR.forEach((id) => { const b = $(id); if (b) b.classList.add("pparch"); }); }
  function paint() {
    const d = $("pushpulldock"), b = $("ppArchBtn"), on = isOn(); if (!d) return;
    mark(); d.classList.toggle("pp-noarch", !on);
    if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); b.title = "🏛 Architecture - " + (on ? "click to hide" : "click to show") + " the building tools (Build, Ground, 📐 Plan, ⌂ Cut-away, 🧱 Wall types, 📄 Plans)"; }
  }
  function set(on) {
    try { root.localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* private */ }
    const P = root.H3PushPull, T = P && P.state && P.state.T;
    if (!on && T && T.name) { const b = $("ppT_" + T.name()); if (b && b.classList.contains("pparch")) T.use("select"); }   // a hidden tool is not left in use
    paint();
    try { if (P && P.state && P.state.V) setTimeout(() => P.state.V.size(), 30); } catch (e) { /* fine */ }
    return on;
  }
  function mount() {
    const bar = $("ppBar"); if (!bar) return false;
    css();
    if (!$("ppArchBtn")) {
      const b = doc.createElement("button"); b.type = "button"; b.className = "ghost gbtn"; b.id = "ppArchBtn"; b.textContent = "🏛 Architecture";
      b.onclick = () => set(!isOn());
      const at = $("ppPlan"); if (at && at.parentNode) at.parentNode.insertBefore(b, at); else bar.appendChild(b);
    }
    paint();
    return true;
  }
  // the bar is there at load; the toolbox and 🧱's button come when the Sketcher boots - marked again as they arrive
  const iv = setInterval(() => { if (mount() && $("ppT_select") && $("ppWTBtn")) clearInterval(iv); else paint(); }, 500);
  root.H3PPArch = { BAR, set, on: isOn, paint, mount };
})(typeof window !== "undefined" ? window : globalThis);
