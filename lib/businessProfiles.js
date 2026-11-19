// bitGen Studio — lib/businessProfiles.js (2.875.0): THE BUSINESS DETAILS behind business cards, letterheads, flyers and posters.
//
// Tim (verbatim): "when user clicks image-edit ai template business card, letterhead,flyer,poster the get user details, name of
// comany, name, address, phone number, list of services provided. company logo (image) , brand colors, description of card user
// would like front and description of card back - this will be in a new dialog ... save all the contact information to a json
// file for now, later we will add it to mariadb".
//
// One JSON file for now - <install>/business/profiles.json - shaped like the MariaDB tables it will become (FIELDS = the columns
// of `business_profiles`, services = rows of `business_services`, colours of `business_colours`; the logo file stays on disk,
// the row keeps its name):
//   {version: 1, profiles: [{id, company, name, role, address, phone, email, website, services: [..], colours: ["#rrggbb"..],
//                            logo: "<id>.png" | "", front, back, card_size (2.876.0), abn (2.878.0), created, updated}], last: "<id>"}
//   FIELDS / list() / get(id) / save(p, {logoDataUrl}) -> profile / remove(id) / logoPath(id) / clean(p)
"use strict";
const fs = require("fs");
const path = require("path");

const FIELDS = [["company", 120], ["name", 120], ["role", 120], ["address", 300], ["phone", 60], ["email", 160], ["website", 200],
  ["front", 2000], ["back", 2000], ["abn", 20]];   // 2.878.0: + the ABN (tax invoices - lib/accounting.js)
/** 2.878.0: an Australian Business Number checked the ATO's way (11 digits; the first less 1; weights 10 1 3 5 7 9 11 13 15 17 19;
 *  the sum divides by 89) -> "51 824 753 556" | "" (none given); a wrong one throws a 400 */
function abn(v) {
  const d = String(v == null ? "" : v).replace(/[\s-]/g, "");
  if (!d) return "";
  if (!/^\d{11}$/.test(d)) throw Object.assign(new Error("an ABN is 11 digits"), { status: 400 });
  const W = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19], n = d.split("").map(Number); n[0] -= 1;
  if (n.reduce((s, x, i) => s + x * W[i], 0) % 89) throw Object.assign(new Error(`${v} is not a valid ABN (its check digits do not add up)`), { status: 400 });
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}
const MAX_SERVICES = 30, MAX_COLOURS = 5, MAX_LOGO = 10 * 1024 * 1024;
let ROOT = null;
const root = () => ROOT || path.join(require("./core").BASE, "business");
function setRoot(d) { ROOT = d || null; }
const file = () => path.join(root(), "profiles.json");
const logoDir = () => path.join(root(), "logos");

const line = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, n);
const hex = (v) => { const s = String(v || "").trim().toLowerCase(); return /^#[0-9a-f]{6}$/.test(s) ? s : /^#[0-9a-f]{3}$/.test(s) ? "#" + s.slice(1).split("").map((c) => c + c).join("") : ""; };
/** a profile as it is kept: every field a clean string, services one per line, colours #rrggbb */
function clean(p0) {
  const p = p0 && typeof p0 === "object" ? p0 : {}, out = {};
  for (const [k, n] of FIELDS) if (k !== "abn") out[k] = k === "front" || k === "back" || k === "address" ? line(String(p[k] || "").replace(/\r/g, ""), n).replace(/ ?\n ?/g, "\n") : line(p[k], n);
  const sv = Array.isArray(p.services) ? p.services : String(p.services || "").split(/\r?\n|;/);
  out.abn = abn(p.abn);
  out.services = sv.map((x) => line(String(x).replace(/^[•\-*·\s]+/, ""), 120)).filter(Boolean).slice(0, MAX_SERVICES);
  // 2.876.0: the business card's size (an id of ext/imageeditdock/pccreate.js CARD_SIZES - "au", "cr80"...; "" = the default)
  out.card_size = /^[a-z0-9-]{1,24}$/.test(String(p.card_size || "").trim().toLowerCase()) ? String(p.card_size).trim().toLowerCase() : "";
  out.colours = (Array.isArray(p.colours) ? p.colours : []).map(hex).filter(Boolean).filter((c, i, a) => a.indexOf(c) === i).slice(0, MAX_COLOURS);
  return out;
}
function read() {
  try { const o = JSON.parse(fs.readFileSync(file(), "utf8")); if (o && Array.isArray(o.profiles)) return o; } catch (e) { /* none yet */ }
  return { version: 1, profiles: [], last: "" };
}
function write(o) {
  fs.mkdirSync(root(), { recursive: true });
  fs.writeFileSync(file() + ".part", JSON.stringify(o, null, 1));
  fs.renameSync(file() + ".part", file());
}
const view = (p) => Object.assign({}, p, { logo_url: p.logo ? `/api/business/profiles/${encodeURIComponent(p.id)}/logo?v=${encodeURIComponent(p.updated || "")}` : "" });
function list() { const o = read(); return { profiles: o.profiles.map(view), last: o.last || "" }; }
function get(id) { const p = read().profiles.find((x) => x.id === String(id)); return p ? view(p) : null; }
function logoPath(id) { const p = read().profiles.find((x) => x.id === String(id)); return p && p.logo ? path.join(logoDir(), p.logo) : ""; }
/** a data: URL -> {buffer, ext} (PNG / JPEG / WebP / SVG / GIF) */
function fromDataUrl(u) {
  const m = /^data:(image\/(png|jpeg|jpg|webp|svg\+xml|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(u || ""));
  if (!m) throw Object.assign(new Error("the logo must be a PNG, JPEG, WebP, SVG or GIF picture"), { status: 400 });
  const buffer = Buffer.from(m[3].replace(/\s+/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_LOGO) throw Object.assign(new Error("the logo is empty or over 10 MB"), { status: 400 });
  const ext = { png: ".png", jpeg: ".jpg", jpg: ".jpg", webp: ".webp", "svg+xml": ".svg", gif: ".gif" }[m[2]];
  return { buffer, ext };
}
/** add or update (p.id) -> the kept profile; o.logoDataUrl = a new logo, o.dropLogo = none */
function save(p0, o) {
  const opt = o || {}, all = read(), now = new Date().toISOString();
  const c = clean(p0);
  if (!c.company && !c.name) throw Object.assign(new Error("give the company's name or your name"), { status: 400 });
  let p = p0 && p0.id ? all.profiles.find((x) => x.id === String(p0.id)) : null;
  if (!p) { p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), logo: "", created: now }; all.profiles.push(p); }
  Object.assign(p, c, { updated: now });
  if (opt.logoDataUrl) {
    const { buffer, ext } = fromDataUrl(opt.logoDataUrl);
    fs.mkdirSync(logoDir(), { recursive: true });
    if (p.logo) { try { fs.unlinkSync(path.join(logoDir(), p.logo)); } catch (e) { /* gone */ } }
    p.logo = p.id + ext;
    fs.writeFileSync(path.join(logoDir(), p.logo), buffer);
  } else if (opt.dropLogo && p.logo) { try { fs.unlinkSync(path.join(logoDir(), p.logo)); } catch (e) { /* gone */ } p.logo = ""; }
  all.last = p.id;
  write(all);
  return view(p);
}
function remove(id) {
  const all = read(), p = all.profiles.find((x) => x.id === String(id));
  if (!p) return false;
  if (p.logo) { try { fs.unlinkSync(path.join(logoDir(), p.logo)); } catch (e) { /* gone */ } }
  all.profiles = all.profiles.filter((x) => x !== p);
  if (all.last === p.id) all.last = all.profiles.length ? all.profiles[all.profiles.length - 1].id : "";
  write(all);
  return true;
}
module.exports = { FIELDS, abn, MAX_SERVICES, MAX_COLOURS, setRoot, root, clean, list, get, save, remove, logoPath, fromDataUrl };
