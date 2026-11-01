/* bitGen Studio — static/about.js (2.642.0): SETTINGS ▸ ABOUT - the version and the credits (window.H3About).
 * Tim (verbatim): "I would like the credits to say, Produced and Developed by Tim Paul , Programmer - Claude Opus5.5 in both the
 * user guide and an about tab in settings and the rest of the details and credits to everyone whose work we used for
 * inspiration or code".
 * The tab is added last in Settings; it reads GET /api/about (routes/about.js -> lib/credits.js -> lib/credits.json, the one
 * place the credits are written - the Guide's Credits section is made from the same file by scripts/make_credits.py).
 *   H3About.paint() -> Promise (fills #stab-about), H3About.open() (Settings on the About tab), H3About.html(data) (pure) */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CSS = "#stab-about .abhead{display:flex;align-items:baseline;gap:10px;margin:2px 0 6px}#stab-about .abhead b{font-size:22px;color:var(--tiger,#f59e2c)}" +
    "#stab-about .abver{opacity:.75}#stab-about .abcred{margin:10px 0 12px;padding:10px 12px;border:1px solid var(--line,#3a352d);border-radius:8px;background:var(--panel-2,#25211b)}" +
    "#stab-about .abcred div{font-size:15px;font-weight:600;margin:3px 0}#stab-about h4{margin:14px 0 4px;color:var(--tiger,#f59e2c);font-size:13px}" +
    "#stab-about ul{margin:0;padding-left:18px}#stab-about li{margin:2px 0;font-size:12px;line-height:1.45}#stab-about li .by{opacity:.75}" +
    "#stab-about li .what{opacity:.85}#stab-about a{color:inherit;text-decoration:underline;text-decoration-color:#ffffff55}#stab-about .ablic{margin-top:14px;font-size:11px;opacity:.75}";
  /** the tab's inside from /api/about's answer */
  function html(d) {
    d = d || {};
    let h = '<div class="abhead"><b>' + esc(d.name || "bitGen Studio") + '</b><span class="abver">Version ' + esc(d.version || "") + "</span></div>";
    if (d.about) h += '<p class="hint" style="margin:0">' + esc(d.about) + "</p>";
    h += '<div class="abcred" id="abCredits">' + (d.credits || []).map((c) => "<div>" + esc(c.role + (c.join == null ? " " : c.join) + c.name) + "</div>").join("") + "</div>";
    if (d.thanks) h += "<p>" + esc(d.thanks) + "</p>";
    (d.sections || []).forEach((s) => {
      h += "<h4>" + esc(s.title) + "</h4><ul>" + (s.items || []).map((i) => "<li><b>" + (i.url ? '<a href="' + esc(i.url) + '" target="_blank" rel="noopener">' + esc(i.name) + "</a>" : esc(i.name)) + "</b>" +
        (i.by ? ' <span class="by">(' + esc(i.by) + ")</span>" : "") + (i.what ? ' <span class="what">- ' + esc(i.what) + "</span>" : "") + "</li>").join("") + "</ul>";
    });
    if (d.licence) h += '<p class="ablic">' + esc(d.licence) + "</p>";
    return h;
  }
  let got = null;
  function paint() {
    const box = $("stab-about"); if (!box) return Promise.resolve(null);
    if (got) { box.innerHTML = html(got); return Promise.resolve(got); }
    box.innerHTML = '<p class="hint">Loading…</p>';
    return root.fetch("/api/about").then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error); got = d; box.innerHTML = html(d); return d; })
      .catch((e) => { box.innerHTML = '<p class="hint">The credits could not be read: ' + esc(e.message || e) + "</p>"; return null; });
  }
  function boot() {
    const dlg = $("settings"), tabs = dlg && dlg.querySelector(".stabs");
    if (!tabs || $("stab-about")) return !!tabs;
    const st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);
    const b = doc.createElement("button"); b.dataset.stab = "about"; b.textContent = "About"; b.type = "button"; b.title = "The version and the credits";
    tabs.appendChild(b);                                       // last: after every other tab (those added later go before it)
    const pane = doc.createElement("div"); pane.className = "stab"; pane.id = "stab-about";
    const all = dlg.querySelectorAll(".stab"); if (all.length) all[all.length - 1].after(pane); else tabs.after(pane);
    b.onclick = () => {
      dlg.querySelectorAll(".stabs button").forEach((x) => x.classList.toggle("active", x === b));
      doc.querySelectorAll(".stab").forEach((t) => t.classList.toggle("active", t.id === "stab-about"));
      paint();
    };
    // a tab added after this one (an extension's, Add-ons, Dockers ...) still goes before About
    new root.MutationObserver(() => { if (tabs.lastElementChild !== b) tabs.appendChild(b); }).observe(tabs, { childList: true });
    return true;
  }
  function open() {
    if (typeof root.openSettings === "function") root.openSettings(); else if ($("settings") && !$("settings").open) $("settings").showModal();
    const b = doc.querySelector('#settings .stabs [data-stab="about"]'); if (b) b.click();
  }
  root.H3About = { paint, open, html };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
