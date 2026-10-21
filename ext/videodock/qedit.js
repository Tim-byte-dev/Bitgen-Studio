/* bitGen Studio — ✎ FIRST FRAME (QWEN IMAGE 2.1) on the scene cards (2.337.0).
 *
 * Tim: "can we use qwen2.1 to put the character in the location with the
 * props as first frame? make the image edit a dropdown accordian, second
 * scene can have same options as we already have, plus an option to edit the
 * image with qwen2.1 in the first image selector in each scene, this way we
 * can continue from the position but may change the location".
 *
 * One <details> accordion per card, under the First / Last frame slots
 * (characters.js scCard calls ScQedit.block(r), scPaint calls ScQedit.bind).
 * Start from (auto / 📍 location / ↪ the frame it continues from / 🖼 its
 * First picture), the cast to put in, a 📍 location, up to three 🧸 props, a
 * line of direction and the edit style (Qwen Image 2.1 edit by default). ✎
 * Make first frame queues an image job (routes/sceneedit.js); the finished
 * picture lands in the scene's First slot. The open / closed state and the
 * cast list live here, so the board's 4-second repaint keeps them.
 * 2.563.0 (Tim: "maybe we can use a reference image as the start frame but keep location the same - we use the llm to
 * say, scene starts with "ref image we choose(picture a)", style, composition and pose is exactly the same as (picture
 * a), and we add reference image for our new location, if location remains unchanged use the global prompts location"):
 * 🅰 Picture A (any scene's pictures, a frame of any take, a project picture, a file) + Start from "🅰 Picture A";
 * 🤖 Write = the LLM writes the instruction with the pictures' tags (editable); ✎ with Picture A and no direction
 * writes it first. The model is the edit style picked in the accordion. */
(function () {
  "use strict";
  var open = {};                      // scene n -> true while the accordion is open
  var info = null, infoAt = 0;        // /api/sceneedit/engines (cast + edit styles)

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function jpost(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); });
  }
  function loadInfo(force) {
    if (!force && info && Date.now() - infoAt < 30000) return Promise.resolve(info);
    return fetch("/api/sceneedit/engines").then(function (r) { return r.json(); })
      .then(function (j) { info = j && !j.error ? j : { edit: [], cast: [], default: "" }; infoAt = Date.now(); return info; })
      .catch(function () { return info || { edit: [], cast: [], default: "" }; });
  }

  var BASES = [["auto", "Auto"], ["picture", "🅰 Picture A (its style, composition, poses)"], ["location", "📍 the location picture"], ["continue", "↪ the frame it continues from"], ["first", "🖼 its First picture"]];

  function thumb(n, x, slot) {
    var word = slot === "pica" ? "Picture A" : slot;
    return '<span style="position:relative;display:inline-block;flex:none">'
      + '<img src="/api/scenes/' + n + "/qedit/pic/" + encodeURIComponent(x.file) + '" alt="' + esc(x.label || x.file) + '" '
      + 'title="' + esc(x.label || x.file) + '" style="height:36px;border-radius:3px;display:block">'
      + '<button class="ghost" type="button" data-qedel="' + n + '" data-slot="' + slot + '" data-file="' + esc(x.file) + '" '
      + 'title="Remove this ' + word + ' picture" aria-label="Remove the ' + word + ' picture ' + esc(x.label || x.file) + '" '
      + 'style="position:absolute;top:-5px;right:-5px;width:16px;height:16px;padding:0;font-size:.6rem;line-height:1;border-radius:50%">✕</button></span>';
  }

  /** The accordion's HTML for scene row r. */
  function block(r) {
    var n = r.n, q = r.qedit || {}, chosen = q.chars || [];
    var cast = (info && info.cast) || [], edit = (info && info.edit) || [];
    // 2.574.0: + its step while the edit renders (the board's answer carries qedit.progress - lib/jobSteps)
    var st = q.status === "running" ? "⏳ making" + (q.progress && q.progress.total ? " · step " + q.progress.step + " of " + q.progress.total : "…") : q.status === "done" ? "✔ in the First slot" : q.status === "failed" ? "⚠ failed" : "";
    return '<details class="scqe" data-qe="' + n + '"' + (open[n] ? " open" : "") + ' style="border:1px solid #2c3140;border-radius:4px;padding:2px 6px;margin-top:3px">'
      + '<summary style="cursor:pointer;font-size:.72rem" title="Make this scene\'s FIRST frame with the edit style picked below: Picture A kept as it is in a new place, the character(s) in a location with props, or the frame it continues from moved to a new location">'
      + "✎ First frame" + (st ? ' <span class="hint" data-qestat="' + n + '">' + st + "</span>" : "") + "</summary>"
      + '<div style="display:flex;flex-direction:column;gap:4px;padding:4px 0">'
      + '<label class="hint" style="font-size:.68rem">Start from <select data-qebase="' + n + '" aria-label="What scene ' + n + '\'s first frame starts from">'
      + BASES.map(function (b) { return '<option value="' + b[0] + '"' + ((q.base || "auto") === b[0] ? " selected" : "") + ">" + b[1] + "</option>"; }).join("")
      + "</select></label>"
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center" data-qecast="' + n + '"><span class="hint" style="font-size:.68rem">Characters</span>'
      + (cast.length ? cast.map(function (c) {
          return '<label style="display:inline-flex;gap:3px;align-items:center;font-size:.68rem" title="Put ' + esc(c.name) + ' (their sheet) in the frame">'
            + '<input type="checkbox" data-qechar="' + n + '" value="' + esc(c.name) + '"' + (chosen.indexOf(c.name) >= 0 ? " checked" : "") + ' style="margin:0">'
            + '<img src="' + esc(c.url) + '" alt="" style="height:24px;border-radius:2px">' + esc(c.name) + "</label>";
        }).join("") : '<span class="hint" style="font-size:.66rem">no cast sheets yet (none ticked = the @tags in the prompt)</span>')
      + "</div>"
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
      + '<span class="hint" style="font-size:.68rem" title="The picture this scene starts from: its style, composition, camera framing and poses are kept exactly">🅰 Picture A</span>'
      + (q.pica ? thumb(n, q.pica, "pica") : "")
      + '<button class="ghost gbtn" type="button" data-qepick="' + n + '" data-slot="qe_pica" style="font-size:.66rem" '
      + 'title="Picture A: a picture of any scene (its references, First / Last frames), a frame of any take, a project picture or a file" aria-label="Choose scene ' + n + '\'s Picture A">'
      + (q.pica ? "change" : "choose…") + "</button>"
      + '<span class="hint" style="font-size:.66rem">' + (q.pica && !q.location ? "the place: 📍 below, else the location the scene / the global prompt names" : "") + "</span>"
      + "</div>"
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
      + '<span class="hint" style="font-size:.68rem">📍 Location</span>'
      + (q.location ? thumb(n, q.location, "location") : "")
      + '<button class="ghost gbtn" type="button" data-qepick="' + n + '" data-slot="qe_location" style="font-size:.66rem" '
      + 'title="The place: a location picture, a frame of any scene, a project picture or a file" aria-label="Choose scene ' + n + '\'s location picture">'
      + (q.location ? "change" : "choose…") + "</button>"
      + '<span class="hint" style="font-size:.68rem;margin-left:6px">🧸 Props</span>'
      + (q.props || []).map(function (p) { return thumb(n, p, "prop"); }).join("")
      + ((q.props || []).length < 3 ? '<button class="ghost gbtn" type="button" data-qepick="' + n + '" data-slot="qe_prop" style="font-size:.66rem" '
        + 'title="Add a prop picture (up to 3)" aria-label="Add a prop picture to scene ' + n + '">＋</button>' : "")
      + "</div>"
      + '<textarea data-qeprompt="' + n + '" rows="2" spellcheck="false" style="font-size:.72rem" aria-label="Direction for scene ' + n + '\'s first frame" '
      + 'placeholder="Direction (optional) - e.g. she sits at the cafe table holding the red umbrella, evening light. Empty = the scene\'s own prompt">'
      + esc(q.prompt || "") + "</textarea>"
      + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
      + '<select data-qestyle="' + n + '" aria-label="Edit style for scene ' + n + '" style="font-size:.68rem">'
      + (edit.length ? edit.map(function (e) { var sel = (q.style_id || info.default) === e.id; return '<option value="' + esc(e.id) + '"' + (sel ? " selected" : "") + ">" + esc(e.name) + "</option>"; }).join("")
          : '<option value="">(no edit style - Qwen Image 2.1 edit is seeded on restart)</option>')
      + "</select>"
      + '<button class="ghost gbtn" type="button" data-qewrite="' + n + '" style="font-size:.68rem" '
      + 'title="The LLM writes the instruction from the pictures (Picture A, the location, the cast, the props), the global prompt and this scene - edit it after" aria-label="Write scene ' + n + '\'s first-frame instruction with the LLM">🤖 Write</button>'
      + '<button class="gbtn" type="button" data-qerun="' + n + '"' + (q.status === "running" ? " disabled" : "")
      + ' title="Make the first frame now - it lands in the First slot (a Ref scene becomes First)">✎ Make first frame</button>'
      + (q.status === "failed" && q.error ? '<span class="hint" style="color:#e88;font-size:.66rem">' + esc(q.error) + "</span>" : "")
      + "</div></div></details>";
  }

  /** Wire every accordion under root. ctx = {refresh, picker(n, slot), note(text)} */
  function bind(root, ctx) {
    if (!root) return;
    if (!info) loadInfo().then(function () { if (Object.keys(open).length) ctx.refresh(); });
    var all = function (sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); };
    all("details.scqe", function (d) {
      d.addEventListener("click", function (ev) { ev.stopPropagation(); });     // never select / repaint the card
      d.addEventListener("toggle", function () {
        var n = +d.dataset.qe;
        if (d.open) { open[n] = true; loadInfo().then(function (i) { if (i && (i.cast || []).length && !d.querySelector("[data-qechar]")) ctx.refresh(); }); }
        else delete open[n];
      });
    });
    var save = function (n, body) { return jpost("/api/scenes/" + n + "/qedit", body).then(function (j) { if (j.error) ctx.note("⚠ " + j.error); return j; }); };
    all("[data-qebase]", function (s) { s.addEventListener("change", function () { save(s.dataset.qebase, { base: s.value }); }); });
    all("[data-qestyle]", function (s) { s.addEventListener("change", function () { save(s.dataset.qestyle, { style_id: s.value }); }); });
    all("[data-qeprompt]", function (t) {
      t.addEventListener("change", function () { save(t.dataset.qeprompt, { prompt: t.value }); });
      t.addEventListener("blur", function () { setTimeout(ctx.refresh, 50); });
    });
    all("[data-qechar]", function (c) {
      c.addEventListener("change", function () {
        var n = c.dataset.qechar;
        var names = Array.prototype.map.call(root.querySelectorAll('[data-qechar="' + n + '"]:checked'), function (x) { return x.value; });
        save(n, { chars: names.slice(0, 3) });
      });
    });
    all("[data-qepick]", function (b) { b.addEventListener("click", function () { ctx.picker(+b.dataset.qepick, b.dataset.slot); }); });
    all("[data-qedel]", function (b) {
      b.addEventListener("click", function () {
        jpost("/api/scenes/" + b.dataset.qedel + "/qedit/pic/delete", { slot: b.dataset.slot, file: b.dataset.file })
          .then(function (j) { if (j.error) ctx.note("⚠ " + j.error); ctx.refresh(); });
      });
    });
    // 2.563.0: 🤖 Write - the LLM's instruction lands in the direction box (and is saved)
    var write = function (n, notes) {
      var d = root.querySelector('details[data-qe="' + n + '"]'), base = d && d.querySelector("[data-qebase]");
      var names = Array.prototype.map.call(root.querySelectorAll('[data-qechar="' + n + '"]:checked'), function (x) { return x.value; });
      ctx.note("🤖 scene " + n + ": the LLM is writing the first frame's instruction…");
      return jpost("/api/scenes/" + n + "/qedit/write", { base: base ? base.value : undefined, chars: names, notes: notes })
        .then(function (j) {
          if (j.error) { ctx.note("⚠ " + j.error); return null; }
          var t = d && d.querySelector("[data-qeprompt]"); if (t) t.value = j.prompt || "";
          ctx.note(j.note || "🤖 written");
          return j;
        }, function (e) { ctx.note("⚠ " + (e && e.message || e)); return null; });
    };
    all("[data-qewrite]", function (b) {
      b.addEventListener("click", function () {
        var n = b.dataset.qewrite, d = root.querySelector('details[data-qe="' + n + '"]'), t = d && d.querySelector("[data-qeprompt]");
        var notes = t && t.value && t.value.indexOf("<image1>") < 0 ? t.value : "";       // a typed direction = the LLM's notes
        b.disabled = true;
        write(n, notes).then(function () { b.disabled = false; });
      });
    });
    all("[data-qerun]", function (b) {
      b.addEventListener("click", function () {
        var n = b.dataset.qerun, d = root.querySelector('details[data-qe="' + n + '"]');
        var t = d && d.querySelector("[data-qeprompt]"), base = d && d.querySelector("[data-qebase]"), sty = d && d.querySelector("[data-qestyle]");
        var names = Array.prototype.map.call(root.querySelectorAll('[data-qechar="' + n + '"]:checked'), function (x) { return x.value; });
        b.disabled = true;
        // 2.563.0: Picture A and no direction - the LLM writes it first (no LLM = the built-in wording)
        var hasA = !!(d && d.querySelector('[data-qedel][data-slot="pica"]'));
        var pre = (t && !t.value.trim() && base && (base.value === "picture" || (base.value === "auto" && hasA))) ? write(n, "") : Promise.resolve(null);
        pre.then(function () {
        ctx.note("✎ scene " + n + ": making the first frame…");
        return jpost("/api/scenes/" + n + "/qedit/run", { prompt: t ? t.value : undefined, base: base ? base.value : undefined,
                                                    chars: names, style_id: sty ? sty.value : undefined })
          .then(function (j) {
            if (j.error) { b.disabled = false; ctx.note("⚠ " + j.error); return; }
            ctx.note(j.note || "✎ queued");
            ctx.refresh();
          }, function (e) { b.disabled = false; ctx.note("⚠ " + (e && e.message || e)); });
        });
      });
    });
  }

  /** Is the user typing in an accordion's direction box? (the repaint waits) */
  function editing() {
    var a = document.activeElement;
    return !!a && !!(a.matches && a.matches("[data-qeprompt]"));
  }
  /** Any ✎ job still running on the board? (keeps the 4-second poll going) */
  function busy(list) { return (list || []).some(function (r) { return r && r.qedit && r.qedit.status === "running"; }); }

  window.ScQedit = { block: block, bind: bind, editing: editing, busy: busy, loadInfo: loadInfo, _open: open };
})();
