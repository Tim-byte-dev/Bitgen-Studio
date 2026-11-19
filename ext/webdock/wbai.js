/* bitGen Studio — ext/webdock/wbai.js (2.865.0): ✨ the Web editor's AI prompt docker (Tim: "add prompt input docker inside web builder
 * to edit via ai. user can type or speak").
 *   a panel at the foot of the 🌐 Web editor (✨ on the top bar folds it; kept in localStorage wb.ai): what to change, typed (Enter sends,
 *   Shift+Enter a new line) or 🎙 spoken (press = listen, press again = stop: this computer's speech to text - /api/voice/hear, the
 *   Download / Cancel box when it is not installed); the selection in </> Code = only that part is changed, else the whole open file;
 *   POST /api/web/ai/edit -> the editor gets the result as ONE change: "+3 −1 lines" with ↶ Undo (the text before) - nothing is saved
 *   until 💾 Save. The last asks are a list to pick from again. */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const S = { busy: false, before: null, rec: null, hist: [] };
  try { S.hist = JSON.parse(root.localStorage.getItem("wb.ai.hist") || "[]").slice(0, 12); } catch (e) { /* none */ }
  const say = (t, cls) => { const o = $("wbAiOut"); if (o) { o.textContent = t || ""; o.className = cls || ""; } };
  async function api(u, body) {
    const r = await root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j;
  }
  function selection() {
    const W = root.H3Web && root.H3Web.state(), c = $("wbCode");
    if (W && W.tab === "code" && c && c.selectionEnd > c.selectionStart) return [c.selectionStart, c.selectionEnd];
    return null;
  }
  function paintScope() {
    const W = root.H3Web && root.H3Web.state(), s = selection(), el = $("wbAiScope"); if (!el) return;
    el.textContent = !W || !W.path ? "open a file first" : s ? `the selected part of ${W.path} (${s[1] - s[0]} characters)` : `the whole of ${W.path}`;
  }
  async function go() {
    if (S.busy) return;
    const ask = $("wbAiAsk").value.trim(), W = root.H3Web && root.H3Web.state(); if (!ask) { $("wbAiAsk").focus(); return; }
    if (!W || !W.path || W.tab === "crm") return say("open a page (or a .css / .js file) first - ✨ changes the open file", "err");
    const text = root.H3Web.currentText(), sel = selection();
    S.busy = true; $("wbAiGo").disabled = true; say("✨ the LLM is changing " + (sel ? "the selected part" : W.path) + "…");
    try {
      const r = await api("/api/web/ai/edit", { path: W.path, text, ask, a: sel ? sel[0] : 0, b: sel ? sel[1] : 0 });
      S.before = { path: W.path, text };
      root.H3Web.setText(r.text);
      const c = $("wbCode"); if (sel && c && W.tab === "code") { c.focus(); c.setSelectionRange(r.a, r.b); }
      say(`✓ +${r.added} −${r.removed} line(s) - 💾 Save to keep it`, "ok"); $("wbAiUndo").hidden = false;
      S.hist = [ask].concat(S.hist.filter((h) => h !== ask)).slice(0, 12); try { root.localStorage.setItem("wb.ai.hist", JSON.stringify(S.hist)); } catch (e) { /* fine */ }
      paintHist(); $("wbAiAsk").value = "";
      if (root.H3TestEvent) { try { root.H3TestEvent("web_ai", W.path); } catch (e) { /* the 🧪 list */ } }
    } catch (e) { say("✗ " + e.message, "err"); }
    S.busy = false; $("wbAiGo").disabled = false;
  }
  function undo() {
    const W = root.H3Web && root.H3Web.state(); if (!S.before || !W || W.path !== S.before.path) return;
    root.H3Web.setText(S.before.text); S.before = null; $("wbAiUndo").hidden = true; say("↶ put back as it was");
  }
  function paintHist() { const l = $("wbAiHist"); if (l) l.innerHTML = '<option value="">⌚ earlier…</option>' + S.hist.map((h) => `<option>${h.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</option>`).join(""); }
  /* 🎙 speak: press = listen, press again = what was said into the box */
  async function mic() {
    const b = $("wbAiMic");
    if (S.rec) { const r = S.rec; S.rec = null; b.classList.remove("on"); b.textContent = "🎙"; return hear(r); }
    if (root.H3NeedInstall && !(await root.H3NeedInstall.ensure("whisper", "to type what you say into the ✨ AI box"))) return;
    if (!root.navigator.mediaDevices || !root.navigator.mediaDevices.getUserMedia) return say("this window cannot use the microphone - type instead", "err");
    let stream; try { stream = await root.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { return say("the microphone was refused (" + (e.message || e.name) + ") - type instead", "err"); }
    const AC = root.AudioContext || root.webkitAudioContext, ctx = new AC(), src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain();
    mute.gain.value = 0; src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    const r = { stream, ctx, proc, chunks: [], rate: ctx.sampleRate, t0: Date.now() }; proc.onaudioprocess = (e) => r.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    S.rec = r; b.classList.add("on"); b.textContent = "⏹"; say("🎙 listening - press ⏹ when you have said it");
    setTimeout(() => { if (S.rec === r) mic(); }, 90000);   // a minute and a half at most
  }
  async function hear(r) {
    try { r.proc.disconnect(); r.ctx.close(); r.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* gone */ }
    const n = r.chunks.reduce((a, c) => a + c.length, 0); if (n < r.rate * 0.3) return say("nothing heard");
    const all = new Float32Array(n); let o = 0; for (const c of r.chunks) { all.set(c, o); o += c.length; }
    const V = root.H3Voice; if (!V || !V.encodeWav) return say("the speech part of the app is not loaded", "err");
    const wav = V.encodeWav(V.downsample(all, r.rate, 16000), 16000), fd = new FormData(); fd.append("audio", new Blob([wav], { type: "audio/wav" }), "ask.wav");
    say("🎙 writing down what you said…");
    try {
      const j = await (await root.fetch("/api/voice/hear", { method: "POST", body: fd })).json(); if (j.error) throw new Error(j.error);
      const t = String(j.text || "").trim(); if (!t) return say("nothing heard - try again closer to the microphone");
      const a = $("wbAiAsk"); a.value = (a.value.trim() ? a.value.trim() + " " : "") + t; a.focus(); say("🎙 heard - ✨ Change it, or say more");
    } catch (e) { say("✗ " + e.message, "err"); }
  }
  function fold(open) { const p = $("wbAi"); if (!p) return; p.classList.toggle("shut", !open); $("wbAiBtn") && $("wbAiBtn").classList.toggle("on", open); try { root.localStorage.setItem("wb.ai", open ? "1" : "0"); } catch (e) { /* fine */ } if (open) { paintScope(); $("wbAiAsk").focus(); } }
  function build() {
    const wrap = $("wbWrap"); if (!wrap || $("wbAi")) return !!wrap;
    const p = doc.createElement("div"); p.id = "wbAi";
    p.innerHTML = '<div class="wbbar"><b>✨ Edit with the AI</b><span id="wbAiScope" style="font-size:11px;color:var(--dim)"></span>'
      + '<select id="wbAiHist" title="Ask again" style="margin-left:auto;max-width:180px"></select><button class="ghost" type="button" id="wbAiFold" title="Fold the ✨ panel">▾</button></div>'
      + '<div class="wbbar"><textarea id="wbAiAsk" rows="2" placeholder="Say what to change - e.g. make the hero blue with a bigger heading, add a price list under the gallery… (Enter = go, Shift+Enter = a new line)"></textarea>'
      + '<div class="wbAiBtns"><button class="ghost" type="button" id="wbAiMic" title="Speak instead of typing - press, say it, press again">🎙</button><button class="go" type="button" id="wbAiGo" title="The LLM changes the open file (or the selected part) - one change, ↶ Undo">✨ Change it</button></div></div>'
      + '<div class="wbbar"><span id="wbAiOut"></span><button class="ghost" type="button" id="wbAiUndo" hidden title="Put the file back as it was before the AI\'s change">↶ Undo</button></div>';
    wrap.parentNode.insertBefore(p, wrap.nextSibling);
    const bar = $("wbSk"); if (bar && !$("wbAiBtn")) { const b = doc.createElement("button"); b.className = "ghost"; b.type = "button"; b.id = "wbAiBtn"; b.title = "✨ Edit with the AI - type or speak what to change"; b.textContent = "✨ AI"; bar.parentNode.insertBefore(b, bar); b.addEventListener("click", () => fold($("wbAi").classList.contains("shut"))); }
    $("wbAiGo").addEventListener("click", go); $("wbAiMic").addEventListener("click", mic); $("wbAiUndo").addEventListener("click", undo); $("wbAiFold").addEventListener("click", () => fold(false));
    $("wbAiAsk").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } });
    $("wbAiHist").addEventListener("change", (e) => { if (e.target.value) { $("wbAiAsk").value = e.target.value; e.target.value = ""; $("wbAiAsk").focus(); } });
    doc.addEventListener("selectionchange", () => { if (!p.classList.contains("shut")) paintScope(); });
    $("webdock").addEventListener("click", () => setTimeout(paintScope, 0));
    paintHist(); let open = "1"; try { open = root.localStorage.getItem("wb.ai") || "1"; } catch (e) { /* fine */ } fold(open === "1");
    return true;
  }
  function start() { if (!build()) setTimeout(start, 400); }
  root.WbAi = { go, undo, fold, state: () => S };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
