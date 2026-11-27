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
  const KINDS = [["figure", "🧍 Figures"], ["character", "🎭 Characters"], ["clothing", "👕 Clothing"], ["hair", "💇 Hair"], ["anatomy", "🫀 Anatomy"], ["other", "📦 Other"]];
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
      wear: [], dials: {}, drape: { kinds: [], frames: 45 }, muscles: true, last: "" };
  }
  /** wear / take off a component (by its file) - true = now worn */
  function wearToggle(c, it) {
    const i = c.wear.findIndex((w) => w.rel === it.rel && w.root === it.root);
    if (i >= 0) { c.wear.splice(i, 1); return false; }
    c.wear.push({ root: it.root, rel: it.rel, name: it.name, kind: it.kind }); return true;
  }
  /** a kept scene made safe to use: characters with a figure, the picked one found (else the first) */
  function cleanScene(o) {
    const s = o && typeof o === "object" ? o : {}, chars = (Array.isArray(s.chars) ? s.chars : []).filter((c) => c && c.fig && c.fig.rel).slice(0, 40).map((c) => ({
      id: String(c.id || ("c" + (uid++))), name: String(c.name || c.fig.name || "Character").slice(0, 60), fig: { root: c.fig.root, rel: c.fig.rel, name: c.fig.name || "", kind: c.fig.kind || "figure" },
      wear: (Array.isArray(c.wear) ? c.wear : []).filter((w) => w && w.rel).slice(0, 60), dials: c.dials && typeof c.dials === "object" ? Object.fromEntries(Object.entries(c.dials).filter(([, v]) => isFinite(+v) && +v)) : {},
      drape: { kinds: (c.drape && Array.isArray(c.drape.kinds) ? c.drape.kinds : []).filter((k) => /^(clothing|hair|other)$/.test(k)), frames: Math.max(5, Math.min(240, +(c.drape && c.drape.frames) || 45)) },
      muscles: c.muscles !== false, last: typeof c.last === "string" ? c.last : "",
      custom: (Array.isArray(c.custom) ? c.custom : []).map(String).slice(0, 8), paint: c.paint && typeof c.paint === "object" ? c.paint : null, from: typeof c.from === "string" ? c.from : "" }));
    return { chars, sel: chars.some((c) => c.id === s.sel) ? s.sel : (chars[0] ? chars[0].id : "") };
  }
  /** 2.981.0: a copy of a character for a 📷 try (its figure, what it wears, its physics; dials / morphs / paint from the try) */
  function tryChar(base, route, n) {
    const c = newChar(base.fig, 1); c.name = base.name + " · 📷 " + route + (n > 1 ? " " + n : ""); c.wear = base.wear.map((w) => Object.assign({}, w));
    c.drape = { kinds: base.drape.kinds.slice(), frames: base.drape.frames }; c.muscles = base.muscles; c.dials = Object.assign({}, base.dials); c.custom = (base.custom || []).slice(); c.from = route; return c;
  }
  const ROUTES = { A: "Fit the dials (fast - the figure's own body dials)", B: "Scan + wrap (closer - a 3D shape from the photo, the figure wrapped onto it)" };
  const pure = { NOTE, KINDS, TEMPLATE, ROUTES, groupDials, newChar, wearToggle, cleanScene, tryChar };
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
    s.textContent = ":root{--dzl:290px;--dzr:330px}"
      + "#app.dz-on:not([style*=grid-template-columns]){grid-template-columns:" + TEMPLATE + "}"
      + "#app:not(.dz-on)>.dz-el{display:none!important}"
      + "#dazTools.on{background:var(--tiger-deep,#a8601a);color:#fff}"
      + ".dzdock{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:var(--panel,#1b1915);font-size:12px}"
      + ".dzhead{display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--line,#3a352d);font-weight:600}.dzhead b{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
      + ".dznote{margin:4px 6px;padding:4px 6px;border-left:3px solid var(--tiger,#f59e2c);background:#2a2418;border-radius:3px;font-size:11px}"
      + ".dztabs{display:flex;flex-wrap:wrap;gap:3px;padding:4px 6px}.dztabs button{padding:2px 6px;font-size:11px}.dztabs button.on{outline:2px solid #38e1ff}"
      + "#dzQ,#dzDialQ{margin:0 6px 4px;width:calc(100% - 12px)}"
      + "#dzGrid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:5px;padding:4px 6px;align-content:start}"
      + ".dzit{border:2px solid transparent;border-radius:5px;padding:2px;cursor:pointer;background:#0006;text-align:center}.dzit.fig{border-color:#38e1ff}.dzit.worn{border-color:#7bd389}"
      + ".dzit img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:3px;background:#000;display:block}.dzit span{display:block;font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + "#dzExp{flex:0 0 var(--dzeh,46%);display:flex;flex-direction:column;min-height:90px;overflow:hidden}#dzShape{flex:1 1 0;display:flex;flex-direction:column;min-height:80px;overflow:hidden}"
      + "#dzTree{flex:1;overflow:auto;padding:3px 6px}.dzc{border-radius:4px;padding:2px 4px;cursor:pointer;display:flex;gap:5px;align-items:center}.dzc.sel{background:#38e1ff22;outline:1px solid #38e1ff}"
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
      b.title = "DAZ Tools - the Daz library (left docker), the explorer and shape controls (right docker). " + NOTE;
      b.setAttribute("aria-pressed", "false"); b.onclick = () => toggle();
    }
    const strip = $("appStrip"), pb = mb.querySelector(".projbtns"), after = strip || pb;
    if (after && after.nextSibling !== b) mb.insertBefore(b, after.nextSibling); else if (!after && b.parentElement !== mb) mb.appendChild(b);
    return b;
  }
  /* ---------------- the dockers */
  function build() {
    const app = $("app"), main = $("maincol"); if (!app || !main) return false;
    if ($("dzLeft")) return true;
    css();
    const L = doc.createElement("aside"); L.id = "dzLeft"; L.className = "dock dzdock dz-el"; L.setAttribute("aria-label", "DAZ Library");
    L.innerHTML = '<div class="dzhead"><b>📚 DAZ Library</b><button type="button" class="ghost dzx" id="dzFolders" title="The Daz content folders (📚 dialog)">📁</button><button type="button" class="ghost dzx" id="dzRefresh" title="Read the library again">↻</button></div>'
      + '<div class="dznote" role="note">' + esc(NOTE) + "</div><div class=\"dztabs\" id=\"dzTabs\">" + KINDS.map(([k, l]) => '<button type="button" class="ghost" data-kind="' + k + '">' + l + "</button>").join("") + "</div>"
      + '<input type="search" id="dzQ" placeholder="Search the library…"><div id="dzEnc" class="hint" style="padding:0 6px"></div><div id="dzGrid"></div>';
    const sl = doc.createElement("div"); sl.className = "vsplit dzsplit dz-el"; sl.dataset.resize = "dzl"; sl.id = "dzSplitL"; sl.title = "Drag to size the DAZ Library";
    const sr = doc.createElement("div"); sr.className = "vsplit dzsplit dz-el"; sr.dataset.resize = "dzr"; sr.id = "dzSplitR"; sr.title = "Drag to size the DAZ Explorer";
    const R = doc.createElement("aside"); R.id = "dzRight"; R.className = "dock right dzdock dz-el"; R.setAttribute("aria-label", "DAZ Explorer and shape controls");
    R.innerHTML = '<div id="dzExp"><div class="dzhead"><b>🧭 DAZ Explorer</b><select id="dzChars" title="A character you saved (💾)"><option value="">📂 Saved…</option></select></div>'
      + '<div id="dzTree" role="tree" aria-label="Characters and their components"></div>'
      + '<div class="dzopts" id="dzOpts"><label title="Our own cloth - a light drape, not dForce"><input type="checkbox" data-drape="clothing"> 💨 Clothing</label><label><input type="checkbox" data-drape="hair"> Hair</label><label><input type="checkbox" data-drape="other"> Other</label>'
      + '<label title="Settle frames">frames <input type="number" id="dzFrames" min="5" max="240" value="45"></label><label title="The figure\'s own JCMs (or our own flex) - 🕺 Pose plays them"><input type="checkbox" id="dzMuscle" checked> 💪 Muscles</label></div>'
      + '<details id="dzPhoto"><summary title="Make this character\'s body from a photo - pick a way, ▶ Try; each try is a new character: try both, keep the better one">📷 Body from a photo</summary><div class="dzph">'
      + '<div id="dzPhotoPick"></div><label><input type="checkbox" id="dzBackOn"> ＋ a back photo (paints the back)</label><div id="dzBackPick" hidden></div>'
      + '<label class="dzrow">Way <select id="dzRoute">' + Object.entries(ROUTES).map(([k, v]) => '<option value="' + k + '">' + k + " - " + v + "</option>").join("") + "</select></label>"
      + '<label class="dzrow" title="Optional - the person\'s real height makes the fit exact in size">Height <input type="number" id="dzHeight" min="50" max="250" placeholder="cm"></label>'
      + '<label class="dzrow">Paint <select id="dzPaint"><option value="body">the photo into the whole body\'s textures</option><option value="face">the face only</option><option value="none">nothing (shape only)</option></select></label>'
      + '<div id="dzBOpts" hidden><label class="dzrow">3D engine <select id="dzEngine"><option value="auto">auto</option><option value="hunyuan">Hunyuan3D 2.1</option><option value="trellis">TRELLIS.2</option></select></label><label><input type="checkbox" id="dzTurn"> the scan faces away (turn it)</label></div>'
      + '<div class="hint">Light, not exact: a standing person, head to feet, facing the camera; loose clothing reads as body. The photo\'s clothes are painted too.</div>'
      + '<button type="button" class="primary" id="dzTry">▶ Try it</button></div></details>'
      + '<details id="dzMeasure"><summary title="Make this character\'s body from a height and a weight (and tape measurements if you have them) - a new character">📏 Height &amp; weight</summary><div class="dzph">'
      + '<div class="dzmg"><label>Height <input type="number" id="dzMH" min="40" max="260" step="0.5" placeholder="cm"></label><label>Weight <input type="number" id="dzMW" min="3" max="300" step="0.5" placeholder="kg"></label>'
      + '<label title="Round the chest at the armpits">Chest <input type="number" id="dzMC" min="30" max="250" placeholder="cm"></label><label title="Round the narrowest waist">Waist <input type="number" id="dzMWa" min="30" max="250" placeholder="cm"></label><label title="Round the widest hips">Hips <input type="number" id="dzMHi" min="30" max="250" placeholder="cm"></label></div>'
      + '<label class="dzrow" title="One weight fits many bodies - which dials carry it">Build <select id="dzMBuild"><option value="average">average</option><option value="slim">slim</option><option value="athletic">athletic</option><option value="soft">soft</option></select></label>'
      + '<div id="dzMNow" class="hint"></div><div style="display:flex;gap:6px"><button type="button" class="ghost" id="dzMRead" title="The picked character\'s height, weight and tape measurements now">📏 Measure it</button><button type="button" class="primary" id="dzMMake">▶ Make</button></div></div></details>'
      + '<div class="dzbtns"><button type="button" class="primary" id="dzBuild">🧍 Build</button><button type="button" class="ghost" id="dzPose" disabled>🕺 Pose</button><button type="button" class="ghost" id="dzOpen" disabled title="Into the Sketcher model (plain faces)">⤒ Open</button><button type="button" class="ghost" id="dzSave">💾 Save</button></div></div>'
      + '<div class="dzhs" id="dzHSplit" role="separator" aria-orientation="horizontal" title="Drag to share the height"></div>'
      + '<div id="dzShape"><div class="dzhead"><b>🎚 Shape controls</b><label style="font-weight:400" title="Only the dials that are not 0"><input type="checkbox" id="dzChanged"> changed</label><button type="button" class="ghost dzx" id="dzReset" title="Every dial of this character back to 0">↺</button></div>'
      + '<input type="search" id="dzDialQ" placeholder="Find a dial (e.g. height, nose, muscular)…"><div id="dzDials"></div></div><div id="dzMsg" role="status"></div>';
    app.insertBefore(L, main); app.insertBefore(sl, main);
    app.insertBefore(sr, main.nextSibling); app.insertBefore(R, sr.nextSibling);
    wire(); sizes(LS.get("w", {}));
    return true;
  }
  function sizes(w) {
    const r = doc.documentElement.style;
    if (w.l) r.setProperty("--dzl", Math.max(180, Math.min(800, w.l)) + "px");
    if (w.r) r.setProperty("--dzr", Math.max(200, Math.min(800, w.r)) + "px");
    if (w.eh) { const e = $("dzRight"); if (e) e.style.setProperty("--dzeh", Math.max(15, Math.min(85, w.eh)) + "%"); }
  }
  function regrid() { try { if (root.H3DGDock && root.H3DGDock.regrid) root.H3DGDock.regrid(); } catch (e) { /* the stylesheet's template */ } try { root.dispatchEvent(new Event("resize")); } catch (e) { /* old */ } }
  function splitter(sp, key) {
    sp.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return; e.preventDefault();
      const el = key === "l" ? $("dzLeft") : $("dzRight"), x0 = e.clientX, w0 = el.getBoundingClientRect().width; sp.classList.add("drag");
      const mv = (m) => { const w = Math.round(w0 + (key === "l" ? m.clientX - x0 : x0 - m.clientX)), W = LS.get("w", {}); W[key] = Math.max(180, Math.min(800, w)); LS.set("w", W); sizes(W); };
      const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); sp.classList.remove("drag"); regrid(); };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    });
  }
  function wire() {
    splitter($("dzSplitL"), "l"); splitter($("dzSplitR"), "r");
    $("dzHSplit").addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return; e.preventDefault();
      const R = $("dzRight").getBoundingClientRect(), hs = $("dzHSplit"); hs.classList.add("drag");
      const mv = (m) => { const W = LS.get("w", {}); W.eh = Math.round((m.clientY - R.top) / R.height * 100); LS.set("w", W); sizes(W); };
      const up = () => { root.removeEventListener("pointermove", mv, true); root.removeEventListener("pointerup", up, true); hs.classList.remove("drag"); };
      root.addEventListener("pointermove", mv, true); root.addEventListener("pointerup", up, true);
    });
    $("dzTabs").querySelectorAll("[data-kind]").forEach((b) => { b.onclick = () => { st.kind = b.dataset.kind; list(); }; });
    let qt = 0; $("dzQ").oninput = () => { clearTimeout(qt); qt = setTimeout(list, 300); };
    let dq = 0; $("dzDialQ").oninput = () => { clearTimeout(dq); dq = setTimeout(() => dialsLoad(true), 300); };
    $("dzRefresh").onclick = list;
    $("dzFolders").onclick = () => { if (root.H3DazLib) { root.H3DazLib.open(); setTimeout(() => { const b = $("pdlFolders"); if (b) b.click(); }, 50); } };
    $("dzOpts").querySelectorAll("[data-drape]").forEach((x) => { x.onchange = () => { const c = cur(); if (!c) return; const k = x.dataset.drape; c.drape.kinds = c.drape.kinds.filter((y) => y !== k).concat(x.checked ? [k] : []); keep(); }; });
    $("dzFrames").onchange = () => { const c = cur(); if (c) { c.drape.frames = Math.max(5, Math.min(240, +$("dzFrames").value || 45)); keep(); } };
    $("dzMuscle").onchange = () => { const c = cur(); if (c) { c.muscles = $("dzMuscle").checked; keep(); } };
    $("dzBuild").onclick = buildChar; $("dzPose").onclick = pose; $("dzOpen").onclick = openIt; $("dzSave").onclick = saveChar;
    $("dzChars").onchange = () => { const v = $("dzChars").value; $("dzChars").value = ""; if (v) loadChar(v); };
    $("dzChanged").onchange = () => { st.changedOnly = $("dzChanged").checked; dialsPaint(); };
    // 2.981.0: 📷 a body from a photo
    $("dzPhoto").addEventListener("toggle", () => { if ($("dzPhoto").open && !st.pick && root.H3PicPick) st.pick = root.H3PicPick.mount($("dzPhotoPick"), { title: "The photo (a person standing, head to feet)", onPick: (it) => { st.photo = it; say("📷 " + it.name + " - ▶ Try it"); } }); });
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
      const b = doc.createElement("div"); b.className = "dzit"; b.title = it.rel + (["figure", "character"].includes(it.kind) ? " - click: a new character in the explorer" : " - click: worn by the picked character (again = taken off)");
      b.dataset.rel = it.rel;
      b.innerHTML = (it.thumb ? '<img loading="lazy" alt="" src="/api/dazlib/thumb?root=' + encodeURIComponent(it.root) + "&rel=" + encodeURIComponent(it.thumb) + '">' : '<img alt="">') + "<span>" + esc(it.name) + "</span>";
      if (c && c.fig.rel === it.rel) b.classList.add("fig");
      if (c && c.wear.some((w) => w.rel === it.rel)) b.classList.add("worn");
      b.onclick = () => libClick(it);
      g.appendChild(b);
    });
  }
  /** the tiles re-marked in place (figure / worn) - no re-listing, so the grid never flickers */
  function marks() {
    const c = cur(); for (const b of doc.querySelectorAll("#dzGrid .dzit")) { b.classList.toggle("fig", !!c && c.fig.rel === b.dataset.rel); b.classList.toggle("worn", !!c && c.wear.some((w) => w.rel === b.dataset.rel)); }
  }
  function libClick(it) {
    if (["figure", "character"].includes(it.kind)) {
      const n = st.scene.chars.filter((c) => c.fig.rel === it.rel).length + 1, c = newChar(it, n);
      st.scene.chars.push(c); st.scene.sel = c.id; keep(); tree(); dialsLoad(); list(); say("🧍 " + c.name + " added - now pick what it wears, then 🧍 Build");
      return;
    }
    const c = cur(); if (!c) { say("pick a figure or a character first (🧍 Figures / 🎭 Characters)"); return; }
    const on = wearToggle(c, it); keep(); tree(); marks(); say((on ? "👕 " + c.name + " wears " : "✕ " + c.name + " took off ") + it.name);
  }
  /* ---------------- 🧭 the explorer */
  function tree() {
    const t = $("dzTree"); if (!t) return;
    const chars = st.scene.chars;
    t.innerHTML = chars.length ? "" : '<span class="hint">No characters yet - click a figure or a character in the 📚 DAZ Library.</span>';
    chars.forEach((c) => {
      const row = doc.createElement("div"); row.className = "dzc" + (c.id === st.scene.sel ? " sel" : ""); row.setAttribute("role", "treeitem"); row.dataset.char = c.id;
      row.innerHTML = "<span title=\"Double-click to rename\">🧍 " + esc(c.name) + (c.last ? ' <small style="opacity:.6">✔</small>' : "") + '</span><button type="button" class="ghost dzx" data-del title="Remove this character from the explorer">✕</button>';
      row.onclick = (e) => { if (e.target.closest("[data-del]")) return; if (st.scene.sel !== c.id) { st.scene.sel = c.id; keep(); tree(); dialsLoad(); list(); } };
      row.ondblclick = () => rename(row, c);
      row.querySelector("[data-del]").onclick = () => { st.scene.chars = st.scene.chars.filter((x) => x !== c); if (st.scene.sel === c.id) st.scene.sel = st.scene.chars[0] ? st.scene.chars[0].id : ""; keep(); tree(); dialsLoad(); list(); };
      t.appendChild(row);
      const comps = [{ name: c.fig.name, kind: c.fig.kind, fig: true }].concat(c.wear);
      comps.forEach((w) => {
        const k = doc.createElement("div"); k.className = "dzcomp"; k.setAttribute("role", "treeitem");
        const ic = w.fig ? "🦴" : w.kind === "hair" ? "💇" : w.kind === "anatomy" ? "🫀" : "👕";
        k.innerHTML = "<span title=\"" + esc(w.rel || c.fig.rel) + "\">" + ic + " " + esc(w.name) + (w.fig ? ' <small style="opacity:.6">(figure)</small>' : "") + "</span>" + (w.fig ? "" : '<button type="button" class="ghost dzx" title="Take it off">✕</button>');
        const x = k.querySelector("button"); if (x) x.onclick = () => { wearToggle(c, w); keep(); tree(); marks(); };
        t.appendChild(k);
      });
    });
    const c = cur();
    $("dzOpts").querySelectorAll("[data-drape]").forEach((x) => { x.checked = !!c && c.drape.kinds.includes(x.dataset.drape); x.disabled = !c; });
    $("dzFrames").value = c ? c.drape.frames : 45; $("dzMuscle").checked = !c || c.muscles !== false;
    $("dzBuild").disabled = !c || st.busy; $("dzPose").disabled = !c || !c.last; $("dzOpen").disabled = !c || !c.last; $("dzSave").disabled = !c;
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
        custom: c.custom || [], paint: c.paint || null });
      c.last = j.model; keep();
      const mu = j.info.muscles || {};
      say("✔ " + j.model + " - " + j.info.pieces.length + " piece(s), " + j.info.bones + " bones" + (mu.kind === "jcm" ? ", 💪 " + mu.shapes + " JCMs" : mu.kind === "flex" ? ", 💪 our flex" : "") + (j.info.warnings.length ? " · ⚠ " + j.info.warnings.slice(0, 2).join("; ") : ""));
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
      say("📷 " + report + " - building…");
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
  function pose() { const c = cur(); if (c && c.last && root.H3DazPose) root.H3DazPose.open(c.last); }
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
  /* ---------------- on / off */
  function toggle(force) {
    const on = force != null ? !!force : !st.on, app = $("app"), b = button();
    if (on && !build()) return false;
    st.on = on; LS.set("on", on);
    if (app) app.classList.toggle("dz-on", on);
    if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    regrid();
    if (on) { tree(); list(); dialsLoad(); chars(); root.setTimeout(() => { const m = $("maincol"); if (m && m.getBoundingClientRect().width < 360) say("The window is narrow - hide a side docker (References, Assets, Queue) to give the main column room, or drag these dockers narrower"); }, 300); }
    return on;
  }
  function boot() {
    button();
    root.setTimeout(button, 1500);   // after the app strip has built itself
    if (LS.get("on", false)) toggle(true);
  }
  root.H3DazTools = Object.assign({ toggle, list, tree, libClick, buildChar, dialsLoad, tryIt, measureIt, makeFromMeasures, state: st, cur, info: () => ({ on: st.on, chars: st.scene.chars.length, sel: (cur() || {}).name || "", dials: st.dialList.length, wear: (cur() || { wear: [] }).wear.map((w) => w.name) }) }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
