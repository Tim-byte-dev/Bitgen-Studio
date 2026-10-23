/* bitGen Studio — static/team.js (2.583.0): THE RENDER FARM's screens (window.H3Team) - Settings ▸ Team and the status
 * bar's 🖥 Render on chip (routes/team.js, lib/team.js, lib/farm.js, lib/farmNode.js).
 * Tim: "lets just work on the render farm part for now, open the same project, get permission from owner of the client to
 * render using their hardware, send api keys out to each team member daily from the team leader so there is no
 * unauthorized access. a team member can get access to any of the other team members hardware to render but only while
 * bitgen is running on that machine and access has been granted - have levels of access - time limit and unrestricted,
 * time limit will set time from - time to".
 *   Settings ▸ Team: the team folder (NAS) - ➕ Create (the leader) / ⇥ Join; today's key; the leader's members (✓ Approve,
 *   🗑 Remove, ↻ Issue today's keys); this PC's projects folder = the team's; 🔌 Share this PC + the requests to it
 *   (Allow unrestricted / Allow from - to / Deny) + the access given (↺ Revoke); the team's PCs with what they render.
 *   🖥 Render on (status bar): This PC / a team PC (✓ access, or 🔒 Ask) / ⚡ Spread; the team's renders with progress.
 * Pure (scripts/test-farm583.js): accessWords(access, now), pctOf(job). */
(function (root) {
  "use strict";
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  /** what a PC's access says (pure) */
  function accessWords(a, now) {
    if (!a) return "no access";
    if (a.level === "unrestricted") return "✓ unrestricted";
    var f = new Date(a.from), t = new Date(a.to), n = now == null ? Date.now() : now;
    var same = f.toDateString() === t.toDateString();
    var span = (same ? f.toLocaleDateString() + " " + hm(f) + "–" + hm(t) : f.toLocaleString() + " – " + t.toLocaleString());
    return (n >= +f && n <= +t ? "✓ " : n < +f ? "⏳ " : "⌛ ") + span;
  }
  /** a job's progress, 0..100 or null (pure) */
  function pctOf(j) {
    if (!j) return null;
    if (j.status === "done") return 100;
    if (j.pct != null) return j.pct;
    if (j.chunk && j.chunk.n > 1) return Math.round((j.chunk.i - 1) / j.chunk.n * 100);
    return null;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { accessWords: accessWords, pctOf: pctOf }; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function jget(u) { return fetch(u).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function jpost(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  var S = { st: null, targets: null, timer: null, menu: null, seenReq: {} };

  var CSS = "#stab-team .tm{border:1px solid var(--line,#3a352e);border-radius:8px;padding:8px 10px;margin:0 0 8px}#stab-team h4{margin:0 0 6px;font-size:12.5px}"
    + "#stab-team .r{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:3px 0}#stab-team .r input[type=text]{min-width:220px;flex:1}#stab-team table{width:100%;border-collapse:collapse;font-size:12px}"
    + "#stab-team td,#stab-team th{padding:3px 6px;border-bottom:1px solid var(--line,#3a352e);text-align:left}#stab-team .k{opacity:.7;font-size:11px}#stab-team .ok{color:#7c7}#stab-team .bad{color:#e66}"
    + ".tmbar{display:inline-block;width:90px;height:6px;border-radius:3px;background:var(--line,#333);vertical-align:middle;overflow:hidden}.tmbar i{display:block;height:100%;background:var(--tiger,#f59e2c)}"
    + "#tmMenu{position:fixed;z-index:9999;min-width:300px;max-width:440px;background:var(--panel,#1d1a16);border:1px solid var(--line,#444);border-radius:8px;padding:6px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.5)}"
    + "#tmMenu .it{display:flex;gap:6px;align-items:center;padding:4px 6px;border-radius:5px;cursor:pointer}#tmMenu .it:hover{background:rgba(255,255,255,.06)}#tmMenu .it.on{color:var(--tiger,#f59e2c)}#tmMenu .it.off{opacity:.5;cursor:default}"
    + "#tmMenu .hd{opacity:.65;font-size:11px;padding:6px 6px 2px}#tmMenu .jb{padding:2px 6px 2px 18px;display:flex;gap:6px;align-items:center;font-size:11px}";

  /* ---------------- Settings ▸ Team */
  function boot() {
    var dlg = $("settings"), tabs = dlg && dlg.querySelector(".stabs");
    if (!tabs || $("stab-team")) return !!tabs;
    var st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);
    var b = doc.createElement("button"); b.dataset.stab = "team"; b.textContent = "Team"; b.type = "button";
    var after = tabs.querySelector('[data-stab="rgpu"]'); if (after) after.after(b); else tabs.appendChild(b);
    var pane = doc.createElement("div"); pane.className = "stab"; pane.id = "stab-team";
    pane.innerHTML = '<p class="hint help" style="margin:0 0 8px">The render farm: team members open the same project (the team\'s projects folder on the NAS) and render scenes, pictures and songs on each other\'s PCs - only while bitGen runs on that PC and its owner has given access. The leader\'s bitGen issues every member a new key each day.</p><div id="tmBody">…</div>';
    var all = dlg.querySelectorAll(".stab"); if (all.length) all[all.length - 1].after(pane); else tabs.after(pane);
    b.onclick = function () {
      dlg.querySelectorAll(".stabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
      doc.querySelectorAll(".stab").forEach(function (t) { t.classList.toggle("active", t.id === "stab-team"); });
      load();
    };
    chip();
    poll();
    return true;
  }
  function load() { return jget("/api/team/status").then(function (s) { S.st = s; paint(); notify(); return s; }); }
  function say(t, bad) { var m = $("tmMsg"); if (m) { m.textContent = t || ""; m.className = bad ? "bad" : "k"; } }
  function act(u, body, ok) {
    return jpost(u, body).then(function (r) { if (r.error) { say(r.error, true); return r; } if (r.folder !== undefined) { S.st = r; paint(); } if (ok) say(typeof ok === "function" ? ok(r) : ok); chipPaint(); return r; });
  }
  function paint() {
    var host = $("tmBody"); if (!host) return;
    var s = S.st || {}, h = "";
    h += '<div class="r"><span id="tmMsg" class="k" role="status"></span></div>';
    // the team
    h += '<div class="tm"><h4>👥 The team</h4><div class="r"><label>Team folder (on the NAS)</label><input type="text" id="tmFolder" value="' + esc(s.folder || "") + '" placeholder="\\\\nas\\bitgen-team  or  Z:\\bitgen-team"><button class="ghost" type="button" id="tmPick">📁</button></div>';
    if (!s.joined) {
      h += '<div class="r"><label>Your name</label><input type="text" id="tmMe" value="' + esc(s.member || "") + '" style="max-width:160px"><label>Team name (new team)</label><input type="text" id="tmName" style="max-width:180px">'
        + '<button type="button" id="tmCreate" title="You are the leader: the team is made in the folder, your bitGen issues every member a key each day">➕ Create the team</button>'
        + '<button class="ghost" type="button" id="tmJoin" title="Join the team in the folder - the leader approves you">⇥ Join</button></div>'
        + (s.error && s.folder ? '<div class="k">' + esc(s.error) + "</div>" : "");
    } else {
      var t = s.team || {};
      h += '<div class="r"><b>' + esc(t.name) + "</b><span class=k>leader " + esc(t.leader) + " · you: " + esc(s.member) + (s.leader ? " (leader)" : "") + " · this PC: " + esc((s.machine || {}).machine_name) + "</span></div>"
        + '<div class="r">Today\'s key: ' + (s.key && s.key.valid ? '<span class="ok">✓ valid until ' + esc(new Date(s.key.to).toLocaleString()) + "</span>" : '<span class="bad">✗ ' + esc((s.key || {}).why) + "</span>") + "</div>";
      h += '<div class="r"><button class="ghost" type="button" id="tmLeave" title="This PC leaves the team: no team renders, its own projects folder again (restart)">⇤ Leave the team</button></div>';
      if (s.leader) {
        h += "<table><tr><th>Member</th><th>PC</th><th></th></tr>" + (t.members || []).map(function (m) { return "<tr><td>" + esc(m.name) + "</td><td>" + esc(m.machine || "") + "</td><td>" + (m.name === t.leader ? "<span class=k>leader</span>" : '<button class="ghost" type="button" data-tmrm="' + esc(m.name) + '" title="Out of the team: no key from now on">🗑 Remove</button>') + "</td></tr>"; }).join("") + "</table>";
        if ((s.requests || []).length) h += '<div class="r"><b>Want to join:</b> ' + s.requests.map(function (q) { return esc(q.name) + " (" + esc(q.machine || "") + ') <button type="button" data-tmok="' + esc(q.name) + '">✓ Approve</button>'; }).join(" ") + "</div>";
        h += '<div class="r"><button class="ghost" type="button" id="tmIssue" title="Your bitGen issues them by itself each day while it runs - this does it now">↻ Issue today\'s keys</button></div>';
      }
    }
    h += "</div>";
    if (s.joined) {
      // projects
      h += '<div class="tm"><h4>📂 The same project</h4><div class="r">This PC\'s projects folder: <code>' + esc(s.projects_now) + "</code></div>"
        + (s.shared_projects ? '<div class="r ok">✓ it is the team\'s - every member opens the same projects</div>'
          : '<div class="r"><button type="button" id="tmUseProj" title="' + esc(s.team_projects) + '">Use the team\'s projects folder</button><span class="k">' + esc(s.team_projects) + " - then restart bitGen</span></div>")
        + (s.projects_dir ? '<div class="r"><button class="ghost" type="button" id="tmLocalProj">Back to this PC\'s own projects folder</button>' + (s.restart ? ' <span class="bad">restart bitGen to switch</span>' : "") + "</div>" : "") + "</div>";
      // sharing
      var A = s.access || { grants: [], requests: [] };
      h += '<div class="tm"><h4>🔌 This PC renders for the team</h4><div class="r"><label><input type="checkbox" id="tmShare"' + (s.sharing ? " checked" : "") + "> Share this PC for team renders</label> port <input type=\"number\" id=\"tmPort\" value=\"" + esc(s.port) + '" style="width:80px"> <span class="k">' + (s.listening ? "listening on " + s.listening + " (only while bitGen runs)" : "not listening") + "</span></div>"
        + '<div class="r"><label>This PC\'s address for the team</label><input type="text" id="tmAddr" value="' + esc(s.address || "") + '" placeholder="optional - a Tailscale name or 100.x address" title="The others try this first, then this PC\'s network addresses"><span class="k">' + esc((s.addresses || []).slice(0, 4).join(" · ")) + "</span></div>";
      if ((A.requests || []).length) h += "<table><tr><th>Asks for access</th><th>Allow</th><th></th></tr>" + A.requests.map(function (q) {
        var d = new Date(), d2 = new Date(Date.now() + 4 * 3600000), v = function (x) { return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()) + "T" + pad(x.getHours()) + ":" + pad(x.getMinutes()); };
        return '<tr data-tmq="' + esc(q.member) + '"><td>' + esc(q.member) + (q.note ? '<div class="k">' + esc(q.note) + "</div>" : "") + '</td><td><button type="button" data-tmall="u" title="Any time while bitGen runs here">Unrestricted</button> or from <input type="datetime-local" class="tmF" value="' + v(d) + '"> to <input type="datetime-local" class="tmT" value="' + v(d2) + '"> <button type="button" data-tmall="w">Allow</button></td><td><button class="ghost" type="button" data-tmdeny>Deny</button></td></tr>';
      }).join("") + "</table>";
      h += "<table><tr><th>Access given</th><th></th><th></th></tr>" + ((A.grants || []).length ? A.grants.map(function (g) { return "<tr><td>" + esc(g.member) + "</td><td>" + esc(accessWords(g)) + '</td><td><button class="ghost" type="button" data-tmrev="' + esc(g.member) + '">↺ Revoke</button></td></tr>'; }).join("") : '<tr><td colspan=3 class=k>nobody yet</td></tr>') + "</table></div>";
      // the team's PCs
      h += '<div class="tm"><h4>🖥 The team\'s PCs</h4>' + machinesHtml(s.machines || []) + "</div>";
    }
    host.innerHTML = h;
    bind();
  }
  function jobsHtml(jobs, cls) {
    return (jobs || []).map(function (j) { var p = pctOf(j); return '<div class="' + (cls || "jb") + '">' + (j.status === "running" ? "▶" : j.status === "queued" ? "⏸" : j.status === "done" ? "✓" : "✗") + " " + esc(j.label || j.kind) + ' <span class="k">' + esc(j.project) + " · for " + esc(j.for) + "</span>" + (p != null ? ' <span class="tmbar"><i style="width:' + p + '%"></i></span> ' + p + "%" : "") + "</div>"; }).join("");
  }
  function machinesHtml(ms) {
    if (!ms.length) return '<div class="k">no PC has said it is online yet</div>';
    return "<table><tr><th>PC</th><th>Member</th><th>State</th><th>Rendering</th></tr>" + ms.map(function (m) {
      return "<tr><td>" + esc(m.name) + (m.me ? " <span class=k>(this PC)</span>" : "") + "</td><td>" + esc(m.member) + "</td><td>" + (m.online ? '<span class="ok">online</span>' + (m.sharing ? " · sharing" : "") : '<span class="k">offline</span>') + "</td><td>" + (jobsHtml(m.jobs) || '<span class="k">—</span>') + "</td></tr>";
    }).join("") + "</table>";
  }
  function bind() {
    var q = function (id) { return $(id); };
    if (q("tmPick")) q("tmPick").onclick = function () {
      var p = root.FileDialog && root.FileDialog.open ? root.FileDialog.open({ mode: "dir", title: "The team folder (on the NAS)", okLabel: "Select", key: "teamfolder", start: q("tmFolder").value }) : Promise.resolve(null);
      p.then(function (x) { if (x) q("tmFolder").value = x.path || x.dir || ""; });
    };
    if (q("tmCreate")) q("tmCreate").onclick = function () { act("/api/team/create", { folder: q("tmFolder").value, name: q("tmName").value, me: q("tmMe").value }, "➕ the team is made - you are its leader; members Join with the same folder"); };
    if (q("tmJoin")) q("tmJoin").onclick = function () { act("/api/team/join", { folder: q("tmFolder").value, me: q("tmMe").value }, function (r) { return r.approved ? "⇥ joined" : "⇥ asked to join - the leader approves you, then their bitGen issues your key"; }); };
    if (q("tmLeave")) q("tmLeave").onclick = function () {
      var c = root.appConfirm ? root.appConfirm("This PC leaves the team? It stops rendering for the others and goes back to its own projects folder (restart bitGen).") : Promise.resolve(root.confirm("Leave the team?"));
      Promise.resolve(c).then(function (ok) { if (ok) act("/api/team/leave", {}, function (r) { return r.restart ? "⇤ left the team - restart bitGen for this PC's own projects" : "⇤ left the team"; }); });
    };
    if (q("tmIssue")) q("tmIssue").onclick = function () { act("/api/team/issue", {}, function (r) { return "↻ keys issued: " + ((r.issued || []).join(", ") || "everyone had today's"); }); };
    doc.querySelectorAll("[data-tmok]").forEach(function (b) { b.onclick = function () { act("/api/team/approve", { name: b.dataset.tmok }, "✓ " + b.dataset.tmok + " is in - their key is issued"); }; });
    doc.querySelectorAll("[data-tmrm]").forEach(function (b) { b.onclick = function () {
      var c = root.appConfirm ? root.appConfirm("Remove " + b.dataset.tmrm + " from the team? Their key stops working now, and they get no new one.") : Promise.resolve(root.confirm("Remove?"));
      Promise.resolve(c).then(function (ok) { if (ok) act("/api/team/remove", { name: b.dataset.tmrm }, "🗑 removed"); });
    }; });
    if (q("tmUseProj")) q("tmUseProj").onclick = function () { act("/api/team/projects", { use: true }, "📂 restart bitGen to open the team's projects"); };
    if (q("tmLocalProj")) q("tmLocalProj").onclick = function () { act("/api/team/projects", { use: false }, "📂 restart bitGen for this PC's own projects"); };
    if (q("tmShare")) q("tmShare").onchange = function () { act("/api/team/sharing", { on: this.checked, port: q("tmPort").value }, function (r) { return r.port_error || (r.listening ? "🔌 sharing - others can ask for access" : "🔌 not sharing"); }); };
    if (q("tmPort")) q("tmPort").onchange = function () { act("/api/team/sharing", { on: q("tmShare").checked, port: this.value }); };
    if (q("tmAddr")) q("tmAddr").onchange = function () { act("/api/team/sharing", { on: q("tmShare").checked, port: q("tmPort").value, address: this.value }, "the others reach this PC at " + (this.value || "its network addresses")); };
    doc.querySelectorAll("[data-tmall]").forEach(function (b) { b.onclick = function () {
      var tr = b.closest("[data-tmq]"), m = tr.dataset.tmq;
      var body = b.dataset.tmall === "u" ? { member: m, level: "unrestricted" } : { member: m, level: "window", from: tr.querySelector(".tmF").value, to: tr.querySelector(".tmT").value };
      act("/api/team/grant", body, "✓ " + m + " may render on this PC (" + (body.level === "unrestricted" ? "unrestricted" : "from - to") + ")");
    }; });
    doc.querySelectorAll("[data-tmdeny]").forEach(function (b) { b.onclick = function () { act("/api/team/deny", { member: b.closest("[data-tmq]").dataset.tmq }, "denied"); }; });
    doc.querySelectorAll("[data-tmrev]").forEach(function (b) { b.onclick = function () { act("/api/team/revoke", { member: b.dataset.tmrev }, "↺ " + b.dataset.tmrev + " has no access to this PC now"); }; });
    var body = $("tmBody"); if (body) body.onkeydown = function (e) { e.stopPropagation(); };
  }
  /** a new access request to this PC: said once (the owner decides in Settings ▸ Team) */
  function notify() {
    var r = ((S.st || {}).access || {}).requests || [];
    r.forEach(function (q) {
      var k = q.member + "@" + q.at; if (S.seenReq[k]) return; S.seenReq[k] = 1;
      var t = "👥 " + q.member + " asks to render on this PC - Settings ▸ Team ▸ Allow / Deny";
      if (typeof root.logLine === "function") root.logLine("[team] " + t);
      var c = $("tmChip"); if (c) { c.classList.add("on"); c.title = t; }
    });
  }

  /* ---------------- 🖥 Render on (status bar) */
  function chip() {
    if ($("tmChip")) return;
    var sb = $("statusbar"); if (!sb) return;
    var b = doc.createElement("button"); b.id = "tmChip"; b.type = "button"; b.textContent = "🖥 This PC";
    b.title = "Render on: this PC, a team member's PC (with their access) or spread over them - and the team's renders";
    var anchor = $("sbjobs"); if (anchor) sb.insertBefore(b, anchor); else sb.appendChild(b);
    b.onclick = function (e) { e.stopPropagation(); if ($("tmMenu")) closeMenu(); else openMenu(b); };
    doc.addEventListener("click", function (e) { var m = $("tmMenu"); if (m && !m.contains(e.target)) closeMenu(); });
  }
  function chipPaint() {
    var b = $("tmChip"), s = S.st; if (!b || !s) return;
    b.style.display = s.joined ? "" : "none";
    var t = s.target || "local", m = (s.machines || []).find(function (x) { return x.id === t; });
    b.textContent = t === "local" ? "🖥 This PC" : t === "spread" ? "⚡ Spread" : "🖥 " + (m ? m.member : "a team PC");
    var busy = (s.machines || []).reduce(function (n, x) { return n + (x.jobs || []).filter(function (j) { return j.status === "running"; }).length; }, 0);
    if (busy) b.textContent += " · " + busy + " ▶";
  }
  function closeMenu() { var m = $("tmMenu"); if (m) m.remove(); }
  function openMenu(anchor) {
    closeMenu();
    var m = doc.createElement("div"); m.id = "tmMenu"; m.innerHTML = '<div class="hd">loading the team…</div>';
    doc.body.appendChild(m);
    var r = anchor.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(innerWidth - 450, r.left)) + "px"; m.style.bottom = (innerHeight - r.top + 6) + "px";
    jget("/api/team/targets?fresh=1").then(function (j) { S.targets = j; paintMenu(); });
  }
  function paintMenu() {
    var m = $("tmMenu"); if (!m) return;
    var j = S.targets || {}, t = j.target || "local", h = '<div class="hd">Render on</div>';
    var it = function (id, words, on, off, extra) { return '<div class="it' + (on ? " on" : "") + (off ? " off" : "") + '" data-tmt="' + esc(id) + '">' + words + (extra || "") + "</div>"; };
    h += it("local", "🖥 This PC", t === "local");
    (j.targets || []).forEach(function (x) {
      var ok = x.access && x.access.now !== false && (x.access.level === "unrestricted" || x.access.now);
      var state = !x.online ? '<span class="k">offline</span>' : !x.sharing ? '<span class="k">not sharing</span>' : x.error ? '<span class="bad">' + esc(x.error) + "</span>" : x.access ? '<span class="k">' + esc(accessWords(x.access)) + "</span>" : x.pending ? '<span class="k">asked - waiting for ' + esc(x.member) + "</span>" : '<button class="ghost" type="button" data-tmask="' + esc(x.id) + '">🔒 Ask for access</button>';
      h += it(x.id, "🖥 " + esc(x.member) + ' <span class="k">' + esc(x.name) + "</span> ", t === x.id, !(x.online && x.sharing && ok), " " + state);
    });
    h += it("spread", "⚡ Spread - the least busy of this PC and the PCs I may use", t === "spread");
    if (!j.shared_projects) h += '<div class="hd bad">This PC\'s projects folder is not the team\'s - jobs render here (Settings ▸ Team ▸ Use the team\'s projects folder)</div>';
    var all = (S.st && S.st.machines) || [];
    var runs = all.filter(function (x) { return (x.jobs || []).length; });
    h += '<div class="hd">The team\'s renders</div>' + (runs.length ? runs.map(function (x) { return '<div class="it off">🖥 ' + esc(x.member) + " · " + esc(x.name) + "</div>" + jobsHtml(x.jobs); }).join("") : '<div class="jb k">nothing rendering</div>');
    h += '<div class="it" data-tmopen>👥 Team settings…</div>';
    m.innerHTML = h;
    m.querySelectorAll("[data-tmt]").forEach(function (d) { d.onclick = function (e) {
      if (e.target.closest("[data-tmask]") || d.classList.contains("off")) return;
      jpost("/api/team/target", { target: d.dataset.tmt }).then(function (s) { if (!s.error) { S.st = s; chipPaint(); } closeMenu(); });
    }; });
    m.querySelectorAll("[data-tmask]").forEach(function (b) { b.onclick = function (e) {
      e.stopPropagation(); b.disabled = true;
      jpost("/api/team/ask", { machine: b.dataset.tmask }).then(function (r) { b.outerHTML = r.error ? '<span class="bad">' + esc(r.error) + "</span>" : '<span class="k">asked - the owner allows it in their Settings ▸ Team</span>'; });
    }; });
    var o = m.querySelector("[data-tmopen]"); if (o) o.onclick = function () { closeMenu(); open(); };
  }
  function open() {
    var dlg = $("settings"); if (!dlg) return;
    if (!dlg.open) { if (typeof root.openSettings === "function") root.openSettings(); else dlg.showModal(); }
    var b = doc.querySelector('#settings .stabs [data-stab="team"]'); if (b) b.click();
  }
  function poll() {
    clearInterval(S.timer);
    S.timer = setInterval(function () {
      jget("/api/team/status").then(function (s) {
        S.st = s; chipPaint(); notify();
        var p = $("stab-team"); if (p && p.classList.contains("active") && !p.contains(doc.activeElement)) paint();
        if ($("tmMenu")) paintMenu();
      }).catch(function () { /* the app is busy */ });
    }, 5000);
    load().then(chipPaint);
  }
  root.H3Team = { load: load, open: open, state: function () { return S; }, accessWords: accessWords, pctOf: pctOf, openMenu: function () { openMenu($("tmChip")); } };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { if (!boot()) setTimeout(boot, 1500); }); else if (!boot()) setTimeout(boot, 1500);
})(typeof window !== "undefined" ? window : globalThis);
