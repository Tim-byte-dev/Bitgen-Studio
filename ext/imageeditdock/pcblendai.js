/* bitGen Studio — 2.855.0 🟧 Blender skills in the image editor (Tim: "after that do the blender skills").
 * The 🟧 ▾ menu's ✨ Model with AI… and 🧰 Blender tools… (pcblendlayer.js menuItems ai) -> lib/blendSkills.js:
 *   ✨ say what to make (+ the skill: Auto = bitGen picks the sheet) -> ✍ Write the script (the LLM, with the skill sheets) ->
 *      the script SHOWN (editable; bitGen's check said under it) -> ▶ Run on a copy (the open scene, or an empty one; a
 *      failure goes back to the LLM - 3 tries) -> the preview, what was made, the QA warnings -> 🟧 Open as a Blender layer.
 *   🧰 a tool + its settings -> ▶ Run on a copy -> 🟧 Open the result (or the exported file's place).
 *   Blender older than 5.2 / not found -> the ⬇ Download / Cancel box (blender.org). */
(function (root) {
  "use strict";
  function install(E) {
    const { doc, win } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.dialog) return;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const api = async (u, body) => { const r = await win.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw Object.assign(new Error(j.error || "HTTP " + r.status), { need: j.need }); return j; };
    const scene = () => { const i = E.blendLayer && E.blendLayer.sceneInfo ? E.blendLayer.sceneInfo() : null; return i && i.source ? i.source : ""; };
    let info = null;
    async function load() { info = await api("/api/blendskills"); return info; }
    function needBox(n) {
      E.ui.dialog("🟧 Blender 5.2 or newer is needed", `<p>${esc(n.why)}.</p><p style="color:var(--pc-dim)">The Blender skills are written for Blender ${esc(n.min)} or newer. Install it from blender.org, then pick it in Settings ▸ Blender if bitGen does not find it.${n.found ? `<br>Found: ${esc(n.found)}` : ""}</p>`,
        () => { if (win.open) win.open(n.url, "_blank"); return true; }, { okLabel: "⬇ Download" });
    }
    async function ready() {
      try { await load(); } catch (e) { say("🟧 " + e.message); return false; }
      if (info.need) { needBox(info.need); return false; }
      return true;
    }
    const opener = (p) => `<button type="button" class="ghost" data-open="${esc(p)}">🟧 Open as a Blender layer</button>`;
    function wireOpen(d) { d.querySelectorAll("[data-open]").forEach((b) => { b.onclick = () => { const c = d.querySelector(".cn"); if (c) c.click(); if (E.blendLayer) E.blendLayer.openFile(b.dataset.open); }; }); }
    function resultHtml(r) {
      if (!r.ok) return `<p>✗ ${esc(r.error || "it did not work")}</p>` + (r.tries || []).map((t, i) => `<details><summary>Try ${i + 1}: ${esc(String(t.error || "ok").split("\n").pop())}</summary><pre class="bsk-pre">${esc(t.script)}</pre></details>`).join("");
      const qa = r.qa && (r.qa.errors || r.qa.warnings) ? [...(r.qa.errors || []).map((x) => "✗ " + x), ...(r.qa.warnings || []).map((x) => "⚠ " + x)] : [];
      const objs = (r.objects || []).filter((o) => o.type === "MESH");
      return `<p>✓ ${esc(r.name)}${r.tries && r.tries.length > 1 ? ` (the LLM fixed it - ${r.tries.length} tries)` : ""}</p>`
        + (r.preview ? `<img class="bsk-prev" src="/api/blendskills/preview?f=${encodeURIComponent(r.preview)}&v=${Date.now()}" alt="">` : "")
        + (objs.length ? `<div class="bsk-dim">${objs.slice(0, 12).map((o) => esc(o.name) + (o.tris != null ? ` (${o.tris} tris)` : "")).join(", ")}</div>` : "")
        + (qa.length ? `<div class="bsk-dim">QA: ${qa.slice(0, 8).map(esc).join("<br>")}</div>` : (r.qa && r.qa.pass ? '<div class="bsk-dim">QA: ✓ passed</div>' : ""))
        + `<div class="kxrow" style="margin-top:6px">${opener(r.path)}</div>`;
    }
    /* ---- ✨ Model with AI */
    async function model(ask0) {
      if (!(await ready())) return;
      const sc = scene();
      E.ui.dialog("✨ Model with AI", `<div class="bsk-dim">The LLM writes a Blender script with the Blender skills; you see it before it runs. It runs on a copy of ${sc ? esc(sc.split(/[\\/]/).pop()) : "an empty scene"} - the result is a new scene.</div>
        <textarea id="bskAsk" rows="3" placeholder="e.g. a ceramic coffee mug with a handle, glossy blue glaze" style="width:100%">${esc(ask0 || "")}</textarea>
        <div class="kxrow"><span>Skill</span><select id="bskSkill" style="flex:1"><option value="">Auto - bitGen picks the skill</option>${info.skills.filter((s) => s.name !== "blender-core").map((s) => `<option value="${esc(s.name)}" title="${esc(s.description)}">${esc(s.name.replace(/^blender-/, ""))}</option>`).join("")}</select><button type="button" class="ghost" id="bskWrite">✍ Write the script</button></div>
        <textarea id="bskCode" rows="14" spellcheck="false" placeholder="the script comes here - read it, change it if you like, then ▶ Run on a copy" style="width:100%;font-family:monospace;font-size:11px"></textarea>
        <div id="bskWhy" class="bsk-dim"></div><div id="bskOut"></div>`, () => false, { okLabel: "▶ Run on a copy", wide: true, init: (d) => {
          d.classList.add("bskDlg");
          const v = (id) => d.querySelector("#" + id), ok = d.querySelector(".ok");
          d.querySelectorAll("textarea, input").forEach((t) => t.addEventListener("keydown", (e) => e.stopPropagation()));
          v("bskWrite").onclick = async () => {
            const ask = v("bskAsk").value.trim(); if (!ask) { v("bskWhy").textContent = "say what to make first"; return; }
            v("bskWrite").disabled = true; v("bskWhy").textContent = "✍ the LLM is writing the script…";
            try { const p = await api("/api/blendskills/plan", { ask, skill: v("bskSkill").value || undefined }); v("bskCode").value = p.script; d.dataset.skill = p.skill;
              v("bskWhy").textContent = `Skill: ${p.skill}` + (p.problems.length ? ` · ✗ bitGen will refuse it: ${p.problems.join(", ")} (▶ Run asks the LLM to fix it)` : " · ✓ checked - only Blender's own modules, no files, no network"); }
            catch (e) { v("bskWhy").textContent = "✗ " + e.message; }
            v("bskWrite").disabled = false;
          };
          ok.onclick = async (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            const script = v("bskCode").value; if (!script.trim()) { v("bskWhy").textContent = "✍ Write the script first"; return; }
            ok.disabled = true; v("bskOut").innerHTML = "<p>▶ Blender is building it on a copy…</p>";
            try { const r = await api("/api/blendskills/model", { ask: v("bskAsk").value.trim(), script, skill: d.dataset.skill || v("bskSkill").value || undefined, blend: scene() || undefined });
              if (r.script) v("bskCode").value = r.script; v("bskOut").innerHTML = resultHtml(r); wireOpen(d);
              say(r.ok ? `✨ Blender made ${r.name}` : "✨ " + r.error);
              if (r.ok && root.H3TestEvent) { try { root.H3TestEvent("blend_ai_model", r.name); } catch (e) { /* the 🧪 list */ } } }
            catch (e) { if (e.need) needBox(e.need); v("bskOut").innerHTML = `<p>✗ ${esc(e.message)}</p>`; }
            ok.disabled = false;
          };
        } });
    }
    /* ---- 🧰 the tools */
    function fieldHtml(f) {
      const id = "bskF_" + f.k.replace(/\W/g, "_");
      if (f.kind === "bool") return `<label class="kxrow"><input type="checkbox" id="${id}"${f.def ? " checked" : ""}> ${esc(f.label)}</label>`;
      if (f.kind === "pick") return `<div class="kxrow"><span>${esc(f.label)}</span><select id="${id}">${f.options.map((o) => `<option${String(o) === String(f.def) ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
      return `<div class="kxrow"><span>${esc(f.label)}</span><input id="${id}" value="${esc(f.def)}" style="flex:1"></div>`;
    }
    async function tools(id0) {
      if (!(await ready())) return;
      const sc = scene(); if (!sc) return say("🧰 open a Blender scene first (🟧 ▾ Open)");
      E.ui.dialog("🧰 Blender tools", `<div class="bsk-dim">On a copy of ${esc(sc.split(/[\\/]/).pop())} - the result is a new scene (an export goes into the project's blender/export folder).</div>
        <div class="kxrow"><span>Tool</span><select id="bskTool" style="flex:1">${info.tools.map((t) => `<option value="${esc(t.id)}"${t.id === id0 ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</select></div>
        <div id="bskTip" class="bsk-dim"></div><div id="bskFields"></div><div id="bskOut"></div>`, () => false, { okLabel: "▶ Run on a copy", init: (d) => {
          d.classList.add("bskDlg");
          const v = (id) => d.querySelector("#" + id), ok = d.querySelector(".ok"), T = () => info.tools.find((t) => t.id === v("bskTool").value);
          const paint = () => { const t = T(); v("bskTip").textContent = t.tip + " (" + t.skill + ")"; v("bskFields").innerHTML = t.fields.map(fieldHtml).join(""); v("bskFields").querySelectorAll("input").forEach((i) => i.addEventListener("keydown", (e) => e.stopPropagation())); };
          v("bskTool").onchange = paint; paint();
          ok.onclick = async (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            const t = T(), args = {};
            for (const f of t.fields) { const el = v("bskF_" + f.k.replace(/\W/g, "_")); args[f.k] = f.kind === "bool" ? el.checked : el.value; }
            ok.disabled = true; v("bskOut").innerHTML = `<p>▶ ${esc(t.label)} - Blender is working on a copy…</p>`;
            try { const r = await api("/api/blendskills/tool", { tool: t.id, blend: scene(), args });
              v("bskOut").innerHTML = r.ok ? `<p>✓ ${esc(t.label)} done${r.exported ? ` - ${esc(r.exported)}` : ""}</p><pre class="bsk-pre">${esc(JSON.stringify(r.result, null, 1).slice(0, 1500))}</pre>${r.path ? `<div class="kxrow">${opener(r.path)}</div>` : ""}` : `<p>✗ ${esc(r.error)}</p>`;
              wireOpen(d); say(r.ok ? `🧰 ${t.label} done` : "🧰 " + r.error); }
            catch (e) { if (e.need) needBox(e.need); v("bskOut").innerHTML = `<p>✗ ${esc(e.message)}</p>`; }
            ok.disabled = false;
          };
        } });
    }
    const css = doc.createElement("style");
    css.textContent = ".kxdlg.bskDlg{width:720px;max-width:96vw}.bskDlg .bsk-dim{color:var(--pc-dim);font-size:11px;margin:4px 0}.bskDlg .bsk-pre{max-height:180px;overflow:auto;font-size:10px;background:rgba(0,0,0,.25);padding:4px;white-space:pre-wrap}"
      + ".bskDlg .bsk-prev{display:block;max-width:100%;border-radius:6px;margin:4px 0}.bskDlg textarea{box-sizing:border-box}";
    doc.head.appendChild(css);
    if (E.ui.addCmd) {
      E.ui.addCmd("file.blendai", "🟧 ✨ Model with AI…", "", () => model(), {}, ["File", "file.blendopen"]);
      E.ui.addCmd("file.blendtools", "🟧 🧰 Blender Tools…", "", () => tools(), {}, ["File", "file.blendai"]);
    }
    E.blendAi = { model, tools, load };
  }
  root.PCBlendAi = { install };
})(typeof window !== "undefined" ? window : globalThis);
