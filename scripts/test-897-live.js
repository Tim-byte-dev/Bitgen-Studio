#!/usr/bin/env node
/* bitGen Studio — 2.897.0 LIVE: 💳 the business details in MariaDB (lib/businessDb.js) against a REAL MariaDB - two computers sharing
 * one database: A moves its details there (tables made, services / colours / the logo in their rows), B moves there and gets A's
 * (the logo's bytes too), B changes one - A sees it on its next sync (who changed it), A deletes one - B loses it (and its logo); the
 * database not answering: the change kept on this computer and waiting, sent when it answers; a waiting change older than the
 * database's copy loses to it (said); back to a file keeps the details here. Needs MariaDB (with its install script) - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  if (!f || !f.installDb || !/mariadbd/.test(f.bin)) { console.log("SKIP: no MariaDB here"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); return; }
  const BP = require(path.join(ROOT, "lib/businessProfiles.js")), BD = require(path.join(ROOT, "lib/businessDb.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t897l-")), A = path.join(tmp, "pcA", "business"), B = path.join(tmp, "pcB", "business");
  D.setBase(tmp, path.join(tmp, "projdb")); BD.setDb(D);
  const png = "data:image/png;base64," + Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360f80f0000010101005b5cba5e0000000049454e44ae426082", "hex").toString("base64");
  const on = (dir) => BP.setRoot(dir);
  try {
    on(A);
    const p1 = BP.save({ company: "Rosie's Bakery", name: "Rosie Smith", role: "Owner", phone: "0412 345 678", email: "rosie@example.com", services: ["Sourdough", "Cakes"], colours: ["#aa3300", "#ffffff"], card_size: "au", abn: "51 824 753 556", front: "warm\ncream" }, { logoDataUrl: png });
    const p2 = BP.save({ company: "Tiger Art", name: "Tim Paul", email: "tim@example.com" });
    check("file mode: nothing goes to a database (sync = the file)", (await BD.sync()).file === true && BD.status().mode === "file" && BD.status().count === 2);
    const mv = await BD.move({ scope: "global", db: "bitgen_business" });
    check("🗄 A moves its details to bitGen's own MariaDB: the database + 4 tables made, both sent", mv.moved === "db" && mv.sent === 2 && mv.had === 0 && mv.mode === "db" && /bitgen_business on bitGen's own database/.test(mv.where), mv);
    const q = async (sql) => (await D.run("global", "bitgen_business", sql)).results[0].rows;
    const tabs = (await q("SHOW TABLES")).map((r) => Object.values(r)[0]).sort();
    check("...the tables business_colours, business_meta, business_profiles, business_services (schema 1)", tabs.join() === "business_colours,business_meta,business_profiles,business_services" && (await q("SELECT v FROM business_meta WHERE k = 'schema'"))[0].v === "1", tabs);
    const row = (await q(`SELECT company, abn, card_size, front, logo_name, logo_type, LENGTH(logo) AS n, updated_by FROM business_profiles WHERE id = '${p1.id}'`))[0];
    check("...a profile's row: the fields (ABN, card size, a two-line front), the logo itself (PNG bytes), who saved it", row.company === "Rosie's Bakery" && row.abn === "51 824 753 556" && row.card_size === "au" && row.front === "warm\ncream" && row.logo_type === "image/png" && +row.n > 60 && row.logo_name === p1.id + ".png" && row.updated_by === os.hostname().slice(0, 64), row);
    const sv = (await q(`SELECT service FROM business_services WHERE profile_id = '${p1.id}' ORDER BY pos`)).map((r) => r.service), co = (await q(`SELECT colour FROM business_colours WHERE profile_id = '${p1.id}' ORDER BY pos`)).map((r) => r.colour);
    check("...its services and colours as rows, in order", sv.join() === "Sourdough,Cakes" && co.join() === "#aa3300,#ffffff", { sv, co });
    // B: a second computer on the same database
    on(B);
    const mvB = await BD.move({ scope: "global", db: "bitgen_business" });
    const bl = BP.list().profiles, bRosie = bl.find((p) => p.id === p1.id);
    check("💻 computer B moves there too: nothing to send, A's 2 kept, both now on B - with the logo's bytes", mvB.sent === 0 && mvB.had === 2 && bl.length === 2 && bRosie && bRosie.services.join() === "Sourdough,Cakes" && fs.existsSync(BP.logoPath(p1.id)) && fs.readFileSync(BP.logoPath(p1.id)).length > 60, { mvB, bl: bl.map((p) => p.company) });
    await new Promise((r) => setTimeout(r, 15));
    BP.save(Object.assign({}, bRosie, { phone: "0499 000 111", services: ["Sourdough", "Cakes", "Coffee"] }));
    const chB = await BD.changed("save", p1.id);
    check("...B changes Rosie's phone + adds a service: in the database at once", chB.ok && (await q(`SELECT phone FROM business_profiles WHERE id = '${p1.id}'`))[0].phone === "0499 000 111" && (await q(`SELECT COUNT(*) AS n FROM business_services WHERE profile_id = '${p1.id}'`))[0].n == 3, chB);
    on(A);
    const sa = await BD.sync(), aR = BP.get(p1.id);
    check("💻 A's next sync has B's change (this computer's copy - what invoices and cards read)", sa.ok && aR.phone === "0499 000 111" && aR.services.length === 3 && BP.list().profiles.length === 2, { sa, aR });
    BP.remove(p2.id); await BD.changed("remove", p2.id);
    on(B); await BD.sync();
    check("...A deletes Tiger Art: gone from the database and from B's copy on its sync", (await q("SELECT COUNT(*) AS n FROM business_profiles"))[0].n == 1 && BP.list().profiles.length === 1 && !BP.get(p2.id));
    // the database not answering
    on(A);
    BD.setDb(Object.assign({}, D, { createDb: async () => { throw new Error("connect ECONNREFUSED (the server is down)"); } }));
    await new Promise((r) => setTimeout(r, 15));
    BP.save(Object.assign({}, BP.get(p1.id), { role: "Owner + head baker" }));
    const off = await BD.changed("save", p1.id), st = BD.status();
    check("⚠ the database does not answer: the change is kept on this computer, 1 waiting, why said", !off.ok && /ECONNREFUSED/.test(off.offline) && off.waiting === 1 && st.waiting === 1 && /ECONNREFUSED/.test(st.lastError) && BP.get(p1.id).role === "Owner + head baker", { off, st });
    BD.setDb(D);
    const back = await BD.sync();
    check("...when it answers the waiting change goes there (and nothing waits)", back.ok && BD.status().waiting === 0 && BD.status().lastError === "" && (await q(`SELECT role FROM business_profiles WHERE id = '${p1.id}'`))[0].role === "Owner + head baker", back);
    // a waiting change older than the database's copy: the database's wins
    on(B); await BD.sync(); await new Promise((r) => setTimeout(r, 15));
    on(A); BD.setDb(Object.assign({}, D, { createDb: async () => { throw new Error("offline"); } }));
    BP.save(Object.assign({}, BP.get(p1.id), { email: "old@example.com" })); await BD.changed("save", p1.id);
    BD.setDb(D); await new Promise((r) => setTimeout(r, 15));
    on(B); BP.save(Object.assign({}, BP.get(p1.id), { email: "new@example.com" })); await BD.changed("save", p1.id);
    on(A); const cf = await BD.sync();
    check("...A's waiting change is older than B's in the database: B's kept (said), A's copy now B's", cf.ok && cf.notes.length === 1 && /changed on .* since - that copy kept/.test(cf.notes[0]) && BP.get(p1.id).email === "new@example.com", cf);
    // back to a file
    const fileBack = await BD.move({ mode: "file" });
    check("📁 A back on this computer only: the details kept here, the database left as it is", fileBack.moved === "file" && BD.status().mode === "file" && BP.list().profiles.length === 1 && (await q("SELECT COUNT(*) AS n FROM business_profiles"))[0].n == 1, fileBack);
    let refused = false; try { await BD.move({ scope: "global", db: "bad name;" }); } catch (e) { refused = /letters, digits/.test(e.message); }
    check("a database name with odd characters is refused", refused);
  } catch (e) { check("ran: " + e.message, false); console.log(e.stack); }
  finally { try { await D.stop("global"); } catch (e) { /* stopped */ } fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
