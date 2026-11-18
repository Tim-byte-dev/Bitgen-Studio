// bitGen Studio — lib/siteCal.js (2.846.0): 📅 a web project's booking calendar in its database.
// Tim (verbatim): "... drag and drop a calendar onto the canvas and it will automatically create it's sql and upload to db ...".
// install(cal): the database made if it is not there (bitGen's MariaDB - project / global - or your server), the tables
// (static/sitecal.js schemaSql) and this calendar's row + opening hours (seedSql) - run again = updated, bookings kept.
// bookings(cal): the calendar's bookings from today on (what the website's visitors booked).
"use strict";
const C = require("../static/sitecal.js");
let D = () => require("./dbServer");
function setDb(fake) { D = () => fake; }   // tests
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
async function install(cal0) {
  const c = C.clean(cal0), scope = c.db.scope, db = c.db.name;
  if (scope !== "external") await D().createDb(scope, db);
  const sql = C.schemaSql() + "\n" + C.seedSql(c);
  const r = await D().run(scope, db, sql), failed = (r.results || []).find((x) => !x.ok);
  if (failed) throw bad("the database refused: " + failed.error + " (" + failed.sql.slice(0, 80) + "…)");
  return { ok: true, scope, db, slug: c.slug, statements: (r.results || []).length, tables: ["bg_calendars", "bg_cal_hours", "bg_cal_closed", "bg_cal_bookings", "bg_cal_upcoming"] };
}
async function bookings(cal0) {
  const c = C.clean(cal0);
  const sql = `SELECT DATE_FORMAT(b.starts_at, '%Y-%m-%d %H:%i') AS starts, b.name, b.email, b.phone, b.notes, b.status FROM bg_cal_bookings b JOIN bg_calendars c ON c.id = b.calendar_id WHERE c.slug = '${c.slug}' AND b.starts_at >= CURDATE() ORDER BY b.starts_at LIMIT 500`;
  const r = await D().run(c.db.scope, c.db.name, sql), x = (r.results || [])[0];
  if (!x || !x.ok) throw bad(x ? x.error : "no answer from the database");
  return { rows: x.rows || [] };
}
module.exports = { install, bookings, setDb };
