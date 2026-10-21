"use strict";
/**
 * sceneEdit.js — ✎ FIRST FRAME (QWEN IMAGE 2.1) on every scene card (2.337.0).
 *
 * Tim: "can we use qwen2.1 to put the character in the location with the
 * props as first frame? make the image edit a dropdown accordian, second
 * scene can have same options as we already have, plus an option to edit the
 * image with qwen2.1 in the first image selector in each scene, this way we
 * can continue from the position but may change the location".
 *
 * A scene's `qedit` record (scenes.safe keeps it):
 *   { base, prompt, chars:[names], location:{file,label}|null,
 *     props:[{file,label}], style_id, job, status, error, at }
 * BASE = the picture Qwen EDITS (<image1>; the others are references):
 *   location  the location picture - the character(s) and props go INTO it
 *   continue  the frame this scene continues from (the previous take's last
 *             frame, or the frame picked on a filmstrip) - "continue from the
 *             position but may change the location": same pose, new place
 *   first     the scene's current First picture, edited
 *   auto      continue when the scene follows a rendered take, else the
 *             location, else the first character
 * The result becomes the scene's FIRST frame (lib/sceneRefs slot "first");
 * a Ref scene switches to First, since a Ref scene has no first frame.
 * Qwen 2.1 names its pictures <image1>..<image8> in the order they are
 * loaded; promptFor() writes those tags so the model knows which picture
 * plays which part.
 *
 *   picture   2.563.0 - PICTURE A: a reference picture the user picks (any scene's
 *             pictures, a frame of any take, a project picture, a file): its
 *             style, composition, camera framing and poses are kept exactly; the
 *             place is the 📍 location picture, else the location the scene /
 *             the global prompt names (its view picture), else Picture A's own
 * Tim (2.563.0): "in the scene frame in storyboard, allow user to add reference
 * images to each scene, include images from previous scenes. maybe we can use a
 * reference image as the start frame but keep location the same - we use the llm
 * to say, scene starts with "ref image we choose(picture a)", style, composition
 * and pose is exactly the same as (picture a), and we add reference image for our
 * new location, if location remains unchanged use the global prompts location".
 * 🤖 Write (llmMessages / cleanWritten): the LLM writes the whole instruction with
 * the <imageN> tags; a direction that uses the tags IS the instruction (plan()).
 *
 * Pure except the file helpers (setPic / delPic / picPath) and harvest(),
 * whose job table and slot setter are passed in.
 */
const fs = require("fs");
const path = require("path");

const BASES = ["auto", "picture", "location", "continue", "first"];
const MAX_CHARS = 3;
const MAX_PROPS = 3;
const MAX_TEXT = 1500;
const IMG_RE = /\.(png|jpe?g|webp|bmp|gif)$/i;
const STATUSES = ["", "running", "done", "failed"];

const pic = (x) => (x && x.file && /^qe_/.test(String(x.file))
  ? { file: path.basename(String(x.file)), label: String(x.label || "").slice(0, 80) } : null);

/** The stored record, normalised (unknown -> blank). */
function safe(q) {
  const x = q && typeof q === "object" ? q : {};
  return {
    base: BASES.includes(x.base) ? x.base : "auto",
    prompt: String(x.prompt || "").slice(0, MAX_TEXT),
    chars: (Array.isArray(x.chars) ? x.chars : []).map((s) => String(s || "").slice(0, 80)).filter(Boolean).slice(0, MAX_CHARS),
    location: pic(x.location),
    pica: pic(x.pica),                                         // 2.563.0: Picture A
    props: (Array.isArray(x.props) ? x.props : []).map(pic).filter(Boolean).slice(0, MAX_PROPS),
    style_id: String(x.style_id || "").slice(0, 64),
    job: String(x.job || ""),
    status: STATUSES.includes(x.status) ? x.status : "",
    error: String(x.error || "").slice(0, 400),
    at: Number.isFinite(+x.at) ? +x.at : 0,
  };
}

/** Is there anything worth storing? (keeps rows without a qedit clean) */
function isBlank(q) {
  const s = safe(q);
  return !s.prompt && !s.chars.length && !s.location && !s.pica && !s.props.length && !s.job && !s.status && s.base === "auto" && !s.style_id;
}

/** Which base `auto` means for this scene. o = {hasPicA, canContinue, hasLocation, hasFirst, nChars} */
function resolveBase(base, o) {
  const x = o || {};
  if (base && base !== "auto") return base;
  if (x.hasPicA) return "picture";                            // 2.563.0: a Picture A picked = start from it
  if (x.canContinue) return "continue";
  if (x.hasLocation) return "location";
  if (x.hasFirst) return "first";
  return x.nChars ? "character" : "";
}

/**
 * The pictures in load order + the prompt with Qwen 2.1's tags.
 * o = { base (resolved: location | continue | first | character), baseFile,
 *       chars:[{name, path}], locationPath, props:[{path, label}], text, sceneText }
 * -> { images:[paths], prompt, roles:[what each picture is] } or throws in words.
 */
function plan(o) {
  const x = o || {};
  const images = [], roles = [];
  const add = (p, role) => { images.push(p); roles.push(role); return `<image${images.length}>`; };
  const chars = (x.chars || []).filter((c) => c && c.path).slice(0, MAX_CHARS);
  const props = (x.props || []).filter((p) => p && p.path).slice(0, MAX_PROPS);
  const parts = [];
  let base = x.base;
  if (base === "picture" && !x.picAPath) throw new Error("pick Picture A first (🅰 Picture A - a picture of any scene, a frame, a project picture or a file)");
  if (base === "location" && !x.locationPath) throw new Error("pick a location picture first (📍 Location)");
  if ((base === "continue" || base === "first") && !x.baseFile)
    throw new Error(base === "continue"
      ? "there is no frame to continue from yet - render the scene before this one (or pick a frame on its filmstrip)"
      : "this scene has no First picture to edit - choose one, or use a location");
  if (base === "character" && !chars.length) throw new Error("pick a character, a location picture or a frame to start from");
  if (!base) throw new Error("pick a character, a location picture or a frame to start from");

  if (base === "picture") {                  // 2.563.0: Picture A - its look, its framing, its poses
    const ta = add(x.picAPath, "Picture A" + (x.picALabel ? ": " + x.picALabel : ""));
    parts.push(`This scene starts from ${ta} (Picture A): its style, composition, camera framing and the people's poses and positions stay exactly the same as in ${ta}.`);
    const pl = x.place || null;
    if (x.locationPath) {
      const tl = add(x.locationPath, "the new location");
      parts.push(`Move them into the location shown in ${tl}: replace the background, the set and the lighting with that place, keeping the people, their poses and the camera exactly as in ${ta}.`);
    } else if (pl && pl.path) {
      const tl = add(pl.path, `the location: ${pl.name || "the scene's place"}`);
      parts.push(`The place is ${pl.name || "the location"}, shown in ${tl}: set them there, keeping the people, their poses and the camera exactly as in ${ta}.`);
    } else if (pl && pl.name) parts.push(`The place is ${pl.name}; keep the people, their poses and the camera exactly as in ${ta}.`);
    else parts.push(`Keep the place in ${ta} as it is.`);
    for (const c of chars) {
      const tc = add(c.path, `character: ${c.name}`);
      parts.push(`The person who is ${c.name} must look exactly like the character in ${tc} - face, hair, body and outfit.`);
    }
  } else if (base === "continue" || base === "first") {
    const t1 = add(x.baseFile, base === "continue" ? "the frame this scene continues from" : "the scene's First picture");
    parts.push(`Keep the people in ${t1} exactly where they are: the same pose, position, expression and camera framing.`);
    if (x.locationPath) {
      const tl = add(x.locationPath, "the new location");
      parts.push(`Move them into the location shown in ${tl}: replace the background, the set and the lighting with that place, keeping the people and the camera where they are.`);
    }
    for (const c of chars) {
      const tc = add(c.path, `character: ${c.name}`);
      parts.push(`The person who is ${c.name} must look exactly like the character in ${tc} - face, hair, body and outfit.`);
    }
  } else if (base === "location") {
    const t1 = add(x.locationPath, "the location");
    const tags = chars.map((c) => add(c.path, `character: ${c.name}`));
    parts.push(tags.length
      ? `${t1} is the location. Place ${tags.map((t) => `the character from ${t}`).join(" and ")} in it.`
      : `${t1} is the location.`);
    if (tags.length) parts.push("Keep each character's face, hair, body and outfit exactly as in their picture.");
    parts.push(`Keep the place, its light and its camera angle as in ${t1}.`);
  } else {                                   // character: no place, no frame
    const tags = chars.map((c) => add(c.path, `character: ${c.name}`));
    parts.push(`A film still of ${tags.map((t) => `the character from ${t}`).join(" and ")}, keeping each character's face, hair, body and outfit exactly as in their picture.`);
  }
  for (const p of props) {
    const tp = add(p.path, `prop: ${p.label || path.basename(p.path)}`);
    parts.push(`Include the ${propName(p)} from ${tp}, the same object with the same look.`);
  }
  const text = String(x.text || "").trim();
  const scene = String(x.sceneText || "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (images.length > 8) throw new Error(`Qwen 2.1 takes up to 8 pictures here - this scene would send ${images.length}`);
  const END = "One single cinematic film frame - no text, no collage, no split screen, no borders.";
  // 2.563.0: a direction that names the pictures by their tags (🤖 Write, or typed so) IS the whole instruction
  if (isFull(text)) {
    const hi = Math.max(0, ...(text.match(/<image(\d+)>/g) || []).map((t) => +t.replace(/\D/g, "")));
    if (hi > images.length) throw new Error(`the direction names <image${hi}> but this frame sends ${images.length} picture(s) - write it again (🤖) or drop the tag`);
    return { images, roles, prompt: (text.replace(/[\s]+$/, "") + " " + END).slice(0, MAX_TEXT), base, full: true };
  }
  if (text) parts.push(text.charAt(0).toUpperCase() + text.slice(1).replace(/[.\s]+$/, "") + ".");
  else if (scene) parts.push(`The shot: ${scene.replace(/[.\s]+$/, "")}.`);
  parts.push(END);
  return { images, roles, prompt: parts.join(" ").slice(0, MAX_TEXT), base };
}

/** 2.563.0: a direction written with the pictures' tags is the whole instruction */
const isFull = (text) => /<image1>/.test(String(text || ""));

/** 2.563.0: the place a Picture A frame keeps when no 📍 location picture is picked - the location the scene's
 *  own text names (@tag), else one the global prompt names (its location_definitions / any @tag of a location),
 *  else the only location the project has. envs [{tag, name, view, pano}] -> the env or null */
function pickPlace(envs, sceneText, prefix) {
  const list = (envs || []).filter((e) => e && e.tag);
  const named = (txt) => list.find((e) => new RegExp("@" + String(e.tag).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w-])", "i").test(String(txt || "")));
  const pre = Array.isArray(prefix) ? prefix.join("\n") : String(prefix || "");
  return named(sceneText) || named(pre) || (list.length === 1 ? list[0] : null);
}

/** 2.563.0: 🤖 Write - the LLM's request. o = {base, roles: [what <image n> is], prefix, sceneText, notes} */
function llmMessages(o) {
  const x = o || {};
  const roles = (x.roles || []).map((r, i) => `<image${i + 1}> = ${r}`).join("\n");
  const pre = (Array.isArray(x.prefix) ? x.prefix.join("\n") : String(x.prefix || "")).trim().slice(0, 1800);
  const sys = "You write the instruction for an image-editing model that makes the FIRST FRAME of one scene of a film. "
    + "The pictures it gets are named <image1>, <image2> ... exactly as listed - refer to them ONLY by those tags. "
    + "Write 2 to 5 plain sentences (no lists, no quotes, no markdown, under 900 characters). "
    + (x.base === "picture"
      ? "Begin with: This scene starts from <image1> (Picture A): its style, composition, camera framing and the people's poses are exactly the same as in <image1>. "
        + "Then say where it takes place: if a location picture is listed, move them into that place keeping the poses and the camera; "
        + "if not, the place is the location the global prompt describes - say it in words; if the global prompt names no place, keep the place of <image1>. "
      : "Say which picture is the start, what stays exactly the same and what changes. ")
    + "Name each character picture's person and each prop by its tag. Then describe this scene's moment in one sentence. "
    + "Answer with the instruction only.";
  const user = `Pictures:\n${roles || "(none)"}\n\nGlobal prompt of the film:\n${pre || "(none)"}\n\nThis scene:\n`
    + `${String(x.sceneText || "").replace(/\s+/g, " ").trim().slice(0, 900) || "(no text)"}`
    + (x.notes ? `\n\nThe user's notes for this frame:\n${String(x.notes).slice(0, 600)}` : "");
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}

/** 2.563.0: the LLM's answer as a direction - no quotes / markdown, only the tags that exist, the length cap */
function cleanWritten(text, nImages) {
  let t = String(text || "").replace(/```[a-z]*\n?|```/gi, "").replace(/^\s*(instruction|prompt)\s*:\s*/i, "")
    .replace(/^["'“”]+|["'“”]+$/g, "").replace(/\*\*?/g, "").replace(/\s+/g, " ").trim();
  t = t.replace(/<image(\d+)>/gi, (m, d) => (+d >= 1 && +d <= (nImages || 0) ? `<image${+d}>` : "the picture"));
  return t.slice(0, MAX_TEXT - 120);
}

/** "red umbrella" from a prop's label / file name. */
function propName(p) {
  const raw = String((p && (p.label || p.path)) || "").replace(/^[^:]*:\s*/, "");
  const stem = path.basename(raw).replace(/\.[a-z0-9]+$/i, "").replace(/^qe_prop_\w+?_/, "")
    .replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return stem && !/^qe prop/i.test(stem) ? stem : "prop";
}

/** The canvas: the VIDEO's aspect at about one megapixel (Qwen 2.1's native
 *  budget), 16-px aligned - 960x544 -> 1360x768. The video renders from it at
 *  its own size, so the first frame is never smaller than the take. */
function canvasFor(w, h) {
  const W = parseInt(w, 10) > 0 ? parseInt(w, 10) : 960, H = parseInt(h, 10) > 0 ? parseInt(h, 10) : 544;
  const a = W / H, area = 1024 * 1024;
  const a16 = (v) => Math.max(256, Math.round(v / 16) * 16);
  return { width: a16(Math.sqrt(area * a)), height: a16(Math.sqrt(area / a)) };
}

/* ---- files: projects/<p>/scene_refs/<scene id>/qe_*.ext ---- */
function picPath(dirAbs, file) {
  const f = path.basename(String(file || ""));
  if (!/^qe_/.test(f) || !IMG_RE.test(f)) return null;
  const p = path.join(dirAbs, f);
  return fs.existsSync(p) ? p : null;
}

/** Put a picture in the scene's `location` (one) or `props` (up to 3). */
function setPic(dirAbs, q, slot, srcPath, label) {
  const s = safe(q);
  if (!["location", "prop", "pica"].includes(slot)) return { ok: false, error: "slot must be pica, location or prop" };
  if (!srcPath || !fs.existsSync(srcPath)) return { ok: false, error: "the picture is not on disk" };
  if (slot === "prop" && s.props.length >= MAX_PROPS) return { ok: false, error: `a scene takes up to ${MAX_PROPS} props - remove one first` };
  fs.mkdirSync(dirAbs, { recursive: true });
  const ext0 = (path.extname(srcPath) || ".png").toLowerCase();
  const ext = IMG_RE.test("x" + ext0) ? ext0 : ".png";
  if (slot === "location" || slot === "pica") {             // 2.563.0: Picture A is one picture too
    // (copied to a temp name first: the source may be this very slot's old file)
    const file = "qe_" + slot + ext, tmp = path.join(dirAbs, `qe_tmp_${Date.now()}${ext}`);
    fs.copyFileSync(srcPath, tmp);
    if (s[slot]) try { fs.unlinkSync(path.join(dirAbs, s[slot].file)); } catch {}
    fs.renameSync(tmp, path.join(dirAbs, file));
    s[slot] = { file, label: String(label || "").slice(0, 80) };
    return { ok: true, file, qedit: s };
  }
  const stem = path.basename(String(label || srcPath)).replace(/^[^:]*:\s*/, "").replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "prop";
  const file = `qe_prop_${Date.now().toString(36)}_${stem}${ext}`;
  fs.copyFileSync(srcPath, path.join(dirAbs, file));
  s.props.push({ file, label: String(label || "").slice(0, 80) });
  return { ok: true, file, qedit: s };
}

function delPic(dirAbs, q, slot, file) {
  const s = safe(q);
  if ((slot === "location" || slot === "pica") && s[slot]) {
    try { fs.unlinkSync(path.join(dirAbs, s[slot].file)); } catch {}
    s[slot] = null;
    return { ok: true, qedit: s };
  }
  if (slot === "prop") {
    const i = s.props.findIndex((p) => p.file === path.basename(String(file || "")));
    if (i < 0) return { ok: false, error: "no such prop on this scene" };
    try { fs.unlinkSync(path.join(dirAbs, s.props[i].file)); } catch {}
    s.props.splice(i, 1);
    return { ok: true, qedit: s };
  }
  return { ok: false, error: `this scene has no ${slot} picture` };
}

/**
 * A finished ✎ job -> the scene's First frame. d = { jobs (Map), outputPath(name),
 * setFirst(row, absPath, label) -> {ok,error}, reason(job) -> words }.
 * Mutates the rows; returns true when anything changed.
 */
function harvest(list, d) {
  let changed = false;
  for (const r of list || []) {
    if (!r || !r.qedit || !r.qedit.job) continue;
    const q = safe(r.qedit);
    const job = d.jobs.get(q.job);
    if (job && !job.finished) {
      if (q.status !== "running") { q.status = "running"; r.qedit = q; changed = true; }
      continue;
    }
    const src = job && job.status === "done" && job.output ? d.outputPath(job.output) : null;
    if (src && fs.existsSync(src)) {
      const out = d.setFirst(r, src, "✎ Qwen 2.1 first frame");
      if (out && out.ok) {
        q.status = "done"; q.error = "";
        if (!r.anchor || r.anchor === "reference") r.anchor = "first";
      } else { q.status = "failed"; q.error = (out && out.error) || "the frame could not be filed"; }
    } else {
      q.status = "failed";
      // 2.562.0: a job a restart took away - the row keeps its id; ↻ Resume in the Queue docker brings it back (lib/sceneResume)
      q.error = job ? (d.reason ? d.reason(job) : "the edit failed")
        : require("./sceneResume").lost(r, "qedit", q.job, d.resumable ? !!d.resumable(q.job) : false);
    }
    q.job = "";
    r.qedit = q;
    changed = true;
  }
  return changed;
}

module.exports = { BASES, MAX_CHARS, MAX_PROPS, MAX_TEXT, safe, isBlank, resolveBase, plan, propName, canvasFor, isFull, pickPlace, llmMessages, cleanWritten,
                   picPath, setPic, delPic, harvest };
