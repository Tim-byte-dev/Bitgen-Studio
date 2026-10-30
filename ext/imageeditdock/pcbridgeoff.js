/* pcbridgeoff.js — A BRIDGE LAYER DELETED OR HIDDEN = ITS BRIDGE CLOSED, ITS SCENE OFF THE SCREEN (2.618.0), window.PCBridgeOff.
 *
 * Tim (verbatim): "when the blender or unreal or daz layer is deleted or made "hidden" or deleted then close the bridge and
 * don't show the scene in image editor or timeline".
 *
 * Watches the image editor's layers (each refresh + every 0.6 s) - "gone" = deleted (or the document closed), "hidden" =
 * its 👁 off or a group it is in hidden (pcdoc shown()):
 *   🟧 BLENDER LAYER (L.bscene)   the scene tools open on it close WITHOUT keeping a view (that would make a new layer);
 *                                 the scene (TlBlend) closes when no shown Blender layer of that scene is left - the
 *                                 timeline's 🟧 preview of it goes too, the server forgets the open scene. Shown / undone
 *                                 again, the layer still has its picture; 🟧 Scene tools opens its scene again.
 *   🧊 3D LAYER (L.l3d - a Daz or Blender scene)   its scene's Blender ends (POST /api/layer3d/:id/close) when no shown
 *                                 3D layer of that scene is left, and the commands still waiting for Daz's live link are
 *                                 dropped (POST /api/daz/live/clear). Its next render starts Blender again.
 *   🎮 UNREAL / METAHUMAN LAYER   pcuelive.js closes the 📺 Unreal View itself (the timeline's: tluelive.js).
 * Pure (Node: scripts/test-bridgeoff618.js): keysOf(layers, shown) -> {blend: Set(stem), l3d: Set(id)}, dropped(before, now).
 */
(function (root) {
  "use strict";
  /** the scenes the SHOWN layers hold: Blender layers by their scene's stem, 3D layers by their scene id */
  function keysOf(layers, shown) {
    const blend = new Set(), l3d = new Set();
    for (const L of layers || []) {
      if (!L || (shown && !shown(L))) continue;
      if (L.bscene && typeof L.bscene === "object" && L.bscene.stem) blend.add(String(L.bscene.stem));
      if (L.l3d && typeof L.l3d === "object" && L.l3d.id) l3d.add(String(L.l3d.id));
    }
    return { blend, l3d };
  }
  /** what was shown before and is not now */
  function dropped(before, now) { return [...(before || [])].filter((k) => !(now && now.has(k))); }

  function install(E) {
    const S = E.S, win = E.win || root;
    if (!S || !E.D) return;
    const shown = (L) => (E.D.shown ? E.D.shown(S.layers, L) : L.visible !== false);
    const post = (u) => { try { return root.fetch(u, { method: "POST" }).catch(() => null); } catch (e) { return null; } };
    const log = (t) => { try { if (typeof root.logLine === "function") root.logLine("[bridge] " + t); } catch (e) { /* fine */ } };
    const test = (k, v) => { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } };
    let last = null;
    function check() {
      // the Blender scene tools open on a layer that is gone / hidden: closed, nothing kept
      const BL = E.blendLayer;
      if (BL && BL.isOpen && BL.isOpen() && BL.target) {
        const t = BL.target();
        if (t && (!S.layers.includes(t) || !shown(t))) {
          BL.leave(false, false, true);
          if (E.say) E.say("🟧 " + t.name + (S.layers.includes(t) ? " is hidden" : " was deleted") + " - the Blender scene tools are closed");
          test("ie_bridge_tools_closed", t.name);
        }
      }
      const now = keysOf(S.layers, shown);
      if (last) {
        const TB = root.TlBlend;
        for (const stem of dropped(last.blend, now.blend)) {
          if (TB && TB.close && TB.close(stem)) { log("Blender scene " + stem + " closed - its layer was deleted or hidden"); test("ie_bridge_blend", stem); }
        }
        for (const id of dropped(last.l3d, now.l3d)) {
          post("/api/layer3d/" + encodeURIComponent(id) + "/close");
          post("/api/daz/live/clear");
          log("3D scene " + id + ": its Blender closed, Daz's waiting commands dropped - its layer was deleted or hidden");
          test("ie_bridge_l3d", id);
        }
      }
      last = now;
    }
    const prev = E.refresh;
    if (typeof prev === "function") E.refresh = function () { const r = prev.apply(this, arguments); try { check(); } catch (e) { /* the editor goes on */ } return r; };
    win.setInterval(() => { try { check(); } catch (e) { /* the editor goes on */ } }, 600);
    E.bridgeOff = { check, keys: () => keysOf(S.layers, shown) };
  }

  const PCBridgeOff = { keysOf, dropped, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCBridgeOff;
  else root.PCBridgeOff = PCBridgeOff;
})(typeof window !== "undefined" ? window : globalThis);
