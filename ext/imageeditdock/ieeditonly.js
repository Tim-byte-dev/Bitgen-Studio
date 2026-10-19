/* bitGen Studio — ext/imageeditdock/ieeditonly.js (2.502.0): EDIT IMAGE MODE lists only EDIT-CAPABLE image styles.
 *
 * Tim (verbatim): "in edit image mode, show only models that can edit the images in the image dropdown".
 *
 * While the image editor dock is on screen (edit image mode - mount.js switches Generate to Image then), the prompt
 * docker's image style dropdown (#styleSel) hides every style that cannot edit a picture. "Can edit" is the server's
 * own answer (GET /api/aiedit/engines -> edit: an instruction-edit graph, or a FLUX.2 / FLUX 3 Klein style that swaps
 * to its edit sibling - lib/aiEdit.engines), the same list the ✨ AI panel's Edit model shows. A hidden style that was
 * picked is swapped for an edit one and remembered; closing the editor shows them all again and puts it back.
 * Nothing is removed from the list - the options are hidden + disabled, so the page's own code (style reloads,
 * project restore) keeps working on the whole list.
 * Pure (Node: scripts/test-ieeditonly.js): pick(options, editIds, current, preferred).
 */
(function (root) {
  "use strict";
  /** which option to show: the current one when it can edit, else the preferred one, else the first edit-named,
   *  else the first that can edit; null when nothing can */
  function pick(values, edit, current, preferred) {
    var ok = values.filter(function (v) { return v && edit.has(v); });
    if (!ok.length) return null;
    if (edit.has(current)) return current;
    if (preferred && edit.has(preferred)) return preferred;
    return ok[0];
  }
  var pure = { pick: pick };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, edit = null, busy = false, wasOn = false, t = null;
  var $ = function (id) { return doc.getElementById(id); };
  var pref = {
    get: function (k) { try { return root.localStorage.getItem("h3." + k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) root.localStorage.removeItem("h3." + k); else root.localStorage.setItem("h3." + k, v); } catch (e) { /* private */ } }
  };
  function onScreen() { var d = $("imageeditdock"); return !!d && !d.classList.contains("dockgone") && !d.classList.contains("collapsed"); }
  function load() {
    return root.fetch("/api/aiedit/engines").then(function (r) { return r.json(); }).then(function (j) {
      edit = new Set(((j && j.edit) || []).map(function (s) { return s.id; }));
    }).catch(function () { edit = null; });
  }
  function apply() {
    var sel = $("styleSel"); if (!sel || busy) return;
    var on = onScreen() && !!edit && edit.size > 0;
    busy = true;
    try {
      var opts = [].slice.call(sel.options);
      opts.forEach(function (o) { var hide = on && !!o.value && !edit.has(o.value); o.hidden = hide; o.disabled = hide; });
      sel.classList.toggle("ie-editonly", on);
      if (on) {
        sel.dataset.ieTitle = sel.dataset.ieTitle || sel.title || "";
        sel.title = "Edit image mode: only styles that can edit a picture are listed (close the image editor to see them all)";
        var want = pick(opts.map(function (o) { return o.value; }), edit, sel.value, pref.get("ie.editStyle"));
        if (want && want !== sel.value) {
          if (!wasOn) pref.set("ie.styleWas", sel.value);
          sel.value = want;
          if (sel.onchange) sel.onchange();
        }
        if (sel.value) pref.set("ie.editStyle", sel.value);
      } else {
        if (sel.dataset.ieTitle != null) { sel.title = sel.dataset.ieTitle; delete sel.dataset.ieTitle; }
        var was = pref.get("ie.styleWas");
        if (wasOn && was && opts.some(function (o) { return o.value === was; }) && edit && edit.has(sel.value) && !edit.has(was)) {
          sel.value = was;
          if (sel.onchange) sel.onchange();
        }
        if (wasOn) pref.set("ie.styleWas", null);
      }
      wasOn = on;
    } finally { busy = false; }
  }
  function soon() { clearTimeout(t); t = setTimeout(apply, 80); }
  function boot() {
    var sel = $("styleSel"), dock = $("imageeditdock");
    if (!sel || !dock) { setTimeout(boot, 500); return; }
    if (typeof MutationObserver === "function") {
      new MutationObserver(function () { load().then(soon); }).observe(sel, { childList: true });   // a style reload
      new MutationObserver(soon).observe(dock, { attributes: true, attributeFilter: ["class"] });      // opened / closed
    }
    sel.addEventListener("change", function () { if (wasOn && sel.value) pref.set("ie.editStyle", sel.value); });
    load().then(apply);
  }
  root.IeEditOnly = { pick: pick, apply: function () { return load().then(apply); }, ids: function () { return edit; } };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
