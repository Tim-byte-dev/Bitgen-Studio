#!/usr/bin/env node
/* bitGen Studio — 2.861.0 units: three more 🧩 web skills - 📅 booking widget (book.php on the CRM's booking calendar), 📰 blog and
 * news (the CRM's 📰 Posts, no PHP), 📍 contact and map (OpenStreetMap + contact.php into ✉ Messages): the skill files, inc/bg-db.php
 * the same in every skill, the ✨ routes, and each script in a page (jsdom): what visitors see is put in as text (no HTML from data). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const SK = path.join(ROOT, "web", "skills"), rd = (p) => fs.readFileSync(path.join(SK, p), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const K = require(path.join(ROOT, "lib/webSkills.js")), W = require(path.join(ROOT, "lib/webProject.js"));
  const L = K.list().skills, by = (id) => L.find((s) => s.id === id);
  check("three new skills listed: 📅 Booking widget + 📍 Contact and map (Customers, need PHP), 📰 Blog and news (Content)", by("booking") && by("booking").needs === "php" && by("booking").group === "Customers" && by("contact-map").needs === "php" && by("blog").group === "Content" && !by("blog").needs && L.length >= 14, L.map((s) => s.id));
  const missing = []; for (const id of ["booking", "blog", "contact-map"]) { const m = K.meta(id); for (const f of m.files.concat(m.head, m.scripts)) if (!fs.existsSync(path.join(SK, id, "files", f))) missing.push(id + ":" + f); for (const f of ["snippet.html", "SKILL.md"]) if (!fs.existsSync(path.join(SK, id, f))) missing.push(id + ":" + f); }
  check("...every file each skill.json names is there (+ snippet.html, SKILL.md)", !missing.length, missing);
  const dbs = ["cart-checkout", "booking", "contact-map"].map((id) => rd(id + "/files/inc/bg-db.php"));
  check("inc/bg-db.php is the SAME file in checkout, booking and contact (installed together it is one library file)", dbs.every((d) => d === dbs[0]) && K.LIB("inc/bg-db.php"));
  check("✨ routes: a booking ask -> booking, news -> blog, 'contact page with a map' -> contact-map", K.route("let people book an appointment").includes("booking") && K.route("our latest news").includes("blog") && K.route("a contact page with a map").includes("contact-map") && !K.route("our latest news").includes("ajax"));
  const B = rd("booking/files/book.php"), C = rd("contact-map/files/contact.php");
  check("book.php: the CRM's tables, the calendar's rules (hours 0 = Sunday, step, buffer, capacity, lead, days ahead, most a day), checked again under a lock, prepared statements only", /FROM bg_cal_hours/.test(B) && /bg_cal_closed/.test(B) && /capacity/.test(B) && /lead_hours/.test(B) && /max_per_day/.test(B) && /FOR UPDATE/.test(B) && /INSERT INTO bg_cal_bookings/.test(B) && !/query\(\s*["'][^"']*\$/.test(B) && /'pending' : 'booked'/.test(B));
  check("contact.php: into messages (status new), the robot trap, 5 a 10 minutes per address, CONTACT_EMAIL optional with header newlines removed", /INSERT INTO messages/.test(C) && /website/.test(C) && /INTERVAL 10 MINUTE/.test(C) && /CONTACT_EMAIL/.test(C) && /str_replace\(\["\\r", "\\n"\]/.test(C));
  // install into a project
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t861-")), PJ = path.join(tmp, "projects", "Cafe"); fs.mkdirSync(PJ, { recursive: true });
  W.setProjectDir(() => PJ); W.create(undefined, "Cafe");
  const r = K.install("booking"), r2 = K.install("contact-map");
  check("install: booking.html, book.php, inc/bg-db.php, its css / js into www; contact's bg-db.php the same library file (refreshed, not 'kept')", r.copied.includes("book.php") && r.copied.includes("inc/bg-db.php") && fs.existsSync(path.join(PJ, "www", "booking.html")) && r2.copied.includes("inc/bg-db.php") && r2.copied.includes("contact.php"), { r, r2 });
  // the scripts in a page (jsdom)
  const { JSDOM } = require("jsdom");
  const page = (html, fetchFn, url) => { const d = new JSDOM(html, { url: url || "https://cafe.example/blog.html", runScripts: "outside-only" }); d.window.fetch = fetchFn; return d; };
  const posts = { posts: [{ title: "Old news", date: "2026-01-02", body: "first", published: true }, { title: "<img src=x onerror=alert(1)>Opening day", date: "2026-11-01", image: "javascript:alert(1)", body: "We open Monday.\n\nSee https://example.com/menu for the menu.\nSecond line." }, { title: "Hidden", date: "2026-12-01", body: "x", published: false }] };
  const jf = (obj) => async () => ({ json: async () => obj });
  let d = page('<div data-bg-blog data-per="1"></div><script src="js/bg-blog.js"></script>', jf(posts));
  d.window.eval(rd("blog/files/js/bg-blog.js")); await sleep(30);
  const cards = d.window.document.querySelectorAll(".bg-blog-card");
  check("📰 blog: newest first, the unpublished one left out, pages of data-per (2 pages), the title as TEXT (no <img> made from it), a javascript: picture dropped", cards.length === 1 && /Opening day/.test(cards[0].textContent) && !d.window.document.querySelector(".bg-blog-card img") && d.window.document.querySelectorAll(".bg-blog-pages a, .bg-blog-pages span").length === 2 && !d.window.document.querySelector("[onerror]"), d.window.document.body.innerHTML.slice(0, 400));
  const slug = d.window.BGBlog.slugOf(posts.posts[1]);
  d = page('<div data-bg-blog></div>', jf(posts), "https://cafe.example/blog.html?p=" + slug); d.window.eval(rd("blog/files/js/bg-blog.js")); await sleep(30);
  const art = d.window.document.querySelector(".bg-blog-post");
  check("...one post (?p=): its paragraphs (a blank line), a line break kept, the web address a link (rel noopener), ← All news", art && art.querySelectorAll("p").length === 2 && art.querySelector("br") && art.querySelector('a[href="https://example.com/menu"][rel="noopener"]') && /All news/.test(art.textContent), art && art.innerHTML.slice(0, 500));
  d = page('<div data-bg-blog-latest data-n="1" data-href="news.html"></div>', jf(posts), "https://cafe.example/"); d.window.eval(rd("blog/files/js/bg-blog.js")); await sleep(30);
  check("...[data-bg-blog-latest]: the newest n as cards linking to the news page's post", (d.window.document.querySelector(".bg-blog-card") || {}).getAttribute && d.window.document.querySelector(".bg-blog-card").getAttribute("href") === "news.html?p=" + slug);
  // contact + map
  const sent = []; d = page(rd("contact-map/snippet.html"), async (u, o) => { sent.push([u, JSON.parse(o.body)]); return { json: async () => ({ ok: true, message: "Thank you, Ann - we will be in touch." }) }; }, "https://cafe.example/contact.html");
  d.window.eval(rd("contact-map/files/js/bg-contact.js")); await sleep(30);
  const ifr = d.window.document.querySelector(".bg-map iframe");
  check("📍 the map: an OpenStreetMap embed with the marker at data-lat / data-lon, '© OpenStreetMap contributors' linked, a bigger-map link", ifr && /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=[-\d.,]+&layer=mapnik&marker=-27\.469800,153\.025100$/.test(ifr.src) && /OpenStreetMap contributors/.test(d.window.document.querySelector(".bg-map-foot").textContent) && d.window.document.querySelector('.bg-map-foot a[href*="mlat=-27.469800"]'), ifr && ifr.src);
  const F = d.window.document.querySelector("form[data-bg-contact]"); F.elements.name.value = "Ann"; F.elements.email.value = "ann@example.com"; F.elements.message.value = "Hi there";
  F.dispatchEvent(new d.window.Event("submit", { cancelable: true })); await sleep(30);
  check("...the form posts to contact.php in the background (with the hidden trap field) and says thank you", sent.length === 1 && sent[0][0] === "contact.php" && sent[0][1].email === "ann@example.com" && "website" in sent[0][1] && /Thank you, Ann/.test(F.querySelector(".bg-contact-msg").textContent));
  const nm = page('<div data-bg-map data-lat="abc"></div>', jf({})); nm.window.eval(rd("contact-map/files/js/bg-contact.js")); await sleep(30);
  check("...no coordinates: no map, a note instead (no iframe to nowhere)", !nm.window.document.querySelector("iframe") && /data-lat/.test(nm.window.document.body.textContent));
  // booking widget
  const calls = []; const bf = async (u, o) => { calls.push([u, o && o.body ? JSON.parse(o.body) : null]);
    if (/info=1/.test(u)) return { json: async () => ({ ok: true, name: "Bookings", slot: 30, ahead: 30, askPhone: true, askNotes: false, services: [{ name: "Cut <b>", minutes: 30, price: "$40" }, { name: "Colour", minutes: 90, price: "" }] }) };
    if (/day=/.test(u)) return { json: async () => ({ ok: true, closed: false, times: [{ time: "09:00", free: false }, { time: "09:30", free: true }] }) };
    return { json: async () => ({ ok: true, message: "You are booked for Friday at 09:30." }) }; };
  d = page('<div data-bg-book data-calendar="bookings"></div>', bf, "https://cafe.example/booking.html"); d.window.eval(rd("booking/files/js/bg-book.js")); await sleep(40);
  const doc = d.window.document, opts = [...doc.querySelectorAll(".bg-book select option")].map((o) => o.textContent), btns = [...doc.querySelectorAll(".bg-book-times button")];
  check("📅 the widget: the services (as text - 'Cut <b>' not bold), today's times with the taken one off, notes hidden when the calendar does not ask", opts[0] === "Cut <b> (30 min, $40)" && !doc.querySelector(".bg-book b") && btns.length === 2 && btns[0].disabled && !btns[1].disabled && doc.querySelector('textarea[name="notes"]').closest("label").hidden, { opts, html: doc.body.innerHTML.slice(0, 300) });
  btns[1].click(); const fm = doc.querySelector(".bg-book-form");
  fm.querySelector('[name="name"]').value = "Bo"; fm.querySelector('[name="email"]').value = "bo@example.com";
  fm.dispatchEvent(new d.window.Event("submit", { cancelable: true })); await sleep(40);
  const post = calls.find((c) => c[1]);
  check("...a time picked + the form sent: day, time, service, name, email (+ the trap field) to book.php?cal=bookings; the answer said", fm.hidden && post && post[0] === "book.php?cal=bookings" && post[1].time === "09:30" && post[1].service === 0 && post[1].email === "bo@example.com" && "website" in post[1] && /booked for Friday/.test(doc.querySelector(".bg-book-msg").textContent), { post, msg: doc.querySelector(".bg-book-msg").textContent });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
