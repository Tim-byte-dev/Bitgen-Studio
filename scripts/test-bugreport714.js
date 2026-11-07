#!/usr/bin/env node
/* bitGen Studio — 2.714.0: the app's side of sending a 🐞 bug report to the bitGen Community (lib/bugReport.js payload /
 * markSent / fitLogs / homeless, lib/community.js sendBug / whoSends, the routes, the docker's wiring) with a fake
 * community server (no network). As the member when signed in with a confirmed email; anonymously when not signed in,
 * not confirmed, or chosen; the logs trimmed to fit, the home folder shown as ~, the screenshot rules.
 * Tim: "have the app allow the user to send the bug report to the db if they are registered. if not registered bug
 * report will be sent as anon" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-bug714-"));
// lib/core stands in: the app folder is tmp
require.cache[require.resolve(path.join(ROOT, "lib", "core.js"))] = { id: "core", filename: "core", loaded: true, exports: { BASE: tmp, getConfig: () => ({}), jobs: new Map() } };
const B = require(path.join(ROOT, "lib", "bugReport.js"));
const C = require(path.join(ROOT, "lib", "community.js"));
C.setBase(tmp);
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ version: "9.9.9" }));

(async () => {
  try {
    // ---- pure ---------------------------------------------------------------------------------------------------------
    const big = Array.from({ length: 40000 }, (_, i) => "line " + i).join("\n");
    const fit = B.fitLogs({ "app.txt": big, "jobs.txt": "short" }, 100000);
    const total = Object.values(fit).reduce((n, t) => n + Buffer.byteLength(t), 0);
    check("fitLogs: under the budget, the newest lines kept, says older lines were left out, small logs untouched", total <= 100000 && fit["app.txt"].endsWith("line 39999") && /^\[… older lines left out to fit\]/.test(fit["app.txt"]) && fit["jobs.txt"] === "short", total);
    check("homeless: the home folder becomes ~ (Windows and / forms, any case)", B.homeless("C:\\Users\\Tim\\a.png c:/users/tim/b.png", "C:\\Users\\Tim") === "~\\a.png ~/b.png");

    // ---- payload ------------------------------------------------------------------------------------------------------
    const id = "bug-20261107-120000-the-timeline-freezes", d = path.join(tmp, "bug-reports", id);
    fs.mkdirSync(path.join(d, "logs"), { recursive: true });
    const home = os.homedir();
    fs.writeFileSync(path.join(d, "report.json"), JSON.stringify({ id, title: "The timeline freezes", severity: "crash", area: "Timeline", when: "2026-11-07T12:00:00Z",
      happened: "It froze at " + home + "/projects/a.h3p", expected: "", steps: "1. drag", recorded: [{ t: "00:01", what: "clicked Timeline" }], page_errors: ["E1"],
      failed_requests: [], page: { url: "/", size: "1x1", ua: "x", dockers: [] }, include: { screenshot: true, logs: true, system: true, steps: true },
      system: { version: "2.714.0", os: "Linux" }, settings: { engine: { root: home + "/ComfyUI" } }, files: { screenshot: true, logs: ["app.txt"] } }));
    fs.writeFileSync(path.join(d, "logs", "app.txt"), "started in " + home + "\n" + big);
    fs.writeFileSync(path.join(d, "screenshot.png"), Buffer.from("89504e470d0a1a0a0000", "hex"));
    let p = B.payload(id, "");
    check("payload: the form's words, severity, area, the version from the report", p.title === "The timeline freezes" && p.severity === "crash" && p.area === "Timeline" && p.app_version === "2.714.0" && p.source === "app");
    check("payload: the details - system, settings, steps, errors, logs (trimmed to fit)", p.details.system.os === "Linux" && p.details.recorded.length === 1 && p.details.page_errors[0] === "E1" && Buffer.byteLength(p.details.logs["app.txt"]) <= 1200000);
    check("payload: the home folder is ~ everywhere (words, settings, logs)", !JSON.stringify(p).includes(home) && /~\/projects\/a\.h3p/.test(p.happened) && p.details.settings.engine.root === "~/ComfyUI" && /started in ~/.test(p.details.logs["app.txt"]), p.happened);
    check("payload: no shot from the page -> the saved PNG", /^data:image\/png;base64,iVBORw0KGgo/.test(p.screenshot));
    p = B.payload(id, "data:image/jpeg;base64,/9j/AAAA");
    check("payload: the page's marked-up JPEG wins", p.screenshot === "data:image/jpeg;base64,/9j/AAAA");
    fs.writeFileSync(path.join(d, "screenshot.png"), Buffer.alloc(3100000, 1));
    p = B.payload(id, "");
    check("payload: a saved PNG over 3 MB stays home, with a note saying so", p.screenshot === "" && /too big to send/.test(p.details.notes.join()), p.details.notes);
    let bad = null; try { B.payload("../../etc", ""); } catch (e) { bad = e.status; }
    check("payload: a bad report id -> 404", bad === 404);

    // ---- who it goes as, and sending -------------------------------------------------------------------------------------
    const seen = []; let me = null;
    C.setFetch(async (url, o) => {
      const action = new URL(url).searchParams.get("a"), body = JSON.parse(o.body || "{}");
      seen.push({ action, auth: (o.headers || {}).Authorization || "", body });
      let j = { ok: true };
      if (action === "me") j = me;
      if (action === "bug_report") j = { ok: true, bug_id: 7, topic_id: 12, pending: !(o.headers || {}).Authorization, anonymous: !(o.headers || {}).Authorization };
      return { ok: j.ok !== false, status: j.ok === false ? (j.status || 401) : 200, json: async () => j };
    });
    C.setUrl("https://tigerart.com.au/bitgen-community/api.php");
    let w = await C.whoSends();
    check("not signed in: whoSends = anonymous (not signed in)", w.as === "anonymous" && w.why === "not signed in", w);
    let s = await C.sendBug(B.payload(id, ""), {});
    let last = seen[seen.length - 1];
    check("not signed in: sent ANONYMOUSLY (no token), waits; the address of its discussion on the site", s.ok && s.as === "anonymous" && s.pending === true && !last.auth && !last.body.token && s.url === "https://tigerart.com.au/discussions.php?t=12", s);
    const st = JSON.parse(fs.readFileSync(path.join(tmp, "community.json"), "utf8")); st.token = "a".repeat(64); st.handle = "tim"; fs.writeFileSync(path.join(tmp, "community.json"), JSON.stringify(st));
    me = { ok: true, user: { handle: "tim", display: "Tim" }, profile: { verified: true } };
    w = await C.whoSends();
    check("signed in + confirmed: whoSends = member @tim", w.as === "member" && w.handle === "tim", w);
    s = await C.sendBug(B.payload(id, ""), {}); last = seen[seen.length - 1];
    check("signed in + confirmed: sent as the member (the token), live", s.ok && s.as === "member" && s.handle === "tim" && s.pending === false && /Bearer a{64}/.test(last.auth), s);
    s = await C.sendBug(B.payload(id, ""), { anon: true }); last = seen[seen.length - 1];
    check("☑ Send anonymously: no token even when signed in", s.ok && s.as === "anonymous" && !last.auth && !last.body.token);
    me = { ok: true, user: { handle: "tim", display: "Tim" }, profile: { verified: false } };
    w = await C.whoSends(); s = await C.sendBug(B.payload(id, ""), {}); last = seen[seen.length - 1];
    check("signed in but the email not confirmed: anonymous (says why)", w.as === "anonymous" && w.why === "email not confirmed" && s.as === "anonymous" && !last.auth, w);
    const sent = B.markSent(id, { as: s.as, handle: null, topic_id: 12, url: s.url, pending: true });
    check("markSent: report.json remembers where it went; list() shows it", sent.url === s.url && B.list()[0].sent && B.list()[0].sent.topic_id === 12);
    C.setFetch(async () => ({ ok: false, status: 429, json: async () => ({ ok: false, error: "That is a lot of bug reports" }) }));
    s = await C.sendBug(B.payload(id, ""), { anon: true });
    check("the server says no: {ok: false, error} in its words", s.ok === false && /a lot of bug reports/.test(s.error) && s.status === 429, s);

    // ---- wiring -------------------------------------------------------------------------------------------------------------
    const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
    check("routes: GET /api/bugreport/who + POST /api/bugreport/send/:id (routes/bugReport.js, never server.js)", /\/api\/bugreport\/who/.test(rd("routes/bugReport.js")) && /\/api\/bugreport\/send\/:id/.test(rd("routes/bugReport.js")) && !/bugreport\/send/.test(rd("misc/server.js")));
    const P = rd("static/bugreport.js");
    check("the docker: 📤 Save and send, ☐ Send anonymously, who it goes as, 📤 on earlier reports, ✓ sent links", /id="brSend"/.test(P) && /id="brAnon"/.test(P) && /id="brWho"/.test(P) && /data-send/.test(P) && /✓ sent/.test(P) && /image\/jpeg/.test(P));
    check("the community server takes bug_report (with a 7 MB body) and lists Bug reports", /'bug_report' => \['act_bug_report', 'opt'/.test(rd("community/lib/dispatch.php")) && /BGC_MAX_BUG_BODY/.test(rd("community/api.php")) && /'bugs' => 'Bug reports'/.test(rd("community/lib/act_forum.php")));
  } catch (e) { check("the test ran to the end", false, String(e && e.stack || e)); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
