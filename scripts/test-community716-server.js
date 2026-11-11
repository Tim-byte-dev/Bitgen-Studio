#!/usr/bin/env node
/* bitGen Studio — 2.716.0: LANGUAGE PACKS on the Community server, over real HTTP (`php -S` on community/, SQLite):
 * a member uploads a pack (waits for an admin), the admin sees it and approves it (then anyone lists and downloads it) or
 * refuses it (the uploader sees why), a newer version replaces the same person's older one, an admin's upload is live at
 * once, delete (own / admin), and what is refused: not a zip, no pack.json, the master's "xx", English, no native name,
 * a path that climbs out, over 5 MB, a guest.
 * Tim: "if we could have a master pack so users can translate the strings and upload to tigerart for the community it
 * would be ideal". SKIP without php. */
"use strict";
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
if (spawnSync("php", ["-v"]).status !== 0) { console.log("SKIP: no php here - the 2.716.0 language pack server test did not run"); process.exit(0); }
const DIR = path.join(__dirname, "..", "community");
const LP = require("../lib/langPacks"), U = require("../lib/unzip"), Z = require("../lib/zipWrite");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bgc716-"));
const MAIL = path.join(TMP, "mail.log"), DB = path.join(TMP, "c.db");
let BASE = "", php = null;
async function call(action, body, token) {
  const r = await fetch(BASE + "/api.php?a=" + action, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}), body: JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (e) { j = {}; }
  return { status: r.status, j };
}
const ok = (r) => r.status === 200 && r.j.ok === true;
const err = (r, s, re) => r.status === s && r.j.ok === false && (!re || re.test(r.j.error));
const codeFor = (email) => { const m = fs.readFileSync(MAIL, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.to === email).pop(); return m.text.match(/\b(\d{6})\b/)[1]; };
const join = async (h) => { const e = h + "@example.com"; const r = await call("register", { handle: h, password: "pw-" + h + "-123", first_name: "F", last_name: "L", email: e }); await call("verify_email", { code: codeFor(e) }, r.j.token); return r.j.token; };
const MASTER = LP.masterZip();
function pack(meta, words) {
  const ents = U.entries(MASTER).map((e) => ({ name: e.name, data: U.read(MASTER, e) }));
  const pj = ents.find((e) => e.name === "pack.json"), ui = ents.find((e) => e.name === "ui.json");
  pj.data = JSON.stringify(Object.assign(JSON.parse(pj.data), meta));
  const u = JSON.parse(ui.data); Object.assign(u.strings, words || {}); ui.data = JSON.stringify(u);
  return Z.zip(ents.map((e) => ({ name: e.name, data: e.data, deflate: true })));
}
const b64 = (b) => Buffer.from(b).toString("base64");

(async () => {
  const port = await freePort();
  BASE = "http://127.0.0.1:" + port;
  php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", DIR], { stdio: "ignore", env: Object.assign({}, process.env, { BGC_POW_BITS: "0", BGC_DSN: "sqlite:" + DB, BGC_ADMINS: "boss", BGC_REGISTER_PER_HOUR: "100", BGC_MAIL_LOG: MAIL, BITGEN_PRIVATE_DIR: path.join(TMP, "none") }) });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + "/api.php?a=info"); break; } catch (e) { await sleep(100); } }
  const tim = await join("tim"), ann = await join("ann"), boss = await join("boss");
  let r = await call("info"); check("info: version 2.716.0 or newer, packs: true", /^2\.(71[6-9]|7[2-9]\d)\./.test(r.j.version) && r.j.packs === true, r.j);

  // ---- a member uploads one: it waits
  const ko = pack({ id: "ko", name: "Korean", native: "한국어", version: "1", authors: ["Tim"] }, { Save: "저장", Themes: "테마" });
  r = await call("pack_upload", { zip: b64(ko), note: "First go - the app's main words.", coverage: { ui: { done: 2, total: 8731 }, guide: { done: 0, total: 199 }, junk: 5, help: { done: -1, total: 3 } } }, tim);
  check("pack_upload (member): saved, waiting for an admin - the language read from pack.json, the app's words counted (2)", ok(r) && r.j.pending === true && r.j.code === "ko" && r.j.native === "한국어" && r.j.counts.ui === 2, r.j);
  const k1 = r.j.id;
  check("…the app's own coverage kept (only whole numbers that make sense: help's -1 and junk dropped)", JSON.stringify(r.j.counts.coverage) === '{"ui":{"done":2,"total":8731},"guide":{"done":0,"total":199}}', r.j.counts);
  r = await call("pack_list", {});
  check("pack_list (a guest): not listed while it waits", ok(r) && r.j.packs.length === 0 && !("mine" in r.j) && r.j.max_bytes === 5242880, r.j);
  r = await call("pack_list", {}, tim);
  check("…its uploader sees it in mine (pending)", ok(r) && r.j.mine.length === 1 && r.j.mine[0].status === "pending" && !("pending" in r.j), r.j.mine);
  check("…a guest cannot download it; its uploader can", err(await call("pack_get", { id: k1 }), 404) && ok(await call("pack_get", { id: k1 }, tim)));
  r = await call("pack_list", {}, boss);
  check("an admin sees it waiting: the language, version, who, the note, the counts", ok(r) && r.j.pending.length === 1 && r.j.pending[0].code === "ko" && r.j.pending[0].by.handle === "tim" && /First go/.test(r.j.pending[0].note) && r.j.pending[0].counts.ui === 2, r.j.pending);
  check("…only an admin moderates", err(await call("admin_pack_moderate", { id: k1, approve: true }, ann), 403));
  r = await call("admin_pack_moderate", { id: k1, approve: true, note: "Thanks!" }, boss);
  check("admin_pack_moderate approve: live", ok(r) && r.j.approved === true);
  r = await call("pack_list", {});
  check("…now anyone lists it (code, native, version, by tim, counts, size)", ok(r) && r.j.packs.length === 1 && r.j.packs[0].code === "ko" && r.j.packs[0].native === "한국어" && r.j.packs[0].version === "1" && r.j.packs[0].by.name === "tim" && r.j.packs[0].size === ko.length, r.j.packs);
  r = await call("pack_get", { id: k1 });
  check("pack_get: the zip exactly as it was uploaded", ok(r) && Buffer.from(r.j.zip, "base64").equals(ko), r.j.zip && r.j.zip.length);
  r = await call("pack_list", {});
  check("…a download counted (not the uploader's own)", r.j.packs[0].downloads === 1, r.j.packs[0]);
  // ---- a newer version replaces the older one once approved
  r = await call("pack_upload", { zip: b64(pack({ id: "ko", native: "한국어", version: "2" }, { Save: "저장", Themes: "테마", General: "일반" })) }, tim);
  const k2 = r.j.id;
  check("version 2 uploaded: waits; version 1 still the live one meanwhile", ok(r) && r.j.pending && (await call("pack_list", {})).j.packs.map((p) => p.version).join() === "1");
  await call("admin_pack_moderate", { id: k2, approve: true }, boss);
  r = await call("pack_list", {});
  check("…approved: version 2 replaces version 1 (the same person's older pack of that language)", r.j.packs.length === 1 && r.j.packs[0].version === "2" && r.j.packs[0].id === k2 && r.j.packs[0].counts.ui === 3, r.j.packs);
  // ---- refused
  r = await call("pack_upload", { zip: b64(pack({ id: "es", native: "Español" }, { Save: "Guardar" })) }, ann);
  const e1 = r.j.id;
  r = await call("admin_pack_moderate", { id: e1, approve: false, note: "Mostly machine translated - please read it over." }, boss);
  r = await call("pack_list", {}, ann);
  check("refused: the uploader sees it refused, with why; it is not listed; its zip is gone", ok(r) && r.j.mine[0].status === "refused" && /read it over/.test(r.j.mine[0].review_note) && r.j.packs.every((p) => p.code !== "es") && err(await call("pack_get", { id: e1 }, ann), 404), r.j.mine);
  check("…moderating it again: not waiting any more", err(await call("admin_pack_moderate", { id: e1, approve: true }, boss), 404));
  // ---- an admin's upload is live at once
  r = await call("pack_upload", { zip: b64(pack({ id: "de", native: "Deutsch" }, { Save: "Speichern" })) }, boss);
  check("an admin's upload: live at once", ok(r) && r.j.pending === false && (await call("pack_list", {})).j.packs.some((p) => p.code === "de"));
  // ---- delete
  check("pack_delete: another member cannot", err(await call("pack_delete", { id: k2 }, ann), 403));
  check("…its uploader can", ok(await call("pack_delete", { id: k2 }, tim)) && (await call("pack_list", {})).j.packs.every((p) => p.code !== "ko"));
  const de = (await call("pack_list", {})).j.packs.find((p) => p.code === "de").id;
  check("…an admin can delete anyone's", ok(await call("pack_delete", { id: de }, boss)) && (await call("pack_list", {})).j.packs.length === 0);
  // ---- refused uploads
  const up = (zip, t) => call("pack_upload", { zip: typeof zip === "string" ? zip : b64(zip) }, t === undefined ? tim : t);
  check("a guest cannot upload (sign in)", (await up(ko, null)).status === 401);
  check("not a zip: refused", err(await up(Buffer.from("hello there")), 400, /not a \.zip/));
  check("no zip at all: refused", err(await up("%%%"), 400, /base64/));
  check("no pack.json: refused", err(await up(Z.zip([{ name: "ui.json", data: "{}" }])), 400, /no pack\.json/));
  check("the master pack as it is (xx): refused - put your language's code", err(await up(MASTER), 400, /"xx"/));
  check("English: refused", err(await up(pack({ id: "en", native: "English" })), 400, /English is built in/));
  check("no native name: refused", err(await up(pack({ id: "fr", native: "" })), 400, /native/));
  check("a path that climbs out: refused", err(await up(Z.zip([{ name: "pack.json", data: JSON.stringify({ id: "it", native: "Italiano" }) }, { name: "../evil.txt", data: "x" }])), 400, /outside its folder/));
  const rnd = Buffer.alloc(5300000); for (let i = 0; i < rnd.length; i++) rnd[i] = (i * 2654435761) >>> 24;
  check("over 5 MB: refused (413)", err(await up(Z.zip([{ name: "pack.json", data: JSON.stringify({ id: "it", native: "Italiano" }) }, { name: "USAGE.md", data: rnd }])), 413));
  check("a folder zip (everything under it/) is read the same", ok(await up(Z.zip([{ name: "it/pack.json", data: JSON.stringify({ id: "it", native: "Italiano" }) }, { name: "it/ui.json", data: JSON.stringify({ strings: { Save: "Salva" } }) }]))));
  php.kill();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); if (php) php.kill(); process.exit(1); });
