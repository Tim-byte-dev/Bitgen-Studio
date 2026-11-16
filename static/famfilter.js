/* bitGen Studio — static/famfilter.js (2.788.0): BASIC SETTINGS' OVERRIDE LISTS SHOW WHAT FITS THE PICKED STYLE.
 * Tim (verbatim): "in the model and lora lists in overide settings, filter the list by the syle selected in the prompt
 * docker dropdowns family of models and the type (image/image-edit/video)"
 *
 *   picture checkpoint (#imgCkpt) + picture temporary LoRAs (#tliRows)  <- the prompt docker's image style (#styleSel)
 *   video Model (#vidModel's list)  + video temporary LoRAs (#tlvRows)  <- the prompt docker's video style (#videoStyleSel)
 * The server says each file's family + type (the 🧩 Model manager's card, else its name) and each style's rule
 * (POST /api/famfilter - lib/famFilter.js): the files of the style's families, of its type when the family has any of it
 * (image / image edit / video); files whose family is not known stay, at the end, marked "family not known". A line under
 * each Model field says what is shown, with ☐ Show all (kept per kind). The 📁 browser still lists everything.
 * Hooks: index.html cmCombo (files / label / hidden), static/basicset.js (the video list - H3Basic.refill).
 * Pure (Node: scripts/test-famfilter788.js): pick(files, info, rule), keyOf(f), kindOfId(id, inRows), noteText(...).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.boot(root);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  var MODEL_CATS = ["checkpoints", "diffusers", "diffusion_models", "unet", "unet_gguf"];
  function keyOf(f) { return String(f.category || f.cat || "") + "|" + String(f.name || ""); }
  var unknownFam = function (x) { return !x || !x.family || x.family === "other"; };
  /** files [{name, category}] + info {key: {family, category}} + rule -> {files (fit, then unknown), unknown: Set, out} */
  function pick(files, info, rule) {
    var L = files || [], fams = (rule && rule.families) || [];
    if (!fams.length) return null;
    var fam = [], unknown = [], out = 0, I = info || {};
    L.forEach(function (f) {
      var x = I[keyOf(f)];
      if (unknownFam(x)) unknown.push(f); else if (fams.indexOf(x.family) >= 0) fam.push(f); else out++;
    });
    // 2.798.0 (Tim: "drop the split because some image models like klein can edit as well as generate"): every file of the family
    var fit = fam;
    return { files: fit.concat(unknown), fit: fit.length, unknown: new Set(unknown), out: out };
  }
  /** which list an input belongs to: "image" | "video" | null */
  function kindOfId(id, rows) {
    if (id === "imgCkpt" || rows === "tliRows") return "image";
    if (id === "vidModel" || rows === "tlvRows") return "video";
    return null;
  }
  function noteText(rule, m, l, off) {
    if (!rule || !(rule.families || []).length) return rule && rule.style ? "All models listed - " + rule.style + "'s model family is not known" : "";
    var what = (rule.labels || []).join(" / ");   // 2.798.0: no image / image edit split - the family only
    if (off) return "Showing every model and LoRA - ticked, only " + what + " ones for " + rule.style;
    var part = function (n, x) { return x ? x.fit + " " + (x.fit === 1 ? n.replace(/s$/, "") : n) + (x.unknown.size ? " + " + x.unknown.size + " family not known" : "") + (x.out ? ", " + x.out + " hidden" : "") : ""; };
    return "For " + rule.style + ": " + what + " - " + [part("models", m), part("LoRAs", l)].filter(Boolean).join(" · ");
  }

  function boot(win) {
    var doc = win.document, S = { rules: {}, info: {}, seen: "", data: null, busy: false, again: false };
    var $ = function (id) { return doc.getElementById(id); };
    var store = function () { try { return win.localStorage; } catch (e) { return null; } };
    function off(kind) { var s = store(); try { return !!(s && s.getItem("h3.famfilter.off." + kind)); } catch (e) { return false; } }
    function setOff(kind, v) { var s = store(); try { if (s) { if (v) s.setItem("h3.famfilter.off." + kind, "1"); else s.removeItem("h3.famfilter.off." + kind); } } catch (e) { /* fine */ } }
    function cm() { try { return typeof cmData !== "undefined" ? cmData : null; } catch (e) { return null; } }   // index.html's top-level let
    function kindOfInp(inp) {
      if (!inp) return null;
      var rows = inp.closest && inp.closest("#tliRows, #tlvRows");
      return kindOfId(inp.id, rows ? rows.id : "");
    }
    function rule(kind) { return off(kind) ? null : S.rules[kind]; }
    /** cmCombo's hook: null = no filter for this field */
    function files(inp, list) {
      // a LoRA row is painted BEFORE it is put in its box (index.html loraRow) - paint it again once it is there
      if (inp && !inp.isConnected && !inp._ffLater) {
        inp._ffLater = true;
        setTimeout(function () { var row = inp.closest && inp.closest(".lorarow"), w = row && row.querySelector(".cmcombo"); if (inp.isConnected && kindOfInp(inp) && w && w._repaint) try { w._repaint(); } catch (e) { /* one row */ } }, 0);
      }
      var kind = kindOfInp(inp); if (!kind) return null;
      var r = rule(kind), p = pick(list, S.info, r);
      if (!p) return null;
      p.hid = function (name, cat) { return !p.files.some(function (f) { return f.name === name; }) && list.some(function (f) { return f.name === name && (!cat || f.category === cat); }); };
      p.why = " (not a " + (r.labels || []).join(" / ") + " " + r.type + " model)";
      return p;
    }
    /** the video Model list: [{cat, name}] -> the names to list (unknown ones marked) */
    function names(kind, pairs) {
      var L = (pairs || []).map(function (x) { return { name: x.name, category: x.cat }; });
      var p = pick(L, S.info, rule(kind));
      return p ? p.files.map(function (f) { return { name: f.name, unknown: p.unknown.has(f) }; }) : L.map(function (f) { return { name: f.name, unknown: false }; });
    }
    function collect() {
      var d = cm(), out = [], cats = (d && d.categories) || {};
      MODEL_CATS.concat(["loras"]).forEach(function (c) { ((cats[c] || {}).files || []).forEach(function (f) { if (f && f.name) out.push({ cat: c, name: f.name }); }); });
      return out;
    }
    function counts(kind) {
      var d = cm(), cats = (d && d.categories) || {}, r = rule(kind);
      var mk = function (cs) { var L = []; cs.forEach(function (c) { ((cats[c] || {}).files || []).forEach(function (f) { L.push({ name: f.name, category: c }); }); }); return pick(L, S.info, r); };
      return { m: mk((d && d.model_categories) || MODEL_CATS), l: mk(["loras"]) };
    }
    function noteEl(kind) {
      var id = "ffNote_" + kind, el = $(id); if (el) return el;
      var after = kind === "image" ? $("imgCkptCombo") : $("vidModelList");
      if (!after || !after.parentNode) return null;
      el = doc.createElement("div"); el.id = id; el.className = "ffNote"; el.style.cssText = "font-size:11px;line-height:1.35;color:var(--dim);margin:3px 0 6px;white-space:normal;overflow-wrap:anywhere;font-family:inherit";
      after.parentNode.insertBefore(el, after.nextSibling);
      return el;
    }
    function paintNote(kind) {
      var el = noteEl(kind); if (!el) return;
      var r = S.rules[kind], o = off(kind), c = counts(kind);
      var t = noteText(r, c.m, c.l, o);
      if (!t) { el.hidden = true; return; }
      el.hidden = false;
      var can = r && (r.families || []).length;
      el.innerHTML = "";
      var sp = doc.createElement("span"); sp.className = "ffText"; sp.textContent = t; el.appendChild(sp);
      if (can) {
        var lab = doc.createElement("label"); lab.style.cssText = "margin-left:8px;white-space:nowrap";
        lab.title = "Show every model and LoRA in these lists, whatever their family";
        var cb = doc.createElement("input"); cb.type = "checkbox"; cb.className = "ffAll"; cb.dataset.ffkind = kind; cb.checked = o;
        cb.onchange = function () { setOff(kind, cb.checked); repaint(); };
        lab.appendChild(cb); lab.appendChild(doc.createTextNode(" Show all")); el.appendChild(lab);
      }
    }
    function repaint() {
      Array.prototype.forEach.call(doc.querySelectorAll("#sec-basic .cmcombo, #imgCkptCombo .cmcombo, #tliRows .cmcombo, #tlvRows .cmcombo"), function (w) { if (w._repaint) try { w._repaint(); } catch (e) { /* one combo */ } });
      if (win.H3Basic && win.H3Basic.refill) try { win.H3Basic.refill(); } catch (e) { /* fine */ }
      paintNote("image"); paintNote("video");
    }
    function refresh() {
      if (S.busy) { S.again = true; return; }
      var img = $("styleSel"), vid = $("videoStyleSel"), d = cm();
      S.busy = true; S.data = d;
      S.seen = (img ? img.value : "") + "\u0001" + (vid ? vid.value : "");
      var body = { image: img ? img.value : "", video: vid ? vid.value : "", files: collect() };
      win.fetch("/api/famfilter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.rules) { S.rules = j.rules; S.info = j.info || {}; repaint(); } })
        .catch(function () { /* the lists stay as they are */ })
        .then(function () { S.busy = false; if (S.again) { S.again = false; refresh(); } });
    }
    function tick() {
      watchRows();   // the LoRA boxes may come after the start
      var img = $("styleSel"), vid = $("videoStyleSel");
      var now = (img ? img.value : "") + "\u0001" + (vid ? vid.value : "");
      if (now !== S.seen || cm() !== S.data) refresh();
    }
    /** a LoRA row is painted (index.html loraRow) BEFORE it is put in its box - repaint the rows that arrive */
    function watchRows() {
      ["tliRows", "tlvRows"].forEach(function (id) {
        var box = $(id); if (!box || box._ffWatch || !win.MutationObserver) return;
        box._ffWatch = new win.MutationObserver(function (recs) {
          recs.forEach(function (r) { Array.prototype.forEach.call(r.addedNodes || [], function (n) {
            if (!n.querySelectorAll) return;
            Array.prototype.forEach.call(n.querySelectorAll(".cmcombo"), function (w) { if (w._repaint) try { w._repaint(); } catch (e) { /* one row */ } });
          }); });
        });
        box._ffWatch.observe(box, { childList: true });
      });
    }
    function start() {
      watchRows(); setTimeout(watchRows, 2000);
      ["styleSel", "videoStyleSel"].forEach(function (id) { var el = $(id); if (el) el.addEventListener("change", function () { setTimeout(refresh, 0); }); });
      tick(); setInterval(tick, 1500);
    }
    win.H3FamFilter = { files: files, names: names, refresh: refresh, repaint: repaint, state: function () { return S; }, pick: pick };
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
  }
  return { pick: pick, keyOf: keyOf, kindOfId: kindOfId, noteText: noteText, boot: boot };
});
