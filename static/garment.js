/* bitGen Studio — static/garment.js (2.932.0): 👗 THE GARMENT DESIGNER - sewing patterns to the mannequin's (or your) measurements.
 * The plan agreed with Tim at 2.929.0: "the garment designer - GarmentCode … garment types + sliders, the LLM from words, …
 * a to-scale pattern PDF" (the drape on the mannequins follows in 2.933.0).
 * Opened from the Character creator's sheet tab (👗 Garment… beside 🧍 Mannequin / ✨ Lifelike) and the image editor
 * (👗 on its icon bar, File ▸ 👗 Garment Designer…). window.H3Garment.open({sex}).
 *   - a kind of garment (bitGen's presets) or ✨ describe it in words (lib/garmentAi.js - the LLM, else bitGen reads them)
 *   - every GarmentCode setting that matters for that top / waistband / bottom, as sliders / ticks / lists (made from its
 *     design tree - static/garmentspec.js), the pattern made again a moment after a change (☑ Auto)
 *   - the body: the female / male display mannequin's measurements, or your own height / bust / waist / hips (cm)
 *   - 🧍 Drape on the mannequin (2.933.0): Blender's cloth sews it onto the A-pose display mannequin - fabric + colour,
 *     front / side / back views, -> References, 🧊 a 3D layer in the image editor, ⤓ OBJ; its quality said (lib/garmentDrape.js)
 *   - the pattern (SVG), its pieces and seams; ⤓ PDF at actual size (A4 / Letter / A3 pages to tape, A0 for a copy shop),
 *     with or without seam allowance; your garments, kept in the project (projects/<p>/garments/)
 * The server: routes/garment.js. Not installed -> the Download / Cancel box (H3NeedInstall "garment").
 */
(function () {
  "use strict";
  var SP = window.H3GarmentSpec;
  var S = { data: null, values: {}, name: "", cur: null, busy: false, again: false, timer: 0, open: {} };
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === "cls") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function api(u, body, method) {
    var o = body === undefined ? { method: method || "GET" } : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    return fetch(u, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }
  function test(k, v) { try { if (window.H3TestEvent) window.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  function say(t, bad) { var n = $("gmSay"); if (n) { n.textContent = t || ""; n.classList.toggle("bad", !!bad); } }
  function tree() { return S.data ? S.data.schema : {}; }
  function all() { return Object.assign(SP.valuesOf(tree()), S.values); }

  function css() {
    if ($("gmcss")) return;
    var s = el("style", { id: "gmcss" });
    s.textContent = "dialog.gmdlg{width:min(1180px,96vw);height:min(860px,92vh);padding:12px 14px;display:flex;flex-direction:column;gap:8px}"
      + "dialog.gmdlg:not([open]){display:none}"
      + ".gmdlg h2{margin:0;font-size:1rem}"
      + ".gmdlg .gmbody{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:12px}"
      + ".gmdlg .gmleft,.gmdlg .gmright{min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}"
      + ".gmdlg .gmkinds{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}"
      + ".gmdlg .gmkinds button{font-size:.74rem;padding:4px 2px;display:flex;flex-direction:column;align-items:center;gap:1px}"
      + ".gmdlg .gmkinds button b{font-size:1.15rem;font-weight:400}"
      + ".gmdlg .gmkinds button.on{outline:2px solid var(--tiger);outline-offset:-2px}"
      + ".gmdlg .gmwords{display:flex;gap:6px}.gmdlg .gmwords textarea{flex:1;min-height:46px;resize:vertical;font:inherit;font-size:.8rem}"
      + ".gmdlg #gmSay{font-size:.76rem;margin:0;min-height:1em;opacity:.9}.gmdlg #gmSay.bad{color:var(--bad,#e66)}"
      + ".gmdlg details{border:1px solid var(--line);border-radius:6px;padding:4px 8px}"
      + ".gmdlg summary{cursor:pointer;font-size:.82rem;font-weight:600;padding:2px 0}"
      + ".gmdlg .gmrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) 46px;align-items:center;gap:6px;font-size:.76rem;padding:2px 0}"
      + ".gmdlg .gmrow input[type=range]{width:100%}.gmdlg .gmrow select{width:100%;font-size:.76rem}"
      + ".gmdlg .gmrow output{text-align:right;font-variant-numeric:tabular-nums;opacity:.85}"
      + ".gmdlg .gmbodyrow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;font-size:.74rem;align-items:end}"
      + ".gmdlg .gmbodyrow label{display:flex;flex-direction:column;gap:2px}.gmdlg .gmbodyrow input,.gmdlg .gmbodyrow select{width:100%}"
      + ".gmdlg .gmbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.78rem}"
      + ".gmdlg .gmbar input[type=text]{flex:1;min-width:120px}.gmdlg .gmbar .go{width:auto;padding:6px 14px}.gmdlg .gmbar select{width:auto}"
      + ".gmdlg .gmprev{flex:1;min-height:260px;border:1px solid var(--line);border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}"
      + ".gmdlg .gmprev img{max-width:100%;max-height:100%;object-fit:contain}.gmdlg .gmprev .gmempty{color:#666;font-size:.82rem;padding:20px;text-align:center}"
      + ".gmdlg #gmInfo{font-size:.76rem;opacity:.9;margin:0}"
      + ".gmdlg .gmlist{display:flex;flex-direction:column;gap:3px;max-height:150px;overflow:auto}"
      + ".gmdlg .gmitem{display:flex;gap:6px;align-items:center;font-size:.76rem;border:1px solid var(--line);border-radius:5px;padding:3px 6px;cursor:pointer}"
      + ".gmdlg .gmitem.on{border-color:var(--tiger)}.gmdlg .gmitem span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".gmdlg .gmnote{font-size:.72rem;opacity:.75;margin:0}"
      + ".gmdlg .gmdrape{display:flex;flex-direction:column;gap:6px}.gmdlg .gmviews{display:flex;gap:6px}"
      + ".gmdlg .gmviews img{flex:1;min-width:0;max-height:240px;object-fit:contain;background:#111;border-radius:5px;cursor:zoom-in}"
      + ".gmdlg #gmDrapeNote{font-size:.76rem}.gmdlg #gmDrapeNote.bad{color:var(--bad,#e66)}.gmdlg input[type=color]{width:36px;height:26px;padding:0}";
    document.head.appendChild(s);
  }

  function dialog() {
    if ($("gmDlg")) return $("gmDlg");
    css();
    var d = el("dialog", { id: "gmDlg", cls: "gmdlg", "aria-label": "Garment designer" });
    d.innerHTML = '<h2>👗 Garment designer</h2>'
      + '<div class="gmbody"><div class="gmleft">'
      + '<div class="gmkinds" id="gmKinds"></div>'
      + '<div class="gmwords"><textarea id="gmWords" placeholder="Or describe it: a knee-length dress with short sleeves and a V-neck…"></textarea>'
      + '<button type="button" class="ghost" id="gmDescribe" title="✨ The LLM picks the settings from your words (without an LLM, bitGen reads them itself)">✨ Design it</button></div>'
      + '<p id="gmSay"></p><div id="gmGroups"></div>'
      + '<div class="gmbar"><button type="button" class="ghost" id="gmReset" title="Every setting back to GarmentCode\'s default">↺ Reset settings</button>'
      + '<label title="Make the pattern again a moment after each change"><input type="checkbox" id="gmAuto" checked> Auto</label></div>'
      + '</div><div class="gmright">'
      + '<div class="gmbodyrow"><label>Body<select id="gmSex"><option value="female">Female mannequin</option><option value="male">Male mannequin</option></select></label>'
      + '<label>Height cm<input type="number" id="gmHeight" min="120" max="220" step="0.5"></label>'
      + '<label>Bust / chest<input type="number" id="gmBust" min="60" max="160" step="0.5"></label>'
      + '<label>Waist<input type="number" id="gmWaist" min="45" max="160" step="0.5"></label>'
      + '<label>Hips<input type="number" id="gmHips" min="60" max="170" step="0.5"></label></div>'
      + '<p class="gmnote" id="gmBodyNote"></p>'
      + '<div class="gmbar"><input type="text" id="gmName" maxlength="60" placeholder="Name - e.g. Summer dress">'
      + '<button type="button" class="go" id="gmMake">▶ Make pattern</button></div>'
      + '<div class="gmprev" id="gmPrev"><div class="gmempty">Pick a kind of garment, or describe it, then ▶ Make pattern.</div></div>'
      + '<p id="gmInfo"></p>'
      + '<div class="gmbar"><span>⤓ PDF at actual size:</span><select id="gmPaper"></select>'
      + '<label title="Added round every piece - the cutting line; the stitching line is dashed. 0 = none">Seam allowance <input type="number" id="gmSa" min="0" max="5" step="0.5" value="1.5" style="width:58px"> cm</label>'
      + '<button type="button" class="ghost" id="gmPdf" disabled>⤓ PDF</button></div>'
      + '<p class="gmnote">Print at 100 % ("actual size") and check the 10 cm square on page 1. Make a test garment first - the fit depends on your fabric.</p>'
      + '<div class="gmbar"><button type="button" class="ghost" id="gmDrape" disabled title="Sew the pieces and drape them on the display mannequin with Blender\'s cloth simulation, then render it from the front, side and back">🧍 Drape on the mannequin</button>'
      + '<select id="gmFabric" aria-label="Fabric"><option value="cotton">Cotton</option><option value="jersey">Jersey (stretchy)</option><option value="silk">Silk (light)</option><option value="denim">Denim (stiff)</option></select>'
      + '<input type="color" id="gmColor" value="#8c1f29" aria-label="Fabric colour" title="Fabric colour"><span id="gmDrapeNote"></span></div>'
      + '<div class="gmdrape" id="gmDrapeBox" hidden><div class="gmviews" id="gmViews"></div>'
      + '<div class="gmbar"><button type="button" class="ghost" id="gmToRefs" title="Put the three views in the References docker (for Dress it, Edit, a video)">→ References</button>'
      + '<button type="button" class="ghost" id="gmTo3d" title="Open the dressed mannequin as a 🧊 3D layer in the image editor (Blender)">🧊 3D layer in the image editor</button>'
      + '<a class="ghost" id="gmObj" download href="#" title="The draped garment as an OBJ file (+ its .mtl)">⤓ OBJ</a></div></div>'
      + '<div class="gmbar"><b>Your garments</b></div><div class="gmlist" id="gmList"></div>'
      + '<p class="gmnote">Patterns by GarmentCode (MIT - Korosteleva et al., ETH Zurich). Settings ▸ Add-ons ▸ Garment designer.</p>'
      + '</div></div>';
    document.body.appendChild(d);
    $("gmDescribe").addEventListener("click", describe);
    $("gmWords").addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); describe(); } });
    $("gmReset").addEventListener("click", function () { S.values = {}; paintKinds(); paintGroups(); changed(); });
    $("gmMake").addEventListener("click", function () { make(true); });
    $("gmPdf").addEventListener("click", pdf);
    $("gmDrape").addEventListener("click", drape);
    $("gmToRefs").addEventListener("click", toRefs);
    $("gmTo3d").addEventListener("click", to3d);
    $("gmSex").addEventListener("change", function () { bodyFromMannequin(); changed(); });
    ["gmHeight", "gmBust", "gmWaist", "gmHips"].forEach(function (id) { $(id).addEventListener("change", changed); });
    $("gmGroups").addEventListener("toggle", function (e) { var t = e.target; if (t && t.dataset && t.dataset.group) S.open[t.dataset.group] = t.open; }, true);
    return d;
  }

  function paintKinds() {
    var box = $("gmKinds"); if (!box || !S.data) return;
    box.textContent = "";
    S.data.presets.forEach(function (p) {
      var b = el("button", { type: "button", cls: "ghost", "data-gmpreset": p.id, title: p.label });
      b.appendChild(el("b", null, p.icon)); b.appendChild(document.createTextNode(p.label));
      var set = p.set || {}, v = all();
      if (Object.keys(set).every(function (k) { return String(v[k]) === String(SP.value(SP.leafAt(tree(), k), set[k])); })
          && ["meta.upper", "meta.wb", "meta.bottom"].every(function (k) { return (k in set) || !v[k]; })) b.classList.add("on");
      b.addEventListener("click", function () {
        S.values = SP.preset(S.data.presets, p.id);
        if (!$("gmName").value.trim() || $("gmName").dataset.auto === "1") { $("gmName").value = p.label; $("gmName").dataset.auto = "1"; }
        say(p.icon + " " + p.label + " - change it below, or describe it");
        paintKinds(); paintGroups(); changed(); test("gm_preset", p.id);
      });
      box.appendChild(b);
    });
  }

  function control(f, v) {
    var row = el("div", { cls: "gmrow", "data-gmpath": f.path });
    row.appendChild(el("span", { title: f.path }, SP.label(f.path)));
    var input, out = el("output");
    if (f.type === "bool") {
      input = el("input", { type: "checkbox" }); input.checked = !!v;
      input.addEventListener("change", function () { set(f.path, input.checked); });
    } else if (f.type === "select" || f.type === "select_null") {
      input = el("select");
      f.range.forEach(function (x, i) {
        if (SP.hidden(x) && x !== v) return;
        var o = el("option", { value: String(i) }, SP.optionLabel(x)); if (x === v) o.selected = true; input.appendChild(o);
      });
      if (f.type === "select_null" && f.range.indexOf(null) < 0) { var o0 = el("option", { value: "-1" }, "None"); if (v === null) o0.selected = true; input.insertBefore(o0, input.firstChild); }
      input.addEventListener("change", function () { var i = +input.value; set(f.path, i < 0 ? null : f.range[i]); });
    } else {
      var lo = Math.min(f.range[0], f.range[1]), hi = Math.max(f.range[0], f.range[1]);
      input = el("input", { type: "range", min: String(lo), max: String(hi), step: f.type === "int" ? "1" : String(Math.max(0.01, (hi - lo) / 100)) });
      input.value = String(v); out.textContent = String(v);
      input.addEventListener("input", function () { out.textContent = input.value; });
      input.addEventListener("change", function () { set(f.path, f.type === "int" ? parseInt(input.value, 10) : parseFloat(input.value)); });
    }
    input.setAttribute("aria-label", SP.label(f.path));
    row.appendChild(input); row.appendChild(out);
    return row;
  }
  function paintGroups() {
    var box = $("gmGroups"); if (!box || !S.data) return;
    var v = all(), gs = SP.groups(v), fl = SP.flat(tree());
    box.textContent = "";
    gs.forEach(function (g) {
      var d = el("details", { "data-group": g });
      d.open = g in S.open ? S.open[g] : (g === "meta" || g === "shirt" || g === "sleeve" || /skirt|pants/.test(g));
      d.appendChild(el("summary", null, SP.GROUPS[g] || g));
      fl.filter(function (f) { return f.group === g && !(g === "left" && f.key !== "enable_asym" && !v["left.enable_asym"]); })
        .forEach(function (f) { d.appendChild(control(f, v[f.path])); });
      box.appendChild(d);
    });
  }
  var REGROUP = /^(meta\.|godet-skirt\.base|levels-skirt\.(base|level)$|left\.enable_asym)/;
  function set(path, v) {
    S.values[path] = v;
    S.values = SP.changed(tree(), S.values);
    if (REGROUP.test(path)) { paintKinds(); paintGroups(); } else paintKinds();
    changed();
  }

  function bodyFromMannequin() {
    var m = (S.data && S.data.mannequins[$("gmSex").value]) || {};
    $("gmHeight").value = m.height != null ? (+m.height).toFixed(1) : "";
    $("gmBust").value = m.bust != null ? (+m.bust).toFixed(1) : "";
    $("gmWaist").value = m.waist != null ? (+m.waist).toFixed(1) : "";
    $("gmHips").value = m.hips != null ? (+m.hips).toFixed(1) : "";
    $("gmBodyNote").textContent = "The " + $("gmSex").value + " display mannequin's measurements - type your own to make it to measure (the other measurements follow).";
  }
  function body() { return { sex: $("gmSex").value, height: +$("gmHeight").value, bust: +$("gmBust").value, waist: +$("gmWaist").value, hips: +$("gmHips").value }; }

  function changed() {
    if (!$("gmAuto").checked || !(S.data && S.data.installed) || !S.cur && !S.values["meta.upper"] && !S.values["meta.bottom"] && !S.values["meta.wb"]) return;
    clearTimeout(S.timer); S.timer = setTimeout(function () { make(false); }, 700);
  }
  function make(byHand) {
    var v = all();
    if (!v["meta.upper"] && !v["meta.bottom"] && !v["meta.wb"]) { say("pick a kind of garment first (or describe it)", true); return Promise.resolve(null); }
    if (!(S.data && S.data.installed)) return ensure().then(function (ok) { return ok ? make(byHand) : null; });
    if (S.busy) { S.again = true; return Promise.resolve(null); }
    S.busy = true; $("gmMake").disabled = true; $("gmMake").textContent = "⏳ Making…";
    var name = $("gmName").value.trim() || "Garment";
    return api("/api/garment/make", { name: name, values: S.values, body: body() }).then(function (g) {
      S.cur = g; show(g); list(); test("gm_made", g.slug);
      say("✓ " + g.name + ": " + g.panels + " pieces, " + g.stitches + " seams");
      return g;
    }).catch(function (e) { say("✗ " + e.message, true); return null; }).then(function (g) {
      S.busy = false; $("gmMake").disabled = false; $("gmMake").textContent = "▶ Make pattern";
      if (S.again) { S.again = false; changed(); }
      return g;
    });
  }
  function show(g) {
    var box = $("gmPrev"); box.textContent = "";
    if (g && g.urls && g.urls.svg) { var im = el("img", { alt: "the sewing pattern of " + g.name, id: "gmImg" }); im.src = g.urls.svg + "?t=" + Date.now(); box.appendChild(im); }
    $("gmInfo").textContent = g ? (g.name + " - " + g.panels + " pieces, " + g.stitches + " seams, the pieces as they sit round the body " + g.size_cm.join(" x ") + " cm"
      + (g.self_intersecting ? ". ⚠ A piece crosses itself - change the settings a little." : "")) : "";
    $("gmPdf").disabled = !g;
    $("gmDrape").disabled = !g || S.draping;
    showDrape(g && g.drape, g);
    Array.prototype.forEach.call(document.querySelectorAll("#gmList .gmitem"), function (it) { it.classList.toggle("on", !!g && it.dataset.slug === g.slug); });
  }
  /* ---- 2.933.0: 🧍 the drape (lib/garmentDrape.js - Blender's cloth simulation on the A-pose display mannequin) */
  function dnote(t, bad) { var n = $("gmDrapeNote"); if (n) { n.textContent = t || ""; n.classList.toggle("bad", !!bad); } }
  function showDrape(d, g) {
    var box = $("gmDrapeBox"); if (!box) return;
    box.hidden = !(d && d.urls);
    if (!d || !d.urls) { if (!S.draping) dnote(""); return; }
    var v = $("gmViews"); v.textContent = "";
    ["front", "side", "back"].forEach(function (k) {
      if (!d.urls[k]) return;
      var im = el("img", { alt: "the " + k + " of the draped garment", "data-view": k }); im.src = d.urls[k] + "?t=" + encodeURIComponent(d.at || "");
      im.addEventListener("click", function () { window.open(im.src, "_blank"); });
      v.appendChild(im);
    });
    $("gmObj").href = d.urls.obj || "#"; $("gmObj").hidden = !d.urls.obj;
    $("gmTo3d").disabled = !d.model;
    var b = (g && g.body) || {};
    if (!S.draping) dnote((d.good ? "✓ " : "⚠ ") + (d.quality || "") + " - on the " + (d.sex || b.sex || "") + " display mannequin" + (b.height ? " (not your own measurements)" : ""), !d.good);
  }
  function drape() {
    if (!S.cur || S.draping) return Promise.resolve(null);
    S.draping = true; $("gmDrape").disabled = true; dnote("⏳ starting Blender…");
    var slug = S.cur.slug;
    return api("/api/garment/" + encodeURIComponent(slug) + "/drape", { fabric: $("gmFabric").value, color: $("gmColor").value }).then(function (r) {
      test("gm_drape", slug);
      return new Promise(function (ok) {
        var t = setInterval(function () {
          api("/api/garment/drape/" + encodeURIComponent(r.id)).then(function (j) {
            if (j.state !== "done" && j.state !== "error") { dnote("⏳ " + (j.note || j.state) + " " + (j.pct || 0) + " %"); return; }
            clearInterval(t); S.draping = false;
            if (j.state === "error") { dnote(j.note, true); $("gmDrape").disabled = false; ok(null); return; }
            if (S.cur && S.cur.slug === slug) S.cur.drape = j.result;
            $("gmDrape").disabled = false; showDrape(j.result, S.cur); dnote(j.note, !(j.result && j.result.good));
            test("gm_draped", slug); ok(j.result);
          }).catch(function () { /* next poll */ });
        }, 1500);
      });
    }).catch(function (e) { S.draping = false; $("gmDrape").disabled = !S.cur; dnote("✗ " + e.message, true); return null; });
  }
  function toRefs() {
    var d = S.cur && S.cur.drape; if (!d || !d.images) return;
    var n = 0;
    ["front", "side", "back"].forEach(function (k) {
      var nm = d.images[k]; if (!nm) return;
      try { if (typeof window.addRefImageByUrl === "function") { window.addRefImageByUrl("/passets/images/" + encodeURIComponent(nm), nm); n++; } } catch (e) { /* the docker */ }
    });
    dnote(n ? "→ " + n + " views in the References docker" : "the References docker is not here - the views are in Assets ▸ Images", !n);
    test("gm_refs", n);
  }
  function to3d() {
    var d = S.cur && S.cur.drape; if (!d || !d.model) return;
    if (!window.H3To3D || !window.H3To3D.deliver) { dnote("🧊 " + d.model + " is in models3d/ - the image editor's 3D layers can open it", true); return; }
    try { $("gmDlg").close(); } catch (e) { /* closed */ }
    Promise.resolve(window.H3To3D.deliver(d.model, "editor")).catch(function (e) { dnote("✗ " + e.message, true); });
    test("gm_3d", d.model);
  }
  function pdf() {
    if (!S.cur) return;
    var b = $("gmPdf"); b.disabled = true; b.textContent = "⏳ PDF…";
    api("/api/garment/" + encodeURIComponent(S.cur.slug) + "/pdf", { paper: $("gmPaper").value, sa: +$("gmSa").value || 0 }).then(function (r) {
      say("⤓ " + r.name + " - " + r.pages + " pages (" + r.sheets.join(" across x ") + " down + the cover)");
      var a = el("a", { href: r.url, download: S.cur.slug + "-" + r.name }); document.body.appendChild(a); a.click(); a.remove();
      test("gm_pdf", r.name);
    }).catch(function (e) { say("✗ " + e.message, true); }).then(function () { b.disabled = false; b.textContent = "⤓ PDF"; });
  }
  function describe() {
    var w = $("gmWords").value.trim();
    if (!w) { say("say what to make - e.g. a knee-length A-line skirt with a waistband", true); return Promise.resolve(null); }
    var b = $("gmDescribe"); b.disabled = true; b.textContent = "⏳ Designing…";
    return api("/api/garment/describe", { words: w, values: S.values }).then(function (r) {
      S.values = r.values || {};
      if (r.name) { $("gmName").value = r.name; $("gmName").dataset.auto = "1"; }
      say((r.by === "llm" ? "✨ " : "📖 ") + (r.say || "done") + (r.by === "words" ? " (read by bitGen" + (r.note ? " - " + r.note : "") + ")" : ""));
      paintKinds(); paintGroups(); test("gm_described", r.by);
      return S.data && S.data.installed ? make(false) : r;
    }).catch(function (e) { say("✗ " + e.message, true); }).then(function (x) { b.disabled = false; b.textContent = "✨ Design it"; return x; });
  }
  function list() {
    return api("/api/garment/list").then(function (items) {
      var box = $("gmList"); if (!box) return;
      box.textContent = "";
      if (!items.length) { box.appendChild(el("p", { cls: "gmnote" }, "none yet - your garments are kept in this project")); return; }
      items.forEach(function (g) {
        var it = el("div", { cls: "gmitem" + (S.cur && S.cur.slug === g.slug ? " on" : ""), "data-slug": g.slug, title: "Open " + g.name });
        it.appendChild(el("span", null, g.name + " · " + g.panels + " pieces"));
        var del = el("button", { type: "button", cls: "ghost", title: "Delete " + g.name, "aria-label": "Delete " + g.name }, "🗑");
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          api("/api/garment/" + encodeURIComponent(g.slug), undefined, "DELETE").then(function () { if (S.cur && S.cur.slug === g.slug) { S.cur = null; show(null); } list(); });
        });
        it.appendChild(del);
        it.addEventListener("click", function () { openGarment(g); });
        box.appendChild(it);
      });
    }).catch(function () { /* the list stays */ });
  }
  function openGarment(g) {
    S.values = Object.assign({}, g.values || {}); S.cur = g;
    $("gmName").value = g.name; $("gmName").dataset.auto = "0";
    var b = g.body || {};
    $("gmSex").value = b.sex === "male" ? "male" : "female"; bodyFromMannequin();
    if (b.height) $("gmHeight").value = b.height; if (b.bust) $("gmBust").value = b.bust; if (b.waist) $("gmWaist").value = b.waist; if (b.hips) $("gmHips").value = b.hips;
    paintKinds(); paintGroups(); show(g);
  }
  function ensure() {
    if (!window.H3NeedInstall) { say("Settings ▸ Add-ons ▸ Garment designer ▸ Install first", true); return Promise.resolve(false); }
    return window.H3NeedInstall.ensure("garment", "👗 The Garment designer makes sewing patterns with GarmentCode's pattern programs.").then(function (ok) {
      if (!ok) { say("not installed - ⬇ Install it to make patterns (Settings ▸ Add-ons ▸ Garment designer)", true); return false; }
      return load().then(function () { return true; });
    });
  }
  function load() {
    return api("/api/garment").then(function (j) {
      S.data = j;
      var p = $("gmPaper");
      if (p && !p.options.length) j.papers.forEach(function (x) { p.appendChild(el("option", { value: x.id }, x.label)); });
      $("gmMake").title = j.installed ? "Make the sewing pattern (GarmentCode)" : "Install the Garment designer first (Settings ▸ Add-ons)";
      return j;
    });
  }
  function open(o) {
    var opt = o || {};
    var d = dialog();
    if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
    return load().then(function (j) {
      if (opt.sex === "male" || opt.sex === "female") $("gmSex").value = opt.sex;
      if (!$("gmHeight").value || opt.sex) bodyFromMannequin();
      paintKinds(); paintGroups(); list();
      test("gm_open", opt.from || "");
      if (!j.installed) { say("👗 The Garment designer is not installed yet", true); ensure(); }
      return j;
    }).catch(function (e) { say("✗ " + e.message, true); });
  }
  // 👗 Garment… beside 🧍 Mannequin / ✨ Lifelike in the Character creator's sheet tab (ext/videodock - added from here)
  function boot() {
    var sel = $("h3sMannequin");
    if (!sel) { setTimeout(boot, 1500); return; }
    if ($("h3sGarment")) return;
    var b = el("button", { type: "button", cls: "ghost gbtn", id: "h3sGarment", title: "👗 Garment designer: sewing patterns made to this mannequin's measurements (GarmentCode)" }, "👗 Garment…");
    var after = $("h3sLife") || sel;
    after.parentNode.insertBefore(b, after.nextSibling);
    b.addEventListener("click", function () { open({ sex: sel.value === "male" ? "male" : sel.value === "female" ? "female" : "", from: "sheet" }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.H3Garment = { open: open, make: make, describe: describe, drape: drape, state: function () { return { values: S.values, cur: S.cur, installed: !!(S.data && S.data.installed) }; } };
})();
