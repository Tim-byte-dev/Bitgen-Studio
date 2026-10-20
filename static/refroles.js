/* bitGen Studio — THE REFERENCE DOCK'S FIRST / LAST FRAME ROLES (2.340.0).
 *
 * Tim: "add options for first frame and last frame in reference image docker
 * type dropdown. if first frame is selected use fl2va, if first frame not
 * selected use ref2va or reference."
 *
 * A picture's Type (the role dropdown under it) can now be "first frame" or
 * "last frame". Pure helpers the page (static/index.html) calls:
 *   plan(mode, refs)   what a video Generate sends: a picture typed First
 *                      frame turns a References (ref2va) render into fl2va -
 *                      first frame [+ last frame]; without one it stays ref2va
 *                      (at most 9 pictures - H3's limit) and a lone Last frame
 *                      rides as an ordinary reference
 *   ltxOrder(refs)     LTX 2.5's picture order: the First frame first, the
 *                      Last frame last, the others between
 *   isFrame(r)         a picture typed first / last frame (not a subject - the
 *                      <subject n> mapping lines leave it out)
 *   roles(refs)        each picture's role, for an image job (Qwen 2.1)
 */
(function (root) {
  "use strict";
  var FIRST = "first frame", LAST = "last frame";
  var H3_MAX = 9;
  function isFrame(r) { return !!r && (r.role === FIRST || r.role === LAST); }
  function roleOf(r) {
    if (!r) return "subject";
    if (r.role === "other") return String(r.roleOther || "").trim() || "subject";
    return r.role || "person";
  }
  function plan(mode, refs) {
    var list = (refs || []).slice();
    // 2.548.0: the dock keeps every picture whatever the mode - each mode sends what it takes
    if (mode !== "ref2va") { var take = mode === "t2va" ? 0 : mode === "swap" ? 1 : mode === "fl2va" ? 2 : list.length;
      return { mode: mode, refs: list.slice(0, take), note: list.length > take ? (list.length - take) + " picture(s) kept in the dock, not used by " + mode : "" }; }
    var first = list.filter(function (r) { return r.role === FIRST; })[0];
    var last = list.filter(function (r) { return r.role === LAST; })[0];
    if (first) {
      var send = last ? [first, last] : [first];
      var left = list.length - send.length;
      return { mode: "fl2va", refs: send,
               note: "First frame picked - fl2va " + (last ? "from the First frame to the Last frame" : "from the First frame")
                 + (left > 0 ? " (" + left + " other picture(s) are not used by fl2va)" : "") };
    }
    var notes = [];
    if (last) notes.push("a Last frame needs a First frame too - it rides as a reference");
    if (list.length > H3_MAX) { notes.push("References takes " + H3_MAX + " pictures - the first " + H3_MAX + " are sent"); list = list.slice(0, H3_MAX); }
    return { mode: "ref2va", refs: list, note: notes.join("; ") };
  }
  function ltxOrder(refs) {
    var list = (refs || []).slice();
    var first = list.filter(function (r) { return r.role === FIRST; })[0];
    var last = list.filter(function (r) { return r.role === LAST; })[0];
    var mid = list.filter(function (r) { return r !== first && r !== last; });
    return (first ? [first] : []).concat(mid).concat(last ? [last] : []);
  }
  function roles(refs) { return (refs || []).map(roleOf); }
  /* 2.388.0 (Tim: "add option to dropdown in reference docker video dropdown -"Append" ... "prepend""): the
     reference dock's video Use dropdown. vids = the dock's videos, ops = {name: "append"|"prepend"}, refs = the
     pictures. -> null (no op: an ordinary Generate) | {op: {name, op}, refs: [the one picture sent], note}
     The picture: the Last frame picture for an Append (the new part ENDS on it), the First frame picture for a
     Prepend (the new part STARTS on it); the video's own frame is the other end (lib/frameOp.js) */
  var OPS = ["append", "prepend"];
  /* 2.395.0 (Tim: "when prepend or append video use fl2va not ref2a or i2v . if there are pictures in the ref images
     tab label the first picture as picture 2. let the llm know the details"): ALWAYS fl2va (H3's first / last frame
     node). <Picture 1> = the video's frame (its LAST frame for an Append - the new part starts on it; its FIRST frame
     for a Prepend - the new part ends on it). <Picture 2> = the other end: the picture typed Last frame (Append) /
     First frame (Prepend), else the FIRST picture in the Image tab. fl2va takes two frames, so the rest stay out. */
  function frameOpPick(op, refs) {
    var list = refs || [];
    var want = op === "append" ? LAST : FIRST;
    return list.filter(function (r) { return r.role === want; })[0] || list[0] || null;
  }
  function frameOpPlan(vids, ops, refs) {
    var o = ops || {};
    var name = (vids || []).filter(function (n) { return OPS.indexOf(o[n]) >= 0; })[0];
    if (!name) return null;
    var op = o[name];
    var pic = frameOpPick(op, refs);
    var others = (refs || []).length - (pic ? 1 : 0);
    var note = (op === "append" ? "Append: " + name + "'s last frame starts the new part (<Picture 1>, the first frame)"
                                : "Prepend: " + name + "'s first frame ends the new part (<Picture 1>, the last frame)")
      + (pic ? " - <Picture 2> " + ((pic.file && pic.file.name) || "") + " is its " + (op === "append" ? "last" : "first") + " frame - fl2va"
             : " - fl2va from <Picture 1> alone" + (op === "prepend" ? ", made forward and played backwards so it ends on the video" : ""))
      + (others > 0 ? "; " + others + " other picture(s) are not used (fl2va takes two frames)" : "");
    return { op: { name: name, op: op }, refs: pic ? [pic] : [], pic: pic, note: note };
  }
  /** the Image tab's tags while an Append / Prepend video is set: the picture used = "Picture 2 · last frame" (append)
      / "Picture 2 · first frame" (prepend); the others "not used" */
  function frameOpTags(plan, refs) {
    return (refs || []).map(function (r) {
      if (!plan) return "";
      return r === plan.pic ? "Picture 2 · " + (plan.op.op === "append" ? "last" : "first") + " frame" : "not used (" + plan.op.op + ")";
    });
  }
  /** one op video at a time: setting one clears the others */
  function setOp(ops, name, op) {
    var out = {};
    if (OPS.indexOf(op) >= 0) out[name] = op;
    return out;
  }
  var api = { FIRST: FIRST, LAST: LAST, H3_MAX: H3_MAX, OPS: OPS, isFrame: isFrame, roleOf: roleOf, plan: plan, ltxOrder: ltxOrder,
              roles: roles, frameOpPlan: frameOpPlan, frameOpPick: frameOpPick, frameOpTags: frameOpTags, setOp: setOp };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RefRoles = api;
})(typeof window !== "undefined" ? window : this);
