/* ext/slidesdock/slideai.js — 🎞 ✨ SLIDES BY THE LLM (2.833.0) - window.H3SlideAI. Tim: "yes, plese do part 3".
 *
 *   ✨ AI ▾  Make slides…            what they are about and / or a text / an outline / a .txt / .md file, how many slides,
 *                                     ☐ pictures, a new presentation or after this slide, ☐ the outline as written (no LLM)
 *                                     -> POST /api/slides/ai/plan (or /outline) -> slides built with slidecore's layouts (one undo)
 *            ✍ Rewrite this slide / ✂ Make it shorter / ✓ Fix the words / 🎤 Speaker notes from the slide
 *                                     -> POST /api/slides/ai/rewrite -> the slide's title, points and notes (one undo)
 *            🖼 Pictures for the empty boxes   every empty picture box gets a picture made from its slide's words
 *   Pictures: the prompt docker's image style (#styleSel) - POST /api/genimage, one job at a time, each put in its box when
 *   it is done (the slide can be worked on meanwhile; Ctrl+Z takes a picture back out). ■ Stop the pictures stops after the one
 *   being made.
 *   The prompt docker: "make slides about bees", "create a 6 slide presentation on solar power with pictures" (a pasted text on
 *   the lines after the first = what to make them from) -> window.H3ChatRoutes (first in the list: it only answers a request
 *   for slides / a presentation / a deck).
 * The pure parts (wants, buildSlides, picSize, slideWords) run in Node: scripts/test-833.js.
 */
(function (root) {
  "use strict";
  /* ================================================================ pure */
  const NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
  const SLIDEWORD = "(?:slides?|slide ?show|presentation|deck|powerpoint|pitch deck)";
  const ASK_RE = new RegExp("\\b(?:make|create|build|generate|write|prepare|draft|put together|give me|do)\\b[^\\n]{0,60}?\\b" + SLIDEWORD + "\\b", "i");
  /** a prompt-docker message that asks for slides -> {ask, text, count, pictures} (null = not for the slides) */
  function wants(message) {
    const all = String(message || "").replace(/\r/g, ""), nl = all.indexOf("\n");
    const first = (nl < 0 ? all : all.slice(0, nl)).trim(), rest = nl < 0 ? "" : all.slice(nl + 1).trim();
    const m = ASK_RE.exec(first); if (!m) return null;
    if (/\b(spreadsheet|sheet|cell|formula|column)\b/i.test(first) && !/\b(about|on|from)\b/i.test(first.slice(m.index + m[0].length))) return null;
    const lo = first.toLowerCase();
    let count = 0;
    const n1 = /\b(\d{1,2})\s*(?:-\s*)?(?:slides?|pages?)\b/i.exec(first), n2 = new RegExp("\\b(" + Object.keys(NUMS).join("|") + ")\\s*(?:-\\s*)?(?:slides?|pages?)\\b", "i").exec(first);
    if (n1) count = +n1[1]; else if (n2) count = NUMS[n2[1].toLowerCase()];
    const pictures = /\b(pictures?|images?|photos?|illustrat\w*|visuals?)\b/.test(lo) && !/\b(no|without|not? any)\s+(pictures?|images?|photos?|illustrations?|visuals?)\b/.test(lo);
    let ask = first.slice(m.index + m[0].length).replace(new RegExp("^(?:\\s*-?\\s*" + SLIDEWORD + "\\b)+", "i"), "")
      .replace(/^[\s,:-]*(?:(?:about|on|for|covering|explaining|of|from|that explains?|to explain|introducing|about the topic of)\s+)?/i, "")
      .replace(/\b(?:with|and|including|plus)\s+(?:some\s+|a few\s+)?(?:generated\s+)?(?:pictures?|images?|photos?|illustrations?|visuals?)\b/gi, "")
      .replace(/\b(?:without|with no|no)\s+(?:pictures?|images?|photos?|illustrations?|visuals?)\b/gi, "")
      .replace(/\b(please|thanks?|thank you)\b/gi, "").replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, "");
    if (/^(?:it|this|that|these|the (?:text|notes?|outline)( below)?|below|the following|my notes)$/i.test(ask)) ask = "";
    if (!ask && !rest) ask = first;
    return { ask, text: rest, count: Math.max(1, Math.min(40, count || 8)), pictures };
  }
  /** a picture box's shape -> a render size of about one megapixel on a 16-px grid */
  function picSize(w, h) {
    const a = (w || 4) / (h || 3), area = 1048576, r16 = (v) => Math.max(256, Math.min(2048, Math.round(v / 16) * 16));
    return { width: r16(Math.sqrt(area * a)), height: r16(Math.sqrt(area / a)) };
  }
  /** the words of a slide: {title, points, notes, titleItem, bodies} (the title box = role title or the first text box) */
  function slideWords(s) {
    const texts = ((s && s.items) || []).filter((i) => i.type === "text");
    const titleItem = texts.find((i) => i.role === "title") || texts[0] || null;
    let bodies = texts.filter((i) => i !== titleItem && (i.role === "body" || i.role === "body2"));
    if (!bodies.length) bodies = texts.filter((i) => i !== titleItem);
    bodies = bodies.slice(0, 2);
    const lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
    return { title: titleItem ? String(titleItem.text || "").trim() : "", points: [].concat(...bodies.map((b) => lines(b.text))), notes: (s && s.notes) || "", titleItem, bodies };
  }
  /** a cleaned plan -> slides made with slidecore (K): {slides, jobs: [{slide, item, prompt}]}.
   *  o.asNew: the first slide is the title slide; otherwise the plan's title (if any) becomes a section slide. o.pictures: jobs. */
  function buildSlides(plan, K, deck, o) {
    const p = plan || {}, opt = o || {}, out = [], jobs = [];
    const put = (s, role, text) => { const it = s.items.find((i) => i.role === role); if (it) it.text = text; return it; };
    if (p.title || opt.asNew) {
      const s = K.newSlide(opt.asNew ? "title" : "section", deck);
      put(s, "title", p.title || ""); put(s, "sub", p.subtitle || "");
      out.push(s);
    }
    for (const x of p.slides || []) {
      let layout = x.layout || "content";
      if (x.picture && opt.pictures && (layout === "content" || layout === "titleonly")) layout = "picture";
      if (layout === "picture" && !(x.picture && opt.pictures) && !opt.keepEmpty) layout = x.points && x.points.length ? "content" : "titleonly";
      const s = K.newSlide(layout, deck);
      put(s, "title", x.title || "");
      const pts = x.points || [];
      if (layout === "section") put(s, "sub", pts.join(" · "));
      else if (layout === "two") { put(s, "body", pts.join("\n")); put(s, "body2", (x.points2 || []).join("\n")); }
      else if (layout !== "titleonly") put(s, "body", pts.join("\n"));
      s.notes = x.notes || "";
      const pic = s.items.find((i) => i.role === "pic");
      if (pic && x.picture && opt.pictures) jobs.push({ slide: s.id, item: pic.id, prompt: x.picture });
      out.push(s);
    }
    return { slides: out, jobs };
  }
  /** an empty picture box's words for the image model: the slide's title + points (+ the deck's title for the setting) */
  function picPrompt(s, deckTitle) {
    const w = slideWords(s), bits = [w.title, w.points.slice(0, 3).join(", ")].filter(Boolean).join(": ");
    return (bits || deckTitle || "an illustration") + (deckTitle && bits && !bits.includes(deckTitle) ? " (" + deckTitle + ")" : "") + ". A clear, well-lit illustration for a presentation slide, no text, no words, no letters.";
  }
  const pure = { wants, picSize, slideWords, buildSlides, picPrompt };
  if (typeof module !== "undefined" && module.exports) module.exports = pure;

  /* ================================================================ the page */
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const H = () => root.H3Slides, K = () => root.SlideCore;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function api(path, body) {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status);
    return j;
  }
  function menuAt(x, y, html) {
    doc.querySelectorAll(".slmenu").forEach((m) => m.remove());
    const m = doc.createElement("div"); m.className = "slmenu"; m.innerHTML = html; m.style.left = Math.round(x) + "px"; m.style.top = Math.round(y) + "px";
    doc.body.appendChild(m);
    setTimeout(() => doc.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target)) { m.remove(); doc.removeEventListener("pointerdown", off, true); } }, true), 0);
    return m;
  }

  /* ---- 🖼 pictures, one job at a time */
  const Q = { list: [], busy: false, stop: false, done: 0, total: 0 };
  async function toDataUrl(url) {
    const r = await fetch(url); if (!r.ok) throw new Error("could not fetch the picture");
    const b = await r.blob(), bmp = await createImageBitmap(b), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = doc.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  }
  /** a picture from the image style: the job's first output as a data URL */
  async function makePicture(prompt, w, h) {
    const style = $("styleSel") ? $("styleSel").value : "";
    if (!style) throw new Error("no image style - pick one in the prompt docker (styles are made in Settings ▸ Image)");
    const body = Object.assign({ prompt, style_id: style, batch: 1 }, picSize(w, h));
    if (root.H3Neg && root.H3Neg.get && root.H3Neg.get()) body.negative = root.H3Neg.get();
    const job = await api("/api/genimage", body);
    for (;;) {
      await sleep(1500);
      const r = await fetch("/api/jobs/" + encodeURIComponent(job.id)); const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "the picture's job went away");
      if (j.status === "done") { const name = (j.outputs && j.outputs[0]) || j.output; if (!name) throw new Error("the job made no picture"); return toDataUrl("/outputs/" + String(name).split("/").map(encodeURIComponent).join("/")); }
      if (j.status === "failed" || j.status === "cancelled") throw new Error("the picture's job " + j.status);
    }
  }
  /** jobs [{slide, item, prompt}] queued; each is put in its box when done */
  function queuePictures(jobs) {
    if (!jobs || !jobs.length) return;
    Q.list.push(...jobs); Q.total += jobs.length; Q.stop = false;
    if (!Q.busy) pump();
  }
  async function pump() {
    Q.busy = true;
    let errs = 0, last = "";
    while (Q.list.length && !Q.stop) {
      const j = Q.list.shift(), ed = H(), d = ed.deck();
      const s = d.slides.find((x) => x.id === j.slide), it = s && s.items.find((i) => i.id === j.item);
      if (!it || ed.mediaUrl(it.src)) { Q.done++; continue; }                  // the box went / was filled meanwhile
      ed.msg(`🖼 making picture ${Q.done + 1} of ${Q.total} (slide ${d.slides.indexOf(s) + 1})…`);
      try {
        const url = await makePicture(j.prompt, it.w, it.h);
        const d2 = ed.deck(), s2 = d2.slides.find((x) => x.id === j.slide), it2 = s2 && s2.items.find((i) => i.id === j.item);
        if (it2 && !ed.mediaUrl(it2.src)) {
          const id = "m" + K().uid().slice(1); ed.step(); d2.media[id] = url; it2.src = "media:" + id; it2.fit = it2.fit || "cover"; ed.changed();
        }
      } catch (e) { errs++; last = e.message; if (/no image style|missing|not an image/i.test(e.message)) { Q.list.length = 0; } }
      Q.done++;
    }
    const n = Q.done - errs;
    H().msg(Q.stop ? `■ pictures stopped (${n} put in)` : errs ? `🖼 ${n} of ${Q.total} picture(s) put in - ✗ ${last}` : `🖼 ${n} picture(s) put in - Ctrl+Z takes one back out`, !!errs && !Q.stop);
    Q.busy = false; Q.done = 0; Q.total = 0; Q.list.length = 0; Q.stop = false;
  }
  function stopPictures() { if (Q.busy) { Q.stop = true; H().msg("■ stopping after the picture being made…"); } }
  /** 🖼 every empty picture box in the deck gets a picture from its slide's words */
  function emptyBoxes() {
    const d = H().deck(), title = slideWords(d.slides[0] || {}).title, jobs = [];
    for (const s of d.slides) for (const it of s.items) if (it.type === "image" && it.role === "pic" && !H().mediaUrl(it.src)) jobs.push({ slide: s.id, item: it.id, prompt: picPrompt(s, title) });
    if (!jobs.length) return H().msg("no empty picture boxes (a 'Picture' layout slide has one)"), 0;
    queuePictures(jobs);
    return jobs.length;
  }

  /* ---- ✨ make slides */
  /** {ask, text, count, pictures, mode: new | after, asWritten, name} -> {title, n, pics} (the deck in the editor) */
  async function make(o) {
    const ed = H(), a = o || {};
    if (ed.St.edit) ed.endEdit();
    ed.msg(a.asWritten ? "✨ reading the outline…" : "✨ the LLM is planning the slides…");
    const { plan } = a.asWritten ? await api("/api/slides/ai/outline", { text: a.text || a.ask }) : await api("/api/slides/ai/plan", { ask: a.ask, text: a.text, count: a.count, pictures: !!a.pictures });
    if (!plan || !plan.slides || !plan.slides.length) throw new Error("no slides in the plan");
    const cur = ed.deck(), asNew = a.mode !== "after";
    if (asNew) {
      const size = cur.w === 960 ? "4:3" : "16:9", deck = K().newDeck(cur.theme, size);
      const b = buildSlides(plan, K(), deck, { asNew: true, pictures: !!a.pictures });
      deck.slides = b.slides;
      ed.load(deck, (a.name || plan.title || "Presentation").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "Presentation");
      ed.St.dirty = true; if ($("slFile")) $("slFile").value = ed.St.name;
      ed.msg(`✨ ${b.slides.length} slides made` + (b.jobs.length ? ` - ${b.jobs.length} picture(s) to make` : "") + " - 💾 Save keeps it");
      queuePictures(b.jobs);
      return { title: plan.title || ed.St.name, n: b.slides.length, pics: b.jobs.length };
    }
    const b = buildSlides(plan, K(), cur, { asNew: false, pictures: !!a.pictures });
    ed.step(); const at = ed.St.cur + 1; cur.slides.splice(at, 0, ...b.slides); ed.go(at); ed.changed();
    ed.msg(`✨ ${b.slides.length} slides put in after slide ${at}` + (b.jobs.length ? ` - ${b.jobs.length} picture(s) to make` : "") + " (Ctrl+Z takes them out)");
    queuePictures(b.jobs);
    return { title: plan.title || "", n: b.slides.length, pics: b.jobs.length, at };
  }
  function dialog() {
    doc.querySelectorAll("#slAiBox").forEach((p) => p.remove());
    const box = doc.createElement("div"); box.id = "slAiBox";
    box.innerHTML = `<div class="hd2"><b>✨ Make slides</b><button class="ghost" type="button" data-x style="margin-left:auto">✕</button></div>
      <div class="bd">
        <label>What the slides are about <textarea id="slAiAsk" rows="2" placeholder="e.g. how solar panels work, for a school talk"></textarea></label>
        <label>…and / or make them from this text or outline <span class="dim">(optional)</span> <textarea id="slAiText" rows="7" placeholder="Paste notes, an article or an outline here"></textarea></label>
        <div class="row"><button class="ghost" type="button" id="slAiFileBtn">📄 From a .txt / .md file…</button><input type="file" id="slAiFile" accept=".txt,.md,.markdown,text/plain,text/markdown" hidden><span id="slAiFileName" class="dim" data-noi18n></span></div>
        <div class="row">
          <label>Slides <input type="number" id="slAiCount" min="1" max="40" value="8" style="width:60px"></label>
          <label title="Pictures made with the prompt docker's image style, one at a time, each put in its box when done"><input type="checkbox" id="slAiPics"> 🖼 With pictures</label>
          <label title="The outline as it is written - each heading or line a slide, each - line a point - no LLM"><input type="checkbox" id="slAiAsIs"> Use the outline as written</label>
        </div>
        <div class="row"><label><input type="radio" name="slAiMode" value="new" checked> A new presentation</label><label><input type="radio" name="slAiMode" value="after"> After this slide</label></div>
        <div class="row"><span id="slAiSay" class="dim"></span><button type="button" id="slAiGo" style="margin-left:auto">✨ Make</button><button class="ghost" type="button" data-x>Cancel</button></div>
      </div>`;
    doc.body.appendChild(box);
    const q = (id) => box.querySelector("#" + id), close = () => box.remove();
    box.querySelectorAll("[data-x]").forEach((b) => (b.onclick = close));
    box.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
    q("slAiFileBtn").onclick = () => q("slAiFile").click();
    q("slAiFile").onchange = async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; q("slAiText").value = (await f.text()).slice(0, 24000); q("slAiFileName").textContent = f.name; };
    q("slAiGo").onclick = async () => {
      const o = { ask: q("slAiAsk").value.trim(), text: q("slAiText").value.trim(), count: +q("slAiCount").value || 8, pictures: q("slAiPics").checked, asWritten: q("slAiAsIs").checked, mode: box.querySelector("[name=slAiMode]:checked").value };
      if (o.asWritten && !o.text) return (q("slAiSay").textContent = "paste the outline (or pick a file) first");
      if (!o.ask && !o.text) return (q("slAiSay").textContent = "say what the slides are about, or give a text");
      if (o.mode === "new" && H().St.dirty && typeof root.appConfirm === "function" && !(await root.appConfirm(`"${H().St.name}" has changes that are not saved. Make a new presentation anyway?`, "Not saved"))) return;
      q("slAiGo").disabled = true; q("slAiSay").textContent = o.asWritten ? "reading the outline…" : "the LLM is planning the slides…";
      try { await make(o); close(); } catch (er) { q("slAiGo").disabled = false; q("slAiSay").textContent = "✗ " + er.message; H().msg("✗ " + er.message, true); }
    };
    q("slAiAsk").focus();
    return box;
  }

  /* ---- ✍ this slide */
  async function rewrite(how) {
    const ed = H(); if (ed.St.edit) ed.endEdit();
    const s = ed.slide(), w = slideWords(s);
    if (!w.title && !w.points.length) return ed.msg("this slide has no words to work on", true), null;
    const label = { better: "✍ rewriting", shorter: "✂ shortening", fix: "✓ fixing the words of", notes: "🎤 writing the speaker notes for" }[how] || "✍ rewriting";
    ed.msg(label + " this slide…");
    let r; try { r = await api("/api/slides/ai/rewrite", { title: w.title, points: w.points, notes: w.notes, how }); } catch (e) { ed.msg("✗ " + e.message, true); return null; }
    if (ed.slide() !== s) { ed.msg("the slide changed meanwhile - nothing put in", true); return null; }
    ed.step();
    if (how !== "notes") {
      if (w.titleItem && r.title) w.titleItem.text = r.title;
      if (w.bodies.length === 1) w.bodies[0].text = r.points.join("\n");
      else if (w.bodies.length === 2) { const h = Math.ceil(r.points.length / 2); w.bodies[0].text = r.points.slice(0, h).join("\n"); w.bodies[1].text = r.points.slice(h).join("\n"); }
    }
    if (r.notes || how === "notes") s.notes = r.notes || s.notes;
    if ($("slNotes")) $("slNotes").value = s.notes || "";
    ed.changed();
    ed.msg({ better: "✍ slide rewritten", shorter: "✂ slide made shorter", fix: "✓ words fixed", notes: "🎤 speaker notes written (below the slide)" }[how] + " - Ctrl+Z takes it back");
    return r;
  }

  function aiMenu(btn) {
    const r = btn.getBoundingClientRect();
    const m = menuAt(r.left, r.bottom + 2, `<div data-a="make">✨ Make slides…</div><hr>`
      + `<div data-a="better">✍ Rewrite this slide</div><div data-a="shorter">✂ Make it shorter</div><div data-a="fix">✓ Fix the words</div><div data-a="notes">🎤 Speaker notes from the slide</div><hr>`
      + (Q.busy ? `<div data-a="stop">■ Stop the pictures</div>` : `<div data-a="pics">🖼 Pictures for the empty boxes</div>`));
    m.addEventListener("click", (e) => {
      const it = e.target.closest("[data-a]"); if (!it) return; m.remove();
      const a = it.dataset.a;
      if (a === "make") dialog(); else if (a === "pics") emptyBoxes(); else if (a === "stop") stopPictures(); else rewrite(a);
    });
    return m;
  }

  /* ---- the prompt docker */
  const dock = () => $("slidesdock");
  async function show() {
    const d = dock(); if (d && d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone("slidesdock", "tX_slidesdock");
    for (let i = 0; i < 40 && !(H() && H().St.booted); i++) await sleep(100);
  }
  /** core's chatSend asks this first: a reply (the message asked for slides) or null */
  async function maybe(text) {
    const w = wants(text); if (!w || !H()) return null;
    await show();
    let mode = "new";
    if (H().St.dirty && typeof root.appConfirm === "function" && !(await root.appConfirm(`"${H().St.name}" has changes that are not saved. Make the new slides as a new presentation? (Cancel puts them in after the slide shown)`, "Not saved"))) mode = "after";
    const r = await make(Object.assign({ mode }, w));
    return `🎞 "${r.title}" - ${r.n} slide${r.n === 1 ? "" : "s"} made in Slides` + (mode === "after" ? ` (after slide ${r.at})` : "") + (r.pics ? ` - ${r.pics} picture${r.pics === 1 ? " is" : "s are"} being made with the image style, each put in when done` : "") + ". ✨ AI ▾ there rewrites a slide or writes its speaker notes; 💾 Save keeps it.";
  }
  root.H3ChatRoutes = [maybe].concat(root.H3ChatRoutes || []);   // first: it only answers a request for slides

  function wire() { const b = $("slAiBtn"); if (b && !b.dataset.w) { b.dataset.w = 1; b.addEventListener("click", (e) => aiMenu(e.currentTarget)); } }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else setTimeout(wire, 0);
  root.H3SlideAI = Object.assign({ make, rewrite, dialog, aiMenu, emptyBoxes, queuePictures, stopPictures, makePicture, maybe, Q }, pure);
})(typeof window !== "undefined" ? window : globalThis);
