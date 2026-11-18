#!/usr/bin/env node
/* bitGen Studio — 2.846.0 units: the pen fills only closed parts (pcpath fillPathOf); 📄 Page Properties (pcpageprops
 * TEMPLATES / specOf / matchTemplate / marginRect, pcpages cleanMargins, lib/pageTemplates); 📅 the booking calendar
 * (static/sitecal.js clean / monthGrid / slotsFor / draw / SQL / CSS / PHP, pccalendar boxFollow / uniqueName / dbNameOf,
 * lib/siteCal install, lib/siteBuild with a calendar) (the live booking through PHP + MariaDB:
 * scripts/test-846-live.js). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const SC = require(path.join(ROOT, "static/sitecal.js")), PP = require(path.join(ROOT, "ext/imageeditdock/pcpageprops.js"));
const PCAL = require(path.join(ROOT, "ext/imageeditdock/pccalendar.js")), PG = require(path.join(ROOT, "ext/imageeditdock/pcpages.js"));
const PATH = require(path.join(ROOT, "ext/imageeditdock/pcpath.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
(async () => {
  /* ---- the pen */
  const sub = (closed) => ({ closed, op: "add", pts: [PATH.anchor(0, 0), PATH.anchor(10, 0), PATH.anchor(10, 10)] });
  check("pen: only closed parts are filled (an open pen path is a line, not closed by its fill)", PATH.fillPathOf({ subs: [sub(false), sub(true)] }).subs.length === 1 && PATH.fillPathOf({ subs: [sub(false)] }).subs.length === 0);
  const PS = read("ext/imageeditdock/pcpath.js"), PEN = read("ext/imageeditdock/pcpen.js");
  check("pen: drawPathShape fills fillPathOf(p) and draws an open part as a thin line when there is no outline; the pen still closes only within CLOSE() (5 px on screen)",
    /const fp = fillPathOf\(p\)/.test(PS) && /if \(sw <= 0 && bare\.length\)/.test(PS) && /Math\.hypot\(f\.x - fx, f\.y - fy\) <= CLOSE\(\)/.test(PEN));
  /* ---- 📄 page properties */
  const a5 = PP.TEMPLATES.find((t) => t.name === "A5 booklet"), web = PP.TEMPLATES.find((t) => /desktop/.test(t.name));
  const s5 = PP.specOf(a5, PG.PAGE_SIZES), sw = PP.specOf(web, PG.PAGE_SIZES);
  check("templates: an A5 booklet = A5 148 × 210 mm, 150 dpi, 15 mm margins; a desktop web page = 1440 × 900 px at 72 dpi, no margins",
    s5.wmm === 148 && s5.hmm === 210 && s5.dpi === 150 && s5.margins.top === 15 && JSON.stringify(PG.pagePx(sw)) === JSON.stringify({ w: 1440, h: 900 }) && sw.margins.left === 0, [s5, PG.pagePx(sw)]);
  check("matchTemplate: a page that is a template is named; another margin = no template", PP.matchTemplate(Object.assign({}, s5), PP.TEMPLATES, PG.PAGE_SIZES) === "A5 booklet" && PP.matchTemplate(Object.assign({}, s5, { margins: { top: 9, right: 15, bottom: 15, left: 15 } }), PP.TEMPLATES, PG.PAGE_SIZES) === "");
  const mr = PP.marginRect({ top: 25.4, right: 25.4, bottom: 25.4, left: 12.7 }, 1240, 1754, 150);
  check("marginRect: mm at the page's dpi -> the area inside the margins in px", mr.x === 75 && mr.y === 150 && mr.w === 1240 - 75 - 150 && mr.h === 1754 - 300, mr);
  check("mm / px: 25.4 mm = 150 px at 150 dpi; 1440 px at 72 dpi = 508 mm", PP.mmToPx(25.4, 150) === 150 && PP.pxToMm(1440, 72) === 508);
  check("pcpages: cleanMargins (0 - 500 mm, one decimal); a page's margins go into the .bgi and come back; a new page takes them", JSON.stringify(PG.cleanMargins({ top: "12.34", right: -1, bottom: 900, left: 5 })) === JSON.stringify({ top: 12.3, right: 0, bottom: 500, left: 5 })
    && /margins: pg\.margins \|\| null/.test(read("ext/imageeditdock/pcpages.js")) && /margins: cleanMargins\(r\.margins\)/.test(read("ext/imageeditdock/pcpages.js")) && /margins: cleanMargins\(spec && spec\.margins\)/.test(read("ext/imageeditdock/pcpages.js")));
  const PT = require(path.join(ROOT, "lib/pageTemplates.js")), tmpT = fs.mkdtempSync(path.join(os.tmpdir(), "t846p-")); PT.setBase(tmpT);
  PT.save({ name: "Shop flyer", preset: "A4", orient: "portrait", dpi: 300, margins: { top: 5, right: 5, bottom: 5, left: 5 } }); PT.save({ name: "shop FLYER", preset: "A5", dpi: 150 });
  let threw = false; try { PT.save({ name: "  " }); } catch (e) { threw = e.status === 400; }
  const lst = PT.list(); PT.remove("Shop flyer");
  check("lib/pageTemplates: saved in <app>/page_templates.json, the same name (any case) replaced, a name needed, deleted", lst.length === 1 && lst[0].preset === "A5" && threw && PT.list().length === 0 && fs.existsSync(path.join(tmpT, "page_templates.json")), lst);
  /* ---- 📅 the calendar: settings, days, times */
  const cal = SC.clean({ name: "Dr O'Neil's clinic", slot: 30, cap: 1, days: 30, lead: 2, weekStart: 1, tz: "Australia/Sydney", hours: [[], [["09:00", "12:00"], ["13:00", "15:00"]], [["09:00", "17:00"]], [], [], [], []], style: { month: { color: "#ff0000", size: 99 }, date: { font: "Comic Sans" } } });
  check("clean: the slug from the name, the time zone kept, a style's colour kept, its size held to 48, an unknown font back to the default, the other types filled in",
    cal.slug === "dr-o-neil-s-clinic" && cal.tz === "Australia/Sydney" && cal.style.month.color === "#ff0000" && cal.style.month.size === 48 && cal.style.date.font === "system-ui" && SC.STYLE_TYPES.every(([k]) => cal.style[k]), cal.style.month);
  const g = SC.monthGrid(2026, 12, 1);
  check("monthGrid: December 2026 from Monday - 6 weeks, it starts Mon 30 Nov, 1 Dec is a Tuesday in the month", g.length === 6 && g[0][0].iso === "2026-11-30" && g[0][1].iso === "2026-12-01" && g[0][1].inMonth && !g[0][0].inMonth && g[0][1].wd === 2);
  const now = { iso: "2026-11-30", min: 8 * 60 + 30 };   // Monday 08:30
  const mon = SC.slotsFor(cal, "2026-11-30", now, { "11:00": 1 }, null);
  check("slotsFor: Monday's two ranges in 30-minute steps (9-12, 13-15 = 10 times); before 10:30 too soon (2 hours' notice); 11:00 taken",
    mon.length === 10 && mon.map((s) => s.time).join() === "09:00,09:30,10:00,10:30,11:00,11:30,13:00,13:30,14:00,14:30" && !mon[2].free && mon[3].free && !mon[4].free && mon[5].free, mon);
  check("slotsFor: Wednesday closed (no hours), a day past the days ahead has no free time, a closed day none at all",
    SC.slotsFor(cal, "2026-12-02", now, null, null).length === 0 && SC.slotsFor(cal, "2027-01-05", now, null, null).every((s) => !s.free) && SC.slotsFor(cal, "2026-12-01", now, null, new Set(["2026-12-01"])).length === 0);
  const grp = SC.clean({ kind: "classes" });
  check("kinds: classes = 60 minutes, 10 people per time; a time with 9 booked is still free (1 left)", grp.slot === 60 && grp.cap === 10 && SC.slotsFor(grp, "2026-12-01", now, { "10:00": 9 }, null).find((s) => s.time === "10:00").left === 1);
  // the canvas: what it draws
  const ops = []; const fake = new Proxy({}, { get: (t, k) => (k in t ? t[k] : typeof k === "string" && /^(fill|stroke|beginPath|moveTo|lineTo|arcTo|closePath|fillText|measureText|save|restore|setLineDash)$/.test(k) ? (...a) => { ops.push([k, a[0]]); return k === "measureText" ? { width: 10 } : undefined; } : undefined), set: (t, k, v) => { t[k] = v; return true; } });
  const dr = SC.draw(fake, cal, { x: 10, y: 10, w: 420, h: 460 }, { now, month: "2026-12" });
  const texts = ops.filter((o) => o[0] === "fillText").map((o) => o[1]);
  check("draw: the month name, the weekday names from Monday, every date, the chosen day = the first with a free time, its times + the Book button",
    texts.includes("December 2026") && texts.indexOf("Mon") < texts.indexOf("Tue") && texts.includes("31") && dr.selected === "2026-12-01" && texts.includes("Book") && texts.includes("09:00") && dr.cells.find((c) => c.iso === "2026-12-02").kind === "full" && dr.cells.find((c) => c.iso === "2026-12-01").kind === "selected", { sel: dr.selected, n: texts.length });
  /* ---- SQL / CSS / PHP */
  const seed = SC.seedSql(cal), css = SC.cssFor(cal, 400);
  check("SQL: four tables + the upcoming view; the seed upserts the calendar (quotes doubled) and writes its hours (3 ranges)",
    ["bg_calendars", "bg_cal_hours", "bg_cal_closed", "bg_cal_bookings", "VIEW bg_cal_upcoming"].every((t) => SC.schemaSql().includes(t)) && /'Dr O''Neil''s clinic'/.test(seed) && /ON DUPLICATE KEY UPDATE/.test(seed) && (seed.match(/INSERT INTO bg_cal_hours/g) || []).length === 3);
  check("CSS: each object type styled under the calendar's own class (month red, today, available, taken, the button)", css.includes(".bgcal-dr-o-neil-s-clinic .bgcal-month{") && /\.bgcal-month\{[^}]*color:#ff0000/.test(css) && ["today", "open", "full", "past", "sel"].every((c) => css.includes(".bgcal-day." + c)) && css.includes(".bgcal-slot.taken") && css.includes(".bgcal-btn"));
  check("PHP widget: PDO prepared statements, a CSRF token, a row lock so a time is never booked twice (php -l in test-846-live.js)", /hash_equals\(bgcal_token\(\)/.test(require(path.join(ROOT, "lib/siteCalPhp.js")).PHP_WIDGET) && /FOR UPDATE/.test(require(path.join(ROOT, "lib/siteCalPhp.js")).PHP_WIDGET) && !/\$_(GET|POST|REQUEST)\[[^\]]+\][^;]*query\(/.test(require(path.join(ROOT, "lib/siteCalPhp.js")).PHP_WIDGET));
  /* ---- the editor side */
  check("pccalendar: boxFollow (moved 20 px right + made twice as big), uniqueName, dbNameOf",
    JSON.stringify(PCAL.boxFollow({ x: 10, y: 10, w: 400, h: 420 }, { x: 10, y: 10, w: 400, h: 420 }, { x: 30, y: 10, w: 800, h: 840 })) === JSON.stringify({ x: 30, y: 10, w: 800, h: 840 })
    && PCAL.uniqueName("Appointments", ["Appointments", "Appointments 2"]) === "Appointments 3" && PCAL.dbNameOf("Tiger Café!") === "site_tiger_cafe" && PCAL.dbNameOf("") === "website");
  /* ---- lib/siteCal with a stand-in database */
  const SCL = require(path.join(ROOT, "lib/siteCal.js")), ran = [];
  SCL.setDb({ createDb: async (s, n) => { ran.push(["create", s, n]); }, run: async (s, db, sql) => { ran.push(["run", s, db, sql]); return { results: sql.split(";").filter((x) => x.trim()).map((q) => ({ ok: true, sql: q })) }; } });
  const inst = await SCL.install(Object.assign({}, cal, { db: { scope: "project", name: "site_clinic" } }));
  check("lib/siteCal.install: the database made, the tables + the calendar's row run in it", inst.ok && ran[0].join() === "create,project,site_clinic" && (() => { const sch = ran.find((r) => r[0] === "run" && /CREATE TABLE IF NOT EXISTS bg_cal_bookings/.test(r[3] || "")); return !!sch && sch[2] === "site_clinic" && /INSERT INTO bg_calendars/.test(sch[3]); })(), inst);
  SCL.setDb({ createDb: async () => {}, run: async () => ({ results: [{ ok: false, sql: "CREATE TABLE x", error: "denied" }] }) });
  let err = ""; try { await SCL.install(cal); } catch (e) { err = e.message; }
  check("lib/siteCal.install: a statement the database refuses is said", /refused: denied/.test(err), err);
  /* ---- the website build with a calendar */
  const B = require(path.join(ROOT, "lib/siteBuild.js")), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t846s-")); B.setDir(tmp);
  const page = { title: "Book", w: 1200, h: 900, bg: "#ffffff", els: [{ kind: "text", text: "Book a visit", size: 40, color: "#111111", box: { x: 0, y: 0, w: 1200, h: 60 } }, { kind: "calendar", cal: Object.assign({}, cal, { lang: "en" }), box: { x: 300, y: 100, w: 480, h: 520 } }] };
  B.save({ name: "Clinic", title: "Clinic", stack: "php", lang: "en", pages: [page], assets: [] });
  B.setComplete(async () => ({ ok: true, text: JSON.stringify({ html: "<h1>Book a visit</h1>", css: "" }) }));   // the AI leaves the calendar out -> bitGen's own layout
  const r1 = await B.build("Clinic", { ai: true });
  const out = path.join(tmp, "Clinic", "build"), idx = fs.readFileSync(path.join(out, "index.php"), "utf8"), prev = fs.readFileSync(path.join(tmp, "Clinic", "preview", "index.html"), "utf8");
  check("siteBuild: an AI page that drops the calendar is not used (bitGen's layout); index.php loads inc/calendar.php and calls bgcal('slug'); inc/calendar.php + the tables + the calendar in schema.sql; its CSS in site.css",
    r1.pages[0].by === "bitgen" && /^<\?php require_once __DIR__ \. '\/inc\/calendar\.php';/.test(idx) && idx.includes("<?php bgcal('dr-o-neil-s-clinic', 'en'); ?>") && fs.existsSync(path.join(out, "inc", "calendar.php"))
    && /bg_cal_bookings/.test(fs.readFileSync(path.join(out, "schema.sql"), "utf8")) && /INSERT INTO bg_calendars/.test(fs.readFileSync(path.join(out, "schema.sql"), "utf8")) && /\.bgcal-dr-o-neil-s-clinic \.bgcal-month/.test(fs.readFileSync(path.join(out, "css", "site.css"), "utf8")), r1);
  check("siteBuild: the preview shows the calendar's month (no PHP) with a note that booking works on the PHP site", /class="bgcal bgcal-dr-o-neil-s-clinic"/.test(prev) && /booking opens on the PHP \+ MySQL website/.test(prev) && !/bgcal\(/.test(prev));
  B.setComplete(async () => ({ ok: true, text: JSON.stringify({ html: '<h1>Book a visit</h1><div data-bgcal="dr-o-neil-s-clinic"></div>', css: "" }) }));
  const r2 = await B.build("Clinic", { ai: true });
  check("siteBuild: an AI page that keeps the calendar's place is used", r2.pages[0].by === "ai" && fs.readFileSync(path.join(out, "index.php"), "utf8").includes("bgcal('dr-o-neil-s-clinic'"), r2);
  B.setComplete(null);
  /* ---- the wiring */
  const EX = JSON.parse(read("ext/imageeditdock/ext.json")), IE = read("ext/imageeditdock/imageedit.js"), RI = read("routes/index.js"), SV = read("misc/server.js"), VW = read("ext/imageeditdock/pcviews.js"), DOC = read("ext/imageeditdock/pcdoc.js");
  check("wiring: pcpageprops + pccalendar after pcsite, installed before the views; routes from routes/index.js (not server.js); 📅 Calendar on the Web ribbon (dragged), 📄 Page Properties on both ribbons; the calendar's settings undoable (DEEP cal)",
    EX.scripts.indexOf("pcpageprops.js") === EX.scripts.indexOf("pcsite.js") + 1 && EX.scripts.indexOf("pccalendar.js") === EX.scripts.indexOf("pcpageprops.js") + 1 && IE.indexOf("PCCalendar.install(E)") < IE.indexOf("PCViews.install(E)") && IE.indexOf("PCPageProps.install(E)") > IE.indexOf("PCColDock.install(E)")
    && /require\("\.\/siteCal"\)\.mount\(app\)/.test(RI) && /require\("\.\/pageTemplates"\)\.mount\(app\)/.test(RI) && !/sitecal|pagetemplates/i.test(SV)
    && /\["act", "calendar", "Calendar", "📅"\]/.test(VW) && /dragSource\(b, "appointments"\)/.test(VW) && (VW.match(/"page\.props"/g) || []).length === 2 && /"doc", "cal"\]/.test(DOC));
  check(".gitignore: your page templates are user state", /^\/page_templates\.json$/m.test(read(".gitignore")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
