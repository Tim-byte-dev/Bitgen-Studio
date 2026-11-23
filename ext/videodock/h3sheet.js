/* bitGen Studio — ext/videodock/h3sheet.js (2.870.0): THE CHARACTER SHEET'S OPTIONS - the H3 Character Sheet Designer
 * (window.H3SheetDesign).
 *
 * Tim (verbatim): "https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer can we integrate this into bitgen, if we
 * can then remove our character designer and use this one"
 *
 * The Character creator's 🪪 Character sheet tab keeps its picture, its box (one subject), ▶ Generate sheet, the takes,
 * 🧵 Stitch and ✔ adopt (characters.js); its right-hand column is this panel (#chH3Opts):
 *   Views         a preset (Standard 5, Basic 4, Turnaround 3, Head 6, Clothing 2, Single, All 13) or your own ticks of
 *                 the 13 views (6 head, 3 full body, clothing front / back, hands, feet)
 *   Clothing / Hands / Feet / Style / Size   the designer's settings (No clothing = an animal or mascot's own body)
 *   Layout guide  the designer's guide picture rides along (off = its words place the views); Tiled decode = less VRAM
 *   Part pictures up to three, each with what it is for (face, head, clothing front / back, hands, footwear, more of
 *                 the same character)
 *   ✏ Part notes  words for one part (head and hair, face, upper clothing, back, lower body, hands, footwear, other)
 *   ✏ View instructions  a view's own instruction, edited (↺ Default puts the designer's back)
 *   The layout    drawn from the designer's own preview in ComfyUI (its panels, the canvas size in pixels / MP)
 * Not installed: the line says so and ⬇ Install… opens the Download / Cancel box (H3NeedInstall "h3sheet").
 * 2.871.0 (Tim: "can we add a generate button with a prompt input in the character style dropdown to show image styles, if
 * overide settings is checked then use the selected styles overide"): a row under 📂 Load picture - the words, an IMAGE
 * style (the prompt docker's list; the prompt docker's style first, the pick kept) and ✨ Generate -> /api/genimage; the
 * picture lands in the sheet's canvas (H3CharSheetPic.open) and in the character's 🎨 Create images strip. Basic Settings ▸
 * Override style ticked = THAT style's Basic Settings (the live ones when it is the prompt docker's style now, else the ones
 * it last had in misc/basic_settings.tmp - H3StyleBasic): size, steps, CFG, seed, checkpoint (+ LoRAs when live); unticked =
 * the style's own settings. The line under the row says which.
 *   fromSaved(vals, useModel) -> {body, words}   (pure: a style's saved Basic Settings as /api/genimage fields)
 * 2.934.0 (Tim: "in character sheet editor the mannequin sheet is the reference sheet of poses and camera angles and another
 * image must be loaded or generated to create the character sheet"): 🧍 Mannequin… no longer loads the mannequin as the start
 * picture. Its REFERENCE SHEET (static/mannequins/<sex>_sheet.png, or your own mannequin's picture) is what the new sheet
 * follows - its panels, poses and camera angles, sent as template "mannequin:<sex>" / "mannequin:own:<id>" and drawn in the
 * Layout box - while the character comes from the picture you 📂 load or ✨ generate. Dress it is gone with that.
 *   reference()      -> {id, name, url, w, h, mannequin} | null   what the sheet follows (a template or the mannequin's sheet)
 *   ready()          -> Promise<bool>   installed (asks once with the box when not)
 *   appendTo(fd)     the settings + part pictures onto the FormData of a take -> the settings (for ↻ Regenerate)
 *   body()           the settings as JSON (+ the part pictures sent before, by name)
 *   remember(refs)   the part pictures' names the server kept;  failed(d)  a take that did not start (needs -> the box)
 *   refresh()        the install line + the layout again;  state() / setState(o)  the choices (tests) */
(function () {
  "use strict";
  var KEY = "h3sheet.v1";
  var C = null;                         // the catalog from GET /api/charsheet/h3
  var S = { preset: "five", views: ["face_front", "face_left", "body_front", "body_left", "body_back"], clothing: "reference",
            hands: "reference", feet: "reference", style: "none", detail: "high", w: 3168, h: 1280, layout: false, tiled: false,
            roles: ["same_character", "face", "clothing"], parts: {}, viewPrompts: {}, picPrompt: "", picStyle: "",
            // 2.934.0: the 🧍 mannequin whose reference sheet the new sheet follows (male | female | own:<id>) - never the start picture
            mannequin: "",
            // 2.874.0: a character sheet TEMPLATE from your library (its id) - the new sheet follows its layout
            template: "" };
  var LIB = { mannequins: [], templates: [] };  // GET /api/charsheet/library - your own mannequins + sheet templates
  var MQ_NONE = { sex: "", ref: "", name: "", sheet: "", w: 0, h: 0, line: "" };
  var MANNEQUIN = Object.assign({}, MQ_NONE);  // 2.934.0: the picked mannequin's reference sheet (POST /api/charsheet/h3/mannequin)
  // the views bitGen's mannequin sheet shows (head front / three-quarter / back, full body front / side / back, hands, feet)
  var MQ_VIEWS = ["face_front", "face_3q_left", "face_back", "body_front", "body_left", "body_back", "hands", "feet"];
  var refs = [null, null, null];        // File objects
  var refNames = ["", "", ""];          // what the server kept (↻ Regenerate)
  var installed = null, previewT = 0, previewN = 0, defaults = {};
  function $(id) { return document.getElementById(id); }
  function test(k, v) { try { if (window.H3TestEvent) window.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
  function load() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o && typeof o === "object") Object.keys(S).forEach(function (k) { if (o[k] !== undefined) S[k] = o[k]; }); }
    catch (e) { /* first time */ }
  }
  function opt(sel, pairs, val) {
    sel.innerHTML = "";
    pairs.forEach(function (p) { var o = document.createElement("option"); o.value = p[0]; o.textContent = p[1]; sel.appendChild(o); });
    sel.value = val;
  }
  function presetOf(views) {
    var hit = (C ? C.presets : []).filter(function (p) {
      return p.views.length === views.length && p.views.every(function (v) { return views.indexOf(v) >= 0; });
    })[0];
    return hit ? hit.id : "custom";
  }

  function css() {
    if ($("h3scss")) return;
    var st = document.createElement("style"); st.id = "h3scss";
    st.textContent = "#chH3Opts{display:flex;flex-direction:column;gap:8px}"
      + "#chH3Opts .h3sLine{font-size:.74rem;display:flex;gap:6px;align-items:center;flex-wrap:wrap}"
      + "#chH3Opts .h3sLine.warn{color:#e9a23b}"
      + "#chH3Opts .h3sViews{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:.72rem}"
      + "#chH3Opts .h3sViews .grp{grid-column:1/-1;font-size:.64rem;color:var(--dim);margin-top:3px}"
      + "#chH3Opts .h3sViews label{display:flex;gap:5px;align-items:center;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
      + "#chH3Opts .h3sChk{display:flex;gap:6px;align-items:center;font-size:.74rem;cursor:pointer}"
      + "#chH3Opts .h3sRef{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:6px;align-items:center}"
      + "#chH3Opts .h3sRef button.pic{width:44px;height:44px;padding:0;border-radius:6px;background:#1a1612 center/cover no-repeat;font-size:1rem}"
      + "#chH3Opts details summary{font-size:.74rem;cursor:pointer}"
      + "#chH3Opts details textarea{margin-top:5px;font-size:.74rem}"
      + "#chH3Opts .h3sStage{position:relative;border:1px solid var(--line);border-radius:6px;background:#0c0a08;min-height:60px}"
      + "#chH3Opts #h3sCv{display:block;width:100%}"
      + "#chH3Opts .h3sStage .msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.72rem;color:var(--dim);text-align:center;padding:8px}"
      + "#chH3Opts .h3sSize{font-size:.7rem;color:var(--dim)}"
      + "#chH3Opts .h3sWH{display:flex;gap:6px;align-items:center;font-size:.72rem}#chH3Opts .h3sWH input{width:80px}";
    document.head.appendChild(st);
  }

  function build() {
    var box = $("chH3Opts");
    if (!box || box.dataset.built) return !!box;
    box.dataset.built = "1";
    css();
    box.innerHTML = ""
      + '<div class="chLbl">Character sheet</div>'
      + '<div class="h3sLine" id="h3sStatus" aria-live="polite"></div>'
      + '<div class="chForm"><label for="h3sPreset">Views</label><select id="h3sPreset" aria-label="Which views the sheet has"></select></div>'
      + '<div class="h3sViews" id="h3sViews" role="group" aria-label="The views on the sheet"></div>'
      + '<div class="chForm">'
      + '<label for="h3sCloth">Clothing</label><select id="h3sCloth" aria-label="Clothing shape" title="As in the picture keeps what the character wears; No clothing keeps an animal or mascot\'s own body (the clothing views are left out)"></select>'
      + '<label for="h3sHands">Hands</label><select id="h3sHands" aria-label="Hands"></select>'
      + '<label for="h3sFeet">Feet</label><select id="h3sFeet" aria-label="Feet"></select>'
      + '<label for="h3sStyle">Style</label><select id="h3sStyle" aria-label="Rendering style" title="As in the picture keeps the picture\'s own look"></select>'
      + '<label for="h3sDetail">Size</label><select id="h3sDetail" aria-label="Sheet size" title="Bigger sheets take more VRAM and time"></select>'
      + '</div>'
      + '<div class="h3sWH" id="h3sWH" style="display:none"><span>W</span><input id="h3sW" type="number" min="512" max="8192" step="32" aria-label="Sheet width in pixels"><span>H</span><input id="h3sH" type="number" min="512" max="8192" step="32" aria-label="Sheet height in pixels"><span>px</span></div>'
      + '<label class="h3sChk" title="The designer\'s layout picture rides along and places the views; off = its words place them"><input type="checkbox" id="h3sLayout"> Layout guide</label>'
      + '<div class="chForm"><label for="h3sTpl">Template</label><select id="h3sTpl" aria-label="A character sheet whose layout this sheet follows" title="Upload a finished character sheet and the new sheet follows its layout - its panels, views, poses and framing. Its people and clothes are only placeholders: the character comes from your picture"></select>'
      + '<button class="ghost gbtn" id="h3sTplDel" type="button" title="Delete this template from your library" aria-label="Delete the template" hidden>🗑</button></div>'
      + '<input type="file" id="h3sTplFile" accept="image/png,image/jpeg,image/webp,image/bmp" style="display:none" aria-label="Choose a character sheet to use as a template">'
      + '<label class="h3sChk" title="Decodes the sheet in tiles - try it when a big sheet stops at the decode"><input type="checkbox" id="h3sTiled"> Tiled decode (less VRAM)</label>'
      + '<div class="chLbl">Part pictures</div>'
      + '<div id="h3sRefs" style="display:flex;flex-direction:column;gap:5px"></div>'
      + '<input type="file" id="h3sRefFile" accept="image/png,image/jpeg,image/webp,image/bmp" style="display:none" aria-label="Choose a part picture">'
      + '<details id="h3sPartsBox"><summary id="h3sPartsSum">✏ Part notes</summary>'
      + '<div class="chForm" style="margin-top:5px"><label for="h3sPart">Part</label><select id="h3sPart" aria-label="Which part the note is for"></select></div>'
      + '<textarea id="h3sPartText" rows="3" maxlength="1000" spellcheck="true" placeholder="e.g. a scar over the left eye" aria-label="The note for this part"></textarea></details>'
      + '<details id="h3sVpBox"><summary id="h3sVpSum">✏ View instructions</summary>'
      + '<div class="chForm" style="margin-top:5px"><label for="h3sVp">View</label><select id="h3sVp" aria-label="Which view\'s instruction"></select></div>'
      + '<textarea id="h3sVpText" rows="4" maxlength="2000" spellcheck="true" aria-label="The view\'s instruction"></textarea>'
      + '<button class="ghost gbtn" id="h3sVpReset" type="button" title="Put the designer\'s own instruction back for this view">↺ Default</button></details>'
      + '<div class="chLbl">Layout</div>'
      + '<div class="h3sStage"><canvas id="h3sCv" width="356" height="120" aria-label="The sheet\'s layout"></canvas><div class="msg" id="h3sCvMsg"></div></div>'
      + '<div class="h3sSize" id="h3sSize"></div>';
    $("h3sPreset").addEventListener("change", function () {
      var p = (C.presets.filter(function (x) { return x.id === $("h3sPreset").value; })[0]);
      if (p) S.views = p.views.slice();
      S.preset = $("h3sPreset").value; paintViews(); changed();
    });
    [["h3sCloth", "clothing"], ["h3sHands", "hands"], ["h3sFeet", "feet"], ["h3sStyle", "style"], ["h3sDetail", "detail"]].forEach(function (pr) {
      $(pr[0]).addEventListener("change", function () { S[pr[1]] = $(pr[0]).value; if (pr[1] === "detail") $("h3sWH").style.display = S.detail === "manual" ? "flex" : "none"; if (pr[1] === "clothing") paintViews(); changed(); });
    });
    ["h3sW", "h3sH"].forEach(function (id) { $(id).addEventListener("change", function () { S.w = +$("h3sW").value || 3168; S.h = +$("h3sH").value || 1280; changed(); }); });
    $("h3sLayout").addEventListener("change", function () { S.layout = $("h3sLayout").checked; changed(); });
    $("h3sTiled").addEventListener("change", function () { S.tiled = $("h3sTiled").checked; save(); });
    $("h3sTpl").addEventListener("change", function () {
      var v = $("h3sTpl").value;
      if (v === "__add") { paintTemplate(); $("h3sTplFile").value = ""; $("h3sTplFile").click(); return; }
      if (v === "__mq") return;                              // the mannequin's sheet, already the reference
      // 2.934.0: a template (or None) takes the place of the mannequin's reference sheet
      if (MANNEQUIN.ref) { clearMannequin(); }
      S.template = v; paintTemplate(); changed(); picNote();
    });
    $("h3sTplFile").addEventListener("change", function () { var f = $("h3sTplFile").files[0]; if (f) addToLibrary("templates", f); });
    $("h3sTplDel").addEventListener("click", function () { if (S.template) delFromLibrary("templates", S.template); });
    $("h3sPart").addEventListener("change", function () { $("h3sPartText").value = S.parts[$("h3sPart").value] || ""; });
    $("h3sPartText").addEventListener("input", function () {
      var k = $("h3sPart").value, t = $("h3sPartText").value;
      if (t.trim()) S.parts[k] = t; else delete S.parts[k];
      sums(); changedSoon();
    });
    $("h3sVp").addEventListener("change", vpShow);
    $("h3sVpText").addEventListener("input", function () {
      var k = $("h3sVp").value, t = $("h3sVpText").value;
      if (t === (defaults[k] || "") || !t.trim()) delete S.viewPrompts[k]; else S.viewPrompts[k] = t;
      sums(); changedSoon();
    });
    $("h3sVpReset").addEventListener("click", function () { delete S.viewPrompts[$("h3sVp").value]; vpShow(); sums(); changed(); });
    $("h3sRefFile").addEventListener("change", function () {
      var f = $("h3sRefFile").files[0], n = +$("h3sRefFile").dataset.slot;
      if (f && n >= 0) { refs[n] = f; refNames[n] = ""; paintRefs(); changed(); }
      $("h3sRefFile").value = "";
    });
    window.addEventListener("resize", function () { if (lastPreview) draw(lastPreview); });
    return true;
  }

  function paintSelects() {
    opt($("h3sPreset"), C.presets.map(function (p) { return [p.id, p.label]; }).concat([["custom", "My own views"]]), presetOf(S.views));
    opt($("h3sCloth"), C.clothing, S.clothing);
    opt($("h3sHands"), C.hands, S.hands);
    opt($("h3sFeet"), C.feet, S.feet);
    opt($("h3sStyle"), C.styles, S.style);
    opt($("h3sDetail"), C.sizes.concat([["manual", "Exact size…"]]), S.detail);
    $("h3sWH").style.display = S.detail === "manual" ? "flex" : "none";
    $("h3sW").value = S.w; $("h3sH").value = S.h;
    $("h3sLayout").checked = !!S.layout; $("h3sTiled").checked = !!S.tiled;
    opt($("h3sPart"), C.parts, $("h3sPart").value || C.parts[0][0]);
    $("h3sPartText").value = S.parts[$("h3sPart").value] || "";
    opt($("h3sVp"), C.views.map(function (v) { return [v.id, v.label]; }), $("h3sVp").value || "body_front");
    vpShow(); paintViews(); paintRefs(); sums();
  }
  var GROUPS = [["head", "Head"], ["body", "Full body"], ["clothing", "Clothing"], ["detail", "Hands and feet"]];
  function paintViews() {
    var box = $("h3sViews"); box.innerHTML = "";
    GROUPS.forEach(function (g) {
      var h = document.createElement("div"); h.className = "grp"; h.textContent = g[1]; box.appendChild(h);
      C.views.filter(function (v) { return v.group === g[0]; }).forEach(function (v) {
        var lb = document.createElement("label"), cb = document.createElement("input"), sp = document.createElement("span");
        cb.type = "checkbox"; cb.value = v.id; cb.dataset.view = v.id; cb.checked = S.views.indexOf(v.id) >= 0;
        var off = S.clothing === "none" && g[0] === "clothing";
        cb.disabled = off;
        lb.title = off ? "No clothing leaves the clothing views out" : v.label;
        sp.textContent = v.label;
        cb.addEventListener("change", function () {
          S.views = C.views.map(function (x) { return x.id; }).filter(function (id) {
            var c = box.querySelector('input[data-view="' + id + '"]'); return c && c.checked; });
          S.preset = presetOf(S.views); $("h3sPreset").value = S.preset; changed();
        });
        lb.appendChild(cb); lb.appendChild(sp); box.appendChild(lb);
      });
    });
    $("h3sPreset").value = presetOf(S.views);
  }
  function paintRefs() {
    var box = $("h3sRefs"); box.innerHTML = "";
    [0, 1, 2].forEach(function (n) {
      var num = n + 1;
      var row = document.createElement("div"); row.className = "h3sRef";
      var b = document.createElement("button"); b.type = "button"; b.className = "ghost gbtn pic"; b.id = "h3sRefPic" + n;
      var named = refNames[n];
      b.title = refs[n] ? refs[n].name + " - click to change" : named ? named + " - click to change" : "Add a part picture";
      b.setAttribute("aria-label", "Part picture " + num);
      if (refs[n] && window.URL && URL.createObjectURL) { b.style.backgroundImage = "url(" + URL.createObjectURL(refs[n]) + ")"; b.textContent = ""; }
      else b.textContent = named ? "🖼" : "＋";
      b.addEventListener("click", function () { var f = $("h3sRefFile"); f.dataset.slot = n; f.click(); });
      var sel = document.createElement("select"); sel.id = "h3sRole" + n;
      sel.setAttribute("aria-label", "What part picture " + num + " is for");
      opt(sel, C.roles, S.roles[n] || "same_character");
      sel.addEventListener("change", function () { S.roles[n] = sel.value; changed(); });
      var x = document.createElement("button"); x.type = "button"; x.className = "ghost gbtn"; x.textContent = "✕";
      x.title = "Take this part picture off"; x.setAttribute("aria-label", "Remove part picture " + num);
      x.disabled = !refs[n] && !named;
      x.addEventListener("click", function () { refs[n] = null; refNames[n] = ""; paintRefs(); changed(); });
      row.appendChild(b); row.appendChild(sel); row.appendChild(x); box.appendChild(row);
    });
  }
  function vpShow() {
    var k = $("h3sVp").value;
    $("h3sVpText").placeholder = defaults[k] || "the designer's own instruction for this view";
    $("h3sVpText").value = S.viewPrompts[k] != null ? S.viewPrompts[k] : (defaults[k] || "");
  }
  function sums() {
    var np = Object.keys(S.parts).length, nv = Object.keys(S.viewPrompts).length;
    $("h3sPartsSum").textContent = "✏ Part notes" + (np ? " (" + np + ")" : "");
    $("h3sVpSum").textContent = "✏ View instructions" + (nv ? " (" + nv + " edited)" : "");
  }

  /** the choices the server's lib/charSheetH3.js state() takes */
  function choices() {
    return { views: S.views.slice(), clothing: S.clothing, hands: S.hands, feet: S.feet,
             detail: S.detail === "manual" ? "current" : S.detail,
             size: S.detail === "manual" ? { mode: "manual", width: S.w, height: S.h } : { mode: "auto" },
             parts: S.parts, roles: S.roles.slice(0, 3), viewPrompts: S.viewPrompts };
  }
  function present() { return [0, 1, 2].map(function (n) { return !!(refs[n] || refNames[n]); }); }

  var lastPreview = null;
  function changed() { save(); preview(); }
  function changedSoon() { save(); clearTimeout(previewT); previewT = setTimeout(preview, 600); }
  function preview() {
    clearTimeout(previewT);
    if (!C || !$("h3sCv")) return;
    if (refItem()) { previewN++; drawTemplate(); return; }  // 2.874.0: your template's layout is the layout (2.934.0: or the mannequin's sheet)
    var n = ++previewN;
    fetch("/api/charsheet/h3/preview", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choices: choices(), layout: S.layout, style: S.style, refs: present() }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (n !== previewN) return;
        if (d.error) { lastPreview = null; draw(null, "⚠ " + d.error); $("h3sSize").textContent = ""; return; }
        if (d.offline) { lastPreview = null; draw(null, "Start ComfyUI to see the layout"); $("h3sSize").textContent = d.summary || ""; return; }
        if (d.nopack) { lastPreview = null; draw(null, "Restart ComfyUI so it loads the designer, to see the layout"); $("h3sSize").textContent = d.summary || ""; return; }
        lastPreview = d; defaults = d.defaults || {}; vpShow(); draw(d);
        $("h3sSize").textContent = d.width + " × " + d.height + " px · " + (Math.round((d.megapixels || 0) * 10) / 10) + " MP · " + d.summary
          + (d.experimental ? " · big - needs a lot of VRAM" : "");
        test("h3s_preview", d.panels.length);
      }).catch(function () { if (n === previewN) draw(null, "Start ComfyUI to see the layout"); });
  }
  function draw(d, msg) {
    var cv = $("h3sCv"), m = $("h3sCvMsg");
    if (!cv) return;
    var W = Math.max(200, (cv.parentNode.clientWidth || 356) - 2);
    if (!d) { cv.width = W; cv.height = 70; cv.getContext("2d").clearRect(0, 0, W, 70); m.textContent = msg || ""; return; }
    m.textContent = "";
    var H = Math.max(40, Math.round(W * d.height / d.width));
    cv.width = W; cv.height = H;
    var g = cv.getContext("2d");
    g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, W, H);
    var label = {}; (C.views || []).forEach(function (v) { label[v.id] = v.label; });
    g.font = "10px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    d.panels.forEach(function (p) {
      var r = p.rect || [0, 0, 0, 0], x = r[0] * W, y = r[1] * H, w = r[2] * W, h = r[3] * H;
      g.fillStyle = "rgba(233,133,40,.18)"; g.fillRect(x + 1, y + 1, w - 2, h - 2);
      g.strokeStyle = "rgba(200,100,20,.9)"; g.lineWidth = 1; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      g.fillStyle = "#4a2a0c";
      var words = String(label[p.id] || p.id).split(" - "), lh = 11;
      words.forEach(function (t, i) { g.fillText(t, x + w / 2, y + h / 2 + (i - (words.length - 1) / 2) * lh, Math.max(10, w - 4)); });
    });
  }
  function say(t, warn) {
    var s = $("h3sStatus"); if (!s) return;
    s.className = "h3sLine" + (warn ? " warn" : "");
    s.textContent = t || "";
  }
  function paintStatus() {
    var s = $("h3sStatus"); if (!s) return;
    if (installed === false) {
      say("⚠ The H3 Character Sheet Designer is not installed yet.", true);
      var b = document.createElement("button"); b.type = "button"; b.className = "ghost gbtn"; b.id = "h3sInstall";
      b.textContent = "⬇ Install…"; b.title = "The designer's node pack and MiniMax H3 Image - Settings ▸ Add-ons ▸ H3 Character Sheet Designer";
      b.addEventListener("click", function () { ask(); });
      s.appendChild(b);
    } else say("");
  }
  function ask() {
    if (!window.H3NeedInstall) return Promise.resolve(false);
    return window.H3NeedInstall.ensure("h3sheet", "The character sheet is made by the H3 Character Sheet Designer in ComfyUI, drawn by MiniMax H3 Image.")
      .then(function (ok) { if (ok) { installed = true; paintStatus(); preview(); } return ok; });
  }

  function refresh() {
    if (!build()) return Promise.resolve(false);
    return fetch("/api/charsheet/h3").then(function (r) { return r.json(); }).then(function (d) {
      C = d.catalog; installed = !!d.installed;
      paintSelects(); paintStatus(); paintPic(); preview();
      loadLibrary();
      test("h3s_ready", installed);
      return installed;
    }).catch(function () { say("⚠ the sheet designer's settings could not be read", true); return false; });
  }
  function ready() {
    var go = C ? Promise.resolve(installed) : refresh();
    return go.then(function (ok) { return ok ? true : ask(); });
  }
  function fields() {
    var t = refItem();
    return { choices: choices(), layout: S.layout, style: S.style, tiled: S.tiled, template: t ? t.id : "" };
  }
  function appendTo(fd) {
    var f = fields();
    fd.append("choices", JSON.stringify(f.choices));
    fd.append("layout", f.layout ? "1" : "");
    fd.append("style", f.style);
    fd.append("tiled", f.tiled ? "1" : "");
    if (f.template) fd.append("template", f.template);
    [0, 1, 2].forEach(function (n) { if (refs[n]) fd.append("ref" + (n + 1), refs[n], refs[n].name); });
    fd.append("ref_files", JSON.stringify(refNames.map(function (x, n) { return refs[n] ? "" : x; })));
    return body();
  }
  function body() {
    var f = fields();
    f.ref_files = refNames.slice();
    return f;
  }
  function remember(names) {
    if (!Array.isArray(names)) return;
    [0, 1, 2].forEach(function (n) { if (names[n]) { refNames[n] = names[n]; refs[n] = null; } });
    if ($("h3sRefs")) paintRefs();
  }
  function failed(d) {
    if (!d || d.needs !== "h3sheet") return;
    if (installed === false) paintStatus();                 // the ⬇ Install… line
    else say("⚠ " + ((d.missing && d.missing.length) ? d.missing.join(" · ") : d.error), true);
  }

  /* ---- 2.871.0: ✨ Generate the character picture ---- */
  var a16 = function (n) { return Math.max(16, Math.round(n / 16) * 16); };
  /** a style's saved Basic Settings (basic_settings.tmp "basic") -> the /api/genimage fields + words (pure) */
  function fromSaved(v, useModel) {
    var b = {}, w = [];
    v = v || {};
    var res = parseInt(v.imgRes, 10), ar = String(v.imgAr || "1:1").split(":").map(Number);
    if (Number.isFinite(res) && res > 0 && ar[0] > 0 && ar[1] > 0) {
      if (ar[0] >= ar[1]) { b.width = a16(res); b.height = a16(res * ar[1] / ar[0]); } else { b.height = a16(res); b.width = a16(res * ar[0] / ar[1]); }
      w.push(b.width + " × " + b.height);
    }
    var st = parseInt(v.imgSteps, 10); if (v.imgSteps !== "" && v.imgSteps != null && st > 0) { b.steps = st; w.push(st + " steps"); }
    var cf = parseFloat(v.imgCfg); if (v.imgCfg !== "" && v.imgCfg != null && Number.isFinite(cf)) { b.cfg = cf; w.push("CFG " + cf); }
    var sd = parseInt(v.imgSeed, 10); if (Number.isFinite(sd)) { b.seed = sd; w.push(sd >= 0 ? "seed " + sd : "random seed"); }
    var ck = String(v.imgCkpt == null ? "" : v.imgCkpt).trim(); if (ck && useModel !== false) { b.model = ck; w.push(ck.split(/[\\/]/).pop()); }
    return { body: b, words: w.join(", ") };
  }
  function imageStyles() {
    var sel = $("styleSel");
    return sel ? Array.prototype.filter.call(sel.options, function (o) { return o.value; }).map(function (o) { return { id: o.value, name: o.textContent.trim() }; }) : [];
  }
  var ovrOn = function () { var c = $("ovrStyle"); return c ? !!c.checked : false; };
  var gcall = function (n, a) { try { var f = window[n]; return typeof f === "function" ? f(a) : undefined; } catch (e) { return undefined; } };
  /** what the picked style renders with -> {body, words} */
  function picSettings(id) {
    if (!ovrOn()) return { body: {}, words: "Override style is off - the style's own settings" };
    var sel = $("styleSel");
    if (sel && sel.value === id && typeof window.imgBasicsBody === "function") {
      var b = window.imgBasicsBody({}) || {}, w = [];
      if (b.width) w.push(b.width + " × " + b.height); if (b.steps) w.push(b.steps + " steps"); if (b.cfg != null) w.push("CFG " + b.cfg);
      if (b.model) w.push(String(b.model).split(/[\\/]/).pop()); if (b.extra_loras && b.extra_loras.length) w.push(b.extra_loras.length + " LoRA" + (b.extra_loras.length > 1 ? "s" : ""));
      return { body: b, words: "Override style: Basic Settings now" + (w.length ? " · " + w.join(", ") : "") };
    }
    var SB = window.H3StyleBasic, e = SB && SB.file && ((SB.file() || {}).styles || {})["image:" + id];
    if (!e || !e.basic) return { body: {}, words: "Override style: this style has no Basic Settings saved yet - its own settings" };
    var r = fromSaved(e.basic, gcall("useMD", "image") !== false);
    return { body: r.body, words: "Override style: this style's Basic Settings" + (r.words ? " · " + r.words : "") };
  }
  function buildPic() {
    if ($("h3sPicBar")) return;
    var load = $("chSheetLoad"), bar = load && load.closest(".chBar");
    if (!bar) return;
    var row = document.createElement("div");
    row.className = "chBar"; row.id = "h3sPicBar";
    row.innerHTML = '<select id="h3sMannequin" style="width:auto" aria-label="The mannequin reference sheet of poses and camera angles" title="The mannequin\'s sheet is the REFERENCE: the new sheet follows its panels, poses and camera angles (male 8 heads, female 7.5). The character comes from the picture you load or generate">'
      + '<option value="">🧍 Mannequin…</option><option value="male">🧍 Male (8 heads)</option><option value="female">🧍 Female (7.5 heads)</option></select>'
      + '<button class="ghost gbtn" id="h3sMqDel" type="button" title="Delete this mannequin from your library" aria-label="Delete the mannequin" hidden>🗑</button>'
      + '<input type="file" id="h3sMqFile" accept="image/png,image/jpeg,image/webp,image/bmp" style="display:none" aria-label="Choose a picture of your own mannequin">'
      + '<input id="h3sPicPrompt" type="text" spellcheck="true" style="flex:1;min-width:160px" placeholder="Describe the character to generate…" aria-label="Describe the character to generate">'
      + '<select id="h3sPicStyle" style="width:auto;max-width:240px" aria-label="Image style for the character picture" title="The image style that makes the picture"></select>'
      + '<button class="ghost gbtn" id="h3sPicGo" type="button" title="Make the character picture with this style - it opens here, ready for the sheet" aria-label="Generate the character picture">✨ Generate</button>';
    var note = document.createElement("div"); note.className = "hint"; note.id = "h3sPicNote"; note.setAttribute("aria-live", "polite");
    bar.parentNode.insertBefore(note, bar.nextSibling);
    bar.parentNode.insertBefore(row, bar.nextSibling);
    $("h3sPicPrompt").value = S.picPrompt || "";
    $("h3sPicPrompt").addEventListener("input", function () { S.picPrompt = $("h3sPicPrompt").value; save(); });
    $("h3sPicPrompt").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); generatePic(); } });
    $("h3sPicStyle").addEventListener("change", function () { S.picStyle = $("h3sPicStyle").value; save(); picNote(); });
    $("h3sPicGo").addEventListener("click", generatePic);
    $("h3sMannequin").value = S.mannequin || "";
    paintMannequins();
    $("h3sMannequin").addEventListener("change", function () {
      var v = $("h3sMannequin").value;
      if (v === "__add") { $("h3sMannequin").value = ""; $("h3sMqFile").value = ""; $("h3sMqFile").click(); return; }
      paintMqDel();
      if (!v) { clearMannequin(); paintTemplate(); changed(); picNote(); return; }
      loadMannequin(v);
    });
    $("h3sMqFile").addEventListener("change", function () { var f = $("h3sMqFile").files[0]; if (f) addToLibrary("mannequins", f); });
    $("h3sMqDel").addEventListener("click", function () { var v = $("h3sMannequin").value; if (/^own:/.test(v)) delFromLibrary("mannequins", v.slice(4)); });
    var ov = $("ovrStyle"); if (ov) ov.addEventListener("change", function () { picNote(); });
  }
  function paintPic() {
    buildPic();
    var sel = $("h3sPicStyle"); if (!sel) return;
    var list = imageStyles();
    var want = S.picStyle, ps = $("styleSel");
    var pick = want && list.some(function (x) { return x.id === want; }) ? want : (ps && list.some(function (x) { return x.id === ps.value; }) ? ps.value : (list[0] ? list[0].id : ""));
    sel.innerHTML = "";
    if (!list.length) { var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "no image styles"; sel.appendChild(o0); }
    list.forEach(function (x) { var o = document.createElement("option"); o.value = x.id; o.textContent = x.name; sel.appendChild(o); });
    if (pick) sel.value = pick;
    picNote();
  }
  function picNote(t) {
    var n = $("h3sPicNote"); if (!n) return;
    var id = $("h3sPicStyle") && $("h3sPicStyle").value;
    // 2.934.0: the mannequin's line (the reference) stays, then the style's settings
    n.textContent = t || [picDone || MANNEQUIN.line || "", id ? picSettings(id).words : ""].filter(Boolean).join(" · ");
  }
  /** 🧍 2.934.0: the mannequin's REFERENCE SHEET - its poses and camera angles - becomes what the new sheet follows (in place of
   *  a template); the start picture is left alone: the character is the picture you 📂 load or ✨ generate.
   *  quiet = restoring the pick on open (the views you ticked stay) */
  function loadMannequin(sex, quiet) {
    if (!sex) { clearMannequin(); paintTemplate(); changed(); return Promise.resolve(null); }
    picNote("loading the " + (/^own:/.test(sex) ? "" : sex + " ") + "mannequin's reference sheet…");
    return fetch("/api/charsheet/h3/mannequin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sex: sex }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
        if (!x.ok) throw new Error((x.j && x.j.error) || "the mannequin could not be loaded");
        var j = x.j;
        MANNEQUIN = { sex: sex, ref: j.ref || ("mannequin:" + sex), name: j.own ? j.label : (j.label + " display mannequin (" + j.heads + " heads)"),
                      sheet: j.sheet || j.url, w: j.sheet_w || j.w || 0, h: j.sheet_h || j.h || 0, own: !!j.own };
        MANNEQUIN.line = "🧍 " + MANNEQUIN.name + " is the reference sheet - the new sheet follows its poses and camera angles. "
          + "The character is the picture you 📂 load or ✨ generate, then ▶ Generate sheet";
        S.mannequin = sex; S.template = "";
        if (!quiet && !j.own) S.views = MQ_VIEWS.slice();      // the views bitGen's mannequin sheet shows
        save(); picDone = "";
        var sel = $("h3sMannequin"); if (sel && sel.value !== sex) { sel.value = sex; paintMqDel(); }
        if (C && !quiet && $("h3sPreset")) { paintSelects(); }
        paintTemplate(); preview(); picNote();
        test("h3s_mannequin", sex);
        return j;
      }).catch(function (e) { clearMannequin(); paintTemplate(); preview(); picNote("✗ " + (e.message || e)); return null; });
  }
  function clearMannequin() {
    MANNEQUIN = Object.assign({}, MQ_NONE); S.mannequin = ""; save();
    var sel = $("h3sMannequin"); if (sel) { sel.value = ""; paintMqDel(); }
  }
  /** what the new sheet follows: your template, else the mannequin's reference sheet, else nothing (the designer's own layout) */
  function refItem() {
    var t = tplItem(); if (t) return t;
    return MANNEQUIN.ref ? { id: MANNEQUIN.ref, name: MANNEQUIN.name, url: MANNEQUIN.sheet, w: MANNEQUIN.w || 1, h: MANNEQUIN.h || 1, mannequin: true } : null;
  }
  /* ---- 2.874.0: your own mannequins + sheet templates (lib/sheetLibrary.js, routes/sheetLibrary.js) ---- */
  function tplItem() { return S.template ? (LIB.templates || []).filter(function (x) { return x.id === S.template; })[0] || null : null; }
  function loadLibrary() {
    return fetch("/api/charsheet/library").then(function (r) { return r.json(); }).then(function (j) {
      LIB = { mannequins: j.mannequins || [], templates: j.templates || [] };
      paintMannequins(); paintTemplate(); preview();
      // 2.934.0: the mannequin picked last time is the reference again (gone from your library = none)
      if (S.mannequin && !MANNEQUIN.ref) loadMannequin(S.mannequin, true);
      return LIB;
    }).catch(function () { return LIB; });
  }
  function opt2(sel, v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); return o; }
  function paintMannequins() {
    var sel = $("h3sMannequin"); if (!sel) return;
    var keep = sel.value;
    sel.innerHTML = "";
    opt2(sel, "", "🧍 Mannequin…"); opt2(sel, "male", "🧍 Male (8 heads)"); opt2(sel, "female", "🧍 Female (7.5 heads)");
    if (LIB.mannequins.length) {
      var g = document.createElement("optgroup"); g.label = "Your mannequins";
      LIB.mannequins.forEach(function (x) { opt2(g, "own:" + x.id, x.name); });
      sel.appendChild(g);
    }
    opt2(sel, "__add", "＋ Add your own mannequin…");
    sel.value = Array.prototype.some.call(sel.options, function (o) { return o.value === keep; }) ? keep : "";
    paintMqDel();
  }
  function paintMqDel() { var b = $("h3sMqDel"); if (b) b.hidden = !/^own:/.test(($("h3sMannequin") || {}).value || ""); }
  function paintTemplate() {
    var sel = $("h3sTpl"); if (!sel) return;
    if (S.template && !tplItem() && LIB.templates) { /* gone from the library */ }
    sel.innerHTML = "";
    opt2(sel, "", "None - the designer's own layout");
    LIB.templates.forEach(function (x) { opt2(sel, x.id, x.name + " (" + x.w + " × " + x.h + ")"); });
    if (MANNEQUIN.ref) opt2(sel, "__mq", "🧍 " + MANNEQUIN.name + " - poses and camera angles");
    opt2(sel, "__add", "＋ Upload a character sheet…");
    var t = tplItem(), r = refItem(); sel.value = t ? t.id : r ? "__mq" : "";
    $("h3sTplDel").hidden = !t;
    var lg = $("h3sLayout");
    if (lg) { lg.disabled = !!r; lg.checked = r ? true : !!S.layout; lg.parentNode.title = r ? (t ? "Your template is the layout guide" : "The mannequin's reference sheet is the layout guide") : "The designer's layout picture rides along and places the views; off = its words place them"; }
  }
  var tplImg = null;
  function drawTemplate() {
    var t = refItem(), cv = $("h3sCv"), m = $("h3sCvMsg"); if (!t || !cv) return;
    var W = Math.max(200, (cv.parentNode.clientWidth || 356) - 2), H = Math.max(40, Math.round(W * t.h / t.w));
    cv.width = W; cv.height = H;
    m.textContent = "";
    $("h3sSize").textContent = t.mannequin
      ? "Reference: " + t.name + " - the sheet follows its poses and camera angles (" + t.w + " × " + t.h + "); the character is your picture"
      : "Template: " + t.name + " - the sheet follows its layout (" + t.w + " × " + t.h + "); tick the views it shows";
    var paint = function () { var r = refItem(); if (r && r.id === t.id && tplImg && tplImg.complete) cv.getContext("2d").drawImage(tplImg, 0, 0, W, H); };
    if (tplImg && tplImg.dataset.id === t.id) { paint(); return; }
    tplImg = new Image(); tplImg.dataset.id = t.id; tplImg.onload = paint; tplImg.src = t.url;
  }
  function addToLibrary(kind, f) {
    var fd = new FormData(); fd.append("file", f, f.name); fd.append("name", f.name);
    (kind === "templates" ? say : picNote)("adding " + f.name + "…");
    return fetch("/api/charsheet/library/" + kind, { method: "POST", body: fd }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) throw new Error((x.j && x.j.error) || "the picture could not be added");
        return loadLibrary().then(function () {
          if (kind === "templates") { clearMannequin(); S.template = x.j.id; save(); paintTemplate(); preview(); say("✓ template " + x.j.name + " added - the sheet follows its layout"); }
          else { $("h3sMannequin").value = "own:" + x.j.id; paintMqDel(); loadMannequin("own:" + x.j.id); }
          test("h3s_lib_" + kind, x.j.id);
          return x.j;
        });
      }).catch(function (e) { (kind === "templates" ? function (t) { say(t, true); } : picNote)("✗ " + (e.message || e)); return null; });
  }
  function delFromLibrary(kind, id) {
    var it = (LIB[kind] || []).filter(function (x) { return x.id === id; })[0];
    var q = "Delete " + (it ? it.name : "it") + " from your " + (kind === "templates" ? "sheet templates" : "mannequins") + "?";
    var go = typeof window.appConfirm === "function" ? window.appConfirm(q, "Delete") : Promise.resolve(true);
    return Promise.resolve(go).then(function (ok) {
      if (!ok) return false;
      return fetch("/api/charsheet/library/" + kind + "/" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
        if (kind === "templates" && S.template === id) { S.template = ""; save(); }
        if (kind === "mannequins" && MANNEQUIN.sex === "own:" + id) { clearMannequin(); }
        return loadLibrary().then(function () { if (kind === "mannequins") { paintMannequins(); paintTemplate(); preview(); picNote(); } return true; });
      });
    });
  }
  var picPoll = null, picDone = "";       // picDone: the last ✓ made, kept when the row repaints (2.874.0)
  function generatePic() {
    var words = ($("h3sPicPrompt").value || "").trim(), id = $("h3sPicStyle").value;
    if (!words) { picNote("write what the character looks like first"); $("h3sPicPrompt").focus(); return; }
    if (!id) { picNote("pick an image style"); return; }
    var ps = picSettings(id), body = Object.assign({ prompt: words, style_id: id, batch: 1 }, ps.body);
    var go = $("h3sPicGo"); go.disabled = true; picDone = "";
    picNote("queuing… · " + ps.words);
    var ready = window.H3PodRoute && window.H3PodRoute.ready ? Promise.resolve(window.H3PodRoute.ready("image", id)) : Promise.resolve(true);
    ready.then(function (ok) {
      if (ok === false) throw new Error("ComfyUI is not running and could not be started - Settings ▸ ComfyUI");
      return fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
      if (!x.ok || !x.j.id) throw new Error((x.j && x.j.error) || "the picture could not be queued");
      test("h3s_pic_job", x.j.id);
      clearInterval(picPoll);
      picPoll = setInterval(function () {
        fetch("/api/jobs/" + encodeURIComponent(x.j.id)).then(function (r) { return r.json(); }).then(function (jj) {
          if (jj.status === "running" || jj.status === "queued") { picNote((jj.status === "queued" ? "waiting in the Queue" : "rendering" + (window.H3Steps ? window.H3Steps.tag(jj.progress) : "")) + "…"); return; }
          clearInterval(picPoll); go.disabled = false;
          var outs = (jj.outputs && jj.outputs.length ? jj.outputs : jj.output ? [jj.output] : []).map(function (n) { return "/outputs/" + encodeURIComponent(String(n).split(/[\\/]/).pop()); });
          if (jj.status !== "done" || !outs.length) { picNote(jj.status === "done" ? "✗ the picture came back empty" : "✗ render " + jj.status); return; }
          picDone = "✓ made - drag the box over the character, then ▶ Generate sheet" + (MANNEQUIN.ref ? " (in the 🧍 mannequin's poses and camera angles)" : "");
          picNote(picDone);
          if (window.H3CharSheetPic) { window.H3CharSheetPic.keep(outs); window.H3CharSheetPic.open(outs[0], decodeURIComponent(outs[0].split("/").pop())); }
        }).catch(function () {});
      }, 1500);
    }).catch(function (e) { go.disabled = false; picNote("✗ " + (e.message || e)); });
  }

  load();
  window.H3SheetDesign = { refresh: refresh, ready: ready, appendTo: appendTo, body: body, remember: remember, failed: failed,
    state: function () { return JSON.parse(JSON.stringify(S)); },
    setState: function (o) { Object.keys(o || {}).forEach(function (k) { if (k in S) S[k] = o[k]; }); save(); if (C) { paintSelects(); preview(); } },
    choices: choices, fromSaved: fromSaved, picSettings: picSettings, generatePic: generatePic,
    MQ_VIEWS: MQ_VIEWS, loadMannequin: loadMannequin, reference: function () { var r = refItem(); return r ? Object.assign({}, r) : null; }, loadLibrary: loadLibrary, library: function () { return JSON.parse(JSON.stringify(LIB)); }, mannequin: function () { return Object.assign({}, MANNEQUIN); } };
})();
