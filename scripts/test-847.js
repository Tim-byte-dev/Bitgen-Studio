#!/usr/bin/env node
/* bitGen Studio — 2.847.0 units: 🧲 snap toggle buttons + snap to WP frames / the page's margins (pcguides targetsOf /
 * snapPoint, E.snapPoint in the Move tool's handles); ⟷ Page Width without the margins (imageedit widthView's crop, the ▯
 * toggle); ▦ tables selectable / deletable / resizable / styled, rows resized (pcdoctable cleanTs / applyTableStyle /
 * setRowHeight, pcdoctext keeps data-ts + heights); 📅 the calendar on any page (printed / booking) + the rest of the
 * booking features (static/sitecal.js clean / slotsFor / SQL; the website's PHP: services, buffer, most a day, approval,
 * manage + cancel, e-mails, .ics). The real bookings through PHP + MariaDB: test-847-live.js. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const G = require(path.join(ROOT, "ext/imageeditdock/pcguides.js")), IE = require(path.join(ROOT, "ext/imageeditdock/imageedit.js"));
const T = require(path.join(ROOT, "ext/imageeditdock/pcdoctable.js")), X = require(path.join(ROOT, "ext/imageeditdock/pcdoctext.js"));
const SC = require(path.join(ROOT, "static/sitecal.js")), PHP = require(path.join(ROOT, "lib/siteCalPhp.js"));

/* ---- 🧲 snapping */
const T1 = G.targetsOf({ w: 800, h: 1000, on: { frames: true }, frames: [{ x: 100, y: 120, w: 400, h: 300 }, { x: 60, y: 60, w: 680, h: 880, k: "margin" }] });
check("targetsOf: a WP frame's edges + middle and the margins' lines are targets (frames on)", [100, 300, 500, 60, 740].every((v) => T1.xs.some((t) => t.v === v)) && T1.xs.some((t) => t.k === "WP frame centre") && T1.ys.some((t) => t.v === 940 && t.k === "margin"), T1.xs);
const T0 = G.targetsOf({ w: 800, h: 1000, on: { frames: false, objects: true }, frames: [{ x: 100, y: 120, w: 400, h: 300 }], boxes: [] });
check("targetsOf: frames off = none of them", !T0.xs.some((t) => /frame|margin/.test(t.k)));
const sp = G.snapPoint(103, 500, T1, 6, 0);
check("snapPoint: a point 3 px from a frame's left edge goes onto it", sp.x === 100 && sp.y === 500, sp);
const pg = src("ext/imageeditdock/pcguides.js");
check("pcguides: snap to frames on by default, View ▸ Snap To ▸ WP Frames and Margins, the 🧲 ┼ ◰ ▤ buttons on the top strip (a kind turned on turns snapping on), E.snapPoint",
  /frames: true/.test(pg) && /"snap\.frames"/.test(pg) && /id = "pcSnapBtns"/.test(pg) && /\["frames", "▤"/.test(pg) && /if \(k !== "snap" && SN\[k\]\) SN\.snap = true/.test(pg) && /E\.snapPoint = function/.test(pg) && /SNAP_TOOLS[^;]*doctext/.test(pg));
check("pchandles: scaling / skewing an object's handles snap (not rotating; Ctrl = free)", /E\.snapPoint && st\.mode !== "rotate" && !e\.ctrlKey \? E\.snapPoint\(E\.pos\(e\), d\.L\)/.test(src("ext/imageeditdock/pchandles.js")));
check("pccalendar: a calendar dropped on the page snaps like any object", /E\.snapPoint\(\[bx, by\], null\)/.test(src("ext/imageeditdock/pccalendar.js")));

/* ---- ⟷ Page Width without the margins */
const a = IE.widthView(1100, 500, 700, null, 16), b = IE.widthView(1100, 500, 700, null, 16, { left: 50, right: 50 });
check("widthView: margins shown = the whole page's width; margins off = the space between them fills the view (its left margin line at the left pad)", a.panX === 16 && Math.abs(b.zoom - 1068 / 400) < 0.01 && Math.abs(b.panX + 50 * b.zoom - 16) <= 1, { a, b });
const ie = src("ext/imageeditdock/imageedit.js");
check("imageedit: the ▯ toggle by ⟷ (#kxPageWM), kept (pw.margins), the margins from the page (mm at its dpi) else the first WP frame; E.toggleWidthMargins",
  /id="kxPageWM"|kxPageWM/.test(ie) && /pw\.margins/.test(ie) && /toggleWidthMargins/.test(ie) && /let lastFit = ""/.test(ie));
check("the toggle on the zoom tool's options (▯ Margins) and View ▸ Page Width Shows the Margins", /ptZPWM/.test(src("ext/imageeditdock/pctools.js")) && /"view\.pagewidthm", "Page Width Shows the Margins"/.test(src("ext/imageeditdock/pcui.js")));

/* ---- ▦ tables */
check("cleanTs: numbers kept in range, colours only #rrggbb, the alignment one of three", JSON.stringify(T.cleanTs({ w: 500, align: "x", bw: 3, bc: "red", pad: -2, band: 1 })) === JSON.stringify(Object.assign({}, T.TS_DEFAULT, { w: 100, bw: 3, pad: 0, band: true })), T.cleanTs({ w: 500, align: "x", bw: 3, bc: "red", pad: -2, band: 1 }));
let JSDOM = null; try { ({ JSDOM } = require("jsdom")); } catch (e) { console.log("SKIP: no jsdom - the table DOM checks"); }
if (JSDOM) {
  const dom = new JSDOM(`<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></table>`), d = dom.window.document, t = d.querySelector("table");
  T.applyTableStyle(t, { w: 60, align: "center", bw: 2, bc: "#112233", pad: 6, hbg: "#ff0000", band: true, bandc: "#00ff00", size: 14 });
  const td = t.rows[1].cells[0], th = t.rows[0].cells[0];
  check("applyTableStyle: 60 % wide in the middle, the cells' border + padding, the header's background, banded rows, the size, kept on the table (data-ts)",
    t.style.width === "60%" && t.style.marginLeft === "auto" && t.style.marginRight === "auto" && /2px solid/.test(td.style.border) && td.style.padding === "6px" && /255, 0, 0|#ff0000/.test(th.style.background + th.style.backgroundColor) && /0, 255, 0|#00ff00/.test(t.rows[2].cells[0].style.background + t.rows[2].cells[0].style.backgroundColor + t.rows[1].cells[0].style.backgroundColor) && T.tsOf(t).w === 60 && T.tsOf(t).band === true,
    { w: t.style.width, td: td.getAttribute("style"), th: th.getAttribute("style"), r2: t.rows[2].cells[0].getAttribute("style"), ts: t.getAttribute("data-ts") });
  T.setRowHeight(t.rows[1], 3.4); T.setRowHeight(t.rows[2], 52.6);
  check("setRowHeight: a row's own height (8 px at least)", t.rows[1].style.height === "8px" && t.rows[2].style.height === "53px");
  const clean = X.sanitize(t.outerHTML, d);
  check("pcdoctext.sanitize keeps the table's style (data-ts), widths, row heights", /data-ts="/.test(clean) && /height:\s*53px/.test(clean) && /width:\s*60%/.test(clean), clean.slice(0, 400));
  const bad = X.sanitize(`<table data-ts="<script>x</script>"><tr><td>1</td></tr></table>`, d);
  check("pcdoctext.sanitize drops a data-ts that is not a table style", !/data-ts/.test(bad), bad);
}
const tb = src("ext/imageeditdock/pcdoctable.js");
check("pcdoctable: ⊞ select (the handle), Del / Backspace deletes it, Esc lets go, ◢ grip resizes (Shift = width only), 🎨 Table Style, rows' bottom edges drag, columns' edges drag",
  /"doc\.table\.select"/.test(tb) && /"doc\.table\.style"/.test(tb) && /Delete|Backspace/.test(tb) && /Escape/.test(tb) && /rowEdgeAt/.test(tb) && /row-resize/.test(tb) && /col-resize/.test(tb) && /pcdt-h/.test(tb));

/* ---- 📅 the calendar */
const c = SC.clean({ name: "Salon", slot: 30, cap: 1, buffer: 15, maxDay: 3, approve: 1, cancelHours: 2, emails: true, owner: "me@x.io", from: "bad address", mode: "print", month: "2026-12",
  services: [{ name: "Cut", mins: 60, price: "$40" }, { name: "" }, { name: "Trim", mins: 9999 }], closed: [{ day: "2026-12-25", reason: "Xmas" }, { day: "soon" }], hours: [0, 1, 2, 3, 4, 5, 6].map(() => [["09:00", "17:00"]]) });
check("clean: printed mode + its month, services (no name = dropped, minutes in range), buffer, most a day, approval, cancel hours, e-mails (a bad From dropped), closed days (bad dates dropped)",
  c.mode === "print" && c.month === "2026-12" && c.services.length === 2 && c.services[1].mins === 720 && c.buffer === 15 && c.maxDay === 3 && c.approve === true && c.cancelHours === 2 && c.emails && c.owner === "me@x.io" && c.from === "" && c.closed.length === 1, c);
check("clean: a new calendar books (mode booking), 24 h to cancel", SC.clean({}).mode === "booking" && SC.clean({}).cancelHours === 24);
const now = { iso: "2026-12-01", min: 0 }, day = "2026-12-08";
const s30 = SC.slotsFor(c, day, now, [[600, 660]], new Set(), 30);
const taken = s30.filter((s) => !s.free).map((s) => s.time);
check("slotsFor: a booking 10:00 – 11:00 with a 15 min buffer takes 09:30 … 11:00 for a 30 min booking", JSON.stringify(taken) === JSON.stringify(["09:30", "10:00", "10:30", "11:00"]), taken);
const s60 = SC.slotsFor(c, day, now, [], new Set(), 60);
check("slotsFor: a 60 min service's times end by closing (last 16:00)", s60.length === 15 && s60[14].time === "16:00");
check("slotsFor: the most a day reached = nothing free; a closed day = no times", SC.slotsFor(c, day, now, [[540, 570], [700, 730], [900, 930]], new Set(), 30).every((s) => !s.free) && SC.slotsFor(c, day, now, [], new Set([day]), 30).length === 0);
check("slotsFor: an old {\"HH:MM\": n} map still works", SC.slotsFor(Object.assign({}, c, { buffer: 0 }), day, now, { "10:00": 1 }, new Set(), 30).find((s) => s.time === "10:00").free === false);
const sch = SC.schemaSql(), seed = SC.seedSql(c), up = SC.upgradeSql();
check("SQL: services table, the bookings' service / token / cancelled_at; the seed writes the services + closed days (old ones cleared first) and the new settings",
  /CREATE TABLE IF NOT EXISTS bg_cal_services/.test(sch) && /token CHAR\(32\)/.test(sch) && /cancelled_at/.test(sch) && /DELETE FROM bg_cal_services/.test(seed) && (seed.match(/INSERT INTO bg_cal_services/g) || []).length === 2 && /INSERT (IGNORE )?INTO bg_cal_closed[^;]*'2026-12-25'/.test(seed) && /buffer_minutes, max_per_day, approve, cancel_hours, send_emails, notify_email, from_email/.test(seed));
check("upgradeSql: one ALTER per new column (a 2.846.0 database upgraded in place)", up.length >= 8 && up.every((q) => /^(ALTER TABLE|CREATE TABLE IF NOT EXISTS|CREATE INDEX|CREATE OR REPLACE VIEW)/.test(q)) && up.some((q) => /ADD COLUMN token/.test(q)) && up.some((q) => /ADD COLUMN service/.test(q)), up);
const W = PHP.PHP_WIDGET;
check("PHP: services (a choice first), the buffer, the most a day, approval (pending), a random manage token, cancel (CSRF + the cancel hours), mail() to the visitor + the owner, .ics",
  /bgcal_services\(/.test(W) && /buffer_minutes/.test(W) && /max_per_day/.test(W) && /'pending'/.test(W) && /bin2hex\(random_bytes\(16\)\)/.test(W) && /act'\] \?\? ''\) === 'cancel'/.test(W) && /cancel_hours/.test(W) && /@mail\(/.test(W) && /function bgcal_ics/.test(W) && /bgcal_ics\(/.test(PHP.PHP_ICS));
check("PHP: e-mail headers can't be injected (the addresses checked with FILTER_VALIDATE_EMAIL, the subject encoded)", /FILTER_VALIDATE_EMAIL\) \? \$cal\['from_email'\]/.test(W) && /=\?UTF-8\?B\?/.test(W));
check("siteBuild: bgcal-ics.php written with inc/calendar.php", /bgcal-ics\.php"\), cp\.PHP_ICS/.test(src("lib/siteBuild.js")));
const pc = src("ext/imageeditdock/pccalendar.js");
check("pccalendar: any page - 🌐 Web View = a booking calendar, else a printed month (no database); Mode + Month, Services & rules (services, buffer, most a day, approval, cancel hours, e-mails, closed days); 📅 on the tool column",
  /E\.views\.current\(\) === "web" \? "booking" : "print"/.test(pc) && /if \(!isCal\(L\) \|\| L\.cal\.mode === "print"\) return null/.test(pc) && /id="pccMode"/.test(pc) && /id="pccMonth"/.test(pc) && ["pccSvc", "pccBuffer", "pccMaxDay", "pccApprove", "pccCancelH", "pccEmails", "pccOwner", "pccFrom", "pccClosed"].every((id) => pc.includes(`id="${id}"`)) && /id = "pcCalTool"/.test(pc));
const V = require(path.join(ROOT, "ext/imageeditdock/pcviews.js"));
const ins = V.RIBBONS.wp.find((t) => t.id === "insert").groups.find((g) => g.label === "Illustrations");
check("WP View ▸ Insert ▸ Illustrations has 📅 Calendar (dragged too)", ins.items.some((it) => it[0] === "act" && it[1] === "calendar") && /querySelectorAll\('\.cbb\[data-id="v_act_calendar"\]'\)/.test(src("ext/imageeditdock/pcviews.js")));
check("pcsite: a printed calendar is a picture on the website, a booking one the working calendar", /if \(L\.cal && L\.cal\.mode !== "print"\)/.test(src("ext/imageeditdock/pcsite.js")));
check("lib/siteCal.bookings: the service of each booking", /b\.service, b\.status/.test(src("lib/siteCal.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
