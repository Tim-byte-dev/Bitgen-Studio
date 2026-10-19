// bitGen Studio — routes/recycleBin.js (2.374.0): the left dock's 🗑 Recycle bin dialog and ↺ Reset project.
//
// Tim: "add a recycle bin(icon only) button to the menubar in the left docker, create a dialog for the recycle
// bin, add a menubar to the dialog, restore, delete, empty buttons to the menubar. add a titlebar to the recycle
// bin dialog. add a reset button to the menubar in the left docker - delete the current project folder and
// re-create it from the original name and description - this needs a verify msgbox".
//
//   GET  /api/recyclebin                the current project's bin: [{name, from, guessed, at, size, kind}], total
//   GET  /api/recyclebin/file/:name     one binned file (the dialog's thumbnails / preview)
//   POST /api/recyclebin/restore        {names} -> back where each came from (lib/recycleBin.restore)
//   POST /api/recyclebin/delete         {names} -> deleted for good
//   POST /api/recyclebin/empty          every file in the bin deleted for good
//   POST /api/projects/reset            {name} (= the current project, the confirmation) -> the folder deleted and
//                                       re-created empty with its name and description (lib/projects.reset)
//                                       2.378.0: its jobs stopped + cleared, the folder moved aside first ->
//                                       {name, data, stopped, jobs_cleared, leftover?: [files still in use]}
//   (on start) lib/projectReset.sweepOnce: what a reset could not delete (in use) goes once nothing holds it
// The page asks before Delete, Empty and Reset (static/recyclebin.js).
const recycleBin = require("../lib/recycleBin");
const projects = require("../lib/projects");
const core = require("../lib/core");

const namesOf = (b) => (Array.isArray((b || {}).names) ? b.names : []).map((n) => String(n || "")).filter(Boolean);

function mount(app) {
  require("../lib/projectReset").sweepOnce();
  app.get("/api/recyclebin", (_req, res) => {
    try {
      const items = recycleBin.list();
      res.json({ project: core.getProject(), items, count: items.length,
                 size: items.reduce((s, e) => s + (e.size || 0), 0) });
    } catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
  });

  app.get("/api/recyclebin/file/:name", (req, res) => {
    const p = recycleBin.filePath(undefined, req.params.name);
    if (!p) return res.status(404).json({ error: "not in the recycle bin" });
    res.sendFile(p);
  });

  app.post("/api/recyclebin/restore", (req, res) => {
    const names = namesOf(req.body);
    if (!names.length) return res.status(400).json({ error: "pick something to restore" });
    try { res.json({ ok: true, ...recycleBin.restore(undefined, names) }); }
    catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
  });

  app.post("/api/recyclebin/delete", (req, res) => {
    const names = namesOf(req.body);
    if (!names.length) return res.status(400).json({ error: "pick something to delete" });
    try { res.json({ ok: true, ...recycleBin.remove(undefined, names) }); }
    catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
  });

  app.post("/api/recyclebin/empty", (_req, res) => {
    try { res.json({ ok: true, ...recycleBin.empty() }); }
    catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
  });

  app.post("/api/projects/reset", async (req, res) => {
    try { res.json({ ok: true, ...(await projects.reset((req.body || {}).name)) }); }
    catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
}

module.exports = { mount };
