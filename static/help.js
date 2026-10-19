/* bitGen Studio — ❔ HELP (2.380.0). Tim: "keep the ui clean... too much explanation - all explanations should go in a
 * help file not in the main ui". A dock's ❔ opens static/help/<topic>.html in a dialog with a titlebar (✕, Esc).
 *   window.H3Help.open(topic[, anchor])     anchor = an id inside the help page to scroll to
 *   window.H3Help.button(topic, title)      a ready ❔ button (icon only) for a dock's menu bar */
(function () {
  "use strict";
  var dlg = null;
  var CSS = ""
    + "dialog.hpdlg{width:min(760px,94vw);height:min(80vh,820px);padding:0;overflow:hidden;display:flex;flex-direction:column}"
    + "dialog.hpdlg:not([open]){display:none}"
    + ".hpdlg .hp-title{display:flex;align-items:center;gap:8px;height:36px;flex:none;padding:0 0 0 14px;user-select:none;"
    + "border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}"
    + ".hpdlg .hp-title h2{margin:0;flex:1;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase}"
    + ".hpdlg .hp-x{width:46px;height:36px;border:0;border-radius:0 10px 0 0;background:none;color:var(--text,#e8e2d6);font-size:15px;cursor:pointer}"
    + ".hpdlg .hp-x:hover{background:#c42b1c}"
    + ".hpdlg .hp-body{flex:1;overflow:auto;padding:6px 20px 18px;font-size:.82rem;line-height:1.55}"
    + ".hpdlg .hp-body h3{font-size:.86rem;margin:16px 0 4px;color:var(--tiger,#f59e2c)}"
    + ".hpdlg .hp-body kbd{font-family:var(--mono,monospace);font-size:.74rem;border:1px solid var(--line,#3a342a);border-radius:3px;padding:0 4px}"
    + ".hpdlg .hp-body ul{margin:4px 0;padding-left:20px}";
  function ensure() {
    if (dlg) return dlg;
    if (!document.getElementById("hpStyle")) { var st = document.createElement("style"); st.id = "hpStyle"; st.textContent = CSS; document.head.appendChild(st); }
    dlg = document.createElement("dialog");
    dlg.className = "hpdlg"; dlg.id = "hpDlg"; dlg.setAttribute("aria-label", "Help");
    dlg.innerHTML = '<div class="hp-title"><h2 id="hpTitle">Help</h2><button type="button" class="hp-x" id="hpClose" aria-label="Close" title="Close">✕</button></div>'
      + '<div class="hp-body" id="hpBody"></div>';
    document.body.appendChild(dlg);
    document.getElementById("hpClose").addEventListener("click", function () { dlg.close(); });
    return dlg;
  }
  function open(topic, anchor) {
    ensure();
    var t = String(topic || "timeline").replace(/[^a-z0-9_-]/gi, "");
    var body = document.getElementById("hpBody");
    body.textContent = "…";
    if (!dlg.open) dlg.showModal();
    fetch("/static/help/" + t + ".html").then(function (r) { if (!r.ok) throw new Error("no help for " + t); return r.text(); })
      .then(function (html) {
        body.innerHTML = html;
        var h = body.querySelector("h1, h2");
        document.getElementById("hpTitle").textContent = "❔ " + (h ? h.textContent : t);
        if (h) h.remove();
        if (anchor) { var a = body.querySelector("#" + anchor); if (a) a.scrollIntoView(); } else body.scrollTop = 0;
      }).catch(function (e) { body.textContent = String(e.message || e); });
  }
  function button(topic, title) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "ghost"; b.textContent = "❔";
    b.title = title || "Help"; b.setAttribute("aria-label", title || "Help");
    b.addEventListener("click", function () { open(topic); });
    return b;
  }
  window.H3Help = { open: open, button: button };
})();
