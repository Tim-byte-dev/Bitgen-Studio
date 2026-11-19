/* static/agentset.js — 2.887.0: Settings ▸ General ▸ 🧰 Files and commands for the LLM (window.H3AgentSet).
 * The ONE folder the chat's LLM may work in (📁 Pick… - the folder dialog; never a whole drive, the home folder or bitGen's own
 * folder - lib/agentTools.js folderProblem), the time limit for a command, 📜 the log of every change and command (↶ puts a
 * changed file back from its backup). The prompt docker's 🧰 turns it on for the chat (ext/promptdock/ptagent.js). */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const api = async (u, body) => { const r = await root.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const HTML = `<label class="f" style="margin-top:14px">🧰 Files and commands for the LLM</label>
    <div class="grid3" style="align-items:end">
      <div style="grid-column:1/3"><input id="s_agFolder" readonly spellcheck="false" aria-label="The folder the LLM may work in" placeholder="no folder picked - the LLM can't use any files"></div>
      <div class="rowbtns" style="margin:0"><button class="ghost" id="s_agPick" type="button" style="flex:1">📁 Pick…</button><button class="ghost" id="s_agClear" type="button" title="No folder - the 🧰 tools are off">✕</button></div></div>
    <div class="rowbtns" style="margin-top:6px;align-items:center"><span>A command stops after</span>
      <input id="s_agTimeout" type="number" min="5" max="600" step="5" style="width:80px;flex:none" aria-label="Command time limit in seconds"><span>seconds</span>
      <button class="ghost" id="s_agLogBtn" type="button" style="margin-left:auto">📜 Log</button></div>
    <div class="rowbtns" style="margin-top:4px"><span id="s_agStatus" class="hint" style="flex:1"></span></div>
    <div id="s_agLog" style="display:none;max-height:220px;overflow:auto;font-size:12px;margin:4px 0"></div>
    <p class="hint help" style="margin-top:4px">With <b>🧰</b> on in the prompt docker the chat's LLM can list, read and search the files in this
      folder, and - only after you see each one and say yes - change a file (you see the change: red lines out, green lines in)
      or run a command here (you see the command; it is stopped after the time limit). Every changed file is backed up first
      (📜 Log ▸ ↶ puts it back) and every change and command is written in the log.<br><b>Safety:</b> nothing outside this folder,
      never a whole drive, your home folder or bitGen's own folder; files inside .git are never changed; an answer that read web
      pages can't use the folder, and an answer that used the folder can't go on the web.</p>`;
  function status(t, ok) { const s = $("s_agStatus"); if (s) { s.textContent = t; s.style.color = ok == null ? "" : ok ? "#7c7" : "#e66"; } }
  async function fill() {
    if (!$("s_agFolder")) return;
    try {
      const v = await api("/api/agent/settings");
      $("s_agFolder").value = v.folder || "";
      if (doc.activeElement !== $("s_agTimeout")) $("s_agTimeout").value = v.timeout;
      status(!v.folder ? "no folder - the 🧰 tools can't be used" : v.problem ? "✗ " + v.problem : !v.exists ? "✗ that folder is not there any more" : "✓ the LLM works in this folder when 🧰 is on", v.folder ? !v.problem && v.exists : null);
    } catch (e) { status("✗ " + e.message, false); }
  }
  async function save(b) { try { await api("/api/agent/settings", b); await fill(); if (root.H3AgentTools) root.H3AgentTools.load(); } catch (e) { status("✗ " + e.message, false); } }
  async function showLog() {
    const box = $("s_agLog");
    if (box.style.display !== "none") { box.style.display = "none"; return; }
    box.style.display = "";
    try {
      const L = (await api("/api/agent/log")).entries || [];
      box.innerHTML = L.length ? L.map((e, i) => {
        const when = new Date(e.at).toLocaleString();
        const what = e.kind === "command" ? `▶ ${esc(e.command)} - ${e.approved ? (e.timedOut ? "stopped at the time limit" : "exit " + e.code) : "not run (" + esc(e.why || "no") + ")"}`
          : e.kind === "restore" ? `↶ ${esc(e.path)} put back` : `✏ ${esc(e.path)} - ${e.approved ? (e.isNew ? "made" : "changed") + ` (+${e.added} −${e.removed})` : "not changed (" + esc(e.why || "no") + ")"}`;
        const undo = e.approved && e.backup && e.kind !== "command" ? ` <button class="ghost" data-agundo="${i}" type="button" style="padding:0 6px" title="Put the file back as it was before this change">↶</button>` : "";
        return `<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span class="hint">${esc(when)}</span> ${what}${undo}</div>`;
      }).join("") : `<div class="hint">nothing yet</div>`;
      box.querySelectorAll("[data-agundo]").forEach((b) => { b.onclick = async () => {
        const e = L[+b.dataset.agundo];
        const ok = typeof root.appConfirm === "function" ? await root.appConfirm(`Put ${e.path} back as it was before this change? (the file as it is now is backed up first)`, "↶ Put the file back") : true;
        if (!ok) return;
        try { await api("/api/agent/restore", { backup: e.backup }); status("✓ " + e.path + " put back", true); box.style.display = "none"; showLog(); } catch (x) { status("✗ " + x.message, false); }
      }; });
    } catch (e) { box.textContent = "✗ " + e.message; }
  }
  function wire() {
    const host = $("s_agent"); if (!host || host.dataset.wired) return; host.dataset.wired = "1";
    host.innerHTML = HTML;
    $("s_agPick").onclick = async () => {
      if (!root.FileDialog || typeof root.FileDialog.open !== "function") { status("✗ the folder dialog is not ready", false); return; }
      const r = await root.FileDialog.open({ mode: "dir", title: "The folder the LLM may work in", okLabel: "Select Folder", start: $("s_agFolder").value || undefined, key: "agentfolder" });
      if (r && (r.path || r.dir)) save({ folder: r.path || r.dir });
    };
    $("s_agClear").onclick = () => save({ folder: "" });
    $("s_agTimeout").addEventListener("change", () => save({ timeout: +$("s_agTimeout").value }));
    $("s_agLogBtn").onclick = showLog;
    const os = $("openSettings"); if (os) os.addEventListener("click", () => setTimeout(fill, 60));
    fill();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  root.H3AgentSet = { fill, save, showLog };
})(typeof window !== "undefined" ? window : globalThis);
