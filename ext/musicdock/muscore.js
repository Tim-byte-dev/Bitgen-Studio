/* bitGen Studio — the Music docker's ENGRAVED SHEET MUSIC (2.731.0): window.MuScore.
 *
 * Tim (verbatim): "in our music docker, sheet music tab can we have real sheet music with the notes drawn on the staff
 * with it's clefs etc. and save as pdf?"  + "just use the standards don't import anything".
 *
 * The Sheet music tab draws the score - staves, clefs, key and time signatures, notes, beams, rests, ties, chord
 * symbols, section marks - with static/abcscore.js (the engraver, written here; no library), one white page per PDF
 * page. Where a score comes from: 🎼 Write / 📜 Transcribe (musicdock.js muShowAbc -> show), the Score list (the
 * project's .abc files - GET /api/scores, read with GET /outputs/:name) or 📂 Open .abc (a file on this computer).
 * 💾 Save PDF writes the PDF in the page (AbcScore.toPDF - the PDF standard's own fonts, nothing embedded) and posts it
 * to POST /api/pdf/save (the project's pdf folder, lib/pdfStore.js), downloading it too when "download too" is ticked.
 * ‹/› ABC text shows the notation behind the drawing; ⧉ Copy copies it.
 *   MuScore.show(text, name, how)   draw a score -> the render result (or null)
 *   MuScore.load(name)              a project score by name -> Promise<result>
 *   MuScore.refresh(select?)        the Score list -> Promise<files>
 *   MuScore.savePdf()               -> Promise<{name, size, pages} | null>
 *   MuScore.openView()              ⛶ Read: the pages full size in a dialog
 *   MuScore.setPaper(settings)      🎨 Paper (2.732.0): colour / material / size / strength / ink / in the PDF -> Promise<look>
 *   MuScore.words(on?)              2.734.0: the Song tab's lyrics under the vocal staff (the "words" tick) -> on
 *   MuScore.player()                ▶ (2.733.0): the ScorePlayer of the score on show (⏮ ⏪ ▶/⏸ ⏩ ⏭, the notes lit as
 *                                   they sound; the song beside the .abc, or the notes played by the browser)
 *   MuScore.state                   {text, name, title, result}
 */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  const S = { text: "", name: "", title: "", result: null, listed: false, look: null, paper: null,
    part: -1, partOf: null, mute: {}, trackOff: {} };     // 2.737.0: the part shown (-1 = the full score), the staves / stems turned off
  const P = () => root.ScorePaper;
  /** a page as SVG in the chosen paper + ink (2.732.0); `pre` keeps the pattern ids apart (the tab / ⛶ Read) */
  const svgOf = (pg, k, pre) => root.AbcScore.toSVG(pg, { look: S.look && S.look.svg, id: pre + k });
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  function status(t) { const el = $("muSheetStatus"); if (el) el.textContent = t; }
  /** "Neon-Nights_20261108-233101_ab12.abc" -> "Neon-Nights" (a score with no T: is titled by its file) */
  function titleFrom(name) {
    return String(name || "").replace(/\.[^.]+$/, "").replace(/[_\s-]*\d{8}[-_]?\d{4,6}.*$/, "").replace(/_+/g, " ").trim();
  }
  function empty(msg) {
    const box = $("muScore");
    if (box) box.innerHTML = '<div class="muEmpty hint">' + esc(msg) + "</div>";
    ["muScorePdf", "muScoreBig"].forEach((id) => { const b = $(id); if (b) b.disabled = true; });
    playStop(); playButtons(false);
  }
  // ⛶ Read: the pages full size in a dialog (the docker is often a narrow column)
  const view = () => $("muScoreView");
  function makeView() {
    if (view()) return view();
    const d = doc.createElement("dialog");
    d.id = "muScoreView";
    d.setAttribute("aria-label", "Sheet music");
    d.style.cssText = "width:min(980px,96vw);max-height:94vh;padding:0;border:1px solid var(--line,#333);border-radius:8px;background:var(--bg2,#1b1e25);color:inherit";
    d.innerHTML = '<div style="display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line,#333);position:sticky;top:0;background:inherit;z-index:1">'
      + '<b id="muSvTitle" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Sheet music</b>'
      + '<span id="muSvPlay" class="muTrans" role="group" aria-label="Play the score" style="padding:0;background:none;border:0">'
      + '<button class="ghost" type="button" data-act="start" title="Back to the start" aria-label="Back to the start">' + ICONS.start + '</button>'
      + '<button class="ghost" type="button" data-act="back" title="Back one bar" aria-label="Back one bar">' + ICONS.back + '</button>'
      + '<button class="ghost" type="button" data-act="toggle" data-icon="play" id="muSvToggle" title="Play" aria-label="Play">' + ICONS.play + '</button>'
      + '<button class="ghost" type="button" data-act="fwd" title="Forward one bar" aria-label="Forward one bar">' + ICONS.fwd + '</button>'
      + '<button class="ghost" type="button" data-act="end" title="To the end" aria-label="To the end">' + ICONS.end + '</button>'
      + '<span id="muSvTime" class="muTime">0:00 / 0:00</span></span>'
      + '<button class="ghost muPri" id="muSvPdf" type="button" style="flex:none" title="Save the pages as a PDF in the project\'s pdf folder">💾 Save PDF</button>'
      + '<button class="ghost" id="muSvClose" type="button" style="flex:none" title="Close" aria-label="Close">✕</button></div>'
      + '<div id="muSvPages" style="position:relative;overflow:auto;max-height:calc(94vh - 52px);padding:16px"></div>';
    doc.body.appendChild(d);
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    return d;
  }
  function fillView() {
    const A = root.AbcScore, r = S.result, box = $("muSvPages");
    if (!A || !r || !box) return;
    $("muSvTitle").textContent = S.title + (partName() ? " - " + partName() : "") + " - " + r.pages.length + " page" + (r.pages.length === 1 ? "" : "s");
    box.innerHTML = "";
    r.pages.forEach((pg, k) => {
      const p = doc.createElement("div");
      p.style.cssText = "margin:0 auto 16px;max-width:900px;box-shadow:0 2px 12px rgba(0,0,0,.5)";
      p.setAttribute("role", "img");
      p.setAttribute("aria-label", S.title + " - page " + (k + 1));
      p.innerHTML = svgOf(pg, k, "v").replace("<svg ", '<svg style="display:block;width:100%;height:auto" ');
      box.appendChild(p);
    });
    relight();
  }
  function openView() {
    if (!S.result || S.result.empty) { status("nothing to show yet - draw a score first"); return; }
    const d = makeView();
    fillView();
    if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
    test("mu_score_view", String(S.result.pages.length));
  }

  function show(text, name, how) {
    const A = root.AbcScore;
    playStop();
    S.text = String(text == null ? "" : text); S.name = String(name || "");
    if (S.partOf !== S.name + "\n" + S.text.length) { S.part = -1; S.mute = {}; S.trackOff = {}; S.partOf = S.name + "\n" + S.text.length; }   // 2.737.0: a new score - all of it
    const pre = $("muAbc");
    if (pre) pre.textContent = S.text || "— empty score —";
    if (!A) { empty("The sheet music engraver did not load - reload the page."); return null; }
    let r;
    const ly = wordsOn() ? lyricsNow() : "";             // 2.734.0: the words, when ticked
    try {
      r = A.render(S.text, { title: titleFrom(S.name), lyrics: ly, parts: S.part >= 0 ? [S.part] : null, partName: S.part >= 0 ? partLabel(S.part) : "" });
      // 2.737.0: a part's sheet shows its own staff, the player still has the whole score to play (each staff on or off)
      if (S.part >= 0 && r.shown && r.shown.length < r.parts.length) { const f = A.render(S.text, { title: titleFrom(S.name) }); r.timing.sound = f.timing.sound; }
      else if (S.part >= 0) S.part = -1;
    } catch (e) {
      S.result = null;
      empty("Could not draw " + (S.name || "this score") + ": " + ((e && e.message) || e) + " - ‹/› ABC text shows the notation.");
      status("could not draw " + (S.name || "the score"));
      return null;
    }
    S.result = r; S.title = r.title || titleFrom(S.name) || "Sheet music";
    partsBuild();
    if (r.empty) {
      empty((S.name || "This score") + " has no notes to draw - ‹/› ABC text shows what it holds.");
      status((how || "") + (S.name || "the score") + " - no notes in it");
      return r;
    }
    const box = $("muScore");
    box.innerHTML = "";
    r.pages.forEach((pg, k) => {
      const d = doc.createElement("div");
      d.className = "muPaper";
      d.setAttribute("role", "img");
      d.setAttribute("aria-label", S.title + " - page " + (k + 1) + " of " + r.pages.length);
      d.innerHTML = svgOf(pg, k, "m");
      box.appendChild(d);
    });
    box.scrollTop = 0;
    $("muScorePdf").disabled = false;
    if ($("muScoreBig")) $("muScoreBig").disabled = false;
    if (view() && view().open) fillView();
    const sum = r.pages.length + " page" + (r.pages.length === 1 ? "" : "s") + ", " + r.measures + " bar" + (r.measures === 1 ? "" : "s")
      + ", " + r.voices + (r.voices === 1 ? " staff" : " staves");
    const wd = !wordsOn() ? "" : !ly.trim() ? " · words: the Song tab's lyrics are empty"
      : r.words ? ` · words: ${r.words.placed} of ${r.words.notes} sung notes under ${r.words.voice}` + (r.words.used < r.words.syllables ? ` (${r.words.syllables - r.words.used} syllable${r.words.syllables - r.words.used === 1 ? "" : "s"} more than the notes)` : "") : "";
    const pn = partName() ? " · part: " + partName() : "";
    status((how || "🎼 ") + (S.name || S.title) + " - " + sum + pn + (r.warnings.length ? " (" + r.warnings.join("; ") + ")" : "") + wd);
    const sel = $("muScoreList");
    if (sel && S.name && Array.prototype.some.call(sel.options, (o) => o.value === S.name)) sel.value = S.name;
    playSetup();
    test("mu_score", (S.name || S.title) + " " + r.pages.length);
    return r;
  }

  function load(name) {
    if (!name) return Promise.resolve(null);
    status("reading " + name + "…");
    return root.fetch("/outputs/" + encodeURIComponent(name))
      .then((r) => { if (!r.ok) throw new Error(name + " is not in the project any more"); return r.text(); })
      .then((t) => show(t, name))
      .catch((e) => { status((e && e.message) || String(e)); return null; });
  }

  function refresh(select) {
    const sel = $("muScoreList");
    if (!sel) return Promise.resolve([]);
    return root.fetch("/api/scores").then((r) => r.json()).then((j) => {
      const files = (j && j.files) || [];
      S.files = {};
      files.forEach((f) => { S.files[f.name] = f; });
      S.songs = (j && j.songs) || [];                    // 2.738.0: the project's recordings
      const keep = select || sel.value;
      sel.innerHTML = "";
      const o0 = doc.createElement("option");
      o0.value = ""; o0.textContent = files.length ? "— pick a score (" + files.length + ") —" : "— no scores in the project yet —";
      sel.appendChild(o0);
      files.forEach((f) => {
        const o = doc.createElement("option");
        o.value = f.name;
        const d = new Date(f.mtime);
        o.textContent = (f.audio ? "🎵 " : "") + f.name + (isNaN(d) ? "" : " · " + d.toISOString().slice(0, 16).replace("T", " "));
        sel.appendChild(o);
      });
      if (keep && files.some((f) => f.name === keep)) sel.value = keep;
      S.listed = true;
      return files;
    }).catch(() => []);
  }

  function download(name, bytes) {
    const u = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = doc.createElement("a");
    a.href = u; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 30000);
  }
  function savePdf() {
    const A = root.AbcScore, r = S.result;
    if (!A || !r || r.empty) { status("nothing to save yet - draw a score first"); return Promise.resolve(null); }
    const btn = $("muScorePdf");
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = "⏳ Writing…";
    const file = ((S.title || titleFrom(S.name) || "sheet music") + (partName() ? " - " + partName() : "")).replace(/[^A-Za-z0-9 ._()-]+/g, "_").trim().slice(0, 70) + ".pdf";
    let bytes;
    const pl = S.look && S.paper && S.paper.pdf ? S.look.pdf : null;      // 2.732.0: the paper + ink, unless "in the PDF too" is off
    try { bytes = A.toPDF(r.pages, { title: S.title + (partName() ? " - " + partName() : ""), subject: partName() ? "Sheet music - " + partName() : "Sheet music" }, pl); } catch (e) {
      status("could not write the PDF: " + ((e && e.message) || e)); btn.disabled = false; btn.textContent = was; return Promise.resolve(null);
    }
    return root.fetch("/api/pdf/save?name=" + encodeURIComponent(file), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: bytes })
      .then((x) => x.json()).then((j) => {
        if (j.error) throw new Error(j.error);
        if ($("muScoreDl") && $("muScoreDl").checked) { try { download(j.name, bytes); } catch (e) { /* saved in the project anyway */ } }
        status("📄 " + j.name + " - " + r.pages.length + " page" + (r.pages.length === 1 ? "" : "s") + " - saved in the project's pdf folder");
        test("mu_score_pdf", j.name + " " + r.pages.length);
        S.last = { name: j.name, size: j.size, pages: r.pages.length, bytes: bytes.length };
        return S.last;
      })
      .catch((e) => { status("⚠ the PDF was not saved: " + ((e && e.message) || e)); return null; })
      .finally(() => { btn.disabled = false; btn.textContent = was; });
  }

  // 🎼 PARTS + THE MIX (2.737.0, Tim: "can we separate the instruments and have sheet music for each instrument and another
  // for vocals? and have toggle buttons to play each instrument and vocals?"): tabs on the viewer - the full score, then each
  // staff's own sheet (AbcScore.render's parts; the words go only on the vocal one) - and, in the transport, what plays: with
  // the notes, a toggle per staff (Shift+click = that one alone); with the song, its stems - Vocals and Instruments - when it
  // has been separated (✂ Separate runs the Stems docker's demucs on it).
  function partLabel(i) { const r = S.result, p = r && r.parts && r.parts[i]; return p ? p.name : ""; }
  function partName() { return S.part >= 0 ? partLabel(S.part) : ""; }
  function partsBuild() {
    const box = $("muParts"), r = S.result;
    if (!box) return;
    const ps = (r && !r.empty && r.parts) || [];
    box.hidden = ps.length < 2;
    if (ps.length < 2) { box.innerHTML = ""; return; }
    box.innerHTML = [{ i: -1, name: "Full score" }].concat(ps).map((p) => `<button type="button" role="tab" data-part="${p.i}"${p.vocal ? ' data-vocal="1"' : ""} aria-selected="${S.part === p.i}"`
      + ` title="${p.i < 0 ? "Every staff together" : "The " + esc(p.name) + " part on its own sheet" + (p.vocal ? " - with the words" : "")}">${esc(p.name)}${p.vocal && !/vocal|voice|vox/i.test(p.name) ? '<span class="muVox">vocal</span>' : ""}</button>`).join("");
  }
  function setPart(i) {
    i = +i;
    if (!S.result || i === S.part) return;
    const at = PB.player ? Math.max(0, PB.player.position()) : 0, was = !!(PB.player && PB.player.playing());
    S.part = i;
    show(S.text, S.name, "🎼 ");
    if (PB.player && at) PB.player.seek(at);
    if (PB.player && was) PB.player.play();
    test("mu_score_part", i < 0 ? "full" : partLabel(i));
  }
  // 🎚 THE SONG IN ITS LAYERS (2.738.0, Tim: "when playing in sheet music play the actual song in it's separated layers,
  // show the layers as waveforms. right now it sounds like a 1980's watch"): Sound picks the RECORDING a score plays (any
  // song in the project, remembered per score; the one beside it or with the same title found by itself), and the song
  // plays as its layers - ✂ Split into layers makes four (vocals, drums, bass, other: demucs on this computer) - each a lane
  // under the transport: its waveform (GET /api/waveform), its on / off (Shift+click = alone), a click on it plays from
  // there. 🎹 the notes (the browser's own sound) is what a score with no recording falls back to.
  const SONG_KEY = "h3.muScoreSong";
  const LAYER_NAME = { vocals: "Vocals", drums: "Drums", bass: "Bass", other: "Other", instrumental: "Instruments", song: "Song" };
  const LAYER_ORDER = ["vocals", "drums", "bass", "other", "instrumental"];
  const LAYER_COL = { vocals: "#f2a03d", drums: "#d0765a", bass: "#c9a65c", other: "#93b07f", instrumental: "#9fb0c4", song: "#cdbb9f" };
  const urlOf = (src, name) => (src === "sound" ? "/passets/sound/" : "/outputs/") + encodeURIComponent(name);
  const keyOf = (x) => x.src + "/" + x.name;
  function songMap() { try { return JSON.parse(root.localStorage.getItem(SONG_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function songMapSave(score, v) { try { const m = songMap(); m[score] = v; root.localStorage.setItem(SONG_KEY, JSON.stringify(m)); } catch (e) { /* this page only */ } }
  const baseOf = (n) => String(n || "").replace(/\.[^.]+$/, "").replace(/_\d{8}-\d{6}.*$/, "").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
  /** the recording a score plays: the one picked for it, else the song beside it (a generated song writes its .abc
   *  there), else the newest song with the same title, else none (the notes) */
  function songChoice(score) {
    const L = S.songs || [], m = songMap()[score];
    if (m === "synth") return null;
    if (m) { const x = L.find((s2) => keyOf(s2) === m); if (x) return x; }
    const f = S.files && S.files[score];
    if (f && f.audio) { const x = L.find((s2) => s2.name === f.audio && s2.src !== "sound") || L.find((s2) => s2.name === f.audio); if (x) return x; }
    const b = baseOf(score);
    return (b && L.find((s2) => baseOf(s2.name) === b)) || null;
  }
  function curSong() {
    const sel = $("muPlaySound"), v = sel ? sel.value : "";
    return v && v !== "synth" ? (S.songs || []).find((x) => "song:" + keyOf(x) === v) || null : null;
  }
  function soundOptions() {
    const sel = $("muPlaySound");
    if (!sel) return;
    const pick = songChoice(S.name);
    sel.innerHTML = '<option value="synth">🎹 the notes (no recording)</option>' + (S.songs || []).map((x) => `<option value="song:${esc(keyOf(x))}">🎵 ${esc(x.name)}${x.layers ? (x.layers.drums ? " · 4 layers" : " · 2 layers") : ""}</option>`).join("");
    sel.value = pick ? "song:" + keyOf(pick) : "synth";
  }
  function laneList(song) {
    if (!song) return [];
    if (song.layers) return LAYER_ORDER.filter((k) => song.layers[k]).map((k) => ({ key: k, src: "sound", name: song.layers[k] }));
    return [{ key: "song", src: song.src, name: song.name }];
  }
  const WAVES = {};
  function peaksOf(src, name) {
    const k = src + "/" + name;
    if (!WAVES[k]) WAVES[k] = root.fetch("/api/waveform?src=" + encodeURIComponent(src) + "&name=" + encodeURIComponent(name)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return WAVES[k];
  }
  function drawWave(c, w, key) {
    if (!c) return;
    if (w !== undefined) c._w = w;
    w = c._w;
    const dpr = root.devicePixelRatio || 1, W = Math.max(1, Math.round(c.clientWidth * dpr)), H = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const g = c.getContext && c.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, W, H);
    const pk = (w && w.peaks) || [];
    c.dataset.peaks = String(pk.length);
    if (!pk.length) return;
    g.fillStyle = LAYER_COL[key] || LAYER_COL.song;
    const bar = Math.max(1, Math.round(2 * dpr)), mid = H / 2;
    for (let x = 0; x < W; x += bar + 1) {
      let m = 0;
      const i0 = Math.floor(x / W * pk.length), i1 = Math.max(i0 + 1, Math.floor((x + bar) / W * pk.length));
      for (let i = i0; i < i1 && i < pk.length; i++) if (pk[i] > m) m = pk[i];
      const h = Math.max(1, m / 255 * (H - 2 * dpr));
      g.fillRect(x, mid - h / 2, bar, h);
    }
  }
  function layersBuild() {
    const box = $("muLayers");
    if (!box) return;
    const song = PB.player && PB.player.mode === "song" ? curSong() : null;
    if (!song) {
      const n = (S.songs || []).length;
      box.hidden = !(n && S.result && !S.result.empty);
      box.innerHTML = box.hidden ? "" : `<div class="muLaneBar"><span class="muMeta">Playing the written notes - pick the recording under <b>Sound</b> to hear the song itself, in its layers.</span></div>`;
      return;
    }
    const lanes = laneList(song), four = !!(song.layers && song.layers.drums);
    box.hidden = false;
    box.innerHTML = lanes.map((l) => `<div class="muLane${S.trackOff[l.key] ? " off" : ""}" data-lane="${l.key}">`
      + (l.key === "song" ? `<span class="muLaneName" title="${esc(l.name)}">Song</span>`
        : `<button type="button" class="ghost muMix" data-track="${l.key}" aria-pressed="${!S.trackOff[l.key]}" title="${esc(LAYER_NAME[l.key])} (${esc(l.name)}) - click: on / off · Shift+click: only this one">${LAYER_NAME[l.key]}</button>`)
      + `<div class="muWave" data-key="${l.key}" title="${esc(l.name)} - click to play from there"><canvas></canvas><i class="muPlayed"></i><i class="muHead"></i></div></div>`).join("")
      + (four ? "" : `<div class="muLaneBar"><button type="button" class="ghost" id="muStemSep" title="Split ${esc(song.name)} into four layers - vocals, drums, bass and the other instruments (demucs, on this computer) - each with its waveform and on / off">✂ Split into layers</button>`
        + `<span class="muMeta">${song.layers ? "vocals + instruments now - split it for the drums, the bass and the rest" : "one recording - split it to hear each layer on its own"}</span></div>`);
    lanes.forEach((l) => { const c = box.querySelector(`[data-lane="${l.key}"] canvas`); peaksOf(l.src, l.name).then((w) => drawWave(c, w, l.key)); });
    lanesPaint();
  }
  function lanesPaint() {
    const a = PB.player && PB.player.audio;
    if (!a) return;
    const f = Number.isFinite(a.duration) && a.duration > 0 ? Math.max(0, Math.min(1, a.currentTime / a.duration)) : 0;
    Array.prototype.forEach.call(doc.querySelectorAll("#muLayers .muWave"), (w) => {
      const h = w.querySelector(".muHead"), pl = w.querySelector(".muPlayed");
      if (h) h.style.left = (f * 100).toFixed(3) + "%";
      if (pl) pl.style.width = (f * 100).toFixed(3) + "%";
    });
  }
  function laneSeek(w, clientX) {
    const a = PB.player && PB.player.audio, r = w.getBoundingClientRect();
    if (!a || !Number.isFinite(a.duration) || !r.width) return;
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * a.duration;
    PB.player.seek(t - syncRead(S.name));
    test("mu_score_lane_seek", t.toFixed(2));
  }
  let waveT = 0;
  root.addEventListener && root.addEventListener("resize", () => { clearTimeout(waveT); waveT = setTimeout(() => Array.prototype.forEach.call(doc.querySelectorAll("#muLayers canvas"), (c) => drawWave(c, undefined, c.closest(".muLane").dataset.lane)), 150); });
  function mixBuild() {                                  // the notes: a toggle per staff (the song's layers have their lanes)
    const box = $("muPlayMix"), r = S.result;
    if (!box) return;
    const synth = !PB.player || PB.player.mode === "synth";
    box.innerHTML = synth && r && r.parts && r.parts.length > 1 ? '<span class="muMixL">Play</span>' + r.parts.map((p) => `<button type="button" class="ghost muMix" data-staff="${p.i}" aria-pressed="${!S.mute[p.i]}"`
      + ` title="${esc(p.name)} - click: on / off · Shift+click: only this one">${esc(p.name)}</button>`).join("") + '<span class="muSep"></span>' : "";
  }
  function mixToggle(b, solo) {
    if (!PB.player) return;
    if (b.dataset.track) {
      const k = b.dataset.track, keys = laneList(curSong()).map((l) => l.key).filter((x) => x !== "song");
      if (solo) {
        const alone = keys.every((x) => !!S.trackOff[x] === (x !== k));
        keys.forEach((x) => { S.trackOff[x] = alone ? false : x !== k; });
      } else S.trackOff[k] = !S.trackOff[k];
      keys.forEach((x) => PB.player.setTrack(x, !S.trackOff[x]));
      Array.prototype.forEach.call(doc.querySelectorAll("#muLayers .muLane"), (ln) => {
        const off = !!S.trackOff[ln.dataset.lane]; ln.classList.toggle("off", off);
        const bt = ln.querySelector(".muMix"); if (bt) bt.setAttribute("aria-pressed", String(!off));
      });
      test("mu_score_mix", keys.map((x) => x + (S.trackOff[x] ? " off" : " on")).join(", "));
      return;
    }
    const v = +b.dataset.staff, ps = (S.result && S.result.parts) || [];
    if (solo) {
      const alone = ps.every((p) => !!S.mute[p.i] === (p.i !== v));
      ps.forEach((p) => { S.mute[p.i] = alone ? false : p.i !== v; });
    } else S.mute[v] = !S.mute[v];
    PB.player.remix();
    test("mu_score_mix", ps.map((p) => p.name + (S.mute[p.i] ? " off" : " on")).join(", "));
    mixBuild();
  }
  function separate() {
    const song = curSong(), btn = $("muStemSep");
    if (!song) return Promise.resolve(null);
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Splitting…"; }
    status("✂ splitting " + song.name + " into vocals, drums, bass and the rest (demucs, on this computer) - a song takes a minute or two…");
    return root.fetch("/api/stems/separate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: song.name, layers: 4 }) })
      .then((x) => x.json()).then((j) => {
        if (j.error) throw new Error(j.error);
        const at = PB.player ? Math.max(0, PB.player.position()) : 0;
        return refresh(S.name).then(() => {
          soundOptions();
          const sel = $("muPlaySound"); if (sel) sel.value = "song:" + keyOf(song);
          playMake(at);
          status("✂ " + song.name + " split into its layers: " + ["vocals", "drums", "bass", "other"].filter((k) => j[k]).join(", ") + " - each lane turns on and off");
          test("mu_score_stems", Object.keys(j).filter((k) => k !== "ok").join(" "));
          return j;
        });
      })
      .catch((e) => { status("⚠ could not split the song: " + ((e && e.message) || e)); if (btn) { btn.disabled = false; btn.textContent = "✂ Split into layers"; } return null; });
  }

  // 🗣 WORDS (2.734.0, Tim: "can we add a checkbox in the sheetmusic tab to add the words, add the lyrics of the song that
  // is being worked on in the lyrics input"): the tick puts the Song tab's lyrics (#muLyrics) under the vocal staff
  // (AbcScore.render's lyrics); ticking, unticking or editing the lyrics draws the score again. The tick is kept per viewer.
  const WORDS_KEY = "h3.muScoreWords";
  function wordsOn() { const c = $("muScoreWords"); return !!(c && c.checked); }
  function lyricsNow() { const t = $("muLyrics"); return t ? String(t.value || "") : ""; }
  function redraw() { if (S.text) show(S.text, S.name, "🎼 "); }
  function words(on) {
    const c = $("muScoreWords");
    if (c && on != null) { c.checked = !!on; try { root.localStorage.setItem(WORDS_KEY, c.checked ? "1" : "0"); } catch (e) { /* this page only */ } redraw(); }
    return wordsOn();
  }
  let lyrT = 0;
  doc.addEventListener("input", (e) => {                 // the lyrics edited while the words show: drawn again a moment later
    if (!e.target || e.target.id !== "muLyrics" || !wordsOn() || !S.text) return;
    clearTimeout(lyrT);
    lyrT = setTimeout(() => { if (!(PB.player && PB.player.playing())) redraw(); }, 700);
  });

  // ▶ PLAYBACK (2.733.0, Tim: "add media buttons play/pause, rewind,rewind to start,foward , foward to end buttons for the
  // songs sheet music and highlight the notes as the song is played"): ext/musicdock/scoreplayer.js. The song beside the
  // .abc (the same name, an audio file - GET /api/scores says which) or the notes played by the browser; every frame the
  // notes sounding get .abcOn (their heads carry data-n from the engraver), the bar a soft band, the page follows.
  const PL = () => root.ScorePlayer;
  // 2.736.0: the transport's icons, drawn - ⏪ / ⏩ were colour emoji beside plain ⏮ / ⏭ (the same in the tab and ⛶ Read)
  const ICONS = {"start": "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><rect x=\"2.5\" y=\"3\" width=\"2\" height=\"10\" rx=\".5\"/><path d=\"M13.5 3.2v9.6L5.5 8z\"/></svg>", "back": "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M8 3.2v9.6L1 8zM15 3.2v9.6L8 8z\"/></svg>", "play": "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M4.5 2.6v10.8L13.5 8z\"/></svg>", "fwd": "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M1 3.2v9.6L8 8zM8 3.2v9.6L15 8z\"/></svg>", "end": "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M2.5 3.2v9.6l8-4.8z\"/><rect x=\"11.5\" y=\"3\" width=\"2\" height=\"10\" rx=\".5\"/></svg>", "pause": "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><rect x=\"3.5\" y=\"3\" width=\"3\" height=\"10\" rx=\".6\"/><rect x=\"9.5\" y=\"3\" width=\"3\" height=\"10\" rx=\".6\"/></svg>"};
  const PB = { player: null, lit: [], els: {}, bands: [], bar: -2, playing: false, wels: {}, wlit: [] };
  const SYNC_KEY = "h3.muScoreSync";
  function syncRead(name) { try { const m = JSON.parse(root.localStorage.getItem(SYNC_KEY) || "{}"); return +m[name] || 0; } catch (e) { return 0; } }
  function syncSave(name, v) { try { const m = JSON.parse(root.localStorage.getItem(SYNC_KEY) || "{}"); m[name] = v; root.localStorage.setItem(SYNC_KEY, JSON.stringify(m)); } catch (e) { /* this page only */ } }
  function playStop() { if (PB.player) { try { PB.player.destroy(); } catch (e) { /* gone */ } } PB.player = null; PB.lit = []; PB.wlit = []; PB.bar = -2; PB.playing = false; }
  function playButtons(on) {
    Array.prototype.forEach.call(doc.querySelectorAll("#muPlayBar [data-act], #muSvPlay [data-act]"), (b) => { b.disabled = !on; });
    ["muPlaySound", "muPlaySync"].forEach((id) => { const x = $(id); if (x) x.disabled = !on; });
  }
  /** the note heads (data-n) and a bar band in every page of the tab and of ⛶ Read - again after any redraw */
  function relight() {
    PB.els = {}; PB.bands = []; PB.wels = {};
    Array.prototype.forEach.call(doc.querySelectorAll("#muScore .muPaper svg, #muSvPages svg"), (svg) => {
      Array.prototype.forEach.call(svg.querySelectorAll("path[data-n]"), (el) => { (PB.els[el.getAttribute("data-n")] = PB.els[el.getAttribute("data-n")] || []).push(el); });
      // 2.735.0: the sung syllables (data-w) - lit while they are sung
      Array.prototype.forEach.call(svg.querySelectorAll("text[data-w]"), (el) => { (PB.wels[el.getAttribute("data-w")] = PB.wels[el.getAttribute("data-w")] || []).push(el); });
      const band = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
      band.setAttribute("class", "abcBar"); band.setAttribute("width", "0"); band.setAttribute("height", "0");
      const first = svg.querySelector("path");
      svg.insertBefore(band, first || null);
      PB.bands.push({ svg, band, page: Array.prototype.indexOf.call(svg.closest("#muScore, #muSvPages").querySelectorAll("svg"), svg), box: svg.closest("#muScore, #muSvPages") });
    });
    const lit = PB.lit; PB.lit = []; PB.wlit = []; PB.bar = -2;
    if (PB.player) paint(PB.player.position(), PL().tickAt(S.result.timing, PB.player.position()));
    else lit.length = 0;
  }
  function playSetup() {
    const T = S.result && S.result.timing, P2 = PL();
    if (!T || !P2 || !S.result.pages.length) { playButtons(false); return; }
    soundOptions();
    const sync = $("muPlaySync");
    if (sync) sync.value = String(syncRead(S.name));
    relight();
    playMake(0);
    playButtons(true);
  }
  function playMake(at) {
    const T = S.result.timing, P2 = PL();
    if (PB.player) PB.player.destroy();
    const song = curSong();                                  // 2.738.0: the recording, as its layers when it has them
    if ($("muPlaySyncL")) $("muPlaySyncL").classList.toggle("hidden", !song);
    const lanes = laneList(song);
    const tracks = song && song.layers ? lanes.map((l) => ({ key: l.key, url: urlOf("sound", l.name), on: !S.trackOff[l.key] })) : null;
    PB.player = P2.create({ timing: T, audioUrl: song && !song.layers ? urlOf(song.src, song.name) : "", tracks, offset: song ? syncRead(S.name) : 0,
      isMuted: (v) => !!S.mute[v],
      onFrame: paint, onError: (e) => status("⚠ could not play: " + ((e && e.message) || e)) });
    mixBuild();
    layersBuild();
    if (at) PB.player.seek(at);
    paint(PB.player.position(), P2.tickAt(T, PB.player.position()));
  }
  function paint(sec, tick) {
    const T = S.result && S.result.timing, P2 = PL();
    if (!T || !PB.player) return;
    const playing = PB.player.playing();
    const dur = PB.player.duration();
    const tt = P2.fmt(Math.max(0, sec)) + " / " + P2.fmt(dur);
    if ($("muPlayTime")) $("muPlayTime").textContent = tt;
    if ($("muSvTime")) $("muSvTime").textContent = tt;
    PB.playing = playing;
    lanesPaint();
    ["muPlayToggle", "muSvToggle"].forEach((id) => {
      const b = $(id), ic = playing ? "pause" : "play";
      if (b && b.dataset.icon !== ic) { b.dataset.icon = ic; b.innerHTML = ICONS[ic]; b.title = playing ? "Pause" : "Play - the notes light up as they sound"; b.setAttribute("aria-label", playing ? "Pause" : "Play"); }
    });
    // the notes sounding now
    const now = P2.activeAt(T, tick).map(String);
    const keep = new Set(now);
    PB.lit.forEach((id) => { if (!keep.has(id)) (PB.els[id] || []).forEach((el) => el.classList.remove("abcOn")); });
    now.forEach((id) => (PB.els[id] || []).forEach((el) => el.classList.add("abcOn")));
    PB.lit = now;
    // 2.735.0 (Tim: "can the words be highlighted as the song is sung?"): the syllable being sung, held through its tie / slur
    const wnow = P2.wordsAt ? P2.wordsAt(T, tick).map(String) : [];
    const wkeep = new Set(wnow);
    PB.wlit.forEach((id) => { if (!wkeep.has(id)) (PB.wels[id] || []).forEach((el) => el.classList.remove("abcOn")); });
    wnow.forEach((id) => (PB.wels[id] || []).forEach((el) => el.classList.add("abcOn")));
    PB.wlit = wnow;
    // the bar: its band, its number, the page following it
    const bi = tick >= 0 && tick < T.total ? P2.barAt(T, tick) : -1;
    if ($("muPlayBarNo")) $("muPlayBarNo").textContent = bi >= 0 ? "bar " + (bi + 1) + " / " + T.barStarts.length : "bar –";
    if (bi === PB.bar) return;
    PB.bar = bi;
    const b = bi >= 0 ? T.bars[bi] : null;
    PB.bands.forEach((x) => {
      const on = b && x.page === b.page;
      x.band.setAttribute("x", on ? b.x0 : 0); x.band.setAttribute("y", on ? b.y0 : 0);
      x.band.setAttribute("width", on ? Math.max(0, b.x1 - b.x0) : 0); x.band.setAttribute("height", on ? Math.max(0, b.y1 - b.y0) : 0);
      if (on && playing && ($("muPlayFollow") || { checked: true }).checked) follow(x, b);
    });
  }
  /** keep the playing bar's system in view of its scroll box */
  function follow(x, b) {
    const box = x.box, paperEl = x.svg.parentElement, pg = S.result.pages[b.page];
    if (!box || !paperEl || !pg) return;
    const k = x.svg.getBoundingClientRect().height / pg.h;
    const top = paperEl.offsetTop + b.y0 * k, bot = paperEl.offsetTop + b.y1 * k;
    if (top < box.scrollTop || bot > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, top - 24);
  }
  function playAct(act) {
    const p = PB.player;
    if (!p) return;
    if (act === "toggle") p.toggle().then(() => paint(p.position(), PL().tickAt(S.result.timing, p.position())));
    else if (act === "start") p.toStart();
    else if (act === "back") p.back();
    else if (act === "fwd") p.forward();
    else if (act === "end") p.toEnd();
    test("mu_score_play", act + " " + p.mode);
  }

  // 🎨 Paper (2.732.0, Tim: "allow user to choose background color/material tiling for the sheet music"): the paper's
  // colour, a material repeated across it (or a picture), its size and strength, the ink - ext/musicdock/scorepaper.js
  /** the pages again in the current paper (the layout is kept - only the drawing changes) */
  function repaint() {
    const A = root.AbcScore, r = S.result;
    if (!A || !r || r.empty) return;
    const box = $("muScore");
    Array.prototype.forEach.call(box.querySelectorAll(".muPaper"), (d, k) => { if (r.pages[k]) d.innerHTML = svgOf(r.pages[k], k, "m"); });
    if (view() && view().open) fillView();
    relight();
  }
  function paperRead() {
    const v = (id) => ($(id) || {}).value;
    const mat = v("muPaperMat") || "plain";
    const pic = mat.indexOf("pic:") === 0 ? { src: "/passets/images/" + mat.slice(4), name: mat.slice(4) } : mat === "picture" ? (S.paper && S.paper.picture) : null;
    return { color: v("muPaperColor"), material: pic ? "picture" : mat, picture: pic, size: v("muPaperSize"), strength: v("muPaperStrength"),
      ink: v("muPaperInk"), pdf: !!($("muPaperPdf") || {}).checked };
  }
  function paperFill(s) {
    if (!$("muPaperColor")) return;
    $("muPaperColor").value = s.color; $("muPaperSize").value = s.size; $("muPaperStrength").value = s.strength;
    $("muPaperInk").value = s.ink; $("muPaperPdf").checked = s.pdf;
    const sel = $("muPaperMat");
    const want = s.material === "picture" && s.picture ? (s.picture.src.indexOf("/passets/images/") === 0 ? "pic:" + s.picture.src.slice(16) : "picture") : s.material;
    if (want === "picture" && !Array.prototype.some.call(sel.options, (o) => o.value === "picture")) {
      const o = doc.createElement("option"); o.value = "picture"; o.textContent = "🖼 " + (s.picture.name || "picture");
      (sel.querySelector('optgroup[data-g="pics"]') || sel).appendChild(o);
    }
    if (want.indexOf("pic:") === 0 && !Array.prototype.some.call(sel.options, (o) => o.value === want)) {
      const o = doc.createElement("option"); o.value = want; o.textContent = "🖼 " + want.slice(4);
      (sel.querySelector('optgroup[data-g="pics"]') || sel).appendChild(o);
    }
    sel.value = want;
    const tex = s.material !== "plain";
    $("muPaperSize").disabled = !tex; $("muPaperStrength").disabled = !tex;
    $("muPaperSizeV").textContent = s.size + " pt"; $("muPaperStrengthV").textContent = s.strength + "%";
    Array.prototype.forEach.call(doc.querySelectorAll("#muPaperSwatches button"), (b) => b.setAttribute("aria-pressed", b.dataset.color === s.color ? "true" : "false"));
  }
  let paperSeq = 0;
  /** apply settings: keep them, make the tile, repaint -> Promise<look> */
  function setPaper(o, quiet) {
    const SP = P();
    if (!SP) return Promise.resolve(null);
    const s = SP.save(o);
    S.paper = s;
    paperFill(s);
    const seq = ++paperSeq;
    return SP.look(s).then((lk) => {
      if (seq !== paperSeq) return null;                  // a newer choice won
      S.look = lk;
      repaint();
      const m = SP.MATERIALS.find((x) => x.id === s.material);
      if (!quiet) status("🎨 paper: " + (s.material === "picture" ? "🖼 " + (s.picture && s.picture.name) : m ? m.label : s.material) + " on " + s.color + ", ink " + lk.ink
        + (s.pdf ? "" : " (the PDF stays plain white)"));
      test("mu_score_paper", s.material + " " + s.color + " " + lk.ink);
      return lk;
    }).catch((e) => { status("⚠ the paper could not be made: " + ((e && e.message) || e)); return null; });
  }
  function paperBuild() {
    const SP = P(), sel = $("muPaperMat");
    if (!SP || !sel || sel.dataset.built) return;
    sel.dataset.built = "1";
    sel.innerHTML = "";
    const g1 = doc.createElement("optgroup"); g1.label = "Materials";
    SP.MATERIALS.forEach((m) => { const o = doc.createElement("option"); o.value = m.id; o.textContent = m.label; g1.appendChild(o); });
    const g2 = doc.createElement("optgroup"); g2.label = "Pictures"; g2.dataset.g = "pics";
    const f = doc.createElement("option"); f.value = "file:"; f.textContent = "📂 From this computer…"; g2.appendChild(f);
    sel.appendChild(g1); sel.appendChild(g2);
    const ink = $("muPaperInk");
    ink.innerHTML = "";
    [["auto", "Auto"], ["black", "Black"], ["sepia", "Sepia"], ["navy", "Navy"], ["white", "White"]].forEach((p2) => { const o = doc.createElement("option"); o.value = p2[0]; o.textContent = p2[1]; ink.appendChild(o); });
    const sw = $("muPaperSwatches");
    sw.innerHTML = "";
    SP.PRESETS.forEach((p2) => {
      const b = doc.createElement("button");
      b.type = "button"; b.className = "muSwatch"; b.dataset.color = p2.color; b.title = p2.label; b.setAttribute("aria-label", p2.label + " paper");
      b.style.background = p2.color; sw.appendChild(b);
    });
    // the project's pictures, as materials
    root.fetch("/api/passets?scope=project").then((r) => r.json()).then((j) => {
      (j.images || []).slice(0, 200).forEach((a) => {
        const v = "pic:" + a.name;
        if (Array.prototype.some.call(sel.options, (o) => o.value === v)) return;
        const o = doc.createElement("option"); o.value = v; o.textContent = "🖼 " + a.name; g2.appendChild(o);
      });
      if (S.paper) paperFill(S.paper);
    }).catch(() => { /* no project pictures */ });
    paperFill(S.paper || SP.load());
  }
  function paperToggle() {
    const row = $("muPaperRow"), b = $("muPaperBtn");
    if (!row) return;
    paperBuild();
    const on = row.classList.toggle("hidden") === false;
    if (b) b.setAttribute("aria-pressed", on ? "true" : "false");
  }

  // the controls (the dock's html may arrive after this script: listeners on the document)
  doc.addEventListener("click", (e) => {
    const tg = e.target && e.target.closest ? e.target : null;
    const pt = tg && tg.closest("#muParts [data-part]");
    if (pt) { e.preventDefault(); setPart(pt.getAttribute("data-part")); return; }
    const mx = tg && tg.closest("#muPlayMix .muMix, #muLayers .muMix");
    if (mx) { e.preventDefault(); mixToggle(mx, e.shiftKey); return; }
    if (tg && tg.closest("#muStemSep")) { e.preventDefault(); separate(); return; }
    const wv = tg && tg.closest("#muLayers .muWave");
    if (wv) { e.preventDefault(); laneSeek(wv, e.clientX); return; }
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("#muScorePdf") || t.closest("#muSvPdf")) { e.preventDefault(); savePdf(); return; }
    if (t.closest("#muScoreBig")) { e.preventDefault(); openView(); return; }
    if (t.closest("#muSvClose")) { e.preventDefault(); const d = view(); if (d) d.close(); return; }
    if (t.closest("#muPaperBtn")) { e.preventDefault(); paperToggle(); return; }
    const pa = t.closest("#muPlayBar [data-act], #muSvPlay [data-act]");
    if (pa) { e.preventDefault(); playAct(pa.getAttribute("data-act")); return; }
    const word = t.closest && t.closest("#muScore text[data-w], #muSvPages text[data-w]");
    if (word && PB.player && S.result && S.result.timing && S.result.timing.words) {   // 2.735.0: a word clicked - sing from it
      const w = S.result.timing.words[+word.getAttribute("data-w")];
      if (w) { PB.player.seek(PL().secAt(S.result.timing, w.t0)); test("mu_score_wseek", String(w.id)); }
      return;
    }
    const note = t.closest && t.closest("#muScore path[data-n], #muSvPages path[data-n]");
    if (note && PB.player && S.result && S.result.timing) {               // a note clicked: play from it
      const n = S.result.timing.notes[+note.getAttribute("data-n")];
      if (n) { PB.player.seek(PL().secAt(S.result.timing, n.t0)); test("mu_score_seek", String(n.id)); }
      return;
    }
    const sw = t.closest("#muPaperSwatches button");
    if (sw) { e.preventDefault(); $("muPaperColor").value = sw.dataset.color; setPaper(paperRead()); return; }
    if (t.closest("#muPaperReset")) { e.preventDefault(); setPaper(Object.assign({}, P().DEFAULTS, { pdf: S.paper ? S.paper.pdf : true })); return; }
    if (t.closest("#muScoreRefresh")) { e.preventDefault(); refresh(); return; }
    if (t.closest("#muAbcToggle")) {
      e.preventDefault();
      const pre = $("muAbc"), b = $("muAbcToggle");
      const on = pre.classList.toggle("hidden") === false;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      return;
    }
    const tab = t.closest('button[data-mutab="sheet"]');
    if (tab) first();
  });
  doc.addEventListener("input", (e) => {                 // the sliders say their value as they move
    const t = e.target;
    if (t && t.id === "muPaperSize") $("muPaperSizeV").textContent = t.value + " pt";
    if (t && t.id === "muPaperStrength") $("muPaperStrengthV").textContent = t.value + "%";
  });
  doc.addEventListener("change", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === "muScoreList") { if (t.value) load(t.value); return; }
    if (t.id === "muSheetRef") { const f = t.files && t.files[0], n = $("muSheetRefName"); if (n) n.textContent = f ? f.name : "Audio file…"; return; }   // 2.736.0
    if (t.id === "muScoreWords") { try { root.localStorage.setItem(WORDS_KEY, t.checked ? "1" : "0"); } catch (er) { /* this page only */ } redraw(); test("mu_score_words", t.checked ? "on" : "off"); return; }
    if (t.id === "muPlaySound") { const at = PB.player ? Math.max(0, PB.player.position()) : 0; songMapSave(S.name, t.value === "synth" ? "synth" : t.value.slice(5)); S.trackOff = {}; playMake(at); return; }
    if (t.id === "muPlaySync") {
      const v = Math.max(-60, Math.min(120, parseFloat(t.value) || 0));
      syncSave(S.name, v);
      if (PB.player && PB.player.mode === "song") PB.player.setOffset(v);
      if (PB.player) paint(PB.player.position(), PL().tickAt(S.result.timing, PB.player.position()));
      return;
    }
    if (t.id === "muPaperMat" && t.value === "file:") { paperFill(S.paper || P().load()); const f = $("muPaperFile"); if (f) f.click(); return; }
    if (/^muPaper(Color|Mat|Size|Strength|Ink|Pdf)$/.test(t.id)) { setPaper(paperRead()); return; }
    if (t.id === "muPaperFile") {
      const f = t.files && t.files[0];
      if (!f) return;
      P().shrink(f).then((src) => {
        const sel = $("muPaperMat");
        Array.prototype.forEach.call(sel.querySelectorAll('option[value="picture"]'), (o) => o.remove());
        setPaper(Object.assign(paperRead(), { material: "picture", picture: { src, name: f.name } }));
      }, (e) => status("⚠ " + ((e && e.message) || e)));
      t.value = "";
    }
    if (t.id === "muAbcFile") {
      const f = t.files && t.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { show(String(rd.result || ""), f.name, "📂 "); t.value = ""; };
      rd.onerror = () => status("could not read " + f.name);
      rd.readAsText(f);
    }
  });
  /** the first time the tab opens: list the project's scores and draw the newest (when nothing is drawn yet) */
  function first() {
    if (S.listed) return;
    refresh().then((files) => { if (!S.text && files.length) load(files[0].name); });
  }
  function boot() {
    try { const c = $("muScoreWords"); if (c) c.checked = root.localStorage.getItem(WORDS_KEY) === "1"; } catch (e) { /* default off */ }
    paperBuild();                                         // the 🎨 Paper row's lists (shown or not)
    if (P()) setPaper(P().load(), true);                  // the paper this viewer chose last time
    const p = $("muPaneSheet"); if (p && !p.classList.contains("hidden")) first();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => setTimeout(boot, 400)); else setTimeout(boot, 400);

  root.MuScore = { show, load, refresh, savePdf, openView, setPaper, paperToggle, titleFrom, state: S, player: () => PB.player, playAct, words, ICONS, setPart, separate };
}(typeof window !== "undefined" ? window : this));
