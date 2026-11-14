/* bitGen Studio — static/poderr.js (2.779.0): "THE POD COULD NOT BE CREATED" - THE REAL ERROR IN A DIALOG (window.H3PodErr).
 * Tim (verbatim): "when creating a pod, it asks me to create a template first...can you report the real error in a dialog so the
 * user can see that there is a problem. i suspect it is because the gpu i selected was busy".
 *   When RunPod (or bitGen's own check) refuses a new pod, the answer carries `problem` (lib/podCreateErr.js): a title (e.g.
 *   "The GPU you picked is busy"), RunPod's own words, its HTTP status, what was asked for (template, GPU, cloud, host, disks)
 *   and what to do. This shows it in a dialog - from 🖥 PODS ▸ Create pod, 📦 Presets ▸ ▶ and the "no pod yet" box - with
 *   📋 Copy (the whole text, for a bug report) and OK.
 *   show(r)  r = an answer with {error, problem}; returns true when a dialog opened (no problem = false: the caller says r.error)
 * Pure (Node: scripts/test-podcreate779.js): textOf(problem).
 */
(function (root) {
  "use strict";
  /** the dialog's words as plain text (pure) - also what 📋 Copy copies */
  function textOf(p, err) {
    var o = p || {}, rows = (o.asked || []).map(function (r) { return "  " + r[0] + ": " + r[1]; });
    return [o.title || "The pod could not be created", "", o.hint || "", "",
      "RunPod said" + (o.status ? " (HTTP " + o.status + ")" : "") + ": " + (o.said || err || "nothing"),
      rows.length ? "\nAsked for:\n" + rows.join("\n") : ""].join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  var pure = { textOf: textOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document;
  function el(tag, cls) { var e = doc.createElement(tag); if (cls) e.className = cls; return e; }
  function css() {
    if (doc.getElementById("pecss")) return;
    var s = el("style"); s.id = "pecss";
    s.textContent = "dialog.pedlg{width:min(560px,94vw);padding:14px 16px;display:flex;flex-direction:column;gap:8px;border-color:var(--bad,#e66)}"
      + "dialog.pedlg:not([open]){display:none}"
      + ".pedlg h2{margin:0;font-size:1rem;color:var(--bad,#e66)}"
      + ".pedlg .pehint{margin:0;font-size:.8rem;line-height:1.4}"
      + ".pedlg .pesaid{margin:0;font-family:var(--mono);font-size:.74rem;white-space:pre-wrap;word-break:break-word;user-select:text;padding:8px;border:1px solid var(--line);border-radius:6px;max-height:30vh;overflow:auto}"
      + ".pedlg .pek{opacity:.7}"
      + ".pedlg .peasked{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:.74rem;margin:0}"
      + ".pedlg .rowbtns{display:flex;gap:6px;justify-content:flex-end}";
    doc.head.appendChild(s);
  }
  function show(r) {
    var p = r && r.problem; if (!p) return false;
    css();
    var old = doc.getElementById("podErrDlg"); if (old) { try { old.close(); } catch (e) { /* fine */ } old.remove(); }
    var d = el("dialog", "pedlg"); d.id = "podErrDlg"; d.dataset.kind = p.kind || "";
    var h = el("h2"); h.textContent = p.title || "The pod could not be created"; d.appendChild(h);
    var hint = el("p", "pehint"); hint.textContent = p.hint || ""; d.appendChild(hint);
    var lab = el("span", "pek"); lab.textContent = p.status ? "RunPod said (HTTP " + p.status + "):" : "RunPod said:"; d.appendChild(lab);
    var said = el("pre", "pesaid"); said.textContent = p.said || r.error || "nothing"; d.appendChild(said);
    if ((p.asked || []).length) {
      var al = el("span", "pek"); al.textContent = "Asked for:"; d.appendChild(al);
      var g = el("div", "peasked");
      p.asked.forEach(function (row) { var k = el("span", "pek"), v = el("span"); k.textContent = row[0]; v.textContent = row[1]; g.appendChild(k); g.appendChild(v); });
      d.appendChild(g);
    }
    var row = el("div", "rowbtns"), cp = el("button", "ghost"), ok = el("button");
    cp.type = ok.type = "button"; cp.id = "peCopy"; ok.id = "peOk"; cp.textContent = "📋 Copy"; ok.textContent = "OK";
    cp.onclick = function () { var t = textOf(p, r.error); try { root.navigator.clipboard.writeText(t).then(function () { cp.textContent = "✓ Copied"; }, function () { cp.textContent = "Copy failed"; }); } catch (e) { cp.textContent = "Copy failed"; } };
    ok.onclick = function () { try { d.close(); } catch (e) { /* fine */ } d.remove(); };
    d.addEventListener("cancel", function () { d.remove(); });
    row.appendChild(cp); row.appendChild(ok); d.appendChild(row);
    doc.body.appendChild(d); d.showModal(); ok.focus();
    return true;
  }
  root.H3PodErr = Object.assign({ show: show }, pure);
})(typeof window !== "undefined" ? window : globalThis);
