"use strict";
/**
 * promptGuides.js — HOW TO WRITE A PROMPT FOR THE MODEL THAT WILL RUN (2.104.0).
 *
 * Tim: "teach the LLMs how to write prompts for minimax h3, minimax music,
 * flux klein, sdxl, pony, illustrious and z-image".
 *
 * The guides are DATA (lib/promptGuides.json, one entry per model family:
 * rules + one example). This module picks the right one from what the app
 * knows about the selected style — its `kind` (video | image | music), its
 * `arch` id and its model FILE NAME — and renders it as a block for a system
 * prompt. Pony and Illustrious are SDXL to the loader, so they are told apart
 * by the model file name ("ponyDiffusionV6XL", "illustriousXL", "noobai…");
 * an SDXL style whose file name says neither gets the plain SDXL guide.
 *
 * Every LLM entry point uses this ONE picker — the prompt chat, Enhance,
 * the music-video shot writer — so all three teach the same thing. A user
 * override at styles/prompt-guides.json (same shape) replaces guides by id
 * without touching lib/.
 */
const fs = require("fs");
const path = require("path");

const SHIPPED = path.join(__dirname, "promptGuides.json");

function load(stylesDir) {
  let base = { guides: [] };
  try { base = JSON.parse(fs.readFileSync(SHIPPED, "utf8")); } catch { /* shipped file missing: no guides */ }
  const guides = Array.isArray(base.guides) ? base.guides.slice() : [];
  if (stylesDir) {
    try {
      const ov = JSON.parse(fs.readFileSync(path.join(stylesDir, "prompt-guides.json"), "utf8"));
      for (const g of (Array.isArray(ov.guides) ? ov.guides : [])) {
        if (!g || !g.id) continue;
        const i = guides.findIndex((x) => x.id === g.id);
        if (i >= 0) guides[i] = g; else guides.push(g);
      }
    } catch { /* no override */ }
  }
  return guides;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[\s_-]+/g, "");

/**
 * Pick a guide. `sel` = { kind, arch, model }. The most SPECIFIC family wins:
 * a file name that says "pony" beats the arch "sdxl"; "illustrious"/"noobai"
 * likewise. Video and music have one guide each.
 */
function pick(guides, sel) {
  const s = sel || {};
  const kind = String(s.kind || "").toLowerCase();
  const hay = norm(s.arch) + " " + norm(s.model);
  const ofKind = guides.filter((g) => !kind || g.kind === kind);
  // fine-tune families first (they are matched on the file name), then generic
  const order = ["pony", "illustrious", "z_image", "qwen_image", "flux_klein", "sdxl", "minimax_h3", "minimax_music"];
  const ranked = ofKind.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  for (const g of ranked)
    if ((g.match || []).some((m) => hay.includes(norm(m)))) return g;
  // nothing matched by name: the kind's only guide (video/music) or nothing
  if (kind === "video") return ofKind.find((g) => g.id === "minimax_h3") || null;
  if (kind === "music") return ofKind.find((g) => g.id === "minimax_music") || null;
  return null;
}

/** Render a guide as a system-prompt block. */
function render(g) {
  if (!g) return "";
  const lines = [`PROMPTING GUIDE — ${g.label}:`];
  for (const r of (g.rules || [])) lines.push("- " + r);
  if (g.example) lines.push("Example of a good prompt for it:", "```", String(g.example).trim(), "```");
  return lines.join("\n");
}

/** One call for callers: the rendered guide for a selection, or "". */
function guideFor(stylesDir, sel) { return render(pick(load(stylesDir), sel)); }

/* VR SBS ADDENDA (2.118.0, Tim: "when i ask the llm for a sbs vr video,
 * please help it develop the prompt, do not mirror, needs to be for vr").
 * An addendum is a guide block matched on the USER'S OWN TEXT — the rough
 * prompt, the chat thread's user side, the shot-writer's style line — rather
 * than on the selected style. Same JSON file carries them (top-level
 * `addenda`), and the same styles/prompt-guides.json override replaces them
 * by id. match_text entries are JS regex sources tested case-insensitively;
 * a broken source is skipped rather than thrown. */
function loadAddenda(stylesDir) {
  let base = {};
  try { base = JSON.parse(fs.readFileSync(SHIPPED, "utf8")); } catch { /* shipped file missing */ }
  const out = Array.isArray(base.addenda) ? base.addenda.slice() : [];
  if (stylesDir) {
    try {
      const ov = JSON.parse(fs.readFileSync(path.join(stylesDir, "prompt-guides.json"), "utf8"));
      for (const a of (Array.isArray(ov.addenda) ? ov.addenda : [])) {
        if (!a || !a.id) continue;
        const i = out.findIndex((x) => x.id === a.id);
        if (i >= 0) out[i] = a; else out.push(a);
      }
    } catch { /* no override */ }
  }
  return out;
}

function matchAddenda(addenda, kind, text) {
  const t = String(text || "");
  const k = String(kind || "").toLowerCase();
  if (!t) return [];
  return (addenda || []).filter((a) => {
    if (a && a.kind && k && a.kind !== k) return false;
    return ((a && a.match_text) || []).some((src) => {
      try { return new RegExp(src, "i").test(t); } catch { return false; }
    });
  });
}

/** Rendered addendum blocks for the user's own words, or "". */
function addendaFor(stylesDir, kind, text) {
  return matchAddenda(loadAddenda(stylesDir), kind, text).map(render).join("\n\n");
}

module.exports = { load, pick, render, guideFor, loadAddenda, matchAddenda, addendaFor };
