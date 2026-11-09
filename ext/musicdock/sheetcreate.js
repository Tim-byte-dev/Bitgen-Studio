/* bitGen Studio — ✨ CREATE (2.739.0): a song in, its layers + its sheet music out, in one press. window.SheetCreate.
 *
 * Tim (verbatim): "add a button - Create - this will use the audio file + lyrics from song or loaded file or transcribed
 * file, split the stems show the different waveforms and create the sheet music - i think this will make it less
 * complicated"
 *
 * The Sheet Music tab's make bar: Song = any song in the project (the Song tab's title picks its own) or 📂 a song from
 * this computer (copied into the project - POST /api/stems/upload); ✨ Create then
 *   1 SPLIT     the song into its four layers (POST /api/stems/separate {layers: 4}; skipped when it is split already) -
 *               their waveforms show under the player at once (MuScore.previewLayers);
 *   2 LYRICS    the Song tab's lyrics, or - when that box is empty - the words heard in the vocal layer
 *               (POST /api/asr/transcribe {mode: "lyrics"}), put in the Song tab's lyrics box;
 *   3 SHEET     the score transcribed from the song (the same music job as 📜 Transcribe: window.MuVariantJob), linked to
 *               the song (it plays it, in its layers) and drawn with the words under the vocal staff.
 * Each step shows in #muCreateSteps; a failure stops there and says why. */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const M = () => root.MuScore;
  const FILE = "__file";
  let busy = false, last = "";
  function status(t) { const el = $("muSheetStatus"); if (el) el.textContent = t; }
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  const songs = () => (M() && M().state.songs) || [];
  const find = (key) => songs().find((x) => x.src + "/" + x.name === key) || null;

  /** the Song list: the project's songs, newest first, then 📂 from this computer; the Song tab's title picks its song */
  function fill(prefer) {
    const sel = $("muCreateSrc");
    if (!sel || !M()) return;
    const keep = prefer || sel.value, L = songs();
    sel.innerHTML = (L.length ? "" : '<option value="">— no songs in the project yet —</option>')
      + L.map((x) => `<option value="${esc(x.src + "/" + x.name)}">🎵 ${esc(x.name)}${x.layers && x.layers.drums ? " · split" : ""}</option>`).join("")
      + `<option value="${FILE}">📂 A song from this computer…</option>`;
    if (keep && keep !== FILE && find(keep)) { sel.value = keep; return; }
    const t = M().baseOf((($("muTitle") || {}).value) || "");
    const m = t && L.find((x) => M().baseOf(x.name) === t);
    sel.value = m ? m.src + "/" + m.name : L.length ? L[0].src + "/" + L[0].name : "";
    last = sel.value;
  }
  function steps(state) {                               // {split, lyrics, sheet: "" | "doing" | "done" | "skip" | "fail"}
    const box = $("muCreateSteps");
    if (!box) return;
    if (!state) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = [["split", "Split"], ["lyrics", "Lyrics"], ["sheet", "Sheet music"]].map(([k, n], i) =>
      `<span class="muStep" data-step="${k}" data-state="${state[k] || ""}">${i + 1} ${n}</span>`).join("");
  }
  const post = (url, body) => root.fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json().then((j) => { if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status)); return j; }));

  /** 📂 a song from this computer: copied into the project's sound folder (the same song again reuses its copy) */
  function upload(file) {
    status("bringing " + file.name + " into the project…");
    const fd = new FormData();
    fd.append("file", file, file.name);
    return root.fetch("/api/stems/upload", { method: "POST", body: fd }).then((r) => r.json()).then((j) => {
      if (j.error) throw new Error(j.error);
      return M().refresh().then(() => { fill("sound/" + j.name); status("🎵 " + j.name + " is in the project - ✨ Create makes its layers and its sheet music"); test("mu_create_upload", j.name); return j.name; });
    }).catch((e) => { status("⚠ " + file.name + " could not be added: " + ((e && e.message) || e)); fill(last); return null; });
  }

  async function create() {
    if (busy || !M()) return null;
    const sel = $("muCreateSrc"), btn = $("goSheetCreate");
    let song = sel ? find(sel.value) : null;
    if (!song) { status(sel && sel.value === FILE ? "pick the song file first" : "pick a song first - one from the project, or 📂 from this computer"); return null; }
    busy = true;
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Creating…"; }
    const st = { split: "doing", lyrics: "", sheet: "" };
    let at = "split";
    steps(st);
    try {
      // 1 the layers
      if (!(song.layers && song.layers.drums)) {
        // 2.740.0 (Tim: "if a model needs to be installed show the download/cancel msgbox and download the model instead of
        // asking user to find install"): the separation not installed = the ⬇ Download / Cancel box, then on from here
        if (root.H3NeedInstall && !(await root.H3NeedInstall.ensure("demucs", "✨ Create splits the song into its layers with it."))) throw new Error("the song separation is not installed - ⬇ Download it in the box, then ✨ Create again");
        status("✨ 1 / 3 - splitting " + song.name + " into vocals, drums, bass and the rest (demucs, on this computer)…");
        await post("/api/stems/separate", { file: song.name, layers: 4 });
        await M().refresh();
        song = find(song.src + "/" + song.name) || song;
        fill(song.src + "/" + song.name);
        if (!(song.layers && song.layers.drums)) throw new Error("the split finished but its four layers are not in the sound folder");
      }
      st.split = "done";
      M().previewLayers(song);
      // 2 the words
      at = "lyrics"; st.lyrics = "doing"; steps(st);
      const box = $("muLyrics");
      let words = String((box && box.value) || "").trim(), from = "the Song tab's";
      if (!words) {
        status("✨ 2 / 3 - listening to the vocals for the words…");
        try {
          if (root.H3NeedInstall && !(await root.H3NeedInstall.ensure("whisper", "✨ Create listens to the vocals with it for the words - the Song tab's lyrics box is empty. Cancel = the sheet music without words.")))
            throw new Error("speech to text is not installed");
          const j = await post("/api/asr/transcribe", { name: song.layers.vocals, mode: "lyrics" });
          words = String(j.text || "").trim();
          if (words && box) { box.value = words; box.dispatchEvent(new Event("input", { bubbles: true })); }
          from = "heard from the vocals";
        } catch (e) { words = ""; from = "none - " + ((e && e.message) || e); }
      }
      st.lyrics = words ? "done" : "skip";
      // 3 the sheet music
      at = "sheet"; st.sheet = "doing"; steps(st);
      status("✨ 3 / 3 - writing the sheet music of " + song.name + "…");
      const blob = await root.fetch(M().urlOf(song.src, song.name)).then((r) => { if (!r.ok) throw new Error(song.name + " could not be read"); return r.blob(); });
      const file = new root.File([blob], song.name, { type: blob.type || "audio/wav" });
      const job = await new Promise((resolve, reject) => {
        if (typeof root.MuVariantJob !== "function") { reject(new Error("the music docker's job runner is not loaded")); return; }
        root.MuVariantJob({ variant: "abc", refFile: file, needLyrics: false, statusId: "muSheetStatus", doing: "✨ 3 / 3 - writing the sheet music", done: resolve, fail: reject });
      });
      const abc = job && (job.output || (job.outputs || [])[0]);
      if (!abc) throw new Error("the transcription finished but no .abc came back - see the Console");
      M().linkSong(abc, song);                           // the score plays this song, in its layers
      const tick = $("muScoreWords");
      if (tick && words && !tick.checked) { tick.checked = true; try { root.localStorage.setItem("h3.muScoreWords", "1"); } catch (e) { /* this page */ } }
      await M().refresh(abc);
      await M().load(abc);
      st.sheet = "done"; steps(st);
      status("✨ " + abc + " - the sheet music of " + song.name + ", its four layers under the player"
        + (words ? ", the words " + (from === "the Song tab's" ? "from the Song tab" : from) + " under the notes" : " (no words: " + from.replace(/^none - /, "") + ")"));
      test("mu_create", abc + " " + song.name);
      return { abc, song: song.name, words: !!words };
    } catch (e) {
      st[at] = "fail"; steps(st);
      status("⚠ ✨ Create stopped at " + ({ split: "the split", lyrics: "the words", sheet: "the sheet music" })[at] + ": " + ((e && e.message) || e));
      return null;
    } finally {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = "✨ Create"; }
    }
  }

  doc.addEventListener("click", (e) => {
    const t = e.target && e.target.closest ? e.target : null;
    if (t && t.closest("#goSheetCreate")) { e.preventDefault(); create(); }
  });
  doc.addEventListener("change", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === "muCreateSrc") {
      if (t.value === FILE) { const f = $("muSheetRef"); if (f) { f.value = ""; f.click(); } }
      else last = t.value;
      return;
    }
    if (t.id === "muSheetRef" && $("muCreateSrc")) {
      const f = t.files && t.files[0];
      if (f) upload(f); else fill(last);
    }
  });
  // the list follows the project's songs (MuScore.refresh) - filled when the tab's list is
  doc.addEventListener("h3:muscores", () => fill());
  root.SheetCreate = { create, fill, upload, busy: () => busy };
}(typeof window !== "undefined" ? window : this));
