// bitGen Studio — ASSET GROUPS + asset delete routes (2.327.0). Mounted
// from routes/index.js (never server.js); the logic is lib/assetGroups.js,
// the bin is lib/recycleBin.js, the Assets dock UI is static/index.html.
//
//   GET  /api/passets/groups            the project's groups (items whose
//                                       file is gone are pruned)
//   POST /api/passets/groups            {op: create|rename|delete|add|send|ungroup,
//                                        id, name, items: [{kind, name}], from}
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

const projDir = () => core.projDir(core.getProject());
const fileOf = (it) => path.join(core.pDir(it.kind), path.basename(it.name));

function current() {
  const r = groups.prune(groups.load(projDir()), (it) => fs.existsSync(fileOf(it)));
  return r.dropped ? groups.save(projDir(), r.state) : r.state;
}

function mount(app) {
  app.get("/api/passets/groups", (_req, res) => res.json({ groups: current().groups }));

  app.post("/api/passets/groups", trap.guard((req, res) => {
    const b = req.body || {};
    const st = current();
    const list = groups.items(b.items).filter((it) => fs.existsSync(fileOf(it)));
    const op = String(b.op || "");
    const r = op === "create" ? groups.create(st, b.name, list)
      : op === "rename" ? groups.rename(st, b.id, b.name)
      : op === "delete" ? groups.remove(st, b.id)
      : op === "add" ? groups.add(st, b.id, list)
      : op === "send" ? groups.send(st, b.id, list, b.from)
      : op === "ungroup" ? groups.ungroup(st, b.id, list)
      : { state: st, error: "op must be create, rename, delete, add, send or ungroup" };
    if (r.error) return res.status(400).json({ error: r.error, groups: st.groups });
    const saved = groups.save(projDir(), r.state);
    res.json({ ok: true, groups: saved.groups, group: r.group ? saved.groups.find((g) => g.id === r.group.id) : undefined });
  }));

  app.post("/api/passets/usage", (req, res) => {
    let prj = "";
    try { prj = fs.readFileSync(core.prjPath(core.getProject()), "utf8"); } catch {}
    res.json({ inUse: groups.usage(prj, (req.body || {}).items) });
  });

  app.post("/api/passets/recycle", trap.guard((req, res) => {
    const list = groups.items((req.body || {}).items);
    if (!list.length) return res.status(400).json({ error: "nothing to delete" });
    const moved = [], missing = [];
    let to = null;
    for (const it of list) {
      const p = fileOf(it);
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) { missing.push(it); continue; }
      const r = recycleBin.recycle(p);
      to = r.to;
      moved.push({ ...it, as: r.name });
    }
    const saved = groups.save(projDir(), groups.forget(current(), list).state);
    res.json({ ok: true, moved, missing, to: to || recycleBin.binDir(), groups: saved.groups });
  }));
}

module.exports = { mount };
