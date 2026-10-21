/* bitGen Studio — static/voicechat.js (2.564.0): 🎙 VOICE CHAT - talk to the app, hands-free, like a live chat (H3Voice).
 * Tim: "i think we just use a mic to talk to the app instead to ask for prompt, change style, create..." - the trigger:
 * "can it be like live chat"; then "great, lets do the voice next".
 *   🎙 Voice (the statusbar) / Ctrl+Alt+V  opens the voice chat and starts listening. No button to hold: it hears when you
 *                  start talking and when you stop (a voice-activity detector on the microphone's level, with the last
 *                  half second kept so the first word is not cut), sends what you said (a 16 kHz wav) to be heard on this
 *                  computer (faster-whisper, kept loaded - lib/asrLive.js), the local LLM answers (lib/voiceAgent.js) -
 *                  the answer is SPOKEN (the system's voices, on this machine) and its ACTIONS run here: write / change
 *                  the prompt, the negative prompt, pick a style, Basic Settings, what Generate makes, the video mode,
 *                  Generate, a still image, stop the job, add / render a StoryBoard scene, show a docker. Then it listens
 *                  again. While it speaks it does not listen (it would hear itself).
 *   The window: the conversation (what you said, what it answered, what it did), the mic level, ⏸ / ▶ listening, 🔈 / 🔇
 *                  its voice (and which voice), a box to type instead, ✕ ends it ("goodbye" / "stop listening" too).
 * Pure (Node: scripts/test-voice564.js): vadStep, downsample, encodeWav, matchOption, DOCKS, MODES, SETTING_IDS, speakable. */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const VAD = { startMs: 150, endMs: 850, minMs: 350, maxMs: 25000, k: 3.2, min: 0.012 };
  /** one step of the voice-activity detector: st {phase quiet|speech, above, below, len, floor}, rms of this block, dt ms
   *  -> {st, ev: "start" | "end" | "drop" | null} (drop = too short to be words: a click, a cough) */
  function vadStep(st0, rms, dt, opts) {
    const o = Object.assign({}, VAD, opts || {});
    const st = Object.assign({ phase: "quiet", above: 0, below: 0, len: 0, floor: 0.004 }, st0 || {});
    const thr = Math.max(o.min, st.floor * o.k);
    let ev = null;
    if (st.phase === "quiet") {
      if (rms < thr) st.floor = st.floor * 0.97 + rms * 0.03;         // the room's own level, learnt while quiet
      if (rms > thr) { st.above += dt; if (st.above >= o.startMs) { st.phase = "speech"; st.len = st.above; st.below = 0; ev = "start"; } }
      else st.above = 0;
    } else {
      st.len += dt;
      if (rms < thr * 0.7) st.below += dt; else st.below = 0;
      if (st.below >= o.endMs || st.len >= o.maxMs) {
        ev = st.len - st.below >= o.minMs ? "end" : "drop";
        st.phase = "quiet"; st.above = 0; st.below = 0; st.len = 0;
      }
    }
    return { st, ev };
  }
  /** Float32 samples at `from` Hz -> at `to` Hz (averaging - the 48 kHz mic to Whisper's 16 kHz) */
  function downsample(buf, from, to) {
    if (!buf || from === to) return buf;
    const ratio = from / to, n = Math.floor(buf.length / ratio), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * ratio), b = Math.min(buf.length, Math.floor((i + 1) * ratio));
      let s = 0; for (let j = a; j < b; j++) s += buf[j];
      out[i] = b > a ? s / (b - a) : buf[a] || 0;
    }
    return out;
  }
  /** mono 16-bit PCM wav (an ArrayBuffer) */
  function encodeWav(samples, rate) {
    const n = samples.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return ab;
  }
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  /** the option whose words best fit `name`: [{value, text}] -> value | null (exact, then contains, then most shared words) */
  function matchOption(opts, name) {
    const want = norm(name); if (!want) return null;
    const list = (opts || []).filter((o) => o && o.value !== "" && o.value != null);
    let hit = list.find((o) => norm(o.text) === want || norm(o.value) === want);
    if (!hit) hit = list.find((o) => norm(o.text).includes(want)) || list.find((o) => want.includes(norm(o.text)) && norm(o.text).length > 2);
    if (!hit) {
      const ws = want.split(" ").filter((x) => x.length > 1);
      let best = 0;
      for (const o of list) { const t = norm(o.text), sc = ws.filter((x) => t.split(" ").includes(x)).length; if (sc > best) { best = sc; hit = o; } }
    }
    return hit ? String(hit.value) : null;
  }
  /** a docker's words -> {el: its id, btn: the statusbar button, app: #app's class while hidden, sf: a SecFloat window} */
  const DOCKS = {
    prompt: { el: "promptdock", btn: "tP" }, preview: { el: "previewdock", btn: "tPv" }, timeline: { el: "timelinedock", btn: "tT" },
    storyboard: { el: "videodock", btn: "tV" }, music: { el: "musicdock", btn: "tMu" }, stems: { el: "stemsdock", btn: "tSt" },
    sfx: { el: "sfxdock", btn: "tSfx" }, "image editor": { el: "imageeditdock", btn: "tIE" }, comfyui: { el: "comfydock", btn: "tCF" },
    chat: { el: "chatdock", btn: "tCh" }, console: { el: "consoledock", btn: "tC" },
    settings: { el: "ldock", btn: "tL", app: "no-left" }, references: { el: "refsdock", btn: "tRefs", app: "no-refs" },
    assets: { el: "assetsdock", btn: "tAssets", app: "no-assets" }, queue: { el: "qdock", btn: "tQ", app: "no-queue" }, gallery: { el: "rdock", btn: "tR", app: "no-right" },
    "basic settings": { sf: "basic" }, "llm tokens": { sf: "llmtok" }, negative: { sf: "negprompt" },
  };
  const MODES = { ref: "ref2va", fl: "fl2va", text: "t2va", swap: "swap" };
  const SETTING_IDS = { steps: "steps", cfg: "cfg", seconds: "seconds", seed: "seed", resolution: "resSel", aspect: "arSel", format: "format", override: "ovrStyle" };
  /** words to speak: no markdown, no code, no tags, no emoji clutter */
  const speakable = (t) => String(t || "").replace(/```[\s\S]*?```/g, " ").replace(/<[^>]+>/g, " ").replace(/[*_#`>|]/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ").replace(/\s+/g, " ").trim();
  const API = { VAD, vadStep, downsample, encodeWav, matchOption, DOCKS, MODES, SETTING_IDS, speakable };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  /* ================================ the page ================================ */
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const tev = (k, v) => { if (root.H3TestEvent) { try { root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } } };
  const LS = (k, d) => { try { const v = root.localStorage.getItem("h3.voice." + k); return v == null ? d : v; } catch (e) { return d; } };
  const LSset = (k, v) => { try { root.localStorage.setItem("h3.voice." + k, v); } catch (e) { /* private */ } };
  const S = { open: false, phase: "off", stream: null, ctx: null, proc: null, vad: null, pre: [], utt: null, rate: 48000, history: [], listen: true, speaking: false, busy: false, level: 0 };

  function css() {
    if ($("vcCss")) return;
    const s = doc.createElement("style"); s.id = "vcCss";
    s.textContent = "#vcPanel{position:fixed;right:18px;bottom:40px;width:380px;max-width:94vw;height:460px;max-height:80vh;z-index:50;display:flex;flex-direction:column;background:var(--panel,#1d1a15);color:var(--text,#e8e2d6);border:1px solid var(--line,#3a342a);border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.55);font-size:.8rem}"
      + "#vcPanel .vch{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--line,#3a342a);cursor:move;user-select:none}"
      + "#vcPanel .vch b{flex:1;font-family:var(--disp);letter-spacing:.12em;text-transform:uppercase;font-size:.72rem}"
      + "#vcPanel .vch button,#vcPanel .vcf button{background:none;border:1px solid var(--line,#3a342a);color:inherit;border-radius:5px;padding:1px 7px;cursor:pointer}"
      + "#vcPanel .vcst{font-size:.7rem;padding:1px 7px;border-radius:9px;background:var(--panel-2,#26221b);color:var(--dim,#9a917f)}"
      + "#vcPanel .vcst.listening{color:#7fd17f}#vcPanel .vcst.hearing,#vcPanel .vcst.thinking{color:var(--tiger,#f59e2c)}#vcPanel .vcst.speaking{color:#7fb6ff}"
      + "#vcPanel .vcm{height:4px;background:var(--panel-2,#26221b);margin:0 8px}#vcPanel .vcm i{display:block;height:100%;width:0;background:#7fd17f;transition:width .08s}"
      + "#vcPanel .vcl{flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:6px}"
      + "#vcPanel .vcb{max-width:88%;padding:5px 9px;border-radius:9px;line-height:1.35;white-space:pre-wrap;word-break:break-word}"
      + "#vcPanel .vcb.me{align-self:flex-end;background:var(--tiger-deep,#a35a1a);color:#fff}#vcPanel .vcb.ai{align-self:flex-start;background:var(--panel-2,#26221b)}"
      + "#vcPanel .vcb.did{align-self:flex-start;background:none;color:var(--dim,#9a917f);font-size:.72rem;padding:0 9px}#vcPanel .vcb.err{align-self:center;color:#e88;font-size:.72rem}"
      + "#vcPanel .vcf{display:flex;gap:6px;padding:6px 8px;border-top:1px solid var(--line,#3a342a);align-items:center}#vcPanel .vcf input{flex:1;min-width:0}"
      + "#vcPanel select{max-width:120px;font-size:.7rem}";
    doc.head.appendChild(s);
  }
  function panel() {
    let p = $("vcPanel"); if (p) return p;
    css();
    p = doc.createElement("div"); p.id = "vcPanel"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Voice chat");
    p.innerHTML = '<div class="vch"><b>🎙 Voice chat</b><span class="vcst" id="vcState">off</span>'
      + '<button type="button" id="vcListen" title="Pause / resume listening">⏸</button>'
      + '<button type="button" id="vcMute" title="Its voice on / off">🔈</button>'
      + '<select id="vcVoice" title="Which voice it speaks with (this computer\'s voices)" aria-label="Voice"></select>'
      + '<button type="button" id="vcClose" title="End the voice chat (or say goodbye)">✕</button></div>'
      + '<div class="vcm" title="The microphone"><i id="vcMeter"></i></div>'
      + '<div class="vcl" id="vcLog" aria-live="polite"></div>'
      + '<div class="vcf"><input id="vcText" placeholder="…or type here and press Enter" aria-label="Say it in writing"><button type="button" id="vcSend">Send</button></div>';
    doc.body.appendChild(p);
    $("vcClose").onclick = () => stop();
    $("vcListen").onclick = () => { S.listen = !S.listen; paint(); };
    $("vcMute").onclick = () => { LSset("speak", LS("speak", "1") === "1" ? "0" : "1"); if (LS("speak", "1") !== "1") { try { root.speechSynthesis.cancel(); } catch (e) { /* none */ } } paint(); };
    $("vcVoice").onchange = (e) => LSset("voice", e.target.value);
    const send = () => { const v = $("vcText").value.trim(); if (!v || S.busy) return; $("vcText").value = ""; turn(v); };
    $("vcSend").onclick = send;
    $("vcText").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); send(); } });
    drag(p, p.querySelector(".vch"));
    voices();
    try { root.speechSynthesis.onvoiceschanged = voices; } catch (e) { /* no speech here */ }
    return p;
  }
  function drag(p, h) {
    h.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, select")) return;
      const r = p.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mv = (m) => { p.style.left = Math.max(0, Math.min(root.innerWidth - 80, m.clientX - ox)) + "px"; p.style.top = Math.max(0, Math.min(root.innerHeight - 40, m.clientY - oy)) + "px"; p.style.right = "auto"; p.style.bottom = "auto"; };
      const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    });
  }
  function voices() {
    const sel = $("vcVoice"); if (!sel) return;
    let vs = []; try { vs = root.speechSynthesis.getVoices() || []; } catch (e) { vs = []; }
    const want = LS("voice", "");
    sel.innerHTML = '<option value="">default voice</option>' + vs.map((v) => `<option value="${v.name.replace(/"/g, "&quot;")}"${v.name === want ? " selected" : ""}>${v.name.replace(/</g, "&lt;")}</option>`).join("");
  }
  function paint() {
    const st = $("vcState"); if (!st) return;
    const ph = !S.open ? "off" : S.speaking ? "speaking" : S.phase === "hearing" ? "hearing" : S.phase === "thinking" ? "thinking" : S.listen && S.stream ? "listening" : S.stream ? "paused" : S.phase;
    st.textContent = { listening: "listening…", hearing: "hearing…", thinking: "thinking…", speaking: "speaking…", paused: "paused", off: "off" }[ph] || ph;
    st.className = "vcst " + ph;
    $("vcListen").textContent = S.listen ? "⏸" : "▶"; $("vcListen").title = S.listen ? "Pause listening" : "Listen again";
    $("vcMute").textContent = LS("speak", "1") === "1" ? "🔈" : "🔇";
    const b = $("tVoice"); if (b) b.classList.toggle("on", S.open);
  }
  function bubble(cls, text) {
    const l = $("vcLog"); if (!l) return null;
    const d = doc.createElement("div"); d.className = "vcb " + cls; d.textContent = text; l.appendChild(d); l.scrollTop = l.scrollHeight;
    return d;
  }

  /* ---- the microphone and the detector */
  async function startMic() {
    if (S.stream) return true;
    if (!root.navigator.mediaDevices || !root.navigator.mediaDevices.getUserMedia) { bubble("err", "This window cannot use the microphone (it needs the app, or http://localhost) - you can still type."); return false; }
    try {
      S.stream = await root.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { bubble("err", "The microphone was refused (" + (e.message || e.name) + ") - you can still type."); return false; }
    const AC = root.AudioContext || root.webkitAudioContext;
    S.ctx = new AC(); S.rate = S.ctx.sampleRate;
    const src = S.ctx.createMediaStreamSource(S.stream);
    S.proc = S.ctx.createScriptProcessor(4096, 1, 1);
    const mute = S.ctx.createGain(); mute.gain.value = 0;
    src.connect(S.proc); S.proc.connect(mute); mute.connect(S.ctx.destination);
    S.vad = null; S.pre = []; S.utt = null;
    S.proc.onaudioprocess = (e) => block(e.inputBuffer.getChannelData(0));
    tev("voice_mic", String(S.rate));
    return true;
  }
  function stopMic() {
    try { if (S.proc) S.proc.disconnect(); } catch (e) { /* gone */ }
    try { if (S.ctx) S.ctx.close(); } catch (e) { /* gone */ }
    try { if (S.stream) S.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* gone */ }
    S.stream = S.ctx = S.proc = null; S.utt = null; S.pre = [];
  }
  /** one block of the microphone (about 85 ms) */
  function block(data) {
    const buf = new Float32Array(data);
    let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / (buf.length || 1));
    S.level = rms; const m = $("vcMeter"); if (m) m.style.width = Math.min(100, Math.round(rms * 900)) + "%";
    if (!S.listen || S.busy || S.speaking) { S.utt = null; S.vad = null; S.pre = []; return; }
    const dt = (buf.length / S.rate) * 1000;
    const r = vadStep(S.vad, rms, dt); S.vad = r.st;
    if (r.ev === "start") { S.utt = S.pre.slice(); }
    if (S.utt) S.utt.push(buf);
    else { S.pre.push(buf); while (S.pre.length > Math.ceil(500 / dt)) S.pre.shift(); }   // the last half second, kept
    if (r.ev === "end" && S.utt) { const u = S.utt; S.utt = null; S.pre = []; heard(u); }
    if (r.ev === "drop") { S.utt = null; }
  }
  async function heard(chunks) {
    const n = chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(n);
    let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    const pcm = downsample(all, S.rate, 16000);
    S.busy = true; S.phase = "hearing"; paint();
    const fd = new FormData(); fd.append("audio", new Blob([encodeWav(pcm, 16000)], { type: "audio/wav" }), "turn.wav");
    let j = {};
    try { j = await (await fetch("/api/voice/hear", { method: "POST", body: fd })).json(); } catch (e) { j = { error: String(e.message || e) }; }
    if (j.error) { bubble("err", "⚠ " + j.error); S.busy = false; S.phase = "listening"; paint(); return; }
    const text = String(j.text || "").trim();
    if (!text || /^[\s.,!?]*$/.test(text)) { S.busy = false; S.phase = "listening"; paint(); return; }
    tev("voice_heard", text);
    await turn(text);
  }

  /* ---- a turn: the LLM's answer, its actions, its voice */
  function state() {
    const v = (id) => ($(id) ? $(id).value : undefined);
    const opts = (id) => ($(id) ? [...$(id).options].filter((o) => o.value !== "").map((o) => o.textContent.trim()) : []);
    const sel = (id) => { const s = $(id); return s && s.selectedIndex >= 0 && s.value ? s.options[s.selectedIndex].textContent.trim() : ""; };
    const mb = doc.querySelector(".modes button.active");
    const settings = {}; for (const [k, id] of Object.entries(SETTING_IDS)) { const e = $(id); if (e) settings[k] = e.type === "checkbox" ? (e.checked ? "on" : "off") : e.value; }
    return { prompt: v("prompt") || "", negative: root.H3Neg && root.H3Neg.get ? root.H3Neg.get() : "", generate: v("genModeSel") || "",
      video_mode: mb ? mb.dataset.mode : "", video_style: sel("videoStyleSel"), video_styles: opts("videoStyleSel"), image_style: sel("styleSel"), image_styles: opts("styleSel"),
      settings, scenes: doc.querySelectorAll("#scList .sccard[data-sc]").length, job: ($("progdetail") && $("progdetail").textContent.trim()) || "" };
  }
  async function turn(text) {
    S.busy = true; S.phase = "thinking"; paint();
    bubble("me", text);
    let j = {};
    try { j = await (await fetch("/api/voice/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, history: S.history, state: state() }) })).json(); }
    catch (e) { j = { error: String(e.message || e) }; }
    if (j.error) { bubble("err", "⚠ " + j.error); S.busy = false; S.phase = "listening"; paint(); return; }
    S.history.push({ role: "user", content: text });
    if (j.say) { bubble("ai", j.say); S.history.push({ role: "assistant", content: j.say }); }
    S.history = S.history.slice(-16);
    let end = false;
    for (const a of j.actions || []) {
      let did = "";
      try { did = await act(a); } catch (e) { did = "⚠ " + (e.message || e); }
      if (a.do === "stop_listening") end = true;
      if (did) bubble("did", did);
      tev("voice_action", a.do);
    }
    S.busy = false; S.phase = "listening";
    await speak(j.say || "");
    paint();
    if (end) stop();
  }
  function speak(text) {
    const t = speakable(text);
    if (!t || LS("speak", "1") !== "1" || !root.speechSynthesis) return Promise.resolve();
    return new Promise((resolve) => {
      let u;
      try { u = new root.SpeechSynthesisUtterance(t); } catch (e) { resolve(); return; }
      const want = LS("voice", ""), vs = root.speechSynthesis.getVoices() || [], v = vs.find((x) => x.name === want);
      if (v) u.voice = v;
      const done = () => { S.speaking = false; paint(); root.setTimeout(resolve, 250); };      // (the room's echo dies down)
      u.onend = done; u.onerror = done;
      S.speaking = true; paint();
      try { root.speechSynthesis.cancel(); root.speechSynthesis.speak(u); } catch (e) { done(); }
      root.setTimeout(() => { if (S.speaking) done(); }, Math.min(60000, 1500 + t.length * 90));    // a voice that never says "end"
    });
  }

  /* ---- the actions, in the app */
  const fire = (el) => { ["input", "change"].forEach((t) => el.dispatchEvent(new root.Event(t, { bubbles: true }))); };
  function setSelect(id, name) {
    const s = $(id); if (!s) throw new Error("not on this page");
    try { s.dispatchEvent(new root.Event("focus")); } catch (e) { /* lazy lists fill on focus */ }
    const val = matchOption([...s.options].map((o) => ({ value: o.value, text: o.textContent })), name);
    if (val == null) throw new Error(`no "${name}" here - ${[...s.options].filter((o) => o.value).slice(0, 8).map((o) => o.textContent.trim()).join(", ")}`);
    s.value = val; fire(s);
    return s.options[s.selectedIndex].textContent.trim();
  }
  async function act(a) {
    const P = $("prompt");
    switch (a.do) {
      case "set_prompt": if (!P) throw new Error("no prompt box"); P.value = a.text; fire(P); return "✎ prompt written";
      case "add_to_prompt": if (!P) throw new Error("no prompt box"); P.value = (P.value.trim() ? P.value.trim() + " " : "") + a.text; fire(P); return "✎ added to the prompt";
      case "clear_prompt": if (P) { P.value = ""; fire(P); } return "✎ prompt cleared";
      case "set_negative": if (root.H3Neg && root.H3Neg.set) { root.H3Neg.set(a.text); return "⊖ negative prompt set"; } throw new Error("no negative prompt here");
      case "set_generate": return "Generate makes: " + setSelect("genModeSel", a.what);
      case "set_video_mode": { const b = doc.querySelector(`.modes button[data-mode="${MODES[a.mode]}"]`); if (!b) throw new Error("no such mode"); b.click(); return "video mode: " + b.textContent.trim(); }
      case "set_style": return (a.kind === "image" ? "image" : "video") + " style: " + setSelect(a.kind === "image" ? "styleSel" : "videoStyleSel", a.name);
      case "set_setting": {
        const id = SETTING_IDS[a.name], el = $(id); if (!el) throw new Error(a.name + " is not on this page");
        if (el.type === "checkbox") { el.checked = /^(on|yes|true|1|enable)/i.test(a.value); fire(el); return `${a.name}: ${el.checked ? "on" : "off"}`; }
        if (el.tagName === "SELECT") return `${a.name}: ` + setSelect(id, String(a.value).replace(/p$/i, ""));
        el.value = String(a.value).replace(/[^\d.\-]/g, ""); fire(el); return `${a.name}: ${el.value}`;
      }
      case "generate": { const b = $("go"); if (!b) throw new Error("no Generate button"); b.click(); return "▶ Generate pressed"; }
      case "generate_image": { const b = $("goImg"); if (!b) throw new Error("no Generate Image button"); b.click(); return "🖼 making a picture"; }
      case "cancel_job": {
        const js = await (await fetch("/api/jobs")).json(); const run = (js || []).find((x) => x.status === "running");
        if (!run) return "nothing is running";
        await fetch(`/api/jobs/${run.id}/cancel`, { method: "POST" }); return "⏹ stopped the running job";
      }
      case "add_scene": {
        const r = await (await fetch("/api/scenes/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: a.text }) })).json();
        if (r.error) throw new Error(r.error);
        try { if (root.H3Story && root.H3Story.refresh) root.H3Story.refresh(); } catch (e) { /* the board polls */ }
        return "🎬 scene added to the StoryBoard";
      }
      case "render_scene": { const b = doc.querySelector(`[data-scplay="${a.n}"]`); if (!b) throw new Error(`scene ${a.n} is not on the StoryBoard`); if (b.disabled) return `scene ${a.n} is already rendering`; b.click(); return `▶ rendering scene ${a.n}`; }
      case "show": {
        const d = DOCKS[a.docker]; if (!d) throw new Error("no such docker");
        if (d.sf) { if (root.SecFloat && root.SecFloat.show) root.SecFloat.show(d.sf, true); return "shown: " + a.docker; }
        const el = $(d.el), app = $("app");
        const hidden = (d.app && app && app.classList.contains(d.app)) || (el && el.classList.contains("dockgone"));
        if (hidden && $(d.btn)) $(d.btn).click();
        if (el && el.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(d.el);
        return "shown: " + a.docker;
      }
      case "stop_listening": return "";
      default: throw new Error("unknown action " + a.do);
    }
  }

  /* ---- open / close */
  async function start() {
    panel(); S.open = true; S.listen = true; S.phase = "listening"; paint();
    tev("voice", "open");
    if (!(await startMic())) { S.phase = "typing"; paint(); }
    else if (!$("vcLog").children.length) bubble("ai", "I'm listening - ask for a prompt, a style, a setting, or say generate.");
    try { fetch("/api/voice/status").then((r) => r.json()).then((s) => { if (s && s.asr && !s.asr.installed) bubble("err", "faster-whisper is not installed - Settings ▸ Audio ▸ Install faster-whisper (typing works meanwhile)"); }).catch(() => {}); } catch (e) { /* fine */ }
    paint();
  }
  function stop() {
    stopMic(); S.open = false; S.phase = "off"; S.busy = false;
    try { root.speechSynthesis.cancel(); } catch (e) { /* none */ }
    const p = $("vcPanel"); if (p) p.remove();
    try { fetch("/api/voice/stop", { method: "POST" }).catch(() => {}); } catch (e) { /* fine */ }
    paint(); tev("voice", "closed");
  }
  const toggle = () => (S.open ? stop() : start());
  function button() {
    const sb = $("statusbar"); if (!sb || $("tVoice")) return;
    const b = doc.createElement("button"); b.id = "tVoice"; b.type = "button"; b.textContent = "🎙 Voice";
    b.title = "Voice chat (Ctrl+Alt+V) - talk to the app: ask for a prompt, a style, a setting, say generate; it answers out loud";
    b.onclick = toggle;
    const after = $("tDG") || $("tQ");
    sb.insertBefore(b, after ? after.nextSibling : $("sbdot"));
  }
  root.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && (e.code === "KeyV" || String(e.key).toLowerCase() === "v")) { e.preventDefault(); e.stopPropagation(); toggle(); }
  }, true);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", button); else button();
  root.setTimeout(button, 3000);
  root.H3Voice = Object.assign(API, { start, stop, toggle, turn, act, state, speak, _S: S, _block: block });
})(typeof window !== "undefined" ? window : globalThis);
