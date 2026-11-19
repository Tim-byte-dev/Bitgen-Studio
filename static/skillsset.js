/* static/skillsset.js — 2.888.0: Settings ▸ General ▸ 🎛 Skills for the chat's LLM (window.H3SkillsSet).
 * The list (built in / yours, a skill of yours with a built-in's name used instead of it), ＋ New skill / ✎ edit in a box
 * (name, when it is used = the description the LLM reads, the instructions), 🗑 delete (yours), ⤒ Import a SKILL.md. The prompt
 * docker's 🎛 lets the chat use them (ext/promptdock/ptapp.js); the LLM loads one with use_skill when it fits (lib/skills.js). */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const api = async (u, body, method) => { const r = await root.fetch(u, body || method ? { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const HTML = `<label class="f" style="margin-top:14px">🎛 Skills for the chat</label>
    <div class="rowbtns" style="align-items:center"><button class="ghost" id="s_skNew" type="button">＋ New skill</button>
      <button class="ghost" id="s_skImport" type="button" title="A SKILL.md file: a --- name / description --- block, then the instructions">⤒ Import a SKILL.md</button>
      <input type="file" id="s_skFile" accept=".md,.txt,text/markdown,text/plain" style="display:none"><span id="s_skStatus" class="hint" style="flex:1"></span></div>
    <div id="s_skList" style="max-height:220px;overflow:auto;margin:4px 0"></div>
    <p class="hint help" style="margin-top:4px">With <b>🎛</b> on in the prompt docker the chat's LLM can work the app for you (write the prompt, pick a style or a
      Basic Settings value, press Generate, add or render a StoryBoard scene, show a docker) and it can follow these skills - instructions
      for a kind of job, loaded when your ask fits a skill's description. A skill is words only: it never runs anything itself. Yours are
      kept in my-skills beside the app; one with a built-in's name is used instead of it.</p>`;
  function status(t, ok) { const s = $("s_skStatus"); if (s) { s.textContent = t; s.style.color = ok == null ? "" : ok ? "#7c7" : "#e66"; } }
  async function fill() {
    const box = $("s_skList"); if (!box) return;
    try {
      const L = (await api("/api/skills")).skills || [];
      box.innerHTML = L.length ? L.map((s) => `<div class="skrow" data-sk="${esc(s.name)}" style="display:flex;gap:6px;align-items:flex-start;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)">
        <div style="flex:1"><b>${esc(s.name)}</b> <span class="hint">${s.source === "yours" ? (s.overrides ? "yours - used instead of the built-in one" : "yours") : "built in"}</span><div class="hint">${esc(s.description)}</div></div>
        <button class="ghost" data-skedit="${esc(s.name)}" type="button" title="${s.source === "yours" ? "Edit this skill" : "Make your own copy of this skill to change"}">✎</button>
        ${s.source === "yours" ? `<button class="ghost" data-skdel="${esc(s.name)}" type="button" title="Delete this skill">🗑</button>` : ""}</div>`).join("") : `<div class="hint">no skills yet</div>`;
      box.querySelectorAll("[data-skedit]").forEach((b) => { b.onclick = async () => { try { edit(await api("/api/skills/" + encodeURIComponent(b.dataset.skedit))); } catch (e) { status("✗ " + e.message, false); } }; });
      box.querySelectorAll("[data-skdel]").forEach((b) => { b.onclick = async () => {
        const ok = typeof root.appConfirm === "function" ? await root.appConfirm(`Delete the skill ${b.dataset.skdel}?`, "🗑 Delete the skill") : true;
        if (!ok) return;
        try { await api("/api/skills/" + encodeURIComponent(b.dataset.skdel), null, "DELETE"); status("✓ deleted", true); fill(); } catch (e) { status("✗ " + e.message, false); }
      }; });
    } catch (e) { box.textContent = "✗ " + e.message; }
  }
  /** the box: name, when it is used, the instructions */
  function edit(s) {
    let d = $("skillDlg");
    if (!d) {
      d = doc.createElement("dialog"); d.id = "skillDlg"; d.style.cssText = "width:min(760px,92vw)";
      d.innerHTML = `<h3 id="skTitle">🎛 Skill</h3>
        <label class="f">Name</label><input id="skName" spellcheck="false" placeholder="e.g. music-video">
        <label class="f">When it is used (the LLM reads this to pick it)</label><input id="skDesc" placeholder="e.g. making a music video from a song - segments, scenes, lip sync">
        <label class="f">Instructions</label><textarea id="skBody" rows="14" style="width:100%;font-family:var(--mono,monospace);font-size:12px" placeholder="Steps, rules and examples for this kind of job - the app's actions the LLM can use are listed in the guide"></textarea>
        <div id="skWhy" class="hint" style="min-height:1.2em"></div>
        <div class="brow" style="justify-content:flex-end;gap:8px"><button class="ghost" id="skCancel" type="button">Cancel</button><button class="go" id="skSave" type="button" style="width:auto;margin-top:0;padding:6px 22px">💾 Save</button></div>`;
      doc.body.appendChild(d);
    }
    const mine = !s || s.source === "yours";
    $("skTitle").textContent = !s ? "🎛 New skill" : mine ? "🎛 Edit skill" : "🎛 Your own copy of a built-in skill";
    $("skName").value = s ? s.name : ""; $("skDesc").value = s ? s.description : ""; $("skBody").value = s ? s.body : ""; $("skWhy").textContent = "";
    $("skCancel").onclick = () => d.close();
    $("skSave").onclick = async () => {
      try { await api("/api/skills", { name: $("skName").value, description: $("skDesc").value, body: $("skBody").value, was: s && mine ? s.name : undefined }); d.close(); status("✓ saved", true); fill(); }
      catch (e) { $("skWhy").textContent = "✗ " + e.message; }
    };
    if (!d.open) d.showModal();
    $("skName").focus();
  }
  function wire() {
    const host = $("s_skills"); if (!host || host.dataset.wired) return; host.dataset.wired = "1";
    host.innerHTML = HTML;
    $("s_skNew").onclick = () => edit(null);
    $("s_skImport").onclick = () => $("s_skFile").click();
    $("s_skFile").onchange = async (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try { const t = await f.text(); const s = await api("/api/skills/import", { text: t, name: f.name.replace(/\.(md|txt)$/i, "").replace(/^SKILL$/i, "") }); status("✓ imported " + s.name, true); fill(); }
      catch (x) { status("✗ " + x.message, false); }
    };
    const os = $("openSettings"); if (os) os.addEventListener("click", () => setTimeout(fill, 60));
    fill();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  root.H3SkillsSet = { fill, edit };
})(typeof window !== "undefined" ? window : globalThis);
