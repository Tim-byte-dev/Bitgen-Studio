/* bitGen Studio — THE SONGWRITER (2.244.0, Tim verbatim: "when i prompt,
   create a song or make a song, create a song in prompt chat and send the
   lyrics to lyrics in music docker, and style to the style input in music
   docker and title to the title input in music docker").

   The screenplay pattern, for songs: /api/chat detects the ask
   (asksForSong), teaches the LLM the answer shape (FORMAT_NOTE rides the
   system context for that call only), and parses the reply (parse) into
   {title, style, lyrics} — which the response carries as `song` and the
   page pours into the music dock's Title / style caption / Lyrics inputs.
   The parser is tolerant of what chat models actually emit (bold labels,
   stray casing, a closing chat line after the lyrics fenced or labelled),
   and a reply that does not parse is simply a chat reply — never an
   error. */
"use strict";

/** "create a song", "make me a song about X", "write a song" — the verb
 *  and the word within one clause. "songbird"/"songs about" don't trip it
 *  without the verb; discussing an existing song doesn't either. */
function asksForSong(text) {
  const t = String(text || "");
  if (!/\bsongs?\b/i.test(t)) return false;
  return /\b(?:create|make|write)\b[^.!?\n]{0,60}?\bsongs?\b/i.test(t);
}

/** The answer shape, taught to the LLM only when the ask is detected.
 *  TITLE and STYLE are one line each; LYRICS run to the end of the reply
 *  ([verse]/[chorus] tags — the music models' own convention). */
const FORMAT_NOTE = "\n\nTHE USER IS ASKING FOR A SONG. Reply in EXACTLY this "
  + "shape, nothing before TITLE and nothing after the lyrics:\n"
  + "TITLE: <the song's name, one line>\n"
  + "STYLE: <one line for the music model - genre, instruments, voice, "
  + "mood, tempo (e.g. 'warm piano pop, expressive female voice, 88 BPM')>\n"
  + "LYRICS:\n"
  + "[verse]\n<the words, using [verse] / [chorus] / [bridge] tags on their "
  + "own lines>";

/** The reply → {title, style, lyrics} or null (a chat reply is a chat
 *  reply). Labels may arrive bolded (**TITLE:**), any case; the lyrics are
 *  everything after the LYRICS label, code fences stripped. */
function parse(reply) {
  const t = String(reply || "");
  const grab = (label) => {
    const m = t.match(new RegExp("^\\s*\\**" + label + "\\**\\s*:\\**\\s*(.+)$", "im"));
    return m ? m[1].replace(/\*+$/g, "").trim() : "";
  };
  const title = grab("TITLE");
  const style = grab("STYLE");
  const lm = t.match(/^\s*\**LYRICS\**\s*:\**\s*$/im) || t.match(/^\s*\**LYRICS\**\s*:\**/im);
  if (!title || !lm) return null;
  let lyrics = t.slice(lm.index + lm[0].length)
    .replace(/^```[a-z]*\s*$/gim, "").trim();
  if (!lyrics) return null;
  return { title: title.slice(0, 120), style: style.slice(0, 1000), lyrics };
}

module.exports = { asksForSong, FORMAT_NOTE, parse };
