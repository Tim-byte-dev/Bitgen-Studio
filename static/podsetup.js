/* bitGen Studio — static/podsetup.js (2.761.0): WHAT A POD IS FOR, inside its My pods item (H3PodSetup; lib/podSetup.js).
 * Tim (verbatim): "make each pod name in my pods a accordian menuitem, add folder, checkpoint and add lora to each pod in my
 * pod upload those files to the checkpoint and lora folder in the runpod pod comfyui space , add checkboxes under the pod
 * name to tell if it is a video,llm,vllm,image,image-edit style. add a save button to the menu item that is disabled until
 * changes are made and disabled again after save unless new changes are made. this will save the style P_"
 *   ☐ Video ☐ LLM ☐ vLLM ☐ Image ☐ Image edit   under the pod's name (LLM / vLLM: the port and model of the pod's own
 *                                               OpenAI-compatible server - vLLM, Ollama …)
 *   📁 New folder   a folder inside the pod's checkpoints or loras (asked: "New folder on the pod")
 *   ➕ Checkpoint / ➕ LoRA   a file from this computer into models/checkpoints or models/loras (or a folder in them - "Into")
 *   💾 Save         off until something changed (a tick, a field, a file sent, a folder made); saves the ticks and makes the
 *                   pod's P_ styles; off again after
 * Pure (Node: scripts/test-podsetup761.js): KINDS, isDirty, clean.
 */
(function (root) {
  "use strict";
  var KINDS = [["video", "Video"], ["llm", "LLM"], ["vlm", "vLLM"], ["image", "Image"], ["image_edit", "Image edit"]];
  /** a setup as the page keeps it (pure) */
  function clean(s) {
    s = s || {}; var l = s.llm || {};
    return { kinds: KINDS.map(function (k) { return k[0]; }).filter(function (k) { return (s.kinds || []).indexOf(k) >= 0; }),
      llm: { port: +l.port || 8000, model: String(l.model || "").trim(), vlm_model: String(l.vlm_model || "").trim() } };
  }
  /** something to save (pure): the ticks / fields differ from the saved ones, or a file / folder went to the pod since */
  function isDirty(ed) { return !!ed && (!!ed.touched || JSON.stringify(clean(ed.cur)) !== JSON.stringify(clean(ed.saved))); }
  var pure = { KINDS: KINDS, clean: clean, isDirty: isDirty };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, ED = {};
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function ed(id) { return ED[id] = ED[id] || { saved: clean({}), cur: clean({}), loaded: false, msg: "", into: "checkpoints", folders: ["checkpoints", "loras"], nf: null }; }
  /** the setup from the server (not over edits being made) */
  function load(id, repaint) {
    return getj("/api/pods/" + encodeURIComponent(id) + "/setup").then(function (j) {
      if (!j || j.error) return;
      var e = ed(id); e.saved = clean(j);
      if (!isDirty(e) || !e.loaded) { e.cur = clean(j); e.touched = false; }
      e.loaded = true; e.revive = j.revive || null;
      if (repaint) repaint();
    }).catch(function () { /* offline */ });
  }
  /** the item's body (below the name): the ticks, the LLM server, the tools, 💾 Save */
  function html(p) {
    var e = ed(p.id), c = e.cur, run = /RUNNING/.test(p.status), llm = c.kinds.indexOf("llm") >= 0 || c.kinds.indexOf("vlm") >= 0;
    return '<div class="psKinds" role="group" aria-label="What this pod is for">'
      + KINDS.map(function (k) { return '<label class="chk"><input type="checkbox" data-pskind="' + k[0] + '"' + (c.kinds.indexOf(k[0]) >= 0 ? " checked" : "") + "> " + k[1] + "</label>"; }).join("")
      + "</div>"
      + (llm ? '<div class="psLlm"><span class="hint">The pod\'s LLM server (vLLM, Ollama …):</span> <label>port <input type="number" min="1" max="65535" data-psport value="' + c.llm.port + '" style="width:76px"></label>'
        + ' <label>model <input type="text" data-psmodel value="' + esc(c.llm.model) + '" placeholder="blank = the one it serves" spellcheck="false" style="width:170px"></label>'
        + (c.kinds.indexOf("vlm") >= 0 ? ' <label>vision model <input type="text" data-psvmodel value="' + esc(c.llm.vlm_model) + '" placeholder="blank = the same" spellcheck="false" style="width:150px"></label>' : "") + "</div>" : "")
      + '<div class="psTools">'
      + '<button type="button" class="ghost" data-psnf' + (run ? "" : " disabled") + ' title="A new folder inside the pod\'s checkpoints or loras">📁 New folder</button>'
      + '<button type="button" class="ghost" data-psadd="checkpoints"' + (run ? "" : " disabled") + ' title="A checkpoint from this computer into the pod\'s models/checkpoints">➕ Checkpoint</button>'
      + '<button type="button" class="ghost" data-psadd="loras"' + (run ? "" : " disabled") + ' title="A LoRA from this computer into the pod\'s models/loras">➕ LoRA</button>'
      + '<label class="psInto" title="The folder on the pod a checkpoint / LoRA goes in">into <select data-psinto>' + e.folders.map(function (f) { return '<option value="' + esc(f) + '"' + (f === e.into ? " selected" : "") + ">" + esc(f) + "</option>"; }).join("") + "</select></label>"
      + '<button type="button" data-pssave' + (isDirty(e) ? "" : " disabled") + ' title="Save what the pod is for - makes its P_ styles (image, image edit, video) and points the LLM / vLLM at it">💾 Save</button>'
      + "</div>"
      + (e.nf ? '<div class="psNf"><select data-psnfbase><option value="checkpoints">checkpoints</option><option value="loras"' + (e.nf.base === "loras" ? " selected" : "") + ">loras</option></select> / "
        + '<input type="text" data-psnfname placeholder="the new folder\'s name" spellcheck="false" value="' + esc(e.nf.name || "") + '" style="width:160px"> <button type="button" class="ghost" data-psnfgo>Make it</button> <button type="button" class="ghost" data-psnfx>✕</button></div>' : "")
      + '<div class="hint psMsg" aria-live="polite">' + esc(e.msg || (e.revive && e.revive.note ? "🔁 " + e.revive.note : "")) + "</div>";
  }
  function say(row, id, t) { ed(id).msg = t; var m = row.querySelector(".psMsg"); if (m) m.textContent = t; }
  function paintSave(row, id) { var b = row.querySelector("[data-pssave]"); if (b) b.disabled = !isDirty(ed(id)); }
  /** wire the body: p = the pod, port = its ComfyUI port, repaint = the docker's own */
  function wire(row, p, port, repaint) {
    var e = ed(p.id), q = function (s) { return row.querySelector(s); };
    if (!e.loaded) load(p.id, repaint);
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
    var into = q("[data-psinto]"); if (into) into.onchange = function () { e.into = into.value; };
    // the folders on the pod (for "into") - once per open, when it runs
    if (/RUNNING/.test(p.status) && !e.foldersAsked) {
      e.foldersAsked = true;
      getj("/api/pods/" + encodeURIComponent(p.id) + "/folders?port=" + (port || 0)).then(function (j) { if (j && j.folders && j.folders.length) { e.folders = j.folders; repaint(); } }).catch(function () { /* no Jupyter yet */ });
    }
    var nf = q("[data-psnf]"); if (nf) nf.onclick = function () { e.nf = e.nf ? null : { base: /^loras/.test(e.into) ? "loras" : "checkpoints", name: "" }; repaint(); };
    var nx = q("[data-psnfx]"); if (nx) nx.onclick = function () { e.nf = null; repaint(); };
    var nn = q("[data-psnfname]"); if (nn) { nn.oninput = function () { e.nf.name = nn.value; }; nn.onkeydown = function (ev) { ev.stopPropagation(); if (ev.key === "Enter") q("[data-psnfgo]").click(); }; }
    var nb = q("[data-psnfbase]"); if (nb) nb.onchange = function () { e.nf.base = nb.value; };
    var ng = q("[data-psnfgo]"); if (ng) ng.onclick = function () {
      var base = e.nf.base, name = String(e.nf.name || "").trim();
      say(row, p.id, "making " + base + "/" + name + " on the pod…");
      post("/api/pods/" + encodeURIComponent(p.id) + "/folder", { folder: base, name: name, port: port || 0 }).then(function (r) {
        if (r.error) { say(row, p.id, r.error); return; }
        if (e.folders.indexOf(r.folder) < 0) e.folders = e.folders.concat([r.folder]).sort();
        e.into = r.folder; e.nf = null; e.touched = true; e.msg = "✓ " + r.folder + " made on the pod - files you add go in it now"; repaint();
      });
    };
    row.querySelectorAll("[data-psadd]").forEach(function (b) {
      b.onclick = function () {
        var kind = b.dataset.psadd, folder = e.into.indexOf(kind) === 0 ? e.into : kind;
        if (!(root.FileDialog && FileDialog.open)) return;
        FileDialog.open({ mode: "file", title: kind === "loras" ? "A LoRA to send to the pod" : "A checkpoint to send to the pod", okLabel: "Send", key: "podsetup-" + kind,
          filters: [{ label: "Model files", exts: ["safetensors", "gguf", "ckpt", "pt", "pth", "bin", "sft"] }] }).then(function (sel) {
          if (!sel || !sel.path) return;
          post("/api/pods/" + encodeURIComponent(p.id) + "/upload", { path: sel.path, folder: folder, port: port || 0 }).then(function (r) {
            if (r.error) { say(row, p.id, r.error); return; }
            e.touched = true; paintSave(row, p.id);
            say(row, p.id, "sending " + r.name + " to models/" + folder + "…");
            watchUpload(row, p, port, r.name, folder);
          });
        });
      };
    });
    var sv = q("[data-pssave]"); if (sv) sv.onclick = function () {
      sv.disabled = true; say(row, p.id, "saving - reading the pod's models for its P_ styles…");
      post("/api/pods/" + encodeURIComponent(p.id) + "/setup", { kinds: e.cur.kinds, llm: e.cur.llm, pod_name: p.name, port: port || 0 }).then(function (r) {
        if (r.error) { say(row, p.id, r.error); paintSave(row, p.id); return; }
        e.saved = clean(r.setup); e.cur = clean(r.setup); e.touched = false;
        var bits = [];
        if (r.made && r.made.length) bits.push("made / updated " + r.made.join(", "));
        if (r.removed && r.removed.length) bits.push("removed " + r.removed.join(", "));
        if (r.llm) bits.push("the LLM runs on this pod");
        if (r.vlm) bits.push("the vision LLM runs on this pod");
        if (r.skipped && r.skipped.length) bits.push("not made: " + r.skipped.map(function (s) { return s.what + " (" + s.why + ")"; }).join("; "));
        e.msg = "✓ saved" + (bits.length ? " - " + bits.join(" · ") : "");
        repaint();
        try { if (typeof root.refreshStyles === "function") root.refreshStyles(); } catch (x) { /* the lists refresh on their own */ }
      });
    };
  }
  function watchUpload(row, p, port, name, folder) {
    var tick = function () {
      getj("/api/pods/" + encodeURIComponent(p.id) + "/models?port=" + (port || 0)).then(function (s) {
        var f = ((s && s.files) || []).filter(function (x) { return String(x.name).indexOf(name) === 0; }).pop();
        var cur = doc.querySelector('#pdPods .pdRow[data-pod="' + p.id + '"]') || row;
        if (!f) { setTimeout(tick, 3000); return; }
        if (f.state === "uploading") { say(cur, p.id, "sending " + name + " to models/" + folder + " - " + Math.round(100 * (f.done || 0) / (f.size || 1)) + "%"); setTimeout(tick, 3000); return; }
        say(cur, p.id, f.state === "done" ? "✓ " + name + " is in models/" + folder + " - 💾 Save makes its P_ style" : name + ": " + f.state);
      }).catch(function () { setTimeout(tick, 5000); });
    };
    setTimeout(tick, 1500);
  }
  root.H3PodSetup = Object.assign({ html: html, wire: wire, load: load, state: function (id) { return ed(id); } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
