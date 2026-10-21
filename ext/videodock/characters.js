/* bitGen Studio — the Video docker's character panel.
   Talks only to /api/characters/*; the disk layout and the reference chain are
   the server's business. Kept to plain DOM so it needs no build step. */
(function () {
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g,
    function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /** One card per character: who they are, and what the graph will get. */
  var chProfiles = {};   // name -> profile, for the click-to-edit prefill
  var chEditing = "";    // the character being edited, "" = creating
  /* 2.212.0 (by instruction: "allow user to drag images from gallery or
     reference images or asset images"): pictures DROPPED on the New/Edit
     dialog queue here and attach when Save / Add character is pressed —
     the same moment picked files upload, so a cancel abandons both alike.
     {file} = a name already in the project's Images assets (Assets drops,
     and gallery drops AFTER adoption); {blob} = raw bytes (the References
     tray and the desktop). */
  var chDropQueue = [];
  function chDropCount() {
    var note = el("chDropNote");
    if (!note) return;
    note.textContent = chDropQueue.length
      ? chDropQueue.length + " dropped picture(s) queued — they attach when "
        + "you press " + (chEditing ? "Save" : "Add character") + "."
      : "Drag pictures here from the Gallery, the References tray or "
        + "Assets → Image — they attach when you press Save.";
  }
  function chDropReset() { chDropQueue = []; chDropCount(); }
  /* 2.224.0 (by instruction): the CLOTHING tab. Server entries live on the
     profile ({file,type,color,notes}; files under dataset/clothing/); NEW
     entries queue here and attach when Save / Add character is pressed —
     the same moment picked files and drops do, so a cancel abandons all
     three alike. Existing entries delete immediately (they are server
     state, and the dialog repaints from the answer). */
  var chClothQueue = [];    // [{blob, name, type, color, notes}]
  var chClothServer = [];   // the open profile's entries
  function chClothPaint() {
    var box = el("chClothList");
    if (!box) return;
    box.innerHTML = "";
    chClothServer.forEach(function (e2) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:center";
      var im = document.createElement("img");
      im.src = "/api/characters/" + encodeURIComponent(chEditing || "")
        + "/clothing/" + encodeURIComponent(e2.file);
      im.alt = e2.type;
      im.style.cssText = "width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex:none";
      row.appendChild(im);
      var tx = document.createElement("div");
      tx.className = "hint"; tx.style.flex = "1";
      tx.textContent = e2.type + (e2.color ? " · " + e2.color : "")
        + (e2.notes ? " — " + e2.notes : "");
      row.appendChild(tx);
      var del = document.createElement("button");
      del.className = "ghost gbtn"; del.type = "button"; del.textContent = "✕";
      del.title = "Remove this clothing entry (picture and manifest line)";
      del.setAttribute("aria-label", "Remove the " + e2.type + " clothing entry");
      del.addEventListener("click", function () {
        fetch("/api/characters/" + encodeURIComponent(chEditing)
              + "/clothing?file=" + encodeURIComponent(e2.file),
              { method: "DELETE" })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d && d.profile) {
              chClothServer = d.profile.clothing || [];
              chProfiles[chEditing] = d.profile;
              chClothPaint();
            } else el("chClothMsg").textContent = (d && d.error) || "could not remove";
          }).catch(function (er) { el("chClothMsg").textContent = String(er); });
      });
      row.appendChild(del);
      box.appendChild(row);
    });
    chClothQueue.forEach(function (q, i) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:center;opacity:.85";
      var tx = document.createElement("div");
      tx.className = "hint"; tx.style.flex = "1";
      tx.textContent = "⏳ " + q.type + (q.color ? " · " + q.color : "")
        + " (" + (q.name || "picture") + ") — attaches on Save";
      row.appendChild(tx);
      var del = document.createElement("button");
      del.className = "ghost gbtn"; del.type = "button"; del.textContent = "✕";
      del.title = "Drop this queued clothing entry";
      del.setAttribute("aria-label", "Drop the queued " + q.type + " entry");
      del.addEventListener("click", function () {
        chClothQueue.splice(i, 1); chClothPaint();
      });
      row.appendChild(del);
      box.appendChild(row);
    });
  }
  function chClothReset(entries) {
    chClothQueue = [];
    chClothServer = entries || [];
    if (el("chClothMsg")) el("chClothMsg").textContent = "";
    chClothPaint();
  }
  /* The page's in-app drag payload and the reference tray are global lexical
     bindings declared by index.html's inline script; reading them through a
     try/catch keeps this file loadable (and testable) on its own. */
  function chPayload() { try { return dragPayload; } catch (e) { return null; } }
  function chTrayRef(i) { try { return (refs || [])[i]; } catch (e) { return null; } }
  /* THE TYPE SHAPES THE SHEET (2.166.0, by instruction): rows tagged
     data-chtype list the types they belong to; everything else always
     shows. The values are STORED for every type — switching type hides
     fields, it never erases them. */
  function chTypeApply() {
    var t = el("chType") ? el("chType").value : "person";
    Array.prototype.forEach.call(
      document.querySelectorAll("#chDlg [data-chtype]"), function (n) {
        n.style.display = (n.dataset.chtype.split(" ").indexOf(t) >= 0) ? "" : "none";
      });
  }
  function chThumbSet(name, images) {
    var img = el("chDlgThumb"), pics = el("chDlgPics");
    if (!img) return;
    img.src = (name && images && images.length)
      ? "/api/characters/" + encodeURIComponent(name) + "/file/"
        + encodeURIComponent(images[0])
      : "";
    if (pics) pics.textContent = (images && images.length ? images.length : "no")
      + " picture(s) — ＋ or the thumbnail adds more; several sheets are "
      + "STITCHED into one reference image on save, so the character is "
      + "never loaded twice.";
  }

  function card(c, picStart) {
    var facts = [
      c.type === "vehicle" ? [c.year, c.color, c.model].filter(Boolean).join(" ")
        : c.type === "animal" ? [c.color, c.breed || c.subtype].filter(Boolean).join(" ")
        : c.type === "clothing" ? [c.color, c.subtype].filter(Boolean).join(" ")
        : "",
      c.age && ("age " + c.age), c.height, c.weight]
      .filter(Boolean).join(" · ");
    var miss = [];
    if (!(c.images || []).length) miss.push("no sheet");
    if (!(c.voices || []).length) miss.push("no voice");
    var nPics = (c.images || []).length;
    // "Picture C1" (2.161.0) — and since 2.168.0 EVERY character is exactly
    // ONE picture on the chain: several sheets are stitched into a single
    // composite reference, so the label is always one number (the character's
    // position in the cast). LABEL ONLY — prompts still write the pack's own
    // "<Picture N>" token.
    var picLabel = "Picture C" + picStart
      + (nPics > 1 ? " (" + nPics + " sheets stitched)" : "");
    // A THUMBNAIL, not a slot (2.153.0, by instruction: "make the character
    // image a thumbnail in video docker - characters") — a 56px square at
    // the card's left, so the cast list is a compact roster instead of a
    // column of full-width tiles. The Picture N mapping moves into the text.
    return '<div class="chcard" data-name="' + esc(c.name) + '"'
      + ' title="Click to edit ' + esc(c.name) + '. ' + (nPics
          ? "C marks a character sheet — the reference dock has its own Picture numbers. "
            + "In prompts still write <Picture " + picStart + ">; the C is a label, "
            + "not part of the prompt token."
          : "No sheet yet — upload one in the editor.") + '"'
      + ' style="cursor:pointer;display:flex;gap:8px;align-items:center;'
      + 'padding:4px 6px;border-bottom:1px solid #262a33">'
      + (nPics
          ? '<img class="chthumb" src="/api/characters/' + encodeURIComponent(c.name)
            + '/file/' + encodeURIComponent(c.images[0]) + '" alt="" '
            + 'style="width:56px;height:56px;object-fit:cover;border-radius:4px;flex:none">'
          : '<div class="chthumb" style="width:56px;height:56px;background:#20242c;'
            + 'border-radius:4px;flex:none"></div>')
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      + esc(c.name) + "</div>"
      + '<div class="hint">' + esc(nPics ? picLabel : "no sheet")
      + (facts ? " · " + esc(facts) : "") + (c.refmod ? " · 🧬" + esc(c.refmod) : "") + "</div>"
      + (miss.length ? '<div class="hint" style="color:#e6a23c">⚠ '
          + esc(miss.join(", ")) + "</div>" : "")
      + "</div>"
      + '<button class="x" data-del="' + esc(c.name) + '" title="Remove this character"'
      + ' aria-label="Remove ' + esc(c.name) + '" style="flex:none">✕</button>'
      + "</div>";
  }

  function refresh() {
    return fetch("/api/characters").then(function (r) { return r.json(); })
      .then(function (d) {
        var cs = d.characters || [];
        chProfiles = {};
        cs.forEach(function (c) { chProfiles[c.name] = c; });
        var picN = 1, cards = [];
        cs.forEach(function (c) {
          cards.push(card(c, picN));
          picN += (c.images || []).length ? 1 : 0;   // one composite = one Picture
        });
        el("chList").innerHTML = cs.length ? cards.join("")
          : '<div class="modehint">No characters yet. NEW adds one with a '
            + 'character sheet and a voice clip.</div>';
        el("chCount").textContent = cs.length
          ? cs.length + (cs.length === 1 ? " character" : " characters") : "";
        // CLICK OPENS THE EDITOR (2.150.0, by instruction: "when user
        // clicks the character open the edit character tab") — prefilled
        // from the profile; the name is the folder key, so it is read-only
        // while editing. ✕ stays a delete and must not open the editor.
        Array.prototype.forEach.call(el("chList").querySelectorAll(".chcard"),
          function (cEl) {
            cEl.addEventListener("click", function () {
              var p = chProfiles[cEl.dataset.name];
              if (!p) return;
              chEditing = p.name;
              el("chDlgTitle").textContent = "Edit " + p.name;
              // THE BUTTON SAYS WHAT IT DOES (2.160.0, by instruction:
              // "change the add character button to Save"): an edit is an
              // in-place update — same name, same folder — never a second
              // character. The save flow was already an upsert by name; the
              // label was the lie.
              el("chSave").textContent = "Save";
              el("chSave").title = "Save changes to " + p.name
                + " — no new character is created";
              el("chName").value = p.name; el("chName").readOnly = true;
              el("chAge").value = p.age || "";
              el("chHeight").value = p.height || "";
              el("chWeight").value = p.weight || "";
              if (el("chPronouns")) el("chPronouns").value = p.pronouns || "";
              if (el("chWardrobe")) el("chWardrobe").value = p.wardrobe || "";
              if (el("chType")) el("chType").value =
                ["person", "animal", "vehicle"].indexOf(p.type) >= 0 ? p.type : "person";
              if (el("chSubtype")) el("chSubtype").value = p.subtype || "";
              if (el("chBreed")) el("chBreed").value = p.breed || "";
              if (el("chColor")) el("chColor").value = p.color || "";
              if (el("chModel")) el("chModel").value = p.model || "";
              if (el("chYear")) el("chYear").value = p.year || "";
              chTypeApply();
              chThumbSet(p.name, p.images || []);
              chDropReset();                  // 2.212.0: drops belong to ONE open
              chClothReset(p.clothing || []); // 2.224.0: this profile's outfits
              el("chNotesIn").value = p.notes || "";
              if (el("chPersonaIn")) el("chPersonaIn").value = p.persona || "";
              if (el("chBackstoryIn")) el("chBackstoryIn").value = p.backstory || "";
              try { window.chTabShow("chTabProfile"); } catch (er) {} // 2.216.0: open on Profile
              el("chSheet").value = ""; el("chVoice").value = "";
              el("chDlgMsg").textContent = (p.images || []).length
                + " sheet(s), " + (p.voices || []).length
                + " voice clip(s) — new uploads are ADDED, nothing is replaced";
              el("chDlg").showModal();
            });
          });
        Array.prototype.forEach.call(el("chList").querySelectorAll("[data-del]"),
          function (b) {
            b.addEventListener("click", function (ev) {
              ev.stopPropagation();
              // appConfirm, never native confirm(): after a native dialog the
              // Electron renderer stops painting (2.91.1). The fallback is for
              // the plain browser, where the app dialog may not be loaded.
              var ask = window.appConfirm
                ? window.appConfirm("Remove " + b.dataset.del
                    + " and everything in their folder?")
                : Promise.resolve(true);
              Promise.resolve(ask).then(function (yes) {
                if (!yes) return;
                fetch("/api/characters/" + encodeURIComponent(b.dataset.del),
                      { method: "DELETE" }).then(refresh);
              });
            });
          });
      }).catch(function () {});
  }

  function build() {
    // 2.391.0 (Tim: "remove Start clip / Range / Redo scene ... from videodocker"): the fields are gone - Build sends
    // what they always started at (clip 1, scenes 1:2); its notes go to the docker's info line
    var body = { start_clip: "1", scene_range: "1:2", redo_scene: "" };
    el("scNotes").textContent = "building…";
    return fetch("/api/characters/build", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        // Notes matter more than the happy path: a character with no sheet is
        // named here rather than quietly missing from the render.
        el("scNotes").textContent = d.error ? d.error
          : (d.file + ": " + d.cast + " character(s). "
             + (d.notes || []).join(" · "));
      }).catch(function (e) { el("scNotes").textContent = String(e); });
  }

  function save() {
    var name = el("chName").value.trim();
    if (!name) { el("chDlgMsg").textContent = "a character needs a name"; return; }
    el("chDlgMsg").textContent = "saving…";
    fetch("/api/characters", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, age: el("chAge").value,
        height: el("chHeight").value, weight: el("chWeight").value,
        pronouns: el("chPronouns") ? el("chPronouns").value : "",
        wardrobe: el("chWardrobe") ? el("chWardrobe").value : "",
        type: el("chType") ? el("chType").value : "person",
        subtype: el("chSubtype") ? el("chSubtype").value : "",
        breed: el("chBreed") ? el("chBreed").value : "",
        color: el("chColor") ? el("chColor").value : "",
        model: el("chModel") ? el("chModel").value : "",
        year: el("chYear") ? el("chYear").value : "",
        notes: el("chNotesIn").value,
        persona: el("chPersonaIn") ? el("chPersonaIn").value : "",
        backstory: el("chBackstoryIn") ? el("chBackstoryIn").value : "" }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) throw new Error(d.error);
        var jobs = [];
        // EVERY picked picture uploads (2.166.0: the input is `multiple`);
        // the voice input stays single. Uploads ADD, nothing is replaced.
        var picks = [];
        Array.prototype.forEach.call(el("chSheet").files, function (f) { picks.push(f); });
        if (el("chVoice").files[0]) picks.push(el("chVoice").files[0]);
        picks.forEach(function (f) {
          var fd = new FormData();
          fd.append("file", f, f.name);
          jobs.push(fetch("/api/characters/" + encodeURIComponent(name) + "/asset",
                          { method: "POST", body: fd })
            .then(function (r) { return r.json(); })
            .then(function (a) { if (a.error) throw new Error(a.error); }));
        });
        // 2.212.0: DROPPED pictures attach here too — by NAME when they are
        // already project Images assets (Assets drops; gallery drops were
        // adopted on drop), by BYTES when they came off the References tray
        // or the desktop. asset-from copies server-side, no re-upload.
        // 2.224.0: queued CLOTHING entries attach here — one multipart per
        // entry (picture + type + color + notes), into dataset/clothing/.
        chClothQueue.forEach(function (q) {
          var fdc = new FormData();
          fdc.append("image", q.blob, q.name || "clothing.png");
          fdc.append("type", q.type);
          if (q.color) fdc.append("color", q.color);
          if (q.notes) fdc.append("notes", q.notes);
          jobs.push(fetch("/api/characters/" + encodeURIComponent(name) + "/clothing",
                          { method: "POST", body: fdc })
            .then(function (r) { return r.json(); })
            .then(function (a) { if (a.error) throw new Error(a.error); }));
        });
        chDropQueue.forEach(function (q) {
          if (q.blob) {
            var fdb = new FormData();
            fdb.append("file", q.blob, q.blob.name || "dropped.png");
            jobs.push(fetch("/api/characters/" + encodeURIComponent(name) + "/asset",
                            { method: "POST", body: fdb })
              .then(function (r) { return r.json(); })
              .then(function (a) { if (a.error) throw new Error(a.error); }));
          } else if (q.file) {
            jobs.push(fetch("/api/characters/" + encodeURIComponent(name) + "/asset-from",
                            { method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ file: q.file }) })
              .then(function (r) { return r.json(); })
              .then(function (a) { if (a.error) throw new Error(a.error); }));
          }
        });
        return Promise.all(jobs);
      })
      .then(function () {
        // STATE FIRST, VIEW LAST: a dialog close() that throws (partial
        // <dialog> support) must never strand the button on "Save"
        chEditing = "";
        el("chName").readOnly = false;
        el("chDlgTitle").textContent = "New character";
        el("chSave").textContent = "Add character";
        el("chSave").title = "Create this character";
        ["chName", "chAge", "chHeight", "chWeight", "chNotesIn",
         "chPronouns", "chWardrobe", "chSubtype", "chBreed", "chColor",
         "chModel", "chYear"].forEach(
          function (i) { if (el(i)) el(i).value = ""; });
        if (el("chType")) el("chType").value = "person";
        chTypeApply();
        chThumbSet("", []);
        chDropReset();                        // 2.212.0: the queue attached
        chClothReset([]);                     // 2.224.0: attached with them
        el("chSheet").value = ""; el("chVoice").value = "";
        el("chDlgMsg").textContent = "";
        try { el("chDlg").close(); } catch (e) { /* view only */ }
        refresh();
      })
      .catch(function (e) { el("chDlgMsg").textContent = String(e.message || e); });
  }

  /* ---- THE SCENE BOARD (2.139.0) ----------------------------------------
     One card per screenplay scene with a circular play button; a chapter
     adder; a preview with keep/redo (icon-only, titled) under it; Produce.
     The truth lives server-side (/api/scenes, persisted in the .prj); this
     only paints it and polls while anything is rendering. */
  var scState = { chapters: [], list: [] };
  var scSel = null, scTimer = null;
  // 2.323.0: the ONLY board flows (the looping chains are retired)
  var VD_FLOWS = [["MMH3_NativeAudio_MV", "Native audio · ref2va / fl2va"], ["H3_Video_Ref", "H3_Video_Ref"],
                  // 2.338.0: LTX 2.5 - Tim's all-in-one canvas (lib/ltxScenes.js)
                  ["LTX25", "LTX 2.5 · text / first-last / lipsync"],
                  // 2.352.0: H3_Viggle - each scene's 🎬 motion video, performed (lib/h3Viggle.js)
                  ["H3_Viggle", "H3_Viggle · motion video performed (ref2va / fl2va)"]];
  var VD_FLOW_IDS = VD_FLOWS.map(function (f) { return f[0]; });
  var scFlowMoved = false;
  var scCountFile = 0;                  // 2.323.0: the number in scenes.txt (0 = none)
  function scCountPaint() {
    if (!el("scCount") || document.activeElement === el("scCount")) return;
    el("scCount").value = scState.scene_count || "";
    if (scCountFile) el("scCount").placeholder = "txt: " + scCountFile;
  }
  // TICKED SCENES (2.149.0): scene numbers the user has checked. Client-side
  // only — a selection is an intention, not board state — and re-applied on
  // every repaint so the 4-second poll cannot untick anything.
  var scChecked = {};

  /* 2.384.0 (Tim: "in videodocker scene, when render is running, say running step n of total and show a progress bar
     and time taken to render"): the board's answer carries the running job's progress (routes/characters.js GET
     /api/scenes -> lib/jobMeta.progress); a finished take keeps its render time and the seed it used */
  function scClock(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s2 = sec % 60;
    return m >= 60 ? Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") + ":" + String(s2).padStart(2, "0")
                   : m + ":" + String(s2).padStart(2, "0");
  }
  function scBadge(r) {
    var pr = r.progress || null;
    /* 2.391.1 (Tim: "add step n of total to the scene frame when it says rendering, say rendering step n of total"):
       one word for it - "rendering step n of total" while the sampler counts, "rendering - loading the models" before
       its first step, "rendering…" only when no job answers at all */
    var run = pr && !pr.queued
      ? "⏳ rendering" + (pr.total ? " step " + pr.step + " of " + pr.total : " - loading the models")
        + (pr.chunk && pr.chunk.n > 1 ? " · chunk " + pr.chunk.i + "/" + pr.chunk.n : "") + " · " + scClock(pr.elapsed)
      : pr && pr.queued ? "⏳ waiting in the queue" : "⏳ rendering…";
    var b = { idle: "", running: run, rendered: "🎞 rendered", kept: "✔ kept" }[r.status] || "";
    if ((r.status === "rendered" || r.status === "kept") && Number.isFinite(r.render_seconds)) b += " in " + scClock(r.render_seconds);
    if ((r.status === "rendered" || r.status === "kept") && r.seed_used != null) b += " · seed " + r.seed_used;
    if (r.upjob) b += (b ? " · " : "") + "⏫ upscaling…";
    else if (r.upscaled) b += (b ? " · " : "") + "⏫ upscaled";
    if ((scState.pending || []).indexOf(r.id) >= 0) b += (b ? " · " : "") + "⏳ queued";
    // a PROBED silent file says so (2.161.0) — audio === false is a real
    // ffprobe answer, never a guess; absent means the probe was unavailable
    if (r.audio === false) b += (b ? " · " : "") + "🔇 silent file (no audio track)";
    return b;
  }

  var scFrameCache = {}, scFrameLoading = {}, scFilmHidden = {};
  /* 2.300.1 (Tim: "for the filmstrips in the scenes, remove the scrollbar,
     add left arrow on the left and right arrow on the right to scroll
     through the filmstrip, scrollbars make the ui look cheap"): the strip
     scrolls with NO scrollbar - ◀ / ▶ at its ends page through it (dimmed
     at an end, gone when every frame fits), the mouse wheel scrolls it
     sideways until it reaches an end, and each scene's position SURVIVES
     the board's 4-second repaint (it used to jump back to the start). */
  var scStripPos = {};             // scene n -> scrollLeft
  (function () {
    if (document.getElementById("scStripCss")) return;
    var st = document.createElement("style");
    st.id = "scStripCss";
    st.textContent = ".scstrip{scrollbar-width:none;-ms-overflow-style:none}"
      + ".scstrip::-webkit-scrollbar{display:none;width:0;height:0}"
      + ".scstripnav{flex:none;width:22px;padding:0;font-size:.8rem;line-height:1}"
      + ".scstripnav[disabled]{opacity:.25;cursor:default}"
      + ".scprog{height:6px;background:var(--panel-2,#26221b);border:1px solid var(--line,#3a342a);border-radius:3px;overflow:hidden;margin-top:2px}"
      + ".scprog i{display:block;height:100%;background:var(--tiger,#f59e2c);transition:width .6s}";
    (document.head || document.documentElement).appendChild(st);
  })();
  /** ◀ / ▶ follow the strip: dimmed at an end, hidden when it all fits. */
  function scStripNav(strip) {
    var row = strip && strip.parentNode;
    if (!row) return;
    var max = strip.scrollWidth - strip.clientWidth;
    var fits = !(max > 1);
    Array.prototype.forEach.call(row.querySelectorAll("[data-scstripnav]"), function (b) {
      b.style.visibility = fits ? "hidden" : "";
      b.disabled = fits || (+b.dataset.dir < 0 ? strip.scrollLeft <= 1 : strip.scrollLeft >= max - 1);
    });
  }
  // a wider or narrower dock shows more or fewer frames: re-measure
  if (window.ResizeObserver && el("scList")) new ResizeObserver(function () {
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scstrip]"), scStripNav);
  }).observe(el("scList"));
  function scStripNavBtn(n, dir) {
    return '<button class="ghost gbtn scstripnav" data-scstripnav="' + n + '" data-dir="' + dir + '" type="button" '
      + 'title="' + (dir < 0 ? "Earlier" : "Later") + ' frames" '
      + 'aria-label="Scroll scene ' + n + '\'s frames ' + (dir < 0 ? "left" : "right") + '">'
      + (dir < 0 ? "◀" : "▶") + "</button>";
  }
  /* 2.297.0 (Tim: "allow the user to select first and/or last frame from
     previous clips or gallery or assets"): the picker - Clips (a frame of
     any rendered scene, or its last frame), Gallery, Assets, a File. */
  function scFlPicker(n, slot) {
    var old = document.getElementById("scFlPick");
    if (old) old.remove();
    var ov = document.createElement("div");
    ov.id = "scFlPick";
    ov.setAttribute("role", "dialog");
    /* 2.298.0: slot "ref" = add THIS scene's reference pictures from the
       scanned project (Assets, Gallery, Characters, Locations, References,
       Scene pictures ...) - the same picker, its own endpoint */
    var isRef = slot === "ref";
    /* 2.337.0: slot "qe_location" / "qe_prop" = the ✎ First frame
       accordion's location / prop pictures (routes/sceneedit.js) */
    var isQe = /^qe_/.test(slot), qeWhat = slot === "qe_location" ? "location" : slot === "qe_pica" ? "Picture A" : "prop";
    ov.setAttribute("aria-label", isRef ? "Add reference pictures to scene " + n
      : isQe ? "Choose scene " + n + "'s " + qeWhat + " picture for its first frame"
      : "Choose scene " + n + "'s " + slot + " frame");
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;"
      + "display:flex;align-items:center;justify-content:center";
    ov.innerHTML = '<div style="background:#1b1e25;border:1px solid #333;border-radius:6px;'
      + 'padding:10px;width:min(720px,94vw);max-height:80vh;display:flex;flex-direction:column;gap:6px">'
      + '<div style="display:flex;gap:6px;align-items:center;font-weight:600">'
      + '<span style="flex:1">Scene ' + n + (isRef ? " — add a reference picture"
          : isQe ? " — ✎ first frame: " + (qeWhat === "location" ? "choose the LOCATION picture" : qeWhat === "Picture A" ? "choose PICTURE A (its style, composition and poses are kept)" : "add a PROP picture")
          : " — choose the " + (slot === "first" ? "FIRST" : "LAST") + " frame") + "</span>"
      + '<button class="ghost gbtn" data-flclose type="button" aria-label="Close">✕</button></div>'
      + '<div style="display:flex;gap:4px">'
      /* 2.563.0 (Tim: "allow user to add reference images to each scene, include images from previous scenes"):
         + 🎬 Scenes (every other scene's own pictures), and 🎞 Clips (any take's frames) for the reference pictures too */
      + ["scenes", "clips", "project", "file"].map(function (t) {
          return '<button class="ghost gbtn" data-fltab="' + t + '" type="button" style="font-size:.72rem">'
            + { scenes: "🎬 Scenes", clips: "🎞 Clips", project: "📁 Project", file: "⤒ File" }[t] + "</button>";
        }).join("") + "</div>"
      + '<div data-flbody style="overflow:auto;display:flex;flex-wrap:wrap;gap:4px;min-height:80px"></div>'
      + '<div class="hint" data-flnote></div></div>';
    document.body.appendChild(ov);
    var body = ov.querySelector("[data-flbody]"), note = ov.querySelector("[data-flnote]");
    var close = function () { ov.remove(); };
    ov.querySelector("[data-flclose]").addEventListener("click", close);
    ov.addEventListener("click", function (ev) { if (ev.target === ov) close(); });
    var choose = function (payload) {
      payload.slot = slot;
      note.textContent = "setting…";
      fetch("/api/scenes/" + n + (isRef ? "/refs/project" : isQe ? "/qedit/pic" : "/fl"), { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r2) { return r2.json(); })
        .then(function (d) {
          if (d.error) { note.textContent = "⚠ " + d.error; return; }
          el("scNotes").textContent = d.note || "";
          close();
          scRefresh();
        }).catch(function (e) { note.textContent = String(e); });
    };
    var thumb = function (src, title, onPick) {
      var img = document.createElement("img");
      img.src = src; img.title = title; img.alt = title;
      img.style.cssText = "height:72px;cursor:pointer;flex:none;border-radius:3px";
      img.addEventListener("click", onPick);
      body.appendChild(img);
      return img;
    };
    var tabs = {
      /* 2.563.0: every other scene's own pictures - its First / Last frames, its reference pictures, its ✎ Picture A /
         location / props - one heading per scene (lib/scenePictures; picked like a project picture, with its words) */
      scenes: function () {
        fetch("/api/scenes/pictures?except=" + n).then(function (r2) { return r2.json(); }).then(function (j) {
          var sc = (j && j.scenes || []).filter(function (x) { return x.items.length; });
          if (!sc.length) { body.innerHTML = '<span class="hint">no other scene has pictures yet - 🎞 Clips takes a frame of a rendered scene</span>'; return; }
          sc.forEach(function (x) {
            var h = document.createElement("div");
            h.className = "hint"; h.setAttribute("data-flgroup", "scene " + x.n);
            h.style.cssText = "flex-basis:100%;font-weight:600;margin-top:4px";
            h.textContent = "Scene " + x.n + (x.chapter ? " · " + x.chapter : "");
            body.appendChild(h);
            x.items.forEach(function (it) {
              var words = "scene " + x.n + " · " + it.label;
              var im = thumb(it.url, words, function () { choose({ kind: "project", rel: it.rel, label: words }); });
              im.setAttribute("data-flrel", it.rel);
            });
          });
        }).catch(function () { note.textContent = "could not list the scenes' pictures"; });
      },
      clips: function () {
        var done = (scState.list || []).filter(function (x) { return x.output && x.status !== "running"; });
        if (!done.length) { body.innerHTML = '<span class="hint">no rendered scenes yet</span>'; return; }
        done.forEach(function (x) {
          var b = document.createElement("button");
          b.className = "ghost gbtn"; b.type = "button"; b.style.fontSize = ".72rem";
          b.textContent = "Scene " + x.n;
          b.setAttribute("data-flscene", x.n);
          b.addEventListener("click", function () {
            body.innerHTML = "";
            var last = document.createElement("button");
            last.className = "ghost gbtn"; last.type = "button"; last.style.fontSize = ".72rem";
            last.textContent = "use scene " + x.n + "'s LAST frame";
            last.setAttribute("data-fllast", x.n);
            last.addEventListener("click", function () { choose({ kind: "frame", scene: x.n }); });
            body.appendChild(last);
            var secs = Math.max(1, (x.length || 141) / 24);
            fetch("/api/frames?src=video&name=" + encodeURIComponent(x.output)
              + "&start=0&end=" + secs.toFixed(2) + "&fps=2&width=96")
              .then(function (r2) { return r2.json(); })
              .then(function (j) {
                (j && j.frames || []).forEach(function (f2, i2) {
                  var t2 = f2.t != null ? f2.t : i2 / 2;
                  thumb("/framecache/" + j.key + "/" + f2.file, "scene " + x.n + " at "
                    + (Math.round(t2 * 10) / 10) + "s",
                    function () { choose({ kind: "frame", scene: x.n, time: t2 }); });
                });
              }).catch(function () { note.textContent = "frame fetch failed"; });
          });
          body.appendChild(b);
        });
      },
      /* 2.298.0 (Tim: "scan the projects subfolders for images ... scan
         for assets, characters, locations etc."): every picture in the
         project, one heading per folder group */
      project: function () {
        var lister = window.bgMedia ? window.bgMedia.load("images")
          : fetch("/api/passets").then(function (r2) { return r2.json(); })
              .then(function (j) { return (j && j.images || []).map(function (f) {
                return { name: f.name, rel: "images/" + f.name, group: "Assets", asset: true }; }); });
        lister.then(function (list) {
          list = (list || []).filter(function (x) { return /\.(png|jpe?g|webp|bmp|gif)$/i.test(x.name); });
          if (!list.length) { body.innerHTML = '<span class="hint">no pictures in this project yet</span>'; return; }
          var g0 = null;
          list.forEach(function (x) {
            if (x.group !== g0) {
              g0 = x.group;
              var h = document.createElement("div");
              h.className = "hint"; h.setAttribute("data-flgroup", x.group);
              h.style.cssText = "flex-basis:100%;font-weight:600;margin-top:4px";
              h.textContent = x.group;
              body.appendChild(h);
            }
            var src = window.bgMedia ? window.bgMedia.thumbSrc(x)
              : "/passets/images/" + encodeURIComponent(x.name);
            var im = thumb(src, x.group + " — " + x.name,
              function () { choose({ kind: "project", rel: x.rel }); });
            im.setAttribute("data-flrel", x.rel);
          });
        }).catch(function () { note.textContent = "could not scan the project"; });
      },
      file: function () {
        var inp = document.createElement("input");
        inp.type = "file"; inp.accept = "image/*";
        inp.setAttribute("aria-label", "Picture for the " + slot + " frame");
        inp.addEventListener("change", function () {
          if (!inp.files || !inp.files[0]) return;
          var fd = new FormData();
          if (isRef) fd.append("images", inp.files[0]);
          else { fd.append("slot", slot); fd.append("image", inp.files[0]); }
          fetch("/api/scenes/" + n + (isRef ? "/refs" : isQe ? "/qedit/pic/upload" : "/fl/upload"), { method: "POST", body: fd })
            .then(function (r2) { return r2.json(); })
            .then(function (d) {
              if (d.error) { note.textContent = "⚠ " + d.error; return; }
              close(); scRefresh();
            }).catch(function (e) { note.textContent = String(e); });
        });
        body.appendChild(inp);
      },
    };
    Array.prototype.forEach.call(ov.querySelectorAll("[data-fltab]"), function (b) {
      b.addEventListener("click", function () { body.innerHTML = ""; note.textContent = "";
        tabs[b.dataset.fltab](); });
    });
    tabs.scenes();
    return ov;
  }
  function scNextOf(n) {
    return (scState.list || []).filter(function (x) { return x.n > n; })
      .sort(function (a, b) { return a.n - b.n; })[0] || null;
  }
  function scStripBlock(r) {
    var nx = scNextOf(r.n);
    var picked = nx && nx.cont_src === r.n && nx.cont_time != null ? nx.cont_time : null;
    var hidden = !!scFilmHidden[r.n];
    return '<div data-scfilmwrap="' + r.n + '" style="width:100%">'
      + '<div class="hint" style="display:flex;gap:6px;align-items:center;font-size:.7rem">'
      + '<button class="ghost gbtn" data-scfilm="' + r.n + '" type="button" '
      + 'title="' + (hidden ? "Show" : "Hide") + ' the frames of scene ' + r.n + '\'s take" '
      + 'aria-label="' + (hidden ? "Show" : "Hide") + ' the frames of scene ' + r.n + '" '
      + 'style="font-size:.7rem">🎞 ' + (hidden ? "show frames" : "hide frames") + "</button>"
      + "<span>" + (nx
          ? "Click a frame to make it the FIRST frame of scene " + nx.n + " · "
            + (picked != null ? "picked: " + (Math.round(picked * 10) / 10) + "s"
               : "none picked - scene " + nx.n + " starts on this take's last frame")
          : "the last scene - add a scene after it to start one from a frame") + "</span>"
      /* 2.296.0 (Tim: "is it possible for me to add the last frame of the
         scene before as a reference image to the current scene?"): the
         picked frame (else the last) goes onto the next scene's pictures */
      + (nx ? '<button class="ghost gbtn" data-scframeref="' + r.n + '" type="button" '
          + 'data-sctime="' + (picked != null ? picked : "") + '" '
          + 'title="Add ' + (picked != null ? "the picked frame" : "this take\'s last frame")
          + ' to scene ' + nx.n + '\'s reference pictures (it rides a Ref or Cont render of scene '
          + nx.n + ')" aria-label="Add the frame to scene ' + nx.n + '\'s pictures" '
          + 'style="font-size:.7rem">＋🖼 to scene ' + nx.n + "</button>" : "")
      + "</div>"
      // 2.300.1: ◀ strip ▶ - the strip scrolls without a scrollbar
      + '<div data-scstriprow="' + r.n + '" style="display:' + (hidden ? "none" : "flex")
      + ';align-items:stretch;gap:3px;margin-top:2px">'
      + scStripNavBtn(r.n, -1)
      + '<div class="scstrip" data-scstrip="' + r.n + '" data-scout="' + esc(r.output) + '" '
      + 'data-sclen="' + (r.length || 141) + '" '
      + 'style="display:flex;gap:2px;overflow-x:auto;overflow-y:hidden;flex:1;min-width:0"></div>'
      + scStripNavBtn(r.n, 1)
      + "</div></div>";
  }
  /** Fill every open filmstrip: from the cache when this take's frames
   *  were already extracted (the 4-second poll repaints without a refetch),
   *  else one extraction per take. */
  function scFillStrips() {
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scstrip]"), function (strip) {
      var n = parseInt(strip.dataset.scstrip, 10);
      if (scFilmHidden[n]) return;
      var out = strip.dataset.scout, secs = Math.max(1, (+strip.dataset.sclen || 141) / 24);
      var key = out + "|" + secs.toFixed(2);
      var paint = function (j) {
        if (!j || !j.frames || !j.frames.length) {
          strip.innerHTML = '<span class="hint">no frames - '
            + esc((j && j.error) || "extraction failed") + "</span>";
          return;
        }
        var nx = scNextOf(n);
        var picked = nx && nx.cont_src === n && nx.cont_time != null ? nx.cont_time : null;
        var best = -1;
        if (picked != null) {
          var bd = 1e9;
          j.frames.forEach(function (f2, i2) {
            var t = f2.t != null ? f2.t : i2 / 2;
            if (Math.abs(t - picked) < bd) { bd = Math.abs(t - picked); best = i2; }
          });
        }
        strip.innerHTML = "";
        j.frames.forEach(function (f2, i2) {
          var img = document.createElement("img");
          img.src = "/framecache/" + j.key + "/" + f2.file;
          var t2 = f2.t != null ? f2.t : (i2 / 2);
          img.style.cssText = "height:54px;cursor:pointer;flex:none;border:2px solid "
            + (i2 === best ? "#4fa3ff" : "transparent");
          img.setAttribute("data-scframe", n);
          img.title = nx ? "Make this (" + (Math.round(t2 * 10) / 10) + "s) the first frame of scene " + nx.n
            : "The last scene - no scene after it";
          img.addEventListener("click", function (ev) {
            ev.stopPropagation();
            if (!nx) return;
            scPost("/api/scenes/" + n + "/pick-frame", { time: t2 });
          });
          strip.appendChild(img);
        });
        // 2.300.1: back where the user left it (the poll repaints the card);
        // the first time, the picked frame is brought into view
        // (a restore TARGET: until the frames have their widths the strip is
        // too short to reach it, and that clamped scroll must never be saved)
        if (scStripPos[n] != null) { strip._want = scStripPos[n]; strip.scrollLeft = strip._want; }
        else if (best >= 0 && strip.children[best]) {
          var pk = strip.children[best];
          strip.scrollLeft = Math.max(0, pk.offsetLeft - strip.offsetLeft
            - (strip.clientWidth - pk.offsetWidth) / 2);
        }
        scStripNav(strip);
        // the widths land as the frames load - re-measure the arrows then
        Array.prototype.forEach.call(strip.querySelectorAll("img"), function (im) {
          if (im.complete) return;
          var done = function () {
            if (strip._want != null) strip.scrollLeft = strip._want;
            scStripNav(strip);
          };
          im.addEventListener("load", done); im.addEventListener("error", done);
        });
      };
      if (scFrameCache[key]) { paint(scFrameCache[key]); return; }
      strip.innerHTML = '<span class="hint">extracting frames\u2026</span>';
      if (scFrameLoading[key]) return;
      scFrameLoading[key] = true;
      fetch("/api/frames?src=video&name=" + encodeURIComponent(out)
        + "&start=0&end=" + secs.toFixed(2) + "&fps=2&width=96")
        .then(function (r2) { return r2.json(); })
        .then(function (j) {
          delete scFrameLoading[key];
          if (j && j.frames && j.frames.length) scFrameCache[key] = j;
          var live = el("scList").querySelector('[data-scstrip="' + n + '"]');
          if (live) { strip = live; paint(j); }
        }).catch(function () {
          delete scFrameLoading[key];
          strip.innerHTML = '<span class="hint">frame fetch failed</span>';
        });
    });
  }

  /* 2.297.0 (Tim: "show the reference or f/l images as thumbnails below
     the scene, allow user to remove these images"): UNDER the scene's row -
     its FIRST / LAST frame slots (Trans: both; First / Cont: the first)
     and its own reference pictures, each with a ✕. */
  /* 2.299.2: the scene TYPE radio group - one per scene, a valid group is
     exactly these four values under the name scene_<n>_type_group */
  var SC_TYPES = ["reference", "first", "continue", "transition"];
  /* 2.358.0 (Tim: "render segment 1 and 3 as ref for example and segment 2
     as fl2va ... If user clicks transition then we can do standard
     transitions like wipe, fade, dissolve"): a BRIDGE scene (the song strip's
     ☐ Transition) shows a type picker instead of the four radios - AI
     (fl2va from the scene before's last frame to the scene after's first
     frame) or one of the timeline's transitions (ffmpeg, no model). */
  var scBridgeTypes = [];
  fetch("/api/bridge/types").then(function (r) { return r.json(); })
    .then(function (d) { scBridgeTypes = (d && d.types) || []; if ((scState.list || []).some(function (r) { return r.bridge; })) scPaint(); })
    .catch(function () {});
  function scBridgeSel(r) {
    var types = scBridgeTypes.length ? scBridgeTypes : [{ id: "ai", label: "AI (fl2va)" }];
    var cur = (r.bridge && r.bridge.type) || "ai", groups = {}, order = [];
    types.forEach(function (t) { var g = t.group || ""; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(t); });
    var opt = function (t) {
      return '<option value="' + esc(t.id) + '"' + (t.id === cur ? " selected" : "") + ">" + esc(t.label) + "</option>"; };
    return '<span data-scbridgegroup="' + r.n + '" '
      + 'style="display:flex;gap:4px;align-items:center;font-weight:400;font-size:.68rem;flex:none" '
      + 'title="Bridge scene: from the scene before\'s LAST frame to the scene after\'s FIRST frame. AI = fl2va through the native-audio board (fitted to the gap); a transition (fade, dissolve, wipe ...) is drawn with ffmpeg - no model, renders in seconds. Render both neighbours first.">'
      + '⇄ <select data-scbridge="' + r.n + '" aria-label="Bridge type for scene ' + r.n + '" '
      + 'style="font-size:.68rem;max-width:150px;padding:0 2px">'
      + order.map(function (g) {
          return order.length > 1 && g ? '<optgroup label="' + esc(g) + '">' + groups[g].map(opt).join("") + "</optgroup>"
            : groups[g].map(opt).join(""); }).join("")
      + "</select></span>";
  }
  function scTypeGroup(n) { return "scene_" + n + "_type_group"; }
  function scTypeOf(r) {
    var a = r && r.anchor === "last" ? "first" : ((r && r.anchor) || "reference");
    return SC_TYPES.indexOf(a) >= 0 ? a : "reference";
  }
  function scFlSlot(r, slot) {
    var cur = r["fl_" + slot];
    return '<span style="display:inline-flex;gap:3px;align-items:center;flex:none;'
      + 'border:1px dashed #3a4050;border-radius:4px;padding:2px 4px" data-scfl="' + r.n + '" data-slot="' + slot + '">'
      /* 2.302.0 (Tim: "add a trim first frame checkbox to the left of the
         first frame label in each scene ... i want to make the merge
         seamless"): the take's first frame repeats the frame it starts on -
         checked, it renders one more frame and drops that first one from
         the take and its lossless master (same length, no visible jump) */
      + (slot === "first"
          ? '<input type="checkbox" data-sctrim="' + r.n + '" ' + (r.trim_first ? "checked " : "")
            + 'title="Trim first frame - this scene\'s first frame repeats the frame it starts on; '
            + 'checked, one extra frame is rendered and the first one is dropped from the take and its '
            + 'lossless master (same length, no visible jump at the join)" '
            + 'aria-label="Trim the first frame of scene ' + r.n + '" style="margin:0;flex:none">'
          : "")
      + '<span class="hint" style="font-size:.66rem">' + (slot === "first" ? "First" : "Last") + " frame</span>"
      + (cur
          ? '<span style="position:relative;display:inline-block">'
            + '<img src="/api/scenes/' + r.n + "/fl/" + slot + "?v=" + encodeURIComponent(cur.label || cur.file) + '" '
            + 'alt="' + esc(cur.label || cur.file) + '" title="Scene ' + r.n + " " + slot + " frame: "
            + esc(cur.label || cur.file) + '" style="height:36px;border-radius:3px;display:block">'
            + '<button class="ghost" data-scfldel="' + r.n + '" data-slot="' + slot + '" '
            + 'title="Remove the ' + slot + ' frame (scene ' + r.n + ' falls back to '
            + (slot === "first" ? "the previous scene\'s frame" : "no set end - Trans uses its location picture") + ')" '
            + 'aria-label="Remove the ' + slot + ' frame of scene ' + r.n + '" '
            + 'style="position:absolute;top:-5px;right:-5px;width:16px;height:16px;padding:0;'
            + 'font-size:.6rem;line-height:1;border-radius:50%">✕</button></span>'
          : "")
      + '<button class="ghost gbtn" data-scflpick="' + r.n + '" data-slot="' + slot + '" type="button" '
      + 'title="Choose scene ' + r.n + '\'s ' + slot + ' frame - a frame of any rendered scene, a gallery picture, an image asset or a file" '
      + 'aria-label="Choose the ' + slot + ' frame of scene ' + r.n + '" style="font-size:.66rem">'
      + (cur ? "change" : "choose…") + "</button></span>";
  }
  /* 2.352.0 (Tim: "can we incorporate viggle into these worklows but make it
     a new viggle workflow?"): on the H3_Viggle board each scene has a 🎬
     Motion video - the clip whose movement the character performs (Ref: the
     first cast sheet, First / Cont / Trans: the frame it starts on) */
  function scMotionSlot(r) {
    var m = r.motion;
    return '<span style="display:inline-flex;gap:3px;align-items:center;flex:none;'
      + 'border:1px dashed #5a4a70;border-radius:4px;padding:2px 4px" data-scmotion="' + r.n + '">'
      + '<span class="hint" style="font-size:.66rem">🎬 Motion</span>'
      + (m
          ? '<span class="hint" data-scmotionname="' + r.n + '" style="font-size:.66rem;max-width:160px;overflow:hidden;'
            + 'text-overflow:ellipsis;white-space:nowrap" title="' + esc(m.label || m.file) + '">' + esc(m.label || m.file) + "</span>"
            + '<button class="ghost" data-scmotiondel="' + r.n + '" title="Remove scene ' + r.n + '\'s motion video" '
            + 'aria-label="Remove the motion video of scene ' + r.n + '" style="width:16px;height:16px;padding:0;'
            + 'font-size:.6rem;line-height:1;border-radius:50%">✕</button>'
          : '<span class="hint" style="font-size:.66rem;color:#e0a040">none - H3_Viggle needs one</span>')
      + '<button class="ghost gbtn" data-scmotionpick="' + r.n + '" type="button" '
      + 'title="Choose scene ' + r.n + '\'s motion video - the clip whose movement the character performs '
      + '(a video in the project, a rendered take, or a file)" aria-label="Choose the motion video of scene ' + r.n + '" '
      + 'style="font-size:.66rem">' + (m ? "change" : "choose…") + "</button></span>";
  }
  function scMotionPicker(n) {
    var old = document.getElementById("scMotionPick");
    if (old) old.remove();
    var ov = document.createElement("div");
    ov.id = "scMotionPick";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-label", "Choose scene " + n + "'s motion video");
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;"
      + "display:flex;align-items:center;justify-content:center";
    ov.innerHTML = '<div style="background:#1b1e25;border:1px solid #333;border-radius:6px;'
      + 'padding:10px;width:min(620px,94vw);max-height:80vh;display:flex;flex-direction:column;gap:6px">'
      + '<div style="display:flex;gap:6px;align-items:center;font-weight:600">'
      + '<span style="flex:1">Scene ' + n + ' — the 🎬 motion video (its movement is performed)</span>'
      + '<button class="ghost gbtn" data-mvclose type="button" aria-label="Close">✕</button></div>'
      + '<div style="display:flex;gap:4px">'
      + ["project", "takes", "file"].map(function (t) {
          return '<button class="ghost gbtn" data-mvtab="' + t + '" type="button" style="font-size:.72rem">'
            + { project: "📁 Project videos", takes: "🎞 Takes", file: "⤒ File" }[t] + "</button>";
        }).join("") + "</div>"
      + '<div data-mvbody style="overflow:auto;display:flex;flex-direction:column;gap:3px;min-height:80px"></div>'
      + '<div class="hint" data-mvnote></div></div>';
    document.body.appendChild(ov);
    var body = ov.querySelector("[data-mvbody]"), note = ov.querySelector("[data-mvnote]");
    var close = function () { ov.remove(); };
    ov.querySelector("[data-mvclose]").addEventListener("click", close);
    ov.addEventListener("click", function (ev) { if (ev.target === ov) close(); });
    var choose = function (payload) {
      note.textContent = "setting…";
      scPost("/api/scenes/" + n + "/motion", payload).then(function (d) {
        if (d && d.error) { note.textContent = "⚠ " + d.error; return; }
        close(); scRefresh();
      }).catch(function (e) { note.textContent = String(e); });
    };
    var row = function (label, title, onPick, attr) {
      var b = document.createElement("button");
      b.className = "ghost gbtn"; b.type = "button"; b.style.cssText = "font-size:.72rem;text-align:left";
      b.textContent = label; b.title = title;
      if (attr) b.setAttribute(attr[0], attr[1]);
      b.addEventListener("click", onPick);
      body.appendChild(b);
    };
    var tabs = {
      project: function () {
        var lister = window.bgMedia ? window.bgMedia.load("video")
          : fetch("/api/passets").then(function (r2) { return r2.json(); })
              .then(function (j) { return (j && j.video || []).map(function (f) {
                return { name: f.name || f, rel: "video/" + (f.name || f), group: "Assets", asset: true }; }); });
        lister.then(function (list) {
          list = list || [];
          if (!list.length) { body.innerHTML = '<span class="hint">no videos in this project yet - ⤒ File adds one</span>'; return; }
          list.forEach(function (x) {
            row((x.group ? x.group + " — " : "") + x.name, x.rel, function () {
              choose(x.asset ? { kind: "asset", name: x.name } : { kind: "project", rel: x.rel });
            }, ["data-mvrel", x.rel]);
          });
        }).catch(function () { note.textContent = "could not scan the project"; });
      },
      takes: function () {
        var done = (scState.list || []).filter(function (x) { return x.output && x.status !== "running" && x.n !== n; });
        if (!done.length) { body.innerHTML = '<span class="hint">no rendered scenes yet</span>'; return; }
        done.forEach(function (x) {
          row("Scene " + x.n + " — " + x.output, "use scene " + x.n + "'s take as the motion",
            function () { choose({ kind: "take", scene: x.n }); }, ["data-mvtake", String(x.n)]);
        });
      },
      file: function () {
        var inp = document.createElement("input");
        inp.type = "file"; inp.accept = "video/*";
        inp.setAttribute("aria-label", "Motion video for scene " + n);
        inp.addEventListener("change", function () {
          if (!inp.files || !inp.files[0]) return;
          var fd = new FormData();
          fd.append("video", inp.files[0]);
          note.textContent = "uploading…";
          fetch("/api/scenes/" + n + "/motion/upload", { method: "POST", body: fd })
            .then(function (r2) { return r2.json(); })
            .then(function (d) {
              if (d.error) { note.textContent = "⚠ " + d.error; return; }
              el("scNotes").textContent = d.note || "";
              close(); scRefresh();
            }).catch(function (e) { note.textContent = String(e); });
        });
        body.appendChild(inp);
      },
    };
    Array.prototype.forEach.call(ov.querySelectorAll("[data-mvtab]"), function (b) {
      b.addEventListener("click", function () { body.innerHTML = ""; note.textContent = ""; tabs[b.dataset.mvtab](); });
    });
    tabs.project();
    return ov;
  }
  function scBelowBlock(r) {
    var a = r.anchor === "last" ? "first" : (r.anchor || "reference");
    /* 2.299.0 (Tim: "add a last frame option to each scene fl2va will use
       last frame too if it is set"): EVERY scene has a Last frame - First
       and Trans end on it exactly (fl2va), Ref and Cont carry it as their
       closing picture; Ref has no First (it re-establishes) */
    var slots = a === "reference" ? ["last"] : ["first", "last"];
    return '<div data-scbelow="' + r.n + '" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
      + (scState.style === "H3_Viggle" ? scMotionSlot(r) : "")
      + slots.map(function (sl) { return scFlSlot(r, sl); }).join("")
      /* 2.295.0 (Tim: "allow user to add reference images to each scene
         individually"): THIS scene's own pictures - they ride only this
         scene's render (right after the cast sheets), and a Trans scene
         travels to the first of them */
      + '<div data-screfs="' + r.n + '" style="display:flex;gap:4px;align-items:center;'
      + 'flex-wrap:wrap;margin-top:3px">'
      + (r.refs || []).map(function (x) {
          return '<span style="position:relative;display:inline-block;flex:none">'
            + '<img src="/api/scenes/' + r.n + "/refs/" + encodeURIComponent(x.file) + '" '
            + 'alt="' + esc(x.label || x.file) + '" title="Scene ' + r.n + ' picture: '
            + esc(x.label || x.file) + '" style="height:36px;border-radius:3px;display:block">'
            + '<button class="ghost" data-screfdel="' + r.n + '" data-file="' + esc(x.file) + '" '
            + 'title="Remove this picture from scene ' + r.n + '" aria-label="Remove '
            + esc(x.label || x.file) + ' from scene ' + r.n + '" '
            + 'style="position:absolute;top:-5px;right:-5px;width:16px;height:16px;'
            + 'padding:0;font-size:.6rem;line-height:1;border-radius:50%">✕</button></span>';
        }).join("")
      + '<button class="ghost gbtn" data-screfadd="' + r.n + '" type="button" '
      + 'title="Add reference pictures to scene ' + r.n + ' only (a prop, a location, a pose, an outfit) - '
      + 'they ride this scene\'s render; a Trans scene travels to the first one" '
      + 'aria-label="Add reference pictures to scene ' + r.n + '" style="font-size:.7rem">＋🖼</button>'
      // 2.298.0: or pick one already in the project (characters, locations, ...)
      + '<button class="ghost gbtn" data-scflpick="' + r.n + '" data-slot="ref" type="button" '
      + 'title="Add a picture that is already in the project - assets, gallery, character sheets, locations, references - to scene ' + r.n + '" '
      + 'aria-label="Add a project picture to scene ' + r.n + '" style="font-size:.7rem">＋📁</button>'
      + '<input type="file" data-screffile="' + r.n + '" accept="image/*" multiple '
      + 'style="display:none" aria-label="Pictures for scene ' + r.n + '">'
      + "</div>"                                  // the pictures
      + "</div>";                                 // the below block
  }

  function scCard(r) {
    // the whole prompt is EDITABLE on the card (2.146.0, by instruction):
    // a textarea holding every line, an icon-only 💾 beside it. Clicks in
    // the editor must not re-select the card (stopPropagation on wire-up).
    /* 2.299.0 (Tim: "remove the chapter drowndown from each scene"): the
       card no longer carries a chapter <select> - a scene's chapter still
       shows in its title (set by the writer, a chapter load or ＋ chapter) */
    /* 2.295.0 (Tim: "after the scene renders put the filmstrip below the
       rendered scene. it is putting it on the scene box"): the card is a
       COLUMN - the scene's row on top, its filmstrip underneath at full
       width (it used to be squeezed into the row itself). */
    return '<div class="sccard" data-sc="' + r.n + '" style="display:flex;'
      + 'flex-direction:column;gap:4px;padding:6px;border-bottom:1px solid #262a33;cursor:pointer'
      + (scSel === r.n ? ";background:#20242c" : "") + '">'
      + '<div style="display:flex;gap:8px;align-items:center">'
      + '<input type="checkbox" data-scsel="' + r.n + '" '
      + (scChecked[r.n] ? "checked " : "")
      + 'title="Select scene ' + r.n + ' for ▶ Selected" '
      + 'aria-label="Select scene ' + r.n + '" style="flex:none">'
      /* 2.307.0 (Tim: "after a scene renders, change the play button to
         redo, rerun the render as scene_n_x"): once a scene has a take
         the ▶ becomes ↻ - a new take, filed as scene_<n>_<x> beside the
         others (lib/scenes.takeName); the old take stays in Video assets */
      + '<button class="ghost gbtn" data-scplay="' + r.n + '" '
      + (r.output && r.status !== "running" ? 'data-scredo="1" ' : "")
      + (r.status === "running" ? "disabled " : "")
      + (r.output && r.status !== "running"
          ? 'title="Redo scene ' + r.n + ' - render a new take (saved as scene_' + r.n
            + '_2, _3 ...; the current take stays in Video assets)" aria-label="Redo scene ' + r.n + '" '
          : 'title="Generate scene ' + r.n + '" aria-label="Generate scene ' + r.n + '" ')
      + 'style="width:34px;height:34px;border-radius:50%;flex:none">'
      + (r.status === "running" ? "⏳" : r.output ? "↻" : "▶") + "</button>"
      + (r.output && r.status !== "running"
          ? '<button class="ghost gbtn" data-scup="' + r.n + '" '
            + (r.upjob ? "disabled " : "")
            + 'title="Upscale scene ' + r.n + '\'s take with the ⚙ Upscaler (the take you previewed - no new render; queued one at a time)" '
            + 'aria-label="Upscale scene ' + r.n + '" '
            + 'style="width:28px;height:28px;border-radius:50%;flex:none">⏫</button>'
          : "")
      + '<div style="flex:1;min-width:0">'
      /* 2.288.0: the TITLEBAR - name on the left, the ANCHOR radios on
         the right: how this scene's incoming picture lands (a style
         REFERENCE, the FIRST frame, or the LAST frame - first/last use
         fl2va when the style brings one). */
      + '<div style="display:flex;gap:8px;align-items:center;font-weight:600">'
      + '<span style="flex:1;min-width:0">Scene ' + r.n
      + (r.chapter ? ' · ' + esc(r.chapter) : "")
      + (r.bridge ? ' <span class="hint" style="font-weight:400">· ⇄ bridge</span>' : "") + "</span>"
      /* 2.299.2 (Tim: "let the user select from the radio group for each
         scene ref, first, cont, trans, check to see if it a valid group,
         make the group name scene_<n>_type_group"): ONE radio group per
         scene, named scene_<n>_type_group, each radio with its own id and
         a label FOR it. The group stops the click from reaching the card:
         the card's click re-selects and REPAINTS the list, which replaced
         the radio before its change could fire - the pick never landed. */
      + (r.bridge ? scBridgeSel(r) + "</div>" : '<span role="radiogroup" data-scanchorgroup="' + r.n + '" '
      + 'aria-label="Scene ' + r.n + ' type" '
      + 'style="display:flex;gap:6px;font-weight:400;font-size:.68rem;flex:none" '
      + 'title="How this scene follows the one before: Ref = ref2va for a new location/character (its sheets and location pictures; on MMH3_NativeAudio_MV the previous take\'s end rides as the transition video) · First = fl2va, the clip starts EXACTLY on the frame picked on the scene before\'s filmstrip (else its last frame) - but fl2va carries no character sheets · Cont = ref2va opening on that frame as its first picture WITH the cast sheets, so the character stays when the frame shows no face (opens close to the frame, not pixel-exact) · Trans = fl2va from that frame to the new location\'s picture">'
      + SC_TYPES.map(function (a) {
          var gid = scTypeGroup(r.n), id = "scene_" + r.n + "_type_" + a;
          return '<label for="' + id + '" style="display:flex;gap:2px;align-items:center;cursor:pointer">'
            + '<input type="radio" id="' + id + '" name="' + gid + '" data-scanchor="'
            + r.n + '" value="' + a + '" '
            + (scTypeOf(r) === a ? "checked " : "") + ">"
            + (a === "reference" ? "Ref" : a === "first" ? "First" : a === "continue" ? "Cont" : "Trans")
            + "</label>";
        }).join("")
      + "</span></div>")
      + '<textarea data-scedit="' + r.n + '" rows="3" '
      + 'title="Edit scene ' + r.n + "'s prompt — 💾 saves it\" "
      + 'aria-label="Prompt for scene ' + r.n + '" '
      + 'style="width:100%;resize:vertical;font:inherit">'
      + esc((r.prompt || []).join("\n")) + "</textarea>"
      + '<div class="hint">' + scBadge(r) + "</div>"
      // 2.384.0: the progress bar while the scene renders
      + (r.status === "running" && r.progress && !r.progress.queued
          ? '<div class="scprog" data-scprog="' + r.n + '" role="progressbar" aria-label="Scene ' + r.n + ' render progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (r.progress.pct || 0) + '">'
            + '<i style="width:' + (r.progress.pct || 0) + '%"></i></div>' : "")
      + (r.error ? '<div class="hint" style="color:#e66">⚠ ' + esc(r.error) + "</div>" : "")
      + "</div>"                                  // the main column
      + '<div style="display:flex;flex-direction:column;gap:4px;flex:none">'
      /* 2.288.0: the scene's AUDIO WINDOW - start + duration in seconds,
         fed straight into the graph's TrimAudioDuration (the board's one
         song is the source; no segment files). Blank = the .seg map's
         slot for this scene. */
      + '<input type="number" step="0.1" min="0" data-scastart="' + r.n + '" '
      + 'value="' + (r.audio_start != null ? r.audio_start : "") + '" '
      + 'placeholder="start" title="Audio window START (seconds into the song) - blank uses the .seg map" '
      + 'aria-label="Audio start for scene ' + r.n + '" '
      + 'style="width:58px;font-size:.7rem;padding:1px 3px">'
      + '<input type="number" step="0.1" min="0.1" data-scadur="' + r.n + '" '
      + 'value="' + (r.audio_dur != null ? r.audio_dur : "") + '" '
      + 'placeholder="dur" title="Audio window DURATION (seconds) - blank uses the .seg map" '
      + 'aria-label="Audio duration for scene ' + r.n + '" '
      + 'style="width:58px;font-size:.7rem;padding:1px 3px">'
      /* 2.384.0 (Tim: "add the seed input to the scenes in videodocker too, so user can reuse scene"): the scene's
         OWN seed (blank = the ⚙ rule); ♻ puts in the seed its last take used */
      + '<div style="display:flex;gap:2px;align-items:center">'
      + '<input type="number" min="0" step="1" data-scseed="' + r.n + '" '
      + 'value="' + (r.user_seed != null ? r.user_seed : "") + '" placeholder="seed" '
      + 'title="Scene ' + r.n + '\'s own seed - blank: the StoryBoard\'s ⚙ rule (a fresh random seed, or the same seed for every scene)'
      + (r.seed_used != null ? ". Its last take used " + r.seed_used : "") + '" '
      + 'aria-label="Seed for scene ' + r.n + '" style="width:58px;font-size:.7rem;padding:1px 3px">'
      + (r.seed_used != null && Number.isSafeInteger(Number(r.seed_used))
          ? '<button class="ghost" data-scseeduse="' + r.n + '" data-seed="' + r.seed_used + '" type="button" '
            + 'title="Reuse the seed scene ' + r.n + '\'s last take used (' + r.seed_used + ')" '
            + 'aria-label="Reuse scene ' + r.n + '\'s last seed" style="padding:0 3px;font-size:.7rem">♻</button>' : "")
      + "</div>"
      + '<button class="ghost gbtn" data-scsave="' + r.n + '" '
      + 'title="Save scene ' + r.n + "'s prompt\" "
      + 'aria-label="Save the prompt for scene ' + r.n + '">💾</button>'
      // EDIT DIALOG (2.179.0, by instruction: "add an edit button to each
      // scene... open a dialog with an editor for the scene") — the big
      // desk for a prompt the inline strip is too small for
      /* 2.297.0 (Tim: "add option for user to insert scene"): a new
         scene right after this one (scene 1 can also get one before it) */
      + '<button class="ghost gbtn" data-scins="' + r.n + '" type="button" '
      + 'title="Insert a new scene after scene ' + r.n + ' - it starts where this one ends and the later scenes move along" '
      + 'aria-label="Insert a scene after scene ' + r.n + '">⊕</button>'
      + (r.n === 1 ? '<button class="ghost gbtn" data-scins="0" type="button" '
          + 'title="Insert a new scene BEFORE scene 1" aria-label="Insert a scene before scene 1">⊕↑</button>' : "")
      + '<button class="ghost gbtn" data-scmodal="' + r.n + '" '
      + 'title="Edit scene ' + r.n + ' in a large editor dialog" '
      + 'aria-label="Open the editor dialog for scene ' + r.n + '">✎</button>'
      // NO PER-CARD DURATION (2.171.0, by instruction): every scene uses
      // the ONE default duration (#scDefDur) — the workflow doesn't like
      // scenes of different lengths.
      + "</div>"
      + "</div>"                                  // end of the scene's row
      + scBelowBlock(r)                           // 2.297.0: F/L slots + pictures
      // 2.337.0: ✎ First frame (Qwen 2.1) - the accordion (ext/videodock/qedit.js)
      + (window.ScQedit ? window.ScQedit.block(r) : "")
      /* 2.288.0 / 2.295.0: the FILMSTRIP - UNDER the scene, OPEN by itself
         once the take has rendered (Tim: "expand the frames
         automatically"); clicking a frame makes it the FIRST frame of the
         next scene (its anchor radio says how it lands). The picked frame
         is outlined; with none picked the next scene starts on the last. */
      + (r.output && r.status !== "running" ? scStripBlock(r) : "")
      + "</div>";
  }

  /** An edit in progress must survive the 4-second poll: while the focus is
   *  inside the shared prompt or a card's editor, repainting would wipe the
   *  user's unsaved text mid-keystroke. The next refresh paints instead. */
  /** The header checkbox mirrors reality: checked only when EVERY scene is. */
  function scSyncSelAll() {
    var all = el("scSelAll");
    if (!all) return;
    var list = scState.list || [];
    all.checked = list.length > 0 && list.every(function (r) { return scChecked[r.n]; });
  }

  /* 2.548.0: the shared prompt as the server last had it; the box differs = an edit not kept yet */
  var scPrefixKept = null, scPrefixT = 0, scPrefixBusy = false;
  function scPrefixDirty() { var t = el("scPrefix"); return !!t && scPrefixKept !== null && t.value !== scPrefixKept; }
  function scPrefixKeep(loud) {
    var t = el("scPrefix"); if (!t || scPrefixBusy) return;
    if (!loud && !scPrefixDirty()) return;
    var text = t.value; scPrefixBusy = true; clearTimeout(scPrefixT);
    scPost("/api/scenes/prefix", { text: text })
      .then(function (d) {
        if (d && d.ok) {
          scPrefixKept = text;
          if (d.plan) scState.plan = d.plan;
          el("scNotes").textContent = loud ? "shared prompt saved" : "shared prompt kept";
          if (window.H3TestEvent) { try { window.H3TestEvent("sc_prefix_kept", String(text.length)); } catch (e) { /* the 🧪 list */ } }
        }
      })
      .catch(function () { /* scPost said why */ })
      .then(function () { scPrefixBusy = false; });
  }
  function scEditing() {
    var a = document.activeElement;
    return !!a && (a.id === "scPrefix"
                   || (a.matches && a.matches("[data-scedit], [data-scseed]"))
                   || !!(window.ScQedit && window.ScQedit.editing()));   // 2.337.0
  }

  /* 2.288.0: the board's ONE song - the pick posted to /api/scenes/audio.
     2.298.0 (Tim: "scan the projects subfolders for images and music and
     videos before adding it to a dropdown. scan for assets, characters,
     locations etc."): the options are EVERY song in the project, grouped
     by folder (window.bgMedia, static/pmedia.js), rescanned each time the
     dropdown is opened; a song outside the sound assets is adopted into
     them (a hard link) before it becomes the board's song. */
  (function wireBoardAudio() {
    var sel = el("vdAudio");
    if (!sel) return;
    var last = 0;
    function fillSongs() {
      if (Date.now() - last < 2000) return;
      last = Date.now();
      var keep = (scState && scState.audio) || sel.value || "";
      if (window.bgMedia) {
        window.bgMedia.load("sound").then(function (list) {
          if (sel.matches && sel.matches(":focus") && sel.options.length > 1
              && sel.dataset.scanned === "1") return;
          window.bgMedia.fill(sel, list, { placeholder: "—", keep: keep });
          sel.dataset.scanned = "1";
        }).catch(function () {});
        return;
      }
      fetch("/api/passets").then(function (r) { return r.json(); })
        .then(function (j) {
          var sounds = (j && (j.sound || j.sounds)) || [];
          sel.innerHTML = '<option value="">—</option>';
          sounds.forEach(function (f) {
            var name = typeof f === "string" ? f : f.name;
            if (!name) return;
            var o = document.createElement("option");
            o.value = name; o.textContent = name;
            sel.appendChild(o);
          });
          sel.value = keep;
        }).catch(function () {});
    }
    fillSongs();
    // rescan as the pointer arrives (before the list opens) or on keyboard
    // focus; an OPEN list is never rebuilt under the user
    sel.addEventListener("mouseenter", fillSongs);
    sel.addEventListener("focus", fillSongs);
    sel.addEventListener("change", function () {
      var pick = sel.value;
      (window.bgMedia ? window.bgMedia.resolve(pick) : Promise.resolve(pick))
        .then(function (name) {
          last = 0;
          return scPost("/api/scenes/audio", { file: name });
        }).then(function () { last = 0; fillSongs(); })
        .catch(function (e) { el("scNotes").textContent = "⚠ " + (e.message || e); });
    });
  })();
  /* 2.289.0: the song strip (audioseg.js) staged scenes or set the board
     song - it says so with this event and the board repaints from the
     server, so the cards' start/duration inputs show the new windows. */
  document.addEventListener("vd:scenes-changed", function () { scRefresh(); });
  /* 2.391.1 (Tim: "put the scenes in a dropdown" - "Both"): the scene PICKER over the board - "All scenes" or one
     scene's card only. The choice is kept per browser (localStorage h3.scpick); a scene that is gone = All again. The
     options say each scene's state (⏳ rendering, ● rendered, ✔ kept, ✕ failed) and the first words of its prompt. */
  var SC_PICK_KEY = "h3.scpick";
  function scPickGet() { try { return window.localStorage.getItem(SC_PICK_KEY) || ""; } catch (e) { return ""; } }
  function scPickSet(v) { try { window.localStorage.setItem(SC_PICK_KEY, v || ""); } catch (e) { /* private window */ } }
  function scPickLabel(r) {
    var words = "";
    (r.prompt || []).some(function (l) { words = String(l || "").replace(/^\s*\[[^\]]*\]\s*/, "").replace(/\s+/g, " ").trim(); return !!words; });
    words = words.slice(0, 42);
    var mark = r.status === "running" ? "⏳ " : r.error && r.status !== "kept" && r.status !== "rendered" ? "✕ "
      : r.status === "kept" ? "✔ " : r.status === "rendered" ? "● " : "";
    return mark + "Scene " + r.n + (words ? " · " + words : "");
  }
  function scPickApply() {
    var v = el("scPick") ? el("scPick").value : "";
    var cards = el("scList") ? el("scList").querySelectorAll(".sccard[data-sc]") : [];
    for (var i = 0; i < cards.length; i++) cards[i].style.display = !v || cards[i].getAttribute("data-sc") === v ? "flex" : "none";
  }
  function scPickPaint(list) {
    var s = el("scPick"); if (!s) return;
    var want = scPickGet();
    if (want && !list.some(function (r) { return String(r.n) === want; })) { want = ""; scPickSet(""); }
    s.innerHTML = '<option value="">All scenes' + (list.length ? " (" + list.length + ")" : "") + "</option>"
      + list.map(function (r) { return '<option value="' + r.n + '">' + esc(scPickLabel(r)) + "</option>"; }).join("");
    s.value = want;
    el("scPickRow").style.display = list.length ? "" : "none";
    scPickApply();
  }
  function scPickStep(d) {
    var s = el("scPick"); if (!s || s.options.length < 2) return;
    var i = s.selectedIndex + d;
    if (i < 1) i = d < 0 ? s.options.length - 1 : 1;
    if (i >= s.options.length) i = 1;
    s.selectedIndex = i; scPickSet(s.value); scPickApply();
  }

  function scPaint() {
    if (scEditing()) return;          // never wipe an unsaved edit mid-keystroke
    var list = scState.list || [];
    if (el("scSecCount")) {                   // 2.391.1: the Scenes dropdown's title counts them
      var nRun = list.filter(function (r) { return r.status === "running"; }).length;
      el("scSecCount").textContent = list.length ? "(" + list.length + (nRun ? " · " + nRun + " rendering" : "") + ")" : "";
    }
    el("scList").innerHTML = list.length ? list.map(scCard).join("")
      : '<div class="modehint">No scenes yet. Press ＋ Scene, or ask the '
        + 'assistant to “create a screenplay”.</div>';
    scPickPaint(list);
    // 2.548.0: an edit not saved yet is never painted over (the next poll used to put the stored text back the
    // moment the box lost focus - the @tags / references typed into it were gone)
    if (el("scPrefix") && !scPrefixDirty()) {
      el("scPrefix").value = ((scState.plan || {}).prompt_prefix || []).join("\n");
      scPrefixKept = el("scPrefix").value;
    }
    // — a restart, a project switch or another tab's change all paint true
    // 2.223.16: the style pick mirrors the persisted board state too
    /* 2.323.0: a board still on a looping chain ("" / MM3_Characters /
       MMH3_Music_Video / any other style) moves to the native flow once -
       the looping workflows are retired; scenes, characters, sheets,
       voices, refmods and tags all carry over */
    if (VD_FLOW_IDS.indexOf(scState.style || "") < 0 && !scFlowMoved) {
      scFlowMoved = true;
      var was = scState.style || "Character chain";
      scState.style = VD_FLOWS[0][0];
      scPost("/api/scenes/style", { name: VD_FLOWS[0][0] }).then(function () {
        el("scNotes").textContent = "the looping workflow (" + was + ") is retired - this board now renders "
          + "scene by scene: Ref / Cont through ref2va, First / Trans through fl2va, with the same "
          + "characters, sheets, voices and @tags";
      });
    }
    if (el("scStyleSel")) el("scStyleSel").value = scState.style || VD_FLOWS[0][0];
    if (el("vdWorkflow")) el("vdWorkflow").value = scState.style || VD_FLOWS[0][0];
    if (typeof scCountPaint === "function") scCountPaint();
    if (el("vdAudio")) el("vdAudio").value = scState.audio || "";
    if (el("vdAutoRender")) el("vdAutoRender").checked = scState.auto_render === true;
    // 2.289.0: the song strip (audioseg.js) follows the board's song
    try { document.dispatchEvent(new CustomEvent("vd:board-song",
      { detail: scState.audio || "" })); } catch (e) {}
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scplay]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation(); scGenerate(b.dataset.scplay); }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scup]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        scPost("/api/scenes/" + b.dataset.scup + "/upscale"); }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scedit]"),
      function (t) { t.addEventListener("click", function (ev) { ev.stopPropagation(); }); });
    /* 2.288.0: anchor radios, audio-window inputs, and the filmstrip. */
    // 2.299.2: clicks inside a scene's type group never reach the card
    // (its select-and-repaint swallowed the pick)
    // 2.358.0: a bridge's type picker
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scbridgegroup]"),
      function (g) { g.addEventListener("click", function (ev) { ev.stopPropagation(); }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scbridge]"),
      function (b) { b.addEventListener("change", function (ev) {
        ev.stopPropagation();
        scPost("/api/scenes/" + b.dataset.scbridge + "/bridge", { type: b.value });
      }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scanchorgroup]"),
      function (g) { g.addEventListener("click", function (ev) { ev.stopPropagation(); }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scanchor]"),
      function (b) { b.addEventListener("change", function (ev) {
        ev.stopPropagation();
        if (!b.checked) return;
        var n = parseInt(b.dataset.scanchor, 10);
        // a VALID group: this scene's own name and one of the four types
        if (b.name !== scTypeGroup(n) || SC_TYPES.indexOf(b.value) < 0) {
          el("scNotes").textContent = "⚠ scene " + n + ": \"" + b.value
            + "\" is not a scene type (Ref, First, Cont or Trans)";
          return;
        }
        // the card shows the pick at once (its First/Last slots follow it),
        // the server keeps it; a refusal repaints the stored type back
        var row = (scState.list || []).find(function (x) { return x.n === n; });
        if (row) { row.anchor = b.value; scPaint(); }
        scPost("/api/scenes/" + n + "/anchor", { anchor: b.value })
          .then(function (d) {
            if (d && d.ok) el("scNotes").textContent = "scene " + n + " is "
              + ({ reference: "Ref", first: "First", continue: "Cont", transition: "Trans" })[d.anchor];
          }); }); });
    function postWin(n) {
      var a = el("scList").querySelector('[data-scastart="' + n + '"]');
      var d = el("scList").querySelector('[data-scadur="' + n + '"]');
      scPost("/api/scenes/" + n + "/audio",
             { start: a && a.value !== "" ? +a.value : null,
               dur: d && d.value !== "" ? +d.value : null });
    }
    // 2.384.0: a scene's own seed - saved on change; ♻ = the seed its last take used
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scseed]"), function (b) {
      b.addEventListener("click", function (ev) { ev.stopPropagation(); });
      b.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
      b.addEventListener("change", function (ev) {
        ev.stopPropagation();
        scPost("/api/scenes/" + b.getAttribute("data-scseed") + "/seed", { seed: b.value === "" ? null : +b.value });
      });
    });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scseeduse]"), function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        scPost("/api/scenes/" + b.getAttribute("data-scseeduse") + "/seed", { seed: +b.getAttribute("data-seed") });
      });
    });
    ["data-scastart", "data-scadur"].forEach(function (attr) {
      Array.prototype.forEach.call(el("scList").querySelectorAll("[" + attr + "]"),
        function (b) {
          b.addEventListener("click", function (ev) { ev.stopPropagation(); });
          b.addEventListener("change", function (ev) {
            ev.stopPropagation();
            postWin(b.getAttribute(attr)); });
        });
    });
    // 2.300.1: ◀ / ▶ page through a strip; the wheel scrolls it sideways;
    // its position is remembered per scene across repaints
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scstripnav]"),
      function (b) {
        b.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
        b.addEventListener("click", function (ev) {
          ev.stopPropagation();          // never the card's select-and-repaint
          var strip = el("scList").querySelector('[data-scstrip="' + b.dataset.scstripnav + '"]');
          if (!strip) return;
          strip._want = null;              // the user moves it now
          var step = Math.max(60, Math.round(strip.clientWidth * 0.8)) * (+b.dataset.dir < 0 ? -1 : 1);
          if (strip.scrollBy) strip.scrollBy({ left: step, behavior: "smooth" });
          else strip.scrollLeft += step;
        });
      });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scstrip]"),
      function (strip) {
        var n = parseInt(strip.dataset.scstrip, 10);
        strip.addEventListener("scroll", function () {
          if (strip._want != null) {             // still restoring: not the user's
            if (Math.abs(strip.scrollLeft - strip._want) > 1) { scStripNav(strip); return; }
            strip._want = null;
          }
          scStripPos[n] = strip.scrollLeft;
          scStripNav(strip);
        });
        strip.addEventListener("wheel", function (ev) {
          var d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
          var max = strip.scrollWidth - strip.clientWidth;
          if (!(max > 1) || !d) return;
          // at an end the wheel goes back to scrolling the scene list
          if ((d < 0 && strip.scrollLeft <= 0) || (d > 0 && strip.scrollLeft >= max - 1)) return;
          ev.preventDefault();
          strip._want = null;
          strip.scrollLeft += d;
        }, { passive: false });
      });
    // 2.295.0: the filmstrips open by themselves; 🎞 only hides/shows one
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scfilm]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var n = parseInt(b.dataset.scfilm, 10);
        scFilmHidden[n] = !scFilmHidden[n];
        scPaint();
      }); });
    scFillStrips();
    // 2.297.0: insert a scene; the FIRST / LAST frame slots
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scins]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        scPost("/api/scenes/insert", { after: parseInt(b.dataset.scins, 10) });
      }); });
    // 2.302.0: "trim first frame" - the card shows it at once, the board keeps it
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-sctrim]"),
      function (b) {
        b.addEventListener("click", function (ev) { ev.stopPropagation(); });
        b.addEventListener("change", function (ev) {
          ev.stopPropagation();
          var n = parseInt(b.dataset.sctrim, 10);
          var row = (scState.list || []).find(function (x) { return x.n === n; });
          if (row) row.trim_first = b.checked || undefined;
          scPost("/api/scenes/" + n + "/trim-first", { on: b.checked }).then(function (d) {
            if (d && d.ok) el("scNotes").textContent = "scene " + n + (d.trim_first
              ? ": its first frame is trimmed on the next render (one extra frame is rendered, so the length stays)"
              : ": its first frame is kept");
          });
        });
      });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scfldel]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        scPost("/api/scenes/" + b.dataset.scfldel + "/fl/delete", { slot: b.dataset.slot });
      }); });
    // 2.352.0: the H3_Viggle 🎬 motion video
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scmotionpick]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        scMotionPicker(parseInt(b.dataset.scmotionpick, 10));
      }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scmotiondel]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        fetch("/api/scenes/" + b.dataset.scmotiondel + "/motion", { method: "DELETE",
          headers: { "Content-Type": "application/json" }, body: "{}" })
          .then(function (r2) { return r2.json(); }).then(function () { scRefresh(); });
      }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scflpick]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        scFlPicker(parseInt(b.dataset.scflpick, 10), b.dataset.slot);
      }); });
    // 2.296.0: a frame of this take -> the next scene's pictures
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scframeref]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var body = {};
        if (b.dataset.sctime !== "") body.time = +b.dataset.sctime;
        scPost("/api/scenes/" + b.dataset.scframeref + "/frame-ref", body);
      }); });
    // 2.295.0: THIS scene's own reference pictures
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-screfadd]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var f = el("scList").querySelector('[data-screffile="' + b.dataset.screfadd + '"]');
        if (f) f.click();
      }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-screffile]"),
      function (f) {
        f.addEventListener("click", function (ev) { ev.stopPropagation(); });
        f.addEventListener("change", function () {
          if (!f.files || !f.files.length) return;
          var fd = new FormData();
          Array.prototype.forEach.call(f.files, function (x) { fd.append("images", x); });
          fetch("/api/scenes/" + f.dataset.screffile + "/refs", { method: "POST", body: fd })
            .then(function (r2) { return r2.json(); })
            .then(function (d) {
              el("scNotes").textContent = d.error ? "⚠ " + d.error
                : (d.note || "") + ((d.skipped || []).length
                  ? " · skipped: " + d.skipped.map(function (x) { return x.name + " (" + x.why + ")"; }).join(", ") : "");
              return scRefresh();
            }).catch(function (e) { el("scNotes").textContent = String(e); });
        });
      });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-screfdel]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        scPost("/api/scenes/" + b.dataset.screfdel + "/refs/delete", { file: b.dataset.file });
      }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scsave]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var t = el("scList").querySelector('[data-scedit="' + b.dataset.scsave + '"]');
        scPost("/api/scenes/" + b.dataset.scsave + "/prompt",
               { text: t ? t.value : "" }); }); });
    // EDIT DIALOG (2.179.0): ✎ opens #scEditDlg — sized by the SAME CSS
    // rule as #settings, so the two can never drift apart. The dialog reads
    // the freshest text from the card's inline editor (unsaved edits ride
    // along); Save posts the prompt and closes, Cancel just closes.
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scmodal]"),
      function (b) { b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var n = b.dataset.scmodal;
        var r = (scState.list || []).find(function (x) { return String(x.n) === String(n); }) || {};
        var t = el("scList").querySelector('[data-scedit="' + n + '"]');
        el("scEditTitle").textContent = "Scene " + n
          + (r.chapter ? " — " + r.chapter : "");
        el("scEditText").value = t ? t.value : (r.prompt || []).join("\n");
        el("scEditDlg").dataset.scene = n;
        el("scEditDlg").showModal(); }); });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-scsel]"),
      function (c) {
        c.addEventListener("click", function (ev) { ev.stopPropagation(); });
        c.addEventListener("change", function () {
          if (c.checked) scChecked[c.dataset.scsel] = true;
          else delete scChecked[c.dataset.scsel];
          scSyncSelAll();
        });
      });
    Array.prototype.forEach.call(el("scList").querySelectorAll("[data-sc]"),
      function (c) { c.addEventListener("click", function () {
        scSelect(parseInt(c.dataset.sc, 10)); }); });
    scSyncSelAll();
    scShowPreview();
    // 2.337.0: the ✎ First frame accordions (ext/videodock/qedit.js)
    if (window.ScQedit) window.ScQedit.bind(el("scList"), { refresh: scRefresh, picker: scFlPicker,
      note: function (t) { if (el("scNotes")) el("scNotes").textContent = t || ""; } });
  }

  /** 2.223.6 (by instruction: "don't show the preview in the video docker")
   *  — NOTHING plays inline any more. The take bar (▶ watch / ✔ keep /
   *  ↻ redo) shows when the selected scene has a take; ▶ opens the take
   *  in the floating scWatchDlg on demand, and closing it clears the src
   *  so the video stops instead of playing on silently. */
  function scTakeSrc() {
    var r = (scState.list || []).filter(function (x) { return x.n === scSel; })[0];
    return r && r.output
      ? "/passets/video/" + encodeURIComponent(r.upscaled || r.output) : "";
  }
  function scShowPreview() {
    el("scPrevBtns").style.display = scTakeSrc() ? "flex" : "none";
  }

  function scSelect(n) { scSel = n; scPaint(); scPaintRefs(); }

  // CHAPTER REFERENCE IMAGES (2.180.0, by instruction): 🖼＋ uploads an
  // image into the SELECTED scene's chapter; the strip under the header
  // shows that chapter's references with ✕ to remove. Each chapter keeps
  // its own set — the queue injects only the rendered chapter's refs.
  var scRefMap = {};
  function scSelChapter() {
    var r = (scState.list || []).find(function (x) { return x.n === scSel; });
    return r ? (r.chapter || "") : null;
  }
  // the ONE chapter resolution (2.181.0): selected scene's chapter, else
  // the chapter-name field beside the 🖼＋ button, else "" — the button
  // and the strip read the SAME answer
  function scRefChapter() {
    var ch = scSelChapter();
    if (ch !== null) return ch;
    var f = el("scChapName");
    return f && f.value ? f.value.trim() : "";
  }
  function scPaintRefs() {
    var strip = el("scRefStrip");
    if (!strip) return;
    var ch = scRefChapter();
    var list = scRefMap[ch] || [];
    var head = el("scRefHead");
    if (head) {
      head.style.display = list.length ? "flex" : "none";
      var cnt = el("scRefCount");
      if (cnt) cnt.textContent = list.length
        + (ch === "" ? " (no chapter)" : " — " + ch);
    }
    if (!list.length) { strip.style.display = "none"; strip.innerHTML = ""; return; }
    strip.style.display = "flex";
    // 2.198.0 (by instruction): THUMBNAILS in a dropdown, each editable —
    // click the picture to edit its name, type and description; ✕ removes.
    strip.innerHTML = list.map(function (e) {
      // 2.266.0: a SOUND reference has no picture — a 🎵 tile stands in,
      // same click-to-edit, same ✕
      var tile = e.kind === "sound"
        ? '<span class="refthumb" data-refedit="' + e.file + '" role="img" aria-label="sound @' + e.tag + '" '
          + 'title="🎵 @' + e.tag + (e.type ? " (" + e.type + ")" : "")
          + (e.description ? " — " + String(e.description).replace(/"/g, "&quot;").slice(0, 120) : "")
          + ' — a sound reference: the screenplay can have a character lipsync to it — click to edit" '
          + 'style="height:48px;width:48px;display:inline-flex;align-items:center;justify-content:center;'
          + 'font-size:22px;border-radius:6px;cursor:pointer;border:1px solid var(--line);background:#20242c">🎵</span>'
        : '<img class="refthumb" data-refedit="' + e.file + '" src="/api/scenes/refs/file?file='
          + encodeURIComponent(e.file) + '" alt="@' + e.tag + '" '
          + 'title="@' + e.tag + (e.type ? " (" + e.type + ")" : "")
          + (e.description ? " — " + String(e.description).replace(/"/g, "&quot;").slice(0, 120) : "")
          + ' — click to edit" '
          + 'style="height:48px;border-radius:6px;cursor:pointer;border:1px solid var(--line)">';
      return '<span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px">'
        + tile
        + '<span>@' + e.tag
        + ' <button class="ghost gbtn" data-refdel="' + e.file + '" '
        + 'title="Remove reference ' + e.file + ' from this chapter" '
        + 'aria-label="Remove reference ' + e.file + '">✕</button></span></span>';
    }).join(" ");
    Array.prototype.forEach.call(strip.querySelectorAll("[data-refedit]"),
      function (im) { im.addEventListener("click", function () {
        var e = (scRefMap[ch] || []).filter(function (x) { return x.file === im.dataset.refedit; })[0];
        if (!e) return;
        el("scRefTitle").textContent = "Edit reference @" + e.tag;
        el("scRefName").value = e.label || "";
        el("scRefType").value = e.type || "other";
        el("scRefDesc").value = e.description || "";
        el("scRefFile").value = "";
        el("scRefChap").textContent = (ch === ""
          ? "chapter: (un-chaptered scenes)" : "chapter: " + ch)
          + " · " + (e.kind === "sound" ? "sound: " : "picture: ") + e.file
          + " (the file itself does not change here)";
        el("scRefDlg").dataset.chapter = ch;
        el("scRefDlg").dataset.editFile = e.file;
        try { el("scRefDlg").showModal(); }
        catch (er) { el("scNotes").textContent = "dialog failed: " + er.message; }
      }); });
    Array.prototype.forEach.call(strip.querySelectorAll("[data-refdel]"),
      function (b) { b.addEventListener("click", function () {
        fetch("/api/scenes/refs?chapter=" + encodeURIComponent(ch)
              + "&file=" + encodeURIComponent(b.dataset.refdel),
              { method: "DELETE" })
          .then(function (r) { return r.json(); })
          .then(function (d) { scRefMap = d.refs || {}; scPaintRefs(); });
      }); });
  }
  function scLoadRefs() {
    fetch("/api/scenes/refs").then(function (r) { return r.json(); })
      .then(function (d) { scRefMap = d.refs || {}; scPaintRefs(); })
      .catch(function () {});
  }

  /* 2.357.0 (Tim: "does the native audio use the basic settings in the left
     docker? I would like to be able to change the resolution"): the left
     Basic Settings' width x height goes with every board render press; the
     server keeps it for the queued renders (the ⚙ Resolution still wins). */
  function scBasic() {
    var w = document.getElementById("width"), h = document.getElementById("height");
    var bw = w ? parseInt(w.value, 10) : NaN, bh = h ? parseInt(h.value, 10) : NaN;
    var out = bw > 0 && bh > 0 ? { width: bw, height: bh } : {};
    // 2.375.0 (Tim: "i don't think the overide style in basic settings is working for video generation - i set it
    // to 15 steps but it is still rendering 20 steps"): Override style + its Steps / CFG ride with every board ▶
    // (lib/renderSettings: ON = they beat the ⚙ and the workflow)
    var ov = document.getElementById("ovrStyle"), stp = document.getElementById("steps"), cf = document.getElementById("cfg");
    if (ov) {
      out.override = !!ov.checked;
      out.steps = stp ? parseInt(stp.value, 10) || 0 : 0;
      out.cfg = cf && cf.value !== "" ? parseFloat(cf.value) : null;
      var md = document.getElementById("vidModel");                    // 2.409.0: Basic Settings' model
      out.model = md ? md.value.trim() : "";
    }
    return Object.keys(out).length ? out : null;
  }
  function scWithBasic(body) {
    var b = body || {}, bs = scBasic();
    if (bs) b.basic = bs;
    return b;
  }
  function scPost(url, body) {
    return fetch(url, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) el("scNotes").textContent = "⚠ " + d.error
          + ((d.errors || []).length ? " · " + d.errors.join(" · ") : "")
          + ((d.notes || []).length ? " · " + d.notes.join(" · ") : "");
        else if (d.notes && d.notes.length) el("scNotes").textContent = d.notes.join(" · ");
        else if (d.note) el("scNotes").textContent = d.note;
        return d;
      })
      .then(function (d) { return scRefresh().then(function () { return d; }); })
      .catch(function (e) { el("scNotes").textContent = String(e); });
  }

  function scGenerate(n) {
    scSel = parseInt(n, 10);
    // ▶ CARRIES THE CARD'S UNSAVED EDITS (2.155.0). Clicking play blurs
    // the editor, the refresh repainted from the plan, and an unsaved
    // prompt silently vanished — "type it and press play" is the intent,
    // so play saves first when the prompt differs. (Per-card durations are
    // gone since 2.171.0 — the default duration rules every scene.)
    var r = (scState.list || []).find(function (x) { return x.n === scSel; }) || {};
    var t = el("scList").querySelector('[data-scedit="' + n + '"]');
    var wantText = t ? t.value : null;
    var haveText = (r.prompt || []).join("\n");
    var dirty = (wantText != null && wantText !== haveText);
    // 2.307.0: a scene with a take REDOES (a new scene_<n>_<x> take)
    var verb = r.output && r.status !== "running" ? "/redo" : "/generate";
    if (!dirty) return scPost("/api/scenes/" + n + verb, scWithBasic());
    return scPost("/api/scenes/" + n + "/prompt",
                  { text: wantText != null ? wantText : haveText })
      .then(function (d) {
        if (d && d.error) return d;      // the save's refusal already shows
        return scPost("/api/scenes/" + n + verb, scWithBasic());
      });
  }

  /* 2.291.0 (Tim: "after each scene is generated add it to a new video
     layer in our timeline docker at the start position set in the video
     docker scene"): a take the server flagged tl_pending goes to the core
     tlPlaceScene (a NEW layer at its tl_start), then the flag is cleared
     for exactly that take - a reload or a second window never doubles it. */
  var scPlaced = {};
  function scPlaceFresh() {
    if (typeof window.tlPlaceScene !== "function") return;
    /* 2.309.0 (Tim: "add it from the end of the previous scene so the video
       can continue"): in scene order, each take placed right after the
       PREVIOUS scene's take as it sits on the timeline (after: its name) */
    var ordered = (scState.list || []).slice().sort(function (a, b) { return a.n - b.n; });
    ordered.forEach(function (r, i) {
      if (!r.tl_pending || !r.output
          || !(r.status === "rendered" || r.status === "kept")) return;
      var key = r.n + ":" + r.output;
      if (scPlaced[key]) return;
      scPlaced[key] = true;
      // the scene RIGHT before it - an unrendered gap keeps the server's
      // end-to-end start (its planned length) instead of overlapping it
      var prev = i > 0 && ordered[i - 1].output ? ordered[i - 1] : null;
      // 2.377.0: a take synced to the board song ("song") sits AT its song time, never after the previous take
      window.tlPlaceScene({ n: r.n, name: r.output, label: "Scene " + r.n,
        after: prev && r.tl_from !== "song" ? prev.output : "",
        start: Number.isFinite(r.tl_start) ? r.tl_start : 0,
        dur: Number.isFinite(r.tl_dur) ? r.tl_dur : (r.length || 141) / 24 });
      fetch("/api/scenes/" + r.n + "/placed", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: r.output }) }).catch(function () {});
    });
  }

  var scFollowed = null;
  function r0job(r) { return r.job || r.upjob; }
  function scRefresh() {
    return fetch("/api/scenes").then(function (r) { return r.json(); })
      .then(function (d) {
        scState = d && d.list ? d : scState;
        scPaint();
        scPlaceFresh();          // 2.291.0: fresh takes -> the timeline dock
        // THE CONSOLE FOLLOWS THE RENDER (2.158.0, Tim: "it says it's
        // rendering, but nothing is showing in the console"). The console
        // streams only the SELECTED job, and board renders never selected
        // theirs — so a scene render (or an upscale, or each job the
        // render-selected queue launches) is selected the moment it
        // appears, once per job, and the log flows.
        var run = (scState.list || []).find(function (r) {
          return (r.status === "running" && r.job) || r.upjob; });
        var jid = run ? (run.status === "running" ? r0job(run) : run.upjob) : null;
        if (jid && jid !== scFollowed && window.selectJob) {
          scFollowed = jid;
          window.selectJob(jid);
        }
        // keep watching while anything renders, so "running" becomes
        // "rendered" without the user touching the board
        var busy = (scState.list || []).some(function (r) {
          return r.status === "running" || r.upjob; })
          || (scState.pending || []).length > 0
          || !!(window.ScQedit && window.ScQedit.busy(scState.list));   // 2.337.0: a ✎ first frame being made
        clearTimeout(scTimer);
        // 2.384.0: a scene RENDERING is watched faster - its step count and bar move
        var rendering = (scState.list || []).some(function (r) { return r.status === "running"; });
        if (busy) scTimer = setTimeout(scRefresh, rendering ? 1500 : 4000);
      }).catch(function () {});
  }

  /**
   * The chat box's screenplay hand-off. The MATCHER LIVES SERVER-SIDE
   * (/api/screenplay/intent → lib/screenplay.js) so there is exactly one
   * copy of it; a message that asks ABOUT screenplays returns wants:false
   * and stays an ordinary chat turn. Returns null when this was not a
   * screenplay request, otherwise the reply the chat should show.
   */
  function maybeScreenplay(text) {
    return fetch("/api/screenplay/intent", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }) })
      .then(function (r) { return r.json(); })
      .then(function (it) {
        if (!it) return null;
        // EDIT and ADD intents (2.162.0, by instruction): "edit scene 2 make
        // it more realistic" rewrites that scene; "add a scene ..." appends
        // to the current chapter. Both land on the board, both answer in
        // the chat.
        if (it.edit) {
          return scPost("/api/scenes/" + it.edit.n + "/rewrite",
              { instruction: it.edit.instruction,
                llm_file: (document.getElementById("llmSel") || {}).value || undefined })
            .then(function (d) {
              if (d && d.error) return "⚠ " + d.error
                + ((d.errors || []).length ? " · " + d.errors.join("; ") : "");
              return "✏️ Scene " + it.edit.n + " rewritten — it is back to idle; "
                + "press ▶ to render the new version"
                + ((d.warnings || []).length ? " · " + d.warnings.join(" · ") : "");
            });
        }
        if (it.add) {
          return scPost("/api/scenes/add", { text: it.add.description })
            .then(function (d) {
              if (d && d.error) return "⚠ " + d.error
                + ((d.errors || []).length ? " · " + d.errors.join("; ") : "");
              var last = (d.list || [])[(d.list || []).length - 1] || {};
              return "➕ Scene " + (last.n || "?") + " added"
                + (last.chapter ? " to " + last.chapter : "")
                + " — edit its prompt on the board, then ▶";
            });
        }
        var runWriter = function () {
        /* 2.293.0: the board REFRESHES while the writer works - each scene
           appears the moment it is saved (and, with ▶ as written, starts
           rendering) instead of all at once when the writer returns */
        var liveTimer = setInterval(function () { scRefresh(); }, 3000);
        var stopLive = function (x) { clearInterval(liveTimer); return x; };
        return fetch("/api/screenplay", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: text,
            // the model the user PICKED in the prompt dock rides along
            // (2.145.0) — without it the route fell back to the first .gguf
            llm_file: (document.getElementById("llmSel") || {}).value || undefined }) })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j.error) return "⚠ " + j.error;
            if (!j.ok) return "⚠ the screenplay would not render: "
              + (j.errors || []).join("; ")
              // the repair-pass notes (2.154.0) — what was tried and why it
              // still stands — ride the same message
              + ((j.warnings || []).filter(function (w) {
                   return /repair pass|folded into the user/.test(w);
                 }).map(function (w) { return " · " + w; }).join(""));
            return fetch("/api/screenplay/apply", { method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: j.plan }) })
              .then(function (r) { return r.json(); })
              .then(function (a) {
                if (a.error) return "⚠ " + a.error;
                scRefresh();
                var ws = j.warnings || [];
                var grouped = {};
                ws.forEach(function (w) {
                  var s = String(w).replace(/^shot [^:]+: /, "");
                  (grouped[s] = grouped[s] || []).push(w);
                });
                var lines = Object.keys(grouped).map(function (s) {
                  var a2 = grouped[s];
                  return a2.length > 2 ? a2.length + " shots: " + s : a2.join("\n⚠ ");
                });
                var rn = j.rendering || {};
                return "🎬 Screenplay written — " + (a.scenes || 0)
                  + " scene(s) on the board. "
                  + ((rn.queued || []).length
                    ? "▶ as written: " + rn.queued.length + " scene(s) queued to render"
                      + (rn.mode === "live" ? " as they were written." : ".")
                    : "Press ▶ on a scene to render it.")
                  + (lines.length ? "\n⚠ " + lines.join("\n⚠ ") : "");
              });
          }).then(stopLive, function (e) { stopLive(); throw e; });
        };
        /* 2.275.0 (Tim: "when i ask to create the music video change the
           video dockers workflow to the music video workflow ... the llm
           should send music videos scene prompts to video docker scenes"):
           the music-video ask = set the board's workflow to
           MMH3_Music_Video, run the SAME writer (the brief's own words
           fire the music_video addendum server-side — lyric lock, lipsync
           syntax), then RE-BIND the 2.270 song segments to the fresh
           scenes so each carries its 15 seconds as the lipsync audio. */
        if (it.music_video) {
          /* 2.293.0: a board already on the NATIVE-AUDIO music video keeps
             it - the ask used to switch every board to MMH3_Music_Video,
             undoing the user's own pick. Its scenes render against the
             board song's windows, so there is no segment binding to redo. */
          var mvStyle = scState.style === "MMH3_NativeAudio_MV"
            ? "MMH3_NativeAudio_MV" : "MMH3_Music_Video";
          return scPost("/api/scenes/style", { name: mvStyle })
            .then(function () {
              if (el("scStyleSel")) el("scStyleSel").value = mvStyle;
              if (el("vdWorkflow")) el("vdWorkflow").value = mvStyle;
              return runWriter();
            })
            .then(function (msg) {
              if (mvStyle === "MMH3_NativeAudio_MV")
                return "🎤 Music video — the board's workflow is "
                  + "MMH3_NativeAudio_MV (each scene renders its own window "
                  + "of the board song).\n" + msg;
              return fetch("/api/stems/reassign", { method: "POST" })
                .then(function (r) { return r.json(); })
                .then(function (j) {
                  var seg = (j && j.error)
                    ? "🎵 " + j.error
                    : "🎵 " + ((j && j.assigned) || []).length
                      + " song segment(s) riding the scenes as lipsync audio"
                      + (j && j.note ? " (" + j.note + ")" : "");
                  return "🎤 Music video — the board's workflow is "
                    + "MMH3_Music_Video.\n" + msg + "\n" + seg;
                })
                .catch(function () {
                  return "🎤 Music video — the board's workflow is "
                    + "MMH3_Music_Video.\n" + msg;
                });
            });
        }
        if (!it.wants) return null;
        return runWriter();
      })
      .catch(function () { return null; });   // offline: fall back to plain chat
  }

  /* ---- 360° ENVIRONMENTS (2.142.0) --------------------------------------
     Each row: pano upload, camera (yaw/pitch/fov — the 360 viewer's own
     conventions), scene range, and the projected view the chain will
     reference. Edits save on change and re-project immediately. */
  var envList = [];

  function envRow(e) {
    var view = e.view
      ? '<img src="/api/environments/' + encodeURIComponent(e.name)
        + '/file/view.png?t=' + Date.now() + '" alt="' + esc(e.name)
        + ' view" style="width:64px;height:36px;object-fit:cover;border-radius:4px">'
      : '<span class="hint">no pano</span>';
    function numIn(k, val, lab, min, max) {
      return '<label class="hint" style="display:flex;align-items:center;gap:2px">' + lab
        + '<input type="number" data-envk="' + k + '" data-envn="' + esc(e.name)
        + '" value="' + val + '" min="' + min + '" max="' + max
        + '" style="width:52px" aria-label="' + lab + ' for ' + esc(e.name) + '"></label>';
    }
    return '<div class="envrow" style="display:flex;gap:6px;align-items:center;'
      + 'padding:4px 0;border-bottom:1px solid #262a33;flex-wrap:wrap">'
      + view
      + '<div style="flex:1;min-width:80px"><b>' + esc(e.name) + '</b>'
      + '<div class="hint">@' + esc(e.tag) + '</div></div>'
      + numIn("yaw", e.yaw, "yaw", -180, 180) + numIn("pitch", e.pitch, "pitch", -89, 89)
      + numIn("fov", e.fov, "fov", 30, 140)
      + '<label class="hint" style="display:flex;align-items:center;gap:2px">scenes'
      + '<input type="text" data-envk="scenes" data-envn="' + esc(e.name)
      + '" value="' + esc(e.scenes) + '" style="width:46px" aria-label="Scene range for '
      + esc(e.name) + '"></label>'
      + '<button class="ghost gbtn" data-envpano="' + esc(e.name) + '" type="button" '
      + 'title="Upload the 360 pano for ' + esc(e.name) + '" aria-label="Upload 360 pano for '
      + esc(e.name) + '">🌐</button>'
      + '<button class="ghost gbtn" data-envdel="' + esc(e.name) + '" type="button" '
      + 'title="Delete environment ' + esc(e.name) + '" aria-label="Delete environment '
      + esc(e.name) + '">✕</button>'
      + "</div>";
  }

  function envPaint() {
    el("envList").innerHTML = envList.map(envRow).join("")
      || '<div class="modehint">No environments. Add a location, upload its 360 '
       + 'pano, and its view rides every scene in its range.</div>';
    Array.prototype.forEach.call(el("envList").querySelectorAll("[data-envk]"),
      function (i) { i.addEventListener("change", function () {
        var b = { name: i.dataset.envn }; b[i.dataset.envk] = i.value;
        envPost("/api/environments", b);
      }); });
    Array.prototype.forEach.call(el("envList").querySelectorAll("[data-envpano]"),
      function (btn) { btn.addEventListener("click", function () {
        var f = el("envPanoFile");
        f.onchange = function () {
          if (!f.files || !f.files[0]) return;
          var fd = new FormData();
          fd.append("file", f.files[0]);
          fetch("/api/environments/" + encodeURIComponent(btn.dataset.envpano) + "/pano",
                { method: "POST", body: fd })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (d.error || d.note) el("scNotes").textContent = "⚠ " + (d.error || d.note);
              f.value = ""; envRefresh();
            });
        };
        f.click();
      }); });
    Array.prototype.forEach.call(el("envList").querySelectorAll("[data-envdel]"),
      function (btn) { btn.addEventListener("click", function () {
        fetch("/api/environments/" + encodeURIComponent(btn.dataset.envdel),
              { method: "DELETE" }).then(envRefresh);
      }); });
  }

  function envPost(url, body) {
    return fetch(url, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error || d.note) el("scNotes").textContent = "⚠ " + (d.error || d.note);
        return envRefresh().then(function () { return d; });
      })
      .catch(function (e) { el("scNotes").textContent = String(e); });
  }

  function envRefresh() {
    return fetch("/api/environments").then(function (r) { return r.json(); })
      .then(function (d) { envList = (d && d.environments) || []; envPaint(); })
      .catch(function () {});
  }

  /* ---- 2.223.10: the LOCATION DIALOG (by instruction: "add the same kind
     of dialog for location, with a 360 viewer option for the preview as the
     new character sheet dialog, so users can upload an environment or
     generate one"). Mirrors the character creator (2.223.7–9) with ec*
     ids; the pano preview has a 🌐 360° toggle riding the previewdock's
     VR360 (texImage2D takes an <img> as happily as a <video>; its
     click-to-play is a no-op on an image, by its own try/catch). ---- */
  /* 2.232.0 (by instruction): the LoRA pickers. ONE catalogue —
     /api/comfymodels' loras category, which walks ComfyUI's models/loras
     AND every loras root in extra_model_paths.yaml — feeds a folder-filter
     select and a file select, in the character creator (cc*) and the
     environment creator (ec*) alike. Fetched lazily, cached 30s
     server-side; a refetch on every dialog open keeps a freshly dropped
     file one reopen away. */
  var loraCat = { folders: [], files: [] };
  function loraCatFetch(then) {
    fetch("/api/comfymodels").then(function (r) { return r.json(); })
      .then(function (d) {
        var L = ((d || {}).categories || {}).loras || {};
        loraCat = { folders: L.folders || [], files: L.files || [] };
        then && then();
      }).catch(function () { then && then(); });
  }
  function loraPaint(folderSel, fileSel) {
    var fo = el(folderSel), fi = el(fileSel);
    if (!fo || !fi) return;
    // 2.559.0: the folder picked last is kept (static/folderfilter.js) until it is changed
    var FM = window.H3FolderMem, fkey = "lora:" + folderSel, mem = FM && !fo.dataset.picked ? FM.get(fkey) : null;
    var keep = mem != null ? mem : (fo.value || "*");
    fo.innerHTML = "";
    var all = document.createElement("option");
    all.value = "*"; all.textContent = "all folders";
    fo.appendChild(all);
    loraCat.folders.forEach(function (f) {
      var o = document.createElement("option");
      o.value = f; o.textContent = f === "" ? "(top level)" : f;
      fo.appendChild(o);
    });
    fo.value = Array.prototype.some.call(fo.options,
      function (o) { return o.value === keep; }) ? keep : "*";
    var pick = fo.value;
    fi.innerHTML = "";
    var files = loraCat.files.filter(function (f) {
      return pick === "*" || f.folder === pick;
    });
    files.forEach(function (f) {
      var o = document.createElement("option");
      o.value = f.name; o.textContent = f.name;
      fi.appendChild(o);
    });
    if (!files.length) {
      var o2 = document.createElement("option");
      o2.value = ""; o2.textContent = loraCat.files.length
        ? "(no loras in this folder)"
        : "(no loras found - check Settings \u2192 ComfyUI)";
      fi.appendChild(o2);
    }
  }
  var ecLoras = [], ecSel = "", ecPoll = null, ecStyleRows = {}, ec360ctl = null;
  function ecEl(id) { return document.getElementById(id); }
  function ecName2() { return (ecEl("ecName").value || "").trim(); }
  function ecTab(which) {
    if (which === "create") {
      var vh = ecEl("ecpane-view").offsetHeight;
      if (vh > 40) ecEl("ecpane-create").style.minHeight = vh + "px";
    }
    ecEl("ecpane-view").style.display = which === "view" ? "" : "none";
    ecEl("ecpane-create").style.display = which === "create" ? "" : "none";
    ["ectabView", "ectabCreate"].forEach(function (id) {
      var on = (id === "ectabCreate") === (which === "create");
      ecEl(id).style.borderColor = on ? "var(--tiger)" : "";
      ecEl(id).style.color = on ? "var(--tiger)" : "";
    });
    if (which === "create") { ecStyles(); ecStripPaint(); }
  }
  function ec360Off() {
    if (ec360ctl) { try { ec360ctl.destroy(); } catch (er) {} ec360ctl = null; }
    ecEl("ec360").style.borderColor = "";
    ecEl("ecPano").style.visibility = "";
  }
  function ecPanoShow() {
    ec360Off();
    var n = ecName2();
    ecEl("ecPano").src = n
      ? "/api/environments/" + encodeURIComponent(n) + "/pano?ts=" + Date.now() : "";
  }
  function ecEnsure() {
    var n = ecName2();
    if (!n) { ecEl("ecViewStat").textContent = "name the location first"; return Promise.reject(); }
    return fetch("/api/environments", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }) }).then(function () { return n; });
  }
  function ecApplyStyle() {
    var row = ecStyleRows[ecEl("ecStyle").value];
    if (!row) return;
    if (row.width) ecEl("ecW").value = row.width;
    if (row.height) ecEl("ecH").value = row.height;
    if (row.steps) {
      ecEl("ecSteps").value = Math.min(60, row.steps);
      ecEl("ecStepsV").textContent = String(Math.min(60, row.steps));
    }
    if (row.cfg || row.cfg === 0) {
      var half = Math.max(0, Math.min(30, Math.round(row.cfg * 2)));
      ecEl("ecCfg").value = half; ecEl("ecCfgV").textContent = (half / 2).toFixed(1);
    }
    if (row.sampler) {
      var sch = ecEl("ecSched");
      if (![].slice.call(sch.options).some(function (o) { return o.value === row.sampler; })) {
        var o2 = document.createElement("option");
        o2.value = row.sampler; o2.textContent = row.sampler; sch.appendChild(o2);
      }
      sch.value = row.sampler;
    }
  }
  function ecStyles() {
    fetch("/api/styles?kind=image").then(function (r) { return r.json(); })
      .then(function (d) {
        var sel = ecEl("ecStyle"), had = sel.value;
        sel.innerHTML = ""; ecStyleRows = {};
        ((d && d.styles) || []).forEach(function (s2) {
          ecStyleRows[s2.id] = s2;
          var o = document.createElement("option");
          o.value = s2.id; o.textContent = s2.name; sel.appendChild(o);
        });
        if (had) sel.value = had;
        if (!sel.value) {
          var pd = document.getElementById("styleSel");
          if (pd && pd.value) sel.value = pd.value;
        }
        ecApplyStyle();
      }).catch(function () {});
  }
  function ecStripPaint() {
    fetch("/api/characters/gens?name=" + encodeURIComponent("env " + (ecName2() || "unnamed")))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var strip = ecEl("ecStrip");
        strip.innerHTML = "";
        ((d && d.gens) || []).slice().reverse().forEach(function (u) {
          var im = document.createElement("img");
          im.src = u;
          im.style.cssText = "height:72px;border-radius:6px;cursor:pointer;border:2px solid "
            + (u === ecSel ? "var(--tiger)" : "var(--line)");
          im.title = "Click to select; 🌐 Use as location takes the selected image";
          im.addEventListener("click", function () {
            ecSel = u; ecEl("ecPrev").src = u; ecStripPaint();
          });
          strip.appendChild(im);
        });
      }).catch(function () {});
  }
  function envDlgInit() {
    if (!ecEl("envNewDlg")) return;
    ecEl("envNewDlg").addEventListener("click", function () {
      ecEl("ecName").value = el("envName").value.trim();
      ecSel = ""; ecEl("ecPrev").removeAttribute("src");
      ecPanoShow(); ecTab("view");
      loraCatFetch(function () { loraPaint("ecLoraFolder", "ecLoraSel"); });
      try { ecEl("envCreDlg").showModal(); } catch (er) {}
    });
    ecEl("envCreClose").addEventListener("click", function () {
      ec360Off();
      try { ecEl("envCreDlg").close(); } catch (er) {}
      envRefresh();
    });
    ecEl("ectabView").addEventListener("click", function () { ecTab("view"); });
    ecEl("ectabCreate").addEventListener("click", function () { ecTab("create"); });
    ecEl("ecName").addEventListener("change", function () { ecPanoShow(); });
    ecEl("ecLoad").addEventListener("click", function () {
      ecEnsure().then(function (n) {
        var f = el("envPanoFile");
        f.onchange = function () {
          var file = f.files && f.files[0];
          f.onchange = null; f.value = "";
          if (!file) return;
          var fd = new FormData();
          fd.append("file", file);
          ecEl("ecViewStat").textContent = "uploading…";
          fetch("/api/environments/" + encodeURIComponent(n) + "/pano",
                { method: "POST", body: fd })
            .then(function (r2) { return r2.json().then(function (j) { return { ok: r2.ok, j: j }; }); })
            .then(function (x) {
              ecEl("ecViewStat").textContent = x.ok ? "pano set" : (x.j.error || "refused");
              if (x.ok) ecPanoShow();
            });
        };
        f.click();
      }).catch(function () {});
    });
    ecEl("ec360").addEventListener("click", function () {
      if (ec360ctl) { ec360Off(); return; }
      var im = ecEl("ecPano");
      if (!im.getAttribute("src") || !im.naturalWidth) {
        ecEl("ecViewStat").textContent = "load or generate a pano first"; return;
      }
      var ctl = window.VR360 && window.VR360.attach(im, ecEl("ecViewWrap"));
      if (!ctl) { ecEl("ecViewStat").textContent = "the 360° view needs WebGL"; return; }
      ec360ctl = ctl;
      ecEl("ec360").style.borderColor = "var(--tiger)";
      im.style.visibility = "hidden";
    });
    ecEl("ecSteps").addEventListener("input", function () {
      ecEl("ecStepsV").textContent = this.value === "0" ? "style default" : this.value;
    });
    ecEl("ecCfg").addEventListener("input", function () {
      ecEl("ecCfgV").textContent = this.value === "0" ? "style default" : (this.value / 2).toFixed(1);
    });
    ecEl("ecStyle").addEventListener("change", ecApplyStyle);
    function ecLoraPaint() {
      ecEl("ecLoraList").innerHTML = ecLoras.map(function (l, i) {
        return '<span>' + l.path + ' @ ' + l.weight
          + ' <button class="ghost" data-ecldel="' + i + '" title="Remove this LoRA">✕</button></span>';
      }).join("");
      ecEl("ecLoraList").querySelectorAll("[data-ecldel]").forEach(function (b) {
        b.addEventListener("click", function () {
          ecLoras.splice(parseInt(this.dataset.ecldel, 10), 1); ecLoraPaint();
        });
      });
    }
    ecEl("ecLoraFolder").addEventListener("change", function () {
      var f0 = ecEl("ecLoraFolder"); f0.dataset.picked = "1"; if (window.H3FolderMem) window.H3FolderMem.set("lora:ecLoraFolder", f0.value === "*" ? null : f0.value);   // 2.559.0
      loraPaint("ecLoraFolder", "ecLoraSel");
    });
    ecEl("ecLoraAdd").addEventListener("click", function () {
      var p = (ecEl("ecLoraSel").value || "").trim();
      if (!p) return;
      ecLoras.push({ path: p, weight: parseFloat(ecEl("ecLoraW").value) || 1 });
      ecLoraPaint();
    });
    ecEl("ecGen").addEventListener("click", function () {
      var prompt = ecEl("ecPrompt").value.trim();
      if (!prompt) { ecEl("ecStat").textContent = "write a prompt first"; return; }
      if (!ecEl("ecStyle").value) { ecEl("ecStat").textContent = "pick a style"; return; }
      var body = { prompt: prompt, style_id: ecEl("ecStyle").value,
                   batch: parseInt(ecEl("ecBatch").value, 10) || 1 };
      var w = parseInt(ecEl("ecW").value, 10), hh = parseInt(ecEl("ecH").value, 10);
      if (w) body.width = w;
      if (hh) body.height = hh;
      if (ecEl("ecSteps").value !== "0") body.steps = parseInt(ecEl("ecSteps").value, 10);
      if (ecEl("ecCfg").value !== "0") body.cfg = ecEl("ecCfg").value / 2;
      if (ecEl("ecSched").value) body.sampler = ecEl("ecSched").value;
      if (ecLoras.length) body.extra_loras = ecLoras;
      ecEl("ecStat").textContent = "queuing…";
      fetch("/api/genimage", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) { ecEl("ecStat").textContent = x.j.error || "refused"; return; }
          ecEl("ecStat").textContent = "rendering…";
          clearInterval(ecPoll);
          ecPoll = setInterval(function () {
            fetch("/api/jobs/" + encodeURIComponent(x.j.id))
              .then(function (r) { return r.json(); })
              .then(function (jj) {
                if (jj.status === "running" || jj.status === "queued") return;
                clearInterval(ecPoll);
                if (jj.status !== "done") { ecEl("ecStat").textContent = "render " + jj.status; return; }
                var outs = (jj.outputs && jj.outputs.length ? jj.outputs
                            : jj.output ? [jj.output] : [])
                  .map(function (n) { return "/outputs/" + encodeURIComponent(n); });
                if (!outs.length) { ecEl("ecStat").textContent = "done, but no image reported"; return; }
                ecEl("ecStat").textContent = "done";
                ecSel = outs[0]; ecEl("ecPrev").src = outs[0];
                fetch("/api/characters/gens", { method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: "env " + (ecName2() || "unnamed"), add: outs }) })
                  .then(function () { ecStripPaint(); });
              }).catch(function () {});
          }, 1500);
        }).catch(function (er) { ecEl("ecStat").textContent = String(er); });
    });
    ecEl("ecUse").addEventListener("click", function () {
      if (!ecSel) { ecEl("ecStat").textContent = "select a generated image first"; return; }
      ecEnsure().then(function (n) {
        var bare = decodeURIComponent(ecSel.split("/").pop().split("?")[0]);
        ecEl("ecStat").textContent = "setting pano…";
        fetch("/api/environments/" + encodeURIComponent(n) + "/pano-from",
              { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file: bare }) })
          .then(function (r2) { return r2.json().then(function (j) { return { ok: r2.ok, j: j }; }); })
          .then(function (x) {
            ecEl("ecStat").textContent = x.ok ? "this location's pano is set" : (x.j.error || "refused");
            if (x.ok) { ecPanoShow(); ecTab("view"); }
          });
      }).catch(function () {});
    });
  }

  function envInit() {
    if (!el("envList")) return;
    envDlgInit();
    el("envAdd").addEventListener("click", function () {
      var n = el("envName").value.trim();
      if (!n) return;
      envPost("/api/environments", { name: n })
        .then(function () { el("envName").value = ""; });
    });
    envRefresh();
  }

  function scInit() {
    if (!el("scList")) return;
    // THE MOVIE FILE MENU (2.150.0, by instruction). No native confirm() —
    // Electron has none (the 2.95.x rule) — so New ARMS on the first press
    // and fires on the second within 6 seconds, stated in the notes line.
    var mvArm = null;
    function mvMovies() {
      return fetch("/api/movies").then(function (r) { return r.json(); })
        .then(function (d) {
          var sel = el("mvSel");
          if (!sel) return;
          var keep = sel.value;
          sel.innerHTML = '<option value="">— movies —</option>'
            + (d.movies || []).map(function (m) {
                return '<option value="' + esc(m.id) + '">' + esc(m.name)
                  + " (" + m.scenes + " sc)</option>"; }).join("");
          if (keep) sel.value = keep;
        }).catch(function () {});
    }
    el("mvNew").addEventListener("click", function () {
      if (mvArm && Date.now() - mvArm < 6000) {
        mvArm = null;
        scPost("/api/movies/new").then(function (d) {
          if (d && d.ok) {
            el("scNotes").textContent = d.note || "board cleared";
            refresh(); envRefresh();
          }
        });
      } else {
        mvArm = Date.now();
        el("scNotes").textContent = "New movie clears the cast, chapters and "
          + "scenes (files are stashed, renders stay) — press 🆕 again to confirm";
      }
    });
    el("mvSave").addEventListener("click", function () {
      var n = el("mvName").value.trim();
      if (!n) { el("scNotes").textContent = "name the movie first"; return; }
      scPost("/api/movies/save", { name: n }).then(function (d) {
        if (d && d.ok) {
          el("scNotes").textContent = 'saved "' + d.name + '" — ' + d.files
            + " cast file(s), " + d.renders + " render(s)"
            + ((d.missing || []).length ? " · missing: " + d.missing.join(", ") : "");
          mvMovies();
        }
      });
    });
    /* 2.299.0: 📂 Load is a menu - the selected movie, or a song from
       anywhere on disk (#vdLoadAudio, handled by audioseg.js: uploaded,
       i.e. COPIED, into the active project's sound assets) */
    function mvMenu(open) {
      var m = el("mvLoadMenu");
      if (!m) return;
      m.style.display = open ? "flex" : "none";
      el("mvLoad").setAttribute("aria-expanded", open ? "true" : "false");
      if (open && el("mvLoadMovieName")) {
        var o = el("mvSel").options[el("mvSel").selectedIndex];
        el("mvLoadMovieName").textContent = el("mvSel").value
          ? "“" + (o ? o.textContent : el("mvSel").value) + "”" : "(pick one in the list first)";
      }
    }
    el("mvLoad").addEventListener("click", function (ev) {
      ev.stopPropagation();
      mvMenu(!!el("mvLoadMenu") && el("mvLoadMenu").style.display === "none");
    });
    if (el("mvLoadMenu")) {
      el("mvLoadMenu").addEventListener("click", function () { mvMenu(false); });
      document.addEventListener("click", function (ev) {
        if (el("mvLoadMenu").style.display !== "none" && !(el("mvLoadWrap") && el("mvLoadWrap").contains(ev.target)))
          mvMenu(false);
      });
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && el("mvLoadMenu").style.display !== "none") { mvMenu(false); el("mvLoad").focus(); }
      });
    }
    (el("mvLoadMovie") || el("mvLoad")).addEventListener("click", function () {
      var id = el("mvSel").value;
      if (!id) { el("scNotes").textContent = "pick a saved movie first"; return; }
      scPost("/api/movies/load", { name: id }).then(function (d) {
        if (d && d.ok) {
          el("scNotes").textContent = 'loaded "' + d.name + '" — ' + d.characters
            + " character(s), " + d.renders + " render(s) in the gallery"
            + ((d.missing || []).length ? " · missing: " + d.missing.join(", ") : "");
          el("mvName").value = d.name;
          refresh(); envRefresh();
        }
      });
    });
    el("mvCompile").addEventListener("click", function () {
      el("scNotes").textContent = "compiling every rendered take…";
      scPost("/api/movies/compile").then(function (d) {
        if (d && d.ok) {
          el("scNotes").textContent = "compiling "
            + (d.scenes || []).length + " take(s) — the film lands in the gallery"
            + (d.note ? " · " + d.note : "");   // 2.301.0: from the lossless masters?
          if (d.job && d.job.id && window.selectJob) window.selectJob(d.job.id);
        }
      });
    });
    // 2.196.0 (by instruction): rebuild the tmp workflow on demand so a
    // parameter change reaches the next render without waiting for a cast
    // mutation to trigger the sync.
    el("mvResetWf").addEventListener("click", function () {
      el("scNotes").textContent = "rebuilding the render workflow…";
      scPost("/api/scenes/workflow/reset", {}).then(function (d) {
        el("scNotes").textContent = d && d.ok
          ? "workflow rebuilt: " + d.file + " (" + (d.cast || 0) + " cast)"
            + ((d.notes || []).length ? " · " + d.notes.slice(0, 4).join(" · ") : "")
          : "workflow reset failed" + (d && d.error ? ": " + d.error : "");
      });
    });
    mvMovies();
    // THE EDITABLE BOARD (2.146.0): add a scene, save the shared prompt,
    // populate it from the cast. The populate only FILLS the box — nothing is
    // written until the user presses 💾, so a cast rebuild never silently
    // overwrites a hand-edited prefix.
    el("scAdd").addEventListener("click", function () {
      scPost("/api/scenes/add", { text: "" });
    });
    // SELECT ALL + RENDER SELECTED (2.149.0, by instruction)
    if (el("scPick")) {                        // 2.391.1: the scene picker
      el("scPick").addEventListener("change", function () { scPickSet(el("scPick").value); scPickApply(); });
      el("scPickPrev").addEventListener("click", function () { scPickStep(-1); });
      el("scPickNext").addEventListener("click", function () { scPickStep(1); });
    }
    el("scSelAll").addEventListener("change", function () {
      scChecked = {};
      if (el("scSelAll").checked)
        (scState.list || []).forEach(function (r) { scChecked[r.n] = true; });
      scPaint();
    });
    // DELETE SELECTED + CLEAR (2.163.0, by instruction) — both destructive,
    // both behind appConfirm (never native confirm: Electron has none)
    el("scDelSel").addEventListener("click", function () {
      var ns = Object.keys(scChecked).map(function (k) { return parseInt(k, 10); })
        .sort(function (a, b) { return a - b; });
      if (!ns.length) { el("scNotes").textContent = "tick at least one scene to delete"; return; }
      var ask = window.appConfirm
        ? window.appConfirm("Delete scene" + (ns.length > 1 ? "s " : " ") + ns.join(", ")
            + " from the board? Rendered files stay in the gallery.")
        : Promise.resolve(true);
      Promise.resolve(ask).then(function (yes) {
        if (!yes) return;
        scPost("/api/scenes/delete", { scenes: ns }).then(function (d) {
          if (d && d.ok) {
            scChecked = {}; scSyncSelAll();
            el("scNotes").textContent = d.deleted + " scene(s) deleted — renders stay in the gallery";
          }
        });
      });
    });
    el("scClear").addEventListener("click", function () {
      var count = (scState.list || []).length;
      if (!count) { el("scNotes").textContent = "the board is already empty"; return; }
      var ask = window.appConfirm
        ? window.appConfirm("Clear ALL " + count + " scene(s) from the board? The shared "
            + "prompt and chapters stay; rendered files stay in the gallery.")
        : Promise.resolve(true);
      Promise.resolve(ask).then(function (yes) {
        if (!yes) return;
        scPost("/api/scenes/clear").then(function (d) {
          if (d && d.ok) {
            scChecked = {}; scSyncSelAll();
            el("scNotes").textContent = d.cleared + " scene(s) cleared — the board is empty";
          }
        });
      });
    });
    // THE ONE DURATION (2.163.0/2.171.0): seconds here, frames in the chain
    // settings. Since 2.171.0 this is the ONLY duration control — normalize
    // writes it onto EVERY shot (snapped to the pack's valid lengths); the
    // per-card inputs are gone because the workflow doesn't render scenes
    // of different lengths.
    fetch("/api/config").then(function (r) { return r.json(); })
      .then(function (cfg) {
        var f = parseInt(((cfg || {}).chain || {}).length, 10);
        if (!Number.isFinite(f) || f <= 0) f = 141;
        el("scDefDur").value = Math.round(f / 24 * 10) / 10;
      }).catch(function () { el("scDefDur").value = 5.9; });
    el("scDefDur").addEventListener("change", function () {
      var sec = parseFloat(el("scDefDur").value);
      if (!Number.isFinite(sec) || sec <= 0) return;
      // 2.165.0, by instruction: the default now APPLIES TO EVERY SCENE, not
      // only future ones — the route saves it (merged into the chain
      // settings) and rewrites every shot; changed scenes reset to idle.
      scPost("/api/scenes/duration", { seconds: sec }).then(function (d) {
        if (d && d.ok) el("scNotes").textContent = d.applied
          ? "all " + d.applied + " scene(s) set to ~" + Math.round(d.length / 24 * 10) / 10
            + "s — changed scenes are back to idle"
          : "default scene duration saved — new scenes start at ~"
            + Math.round(d.length / 24 * 10) / 10 + "s";
      });
    });
    // H3_VIDEO_REF (2.223.16): the flow dropdown saves server-side with the
    // board.
    /* 2.275.0: ONE option list for BOTH workflow selects — Character chain
       plus every VIDEO style from /api/styles?kind=video (the starters
       H3_Video_Ref + MMH3_Music_Video ride that list; a style with no
       board flow of its own renders through the MM3 chain, the dropdown
       title says so). The persisted board style survives the repaint. */
    /* 2.323.0 (Tim: "i would like to get rid of the looping workflows and
       replace them with the ref2va and fl2va but i would like to keep the
       voices and characters (reference pictures and character sheets and
       refmod) and tags"): the pickers offer ONLY the scene-by-scene flows -
       no Character chain, no MMH3_Music_Video loop, no "any video style
       through the chain". */
    function vdFillWorkflows() {
      var opts = VD_FLOWS.map(function (f) {
        return '<option value="' + f[0] + '">' + f[1] + "</option>"; }).join("");
      ["scStyleSel", "vdWorkflow"].forEach(function (id) {
        if (!el(id)) return;
        el(id).innerHTML = opts;
        el(id).value = VD_FLOW_IDS.indexOf(scState.style) >= 0 ? scState.style : VD_FLOWS[0][0];
      });
    }
    vdFillWorkflows();
    /* 2.323.0: the Scenes field - saved with the board; blank = scenes.txt,
       else the request's number, else the LLM */
    fetch("/api/scenes/count").then(function (r) { return r.json(); }).then(function (j) {
      scCountFile = (j && j.file_n) || 0; scCountPaint();
    }).catch(function () {});
    if (el("scCount")) el("scCount").addEventListener("change", function () {
      var n = parseInt(el("scCount").value, 10);
      scState.scene_count = Number.isFinite(n) && n >= 1 ? Math.min(40, n) : undefined;
      scPost("/api/scenes/count", { n: scState.scene_count || null }).then(function (d) {
        if (d && !d.error) el("scNotes").textContent = scState.scene_count
          ? "the writer makes " + scState.scene_count + " scene(s)"
          : (scCountFile ? "scenes.txt says " + scCountFile + " scene(s)" : "the LLM decides how many scenes");
      });
    });
    function vdStylePost(name, other) {
      scState.style = name;
      if (el(other)) el(other).value = name;
      scPost("/api/scenes/style", { name: name });
    }
    // 2.295.0: set every scene's anchor radio at once
    Array.prototype.forEach.call(document.querySelectorAll("[data-scallanchor]"), function (b) {
      b.addEventListener("click", function () {
        scPost("/api/scenes/anchors", { anchor: b.dataset.scallanchor });
      });
    });
    // 2.293.0: ▶ as written (lib/autoRender) - saved with the board
    if (el("vdAutoRender")) el("vdAutoRender").addEventListener("change", function () {
      scState.auto_render = el("vdAutoRender").checked;
      scPost("/api/scenes/auto-render", { on: el("vdAutoRender").checked });
    });
    if (el("vdWorkflow")) el("vdWorkflow").addEventListener("change", function () {
      vdStylePost(el("vdWorkflow").value, "scStyleSel");
    });
    if (el("scStyleSel")) el("scStyleSel").addEventListener("change", function () {
      vdStylePost(el("scStyleSel").value, "vdWorkflow");
    });
    // EDIT DIALOG buttons (2.179.0) — bound ONCE; the per-card ✎ handlers
    // only fill and open. Save posts the prompt (scPost refreshes the
    // board) and closes; Cancel closes without touching the plan.
    // CHAPTER REF buttons (2.180.0/2.181.0) — bound ONCE. The 2.180.0
    // guard required a SELECTED scene and looked completely dead without
    // one (Tim: "the reference picture dialog next to chapter doesn't
    // work") — the guard is gone. The chapter now comes from, in order:
    // the selected scene's chapter, else the chapter-name FIELD right
    // beside the button, else "" (the un-chaptered scenes). Every failure
    // writes scNotes — nothing is ever silent.
    if (el("scAddRef")) {
      // 2.183.0 (by instruction): 🖼＋ opens the reference DIALOG — name
      // (auto "Picture <n>" for the chapter), type, description, file —
      // the details ride to the screenplay writer.
      el("scAddRef").addEventListener("click", function () {
        var ch = scRefChapter();
        var n = (scRefMap[ch] || []).length + 1;
        el("scRefTitle").textContent = "Reference image";
        delete el("scRefDlg").dataset.editFile;
        el("scRefName").value = "Picture " + n;
        el("scRefType").value = "other";
        el("scRefDesc").value = "";
        el("scRefFile").value = "";
        el("scRefChap").textContent = ch === ""
          ? "chapter: (un-chaptered scenes)" : "chapter: " + ch;
        el("scRefDlg").dataset.chapter = ch;
        try { el("scRefDlg").showModal(); }
        catch (e) { el("scNotes").textContent = "dialog failed: " + e.message; }
      });
      el("scRefCancel").addEventListener("click", function () {
        el("scRefDlg").close(); });
      // 2.266.0: picking a sound file flips the type to "sound" for the
      // writer's understanding (still editable)
      el("scRefFile").addEventListener("change", function () {
        var f = el("scRefFile").files && el("scRefFile").files[0];
        if (f && /\.(wav|mp3|flac|ogg|m4a)$/i.test(f.name)) el("scRefType").value = "sound";
      });
      el("scRefSave").addEventListener("click", function () {
        var editFile = el("scRefDlg").dataset.editFile;
        if (editFile) {          // 2.198.0: editing an existing reference
          fetch("/api/scenes/refs", { method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chapter: el("scRefDlg").dataset.chapter || "",
                                   file: editFile,
                                   label: el("scRefName").value,
                                   type: el("scRefType").value,
                                   description: el("scRefDesc").value }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              el("scRefDlg").close();
              if (d && d.ok) { scRefMap = d.refs || {}; scPaintRefs();
                el("scNotes").textContent = "reference updated — the writer "
                  + "and the next render see the new details"; }
              else el("scNotes").textContent = (d && d.error) || "reference edit failed";
            })
            .catch(function (e2) { el("scRefDlg").close();
              el("scNotes").textContent = "reference edit failed: " + (e2 && e2.message || e2); });
          return;
        }
        var f = el("scRefFile").files && el("scRefFile").files[0];
        if (!f) { el("scNotes").textContent =
          "pick a picture or sound file first — the reference IS the file"; return; }
        var ch = el("scRefDlg").dataset.chapter || "";
        var fd = new FormData();
        fd.append("image", f);
        fd.append("chapter", ch);
        fd.append("label", el("scRefName").value || f.name.replace(/\.[^.]+$/, ""));
        fd.append("type", el("scRefType").value);
        fd.append("description", el("scRefDesc").value);
        fetch("/api/scenes/refs", { method: "POST", body: fd })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            el("scRefDlg").close();
            if (d && d.ok) {
              scRefMap = d.refs || {};
              scPaintRefs();
              el("scNotes").textContent = "@" + d.tag + " added to "
                + (ch === "" ? "the un-chaptered scenes" : "chapter “" + ch + "”")
                + " — the writer knows its type and description";
            } else el("scNotes").textContent =
              (d && d.error) || "reference upload failed";
          })
          .catch(function (e) { el("scRefDlg").close();
            el("scNotes").textContent =
              "reference upload failed: " + (e && e.message || e); });
      });
      scLoadRefs();
    }
    if (el("scEditDlg")) {
      el("scEditCancel").addEventListener("click", function () {
        el("scEditDlg").close(); });
      el("scEditSave").addEventListener("click", function () {
        var dlg = el("scEditDlg");
        var n = dlg.dataset.scene;
        if (!n) return dlg.close();
        scPost("/api/scenes/" + n + "/prompt", { text: el("scEditText").value })
          .then(function () { dlg.close(); })
          .catch(function () { dlg.close(); });
      });
    }
    el("scRenderSel").addEventListener("click", function () {
      var ns = Object.keys(scChecked).map(function (k) { return parseInt(k, 10); })
        .sort(function (a, b) { return a - b; });
      if (!ns.length) { el("scNotes").textContent = "tick at least one scene first"; return; }
      scPost("/api/scenes/render", scWithBasic({ scenes: ns })).then(function (d) {
        if (d && d.ok) {
          scChecked = {}; scSyncSelAll();
          el("scNotes").textContent = d.queued + " scene(s) queued — they render "
            + "one after another" + ((d.errors || []).length ? " · " + d.errors.join(" · ") : "");
        }
      });
    });
    /* 2.315.0 (Tim: "i would like a icon only button in the scene menubar
       to upscale selected"): every ticked scene's take into the upscale
       queue (POST /api/scenes/upscale), one after another */
    el("scUpSel").addEventListener("click", function () {
      var ns = Object.keys(scChecked).map(function (k) { return parseInt(k, 10); })
        .sort(function (a, b) { return a - b; });
      if (!ns.length) { el("scNotes").textContent = "tick the rendered scenes to upscale first"; return; }
      scPost("/api/scenes/upscale", { scenes: ns }).then(function (d) {
        if (d && d.ok) {
          scChecked = {}; scSyncSelAll();
          el("scNotes").textContent = "⏫ " + d.queued + " scene(s) queued for upscale - they run "
            + "one after another" + ((d.errors || []).length ? " · " + d.errors.join(" · ") : "");
        }
      });
    });
    el("scPrefixSave").addEventListener("click", function () { scPrefixKeep(true); });
    /* 2.548.0 (Tim: "... and the references in storyboard general prompt"): the shared prompt is KEPT as it is typed
       (1.5 s after the last key, when the box is left, and when the app closes) - 💾 still saves at once */
    el("scPrefix").addEventListener("input", function () {
      clearTimeout(scPrefixT); scPrefixT = setTimeout(function () { scPrefixKeep(false); }, 1500);
    });
    el("scPrefix").addEventListener("change", function () { scPrefixKeep(false); });
    window.addEventListener("beforeunload", function () {
      if (!scPrefixDirty() || !navigator.sendBeacon) return;
      try { navigator.sendBeacon("/api/scenes/prefix", new Blob([JSON.stringify({ text: el("scPrefix").value })], { type: "application/json" })); } catch (e) { /* closing */ }
    });
    el("scPrefixGen").addEventListener("click", function () {
      fetch("/api/screenplay/prefix").then(function (r) { return r.json(); })
        .then(function (d) {
          el("scPrefix").value = (d.prefix || []).join("\n");
          el("scPrefix").focus();   // the edit guard now protects it from a poll repaint
          el("scNotes").textContent =
            "shared prompt populated from the cast — press 💾 to keep it";
        }).catch(function (e) { el("scNotes").textContent = String(e); });
    });
    // CHAPTER LOAD (2.182.0): ⤓ reads the named chapter's scene files back
    // onto the board — the durable per-chapter store round-trips
    if (el("scChapLoad")) el("scChapLoad").addEventListener("click", function () {
      var ch = scRefChapter();
      scPost("/api/scenes/load", { chapter: ch }).then(function (d) {
        el("scNotes").textContent = d && d.ok
          ? ("loaded " + d.loaded + " scene(s) from "
             + (ch ? "chapter “" + ch + "”" : "the un-chaptered files"))
          : ((d && d.error) || "chapter load failed");
      });
    });
    el("scChapAdd").addEventListener("click", function () {
      var n = el("scChapName").value.trim();
      if (!n) return;
      scPost("/api/scenes/chapters", { name: n })
        .then(function () { el("scChapName").value = ""; });
    });
    el("scWatch").addEventListener("click", function () {
      var src = scTakeSrc();
      if (!src) return;
      var v = el("scWatchVid");
      if (v.getAttribute("data-src") !== src) { v.setAttribute("data-src", src); v.src = src; }
      try { el("scWatchDlg").showModal(); } catch (er) {}
      // 2.562.0 (Tim: "don't automatically play videos or music"): the take opens paused - its ▶ plays it
    });
    el("scWatchClose").addEventListener("click", function () {
      var v = el("scWatchVid");
      try { v.pause(); } catch (er) {}
      v.removeAttribute("data-src"); v.removeAttribute("src");
      try { v.load(); } catch (er) {}
      try { el("scWatchDlg").close(); } catch (er) {}
    });
    el("scKeep").addEventListener("click", function () {
      if (scSel != null) scPost("/api/scenes/" + scSel + "/keep");
    });
    el("scRedo").addEventListener("click", function () {
      if (scSel != null) scPost("/api/scenes/" + scSel + "/redo", scWithBasic());
    });
    /* 2.324.0 CHARACTER SWAP (Tim: "or from a scene (we add the reference
       image to a rendered scene) and run this workflow"): ⇄ on the take bar
       opens the picker - a cast sheet OR a dropped picture, a window of the
       take, optional direction - and POST /api/scenes/:n/swap queues it; the
       result is harvested as the scene's next take like any render. */
    var swapPick = "";
    function swapPaintCast(list) {
      var box = el("scSwapCast");
      box.innerHTML = "";
      if (!list.length) {
        box.innerHTML = '<span class="hint">No cast sheets yet — drop a picture below.</span>';
        return;
      }
      list.forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "ghost gbtn";
        b.dataset.swapchar = c.name;
        b.title = "@" + c.tag + " — " + c.name;
        b.setAttribute("aria-label", "Swap in " + c.name);
        b.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2px;padding:3px";
        var im = document.createElement("img");
        im.src = c.url; im.alt = ""; im.loading = "lazy";
        im.style.cssText = "width:72px;height:72px;object-fit:cover;border-radius:6px";
        var cap = document.createElement("span");
        cap.textContent = "@" + c.tag; cap.style.fontSize = ".68rem";
        b.appendChild(im); b.appendChild(cap);
        b.addEventListener("click", function () {
          swapPick = c.name; el("scSwapFile").value = "";
          swapMark();
        });
        box.appendChild(b);
      });
      swapMark();
    }
    function swapMark() {
      Array.prototype.forEach.call(el("scSwapCast").querySelectorAll("[data-swapchar]"), function (b) {
        b.style.outline = b.dataset.swapchar === swapPick ? "2px solid var(--accent, #6cf)" : "";
      });
    }
    if (el("scSwap")) el("scSwap").addEventListener("click", function () {
      if (scSel == null) return;
      swapPick = "";
      el("scSwapN").textContent = String(scSel);
      el("scSwapFile").value = ""; el("scSwapMsg").textContent = "";
      el("scSwapCast").innerHTML = '<span class="hint">loading the cast…</span>';
      try { el("scSwapDlg").showModal(); } catch (er) {}
      fetch("/api/swap/cast").then(function (r) { return r.json(); }).then(function (d) {
        swapPaintCast((d && d.cast) || []);
        if (d && d.workflow === false) el("scSwapMsg").textContent =
          "⚠ comfy_workflows/MiniMax_H3_Swap.json is missing — unzip the workflows zip at the install root";
      }).catch(function (e) { el("scSwapMsg").textContent = String(e); });
    });
    if (el("scSwapFile")) el("scSwapFile").addEventListener("change", function () {
      if (el("scSwapFile").files.length) { swapPick = ""; swapMark(); }
    });
    if (el("scSwapCancel")) el("scSwapCancel").addEventListener("click", function () {
      try { el("scSwapDlg").close(); } catch (er) {}
    });
    if (el("scSwapGo")) el("scSwapGo").addEventListener("click", function () {
      var n = parseInt(el("scSwapN").textContent, 10);
      var f = el("scSwapFile").files[0];
      if (!f && !swapPick) { el("scSwapMsg").textContent = "pick a cast character or drop a picture"; return; }
      var fd = new FormData();
      if (f) fd.append("image", f, f.name); else fd.append("character", swapPick);
      fd.append("start", el("scSwapStart").value || "0");
      fd.append("dur", el("scSwapDur").value || "");
      fd.append("prompt", el("scSwapText").value || "");
      el("scSwapMsg").textContent = "queueing the swap…";
      fetch("/api/scenes/" + n + "/swap", { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.error) { el("scSwapMsg").textContent = "⚠ " + d.error; return; }
          el("scNotes").textContent = (d && d.note) || ("scene " + n + ": swap queued");
          try { el("scSwapDlg").close(); } catch (er) {}
          return scRefresh();
        })
        .catch(function (e) { el("scSwapMsg").textContent = String(e); });
    });
    /* 2.391.0 (Tim: "remove ... ⇥ Timeline / 🎬 Produce from videodocker"): both buttons are gone (the routes stay:
       /api/scenes/to-timeline, /api/produce). The info line shows its whole text on hover. */
    var info = el("scNotes");
    if (info && window.MutationObserver) new window.MutationObserver(function () { info.title = info.textContent; })
      .observe(info, { childList: true, characterData: true, subtree: true });
    scRefresh();
  }

  function init() {
    if (!el("chNew")) return;                 // docker not on this page
    // 2.199.0 (by instruction): a character FROM ONE PICTURE — upload,
    // the Klein edit style renders a reference sheet, regenerate until
    // right, ✔ adds it to the cast and opens the normal editor on it.
    var chSheetInput = "", chSheetOut = "", chSheetPoll = null;
    // 2.224.0: every source picture uploaded THIS session — adopt-sheet
    // copies them into the character's dataset folder alongside the sheet
    var chSheetSrcs = [];
    // 2.212.0 (by instruction: "keep the dialog open when generating image,
    // allow the user to generate multiple images and save images they like"):
    // EVERY ▶ Generate press is a TAKE — its own job, its own fresh seed
    // (imageSeed.forRequest rolls one per request server-side). Takes
    // accumulate here and paint as a thumbnail strip inside the mask dialog.
    var chSheetJobs = [];        // [{id, via, status, out, t, kept}]
    function chSheetSay(t) {
      el("chSheetStatus").textContent = t;
      // the mask dialog covers the docker panel while it is open, so the
      // same line speaks INSIDE the dialog too
      if (el("chSheetGenNote")) el("chSheetGenNote").textContent = t;
    }
    function chSheetCounts() {
      var going = 0, done = 0;
      chSheetJobs.forEach(function (j) {
        if (j.status === "done") done++;
        else if (j.status !== "failed") going++;
      });
      return { going: going, done: done };
    }
    function chSheetStatusLine() {
      var c = chSheetCounts();
      if (!chSheetJobs.length) { chSheetSay(""); return; }
      chSheetSay((c.done ? c.done + " take(s) ready" : "")
        + (c.done && c.going ? " · " : "")
        + (c.going ? c.going + " generating…" : "")
        + (c.done ? " — ✔ use as the sheet, 💾 save to Images assets, ✕ delete" : ""));
    }
    // Opens the EXISTING adopt flow on one take: the preview dialog with the
    // name box and ✔ Keep — one path into the cast, unchanged since 2.202.0.
    function chSheetPreview(j) {
      chSheetOut = j.out;
      el("chSheetImg").src = "/outputs/" + encodeURIComponent(chSheetOut) + "?t=" + Date.now();
      el("chSheetImg").style.display = "block";
      el("chSheetBtns").style.display = "flex";
      if (!el("chSheetName").value) el("chSheetName").value = "New Character";
      try { el("chSheetDlg").showModal(); } catch (er) {}
    }
    // Adopt a rendered file into the project's Images assets — the KEEPER
    // marking. The bytes already exist as a job output; "save" therefore
    // means adopting the name (hard link server-side), never re-saving.
    function chAdoptImage(name) {
      return fetch("/api/passets/adopt", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, kind: "images" }) })
        .then(function (r) { return r.json().then(function (j) {
          if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
          return j;
        }); });
    }
    function chSheetPaintStrip() {
      var box = el("chSheetStrip");
      if (!box) return;
      var vids = chSheetJobs.filter(function (j) { return j.status === "done" && j.vid; });
      var vEl = el("chSheetVid");
      if (vEl) {
        if (vids.length) {
          var src = "/outputs/" + encodeURIComponent(vids[vids.length - 1].vid);
          if (vEl.getAttribute("data-src") !== src) {
            vEl.setAttribute("data-src", src); vEl.src = src;
          }
          vEl.style.display = "";
        } else {
          vEl.style.display = "none";
          vEl.removeAttribute("data-src"); vEl.removeAttribute("src");
        }
      }
      box.innerHTML = "";
      chSheetJobs.forEach(function (j) {
        var t = document.createElement("div");
        t.style.cssText = "width:150px;flex:none;display:flex;flex-direction:column;gap:4px";
        if (j.status === "done" && j.out) {
          var im = document.createElement("img");
          im.src = "/outputs/" + encodeURIComponent(j.out) + "?t=" + (j.t || "");
          im.alt = "Generated take " + j.out;
          im.title = "Open the keep-as-character preview";
          im.style.cssText = "width:100%;border-radius:6px;border:1px solid var(--line);cursor:zoom-in";
          im.addEventListener("click", function () { chSheetPreview(j); });
          t.appendChild(im);
          var bar = document.createElement("div");
          bar.style.cssText = "display:flex;gap:4px;align-items:center";
          // 2.224.0 (by instruction): "add check boxes to the thumbnails of
          // the generated images" — the tick marks this take for 🧵 Stitch.
          var cb = document.createElement("input");
          cb.type = "checkbox"; cb.checked = !!j.sel;
          cb.title = "Tick for stitching — 🧵 joins the ticked takes into one file";
          cb.setAttribute("aria-label", "Select this take for stitching");
          cb.style.cssText = "flex:none;margin:0";
          cb.addEventListener("change", function () {
            j.sel = cb.checked; chStitchHintPaint();
          });
          bar.appendChild(cb);
          var bUse = document.createElement("button");
          bUse.className = "ghost gbtn"; bUse.type = "button"; bUse.textContent = "✔";
          bUse.title = "Use as the character sheet — opens the keep preview";
          bUse.setAttribute("aria-label", "Use this take as the character sheet");
          bUse.addEventListener("click", function () { chSheetPreview(j); });
          var bKeep = document.createElement("button");
          bKeep.className = "ghost gbtn"; bKeep.type = "button"; bKeep.textContent = "💾";
          bKeep.title = "Save this picture into the project's Images assets";
          bKeep.setAttribute("aria-label", "Save this take to the Images assets");
          bKeep.disabled = !!j.kept;
          bKeep.addEventListener("click", function () {
            chAdoptImage(j.out).then(function (d) {
              j.kept = d.name;
              try { if (window.refreshAssets) window.refreshAssets(); } catch (er) {}
              chSheetPaintStrip();
              chSheetSay("saved " + d.name + " into the Images assets");
            }).catch(function (er) {
              chSheetSay("could not save " + j.out + ": " + (er.message || er));
            });
          });
          var bDel = document.createElement("button");
          bDel.className = "ghost gbtn"; bDel.type = "button"; bDel.textContent = "✕";
          bDel.title = "Delete this render";
          bDel.setAttribute("aria-label", "Delete this take");
          bDel.style.marginLeft = "auto";
          bDel.addEventListener("click", function () {
            var out = j.out;
            chSheetJobs = chSheetJobs.filter(function (x) { return x !== j; });
            chSheetPaintStrip(); chSheetStatusLine();
            fetch("/api/outputs/" + encodeURIComponent(out), { method: "DELETE" })
              .catch(function () {});
          });
          bar.appendChild(bUse); bar.appendChild(bKeep); bar.appendChild(bDel);
          t.appendChild(bar);
          if (j.kept) {
            var kn = document.createElement("div");
            kn.className = "hint"; kn.textContent = "saved: " + j.kept;
            t.appendChild(kn);
          }
        } else if (j.status === "failed") {
          var fl = document.createElement("div");
          fl.className = "hint";
          fl.style.cssText = "color:#e66";
          fl.textContent = "⚠ take failed — the Queue dock has the log";
          t.appendChild(fl);
          var bGone = document.createElement("button");
          bGone.className = "ghost gbtn"; bGone.type = "button"; bGone.textContent = "✕";
          bGone.title = "Remove this failed take from the strip";
          bGone.setAttribute("aria-label", "Remove this failed take");
          bGone.addEventListener("click", function () {
            chSheetJobs = chSheetJobs.filter(function (x) { return x !== j; });
            chSheetPaintStrip(); chSheetStatusLine();
          });
          t.appendChild(bGone);
        } else {
          var wt = document.createElement("div");
          wt.className = "hint";
          wt.style.cssText = "width:100%;aspect-ratio:1664/944;display:flex;align-items:center;justify-content:center;border:1px dashed var(--line);border-radius:6px";
          wt.textContent = "⏳ " + (j.status || "queued") + "…";
          t.appendChild(wt);
        }
        box.appendChild(t);
      });
      box.style.display = chSheetJobs.length ? "flex" : "none";
      chStitchHintPaint();
    }
    /* 2.224.0: the 🧵 Stitch bar lives with the strip — visible whenever a
       take is done, enabled at two ticks. The join is server-side
       (/api/characters/stitch — the SAME ffmpeg chain the save-time
       composite uses) and the result comes back as a NEW take in this
       strip, so ✔ can adopt it as the sheet like any other. */
    function chStitchHintPaint() {
      var bar = el("chStitchBar");
      if (!bar) return;
      var done = chSheetJobs.filter(function (j) { return j.status === "done" && j.out; });
      bar.style.display = done.length ? "flex" : "none";
      var sel = done.filter(function (j) { return j.sel; });
      el("chStitchBtn").disabled = sel.length < 2;
      el("chStitchHint").textContent = sel.length < 2
        ? "tick two or more takes to stitch"
        : sel.length + " takes ticked — 🧵 joins them side by side into one file";
    }
    function chSheetTick() {
      var pending = chSheetJobs.filter(function (j) {
        return j.status !== "done" && j.status !== "failed"; });
      if (!pending.length) {
        if (chSheetPoll) { clearInterval(chSheetPoll); chSheetPoll = null; }
        return;
      }
      pending.forEach(function (j) {
        fetch("/api/jobs/" + j.id).then(function (r) { return r.json(); })
          .then(function (d) {
            var was = j.status;
            j.status = d.status || j.status;
            if (d.status === "done") {
              var outs = (d.outputs && d.outputs.length ? d.outputs
                          : d.output ? [d.output] : [])
                .map(function (n) { return String(n).split(/[\\/]/).pop(); });
              // 2.223.12: H3-Character_creator returns sheet PNG(s) AND a
              // turnaround video — the first image is the sheet, the first
              // video feeds the dialog's player.
              j.out = outs.filter(function (n) { return !/\.(mp4|webm|mov|mkv|avi)$/i.test(n); })[0] || "";
              j.vid = outs.filter(function (n) { return /\.(mp4|webm|mov|mkv|avi)$/i.test(n); })[0] || "";
              j.t = Date.now();
              if (!j.out) j.status = "failed";
            }
            if (j.status !== was) { chSheetPaintStrip(); chSheetStatusLine(); }
          }).catch(function () {});
      });
    }
    function chSheetWatch(job) {
      el("chSheetPanel").style.display = "block";
      // 2.206.0: the status NAMES the style and its LoRAs ("none" when the
      // style carries none) so a rogue LoRA shows here, not in the render.
      var chSheetVia = (job.style_name ? " · style: " + job.style_name : "")
        + (job.loras ? " · LoRAs: " + (job.loras.length
            ? job.loras.map(function (l) { return l.name; }).join(", ") : "none") : "")
        + (job.pose_name ? " · pose: " + job.pose_name
                         : (job.pose_note ? " · " + job.pose_note : ""));
      // 2.212.0: the dialog STAYS OPEN and jobs accumulate — this only ADDS
      // a take and makes sure the poll is running.
      chSheetJobs.push({ id: job.id, via: chSheetVia, status: "queued", out: "", kept: "" });
      chSheetSay("generating take " + chSheetJobs.length + "… (job "
        + (job.id || "?") + chSheetVia + ")");
      chSheetPaintStrip();
      if (!chSheetPoll) chSheetPoll = setInterval(chSheetTick, 2000);
    }
    /* 2.223.8 (by instruction): "when i click new character it is opening
       a file dialog, it should open the character sheet dialog and have a
       load button in that dialog to load the image" — 🖼 NEW opens the
       DIALOG first, empty; 📂 Load picture (inside it) opens the picker;
       the 🎨 Create images tab is the other road in. */
    el("chNewPic").addEventListener("click", function () {
      chMaskShowEmpty();
    });
    el("chSheetLoad").addEventListener("click", function () {
      el("chNewPicFile").click();
    });
    function chSheetOpts() {
      var sSel = document.getElementById("styleSel");
      // 2.223.4 (by instruction): "make the label with the style name into
      // a dropdown with style names that the user can change" — the dialog's
      // own chSheetStyleSel now decides (2.207.0 made the Prompt dock the
      // source; it remains the SEED each open, the user changes it here).
      var dlgSel = el("chSheetStyleSel");
      return { kind: el("chOptKind").value, gender: el("chOptGender").value,
               style: el("chOptStyle").value, description: el("chOptDesc").value,
               pose: el("chOptPose").value,
               style_id: (dlgSel && dlgSel.value) || (sSel ? sSel.value : "") };
    }
    // The DROPDOWN lists every reference-capable style (LoRA count in the
    // label) from /api/characters/sheetstyles — the same helper sheetgen
    // reads, so what it says is what renders. Seeded with the Prompt dock's
    // styleSel each open; when that style cannot take the reference the
    // first capable one is selected and the hint says why. (2.223.4 — the
    // old chSheetStyleHint label became this select, by instruction.)
    function chStyleHint() {
      var sSel = document.getElementById("styleSel");
      var seed = sSel ? sSel.value : "";
      var name = sSel && sSel.selectedIndex >= 0
        ? sSel.options[sSel.selectedIndex].textContent : "";
      var sel = el("chSheetStyleSel"), hint = el("chSheetStyleHint");
      hint.textContent = "";
      fetch("/api/characters/sheetstyles").then(function (r) { return r.json(); })
        .then(function (d) {
          var rows = (d && d.styles) || [];
          sel.innerHTML = "";
          rows.forEach(function (row) {
            var o = document.createElement("option");
            o.value = row.id;
            o.textContent = row.name + " · " + (row.loras
              ? row.loras + " LoRA" + (row.loras > 1 ? "s" : "") : "no LoRAs");
            sel.appendChild(o);
          });
          if (!rows.length) {
            hint.textContent = "⚠ no reference-capable style installed (Settings → Image)";
            return;
          }
          var seeded = rows.some(function (r2) { return r2.id === seed; });
          sel.value = seeded ? seed : rows[0].id;
          if (!seeded && name) hint.textContent =
            "⚠ the Prompt dock's \"" + name + "\" can't take the reference — using "
            + rows[0].name;
        }).catch(function () { hint.textContent = "⚠ style list unavailable"; });
    }
    var chSheetLastOpts = null;
    function chSheetUpload(blob, name) {
      var fd = new FormData();
      fd.append("image", blob, name || "subject.png");
      chSheetLastOpts = chSheetOpts();
      Object.keys(chSheetLastOpts).forEach(function (k) {
        if (chSheetLastOpts[k]) fd.append(k, chSheetLastOpts[k]);
      });
      el("chSheetPanel").style.display = "block";
      chSheetSay("uploading " + (name || "the picture") + "…");
      fetch("/api/characters/sheetgen", { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          el("chNewPicFile").value = "";
          if (d && d.id) {
            chSheetInput = d.input || "";
            if (d.input && chSheetSrcs.indexOf(d.input) < 0) chSheetSrcs.push(d.input);
            chSheetWatch(d);
          }
          else chSheetSay((d && d.error) || "sheet generation failed to start");
        })
        .catch(function (e) { chSheetSay("sheet generation failed: " + (e && e.message || e)); });
    }
    // 2.203.0 (by instruction): pick ONE subject out of a group. A rectangle
    // mask with corner handles over the picture; ✔ composes the picture at
    // FULL resolution with everything outside the box painted black, and
    // THAT is what uploads — the server never knows a mask existed.
    var chMask = { img: null, name: "", scale: 1, r: null, drag: null };
    var HND = 12;                                 // handle hit size (canvas px)
    function chMaskHandles(r) {
      return [["nw", r.x, r.y], ["ne", r.x + r.w, r.y],
              ["sw", r.x, r.y + r.h], ["se", r.x + r.w, r.y + r.h]];
    }
    function chMaskHit(x, y) {
      var r = chMask.r;
      var hs = chMaskHandles(r);
      for (var i = 0; i < hs.length; i++) {
        if (Math.abs(x - hs[i][1]) <= HND && Math.abs(y - hs[i][2]) <= HND)
          return hs[i][0];
      }
      return (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ? "move" : "";
    }
    function chMaskDraw() {
      var cv = el("chMaskCanvas"), cx = cv.getContext("2d"), r = chMask.r;
      cx.clearRect(0, 0, cv.width, cv.height);
      if (!chMask.img) {                    // 2.223.8: the empty-open state
        cx.fillStyle = "#0c0a08"; cx.fillRect(0, 0, cv.width, cv.height);
        cx.fillStyle = "#8a7c6a"; cx.font = "16px sans-serif";
        cx.textAlign = "center";
        cx.fillText("📂 Load a picture, or generate one in 🎨 Create images",
                    cv.width / 2, cv.height / 2);
        return;
      }
      cx.drawImage(chMask.img, 0, 0, cv.width, cv.height);
      cx.fillStyle = "rgba(0,0,0,0.72)";          // the preview of the blackout
      cx.fillRect(0, 0, cv.width, r.y);
      cx.fillRect(0, r.y + r.h, cv.width, cv.height - r.y - r.h);
      cx.fillRect(0, r.y, r.x, r.h);
      cx.fillRect(r.x + r.w, r.y, cv.width - r.x - r.w, r.h);
      cx.strokeStyle = "#fff"; cx.lineWidth = 2;
      cx.strokeRect(r.x, r.y, r.w, r.h);
      cx.fillStyle = "#fff";
      chMaskHandles(r).forEach(function (h) {
        cx.fillRect(h[1] - 5, h[2] - 5, 10, 10);
      });
    }
    function chMaskXY(ev) {
      var b = el("chMaskCanvas").getBoundingClientRect();
      var sx = el("chMaskCanvas").width / b.width;
      return [(ev.clientX - b.left) * sx, (ev.clientY - b.top) * sx];
    }
    function chMaskOpen(img, name) {
      chMask.img = img; chMask.name = name;
      var cv = el("chMaskCanvas");
      var w = Math.min(900, img.naturalWidth);
      chMask.scale = w / img.naturalWidth;
      cv.width = Math.round(img.naturalWidth * chMask.scale);
      cv.height = Math.round(img.naturalHeight * chMask.scale);
      chMask.r = { x: Math.round(cv.width * 0.2), y: Math.round(cv.height * 0.1),
                   w: Math.round(cv.width * 0.6), h: Math.round(cv.height * 0.8) };
      chMaskDraw();
      chMaskPick(true);
      // 2.212.0: a NEW picture starts a fresh take session — the strip and
      // its jobs belong to the previous picture, not this one
      chSheetJobs = []; chSheetOut = ""; chSheetSrcs = [];
      chSheetPaintStrip(); chSheetStatusLine();
      chStyleHint();                      // 2.207.0: which style + LoRAs, fresh each open
      loraCatFetch(function () { loraPaint("ccLoraFolder", "ccLoraSel"); });
      try { el("chMaskDlg").showModal(); } catch (er) {}
    }
    /* ---- 2.223.7: the CHARACTER CREATOR tab (by instruction: preview +
       prompt + style dropdown, size/steps/cfg/scheduler/batch in an
       accordion, LoRA adder, THIS character's generation thumbnails, and
       "Create character sheet" feeding the pick into the sheet tab). ---- */
    var ccLoras = [], ccSel = "", ccPoll = null, ccStyleRows = {};
    function csTab(which) {
      // 2.223.9 (by instruction): "keep the generate character dialog the
      // same size as the character sheet dialog" — the sheet pane is still
      // visible right now, so its height is measurable; the create pane
      // takes it as a floor before the switch.
      if (which === "create") {
        var sh = el("cspane-sheet").offsetHeight;
        if (sh > 40) el("cspane-create").style.minHeight = sh + "px";
      }
      el("cspane-sheet").style.display = which === "sheet" ? "" : "none";
      el("cspane-create").style.display = which === "create" ? "" : "none";
      ["cstabSheet", "cstabCreate"].forEach(function (id) {
        var on = (id === "cstabCreate") === (which === "create");
        el(id).style.borderColor = on ? "var(--tiger)" : "";
        el(id).style.color = on ? "var(--tiger)" : "";
      });
      if (which === "create") { ccStyles(); ccStripPaint(); }
    }
    el("cstabSheet").addEventListener("click", function () { csTab("sheet"); });
    el("cstabCreate").addEventListener("click", function () { csTab("create"); });
    function ccName() {
      var f = el("chName");
      return (f && f.value.trim()) || "unnamed";
    }
    /* 2.223.9 (by instruction): "load the style's settings and change the
       sliders and wxh settings to the styles" — the accordion is SET to the
       selected style's steps/cfg/size/scheduler, on populate and on every
       style change. The user can still edit after; picking a style again
       re-applies its values. */
    function ccApplyStyle() {
      var row = ccStyleRows[el("ccStyle").value];
      if (!row) return;
      if (row.width) el("ccW").value = row.width;
      if (row.height) el("ccH").value = row.height;
      if (row.steps) {
        el("ccSteps").value = Math.min(60, row.steps);
        el("ccStepsV").textContent = String(Math.min(60, row.steps));
      }
      if (row.cfg || row.cfg === 0) {
        var half = Math.max(0, Math.min(30, Math.round(row.cfg * 2)));
        el("ccCfg").value = half;
        el("ccCfgV").textContent = (half / 2).toFixed(1);
      }
      if (row.sampler) {
        var sch = el("ccSched");
        if (![].slice.call(sch.options).some(function (o) { return o.value === row.sampler; })) {
          var o2 = document.createElement("option");
          o2.value = row.sampler; o2.textContent = row.sampler;
          sch.appendChild(o2);
        }
        sch.value = row.sampler;
      }
    }
    function ccStyles() {
      fetch("/api/styles?kind=image").then(function (r) { return r.json(); })
        .then(function (d) {
          var sel = el("ccStyle"), had = sel.value;
          sel.innerHTML = ""; ccStyleRows = {};
          ((d && d.styles) || []).forEach(function (s2) {
            ccStyleRows[s2.id] = s2;
            var o = document.createElement("option");
            o.value = s2.id; o.textContent = s2.name;
            sel.appendChild(o);
          });
          if (had) sel.value = had;
          // seed from the Prompt dock's pick, same as the sheet tab
          if (!sel.value) {
            var pd = document.getElementById("styleSel");
            if (pd && pd.value) sel.value = pd.value;
          }
          ccApplyStyle();                     // 2.223.9: the style's settings
        }).catch(function () {});
    }
    el("ccStyle").addEventListener("change", ccApplyStyle);
    el("ccSteps").addEventListener("input", function () {
      el("ccStepsV").textContent = this.value === "0" ? "style default" : this.value;
    });
    el("ccCfg").addEventListener("input", function () {
      el("ccCfgV").textContent = this.value === "0" ? "style default" : (this.value / 2).toFixed(1);
    });
    function ccLoraPaint() {
      el("ccLoraList").innerHTML = ccLoras.map(function (l, i) {
        return '<span>' + l.path + ' @ ' + l.weight
          + ' <button class="ghost" data-ccldel="' + i + '" title="Remove this LoRA">✕</button></span>';
      }).join("");
      el("ccLoraList").querySelectorAll("[data-ccldel]").forEach(function (b) {
        b.addEventListener("click", function () {
          ccLoras.splice(parseInt(this.dataset.ccldel, 10), 1); ccLoraPaint();
        });
      });
    }
    el("ccLoraAdd").addEventListener("click", function () {
      var p = (el("ccLoraSel").value || "").trim();
      if (!p) return;
      ccLoras.push({ path: p, weight: parseFloat(el("ccLoraW").value) || 1 });
      ccLoraPaint();
    });
    el("ccLoraFolder").addEventListener("change", function () {
      var f0 = el("ccLoraFolder"); f0.dataset.picked = "1"; if (window.H3FolderMem) window.H3FolderMem.set("lora:ccLoraFolder", f0.value === "*" ? null : f0.value);   // 2.559.0
      loraPaint("ccLoraFolder", "ccLoraSel");
    });
    function ccStripPaint() {
      fetch("/api/characters/gens?name=" + encodeURIComponent(ccName()))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var strip = el("ccStrip");
          strip.innerHTML = "";
          ((d && d.gens) || []).slice().reverse().forEach(function (u) {
            var im = document.createElement("img");
            im.src = u; im.dataset.ccpick = u;
            im.style.cssText = "height:72px;border-radius:6px;cursor:pointer;border:2px solid "
              + (u === ccSel ? "var(--tiger)" : "var(--line)");
            im.title = "Click to select; the sheet button uses the selected image";
            im.addEventListener("click", function () {
              ccSel = u; el("ccPrev").src = u; ccStripPaint();
            });
            strip.appendChild(im);
          });
        }).catch(function () {});
    }
    el("ccGen").addEventListener("click", function () {
      var prompt = el("ccPrompt").value.trim();
      if (!prompt) { el("ccStat").textContent = "write a prompt first"; return; }
      if (!el("ccStyle").value) { el("ccStat").textContent = "pick a style"; return; }
      var body = { prompt: prompt, style_id: el("ccStyle").value,
                   batch: parseInt(el("ccBatch").value, 10) || 1 };
      var w = parseInt(el("ccW").value, 10), hh = parseInt(el("ccH").value, 10);
      if (w) body.width = w;
      if (hh) body.height = hh;
      if (el("ccSteps").value !== "0") body.steps = parseInt(el("ccSteps").value, 10);
      if (el("ccCfg").value !== "0") body.cfg = el("ccCfg").value / 2;
      if (el("ccSched").value) body.sampler = el("ccSched").value;
      if (ccLoras.length) body.extra_loras = ccLoras;
      el("ccStat").textContent = "queuing…";
      fetch("/api/genimage", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) { el("ccStat").textContent = x.j.error || "refused"; return; }
          el("ccStat").textContent = "rendering…";
          clearInterval(ccPoll);
          ccPoll = setInterval(function () {
            fetch("/api/jobs/" + encodeURIComponent(x.j.id))
              .then(function (r) { return r.json(); })
              .then(function (jj) {
                if (jj.status === "running" || jj.status === "queued") return;
                clearInterval(ccPoll);
                if (jj.status !== "done") { el("ccStat").textContent = "render " + jj.status; return; }
                var outs = (jj.outputs && jj.outputs.length ? jj.outputs
                            : jj.output ? [jj.output] : [])
                  .map(function (n) { return "/outputs/" + encodeURIComponent(n); });
                if (!outs.length) { el("ccStat").textContent = "done, but no image reported"; return; }
                el("ccStat").textContent = "done";
                ccSel = outs[0]; el("ccPrev").src = outs[0];
                fetch("/api/characters/gens", { method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: ccName(), add: outs }) })
                  .then(function () { ccStripPaint(); });
              }).catch(function () {});
          }, 1500);
        }).catch(function (er) { el("ccStat").textContent = String(er); });
    });
    // "Create character sheet": the SELECTED generation becomes the sheet
    // tab's source picture — same entry as an upload, then the tab flips.
    el("ccMakeSheet").addEventListener("click", function () {
      if (!ccSel) { el("ccStat").textContent = "select a generated image first"; return; }
      var img = new Image();
      img.onload = function () {
        chMaskOpen(img, decodeURIComponent(ccSel.split("/").pop().split("?")[0]));
        csTab("sheet");
      };
      img.src = ccSel;
    });

    /* 2.223.8: 🖼 NEW opens here with NO picture — same fresh-session
       resets as chMaskOpen, a placeholder canvas, and the Sheet tab up
       front. 📂 or the creator tab supply the picture. */
    function chMaskShowEmpty() {
      chMask.img = null; chMask.name = "";
      var cv = el("chMaskCanvas");
      cv.width = 900; cv.height = 300;
      chMask.scale = 1;
      chMask.r = { x: 180, y: 30, w: 540, h: 240 };
      chMaskDraw();
      chSheetJobs = []; chSheetOut = ""; chSheetSrcs = [];
      chSheetPaintStrip(); chSheetStatusLine();
      chStyleHint();
      csTab("sheet");
      loraCatFetch(function () { loraPaint("ccLoraFolder", "ccLoraSel"); });
      try { el("chMaskDlg").showModal(); } catch (er) {}
    }
    el("chMaskCanvas").addEventListener("pointerdown", function (ev) {
      if (!chMask.img) return;              // 2.223.8: no box on the placeholder
      var p = chMaskXY(ev);
      var g = chMaskHit(p[0], p[1]);
      if (!g) return;
      chMask.drag = { g: g, x: p[0], y: p[1],
                      r: { x: chMask.r.x, y: chMask.r.y, w: chMask.r.w, h: chMask.r.h } };
      el("chMaskCanvas").setPointerCapture && el("chMaskCanvas").setPointerCapture(ev.pointerId);
    });
    el("chMaskCanvas").addEventListener("pointermove", function (ev) {
      if (!chMask.drag) return;
      var cv = el("chMaskCanvas"), p = chMaskXY(ev), d = chMask.drag;
      var dx = p[0] - d.x, dy = p[1] - d.y, r = chMask.r, o = d.r, MIN = 24;
      if (d.g === "move") {
        r.x = Math.max(0, Math.min(cv.width - o.w, o.x + dx));
        r.y = Math.max(0, Math.min(cv.height - o.h, o.y + dy));
      } else {
        var x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (d.g.indexOf("w") >= 0) x1 = Math.max(0, Math.min(x2 - MIN, o.x + dx));
        if (d.g.indexOf("e") >= 0) x2 = Math.min(cv.width, Math.max(x1 + MIN, o.x + o.w + dx));
        if (d.g.indexOf("n") >= 0) y1 = Math.max(0, Math.min(y2 - MIN, o.y + dy));
        if (d.g.indexOf("s") >= 0) y2 = Math.min(cv.height, Math.max(y1 + MIN, o.y + o.h + dy));
        r.x = x1; r.y = y1; r.w = x2 - x1; r.h = y2 - y1;
      }
      chMaskDraw();
    });
    ["pointerup", "pointercancel"].forEach(function (t) {
      el("chMaskCanvas").addEventListener(t, function () { chMask.drag = null; });
    });
    var chMaskMode = true;                       // true = selection, false = whole
    function chMaskPick(masked) {
      chMaskMode = masked;
      el("chMaskUse").classList.toggle("on", masked);
      el("chMaskAll").classList.toggle("on", !masked);
    }
    function chMaskCompose(masked) {
      if (!chMask.img) {                    // 2.223.8: nothing loaded yet
        chSheetSay("load a picture first (📂), or create one in 🎨 Create images");
        return;
      }
      var img = chMask.img, out = document.createElement("canvas");
      out.width = img.naturalWidth; out.height = img.naturalHeight;
      var cx = out.getContext("2d");
      cx.drawImage(img, 0, 0);
      if (masked) {
        var k = 1 / chMask.scale, r = chMask.r;
        var x = Math.round(r.x * k), y = Math.round(r.y * k),
            w = Math.round(r.w * k), h = Math.round(r.h * k);
        cx.fillStyle = "#000";
        cx.fillRect(0, 0, out.width, y);
        cx.fillRect(0, y + h, out.width, out.height - y - h);
        cx.fillRect(0, y, x, h);
        cx.fillRect(x + w, y, out.width - x - w, h);
      }
      // 2.212.0 (by instruction): the dialog STAYS OPEN — every ▶ Generate
      // press composes and queues another take; the strip below collects them.
      out.toBlob(function (b) {
        if (b) chSheetUpload(b, chMask.name.replace(/\.[^.]+$/, "") + ".png");
        else chSheetSay("could not compose the masked picture");
      }, "image/png");
    }
    el("chMaskUse").addEventListener("click", function () { chMaskPick(true); });
    el("chMaskAll").addEventListener("click", function () { chMaskPick(false); });
    // 2.224.0: 🧵 Stitch — the ticked takes join into ONE file server-side
    // and the result lands in the strip as a new take (un-ticked).
    if (el("chStitchBtn")) el("chStitchBtn").addEventListener("click", function () {
      var sel = chSheetJobs.filter(function (j) {
        return j.status === "done" && j.out && j.sel; });
      if (sel.length < 2) { chSheetSay("tick at least two takes to stitch"); return; }
      chSheetSay("stitching " + sel.length + " takes…");
      scPost("/api/characters/stitch",
             { files: sel.map(function (j) { return j.out; }) })
        .then(function (d) {
          if (!d || !d.ok) { chSheetSay((d && d.error) || "stitch failed"); return; }
          chSheetJobs.push({ id: "", via: " · stitched from " + sel.length + " takes",
                             status: "done", out: d.file, t: Date.now(),
                             kept: "", stitched: true });
          chSheetPaintStrip(); chSheetStatusLine();
          chSheetSay("stitched " + sel.length + " takes into " + d.file
            + " — ✔ adopts it as the sheet");
        }).catch(function (er) { chSheetSay("stitch failed: " + (er.message || er)); });
    });
    // 2.205.0 (by instruction): "don't generate automatically, only when i
    // click the button" — ▶ Generate is the ONLY path to a render.
    el("chSheetGen").addEventListener("click", function () { chMaskCompose(chMaskMode); });
    el("chMaskCancel").addEventListener("click", function () {
      try { el("chMaskDlg").close(); } catch (er) {}
      el("chNewPicFile").value = "";
    });
    el("chNewPicFile").addEventListener("change", function () {
      var fl = el("chNewPicFile").files;
      if (!fl || !fl.length) return;
      if (fl.length === 1) {                 // one picture keeps the mask flow
        var f = fl[0];
        var img = new Image();
        img.onload = function () { chMaskOpen(img, f.name); };
        img.onerror = function () { chSheetSay("could not read that picture"); };
        img.src = URL.createObjectURL(f);
        return;
      }
      // 2.224.0 (by instruction): "allow the user to upload multiple images
      // and generate from each image separately" — every picked file queues
      // its OWN sheet job, whole picture (the rectangle mask is a per-
      // picture tool; open one file to use it). Takes land in the strip.
      var files = Array.prototype.slice.call(fl);
      chSheetSay("generating one sheet per picture — " + files.length + " queued…");
      files.forEach(function (f2) {
        var img2 = new Image();
        img2.onload = function () {
          var out = document.createElement("canvas");
          out.width = img2.naturalWidth; out.height = img2.naturalHeight;
          out.getContext("2d").drawImage(img2, 0, 0);
          out.toBlob(function (b2) {
            if (b2) chSheetUpload(b2, f2.name.replace(/\.[^.]+$/, "") + ".png");
            else chSheetSay("could not read " + f2.name);
          }, "image/png");
        };
        img2.onerror = function () { chSheetSay("could not read " + f2.name); };
        img2.src = URL.createObjectURL(f2);
      });
      // the LAST picture also shows in the mask canvas, so the dialog is
      // never left on the placeholder after a multi-pick
      var last = new Image();
      last.onload = function () {
        chMask.img = last; chMask.name = files[files.length - 1].name;
        var cv = el("chMaskCanvas");
        var w = Math.min(900, last.naturalWidth);
        chMask.scale = w / last.naturalWidth;
        cv.width = Math.round(last.naturalWidth * chMask.scale);
        cv.height = Math.round(last.naturalHeight * chMask.scale);
        chMask.r = { x: Math.round(cv.width * 0.2), y: Math.round(cv.height * 0.1),
                     w: Math.round(cv.width * 0.6), h: Math.round(cv.height * 0.8) };
        chMaskDraw();
      };
      last.src = URL.createObjectURL(files[files.length - 1]);
    });
    el("chSheetRegen").addEventListener("click", function () {
      if (!chSheetInput) { chSheetSay("upload a picture first"); return; }
      try { el("chSheetDlg").close(); } catch (er) {}
      scPost("/api/characters/sheetgen",
             Object.assign({ file: chSheetInput }, chSheetLastOpts || chSheetOpts()))
        .then(function (d) {
          if (d && d.id) chSheetWatch(d);
          else chSheetSay((d && d.error) || "regenerate failed to start");
        });
    });
    function chSheetFullscreen() {
      var im = el("chSheetImg");
      if (im.requestFullscreen) im.requestFullscreen().catch(function () {});
      else if (im.webkitRequestFullscreen) im.webkitRequestFullscreen();
    }
    el("chSheetFull").addEventListener("click", chSheetFullscreen);
    el("chSheetImg").addEventListener("click", chSheetFullscreen);
    el("chSheetDismiss").addEventListener("click", function () {
      var out = chSheetOut;
      chSheetOut = "";
      try { el("chSheetDlg").close(); } catch (er) {}
      // 2.212.0: ✕ discards THIS take, not the session — the mask dialog and
      // its other takes stay; the panel only clears when nothing is left.
      chSheetJobs = chSheetJobs.filter(function (j) { return j.out !== out; });
      chSheetPaintStrip(); chSheetStatusLine();
      if (!chSheetJobs.length && !el("chMaskDlg").hasAttribute("open")) {
        if (chSheetPoll) { clearInterval(chSheetPoll); chSheetPoll = null; }
        el("chSheetPanel").style.display = "none";
      }
      if (out) fetch("/api/outputs/" + encodeURIComponent(out), { method: "DELETE" })
        .then(function () {}).catch(function () {});
    });
    el("chSheetAdopt").addEventListener("click", function () {
      var nm = (el("chSheetName").value || "").trim();
      if (!nm) { chSheetSay("name the character first"); return; }
      if (!chSheetOut) { chSheetSay("no rendered sheet to adopt yet"); return; }
      scPost("/api/characters/adopt-sheet",
             { name: nm, file: chSheetOut, sources: chSheetSrcs })
        .then(function (d) {
          if (!d || !d.ok) { chSheetSay((d && d.error) || "could not add the character"); return; }
          try { el("chSheetDlg").close(); } catch (er) {}
          // 2.212.0: adopting ends the take session — the mask dialog closes
          // too, and any un-kept takes stay in the Gallery for later.
          try { el("chMaskDlg").close(); } catch (er) {}
          chSheetJobs = []; chSheetPaintStrip();
          if (chSheetPoll) { clearInterval(chSheetPoll); chSheetPoll = null; }
          el("chSheetPanel").style.display = "none";
          chSheetSay("");
          refresh().then(function () {
            var card = el("chList").querySelector('.chcard[data-name="' + nm + '"]');
            if (card) card.click();   // the normal editor, prefilled — one path
          });
        });
    });
    el("chNew").addEventListener("click", function () {
      // NEW always starts clean, even after an edit was cancelled mid-way
      chEditing = "";
      el("chName").readOnly = false;
      el("chDlgTitle").textContent = "New character";
      el("chSave").textContent = "Add character";
      el("chSave").title = "Create this character";
      if (el("chType")) el("chType").value = "person";
      ["chSubtype", "chBreed", "chColor", "chModel", "chYear"].forEach(
        function (i) { if (el(i)) el(i).value = ""; });
      chTypeApply();
      chThumbSet("", []);
      chDropReset();                          // 2.212.0: NEW starts clean
      chClothReset([]);                       // 2.224.0: clothing too
      if (el("chPersonaIn")) el("chPersonaIn").value = "";
      if (el("chBackstoryIn")) el("chBackstoryIn").value = "";
      try { window.chTabShow("chTabProfile"); } catch (er) {}
      el("chDlgMsg").textContent = "";
      el("chDlg").showModal();
    });
    if (el("chType")) el("chType").addEventListener("change", chTypeApply);
    if (el("chAddPic")) el("chAddPic").addEventListener("click", function () {
      el("chSheet").click();
    });
    if (el("chDlgThumb")) el("chDlgThumb").addEventListener("click", function () {
      // THE THUMBNAIL IS THE PICTURE BUTTON (2.166.0): clicking it opens the
      // same picker as the Pictures field
      el("chSheet").click();
    });
    if (el("chSheet")) el("chSheet").addEventListener("change", function () {
      var f = el("chSheet").files[0];
      if (f && window.URL && URL.createObjectURL)
        el("chDlgThumb").src = URL.createObjectURL(f);
      if (el("chDlgPics")) el("chDlgPics").textContent = el("chSheet").files.length
        + " picture(s) picked — they upload when you press "
        + (chEditing ? "Save" : "Add character") + ".";
    });
    el("chCancel").addEventListener("click", function () {
      chEditing = "";
      el("chName").readOnly = false;
      el("chSave").textContent = "Add character";
      el("chSave").title = "Create this character";
      chDropReset();                          // 2.212.0: a cancel abandons drops
      chClothReset([]);                       // 2.224.0: queued clothing too
      try { el("chDlg").close(); } catch (e) { /* view only */ }
    });
    // ---- 2.216.0 (by instruction): Profile | Persona | Backstory tabs -----
    function chTabShow(id) {
      document.querySelectorAll("#chDlg .chtab").forEach(function (t) {
        t.style.display = t.id === id
          ? (t.id === "chTabProfile" ? "grid" : "block") : "none";
      });
      document.querySelectorAll("#chDlg .chtabbtn").forEach(function (b) {
        b.setAttribute("aria-selected", b.dataset.chtab === id ? "true" : "false");
        b.style.opacity = b.dataset.chtab === id ? "1" : ".55";
      });
    }
    window.chTabShow = chTabShow;   // the refresh() edit-open handler uses it
    document.querySelectorAll("#chDlg .chtabbtn").forEach(function (b) {
      b.addEventListener("click", function () { chTabShow(b.dataset.chtab); });
    });
    chTabShow("chTabProfile");

    // ---- 2.265.0 (by instruction): the titlebar \u2715 closes the dialog
    if (el("chDlgX")) el("chDlgX").onclick = function () {
      try { el("chDlg").close(); } catch (e) { /* already closed */ }
    };

    /* ---- 2.265.0 (by instruction): the DATASET tab --------------------
       datasets/<name> at the app root, image + caption .txt pairs. The
       grid: \u2715 top-right deletes, checkbox top-left selects, the input
       below is the caption (saved on change). Auto Caption sends ONLY the
       checked files; the server captions them with the vision model the
       prompt docker selected and writes the sidecars. */
    var dsItems = [];                 // [{file, caption, sel}]
    function dsCurName() { return (el("dsName") ? el("dsName").value : "").trim(); }
    function dsSay(t) { if (el("dsMsg")) el("dsMsg").textContent = t || ""; }
    function dsPaint() {
      var g = el("dsGrid"); if (!g) return;
      g.innerHTML = "";
      dsItems.forEach(function (it) {
        var cell = document.createElement("div");
        cell.style.cssText = "position:relative;display:flex;flex-direction:column;gap:4px";
        var im = document.createElement("img");
        im.src = "/api/datasets/" + encodeURIComponent(dsCurName()) + "/file/" + encodeURIComponent(it.file);
        im.alt = it.file; im.title = it.file;
        im.style.cssText = "width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;background:#20242c";
        var sel = document.createElement("input");
        sel.type = "checkbox"; sel.checked = !!it.sel;
        sel.title = "Select for Auto Caption";
        sel.style.cssText = "position:absolute;top:4px;left:4px;width:16px;height:16px";
        sel.onchange = function () { it.sel = sel.checked; dsSelAllSync(); };
        var x = document.createElement("button");
        x.type = "button"; x.className = "ghost gbtn"; x.textContent = "\u2715";
        x.title = "Remove this image (and its caption)";
        x.setAttribute("aria-label", "Remove " + it.file);
        x.style.cssText = "position:absolute;top:2px;right:2px;padding:0 6px;line-height:1.4";
        x.onclick = function () {
          fetch("/api/datasets/" + encodeURIComponent(dsCurName()) + "/images/" + encodeURIComponent(it.file),
                { method: "DELETE" }).then(function () { dsLoad(); });
        };
        var cap = document.createElement("input");
        cap.type = "text"; cap.value = it.caption || "";
        cap.placeholder = "caption\u2026";
        cap.title = "The caption \u2014 saved to " + it.file.replace(/\.[^.]+$/, "") + ".txt when you leave the field";
        cap.onchange = function () {
          fetch("/api/datasets/" + encodeURIComponent(dsCurName()) + "/caption", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file: it.file, caption: cap.value }) })
            .then(function () { it.caption = cap.value; });
        };
        cell.appendChild(im); cell.appendChild(sel); cell.appendChild(x); cell.appendChild(cap);
        g.appendChild(cell);
      });
      dsSelAllSync();
    }
    function dsSelAllSync() {
      var all = el("dsSelAll"); if (!all) return;
      all.checked = dsItems.length > 0 && dsItems.every(function (i) { return i.sel; });
    }
    function dsLoad() {
      var n = dsCurName(); if (!n) { dsItems = []; dsPaint(); return; }
      fetch("/api/datasets/" + encodeURIComponent(n))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) { dsSay(j.error); return; }
          var old = {}; dsItems.forEach(function (i) { old[i.file] = i.sel; });
          dsItems = (j.images || []).map(function (i) {
            return { file: i.file, caption: i.caption, sel: !!old[i.file] };
          });
          dsPaint(); dsSay(dsItems.length + " image(s)");
        }).catch(function () { dsSay("could not read the dataset"); });
    }
    function dsAddFiles(files) {
      var n = dsCurName();
      if (!n) { dsSay("name the dataset first \u2014 the folder is datasets/<name>"); return; }
      var fd = new FormData(); var count = 0;
      Array.prototype.forEach.call(files, function (f) {
        if (/^image\//.test(f.type || "")) { fd.append("images", f, f.name); count++; }
      });
      if (!count) { dsSay("only pictures can join a dataset"); return; }
      dsSay("adding " + count + " image(s)\u2026");
      fetch("/api/datasets/" + encodeURIComponent(n) + "/images", { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j.error) { dsSay(j.error); return; } dsLoad(); })
        .catch(function (e) { dsSay("upload failed: " + e.message); });
    }
    if (el("dsName")) el("dsName").addEventListener("change", dsLoad);
    if (el("dsAddBtn")) el("dsAddBtn").onclick = function () {
      if (!dsCurName()) { dsSay("name the dataset first \u2014 the folder is datasets/<name>"); return; }
      el("dsFile").click();
    };
    if (el("dsFile")) el("dsFile").addEventListener("change", function () {
      dsAddFiles(el("dsFile").files); el("dsFile").value = "";
    });
    if (el("dsSelAll")) el("dsSelAll").addEventListener("change", function () {
      var on = el("dsSelAll").checked;
      dsItems.forEach(function (i) { i.sel = on; });
      dsPaint();
    });
    if (el("dsDelAll")) el("dsDelAll").onclick = function () {
      var n = dsCurName(); if (!n || !dsItems.length) return;
      appConfirm("Delete ALL " + dsItems.length + " image(s) in \"" + n + "\"?").then(function (ok) {
        if (!ok) return;
        fetch("/api/datasets/" + encodeURIComponent(n) + "/images", { method: "DELETE" })
          .then(function () { dsLoad(); });
      });
    };
    if (el("dsAutoCap")) el("dsAutoCap").onclick = function () {
      var n = dsCurName();
      var want = dsItems.filter(function (i) { return i.sel; }).map(function (i) { return i.file; });
      if (!want.length) { dsSay("tick the pictures to caption first (top-left checkboxes)"); return; }
      var b = el("dsAutoCap"); b.disabled = true;
      dsSay("captioning " + want.length + " image(s) with the vision model\u2026");
      fetch("/api/datasets/" + encodeURIComponent(n) + "/autocaption", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: want }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          b.disabled = false;
          if (j.error) { dsSay(j.error); return; }
          dsLoad(); dsSay("captioned " + (j.captions || []).length + " image(s)");
        })
        .catch(function (e) { b.disabled = false; dsSay("auto caption failed: " + e.message); });
    };

    // ---- 2.216.0 (by instruction): the 🎭 Actors-in-the-scene dialog ------
    // A thumbnail grid of the WHOLE roster; click toggles; Save PUTs the ids
    // and the server rebuilds the reference chain around the chosen cast.
    var chCastSel = {};
    function chCastPaint(cs) {
      var g = el("chCastGrid");
      g.innerHTML = "";
      cs.forEach(function (c) {
        var on = !!chCastSel[c.id];
        var t = document.createElement("div");
        t.style.cssText = "width:104px;flex:none;cursor:pointer;text-align:center;"
          + "border:2px solid " + (on ? "var(--tiger,#e8a33d)" : "var(--line,#333)")
          + ";border-radius:10px;padding:6px;opacity:" + (on ? "1" : ".7");
        t.title = (on ? "In the scene — click to bench" : "Benched — click to cast") + ": " + c.name;
        var im;
        if (c.images && c.images.length) {
          im = document.createElement("img");
          im.src = "/api/characters/" + encodeURIComponent(c.name)
                 + "/file/" + encodeURIComponent(c.images[0]) + "?t=" + (c.updated || "");
          im.alt = c.name;
        } else {
          im = document.createElement("div");
          im.textContent = "🎭";
          im.style.lineHeight = "84px";
        }
        im.style.cssText += ";width:88px;height:84px;object-fit:cover;border-radius:8px;background:#20242c;font-size:2rem";
        var nm = document.createElement("div");
        nm.className = "hint";
        nm.textContent = (on ? "✔ " : "") + c.name;
        t.appendChild(im); t.appendChild(nm);
        t.addEventListener("click", function () {
          chCastSel[c.id] = !chCastSel[c.id];
          chCastPaint(cs);
        });
        g.appendChild(t);
      });
      var n = Object.keys(chCastSel).filter(function (k) { return chCastSel[k]; }).length;
      el("chCastMsg").textContent = n
        ? n + " actor(s) in the scene — the chain and the writer see only them"
        : "nobody selected — EVERYONE is in the scene";
    }
    el("chCastBtn").addEventListener("click", function () {
      fetch("/api/characters/cast").then(function (r) { return r.json(); })
        .then(function (d) {
          chCastSel = {};
          (d.active || []).forEach(function (id) { chCastSel[id] = true; });
          chCastPaint(d.characters || []);
          el("chCastDlg").showModal();
        }).catch(function () {});
    });
    el("chCastAll").addEventListener("click", function () {
      chCastSel = {};
      fetch("/api/characters/cast").then(function (r) { return r.json(); })
        .then(function (d) { chCastPaint(d.characters || []); }).catch(function () {});
    });
    el("chCastCancel").addEventListener("click", function () {
      try { el("chCastDlg").close(); } catch (e) { /* view only */ }
    });
    el("chCastSave").addEventListener("click", function () {
      var ids = Object.keys(chCastSel).filter(function (k) { return chCastSel[k]; });
      fetch("/api/characters/cast", { method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: ids }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) { el("chCastMsg").textContent = "⚠ " + d.error; return; }
          try { el("chCastDlg").close(); } catch (e) { /* view only */ }
          refresh();                          // cards show who is in the scene
        }).catch(function (e) { el("chCastMsg").textContent = "⚠ " + (e.message || e); });
    });

    // ---- 2.212.0 (by instruction): drops onto the New/Edit dialog ---------
    // The WHOLE dialog accepts pictures from the Gallery (type "output" —
    // ADOPTED first, the 2.19x lesson: an un-adopted gallery name is a name
    // the server cannot resolve), from Assets → Image (type "asset" — already
    // a resolvable name), from the References tray (type "refimg" — bytes),
    // and from the desktop (Files — bytes). Everything QUEUES; nothing
    // attaches until Save, the same moment picked files upload.
    (function chDropWire() {
      var dlg = el("chDlg");
      if (!dlg) return;
      var depth = 0;
      function lit(on) { dlg.classList.toggle("droptarget", on); }
      function wanted(e) {
        var hasFiles = e.dataTransfer && Array.prototype.indexOf.call(
          e.dataTransfer.types || [], "Files") >= 0;
        return hasFiles || !!chPayload();
      }
      // dragleave fires on every crossing onto a CHILD element, so the
      // highlight is counted in/out — the refs dock's own fix, reused.
      dlg.addEventListener("dragenter", function (e) {
        if (!wanted(e)) return; depth++; lit(true); });
      dlg.addEventListener("dragover", function (e) {
        if (!wanted(e)) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "copy";
      });
      dlg.addEventListener("dragleave", function () {
        if (--depth <= 0) { depth = 0; lit(false); } });
      dlg.addEventListener("drop", function (e) {
        if (!wanted(e)) return;
        e.preventDefault(); depth = 0; lit(false);
        // 2.265.0: when the DATASET tab is open, dropped files are dataset
        // images ("allow user to drag images into the tab") — never queued
        // as character sheets.
        var dsTab = el("chTabDataset");
        if (dsTab && dsTab.style.display !== "none"
            && e.dataTransfer.files && e.dataTransfer.files.length) {
          dsAddFiles(e.dataTransfer.files);
          return;
        }
        var p = chPayload();
        function preview(url) {   // an empty thumb shows the first drop
          var im = el("chDlgThumb");
          if (im && !im.getAttribute("src") && url) im.src = url;
        }
        if (!p && e.dataTransfer.files && e.dataTransfer.files.length) {
          var n = 0;
          Array.prototype.forEach.call(e.dataTransfer.files, function (f) {
            if (/^image\//.test(f.type || "")) {
              chDropQueue.push({ blob: f }); n++;
              try { preview(URL.createObjectURL(f)); } catch (er) {}
            }
          });
          el("chDlgMsg").textContent = n
            ? n + " picture(s) queued from your computer"
            : "only pictures can be character sheets";
          chDropCount();
          return;
        }
        if (!p) return;
        if (p.type === "refimg") {
          var r = chTrayRef(p.refIndex);
          if (r && r.file) {
            chDropQueue.push({ blob: r.file });
            preview(r.url || "");
            el("chDlgMsg").textContent = "queued "
              + (r.file.name || "the tray picture") + " from the References tray";
          } else el("chDlgMsg").textContent = "could not read that tray picture";
          chDropCount();
          return;
        }
        if (p.kind !== "images") {
          el("chDlgMsg").textContent = (p.name || "that")
            + " is not a picture — only pictures can be character sheets";
          return;
        }
        if (p.type === "asset") {
          chDropQueue.push({ file: p.name });
          preview("/passets/images/" + encodeURIComponent(p.name));
          el("chDlgMsg").textContent = "queued " + p.name + " from the Images assets";
          chDropCount();
          return;
        }
        if (p.type === "output") {
          el("chDlgMsg").textContent = "adopting " + p.name + " from the gallery…";
          chAdoptImage(p.name).then(function (d) {
            chDropQueue.push({ file: d.name });
            preview("/passets/images/" + encodeURIComponent(d.name));
            try { if (window.refreshAssets) window.refreshAssets(); } catch (er) {}
            el("chDlgMsg").textContent = "queued " + d.name
              + (d.name !== p.name ? " (renamed — " + p.name + " was taken)" : "")
              + " from the gallery";
            chDropCount();
          }).catch(function (er) {
            el("chDlgMsg").textContent = "could not adopt " + p.name + ": "
              + (er.message || er);
          });
          return;
        }
      });
    })();
    // 2.224.0: the Clothing tab's ＋ — reads the picture into the queue;
    // it attaches when Save / Add character is pressed (the drop-queue
    // pattern: a cancel abandons it).
    if (el("chClothAdd")) el("chClothAdd").addEventListener("click", function () {
      var f = el("chClothFile").files && el("chClothFile").files[0];
      var type = (el("chClothType").value || "").trim();
      if (!type) { el("chClothMsg").textContent = "a clothing entry needs a type (jacket, armor…)"; return; }
      if (!f) { el("chClothMsg").textContent = "pick a clothing picture first"; return; }
      chClothQueue.push({ blob: f, name: f.name, type: type,
                          color: (el("chClothColor").value || "").trim(),
                          notes: (el("chClothNotes").value || "").trim() });
      el("chClothFile").value = ""; el("chClothType").value = "";
      el("chClothColor").value = ""; el("chClothNotes").value = "";
      el("chClothMsg").textContent = "";
      chClothPaint();
    });
    // 2.225.0: 🧬 Extract RefMod — the dataset folder becomes a tiny H3
    // identity mod; on a verified landing the profile remembers it and
    // H3_Video_Ref renders ride the mod instead of the sheet.
    var chRefmodPoll = null;
    if (el("chRefmod")) el("chRefmod").addEventListener("click", function () {
      var name = chEditing || (el("chName").value || "").trim();
      if (!name || !chProfiles[name]) {
        el("chDlgMsg").textContent = "save the character first — the RefMod "
          + "extracts from their dataset folder";
        return;
      }
      el("chDlgMsg").textContent = "queuing RefMod extraction…";
      scPost("/api/characters/" + encodeURIComponent(name) + "/refmod", {})
        .then(function (d) {
          if (!d || !d.id) {
            el("chDlgMsg").textContent = (d && d.error) || "extraction refused";
            return;
          }
          el("chDlgMsg").textContent = "extracting " + d.mod + " from "
            + d.pictures + " dataset picture(s)… (job " + d.id + ")";
          clearInterval(chRefmodPoll);
          chRefmodPoll = setInterval(function () {
            fetch("/api/jobs/" + encodeURIComponent(d.id))
              .then(function (r) { return r.json(); })
              .then(function (j) {
                if (j.status === "running" || j.status === "queued") return;
                clearInterval(chRefmodPoll);
                if (j.status !== "done") {
                  el("chDlgMsg").textContent = "extraction " + j.status
                    + " — the Queue dock has the log";
                  return;
                }
                // done: VERIFY the safetensors landed, then remember it
                scPost("/api/characters/" + encodeURIComponent(name)
                       + "/refmod/adopt", { mod: d.mod })
                  .then(function (a) {
                    if (a && a.ok) {
                      if (chProfiles[name]) chProfiles[name].refmod = a.mod;
                      el("chDlgMsg").textContent = "🧬 " + a.mod + " extracted ("
                        + a.size + ") — H3_Video_Ref renders now ride the mod";
                      refresh();
                    } else el("chDlgMsg").textContent =
                      (a && a.error) || "the mod did not land — see the job log";
                  });
              }).catch(function () {});
          }, 2000);
        });
    });
    // 2.228.0 (by instruction): the DATASET buttons — 📁 makes the folder
    // real and browsable now; ＋📁 adds picked files through the SAME
    // landing every 2.224.0 flow rides. The dataset belongs to a SAVED
    // character (the 🧬 guard, same wording).
    function chDatasetName(msgEl) {
      var name = chEditing || (el("chName").value || "").trim();
      if (!name || !chProfiles[name]) {
        msgEl.textContent = "save the character first — the dataset "
          + "belongs to a saved character";
        return "";
      }
      return name;
    }
    function chDatasetSend(name, files, msgEl) {
      if (!files || !files.length) return;
      var fd = new FormData();
      for (var i = 0; i < files.length; i++)
        fd.append("files", files[i], files[i].name);
      msgEl.textContent = "adding " + files.length + " file(s) to "
        + name + "'s dataset…";
      fetch("/api/characters/" + encodeURIComponent(name) + "/dataset/file",
            { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.added && d.added.length) {
            msgEl.textContent = "＋📁 " + d.added.length + " file(s) in "
              + name + "'s dataset"
              + ((d.notes || []).length ? " — " + d.notes.join("; ") : "");
          } else msgEl.textContent = (d && (d.error
            || (d.notes || []).join("; "))) || "nothing was added";
        }).catch(function (er) { msgEl.textContent = String(er); });
    }
    if (el("chDatasetMake")) el("chDatasetMake").addEventListener("click", function () {
      var name = chDatasetName(el("chDlgMsg"));
      if (!name) return;
      scPost("/api/characters/" + encodeURIComponent(name) + "/dataset", {})
        .then(function (d) {
          el("chDlgMsg").textContent = d && d.ok
            ? "📁 dataset folder ready — " + d.files + " file(s) in it: " + d.dir
            : (d && d.error) || "could not create the dataset folder";
        });
    });
    if (el("chDatasetAdd")) el("chDatasetAdd").addEventListener("click", function () {
      if (chDatasetName(el("chDlgMsg"))) el("chDatasetFile").click();
    });
    if (el("chDatasetFile")) el("chDatasetFile").addEventListener("change", function () {
      var name = chDatasetName(el("chDlgMsg"));
      if (name) chDatasetSend(name, el("chDatasetFile").files, el("chDlgMsg"));
      el("chDatasetFile").value = "";
    });
    if (el("chSheetDataset")) el("chSheetDataset").addEventListener("click", function () {
      var name = chDatasetName({ set textContent(v) { chSheetSay(v); } });
      if (name) el("chSheetDatasetFile").click();
    });
    if (el("chSheetDatasetFile")) el("chSheetDatasetFile").addEventListener("change", function () {
      var sink = { set textContent(v) { chSheetSay(v); } };
      var name = chDatasetName(sink);
      if (name) chDatasetSend(name, el("chSheetDatasetFile").files, sink);
      el("chSheetDatasetFile").value = "";
    });
    el("chSave").addEventListener("click", save);
    el("chBuild").addEventListener("click", build);
    refresh();
    envInit();
    scInit();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
  window.bgCharacters = { refresh: refresh, build: build, card: card };
  window.bgScenes = { refresh: scRefresh, maybeScreenplay: maybeScreenplay,
                      select: scSelect };
})();
