/* bitGen Studio — static/community.js (2.710.0): 💬 THE bitGen COMMUNITY - a little chat panel, like Facebook's
 * (window.H3Community).
 *
 * Tim: "i would like to make bitgen a community, can we add a little chat to bitgen like fb - if a user adds a user id
 * to bitgen they join the community and can add other users as friends, first they ask, then if approved they become
 * friends. this should enable people to get help" - the server is PHP on his Tiger Art hosting (community/, its
 * contract community/API.md); this page talks only to bitGen's own server (routes/community.js -> lib/community.js),
 * which keeps the user's token.
 *
 *   💬 Community (the status bar)   opens / closes the panel (bottom right); its badge = unread messages + friend requests
 *   not joined     a user ID + display name + password: Join (a new ID) or Sign in (one you have); the server's address
 *   Help           the public room every member is in - ask, answer; a name -> + Add friend; ⚑ report a message
 *   Friends        search people by ID / name -> + Add friend (they are asked; when they accept you are friends);
 *                  requests to you: ✓ Accept / ✕ Decline; yours waiting: cancel; your friends (● online) -> 💬 chat,
 *                  remove, block
 *   a friend's tab  your private chat with them
 *   ⋯              sign out, leave the community (deletes your ID), the server's address
 * New messages come every few seconds while the panel is open (every 20 s while it is closed - for the badge).
 * Everything people write is shown as text, never as HTML - and never translated (data-noi18n: a message "Save" stays
 * "Save" in a Chinese / Japanese bitGen).
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const OPEN_MS = 4000, CLOSED_MS = 20000;
  const S = { me: null, admin: false, since: 0, at: null, msgs: new Map(), friends: [], incoming: [], outgoing: [], view: "help", dms: [], unread: {}, timer: 0, rules: "", busy: false, joined: false, url: "" };
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (k === "class") e.className = v; else e.setAttribute(k, v === true ? "" : v); }
    for (const c of [].concat(kids || [])) if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return e;
  }
  async function api(u, body) {
    const r = await fetch(u, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let j; try { j = await r.json(); } catch (e) { j = { ok: false, error: "no answer" }; }
    if (j && j.signedOut) { S.joined = false; render(); }
    return j;
  }
  const call = (a, b) => api("/api/community/call/" + a, b || {});
  const time = (iso) => { try { const d = new Date(iso); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + (new Date().toDateString() === d.toDateString() ? "" : " " + d.toLocaleDateString()); } catch (e) { return ""; } };
  const roomOf = (m) => (m.room === "help" ? "help" : "@" + (m.from === (S.me && S.me.handle) ? m.to : m.from));
  function say(t, bad) { const m = $("cmMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } }
  function badge() {
    const b = $("tCm"); if (!b) return;
    const n = Object.values(S.unread).reduce((a, x) => a + x, 0) + S.incoming.length;
    let s = b.querySelector(".cmbadge"); if (!s) { s = el("span", { class: "cmbadge" }); b.appendChild(s); }
    s.textContent = n > 99 ? "99+" : String(n); s.hidden = !n;
  }

  /* ---------------- the panel ---------------- */
  function panel() {
    let p = $("cmPanel"); if (p) return p;
    p = el("div", { id: "cmPanel", class: "cmpanel", role: "dialog", "aria-label": "bitGen Community", hidden: true });
    p.appendChild(el("div", { class: "cmhead" }, [el("b", { text: "💬 bitGen Community" }), el("span", { id: "cmWho", class: "cmwho", "data-noi18n": true }),
      el("button", { type: "button", class: "ghost", id: "cmMore", title: "Sign out, leave the community, the server's address", text: "⋯", onclick: more }),
      el("button", { type: "button", class: "ghost", title: "Close", "aria-label": "Close", text: "✕", onclick: () => toggle(false) })]));
    p.appendChild(el("div", { id: "cmTabs", class: "cmtabs", role: "tablist" }));
    p.appendChild(el("div", { id: "cmBody", class: "cmbody" }));
    p.appendChild(el("div", { id: "cmMsg", class: "hint cmmsg", "aria-live": "polite" }));
    document.body.appendChild(p);
    return p;
  }
  function style() {
    if ($("cmStyle")) return;
    document.head.appendChild(el("style", { id: "cmStyle", text:
      ".cmpanel{position:fixed;right:12px;bottom:34px;width:360px;height:500px;max-height:calc(100vh - 60px);z-index:9000;display:flex;flex-direction:column;background:var(--panel,#1d1a15);color:var(--text,#e8e2d6);border:1px solid var(--line,#3a342a);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.45);font-size:13px}"
      + ".cmpanel[hidden]{display:none}.cmhead{display:flex;align-items:center;gap:6px;padding:7px 9px;border-bottom:1px solid var(--line,#3a342a)}.cmhead b{flex:1}.cmwho{color:var(--dim,#9a917f);font-size:12px}"
      + ".cmtabs{display:flex;gap:2px;padding:4px 6px 0;overflow-x:auto;border-bottom:1px solid var(--line,#3a342a)}.cmtabs button{border:0;border-bottom:2px solid transparent;border-radius:0;padding:4px 8px;background:none;color:var(--dim,#9a917f);white-space:nowrap}.cmtabs button.on{color:var(--text,#e8e2d6);border-bottom-color:var(--tiger,#f59e2c)}.cmtabs .n{margin-left:4px;background:var(--tiger,#f59e2c);color:#000;border-radius:8px;padding:0 5px;font-size:11px}"
      + ".cmbody{flex:1;min-height:0;display:flex;flex-direction:column}.cmlist{flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:6px}.cmm{max-width:85%;align-self:flex-start;background:var(--panel-2,#26221b);border-radius:9px;padding:5px 8px}.cmm.mine{align-self:flex-end;background:color-mix(in srgb,var(--tiger,#f59e2c) 22%,var(--panel-2,#26221b))}"
      + ".cmm .who{font-weight:600;cursor:pointer}.cmm .when{color:var(--dim,#9a917f);font-size:11px;margin-left:6px}.cmm .txt{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:2px}.cmm .act{float:right;opacity:.5;margin-left:6px;cursor:pointer;background:none;border:0;color:inherit;padding:0}.cmm .act:hover{opacity:1}"
      + ".cmsend{display:flex;gap:6px;padding:6px;border-top:1px solid var(--line,#3a342a)}.cmsend textarea{flex:1;resize:none;height:38px}.cmpad{padding:8px 10px;overflow-y:auto}.cmpad label{display:block;margin:6px 0 2px;color:var(--dim,#9a917f)}.cmpad input{width:100%;box-sizing:border-box}"
      + ".cmrow{display:flex;align-items:center;gap:6px;padding:3px 0}.cmrow .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cmdot{width:8px;height:8px;border-radius:50%;background:var(--dim,#9a917f);flex:none}.cmdot.on{background:var(--ok,#7fb069)}"
      + ".cmsec{margin:10px 0 4px;font-weight:600}.cmmsg{padding:3px 9px 6px;min-height:16px}.cmmsg.bad{color:var(--bad,#d1553f)}.cmrules{white-space:pre-wrap;color:var(--dim,#9a917f);font-size:12px;margin-top:8px}"
      + "#tCm{position:relative}#tCm .cmbadge{position:absolute;top:-4px;right:-4px;background:var(--bad,#d1553f);color:#fff;border-radius:8px;font-size:10px;padding:0 4px;line-height:14px}" }));
  }
  function tabs() {
    const t = $("cmTabs"); t.textContent = "";
    if (!S.joined) return;
    const add = (id, label, n) => t.appendChild(el("button", { type: "button", role: "tab", class: S.view === id ? "on" : "", "aria-selected": S.view === id ? "true" : "false", onclick: () => show(id) },
      [label, n ? el("span", { class: "n", text: String(n) }) : null]));
    add("help", "Help", S.unread.help);
    add("friends", "Friends", S.incoming.length);
    for (const h of S.dms) { const f = S.friends.find((x) => x.handle === h); add("@" + h, el("span", { "data-noi18n": true, text: (f && f.display) || h }), S.unread["@" + h]); }
  }
  function render() {
    panel(); tabs(); badge();
    $("cmWho").textContent = S.joined && S.me ? S.me.display + " (@" + S.me.handle + ")" : "";
    const b = $("cmBody"); b.textContent = "";
    if (!S.joined) return joinView(b);
    if (S.view === "friends") return friendsView(b);
    chatView(b, S.view);
  }
  function show(view) {
    S.view = view; if (view.startsWith("@") && !S.dms.includes(view.slice(1))) S.dms.push(view.slice(1));
    S.unread[view] = 0; render();
    if (view === "help" || view.startsWith("@")) loadHistory(view);
  }

  /* ---------------- join / sign in ---------------- */
  function joinView(b) {
    const pad = el("div", { class: "cmpad" });
    pad.appendChild(el("div", { text: "Join the bitGen Community: ask for help in the Help room, and add friends to chat with." }));
    const f = (id, label, type, ph) => [el("label", { for: id, text: label }), el("input", { id, type, placeholder: ph || "", autocomplete: type === "password" ? "current-password" : "off", spellcheck: "false" })];
    pad.append(...f("cmHandle", "User ID (3-24 letters, numbers, _ . -)", "text", "your_id"), ...f("cmDisplay", "Display name (for a new ID)", "text", ""), ...f("cmPass", "Password (8 or more characters)", "password", ""));
    const go = (mode) => async () => {
      say(mode === "register" ? "joining…" : "signing in…");
      const j = await api("/api/community/join", { mode, handle: $("cmHandle").value, password: $("cmPass").value, display: $("cmDisplay").value, url: $("cmUrl").value });
      if (!j.ok) return say(j.error || "could not join", true);
      $("cmPass").value = ""; say(""); await start(true);
    };
    pad.appendChild(el("div", { class: "rowbtns", style: "margin-top:10px;gap:6px" }, [el("button", { type: "button", id: "cmJoin", text: "Join", title: "Make this user ID and join", onclick: go("register") }),
      el("button", { type: "button", class: "ghost", id: "cmSignIn", text: "Sign in", title: "Use a user ID you already have", onclick: go("login") })]));
    const det = el("details", { style: "margin-top:10px" }, [el("summary", { text: "Community server" }), el("input", { id: "cmUrl", type: "text", spellcheck: "false", value: S.url })]);
    pad.appendChild(det);
    pad.appendChild(el("div", { id: "cmRules", class: "cmrules", text: S.rules }));
    b.appendChild(pad);
  }

  /* ---------------- chat (Help or a friend) ---------------- */
  function msgEl(m) {
    const mine = S.me && m.from === S.me.handle;
    const who = el("span", { class: "who", "data-noi18n": mine ? null : true, text: mine ? "You" : (m.from_display || m.from), title: "@" + m.from, onclick: mine ? null : () => person(m.from, m.from_display) });
    const acts = [];
    if (!mine) acts.push(el("button", { type: "button", class: "act", title: "Report this message to the admins", "aria-label": "Report", text: "⚑", onclick: () => report(m) }));
    if (S.admin) acts.push(el("button", { type: "button", class: "act", title: "Delete this message (admin)", "aria-label": "Delete", text: "🗑", onclick: () => adminDelete(m) }));
    return el("div", { class: "cmm" + (mine ? " mine" : ""), "data-id": String(m.id) }, [...acts, who, el("span", { class: "when", text: time(m.at) }), el("div", { class: "txt", "data-noi18n": true, text: m.body })]);
  }
  function chatView(b, room) {
    const list = el("div", { id: "cmList", class: "cmlist", "aria-live": "polite" });
    const ms = [...S.msgs.values()].filter((m) => roomOf(m) === room).sort((a, c) => a.id - c.id);
    if (!ms.length) list.appendChild(el("div", { class: "hint", text: room === "help" ? "No messages yet - ask the first question." : "Say hello." }));
    ms.forEach((m) => list.appendChild(msgEl(m)));
    const ta = el("textarea", { id: "cmText", maxlength: "2000", placeholder: room === "help" ? "Ask the community… (Enter sends, Shift+Enter a new line)" : "Message… (Enter sends)" });
    ta.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    b.append(list, el("div", { class: "cmsend" }, [ta, el("button", { type: "button", id: "cmSend", text: "Send", onclick: send })]));
    list.scrollTop = list.scrollHeight;
  }
  async function send() {
    const ta = $("cmText"); const body = (ta.value || "").trim(); if (!body || S.busy) return;
    S.busy = true;
    const j = await call("send", { to: S.view === "help" ? "help" : S.view.slice(1), body });
    S.busy = false;
    if (!j.ok) return say(j.error || "not sent", true);
    ta.value = ""; say(""); if (j.message) S.msgs.set(j.message.id, j.message); render(); const t = $("cmText"); if (t) t.focus();
  }
  async function loadHistory(room) {
    const j = await call("history", { room: room === "help" ? "help" : room.slice(1), limit: 80 });
    if (j.ok) { for (const m of j.messages || []) S.msgs.set(m.id, m); if (S.view === room) render(); }
  }
  function report(m) {                     // a reason box under the message (no browser dialogs)
    const box = document.querySelector(`#cmList .cmm[data-id="${m.id}"]`); if (!box || box.querySelector(".cmrep")) return;
    const inp = el("input", { type: "text", maxlength: "500", placeholder: "Why? (the admins see it)" });
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") go(); if (e.key === "Escape") rep.remove(); });
    const go = async () => { const reason = inp.value.trim(); if (!reason) return; const j = await call("report", { id: m.id, reason }); rep.remove(); say(j.ok ? "reported - thank you" : (j.error || "not reported"), !j.ok); };
    const rep = el("div", { class: "cmrep rowbtns", style: "gap:4px;margin-top:4px" }, [inp, btn("Report", "Send to the admins", go), btn("✕", "Cancel", () => rep.remove())]);
    box.appendChild(rep); inp.focus();
  }
  async function adminDelete(m) {
    const j = await call("admin_delete", { id: m.id }); if (j.ok) { S.msgs.delete(m.id); render(); } else say(j.error, true);
  }

  /* ---------------- friends ---------------- */
  function rel(h) {
    if (S.friends.some((f) => f.handle === h)) return "friend";
    if (S.outgoing.some((f) => f.handle === h)) return "requested";
    if (S.incoming.some((f) => f.handle === h)) return "incoming";
    return "none";
  }
  function person(h, display) {          // a name clicked in the Help room
    S.view = "friends"; render();
    const q = $("cmFind"); if (q) { q.value = h; find(); }
    say(rel(h) === "friend" ? "already your friend" : "");
  }
  function row(u, btns) { return el("div", { class: "cmrow", "data-handle": u.handle }, [el("span", { class: "cmdot" + (u.online ? " on" : ""), title: u.online ? "online" : "away" }), el("span", { class: "nm", "data-noi18n": true, title: "@" + u.handle, text: (u.display || u.handle) + "  @" + u.handle }), ...btns]); }
  const btn = (text, title, fn, cls) => el("button", { type: "button", class: cls || "ghost", title, text, onclick: fn });
  function relBtns(u) {
    const r = u.relation || rel(u.handle);
    if (r === "friend") return [btn("💬", "Chat", () => show("@" + u.handle))];
    if (r === "requested") return [el("span", { class: "hint", text: "asked" }), btn("✕", "Cancel your request", () => act("friend_remove", u.handle))];
    if (r === "incoming") return [btn("✓ Accept", "You become friends", () => respond(u.handle, true), ""), btn("✕ Decline", "Say no to the request", () => respond(u.handle, false))];
    return [btn("+ Add friend", "Ask to be friends", () => act("friend_request", u.handle))];
  }
  function friendsView(b) {
    const pad = el("div", { class: "cmpad" });
    const q = el("input", { id: "cmFind", type: "search", placeholder: "Find people by user ID or name", spellcheck: "false" });
    q.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") find(); });
    pad.append(el("div", { class: "rowbtns", style: "gap:6px" }, [q, btn("Find", "Search", find)]), el("div", { id: "cmFound" }));
    if (S.incoming.length) { pad.appendChild(el("div", { class: "cmsec", text: "Friend requests" })); S.incoming.forEach((u) => pad.appendChild(row(u, relBtns(Object.assign({ relation: "incoming" }, u))))); }
    if (S.outgoing.length) { pad.appendChild(el("div", { class: "cmsec", text: "Waiting for them" })); S.outgoing.forEach((u) => pad.appendChild(row(u, relBtns(Object.assign({ relation: "requested" }, u))))); }
    pad.appendChild(el("div", { class: "cmsec", text: "Friends" }));
    if (!S.friends.length) pad.appendChild(el("div", { class: "hint", text: "No friends yet - find someone, or + Add friend from a name in the Help room." }));
    S.friends.forEach((u) => pad.appendChild(row(u, [btn("💬", "Chat", () => show("@" + u.handle)), btn("Remove", "Not friends any more", () => act("friend_remove", u.handle)), btn("Block", "They cannot message or ask you, and their Help messages are hidden", () => act("block", u.handle))])));
    b.appendChild(pad);
  }
  async function find() {
    const q = ($("cmFind") || {}).value || ""; const out = $("cmFound"); if (!out) return;
    out.textContent = ""; if (q.trim().length < 2) return;
    const j = await call("search", { q: q.trim() });
    if (!j.ok) return say(j.error, true);
    const us = (j.users || []).filter((u) => !S.me || u.handle !== S.me.handle);
    if (!us.length) out.appendChild(el("div", { class: "hint", text: "nobody found" }));
    us.forEach((u) => out.appendChild(row(u, relBtns(u))));
  }
  async function act(action, handle) {
    const j = await call(action, { handle });
    if (!j.ok) return say(j.error || "refused", true);
    if (action === "block" || action === "friend_remove") { S.dms = S.dms.filter((h) => h !== handle); if (S.view === "@" + handle) S.view = "friends"; }
    await loadFriends(); render(); if (($("cmFind") || {}).value) find();
    say(action === "friend_request" ? (j.status === "friends" ? "you are friends now" : "asked - you are friends when they accept") : action === "block" ? "blocked" : "");
  }
  async function respond(handle, accept) {
    const j = await call("friend_respond", { handle, accept });
    if (!j.ok) return say(j.error, true);
    say(accept ? "you are friends now" : "declined"); await loadFriends(); render();
  }
  async function loadFriends() {
    const j = await call("friends"); if (!j.ok) return;
    S.friends = j.friends || []; S.incoming = j.incoming || []; S.outgoing = j.outgoing || [];
  }

  /* ---------------- ⋯ ---------------- */
  function more() {
    const b = $("cmBody"); b.textContent = "";
    const pad = el("div", { class: "cmpad" });
    if (S.joined) {
      pad.append(el("div", {}, [el("span", { text: "Signed in as" }), " ", el("b", { "data-noi18n": true, text: S.me ? S.me.display + " (@" + S.me.handle + ")" : "" })]),
        el("div", { class: "rowbtns", style: "margin-top:8px;gap:6px" }, [btn("Sign out", "Sign out on this computer (your ID stays)", async () => { await api("/api/community/signout", {}); S.joined = false; S.msgs.clear(); render(); })]));
      pad.append(el("div", { class: "cmsec", text: "Leave the community" }), el("div", { class: "hint", text: "Deletes your user ID and friendships. Type your password:" }),
        el("input", { id: "cmLeavePass", type: "password", autocomplete: "current-password" }),
        el("div", { class: "rowbtns", style: "margin-top:6px" }, [btn("Leave and delete my ID", "Cannot be undone", async () => {
          const j = await api("/api/community/leave", { password: $("cmLeavePass").value }); if (!j.ok) return say(j.error, true);
          S.joined = false; S.me = null; S.msgs.clear(); S.friends = []; say("you left the community"); render(); }, "")]));
    }
    if (S.joined && S.admin) {           // the admins: what people reported - delete the message, ban the writer
      const box = el("div", { id: "cmReports" }, [el("div", { class: "hint", text: "loading…" })]);
      pad.append(el("div", { class: "cmsec", text: "Reports (admin)" }), box);
      call("admin_reports").then((j) => {
        box.textContent = "";
        const rs = (j && j.reports) || []; if (!rs.length) { box.appendChild(el("div", { class: "hint", text: "nothing reported" })); return; }
        for (const r of rs) {
          const m = r.message || {};
          box.appendChild(el("div", { class: "cmm", "data-report": String(r.id) }, [
            el("div", { "data-noi18n": true, text: "@" + (m.from || "?") + ": " + (m.body || "") }),
            el("div", { class: "hint" }, [el("span", { text: "reported by" }), " ", el("span", { "data-noi18n": true, text: "@" + (r.reporter || "?") + " - " + (r.reason || "") })]),
            el("div", { class: "rowbtns", style: "gap:4px;margin-top:4px" }, [
              btn("Delete message", "Remove it for everyone", async () => { const x = await call("admin_delete", { id: m.id }); say(x.ok ? "deleted" : x.error, !x.ok); if (x.ok) { S.msgs.delete(m.id); more(); } }),
              m.from ? btn("Ban the writer", "They cannot sign in any more; their messages are hidden", async () => { const x = await call("admin_ban", { handle: m.from, banned: true }); say(x.ok ? "banned" : x.error, !x.ok); }) : null])]));
        }
      });
    }
    pad.append(el("div", { class: "cmsec", text: "Community server" }), el("input", { id: "cmUrl2", type: "text", value: S.url, spellcheck: "false" }),
      el("div", { class: "rowbtns", style: "margin-top:6px;gap:6px" }, [btn("Use this address", "The community server's api.php", async () => {
        const j = await api("/api/community/url", { url: $("cmUrl2").value }); if (!j.ok) return say(j.error, true); S.url = j.url; S.joined = j.joined; say("address kept"); render(); }), btn("Back", "", render)]));
    b.appendChild(pad);
  }

  /* ---------------- polling ---------------- */
  async function poll() {
    clearTimeout(S.timer);
    const open = !$("cmPanel") || !$("cmPanel").hidden;
    try {
      if (S.joined) {
        const j = await call("poll", { since: S.since, at: S.at });
        if (j.ok) {
          for (const id of j.deleted || []) S.msgs.delete(id);
          for (const m of j.messages || []) {
            const isNew = !S.msgs.has(m.id) && S.since > 0; S.msgs.set(m.id, m); S.since = Math.max(S.since, m.id);
            const r = roomOf(m);
            if (r.startsWith("@") && !S.dms.includes(r.slice(1))) S.dms.push(r.slice(1));
            if (isNew && !(S.me && m.from === S.me.handle) && !(open && S.view === r)) S.unread[r] = (S.unread[r] || 0) + 1;
          }
          S.at = j.now || S.at;
          if ((j.incoming || 0) !== S.incoming.length) await loadFriends();
          if (open) render(); else badge();
        }
      }
    } catch (e) { /* offline - try again later */ }
    S.timer = setTimeout(poll, open ? OPEN_MS : CLOSED_MS);
  }
  async function start(fresh) {
    const st = await api("/api/community"); S.url = st.url || ""; S.joined = !!st.joined;
    const info = await call("info"); S.rules = info && info.ok ? info.rules || "" : "";
    if (S.joined) {
      const me = await call("me");
      if (me.ok) { S.me = me.user; S.admin = !!me.admin; } else S.joined = false;
    }
    if (S.joined) { await loadFriends(); const h = await call("history", { room: "help", limit: 80 }); if (h.ok) for (const m of h.messages || []) { S.msgs.set(m.id, m); S.since = Math.max(S.since, m.id); } }
    if (fresh) S.view = "help";
    render(); poll();
  }
  function toggle(on) {
    const p = panel(); p.hidden = on === undefined ? !p.hidden : !on;
    $("tCm").classList.toggle("on", !p.hidden);
    if (!p.hidden) { S.unread[S.view] = 0; render(); poll(); }
  }
  function boot() {
    style();
    const sb = $("statusbar"); if (!sb || $("tCm")) return;
    const b = el("button", { id: "tCm", type: "button", title: "bitGen Community - ask for help, chat with friends", text: "💬 Community", onclick: () => toggle() });
    const after = $("tQ"); if (after && after.parentNode === sb) after.after(b); else sb.appendChild(b);
    panel(); start(false);
  }
  window.H3Community = { toggle, show, state: () => S, refresh: () => start(false) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
