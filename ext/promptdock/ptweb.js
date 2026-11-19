/* ext/promptdock/ptweb.js — 2.885.0: 🌐 in the prompt docker's left column turns the LLM's web search on / off for the chat
 * (window.H3WebTools.on() - read by chatPost in static/index.html, the server runs lib/llmAgent.js). While a chat turn runs with
 * it on, the "…thinking" line says what the LLM is doing (searching "…", reading a page). Kept in localStorage h3.chat.web.
 * The tools only search and read (lib/webTools.js) - nothing from the web is downloaded, installed or run. */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  if (!doc) return;
  const KEY = "h3.chat.web";
  const on = () => { try { return root.localStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
  function paint() {
    const b = $("ptWeb"); if (!b) return;
    const v = on(); b.classList.toggle("on", v); b.setAttribute("aria-pressed", v ? "true" : "false");
    b.style.outline = v ? "2px solid var(--tiger, #f5a623)" : "";
  }
  function set(v) { try { root.localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) { /* fine */ } paint(); }
  // 2.887.0: the folder's tools (🧰) in the same "…thinking" line
  const FILE_LINE = { file_list: (s) => `📁 looking in ${(s.args && s.args.path) || "the folder"}`, file_read: (s) => `📄 reading ${(s.args && s.args.path) || ""}`, file_search: (s) => `🔍 finding “${(s.args && s.args.pattern) || ""}”`, file_write: (s) => `✏ writing ${(s.args && s.args.path) || ""}`, file_edit: (s) => `✏ changing ${(s.args && s.args.path) || ""}`, run_command: (s) => `▶ running ${(s.args && s.args.command) || ""}` };
  const line = (s) => FILE_LINE[s.tool] ? FILE_LINE[s.tool](s) + (s.ok ? (s.detail ? " - " + s.detail : "") : " - " + s.error) : s.tool === "web_download" ? `⬇ downloading${s.ok ? " " + s.detail : " - " + s.error}` : s.tool === "web_search" ? `🌐 searching “${(s.args && s.args.query) || ""}”${s.ok ? " - " + s.detail : " - " + s.error}` : s.tool === "web_read" ? `📄 reading ${(() => { try { return new URL(s.args.url).hostname; } catch (e) { return (s.args && s.args.url) || ""; } })()}${s.ok ? "" : " - " + s.error}` : s.tool;
  // while a chat turn runs with 🌐 on, the "…thinking" bubble shows the tool loop's steps (GET /api/websearch/activity)
  let polling = false, wasBusy = false, sawDownload = false;
  async function tick() {
    const busy = typeof root.chatBusyNow === "function" && root.chatBusyNow();
    // 2.886.0: a turn that downloaded something -> the Gallery shows it (web/downloads)
    if (!busy && wasBusy && sawDownload && typeof root.refreshGallery === "function") { try { root.refreshGallery(); } catch (e) { /* later */ } }
    if (!busy) { wasBusy = false; sawDownload = false; }
    if (!busy || !(on() || (root.H3AgentTools && root.H3AgentTools.on())) || polling) return;
    wasBusy = true;
    polling = true;
    try {
      const j = await (await root.fetch("/api/websearch/activity")).json();
      const el = [...doc.querySelectorAll("#chatlog .cm.assistant")].pop(), txt = el && el.querySelector(".ctext");
      if (j.steps && j.steps.some((x) => x.tool === "web_download" && x.ok)) sawDownload = true;
      if (txt && j.busy && j.steps && j.steps.length && /^…/.test(txt.textContent)) txt.textContent = "…" + j.steps.map(line).join("\n…");
    } catch (e) { /* the next tick */ } finally { polling = false; }
  }
  function wire() {
    const b = $("ptWeb"); if (!b || b.dataset.wired) return; b.dataset.wired = "1";
    b.addEventListener("click", () => { set(!on()); if (typeof root.appNote === "function") root.appNote(on() ? "🌐 web search on - the chat's LLM can search the web and read pages (search and read only)" : "🌐 web search off"); });
    root.setInterval(tick, 800);
    paint();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  setTimeout(wire, 1500);
  root.H3WebTools = { on, set, tick, line };
})(typeof window !== "undefined" ? window : globalThis);
