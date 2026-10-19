/* bitGen Studio — static/hwpanel.js (2.520.0): Settings -> Models -> 🖥 THIS COMPUTER & PACKAGE (window.H3HwPanel).
 * Tim (verbatim): "go with all 3 of your reccomendations" - (1) what this computer can use, in the app (not only in
 * setup), (2) one click from the package you have to a bigger one without running setup again.
 *   THE CARD     your graphics card, RAM and CPU (✎ Not right? - the same answers setup asks for, kept in
 *                custom.settings); the package installed
 *   PACKAGES     the four (lib/hwPlan.js), the one for this computer marked; what each lets you use (✓ ~ ✗, add later)
 *   ⬆ UPGRADE    to a bigger package: the steps it needs (ComfyUI + its node packs when there is none yet, the
 *                assistant / voices / speech) + its models (the Hugging Face token from Settings -> General for the
 *                gated ones) - in the background (/api/setup/upgrade), its log + progress here
 * Pure (Node: scripts/test-recs520.js): rowsHtml, canUpgrade.
 */
(function (root) {
  "use strict";
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var ORDER = ["editor", "light", "standard", "full"];
  /** may the user move from `have` to `to`? (only up; Editor is no upgrade) */
  function canUpgrade(have, to) { return ORDER.indexOf(to) > Math.max(0, ORDER.indexOf(have || "editor")); }
  function rowsHtml(rows) {
    var g = "";
    return (rows || []).map(function (r) {
      var head = r.group !== g ? '<div style="margin:6px 0 2px;color:var(--tiger);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em">' + esc(g = r.group) + "</div>" : "";
      var ic = r.state === "yes" ? "✓" : r.state === "no" ? "✗" : "~", col = r.state === "yes" ? "#7c7" : r.state === "no" ? "#e66" : "#e6a23c";
      return head + '<div class="hwrow" data-cap="' + esc(r.id) + '" style="display:grid;grid-template-columns:16px 1fr auto;gap:0 6px;font-size:.72rem;padding:2px 0;border-top:1px solid rgba(255,255,255,.04)">'
        + '<b style="color:' + col + '">' + ic + "</b><span>" + esc(r.label) + (r.why ? '<br><span class="hint">' + esc(r.why) + "</span>" : "") + "</span>"
        + '<span class="hint">' + (r.included ? (r.group.indexOf("Editing") === 0 ? "" : "in it") : r.later ? "add later" : "") + "</span></div>";
    }).join("");
  }
  var pure = { rowsHtml: rowsHtml, canUpgrade: canUpgrade };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var S = { pk: null, sel: null, timer: null };
  function $(id) { return document.getElementById(id); }
  function post(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function gb(n) { return n >= 1e9 ? (n / 1e9).toFixed(0) + " GB" : n ? Math.round(n / 1e6) + " MB" : "no models"; }
  function load() {
    return fetch("/api/setup/packages").then(function (r) { return r.json(); }).then(function (pk) {
      if (!pk || !Array.isArray(pk.packages) || !pk.packages.length) return;
      S.pk = pk; if (!S.sel) S.sel = pk.installed && ORDER.indexOf(pk.installed) >= ORDER.indexOf(pk.recommended) ? pk.installed : pk.recommended;
      paint(); if (pk.busy && pk.what === "upgrade") follow();
    }).catch(function () { /* offline */ });
  }
  function paint() {
    var h = $("hwPanel"), pk = S.pk; if (!h || !pk) return;
    var hw = pk.hardware || {}, inst = pk.installed || "", k = pk.packages.find(function (x) { return x.id === S.sel; }) || pk.packages[0];
    var lab = function (id) { return (pk.packages.find(function (x) { return x.id === id; }) || {}).label || id; };
    var gpuSel = (pk.answers && pk.answers.gpu) || "";
    h.innerHTML = '<label class="f">🖥 This computer &amp; package</label>'
      + '<div class="hint" style="margin:2px 0 6px">' + esc([hw.gpu, hw.ram, hw.cpu].filter(Boolean).join(" · ")) + (pk.manual ? " (as you told it)" : "")
      + ' · installed: <b>' + esc(inst ? lab(inst) : "not recorded (installed before 2.519)") + '</b> · for this computer: <b>' + esc(lab(pk.recommended)) + "</b>"
      + ' · <a href="#" id="hwEdit">✎ Not right?</a></div>'
      + '<div id="hwAsk" style="display:none;margin-bottom:6px" class="grid3"><select id="hwGpu" style="grid-column:1/3"></select><input type="number" id="hwVram" placeholder="VRAM GB (another card)" min="0" max="256">'
      + '<input type="number" id="hwRam" placeholder="RAM GB" min="1" max="4096"><input type="text" id="hwCpu" placeholder="CPU" spellcheck="false"><button type="button" class="ghost" id="hwSave">Save</button></div>'
      + '<div class="rowbtns" role="radiogroup" aria-label="Package" style="flex-wrap:wrap;gap:4px">' + pk.packages.map(function (x) {
        return '<label class="chk" style="margin:0 8px 0 0" title="' + esc(x.blurb) + '"><input type="radio" name="hwpkg" value="' + esc(x.id) + '"' + (x.id === S.sel ? " checked" : "") + "> " + esc(x.label)
          + (x.id === pk.recommended ? " ★" : "") + (x.id === inst ? " (installed)" : "") + ' <span class="hint">' + gb(x.bytes) + "</span></label>"; }).join("") + "</div>"
      + '<div class="hint" style="margin:4px 0">' + esc(k.blurb) + (k.fits ? "" : " - more than this computer runs well") + "</div>"
      + '<div id="hwRows" style="max-height:240px;overflow:auto;border:1px solid var(--line);border-radius:6px;padding:4px 8px">' + rowsHtml(k.rows) + "</div>"
      + '<div class="rowbtns" style="margin-top:6px;align-items:center"><button type="button" id="hwUp"' + (canUpgrade(inst, k.id) && !pk.busy ? "" : " disabled") + ">⬆ Upgrade to " + esc(k.label) + "</button>"
      + '<span class="hint" id="hwMsg" style="flex:1">' + (canUpgrade(inst, k.id) ? "installs what it adds - " + (pk.comfy ? "into your ComfyUI" : "ComfyUI first") + ", then " + gb(k.bytes) + " of models (gated ones need your Hugging Face token)" : "pick a bigger package to upgrade") + "</span></div>"
      + '<div id="hwLog" class="hint" style="display:none;font-family:var(--mono);font-size:.66rem;max-height:120px;overflow:auto;white-space:pre-wrap;border:1px solid var(--line);border-radius:6px;padding:4px;margin-top:4px"></div>';
    h.querySelectorAll('input[name="hwpkg"]').forEach(function (r) { r.onchange = function () { S.sel = r.value; paint(); }; });
    $("hwEdit").onclick = function (e) {
      e.preventDefault(); $("hwAsk").style.display = "";
      fetch("/api/setup/state").then(function () { /* warm */ });
      var list = (S.pk.gpu_list || []);
      $("hwGpu").innerHTML = '<option value="">' + esc(hw.gpu || "- the card setup found -") + "</option>" + list.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === gpuSel ? " selected" : "") + ">" + esc(g.name) + (g.vram_gb ? " - " + g.vram_gb + " GB" : "") + "</option>"; }).join("");
      $("hwRam").value = (pk.gpu && pk.gpu.ram_gb) || ""; $("hwCpu").value = (pk.gpu && pk.gpu.cpu && pk.gpu.cpu.model) || "";
    };
    $("hwSave").onclick = function () {
      var a = { gpu: $("hwGpu").value, vram_gb: +$("hwVram").value || 0, ram_gb: +$("hwRam").value || 0, cpu: $("hwCpu").value.trim() };
      post("/api/setup/answers", { hw: a }).then(function () { S.sel = null; load(); });
    };
    $("hwUp").onclick = upgrade;
    h.querySelectorAll("input,select").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
  }
  function upgrade() {
    var k = S.sel;
    var ok = typeof appConfirm === "function" ? appConfirm("Upgrade to " + k + "? It installs what the package adds and downloads its models in the background - it can take a long time.") : Promise.resolve(true);
    Promise.resolve(ok).then(function (y) {
      if (!y) return;
      post("/api/setup/upgrade", { package: k }).then(function (r) { if (r.error) { $("hwMsg").textContent = r.error; return; } follow(); });
    });
  }
  function follow() {
    clearTimeout(S.timer);
    fetch("/api/setup/state").then(function (r) { return r.json(); }).then(function (st) {
      var log = $("hwLog"); if (log) { log.style.display = ""; log.textContent = (st.log || []).slice(-30).map(function (l) { return l.line; }).join("\n"); log.scrollTop = log.scrollHeight; }
      var files = Object.values(st.files || {}), done = files.filter(function (f) { return f.state === "ok"; }).length;
      if ($("hwMsg")) $("hwMsg").textContent = st.busy ? "⬆ upgrading… " + (files.length ? done + " / " + files.length + " model files" : "") : st.result ? (st.result.ok ? "✓ upgraded" : "upgrade finished with problems - the log says what") : "";
      if (st.busy) S.timer = setTimeout(follow, 2000); else load();
    });
  }
  function start() {
    if (!$("hwPanel")) { setTimeout(start, 200); return; }
    var tb = document.querySelector('#settings .stabs [data-stab="models"]'); if (tb) tb.addEventListener("click", load);
  }
  root.H3HwPanel = Object.assign({ load: load, state: function () { return S; } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
