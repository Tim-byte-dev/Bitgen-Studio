/* bitGen Studio — static/promptfront.js (2.645.0): Ctrl+P BRINGS THE PROMPT DOCKER TO THE FRONT (window.H3PromptFront).
 * Tim (verbatim): "if user presses ctrl P bring the prompt docker to front".
 * Anywhere in the app, typing in a box too - 🎨 Artist mode too (2.646.0: its colour palette moved to Alt+P; the prompt docker
 * comes over the full-screen canvas) - not while a modal dialog is open. The browser's own Ctrl+P (print) never opens. The image editor's File ▸ Print moved to Ctrl+Shift+P.
 * front() makes the prompt docker seen, whatever hides it:
 *   closed (dockgone) -> opened;  folded (collapsed) -> unfolded;  in a ▣ docker / a floating window -> that window shown and
 *   raised;  under another floating window or a maximized docker (the Sketcher, SolidCraft, the timeline ...) -> lifted over
 *   it (a z-index on the prompt's own top window - until the cover goes / the next front());  scrolled out of its column ->
 *   scrolled in;  then the prompt box has the focus (the caret at its end) and the docker flashes once.
 *   H3PromptFront.front() -> {ok, steps: [...]} ,  .isKey(e) (pure) ,  .coveredBy() (what is over the prompt box, or null) */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  /** Ctrl+P / Cmd+P, no Shift / Alt */
  function isKey(e) {
    if (!e || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return false;
    return String(e.key || "").toLowerCase() === "p" || e.code === "KeyP";
  }
  const FRONT_Z = 9500;                                  // over a maximized docker (the Sketcher's 9000), under menus / dialogs
  const ARTIST_Z = 2147483300;                           // 2.646.0: over 🎨 Artist mode's canvas (2147483000), under its popups (…600)
  const zNow = () => (doc.body.classList.contains("ie-focus") ? ARTIST_Z : FRONT_Z);
  const box = () => $("prompt");
  /** the element over the middle of the prompt box (null = the box itself / inside the prompt docker is on top) */
  function coveredBy() {
    const b = box(), d = $("promptdock"); if (!b || !d) return null;
    const r = b.getBoundingClientRect(); if (!r.width || !r.height) return d;
    const pts = [[0.5, 0.5], [0.15, 0.3], [0.85, 0.7]];
    for (const [fx, fy] of pts) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x >= root.innerWidth || y >= root.innerHeight) return d;          // off screen
      const t = doc.elementFromPoint(x, y);
      if (!t || !d.contains(t)) return t || d;
    }
    return null;
  }
  /** the outermost positioned element holding the prompt docker that sits in the page's own stacking order */
  function topWindow() {
    let n = $("promptdock"), top = n;
    for (let p = n; p && p !== doc.body; p = p.parentElement) {
      const cs = root.getComputedStyle(p);
      if (cs.position === "fixed" || cs.position === "absolute") top = p;
    }
    return top;
  }
  let lifted = null;
  function lift(el) {
    if (lifted && lifted !== el) unlift();
    if (!el.dataset.pfZ) el.dataset.pfZ = el.style.zIndex || "";
    if (root.getComputedStyle(el).position === "static") { el.dataset.pfPos = el.style.position || ""; el.style.position = "relative"; }
    el.style.zIndex = String(zNow()); el.classList.add("pf-front"); lifted = el;
  }
  function unlift() {
    const el = lifted; lifted = null; if (!el) return;
    el.style.zIndex = el.dataset.pfZ || ""; delete el.dataset.pfZ;
    if (el.dataset.pfPos != null) { el.style.position = el.dataset.pfPos; delete el.dataset.pfPos; }
    el.classList.remove("pf-front");
  }
  // the lift ends when the prompt is no longer covered without it (the cover closed / restored) - checked now and then
  root.setInterval(() => {
    if (!lifted) return;
    const z = lifted.style.zIndex; lifted.style.zIndex = lifted.dataset.pfZ || "";
    const still = coveredBy(); lifted.style.zIndex = z;
    if (!still) unlift();
  }, 1500);
  function flash() {
    const d = $("promptdock"); if (!d || !d.animate) return;
    try { d.animate([{ boxShadow: "0 0 0 3px var(--tiger, #f59e2c)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 700 }); } catch (e) { /* no animation */ }
  }
  function front() {
    const d = $("promptdock"), steps = [];
    if (!d) return { ok: false, steps: ["no prompt docker"] };
    unlift();                                             // a lift from before is looked at again
    if (d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") { root.toggleDockGone("promptdock", "tP"); steps.push("opened"); }
    if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") { root.toggleCollapse("promptdock"); steps.push("unfolded"); }
    // in a ▣ docker (static/dockgroup.js + floatpanels.js - its member record pf.promptdock): that docker shown, its tab picked
    const P = root.H3Panels, G = root.H3DockGroup; let wait = null;
    const rec = P && P.list ? P.list().find((x) => x.id === "pf.promptdock") : null;
    if (rec && (rec.state === "in" || rec.state === "zone") && rec.docker) {
      if (G && G.shown && !G.shown(rec.docker) && G.toggle) { try { wait = G.toggle(true, rec.docker); steps.push("its ▣ docker shown"); } catch (e) { /* fine */ } }
      const tab = doc.querySelector('.h3fd-tab[data-t="pf.promptdock"]');
      if (tab && !tab.classList.contains("on")) { tab.click(); steps.push("its tab"); }
    }
    // inside a regular docker (a ▣ docker made permanent ...): closed -> opened, folded -> unfolded
    for (let n = d.parentElement; n && n !== doc.body; n = n.parentElement) {
      if (!n.classList || !n.classList.contains("bdock") || !n.id) continue;
      if (n.classList.contains("dockgone") && typeof root.toggleDockGone === "function") { root.toggleDockGone(n.id); steps.push(n.id + " opened"); }
      if (n.classList.contains("collapsed") && typeof root.toggleCollapse === "function") { root.toggleCollapse(n.id); steps.push(n.id + " unfolded"); }
    }
    // a floating window folded to its title bar (▁) / a hidden tab
    for (let n = d.parentElement; n && n !== doc.body; n = n.parentElement) {
      if (!n.classList) continue;
      ["sf-min", "minned"].forEach((c) => { if (n.classList.contains(c)) { n.classList.remove(c); steps.push("restored"); } });
    }
    const finish = () => {
      const b = box();
      if (b && b.scrollIntoView) { try { b.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { b.scrollIntoView(); } }
      if (b) { try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); } const n = (b.value || "").length; try { b.setSelectionRange(n, n); } catch (e) { /* fine */ } }
    };
    finish(); flash();
    // what is over it is looked at once the opening / unfolding has been laid out (a box just shown can read as covered)
    const look = () => { if (coveredBy()) { lift(topWindow()); if (!steps.includes("lifted")) steps.push("lifted"); } };
    if (root.requestAnimationFrame) root.requestAnimationFrame(() => root.setTimeout(look, 30)); else root.setTimeout(look, 50);
    // a ▣ docker opens a moment later (it loads its layout first): the focus / the lift once it is there
    if (wait && typeof wait.then === "function") wait.then(() => root.setTimeout(() => { finish(); look(); }, 60), () => {});
    return { ok: !coveredBy(), steps };
  }
  root.addEventListener("keydown", (e) => {
    if (!isKey(e) || e.repeat) return;
    const modal = doc.querySelector("dialog[open]"); if (modal && modal.matches(":modal")) { e.preventDefault(); return; }   // never the print dialog
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    front();
  }, true);
  root.H3PromptFront = { front, isKey, coveredBy, unlift, FRONT_Z, ARTIST_Z };
})(typeof window !== "undefined" ? window : globalThis);
