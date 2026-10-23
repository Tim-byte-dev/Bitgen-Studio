#!/usr/bin/env node
/* bitGen Studio — scripts/test-farm583.js (2.583.0): THE RENDER FARM end to end - two real bitGen Studios (two copies of
 * this app, Tim's PC and Sam's PC) and one team folder standing in for the NAS, with the stub sd-cli (no GPU).
 *   Tim makes the team, Sam joins, Tim approves him (today's keys issued); both use the team's projects folder (restart);
 *   Sam shares his PC (its own farm port). Tim's 🖥 Render on lists Sam's PC with no access -> 🔒 Ask -> Sam sees the
 *   request and allows Tim from - to -> Tim renders on Sam's PC: the job is queued there "for Tim", its log comes back,
 *   the video lands in the SAME project on the NAS and in Tim's queue as done. Then every refusal: no key on the farm
 *   port, the app's own API not on the farm port, Sam's time window over, access revoked, Sam's sharing off (= bitGen not
 *   rendering for anyone). Tim: "open the same project, get permission from owner of the client to render using their
 *   hardware ... only while bitgen is running on that machine and access has been granted - have levels of access - time
 *   limit and unrestricted, time limit will set time from - time to". Needs node + python3 + ffmpeg. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 1200))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-farm583-"));
const NAS = path.join(tmp, "nas", "bitgen-team");
const P = { A: 8451, B: 8452 }, FARM_B = 8462;
const dirs = { A: path.join(tmp, "tim"), B: path.join(tmp, "sam") };
const procs = {};

function copyApp(dst) {
  fs.mkdirSync(dst, { recursive: true });
  execSync(`tar cf - --exclude=./node_modules --exclude=./projects --exclude=./workspace --exclude=./dist --exclude=./solidcraft --exclude=./cadgen --exclude=./team --exclude=./custom.settings --exclude=./.git . | (cd "${dst}" && tar xf -)`, { cwd: ROOT, shell: "/bin/bash" });
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dst, "node_modules"));
  fs.mkdirSync(path.join(dst, "models"), { recursive: true });
  for (const f of ["stub-fl2va.gguf", "stub-ref2va.gguf", "stub-te.gguf", "stub-vvae.safetensors", "stub-avae.safetensors"]) fs.writeFileSync(path.join(dst, "models", f), "");
  fs.writeFileSync(path.join(dst, "custom.settings"), JSON.stringify({
    python: "python3", sd_cli: "scripts/stub-sd-cli.py", engine: { backend: "sdcli" },
    models: { fl2va: "models/stub-fl2va.gguf", ref2va: "models/stub-ref2va.gguf", text_encoder: "models/stub-te.gguf", video_vae: "models/stub-vvae.safetensors", audio_vae: "models/stub-avae.safetensors" },
    defaults: { width: 192, height: 108, frames: 121, steps: 4, seed: -1, format: "webm" },
  }, null, 2));
}
async function start(k) {
  if (procs[k]) { procs[k].kill(); await new Promise((r) => procs[k].once("exit", r)); }
  const log = fs.openSync(path.join(tmp, k + ".log"), "a");
  procs[k] = spawn("node", ["server.js"], { cwd: dirs[k], env: Object.assign({}, process.env, { H3_E2E: "1", H3_PORT: String(P[k]) }), stdio: ["ignore", log, log] });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(`http://127.0.0.1:${P[k]}/api/health`); if (r.ok) return; } catch { /* not yet */ } await sleep(250); }
  throw new Error(k + " did not start: " + fs.readFileSync(path.join(tmp, k + ".log"), "utf8").slice(-1500));
}
const api = async (k, p, body) => {
  const r = await fetch(`http://127.0.0.1:${P[k]}${p}`, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); j._status = r.status; return j;
};
async function generate(k, frames) {
  const fd = new FormData();
  for (const [a, b] of Object.entries({ mode: "t2va", frames: String(frames), pipeline: "single", prompt: "a dog on the beach", format: "webm" })) fd.append(a, b);
  const r = await fetch(`http://127.0.0.1:${P[k]}/api/generate`, { method: "POST", body: fd });
  return r.json();
}
async function waitJob(k, id, secs) {
  let j = null;
  for (let i = 0; i < (secs || 120) * 2; i++) { j = await api(k, `/api/jobs/${id}?log_from=0`); if (j.status === "done" || j.status === "failed" || j.status === "cancelled") break; await sleep(500); }
  return j;
}

(async () => {
  try {
    copyApp(dirs.A); copyApp(dirs.B);
    await start("A"); await start("B");

    // ------------------------------------------------ the team
    let a = await api("A", "/api/team/create", { folder: NAS, name: "H3 crew", me: "Tim" });
    check("Tim makes the team in the NAS folder; he is its leader and has today's key", a.joined && a.leader && a.key.valid && a.team.name === "H3 crew", a);
    let b = await api("B", "/api/team/join", { folder: NAS, me: "Sam" });
    check("Sam joins: not approved yet, no key", b.joined && !b.approved && !b.key.valid, b);
    a = await api("A", "/api/team/status");
    check("Tim's Settings ▸ Team shows Sam's join request", (a.requests || []).some((q) => q.name === "Sam"), a.requests);
    a = await api("A", "/api/team/approve", { name: "Sam" });
    b = await api("B", "/api/team/status");
    check("✓ Approve: Sam is a member and his bitGen sees today's key", a.team.members.some((m) => m.name === "Sam") && b.key.valid, b.key);
    for (const k of ["A", "B"]) await api(k, "/api/team/projects", { use: true });
    await start("A"); await start("B");
    a = await api("A", "/api/team/status"); b = await api("B", "/api/team/status");
    check("after the restart both PCs open the team's projects folder (the same project)", a.shared_projects && b.shared_projects && path.resolve(a.projects_now) === path.resolve(NAS, "projects") && path.resolve(b.projects_now) === path.resolve(NAS, "projects"), [a.projects_now, b.projects_now]);

    // ------------------------------------------------ Sam shares his PC
    b = await api("B", "/api/team/sharing", { on: true, port: FARM_B, address: "127.0.0.1" });
    check("Sam: 🔌 Share this PC - his farm port opens (only /farm/*)", b.listening === FARM_B && b.sharing, b);
    const ping = await (await fetch(`http://127.0.0.1:${FARM_B}/farm/ping`)).json();
    check("the farm port answers who it is", ping.member === "Sam" && ping.id === b.machine.machine_id, ping);
    let r = await fetch(`http://127.0.0.1:${FARM_B}/farm/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: "default", params: { mode: "t2va" } }) });
    check("the farm port without a team key: 401, nothing queued", r.status === 401);
    r = await fetch(`http://127.0.0.1:${FARM_B}/api/jobs`);
    check("the app's own API is NOT on the farm port", r.status === 404);
    await api("A", "/api/team/sharing", { on: false });          // Tim's PC says it is online too

    // ------------------------------------------------ Tim asks, Sam allows from - to
    let t = await api("A", "/api/team/targets?fresh=1");
    const sam = (t.targets || []).find((x) => x.member === "Sam");
    check("Tim's 🖥 Render on lists Sam's PC: online, sharing, no access yet", sam && sam.online && sam.sharing && !sam.access && !sam.error, t);
    const ask = await api("A", "/api/team/ask", { machine: sam.id, note: "scene 2 please" });
    check("🔒 Ask for access", ask.pending === true, ask);
    b = await api("B", "/api/team/status");
    check("Sam's Settings ▸ Team shows Tim's request with his note", (b.access.requests || []).some((q) => q.member === "Tim" && q.note === "scene 2 please"), b.access);
    await api("A", "/api/team/target", { target: sam.id });
    let g = await generate("A", 24);
    let j = await waitJob("A", g.id, 30);
    check("before Sam allows it, a job sent to his PC is refused there", j.status === "failed" && /has not given Tim access/.test((j.log || []).join("\n")), j.log && j.log.slice(-3));
    const from = new Date(Date.now() - 60000).toISOString(), to = new Date(Date.now() + 3600000).toISOString();
    b = await api("B", "/api/team/grant", { member: "Tim", level: "window", from, to });
    check("Sam allows Tim from - to (the time limit)", (b.access.grants || []).some((x) => x.member === "Tim" && x.level === "window" && x.now) && !(b.access.requests || []).length, b.access);
    t = await api("A", "/api/team/targets?fresh=1");
    check("Tim sees his access on Sam's PC (from - to, now inside it)", ((t.targets || []).find((x) => x.member === "Sam") || {}).access && t.targets.find((x) => x.member === "Sam").access.level === "window", t.targets);

    // ------------------------------------------------ the render
    g = await generate("A", 48);
    check("Tim's job is queued (on Sam's PC)", g.id, g);
    j = await waitJob("A", g.id, 150);
    const lg = (j.log || []).join("\n");
    check("it rendered on Sam's PC: done in Tim's queue, marked remote, Sam's log lines came back", j.status === "done" && j.remote && j.remote.member === "Sam" && /queued on .* \(Sam\)/.test(lg) && /rendering for Tim/.test(lg) && /rendered on .*\(Sam\)/.test(lg), { status: j.status, remote: j.remote, log: (j.log || []).slice(-8) });
    const out = j.output && path.join(NAS, "projects", j.project || "default", "output", j.output);
    check("the video is in the SAME project on the NAS", out && fs.existsSync(out) && fs.statSync(out).size > 1000, out);
    const bj = await api("B", "/api/jobs");
    const list = Array.isArray(bj) ? bj : (bj.jobs || []);
    const farmJob = list.find((x) => x.farm && x.farm.member === "Tim");
    check("Sam's queue shows the job as rendered for Tim", farmJob && farmJob.status === "done", list.slice(0, 3));
    await sleep(16000);                                         // a heartbeat
    a = await api("A", "/api/team/status");
    const sm = (a.machines || []).find((m) => m.member === "Sam");
    check("the team's PCs: Sam's PC online + sharing, with the job it rendered for Tim", sm && sm.online && sm.sharing && (sm.jobs || []).some((x) => x.for === "Tim" && x.status === "done"), sm);

    // ------------------------------------------------ the refusals
    await api("B", "/api/team/grant", { member: "Tim", level: "window", from: new Date(Date.now() - 7200000).toISOString(), to: new Date(Date.now() - 3600000).toISOString() });
    g = await generate("A", 24); j = await waitJob("A", g.id, 30);
    check("outside Sam's from - to: refused, saying the time", j.status === "failed" && /access to this PC is from/.test((j.log || []).join("\n")), j.log && j.log.slice(-2));
    await api("B", "/api/team/grant", { member: "Tim", level: "unrestricted" });
    await api("B", "/api/team/revoke", { member: "Tim" });
    g = await generate("A", 24); j = await waitJob("A", g.id, 30);
    check("↺ Revoked: refused", j.status === "failed" && /has not given Tim access/.test((j.log || []).join("\n")));
    await api("B", "/api/team/grant", { member: "Tim", level: "unrestricted" });
    b = await api("B", "/api/team/sharing", { on: false });
    check("Sam stops sharing: the farm port closes", !b.listening);
    let closed = false; try { await fetch(`http://127.0.0.1:${FARM_B}/farm/ping`, { signal: AbortSignal.timeout(1500) }); } catch { closed = true; }
    check("nothing answers on it any more", closed);
    g = await generate("A", 24); j = await waitJob("A", g.id, 40);
    check("a job for Sam's PC now fails (it does not answer) - nothing renders there", j.status === "failed" && /does not answer|not online|did not answer/.test((j.log || []).join("\n")), j.log && j.log.slice(-2));
    await api("A", "/api/team/target", { target: "local" });
    g = await generate("A", 24); j = await waitJob("A", g.id, 120);
    check("🖥 This PC: Tim's job renders on his own PC again", j.status === "done" && !j.remote, { status: j.status, log: (j.log || []).slice(-3) });
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); for (const k of ["A", "B"]) { try { console.log(`--- ${k}.log\n` + fs.readFileSync(path.join(tmp, k + ".log"), "utf8").slice(-1500)); } catch { /* none */ } } }
  finally {
    for (const k of Object.keys(procs)) try { procs[k].kill(); } catch { /* gone */ }
    await sleep(500);
    if (!process.env.KEEP) try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
