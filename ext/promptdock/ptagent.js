/* ext/promptdock/ptagent.js — 2.887.0: 🧰 FILES AND COMMANDS FOR THE CHAT (window.H3AgentTools).
 * The prompt docker's 🧰 turns the folder tools on / off for the chat (kept in localStorage h3.chat.files); with no folder
 * picked yet it opens the folder dialog first (right-click = pick another). static/index.html chatPost sends context.files,
 * the server runs lib/llmAgent.js with lib/agentTools.js inside that folder.
 * While a chat turn runs, GET /api/agent/asks is polled: a change (the diff - red lines out, green lines in) or a command waits
 * for YOUR answer here - ✔ Yes / ✕ Refuse (a change also: ✔ Yes to all changes in this answer; a command is always asked).
 * Nothing is changed or run without a yes; no answer in 5 minutes = no. */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  if (!doc) return;
  const KEY = "h3.chat.files";
  let folder = "";
  const on = () => { try { return root.localStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
  const api = async (u, body) => { const r = await root.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const note = (t) => { if (typeof root.appNote === "function") root.appNote(t); };
  function paint() {
    const b = $("ptFiles"); if (!b) return;
    const v = on(); b.classList.toggle("on", v); b.setAttribute("aria-pressed", v ? "true" : "false");
    b.style.outline = v ? "2px solid var(--tiger, #f5a623)" : "";
    b.dataset.folder = folder;
  }
  function set(v) { try { root.localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) { /* fine */ } paint(); }
  async function load() { try { const v = await api("/api/agent/settings"); folder = v.exists && !v.problem ? v.folder : ""; } catch (e) { folder = ""; } paint(); return folder; }
  /** the folder dialog (static/filedialog.js) -> saved on the server (checked there) */
  async function pick() {
    if (!root.FileDialog || typeof root.FileDialog.open !== "function") { note("The folder dialog is not ready - pick the folder in Settings ▸ General ▸ 🧰"); return ""; }
    const r = await root.FileDialog.open({ mode: "dir", title: "The folder the LLM may work in", okLabel: "Select Folder", start: folder || undefined, key: "agentfolder" });
    if (!r || !(r.path || r.dir)) return "";
    try { const v = await api("/api/agent/settings", { folder: r.path || r.dir }); folder = v.folder; paint(); if (root.H3AgentSet) root.H3AgentSet.fill(); return folder; }
    catch (e) { note("🧰 " + e.message); return ""; }
  }
  async function toggle() {
    if (on()) { set(false); note("🧰 files and commands off"); return; }
    if (!(await load()) && !(await pick())) return;
    set(true);
    note("🧰 files and commands on - the chat's LLM can look at the files in " + folder + "; every change and every command is shown to you first and only happens when you say yes");
  }

  /* ---------- the yes / no box ---------- */
  let shown = null;            // the ask id on screen
  const seen = new Set();
  function dialog() {
    let d = $("agentAskDlg"); if (d) return d;
    d = doc.createElement("dialog"); d.id = "agentAskDlg"; d.style.cssText = "max-width:min(900px,92vw);width:760px";
    d.innerHTML = `<h3 id="agAskTitle">—</h3><div id="agAskInfo" class="hint" style="margin:4px 0 6px"></div>
      <pre id="agAskBody" class="mono" style="white-space:pre-wrap;user-select:text;max-height:56vh;overflow:auto;font-size:12px;margin:0;padding:8px;background:rgba(0,0,0,.25);border-radius:6px"></pre>
      <div class="brow" style="justify-content:flex-end;gap:8px;margin-top:10px">
        <button class="ghost" id="agAskNo" type="button">✕ Refuse</button>
        <button class="ghost" id="agAskAll" type="button" title="Yes to this change and to every other file change in this answer (commands are still asked one by one)">✔ Yes to all changes in this answer</button>
        <button class="go" id="agAskYes" type="button" style="width:auto;margin-top:0;padding:6px 22px">✔ Yes</button></div>`;
    doc.body.appendChild(d);
    return d;
  }
  /** a change's rows as coloured lines: - red (taken out), + green (put in), @ a grey place marker */
  function diffHtml(rows, more) {
    return (rows || []).map((r) => r.t === "@" ? `<span style="color:#8a94a6">@@ ${esc(r.s)} @@</span>` : r.t === "-" ? `<span style="color:#ff8a80;background:rgba(255,80,80,.10);display:block">- ${esc(r.s)}</span>`
      : r.t === "+" ? `<span style="color:#9be59b;background:rgba(80,200,80,.10);display:block">+ ${esc(r.s)}</span>` : `<span style="display:block;opacity:.75">  ${esc(r.s)}</span>`).join("") + (more ? "\n… (more changes)" : "");
  }
  function show(a) {
    const d = dialog(); shown = a.id; seen.add(a.id);
    const isCmd = a.kind === "exec";
    $("agAskTitle").textContent = isCmd ? "🧰 The LLM wants to run a command" : a.isNew ? "🧰 The LLM wants to make a new file" : "🧰 The LLM wants to change a file";
    $("agAskInfo").textContent = isCmd ? `in ${a.folder} - stopped after ${a.timeout} s if it is still running` : `${a.path} in ${a.folder} - +${a.added} / −${a.removed} lines${a.isNew ? "" : " · the old file is backed up first"}`;
    $("agAskBody").innerHTML = isCmd ? esc(a.command) : diffHtml(a.rows, a.more);
    $("agAskAll").style.display = isCmd ? "none" : "";
    $("agAskYes").textContent = isCmd ? "▶ Yes, run it" : "✔ Yes";
    const done = async (ok, all) => { d.onclose = null; if (d.open) d.close(); shown = null; try { await api("/api/agent/answer", { id: a.id, ok, all: !!all }); } catch (e) { /* it timed out already */ } };
    $("agAskYes").onclick = () => done(true);
    $("agAskAll").onclick = () => done(true, true);
    $("agAskNo").onclick = () => done(false);
    d.onclose = () => { if (shown === a.id) done(false); };   // Esc = Refuse
    if (!d.open) d.showModal();
    $("agAskNo").focus();     // never yes by an Enter meant for something else
  }
  let polling = false;
  async function tick() {
    const busy = typeof root.chatBusyNow === "function" && root.chatBusyNow();
    if (!on() || !busy || polling) { if (!busy && shown) { const d = $("agentAskDlg"); if (d && d.open) { d.onclose = null; d.close(); } shown = null; } return; }
    polling = true;
    try {
      const j = await api("/api/agent/asks");
      const L = j.asks || [];
      if (shown && !L.some((a) => a.id === shown)) { const d = $("agentAskDlg"); if (d && d.open) { d.onclose = null; d.close(); } shown = null; }
      const next = L.find((a) => !seen.has(a.id));
      if (!shown && next) show(next);
    } catch (e) { /* the next tick */ } finally { polling = false; }
  }
  function wire() {
    const b = $("ptFiles"); if (!b || b.dataset.wired) return; b.dataset.wired = "1";
    b.addEventListener("click", toggle);
    b.addEventListener("contextmenu", (e) => { e.preventDefault(); pick().then((f) => { if (f) { set(true); note("🧰 the LLM's folder: " + f); } }); });
    root.setInterval(tick, 700);
    load();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  setTimeout(wire, 1500);
  root.H3AgentTools = { on, set, load, pick, toggle, tick, show, diffHtml, folder: () => folder };
})(typeof window !== "undefined" ? window : globalThis);
