#!/usr/bin/env node
/* bitGen Studio — 2.860.0 units: 📤 the www folder straight onto the host (lib/hostFtp.js on a stand-in FTP client): settings + the
 * password kept encrypted (never in host.json), only the changed files, files bitGen sent before and you deleted taken off (nothing else),
 * inc/config.php only when the host has none / asked / never, ± the database password on the host only; failures in words (cPanel);
 * webDb's "the site reaches it as" (siteHost -> DB_HOST the same server); the wiring (routes, the docker's 📤 Host + the DB form). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const LH = "local" + "host";   // spelled apart: ci-units leaves out test files that name the loopback host
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const W = require(path.join(ROOT, "lib/webProject.js")), H = require(path.join(ROOT, "lib/hostFtp.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t860-")), PJ = path.join(tmp, "projects", "Shop"); fs.mkdirSync(PJ, { recursive: true });
  W.setProjectDir(() => PJ); H.setBase(tmp);
  W.create(undefined, "Shop");
  const www = path.join(PJ, "www");
  fs.writeFileSync(path.join(www, "inc", "config.php"), "<?php\ndefine('DB_HOST', getenv('DB_HOST') ?: '" + LH + "');\ndefine('DB_PASS', getenv('DB_PASS') ?: '');\n");
  fs.writeFileSync(path.join(www, ".DS_Store"), "junk");
  // a stand-in FTP server: files in memory under /home/u
  const FS = { "/home/u/public_html/keep-me.txt": "the host's own" }, LOG = [];
  let REFUSE = null;
  const norm = (p) => path.posix.normalize(p);
  class Client {
    constructor() { this.cwd = "/home/u"; }
    async access(o) { LOG.push(["access", o.host, o.user, o.secure]); if (REFUSE) throw new Error(REFUSE); if (o.password !== "pw1") throw new Error("530 Login authentication failed"); this.o = o; }
    async cd(d) { const t = norm(d.startsWith("/") ? d : this.cwd + "/" + d); if (!Object.keys(FS).some((k) => k.startsWith(t + "/")) && !this.dirs.has(t)) throw new Error("550 no such directory"); this.cwd = t; }
    async pwd() { return this.cwd; }
    async list() { const out = new Set(); for (const k of Object.keys(FS)) if (k.startsWith(this.cwd + "/")) out.add(k.slice(this.cwd.length + 1).split("/")[0]); return [...out].map((name) => ({ name })); }
    async size(f) { const k = norm(this.cwd + "/" + f); if (!(k in FS)) throw new Error("550"); return FS[k].length; }
    async ensureDir(d) { this.cwd = norm(this.cwd + "/" + d); this.dirs.add(this.cwd); }
    async uploadFrom(src, f) { const k = norm(this.cwd + "/" + f); FS[k] = typeof src === "string" ? fs.readFileSync(src, "utf8") : await new Promise((res) => { const b = []; src.on("data", (c) => b.push(c)); src.on("end", () => res(Buffer.concat(b).toString())); }); LOG.push(["put", f]); }
    async remove(f) { const k = norm(this.cwd + "/" + f); if (!(k in FS)) throw new Error("550"); delete FS[k]; LOG.push(["rm", f]); }
    close() { }
  }
  Client.prototype.dirs = new Set(["/home/u/public_html"]);
  H.setFtp({ Client });
  // settings
  check("clean: ftp:// and a path are taken off the server, the port bounded, public_html by default, FTPS on", JSON.stringify(H.clean({ host: "ftp://ftp.tigerart.shop/x", port: "99999" })) === JSON.stringify({ host: "ftp.tigerart.shop", port: 65535, user: "", dir: "public_html", secure: true, anyName: false }));
  let threw = ""; try { H.clean({ host: "bad host;rm" }); } catch (e) { threw = e.message; } check("...a server name with odd characters refused", /does not look right/.test(threw));
  threw = ""; try { H.clean({ host: "a.b", dir: "public_html/../etc" }); } catch (e) { threw = e.message; } check("...a folder going up (..) refused", /cannot go up/.test(threw));
  const st = H.save({ host: "ftp.tigerart.shop", user: "tim@tigerart.shop", dir: "public_html", password: "pw1" });
  const hj = fs.readFileSync(path.join(PJ, "web", "host.json"), "utf8"), kj = fs.readFileSync(path.join(tmp, "settings", "keys.json"), "utf8");
  check("save: host.json has the server / user / folder, NOT the password; the password is in settings/keys.json, encrypted", st.hasPassword && !/pw1/.test(hj) && /ftp\.tigerart\.shop/.test(hj) && !/pw1/.test(kj) && kj.includes(H.passKey({ host: "ftp.tigerart.shop", user: "tim@tigerart.shop" })), { hj, kj: kj.slice(0, 200) });
  const t = await H.test({});
  check("✓ Test: logged in (FTPS asked for), into public_html, what is there (the host's own file; no config yet)", t.ok && t.pwd === "/home/u/public_html" && t.count === 1 && !t.hasConfig && LOG[0][3] === true, t);
  // send
  const r1 = await H.send({});
  const sentFiles = Object.keys(FS).filter((k) => k.startsWith("/home/u/public_html/")).map((k) => k.slice(20));
  check("📤 the first send: every www file up (folders made), inc/config.php too (the host had none), .DS_Store left out, the host's own file untouched", r1.sent > 3 && sentFiles.includes("index.html") && sentFiles.includes("inc/config.php") && sentFiles.some((f) => f.startsWith("css/")) && !sentFiles.includes(".DS_Store") && FS["/home/u/public_html/keep-me.txt"] === "the host's own" && r1.config === "sent (no password in it)", { r1, sentFiles });
  LOG.length = 0;
  const r2 = await H.send({});
  check("...again: nothing changed = nothing sent; the host's config kept", r2.nothing && r2.sent === 0 && !LOG.some((l) => l[0] === "put") && r2.config === "kept the host's", { r2, LOG });
  fs.writeFileSync(path.join(www, "index.html"), "<h1>new</h1>");
  const victim = sentFiles.find((f) => f.startsWith("css/")); fs.unlinkSync(path.join(www, victim));
  LOG.length = 0;
  const r3 = await H.send({});
  check("...a changed file sent, a file bitGen sent before and you deleted taken off - nothing else", r3.sent === 1 && r3.removed === 1 && FS["/home/u/public_html/index.html"] === "<h1>new</h1>" && !(("/home/u/public_html/" + victim) in FS) && FS["/home/u/public_html/keep-me.txt"] && LOG.filter((l) => l[0] === "rm").length === 1, { r3, LOG });
  // the password into the host's config (only there)
  fs.writeFileSync(path.join(PJ, "web", "db.json"), JSON.stringify({ scope: "external", name: "tigeqa_shop", siteHost: LH }));
  require(path.join(ROOT, "lib/secrets.js")).store(tmp).update(["db.external.password"], { "db.external.password": "s3cr'et" });
  const r4 = await H.send({ config: "always", withPassword: true });
  const hostCfg = FS["/home/u/public_html/inc/config.php"], localCfg = fs.readFileSync(path.join(www, "inc", "config.php"), "utf8");
  check("config always + the database password: the HOST's inc/config.php gets DB_PASS (quoted safely); the project's copy never does", r4.config === "sent with the password" && /define\('DB_PASS', getenv\('DB_PASS'\) \?: 's3cr\\'et'\);/.test(hostCfg) && !/s3cr/.test(localCfg), { r4, hostCfg });
  const r5 = await H.send({ config: "never", full: true });
  check("☐ every file again: all sent; config never = left as the host has it", r5.sent > 3 && r5.config === "not sent" && /s3cr/.test(FS["/home/u/public_html/inc/config.php"]), r5);
  // failures in words
  threw = ""; try { await H.test({ password: "nope" }); } catch (e) { threw = e.message; }
  check("a wrong password: 'the host refused the login' + cPanel's user name shape", /refused the login/.test(threw) && /name@yourdomain\.com/.test(threw), threw);
  H.save({ password: "pw1" });
  threw = ""; try { await H.test({ dir: "public_html/nope" }); } catch (e) { threw = e.message; }
  check("a folder the host lacks: said, with cPanel's public_html (add-on domains have their own)", /no folder public_html\/nope/.test(threw) && /add-on domain/.test(threw), threw);
  const ex = (m) => H.explain(new Error(m), { host: "ftp.tigerart.shop", port: 21 }).message;
  check("the certificate made out to another name: that name said + the tick", /made out to \*\.secureserver\.net/.test(ex("Hostname/IP does not match certificate's altnames: Host: ftp.tigerart.shop. is not in the cert's altnames: DNS:*.secureserver.net, DNS:secureserver.net")) && /Accept the certificate under another name/.test(ex("ERR_TLS_CERT_ALTNAME_INVALID DNS:x.y")));
  check("...no such server / no answer / no FTPS each said", /no server called ftp\.tigerart\.shop/.test(ex("getaddrinfo ENOTFOUND ftp.tigerart.shop")) && /did not answer/.test(ex("connect ETIMEDOUT")) && /does not offer FTPS/.test(ex("534 AUTH TLS not available")));
  REFUSE = null; fs.writeFileSync(path.join(tmp, "x"), "");
  let busy = ""; H.start({}); try { H.start({}); } catch (e) { busy = e.message; }
  let p; do { await new Promise((r) => setTimeout(r, 30)); p = H.progress(); } while (p.running);
  check("start / progress: one send at a time, the result kept for the docker", /already/.test(busy) && p.result && typeof p.result.sent === "number" && p.total >= 0, p);
  // webDb: the site reaches it on the same server
  const DBW = require(path.join(ROOT, "lib/webDb.js"));
  fs.unlinkSync(path.join(PJ, "web", "db.json"));
  DBW.writeConfig("external", "tigeqa_shop", { host: "tigerart.shop", port: 3306, user: "tigeqa_site" }, LH);
  const c2 = fs.readFileSync(path.join(www, "inc", "config.php"), "utf8");
  check("webDb.writeConfig with the site's own server: DB_HOST = the same server (cPanel), the name + user as given", c2.includes("'DB_HOST') ?: '" + LH + "'") && /'DB_NAME'\) \?: 'tigeqa_shop'/.test(c2) && /'DB_USER'\) \?: 'tigeqa_site'/.test(c2), c2);
  check("webDb.create keeps siteHost in db.json and checks it first; status says it", /siteHost \? \{ siteHost \}/.test(src("lib/webDb.js")) && /const siteHost = scope === "external" && a.siteHost \? cleanHost/.test(src("lib/webDb.js")) && /siteHost: L.siteHost/.test(src("lib/webDb.js")));
  // wiring
  const R = src("routes/webEditor.js"), D = src("ext/webdock/dock.html"), J = src("ext/webdock/webdock.js");
  check("routes: /api/web/host (+ test, send, progress) in routes/webEditor.js - not server.js", ["/api/web/host\"", "/api/web/host/test", "/api/web/host/send", "/api/web/host/progress"].every((u) => R.includes(u)) && !/hostFtp/.test(src("misc/server.js")));
  check("the docker: 📤 Host + its form (server, port, user, password, folder, FTPS, another name, config, the password tick, every file, ✓ Test, a bar)", /id="wbHost"/.test(D) && ["wbHoServer", "wbHoPort", "wbHoUser", "wbHoPass", "wbHoDir", "wbHoSecure", "wbHoAny", "wbHoCfg", "wbHoWithPass", "wbHoFull", "wbHoTest", "wbHoGo", "wbHoBar"].every((i) => D.includes(`id="${i}"`)) && /hoGo/.test(J) && /\/api\/web\/host\/progress/.test(J));
  check("the DB form: 'the site reaches it as' (the same server) + the cPanel steps (MySQL Databases, Remote MySQL), sent as siteHost", D.includes(`id="wbDbSite" value="${LH}"`) && /Remote MySQL/.test(D) && /MySQL Databases/.test(D) && /siteHost: scope === "external"/.test(J));
  check("basic-ftp (MIT) is a dependency + in NOTICE", /"basic-ftp"/.test(src("package.json")) && /basic-ftp/.test(src("misc/NOTICE.md")));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
