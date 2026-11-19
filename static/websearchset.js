/* static/websearchset.js — 2.885.0: Settings ▸ General ▸ 🌐 Web search for the LLM (window.H3WebSearchSet).
 * ☐ Brave Search (off until ticked) + its API key (kept encrypted, never sent back to the page - only its last 4 letters),
 * an optional SearXNG server address, ✓ Test; Wikipedia's own search when neither is set. The prompt docker's 🌐 turns it on
 * for the chat (ext/promptdock/ptweb.js). The safety line says what the web tools can and cannot do.
 * Tim (verbatim): "add brave but put in in settings-general tab with a checkbox , it will be off by default and user can
 * select it and enter an api key. can we have security filters in place so no malicious scripts can be run" */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const api = async (u, body) => { const r = await root.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
  const NAMES = { brave: "Brave Search", searxng: "SearXNG", wikipedia: "Wikipedia only (built in, no key) - install SearXNG for the whole web" };
  const HTML = `<label class="f" style="margin-top:14px">🌐 Web search for the LLM</label>
    <div class="rowbtns" style="align-items:center"><label class="chk" style="margin:0"><input type="checkbox" id="s_wsBrave"> Use Brave Search</label>
      <span class="hint" style="flex:1">off until you tick it - needs your Brave Search API key</span></div>
    <div class="grid3" style="align-items:end;margin-top:4px" id="s_wsKeyRow">
      <div style="grid-column:1/3"><input type="password" id="s_wsKey" spellcheck="false" autocomplete="off" aria-label="Brave Search API key" placeholder="Brave Search API key (api-dashboard.search.brave.com → API Keys)"></div>
      <div><button class="ghost" id="s_wsTestBrave" type="button" style="width:100%">Test Brave</button></div></div>
    <div class="grid3" style="align-items:end;margin-top:6px">
      <div style="grid-column:1/3"><input id="s_wsSearx" spellcheck="false" autocomplete="off" aria-label="SearXNG server address" placeholder="SearXNG server address (optional), e.g. http://127.0.0.1:8888"></div>
      <div><button class="ghost" id="s_wsTestSearx" type="button" style="width:100%">Test SearXNG</button></div></div>
    <div class="rowbtns" style="margin-top:6px;align-items:center"><button class="ghost" id="s_wsSxInstall" type="button" title="SearXNG asks many search engines at once - free, no key, runs on this computer (127.0.0.1 only). About 100 MB.">⬇ Install SearXNG here (free, no key)</button>
      <button class="ghost" id="s_wsSxStart" type="button" style="display:none">▶ Start</button><span id="s_wsSx" class="hint" style="flex:1"></span></div>
    <pre id="s_wsSxLog" class="mono" style="display:none;max-height:110px;overflow:auto;font-size:11px;margin:4px 0;white-space:pre-wrap"></pre>
    <div class="rowbtns" style="margin-top:6px;align-items:center"><span id="s_wsStatus" class="hint" style="flex:1"></span></div>
    <p class="hint help" style="margin-top:4px">With <b>🌐</b> on in the prompt docker the chat's LLM searches the web and reads pages before it answers, with
      its sources listed. It uses Brave Search when ticked here, else your SearXNG server (its settings.yml must allow the json format),
      else bitGen's own SearXNG (⬇ Install SearXNG here - many search engines at once, free, on this computer), else Wikipedia's own search. Brave bills searches after a free monthly allowance - see their site. The key is kept encrypted on
      this computer and sent only to Brave.<br><b>Safety:</b> the web tools only search and read pages as text. Nothing from the web is
      downloaded, installed or run; scripts are stripped from pages; addresses on this computer or your network are never fetched;
      program files and archives are refused; while web pages are in a turn no other tool can act.</p>`;
  function status(t, ok) { const s = $("s_wsStatus"); if (s) { s.textContent = t; s.style.color = ok == null ? "" : ok ? "#7c7" : "#e66"; } }
  async function fill() {
    try {
      const v = await api("/api/websearch/settings");
      $("s_wsBrave").checked = !!v.brave.on; $("s_wsKeyRow").style.opacity = v.brave.on ? "1" : ".55";
      if (doc.activeElement !== $("s_wsKey")) { $("s_wsKey").value = ""; $("s_wsKey").placeholder = v.brave.hasKey ? `key saved (…${v.brave.tail}) - type to replace it` : "Brave Search API key (api-dashboard.search.brave.com → API Keys)"; }
      if (doc.activeElement !== $("s_wsSearx")) $("s_wsSearx").value = v.searxng.url || "";
      status("searching with: " + NAMES[v.engine] + (v.brave.on && !v.brave.hasKey ? " - Brave is ticked but has no key yet" : ""));
    } catch (e) { status("✗ " + e.message, false); }
  }
  async function save(b) { try { await api("/api/websearch/settings", b); await fill(); } catch (e) { status("✗ " + e.message, false); } }
  async function test(which) {
    status(`asking ${NAMES[which]}…`);
    try { const r = await api("/api/websearch/test", { which }); status(`✓ ${NAMES[r.engine]} answered - ${r.results} result(s)${r.first ? ": " + r.first : ""}`, true); }
    catch (e) { status("✗ " + e.message, false); }
  }
  // 2.886.0: 🔎 bitGen's own SearXNG - install, its state, start
  let sxTimer = null;
  async function sxPaint() {
    try {
      const v = await api("/api/websearch/searxng"), busy = v.job && v.job.state === "running";
      $("s_wsSxInstall").style.display = v.installed && !busy ? "none" : "";
      $("s_wsSxInstall").disabled = !!busy; $("s_wsSxInstall").textContent = busy ? "⏳ installing SearXNG…" : "⬇ Install SearXNG here (free, no key)";
      $("s_wsSxStart").style.display = v.installed && !v.running && !busy ? "" : "none";
      $("s_wsSx").textContent = busy ? "installing - a few minutes" : v.installed ? (v.running ? "✓ bitGen's SearXNG is running (" + v.url + ")" : "✓ installed - it starts when the chat searches") : v.job && v.job.state === "error" ? "✗ " + v.job.error : "not installed";
      const lg = $("s_wsSxLog"); lg.style.display = busy || (v.job && v.job.state === "error") ? "" : "none"; lg.textContent = (v.log || []).join("\n"); lg.scrollTop = lg.scrollHeight;
      if (busy) { clearTimeout(sxTimer); sxTimer = setTimeout(sxPaint, 1500); } else if (v.job && v.job.state === "done") fill();
    } catch (e) { $("s_wsSx").textContent = "✗ " + e.message; }
  }
  function wire() {
    const host = $("s_websearch"); if (!host || host.dataset.wired) return; host.dataset.wired = "1";
    host.innerHTML = HTML;
    $("s_wsBrave").onchange = (e) => save({ braveOn: e.target.checked });
    let t = null;
    $("s_wsKey").addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { const v = $("s_wsKey").value.trim(); if (v) save({ braveKey: v }).then(() => { $("s_wsKey").value = ""; }); }, 700); });
    $("s_wsSearx").addEventListener("change", () => save({ searxngUrl: $("s_wsSearx").value.trim() }));
    $("s_wsTestBrave").onclick = async () => { const v = $("s_wsKey").value.trim(); if (v) await save({ braveKey: v }); $("s_wsKey").value = ""; test("brave"); };
    $("s_wsTestSearx").onclick = async () => { await save({ searxngUrl: $("s_wsSearx").value.trim() }); test("searxng"); };
    $("s_wsSxInstall").onclick = async () => { try { await api("/api/websearch/searxng/install", {}); } catch (e) { status("✗ " + e.message, false); } sxPaint(); };
    $("s_wsSxStart").onclick = async () => { $("s_wsSx").textContent = "starting…"; try { await api("/api/websearch/searxng/start", {}); } catch (e) { status("✗ " + e.message, false); } sxPaint(); fill(); };
    const os = $("openSettings"); if (os) os.addEventListener("click", () => setTimeout(() => { fill(); sxPaint(); }, 60));
    fill(); sxPaint();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  root.H3WebSearchSet = { fill, save, test, sxPaint };
})(typeof window !== "undefined" ? window : globalThis);
