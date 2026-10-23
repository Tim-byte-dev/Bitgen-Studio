// bitGen Studio — lib/team.js (2.583.0): THE TEAM behind the render farm - who is in it, today's keys, who is online.
//
// Tim: "lets just work on the render farm part for now, open the same project, get permission from owner of the client
// to render using their hardware, send api keys out to each team member daily from the team leader so there is no
// unauthorized access. a team member can get access to any of the other team members hardware to render but only while
// bitgen is running on that machine and access has been granted - have levels of access - time limit and unrestricted,
// time limit will set time from - time to" (+ the team folder on the NAS, the same network + Tailscale).
//
//   THE TEAM FOLDER (on the NAS - every PC points Settings ▸ Team at it):
//     team.json            {v, id, name, leader: {name, pub}, members: [{name, pub, machine, approved, added}], revoked: [],
//                          updated, sig} - signed by the leader's key; every PC pins the leader's key when it joins
//     members/<name>.json  a member's join request (their public key) - the leader approves it
//     keys/<name>.json     TODAY'S KEY: {cert: {team, member, pub, from, to, issued}, sig} - signed by the leader's app
//                          each day (at start, then every 10 minutes the date is checked); valid until the day ends.
//                          It is a certificate, not a password: a request also needs the member's own private key
//                          (it never leaves their PC), so reading the file on the NAS gives nobody access.
//     machines/<id>.json   who is online: each running bitGen writes its addresses, its sharing switch and the jobs it
//                          renders (with progress) every 15 s - "online" = seen in the last 45 s
//     projects/            the team's projects (Settings ▸ Team ▸ Use the team's projects folder - config.projects_dir)
//   THIS PC (<app>/team/): identity.json (machine id + name), leader.pem, member.pem (private keys), pinned.json (the
//     team id + the leader's public key, pinned at join), grants.json + requests.json (lib/farmNode.js)
//
//   status() / create(folder, teamName, leaderName) / join(folder, memberName) / leave() / approve(name) / remove(name) /
//   issueKeys() / myKey() / signHeaders(method, path, body) / verifyRequest(headers, method, path, body) /
//   heartbeat(extra) / machines() / tick()
// Pure (scripts/test-team583.js): canonical, slug, sign, verify, dayWindow, certOk, reqString, keyPair, pubOf.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const ONLINE_MS = 45000, SKEW_MS = 120000, REPLAY_MS = 300000;
const VERSION = 1;

/* ------------------------------------------------------------------ pure */
/** JSON with sorted keys - what is signed (pure) */
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}
/** a member's name -> a file name (pure) */
const slug = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
function keyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return { pub: publicKey.export({ type: "spki", format: "der" }).toString("base64"), pem: privateKey.export({ type: "pkcs8", format: "pem" }) };
}
const pubKey = (b64) => crypto.createPublicKey({ key: Buffer.from(String(b64), "base64"), format: "der", type: "spki" });
/** the public key of a private PEM (base64 spki) */
function pubOf(pem) { return crypto.createPublicKey(pem).export({ type: "spki", format: "der" }).toString("base64"); }
/** a signature (base64) of the canonical form (pure, given the key) */
function sign(obj, pem) { return crypto.sign(null, Buffer.from(typeof obj === "string" ? obj : canonical(obj)), pem).toString("base64"); }
function verify(obj, sig, pub) {
  try { return crypto.verify(null, Buffer.from(typeof obj === "string" ? obj : canonical(obj)), pubKey(pub), Buffer.from(String(sig || ""), "base64")); }
  catch { return false; }
}
/** today on THIS clock: [start of the day, end of the day] (ms) (pure) */
function dayWindow(now) {
  const d = new Date(now == null ? Date.now() : now);
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return { from, to: from + 24 * 3600 * 1000 - 1, day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` };
}
/** a key {cert, sig} good for this team now? -> "" | why not (pure) */
function certOk(key, teamId, leaderPub, now, revoked) {
  const c = key && key.cert;
  if (!c) return "no key";
  if (!verify(c, key.sig, leaderPub)) return "the key is not signed by the team leader";
  if (c.team !== teamId) return "the key is for another team";
  const t = now == null ? Date.now() : now;
  if (t < c.from) return "the key is not valid yet";
  if (t > c.to) return "the key has expired (the leader issues a new one each day)";
  if ((revoked || []).map(slug).includes(slug(c.member))) return "this member was removed from the team";
  return "";
}
/** what a request's signature covers (pure) */
function reqString(method, p, time, body) {
  const h = crypto.createHash("sha256").update(Buffer.isBuffer(body) ? body : Buffer.from(body == null ? "" : typeof body === "string" ? body : JSON.stringify(body))).digest("hex");
  return `${String(method).toUpperCase()}\n${p}\n${time}\n${h}`;
}

/* ------------------------------------------------------------------ the files */
let BASE = null, CFG = null;
function setBase(b) { BASE = b; }
function setConfig(fn) { CFG = fn; }          // tests: () => ({folder, member, ...})
const core = () => require("./core");
const localDir = () => { const d = path.join(BASE || core().BASE, "team"); fs.mkdirSync(d, { recursive: true }); return d; };
function cfg() {
  if (CFG) return CFG();
  const c = core().getConfig() || {};
  return Object.assign({ folder: "", member: "", sharing: false, port: 8312, target: "local" }, c.team || {});
}
function saveCfg(patch) {
  if (CFG) { const c = CFG(); Object.assign(c, patch); return c; }
  const C = core(), c = C.getConfig();
  c.team = Object.assign({}, c.team || {}, patch);
  C.setConfig(c);
  return c.team;
}
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
function writeJson(f, obj) {           // atomic on the NAS: a reader never sees half a file
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + ".tmp-" + process.pid + "-" + Date.now().toString(36);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, f);
}
const tf = (...p) => path.join(cfg().folder, ...p);

function identity() {
  const f = path.join(localDir(), "identity.json");
  let id = readJson(f);
  if (!id || !id.machine_id) { id = { machine_id: crypto.randomBytes(6).toString("hex"), machine_name: os.hostname() }; writeJson(f, id); }
  return id;
}
const pemFile = (k) => path.join(localDir(), k + ".pem");
const readPem = (k) => { try { return fs.readFileSync(pemFile(k), "utf8"); } catch { return ""; } };
function writePem(k, pem) { fs.writeFileSync(pemFile(k), pem, { mode: 0o600 }); }
const pinned = () => readJson(path.join(localDir(), "pinned.json"));

/** team.json, checked against the PINNED leader key -> {team} | {error} */
function teamFile() {
  const c = cfg();
  if (!c.folder) return { error: "no team folder set - Settings ▸ Team" };
  const t = readJson(tf("team.json"));
  if (!t) return { error: "no team.json in " + c.folder + " - create the team (the leader) or check the folder" };
  const pin = pinned();
  if (!pin || pin.team !== t.id) return { error: "this PC has not joined this team" };
  const { sig, ...body } = t;
  if (!verify(body, sig, pin.leader)) return { error: "team.json is not signed by the leader this PC joined with - someone changed it" };
  return { team: t };
}
function writeTeam(t) {
  const pem = readPem("leader");
  if (!pem) throw new Error("only the team leader's PC can change the team");
  const body = Object.assign({}, t, { updated: Date.now() }); delete body.sig;
  writeJson(tf("team.json"), Object.assign({}, body, { sig: sign(body, pem) }));
}
const isLeader = () => { const p = pinned(); const pem = readPem("leader"); return !!(p && pem && pubOf(pem) === p.leader); };

/* ------------------------------------------------------------------ setup */
function create(folder, teamName, leaderName) {
  const name = String(teamName || "").trim(), me = String(leaderName || "").trim();
  if (!folder || !name || !me) return { error: "the team folder, the team's name and your name" };
  fs.mkdirSync(folder, { recursive: true });
  if (fs.existsSync(path.join(folder, "team.json"))) return { error: "there is a team in that folder already - Join it instead" };
  for (const d of ["members", "keys", "machines", "projects"]) fs.mkdirSync(path.join(folder, d), { recursive: true });
  const L = keyPair(), M = keyPair();
  writePem("leader", L.pem); writePem("member", M.pem);
  const id = "t" + crypto.randomBytes(8).toString("hex");
  writeJson(path.join(localDir(), "pinned.json"), { team: id, leader: L.pub, folder, at: Date.now() });
  saveCfg({ folder, member: me });
  writeTeam({ v: VERSION, id, name, leader: { name: me, pub: L.pub }, members: [{ name: me, pub: M.pub, machine: identity().machine_name, approved: true, added: Date.now() }], revoked: [] });
  try { writeJson(path.join(folder, "projects", ".bitgen-team.json"), { team: id, name }); } catch { /* the marker is a check only */ }
  issueKeys();
  return { ok: true, team: id, name };
}
function join(folder, memberName) {
  const me = String(memberName || "").trim();
  const t = readJson(path.join(folder || "", "team.json"));
  if (!t) return { error: "no team in " + folder + " - ask the leader for the team folder" };
  if (!me) return { error: "your name in the team" };
  const pin = pinned();
  if (pin && pin.team === t.id && pin.leader !== t.leader.pub) return { error: "the leader's key in team.json changed since this PC joined - ask the leader" };
  const { sig, ...body } = t;
  if (!verify(body, sig, t.leader.pub)) return { error: "team.json is not signed by its leader" };
  writeJson(path.join(localDir(), "pinned.json"), { team: t.id, leader: t.leader.pub, folder, at: Date.now() });
  let pem = readPem("member");
  if (!pem) { const M = keyPair(); writePem("member", M.pem); pem = M.pem; }
  saveCfg({ folder, member: me });
  writeJson(path.join(folder, "members", slug(me) + ".json"), { name: me, pub: pubOf(pem), machine: identity().machine_name, at: Date.now() });
  const known = (t.members || []).find((m) => slug(m.name) === slug(me));
  return { ok: true, team: t.id, name: t.name, approved: !!(known && known.approved && known.pub === pubOf(pem)) };
}
/** this PC leaves the team: the folder, the pinned team and the sharing switch go; its keys stay (joining again reuses
 *  them). The leader's PC keeps the leader key - the team stays in the folder for the others. */
function leave() {
  try { fs.unlinkSync(path.join(localDir(), "pinned.json")); } catch { /* none */ }
  saveCfg({ folder: "", sharing: false, target: "local" });
  return { ok: true };
}
/** the leader: the join requests not yet in the team */
function requests() {
  const r = teamFile(); if (r.error) return [];
  const dir = tf("members"); let fsx = []; try { fsx = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { fsx = []; }
  return fsx.map((f) => readJson(path.join(dir, f))).filter((m) => m && m.name && m.pub)
    .filter((m) => !(r.team.members || []).some((x) => slug(x.name) === slug(m.name) && x.pub === m.pub && x.approved));
}
function approve(name) {
  const r = teamFile(); if (r.error) return r;
  const req = readJson(tf("members", slug(name) + ".json"));
  if (!req || !req.pub) return { error: "no join request from " + name };
  const t = r.team;
  t.members = (t.members || []).filter((m) => slug(m.name) !== slug(name)).concat([{ name: req.name, pub: req.pub, machine: req.machine || "", approved: true, added: Date.now() }]);
  t.revoked = (t.revoked || []).filter((n) => slug(n) !== slug(name));
  writeTeam(t);
  issueKeys();
  return { ok: true };
}
function remove(name) {
  const r = teamFile(); if (r.error) return r;
  const t = r.team;
  if (slug(name) === slug(t.leader.name)) return { error: "the leader cannot remove themselves" };
  t.members = (t.members || []).filter((m) => slug(m.name) !== slug(name));
  t.revoked = [...new Set((t.revoked || []).concat([name]))];
  writeTeam(t);
  try { fs.unlinkSync(tf("keys", slug(name) + ".json")); } catch { /* none */ }
  try { fs.unlinkSync(tf("members", slug(name) + ".json")); } catch { /* none */ }
  return { ok: true };
}
/** the leader's PC: today's key for every approved member -> {issued: [names], day} */
function issueKeys(now) {
  if (!isLeader()) return { issued: [], error: "not the leader" };
  const r = teamFile(); if (r.error) return Object.assign({ issued: [] }, r);
  const pem = readPem("leader"), w = dayWindow(now), out = [];
  for (const m of r.team.members || []) {
    if (!m.approved || !m.pub) continue;
    const f = tf("keys", slug(m.name) + ".json"), old = readJson(f);
    if (old && old.cert && old.cert.pub === m.pub && old.cert.from === w.from && old.cert.team === r.team.id) continue;   // today's is there
    const cert = { team: r.team.id, member: m.name, pub: m.pub, from: w.from, to: w.to, day: w.day, issued: Date.now() };
    writeJson(f, { cert, sig: sign(cert, pem) });
    out.push(m.name);
  }
  return { issued: out, day: w.day };
}
/** this PC's key for today -> {key, valid, why, to} */
function myKey(now) {
  const r = teamFile(); if (r.error) return { valid: false, why: r.error };
  const c = cfg(), key = readJson(tf("keys", slug(c.member) + ".json"));
  const pem = readPem("member");
  if (!key) return { valid: false, why: "no key for " + c.member + " yet - the leader approves you, then their bitGen issues it" };
  if (pem && key.cert && key.cert.pub !== pubOf(pem)) return { valid: false, why: "today's key is for another PC's key pair - join again on this PC" };
  const why = certOk(key, r.team.id, pinned().leader, now, r.team.revoked);
  return { key, valid: !why, why, to: key.cert && key.cert.to };
}

/* ------------------------------------------------------------------ requests between PCs */
/** the headers that prove who is asking (today's key + a signature with this PC's member key) */
function signHeaders(method, p, body) {
  const k = myKey();
  if (!k.valid) throw new Error("no valid team key today: " + k.why);
  const time = Date.now();
  return { "x-bg-key": Buffer.from(JSON.stringify(k.key)).toString("base64"), "x-bg-time": String(time),
           "x-bg-machine": identity().machine_id, "x-bg-sig": sign(reqString(method, p, time, body), readPem("member")) };
}
const seen = new Map();          // signature -> time (replays)
/** on the renderer: who sent this request? -> {ok, member, machine} | {error, status} */
function verifyRequest(h, method, p, body, now) {
  const t = now == null ? Date.now() : now;
  const r = teamFile(); if (r.error) return { error: r.error, status: 503 };
  let key = null;
  try { key = JSON.parse(Buffer.from(String(h["x-bg-key"] || ""), "base64").toString("utf8")); } catch { key = null; }
  const why = certOk(key, r.team.id, pinned().leader, t, r.team.revoked);
  if (why) return { error: why, status: 401 };
  const time = +h["x-bg-time"];
  if (!time || Math.abs(t - time) > SKEW_MS) return { error: "the request's clock is more than 2 minutes off this PC's", status: 401 };
  const sig = String(h["x-bg-sig"] || "");
  if (!verify(reqString(method, p, time, body), sig, key.cert.pub)) return { error: "the request is not signed by " + key.cert.member + "'s PC", status: 401 };
  for (const [s, at] of seen) if (t - at > REPLAY_MS) seen.delete(s);
  if (seen.has(sig)) return { error: "a replayed request", status: 401 };
  seen.set(sig, t);
  return { ok: true, member: key.cert.member, machine: String(h["x-bg-machine"] || "") };
}

/* ------------------------------------------------------------------ who is online */
/** where the others reach this PC: the address typed in Settings ▸ Team first (a Tailscale name / 100.x address, or
 *  any address the PCs see each other on), then every network address this PC has (the same network) */
function addresses() {
  const extra = String(cfg().address || "").split(/[,\s]+/).map((x) => x.trim()).filter((x) => /^[A-Za-z0-9.:\-[\]]{1,200}$/.test(x));
  let lan = []; try { lan = require("./remote").lanCandidates().map((x) => x.ip); } catch { lan = []; }
  return [...new Set(extra.concat(lan))];
}
function heartbeat(extra) {
  const c = cfg(); if (!c.folder || teamFile().error) return null;
  const id = identity();
  const rec = Object.assign({ id: id.machine_id, name: id.machine_name, member: c.member, addresses: addresses(), port: +c.port || 8312,
    sharing: !!c.sharing, team: pinned().team, at: Date.now() }, extra || {});
  try { writeJson(tf("machines", id.machine_id + ".json"), rec); } catch { return null; }
  return rec;
}
/** the team's PCs seen in the last 45 s (this one too, marked me) */
function machines(now) {
  const t = now == null ? Date.now() : now, c = cfg();
  if (!c.folder) return [];
  let fsx = []; try { fsx = fs.readdirSync(tf("machines")).filter((f) => /\.json$/.test(f)); } catch { fsx = []; }
  const me = identity().machine_id, pin = pinned();
  return fsx.map((f) => readJson(tf("machines", f))).filter((m) => m && m.id && (!pin || m.team === pin.team))
    .map((m) => Object.assign(m, { online: t - (+m.at || 0) < ONLINE_MS, me: m.id === me }))
    .sort((a, b) => (b.online - a.online) || String(a.member).localeCompare(String(b.member)));
}

function status() {
  const c = cfg(), r = c.folder ? teamFile() : { error: "" };
  const k = r.error ? { valid: false, why: r.error } : myKey();
  return { folder: c.folder, member: c.member, joined: !!c.folder && !r.error, error: r.error || "", leader: !!c.folder && !r.error && isLeader(),
    team: r.team ? { id: r.team.id, name: r.team.name, leader: r.team.leader.name, members: (r.team.members || []).map((m) => ({ name: m.name, machine: m.machine, approved: !!m.approved })), revoked: r.team.revoked || [] } : null,
    key: { valid: k.valid, why: k.why || "", to: k.to || null }, requests: c.folder && !r.error && isLeader() ? requests().map((m) => ({ name: m.name, machine: m.machine, at: m.at })) : [],
    machine: identity(), sharing: !!c.sharing, port: +c.port || 8312, address: c.address || "", addresses: c.folder ? addresses() : [], target: c.target || "local",
    projects_dir: (core().getConfig() || {}).projects_dir || "", projects_now: core().PROJECTS_DIR,
    team_projects: c.folder ? path.join(c.folder, "projects") : "" };
}

/* the leader issues keys when the day turns; every PC says it is online */
let timer = null, lastDay = "";
function tick() {
  const c = cfg(); if (!c.folder) return;
  if (isLeader()) { const d = dayWindow().day; if (d !== lastDay) { try { issueKeys(); lastDay = d; } catch { /* the NAS may be away */ } } }
  try { require("./farmNode").publish(); } catch { heartbeat(); }
}
function start() {
  if (timer) return;
  timer = setInterval(() => { try { tick(); } catch { /* never kills the app */ } }, 15000);
  if (timer.unref) timer.unref();
  setTimeout(() => { try { tick(); } catch { /* fine */ } }, 1500).unref();
}

module.exports = { ONLINE_MS, SKEW_MS, canonical, slug, keyPair, pubOf, sign, verify, dayWindow, certOk, reqString,
  setBase, setConfig, cfg, saveCfg, identity, pinned, teamFile, isLeader, create, join, requests, approve, remove, issueKeys,
  myKey, signHeaders, verifyRequest, leave, heartbeat, machines, addresses, status, tick, start, readJson, writeJson };
