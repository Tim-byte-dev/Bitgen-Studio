#!/usr/bin/env node
/* bitGen Studio — 2.756.3 units: JOINING IS FOR PEOPLE, the app's side (lib/community.js zeroBits / solvePow / join) and the
 * Community server's code read as text (community/lib/human.php, email.php, act_account.php, dispatch.php).
 * Tim pasted /b_admin/ ▸ Members - bots with random user IDs, random names ("aJizTlgdmOafqerJwBanQA") and other people's
 * email addresses - then "yes please go ahead with all 4" (made-up names refused, the website's slider, a check for the
 * app's Join, Remove unconfirmed sign-ups). The live server parts: scripts/test-community7563-server.js and tigerart's
 * scripts/test-joincheck.js. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const C = require("../lib/community");

(async () => {
  check("zeroBits: counts the leading zero bits", C.zeroBits(Buffer.from([0, 0, 0x0f, 0xff])) === 20 && C.zeroBits(Buffer.from([0x80])) === 0 && C.zeroBits(Buffer.from([0x01])) === 7 && C.zeroBits(Buffer.from([0, 0x40])) === 9);
  const c = "1731300000000.0123456789abcdef." + "b".repeat(64);
  let t = Date.now();
  const n = await C.solvePow(c, 16);
  check("solvePow: an n whose sha256(c + ':' + n) starts with 16 zero bits, quickly; bits 0 = nothing to do",
    C.zeroBits(crypto.createHash("sha256").update(c + ":" + n).digest()) >= 16 && Date.now() - t < 5000 && (await C.solvePow(c, 0)) === "0", { n, ms: Date.now() - t });
  let err = null; try { await C.solvePow(c, 28, { max: 50 }); } catch (e) { err = e; }
  check("…gives up in words when it cannot finish", err && /took too long/.test(err.message));

  // join() against a stand-in server: join_check first, the sum done, then register with pow
  const seen = [], dir = fs.mkdtempSync(path.join(os.tmpdir(), "bgc7563-"));
  C.setBase(dir);
  const reply = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o), json: async () => o, headers: { get: () => "application/json" } });
  C.setFetch(async (u, o) => {
    const a = /\?a=(\w+)/.exec(u)[1], b = JSON.parse(o.body || "{}"); seen.push({ a, b });
    if (a === "join_check") return reply({ ok: true, c, bits: 12 });
    if (a === "register") {
      const okSum = b.pow && b.pow.c === c && C.zeroBits(crypto.createHash("sha256").update(c + ":" + b.pow.n).digest()) >= 12;
      return reply(okSum ? { ok: true, token: "t".repeat(40), user: { handle: b.handle, display: b.handle }, profile: null, mail_sent: true } : { ok: false, error: "Joining needs bitGen Studio 2.756.3 or newer" });
    }
    return reply({ ok: true });
  });
  const r = await C.join({ url: "https://example.org/bitgen-community/api.php", handle: "ada", password: "pw-ada-1234", first_name: "Ada", last_name: "Lovelace", email: "ada@example.org" }).catch((e) => ({ err: e.message }));
  check("join(): asks join_check, does the sum, sends it with register; joined", seen.map((x) => x.a).join() === "join_check,register" && seen[1].b.pow && seen[1].b.pow.c === c && r.user && r.user.handle === "ada", { seen: seen.map((x) => x.a), r });
  seen.length = 0;
  await C.join({ url: "https://example.org/bitgen-community/api.php", handle: "ada", password: "pw-ada-1234", mode: "login" }).catch(() => null);
  check("…signing in asks no sum", seen.map((x) => x.a).join() === "login");
  seen.length = 0;
  C.setFetch(async (u, o) => { const a = /\?a=(\w+)/.exec(u)[1], b = JSON.parse(o.body || "{}"); seen.push({ a, b });
    if (a === "join_check") return reply({ ok: false, error: "unknown action" });
    return reply({ ok: true, token: "t".repeat(40), user: { handle: b.handle }, mail_sent: true }); });
  await C.join({ url: "https://example.org/bitgen-community/api.php", handle: "bob", password: "pw-bob-12345", first_name: "Bob", last_name: "Lee", email: "bob@example.org" }).catch(() => null);
  check("…an older Community server without join_check: register still sent (no pow)", seen.map((x) => x.a).join() === "join_check,register" && !seen[1].b.pow);
  C.setFetch(null); fs.rmSync(dir, { recursive: true, force: true });

  const H = rd("community", "lib", "human.php"), E = rd("community", "lib", "email.php"), A = rd("community", "lib", "act_account.php"), D = rd("community", "lib", "dispatch.php"), B = rd("community", "lib", "boot.php");
  check("the server: human.php loaded, join_check an action, register calls human_check before anything is stored, the version 2.756.3",
    /require __DIR__ \. '\/human\.php';/.test(B) && /define\('BGC', '2\.756\.3'\)/.test(B) && /'join_check' => \['act_join_check', false, false, false\]/.test(D)
    && A.indexOf("human_check($b);") > 0 && A.indexOf("human_check($b);") < A.indexOf("INSERT INTO bgc_users"));
  check("…made-up names refused in v_name (register AND set_profile) before any email; users_drop_unconfirmed bans no address",
    /if \(looks_made_up\(\$v\)\) throw new ApiError\(400/.test(E) && /function users_drop_unconfirmed\(int \$olderMs\): int/.test(E) && !/banned_emails/.test((E.match(/function users_drop_unconfirmed[\s\S]*?\n\}/) || [""])[0])
    && /BGC_POW_BITS/.test(H) && /bgc_human_checked/.test(H));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); process.exit(1); });
