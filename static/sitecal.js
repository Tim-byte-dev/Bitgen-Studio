/* bitGen Studio — static/sitecal.js: 📅 THE BOOKING CALENDAR OF A WEB PROJECT (2.846.0), window.H3SiteCal / require().
 *
 * Tim (verbatim): "add a calender tool for web projects so users can drag and drop a calendar onto the canvas and it will
 * automatically create it's sql and upload to db, for appointments, meetings etc. so users of the website that is being
 * deleloped can make appointments and see what times are available for appointments etc. add style elements so user can
 * style each object type (dates, month names etc.)"
 *
 * One file for both sides - the image editor draws the calendar with it (ext/imageeditdock/pccalendar.js) and the server
 * writes the website's part with it (lib/siteBuild.js, routes/siteCal.js):
 *   clean(cal)            a calendar's settings checked: name, slug, kind, slot minutes, days ahead, notice hours, people
 *                         per time, week start, time zone, opening hours per weekday, the questions, the database, the style
 *   STYLE_TYPES / DEFAULT_STYLE   each object type styled on its own: the frame, month name, ‹ › arrows, weekday names,
 *                         dates, today, available, fully booked / closed, past / other month, the chosen day, times, taken
 *                         times, the Book button
 *   monthGrid / slotsFor  the month's weeks; the times of a day (opening hours, the slot length, notice, booked times,
 *                         people per time) - the same rules the website's PHP keeps
 *   draw(g, cal, box, o)  the calendar on a canvas (the editor's layer)
 *   schemaSql / seedSql   the tables (bg_calendars, bg_cal_hours, bg_cal_closed, bg_cal_bookings) + this calendar's row
 *   cssFor / staticHtml   the website's look and a static month (preview / static sites); the PHP part (inc/calendar.php) is
 *                         lib/siteCalPhp.js (server only)
 */
(function (root) {
  "use strict";
  const KINDS = { appointments: { label: "Appointments", slot: 30, cap: 1 }, meetings: { label: "Meetings", slot: 60, cap: 1 }, classes: { label: "Classes / group sessions", slot: 60, cap: 10 } };
  const FONTS = ["system-ui", "Arial", "Helvetica", "Verdana", "Trebuchet MS", "Georgia", "Times New Roman", "Courier New"];
  /** [key, label, what it is] - the object types the user styles */
  const STYLE_TYPES = [["frame", "Frame", "the calendar's box (colour = its border)"], ["month", "Month name", "the month and year at the top"],
    ["nav", "‹ › Arrows", "previous / next month"], ["weekday", "Weekday names", "Mon Tue …"], ["date", "Dates", "every day of the month"],
    ["today", "Today", "today's date"], ["available", "Available days", "days with a free time"], ["full", "Fully booked / closed", "no free time that day"],
    ["past", "Past / other month", "days that cannot be booked"], ["selected", "Chosen day", "the day picked"], ["slot", "Times", "a free time"],
    ["taken", "Taken times", "a time already booked"], ["button", "Book button", "the button that books"]];
  const S = (font, size, color, bg, bold, radius) => ({ font, size, color, bg, bold, radius });
  const DEFAULT_STYLE = {
    frame: S("system-ui", 14, "#d9dde3", "#ffffff", false, 12), month: S("system-ui", 20, "#1f2937", "", true, 0), nav: S("system-ui", 18, "#2563eb", "", true, 6),
    weekday: S("system-ui", 12, "#6b7280", "", true, 0), date: S("system-ui", 14, "#1f2937", "", false, 8), today: S("system-ui", 14, "#2563eb", "", true, 8),
    available: S("system-ui", 14, "#065f46", "#d1fae5", true, 8), full: S("system-ui", 14, "#9ca3af", "#f3f4f6", false, 8), past: S("system-ui", 14, "#cbd5e1", "", false, 8),
    selected: S("system-ui", 14, "#ffffff", "#2563eb", true, 8), slot: S("system-ui", 13, "#1e3a8a", "#e0e7ff", false, 6), taken: S("system-ui", 13, "#9ca3af", "#f3f4f6", false, 6),
    button: S("system-ui", 14, "#ffffff", "#2563eb", true, 8),
  };
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pad = (n) => String(n).padStart(2, "0");
  const num = (v, lo, hi, d) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  const colour = (c, d) => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(c || "")) ? String(c).toLowerCase() : d);
  const hhmm = (t, d) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); if (!m) return d; const h = +m[1], mi = +m[2]; return h > 24 || mi > 59 || (h === 24 && mi) ? d : pad(h) + ":" + pad(mi); };
  const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const slugOf = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "calendar";
  function cleanStyle(st) {
    const o = {}, s = st && typeof st === "object" ? st : {};
    for (const [k] of STYLE_TYPES) {
      const d = DEFAULT_STYLE[k], v = s[k] && typeof s[k] === "object" ? s[k] : {};
      o[k] = { font: FONTS.includes(v.font) ? v.font : d.font, size: num(v.size, 8, 48, d.size), color: colour(v.color, d.color), bg: v.bg === "" ? "" : colour(v.bg, d.bg), bold: v.bold == null ? d.bold : !!v.bold, radius: num(v.radius, 0, 40, d.radius) };
    }
    return o;
  }
  /** opening hours: 7 lists (0 = Sunday) of [from, to] "HH:MM"; the default Mon-Fri 9:00-17:00 */
  function cleanHours(h) {
    const def = [[], [["09:00", "17:00"]], [["09:00", "17:00"]], [["09:00", "17:00"]], [["09:00", "17:00"]], [["09:00", "17:00"]], []];
    if (!Array.isArray(h) || h.length !== 7) return def;
    return h.map((day) => (Array.isArray(day) ? day : []).map((r) => [hhmm(r && r[0], ""), hhmm(r && r[1], "")]).filter(([a, b]) => a && b && mins(b) > mins(a)).slice(0, 4));
  }
  /** a calendar's settings, checked */
  function clean(c) {
    const o = c && typeof c === "object" ? c : {}, kind = KINDS[o.kind] ? o.kind : "appointments", K = KINDS[kind];
    const db = o.db && typeof o.db === "object" ? o.db : {};
    return {
      name: String(o.name || K.label).trim().slice(0, 80) || K.label, slug: slugOf(o.slug || o.name || K.label), kind,
      slot: num(o.slot, 5, 480, K.slot), days: num(o.days, 1, 730, 60), lead: num(o.lead, 0, 720, 2), cap: num(o.cap, 1, 500, K.cap), weekStart: num(o.weekStart, 0, 6, 1),
      tz: /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$|^UTC$/.test(String(o.tz || "")) ? String(o.tz) : "UTC",
      hours: cleanHours(o.hours), phone: o.phone !== false, notes: o.notes !== false,
      // 2.847.0: printed (a month on any page) or a website's booking calendar; the booking rules
      mode: o.mode === "print" ? "print" : "booking", month: /^\d{4}-\d{2}$/.test(String(o.month || "")) ? o.month : "",
      services: (Array.isArray(o.services) ? o.services : []).map((v) => ({ name: String((v && v.name) || "").trim().slice(0, 80), mins: num(v && v.mins, 5, 720, 30), price: String((v && v.price) || "").trim().slice(0, 20) })).filter((v) => v.name).slice(0, 20),
      buffer: num(o.buffer, 0, 240, 0), maxDay: num(o.maxDay, 0, 500, 0), approve: !!o.approve, cancelHours: num(o.cancelHours, 0, 720, 24),
      emails: !!o.emails, owner: /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(String(o.owner || "")) ? String(o.owner) : "", from: /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(String(o.from || "")) ? String(o.from) : "",
      closed: (Array.isArray(o.closed) ? o.closed : []).map((v) => ({ day: /^\d{4}-\d{2}-\d{2}$/.test(String(v && v.day)) ? v.day : "", reason: String((v && v.reason) || "").slice(0, 200) })).filter((v) => v.day).slice(0, 400),
      db: { scope: ["project", "global", "external"].includes(db.scope) ? db.scope : "project", name: /^[\w$]{1,64}$/.test(String(db.name || "")) ? String(db.name) : "website",
        admin: /^[\w$]{1,64}$/.test(String(db.admin || "")) ? String(db.admin) : "myadmin" },   // 2.848.0: 🔐 the admin database
      style: cleanStyle(o.style), lang: /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(String(o.lang || "")) ? o.lang : "en",
    };
  }
  /** the month's weeks: [[{y, m, d, iso, inMonth, wd}] x 7] x 6 (m 1-12) */
  function monthGrid(y, m, weekStart) {
    const first = new Date(Date.UTC(y, m - 1, 1)), off = (first.getUTCDay() - (weekStart || 0) + 7) % 7, out = [];
    let t = Date.UTC(y, m - 1, 1 - off);
    for (let w = 0; w < 6; w++) { const row = []; for (let i = 0; i < 7; i++, t += 864e5) { const d = new Date(t); row.push({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), iso: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, inMonth: d.getUTCMonth() === m - 1, wd: d.getUTCDay() }); } out.push(row); }
    return out;
  }
  /** the times of day `iso` ("YYYY-MM-DD"): [{time, free, left}] - opening hours in steps of the slot (a booking of `len`
   *  minutes - a service's, else the slot - must end by closing); free = not before now + the notice, within the days ahead,
   *  fewer than people-per-time bookings OVERLAPPING it (each widened by the buffer), the day under its most bookings.
   *  now = {iso, min} (the calendar's time zone); busy = [[startMin, endMin], …] that day's bookings (an old {"HH:MM": n}
   *  map = slot-long bookings); closed = a Set of closed days. The website's PHP (lib/siteCalPhp.js) keeps the same rules. */
  function slotsFor(cal, iso, now, busy0, closed, len0) {
    const c = cal, d = new Date(iso + "T00:00:00Z"), wd = d.getUTCDay(), out = [], len = Math.max(5, len0 || c.slot), buf = c.buffer || 0;
    if (closed && closed.has && closed.has(iso)) return out;
    let busy = busy0 || [];
    if (!Array.isArray(busy)) { const b = []; for (const [k, n] of Object.entries(busy)) for (let i = 0; i < n; i++) b.push([mins(k), mins(k) + c.slot]); busy = b; }
    const dayN = Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(now.iso + "T00:00:00Z")) / 864e5);
    const full = c.maxDay > 0 && busy.length >= c.maxDay;
    for (const [a, b] of c.hours[wd] || []) {
      for (let t = mins(a); t + len <= mins(b); t += c.slot) {
        const k = pad(Math.floor(t / 60)) + ":" + pad(t % 60), n = busy.filter(([s, e]) => s - buf < t + len && e + buf > t).length;
        const soon = dayN * 1440 + t - now.min;
        const free = dayN >= 0 && dayN <= c.days && soon >= c.lead * 60 && n < c.cap && !full;
        out.push({ time: k, free, left: full ? 0 : Math.max(0, c.cap - n) });
      }
    }
    return out;
  }
  /* ================================ the canvas (the editor's layer) ================================ */
  function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const fontOf = (s, k) => `${s.bold ? "700 " : ""}${Math.max(6, Math.round(s.size * k))}px ${s.font === "system-ui" ? "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" : `'${s.font}', sans-serif`}`;
  function monthName(y, m, lang) { try { return new Intl.DateTimeFormat(lang || "en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1))); } catch (e) { return `${y}-${pad(m)}`; } }
  function dayNames(lang, ws) { const out = []; for (let i = 0; i < 7; i++) { const wd = (ws + i) % 7; let n = DAYS[wd]; try { n = new Intl.DateTimeFormat(lang || "en", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + wd))); } catch (e) { /* English */ } out.push(n); } return out; }
  /** draw the calendar into box {x, y, w, h} on g; o = {now: {iso, min}, month: "YYYY-MM", taken: {iso: {"HH:MM": n}}} ->
   *  {selected, cells: [{iso, x, y, w, h, kind}]} (what it drew, for tests and hit tests) */
  function draw(g, cal0, box, o0) {
    const c = clean(cal0), st = c.style, o = o0 || {}, now = o.now || nowIn(c.tz), k = box.w / 420;
    const mo = o.month || c.month, [Y, M] = (mo && /^\d{4}-\d{2}$/.test(mo) ? mo : now.iso.slice(0, 7)).split("-").map(Number);
    const box0 = { x: box.x, y: box.y, w: box.w, h: box.h }, P = Math.round(12 * k);
    // the frame
    rr(g, box0.x + 0.5, box0.y + 0.5, box0.w - 1, box0.h - 1, st.frame.radius * k);
    if (st.frame.bg) { g.fillStyle = st.frame.bg; g.fill(); }
    g.lineWidth = Math.max(1, k); g.strokeStyle = st.frame.color; g.stroke();
    const print = c.mode === "print", showTimes = !print && box.h / box.w >= 0.95;   // 2.847.0: a printed calendar = the month only
    const headH = Math.round(Math.max(st.month.size, st.nav.size) * k * 2), wdH = Math.round(st.weekday.size * k * 2);
    const gridTop = box.y + P + headH + wdH, timesH = showTimes ? Math.round(box.h * 0.27) : 0, gridH = box.y + box.h - P - timesH - gridTop;
    const cw = (box.w - 2 * P) / 7, ch = gridH / 6;
    const text = (t, s, x, y, align) => { g.font = fontOf(s, k); g.fillStyle = s.color; g.textAlign = align || "center"; g.textBaseline = "middle"; g.fillText(t, x, y); };
    const chip = (s, x, y, w, h) => { if (s.bg) { rr(g, x, y, w, h, s.radius * k); g.fillStyle = s.bg; g.fill(); } };
    // the month name + ‹ ›
    const hy = box.y + P + headH / 2;
    text(monthName(Y, M, c.lang), st.month, box.x + box.w / 2, hy);
    const nb = Math.round(st.nav.size * k * 1.6);
    for (const [t, x] of [["‹", box.x + P], ["›", box.x + box.w - P - nb]]) { chip(st.nav, x, hy - nb / 2, nb, nb); text(t, st.nav, x + nb / 2, hy); }
    // weekday names
    const names = dayNames(c.lang, c.weekStart);
    names.forEach((n, i) => text(n, st.weekday, box.x + P + cw * (i + 0.5), box.y + P + headH + wdH / 2));
    // the dates
    const cells = [], weeks = monthGrid(Y, M, c.weekStart), taken = o.taken || {};
    let selected = o.selected || null;
    const kindOf = (cell) => {
      if (print) return cell.inMonth ? "date" : "past";
      if (!cell.inMonth || cell.iso < now.iso || (Date.parse(cell.iso) - Date.parse(now.iso)) / 864e5 > c.days) return "past";
      return slotsFor(c, cell.iso, now, taken[cell.iso], null).some((s) => s.free) ? "available" : "full";
    };
    if (!selected && !print) { for (const w of weeks) for (const cell of w) if (!selected && kindOf(cell) === "available") selected = cell.iso; }
    weeks.forEach((w, r) => w.forEach((cell, i) => {
      const kd = kindOf(cell), x = box.x + P + cw * i, y = gridTop + ch * r, isT = cell.iso === now.iso, sel = cell.iso === selected;
      const ss = sel ? st.selected : kd === "available" ? st.available : kd === "full" ? st.full : kd === "date" ? st.date : st.past;
      const inset = Math.max(1, Math.round(2 * k));
      chip(ss, x + inset, y + inset, cw - 2 * inset, ch - 2 * inset);
      if (isT && !sel) { g.lineWidth = Math.max(1, 1.5 * k); g.strokeStyle = st.today.color; rr(g, x + inset, y + inset, cw - 2 * inset, ch - 2 * inset, st.today.radius * k); g.stroke(); }
      text(String(cell.d), isT && !sel ? Object.assign({}, ss, { color: st.today.color, bold: st.today.bold, font: st.today.font, size: st.today.size }) : ss, x + cw / 2, y + ch / 2);
      cells.push({ iso: cell.iso, x, y, w: cw, h: ch, kind: sel ? "selected" : kd, today: isT });
    }));
    // the chosen day's times + the Book button
    if (showTimes && selected) {
      const ty = box.y + box.h - P - timesH, sl = slotsFor(c, selected, now, taken[selected], null);
      g.strokeStyle = st.frame.color; g.lineWidth = Math.max(1, k); g.beginPath(); g.moveTo(box.x + P, ty); g.lineTo(box.x + box.w - P, ty); g.stroke();
      const sw = (box.w - 2 * P - 3 * 6 * k) / 4, sh = Math.round(st.slot.size * k * 2.1);
      sl.slice(0, 8).forEach((s, i) => {
        const x = box.x + P + (i % 4) * (sw + 6 * k), y = ty + 8 * k + Math.floor(i / 4) * (sh + 6 * k), sty = s.free && !(i === 2 && !o.taken) ? st.slot : st.taken;   // one shown as taken so its style can be seen
        chip(sty, x, y, sw, sh); text(s.time, sty, x + sw / 2, y + sh / 2);
      });
      const bw = Math.round(110 * k), bh = Math.round(st.button.size * k * 2.3), by = box.y + box.h - P - bh;
      chip(st.button, box.x + box.w - P - bw, by, bw, bh); text("Book", st.button, box.x + box.w - P - bw / 2, by + bh / 2);
    }
    return { selected, cells, month: `${Y}-${pad(M)}` };
  }
  /** now in a time zone -> {iso, min} */
  function nowIn(tz, at) {
    const d = at || new Date();
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
      return { iso: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
    } catch (e) { return { iso: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
  }
  /* ================================ the website ================================ */
  const sq = (s) => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
  const SCHEMA = `-- 📅 Booking calendars (bitGen Studio)
CREATE TABLE IF NOT EXISTS bg_calendars (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'appointments',
  slot_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  days_ahead SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  lead_hours SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  capacity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  week_start TINYINT UNSIGNED NOT NULL DEFAULT 1,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  ask_phone TINYINT(1) NOT NULL DEFAULT 1,
  ask_notes TINYINT(1) NOT NULL DEFAULT 1,
  buffer_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_per_day SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  approve TINYINT(1) NOT NULL DEFAULT 0,
  cancel_hours SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  send_emails TINYINT(1) NOT NULL DEFAULT 0,
  notify_email VARCHAR(200) NOT NULL DEFAULT '',
  from_email VARCHAR(200) NOT NULL DEFAULT '',
  admin_edited TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bg_cal_services (
  calendar_id INT UNSIGNED NOT NULL,
  sort TINYINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  minutes SMALLINT UNSIGNED NOT NULL,
  price VARCHAR(20) NOT NULL DEFAULT '',
  PRIMARY KEY (calendar_id, sort),
  CONSTRAINT fk_bg_cal_services FOREIGN KEY (calendar_id) REFERENCES bg_calendars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bg_cal_hours (
  calendar_id INT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  opens TIME NOT NULL,
  closes TIME NOT NULL,
  PRIMARY KEY (calendar_id, weekday, opens),
  CONSTRAINT fk_bg_cal_hours FOREIGN KEY (calendar_id) REFERENCES bg_calendars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bg_cal_closed (
  calendar_id INT UNSIGNED NOT NULL,
  day DATE NOT NULL,
  reason VARCHAR(200) NOT NULL DEFAULT '',
  source VARCHAR(10) NOT NULL DEFAULT 'studio',
  PRIMARY KEY (calendar_id, day),
  CONSTRAINT fk_bg_cal_closed FOREIGN KEY (calendar_id) REFERENCES bg_calendars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bg_cal_bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  calendar_id INT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(200) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  notes TEXT,
  service VARCHAR(80) NOT NULL DEFAULT '',
  status VARCHAR(12) NOT NULL DEFAULT 'booked',
  token CHAR(32) NOT NULL DEFAULT '',
  cancelled_at DATETIME NULL,
  client_id INT UNSIGNED NULL,
  admin_note VARCHAR(500) NOT NULL DEFAULT '',
  source VARCHAR(10) NOT NULL DEFAULT 'website',
  ip VARCHAR(45) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX bg_cal_when (calendar_id, starts_at),
  INDEX bg_cal_token (token),
  CONSTRAINT fk_bg_cal_bookings FOREIGN KEY (calendar_id) REFERENCES bg_calendars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE OR REPLACE VIEW bg_cal_upcoming AS
  SELECT c.name AS calendar, b.starts_at, b.ends_at, b.service, b.status, b.name, b.email, b.phone, b.notes, b.created_at
  FROM bg_cal_bookings b JOIN bg_calendars c ON c.id = b.calendar_id
  WHERE b.status IN ('booked', 'pending') AND b.starts_at >= NOW() ORDER BY b.starts_at;
`;
  function schemaSql() { return SCHEMA; }
  /** 2.847.0: the columns a 2.846.0 database lacks - each run on its own, "duplicate column" = already there (MySQL has no
   *  ADD COLUMN IF NOT EXISTS) */
  const UPGRADE = ["ALTER TABLE bg_calendars ADD COLUMN buffer_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0", "ALTER TABLE bg_calendars ADD COLUMN max_per_day SMALLINT UNSIGNED NOT NULL DEFAULT 0",
    "ALTER TABLE bg_calendars ADD COLUMN approve TINYINT(1) NOT NULL DEFAULT 0", "ALTER TABLE bg_calendars ADD COLUMN cancel_hours SMALLINT UNSIGNED NOT NULL DEFAULT 24",
    "ALTER TABLE bg_calendars ADD COLUMN send_emails TINYINT(1) NOT NULL DEFAULT 0", "ALTER TABLE bg_calendars ADD COLUMN notify_email VARCHAR(200) NOT NULL DEFAULT ''",
    "ALTER TABLE bg_calendars ADD COLUMN from_email VARCHAR(200) NOT NULL DEFAULT ''", "ALTER TABLE bg_cal_bookings ADD COLUMN service VARCHAR(80) NOT NULL DEFAULT ''",
    "ALTER TABLE bg_cal_bookings ADD COLUMN token CHAR(32) NOT NULL DEFAULT ''", "ALTER TABLE bg_cal_bookings ADD COLUMN cancelled_at DATETIME NULL", "ALTER TABLE bg_cal_bookings ADD INDEX bg_cal_token (token)",
    // 2.848.0: the admin side - days closed on the website kept apart, hours / services edited there kept, bookings tied to clients
    "ALTER TABLE bg_cal_closed ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'studio'", "ALTER TABLE bg_calendars ADD COLUMN admin_edited TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE bg_cal_bookings ADD COLUMN client_id INT UNSIGNED NULL", "ALTER TABLE bg_cal_bookings ADD COLUMN admin_note VARCHAR(500) NOT NULL DEFAULT ''",
    "ALTER TABLE bg_cal_bookings ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'website'"];
  function upgradeSql() { return UPGRADE.slice(); }
  /** this calendar's row + its opening hours (run again = updated, bookings kept). 2.848.0: hours + services edited on the
   *  website's admin (admin_edited = 1) are kept unless opt.force; days closed there (source 'admin') are always kept */
  function seedSql(cal0, opt) {
    const c = clean(cal0), o = opt || {}, mine = `slug = ${sq(c.slug)} AND admin_edited = 0`;
    const id = `(SELECT id FROM bg_calendars WHERE ${mine})`, sel = `FROM bg_calendars WHERE ${mine}`, any = `FROM bg_calendars WHERE slug = ${sq(c.slug)}`;
    const cols = "slug, name, kind, slot_minutes, days_ahead, lead_hours, capacity, week_start, timezone, ask_phone, ask_notes, buffer_minutes, max_per_day, approve, cancel_hours, send_emails, notify_email, from_email";
    const vals = [sq(c.slug), sq(c.name), sq(c.kind), c.slot, c.days, c.lead, c.cap, c.weekStart, sq(c.tz), c.phone ? 1 : 0, c.notes ? 1 : 0, c.buffer, c.maxDay, c.approve ? 1 : 0, c.cancelHours, c.emails ? 1 : 0, sq(c.owner), sq(c.from)];
    const out = [`INSERT INTO bg_calendars (${cols}) VALUES (${vals.join(", ")}) ON DUPLICATE KEY UPDATE ${cols.split(", ").slice(1).map((k) => `${k} = VALUES(${k})`).join(", ")};`];
    if (o.force) out.push(`UPDATE bg_calendars SET admin_edited = 0 WHERE slug = ${sq(c.slug)};`);
    out.push(`DELETE FROM bg_cal_hours WHERE calendar_id = ${id};`, `DELETE FROM bg_cal_services WHERE calendar_id = ${id};`,
      `DELETE FROM bg_cal_closed WHERE calendar_id = (SELECT id ${any}) AND source = 'studio';`);
    c.hours.forEach((day, wd) => day.forEach(([a, b]) => out.push(`INSERT INTO bg_cal_hours (calendar_id, weekday, opens, closes) SELECT id, ${wd}, '${a}:00', '${b === "24:00" ? "23:59:59" : b + ":00"}' ${sel};`)));
    c.services.forEach((v, i) => out.push(`INSERT INTO bg_cal_services (calendar_id, sort, name, minutes, price) SELECT id, ${i}, ${sq(v.name)}, ${v.mins}, ${sq(v.price)} ${sel};`));
    for (const v of c.closed) out.push(`INSERT IGNORE INTO bg_cal_closed (calendar_id, day, reason, source) SELECT id, '${v.day}', ${sq(v.reason)}, 'studio' ${any};`);
    return out.join("\n") + "\n";
  }
  const fam = (f) => (f === "system-ui" ? "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif" : `'${f}',system-ui,sans-serif`);
  const decl = (s, extra) => `font-family:${fam(s.font)};font-size:${s.size}px;color:${s.color};${s.bg ? `background:${s.bg};` : ""}font-weight:${s.bold ? 700 : 400};border-radius:${s.radius}px;${extra || ""}`;
  /** the website's CSS for one calendar (its own class .bgcal-<slug>) */
  function cssFor(cal0, maxW) {
    const c = clean(cal0), s = c.style, r = `.bgcal-${c.slug}`;
    return `${r}{${decl(s.frame, `border:1px solid ${s.frame.color};padding:14px;max-width:${Math.max(280, Math.round(maxW || 460))}px;margin:0 auto`)}}
${r} .bgcal-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
${r} .bgcal-month{${decl(s.month, "margin:0;flex:1;text-align:center")}}
${r} .bgcal-nav{${decl(s.nav, "text-decoration:none;display:inline-flex;align-items:center;justify-content:center;min-width:2em;min-height:2em")}}
${r} .bgcal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
${r} .bgcal-wd{${decl(s.weekday, "text-align:center;padding:4px 0")}}
${r} .bgcal-day{${decl(s.date, "text-align:center;padding:8px 0;text-decoration:none;display:block;border:1.5px solid transparent")}}
${r} .bgcal-day.today{${decl(s.today, `text-align:center;border-color:${s.today.color}`)}}
${r} .bgcal-day.open{${decl(s.available)}}
${r} .bgcal-day.full{${decl(s.full)}}
${r} .bgcal-day.past{${decl(s.past)}}
${r} .bgcal-day.sel{${decl(s.selected)}}
${r} .bgcal-times{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid ${s.frame.color}}
${r} .bgcal-slot{${decl(s.slot, "text-decoration:none;padding:6px 12px;display:inline-block")}}
${r} .bgcal-slot.taken{${decl(s.taken, "padding:6px 12px;text-decoration:line-through")}}
${r} .bgcal-form{display:grid;gap:8px;margin-top:12px}
${r} .bgcal-form input,${r} .bgcal-form textarea{font:inherit;padding:8px;border:1px solid ${s.frame.color};border-radius:6px;width:100%}
${r} .bgcal-btn{${decl(s.button, "border:0;padding:9px 18px;cursor:pointer;justify-self:start")}}
${r} .bgcal-msg{margin:10px 0 0;font-weight:600}
@media (max-width:480px){${r}{padding:8px}${r} .bgcal-day{padding:6px 0}}
`;
  }
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  /** the month as plain HTML (the preview, a static site): open days marked, nothing to book */
  function staticHtml(cal0, now0) {
    const c = clean(cal0), now = now0 || nowIn(c.tz), [Y, M] = now.iso.slice(0, 7).split("-").map(Number);
    const cells = monthGrid(Y, M, c.weekStart).flat().map((cell) => {
      const sl = cell.inMonth ? slotsFor(c, cell.iso, now, null, null) : [];
      const cls = !cell.inMonth || cell.iso < now.iso ? "past" : sl.some((s) => s.free) ? "open" : "full";
      return `<span class="bgcal-day ${cls}${cell.iso === now.iso ? " today" : ""}">${cell.d}</span>`;
    }).join("");
    return `<div class="bgcal bgcal-${c.slug}" id="bgcal-${c.slug}"><div class="bgcal-head"><span class="bgcal-nav">‹</span><h3 class="bgcal-month">${esc(monthName(Y, M, c.lang))}</h3><span class="bgcal-nav">›</span></div>`
      + `<div class="bgcal-grid">${dayNames(c.lang, c.weekStart).map((n) => `<span class="bgcal-wd">${esc(n)}</span>`).join("")}${cells}</div>`
      + `<p class="bgcal-msg">${esc(c.name)}: booking opens on the PHP + MySQL website.</p></div>`;
  }
  const api = { KINDS, FONTS, STYLE_TYPES, DEFAULT_STYLE, clean, cleanStyle, cleanHours, slugOf, monthGrid, slotsFor, nowIn, draw, monthName, dayNames, schemaSql, upgradeSql, seedSql, cssFor, staticHtml };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.H3SiteCal = api;
})(typeof window !== "undefined" ? window : globalThis);
