/* bitGen Studio — ext/sfxdock/sfxclone.js (2.974.0): the SFX docker's 🧬 CLONE A VOICE (window.H3VoiceClone).
 *
 * Tim (verbatim): "in the sfx tab add clone voice, then add that voice to read the text. add the saved file to the gallery. the
 * clone voice will show a wave form and the user will be able to select a region of the waveform with a draggable start marker
 * and a draggable end marker to use as the sample"
 *   1  the voice: 📂 an audio / video file, 🎙 a recording, or a sound of this project (the Audio assets, the gallery, My samples)
 *   2  its waveform with a START and an END marker - drag them (or the shaded region between them to move both), or type the
 *      seconds; ▶ plays just that part; the length is checked against what the engines like (OmniVoice 3-10 s, others 10-30 s)
 *   3  a name + (optional) the words spoken in the part - ✍ writes them for you (the speech-to-text model)
 *   4  🧬 Save voice -> POST /api/tts/voices (the file + start / end: the server cuts it and stores a 44.1 kHz mono WAV in the
 *      voice store, the same store Settings ▸ Audio ▸ Voices and the chat use) - then the voice is PICKED in 🗣 Speech & dialog
 *      below, ready to read the text (that file is saved in the Audio assets AND the gallery's Audio tab - lib/speechDialog.js)
 * Pure parts (Node: scripts/test-974.js): peaks(), clampRegion(), fmtS(), quality(). */
(function (root) {
  "use strict";
  const MIN_LEN = 0.5;
  /** the waveform: min / max per column of a channel (Float32Array) */
  function peaks(data, cols) {
    const n = data.length, c = Math.max(1, cols | 0), out = new Float32Array(c * 2), per = n / c;
    for (let i = 0; i < c; i++) {
      let lo = 1, hi = -1; const a = Math.floor(i * per), b = Math.max(a + 1, Math.floor((i + 1) * per));
      for (let k = a; k < b && k < n; k++) { const v = data[k]; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (lo > hi) { lo = 0; hi = 0; }
      out[i * 2] = lo; out[i * 2 + 1] = hi;
    }
    return out;
  }
  /** a region kept inside 0..dur, at least MIN_LEN long; which = the marker being moved ("a" | "b" | "both") */
  function clampRegion(a, b, dur, which) {
    dur = Math.max(0, +dur || 0); let A = +a || 0, B = +b || 0;
    if (which === "both") { const len = Math.min(dur, Math.max(MIN_LEN, B - A)); A = Math.max(0, Math.min(dur - len, A)); B = A + len; }
    else {
      A = Math.max(0, Math.min(dur, A)); B = Math.max(0, Math.min(dur, B));
      if (B - A < MIN_LEN) { if (which === "a") A = Math.max(0, B - MIN_LEN); else B = Math.min(dur, A + MIN_LEN); if (B - A < MIN_LEN) { A = Math.max(0, B - MIN_LEN); } }
    }
    return { a: +A.toFixed(3), b: +B.toFixed(3) };
  }
  function fmtS(t) { t = Math.max(0, +t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2); }
  /** how good a sample of that length is for cloning: {ok, level: good | short | long, text} */
  function quality(len, engine) {
    const omni = engine !== "openaudio";
    if (len < 3) return { ok: true, level: "short", text: "only " + len.toFixed(1) + " s - 3 s or more clones far better" };
    if (omni && len > 12) return { ok: true, level: "long", text: len.toFixed(1) + " s - OmniVoice clones best from 3-10 s" };
    if (len > 60) return { ok: true, level: "long", text: len.toFixed(0) + " s - long samples slow every reading" };
    return { ok: true, level: "good", text: len.toFixed(1) + " s - a good length" };
  }
  const pure = { peaks, clampRegion, fmtS, quality, MIN_LEN };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the box ================================ */
  const doc = root.document, $ = (id) => doc.getElementById(id);
  if (!doc || !$("vcBox")) { root.H3VoiceClone = pure; return; }
  const S = { blob: null, fileName: "", buf: null, dur: 0, a: 0, b: 0, pk: null, drag: null, src: null, playT: 0, playAt: 0, rec: null, chunks: [], engine: "omnivoice" };
  const say = (t, bad) => { const m = $("vcMsg"); m.textContent = t || "—"; m.classList.toggle("bad", !!bad); };
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  let AC = null;
  const ctx = () => { if (!AC) AC = new (root.AudioContext || root.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; };

  /* ---- the sound in ---- */
  async function take(blob, name) {
    stopPlay();
    say("reading " + name + "…");
    try {
      const ab = await blob.arrayBuffer();
      const buf = await ctx().decodeAudioData(ab.slice(0));
      S.blob = blob; S.fileName = name; S.buf = buf; S.dur = buf.duration;
      const ch = buf.getChannelData(0); S.pk = null; S.raw = ch;
      // the first 10 s (OmniVoice's sweet spot), or the whole of a shorter sound
      const r = clampRegion(0, Math.min(buf.duration, 10), buf.duration, "b"); S.a = r.a; S.b = r.b;
      if (!$("vcName").value) $("vcName").value = String(name).replace(/\.[a-z0-9]+$/i, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "my_voice";
      $("vcWave").hidden = false; $("vcEdit").hidden = false;
      paint(); say("🎚 drag the START and END markers to the part to clone (just one voice, no music) - ▶ plays it");
    } catch (e) { say("⚠ could not read that sound - " + (e.message || e), true); }
  }
  function fromFile(f) { if (f) take(f, f.name); }
  async function fromProject(v) {
    if (!v) return;
    const m = /^(\w+):(.*)$/.exec(v); if (!m) return;
    try {
      const r = await fetch("/api/synth/source/" + m[1] + "/" + encodeURIComponent(m[2]));
      if (!r.ok) throw new Error("HTTP " + r.status);
      await take(await r.blob(), m[2]);
    } catch (e) { say("⚠ " + (e.message || e), true); }
  }
  async function listProject() {
    const sel = $("vcProj");
    try {
      const j = await (await fetch("/api/synth/sources")).json(), G = {};
      (j.groups || []).forEach((g) => { G[g.id] = g.items || []; });
      const NAMES = { snd: "Audio assets", out: "Gallery (Audio)", my: "My samples" };
      const keep = sel.value;
      sel.innerHTML = '<option value="">🎵 a sound of this project…</option>' + ["snd", "out", "my"].filter((k) => G[k] && G[k].length).map((k) =>
        '<optgroup label="' + NAMES[k] + '">' + G[k].map((x) => { const n = typeof x === "string" ? x : (x.name || x.file); return '<option value="' + k + ":" + esc(n) + '">' + esc(n) + "</option>"; }).join("") + "</optgroup>").join("");
      sel.value = keep;
    } catch (e) { /* the list stays */ }
  }
  async function record() {
    if (S.rec) { S.rec.stop(); return; }
    try {
      const st = await root.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false } });
      const mr = new root.MediaRecorder(st); S.chunks = []; S.rec = mr;
      mr.ondataavailable = (e) => { if (e.data && e.data.size) S.chunks.push(e.data); };
      mr.onstop = () => { st.getTracks().forEach((t) => t.stop()); S.rec = null; $("vcRec").textContent = "🎙 Record"; $("vcRec").classList.remove("on");
        const b = new root.Blob(S.chunks, { type: mr.mimeType || "audio/webm" }); take(b, "recording_" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".webm"); };
      mr.start(); $("vcRec").textContent = "■ Stop"; $("vcRec").classList.add("on");
      say("🎙 recording - read anything for 10-20 s in your own voice, then ■ Stop");
    } catch (e) { say("⚠ no microphone - " + (e.message || e), true); }
  }

  /* ---- the waveform and the markers ---- */
  const X = (t, w) => (S.dur ? t / S.dur : 0) * w;
  function paint() {
    const cv = $("vcCanvas"); if (!cv || !S.buf) return;
    const dpr = Math.min(2, root.devicePixelRatio || 1), w = Math.max(200, cv.clientWidth || 600), h = cv.clientHeight || 110;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); S.pk = null; }
    if (!S.pk) S.pk = peaks(S.raw, w);
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    g.fillStyle = "#07090c"; g.fillRect(0, 0, w, h);
    const ax = X(S.a, w), bx = X(S.b, w), mid = h / 2;
    g.fillStyle = "rgba(56,225,255,.12)"; g.fillRect(ax, 0, bx - ax, h);
    for (let i = 0; i < w; i++) {
      const lo = S.pk[i * 2], hi = S.pk[i * 2 + 1], inR = i >= ax && i <= bx;
      g.fillStyle = inR ? "#38e1ff" : "#3a4250";
      g.fillRect(i, mid - hi * (mid - 4), 1, Math.max(1, (hi - lo) * (mid - 4)));
    }
    // the markers: a line + a handle at the top
    [[ax, "#2ee66b", "START"], [bx, "#ff4d5e", "END"]].forEach(([x, c, t]) => {
      g.fillStyle = c; g.fillRect(Math.round(x) - 1, 0, 2, h);
      g.beginPath(); g.moveTo(x - 7, 0); g.lineTo(x + 7, 0); g.lineTo(x + 7, 12); g.lineTo(x, 18); g.lineTo(x - 7, 12); g.closePath(); g.fill();
      g.font = "700 9px system-ui"; g.fillText(t, t === "END" ? Math.max(2, x - 34) : Math.min(w - 34, x + 9), 10);
    });
    if (S.src) { const px = X(S.playAt + (ctx().currentTime - S.playT), w); g.fillStyle = "#fff"; g.fillRect(px, 0, 1, h); }
    $("vcA").value = S.a.toFixed(2); $("vcB").value = S.b.toFixed(2); $("vcA").max = $("vcB").max = S.dur.toFixed(2);
    const len = S.b - S.a, q = quality(len, S.engine);
    $("vcLen").textContent = "the part: " + fmtS(S.a) + " – " + fmtS(S.b) + "  ·  " + q.text + "  ·  the sound is " + fmtS(S.dur);
    $("vcLen").dataset.level = q.level;
    ["vcMA", "vcMB"].forEach((id, k) => { const m = $(id); if (m) { m.style.left = ((k ? bx : ax) / w * 100) + "%"; m.setAttribute("aria-valuenow", (k ? S.b : S.a).toFixed(2)); m.setAttribute("aria-valuetext", fmtS(k ? S.b : S.a)); m.setAttribute("aria-valuemax", S.dur.toFixed(2)); } });
  }
  function setRegion(a, b, which) { const r = clampRegion(a, b, S.dur, which); S.a = r.a; S.b = r.b; paint(); }
  function wireWave() {
    const cv = $("vcCanvas"), wrap = $("vcWave");
    const tOf = (e) => { const r = cv.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * S.dur; };
    wrap.addEventListener("pointerdown", (e) => {
      if (!S.buf || e.button !== 0) return;
      e.preventDefault(); wrap.setPointerCapture(e.pointerId);
      const t = tOf(e), r = cv.getBoundingClientRect(), tol = 8 / r.width * S.dur, mk = e.target.closest(".vcmark");
      let which = mk ? mk.dataset.m : Math.abs(t - S.a) <= tol ? "a" : Math.abs(t - S.b) <= tol ? "b" : (t > S.a && t < S.b ? "both" : (t < S.a ? "a" : "b"));
      S.drag = { which, t0: t, a: S.a, b: S.b };
      if (which !== "both") setRegion(which === "a" ? t : S.a, which === "b" ? t : S.b, which);
      (which === "a" ? $("vcMA") : which === "b" ? $("vcMB") : wrap).focus({ preventScroll: true });
    });
    wrap.addEventListener("pointermove", (e) => {
      const d = S.drag; if (!d) { if (S.buf) { const t = tOf(e), tol = 8 / cv.getBoundingClientRect().width * S.dur; wrap.style.cursor = Math.abs(t - S.a) <= tol || Math.abs(t - S.b) <= tol ? "ew-resize" : t > S.a && t < S.b ? "grab" : "crosshair"; } return; }
      const t = tOf(e);
      if (d.which === "both") setRegion(d.a + (t - d.t0), d.b + (t - d.t0), "both");
      else setRegion(d.which === "a" ? t : S.a, d.which === "b" ? t : S.b, d.which);
    });
    const up = () => { S.drag = null; };
    wrap.addEventListener("pointerup", up); wrap.addEventListener("pointercancel", up);
    // the markers as sliders for the keyboard: ← → 0.1 s (Shift 1 s)
    ["vcMA", "vcMB"].forEach((id) => $(id).addEventListener("keydown", (e) => {
      if (!S.buf) return; const k = id === "vcMA" ? "a" : "b", st = e.shiftKey ? 1 : 0.1;
      let v = k === "a" ? S.a : S.b;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") v -= st; else if (e.key === "ArrowRight" || e.key === "ArrowUp") v += st;
      else if (e.key === "Home") v = 0; else if (e.key === "End") v = S.dur; else return;
      e.preventDefault(); setRegion(k === "a" ? v : S.a, k === "b" ? v : S.b, k);
    }));
    $("vcA").addEventListener("change", () => setRegion(+$("vcA").value, S.b, "a"));
    $("vcB").addEventListener("change", () => setRegion(S.a, +$("vcB").value, "b"));
    if (root.ResizeObserver) new root.ResizeObserver(() => { S.pk = null; paint(); }).observe(cv);
  }
  /* ---- ▶ the part ---- */
  function stopPlay() { if (S.src) { try { S.src.stop(); } catch (e) { /* fine */ } S.src = null; } $("vcPlay") && ($("vcPlay").textContent = "▶ Play the part"); }
  function play() {
    if (!S.buf) return;
    if (S.src) { stopPlay(); paint(); return; }
    const c = ctx(), s = c.createBufferSource(); s.buffer = S.buf; s.connect(c.destination);
    S.src = s; S.playT = c.currentTime; S.playAt = S.a; s.start(0, S.a, S.b - S.a);
    s.onended = () => { if (S.src === s) { S.src = null; $("vcPlay").textContent = "▶ Play the part"; paint(); } };
    $("vcPlay").textContent = "■ Stop";
    const tick = () => { if (S.src !== s) return; paint(); root.requestAnimationFrame(tick); }; tick();
  }
  /* ---- ✍ the words, 🧬 save ---- */
  async function words() {
    if (!S.blob) return;
    $("vcWords").disabled = true; say("✍ listening to the part…");
    try {
      const fd = new root.FormData(); fd.append("file", S.blob, S.fileName || "voice.wav"); fd.append("start", String(S.a)); fd.append("end", String(S.b));
      const r = await fetch("/api/asr/transcribe-upload", { method: "POST", body: fd }), j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status);
      $("vcText").value = String(j.text || "").trim(); say("✍ written - check the words, then 🧬 Save voice");
    } catch (e) { say("⚠ " + (e.message || e) + " - type the words yourself, or leave them empty", true); }
    $("vcWords").disabled = false;
  }
  async function save() {
    if (!S.blob) { say("⚠ pick a sound first", true); return null; }
    const name = $("vcName").value.trim();
    if (!/^[A-Za-z0-9._-]{1,48}$/.test(name)) { say("⚠ a name of 1-48 letters, numbers, . _ or - (no spaces)", true); $("vcName").focus(); return null; }
    $("vcSave").disabled = true; say("🧬 saving " + name + "…");
    try {
      const fd = new root.FormData();
      fd.append("file", S.blob, S.fileName || "voice.wav"); fd.append("name", name); fd.append("text", $("vcText").value.trim());
      fd.append("start", String(S.a)); fd.append("end", String(S.b));
      const r = await fetch("/api/tts/voices", { method: "POST", body: fd }), j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status);
      // the new voice, picked in 🗣 Speech & dialog - ready to read the text
      const SP = root.H3SpeechDialog;
      if (SP && SP.load) await SP.load();
      const v = $("spVoice");
      if (v && [...v.options].some((o) => o.value === name)) { v.value = name; v.dispatchEvent(new root.Event("change", { bubbles: true })); }
      const box = $("spBox"); if (box) box.open = true;
      say("🧬 \"" + name + "\" saved (" + (j.seconds ? j.seconds.toFixed(1) + " s" : "") + ") and picked as the Voice in 🗣 Speech & dialog below - write the text and 🗣 Read" + (j.warn ? " · ⚠ " + j.warn : ""));
      try { if (root.H3TestEvent) root.H3TestEvent("voice_cloned", name); } catch (e) { /* fine */ }
      return j;
    } catch (e) { say("⚠ " + (e.message || e), true); return null; }
    finally { $("vcSave").disabled = false; }
  }

  $("vcOpen").addEventListener("click", () => $("vcFile").click());
  $("vcFile").addEventListener("change", () => { const f = $("vcFile").files && $("vcFile").files[0]; $("vcFile").value = ""; fromFile(f); });
  $("vcProj").addEventListener("change", () => fromProject($("vcProj").value));
  $("vcProj").addEventListener("pointerdown", listProject);
  $("vcProj").addEventListener("focus", listProject);
  $("vcRec").addEventListener("click", record);
  $("vcPlay").addEventListener("click", play);
  $("vcWords").addEventListener("click", words);
  $("vcSave").addEventListener("click", save);
  // a file dropped on the box
  $("vcBox").addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  $("vcBox").addEventListener("drop", (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { e.preventDefault(); fromFile(f); } });
  fetch("/api/speech").then((r) => r.json()).then((j) => { S.engine = j.engine || "omnivoice"; }).catch(() => { /* fine */ });
  wireWave(); listProject();
  root.H3VoiceClone = Object.assign({ state: S, take, setRegion, save, play, words, fromProject, listProject, info: () => ({ dur: S.dur, a: S.a, b: S.b, name: $("vcName").value, file: S.fileName }) }, pure);
})(typeof window !== "undefined" ? window : globalThis);
