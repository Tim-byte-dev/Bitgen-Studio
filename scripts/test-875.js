#!/usr/bin/env node
/* bitGen Studio — 2.875.0 units: the business details (lib/businessProfiles.js - a JSON file, routes/businessProfiles.js), the
 * plan told the business (lib/createAi.js - letterhead + poster, the details used exactly, brand colours), the layouts with the
 * logo / the back (ext/imageeditdock/pccreate.js), the dialog's pure parts (pcbizinfo.js), Properties for a drawing / text
 * (pcpropsauto.js) and the ✕ on every dialog (static/dialogclose.js, in jsdom).
 * Tim (verbatim): "when user clicks image-edit ai template business card, letterhead,flyer,poster the get user details, name of
 * comany, name, address, phone number, list of services provided. company logo (image) , brand colors, description of card user
 * would like front and description of card back - this will be in a new dialog. add an x(close) button to the top right of
 * every dialog. when user selects any drawing or text element show properties docker, save all the contact information to a
 * json file for now, later we will add it to mariadb" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PNG1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=";
(async () => {
  /* ---- 1 the JSON file */
  const B = require("../lib/businessProfiles");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "biz875-")); B.setRoot(tmp);
  const c = B.clean({ company: "  Rosie's   Bakery ", phone: "0412 345 678", services: "• Sourdough\n- Cakes\n\nWholesale", colours: ["#B45309", "#fff", "nope", "#b45309"], front: "warm\r\ncream" });
  check("clean: words tidied, services one a line without bullets, colours #rrggbb once (short ones grown), the front keeps its lines",
    c.company === "Rosie's Bakery" && c.services.join("|") === "Sourdough|Cakes|Wholesale" && c.colours.join() === "#b45309,#ffffff" && c.front === "warm\ncream" && c.email === "", c);
  let e0 = ""; try { B.save({ phone: "1" }); } catch (e) { e0 = e.message; }
  check("save: a company or a name is needed", /company's name or your name/.test(e0), e0);
  const p1 = B.save({ company: "Rosie's Bakery", name: "Rosie Smith", address: "12 Main St\nSpringfield", phone: "0412 345 678", services: ["Bread", "Cakes"], colours: ["#b45309"] }, { logoDataUrl: PNG1 });
  const raw = JSON.parse(fs.readFileSync(path.join(tmp, "profiles.json"), "utf8"));
  check("save: kept in business/profiles.json (version 1, last = it) + the logo in business/logos/<id>.png, its address given",
    raw.version === 1 && raw.last === p1.id && raw.profiles[0].company === "Rosie's Bakery" && raw.profiles[0].logo === p1.id + ".png" && fs.existsSync(path.join(tmp, "logos", p1.id + ".png"))
    && /^\/api\/business\/profiles\/[^/]+\/logo\?v=/.test(p1.logo_url) && B.logoPath(p1.id).endsWith(p1.id + ".png"), { raw, p1 });
  const p2 = B.save({ id: p1.id, company: "Rosie's Bakery", name: "Rosie Smith", phone: "0400 000 000" }, { dropLogo: true });
  check("save with its id: the same profile updated (one row), the logo dropped when asked", p2.id === p1.id && B.list().profiles.length === 1 && p2.phone === "0400 000 000" && !p2.logo && !fs.existsSync(path.join(tmp, "logos", p1.id + ".png")), p2);
  let e1 = ""; try { B.save({ company: "X" }, { logoDataUrl: "data:text/html;base64,PGI+" }); } catch (e) { e1 = e.message; }
  check("a logo that is not a picture: refused", /PNG, JPEG, WebP, SVG or GIF/.test(e1), e1);
  check("remove", B.remove(p1.id) === true && !B.list().profiles.some((x) => x.id === p1.id) && B.remove(p1.id) === false);
  check("shaped for MariaDB later: the columns listed (FIELDS), services / colours as their own lists, git-ignored /business/",
    B.FIELDS.map((f) => f[0]).join() === "company,name,role,address,phone,email,website,front,back,abn" && /^\/business\/$/m.test(src(".gitignore")) && /later we will add it to mariadb/.test(src("lib/businessProfiles.js")));
  const RB = src("routes/businessProfiles.js");
  check("routes: GET / POST / DELETE /api/business/profiles + the logo; mounted from routes/index.js",
    /app\.get\("\/api\/business\/profiles"/.test(RB) && /app\.post\("\/api\/business\/profiles"/.test(RB) && /app\.delete\("\/api\/business\/profiles\/:id"/.test(RB) && /\/api\/business\/profiles\/:id\/logo/.test(RB)
    && /require\("\.\/businessProfiles"\)\.mount\(app\)/.test(src("routes/index.js")));
  /* ---- 2 the plan */
  const A = require("../lib/createAi");
  let told = "";
  A.setComplete(async (o) => { told = o.messages[1].content; const k = /a (\w+)/.exec(o.messages[0].content)[1];
    return { ok: true, text: JSON.stringify(k === "business" ? { name: "R. Smith", role: "Baker", company: "Rosie's", phone: "000 INVENTED", email: "x@y.z", back: { heading: "What we bake", text: "Bread · Cakes" }, palette: { bg: "#000000", accent: "#00ff00", ink: "#ffffff" } }
      : k === "letterhead" ? { company: "Rosies", tagline: "Baked at dawn", contact: "made up", footer: "" } : { headline: "Big Bake Day", body: "Come along.", bullets: [], cta: "Visit us", contact: "made up", picture: "bread" }) }; });
  const biz = { company: "Rosie's Bakery", name: "Rosie Smith", role: "Owner", address: "12 Main St, Springfield", phone: "0412 345 678", email: "hello@rosies.example", website: "rosies.example", services: ["Sourdough", "Cakes", "Wholesale"], colours: ["#b45309", "#fff7ed", "#3b2f2f"], front: "cream, logo top right", back: "logo in the middle, the services" };
  const card = (await A.plan({ kind: "card", ask: "", business: biz })).plan;
  check("card: the LLM is told THE BUSINESS (details, services, colours, front + back); the details used exactly (its invented phone dropped)",
    /THE BUSINESS \(use these exactly/.test(told) && /Phone: 0412 345 678/.test(told) && /- Wholesale/.test(told) && /What the FRONT should be like: cream/.test(told) && /What the BACK should be like/.test(told)
    && card.phone === "0412 345 678" && card.email === "hello@rosies.example" && card.web === "rosies.example" && card.name === "Rosie Smith" && card.company === "Rosie's Bakery", { told, card });
  check("...the brand colours make the palette (main = accent, a light one = the background, a dark one = the ink); the back's words kept; services along",
    card.palette.accent === "#b45309" && card.palette.bg === "#fff7ed" && card.palette.ink === "#3b2f2f" && card.back.heading === "What we bake" && card.services.length === 3, card);
  const lh = (await A.plan({ kind: "letterhead", ask: "", business: biz })).plan;
  check("letterhead: a kind now; the company + one contact line (address · phone · email · web) from the details, the services as its foot, a white page",
    lh.kind === "letterhead" && lh.company === "Rosie's Bakery" && lh.contact === "12 Main St, Springfield  ·  0412 345 678  ·  hello@rosies.example  ·  rosies.example" && lh.footer === "Sourdough  ·  Cakes  ·  Wholesale" && lh.palette.bg === "#ffffff" && !/BACK/.test(told), lh);
  const po = (await A.plan({ kind: "poster", ask: "the big bake day", business: biz })).plan;
  check("poster: a kind now; no points from the LLM = the services; the contact from the details", po.kind === "poster" && po.bullets.join() === "Sourdough,Cakes,Wholesale" && /0412 345 678/.test(po.contact) && po.headline === "Big Bake Day", po);
  /* ---- 3 the layouts */
  const C = require("../ext/imageeditdock/pccreate.js");
  const logos = (pg) => pg.filter((e) => e && e.t === "logo");
  const cardP = Object.assign({}, card, { hasLogo: true });
  const cp = C.cardLayout(cardP, 1063, 650);
  check("card: the logo top right of the front and big on the back; the back says its heading + words", logos(cp[0]).length === 1 && logos(cp[0])[0].x > 600 && logos(cp[1]).length === 1
    && cp[1].some((e) => e && e.str === "What we bake") && cp[1].some((e) => e && e.str === "Bread · Cakes"), cp.map(logos));
  const noLogo = C.cardLayout(Object.assign({}, card, { hasLogo: false }), 1063, 650);
  check("...no logo: no logo box", !logos(noLogo[0]).length && !logos(noLogo[1]).length);
  const lp = C.letterheadLayout(Object.assign({}, lh, { hasLogo: true }), 1240, 1754);
  check("letterhead (A4): the logo top left, the company beside it, a rule under the head and over the foot, the contact at the foot; the letter's frame between",
    logos(lp[0]).length === 1 && logos(lp[0])[0].x < 200 && lp[0].some((e) => e && e.str === "Rosie's Bakery" && e.x > logos(lp[0])[0].x + logos(lp[0])[0].w) && lp.body && lp.body.y > 150 && lp.body.y + lp.body.h < 1754 * 0.9 && lp[0].some((e) => e && e.str === lh.contact && e.y > 1754 * 0.9), { body: lp.body });
  const pp = C.posterLayout(Object.assign({}, po, { hasLogo: true }), 1754, 2480);
  check("poster (A3): the logo, the headline biggest, the picture box with its idea, the points, the call to action", logos(pp[0]).length === 1 && pp[0].some((e) => e && e.t === "picture" && e.prompt === "bread")
    && pp[0].find((e) => e && e.str === "Big Bake Day").size === Math.max(...pp[0].filter((e) => e && e.t === "text").map((e) => e.size)) && pp[0].some((e) => e && e.str === "Visit us"));
  const fl = C.flyerLayout(Object.assign({}, po, { kind: "flyer", hasLogo: true, back: { heading: "About us", text: "Family bakers" }, services: ["Bread"] }), 1240, 1754);
  check("flyer with a back: two pages - the back's heading, words, services, the contact, the logo", fl.length === 2 && fl[1].some((e) => e && e.str === "About us") && fl[1].some((e) => e && e.str === "•  Bread") && logos(fl[1]).length === 1);
  check("kinds: letterhead + poster; the business four", C.KINDS.map((k) => k[0]).join() === "document,story,flyer,brochure,card,letterhead,poster,website,invoice,layered" && /* 3.13.0: + layered */  C.BIZ_KINDS.join() === "card,letterhead,flyer,poster"
    && C.kindOf("make a letterhead for Acme") === "letterhead" && C.kindOf("design a poster for the fair") === "poster" && C.kindOf("make a flyer") === "flyer");
  const PC = src("ext/imageeditdock/pccreate.js");
  check("pccreate: a click on one of the four in ✨ Create opens the Business details dialog with what is typed; the logo laid in; the letter in a WP frame",
    /if \(!BIZ_KINDS\.includes\(r\.value\) \|\| !E\.bizInfo\) return;/.test(PC) && /E\.bizInfo\.dialog\(r\.value, \{ ask, pictures: pics \}\)/.test(PC) && /if \(e\.t === "logo"\)/.test(PC) && /E\.docText\.addFrame\(pages\.body\.x/.test(PC)
    && /letterhead: \[\{ preset: "A4"/.test(PC) && /poster: \[\{ preset: "A3", wmm: 297, hmm: 420/.test(PC));
  /* ---- 4 the dialog's pure parts */
  const Z = require("../ext/imageeditdock/pcbizinfo.js");
  const f = Z.fromForm({ company: " Acme ", services: "a\n\n b ", colours: [{ on: true, hex: "#AABBCC" }, { on: false, hex: "#000000" }, { on: true, hex: "bad" }], front: "f", back: "b" });
  check("fromForm: trimmed, services one a line, only the ticked colours", f.company === "Acme" && f.services.join() === "a,b" && f.colours.join() === "#aabbcc" && f.back === "b" && f.id === undefined, f);
  check("sideLabels: a card + a flyer have a back, a letterhead / poster do not", !!Z.sideLabels("card").back && /one-sided/.test(Z.sideLabels("flyer").back) && Z.sideLabels("letterhead").back === null && Z.sideLabels("poster").back === null);
  const ZS = src("ext/imageeditdock/pcbizinfo.js");
  check("the dialog: saved details ▾ + 🗑, company, name, role, phone, email, website, address, services, the logo (📂, shown, ✕), three brand colours, the front / back; ✨ Create saves then makes it",
    ["pcbzPick", "pcbzDel", "pcbzCompany", "pcbzName", "pcbzRole", "pcbzPhone", "pcbzEmail", "pcbzWeb", "pcbzAddr", "pcbzServ", "pcbzLogoBtn", "pcbzLogoFile", "pcbzLogoNo", "pcbzCol", "pcbzCon", "pcbzFront", "pcbzBack"].every((id) => ZS.includes('id="' + id + '"') || ZS.includes(id + '"'))
    && /win\.fetch\("\/api\/business\/profiles", \{ method: "POST"/.test(ZS) && /E\.create\.make\(\{ kind: k, ask: opt\.ask \|\| "", pictures: pics, business: saved(, cardSize: [^}]+)? \}\)/.test(ZS));   // 2.876.0: + the card size
  /* ---- 5 Properties for a drawing / text */
  const PA = require("../ext/imageeditdock/pcpropsauto.js");
  check("isDrawing: shapes, texts, sketches, WP frames - not pictures, groups or adjustments",
    PA.isDrawing({ type: "shape" }) && PA.isDrawing({ type: "text" }) && PA.isDrawing({ type: "sketch" }) && PA.isDrawing({ type: "doc" }) && PA.isDrawing({ type: "pixel", shape: {} })
    && !PA.isDrawing({ type: "pixel" }) && !PA.isDrawing({ type: "group" }) && !PA.isDrawing({ type: "adjust" }) && !PA.isDrawing(null));
  const ej = src("ext/imageeditdock/ext.json"), ie = src("ext/imageeditdock/imageedit.js");
  check("wired: pcbizinfo + pcpropsauto after pccreate in ext.json, installed after PCCreate (after PCTabDock - reveal)",
    /"pccreate\.js", "pcbizinfo\.js", "pcpropsauto\.js"/.test(ej) && ie.indexOf("PCPropsAuto.install(E)") > ie.indexOf("PCTabDock.install(E)") && ie.indexOf("PCBizInfo.install(E)") > ie.indexOf("PCCreate.install(E)"));
  /* ---- 6 the ✕ (jsdom) */
  let JSDOM = null; try { ({ JSDOM } = require("jsdom")); } catch (e) { JSDOM = null; }
  if (!JSDOM) check("jsdom is here", false);
  else {
    const dom = new JSDOM(`<!DOCTYPE html><body>
      <div class="kxdlg pcd" id="a"><h4>Box</h4><div class="bt"><button class="ghost cn">Cancel</button><button class="ghost ok">OK</button></div></div>
      <div class="kxdlg" id="b"><h4>Bare</h4></div>
      <div role="dialog" id="c"><button id="cc">Close</button></div>
      <div role="dialog" id="d"><button aria-label="Close dialog">✕</button></div>
      <div role="alertdialog" id="e" data-noclose></div></body>`, { runScripts: "outside-only", pretendToBeVisual: true });
    const w = dom.window; w.eval(src("static/dialogclose.js"));
    await new Promise((r) => setTimeout(r, 30));                // its start() waits for DOMContentLoaded
    w.H3DialogClose.scan();
    const D = (id) => w.document.getElementById(id), X = (id) => D(id).querySelector(":scope > .h3dlgx");
    let canceled = 0; D("a").querySelector(".cn").addEventListener("click", () => { canceled++; D("a").remove(); });
    let closed = 0; D("cc").addEventListener("click", () => closed++);
    check("✕ added (top right, a Close button) to a box with Cancel, a bare editor box and an ARIA dialog with a Close button; not to one with its own ✕ or data-noclose",
      X("a") && X("a").getAttribute("aria-label") === "Close" && X("b") && X("c") && !X("d") && !X("e") && /position:absolute;top:6px;right:6px/.test(w.document.getElementById("h3dlgxcss").textContent));
    X("a").click(); X("c").click(); X("b").click();
    check("✕ = the box's own Cancel / Close (its code runs); a bare editor box is removed", canceled === 1 && closed === 1 && !D("b") && !D("a"), { canceled, closed });
    const dg = w.document.createElement("dialog"); dg.innerHTML = "<p>Hi</p><button>Not now</button>"; w.document.body.appendChild(dg);
    w.H3DialogClose.scan();
    let cancelEv = 0; dg.addEventListener("cancel", () => cancelEv++);
    dg.close = () => { dg.dataset.closed = "1"; }; Object.defineProperty(dg, "open", { value: true, configurable: true });
    dg.querySelector(".h3dlgx").click();
    check("a <dialog>: ✕ = Esc (a cancelable cancel event, then close)", cancelEv === 1 && dg.dataset.closed === "1");
    const dg2 = w.document.createElement("dialog"); dg2.innerHTML = "<button>Stay</button>"; w.document.body.appendChild(dg2); w.H3DialogClose.scan();
    dg2.addEventListener("cancel", (e) => e.preventDefault()); dg2.close = () => { dg2.dataset.closed = "1"; }; Object.defineProperty(dg2, "open", { value: true, configurable: true });
    dg2.querySelector(".h3dlgx").click();
    check("...a dialog that refuses the cancel stays open (as with Esc)", !dg2.dataset.closed);
  }
  check("dialogclose.js in index.html; the lock screen never gets one (data-noclose)", /<script src="\/static\/dialogclose\.js"><\/script>/.test(src("static/index.html")) && /data-noclose/.test(src("static/locklayer.js")));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
