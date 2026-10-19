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
 * Pure except the file helpers (setPic / delPic / picPath) and harvest(),
 * whose job table and slot setter are passed in.
 */
const fs = require("fs");
const path = require("path");

const BASES = ["auto", "location", "continue", "first"];
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
  return !s.prompt && !s.chars.length && !s.location && !s.props.length && !s.job && !s.status && s.base === "auto" && !s.style_id;
}

/** Which base `auto` means for this scene. o = {canContinue, hasLocation, hasFirst, nChars} */
function resolveBase(base, o) {
  const x = o || {};
  if (base && base !== "auto") return base;
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
  if (base === "location" && !x.locationPath) throw new Error("pick a location picture first (📍 Location)");
  if ((base === "continue" || base === "first") && !x.baseFile)
    throw new Error(base === "continue"
      ? "there is no frame to continue from yet - render the scene before this one (or pick a frame on its filmstrip)"
      : "this scene has no First picture to edit - choose one, or use a location");
  if (base === "character" && !chars.length) throw new Error("pick a character, a location picture or a frame to start from");
  if (!base) throw new Error("pick a character, a location picture or a frame to start from");

  if (base === "continue" || base === "first") {
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
  if (text) parts.push(text.charAt(0).toUpperCase() + text.slice(1).replace(/[.\s]+$/, "") + ".");
  else if (scene) parts.push(`The shot: ${scene.replace(/[.\s]+$/, "")}.`);
  parts.push("One single cinematic film frame - no text, no collage, no split screen, no borders.");
  if (images.length > 8) throw new Error(`Qwen 2.1 takes up to 8 pictures here - this scene would send ${images.length}`);
  return { images, roles, prompt: parts.join(" ").slice(0, MAX_TEXT), base };
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
  if (!["location", "prop"].includes(slot)) return { ok: false, error: "slot must be location or prop" };
  if (!srcPath || !fs.existsSync(srcPath)) return { ok: false, error: "the picture is not on disk" };
  if (slot === "prop" && s.props.length >= MAX_PROPS) return { ok: false, error: `a scene takes up to ${MAX_PROPS} props - remove one first` };
  fs.mkdirSync(dirAbs, { recursive: true });
  const ext0 = (path.extname(srcPath) || ".png").toLowerCase();
  const ext = IMG_RE.test("x" + ext0) ? ext0 : ".png";
  if (slot === "location") {
    if (s.location) try { fs.unlinkSync(path.join(dirAbs, s.location.file)); } catch {}
    const file = "qe_location" + ext;
    fs.copyFileSync(srcPath, path.join(dirAbs, file));
    s.location = { file, label: String(label || "").slice(0, 80) };
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
  if (slot === "location" && s.location) {
    try { fs.unlinkSync(path.join(dirAbs, s.location.file)); } catch {}
    s.location = null;
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
      q.error = job ? (d.reason ? d.reason(job) : "the edit failed") : "the job vanished (server restarted?)";
    }
    q.job = "";
    r.qedit = q;
    changed = true;
  }
  return changed;
}

module.exports = { BASES, MAX_CHARS, MAX_PROPS, MAX_TEXT, safe, isBlank, resolveBase, plan, propName, canvasFor,
                   picPath, setPic, delPic, harvest };
