// bitGen Studio — THE ASSET LIBRARY: Global / Project assets in real "Assets" folders, a folder = a group (2.635.0).
//
// Tim (verbatim): "add a dropdown to the top of assets dialog, Global, Project or All, global assets will be kept in
// project root/Assets, project assets will be kept in project name/Assets, folders in the assets folders will be a
// group" + (asked how Assets relates to the old images / video / sound folders): "new uploads live in project
// name/assets, right click context menu will have "move to Global"".
//
//   GLOBAL   <projects root>/Assets/[<group>/]file      - every project sees them
//   PROJECT  projects/<name>/Assets/[<group>/]file      - this project's (new uploads land here)
//   A first-level folder in an Assets folder IS a group (one group can mix pictures, videos and sounds); files right in
//   Assets are ungrouped. Deeper folders belong to their first-level group.
//
// THE NAME RULE (why the old folders stay): ~190 places in the studio find an asset BY NAME in
// projects/<name>/{images,video,sound} (core.pDir). So every library file is also hard-linked (no extra disk space;
// a copy with the same time stamp where links are not possible) into the project's type folder under a WORKING NAME,
// and projects/<name>/asset_links.json remembers which library file is which working name:
//   { "p:<rel>": "<working name>", "g:<rel>": "<working name>" }      (p = project Assets, g = global Assets)
// Files only in the type folders (older projects, generated renders) are project assets with no group; grouping one
// links it into the library. A global asset is linked into a project when that project lists its global assets.
//
// Pure-ish: every function takes a context c = { proot, groot, pDir(kind), links, kindOf(ext) } (forCore() builds the
// studio's); routes/assets.js + routes/index.js (GET / POST /api/passets) are the HTTP skin; static/assetgroups.js the
// dock. Node: scripts/test-assetlib635.js.
"use strict";
const fs = require("fs");
const path = require("path");

const NAME = "Assets";
const LINKS = "asset_links.json";
const MAX_GROUP = 80;
const SCOPES = { p: "project", g: "global" };
const KINDS = ["images", "video", "sound"];

function forCore(core) {
  const pd = core.projDir(core.getProject());
  return { proot: path.join(pd, NAME), groot: path.join(core.PROJECTS_DIR, NAME), pDir: (k) => core.pDir(k),
           links: path.join(pd, LINKS), kindOf: core.kindOf };
}
const rootOf = (c, s) => (s === "g" ? c.groot : c.proot);
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const posix = (p) => p.split(path.sep).join("/");

/** the same file: one inode (a hard link), or a copy (same size, same time stamp to 2 s) */
function same(a, b) {
  let x, y;
  try { x = fs.statSync(a); y = fs.statSync(b); } catch { return false; }
  if (x.ino && x.ino === y.ino && x.dev === y.dev) return true;
  return x.size === y.size && Math.abs(x.mtimeMs - y.mtimeMs) < 2000;
}
/** a hard link (no extra space); else a copy with the source's time stamp (so same() still knows it) */
function linkOrCopy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try { fs.linkSync(src, dst); return "link"; }
  catch {
    fs.copyFileSync(src, dst);
    try { const st = fs.statSync(src); fs.utimesSync(dst, st.atime, st.mtime); } catch { /* the copy is what counts */ }
    return "copy";
  }
}
function moveFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try { fs.renameSync(src, dst); }
  catch { linkOrCopy(src, dst); fs.unlinkSync(src); }
}
/** "name.png" or "name (2).png" … - free in every one of dirs */
function freeName(dirs, name) {
  const ext = path.extname(name), stem = path.basename(name, ext);
  for (let n = 1; ; n++) {
    const cand = n === 1 ? name : `${stem} (${n})${ext}`;
    if (!dirs.some((d) => fs.existsSync(path.join(d, cand)))) return cand;
  }
}
function loadLinks(c) { try { const j = JSON.parse(fs.readFileSync(c.links, "utf8")); return j && typeof j === "object" ? j : {}; } catch { return {}; } }
function saveLinks(c, L) { fs.mkdirSync(path.dirname(c.links), { recursive: true }); fs.writeFileSync(c.links, JSON.stringify(L, null, 1)); }

/** the files of one Assets folder: [{s, rel, group, file, abs, kind}] (dot files / unknown types skipped) */
function scan(c, s) {
  const root = rootOf(c, s), out = [];
  const walk = (dir, relDir, depth) => {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { return; }
    for (const n of names.sort()) {
      if (n.startsWith(".")) continue;
      const abs = path.join(dir, n), rel = relDir ? relDir + "/" + n : n;
      if (isDir(abs)) { if (depth < 8) walk(abs, rel, depth + 1); continue; }
      const kind = c.kindOf(path.extname(n).toLowerCase());
      if (!kind) continue;
      out.push({ s, rel, group: relDir ? relDir.split("/")[0] : "", file: n, abs, kind });
    }
  };
  walk(root, "", 0);
  return out;
}
/** the group folders (even empty ones) */
function folders(c, s) {
  try { return fs.readdirSync(rootOf(c, s)).filter((n) => !n.startsWith(".") && isDir(path.join(rootOf(c, s), n))).sort((a, b) => a.localeCompare(b)); }
  catch { return []; }
}

/** every library file of `scopes` given its working name in the project's type folder (linked in when missing) */
function sync(c, scopes) {
  const L = loadLinks(c), out = [];
  let changed = false;
  for (const s of scopes) {
    const seen = new Set();
    for (const e of scan(c, s)) {
      const key = s + ":" + e.rel, dir = c.pDir(e.kind);
      seen.add(key);
      let name = L[key];
      if (!(name && same(e.abs, path.join(dir, name)))) {
        if (same(e.abs, path.join(dir, e.file))) name = e.file;
        else { name = freeName([dir], e.file); linkOrCopy(e.abs, path.join(dir, name)); }
        L[key] = name; changed = true;
      }
      out.push(Object.assign({}, e, { name }));
    }
    for (const k of Object.keys(L)) if (k.startsWith(s + ":") && !seen.has(k)) { delete L[k]; changed = true; }
  }
  if (changed) saveLinks(c, L);
  return { entries: out, links: L };
}

/** the dock's lists for a scope: project | global | all -> {images: [{name, scope, group, rel}], video, sound} */
function list(c, scope) {
  const scopes = scope === "global" ? ["g"] : scope === "project" ? ["p"] : ["p", "g"];
  const { entries, links } = sync(c, scopes);
  const out = { images: [], video: [], sound: [] }, used = new Set(Object.values(links));
  for (const e of entries) out[e.kind].push({ name: e.name, scope: SCOPES[e.s], group: e.group, rel: e.rel });
  if (scope !== "global") {
    // the type folders' own files (older projects, renders saved straight there): project assets, no group
    for (const k of KINDS) {
      let names = [];
      try { names = fs.readdirSync(c.pDir(k)); } catch { /* none yet */ }
      for (const n of names) if (!used.has(n) && !n.startsWith(".") && isFile(path.join(c.pDir(k), n))) out[k].push({ name: n, scope: "project", group: "", rel: "" });
    }
  }
  return out;
}

/** the groups (folders) of a scope as the dock knows them: [{id "p:<folder>" | "g:<folder>", name, scope, items: [{kind, name}]}] */
function groups(c, scope) {
  const scopes = scope === "global" ? ["g"] : scope === "project" ? ["p"] : ["p", "g"];
  const { entries } = sync(c, scopes), out = [];
  for (const s of scopes) {
    for (const f of folders(c, s)) {
      const seen = new Set(), items = [];
      for (const e of entries) if (e.s === s && e.group === f && !seen.has(e.kind + "/" + e.name)) { seen.add(e.kind + "/" + e.name); items.push({ kind: e.kind, name: e.name }); }
      out.push({ id: s + ":" + f, name: f, scope: SCOPES[s], items });
    }
  }
  return out;
}

/** "p:<folder>" | "g:<folder>" ("p:" / "g:" = that Assets folder itself, ungrouped) */
const splitId = (id) => { const m = /^([pg]):(.*)$/.exec(String(id || "")); return m ? { s: m[1], group: m[2] } : null; };
function groupName(name) {
  const n = String(name == null ? "" : name).trim();
  if (!n) return { error: "a group needs a name" };
  if (n.length > MAX_GROUP) return { error: `a group name is at most ${MAX_GROUP} characters` };
  if (/[\\/:*?"<>|]/.test(n) || n.startsWith(".")) return { error: "a group name cannot contain \\ / : * ? \" < > | or start with a dot" };
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(n)) return { error: `"${n}" is reserved by Windows - pick another name` };
  return { name: n };
}
/** the library files that ARE this item (by working name), optionally only in scope s */
function where(c, it, s) {
  const { entries } = sync(c, s ? [s] : ["p", "g"]);
  return entries.filter((e) => e.kind === it.kind && e.name === path.basename(String(it.name || "")));
}

function create(c, s, name) {
  const g = groupName(name);
  if (g.error) return g;
  if (folders(c, s).some((f) => f.toLowerCase() === g.name.toLowerCase())) return { error: `there is already a group called "${g.name}"` };
  fs.mkdirSync(path.join(rootOf(c, s), g.name), { recursive: true });
  return { id: s + ":" + g.name };
}
function rename(c, id, name) {
  const at = splitId(id); if (!at || !at.group || !isDir(path.join(rootOf(c, at.s), at.group))) return { error: "no such group" };
  const g = groupName(name); if (g.error) return g;
  if (g.name !== at.group && folders(c, at.s).some((f) => f.toLowerCase() === g.name.toLowerCase() && f !== at.group)) return { error: `there is already a group called "${g.name}"` };
  const root = rootOf(c, at.s);
  if (g.name.toLowerCase() === at.group.toLowerCase() && g.name !== at.group) {   // a case-only rename (Windows): through a temp name
    const tmp = path.join(root, ".rename-" + Date.now()); fs.renameSync(path.join(root, at.group), tmp); fs.renameSync(tmp, path.join(root, g.name));
  } else fs.renameSync(path.join(root, at.group), path.join(root, g.name));
  const L = loadLinks(c), pre = at.s + ":" + at.group + "/";
  for (const k of Object.keys(L)) if (k.startsWith(pre)) { L[at.s + ":" + g.name + "/" + k.slice(pre.length)] = L[k]; delete L[k]; }
  saveLinks(c, L);
  return { id: at.s + ":" + g.name };
}
/** delete a GROUP: its files go back to the Assets folder itself (ungrouped) - nothing is deleted */
function remove(c, id) {
  const at = splitId(id); if (!at || !at.group) return { error: "no such group" };
  const root = rootOf(c, at.s), dir = path.join(root, at.group);
  if (!isDir(dir)) return { error: "no such group" };
  const L = loadLinks(c);
  for (const e of scan(c, at.s).filter((x) => x.group === at.group)) {
    const key = at.s + ":" + e.rel, name = L[key];
    if (isFile(path.join(root, e.file)) && same(e.abs, path.join(root, e.file))) fs.unlinkSync(e.abs);
    else { const n = freeName([root], e.file); moveFile(e.abs, path.join(root, n)); if (name) L[at.s + ":" + n] = name; }
    delete L[key];
  }
  saveLinks(c, L);
  fs.rmSync(dir, { recursive: true, force: true });
  return {};
}
/** put an item into scope s, group ("" = ungrouped): mode "move" (out of `from` - a group id, "" = ungrouped, or any
    place it has in another scope) or "copy" (also there). An item with no library file yet (a type-folder file) is
    linked in. */
function place(c, it, s, group, mode, from) {
  const kind = it.kind, name = path.basename(String(it.name || ""));
  if (!KINDS.includes(kind) || !name) return { error: "not an asset" };
  const dst = group ? path.join(rootOf(c, s), group) : rootOf(c, s);
  if (group && !isDir(dst)) return { error: "no such group" };
  const all = where(c, it);
  const work = path.join(c.pDir(kind), name);
  let src = null;
  if (mode === "move") {
    const f = from === undefined || from === null ? null : splitId(from);
    src = f ? all.find((e) => e.s === f.s && e.group === f.group)
      : from === "" ? (all.find((e) => e.s === s && e.group === "") || all.find((e) => e.group === "") || all.find((e) => e.s !== s))
      : all.find((e) => e.s !== s);
  }
  const from0 = src ? src.abs : (all[0] && all[0].abs) || (isFile(work) ? work : null);
  if (!from0) return { error: name + ": the file is gone" };
  if (src && path.dirname(src.abs) === dst) return {};                       // already there
  const L = loadLinks(c);
  let file = path.basename(from0);
  if (isFile(path.join(dst, file)) && same(from0, path.join(dst, file))) {    // the same file is there already
    if (src) { fs.unlinkSync(src.abs); delete L[src.s + ":" + src.rel]; }
  } else {
    file = freeName([dst], file);
    if (src) { moveFile(src.abs, path.join(dst, file)); delete L[src.s + ":" + src.rel]; }
    else linkOrCopy(from0, path.join(dst, file));
  }
  L[s + ":" + (group ? group + "/" : "") + file] = name;
  saveLinks(c, L);
  return {};
}
/** Move to Global / Move to Project: every library place of the item in the other scope moves across (its group kept);
    a type-folder-only file is linked into the target's Assets folder */
function moveScope(c, it, to) {
  const s = to === "global" || to === "g" ? "g" : "p", o = s === "g" ? "p" : "g";
  const mine = where(c, it, o);
  if (!mine.length) {
    if (where(c, it, s).length) return {};
    if (s === "g" && !isFile(path.join(c.pDir(it.kind), path.basename(String(it.name || ""))))) return { error: it.name + ": the file is gone" };
    return place(c, it, s, "", "copy");
  }
  for (const e of mine) {
    if (e.group && !isDir(path.join(rootOf(c, s), e.group))) fs.mkdirSync(path.join(rootOf(c, s), e.group), { recursive: true });
    const r = place(c, it, s, e.group, "move", e.s + ":" + e.group);
    if (r.error) return r;
  }
  return {};
}
/** delete: the working file goes to the recycle bin (recycle(abs)), its library places are unlinked */
function recycle(c, it, recycleFn) {
  const name = path.basename(String(it.name || "")), work = path.join(c.pDir(it.kind), name);
  const all = where(c, it), L = loadLinks(c);
  let r = null;
  if (isFile(work)) r = recycleFn(work);
  else if (all[0]) { r = recycleFn(all[0].abs); all.shift(); }
  else return { missing: true };
  for (const e of all) { try { fs.unlinkSync(e.abs); } catch { /* gone */ } delete L[e.s + ":" + e.rel]; }
  for (const k of Object.keys(L)) if (L[k] === name && c.kindOf(path.extname(name).toLowerCase()) === it.kind) delete L[k];
  saveLinks(c, L);
  return r || {};
}
/** a new upload (a file already on disk, e.g. multer's temp file): into the project's (or global) Assets folder, linked
    into the type folder under the SAME name (free in both) -> {name, kind} */
function adoptUpload(c, tmpPath, origName, s) {
  const kind = c.kindOf(path.extname(origName).toLowerCase());
  if (!kind) { const e = new Error("unsupported file type " + path.extname(origName)); e.status = 400; throw e; }
  const root = rootOf(c, s === "g" ? "g" : "p"), dir = c.pDir(kind);
  fs.mkdirSync(root, { recursive: true }); fs.mkdirSync(dir, { recursive: true });
  const name = freeName([root, dir], origName);
  moveFile(tmpPath, path.join(root, name));
  linkOrCopy(path.join(root, name), path.join(dir, name));
  const L = loadLinks(c); L[(s === "g" ? "g" : "p") + ":" + name] = name; saveLinks(c, L);
  return { name, kind };
}
/** the 2.327.0 groups (asset_groups.json) become folders once: each group -> a folder holding links to its files */
function migrate(c, projDir) {
  const f = path.join(projDir, "asset_groups.json");
  if (!isFile(f)) return 0;
  let st = null; try { st = JSON.parse(fs.readFileSync(f, "utf8")); } catch { st = null; }
  let n = 0;
  for (const g of (st && Array.isArray(st.groups) ? st.groups : [])) {
    const gn = groupName(g && g.name); if (gn.error) continue;
    if (!isDir(path.join(c.proot, gn.name))) fs.mkdirSync(path.join(c.proot, gn.name), { recursive: true });
    for (const it of Array.isArray(g.items) ? g.items : []) {
      if (!it || !KINDS.includes(it.kind) || !isFile(path.join(c.pDir(it.kind), path.basename(String(it.name || ""))))) continue;
      if (!place(c, { kind: it.kind, name: it.name }, "p", gn.name, "copy").error) n++;
    }
  }
  fs.renameSync(f, f.replace(/\.json$/, ".migrated.json"));
  return n;
}

module.exports = { NAME, LINKS, SCOPES, forCore, same, linkOrCopy, freeName, scan, folders, sync, list, groups, splitId, groupName,
                   where, create, rename, remove, place, moveScope, recycle, adoptUpload, migrate, loadLinks };
