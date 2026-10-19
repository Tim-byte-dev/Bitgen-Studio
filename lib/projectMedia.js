// bitGen Studio — EVERY PICTURE, SONG AND VIDEO IN THE PROJECT (2.298.0).
//
// Tim (verbatim): "scan the projects subfolders for images and music and
// videos before adding it to a dropdown. scan for assets, characters,
// locations etc."
//
// The media dropdowns used to list only the three flat asset folders
// (projects/<p>/{images,video,sound}), so a character sheet, a location
// view, a reference, a stem, a song the writer saved or a gallery render
// never showed up in them. scan() walks the WHOLE project folder and
// groups what it finds by where it lives:
//   Assets · Gallery · Characters · <name> · Locations · <name> ·
//   References · Scene pictures · Songs · Voices · <other folder>
// Working folders (temp, chat, timelines, caches) are skipped. A pick from
// outside the asset folders is ADOPTED (lib/adopt - a hard link, copy as
// the fallback, a clash uniquified, never overwritten) so every consumer
// that resolves a media NAME inside its asset folder keeps working exactly
// as before.
const fs = require("fs");
const path = require("path");
const core = require("./core");
const adoptLib = require("./adopt");

const KINDS = core.PKINDS;                     // images / video / sound extensions
const ASSET_DIRS = { images: "images", video: "video", sound: "sound" };
const SKIP = new Set(["temp", "chat", "timelines", "jobs", "cache", "framecache",
                      "node_modules", ".git", "__pycache__", "venv", ".venv"]);
const MAX_DEPTH = 6, MAX_PER_KIND = 3000;

function kindOfFile(name) {
  const ext = path.extname(String(name)).toLowerCase();
  for (const [k, exts] of Object.entries(KINDS)) if (exts.includes(ext)) return k;
  return null;
}

function title(s) { return String(s).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

/** Folder id -> display name for characters (<id>/<Name>.profile) and
 *  locations (<slug>/env.json "name"). */
function namesOf(root) {
  const names = {};
  try {
    for (const d of fs.readdirSync(path.join(root, "characters"), { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const prof = (fs.readdirSync(path.join(root, "characters", d.name))
        .find((f) => f.endsWith(".profile")) || "");
      if (prof) names["characters/" + d.name] = prof.slice(0, -".profile".length);
    }
  } catch { /* no characters */ }
  try {
    for (const d of fs.readdirSync(path.join(root, "environments"), { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(root, "environments", d.name, "env.json"), "utf8"));
        if (j && j.name) names["environments/" + d.name] = String(j.name);
      } catch { /* no env.json */ }
    }
  } catch { /* no locations */ }
  return names;
}

/** The group a project-relative path belongs to. */
function groupOf(rel, names) {
  const parts = rel.split(/[\\/]/);
  const top = parts.length > 1 ? parts[0] : "";
  const who = parts.length > 2 ? ((names || {})[top + "/" + parts[1]] || title(parts[1])) : "";
  if (["images", "video", "sound"].includes(top)) return "Assets";
  if (!top || top === "output" || top === "final") return "Gallery";
  if (top === "characters") return "Characters" + (who ? " · " + who : "");
  if (top === "environments") return "Locations" + (who ? " · " + who : "");
  if (top === "reference" || top === "references") return "References";
  if (top === "scene_refs") return "Scene pictures";
  return title(top);
}

const GROUP_ORDER = ["Assets", "Gallery", "Characters", "Locations", "References",
                     "Scene pictures", "Songs", "Voices"];
function groupRank(g) {
  const i = GROUP_ORDER.findIndex((x) => g === x || g.startsWith(x + " · "));
  return i < 0 ? GROUP_ORDER.length : i;
}

/** Walk the project: {images: [...], video: [...], sound: [...]}, each
 *  entry {name, rel, group, asset}. `asset` = it already IS an asset (the
 *  name every existing consumer understands). */
function scan(project) {
  const root = core.projDir(project || core.getProject());
  const out = { images: [], video: [], sound: [] };
  const names = namesOf(root);
  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH) return;
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith(".")) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth === 0 && SKIP.has(e.name)) continue;
        if (SKIP.has(e.name)) continue;
        walk(abs, depth + 1);
        continue;
      }
      const k = kindOfFile(e.name);
      if (!k || out[k].length >= MAX_PER_KIND) continue;
      const rel = path.relative(root, abs).split(path.sep).join("/");
      const top = rel.split("/")[0];
      out[k].push({ name: e.name, rel, group: groupOf(rel, names),
                    asset: rel.split("/").length === 2 && top === ASSET_DIRS[k] });
    }
  };
  walk(root, 0);
  // a finished render is auto-registered as an asset (a hard link of the
  // same file) - list it once, as the asset
  for (const k of Object.keys(out)) {
    const assets = new Set(out[k].filter((x) => x.asset).map((x) => x.name));
    out[k] = out[k].filter((x) => !(x.group === "Gallery" && assets.has(x.name)));
  }
  for (const k of Object.keys(out))
    out[k].sort((a, b) => groupRank(a.group) - groupRank(b.group)
      || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  return out;
}

/** A project-relative media path -> its absolute path, or null when it
 *  leaves the project, is not media, or is gone. */
function resolve(project, rel) {
  const root = core.projDir(project || core.getProject());
  const r = String(rel || "").replace(/\\/g, "/");
  if (!r || r.startsWith("/") || r.split("/").includes("..")) return null;
  const abs = path.resolve(root, r);
  if (!abs.startsWith(root + path.sep)) return null;
  if (!kindOfFile(abs) || !fs.existsSync(abs)) return null;
  return abs;
}

/** Make a picked media file an ASSET of its kind (a hard link, copy as the
 *  fallback) and answer the asset name: {ok, name, kind, how}. An asset
 *  answers its own name. */
function adopt(project, rel) {
  const abs = resolve(project, rel);
  if (!abs) return { ok: false, error: `${rel} is not a picture, song or video in this project` };
  const kind = kindOfFile(abs);
  const root = core.projDir(project || core.getProject());
  const assetDir = path.join(root, ASSET_DIRS[kind]);
  if (path.dirname(abs) === assetDir) return { ok: true, name: path.basename(abs), kind, how: "asset" };
  const r = adoptLib.adopt(path.basename(abs), {
    kinds: KINDS, hint: kind, searchDirs: [path.dirname(abs)],
    dirs: { images: path.join(root, "images"), video: path.join(root, "video"),
            sound: path.join(root, "sound") } });
  return r.ok ? { ok: true, name: r.name, kind: r.kind, how: r.how }
    : { ok: false, error: r.error };
}

/** The group label for one project path, with real character / location names. */
function groupFor(project, rel) {
  return groupOf(String(rel || "").replace(/\\/g, "/"), namesOf(core.projDir(project || core.getProject())));
}

module.exports = { scan, resolve, adopt, groupOf, groupFor, kindOfFile, SKIP };
