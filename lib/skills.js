// lib/skills.js — 2.888.0: SKILLS for the chat's LLM (the last part of "abilities like claude code gives").
// A skill is a folder with a SKILL.md: a few lines of frontmatter (name, description) and the instructions. The LLM sees
// every skill's name + description; when one fits the ask it loads the instructions with the use_skill tool and follows
// them. Skills are words only - they never run anything themselves (a command still needs 🧰 and your yes).
//   built in    <app>/skills/<name>/SKILL.md      shipped with bitGen (read only)
//   yours       <app>/my-skills/<name>/SKILL.md   made in Settings ▸ General ▸ 🎛 Skills (or a SKILL.md imported) -
//               a skill of yours with a built-in's name is used instead of it
//   list() -> [{name, description, source: "built-in" | "yours", overrides}]   get(name) -> {name, description, body, source}
//   save({name, description, body}) / remove(name) - yours only; parse(text) / render(skill) are pure
"use strict";
const fs = require("fs");
const path = require("path");
const core = () => require("./core");

const MAX_BODY = 20000, MAX_DESC = 300;
const bad = (msg, status) => Object.assign(new Error(msg), { status: status || 400 });
const base = () => core().BASE || path.join(__dirname, "..");
const builtInDir = () => path.join(base(), "skills");
const userDir = () => path.join(base(), "my-skills");
/** a skill's name: lower case words joined by - (the folder's name) */
function slug(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 64); }

/** SKILL.md text -> {name, description, body} (frontmatter between --- lines; a file without one = all body) */
function parse(text) {
  const t = String(text || "").replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
  const head = {}, body = (m ? m[2] : t).trim();
  if (m) for (const line of m[1].split("\n")) { const k = /^([A-Za-z_-]+)\s*:\s*(.*)$/.exec(line); if (k) head[k[1].toLowerCase()] = k[2].trim().replace(/^["']|["']$/g, ""); }
  return { name: head.name || "", description: head.description || "", body };
}
function render(s) { return `---\nname: ${s.name}\ndescription: ${String(s.description || "").replace(/\n/g, " ")}\n---\n\n${String(s.body || "").trim()}\n`; }

function readDir(dir, source) {
  const out = [];
  let names = []; try { names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch (e) { return out; }
  for (const n of names) {
    let t; try { t = fs.readFileSync(path.join(dir, n, "SKILL.md"), "utf8"); } catch (e) { continue; }
    const p = parse(t);
    out.push({ name: slug(p.name || n) || n, description: p.description.slice(0, MAX_DESC), body: p.body.slice(0, MAX_BODY), source, folder: n });
  }
  return out;
}
function all() {
  const mine = readDir(userDir(), "yours"), built = readDir(builtInDir(), "built-in");
  const names = new Set(mine.map((s) => s.name));
  return mine.map((s) => Object.assign(s, { overrides: built.some((b) => b.name === s.name) })).concat(built.filter((b) => !names.has(b.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function list() { return all().map((s) => ({ name: s.name, description: s.description, source: s.source, overrides: !!s.overrides })); }
function get(name) {
  const n = slug(name), s = all().find((x) => x.name === n);
  if (!s) throw bad(`there is no skill called "${name}"`, 404);
  return { name: s.name, description: s.description, body: s.body, source: s.source };
}
function save(b) {
  const name = slug(b && b.name);
  if (!name) throw bad("give the skill a name");
  const description = String((b && b.description) || "").replace(/\s+/g, " ").trim();
  if (!description) throw bad("say in one line when the skill is used (its description)");
  const body = String((b && b.body) || "").trim();
  if (!body) throw bad("write the skill's instructions");
  if (body.length > MAX_BODY) throw bad("the instructions are over 20 000 letters");
  const dir = path.join(userDir(), name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), render({ name, description: description.slice(0, MAX_DESC), body }));
  if (b.was && slug(b.was) !== name) { try { remove(b.was); } catch (e) { /* only the new one */ } }
  return get(name);
}
function remove(name) {
  const n = slug(name), s = readDir(userDir(), "yours").find((x) => x.name === n);
  if (!s) throw bad(readDir(builtInDir(), "built-in").some((x) => x.name === n) ? "a built-in skill can't be deleted - make one of yours with the same name to use instead" : `there is no skill of yours called "${name}"`);
  fs.rmSync(path.join(userDir(), s.folder), { recursive: true, force: true });
  return { ok: true, name: n };
}

/** the tool the LLM is given (lib/llmAgent.js): risk "skill" - words only, allowed in every turn */
const TOOLS = {
  use_skill: { risk: "skill", about: "load a skill's instructions (pick one from the SKILLS list when it fits what the user asked), then follow them", args: { skill: "the skill's name" },
    async run(a) { const s = get(a.skill || a.name); return { name: s.name, description: s.description, body: s.body, source: s.source }; } },
};
/** the SKILLS list for the system message */
function note(max) {
  const L = list().slice(0, max || 40);
  return L.length ? "\nSKILLS (instructions you can load with use_skill when one fits the ask):\n" + L.map((s) => `- ${s.name}: ${s.description}`).join("\n") : "";
}

module.exports = { slug, parse, render, list, get, save, remove, note, TOOLS, builtInDir, userDir };
