#!/usr/bin/env node
/* bitGen Studio — 2.897.0 units: 💳 the business details in MariaDB (lib/businessDb.js) without a database here - where they are
 * kept by default (this computer's file), what the status says, a file-mode save never reaches for a database, the database not
 * answering keeps the change waiting (never lost, never an error to the caller), no MariaDB / no server set up said plainly, odd names
 * refused, the tables' shape (2.875.0's FIELDS + card_size, services / colours as rows, the logo in its row); the routes (sync before a
 * list, the save / delete sent, /api/business/store) and the dialog's 🗄 Where they are kept…. The real database: test-897-live.js. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const BP = require("../lib/businessProfiles"), BD = require("../lib/businessDb");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t897-")); BP.setRoot(tmp);
  let calls = 0;
  const fake = (o) => Object.assign({ find: () => ({ bin: "mariadbd" }), externalCfg: () => ({ host: "db.example.com", port: 3306, user: "tim" }), createDb: async () => { calls++; throw new Error("connect ECONNREFUSED"); }, conn: async () => { throw new Error("no"); } }, o || {});
  BD.setDb(fake());
  try {
    let st = BD.status();
    check("by default the details are kept on this computer (business/profiles.json), bitgen_business named for later", st.mode === "file" && st.db === "bitgen_business" && st.scope === "global" && /on this computer \(business\/profiles\.json\)/.test(st.where) && st.waiting === 0, st);
    const p = BP.save({ company: "Rosie's Bakery", name: "Rosie" });
    const r = await BD.changed("save", p.id);
    check("a save in file mode never reaches for a database", r.file === true && calls === 0 && BD.status().waiting === 0);
    fs.writeFileSync(path.join(tmp, "store.json"), JSON.stringify({ mode: "db", scope: "external", db: "team_details" }));
    st = BD.status();
    check("in a database: where says which (your server)", st.mode === "db" && st.scope === "external" && /in team_details on your server/.test(st.where), st);
    const off = await BD.changed("save", p.id);
    check("the database not answering: the change waits (1), the reason kept - never thrown to the caller, the details still here", !off.ok && /ECONNREFUSED/.test(off.offline) && off.waiting === 1 && BD.status().waiting === 1 && /ECONNREFUSED/.test(BD.status().lastError) && BP.get(p.id).company === "Rosie's Bakery", off);
    BP.remove(p.id); await BD.changed("remove", p.id);
    const s2 = BD.store();
    check("...deleted while waiting: the waiting save becomes a waiting delete", s2.pending.save.length === 0 && s2.pending.remove.join() === p.id, s2.pending);
    let e1 = ""; try { await BD.move({ mode: "file" }); } catch (e) { e1 = e.message; }
    check("...back to a file is refused while changes still wait for the database (they would be lost there)", /still waiting/.test(e1), e1);
    BD.setDb(fake({ find: () => null }));
    let e2 = ""; try { await BD.move({ scope: "global" }); } catch (e) { e2 = e.message; }
    check("no MariaDB on this computer: said, with where to get it (🗄 Database on the top bar)", /MariaDB is not on this computer yet - ⬇ download it in 🗄 Database/.test(e2), e2);
    BD.setDb(fake({ externalCfg: () => ({}) }));
    let e3 = ""; try { await BD.move({ scope: "external" }); } catch (e) { e3 = e.message; }
    check("your server not set up: said", /set up your database server first/.test(e3), e3);
    let e4 = ""; try { await BD.move({ scope: "global", db: "x; DROP DATABASE y" }); } catch (e) { e4 = e.message; }
    check("an odd database name refused before anything runs", /letters, digits/.test(e4), e4);
    const T = BD.SCHEMA.join("\n");
    check("the tables: business_profiles with 2.875.0's FIELDS + card_size as columns, the logo in its row (LONGBLOB), who changed it; services + colours as rows (deleted with their profile); meta",
      BP.FIELDS.every(([k]) => new RegExp("\\b" + k + " (VARCHAR|TEXT)").test(T)) && /card_size VARCHAR\(24\)/.test(T) && /logo LONGBLOB/.test(T) && /updated_by/.test(T)
      && /business_services \(profile_id .*ON DELETE CASCADE/.test(T) && /business_colours \(profile_id .*ON DELETE CASCADE/.test(T) && /business_meta/.test(T) && BD.COLS.join() === "company,name,role,address,phone,email,website,front,back,abn,card_size");
    const lib = src("lib/businessDb.js");
    const qs = [...lib.matchAll(/c\.query\((`[^`]*`|"[^"]*")/g)].map((m) => m[1]), holes = qs.flatMap((q) => [...q.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]));
    check("every value goes in as a parameter (the only ${…} in SQL are the fixed column names)", qs.length >= 10 && holes.every((h) => /^COLS\./.test(h) || /^k\}?/.test(h)) && /VALUES \(\?, \$\{COLS\.map\(\(\) => "\?"\)/.test(lib), holes);
    check("lib/businessProfiles: raw / logoBuffer / adopt / hasLogo for the database (this file = this computer's copy)", ["raw", "logoBuffer", "adopt", "hasLogo"].every((k) => typeof BP[k] === "function"));
    const n = BP.adopt([{ id: "abc1", company: "From the DB", services: ["One"], colours: ["#123456"], logo: "", updated: "2026-11-20T00:00:00Z" }], {});
    check("...adopt: the database's rows become this computer's list (last kept / moved)", n === 1 && BP.list().profiles[0].company === "From the DB" && BP.list().last === "abc1");
    const rt = src("routes/businessProfiles.js");
    check("routes: a list syncs first, a save / delete is sent (changed), GET / POST /api/business/store, POST /api/business/store/sync - mounted from routes/index.js (not server.js)",
      /S\(\)\.sync\(\); return withStore\(B\(\)\.list\(\)/.test(rt) && /S\(\)\.changed\("save", p\.id\)/.test(rt) && /S\(\)\.changed\("remove"/.test(rt) && /app\.get\("\/api\/business\/store"/.test(rt) && /app\.post\("\/api\/business\/store\/sync"/.test(rt)
      && /require\("\.\/businessProfiles"\)\.mount\(app\)/.test(src("routes/index.js")) && !/businessDb/.test(src("misc/server.js")));
    const ui = src("ext/imageeditdock/pcbizinfo.js");
    check("the dialog: 🗄 Where they are kept… (this computer / bitGen's own database / your server), ✔ Keep them there, ⟳ Sync, the line says where + offline",
      /🗄 Where they are kept…/.test(ui) && /value="global"/.test(ui) && /value="external"/.test(ui) && /✔ Keep them there/.test(ui) && /\/api\/business\/store/.test(ui) && /⟳ Sync/.test(ui) && /the database did not answer/.test(ui));
  } catch (e) { check("ran: " + e.message, false); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
