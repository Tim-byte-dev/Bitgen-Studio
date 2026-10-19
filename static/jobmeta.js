/* bitGen Studio — a render's METADATA, shown (2.384.0), window.H3JobMeta.
 *
 * Tim (verbatim): "when the job is done add a slideout to the div to show metadata - seed,cfg,steps, model used,loras
 * used(make this a dialog and show these details in the preview images/video dialog in a right pane)".
 *
 *   html(meta)            the details as a list: seed (♻ Use = Basic Settings' seed), cfg, steps, sampler, model(s),
 *                         LoRAs (name · weight), style, size, mode, render time, the prompt
 *   open(meta, title)     the ⓘ dialog (a queue row's) - titlebar, ✕, Esc
 *   pane(box, name)       the preview dialog's right pane: GET /api/job-meta?name= -> html, or a quiet "no details"
 *   useSeed(seed)         Basic Settings' Seed box = seed (the next render reuses it)
 * The metadata itself comes from the server (lib/jobMeta: the graph as queued, the seed a -1 became).
 */
(function () {
  "use strict";
  var dlg = null, paneSeq = 0;
  var CSS = ""
    + "dialog.jmdlg{width:min(520px,94vw);padding:0;overflow:hidden}"
    + ".jmdlg .jm-title{display:flex;align-items:center;gap:8px;height:36px;padding:0 0 0 14px;user-select:none;"
    + "border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}"
    + ".jmdlg .jm-title h2{margin:0;flex:1;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".jmdlg .jm-x{width:46px;height:36px;border:0;border-radius:0 10px 0 0;background:none;color:var(--text,#e8e2d6);font-size:15px;cursor:pointer}"
    + ".jmdlg .jm-x:hover{background:#c42b1c}"
    + ".jmdlg .jm-body{padding:10px 16px 16px;max-height:70vh;overflow:auto}"
    + ".jmlist{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:.74rem;align-items:baseline}"
    + ".jmlist dt{color:var(--dim,#9a917f);margin:0}"
    + ".jmlist dd{margin:0;font-family:var(--mono,monospace);word-break:break-word}"
    + ".jmlist dd button{margin-left:6px;padding:0 6px;font-size:.68rem}"
    + ".jmlist .jmprompt{font-family:var(--body,sans-serif);white-space:pre-wrap;max-height:160px;overflow:auto;color:var(--text,#e8e2d6)}"
    + ".jmnone{color:var(--dim,#9a917f);font-size:.72rem}";
  function css() { if (!document.getElementById("jmCss")) { var st = document.createElement("style"); st.id = "jmCss"; st.textContent = CSS; document.head.appendChild(st); } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clock(sec) {
    sec = Math.round(sec || 0); var m = Math.floor(sec / 60), s = sec % 60;
    return m >= 60 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : m ? m + "m " + s + "s" : s + "s";
  }
  function useSeed(seed) {
    var box = document.getElementById("seed");
    if (!box || seed == null) return false;
    box.value = String(seed);
    try { box.dispatchEvent(new Event("change", { bubbles: true })); box.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { /* old */ }
    return true;
  }
  function html(m) {
    if (!m) return '<div class="jmnone">No render details for this file.</div>';
    var rows = [];
    var add = function (k, v) { if (v != null && v !== "" && !(Array.isArray(v) && !v.length)) rows.push("<dt>" + k + "</dt><dd>" + v + "</dd>"); };
    if (m.seed != null) add("Seed", esc(m.seed) + (/^\d{1,15}$/.test(String(m.seed))
      ? '<button class="ghost" type="button" data-jmseed="' + esc(m.seed) + '" title="Put this seed in Basic Settings - the next render reuses it">♻ Use</button>' : ""));
    if (m.seeds_used && m.seeds_used.length > 1) add("Seeds (batch)", esc(m.seeds_used.join(", ")));
    add("CFG", m.cfg != null ? esc(m.cfg) : null);
    add("Steps", m.steps != null ? esc(m.steps) : null);
    add("Sampler", m.sampler ? esc(m.sampler) : null);
    add(m.models && m.models.length > 1 ? "Models" : "Model", (m.models || []).map(esc).join("<br>"));
    add("LoRAs", (m.loras || []).map(function (l) { return esc(l.name) + (l.weight != null ? " · " + esc(l.weight) : ""); }).join("<br>"));
    add("Style", m.style ? esc(m.style) : null);
    add("Size", m.width && m.height ? esc(m.width + "×" + m.height) : null);
    add("Mode", m.mode ? esc(m.mode) : null);
    add("Render time", m.seconds != null ? esc(clock(m.seconds)) : null);
    if (m.finished) add("Finished", esc(new Date(m.finished * 1000).toLocaleString()));
    add("Prompt", m.prompt ? '<div class="jmprompt">' + esc(m.prompt) + "</div>" : null);
    return rows.length ? '<dl class="jmlist">' + rows.join("") + "</dl>" : '<div class="jmnone">No render details for this file.</div>';
  }
  function wireSeed(box) {
    box.querySelectorAll("[data-jmseed]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        if (useSeed(b.getAttribute("data-jmseed"))) { b.textContent = "✓ in Basic Settings"; b.disabled = true; }
      });
    });
  }
  function open(meta, title) {
    css();
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "jmdlg"; dlg.id = "jmDlg"; dlg.setAttribute("aria-label", "Render details");
      dlg.innerHTML = '<div class="jm-title"><h2 id="jmTitle">Render details</h2><button type="button" class="jm-x" id="jmClose" aria-label="Close" title="Close">✕</button></div>'
        + '<div class="jm-body" id="jmBody"></div>';
      document.body.appendChild(dlg);
      document.getElementById("jmClose").addEventListener("click", function () { dlg.close(); });
    }
    document.getElementById("jmTitle").textContent = title || "Render details";
    var body = document.getElementById("jmBody");
    body.innerHTML = html(meta);
    wireSeed(body);
    if (!dlg.open) dlg.showModal();
    return dlg;
  }
  function pane(box, name) {
    css();
    if (!box) return Promise.resolve(null);
    var my = ++paneSeq;
    box.innerHTML = '<div class="jmnone">…</div>';
    return fetch("/api/job-meta?name=" + encodeURIComponent(name || ""))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (my !== paneSeq) return null;                // the dialog moved on to another file
        box.innerHTML = '<div class="jm-h">Render details</div>' + html(j && j.meta);
        wireSeed(box);
        return j;
      })
      .catch(function () { if (my === paneSeq) box.innerHTML = html(null); return null; });
  }
  window.H3JobMeta = { html: html, open: open, pane: pane, useSeed: useSeed, clock: clock };
})();
