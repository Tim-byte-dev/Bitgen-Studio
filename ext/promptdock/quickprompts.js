/* quickprompts.js — THE PROMPT DOCKER'S QUICK PROMPTS (2.451.0), window.H3Quick.
 *
 * Tim (verbatim): "add save button in prompt docker - save the prompt as the first line - add it to a dropdown for
 * quick prompts" - asked: the dropdown names each saved prompt by its FIRST LINE, the whole prompt is kept.
 *
 *   💾 Save   (in the prompt docker's menu bar, after 🧹 Clear) saves the prompt box's text (lib/quickPrompts.js -> <install>/quick_prompts.json, shared by every
 *             project); the same first line again = that one replaced
 *   ⚡ ▾      the saved prompts, newest first, by their first line - picking one puts it in the prompt box
 *   🗑        takes the one picked last off the list
 * Pure (Node: scripts/test-quickprompts.js): nameOf, optionsHtml.
 */
(function (root) {
  "use strict";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nameOf = (text) => (String(text == null ? "" : text).split(/\r?\n/).map((s) => s.trim()).find((s) => s.length) || "").replace(/\s+/g, " ").slice(0, 80);
  function optionsHtml(list, picked) {
    const l = Array.isArray(list) ? list : [];
    return `<option value="">⚡ Quick prompts${l.length ? " (" + l.length + ")" : " - none saved yet"}</option>`
      + l.map((p, i) => `<option value="${i}"${p.name === picked ? " selected" : ""} title="${esc(p.text.slice(0, 400))}">${esc(p.name)}</option>`).join("");
  }
  const H3Quick = { nameOf, optionsHtml, list: [] };
  if (typeof module !== "undefined" && module.exports) { module.exports = H3Quick; return; }
  root.H3Quick = H3Quick;

  const doc = root.document;
  function install() {
    const ta = doc.getElementById("prompt"); if (!ta || doc.getElementById("qpRow")) return;
    if (!doc.getElementById("qpCss")) {
      const st = doc.createElement("style"); st.id = "qpCss";
      st.textContent = ".qprow{display:inline-flex;gap:4px;align-items:center;min-width:0;max-width:100%;flex:0 1 auto}.qprow select{flex:1 1 auto;min-width:80px;max-width:220px}.qprow button{flex:0 0 auto}"
        + ".qprow button{padding:1px 6px}.qprow .qpmsg{flex:0 1 auto;font-size:11px;color:var(--dim,#999);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:35%}";
      doc.head.appendChild(st);
    }
    const row = doc.createElement("div"); row.className = "qprow"; row.id = "qpRow";
    row.innerHTML = `<button class="ghost gbtn" id="qpSave" type="button" title="Save this prompt as a quick prompt (its first line names it)">💾 Save</button>`
      + `<select id="qpSel" title="Quick prompts - your saved prompts by their first line; pick one to put it in the prompt box"></select>`
      + `<button class="ghost gbtn" id="qpDel" type="button" title="Delete the quick prompt picked last">🗑</button><span class="qpmsg" id="qpMsg"></span>`;
    // in the prompt docker's menu bar (after 🧹 Clear - it wraps); else above the prompt box
    const bar = doc.getElementById("pmBar"), clr = doc.getElementById("promptClear");
    if (bar && clr && clr.parentNode === bar) clr.after(row); else if (bar) bar.appendChild(row); else ta.parentNode.insertBefore(row, ta);
    const sel = row.querySelector("#qpSel"), msg = row.querySelector("#qpMsg");
    let picked = null, tm = 0;
    const say = (t) => { msg.textContent = t; clearTimeout(tm); tm = setTimeout(() => { msg.textContent = ""; }, 4000); };
    const paint = () => { sel.innerHTML = optionsHtml(H3Quick.list, null); sel.value = ""; };
    async function refresh() {
      try { const j = await (await fetch("/api/quickprompts")).json(); H3Quick.list = j.prompts || []; } catch { H3Quick.list = []; }
      paint();
    }
    sel.onchange = () => {
      const p = H3Quick.list[+sel.value]; if (sel.value === "" || !p) return;
      picked = p.name; ta.value = p.text; ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus();
      say("“" + p.name + "”"); paint();
    };
    row.querySelector("#qpSave").onclick = async () => {
      const text = ta.value.trim(); if (!text) return say("type a prompt first");
      try {
        const r = await fetch("/api/quickprompts/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }), j = await r.json();
        if (!r.ok) throw new Error(j.error || r.status);
        picked = j.name; await refresh(); say((j.replaced ? "updated " : "saved ") + "“" + j.name + "”");
      } catch (e) { say("not saved: " + e.message); }
    };
    row.querySelector("#qpDel").onclick = async () => {
      if (!picked) return say("pick a quick prompt first");
      if (root.confirm && !root.confirm(`Delete the quick prompt “${picked}”?`)) return;
      try { await fetch("/api/quickprompts/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: picked }) }); say("deleted “" + picked + "”"); picked = null; await refresh(); }
      catch (e) { say("not deleted: " + e.message); }
    };
    H3Quick.refresh = refresh; H3Quick.picked = () => picked;
    refresh();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", install); else install();
  root.addEventListener && root.addEventListener("h3:dock-ready", install);
})(typeof window !== "undefined" ? window : globalThis);
