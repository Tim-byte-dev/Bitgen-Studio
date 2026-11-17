/* ext/maildock/mailaccounts.js — ✉ MAIL (2.818.0): ⚙ ACCOUNTS, window.H3MailAccounts.
 *
 * An account = the address, the name people see, the user name + password (or app password - kept encrypted in
 * settings/keys.json, never shown again), the incoming (IMAP) and outgoing (SMTP) servers - filled in from the address for
 * the big services (lib/mailStore.js PRESETS), ✓ Test logs in to both (sends nothing), a signature. Below: the AI's "what
 * matters to me" (the flagging reads it), ☐ flag new mail by itself, check every N minutes.
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const M = () => root.H3Mail, V = () => root.H3MailView;
  let cur = null, touchedServers = false;

  function amsg(t, bad) { const m = $("mlAMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } }
  function accounts() { return (M() && M().S.accounts) || []; }
  function fillPick() {
    const v = V();
    $("mlAPick").innerHTML = accounts().map((a) => `<option value="${v.esc(a.id)}">${v.esc(a.name === a.email ? a.email : a.name + " - " + a.email)}</option>`).join("") + `<option value="">＋ New account</option>`;
    $("mlAPick").value = cur || "";
  }
  function setServers(p) {
    $("mlAImapHost").value = p.imap.host || ""; $("mlAImapPort").value = p.imap.port || ""; $("mlAImapSsl").checked = p.imap.secure !== false;
    $("mlASmtpHost").value = p.smtp.host || ""; $("mlASmtpPort").value = p.smtp.port || ""; $("mlASmtpSsl").checked = p.smtp.secure !== false;
  }
  function load(id) {
    cur = id || null; touchedServers = false;
    const a = accounts().find((x) => x.id === cur);
    $("mlAEmail").value = a ? a.email : ""; $("mlAName").value = a ? (a.name === a.email ? "" : a.name) : ""; $("mlAUser").value = a ? (a.user === a.email ? "" : a.user) : "";
    $("mlAPass").value = ""; $("mlAPass").placeholder = a && a.has_pass ? "unchanged - type a new one to change it" : "password or app password";
    setServers(a ? { imap: a.imap, smtp: a.smtp } : { imap: { host: "", port: 993, secure: true }, smtp: { host: "", port: 465, secure: true } });
    $("mlATls").checked = a ? a.tls_check !== false : true; $("mlASent").checked = a ? a.save_sent !== false : true;
    $("mlASig").value = a ? a.sig || "" : "";
    $("mlARemove").hidden = !a; $("mlASave").textContent = a ? "💾 Save account" : "＋ Add account";
    fillPick(); amsg("");
    noteFor($("mlAEmail").value);
  }
  async function noteFor(email, fill) {
    const n = $("mlANote"); if (!n) return;
    if (!/@.+\./.test(email || "")) return;
    try {
      const p = await M().api("GET", "/api/mail/preset?email=" + encodeURIComponent(email));
      if (fill && !touchedServers) { setServers(p); if (p.sent_auto) $("mlASent").checked = false; }
      n.innerHTML = (p.known ? `<b>${V().esc(p.name)}</b>: the servers are filled in. ` : "Servers guessed from the address - check them with your provider. ")
        + (p.app ? `<b>${V().esc(p.name)} needs an app password</b> (made in your account's security settings) - your normal password is refused. ` : "")
        + "The password is kept encrypted on this computer (settings/keys.json) and never shown again.";
    } catch (e) { /* the fields stay as typed */ }
  }
  function fields() {
    return {
      email: $("mlAEmail").value.trim(), name: $("mlAName").value.trim(), user: $("mlAUser").value.trim(), pass: $("mlAPass").value,
      imap: { host: $("mlAImapHost").value.trim(), port: parseInt($("mlAImapPort").value, 10) || undefined, secure: $("mlAImapSsl").checked },
      smtp: { host: $("mlASmtpHost").value.trim(), port: parseInt($("mlASmtpPort").value, 10) || undefined, secure: $("mlASmtpSsl").checked },
      tls_check: $("mlATls").checked, save_sent: $("mlASent").checked, sig: $("mlASig").value,
    };
  }
  async function test() {
    amsg("✓ Logging in to both servers…");
    try {
      const r = await M().api("POST", "/api/mail/test", Object.assign(fields(), cur ? { id: cur } : {}));
      const i = r.imap || {}, s = r.smtp || {};
      amsg((i.ok ? `Incoming ✓ (${i.folders} folders${i.inbox != null ? ", " + i.inbox + " in the inbox" : ""})` : "Incoming ✗ " + i.error) + "\n" + (s.ok ? "Outgoing ✓" : "Outgoing ✗ " + s.error), !r.ok);
    } catch (e) { amsg("✗ " + e.message, true); }
  }
  async function save() {
    const f = fields();
    if (!cur && !f.pass) { amsg("type the password (or app password)", true); $("mlAPass").focus(); return; }
    amsg("💾 Saving…");
    try {
      const a = await M().api("POST", cur ? "/api/mail/accounts/" + cur : "/api/mail/accounts", f);
      cur = a.id; await M().accountsChanged(a.id); load(a.id);
      amsg("💾 saved - " + a.email + (f.pass ? " (the password is encrypted)" : ""));
    } catch (e) { amsg("✗ " + e.message, true); }
  }
  async function remove() {
    const a = accounts().find((x) => x.id === cur); if (!a) return;
    if (typeof root.appConfirm === "function" && !(await root.appConfirm(`Remove ${a.email} from bitGen? Its mail on the server stays; the copy on this computer and the saved password are deleted.`, "Remove the account"))) return;
    try { await M().api("DELETE", "/api/mail/accounts/" + cur); await M().accountsChanged(null); load((accounts()[0] || {}).id || null); amsg("🗑 removed"); }
    catch (e) { amsg("✗ " + e.message, true); }
  }
  async function saveSettings() {
    try {
      const s = await M().api("POST", "/api/mail/settings", { important: $("mlSImp").value, auto_flag: $("mlSAuto").checked, check_min: parseInt($("mlSMin").value, 10) || 5 });
      await M().loadAccounts(); amsg(`💾 settings saved - checking every ${s.check_min} min${s.auto_flag ? ", ✨ new mail flagged by the AI" : ""}`);
    } catch (e) { amsg("✗ " + e.message, true); }
  }
  function open(id) {
    const d = $("mlAcctDlg"); if (!d) return;
    const st = (M() && M().S.settings) || {};
    $("mlSImp").value = st.important || ""; $("mlSAuto").checked = !!st.auto_flag; $("mlSMin").value = st.check_min || 5;
    load(id === undefined ? (M() && M().S.acc) : id);
    if (!d.open) d.showModal();
    setTimeout(() => $(cur ? "mlAName" : "mlAEmail").focus(), 30);
  }
  function wire() {
    const d = $("mlAcctDlg"); if (!d) return;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    on("mlAPick", "change", (e) => load(e.target.value || null));
    on("mlAEmail", "change", (e) => noteFor(e.target.value.trim(), !cur));
    ["mlAImapHost", "mlAImapPort", "mlASmtpHost", "mlASmtpPort"].forEach((id) => on(id, "input", () => { touchedServers = true; }));
    on("mlAImapSsl", "change", (e) => { const p = $("mlAImapPort"); if (p.value === "993" || p.value === "143" || !p.value) p.value = e.target.checked ? 993 : 143; });
    on("mlASmtpSsl", "change", (e) => { const p = $("mlASmtpPort"); if (p.value === "465" || p.value === "587" || !p.value) p.value = e.target.checked ? 465 : 587; });
    on("mlATest", "click", test); on("mlASave", "click", save); on("mlARemove", "click", remove);
    on("mlSSave", "click", saveSettings); on("mlAClose", "click", () => d.close());
  }
  root.H3MailAccounts = { open, load, fields, test, save };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else setTimeout(wire, 0);
})(window);
