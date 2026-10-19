/* bitGen Studio — ext/timelinedock/fxdlg.js (2.406.0): the timeline's small dialogs (🎚 Mix, 💬 Captions) - every
 * one with a TITLEBAR (Tim: "dialogs must have a titlebar"): drag it by the bar, ✕ / Esc close it, shown non-modal so
 * the timeline and the canvas stay usable underneath.
 *
 *   TlDlg.make({id, title, width}) -> {dlg, body, foot, open(), close(), isOpen()}
 *   TlDlg.button(id, icon, title, onclick)   an icon button on the timeline's toolbar, left of 🎤
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var CSS = ""
    + "dialog.tlfxdlg{padding:0;overflow:hidden;position:fixed;margin:0;z-index:10050;box-shadow:0 10px 40px rgba(0,0,0,.6);"
    + "background:var(--panel,#1c1915);color:var(--text,#e8e2d6);border:1px solid var(--line,#3a342a);border-radius:10px}"
    + ".tlfxdlg .fx-title{display:flex;align-items:center;gap:8px;height:36px;padding:0 0 0 14px;user-select:none;cursor:move;"
    + "border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}"
    + ".tlfxdlg .fx-title h2{margin:0;flex:1;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".tlfxdlg .fx-x{width:46px;height:36px;border:0;border-radius:0 10px 0 0;background:none;color:var(--text,#e8e2d6);font-size:15px;cursor:pointer}"
    + ".tlfxdlg .fx-x:hover{background:#c42b1c}"
    + ".tlfxdlg .fx-body{padding:10px 16px 12px;max-height:68vh;overflow:auto;font-size:.76rem}"
    + ".tlfxdlg .fx-foot{display:flex;gap:6px;align-items:center;justify-content:flex-end;padding:8px 16px 12px;border-top:1px solid var(--line,#3a342a)}"
    + ".tlfxdlg fieldset{border:1px solid var(--line,#3a342a);border-radius:6px;margin:0 0 8px;padding:4px 8px 6px}"
    + ".tlfxdlg legend{padding:0 4px;font-weight:600}"
    + ".tlfxdlg .fx-row{display:flex;gap:6px;align-items:center;padding:3px 0;flex-wrap:wrap}"
    + ".tlfxdlg .fx-dim{color:var(--dim,#9a917f);font-size:.68rem}"
    + ".tlfxdlg input[type=range]{flex:1;min-width:90px}";
  function css() { if (!$("tlFxDlgCss")) { var st = document.createElement("style"); st.id = "tlFxDlgCss"; st.textContent = CSS; document.head.appendChild(st); } }

  function make(o) {
    css();
    var dlg = document.createElement("dialog");
    dlg.className = "tlfxdlg"; dlg.id = o.id; dlg.setAttribute("aria-label", o.title);
    dlg.style.width = "min(" + (o.width || 520) + "px,94vw)";
    dlg.innerHTML = '<div class="fx-title"><h2></h2><button type="button" class="fx-x" aria-label="Close" title="Close">✕</button></div>'
      + '<div class="fx-body"></div><div class="fx-foot"></div>';
    dlg.querySelector("h2").textContent = o.title;
    document.body.appendChild(dlg);
    var bar = dlg.querySelector(".fx-title");
    var api = { dlg: dlg, body: dlg.querySelector(".fx-body"), foot: dlg.querySelector(".fx-foot"),
                isOpen: function () { return dlg.open; },
                close: function () { if (dlg.open) dlg.close(); if (o.onClose) o.onClose(); },
                open: function () {
                  if (!dlg.open) {
                    dlg.show();
                    var w = dlg.getBoundingClientRect().width || 520;
                    dlg.style.left = Math.max(0, (window.innerWidth - w) / 2) + "px";
                    dlg.style.top = Math.max(20, window.innerHeight * 0.1) + "px";
                  }
                } };
    dlg.querySelector(".fx-x").onclick = function () { api.close(); };
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); api.close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && dlg.open && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !dlg.contains(e.target))) { e.preventDefault(); api.close(); }
    });
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    bar.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      on = true; sx = e.clientX; sy = e.clientY;
      var r = dlg.getBoundingClientRect(); ox = r.left; oy = r.top;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", function (e) {
      if (!on) return;
      dlg.style.left = Math.max(0, Math.min(window.innerWidth - 120, ox + e.clientX - sx)) + "px";
      dlg.style.top = Math.max(0, Math.min(window.innerHeight - 36, oy + e.clientY - sy)) + "px";
    });
    bar.addEventListener("pointerup", function () { on = false; });
    return api;
  }

  function button(id, icon, title, onclick) {
    if ($(id)) return $(id);
    var b = document.createElement("button");
    b.className = "ghost"; b.id = id; b.type = "button"; b.textContent = icon; b.title = title;
    b.setAttribute("aria-label", title); b.setAttribute("aria-haspopup", "dialog");
    b.addEventListener("click", onclick);
    var ref = $("tlKaraokeGen");
    if (ref && ref.parentNode) ref.parentNode.insertBefore(b, ref);
    return b;
  }

  window.TlDlg = { make: make, button: button };
})();
