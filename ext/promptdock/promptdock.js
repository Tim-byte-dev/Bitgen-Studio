/* bitGen Studio — promptdock's OWN wiring (2.233.0, PICTURES IN THE PROMPT,
   Tim verbatim: "can we add another dropdown under prompt to choose the
   vision model, and a + button to add image/images to the prompt? layout the
   prompt images like this website does. Add a Describe Image checkbox to the
   prompt menubar").

   The promptdock stays a HYBRID docker (the 2.223.14 standing ruling —
   chatSend/generate are shared services and live in core); this file is
   exactly the docker's private feature: the attachment chips, the vision
   dropdown and the describe toggle. Core's chatSend consults ONE seam,
   window.pdChatForm(text, ctx, llmFile) — it answers a FormData when chips
   are attached (and clears them: "the chips clear when the message sends")
   or null, in which case the JSON call rides exactly as it always has.
   Without this extension installed the seam is undefined and core behaves
   as before — the hybrid contract. */
(function () {
  function $(id) { return document.getElementById(id); }
  /* 2.233.8 (the seventh field report finally carried data: server listed
     2 files, dropdown empty): the assembled page emits ext <script> tags
     BEFORE the core inline script, so core's lexically-declared store is
     in the temporal dead zone here — reading it at load threw a
     ReferenceError and this whole IIFE died before wiring the dropdown;
     the static "(no vision models …)" placeholder was all Tim could ever
     see, on a fully CURRENT install. An ext script may only touch core
     globals inside DEFERRED handlers (musicdock's rule); load-time
     persistence uses this self-contained helper (same "h3." keyspace, so
     existing values carry over). */
  const pref = {
    get: (k, d) => { try { return localStorage.getItem("h3." + k) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem("h3." + k, v); } catch { /* private mode */ } },
  };

  /* ---------------- attachments: ＋ button, chips, drag-drop ------------- */
  let pdFiles = [];                       // File objects, send order

  function pdPaint() {
    const strip = $("pdChips");
    if (!strip) return;
    strip.innerHTML = "";
    strip.classList.toggle("hidden", !pdFiles.length);
    pdFiles.forEach((f, i) => {
      const chip = document.createElement("div");
      chip.className = "pdchip";
      chip.style.cssText = "position:relative;width:44px;height:44px;"
        + "border-radius:8px;overflow:hidden;border:1px solid var(--line,#444);"
        + "flex:0 0 auto";
      chip.title = f.name;
      const img = document.createElement("img");
      img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
      try { img.src = URL.createObjectURL(f); } catch { /* jsdom / odd blob */ }
      const x = document.createElement("button");
      x.className = "pdchipx";
      x.textContent = "✕";
      x.title = "Remove " + f.name;
      x.style.cssText = "position:absolute;top:0;right:0;width:16px;height:16px;"
        + "line-height:14px;font-size:10px;padding:0;border:0;cursor:pointer;"
        + "background:rgba(0,0,0,.65);color:#fff;border-radius:0 0 0 6px;"
        + "opacity:0";
      chip.onmouseenter = () => { x.style.opacity = "1"; };
      chip.onmouseleave = () => { x.style.opacity = "0"; };
      x.onclick = () => { pdFiles.splice(i, 1); pdPaint(); };
      chip.appendChild(img); chip.appendChild(x);
      strip.appendChild(chip);
    });
  }

  // 2.270.0 (Tim: "user will be able to add the vocal stem to the prompt
  // docker using the + button. automatically split the track into 15
  // second files, and add them to each scene as audio reference"): an
  // AUDIO pick never becomes a chip — it posts to /api/stems/split, the
  // server cuts music/temp/<base>_<n>.<ext> and binds segment n to scene n
  // as that scene's own soundtrack reference; #pdStemNote reports.
  const PD_AUDIO_RE = /\.(wav|mp3|flac|ogg|m4a)$/i;

  function pdStemNote(text, busy) {
    const el = $("pdStemNote");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("hidden", !text);
    el.style.opacity = busy ? ".6" : ".8";
  }

  async function pdSplitStem(f) {
    pdStemNote("✂🎤 splitting " + f.name + " into 15s scene segments…", true);
    try {
      const fd = new FormData();
      fd.append("file", f, f.name);
      const r = await fetch("/api/stems/split", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
      const n = (j.files || []).length;
      const a = (j.assigned || []).length;
      pdStemNote("🎬 " + j.base + ": " + n + " × " + (j.seconds || 15)
        + "s segment(s) in music/temp"
        + (a ? " — scenes 1–" + a + " each carry their own slice as an audio reference"
             : "")
        + (j.note ? " (" + j.note + ")" : ""));
    } catch (e) {
      pdStemNote("✂🎤 split failed: " + (e && e.message ? e.message : e));
    }
  }

  function pdAdd(list) {
    for (const f of list || []) {
      if (PD_AUDIO_RE.test(f.name || "") || /^audio\//i.test(f.type || "")) {
        pdSplitStem(f);
        continue;
      }
      if (!/^image\/(png|jpeg|webp)$/i.test(f.type || "")) continue;
      pdFiles.push(f);
    }
    pdPaint();
  }

  $("pdAttachBtn") && ($("pdAttachBtn").onclick = () => {
    const inp = $("pdAttachFile");
    if (inp) { inp.value = ""; inp.click(); }
  });
  $("pdAttachFile") && ($("pdAttachFile").onchange = (e) => pdAdd(e.target.files));

  // drag-drop onto the composer adds too (the imagedock drop pattern)
  const composer = $("prompt") && $("prompt").closest(".pleft");
  if (composer) {
    composer.addEventListener("dragover", (e) => { e.preventDefault(); });
    composer.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files) pdAdd(e.dataTransfer.files);
    });
  }

  /* --------------- 🖼 Describe image: persisted menubar toggle ----------- */
  if ($("pdDescribe")) {
    $("pdDescribe").checked = pref.get("pdDescribe", "1") !== "0";
    $("pdDescribe").onchange = () =>
      pref.set("pdDescribe", $("pdDescribe").checked ? "1" : "0");
  }

  /* --------------- Vision dropdown: /api/captioner/models ---------------- */
  async function pdVisionLoad() {
    const sel = $("visionSel");
    if (!sel) return;
    let models = [], note = "", app = "", current = "";
    try {
      const j = await (await fetch("/api/captioner/models")).json();
      models = j.models || [];
      note = j.note || "";
      app = j.app || "";
    } catch { /* server away — the empty option says what to do */ }
    // 2.233.5: ALWAYS say which server code answered and how many files it
    // listed — "still not populating" against this line tells stale server
    // from empty folder in one glance.
    console.log("[vision] server v" + (app || "pre-2.233.5 (UPDATE THE CORE + RESTART)")
      + " — " + models.length + " file(s) listed");
    try {
      const cfg = await (await fetch("/api/config")).json();
      current = ((cfg.captioner || {}).model) || "";
    } catch { /* keep "" */ }
    sel.innerHTML = "";
    if (!models.length) {
      const o = document.createElement("option");
      o.value = ""; o.textContent = "(no vision models - run get-qwen3vl.ps1)";
      sel.appendChild(o);
      // 2.233.2: the WHY rides the tooltip and the browser console — every
      // scanned folder with its .gguf/mmproj census, straight from the
      // server, so an empty list names its own cause.
      if (note) { sel.title = note; console.log("[vision] " + note); }
      return;
    }
    sel.title = "Vision model for 🖼 Describe image";
    for (const m of models) {
      const o = document.createElement("option");
      o.value = m.model;                 // the absolute path config wants
      o.dataset.mmproj = m.mmproj || "";
      // 2.233.4 ("scan for all models"): a model without a projector LISTS,
      // tagged — picking it launches without --mmproj and a failed describe
      // says why in words instead of the model being invisibly hidden.
      o.textContent = m.name + (m.mmproj ? "" : " (no mmproj)");
      if (m.model === current) o.selected = true;
      sel.appendChild(o);
    }
    // nothing picked yet: adopt the first pair so the checkbox works out of
    // the box (the selection is SAVED, so it shows in config immediately)
    if (!current && sel.options.length) { sel.selectedIndex = 0; pdVisionSave(); }
  }

  function pdVisionSave() {
    const sel = $("visionSel");
    if (!sel || !sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    fetch("/api/config", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captioner: { model: sel.value,
        mmproj: (opt && opt.dataset.mmproj) || "" } }),
    }).catch(() => { /* said by the next describe attempt */ });
  }

  if ($("visionSel")) {
    $("visionSel").onchange = pdVisionSave;
    // a freshly downloaded pair is one focus away — refetch on focus, the
    // same freshness rule the lora dropdown follows on dialog open
    $("visionSel").addEventListener("focus", pdVisionLoad);
    pdVisionLoad();
  }

  /* --------------- 2.234.0: "loading vision model" in the statusbar ------ */
  /* While a describe is in flight the vision llama-server may spend up to
     three minutes loading; the core statusbar's #sbvis span (a bare hidden
     span — core carries markup only, the feature lives here per the hybrid
     ruling) shows "loading vision model…" for exactly that window, polled
     from GET /api/captioner/status. All DOM/fetch work happens in DEFERRED
     handlers (the 2.233.8 TDZ rule); an older core without #sbvis is a
     silent no-op. */
  let pdVisTimer = null;
  function pdVisText(t) {
    const sb = $("sbvis");
    if (!sb) return;
    sb.textContent = t || "";
    sb.classList.toggle("hidden", !t);
  }
  function pdVisionWatch() {
    if (pdVisTimer) return;                    // one watcher at a time
    const t0 = Date.now();
    let calm = 0;                              // consecutive not-loading polls
    const tick = async () => {
      let s = null;
      try { s = await (await fetch("/api/captioner/status")).json(); } catch { s = null; }
      if (s && s.loading) {
        calm = 0;
        pdVisText("loading vision model…" + (s.model ? " (" + s.model + ")" : ""));
      } else {
        calm++;
        if (s && s.last_error && calm === 1) pdVisText("Vision: failed — see Console (🖼 Vision)");
        else if (s && s.ready && calm === 1) pdVisText("Vision: ready");
        else if (calm >= 3) {                  // settled: ready shown, or gone
          pdVisText("");
          clearInterval(pdVisTimer); pdVisTimer = null;
          return;
        }
      }
      if (Date.now() - t0 > 240000) {          // 4-min lifetime, whatever happens
        pdVisText(""); clearInterval(pdVisTimer); pdVisTimer = null;
      }
    };
    pdVisTimer = setInterval(tick, 1000);
    tick();
  }

  /* --------------- the ONE seam core's chatSend consults ----------------- */
  window.pdChatForm = function (text, ctx, llmFile) {
    if (!pdFiles.length) return null;
    // pictures riding with 🖼 Describe on = the vision model may be about
    // to load — watch the statusbar until it settles
    if (!$("pdDescribe") || $("pdDescribe").checked) pdVisionWatch();
    const fd = new FormData();
    fd.append("text", text);
    fd.append("llm_file", llmFile || "");
    fd.append("context", JSON.stringify(ctx || {}));
    fd.append("describe",
      $("pdDescribe") && !$("pdDescribe").checked ? "0" : "1");
    for (const f of pdFiles) fd.append("images", f, f.name);
    pdFiles = []; pdPaint();             // the chips clear when the message sends
    return fd;
  };

  /* ---- 2.257.0 (by instruction): the vertical prompt toolbar ----------
     Icon-only buttons left of the input. Each adds its phrase to the
     prompt ONCE - already there (any case) = nothing happens. The
     phrase is PREPENDED so the chat reads the intent before the
     subject, and an input event follows so the token estimate stays
     live. */
  function ptAdd(phrase) {
    var t = document.getElementById("prompt");
    if (!t) return;
    if (t.value.toLowerCase().indexOf(phrase.toLowerCase()) !== -1) { t.focus(); return; }
    var rest = t.value.replace(/^\s+/, "");
    t.value = phrase + (rest ? " " + rest : " ");
    t.dispatchEvent(new Event("input", { bubbles: true }));
    t.focus();
  }
  var PT_PHRASES = {
    ptScreenplay: "create screenplay",
    ptImage: "create image prompt from image",
    ptVideo: "create video prompt",
    ptSong: "create song",
    // 2.270.0 (by instruction): the phrase is also the music_video LLM
    // addendum's own match — pressing 🎤 teaches the writer the lyric
    // lock and clip grid on the very next send
    ptMusicVideo: "create music video",
  };
  Object.keys(PT_PHRASES).forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", function () { ptAdd(PT_PHRASES[id]); });
  });
})();
