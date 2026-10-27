/* pcui.js — THE IMAGE EDITOR'S PHOTOSHOP UI (2.389.0), window.PCUI.
 *
 * Tim (verbatim): "can we build our image editor to have the same functionality and look as
 * https://github.com/storytold/photocraft" - "Rebuild ours, in phases". PhotoCraft's (Photoshop's) layout, our own
 * drawing of it:
 *
 *   THE MENU BAR   File Edit Image Layer Select Filter View Window Help - every item is a COMMAND (id, label, key,
 *                  run, enabled / checked); the same list drives the shortcuts, Help ▸ Keyboard Shortcuts and the
 *                  COMMAND PALETTE (Ctrl+K: type, Enter)
 *   THE TOOLS      Photoshop's column and keys: V, M (Shift+M cycles), L, W, C, I, J, B, S, Y, E, G, R, O, P (2.421.0: pen tools), T, A (path selection), U, H, Z;
 *                  a group shows its last tool, a right-click / a long press opens the flyout; D / X / Q (quick mask)
 *   THE PANELS     Color + Swatches; Properties (the active layer: an adjustment's settings live, a mask's density /
 *                  feather, a text / shape / fill layer's settings) + Adjustments (one click = an adjustment layer) +
 *                  ✨ AI + ◈ Control; Layers (thumbnails, masks, groups, clipping, fx, locks, labels, drag to reorder)
 *                  + History (click a step to go back to it)
 *   THE DIALOGS    New, Image Size, Canvas Size, Fill, Stroke, Select ▸ Modify, Color Range, Layer Style, Export As
 *                  (format, quality, scale, the file's size), the curve editor (Curves, in a dialog or Properties)
 *   THEMES         Pro (dark), Studio (light), Classic - Window ▸ Theme; rulers (Ctrl+R) and a grid (Ctrl+')
 *
 * The command table and the key matching are pure (tested in Node); the rest builds DOM in the editor's .kx.
 */
(function (root) {
  "use strict";

  /* ================================ tools ================================ */
  const ICON = {
    move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
    artboard: '<rect x="6" y="6" width="12" height="12"/><path d="M6 2v4M18 2v4M6 18v4M18 18v4M2 6h4M2 18h4M18 6h4M18 18h4"/>',   // 2.447.0 (pcartboards.js)
    rect: '<rect x="4" y="5" width="16" height="14" stroke-dasharray="3 2"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5" stroke-dasharray="3 2"/>',
    lasso: '<path d="M7 15c-3-2-2-9 5-9s9 3 8 6-6 4-9 3M11 15c-2 1-2 3-1 4"/>',
    poly: '<path d="M5 18L8 5l11 4-4 10z" stroke-dasharray="3 2"/>',
    wand: '<path d="M4 20L14 10M15 3v3M19 5l-2 2M21 9h-3M12 5l1 2"/>',
    objsel: '<rect x="3" y="3" width="13" height="13" stroke-dasharray="3 2"/><path d="M12 12l8 3-3.5 1.5L15 20z"/>',
    brush: '<circle cx="10" cy="10" r="6" stroke-dasharray="2 2"/><path d="M14.5 14.5L20 20"/>',
    crop: '<path d="M7 3v14h14M3 7h14v14"/>',
    picker: '<path d="M15 4l5 5-2 2-5-5zM13 8l-8 8v3h3l8-8"/>',
    spotheal: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M11 12h2M12 11v2"/>',
    heal: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><circle cx="12" cy="12" r="1.2"/>',
    paint: '<path d="M18 3l3 3-9 9-3-3zM9 12l-3 3c-2 0-3 2-3 6 4 0 6-1 6-3l3-3"/>',
    pencil: '<path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4"/>',
    clone: '<path d="M6 21h12M5 17h14v-3H5zM10 14V9a2 2 0 1 1 4 0v5"/>',
    histbrush: '<path d="M18 3l3 3-9 9-3-3zM9 12l-3 3c-2 0-3 2-3 6 4 0 6-1 6-3l3-3"/><path d="M3 4h4v4"/>',
    erase: '<path d="M3 16l8-8 7 7-4 4H7zM13 6l3-3 5 5-3 3M7 20h13"/>',
    gradient: '<rect x="4" y="4" width="16" height="16"/><path d="M4 20L20 4" stroke-dasharray="2 2"/>',
    fill: '<path d="M5 11l7-7 7 7-7 7zM19 15c0 2 1.5 3 1.5 4a1.5 1.5 0 0 1-3 0c0-1 1.5-2 1.5-4"/>',
    blurtool: '<path d="M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z"/>',
    sharpen: '<path d="M12 3l7 18H5z"/>',
    smudge: '<path d="M9 21v-8M9 13V5a2 2 0 1 1 4 0v8M13 9a2 2 0 1 1 4 0v4c0 4-2 8-6 8"/>',
    dodge: '<circle cx="15" cy="9" r="5"/><path d="M11 13l-7 8"/>',
    burn: '<path d="M7 21V11a2 2 0 1 1 4 0M11 13V6a2 2 0 1 1 4 0v7M15 13a2 2 0 1 1 4 0c0 5-3 8-7 8"/>',
    sponge: '<rect x="5" y="7" width="14" height="12" rx="3"/><circle cx="9" cy="11" r="1"/><circle cx="14" cy="14" r="1"/><circle cx="15" cy="10" r=".6"/>',
    type: '<path d="M5 5h14M12 5v15M9 20h6"/>',
    vtype: '<path d="M5 5h10M10 5v12M7 17h6"/><path d="M19 6v13M17 17l2 2 2-2"/>',
    typepath: '<path d="M3 19c4-10 14-10 18 0" stroke-dasharray="2 2"/><path d="M8 6h8M12 6v8"/>',
    shape: '<rect x="3" y="3" width="11" height="11"/><circle cx="15.5" cy="15.5" r="5.5"/>',
    // 2.421.0: pcpen.js
    pen: '<path d="M12 3l6 9-6 9-6-9z"/><circle cx="12" cy="12" r="1.6"/><path d="M12 3v7.4"/>',
    freepen: '<path d="M12 3l6 9-6 9-6-9z"/><path d="M3 21c3-2 4-1 6-3"/>',
    curvpen: '<path d="M12 3l6 9-6 9-6-9z"/><path d="M3 20c4-6 8 2 12-4"/>',
    bezier: '<path d="M4 19C6 8 18 16 20 5"/><rect x="2.5" y="17.5" width="3" height="3"/><rect x="18.5" y="3.5" width="3" height="3"/><path d="M4 19l5-9M20 5l-6 8" stroke-dasharray="1.5 1.5"/>',
    freehand: '<path d="M3 17c3-6 5 2 8-3s4-7 6-4 2 3 4 1"/>',
    line2: '<path d="M4 20L20 4"/><circle cx="4" cy="20" r="1.8"/><circle cx="20" cy="4" r="1.8"/>',
    polyline: '<path d="M3 18l5-9 5 6 4-10 4 5"/>',
    curve3: '<path d="M4 18C7 6 17 6 20 18"/><circle cx="4" cy="18" r="1.6"/><circle cx="20" cy="18" r="1.6"/><circle cx="12" cy="9" r="1.6"/>',
    bspline: '<path d="M4 18C6 10 10 6 12 6s6 4 8 12"/><path d="M4 18L8 4l8 0 4 14" stroke-dasharray="1.5 1.5"/>',
    cpen: '<path d="M5 19l4-12 6 6-12 4z"/><path d="M9 7l3-4 9 9-4 3"/><circle cx="11.5" cy="12.5" r="1.3"/>',
    shapetool: '<path d="M6 3l12 9-5 1.2 3.4 6.3-2.4 1.2-3.3-6.4L6 18z"/>',
    crect: '<rect x="3" y="6" width="18" height="12" rx="1"/>',
    crect3: '<path d="M4 15l9-9 7 7-9 9z"/><circle cx="4" cy="15" r="1.4"/><circle cx="13" cy="6" r="1.4"/>',
    cellipse: '<ellipse cx="12" cy="12" rx="9" ry="6"/>',
    cellipse3: '<ellipse cx="12" cy="12" rx="9" ry="5" transform="rotate(-30 12 12)"/><circle cx="4.5" cy="16.3" r="1.3"/><circle cx="19.5" cy="7.7" r="1.3"/>',
    cpolygon: '<path d="M12 3l8 6-3 10H7L4 9z"/>',
    cstar: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    ccstar: '<path d="M12 3L17 20 3 9h18L7 20z"/>',
    cspiral: '<path d="M12 12c0-1 1-1.5 1.7-1 1.2.8.7 2.8-.9 3.3-2.3.7-4-1.4-3.6-3.6.6-3 4.1-4.2 6.6-2.6 3.3 2 3.3 6.8.2 9.2-3.8 2.9-9.7 1.4-11.4-3.1"/>',
    cgraph: '<rect x="3" y="5" width="18" height="14"/><path d="M9 5v14M15 5v14M3 12h18"/>',
    ccommon: '<path d="M3 9h11V5l7 7-7 7v-4H3z"/>',
    cmedia: '<path d="M3 18c4-1 5-9 9-9s4 7 9 4" stroke-width="3"/>',
    cdimpar: '<path d="M4 17L17 4M7 20L20 7M5 19l14-14" /><path d="M4 17l3 3M17 4l3 3"/>',
    cdimhv: '<path d="M3 8v10M21 8v10M3 13h18"/><path d="M6 10l-3 3 3 3M18 10l3 3-3 3"/>',
    sk_select: '<path d="M5 3l12 8-5 1.5L9.5 18z"/><rect x="15" y="15" width="5" height="5" rx="0.5"/>',   // 2.462.0: the sketch tools
    sk_line: '<path d="M4 19L19 5"/><rect x="2.5" y="17.5" width="3" height="3"/><rect x="17.5" y="3.5" width="3" height="3"/>',
    sk_rect: '<rect x="4" y="6" width="16" height="12"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="18" r="1.5"/>',
    sk_rectc: '<rect x="4" y="6" width="16" height="12"/><path d="M4 6l16 12M20 6L4 18" stroke-dasharray="2 2"/>',
    sk_circle: '<circle cx="12" cy="12" r="8"/><path d="M12 12h8"/><circle cx="12" cy="12" r="1.2"/>',
    sk_arc: '<path d="M4 18a9 9 0 0 1 16 0"/><circle cx="4" cy="18" r="1.5"/><circle cx="12" cy="9.5" r="1.5"/><circle cx="20" cy="18" r="1.5"/>',
    sk_point: '<circle cx="12" cy="12" r="2.5"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
    sk_trim: '<path d="M4 12h6M14 12h6" /><path d="M12 4v16" stroke-dasharray="2 2"/><path d="M9 9l6 6M15 9l-6 6"/>',   // 2.463.0
    sk_extend: '<path d="M4 16L14 8"/><path d="M14 8l4-3.2" stroke-dasharray="2 2"/><path d="M20 3v8"/>',
    sk_fillet: '<path d="M4 20V12a8 8 0 0 1 8-8h8"/><circle cx="12" cy="12" r="1.2"/>',
    sk_chamfer: '<path d="M4 20V10l6-6h10"/><path d="M4 10l6-6" stroke-width="2.4"/>',
    sk_poly: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="1.2"/>',
    sk_slot: '<path d="M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7z"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>',
    sk_circle2: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16" stroke-dasharray="2 2"/><circle cx="4" cy="12" r="1.5"/><circle cx="20" cy="12" r="1.5"/>',
    sk_circle3: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="4" r="1.5"/><circle cx="5" cy="16" r="1.5"/><circle cx="19" cy="16" r="1.5"/>',
    sk_spline: '<path d="M3 17c4-12 8 4 12-6s4-4 6-6"/><circle cx="3" cy="17" r="1.2"/><circle cx="12" cy="11" r="1.2"/><circle cx="21" cy="5" r="1.2"/>',
    sk_measure: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',   // 2.464.0
    sk_dim: '<path d="M4 8v10M20 8v10M4 13h16"/><path d="M7 11l-3 2 3 2M17 11l3 2-3 2"/><path d="M9 6h6"/>',
    cdimchain: '<path d="M2 9v9M9 9v9M15 9v9M22 9v9M2 14h20"/><path d="M4 12.5L2 14l2 1.5M7 12.5L9 14l-2 1.5M11 12.5L9 14l2 1.5M13 12.5l2 1.5-2 1.5M17 12.5L15 14l2 1.5M20 12.5l2 1.5-2 1.5"/>',   // 2.458.0
    cdimang: '<path d="M4 20L20 20M4 20L15 6"/><path d="M12 20a8 8 0 0 0-2.4-5.7"/>',
    ccallout: '<path d="M4 20l6-8h10"/><path d="M4 20l1-4M4 20l4-1"/>',
    cconnect: '<rect x="2" y="3" width="7" height="6"/><rect x="15" y="15" width="7" height="6"/><path d="M9 6h4v12h2"/>',
    addanchor: '<path d="M10 4l5 8-5 8-5-8z"/><path d="M18 4v6M15 7h6"/>',
    delanchor: '<path d="M10 4l5 8-5 8-5-8z"/><path d="M15 7h6"/>',
    convanchor: '<path d="M4 20L12 4l8 16"/><path d="M8 12h8" stroke-dasharray="2 2"/>',
    pathsel: '<path d="M6 3l12 9-6 1 3 7-2 1-3-7-4 4z" fill="currentColor"/>',
    directsel: '<path d="M6 3l12 9-6 1 3 7-2 1-3-7-4 4z"/>',
    // 2.423.0: pcrefine.js / pcheal.js
    maglasso: '<path d="M7 15c-3-2-2-9 5-9s9 3 8 6-6 4-9 3M11 15c-2 1-2 3-1 4"/><path d="M15 15v5l2-2 2 3" />',
    qsel: '<circle cx="9" cy="9" r="5.5" stroke-dasharray="2 2"/><path d="M13 13l7 7M17 13l3 3"/>',
    patch: '<path d="M4 8c3-4 9-4 11 0s-1 8-5 8-8-4-6-8z" stroke-dasharray="2 2"/><path d="M14 14l6 6"/>',
    cmove: '<rect x="3" y="3" width="10" height="10" stroke-dasharray="2 2"/><path d="M13 13l7 7M20 15v5h-5"/>',
    redeye: '<path d="M2 12c4-6 16-6 20 0-4 6-16 6-20 0z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    mixer: '<path d="M18 3l3 3-9 9-3-3zM9 12l-3 3c-2 0-3 2-3 6 4 0 6-1 6-3l3-3"/><circle cx="19" cy="18" r="2.5"/>',
    bgerase: '<path d="M3 16l8-8 7 7-4 4H7zM13 6l3-3 5 5-3 3"/><path d="M3 21h4" stroke-dasharray="1 1"/>',
    magicerase: '<path d="M3 16l8-8 7 7-4 4H7z"/><path d="M15 3v3M19 5l-2 2M21 9h-3"/>',
    customshape: '<path d="M12 20C6 16 3 12 3 8.5 3 6 5 4 7.5 4c2 0 3.5 1 4.5 3 1-2 2.5-3 4.5-3C19 4 21 6 21 8.5c0 3.5-3 7.5-9 11.5z"/>',
    hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5a1.5 1.5 0 0 1 3 0v8c0 5-3 8-7 8-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 3-1l2 3"/>',
    zoom: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>',
  };
  const GROUPS = [
    { k: "v", tools: [["move", "Move Tool"], ["artboard", "Artboard Tool"]] },   // 2.447.0: + Artboard (pcartboards.js)
    { k: "m", tools: [["rect", "Rectangular Marquee Tool"], ["ellipse", "Elliptical Marquee Tool"]] },
    { k: "l", tools: [["lasso", "Lasso Tool"], ["poly", "Polygonal Lasso Tool"], ["maglasso", "Magnetic Lasso Tool"]] },   // 2.423.0: + Magnetic
    { k: "w", tools: [["objsel", "Object Selection Tool (Segment Anything)"], ["wand", "Magic Wand Tool"], ["brush", "Quick Selection Brush"], ["qsel", "Quick Selection Tool"]] },   // 2.423.0: + the edge-aware one
    { k: "c", tools: [["crop", "Crop Tool"]] },
    { k: "i", tools: [["picker", "Eyedropper Tool"]] },
    null,
    { k: "j", tools: [["spotheal", "Spot Healing Brush Tool"], ["heal", "Healing Brush Tool"], ["patch", "Patch Tool"], ["cmove", "Content-Aware Move Tool"], ["redeye", "Red Eye Tool"]] },   // 2.423.0
    { k: "b", tools: [["paint", "Brush Tool"], ["pencil", "Pencil Tool"], ["mixer", "Mixer Brush Tool"]] },
    { k: "s", tools: [["clone", "Clone Stamp Tool"]] },
    { k: "y", tools: [["histbrush", "History Brush Tool"]] },
    { k: "e", tools: [["erase", "Eraser Tool"], ["bgerase", "Background Eraser Tool"], ["magicerase", "Magic Eraser Tool"]] },
    { k: "g", tools: [["gradient", "Gradient Tool"]] },
    { k: "g", tools: [["fill", "Paint Bucket Tool"]] },   // 2.396.0: its own button (fills with the foreground, the background or a gradient)
    { k: "r", tools: [["blurtool", "Blur Tool"], ["sharpen", "Sharpen Tool"], ["smudge", "Smudge Tool"]] },
    { k: "o", tools: [["dodge", "Dodge Tool"], ["burn", "Burn Tool"], ["sponge", "Sponge Tool"]] },
    null,
    { k: "p", tools: [["pen", "Pen Tool"], ["freepen", "Freeform Pen Tool"], ["curvpen", "Curvature Pen Tool"], ["addanchor", "Add Anchor Point Tool"], ["delanchor", "Delete Anchor Point Tool"], ["convanchor", "Convert Point Tool"]] },   // 2.421.0: pcpen.js; 2.425.0: + Curvature Pen (pcvline.js)
    { k: "t", tools: [["type", "Horizontal Type Tool"], ["vtype", "Vertical Type Tool"], ["typepath", "Type on a Path Tool"]] },   // 2.397.0: pctext.js
    { k: "a", tools: [["pathsel", "Path Selection Tool"], ["directsel", "Direct Selection Tool"]] },   // 2.421.0
    { k: "u", tools: [["shape", "Shape Tool (rectangle, ellipse, polygon, line)"], ["customshape", "Custom Shape Tool"]] },
    // 2.425.0: CorelDRAW's keys (pcvline.js) - F5 = the curve tools (F5 again cycles), F10 = the Shape tool (nodes)
    { k: "f5", tools: [["bezier", "Bézier Tool"], ["freehand", "Freehand Tool"], ["line2", "2-Point Line Tool"], ["polyline", "Polyline Tool"], ["curve3", "3-Point Curve Tool"], ["bspline", "B-Spline Tool"], ["cpen", "Node Pen Tool"], ["cmedia", "Artistic Media Tool"]] },
    { k: "f10", tools: [["shapetool", "Shape Tool (nodes)"]] },
    // 2.428.0 (pcdraw.js): F6 = CorelDRAW's shape tools, F8 = dimensions + connectors (F-key again cycles)
    { k: "f6", tools: [["crect", "Rectangle Tool"], ["crect3", "3-Point Rectangle Tool"], ["cellipse", "Ellipse Tool"], ["cellipse3", "3-Point Ellipse Tool"], ["cpolygon", "Polygon Tool"], ["cstar", "Star Tool"], ["ccstar", "Complex Star Tool"], ["cspiral", "Spiral Tool"], ["cgraph", "Graph Paper Tool"], ["ccommon", "Common Shapes Tool"]] },
    { k: "f8", tools: [["cdimpar", "Parallel Dimension Tool"], ["cdimhv", "Horizontal / Vertical Dimension Tool"], ["cdimchain", "Chain Dimension Tool"], ["cdimang", "Angular Dimension Tool"], ["ccallout", "3-Point Callout Tool"], ["cconnect", "Connector Tool"]] },
    // 2.462.0 (pcsketchtools.js): N = the sketch tools of a sketch layer (N again = the next one; K stays the selection brush)
    { k: "n", tools: [["sk_select", "Sketch Select Tool"], ["sk_line", "Line Tool (sketch)"], ["sk_rect", "2-Point Rectangle Tool (sketch)"], ["sk_rectc", "Center Rectangle Tool (sketch)"], ["sk_circle", "Circle Tool (sketch)"], ["sk_arc", "3-Point Arc Tool (sketch)"], ["sk_point", "Point Tool (sketch)"], ["sk_dim", "Sketch Dimension Tool"], ["sk_trim", "Trim Tool (sketch)"], ["sk_extend", "Extend Tool (sketch)"], ["sk_fillet", "Fillet Tool (sketch)"], ["sk_chamfer", "Chamfer Tool (sketch)"], ["sk_poly", "Polygon Tool (sketch)"], ["sk_slot", "Slot Tool (sketch)"], ["sk_circle2", "2-Point Circle Tool (sketch)"], ["sk_circle3", "3-Point Circle Tool (sketch)"], ["sk_spline", "Spline Tool (sketch)"], ["sk_measure", "Measure Tool (sketch)"]] },   // 2.463.0: + modify / more shapes; 2.464.0: + measure
    null,
    { k: "h", tools: [["hand", "Hand Tool"]] },
    { k: "z", tools: [["zoom", "Zoom Tool"]] },
  ];
  const toolName = (id) => { for (const g of GROUPS) if (g) for (const [t, n] of g.tools) if (t === id) return n; return id === "transform" ? "Free Transform" : id; };
  const groupOf = (id) => GROUPS.find((g) => g && g.tools.some(([t]) => t === id)) || null;

  /* ================================ keys ================================ */
  const CODE_KEY = { BracketLeft: "[", BracketRight: "]", Equal: "=", Minus: "-", Slash: "/", Quote: "'", Backslash: "\\", Semicolon: ";", Comma: ",", Period: "." };
  /** an event as an accelerator: "Ctrl+Shift+N", "Alt+Ctrl+G", "Shift+F5", "Q" */
  function accelOf(e) {
    let k = e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.code && /^Digit\d$/.test(e.code) ? e.code.slice(5) : (e.code && CODE_KEY[e.code]) || null;
    if (!k) { k = e.key || ""; if (k.length === 1) k = k.toUpperCase(); if (k === "+") k = "="; }
    const parts = [];
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    parts.push(k);
    return parts.join("+");
  }
  /** "Ctrl+Shift+N" in any order -> the order accelOf writes */
  function normAccel(s) {
    const p = String(s).split("+"), k = p.pop();
    const has = (x) => p.some((q) => q.toLowerCase() === x.toLowerCase());
    return [has("Alt") && "Alt", has("Shift") && "Shift", (has("Ctrl") || has("Cmd")) && "Ctrl", k.length === 1 ? k.toUpperCase() : k].filter(Boolean).join("+");
  }

  /* ============================== the menus ============================== */
  // Filter ▸ submenu of the older filters (2.333.0 had no `sub`)
  const SUB = { gaussian: "Blur", motion: "Blur", unsharp: "Sharpen", noise: "Noise", median: "Noise", pixelate: "Pixelate", emboss: "Stylize",
                edges: "Stylize", vignette: "Render", glow: "Stylize", chromatic: "Distort", oil: "Stylize" };
  const SWATCHES = ["#000000", "#ffffff", "#808080", "#c0c0c0", "#404040", "#ff0000", "#ff8000", "#ffff00", "#80ff00", "#00ff00", "#00ff80", "#00ffff",
    "#0080ff", "#0000ff", "#8000ff", "#ff00ff", "#ff0080", "#800000", "#804000", "#808000", "#408000", "#008000", "#008040", "#008080", "#004080",
    "#000080", "#400080", "#800080", "#800040", "#ffcccc", "#ffe0cc", "#ffffcc", "#ccffcc", "#ccffff", "#cce0ff", "#e0ccff", "#ffccf0",
    "#f2d0b0", "#e0b48a", "#c68c5e", "#8d5524", "#5c3a21", "#3d2316", "#1b4f72", "#2e86c1", "#117a65", "#b9770e", "#922b21"];

  function install(E) {
    const { S, P, D, FX, doc, win, kx, $, say, store, newCanvas, ctx } = E;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const L = () => E.layer();
    const docOpen = () => !!S.w;
    const hasL = () => !!(S.w && L());
    const isPixel = () => hasL() && L().type === "pixel";

    /* ---------------- commands ---------------- */
    const CMD = new Map();
    const cmd = (id, label, key, run, more) => { CMD.set(id, Object.assign({ id, label, key: key ? normAccel(key) : "", run }, more || {})); return id; };
    const sep = "-";
    let clip = null, styleClip = null;
    // File
    cmd("file.new", "New…", "Ctrl+N", () => dlgNew());
    cmd("file.open", "Open…", "Ctrl+O", () => { $("ieFile").dataset.layer = ""; $("ieFile").click(); });
    cmd("file.place", "Place as Layer…", "Alt+Ctrl+O", () => { $("ieFile").dataset.layer = "1"; $("ieFile").click(); }, { enabled: docOpen });
    cmd("file.save", "Save to Images", "Ctrl+S", () => E.saveToImages(), { enabled: docOpen });
    cmd("file.export", "Export As…", "Alt+Shift+Ctrl+W", () => dlgExport(), { enabled: docOpen });
    cmd("file.download", "Download PNG", "", () => download("png"), { enabled: docOpen });
    // Edit
    cmd("edit.undo", "Undo", "Ctrl+Z", () => E.undo(), { enabled: () => S.undo.length > 0 });
    cmd("edit.redo", "Redo", "Shift+Ctrl+Z", () => E.redo(), { enabled: () => S.redo.length > 0 });
    cmd("edit.cut", "Cut", "Ctrl+X", () => copy(false, true), { enabled: isPixel });
    cmd("edit.copy", "Copy", "Ctrl+C", () => copy(false), { enabled: hasL });
    cmd("edit.copymerged", "Copy Merged", "Shift+Ctrl+C", () => copy(true), { enabled: docOpen });
    cmd("edit.paste", "Paste", "Ctrl+V", () => paste(false), { enabled: docOpen });
    cmd("edit.pasteinplace", "Paste in Place", "Shift+Ctrl+V", () => paste(true), { enabled: docOpen });
    cmd("edit.clear", "Clear", "", () => E.clearSelectionArea(), { enabled: () => E.hasSel() });
    cmd("edit.fill", "Fill…", "Shift+F5", () => dlgFill(), { enabled: hasL });
    cmd("edit.stroke", "Stroke…", "", () => dlgStroke(), { enabled: () => E.hasSel() });
    cmd("edit.transform", "Free Transform", "Ctrl+T", () => E.startTransform(), { enabled: () => isPixel() || (hasL() && L().type === "smart") });
    cmd("edit.rot180", "Rotate 180°", "", () => E.img.layer(180), { enabled: isPixel });
    cmd("edit.rot90", "Rotate 90° Clockwise", "", () => E.img.layer(90), { enabled: isPixel });
    cmd("edit.rot-90", "Rotate 90° Counter Clockwise", "", () => E.img.layer(-90), { enabled: isPixel });
    cmd("edit.fliph", "Flip Horizontal", "", () => E.img.layer("h"), { enabled: isPixel });
    cmd("edit.flipv", "Flip Vertical", "", () => E.img.layer("v"), { enabled: isPixel });
    cmd("edit.histsrc", "Set History Brush Source", "", () => { E.snapHistorySource(); say("the History Brush paints back to the layers as they are now"); }, { enabled: docOpen });
    // Image
    const adjIds = FX ? FX.FILTERS.filter((f) => f.group === "Adjustments").map((f) => f.id) : [];
    for (const id of adjIds) { const f = FX.byId(id); cmd("adj." + id, f.name + (f.params.length ? "…" : ""), "", () => E.openFilter(id), { enabled: hasL }); }
    cmd("image.autotone", "Auto Tone", "Shift+Ctrl+L", () => E.img.autoTone(), { enabled: hasL });
    cmd("image.autocontrast", "Auto Contrast", "Alt+Shift+Ctrl+L", () => E.img.autoContrast(), { enabled: hasL });
    cmd("image.autocolor", "Auto Color", "Shift+Ctrl+B", () => E.img.autoColor(), { enabled: hasL });
    cmd("image.size", "Image Size…", "Alt+Ctrl+I", () => dlgImageSize(), { enabled: docOpen });
    cmd("image.canvas", "Canvas Size…", "Alt+Ctrl+C", () => dlgCanvasSize(), { enabled: docOpen });
    cmd("image.rot180", "180°", "", () => E.img.rotate(180), { enabled: docOpen });
    cmd("image.rot90", "90° Clockwise", "", () => E.img.rotate(90), { enabled: docOpen });
    cmd("image.rot-90", "90° Counter Clockwise", "", () => E.img.rotate(-90), { enabled: docOpen });
    cmd("image.fliph", "Flip Canvas Horizontal", "", () => E.img.rotate("h"), { enabled: docOpen });
    cmd("image.flipv", "Flip Canvas Vertical", "", () => E.img.rotate("v"), { enabled: docOpen });
    cmd("image.crop", "Crop", "", () => E.img.cropToSelection(), { enabled: () => E.hasSel() });
    cmd("image.trim", "Trim", "", () => E.img.trim(), { enabled: docOpen });
    // Layer
    cmd("layer.new", "Layer", "Shift+Ctrl+N", () => E.newLayer(), { enabled: docOpen });
    cmd("layer.newgroup", "Group", "", () => E.newGroup(), { enabled: docOpen });
    cmd("layer.viacopy", "Layer via Copy", "Ctrl+J", () => E.layerFromSelection(false), { enabled: isPixel });
    cmd("layer.viacut", "Layer via Cut", "Shift+Ctrl+J", () => E.layerFromSelection(true), { enabled: isPixel });
    cmd("layer.dup", "Duplicate Layer", "", () => E.duplicateLayer(), { enabled: hasL });
    cmd("layer.del", "Delete Layer", "Shift+Delete", () => E.deleteLayer(), { enabled: hasL });   // 2.438.0: Shift+Del (Tim)
    cmd("layer.style", "Blending Options…", "", () => dlgStyle(), { enabled: () => hasL() && L().type !== "adjust" });
    for (const [k, n] of D.STYLE_KINDS) cmd("style." + k, n + "…", "", () => dlgStyle(k), { enabled: () => hasL() && L().type !== "adjust" });
    cmd("style.copy", "Copy Layer Style", "", () => { styleClip = D.clone(L().styles); say("layer style copied"); }, { enabled: () => hasL() && D.hasStyles(L()) });
    cmd("style.paste", "Paste Layer Style", "", () => E.setLayer(L(), "paste layer style", (x) => { x.styles = D.clone(styleClip); }), { enabled: () => hasL() && !!styleClip });
    cmd("style.clear", "Clear Layer Style", "", () => E.setLayer(L(), "clear layer style", (x) => { x.styles = null; }), { enabled: () => hasL() && !!L().styles });
    cmd("fill.solid", "Solid Color…", "", () => E.newFill("solid"), { enabled: docOpen });
    cmd("fill.gradient", "Gradient…", "", () => E.newFill("gradient"), { enabled: docOpen });
    for (const [id, n] of D.ADJ_KINDS) cmd("adjl." + id, n + "…", "", () => E.newAdjust(id), { enabled: docOpen });
    cmd("mask.reveal", "Reveal All", "", () => E.addMask("reveal"), { enabled: () => hasL() && !L().mask });
    cmd("mask.hide", "Hide All", "", () => E.addMask("hide"), { enabled: () => hasL() && !L().mask });
    cmd("mask.sel", "Reveal Selection", "", () => E.addMask("selection"), { enabled: () => hasL() && E.hasSel() });
    cmd("mask.hidesel", "Hide Selection", "", () => E.addMask("hideSelection"), { enabled: () => hasL() && E.hasSel() });
    cmd("mask.delete", "Delete", "", () => E.deleteMask(false), { enabled: () => hasL() && !!L().mask });
    cmd("mask.apply", "Apply", "", () => E.deleteMask(true), { enabled: () => isPixel() && !!L().mask });
    cmd("mask.toggle", "Disable / Enable", "", () => E.toggleMask(), { enabled: () => hasL() && !!L().mask });
    cmd("mask.link", "Link / Unlink", "", () => E.setLayer(L(), "link mask", (x) => { x.mask.linked = x.mask.linked === false; }), { enabled: () => hasL() && !!L().mask });
    cmd("layer.clip", "Create / Release Clipping Mask", "Alt+Ctrl+G", () => E.toggleClip(), { enabled: hasL, checked: () => hasL() && !!L().clip });
    cmd("layer.group", "Group Layers", "Ctrl+G", () => E.groupActive(), { enabled: hasL });
    cmd("layer.ungroup", "Ungroup Layers", "Shift+Ctrl+G", () => E.ungroupActive(), { enabled: () => hasL() && L().type === "group" });
    cmd("layer.front", "Bring to Front", "Shift+Ctrl+]", () => E.moveLayerEnd(1), { enabled: hasL });
    cmd("layer.forward", "Bring Forward", "Ctrl+]", () => E.moveLayer(1), { enabled: hasL });
    cmd("layer.backward", "Send Backward", "Ctrl+[", () => E.moveLayer(-1), { enabled: hasL });
    cmd("layer.back", "Send to Back", "Shift+Ctrl+[", () => E.moveLayerEnd(-1), { enabled: hasL });
    cmd("layer.lock", "Lock All", "Ctrl+/", () => E.structOp("lock", () => { const x = L(); x.locks = Object.assign({}, x.locks || {}, { all: !(x.locks && x.locks.all) }); }), { enabled: hasL, checked: () => hasL() && !!(L().locks && L().locks.all) });
    cmd("layer.rasterize", "Layer", "", () => E.rasterizeLayer(false), { enabled: () => hasL() && /^(text|shape|fill|smart)$/.test(L().type) });
    // 2.604.0 (Tim: "add a rightclick context menu with rasterize text"): the canvas's right-click menu on a text layer
    cmd("layer.rasterizetext", "Rasterize Text", "", () => { if (E.endText) E.endText(); E.rasterizeLayer(false); }, { enabled: () => hasL() && L().type === "text" });
    cmd("layer.rasterizestyle", "Layer Style", "", () => E.rasterizeLayer(true), { enabled: () => hasL() && D.hasStyles(L()) });
    cmd("layer.mergedown", "Merge Down", "Ctrl+E", () => E.mergeDown(), { enabled: hasL });
    cmd("layer.mergevisible", "Merge Visible", "Shift+Ctrl+E", () => E.mergeVisible(false), { enabled: docOpen });
    cmd("layer.flatten", "Flatten Image", "", () => E.mergeVisible(true), { enabled: docOpen });
    // Select
    cmd("sel.all", "All", "Ctrl+A", () => E.selectAll(), { enabled: docOpen });
    cmd("sel.none", "Deselect", "Ctrl+D", () => E.deselect(), { enabled: docOpen });
    cmd("sel.none2", "Deselect (Krita)", "Shift+Ctrl+A", () => E.deselect(), { enabled: docOpen, hidden: true });
    cmd("sel.reselect", "Reselect", "Shift+Ctrl+D", () => E.reselect(), { enabled: () => !!S.lastSel });
    cmd("sel.inverse", "Inverse", "Shift+Ctrl+I", () => E.selectInverse(), { enabled: docOpen });
    cmd("sel.range", "Color Range…", "", () => dlgColorRange(), { enabled: docOpen });
    for (const [k, n, key] of [["border", "Border…"], ["smooth", "Smooth…"], ["expand", "Expand…"], ["contract", "Contract…"], ["feather", "Feather…", "Shift+F6"]])
      cmd("sel." + k, n, key || "", () => dlgModify(k, n.replace("…", "")), { enabled: () => E.hasSel() });
    cmd("sel.loadlayer", "Load Layer Transparency", "", () => E.selectFrom(L(), false), { enabled: hasL });
    cmd("sel.loadmask", "Load Layer Mask", "", () => E.selectFrom(L(), true), { enabled: () => hasL() && !!L().mask });
    cmd("sel.qm", "Edit in Quick Mask Mode", "Q", () => E.quickMask(), { enabled: docOpen, checked: () => !!S.qm });
    // Filter
    cmd("filter.last", "Last Filter", "Ctrl+F", () => E.repeatFilter(), { enabled: hasL });
    const fltIds = FX ? FX.FILTERS.filter((f) => f.group === "Filters").map((f) => f.id) : [];
    for (const id of fltIds) { const f = FX.byId(id); cmd("flt." + id, f.name + (f.params.length ? "…" : ""), "", () => E.openFilter(id), { enabled: hasL }); }
    // View
    cmd("view.zoomin", "Zoom In", "Ctrl+=", () => E.zoomAt(1.25), { enabled: docOpen });
    cmd("view.zoomout", "Zoom Out", "Ctrl+-", () => E.zoomAt(0.8), { enabled: docOpen });
    cmd("view.fit", "Fit on Screen", "Ctrl+0", () => { S.userView = false; E.fitView(); }, { enabled: docOpen });
    cmd("view.100", "100%", "Ctrl+1", () => E.zoomAt(1 / S.zoom), { enabled: docOpen });
    cmd("view.rulers", "Rulers", "Ctrl+R", () => { kx.classList.toggle("rulers"); store.set("rulers", kx.classList.contains("rulers")); rulers(); }, { checked: () => kx.classList.contains("rulers") });
    cmd("view.grid", "Grid", "Ctrl+'", () => { S.grid = !S.grid; store.set("grid", S.grid); E.drawOverlay(); }, { checked: () => !!S.grid });
    cmd("view.full", "Full Screen Mode", "F", () => E.toggleFull());
    // 2.391.0: the mask overlay (red where the mask hides) - always while a brush paints a mask; this keeps it on
    cmd("view.maskov", "Mask Overlay", "\\", () => { S.maskOverlay = !S.maskOverlay; store.set("maskov", S.maskOverlay); E.renderLayers();
      say(S.maskOverlay ? "mask overlay ON - red shows what the mask hides while the mask is selected (\\ turns it off)" : "mask overlay only while painting a mask (\\ keeps it on)"); }, { checked: () => !!S.maskOverlay });
    // Window
    const TABS = [["pcColor", "Color"], ["pcSwatches", "Swatches"], ["pcChar", "Character"], ["pcPara", "Paragraph"], ["pcProps", "Properties"], ["pcAdjs", "Adjustments"], ["kxAi", "✨ AI"], ["kxCtl", "◈ Control Layers"], ["pcLayers", "Layers"], ["pcPaths", "Paths"], ["pcChannels", "Channels"], ["pcHistory", "History"], ["pcActions", "Actions"], ["pcComps", "Layer Comps"]];
    for (const [id, n] of TABS) cmd("win." + id, n, id === "pcLayers" ? "F7" : "", () => showTab(id));
    cmd("win.tools", "Tools", "", () => { kx.classList.toggle("tools-off"); }, { checked: () => !kx.classList.contains("tools-off") });
    cmd("win.options", "Options", "", () => { kx.classList.toggle("opts-off"); }, { checked: () => !kx.classList.contains("opts-off") });
    cmd("win.panels", "Show / Hide Panels", "Tab", () => $("kxPanel").click());
    for (const [t, n] of [["bitgen", "bitGen (dark)"], ["pro", "Pro (dark)"], ["studio", "Studio (light)"], ["classic", "Classic"]]) cmd("theme." + t, n, "", () => { kx.dataset.theme = t; store.set("theme", t); }, { checked: () => kx.dataset.theme === t });
    cmd("win.reset", "Reset Workspace", "", () => { kx.classList.remove("tools-off", "opts-off", "side-off"); kx.querySelectorAll(".pcgrp").forEach((g) => g.classList.remove("off")); showTab("pcColor"); showTab("pcProps"); showTab("pcLayers"); });
    // Help
    cmd("help.keys", "Keyboard Shortcuts…", "", () => dlgShortcuts());
    cmd("help.guide", "Image Editor Help…", "F1", () => { if (root.H3Help) root.H3Help.open("imageeditor"); else say("the help pages are not loaded"); });   // 2.421.0: static/help/imageeditor.html
    cmd("help.palette", "Command Palette…", "Ctrl+K", () => palette());
    cmd("help.about", "About the Editor", "", () => say("bitGen's image editor - layers, masks, adjustments, styles, type, vector shapes and lines, with ✨ AI fill, edit and control layers"));

    const sub = (label, items) => ({ label, items });
    const filterMenu = () => {
      const subs = {};
      for (const id of fltIds) { const f = FX.byId(id), s = f.sub || SUB[id] || "Other"; (subs[s] = subs[s] || []).push("flt." + id); }
      return ["filter.last", sep].concat(Object.keys(subs).sort().map((s) => sub(s, subs[s])));
    };
    const MENUS = [
      ["File", ["file.new", "file.open", "file.place", sep, "file.save", "file.export", "file.download"]],
      ["Edit", ["edit.undo", "edit.redo", sep, "edit.cut", "edit.copy", "edit.copymerged", "edit.paste", "edit.pasteinplace", "edit.clear", sep, "edit.fill", "edit.stroke", sep,
        "edit.transform", sub("Transform", ["edit.rot180", "edit.rot90", "edit.rot-90", sep, "edit.fliph", "edit.flipv"]), sep, "edit.histsrc"]],
      ["Image", [sub("Adjustments", adjIds.map((id) => "adj." + id)), sep, "image.autotone", "image.autocontrast", "image.autocolor", sep, "image.size", "image.canvas",
        sub("Image Rotation", ["image.rot180", "image.rot90", "image.rot-90", sep, "image.fliph", "image.flipv"]), "image.crop", "image.trim"]],
      ["Layer", [sub("New", ["layer.new", "layer.newgroup", sep, "layer.viacopy", "layer.viacut"]), "layer.dup", "layer.del", sep,
        sub("Layer Style", ["layer.style", sep, ...D.STYLE_KINDS.map(([k]) => "style." + k), sep, "style.copy", "style.paste", "style.clear"]),
        sub("New Fill Layer", ["fill.solid", "fill.gradient"]), sub("New Adjustment Layer", D.ADJ_KINDS.map(([id]) => "adjl." + id)), sep,
        sub("Layer Mask", ["mask.reveal", "mask.hide", "mask.sel", "mask.hidesel", sep, "mask.delete", "mask.apply", "mask.toggle", "mask.link"]), "layer.clip", sep,
        "layer.group", "layer.ungroup", sub("Arrange", ["layer.front", "layer.forward", "layer.backward", "layer.back"]), "layer.lock", sep,
        sub("Rasterize", ["layer.rasterize", "layer.rasterizestyle"]), sep, "layer.mergedown", "layer.mergevisible", "layer.flatten"]],
      ["Select", ["sel.all", "sel.none", "sel.reselect", "sel.inverse", sep, "sel.range", sep, sub("Modify", ["sel.border", "sel.smooth", "sel.expand", "sel.contract", "sel.feather"]), sep,
        "sel.loadlayer", "sel.loadmask", sep, "sel.qm"]],
      ["Filter", filterMenu()],
      ["View", ["view.zoomin", "view.zoomout", "view.fit", "view.100", sep, "view.rulers", "view.grid", "view.maskov", sep, "view.full"]],
      ["Window", [...TABS.map(([id]) => "win." + id), sep, "win.tools", "win.options", "win.panels", sep, sub("Theme", ["theme.bitgen", "theme.pro", "theme.studio", "theme.classic"]), "win.reset"]],
      ["Help", ["help.guide", "help.keys", "help.palette", "help.about"]],
    ];
    const KEYMAP = new Map();
    for (const c of CMD.values()) if (c.key) KEYMAP.set(c.key, c.id);
    KEYMAP.set("Ctrl+Y", "edit.redo"); KEYMAP.set(normAccel("Shift+Ctrl+="), "view.zoomin");
    function run(id) {
      const c = CMD.get(id); if (!c) return false;
      if (c.enabled && !c.enabled()) { say(`${c.label.replace("…", "")}: ${docOpen() ? "not available for this layer / selection" : "open a picture first"}`); return true; }
      closeMenus();
      if (E.ui.onRun) { try { E.ui.onRun(id); } catch (e) { /* the recorder */ } }      // 2.427.0: Actions record it (pcactions.js)
      try { c.run(); } catch (e) { say(`${c.label}: ${e.message}`); }
      if (E.ui.onRunDone) { try { E.ui.onRunDone(id); } catch (e) { /* the recorder */ } }
      return true;
    }
    E.ui.run = run; E.ui.CMD = CMD; E.ui.MENUS = MENUS;
    /** 2.390.0: a command from another file (pcsam.js, pcpsd.js) - in the table, the shortcuts and the palette; `where`
     *  = [menu name, the item it goes after (or null = the end)] */
    E.ui.addCmd = (id, label, key, fn, more, where) => {
      cmd(id, label, key, fn, more);
      const c = CMD.get(id); if (c.key) KEYMAP.set(c.key, id);
      if (where) {
        const m = MENUS.find(([n]) => n === where[0]); if (!m) return id;
        const items = m[1], at = where[1] ? items.indexOf(where[1]) : -1;
        if (at >= 0) items.splice(at + 1, 0, ...(where[2] ? [sep, id] : [id])); else items.push(...(where[2] ? [sep, id] : [id]));
      }
      return id;
    };
    E.ui.sep = sep;

    /* ---------------- the menu bar ---------------- */
    const bar = $("pcMenus");
    let openMenus = [];
    function closeMenus() { openMenus.forEach((m) => m.remove()); openMenus = []; bar.querySelectorAll(".mi.open").forEach((m) => m.classList.remove("open")); }
    E.ui.closeMenus = closeMenus;
    function menuAt(items, x, y, depth) {
      while (openMenus.length > depth) openMenus.pop().remove();
      const m = doc.createElement("div"); m.className = "kxmenu"; m.dataset.depth = depth;
      for (const it of items) {
        if (it === sep) { m.appendChild(doc.createElement("hr")); continue; }
        const d = doc.createElement("div");
        if (typeof it === "object") {
          d.className = "sub"; d.textContent = it.label;
          d.onmouseenter = d.onclick = () => { m.querySelectorAll(".open").forEach((o) => o.classList.remove("open")); d.classList.add("open"); const r = d.getBoundingClientRect(), kr = kx.getBoundingClientRect(); menuAt(it.items, r.right - kr.left - 2, r.top - kr.top - 4, depth + 1); };
        } else {
          const c = CMD.get(it); if (!c || c.hidden) continue;
          const dis = c.enabled && !c.enabled();
          d.className = (dis ? "dis" : "") + (c.checked && c.checked() ? " chk" : ""); d.dataset.cmd = c.id;
          d.innerHTML = `<span>${esc(c.label)}</span>${c.key ? `<span class="k">${esc(c.key)}</span>` : ""}`;
          d.onmouseenter = () => { while (openMenus.length > depth + 1) openMenus.pop().remove(); m.querySelectorAll(".open").forEach((o) => o.classList.remove("open")); };
          d.onclick = () => run(c.id);
        }
        m.appendChild(d);
      }
      m.style.left = x + "px"; m.style.top = y + "px";
      kx.appendChild(m); openMenus.push(m);
      const kr = kx.getBoundingClientRect(), r = m.getBoundingClientRect();
      if (r.right > kr.right) m.style.left = Math.max(0, x - (r.right - kr.right) - 4) + "px";
      if (r.bottom > kr.bottom) m.style.top = Math.max(0, y - (r.bottom - kr.bottom) - 4) + "px";
      return m;
    }
    E.ui.menuAt = menuAt;
    for (const [name, items] of MENUS) {
      const mi = doc.createElement("span"); mi.className = "mi"; mi.textContent = name; mi.dataset.menu = name; mi.id = "pcMenu" + name;
      const open = () => { closeMenus(); mi.classList.add("open"); const r = mi.getBoundingClientRect(), kr = kx.getBoundingClientRect(); menuAt(items, r.left - kr.left, r.bottom - kr.top, 0); };
      mi.onclick = (e) => { e.stopPropagation(); if (mi.classList.contains("open")) closeMenus(); else open(); };
      mi.onmouseenter = () => { if (openMenus.length && !mi.classList.contains("open")) open(); };
      bar.appendChild(mi);
    }
    // 2.333.0's 🎚 Adjust / ✦ Filter ids live on as the Image / Filter menus
    $("pcMenuImage").id = "kxAdj"; $("pcMenuFilter").id = "kxFlt";
    doc.addEventListener("pointerdown", (e) => { if (openMenus.length && !openMenus.some((m) => m.contains(e.target)) && !bar.contains(e.target)) closeMenus(); });

    /* ---------------- the tool column ---------------- */
    const toolsBox = $("kxTools"), swatch = toolsBox.querySelector(".kxsw");
    const cur = store.get("groups", {});
    const svg = (id) => `<svg viewBox="0 0 24 24">${ICON[id] || ""}</svg>`;
    let fly = null;
    function closeFly() { if (fly) { fly.remove(); fly = null; } }
    GROUPS.forEach((g, gi) => {
      if (!g) { const gap = doc.createElement("div"); gap.className = "gap"; toolsBox.insertBefore(gap, swatch); return; }
      const t = cur[g.k] && g.tools.some(([x]) => x === cur[g.k]) ? cur[g.k] : g.tools[0][0];
      const b = doc.createElement("button");
      b.className = "ghost ietool" + (g.tools.length > 1 ? " grp" : ""); b.dataset.tool = t; b.dataset.tools = g.tools.map(([x]) => x).join(","); b.dataset.group = g.k;
      const fk = /^f\d+$/.test(g.k);     // 2.425.0: an F key - pressing it again cycles (Shift+F5 stays Fill…)
      const paint = (id) => { b.dataset.tool = id; b.innerHTML = svg(id); b.title = `${toolName(id)} (${g.k.toUpperCase()}${g.tools.length > 1 ? (fk ? ", " + g.k.toUpperCase() + " again cycles" : ", Shift+" + g.k.toUpperCase() + " cycles") + "; right-click for the others" : ""})`; };
      paint(t);
      b.onclick = () => { closeFly(); E.setTool(b.dataset.tool); };
      const openFly = () => {
        closeFly(); fly = doc.createElement("div"); fly.className = "pcfly";
        for (const [id, n] of g.tools) {
          const d = doc.createElement("div"); d.className = id === S.tool ? "on" : ""; d.innerHTML = `${svg(id).replace("<svg", '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.6"')}<span>${esc(n)}</span><span class="k">${g.k.toUpperCase()}</span>`;
          d.onclick = () => { cur[g.k] = id; store.set("groups", cur); paint(id); closeFly(); E.setTool(id); };
          fly.appendChild(d);
        }
        const r = b.getBoundingClientRect(), kr = kx.getBoundingClientRect();
        fly.style.left = (r.right - kr.left + 2) + "px"; fly.style.top = (r.top - kr.top) + "px"; kx.appendChild(fly);
      };
      b.oncontextmenu = (e) => { e.preventDefault(); if (g.tools.length > 1) openFly(); };
      let hold = null;
      b.onpointerdown = () => { if (g.tools.length > 1) hold = setTimeout(openFly, 380); };
      b.onpointerup = b.onpointerleave = () => clearTimeout(hold);
      g.paint = paint;
      toolsBox.insertBefore(b, swatch);
    });
    const qmBtn = doc.createElement("button"); qmBtn.className = "ghost qm"; qmBtn.id = "pcQm"; qmBtn.textContent = "◘"; qmBtn.title = "Edit in Quick Mask mode (Q)";
    qmBtn.onclick = () => E.quickMask(); toolsBox.appendChild(qmBtn);
    E.ui.qm = (on) => qmBtn.classList.toggle("on", on);
    doc.addEventListener("pointerdown", (e) => { if (fly && !fly.contains(e.target)) closeFly(); });
    E.ui.toolName = (id) => {
      const g = groupOf(id); if (g && g.paint && id !== "transform") { cur[g.k] = id; store.set("groups", cur); g.paint(id); }
      const n = $("pcToolName"); if (n) n.innerHTML = (ICON[id] ? `<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.6">${ICON[id]}</svg>` : "") + esc((groupOf(id) ? toolName(id) : (E.tools[id] && E.tools[id].name) || toolName(id)).replace(/ Tool$/, ""));
    };
    function toolKey(k, shift) {
      // 2.396.0: a key may name several buttons (G = Gradient + Paint Bucket) - Shift cycles through all of them
      const gs = GROUPS.filter((x) => x && x.k === k); if (!gs.length) return false;
      const g = { tools: [].concat(...gs.map((x) => x.tools)) };
      const ids = g.tools.map(([x]) => x), now = ids.indexOf(S.tool);
      const t = shift && now >= 0 ? ids[(now + 1) % ids.length] : now >= 0 ? S.tool : (cur[k] && ids.includes(cur[k]) ? cur[k] : ids[0]);
      E.setTool(t); return true;
    }

    /* ---------------- keys (the editor has focus) ---------------- */
    E.ui.key = (e) => {
      if (e.key === "Escape" && (openMenus.length || fly)) { closeMenus(); closeFly(); return true; }
      const a = accelOf(e);
      if (KEYMAP.has(a) && (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || a === "Shift+F5" || a === "Shift+F6" || a === "Shift+Delete")) return run(KEYMAP.get(a));   // 2.438.0: + Shift+Del
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const k = (e.key || "").toLowerCase();
      if ((k === "f5" || k === "f6" || k === "f8" || k === "f10") && !e.shiftKey) return toolKey(k, true);   // 2.428.0: + F6 / F8     // 2.425.0: CorelDRAW's F5 (curve tools, again = the next) / F10 (Shape tool)
      if (k === "tab") { if (e.shiftKey) { kx.querySelectorAll(".pcgrp").forEach((g) => g.classList.toggle("off")); } else $("kxPanel").click(); return true; }
      if (k === "q") { E.quickMask(); return true; }
      if (k === "\\") return run("view.maskov");                     // 2.391.0: Photoshop's \ - the mask as a red overlay
      if (k === "x") { if (E.swapColors) E.swapColors(); else { const f = S.fg; E.setFg(S.bg); E.setBg(f); } return true; }   // 2.396.0: + a plain Background
      if (k === "d") { E.setFg("#000000"); E.setBg("#ffffff"); return true; }
      if (k === "f") { E.toggleFull(); return true; }
      if (k === "k") { E.setTool("brush"); return true; }             // 2.332.0's selection-brush key still works
      if (/^[0-9]$/.test(k) && ["paint", "erase", "pencil", "clone", "heal", "histbrush"].includes(S.tool)) {
        S.opacity = (k === "0" ? 100 : +k * 10) / 100; E.renderOptions(); say(`opacity ${Math.round(S.opacity * 100)}%`); return true;
      }
      if (k === "0" && !e.shiftKey) { S.userView = false; E.fitView(); return true; }
      if (k === "+" || k === "=") { E.zoomAt(1.25); return true; }
      if (k === "-") { E.zoomAt(0.8); return true; }
      if (k.length === 1 && /[a-z]/.test(k) && toolKey(k, e.shiftKey)) return true;
      return false;
    };

    /* ---------------- panels: tabs ---------------- */
    function showTab(id) {
      const b = kx.querySelector(`.pctabs [data-tab="${id}"]`); if (!b) return;
      const grp = b.closest(".pcgrp"); grp.classList.remove("off"); kx.classList.remove("side-off");
      grp.querySelectorAll(".pctabs button").forEach((x) => x.classList.toggle("on", x === b));
      grp.querySelectorAll(".pcbody").forEach((x) => x.classList.toggle("on", x.dataset.body === id));
      store.set("tab." + grp.dataset.g, id);
      if (id === "pcHistory") history();
      if (id === "pcProps") props();
      if (id === "pcPaths" && E.ui.paths) E.ui.paths();     // 2.421.0: pcpen.js
      if (id === "pcChannels" && E.ui.channels) E.ui.channels();   // 2.423.0: pcrefine.js
      if (id === "pcChar" && E.ui.character) E.ui.character();     // 2.426.0: pctype.js
      if (id === "pcPara" && E.ui.paragraph) E.ui.paragraph();
      if (id === "pcActions" && E.ui.actions) E.ui.actions();
      if (id === "pcComps" && E.ui.comps) E.ui.comps();            // 2.434.0: pccomps.js       // 2.427.0: pcactions.js
      if (/^dk/.test(id) && E.ui.dockers) E.ui.dockers();           // 2.429.0: pcdockers.js
    }
    E.ui.showTab = showTab;
    kx.querySelectorAll(".pctabs button").forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
    for (const g of ["color", "props", "layers"]) { const t = store.get("tab." + g, null); if (t && kx.querySelector(`.pctabs [data-tab="${t}"]`)) showTab(t); }

    /* ---------------- Color + Swatches ---------------- */
    let colTarget = "fg";
    const hexRgb = (h) => E.B.hexRgb(h);
    const rgbHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
    function rgbHsb(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [Math.round(h), Math.round(mx ? d / mx * 100 : 0), Math.round(mx * 100)]; }
    function hsbRgb(h, s, v) { s /= 100; v /= 100; const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
    function color() {
      const box = $("pcColor"); if (!box) return;
      const hex = colTarget === "fg" ? S.fg : S.bg, [r, g, b] = hexRgb(hex), [h, s, v] = rgbHsb(r, g, b);
      const row = (id, label, max, val, bg) => `<div class="kxrow" style="margin:2px 0"><span style="width:12px">${label}</span><input type="range" id="${id}" min="0" max="${max}" value="${val}" style="flex:1;background:${bg}"><input type="number" id="${id}N" min="0" max="${max}" value="${val}" style="width:46px"></div>`;
      box.innerHTML = `<div class="kxrow"><button class="ghost" id="pcCFg" title="Edit the foreground colour" style="width:30px;height:30px;background:${S.fg};${colTarget === "fg" ? "outline:2px solid var(--pc-accent)" : ""}"></button>
        <button class="ghost" id="pcCSwap" title="Swap the foreground and background colours (X) - a plain Background takes the new background colour" style="width:22px;height:30px;padding:0">⇄</button>
        <button class="ghost" id="pcCBg" title="Edit the background colour" style="width:30px;height:30px;background:${S.bg};${colTarget === "bg" ? "outline:2px solid var(--pc-accent)" : ""}"></button>
        <input type="text" id="pcCHex" value="${hex}" style="width:76px" title="Hex"><canvas id="pcCSpec" width="150" height="30" style="flex:1;height:30px;cursor:crosshair;border:1px solid var(--pc-line)" title="Click a colour"></canvas></div>`
        + row("pcCH", "H", 360, h, "") + row("pcCS", "S", 100, s, "") + row("pcCB", "B", 100, v, "") + row("pcCR", "R", 255, r, "") + row("pcCG", "G", 255, g, "") + row("pcCBl", "B", 255, b, "");
      const sp = $("pcCSpec"), sg = ctx(sp);
      if (sg) { const gr = sg.createLinearGradient(0, 0, 150, 0); ["#f00", "#ff0", "#0f0", "#0ff", "#00f", "#f0f", "#f00"].forEach((c, i) => gr.addColorStop(i / 6, c)); sg.fillStyle = gr; sg.fillRect(0, 0, 150, 30);
        const v2 = sg.createLinearGradient(0, 0, 0, 30); v2.addColorStop(0, "rgba(255,255,255,0)"); v2.addColorStop(0.5, "rgba(255,255,255,0)"); v2.addColorStop(1, "rgba(0,0,0,1)"); sg.fillStyle = v2; sg.fillRect(0, 0, 150, 30); }
      const set = (hx) => { if (colTarget === "fg") E.setFg(hx); else E.setBg(hx); };
      sp.onclick = (e) => { const r2 = sp.getBoundingClientRect(), d = sg.getImageData(Math.floor((e.clientX - r2.left) * 150 / r2.width), Math.floor((e.clientY - r2.top) * 30 / r2.height), 1, 1).data; set(rgbHex(d[0], d[1], d[2])); };
      $("pcCFg").onclick = () => { colTarget = "fg"; color(); }; $("pcCBg").onclick = () => { colTarget = "bg"; color(); };
      $("pcCSwap").onclick = () => { if (E.swapColors) E.swapColors(); else { const f = S.fg; E.setFg(S.bg); E.setBg(f); } };   // 2.396.0
      $("pcCHex").onchange = () => { const v2 = $("pcCHex").value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v2)) set(v2[0] === "#" ? v2 : "#" + v2); };
      const hook = (id, f) => { const r2 = $(id), n = $(id + "N"); r2.oninput = () => { n.value = r2.value; f(); }; n.onchange = () => { r2.value = n.value; f(); }; };
      const fromHsb = () => set(rgbHex(...hsbRgb(+$("pcCH").value % 360, +$("pcCS").value, +$("pcCB").value)));
      const fromRgb = () => set(rgbHex(+$("pcCR").value, +$("pcCG").value, +$("pcCBl").value));
      hook("pcCH", fromHsb); hook("pcCS", fromHsb); hook("pcCB", fromHsb); hook("pcCR", fromRgb); hook("pcCG", fromRgb); hook("pcCBl", fromRgb);
    }
    let colorT = null;
    E.ui.color = () => { clearTimeout(colorT); colorT = setTimeout(() => { const a = doc.activeElement; if (a && $("pcColor").contains(a) && a.type === "range") return; color(); }, 30); };
    function swatches() {
      const box = $("pcSwatches"), mine = store.get("swatches", []);
      box.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,18px);gap:3px">${SWATCHES.concat(mine).map((c, i) => `<button class="ghost pcsw" data-c="${c}" data-mine="${i >= SWATCHES.length ? i - SWATCHES.length : ""}" title="${c}${i >= SWATCHES.length ? " (yours - right-click removes)" : ""} - click = foreground, Alt-click = background" style="width:18px;height:18px;min-height:0;padding:0;background:${c}"></button>`).join("")}</div>
        <div class="kxrow" style="margin-top:6px"><button class="ghost" id="pcSwAdd" title="Add the foreground colour">＋ Add foreground</button></div>`;
      box.querySelectorAll(".pcsw").forEach((b) => {
        b.onclick = (e) => (e.altKey ? E.setBg(b.dataset.c) : E.setFg(b.dataset.c));
        b.oncontextmenu = (e) => { e.preventDefault(); if (b.dataset.mine === "") return; const m = store.get("swatches", []); m.splice(+b.dataset.mine, 1); store.set("swatches", m); swatches(); };
      });
      $("pcSwAdd").onclick = () => { const m = store.get("swatches", []); if (!m.includes(S.fg)) m.push(S.fg); store.set("swatches", m.slice(-60)); swatches(); };
    }
    color(); swatches();

    /* ---------------- Adjustments panel ---------------- */
    $("pcAdjs").innerHTML = `<div style="color:var(--pc-dim);margin-bottom:6px">Add an adjustment layer (it changes everything below it - the pixels stay as they are; its mask limits it):</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px">${D.ADJ_KINDS.map(([id, n, ic]) => `<button class="ghost pcadj" data-adj="${id}" title="${n}" style="height:30px;font-size:15px">${ic}</button>`).join("")}</div>
      <div class="kxrow" style="margin-top:8px"><button class="ghost" id="pcAdjSolid">＋ Solid colour fill</button><button class="ghost" id="pcAdjGrad">＋ Gradient fill</button></div>`;
    $("pcAdjs").querySelectorAll(".pcadj").forEach((b) => { b.onclick = () => E.newAdjust(b.dataset.adj); });
    $("pcAdjSolid").onclick = () => E.newFill("solid"); $("pcAdjGrad").onclick = () => E.newFill("gradient");
    $("kxLAdjBtn").onclick = (e) => {
      e.stopPropagation();
      const r = $("kxLAdjBtn").getBoundingClientRect(), kr = kx.getBoundingClientRect();
      menuAt(["fill.solid", "fill.gradient", sep, ...D.ADJ_KINDS.map(([id]) => "adjl." + id)], r.left - kr.left - 160, r.top - kr.top - 300, 0);
    };
    $("kxLFx").onclick = (e) => {
      e.stopPropagation();
      const r = $("kxLFx").getBoundingClientRect(), kr = kx.getBoundingClientRect();
      menuAt(["layer.style", sep, ...D.STYLE_KINDS.map(([k]) => "style." + k)], r.left - kr.left - 160, r.top - kr.top - 220, 0);
    };

    /* ---------------- Layers panel ---------------- */
    const thumbFor = (src, w, h) => { const c = newCanvas(36, 26), g = ctx(c); if (g && S.w) { const k = Math.min(36 / S.w, 26 / S.h); g.drawImage(src, (36 - S.w * k) / 2, (26 - S.h * k) / 2, S.w * k, S.h * k); } return c; };
    const TYPE_ICON = { group: "🗀", adjust: "◐", text: "T", shape: "◆", fill: "■", smart: "▣", sketch: "📐" };
    let dragId = null;
    /* 2.390.0: the PICKED layers (Ctrl-click) - their order is the pictures' order */
    E.togglePick = (Ly) => {
      S.picks = (S.picks || []).filter((id) => S.layers.some((x) => x.id === id));
      const at = S.picks.indexOf(Ly.id);
      if (at >= 0) S.picks.splice(at, 1); else S.picks.push(Ly.id);
      layers();
      say(S.picks.length ? `picked ${S.picks.length}: ` + S.picks.map((id, k) => `${k + 1} = ${(S.layers.find((x) => x.id === id) || {}).name}`).join(", ") + " - ✨ Compose / Layer ▸ Send to References use them" : "no layers picked");
    };
    E.picked = () => { S.picks = (S.picks || []).filter((id) => S.layers.some((x) => x.id === id)); return S.picks.map((id) => S.layers.find((x) => x.id === id)); };
    E.clearPicks = () => { S.picks = []; layers(); };
    function layers() {
      const box = $("kxLayers"); box.innerHTML = "";
      S.picks = (S.picks || []).filter((id) => S.layers.some((x) => x.id === id));
      const A = L();
      const byId = new Map(S.layers.map((x) => [x.id, x]));
      const hiddenByGroup = (x) => { let p = x.parent; while (p != null) { const g = byId.get(p); if (!g) return false; if (g.open === false) return true; p = g.parent; } return false; };
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const Ly = S.layers[i];
        if (hiddenByGroup(Ly)) continue;
        const row = doc.createElement("div"); row.className = "kxlayer" + (i === S.active ? " on" : ""); row.dataset.i = i; row.draggable = true;
        const dep = D.depth(S.layers, Ly);
        const lb = doc.createElement("span"); lb.className = "lb"; lb.style.background = D.LABEL_HEX[Ly.label] || "transparent";
        const eye = doc.createElement("button"); eye.className = "eye"; eye.textContent = Ly.visible ? "👁" : "·"; eye.title = "Show / hide (Alt-click: show only this one)";
        row.append(lb, eye);
        const ind = doc.createElement("span"); ind.style.width = (dep * 12) + "px"; ind.style.flex = "none"; row.appendChild(ind);
        if (Ly.type === "group" || (Ly.frame && S.layers.some((x) => x.parent === Ly.id))) { const tw = doc.createElement("button"); tw.className = "tw"; tw.textContent = Ly.open === false ? "▸" : "▾"; tw.title = Ly.type === "group" ? "Open / close the group" : "Open / close the frame (what is inside it)"; tw.onclick = (e) => { e.stopPropagation(); Ly.open = Ly.open === false; layers(); }; row.appendChild(tw); }
        if (Ly.clip) { const c = doc.createElement("span"); c.className = "clip"; c.textContent = "↳"; c.title = "Clipped to the layer below"; row.appendChild(c); }
        let th;
        if (Ly.type === "pixel" || Ly.type === "text" || Ly.type === "shape" || Ly.type === "fill" || Ly.type === "smart") { th = thumbFor(Ly.canvas); if (Ly.type === "text") th.title = "Text layer"; if (Ly.type === "smart") { th.classList.add("so"); th.title = "Smart object - double-click: Edit Contents"; } }
        else { th = doc.createElement("span"); th.className = "ic"; th.textContent = Ly.type === "adjust" ? ((D.ADJ_KINDS.find((k) => k[0] === (Ly.adj || {}).kind) || [0, 0, "◐"])[2]) : TYPE_ICON[Ly.type] || "?"; }
        if (i === S.active && !S.maskEdit && !S.fmaskEdit && !(Ly.mask && (Ly.type === "adjust" || Ly.type === "fill"))) th.classList.add("sel");
        th.title = (th.title || "") + " - Ctrl-click: load its transparency as the selection; double-click: layer style";
        row.appendChild(th);
        if (Ly.mask) {
          const mk = thumbFor(Ly.mask.canvas); mk.classList.add("mk"); if (Ly.mask.on === false) mk.classList.add("off");
          if (i === S.active && (S.maskEdit || Ly.type === "adjust" || Ly.type === "fill")) mk.classList.add("sel");
          mk.title = "Layer mask - click to paint on it (white shows, black hides); Alt-click views it; Shift-click disables it; Ctrl-click loads it as the selection";
          mk.onclick = (e) => {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) return E.selectFrom(Ly, true);
            if (e.shiftKey) { E.setActive(i, true); return E.toggleMask(); }
            if (e.altKey) { E.setActive(i, true); S.viewMask = !S.viewMask; E.renderLayers(); return; }
            E.setActive(i, true);
          };
          row.appendChild(mk);
        }
        if (Ly.vmask && E.ui.vmaskThumb) row.appendChild(E.ui.vmaskThumb(Ly, i));   // 2.421.0: the vector mask (pcpen.js)
        const nm = doc.createElement("span"); nm.className = "nm"; nm.textContent = (Ly.control ? "◈ " : "") + Ly.name;
        nm.title = Ly.name + (Ly.control ? " — a CONTROL layer (guides the ✨ AI, never part of the picture)" : "") + " — double-click to rename";
        if (!Ly.visible || !D.shown(S.layers, Ly)) nm.style.opacity = ".55";
        row.appendChild(nm);
        if (D.hasStyles(Ly)) { const fx = doc.createElement("span"); fx.className = "fx"; fx.textContent = "fx"; fx.title = "Layer styles - double-click to edit"; fx.ondblclick = (e) => { e.stopPropagation(); E.setActive(i); dlgStyle(); }; row.appendChild(fx); }
        if (Ly.locks && Object.values(Ly.locks).some(Boolean)) { const lk = doc.createElement("span"); lk.className = "lk"; lk.textContent = "🔒"; row.appendChild(lk); }
        eye.onclick = (e) => {
          e.stopPropagation();
          if (e.altKey) { E.structOp("show only this layer", () => { const solo = S.layers.every((x) => x === Ly || !x.visible || x.control); S.layers.forEach((x) => { if (x !== Ly && !x.control && x.type !== "group") x.visible = solo; }); Ly.visible = true; }); return; }
          E.structOp("visibility", () => { Ly.visible = !Ly.visible; });
        };
        // 2.390.0: Ctrl-click a layer's row = PICK it (in order: Picture 1, 2, 3 for ✨ Compose / → References)
        const pk = (S.picks || []).indexOf(Ly.id);
        if (pk >= 0) { row.classList.add("pick"); const bd = doc.createElement("span"); bd.className = "pkb"; bd.textContent = String(pk + 1); bd.title = `Picture ${pk + 1} (Ctrl-click to un-pick)`; row.appendChild(bd); }
        row.onclick = (e) => {
          if (e.target === th && (e.ctrlKey || e.metaKey)) return E.selectFrom(Ly, false);
          // 2.474.0 (Tim): Ctrl-click adds / takes away, Shift-click = every layer between, a plain click = this one only
          if ((e.ctrlKey || e.metaKey) && E.multi) { E.multi.toggle(Ly); S.pickAnchor = Ly.id; return; }
          if (e.ctrlKey || e.metaKey) { E.togglePick(Ly); return; }
          if (e.shiftKey && E.multi) {
            const order = [...box.querySelectorAll(".kxlayer[data-i]")].map((r) => (S.layers[+r.dataset.i] || {}).id).filter((x) => x != null);
            const from = S.pickAnchor != null && S.layers.some((x) => x.id === S.pickAnchor) ? S.pickAnchor : (L() || Ly).id;
            const P = root.PCMultiSel; E.multi.set(P ? P.rangeIds(order, from, Ly.id) : [Ly.id], Ly.id); return;
          }
          S.pickAnchor = Ly.id; if (S.picks && S.picks.length) S.picks = [];
          S.objSel = true; E.setActive(i, false);
        };
        th.ondblclick = (e) => { e.stopPropagation(); E.setActive(i); if (Ly.type === "smart" && E.smartEdit) return E.smartEdit(Ly); if (Ly.type === "adjust" || Ly.type === "fill") showTab("pcProps"); else dlgStyle(); };
        nm.ondblclick = (e) => {
          e.stopPropagation();
          const inp = doc.createElement("input"); inp.type = "text"; inp.value = Ly.name; inp.style.width = "100%";
          nm.replaceWith(inp); inp.focus(); inp.select();
          const done = (ok) => { if (ok && inp.value.trim() && inp.value !== Ly.name) E.structOp("rename", () => { Ly.name = inp.value.trim().slice(0, 60); }); else layers(); };
          inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === "Enter") done(true); if (ev.key === "Escape") done(false); };
          inp.onblur = () => done(true);
        };
        row.oncontextmenu = (e) => {
          e.preventDefault(); E.setActive(i);
          const kr = kx.getBoundingClientRect();
          menuAt(["layer.dup", "layer.del", sep, "layer.style", "style.copy", "style.paste", "style.clear", sep, "mask.reveal", "mask.sel", "mask.delete", "mask.apply", sep,
            "layer.clip", "layer.group", "layer.ungroup", sep, "layer.rasterize", "layer.mergedown", "layer.mergevisible", "layer.flatten", sep,
            ...(E.ui.layerCtxItems || []).filter((x) => x === sep || CMD.has(x)), ...((E.ui.layerCtxItems || []).length ? [sep] : []),   // 2.437.0: modules' items (pcgenfill.js)
            { label: "Color label", items: D.LABELS.map((lab) => { const id = "label." + lab; if (!CMD.has(id)) cmd(id, lab[0].toUpperCase() + lab.slice(1), "", () => E.structOp("colour label", () => { L().label = lab; }), { enabled: hasL }); return id; }) }],
          e.clientX - kr.left, e.clientY - kr.top, 0);
        };
        row.ondragstart = (e) => { dragId = Ly.id; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "layer"); } catch (er) { /* fine */ } };
        row.ondragover = (e) => {
          if (dragId == null) return; e.preventDefault();
          const r = row.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
          row.classList.remove("drop-top", "drop-bottom", "drop-in");
          const into = Ly.type === "group" || (E.frames && E.frames.isClosedShape(Ly));   // 2.442.0: onto a closed shape = into it (a frame)
          row.classList.add(into && y > 0.3 && y < 0.7 ? "drop-in" : y < 0.5 ? "drop-top" : "drop-bottom");
        };
        row.ondragleave = () => row.classList.remove("drop-top", "drop-bottom", "drop-in");
        row.ondrop = (e) => {
          e.preventDefault();
          const where = row.classList.contains("drop-in") ? "in" : row.classList.contains("drop-top") ? "top" : "bottom";
          row.classList.remove("drop-top", "drop-bottom", "drop-in");
          if (dragId != null) E.dropLayer(dragId, Ly.id, where);
          dragId = null;
        };
        row.ondragend = () => { dragId = null; };
        box.appendChild(row);
        if (E.ui.layerExtra) E.ui.layerExtra(Ly, i, row, box);   // 2.422.0: a smart object's Smart Filters rows (pcsmart.js)
      }
      // the active layer's blend / opacity / fill / locks
      if (A) {
        const sel = $("kxBlend");
        const hasPass = !!sel.querySelector('option[value="pass-through"]');
        if (A.type === "group" && !hasPass) { const o = doc.createElement("option"); o.value = "pass-through"; o.textContent = "Pass Through"; sel.insertBefore(o, sel.firstChild); }
        if (A.type !== "group" && hasPass) sel.querySelector('option[value="pass-through"]').remove();
        sel.value = A.blend || "normal"; sel.disabled = A.type === "adjust" && false;
        const op = Math.round((A.opacity == null ? 1 : A.opacity) * 100);
        $("kxLOpacity").value = op; $("kxLOpacityN").value = op; $("kxLOpacityV").textContent = op + "%";
        $("pcFill").value = Math.round((A.fillOpacity == null ? 1 : A.fillOpacity) * 100);
        kx.querySelectorAll("#pcLocks [data-lock]").forEach((b) => b.classList.toggle("on", !!(A.locks && A.locks[b.dataset.lock])));
      }
      props(); history(); if (E.ui.typePanels) E.ui.typePanels(); if (E.ui.dockers) E.ui.dockers();   // 2.426.0: the Character / Paragraph panels follow the active layer
    }
    E.ui.layers = layers;

    /* ---------------- Properties ---------------- */
    let propsFor = null;
    function histogram(canvas) {
      const g = ctx(canvas); if (!g || !S.w) return;
      const d = ctx(E.flatten()).getImageData(0, 0, S.w, S.h).data, hst = new Float64Array(256);
      const step = Math.max(1, Math.floor(S.w * S.h / 400000));
      for (let i = 0; i < d.length; i += 4 * step) if (d[i + 3]) hst[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
      const mx = Math.max(...hst) || 1; g.clearRect(0, 0, canvas.width, canvas.height); g.fillStyle = "rgba(160,160,160,.75)";
      for (let i = 0; i < 256; i++) { const h = Math.sqrt(hst[i] / mx) * canvas.height; g.fillRect(i * canvas.width / 256, canvas.height - h, Math.ceil(canvas.width / 256), h); }
    }
    function maskProps(A) {
      if (!A.mask) return `<div class="kxrow" style="margin-top:8px"><button class="ghost" id="ppAddMask">◫ Add a layer mask</button></div>`;
      const m = A.mask;
      return `<div style="margin-top:8px;border-top:1px solid var(--pc-sep);padding-top:6px"><b>◫ Mask</b>${S.maskEdit || A.type === "adjust" || A.type === "fill" ? ' <span style="color:var(--pc-accent)">(painting on it)</span>' : ""}
        <div class="kxrow"><span style="width:60px">Density</span><input type="range" id="ppDens" min="0" max="100" value="${Math.round((m.density == null ? 1 : m.density) * 100)}" style="flex:1"><span id="ppDensV">${Math.round((m.density == null ? 1 : m.density) * 100)}%</span></div>
        <div class="kxrow"><span style="width:60px">Feather</span><input type="range" id="ppFeath" min="0" max="250" value="${m.feather || 0}" style="flex:1"><span id="ppFeathV">${m.feather || 0}px</span></div>
        <div class="kxrow"><button class="ghost" id="ppMInv" title="Invert the mask">Invert</button><button class="ghost" id="ppMSel" title="Load it as the selection">Select</button>
          <button class="ghost" id="ppMOn">${m.on === false ? "Enable" : "Disable"}</button><button class="ghost" id="ppMLink">${m.linked === false ? "🔗 Link" : "⛓ Unlink"}</button>
          ${A.type === "pixel" ? '<button class="ghost" id="ppMApply" title="Bake it into the pixels">Apply</button>' : ""}<button class="ghost" id="ppMDel">Delete</button></div></div>`;
    }
    function bindMask(A) {
      const am = $("ppAddMask"); if (am) { am.onclick = () => E.addMask(); return; }
      const m = A.mask; if (!m) return;
      const live = (id, v, f) => { const r = $(id); r.oninput = () => { E.liveSet(A, () => f(+r.value)); m.ver++; $(id + "V").textContent = r.value + v; }; r.onchange = () => E.commitLive("mask settings"); };
      live("ppDens", "%", (v) => { m.density = v / 100; }); live("ppFeath", "px", (v) => { m.feather = v; });
      $("ppMInv").onclick = () => E.pxOp("invert mask", (c, g) => { const id = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < id.data.length; i += 4) { id.data[i] = 255 - id.data[i]; id.data[i + 1] = 255 - id.data[i + 1]; id.data[i + 2] = 255 - id.data[i + 2]; } g.putImageData(id, 0, 0); }) || (S.maskEdit = true);
      $("ppMSel").onclick = () => E.selectFrom(A, true);
      $("ppMOn").onclick = () => E.toggleMask();
      $("ppMLink").onclick = () => run("mask.link");
      const ap = $("ppMApply"); if (ap) ap.onclick = () => E.deleteMask(true);
      $("ppMDel").onclick = () => E.deleteMask(false);
    }
    function props() {
      const box = $("pcProps"); if (!box || !box.classList.contains("on")) return;
      const A = L();
      if (!A) { box.innerHTML = `<div style="color:var(--pc-dim)">No properties - open a picture.</div>`; propsFor = null; return; }
      if (propsFor === A && box.contains(doc.activeElement) && doc.activeElement.tagName !== "BUTTON") return;   // typing / dragging in it
      propsFor = A;
      let h = `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><b>${esc(A.type === "adjust" ? (FX.byId(A.adj.kind) || {}).name || "Adjustment" : A.type === "pixel" ? "Pixel layer" : A.type === "smart" ? "Smart object" : A.type[0].toUpperCase() + A.type.slice(1) + " layer")}</b><span style="color:var(--pc-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(A.name)}</span></div>`;
      if (A.type === "adjust") {
        const f = FX.byId(A.adj.kind);
        if (/^(levels|curves)$/.test(A.adj.kind)) h += `<canvas id="ppHist" width="256" height="60" style="width:100%;height:60px;background:var(--pc-input);border:1px solid var(--pc-line)"></canvas>`;
        h += `<div id="ppParams">${f.params.map((q) => E.paramHtml(q, A.adj.params[q.id])).join("")}</div>`;
        h += `<div class="kxrow" style="margin-top:6px"><button class="ghost" id="ppClip" title="Only change the layer below it (Alt+Ctrl+G)">${A.clip ? "↳ Clipped" : "↳ Clip to the layer below"}</button><button class="ghost" id="ppReset">Reset</button></div>`;
      } else if (A.type === "fill") {
        const F = A.fill || {};
        h += `<div class="kxrow"><select id="ppFKind"><option value="solid"${F.kind !== "gradient" ? " selected" : ""}>Solid colour</option><option value="gradient"${F.kind === "gradient" ? " selected" : ""}>Gradient</option>${root.PCPattern ? `<option value="pattern"${F.kind === "pattern" ? " selected" : ""}>Pattern</option>` : ""}</select></div>`
          + (F.kind === "gradient" ? `<div class="kxrow"><input type="color" id="ppFC1" value="${F.c1}"> → <input type="color" id="ppFC2" value="${F.c2}"><select id="ppFStyle"><option${F.style !== "radial" ? " selected" : ""}>linear</option><option${F.style === "radial" ? " selected" : ""}>radial</option></select>
            <span>∠</span><input type="number" id="ppFAng" value="${F.angle == null ? 90 : F.angle}" style="width:52px"></div>`
            + (root.PCGrad ? `<div class="kxrow"><button type="button" class="ptgbtn" id="ppFEdit" title="The Gradient Editor: many stops, each with its opacity" style="width:120px;background:${root.PCGrad.toCss(Array.isArray(F.stops) && F.stops.length > 1 ? { stops: F.stops } : root.PCGrad.fromTwo(F.c1, F.c2))}"></button><span style="color:var(--pc-dim)">${Array.isArray(F.stops) && F.stops.length > 2 ? F.stops.length + " stops" : ""} - click: Edit…</span></div>` : "")
            : F.kind === "pattern" ? (() => { const ns = root.PCPattern ? root.PCPattern.names() : [], cur = F.pattern || ""; const all = ns.includes(cur) || !cur ? ns : [cur].concat(ns);   // 2.437.0: a pattern from the library (pcpattern.js)
              return `<div class="kxrow"><select id="ppFPat" style="flex:1">${all.map((n) => `<option value="${esc(n)}"${n === cur ? " selected" : ""}>${esc(n)}${ns.includes(n) ? "" : " (not in this library)"}</option>`).join("")}</select><button type="button" class="ghost" id="ppFPLib" title="The pattern library">▦…</button></div>
              <div class="kxrow"><span>Scale %</span><input type="number" id="ppFPS" value="${F.scale == null ? 100 : F.scale}" min="1" max="1000" style="width:60px"><span>offset</span><input type="number" id="ppFPX" value="${F.ox || 0}" style="width:52px"><input type="number" id="ppFPY" value="${F.oy || 0}" style="width:52px"></div>`; })()
            : `<div class="kxrow"><input type="color" id="ppFCol" value="${F.color || "#808080"}"></div>`);
      } else if (A.type === "text") {
        const t = A.text;
        h += `<textarea id="ppTStr" style="width:100%;min-height:50px">${esc(t.str)}</textarea>
          <div class="kxrow"><select id="ppTFont">${Object.keys(D.FONT_STACK).map((f) => `<option${f === t.font ? " selected" : ""}>${f}</option>`).join("")}</select><input type="number" id="ppTSize" min="4" max="1000" value="${Math.round(t.size)}" title="Size (px)"><input type="color" id="ppTCol" value="${t.color}"></div>
          <div class="kxrow"><span>X</span><input type="number" id="ppTX" value="${Math.round(t.x)}"><span>Y</span><input type="number" id="ppTY" value="${Math.round(t.y)}"><span style="color:var(--pc-dim)">T tool: click the text to type in it</span></div>
          <div class="kxrow"><button class="ghost" id="ppTShape" title="Warp, round a circle, along a path, 3D">⌒ Shape / 3D…</button><button class="ghost" id="ppTStyle" title="Bevel, overlays, Gold / Chrome / Neon…">fx Layer Style…</button></div>
          ${root.H3TextFx ? `<div class="kxrow" id="ppTFxRow"><span title="Text effect presets - from PSD text effects (＋ imports your own), live as you type">Preset</span></div>` : ""}`;
      } else if (A.type === "shape") {
        const s = A.shape;
        h += `<div class="kxrow"><span>X</span><input type="number" id="ppSX" value="${Math.round(s.x)}"><span>Y</span><input type="number" id="ppSY" value="${Math.round(s.y)}"><span>W</span><input type="number" id="ppSW" value="${Math.round(s.w)}"><span>H</span><input type="number" id="ppSH" value="${Math.round(s.h)}"></div>
          <div class="kxrow"><label><input type="checkbox" id="ppSFOn" ${s.fillOn !== false ? "checked" : ""}> Fill</label><input type="color" id="ppSF" value="${s.fill}"><label><input type="checkbox" id="ppSSOn" ${s.strokeOn ? "checked" : ""}> Stroke</label><input type="color" id="ppSS" value="${s.stroke}"><input type="number" id="ppSSW" min="0" max="200" value="${s.strokeW}" title="Stroke width"></div>
          ${s.kind === "path" ? `<div style="color:var(--pc-dim)">A path shape (${root.PCPath ? root.PCPath.count(s.path) : "?"} anchors) - edit it with the Pen (P) / Direct Selection (A)</div>`
            : `<div class="kxrow"><span>Corner radius</span><input type="number" id="ppSR" min="0" value="${s.radius || 0}"><span>Sides</span><input type="number" id="ppSN" min="3" max="64" value="${s.sides || 5}"></div>`}`;
      } else if (A.type === "smart" && E.ui.smartProps) {
        h += E.ui.smartProps(A);                                    // 2.422.0: pcsmart.js
      } else if (A.type === "group") {
        h += `<div style="color:var(--pc-dim)">${D.descendants(S.layers, A.id).length} layer(s). Blend mode Pass Through lets its adjustment layers change what is under the group too.</div>`;
      } else {
        const b = S.w ? E.alphaBox(A.canvas) : null;
        h += `<div style="color:var(--pc-dim)">${b ? `content ${b.w} × ${b.h} at ${b.x}, ${b.y}` : "empty"}${A.control ? " · a ◈ control layer" : ""}</div><div class="kxrow"><button class="ghost" id="ppStyle">fx Layer Style…</button><button class="ghost" id="ppTransform">Free Transform (Ctrl+T)</button></div>`;
      }
      if (A.type !== "group" || A.mask) h += maskProps(A);
      if (E.ui.vmaskProps) h += E.ui.vmaskProps(A);             // 2.421.0: the vector mask (pcpen.js)
      box.innerHTML = h;
      // wiring
      const q = (id) => $(id);
      if (A.type === "adjust") {
        const f = FX.byId(A.adj.kind), work = D.clone(A.adj.params);
        E.bindParams(q("ppParams"), f, work, (done) => { E.liveSet(A, (x) => { x.adj.params = D.clone(work); }); if (done) E.commitLive(f.name + " settings"); });
        if (q("ppHist")) histogram(q("ppHist"));
        q("ppClip").onclick = () => E.toggleClip();
        q("ppReset").onclick = () => E.setLayer(A, "reset " + f.name, (x) => { x.adj.params = FX.defaults(f); });
      } else if (A.type === "fill") {
        const set = (label, f) => E.setLayer(A, label, (x) => f(x.fill));
        q("ppFKind").onchange = (e) => set("fill kind", (F) => { if (e.target.value === "gradient") Object.assign(F, { kind: "gradient", c1: F.c1 || S.fg, c2: F.c2 || S.bg, angle: F.angle == null ? 90 : F.angle, style: F.style || "linear" }); else if (e.target.value === "pattern") { const ns = root.PCPattern ? root.PCPattern.names() : []; if (!ns.length && !F.pattern) { say("the pattern library is empty - Edit ▸ Define Pattern… first"); return; } Object.assign(F, { kind: "pattern", pattern: F.pattern || ns[0], scale: F.scale || 100 }); } else Object.assign(F, { kind: "solid", color: F.color || S.fg }); });
        if (q("ppFPat")) {                                   // 2.437.0: the pattern, its scale and offset
          q("ppFPat").onchange = (e) => set("pattern", (F) => { F.pattern = e.target.value; });
          q("ppFPS").onchange = (e) => set("pattern scale", (F) => { F.scale = Math.max(1, Math.min(1000, +e.target.value || 100)); });
          q("ppFPX").onchange = (e) => set("pattern offset", (F) => { F.ox = +e.target.value || 0; });
          q("ppFPY").onchange = (e) => set("pattern offset", (F) => { F.oy = +e.target.value || 0; });
          q("ppFPLib").onclick = () => { if (E.patterns) E.patterns.libraryDialog(); };
        }
        if (q("ppFCol")) q("ppFCol").onchange = (e) => set("fill colour", (F) => { F.color = e.target.value; });
        // 2.434.0: Edit… = the Gradient Editor (its stops resolved to colours; c1 / c2 = the ends, for the older readers)
        if (q("ppFEdit")) q("ppFEdit").onclick = () => { const F0 = A.fill, G = root.PCGrad; E.gradEdit(Array.isArray(F0.stops) && F0.stops.length > 1 ? { name: "Fill", stops: F0.stops } : G.fromTwo(F0.c1, F0.c2), (g) => { const r = G.resolve(g, S.fg, S.bg); set("gradient", (F) => { F.stops = r.stops; F.c1 = r.stops[0].c; F.c2 = r.stops[r.stops.length - 1].c; }); }, { title: "Gradient Editor - " + A.name }); };
        if (q("ppFC1")) { q("ppFC1").onchange = (e) => set("gradient", (F) => { F.c1 = e.target.value; delete F.stops; }); q("ppFC2").onchange = (e) => set("gradient", (F) => { F.c2 = e.target.value; delete F.stops; }); q("ppFStyle").onchange = (e) => set("gradient style", (F) => { F.style = e.target.value; }); q("ppFAng").onchange = (e) => set("gradient angle", (F) => { F.angle = +e.target.value || 0; }); }
      } else if (A.type === "text") {
        const t = A.text;
        q("ppTStr").oninput = () => E.liveSet(A, (x) => { if (x.text.runs && win.PCRuns) x.text.runs = win.PCRuns.shiftRuns(x.text.runs, String(x.text.str || ""), q("ppTStr").value); x.text.str = q("ppTStr").value; });   // 2.449.0
        q("ppTStr").onchange = () => E.commitLive("edit text");
        q("ppTStr").onkeydown = (e) => e.stopPropagation();
        const set = (label, f) => E.setLayer(A, label, (x) => f(x.text));
        q("ppTFont").onchange = (e) => set("font", (x) => { x.font = e.target.value; });
        q("ppTSize").onchange = (e) => set("text size", (x) => { x.size = Math.max(4, +e.target.value || t.size); });
        q("ppTCol").onchange = (e) => set("text colour", (x) => { x.color = e.target.value; });
        q("ppTX").onchange = (e) => set("move text", (x) => { x.x = +e.target.value || 0; });
        q("ppTY").onchange = (e) => set("move text", (x) => { x.y = +e.target.value || 0; });
        if (q("ppTShape")) q("ppTShape").onclick = () => { if (E.textShapeDialog) E.textShapeDialog(); };   // 2.397.0
        if (q("ppTStyle")) q("ppTStyle").onclick = () => dlgStyle();
        // 2.411.0: the text effect preset of this text layer (static/textfx.js)
        if (q("ppTFxRow") && root.H3TextFx) q("ppTFxRow").appendChild(root.H3TextFx.picker({ current: t.fx || "", say: (m) => say(m),
          onPick: (id) => set("text effect preset", (x) => { if (id) x.fx = id; else delete x.fx; }) }));
      } else if (A.type === "shape") {
        const set = (label, f) => E.setLayer(A, label, (x) => f(x.shape));
        for (const [id, k] of [["ppSX", "x"], ["ppSY", "y"], ["ppSW", "w"], ["ppSH", "h"], ["ppSSW", "strokeW"], ["ppSR", "radius"], ["ppSN", "sides"]]) if (q(id)) q(id).onchange = (e) => set("shape " + k, (s) => { s[k] = +e.target.value || 0; if (k === "strokeW") s.strokeOn = s[k] > 0; });
        q("ppSF").onchange = (e) => set("shape fill", (s) => { s.fill = e.target.value; });
        q("ppSS").onchange = (e) => set("shape stroke", (s) => { s.stroke = e.target.value; });
        q("ppSFOn").onchange = (e) => set("shape fill", (s) => { s.fillOn = e.target.checked; });
        q("ppSSOn").onchange = (e) => set("shape stroke", (s) => { s.strokeOn = e.target.checked; if (s.strokeOn && !s.strokeW) s.strokeW = 3; });
      } else if (A.type === "smart" && E.ui.bindSmartProps) {
        E.ui.bindSmartProps(A);
      } else if (A.type === "pixel") {
        const st = q("ppStyle"); if (st) st.onclick = () => dlgStyle();
        const tf = q("ppTransform"); if (tf) tf.onclick = () => E.startTransform();
      }
      if (A.type !== "group" || A.mask) bindMask(A);
      if (E.ui.bindVmask) E.ui.bindVmask(A);
      for (const f of E.ui.propsExtra || []) { try { f(A, box); } catch (e) { /* a module's row */ } }   // 2.437.0: modules' rows (pcgenfill.js)
      box.querySelectorAll("input,textarea,select").forEach((el) => el.addEventListener("keydown", (e) => e.stopPropagation()));
    }
    E.ui.props = props;

    /* ---------------- History ---------------- */
    function history() {
      const box = $("pcHistory"); if (!box || !box.classList.contains("on")) return;
      const n = S.undo.length;
      const rows = [`<div class="kxlayer${n === 0 ? " on" : ""}" data-h="0">◳ ${esc(S.name || "Open")}</div>`]
        .concat(S.undo.map((e, i) => `<div class="kxlayer${i + 1 === n ? " on" : ""}" data-h="${i + 1}">${esc(e.label || e.t)}</div>`))
        .concat(S.redo.slice().reverse().map((e, i) => `<div class="kxlayer" data-h="${n + i + 1}" style="opacity:.45">${esc(e.label || e.t)}</div>`));
      box.innerHTML = `<div class="kxlayers" style="max-height:420px">${rows.join("")}</div><div style="color:var(--pc-dim);margin-top:4px">Click a step to go back (or forward) to it. ${S.undo.length} step(s), the last 80 are kept.</div>`;
      box.querySelectorAll("[data-h]").forEach((r) => { r.onclick = () => E.historyTo(+r.dataset.h); });
      const list = box.querySelector(".kxlayers"); list.scrollTop = list.scrollHeight;
    }
    E.ui.history = history;

    /* ---------------- dialogs ---------------- */
    function dialog(title, html, onOk, opts) {
      kx.querySelectorAll(".kxdlg.pcd").forEach((d) => d.remove());
      const o = opts || {}, d = doc.createElement("div"); d.className = "kxdlg pcd" + (o.wide ? " wide" : "");
      d.innerHTML = `<h4>${esc(title)}</h4><div class="pcdb" style="padding:0 10px">${html}</div><div class="bt">${o.extra || ""}<button class="ghost cn">Cancel</button><button class="ghost ok">${esc(o.okLabel || "OK")}</button></div>`;
      kx.appendChild(d); dragDialog(d);
      const close = () => d.remove();
      d.querySelector(".cn").onclick = () => { if (E.ui.onDialogCancel) E.ui.onDialogCancel(d, title); if (o.cancel) o.cancel(); close(); };
      d.querySelector(".ok").onclick = () => { if (E.ui.onDialogOk) E.ui.onDialogOk(d, title); if (onOk(d) !== false) close(); };   // 2.427.0: Actions keep the dialog's values
      d.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") d.querySelector(".ok").click(); if (e.key === "Escape") d.querySelector(".cn").click(); });
      if (o.init) o.init(d);
      const first = d.querySelector("input,select"); if (first) setTimeout(() => first.focus(), 0);
      if (E.ui.onDialog) { try { E.ui.onDialog(d, title); } catch (e) { /* the player */ } }   // 2.427.0: Actions fill / OK it when played
      return d;
    }
    function dragDialog(d) {
      const h = d.querySelector("h4"); if (!h) return;
      h.onpointerdown = (e) => {
        // 2.438.0: the dialogs open in the middle of the SCREEN (position: fixed - static/dlglayout.js keeps where they are left)
        const fixed = win.getComputedStyle(d).position === "fixed", kr = fixed ? { left: 0, top: 0 } : kx.getBoundingClientRect(), r = d.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
        const mv = (ev) => { d.style.right = "auto"; d.style.transform = "none"; d.style.left = Math.max(0, ev.clientX - kr.left - ox) + "px"; d.style.top = Math.max(0, ev.clientY - kr.top - oy) + "px"; };
        const upf = () => { win.removeEventListener("pointermove", mv); win.removeEventListener("pointerup", upf); };
        win.addEventListener("pointermove", mv); win.addEventListener("pointerup", upf);
      };
    }
    E.ui.dragDialog = dragDialog; E.ui.dialog = dialog;
    const val = (d, sel) => d.querySelector(sel).value;
    function dlgNew() {
      const pre = [["Custom", 0, 0], ["1920 × 1080 (HD)", 1920, 1080], ["1280 × 720", 1280, 720], ["3840 × 2160 (4K)", 3840, 2160], ["1080 × 1080 (square)", 1080, 1080], ["1080 × 1920 (story)", 1080, 1920], ["A4 300 ppi", 2480, 3508], ["1024 × 1024", 1024, 1024]];
      dialog("New Document", `<div class="rw"><span>Preset</span><select id="pdPre" style="grid-column:1/3">${pre.map(([n, w, h], i) => `<option value="${i}">${n}</option>`).join("")}</select></div>
        <div class="rw"><span>Width (px)</span><input type="number" id="pdW" value="${S.w || 1920}" min="1" max="16384"></div><div class="rw"><span>Height (px)</span><input type="number" id="pdH" value="${S.h || 1080}" min="1" max="16384"></div>
        <div class="rw"><span style="grid-column:1/3">Background</span><span style="grid-column:1/3;display:flex;gap:6px;align-items:center"><select id="pdBg" style="flex:1;min-width:0"><option value="bg" selected>Background colour</option><option value="white">White</option><option value="black">Black</option><option value="none">Transparent</option></select><span id="pdBgSw" title="The background colour (the tool column's back swatch)" style="flex:none;display:inline-block;width:22px;height:18px;border:1px solid #000;box-shadow:0 0 0 1px #9a917f;background:${S.bg}"></span></span></div>`,
      (d) => {
        const w = Math.max(1, Math.min(16384, +val(d, "#pdW") || 1920)), h = Math.max(1, Math.min(16384, +val(d, "#pdH") || 1080)), bg = val(d, "#pdBg");
        E.openDoc(w, h, "Untitled-" + w + "x" + h, (g) => { if (bg !== "none") { g.fillStyle = bg === "white" ? "#fff" : bg === "black" ? "#000" : S.bg; g.fillRect(0, 0, w, h); } });
      }, { init: (d) => { d.querySelector("#pdPre").onchange = (e) => { const p = pre[+e.target.value]; if (p[1]) { d.querySelector("#pdW").value = p[1]; d.querySelector("#pdH").value = p[2]; } };
        // 2.396.0 (Tim: "when new make the background the color in the background select"): the swatch beside it follows the choice
        const sel = d.querySelector("#pdBg"), sw = d.querySelector("#pdBgSw");
        sel.onchange = () => { const v = sel.value; sw.style.background = v === "white" ? "#fff" : v === "black" ? "#000" : v === "bg" ? S.bg : "repeating-conic-gradient(#888 0 25%, #ccc 0 50%) 0 0/8px 8px"; }; } });
    }
    function dlgImageSize() {
      dialog("Image Size", `<div class="rw"><span>Width (px)</span><input type="number" id="pdW" value="${S.w}" min="1" max="16384"></div><div class="rw"><span>Height (px)</span><input type="number" id="pdH" value="${S.h}" min="1" max="16384"></div>
        <div class="rw"><span>Percent</span><input type="number" id="pdPct" value="100" min="1" max="1000"></div><div class="rw"><label><input type="checkbox" id="pdLock" checked> Constrain proportions</label></div>`,
      (d) => { E.img.size(+val(d, "#pdW"), +val(d, "#pdH")); },
      { init(d) {
        const W = d.querySelector("#pdW"), H = d.querySelector("#pdH"), K = d.querySelector("#pdLock"), pct = d.querySelector("#pdPct");
        W.oninput = () => { if (K.checked) H.value = Math.round(+W.value * S.h / S.w); pct.value = Math.round(+W.value / S.w * 100); };
        H.oninput = () => { if (K.checked) W.value = Math.round(+H.value * S.w / S.h); pct.value = Math.round(+H.value / S.h * 100); };
        pct.oninput = () => { W.value = Math.round(S.w * +pct.value / 100); H.value = Math.round(S.h * +pct.value / 100); };
      } });
    }
    function dlgCanvasSize() {
      let ax = 0.5, ay = 0.5;
      dialog("Canvas Size", `<div class="rw"><span>Width (px)</span><input type="number" id="pdW" value="${S.w}" min="1" max="16384"></div><div class="rw"><span>Height (px)</span><input type="number" id="pdH" value="${S.h}" min="1" max="16384"></div>
        <div class="rw"><span>Anchor</span><div id="pdAnc" style="display:grid;grid-template-columns:repeat(3,22px);gap:2px">${[0, 0.5, 1].map((y) => [0, 0.5, 1].map((x) => `<button class="ghost" data-x="${x}" data-y="${y}" style="width:22px;height:22px;min-height:0;padding:0">${x === 0.5 && y === 0.5 ? "●" : "·"}</button>`).join("")).join("")}</div></div>
        <div style="color:var(--pc-dim)">New room on a Background layer is the background colour; elsewhere transparent.</div>`,
      (d) => { E.img.canvas(+val(d, "#pdW"), +val(d, "#pdH"), ax, ay); },
      { init(d) { d.querySelectorAll("#pdAnc button").forEach((b) => { b.onclick = () => { ax = +b.dataset.x; ay = +b.dataset.y; d.querySelectorAll("#pdAnc button").forEach((x) => { x.textContent = x === b ? "●" : "·"; }); }; }); } });
    }
    function dlgFill() {
      dialog("Fill", `<div class="rw"><span>Contents</span><select id="pdC" style="grid-column:1/3"><option value="fg">Foreground colour</option><option value="bg">Background colour</option><option value="col">Colour…</option><option value="#000000">Black</option><option value="#808080">50% Gray</option><option value="#ffffff">White</option><option value="ca">Content-Aware</option>${root.PCPattern && root.PCPattern.names().length ? `<option value="pat">Pattern</option>` : ""}</select></div>
        <div class="rw" id="pdColRow" style="display:none"><span>Colour</span><input type="color" id="pdCol" value="${S.fg}"></div>
        <div class="rw" id="pdPatRow" style="display:none"><span>Pattern</span><select id="pdPat">${(root.PCPattern ? root.PCPattern.names() : []).map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select></div>
        <div class="rw"><span>Mode</span><select id="pdM">${E.BLEND_NAMES.map((b) => `<option>${b}</option>`).join("")}</select></div><div class="rw"><span>Opacity (%)</span><input type="number" id="pdO" value="100" min="1" max="100"></div>
        <div style="color:var(--pc-dim)">${E.hasSel() ? "Fills the selection." : "Nothing selected - fills the whole layer."}</div>`,
      (d) => { const c = val(d, "#pdC"); if (c === "ca") { if (E.caFill) E.caFill(false); return; } if (c === "pat") { if (E.patterns) E.patterns.fillWith(val(d, "#pdPat"), (+val(d, "#pdO") || 100) / 100, val(d, "#pdM")); return; } const col = c === "fg" ? S.fg : c === "bg" ? S.bg : c === "col" ? val(d, "#pdCol") : c; E.fillSelection(col, (+val(d, "#pdO") || 100) / 100, val(d, "#pdM")); },   // 2.423.0: + Content-Aware
      { init(d) { d.querySelector("#pdC").onchange = (e) => { d.querySelector("#pdColRow").style.display = e.target.value === "col" ? "" : "none"; d.querySelector("#pdPatRow").style.display = e.target.value === "pat" ? "" : "none"; }; } });
    }
    /** the selection's edge as a ring w px wide (inside / centre / outside) */
    function ringOf(w, where) {
      const sel = S.sel;
      if (where === "inside") return P.combine(Uint8Array.from(sel), P.morph(sel, S.w, S.h, -w), "subtract");
      if (where === "outside") return P.combine(P.morph(sel, S.w, S.h, w), sel, "subtract");
      const h = Math.max(1, Math.round(w / 2));
      return P.combine(P.morph(sel, S.w, S.h, h), P.morph(sel, S.w, S.h, -h), "subtract");
    }
    function dlgStroke() {
      dialog("Stroke", `<div class="rw"><span>Width (px)</span><input type="number" id="pdW" value="4" min="1" max="250"></div><div class="rw"><span>Colour</span><input type="color" id="pdCol" value="${S.fg}"></div>
        <div class="rw"><span>Location</span><select id="pdL"><option value="inside">Inside</option><option value="center" selected>Center</option><option value="outside">Outside</option></select></div><div class="rw"><span>Opacity (%)</span><input type="number" id="pdO" value="100" min="1" max="100"></div>`,
      (d) => {
        const ring = ringOf(Math.max(1, +val(d, "#pdW") || 4), val(d, "#pdL")), [r, g, b] = E.B.hexRgb(val(d, "#pdCol")), op = (+val(d, "#pdO") || 100) / 100;
        E.pxOp("stroke", (c, gg) => { const t = newCanvas(S.w, S.h), tg = ctx(t), id = tg.createImageData(S.w, S.h); for (let i = 0; i < ring.length; i++) if (ring[i]) { id.data[i * 4] = r; id.data[i * 4 + 1] = g; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = ring[i]; } tg.putImageData(id, 0, 0); gg.save(); gg.globalAlpha = op; gg.drawImage(t, 0, 0); gg.restore(); });
      });
    }
    function dlgModify(kind, name) {
      dialog(name + " Selection", `<div class="rw"><span>${kind === "border" ? "Width" : kind === "smooth" ? "Sample radius" : kind === "feather" ? "Feather radius" : kind === "expand" ? "Expand by" : "Contract by"} (px)</span><input type="number" id="pdN" value="${store.get("mod." + kind, 8)}" min="1" max="500"></div>`,
        (d) => { const n = +val(d, "#pdN") || 8; store.set("mod." + kind, n); E.modifySel(kind, n); });
    }
    function dlgColorRange() {
      dialog("Color Range", `<div class="rw"><span>Colour</span><input type="color" id="pdCol" value="${S.fg}"></div><div class="rw"><label>Fuzziness</label><input type="range" id="pdF" min="1" max="200" value="40"><input type="number" id="pdFN" min="1" max="200" value="40"></div>
        <div style="color:var(--pc-dim)">Selects every pixel near the colour (all visible layers). Tip: the Eyedropper (I) sets the foreground colour first.</div>`,
      (d) => { E.colorRange(val(d, "#pdCol"), +val(d, "#pdFN")); },
      { init(d) { const r = d.querySelector("#pdF"), n = d.querySelector("#pdFN"); r.oninput = () => { n.value = r.value; }; n.onchange = () => { r.value = n.value; }; } });
    }
    /** Layer Style: the effects on the left, the chosen one's settings on the right, live */
    function dlgStyle(focus) {
      const A = L(); if (!A || A.type === "adjust") return say("layer styles go on a pixel, text, shape, fill layer or a group");
      const orig = D.clone(A.styles || {}), work = {};
      for (const [k] of D.STYLE_KINDS) work[k] = Object.assign({}, D.STYLE_DEFAULTS[k], orig[k] || {});
      if (focus && !orig[focus]) work[focus].on = true;
      let curK = focus || (D.STYLE_KINDS.find(([k]) => orig[k] && orig[k].on) || ["shadow"])[0];
      const apply = () => E.liveSet(A, (x) => { x.styles = D.clone(work); });
      const fields = {
        shadow: [["color", "Colour", "color"], ["opacity", "Opacity", "pct"], ["angle", "Angle (°)", "num", -180, 180], ["distance", "Distance (px)", "num", 0, 500], ["size", "Size (px)", "num", 0, 250]],
        outerGlow: [["color", "Colour", "color"], ["opacity", "Opacity", "pct"], ["size", "Size (px)", "num", 0, 250]],
        stroke: [["size", "Size (px)", "num", 1, 250], ["position", "Position", "sel", ["outside", "inside", "center"]], ["color", "Colour", "color"], ["opacity", "Opacity", "pct"]],
        colorOverlay: [["color", "Colour", "color"], ["opacity", "Opacity", "pct"]],
        gradientOverlay: [["c1", "From", "color"], ["c2", "To", "color"], ["angle", "Angle (°)", "num", -180, 180], ["opacity", "Opacity", "pct"]],
      };
      fields.innerShadow = fields.shadow; fields.innerGlow = fields.outerGlow;
      if (root.PCStyles) Object.assign(fields, root.PCStyles.FIELDS);      // 2.397.0: bevel, satin, pattern overlay; the overlays' blend modes
      const right = () => {
        const s = work[curK];
        return `<b>${esc((D.STYLE_KINDS.find(([k]) => k === curK) || [0, curK])[1])}</b>` + fields[curK].map(([k, lab, ty, a, b]) => {
          const v = s[k];
          if (ty === "color") return `<div class="rw"><span>${lab}</span><input type="color" data-sk="${k}" value="${v}"></div>`;
          if (ty === "pct") return `<div class="rw"><label>${lab} (%)</label><input type="range" data-sk="${k}" data-pct="1" min="0" max="100" value="${Math.round(v * 100)}"><input type="number" data-skn="${k}" min="0" max="100" value="${Math.round(v * 100)}"></div>`;
          if (ty === "sel") return `<div class="rw"><span>${lab}</span><select data-sk="${k}">${a.map((o) => `<option${o === v ? " selected" : ""}>${o}</option>`).join("")}</select></div>`;
          if (ty === "chk") return `<div class="rw"><label><input type="checkbox" data-sk="${k}" data-chk="1" ${v ? "checked" : ""}> ${lab}</label></div>`;
          return `<div class="rw"><label>${lab}</label><input type="range" data-sk="${k}" min="${a}" max="${b}" value="${v}"><input type="number" data-skn="${k}" min="${a}" max="${b}" value="${v}"></div>`;
        }).join("");
      };
      const PRE = root.PCStyles ? root.PCStyles.PRESETS : [];
      const d = dialog("Layer Style", `<div style="display:flex;gap:10px"><div id="psList" style="flex:none;width:170px">
          ${PRE.length ? `<div class="rw"><span>Styles</span><select id="psPreset" title="One-click looks - they replace this layer's styles"><option value="">— pick a look —</option>${PRE.map(([n]) => `<option>${esc(n)}</option>`).join("")}</select></div>` : ""}
          <div class="kxrow"><b>Blending</b></div>
          <div class="rw"><label>Opacity (%)</label><input type="number" id="psOp" min="0" max="100" value="${Math.round(A.opacity * 100)}"></div>
          <div class="rw"><label>Fill opacity (%)</label><input type="number" id="psFill" min="0" max="100" value="${Math.round((A.fillOpacity == null ? 1 : A.fillOpacity) * 100)}"></div>
          ${D.STYLE_KINDS.map(([k, n]) => `<div class="kxrow psk" data-k="${k}" style="cursor:pointer;padding:2px 4px;${k === curK ? "background:var(--pc-on)" : ""}"><input type="checkbox" data-on="${k}" ${work[k].on ? "checked" : ""}> ${esc(n)}</div>`).join("")}
        </div><div id="psRight" style="flex:1;min-width:0">${right()}</div></div>`,
      () => { E.commitLive("layer style"); }, { wide: true, cancel: () => E.cancelLive(), init(dd) {
        const bindRight = () => {
          dd.querySelectorAll("#psRight [data-sk]").forEach((el) => {
            const k = el.dataset.sk, n = dd.querySelector(`#psRight [data-skn="${k}"]`);
            el.oninput = el.onchange = () => { work[curK][k] = el.dataset.chk ? el.checked : el.dataset.pct ? +el.value / 100 : el.type === "range" ? +el.value : el.value; if (n) n.value = el.value; work[curK].on = true; dd.querySelector(`[data-on="${curK}"]`).checked = true; apply(); };
            if (n) n.onchange = () => { el.value = n.value; el.oninput(); };
          });
        };
        dd.querySelectorAll(".psk").forEach((row) => { row.onclick = (e) => { if (e.target.tagName === "INPUT") return; curK = row.dataset.k; dd.querySelectorAll(".psk").forEach((r) => { r.style.background = r === row ? "var(--pc-on)" : ""; }); dd.querySelector("#psRight").innerHTML = right(); bindRight(); }; });
        dd.querySelectorAll("[data-on]").forEach((c) => { c.onchange = () => { work[c.dataset.on].on = c.checked; apply(); }; });
        const pre = dd.querySelector("#psPreset");                       // 2.397.0: the one-click looks
        if (pre) pre.onchange = () => {
          const st = pre.value && root.PCStyles.presetStyles(pre.value, D.STYLE_DEFAULTS); if (!st) return;
          for (const [k] of D.STYLE_KINDS) work[k] = st[k];
          dd.querySelectorAll("[data-on]").forEach((c) => { c.checked = !!work[c.dataset.on].on; });
          curK = (D.STYLE_KINDS.find(([k]) => work[k].on) || [curK])[0];
          dd.querySelectorAll(".psk").forEach((r) => { r.style.background = r.dataset.k === curK ? "var(--pc-on)" : ""; });
          dd.querySelector("#psRight").innerHTML = right(); bindRight(); apply();
        };
        dd.querySelector("#psOp").onchange = (e) => E.liveSet(A, (x) => { x.opacity = Math.max(0, Math.min(100, +e.target.value)) / 100; });
        dd.querySelector("#psFill").onchange = (e) => E.liveSet(A, (x) => { x.fillOpacity = Math.max(0, Math.min(100, +e.target.value)) / 100; });
        bindRight(); apply();
      } });
      return d;
    }
    E.ui.dlgStyle = dlgStyle;
    // 2.485.0: the Export As formats - [id, label, MIME type, extension, has a quality] (pcfileplus.js adds BMP, TIFF, GIF, TGA, AVIF)
    const FORMATS = E.exportFormats = [["png", "PNG", "image/png", "png", false], ["jpeg", "JPEG", "image/jpeg", "jpg", true], ["webp", "WebP", "image/webp", "webp", true]];
    if (root.BGJxl) FORMATS.push(["jxl", "JPEG XL", "image/jxl", "jxl", true]);              // 2.479.0: + JPEG XL (static/jxl.js)
    const fmtOf = (id) => FORMATS.find((x) => x[0] === id) || FORMATS[0];
    const withInfo = (b, type, cb) => (b && E.fileInfoBlob ? E.fileInfoBlob(b, type).then(cb, () => cb(b)) : cb(b));
    function download(fmt, quality, scale) {
      const c = scaled(scale || 1), F = fmtOf(fmt), type = F[2];
      c.toBlob((b0) => withInfo(b0, type, (b) => {
        if (!b) return say("export failed");
        const a = doc.createElement("a"); a.href = URL.createObjectURL(b); a.download = (S.name || "image").replace(/\.[a-z0-9]+$/i, "") + "." + F[3];
        doc.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }), type, quality == null ? 0.92 : quality);
    }
    function scaled(k) {
      const f = E.flatten(); if (k === 1) return f;
      const c = newCanvas(Math.max(1, Math.round(S.w * k)), Math.max(1, Math.round(S.h * k))), g = ctx(c); g.imageSmoothingQuality = "high"; g.drawImage(f, 0, 0, c.width, c.height); return c;
    }
    function dlgExport() {
      let blob = null;
      const d = dialog("Export As", `<div style="display:flex;gap:12px"><div style="flex:none;width:280px"><canvas id="pdPrev" width="280" height="200" style="width:280px;height:200px;background:repeating-conic-gradient(#bbb 0 25%,#fff 0 50%) 0 0/12px 12px;border:1px solid var(--pc-line)"></canvas>
          <div id="pdInfo" style="color:var(--pc-dim);margin-top:4px">…</div></div><div style="flex:1">
          <div class="rw"><span>Format</span><select id="pdF">${FORMATS.map((x) => `<option value="${x[0]}">${x[1]}</option>`).join("")}</select></div>
          <div class="rw" id="pdQRow" style="display:none"><label>Quality</label><input type="range" id="pdQ" min="1" max="100" value="90"><input type="number" id="pdQN" min="1" max="100" value="90"></div>
          <div class="rw" id="pdLRow" style="display:none"><span></span><label style="grid-column:2/4"><input type="checkbox" id="pdL"> Lossless (every pixel kept exactly)</label></div>
          <div class="rw"><span>Scale (%)</span><input type="number" id="pdS" min="1" max="400" value="100"></div>
          <div class="rw"><span>Name</span><input type="text" id="pdN" value="${esc((S.name || "image").replace(/\.[a-z0-9]+$/i, ""))}" style="grid-column:1/3;width:100%"></div></div></div>`,
      (dd) => { if (!blob) return false; const f = val(dd, "#pdF"); E.saveToImages(blob, val(dd, "#pdN") + "-" + Date.now().toString(36) + "." + fmtOf(f)[3]); },
      { wide: true, okLabel: "Save to Images", extra: '<button class="ghost" id="pdDl" style="margin-right:auto">⤓ Download</button>', init(dd) {
        let t = null;
        const upd = () => {
          clearTimeout(t); t = setTimeout(() => {
            const f = val(dd, "#pdF"), lossless = f === "jxl" && dd.querySelector("#pdL").checked, q = lossless ? 1 : (+val(dd, "#pdQN") || 90) / 100, k = Math.max(0.01, (+val(dd, "#pdS") || 100) / 100);
            dd.querySelector("#pdQRow").style.display = !fmtOf(f)[4] || lossless ? "none" : "";
            dd.querySelector("#pdLRow").style.display = f === "jxl" ? "" : "none";
            const c = scaled(k);
            c.toBlob((b0) => withInfo(b0, fmtOf(f)[2], (b) => {
              blob = b; if (!b) return;
              const url = URL.createObjectURL(b), im = new win.Image();
              im.onload = () => { const pv = dd.querySelector("#pdPrev"), g = ctx(pv); g.clearRect(0, 0, 280, 200); const s2 = Math.min(280 / im.width, 200 / im.height); g.drawImage(im, (280 - im.width * s2) / 2, (200 - im.height * s2) / 2, im.width * s2, im.height * s2); URL.revokeObjectURL(url); };
              im.onerror = () => { const pv = dd.querySelector("#pdPrev"), g = ctx(pv); g.clearRect(0, 0, 280, 200); const s2 = Math.min(280 / c.width, 200 / c.height); g.drawImage(c, (280 - c.width * s2) / 2, (200 - c.height * s2) / 2, c.width * s2, c.height * s2); URL.revokeObjectURL(url); };   // 2.485.0: TIFF / TGA have no preview in a browser
              im.src = url;
              dd.querySelector("#pdInfo").textContent = `${c.width} × ${c.height} px · ${f.toUpperCase()} · ${b.size > 1048576 ? (b.size / 1048576).toFixed(2) + " MB" : Math.round(b.size / 1024) + " KB"}`;
            }), fmtOf(f)[2], q);
          }, 120);
        };
        const q = dd.querySelector("#pdQ"), qn = dd.querySelector("#pdQN"); q.oninput = () => { qn.value = q.value; upd(); }; qn.onchange = () => { q.value = qn.value; upd(); };
        dd.querySelector("#pdF").onchange = upd; dd.querySelector("#pdS").onchange = upd; dd.querySelector("#pdL").onchange = upd;
        dd.querySelector("#pdDl").onclick = () => download(val(dd, "#pdF"), val(dd, "#pdF") === "jxl" && dd.querySelector("#pdL").checked ? 1 : (+val(dd, "#pdQN") || 90) / 100, (+val(dd, "#pdS") || 100) / 100);
        upd();
      } });
      return d;
    }
    function dlgShortcuts() {
      const rows = [];
      for (const [name, items] of MENUS) {
        const walk = (list, path) => { for (const it of list) { if (it === sep) continue; if (typeof it === "object") walk(it.items, path + " ▸ " + it.label); else { const c = CMD.get(it); if (c && c.key && !c.hidden) rows.push([path + " ▸ " + c.label.replace("…", ""), c.key]); } } };
        walk(items, name);
      }
      const tools = GROUPS.filter(Boolean).map((g) => [g.tools.map(([, n]) => n.replace(/ Tool$/, "")).join(" / "), g.k.toUpperCase() + (g.tools.length > 1 ? (/^f\d+$/.test(g.k) ? " (again cycles)" : " (Shift cycles)") : "")]);
      const extra = [["Prompt docker (anywhere, not while typing)", "P"], ["Quick mask", "Q"], ["Default colours / swap", "D / X"], ["Brush size", "[ / ]"], ["Tool opacity 10…100 %", "1 … 0"], ["Panels / all panels", "Tab / Shift+Tab"], ["Pan", "Space-drag"], ["Free transform: proportional / free / 15°", "corner / Shift-corner / Shift-rotate"]];
      dialog("Keyboard Shortcuts", `<div style="max-height:60vh;overflow:auto"><table style="width:100%;border-collapse:collapse">${rows.concat([["— Tools —", ""]], tools, [["— More —", ""]], extra).map(([a, b]) => `<tr><td style="padding:2px 4px;border-bottom:1px solid var(--pc-sep)">${esc(a)}</td><td style="padding:2px 4px;border-bottom:1px solid var(--pc-sep);color:var(--pc-dim);white-space:nowrap">${esc(b)}</td></tr>`).join("")}</table></div>`, () => true, { wide: true, okLabel: "Close" });
    }
    function palette() {
      const all = [];
      for (const [name, items] of MENUS) {
        const walk = (list, path) => { for (const it of list) { if (it === sep) continue; if (typeof it === "object") walk(it.items, path + " ▸ " + it.label); else { const c = CMD.get(it); if (c && !c.hidden) all.push({ id: c.id, label: path + " ▸ " + c.label.replace("…", ""), key: c.key }); } } };
        walk(items, name);
      }
      for (const g of GROUPS) if (g) for (const [id, n] of g.tools) all.push({ tool: id, label: "Tool ▸ " + n, key: g.k.toUpperCase() });
      const d = dialog("Command Palette", `<input type="text" id="pdQ" placeholder="Type a command or a tool…" style="width:100%"><div id="pdList" class="kxlayers" style="max-height:340px;margin-top:6px"></div>`, () => { const on = d.querySelector("#pdList .on"); if (on) go(on.dataset.ix); return false; }, { wide: true, okLabel: "Run" });
      let shown = [];
      const go = (ix) => { const it = shown[+ix]; if (!it) return; d.remove(); if (it.tool) E.setTool(it.tool); else run(it.id); };
      const paint = () => {
        const q = d.querySelector("#pdQ").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        shown = all.filter((x) => q.every((w) => x.label.toLowerCase().includes(w))).slice(0, 60);
        d.querySelector("#pdList").innerHTML = shown.map((x, i) => `<div class="kxlayer${i === 0 ? " on" : ""}" data-ix="${i}"><span class="nm">${esc(x.label)}</span><span style="color:var(--pc-dim)">${esc(x.key || "")}</span></div>`).join("");
        d.querySelectorAll("#pdList [data-ix]").forEach((r) => { r.onclick = () => go(r.dataset.ix); });
      };
      const inp = d.querySelector("#pdQ");
      inp.oninput = paint;
      inp.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const rows = [...d.querySelectorAll("#pdList [data-ix]")], i = rows.findIndex((r) => r.classList.contains("on")); const n = Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))); rows.forEach((r, k) => r.classList.toggle("on", k === n)); if (rows[n]) rows[n].scrollIntoView({ block: "nearest" }); }
      });
      paint();
      return d;
    }
    E.ui.palette = palette;

    /* ---------------- the curve editor (Curves - a dialog or Properties) ---------------- */
    E.ui.curveWidget = (host, value, onChange) => {
      const v = value && typeof value === "object" ? value : { rgb: [[0, 0], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] };
      let ch = "rgb";
      host.innerHTML = `<div class="kxrow"><select class="pcch"><option value="rgb">RGB</option><option value="r">Red</option><option value="g">Green</option><option value="b">Blue</option></select><button class="ghost pcrst" type="button">Reset</button><span style="color:var(--pc-dim)">click adds, drag moves, double-click removes</span></div><canvas class="pccurve" width="256" height="256"></canvas>`;
      const c = host.querySelector("canvas"), g = ctx(c);
      const draw = () => {
        if (!g) return;
        g.clearRect(0, 0, 256, 256); g.strokeStyle = "rgba(128,128,128,.35)"; g.lineWidth = 1;
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, 256); g.moveTo(0, k * 64); g.lineTo(256, k * 64); g.stroke(); }
        g.beginPath(); g.moveTo(0, 256); g.lineTo(256, 0); g.stroke();
        const lut = FX.curveLut(v[ch]);
        g.strokeStyle = { rgb: "#ddd", r: "#f55", g: "#5d5", b: "#58f" }[ch]; g.lineWidth = 2; g.beginPath();
        for (let x = 0; x < 256; x++) { const y = 255 - lut[x]; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
        g.fillStyle = "#fff"; for (const [x, y] of v[ch]) g.fillRect(x - 3, 255 - y - 3, 6, 6);
      };
      const at = (e) => { const r = c.getBoundingClientRect(); return [Math.max(0, Math.min(255, Math.round((e.clientX - r.left) * 256 / r.width))), Math.max(0, Math.min(255, Math.round(255 - (e.clientY - r.top) * 256 / r.height)))]; };
      let drag = -1;
      c.onpointerdown = (e) => {
        const [x, y] = at(e), pts = v[ch];
        drag = pts.findIndex(([px, py]) => Math.abs(px - x) < 8 && Math.abs(py - y) < 8);
        if (drag < 0) { pts.push([x, y]); pts.sort((a, b) => a[0] - b[0]); drag = pts.findIndex(([px, py]) => px === x && py === y); }
        c.setPointerCapture(e.pointerId); draw(); onChange(v, false);
      };
      c.onpointermove = (e) => {
        if (drag < 0) return;
        const [x, y] = at(e), pts = v[ch], lo = drag > 0 ? pts[drag - 1][0] + 1 : 0, hi = drag < pts.length - 1 ? pts[drag + 1][0] - 1 : 255;
        pts[drag] = [drag === 0 ? Math.min(x, hi) : drag === pts.length - 1 ? Math.max(x, lo) : Math.max(lo, Math.min(hi, x)), y];
        draw(); onChange(v, false);
      };
      c.onpointerup = () => { if (drag >= 0) { drag = -1; onChange(v, true); } };
      c.ondblclick = (e) => { const [x, y] = at(e), pts = v[ch], i = pts.findIndex(([px, py]) => Math.abs(px - x) < 8 && Math.abs(py - y) < 8); if (i > 0 && i < pts.length - 1) { pts.splice(i, 1); draw(); onChange(v, true); } };
      host.querySelector(".pcch").onchange = (e) => { ch = e.target.value; draw(); };
      host.querySelector(".pcrst").onclick = () => { v[ch] = [[0, 0], [255, 255]]; draw(); onChange(v, true); };
      draw();
    };

    /* ---------------- copy / paste ---------------- */
    function copy(merged, cut) {
      if (!S.w) return;
      const src = merged ? E.flatten() : (L().type === "group" || L().type === "adjust" ? null : L().canvas);
      if (!src) return say("copy a pixel, text or shape layer (or Copy Merged)");
      const sc = E.selCanvas(), b = E.hasSel() ? P.bbox(S.sel, S.w, S.h) : { x: 0, y: 0, w: S.w, h: S.h };
      const c = newCanvas(b.w, b.h), g = ctx(c);
      g.drawImage(src, -b.x, -b.y);
      if (sc) { g.globalCompositeOperation = "destination-in"; g.drawImage(sc, -b.x, -b.y); }
      clip = { c, x: b.x, y: b.y };
      try { if (win.navigator && win.navigator.clipboard && win.ClipboardItem) c.toBlob((bl) => { if (bl) win.navigator.clipboard.write([new win.ClipboardItem({ "image/png": bl })]).catch(() => {}); }); } catch (e) { /* the browser's clipboard is a bonus */ }
      if (cut) E.clearSelectionArea();
      say(`${cut ? "cut" : "copied"} ${b.w}×${b.h}${merged ? " (merged)" : ""}`);
    }
    async function paste(inPlace) {
      let c = clip && clip.c, x = clip ? clip.x : 0, y = clip ? clip.y : 0;
      if (!c && win.navigator && win.navigator.clipboard && win.navigator.clipboard.read) {
        try {
          for (const it of await win.navigator.clipboard.read()) {
            const t = it.types.find((ty) => /^image\//.test(ty)); if (!t) continue;
            const im = await E.imgOf(URL.createObjectURL(await it.getType(t)));
            c = newCanvas(im.naturalWidth, im.naturalHeight); ctx(c).drawImage(im, 0, 0); x = 0; y = 0; break;
          }
        } catch (e) { /* no permission */ }
      }
      if (!c) return say("nothing to paste");
      if (!S.w) { E.openDoc(c.width, c.height, "Pasted", (g) => g.drawImage(c, 0, 0)); return; }
      const Lp = E.makeLayer("Pasted Layer", S.w, S.h), g = ctx(Lp.canvas);
      if (!inPlace) { x = Math.round((S.w - c.width) / 2); y = Math.round((S.h - c.height) / 2); }
      g.drawImage(c, x, y);
      E.addLayer(Lp, "paste", false);
      // 2.550.0: as Photoshop - the selection goes with a paste (it sat on the copied area, not on the pasted picture, so the
      // Move tool moved the empty selected part of the new layer)
      if (E.hasSel && E.hasSel() && E.deselect) E.deselect();
    }

    /* ---------------- rulers + grid ---------------- */
    function rulers(cursor) {
      if (!kx.classList.contains("rulers")) return;
      const st = E.stage, W = st.clientWidth, H = st.clientHeight;
      const hc = $("pcRulerH"), vc = $("pcRulerV");
      if (hc.width !== W) hc.width = W; if (hc.height !== 16) hc.height = 16; if (vc.width !== 16) vc.width = 16; if (vc.height !== H) vc.height = H;
      const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].find((s) => s * S.zoom >= 50) || 5000;
      const css = getComputedStyle(kx), fg = css.getPropertyValue("--pc-dim") || "#999";
      for (const [c, horiz] of [[hc, true], [vc, false]]) {
        const g = ctx(c); if (!g) continue;
        g.clearRect(0, 0, c.width, c.height); g.fillStyle = fg; g.strokeStyle = fg; g.font = "9px sans-serif"; g.lineWidth = 1;
        const len = horiz ? W : H, off = horiz ? S.panX : S.panY;
        const first = Math.floor(-off / S.zoom / step) * step;
        g.beginPath();
        for (let v = first; v * S.zoom + off < len; v += step / 5) {
          const p = Math.round(v * S.zoom + off) + 0.5, major = Math.abs(v / step - Math.round(v / step)) < 1e-6, t = major ? 16 : 5;
          if (horiz) { g.moveTo(p, 16); g.lineTo(p, 16 - t); if (major) g.fillText(String(Math.round(v)), p + 2, 9); }
          else { g.moveTo(16, p); g.lineTo(16 - t, p); if (major) { g.save(); g.translate(9, p + 2); g.rotate(-Math.PI / 2); g.fillText(String(Math.round(v)), 0, 0); g.restore(); } }
        }
        g.stroke();
        if (cursor) { g.fillStyle = "#2680eb"; const p = (horiz ? cursor[0] : cursor[1]) * S.zoom + off; if (horiz) g.fillRect(p, 0, 1, 16); else g.fillRect(0, p, 16, 1); }
      }
    }
    E.ui.rulers = rulers;
    S.grid = store.get("grid", false);
    if (store.get("rulers", false)) kx.classList.add("rulers");
    E.overlayHooks.push((g, px) => {
      if (!S.grid) return;
      // 2.445.0: static/gridspec.js draws it as set in ⚙ ▸ Grids & Guides (major lines, lines / dots, its colour)
      if (root.H3Grid && E.gridSpec) { root.H3Grid.draw(g, E.gridSpec(), { x: 0, y: 0, w: S.w, h: S.h }, 1, { lineWidth: px, viewZoom: S.zoom }); return; }
      const step = S.gridFixed > 0 ? S.gridFixed : [8, 16, 32, 64, 128, 256, 512].find((s) => s * S.zoom >= 24) || 1024;   // 2.440.0: a set spacing (Grid and Snapping…)
      g.strokeStyle = "rgba(38,128,235,.35)"; g.lineWidth = px; g.beginPath();
      for (let x = step; x < S.w; x += step) { g.moveTo(x, 0); g.lineTo(x, S.h); }
      for (let y = step; y < S.h; y += step) { g.moveTo(0, y); g.lineTo(S.w, y); }
      g.stroke();
    });

    E.ui.wheelPans = () => false;
    layers();
  }

  const api = { install, GROUPS, ICON, toolName, groupOf, accelOf, normAccel, SUB, SWATCHES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCUI = api;
})(typeof window !== "undefined" ? window : globalThis);
