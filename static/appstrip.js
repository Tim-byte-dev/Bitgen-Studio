/* static/appstrip.js — THE APP STRIP ON THE MENU BAR (2.817.0), window.H3AppStrip.
 *
 * Tim (verbatim): "put the button for this on the top menu-strip as icon only, not in the statusbar, add a separator
 * before and after this group of buttons (editor,mail,spreadsheet,slides) then add (solidcraft and sketcher buttons)
 * these are more like mini apps so they can be separated from the statusbar docker" + "there aren't many users yet, so a
 * good time for the change. and lets go with your suggestions".
 *
 * The big apps leave the statusbar for #menubar, icon only:   | 🖼 Editor  (✉ Mail, ▦ Spreadsheet, 🎞 Slides when
 * they ship) |  📐 SolidCraft  📏 Sketcher. The buttons are MOVED, not copied - their ids stay (tIE, tX_<dock>), so
 * GONE_DOCKS, the lit state (paintDockButtons), workspaces, layouts, the palette and every shortcut work as before.
 * An extension's button (made by ensureDockButtons when its docker loads) is moved when it appears; SolidCraft's keeps
 * its .sc-absent rule (hidden while SolidCraft is not installed). A one-time tip says where they went.
 */
(function () {
  "use strict";
  // [button id, icon, name] in order; group 1 = the office-style apps, group 2 = the 3D apps
  const APPS = [["tIE", "🖼", "Image editor"], ["tX_maildock", "✉", "Mail"], ["tX_sheetdock", "▦", "Spreadsheet"], ["tX_slidesdock", "🎞", "Slides"], ["tX_dbdock", "🗄", "Database"], ["tX_webdock", "🌐", "Web editor"], ["tX_acctdock", "📒", "Accounts"]];
  const MINI = [["tX_solidcraftdock", "📐", "SolidCraft"], ["tX_pushpulldock", "📏", "Sketcher"]];
  let strip = null;
  function build() {
    const mb = document.getElementById("menubar"); if (!mb) return null;
    if (strip && strip.isConnected) return strip;
    strip = document.createElement("span"); strip.className = "appstrip"; strip.id = "appStrip";
    strip.innerHTML = '<span class="asep"></span><span class="asgrp" id="appGrp1"></span><span class="asep"></span><span class="asgrp" id="appGrp2"></span><span class="asep"></span>';
    const pb = mb.querySelector(".projbtns");
    if (pb && pb.nextSibling) mb.insertBefore(strip, pb.nextSibling); else mb.appendChild(strip);
    return strip;
  }
  /** a button into its place in the strip, icon only (its name in the tooltip) */
  function adopt(id, icon, name, grp) {
    const b = document.getElementById(id), g = strip && strip.querySelector("#" + grp);
    if (!b || !g) return false;
    if (b.parentElement !== g) {
      // keep the APPS order inside the group
      const order = (grp === "appGrp1" ? APPS : MINI).map((a) => a[0]), at = order.indexOf(id);
      const next = [...g.children].find((c) => order.indexOf(c.id) > at);
      g.insertBefore(b, next || null);
    }
    if (b.dataset.asIcon !== icon) {
      b.dataset.asIcon = icon; b.textContent = icon; b.classList.add("ghost", "asbtn");
      const keyHint = b.dataset.key ? ` (${b.dataset.key})` : "";
      b.title = name + keyHint; b.setAttribute("aria-label", name);
    }
    return true;
  }
  function sweep() {
    if (!build()) return;
    for (const [id, ic, n] of APPS) adopt(id, ic, n, "appGrp1");
    for (const [id, ic, n] of MINI) adopt(id, ic, n, "appGrp2");
    // nothing in a group = no separator for it
    const g2 = strip.querySelector("#appGrp2"), seps = strip.querySelectorAll(".asep");
    const shown = (b) => b && getComputedStyle(b).display !== "none";
    if (seps[2]) seps[2].style.display = g2 && [...g2.children].some(shown) ? "" : "none";
    if (typeof window.paintDockButtons === "function") { try { window.paintDockButtons(); } catch (e) { /* early */ } }
  }
  function tipOnce() {
    try {
      if (localStorage.getItem("h3.appstrip.tip")) return;
      localStorage.setItem("h3.appstrip.tip", "1");
      // not a modal note - the status bar's log line says it for a while
      const msg = "The image editor, Sketcher and SolidCraft moved to the top bar - the icons after 🔍 (the Workspace and search).";
      const el = document.getElementById("sblog");
      if (el) { const was = el.textContent; el.textContent = "💡 " + msg; setTimeout(() => { if (el.textContent === "💡 " + msg) el.textContent = was; }, 15000); } else console.log(msg);
    } catch (e) { /* storage off */ }
  }
  function start() {
    sweep();
    // extension dockers make their buttons later - move them when they appear
    const sb = document.getElementById("statusbar");
    if (sb && window.MutationObserver) new MutationObserver(() => { if (MINI.concat(APPS).some(([id]) => { const b = document.getElementById(id); return b && b.parentElement === sb; })) sweep(); }).observe(sb, { childList: true });
    let n = 0; const t = setInterval(() => { sweep(); if (++n > 20) clearInterval(t); }, 500);
    setTimeout(tipOnce, 4000);
  }
  const css = document.createElement("style");
  css.textContent = "#menubar .appstrip{display:inline-flex;align-items:center;gap:2px;margin-left:4px}"
    + "#menubar .appstrip .asgrp{display:inline-flex;gap:2px}"
    + "#menubar .appstrip .asep{width:1px;height:18px;background:var(--line);margin:0 6px}"
    + "#menubar .appstrip button.asbtn{min-width:30px;font-size:1rem;line-height:1;padding:3px 6px;border:1px solid transparent;border-radius:5px}"
    + "#menubar .appstrip button.asbtn.on{color:var(--tiger);border-color:var(--tiger)}";
  document.head.appendChild(css);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.H3AppStrip = { sweep, APPS, MINI };
})();
