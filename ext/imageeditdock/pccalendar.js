/* pccalendar.js — 📅 A BOOKING CALENDAR ON THE CANVAS OF A WEB PROJECT (2.846.0), window.PCCalendar.
 *
 * Tim (verbatim): "add a calender tool for web projects so users can drag and drop a calendar onto the canvas and it will
 * automatically create it's sql and upload to db, for appointments, meetings etc. so users of the website that is being
 * deleloped can make appointments and see what times are available for appointments etc. add style elements so user can
 * style each object type (dates, month names etc.)"
 *
 *   📅 Calendar on the Web View's ribbon (Content): DRAG it onto the canvas (or click = the middle of the page), also
 *   Layer ▸ New ▸ 📅 Calendar. A calendar layer (L.cal) drawn by static/sitecal.js: the month, ‹ ›, weekday names, the dates
 *   (today, available, fully booked / closed, past, the chosen day), the chosen day's times and the Book button.
 *   As soon as it is dropped its tables + its row are made in the project's database (bitGen's MariaDB; ⬇ Download / Cancel
 *   when it is not installed yet) - POST /api/sitecal/install (lib/siteCal.js).
 *   📅 Calendar Settings… (double-click it, the right-click menu, the ribbon) - General (name, Appointments / Meetings /
 *   Classes, the time per booking, people per time, how far ahead, the notice, week start, time zone, language, questions),
 *   Opening hours (two ranges a day - a lunch break), Style (every object type: font, size, colour, background, bold,
 *   corners - shown on the canvas as you change it), Database (where, ⤒ Make the tables now, the SQL), Bookings (what the
 *   website's visitors booked). One undo step; the database updated after it.
 *   🌐 Build Website: the calendar is a working booking calendar on the PHP + MySQL site (inc/calendar.php), a month on a
 *   static one (lib/siteBuild.js).
 * Pure (Node: scripts/test-846.js): boxFollow, uniqueName, dbNameOf.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** the calendar's box after its layer was moved / scaled: box = where it was drawn, drawn = the pixels' box then, now =
   *  the pixels' box now -> the box now */
  function boxFollow(box, drawn, now) {
    if (!drawn || !now || !(drawn.w > 0) || !(drawn.h > 0)) return box;
    const kx = now.w / drawn.w, ky = now.h / drawn.h;
    return { x: Math.round(now.x + (box.x - drawn.x) * kx), y: Math.round(now.y + (box.y - drawn.y) * ky), w: Math.max(120, Math.round(box.w * kx)), h: Math.max(110, Math.round(box.h * ky)) };
  }
  /** "Appointments", "Appointments 2" … - a name no other calendar has */
  function uniqueName(base, taken) { const t = new Set(taken || []); if (!t.has(base)) return base; for (let i = 2; ; i++) if (!t.has(base + " " + i)) return base + " " + i; }
  /** the database of a web project: site_<its name> */
  function dbNameOf(site) { const s = String(site || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40); return s ? "site_" + s : "website"; }
  const pure = { boxFollow, uniqueName, dbNameOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, win, store } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.addCmd || !E.stage) return;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const api = async (u, body) => { const r = await win.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
    const C = () => root.H3SiteCal;
    let loading = null;
    const ready = () => (root.H3SiteCal ? Promise.resolve() : loading || (loading = new Promise((ok, no) => { const s = doc.createElement("script"); s.src = "/static/sitecal.js"; s.onload = ok; s.onerror = () => no(new Error("static/sitecal.js did not load")); doc.head.appendChild(s); })));
    ready().catch(() => {});
    const isCal = (L) => !!(L && L.cal && L.type === "pixel");
    const cals = () => S.layers.filter(isCal);
    const lastSite = () => { try { return JSON.parse(store.get("site.last", "{}")) || {}; } catch (e) { return {}; } };
    const alphaOf = (c) => { try { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; return root.PCSite && root.PCSite.alphaBox ? root.PCSite.alphaBox(d, c.width, c.height) : null; } catch (e) { return null; } };

    /** draw L.cal into a NEW canvas for the layer (the old one stays with the undo step) */
    function render(L, followMove) {
      if (!C() || !isCal(L)) return;
      if (followMove !== false && L.cal.drawn) { const now = alphaOf(L.canvas); if (now && (now.x !== L.cal.drawn.x || now.y !== L.cal.drawn.y || now.w !== L.cal.drawn.w || now.h !== L.cal.drawn.h)) L.cal.box = boxFollow(L.cal.box, L.cal.drawn, now); }
      const c = E.newCanvas(S.w, S.h), b = L.cal.box;
      C().draw(c.getContext("2d"), L.cal, b, { month: L.cal.month });
      L.canvas = c; L.ver = (L.ver || 0) + 1;
      L.cal.drawn = alphaOf(c) || { x: b.x, y: b.y, w: b.w, h: b.h };
    }
    const refresh = () => { if (E.refresh) E.refresh(); else E.renderLayers(); };

    /* ---- ⤒ the tables in the database (⬇ MariaDB first when it is not installed) */
    async function upload(L, quiet) {
      if (!isCal(L) || L.cal.mode === "print") return null;   // 2.847.0: a printed calendar has no database
      try {
        const r = await api("/api/sitecal/install", { cal: Object.assign({}, L.cal, L.cal.forceHours ? { forceHours: true } : {}) });
        if (L.cal.forceHours) delete L.cal.forceHours;
        L.cal.dbOk = true;
        if (!quiet) say(`📅 ${L.cal.name}: its tables are in the ${r.scope === "external" ? "your server's" : r.scope} database "${r.db}" (bg_calendars, bg_cal_hours, bg_cal_closed, bg_cal_bookings) - the website books into them`
          + (r.admin ? (r.admin.ok ? ` · 🔐 the admin database "${r.admin.db}" ${r.admin.created ? "made" : "ready"} (logins, login history, clients, pets, records, staff, the shop)` : ` · 🔐 the admin database "${r.admin.db}" was not made: ${r.admin.error}`) : ""));
        return r;
      } catch (e) {
        L.cal.dbOk = false;
        const missing = /mariadb|not installed|download|no database server/i.test(e.message) && L.cal.db.scope !== "external";
        if (missing) askDownload(L); else say(`📅 ${L.cal.name}: the database said "${e.message}" - 📅 Calendar Settings ▸ Database to try again`);
        return null;
      }
    }
    function askDownload(L) {
      E.ui.dialog("🗄 The database server is needed", `<div style="max-width:440px">The calendar keeps its bookings in MySQL / MariaDB. bitGen runs its own MariaDB (GPL-2.0, from archive.mariadb.org) on this computer only - it is not installed yet.</div>`, () => {
        (async () => {
          say("⬇ MariaDB - downloading …");
          try { await api("/api/db/download", {}); } catch (e) { say("⬇ MariaDB: " + e.message); return; }
          for (let i = 0; i < 900; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            let st = null; try { st = await api("/api/db/status"); } catch (e) { /* again */ }
            const ins = st && st.install;
            if (st && st.server) { say("⬇ MariaDB installed - making the calendar's tables …"); await upload(L); return; }
            if (ins && ins.error) { say("⬇ MariaDB: " + ins.error); return; }
            if (ins && ins.total && i % 5 === 0) say(`⬇ MariaDB ${Math.round(ins.got / ins.total * 100)} %`);
          }
        })();
      }, { okLabel: "⬇ Download" });
    }

    /* ---- a calendar onto the canvas */
    /** 2.847.0: a calendar goes on any page - in 🌐 Web View a website's booking calendar, else a printed month */
    const modeNow = (o) => (o && (o.mode === "print" || o.mode === "booking") ? o.mode : E.views && E.views.current && E.views.current() === "web" ? "booking" : "print");
    async function create(x, y, opt) {
      if (!S.w) return say("make a page first - File ▸ New, 📄 New Text Document or 🌐 New Website");
      await ready();
      const o = opt || {}, K = C().KINDS[o.kind] || C().KINDS.appointments, mode = modeNow(o), print = mode === "print";
      const name = uniqueName(o.name || (print ? "Calendar" : K.label), cals().map((L) => L.cal.name));
      const w = Math.round(Math.min(S.w * 0.45, Math.max(300, S.w * 0.32))), h = Math.round(w * (print ? 0.9 : 1.08));
      let bx = Math.round(Math.max(0, Math.min(S.w - w, (x == null ? S.w / 2 : x) - w / 2))), by = Math.round(Math.max(0, Math.min(S.h - h, (y == null ? S.h / 2 : y) - h / 2)));
      if (x != null && E.snapPoint) { const p = E.snapPoint([bx, by], null); bx = Math.round(p[0]); by = Math.round(p[1]); }   // snaps like any object
      let tz = "UTC"; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { /* UTC */ }
      const site = lastSite(), now = new Date();
      const cal = C().clean({ name, kind: o.kind || "appointments", mode, tz, lang: site.lang || "en", db: { scope: "project", name: dbNameOf(site.name || S.name) },
        month: print ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` : "" });
      cal.box = { x: bx, y: by, w, h };
      const L = E.makeLayer("📅 " + name, S.w, S.h); L.cal = cal;
      render(L, false);
      E.addLayer(L, "📅 calendar");
      refresh();
      if (print) say(`📅 ${name}: a printed month on the page - double-click it for its month, style and mode (🌐 a website booking calendar)`);
      else { say(`📅 ${name} on the page - making its tables in the database "${cal.db.name}" …`); upload(L); }
      return L;
    }
    const addCentre = () => create(null, null);

    /* ---- the settings */
    function settings(L0) {
      const L = L0 || E.layer(); if (!isCal(L)) return say("pick a calendar first");
      if (!C()) return ready().then(() => settings(L));
      const H = C(), c0 = JSON.parse(JSON.stringify(L.cal)), canvas0 = L.canvas;
      let cur = JSON.parse(JSON.stringify(L.cal));
      const kinds = Object.entries(H.KINDS).map(([k, v]) => `<option value="${k}"${cur.kind === k ? " selected" : ""}>${esc(v.label)}</option>`).join("");
      const wdN = H.dayNames("en", 0), wdFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      let zones = []; try { zones = Intl.supportedValuesOf("timeZone"); } catch (e) { /* none */ }
      const hourRow = (i) => { const r = cur.hours[i] || [], a = r[0] || ["09:00", "17:00"], b = r[1] || ["", ""];
        return `<tr><td><label><input type="checkbox" data-hopen="${i}"${r.length ? " checked" : ""}> ${wdFull[i]}</label></td><td><input type="time" data-h="${i}.0.0" value="${a[0]}"> – <input type="time" data-h="${i}.0.1" value="${a[1]}"></td><td>and <input type="time" data-h="${i}.1.0" value="${b[0]}"> – <input type="time" data-h="${i}.1.1" value="${b[1]}"></td></tr>`; };
      const order = [1, 2, 3, 4, 5, 6, 0];
      const svcRow = (v) => `<tr data-svc><td><input data-sv="name" value="${esc(v.name)}" maxlength="80" style="width:150px"></td><td><input type="number" data-sv="mins" value="${v.mins}" min="5" max="720" style="width:56px"></td><td><input data-sv="price" value="${esc(v.price)}" maxlength="20" style="width:70px"></td><td><button type="button" class="ghost" data-rm title="Remove">✕</button></td></tr>`;
      const closedRow = (v) => `<tr data-closed><td><input type="date" data-cd="day" value="${esc(v.day)}"></td><td><input data-cd="reason" value="${esc(v.reason)}" maxlength="200" style="width:200px"></td><td><button type="button" class="ghost" data-rm title="Remove">✕</button></td></tr>`;
      const fontOpts = (f) => H.FONTS.map((x) => `<option${x === f ? " selected" : ""}>${x}</option>`).join("");
      const styleRow = ([k, label, what]) => { const s = cur.style[k];
        return `<tr title="${esc(what)}"><td>${esc(label)}</td><td><select data-st="${k}.font">${fontOpts(s.font)}</select></td><td><input type="number" data-st="${k}.size" value="${s.size}" min="8" max="48" style="width:52px"></td>`
          + `<td><input type="color" data-st="${k}.color" value="${s.color}"></td><td><input type="color" data-st="${k}.bg" value="${s.bg || "#ffffff"}"><label title="No background"><input type="checkbox" data-st="${k}.nobg"${s.bg ? "" : " checked"}>⊘</label></td>`
          + `<td><input type="checkbox" data-st="${k}.bold"${s.bold ? " checked" : ""}></td><td><input type="number" data-st="${k}.radius" value="${s.radius}" min="0" max="40" style="width:48px"></td></tr>`; };
      const tab = (id, t, on, bk) => `<button type="button" class="ghost${on ? " on" : ""}" data-ctab="${id}"${bk ? " data-bk" : ""}>${t}</button>`;
      const html = `<div class="pccal-tabs" style="display:flex;gap:4px;margin-bottom:8px">${tab("gen", "General", true)}${tab("hours", "Opening hours", false, true)}${tab("rules", "Services & rules", false, true)}${tab("style", "Style")}${tab("db", "Database", false, true)}${tab("book", "Bookings", false, true)}</div>
        <div data-cpane="gen">
          <div class="rw"><span>Mode</span><select id="pccMode"><option value="booking"${cur.mode !== "print" ? " selected" : ""}>🌐 Website booking calendar</option><option value="print"${cur.mode === "print" ? " selected" : ""}>🖨 Printed calendar (a month)</option></select><span>Month</span><input type="month" id="pccMonth" value="${esc(cur.month || "")}" title="The month shown on the page - empty = this month"></div>
          <div class="rw"><span>Name</span><input id="pccName" value="${esc(cur.name)}" style="flex:1"><span>Kind</span><select id="pccKind">${kinds}</select></div>
          <div class="rw"><span>Each booking</span><input type="number" id="pccSlot" value="${cur.slot}" min="5" max="480" style="width:64px"> min<span>People per time</span><input type="number" id="pccCap" value="${cur.cap}" min="1" max="500" style="width:64px"></div>
          <div class="rw"><span>Book up to</span><input type="number" id="pccDays" value="${cur.days}" min="1" max="730" style="width:64px"> days ahead<span>Notice</span><input type="number" id="pccLead" value="${cur.lead}" min="0" max="720" style="width:64px"> hours</div>
          <div class="rw"><span>Week starts</span><select id="pccWs">${[1, 0, 6].map((d) => `<option value="${d}"${cur.weekStart === d ? " selected" : ""}>${wdFull[d]}</option>`).join("")}</select><span>Time zone</span><input id="pccTz" list="pccTzList" value="${esc(cur.tz)}" style="width:170px"><datalist id="pccTzList">${zones.map((z) => `<option value="${esc(z)}">`).join("")}</datalist></div>
          <div class="rw"><span>Language</span><input id="pccLang" value="${esc(cur.lang)}" style="width:60px"><label><input type="checkbox" id="pccPhone"${cur.phone ? " checked" : ""}> Ask for a phone number</label><label><input type="checkbox" id="pccNotes"${cur.notes ? " checked" : ""}> Ask for notes</label></div>
          <div style="color:var(--pc-dim);margin-top:6px">Visitors see the free times of each day - opening hours in steps of one booking, from the notice on, up to the days ahead - and book one with their name and email. A time is never booked twice (or more than its people per time).</div>
        </div>
        <div data-cpane="rules" style="display:none">
          <div style="font-weight:600;margin:2px 0 4px">Services</div>
          <table class="pccal-svc" id="pccSvc"><tr><th>Service</th><th>Minutes</th><th>Price</th><th></th></tr>${(cur.services || []).map(svcRow).join("")}</table>
          <div class="rw"><button type="button" class="ghost" id="pccSvcAdd">＋ Service</button><span style="color:var(--pc-dim)">None = every booking is one slot. With services a visitor picks one first; it takes its own minutes.</span></div>
          <div class="rw"><span>Buffer</span><input type="number" id="pccBuffer" value="${cur.buffer}" min="0" max="240" style="width:56px"> min round each booking<span>Most a day</span><input type="number" id="pccMaxDay" value="${cur.maxDay}" min="0" max="500" style="width:56px" title="0 = no limit"></div>
          <div class="rw"><label><input type="checkbox" id="pccApprove"${cur.approve ? " checked" : ""}> Bookings wait for my approval</label><span>Cancel online up to</span><input type="number" id="pccCancelH" value="${cur.cancelHours}" min="0" max="720" style="width:56px"> hours before</div>
          <div class="rw"><label><input type="checkbox" id="pccEmails"${cur.emails ? " checked" : ""}> Send e-mails</label><span>To me</span><input id="pccOwner" type="email" value="${esc(cur.owner)}" placeholder="you@your-site" style="width:150px"><span>From</span><input id="pccFrom" type="email" value="${esc(cur.from)}" placeholder="bookings@your-site" style="width:150px"></div>
          <div style="font-weight:600;margin:8px 0 4px">Closed days</div>
          <table class="pccal-svc" id="pccClosed"><tr><th>Day</th><th>Why (for you)</th><th></th></tr>${(cur.closed || []).map(closedRow).join("")}</table>
          <div class="rw"><button type="button" class="ghost" id="pccClosedAdd">＋ Closed day</button></div>
          <div style="color:var(--pc-dim);margin-top:6px">Each booking gets a link to see it, add it to a calendar (.ics) or cancel it. E-mails go out with the host's PHP mail() - the visitor's, and yours for each new or cancelled booking.</div>
        </div>
        <div data-cpane="hours" style="display:none"><table class="pccal-hours">${order.map(hourRow).join("")}</table><div style="color:var(--pc-dim);margin-top:6px">A second range makes a break (e.g. 9:00 – 12:30 and 13:30 – 17:00). Close single days: Services & rules ▸ Closed days.</div></div>
        <div data-cpane="style" style="display:none;max-height:52vh;overflow:auto"><table class="pccal-style"><tr><th>Object</th><th>Font</th><th>Size</th><th>Colour</th><th>Background</th><th>Bold</th><th>Corners</th></tr>${H.STYLE_TYPES.map(styleRow).join("")}</table>
          <div class="rw" style="margin-top:6px"><button type="button" class="ghost" id="pccStyleReset">↺ Default style</button><span style="color:var(--pc-dim)">The canvas shows each change; the website's CSS is made from the same style.</span></div></div>
        <div data-cpane="db" style="display:none">
          <div class="rw"><span>Where</span><select id="pccScope"><option value="project"${cur.db.scope === "project" ? " selected" : ""}>📁 This project's MariaDB</option><option value="global"${cur.db.scope === "global" ? " selected" : ""}>🌐 Global MariaDB</option><option value="external"${cur.db.scope === "external" ? " selected" : ""}>🖧 Your server (🗄 Database ▸ ⚙)</option></select><span>Database</span><input id="pccDb" value="${esc(cur.db.name)}" style="width:150px"></div>
          <div class="rw"><span>🔐 Admin database</span><input id="pccAdminDb" value="${esc(cur.db.admin || "myadmin")}" style="width:150px" title="The website's admin area (/admin/) keeps its logins, login history, clients, pets, records, staff and shop here - made when it is not there"><label title="Hours and services changed on the website's admin are kept when the calendar is uploaded again - tick to put these back"><input type="checkbox" id="pccForce"> Replace the hours + services edited on the website's admin</label></div>
          <div class="rw"><button type="button" class="ghost" id="pccMake">⤒ Make the tables now</button><span id="pccDbNote" style="color:var(--pc-dim)">${cur.dbOk ? "✓ in the database" : "not in the database yet"}</span></div>
          <details><summary>The SQL</summary><textarea id="pccSql" readonly rows="10" style="width:100%;font:11px monospace"></textarea></details>
          <div style="color:var(--pc-dim);margin-top:6px">The website's schema.sql has the same tables - import it on your host. The bookings: the view bg_cal_upcoming.</div>
        </div>
        <div data-cpane="book" style="display:none"><div class="rw"><button type="button" class="ghost" id="pccBookLoad">⟳ Load the bookings</button><span id="pccBookNote" style="color:var(--pc-dim)"></span></div><div id="pccBooks" style="max-height:44vh;overflow:auto"></div></div>`;
      const read = (d) => {
        const v = (id) => d.querySelector("#" + id), n = JSON.parse(JSON.stringify(cur));
        n.name = v("pccName").value; n.kind = v("pccKind").value; n.slot = +v("pccSlot").value; n.cap = +v("pccCap").value; n.days = +v("pccDays").value; n.lead = +v("pccLead").value;
        n.weekStart = +v("pccWs").value; n.tz = v("pccTz").value.trim(); n.lang = v("pccLang").value.trim(); n.phone = v("pccPhone").checked; n.notes = v("pccNotes").checked;
        n.hours = [0, 1, 2, 3, 4, 5, 6].map((i) => (d.querySelector(`[data-hopen="${i}"]`).checked ? [0, 1].map((r) => [d.querySelector(`[data-h="${i}.${r}.0"]`).value, d.querySelector(`[data-h="${i}.${r}.1"]`).value]).filter(([a, b]) => a && b) : []));
        for (const [k] of H.STYLE_TYPES) { const q = (p) => d.querySelector(`[data-st="${k}.${p}"]`); n.style[k] = { font: q("font").value, size: +q("size").value, color: q("color").value, bg: q("nobg").checked ? "" : q("bg").value, bold: q("bold").checked, radius: +q("radius").value }; }
        n.db = { scope: v("pccScope").value, name: v("pccDb").value.trim(), admin: v("pccAdminDb").value.trim() };
        n.mode = v("pccMode").value; n.month = v("pccMonth").value;
        n.services = [...d.querySelectorAll("[data-svc]")].map((r) => ({ name: r.querySelector('[data-sv="name"]').value, mins: +r.querySelector('[data-sv="mins"]').value, price: r.querySelector('[data-sv="price"]').value }));
        n.closed = [...d.querySelectorAll("[data-closed]")].map((r) => ({ day: r.querySelector('[data-cd="day"]').value, reason: r.querySelector('[data-cd="reason"]').value }));
        n.buffer = +v("pccBuffer").value; n.maxDay = +v("pccMaxDay").value; n.approve = v("pccApprove").checked; n.cancelHours = +v("pccCancelH").value;
        n.emails = v("pccEmails").checked; n.owner = v("pccOwner").value.trim(); n.from = v("pccFrom").value.trim();
        const c = H.clean(n); c.box = cur.box; c.drawn = cur.drawn; c.dbOk = cur.dbOk; return c;
      };
      const dbPart = (n) => [n.mode, n.name, n.slug, n.kind, n.slot, n.cap, n.days, n.lead, n.weekStart, n.tz, n.hours, n.phone, n.notes, n.db, n.services, n.buffer, n.maxDay, n.approve, n.cancelHours, n.emails, n.owner, n.from, n.closed];
      const modeTabs = (d) => { const pr = d.querySelector("#pccMode").value === "print"; d.querySelectorAll("[data-bk]").forEach((b) => { b.style.display = pr ? "none" : ""; }); d.querySelectorAll("#pccSlot,#pccCap,#pccDays,#pccLead,#pccPhone,#pccNotes").forEach((x) => { const r = x.closest(".rw"); if (r) r.style.opacity = pr ? ".45" : ""; }); };
      const preview = (d) => { cur = read(d); L.cal = cur; render(L, false); refresh(); const t = d.querySelector("#pccSql"); if (t) t.value = H.schemaSql() + "\n" + H.seedSql(cur); };
      E.ui.dialog("📅 Calendar Settings - " + c0.name, html, (d) => {
        const n = read(d); L.cal = c0; L.canvas = canvas0; const force = d.querySelector("#pccForce").checked;
        const dbChanged = JSON.stringify(dbPart(n)) !== JSON.stringify(dbPart(c0));
        E.structOp("📅 calendar settings", () => { L.cal = n; L.name = "📅 " + n.name; render(L, false); });
        refresh();
        if (force && n.mode !== "print") { L.cal.forceHours = true; upload(L); }
        else if (n.mode === "print") say(`📅 ${n.name}: a printed month (${n.month || "this month"})`);
        else if (dbChanged || !n.dbOk) upload(L); else say(`📅 ${n.name}: the style kept - 🌐 Build Website gives the site the same look`);
        return true;
      }, { okLabel: "OK", wide: true, cancel: () => { L.cal = c0; L.canvas = canvas0; refresh(); }, init: (d) => {
        d.querySelectorAll("[data-ctab]").forEach((b) => { b.onclick = () => { d.querySelectorAll("[data-ctab]").forEach((x) => x.classList.toggle("on", x === b)); d.querySelectorAll("[data-cpane]").forEach((p) => { p.style.display = p.dataset.cpane === b.dataset.ctab ? "" : "none"; }); }; });
        let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => { modeTabs(d); preview(d); }, 120); };
        d.addEventListener("input", (e) => { if (e.target.matches("input,select")) later(); }); d.addEventListener("change", (e) => { if (e.target.matches("input,select")) later(); });
        modeTabs(d);
        const addRow = (tbl, html) => { const tb = d.querySelector(tbl).tBodies[0] || d.querySelector(tbl); tb.insertAdjacentHTML("beforeend", html); later(); };
        d.querySelector("#pccSvcAdd").onclick = () => { if (d.querySelectorAll("[data-svc]").length < 20) addRow("#pccSvc", svcRow({ name: "Service " + (d.querySelectorAll("[data-svc]").length + 1), mins: cur.slot, price: "" })); };
        d.querySelector("#pccClosedAdd").onclick = () => { const t0 = new Date(); addRow("#pccClosed", closedRow({ day: t0.toISOString().slice(0, 10), reason: "" })); };
        d.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-rm]"); if (b) { b.closest("tr").remove(); later(); } });
        d.querySelector("#pccStyleReset").onclick = () => { for (const [k] of H.STYLE_TYPES) { const s = H.DEFAULT_STYLE[k], q = (p) => d.querySelector(`[data-st="${k}.${p}"]`); q("font").value = s.font; q("size").value = s.size; q("color").value = s.color; q("bg").value = s.bg || "#ffffff"; q("nobg").checked = !s.bg; q("bold").checked = s.bold; q("radius").value = s.radius; } preview(d); };
        d.querySelector("#pccMake").onclick = async () => { const note = d.querySelector("#pccDbNote"); note.textContent = "…"; cur = read(d); L.cal = cur; const r = await upload(L); note.textContent = r ? `✓ in "${r.db}" (${r.statements} statements)` : "✗ not made - see the status line"; };
        d.querySelector("#pccBookLoad").onclick = async () => {
          const note = d.querySelector("#pccBookNote"), box = d.querySelector("#pccBooks"); note.textContent = "…";
          try { const r = await api("/api/sitecal/bookings", { cal: read(d) }); note.textContent = r.rows.length + " booking(s) from today on";
            box.innerHTML = r.rows.length ? `<table class="pccal-books"><tr><th>When</th><th>Name</th><th>Email</th><th>Phone</th><th>Notes</th><th>Status</th></tr>${r.rows.map((x) => `<tr><td>${esc(x.starts)}${x.service ? " · " + esc(x.service) : ""}</td><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td>${esc(x.phone)}</td><td>${esc(x.notes)}</td><td>${esc(x.status)}</td></tr>`).join("")}</table>` : ""; }
          catch (e) { note.textContent = "✗ " + e.message; }
        };
        const t2 = d.querySelector("#pccSql"); if (t2) t2.value = H.schemaSql() + "\n" + H.seedSql(cur);
      } });
    }
    const css = doc.createElement("style");
    css.textContent = ".pccal-tabs button.on{border-color:var(--pc-accent);color:var(--pc-accent)}.pccal-style,.pccal-hours,.pccal-books{border-collapse:collapse;font-size:11px}.pccal-style td,.pccal-style th,.pccal-hours td,.pccal-books td,.pccal-books th{padding:2px 4px;text-align:left;white-space:nowrap}.pccal-style input[type=color]{width:30px;height:20px;padding:0}.pccal-svc{border-collapse:collapse;font-size:11px}.pccal-svc td,.pccal-svc th{padding:2px 4px;text-align:left}";
    doc.head.appendChild(css);

    /* ---- drag and drop onto the canvas (data type application/x-bitgen-calendar) */
    const TYPE = "application/x-bitgen-calendar";
    const ours = (e) => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes(TYPE));
    E.stage.addEventListener("dragover", (e) => { if (!ours(e)) return; e.preventDefault(); e.stopImmediatePropagation(); e.dataTransfer.dropEffect = "copy"; }, true);
    E.stage.addEventListener("drop", (e) => {
      if (!ours(e)) return; e.preventDefault(); e.stopImmediatePropagation();
      const [x, y] = E.pos(e), [kind, mode] = String(e.dataTransfer.getData(TYPE) || "appointments").split(":"); create(x, y, { kind, mode });
    }, true);
    /** make an element a drag source of a calendar */
    function dragSource(el, kind, mode) { if (!el || el._pccal) return; el._pccal = true; el.draggable = true; el.addEventListener("dragstart", (e) => { e.dataTransfer.setData(TYPE, (kind || "appointments") + (mode ? ":" + mode : "")); e.dataTransfer.setData("text/plain", "📅 calendar"); e.dataTransfer.effectAllowed = "copy"; }); }
    // double-click a calendar (Move tool / no tool) = its settings
    E.stage.addEventListener("dblclick", (e) => {
      if (!["move", "none", "", null, undefined].includes(S.tool)) return;
      const [x, y] = E.pos(e);
      for (let i = S.layers.length - 1; i >= 0; i--) { const L = S.layers[i]; if (!isCal(L) || L.visible === false) continue; const b = L.cal.drawn || L.cal.box; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { e.preventDefault(); e.stopImmediatePropagation(); E.setActive(i); settings(L); return; } }
    }, true);

    const C2 = E.ui.addCmd;
    C2("layer.newcalendar", "📅 Calendar", "", addCentre, { enabled: () => !!S.w });
    // 2.847.0: 📅 at the foot of the tool column - any view, dragged onto the page (a click = the middle of the page)
    const tools = doc.getElementById("kxTools");
    if (tools && !doc.getElementById("pcCalTool")) {
      const b = doc.createElement("button"); b.className = "ghost ietool"; b.id = "pcCalTool"; b.textContent = "📅";
      b.title = "📅 Calendar - drag it onto the page (a click puts it in the middle). In 🌐 Web View a website's booking calendar, else a printed month; double-click it for its settings";
      b.onclick = () => addCentre(); dragSource(b);
      const sw = tools.querySelector(".kxsw"); tools.insertBefore(b, sw || null);
    }
    const nl = E.ui.MENUS.find(([n]) => n === "Layer"); if (nl) { const New = nl[1].find((x) => x && typeof x === "object" && x.label === "New"); if (New) New.items.push("layer.newcalendar"); }
    C2("layer.calsettings", "📅 Calendar Settings…", "", () => settings(), { enabled: () => isCal(E.layer()) });
    const cs = E.ui.CMD.get("layer.calsettings"); Object.defineProperty(cs, "hidden", { get: () => !isCal(E.layer()), configurable: true });
    E.ui.layerCtxItems = (E.ui.layerCtxItems || []).concat(["layer.calsettings"]);
    E.ui.stageCtxItems = (E.ui.stageCtxItems || []).concat(["layer.calsettings"]);
    E.calendar = { create, addCentre, settings, render, upload, dragSource, isCal, ready, TYPE };
  }
  const PCCalendar = Object.assign({ install }, pure);
  if (root && root.document) root.PCCalendar = PCCalendar;
})(typeof window !== "undefined" ? window : globalThis);
