#!/usr/bin/env node
/* bitGen Studio — 2.712.1: the Community server reads its database settings from the private folder the tigerart.com.au
 * admin page (/b_admin/) writes, OUTSIDE public_html - db.json + db-pass.txt (the password encrypted with secret.key) -
 * when there is no config.php (community/lib/settings.php: bgc_private_settings, bgc_secret_open).
 * Both formats (bgx1 libsodium secretbox, bgx2 AES-256-GCM), a damaged or wrong-key box refused in words, config.php
 * still wins, BGC_DSN still overrides the address, no private folder = the old "not set up" message.
 * Tim: "i will enter the db password into a text field, the password will be encrypted then saved in a txt file. to be
 * used for the db" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
if (spawnSync("php", ["-v"]).status !== 0) { console.log("SKIP: no php here - the 2.712.1 community settings test did not run"); process.exit(0); }
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

const COMM = path.join(__dirname, "..", "community");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bgc7121-"));
const PRIV = path.join(TMP, "bitgen-private");
fs.mkdirSync(PRIV);
const PASS = "Tiger-db-pass#2026 with spaces & ünïcode";

/** run PHP: the settings as JSON (or the error) with these env vars */
function settings(env, cwd) {
  const r = spawnSync("php", ["-r", "define('BGC','t'); require 'lib/http.php'; require 'lib/settings.php'; try { echo json_encode(bgc_settings()); } catch (ApiError \\$e) { echo json_encode(['error' => \\$e->getMessage()]); }".replace(/\\\$/g, "$")],
    { cwd: cwd || COMM, env: Object.assign({}, process.env, { BGC_DSN: "", BITGEN_PRIVATE_DIR: PRIV }, env || {}), encoding: "utf8" });
  try { return JSON.parse(r.stdout); } catch (e) { return { out: r.stdout + r.stderr }; }
}
/** seal like /b_admin/ does (its lib/core.php secret_seal) */
function seal(kind, key) {
  const code = kind === "bgx1"
    ? "$k=base64_decode($argv[1]); $n=random_bytes(24); echo 'bgx1:'.base64_encode($n.sodium_crypto_secretbox($argv[2],$n,$k));"
    : "$k=base64_decode($argv[1]); $iv=random_bytes(12); $t=''; $c=openssl_encrypt($argv[2],'aes-256-gcm',$k,OPENSSL_RAW_DATA,$iv,$t); echo 'bgx2:'.base64_encode($iv.$t.$c);";
  return spawnSync("php", ["-r", code, key, PASS], { encoding: "utf8" }).stdout;
}

const key = Buffer.alloc(32, 7).toString("base64");
let s = settings();
check("no config.php and no private folder: the old 'not set up' message", /not set up yet/.test(s.error || ""), s);

fs.writeFileSync(path.join(PRIV, "secret.key"), key + "\n");
fs.writeFileSync(path.join(PRIV, "db.json"), JSON.stringify({ host: "localhost", name: "timpaul_bitgen", user: "timpaul_bitgen", admins: ["Tim", "lili"] }));
for (const kind of ["bgx1", "bgx2"]) {
  fs.writeFileSync(path.join(PRIV, "db-pass.txt"), seal(kind, key) + "\n");
  s = settings();
  check(kind + ": the password decrypted from db-pass.txt", s.pass === PASS, s);
}
check("the address built from db.json (MySQL, utf8mb4)", s.dsn === "mysql:host=localhost;dbname=timpaul_bitgen;charset=utf8mb4" && s.user === "timpaul_bitgen", s);
check("the Community admins from db.json, lower-case", JSON.stringify(s.admins) === '["tim","lili"]', s.admins);
check("still https only", s.require_https === true);

s = settings({ BGC_DSN: "sqlite:" + path.join(TMP, "x.db") });
check("BGC_DSN still replaces the address (the password still read)", s.dsn.startsWith("sqlite:") && s.pass === PASS, s);

fs.writeFileSync(path.join(PRIV, "secret.key"), Buffer.alloc(32, 9).toString("base64"));
s = settings();
check("the wrong key: refused in words, never a wrong password", /cannot read its database password/.test(s.error || ""), s);
fs.writeFileSync(path.join(PRIV, "secret.key"), key);
const good = fs.readFileSync(path.join(PRIV, "db-pass.txt"), "utf8").trim();
fs.writeFileSync(path.join(PRIV, "db-pass.txt"), good.slice(0, -6) + "AAAA==");
s = settings();
check("a damaged db-pass.txt: refused in words", /cannot read its database password/.test(s.error || ""), s);
fs.writeFileSync(path.join(PRIV, "db-pass.txt"), good);

// the default place: the folder above the document root
const home = path.join(TMP, "home"), www = path.join(home, "public_html");
fs.mkdirSync(www, { recursive: true });
fs.cpSync(PRIV, path.join(home, "bitgen-private"), { recursive: true });
const r = spawnSync("php", ["-r", "$_SERVER['DOCUMENT_ROOT']=$argv[1]; define('BGC','t'); require 'lib/http.php'; require 'lib/settings.php'; echo json_encode(bgc_settings());", www],
  { cwd: COMM, env: Object.assign({}, process.env, { BGC_DSN: "", BITGEN_PRIVATE_DIR: "" }), encoding: "utf8" });
let d = {}; try { d = JSON.parse(r.stdout); } catch (e) { d = { out: r.stdout + r.stderr }; }
check("by default the private folder beside public_html (/home/<user>/bitgen-private)", d.pass === PASS, d);

// config.php wins
const copy = path.join(TMP, "community");
fs.cpSync(COMM, copy, { recursive: true });
fs.writeFileSync(path.join(copy, "config.php"), "<?php if (!defined('BGC')) exit; $BGC = ['dsn' => 'mysql:host=db;dbname=other', 'user' => 'u', 'pass' => 'from-config'];\n");
s = settings({}, copy);
check("a config.php still wins over the private folder", s.pass === "from-config" && s.dsn.includes("dbname=other"), s);

fs.rmSync(TMP, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
