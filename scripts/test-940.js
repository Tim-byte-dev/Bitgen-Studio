#!/usr/bin/env node
/* bitGen Studio — 2.940.0 units: 🔒 Settings ▸ Security (local sign-in, preferred name for the LLM), Settings ▸ General ▸ hide
 * the splash, 🚓 Police Chase fullscreen on ⛶ and its high scores under bitGen's name.
 * Tim: "can we make if fullscreen on mamimize. no need to ask for name, it should use name provided in bitgen. add a security
 * tab to settings. explain that it is local security,not saved online. add a checkbox to ask for username and password on
 * startup. add inputs for username and password and preferred name. when user talks to llm , llm will talk to them by their
 * preferred name in a friendly manner. in the general tab add a checkbox to hide splash screen" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const S = require("../lib/security.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-sec940-"));
S.useDir(tmp);
check("nothing set: no sign-in, no name, the chat gets no name line", JSON.stringify(S.pub()) === JSON.stringify({ ask: false, user: "", name: "", email: "", hasPassword: false }) && S.login("x", "y") === true && S.nameNote() === "");
let err = ""; try { S.save({ ask: true }); } catch (e) { err = e.message; }
check("asking needs a username and a password first", /username/.test(err));
err = ""; try { S.save({ user: "tim", password: "abc" }); } catch (e) { err = e.message; }
check("...a password of at least 4 characters", /4 characters/.test(err));
const p1 = S.save({ ask: true, user: "Tim", password: "tiger-art", name: "Timmy" });
const raw = fs.readFileSync(S.file(), "utf8");
check("saved on this PC in settings/security.json - the password never, only a salted scrypt hash", p1.ask && p1.hasPassword && !raw.includes("tiger-art") && /"salt": "[0-9a-f]{32}"/.test(raw) && /"hash": "[0-9a-f]{64}"/.test(raw));
check("...the page never sees the hash or the salt", !("hash" in p1) && !("salt" in p1) && JSON.stringify(S.pub()) === JSON.stringify(p1));
check("sign-in: the right pair (username any case) yes; a wrong password or user no", S.login("tim", "tiger-art") && S.login("TIM", "tiger-art") && !S.login("tim", "tiger") && !S.login("bob", "tiger-art") && !S.login("tim", ""));
const h1 = JSON.parse(raw).hash; S.save({ user: "Tim", name: "Timmy" });
check("a blank password keeps the one there", JSON.parse(fs.readFileSync(S.file(), "utf8")).hash === h1 && S.login("tim", "tiger-art"));
S.save({ password: "new-one" });
check("a new password replaces it (new salt)", !S.login("tim", "tiger-art") && S.login("tim", "new-one"));
check("the chat LLM is told the preferred name, to use warmly and now and then", /The user's name is Timmy\./.test(S.nameNote()) && /warm, friendly/.test(S.nameNote()) && /not in every sentence/.test(S.nameNote()));
S.save({ name: "" });
check("no preferred name = the username", S.displayName() === "Tim" && /name is Tim\./.test(S.nameNote()));
S.save({ ask: false });
check("unticked: no sign-in asked", S.pub().ask === false && S.login("", "") === true);
check("names are cleaned (no markup, 40 at most)", S.clean("<b>Al</b> & Bo") === "bAlb Bo" && S.clean("x".repeat(60)).length === 40);
fs.rmSync(tmp, { recursive: true, force: true }); S.useDir(null);

const P = require("../static/securitytab.js");
check("the cover: up when asking and this start hasn't signed in", P.shown({ ask: true }, false) && !P.shown({ ask: true }, true) && !P.shown({ ask: false }, false));
check("the password fields: must match, 4+, and needed to start asking", P.passProblem("abcd", "abce", false, false) !== "" && P.passProblem("abc", "abc", false, false) !== ""
  && P.passProblem("", "", false, true) !== "" && P.passProblem("", "", true, true) === "" && P.passProblem("abcd", "abcd", false, true) === "");
check("H3Security.name(): preferred, else username", P.who({ name: "Timmy", user: "tim" }) === "Timmy" && P.who({ user: "tim" }) === "tim" && P.who({}) === "");

const H = src("static/index.html"), JSI = src("static/securitytab.js"), R = src("routes/index.js");
check("Settings ▸ Security: the tab, 'this is local security' (always shown, not help text), the checkbox, username, password twice, preferred name, Save",
  /data-stab="security"/.test(H) && /id="stab-security"/.test(H) && /<p class="hint" id="sec_local"[^>]*>🔒 <b>This is local security\.<\/b>/.test(H) && /never sent online/.test(H)
  && ["sec_name", "sec_ask", "sec_user", "sec_pass", "sec_pass2", "sec_save"].every((id) => H.includes('id="' + id + '"')));
check("...the sign-in cover loads at the top of the page (before the studio paints) and stops keys / focus", /<body>\n<script src="\/static\/locklayer\.js"><\/script>[^\n]*\n<script src="\/static\/securitytab\.js">/.test(H)
  && /root\.addEventListener\(k, block, true\)/.test(JSI) && /focusin", keepFocus/.test(JSI) && /sessionStorage", SK, "1"/.test(JSI));
check("routes: GET / POST /api/security, POST /api/security/login (a wrong pair waits); mounted from routes/index.js, not server.js",
  /require\("\.\/security"\)\.mount\(app\)/.test(R) && /app\.post\("\/api\/security\/login"/.test(src("routes/security.js")) && /setTimeout\(\(\) => res\.status\(401\)/.test(src("routes/security.js")) && !/security/i.test(src("misc/server.js")));
check("the chat and the 📱 voice get the name line", /require\("\.\.\/lib\/security"\)\.nameNote\(\) \}\];/.test(R) && /require\("\.\/security"\)\.nameNote\(\)/.test(src("lib/appVoice.js")));
check("settings/ (security.json) never goes in the repo", /^\/settings\/$/m.test(src(".gitignore")));
check("General ▸ Hide the splash screen = ui.no_splash; the desktop shell reads it", /id="s_nosplash"/.test(H) && /ui: \{ no_splash: c\.checked \}/.test(JSI)
  && /require\("\.\/startPrefs"\)\.noSplash\(ROOT\)/.test(src("electron/main.js")));
const SP = require("../electron/startPrefs.js"), t2 = fs.mkdtempSync(path.join(os.tmpdir(), "bg-sp940-"));
fs.mkdirSync(path.join(t2, "misc")); fs.writeFileSync(path.join(t2, "misc", "default.settings"), JSON.stringify({ ui: { no_splash: false } }));
const a = SP.noSplash(t2); fs.writeFileSync(path.join(t2, "custom.settings"), JSON.stringify({ ui: { no_splash: true } })); const b = SP.noSplash(t2);
fs.writeFileSync(path.join(t2, "custom.settings"), "{broken"); const c = SP.noSplash(t2);
check("...startPrefs: default off, custom.settings on, a broken file = the splash", a === false && b === true && c === false);
fs.rmSync(t2, { recursive: true, force: true });

const CJ = src("ext/chasedock/chasedock.js"), DH = src("ext/chasedock/dock.html");
check("🚓 ⛶ = the whole screen (Fullscreen API on the docker); 🗗 / Esc / un-maximized = back", /function fullOn\(\)/.test(CJ) && /d\.requestFullscreen\(/.test(CJ) && /closest\("#pcMaxBtn"\)/.test(CJ)
  && /fullscreenchange/.test(CJ) && /root\.toggleMax\("chasedock", false\)/.test(CJ) && /doc\.fullscreenElement === d\) fullOff\(\)/.test(CJ) && /#chasedock:fullscreen/.test(DH));
check("🚓 no name asked: a top-ten score is saved under bitGen's name (preferred, else username, else Driver)", !/pcNameIn/.test(DH + CJ) && /if \(qual\) saveScore\(\)/.test(CJ) && /root\.H3Security/.test(CJ) && /"Driver"/.test(CJ));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
