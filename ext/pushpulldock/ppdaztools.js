/* bitGen Studio — ext/pushpulldock/ppdaztools.js (2.980.0): 🧬 DAZ TOOLS - the Daz library, the explorer and the shape
 * controls as DOCKERS (window.H3DazTools). Tim: "add a toggle button to the top toolbar DAZ Tools, open the daz library in a
 * left docker, daz explorer (characters and components) and shape controls in the right docker when on, hide when off".
 * NOT A REPLACEMENT FOR DAZ STUDIO - light tasks; Daz Studio is a very powerful character creator.
 *   #dazTools (the menu bar, after the app strip)   on = #app.dz-on: two grid columns either side of the main column
 *   #dzLeft  📚 DAZ Library     the content folders by kind with thumbnails; a figure / character = a new character in the
 *                                explorer, clothing / hair / anatomy = worn by (or taken off) the picked character
 *   #dzRight 🧭 DAZ Explorer    the characters and their components (figure + what they wear): pick, rename (double-click),
 *                                ✕ a component / a character, 💨 physics, 💪 muscles, 🧍 Build, 🕺 Pose, ⤒ Open, 💾 Save,
 *                                📂 a saved one
 *            🎚 Shape controls  the picked character's dials, by group, searched, "changed only", ↺, double-click = 0
 * The columns are #app children (dzLeft + its splitter before #maincol, a splitter + dzRight after it): the stylesheet's
 * template while no ▣ column is docked, static/dgdock.js's regrid (COLV dzLeft / dzRight) when one is. Kept in
 * localStorage: h3.daztools.on, .scene {chars, sel}, .w {l, r, eh}. Pure (Node - test-980): groupDials, cleanScene,
 * newChar, wearToggle, TEMPLATE. Uses the 📚 routes (/api/dazlib/*) and H3DazPose (ppdazpose.js). */
(function (root) {
  "use strict";
  const NOTE = "Not a replacement for Daz Studio - made for light tasks. Daz Studio is a very powerful character creator.";
  const KINDS = [["figure", "🧍 Figures"], ["character", "🎭 Characters"], ["clothing", "👕 Clothing"], ["hair", "💇 Hair"], ["anatomy", "🫀 Anatomy"], ["pose", "🕴 Poses"], ["shape", "🎚 Shapes"], ["material", "🎨 Materials"], ["other", "📦 Other"]];   // 2.985.0: + 🎨 (eyes' colour, make-up, skins - worn = painted)
  const WEAR = ["clothing", "hair", "anatomy", "material", "other"];
  const TEMPLATE = "var(--c1) var(--s1) var(--c2) var(--s2) var(--c3) var(--s3) var(--dzl) 5px minmax(200px, 1fr) 5px var(--dzr) var(--s5) var(--c4) var(--s4) var(--c5)";
  /** the dials by their group (a group's name = the last part of the morph's group path), groups and dials A-Z */
  function groupDials(list) {
    const m = new Map();
    for (const d of list || []) { const g = d.group || "Other"; if (!m.has(g)) m.set(g, []); m.get(g).push(d); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([group, dials]) => ({ group, dials: dials.slice().sort((a, b) => String(a.label).localeCompare(String(b.label))) }));
  }
  let uid = 0;
  function newChar(it, n) {
    return { id: "c" + Date.now().toString(36) + (uid++), name: String(it.name || "Character") + (n > 1 ? " " + n : ""), fig: { root: it.root, rel: it.rel, name: it.name, kind: it.kind || "figure" },
      wear: [], dials: {}, drape: { kinds: [], frames: 45 }, muscles: true, last: "", pose: {}, place: { x: 0, y: 0, rot: 0 }, inScene: false, hidden: false };
  }
  /** wear / take off a component (by its file) - true = now worn */
  function wearToggle(c, it) {
    const i = c.wear.findIndex((w) => w.rel === it.rel && w.root === it.root);
    if (i >= 0) { c.wear.splice(i, 1); return false; }
    c.wear.push({ root: it.root, rel: it.rel, name: it.name, kind: it.kind }); return true;
  }
  /** a kept scene made safe to use: characters with a figure, the picked one found (else the first) */
  const v3 = (a) => (Array.isArray(a) && a.length === 3 && a.every((x) => isFinite(+x)) ? a.map(Number) : [0, 0, 0]);
  /** 2.985.0 (pure): the icon of a built piece's kind */
  const PIECE_ICON = { figure: "🧍", eyes: "👁", mouth: "👄", graft: "🫀", hair: "💇", clothing: "👕", other: "📦" };
  function cleanScene(o) {
    const s = o && typeof o === "object" ? o : {}, chars = (Array.isArray(s.chars) ? s.chars : []).filter((c) => c && c.fig && c.fig.rel).slice(0, 40).map((c) => ({
      id: String(c.id || ("c" + (uid++))), name: String(c.name || c.fig.name || "Character").slice(0, 60), fig: { root: c.fig.root, rel: c.fig.rel, name: c.fig.name || "", kind: c.fig.kind || "figure" },
      wear: (Array.isArray(c.wear) ? c.wear : []).filter((w) => w && w.rel).slice(0, 60), dials: c.dials && typeof c.dials === "object" ? Object.fromEntries(Object.entries(c.dials).filter(([, v]) => isFinite(+v) && +v)) : {},
      drape: { kinds: (c.drape && Array.isArray(c.drape.kinds) ? c.drape.kinds : []).filter((k) => /^(clothing|hair|other)$/.test(k)), frames: Math.max(5, Math.min(240, +(c.drape && c.drape.frames) || 45)) },
      muscles: c.muscles !== false, last: typeof c.last === "string" ? c.last : "", inScene: !!c.inScene, hidden: !!c.hidden,
      place: c.place && typeof c.place === "object" ? { x: +c.place.x || 0, y: +c.place.y || 0, rot: +c.place.rot || 0 } : { x: 0, y: 0, rot: 0 },
      pose: c.pose && typeof c.pose === "object" ? Object.fromEntries(Object.entries(c.pose).filter(([, r]) => r && typeof r === "object").map(([k, r]) => [k, { x: +r.x || 0, y: +r.y || 0, z: +r.z || 0 }])) : {},
      custom: (Array.isArray(c.custom) ? c.custom : []).map(String).slice(0, 8), paint: c.paint && typeof c.paint === "object" ? c.paint : null, from: typeof c.from === "string" ? c.from : "",
      // 2.985.0: a pose preset's hips move + the whole figure's turn / move (kept - a sitting pose stays seated after a reload), the pieces hidden, the build's warnings
      hips: v3(c.hips), figPose: { rot: { x: +(c.figPose && c.figPose.rot && c.figPose.rot.x) || 0, y: +(c.figPose && c.figPose.rot && c.figPose.rot.y) || 0, z: +(c.figPose && c.figPose.rot && c.figPose.rot.z) || 0 }, move: v3(c.figPose && c.figPose.move) },
      face: c.face && typeof c.face === "object" && typeof c.face.picture === "string" ? { picture: c.face.picture, where: typeof c.face.where === "string" ? c.face.where : "" } : null,   // 2.988.0: 🙂 the head's photo
      hidePieces: (Array.isArray(c.hidePieces) ? c.hidePieces : []).map(String).slice(0, 80), warn: (Array.isArray(c.warn) ? c.warn : []).map((w) => String(w).slice(0, 300)).slice(0, 6) }));
    return { chars, sel: chars.some((c) => c.id === s.sel) ? s.sel : (chars[0] ? chars[0].id : "") };
  }
  /** 2.981.0: a copy of a character for a 📷 try (its figure, what it wears, its physics; dials / morphs / paint from the try) */
  function tryChar(base, route, n) {
    const c = newChar(base.fig, 1); c.name = base.name + " · 📷 " + route + (n > 1 ? " " + n : ""); c.wear = base.wear.map((w) => Object.assign({}, w));
    c.drape = { kinds: base.drape.kinds.slice(), frames: base.drape.frames }; c.muscles = base.muscles; c.dials = Object.assign({}, base.dials); c.custom = (base.custom || []).slice(); c.from = route; return c;
  }
  const ROUTES = { A: "Fit the dials (fast - the figure's own body dials)", B: "Scan + wrap (closer - a 3D shape from the photo, the figure wrapped onto it)" };
  /** 2.983.0: a free spot on the Sketcher's floor for a new character (1 m apart along x) */
  function freeSpot(chars) { const used = (chars || []).filter((c) => c.inScene).map((c) => (c.place || {}).x || 0); let x = 0; while (used.some((u) => Math.abs(u - x) < 0.6)) x += 1; return { x, y: 0, rot: 0 }; }
  /** a pose preset's bones kept only when the figure has them (a Genesis 8 pose on a Genesis 9 figure moves little) */
  function posePick(pose, bones) { const out = {}; let n = 0; for (const [k, r] of Object.entries(pose || {})) if (bones && bones[k]) { out[k] = { x: +r.x || 0, y: +r.y || 0, z: +r.z || 0 }; n++; } return { pose: out, n }; }
  const pure = { NOTE, KINDS, WEAR, TEMPLATE, ROUTES, PIECE_ICON, groupDials, newChar, wearToggle, cleanScene, tryChar, freeSpot, posePick };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const LS = { get: (k, d) => { try { const v = root.localStorage.getItem("h3.daztools." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { root.localStorage.setItem("h3.daztools." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } } };
  const st = { on: false, kind: "figure", scene: cleanScene(LS.get("scene", null)), dialList: [], dialFor: "", changedOnly: false, busy: false };
  const cur = () => st.scene.chars.find((c) => c.id === st.scene.sel) || null;
  const keep = () => LS.set("scene", st.scene);
  const say = (t) => { const m = $("dzMsg"); if (m) m.textContent = t || ""; };
  async function jget(u) { const r = await fetch(u); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; }
  async function jpost(u, b) { const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; }

  function css() {
    if ($("dzCss")) return;
    const s = doc.createElement("style"); s.id = "dzCss";
    s.textContent = "#pushpulldock:not(.dz-on) .dz-el{display:none!important}.dz-el [hidden]{display:none!important}#dazTools.on,#ppDazLib.on{background:var(--tiger-deep,#a8601a);color:#fff}"
      + "#dzSide{width:var(--dzr,330px);flex:none;display:flex;flex-direction:column;min-height:0;position:relative;border-left:1px solid var(--line,#3a352d);border-radius:6px;overflow:hidden}"
      + "#dzSplitR{position:absolute;left:0;top:0;bottom:0;width:6px;cursor:col-resize;z-index:3}#dzSplitR:hover,#dzSplitR.drag{background:var(--tiger-deep,#a8601a)}"
      + "#dzLib{position:absolute;left:var(--dzlx,76px);top:var(--dzly,6px);width:var(--dzlw,300px);height:var(--dzlh,70%);min-width:200px;min-height:160px;z-index:7;resize:both;border:1px solid var(--line,#3a352d);border-radius:7px;box-shadow:0 8px 26px #000b}"
      + "#dzLib .dzhead{cursor:move;user-select:none}#dzRootsBox{padding:4px 6px;display:flex;flex-direction:column;gap:4px}#dzRootsBox textarea{width:100%;min-height:54px;font:11px monospace}"
      + "#dzParTabs{display:flex;gap:3px}#dzParTabs button{padding:1px 7px;font-size:11px}#dzParTabs button.on{outline:2px solid #38e1ff}.dzpane{flex:1 1 0;display:flex;flex-direction:column;min-height:0;overflow:auto}"
      + "#dzPlace{display:flex;gap:6px;align-items:center;padding:3px 6px;flex-wrap:wrap}#dzPlace input[type=number]{width:58px}"
      + ".dzax{display:flex;gap:6px;align-items:center;padding:1px 6px}.dzax span{width:62px}.dzax input[type=range]{flex:1}.dzax output{width:44px;text-align:right}#dzBone{margin:0 6px;width:calc(100% - 12px)}#dzBoneQ{margin:0 6px 3px;width:calc(100% - 12px)}"
      + ".dzact{display:flex;gap:6px;align-items:center;font-size:11px;padding:0 6px}.dzact span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dzact em{width:70px;background:#0006;border-radius:3px}.dzact i{display:block;height:6px;background:#38e1ff;border-radius:3px}"
      + ".dzdock{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:var(--panel,#1b1915);font-size:12px}"
      + ".dzhead{display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--line,#3a352d);font-weight:600}.dzhead b{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
      + ".dznote{margin:4px 6px;padding:4px 6px;border-left:3px solid var(--tiger,#f59e2c);background:#2a2418;border-radius:3px;font-size:11px}"
      + ".dztabs{display:flex;flex-wrap:wrap;gap:3px;padding:4px 6px}.dztabs button{padding:2px 6px;font-size:11px}.dztabs button.on{outline:2px solid #38e1ff}"
      + "#dzQ,#dzDialQ{margin:0 6px 4px;width:calc(100% - 12px)}"
      + "#dzGrid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:5px;padding:4px 6px;align-content:start}"
      + ".dzit{border:2px solid transparent;border-radius:5px;padding:2px;cursor:pointer;background:#0006;text-align:center}.dzit.fig{border-color:#38e1ff}.dzit.worn{border-color:#7bd389}"
      + ".dzit img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:3px;background:#000;display:block;pointer-events:none;-webkit-user-drag:none}.dzit span{display:block;font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + "#dzExp{flex:0 0 var(--dzeh,46%);display:flex;flex-direction:column;min-height:90px;overflow:auto}#dzPar{flex:1 1 0;display:flex;flex-direction:column;min-height:80px;overflow:hidden}#dzShape{flex:1 1 0;display:flex;flex-direction:column;min-height:0;overflow:hidden}"
      + "#dzTree{flex:1 0 60px;overflow:auto;padding:3px 6px}.dzc{border-radius:4px;padding:2px 4px;cursor:pointer;display:flex;gap:5px;align-items:center}.dzc.sel{background:#38e1ff22;outline:1px solid #38e1ff}"
      + ".dzc span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dzc input{flex:1;min-width:0}.dzcomp{padding:1px 4px 1px 22px;display:flex;gap:5px;align-items:center;opacity:.9}.dzcomp span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + "#dzChars{max-width:46%;min-width:0}#dzGrid>.hint{grid-column:1/-1}.dzx{padding:0 5px;font-size:11px;line-height:16px}.dzopts{display:flex;flex-wrap:wrap;gap:4px 8px;padding:4px 6px;border-top:1px solid var(--line,#3a352d)}.dzopts input[type=number]{width:52px}"
      + ".dzbtns{display:flex;flex-wrap:wrap;gap:4px;padding:4px 6px}.dzbtns button{padding:3px 7px;font-size:11px}"
      + ".dzhs{height:7px;cursor:row-resize;flex:none;background:var(--line,#3a352d)}.dzhs:hover,.dzhs.drag{background:var(--tiger-deep,#a8601a)}"
      + "#dzDials{flex:1;overflow:auto;padding:2px 6px}#dzDials details{border-bottom:1px solid #ffffff12}#dzDials summary{cursor:pointer;padding:3px 0;opacity:.85}"
      + ".dzdial{display:flex;gap:5px;align-items:center;padding:1px 0}.dzdial span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dzdial input[type=range]{width:42%}.dzdial output{width:38px;text-align:right;font-variant-numeric:tabular-nums}.dzdial.set span{color:#38e1ff}"
      + "#dzPhoto{border-top:1px solid var(--line,#3a352d);padding:3px 6px}#dzPhoto summary{cursor:pointer;font-weight:600}.dzph{display:flex;flex-direction:column;gap:4px;padding:4px 0}.dzrow{display:flex;gap:6px;align-items:center}.dzrow select,.dzrow input{flex:1;min-width:0}"
      + ".dzmg{display:grid;grid-template-columns:1fr 1fr;gap:4px 8px}.dzmg label{display:flex;gap:4px;align-items:center}.dzmg input{width:100%;min-width:0}#dzMeasure{border-top:1px solid var(--line,#3a352d);padding:3px 6px}#dzMeasure summary{cursor:pointer;font-weight:600}"
      + "#dzMsg{padding:4px 6px;border-top:1px solid var(--line,#3a352d);min-height:22px;font-size:11px;opacity:.9}"
      + ".dzsplit{cursor:col-resize}";
    doc.head.appendChild(s);
  }
  /* ---------------- the toolbar button */
  function button() {
    let b = $("dazTools"); const mb = $("menubar"); if (!mb) return null;
    if (!b) {
      b = doc.createElement("button"); b.type = "button"; b.id = "dazTools"; b.className = "ghost"; b.textContent = "🧬 DAZ Tools";
      b.title = "DAZ Tools - in the Sketcher: the Daz library (a floating docker), the explorer and the parameters (dockers on the right). " + NOTE;
      b.setAttribute("aria-pressed", "false"); b.onclick = () => toggle();
    }
    const strip = $("appStrip"), pb = mb.querySelector(".projbtns"), after = strip || pb;
    if (after && after.nextSibling !== b) mb.insertBefore(b, after.nextSibling); else if (!after && b.parentElement !== mb) mb.appendChild(b);
    return b;
  }
  /* ---------------- the dockers */
  function build() {
    const host = $("ppMain"); if (!host) return false;
    if ($("dzLib")) return true;
    css();
    // 2.983.0: the 📚 DAZ Library = a FLOATING docker over the Sketcher's view (drag its title, size its corner)
    const L = doc.createElement("div"); L.id = "dzLib"; L.className = "dzdock dz-el"; L.setAttribute("role", "dialog"); L.setAttribute("aria-label", "DAZ Library");
    L.innerHTML = '<div class="dzhead" id="dzLibHead" title="Drag to move - the corner sizes it"><b>📚 DAZ Library</b><button type="button" class="ghost dzx" id="dzFolders" title="Your Daz content folders">📁</button><button type="button" class="ghost dzx" id="dzRefresh" title="Read the library again">↻</button><button type="button" class="ghost dzx" id="dzLibMin" title="Fold it to its title">▁</button></div>'
      + '<div id="dzRootsBox" hidden><span class="hint">Your Daz content folders, one a line (each holds data/, People/, Runtime/…):</span><textarea id="dzRoots" spellcheck="false"></textarea><div style="display:flex;gap:6px"><button type="button" class="primary" id="dzRootsSave">Save</button><button type="button" class="ghost" id="dzRootsFind">Find them</button></div></div>'
      + '<div class="dznote" role="note">' + esc(NOTE) + "</div><div class=\"dztabs\" id=\"dzTabs\">" + KINDS.map(([k, l]) => '<button type="button" class="ghost" data-kind="' + k + '">' + l + "</button>").join("") + "</div>"
      + '<input type="search" id="dzQ" placeholder="Search the library…"><div id="dzEnc" class="hint" style="padding:0 6px"></div><div id="dzGrid" title="Drag a figure into the 3D view to place it; clothes, hair, poses onto a character"></div>';
    // the 🧭 DAZ Explorer + the 🎚 Parameters: their own dockers in a column right of the view (like Daz Studio)
    const R = doc.createElement("div"); R.id = "dzSide"; R.className = "dzdock dz-el"; R.setAttribute("aria-label", "DAZ Explorer and Parameters");
    R.innerHTML = '<div id="dzSplitR" role="separator" aria-orientation="vertical" title="Drag to size the DAZ dockers"></div><div id="dzExp"><div class="dzhead"><b>🧭 DAZ Explorer</b><select id="dzChars" title="A character you saved (💾)"><option value="">📂 Saved…</option></select></div>'
      + '<div id="dzTree" role="tree" aria-label="Characters and their components"></div>'
      + '<div id="dzPlace" hidden title="Where the picked character stands in the Sketcher (metres) - or drag it from the library"><label><input type="checkbox" id="dzShow" checked> 👁</label><label>X <input type="number" id="dzPX" step="0.1"></label><label>Y <input type="number" id="dzPY" step="0.1"></label><label>Turn <input type="number" id="dzPR" step="15"></label></div>'
      + '<div class="dzopts" id="dzOpts"><label title="Our own cloth - a light drape, not dForce"><input type="checkbox" data-drape="clothing"> 💨 Clothing</label><label><input type="checkbox" data-drape="hair"> Hair</label><label><input type="checkbox" data-drape="other"> Other</label>'
      + '<label title="Settle frames">frames <input type="number" id="dzFrames" min="5" max="240" value="45"></label><label title="The figure\'s own JCMs (or our own flex) - 🕺 Pose plays them"><input type="checkbox" id="dzMuscle" checked> 💪 Muscles</label></div>'
      + '<details id="dzPhoto"><summary title="Make this character\'s body from a photo - pick a way, ▶ Try; each try is a new character: try both, keep the better one">📷 Body from a photo</summary><div class="dzph">'
      + '<div id="dzPhotoPick"></div><label><input type="checkbox" id="dzBackOn"> ＋ a back photo (paints the back)</label><div id="dzBackPick" hidden></div>'
      + '<label class="dzrow">Way <select id="dzRoute">' + Object.entries(ROUTES).map(([k, v]) => '<option value="' + k + '">' + k + " - " + v + "</option>").join("") + "</select></label>"
      + '<label class="dzrow" title="Optional - the person\'s real height makes the fit exact in size">Height <input type="number" id="dzHeight" min="50" max="250" placeholder="cm"></label>'
      // 2.988.0 (Tim: "can we add head, so the character looks like our character"): the head too - its face painted on top, its width / height / chin from the face
      + '<label class="dzrow" title="The head too: the face painted on top of the body, the head\'s width, its top and the chin shaped like the person\'s (the Vision model finds the eyes, mouth, chin, cheeks, top of the head)">🙂 Head <select id="dzHead"><option value="photo">from the photo\'s face</option><option value="close">from a close-up of the face (sharper)</option><option value="none">leave the figure\'s head</option></select></label><div id="dzHeadPick" hidden></div>'
      + '<label class="dzrow">Paint <select id="dzPaint"><option value="body">the photo into the whole body\'s textures</option><option value="face">the face only</option><option value="none">nothing (shape only)</option></select></label>'
      + '<div id="dzBOpts" hidden><label class="dzrow">3D engine <select id="dzEngine"><option value="auto">auto</option><option value="hunyuan">Hunyuan3D 2.1</option><option value="trellis">TRELLIS.2</option></select></label><label><input type="checkbox" id="dzTurn"> the scan faces away (turn it)</label></div>'
      + '<div class="hint">Light, not exact: a standing person, head to feet, facing the camera; loose clothing reads as body. The photo\'s clothes are painted too.</div>'
      + '<button type="button" class="primary" id="dzTry">▶ Try it</button></div></details>'
      + '<details id="dzMeasure"><summary title="Make this character\'s body from a height and a weight (and tape measurements if you have them) - a new character">📏 Height &amp; weight</summary><div class="dzph">'
      + '<div class="dzmg"><label>Height <input type="number" id="dzMH" min="40" max="260" step="0.5" placeholder="cm"></label><label>Weight <input type="number" id="dzMW" min="3" max="300" step="0.5" placeholder="kg"></label>'
      + '<label title="Round the chest at the armpits">Chest <input type="number" id="dzMC" min="30" max="250" placeholder="cm"></label><label title="Round the narrowest waist">Waist <input type="number" id="dzMWa" min="30" max="250" placeholder="cm"></label><label title="Round the widest hips">Hips <input type="number" id="dzMHi" min="30" max="250" placeholder="cm"></label></div>'
      + '<label class="dzrow" title="One weight fits many bodies - which dials carry it">Build <select id="dzMBuild"><option value="average">average</option><option value="slim">slim</option><option value="athletic">athletic</option><option value="soft">soft</option></select></label>'
      + '<div id="dzMNow" class="hint"></div><div style="display:flex;gap:6px"><button type="button" class="ghost" id="dzMRead" title="The picked character\'s height, weight and tape measurements now">📏 Measure it</button><button type="button" class="primary" id="dzMMake">▶ Make</button></div></div></details>'
      + '<div class="dzbtns"><button type="button" class="primary" id="dzBuild">🧍 Build</button><button type="button" class="ghost" id="dzPose" disabled title="The 🕺 Pose tab">🕺 Pose</button><button type="button" class="ghost" id="dzOpen" disabled title="A copy as plain Sketcher faces (static, no rig)">⤒ As faces</button><button type="button" class="ghost" id="dzSave">💾 Save</button></div></div>'
      + '<div class="dzhs" id="dzHSplit" role="separator" aria-orientation="horizontal" title="Drag to share the height"></div>'
      + '<div id="dzPar"><div class="dzhead"><b>🎚 Parameters</b><span id="dzParTabs" role="tablist"><button type="button" class="ghost on" data-tab="shape" role="tab">🎚 Shape</button><button type="button" class="ghost" data-tab="pose" role="tab">🕺 Pose</button><button type="button" class="ghost" data-tab="motion" role="tab">🎬 Motion</button></span></div>'
      + '<div id="dzShape" class="dzpane" data-pane="shape"><div class="dzrow" style="padding:3px 6px"><label title="Only the dials that are not 0"><input type="checkbox" id="dzChanged"> changed</label><button type="button" class="ghost dzx" id="dzReset" title="Every dial of this character back to 0">↺ all</button><button type="button" class="ghost dzx" id="dzApply" title="Build it again with these dials">🧍 Apply</button></div>'
      + '<input type="search" id="dzDialQ" placeholder="Find a dial (e.g. height, nose, muscular)…"><div id="dzDials"></div></div>'
      + '<div id="dzPosePane" class="dzpane" data-pane="pose" hidden><div class="hint" style="padding:3px 6px">Click the character in the view to pick a bone - or find it here:</div><input type="search" id="dzBoneQ" placeholder="Find a bone (e.g. forearm, thigh)…"><select id="dzBone" size="6"></select><div id="dzAxes"></div>'
      + '<div class="dzrow" style="padding:3px 6px;flex-wrap:wrap"><label><input type="checkbox" id="dzMirror" checked> Mirror</label><label title="The figure\'s own muscle shapes (JCMs) follow the joints"><input type="checkbox" id="dzPMus" checked> 💪 Muscles</label><button type="button" class="ghost dzx" id="dzPRBone">↺ bone</button><button type="button" class="ghost dzx" id="dzPRAll">↺ pose</button></div><div id="dzActive"></div></div>'
      + '<div id="dzMotionPane" class="dzpane" data-pane="motion" hidden><div class="hint" style="padding:3px 6px">From mixamo.com (a free account): pick an animation, ⤓ Download - Format <b>FBX</b>, Skin <b>Without Skin</b>. Royalty free in your projects; bitGen never shares the file.</div>'
      + '<div class="dzrow" style="padding:3px 6px"><button type="button" class="ghost" id="dzFbxB">📂 Mixamo .fbx…</button><input type="file" id="dzFbx" accept=".fbx" hidden></div>'
      + '<div class="dzax" id="dzMRow" hidden><button type="button" class="ghost dzx" id="dzMPlay">▶</button><input type="range" id="dzMTime" min="0" max="1" step="0.001" value="0"><output id="dzMTimeV">0.0 s</output></div>'
      + '<div class="dzrow" id="dzMOpts" hidden style="padding:3px 6px;flex-wrap:wrap"><label><input type="checkbox" id="dzMInPlace"> In place</label><label>Speed <select id="dzMSpeed"><option>0.5</option><option selected>1</option><option>2</option></select></label><button type="button" class="ghost dzx" id="dzMBake" title="A copy of the character with this motion (glTF) - the timeline\'s 3D layers / Blender play it">⤓ Bake</button><button type="button" class="ghost dzx" id="dzMOff">✕</button></div></div>'
      + '</div><div id="dzMsg" role="status"></div>';
    host.appendChild(L); host.appendChild(R);
    wire(); sizes(LS.get("w", {}));
    return true;
  }
  function sizes(w) {
    const d = $("pushpulldock"), side = $("dzSide"), lib = $("dzLib");
    if (d && w.r) d.style.setProperty("--dzr", Math.max(220, Math.min(800, w.r)) + "px");
    if (side && w.eh) side.style.setProperty("--dzeh", Math.max(15, Math.min(85, w.eh)) + "%");
    // 2.984.0: not moved yet - it starts over the VIEW (the ⚙ docker, ppdocks.js, may sit between the toolbox and the view)
    const vw = $("ppView"); if (lib && vw && !(w.lib && isFinite(w.lib.x))) lib.style.setProperty("--dzlx", (vw.offsetLeft + 8) + "px");
    if (lib && w.lib) { const L = w.lib; if (isFinite(L.x)) lib.style.setProperty("--dzlx", L.x + "px"); if (isFinite(L.y)) lib.style.setProperty("--dzly", L.y + "px"); if (L.w) lib.style.width = L.w + "px"; if (L.h) lib.style.height = L.h + "px"; }
    if (lib) lib.classList.toggle("folded", !!(w.lib && w.lib.folded));
  }
  function regrid() { try { const V = sceneV(); if (V && V.size) V.size(); } catch (e) { /* fine */ } try { root.dispatchEvent(new Event("resize")); } catch (e) { /* old */ } }
  const sceneV = () => { const P = root.H3PushPull; return P && P.state && P.state.V ? P.state.V : null; };
  const drag = (el, onMove, onUp) => (e) => {
    if (e.button !== 0) return; e.preventDefault(); el.classList.add("drag"); const x0 = e.clientX, y0 = e.clientY;
    const mv = (m) => onMove(m.clientX - x0, m.clientY - y0, m), up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); el.classList.remove("drag"); if (onUp) onUp(); };
    root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
  };
  function wire() {
    const sp = $("dzSplitR"); let w0 = 0;
    sp.addEventListener("pointerdown", (e) => { w0 = $("dzSide").getBoundingClientRect().width; drag(sp, (dx) => { const W = LS.get("w", {}); W.r = Math.max(220, Math.min(800, Math.round(w0 - dx))); LS.set("w", W); sizes(W); }, regrid)(e); });
    const hs = $("dzHSplit");
    hs.addEventListener("pointerdown", (e) => { const R = $("dzSide").getBoundingClientRect(); drag(hs, (dx, dy, m) => { const W = LS.get("w", {}); W.eh = Math.round((m.clientY - R.top) / R.height * 100); LS.set("w", W); sizes(W); })(e); });
    // the floating library: its title moves it (kept inside the Sketcher), its corner sizes it (kept)
    const lib = $("dzLib"), head = $("dzLibHead"); let p0 = null;
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const hr = $("ppMain").getBoundingClientRect(), lr = lib.getBoundingClientRect(); p0 = [lr.left - hr.left, lr.top - hr.top];
      drag(head, (dx, dy) => { const W = LS.get("w", {}); W.lib = Object.assign({}, W.lib, { x: Math.round(Math.max(0, Math.min(hr.width - 80, p0[0] + dx))), y: Math.round(Math.max(0, Math.min(hr.height - 30, p0[1] + dy))) }); LS.set("w", W); sizes(W); })(e);
    });
    head.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) foldLib(); });
    $("dzLibMin").onclick = foldLib;
    try { new root.ResizeObserver(() => { if (!st.on || lib.classList.contains("folded") || lib.closest("#ppDockCol")) return; const W = LS.get("w", {}), r = lib.getBoundingClientRect(); if (r.width < 50) return; W.lib = Object.assign({}, W.lib, { w: Math.round(r.width), h: Math.round(r.height) }); LS.set("w", W); }).observe(lib); } catch (e) { /* old browsers: not kept */ }
    $("dzRootsSave").onclick = saveRoots; $("dzRootsFind").onclick = () => { $("dzRoots").value = (st.detected || []).join("\n"); };
    $("dzParTabs").querySelectorAll("[data-tab]").forEach((b) => { b.onclick = () => tab(b.dataset.tab); });
    // 🕺 the pose tab
    let bq = 0; $("dzBoneQ").oninput = () => { clearTimeout(bq); bq = setTimeout(boneList, 200); };
    $("dzBone").onchange = () => pickBone($("dzBone").value);
    $("dzPMus").onchange = () => { const c = cur(); if (!c) return; c.muscles = $("dzPMus").checked; keep(); if (root.H3DazScene) root.H3DazScene.pose(c.id, null, { muscles: c.muscles }); activePaint(); };
    $("dzPRBone").onclick = () => { const c = cur(); if (!c || !st.bone) return; delete c.pose[st.bone]; const o = $("dzMirror").checked && mirrorOf(st.bone); if (o) delete c.pose[o]; poseApply(); axes(); };
    $("dzPRAll").onclick = () => { const c = cur(); if (!c) return; c.pose = {}; c.hips = [0, 0, 0]; c.figPose = { rot: { x: 0, y: 0, z: 0 }, move: [0, 0, 0] }; if (root.H3DazScene) root.H3DazScene.pose(c.id, null, { hips: c.hips, fig: c.figPose }); poseApply(); axes(); };
    // 🎬 the motion tab
    $("dzFbxB").onclick = () => $("dzFbx").click();
    $("dzFbx").onchange = async () => { const f = $("dzFbx").files[0]; $("dzFbx").value = ""; if (f) motionOpen(await f.arrayBuffer(), f.name).catch((e) => say("⚠ " + e.message)); };
    $("dzMPlay").onclick = () => { const M = mot(); if (M) motionPlay(!M.playing); };
    $("dzMTime").oninput = () => { const M = mot(); if (!M) return; motionPlay(false); root.H3DazScene.motion.at(+$("dzMTime").value * M.dur); };
    $("dzMInPlace").onchange = () => { const M = mot(); if (M) { M.inPlace = $("dzMInPlace").checked; root.H3DazScene.motion.at(M.t); } };
    $("dzMSpeed").onchange = () => { const M = mot(); if (M) M.speed = +$("dzMSpeed").value || 1; };
    $("dzMBake").onclick = async () => { try { say("⤓ baking…"); const j = await root.H3DazScene.motion.bake(); say("⤓ " + j.model + " - " + j.frames + " frames, in the project's 3D models (the timeline's 3D layers / Blender play it)"); st.lastBake = j; } catch (e) { say("⚠ " + e.message); } };
    $("dzMOff").onclick = () => { const M = mot(); root.H3DazScene.motion.off(); const c = M && st.scene.chars.find((x) => x.id === M.id); if (c) { c.pose = st.prePose || {}; root.H3DazScene.pose(c.id, c.pose); keep(); } motionUi(); axes(); say("✕ the motion is off - the pose it had before is back"); };
    // 🧭 the place of the picked character
    const placeIn = () => { const c = cur(); if (!c) return; c.place = { x: +$("dzPX").value || 0, y: +$("dzPY").value || 0, rot: +$("dzPR").value || 0 }; keep(); if (root.H3DazScene) root.H3DazScene.place(c.id, c.place); };
    ["dzPX", "dzPY", "dzPR"].forEach((id) => { $(id).onchange = placeIn; });
    $("dzShow").onchange = () => { const c = cur(); if (!c) return; c.hidden = !$("dzShow").checked; keep(); if (root.H3DazScene) root.H3DazScene.show(c.id, !c.hidden); };
    $("dzApply").onclick = buildChar;
    $("dzTabs").querySelectorAll("[data-kind]").forEach((b) => { b.onclick = () => { st.kind = b.dataset.kind; list(); }; });
    let qt = 0; $("dzQ").oninput = () => { clearTimeout(qt); qt = setTimeout(list, 300); };
    let dq = 0; $("dzDialQ").oninput = () => { clearTimeout(dq); dq = setTimeout(() => dialsLoad(true), 300); };
    $("dzRefresh").onclick = list;
    $("dzFolders").onclick = () => { const b = $("dzRootsBox"); b.hidden = !b.hidden; if (!b.hidden) loadRoots(); };
    $("dzOpts").querySelectorAll("[data-drape]").forEach((x) => { x.onchange = () => { const c = cur(); if (!c) return; const k = x.dataset.drape; c.drape.kinds = c.drape.kinds.filter((y) => y !== k).concat(x.checked ? [k] : []); keep(); }; });
    $("dzFrames").onchange = () => { const c = cur(); if (c) { c.drape.frames = Math.max(5, Math.min(240, +$("dzFrames").value || 45)); keep(); } };
    $("dzMuscle").onchange = () => { const c = cur(); if (c) { c.muscles = $("dzMuscle").checked; keep(); } };
    $("dzBuild").onclick = buildChar; $("dzPose").onclick = () => tab("pose"); $("dzOpen").onclick = openIt; $("dzSave").onclick = saveChar;
    $("dzChars").onchange = () => { const v = $("dzChars").value; $("dzChars").value = ""; if (v) loadChar(v); };
    $("dzChanged").onchange = () => { st.changedOnly = $("dzChanged").checked; dialsPaint(); };
    // 2.981.0: 📷 a body from a photo
    $("dzPhoto").addEventListener("toggle", () => { if ($("dzPhoto").open && !st.pick && root.H3PicPick) st.pick = root.H3PicPick.mount($("dzPhotoPick"), { title: "The photo (a person standing, head to feet)", onPick: (it) => { st.photo = it; say("📷 " + it.name + " - ▶ Try it"); } }); });
    $("dzHead").value = LS.get("head", "photo");
    $("dzHead").onchange = () => { LS.set("head", $("dzHead").value); $("dzHeadPick").hidden = $("dzHead").value !== "close"; if ($("dzHead").value === "close" && !st.headPick && root.H3PicPick) st.headPick = root.H3PicPick.mount($("dzHeadPick"), { title: "A close-up of the face (looking at the camera)", onPick: (it) => { st.headPhoto = it; say("🙂 the face: " + (it.name || "picked")); } }); };
    $("dzHeadPick").hidden = $("dzHead").value !== "close";
    $("dzBackOn").onchange = () => { $("dzBackPick").hidden = !$("dzBackOn").checked; if ($("dzBackOn").checked && !st.backPick && root.H3PicPick) st.backPick = root.H3PicPick.mount($("dzBackPick"), { title: "The back photo", onPick: (it) => { st.back = it; } }); };
    $("dzRoute").onchange = () => { $("dzBOpts").hidden = $("dzRoute").value !== "B"; LS.set("route", $("dzRoute").value); };
    $("dzRoute").value = LS.get("route", "A") === "B" ? "B" : "A"; $("dzBOpts").hidden = $("dzRoute").value !== "B";
    $("dzTry").onclick = () => tryIt($("dzRoute").value);
    $("dzMRead").onclick = () => measureIt().catch((e) => say("⚠ " + e.message));
    $("dzMMake").onclick = () => makeFromMeasures().catch((e) => { st.busy = false; tree(); say("⚠ 📏 " + e.message); });
    $("dzReset").onclick = () => { const c = cur(); if (!c) return; c.dials = {}; keep(); dialsPaint(); say("↺ every dial of " + c.name + " back to 0"); };
  }
  /* ---------------- 📚 the library */
  async function list() {
    if (!$("dzGrid")) return;
    $("dzTabs").querySelectorAll("[data-kind]").forEach((b) => b.classList.toggle("on", b.dataset.kind === st.kind));
    const g = $("dzGrid"); g.textContent = "…";
    let j; try { j = await jget("/api/dazlib/scan?kind=" + encodeURIComponent(st.kind) + "&q=" + encodeURIComponent($("dzQ").value || "") + "&limit=400"); } catch (e) { g.textContent = "⚠ " + e.message; return; }
    $("dzEnc").textContent = j.encrypted ? "🔒 " + j.encrypted + " encrypted item(s) skipped - only Daz Studio can read them" : "";
    g.innerHTML = j.items.length ? "" : '<span class="hint">nothing here - ' + (j.roots.length ? "another kind or search" : "📁 to point bitGen at your Daz library") + "</span>";
    const c = cur();
    j.items.forEach((it) => {
      const b = doc.createElement("div"); b.className = "dzit"; b.title = it.rel + (["figure", "character"].includes(it.kind) ? " - drag it into the 3D view (or click) - a new character in the scene" : it.kind === "pose" ? " - click / drag onto a character: its pose" : it.kind === "shape" ? " - click: its dials on the picked character" : " - click / drag onto a character: worn (again = taken off)");
      b.dataset.rel = it.rel;
      b.innerHTML = (it.thumb ? '<img loading="lazy" alt="" draggable="false" src="/api/dazlib/thumb?root=' + encodeURIComponent(it.root) + "&rel=" + encodeURIComponent(it.thumb) + '">' : '<img alt="" draggable="false">') + "<span>" + esc(it.name) + "</span>";
      if (c && c.fig.rel === it.rel) b.classList.add("fig");
      if (c && c.wear.some((w) => w.rel === it.rel)) b.classList.add("worn");
      b.onclick = () => libClick(it);
      b.draggable = true; b.addEventListener("dragstart", (e) => { st.dragIt = it; try { e.dataTransfer.setData("application/x-h3-daz", JSON.stringify(it)); e.dataTransfer.setData("text/plain", it.name); e.dataTransfer.effectAllowed = "copy"; } catch (x) { /* fine */ } });
      g.appendChild(b);
    });
  }
  /** the tiles re-marked in place (figure / worn) - no re-listing, so the grid never flickers */
  function marks() {
    const c = cur(); for (const b of doc.querySelectorAll("#dzGrid .dzit")) { b.classList.toggle("fig", !!c && c.fig.rel === b.dataset.rel); b.classList.toggle("worn", !!c && c.wear.some((w) => w.rel === b.dataset.rel)); }
  }
  /** a library item used: a figure / character = a new character placed in the scene (at = [x, y] where it was dropped);
   *  a pose / shape preset = on the picked (or dropped-on) character; anything else = worn by it (again = taken off) */
  async function libClick(it, at, onId) {
    if (["figure", "character"].includes(it.kind)) {
      const n = st.scene.chars.filter((c) => c.fig.rel === it.rel).length + 1, c = newChar(it, n);
      c.place = at ? { x: +at[0].toFixed(3), y: +at[1].toFixed(3), rot: 0 } : freeSpot(st.scene.chars); c.inScene = true;
      st.scene.chars.push(c); st.scene.sel = c.id; keep(); tree(); dialsLoad(); list();
      say("🧍 " + c.name + " - building it into the scene…"); await buildChar(); return c;
    }
    if (onId && onId !== st.scene.sel) { st.scene.sel = onId; keep(); tree(); dialsLoad(); }
    const c = cur(); if (!c) { say("pick a character first (drag a 🧍 figure into the 3D view)"); return null; }
    if (it.kind === "pose") return applyPreset(c, it);
    if (it.kind === "shape") return applyPreset(c, it);
    const on = wearToggle(c, it); keep(); tree(); marks(); say((on ? "👕 " + c.name + " wears " : "✕ " + c.name + " took off ") + it.name + (c.last ? " - building…" : ""));
    if (c.last) rebuildSoon(c);
    return c;
  }
  let rebuildT = 0;
  function rebuildSoon(c) { clearTimeout(rebuildT); rebuildT = root.setTimeout(() => { if (cur() === c) buildChar(); }, 450); }
  async function applyPreset(c, it) {
    let j; try { j = await jget("/api/dazlib/preset?root=" + encodeURIComponent(it.root) + "&rel=" + encodeURIComponent(it.rel)); } catch (e) { say("⚠ " + e.message); return null; }
    if (j.kind === "shape") { j.dials.forEach((d) => { if (+d.value) c.dials[d.url] = +d.value; else delete c.dials[d.url]; }); keep(); dialsPaint(); say("🎚 " + it.name + ": " + j.dials.length + " dial(s) on " + c.name + (c.last ? " - building…" : "")); if (c.last) rebuildSoon(c); return c; }
    const r = root.H3DazScene && root.H3DazScene.rig(c.id);
    if (!r) { say("🕴 build " + c.name + " into the scene first - a pose needs its bones"); return null; }
    const pk = posePick(j.pose, r.daz.bones); c.pose = pk.pose;
    c.hips = j.hips ? j.hips.map((v) => v * 0.01) : [0, 0, 0];                       // 2.985.0: kept with the character (cm -> m)
    c.figPose = { rot: (j.fig && j.fig.rot) || { x: 0, y: 0, z: 0 }, move: j.fig && j.fig.move ? j.fig.move.map((v) => v * 0.01) : [0, 0, 0] };
    keep();
    root.H3DazScene.pose(c.id, c.pose, { hips: c.hips, fig: c.figPose });
    tab("pose"); axes(); activePaint();
    say("🕴 " + it.name + ": " + pk.n + " of " + j.n + " bone turn(s) on " + c.name + (pk.n < j.n ? " (the rest are for another figure)" : ""));
    return c;
  }
  /* ---------------- 🧭 the explorer */
  function tree() {
    const t = $("dzTree"); if (!t) return;
    const chars = st.scene.chars;
    t.innerHTML = chars.length ? "" : '<span class="hint">No characters yet - click a figure or a character in the 📚 DAZ Library.</span>';
    chars.forEach((c) => {
      const row = doc.createElement("div"); row.className = "dzc" + (c.id === st.scene.sel ? " sel" : ""); row.setAttribute("role", "treeitem"); row.dataset.char = c.id;
      row.innerHTML = "<span title=\"Double-click to rename\">🧍 " + esc(c.name) + (c.last ? ' <small style="opacity:.6">✔</small>' : "") + '</span><button type="button" class="ghost dzx" data-del title="Remove this character from the explorer">✕</button>';
      row.onclick = (e) => { if (e.target.closest("[data-del]")) return; if (st.scene.sel !== c.id) pickChar(c.id); };
      row.ondblclick = () => rename(row, c);
      row.querySelector("[data-del]").onclick = () => { st.scene.chars = st.scene.chars.filter((x) => x !== c); if (root.H3DazScene) root.H3DazScene.remove(c.id); if (st.scene.sel === c.id) st.scene.sel = st.scene.chars[0] ? st.scene.chars[0].id : ""; keep(); tree(); dialsLoad(); list(); if (root.H3DazScene) root.H3DazScene.select(st.scene.sel); };
      t.appendChild(row);
      const comps = [{ name: c.fig.name, kind: c.fig.kind, fig: true }].concat(c.wear);
      comps.forEach((w) => {
        const k = doc.createElement("div"); k.className = "dzcomp"; k.setAttribute("role", "treeitem");
        const ic = w.fig ? "🦴" : w.kind === "hair" ? "💇" : w.kind === "anatomy" ? "🫀" : w.kind === "material" ? "🎨" : "👕";
        k.innerHTML = "<span title=\"" + esc(w.rel || c.fig.rel) + "\">" + ic + " " + esc(w.name) + (w.fig ? ' <small style="opacity:.6">(figure)</small>' : "") + "</span>" + (w.fig ? "" : '<button type="button" class="ghost dzx" title="Take it off">✕</button>');
        const x = k.querySelector("button"); if (x) x.onclick = () => { wearToggle(c, w); keep(); tree(); marks(); if (c.last && cur() === c) rebuildSoon(c); };   // 2.985.0: off the model too
        t.appendChild(k);
      });
      // 2.985.0: what the built model really has - the figure, its eyes / mouth / grafts, hair, clothes - each shown or hidden
      const P = root.H3DazScene && root.H3DazScene.rig(c.id) ? root.H3DazScene.pieces(c.id) : [];
      if (P.length) {
        const h = doc.createElement("div"); h.className = "dzcomp dzpieces"; h.innerHTML = '<span style="opacity:.7">In the model (' + P.length + "):</span>"; t.appendChild(h);
        P.forEach((q) => {
          const k = doc.createElement("label"); k.className = "dzcomp dzpiece"; k.dataset.piece = q.name;
          k.innerHTML = '<input type="checkbox"' + (q.shown ? " checked" : "") + ' title="Show / hide it in the 3D view"><span>' + (PIECE_ICON[q.kind] || "📦") + " " + esc(q.name) + ' <small style="opacity:.6">(' + esc(q.kind === "graft" ? "graft" : q.kind) + ")</small></span>";
          k.querySelector("input").onchange = (e) => { root.H3DazScene.pieceShow(c.id, q.name, e.target.checked); const r = root.H3DazScene.rig(c.id); c.hidePieces = r ? [...r.hidden] : []; keep(); };
          t.appendChild(k);
        });
      }
      if ((c.warn || []).length) { const w = doc.createElement("div"); w.className = "dzcomp dzwarn"; w.title = c.warn.join("\n"); w.innerHTML = "<span>⚠ " + esc(c.warn[0]) + (c.warn.length > 1 ? " (+" + (c.warn.length - 1) + ")" : "") + "</span>"; t.appendChild(w); }
    });
    const c = cur();
    $("dzOpts").querySelectorAll("[data-drape]").forEach((x) => { x.checked = !!c && c.drape.kinds.includes(x.dataset.drape); x.disabled = !c; });
    $("dzFrames").value = c ? c.drape.frames : 45; $("dzMuscle").checked = !c || c.muscles !== false;
    $("dzBuild").disabled = !c || st.busy; $("dzPose").disabled = !c || !c.last; $("dzOpen").disabled = !c || !c.last; $("dzSave").disabled = !c;
    const inS = !!(c && root.H3DazScene && root.H3DazScene.rig(c.id)); $("dzPlace").hidden = !inS;
    if (inS) { $("dzPX").value = c.place.x; $("dzPY").value = c.place.y; $("dzPR").value = c.place.rot; $("dzShow").checked = !c.hidden; }
    $("dzPMus").checked = !c || c.muscles !== false;
  }
  function rename(row, c) {
    const sp = row.querySelector("span"), inp = doc.createElement("input"); inp.value = c.name; sp.replaceWith(inp); inp.focus(); inp.select();
    const done = (ok) => { if (ok && inp.value.trim()) c.name = inp.value.trim().slice(0, 60); keep(); tree(); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") done(true); else if (e.key === "Escape") done(false); };
    inp.onblur = () => done(true);
  }
  async function buildChar() {
    const c = cur(); if (!c || st.busy) return;
    st.busy = true; tree(); say("🧍 building " + c.name + "…");
    try {
      const j = await jpost("/api/dazlib/build", { root: c.fig.root, rel: c.fig.rel, dials: Object.keys(c.dials).filter((u) => +c.dials[u]).map((u) => ({ url: u, value: +c.dials[u] })),
        wear: c.wear.map((w) => ({ root: w.root, rel: w.rel })), drape: c.drape.kinds.length ? { kinds: c.drape.kinds, frames: c.drape.frames } : false, muscles: c.muscles !== false, name: c.name.replace(/[^A-Za-z0-9 _-]+/g, " ").replace(/\s+/g, " ").trim(),
        custom: c.custom || [], paint: c.paint || null, face: c.face && c.face.picture ? { picture: c.face.picture, where: c.face.where } : null });
      c.last = j.model; c.inScene = true; c.warn = (j.info.warnings || []).slice(0, 6); keep();
      const mu = j.info.muscles || {};
      try { if (sceneV() && root.H3DazScene) { await root.H3DazScene.put(c); root.H3DazScene.select(c.id); } } catch (e) { say("⚠ " + e.message); }
      const fs0 = j.info.face && (j.info.face.face || j.info.face), hw = fs0 && fs0.chin_scale != null ? " · 🙂 head: width ×" + (fs0.head_width || 1) + ", top ×" + (fs0.head_top || 1) + ", chin ×" + fs0.chin_scale : "";   // 2.988.0
      say("✔ " + j.model + hw + " - " + j.info.pieces.length + " piece(s), " + j.info.bones + " bones" + (mu.kind === "jcm" ? ", 💪 " + mu.shapes + " JCMs" : mu.kind === "flex" ? ", 💪 our flex" : "") + (j.info.warnings.length ? " · ⚠ " + j.info.warnings.slice(0, 2).join("; ") : ""));
    } catch (e) { say("⚠ " + e.message); }
    st.busy = false; tree();
  }
  /* ---------------- 📷 a body from a photo: A fit the dials / B scan + wrap (lib/dazBodyFit.js) - each try = a new character */
  const sleep = (ms) => new Promise((r) => root.setTimeout(r, ms));
  async function tryIt(route) {
    const base = cur(); if (!base) { say("pick a character first - its figure is the one shaped (click a figure in the 📚 DAZ Library)"); return; }
    if (!st.photo) { say("📷 pick the photo first (🖼 Gallery, 🗂 Assets, 📌 References, 📁 a folder, 📄 a file)"); return; }
    if (st.busy) return; st.busy = true; tree(); $("dzTry").disabled = true;
    const paint = $("dzPaint").value, PP = root.H3PicPick;
    try {
      say("📷 putting the photo into the project…");
      const ph = await PP.toProject(st.photo), bk = $("dzBackOn").checked && st.back ? await PP.toProject(st.back) : null;
      const markOf = async (p, side) => { say("📷 finding the body in the " + side + " photo (the Vision model)…"); const m = await jpost("/api/dazlib/body/marks", { picture: p.name, where: p.where }); return { picture: p.name, where: p.where, points: m.points, w: m.w, h: m.h, side }; };
      const dialsNow = Object.keys(base.dials).filter((u) => +base.dials[u]).map((u) => ({ url: u, value: +base.dials[u] }));
      const n = st.scene.chars.filter((x) => x.name.indexOf(base.name + " · 📷 " + route) === 0).length + 1, c = tryChar(base, route, n);
      let front = null, back = null;
      if (route === "A" || paint === "face") front = await markOf(ph, "front");       // B paints the body from its scan
      if (route === "A" && bk && paint === "body") back = await markOf(bk, "back");
      let report = "";
      if (route === "A") {
        say("📷 A: fitting " + base.name + "'s body dials to the photo…");
        const f = await jpost("/api/dazlib/body/fit", { root: base.fig.root, rel: base.fig.rel, dials: dialsNow, points: front.points, w: front.w, h: front.h, height_cm: +$("dzHeight").value || 0 });
        c.dials = {}; f.dials.forEach((d) => { c.dials[d.url] = d.value; });
        report = "A: " + f.changed.length + " dial(s) moved, the proportions off by " + Math.round(f.error.before * 100) + "% -> " + Math.round(f.error.after * 100) + "%";
        if (paint === "body") c.paint = { mode: "photo", photos: [front].concat(back ? [back] : []) }; else if (paint === "face") c.paint = { mode: "face", photos: [front] };
      } else {
        const engine = $("dzEngine").value, MF = root.H3ModelsFound;
        if (MF) { say("📷 B: checking the 3D engine's models…"); let need = null; try { need = await jget("/api/picscene/needs?engine=" + encodeURIComponent(engine) + "&sound=0"); } catch (e) { need = null; } if (need && need.files && need.files.length && !(await MF.ensure({ files: need.files, from: "Body from a photo" }))) throw new Error("not started - the 3D engine's models are missing (⬇ Download them, then ▶ Try again)"); }
        const sj = await jpost("/api/dazlib/body/scan", { picture: ph.name, where: ph.where, engine, name: base.name });
        for (let t = 0; ; t++) {
          let j = null; try { j = await jget("/api/jobs/" + encodeURIComponent(sj.job)); } catch (e) { j = null; }
          if (j && j.status === "done") break;
          if (j && /failed|cancel/.test(j.status)) throw new Error("the 3D shape did not come (the job " + sj.job + " " + j.status + (j.error ? ": " + j.error : "") + ")");
          say("📷 B: making the 3D shape from the photo (" + ((j && j.status) || "queued") + ", " + t * 2 + " s)…"); await sleep(2000);
        }
        say("📷 B: wrapping " + base.name + " onto the 3D shape…");
        const w = await jpost("/api/dazlib/body/wrap", { root: base.fig.root, rel: base.fig.rel, dials: dialsNow, scan: sj.model, turn: $("dzTurn").checked, name: c.name.replace(/[^A-Za-z0-9 _-]+/g, " ").replace(/\s+/g, " ").trim() });
        c.custom = (c.custom || []).concat([w.custom]);
        report = "B: " + w.moved_vertices + " vertices moved (" + w.moved_mm + " mm on average) - your morph \"" + w.custom + "\"";
        if (paint === "body") c.paint = { mode: "scan", scan: sj.model, align: w.align }; else if (paint === "face" && front) c.paint = { mode: "face", photos: [front] };
      }
      st.scene.chars.push(c); st.scene.sel = c.id; keep(); st.busy = false; tree(); dialsLoad(); list();
      // 2.988.0: 🙂 the head - the photo's face (or a close-up): its face painted on top, its head shaped (dazFace)
      const head = $("dzHead").value;
      if (head === "close" && !st.headPhoto) say("🙂 no close-up picked - the head from the photo's face");
      c.face = head === "none" ? null : await (async () => { const hp = head === "close" && st.headPhoto ? await PP.toProject(st.headPhoto) : ph; return { picture: hp.name, where: hp.where }; })();
      if (c.face && c.paint && c.paint.mode === "face") c.paint = null;          // the head step does the face
      keep();
      say("📷 " + report + (c.face ? " + 🙂 the head" : "") + " - building…");
      await buildChar();
      say("📷 " + c.name + " - " + report + ". Compare it with the other try (🕺 Pose), ✕ the one you don't keep. " + ($("dzMsg").textContent.indexOf("⚠") >= 0 ? $("dzMsg").textContent : ""));
      st.lastTry = { route, name: c.name, report };
    } catch (e) { say("⚠ 📷 " + e.message); }
    st.busy = false; $("dzTry").disabled = false; tree();
  }
  /* ---------------- 📏 2.982.0: height, weight, tape measurements -> the figure's own body dials (a new character) */
  const fmtM = (m) => !m ? "" : [m.height ? m.height.toFixed(1) + " cm" : "", m.weight ? m.weight.toFixed(1) + " kg" : "", m.chest ? "chest " + m.chest.toFixed(0) : "", m.waist ? "waist " + m.waist.toFixed(0) : "", m.hips ? "hips " + m.hips.toFixed(0) + " cm" : ""].filter(Boolean).join(" · ");
  const dialsOf = (c) => Object.keys(c.dials).filter((u) => +c.dials[u]).map((u) => ({ url: u, value: +c.dials[u] }));
  async function measureIt() {
    const c = cur(); if (!c) { say("pick a character first"); return null; }
    $("dzMNow").textContent = "📏 measuring…";
    const j = await jpost("/api/dazlib/body/measures", { root: c.fig.root, rel: c.fig.rel, dials: dialsOf(c), measure_only: true });
    $("dzMNow").textContent = "Now: " + fmtM(j.now) + " (the weight from its volume - a guide)"; return j.now;
  }
  async function makeFromMeasures() {
    const base = cur(); if (!base) { say("pick a character first - its figure is the one shaped"); return; }
    const target = { height: +$("dzMH").value || 0, weight: +$("dzMW").value || 0, chest: +$("dzMC").value || 0, waist: +$("dzMWa").value || 0, hips: +$("dzMHi").value || 0 };
    if (!Object.values(target).some((x) => x > 0)) { say("📏 type a height and / or a weight (tape measurements if you have them)"); return; }
    if (st.busy) return; st.busy = true; tree(); say("📏 fitting " + base.name + "'s body dials…");
    const j = await jpost("/api/dazlib/body/measures", { root: base.fig.root, rel: base.fig.rel, dials: dialsOf(base), target, build: $("dzMBuild").value });
    const tag = [target.height ? target.height + " cm" : "", target.weight ? target.weight + " kg" : ""].filter(Boolean).join(" ") || "measured";
    const c = tryChar(base, "📏", 1); c.name = base.name + " · 📏 " + tag; c.from = "measures"; c.dials = {}; j.dials.forEach((d) => { c.dials[d.url] = d.value; });
    st.scene.chars.push(c); st.scene.sel = c.id; keep(); st.busy = false; tree(); dialsLoad(); list();
    const rep = "📏 " + j.changed.length + " dial(s) moved: " + fmtM(j.before) + " → " + fmtM(j.after);
    $("dzMNow").textContent = rep; say(rep + " - building…");
    await buildChar();
    say(rep + " · " + ($("dzMsg").textContent.indexOf("⚠") >= 0 ? $("dzMsg").textContent : "built - 🕺 Pose to see it"));
    st.lastMeasure = j; return j;
  }
  function pose() { tab("pose"); }
  async function openIt() {
    const c = cur(), P = root.H3PushPull; if (!c || !c.last) return;
    if (!P || !P.importModel || !P.state || !P.state.V) { say("open the Sketcher first (📏) - its 3D view loads with it"); return; }
    try { await P.importModel(c.last); say("⤒ " + c.last + " is in the Sketcher model"); } catch (e) { say("⚠ " + e.message + " - 🕺 Pose still shows it"); }
  }
  async function chars() { const s = $("dzChars"); if (!s) return; try { const j = await jget("/api/dazlib/chars"); s.innerHTML = '<option value="">📂 Saved…</option>' + j.chars.map((x) => "<option>" + esc(x.name) + "</option>").join(""); } catch (e) { /* fine */ } }
  async function saveChar() {
    const c = cur(); if (!c) return;
    try {
      const j = await jpost("/api/dazlib/chars", { name: c.name, spec: { root: c.fig.root, rel: c.fig.rel, figName: c.fig.name, dials: Object.keys(c.dials).map((u) => ({ url: u, value: +c.dials[u] })), wear: c.wear, drape: c.drape.kinds.length ? c.drape : false } });
      say("💾 " + j.name + " saved in the project (📂 Saved… brings it back; the 📚 dialog lists it too)"); chars();
    } catch (e) { say("⚠ " + e.message); }
  }
  async function loadChar(name) {
    try {
      const s = await jget("/api/dazlib/chars/" + encodeURIComponent(name));
      const c = newChar({ root: s.root, rel: s.rel, name: s.figName || name, kind: "figure" }, 1); c.name = name;
      (s.dials || []).forEach((d) => { if (+d.value) c.dials[d.url] = +d.value; });
      c.wear = (s.wear || []).map((w) => ({ root: w.root, rel: w.rel, name: w.name || String(w.rel).split("/").pop().replace(/\.duf$/i, ""), kind: w.kind || (/hair/i.test(w.rel) ? "hair" : "clothing") }));
      if (s.drape && s.drape.kinds) c.drape = { kinds: s.drape.kinds, frames: s.drape.frames || 45 };
      st.scene.chars.push(c); st.scene.sel = c.id; keep(); tree(); dialsLoad(); list(); say("📂 " + name + " in the explorer - 🧍 Build to make it");
    } catch (e) { say("⚠ " + e.message); }
  }
  /* ---------------- 🎚 the shape controls */
  async function dialsLoad(typed) {
    const c = cur(), box = $("dzDials"); if (!box) return;
    if (!c) { st.dialList = []; st.dialFor = ""; box.innerHTML = '<span class="hint">pick a character in the explorer</span>'; return; }
    const q = $("dzDialQ").value || "", key = c.fig.root + "|" + c.fig.rel + "|" + q;
    if (!typed && st.dialFor === key) { dialsPaint(); return; }
    box.textContent = "…";
    try { const j = await jget("/api/dazlib/dials?root=" + encodeURIComponent(c.fig.root) + "&rel=" + encodeURIComponent(c.fig.rel) + "&q=" + encodeURIComponent(q) + "&limit=600"); st.dialList = j.dials || []; st.dialFor = key; dialsPaint(); }
    catch (e) { box.textContent = "⚠ " + e.message; }
  }
  function dialsPaint() {
    const c = cur(), box = $("dzDials"); if (!box || !c) return;
    const open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.group));
    const L = st.changedOnly ? st.dialList.filter((d) => +c.dials[d.url]) : st.dialList;
    const G = groupDials(L);
    box.innerHTML = G.length ? "" : '<span class="hint">' + (st.changedOnly ? "no dial changed yet" : "no dials found (search another word)") + "</span>";
    G.forEach((g, gi) => {
      const det = doc.createElement("details"); det.dataset.group = g.group; if (open.has(g.group) || G.length <= 2 || st.changedOnly || ($("dzDialQ").value && gi < 4)) det.open = true;
      const set = g.dials.filter((d) => +c.dials[d.url]).length;
      det.innerHTML = "<summary>" + esc(g.group) + " <small style=\"opacity:.6\">" + g.dials.length + (set ? " · " + set + " set" : "") + "</small></summary>";
      g.dials.forEach((d) => {
        const v = +c.dials[d.url] || 0, row = doc.createElement("label"); row.className = "dzdial" + (v ? " set" : ""); row.title = d.label + " (" + d.group + ") - double-click = 0";
        row.innerHTML = "<span>" + esc(d.label) + '</span><input type="range" min="' + d.min + '" max="' + d.max + '" step="0.01" value="' + v + '"><output>' + v.toFixed(2) + "</output>";
        row.dataset.url = d.url;
        const r = row.querySelector("input");
        r.oninput = () => { const x = +r.value; if (x) c.dials[d.url] = x; else delete c.dials[d.url]; row.querySelector("output").textContent = x.toFixed(2); row.classList.toggle("set", !!x); keep(); };
        r.onchange = () => say("🎚 " + d.label + " " + (+r.value).toFixed(2) + " - 🧍 Build to see it");
        r.ondblclick = () => { r.value = 0; r.oninput(); };
        det.appendChild(row);
      });
      box.appendChild(det);
    });
  }
  /* ---------------- 2.983.0: the scene, the tabs, posing, motion */
  function foldLib() { const W = LS.get("w", {}); W.lib = Object.assign({}, W.lib, { folded: !(W.lib && W.lib.folded) }); LS.set("w", W); const lib = $("dzLib"); if (W.lib.folded) { lib.dataset.h = lib.style.height; lib.style.height = "auto"; lib.style.resize = "none"; } else { lib.style.height = lib.dataset.h || ""; lib.style.resize = ""; } [...lib.children].forEach((x) => { if (x.id !== "dzLibHead") x.style.display = W.lib.folded ? "none" : ""; }); if (!W.lib.folded) $("dzRootsBox").hidden = true; }
  async function loadRoots() { try { const j = await jget("/api/dazlib"); st.detected = j.detected || []; $("dzRoots").value = (j.roots || []).join("\n"); } catch (e) { say("⚠ " + e.message); } }
  async function saveRoots() { try { await jpost("/api/dazlib/roots", { roots: $("dzRoots").value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) }); $("dzRootsBox").hidden = true; say("📁 saved - reading the library…"); list(); } catch (e) { say("⚠ " + e.message); } }
  function tab(t) {
    st.tab = ["shape", "pose", "motion"].includes(t) ? t : "shape";
    $("dzParTabs").querySelectorAll("[data-tab]").forEach((b) => { b.classList.toggle("on", b.dataset.tab === st.tab); b.setAttribute("aria-selected", b.dataset.tab === st.tab ? "true" : "false"); });
    doc.querySelectorAll("#dzPar [data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== st.tab; });
    if (st.tab === "pose") { boneList(); axes(); activePaint(); } if (st.tab === "motion") motionUi();
  }
  const rigOf = (c) => (c && root.H3DazScene ? root.H3DazScene.rig(c.id) : null);
  function mirrorOf(id) { const c = cur(), r = rigOf(c), F = root.H3DazFormula; if (!r || !F) return ""; const m = F.mirrorName(id); return m && r.daz.bones[m] ? m : ""; }
  function boneList() {
    const sel = $("dzBone"), r = rigOf(cur()), q = ($("dzBoneQ").value || "").toLowerCase(); if (!r || !root.H3DazPose) { sel.innerHTML = ""; return; }
    const T = root.H3DazPose.boneTree(r.daz.bones).filter((x) => !q || (x.id + " " + (r.daz.bones[x.id].label || "")).toLowerCase().includes(q)), c = cur();
    sel.innerHTML = T.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === st.bone ? " selected" : "") + ">" + "\u00a0\u00a0".repeat(Math.min(12, q ? 0 : x.depth)) + esc(r.daz.bones[x.id].label || x.id) + (c.pose[x.id] ? " •" : "") + "</option>").join("");
  }
  function pickBone(id) { const r = rigOf(cur()); if (!r || !r.daz.bones[id]) return; st.bone = id; tab("pose"); say("🦴 " + (r.daz.bones[id].label || id) + (mirrorOf(id) ? " (mirrored: " + mirrorOf(id) + ")" : "")); }
  function axes() {
    const box = $("dzAxes"), c = cur(), r = rigOf(c); if (!box) return;
    if (!r || !st.bone || !r.daz.bones[st.bone]) { box.innerHTML = '<span class="hint" style="padding:0 6px">' + (r ? "pick a bone" : "build the character into the scene first") + "</span>"; return; }
    const v = c.pose[st.bone] || {};
    box.innerHTML = root.H3DazPose.axisRows(r.daz.bones[st.bone]).map((a) => '<label class="dzax"><span>' + a.label + '</span><input type="range" data-ax="' + a.ax + '" min="' + a.min + '" max="' + a.max + '" step="0.5" value="' + (+v[a.ax] || 0) + '"><output>' + (+v[a.ax] || 0).toFixed(1) + "°</output></label>").join("");
    box.querySelectorAll("input[data-ax]").forEach((inp) => {
      inp.oninput = () => { const rr = Object.assign({ x: 0, y: 0, z: 0 }, c.pose[st.bone]); rr[inp.dataset.ax] = +inp.value; c.pose[st.bone] = rr; const o = $("dzMirror").checked && mirrorOf(st.bone); if (o) c.pose[o] = root.H3DazFormula.mirrorRot(rr); inp.nextElementSibling.textContent = (+inp.value).toFixed(1) + "°"; poseApply(); };
      inp.ondblclick = () => { inp.value = 0; inp.oninput(); };
    });
  }
  let keepT = 0;
  function poseApply() { const c = cur(); if (!c || !root.H3DazScene) return; root.H3DazScene.pose(c.id, c.pose); activePaint(); clearTimeout(keepT); keepT = root.setTimeout(keep, 300); }
  function activePaint() {
    const r = rigOf(cur()), box = $("dzActive"); if (!box) return;
    const top = r && root.H3DazPose ? root.H3DazPose.topActive(r.weights, 6) : [];
    box.innerHTML = top.length ? '<div class="hint" style="padding:0 6px">💪 working now:</div>' + top.map((t) => '<div class="dzact"><span>' + esc(t.id) + '</span><em><i style="width:' + Math.min(100, Math.abs(t.v) * 100).toFixed(0) + '%"></i></em></div>').join("") : "";
  }
  const mot = () => (root.H3DazScene ? root.H3DazScene.motion.state() : null);
  async function motionOpen(buf, name) {
    const c = cur(); if (!rigOf(c)) throw new Error("pick a character in the scene first (drag a 🧍 figure into the 3D view)");
    st.prePose = JSON.parse(JSON.stringify(c.pose || {}));
    const M = await root.H3DazScene.motion.load(c.id, buf, name); M.inPlace = $("dzMInPlace").checked; M.speed = +$("dzMSpeed").value || 1;
    motionUi(); say("🎬 " + name + " on " + c.name + " - " + M.mapped + " bones matched - ▶ plays it"); motionPlay(true); return M;
  }
  function motionPlay(on) { root.H3DazScene.motion.play(on); motionUi(); }
  function motionUi() { const M = mot(); ["dzMRow", "dzMOpts"].forEach((id) => { $(id).hidden = !M; }); if (M) $("dzMPlay").textContent = M.playing ? "⏸" : "▶"; }
  function sceneChanged(why) {
    const M = mot(); if (M && (why === "motion")) { const t = $("dzMTime"); if (t && doc.activeElement !== t) t.value = M.dur ? M.t / M.dur : 0; $("dzMTimeV").textContent = M.t.toFixed(1) + " s"; if (st.tab === "pose" && !M.playing) activePaint(); }
  }
  /** 2.985.0 (Tim: "del button deletes the selected object including the daz characters"): the character picked in the view
      (its blue box) leaves the scene and the explorer - ↶ in the message brings it back */
  function deleteSel() {
    const S = root.H3DazScene, id = S && S.sel(); if (!st.on || !id) return false;
    const i = st.scene.chars.findIndex((x) => x.id === id); if (i < 0) return false;
    const c = st.scene.chars[i], r = S.rig(id); if (r && r.place) c.place = Object.assign({}, r.place);   // where it stood (for ↶)
    st.scene.chars.splice(i, 1); S.remove(id); S.select("", true);
    if (st.scene.sel === id) st.scene.sel = st.scene.chars[0] ? st.scene.chars[0].id : "";
    keep(); tree(); dialsLoad(); marks();
    st.deleted = { c, i };
    const m = $("dzMsg"); if (m) { m.innerHTML = ""; m.append("🗑 " + c.name + " deleted "); const u = doc.createElement("button"); u.type = "button"; u.className = "ghost"; u.id = "dzUndoDel"; u.textContent = "↶ Undo"; u.onclick = undoDelete; m.appendChild(u); }
    const P = root.H3PushPull; if (P && P.msg) P.msg("🗑 " + c.name + " deleted (the DAZ character) - ↶ Undo in the DAZ Explorer");
    return true;
  }
  async function undoDelete() {
    const d = st.deleted; if (!d) return; st.deleted = null;
    st.scene.chars.splice(Math.min(d.i, st.scene.chars.length), 0, d.c); st.scene.sel = d.c.id; keep(); tree(); dialsLoad(); marks();
    try { if (d.c.last && d.c.inScene && sceneV()) { await root.H3DazScene.put(d.c); root.H3DazScene.select(d.c.id); } } catch (e) { say("⚠ " + e.message); return; }
    say("↶ " + d.c.name + " is back"); tree();
  }
  function pickChar(id) {
    if (!st.scene.chars.some((c) => c.id === id)) return;
    st.scene.sel = id; keep(); tree(); dialsLoad(); marks(); if (root.H3DazScene) root.H3DazScene.select(id);
    if (st.tab === "pose") { st.bone = ""; boneList(); axes(); activePaint(); }
  }
  /** the characters that were in the scene, back in it (the Sketcher's view up) */
  async function restore() {
    const S = root.H3DazScene; if (!S || !sceneV()) return;
    for (const c of st.scene.chars) if (c.inScene && c.last && !S.rig(c.id)) { try { await S.put(c); } catch (e) { c.inScene = false; } }
    if (st.scene.sel) S.select(st.scene.sel); tree();
  }
  /** the 3D view: drops from the library, a click picks a character (or, in 🕺 Pose, its bone) */
  function hookView() {
    const V = sceneV(), view = $("ppView"); if (!V || !view || view.dataset.dzHooked) return !!(V && view);
    view.dataset.dzHooked = "1";
    view.addEventListener("dragover", (e) => { if (!st.on) return; const ok = [...(e.dataTransfer.types || [])].includes("application/x-h3-daz") || st.dragIt; if (ok) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
    view.addEventListener("drop", (e) => {
      if (!st.on) return; let it = st.dragIt; try { const d = e.dataTransfer.getData("application/x-h3-daz"); if (d) it = JSON.parse(d); } catch (x) { /* fine */ }
      st.dragIt = null; if (!it) return; e.preventDefault(); e.stopPropagation();
      const S = root.H3DazScene, at = S.ground(e), onId = S.pickChar(e);
      libClick(it, at, onId || "");
    });
    view.addEventListener("dragend", () => { st.dragIt = null; });
    let down = null;
    V.canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; }, true);
    V.canvas.addEventListener("pointerup", (e) => {
      if (!st.on || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return; down = null;
      const S = root.H3DazScene, id = S.pickChar(e);
      if (!id) { if (S.sel()) S.select("", true); return; }                       // 2.985.0: a click past the characters un-picks (Delete is the Sketcher's again)
      if (root.H3PushPull && root.H3PushPull.setSel) root.H3PushPull.setSel({});
      if (st.tab === "pose" && id === st.scene.sel) { const b = S.pickBone(e, id); if (b) { pickBone(b); return; } }
      pickChar(id); say("🧍 " + ((cur() || {}).name || "") + " picked - use clothes, hair, poses on it from the library");
    }, true);
    return true;
  }
  /* ---------------- on / off */
  /** on: the Sketcher shown (if it was closed), the three DAZ dockers in it, the characters back in its scene; off: the dockers hidden (the characters stay in the scene) */
  function toggle(force) {
    const on = force != null ? !!force : !st.on, d = $("pushpulldock"), b = button(), b2 = $("ppDazLib");
    if (on && d && d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") { try { root.toggleDockGone("pushpulldock", "tX_pushpulldock"); } catch (e) { /* the menu's own way */ } }
    if (on && !build()) return false;
    st.on = on; LS.set("on", on);
    if (d) d.classList.toggle("dz-on", on);
    for (const x of [b, b2]) if (x) { x.classList.toggle("on", on); x.setAttribute("aria-pressed", on ? "true" : "false"); }
    regrid();
    if (on) {
      sizes(LS.get("w", {}));
      if (root.H3DazScene) root.H3DazScene.onChange(sceneChanged);
      tree(); list(); dialsLoad(); chars(); tab(st.tab || "shape");
      let n = 0; const wait = () => { if (!st.on) return; if (hookView()) { restore(); return; } if (n++ < 80) root.setTimeout(wait, 250); }; wait();
    }
    return on;
  }
  function boot() {
    button();
    root.setTimeout(button, 1500);   // after the app strip has built itself
    if (LS.get("on", false)) toggle(true);
  }
  root.H3DazTools = Object.assign({ deleteSel, undoDelete, toggle, list, tree, libClick, buildChar, dialsLoad, tryIt, measureIt, makeFromMeasures, tab, pickChar, pickBone, motionOpen, restore, state: st, cur, info: () => ({ on: st.on, chars: st.scene.chars.length, sel: (cur() || {}).name || "", dials: st.dialList.length, wear: (cur() || { wear: [] }).wear.map((w) => w.name) }) }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
