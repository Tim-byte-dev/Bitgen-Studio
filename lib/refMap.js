// bitGen Studio — THE REFERENCE MAP for native ref2va renders (2.290.0).
//
// Tim (verbatim): "can we add 9 images and 3 audio files to the
// mmh3_native audio_mv workflow ... so we can use the characters and
// character sheets, locations, props, vehicles etc. in the video docker
// for music videos".
//
// MiniMaxH3ReferenceToVideo (a CORE ComfyUI node) takes up to 9 reference
// pictures and 3 reference audios, and the model knows them ONLY as
// <Picture 1..9> / <Audio 1..3> — "in the exact order they were
// connected" (the template's own note). The app's identity system is the
// @tag. This file is the bridge, written once:
//   compose(images, audios) caps the lists at 9 / 3 in priority order,
//   returns the files in SLOT order (the worker fills loaders in id order,
//   so file n lands in ref_image_{n-1}), a header that says what every
//   number IS, and a prompt rewrite that turns each @tag that has a
//   reference in THIS render into its <Picture n> (a voice tag into its
//   <Audio n>). A tag with no reference stays as written - never an
//   invented number.
//
// An entry: { file, name?, tag?, kind, label, entry? } — `entry` is what
// goes into the job's list when it is not the plain path (the board song
// rides as {file, name}).
const MAX_IMAGES = 9;
const MAX_AUDIOS = 3;
const MAX_VIDEOS = 3;

const KIND_WORDS = {
  frame: "continuation frame",
  opening: "the opening frame",          // 2.296.0: Cont - the clip opens on it
  ending: "the closing frame",           // 2.299.0: a Ref/Cont scene's chosen last frame
  sheet: "character sheet",
  location: "location view",
  reference: "reference picture",
  clothing: "clothing",
  song: "the song segment",
  take: "reference video",
  scene: "scene reference picture",      // 2.295.0: a picture on this scene only
  voice: require("./voiceStyle").voiceLabel,   // 2.363.0: a voice clip is a TIMBRE, never words to say
  sound: "sound reference",
};

function describe(x) {
  // 2.363.0: a voice clip says whose TIMBRE it is and that its words are never spoken
  if (x.kind === "voice")
    return (x.tag ? `@${x.tag} - ` : "") + `the voice timbre of ${x.label || "this character"}: copy only its pitch, `
      + "accent, texture and emotional colour, never the words heard in it";
  const k = KIND_WORDS[x.kind] || x.kind || "reference";
  return (x.tag ? `@${x.tag} - ` : "") + k + (x.label ? ` (${x.label})` : "");
}

/** Cap, number and describe. Returns {files, names, audios, header,
 *  tags (tag -> "<Picture n>"/"<Audio n>"), dropped, rewrite(text),
 *  prompt(text)}. */
function compose(images, audios, videos) {
  const imIn = (images || []).filter((x) => x && x.file);
  const auIn = (audios || []).filter((x) => x && x.file);
  const viIn = (videos || []).filter((x) => x && x.file);   // 2.292.0: <Video n>
  const im = imIn.slice(0, MAX_IMAGES);
  const au = auIn.slice(0, MAX_AUDIOS);
  const vi = viIn.slice(0, MAX_VIDEOS);
  const dropped = { images: imIn.slice(MAX_IMAGES), audios: auIn.slice(MAX_AUDIOS),
                    videos: viIn.slice(MAX_VIDEOS) };
  const tags = {};
  im.forEach((x, i) => {
    const t = String(x.tag || "").toLowerCase();
    if (t && !(t in tags)) tags[t] = `<Picture ${i + 1}>`;    // first slot wins
  });
  au.forEach((x, i) => {
    const t = String(x.tag || "").toLowerCase();
    if (t && !(t in tags)) tags[t] = `<Audio ${i + 1}>`;
  });
  const header = [];
  if (im.length || au.length || vi.length) {
    header.push("References, in the order they are connected:");
    im.forEach((x, i) => header.push(`<Picture ${i + 1}> is ${describe(x)}.`));
    vi.forEach((x, i) => header.push(`<Video ${i + 1}> is ${describe(x)}.`));
    au.forEach((x, i) => header.push(`<Audio ${i + 1}> is ${describe(x)}.`));
  }
  /** @tag -> its reference number; a tag with no reference in THIS
   *  render is left exactly as written. */
  function rewrite(text) {
    return String(text || "").replace(/(^|[^\w@<])@([A-Za-z][\w-]*)/g, (m, pre, t) => {
      const hit = tags[t.toLowerCase()];
      return hit ? pre + hit : m;
    });
  }
  function prompt(text) {
    const body = rewrite(text);
    return header.length ? header.join("\n") + "\n\n" + body : body;
  }
  return {
    files: im.map((x) => x.file),
    names: im.map((x) => x.name || require("path").basename(String(x.file))),
    audios: au.map((x) => (x.entry !== undefined ? x.entry : x.file)),
    videos: vi.map((x) => x.file),
    header, tags, dropped, rewrite, prompt,
  };
}

module.exports = { compose, describe, MAX_IMAGES, MAX_AUDIOS, MAX_VIDEOS };
