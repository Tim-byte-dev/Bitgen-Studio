#!/usr/bin/env node
/* bitGen Studio — 2.702.0: SVG PICTURES - static/svgpic.js (BGSvg: the SVG's own size, the PNG's size, the SVG made ready to
 * draw at it) and where it is wired: the page loads it, the Open dialog draws a picked .svg, the "+ add" tiles take .svg.
 * The drawing itself + the uploads, in a real browser: scripts/test-svg702-ui.js.
 * Tim (verbatim): "can u add svg to the images i can upload to assets or references" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const S = require(path.join(ROOT, "static", "svgpic.js"));
check("isSvgName: .svg / .svgz (any case, a ?query ignored), not .png", S.isSvgName("a.svg") && S.isSvgName("B.SVG?x=1") && S.isSvgName("c.svgz") && !S.isSvgName("a.png") && !S.isSvgName("svg"));
check("looksSvg: an <svg> after an XML declaration, comments, a doctype, a BOM; not HTML or a PNG",
  S.looksSvg('﻿<?xml version="1.0"?>\n<!-- made by me -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd">\n<svg xmlns="http://www.w3.org/2000/svg"/>')
  && S.looksSvg("<svg:svg xmlns:svg='http://www.w3.org/2000/svg'></svg:svg>") && !S.looksSvg("<html><svg></svg></html>") && !S.looksSvg("\x89PNG"));
const sz = (t) => S.sizeOf(t);
check("sizeOf: width + height (units: px, pt, mm, in)", JSON.stringify(sz('<svg width="1080" height="1080">')) === '{"w":1080,"h":1080}'
  && Math.abs(sz('<svg width="72pt" height="1in">').w - 96) < 1e-9 && Math.abs(sz("<svg width='25.4mm' height='50px'>").w - 96) < 1e-9);
check("…else the viewBox (and its shape with one side given); 100% / none -> the viewBox; nothing at all -> 300 x 150",
  JSON.stringify(sz('<svg viewBox="0 0 400 100">')) === '{"w":400,"h":100}' && JSON.stringify(sz('<svg width="800" viewBox="0,0,400,100">')) === '{"w":800,"h":200}'
  && JSON.stringify(sz('<svg width="100%" height="100%" viewBox="7 236 1054 600">')) === '{"w":1054,"h":600}' && JSON.stringify(sz("<svg>")) === '{"w":300,"h":150}');
check("target: a small icon drawn big (long side 2048), a huge one held to 4096, the shape kept",
  JSON.stringify(S.target(24, 12)) === '{"w":2048,"h":1024}' && JSON.stringify(S.target(3000, 1000)) === '{"w":3000,"h":1000}' && JSON.stringify(S.target(10000, 5000)) === '{"w":4096,"h":2048}' && JSON.stringify(S.target(1080, 1080, { min: 512 })) === '{"w":1080,"h":1080}');
const p1 = S.prepare('<?xml version="1.0"?><svg width="24" height="12" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="12"/></svg>', 2048, 1024);
check("prepare: width / height become the PNG's, a viewBox from its own size is added (so it scales, not crops); the inside is untouched",
  /<svg width="2048" height="1024" viewBox="0 0 24 12" xmlns/.test(p1) && /<rect width="24" height="12"\/>/.test(p1) && (p1.match(/width=/g) || []).length === 2, p1);
const p2 = S.prepare("<svg viewBox='0 0 10 5'><g/></svg>", 2048, 1024);
check("…a viewBox it has is kept, an xmlns added when missing (an <img> needs it)", /viewBox='0 0 10 5'/.test(p2) && !/viewBox="0 0/.test(p2) && /xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(p2), p2);
check("pngName: logo.svg -> logo.png", S.pngName("logo.svg") === "logo.png" && S.pngName("A.SVGZ") === "A.png");
const logo = fs.readFileSync(path.join(ROOT, "static", "logo.svg"), "utf8");
check("the app's own logo reads as an SVG of 1080 x 1080", S.looksSvg(logo) && JSON.stringify(S.sizeOf(logo)) === '{"w":1080,"h":1080}');
const IDX = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8"), FD = fs.readFileSync(path.join(ROOT, "static", "filedialog.js"), "utf8");
check("wired: the page loads it right after jxl.js (before any upload code)", /jxl\.js"><\/script>[^\n]*\n<script src="\/static\/svgpic\.js">/.test(IDX));
check("…the Open dialog lists .svg as an image and draws a picked one into the PNG", /"\.jxl", "\.svg"\] \}/.test(FD) && /BGSvg\.toPngFile\(f\)/.test(FD));
const A = require(path.join(ROOT, "static", "addtile.js"));
check("…the \"+ add pictures\" tiles take .svg (the server's list stays PNG / JPEG / WebP / BMP / JPEG XL)", A.kindOf("logo.svg") === "images" && /\.svg/.test(A.accept("images")) && !/\.svg/.test(A.accept("video")) && !A.EXTS.images.includes(".svg"));
const core = fs.readFileSync(path.join(ROOT, "lib", "core.js"), "utf8");
check("the server never stores an SVG (nothing after the upload reads one)", !/PKINDS = \{[^}]*\.svg/.test(core));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
