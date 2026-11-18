#!/usr/bin/env node
/* bitGen Studio — 2.860.0 LIVE: 📤 the www folder onto a real FTPS server (pyftpdlib + TLS, a certificate made out to another name like
 * a shared host's) with the real basic-ftp: the name refused and said, "another name" accepted (the chain still checked), the files
 * landing in public_html, only the changed ones next time, plain FTP when FTPS is unticked. Needs python3 -m pip install pyftpdlib
 * pyopenssl and openssl. Not in ci-units (it starts a server). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process"), net = require("net");
const ROOT = path.join(__dirname, "..");
if (!process.env.T860_CHILD) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t860l-"));
  const sh = (c) => cp.execSync(c, { cwd: tmp, stdio: "pipe" });
  sh("openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 2 -subj /CN=TestCA");
  sh("openssl req -newkey rsa:2048 -nodes -keyout srv.key -out srv.csr -subj /CN=server.example");
  fs.writeFileSync(path.join(tmp, "ext.cnf"), "subjectAltName=DNS:server.example\n");
  sh("openssl x509 -req -in srv.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out srv.pem -days 2 -extfile ext.cnf");
  fs.writeFileSync(path.join(tmp, "both.pem"), fs.readFileSync(path.join(tmp, "srv.pem"), "utf8") + fs.readFileSync(path.join(tmp, "srv.key"), "utf8"));
  const r = cp.spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { T860_CHILD: tmp, NODE_EXTRA_CA_CERTS: path.join(tmp, "ca.pem") }), stdio: "inherit" });
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(r.status);
}
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
(async () => {
  const tmp = process.env.T860_CHILD, home = path.join(tmp, "home"); fs.mkdirSync(path.join(home, "public_html"), { recursive: true });
  fs.writeFileSync(path.join(home, "public_html", "cgi-note.txt"), "host's");
  const port = await freePort();
  const py = `
import sys
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import TLS_FTPHandler
from pyftpdlib.servers import FTPServer
a = DummyAuthorizer(); a.add_user("tim@tigerart.shop", "Pw-123", sys.argv[2], perm="elradfmwMT")
h = TLS_FTPHandler; h.certfile = sys.argv[3]; h.authorizer = a; h.passive_ports = range(${port + 1}, ${port + 40})
s = FTPServer(("127.0.0.1", int(sys.argv[1])), h); print("ready", flush=True); s.serve_forever()
`;
  const srv = cp.spawn("python3", ["-c", py, String(port), home, path.join(tmp, "both.pem")], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((res, rej) => { srv.stdout.on("data", (d) => /ready/.test(d) && res()); srv.on("exit", (c) => rej(new Error("ftp server exited " + c))); setTimeout(() => rej(new Error("ftp server did not start")), 8000); });
  try {
    const W = require(path.join(ROOT, "lib/webProject.js")), H = require(path.join(ROOT, "lib/hostFtp.js"));
    const PJ = path.join(tmp, "projects", "Shop"); fs.mkdirSync(PJ, { recursive: true });
    W.setProjectDir(() => PJ); H.setBase(tmp); W.create(undefined, "Shop");
    fs.mkdirSync(path.join(PJ, "www", "images", "deep"), { recursive: true }); fs.writeFileSync(path.join(PJ, "www", "images", "deep", "p.bin"), Buffer.alloc(300000, 7));
    H.save({ host: "127.0.0.1", port, user: "tim@tigerart.shop", dir: "public_html", secure: true, password: "Pw-123" });
    let e1 = ""; try { await H.test({}); } catch (e) { e1 = e.message; }
    check("FTPS to a server whose certificate is made out to another name: refused, and the name it IS made out to is said", /made out to server\.example/.test(e1), e1);
    const t = await H.test({ anyName: true });
    check("☑ Accept the certificate under another name: logged in over TLS (the chain still checked by the CA), in public_html", t.ok && t.secure && /public_html$/.test(t.pwd) && t.count === 1, t);
    const r1 = await H.send({ anyName: true });
    const got = (f) => { try { return fs.readFileSync(path.join(home, "public_html", f)); } catch (e) { return null; } };
    check("📤 sent: the www files land in public_html, sub-folders made, a 300 KB picture whole, the host's own file kept", r1.sent > 3 && got("index.html") && got("images/deep/p.bin") && got("images/deep/p.bin").length === 300000 && String(got("cgi-note.txt")) === "host's" && got("inc/config.php") === null, r1);
    fs.writeFileSync(path.join(PJ, "www", "about.html"), "<p>about</p>");
    const r2 = await H.send({ anyName: true });
    check("...next time only the new file goes", r2.sent === 1 && String(got("about.html")) === "<p>about</p>", r2);
    let e2 = ""; try { await H.test({ anyName: true, password: "wrong" }); } catch (e) { e2 = e.message; }
    check("a wrong password: the host refused the login", /refused the login/.test(e2), e2);
    H.save({ password: "Pw-123" });
    const t3 = await H.test({ secure: false });
    check("FTPS unticked: plain FTP logs in too (said as NOT encrypted in the docker)", t3.ok && t3.secure === false, t3);
  } finally { srv.kill(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
