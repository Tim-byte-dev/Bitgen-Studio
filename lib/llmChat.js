"use strict";
/**
 * bitGen Studio — THE call to the language model (2.85.0).
 *
 * Extracted from the /api/enhance route when the prompt chat arrived, because
 * two callers each resolving "which LLM, at which URL, started how" is exactly
 * the duplication that let worker.py and comfy_client.py drift apart. Enhance
 * and Chat differ in what they SAY, not in how they say it.
 *
 * Everything model-selection is decided here, in this order:
 *   1. an external endpoint configured in Settings -> LLM (nothing is launched)
 *   2. the .gguf the caller named
 *   3. the only .gguf in the folder — "enhance should not fail because nobody
 *      picked one yet" was the original reasoning and it holds for chat too
 * and a managed llama-server is started on demand for 2 and 3.
 *
 * Errors come back as { ok:false, status, error } rather than as exceptions:
 * every caller is an HTTP route that has to turn the failure into a status code
 * anyway, and a thrown error in one of them would take out the request handler.
 */
const fs = require("fs");
const path = require("path");

/**
 * STRICT-TEMPLATE ARMOR (2.188.0, Tim's card verbatim: "Unable to generate
 * parser for this template ... raise_exception('After the optional system
 * message, con..."). Many chat templates — Mistral and Gemma among them —
 * refuse a conversation whose roles do not alternate user/assistant after
 * the optional system message, and llama-server answers 400 with the
 * template's own exception. No prompt we build NEEDS consecutive same-role
 * turns, so adjacent messages sharing a role are merged here, at the single
 * gate every LLM call passes, and no caller can ever trip the rule again.
 */
function alternate(msgs) {
  const out = [];
  for (const m of msgs) {
    if (!m) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) {
      prev.content = String(prev.content || "")
        + "\n\n" + String(m.content || "");
    } else out.push({ ...m });
  }
  return out;
}

/**
 * @param {object} core     lib/core.js (config, llmPaths, ensureLlama)
 * @param {object} opts     { messages, temperature, max_tokens, llm_file }
 * @returns {Promise<{ok:boolean, text?:string, status?:number, error?:string}>}
 */
async function complete(core, opts = {}) {
  const config = core.getConfig();
  const messages = Array.isArray(opts.messages) ? opts.messages : [];
  if (!messages.length) return { ok: false, status: 400, error: "no messages" };

  let url, modelName;
  try {
    if (config.llm.external_url) {
      url = config.llm.external_url;
      modelName = config.llm.external_model || "local";
    } else {
      let file = opts.llm_file;
      // THE RUNNING MODEL IS THE SELECTION (2.145.0, Tim: "it is not loading
      // the llm that i select"). The dropdown LOADS its pick via
      // /api/llm/start (2.85.2); a caller that passes no llm_file used to
      // fall back to the alphabetically-first .gguf — ensureLlama then
      // STOPPED the loaded model and started the wrong one, actively
      // unloading the user's choice. A model already up and healthy is the
      // user's answer to "which LLM"; files[0] is only for a cold start.
      if (!file && typeof core.llamaState === "function") {
        const st = core.llamaState() || {};
        if (st.file && st.proc) file = st.file;
      }
      if (!file) {
        const { dir } = core.llmPaths();
        let files = [];
        try {
          files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".gguf")).sort();
        } catch { /* no folder yet: handled by the message below */ }
        if (!files.length) {
          return { ok: false, status: 400,
                   error: "No .gguf model found — drop one into the LLM folder "
                        + "(Settings → LLM), or set an external endpoint there." };
        }
        file = files[0];
      }
      await core.ensureLlama(path.basename(file));
      url = `http://127.0.0.1:${config.llm.port}/v1/chat/completions`;
      modelName = "local";
    }
    const post = (msgs) => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages: alternate(msgs),
        temperature: opts.temperature == null ? 0.7 : opts.temperature,
        // 2.148.0: the ldock slider sets the DEFAULT budget; a caller with
        // its own max_tokens (the screenplay's 4096) still wins.
        max_tokens: opts.max_tokens || (config.llm && config.llm.max_tokens) || 600,
        /* A reasoning model spends its budget on a <think> block and can reach
           the cap with nothing left to say. Turning thinking off is the honest
           fix, and llama-server takes it here; a server that does not know the
           field ignores it, so this is safe against a plain OpenAI endpoint. */
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
    let r = await post(messages);
    let note = "";
    if (!r.ok) {
      // THE SERVER'S OWN WORDS, not just a status number (2.152.0, Tim: "the
      // majority of my llms ... are not populating the scenes"). llama-server
      // says exactly why it refused — most famously "System role not
      // supported": many chat templates (the Gemma family among them) raise
      // on a system message, so every screenplay died with a bare "LLM
      // returned 500" while one template happened to accept it.
      let bodyText = "";
      try { bodyText = String(await r.text()).slice(0, 300); } catch { /* opaque */ }
      const hasSystem = messages.some((m) => m && m.role === "system");
      if (hasSystem) {
        // FOLD AND RETRY, once: the same instructions as the head of the
        // first user turn. Every template accepts a user message, and the
        // models follow folded instructions fine — losing the screenplay
        // over a template's role vocabulary is the wrong trade.
        const sys = messages.filter((m) => m && m.role === "system")
          .map((m) => String(m.content || "")).join("\n\n");
        const rest = messages.filter((m) => !m || m.role !== "system");
        const folded = rest.length && rest[0].role === "user"
          ? [{ role: "user", content: "INSTRUCTIONS (follow these for the whole "
               + "conversation):\n" + sys + "\n\n---\n\n" + String(rest[0].content || "") },
             ...rest.slice(1)]
          : [{ role: "user", content: sys }, ...rest];
        const r2 = await post(folded);
        if (r2.ok) {
          r = r2;
          note = "this model's chat template refused the system role, so the "
               + "instructions were folded into the user message and it answered";
        } else {
          return { ok: false, status: 502,
                   error: `LLM returned ${r.status} at ${url}`
                        + (bodyText ? ` — ${bodyText}` : "")
                        + " (a retry without a system role also failed)" };
        }
      } else {
        return { ok: false, status: 502,
                 error: `LLM returned ${r.status} at ${url}`
                      + (bodyText ? ` — ${bodyText}` : "") };
      }
    }
    const data = await r.json();
    // 2.256.0 ("add Tokens consumed label"): every completion's reported
    // usage lands in one module counter — chat, Enhance and the screenplay
    // all pass through here, so the ldock label is the whole truth. Session
    // scope (since app start); a model that reports no usage adds nothing.
    try {
      const u = data && data.usage ? data.usage : {};
      USAGE.in += Number(u.prompt_tokens) || 0;
      USAGE.out += Number(u.completion_tokens) || 0;
      USAGE.calls += 1;
    } catch { /* counting must never break the reply */ }
    const out = readReply(data);
    if (out && out.ok && note) out.note = note;
    return out;
  } catch (e) {
    return { ok: false, status: 502, error: e.message };
  }
}

/**
 * Pull the answer out of a chat-completions body — including from the models
 * that do not put it where the spec says.
 *
 * "⚠ LLM returned an empty response", on `hi`. A REASONING MODEL had eaten the
 * entire token budget thinking: llama-server splits `<think>` blocks out into
 * `reasoning_content` and leaves `content` empty, and if the budget runs out
 * before the block closes there is no content to leave. The old code saw an
 * empty string and reported the one thing that was certainly not the problem.
 *
 * So, in order: the content; the reasoning, if that is all there is; and if
 * neither, an error that names `finish_reason`, because "it ran out of tokens
 * while thinking" and "the model returned nothing at all" need different fixes
 * and looked identical.
 */
function readReply(data) {
  const choice = (data && data.choices && data.choices[0]) || {};
  const message = choice.message || {};
  const why = choice.finish_reason || "";
  let text = stripThinking(String(message.content || ""));
  if (!text) {
    // Some servers put everything in reasoning_content; a thought is a poorer
    // answer than an answer, but it is far better than nothing on screen.
    text = stripThinking(String(message.reasoning_content || ""));
  }
  if (text) return { ok: true, text, finish_reason: why };
  if (why === "length") {
    return { ok: false, status: 502,
             error: "the model used its whole token budget before answering — "
                  + "this is what a reasoning model does when its <think> block "
                  + "runs long. Try a shorter question, or a non-reasoning "
                  + "model in Settings → LLM." };
  }
  return { ok: false, status: 502,
           error: "the LLM replied with no text"
                + (why ? ` (finish_reason: ${why})` : "")
                + ". If it is a reasoning model, it may have returned only its "
                + "thinking; check the llama-server console." };
}

/**
 * Drop `<think>…</think>` blocks, which some models emit inline in `content`.
 *
 * An UNCLOSED block is dropped too: the model was still thinking when it was
 * cut off, so what follows is not an answer. Returning the raw thoughts would
 * put "okay, the user wants a song about hard times. Let me consider..." into
 * the chat as though it were the reply.
 */
function stripThinking(s) {
  let out = String(s || "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  const open = out.search(/<think>/i);
  if (open >= 0) out = out.slice(0, open);
  return out.trim();
}

/**
 * The prompt assistant's brief.
 *
 * It is a COLLABORATOR, not a rewriter: /api/enhance already turns one rough
 * line into one finished prompt, and duplicating that here would give two
 * features that do the same thing differently. This one is for working out what
 * you want in the first place, across all three things this app makes.
 */
const guides = require("./promptGuides");   // 2.104.0: per-model prompting guides

const CHAT_SYSTEM = [
  "You help plan and write prompts for bitGen Studio, a local generative studio.",
  "It makes three kinds of thing, and a prompt looks different for each:",
  "- VIDEO (MiniMax H3): a directed shot — subject, ONE camera move, framing,",
  "  light, plus a SOUND line, because the model generates its own audio.",
  "  Clips are up to 15 s.",
  "- IMAGE (ComfyUI): the syntax depends on the model family — natural",
  "  sentences for FLUX / Z-Image, comma tags for SDXL / Pony / Illustrious.",
  "  Never camera MOVEMENT — it is a still.",
  "- MUSIC (MiniMax Music): lyrics with [section] tags plus a caption.",
  "- SPEECH: the words to be spoken.",
  "A PROMPTING GUIDE for the model that will actually run is appended below",
  "when a style is selected; follow it over these generalities.",
  "Reference pictures are <Picture 1>, <Picture 2> … in tray order, reference",
  "videos <Video 1..3>, reference sounds <Audio 1..3> (2.354.0: THE REFERENCE DOCK",
  "below lists them when there are any). Never write a FILE NAME as a tag (not",
  "<photo.png>). A video prompt that uses references starts with a mapping line per",
  "subject - \"<Subject 1> is the woman in <Picture 1>.\" - then says what each",
  "reference gives. Keep any tag the user gives you exactly as written; never",
  "invent numbers.",
  // 2.365.0 (Tim: "can u teach the llm to write a proper formatted prompt please"): speech in a video prompt
  "SPEECH in a video prompt: each spoken line inline, the emotion OUTSIDE the tags, the exact words inside with",
  "the language - she says with a bright smile, in the timbre of <Audio 1>, <d>[English] Thank you!</d> - a",
  "voice reference is its timbre only (never its words), give the speaker something silent to do after a",
  "short line, and end with ONE Sound line (\"Sound: only her line in <d>, then <ambience>.\"); never stack",
  "\"do not speak\" negatives.",
  "Be concise and concrete. When the user is still deciding, ask one focused",
  "question rather than presenting a menu.",
  "WHENEVER YOU GIVE A PROMPT, put it in a fenced code block on its own, and",
  "TAG THE FENCE WITH WHAT IT IS FOR — `image` when the user asked for a",
  "picture / image / photo / illustration, `video` when they asked for a",
  "video / clip / animation, `music` for a song, `speech` for words to say:",
  "```image",
  "the prompt text",
  "```",
  "The app reads that tag: it switches Basic Settings to the matching mode",
  "(image or video) and puts the prompt in the prompt box, ready to Generate.",
  "An untagged fence is treated as the current mode. Decide the kind from",
  "the request, not from the current mode: in chat mode a request for a",
  "picture is an `image` fence written for the selected image style's guide,",
  "a request for a video is a `video` fence written for MiniMax H3.",
  "with nothing else inside the fence. The app turns each fenced block into a",
  "block the user can render from with one click, so a prompt outside a fence",
  "costs them a copy and paste, and commentary inside one gets rendered as if",
  "it were part of the prompt. Anything that is not a prompt — a question, an",
  "explanation, a choice — stays outside the fence as ordinary text.",
].join("\n");

/* What the user has SELECTED right now, appended to the system prompt so the
   assistant writes prompts for the model that will actually run (2.92.0, by
   instruction: "give the chat assistant information about the style of video
   or photo or music we have selected. guide it to build the prompt designed
   for the specific model"). The client sends ids with every message because
   the selection lives in the browser; the style BODIES are read here because
   the server owns the styles folder and a client copy could be stale. Returns
   "" when there is nothing to say, so the base prompt is unchanged. */
function selectionContext(stylesDir, ctx, userText) {
  const c = ctx || {};
  let styles;
  try { styles = require("./styles"); } catch { return ""; }
  const pick = (id) => {
    if (!id) return null;
    try { return styles.byId(stylesDir, String(id)); } catch { return null; }
  };
  const lines = [];
  const mode = String(c.gen_mode || "").trim();
  if (mode) lines.push(`- The Generate button is set to: ${mode.toUpperCase()}.`);
  const img = pick(c.image_style_id);
  if (img) {
    lines.push(`- Selected IMAGE style: "${img.name}" (arch ${img.arch || "?"}`
      + `${img.model ? `, model ${img.model}` : ""}`
      + `${img.steps ? `, ${img.steps} steps` : ""}).`);
    // 2.104.0: the guide for THIS family (pony/illustrious by file name)
    const g = guides.guideFor(stylesDir, { kind: "image", arch: img.arch, model: img.model });
    if (g) lines.push("  " + g.replace(/\n/g, "\n  "));
  }
  const mu = pick(c.music_style_id);
  if (mu) {
    lines.push(`- Selected MUSIC style: "${mu.name}" (arch ${mu.arch || "?"}`
      + `${mu.max_duration ? `, up to ${mu.max_duration}s of song` : ""}).`);
    const cap = String(mu.caption || "").trim();
    if (cap) {
      lines.push("  Its caption — the SOUND of this style. Write lyrics that fit it:");
      lines.push("  " + (cap.length > 400 ? cap.slice(0, 400) + "…" : cap)
        .replace(/\n/g, "\n  "));
    }
    const g = guides.guideFor(stylesDir, { kind: "music", arch: mu.arch, model: "" });
    if (g) lines.push("  " + g.replace(/\n/g, "\n  "));
  }
  // the video guide travels when video is what the button makes — and in
  // CHAT mode too, where the next request may be for a video (2.114.0)
  if (mode === "video" || mode === "chat") {
    // 2.419.0: the guide for the selected VIDEO style's model (LTX / Wan write a "Negative:" line - the ⊖ docker), H3 by default
    const vs = pick(c.video_style_id);
    const varch = vs ? (vs.ltx || /ltx/i.test(String(vs.arch || "")) ? "ltx" : String(vs.arch || "h3")) : "h3";
    if (vs) lines.push(`- Selected VIDEO style: "${vs.name}" (arch ${vs.arch || "?"}).`);
    const g = guides.guideFor(stylesDir, { kind: "video", arch: varch, model: vs ? String(vs.name || "") : "" });
    if (g) lines.push(g);
    // 2.118.0 (Tim): SBS VR asked for IN THE USER'S OWN WORDS gets the VR
    // addendum (no mirror, stereo-pair rules) riding with the video guide
    const ax = guides.addendaFor(stylesDir, "video", userText);
    if (ax) lines.push(ax);
  }
  if (!lines.length) return "";
  return "\n\nCURRENT SELECTION (what the user's next render will use):\n"
    + lines.join("\n");
}

/** The picked local model's on-disk size in GiB, split parts summed
 *  (name-00001-of-00003.gguf siblings share one model). Resolution mirrors
 *  complete(): the caller's llm_file, else the RUNNING model, else the
 *  first .gguf. 0 on any failure or when no local file is involved — an
 *  external endpoint has no size to measure. (2.174.0, "clear the chat
 *  context when using models >12gb".) */
function modelSizeGb(core, llm_file) {
  try {
    let file = llm_file;
    if (!file && typeof core.llamaState === "function") {
      const st = core.llamaState() || {};
      if (st.file) file = st.file;
    }
    const { dir } = core.llmPaths();
    if (!file) {
      const files = fs.readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith(".gguf")).sort();
      if (!files.length) return 0;
      file = files[0];
    }
    const base = path.basename(String(file));
    const m = /^(.*)-\d{5}-of-(\d{5})\.gguf$/i.exec(base);
    const parts = m
      ? fs.readdirSync(dir).filter((f) =>
          new RegExp(`^${m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
            + `-\\d{5}-of-${m[2]}\\.gguf$`, "i").test(f))
      : [base];
    let bytes = 0;
    for (const p of parts) bytes += fs.statSync(path.join(dir, p)).size;
    return bytes / (1024 ** 3);
  } catch { return 0; }
}

const USAGE = { in: 0, out: 0, calls: 0 };        // 2.256.0: since app start
function usage() { return { ...USAGE }; }

module.exports = { complete, readReply, stripThinking, CHAT_SYSTEM, selectionContext, modelSizeGb, alternate, usage };
