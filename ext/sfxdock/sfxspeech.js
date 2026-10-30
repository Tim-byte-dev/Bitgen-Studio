/* bitGen Studio — ext/sfxdock/sfxspeech.js (2.621.0): the SFX docker's 🗣 SPEECH & DIALOG (window.H3SpeechDialog).
 *
 * Tim (verbatim): "in the sfx docker can you add an input that the user can copy/paste text, or get input from the llm or
 * type custom text to create speech/dialog user can choose the voice/voices and the text will be read with emotion using
 * omnivoice or ming voices. save formats will be wav or mp3 to save the read voice into assets-audio. The name of the file
 * will be an input above the speech input, description will be below - it would be great if we can save the
 * date,time,description and text in the files metadata"
 *   File name (above) · the text (📋 Paste, type, ✨ Write with the LLM, ＋ sound tags) · Description (below)
 *   Engine (OmniVoice / Ming-3.0 TTS) · Voice · Emotion · WAV / MP3 · Pause · the Cast: a voice + an emotion per speaker
 *   (found in the text as "Name:" / "Name (emotion):") · 🗣 Read & save to Audio -> projects/<p>/sound/<name>.wav|mp3 with
 *   the date + time, description, text and voices in its metadata (routes/speechDialog.js, lib/speechDialog.js)
 * The draft and the cast are kept in this browser (localStorage sp.draft / sp.cast). */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  if (!doc || !$("spBox")) return;
  const S = { info: null, speakers: [], cast: {}, busy: false, pollT: 0, parseT: 0 };
  try { S.cast = JSON.parse(root.localStorage.getItem("sp.cast") || "{}") || {}; } catch (e) { S.cast = {}; }
  const keepCast = () => { try { root.localStorage.setItem("sp.cast", JSON.stringify(S.cast)); } catch (e) { /* fine */ } };
  const keepDraft = () => { try { root.localStorage.setItem("sp.draft", JSON.stringify({ name: $("spName").value, text: $("spText").value, desc: $("spDesc").value, engine: $("spEngine").value, voice: $("spVoice").value, emo: $("spEmo").value, fmt: $("spFmt").value, mode: $("spMode").value, pause: $("spPause").value })); } catch (e) { /* fine */ } };
  const say = (t) => { $("spMsg").textContent = t || "—"; };
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const api = (u, body) => fetch(u, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json().catch(() => ({})).then((j) => { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }));
  const EMO_LABEL = { neutral: "Neutral", happy: "Happy", sad: "Sad", angry: "Angry", fearful: "Fearful", disgusted: "Disgusted", surprised: "Surprised" };

  function voiceOpts(sel, val, blank) {
    const V = (S.info && S.info.voices) || [];
    return (blank ? '<option value="">' + esc(blank) + "</option>" : "") + V.filter((v) => !/\.[a-z]+$/.test(v.name) || !EMO_LABEL[v.name.split(".").pop()])
      .map((v) => '<option value="' + esc(v.name) + '"' + (v.name === val ? " selected" : "") + ">" + esc(v.name) + (v.kind === "design" ? " (designed)" : "") + "</option>").join("");
  }
  function emoOpts(val, blank) {
    const E = (S.info && S.info.emotions) || Object.keys(EMO_LABEL);
    return (blank ? '<option value="">' + esc(blank) + "</option>" : "") + E.map((e) => '<option value="' + e + '"' + (e === val ? " selected" : "") + ">" + esc(EMO_LABEL[e] || e) + "</option>").join("");
  }
  function load() {
    S.loadedAt = Date.now();
    return api("/api/speech").then((j) => {
      S.info = j;
      let d = {}; try { d = JSON.parse(root.localStorage.getItem("sp.draft") || "{}") || {}; } catch (e) { d = {}; }
      if ($("spEngine").value) { d.engine = $("spEngine").value; d.voice = $("spVoice").value; d.emo = $("spEmo").value; }
      const eng = d.engine || j.engine;
      $("spEngine").innerHTML = j.engines.map((e) => '<option value="' + e.id + '"' + (e.id === eng ? " selected" : "") + ">" + esc(e.label) + (e.installed ? "" : " (not installed)") + "</option>").join("");
      $("spVoice").innerHTML = voiceOpts(null, d.voice || "", "(the engine's own voice)");
      $("spEmo").innerHTML = emoOpts(d.emo || "neutral");
      $("spTag").innerHTML = '<option value="">＋ tag</option>' + (j.tags || []).map((t) => '<option value="' + esc(t) + '">' + esc(t) + "</option>").join("");
      if (!$("spText").value && d.text) $("spText").value = d.text;
      if (!$("spName").value && d.name) $("spName").value = d.name;
      if (!$("spDesc").value && d.desc) $("spDesc").value = d.desc;
      if (d.fmt) $("spFmt").value = d.fmt; if (d.mode) $("spMode").value = d.mode; if (d.pause) $("spPause").value = d.pause;
      engineNote(); return parse();
    }).catch((e) => say("⚠ " + e.message));
  }
  function engineNote() {
    const e = ((S.info && S.info.engines) || []).find((x) => x.id === $("spEngine").value);
    if (e && !e.installed) say(e.label + " is not installed - " + (e.id === "ming" ? "Settings ▸ Add-ons ▸ Ming-3.0 TTS" : "Settings ▸ Audio ▸ Install OmniVoice"));
    else if (e) say(e.id === "ming" ? "Ming-3.0 TTS reads each line with its emotion (its EMOTION task)" : "OmniVoice: the emotion sets the pace; a voice saved as \"Name.happy\" (recorded happy) is used for happy lines; [laughter] [sigh] … are read as sounds");
  }
  /* ---- the cast: the speakers found in the text */
  function parse() {
    return api("/api/speech/parse", { text: $("spText").value, mode: $("spMode").value }).then((j) => {
      S.speakers = j.speakers || []; S.lines = j.lines || [];
      paintCast();
    }).catch(() => { /* the server is busy - next keystroke */ });
  }
  function paintCast() {
    const box = $("spCast");
    if ($("spMode").value === "single" || !S.speakers.length) { box.innerHTML = ""; $("spVoice").title = "The voice that reads the text"; return; }
    box.innerHTML = '<span class="h">Speaker</span><span class="h">Voice</span><span class="h">Emotion (lines without one)</span>'
      + S.speakers.map((sp, i) => { const c = S.cast[sp] || {}; return "<span>" + esc(sp) + '</span><select data-sp="' + i + '" data-k="voice" aria-label="' + esc(sp) + '\'s voice">' + voiceOpts(null, c.voice || "", "(the Voice above)") + '</select><select data-sp="' + i + '" data-k="emotion" aria-label="' + esc(sp) + '\'s emotion">' + emoOpts(c.emotion || "", "(the Emotion above)") + "</select>"; }).join("");
    box.querySelectorAll("select").forEach((s) => { s.onchange = () => { const sp = S.speakers[+s.dataset.sp]; S.cast[sp] = Object.assign({}, S.cast[sp] || {}, { [s.dataset.k]: s.value }); keepCast(); }; });
    const n = (S.lines || []).length;
    $("spProg").textContent = n ? n + " line" + (n > 1 ? "s" : "") + " · " + S.speakers.length + " speaker" + (S.speakers.length > 1 ? "s" : "") : "";
  }
  function castNow() { const o = {}; S.speakers.forEach((sp) => { if (S.cast[sp]) o[sp] = S.cast[sp]; }); return o; }

  /* ---- read + save */
  function poll() {
    clearTimeout(S.pollT);
    api("/api/speech/progress").then((p) => {
      if (!S.busy) return;
      $("spProg").textContent = "⏳ " + (p.total ? "line " + Math.max(1, p.step) + "/" + p.total + " · " : "") + (p.seconds || 0) + " s · " + (p.last || "");
      S.pollT = setTimeout(poll, 800);
    }).catch(() => { S.pollT = setTimeout(poll, 1500); });
  }
  function go() {
    if (S.busy) return Promise.resolve();
    const name = $("spName").value.trim(), text = $("spText").value.trim();
    if (!name) { say("⚠ give the file a name (the box above the text)"); $("spName").focus(); return Promise.resolve(); }
    if (!text) { say("⚠ nothing to read - type, paste or ✨ write the text"); $("spText").focus(); return Promise.resolve(); }
    S.busy = true; $("spGo").disabled = true; say("reading…"); $("spMeta").textContent = ""; poll();
    const job = { name, text, description: $("spDesc").value.trim(), engine: $("spEngine").value, format: $("spFmt").value, mode: $("spMode").value,
      voice: $("spVoice").value, emotion: $("spEmo").value, cast: castNow(), pause: parseFloat($("spPause").value) };
    return api("/api/speech/speak", job).then((j) => {
      say("🗣 " + j.name + " saved in the Audio assets - " + j.lines + " line" + (j.lines > 1 ? "s" : "") + ", " + (j.duration ? j.duration.toFixed(1) + " s" : "") + " (" + j.engine + ")");
      const a = $("spPlay"); a.src = "/passets/sound/" + encodeURIComponent(j.name) + "?t=" + Date.now(); a.style.display = "block";
      $("spMeta").textContent = "In the file: " + j.meta.title + " · " + j.meta.date.replace("T", " ") + (j.meta.description ? " · " + j.meta.description : "") + " · voices: " + j.meta.voices;
      if (typeof root.refreshAssets === "function") { try { root.refreshAssets(); } catch (e) { /* fine */ } }
      try { if (root.H3TestEvent) root.H3TestEvent("speech_saved", j.name); } catch (e) { /* fine */ }
      S.last = j; return j;
    }).catch((e) => { say("⚠ " + e.message); }).then((j) => { S.busy = false; $("spGo").disabled = false; clearTimeout(S.pollT); paintCast(); return j; });
  }
  function write() {
    const brief = $("spBrief").value.trim();
    $("spWrite").disabled = true; say("✨ the LLM is writing…");
    return api("/api/speech/write", { brief, speakers: S.speakers.length ? S.speakers : "", emotion: $("spEmo").value === "neutral" ? "" : $("spEmo").value, lines: 8 }).then((j) => {
      const t = $("spText"); t.focus(); t.select();
      // through the edit history, so Ctrl+Z in the box brings the old text back
      if (!(doc.execCommand && doc.execCommand("insertText", false, j.text))) t.value = j.text;
      if ($("spMode").value === "single" && j.speakers && j.speakers.length > 1) $("spMode").value = "dialog";
      say("✨ written - " + (j.speakers || []).length + " speaker(s); pick their voices below, then 🗣 Read"); keepDraft(); return parse();
    }).catch((e) => say("⚠ " + e.message)).then(() => { $("spWrite").disabled = false; });
  }
  function insertAt(t) {
    const ta = $("spText"), a = ta.selectionStart || 0, b = ta.selectionEnd || 0;
    ta.focus(); ta.setSelectionRange(a, b);
    if (!(doc.execCommand && doc.execCommand("insertText", false, t))) { ta.value = ta.value.slice(0, a) + t + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + t.length; }
  }

  $("spGo").onclick = () => go();
  $("spWrite").onclick = () => write();
  $("spBrief").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); write(); } });
  $("spPaste").onclick = () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) { say("this browser keeps the clipboard to itself - click in the box and press Ctrl+V"); $("spText").focus(); return; }
    navigator.clipboard.readText().then((t) => { if (!t) { say("the clipboard has no text"); return; } insertAt(t); keepDraft(); parse(); say("📋 pasted " + t.length + " characters"); })
      .catch(() => { say("the clipboard was not shared - click in the box and press Ctrl+V"); $("spText").focus(); });
  };
  $("spTag").onchange = (e) => { if (e.target.value) { insertAt(e.target.value + " "); keepDraft(); } e.target.value = ""; };
  $("spClear").onclick = () => { $("spName").value = ""; $("spText").value = ""; $("spDesc").value = ""; keepDraft(); parse(); };
  $("spText").addEventListener("input", () => { keepDraft(); clearTimeout(S.parseT); S.parseT = setTimeout(parse, 350); });
  ["spName", "spDesc", "spVoice", "spEmo", "spFmt", "spPause"].forEach((id) => $(id).addEventListener("change", keepDraft));
  $("spMode").onchange = () => { keepDraft(); parse(); };
  $("spEngine").onchange = () => { keepDraft(); engineNote(); };
  // voices made in Settings ▸ Audio since: read again when the pointer comes back to the panel (at most every 8 s)
  $("spBox").addEventListener("pointerenter", () => { if (!S.busy && Date.now() - (S.loadedAt || 0) > 8000) load(); });
  load();
  root.H3SpeechDialog = { state: S, load, parse, go, write, insertAt };
})(typeof window !== "undefined" ? window : globalThis);
