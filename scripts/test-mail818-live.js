#!/usr/bin/env node
/* bitGen Studio — 2.818.0 LIVE: ✉ Mail against a stand-in mail server on 127.0.0.1 (hoodiecrow-imap: a strict IMAP server
 * + its SMTP server that files what it gets into INBOX - no real mail anywhere). lib/mailImap.js reads it (folders, sync,
 * a body with an attachment, flags, delete to Trash), lib/mailSend.js sends through it (and files the copy in Sent),
 * lib/mailAi.js flags / summarises / drafts with a stand-in LLM (setComplete) that checks the prompts it is given.
 * Tim (verbatim): "I would like a mail docker that resembles outlook but works with ai, our models should be able to read
 * the emails and flag important ones and draft a reply. it should also help us construct an email." */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const WS = fs.mkdtempSync(path.join(os.tmpdir(), "mail818l-"));
let CFG = { mail: { important: "anything from my accountant Bea" } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: WS };
require.cache[coreP] = fake;

const hoodiecrow = require("hoodiecrow-imap");
const { startSMTPServer } = require("hoodiecrow-imap/lib/hoodiecrowSMTPServer");
const MS = require("../lib/mailStore"), IM = require("../lib/mailImap"), SEND = require("../lib/mailSend"), AI = require("../lib/mailAi");

const CRLF = (s) => s.replace(/\r?\n/g, "\r\n");
const M1 = CRLF(`From: Bea Accountant <bea@books.example>
To: Tim <tim@example.com>
Subject: Your BAS is due Friday
Date: Mon, 16 Nov 2026 09:00:00 +1000
Message-ID: <bas-1@books.example>
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="XX"

--XX
Content-Type: text/plain; charset=utf-8

Hi Tim, the quarterly BAS has to be lodged by Friday 20 November. Please send me the October receipts.

--XX
Content-Type: text/csv; name="receipts.csv"
Content-Disposition: attachment; filename="receipts.csv"

date,amount
2026-10-02,45.00
--XX--
`);
const M2 = CRLF(`From: Deals Daily <promo@shop.example>
To: tim@example.com
Subject: 70% OFF - LAST CHANCE!!!
Date: Tue, 17 Nov 2026 07:00:00 +1000
Message-ID: <promo-9@shop.example>
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

<html><body><h1 onclick="steal()">Huge sale</h1><script>alert(1)</script><p>Click <a href="javascript:evil()">here</a> now.</p><img src="http://tracker.example/p.gif"></body></html>
`);

(async () => {
  const server = hoodiecrow({
    plugins: ["ID", "SPECIAL-USE", "UIDPLUS", "MOVE", "ENABLE", "LIST-STATUS"],
    storage: {
      INBOX: { messages: [{ raw: M1, internaldate: "16-Nov-2026 09:00:00 +1000" }, { raw: M2, internaldate: "17-Nov-2026 07:00:00 +1000" }] },
      "": { separator: "/", folders: { Sent: { "special-use": "\\Sent" }, Drafts: { "special-use": "\\Drafts" }, Trash: { "special-use": "\\Trash" }, Projects: {} } },
    },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const IPORT = server.server ? server.server.address().port : server.address().port;
  const smtp = startSMTPServer(0, server);
  await new Promise((r) => setTimeout(r, 300));
  const SPORT = smtp.server.address().port;
  const acc = Object.assign({ id: "live818" }, MS.cleanAccount({ name: "Tim Paul", email: "tim@example.com", user: "testuser",
    imap: { host: "127.0.0.1", port: IPORT, secure: false }, smtp: { host: "127.0.0.1", port: SPORT, secure: false }, tls_check: false, save_sent: true }), { pass: "testpass" });

  try {
    // the login refused says so in words
    let err = null;
    try { await IM.test(Object.assign({}, acc, { pass: "wrong" })); } catch (e) { err = e; }
    check("a wrong password: refused in words, with the app-password hint (401)", err && err.status === 401 && /refused the login/.test(err.message) && /app password/.test(err.message), err && err.message);

    const t = await IM.test(acc);
    check("test(): logged in, folders counted", t.ok && t.folders >= 5, t);
    const F = await IM.folders(acc);
    check("folders(): INBOX first, then Drafts / Sent / Trash by special use, Projects after; counts from LIST-STATUS",
      F[0].special === "inbox" && F.map((f) => f.special).join(",").startsWith("inbox,drafts,sent") && F.some((f) => f.path === "Projects" && f.special === "") && F[0].total === 2, F);
    check("… kept in mail/<account>/folders.json", JSON.parse(fs.readFileSync(path.join(WS, "mail", "live818", "folders.json"), "utf8")).length === F.length);

    const ix = await IM.sync(acc, "INBOX", { limit: 50 });
    check("sync(): both messages, newest first, sender / subject / unseen from the server", ix.msgs.length === 2 && ix.msgs[0].subject.startsWith("70%") && ix.msgs[1].from.address === "bea@books.example" && ix.msgs.every((m) => !m.seen) && ix.uidValidity, ix.msgs);
    const bea = ix.msgs.find((m) => /BAS/.test(m.subject)), promo = ix.msgs.find((m) => /OFF/.test(m.subject));

    const b1 = await IM.message(acc, "INBOX", bea.uid);
    check("message(): the text and the attachment (name, type, bytes kept beside it)", /lodged by Friday/.test(b1.text) && b1.attachments.length === 1 && b1.attachments[0].name === "receipts.csv"
      && fs.readFileSync(path.join(MS.attDir("live818", "INBOX", bea.uid), "0"), "utf8").includes("45.00"), b1);
    check("… the snippet lands in the index", /quarterly BAS/.test((MS.index("live818", "INBOX").msgs.find((m) => m.uid === bea.uid) || {}).snippet || ""));
    const b2 = await IM.message(acc, "INBOX", promo.uid);
    check("an HTML email made safe: no script, no onclick, javascript: link neutralised, the remote picture kept for the pane's choice",
      b2.html && !/<script/i.test(b2.html) && !/onclick/i.test(b2.html) && !/javascript:/i.test(b2.html) && /tracker\.example/.test(b2.html), b2.html);

    await IM.setFlags(acc, "INBOX", bea.uid, { seen: true, flagged: true });
    const again = await IM.sync(acc, "INBOX");
    const bea2 = again.msgs.find((m) => m.uid === bea.uid);
    check("setFlags(): \\Seen + \\Flagged on the server (a fresh sync sees them)", bea2.seen && bea2.flagged, bea2);

    // the LLM stand-in: flagging, summary, reply, write, rewrite - each checks what it is told
    const asked = [];
    AI.setComplete(async (o) => {
      const sys = (o.messages.find((m) => m.role === "system") || {}).content || "", user = (o.messages.find((m) => m.role === "user") || {}).content || "";
      asked.push({ sys, user });
      if (/sort a person's incoming email/.test(sys)) {
        const lines = []; const parts = user.split(/=== Email (\d+) ===/);
        for (let i = 1; i < parts.length; i += 2) lines.push(/BAS/.test(parts[i + 1]) ? `${parts[i]} | 3 | BAS lodgement due Friday, receipts needed` : `${parts[i]} | 0 | promotional sale email`);
        return { ok: true, text: "<think>hm</think>" + lines.join("\n") };
      }
      if (/summarise emails/.test(sys)) return { ok: true, text: "Bea needs the October receipts so the BAS can be lodged by Friday 20 November.\nAction: send Bea the October receipts" };
      if (/write email replies/.test(sys)) return { ok: true, text: "Here is the reply:\nSubject: Re: BAS\n\nHi Bea,\n\nI will send the October receipts today.\n\nThanks,\nTim" };
      if (/You write emails for/.test(sys)) return { ok: true, text: "Subject: Lunch on Friday?\n\nHi Ann,\n\nAre you free for lunch on Friday?\n\nTim" };
      if (/You improve emails/.test(sys)) return { ok: true, text: "```\nHi Ann, lunch Friday?\n```" };
      return { ok: false, error: "unexpected prompt" };
    });
    const fl = await AI.flag(acc, "INBOX", {});
    const ix3 = MS.index("live818", "INBOX");
    check("ai.flag(): both rated (BAS 3 urgent, the sale 0 low) and kept in the index with the reason", fl.flagged === 2 && ix3.msgs.find((m) => m.uid === bea.uid).ai.level === 3 && ix3.msgs.find((m) => m.uid === promo.uid).ai.level === 0 && /receipts/.test(ix3.msgs.find((m) => m.uid === bea.uid).ai.why), fl);
    check("… the prompt carried the user's own 'what matters to me' and who they are", /accountant Bea/.test(asked[0].sys) && /Tim Paul/.test(asked[0].sys));
    const ix4 = await IM.sync(acc, "INBOX");
    check("a later sync keeps the AI flags", ix4.msgs.find((m) => m.uid === bea.uid).ai && ix4.msgs.find((m) => m.uid === bea.uid).ai.level === 3);
    const sm = await AI.summary(acc, "INBOX", bea.uid);
    check("ai.summary(): two parts (summary + action), kept with the body", /October receipts/.test(sm.summary) && /send Bea/.test(sm.action) && MS.body("live818", "INBOX", bea.uid).ai_summary.action === sm.action, sm);
    const rp = await AI.reply(acc, "INBOX", bea.uid, { ask: "say I will send them today", tone: "brief" });
    check("ai.reply(): the body only (the 'Here is' line and Subject line cleaned off), the ask + tone in the prompt", /^Hi Bea/.test(rp.body) && !/Subject/.test(rp.body) && /send them today/.test(asked[asked.length - 1].user) && /as few words/.test(asked[asked.length - 1].sys), rp);
    const wr = await AI.write({ notes: "ask Ann to lunch friday", to: "ann@example.com", tone: "friendly", name: "Tim Paul" });
    check("ai.write(): subject + body from notes", wr.subject === "Lunch on Friday?" && /^Hi Ann/.test(wr.body), wr);
    const rw = await AI.rewrite({ text: "hi ann. lunch friday??", how: "shorter" });
    check("ai.rewrite(): the code fence cleaned off", rw.body === "Hi Ann, lunch Friday?", rw);

    // sending: through SMTP (STARTTLS with the stand-in's own certificate - tls_check off) + the copy in Sent; it lands in INBOX
    const sent = await SEND.send(acc, { to: "Ann <ann@example.com>", cc: "bea@books.example", bcc: "boss@example.com", subject: SEND.replySubject("Re: Re: BAS", "reply"), text: rp.body + SEND.quoteOf(b1, "reply"),
      inReplyTo: b1.messageId, references: [b1.messageId], attachments: [{ name: "note.txt", type: "text/plain", data: Buffer.from("hello").toString("base64") }], replyTo: { folder: "INBOX", uid: bea.uid } });
    check("send(): accepted by the SMTP server, a Message-ID, the copy filed in Sent", sent.ok && sent.accepted.length === 3 && /@/.test(sent.messageId) && sent.sent && sent.sent.ok && sent.sent.folder === "Sent", sent);
    await new Promise((r) => setTimeout(r, 300));
    const ix5 = await IM.sync(acc, "INBOX");
    const got = ix5.msgs.find((m) => m.subject === "Re: BAS");
    check("… it arrived (the stand-in files SMTP mail in INBOX) with one 'Re:'", !!got, ix5.msgs.map((m) => m.subject));
    const gb = got && await IM.message(acc, "INBOX", got.uid);
    check("… with the quoted original, the attachment and In-Reply-To", gb && /> Hi Tim, the quarterly BAS/.test(gb.text) && gb.attachments.some((a) => a.name === "note.txt") && gb.inReplyTo === b1.messageId, gb && { text: gb.text.slice(0, 300), inReplyTo: gb.inReplyTo });
    check("… the original marked answered", (await IM.sync(acc, "INBOX")).msgs.find((m) => m.uid === bea.uid).answered);
    const sentIx = await IM.sync(acc, "Sent");
    const sb = await IM.message(acc, "Sent", sentIx.msgs[0].uid);
    check("Sent holds exactly what was sent (the Bcc address never written into it)", sentIx.msgs.length === 1 && sentIx.msgs[0].subject === "Re: BAS" && !JSON.stringify(sb).includes("boss@") && !gb.cc.concat(gb.to).some((a) => /boss/.test(a.address)), sb && { to: sb.to, cc: sb.cc });
    let berr = null; try { await SEND.compose(acc, { to: "not an address", subject: "x" }); } catch (e) { berr = e; }
    check("a bad address is refused before anything is sent", berr && berr.status === 400 && /not an email address/.test(berr.message));
    const dr = await SEND.draft(acc, { to: "", subject: "half written", text: "…" });
    check("draft(): saved in Drafts (no recipient needed)", dr.ok && dr.folder === "Drafts", dr);

    // delete = to Trash; in Trash = gone
    const del = await IM.remove(acc, "INBOX", promo.uid);
    check("remove(): moved to Trash, out of the local index", del.ok && del.to === "Trash" && !MS.index("live818", "INBOX").msgs.some((m) => m.uid === promo.uid), del);
    const tix = await IM.sync(acc, "Trash");
    check("… it is in Trash on the server", tix.msgs.length === 1 && /OFF/.test(tix.msgs[0].subject));
    const del2 = await IM.remove(acc, "Trash", tix.msgs[0].uid);
    check("removing from Trash deletes it", del2.deleted && (await IM.sync(acc, "Trash")).msgs.length === 0, del2);

    // the LLM down: said in words
    AI.setComplete(async () => ({ ok: false, status: 400, error: "No .gguf model found" }));
    let aerr = null; try { await AI.flag(acc, "INBOX", { redo: true }); } catch (e) { aerr = e; }
    check("no LLM: flagging says why", aerr && /the LLM did not answer: No \.gguf/.test(aerr.message), aerr && aerr.message);
  } catch (e) { check("no exception", false, e && (e.stack || e.message)); }
  finally {
    try { smtp.close(); } catch (e) { /* fine */ }
    try { server.close(); } catch (e) { /* fine */ }
    fs.rmSync(WS, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
