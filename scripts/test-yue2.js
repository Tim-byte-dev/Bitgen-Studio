#!/usr/bin/env node
/* bitGen Studio — YuE2 music integration (2.236.0, Tim's yue2_full.json:
   "integrate this workflow into our music docker, add a tab to our music
   docker for sheet music and tabs for each of yue2's capabilities").

   The four API graphs are DERIVED from Tim's UI export with node schemas
   read from ComfyUI's own source (the never-guess rule); these legs hold
   the derivation still: the wiring, the passthroughs, the patcher's
   class-targeted pass (exercised LIVE through python, not just pinned),
   the worker's sheet handling, the route's variants, and the dock's tabs. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const wf = (n) => JSON.parse(read("comfy_workflows", n));

// ---- the four graphs: shape and wiring -----------------------------------
{
  const g = wf("audio_yue2.json");
  const classes = Object.values(g).map((n) => n.class_type).sort();
  check("generate graph: the export's active path, Notes and the dangling plain decode pruned",
    JSON.stringify(classes) === JSON.stringify(["CheckpointLoaderSimple", "EmptyYuE2LatentAudio",
      "KSampler", "PreviewAny", "SaveAudioAdvanced", "VAEDecodeAudioTiled",
      "YuE2GenerateABC", "YuE2GenerateMusic"].sort()), classes);
  check("the song is WRITTEN AS A SCORE FIRST: GenerateABC → PreviewAny → GenerateMusic.abc",
    JSON.stringify(g["14"].inputs.source) === JSON.stringify(["23", 0])
    && JSON.stringify(g["22"].inputs.abc) === JSON.stringify(["14", 0]));
  check("the latent's length is the sung length: seconds LINKED from GenerateMusic",
    JSON.stringify(g["5"].inputs.seconds) === JSON.stringify(["22", 1]));
  check("KSampler rides the export's own values (dpm_2 / sgm_uniform / 32 / cfg 1)",
    g["8"].inputs.sampler_name === "dpm_2" && g["8"].inputs.scheduler === "sgm_uniform"
    && g["8"].inputs.steps === 32 && g["8"].inputs.cfg === 1);
  check("the save is the export's: SaveAudioAdvanced, flac, tiled decode feeding it",
    g["10"].class_type === "SaveAudioAdvanced" && g["10"].inputs.format === "flac"
    && JSON.stringify(g["10"].inputs.audio) === JSON.stringify(["17", 0]));
}
{
  const g = wf("audio_yue2_cover.json");
  check("cover graph: LoadAudio → SheetSage2 → PreviewAny → GenerateMusic.abc (the export's own Note), melody modes on both",
    JSON.stringify(g["19"].inputs.audio) === JSON.stringify(["20", 0])
    && JSON.stringify(g["21"].inputs.source) === JSON.stringify(["19", 0])
    && JSON.stringify(g["22"].inputs.abc) === JSON.stringify(["21", 0])
    && g["19"].inputs.mode === "melody" && g["22"].inputs.mode === "melody");
  check("cover graph: the lyrics-ABC generator is gone (one score source per graph)",
    !g["23"] && !g["14"] && g["18"].class_type === "AudioEncoderLoader");
}
check("abc graph: exactly checkpoint + GenerateABC + PreviewAny (a score, no audio)",
  (() => { const g = wf("audio_yue2_abc.json");
    return Object.keys(g).sort().join(",") === "14,15,23"
      && JSON.stringify(g["14"].inputs.source) === JSON.stringify(["23", 0]); })());
check("transcribe graph: exactly encoder + LoadAudio + SheetSage2 + PreviewAny",
  (() => { const g = wf("audio_yue2_transcribe.json");
    return Object.keys(g).sort().join(",") === "18,19,20,21"; })());

// ---- the patcher, LIVE: all four graphs through comfy_image.patch --------
{
  const py = `
import json, importlib.util
spec = importlib.util.spec_from_file_location("ci", "scripts/comfy_image.py")
ci = importlib.util.module_from_spec(spec); spec.loader.exec_module(ci)
style = {"kind": "music", "name": "t", "caption": "CAP"}
res = {}
for wf, params in (("audio_yue2.json", {"prompt": "LYR", "seed": 42, "batch": 2, "max_duration": 90}),
                   ("audio_yue2_cover.json", {"prompt": "LYR", "seed": 42, "ref_audio": "up.wav"}),
                   ("audio_yue2_abc.json", {"prompt": "LYR", "want": "abc", "seed": 42}),
                   ("audio_yue2_transcribe.json", {"want": "abc", "ref_audio": "up.wav"})):
    g = json.load(open("comfy_workflows/" + wf))
    try:
        out, rep = ci.patch(g, style, params)
        res[wf] = {"ok": True,
                   "m": out.get("22", {}).get("inputs", {}),
                   "a": out.get("23", {}).get("inputs", {}),
                   "lat": out.get("5", {}).get("inputs", {}),
                   "load": out.get("20", {}).get("inputs", {})}
    except Exception as e:
        res[wf] = {"ok": False, "err": str(e)}
print(json.dumps(res))
`;
  let r = null;
  try {
    r = JSON.parse(execFileSync("python3", ["-c", py],
      { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 }).trim());
  } catch (e) { check("patch harness runs", false, String(e).slice(0, 200)); }
  if (r) {
    const gen = r["audio_yue2.json"], cov = r["audio_yue2_cover.json"],
      abc = r["audio_yue2_abc.json"], tr = r["audio_yue2_transcribe.json"];
    check("LIVE patch: generate — lyrics and style land on BOTH yue2 nodes, seed everywhere, batch on the latent, duration on max_duration only",
      gen.ok && gen.m.lyrics === "LYR" && gen.m.style === "CAP"
      && gen.a.lyrics === "LYR" && gen.a.style === "CAP"
      && gen.m.seed === 42 && gen.a.seed === 42
      && gen.lat.batch_size === 2 && gen.m.max_duration === 90
      && JSON.stringify(gen.lat.seconds) === JSON.stringify(["22", 1]), gen);
    check("LIVE patch: cover — the uploaded reference lands on LoadAudio, the wired abc link survives",
      cov.ok && cov.load.audio === "up.wav"
      && JSON.stringify(cov.m.abc) === JSON.stringify(["21", 0]), cov);
    check("LIVE patch: abc-only — a graph with no sampler and no save is ACCEPTED for want=abc",
      abc.ok && abc.a.lyrics === "LYR" && abc.a.style === "CAP", abc);
    check("LIVE patch: transcribe — no prompt node at all is ACCEPTED for want=abc, ref lands",
      tr.ok && tr.load.audio === "up.wav", tr);
  }
}

// ---- the tooling that produced the graphs stays taught -------------------
{
  const U = read("scripts", "ui_to_api.py");
  check("ui_to_api knows the YuE2/audio widget orders (from ComfyUI's own schemas)",
    U.includes('"YuE2GenerateMusic": ["style", "lyrics", "abc", "seed",')
    && U.includes('"SheetSage2AudioToABC": ["mode"]')
    && U.includes('"EmptyYuE2LatentAudio": ["seconds", "batch_size"]')
    && U.includes('"YuE2GenerateABC": {"temperature": 0.7'));
}

// ---- worker, client, route, catalogue, starter ---------------------------
{
  const W = read("misc/music_worker.py");
  check("worker: the cover's reference uploads to ComfyUI before queueing",
    W.includes('p["ref_audio"] = _comfy.upload_image(base, str(rp))'));
  check("worker: want=abc collects the PreviewAny text and writes the .abc as THE output",
    W.includes('if str(p.get("want") or "") == "abc":')
    && W.includes('ext=".abc"'));
  check("worker: every song saves its score beside the audio, tolerantly",
    W.includes('sheet music written beside the song')
    && W.includes('the song stands alone'));
  const C = read("scripts", "comfy_client.py");
  check("client: output_text() reads the history's text payloads",
    C.includes("def output_text(outputs):") && C.includes('node_out.get("text")'));
  const P = read("scripts", "comfy_image.py");
  check("patcher: the YuE2 pass is CLASS-targeted and link-guarded; PreviewAny is the save for want=abc",
    P.includes('("YuE2GenerateMusic", "YuE2GenerateABC")')
    && P.includes('want == "abc" and has_preview_any')
    && P.includes('class_type") == "LoadAudio"'));
  const R = read("routes", "index.js");
  check("route: /api/genmusic takes the variant + the ref upload, JSON callers untouched",
    R.includes('app.post("/api/genmusic", upload.single("ref")')
    && R.includes('const variant = String(b.variant || "generate")')
    && R.includes("arch.workflow_cover_hint")
    && R.includes('p.want = "abc"'));
  check("route: sheet jobs render ONE score; the ref rides the job's own pre-made dir",
    R.includes('p.batch = p.want === "abc" ? 1 :')
    && R.includes("core.makeJob(p, pre.id, pre.dir)"));
  const A = JSON.parse(read("lib", "musicArch.json"));
  const y = (A.archs || []).find((a) => a.id === "yue2-comfy") || {};
  check("catalogue: the yue2-comfy arch carries all four workflow hints, the export's model names and defaults",
    y.engine === "comfy" && y.workflow_hint === "comfy_workflows/audio_yue2.json"
    && y.workflow_cover_hint === "comfy_workflows/audio_yue2_cover.json"
    && y.workflow_abc_hint === "comfy_workflows/audio_yue2_abc.json"
    && y.workflow_transcribe_hint === "comfy_workflows/audio_yue2_transcribe.json"
    && y.model_hint === "yue2_convrot_int8.safetensors"
    && y.audio_encoder_hint === "sheetsage2_bf16.safetensors"
    && (y.defaults || {}).sampler === "dpm_2"
    && A.samplers.includes("dpm_2"), y);
  const S = read("lib", "styles.js");
  check("starter: 'YuE2 ComfyUI' seeds with the export's workflow, model and caption",
    S.includes('name: "YuE2 ComfyUI", kind: "music", arch: "yue2-comfy"')
    && S.includes('workflow: "comfy_workflows/audio_yue2.json"')
    && S.includes('model: "yue2_convrot_int8.safetensors"'));
}

// ---- the dock: tabs and wiring -------------------------------------------
{
  const H = read("ext", "musicdock", "dock.html");
  check("dock: the tab bar with Song / Cover / Sheet Music, panes hidden off-tab",
    H.includes('id="muTabs"') && H.includes('data-mutab="song"')
    && H.includes('data-mutab="cover"') && H.includes('data-mutab="sheet"')
    && H.includes('id="muPaneCover" class="hidden"')
    && H.includes('id="muPaneSheet" class="hidden"')
    && H.includes('id="muPaneSong"'));
  check("dock: the Cover and Sheet controls exist (ref pickers, buttons, the ABC pane)",
    H.includes('id="muCoverRef"') && H.includes('id="goCover"')
    && H.includes('id="goSheetWrite"') && H.includes('id="goSheetTranscribe"')
    && H.includes('id="muSheetRef"') && H.includes('id="muAbc"')
    && H.includes('id="muAbcCopy"'));
  const J = read("ext", "musicdock", "musicdock.js");
  check("dock js: tabs remember (store, deferred), variants post the ONE route, the score fetches back into the pane",
    J.includes('store.set("mutab", name)')
    && J.includes('variant: "cover"') && J.includes('variant: "abc"')
    && J.includes('fetch("/api/genmusic"')
    && J.includes('fetch("/outputs/" + encodeURIComponent(name))')
    && J.includes("navigator.clipboard.writeText"));
  check("dock js: core globals only in deferred handlers (the TDZ rule): store restore rides a setTimeout, comfy-ready is typeof-guarded",
    J.includes('try { var t = store.get("mutab")')
    && J.includes('typeof ensureComfyReady === "function"'));
}

// ---- 2.238.0: "add a filetype to save the song to" — flac / mp3 / wav ----
{
  const W38 = read("misc/music_worker.py");
  check("2.238.0: to_format converts AFTER the render from lossless flac (lame V0 mp3, 16-bit wav), keeps the flac on any ffmpeg trouble, and BOTH engines call it",
    W38.includes("def to_format(path, fmt")
    && W38.includes('"mp3": ["-c:a", "libmp3lame", "-q:a", "0"]')
    && W38.includes('"wav": ["-c:a", "pcm_s16le"]')
    && W38.includes('to_format(dest, p.get("audio_format"), say)')
    && W38.includes('to_format(dest, params.get("audio_format"), say)'));
  check("2.238.0 LIVE: a real flac converts to wav and to mp3; an unknown format keeps the file; same-format is a no-op",
    (() => {
      const py = `
import importlib.util, subprocess, sys, tempfile, os
from pathlib import Path
sys.path.insert(0, "scripts")
spec = importlib.util.spec_from_file_location("mw", "misc/music_worker.py")
mw = importlib.util.module_from_spec(spec)
try: spec.loader.exec_module(mw)
except SystemExit: pass
d = Path(tempfile.mkdtemp())
src = d / "song-0001.flac"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                "sine=frequency=440:duration=0.3", "-c:a", "flac", str(src)], check=True)
w = mw.to_format(src, "wav"); ok_w = w.endswith(".wav") and (d / w).stat().st_size > 0 and not src.exists()
m = mw.to_format(d / w, "mp3"); ok_m = m.endswith(".mp3") and (d / m).stat().st_size > 0
k = mw.to_format(d / m, "ogg"); ok_k = k == m            # unknown format: kept
n = mw.to_format(d / m, "mp3"); ok_n = n == m            # same format: no-op
print("@@FMT " + str(ok_w and ok_m and ok_k and ok_n))`;
      const out = require("child_process").execFileSync("python3", ["-c", py],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@FMT True");
    })());
  const R38 = read("routes", "index.js");
  check("2.238.0: the route whitelists b.format into p.audio_format (anything else keeps flac)",
    R38.includes('if (["flac", "mp3", "wav"].includes(fmt)) p.audio_format = fmt;'));
  const H38 = read("static", "index.html");
  check("2.238.0: core's startMusicJob reads the dock's Save-as pick GUARDED (a core without the dock still sends)",
    H38.includes('const fmtEl = $("muFormat"); if (fmtEl && fmtEl.value) body.format = fmtEl.value;'));
  const D38 = read("ext", "musicdock", "dock.html");
  check("2.238.0: the Song pane carries the Save-as dropdown with exactly flac/mp3/wav",
    D38.includes('id="muFormat"')
    && D38.includes('<option value="flac">flac</option>')
    && D38.includes('<option value="mp3">mp3</option>')
    && D38.includes('<option value="wav">wav</option>'));
  const J38 = read("ext", "musicdock", "musicdock.js");
  check("2.238.0: the cover sends the pick too (never the abc variant — a score has no container), and the pick persists via store, deferred",
    J38.includes('opts.variant !== "abc" && fEl && fEl.value')
    && J38.includes('store.set("muformat"')
    && J38.includes('store.get("muformat")'));
}

// ---- 2.240.0: the menubar, and the tabs PROVEN ACTIVE --------------------
{
  const D40 = read("ext", "musicdock", "dock.html");
  const head = D40.slice(D40.indexOf('class="bhead"'), D40.indexOf('class="bbody"'));
  check("2.240.0: ONE menubar — tabs LEFT, 🎬 Create video RIGHT (margin-left:auto), and the head carries only title + maximize",
    D40.includes('id="muBar"')
    && D40.indexOf('id="muTabs"') > D40.indexOf('id="muBar"')
    && D40.indexOf('id="muVidBtn"') > D40.indexOf('id="muTabs"')
    && /id="muVidBtn" type="button" style="margin-left:auto"/.test(D40)
    && !head.includes("muVidBtn"));
  const H40 = read("static", "index.html");
  check("2.240.0: .mubar row CSS exists and #muPaneSong is FLEXED — the tab wrapper no longer breaks the lyrics height chain (the −10px is .bbody's own bottom padding)",
    H40.includes(".mubar { display: flex; align-items: center;")
    && H40.includes("#muPaneSong { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }")
    && H40.includes(".bdock .bbody { flex: 1; min-height: 0; padding: 0 11px 10px;"));
  const J40 = read("ext", "musicdock", "musicdock.js");
  check("2.240.0: tab switching is DELEGATED on the menubar (moving buttons can never detach it)",
    J40.includes('$("muBar") || $("muTabs")')
    && J40.includes('closest("button[data-mutab]")'));
  // the tabs, ACTIVE for real: the dock fragment + musicdock.js in jsdom,
  // a click on each tab, the panes actually switching
  check("2.240.0 LIVE: clicking Cover shows muPaneCover, Sheet shows muPaneSheet, Song comes back — in a real DOM",
    (() => {
      const { JSDOM } = require("jsdom");
      const dom = new JSDOM("<body>" + D40 + "</body>",
        { url: "http://localhost/", runScripts: "outside-only" });
      dom.window.fetch = () => Promise.resolve({ json: () => Promise.resolve({}) });
      try { dom.window.eval(J40); } catch (e) { return false; }
      const d = dom.window.document;
      const click = (sel) => d.querySelector(sel).dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }));
      const hidden = (id) => d.getElementById(id).classList.contains("hidden");
      click('button[data-mutab="cover"]');
      const coverOK = !hidden("muPaneCover") && hidden("muPaneSong") && hidden("muPaneSheet");
      click('button[data-mutab="sheet"]');
      const sheetOK = !hidden("muPaneSheet") && hidden("muPaneCover") && hidden("muPaneSong");
      click('button[data-mutab="song"]');
      const songOK = !hidden("muPaneSong") && hidden("muPaneSheet") && hidden("muPaneCover");
      return coverOK && sheetOK && songOK;
    })());
}

// ---- 2.241.0: New / Save / Load — the song as a project file -------------
{
  const S41 = require(path.join(__dirname, "..", "lib", "songs"));
  const os = require("os");
  const tmp = require("fs").mkdtempSync(path.join(os.tmpdir(), "songs-"));
  check("2.241.0 LIVE: a song round-trips (lyrics + details, junk fields dropped, numbers coerced), lists BOTH, tolerates a broken file",
    (() => {
      S41.write(tmp, "First", { lyrics: "[verse]\nA", dur: "90", seed: 7, junk: "x" });
      require("fs").writeFileSync(path.join(tmp, "songs", "bad.json"), "{nope");
      S41.write(tmp, "Second", { lyrics: "B", format: "mp3" });
      const r = S41.read(tmp, "First");
      const l = S41.list(tmp);
      // NOTE the order is asserted only when the timestamps DIFFER — two
      // saves can land in the same millisecond under a loaded gate, and a
      // sort tie must not decide a test (the 871/1 lesson).
      const names = l.map((x) => x.name).sort().join(",");
      const orderOK = l[0].saved_at === l[1].saved_at || l[0].name === "Second";
      return r.lyrics === "[verse]\nA" && r.dur === 90 && r.seed === 7
        && r.junk === undefined && l.length === 2
        && names === "First,Second" && orderOK;
    })());
  check("2.241.0: names sanitize flat (no traversal) and an empty name refuses in words",
    S41.safeName("../../evil") === "_.._evil"
    && (() => { try { S41.safeName("  "); return false; } catch (e) { return /needs a name/.test(e.message); } })());
  const R41 = read("routes", "index.js");
  check("2.241.0: /api/songs list + GET/POST by name ride core.getProject() (the temploras pattern — the server knows the project)",
    R41.includes('app.get("/api/songs"')
    && R41.includes('app.get("/api/songs/:name"')
    && R41.includes('app.post("/api/songs/:name"')
    && R41.includes("core.projDir(core.getProject())"));   // 2.250.0: the list route restructured around the render records
  const D41 = read("ext", "musicdock", "dock.html");
  check("2.241.0: the FILE group (🆕 New, 💾 Save, 📂 Load) sits at the FAR LEFT of the menubar, before the tabs; the song dialog exists",
    D41.indexOf('id="muFile"') > D41.indexOf('id="muBar"')
    && D41.indexOf('id="muFile"') < D41.indexOf('id="muTabs"')
    && D41.indexOf('id="muNew"') < D41.indexOf('id="muSave"')
    && D41.indexOf('id="muSave"') < D41.indexOf('id="muLoad"')
    && ["muSaveDlg", "muLoadDlg", "muSongName", "muSongGo", "muSongList", "muSaveX", "muLoadX"]
       .every((id) => D41.includes('id="' + id + '"')));   // 2.246.0: separate Save/Load dialogs
  const J41 = read("ext", "musicdock", "musicdock.js");
  check("2.241.0: Save/Load share the one dialog over /api/songs; a vanished saved style is SAID, not silently dropped; New is a two-press clear",
    J41.includes('fetch("/api/songs"')
    && J41.includes('fetch("/api/songs/" + encodeURIComponent(')
    && J41.includes("the saved style is gone from this install")
    && J41.includes("press 🆕 New again to clear the song")
    && J41.includes("muSongCollect()"));
  // the New double-press, ACTIVE in a real DOM: first press only warns,
  // second press clears
  check("2.241.0 LIVE: New with lyrics present warns on press one, clears on press two — in a real DOM",
    (() => {
      const { JSDOM } = require("jsdom");
      const dom = new JSDOM("<body>" + D41 + "</body>",
        { url: "http://localhost/", runScripts: "outside-only" });
      dom.window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ songs: [] }) });
      try { dom.window.eval(J41); } catch (e) { return false; }
      const d = dom.window.document;
      d.getElementById("muLyrics").value = "[verse]\nkeep me";
      const click = () => d.getElementById("muNew").dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }));
      click();
      const warned = d.getElementById("muLyrics").value !== ""
        && /press 🆕 New again/.test(d.getElementById("muStatus").textContent);
      click();
      const cleared = d.getElementById("muLyrics").value === ""
        && /new song/.test(d.getElementById("muStatus").textContent);
      return warned && cleared;
    })());
}

// ---- 2.243.0: the song's TITLE ------------------------------------------
{
  check("2.243.0 LIVE: title_lead (the worker's OWN function) sanitizes flat, dashes spaces, trims edges, and an unusable title leads with nothing; the stem takes the lead in front",
    (() => {
      const py = `
import importlib.util, sys
sys.path.insert(0, "scripts")
spec = importlib.util.spec_from_file_location("mw", "misc/music_worker.py")
mw = importlib.util.module_from_spec(spec)
try: spec.loader.exec_module(mw)
except SystemExit: pass
print("@@T " + mw.title_lead("Neon Nights!") + "|" + mw.title_lead("../evil") + "|" + mw.title_lead("   ") + "|")`;
      const out = require("child_process").execFileSync("python3", ["-c", py],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 30000 });
      const l = (out.split("\n").find((x) => x.startsWith("@@T ")) || "").slice(4).split("|");
      const W = read("misc/music_worker.py");
      return l[0] === "Neon-Nights" && l[1] && !/[^A-Za-z0-9_.-]/.test(l[1]) && l[2] === ""
        && W.includes('stem = title_lead(title) + "_" + stem');
    })());
  const S43 = require(path.join(__dirname, "..", "lib", "songs"));
  check("2.243.0: the title is a saved-song FIELD and round-trips",
    S43.FIELDS.title === "string"
    && (() => {
      const os = require("os");
      const t = require("fs").mkdtempSync(path.join(os.tmpdir(), "songs-t-"));
      S43.write(t, "X", { title: "Neon Nights", lyrics: "A" });
      return S43.read(t, "X").title === "Neon Nights";
    })());
  const R43 = read("routes", "index.js");
  check("2.243.0: the route trims and caps b.title into p.title",
    R43.includes('String(b.title || "").trim().slice(0, 120)'));
  const D43 = read("ext", "musicdock", "dock.html");
  check("2.243.0: the Title input sits at the top of the Song pane, before ITS murow (the cover pane has a murow of its own, earlier)",
    (() => {
      const pane = D43.slice(D43.indexOf('id="muPaneSong"'));
      return pane.indexOf('id="muTitle"') >= 0
        && pane.indexOf('id="muTitle"') < pane.indexOf('class="murow"');
    })());
  const J43 = read("ext", "musicdock", "musicdock.js");
  const H43 = read("static", "index.html");
  check("2.243.0: the title collects/applies with the song, prefills the Save name, rides the cover's FormData, and core sends it guarded",
    J43.includes('title: ($("muTitle") || {}).value || ""')
    && J43.includes('$("muTitle")) $("muTitle").value = s.title || ""')
    && J43.includes("the TITLE is the default song name")
    && J43.includes('body.append("title"')
    && H43.includes('const ttlEl = $("muTitle"); if (ttlEl && ttlEl.value.trim()) body.title = ttlEl.value.trim();'));
  check("2.243.0 LIVE: 🆕 New clears the title too — in a real DOM",
    (() => {
      const { JSDOM } = require("jsdom");
      const dom = new JSDOM("<body>" + D43 + "</body>",
        { url: "http://localhost/", runScripts: "outside-only" });
      dom.window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ songs: [] }) });
      try { dom.window.eval(J43); } catch (e) { return false; }
      const d = dom.window.document;
      d.getElementById("muTitle").value = "Neon Nights";
      d.getElementById("muLyrics").value = "keep";
      const click = () => d.getElementById("muNew").dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }));
      click(); click();
      return d.getElementById("muTitle").value === "" && d.getElementById("muLyrics").value === "";
    })());
}

// ---- 2.244.0: "create a song" in the chat pours into the music dock ------
{
  const SW = require(path.join(__dirname, "..", "lib", "songwriter"));
  check("2.244.0 LIVE: asksForSong — create/make/write a song trip it; mentioning a song, a songbird, or making a video do not",
    SW.asksForSong("create a song about rain") === true
    && SW.asksForSong("make me a song") === true
    && SW.asksForSong("can you write a song for my cat") === true
    && SW.asksForSong("Make a Song about home") === true
    && SW.asksForSong("I like this song") === false
    && SW.asksForSong("the songbird flew") === false
    && SW.asksForSong("make a video of the song playing") === true /* verb+song in one clause — a song IS asked of */
    && SW.asksForSong("make a video") === false);
  check("2.244.0 LIVE: parse — plain and markdown-bolded labels round-trip; lyrics run from the LYRICS label; junk replies parse to null",
    (() => {
      const a = SW.parse("TITLE: Neon Nights\nSTYLE: synthwave, female voice\nLYRICS:\n[verse]\nrain on glass\n[chorus]\nglow");
      const b = SW.parse("Sure!\n**TITLE:** Neon Nights\n**STYLE:** synthwave\n**LYRICS:**\n```\n[verse]\nx\n```");
      return a && a.title === "Neon Nights" && /synthwave/.test(a.style)
        && a.lyrics.startsWith("[verse]") && /\[chorus\]/.test(a.lyrics)
        && b && b.title === "Neon Nights" && b.lyrics.includes("[verse]")
        && !/```/.test(b.lyrics)
        && SW.parse("here are some ideas") === null
        && SW.parse("") === null;
    })());
  const R44 = read("routes", "index.js");
  check("2.244.0: the ask teaches the LLM the shape for THAT call only, and a parsed reply rides the response as `song` (an unparsed one is a plain reply, never an error)",
    R44.includes("songwriter.asksForSong(text)")
    && R44.includes('(songAsk ? songwriter.FORMAT_NOTE : "")')
    && R44.includes("songAsk ? songwriter.parse(out.text) : null")
    && R44.includes("context: prior.length, song }"));
  const H44 = read("static", "index.html");
  check("2.244.0: the page pours j.song into the dock — title → muTitle, style → muCaption, lyrics → muLyrics — guarded per field, said in the chat",
    H44.includes('if ($("muTitle")) $("muTitle").value = j.song.title || "";')
    && H44.includes('if ($("muCaption")) $("muCaption").value = j.song.style || "";')
    && H44.includes('if ($("muLyrics")) $("muLyrics").value = j.song.lyrics || "";')
    && H44.includes("sent to the Music dock"));
}

// ---- 2.245.0: the buttons SURVIVE core's gallery wiring ------------------
{
  const H45 = read("static", "index.html");
  check("2.245.0: the gallery wires ONLY [data-gtab] buttons (both selector sites) — a shared look is never a shared handler",
    H45.includes('document.querySelectorAll(".gtabs button[data-gtab]").forEach(b => b.onclick')
    && H45.includes('document.querySelectorAll(".gtabs button[data-gtab]").forEach(x =>')
    && !H45.includes('document.querySelectorAll(".gtabs button").forEach'));
  const D45 = read("ext", "musicdock", "dock.html");
  check("2.245.0: the file group is a PLAIN flex wrapper of themed ghost buttons (not .gtabs — actions, not tabs; the theme ask)",
    /<div id="muFile" style="display:flex/.test(D45)
    && /class="ghost gbtn" id="muNew"/.test(D45)
    && /class="ghost gbtn" id="muSave"/.test(D45)
    && /class="ghost gbtn" id="muLoad"/.test(D45)
    && !/class="gtabs" id="muFile"/.test(D45));
  // THE FIELD, REPRODUCED: the dock script wires the buttons, THEN core's
  // gallery wiring (extracted VERBATIM from static/index.html) runs after
  // it — exactly the real page's order, the order the old legs never ran.
  // Before 2.245.0 this leg fails (the bare selector overwrote onclick);
  // now the buttons survive and 🆕 New still clears on the second press.
  check("2.245.0 LIVE: New/Save/Load still work AFTER core's gallery wiring runs over the page — the exact field order",
    (() => {
      const { JSDOM } = require("jsdom");
      const J45 = read("ext", "musicdock", "musicdock.js");
      const dom = new JSDOM("<body>" + D45
        + '<div class="gtabs"><button data-gtab="video">V</button><button data-gtab="audio">A</button></div>'
        + "</body>", { url: "http://localhost/", runScripts: "outside-only" });
      dom.window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ songs: [] }) });
      try { dom.window.eval(J45); } catch (e) { return false; }
      const m = H45.match(/let galTab = "video";[\s\S]*?refreshGallery\(\);\n\}\);/);
      if (!m) return false;
      try { dom.window.eval("function refreshGallery(){}\n" + m[0]); } catch (e) { return false; }
      const d = dom.window.document;
      const click = (id) => d.getElementById(id).dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }));
      d.getElementById("muLyrics").value = "keep";
      click("muNew"); click("muNew");
      const newOK = d.getElementById("muLyrics").value === "";
      click("muSave");                       // opens the SAVE dialog (2.246.0)
      const dlg = d.getElementById("muSaveDlg");
      const saveOK = !!dlg && (dlg.open || dlg.hasAttribute("open"));
      const galleryStill = typeof d.querySelector('button[data-gtab="audio"]').onclick === "function";
      return newOK && saveOK && galleryStill;
    })());
}

// ---- 2.246.0: separate Save/Load dialogs, ▶ play, title-as-name ----------
{
  const S46 = require(path.join(__dirname, "..", "lib", "songs"));
  check("2.246.0 LIVE: songs.titleLead (JS) EQUALS music_worker.title_lead (python) on tricky titles — the play button finds what the worker names",
    (() => {
      const samples = ["Neon Nights!", "../evil", "  a  b  ", "über café 2am", "x".repeat(80)];
      const py = `
import importlib.util, sys, json
sys.path.insert(0, "scripts")
spec = importlib.util.spec_from_file_location("mw", "misc/music_worker.py")
mw = importlib.util.module_from_spec(spec)
try: spec.loader.exec_module(mw)
except SystemExit: pass
print("@@L " + json.dumps([mw.title_lead(t) for t in json.loads(sys.argv[1])]))`;
      const out = require("child_process").execFileSync("python3", ["-c", py, JSON.stringify(samples)],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 30000 });
      const pyLeads = JSON.parse((out.split("\n").find((l) => l.startsWith("@@L ")) || "").slice(4));
      return samples.every((t, i) => S46.titleLead(t) === pyLeads[i]);
    })());
  check("2.246.0 LIVE: audioFor picks the NEWEST rendered file with the song's lead, and answers \"\" when nothing rendered",
    (() => {
      const os = require("os"), fs2 = require("fs");
      const d = fs2.mkdtempSync(path.join(os.tmpdir(), "af-"));
      fs2.writeFileSync(path.join(d, "Neon-Nights_a_s1_x.flac"), "1");
      const p2 = path.join(d, "Neon-Nights_b_s2_y.mp3");
      fs2.writeFileSync(p2, "2");
      fs2.utimesSync(p2, new Date(), new Date(Date.now() + 5000));
      fs2.writeFileSync(path.join(d, "Other_c.flac"), "3");
      return S46.audioFor([d], "X", "Neon Nights") === "Neon-Nights_b_s2_y.mp3"
        && S46.audioFor([d], "Nothing", "") === ""
        && S46.audioFor(["/no/such/dir"], "X", "Neon Nights") === "";
    })());
  const R46 = read("routes", "index.js");
  check("2.246.0: the songs list rides core.outputDirs() and carries `audio` per song",
    R46.includes("core.outputDirs()")
    && R46.includes("songs.audioFor(dirs, s.name, s.title)"));
  const D46 = read("ext", "musicdock", "dock.html");
  check("2.246.0: TWO dialogs, each with a titlebar and ✕ ON THE RIGHT, all buttons icon-only + themed; the name input fills the row (flex:1, width 520)",
    (() => {
      const save = D46.slice(D46.indexOf('id="muSaveDlg"'), D46.indexOf('id="muLoadDlg"'));
      const load = D46.slice(D46.indexOf('id="muLoadDlg"'));
      return /<b style="flex:1">💾 Save song<\/b>\s*<button class="ghost gbtn" id="muSaveX"/.test(save)
        && /<b style="flex:1">📂 Load song<\/b>\s*<button class="ghost gbtn" id="muLoadX"/.test(load)
        && save.includes('id="muSongGo" type="button" title="Save the song')
        && />💾<\/button>/.test(save) && />✕<\/button>/.test(save)
        && save.includes('style="flex:1;margin:0">Song name')
        && D46.includes("min(94vw,520px)")
        && load.includes('id="muSongAudio"');
    })());
  const J46 = read("ext", "musicdock", "musicdock.js");
  check("2.246.0: ▶ plays the newest render via /outputs (pause on second press, said when unplayable), 📂 loads, a render-less song's ▶ is disabled in words, closing Load stops playback, and the Save name defaults to the TITLE",
    J46.includes('"/outputs/" + encodeURIComponent(s.audio)')
    && J46.includes('play.textContent = "⏸"')
    && J46.includes("no rendered audio found")   // 2.248.0 rewording
    && J46.includes('load.textContent = "📂"')
    && J46.includes("closing Load stops playback")
    && J46.includes("the TITLE is the default song name"));
  check("2.246.0 LIVE: the Load dialog paints rows in a real DOM — ▶ disabled without a render, enabled with one; 📂 applies the song and closes (async, via a child probe)",
    (() => {
      const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const D = fs.readFileSync("ext/musicdock/dock.html", "utf8");
const J = fs.readFileSync("ext/musicdock/musicdock.js", "utf8");
(async () => {
  const dom = new JSDOM("<body>" + D + "</body>", { url: "http://localhost/", runScripts: "outside-only" });
  const songA = { name: "A", title: "A", lyrics: "la", saved_at: "s", lyrics_chars: 2, style_name: "", audio: "A_x.flac" };
  const songB = { name: "B", title: "B", lyrics: "lb", saved_at: "s", lyrics_chars: 2, style_name: "", audio: "" };
  dom.window.fetch = (url) => Promise.resolve({ ok: true, json: () => Promise.resolve(
    String(url) === "/api/songs" ? { songs: [songA, songB] } : songA) });
  dom.window.eval(J);
  const d = dom.window.document;
  d.getElementById("muLoad").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  const btns = [...d.querySelectorAll("#muSongList button")];
  const plays = btns.filter((b) => b.textContent === "▶");
  const loads = btns.filter((b) => b.textContent === "📂");
  let ok = plays.length === 2 && loads.length === 2
    && !plays[0].disabled && plays[1].disabled;
  if (ok) {
    loads[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    const dlg = d.getElementById("muLoadDlg");
    ok = d.getElementById("muLyrics").value === "la"
      && !(dlg.open || dlg.hasAttribute("open"));
  }
  console.log("@@DLG " + ok);
})().catch((e) => console.log("@@DLG false " + e.message));`;
      const out = require("child_process").execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@DLG true");
    })());
}

// ---- 2.247.0: the tabs wear the theme ------------------------------------
{
  const D47 = read("ext", "musicdock", "dock.html");
  check("2.247.0: Song/Cover/Sheet are ghost-theme buttons in a PLAIN flex wrapper (never .gtabs — the 2.245.0 lesson), Song starts selected",
    /<div id="muTabs" style="display:flex/.test(D47)
    && /class="ghost gbtn on" data-mutab="song"/.test(D47)
    && /class="ghost gbtn" data-mutab="cover"/.test(D47)
    && /class="ghost gbtn" data-mutab="sheet"/.test(D47)
    && !/class="gtabs" id="muTabs"/.test(D47));
  const H47 = read("static", "index.html");
  check("2.247.0: the selected tab shows the app's own active look (.mubar .gbtn.on = tiger text + border)",
    H47.includes(".mubar .gbtn.on { color: var(--tiger); border-color: var(--tiger); }"));
  check("2.247.0 LIVE: switching still works themed, and the .on class moves with the selection — in a real DOM, after core's gallery wiring",
    (() => {
      const { JSDOM } = require("jsdom");
      const J47 = read("ext", "musicdock", "musicdock.js");
      const dom = new JSDOM("<body>" + D47 + "</body>",
        { url: "http://localhost/", runScripts: "outside-only" });
      dom.window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ songs: [] }) });
      try { dom.window.eval(J47); } catch (e) { return false; }
      const m = H47.match(/let galTab = "video";[\s\S]*?refreshGallery\(\);\n\}\);/);
      if (!m) return false;
      try { dom.window.eval("function refreshGallery(){}\n" + m[0]); } catch (e) { return false; }
      const d = dom.window.document;
      const btn = (t) => d.querySelector('button[data-mutab="' + t + '"]');
      btn("cover").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      return btn("cover").classList.contains("on")
        && !btn("song").classList.contains("on")
        && !d.getElementById("muPaneCover").classList.contains("hidden")
        && d.getElementById("muPaneSong").classList.contains("hidden");
    })());
}

// ---- 2.248.0: ▶ actually finds the render --------------------------------
{
  const S48 = require(path.join(__dirname, "..", "lib", "songs"));
  check("2.248.0 LIVE: matching is CASE-INSENSITIVE and RANKED — prefix (the worker's naming) outranks a newer contains-hit; contains rescues renames; nothing matched stays \"\"",
    (() => {
      const os = require("os"), fs2 = require("fs");
      const d = fs2.mkdtempSync(path.join(os.tmpdir(), "pm-"));
      fs2.writeFileSync(path.join(d, "neon-nights_a_s1_x.flac"), "1");
      const p2 = path.join(d, "final_mix_Neon-Nights_v2.mp3");
      fs2.writeFileSync(p2, "2");
      const later = new Date(Date.now() + 5000);
      fs2.utimesSync(p2, later, later);
      const prefixWins = S48.audioFor([d], "X", "Neon Nights") === "neon-nights_a_s1_x.flac";
      fs2.unlinkSync(path.join(d, "neon-nights_a_s1_x.flac"));
      const containsRescues = S48.audioFor([d], "X", "Neon Nights") === "final_mix_Neon-Nights_v2.mp3";
      return prefixWins && containsRescues && S48.audioFor([d], "X", "zzz") === "";
    })());
  const J48 = read("ext", "musicdock", "musicdock.js");
  check("2.248.0: a save with an empty Title takes the song's NAME as title (so the next render is findable), and the disabled ▶ explains itself fully",
    J48.includes("if (tEl48 && !tEl48.value.trim()) tEl48.value = name;")
    && J48.includes("no rendered audio found for this title"));
  check("2.248.0 LIVE: saving name-only fills the Title field — in a real DOM (the render that follows will lead with it)",
    (() => {
      const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const D = fs.readFileSync("ext/musicdock/dock.html", "utf8");
const J = fs.readFileSync("ext/musicdock/musicdock.js", "utf8");
(async () => {
  const dom = new JSDOM("<body>" + D + "</body>", { url: "http://localhost/", runScripts: "outside-only" });
  dom.window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ saved: true, name: "My Song" }) });
  dom.window.eval(J);
  const d = dom.window.document;
  d.getElementById("muTitle").value = "";
  d.getElementById("muSongName").value = "My Song";
  d.getElementById("muSongGo").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));
  console.log("@@SV " + (d.getElementById("muTitle").value === "My Song"));
})().catch((e) => console.log("@@SV false " + e.message));`;
      const out = require("child_process").execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@SV true");
    })());
}

// ---- 2.249.0: dark native media chrome -----------------------------------
{
  const H49 = read("static", "index.html");
  check("2.249.0: every <audio>/<video> declares color-scheme dark — the native controls match the app (gallery, references, assets, and future players)",
    H49.includes("audio, video { color-scheme: dark; }"));
}

// ---- 2.250.0: the render RECORD — ▶ plays a recorded filename ------------
{
  const S50 = require(path.join(__dirname, "..", "lib", "songs"));
  check("2.250.0 LIVE: recordRender writes <songname>.music with filename/title/lyrics/created_at/created_by; readRecord and listRecords round-trip; no filename = no record",
    (() => {
      const os = require("os"), fs2 = require("fs");
      const d = fs2.mkdtempSync(path.join(os.tmpdir(), "rec-"));
      const r = S50.recordRender(d, { title: "Neon Nights", lyrics: "[verse]\nx",
        filename: "Neon-Nights_a_s1_x.flac", created_by: "YuE2 ComfyUI" });
      const back = S50.readRecord(d, "Neon Nights");
      return r && r.file === "Neon Nights.music"   // safeName keeps spaces, like the .json songs
        && back && back.filename === "Neon-Nights_a_s1_x.flac"
        && back.created_by === "YuE2 ComfyUI" && back.lyrics.includes("[verse]")
        && /^\d{4}-\d{2}-\d{2}T/.test(back.created_at)
        && S50.listRecords(d).length === 1
        && S50.recordRender(d, { title: "Nope", filename: "" }) === null;
    })());
  const C50 = read("lib", "core.js");
  check("2.250.0: core writes the record the moment a MUSIC job finishes — audio file from produced, title/lyrics/style from params, never throws, never touches job.status",
    C50.includes('job.params.mode === "music"')
    && C50.includes('require("./songs").recordRender(projDir(currentProject)')
    && C50.includes("render recorded -> songs/")
    && C50.includes("could not write the render record"));
  const R50 = read("routes", "index.js");
  check("2.250.0: the list joins records (record filename wins WHEN ON DISK, 2.248 scan only as fallback), record-only renders list AND load from their .music",
    R50.includes("songs.listRecords(pdir)")
    && R50.includes("onDisk(r.filename) ? r.filename")
    && R50.includes("songs.audioFor(dirs, s.name, s.title)")
    && R50.includes("record_only: true")
    && R50.includes("songs.readRecord(pdir, req.params.name)"));
  const D50 = read("ext", "musicdock", "dock.html");
  const J50 = read("ext", "musicdock", "musicdock.js");
  check("2.250.0: the ⓘ card exists (fixed, non-interactive) and the rows wire it — italic ⓘ between ▶ and 📂, mouseover fills+shows, mouseout hides, dialog-close hides",
    D50.includes('id="muInfoPop"') && D50.includes("pointer-events:none")
    && J50.includes('info.textContent = "ⓘ"')
    && J50.includes('info.style.fontStyle = "italic"')
    && J50.includes("info.onmouseover")
    && J50.includes("info.onmouseout")
    && J50.includes("row.appendChild(info); row.appendChild(load);")
    && J50.includes("takes the ⓘ card with it"));
  check("2.250.0 LIVE: a row with a record — ▶ enabled on the RECORDED file, ⓘ mouseover shows filename/created-by in the card, mouseout hides it (child probe)",
    (() => {
      const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const D = fs.readFileSync("ext/musicdock/dock.html", "utf8");
const J = fs.readFileSync("ext/musicdock/musicdock.js", "utf8");
(async () => {
  const dom = new JSDOM("<body>" + D + "</body>", { url: "http://localhost/", runScripts: "outside-only" });
  const rec = { filename: "Neon-Nights_a.flac", title: "Neon Nights", lyrics: "[verse] x",
                created_at: "2026-09-18T01:00:00Z", created_by: "YuE2 ComfyUI" };
  const row = { name: "Neon Nights", title: "Neon Nights", saved_at: "s", lyrics_chars: 9,
                style_name: "", audio: "Neon-Nights_a.flac", record: rec };
  dom.window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ songs: [row] }) });
  dom.window.eval(J);
  const d = dom.window.document;
  d.getElementById("muLoad").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  const btns = [...d.querySelectorAll("#muSongList button")];
  const play = btns.find((b) => b.textContent === "▶");
  const info = btns.find((b) => b.textContent === "ⓘ");
  let ok = !!play && !play.disabled && !!info;
  if (ok) {
    info.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true }));
    const pop = d.getElementById("muInfoPop");
    ok = !pop.classList.contains("hidden")
      && pop.innerHTML.includes("Neon-Nights_a.flac")
      && pop.innerHTML.includes("YuE2 ComfyUI");
    info.dispatchEvent(new dom.window.MouseEvent("mouseout", { bubbles: true }));
    ok = ok && pop.classList.contains("hidden");
  }
  console.log("@@INFO " + ok);
})().catch((e) => console.log("@@INFO false " + e.message));`;
      const out = require("child_process").execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@INFO true");
    })());
}

// ---- 2.251.0: the preview fills the dock, and the handle moves the picture
{
  const H51 = read("static", "index.html");
  check("2.251.0: the height CHAIN — pane is a flex column, wrap takes the room (flex 1, min-height 0), Fit letterboxes into it (max-height too), pvImg capped, controls fixed",
    H51.includes("#viewerpane { flex: 1; min-height: 100px; overflow: hidden; padding: 12px; display: flex; flex-direction: column; }")
    && H51.includes("#viewerwrap { flex: 1 1 auto; min-height: 0; overflow: auto;")
    && H51.includes("#player.fit { max-width: 100%; max-height: 100%; width: auto; height: auto; }")
    && H51.includes("#pvImg { max-height: 100%; }")
    && H51.includes("flex: 0 0 auto; flex-wrap: wrap; }"));
  const D51 = read("ext", "previewdock", "dock.html");
  check("2.251.0: FIT is the DEFAULT — the player ships class fit, the button says Fit, and the 1:1 toggle survives untouched",
    D51.includes('<video id="player" controls class="hidden fit"></video>')
    && D51.includes('>Fit</button>')
    && H51.includes('p.classList.toggle("fit", fit);'));
}

// ---- 2.252.0: the visualiser IS the dock ---------------------------------
{
  const V52 = read("ext", "previewdock", "audioviz.js");
  check("2.253.0: the visualiser SIZES ITSELF — sizeGuard measures (hands off when the flex chain fills the wrap, computed spare-height floor when it does not), a ResizeObserver re-measures on every dock resize, hide() restores what was set",
    V52.includes("function sizeGuard()")
    && V52.includes("wrap.clientHeight >= 120 && wrap.clientHeight >= paneH - 80")
    && V52.includes("new W.ResizeObserver(sizeGuard)")
    && V52.includes("NS.ro.disconnect()")
    && V52.includes("put back whatever sizeGuard set"));
}

// ---- 2.254.0: maximize fills, the seam cascades ---------------------------
{
  const H54 = read("static", "index.html");
  check("2.254.0: the has-max viewerpane pin excludes the maxed preview itself — maximizing the preview dock fills it (the .bdock.maxed flex rule does the rest)",
    // 2.381.0: a maximize no longer pins the other docks (the preview included) - they keep their own height
    !H54.includes("#maincol.has-max #previewdock:not(.maxed) #viewerpane")
    && !H54.includes("#maincol.has-max #viewerpane {")
    && H54.includes(".bdock.maxed { height: auto !important; flex: 1 1 auto;"));
  check("2.254.0: the seam CASCADES — every visible fixed dock below gives room in order (floor 60), shrinking gives it back (ceiling .6), the elastic preview floors at 130, and every touched dock is saved on pointerup",
    H54.includes("const belows = [];")
    && H54.includes("Math.min(need, Math.max(0, b.start - (b.key ? 60 : b.floor)))")
    && H54.includes("const grow = Math.min(free, Math.max(0, top - b.start));")
    && H54.includes('Math.max((A.classList.contains("maxed") ? 120 : 130) - aElH, d)')
    && H54.includes("docker_status.json gets them the moment the drag ends")
    && !H54.includes("const B = hsplitDock(sp, true);"));
  const V54 = read("ext", "previewdock", "audioviz.js");
  check("2.254.0: sizeGuard gives a REAL small pane exactly its spare room; the 200px floor is only for heightless DOMs",
    V54.includes("paneH >= 60 ? Math.max(24, spare) : Math.max(200, spare)"));
}

// ---- 2.255.0: the role swap — the preview owns its height ----------------
{
  const H55 = read("static", "index.html");
  check("2.255.0: the CLASH fixed — previewdock has --pvh (default 300px) and is FIXED (flex 0 0 var); its handle sets ITS height; maxed/collapsed overrides survive",
    H55.includes("--pvh: 300px;")
    && H55.includes("#previewdock { flex: 0 0 var(--pvh); min-height: 130px;")
    && H55.includes("#previewdock.maxed { flex: 1 1 auto; }")
    && H55.includes("#previewdock.collapsed { flex: 0 0 30px;")
    && H55.includes('previewdock: "pvh"'));
  check("2.255.0: the VIDEO dock is the elastic absorber — flex 1 1 auto, collapsed/minned pinned, no vh in the save map, reflow + boot normaliser re-aimed at it",
    H55.includes("#videodock { flex: 1 1 auto; min-height: 110px; }")
    && H55.includes("#videodock.collapsed, #videodock.minned { flex: 0 0 30px;")
    && !H55.includes('DOCKER_VARS = { ...DOCK_VARS, previewdock: "pvh", videodock')   // 2.381.0: vh is only STATUS_VARS
    && H55.includes("#maincol.has-max #videodock:not(.maxed):not(.collapsed) { flex: 0 0 var(--vh); }")
    && H55.includes("const flexEl = mx || vd;")   // 2.256.0 reshaped the guard; 2.381.0: + the maximized dock
    && H55.includes('"th", "vh", "pvh", "mh"'));
}

// ---- 2.256.0: tokens accordion, override switch, unclipped console -------
{
  const H56 = read("static", "index.html");
  const L56 = require(path.join(__dirname, "..", "lib", "llmChat"));
  const R56 = read("routes", "index.js");
  check("2.256.0: LLM tokens is an accordion (drop + secbody + boot restore) with a live Tokens-consumed label polling /api/llm/usage",
    H56.includes('data-sec="llmtok"') && H56.includes('id="sec-llmtok"')
    && H56.includes('toggleSec("llmtok", true)')
    && H56.includes('id="tokUsed"')
    && H56.includes('fetch("/api/llm/usage")')
    && R56.includes('app.get("/api/llm/usage"'));
  check("2.256.0 LIVE: llmChat.usage() is the session counter shape {in, out, calls}",
    (() => { const u = L56.usage(); return u && u.in === 0 && u.out === 0 && u.calls === 0; })());
  check("2.256.0: the Override-style switch sits at the top of Basic Settings, persists to ovr.style (default ON = the 2.111.6 behaviour), gates imgBasicsBody and the video temp-LoRAs",
    H56.includes('id="ovrStyle"')
    && H56.includes('store.get("ovr.style", "1")')
    && H56.includes("if (!ovrStyleOn()) return body;")
    && H56.includes('ovrStyleOn() ? tempLoras("video") : []'));
  check("2.256.0: reflow corrects OVERFLOW unconditionally (console never clipped); gaps still fill only when the elastic dock is collapsed; drag-end and window resize re-check",
    H56.includes("gap > 0 && flexOpen) return;")
    && H56.includes("a drag must never leave the console clipped")
    && H56.includes('window.addEventListener("resize", () => reflowSoon())'));
}

// ---- 2.257.0: the vertical prompt toolbar --------------------------------
{
  const D57 = read("ext", "promptdock", "dock.html");
  const J57 = read("ext", "promptdock", "promptdock.js");
  check("2.257.0: a VERTICAL icon-only toolbar sits LEFT of the prompt input (ptools before .pleft, flex column, themed gbtn, aria labels), four creators",
    D57.indexOf('id="ptools"') !== -1
    && D57.indexOf('id="ptools"') < D57.indexOf('<div class="pleft">')
    && D57.includes("flex-direction:column")
    && ["ptScreenplay", "ptImage", "ptVideo", "ptSong"].every((id) => D57.includes(`id="${id}"`))
    && D57.match(/id="pt(Screenplay|Image|Video|Song)"/g).length === 4);
  check("2.257.0: each button adds its exact phrase ONCE (case-insensitive presence check), prepended, with an input event for the token estimate",
    J57.includes('ptScreenplay: "create screenplay"')
    && J57.includes('ptImage: "create image prompt from image"')
    && J57.includes('ptVideo: "create video prompt"')
    && J57.includes('ptSong: "create song"')
    && J57.includes("t.value.toLowerCase().indexOf(phrase.toLowerCase())")
    && J57.includes('t.dispatchEvent(new Event("input", { bubbles: true }))'));
  check("2.257.0 LIVE: pressing 🎬 inserts the phrase, pressing it AGAIN does not duplicate, a second creator prepends before existing text (child probe)",
    (() => {
      const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const D = fs.readFileSync("ext/promptdock/dock.html", "utf8");
const J = fs.readFileSync("ext/promptdock/promptdock.js", "utf8");
const dom = new JSDOM("<body>" + D + "</body>", { url: "http://localhost/", runScripts: "outside-only" });
dom.window.eval(J);
const d = dom.window.document;
const t = d.getElementById("prompt");
const click = (id) => d.getElementById(id).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
click("ptScreenplay");
const one = t.value;
click("ptScreenplay");
const same = t.value === one && (one.match(/create screenplay/g) || []).length === 1;
t.value = "a lonely astronaut";
click("ptSong");
const two = t.value;
console.log("@@PT " + (same && one.trim() === "create screenplay"
  && two === "create song a lonely astronaut"));`;
      const out = require("child_process").execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@PT true");
    })());
}

// ---- 2.258.0: no VRAM stacking — drain before load -----------------------
{
  const C58 = read("lib", "core.js");
  check("2.258.0: gpuSettle polls nvidia-smi memory.used until it stops falling (two stable reads, 10s cap; 1.5s blind grace without nvidia-smi; 500ms for cpu devices), exported for the captioner",
    C58.includes("async function gpuSettle(dev)")
    && C58.includes('"--query-gpu=memory.used", "--format=csv,noheader,nounits", "-i", idx')
    && C58.includes("if (used >= prev && ++stable >= 2) return;")
    && C58.includes("gpuSettle, llamaState"));
  check("2.258.0 LIVE: gpuSettle resolves without nvidia-smi and never throws (the blind-grace path — a CHILD PROBE, since a Promise into sync check() passes vacuously)",
    (() => {
      const probe = 'require("./lib/core").gpuSettle("cuda0")' +
        '.then(() => console.log("@@GS ok")).catch((e) => console.log("@@GS fail " + e.message));';
      const out = require("child_process").execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 30000 });
      return out.split("\n").some((l) => l.trim() === "@@GS ok");
    })());
  check("2.258.0: ensureLlama drains the OLD model first — hadProc/oldDev from the old sig, stopLlama then await gpuSettle(oldDev) BEFORE the spawn; a cold start skips the wait",
    C58.includes("const hadProc = !!llama.proc;")
    && C58.includes('String(llama.sig).split("|")[0]')
    && C58.includes("if (hadProc) await gpuSettle(oldDev);")
    && C58.indexOf("if (hadProc) await gpuSettle(oldDev);") < C58.indexOf("const proc = spawn(exe, args"));
}

// ---- 2.259.0: the eject button, the LLM start button, the wider pside ----
{
  const H59 = read("static", "index.html");
  const R59 = read("routes", "index.js");
  const D59 = read("ext", "promptdock", "dock.html");
  check("2.259.0: POST /api/models/reset ejects EVERYTHING — stopLlama + captioner.freeForJob (no core = always-free), gpuSettle per distinct card, ComfyUI /free best-effort; ASR/TTS are per-call python (nothing resident)",
    R59.includes('app.post("/api/models/reset"')
    && R59.includes('out.vision = capt.freeForJob("the reset button was pressed")')
    && R59.includes("if (out.llm) await core.gpuSettle(llmDev);")
    && R59.includes("if (out.vision && visDev !== llmDev) await core.gpuSettle(visDev);")
    && R59.includes("out.comfy = await comfy.freeMemory();"));
  check("2.259.0: the ⏏ button lives in the ldock menubar beside ⚙ and wires to the reset endpoint with ⏳/✓ feedback",
    H59.includes('id="resetModels"')
    && H59.indexOf('id="openSettings"') < H59.indexOf('id="resetModels"')
    && H59.includes('fetch("/api/models/reset", { method: "POST" })'));
  check("2.259.0: 🧠 Start-LLM sits beside ⚙ Start-ComfyUI in the iconrow and posts the DROPDOWN's file to /api/llm/start (bind-once, ⏳/✓ feedback)",
    D59.includes('id="goLlmStart"')
    && D59.indexOf('id="goComfyStart"') < D59.indexOf('id="goLlmStart"')
    && H59.includes('const lb = $("goLlmStart");')
    && H59.includes('body: JSON.stringify({ file }) })')
    && H59.includes('lb.dataset.wired = "1";'));
  check("2.259.0: .pside is 230px — five 38px icon buttons (214px with gaps) fit one line and Generate stretches with the column",
    H59.includes(".pside { width: 230px;")
    && (D59.slice(D59.indexOf('class="iconrow"'), D59.indexOf('id="enhanced"'))
          .match(/class="ghost ibtn"/g) || []).length === 5);   // the ICONROW's five (the llmrow's ＋ is elsewhere)
}

// ---- 2.260.0: the queue's own controls -----------------------------------
{
  const H60 = read("static", "index.html");
  const R60 = read("routes", "index.js");
  const J60 = require(path.join(__dirname, "..", "lib", "jobsInfo"));
  check("2.260.0 LIVE: jobsInfo.clearDone drops every done entry, keeps the pending resume list, returns the count",
    (() => {
      const os = require("os"), fs2 = require("fs");
      const d = fs2.mkdtempSync(path.join(os.tmpdir(), "ji-"));
      J60.write(d, [{ id: "a", state: "done", status: "done" },
                    { id: "b", state: "pending", status: "queued", params: {} },
                    { id: "c", state: "done", status: "failed" }]);
      const n = J60.clearDone(d);
      const left = J60.read(d);
      return n === 2 && left.length === 1 && left[0].id === "b" && J60.clearDone(d) === 0;
    })());
  check("2.260.0: DELETE /api/jobs/done empties the Done tab both ways — terminal in-memory jobs leave core.jobs, jobsInfo.clearDone sweeps the history, pending untouched",
    R60.includes('app.delete("/api/jobs/done"')
    && R60.includes('if (j.status !== "queued" && j.status !== "running") { core.jobs.delete(id); mem++; }')
    && R60.includes("jobsInfo.clearDone(core.projDir(core.getProject()))"));
  check("2.260.0: the queue dock's own controls — ⏹/⏹✕ on Pending, 🧹 on Done (tab-toggled), wired to the SHARED stopRunningOne/stopEverything the abort dialog also uses; 🧹 clears genqueue finished + the server list",
    ["qClearDone"].every((id) => H60.includes(`id="${id}"`)) && !H60.includes('id="qStopJob"')   // 2.381.0: ⏹ / ⏹✕ removed
    && H60.includes("async function stopRunningOne()")
    && H60.includes("async function stopEverything()")
    && H60.includes("lastDoneN = nDone;") && H60.includes("b.disabled = !n;")      // 2.345.1: on both tabs, greyed when empty
    && H60.includes("GENQUEUE.clearFinished(GQ);")
    && H60.includes('fetch("/api/jobs/done", { method: "DELETE" })')
    && H60.includes('.qtab[data-qtab]'));
}

// ---- 2.261.0: the picked models survive any restart ----------------------
{
  const H61 = read("static", "index.html");
  const R61 = read("routes", "index.js");
  check("2.261.0: every pick saves ON CHANGE to the server config — llm.last_file (2.148's save), ui.style / ui.vstyle (new hooks), vision via captioner.model; ui is a mergeable config section",
    H61.includes('[["style", "styleSel"], ["vstyle", "videoStyleSel"]]')
    && H61.includes('JSON.stringify({ ui: { [uiKey]: sel.value } })')
    && H61.includes('JSON.stringify({ llm: { last_file: file } })')
    && R61.includes('"ui", "captioner"'));
  check("2.261.0: boot RESTORE re-applies the server values once the async lists fill (apply + one 2.5s retry), style/vstyle dispatch change for their dependent panels, the LLM only selects, localStorage mirrors",
    H61.includes("(async function uiModelRestore()")
    && H61.includes('["llmSel", (cfg.llm || {}).last_file || "", false]')
    && H61.includes('["styleSel", (cfg.ui || {}).style || "", true]')
    && H61.includes('["videoStyleSel", (cfg.ui || {}).vstyle || "", true]')
    && H61.includes("if (![...sel.options].some((o) => o.value === v)) continue;")
    && H61.includes("setTimeout(apply, 2500);")
    && H61.includes('sel.dispatchEvent(new Event("change", { bubbles: true }))'));
}

// ---- 2.262.0: pause/resume on the queue, Regenerate wording --------------
{
  const H62 = read("static", "index.html");
  check("2.262.0: queuePaused gates the drain BETWEEN items (the running render finishes, nothing new starts), session-scoped",
    H62.includes("let queuePaused = false;")
    && H62.includes("if (queuePaused) break;")
    && H62.indexOf("if (queuePaused) break;") < H62.indexOf("const it = GENQUEUE.nextWaiting(GQ);"));
  check("2.262.0: the RUNNING row wears ⏸ (→ ▶ once paused, resume restarts the drain); a held queue with nothing running wears ▶ on its FIRST waiting row with status 'held'; ↻ reads as Regenerate",
    H62.includes('queuePaused ? "\\u25b6" : "\\u23f8"')
    && H62.includes('"Pause the queue — this render finishes, nothing new starts"')
    && H62.includes('it === GENQUEUE.nextWaiting(GQ)')
    && H62.includes('st.textContent = "held";')
    && H62.includes('"Regenerate — queue this one again and run it"'));
}

// ---- 2.263.0: 10px between the last dock and the statusbar ---------------
{
  const H63 = read("static", "index.html");
  check("2.263.0: #maincol keeps a 10px padding-bottom floor, and reflowDocks SUBTRACTS the computed padding from its gap math so the breathing room is never filled back",
    H63.includes("background: var(--ink); padding-bottom: 10px; }")
    && H63.includes("parseInt(getComputedStyle(col).paddingBottom, 10) || 0")
    && H63.includes("col.clientHeight - padB"));
}

// ---- 2.264.0: OmniVoice IS the engine — openaudio removed ----------------
{
  const T64 = read("lib", "tts.js");
  const C64 = read("lib", "core.js");
  const R64 = read("routes", "index.js");
  const fs64 = require("fs");
  check("2.264.0: the openaudio FILES are gone (lib/openaudio.js, scripts/tts_local.py, scripts/openaudio_checkpoint.py, scripts/test-tts-engine.py) and nothing requires them",
    ["lib/openaudio.js", "scripts/tts_local.py", "scripts/openaudio_checkpoint.py", "scripts/test-tts-engine.py"]
      .every((f) => !fs64.existsSync(path.join(__dirname, "..", f)))
    && !R64.includes('require("../lib/openaudio")'));
  // 2.594.0: + "ming" (Ming-3.0 TTS, an add-on); a legacy "openaudio" still runs OmniVoice
  check("2.264.0 / 2.594.0: tts.js speaks with OmniVoice or Ming-3.0 TTS — ENGINES omnivoice + ming, anything else (legacy openaudio) = OmniVoice, the speak job is the omnivoice shape unless ming",
    T64.includes('const ENGINES = ["omnivoice", "ming"];')
    && T64.includes('const engine = c.engine === "ming" ? "ming" : "omnivoice";')
    && T64.includes("legacy openaudio keys c.venv / c.checkpoint are ignored")
    && !T64.includes("tts_local.py")
    && T64.includes("OmniVoice speaks clones AND designs"));
  check("2.264.0 LIVE (2.594.0: + ming): the engines are omnivoice and ming, no openaudio",
    (() => {
      const t = require(path.join(__dirname, "..", "lib", "tts"));
      return t.ENGINES.join() === "omnivoice,ming" && !t.ENGINES.includes("openaudio");
    })());
  check("2.264.0: the installers know one speech venv — core TOOL_MODES and worker.py dropped install_openaudio, the routes validator says omnivoice or whisper, the doctor endpoints are gone",
    C64.includes('"install_whisper", "install_omnivoice",')
    && !C64.includes("install_openaudio")
    && R64.includes('which must be omnivoice, whisper or demucs')   // 2.269.0: demucs joined
    && !R64.includes('app.get("/api/tts/checkpoint"')
    && read("misc/worker.py").includes('if mode in ("install_whisper", "install_omnivoice", "install_demucs", "install_viggle", "install_native"):'));
  check("2.264.0 / 2.594.0: the settings panel - the engine select (OmniVoice / Ming-3.0 TTS), Device + CUDA build in the Omni box, no checkpoint/venv/install-openaudio fields, the save sends the picked engine",
    (() => {
      const H = read("static", "index.html");
      return H.includes('<select id="s_ttsengine" title=') && H.includes('<option value="ming">')
        && !H.includes('value="openaudio"')
        && !H.includes('id="s_ttsckpt"') && !H.includes('id="s_ttsinstall"')
        && H.includes('engine: $("s_ttsengine") && $("s_ttsengine").value === "ming" ? "ming" : "omnivoice",');
    })());
}

/* ================= 2.265.0 — the Dataset tab ============================
   Titlebar + close, the fifth chDlg tab, lib/datasets LIVE round-trip,
   the seven routes, and the selected-only Auto Caption contract. */
{
  const H = read("static", "index.html");
  check("chDlg titlebar: h3 flexes, close button rides the right edge", (() => {
    const i = H.indexOf('id="chDlgTitle"');
    const x = H.indexOf('id="chDlgX"');
    return i > 0 && x > i && (x - i) < 400
      && H.slice(i - 200, i).includes("display:flex")
      && H.includes('aria-label="Close"');
  })());
  check("Dataset is the fifth tab and its pane precedes Clothing", (() => {
    const b = H.indexOf('data-chtab="chTabDataset"');
    return b > H.indexOf('data-chtab="chTabClothing"')
      && H.indexOf('id="chTabDataset"') > 0
      && H.indexOf('id="chTabDataset"') < H.indexOf('id="chTabClothing"');
  })());
  check("Dataset pane: name, add, auto-caption, delete-all, select-all, grid, hidden file input", (() => {
    return ['id="dsName"', 'id="dsAddBtn"', 'id="dsAutoCap"', 'id="dsDelAll"',
            'id="dsSelAll"', 'id="dsGrid"', 'id="dsFile"']
      .every((id) => H.includes(id))
      && /id="dsFile"[^>]*multiple/.test(H)
      && /id="dsFile"[^>]*accept="image\/\*"/.test(H);
  })());

  const C = read("ext", "videodock", "characters.js");
  check("chDlgX closes the dialog", (() => {
    const i = C.indexOf('el("chDlgX").onclick');
    return i > 0 && C.slice(i, i + 200).includes('el("chDlg").close()');
  })());
  check("dataset drops are scoped: Dataset tab open + files -> dsAddFiles, not the sheet queue", (() => {
    const i = C.indexOf('var dsTab = el("chTabDataset")');
    return i > 0
      && C.slice(i, i + 400).includes("dsAddFiles(e.dataTransfer.files)")
      && C.indexOf("var p = chPayload()", i) > i;
  })());
  check("Auto Caption sends ONLY the checked files and disables while busy", (() => {
    const i = C.indexOf('el("dsAutoCap").onclick');
    const s = C.slice(i, i + 900);
    return i > 0 && s.includes("filter(function (i) { return i.sel; })")
      && s.includes("b.disabled = true")
      && s.includes("/autocaption");
  })());
  check("grid cells: checkbox top-left, remove top-right, caption saved on change", (() => {
    const i = C.indexOf("function dsPaint()");
    const s = C.slice(i, i + 2600);
    return i > 0 && s.includes("top:4px;left:4px") && s.includes("top:2px;right:2px")
      && s.includes('method: "PUT"') && s.includes("/caption");
  })());

  const R = read("routes", "index.js");
  check("the seven dataset routes exist and uploads take up to 100 images", (() => {
    return ['app.get("/api/datasets/:name"', 'app.post("/api/datasets/:name/images"',
            'app.get("/api/datasets/:name/file/:file"', 'app.put("/api/datasets/:name/caption"',
            'app.delete("/api/datasets/:name/images/:file"', 'app.delete("/api/datasets/:name/images"',
            'app.post("/api/datasets/:name/autocaption"']
      .every((r) => R.includes(r))
      && R.includes('dsUpload.array("images", 100)');
  })());
  check("autocaption treats describe() as strings and writes the sidecar", (() => {
    const i = R.indexOf('"/api/datasets/:name/autocaption"');
    const s = R.slice(i, i + 1200);
    return i > 0 && s.includes("String((d && d[0]) || ")
      && s.includes("datasets.setCaption");
  })());

  // -------- LIVE round-trip against a scratch datasets root --------------
  const os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-ds-"));
  const core = require("../lib/core");
  const oldResolve = core.resolvePath;
  core.resolvePath = (p) => path.join(tmp, p);
  try {
    const ds = require("../lib/datasets");
    check("safeName rejects the empty and the hostile, keeps spaces", (() => {
      let bad = 0;
      for (const n of ["", "../up", "a/b", ".hidden"]) {
        try { ds.safeName(n); } catch { bad++; }
      }
      return bad === 4 && ds.safeName("My Set 1") === "My Set 1";
    })());
    check("addImage stores, collides to a numeric suffix, list pairs captions", (() => {
      const a1 = ds.addImage("t1", "pic.png", Buffer.from([1, 2, 3]));
      const a2 = ds.addImage("t1", "pic.png", Buffer.from([4, 5, 6]));
      ds.setCaption("t1", a1, "a red ball");
      const l = ds.list("t1");
      return a1 === "pic.png" && a2 === "pic_1.png" && l.length === 2
        && l.find((i) => i.file === a1).caption === "a red ball"
        && l.find((i) => i.file === a2).caption === "";
    })());
    check("remove drops the image AND its sidecar; removeAll leaves the folder", (() => {
      ds.remove("t1", "pic.png");
      const gone = !fs.existsSync(path.join(tmp, "datasets", "t1", "pic.txt"));
      const n = ds.removeAll("t1");
      return gone && n === 1 && ds.list("t1").length === 0
        && fs.existsSync(path.join(tmp, "datasets", "t1"));
    })());
    check("filePath answers only for real files and never escapes the folder", (() => {
      const f = ds.addImage("t2", "x.jpg", Buffer.from([9]));
      return ds.filePath("t2", f) !== null
        && ds.filePath("t2", "nope.png") === null
        && ds.filePath("t2", "../../package.json") === null;
    })());
  } finally { core.resolvePath = oldResolve; }
}

/* ================= 2.266.0 — chapter SOUND references ===================
   A song rides the chapter as an audio reference; the character lipsyncs
   to it. Store kind, buildChain's audio branch, both queue paths' split,
   and the writer's teaching. */
{
  const CR = read("lib", "chapterRefs.js");
  check("chapterRefs: kind rides add/load/forChain/restore, sounds by extension", (() => {
    return CR.includes("SOUND_RE") && CR.includes("function kindOf(")
      && (CR.match(/kind: kindOf\(/g) || []).length >= 4
      && CR.includes("add(project, chapter, tmpPath, originalName, label, type, description, kind)");
  })());
  check("the writer is taught lipsync steering at sound tags", (() => {
    return CR.includes("AUDIO references, not pictures")
      && CR.includes("sings along to @the_song")
      && CR.includes('"Reference ${snd ? "sound" : "picture"}"'.slice(11, 40))
      || (CR.includes("AUDIO references, not pictures") && CR.includes("sings along to"));
  })());

  // buildChain LIVE: a sound + a picture chain into the schedule
  const chars2 = require("../lib/characters");
  const g0 = { s: { class_type: "X", inputs: { reference_schedule: ["0", 0] } } };
  const r = chars2.buildChain(g0, [], (c, f) => f, [], null,
    [{ tag: "the_song", file: "song.mp3", kind: "sound" },
     { tag: "pic1", file: "p.png", kind: "image" }], []);
  check("buildChain: a sound ref becomes VHS_LoadAudioUpload + the AUD node, whole clip", (() => {
    const L = r.graph.ref_aud_0, S = r.graph.ref_snd_0;
    return L && L.class_type === "VHS_LoadAudioUpload"
      && L.inputs.audio === "song.mp3" && L.inputs.start_time === 0
      && L.inputs.duration === 0
      && S && S.class_type === "MiniMaxH3ScheduledAudioReference"
      && S.inputs.tag === "the_song";
  })());
  check("buildChain: the chain threads sound -> picture -> schedule", (() => {
    return JSON.stringify(r.graph.ref_pic_0.inputs.previous) === '["ref_snd_0",0]'
      && JSON.stringify(r.graph.s.inputs.reference_schedule) === '["ref_pic_0",0]'
      && r.notes.some((n) => n.includes("chapter sound @the_song"));
  })());

  const R = read("routes", "characters.js");
  check("upload route: sounds accepted, kind derived from the extension", (() => {
    const i = R.indexOf('"/api/scenes/refs", upload.single("image")');
    const s = R.slice(i, i + 900);
    return i > 0 && s.includes('snd ? "sound" : "image"')
      && s.includes("no file uploaded");
  })());
  check("both queue paths split: sounds -> refAudios, pictures keep the image walk", (() => {
    // 2.290.0: queueScene's split is a block now (the reference map's
    // metadata rides beside the push); queueRefScene keeps the one-liner
    return (R.match(/if \(x\.kind === "sound"\) refAudios\.push\(x\.path\);/g) || []).length === 1
      && R.includes('refAudios.push(x.path);\n        audMeta.push({ file: x.path, tag: xtag, kind: "sound"')
      && R.includes("audio reference(s) (voice clips and chapter sounds)");
  })());

  const H = read("static", "index.html");
  check("the reference dialog takes sounds and offers the sound type", (() => {
    return H.includes('.wav,.mp3,.flac,.ogg,.m4a')
      && H.includes('<option value="sound">');
  })());
  const V = read("ext", "videodock", "characters.js");
  check("the strip shows a \\u{1F3B5} tile for sound refs and auto-types sound picks", (() => {
    return V.includes('e.kind === "sound"') && V.includes("\\u{1F3B5}".length ? "🎵" : "")
      && V.includes('el("scRefType").value = "sound"');
  })());
}

/* ================= 2.267.0 — the last-moment scene pin ==================
   "rendered all, it only rendered the first scene 4 times": the shared tmp
   can be rebuilt by any cast/env/refs mutation between queue time and the
   worker's file read, resetting the loop to the export's own range. The
   worker now pins scene_range from the job's OWN scene.n on the very graph
   it submits — no rebuild can race it. */
{
  const W = read("misc/worker.py");
  check("the worker pins scene_range from job scene.n just before submit", (() => {
    const i = W.indexOf("scene pin: the queued graph said scene_range");
    return i > 0
      && W.includes('want = f"{int(sc_n)}:{int(sc_n)}"')
      && W.includes('ins["scene_range"] = want')
      && W.includes('not sc.get("ref_style") and not sc.get("upscale")')
      // the pin sits AFTER refmods and BEFORE accel/submit
      && W.indexOf('_apply_refmods(g, params.get("refmods"))') < i;
  })());
  check("the pin logs the race loudly and confirms the quiet case too", (() => {
    return W.includes("a tmp rebuild raced the queue")
      && W.includes("scene pin: rendering board scene");
  })());
}

/* ================= 2.268.0 — MMH3_Music_Video ==========================
   The AI BRIEF's music-video pack as a second chain style: UI export
   shipped as source, API base converted on first render via live
   /object_info, its own base+tmp pair, @music riding the source-track
   LoadAudio slot, and the LLM addendum. */
{
  const fs2 = require("fs"), path2 = require("path");
  check("the UI export ships and IS a UI export (nodes/links, the pack's 60)", (() => {
    const p = path2.join(__dirname, "..", "comfy_workflows", "MMH3_Music_Video.ui.json");
    if (!fs2.existsSync(p)) return false;
    const g = JSON.parse(fs2.readFileSync(p, "utf8"));
    return Array.isArray(g.nodes) && g.nodes.length === 60
      && g.nodes.some((n) => n.type === "MiniMaxH3ChainPlan")
      && g.nodes.some((n) => n.type === "MiniMaxH3LatentUpscaleBy")
      && g.nodes.some((n) => n.type === "LoadAudio");
  })());
  const S = read("lib", "styles.js");
  check("2.284.0: the chain starters are RETIRED (the pivot) - no MMH3_Music_Video or OBVPM_Timeline starter seeds, retirement notes in their place, while the chain/convert machinery stays for boards that adopted them", (() => {
    return !S.includes('{ name: "MMH3_Music_Video", kind: "video"')
      && !S.includes('{ name: "OBVPM_Timeline", kind: "video"')
      && S.includes("MMH3_Music_Video STARTER RETIRED (2.284.0")
      // 2.291.0: OBVPM is REMOVED outright now (not just retired)
      && S.includes("OBVPM_Timeline REMOVED (2.291.0")
      && S.includes('{ name: "MMH3_NativeAudio_MV", kind: "video", arch: "minimax-h3",');
  })());
  const R = read("routes", "characters.js");
  check("CHAIN_STYLES maps both chains; the music base converts from the ui export", (() => {
    return R.includes('MM3_Characters: { base: BASE_STYLE, tmp: "MM3_Characters_tmp.json" }')
      && R.includes('base: "MMH3_Music_Video.json"')
      && R.includes('ui: "MMH3_Music_Video.ui.json"')
      && R.includes("async function ensureChainBase(");
  })());
  check("both render routes ensure the base BEFORE queueing; widget names never guessed", (() => {
    // 2.293.0: the writer's "▶ as written" is the third caller;
    // 2.307.0: the card's ↻ redo route is the fourth
    return (R.match(/await ensureChainBase\(/g) || []).length === 4
      && R.includes("comfy.objectInfo()")
      && R.includes('(ch.packs || "ComfyUI-MiniMaxH3-Contex-Loop and ComfyUI-KJNodes")');
  })());
  check("queueScene picks the chain by the BOARD's style and reads that chain's tmp", (() => {
    const i = R.indexOf('const chainName = CHAIN_STYLES[st.style] ? st.style : "MM3_Characters"');
    return i > 0 && R.indexOf("wfPath(ch.tmp)", i) > i
      && R.includes("syncTmp(project, `scene ${n} ${upscale ? \"upscale\" : \"generate\"}`, r.chapter || \"\", n, chainName)");
  })());
  check("the source-track slot: song pushed LAST for the numeric LoadAudio; no song = pruned mode B", (() => {
    const i = R.indexOf('if (chainName === "MMH3_Music_Video") {');
    const s = R.slice(i, i + 1200);
    return i > 0 && s.includes("refAudios.push(snd.path)")
      && s.includes("the final assemble muxes the real song")
      && s.includes("H3 generates the music");
  })());
  check("syncTmp is style-aware and refuses cleanly before the base exists", (() => {
    return R.includes("function syncTmp(project, why, chapter, scene, styleName)")
      && R.includes("converted from the pack's UI export on first render");
  })());
  const G = JSON.parse(read("lib", "promptGuides.json"));
  check("the music_video LLM addendum: lyric lock, clip grid, typo rule, source-track sentence", (() => {
    const a = (G.addenda || []).find((x) => x.id === "music_video");
    if (!a || a.kind !== "video") return false;
    const t = (a.rules || []).join(" ");
    return t.includes("<d>[English] Exact lyric line.</d>")
      && t.includes("one sung line per lip-sync clip")
      && t.includes("158")
      && t.includes("Do not invent replacement lyrics")
      && Array.isArray(a.match_text) && a.match_text.length >= 4;
  })());
  check("the addendum FIRES on plain music-video words (live matchAddenda)", (() => {
    const pg = require("../lib/promptGuides");
    const ax = pg.matchAddenda(pg.loadAddenda(require("../lib/core").STYLES_DIR),
                               "video", "a music video where she sings the chorus");
    return ax.some((x) => x.id === "music_video");
  })());
}

/* ================= 2.269.0 — demucs stem separation ====================
   "separate the lyrics from the instruments": Meta's demucs in its own
   venv, a Stems dock extension, both stems landing as sound assets. */
{
  const L = read("lib", "stems.js");
  check("lib/stems: venvs/demucs runJson contract, sound-folder outputs, basename answers", (() => {
    return L.includes('venv.venvDir("demucs"') && L.includes("stems_local.py")
      && L.includes('core.pDir("sound")')
      && L.includes("path.basename(j.vocals)");
  })());
  const H = read("scripts", "stems_local.py");
  check("stems_local: two-stems=vocals, the pair renamed <stem>_vocals/_instrumental", (() => {
    return H.includes('"--two-stems", "vocals"')
      && H.includes('("vocals", "_vocals"), ("no_vocals", "_instrumental")')
      && H.includes("demucs.separate");
  })());
  const W = read("misc/worker.py");
  check("installer: demucs joins the venv modes and VERIFIES ITS OWN import (the 2.264 fish-speech leftover is gone)", (() => {
    return W.includes('"install_whisper", "install_omnivoice", "install_demucs"')
      && W.includes('pkgs = ["demucs", "soundfile"]')
      && W.includes("import demucs.separate")
      && W.includes("import omnivoice; print('omnivoice OK')")
      && !W.includes("fish_speech.models.dac.inference");
  })());
  const R = read("routes", "index.js");
  check("routes: /api/stems + separate; the install validator takes demucs", (() => {
    return R.includes('app.get("/api/stems"') && R.includes('app.post("/api/stems/separate"')
      && R.includes('"whisper", "omnivoice", "demucs"');
  })());
  const E = read("ext", "stemsdock", "ext.json");
  check("the Stems dock is a real extension at column 65 with its own script", (() => {
    const j = JSON.parse(E);
    return j.id === "stemsdock" && j.order === 65 && j.scripts.includes("stemsdock.js")
      && read("static", "index.html").includes("<!-- ext:dock stemsdock -->");
  })());
  const D = read("ext", "stemsdock", "stemsdock.js");
  check("the dock wires: song select from passets, ✂🎤 separate, ⚙ install via the audio-install job", (() => {
    return D.includes('fetch("/api/passets")') && D.includes('"/api/stems/separate"')
      && D.includes('"/api/audio/install"') && D.includes('which: "demucs"');
  })());
  const C = read("lib", "core.js");
  check("stems config: DEFAULT_CONFIG + default.settings agree on the htdemucs shape", (() => {
    const ds = JSON.parse(read("misc/default.settings"));
    return C.includes('stems: { venv: "", model: "htdemucs", device: "auto"')
      && ds.stems && ds.stems.model === "htdemucs" && ds.stems.device === "auto";
  })());
}

// ---- 2.270.0: the music-video segment split (Tim: "add a music video
// button to the left toolbar in prompt docker ... automatically split the
// track into 15 second files, and add them to each scene as audio
// reference. teach the llm the names of the files. save segments in
// music\temp\songname_<n>.<ext> ... tmp_stem_<n>.<ext>") -----------------
{
  const stems = require("../lib/stems");
  const crefs = require("../lib/chapterRefs");
  const core = require("../lib/core");
  check("2.270.0: 15-second segments under music/temp — SEG_SECONDS/SEG_DIR exported",
    stems.SEG_SECONDS === 15
    && /music[\\/]temp$/.test(stems.SEG_DIR()));
  check("2.270.0: segBase strips the demucs suffix, tag-safes the name, and falls to tmp_stem",
    stems.segBase("Neon Nights_vocals.wav") === "neon_nights"
    && stems.segBase("My Song_instrumental.mp3") === "my_song"
    && stems.segBase("") === "tmp_stem"
    && stems.segBase("!!!.wav") === "tmp_stem");

  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "yue270-"));
  const oldResolve = core.resolvePath;
  core.resolvePath = (p) => path.join(tmp, p);
  const PRJ = "yue270_prj";
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "sine=frequency=330:duration=34",
      path.join(tmp, "take.wav")]);
    let split1 = null;
    check("2.270.0 LIVE: a 34s track splits into three ordered 15s files named <base>_<n>.<ext> (a CHILD-less await via the probe pattern is not needed — the promise resolves inside this leg's own async wrap)",
      (() => {
        // sync-safe: run the async split in a child probe (the vacuous-
        // Promise lesson) and read the JSON it prints
        const probe = 'const s=require("./lib/stems");'
          + 'const c=require("./lib/core");const p=require("path");'
          + 'c.resolvePath=(x)=>p.join(' + JSON.stringify(tmp) + ',x);'
          + 's.split(' + JSON.stringify(path.join(tmp, "take.wav"))
          + ',"Gate Song_vocals.wav").then((r)=>console.log("@@SP "+JSON.stringify(r)))'
          + '.catch((e)=>console.log("@@SP FAIL "+e.message));';
        const out = execFileSync(process.execPath, ["-e", probe],
          { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
        const line = out.split("\n").find((l) => l.startsWith("@@SP "));
        if (!line || line.includes("FAIL")) return false;
        split1 = JSON.parse(line.slice(5));
        return split1.base === "gate_song" && split1.seconds === 15
          && split1.files.join(",") === "gate_song_1.wav,gate_song_2.wav,gate_song_3.wav"
          && split1.files.every((f) => fs.existsSync(path.join(tmp, "music", "temp", f)));
      })());
    check("2.270.0 LIVE: a re-split of the same base REPLACES — no stale segment from a longer earlier take survives",
      (() => {
        execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
          "-f", "lavfi", "-i", "sine=frequency=330:duration=20",
          path.join(tmp, "take2.wav")]);
        const probe = 'const s=require("./lib/stems");'
          + 'const c=require("./lib/core");const p=require("path");'
          + 'c.resolvePath=(x)=>p.join(' + JSON.stringify(tmp) + ',x);'
          + 's.split(' + JSON.stringify(path.join(tmp, "take2.wav"))
          + ',"Gate Song").then((r)=>console.log("@@SP2 "+r.files.join(",")))'
          + '.catch((e)=>console.log("@@SP2 FAIL "+e.message));';
        const out = execFileSync(process.execPath, ["-e", probe],
          { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
        const line = (out.split("\n").find((l) => l.startsWith("@@SP2 ")) || "");
        const left = fs.readdirSync(path.join(tmp, "music", "temp"))
          .filter((f) => f.startsWith("gate_song_"));
        return line.trim() === "@@SP2 gate_song_1.wav,gate_song_2.wav"
          && left.length === 2;
      })());

    // ---- scene binding: addExternal + forChain's scene filter ----------
    const segDir = path.join(tmp, "music", "temp");
    crefs.addExternal(PRJ, "", segDir, "gate_song_1.wav",
      { kind: "sound", scene: 1, label: "gate_song_1" });
    crefs.addExternal(PRJ, "", segDir, "gate_song_2.wav",
      { kind: "sound", scene: 2, label: "gate_song_2" });
    fs.writeFileSync(path.join(tmp, "free.wav"), "RIFF");
    crefs.add(PRJ, "", path.join(tmp, "free.wav"), "free_song.wav",
      "free song", "", "", "sound");
    check("2.270.0: forChain sends a scene-bound segment ONLY to its own scene while unbound sounds ride every queue, and a scene-less caller gets only the unbound",
      (() => {
        const s1 = crefs.forChain(PRJ, "", 1).refs.map((x) => x.file).sort();
        const s2 = crefs.forChain(PRJ, "", 2).refs.map((x) => x.file).sort();
        const s0 = crefs.forChain(PRJ, "").refs.map((x) => x.file);
        return s1.join(",") === "free_song.wav,gate_song_1.wav"
          && s2.join(",") === "free_song.wav,gate_song_2.wav"
          && s0.join(",") === "free_song.wav";
      })());
    check("2.270.0: removing an EXTERNAL entry leaves its file on disk (music/temp belongs to the split) while clearExternalSegments drops only the bound entries",
      (() => {
        crefs.remove(PRJ, "", "gate_song_1.wav");
        const still = fs.existsSync(path.join(segDir, "gate_song_1.wav"));
        crefs.addExternal(PRJ, "", segDir, "gate_song_1.wav",
          { kind: "sound", scene: 1, label: "gate_song_1" });
        const gone = crefs.clearExternalSegments(PRJ);
        const after = crefs.forChain(PRJ, "", 1).refs.map((x) => x.file);
        return still && gone === 2 && after.join(",") === "free_song.wav";
      })());
    check("2.270.0: the WRITER learns the names — refsBrief carries ONE grouped segment line (@base_1 … @base_N, scene n's own slice, never another scene's) and prefixParagraphs teaches the same",
      (() => {
        crefs.addExternal(PRJ, "", segDir, "gate_song_1.wav",
          { kind: "sound", scene: 1, label: "gate_song_1" });
        crefs.addExternal(PRJ, "", segDir, "gate_song_2.wav",
          { kind: "sound", scene: 2, label: "gate_song_2" });
        const brief = crefs.refsBrief(PRJ);
        const paras = crefs.prefixParagraphs(PRJ).join("\n");
        const grouped = (brief.match(/sound segments, 15s/g) || []).length === 1;
        return grouped
          && brief.includes("@gate_song_1 \u2026 @gate_song_2")
          && brief.includes("never name another scene's segment")
          && !brief.includes("- @gate_song_1 (sound)")
          && paras.includes('Song segments "gate_song"')
          && paras.includes("exactly its 15 seconds");
      })());
  } finally {
    core.resolvePath = oldResolve;
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(path.join(__dirname, "..", "projects", PRJ),
                    { recursive: true, force: true }); } catch {}
  }

  // ---- the plumbing pins ------------------------------------------------
  const RC = read("routes", "characters.js");
  check("2.270.0: every queue's forChain names ITS scene (both chain paths + syncTmp) and the MMH3 source track prefers the scene's OWN segment",
    (RC.match(/forChain\(project, r\.chapter \|\| "", r\.n\)/g) || []).length === 2
    && RC.includes("chapterRefs.forChain(project, chapter, scene)")
    && RC.includes('x.kind === "sound" && x.scene')
    && RC.indexOf('x.kind === "sound" && x.scene')
       < RC.indexOf('return x.kind === "sound"; });'));
  const RI = read("routes", "index.js");
  check("2.270.0/2.275.0: POST /api/stems/split — a 512MB single-file multer riding the ONE binder (stems.assignSegments: clear-old-then-bind, segment n to scene n, leftovers and the no-scenes case said in words)",
    (() => {
      const ST = read("lib", "stems.js");
      return RI.includes('app.post("/api/stems/split", stemUpload.single("file")')
        && RI.includes("fileSize: 512 * 1024 * 1024, files: 1")
        && RI.includes("stems.assignSegments(core.getProject(), r)")
        && ST.includes("chapterRefs.clearExternalSegments(project);")
        && ST.indexOf("chapterRefs.clearExternalSegments(project);")
           < ST.indexOf("chapterRefs.addExternal(project, sc.chapter")
        && ST.includes("no scenes on the board yet")
        && ST.includes("stay unassigned in music/temp");
    })());
  const D70 = read("ext", "promptdock", "dock.html");
  check("2.270.0: 🎤 Create-music-video joins #ptools after 🎵, the ＋ accept list gains EXPLICIT audio types (never a slash-star wildcard), and #pdStemNote reports the split",
    D70.includes('id="ptMusicVideo"') && D70.includes(">\uD83C\uDFA4</button>")
    && D70.indexOf('id="ptSong"') < D70.indexOf('id="ptMusicVideo"')
    && D70.includes("audio/wav, audio/x-wav, audio/mpeg, audio/flac, audio/ogg, audio/mp4, audio/x-m4a")
    && D70.includes('id="pdStemNote"'));
  const P70 = read("ext", "promptdock", "promptdock.js");
  check("2.270.0: the 🎤 phrase is \"create music video\" (the music_video addendum's own match) and an AUDIO pick branches to pdSplitStem BEFORE the image filter — never a chip",
    P70.includes('ptMusicVideo: "create music video"')
    && P70.includes("const PD_AUDIO_RE = /\\.(wav|mp3|flac|ogg|m4a)$/i;")
    && P70.includes('fetch("/api/stems/split", { method: "POST", body: fd })')
    && P70.indexOf("pdSplitStem(f);")
       < P70.indexOf('if (!/^image\\/(png|jpeg|webp)$/i.test(f.type || "")) continue;'));
  check("2.270.0: \"create music video\" fires the music_video addendum LIVE",
    (() => {
      const pg = require("../lib/promptGuides");
      const hit = pg.matchAddenda(pg.loadAddenda(require("../lib/core").STYLES_DIR),
                                  "video", "create music video");
      return hit.some((a) => a.id === "music_video");
    })());
  check("2.270.0 LIVE jsdom: picking an AUDIO file posts to /api/stems/split, chips stay empty, and the note line reports (the 2.245 rule: core's later wiring must not be needed for this — promptdock owns it)",
    (() => {
      const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM('<div class="prow"><div class="pleft">'
  + '<div id="pdChips" class="hidden"></div>'
  + '<div id="pdStemNote" class="hidden"></div>'
  + '<textarea id="prompt"></textarea>'
  + '<button id="pdAttachBtn"></button>'
  + '<input type="file" id="pdAttachFile"></div></div>', { url: "http://x/" });
const w = dom.window;
global.window = w; global.document = w.document;
global.FormData = w.FormData; global.File = w.File;
let hitUrl = "";
w.fetch = global.fetch = (u, o) => { hitUrl = String(u);
  return Promise.resolve({ ok: true, json: () => Promise.resolve(
    { ok: true, base: "gate_song", seconds: 15,
      files: ["gate_song_1.wav"], assigned: [{ scene: 1 }] }) }); };
eval(fs.readFileSync("ext/promptdock/promptdock.js", "utf8"));
const inp = w.document.getElementById("pdAttachFile");
const f = new w.File(["RIFF"], "Gate Song_vocals.wav", { type: "audio/wav" });
Object.defineProperty(inp, "files", { value: [f] });
inp.dispatchEvent(new w.Event("change"));
setTimeout(() => {
  const chips = w.document.getElementById("pdChips");
  const note = w.document.getElementById("pdStemNote");
  console.log("@@SPLIT " + (hitUrl === "/api/stems/split"
    && chips.children.length === 0
    && !note.classList.contains("hidden")
    && note.textContent.includes("gate_song")));
}, 50);`;
      const out = execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@SPLIT true");
    })());
}

// ---- 2.271.0: teach the LLM how to lipsync (Tim: "using the music video
// zip instructions teach the llm how to lipsync" — the pack's Lip-sync-
// the-critical-syntax section, carried in full) ---------------------------
{
  const pg = require("../lib/promptGuides");
  const core = require("../lib/core");
  const mv = pg.matchAddenda(pg.loadAddenda(core.STYLES_DIR),
                             "video", "create music video")
    .find((a) => a.id === "music_video");
  const R = (mv.rules || []).join("\n");
  check("2.271.0: LIPSYNC SYNTAX carries the pack's contrast — stable (S1) speaker ID, voice OUTSIDE the <d>, lyric verbatim INSIDE, and the bare prose label named as the gibberish-vocals form",
    R.includes("(S1)") && R.includes("stays the SAME")
    && R.includes("OUTSIDE the <d>")
    && R.includes("'LIP SYNC exactly: ...' is NOT sufficient")
    && R.includes("gibberish vocals"));
  check("2.271.0: LIPSYNC STAGING demands a fully visible unobstructed mouth and the explicit syllable sentence — and INSTRUMENTAL LIPS closes the mouth with NO <d> in cinematic clips",
    R.includes("FULLY VISIBLE and unobstructed")
    && R.includes("lip movement matches every syllable exactly")
    && R.includes("remain completely closed")
    && R.includes("INSTRUMENTAL LIPS"));
  check("2.271.0: REFERENCE DEFINITIONS opens the prompt with the pack's three definitions, and SOURCE TRACK names the scene's OWN 2.270 segment as that clip's <Audio 1>",
    R.includes("defined by <Picture 1>")
    && R.includes("typography reference styled from @typo")
    && R.includes("vocal timing, melody and")
    && R.includes("never another scene's segment"));
  check("2.271.0: the example RENDERS the teachings — (S1) + voice + sings-to-lens + <d> line, the syllable sentence, typo clear of the face, and a closed-lips instrumental shot",
    (() => {
      const ex = String(mv.example || "");
      return ex.includes("@vera (S1), a smoky female alt-rock vocalist")
        && ex.includes("<d>[English] I burned the map you drew for me.</d>")
        && ex.includes("every syllable")
        && ex.includes("well clear of her face")
        && ex.includes("her lips remain completely closed");
    })());
}

// ---- 2.272.0: songs from anywhere (Tim: "add a folder select button
// after the song dropdown in stems, allow user to upload songs from
// anywhere") --------------------------------------------------------------
{
  const D = read("ext", "stemsdock", "dock.html");
  check("2.272.0: 📂 stBrowse sits AFTER the song dropdown and BEFORE ⟳, with a hidden multiple picker whose accept list is EXPLICIT audio types (opus included, no slash-star wildcard)",
    D.indexOf('id="stSong"') < D.indexOf('id="stBrowse"')
    && D.indexOf('id="stBrowse"') < D.indexOf('id="stRefresh"')
    && D.includes('id="stFile"') && D.includes("multiple")
    && D.includes("audio/wav, audio/x-wav, audio/mpeg, audio/flac, audio/ogg, audio/mp4, audio/x-m4a, audio/opus"));
  const J = read("ext", "stemsdock", "stemsdock.js");
  check("2.272.0: uploads run ONE AFTER ANOTHER to /api/stems/upload, the status line names the file in flight, and loadSongs(prefer) selects the newest upload race-free",
    J.includes('fetch("/api/stems/upload", { method: "POST", body: fd })')
    && J.includes("chain = chain.then(function () {")
    && J.includes('say("uploading " + f.name')
    && J.includes("function loadSongs(prefer)")
    && J.includes("var keep = prefer || sel.value;")
    && J.includes("loadSongs(done[done.length - 1]);"));
  check("2.272.0: the dock's song filter knows opus (core's PKINDS sound list)",
    J.includes("/\\.(wav|mp3|flac|ogg|m4a|opus)$/i"));
  const RI = read("routes", "index.js");
  check("2.272.0: ONE asset-save path — saveAssetFile is shared by /api/passets and the 512MB /api/stems/upload, and a non-audio upload is unlinked and refused in words",
    RI.includes("function saveAssetFile(file)")
    && RI.includes("try { res.json(saveAssetFile(req.file)); }")
    && RI.includes('app.post("/api/stems/upload", stemUpload.single("file")')
    && RI.includes('if (r.kind !== "sound") {')
    && RI.includes("not an audio file"));
  check("2.272.0 LIVE jsdom: 📂 → picker, a picked file posts to /api/stems/upload and the dropdown re-reads AND selects the upload",
    (() => {
      const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM('<div class="bdock" id="stemsdock"><div class="bbody">'
  + '<select id="stSong"></select><button id="stBrowse"></button>'
  + '<input type="file" id="stFile" multiple><button id="stRefresh"></button>'
  + '<button id="stGo"></button><button id="stInstall"></button>'
  + '<div id="stMsg"></div><div id="stOut"></div></div></div>', { url: "http://x/" });
const w = dom.window;
global.window = w; global.document = w.document;
global.FormData = w.FormData; global.File = w.File;
const hits = [];
w.fetch = global.fetch = (u, o) => {
  hits.push(String(u));
  if (String(u) === "/api/stems/upload")
    return Promise.resolve({ ok: true, json: () => Promise.resolve(
      { ok: true, name: "Anywhere Song.wav", kind: "sound" }) });
  if (String(u) === "/api/passets")
    return Promise.resolve({ ok: true, json: () => Promise.resolve(
      { sound: [{ name: "old.mp3" }, { name: "Anywhere Song.wav" }] }) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
};
eval(fs.readFileSync("ext/stemsdock/stemsdock.js", "utf8"));
const inp = w.document.getElementById("stFile");
const f = new w.File(["RIFF"], "Anywhere Song.wav", { type: "audio/wav" });
Object.defineProperty(inp, "files", { value: [f] });
inp.dispatchEvent(new w.Event("change"));
setTimeout(() => {
  const sel = w.document.getElementById("stSong");
  console.log("@@UP " + (hits.includes("/api/stems/upload")
    && sel.value === "Anywhere Song.wav"
    && w.document.getElementById("stMsg").textContent.includes("1 song(s) added")));
}, 80);`;
      const out = execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@UP true");
    })());
}

// ---- 2.273.0: three waveforms + play (Tim: "add 3 waveforms, 1 for full
// song, 1 for vocals and 1 for instruments, add a play button next to each
// one, to the stems docker") ----------------------------------------------
{
  const D = read("ext", "stemsdock", "dock.html");
  check("2.273.0: three rows in the dock — full song / vocals / instruments — each with its OWN ▶ and canvas, hidden until the file exists",
    ["stRowSong", "stRowVoc", "stRowInst"].every((id) =>
      D.includes('id="' + id + '"') && D.indexOf('class="strow hidden" id="' + id + '"') >= 0)
    && ["stPlaySong", "stPlayVoc", "stPlayInst"].every((id) => D.includes('id="' + id + '"'))
    && ["stWaveSong", "stWaveVoc", "stWaveInst"].every((id) => D.includes('id="' + id + '"')));
  const J = read("ext", "stemsdock", "stemsdock.js");
  check("2.273.0: peaks ride the app's ONE extractor (/api/waveform, src=sound), audio streams from /passets/sound/, each row maps to ITS OWN canvas, and playing one row pauses the others",
    J.includes('fetch("/api/waveform?src=sound&name=" + encodeURIComponent(file)')
    && J.includes('new Audio("/passets/sound/" + encodeURIComponent(w.file)')
    && J.includes('(w.bust ? "&t=" + w.bust : "")')   // 2.276: post-edit cache-buster
    && J.includes('cv: "stWaveSong"') && J.includes('cv: "stWaveVoc"')
    && J.includes('cv: "stWaveInst"')
    && J.includes("function stopOthers(me)")
    && J.includes("if (w !== me && w.audio && !w.audio.paused) w.audio.pause();"));
  check("2.273.0: the stem rows derive their names from the SELECTED song exactly as lib/stems names its outputs (<base>_vocals.wav / <base>_instrumental.wav), and the drawing re-measures on dock resize (the 2.253 ext-owns-its-size lesson)",
    J.includes('voc: b + "_vocals.wav", inst: b + "_instrumental.wav"')
    && J.includes("cv.clientWidth")
    && J.includes("new ResizeObserver(")
    // 2.298.0: the change goes through onSongChange (adopts a scanned pick
    // from another project folder first), which still redraws the rows
    && J.includes("addEventListener(\"change\", onSongChange)")
    && /function onSongChange\(\) \{[\s\S]*?stWavesRefresh\(\);/.test(J));
  check("2.273.0 LIVE jsdom: selecting a song shows its row, fetches ITS peaks, ▶ builds the row's audio from /passets/sound/, and a missing stem row stays hidden",
    (() => {
      const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const rows = ["Song","Voc","Inst"].map((k) =>
  '<div class="strow hidden" id="stRow'+k+'"><button id="stPlay'+k+'"></button>'
  + '<canvas id="stWave'+k+'"></canvas></div>').join("");
const dom = new JSDOM('<div class="bdock" id="stemsdock"><div class="bbody">'
  + '<select id="stSong"></select><button id="stBrowse"></button>'
  + '<input type="file" id="stFile" multiple><button id="stRefresh"></button>'
  + '<button id="stGo"></button><button id="stInstall"></button>'
  + '<div id="stMsg"></div><div id="stOut"></div>' + rows
  + '</div></div>', { url: "http://x/", pretendToBeVisual: true });
const w = dom.window;
global.window = w; global.document = w.document;
const waveHits = [];
w.Audio = global.Audio = function (src) {
  this.src = src; this.paused = true;
  this.play = () => { this.paused = false; return Promise.resolve(); };
  this.pause = () => { this.paused = true; };
  this.addEventListener = () => {};
};
w.fetch = global.fetch = (u) => {
  const url = String(u);
  if (url === "/api/passets")
    return Promise.resolve({ ok: true, json: () => Promise.resolve(
      { sound: [{ name: "tune.mp3" }, { name: "tune_vocals.wav" }] }) });
  if (url.startsWith("/api/waveform")) {
    waveHits.push(url);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(
      { peaks: [10, 200, 10], seconds: 3 }) });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
};
eval(fs.readFileSync("ext/stemsdock/stemsdock.js", "utf8"));
setTimeout(() => {
  const sel = w.document.getElementById("stSong");
  sel.value = "tune.mp3";
  sel.dispatchEvent(new w.Event("change"));
  setTimeout(() => {
    const songShown = !w.document.getElementById("stRowSong").classList.contains("hidden");
    const vocShown = !w.document.getElementById("stRowVoc").classList.contains("hidden");
    const instHidden = w.document.getElementById("stRowInst").classList.contains("hidden");
    w.document.getElementById("stPlaySong").onclick();
    const audioOk = waveHits.some((u) => u.includes("tune.mp3"))
      && waveHits.some((u) => u.includes("tune_vocals.wav"))
      && !waveHits.some((u) => u.includes("instrumental"));
    console.log("@@WV " + (songShown && vocShown && instHidden && audioOk));
  }, 60);
}, 60);`;
      const out = execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@WV true");
    })());
}

// ---- 2.274.0: install-button auto-hide + the animated Separate (Tim:
// "check to see if demcus is installed, if it is installed then hide the
// install button. when the separate button is pressed, change button text
// to separating... (animate text until separation is complete) and change
// back to separate on complete separation") -------------------------------
{
  const J = read("ext", "stemsdock", "stemsdock.js");
  const D = read("ext", "stemsdock", "dock.html");
  // 2.601.0 (Tim: "if an addon/package/model has been installed change the button to reinstall"): no longer hidden - ⟳ Reinstall
  check("2.274.0 → 2.601.0: status() turns ⚙ Install into ⟳ Reinstall exactly when /api/stems says installed (it was hidden) — and ⟳ re-checks",
    J.includes('else ib.textContent = j.installed ? "⟳ Reinstall" : "⚙ Install";') && J.includes('window.H3Install.set(ib, !!j.installed, { install: "⚙ Install" });')
    && J.includes('el("stRefresh").onclick = function () { loadSongs(); status(); };'));
  check("2.274.0: the Separate button animates 'separating' with a walking dot (400ms interval), restores its EXACT dock label on BOTH the success and failure paths, and the interval is always cleared",
    J.includes('var SEP_LABEL = "✂🎤 Separate";')
    && D.includes(">✂🎤 Separate</button>")
    && J.includes('b.textContent = "separating" + new Array(dots + 1).join(".");')
    && J.includes("}, 400);")
    && J.includes("if (sepTimer) { clearInterval(sepTimer); sepTimer = null; }")
    && J.includes("sepAnimStop(b);\n        if (j.error)")
    && J.includes('.catch(function (e) { b.disabled = false; sepAnimStop(b); say("separation failed: '));
  check("2.274.0 LIVE jsdom: installed:true = ⟳ Reinstall (2.601.0, was hidden), pressing ✂🎤 walks the dots while the separate is in flight, and the label returns on completion",
    (() => {
      const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM('<div class="bdock" id="stemsdock"><div class="bbody">'
  + '<select id="stSong"><option value="tune.mp3">tune.mp3</option></select>'
  + '<button id="stBrowse"></button><input type="file" id="stFile" multiple>'
  + '<button id="stRefresh"></button>'
  + '<button id="stGo">✂🎤 Separate</button>'
  + '<button id="stInstall">⚙ Install</button>'
  + '<div id="stMsg"></div><div id="stOut"></div></div></div>', { url: "http://x/" });
const w = dom.window;
global.window = w; global.document = w.document;
let sepResolve = null;
w.fetch = global.fetch = (u) => {
  const url = String(u);
  if (url === "/api/stems")
    return Promise.resolve({ ok: true, json: () => Promise.resolve(
      { installed: true, model: "htdemucs", device: "auto" }) });
  if (url === "/api/stems/separate")
    return new Promise((res) => { sepResolve = () => res({ ok: true,
      json: () => Promise.resolve({ ok: true, vocals: "v.wav", instrumental: "i.wav" }) }); });
  if (url === "/api/passets")
    return Promise.resolve({ ok: true, json: () => Promise.resolve(
      { sound: [{ name: "tune.mp3" }] }) });   // loadSongs repaints the select from THIS
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
};
eval(fs.readFileSync("ext/stemsdock/stemsdock.js", "utf8"));
setTimeout(() => {
  const inst = w.document.getElementById("stInstall");
  const go = w.document.getElementById("stGo");
  const hidden = !inst.classList.contains("hidden") && inst.textContent === "⟳ Reinstall";   // 2.601.0
  go.onclick();
  const atPress = go.textContent;
  setTimeout(() => {
    const midFlight = go.textContent;
    sepResolve();
    setTimeout(() => {
      console.log("@@SEP " + (hidden
        && atPress === "separating"
        && midFlight.startsWith("separating") && midFlight !== atPress
        && go.textContent === "✂🎤 Separate"
        && !go.disabled));
    }, 60);
  }, 450);
}, 60);`;
      const out = execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@SEP true");
    })());
}

// ---- 2.275.0: the music-video ask wires the whole flow (Tim: "when i ask
// to create the music video change the video dockers workflow to the music
// video workflow, add a dropdown in the menubar of video docker for
// workflows ... break the song loaded into the prompt into segments ...
// the llm should send music videos scene prompts to video docker scenes")
{
  const SP = require("../lib/screenplay");
  check("2.275.0: asksForMusicVideo — create/make/write + the words (or 'music video of'), never a passing mention",
    SP.asksForMusicVideo("create the music video")
    && SP.asksForMusicVideo("make a music video for this song")
    && SP.asksForMusicVideo("music video of neon nights")
    && !SP.asksForMusicVideo("that music video was great")
    && !SP.asksForMusicVideo("create a screenplay"));
  const RC = read("routes", "characters.js");
  check("2.275.0: /api/screenplay/intent answers music_video, and the WRITER folds the video addenda matched on the user's OWN brief (the lyric-lock rules reach the model that writes the scenes)",
    RC.includes("music_video: screenplay.asksForMusicVideo(t)")
    && RC.includes('promptGuides.addendaFor(core.STYLES_DIR, "video",')
    && RC.includes('String(b.brief || ""))')
    && RC.includes('+ (briefAddenda ? "\\n\\n" + briefAddenda : "")'));
  check("2.275.0: the style route's note tells the truth per flow — ref2va, a chain style's own chain, unknown-through-MM3, and the bare chain",
    RC.includes("no board flow of its own")
    && RC.includes('(CHAIN_STYLES[name] && name !== "MM3_Characters")'));
  const ST = read("lib", "stems.js");
  const RI = read("routes", "index.js");
  check("2.275.0: split persists last_split.json (dead files dropped on read) and ONE binder serves the split route, POST /api/stems/reassign, and the ask — a missing split is refused in words",
    ST.includes('path.join(dir, "last_split.json")')
    && ST.includes("j.files = j.files.filter((f) => fs.existsSync(path.join(j.dir, f)));")
    && ST.includes("function assignSegments(project, split)")
    && RI.includes('app.post("/api/stems/reassign"')
    && RI.includes("stems.assignSegments(core.getProject(), last)")
    && RI.includes("no split segments yet"));
  check("2.275.0 LIVE: assignSegments binds segment n to scene n on the CURRENT board and a reassign after a plan rewrite re-binds",
    (() => {
      const stems = require("../lib/stems");
      const crefs = require("../lib/chapterRefs");
      const scenesL = require("../lib/scenes");
      const PRJ = "yue275_prj";
      try {
        const st = scenesL.blank();
        st.list = [{ n: 1, id: "a", chapter: "", prompt: ["x"] },
                   { n: 2, id: "b", chapter: "", prompt: ["y"] }];
        scenesL.save(st, PRJ);
        const tmpd = fs.mkdtempSync(path.join(require("os").tmpdir(), "seg275-"));
        for (const f of ["mv_1.wav", "mv_2.wav", "mv_3.wav"])
          fs.writeFileSync(path.join(tmpd, f), "RIFF");
        const a = stems.assignSegments(PRJ,
          { base: "mv", dir: tmpd, files: ["mv_1.wav", "mv_2.wav", "mv_3.wav"] });
        const s1 = crefs.forChain(PRJ, "", 1).refs.map((x) => x.file);
        const s2 = crefs.forChain(PRJ, "", 2).refs.map((x) => x.file);
        return a.assigned.length === 2 && a.leftover.length === 1
          && /1 segment\(s\) beyond the board's 2 scene\(s\)/.test(a.note)
          && s1.join(",") === "mv_1.wav" && s2.join(",") === "mv_2.wav";
      } finally {
        try { fs.rmSync(path.join(__dirname, "..", "projects", PRJ),
                        { recursive: true, force: true }); } catch {}
      }
    })());
  const VD = read("ext", "videodock", "dock.html");
  const VC = read("ext", "videodock", "characters.js");
  check("2.275.0: #vdWorkflow lives in the MENUBAR (#mvBar, before Compile), ONE fill feeds BOTH selects from /api/styles?kind=video, changes post the style and mirror each other, and scPaint keeps both true",
    VD.indexOf('id="mvBar"') < VD.indexOf('id="vdWorkflow"')
    && VD.indexOf('id="vdWorkflow"') < VD.indexOf('id="mvCompile"')
    // 2.323.0: the fill offers ONLY the scene-by-scene flows (VD_FLOWS)
    && VC.includes("var opts = VD_FLOWS.map(function (f) {")
    && VC.includes('["scStyleSel", "vdWorkflow"].forEach(')
    && VC.includes("function vdStylePost(name, other)")
    && VC.includes('el("vdWorkflow").value = scState.style || VD_FLOWS[0][0];'));
  check("2.275.0: the intent branch — music_video BEFORE wants: style to MMH3_Music_Video, BOTH selects mirrored, the SAME runWriter, THEN /api/stems/reassign, honest segment line either way",
    VC.includes("var runWriter = function () {")
    && VC.includes('if (it.music_video) {')
    && VC.indexOf("if (it.music_video) {") < VC.indexOf("if (!it.wants) return null;")
    // 2.293.0: a board already on MMH3_NativeAudio_MV keeps it
    && VC.includes('? "MMH3_NativeAudio_MV" : "MMH3_Music_Video";')
    && VC.includes('scPost("/api/scenes/style", { name: mvStyle })')
    && VC.includes('fetch("/api/stems/reassign", { method: "POST" })')
    && VC.indexOf("return runWriter();\n            })")
       < VC.indexOf('fetch("/api/stems/reassign"')
    && VC.includes("song segment(s) riding the scenes as lipsync audio"));
}

// ---- 2.276.0: waveform region volume (Tim: "the vocal separation still
// has some instrumental artifacts, can we add a selector for the waveform
// and set the volume for the selected part (flatten the wave) and add a
// icon only save button at the end of the waveform to save the file") ----
{
  const stems = require("../lib/stems");
  check("2.276.0 LIVE: volumeEdit flattens EXACTLY the selected region in place — middle third to digital silence, edges untouched (measured with atrim inside the filtergraph; output -ss measures the WHOLE file and lies)",
    (() => {
      const name = "yue276 gate.wav";
      const p2 = path.join(__dirname, "..", "projects", "default", "sound", name);
      try {
        execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
          "-f", "lavfi", "-i", "sine=frequency=440:duration=6", p2]);
        const probe = 'require("./lib/stems").volumeEdit('
          + JSON.stringify(name) + ', 1/3, 2/3, 0)'
          + '.then((r) => console.log("@@VE " + JSON.stringify(r)))'
          + '.catch((e) => console.log("@@VE FAIL " + e.message));';
        const out = execFileSync(process.execPath, ["-e", probe],
          { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
        const line = out.split("\n").find((l) => l.startsWith("@@VE "));
        if (!line || line.includes("FAIL")) return false;
        const r = JSON.parse(line.slice(5));
        const meas = (a, b) => {
          // ffmpeg exits 0 and prints volumedetect to STDERR — spawnSync
          // captures it directly
          const r2 = require("child_process").spawnSync("ffmpeg",
            ["-hide_banner", "-i", p2, "-af", `atrim=${a}:${b},volumedetect`,
             "-f", "null", "-"], { encoding: "utf8" });
          const m = String(r2.stderr || "").match(/mean_volume:\s*(-?[\d.]+|inf)/);
          return m ? parseFloat(m[1] === "inf" ? "-200" : m[1]) : 0;
        };
        const mid = meas(2.5, 3.5), edge = meas(0.5, 1.5);
        return r.gain === 0 && r.from === 2 && r.to === 4
          && mid < -80 && edge > -25 && edge < -15;
      } finally { try { fs.unlinkSync(p2); } catch {} }
    })());
  const RI = read("routes", "index.js");
  check("2.276.0/2.277.0: POST /api/stems/volume (with rebase) validates in words, the replace RETRIES on EPERM/EBUSY then falls to copy-into, a still-locked file fails IN WORDS with the edit kept, and the temp wears .voltmp LAST so a straggler never lists as an asset",
    RI.includes('app.post("/api/stems/volume"')
    && RI.includes("stems.volumeEdit(name, b.from, b.to, b.gain,")
    && RI.includes("{ rebase: b.rebase }")
    && (() => {
      const ST = read("lib", "stems.js");
      return ST.includes("the selection must be a region: 0 <= from < to <= 1")
        && ST.includes("volume must be between 0 (silence) and 4 (x4)")
        && ST.includes('const tmp = src + ".voltmp";')
        && ST.includes("for (const wait of [0, 100, 250, 500, 1000])")
        && ST.includes("/EPERM|EBUSY|EACCES/")
        && ST.includes("fs.copyFileSync(tmp, src); fs.unlinkSync(tmp);")
        && ST.includes("is held open by another program")
        && ST.includes("volume=enable='between(t,");
    })());
  const D = read("ext", "stemsdock", "dock.html");
  const J = read("ext", "stemsdock", "stemsdock.js");
  check("2.276.0/2.277.0: the number inputs are GONE, 💾 stays icon-only per row, DRAG selects (4px threshold), a click OUTSIDE the selection still clears-and-seeks, the overlay is translucent tiger, and every apply reloads with a cache-buster",
    ["stSaveSong", "stSaveVoc", "stSaveInst"].every((id) => D.includes('id="' + id + '"'))
    && !D.includes("stVolSong") && !D.includes("stVolVoc") && !D.includes("stVolInst")
    && J.includes("if (Math.abs(ev.clientX - drag.x0) >= 4) drag.moved = true;")
    && J.includes("w.sel = null;                       // a click clears the selection…")
    && J.includes("ctx.globalAlpha = 0.25;")
    && J.includes('fetch("/api/stems/volume", {')
    && J.includes("w.bust = Date.now();"));
  check("2.276.0 LIVE jsdom: 💾 with no selection refuses in words and posts NOTHING",
    (() => {
      const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const rows = ["Song","Voc","Inst"].map((k) =>
  '<div class="strow hidden" id="stRow'+k+'"><button id="stPlay'+k+'"></button>'
  + '<canvas id="stWave'+k+'"></canvas><input id="stVol'+k+'" value="0">'
  + '<button id="stSave'+k+'"></button></div>').join("");
const dom = new JSDOM('<div class="bdock" id="stemsdock"><div class="bbody">'
  + '<select id="stSong"></select><button id="stBrowse"></button>'
  + '<input type="file" id="stFile" multiple><button id="stRefresh"></button>'
  + '<button id="stGo"></button><button id="stInstall"></button>'
  + '<div id="stMsg"></div><div id="stOut"></div>' + rows
  + '</div></div>', { url: "http://x/", pretendToBeVisual: true });
const w = dom.window;
global.window = w; global.document = w.document;
const hits = [];
w.fetch = global.fetch = (u) => {
  hits.push(String(u));
  if (String(u) === "/api/passets")
    return Promise.resolve({ ok: true, json: () => Promise.resolve(
      { sound: [{ name: "tune.mp3" }] }) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
};
eval(fs.readFileSync("ext/stemsdock/stemsdock.js", "utf8"));
setTimeout(() => {
  const sel = w.document.getElementById("stSong");
  sel.value = "tune.mp3";
  sel.dispatchEvent(new w.Event("change"));
  setTimeout(() => {
    w.document.getElementById("stSaveSong").onclick();
    const msg = w.document.getElementById("stMsg").textContent;
    console.log("@@VS " + (msg.includes("drag across the")
      && !hits.some((u) => String(u).includes("/api/stems/volume"))));
  }, 60);
}, 60);`;
      const out = execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      return out.split("\n").some((l) => l.trim() === "@@VS true");
    })());
}

// ---- 2.277.0: the inline volume slider + the Windows lock fix (Tim:
// "EPERM ... rename ... voltmp.wav -> ... .wav" + "when i click a
// selected area show a volume slider above the selected area, apply the
// new volume instantly, add an x button ... close ... if user clicks
// away ... remove the volume dropdowns") ---------------------------------
{
  check("2.277.0 LIVE: the slider's value is ABSOLUTE — 50% then 25% with rebase:false lands the region at −12 dB from the ORIGINAL (compounding would be −18), edges untouched, and .volbase never matches an asset extension",
    (() => {
      const name = "yue277 gate.wav";
      const p2 = path.join(__dirname, "..", "projects", "default", "sound", name);
      try {
        execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
          "-f", "lavfi", "-i", "sine=frequency=440:duration=6", p2]);
        const probe = 'const s=require("./lib/stems");'
          + 's.volumeEdit(' + JSON.stringify(name) + ',1/3,2/3,0.5,{rebase:true})'
          + '.then(()=>s.volumeEdit(' + JSON.stringify(name) + ',1/3,2/3,0.25,{rebase:false}))'
          + '.then(()=>console.log("@@VB ok"))'
          + '.catch((e)=>console.log("@@VB FAIL "+e.message));';
        const out = execFileSync(process.execPath, ["-e", probe],
          { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 90000 });
        if (!out.split("\n").some((l) => l.trim() === "@@VB ok")) return false;
        const meas = (a, b) => {
          const r2 = require("child_process").spawnSync("ffmpeg",
            ["-hide_banner", "-i", p2, "-af", `atrim=${a}:${b},volumedetect`,
             "-f", "null", "-"], { encoding: "utf8" });
          const m = String(r2.stderr || "").match(/mean_volume:\s*(-?[\d.]+)/);
          return m ? parseFloat(m[1]) : 0;
        };
        const mid = meas(2.5, 3.5), edge = meas(0.5, 1.5);
        const baseListed = require("../lib/core").kindOf(".volbase") !== null;
        return mid > -35 && mid < -31 && edge > -23 && edge < -19 && !baseListed;
      } finally {
        try { fs.unlinkSync(p2); } catch {}
        try { fs.unlinkSync(p2 + ".volbase"); } catch {}
      }
    })());
  const J = read("ext", "stemsdock", "stemsdock.js");
  check("2.277.0: ONE popover — range 0–200 + live % label + ✕, a click INSIDE the selection opens it above the region, 💾 opens the same popover, ✕ and any outside pointerdown close it",
    J.includes('POP.id = "stVolPop";')
    && J.includes('rng.min = "0"; rng.max = "200";')
    && J.includes('lab.textContent = rng.value + "%";')
    && J.includes('x.textContent = "✕";')
    && J.includes("if (w.sel && f != null && f >= w.sel.a && f <= w.sel.b) {")
    && J.includes("popOpenFor(w);")
    && J.includes("if (POP.contains(ev.target)) return;")
    && J.includes("popClose();"));
  check("2.277.0: INSTANT apply on slider change with rebase discipline — first apply of a selection sends rebase:true, later ones false, a NEW drag re-arms it, and the client RELEASES its Audio handle before posting (the EPERM fix's client half)",
    J.includes('rng.addEventListener("change", function () { popApply(parseInt(rng.value, 10)); });')
    && J.includes("popNeedsRebase = true;            // a new region = a new base session")
    && J.includes("gain: pct / 100, rebase: rebase }) })")
    && J.includes("popNeedsRebase = false;          // later changes edit from the base")
    && J.includes('w.audio.pause(); w.audio.src = ""; w.audio.load();'));
}

// ---- 2.278.0: errors with an ADDRESS + the MMH3 conversion pin (Tim:
// "⚠ Cannot read properties of undefined (reading 'output')" in the video
// docker notifications — untraceable because the raw message carried no
// location; the shipped tree's every .output read is guarded, so the trap
// exists to name the line the NEXT time, mixed installs included) --------
{
  check("2.278.0 LIVE: trap.where() names message @ file:line (repo-relative, node internals skipped) and trap.guard() turns a sync OR async throw into JSON {error} with the address, honouring e.status",
    (() => {
      const probe = `
        const trap = require("./lib/trap");
        let n = 0;
        const mkres = () => ({ headersSent: false, code: 0, body: null,
          status(c) { this.code = c; return this; },
          json(b) { this.body = b; n++; return this; } });
        const r1 = mkres();
        trap.guard(() => { return (undefined).output; })({}, r1, () => {});
        const ok1 = r1.code === 500 && /reading 'output'/.test(r1.body.error)
          && / @ /.test(r1.body.error) && !/node_modules|node:/.test(r1.body.error);
        const r2 = mkres();
        const p = new Promise((rs) => setTimeout(rs, 10)).then(() => {
          const e = new Error("said in words"); e.status = 404; throw e; });
        trap.guard(() => p)({}, r2, () => {});
        setTimeout(() => {
          const ok2 = r2.code === 404 && /said in words @ /.test(r2.body.error);
          console.log((ok1 && ok2 && n === 2) ? "@@TR ok" : "@@TR FAIL "
            + JSON.stringify([r1.body, r2.body]));
        }, 60);
      `;
      const out = execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 20000 });
      return out.split("\n").some((l) => l.trim() === "@@TR ok");
    })());
  const RC = read("routes", "characters.js");
  const RI2 = read("routes", "index.js");
  check("2.278.0: the render/board surface is guarded — generate, upscale, redo, render, to-timeline, apply, style, add, rewrite, screenplay, intent (characters.js) and stems/reassign (index.js) all wrap in trap.guard, and the process nets log an address",
    ['"/api/scenes/:n/generate", trap.guard(async',
     '"/api/scenes/:n/upscale", trap.guard(async',
     '"/api/scenes/:n/redo", trap.guard(async',
     '"/api/scenes/render", trap.guard(async',
     '"/api/scenes/to-timeline", trap.guard(',
     '"/api/screenplay/apply", trap.guard(',
     '"/api/scenes/style", trap.guard(',
     '"/api/screenplay", trap.guard(async',
     '"/api/screenplay/intent", trap.guard(']
      .every((f) => RC.includes(f))
    && RI2.includes('"/api/stems/reassign", trap.guard(')
    && read("lib", "trap.js").includes('process.on("unhandledRejection"'));
  check("2.278.0 LIVE: the real MMH3_Music_Video.ui.json CONVERTS — subgraph expansion + widget mapping against a full object_info yields a non-empty API graph with zero unknowns (the e2e's first-\u25b6 leg builds its base the same way)",
    (() => {
      const probe = `
        const fs = require("fs");
        const ui = JSON.parse(fs.readFileSync("comfy_workflows/MMH3_Music_Video.ui.json", "utf8"));
        const types = {};
        (ui.nodes || []).forEach((n) => { const t = String(n.type || "");
          if (!types[t]) types[t] = { input: { required: {} }, output: [], output_name: [] }; });
        const out = require("./lib/graphToApi").convert(ui, types);
        const ids = out.graph ? Object.keys(out.graph) : [];
        console.log(out.graph && ids.length > 20 && !(out.unknown || []).length
          ? "@@MC ok " + ids.length : "@@MC FAIL " + JSON.stringify(out.unknown));
      `;
      const out = execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 30000 });
      return out.split("\n").some((l) => l.trim().startsWith("@@MC ok"));
    })());
  check("2.278.0: /api/screenplay/apply writes THE BOARD STYLE'S OWN tmp when its chain base exists (MM3 stays the fallback until first \u25b6 converts the base) and the reply names the file it wrote",
    RC.includes("const applyTmp = fs.existsSync(wfPath(ch0.base)) ? ch0.tmp : TMP_STYLE;")
    && RC.includes('syncTmp(b.project, "screenplay applied", "", undefined, st0.style);')
    && RC.includes("fs.writeFileSync(wfPath(applyTmp), JSON.stringify(scened.graph, null, 2), \"utf8\");")
    && RC.includes("file: applyTmp,"));
}

// ---- 2.279.0: the CASCADE BEHEADING fix + the faithful no-outputs stub
// (Tim's field report: "rejected: prompt_no_outputs Prompt has no outputs"
// on the music-video chain — the unfilled SOURCE-TRACK LoadAudio was dead,
// and the worker's dead-node cascade killed ChainLoopStart and EVERYTHING
// downstream: sampler, decodes, SegmentSave, Review, LoopEnd, Assemble.
// The stub accepted the sink-less graph, so the gate never saw it.) ------
{
  const W = read("misc", "worker.py");
  check("2.279.0: a MiniMaxH3Chain* node whose input link points at a dead node DROPS THE KEY and runs on its default (the pack's mode B) instead of dying — Scheduled*References keep dying with their own loader (2.144.0)",
    // 2.291.0: the OBVPM "(obvpm)"/H3* exemption left with its workflow
    W.includes('if "MiniMaxH3Chain" in ct:')
    && !W.includes('"(obvpm)" in ct')
    && W.includes('v["inputs"].pop(key, None)')
    && W.includes("the pack's mode B: H3 generates the audio")
    && W.includes("MiniMaxH3Chain* node whose")
    && W.indexOf('if "MiniMaxH3Chain" in ct:') < W.indexOf("dead.add(k)\n"));
  check("2.279.0: the stub's /prompt refuses a graph with NO output-class node, verbatim ComfyUI shape (prompt_no_outputs) — the faithful-mock rule that would have caught the beheading",
    (() => {
      const SC = read("scripts", "stub-comfy.py");
      return SC.includes('"type": "prompt_no_outputs"')
        && SC.includes('"message": "Prompt has no outputs"')
        && SC.includes('ct.startswith("Save") or ct.startswith("Preview")')
        && SC.includes('"MiniMaxH3ChainSegmentSave",')
        && SC.indexOf("E2E_Reject") < SC.indexOf("def _outputish");
    })());
  check("2.279.0 LIVE: the stub REJECTS a sink-less prompt with prompt_no_outputs and ACCEPTS the same prompt once a SegmentSave rides",
    (() => {
      const probe = `
import json, subprocess, sys, time, urllib.request
p = subprocess.Popen([sys.executable, "scripts/stub-comfy.py", "8397",
                      "/tmp/yue279-stub"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def post(g):
    b = json.dumps({"prompt": g}).encode()
    rq = urllib.request.Request("http://127.0.0.1:8397/prompt", data=b,
                                headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(rq, timeout=4) as r:
            return r.read().decode()
    except urllib.error.HTTPError as e:
        return e.read().decode()
    except Exception:
        return ""
no = ""
for _ in range(20):
    time.sleep(0.25)
    no = post({"x": {"class_type": "LoadImage", "inputs": {}}})
    if no: break
yes = post({"a": {"class_type": "MiniMaxH3ChainSegmentSave", "inputs": {}}})
p.terminate(); p.wait()
ok = ("prompt_no_outputs" in no and "Prompt has no outputs" in no
      and "prompt_id" in yes)
print("@@SO ok" if ok else "@@SO FAIL " + no[:120] + " | " + yes[:120])
      `;
      const out = execFileSync("python3", ["-c", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 30000 });
      return out.split("\n").some((l) => l.trim() === "@@SO ok");
    })());
}

// ---- 2.280.0: EMPTY LOADERS (Tim's field report: "Required input is
// missing sampler_name / scheduler / clip_name / vae_name / unet_name" —
// the graph had outputs now, but three separate schema-shape bugs left
// every pure-widget loader empty) --------------------------------------
{
  check("2.280.0: graphToApi maps widgets across ALL THREE /object_info spec generations — classic list-combo, [\"COMBO\", {options}], and OBJECT-form ({type, options/default})",
    (() => {
      const { widgetNames } = require("../lib/graphToApi");
      const classic = { input: { required: { sampler_name: [["euler"]] } } };
      const arr = { input: { required: { sampler_name: ["COMBO", { options: ["euler"] }] } } };
      const obj = { input: { required: { clip_name: { type: "COMBO", options: ["a"] },
                                         denoise: { type: "FLOAT", default: 1 } } } };
      const n = (s2) => (widgetNames(s2) || []).map((w) => w.name).join(",");
      return n(classic) === "sampler_name" && n(arr) === "sampler_name"
        && n(obj) === "clip_name,denoise";
    })());
  check("2.280.0 LIVE: worker._schema_sync fills ON THE NODE (an inputs:{} loader and a node with NO inputs key both land their fills — the falsy-{} orphan is dead) and understands array-COMBO, object-COMBO and object-form defaults",
    (() => {
      const probe = `
import sys; sys.path.insert(0, "."); sys.path.insert(0, "misc")
import worker
INFO = {
  "KSamplerSelect": {"input": {"required": {"sampler_name": ["COMBO", {"options": ["res_multistep"]}]}}},
  "CLIPLoader": {"input": {"required": {"clip_name": {"type": "COMBO", "options": ["clip_l.safetensors"]}}}},
  "BasicScheduler": {"input": {"required": {"scheduler": {"type": "COMBO", "options": ["simple"]},
                                            "denoise": {"type": "FLOAT", "default": 1.0}}}},
}
worker._http_json = lambda url, *a, **k: {url.rsplit("/", 1)[-1]: INFO.get(url.rsplit("/", 1)[-1])}
worker.say = lambda *a: None
g = {"56": {"class_type": "KSamplerSelect", "inputs": {}},
     "53": {"class_type": "CLIPLoader"},
     "79": {"class_type": "BasicScheduler", "inputs": {"steps": ["71", 0]}}}
worker._schema_sync("http://x", g)
ok = (g["56"]["inputs"]["sampler_name"] == "res_multistep"
      and g["53"]["inputs"]["clip_name"] == "clip_l.safetensors"
      and g["79"]["inputs"]["scheduler"] == "simple"
      and g["79"]["inputs"]["denoise"] == 1.0)
print("@@SY ok" if ok else "@@SY FAIL " + repr(g))
      `;
      const out = execFileSync("python3", ["-c", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 20000 });
      return out.split("\n").some((l) => l.trim() === "@@SY ok");
    })());
  check("2.280.0: the stub answers CORE loader/sampler schemas in all three spec generations AND /prompt refuses a missing required input BY NAME in ComfyUI's shape — the faithful-mock net for Tim's exact rejection",
    (() => {
      const SC = read("scripts", "stub-comfy.py");
      return SC.includes("def core_schemas():")
        && SC.includes('"clip_name": {"type": "COMBO",')
        && SC.includes('"vae_name": [_folder_combo(["vae"], ["Wan2.1_VAE.safetensors"])]')
        && SC.includes('"unet_name": ["COMBO", {"options": _folder_combo(')
        && SC.includes("def _folder_combo(sub, floor):")
        && SC.includes('f"Required input is missing {name}"')
        && SC.includes('"type": "prompt_outputs_failed_validation"')
        && SC.indexOf("prompt_no_outputs") < SC.indexOf("Required input is missing");
    })());
}

// ---- 2.281.0: the SHEETLESS TAG refusal (Tim's field report: the pack's
// own "ValueError: Prompt uses unknown scheduled reference tag @character"
// — a tag that EXISTS in the cast but has no sheet passed validation,
// buildChain skipped its picture reference with only a note, and the pack
// hard-failed mid-render) -----------------------------------------------
{
  const RC = read("routes", "characters.js");
  check("2.281.0: queueScene refuses IN WORDS, before ComfyUI, when THIS scene's prompt casts a sheetless character — naming the character, the sheet fix, and the voice truth (voice optional; lips sync to the scene's song segment)",
    RC.includes("const sheetless = [];")
    && RC.includes("const ctag = chars.tagOf(c.tag || c.name);")
    && RC.includes("sheetless.push({ name: c.name, tag: ctag });")
    && RC.includes("const hit = sheetless.find((x) =>")
    && RC.includes("has no ")
    && RC.includes("character sheet — the render pack refuses an aliased tag with no ")
    && RC.includes("a VOICE clip is optional: in a ")
    && RC.includes("music video the lips sync to the scene's 15-second song segment")
    && RC.includes("or drop @${hit.tag} from the prompt."));
  check("2.281.0: the music_video addendum teaches the CASTING REQUIREMENT (sheet mandatory, voice optional) and carries NO copyable placeholder tag — a template-copying local model must never see the poison it is banned from writing",
    (() => {
      const G = read("lib", "promptGuides.json");
      return G.includes("CASTING REQUIREMENT: every @tag placed on camera needs a character SHEET")
        && G.includes("A character VOICE clip is OPTIONAL in a music video")
        && G.includes("Never invent a placeholder tag")
        && G.includes("@<singer-tag> (S1)")
        && !G.includes("@character")
        && !G.includes("'@tag (S1)");
    })());
  check("2.281.0 LIVE: screenplay.repairTags maps every invented tag to the SOLE cast member (voice aliases untouched) and, with several members, strips the token naming the real tags — deterministic, no model round",
    (() => {
      const sp = require("../lib/screenplay");
      const one = sp.repairTags({ shots: [{ prompt:
        ["@character sings, @jesse_voice hums along"] }] },
        [{ name: "Jesse", tag: "jesse" }], [], []);
      const two = sp.repairTags({ shots: [{ prompt: ["@character waits"] }] },
        [{ name: "A", tag: "a" }, { name: "B", tag: "b" }], [], []);
      return one.plan.shots[0].prompt[0] === "@jesse sings, @jesse_voice hums along"
        && one.changes.length === 1 && /takes the role/.test(one.changes[0])
        && two.plan.shots[0].prompt[0] === "character waits"
        && /removed: no such character/.test(two.changes[0])
        && /@a, @b|@b, @a/.test(two.changes[0]);
    })());
  check("2.281.0: the writer runs the DETERMINISTIC repair before the model round (only when every error is the invented-tag class), notes each substitution as 'tag repair: …', and the generate guard's SECOND DOOR refuses UNKNOWN tags (the card-edit hole) naming the real tags",
    RC.includes('v.errors.every((e) => /has no character in this project/.test(e))')
    && RC.includes("const rt = screenplay.repairTags(norm, cast, envs.list(b.project),")
    && RC.includes('notes.push(...rt.changes.map((c) => "tag repair: " + c));')
    && RC.indexOf("repairTags(norm") < RC.indexOf("THE REPAIR ROUND (2.154.0")
    && RC.includes("and no character, environment ")
    && RC.includes("an unknown alias mid-render. Real tags: "));
}

// ---- 2.282.0 OBVPM_Timeline -> REMOVED at 2.291.0 (Tim: "remove the ovpm
// timeline, we will use our timeline docker"): the export, its CONVERT
// entry, the worker's compose-loader/pack cascade cases and the stub's
// pack terminals are all gone; the store hides an adopted entry --------
{
  const RC = read("routes", "characters.js");
  const W = read("misc", "worker.py");
  const SC = read("scripts", "stub-comfy.py");
  check("2.291.0: OBVPM_Timeline is GONE - no shipped export, no CONVERT entry, no worker/stub special cases, no NOTICE section, and REMOVED_STYLES hides an adopted store entry",
    !fs.existsSync(path.join(__dirname, "..", "comfy_workflows", "OBVPM_Timeline.ui.json"))
    && !RC.includes("OBVPM_Timeline: {") && RC.includes("OBVPM_Timeline REMOVED (2.291.0")
    && !W.includes("LoadImagesCompose (obvpm)") && !W.includes('"(obvpm)" in ct')
    && !SC.includes("H3TrimAndSaveVideoWithMCtx")
    && !read("misc", "NOTICE.md").includes("comfyui-obvpm-timeline")
    && require("../lib/styles").REMOVED_STYLES.includes("OBVPM_Timeline")
    && read("lib", "styles.js").includes('if (style.kind === "video" && REMOVED_STYLES.includes(style.name)) continue;')
    && RC.includes('const ch = CONVERT_STYLES[String(styleName || "")] || chainFor(styleName);'));
}

// ---- 2.283.0: the WRITER'S THREE MUSIC-VIDEO MISSES (Tim's field
// report: six "malformed dialogue line" refusals, @jesses_paul beside
// @jesse_paul, and 5 segments beyond the board's 12 scenes) ------------
{
  check("2.283.0 LIVE: normalize JOINS a <d> line wrapped across entries and SPLITS prose trailing </d> into its own beat — the six refused shots repair mechanically",
    (() => {
      const sp = require("../lib/screenplay");
      const n = sp.normalize({ shots: [{ id: "clip_03", scene: 3, prompt: [
        "[Shot 3] @jesse (S1), a weary baritone, sings directly to camera,",
        "<d>[English] Wandering through the ghosts of the night,",
        "chasing a fading light.</d>",
        "<d>[English] Every memory is a heavy price.</d> His eyes close."
      ] }], prompt_prefix: [] }, {});
      const L = n.shots[0].prompt.filter(Boolean).map((x) => x.trim());
      return L.includes("<d>[English] Wandering through the ghosts of the night, chasing a fading light.</d>")
        && L.includes("<d>[English] Every memory is a heavy price.</d>")
        && L.includes("His eyes close.")
        && !L.some((x) => /<\/d>\s+\S/.test(x));
    })());
  check("2.283.0 LIVE: repairTags MAPS a near-miss of exactly one real tag (edit distance <= 2, a model typo, said in words) and still strips true inventions with the real tags named",
    (() => {
      const sp = require("../lib/screenplay");
      const r = sp.repairTags({ shots: [{ prompt: ["@jesses_paul (S1) sings, @typo glows"] }] },
        [{ name: "Jesse Paul", tag: "jesse_paul" }, { name: "B", tag: "b" }], [], []);
      return r.plan.shots[0].prompt[0] === "@jesse_paul (S1) sings, typo glows"
        && r.changes.some((c) => /near-miss of the real tag/.test(c))
        && r.changes.some((c) => /@typo removed: no such character/.test(c));
    })());
  check("2.283.0: with the board on MMH3_Music_Video and a split on disk, /api/screenplay's brief carries the SONG SHAPE — exactly one shot per fifteen-second segment",
    (() => {
      const RC2 = read("routes", "characters.js");
      // 2.323.0: a native board WITHOUT a song is a screenplay - no song shape
      return RC2.includes('if (["MMH3_Music_Video", "MMH3_NativeAudio_MV"].includes(scenes.load(b.project).style)')
        && RC2.includes('&& (scenes.load(b.project).style !== "MMH3_NativeAudio_MV" || scenes.load(b.project).audio)) {')
        && RC2.includes("const seg = (stems.lastSplit() || {}).files || [];")
        && RC2.includes("SONG SHAPE: the song is split into ${seg.length} ")
        && RC2.includes("one per segment ")
        && read("lib", "promptGuides.json")
             .includes("STYLE PICTURE TAGS: use a picture tag");
    })());
}

// ---- 2.284.0: THE PER-SCENE PIVOT (Tim: scrap the loop chains; ref2va
// starts a scene, fl2va continues one, the timeline dock assembles;
// native-audio lipsync per scene) --------------------------------------
{
  const RC = read("routes", "characters.js");
  check("2.284.0 LIVE: the shipped NativeAudio template CONVERTS - lock + trim + R2V + SaveVideo + both loaders in a non-empty API graph with zero unknowns",
    (() => {
      const probe = `
        const fs = require("fs");
        const ui = JSON.parse(fs.readFileSync("comfy_workflows/MMH3_NativeAudio_MV.ui.json", "utf8"));
        const types = {}; (ui.nodes || []).forEach((n) => { types[String(n.type || "")] = { input: { required: {} }, output: [], output_name: [] }; });
        const out = require("./lib/graphToApi").convert(ui, types);
        const k = {}; Object.values(out.graph || {}).forEach((n) => k[n.class_type] = 1);
        console.log((Object.keys(out.graph || {}).length > 15 && !(out.unknown || []).length
          && k.MiniMaxH3NativeAudioLock && k.MiniMaxH3ReferenceToVideo
          && k.TrimAudioDuration && k.SaveVideo && k.LoadImage && k.LoadAudio)
          ? "@@NA ok" : "@@NA FAIL");
      `;
      const out = execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 40000 });
      return out.split("\n").some((l) => l.trim() === "@@NA ok");
    })());
  check("2.284.0: MMH3_NativeAudio_MV is registered - CONVERT_STYLES entry with its pack named, a starter carrying BOTH ref2va and fl2va, MIT attribution in NOTICE.md",
    RC.includes("MMH3_NativeAudio_MV: {")
    && RC.includes('base: "MMH3_NativeAudio_MV.json", ui: "MMH3_NativeAudio_MV.ui.json",')
    && RC.includes("ComfyUI-H3-NativeAudioLock (from the ")
    && read("lib", "styles.js").includes('fl2va: "comfy_workflows/MMH3_NativeAudio_MV_fl2va.json"')
    && read("misc", "NOTICE.md").includes("MiniMax-H3-NativeAudio-MusicVideo-Workflow"));
  check("2.284.0: visual_context_source DRIVES THE RENDER opportunistically - the source resolves BY ID on the rows, a rendered take donates its final frame as the sole reference (fl2va only when the style brings one), and a missing take falls back to the sheets WITH A NOTE, never a refusal (boards render out of order)",
    RC.includes('let queueMode = "ref2va";')
    && RC.includes("let srcId = shot && shot.visual_context_source;")
    && RC.includes(': ["-sseof", "-0.2"];                          // the tail (default)')
    && RC.includes("const srcRow = (st.list || []).find((x) => x && x.id === srcId);")
    && RC.includes("has no rendered take yet - ")
    && RC.includes("starting fresh from the sheets (render it and redo scene ")
    && RC.includes("if (contNote) missing.push(contNote);")
    && RC.includes("referenceNames.push(`continuation frame (${srcId})`);")
    && RC.includes('&& ((styled || {}).workflows || {}).fl2va) queueMode = "fl2va";')
    && RC.includes("mode: queueMode,"));
  check("2.284.0: the guide teaches the native-audio shape (no <d> blocks - the segment IS the vocal; lips-closed on instrumentals) and that visual_context_source continues from the true final frame",
    (() => {
      const G = read("lib", "promptGuides.json");
      return G.includes("NATIVE-AUDIO LIPSYNC (MMH3_NativeAudio_MV style)")
        && G.includes("there is no TTS and no <d> block")
        && G.includes("lips remain fully ")
        // 2.292.0: the anchor radio's three modes replaced "the app starts
        // from the true final frame"
        && G.includes("First continues from that shot's final (or picked) frame through fl2va")
        && G.includes("Ref renders ref2va for a new location or character");
    })());
}

// ---- 2.285.0: THE SEGMENT EDITOR + SEGMENT-DRIVEN ITERATIVE WRITER
// (Tim: red draggable lines on all three waveforms, songname.seg,
// scenes = segments, durations auto-assigned) --------------------------
{
  check("2.285.0 LIVE: stems.segments defaults to the 15s grid over the real duration, saveSegments writes songname.seg in the stated shape, a reload round-trips, and split cuts at the map's boundaries (-segment_times)",
    (() => {
      const probe = `
import json, os, subprocess, sys
os.makedirs('projects/default/sound', exist_ok=True)
wav = 'projects/default/sound/e2e_seg285.wav'
for stale in (wav, 'projects/default/sound/e2e_seg285.seg'):
    if os.path.exists(stale): os.remove(stale)   # a crashed earlier run must not poison the default-grid read
subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=34', wav],
               capture_output=True, check=True)
out = subprocess.run(['node', '-e', '''
const st = require(\"./lib/stems\");
const a = st.segments(\"e2e_seg285.wav\");
const b = st.saveSegments(\"e2e_seg285.wav\", [12, 15, 7]);
const c = st.segments(\"e2e_seg285.wav\");
console.log(JSON.stringify({ a: a.durations, b: b.file, c: c.durations, bd: c.boundaries }));
'''], capture_output=True, text=True)
d = json.loads(out.stdout.strip().split(chr(10))[-1])
assert abs(d['a'][0] - 15) < 0.01 and len(d['a']) == 3, d
assert d['b'] == 'e2e_seg285.seg', d
assert d['c'] == [12, 15, 7] and d['bd'] == [12, 27], d
seg = open('projects/default/sound/e2e_seg285.seg').read()
assert 'segment 1: 0s to 12s (12 seconds)' in seg and 'segment 3: 27s to 34s (7 seconds)' in seg, seg
os.remove(wav); os.remove('projects/default/sound/e2e_seg285.seg')
print('@@SG ok')
      `;
      const out = execFileSync("python3", ["-c", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 90000 });
      return out.split("\n").some((l) => l.trim() === "@@SG ok");
    })());
  check("2.285.0: the split honors the map (-segment_times from boundaries, 15s grid without one), the routes serve GET/POST /api/stems/segments, and the dock draws the ONE map on every canvas - red lines, centered durations, synced drag with neighbour clamps, debounced .seg save, X buttons wired",
    (() => {
      const ST = read("lib", "stems.js");
      const RI = read("routes", "index.js");
      const DK = read("ext/stemsdock", "stemsdock.js");
      const DH = read("ext/stemsdock", "dock.html");
      return ST.includes('? ["-segment_times", segMap.boundaries.map((t) => t.toFixed(3)).join(",")]')
        && ST.includes(': ["-segment_time", String(SEG_SECONDS)];')
        && RI.includes('app.get("/api/stems/segments"')
        && RI.includes('app.post("/api/stems/segments"')
        && DK.includes("var SEGS = null;")
        && DK.includes("for (var bi = 0; bi < SEGS.boundaries.length; bi++)")
        && DK.includes('ctx.textAlign = "center";')
        && DK.includes("segRecalc(); segSave(); redrawAll();")
        && DK.includes("var lo = drag.seg > 0 ? SEGS.boundaries[drag.seg - 1] + 1 : 1;")
        && DH.includes('id="stSegSong"') && DH.includes('id="stSegVoc"')
        && DH.includes('id="stSegInst"');
    })());
  check("2.285.0: the iterative writer counts scenes FROM THE MAP (song from the request or the last split), pins each shot's length to its segment (seconds x 24, normalize snaps), and tells the model each round how long its segment lasts",
    (() => {
      const RC = read("routes", "characters.js");
      return RC.includes("nScenes = segMap.durations.length;")
        && RC.includes("one per song segment ")
        && RC.includes("shot.length = Math.max(1, Math.round(segMap.durations[i - 1] * 24));")
        && RC.includes("This scene covers song segment ${i}, which lasts ")
        // 2.323.0: the last split never decides a screenplay (no-song native) board
        && RC.includes(': (stems.lastSplit() ? stems.lastSplit().base + stems.lastSplit().ext : ""));')
        && RC.includes('|| (native && wMode === "dialogue" ? ""');
    })());
}

// ---- 2.286.0: ZOOM + MANUAL DURATIONS (Tim: zoom in/out/reset; click
// the label to type a duration; a manually-set segment drags whole) ----
{
  check("2.286.0 LIVE: the .seg [manual] flag round-trips - saveSegments writes it, segments() reads it back beside the durations",
    (() => {
      const probe = `
import json, os, subprocess
os.makedirs('projects/default/sound', exist_ok=True)
wav = 'projects/default/sound/e2e_seg286.wav'
subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=30', wav],
               capture_output=True, check=True)
out = subprocess.run(['node', '-e', '''
const st = require(\"./lib/stems\");
st.saveSegments(\"e2e_seg286.wav\", [9, 12, 9], [false, true, false]);
const c = st.segments(\"e2e_seg286.wav\");
console.log(JSON.stringify({ d: c.durations, m: c.manual }));
'''], capture_output=True, text=True)
d = json.loads(out.stdout.strip().split(chr(10))[-1])
assert d['d'] == [9, 12, 9] and d['m'] == [False, True, False], d
seg = open('projects/default/sound/e2e_seg286.seg').read()
assert 'segment 2: 9s to 21s (12 seconds) [manual]' in seg and '[manual]' not in seg.split(chr(10))[0], seg
os.remove(wav); os.remove('projects/default/sound/e2e_seg286.seg')
print('@@SM ok')
      `;
      const out = execFileSync("python3", ["-c", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 90000 });
      return out.split("\n").some((l) => l.trim() === "@@SM ok");
    })());
  check("2.286.0: the dock has the shared VIEW - zoom in/out around the centre, reset, wheel pan when zoomed, every drawn thing (peaks, playhead, selection, lines, labels) mapped through vToF/fToView, and the three zoom buttons wired",
    (() => {
      const DK = read("ext/stemsdock", "stemsdock.js");
      const DH = read("ext/stemsdock", "dock.html");
      return DK.includes("var VIEW = { t0: 0, t1: 1 };")
        && DK.includes("function viewZoom(factor)")
        && DK.includes("function viewPan(df)")
        && DK.includes("var sf = vToF(x / cv.width);")
        && DK.includes("var sa = fToView(w.sel.a), sb = fToView(w.sel.b);")
        && DK.includes("fToView(SEGS.boundaries[bi] / SEGS.total)")
        && DK.includes('cv.addEventListener("wheel"')
        && DK.includes("vToF(f) * w.audio.duration")
        && DH.includes('id="stZoomIn"') && DH.includes('id="stZoomReset"');
    })());
  check("2.286.0: a label click opens the number input, a typed value LOCKS the segment ([manual], lock glyph, saved), later open segments absorb the change with 1s floors and locked neighbours refuse in words, and a locked segment's BODY drags whole (both cuts together) while its bordering lines refuse",
    (() => {
      const DK = read("ext/stemsdock", "stemsdock.js");
      return DK.includes("function setManualDuration(i, v)")
        && DK.includes("function segInputOpen(i, ev)")
        && DK.includes("if (li >= 0) { segInputOpen(li, ev); return; }")
        // 2.289.0: the typed-duration rule moved to core static/segmap.js
        && DK.includes("window.SegMap.setManual(SEGS, i, v)")
        && read("static", "segmap.js").includes("S.manual[i] = true;")
        && DK.includes("that cut borders a locked segment")
        && DK.includes("drag the entire segment maintaining the")
        && DK.includes("SEGS.boundaries[i2 - 1] = st0 + dt;")
        && DK.includes("SEGS.boundaries[i2] = en0 + dt;")
        && DK.includes('manual: SEGS.manual || [] }) })');
    })());
}

// ---- 2.287.0: SEGMENT EXPORT + SEND-TO-VIDEO (Tim: save files to
// songs/<song>/segments/<song>_seg_n.<mp3|wav>; one blank scene per
// segment for the writer to fill) --------------------------------------
{
  check("2.287.0 LIVE: exportSegments cuts real files at the map's boundaries into songs/<base>/segments/ with the stated names, honours wav vs mp3, replaces previous exports, and send-to-video's blank board stages scene lengths from the segments",
    (() => {
      const probe = `
import json, os, shutil, subprocess
os.makedirs('projects/default/sound', exist_ok=True)
wav = 'projects/default/sound/e2e_x287.wav'
subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=20', wav],
               capture_output=True, check=True)
out = subprocess.run(['node', '-e', '''
(async () => {
  const st = require(\"./lib/stems\");
  const sp = require(\"./lib/screenplay\");
  const sc = require(\"./lib/scenes\");
  st.saveSegments(\"e2e_x287.wav\", [8, 12], [false, true]);
  const a = await st.exportSegments(\"e2e_x287.wav\", \"wav\");
  const b = await st.exportSegments(\"e2e_x287.wav\", \"mp3\");
  const fs2 = require(\"fs\");
  const left = fs2.readdirSync(b.dir).sort();
  const shots = b.durations.map((d, i) => ({ id: \"clip_0\" + (i + 1),
    scene: i + 1, length: Math.max(1, Math.round(d * 24)),
    prompt: [\"[Shot \" + (i + 1) + \"] (blank)\"] }));
  const norm = sp.normalize({ prompt_prefix: [], shots }, sc.chainOverrides());
  console.log(JSON.stringify({ a: a.files, b: b.files, left,
    lens: norm.shots.map((x) => x.length) }));
})();
'''], capture_output=True, text=True)
d = json.loads(out.stdout.strip().split(chr(10))[-1])
assert d['a'] == ['e2e_x287_seg_1.wav', 'e2e_x287_seg_2.wav'], d
assert d['b'] == ['e2e_x287_seg_1.mp3', 'e2e_x287_seg_2.mp3'], d
assert d['left'] == ['e2e_x287_seg_1.mp3', 'e2e_x287_seg_2.mp3'], d  # wav export replaced
assert d['lens'][0] >= 141 and d['lens'][1] > d['lens'][0], d  # H3-grid-snapped, longer segment = longer scene
shutil.rmtree('projects/default/songs', ignore_errors=True)
os.remove(wav); os.remove('projects/default/sound/e2e_x287.seg')
print('@@EX ok')
      `;
      const out = execFileSync("python3", ["-c", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 120000 });
      return out.split("\n").some((l) => l.trim() === "@@EX ok");
    })());
  check("2.287.0: the routes and the menubar ship - POST /api/stems/export and /send-to-video (blank scenes + segment binding + the note in words), the format picker, and the two icon-only buttons wired",
    (() => {
      const RI = read("routes", "index.js");
      const DK = read("ext/stemsdock", "stemsdock.js");
      const DH = read("ext/stemsdock", "dock.html");
      const ST = read("lib", "stems.js");
      // 2.289.0: the staging moved to lib/segBoard.js (ONE path shared
      // with the video docker's 💾) - the pins follow it there
      const SB = read("lib", "segBoard.js");
      return RI.includes('app.post("/api/stems/export"')
        && RI.includes('app.post("/api/stems/send-to-video"')
        && SB.includes("(blank - awaiting the writer: song segment ")
        && RI.includes("NO segment files, NO bindings - the song")
        && RI.includes('require("../lib/segBoard").stage(b.song, b.project)')
        && SB.includes('fills them in')
        && ST.includes('"songs", base, "segments");')
        && ST.includes('args.push("-c:a", "pcm_s16le");')
        && DH.includes('id="stSegFmt"') && DH.includes('id="stSegExport"')
        && DH.includes('id="stSegSend"')
        && DK.includes('fetch("/api/stems/export"')
        && DK.includes('fetch("/api/stems/send-to-video"');
    })());
}

// ---- 2.288.0: THE TRIM PIVOT (Tim: no segment files - start/duration
// into TrimAudioDuration; board song; filmstrip picks the next scene's
// start frame; titlebar anchor radios) ---------------------------------
{
  const RC = read("routes", "characters.js");
  const RI = read("routes", "index.js");
  const VD = read("ext/videodock", "characters.js");
  const W = read("misc", "worker.py");
  check("2.288.0 LIVE: the .seg file now states the WINDOW (a to b) and still round-trips, and fromPlan CARRIES the user's audio window/anchor/picked frame across a plan rewrite",
    (() => {
      const probe = `
const st = require("./lib/stems"); const sc = require("./lib/scenes");
const fs = require("fs"); const cp = require("child_process");
fs.mkdirSync("projects/default/sound", { recursive: true });
cp.execFileSync("ffmpeg", ["-y","-f","lavfi","-i","sine=frequency=440:duration=20","projects/default/sound/z288.wav"], { stdio: "ignore" });
st.saveSegments("z288.wav", [8, 12], [false, true]);
const seg = fs.readFileSync("projects/default/sound/z288.seg", "utf8");
const c = st.segments("z288.wav");
const prev = { list: [{ n: 1, id: "clip_01", prompt: ["x"], status: "idle",
  audio_start: 3, audio_dur: 9, anchor: "last", cont_src: 0, cont_time: 2.5 }],
  chapters: [], pending: [], audio: "z288.wav" };
const merged = sc.fromPlan({ shots: [{ id: "clip_01", scene: 1, prompt: ["y"] }] }, prev);
const r = merged.list[0];
console.log(JSON.stringify({ seg: seg.includes("segment 1: 0s to 8s (8 seconds)")
  && seg.includes("segment 2: 8s to 20s (12 seconds) [manual]"),
  reload: c.durations, carry: [r.audio_start, r.audio_dur, r.anchor, r.cont_time],
  audio: merged.audio }));
fs.unlinkSync("projects/default/sound/z288.wav");
fs.unlinkSync("projects/default/sound/z288.seg");
      `;
      const out = execFileSync(process.execPath, ["-e", probe],
        { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
      const d = JSON.parse(out.trim().split("\n").pop());
      return d.seg === true && d.reload[0] === 8 && d.reload[1] === 12
        && d.carry[0] === 3 && d.carry[1] === 9 && d.carry[2] === "last"
        && d.carry[3] === 2.5 && d.audio === "z288.wav";
    })());
  check("2.288.0: the queue speaks the pivot - the board song replaces the audio refs with the row's (or the map's) window riding the job, the worker fills TrimAudioDuration name-tolerantly before schema sync, and a picked frame (cont_src/cont_time) extracts at ITS second with the anchor deciding fl2va",
    RC.includes("if (st.audio) {")
    // 2.290.0: a plain path (the {file,name} object crashed the worker's Path(x))
    && RC.includes("refAudios.push(songPath);                     // the song (trimmed per scene)")
    && RC.includes("audio_start: audioWin ? audioWin.start : undefined,")
    && RC.includes('? ["-ss", String(Math.max(0, r.cont_time))]   // the PICKED frame')
    && RC.includes('const anch = String(r.anchor || "reference");')
    && W.includes("def _fill_trim_window(g, job):")
    && W.includes('"TrimAudioDuration" not in str(v.get("class_type", ""))')
    && W.includes("_fill_trim_window(g, job)"));
  check("2.288.0: the routes + UI ship - board audio, per-scene window, anchor, pick-frame; send-to-video stages windows with NO files or bindings; the card carries the titlebar radios, the window inputs and the filmstrip that posts the pick",
    RC.includes('app.post("/api/scenes/audio"')
    && RC.includes('app.post("/api/scenes/:n/anchor"')
    && RC.includes('app.post("/api/scenes/:n/pick-frame"')
    && RI.includes("NO segment files, NO bindings - the song")
    && read("lib", "segBoard.js").includes("audio_start: w.start, audio_dur: w.dur,")
    && VD.includes('data-scanchor="')
    && VD.includes('data-scastart="')
    && VD.includes('data-scfilm="')
    && VD.includes('scPost("/api/scenes/" + n + "/pick-frame", { time: t2 });')
    && VD.includes('id="vdAudio"') === false  // the select lives in dock.html
    && read("ext/videodock", "dock.html").includes('id="vdAudio"'));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
