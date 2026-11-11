/* bitGen Studio — static/podsetup.js (2.761.0 / 2.762.0): WHAT A POD IS FOR, inside its My pods item (H3PodSetup; lib/podSetup.js).
 * Tim (verbatim, 2.761.0): "make each pod name in my pods a accordian menuitem, add folder, checkpoint and add lora to each
 * pod in my pod upload those files to the checkpoint and lora folder in the runpod pod comfyui space , add checkboxes under
 * the pod name to tell if it is a video,llm,vllm,image,image-edit style. add a save button to the menu item that is
 * disabled until changes are made and disabled again after save unless new changes are made. this will save the style P_"
 * Tim (verbatim, 2.762.0): "in pods for lora and checkpoint and folder filters use the same dropdown types like overide
 * settings has. we only upload 1 checkpoint for each pod then this pod becomes the style ... the workflow for the style
 * like a krea style will use our krea workflow, if the model is already on the pod the just select it as the model to use.
 * this can simplify user experience"
 *   ☐ Video ☐ LLM ☐ vLLM ☐ Image ☐ Image edit   under the pod's name (LLM / vLLM: the port and model of the pod's own
 *                                               OpenAI-compatible server - vLLM, Ollama …)
 *   Checkpoint   ONE per pod - the same dropdowns as Basic Settings' Override style (a folder filter + the file, from this
 *                computer's ComfyUI models folders; index.html cmCombo). The pod becomes that style: 💾 Save makes
 *                P_<pod> (P_<pod> edit, P_<pod> video for the other ticks) with bitGen's workflow for the model's family
 *                (Krea -> bitGen's Krea workflow …). On the pod already = used by its name there; else sent once (in the
 *                same sub-folder), in the background, the line under it says how far.
 *   LoRAs        ＋ adds a row with the same dropdowns (loras); they go with the checkpoint and into the P_ style
 *   💾 Save      off until something changed (a tick, a field, a dropdown); saves; off again after
 * Pure (Node: scripts/test-podsetup761.js, test-podsend762.js): KINDS, isDirty, clean.
 */
(function (root) {
  "use strict";
  var KINDS = [["video", "Video"], ["llm", "LLM"], ["vlm", "vLLM"], ["image", "Image"], ["image_edit", "Image edit"]];
  /** a setup as the page keeps it (pure) */
  function clean(s) {
    s = s || {}; var l = s.llm || {};
    return { kinds: KINDS.map(function (k) { return k[0]; }).filter(function (k) { return (s.kinds || []).indexOf(k) >= 0; }),
      llm: { port: +l.port || 8000, model: String(l.model || "").trim(), vlm_model: String(l.vlm_model || "").trim() },
      checkpoint: String(s.checkpoint || "").trim(), loras: (s.loras || []).map(function (x) { return String(x || "").trim(); }).filter(Boolean) };
  }
  /** something to save (pure): the ticks / fields / dropdowns differ from the saved ones */
  function isDirty(ed) { return !!ed && (!!ed.touched || JSON.stringify(clean(ed.cur)) !== JSON.stringify(clean(ed.saved))); }
  var pure = { KINDS: KINDS, clean: clean, isDirty: isDirty };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, ED = {};
  var CKPT_CATS = ["checkpoints", "diffusion_models", "unet"];
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function ed(id) { return ED[id] = ED[id] || { saved: clean({}), cur: clean({}), loaded: false, msg: "" }; }
  /** the setup from the server (not over edits being made) */
  function load(id, repaint) {
    return getj("/api/pods/" + encodeURIComponent(id) + "/setup").then(function (j) {
      if (!j || j.error) return;
      var e = ed(id); e.saved = clean(j);
      if (!isDirty(e) || !e.loaded) { e.cur = clean(j); e.touched = false; }
      e.loaded = true; e.revive = j.revive || null; e.sending = j.sending || null;
      if (repaint) repaint();
    }).catch(function () { /* offline */ });
  }
  function sendLine(s) {
    if (!s) return "";
    if (s.running) return "⬆ sending " + s.current + (s.pct ? " - " + s.pct + "%" : "") + " to the pod (" + (s.done.length + 1) + " of " + s.items.length + ")";
    return (s.done.length ? "✓ on the pod: " + s.done.map(function (d) { return d.name; }).join(", ") : "") + (s.failed.length ? (s.done.length ? " · " : "") + "not sent: " + s.failed.map(function (f) { return f.name + " (" + f.why + ")"; }).join("; ") : "");
  }
  /** the item's body (below the name): the ticks, the LLM server, the checkpoint + LoRAs, 💾 Save */
  function html(p) {
    var e = ed(p.id), c = e.cur, llm = c.kinds.indexOf("llm") >= 0 || c.kinds.indexOf("vlm") >= 0;
    return '<div class="psKinds" role="group" aria-label="What this pod is for">'
      + KINDS.map(function (k) { return '<label class="chk"><input type="checkbox" data-pskind="' + k[0] + '"' + (c.kinds.indexOf(k[0]) >= 0 ? " checked" : "") + "> " + k[1] + "</label>"; }).join("")
      + "</div>"
      + (llm ? '<div class="psLlm"><span class="hint">The pod\'s LLM server (vLLM, Ollama …):</span> <label>port <input type="number" min="1" max="65535" data-psport value="' + c.llm.port + '" style="width:76px"></label>'
        + ' <label>model <input type="text" data-psmodel value="' + esc(c.llm.model) + '" placeholder="blank = the one it serves" spellcheck="false" style="width:170px"></label>'
        + (c.kinds.indexOf("vlm") >= 0 ? ' <label>vision model <input type="text" data-psvmodel value="' + esc(c.llm.vlm_model) + '" placeholder="blank = the same" spellcheck="false" style="width:150px"></label>' : "") + "</div>" : "")
      + '<div class="psModels"><label class="f" title="ONE checkpoint per pod - the pod becomes its style (P_ and the pod\'s name), with bitGen\'s workflow for its family. On the pod already = used; else sent once from this computer">Checkpoint <span class="hint">(one per pod - it becomes the pod\'s P_ style)</span></label>'
      + '<div class="psCk" data-psck></div>'
      + '<label class="f">LoRAs <button type="button" class="ghost" data-psloraadd title="Add a LoRA - sent with the checkpoint, in its P_ style" style="padding:0 8px">＋</button></label>'
      + '<div class="psLoras">' + c.loras.map(function (l, i) { return '<div class="psLora" data-pslora="' + i + '"><div class="psLoraBox"></div><button type="button" class="ghost" data-psloradel="' + i + '" title="Remove this LoRA">✕</button></div>'; }).join("") + "</div></div>"
      + '<div class="psTools"><span class="hint psSend">' + esc(sendLine(e.sending)) + '</span><button type="button" data-pssave' + (isDirty(e) ? "" : " disabled") + ' title="Save what the pod is for - its P_ style from the checkpoint (sent to the pod when it lacks it), the LLM / vLLM on it">💾 Save</button></div>'
      + '<div class="hint psMsg" aria-live="polite">' + esc(e.msg || (e.revive && e.revive.note ? "🔁 " + e.revive.note : "")) + "</div>";
  }
  function say(row, id, t) { ed(id).msg = t; var m = row.querySelector(".psMsg"); if (m) m.textContent = t; }
  function paintSave(row, id) { var b = row.querySelector("[data-pssave]"); if (b) b.disabled = !isDirty(ed(id)); }
  /** Basic Settings' Override style dropdowns (index.html cmCombo: a folder filter + the file + 📁) */
  function combo(host, cats, value, blank, onPick) {
    if (!host || typeof cmCombo !== "function") return;
    var inp = doc.createElement("input"); inp.type = "hidden"; inp.value = value || "";
    host.appendChild(inp);
    try { cmCombo(host, inp, cats, { blank: blank, title: "From this computer's ComfyUI models folders" }); } catch (x) { return; }
    host.appendChild(inp);
    var sel = host.querySelector(".cmfile");
    if (sel) sel.addEventListener("change", function () { onPick(inp.value.trim()); });
    inp.addEventListener("input", function () { onPick(inp.value.trim()); });
  }
  /** wire the body: p = the pod, port = its ComfyUI port, repaint = the docker's own */
  function wire(row, p, port, repaint) {
    var e = ed(p.id), q = function (s) { return row.querySelector(s); };
    if (!e.loaded) load(p.id, repaint);
    if (typeof cmData !== "undefined" && !cmData && typeof loadComfyModels === "function") loadComfyModels().then(function () { repaint(); });
    row.querySelectorAll("[data-pskind]").forEach(function (cb) {
      cb.onchange = function () {
        var k = cb.dataset.pskind, ks = e.cur.kinds.filter(function (x) { return x !== k; });
        if (cb.checked) ks.push(k);
        e.cur.kinds = clean({ kinds: ks }).kinds;
        if ((k === "llm" || k === "vlm")) repaint(); else paintSave(row, p.id);
      };
    });
    var pt = q("[data-psport]"), md = q("[data-psmodel]"), vm = q("[data-psvmodel]");
    if (pt) pt.oninput = function () { e.cur.llm.port = +pt.value || 8000; paintSave(row, p.id); };
    if (md) md.oninput = function () { e.cur.llm.model = md.value; paintSave(row, p.id); };
    if (vm) vm.oninput = function () { e.cur.llm.vlm_model = vm.value; paintSave(row, p.id); };
    var cats = (typeof cmData !== "undefined" && cmData && cmData.model_categories) || CKPT_CATS;
    combo(q("[data-psck]"), cats, e.cur.checkpoint, "— the pod's own models —", function (v) { e.cur.checkpoint = v; paintSave(row, p.id); });
    row.querySelectorAll("[data-pslora]").forEach(function (r) {
      var i = +r.dataset.pslora;
      combo(r.querySelector(".psLoraBox"), ["loras"], e.cur.loras[i] || "", "— pick a LoRA —", function (v) { e.cur.loras[i] = v; paintSave(row, p.id); });
    });
    var la = q("[data-psloraadd]"); if (la) la.onclick = function () { e.cur.loras = e.cur.loras.concat([""]); e.touched = true; repaint(); };
    row.querySelectorAll("[data-psloradel]").forEach(function (b) { b.onclick = function () { var i = +b.dataset.psloradel; e.cur.loras = e.cur.loras.filter(function (_, k) { return k !== i; }); e.touched = e.cur.loras.some(function (x) { return !x; }); repaint(); }; });
    var sv = q("[data-pssave]"); if (sv) sv.onclick = function () {
      sv.disabled = true; say(row, p.id, "saving…");
      post("/api/pods/" + encodeURIComponent(p.id) + "/setup", { kinds: e.cur.kinds, llm: e.cur.llm, checkpoint: e.cur.checkpoint, loras: e.cur.loras.filter(Boolean), pod_name: p.name, port: port || 0 }).then(function (r) {
        if (r.error) { say(row, p.id, r.error); paintSave(row, p.id); return; }
        e.saved = clean(r.setup); e.cur = clean(r.setup); e.touched = false;
        var bits = [];
        if (r.checkpoint_on_pod) bits.push("the pod's checkpoint: " + r.checkpoint_on_pod + (r.sending && r.sending.length ? " (being sent)" : " (on the pod)"));
        if (r.made && r.made.length) bits.push("made / updated " + r.made.join(", "));
        if (r.removed && r.removed.length) bits.push("removed " + r.removed.join(", "));
        if (r.llm) bits.push("the LLM runs on this pod");
        if (r.vlm) bits.push("the vision LLM runs on this pod");
        if (r.skipped && r.skipped.length) bits.push("not made: " + r.skipped.map(function (s) { return s.what + " (" + s.why + ")"; }).join("; "));
        e.msg = "✓ saved" + (bits.length ? " - " + bits.join(" · ") : "");
        repaint();
        try { if (typeof root.refreshStyles === "function") root.refreshStyles(); } catch (x) { /* the lists refresh on their own */ }
        if (r.sending && r.sending.length) watchSend(p.id, port, repaint);
      });
    };
    if (e.sending && e.sending.running && !e.watching) watchSend(p.id, port, repaint);
  }
  /** the background sending's line under the dropdowns, until it is done */
  function watchSend(id, port, repaint) {
    var e = ed(id); e.watching = true;
    var tick = function () {
      getj("/api/pods/" + encodeURIComponent(id) + "/setup").then(function (j) {
        e.sending = (j && j.sending) || null;
        var line = doc.querySelector('#pdPods .pdRow[data-pod="' + id + '"] .psSend');
        if (line) line.textContent = sendLine(e.sending);
        if (e.sending && e.sending.running) setTimeout(tick, 3000); else e.watching = false;
      }).catch(function () { setTimeout(tick, 5000); });
    };
    setTimeout(tick, 1500);
  }
  root.H3PodSetup = Object.assign({ html: html, wire: wire, load: load, state: function (id) { return ed(id); } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
