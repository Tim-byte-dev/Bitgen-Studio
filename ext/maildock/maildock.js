/* ext/maildock/maildock.js — ✉ MAIL (2.818.0): the docker - folders | the list | the reading pane, window.H3Mail.
 *
 * Tim (verbatim): "I would like a mail docker that resembles outlook but works with ai, our models should be able to read
 * the emails and flag important ones and draft a reply. it should also help us construct an email."
 *   the bar         account, ✉ New, ↩ Reply, ↩↩ Reply all, ↪ Forward, 🗑, ★ (flag on the server), ● (unread / read),
 *                   ⟳ Check mail, ✨ Flag with AI (Shift = all again), ☐ ✨ auto, 🔍 search, ⚙ Accounts
 *   the list        unread bold, the AI's ⚑ (red urgent, orange important, blue normal, grey low) with its reason;
 *                   Show All / Unread / ⚑ Important / ★ Flagged; Newest first / ✨ Most important first; ↑ ↓ + Delete keys
 *   the pane        the email in a sandboxed frame (no scripts; internet pictures only after "Show pictures"),
 *                   attachments, ✨ Summarise, ✨ Draft reply (+ what it should say + the tone)
 *   checking        every N minutes while bitGen is open (⚙ Accounts); the ✉ button shows the unread count;
 *                   ✨ auto = the AI flags new mail as it comes
 * 2.820.0 (Tim: "finish the mail client ... it looks like it is just the start"): Ctrl / Shift-click (Ctrl+A) picks
 *                   several - 🗑 ★ ● and 📁 Move ▾ work on all of them at once (one login, lib/mailBatch.js); drag emails
 *                   onto a folder = move; ＋ on the folders = a new folder; ⤓ Older emails at the end of the list (200 more
 *                   each time); Enter in 🔍 = search the WHOLE folder on the server (✕ back to the folder)
 * The work is on the server (routes/mail.js); the composer is mailcompose.js, the accounts dialog mailaccounts.js.
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const V = () => root.H3MailView;
  const S = { accounts: [], settings: { important: "", auto_flag: false, check_min: 5 }, tones: [], acc: null, folder: "INBOX", folders: [],
    msgs: [], sel: null, body: null, remote: false, booted: false, timer: 0, busy: 0, unread: 0,
    picks: new Set(), anchor: null, limit: {}, search: null };   // 2.820.0: several picked, older emails per folder, a server search
  const TONE_NAMES = { friendly: "Friendly", professional: "Professional", formal: "Formal", brief: "Brief", warm: "Warm", apologetic: "Apologetic", firm: "Firm" };
  const store = { get: (k) => { try { return root.localStorage.getItem("h3.mail." + k); } catch (e) { return null; } }, set: (k, v) => { try { root.localStorage.setItem("h3.mail." + k, v); } catch (e) { /* off */ } } };

  async function api(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) throw new Error((j && j.error) || ("HTTP " + r.status));
    return j || {};
  }
  function msg(t, bad) { const m = $("mlMsg"); if (!m) return; m.textContent = t || ""; m.classList.toggle("bad", !!bad); m.title = t || ""; }
  function busy(on) { S.busy = Math.max(0, S.busy + (on ? 1 : -1)); const d = $("maildock"); if (d) d.style.cursor = S.busy ? "progress" : ""; }
  const accNow = () => S.accounts.find((a) => a.id === S.acc) || null;
  const enc = encodeURIComponent;

  /* ---------------------------------------------------------------- accounts + folders */
  async function loadAccounts(pick) {
    const r = await api("GET", "/api/mail/accounts");
    S.accounts = r.accounts || []; S.settings = r.settings || S.settings; S.tones = r.tones || [];
    const want = pick || S.acc || store.get("acc");
    S.acc = (S.accounts.find((a) => a.id === want) || S.accounts[0] || {}).id || null;
    const sel = $("mlAccSel");
    if (sel) { sel.innerHTML = S.accounts.map((a) => `<option value="${V().esc(a.id)}">${V().esc(a.name === a.email ? a.email : a.name + " - " + a.email)}</option>`).join(""); sel.value = S.acc || ""; }
    $("maildock").classList.toggle("ml-noacc", !S.acc);
    const au = $("mlAuto"); if (au) au.checked = !!S.settings.auto_flag;
    schedule();
    return S.accounts;
  }
  async function loadFolders(refresh) {
    if (!S.acc) return;
    const r = await api("GET", `/api/mail/${S.acc}/folders${refresh ? "?refresh=1" : ""}`);
    S.folders = r.folders || []; paintFolders();
  }
  function paintFolders() {
    const box = $("mlFolders"); if (!box) return;
    const a = accNow();
    box.innerHTML = (a ? `<div class="mlacc" title="${V().esc(a.email)}"><span>${V().esc(a.name || a.email)}</span><button class="ghost" type="button" id="mlNewFolder" title="A new folder on the server (inside the folder shown when you hold Shift)">＋</button></div>` : "") + S.folders.map((f) => {
      const ic = V().FICON[f.special] || V().FICON[""];
      // the folder shown counts from the list (reading one takes it off at once); the others as the server last said
      const unread = f.path === S.folder && S.booted ? S.msgs.filter((m) => !m.seen).length : f.unseen;
      const n = f.special === "inbox" || f.special === "" ? unread : (f.special === "drafts" ? f.total : 0);
      const name = f.special === "inbox" && /^inbox$/i.test(f.name) ? "Inbox" : f.name;
      return `<div class="mlf${f.path === S.folder ? " on" : ""}" data-path="${V().esc(f.path)}" role="treeitem" title="${V().esc(f.path)}"><span>${ic}</span><span class="nm">${V().esc(name)}</span>${n ? `<span class="n">${n}</span>` : ""}</div>`;
    }).join("");
  }

  /* ---------------------------------------------------------------- the list */
  async function openFolder(p, noSync) {
    S.folder = p || "INBOX"; S.sel = null; S.body = null; S.picks.clear(); S.search = null; searchBar(); paintFolders(); paintRead();
    try { const r = await api("GET", `/api/mail/${S.acc}/list?folder=${enc(S.folder)}`); S.msgs = r.msgs || []; paintList(); } catch (e) { S.msgs = []; paintList(); }
    if (!noSync) await sync();
  }
  async function sync(quiet) {
    if (!S.acc || S.search) return;
    busy(true); if (!quiet) msg("⟳ Checking " + S.folder + "…");
    try {
      const before = new Set(S.msgs.map((m) => m.uid));
      const r = await api("POST", `/api/mail/${S.acc}/sync`, { folder: S.folder, limit: S.limit[S.folder] || 200 });
      if (S.search) return;
      S.msgs = r.msgs || []; if (r.folders) S.folders = r.folders;
      for (const u of [...S.picks]) if (!S.msgs.some((m) => m.uid === u)) S.picks.delete(u);
      paintFolders(); paintList(); badge();
      const fresh = S.msgs.filter((m) => !before.has(m.uid)).length;
      msg(quiet && !fresh ? "" : (before.size && fresh ? `${fresh} new` : `${S.msgs.length} emails`) + " · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (S.settings.auto_flag && S.msgs.some((m) => !m.ai)) await flagAi(false, true);
    } catch (e) { msg("✗ " + e.message, true); }
    finally { busy(false); }
  }
  function shown() { return V().sortMsgs(V().filterMsgs(S.msgs, ($("mlShow") || {}).value || "all", ($("mlSearch") || {}).value || ""), ($("mlSort") || {}).value || "date"); }
  function paintList() {
    const box = $("mlList"); if (!box) return;
    const L = shown(), v = V();
    box.innerHTML = L.map((m) => {
      const f = v.flagOf(m);
      return `<div class="mlrow${m.seen ? "" : " unread"}${m.uid === S.sel ? " on" : ""}${S.picks.has(m.uid) ? " pick" : ""}" data-uid="${m.uid}" draggable="true" role="option" aria-selected="${m.uid === S.sel || S.picks.has(m.uid)}">`
        + `<span class="fl ${f ? f.cls : ""}" title="${v.esc(f ? f.tip : "not rated by the AI yet")}">${f ? f.icon : ""}</span>`
        + `<span class="who">${m.flagged ? "★ " : ""}${m.answered ? "↩ " : ""}${v.esc(v.whoName(S.folder && /sent|draft/i.test(specialOf(S.folder)) ? (m.to || [])[0] : m.from) || "(nobody)")}</span>`
        + `<span class="when">${v.esc(v.shortDate(m.date))}</span>`
        + `<span class="sub">${v.esc(m.subject || "(no subject)")}</span>`
        + (f && f.cls !== "mllv0" && m.ai.why ? `<span class="why ${f.cls}">✨ ${v.esc(m.ai.why)}</span>` : (m.snippet ? `<span class="snip">${v.esc(m.snippet)}</span>` : ""))
        + `</div>`;
    }).join("") || `<div class="mlnone" style="padding:14px;color:var(--dim);font-size:12px">${S.msgs.length ? "Nothing matches." : S.search ? "Nothing found on the server." : "No emails here."}</div>`;
    // 2.820.0: the folder holds more than the list - 200 more each time
    const fo = S.folders.find((f) => f.path === S.folder);
    if (!S.search && fo && fo.exists > S.msgs.length && S.msgs.length >= (S.limit[S.folder] || 200)) box.insertAdjacentHTML("beforeend", `<div class="mlmore"><button class="ghost gbtn" type="button" id="mlOlder" title="Read 200 more of this folder's emails from the server">⤓ Older emails (${fo.exists - S.msgs.length} more)</button></div>`);
    const c = $("mlCount"); if (c) c.textContent = (L.length === S.msgs.length ? `${S.msgs.length}` : `${L.length} of ${S.msgs.length}`) + (S.picks.size > 1 ? ` · ${S.picks.size} picked` : "");
    pickBar();
  }
  function specialOf(p) { const f = S.folders.find((x) => x.path === p); return f ? f.special : ""; }
  function setBadge(n) {
    const b = $("tX_maildock"); S.unread = n;
    if (!b) return;
    if (n) b.setAttribute("data-n", n > 99 ? "99+" : String(n)); else b.removeAttribute("data-n");
    b.title = "Mail" + (n ? ` - ${n} unread` : "");
  }
  function badge() {
    const inbox = S.folders.find((f) => f.special === "inbox");
    setBadge(inbox && S.folder === inbox.path && S.booted ? S.msgs.filter((m) => !m.seen).length : ((inbox && inbox.unseen) || 0));
  }
  /** the timer's check: the INBOX - shown = the list repaints; not shown = only the count (and ✨ auto) */
  async function checkInbox() {
    if (!S.acc || S.busy) return;
    const inbox = (S.folders.find((f) => f.special === "inbox") || {}).path || "INBOX";
    if (S.booted && S.folder === inbox) return sync(true);
    try {
      const r = await api("POST", `/api/mail/${S.acc}/sync`, { folder: inbox });
      if (r.folders) { S.folders = r.folders; if (S.booted) paintFolders(); }
      setBadge((r.msgs || []).filter((m) => !m.seen).length);
      if (S.settings.auto_flag && (r.msgs || []).some((m) => !m.ai)) api("POST", `/api/mail/${S.acc}/ai/flag`, { folder: inbox }).catch(() => {});
    } catch (e) { /* the next check says it when the docker is open */ }
  }

  /* ---------------------------------------------------------------- the reading pane */
  async function select(uid) {
    S.sel = uid; S.remote = false; paintList();
    const m = S.msgs.find((x) => x.uid === uid); if (!m) { S.body = null; paintRead(); return; }
    const pane = $("mlRead"); if (pane) pane.innerHTML = `<div class="mlnone">Opening…</div>`;
    try {
      S.body = await api("GET", `/api/mail/${S.acc}/message?folder=${enc(S.folder)}&uid=${uid}`);
      if (S.sel !== uid) return;
      paintRead();
      if (!m.seen) { m.seen = true; paintList(); paintFolders(); badge(); api("POST", `/api/mail/${S.acc}/flags`, { folder: S.folder, uid, seen: true }).catch(() => {}); }
    } catch (e) { if (S.sel === uid) { S.body = null; if (pane) pane.innerHTML = `<div class="mlnone">✗ ${V().esc(e.message)}</div>`; } }
  }
  function toneOptions(sel) { return (S.tones.length ? S.tones : Object.keys(TONE_NAMES)).map((t) => `<option value="${t}"${t === sel ? " selected" : ""}>${TONE_NAMES[t] || t}</option>`).join(""); }
  function paintRead() {
    const pane = $("mlRead"); if (!pane) return;
    const b = S.body, v = V();
    if (!b) { pane.innerHTML = `<div class="mlnone">${S.msgs.length ? "Pick an email to read it." : ""}</div>`; return; }
    const m = S.msgs.find((x) => x.uid === b.uid) || {}, f = v.flagOf(m), sum = b.ai_summary;
    const remote = b.html && v.hasRemote(b.html);
    pane.innerHTML = `<div id="mlHead"><div class="subj">${v.esc(b.subject || "(no subject)")}</div>`
      + `<div class="meta"><b>${v.esc(v.fmtAddr(b.from))}</b> · ${v.esc(b.date ? new Date(b.date).toLocaleString() : "")}<br>`
      + `To: ${v.esc(v.fmtAddrs(b.to)) || "-"}${b.cc && b.cc.length ? "<br>Cc: " + v.esc(v.fmtAddrs(b.cc)) : ""}</div></div>`
      + `<div id="mlAi"><div class="row">${f ? `<span class="${f.cls}" title="${v.esc(f.tip)}">${f.icon} ${v.esc(f.name)}${m.ai.why ? " - " + v.esc(m.ai.why) : ""}</span>` : `<span class="hint">✨ not rated yet</span>`}`
      + `<button class="ghost gbtn" type="button" id="mlSumBtn" title="The AI sums the email up and says what you need to do">✨ ${sum ? "Summarise again" : "Summarise"}</button></div>`
      + `<div id="mlSum">${sum ? v.esc(sum.summary) + (sum.action ? `<br><span class="act">➤ ${v.esc(sum.action)}</span>` : "") : ""}</div>`
      + `<div class="row"><input type="text" id="mlAsk" placeholder="What should the reply say? (optional - e.g. yes, Thursday works)" aria-label="What the reply should say">`
      + `<select id="mlTone" aria-label="Tone" title="The reply's tone">${toneOptions(store.get("tone") || "friendly")}</select>`
      + `<button class="ghost gbtn" type="button" id="mlDraft" title="The AI writes a reply to the sender - you check it in the composer before it goes">✨ Draft reply</button>`
      + `<button class="ghost gbtn" type="button" id="mlDraftAll" title="The AI writes a reply to everyone on the email">✨ Reply all</button></div></div>`
      + `<div id="mlAtts">${(b.attachments || []).map((a) => `<a href="/api/mail/${S.acc}/attachment?folder=${enc(S.folder)}&uid=${b.uid}&i=${a.i}" download="${v.esc(a.name)}" title="${v.esc(a.type)} - download">📎 ${v.esc(a.name)} <span class="hint">${v.size(a.size)}</span></a>`).join("")}</div>`
      + (remote && !S.remote ? `<div id="mlPics">🛡 Pictures from the internet are hidden - they can tell the sender you opened the email. <button class="ghost" type="button" id="mlPicsBtn">Show pictures</button></div>` : "")
      + (b.html ? `<iframe id="mlFrame" title="The email" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe>` : `<div id="mlText">${v.linkify(b.text || "")}</div>`);
    const fr = $("mlFrame"); if (fr) fr.srcdoc = v.frameDoc(b.html, S.remote);
  }
  async function summarise() {
    const b = S.body; if (!b) return;
    const box = $("mlSum"); if (box) box.innerHTML = `<span class="hint">✨ reading…</span>`;
    busy(true);
    try { b.ai_summary = await api("POST", `/api/mail/${S.acc}/ai/summary`, { folder: S.folder, uid: b.uid }); if (S.body === b) paintRead(); }
    catch (e) { if (box) box.innerHTML = `<span class="mllv3">✗ ${V().esc(e.message)}</span>`; }
    finally { busy(false); }
  }
  async function flagAi(redo, quiet) {
    if (!S.acc) return;
    busy(true); msg("✨ The AI is reading " + (redo ? "every email" : "the new emails") + "…");
    try {
      const r = await api("POST", `/api/mail/${S.acc}/ai/flag`, { folder: S.folder, redo: !!redo });
      const l = await api("GET", `/api/mail/${S.acc}/list?folder=${enc(S.folder)}`); S.msgs = l.msgs || S.msgs;
      paintList(); if (S.body) paintRead();
      const hi = (r.results || []).filter((x) => x.level >= 2).length;
      msg(r.flagged ? `✨ ${r.flagged} rated${hi ? ` - ${hi} important` : ""}${r.failed && r.failed.length ? ` (${r.failed.length} not rated - press again)` : ""}` : (quiet ? "" : "✨ nothing new to rate (Shift+click rates them all again)"));
    } catch (e) { msg("✗ " + e.message, true); }
    finally { busy(false); }
  }

  /* ---------------------------------------------------------------- actions */
  const C = () => root.H3MailCompose;
  function needSel() { if (!S.body) { msg("pick an email first", true); return false; } return true; }
  function reply(kind, ai) {
    if (!needSel()) return;
    const a = accNow();
    C().open({ kind, acc: S.acc, folder: S.folder, body: S.body, me: a && a.email, ai: ai ? { ask: ($("mlAsk") || {}).value || "", tone: ($("mlTone") || {}).value || "friendly" } : null });
  }
  /* 2.820.0: several picked - one call for all of them */
  const picked = () => (S.picks.size > 1 ? [...S.picks] : []);
  async function batch(op, to) {
    const uids = picked(); if (!uids.length) return false;
    busy(true); msg(`… ${uids.length} emails`);
    try {
      const r = await api("POST", `/api/mail/${S.acc}/batch`, { folder: S.folder, uids, op, to });
      if (op === "move" || op === "delete") {
        S.msgs = S.msgs.filter((m) => !S.picks.has(m.uid));
        if (S.picks.has(S.sel)) { S.sel = null; S.body = null; paintRead(); }
        S.picks.clear();
        const fo = S.folders.find((f) => f.path === S.folder); if (fo && fo.exists) fo.exists = Math.max(0, fo.exists - uids.length);
      } else {
        const k = op === "seen" || op === "unseen" ? "seen" : "flagged", v = op === "seen" || op === "flag";
        for (const m of S.msgs) if (S.picks.has(m.uid)) m[k] = v;
      }
      paintList(); paintFolders(); badge();
      msg(r.deleted ? `🗑 ${r.n} deleted` : op === "move" ? `📁 ${r.n} moved to ${r.to}` : `✓ ${r.n} emails`);
    } catch (e) { msg("✗ " + e.message, true); }
    finally { busy(false); }
    return true;
  }
  async function moveTo(to, uidsIn) {
    if (!to || to === S.folder) return;
    if (uidsIn && uidsIn.length > 1) { S.picks = new Set(uidsIn); return batch("move", to); }
    const uid = uidsIn && uidsIn.length ? uidsIn[0] : S.sel;
    if (S.picks.size > 1 && !uidsIn) return batch("move", to);
    if (!uid) { msg("pick an email first", true); return; }
    busy(true);
    try {
      await api("POST", `/api/mail/${S.acc}/move`, { folder: S.folder, uid, to });
      S.msgs = S.msgs.filter((m) => m.uid !== uid); if (S.sel === uid) { S.sel = null; S.body = null; paintRead(); }
      paintList(); paintFolders(); badge(); msg("📁 moved to " + to);
    } catch (e) { msg("✗ " + e.message, true); }
    finally { busy(false); }
  }
  function pickBar() {
    const n = S.picks.size, b = $("mlMove"); if (b) b.title = n > 1 ? `Move the ${n} picked emails to another folder (or drag them onto one)` : "Move the email to another folder (or drag it onto one)";
  }
  function moveMenu(btn) {
    const old = doc.getElementById("mlMoveMenu"); if (old) { old.remove(); return; }
    const m = doc.createElement("div"); m.id = "mlMoveMenu"; m.className = "mlmenu";
    m.innerHTML = S.folders.filter((f) => f.path !== S.folder).map((f) => `<div data-path="${V().esc(f.path)}">${V().FICON[f.special] || V().FICON[""]} ${V().esc(f.special === "inbox" ? "Inbox" : f.name)}</div>`).join("") || `<div class="hint">no other folder</div>`;
    const r = btn.getBoundingClientRect(); m.style.left = Math.round(r.left) + "px"; m.style.top = Math.round(r.bottom + 2) + "px";
    doc.body.appendChild(m);
    m.addEventListener("click", (e) => { const it = e.target.closest("[data-path]"); if (it) { m.remove(); moveTo(it.dataset.path); } });
    setTimeout(() => doc.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target) && e.target !== btn) { m.remove(); doc.removeEventListener("pointerdown", off, true); } }, true), 0);
  }
  /* 2.820.0: Enter in 🔍 = the whole folder on the server */
  function searchBar() {
    const b = $("mlSearchBar"); if (!b) return;
    b.hidden = !S.search;
    if (S.search) b.innerHTML = `🔍 ${S.search.total > S.msgs.length ? `${S.msgs.length} newest of ${S.search.total}` : S.search.total} found on the server for <b>${V().esc(S.search.q)}</b> <button class="ghost" type="button" id="mlSearchOff" title="Back to the folder">✕</button>`;
  }
  async function serverSearch(q) {
    if (!S.acc) return;
    if (!q.trim()) { if (S.search) return openFolder(S.folder, true); return; }
    busy(true); msg("🔍 Searching " + S.folder + " on the server…");
    try {
      const r = await api("POST", `/api/mail/${S.acc}/search`, { folder: S.folder, q });
      S.search = { q, total: r.total || 0 }; S.msgs = r.msgs || []; S.picks.clear(); S.sel = null; S.body = null;
      $("mlSearch").value = ""; searchBar(); paintList(); paintRead(); msg("");
    } catch (e) { msg("✗ " + e.message, true); }
    finally { busy(false); }
  }
  async function older() {
    S.limit[S.folder] = (S.limit[S.folder] || 200) + 200;
    await sync();
  }
  async function newFolder(shift) {
    const ask = root.askText ? await root.askText("A new folder on the server" + (shift ? " (inside " + S.folder + ")" : ""), "", "Folder name") : root.prompt("Folder name");
    if (!ask || !String(ask).trim()) return;
    try { const r = await api("POST", `/api/mail/${S.acc}/folders`, { name: String(ask).trim(), parent: shift ? S.folder : "" }); S.folders = r.folders || S.folders; paintFolders(); msg("📁 " + String(ask).trim() + " made"); }
    catch (e) { msg("✗ " + e.message, true); }
  }
  async function del() {
    if (await batch("delete")) return;
    if (!S.sel) return;
    const uid = S.sel, L = shown(), i = L.findIndex((m) => m.uid === uid), next = L[i + 1] || L[i - 1];
    busy(true);
    try {
      const r = await api("POST", `/api/mail/${S.acc}/delete`, { folder: S.folder, uid });
      S.msgs = S.msgs.filter((m) => m.uid !== uid); S.sel = null; S.body = null; paintList(); paintRead(); badge();
      msg(r.deleted ? "🗑 deleted" : "🗑 moved to " + r.to);
      if (next) select(next.uid);
    } catch (e) { msg("✗ " + e.message, true); }
    finally { busy(false); }
  }
  async function toggle(k) {
    if (S.picks.size > 1) {                            // all of them the way the first one is not
      const first = S.msgs.find((x) => S.picks.has(x.uid)) || {};
      return batch(k === "seen" ? (first.seen ? "unseen" : "seen") : (first.flagged ? "unflag" : "flag"));
    }
    const m = S.msgs.find((x) => x.uid === S.sel); if (!m) { msg("pick an email first", true); return; }
    const val = !m[k]; m[k] = val; paintList(); paintFolders(); badge();
    try { await api("POST", `/api/mail/${S.acc}/flags`, { folder: S.folder, uid: m.uid, [k]: val }); }
    catch (e) { m[k] = !val; paintList(); msg("✗ " + e.message, true); }
  }
  function schedule() {
    if (S.timer) { clearInterval(S.timer); S.timer = 0; }
    if (!S.accounts.length) return;
    const min = Math.max(1, S.settings.check_min || 5);
    S.timer = setInterval(checkInbox, min * 60000);
  }

  /* ---------------------------------------------------------------- wiring */
  function boot() {
    if (S.booted) return; S.booted = true;
    loadAccounts().then(async () => {
      if (!S.acc) return;
      try { await loadFolders(false); } catch (e) { msg("✗ " + e.message, true); return; }
      const inbox = S.folders.find((f) => f.special === "inbox");
      await openFolder(store.get("folder." + S.acc) || (inbox && inbox.path) || "INBOX");
    }).catch((e) => msg("✗ " + e.message, true));
  }
  function seen() { const d = $("maildock"); return d && !d.classList.contains("dockgone"); }
  function wire() {
    const d = $("maildock"); if (!d) return;
    // the first time it is here it starts HIDDEN (the ✉ button on the top bar shows it) - like the Sketcher
    try { if (root.localStorage.getItem("h3.g.maildock") == null) { root.localStorage.setItem("h3.g.maildock", "1"); d.classList.add("dockgone"); } } catch (e) { /* fine */ }
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    on("mlCloseBtn", "click", (e) => { e.stopPropagation(); if (typeof root.toggleDockGone === "function") root.toggleDockGone("maildock", "tX_maildock"); });
    on("mlAccSel", "change", async (e) => { S.acc = e.target.value; store.set("acc", S.acc); S.folders = []; S.msgs = []; paintList(); try { await loadFolders(false); await openFolder((S.folders.find((f) => f.special === "inbox") || {}).path || "INBOX"); } catch (er) { msg("✗ " + er.message, true); } });
    on("mlFolders", "click", (e) => {
      if (e.target.closest("#mlNewFolder")) { newFolder(e.shiftKey); return; }
      const f = e.target.closest(".mlf"); if (f) { store.set("folder." + S.acc, f.dataset.path); openFolder(f.dataset.path); }
    });
    on("mlList", "click", (e) => {
      if (e.target.closest("#mlOlder")) { older(); return; }
      const r = e.target.closest(".mlrow"); if (!r) return;
      const uid = parseInt(r.dataset.uid, 10);
      if (e.ctrlKey || e.metaKey) {                    // 2.820.0: Ctrl-click adds / takes away
        if (!S.picks.size && S.sel) S.picks.add(S.sel);
        if (S.picks.has(uid)) S.picks.delete(uid); else S.picks.add(uid);
        S.anchor = uid; paintList(); return;
      }
      if (e.shiftKey && (S.anchor || S.sel)) {         // Shift-click: every email between
        const L = shown().map((m) => m.uid), a = L.indexOf(S.anchor || S.sel), b = L.indexOf(uid);
        if (a >= 0 && b >= 0) { S.picks = new Set(L.slice(Math.min(a, b), Math.max(a, b) + 1)); paintList(); return; }
      }
      S.picks.clear(); S.anchor = uid;
      select(uid); $("mlList").focus({ preventScroll: true });
    });
    on("mlList", "dragstart", (e) => {
      const r = e.target.closest(".mlrow"); if (!r) return;
      const uid = parseInt(r.dataset.uid, 10), uids = S.picks.has(uid) && S.picks.size > 1 ? [...S.picks] : [uid];
      e.dataTransfer.setData("text/x-bitgen-mail", JSON.stringify(uids)); e.dataTransfer.effectAllowed = "move";
    });
    on("mlFolders", "dragover", (e) => { const f = e.target.closest(".mlf"); if (f && [...e.dataTransfer.types].includes("text/x-bitgen-mail") && f.dataset.path !== S.folder) { e.preventDefault(); f.classList.add("drop"); } });
    on("mlFolders", "dragleave", (e) => { const f = e.target.closest(".mlf"); if (f) f.classList.remove("drop"); });
    on("mlFolders", "drop", (e) => {
      const f = e.target.closest(".mlf"); if (!f) return; f.classList.remove("drop");
      let uids = []; try { uids = JSON.parse(e.dataTransfer.getData("text/x-bitgen-mail") || "[]"); } catch (er) { return; }
      e.preventDefault(); if (uids.length) moveTo(f.dataset.path, uids);
    });
    on("mlMove", "click", (e) => moveMenu(e.currentTarget));
    on("mlSearch", "keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); serverSearch(e.target.value); } });
    on("mlSearchBar", "click", (e) => { if (e.target.closest("#mlSearchOff")) openFolder(S.folder, true); });
    on("mlList", "keydown", (e) => {
      if (e.key === "Delete") { e.preventDefault(); del(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) { e.preventDefault(); S.picks = new Set(shown().map((m) => m.uid)); paintList(); return; }
      if (e.key === "Escape" && S.picks.size) { e.preventDefault(); S.picks.clear(); paintList(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const L = shown(), i = L.findIndex((m) => m.uid === S.sel), n = L[e.key === "ArrowDown" ? Math.min(L.length - 1, i + 1) : Math.max(0, i - 1)];
      if (n && n.uid !== S.sel) { select(n.uid); const row = $("mlList").querySelector(`[data-uid="${n.uid}"]`); if (row) row.scrollIntoView({ block: "nearest" }); }
    });
    on("mlRead", "click", (e) => {
      const t = e.target.closest("button"); if (!t) return;
      if (t.id === "mlSumBtn") summarise();
      else if (t.id === "mlDraft") reply("reply", true);
      else if (t.id === "mlDraftAll") reply("all", true);
      else if (t.id === "mlPicsBtn") { S.remote = true; paintRead(); }
    });
    on("mlRead", "change", (e) => { if (e.target.id === "mlTone") store.set("tone", e.target.value); });
    on("mlShow", "change", paintList); on("mlSort", "change", paintList); on("mlSearch", "input", paintList);
    on("mlSync", "click", () => sync());
    on("mlFlagAll", "click", (e) => flagAi(e.shiftKey));
    on("mlAuto", "change", async (e) => { S.settings.auto_flag = e.target.checked; try { await api("POST", "/api/mail/settings", { auto_flag: e.target.checked }); } catch (er) { msg("✗ " + er.message, true); } });
    on("mlNew", "click", () => { const a = accNow(); C().open({ kind: "new", acc: S.acc, me: a && a.email }); });
    on("mlReply", "click", () => reply("reply"));
    on("mlReplyAll", "click", () => reply("all"));
    on("mlFwd", "click", () => reply("forward"));
    on("mlDel", "click", del);
    on("mlStar", "click", () => toggle("flagged"));
    on("mlUnread", "click", () => toggle("seen"));
    const acct = () => root.H3MailAccounts && root.H3MailAccounts.open(S.acc);
    on("mlAccBtn", "click", acct); on("mlAddFirst", "click", () => root.H3MailAccounts && root.H3MailAccounts.open(null));
    // booted the first time it is on screen (a hidden docker asks the server nothing) - and the accounts are read at start
    // so the ✉ button's count and the checking work while it is closed
    if (window.MutationObserver) new MutationObserver(() => { if (seen()) boot(); }).observe(d, { attributes: true, attributeFilter: ["class"] });
    if (seen()) boot();
    else loadAccounts().then(() => { if (S.acc) checkInbox(); }).catch(() => {});
  }
  /** after the accounts dialog saved / removed one */
  async function accountsChanged(pick) {
    const had = S.acc;
    await loadAccounts(pick);
    if (!S.acc) { S.folders = []; S.msgs = []; S.body = null; paintFolders(); paintList(); paintRead(); return; }
    if (S.acc !== had || !S.folders.length) { S.booted = true; await loadFolders(true); await openFolder((S.folders.find((f) => f.special === "inbox") || {}).path || "INBOX"); }
    else paintFolders();
  }
  root.H3Mail = { S, api, msg, sync, select, openFolder, flagAi, summarise, accountsChanged, loadAccounts, paintList, paintRead, toneOptions, accNow, boot, badge, checkInbox, batch, moveTo, serverSearch, older, newFolder };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else setTimeout(wire, 0);
})(window);
