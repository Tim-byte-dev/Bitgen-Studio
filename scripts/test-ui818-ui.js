#!/usr/bin/env node
/* bitGen Studio — 2.818.0 against the RUNNING app (+ a real browser): ✉ Mail end to end, with a stand-in mail server on
 * 127.0.0.1 (hoodiecrow-imap: IMAP + its SMTP server that files what it gets into INBOX) and a stand-in LLM (an
 * OpenAI-style /v1/chat/completions set as Settings ▸ LLM's external endpoint for the test, put back after).
 * ✉ on the top bar -> the docker (no account: the welcome) -> ⚙ add the account (servers from the address, ✓ Test, Save)
 * -> folders + list -> read (seen, attachment, the safe frame) -> ✨ Flag with AI -> ⚑ Important -> ✨ Summarise ->
 * ✨ Draft reply -> ➤ Send (lands in INBOX + Sent) -> ✉ New + ✨ Write it + ✨ Rewrite + ↶ Undo -> 🗑 to Trash.
 * Tim (verbatim): "I would like a mail docker that resembles outlook but works with ai, our models should be able to read
 * the emails and flag important ones and draft a reply. it should also help us construct an email." No Playwright = SKIP. */
"use strict";
const path = require("path"), http = require("http");
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
const now = new Date(), d1 = new Date(now - 3 * 3600e3), d2 = new Date(now - 3600e3);
const M1 = CRLF(`From: Bea Accountant <bea@books.example>
To: Tim <tim@example.com>
Subject: Your BAS is due Friday
Date: ${d1.toUTCString()}
Message-ID: <bas-818@books.example>
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="XX"

--XX
Content-Type: text/plain; charset=utf-8

Hi Tim, the quarterly BAS has to be lodged by Friday. Please send me the October receipts. https://books.example/portal

--XX
Content-Type: text/csv; name="receipts.csv"
Content-Disposition: attachment; filename="receipts.csv"

date,amount
2026-10-02,45.00
--XX--
`);
const M2 = CRLF(`From: Deals Daily <promo@shop.example>
To: tim@example.com
Subject: 70% OFF - LAST CHANCE
Date: ${d2.toUTCString()}
Message-ID: <promo-818@shop.example>
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

<html><body><h1 onclick="steal()">Huge sale</h1><script>parent.document.title='pwned'</script><p>Click now.</p><img src="http://tracker.example/p.gif"></body></html>
`);
// the stand-in LLM: answers by the system prompt it is given (and keeps them for the checks)
const asked = [];
function llmServer() {
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const msgs = j.messages || [], sys = (msgs.find((m) => m.role === "system") || {}).content || "", user = msgs.filter((m) => m.role === "user").map((m) => m.content).join("\n");
      const all = sys + "\n" + user; asked.push(all);
      let text = "I can't help with that.";
      if (/sort a person's incoming email/.test(all)) {
        const parts = user.split(/=== Email (\d+) ===/), lines = [];
        for (let i = 1; i < parts.length; i += 2) lines.push(/BAS/.test(parts[i + 1]) ? `${parts[i]} | 3 | BAS lodgement due Friday` : /Re: Your BAS/.test(parts[i + 1]) ? `${parts[i]} | 1 | your own reply` : `${parts[i]} | 0 | a promotion`);
        text = lines.join("\n");
      } else if (/summarise emails/.test(all)) text = "Bea needs the October receipts to lodge the BAS by Friday.\nAction: send Bea the October receipts";
      else if (/write email replies/.test(all)) text = "Hi Bea,\n\nI will send the October receipts today.\n\nThanks,\nTim";
      else if (/You write emails for/.test(all)) text = "Subject: Lunch on Friday?\n\nHi Ann,\n\nAre you free for lunch on Friday?\n\nCheers,\nTim";
      else if (/You improve emails/.test(all)) text = "Hi Ann - lunch Friday?\n\nTim";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 10 } }));
    });
  });
}
const api = async (m, u, b) => { const r = await fetch(new URL(u, URL_), { method: m, headers: b ? { "Content-Type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined }); return r.json(); };

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  let hood = null; try { hood = require("hoodiecrow-imap"); } catch (e) { console.log("SKIP: hoodiecrow-imap is not installed (npm ci installs it - a devDependency)"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const { startSMTPServer } = require("hoodiecrow-imap/lib/hoodiecrowSMTPServer");
  const imap = hood({ plugins: ["ID", "SPECIAL-USE", "UIDPLUS", "MOVE", "ENABLE", "LIST-STATUS"], storage: {
    INBOX: { messages: [{ raw: M1 }, { raw: M2 }] },
    "": { separator: "/", folders: { Sent: { "special-use": "\\Sent" }, Drafts: { "special-use": "\\Drafts" }, Trash: { "special-use": "\\Trash" } } } } });
  await new Promise((r) => imap.listen(0, "127.0.0.1", r));
  const IPORT = (imap.server || imap).address().port;
  const smtp = startSMTPServer(0, imap); await new Promise((r) => setTimeout(r, 300));
  const SPORT = smtp.server.address().port;
  const llm = llmServer(); await new Promise((r) => llm.listen(0, "127.0.0.1", r));
  const cfg0 = await api("GET", "/api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  await api("POST", "/api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stand-in" } });
  // a clean start: no mail account left from an earlier run
  for (const a of (await api("GET", "/api/mail/accounts")).accounts || []) if (a.email === "tim@example.com") await api("DELETE", "/api/mail/accounts/" + a.id);

  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const until = (f, x, t) => p.waitForFunction(f, x, { timeout: t || 20000 });
  // the docker's own buttons are pressed as the page's click (a floating docker - the prompt docker in some layouts - can
  // sit in front of the main column; the dialogs are on top of everything and take real clicks)
  const click = (sel) => p.$eval(sel, (e) => e.click());
  // H3_SHOTS=<folder>: pictures of the docker (maximized), the composer and the accounts dialog for the Guide / website
  const SHOTS = process.env.H3_SHOTS || "";
  const shot = async (name, sel) => { if (!SHOTS) return; await p.waitForTimeout(400); const el = sel ? await p.$(sel) : null; await (el || p).screenshot({ path: path.join(SHOTS, name + ".png") }); };
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.g.maildock"); localStorage.removeItem("h3.mail.acc"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await until(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("tX_maildock") && document.getElementById("tX_maildock").closest("#appGrp1"), null, 60000);
    await p.waitForTimeout(800);
    const st = await ev(() => ({ grp: [...document.getElementById("appGrp1").children].map((c) => c.id + ":" + c.textContent), title: document.getElementById("tX_maildock").title, gone: document.getElementById("maildock").classList.contains("dockgone"), sb: !!document.querySelector("#statusbar #tX_maildock") }));
    check("✉ is on the top bar's app strip after 🖼 (group 1), icon only, not in the statusbar", st.grp.join(",") === "tIE:🖼,tX_maildock:✉" && /Mail/.test(st.title) && !st.sb, st);
    check("the docker starts hidden the first time", st.gone, st);
    await click("#tX_maildock"); await p.waitForTimeout(600);
    const e0 = await ev(() => ({ shown: !document.getElementById("maildock").classList.contains("dockgone"), noacc: document.getElementById("maildock").classList.contains("ml-noacc"), welcome: getComputedStyle(document.getElementById("mlEmpty")).display !== "none" && /no sign-up/.test(document.getElementById("mlEmpty").textContent), lit: document.getElementById("tX_maildock").classList.contains("on") }));
    check("✉ shows it (lit); no account = the welcome (no sign-up, app passwords)", e0.shown && e0.noacc && e0.welcome && e0.lit, e0);

    // ⚙ add the account
    await click("#mlAddFirst"); await p.waitForTimeout(300);
    await p.fill("#mlAEmail", "someone@gmail.com"); await p.dispatchEvent("#mlAEmail", "change");
    await until(() => document.getElementById("mlAImapHost").value === "imap.gmail.com");
    const gm = await ev(() => ({ smtp: document.getElementById("mlASmtpHost").value + ":" + document.getElementById("mlASmtpPort").value, note: document.getElementById("mlANote").textContent, sent: document.getElementById("mlASent").checked }));
    check("a Gmail address fills the servers, says an app password is needed and leaves 'copy to Sent' off", gm.smtp === "smtp.gmail.com:465" && /needs an app password/.test(gm.note) && !gm.sent, gm);
    await p.fill("#mlAEmail", "tim@example.com"); await p.fill("#mlAName", "Tim Paul"); await p.fill("#mlAUser", "testuser"); await p.fill("#mlAPass", "testpass");
    await p.fill("#mlAImapHost", "127.0.0.1"); await p.fill("#mlAImapPort", String(IPORT)); await p.uncheck("#mlAImapSsl"); await p.fill("#mlAImapPort", String(IPORT));
    await p.fill("#mlASmtpHost", "127.0.0.1"); await p.uncheck("#mlASmtpSsl"); await p.fill("#mlASmtpPort", String(SPORT));
    await p.uncheck("#mlATls"); await p.check("#mlASent"); await p.fill("#mlASig", "Tim Paul\nbitGen Studio");
    await shot("mail-account", "#mlAcctDlg");
    // 2.820.0: a Test that logs in KEEPS the account - the first one closes the dialog and the inbox comes in
    await p.click("#mlATest"); await until(() => /kept/.test(document.getElementById("mlAMsg").textContent), null, 30000);
    const tst = await ev(() => document.getElementById("mlAMsg").textContent);
    check("✓ Test logs in to both servers and keeps the account", /Incoming ✓/.test(tst) && /Outgoing ✓/.test(tst) && /kept/.test(tst), tst);
    await until(() => !document.getElementById("mlAcctDlg").open, null, 10000);
    const sv = await api("GET", "/api/mail/accounts"), acc = (sv.accounts || []).find((a) => a.email === "tim@example.com");
    const cfg1 = await api("GET", "/api/config");
    check("💾 saved: the account listed without its password (has_pass), and GET /api/config holds no password", acc && acc.has_pass && !("pass" in acc) && !JSON.stringify(cfg1).includes("testpass"), { acc, mail: cfg1.mail });
    if (await ev(() => document.getElementById("mlAcctDlg").open)) await p.click("#mlAClose");
    await until(() => document.querySelectorAll("#mlList .mlrow").length === 2, null, 30000);
    const L0 = await ev(() => ({ folders: [...document.querySelectorAll("#mlFolders .mlf")].map((f) => f.textContent.trim()), rows: [...document.querySelectorAll("#mlList .mlrow")].map((r) => ({ who: r.querySelector(".who").textContent, sub: r.querySelector(".sub").textContent, unread: r.classList.contains("unread") })), noacc: document.getElementById("maildock").classList.contains("ml-noacc"), badge: document.getElementById("tX_maildock").getAttribute("data-n") }));
    check("folders: Inbox first (2 unread), then Drafts, Sent, Trash", /^📥Inbox2$/.test(L0.folders[0].replace(/\s/g, "")) && /Drafts/.test(L0.folders[1]) && /Sent/.test(L0.folders[2]) && /Trash/.test(L0.folders[3]), L0.folders);
    check("the list: newest first, both unread (bold); the ✉ button counts 2 unread", L0.rows[0].sub.startsWith("70%") && L0.rows[1].who === "Bea Accountant" && L0.rows.every((r) => r.unread) && L0.badge === "2", L0);

    // read the BAS email
    await click("#mlList .mlrow:nth-child(2)");
    await until(() => document.getElementById("mlHead") && /BAS/.test(document.getElementById("mlHead").textContent));
    await p.waitForTimeout(500);
    const r1 = await ev(() => ({ text: (document.getElementById("mlText") || {}).innerHTML || "", att: [...document.querySelectorAll("#mlAtts a")].map((a) => a.textContent + "|" + a.getAttribute("href")), unread: document.querySelector("#mlList .mlrow.on").classList.contains("unread"), badge: document.getElementById("tX_maildock").getAttribute("data-n"), inbox: (document.querySelector("#mlFolders .mlf .n") || {}).textContent }));
    check("reading: the text with its link clickable, the attachment listed, the row no longer bold, the count 1", /lodged by Friday/.test(r1.text) && /<a href="https:\/\/books\.example\/portal"/.test(r1.text) && r1.att.length === 1 && /receipts\.csv/.test(r1.att[0]) && !r1.unread && r1.badge === "1" && r1.inbox === "1", r1);
    const csv = await (await fetch(new URL(r1.att[0].split("|")[1], URL_))).text();
    check("the attachment downloads with its bytes", /45\.00/.test(csv), csv);
    // the HTML one: a sandboxed frame with a policy, no script, pictures held back
    await click("#mlList .mlrow:nth-child(1)");
    await until(() => document.getElementById("mlFrame"));
    await p.waitForTimeout(600);
    const fr = await ev(() => { const f = document.getElementById("mlFrame"); return { sandbox: f.getAttribute("sandbox"), csp: /img-src data: cid:;/.test(f.srcdoc), script: /<script/i.test(f.srcdoc), onclick: /onclick/i.test(f.srcdoc), pics: !!document.getElementById("mlPicsBtn"), title: document.title }; });
    check("an HTML email: in a sandboxed frame (no scripts), no script / onclick in it, internet pictures blocked until 'Show pictures', the page untouched", fr.sandbox === "allow-popups allow-popups-to-escape-sandbox" && fr.csp && !fr.script && !fr.onclick && fr.pics && fr.title !== "pwned", fr);
    await click("#mlPicsBtn"); await p.waitForTimeout(200);
    const fr2 = await ev(() => ({ csp: /img-src data: cid: https: http:/.test(document.getElementById("mlFrame").srcdoc), bar: !!document.getElementById("mlPics") }));
    check("Show pictures lets them in for this email", fr2.csp && !fr2.bar, fr2);

    // ✨ flag with AI
    await click("#mlFlagAll");
    await until(() => document.querySelectorAll("#mlList .mlrow .fl.mllv3").length === 1 && document.querySelectorAll("#mlList .mlrow .fl.mllv0").length === 1, null, 30000);
    const fl = await ev(() => ({ why: [...document.querySelectorAll("#mlList .why")].map((x) => x.textContent), msg: document.getElementById("mlMsg").textContent, tip: document.querySelector("#mlList .fl.mllv3").title }));
    check("✨ Flag with AI: BAS red (urgent) with its reason under the subject, the sale grey (low); the bar says how many", fl.why.some((w) => /BAS lodgement due Friday/.test(w)) && /2 rated - 1 important/.test(fl.msg) && /urgent/.test(fl.tip), fl);
    check("… the flagging prompt went to the LLM set in Settings ▸ LLM, with the user's name", asked.some((a) => /sort a person's incoming email/.test(a) && /Tim Paul/.test(a)));
    await p.selectOption("#mlShow", "important"); await p.waitForTimeout(150);
    const imp = await ev(() => [...document.querySelectorAll("#mlList .mlrow .sub")].map((x) => x.textContent));
    check("Show ▸ ⚑ Important lists only the BAS email", imp.length === 1 && /BAS/.test(imp[0]), imp);
    await p.selectOption("#mlShow", "all"); await p.selectOption("#mlSort", "ai"); await p.waitForTimeout(150);
    const srt = await ev(() => [...document.querySelectorAll("#mlList .mlrow .sub")].map((x) => x.textContent));
    check("✨ Most important first puts BAS on top", /BAS/.test(srt[0]), srt);
    await p.fill("#mlSearch", "deals"); await p.waitForTimeout(150);
    const srch = await ev(() => [...document.querySelectorAll("#mlList .mlrow .sub")].map((x) => x.textContent));
    check("🔍 search filters the folder (sender name)", srch.length === 1 && /70%/.test(srch[0]), srch);
    await p.fill("#mlSearch", "");

    // ✨ summarise + draft reply + send
    await click("#mlList .mlrow:nth-child(1)");   // BAS (sorted first)
    await until(() => document.getElementById("mlSumBtn") && /BAS/.test(document.getElementById("mlHead").textContent));
    await click("#mlSumBtn"); await until(() => /October receipts/.test(document.getElementById("mlSum").textContent), null, 30000);
    const sm = await ev(() => document.getElementById("mlSum").textContent);
    if (SHOTS) {
      // a wide column for the picture: the side dockers and a floating prompt docker out of the way (only in this mode)
      await ev(() => { const a = document.getElementById("app"); ["no-left", "no-refs", "no-assets", "no-queue", "no-right"].forEach((c) => a.classList.add(c)); const pd = document.getElementById("promptdock"); if (pd) pd.style.display = "none"; window.dispatchEvent(new Event("resize")); });
      await click("#mlMaxBtn"); await shot("mail-docker", "#maildock");
    }
    check("✨ Summarise: the summary + ➤ the action", /lodge the BAS by Friday/.test(sm) && /➤ send Bea the October receipts/.test(sm), sm);
    await p.fill("#mlAsk", "say I will send them today"); await p.selectOption("#mlTone", "brief");
    await click("#mlDraft");
    await until(() => document.getElementById("mlCompose").open && /I will send the October receipts today/.test(document.getElementById("mlEdit").textContent), null, 30000);
    const cp = await ev(() => ({ title: document.getElementById("mlCTitle").textContent, to: document.getElementById("mlCTo").value, subj: document.getElementById("mlCSubj").value, quote: document.getElementById("mlQuote").textContent, undo: !!document.getElementById("mlCUndo"), ccShown: document.getElementById("mlCCcRow").offsetParent !== null || document.getElementById("mlCBccRow").offsetParent !== null }));
    check("✨ Draft reply: the composer opens as a Reply to Bea, 'Re:' subject, the AI's reply in it, the original quoted, ↶ Undo offered", cp.title === "Reply" && /bea@books\.example/.test(cp.to) && cp.subj === "Re: Your BAS is due Friday" && /> Hi Tim, the quarterly BAS/.test(cp.quote) && cp.undo && !cp.ccShown, cp);
    await shot("mail-reply", "#mlCompose");
    check("… the ask and the tone reached the LLM", asked.some((a) => /write email replies/.test(a) && /say I will send them today/.test(a) && /as few words/.test(a)));
    await p.click("#mlCSend");
    await until(() => !document.getElementById("mlCompose").open && /sent to 1 address/.test(document.getElementById("mlMsg").textContent), null, 30000);
    await p.waitForTimeout(400);
    await click("#mlSync"); await until(() => document.querySelectorAll("#mlList .mlrow").length === 3, null, 30000);
    const after = await ev(() => [...document.querySelectorAll("#mlList .mlrow")].map((r) => r.querySelector(".sub").textContent + "|" + r.querySelector(".who").textContent));
    check("➤ Send: it went through SMTP (the stand-in filed it in INBOX), the original shows ↩ answered", after.some((x) => /^Re: Your BAS is due Friday\|/.test(x)) && after.some((x) => /BAS is due Friday\|↩ Bea/.test(x)), after);
    const sentIx = await api("POST", `/api/mail/${acc.id}/sync`, { folder: "Sent" });
    check("… and a copy is in Sent", (sentIx.msgs || []).length === 1 && sentIx.msgs[0].subject === "Re: Your BAS is due Friday", sentIx.msgs);
    const rb = await api("GET", `/api/mail/${acc.id}/message?folder=INBOX&uid=${(sentIx.msgs[0] || {}).uid ? (await api("GET", `/api/mail/${acc.id}/list?folder=INBOX`)).msgs.find((m) => /^Re:/.test(m.subject)).uid : 0}`);
    check("… the sent email: the reply, the quote, threaded (In-Reply-To)", /I will send the October receipts today/.test(rb.text) && /> Hi Tim, the quarterly BAS/.test(rb.text) && rb.inReplyTo === "<bas-818@books.example>", { text: (rb.text || "").slice(0, 200), irt: rb.inReplyTo });

    // ✉ New + ✨ Write it + ✨ Rewrite + ↶ Undo + discard
    await click("#mlNew"); await until(() => document.getElementById("mlCompose").open);
    const nw = await ev(() => ({ title: document.getElementById("mlCTitle").textContent, sig: document.getElementById("mlEdit").textContent, quote: document.getElementById("mlQuoteBox").hidden }));
    check("✉ New: a blank email with the signature, no quote", nw.title === "New email" && /Tim Paul/.test(nw.sig) && /bitGen Studio/.test(nw.sig) && nw.quote, nw);
    await p.fill("#mlCTo", "ann@example.com"); await p.fill("#mlCNotes", "ask Ann to lunch on friday");
    await p.click("#mlCWrite"); await until(() => document.getElementById("mlCSubj").value === "Lunch on Friday?", null, 30000);
    const wr = await ev(() => document.getElementById("mlEdit").innerText);
    check("✨ Write it: the subject and the email from the notes", /Are you free for lunch on Friday\?/.test(wr), wr);
    await p.selectOption("#mlCHow", "shorter and to the point");
    await until(() => /Hi Ann - lunch Friday\?/.test(document.getElementById("mlEdit").innerText), null, 30000);
    check("✨ Rewrite ▸ Shorter rewrites what is there", asked.some((a) => /You improve emails/.test(a) && /shorter and to the point/.test(a) && /Are you free for lunch/.test(a)));
    await p.click("#mlCUndo"); await p.waitForTimeout(150);
    const un = await ev(() => document.getElementById("mlEdit").innerText);
    check("↶ Undo puts the written version back", /Are you free for lunch on Friday\?/.test(un), un);
    await p.click("#mlCDiscard"); await until(() => document.getElementById("notedlg").open);
    await p.click("#note_ok"); await p.waitForTimeout(200);
    check("Discard asks first (it was written in) and closes", !(await ev(() => document.getElementById("mlCompose").open)));

    // 🗑 the sale -> Trash
    await p.selectOption("#mlSort", "date"); await p.waitForTimeout(100);
    const promoRow = await ev(() => [...document.querySelectorAll("#mlList .mlrow")].findIndex((r) => /70%/.test(r.textContent)) + 1);
    await click(`#mlList .mlrow:nth-child(${promoRow})`); await until(() => document.getElementById("mlHead") && /70%/.test(document.getElementById("mlHead").textContent));
    await p.$eval("#mlList", (e) => e.focus()); await p.keyboard.press("Delete");
    await until(() => /moved to Trash/.test(document.getElementById("mlMsg").textContent), null, 20000);
    const del = await ev(() => [...document.querySelectorAll("#mlList .mlrow")].map((r) => r.querySelector(".sub").textContent));
    check("Delete (in the list) moves it to Trash and opens the next one", !del.some((s) => /70%/.test(s)) && del.length === 2, del);
    const tr = await api("POST", `/api/mail/${acc.id}/sync`, { folder: "Trash" });
    check("… it is in Trash on the server", (tr.msgs || []).length === 1 && /70%/.test(tr.msgs[0].subject), tr.msgs);
    if (SHOTS) await click("#mlMaxBtn");   // back to its place in the column
    // the layout as it was for the legs after this one: the docker hidden again (docker_status.json is the server's)
    if (await ev(() => !document.getElementById("maildock").classList.contains("dockgone"))) { await click("#tX_maildock"); await p.waitForTimeout(600); }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("no exception", false, String(e.stack || e).slice(0, 900)); }
  finally {
    try { for (const a of (await api("GET", "/api/mail/accounts")).accounts || []) if (a.email === "tim@example.com") await api("DELETE", "/api/mail/accounts/" + a.id); } catch (e) { /* fine */ }
    try { await api("POST", "/api/config", { llm: llm0 }); } catch (e) { /* fine */ }
    await b.close(); try { smtp.close(); imap.close(); llm.close(); } catch (e) { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
