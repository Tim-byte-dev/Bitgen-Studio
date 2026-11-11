/* bitGen Studio — static/podsetup.js (2.761.0 / 2.763.0): WHAT A POD IS FOR, inside its My pods item (H3PodSetup; lib/podSetup.js).
 * Tim (verbatim, 2.761.0): "make each pod name in my pods a accordian menuitem ... add checkboxes under the pod name to tell
 * if it is a video,llm,vllm,image,image-edit style. add a save button to the menu item that is disabled until changes are
 * made and disabled again after save unless new changes are made"
 * Tim (verbatim, 2.763.0): "instead of the dropdown for the folder filter and lora, can we use a dropdown of our styles for
 * the mode selected, image selected show image styles, add an all button so that it shows all styles. then we send our
 * styles workflow to the pod with our styles stand models, text encoders and vaes, we reuse the same styles, no p_" +
 * "allow the user to have a separate pod for each type of style, llm, vllm,image,video if they want to and can afford too
 * otherwise we use the one pod"
 *   ☐ Video ☐ LLM ☐ vLLM ☐ Image ☐ Image edit   under the pod's name: this pod renders every style of that kind that has no
 *                                               pod of its own - one pod per kind (ticking it here takes it from another
 *                                               pod); LLM / vLLM = the port + model of the pod's own OpenAI-compatible server
 *   Styles   a dropdown of YOUR styles for the Generate mode picked (🖼 Image = image styles, 🎬 Video = video, 🎶 Music =
 *            music) - All lists every style - ＋ links the style to this pod (a chip, ✕ takes it off). Their workflow,
 *            standard model, text encoders, VAE, LoRAs and node packs go to the pod (lib/podPrep.js) - no P_ copies
 *   💾 Save  off until something changed; saves; off again after - and makes the styles ready on the pod when it is running
 * Pure (Node: scripts/test-stylepods763.js): KINDS, clean, isDirty, kindOfMode, listFor.
 */
(function (root) {
  "use strict";
  var KINDS = [["video", "Video"], ["llm", "LLM"], ["vlm", "vLLM"], ["image", "Image"], ["image_edit", "Image edit"]];
  /** a setup as the page keeps it (pure) */
  function clean(s) {
    s = s || {}; var l = s.llm || {};
    return { kinds: KINDS.map(function (k) { return k[0]; }).filter(function (k) { return (s.kinds || []).indexOf(k) >= 0; }),
      llm: { port: +l.port || 8000, model: String(l.model || "").trim(), vlm_model: String(l.vlm_model || "").trim() },
      styles: (s.styles || []).map(function (x) { return String(x || "").trim(); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }) };
  }
  /** something to save (pure): the ticks / fields / styles differ from the saved ones */
  function isDirty(ed) { return !!ed && (!!ed.touched || JSON.stringify(clean(ed.cur)) !== JSON.stringify(clean(ed.saved))); }
  /** the Generate mode (#genModeSel) -> the style kind its list shows (pure) */
  function kindOfMode(m) { return m === "video" ? "video" : m === "audio" ? "music" : "image"; }
  /** the dropdown's styles (pure): all = every kind, else the mode's; minus the ones linked already; by name */
  function listFor(styles, kind, all, linked) {
    return (styles || []).filter(function (s) { return s && s.id && (all || (s.kind || "image") === kind) && (linked || []).indexOf(s.id) < 0 && s.runs_on !== "remote" && s.runs_on !== "api"; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  }
  var pure = { KINDS: KINDS, clean: clean, isDirty: isDirty, kindOfMode: kindOfMode, listFor: listFor };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, ED = {}, STYLES = null, ALL = false, REPAINT = null;
  // the Generate mode changed: the open pod items list that mode's styles
  doc.addEventListener("change", function (ev) { if (ev.target && ev.target.id === "genModeSel" && REPAINT && !ALL) { try { REPAINT(); } catch (x) { /* the docker is gone */ } } });
  var ICON = { image: "🖼", video: "🎬", music: "🎶" };
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function ed(id) { return ED[id] = ED[id] || { saved: clean({}), cur: clean({}), loaded: false, msg: "" }; }
  function modeKind() { var g = doc.getElementById("genModeSel"); return kindOfMode(g ? g.value : "image"); }
  function styles(repaint) {
    if (STYLES) return STYLES;
    STYLES = [];
    getj("/api/styles").then(function (j) { STYLES = (j && j.styles) || []; if (repaint) repaint(); }).catch(function () { STYLES = null; });
    return STYLES;
  }
  function nameOf(id) { var s = (STYLES || []).filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function kindIcon(id) { var s = (STYLES || []).filter(function (x) { return x.id === id; })[0]; return s ? ICON[s.kind || "image"] || "" : ""; }
  /** the setup from the server (not over edits being made) */
  function load(id, repaint) {
    return getj("/api/pods/" + encodeURIComponent(id) + "/setup").then(function (j) {
      if (!j || j.error) return;
      var e = ed(id); e.saved = clean(j);
      if (!isDirty(e) || !e.loaded) { e.cur = clean(j); e.touched = false; }
      e.loaded = true; e.prep = j.prep || null; e.run = j.run || null; e.nodes = j.nodes || null; e.revive = j.revive || null;
      if (repaint) repaint();
    }).catch(function () { /* offline */ });
  }
  function prepLine(e) {
    var p = e.prep, n = e.nodes;
    if (n && n.running) return "⏳ " + n.note;   // 2.763.1: this computer's custom nodes going to the pod
    if (n && n.note && (!p || (n.at || 0) > (p.at || 0))) return (/failed|could not|paste/.test(n.note) ? "⚠ " : "✓ ") + n.note;
    if (p && p.running) return "⏳ " + p.note;
    if (p && p.problems && p.problems.length) return "⚠ " + p.problems.join(" · ");
    if (p && p.done && p.done.length) return "✓ ready on the pod: " + p.done.join(", ");
    if (e.run && e.run.note) return "🔁 " + e.run.note;
    return "";
  }
  /** the item's body (below the name): the ticks, the LLM server, the styles, 💾 Save */
  function html(p) {
    var e = ed(p.id), c = e.cur, llm = c.kinds.indexOf("llm") >= 0 || c.kinds.indexOf("vlm") >= 0;
    var mk = modeKind(), list = listFor(styles(null), mk, ALL, c.styles);
    return '<div class="psKinds" role="group" aria-label="What this pod is for" title="Ticked = this pod renders every style of that kind that has no pod of its own. One pod per kind - tick them all on one pod to use one pod for everything">'
      + KINDS.map(function (k) { return '<label class="chk"><input type="checkbox" data-pskind="' + k[0] + '"' + (c.kinds.indexOf(k[0]) >= 0 ? " checked" : "") + "> " + k[1] + "</label>"; }).join("")
      + "</div>"
      + (llm ? '<div class="psLlm"><span class="hint">The pod\'s LLM server (vLLM, Ollama …):</span> <label>port <input type="number" min="1" max="65535" data-psport value="' + c.llm.port + '" style="width:76px"></label>'
        + ' <label>model <input type="text" data-psmodel value="' + esc(c.llm.model) + '" placeholder="blank = the one it serves" spellcheck="false" style="width:170px"></label>'
        + (c.kinds.indexOf("vlm") >= 0 ? ' <label>vision model <input type="text" data-psvmodel value="' + esc(c.llm.vlm_model) + '" placeholder="blank = the same" spellcheck="false" style="width:150px"></label>' : "") + "</div>" : "")
      + '<div class="psStyles"><label class="f" title="Your styles that render on this pod - their workflow, models, text encoders, VAE, LoRAs and node packs go to the pod">Styles <span class="hint">(' + (ALL ? "all styles" : ICON[mk] + " " + mk + " styles - the Generate mode") + ")</span></label>"
      + '<div class="psPick"><select data-psstyle aria-label="A style for this pod"><option value="">— pick a style —</option>'
      + list.map(function (s) { return '<option value="' + esc(s.id) + '">' + (ALL ? (ICON[s.kind || "image"] || "") + " " : "") + esc(s.name) + "</option>"; }).join("")
      + '</select><button type="button" class="ghost" data-psadd title="Link the picked style to this pod" disabled>＋</button>'
      + '<button type="button" class="ghost' + (ALL ? " on" : "") + '" data-psall aria-pressed="' + (ALL ? "true" : "false") + '" title="List every style, not only the Generate mode\'s">All</button></div>'
      + '<div class="psChips">' + (c.styles.length ? c.styles.map(function (id) { return '<span class="psChip" data-pschip="' + esc(id) + '">' + kindIcon(id) + " " + esc(nameOf(id)) + ' <button type="button" class="ghost" data-psdel="' + esc(id) + '" title="Take this style off the pod">✕</button></span>'; }).join("")
        : '<span class="hint">no styles of its own yet</span>') + "</div></div>"
      + '<div class="psTools"><span class="hint psPrep" aria-live="polite">' + esc(prepLine(e)) + '</span><button type="button" class="ghost" data-psnodes title="Put this computer\'s ComfyUI custom nodes on the pod (the ones it lacks) - cloned from their own address at the same version, or uploaded - then its ComfyUI is restarted">⬆ My custom nodes</button><button type="button" data-pssave' + (isDirty(e) ? "" : " disabled") + ' title="Save what the pod is for - its styles are made ready on it (their files and node packs), the kinds it renders, the LLM / vLLM on it">💾 Save</button></div>'
      + '<div class="hint psMsg" aria-live="polite">' + esc(e.msg || "") + "</div>";
  }
  function say(row, id, t) { ed(id).msg = t; var m = row.querySelector(".psMsg"); if (m) m.textContent = t; }
  function paintSave(row, id) { var b = row.querySelector("[data-pssave]"); if (b) b.disabled = !isDirty(ed(id)); }
  /** wire the body: p = the pod, port = its ComfyUI port, repaint = the docker's own */
  function wire(row, p, port, repaint) {
    var e = ed(p.id), q = function (s) { return row.querySelector(s); };
    if (!e.loaded) load(p.id, repaint);
    styles(repaint);
    REPAINT = repaint;
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
    var sel = q("[data-psstyle]"), add = q("[data-psadd]"), all = q("[data-psall]");
    if (sel && add) sel.onchange = function () { add.disabled = !sel.value; };
    if (add) add.onclick = function () { if (!sel || !sel.value) return; e.cur.styles = clean({ styles: e.cur.styles.concat([sel.value]) }).styles; repaint(); };
    if (all) all.onclick = function () { ALL = !ALL; repaint(); };
    row.querySelectorAll("[data-psdel]").forEach(function (b) { b.onclick = function () { var id = b.dataset.psdel; e.cur.styles = e.cur.styles.filter(function (x) { return x !== id; }); repaint(); }; });
    var sv = q("[data-pssave]"); if (sv) sv.onclick = function () {
      sv.disabled = true; say(row, p.id, "saving…");
      post("/api/pods/" + encodeURIComponent(p.id) + "/setup", { kinds: e.cur.kinds, llm: e.cur.llm, styles: e.cur.styles, pod_name: p.name, port: port || 0 }).then(function (r) {
        if (r.error) { say(row, p.id, r.error); paintSave(row, p.id); return; }
        e.saved = clean(r.setup); e.cur = clean(r.setup); e.touched = false;
        var bits = [];
        if (r.setup.styles.length) bits.push(r.setup.styles.length + (r.setup.styles.length === 1 ? " style" : " styles") + " on this pod" + (r.preparing ? " - making them ready on it now" : " - made ready when the pod runs"));
        var kk = r.setup.kinds.filter(function (k) { return k !== "llm" && k !== "vlm"; });
        if (kk.length) bits.push("renders the " + kk.map(function (k) { return k.replace("_", " "); }).join(" / ") + " styles with no pod of their own");
        if (r.llm) bits.push("the LLM runs on this pod");
        if (r.vlm) bits.push("the vision LLM runs on this pod");
        e.msg = "✓ saved" + (bits.length ? " - " + bits.join(" · ") : "");
        repaint();
        if (r.preparing) watchPrep(p.id, repaint);
      });
    };
    var nb = q("[data-psnodes]"); if (nb) nb.onclick = function () {
      nb.disabled = true; say(row, p.id, "putting this computer's custom nodes on the pod…");
      post("/api/stylepods/nodes/" + encodeURIComponent(p.id), { port: port || 0 }).then(function (r) {
        nb.disabled = false;
        if (r.error) { say(row, p.id, r.error); return; }
        say(row, p.id, ""); watchPrep(p.id, repaint);
      });
    };
    if (((e.prep && e.prep.running) || (e.nodes && e.nodes.running)) && !e.watching) watchPrep(p.id, repaint);
  }
  /** the making-ready line, until it is done */
  function watchPrep(id, repaint) {
    var e = ed(id); e.watching = true;
    var tick = function () {
      getj("/api/pods/" + encodeURIComponent(id) + "/setup").then(function (j) {
        e.prep = (j && j.prep) || null; e.run = (j && j.run) || null; e.nodes = (j && j.nodes) || null;
        var line = doc.querySelector('#pdPods .pdRow[data-pod="' + id + '"] .psPrep');
        if (line) line.textContent = prepLine(e);
        if ((e.prep && e.prep.running) || (e.nodes && e.nodes.running)) setTimeout(tick, 3000); else e.watching = false;
      }).catch(function () { setTimeout(tick, 5000); });
    };
    setTimeout(tick, 1500);
  }
  // a style made / renamed / deleted elsewhere - read again when the list is next drawn
  function forget() { STYLES = null; }
  root.H3PodSetup = Object.assign({ html: html, wire: wire, load: load, forget: forget, state: function (id) { return ed(id); } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
