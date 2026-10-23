// bitGen Studio — routes/team.js (2.583.0): Settings ▸ Team + the status bar's 🖥 Render on - the render farm
// (lib/team.js: the team, today's keys, who is online; lib/farmNode.js: this PC rendering for others + who may;
// lib/farm.js: jobs sent to another PC). This PC's own app only (127.0.0.1) - the farm's network port is lib/farmNode.js.
//   GET  /api/team/status            the team, this PC, today's key, sharing, access given here, the online PCs + their jobs
//   POST /api/team/create            {folder, name, me}        the leader makes the team in the NAS folder
//   POST /api/team/join              {folder, me}              a member joins (the leader approves)
//   POST /api/team/leave             this PC leaves (back to its own projects folder - restart)
//   POST /api/team/approve|remove    {name}                    the leader
//   POST /api/team/issue             the leader: today's keys now
//   POST /api/team/projects          {use}                     this PC's projects folder = the team's (restart)
//   POST /api/team/sharing           {on, port, address}       this PC renders for the team (its port opens / closes)
//   POST /api/team/target            {target}                  local | <machine id> | spread
//   GET  /api/team/targets?fresh=1   each online PC + what this PC may do there
//   POST /api/team/ask               {machine, note}           ask a PC's owner for access
//   POST /api/team/grant             {member, level, from, to} unrestricted | window (from - to)
//   POST /api/team/revoke|deny       {member}
"use strict";
const path = require("path");
const core = require("../lib/core");
const team = require("../lib/team");
const node = require("../lib/farmNode");
const farm = require("../lib/farm");

const send = (res, d) => res.status(d && d.error ? (d.status || 400) : 200).json(d);
const wrap = (fn) => async (req, res) => { try { send(res, await fn(req.body || {}, req)); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); } };

function full() {
  const st = team.status();
  st.listening = node.listening();
  st.access = node.list();
  st.machines = team.machines().map((m) => ({ id: m.id, name: m.name, member: m.member, online: m.online, me: m.me, sharing: !!m.sharing, jobs: m.jobs || [], at: m.at }));
  st.shared_projects = farm.sharedProjects();
  st.restart = !!st.projects_dir && path.resolve(core.projectsRoot(core.getConfig())) !== path.resolve(core.PROJECTS_DIR);
  return st;
}

function mount(app) {
  app.get("/api/team/status", wrap(() => full()));
  app.post("/api/team/create", wrap((b) => { const r = team.create(String(b.folder || "").trim(), b.name, b.me); return r.error ? r : full(); }));
  app.post("/api/team/join", wrap((b) => { const r = team.join(String(b.folder || "").trim(), b.me); return r.error ? r : Object.assign(full(), { approved: r.approved }); }));
  app.post("/api/team/leave", wrap(async () => {
    const st = team.status(), c = core.getConfig();
    team.leave();
    node.clear();
    const back = !!c.projects_dir && st.team_projects && path.resolve(c.projects_dir) === path.resolve(st.team_projects);
    if (back) { const c2 = core.getConfig(); c2.projects_dir = ""; core.setConfig(c2); }
    await node.apply();
    return Object.assign(full(), { restart: back });
  }));
  app.post("/api/team/approve", wrap((b) => { const r = team.approve(String(b.name || "")); return r.error ? r : full(); }));
  app.post("/api/team/remove", wrap((b) => { const r = team.remove(String(b.name || "")); return r.error ? r : full(); }));
  app.post("/api/team/issue", wrap(() => { const r = team.issueKeys(); return r.error ? r : Object.assign(full(), { issued: r.issued }); }));
  app.post("/api/team/projects", wrap((b) => {
    const c = core.getConfig(), st = team.status();
    if (b.use && !st.team_projects) return { error: "join a team first" };
    c.projects_dir = b.use ? st.team_projects : "";
    core.setConfig(c);
    return Object.assign(full(), { restart: true });
  }));
  app.post("/api/team/sharing", wrap(async (b) => {
    const patch = { sharing: !!b.on };
    if (typeof b.address === "string") patch.address = b.address.trim().slice(0, 200);
    if (b.port) { const p = parseInt(b.port, 10); if (!(p >= 1024 && p <= 65535)) return { error: "a port from 1024 to 65535" }; patch.port = p; }
    team.saveCfg(patch);
    const r = await node.apply();
    try { node.publish(); } catch { /* the NAS may be away */ }
    return Object.assign(full(), { port_error: r.error || "" });
  }));
  app.post("/api/team/target", wrap((b) => { const t = String(b.target || "local"); team.saveCfg({ target: t }); return full(); }));
  app.get("/api/team/targets", wrap(async (_b, req) => ({ targets: await farm.targets(req.query.fresh === "1"), target: team.cfg().target || "local", shared_projects: farm.sharedProjects() })));
  app.post("/api/team/ask", wrap((b) => farm.requestAccess(String(b.machine || ""), b.note)));
  app.post("/api/team/grant", wrap((b) => { const r = node.grant(String(b.member || ""), b.level, b.from, b.to); return r.error ? r : full(); }));
  app.post("/api/team/revoke", wrap((b) => { node.revoke(String(b.member || "")); return full(); }));
  app.post("/api/team/deny", wrap((b) => { node.deny(String(b.member || "")); return full(); }));
  team.start();
  node.apply().then((r) => { if (r.error) console.log("[team] " + r.error); }).catch(() => { /* off */ });
}

module.exports = { mount };
