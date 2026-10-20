// bitGen Studio — THE SONG'S SEGMENTS ONTO THE SCENE BOARD (2.289.0).
//
// Tim (verbatim): "... just save the segment start time and duration to
// the .seg file, create the blank scenes on save, populate the start and
// duration inputs for each scene."
//
// ONE staging path, used by BOTH doors: the stems dock's 📤 (POST
// /api/stems/send-to-video, 2.287/2.288) and the video docker's 💾 on its
// Load-audio waveform (POST /api/scenes/from-segments, 2.289). It reads
// the song's segment map (lib/stems.segments — the .seg file, or the
// default 15-second grid) and puts one scene per segment on the board,
// each carrying its WINDOW (audio_start / audio_dur — the card's start
// and duration inputs, the numbers the worker writes into the graph's
// TrimAudioDuration). No files are cut; the song is the board's audio.
//
// Two shapes, decided by the board's seg_song — the song whose map was
// last STAGED here (NOT st.audio: the Audio picker and 🎵 set that the
// moment a song is chosen, before any save):
//   - a NEW song (or an empty board): a fresh blank board, one
//     "[Shot n] (blank - awaiting the writer ...)" scene per segment —
//     exactly the 2.288 send-to-video board;
//   - the SAME song again (the user moved a red line and saved): the
//     written scenes are KEPT — only their windows (and lengths) follow
//     the new map; missing scenes are added blank; trailing BLANK
//     placeholders past the last segment are dropped, trailing WRITTEN
//     scenes stay and are said in words. A re-save never wipes a
//     screenplay.
// Either way every row's window is WRITTEN from the map — fromPlan
// carries an old row's window by id (the writer's rewrite must not lose
// the user's numbers), which would otherwise leave stale windows on a
// re-staged board.
const path = require("path");
const stems = require("./stems");
const scenes = require("./scenes");
const screenplay = require("./screenplay");
const bridges = require("./sceneBridge");

const r1 = (x) => Math.round(x * 10) / 10;
const BLANK_RE = /\(blank - awaiting the writer/;

/** A scene prompt that is still the staging placeholder. */
function isBlank(prompt) {
  const t = (Array.isArray(prompt) ? prompt : [prompt]).map(String).join(" ");
  return !t.trim() || BLANK_RE.test(t);
}

/** [{n, start, dur}] from a segments() answer. */
function windowsOf(map) {
  let acc = 0;
  return (map.durations || []).map((d, i) => {
    const w = { n: i + 1, start: r1(acc), dur: r1(d) };
    acc += d;
    return w;
  });
}

function blankShot(w, id) {
  return {
    id, scene: w.n,
    length: Math.max(1, Math.round(w.dur * 24)),
    audio_start: w.start, audio_dur: w.dur,
    prompt: [`[Shot ${w.n}] (blank - awaiting the writer: song segment `
      + `${w.n}, ${w.start}s to ${r1(w.start + w.dur)}s)`],
  };
}

/** Stage the song's segment map on the board. Throws a 400 when the song
 *  has no map (no duration). Returns {scenes, audio, windows, kept,
 *  replaced, fresh, note}. */
function stage(song, project, opts) {
  const base = path.basename(String(song || ""));
  if (!base) { const e = new Error("song required"); e.status = 400; throw e; }
  const map = stems.segments(base);
  if (!(map.total > 0) || !(map.durations || []).length) {
    const e = new Error("the song has no segment map - load it and let it "
      + "segment (the StoryBoard's 🎵, or ✂# in the stems dock) first");
    e.status = 400; throw e;
  }
  const st0 = scenes.load(project);
  /* 2.358.0 (Tim: "add a transition checkbox to the song menubar before the save button, with a duration
     input ... resegment the song with a 0.5 sec (or x duration) after each segment"): opts.gap seconds of
     BRIDGE after every segment but the last, carved from the end of the segment (lib/sceneBridge). No
     opts (the stems dock's 📤) = the board's own gap for the same song, none for a new one. */
  const o = opts || {};
  const sameSong = st0.seg_song === base;
  const gap = "gap" in o ? bridges.normGap(o.gap)
    : (sameSong && st0.seg_gap ? st0.seg_gap.dur : 0);
  const gapType = bridges.normType("gap_type" in o ? o.gap_type : (st0.seg_gap || {}).type);
  const gw = bridges.gapWindows(map.durations, gap);
  const all = gw.windows;
  // the content windows, numbered as the segments (the writer's scene i is segment i)
  const wins = all.filter((w) => !w.bridge).map((w) => ({ n: w.k, start: w.start, dur: w.dur }));
  const oldAll = (st0.plan && Array.isArray(st0.plan.shots)) ? st0.plan.shots : [];
  const oldShots = oldAll.filter((x) => !(x && x.bridge));
  const oldBridges = oldAll.filter((x) => x && x.bridge);
  const same = sameSong && oldShots.length > 0;
  const used = new Set();
  oldAll.forEach((x) => { if (x && x.id) used.add(String(x.id)); });
  const freeId = (i) => {
    let k = i + 1, id;
    do { id = `clip_${String(k).padStart(2, "0")}`; k++; } while (same && used.has(id));
    used.add(id);
    return id;
  };
  if (!same) used.clear();
  let shots, kept = [];
  if (same) {
    shots = wins.map((w, i) => {
      const o = oldShots[i];
      if (o && !isBlank(o.prompt))
        return { ...o, scene: w.n, length: Math.max(1, Math.round(w.dur * 24)),
                 audio_start: w.start, audio_dur: w.dur };
      return blankShot(w, o && o.id ? String(o.id) : freeId(i));
    });
    oldShots.slice(wins.length).forEach((o, k) => {
      if (o && !isBlank(o.prompt)) {
        shots.push({ ...o });
        kept.push(wins.length + k + 1);
      }
    });
  } else {
    shots = wins.map((w, i) => blankShot(w, freeId(i)));
  }
  // 2.358.0: the bridges, each after the segment it follows. A bridge already on the board keeps its id
  // (and its take) and its own type unless the strip's type changed.
  const typeChanged = !st0.seg_gap || bridges.normType(st0.seg_gap.type) !== gapType;
  const bridgeShots = new Map();
  for (const w of all.filter((x) => x.bridge)) {
    const ob = same ? oldBridges.find((x) => bridges.safeBridge(x.bridge).after === w.after) : null;
    const type = ob && !typeChanged ? bridges.safeBridge(ob.bridge).type : gapType;
    let id = ob && ob.id ? String(ob.id) : `bridge_${String(w.after).padStart(2, "0")}`;
    while (!ob && used.has(id)) id += "b";
    used.add(id);
    bridgeShots.set(w.after, { id, scene: 0, length: bridges.framesFor(w.dur),
      audio_start: w.start, audio_dur: w.dur, bridge: { type, after: w.after },
      prompt: ob && !typeChanged && Array.isArray(ob.prompt) ? ob.prompt : bridges.promptFor(type, w.dur, w.after) });
  }
  const woven = [];
  shots.forEach((sh, i) => { woven.push(sh); if (bridgeShots.has(i + 1) && i + 1 < wins.length) woven.push(bridgeShots.get(i + 1)); });
  // the windows in board order (content scenes past the song keep theirs)
  const winOf = woven.map((sh) => sh.bridge
    ? { start: sh.audio_start, dur: sh.audio_dur }
    : (() => { const k = shots.indexOf(sh); return k < wins.length ? wins[k] : null; })());
  const norm = screenplay.normalize(
    { prompt_prefix: same ? ((st0.plan || {}).prompt_prefix || []) : [], shots: woven },
    scenes.chainOverrides(project));
  // normalize copies the fields it knows; the windows and the bridges ride the shots
  norm.shots.forEach((sh, i) => {
    const w = winOf[i];
    if (w) { sh.audio_start = w.start; sh.audio_dur = w.dur; }
    if (woven[i] && woven[i].bridge) { sh.bridge = woven[i].bridge; sh.length = woven[i].length; }
    else delete sh.bridge;
  });
  // bridges this save drops leave with their rows (fromPlan would weave them back in)
  const keepIds = new Set(woven.filter((x) => x.bridge).map((x) => x.id));
  const prev = { ...st0, list: (st0.list || []).filter((r) => !r.bridge || keepIds.has(r.id)) };
  const merged = scenes.fromPlan(norm, prev);
  merged.list.forEach((r, i) => {
    const w = winOf[i];
    if (w) { r.audio_start = w.start; r.audio_dur = w.dur; }
    if (!same) {                       // a new song: nothing carried from the old board
      r.anchor = undefined; r.cont_src = undefined; r.cont_time = undefined;
    }
    if (r.bridge) { r.cont_src = undefined; r.cont_time = undefined;
                    r.anchor = r.bridge.type === bridges.AI ? "first" : undefined; }
  });
  merged.seg_gap = gw.gap > 0 && bridgeShots.size ? { dur: gw.gap, type: gapType } : undefined;
  merged.audio = base;
  merged.seg_song = base;
  scenes.save(merged, project);
  const written = shots.filter((s) => !isBlank(s.prompt)).length;
  const bt = bridges.types().find((t) => t.id === gapType) || { label: gapType };
  const bridgeNote = bridgeShots.size
    ? ` - plus ${bridgeShots.size} bridge scene(s) of ${gw.gap}s (${bt.label}) between the segments: each goes from `
      + "the scene before's last frame to the scene after's first frame"
      + (gw.skipped.length ? ` (no bridge after segment ${gw.skipped.join(", ")} - too short to give up ${gw.gap}s)` : "")
    : (gw.gap > 0 && gw.skipped.length ? ` - no bridges: every segment is too short to give up ${gw.gap}s` : "");
  const replaced = same ? 0 : oldShots.filter((s) => s && !isBlank(s.prompt)).length;
  const note = (same
      ? `${wins.length} segment window(s) written to the board's scenes`
        + (written ? ` - ${written} written scene(s) kept, only their start/duration follow the new map` : "")
        + (wins.length > oldShots.length ? ` - ${wins.length - oldShots.length} blank scene(s) added` : "")
        + (kept.length ? ` - scene(s) ${kept.join(", ")} run past the song's last segment and were kept; delete them if they are not wanted` : "")
      : `${wins.length} blank scene(s) on the board`
        + (replaced ? ` (they replace the ${replaced} written scene(s) of the previous board)` : ""))
    + ` - "${base}" is the board's audio and every scene carries its own `
    + "start/duration window (no segment files). \"create the music video\" "
    + "(with the lyrics) fills them in";
  return { scenes: wins.length, audio: base, windows: wins, kept, replaced,
           fresh: !same, note: note + bridgeNote, bridges: bridgeShots.size, gap: merged.seg_gap || null,
           skipped_gaps: gw.skipped };
}

module.exports = { stage, isBlank, windowsOf, BLANK_RE };
