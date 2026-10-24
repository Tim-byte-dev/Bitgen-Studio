/* bitGen Studio — ext/promptdock/llmarena.js (2.584.0): 🔁 COMPARE LLMs in the prompt docker's menubar (window.H3Arena).
   Tim: "add a button in the promptdocker top menubar to cycle through llms - let each llm send a response in chat and
   user chooses the one he likes - record the llm , the request and the response - this can keep track of the best llm
   for the job".
     🔁 Compare LLMs   the prompt goes to each ticked LLM in turn (the one in the LLM dropdown first - it is loaded
                       already); each reply shows in the chat under its LLM's name with ✓ Use this one. The one picked
                       is THE answer (written to the chat, read aloud, a song into the Music dock …); ✗ None of them
                       records that none was good. ⏹ Stop skips the LLMs not asked yet.
     ▾                 which LLMs take part (kept in this browser)
     🏆                the best LLM for each job (screenplay, music video, song, image prompt, video prompt, chat):
                       wins, how often it was picked, its average time; every round with the request and every reply;
                       Use = that LLM in the dropdown; ⤓ CSV; 🗑.
   The replies come from core's chatPost (the same system prompt, recall, styles, LoRA keywords and reference dock as
   any chat turn) with `arena` = {id, n}; the server: routes/llmArena.js + lib/llmArena.js (<app>/llm_arena/rounds/).
   2.585.0: 🏆 ▸ 🎓 Train an LLM on your picks - the decided rounds (with the FULL prompt each LLM got) into the 🎓 trainer's
   LLM job: the picked replies as examples (SFT) + picked-vs-not pairs (DPO / ORPO) -> a new .gguf.
   Pure (scripts/test-llmarena584.js): order(files, current, picked), usable(file). */
(function (root) {
  "use strict";
  /** a dropdown entry that is a chat LLM (a vision projector is not) (pure) */
  function usable(f) { return !!f && /\.gguf$/i.test(f) && !/mmproj/i.test(f); }
  /** who answers, in what order: the loaded selection first, then the others as listed; only the ticked ones
   *  (picked = null -> all) (pure) */
  function order(files, current, picked) {
    var list = (files || []).filter(usable).filter(function (f) { return !picked || picked.indexOf(f) !== -1; });
    var seen = {}; list = list.filter(function (f) { if (seen[f]) return false; seen[f] = 1; return true; });
    var i = list.indexOf(current);
    if (i > 0) { list.splice(i, 1); list.unshift(current); }
    return list;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { order: order, usable: usable }; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  var pref = {
    get: function (k, d) { try { var v = localStorage.getItem("h3." + k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("h3." + k, v); } catch (e) { /* private mode */ } },
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function name(f) { return String(f || "").replace(/\.gguf$/i, ""); }
  function jpost(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function jget(u) { return fetch(u).then(function (r) { return r.json(); }); }

  var CSS = ".arena{border:1px solid var(--line,#3a352e);border-radius:8px;padding:6px 8px}.arena .arh{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px;margin-bottom:4px}"
    + ".arena .arst{opacity:.75;font-size:11.5px}.arena .arc{border:1px solid var(--line,#3a352e);border-radius:7px;padding:5px 7px;margin:6px 0}.arena .arc.win{border-color:var(--tiger,#f59e2c);box-shadow:0 0 0 1px var(--tiger,#f59e2c) inset}"
    + ".arena .arc.lose{opacity:.55}.arena .arc .arn{font-size:11.5px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.arena .arc .arn b{color:var(--tiger,#f59e2c)}.arena .arc .cm{border:0;padding:0;margin:0;background:none}"
    + ".arena .arc .cm .who{display:none}.arena .arc.lose .arbody{max-height:3.2em;overflow:hidden}.arena button{font-size:11.5px}.arena .bad{color:#e66}"
    + "#pdArenaPop{position:fixed;z-index:9999;background:var(--panel,#1d1a16);border:1px solid var(--line,#444);border-radius:8px;padding:8px;font-size:12px;max-height:60vh;overflow:auto;min-width:260px;box-shadow:0 8px 24px rgba(0,0,0,.5)}"
    + "#pdArenaPop label{display:flex;gap:6px;align-items:center;padding:2px 0}#pdArenaDlg{width:min(980px,94vw);max-height:88vh}#pdArenaDlg table{width:100%;border-collapse:collapse;font-size:12px}"
    + "#pdArenaDlg td,#pdArenaDlg th{padding:3px 6px;border-bottom:1px solid var(--line,#3a352e);text-align:left;vertical-align:top}#pdArenaDlg .k{opacity:.7;font-size:11px}#pdArenaDlg .best{color:var(--tiger,#f59e2c)}"
    + "#pdArenaDlg details pre{white-space:pre-wrap;font-size:11.5px;margin:4px 0;max-height:260px;overflow:auto}#pdArenaDlg .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}";

  var S = { running: null };

  function files() {
    var sel = $("llmSel"); if (!sel || sel.disabled) return [];
    return Array.prototype.map.call(sel.options, function (o) { return o.value; }).filter(usable);
  }
  function picked() { try { var v = JSON.parse(pref.get("arenaLlms", "null")); return Array.isArray(v) ? v : null; } catch (e) { return null; } }
  function lineup() { return order(files(), ($("llmSel") || {}).value || "", picked()); }
  function paintBtn() {
    var b = $("pdArena"); if (!b) return;
    var sel = $("llmSel"), ext = sel && sel.disabled, n = lineup().length;
    b.disabled = !!S.running || ext || n < 2;
    b.title = ext ? "One external LLM endpoint is set (Settings ▸ LLM) - there is nothing to compare"
      : n < 2 ? "Tick at least two LLMs (▾) - each one answers the prompt and you pick the reply you like"
      : "Ask " + n + " LLMs the prompt, one after the other - each reply shows in the chat under its LLM's name; pick the one you like. Every round is recorded (🏆 = the best LLM for each job)";
    b.textContent = "🔁 Compare LLMs" + (n >= 2 ? " (" + n + ")" : "");
  }

  /* ---------------- ▾ who takes part */
  function openPick(anchor) {
    var old = $("pdArenaPop"); if (old) { old.remove(); return; }
    var all = files(), p = picked();
    var pop = doc.createElement("div"); pop.id = "pdArenaPop";
    pop.innerHTML = '<div style="opacity:.75;margin-bottom:4px">LLMs in 🔁 Compare LLMs</div>'
      + (all.length ? all.map(function (f) { return '<label><input type="checkbox" value="' + esc(f) + '"' + (!p || p.indexOf(f) !== -1 ? " checked" : "") + "> " + esc(name(f)) + "</label>"; }).join("")
        : '<div class="k">no LLMs in the LLM folder (Settings ▸ LLM)</div>')
      + '<div style="display:flex;gap:6px;margin-top:6px"><button class="ghost" type="button" data-a="all">All</button><button class="ghost" type="button" data-a="none">None</button></div>';
    doc.body.appendChild(pop);
    var r = anchor.getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(innerWidth - 300, r.left)) + "px"; pop.style.top = (r.bottom + 4) + "px";
    var save = function () { var on = Array.prototype.filter.call(pop.querySelectorAll("input"), function (x) { return x.checked; }).map(function (x) { return x.value; }); pref.set("arenaLlms", JSON.stringify(on)); paintBtn(); };
    pop.querySelectorAll("input").forEach(function (x) { x.onchange = save; });
    pop.querySelectorAll("[data-a]").forEach(function (b) { b.onclick = function () { pop.querySelectorAll("input").forEach(function (x) { x.checked = b.dataset.a === "all"; }); save(); }; });
    setTimeout(function () { doc.addEventListener("mousedown", function off(e) { if (!pop.contains(e.target) && e.target !== anchor) { pop.remove(); doc.removeEventListener("mousedown", off); } }); }, 0);
  }

  /** the replies are read in the Prompt chat docker - closed or collapsed, it opens */
  function showChat() {
    var el = $("chatdock"); if (!el) return;
    var G = root.H3GoneDocks || {}, btn = Object.keys(G).find(function (b) { return G[b] === "chatdock"; });
    try {
      if (el.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone("chatdock", btn);
      if (el.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse("chatdock");
    } catch (e) { /* the chat still fills */ }
  }
  /* ---------------- 🔁 a round */
  async function run() {
    var box = $("prompt"), t = String((box && box.value) || "").trim();
    var list = lineup();
    if (!t) { if (box) { box.focus(); box.placeholder = "Type the prompt first - every LLM answers it, you pick the best reply"; } return; }
    if (list.length < 2 || S.running) return;
    if (typeof root.chatBusyNow === "function" && root.chatBusyNow()) return;
    if (typeof root.chatPost !== "function" || typeof root.chatAdd !== "function") { alert("This bitGen core is older than the 🔁 Compare LLMs extension - update the core."); return; }
    var gm = $("genModeSel") ? $("genModeSel").value : "video";
    var st = await jpost("/api/llmarena/start", { text: t, gen_mode: gm, llms: list });
    if (st.error) { root.chatAdd("assistant", "⚠ " + st.error); return; }
    S.running = { id: st.id, stop: false }; paintBtn();
    root.chatSetBusy && root.chatSetBusy(true);
    showChat();
    root.chatAdd("user", t);
    box.value = ""; box.dispatchEvent(new Event("input", { bubbles: true }));
    // the round's own message in the chat
    var host = root.chatAdd("assistant", "");
    host.classList.add("arena"); host.dataset.arena = st.id;
    Array.prototype.slice.call(host.querySelectorAll(".ctext")).forEach(function (x) { x.remove(); });
    var head = doc.createElement("div"); head.className = "arh";
    head.innerHTML = "<b>🔁 " + list.length + " LLMs</b> <span class=k>" + esc(st.kind) + '</span><span class="arst"></span><span class="arbest k"></span>'
      + '<button class="ghost" type="button" data-stop title="Do not ask the LLMs that have not answered yet">⏹ Stop</button>'
      + '<button class="ghost" type="button" data-none hidden title="None of the replies is good - recorded as such, nothing goes into the chat">✗ None of them</button>';
    host.appendChild(head);
    var stEl = head.querySelector(".arst");
    jget("/api/llmarena/stats").then(function (s) {
      var k = (s.kinds || []).find(function (x) { return x.kind === st.kind; });
      if (k && k.best) { var b = k.llms[0]; head.querySelector(".arbest").textContent = "· best so far for " + st.kind + ": " + name(k.best) + " (" + b.wins + " of " + b.entered + ")"; }
    }).catch(function () { /* no scores yet */ });
    head.querySelector("[data-stop]").onclick = function () { S.running && (S.running.stop = true); this.disabled = true; stEl.textContent = "stopping after this reply…"; };
    head.querySelector("[data-none]").onclick = function () { choose(host, st.id, -1); };
    var got = 0;
    for (var n = 0; n < list.length; n++) {
      if (S.running.stop) break;
      var f = list[n];
      stEl.textContent = (n + 1) + "/" + list.length + " · " + name(f) + (n === 0 ? " answering…" : " loading + answering… (a model that is not loaded takes a while)");
      var t0 = Date.now(), r = null, j = null;
      try { var out = await root.chatPost(t, f, { id: st.id, n: n }); r = out.r; j = out.j; }
      catch (e) { j = { error: (e && e.message) || "request failed" }; }
      var card = doc.createElement("div"); card.className = "arc"; card.dataset.n = n; card.dataset.llm = f;
      var secs = (j && j.arena && j.arena.secs) || Math.round((Date.now() - t0) / 100) / 10;
      var ok = r && r.ok && j && typeof j.reply === "string";
      card.innerHTML = '<div class="arn">🤖 <b>' + esc(name(f)) + "</b> <span class=k>" + secs + " s</span>"
        + (ok ? '<button class="ghost" type="button" data-use title="This reply is the answer: it goes into the chat (and the Music dock for a song); the round is recorded">✓ Use this one</button>' : "") + "</div>";
      var body = doc.createElement("div"); body.className = "arbody";
      if (ok) {
        var el = root.chatAdd("assistant", j.reply);       // the chat's own rendering (code blocks, copy) moved into the card
        el.remove(); body.appendChild(el);
        card._reply = j;
        got++;
      } else body.innerHTML = '<div class="bad">⚠ ' + esc((j && j.error) || "the LLM did not answer") + "</div>";
      card.appendChild(body);
      host.appendChild(card);
      var use = card.querySelector("[data-use]");
      if (use) use.onclick = (function (nn) { return function () { choose(host, st.id, nn); }; })(n);
      var log = $("chatlog"); if (log) log.scrollTop = log.scrollHeight;
    }
    stEl.textContent = (S.running.stop ? "stopped · " : "") + got + " repl" + (got === 1 ? "y" : "ies") + " - pick the one you like";
    head.querySelector("[data-stop]").hidden = true;
    head.querySelector("[data-none]").hidden = !got;
    S.running = null; paintBtn();
    root.chatSetBusy && root.chatSetBusy(false);
  }
  async function choose(host, id, n) {
    if (host.dataset.done) return;
    var r = await jpost("/api/llmarena/pick", { id: id, n: n });
    if (r.error) { alert(r.error); return; }
    host.dataset.done = "1";
    host.querySelectorAll(".arc").forEach(function (c) { c.classList.add(+c.dataset.n === n ? "win" : "lose"); var b = c.querySelector("[data-use]"); if (b) b.remove(); });
    var hn = host.querySelector("[data-none]"); if (hn) hn.remove();
    var stEl = host.querySelector(".arst");
    if (r.chosen) {
      stEl.textContent = "✓ " + r.chosen.name + "'s reply is the answer - recorded (🏆)";
      var w = host.querySelector('.arc[data-n="' + n + '"] .arn'); if (w) w.insertAdjacentHTML("beforeend", '<span class="k">✓ chosen</span>');
      if (typeof root.chatApplyReply === "function") root.chatApplyReply({ reply: r.chosen.reply, song: r.chosen.song });
    } else stEl.textContent = "✗ none of them - recorded (🏆)";
    host.querySelectorAll(".arc.lose .arn").forEach(function (a) {
      var t = doc.createElement("button"); t.className = "ghost"; t.type = "button"; t.textContent = "show";
      t.onclick = function () { var c = a.closest(".arc"); c.classList.toggle("lose"); t.textContent = c.classList.contains("lose") ? "show" : "hide"; };
      a.appendChild(t);
    });
  }

  /* ---------------- 🏆 the best LLM for each job */
  function dlg() {
    var d = $("pdArenaDlg");
    if (d) return d;
    d = doc.createElement("dialog"); d.id = "pdArenaDlg";
    d.innerHTML = '<div class="row" style="justify-content:space-between"><b>🏆 The best LLM for the job</b><button class="ghost" type="button" data-x>✕</button></div>'
      + '<div class="row"><label>Job</label><select id="pdArenaKind"></select><span class="k" id="pdArenaSum"></span></div>'
      + '<div id="pdArenaScore"></div>'
      // 2.585.0: 🎓 your picks as a training set for the trainer's LLM fine-tune (SFT examples + DPO / ORPO pairs)
      + '<h4 style="margin:10px 0 4px;font-size:12.5px">🎓 Train an LLM on your picks</h4><div id="pdArenaTrain"></div>'
      + '<h4 style="margin:10px 0 4px;font-size:12.5px">Rounds</h4><div id="pdArenaRounds"></div>'
      + '<div class="row" style="justify-content:flex-end"><a class="ghost" href="/api/llmarena/export.csv" download="llm-compare.csv" style="text-decoration:none;padding:3px 8px;border:1px solid var(--line,#444);border-radius:6px">⤓ Export CSV</a>'
      + '<button class="ghost" type="button" data-clear>🗑 Clear all</button></div>';
    doc.body.appendChild(d);
    d.querySelector("[data-x]").onclick = function () { d.close(); };
    d.querySelector("#pdArenaKind").onchange = paintDlg;
    d.querySelector("[data-clear]").onclick = function () {
      var c = root.appConfirm ? root.appConfirm("Delete every recorded round? The scores start again from nothing.") : Promise.resolve(root.confirm("Delete every round?"));
      Promise.resolve(c).then(function (ok) { if (ok) jpost("/api/llmarena/clear").then(paintDlg); });
    };
    d.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") d.close(); });
    return d;
  }
  async function openScores() {
    var d = dlg(); if (!d.open) d.showModal();
    await paintDlg();
  }
  async function paintDlg() {
    var d = dlg(), sel = d.querySelector("#pdArenaKind");
    var s = await jget("/api/llmarena/stats");
    var want = sel.value || pref.get("arenaKind", "all");
    var kinds = (s.kinds || []).map(function (k) { return k.kind; });
    sel.innerHTML = ["all"].concat((s.KINDS || [])).map(function (k) { return '<option value="' + k + '"' + (k === want ? " selected" : "") + ">" + (k === "all" ? "every job" : k) + (kinds.indexOf(k) === -1 && k !== "all" ? " (no rounds)" : "") + "</option>"; }).join("");
    pref.set("arenaKind", sel.value);
    var k = (s.kinds || []).find(function (x) { return x.kind === sel.value; });
    d.querySelector("#pdArenaSum").textContent = s.rounds + " round(s) recorded, " + s.decided + " decided";
    d.querySelector("#pdArenaScore").innerHTML = !k ? '<div class="k">No decided rounds for this job yet - 🔁 Compare LLMs, then ✓ the reply you like.</div>'
      : "<table><tr><th>LLM</th><th>Picked</th><th>Took part</th><th>Win %</th><th>Avg time</th><th>Failed</th><th></th></tr>"
        + k.llms.map(function (x, i) { return "<tr" + (i === 0 && x.wins ? ' class="best"' : "") + "><td>" + (i === 0 && x.wins ? "🏆 " : "") + esc(x.name) + "</td><td>" + x.wins + "</td><td>" + x.entered + "</td><td>" + x.rate + "%</td><td>" + x.avg_secs + " s</td><td>" + (x.errors || "") + '</td><td><button class="ghost" type="button" data-use="' + esc(x.llm) + '" title="Make it the chat LLM (the LLM dropdown) - it loads now">Use</button></td></tr>'; }).join("")
        + "</table>" + (k.none ? '<div class="k">' + k.none + " round(s): none of them was good</div>" : "");
    d.querySelectorAll("#pdArenaScore [data-use]").forEach(function (b) { b.onclick = function () {
      var ls = $("llmSel"); if (!ls) return;
      if (!Array.prototype.some.call(ls.options, function (o) { return o.value === b.dataset.use; })) { alert(name(b.dataset.use) + " is not in the LLM folder any more"); return; }
      ls.value = b.dataset.use; ls.dispatchEvent(new Event("change")); b.textContent = "✓ in use"; paintBtn();
    }; });
    paintTrain(sel.value);
    var rs = await jget("/api/llmarena/rounds?limit=60&kind=" + encodeURIComponent(sel.value));
    d.querySelector("#pdArenaRounds").innerHTML = !(rs.rounds || []).length ? '<div class="k">none yet</div>'
      : "<table><tr><th>When</th><th>Job</th><th>Request</th><th>Chosen</th><th></th></tr>" + rs.rounds.map(function (r) {
          var ch = r.chosen == null ? '<span class="k">not picked</span>' : r.chosen === -1 ? '<span class="k">none of them</span>' : esc(name((r.candidates.find(function (c) { return c.n === r.chosen; }) || {}).llm));
          var pc = (r.prompt || []).reduce(function (a, m) { return a + String(m.content || "").length; }, 0);
          return "<tr><td class=k>" + esc(new Date(r.t).toLocaleString()) + "</td><td>" + esc(r.kind) + "</td><td><details><summary>" + esc(r.request.slice(0, 90)) + (r.request.length > 90 ? "…" : "") + "</summary>"
            + "<pre>" + esc(r.request) + "</pre>"
            + ((r.prompt || []).length ? '<details><summary class="k">the full prompt the LLMs got: ' + r.prompt.length + " messages, ≈" + Math.ceil(pc / 3.5) + " tokens</summary><pre>" + esc(r.prompt.map(function (m) { return "[" + m.role + "]\n" + m.content; }).join("\n\n")) + "</pre></details>" : '<div class="k">only the request was kept (a round from before 2.585.0)</div>') + (r.candidates || []).map(function (c) { return "<div><b" + (c.n === r.chosen ? ' class="best"' : "") + ">" + (c.n === r.chosen ? "✓ " : "") + esc(name(c.llm)) + "</b> <span class=k>" + c.secs + " s</span><pre>" + esc(c.error ? "⚠ " + c.error : c.reply) + "</pre></div>"; }).join("")
            + "</details></td><td>" + ch + '</td><td><button class="ghost" type="button" data-del="' + r.id + '" title="Delete this round">🗑</button></td></tr>';
        }).join("") + "</table>";
    d.querySelectorAll("#pdArenaRounds [data-del]").forEach(function (b) { b.onclick = function () { jpost("/api/llmarena/delete", { id: b.dataset.del }).then(paintDlg); }; });
  }

  /* ---------------- 🎓 the training set (2.585.0) */
  async function paintTrain(kind) {
    var host = $("pdArenaTrain"); if (!host) return;
    var inc = pref.get("arenaTrainSys", "1") !== "0";
    var t = await jget("/api/llmarena/trainset?kind=" + encodeURIComponent(kind || "all") + "&include_system=" + (inc ? "1" : "0"));
    var jobs = t.jobs || [], want = pref.get("arenaTrainJob", "");
    if (!jobs.some(function (j) { return j.name === want; })) want = jobs.length ? jobs[0].name : "";
    host.innerHTML = '<div class="k">' + (kind && kind !== "all" ? "The job “" + esc(kind) + "”: " : "Every job: ") + t.rounds + " decided round(s) → <b>" + t.chats + "</b> examples (the replies you picked) + <b>" + t.prefs + "</b> preference pairs (picked vs not picked)"
      + (t.rounds ? " · the longest ≈" + t.longest_tokens + " tokens" : "") + (t.without_prompt ? " · " + t.without_prompt + " older round(s) have only the request, not bitGen's full prompt" : "") + "</div>"
      + '<div class="row"><label>Into the trainer\'s LLM job</label><select id="pdTrJob">' + jobs.map(function (j) { return '<option value="' + esc(j.name) + '"' + (j.name === want ? " selected" : "") + ">💬 " + esc(j.name) + " (" + (j.examples || 0) + " chats, " + (j.prefs || 0) + " pairs" + (j.objective && j.objective !== "sft" ? ", " + j.objective.toUpperCase() : "") + ")</option>"; }).join("")
      + '<option value=""' + (!want ? " selected" : "") + ">＋ a new LLM job…</option></select>"
      + '<input type="text" id="pdTrNew" placeholder="new job name" style="width:150px' + (want ? ";display:none" : "") + '" value="my_assistant">'
      + '<select id="pdTrWhat"><option value="both">examples + pairs</option><option value="chats">examples only (SFT)</option><option value="prefs">pairs only (DPO / ORPO)</option></select>'
      + '<label title="bitGen\'s instructions (styles, guides, LoRA keywords, references) - the model learns to answer inside bitGen as it is asked there. Off: only the conversation."><input type="checkbox" id="pdTrSys"' + (inc ? " checked" : "") + "> with bitGen's instructions</label>"
      + '<button class="ghost" type="button" id="pdTrGo"' + (t.rounds ? "" : " disabled") + ">⤒ Send to the trainer</button></div>"
      + '<div class="k" id="pdTrMsg">Then 🎓 LoRA trainer ▸ that job ▸ Job ▸ Learn from: Examples (SFT) or Preferences (DPO / ORPO) ▸ ▶ Start - the new .gguf lands in the LLM folder. A few hundred picks make a difference; Max length must fit the longest.</div>';
    var js = $("pdTrJob"), nn = $("pdTrNew");
    js.onchange = function () { nn.style.display = js.value ? "none" : ""; pref.set("arenaTrainJob", js.value); };
    $("pdTrSys").onchange = function () { pref.set("arenaTrainSys", this.checked ? "1" : "0"); paintTrain(kind); };
    $("pdTrGo").onclick = async function () {
      var name = js.value || nn.value.trim(); if (!name) { nn.focus(); return; }
      this.disabled = true;
      var r = await jpost("/api/llmarena/to-trainer", { job: name, kind: kind || "all", what: $("pdTrWhat").value, include_system: $("pdTrSys").checked });
      this.disabled = false;
      var m = $("pdTrMsg");
      if (r.error) { m.innerHTML = '<span class="bad">' + esc(r.error) + "</span>"; return; }
      pref.set("arenaTrainJob", r.job);
      m.innerHTML = "✓ " + (r.created ? "made the LLM job " : "into ") + "<b>" + esc(r.job) + "</b>: +" + r.chats_added + " examples (" + r.chats + " in all), +" + r.prefs_added + " pairs (" + r.prefs + " in all)"
        + (r.longest_tokens > (r.max_seq || 0) ? ' · <span class="bad">the longest is ≈' + r.longest_tokens + " tokens - raise the job's Max length (" + r.max_seq + ") or longer ones are left out</span>" : "")
        + ' <button class="ghost" type="button" id="pdTrOpen">🎓 Open the trainer</button>';
      $("pdTrOpen").onclick = function () { if (root.H3LoraTrain) { root.H3LoraTrain.show(true); root.H3LoraTrain.load().then(function () { root.H3LoraTrain.select(r.job); }); } };
    };
  }

  function boot() {
    var bar = $("pmBar"); if (!bar || $("pdArena")) return;
    var st = doc.createElement("style"); st.textContent = CSS; doc.head.appendChild(st);
    var wrap = doc.createElement("span"); wrap.style.cssText = "display:inline-flex;gap:2px;align-items:center";
    wrap.innerHTML = '<button class="ghost gbtn" id="pdArena" type="button">🔁 Compare LLMs</button>'
      + '<button class="ghost gbtn" id="pdArenaWho" type="button" title="Which LLMs take part in 🔁 Compare LLMs" aria-label="Which LLMs take part">▾</button>'
      + '<button class="ghost gbtn" id="pdArenaScores" type="button" title="🏆 The best LLM for each job - the scores and every recorded round" aria-label="LLM scores">🏆</button>';
    var after = $("promptClear"); if (after) after.after(wrap); else bar.appendChild(wrap);
    $("pdArena").onclick = run;
    $("pdArenaWho").onclick = function () { openPick(this); };
    $("pdArenaScores").onclick = openScores;
    var ls = $("llmSel");
    if (ls) { ls.addEventListener("change", paintBtn); new MutationObserver(paintBtn).observe(ls, { childList: true, attributes: true, attributeFilter: ["disabled"] }); }
    paintBtn();
  }
  root.H3Arena = { run: run, openScores: openScores, lineup: lineup, order: order, state: function () { return S; } };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  setTimeout(boot, 1500);
})(typeof window !== "undefined" ? window : globalThis);
