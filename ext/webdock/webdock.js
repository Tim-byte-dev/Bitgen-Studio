/* ext/webdock/webdock.js — 🌐 THE WEB EDITOR (2.856.0), window.H3Web.
 * Tim: "please make a separate docker for web editor, separate it into 4 tabs, CRM, WYSIWYG, code, preview, add a collapsible
 * files panel on the right hand side off the docker" (CRM = content AND customers - Tim: "Both, in one tab").
 * The open project's www folder (projects/<p>/www - lib/webProject.js, routes/webEditor.js):
 *   🗂 CRM       Content: 📄 Pages (each .html's title / description / main heading), 📰 Posts + 🛍 Products (www/data/content.json,
 *                the site reads it) | Customers: 👤 Clients, 📅 Bookings, 🧾 Orders, ✉ Messages (projects/<p>/web/crm.json - private,
 *                never in www) - search, ＋ New, click a row = its form (💾 Save, 🗑 Delete)
 *   ✎ WYSIWYG    the open .html page drawn (its css / pictures through <base>), scripts NOT run (sandbox), typed on (designMode);
 *                the toolbar formats; leaving it puts the edited <body> back into the file's text (the head stays as written)
 *   </> Code     the open file's text (Tab = 2 spaces, Ctrl+S saves); a picture is shown
 *   👁 Preview   the site as a browser shows it (the saved page; unsaved changes drawn from the text), 🖥 ▭ 📱 widths, ↗ Open
 *   🗄 2.857.0   Tim: "have the crm create the sites database and then link to it so it will be live" - 🗄 Create the site's database…
 *                (this project's MariaDB, or your server = the live site's) makes the site's tables, brings the project's records in and
 *                links the CRM: Clients / Bookings / Orders / Messages are then read from + written to it (⟳ every 30 s while shown)
 *   ⤴ 2.858.0    ⤴ Publish = the www folder to GitHub (the same rules as Build Website's publish: only changed files, never
 *                inc/config.php); 🌐 Build Website ▸ ☑ Into this project's www folder puts a build here
 *   Files ▸      on the right, collapsible: the www tree (folders open / shut), ＋📄 ＋📁 ⤒ ✎ 🗑 ⟳ (delete = moved to web/trash)
 * One text buffer (St.text) for the open file - the WYSIWYG, the code and the preview all show it; 💾 Save writes it (a change on
 * disk since it was opened = refused, open it again). */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const store = { get: (k, d) => { try { const v = root.localStorage.getItem("h3.web." + k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { root.localStorage.setItem("h3.web." + k, v); } catch (e) { /* fine */ } } };
  const St = { has: false, files: [], open: new Set(["css", "js", "images"]), sel: "", path: "", text: "", mtime: 0, dirty: false, wysDirty: false, tab: store.get("tab", "crm"), kind: "pages", items: [], edit: null, ask: null, prevW: "100%" };

  /* ---------------- pure helpers (tested in Node) */
  const isHtml = (p) => /\.html?$/i.test(p || "");
  const isPic = (p) => /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i.test(p || "");
  const dirOf = (p) => (p || "").includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
  /** the page with a <base> so its css / pictures load from the site (the file's own text is never given it) */
  function withBase(text, rel) {
    const b = `<base href="/web-preview/${dirOf(rel).split("/").filter(Boolean).map(encodeURIComponent).join("/")}${dirOf(rel) ? "/" : ""}">`;
    const t = String(text || "");
    return /<head[^>]*>/i.test(t) ? t.replace(/<head[^>]*>/i, (m) => m + b) : b + t;
  }
  /** the file's text with its <body> inside replaced (the head, doctype, attributes as written) */
  function putBody(text, inner) {
    const t = String(text || "");
    const m = /(<body\b[^>]*>)([\s\S]*)(<\/body>)/i.exec(t);
    if (!m) return t + "\n" + inner;
    return t.slice(0, m.index) + m[1] + inner + m[3] + t.slice(m.index + m[0].length);
  }
  /** the tree rows shown: a folder's children only while it is open */
  function rows(files, open) {
    return files.filter((f) => { const parts = f.path.split("/"); for (let i = 1; i < parts.length; i++) if (!open.has(parts.slice(0, i).join("/"))) return false; return true; })
      .map((f) => ({ path: f.path, dir: f.dir, depth: f.path.split("/").length - 1, name: f.path.split("/").pop(), size: f.size, pic: f.pic, text: f.text }));
  }
  const FIELDS = {
    pages: [["path", "File", "ro"], ["title", "Title (the browser tab + search results)"], ["description", "Description (search results)", "area"], ["h1", "Main heading"]],
    posts: [["title", "Title"], ["date", "Date", "date"], ["slug", "Address name"], ["image", "Picture (e.g. images/post.jpg)"], ["body", "Text", "area"], ["published", "Published", "bool"]],
    products: [["name", "Name"], ["category", "Category"], ["price", "Price", "num"], ["sale", "Sale price", "num"], ["stock", "In stock", "num"], ["image", "Picture"], ["description", "Description", "area"], ["published", "In the shop", "bool"]],
    clients: [["name", "Name"], ["email", "Email", "email"], ["phone", "Phone"], ["company", "Company"], ["tags", "Tags"], ["notes", "Notes", "area"]],
    bookings: [["client", "Client"], ["service", "Service"], ["date", "Date", "date"], ["time", "Time", "time"], ["length", "Minutes", "num"], ["status", "Status", ["pending", "confirmed", "done", "cancelled"]], ["notes", "Notes", "area"]],
    orders: [["number", "Order number"], ["client", "Client"], ["date", "Date", "date"], ["items", "Items", "area"], ["total", "Total", "num"], ["status", "Status", ["new", "paid", "sent", "done", "cancelled", "refunded"]], ["notes", "Notes", "area"]],
    messages: [["date", "Received", "ro"], ["name", "Name"], ["email", "Email", "email"], ["subject", "Subject"], ["message", "Message", "area"], ["status", "Status", ["new", "read", "answered", "spam"]]],
  };
  const COLS = { pages: ["path", "title", "description"], posts: ["date", "title", "published"], products: ["name", "category", "price", "stock"], clients: ["name", "email", "phone", "company"], bookings: ["date", "time", "client", "service", "status"], orders: ["date", "number", "client", "total", "status"], messages: ["date", "name", "subject", "status"] };
  const match = (it, q) => !q || Object.values(it).some((v) => String(v).toLowerCase().includes(q.toLowerCase()));
  const pure = { withBase, putBody, rows, FIELDS, COLS, match, isHtml, isPic, dirOf };

  /* ---------------- the server */
  async function api(u, body) {
    const r = await root.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw Object.assign(new Error(j.error || "HTTP " + r.status), { status: r.status }); return j;
  }
  function msg(t, err) { const m = $("wbMsg"); if (!m) return; m.textContent = t || ""; m.classList.toggle("err", !!err); }

  /* ---------------- the files panel */
  async function refresh() {
    try { const s = await api("/api/web"); St.has = s.has; } catch (e) { St.has = false; }
    $("webdock").classList.toggle("nosite", !St.has);
    if (!St.has) return;
    try { St.files = (await api("/api/web/tree")).files; } catch (e) { return msg("✗ " + e.message, true); }
    paintTree(); fillPics();
    if (!St.path && St.files.some((f) => f.path === "index.html")) await open("index.html");
    await dbStatus();
    if (St.tab === "crm") loadKind(St.kind);
  }
  function paintTree() {
    const t = $("wbTree"); if (!t) return;
    t.innerHTML = rows(St.files, St.open).map((r) => `<div class="it${r.path === St.sel ? " sel" : ""}${r.path === St.path ? " cur" : ""}" data-p="${esc(r.path)}" data-dir="${r.dir ? 1 : ""}" style="padding-left:${4 + r.depth * 12}px" title="${esc(r.path)}">${r.dir ? (St.open.has(r.path) ? "▾ 📂" : "▸ 📁") : r.pic ? "🖼" : isHtml(r.path) ? "📄" : r.text ? "📝" : "📦"} <span>${esc(r.name)}</span>${r.dir ? "" : `<span class="sz">${r.size > 1048576 ? (r.size / 1048576).toFixed(1) + " MB" : Math.ceil(r.size / 1024) + " KB"}</span>`}</div>`).join("") || '<div style="color:var(--dim);padding:6px">empty</div>';
  }
  function fillPics() {
    const s = $("wbImg"); if (!s) return;
    s.innerHTML = '<option value="">🖼 Picture…</option>' + St.files.filter((f) => f.pic).map((f) => `<option value="${esc(f.path)}">${esc(f.path)}</option>`).join("");
  }
  function targetDir() { const f = St.files.find((x) => x.path === St.sel); return f ? (f.dir ? f.path : dirOf(f.path)) : ""; }
  function ask(label, value, then) {
    St.ask = then; $("wbAsk").placeholder = label; $("wbAsk").value = value || ""; $("wbAskRow").classList.add("on"); $("wbAsk").focus(); $("wbAsk").select();
  }
  function askDone(ok) { const fn = St.ask, v = $("wbAsk").value.trim(); St.ask = null; $("wbAskRow").classList.remove("on"); if (ok && fn && v) fn(v); }
  const join = (d, n) => (d ? d + "/" : "") + n.replace(/^\/+/, "");

  /* ---------------- the open file */
  function mark() { const n = $("wbFileName"); if (!n) return; n.textContent = St.path || "no file open"; n.classList.toggle("dirty", St.dirty); }
  async function open(p) {
    if (St.dirty && !root.confirm(`${St.path} has changes that are not saved - leave them?`)) return false;
    syncWys();
    if (isPic(p) && !/\.svg$/i.test(p)) { St.path = p; St.text = ""; St.dirty = false; St.mtime = 0; mark(); paintCode(); paintTree(); if (St.tab === "wys" || St.tab === "crm") tab("code"); else paintTab(); return true; }
    try { const f = await api("/api/web/file?path=" + encodeURIComponent(p)); St.path = f.path; St.text = f.text; St.mtime = f.mtime; St.dirty = false; St.wysDirty = false; }
    catch (e) { msg("✗ " + e.message, true); return false; }
    St.sel = p; mark(); paintTree(); paintCode(); paintTab(); msg("");
    return true;
  }
  async function save() {
    if (!St.path || isPic(St.path) && !/\.svg$/i.test(St.path)) return msg("nothing to save");
    syncWys(); if (St.tab === "code") St.text = $("wbCode").value;
    try { const r = await api("/api/web/file", { path: St.path, text: St.text, mtime: St.mtime }); St.mtime = r.mtime; St.dirty = false; mark(); msg("💾 saved " + r.path); refreshTreeQuiet(); if (St.tab === "prev") paintPrev(); }
    catch (e) { msg("✗ " + e.message, true); }
  }
  async function refreshTreeQuiet() { try { St.files = (await api("/api/web/tree")).files; paintTree(); fillPics(); } catch (e) { /* the next ⟳ */ } }
  function changed() { St.dirty = true; mark(); }

  /* ---------------- the tabs */
  function tab(t) {
    syncWys(); if (St.tab === "code" && St.path && !isPic(St.path)) St.text = $("wbCode").value;
    St.tab = t; store.set("tab", t);
    doc.querySelectorAll("#webdock .wbtab").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    doc.querySelectorAll("#webdock .wbpane").forEach((p) => p.classList.toggle("on", p.dataset.pane === t));
    paintTab();
  }
  function paintTab() { if (St.tab === "wys") paintWys(); else if (St.tab === "code") paintCode(); else if (St.tab === "prev") paintPrev(); else if (St.tab === "crm") loadKind(St.kind); }
  /* ✎ WYSIWYG */
  function paintWys() {
    const f = $("wbWys"), ok = isHtml(St.path);
    $("wbWysNote").style.display = ok ? "none" : ""; f.style.display = ok ? "" : "none"; $("wbWysBar").style.opacity = ok ? "1" : ".4";
    if (!ok) return;
    St.wysDirty = false;
    f.onload = () => {
      const d = f.contentDocument; if (!d) return;
      d.designMode = "on";
      d.addEventListener("input", () => { St.wysDirty = true; changed(); });
      d.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } });
      d.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("a"); if (a) e.preventDefault(); });
    };
    f.srcdoc = withBase(St.text, St.path);
  }
  /** the WYSIWYG's edits into the text (only when it was typed on) */
  function syncWys() {
    if (!St.wysDirty) return; St.wysDirty = false;
    const d = $("wbWys").contentDocument; if (!d || !d.body) return;
    const b = d.body.cloneNode(true);
    St.text = putBody(St.text, b.innerHTML);
  }
  function wysDoc() { const d = $("wbWys").contentDocument; return d && d.designMode === "on" ? d : null; }
  function cmd(c, v) { const d = wysDoc(); if (!d) return; d.execCommand(c, false, v); St.wysDirty = true; changed(); $("wbWys").contentWindow.focus(); }
  /* </> Code */
  function paintCode() {
    const c = $("wbCode"), pic = $("wbPic"), isP = isPic(St.path) && !/\.svg$/i.test(St.path);
    c.style.display = isP ? "none" : ""; pic.style.display = isP ? "block" : "none";
    if (isP) { pic.innerHTML = `<img src="/web-preview/${St.path.split("/").map(encodeURIComponent).join("/")}?v=${Date.now()}" alt="">`; return; }
    if (c.value !== St.text) c.value = St.text;
  }
  /* 👁 Preview */
  function paintPrev() {
    const f = $("wbPrev"); f.style.width = St.prevW;
    const p = St.path && (isHtml(St.path) || isPic(St.path)) ? St.path : "index.html";
    if (St.dirty && isHtml(St.path)) { f.removeAttribute("src"); f.srcdoc = withBase(St.text, St.path); $("wbPrevNote").textContent = "showing your unsaved changes - 💾 Save to keep them"; }
    else { f.removeAttribute("srcdoc"); f.src = "/web-preview/" + p.split("/").map(encodeURIComponent).join("/") + "?v=" + Date.now(); $("wbPrevNote").textContent = p; }
  }

  /* ---------------- 🗂 CRM: content + customers */
  async function loadKind(kind) {
    St.kind = kind; St.edit = null; $("wbCrmForm").classList.remove("on");
    doc.querySelectorAll("#wbCrmNav button").forEach((b) => b.classList.toggle("on", b.dataset.kind === kind));
    $("wbCrmNew").style.display = kind === "pages" ? "none" : "";
    const L = St.db && St.db.linked && ["clients", "bookings", "orders", "messages"].includes(kind);
    $("wbCrmNote").textContent = L ? `🟢 Live from the database ${St.db.name} (${St.db.scope === "external" ? "your server" : "this computer"}) - what the site's visitors book, order and send shows here.` : kind === "pages" ? "Each .html page of the site - its title, description and main heading. ✎ Open = edit the whole page." : ["posts", "products"].includes(kind) ? "Kept in www/data/content.json - the site reads it (public)." : "Kept in the project's web/crm.json - private, never put on the site.";
    try { const j = kind === "pages" ? await api("/api/web/pages") : await api("/api/web/records?kind=" + kind); St.items = kind === "pages" ? j.pages : j.items; }
    catch (e) { St.items = []; msg("✗ " + e.message, true); }
    paintList();
  }
  function paintList() {
    const q = $("wbCrmFind").value.trim(), cols = COLS[St.kind], list = St.items.filter((it) => match(it, q));
    const lab = (k) => (FIELDS[St.kind].find((f) => f[0] === k) || [k, k])[1].replace(/ \(.*\)$/, "");
    $("wbCrmCount").textContent = list.length + (list.length !== St.items.length ? " of " + St.items.length : "");
    $("wbCrmList").innerHTML = list.length ? `<table><tr>${cols.map((c) => `<th>${esc(lab(c))}</th>`).join("")}${St.kind === "pages" ? "<th></th>" : ""}</tr>${list.map((it) => `<tr class="r" data-id="${esc(it.id || it.path)}">${cols.map((c) => `<td>${esc(c === "published" ? (it[c] ? "✓" : "—") : c === "date" ? String(it[c] || "").slice(0, 10) : it[c])}</td>`).join("")}${St.kind === "pages" ? `<td><button class="ghost" type="button" data-openp="${esc(it.path)}">✎ Open</button></td>` : ""}</tr>`).join("")}</table>`
      : `<div style="color:var(--dim);padding:10px">${St.items.length ? "nothing matches" : St.kind === "pages" ? "no pages" : "none yet - ＋ New"}</div>`;
  }
  function form(it) {
    St.edit = it ? Object.assign({}, it) : {}; const F = FIELDS[St.kind];
    $("wbCrmForm").innerHTML = F.map(([k, label, kind]) => {
      const v = St.edit[k] == null ? (kind === "bool" ? true : "") : St.edit[k], id = "wbF_" + k;
      if (kind === "ro") return `<label><span>${esc(label)}</span><b>${esc(v)}</b></label>`;
      if (kind === "area") return `<label><span>${esc(label)}</span><textarea id="${id}" rows="${k === "body" || k === "description" && St.kind !== "pages" ? 6 : 3}">${esc(v)}</textarea></label>`;
      if (kind === "bool") return `<label><span>${esc(label)}</span><input type="checkbox" id="${id}"${v ? " checked" : ""} style="flex:none"></label>`;
      if (Array.isArray(kind)) return `<label><span>${esc(label)}</span><select id="${id}">${kind.map((o) => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
      return `<label><span>${esc(label)}</span><input id="${id}" type="${kind === "num" ? "number" : kind || "text"}" step="any" value="${esc(v)}"></label>`;
    }).join("") + `<div class="wbbar"><button class="go" type="button" id="wbFSave">💾 Save</button>${it && St.kind !== "pages" ? '<button class="ghost" type="button" id="wbFDel">🗑 Delete</button>' : ""}<button class="ghost" type="button" id="wbFNo">Cancel</button>${St.kind === "pages" ? `<button class="ghost" type="button" data-openp="${esc(it.path)}">✎ Open the page</button>` : ""}</div>`;
    $("wbCrmForm").classList.add("on");
    $("wbCrmForm").querySelectorAll("input, textarea, select").forEach((x) => x.addEventListener("keydown", (e) => e.stopPropagation()));
    $("wbFSave").onclick = saveForm; $("wbFNo").onclick = () => $("wbCrmForm").classList.remove("on");
    if ($("wbFDel")) $("wbFDel").onclick = async () => { if (!root.confirm("Delete this one?")) return; try { await api("/api/web/records", { kind: St.kind, record: { id: St.edit.id, remove: true } }); msg("🗑 deleted"); loadKind(St.kind); } catch (e) { msg("✗ " + e.message, true); } };
    const first = $("wbCrmForm").querySelector("input:not([type=checkbox]), textarea"); if (first) first.focus();
  }
  async function saveForm() {
    const rec = { id: St.edit.id };
    for (const [k, , kind] of FIELDS[St.kind]) { if (kind === "ro") continue; const el = $("wbF_" + k); if (el) rec[k] = kind === "bool" ? el.checked : el.value; }
    try {
      if (St.kind === "pages") { await api("/api/web/pages", Object.assign({ path: St.edit.path }, rec)); if (St.path === St.edit.path && !St.dirty) { const f = await api("/api/web/file?path=" + encodeURIComponent(St.path)); St.text = f.text; St.mtime = f.mtime; } }
      else await api("/api/web/records", { kind: St.kind, record: rec });
      msg("💾 saved"); loadKind(St.kind);
      if (root.H3TestEvent) { try { root.H3TestEvent("web_record", St.kind); } catch (e) { /* the 🧪 list */ } }
    } catch (e) { msg("✗ " + e.message, true); }
  }

  /* ---------------- 🗄 the live database (2.857.0) */
  async function dbStatus() {
    try { St.db = await api("/api/web/db"); } catch (e) { St.db = { linked: false }; }
    const b = $("wbDbBox"); if (!b) return St.db;
    b.innerHTML = St.db.linked
      ? `<span class="live">🟢 Live: ${esc(St.db.name)}</span><span>${St.db.scope === "external" ? "🌐 your server" : "💻 this computer"}${St.db.ok ? "" : " - ✗ " + esc(St.db.error || "not reached")}</span><button class="ghost" type="button" id="wbDbUnlink" title="Keep the records in the project again (the database stays as it is)">Unlink</button>`
      : `<span>📁 Kept in the project (not live)</span><button class="ghost" type="button" id="wbDbMake" title="Make the site's database and link the CRM to it">🗄 Create the site's database…</button>`;
    if ($("wbDbMake")) $("wbDbMake").onclick = () => { $("wbDbForm").classList.add("on"); $("wbDbName").value = $("wbDbName").value || ""; $("wbDbMsg").textContent = ""; };
    if ($("wbDbUnlink")) $("wbDbUnlink").onclick = async () => { if (!root.confirm("Unlink the CRM from " + St.db.name + "? The database is left as it is.")) return; await api("/api/web/db/unlink", {}); await dbStatus(); loadKind(St.kind); };
    return St.db;
  }
  async function dbCreate() {
    const scope = (doc.querySelector('input[name="wbDbScope"]:checked') || {}).value || "project", m = $("wbDbMsg");
    try {
      if (scope === "project") {
        const st = await api("/api/db/status");
        if (!st.server) { m.textContent = "MariaDB is needed - the 🗄 Database docker asks to download it"; if (root.H3Db) { root.H3Db.show(); if (!(await root.H3Db.ready())) return; } else return; }
      }
      $("wbDbGo").disabled = true; m.textContent = "🗄 making the database…";
      const r = await api("/api/web/db/create", { scope, name: $("wbDbName").value.trim() || undefined, importLocal: $("wbDbImport").checked });
      $("wbDbForm").classList.remove("on");
      const im = r.imported ? Object.entries(r.imported).filter(([, n]) => n).map(([k, n]) => n + " " + k).join(", ") : "";
      msg(`🗄 ${r.name} ${r.made ? "made" : "ready"} and linked${im ? " - brought in " + im : ""}${r.config ? " · www/" + r.config + " points the site at it" : ""}`);
      await dbStatus(); loadKind(["clients", "bookings", "orders", "messages"].includes(St.kind) ? St.kind : "clients");
      if (root.H3TestEvent) { try { root.H3TestEvent("web_db", r.name); } catch (e) { /* the 🧪 list */ } }
    } catch (e) { m.textContent = "✗ " + e.message; if (e.status === 412 && root.H3Db) root.H3Db.show(); }
    finally { $("wbDbGo").disabled = false; }
  }
  // live: the customers' list read again every 30 s while it is on screen (no form open)
  if (root.setInterval) root.setInterval(() => {
    const d = $("webdock");
    if (d && !d.classList.contains("dockgone") && St.tab === "crm" && St.db && St.db.linked && ["clients", "bookings", "orders", "messages"].includes(St.kind) && !$("wbCrmForm").classList.contains("on") && !doc.hidden) loadKind(St.kind);
  }, 30000);

  /* ---------------- ⤴ publish www (2.858.0, lib/sitePublish.js publishWww) */
  async function pubOpen() {
    const f = $("wbPubForm"); if (f.classList.contains("on")) { f.classList.remove("on"); return; }
    let st; try { st = await api("/api/web/publish"); } catch (e) { return msg("✗ " + e.message, true); }
    const p = st.publish; $("wbPubTok").value = ""; $("wbPubTok").placeholder = st.token ? "kept on this computer (encrypted) - type a new one to change it" : "a GitHub token with the repo scope";
    $("wbPubForget").disabled = !st.token; $("wbPubOwner").value = p.owner || ""; $("wbPubRepo").value = p.repo; $("wbPubBranch").value = p.branch; $("wbPubPriv").checked = p.private !== false; $("wbPubFtp").checked = !!p.ftp; $("wbPubMsg").value = "";
    $("wbPubOut").innerHTML = st.last ? `Last published ${esc(new Date(st.last.at).toLocaleString())}: <a href="${esc(st.last.url)}" target="_blank" rel="noopener">${esc(st.last.url)}</a>` : "";
    f.classList.add("on");
  }
  async function pubGo() {
    if (St.dirty && root.confirm(`${St.path} has changes that are not saved - save them first?`)) await save();
    $("wbPubGo").disabled = true; $("wbPubOut").textContent = "⤴ publishing…";
    try {
      const r = await api("/api/web/publish", { token: $("wbPubTok").value.trim() || undefined, owner: $("wbPubOwner").value.trim(), repo: $("wbPubRepo").value.trim(), branch: $("wbPubBranch").value.trim(), private: $("wbPubPriv").checked, ftp: $("wbPubFtp").checked, message: $("wbPubMsg").value.trim() });
      $("wbPubTok").value = ""; $("wbPubForget").disabled = false;
      $("wbPubOut").innerHTML = (r.nothing ? "✓ nothing changed since the last publish - " : `✓ ${r.created ? "the repository made, " : ""}${r.sent} file(s) sent, ${r.kept} the same${r.removed ? `, ${r.removed} taken out` : ""} - `) + `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.owner + "/" + r.repo)}</a> (${esc(r.branch)})`;
      msg("⤴ published to " + r.owner + "/" + r.repo);
      if (root.H3TestEvent) { try { root.H3TestEvent("web_publish", r.repo); } catch (e) { /* the 🧪 list */ } }
    } catch (e) { $("wbPubOut").textContent = "✗ " + e.message; }
    $("wbPubGo").disabled = false;
  }

  /* ---------------- wiring */
  function show() { const d = $("webdock"); if (d && d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone("webdock", "tX_webdock"); }
  function wire() {
    const d = $("webdock"); if (!d) return;
    try { if (root.localStorage.getItem("h3.g.webdock") == null) { root.localStorage.setItem("h3.g.webdock", "1"); d.classList.add("dockgone"); } } catch (e) { /* fine */ }
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    on("wbCloseBtn", "click", (e) => { e.stopPropagation(); if (typeof root.toggleDockGone === "function") root.toggleDockGone("webdock", "tX_webdock"); });
    d.querySelectorAll(".wbtab").forEach((b) => b.addEventListener("click", () => tab(b.dataset.tab)));
    on("wbSave", "click", save);
    on("wbPub", "click", pubOpen); on("wbPubGo", "click", pubGo); on("wbPubNo", "click", () => $("wbPubForm").classList.remove("on"));
    on("wbPubForget", "click", async () => { try { await api("/api/sites/publish/token", { token: "" }); $("wbPubForget").disabled = true; $("wbPubOut").textContent = "the token is forgotten"; } catch (e) { $("wbPubOut").textContent = "✗ " + e.message; } });
    ["wbPubTok", "wbPubOwner", "wbPubRepo", "wbPubBranch", "wbPubMsg"].forEach((id) => on(id, "keydown", (e) => e.stopPropagation()));
    on("wbMake", "click", async () => { try { const r = await api("/api/web/create", {}); msg(`🌐 www made - ${r.made.length} file(s), ${r.folders.length} folders`); St.path = ""; await refresh(); } catch (e) { msg("✗ " + e.message, true); } });
    // files
    const fp = $("wbFiles"), paintShut = () => { fp.classList.toggle("shut", store.get("files", "1") !== "1"); $("wbFilesArrow").textContent = fp.classList.contains("shut") ? "◂" : "▸"; };
    on("wbFilesHead", "click", () => { store.set("files", fp.classList.contains("shut") ? "1" : "0"); paintShut(); }); paintShut();
    on("wbTree", "click", (e) => {
      const it = e.target.closest(".it"); if (!it) return; const p = it.dataset.p; St.sel = p;
      if (it.dataset.dir) { if (St.open.has(p)) St.open.delete(p); else St.open.add(p); paintTree(); return; }
      open(p);
    });
    on("wbRefresh", "click", () => refresh());
    on("wbNewFile", "click", () => ask("new file name, e.g. services.html or css/extra.css", "", async (n) => { const p = join(targetDir(), n); try { await api("/api/web/file", { path: p, text: isHtml(p) ? `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${esc(n.replace(/\.html?$/i, ""))}</title>\n  <link rel="stylesheet" href="${"../".repeat(p.split("/").length - 1)}css/style.css">\n</head>\n<body>\n  <h1>${esc(n.replace(/\.html?$/i, ""))}</h1>\n</body>\n</html>\n` : "" }); await refreshTreeQuiet(); St.open.add(dirOf(p)); await open(p); } catch (er) { msg("✗ " + er.message, true); } }));
    on("wbNewDir", "click", () => ask("new folder name", "", async (n) => { const p = join(targetDir(), n); try { await api("/api/web/mkdir", { path: p }); St.open.add(p); St.sel = p; await refreshTreeQuiet(); } catch (er) { msg("✗ " + er.message, true); } }));
    on("wbRename", "click", () => { if (!St.sel) return msg("pick a file or folder first"); ask("new name / path", St.sel, async (n) => { try { const r = await api("/api/web/rename", { from: St.sel, to: n }); if (St.path === St.sel) { St.path = r.path; mark(); } St.sel = r.path; await refreshTreeQuiet(); } catch (er) { msg("✗ " + er.message, true); } }); });
    on("wbDelete", "click", async () => { if (!St.sel) return msg("pick a file or folder first"); if (!root.confirm(`Delete ${St.sel}? (kept in the project's web/trash)`)) return; try { await api("/api/web/delete", { path: St.sel }); if (St.path === St.sel || St.path.startsWith(St.sel + "/")) { St.path = ""; St.text = ""; St.dirty = false; mark(); paintTab(); } St.sel = ""; await refreshTreeQuiet(); msg("🗑 moved to web/trash"); } catch (er) { msg("✗ " + er.message, true); } });
    on("wbUpload", "click", () => $("wbUpFile").click());
    on("wbUpFile", "change", async (e) => {
      const files = [...(e.target.files || [])]; e.target.value = ""; const dir = targetDir() || "images";
      for (const f of files) { try { const b64 = await new Promise((ok, no) => { const fr = new root.FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.onerror = no; fr.readAsDataURL(f); }); await api("/api/web/upload", { path: join(dir, f.name.replace(/[^\w .()-]+/g, "_")), b64 }); } catch (er) { msg("✗ " + f.name + ": " + er.message, true); } }
      St.open.add(dir); await refreshTreeQuiet(); msg(`⤒ ${files.length} file(s) into ${dir}`);
    });
    on("wbAskOk", "click", () => askDone(true)); on("wbAskNo", "click", () => askDone(false));
    on("wbAsk", "keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") askDone(true); if (e.key === "Escape") askDone(false); });
    // code
    on("wbCode", "input", () => { St.text = $("wbCode").value; changed(); });
    on("wbCode", "keydown", (e) => {
      e.stopPropagation();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
      if (e.key === "Tab" && !e.ctrlKey) { e.preventDefault(); const t = e.target, a = t.selectionStart, b = t.selectionEnd; t.setRangeText("  ", a, b, "end"); St.text = t.value; changed(); }
    });
    // WYSIWYG
    d.querySelectorAll("#wbWysBar [data-cmd]").forEach((b) => b.addEventListener("click", () => cmd(b.dataset.cmd)));
    d.querySelectorAll("#wbWysBar [data-block]").forEach((b) => b.addEventListener("click", () => cmd("formatBlock", "<" + b.dataset.block + ">")));
    on("wbLink", "click", () => { const u = $("wbLinkUrl"); u.style.display = u.style.display === "none" ? "" : "none"; if (u.style.display === "") u.focus(); });
    on("wbLinkUrl", "keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { const v = e.target.value.trim(); e.target.style.display = "none"; if (v) cmd("createLink", v); } if (e.key === "Escape") e.target.style.display = "none"; });
    on("wbImg", "change", (e) => { const p = e.target.value; e.target.value = ""; if (!p) return; const rel = "../".repeat(dirOf(St.path).split("/").filter(Boolean).length) + p; cmd("insertImage", rel); });
    // preview
    d.querySelectorAll(".wbw").forEach((b) => b.addEventListener("click", () => { St.prevW = b.dataset.w; d.querySelectorAll(".wbw").forEach((x) => x.classList.toggle("on", x === b)); $("wbPrev").style.width = St.prevW; }));
    on("wbReload", "click", paintPrev);
    on("wbOpenTab", "click", () => root.open("/web-preview/" + (St.path && isHtml(St.path) ? St.path : "index.html").split("/").map(encodeURIComponent).join("/"), "_blank"));
    // CRM
    d.querySelectorAll("#wbCrmNav [data-kind]").forEach((b) => b.addEventListener("click", () => loadKind(b.dataset.kind)));
    on("wbCrmFind", "input", paintList); on("wbCrmFind", "keydown", (e) => e.stopPropagation());
    on("wbCrmNew", "click", () => form(null));
    on("wbDbGo", "click", dbCreate); on("wbDbNo", "click", () => $("wbDbForm").classList.remove("on"));
    on("wbDbName", "keydown", (e) => e.stopPropagation());
    on("wbCrmList", "click", (e) => {
      const op = e.target.closest("[data-openp]"); if (op) { e.stopPropagation(); open(op.dataset.openp).then((ok) => ok && tab("wys")); return; }
      const tr = e.target.closest("tr.r"); if (!tr) return; const it = St.items.find((x) => (x.id || x.path) === tr.dataset.id); if (it) form(it);
    });
    on("wbCrmForm", "click", (e) => { const op = e.target.closest("[data-openp]"); if (op) open(op.dataset.openp).then((ok) => ok && tab("wys")); });
    d.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && St.path) { e.preventDefault(); e.stopPropagation(); save(); } });
    root.addEventListener("beforeunload", (e) => { if (St.dirty) { e.preventDefault(); e.returnValue = ""; } });
    tab(["crm", "wys", "code", "prev"].includes(St.tab) ? St.tab : "crm");
    let seen = false; const go = () => { if (seen || d.classList.contains("dockgone")) return; seen = true; refresh(); }; go();
    // first shown = read the folder (a docker opened later); ⟳ reads it again
    new root.MutationObserver(go).observe(d, { attributes: true, attributeFilter: ["class"] });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  root.H3Web = Object.assign({ show, refresh, open, save, tab, loadKind, dbStatus, state: () => St }, pure);
})(typeof window !== "undefined" ? window : globalThis);
