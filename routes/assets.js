// bitGen Studio — ASSET GROUPS + asset delete routes (2.327.0; 2.635.0: groups are FOLDERS of the Global / Project
// Assets folders - lib/assetLibrary.js). Mounted from routes/index.js (never server.js); the bin is lib/recycleBin.js,
// the Assets dock UI is static/assetgroups.js.
//
//   GET  /api/passets/groups?scope=project|global|all   the groups: [{id "p:<folder>" | "g:<folder>", name, scope, items}]
//   POST /api/passets/groups            {op: create|rename|delete|add|send|ungroup, scope,
//                                        id, name, items: [{kind, name, from}], from}  (send = move the file into the
//                                        folder, add = link it there too, ungroup = back to the Assets folder itself)
//   POST /api/passets/scope             {items, to: global|project} - Move to Global / Move to Project
//   POST /api/passets/usage             {items} -> which are still named in
//                                       the project file (asked before a delete)
//   POST /api/passets/recycle           {items} -> moved to projects/<p>/recycle_bin
//                                       and dropped from every group
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const trap = require("../lib/trap");
const groups = require("../lib/assetGroups");
const recycleBin = require("../lib/recycleBin");

const lib = require("../lib/assetLibrary");

const projDir = () => core.projDir(core.getProject());
/* 2.635.0 (Tim: "add a dropdown to the top of assets dialog, Global, Project or All, global assets will be kept in project
   root/Assets, project assets will be kept in project name/Assets, folders in the assets folders will be a group" +
   "new uploads live in project name/assets, right click context menu will have "move to Global""): the groups are the
   FOLDERS of <projects root>/Assets (global) and projects/<name>/Assets (project) - lib/assetLibrary.js. The 2.327.0
   asset_groups.json becomes folders the first time (migrate). */
function ctx() {
  const c = lib.forCore(core);
  try { lib.migrate(c, projDir()); } catch (e) { console.log("[assets] the old groups could not be turned into folders: " + (e.message || e)); }
  return c;
}
const scopeOf = (q) => (["global", "project", "all"].includes(String(q || "")) ? String(q) : "all");

function mount(app) {
  app.get("/api/passets/groups", (req, res) => res.json({ groups: lib.groups(ctx(), scopeOf(req.query.scope)) }));

  app.post("/api/passets/groups", trap.guard((req, res) => {
    const b = req.body || {}, c = ctx(), scope = scopeOf(b.scope);
    const list = groups.items(b.items);
    const op = String(b.op || "");
    const at = lib.splitId(b.id);
    let r = {}, made = null;
    if (op === "create") {
      const s = b.scope === "global" ? "g" : "p";
      r = lib.create(c, s, b.name); made = r.id;
      // the selection moves in from where each was picked (its `from`: a group id, "" = ungrouped)
      if (!r.error) for (const raw of Array.isArray(b.items) ? b.items : []) {
        const it = groups.items([raw])[0]; if (!it) continue;
        const x = lib.place(c, it, s, lib.splitId(r.id).group, "move", raw.from === undefined ? "" : String(raw.from || ""));
        if (x.error) { r = x; break; }
      }
    } else if (op === "rename") { r = lib.rename(c, b.id, b.name); made = r.id; }
    else if (op === "delete") r = lib.remove(c, b.id);
    else if (op === "add" || op === "send" || op === "ungroup") {
      if (!at) r = { error: "no such group" };
      else for (const it of list) {
        const x = op === "add" ? lib.place(c, it, at.s, at.group, "copy")
          : op === "send" ? lib.place(c, it, at.s, at.group, "move", b.from === undefined ? undefined : String(b.from || ""))
          : lib.place(c, it, at.s, "", "move", b.id);
        if (x.error) { r = x; break; }
      }
    } else r = { error: "op must be create, rename, delete, add, send or ungroup" };
    const gs = lib.groups(c, scope);
    if (r.error) return res.status(400).json({ error: r.error, groups: gs });
    res.json({ ok: true, groups: gs, group: made ? gs.find((g) => g.id === made) : undefined });
  }));

  /** Move to Global / Move to Project (the tile's right-click menu): {items, to: "global" | "project"} */
  app.post("/api/passets/scope", trap.guard((req, res) => {
    const b = req.body || {}, c = ctx(), list = groups.items(b.items);
    if (!list.length) return res.status(400).json({ error: "nothing to move" });
    if (!["global", "project"].includes(b.to)) return res.status(400).json({ error: "to must be global or project" });
    const moved = [], failed = [];
    for (const it of list) { const r = lib.moveScope(c, it, b.to); if (r.error) failed.push({ ...it, error: r.error }); else moved.push(it); }
    res.json({ ok: !failed.length, moved, failed, groups: lib.groups(c, scopeOf(b.scope)) });
  }));

  app.post("/api/passets/usage", (req, res) => {
    let prj = "";
    try { prj = fs.readFileSync(core.prjPath(core.getProject()), "utf8"); } catch {}
    res.json({ inUse: groups.usage(prj, (req.body || {}).items) });
  });

  app.post("/api/passets/recycle", trap.guard((req, res) => {
    const b = req.body || {}, list = groups.items(b.items), c = ctx();
    if (!list.length) return res.status(400).json({ error: "nothing to delete" });
    const moved = [], missing = [];
    let to = null;
    for (const it of list) {
      const r = lib.recycle(c, it, (p) => recycleBin.recycle(p));
      if (r.missing) { missing.push(it); continue; }
      to = r.to || to;
      moved.push({ ...it, as: r.name });
    }
    res.json({ ok: true, moved, missing, to: to || recycleBin.binDir(), groups: lib.groups(c, scopeOf(b.scope)) });
  }));
}

module.exports = { mount };
