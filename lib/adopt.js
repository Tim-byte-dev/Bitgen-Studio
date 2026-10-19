"use strict";
/**
 * adopt.js — pull a GALLERY file into the project's asset folders (2.70.0).
 *
 * THE GAP THIS CLOSES. The gallery lists `projects/<p>/{,output,final}`. The
 * reference dock and the timeline both address media BY NAME inside
 * `projects/<p>/{images,video,sound}` — POST /api/generate resolves
 * ref_videos/ref_audios with `path.join(core.pDir("video"), basename(n))` and
 * nothing else. So a name dragged out of the gallery is a name the generator
 * cannot find, and the failure is the worst kind: the job starts, the reference
 * is silently absent, and the render comes back subtly wrong rather than
 * refused. Adopting first makes the name true before it is ever handed on.
 *
 * WHY NOT JUST WIDEN THE GENERATE RESOLVER to search output/ too? Because then
 * a reference's identity depends on a search order that a later rename or a
 * same-named render can flip underneath it. One folder per kind, one name, one
 * file is the invariant the rest of the app is built on; this module upholds it
 * instead of adding an exception to it.
 *
 * HARD LINK, NOT COPY — the same reasoning as lib/autoAssets.js, and the same
 * helpers (sameFile/freeName) so the two cannot drift: output/ and video/ are
 * inside one project folder, therefore one volume, so a link is free and
 * instant where a copy would double a multi-gigabyte render on disk. Copy is
 * the fallback for network shares, exotic filesystems and permission refusals.
 *
 * ALREADY THERE IS A SUCCESS, NOT AN ERROR. v2.65.0 auto-registers finished
 * renders into the video assets, so the common case is that the gallery file
 * and the asset are ALREADY one set of bytes under one name. Reporting that as
 * a failure would make the normal path look broken; it reports how:"exists".
 *
 * A CLASH IS UNIQUIFIED, NEVER OVERWRITTEN — the rule POST /api/passets and
 * autoAssets both already follow. Overwriting an asset is silent data loss
 * twice over: the old file is gone AND every timeline clip still naming it now
 * plays different footage.
 *
 * PURE-ISH ON PURPOSE: every folder comes in through `opts`, so this is
 * testable without a project, a config or a running server (scripts/test-adopt.js).
 */
const fs = require("fs");
const path = require("path");
const auto = require("./autoAssets");

/**
 * THE ONE AMBIGUOUS EXTENSION. `.webp` is both a still format and one of this
 * app's VIDEO output formats (see the /api/outputs filter and enc_args in
 * worker.py), which is why lib/autoAssets.js deliberately files it under video
 * while core.PKINDS files it under images. Neither is wrong; the extension
 * genuinely does not answer the question.
 *
 * So the CALLER answers it: the UI knows which tab the item was showing in, and
 * passes that as `hint`. The hint is honoured ONLY here. For every other
 * extension the extension wins, because a hint of "sound" on a .png is a bug or
 * a forged request, not a preference worth obeying.
 */
const AMBIGUOUS = new Set([".webp"]);

/** Which asset column an extension belongs to, per the caller's kind table. */
function extKind(name, kinds) {
  const ext = path.extname(String(name || "")).toLowerCase();
  for (const [k, exts] of Object.entries(kinds || {}))
    if (Array.isArray(exts) && exts.includes(ext)) return k;
  return null;
}

/**
 * Resolve the destination kind from the extension plus an optional caller hint.
 * Exported so the tests can pin the .webp rule on its own.
 */
function kindFor(name, kinds, hint) {
  const ext = path.extname(String(name || "")).toLowerCase();
  const byExt = extKind(name, kinds);
  if (!byExt) return null;
  if (hint && AMBIGUOUS.has(ext) && Object.prototype.hasOwnProperty.call(kinds || {}, hint))
    return hint;
  return byExt;
}

/** First of `searchDirs` that actually holds this file, or null. */
function findSource(name, searchDirs) {
  const base = path.basename(String(name || ""));
  if (!base) return null;
  for (const d of searchDirs || []) {
    if (!d) continue;
    const p = path.join(d, base);
    try { if (fs.statSync(p).isFile()) return p; } catch { /* next */ }
  }
  return null;
}

/**
 * Adopt `name` into the matching asset folder.
 *
 * opts = {
 *   searchDirs: [...],                      where the gallery reads from
 *   dirs: { images, video, sound },         the asset folders
 *   kinds: { images:[".png",…], … },        core.PKINDS — the ONE extension table
 *   hint: "images"|"video"|"sound"|undefined
 * }
 *
 * Resolves to one of:
 *   { ok:true,  name, kind, how:"link"|"copy"|"exists", from }
 *   { ok:false, code:"missing"|"unsupported"|"no-dir"|"error", error }
 *
 * Never throws: it is called from a route that must answer with a reason, and
 * from a drag-and-drop handler where an exception is invisible to the user.
 */
function adopt(name, opts) {
  const o = opts || {};
  try {
    const base = path.basename(String(name || ""));
    // "." and ".." survive basename() and would name a directory.
    if (!base || base === "." || base === "..")
      return { ok: false, code: "missing", error: "no file name given" };

    const kind = kindFor(base, o.kinds, o.hint);
    if (!kind)
      return { ok: false, code: "unsupported",
               error: `unsupported file type ${path.extname(base) || "(none)"}` };

    const src = findSource(base, o.searchDirs);
    if (!src)
      return { ok: false, code: "missing",
               error: `${base} is not in this project's output folders` };

    const destDir = (o.dirs || {})[kind];
    if (!destDir)
      return { ok: false, code: "no-dir", error: `no asset folder for ${kind}` };

    fs.mkdirSync(destDir, { recursive: true });
    const direct = path.join(destDir, base);

    // The auto-registered case: same bytes, same name, nothing to do. Note the
    // src === direct guard — adopting something that is ALREADY an asset (a
    // drag from the asset dock that took the gallery path by mistake) must not
    // try to link a file onto itself.
    if (src === direct || (fs.existsSync(direct) && auto.sameFile(direct, src)))
      return { ok: true, name: base, kind, how: "exists", from: src };

    const use = fs.existsSync(direct) ? auto.freeName(destDir, base) : base;
    if (!use)
      return { ok: false, code: "error", error: `no free name for ${base}` };
    const dest = path.join(destDir, use);

    try {
      fs.linkSync(src, dest);
      return { ok: true, name: use, kind, how: "link", from: src };
    } catch (e) {
      try {
        fs.copyFileSync(src, dest);
        return { ok: true, name: use, kind, how: "copy", from: src,
                 linkError: e.code || String(e.message) };
      } catch (e2) {
        return { ok: false, code: "error", error: String(e2.message || e2) };
      }
    }
  } catch (e) {
    return { ok: false, code: "error", error: String(e.message || e) };
  }
}

module.exports = { adopt, kindFor, extKind, findSource, AMBIGUOUS };
