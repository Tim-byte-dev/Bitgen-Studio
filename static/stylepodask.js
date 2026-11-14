/* bitGen Studio — static/stylepodask.js (2.763.0): "NO POD RENDERS THIS STYLE YET" - asked once (window.H3StylePodAsk).
 * Tim (verbatim): "if we are in pod mode and a style is selected, check if that style has a pod assigned to it and create
 * the pod with the comfy cuda 13 template" + (agreed) ask before a pod is created, because it costs money: the GPU, its $/h
 * and the disk, with Create and Use my running pod.
 *   A render in pod mode whose style has no pod (its own, the pod for its kind, the pod in use) waits in the queue with
 *   job.pod_ask = the question's id (lib/stylePods.js gate). refreshJobs hands the jobs here (watchJobs); the box opens once
 *   per question:
 *     Create a pod   RunPod's "ComfyUI CUDA 13" template; Cloud (Secure / Community), the GPU (bitGen's pick = the cheapest
 *                    offered with the GPU memory the style's model wants; each with its memory and $/h in your currency),
 *                    the disk (the style's files + room)
 *     Use a pod      one of your pods (running or stopped - a stopped one is started)
 *     Cancel         the render is cancelled (2.763.1 - nothing is rendered somewhere else instead)
 *   Either way the style is linked to that pod (My pods ▸ Styles shows it) - next time it goes there by itself.
 * Pure (Node: scripts/test-stylepods763.js): gpuLabel, pending.
 */
(function (root) {
  "use strict";
  /** a GPU's line in the list (pure); money = (usd, suffix) -> text */
  function gpuLabel(g, pick, money) {
    var m = money || function (v, s) { return "$" + (+v || 0).toFixed(2) + (s || ""); };
    return (g.id === pick ? "⭐ " : "") + g.name + " · " + (g.memory || "?") + " GB · " + m(g.price, "/h") + (g.offered ? "" : " (none free now)");
  }
  /** the questions waiting in a job list that were not asked yet (pure) */
  function pending(list, asked) {
    var out = [];
    (list || []).forEach(function (j) { if (j && j.pod_ask && j.status === "queued" && !asked[j.pod_ask] && out.indexOf(j.pod_ask) < 0) out.push(j.pod_ask); });
    return out;
  }
  var pure = { gpuLabel: gpuLabel, pending: pending };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, asked = {}, open = null;
  function money(v, s) { return root.H3Money ? root.H3Money.usd(v, s) : "$" + (+v || 0).toFixed(2) + (s || ""); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function css() {
    if (doc.getElementById("spaCss")) return;
    var s = doc.createElement("style"); s.id = "spaCss";
    s.textContent = "dialog.spadlg{width:min(640px,94vw);max-height:88vh;padding:14px 16px;display:flex;flex-direction:column;gap:10px}"
      + "dialog.spadlg:not([open]){display:none}dialog.spadlg h3{margin:0}"
      + "dialog.spadlg fieldset{border:1px solid var(--line,#333);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;margin:0}"
      + "dialog.spadlg legend{padding:0 4px;color:var(--tiger,#f59e2c)}dialog.spadlg .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}"
      + "dialog.spadlg select{width:auto;max-width:100%}dialog.spadlg .spaGpu{flex:1;min-width:220px}dialog.spadlg .act{display:flex;gap:8px;justify-content:flex-end}"
      + "dialog.spadlg .spaMsg{min-height:1.2em}";
    doc.head.appendChild(s);
  }
  function show(id) {
    css();
    var d = doc.getElementById("spaDlg");
    if (!d) { d = doc.createElement("dialog"); d.id = "spaDlg"; d.className = "spadlg"; d.setAttribute("aria-labelledby", "spaTitle"); doc.body.appendChild(d); }
    open = id;
    d.innerHTML = '<h3 id="spaTitle">A pod for this style</h3><div class="hint">asking RunPod…</div>';
    if (!d.open) { try { d.showModal(); } catch (x) { d.setAttribute("open", ""); } }
    var cloud = "SECURE";
    var paint = function (o) {
      var a = o.ask || {}, gpus = o.gpus || [], pods = o.pods || [];
      d.innerHTML = '<h3 id="spaTitle">A pod for ' + esc(a.style_name) + "</h3>"
        + '<p class="hint" style="margin:0">No pod renders <b>' + esc(a.style_name) + "</b> yet. Create one, or use one of your pods - the style is linked to it, so next time it goes there by itself. Its files and node packs are put on the pod before it renders.</p>"
        + '<fieldset><legend>Create a pod</legend>'
        + (o.template ? '<div class="hint">A bitGen pod, made from RunPod\'s ' + esc(o.template.name) + (/pytorch/i.test(o.template.image || o.template.name || "") ? " - bitGen installs ComfyUI on it" : "") + "</div>" : '<div class="hint" style="color:var(--bad,#e66)">' + esc(o.template_error || "no template") + "</div>")
        + '<div class="row"><label>Cloud <select id="spaCloud"><option value="SECURE"' + (cloud === "SECURE" ? " selected" : "") + '>Secure</option><option value="COMMUNITY"' + (cloud === "COMMUNITY" ? " selected" : "") + ">Community (cheaper)</option></select></label>"
        + '<label>Disk <input type="number" id="spaVol" min="10" max="2000" value="' + (o.volume_gb || 50) + '" style="width:80px"> GB</label></div>'
        + '<div class="row"><label for="spaGpu">GPU</label><select id="spaGpu" class="spaGpu">'
        + gpus.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === o.pick ? " selected" : "") + (g.offered ? "" : " disabled") + ">" + esc(gpuLabel(g, o.pick, money)) + "</option>"; }).join("")
        + "</select></div>"
        + '<div class="hint">⭐ bitGen\'s pick: the cheapest GPU with at least ' + o.need_gb + " GB for this style" + (o.size_gb ? " (its files: about " + o.size_gb + " GB)" : "") + '. <span id="spaCost"></span></div>'
        + '<div class="act"><button type="button" id="spaCreate"' + (o.template && gpus.some(function (g) { return g.offered; }) ? "" : " disabled") + ">Create pod</button></div></fieldset>"
        + (pods.length ? '<fieldset><legend>Use one of your pods</legend><div class="row"><select id="spaPod" class="spaGpu">'
          + pods.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + " · " + esc(p.gpu || "") + " · " + esc(String(p.status || "").toLowerCase()) + (p.cost_hr ? " · " + esc(money(p.cost_hr, "/h")) : "") + "</option>"; }).join("")
          + '</select><button type="button" id="spaUse">Use this pod</button></div><div class="hint">A stopped pod is started.</div></fieldset>' : "")
        + '<div class="hint spaMsg" id="spaMsg" aria-live="polite"></div>'
        + '<div class="act"><button type="button" class="ghost" id="spaCancel" title="Do not render it now - no pod is made or used">Cancel</button></div>';
      var q = function (s) { return d.querySelector(s); };
      var cost = function () { var g = gpus.filter(function (x) { return x.id === (q("#spaGpu") || {}).value; })[0]; var c = q("#spaCost"); if (c) c.textContent = g ? "About " + money(g.price, "/h") + " while it runs (stopped: only its disk)." : ""; };
      cost();
      if (q("#spaGpu")) q("#spaGpu").onchange = cost;
      q("#spaCloud").onchange = function () { cloud = q("#spaCloud").value; load(); };
      var busy = function (t) { d.querySelectorAll("button,select,input").forEach(function (b) { b.disabled = true; }); q("#spaMsg").textContent = t; };
      var done = function (r) {
        if (r && r.error) { q("#spaMsg").textContent = r.error; if (root.H3PodErr) H3PodErr.show(r); d.querySelectorAll("button,select,input").forEach(function (b) { b.disabled = false; }); return; }
        asked[id] = true; open = null; try { d.close(); } catch (x) { d.removeAttribute("open"); }
      };
      if (q("#spaCreate")) q("#spaCreate").onclick = function () { busy("creating the pod…"); post("/api/stylepods/ask/" + id, { action: "create", gpu: q("#spaGpu").value, cloud: cloud, volume: +q("#spaVol").value || 50 }).then(done, function (e) { done({ error: String(e) }); }); };
      if (q("#spaUse")) q("#spaUse").onclick = function () { busy("linking…"); post("/api/stylepods/ask/" + id, { action: "use", pod_id: q("#spaPod").value }).then(done, function (e) { done({ error: String(e) }); }); };
      q("#spaCancel").onclick = function () { post("/api/stylepods/ask/" + id, { action: "cancel" }).then(done, done); };
    };
    var load = function () {
      getj("/api/stylepods/ask/" + id + "?cloud=" + cloud).then(function (o) {
        if (o.error) { d.innerHTML = '<h3 id="spaTitle">A pod for this style</h3><p>' + esc(o.error) + '</p><div class="act"><button type="button" id="spaClose">Close</button></div>'; d.querySelector("#spaClose").onclick = function () { asked[id] = true; open = null; d.close(); }; return; }
        paint(o);
      });
    };
    d.oncancel = function (ev) { ev.preventDefault(); };   // Esc does not leave a render waiting - Cancel says what happens
    load();
  }
  /** 2.763.1 (Tim: "it says starting in queue but i don't know what it's doing"): what the waiting render's pod is doing -
   *  a line over the status bar while a render waits for its pod (job.pod_note: starting it, making it again, waiting for
   *  its ComfyUI, putting the style's files and node packs on it …) */
  function chip(list) {
    var j = (list || []).filter(function (x) { return x && x.status === "queued" && x.pod_note; })[0], c = doc.getElementById("spaChip");
    if (!j) { if (c) c.hidden = true; return; }
    if (!c) {
      c = doc.createElement("div"); c.id = "spaChip"; c.setAttribute("role", "status"); c.setAttribute("aria-live", "polite");
      c.style.cssText = "position:fixed;right:12px;bottom:40px;z-index:250;max-width:min(560px,90vw);padding:6px 12px;border-radius:8px;border:1px solid var(--tiger,#f59e2c);background:var(--panel,#1b1b1f);color:var(--text,#eee);font-size:12px;box-shadow:0 2px 10px rgba(0,0,0,.35)";
      doc.body.appendChild(c);
    }
    c.hidden = false;
    c.textContent = "🖥 " + j.pod_note;
    c.title = "The render waits for its RunPod pod - the job's log has every step ([pod] lines)";
  }
  /* 2.763.3 (Tim: "if a pod doesn't exist for a style popup the pods docker to create the pod when generate button is
     pressed"): the question opens the PODS docker (H3Pods.forRender: its create form filled in for the style); this box is
     only the fallback when that docker is not there */
  function viaDocker(id) {
    if (!(root.H3Pods && H3Pods.forRender)) return Promise.resolve(false);
    return getj("/api/stylepods/ask/" + id).then(function (o) { return !o.error && H3Pods.forRender(o); }).catch(function () { return false; });
  }
  function answered(id) { asked[id] = true; if (open === id) open = null; }
  function watchJobs(list) {
    chip(list);
    if (open) return;
    var p = pending(list, asked);
    if (!p.length) return;
    var id = p[0]; open = id;
    // 2.764.0 (Tim: "bring up a dialog with my pods and a + style button ... add a create pod button"): the box of your pods
    // and presets (static/podpick.js); its Create pod… opens the PODS docker's form. Without it: the docker, then this box.
    var pick = root.H3PodPick ? H3PodPick.show(id) : Promise.resolve(false);
    pick.then(function (ok) {
      if (ok) return;   // it calls answered() when you pick
      viaDocker(id).then(function (ok2) { if (ok2) { asked[id] = true; open = null; } else { open = null; show(id); } });
    });
  }
  root.H3StylePodAsk = Object.assign({ watchJobs: watchJobs, show: show, answered: answered }, pure);
})(typeof window !== "undefined" ? window : globalThis);
