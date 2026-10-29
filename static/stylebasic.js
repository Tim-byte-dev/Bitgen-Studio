/* bitGen Studio — static/stylebasic.js (2.615.0): BASIC SETTINGS FOLLOW THE STYLE (H3StyleBasic) - misc/basic_settings.tmp.
 *
 * Tim (verbatim): "when user changes a style anywhere in bitgen, save the all basic settings+style name in basic settings
 * docker to misc\basic_settings.tmp. if the file does not exist , create it . this operation must be done before changing
 * the style. load the basic settings on start with the last style used before previous session closed and when style
 * changes. if basic settings change for a style change the settings in the file when user changes style - so if user is
 * testing different styles and basic settings it will be easier".
 *
 *   A STYLE CHANGE (the video style - the prompt docker's Video list, Basic Settings' style card, a project, a board ... -
 *   or the image style): FIRST every Basic Settings field + the style's name is written to misc/basic_settings.tmp under
 *   the style being LEFT (the file is made when missing - POST /api/basic-settings/styles, lib/basicTmp.js), THEN the
 *   style changes (its own handler: resolution / steps / cfg from the style ...), THEN the settings last kept for the NEW
 *   style are put back - a video style puts back everything but the image set, an image style the image set.
 *   A style never used before keeps what the style itself gives.
 *   START: the last video / image style of the last session is picked again with its settings.
 *   KEPT UP TO DATE: the current styles' settings are written again when they change (a quiet look every 5 s) and when
 *   the app closes - so the file always has what you last had for each style.
 * Pure (Node: scripts/test-stylebasic615.js): split(values, isImage) -> {video, image}, pickFor(kind, values, isImage).
 */
(function (root) {
  "use strict";
  /** the image set's fields go with the image style, everything else with the video style */
  function pickFor(kind, vals, isImage) {
    var o = {};
    Object.keys(vals || {}).forEach(function (k) { if ((kind === "image") === !!isImage(k)) o[k] = vals[k]; });
    return o;
  }
  function split(vals, isImage) { return { video: pickFor("video", vals, isImage), image: pickFor("image", vals, isImage) }; }
  var API = { pickFor: pickFor, split: split };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = API; return; }

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  var SELS = [{ kind: "video", id: "videoStyleSel" }, { kind: "image", id: "styleSel" }];
  var URL_ = "/api/basic-settings/styles";
  var file = { last: {}, styles: {} }, prev = {}, ready = false, kept = {};
  function B() { return root.H3BasicCfg || null; }
  function isImage(id) { var el = $(id); return !!(el && el.closest && el.closest("#iset")); }
  function nameOf(sel) { var o = sel && sel.options && sel.options[sel.selectedIndex]; return o ? String(o.textContent || o.value || "").trim() : ""; }
  function key(kind, id) { return kind + ":" + (id || ""); }
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[style settings] " + t); } catch (e) { /* fine */ } }
  function test(ev, v) { try { if (root.H3TestEvent) root.H3TestEvent(ev, v); } catch (e) { /* the 🧪 list */ } }

  /** the settings now, kept for that style (the file + the copy here, so a style change right after needs no fetch) */
  function keep(kind, id, name, last) {
    var b = B(); if (!b) return null;
    var basic = b.collect(), body = { kind: kind, id: id || "", name: name || "", basic: basic, last: last !== false };
    file.styles[key(kind, id)] = { kind: kind, id: id || "", style: body.name, basic: basic, saved: new Date().toISOString() };
    if (last !== false) { file.last[kind] = id || ""; }
    kept[key(kind, id)] = JSON.stringify(basic);
    try { root.fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(function () { /* next time */ }); } catch (e) { /* fine */ }
    test("style_basic_saved", key(kind, id));
    return basic;
  }
  /** the settings kept for a style put back (the fields of its kind) -> how many changed, or -1 when there are none */
  function restore(kind, id) {
    var e = file.styles[key(kind, id)], b = B();
    if (!e || !e.basic || !b) return -1;
    var n = b.apply(pickFor(kind, e.basic, isImage));
    kept[key(kind, id)] = JSON.stringify(b.collect());
    test("style_basic_loaded", key(kind, id));
    return n;
  }

  /** the select's own onchange wrapped: keep (the style being left) -> its handler -> put back (the new style's) */
  function wrap(s) {
    var sel = $(s.id); if (!sel || typeof sel.onchange !== "function" || sel.onchange._sb) return;
    var orig = sel.onchange;
    var w = function () {
      var nid = sel.value, p = prev[s.kind];
      var moving = ready && p && p.id !== nid;
      if (moving) keep(s.kind, p.id, p.name, false);              // BEFORE the style changes
      var r = orig.apply(this, arguments);
      prev[s.kind] = { id: nid, name: nameOf(sel) };
      if (moving) {
        var n = restore(s.kind, nid);
        file.last[s.kind] = nid;
        if (n < 0) keep(s.kind, nid, nameOf(sel), true);             // a style never used before: what it gives now
        else { try { root.fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "last", kind: s.kind, id: nid }) }).catch(function () { /* fine */ }); } catch (e) { /* fine */ } }
        log((p.name || "no style") + " → " + (nameOf(sel) || "no style") + (n >= 0 ? ": its Basic Settings put back (" + n + " changed)" : ": first use - its settings kept from now on"));
      }
      return r;
    };
    w._sb = true; sel.onchange = w;
  }
  /** a style set without its onchange (a project restoring its state): remembered as the current one */
  function watch() {
    SELS.forEach(function (s) {
      wrap(s);
      var sel = $(s.id); if (!sel || !ready) return;
      var p = prev[s.kind];
      if (!p || p.id !== sel.value) { prev[s.kind] = { id: sel.value, name: nameOf(sel) }; file.last[s.kind] = sel.value;
        try { root.fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "last", kind: s.kind, id: sel.value }) }).catch(function () { /* fine */ }); } catch (e) { /* fine */ } }
    });
  }
  /** the current styles' settings written again when they changed (5 s), and when the app closes */
  function refresh(beacon) {
    var b = B(); if (!ready || !b) return 0;
    var now = JSON.stringify(b.collect()), n = 0;
    SELS.forEach(function (s) {
      var sel = $(s.id); if (!sel) return;
      var k = key(s.kind, sel.value);
      if (kept[k] === now) return;
      n++;
      if (beacon && root.navigator && root.navigator.sendBeacon) {
        try { root.navigator.sendBeacon(URL_, new Blob([JSON.stringify({ kind: s.kind, id: sel.value, name: nameOf(sel), basic: JSON.parse(now) })], { type: "application/json" })); kept[k] = now; } catch (e) { /* fine */ }
      } else keep(s.kind, sel.value, nameOf(sel), true);
    });
    return n;
  }

  /** the start: the last session's styles picked again, their settings put back - after Basic Settings' own file is in */
  async function start() {
    try { var j = await (await root.fetch(URL_)).json(); if (j && j.styles) file = { last: j.last || {}, styles: j.styles }; } catch (e) { /* none yet */ }
    SELS.forEach(function (s) {
      var sel = $(s.id); if (!sel) return;
      var want = file.last ? file.last[s.kind] : undefined;
      if (want != null && sel.value !== want && [].some.call(sel.options, function (o) { return o.value === want; })) {
        sel.value = want;
        sel.dispatchEvent(new Event("change", { bubbles: true }));   // its own handler + the config's ui.style / vstyle (ready is off: nothing kept yet)
      }
      prev[s.kind] = { id: sel.value, name: nameOf(sel) };
    });
    var put = 0;
    SELS.forEach(function (s) { var sel = $(s.id); if (sel) { var n = restore(s.kind, sel.value); if (n > 0) put += n; } });
    ready = true;
    refresh(false);                                                  // the file exists from the first start
    log("the last styles' Basic Settings put back (" + put + " field(s))");
    test("style_basic_ready", String(put));
  }
  var waited = 0;
  function boot() {
    SELS.forEach(wrap);
    var b = B(), lists = waited > 20000 || SELS.every(function (s) { var sel = $(s.id); return !sel || sel.options.length > 1 || sel.value; });
    // (and after the page's own restore of the config's styles - its late retry at 2.5 s would pick those again)
    var t = root.performance && root.performance.now ? root.performance.now() : 1e9;
    if (!b || !b.state || !b.state().started || !lists || t < 4000) { waited += 400; root.setTimeout(boot, 400); return; }
    root.setTimeout(function () { start().catch(function () { ready = true; }); }, 300);
  }
  root.setInterval(function () { watch(); refresh(false); }, 5000);
  root.setInterval(watch, 1000);
  root.addEventListener("beforeunload", function () { refresh(true); });
  root.H3StyleBasic = Object.assign(API, { keep: keep, restore: restore, refresh: refresh, file: function () { return file; }, ready: function () { return ready; }, isImage: isImage });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
