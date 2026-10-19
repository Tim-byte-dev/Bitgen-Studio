// bitGen Studio — THE NATIVE-AUDIO MUSIC VIDEO, per scene (2.292.0).
//
// Tim (verbatim): "if we use minimax h3 singularity model, can we use
// ref2va and fl2va in the mmh3 native audio workflow? so our following
// scenes can follow from the frame we select in the scene before using
// fl2va, or if we change location to use ref2va for the new location and
// transition from the previous scene?" ... "yes please build it".
//
// ComfyUI picks the MODE by the conditioning node, not by the weights:
//   ref2va  MiniMaxH3ReferenceToVideo (9 pictures / 3 videos / 3 audios)
//           -> comfy_workflows/MMH3_NativeAudio_MV.json (converted export)
//   fl2va   MiniMaxH3ImageToVideo (first_frame / last_frame only)
//           -> comfy_workflows/MMH3_NativeAudio_MV_fl2va.json
// Both feed MiniMaxH3NativeAudioLock, which locks the board song's window
// (TrimAudioDuration) into the joint latent - lipsync holds in either mode.
// With the stock weights each graph loads its own file (ref2va / fl2va);
// MiniMax H3 Singularity merges both, so setting it as the style's model
// (Settings -> Video -> MMH3_NativeAudio_MV, phase 1) serves BOTH graphs
// from one loaded file.
//
// The scene's ANCHOR radio chooses:
//   reference   ref2va - a NEW location/character: every sheet, location
//               view, prop picture and clothing as <Picture n>, the song
//               window as <Audio 1> (+ voices), and - when the scene has a
//               source take - the END of that take as <Video 1>, so the new
//               shot carries its motion and look (the transition). The
//               picked frame is NOT a picture here: a new location should
//               not be pulled back to the old one.
//   first       fl2va - the clip STARTS on the picked frame (or the source
//               take's last frame): true continuation.
//   transition  fl2va - starts on the picked frame and ENDS on the new
//               location's still (the location/prop picture the prompt
//               names, else the first one): the clip travels there.
//   (last       a board saved before 2.292 may say "last": it always
//               rendered as First and still does - the radio offers Trans.)
// No frame to continue from (no source take on disk) -> first/transition/
// last fall back to reference, said in words - boards render out of order.
const fs = require("fs");
const path = require("path");
const refMap = require("./refMap");
const voiceStyle = require("./voiceStyle");   // 2.363.0: spoken lines in H3's own dialogue syntax, voices as timbre

const TAIL_SECONDS = 3;

/** The last `seconds` of a take as its own small clip (the <Video 1>
 *  transition reference - a whole 15 s take would ride every sampling step). */
function tailClip(src, out, seconds) {
  try {
    require("child_process").execFileSync("ffmpeg",
      ["-y", "-sseof", "-" + String(seconds || TAIL_SECONDS), "-i", src,
       // 2.301.0: near-transparent (the source is the lossless master when
       // the take has one - lib/rawMaster.sourceFor at the call site)
       "-an", "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", out],
      { stdio: "ignore", timeout: 60000 });
  } catch { /* a missing ffmpeg or a too-short take: no video reference */ }
  return fs.existsSync(out) ? out : null;
}

/** The new location's still for a transition, most specific first: a
 *  location view the prompt names, any location view, a reference picture
 *  the prompt names (a chapter picture of the place), the first reference
 *  picture; null when the render has none. A named PROP never outranks a
 *  location - the clip travels to a place. */
function locationStill(imgMeta, text) {
  // 2.295.0: a picture the user put on THIS scene (kind "scene") is where
  // a Transition goes - unless the prompt names a location view outright
  const own = (imgMeta || []).filter((x) => x && x.file && x.kind === "scene");
  const cands = (imgMeta || []).filter((x) => x && x.file
    && (x.kind === "location" || x.kind === "reference"));
  const names = (x) => x.tag
    && new RegExp("@" + String(x.tag).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w-])", "i").test(text);
  const loc = cands.filter((x) => x.kind === "location");
  const refs = cands.filter((x) => x.kind === "reference");
  return loc.find(names) || own[0] || loc[0] || refs.find(names) || refs[0] || null;
}

/** fl2va has no reference slots, so a @tag is only a handle the model
 *  cannot resolve - it becomes the name the tag stands for. */
function plainTags(text, meta) {
  const names = {};
  for (const x of (meta || [])) if (x && x.tag && x.label && !names[String(x.tag).toLowerCase()])
    names[String(x.tag).toLowerCase()] = String(x.label).replace(/\s*[-:(].*$/, "").trim() || x.label;
  return String(text || "").replace(/(^|[^\w@<])@([A-Za-z][\w-]*)/g, (m, pre, t) =>
    pre + (names[t.toLowerCase()] || t.replace(/_/g, " ")));
}

/**
 * Decide one scene's render. In:
 *   anchor, prompt, imgMeta, audMeta (the queue's walk, tagged),
 *   song (abs path), window {start, dur} | null,
 *   frame {file, name, label} | null   (the picked / tail frame),
 *   take  {path, n, id} | null          (the source scene's take on disk),
 *   tmpDir, n
 * Out: { mode, files, names, audios, videos, prompt, notes, missing }.
 */
function plan(o) {
  const notes = [], missing = [];
  // a board saved before 2.292 may say "last": fl2va's loader order is
  // [first, last] and a lone frame lands FIRST, so it always rendered as
  // First - said, and kept that way
  let want = String(o.anchor || "reference");
  if (want === "last") { want = "first";
    notes.push('anchor "last" renders as First (a lone frame is the first frame)'); }
  /* 2.323.0 (Tim: "if screenplay then there won't be a song, but i would
     still like to render with the nativeaudio workflow"): o.song is
     OPTIONAL - no song = the model makes the sound itself (the worker takes
     the lock out, scripts/nosong.py), the voices take every audio slot and
     each speaking character is bound to its voice in the prompt */
  const noSong = !o.song;
  if (noSong) notes.push("no song: the native-audio model makes the sound itself - the characters "
    + "speak their lines in their own voices (voice references), nothing is locked");
  const songLabel = noSong ? "" : (o.window
    ? `${Math.round((o.window.start || 0) * 10) / 10}s + `
      + `${o.window.dur != null ? Math.round(o.window.dur * 10) / 10 : "?"}s of `
    : "") + `${path.basename(o.song)} - the exact performance timeline, locked`;
  /* 2.296.0 (Tim: "is it possible for me to add the last frame of the
     scene before as a reference image to the current scene? i would like
     the scene to start from the last frame but keep the character and
     continuity of the scene, right now the last frame is a closup of the
     guitar, the next scene starts with the guitar closeup but the
     character changes"): fl2va (First) has NO reference slots - when the
     frame carries no face, nothing tells the model who the performer is.
     CONT renders ref2va with the frame as <Picture 1>, "the opening
     frame", AND every cast sheet / picture behind it, plus the end of the
     previous take as <Video 1>: it opens on that frame and keeps the
     character. A reference is not a hard first frame - the opening lands
     close to the picture, not pixel-exact (First is exact, but has no
     sheets). */
  /* 2.297.0 (Tim: "if transition scene is selected allow the user to
     select first and/or last frame from previous clips or gallery or
     assets"): a picture the user put in the scene's FIRST slot outranks
     the continuation frame (First / Cont / Trans), and one in its LAST
     slot is where a Transition ends (before any location still). 2.299.0:
     every scene can have a LAST frame - First ends on it too (fl2va), Ref
     and Cont carry it as their closing picture (ref2va). */
  if (o.flFirst && ["first", "continue", "transition"].includes(want))
    o = { ...o, frame: { file: o.flFirst.file, name: o.flFirst.name,
      label: `the chosen first frame (${o.flFirst.label || o.flFirst.name})` } };
  const cont = want === "continue";
  let mode = want === "reference" || cont ? "ref2va" : "fl2va";
  if (cont && !o.frame) missing.push("Cont needs a frame to open on and this "
    + "scene has none (render the scene before it, or pick a frame on its "
    + "filmstrip) - rendering Ref from the references instead");
  if (mode === "fl2va" && !o.frame) {
    missing.push(`anchor "${want}" needs a frame to continue from and this scene `
      + "has none (pick one on the scene before's 🎞 filmstrip, or render the "
      + "scene it continues) - rendering ref2va from the references instead");
    mode = "ref2va";
  }
  if (mode === "fl2va") {
    const files = [], names = [];
    {
      files.push(o.frame.file); names.push(o.frame.name);
      if (want === "transition") {
        const still = o.flLast
          ? { file: o.flLast.file, name: o.flLast.name, tag: "",
              kind: `the chosen last frame: ${o.flLast.label || o.flLast.name}` }
          : locationStill(o.imgMeta, (o.prompt || ""));
        if (still) {
          files.push(still.file); names.push(still.name || path.basename(still.file));
          notes.push(`fl2va (Transition): from ${o.frame.label} to `
            + `${still.tag ? "@" + still.tag : still.name} (${still.kind})`);
        } else missing.push("Transition needs the new location's picture (a picture on this scene, a "
          + "location view or a chapter reference picture) and this render has "
          + "none - continuing from the frame only (First)");
      } else if (o.flLast) {
        /* 2.299.0 (Tim: "add a last frame option to each scene fl2va will
           use last frame too if it is set"): First runs from its frame to
           the chosen last frame - fl2va's loader order is [first, last] */
        files.push(o.flLast.file); names.push(o.flLast.name || path.basename(o.flLast.file));
        notes.push(`fl2va (First): from ${o.frame.label} to the chosen last frame `
          + `(${o.flLast.label || o.flLast.name})`);
      } else notes.push(`fl2va (First): starts on ${o.frame.label}`);
    }
    return { mode, files, names, audios: noSong ? [] : [o.song], videos: [],
             // 2.363.0: fl2va carries no voices, but its lines are still marked dialogue (no prose speech)
             prompt: plainTags(noSong ? voiceStyle.speech(o.prompt, () => false).text : o.prompt,
                               (o.imgMeta || []).concat(o.audMeta || [])),
             notes: notes.concat([noSong
               ? "fl2va carries no reference pictures or voices - the frame carries identity, "
                 + "the model voices the lines itself (Cont keeps the characters' own voices)"
               : "the song window is locked into the clip "
               + "(NativeAudioLock); fl2va carries no reference pictures - the "
               + "frame carries identity"]), missing };
  }
  // ref2va - the new location / character, with the take's end as <Video 1>
  const videos = [];
  if (o.take && o.take.path && fs.existsSync(o.take.path)) {
    const tail = tailClip(o.take.path,
      path.join(o.tmpDir || require("os").tmpdir(), `scene${o.n}_prev_tail.mp4`));
    if (tail) videos.push({ file: tail, kind: "take",
      label: `the last ${TAIL_SECONDS}s of scene ${o.take.n}'s take - carry its `
        + "motion and look into this new shot" });
    else missing.push(`could not cut the end of scene ${o.take.n}'s take - `
      + "no transition video reference this time");
  }
  const opening = cont && o.frame
    ? [{ file: o.frame.file, name: o.frame.name, kind: "opening",
         label: `${String(o.frame.label || "the previous scene's last frame").split(" - ")[0]} - the clip `
           + "OPENS exactly on this picture (same framing, light and objects), "
           + "the cast keep their identity from their sheets" }] : [];
  /* 2.299.0: a Ref / Cont scene with a chosen LAST frame - ref2va has no
     end-frame slot, so the picture rides right after the opening as "the
     closing frame" and the prompt asks for the clip to end on it (close,
     not pixel-exact - First or Trans end on it exactly) */
  const ending = o.flLast
    ? [{ file: o.flLast.file, name: o.flLast.name, kind: "ending",
         label: `${o.flLast.label || o.flLast.name} - the clip ENDS on this picture` }] : [];
  if (ending.length) notes.push(`ref2va: ends near the chosen last frame (${o.flLast.label || o.flLast.name}) `
    + "- a reference, not an exact frame (First or Trans end on it exactly)");
  /* 2.363.0 (Tim: "make the character speak with expression and emotion using the reference audio but not
     saying the words in the reference audio"): a voice clip reaches the model as a short clean SAMPLE (leading
     silence off, at most voiceStyle.VOICE_MAX s) - its timbre, with far less speech to copy */
  let trimmedVoices = 0;
  const aud = (o.audMeta || []).map((a) => {
    if (!a || a.kind !== "voice" || !a.file) return a;
    const sm = voiceStyle.sample(a.file, o.tmpDir);
    if (sm.trimmed) trimmedVoices++;
    return sm.file === a.file ? a : { ...a, file: sm.file };
  });
  if (trimmedVoices) notes.push(`${trimmedVoices} voice clip(s) trimmed to a ${voiceStyle.VOICE_MAX} s timbre sample `
    + "(leading silence off) - the model takes the voice, not the words");
  const m = refMap.compose(opening.concat(ending, o.imgMeta || []),
    (noSong ? [] : [{ file: o.song, tag: "", kind: "song", label: songLabel }]).concat(aud),
    videos);
  if (m.dropped.images.length) missing.push(`${m.dropped.images.length} reference `
    + "picture(s) beyond the node's 9 stay out: "
    + m.dropped.images.map((x) => x.tag ? "@" + x.tag : x.name).join(", "));
  if (m.dropped.audios.length) missing.push(`${m.dropped.audios.length} audio `
    + "reference(s) beyond the node's 3 (the song + 2) stay out: "
    + m.dropped.audios.map((x) => x.tag ? "@" + x.tag : path.basename(x.file)).join(", "));
  notes.push(`ref2va: ${m.files.length} picture(s), ${m.audios.length} audio(s)`
    + (m.videos.length ? `, ${m.videos.length} video (the previous take's end)` : "")
    + " - " + (Object.keys(m.tags).length
      ? Object.entries(m.tags).map(([t, v]) => `@${t}=${v}`).join(" ") : "no @tags to map"));
  if (opening.length) notes.push(`ref2va (Cont): opens on ${String(o.frame.label || "the frame").split(" - ")[0]} `
    + "as <Picture 1>, the cast sheets keep the character");
  const endPic = ending.length ? `<Picture ${opening.length + 1}>` : "";
  /* 2.363.0: with no song the characters SPEAK - every spoken line becomes H3's dialogue syntax (the delivery
     outside, the words inside <d>[English] ...</d>, "in the timbre of" the character's voice when it rides) */
  let spoken = String(o.prompt || "");
  if (noSong) {
    const sp = voiceStyle.speech(spoken, (t) => !!(m.tags[String(t).toLowerCase() + "_voice"]));
    spoken = sp.text;
    if (sp.lines) notes.push(`${sp.lines} spoken line(s) marked as H3 dialogue (<d>[English] ...</d>), each in its `
      + "character's voice timbre - nothing else is said");
  }
  const body = (opening.length
    ? "The clip opens exactly on <Picture 1> and continues from it.\n" : "")
    + (endPic ? `The clip ends on ${endPic}.\n` : "")
    + spoken
    + (noSong ? voiceStyle.binding(spoken, m.tags) : "");
  return { mode, files: m.files, names: m.names, audios: m.audios,
           videos: m.videos, prompt: m.prompt(body), notes, missing };
}

/** 2.323.0: with no song, every @character in the scene that has a voice in
 *  THIS render gets "@x speaks with the voice of @x_voice." - refMap then
 *  turns both into their <Picture n> / <Audio n>.
 *  2.363.0: superseded at render time by lib/voiceStyle.binding (the voice is a TIMBRE and is never said);
 *  kept for callers that only want the binding. */
function voiceBinding(prompt, tags) {
  const said = new Set();
  const out = [];
  String(prompt || "").replace(/(^|[^\w@<])@([A-Za-z][\w-]*)/g, (m, pre, t) => {
    const k = t.toLowerCase();
    if (!k.endsWith("_voice") && !said.has(k) && tags[k] && tags[k + "_voice"]) {
      said.add(k); out.push(`@${t} speaks with the voice of @${t}_voice.`);
    }
    return m;
  });
  return out.length ? "\n\n" + out.join("\n") : "";
}

module.exports = { voiceBinding, plan, locationStill, plainTags, tailClip, TAIL_SECONDS };
