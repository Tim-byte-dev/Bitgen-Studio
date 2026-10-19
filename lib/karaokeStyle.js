// bitGen Studio — lib/karaokeStyle.js (2.380.0): how a karaoke overlay LOOKS.
//
// Tim: "add karaoke options to settings in videodocker and timelinedocker settings - font, font-size, color,
// text-shadow, border color, background color, background opacity, font-opacity, background-border color,
// background-border width, box shadow, ball size, ball color, ball outline color, background-height,
// position-top:n px".
//
// ONE style for every overlay (the video docker's scenes and the timeline's karaoke generator), kept in the settings
// file: custom.settings ui.karaoke_style (POST /api/config {ui: {karaoke_style}} - static/karaokestyle.js). Every
// karaoke job carries the normalized style (lib/karaoke -> karaoke_worker.py -> scripts/karaoke_ass.py).
//   font              a font family name ("" = the bundled default: Arial / Liberation Sans / DejaVu Sans)
//   font_size         px of the overlay (0 = automatic: 7.5% of its height)
//   color             the words before they are sung        highlight   the sung words (the sweep)
//   font_opacity      0..100 %
//   text_shadow       px (0 = none)                          border_color / border_width   the letters' outline
//   bg_color, bg_opacity (0..100 %, 0 = no background band), bg_border_color, bg_border_width (px),
//   box_shadow        px - a soft shadow under the band       bg_height   px (0 = fits the two lyric lines)
//   position_top      px from the top of the picture to the band / the lyrics (-1 = automatic: near the bottom)
//   ball_size         px radius (0 = automatic)               ball_color, ball_outline_color
"use strict";

const DEFAULTS = Object.freeze({
  font: "", font_size: 0, color: "#ffffff", highlight: "#ffd500", font_opacity: 100,
  text_shadow: 2, border_color: "#101010", border_width: 3,
  bg_color: "#000000", bg_opacity: 0, bg_border_color: "#ffffff", bg_border_width: 0, box_shadow: 0,
  bg_height: 0, position_top: -1,
  ball_size: 0, ball_color: "#ffd500", ball_outline_color: "#101010",
});
const COLORS = ["color", "highlight", "border_color", "bg_color", "bg_border_color", "ball_color", "ball_outline_color"];
const NUMS = { font_size: [0, 400], font_opacity: [0, 100], text_shadow: [0, 40], border_width: [0, 30],
               bg_opacity: [0, 100], bg_border_width: [0, 40], box_shadow: [0, 80], bg_height: [0, 2000],
               position_top: [-1, 4000], ball_size: [0, 200] };

function hex(c, fb) {
  let s = String(c == null ? "" : c).trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) s = "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return /^#[0-9a-f]{6}$/.test(s) ? s : fb;
}

function normalize(src) {
  const s = src && typeof src === "object" ? src : {};
  const out = { ...DEFAULTS };
  out.font = String(s.font == null ? "" : s.font).replace(/[^A-Za-z0-9 _.\-]+/g, "").trim().slice(0, 60);
  for (const k of COLORS) out[k] = hex(s[k], DEFAULTS[k]);
  for (const [k, [lo, hi]] of Object.entries(NUMS)) {
    const v = s[k] === "" || s[k] == null ? NaN : Number(s[k]);
    out[k] = Number.isFinite(v) ? Math.round(Math.max(lo, Math.min(hi, v))) : DEFAULTS[k];
  }
  return out;
}

/** The style in the settings file (normalized; never throws). */
function read(cfg) {
  try {
    const c = cfg || require("./core").getConfig();
    return normalize(((c || {}).ui || {}).karaoke_style);
  } catch { return normalize({}); }
}

module.exports = { DEFAULTS, COLORS, NUMS, normalize, read, hex };
