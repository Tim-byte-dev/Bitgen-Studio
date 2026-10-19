/* pcprefs.js — THE IMAGE EDITOR'S SETTINGS DIALOG + ⚙ ON ITS MENU BAR (2.444.0), window.PCPrefs.
 *
 * Tim (verbatim): "add the settings button to the right of the image-editor menubar".
 *   ⚙ (the right end of the editor's menu bar) and Edit ▸ Preferences… (Ctrl+,) open the editor's Settings: a tab per
 *   part - each module adds its own with E.prefs.add({id, label, html(), bind(d), apply(d)}) (2.445.0: Grids & Guides).
 *   (2.445.0: modules installed before this one leave theirs in E.prefTabs - pcguides.js's Grids & Guides.)
 *   Built in: ✨ AI (results, context, feather, the most megapixels, what ✔ Apply does with the prompt docker's
 *   Generate) and Interface (the look, the panels).
 *   The tab last open is kept (store "prefs.tab").
 *
 * Pure (Node: scripts/test-prefs.js): order (tabs sorted by their `order`, then as added).
 */
(function (root) {
  "use strict";
  function order(tabs) { return tabs.map((t, i) => ({ t, i })).sort((a, b) => ((a.t.order == null ? 50 : a.t.order) - (b.t.order == null ? 50 : b.t.order)) || a.i - b.i).map((x) => x.t); }

  function install(E) {
    const { S, doc, say, store } = E;
    const kx = E.stage && E.stage.closest ? E.stage.closest(".kx") : doc.querySelector(".kx");
    if (!E.ui || !E.ui.addCmd || !E.ui.dialog || !kx) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const tabs = [];
    const add = (t) => { const i = tabs.findIndex((x) => x.id === t.id); if (i >= 0) tabs[i] = t; else tabs.push(t); return t; };

    /* ---- ✨ AI */
    add({ id: "ai", label: "✨ AI", order: 10,
      html: () => `<div class="kxrow"><span style="width:150px">Results to make</span><select id="prCount">${[1, 2, 3, 4].map((n) => `<option${n === S.count ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="kxrow"><span style="width:150px">Context around a selection (px)</span><input type="number" id="prContext" min="0" max="1024" value="${S.context}"></div>
        <div class="kxrow"><span style="width:150px">Feather (px)</span><input type="number" id="prFeather" min="0" max="256" value="${S.feather}"></div>
        <div class="kxrow"><span style="width:150px">Most megapixels</span><select id="prRes">${[0.5, 1, 1.5, 2, 3].map((n) => `<option value="${n}"${n === S.res ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="kxrow"><label><input type="checkbox" id="prBlend"${store.get("pl.blend", true) ? " checked" : ""}> The prompt docker's Generate: ✔ Apply blends into the selected layer (off = a new layer)</label></div>`,
      apply: (d) => {
        const v = (id) => d.querySelector("#" + id).value;
        S.count = Math.max(1, Math.min(4, +v("prCount") || 1)); store.set("count", S.count); if ($("kxCount")) $("kxCount").value = String(S.count);
        S.context = Math.max(0, Math.min(1024, +v("prContext") || 0)); store.set("context", S.context); if ($("ieContext")) $("ieContext").value = S.context;
        S.feather = Math.max(0, Math.min(256, +v("prFeather") || 0)); store.set("feather", S.feather); if ($("ieFeather")) $("ieFeather").value = S.feather;
        S.res = +v("prRes") || 1; store.set("res", S.res); if ($("kxRes")) $("kxRes").value = String(S.res);
        store.set("pl.blend", d.querySelector("#prBlend").checked);
      } });
    /* ---- Interface */
    add({ id: "ui", label: "Interface", order: 90,
      html: () => `<div class="kxrow"><span style="width:150px">Look</span><select id="prTheme"><option value="bitgen"${kx.dataset.theme === "bitgen" ? " selected" : ""}>bitGen (the app's theme)</option><option value="photocraft"${kx.dataset.theme !== "bitgen" ? " selected" : ""}>PhotoCraft (grey)</option></select></div>
        <div class="kxrow"><label><input type="checkbox" id="prRulers"${kx.classList.contains("rulers") ? " checked" : ""}> Rulers</label>
          <label><input type="checkbox" id="prPanels"${!kx.classList.contains("side-off") ? " checked" : ""}> Panels</label>
          <label><input type="checkbox" id="prOpts"${!kx.classList.contains("opts-off") ? " checked" : ""}> Options bar</label></div>`,
      apply: (d) => {
        const th = d.querySelector("#prTheme").value; if (th !== kx.dataset.theme) { kx.dataset.theme = th; store.set("theme", th); }
        const want = (cls, on, cmd) => { if (kx.classList.contains(cls) !== on) { if (E.ui.run && cmd) E.ui.run(cmd); else kx.classList.toggle(cls, on); } };
        want("rulers", d.querySelector("#prRulers").checked, "view.rulers");
        want("side-off", !d.querySelector("#prPanels").checked, null);
        want("opts-off", !d.querySelector("#prOpts").checked, null);
      } });

    (E.prefTabs || []).forEach(add);                     // 2.445.0: the tabs modules installed before this one left (pcguides: Grids & Guides)
    function open(tabId) {
      const list = order(tabs), cur = list.find((t) => t.id === (tabId || store.get("prefs.tab", "ai"))) || list[0];
      const html = `<div class="kxrow prtabs" style="gap:2px;flex-wrap:wrap;border-bottom:1px solid var(--pc-line);padding-bottom:4px;margin-bottom:6px">${list.map((t) => `<button class="ghost${t === cur ? " on" : ""}" data-prtab="${esc(t.id)}">${esc(t.label)}</button>`).join("")}</div>`
        + list.map((t) => `<div class="prtab" data-prbody="${esc(t.id)}" style="${t === cur ? "" : "display:none"}">${t.html()}</div>`).join("");
      const d = E.ui.dialog("⚙ Image editor settings", html, (dd) => {
        for (const t of list) { if (t.apply) { try { t.apply(dd); } catch (e) { say(t.label + ": " + e.message); } } }
        E.drawOverlay && E.drawOverlay(); E.refresh && E.refresh();
        say("settings kept");
      }, { wide: true, okLabel: "OK" });
      d.id = "pcPrefs";
      d.querySelectorAll("[data-prtab]").forEach((b) => {
        b.onclick = () => {
          d.querySelectorAll("[data-prtab]").forEach((x) => x.classList.toggle("on", x === b));
          d.querySelectorAll("[data-prbody]").forEach((x) => { x.style.display = x.dataset.prbody === b.dataset.prtab ? "" : "none"; });
          store.set("prefs.tab", b.dataset.prtab);
        };
      });
      for (const t of list) { if (t.bind) { try { t.bind(d); } catch (e) { /* a module's */ } } }
      return d;
    }
    E.ui.addCmd("edit.prefs", "Preferences…", "Ctrl+,", () => open(), {}, ["Edit", "edit.histsrc", true]);
    // ⚙ at the right end of the menu bar
    const mr = kx.querySelector(".pcmenu .mr");
    if (mr && !$("kxPrefs")) {
      const b = doc.createElement("button"); b.className = "ghost"; b.id = "kxPrefs"; b.type = "button"; b.textContent = "⚙";
      b.title = "Image editor settings (Ctrl+,): ✨ AI, grids & guides, the look"; b.setAttribute("aria-label", "Image editor settings");
      b.onclick = () => open();
      mr.appendChild(b);
    }
    E.prefs = { add, open, tabs: () => order(tabs) };
  }

  const PCPrefs = { order, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCPrefs;
  else root.PCPrefs = PCPrefs;
})(typeof window !== "undefined" ? window : globalThis);
