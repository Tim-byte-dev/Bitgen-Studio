// bitGen Studio — lib/siteAdmin.js (2.848.0): 🔐 the website's admin database (lib/siteAdminSql.js) in bitGen's MariaDB
// (project / global) or your own server. install({scope, name, business, tz}): the database made when it is not there
// (default name "myadmin" - Tim: "if a db doesn't exist for admin create one called myadmin"), then its tables, views and
// settings (CREATE … IF NOT EXISTS - run again = nothing lost). lib/siteCal.install calls it after a calendar's tables.
"use strict";
const S = require("./siteAdminSql");
let D = () => require("./dbServer");
function setDb(fake) { D = () => fake; }   // tests
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
async function install(opt) {
  const o = opt || {}, scope = ["project", "global", "external"].includes(o.scope) ? o.scope : "project";
  const name = /^[\w$]{1,64}$/.test(String(o.name || "")) ? String(o.name) : "myadmin";
  let existed = null;
  try { existed = (await D().databases(scope)).includes(name); } catch (e) { /* the list may be refused on a host */ }
  if (!existed) await D().createDb(scope, name);
  else for (const q of S.upgradeSql()) { try { await D().run(scope, name, q); } catch (e) { /* there already */ } }   // 2.850.0
  const r = await D().run(scope, name, S.schemaSql({ business: o.business, tz: o.tz })), failed = (r.results || []).find((x) => !x.ok);
  if (failed) throw bad("the admin database refused: " + failed.error + " (" + String(failed.sql || "").slice(0, 80) + "…)");
  return { ok: true, scope, db: name, created: existed === false, tables: S.tableNames(), views: S.viewNames() };
}
module.exports = { install, setDb };
