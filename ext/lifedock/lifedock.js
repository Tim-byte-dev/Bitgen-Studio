/* bitGen Studio — ext/lifedock/lifedock.js (2.944.0): 🎓 LIFE CHOICES - the 2D board, your turns, the bots, the saves (window.H3Life).
 * The rules are lifecore.js (window.H3LifeCore), the puzzles lifepuzzles.js (window.H3LifePuzzles), the high scores
 * lifeserver.js (GET / POST /api/life-choices/scores).
 *   The board   a top-down canvas of rings: high school in the centre, college and the apprenticeship around it (the
 *               factory goes straight out), the jobs ring, the investment ring outside; every square drawn with its
 *               kind, properties with their price and the owner's colour; the players' pieces; hover = what a square does
 *   Your turn   🎲 Roll (one square a turn on the apprenticeship), a puzzle with a timer (choices 1-4, or type the answer),
 *               choices as buttons (a greyed one says why), Enter rolls / carries on
 *   The bots    rule-based players (careful saver, property tycoon, risk-taker) that answer right as often as the setup says
 *               - normal, fast or instant; they only play while the docker is on screen
 *   Saved       the whole game in localStorage h3.life.save after every move (a reload carries on, the puzzle too)
 * window.H3Life: newGame(opts), state(), act(), info() (tests)
 */
(function (root) {
  "use strict";
  var doc = root.document, C = root.H3LifeCore, P = root.H3LifePuzzles;
  if (!doc || !C || !P) return;
  var $ = function (id) { return doc.getElementById(id); };
  var LS = {
    get: function (k, d) { try { var v = root.localStorage.getItem("h3.life." + k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { root.localStorage.setItem("h3.life." + k, String(v)); } catch (e) { /* private mode */ } },
  };
  try { if (root.localStorage.getItem("h3.g.lifedock") == null) root.localStorage.setItem("h3.g.lifedock", "1"); } catch (e) { /* fine */ }
  var G = { s: null, geo: null, timer: 0, botT: 0, hover: null, speed: LS.get("speed", "normal"), posted: false };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var M = function (v) { return C.money(v); };
  var k$ = function (v) { return v >= 1e6 ? "$" + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + "m" : "$" + Math.round(v / 1000) + "k"; };

  /* ---------------- saving ---------------- */
  function save() { if (!G.s) return; try { root.localStorage.setItem("h3.life.save", JSON.stringify(G.s)); } catch (e) { /* full / private */ } }
  function load() { try { var j = JSON.parse(root.localStorage.getItem("h3.life.save") || "null"); return j && j.v === 1 && j.players ? j : null; } catch (e) { return null; } }

  /* ---------------- the board's shape ---------------- */
  var D = Math.PI / 180;
  // [ring, inner, outer (x R), first angle, last angle]: college the top 240°, the apprenticeship the bottom 90°
  var LAY = { invest: [0.80, 0.97, -90, 270], jobs: [0.62, 0.78, -90, 270], college: [0.44, 0.60, -210, 30], trade: [0.44, 0.60, 45, 135], hs: [0.25, 0.41, -90, 270] };
  var FACTORY_A = 142;
  var COL = { quiz: "#3f6fd8", math: "#25897c", word: "#9354c4", exam: "#c98227", finals: "#d0622a", allowance: "#3a9a4a", parttime: "#3a9a4a", overtime: "#3a9a4a",
              bonus: "#3a9a4a", expense: "#a84545", rates: "#a84545", tools: "#a84545", prop: "#5d4f36", exchange: "#2a72b0", bank: "#b8921d", news: "#6d6d78",
              night: "#7b62c6", offers: "#3f82c2", promo: "#c49530", restructure: "#943b3b", library: "#3f7f8f", seminar: "#3f7f8f", study: "#3f7f8f",
              enrol: "#546274", induct: "#546274", workshop: "#546274", licence: "#c98227", skill: "#25897c" };
  var ICON = { quiz: "❓", math: "➗", word: "🔤", exam: "📝", finals: "🎓", allowance: "💵", parttime: "💵", overtime: "⏱", bonus: "🎁", expense: "🧾", rates: "🧾",
               tools: "🧰", prop: "🏠", exchange: "📈", bank: "🏦", news: "📰", night: "🌙", offers: "💼", promo: "⬆", restructure: "✂", library: "📚", seminar: "🗣",
               study: "📐", enrol: "🏫", induct: "🦺", workshop: "🔩", licence: "📜", skill: "📏" };
  function geometry(w, h) {
    var R = Math.min(w, h) / 2 - 6, cx = w / 2, cy = h / 2, sq = [];
    Object.keys(LAY).forEach(function (ring) {
      var L = LAY[ring], list = C.RINGS[ring], n = list.length, span = L[3] - L[2], full = span >= 360, step = span / n;
      list.forEach(function (q, i) {
        var a0 = (L[2] + i * step) * D, a1 = (L[2] + (i + 1) * step) * D, pad = Math.min(0.02, step * D * 0.08);
        sq.push({ ring: ring, i: i, kind: q[0], name: q[1], r0: L[0] * R, r1: L[1] * R, a0: a0 + pad, a1: a1 - pad, full: full,
                  cx: cx + Math.cos((a0 + a1) / 2) * (L[0] + L[1]) / 2 * R, cy: cy + Math.sin((a0 + a1) / 2) * (L[0] + L[1]) / 2 * R });
      });
    });
    return { w: w, h: h, R: R, cx: cx, cy: cy, sq: sq };
  }
  function find(g, ring, i) { for (var k = 0; k < g.sq.length; k++) if (g.sq[k].ring === ring && g.sq[k].i === i) return g.sq[k]; return null; }
  function hit(g, x, y) {
    var dx = x - g.cx, dy = y - g.cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    for (var k = 0; k < g.sq.length; k++) {
      var q = g.sq[k]; if (r < q.r0 || r > q.r1) continue;
      for (var t = -1; t <= 1; t++) { var aa = a + t * 2 * Math.PI; if (aa >= q.a0 && aa <= q.a1) return q; }
    }
    return r < LAY.hs[0] * g.R ? { ring: "centre" } : null;
  }

  /* ---------------- drawing ---------------- */
  function draw() {
    var cv = $("lcBoard"), wrap = $("lcBoardWrap"); if (!cv || !wrap) return;
    var w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var g = G.geo = geometry(w, h), x = cv.getContext("2d"), s = G.s;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    // ring captions behind the squares
    var bg = x.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.R);
    bg.addColorStop(0, "#1a2340"); bg.addColorStop(1, "#0b1020"); x.fillStyle = bg; x.fillRect(0, 0, w, h);
    // the factory's spoke: straight out from the centre to the investment ring
    var fa = FACTORY_A * D; x.save(); x.strokeStyle = "rgba(255,190,90,.55)"; x.setLineDash([5, 5]); x.lineWidth = 2;
    x.beginPath(); x.moveTo(g.cx + Math.cos(fa) * 0.2 * g.R, g.cy + Math.sin(fa) * 0.2 * g.R); x.lineTo(g.cx + Math.cos(fa) * 0.8 * g.R, g.cy + Math.sin(fa) * 0.8 * g.R); x.stroke(); x.restore();
    var cur = s && !s.over ? C.current(s) : null;
    g.sq.forEach(function (q) {
      x.beginPath(); x.arc(g.cx, g.cy, q.r1, q.a0, q.a1); x.arc(g.cx, g.cy, q.r0, q.a1, q.a0, true); x.closePath();
      x.fillStyle = COL[q.kind] || "#444"; x.globalAlpha = 0.9; x.fill(); x.globalAlpha = 1;
      var here = cur && cur.ring === q.ring && cur.pos === q.i;
      x.lineWidth = here ? 2.5 : 1; x.strokeStyle = here ? "#fff" : "rgba(0,0,0,.45)"; x.stroke();
      if (q.ring === "invest" && q.kind === "prop" && s) {                       // the owner's colour on the outer edge
        var pr = s.props[q.i]; if (pr && pr.owner >= 0) { x.beginPath(); x.arc(g.cx, g.cy, q.r1 - 3, q.a0, q.a1); x.strokeStyle = s.players[pr.owner].color; x.lineWidth = 5; x.stroke(); }
      }
      if (G.hover === q) { x.beginPath(); x.arc(g.cx, g.cy, q.r1, q.a0, q.a1); x.arc(g.cx, g.cy, q.r0, q.a1, q.a0, true); x.closePath(); x.fillStyle = "rgba(255,255,255,.14)"; x.fill(); }
      // the words: an icon, a short name, the price on property
      var band = q.r1 - q.r0, arcLen = (q.a1 - q.a0) * (q.r0 + q.r1) / 2, fs = Math.max(7, Math.min(12, band * 0.24, arcLen * 0.2));
      x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
      x.font = Math.round(fs * 1.25) + "px system-ui, sans-serif"; x.fillText(ICON[q.kind] || "", q.cx, q.cy - fs * 0.75);
      x.font = "600 " + Math.round(fs) + "px system-ui, sans-serif";
      var label = q.name.length > 11 && arcLen < 80 ? q.name.split(" ")[0] : q.name;
      if (arcLen > 26) x.fillText(label.length * fs * 0.55 > arcLen ? label.slice(0, Math.max(3, Math.floor(arcLen / (fs * 0.55)))) : label, q.cx, q.cy + fs * 0.45);
      if (q.ring === "invest" && q.kind === "prop" && s && s.props[q.i]) { x.font = Math.round(fs * 0.9) + "px system-ui, sans-serif"; x.fillStyle = "#ffe9a8"; x.fillText(k$(s.props[q.i].value), q.cx, q.cy + fs * 1.45); }
    });
    // ring names
    x.font = "600 10px system-ui, sans-serif"; x.fillStyle = "rgba(255,255,255,.55)"; x.textAlign = "center";
    var pill = function (t, px, py, col) { var tw = x.measureText(t).width + 10; x.fillStyle = "rgba(11,16,32,.85)"; x.fillRect(px - tw / 2, py - 7, tw, 14); x.fillStyle = col || "rgba(255,255,255,.7)"; x.fillText(t, px, py + 0.5); };
    x.textBaseline = "middle";
    [["INVESTMENT", 0.985], ["JOBS", 0.79], ["COLLEGE", 0.61]].forEach(function (t) { pill(t[0], g.cx, g.cy - t[1] * g.R); });
    pill("APPRENTICESHIP", g.cx, g.cy + 0.61 * g.R);
    pill("🏭 FACTORY ➜", g.cx + Math.cos(fa) * 0.52 * g.R, g.cy + Math.sin(fa) * 0.52 * g.R, "rgba(255,200,120,.95)");
    // the centre: high school's heart + the fork
    x.beginPath(); x.arc(g.cx, g.cy, LAY.hs[0] * g.R - 3, 0, Math.PI * 2); x.fillStyle = "#121a33"; x.fill();
    x.fillStyle = "#fff"; x.font = "800 " + Math.round(Math.max(10, g.R * 0.055)) + "px system-ui, sans-serif"; x.fillText("LIFE", g.cx, g.cy - g.R * 0.05);
    x.fillText("CHOICES", g.cx, g.cy + g.R * 0.03); x.font = Math.round(Math.max(8, g.R * 0.03)) + "px system-ui, sans-serif"; x.fillStyle = "rgba(255,255,255,.6)";
    x.fillText("HIGH SCHOOL ➜ THE FORK", g.cx, g.cy + g.R * 0.1);
    // the pieces
    if (s) s.players.forEach(function (p, i) {
      var q = p.ring === "fork" ? { cx: g.cx, cy: g.cy - g.R * 0.15 } : find(g, p.ring, p.pos); if (!q) return;
      var n = s.players.length, a = (i / n) * Math.PI * 2, off = n > 1 ? Math.min(10, g.R * 0.03) : 0, r = Math.max(5, g.R * 0.026);
      var px = q.cx + Math.cos(a) * off, py = q.cy + Math.sin(a) * off;
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fillStyle = p.retired ? "rgba(140,140,140,.6)" : p.color; x.fill();
      x.lineWidth = cur === p ? 2.5 : 1.2; x.strokeStyle = cur === p ? "#fff" : "#000"; x.stroke();
      x.fillStyle = "#000"; x.font = "700 " + Math.round(r * 1.1) + "px system-ui, sans-serif"; x.fillText(p.name.charAt(0).toUpperCase(), px, py + 0.5);
    });
  }
  /** what a square does, for the hover tip */
  function squareText(q) {
    var s = G.s, t = "<b>" + esc(q.name) + "</b><br>";
    var T = { quiz: "A quiz question - right = money + IQ.", math: "A maths puzzle.", word: "A word puzzle.", exam: "A puzzle on any topic.", finals: "A university-level exam.",
              allowance: "Pocket money.", parttime: "Part-time pay.", overtime: "Overtime pay (with a job).", bonus: "A bonus (with a job).", expense: "A bill to pay.",
              rates: "Rates and land tax: 1% of your property.", tools: "Buy your tools.", exchange: "Buy and sell shares.", bank: q.ring === "jobs" ? "With a steady income: move out to the investment ring." : "Loans (up to 5x your salary), repay, sell property.",
              news: "Market news moves a company or the property market.", night: "Night school: study for a degree while you work.", offers: "Job offers for your IQ and qualification.",
              promo: "A work puzzle - right = a promotion.", restructure: "A chance of losing your job (less with a high IQ).", library: "IQ +1.", seminar: "IQ +1.", study: "A maths exam.",
              enrol: "The start of the college year.", induct: "Your first day.", workshop: "Learning on the job.", licence: "Your trade licence - then the jobs ring.", skill: "A trade puzzle." };
    t += T[q.kind] || "";
    if (q.kind === "prop" && s) { var pr = s.props[q.i]; t += "Property: " + M(pr.value) + (pr.owner >= 0 ? "<br>Owner: " + esc(s.players[pr.owner].name) : "<br>For sale") + "<br>Rent if you land here: " + M(pr.value * C.MONEY.rentFrac); }
    return t;
  }

  /* ---------------- the side panel ---------------- */
  var RINGNAME = { hs: "High school", fork: "The fork", college: "College", trade: "Apprentice", jobs: "Jobs ring", invest: "Investment ring" };
  function players() {
    var s = G.s, b = $("lcPlayers"); if (!b) return;
    if (!s) { b.innerHTML = ""; return; }
    var cur = s.over ? null : C.current(s);
    b.innerHTML = "<table><tr><th>Player</th><th>Age</th><th class=\"n\">Cash</th><th>IQ</th><th>Where / work</th><th class=\"n\">Worth</th></tr>" + s.players.map(function (p) {
      var work = p.job ? p.job.title : p.ring === "fork" ? "choosing" : RINGNAME[p.ring];
      return "<tr class=\"" + (p === cur ? "now" : "") + (p.retired ? " out" : "") + "\" title=\"" + esc(RINGNAME[p.ring] + " · " + p.qual + (p.loan ? " · loan " + M(p.loan) : "") + (p.studentDebt ? " · student debt " + M(p.studentDebt) : "") + (p.bot ? " · " + C.PERSONAS[p.bot] : "")) + "\">" +
        "<td><span class=\"dot\" style=\"background:" + p.color + "\"></span>" + esc(p.name) + (p.bot ? " 🤖" : "") + (p.retired ? (p.bankrupt ? " 💥" : " 🏖") : "") + "</td><td>" + Math.floor(p.age) +
        "</td><td class=\"n\">" + M(p.cash) + "</td><td>" + p.iq + "</td><td>" + esc(work) + (p.qual !== "none" ? " · " + ({ diploma: "🎓HS", trade: "🔧", degree: "🎓" })[p.qual] : "") + "</td><td class=\"n\">" + k$(C.netWorth(s, p)) + "</td></tr>";
    }).join("") + "</table>";
  }
  function logView() {
    var b = $("lcLog"), s = G.s; if (!b) return;
    b.innerHTML = s ? s.log.slice(-60).reverse().map(function (l) { return "<div>" + esc(l.t) + "</div>"; }).join("") : "";
  }
  function human(s) { var p = s && !s.over ? C.current(s) : null; return p && !p.bot ? p : null; }
  var TOPIC = { math: "Maths", word: "Words", quiz: "Quiz" }, LEVEL = { hs: "high school", college: "university", trade: "trade", work: "work" };
  function act() {
    var b = $("lcAct"), s = G.s; if (!b) return;
    if (!s) { b.innerHTML = "<h4>🎓 Life Choices</h4><div>From high school to retirement - your choices, your puzzles.</div><button class=\"big\" id=\"lcGo\" type=\"button\">▶ New game</button>"; $("lcGo").onclick = setup; return; }
    if (s.over) {
      b.innerHTML = "<h4>🏁 Everyone has retired</h4><table>" + C.standings(s).map(function (r, i) {
        return "<tr><td>" + (i + 1) + ".</td><td>" + esc(r.name) + "</td><td class=\"n\">" + M(r.score) + "</td></tr>"; }).join("") + "</table><div class=\"hint\">Score = net worth + $1,000 an IQ point over 100 + your qualification.</div><button class=\"big\" id=\"lcGo\" type=\"button\">▶ New game</button>";
      $("lcGo").onclick = setup; postScore(); return;
    }
    var p = C.current(s), pd = s.pending;
    if (p.bot) {
      var me = s.players.filter(function (q) { return !q.bot; })[0];
      b.innerHTML = "<h4>🤖 " + esc(p.name) + " (" + C.PERSONAS[p.bot] + ") is playing…</h4>" + (me && me.retired ? "<button id=\"lcFinish\" type=\"button\">⏩ Play out the rest</button>" : "");
      if ($("lcFinish")) $("lcFinish").onclick = function () { G.speed = "instant"; $("lcSpeed").value = "instant"; pump(); };
      return;
    }
    if (!pd) {
      var lbl = p.ring === "trade" ? "➜ Next square" : "🎲 Roll";
      b.innerHTML = "<h4>Your turn, " + esc(p.name) + "</h4><div>Age " + Math.floor(p.age) + " · " + M(p.cash) + " · IQ " + p.iq + " · " + RINGNAME[p.ring] + (p.job ? " · " + esc(p.job.title) : "") +
        (s.news ? "<br><span class=\"hint\">📰 " + esc(s.news) + "</span>" : "") + "</div><button class=\"big\" id=\"lcRoll\" type=\"button\">" + lbl + "</button>";
      $("lcRoll").onclick = function () { C.roll(s); after(); };
      return;
    }
    if (pd.type === "choice") {
      b.innerHTML = "<h4>" + esc(pd.title) + "</h4>" + (pd.text ? "<div>" + esc(pd.text) + "</div>" : "") + "<div class=\"opts\">" + pd.options.map(function (o, i) {
        return "<button type=\"button\" data-opt=\"" + esc(o.id) + "\"" + (o.off ? " disabled title=\"" + esc(o.why || "not now") + "\"" : "") + ">" + esc(o.label) + (o.off && o.why ? " <span class=\"hint\">- " + esc(o.why) + "</span>" : "") + "</button>"; }).join("") + "</div>";
      Array.prototype.forEach.call(b.querySelectorAll("[data-opt]"), function (el) { el.onclick = function () { C.choose(s, el.getAttribute("data-opt")); after(); }; });
      return;
    }
    // a puzzle
    var key = s.round + ":" + s.turn + ":" + pd.level + ":" + pd.square;
    if (!s.puz || s.puz.key !== key) { s.puz = { key: key, p: P.make(pd.level, pd.topic), left: 0, done: null }; s.puz.left = s.puz.p.secs; save(); }
    var z = s.puz, q = z.p;
    var head = "<h4>🧩 " + esc(pd.square) + (pd.square === TOPIC[q.topic] ? "" : " · " + TOPIC[q.topic]) + " · " + LEVEL[q.level] + " level</h4>";
    if (z.done) {
      b.innerHTML = head + "<div class=\"q\">" + esc(q.q) + "</div><div class=\"" + (z.done.ok ? "ok\">✔ Right!" : "no\">✘ " + (z.done.timeout ? "Time's up." : "Not this time.") + " The answer: " + esc(String(q.answer))) +
        "</div><button class=\"big\" id=\"lcOn\" type=\"button\">Carry on ➜</button>";
      $("lcOn").onclick = carryOn; $("lcOn").focus();
      return;
    }
    b.innerHTML = head + "<div class=\"q\">" + esc(q.q) + "</div>" + (q.hint ? "<div class=\"hint\">" + esc(q.hint) + "</div>" : "") +
      (q.kind === "choice" ? "<div class=\"opts\">" + q.choices.map(function (c, i) { return "<button type=\"button\" data-ans=\"" + i + "\">" + (i + 1) + ". " + esc(c) + "</button>"; }).join("") + "</div>"
        : "<div class=\"row\"><input type=\"text\" id=\"lcAns\" autocomplete=\"off\" placeholder=\"" + (q.kind === "fraction" ? "e.g. 5/36" : q.kind === "word" ? "the word" : "a number") + "\"><button type=\"button\" id=\"lcSubmit\">Answer</button></div>") +
      "<div class=\"timer\"><i id=\"lcTime\" style=\"width:" + Math.round(100 * z.left / q.secs) + "%\"></i></div>";
    Array.prototype.forEach.call(b.querySelectorAll("[data-ans]"), function (el) { el.onclick = function () { give(q.choices[+el.getAttribute("data-ans")]); }; });
    if ($("lcAns")) {
      $("lcSubmit").onclick = function () { give($("lcAns").value); };
      $("lcAns").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); give($("lcAns").value); } });
      setTimeout(function () { try { $("lcAns").focus({ preventScroll: true }); } catch (e) { /* gone */ } }, 0);
    }
  }
  function give(v) { var z = G.s && G.s.puz; if (!z || z.done) return; z.done = { ok: P.check(z.p, v), given: String(v) }; save(); act(); }
  function carryOn() { var s = G.s, z = s && s.puz; if (!z || !z.done) return; var ok = z.done.ok; s.puz = null; C.answer(s, ok); after(); }
  function after() { save(); draw(); players(); logView(); act(); pump(); }

  /* ---------------- bots ---------------- */
  function pump() {
    clearTimeout(G.botT); G.botT = 0;
    var s = G.s; if (!s || s.over || human(s)) return;
    if (!shown()) { G.botT = setTimeout(pump, 800); return; }
    if (G.speed === "instant") {
      var n = 0; while (!s.over && !human(s) && n < 4000) { C.botStep(s); n++; }
      after(); return;
    }
    G.botT = setTimeout(function () { G.botT = 0; if (G.s !== s) return; C.botStep(s); after(); }, G.speed === "fast" ? 90 : 420);
  }
  function setFull(on) { on = !!on; if (on === doc.body.classList.contains("lc-full")) return; doc.body.classList.toggle("lc-full", on); setTimeout(draw, 80); }
  function shown() { var d = $("lifedock"); return !!(d && !d.classList.contains("dockgone") && !d.classList.contains("collapsed") && !doc.hidden && d.offsetWidth > 0); }

  /* ---------------- set-up, scores ---------------- */
  function playerName() {
    var S = root.H3Security;
    try { return Promise.resolve(S && S.load ? S.load() : null).then(function () { return (S && S.name && S.name() || "").trim().slice(0, 18); }, function () { return ""; }); } catch (e) { return Promise.resolve(""); }
  }
  function setup() {
    $("lcSetup").classList.add("on");
    if (!$("lcName").value) playerName().then(function (n) { if (!$("lcName").value) $("lcName").value = n || LS.get("name", "") || "You"; });
    $("lcBots").value = LS.get("bots", "2"); $("lcSkill").value = LS.get("skill", "0.65"); $("lcRetire").value = LS.get("retire", "65");
  }
  var PERS = ["saver", "tycoon", "risk", "saver", "tycoon"], BOTNAMES = ["Ava", "Kai", "Mila", "Theo", "Zara"];
  function newGame(o) {
    o = o || {};
    var nb = Math.max(1, Math.min(5, Number(o.bots) || 2)), sk = Number(o.skill) || 0.65;
    var list = [{ name: o.name || "You" }];
    for (var i = 0; i < nb; i++) list.push({ name: BOTNAMES[i], bot: PERS[i], skill: Math.max(0.2, Math.min(0.95, sk + (i % 3 - 1) * 0.08)) });
    G.s = C.newGame({ seed: o.seed == null ? (Date.now() % 1000000) : o.seed, retire: o.retire || 65, players: list });
    G.posted = false; after(); return G.s;
  }
  function postScore() {
    var s = G.s; if (!s || !s.over || s.scored) return;
    var me = s.players.filter(function (p) { return !p.bot; })[0]; if (!me) return;
    s.scored = true; save();
    fetch("/api/life-choices/scores", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: me.name, score: C.score(s, me), worth: C.netWorth(s, me), retire: s.retire, bots: s.players.length - 1 }) }).catch(function () { /* offline */ });
  }
  function showScores() {
    $("lcScores").classList.add("on"); $("lcScoresBody").innerHTML = "<h3>🏆 High scores</h3><div class=\"hint\">Loading…</div>";
    fetch("/api/life-choices/scores").then(function (r) { return r.json(); }).then(function (j) {
      var L = (j && j.scores) || [];
      $("lcScoresBody").innerHTML = "<h3>🏆 High scores on this PC</h3>" + (L.length ? "<table>" + L.map(function (x, i) {
        return "<tr><td>" + (i + 1) + ".</td><td>" + esc(x.name) + "</td><td class=\"n\">" + M(x.score) + "</td><td class=\"hint\">retired at " + x.retire + "</td></tr>"; }).join("") + "</table>" : "<div class=\"hint\">No finished games yet.</div>");
    }).catch(function () { $("lcScoresBody").innerHTML = "<h3>🏆 High scores</h3><div class=\"hint\">Could not load them.</div>"; });
  }

  /* ---------------- wiring ---------------- */
  function boot() {
    var d = $("lifedock"); if (!d || d.dataset.lcSeen) return;
    try { if (root.localStorage.getItem("h3.g.lifedock") === "1") d.classList.add("dockgone"); } catch (e) { /* fine */ }
    d.dataset.lcSeen = "1";
    G.s = load();
    $("lcNew").onclick = setup;
    $("lcStart").onclick = function () {
      var o = { name: ($("lcName").value || "You").trim().slice(0, 18) || "You", bots: $("lcBots").value, skill: $("lcSkill").value, retire: Number($("lcRetire").value) };
      LS.set("name", o.name); LS.set("bots", o.bots); LS.set("skill", o.skill); LS.set("retire", o.retire);
      $("lcSetup").classList.remove("on"); newGame(o);
    };
    $("lcSetupCancel").onclick = function () { $("lcSetup").classList.remove("on"); };
    $("lcHelpBtn").onclick = function () { $("lcHelp").classList.add("on"); };
    $("lcHelpClose").onclick = function () { $("lcHelp").classList.remove("on"); };
    $("lcHi").onclick = showScores;
    $("lcScoresClose").onclick = function () { $("lcScores").classList.remove("on"); };
    $("lcSpeed").value = G.speed;
    $("lcSpeed").onchange = function () { G.speed = this.value; LS.set("speed", G.speed); pump(); };
    $("lcCloseBtn").onclick = function (e) { e.stopPropagation(); if (typeof root.toggleDockGone === "function") root.toggleDockGone("lifedock", "tX_lifedock"); };
    var cv = $("lcBoard"), tip = $("lcTip");
    cv.addEventListener("mousemove", function (e) {
      if (!G.geo) return;
      var r = cv.getBoundingClientRect(), q = hit(G.geo, e.clientX - r.left, e.clientY - r.top);
      if (q && q.ring === "centre") q = null;
      if (q !== G.hover) { G.hover = q; draw(); }
      if (q) { tip.innerHTML = squareText(q); tip.style.display = "block"; tip.style.left = Math.min(r.width - 230, e.clientX - r.left + 12) + "px"; tip.style.top = (e.clientY - r.top + 12) + "px"; }
      else tip.style.display = "none";
    });
    cv.addEventListener("mouseleave", function () { G.hover = null; tip.style.display = "none"; draw(); });
    // keys: 1-4 answer, Enter rolls / carries on (never while typing elsewhere)
    d.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var s = G.s, t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
      if (!s || s.over || !human(s) || typing) return;
      var z = s.puz;
      if (/^[1-9]$/.test(e.key) && z && !z.done && z.p.kind === "choice" && z.p.choices[+e.key - 1] != null) { give(z.p.choices[+e.key - 1]); e.preventDefault(); e.stopPropagation(); }
      else if (/^[1-9]$/.test(e.key) && s.pending && s.pending.type === "choice") {
        var on = s.pending.options[+e.key - 1]; if (on && !on.off) { C.choose(s, on.id); after(); e.preventDefault(); e.stopPropagation(); }
      } else if (e.key === "Enter") {
        if (z && z.done) carryOn(); else if (!s.pending && t && t.tagName !== "BUTTON") { C.roll(s); after(); } else return;
        e.preventDefault(); e.stopPropagation();
      }
    });
    // the puzzle's clock: runs only while the docker is on screen
    G.timer = setInterval(function () {
      var s = G.s, z = s && s.puz; if (!z || z.done || !human(s) || !shown()) return;
      z.left = Math.max(0, z.left - 0.25);
      var bar = $("lcTime"); if (bar) bar.style.width = Math.round(100 * z.left / z.p.secs) + "%";
      if (z.left <= 0) { z.done = { ok: false, timeout: true }; save(); act(); }
    }, 250);
    if (root.ResizeObserver) new root.ResizeObserver(function () { draw(); }).observe($("lcBoardWrap"));
    // maximized = the whole window; shown from its button = maximized (a board game needs the room)
    var wasGone = d.classList.contains("dockgone");
    $("lcExitFull").onclick = function () { if (typeof root.toggleMax === "function") root.toggleMax("lifedock", false); setFull(false); };
    if (root.MutationObserver) new root.MutationObserver(function () {
      var gone = d.classList.contains("dockgone");
      setFull(d.classList.contains("maxed") && !gone);
      if (wasGone && !gone && typeof root.toggleMax === "function" && !d.classList.contains("maxed")) setTimeout(function () { if (!d.classList.contains("dockgone")) root.toggleMax("lifedock", true); }, 60);
      wasGone = gone;
      if (shown()) { setTimeout(draw, 90); pump(); if (!G.s && !$("lcSetup").classList.contains("on")) setup(); }   // no game yet: the set-up
    }).observe(d, { attributes: true, attributeFilter: ["class"] });
    setFull(d.classList.contains("maxed") && !d.classList.contains("dockgone"));
    doc.addEventListener("visibilitychange", function () { if (!doc.hidden) pump(); });
    draw(); players(); logView(); act(); pump();
    if (!G.s && shown()) setup();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();

  root.H3Life = {
    newGame: newGame, state: function () { return G.s; }, act: act, draw: draw, setup: setup, scores: showScores,
    speed: function (v) { if (v) { G.speed = v; LS.set("speed", v); pump(); } return G.speed; },
    _geo: function () { return G.geo; }, _hit: function (x, y) { return G.geo ? hit(G.geo, x, y) : null; },
    info: function () { var s = G.s; return { game: !!s, over: !!(s && s.over), round: s ? s.round : 0, turn: s ? s.turn : -1, human: !!human(s), pending: s && s.pending ? s.pending.type : null,
                                             puzzle: s && s.puz ? { kind: s.puz.p.kind, done: !!s.puz.done } : null, shown: shown(), squares: G.geo ? G.geo.sq.length : 0, speed: G.speed }; },
  };
})(window);
