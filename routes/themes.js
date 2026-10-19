// bitGen Studio — saved themes (2.435.0). Mounted from routes/index.js (never server.js); the work is lib/themeStore.js.
//   GET  /api/themes                {themes: [...]}
//   GET  /api/themes/:name          one theme
//   POST /api/themes/save           {name, theme: {base, vars, accent, scale, scheme}} -> the saved record
//   POST /api/themes/delete         {name} -> {removed}
//   GET  /api/themes/tmp/:name      2.514.0: edit theme mode's working copy (themes/<name>.tmp) - 404 when none
//   POST /api/themes/tmp            {name, theme} -> the working copy written
//   POST /api/themes/tmp/delete     {name} -> {removed}
"use strict";
const themeStore = require("../lib/themeStore");
const fail = (res, e) => res.status(e.status || 500).json({ error: e.message });
function mount(app) {
  app.get("/api/themes", (_req, res) => { try { res.json({ themes: themeStore.list(), dir: "themes" }); } catch (e) { fail(res, e); } });
  app.get("/api/themes/tmp/:name", (req, res) => { try { res.json(themeStore.readTmp(req.params.name)); } catch (e) { fail(res, e); } });   // 2.514.0
  app.post("/api/themes/tmp", (req, res) => { try { const b = req.body || {}; res.json(themeStore.saveTmp(b.name, b.theme || {})); } catch (e) { fail(res, e); } });
  app.post("/api/themes/tmp/delete", (req, res) => { try { res.json(themeStore.removeTmp((req.body || {}).name)); } catch (e) { fail(res, e); } });
  app.get("/api/themes/:name", (req, res) => { try { res.json(themeStore.read(req.params.name)); } catch (e) { fail(res, e); } });
  app.post("/api/themes/save", (req, res) => { try { const b = req.body || {}; res.json(themeStore.save(b.name, b.theme || {})); } catch (e) { fail(res, e); } });
  app.post("/api/themes/delete", (req, res) => { try { res.json(themeStore.remove((req.body || {}).name)); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
