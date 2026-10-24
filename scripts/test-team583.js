#!/usr/bin/env node
/* bitGen Studio — scripts/test-team583.js (2.583.0): THE RENDER FARM's team and keys, two PCs simulated with one team
 * folder (lib/team.js setBase / setConfig): the leader makes the team, a member joins and is approved, the leader's
 * bitGen issues today's keys; a request signed with a member's key passes, and every way to fake one is refused (another
 * day, another team, a changed body, a replay, a clock 3 minutes off, a removed member, a key without its private key, a
 * team.json someone changed). The owner's access (lib/farmNode.js: unrestricted / from - to), the job's paths between
 * PCs (lib/farm.js tokenize / expand / outsideRoots), ⚡ Spread (pick), what is sent (isFarmMode) and static/team.js's
 * words. Tim: "send api keys out to each team member daily from the team leader so there is no unauthorized access ...
 * have levels of access - time limit and unrestricted, time limit will set time from - time to". No network. */
"use strict";
// 2.589.0: the render farm is the OPTIONAL Team extension (ext/teamdock - its own zip); not installed here = SKIP
if (!require("fs").existsSync(require("path").join(__dirname, "..", "ext", "teamdock", "ext.json"))) { console.log("SKIP: the Team render farm extension (ext/teamdock) is not installed here"); console.log("RESULT: PASS"); process.exit(0); }
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

const T = require("../ext/teamdock/server/team");
const N = require("../ext/teamdock/server/farmNode");
const F = require("../ext/teamdock/server/farm");
const W = require("../ext/teamdock/team.js");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-team583-"));
const NAS = path.join(tmp, "nas", "bitgen-team");
const pcs = { A: { base: path.join(tmp, "pcA"), cfg: { folder: "", member: "", sharing: false, port: 8312, target: "local" } },
              B: { base: path.join(tmp, "pcB"), cfg: { folder: "", member: "", sharing: false, port: 8312, target: "local" } },
              C: { base: path.join(tmp, "pcC"), cfg: { folder: "", member: "", sharing: false, port: 8312, target: "local" } } };
const on = (k) => { T.setBase(pcs[k].base); T.setConfig(() => pcs[k].cfg); N.setDir(path.join(pcs[k].base, "team")); };

try {
  // ---------------------------------------------------------------- pure
  check("canonical: sorted keys, so a signature does not depend on the key order", T.canonical({ b: 1, a: [2, { d: 1, c: 2 }] }) === T.canonical({ a: [2, { c: 2, d: 1 }], b: 1 }) && T.canonical({ b: 1, a: 2 }) === '{"a":2,"b":1}');
  const kp = T.keyPair(), kp2 = T.keyPair();
  check("Ed25519: sign / verify; another key or a changed body fails", T.verify({ x: 1 }, T.sign({ x: 1 }, kp.pem), kp.pub) && !T.verify({ x: 1 }, T.sign({ x: 1 }, kp.pem), kp2.pub) && !T.verify({ x: 2 }, T.sign({ x: 1 }, kp.pem), kp.pub) && T.pubOf(kp.pem) === kp.pub);
  const noon = new Date(2026, 9, 23, 12, 0).getTime(), w = T.dayWindow(noon);
  check("dayWindow: today from 00:00 to 23:59:59.999 on this clock", w.day === "2026-10-23" && new Date(w.from).getHours() === 0 && w.to - w.from === 86400000 - 1 && noon >= w.from && noon <= w.to, w);
  const cert = { team: "t1", member: "Sam", pub: kp2.pub, from: w.from, to: w.to, day: w.day };
  const key = { cert, sig: T.sign(cert, kp.pem) };
  check("certOk: the leader's key today = ok; tomorrow = expired; another team; another signer; a removed member",
    T.certOk(key, "t1", kp.pub, noon) === "" && /expired/.test(T.certOk(key, "t1", kp.pub, w.to + 1)) && /not valid yet/.test(T.certOk(key, "t1", kp.pub, w.from - 1))
    && /another team/.test(T.certOk(key, "t2", kp.pub, noon)) && /not signed/.test(T.certOk(key, "t1", kp2.pub, noon)) && /removed/.test(T.certOk(key, "t1", kp.pub, noon, ["sam"]))
    && /not signed/.test(T.certOk({ cert: Object.assign({}, cert, { to: w.to + 86400000 * 30 }), sig: key.sig }, "t1", kp.pub, noon)));
  check("reqString: method + path + time + the body's sha256", T.reqString("post", "/farm/jobs", 5, "{}") === "POST\n/farm/jobs\n5\n" + require("crypto").createHash("sha256").update("{}").digest("hex"));
  check("slug: a name -> a file name", T.slug("  Sam O'Neil ") === "sam-o-neil" && T.slug("../../x") === "x");

  // ---------------------------------------------------------------- the team: A = Tim (leader), B = Sam, C = Eve (never approved)
  on("A");
  let r = T.create(NAS, "H3 crew", "Tim");
  check("the leader makes the team in the NAS folder: team.json (signed), members/, keys/, machines/, projects/ + its marker; Tim's key issued",
    r.ok && ["members", "keys", "machines", "projects"].every((d) => fs.existsSync(path.join(NAS, d))) && fs.existsSync(path.join(NAS, "keys", "tim.json")) && T.readJson(path.join(NAS, "projects", ".bitgen-team.json")).team === r.team && T.isLeader(), r);
  check("a second team in the same folder is refused", /already/.test(T.create(NAS, "x", "y").error || ""));
  check("the private keys stay on this PC (<app>/team), not on the NAS", fs.existsSync(path.join(pcs.A.base, "team", "leader.pem")) && !fs.readdirSync(NAS, { recursive: true }).some((f) => /\.pem$/.test(String(f))));
  const myA = T.myKey();
  check("the leader's own key is valid today", myA.valid, myA);

  on("B");
  r = T.join(NAS, "Sam");
  check("Sam joins: a request in members/ with his public key, not approved yet; no key until the leader approves", r.ok && !r.approved && fs.existsSync(path.join(NAS, "members", "sam.json")) && !T.myKey().valid && /no key for Sam/.test(T.myKey().why), [r, T.myKey()]);
  check("a member cannot approve or issue keys (only the leader's PC signs)", !T.isLeader() && /not the leader/.test(T.issueKeys().error || "") && (() => { try { T.approve("Sam"); return false; } catch (e) { return /only the team leader/.test(e.message); } })());
  on("C"); T.join(NAS, "Eve");

  on("A");
  check("the leader sees both join requests", T.requests().map((m) => m.name).sort().join() === "Eve,Sam", T.requests());
  r = T.approve("Sam");
  check("✓ Approve Sam: he is in team.json (re-signed) and has today's key", r.ok && T.teamFile().team.members.some((m) => m.name === "Sam") && fs.existsSync(path.join(NAS, "keys", "sam.json")) && T.requests().map((m) => m.name).join() === "Eve", r);
  check("issueKeys again the same day issues nothing new", T.issueKeys().issued.length === 0);
  const tomorrow = Date.now() + 86400000;
  const iss = T.issueKeys(tomorrow);
  check("the day turns: the leader's bitGen issues a new key to every approved member (Tim, Sam - not Eve)", iss.issued.sort().join() === "Sam,Tim", iss);
  T.issueKeys(Date.now());                       // back to today's for the rest

  on("B");
  check("Sam's key is valid now (his PC's key pair, signed by the leader)", T.myKey().valid, T.myKey());
  const body = JSON.stringify({ project: "Film", params: { mode: "image" } });
  const h = T.signHeaders("POST", "/farm/jobs", body);
  check("Sam's request carries today's key, the time, his machine id and a signature", h["x-bg-key"] && h["x-bg-time"] && h["x-bg-machine"] && h["x-bg-sig"]);

  on("A");
  let v = T.verifyRequest(h, "POST", "/farm/jobs", body);
  check("Tim's PC: Sam's signed request passes", v.ok && v.member === "Sam", v);
  check("the same request again = a replay, refused", /replayed/.test(T.verifyRequest(h, "POST", "/farm/jobs", body).error || ""));
  on("B"); const h2 = T.signHeaders("POST", "/farm/jobs", body); on("A");
  check("a changed body / path / method is refused", /not signed/.test(T.verifyRequest(h2, "POST", "/farm/jobs", body.replace("image", "video")).error || "")
    && /not signed/.test(T.verifyRequest(h2, "POST", "/farm/request", body).error || "") && /not signed/.test(T.verifyRequest(h2, "GET", "/farm/jobs", body).error || ""));
  on("B"); const h3 = T.signHeaders("POST", "/farm/hello", "{}"); on("A");
  check("a clock more than 2 minutes off is refused", /2 minutes/.test(T.verifyRequest(h3, "POST", "/farm/hello", "{}", Date.now() + 3 * 60000).error || ""));
  check("tomorrow, yesterday's key is refused (a new key every day)", /expired/.test(T.verifyRequest(h3, "POST", "/farm/hello", "{}", Date.now() + 86400000 * 2).error || ""));
  // someone copies Sam's key from the NAS but has not got his private key
  const stolen = { "x-bg-key": h["x-bg-key"], "x-bg-time": String(Date.now()), "x-bg-machine": "x", "x-bg-sig": T.sign(T.reqString("POST", "/farm/hello", Date.now(), "{}"), T.keyPair().pem) };
  check("Sam's key file read off the NAS gives nobody access (the request must be signed with Sam's private key)", /not signed by Sam/.test(T.verifyRequest(stolen, "POST", "/farm/hello", "{}").error || ""));
  // a forged key for Eve signed by someone who is not the leader
  const evil = T.keyPair(), ec = { team: T.teamFile().team.id, member: "Eve", pub: evil.pub, from: w.from - 86400000 * 400, to: Date.now() + 86400000, day: "x" };
  const forged = { "x-bg-key": Buffer.from(JSON.stringify({ cert: ec, sig: T.sign(ec, evil.pem) })).toString("base64"), "x-bg-time": String(Date.now()), "x-bg-machine": "x" };
  forged["x-bg-sig"] = T.sign(T.reqString("POST", "/farm/hello", +forged["x-bg-time"], "{}"), evil.pem);
  check("a key not signed by the leader (Eve, never approved, made her own) is refused", /not signed by the team leader/.test(T.verifyRequest(forged, "POST", "/farm/hello", "{}").error || ""));
  check("no key at all is refused", /no key/.test(T.verifyRequest({}, "POST", "/farm/hello", "{}").error || ""));

  // someone edits team.json on the NAS (adds Eve) without the leader's key
  const tjf = path.join(NAS, "team.json"), keep = fs.readFileSync(tjf, "utf8"), tj = JSON.parse(keep);
  tj.members.push({ name: "Eve", pub: evil.pub, approved: true });
  fs.writeFileSync(tjf, JSON.stringify(tj));
  check("team.json changed by hand on the NAS: every PC stops trusting it (pinned leader key)", /someone changed it/.test(T.teamFile().error || "") && (on("B"), /someone changed it/.test(T.myKey().why || "")), T.teamFile());
  on("A"); fs.writeFileSync(tjf, keep);
  // someone swaps the whole team for one with their own leader key - a joined PC refuses it
  on("B");
  const ev2 = T.keyPair(), fake = Object.assign({}, JSON.parse(keep), { leader: { name: "Eve", pub: ev2.pub } }); delete fake.sig; fake.sig = T.sign(fake, ev2.pem);
  fs.writeFileSync(tjf, JSON.stringify(fake));
  check("a team.json re-signed with another leader key is refused by a PC that joined (and joining again says the leader changed)", /someone changed it/.test(T.teamFile().error || "") && /changed since this PC joined/.test(T.join(NAS, "Sam").error || ""));
  fs.writeFileSync(tjf, keep);

  // the leader removes Sam
  on("B"); const h4 = T.signHeaders("POST", "/farm/hello", "{}");
  on("A");
  check("🗑 Remove Sam: his key file goes, he is on the revoked list, and today's key he still holds is refused at once", T.remove("Sam").ok && !fs.existsSync(path.join(NAS, "keys", "sam.json")) && /removed/.test(T.verifyRequest(h4, "POST", "/farm/hello", "{}").error || ""));
  check("the leader cannot remove themselves", /cannot remove/.test(T.remove("Tim").error || ""));
  check("a removed member gets no new key", T.issueKeys(tomorrow + 86400000).issued.join() === "Tim");
  T.issueKeys(Date.now());
  on("B"); T.join(NAS, "Sam"); on("A"); T.approve("Sam");
  check("Sam asks again and is approved again: off the revoked list, a key again", !T.teamFile().team.revoked.includes("Sam") && (on("B"), T.myKey().valid));

  // who is online
  on("A"); pcs.A.cfg.sharing = true; const hb = T.heartbeat({ jobs: [{ id: "j1", status: "running", pct: 40 }] });
  on("B"); T.heartbeat({ jobs: [] });
  const ms = T.machines();
  check("machines/: each PC says it is online with its sharing switch + jobs; this PC is marked me", hb && ms.length === 2 && ms.find((m) => m.member === "Tim").sharing === true && ms.find((m) => m.member === "Tim").jobs[0].pct === 40 && ms.find((m) => m.member === "Sam").me && ms.every((m) => m.online), ms);
  check("a PC not seen for 45 s is offline (bitGen not running there = nobody renders on it)", T.machines(Date.now() + 46000).every((m) => !m.online));

  // ---------------------------------------------------------------- the owner's access (farmNode)
  on("A");
  check("checkGrant: unrestricted; from - to (ISO); to before from / missing / a made-up level refused",
    N.checkGrant("unrestricted").level === "unrestricted" && N.checkGrant("window", "2026-10-23T10:00", "2026-10-23T12:00").to.endsWith("Z")
    && /after/.test(N.checkGrant("window", "2026-10-23T12:00", "2026-10-23T10:00").error) && /pick/.test(N.checkGrant("window", "", "x").error) && N.checkGrant("admin").error);
  const g = { level: "window", from: "2026-10-23T10:00:00.000Z", to: "2026-10-23T12:00:00.000Z" };
  check("allows: a from - to grant only inside its time; unrestricted always; none never",
    N.allows(g, Date.parse("2026-10-23T11:00:00Z")) && !N.allows(g, Date.parse("2026-10-23T09:59:00Z")) && !N.allows(g, Date.parse("2026-10-23T12:01:00Z")) && N.allows({ level: "unrestricted" }) && !N.allows(null) && !N.allows({ level: "x" }));
  N.addRequest("Sam", "pcB", "for scene 2");
  check("Sam's ask lands in the owner's requests", N.list().requests.length === 1 && N.list().requests[0].note === "for scene 2");
  const gr = N.grant("Sam", "window", new Date(Date.now() - 60000).toISOString(), new Date(Date.now() + 3600000).toISOString());
  check("Allow from - to: the grant is kept, the request is gone, it allows now", gr.ok && N.list().requests.length === 0 && N.grantOf("Sam").level === "window" && N.list().grants[0].now === true, N.list());
  N.grant("Sam", "unrestricted");
  check("Allow unrestricted replaces it", N.grantOf("sam").level === "unrestricted");
  N.revoke("Sam");
  check("↺ Revoke: no access", N.grantOf("Sam") === null);
  N.grant("Sam", "unrestricted");
  const pinF = path.join(pcs.A.base, "team", "pinned.json"), pinKeep = fs.readFileSync(pinF, "utf8");
  fs.writeFileSync(pinF, JSON.stringify(Object.assign(JSON.parse(pinKeep), { team: "t-another" })));
  check("access given in one team never carries over to another team (a new team with another 'Sam')", N.grantOf("Sam") === null && N.list().grants.length === 0);
  fs.writeFileSync(pinF, pinKeep);
  check("... and is back in its own team", N.grantOf("Sam").level === "unrestricted");
  N.clear();
  check("clear (this PC leaves the team): nobody keeps access", N.grantOf("Sam") === null && N.list().requests.length === 0);
  N.addRequest("Eve", "pcC"); N.deny("Eve");
  check("Deny: the request is gone, no access", N.list().requests.length === 0 && N.grantOf("Eve") === null);

  // ---------------------------------------------------------------- the job between PCs (farm)
  const rootsA = { P: "/nas/team/projects", B: "/opt/bitgen" }, rootsB = { P: "Z:\\team\\projects", B: "C:\\bitGen" };
  const params = { mode: "video", init_image: "/nas/team/projects/Film/assets/a.png", lora: "/opt/bitgen/models/loras/x.safetensors", prompt: "a /cat walks", refs: ["/nas/team/projects/Film/assets/b.png"], n: 3 };
  const tok = F.tokenize(params, rootsA);
  check("tokenize: paths under the projects folder / the app become @@P@@/… / @@B@@/… (each PC has the NAS at its own path); words, numbers untouched",
    tok.init_image === "@@P@@/Film/assets/a.png" && tok.lora === "@@B@@/models/loras/x.safetensors" && tok.refs[0] === "@@P@@/Film/assets/b.png" && tok.prompt === "a /cat walks" && tok.n === 3, tok);
  const ex = F.expand(tok, { P: "/mnt/z/team/projects", B: "/home/sam/bitgen" });
  check("expand: on the renderer they become its own paths", ex.init_image === path.join("/mnt/z/team/projects", "Film", "assets", "a.png") && ex.lora === path.join("/home/sam/bitgen", "models", "loras", "x.safetensors"), ex);
  check("tokenize copes with a Windows path and the folder itself", F.tokenize("Z:\\team\\projects\\Film\\a.png", rootsB) === "@@P@@/Film/a.png" && F.tokenize("/nas/team/projects", rootsA) === "@@P@@");
  check("outsideRoots: a renderer refuses a job that reads a file elsewhere on its disk (/etc/passwd, C:\\Users\\x)", F.outsideRoots({ a: "/etc/passwd", b: ["C:\\Users\\x\\k.png"], c: "/opt/bitgen/models/x", d: "a prompt" }, rootsA).join() === "/etc/passwd,C:\\Users\\x\\k.png");
  check("outsideRoots: a path trying to climb out is caught after expand", F.outsideRoots(F.expand({ a: "@@P@@/../../etc/passwd" }, { P: "/nas/p", B: "/opt/b" }), { P: "/nas/p", B: "/opt/b" }).length === 1);
  check("what is sent: renders (image, video, music, ltx, wan, graph, swap) - never an install, a download, training, the export or the quick ffmpeg jobs",
    ["image", "video", "music", "ltx", "wan", "graph", "swap"].every(F.isFarmMode) && !["install_comfy", "download", "export", "lora_train", "ft_x", "karaoke", "stems", "", null].some(F.isFarmMode));
  check("⚡ Spread: the least busy; this PC wins a tie", F.pick(2, [{ id: "b", load: 1 }, { id: "c", load: 0 }]) === "c" && F.pick(0, [{ id: "b", load: 0 }]) === "local" && F.pick(1, []) === "local");
  check("allowedNow mirrors the owner's rule", F.allowedNow({ level: "unrestricted" }) && !F.allowedNow({ level: "window", from: 0, to: 1 }) && !F.allowedNow(null));

  // ---------------------------------------------------------------- the screens' words
  const n0 = new Date(2026, 9, 23, 11, 0).getTime();
  const aw = { level: "window", from: new Date(2026, 9, 23, 10, 0).toISOString(), to: new Date(2026, 9, 23, 12, 30).toISOString() };
  check("static/team.js accessWords: ✓ unrestricted / ✓ inside its time / ⏳ before / ⌛ after / no access",
    W.accessWords({ level: "unrestricted" }) === "✓ unrestricted" && /^✓ .*10:00–12:30$/.test(W.accessWords(aw, n0)) && /^⏳/.test(W.accessWords(aw, n0 - 3 * 3600000)) && /^⌛/.test(W.accessWords(aw, n0 + 3 * 3600000)) && W.accessWords(null) === "no access", W.accessWords(aw, n0));
  check("static/team.js pctOf: done 100, the step %, chunks, unknown null", W.pctOf({ status: "done" }) === 100 && W.pctOf({ pct: 42 }) === 42 && W.pctOf({ chunk: { i: 3, n: 5 } }) === 40 && W.pctOf({}) === null);
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
