#!/usr/bin/env node
/* bitGen Studio — 2.820.0 against the RUNNING app (+ a real browser): ✉ Mail finished - the account is KEPT after ✓ Test /
 * on Close (it disappeared), several emails picked (Ctrl / Shift-click, Ctrl+A) and changed at once, 📁 Move ▾ + drag onto
 * a folder, 🔍 Enter = the whole folder on the server, ⤓ Older emails, ＋ a new folder, address suggestions in To.
 * A stand-in mail server on 127.0.0.1 (hoodiecrow-imap). Tim (verbatim): "finish the mail client, it logs in successfully
 * but the account dissapears when i close the dialog, it looks like it is just the start". No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const CRLF = (s) => s.replace(/\r?\n/g, "\r\n");
const mail = (i, from, subj, body) => CRLF(`From: ${from}\nTo: Tim <tim@example.com>\nSubject: ${subj}\nDate: ${new Date(Date.UTC(2026, 9, 1) + i * 3600e3).toUTCString()}\nMessage-ID: <m${i}-820@x.example>\nMIME-Version: 1.0\nContent-Type: text/plain; charset=utf-8\n\n${body}\n`);
const api = async (m, u, b) => { const r = await fetch(new URL(u, URL_), { method: m, headers: b ? { "Content-Type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined }); return r.json(); };

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  let hood = null; try { hood = require("hoodiecrow-imap"); } catch (e) { console.log("SKIP: hoodiecrow-imap is not installed (npm ci installs it - a devDependency)"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const { startSMTPServer } = require("hoodiecrow-imap/lib/hoodiecrowSMTPServer");
  // 205 emails in the inbox: 200 listed, ⤓ Older for the rest; the newest three from people to suggest
  const msgs = [];
  for (let i = 0; i < 202; i++) msgs.push({ raw: mail(i, `News ${i} <news${i}@list.example>`, `Newsletter ${i}`, "weekly news") });
  msgs.push({ raw: mail(300, "Bea Accountant <bea@books.example>", "Your BAS is due Friday", "the October receipts please") });
  msgs.push({ raw: mail(301, "Ben Builder <ben@build.example>", "Deck quote", "the quote for the deck") });
  msgs.push({ raw: mail(302, "Cara Client <cara@client.example>", "Logo approved", "looks great") });
  const imap = hood({ plugins: ["ID", "SPECIAL-USE", "UIDPLUS", "MOVE", "ENABLE", "LIST-STATUS"], storage: {
    INBOX: { messages: msgs },
    "": { separator: "/", folders: { Archive: { "special-use": "\\Archive" }, Sent: { "special-use": "\\Sent" }, Drafts: { "special-use": "\\Drafts" }, Trash: { "special-use": "\\Trash" } } } } });
  await new Promise((r) => imap.listen(0, "127.0.0.1", r));
  const IPORT = (imap.server || imap).address().port;
  const smtp = startSMTPServer(0, imap); await new Promise((r) => setTimeout(r, 300));
  const SPORT = smtp.server.address().port;
  for (const a of (await api("GET", "/api/mail/accounts")).accounts || []) if (a.email === "tim@example.com") await api("DELETE", "/api/mail/accounts/" + a.id);
  const accounts0 = ((await api("GET", "/api/mail/accounts")).accounts || []).length;

  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const until = (f, x, t) => p.waitForFunction(f, x, { timeout: t || 20000 });
  const click = (sel) => p.$eval(sel, (e) => e.click());
  const rows = () => ev(() => [...document.querySelectorAll("#mlList .mlrow")].map((r) => ({ uid: +r.dataset.uid, sub: r.querySelector(".sub").textContent, unread: r.classList.contains("unread"), pick: r.classList.contains("pick") })));
  const rowClick = (i, mods) => ev(([i, m]) => { const r = document.querySelectorAll("#mlList .mlrow")[i]; r.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: !!m.ctrl, shiftKey: !!m.shift })); }, [i, mods || {}]);
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.g.maildock"); localStorage.removeItem("h3.mail.acc"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await until(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("tX_maildock"), null, 60000);
    await p.waitForTimeout(800);
    await click("#tX_maildock"); await p.waitForTimeout(500);
    if (!accounts0) await click("#mlAddFirst"); else await ev(() => window.H3MailAccounts.open(null));
    await p.waitForTimeout(300);
    await p.fill("#mlAEmail", "tim@example.com"); await p.fill("#mlAUser", "testuser"); await p.fill("#mlAPass", "testpass");
    await p.fill("#mlAImapHost", "127.0.0.1"); await p.uncheck("#mlAImapSsl"); await p.fill("#mlAImapPort", String(IPORT));
    await p.fill("#mlASmtpHost", "127.0.0.1"); await p.uncheck("#mlASmtpSsl"); await p.fill("#mlASmtpPort", String(SPORT)); await p.uncheck("#mlATls");

    /* 1 Tim's bug: ✓ Test logged in, Close - and the account was gone. A Test that logs in now keeps it */
    await p.click("#mlATest"); await until(() => /kept/.test(document.getElementById("mlAMsg").textContent), null, 30000);
    let acc = ((await api("GET", "/api/mail/accounts")).accounts || []).find((a) => a.email === "tim@example.com");
    check("✓ Test that logs in KEEPS the account (it was lost when the dialog closed)", !!acc && acc.has_pass, acc);
    if (await ev(() => document.getElementById("mlAcctDlg").open)) await p.click("#mlAClose");
    await ev((id) => { const s = document.getElementById("mlAccSel"); if (s.value !== id) { s.value = id; s.dispatchEvent(new Event("change")); } }, acc.id);
    await until(() => document.querySelectorAll("#mlList .mlrow").length >= 200, null, 60000);
    check("…and the inbox comes in", (await rows()).length === 200, (await rows()).length);

    /* 2 Close keeps the changes */
    await ev(() => window.H3MailAccounts.open(window.H3Mail.S.acc)); await p.waitForTimeout(300);
    await p.fill("#mlAName", "Tim Paul"); await p.click("#mlAClose");
    await until(() => !document.getElementById("mlAcctDlg").open, null, 15000);
    acc = ((await api("GET", "/api/mail/accounts")).accounts || []).find((a) => a.email === "tim@example.com");
    check("Close with a change typed keeps it (the name is Tim Paul) and closes the dialog", acc && acc.name === "Tim Paul", acc);

    /* 3 ⤓ Older emails */
    const older = await ev(() => { const b = document.getElementById("mlOlder"); return b ? b.textContent : null; });
    check("200 listed of 205: ⤓ Older emails (5 more) at the end", /Older emails \(5 more\)/.test(older || ""), older);
    await click("#mlOlder"); await until(() => document.querySelectorAll("#mlList .mlrow").length === 205, null, 30000);
    check("…pressed: all 205, no ⤓ any more", (await ev(() => !document.getElementById("mlOlder"))));

    /* 4 several picked: Ctrl-click, Shift-click, ● read on all of them */
    await rowClick(0); await p.waitForTimeout(300);
    await rowClick(1, { ctrl: true }); await rowClick(2, { ctrl: true });
    let R = await rows();
    check("Ctrl-click picks several (the one open + 2 more)", R.filter((r) => r.pick).length === 3 && /3 picked/.test(await ev(() => document.getElementById("mlCount").textContent)), R.slice(0, 4));
    await rowClick(0); await p.waitForTimeout(300); await rowClick(4, { shift: true }); R = await rows();
    check("a click, then Shift-click: every email between (5)", R.filter((r) => r.pick).length === 5, R.slice(0, 6));
    const five = R.filter((r) => r.pick).map((r) => r.uid);
    await click("#mlUnread"); await p.waitForTimeout(1500);
    const kept = await api("GET", `/api/mail/${acc.id}/list?folder=INBOX`);
    const fl = five.map((u) => (kept.msgs.find((m) => m.uid === u) || {}).seen);
    check("● on 5 picked: all of them the same way at once (on the server's copy too)", fl.length === 5 && fl.every((x) => x === fl[0]), fl);

    /* 5 📁 Move ▾ -> Archive (the 5), then drag one onto Trash */
    await click("#mlMove"); await until(() => !!document.getElementById("mlMoveMenu"));
    const items = await ev(() => [...document.querySelectorAll("#mlMoveMenu [data-path]")].map((d) => d.dataset.path));
    check("📁 Move ▾ lists the other folders", items.includes("Archive") && items.includes("Trash") && !items.includes("INBOX"), items);
    await ev(() => document.querySelector('#mlMoveMenu [data-path="Archive"]').click());
    await until(() => document.querySelectorAll("#mlList .mlrow").length === 200, null, 30000);
    const arch = await api("POST", `/api/mail/${acc.id}/sync`, { folder: "Archive" });
    check("…the 5 moved to Archive in one go (the list 200, Archive 5)", (arch.msgs || []).length === 5, (arch.msgs || []).length);
    const dragSub = await ev(() => document.querySelector("#mlList .mlrow .sub").textContent);
    // the browser's own drag: dragstart on the row -> dragover + drop on the folder with the same DataTransfer
    await ev(() => {
      const dt = new DataTransfer(), row = document.querySelector("#mlList .mlrow"), f = document.querySelector('#mlFolders .mlf[data-path="Trash"]');
      row.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      f.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
      f.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await p.waitForTimeout(2000);
    const tr = await api("POST", `/api/mail/${acc.id}/sync`, { folder: "Trash" });
    check("an email dragged onto Trash moves there", (tr.msgs || []).some((m) => m.subject === dragSub) && (await rows()).length === 199, { dragSub, trash: (tr.msgs || []).map((m) => m.subject) });

    /* 6 🔍 Enter = the whole folder on the server */
    // (the newest five went to Archive above) - "Newsletter 7" is in Newsletter 7 and 70-79 = 11 subjects
    await p.fill("#mlSearch", 'subject:"Newsletter 7"'); await p.press("#mlSearch", "Enter");
    await until(() => !document.getElementById("mlSearchBar").hidden, null, 30000);
    R = await rows();
    const bar = await ev(() => document.getElementById("mlSearchBar").textContent);
    check("Enter in 🔍 searches the whole folder on the server (subject:\"…\"): 11 found, the bar says so", R.length === 11 && R.every((r) => /^Newsletter 7/.test(r.sub)) && /11 found on the server/.test(bar), { n: R.length, bar });
    await click("#mlSearchOff"); await until(() => document.querySelectorAll("#mlList .mlrow").length > 100, null, 30000);
    check("✕ back to the folder", (await ev(() => document.getElementById("mlSearchBar").hidden)));

    /* 7 ＋ a new folder (the server's own) */
    const nf = await api("POST", `/api/mail/${acc.id}/folders`, { name: "Receipts" });
    check("＋ a new folder on the server (Receipts) - in the folder list", (nf.folders || []).some((f) => f.path === "Receipts"), nf);
    check("the folders' ＋ button is there", await ev(() => !!document.getElementById("mlNewFolder")));

    /* 8 To suggests the people in the mail */
    await click("#mlNew"); await until(() => document.getElementById("mlCompose").open);
    await p.click("#mlCTo"); await p.keyboard.type("be", { delay: 40 });
    await until(() => document.querySelector(".mlsugg") && document.querySelectorAll(".mlsugg [data-i]").length >= 2, null, 10000);
    const sug = await ev(() => [...document.querySelectorAll(".mlsugg [data-i]")].map((d) => d.textContent));
    check("typing 'be' in To suggests Bea and Ben from the mail", sug.some((t) => /Bea Accountant/.test(t)) && sug.some((t) => /Ben Builder/.test(t)), sug);
    await p.keyboard.press("Enter");
    const to = await ev(() => document.getElementById("mlCTo").value);
    check("Enter puts it in as Name <address>, ", /^(Bea Accountant <bea@books\.example>|Ben Builder <ben@build\.example>), $/.test(to), to);
    await ev(() => { const d = document.getElementById("mlCompose"); window.H3MailCompose && window.H3MailCompose.close ? window.H3MailCompose.close(true) : d.close(); });
    await p.waitForTimeout(300);
    check("no page errors", !errs.length, errs);
    if (await ev(() => document.getElementById("mlCompose").open)) await ev(() => document.getElementById("mlCompose").close());
    if (await ev(() => !document.getElementById("maildock").classList.contains("dockgone"))) { await click("#tX_maildock"); await p.waitForTimeout(400); }
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { for (const a of (await api("GET", "/api/mail/accounts")).accounts || []) if (a.email === "tim@example.com") await api("DELETE", "/api/mail/accounts/" + a.id); } catch (e) { /* fine */ }
    await b.close(); try { imap.close(); smtp.server.close(); } catch (e) { /* fine */ }
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
