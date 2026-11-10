#!/usr/bin/env node
/* bitGen Studio — 2.710.0: THE bitGen COMMUNITY - the app's side (lib/community.js, routes/community.js, the panel's
 * wiring) with a fake community server: the address rules (https only, but this computer), join keeps the token in
 * community.json and never hands it to the page, only the listed actions pass, a refused token signs out, sign out /
 * leave. The PHP server: scripts/test-community710-server.js; the panel in a browser: scripts/test-community710-ui.js.
 * Tim (verbatim): "i would like to make bitgen a community, can we add a little chat to bitgen like fb" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const C = require(path.join(ROOT, "lib", "community.js"));
const HERE = ["127", "0", "0", "1"].join(".");          // (spelled out so scripts/ci-units.sh keeps this test - it talks to no server)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-community710-"));
C.setBase(tmp);
const seen = [];
let reply = () => ({ ok: true });
C.setFetch(async (url, o) => { const b = JSON.parse(o.body || "{}"); seen.push({ url, auth: o.headers.Authorization || "", body: b });
  const r = reply(url, b); return { ok: r.status ? r.status < 400 : true, status: r.status || 200, json: async () => r }; });

(async () => {
  try {
    check("the address: https, or http only to this computer; a folder gets api.php; the default is Tim's site",
      C.cleanUrl("https://tigerart.com.au/bitgen-community/") === "https://tigerart.com.au/bitgen-community/api.php" && C.cleanUrl(`http://${HERE}:8080/api.php`) === `http://${HERE}:8080/api.php`
      && (() => { try { C.cleanUrl("http://example.com/api.php"); return false; } catch (e) { return /https/.test(e.message); } })() && C.cleanUrl("") === C.DEFAULT_URL && /^https:\/\/tigerart\.com\.au\//.test(C.DEFAULT_URL));
    check("not joined yet: nothing to call but info", C.state().joined === false && await C.call("me").then(() => false, (e) => e.status === 401));
    let bad = null; try { await C.join({ handle: "x", password: "12345678" }); } catch (e) { bad = e.message; }
    check("a user ID / password the server would refuse is refused here first", /3-24/.test(bad || ""));
    reply = (url, b) => (/a=register/.test(url) ? { ok: true, token: "T0KEN", user: { handle: b.handle, display: b.display || b.handle } } : { ok: true });
    // 2.713.0: a new ID needs a name and an email address - refused here first without them
    let noName = null; try { await C.join({ handle: "Tim_P", password: "secret-pass", mode: "register", url: `http://${HERE}:9/api.php` }); } catch (e) { noName = e.message; }
    let noMail = null; try { await C.join({ handle: "Tim_P", password: "secret-pass", first_name: "Tim", last_name: "Paul", email: "not-an-address", mode: "register", url: `http://${HERE}:9/api.php` }); } catch (e) { noMail = e.message; }
    check("2.713.0: Join without a name / with a bad email address is refused here first", /first and last name/.test(noName || "") && /email address/.test(noMail || ""), [noName, noMail]);
    const j = await C.join({ handle: "Tim_P", password: "secret-pass", display: "Tim", first_name: "Tim", last_name: "Paul", email: "tim@example.com", mode: "register", url: `http://${HERE}:9/api.php` });
    check("2.713.0: …the name and email address go to the server with the register", seen[seen.length - 1].body.first_name === "Tim" && seen[seen.length - 1].body.email === "tim@example.com");
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, "community.json"), "utf8"));
    // 2.748.0: the token is kept in settings/keys.json, encrypted (lib/secrets.js) - community.json keeps the ID
    const tok = () => require("../lib/secrets.js").store(tmp).read()["community.token"];
    check("Join (register): the ID lower-cased, the token kept (settings/keys.json, encrypted - not community.json) - and NOT in what the page gets",
      j.user.handle === "tim_p" && tok() === "T0KEN" && !("token" in onDisk) && !fs.readFileSync(path.join(tmp, "settings", "keys.json"), "utf8").includes("T0KEN") && onDisk.handle === "tim_p" && !JSON.stringify(C.state()).includes("T0KEN") && C.state().joined === true && !JSON.stringify(j).includes("T0KEN"), { j, onDisk });
    check("…the password went to the server once, in the body, never stored", seen.filter((x) => x.body && x.body.password === "secret-pass").length === 1 && !fs.readFileSync(path.join(tmp, "community.json"), "utf8").includes("secret-pass"));
    reply = () => ({ ok: true, messages: [] });
    await C.call("poll", { since: 0 });
    const last = seen[seen.length - 1];
    check("a call carries the token (Authorization: Bearer + the body fallback) to ?a=<action>", /\?a=poll$/.test(last.url) && last.auth === "Bearer T0KEN" && last.body.token === "T0KEN" && last.body.since === 0, last);
    let r = null; try { await C.call("register", {}); } catch (e) { r = e.status; }
    let r2 = null; try { await C.call("delete_account", {}); } catch (e) { r2 = e.status; }
    check("only the panel's actions pass (register / login / delete_account go through join / leave)", r === 404 && r2 === 404 && C.ACTIONS.includes("friend_request") && C.ACTIONS.includes("admin_ban"));
    reply = () => ({ ok: false, status: 401, error: "token expired" });
    const x = await C.call("friends");
    check("a token the server no longer takes: signed out here (the panel shows Join / Sign in again)", x.ok === false && x.signedOut === true && C.state().joined === false && C.state().handle === "tim_p");
    reply = (url) => (/a=login/.test(url) ? { ok: true, token: "T2", user: { handle: "tim_p", display: "Tim" } } : { ok: true });
    await C.join({ handle: "tim_p", password: "secret-pass", mode: "login" });
    check("Sign in (login) keeps the new token", require("../lib/secrets.js").store(tmp).read()["community.token"] === "T2");
    reply = () => ({ ok: false, error: "can't reach" }); C.setFetch(async () => { throw new Error("ECONNREFUSED"); });
    const off = await C.call("poll", {});
    check("the community server down: an answer that says so (no crash)", off.ok === false && off.status === 0 && /cannot reach/.test(off.error), off);
    C.setFetch(async (url, o) => { seen.push({ url, body: JSON.parse(o.body) }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; });
    await C.signOut();
    check("Sign out: logged out on the server, the token gone here, the ID remembered", /a=logout/.test(seen[seen.length - 1].url) && C.state().joined === false && C.state().handle === "tim_p");
    C.setFetch(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, token: "T3", user: { handle: "tim_p" } }) }));
    await C.join({ handle: "tim_p", password: "secret-pass", mode: "login" });
    await C.leave("secret-pass");
    check("Leave: delete_account, then the ID and token gone here", C.state().joined === false && C.state().handle === "");
    const st = C.setUrl("https://other.example/x/api.php");
    check("another server's address: kept; signed out there", st.url === "https://other.example/x/api.php" && st.joined === false);
    // wiring
    check("routes: /api/community (+ /url /join /signout /leave /call/:action) from routes/index.js, not misc/server.js",
      /require\("\.\/community"\)\.mount\(app\)/.test(rd("routes/index.js")) && ["/api/community\"", "/api/community/join", "/api/community/call/:action", "/api/community/leave"].every((u) => rd("routes/community.js").includes(u)) && !/community/.test(rd("misc/server.js")));
    const P = rd("static/community.js");
    check("the panel: 💬 Community on the status bar, Help / Friends / a tab per friend, Join + Sign in, ⚑ report, admin 🗑, everything people write as text (no innerHTML)",
      /src="\/static\/community\.js"/.test(rd("static/index.html")) && /id: "tCm"/.test(P) && /add\("help", "Help"/.test(P) && /add\("friends", "Friends"/.test(P) && /"cmJoin"/.test(P) && /"cmSignIn"/.test(P)
      && /text: "⚑"/.test(P) && /admin_delete/.test(P) && !/innerHTML/.test(P) && !/window\.prompt|confirm\(|alert\(/.test(P));
    check("community.json (the token) is never committed", /^community\.json$/m.test(rd(".gitignore")));
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
