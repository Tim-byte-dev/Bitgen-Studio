#!/usr/bin/env node
/* bitGen Studio — 2.716.0: THE COMMUNITY'S LANGUAGE PACKS, the app's side (lib/community.js packs, lib/langPacks.js
 * shareZip, routes/langPacks.js /api/langpacks/community*, static/langpacks.js "Shared by the community" / ⇪ Share) -
 * with a fake community server (no network). The real server's side: test-community716-server.js.
 * Tim (verbatim): "if we could have a master pack so users can translate the strings and upload to tigerart for the
 * community it would be ideal" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const LP = require("../lib/langPacks"), CM = require("../lib/community"), U = require("../lib/unzip"), Z = require("../lib/zipWrite");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lp716-"));
fs.mkdirSync(path.join(tmp, "packs"));
LP.setBase(ROOT, path.join(tmp, "packs"));
CM.setBase(tmp);
const MASTER = LP.masterZip();
function pack(meta, words) {
  const ents = U.entries(MASTER).map((e) => ({ name: e.name, data: U.read(MASTER, e) }));
  const pj = ents.find((e) => e.name === "pack.json"), ui = ents.find((e) => e.name === "ui.json");
  pj.data = JSON.stringify(Object.assign(JSON.parse(pj.data), meta));
  const u = JSON.parse(ui.data); Object.assign(u.strings, words || {}); ui.data = JSON.stringify(u);
  return Z.zip(ents.map((e) => ({ name: e.name, data: e.data, deflate: true })));
}
// the fake community server: records each call; answers from SAY
const CALLS = [];
let SAY = {};
CM.setFetch(async (url, o) => {
  const a = new URL(url).searchParams.get("a"), body = JSON.parse(o.body);
  CALLS.push({ a, body, auth: o.headers.Authorization || "" });
  const r = typeof SAY[a] === "function" ? SAY[a](body, o) : SAY[a] || { ok: false, error: "no " + a };
  return { ok: (r.status || 200) < 400, status: r.status || 200, json: async () => r };
});
const R = {}; require("../routes/langPacks").mount({ get: (u, ...f) => { R["GET " + u] = f[f.length - 1]; }, post: (u, ...f) => { R["POST " + u] = f[f.length - 1]; } });
const call = (k, req) => new Promise((done) => { const res = { code: 200, status(c) { this.code = c; return this; }, set() { return this; }, type() { return this; }, json(j) { done({ code: this.code, j }); }, send(b) { done({ code: this.code, b }); } }; Promise.resolve(R[k](Object.assign({ params: {}, query: {}, body: {} }, req), res)).catch((e) => done({ code: 599, j: { error: e.message } })); });

(async () => {
  try {
    const ko = pack({ id: "ko", name: "Korean", native: "한국어", version: "3", authors: ["Ann"] }, { Themes: "테마" });
    // ---- browsing, signed out
    SAY = { pack_list: { ok: true, packs: [{ id: 7, code: "ko", native: "한국어", name: "Korean", version: "3", by: { handle: "ann", name: "Ann" }, counts: { ui: 1 } }, { id: 8, code: "ja", native: "日本語", name: "Japanese", version: "1", by: { handle: "kei" }, counts: {} }], max_bytes: 5242880 } };
    let r = await call("GET /api/langpacks/community", {});
    check("GET /api/langpacks/community signed out: the list without a token, each marked with what is installed here (ja: built in)", r.j.ok && r.j.packs.length === 2 && r.j.packs[0].installed === null && r.j.packs[1].installed.source === "built-in" && r.j.signedIn === false && CALLS[0].a === "pack_list" && !CALLS[0].auth && !("token" in CALLS[0].body), r.j);
    SAY = { pack_list: { ok: false, status: 0, error: "cannot reach the community server (ECONNREFUSED)" } };
    r = await call("GET /api/langpacks/community", {});
    check("…the community cannot be reached: {ok: false, error}, no crash", r.code === 200 && r.j.ok === false && /cannot reach/.test(r.j.error), r.j);
    // ---- install from the community
    SAY = { pack_get: (b) => (b.id === 7 ? { ok: true, id: 7, code: "ko", version: "3", zip: ko.toString("base64") } : { ok: false, status: 404, error: "That language pack is not there (any more)." }) };
    r = await call("POST /api/langpacks/community/install", { body: { id: 7 } });
    check("POST /community/install: pack_get, then installed here (checked and cleaned like a file)", r.code === 200 && r.j.pack.id === "ko" && r.j.pack.version === "3" && LP.get("ko").source === "installed", r.j);
    r = await call("POST /api/langpacks/community/install", { body: { id: 7 } });
    check("…again: 409 exists (the page asks before replacing); with replace: true it is", r.code === 409 && r.j.exists === true && (await call("POST /api/langpacks/community/install", { body: { id: 7, replace: true } })).code === 200);
    r = await call("POST /api/langpacks/community/install", { body: { id: 9 } });
    check("…a pack that is gone: the server's 404 and words", r.code === 404 && /not there/.test(r.j.error), r);
    // ---- share
    CALLS.length = 0;
    r = await call("POST /api/langpacks/:id/share", { params: { id: "ko" }, body: { note: "Korean" } });
    check("POST /:id/share signed out: 401 'sign in to 💬 Community first' - nothing sent", r.code === 401 && /sign in to 💬 Community first/.test(r.j.error) && CALLS.length === 0, r);
    fs.writeFileSync(path.join(tmp, "community.json"), JSON.stringify({ url: "https://example.test/api.php", handle: "tim", display: "Tim", token: "TOK" }));
    SAY = { pack_upload: (b) => ({ ok: true, id: 11, pending: true, code: "ko", native: "한국어", version: "3", counts: { ui: 1 }, gotNote: b.note }) };
    r = await call("POST /api/langpacks/:id/share", { params: { id: "ko" }, body: { note: "  Korean - the main window  " } });
    const up = CALLS.find((c) => c.a === "pack_upload");
    const sent = up ? U.entries(Buffer.from(up.body.zip, "base64")).map((e) => e.name).sort() : [];
    check("…signed in: pack_upload as the member (its token), the note trimmed, the app's coverage of it, the pack's own files", r.code === 200 && r.j.pending === true && r.j.id === 11 && up.auth === "Bearer TOK" && up.body.note === "Korean - the main window" && up.body.coverage.ui.done === 1 && up.body.coverage.ui.total > 8000 && sent.includes("pack.json") && sent.includes("ui.json") && !sent.includes("TRANSLATING.txt"), { r: r.j, sent });
    const sz = LP.shareZip("ko"), pj = JSON.parse(U.read(sz, U.entries(sz).find((e) => e.name === "pack.json")));
    check("shareZip(an installed pack): its files as installed (pack.json cleaned at install - id ko, v3); shareZip(built in) = the export", pj.id === "ko" && pj.version === "3" && U.entries(LP.shareZip("ja")).some((e) => e.name === "TRANSLATING.txt"));
    // the token expired: list falls back to signed out; upload says so
    CALLS.length = 0;
    SAY = { pack_list: (b) => (b.token ? { ok: false, status: 401, error: "Sign in again." } : { ok: true, packs: [] }) };
    r = await call("GET /api/langpacks/community", {});
    check("an expired token: the list is asked again signed out (and the token dropped)", r.j.ok === true && r.j.signedIn === false && CALLS.length === 2 && !("token" in CALLS[1].body) && !JSON.parse(fs.readFileSync(path.join(tmp, "community.json"))).token, CALLS.map((c) => c.a));
    let e = ""; try { await CM.packs("delete_account", {}); } catch (x) { e = x.message; }
    check("lib/community.js packs(): only the four pack actions", /not a language pack action/.test(e) && CM.PACK_ACTIONS.join() === "pack_list,pack_get,pack_upload,pack_delete");
    // ---- the page and the server
    const J = rd("static/langpacks.js");
    check("Settings ▸ Languages: Shared by the community (↻, ⤓ Install, Installed), ⇪ Share with a note, Your shared packs (status, ✕), admins pointed to the website",
      /Shared by the community/.test(J) && /data-cminstall/.test(J) && /"Installed"/.test(J) && /data-lpshare/.test(J) && /s_lpnote/.test(J) && /Your shared packs/.test(J) && /data-cmdelete/.test(J) && /tigerart\.com\.au ▸ Language packs/.test(J));
    check("…a shared pack's names, note and review note go in as text", /nm\.textContent = p\.native/.test(J) && /n\.textContent = "“" \+ p\.note \+ "”"/.test(J) && /why\.textContent = ": " \+ p\.review_note/.test(J));
    check("community server: act_packs.php loaded, the five actions, schema 4 (bgc_packs), pack_upload's body up to 7 MB, info says packs: true",
      /act_packs\.php/.test(rd("community/lib/boot.php")) && ["pack_list", "pack_get", "pack_upload", "pack_delete", "admin_pack_moderate"].every((a) => rd("community/lib/dispatch.php").includes("'" + a + "'")) && /BGC_SCHEMA = '4'/.test(rd("community/lib/db.php")) && /'bgc_packs'/.test(rd("community/lib/db.php")) && /'pack_upload'\], true\) \? BGC_MAX_BUG_BODY/.test(rd("community/api.php")) && /'packs' => true/.test(rd("community/lib/act_account.php")));
  } catch (x) { fail++; console.log("FAIL: " + x.stack); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
