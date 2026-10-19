/* bitGen Studio — static/realrefs.js (2.540.0): THE REFERENCE DOCKER'S PICTURES FOR THE OBJECTS OF A BLENDER / UNREAL
 * RENDER (window.RealRefs; UMD - lib/realRefs.js uses the same functions).
 *
 * Tim (verbatim): "can we make it so the timeline and image-edit renders of blender and unreal use our references from
 * the reference docker. so it sees a block in a blender layer, the block is a car, the reference for the car is in our
 * reference docker etc. for all objects/meshes and is animated with our 3dreal" - asked: matched by the objects' names
 * AND set by hand (a dropdown per object).
 *
 *   MATCH       an object named "car" / "Car.001" / "SM_Sofa_02" meets the reference whose description, type or file
 *               name has that word - or a word that means the same (car = vehicle, auto, sedan …; sofa = couch,
 *               chesterfield …). A choice by hand beats it; "-" = no reference for that object.
 *   WHERE       each object's box on the picture (0-1) -> "on the left", "in the middle, at the back" …
 *   THE PROMPTS framePrompt: the picture edit that turns the grey layout's FIRST FRAME into a photo with the reference
 *               pictures (Picture 1 = the render, 2… = the references); videoPrompt: the 3DREAL animation's prompt with
 *               what each object really is (its first frame = that photo)
 *   PROJECT     ueBox: an Unreal actor's bounds through an Unreal camera -> its box (X forward, Y right, Z up; the fov
 *               across the width, like a SceneCapture2D); boxOf: projected points -> a box (null when nothing is in view)
 * Pure (Node: scripts/test-realrefs540.js): words, autoMatch, resolve, where, framePrompt, videoPrompt, ueBox, boxOf, label.
 */
(function (root) {
  "use strict";
  var SYN = [
    ["car", "vehicle", "auto", "automobile", "sedan", "coupe", "hatchback", "suv", "jeep", "ute", "pickup", "truck", "van", "taxi", "racecar", "muscle"],
    ["bike", "bicycle", "motorbike", "motorcycle", "scooter"],
    ["sofa", "couch", "settee", "chesterfield", "loveseat", "lounge"],
    ["chair", "armchair", "stool", "seat", "recliner"],
    ["table", "desk", "counter", "bench"],
    ["bed", "mattress", "bunk"],
    ["lamp", "light", "lantern", "chandelier", "pendant", "sconce", "streetlight"],
    ["tree", "plant", "bush", "shrub", "palm", "pot", "flower"],
    ["person", "man", "woman", "girl", "boy", "figure", "character", "human", "body", "mannequin", "actor", "people"],
    ["dog", "puppy", "hound"], ["cat", "kitten"], ["horse", "pony"],
    ["house", "building", "home", "cabin", "shed", "tower"],
    ["wall", "walls", "fence", "facade"], ["floor", "ground", "road", "street", "path", "pavement", "terrain"],
    ["door", "gate"], ["window", "glass"], ["boat", "ship", "yacht"], ["plane", "aircraft", "jet", "airplane"],
    ["tv", "television", "screen", "monitor"], ["rock", "stone", "boulder"], ["box", "crate", "chest", "cube"],
  ];
  var IGNORE = { "sm": 1, "bp": 1, "mesh": 1, "obj": 1, "object": 1, "geo": 1, "low": 1, "high": 1, "lod": 1, "the": 1, "a": 1, "an": 1, "of": 1, "and": 1, "with": 1, "in": 1, "on": 1,
    "png": 1, "jpg": 1, "jpeg": 1, "webp": 1, "ref": 1, "reference": 1, "copy": 1, "new": 1, "old": 1, "big": 1, "small": 1, "red": 1, "blue": 1, "green": 1, "black": 1, "white": 1, "grey": 1, "gray": 1 };
  var GROUP = {}; SYN.forEach(function (g, i) { g.forEach(function (w) { GROUP[w] = i; }); });
  /** the words of a name ("SM_SportsCar.002" -> sports, car) - camelCase, digits, _ . - split; short / generic words out */
  function words(s) {
    var t = String(s == null ? "" : s).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z]+/g, " ").trim();
    if (!t) return [];
    var out = []; t.split(" ").forEach(function (w) { if (w.length >= 2 && !IGNORE[w] && out.indexOf(w) < 0) out.push(w); if (/s$/.test(w) && w.length > 3 && GROUP[w.slice(0, -1)] != null && out.indexOf(w.slice(0, -1)) < 0) out.push(w.slice(0, -1)); });
    return out;
  }
  function score(objWords, refWords) {
    var s = 0;
    objWords.forEach(function (w) {
      if (refWords.indexOf(w) >= 0) s = Math.max(s, w.length >= 4 ? 3 : 2);
      else if (GROUP[w] != null && refWords.some(function (r) { return GROUP[r] === GROUP[w]; })) s = Math.max(s, 2);
    });
    return s;
  }
  /** a description's words without the ones that only describe the next thing ("a brass floor lamp" is a lamp, not a floor;
      "a car seat" is a seat) - a known word straight before another known word is left out */
  function heads(ws, desc) {
    var raw = String(desc == null ? "" : desc).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").filter(function (w) { return w && !IGNORE[w]; });
    var g = function (w) { return w && (GROUP[w] != null || GROUP[w.replace(/s$/, "")] != null); };
    var mod = {}; raw.forEach(function (w, i) { if (g(w) && g(raw[i + 1])) mod[w] = 1; });
    return ws.filter(function (w) { return !mod[w] || raw.filter(function (x, i) { return x === w && !g(raw[i + 1]); }).length; });
  }
  /** what a reference is called (its description, its type, its file name) */
  function label(r) { return String((r && (r.desc || r.name)) || "reference").trim(); }
  /** objects [{name}] + refs [{name, desc, role}] -> {objectName: refIndex} for the ones whose words meet (best score, then the first) */
  function autoMatch(objects, refs) {
    var R = (refs || []).map(function (r) { return heads(words(String(r.desc || "")), r.desc).concat(words((r.role && !/^(person|subject|other)$/.test(r.role) ? r.role : "") + " " + String(r.name || "").replace(/\.[a-z0-9]+$/i, ""))); }), out = {};
    (objects || []).forEach(function (o) {
      var ow = words(o.name), best = -1, bs = 0;
      R.forEach(function (rw, i) { var s = score(ow, rw); if (s > bs) { bs = s; best = i; } });
      if (best >= 0) out[o.name] = best;
    });
    return out;
  }
  /** the objects with their reference: manual {name: index | "-"} beats the automatic match -> [{object, box, ref, how}] */
  function resolve(objects, refs, manual) {
    var auto = autoMatch(objects, refs), man = manual || {}, out = [];
    (objects || []).forEach(function (o) {
      var m = man[o.name], k = m === "-" ? -1 : m != null && m !== "" && refs[+m] ? +m : auto[o.name] != null ? auto[o.name] : -1;
      if (k >= 0) out.push({ object: o.name, box: o.box || null, ref: k, how: m != null && m !== "" && m !== "-" ? "manual" : "auto" });
    });
    return out;
  }
  /** a box [x0, y0, x1, y1] (0-1 of the picture) -> words for where it is */
  function where(b) {
    if (!b) return "";
    var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, area = Math.max(0, (b[2] - b[0]) * (b[3] - b[1]));
    var h = cx < 0.36 ? "on the left" : cx > 0.64 ? "on the right" : "in the middle";
    var v = area > 0.3 ? "filling much of the picture" : cy < 0.36 ? "near the top" : cy > 0.7 ? "at the front" : "";
    return h + (v ? ", " + v : "");
  }
  function cap(t) { return t.replace(/^./, function (c) { return c.toUpperCase(); }); }
  function nice(o) { var w = words(o); return w.length ? w.join(" ") : clean(o, 40).toLowerCase(); }
  function clean(t, n) { return String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, n || 200); }
  /** the FIRST FRAME edit: Picture 1 = the render, Picture (2 + i) = items[i]'s reference (refs[ref]); base = the user's words */
  function framePrompt(items, refs, base, opts) {
    var o = opts || {}, kind = o.kind === "unreal" ? "an Unreal Engine render" : "a grey 3D layout render";
    var seen = {}, pics = [], lines = [];
    (items || []).forEach(function (it) {
      if (seen[it.ref] == null) { seen[it.ref] = pics.length; pics.push(it.ref); }
      var n = (o.tags ? "<image" + (seen[it.ref] + 2) + ">" : "Picture " + (seen[it.ref] + 2)), r = refs[it.ref] || {}, wd = where(it.box);
      var what = clean(label(r), 120), the = /^(a|an|the|his|her|my|our|their)\s/i.test(what) ? "" : "the ";
      if (/^(wall|floor)$/.test(r.role || "")) lines.push("The " + (r.role === "floor" ? "floor" : "wall") + " surface" + (wd ? " " + wd : "") + " (the object \"" + clean(it.object, 60) + "\") looks like " + n + " (" + what + ").");
      else lines.push("The " + (o.kind === "unreal" ? "" : "grey ") + "shape" + (wd ? " " + wd : "") + " (the object \"" + clean(it.object, 60) + "\") becomes " + the + what + " in " + n + ".");
    });
    var p1 = o.tags ? "<image1>" : "Picture 1";
    return { pics: pics, prompt: p1 + " is " + kind + " - the layout, the camera angle and where everything stands. Make it a real photograph of the same scene. "
      + lines.join(" ") + " Keep every object exactly where it is, at the same size and angle; keep the camera, the perspective and the composition; no extra objects."
      + (clean(base, 1500) ? " " + cap(clean(base, 1500)) : "") };
  }
  /** the 3DREAL animation's prompt: the user's words + what each object really is */
  function videoPrompt(items, refs, base) {
    var seen = {}, bits = [];
    (items || []).forEach(function (it) { if (seen[it.ref]) return; seen[it.ref] = 1; bits.push("the " + nice(it.object) + " is " + clean(label(refs[it.ref] || {}), 120)); });
    var b = clean(base, 4000);
    return (b ? cap(b) + (/[.!?]$/.test(b) ? " " : ". ") : "") + (bits.length ? cap(bits.join("; ")) + ". Keep them exactly as in the first frame." : "");
  }
  /** projected points [[x, y] | null] on a w x h picture -> [x0, y0, x1, y1] 0-1, clipped; null = not in view */
  function boxOf(pts, w, h) {
    var p = (pts || []).filter(Boolean); if (!p.length) return null;
    var xs = p.map(function (q) { return q[0] / w; }), ys = p.map(function (q) { return q[1] / h; });
    var b = [Math.max(0, Math.min.apply(null, xs)), Math.max(0, Math.min.apply(null, ys)), Math.min(1, Math.max.apply(null, xs)), Math.min(1, Math.max.apply(null, ys))];
    if (b[2] - b[0] < 0.005 || b[3] - b[1] < 0.005) return null;
    return b.map(function (v) { return Math.round(v * 1000) / 1000; });
  }
  /** an Unreal actor's bounds (origin, extent - cm) through an Unreal camera {loc, rot: [roll, pitch, yaw] | {pitch, yaw}, fov} -> box */
  function ueBox(cam, w, h, origin, extent) {
    var rot = cam.rot || [0, 0, 0], pitch = (Array.isArray(rot) ? rot[1] : rot.pitch) * Math.PI / 180, yaw = (Array.isArray(rot) ? rot[2] : rot.yaw) * Math.PI / 180;
    var f = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)], r = [-Math.sin(yaw), Math.cos(yaw), 0];
    var u = [-Math.sin(pitch) * Math.cos(yaw), -Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch)];
    var fx = (w / 2) / Math.tan(((cam.fov || 90) * Math.PI / 180) / 2), L = cam.loc || [0, 0, 0], pts = [];
    for (var a = -1; a <= 1; a += 2) for (var b = -1; b <= 1; b += 2) for (var c = -1; c <= 1; c += 2) {
      var v = [origin[0] + a * extent[0] - L[0], origin[1] + b * extent[1] - L[1], origin[2] + c * extent[2] - L[2]];
      var z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
      pts.push(z <= 1 ? null : [w / 2 + (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) * fx / z, h / 2 - (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) * fx / z]);
    }
    if (pts.filter(Boolean).length < 2) return null;
    return boxOf(pts, w, h);
  }

  /* ---------------- the list under a render: an object -> its reference (a dropdown each) */
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /** objects [{name, box?}], refs (H3Refs.images()), manual {name: k | "-"} -> the HTML of the list */
  function listHtml(objects, refs, manual) {
    var auto = autoMatch(objects, refs), man = manual || {};
    if (!(objects || []).length) return '<div class="rrnote">no objects - nothing to give a reference</div>';
    return '<div class="rrlist">' + objects.slice(0, 60).map(function (o) {
      var m = man[o.name], k = m === "-" ? "-" : m != null && m !== "" ? String(m) : "", a = auto[o.name];
      var opts = '<option value="">' + (a != null ? "auto: " + esc(label(refs[a]).slice(0, 40)) : "- none (auto: no match) -") + "</option>" + '<option value="-"' + (k === "-" ? " selected" : "") + ">- no reference -</option>"
        + (refs || []).map(function (r, i) { return '<option value="' + i + '"' + (k === String(i) ? " selected" : "") + ">" + esc(label(r).slice(0, 50)) + (r.role && r.role !== "person" ? " · " + esc(r.role) : "") + "</option>"; }).join("");
      return '<div class="rrrow"><span title="' + esc(o.name) + (o.box ? " · " + esc(where(o.box)) : "") + '">' + esc(o.name) + '</span><select data-rrobj="' + esc(o.name) + '" aria-label="Reference for ' + esc(o.name) + '">' + opts + "</select></div>";
    }).join("") + "</div>";
  }
  /** listen to the dropdowns: onChange(name, value) ("" = auto, "-" = none, "3" = the dock's 4th picture) */
  function bindList(host, onChange) {
    if (!host) return;
    Array.prototype.forEach.call(host.querySelectorAll("[data-rrobj]"), function (s) {
      s.addEventListener("change", function () { onChange(s.getAttribute("data-rrobj"), s.value); });
      s.addEventListener("keydown", function (e) { e.stopPropagation(); });
    });
  }
  function css() {
    if (typeof document === "undefined" || document.getElementById("realrefsCss")) return;
    var s = document.createElement("style"); s.id = "realrefsCss";
    s.textContent = ".rrlist{display:flex;flex-direction:column;gap:2px;max-height:180px;overflow:auto}.rrrow{display:grid;grid-template-columns:minmax(60px,1fr) 1.4fr;gap:4px;align-items:center;font-size:.68rem}"
      + ".rrrow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rrrow select{min-width:0;font-size:.66rem}.rrnote{font-size:.66rem;color:var(--dim,#999)}";
    (document.head || document.documentElement).appendChild(s);
  }
  /** the dock's pictures as blobs + what the request carries: {form fields, items} for POST /api/realrefs/start */
  function formFor(items, refs) {
    var used = [], idx = {};
    (items || []).forEach(function (it) { if (idx[it.ref] == null) { idx[it.ref] = used.length; used.push(it.ref); } });
    return { used: used, items: (items || []).map(function (it) { return { object: it.object, box: it.box, ref: idx[it.ref] }; }),
      refs: used.map(function (k) { var r = refs[k] || {}; return { desc: label(r), role: r.role || "", name: r.name || "" }; }) };
  }
  /** (the page) the resolved items' pictures -> POST /api/realrefs/upload -> {token, items (ref = index into the set), refs} */
  function upload(items, refs) {
    var f = formFor(items, refs), fd = new FormData();
    if (!f.used.length) return Promise.reject(new Error("no object has a reference picture"));
    return Promise.all(f.used.map(function (k) { var r = refs[k] || {}; return r.file ? Promise.resolve(r.file) : fetch(r.url).then(function (x) { return x.blob(); }); })).then(function (blobs) {
      blobs.forEach(function (b, i) { fd.append("ref" + i, b, "ref" + i + ".png"); });
      fd.append("refs", JSON.stringify(f.refs));
      return fetch("/api/realrefs/upload", { method: "POST", body: fd }).then(function (x) { return x.json().then(function (j) { if (!x.ok) throw new Error(j.error || "upload refused"); return { token: j.token, items: f.items, refs: j.refs }; }); });
    });
  }
  /** (the page) follow a chain: onStep(status) until done / error -> the last status */
  function follow(id, onStep) {
    return new Promise(function (ok) {
      (function poll() {
        fetch("/api/realrefs/" + encodeURIComponent(id)).then(function (x) { return x.json(); }).then(function (st) {
          if (onStep) try { onStep(st); } catch (e) { /* the page's own */ }
          if (st.state === "done" || st.state === "error" || st.error && !st.state) ok(st); else setTimeout(poll, 2000);
        }).catch(function () { setTimeout(poll, 3000); });
      })();
    });
  }
  /** a chain's status in words */
  function stepText(st) {
    if (!st) return "";
    if (st.state === "edit") return "🖼 making the first frame real with " + (st.take || 0) + " reference picture(s) (job " + st.edit + ")…";
    if (st.state === "real") return "🎬 3DREAL animates it (job " + st.real + ")…";
    if (st.state === "done") return st.kind === "video" ? "✓ done - the 3DREAL render is in the gallery (job " + st.real + ")" : "✓ done";
    if (st.state === "error") return "✗ " + (st.error || "failed");
    return "";
  }
  var api = { upload: upload, follow: follow, stepText: stepText, SYN: SYN, words: words, heads: heads, autoMatch: autoMatch, resolve: resolve, where: where, framePrompt: framePrompt, videoPrompt: videoPrompt, boxOf: boxOf, ueBox: ueBox, label: label,
    listHtml: listHtml, bindList: bindList, formFor: formFor };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.RealRefs = api;
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", css); else css(); }
})(typeof window !== "undefined" ? window : globalThis);
