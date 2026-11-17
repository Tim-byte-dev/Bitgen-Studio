/* ext/maildock/mailcompose.js — ✉ MAIL (2.818.0): THE COMPOSER, window.H3MailCompose.
 *
 * New / Reply / Reply all / Forward in one dialog: From (the account), To, Cc / Bcc, Subject, the text (bold, italic,
 * underline, bullets, numbering, links), 📎 attachments, the original below (☑ include it).
 * ✨ HELP ME WRITE: notes + a tone -> the LLM writes the email (a new one: the subject too; a reply: the reply to the
 * original); ✨ Rewrite what I wrote… - shorter / friendlier / more formal / spelling + grammar / more confident / your
 * own words. Each AI change can be taken back (↶ Undo). ✨ Draft reply in the reading pane opens this with the AI writing.
 * ➤ Send (Ctrl+Enter) goes over the account's SMTP server (and a copy into Sent); 💾 Save draft into Drafts.
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const V = () => root.H3MailView, M = () => root.H3Mail;
  const S = { kind: "new", acc: null, folder: null, body: null, atts: [], undo: null, dirty: false, busy: false };

  function cmsg(t, bad, undo) {
    const m = $("mlCMsg"); if (!m) return;
    m.textContent = t || ""; m.classList.toggle("bad", !!bad);
    if (undo) { const b = doc.createElement("button"); b.className = "ghost"; b.type = "button"; b.textContent = "↶ Undo"; b.id = "mlCUndo"; b.style.marginLeft = "6px"; b.onclick = () => { if (S.undo) { $("mlEdit").innerHTML = S.undo.html; $("mlCSubj").value = S.undo.subj; S.undo = null; cmsg("↶ back to what you had"); } }; m.appendChild(b); }
  }
  const reSubject = (s, kind) => (kind === "forward" ? "Fwd: " : "Re: ") + String(s || "").replace(/^\s*((re|fw|fwd|aw|sv|wg)\s*(\[\d+\])?\s*:\s*)+/i, "").trim();
  function quoteText(b, kind) {
    const v = V(), who = v.fmtAddr(b.from), when = b.date ? new Date(b.date).toLocaleString() : "";
    if (kind === "forward") return `---------- Forwarded message ----------\nFrom: ${who}\nDate: ${when}\nSubject: ${b.subject || ""}\nTo: ${v.fmtAddrs(b.to)}${b.cc && b.cc.length ? "\nCc: " + v.fmtAddrs(b.cc) : ""}\n\n${String(b.text || "").trim()}`;
    return `On ${when}, ${who} wrote:\n` + String(b.text || "").trim().split("\n").map((l) => "> " + l).join("\n");
  }
  function quoteHtml(b, kind) {
    const v = V(), who = v.esc(v.fmtAddr(b.from)), when = v.esc(b.date ? new Date(b.date).toLocaleString() : "");
    const inner = b.html ? b.html : "<div style=\"white-space:pre-wrap\">" + v.linkify(b.text || "") + "</div>";
    if (kind === "forward") return `<br><div>---------- Forwarded message ----------<br>From: ${who}<br>Date: ${when}<br>Subject: ${v.esc(b.subject || "")}<br>To: ${v.esc(v.fmtAddrs(b.to))}</div><br>${inner}`;
    return `<br><div>On ${when}, ${who} wrote:</div><blockquote style="margin:0 0 0 .8ex;border-left:2px solid #ccc;padding-left:1ex">${inner}</blockquote>`;
  }
  function accounts() { return (M() && M().S.accounts) || []; }
  function sigHtml(id) { const a = accounts().find((x) => x.id === id); return a && a.sig ? `<div><br></div><div>-- <br>${V().esc(a.sig).replace(/\n/g, "<br>")}</div>` : ""; }
  function paintAtts() {
    const box = $("mlCAtts"); if (!box) return;
    box.innerHTML = S.atts.map((a, i) => `<span>📎 ${V().esc(a.name)} <span class="hint">${V().size(a.size)}</span> <a href="#" data-rm="${i}" title="Take it off" style="color:inherit">✕</a></span>`).join("")
      + (S.kind === "forward" && S.body && (S.body.attachments || []).length ? `<span class="hint" title="The forwarded email's own attachments go with it">+ ${S.body.attachments.length} from the original</span>` : "");
  }

  /** opts: {kind new|reply|all|forward, acc, folder, body, me, ai: {ask, tone} | null, to, subject, text} */
  function open(opts) {
    const o = opts || {}, dlg = $("mlCompose"); if (!dlg) return;
    const v = V();
    S.kind = o.kind || "new"; S.acc = o.acc || (accounts()[0] || {}).id; S.folder = o.folder || null; S.body = o.body || null; S.atts = []; S.undo = null; S.dirty = false;
    const from = $("mlCFrom");
    from.innerHTML = accounts().map((a) => `<option value="${v.esc(a.id)}">${v.esc(a.name === a.email ? a.email : a.name + " <" + a.email + ">")}</option>`).join("");
    from.value = S.acc || "";
    const b = S.body;
    let to = o.to || "", cc = "", subj = o.subject || "";
    if (b && (S.kind === "reply" || S.kind === "all")) { const t = v.replyTargets(b, o.me, S.kind === "all"); to = t.to; cc = t.cc; subj = reSubject(b.subject, "reply"); }
    if (b && S.kind === "forward") subj = reSubject(b.subject, "forward");
    $("mlCTo").value = to; $("mlCCc").value = cc; $("mlCBcc").value = "";
    $("mlCCcRow").hidden = !cc; $("mlCBccRow").hidden = true;
    $("mlCSubj").value = subj;
    $("mlCTitle").textContent = { new: "New email", reply: "Reply", all: "Reply all", forward: "Forward" }[S.kind] || "Email";
    $("mlEdit").innerHTML = o.text ? v.htmlOfText(o.text) : (S.kind === "new" || S.kind === "forward" ? "<div><br></div>" + sigHtml(S.acc) : "<div><br></div>");
    $("mlQuoteBox").hidden = !b;
    $("mlCQuoteOn").checked = true;
    $("mlQuote").textContent = b ? quoteText(b, S.kind) : "";
    $("mlCNotes").value = ""; $("mlCHow").value = "";
    const tone = $("mlCTone"); tone.innerHTML = M() ? M().toneOptions((o.ai && o.ai.tone) || localStorage.getItem("h3.mail.tone") || "friendly") : "";
    $("mlCWrite").textContent = b && S.kind !== "forward" ? "✨ Write the reply" : "✨ Write it";
    paintAtts(); cmsg("");
    if (!dlg.open) dlg.showModal();
    if (o.ai && b) aiReply(o.ai.ask, o.ai.tone);
    else setTimeout(() => { (to ? $("mlEdit") : $("mlCTo")).focus(); }, 30);
  }
  function close() { const d = $("mlCompose"); if (d && d.open) d.close(); }
  function keepUndo() { S.undo = { html: $("mlEdit").innerHTML, subj: $("mlCSubj").value }; }
  async function run(label, fn) {
    if (S.busy) return; S.busy = true;
    const btns = ["mlCWrite", "mlCSend", "mlCDraft"].map($).filter(Boolean); btns.forEach((x) => { x.disabled = true; });
    cmsg(label);
    try { await fn(); } catch (e) { cmsg("✗ " + e.message, true); }
    finally { S.busy = false; btns.forEach((x) => { x.disabled = false; }); }
  }
  function aiReply(ask, tone) {
    return run("✨ The AI is writing the reply…", async () => {
      const r = await M().api("POST", `/api/mail/${S.acc}/ai/reply`, { folder: S.folder, uid: S.body.uid, ask: ask || "", tone: tone || "friendly", all: S.kind === "all" });
      keepUndo(); $("mlEdit").innerHTML = V().htmlOfText(r.body); S.dirty = true;
      cmsg("✨ written - read it through before you send", false, true);
    });
  }
  function aiWrite() {
    const notes = $("mlCNotes").value.trim(), tone = $("mlCTone").value;
    try { localStorage.setItem("h3.mail.tone", tone); } catch (e) { /* off */ }
    if (S.body && S.kind !== "forward") return aiReply(notes, tone);
    if (!notes) { cmsg("write a few words or notes about what the email should say first", true); $("mlCNotes").focus(); return null; }
    return run("✨ The AI is writing…", async () => {
      const r = await M().api("POST", "/api/mail/ai/write", { id: $("mlCFrom").value, notes, to: $("mlCTo").value, subject: $("mlCSubj").value, tone });
      keepUndo();
      if (r.subject && (!$("mlCSubj").value.trim() || S.kind === "new")) $("mlCSubj").value = r.subject;
      $("mlEdit").innerHTML = V().htmlOfText(r.body) + (S.kind === "forward" ? "" : "");
      S.dirty = true; cmsg("✨ written - read it through before you send", false, true);
    });
  }
  async function aiRewrite(how) {
    let h = how;
    if (h === "*") { h = typeof root.askText === "function" ? await root.askText("✨ Rewrite", "How should it be rewritten? (e.g. add that the price includes delivery, sound less pushy)", "") : null; $("mlCHow").value = ""; if (!h) return; }
    const text = V().textOf($("mlEdit").innerHTML);
    if (!text) { cmsg("there is nothing written to rewrite yet - try ✨ Write it", true); $("mlCHow").value = ""; return; }
    await run("✨ The AI is rewriting it…", async () => {
      const r = await M().api("POST", "/api/mail/ai/rewrite", { id: $("mlCFrom").value, text, how: h });
      keepUndo(); $("mlEdit").innerHTML = V().htmlOfText(r.body); S.dirty = true;
      cmsg("✨ rewritten", false, true);
    });
    $("mlCHow").value = "";
  }
  function payload() {
    const v = V(), html = $("mlEdit").innerHTML, withQ = S.body && $("mlCQuoteOn").checked;
    const p = { to: $("mlCTo").value, cc: $("mlCCc").value, bcc: $("mlCBcc").value, subject: $("mlCSubj").value,
      text: v.textOf(html) + (withQ ? "\n\n" + quoteText(S.body, S.kind) : ""),
      html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px">${html}${withQ ? quoteHtml(S.body, S.kind) : ""}</div>`,
      attachments: S.atts.map((a) => ({ name: a.name, type: a.type, data: a.data })) };
    if (S.body && (S.kind === "reply" || S.kind === "all")) {
      p.inReplyTo = S.body.messageId || undefined;
      p.references = [...(S.body.references || []), S.body.messageId].filter(Boolean).slice(-20);
      p.replyTo = { folder: S.folder, uid: S.body.uid };
    }
    if (S.body && S.kind === "forward") p.forwardOf = { folder: S.folder, uid: S.body.uid };
    return p;
  }
  function send() {
    return run("➤ Sending…", async () => {
      const id = $("mlCFrom").value;
      const r = await M().api("POST", `/api/mail/${id}/send`, payload());
      S.dirty = false; close();
      M().msg(`➤ sent to ${(r.accepted || []).length} ${(r.accepted || []).length === 1 ? "address" : "addresses"}` + (r.sent && r.sent.ok === false ? ` - not copied to Sent (${r.sent.why})` : "") + (r.rejected && r.rejected.length ? ` - refused: ${r.rejected.join(", ")}` : ""), !!(r.rejected && r.rejected.length));
      if (S.body && S.kind !== "forward") { const m = M().S.msgs.find((x) => x.uid === S.body.uid); if (m) { m.answered = true; M().paintList(); } }
    });
  }
  function draft() {
    return run("💾 Saving the draft…", async () => {
      const r = await M().api("POST", `/api/mail/${$("mlCFrom").value}/draft`, payload());
      S.dirty = false; cmsg("💾 saved in " + r.folder);
    });
  }
  async function discard() {
    if (S.dirty && typeof root.appConfirm === "function" && !(await root.appConfirm("Throw this email away? It has not been sent or saved.", "Discard"))) return;
    S.dirty = false; close();
  }
  function addFiles(files) {
    for (const f of files) {
      const rd = new FileReader();
      rd.onload = () => { const s = String(rd.result || ""); S.atts.push({ name: f.name, type: f.type || "application/octet-stream", size: f.size, data: s.slice(s.indexOf(",") + 1) }); S.dirty = true; paintAtts(); };
      rd.readAsDataURL(f);
    }
  }
  function wire() {
    const dlg = $("mlCompose"); if (!dlg) return;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    on("mlCCcBtn", "click", () => { $("mlCCcRow").hidden = false; $("mlCBccRow").hidden = false; $("mlCCc").focus(); });
    on("mlCWrite", "click", aiWrite);
    on("mlCHow", "change", (e) => { if (e.target.value) aiRewrite(e.target.value); });
    on("mlCSend", "click", send); on("mlCDraft", "click", draft); on("mlCDiscard", "click", discard);
    on("mlCAttach", "click", () => $("mlCFile").click());
    on("mlCFile", "change", (e) => { addFiles([...e.target.files]); e.target.value = ""; });
    on("mlCAtts", "click", (e) => { const a = e.target.closest("[data-rm]"); if (a) { e.preventDefault(); S.atts.splice(+a.dataset.rm, 1); paintAtts(); } });
    on("mlFmt", "mousedown", (e) => { if (e.target.closest("[data-cmd]")) e.preventDefault(); });   // the words stay selected
    on("mlFmt", "click", async (e) => {
      const b = e.target.closest("[data-cmd]"); if (!b) return;
      const cmd = b.dataset.cmd;
      if (cmd === "createLink") {
        const sel = root.getSelection(), range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
        const url = typeof root.askText === "function" ? await root.askText("🔗 Link", "The web address", "https://") : null;
        if (!url || !range) return;
        $("mlEdit").focus(); sel.removeAllRanges(); sel.addRange(range);
        doc.execCommand("createLink", false, /^[a-z]+:/i.test(url) ? url : "https://" + url);
      } else { $("mlEdit").focus(); doc.execCommand(cmd, false, null); }
      S.dirty = true;
    });
    ["mlEdit", "mlCTo", "mlCSubj", "mlCCc", "mlCBcc"].forEach((id) => on(id, "input", () => { S.dirty = true; }));
    on("mlEdit", "paste", (e) => {
      // pasted text arrives as text (a web page's styles and scripts stay out of the email)
      const t = e.clipboardData && e.clipboardData.getData("text/plain");
      if (t == null) return;
      e.preventDefault(); doc.execCommand("insertText", false, t);
    });
    dlg.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    dlg.addEventListener("cancel", (e) => { if (S.dirty) { e.preventDefault(); discard(); } });
    dlg.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
    dlg.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } });
  }
  root.H3MailCompose = { open, close, payload, S, aiWrite, aiRewrite, send, draft };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else setTimeout(wire, 0);
})(window);
