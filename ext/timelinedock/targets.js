/* bitGen Studio — ext/timelinedock/targets.js (2.412.0): TRACK TARGETING + LINKED SELECTION on the timeline
 * (the maths is static/tltargets.js, H3Targets). window.TlTargets.
 *
 * Tim: "do the smaller jobs and complete the 10 partly done jobs" - Premiere's track targeting / linked selection.
 *
 *   ◎ in a layer's header   target it: Ctrl+K with no clip selected splits the clips under the position marker on every
 *                           targeted layer (none targeted = the highlighted layer, as before)
 *   🔗 in the menu bar      linked selection on / off: a picture and its separated sound move and trim together
 *   a video clip's Properties - 🔗 Sound:
 *       ⤓ Sound as its own clip   its sound becomes a clip on "<layer> sound", linked; the picture plays silent
 *       ⛓ Unlink / 🔗 Link        break the pair (each its own from then on) / pair them again
 *       ↩ Sound back              the separate clip removed, the picture's own sound back
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.H3Targets && window.TlCanvas && TlCanvas.onProps && typeof renderTimeline === "function" && typeof tlSave === "function" && $("tlbar")); } catch (e) { return false; } }
  var T = function () { return window.H3Targets; };
  function say(t) { try { if (TlCanvas.say) TlCanvas.say(t); } catch (e) { /* fine */ } if ($("sblog")) $("sblog").textContent = t; }
  function log(t) { if (typeof logLine === "function") logLine("[targets] " + t); }
  var snap = null;
  var CSS = ".tlab .tgt{font-size:.7rem;opacity:.45}.tlab .tgt.on{opacity:1;color:var(--tiger,#f59e2c)}"
    + "#tlLinkSel.on{color:var(--tiger,#f59e2c)}#tlpLinkRow button{font-size:.7rem;padding:1px 6px}";

  function layerOf(lk) { try { return typeof lkLayer === "function" ? lkLayer(lk) : null; } catch (e) { return null; } }
  function paintTargets() {
    Array.prototype.forEach.call(document.querySelectorAll("#tlinner .tltrack"), function (tr) {
      var lk = tr.dataset.lk, lab = tr.querySelector(".tlab"), L = layerOf(lk);
      if (!lk || !lab || !L || lab.querySelector(".tgt")) return;
      var b = document.createElement("button");
      b.className = "tgt" + (L.target ? " on" : ""); b.type = "button"; b.textContent = "◎";
      b.title = "Target this layer: Ctrl+K (no clip selected) splits the targeted layers' clips under the position marker";
      b.setAttribute("aria-pressed", L.target ? "true" : "false"); b.setAttribute("aria-label", "Target " + (L.name || lk));
      b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      b.onclick = function (e) {
        e.stopPropagation();
        if (L.target) delete L.target; else L.target = true;
        b.classList.toggle("on", !!L.target); b.setAttribute("aria-pressed", L.target ? "true" : "false");
        save(); say("◎ " + (L.name || lk) + (L.target ? " targeted" : " not targeted"));
      };
      var vis = lab.querySelector(".vis");
      if (vis) lab.insertBefore(b, vis); else lab.appendChild(b);
    });
  }
  function save() { if (typeof tlSave === "function") tlSave(); }
  /** the layers Ctrl+K works on with no clip selected (layer keys) */
  function targeted() { return T().targeted(tl, tl.selLayer || "v1"); }

  function paintLinkBtn() {
    var b = $("tlLinkSel"); if (!b) return;
    var on = tl.linkSel !== false;
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    b.title = "Linked selection " + (on ? "ON" : "OFF") + ": a picture and its separated sound (🔗 Sound in a clip's Properties) " + (on ? "move and trim together" : "move on their own");
  }

  /** Properties: the 🔗 Sound row on a video clip (or a separated sound) */
  function hook(P, c, sel) {
    if (!P || !c || !sel || !sel.Ly) return;
    var k = sel.Ly.kind, isVid = (k === "v1" || k === "vl") && !c.text && !c.m3d && !c.adjust, isSnd = k === "aud" && (c.link || c.wasLink);
    if (!isVid && !isSnd) return;
    if ($("tlpLinkRow")) $("tlpLinkRow").remove();
    var row = document.createElement("div");
    row.className = "tlp-row"; row.id = "tlpLinkRow";
    var linked = !!c.link, was = !!c.wasLink, out = isVid ? !!c.soundOut : true;
    var h = '<span style="font-size:.72rem" title="A picture\'s sound as a clip of its own (a linked clip)">🔗 Sound</span>';
    if (isVid && !out) h += '<button class="ghost" type="button" id="tlpSndOut" title="The sound becomes a clip on a sound layer, linked to this picture (which then plays silent)">⤓ as its own clip</button>';
    if (linked) h += '<button class="ghost" type="button" id="tlpUnlink" title="Break the link: each moves on its own from now on">⛓ Unlink</button>';
    if (!linked && was) h += '<button class="ghost" type="button" id="tlpRelink" title="Pair them again">🔗 Link</button>';
    if (out && (linked || was)) h += '<button class="ghost" type="button" id="tlpSndBack" title="Remove the separate sound clip and give the picture its own sound back">↩ Sound back</button>';
    row.innerHTML = h;
    P.appendChild(row);
    var act = function (fn, msg) {
      try { fn(); } catch (e) { say("🔗 " + (e.message || e)); return; }
      snap = T().sync(tl, null);
      save(); renderTimeline(); TlCanvas.mark(); if (TlCanvas.paintProps) TlCanvas.paintProps();
      say(msg); log(msg);
    };
    if ($("tlpSndOut")) $("tlpSndOut").onclick = function () {
      act(function () { T().separate(tl, c, k, (sel.Ly.L && sel.Ly.L.name) || (k === "v1" ? "V1" : "V")); }, "🔗 " + (c.name || "the clip") + ": its sound is a clip of its own (linked)");
    };
    if ($("tlpUnlink")) $("tlpUnlink").onclick = function () { act(function () { T().unlink(tl, c); }, "⛓ unlinked - each moves on its own"); };
    if ($("tlpRelink")) $("tlpRelink").onclick = function () { act(function () { T().relink(tl, c); }, "🔗 linked again"); };
    if ($("tlpSndBack")) $("tlpSndBack").onclick = function () { act(function () { T().putBack(tl, c); }, "↩ the picture has its own sound back"); };
  }

  function start() {
    if (!$("tltgCss")) { var st = document.createElement("style"); st.id = "tltgCss"; st.textContent = CSS; document.head.appendChild(st); }
    var orig = window.renderTimeline;
    if (typeof orig === "function" && !orig._tltg) {
      var wrapped = function () { var r = orig.apply(this, arguments); try { paintTargets(); paintLinkBtn(); } catch (e) { /* never breaks the timeline */ } return r; };
      wrapped._tltg = true; wrapped._tlmk = orig._tlmk;
      window.renderTimeline = wrapped;
    }
    var os = window.tlSave;
    if (typeof os === "function" && !os._tltg) {
      // linked selection: a pair follows whichever of the two moved / was trimmed since the last save
      var ws = function () {
        try { var s2 = T().sync(tl, snap); var moved = s2._moved; snap = s2; if (moved) setTimeout(function () { try { renderTimeline(); } catch (e) { /* fine */ } }, 0); } catch (e) { /* never blocks a save */ }
        return os.apply(this, arguments);
      };
      ws._tltg = true;
      window.tlSave = ws;
    }
    snap = T().sync(tl, null);
    var bar = $("tlbar");
    if (bar && !$("tlLinkSel")) {
      var b = document.createElement("button");
      b.className = "ghost"; b.id = "tlLinkSel"; b.type = "button"; b.textContent = "🔗";
      b.setAttribute("aria-label", "Linked selection");
      b.onclick = function () { tl.linkSel = tl.linkSel === false; snap = T().sync(tl, null); save(); paintLinkBtn(); say("🔗 Linked selection " + (tl.linkSel !== false ? "on" : "off")); };
      var ref = $("tlMarkBtn") || $("tlSelGrp");
      if (ref && ref.parentNode) ref.parentNode.insertBefore(b, ref); else bar.appendChild(b);
    }
    TlCanvas.onProps(hook);
    paintTargets(); paintLinkBtn();
  }
  function boot() { if (!ready()) { setTimeout(boot, 90); return; } start(); }
  window.TlTargets = { targeted: targeted, paint: paintTargets, hook: hook, snap: function () { return snap; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
