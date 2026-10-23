// bitGen Studio — lib/farmNode.js (2.583.0): THE RENDER FARM, the rendering side - this PC renders for a team member.
//
// Tim: "get permission from owner of the client to render using their hardware ... a team member can get access to any
// of the other team members hardware to render but only while bitgen is running on that machine and access has been
// granted - have levels of access - time limit and unrestricted, time limit will set time from - time to".
//
//   ITS OWN PORT (config.team.port, default 8312) on the network, only while "Share this PC for team renders" is on and
//   bitGen runs - the app's own port stays on this PC. Only /farm/* is there, and every call but /farm/ping carries
//   today's team key + a signature (lib/team.verifyRequest).
//     GET  /farm/ping               {id, name, member, team} - "is this the PC I think it is"
//     POST /farm/hello              {access: {level, from, to} | null, pending}
//     POST /farm/request            {note} -> a request for the owner (Settings ▸ Team ▸ Allow / Deny)
//     POST /farm/jobs               {project, params, label} -> {id} - queued here, for that member's project in the
//                                   shared projects folder; refused without access, outside its time, for a mode that
//                                   is not a render, or with a file outside the projects folder / the app
//     GET  /farm/jobs/:id?log_from= {status, log, log_next, output, outputs, error}
//     POST /farm/jobs/:id/cancel
//   ACCESS (<app>/team/grants.json - THIS PC's owner decides): {member: {level: unrestricted | window, from, to, at}};
//   requests.json: the pending asks. grant(member, level, from, to) / revoke(member) / deny(member) / list().
//   publish(): who is online + every job of the team's projects here with its progress (lib/team.heartbeat).
// Pure (scripts/test-farm583.js): allows(grant, now), checkGrant(level, from, to).
"use strict";
const fs = require("fs");
const path = require("path");
const express = require("express");

const T = () => require("./team");
const core = () => require("./core");
const farm = () => require("./farm");

/* ------------------------------------------------------------------ pure */
/** may this grant render now? (pure) */
function allows(g, now) {
  if (!g) return false;
  if (g.level === "unrestricted") return true;
  if (g.level !== "window") return false;
  const t = now == null ? Date.now() : now, a = +new Date(g.from), b = +new Date(g.to);
  return Number.isFinite(a) && Number.isFinite(b) && t >= a && t <= b;
}
/** a grant from the owner's form -> {level, from, to} | {error} (pure) */
function checkGrant(level, from, to) {
  if (level === "unrestricted") return { level };
  if (level !== "window") return { error: "unrestricted, or a time from - to" };
  const a = +new Date(from), b = +new Date(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: "pick the time from and the time to" };
  if (b <= a) return { error: "the time to must be after the time from" };
  return { level, from: new Date(a).toISOString(), to: new Date(b).toISOString() };
}

/* ------------------------------------------------------------------ access */
const gFile = () => path.join(core().BASE, "team", "grants.json");
const rFile = () => path.join(core().BASE, "team", "requests.json");
let DIR = null;
function setDir(d) { DIR = d; }
const gPath = () => (DIR ? path.join(DIR, "grants.json") : gFile());
const rPath = () => (DIR ? path.join(DIR, "requests.json") : rFile());
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const writeJ = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2)); };
const key = (m) => T().slug(m);
const teamId = () => { try { const p = T().pinned(); return p ? p.team : ""; } catch { return ""; } };
const ofTeam = (g) => !!g && (!g.team || g.team === teamId());       // access given in another team never carries over
function list() {
  const g = readJ(gPath(), {}), r = readJ(rPath(), []);
  return { grants: Object.entries(g).filter(([, v]) => ofTeam(v)).map(([k, v]) => Object.assign({ key: k, now: allows(v) }, v)), requests: r.filter(ofTeam) };
}
function grant(member, level, from, to) {
  const c = checkGrant(level, from, to); if (c.error) return c;
  const g = readJ(gPath(), {});
  g[key(member)] = Object.assign({ member: String(member) }, c, { team: teamId(), at: Date.now() });
  writeJ(gPath(), g);
  writeJ(rPath(), readJ(rPath(), []).filter((x) => key(x.member) !== key(member)));
  return { ok: true, grant: g[key(member)] };
}
function revoke(member) { const g = readJ(gPath(), {}); delete g[key(member)]; writeJ(gPath(), g); return { ok: true }; }
function deny(member) { writeJ(rPath(), readJ(rPath(), []).filter((x) => key(x.member) !== key(member))); return { ok: true }; }
function grantOf(member) { const g = readJ(gPath(), {})[key(member)]; return ofTeam(g) ? g : null; }
/** this PC left the team: nobody keeps access to it */
function clear() { writeJ(gPath(), {}); writeJ(rPath(), []); return { ok: true }; }
function addRequest(member, machine, note) {
  const r = readJ(rPath(), []).filter((x) => key(x.member) !== key(member));
  r.push({ member, machine, note: String(note || "").slice(0, 200), team: teamId(), at: Date.now() });
  writeJ(rPath(), r.slice(-50));
}

/* ------------------------------------------------------------------ the jobs rendered here for someone */
function jobView(j, from) {
  const d = { id: j.id, status: j.status, output: j.output || null, outputs: j.outputs || null, error: "" };
  const lg = j.log || [];
  d.log = lg.slice(from || 0); d.log_next = lg.length;
  if (j.status === "failed") d.error = (lg.slice(-6).find((l) => /error|failed|refused|not in list|out of memory/i.test(l)) || "").slice(0, 300);
  return d;
}
function label(j) {
  const p = j.params || {};
  return String((j.farm && j.farm.label) || p.label || p.scene_name || p.title || p.prompt || p.mode || "").replace(/\s+/g, " ").slice(0, 80);
}
/** who is online + this PC's jobs of the team's projects, with their progress (every 15 s, lib/team.tick) */
function publish() {
  const C = core(), shared = (() => { try { return farm().sharedProjects(); } catch { return false; } })();
  const me = T().cfg().member;
  const recent = Date.now() / 1000 - 600;
  const jobs = [];
  for (const id of C.order.slice(-80)) {
    const j = C.jobs.get(id); if (!j) continue;
    if (!(j.farm || (shared && !j.remote))) continue;           // a remote job is shown by the PC that renders it
    if (!(j.status === "running" || j.status === "queued" || (j.finished && j.finished > recent))) continue;
    let pr = null; try { pr = require("./jobMeta").progress(j); } catch { pr = null; }
    jobs.push({ id: j.id, project: j.project, kind: (j.params || {}).mode, label: label(j), for: j.farm ? j.farm.member : me, status: j.status,
      pct: pr && pr.pct != null ? pr.pct : null, step: pr && pr.step, total: pr && pr.total, chunk: j.chunk || null, elapsed: pr ? pr.elapsed : 0 });
  }
  return T().heartbeat({ jobs, listening: !!server });
}

/* ------------------------------------------------------------------ the port */
let server = null, port = 0;
function auth(req, res, next) {
  const v = T().verifyRequest(req.headers, req.method, req.originalUrl.split("?")[0], req.rawBody || "");
  if (!v.ok) return res.status(v.status || 401).json({ error: v.error });
  req.member = v.member; req.machine = v.machine;
  next();
}
function app() {
  const a = express();
  a.disable("x-powered-by");
  a.use(express.raw({ type: () => true, limit: "2mb" }), (req, _res, next) => {
    req.rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    try { req.json = req.rawBody.length ? JSON.parse(req.rawBody.toString("utf8")) : {}; } catch { req.json = {}; }
    next();
  });
  a.get("/farm/ping", (_req, res) => { const id = T().identity(), c = T().cfg(), p = T().pinned(); res.json({ id: id.machine_id, name: id.machine_name, member: c.member, team: p ? p.team : "" }); });
  a.post("/farm/hello", auth, (req, res) => {
    const g = grantOf(req.member);
    const pend = readJ(rPath(), []).some((x) => key(x.member) === key(req.member) && ofTeam(x));
    res.json({ access: g ? { level: g.level, from: g.from || null, to: g.to || null, now: allows(g) } : null, pending: pend, machine: T().identity().machine_name, member: T().cfg().member });
  });
  a.post("/farm/request", auth, (req, res) => {
    if (grantOf(req.member) && allows(grantOf(req.member))) return res.json({ ok: true, access: true });
    addRequest(req.member, req.machine, (req.json || {}).note);
    res.json({ ok: true, pending: true });
  });
  a.post("/farm/jobs", auth, (req, res) => {
    const g = grantOf(req.member);
    if (!g) return res.status(403).json({ error: `${T().cfg().member} has not given ${req.member} access to this PC - ask for it (🖥 Render on ▸ Ask)` });
    if (!allows(g)) return res.status(403).json({ error: `${req.member}'s access to this PC is from ${new Date(g.from).toLocaleString()} to ${new Date(g.to).toLocaleString()}` });
    if (!T().cfg().sharing) return res.status(403).json({ error: "this PC is not sharing right now" });
    if (!farm().sharedProjects()) return res.status(409).json({ error: "this PC's projects folder is not the team's - Settings ▸ Team ▸ Use the team's projects folder (then restart bitGen)" });
    const b = req.json || {};
    const C = core();
    const project = path.basename(String(b.project || ""));
    if (!project || !fs.existsSync(C.projDir(project))) return res.status(404).json({ error: `no project "${project}" in the team's projects folder here` });
    const params = farm().expand(b.params || {}, farm().roots());
    if (!farm().isFarmMode(params.mode)) return res.status(400).json({ error: `a "${params.mode}" job is not rendered for others` });
    const out = farm().outsideRoots(params, farm().roots());
    if (out.length) return res.status(400).json({ error: "the job reads files outside the team's projects folder and the app: " + out.slice(0, 3).join(", ") });
    const j = C.makeJob(params, null, null, { project, farm: { member: req.member, machine: req.machine, label: String(b.label || "").slice(0, 80) } });
    C.log(j, `[team] rendering for ${req.member} (project ${project})`);
    res.json({ id: j.id });
  });
  const mine = (req, res) => {
    const j = core().jobs.get(String(req.params.id));
    if (!j || !j.farm || T().slug(j.farm.member) !== T().slug(req.member)) { res.status(404).json({ error: "no such job of yours here" }); return null; }
    return j;
  };
  a.get("/farm/jobs/:id", auth, (req, res) => { const j = mine(req, res); if (j) res.json(jobView(j, parseInt(req.query.log_from, 10) || 0)); });
  a.post("/farm/jobs/:id/cancel", auth, (req, res) => {
    const j = mine(req, res); if (!j) return;
    if (j.status === "queued" || j.status === "running") {
      const C = core();
      j.status = "cancelled"; C.killTree(j);
      const qi = C.queue.indexOf(j); if (qi >= 0) C.queue.splice(qi, 1);
      C.recordJob(j);
    }
    res.json(jobView(j, 0));
  });
  a.use((_req, res) => res.status(404).json({ error: "not a farm endpoint" }));
  return a;
}
/** the port follows the switch: on = listening on the network, off = closed -> {listening, port, error} */
function apply() {
  const c = T().cfg();
  const want = !!(c.sharing && c.folder && !T().teamFile().error);
  const p = +c.port || 8312;
  if (server && (!want || p !== port)) { try { server.close(); } catch { /* closed */ } server = null; }
  if (!want || server) return Promise.resolve({ listening: !!server, port: server ? port : 0 });
  return new Promise((ok) => {
    const s = app().listen(p, "0.0.0.0");
    s.on("listening", () => { server = s; port = p; ok({ listening: true, port: p }); });
    s.on("error", (e) => { server = null; ok({ listening: false, port: 0, error: e.code === "EADDRINUSE" ? `port ${p} is in use - pick another in Settings ▸ Team` : String(e.message || e) }); });
  });
}
const listening = () => (server ? port : 0);

module.exports = { allows, checkGrant, list, grant, revoke, deny, grantOf, clear, addRequest, publish, app, apply, listening, setDir, jobView };
