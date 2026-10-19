// bitGen Studio — "Quick prompt": one button from a song to a timed shot list.
//
//   asset (sound or video)
//     -> speech-to-text (lib/asr)          -> songs/<song>.tmp
//     -> group lyric lines into shot windows
//     -> LLM writes one visual prompt per window (llama-server, loaded on demand)
//     -> shot lines the music-video dialog can run as-is
//
// The point of routing through the transcript rather than asking the LLM to
// invent a structure is that the CUTS LAND ON LYRIC LINES: every window starts
// and ends on a real segment boundary from the audio, so the shots change when
// the singer does.
const fs = require("fs");
const path = require("path");
const core = require("./core");
const asr = require("./asr");

const SONG_DIR = () => {
  const d = path.join(core.projDir(core.getProject()), "songs");
  fs.mkdirSync(d, { recursive: true });
  return d;
};

// Group transcript segments into windows of about `target` seconds, never
// splitting a line. A window is closed once adding the next line would take it
// further from the target than stopping here does.
function windows(segs, target, total) {
  if (!segs.length) return total > 0 ? [{ start: 0, end: total, lines: [] }] : [];
  const out = [];
  let cur = { start: segs[0].start, end: segs[0].end, lines: [segs[0].text] };
  for (const s of segs.slice(1)) {
    const now = cur.end - cur.start;
    const grown = s.end - cur.start;
    if (now > 0 && Math.abs(grown - target) > Math.abs(now - target) && now >= target * 0.5) {
      out.push(cur);
      cur = { start: s.start, end: s.end, lines: [s.text] };
    } else {
      cur.end = s.end;
      cur.lines.push(s.text);
    }
  }
  out.push(cur);
  if (total > cur.end + 0.5) cur.end = total;      // run the last shot to the end
  return out;
}

const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

async function chat(messages, llmFile, maxTokens) {
  const config = core.getConfig();
  let url, modelName;
  if (config.llm.external_url) {
    url = config.llm.external_url;
    modelName = config.llm.external_model || "local";
  } else {
    if (!llmFile) throw new Error(
      "No LLM selected — pick one in the dropdown under the prompt, or set an external endpoint in Settings → LLM.");
    await core.ensureLlama(llmFile);          // loads the model if it is not up
    url = `http://127.0.0.1:${config.llm.port}/v1/chat/completions`;
    modelName = "local";
  }
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelName, messages, temperature: 0.8,
                           max_tokens: maxTokens || 1400 }),
  });
  if (!r.ok) throw new Error(`LLM returned ${r.status} at ${url}`);
  const data = await r.json();
  const text = data.choices && data.choices[0] && data.choices[0].message
    ? String(data.choices[0].message.content || "").trim() : "";
  if (!text) throw new Error("LLM returned an empty response");
  return text;
}

// Models wrap JSON in prose or fences no matter how firmly they are asked not
// to, so pull the first array out rather than trusting the whole reply.
function parseShots(text, count) {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("["), end = clean.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      const arr = JSON.parse(clean.slice(start, end + 1));
      if (Array.isArray(arr) && arr.length) {
        return arr.map((x) => String(
          typeof x === "string" ? x : (x.prompt || x.text || x.description || "")).trim())
          .filter(Boolean);
      }
    } catch { /* fall through to line parsing */ }
  }
  // fallback: one prompt per non-empty line, stripped of any leading numbering
  const lines = clean.split("\n").map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 8);
  return lines.slice(0, count);
}

// name        : sound/video asset in the project
// shotSeconds : target shot length (the pipeline's own default is 15)
async function quickPrompt(opts) {
  const o = opts || {};
  const target = Math.min(15, Math.max(2, parseFloat(o.shot_seconds) || 15));
  const style = String(o.style || "").trim();

  // 1) transcribe (lyrics mode: timed, and tuned not to collapse a chorus)
  const tr = await asr.transcribe({ name: o.name, mode: "lyrics", language: o.language });

  // 2) park the words next to the song, as <songname>.tmp
  const stem = path.basename(tr.name).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._ -]+/g, "_");
  const tmp = path.join(SONG_DIR(), stem + ".tmp");
  const body = tr.segments.length
    ? tr.segments.map((s) => `[${s.start.toFixed(2)}] ${s.text}`).join("\n")
    : tr.text;
  fs.writeFileSync(tmp, body + "\n", "utf8");

  // 3) shot windows aligned to lyric boundaries
  const wins = windows(tr.segments, target, tr.duration || 0);
  if (!wins.length) throw new Error("nothing usable was transcribed — no lyrics to work from");

  // 4) one visual prompt per window
  const system = [
    "You are a music video director writing shot prompts for MiniMax H3, an audio-video generation model.",
    "You are given the lyrics of a song split into numbered shots, each with its timing.",
    "Write ONE prompt per shot, in order, describing what the camera sees during those lyrics.",
    "Rules:",
    "- Return ONLY a JSON array of strings, one per shot, no keys, no commentary, no code fences.",
    "- Each prompt is one sentence or two: subject, action, framing, camera move, lighting, setting.",
    "- Describe IMAGES, never the words on screen; do not caption or quote the lyrics.",
    "- Keep a consistent look, cast and location across shots so the video reads as one piece.",
    "- Vary framing between shots (wide, medium, close) so consecutive shots do not look identical.",
    style ? `- Overall visual style: ${style}.` : "",
    "",
    require("./promptGuides").guideFor(o.styles_dir, { kind: "video", arch: "h3", model: "" }),
    // 2.118.0 (Tim): "sbs vr" in the style line makes every shot a stereo pair
    require("./promptGuides").addendaFor(o.styles_dir, "video", style || ""),
  ].filter(Boolean).join("\n");
  const user = `Song: ${stem}\nShots: ${wins.length}\n\n`
    + wins.map((w, i) =>
        `Shot ${i + 1} (${clock(w.start)}–${clock(w.end)}, ${(w.end - w.start).toFixed(1)}s): `
        + (w.lines.join(" / ") || "(instrumental)")).join("\n")
    + `\n\nReturn a JSON array of exactly ${wins.length} prompt strings.`;

  const raw = await chat([{ role: "system", content: system }, { role: "user", content: user }],
                         o.llm_file, Math.min(3000, 220 * wins.length + 400));
  const prompts = parseShots(raw, wins.length);
  if (!prompts.length) throw new Error("the LLM did not return any usable shot prompts");

  const mode = ["ref", "cont", "t2va"].includes(o.mode) ? o.mode : null;
  const shots = wins.map((w, i) => ({
    start: Math.round(w.start * 100) / 100,
    seconds: Math.round((w.end - w.start) * 100) / 100,
    lyrics: w.lines.join(" / "),
    prompt: prompts[i] || prompts[prompts.length - 1] || "",
  }));
  // the shot-list format the music-video dialog already parses
  const lines = shots.map((s, i) => {
    const tok = mode ? `${mode} | ` : (i === 0 ? "" : "cont | ");
    return `${s.seconds}s | ${tok}${s.prompt}`;
  }).join("\n");

  return {
    song: tr.name, stem, tmp_file: path.basename(tmp), tmp_path: tmp,
    duration: tr.duration, language: tr.language,
    shots, lines, transcript_files: tr.files,
    short: prompts.length < wins.length
      ? `the LLM returned ${prompts.length} prompts for ${wins.length} shots — the last one was reused`
      : null,
  };
}

module.exports = { quickPrompt, windows, parseShots, SONG_DIR };
