/* bitGen Studio — static/podfails.js (2.778.0): "A FILE DID NOT GET ONTO THE POD - TRY AGAIN?" (window.H3PodFails).
 * Tim (verbatim): "if a file fails to upload to the pod ask the user if they want to try again".
 *   Every few seconds the page asks GET /api/pods/fails (lib/podFails.js). A failure not asked yet opens one box per pod:
 *   each file with why (sent from this computer / the pod's download / found nowhere) and the styles that need it.
 *     ↻ Try again  POST /api/pods/fails/:id/retry - the pod's failed styles made ready again; when the files land, the render
 *                  waiting for the pod goes again by itself. The box says what happens; a failure again asks again.
 *     Not now     POST /api/pods/fails/:id/dismiss for each - not asked again until it fails again.
 *   No box while another dialog is open (it waits), none with remote generation off (nothing fails then).
 * Pure (Node: scripts/test-podfails778.js): pending(fails), groupOf(fails), howWords(how).
 */
(function (root) {
  "use strict";
  /** the failures to ask about (pure): not asked, not being retried */
  function pending(fails) { return (fails || []).filter(function (f) { return f && !f.asked && !f.retrying; }); }
  /** by pod, oldest pod first (pure) -> [{pod, files}] */
  function groupOf(fails) {
    var out = [], at = {};
    (fails || []).forEach(function (f) { if (!(f.pod in at)) { at[f.pod] = out.length; out.push({ pod: f.pod, files: [] }); } out[at[f.pod]].files.push(f); });
    return out;
  }
  var HOW = { upload: { label: "Sending it from this computer failed" }, download: { label: "The pod could not download it" }, missing: { label: "Not found anywhere" } };   // (label: - the UI translations read it)
  function howWords(how) { return (HOW[how] || HOW.missing).label; }
  var pure = { pending: pending, groupOf: groupOf, howWords: howWords };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, open = null, timer = 0;
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function post(u) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); }); }
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[pod] " + t); } catch (e) { /* no console */ } }
  function css() {
    if (doc.getElementById("pfcss")) return;
    var s = el("style"); s.id = "pfcss";
    s.textContent = "dialog.pfdlg{width:min(640px,94vw);max-height:80vh;padding:14px 16px;display:flex;flex-direction:column;gap:8px}"
      + "dialog.pfdlg:not([open]){display:none}"
      + ".pfdlg h2{margin:0;font-size:1rem}"
      + ".pfdlg .pflist{list-style:none;margin:0;padding:0;overflow:auto;max-height:46vh;border:1px solid var(--line);border-radius:6px}"
      + ".pfdlg .pflist li{padding:8px 10px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:3px}"
      + ".pfdlg .pflist li:first-child{border-top:0}"
      + ".pfdlg .pfname{font-family:var(--mono);font-size:.78rem;word-break:break-all;user-select:text}"
      + ".pfdlg .pfhow{font-size:.74rem;font-weight:600}"
      + ".pfdlg .pfwhy{font-size:.74rem;opacity:.85;user-select:text;word-break:break-word}"
      + ".pfdlg .pfnote{font-size:.76rem;margin:0}"
      + ".pfdlg .rowbtns{display:flex;gap:6px;justify-content:flex-end}";
    doc.head.appendChild(s);
  }
  function busyDialog() { return !!doc.querySelector("dialog[open]:not(.pfdlg)"); }
  function ask(group) {
    css();
    var d = el("dialog", "pfdlg"); d.id = "podFailDlg"; d.dataset.pod = group.pod;
    var styles = []; group.files.forEach(function (f) { (f.styles || []).forEach(function (s) { if (styles.indexOf(s) < 0) styles.push(s); }); });
    var h2 = el("h2"); h2.textContent = group.files.length === 1 ? "A file did not get onto the pod" : group.files.length + " files did not get onto the pod"; d.appendChild(h2);
    var top = el("p", "pfnote"); top.textContent = styles.length ? "Pod " + group.pod + " · needed by " + styles.join(", ") + ". Try again?" : "Pod " + group.pod + ". Try again?"; d.appendChild(top);
    var ul = el("ul", "pflist");
    group.files.forEach(function (f) {
      var li = el("li"); li.dataset.id = f.id;
      li.appendChild(el("span", "pfname", f.name));
      var hw = el("span", "pfhow"); hw.textContent = f.tries ? howWords(f.how) + " (tried again " + f.tries + "×)" : howWords(f.how); li.appendChild(hw);
      if (f.why) li.appendChild(el("span", "pfwhy", f.why));
      ul.appendChild(li);
    });
    d.appendChild(ul);
    var note = el("p", "pfnote"); note.textContent = group.files.some(function (f) { return f.how === "missing"; }) ? "A file found nowhere: put it in this computer's ComfyUI models folder (or add its link in 🧩 Model manager) before you try again." : "";
    d.appendChild(note);
    var row = el("div", "rowbtns"), go = el("button"), no = el("button", "ghost");
    go.textContent = "↻ Try again"; no.textContent = "Not now";
    go.type = no.type = "button"; go.id = "pfRetry"; no.id = "pfNotNow";
    row.appendChild(no); row.appendChild(go); d.appendChild(row);
    var close = function () { try { d.close(); } catch (e) { /* fine */ } d.remove(); open = null; };
    go.onclick = function () {
      go.disabled = no.disabled = true; note.textContent = "Trying again…";
      post("/api/pods/fails/" + encodeURIComponent(group.files[0].id) + "/retry").then(function (r) {
        log("trying again to put " + (r.files || []).join(", ") + " on the pod " + r.pod + " - the render waiting for it goes again when they are there");
        close();
      }).catch(function (e) { note.textContent = "Could not try again: " + e.message; go.disabled = no.disabled = false; });
    };
    no.onclick = function () { group.files.forEach(function (f) { post("/api/pods/fails/" + encodeURIComponent(f.id) + "/dismiss").catch(function () { /* fine */ }); }); close(); };
    d.addEventListener("cancel", function (e) { e.preventDefault(); no.onclick(); });
    doc.body.appendChild(d);
    open = d;
    d.showModal();
    go.focus();
  }
  function tick() {
    if (open || doc.hidden || busyDialog()) return;
    root.fetch("/api/pods/fails").then(function (r) { return r.json(); }).then(function (j) {
      if (open || busyDialog()) return;
      var g = groupOf(pending(j.fails));
      if (g.length) ask(g[0]);
    }).catch(function () { /* the next tick */ });
  }
  function start() { if (!timer) timer = setInterval(tick, +(root.H3_PODFAILS_MS || 4000)); tick(); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
  root.H3PodFails = Object.assign({ tick: tick }, pure);
})(typeof window !== "undefined" ? window : globalThis);
