#!/usr/bin/env node
// Copy the static site into dist/ for `wrangler pages deploy`.
// GitHub Pages keeps publishing the repository root and does not use dist/.
const fs = require("node:fs");
const path = require("node:path");

const PAGES_PROJECT = "lle-learn";

const ROOT_FILES = [
  "index.html",
  "pricing.html",
  "pricing-return.html",
  "progress.html",
  "wrongbook.html",
  "lesson.html",
  "terms.html",
  "privacy.html",
  "refund.html",
  "sitemap.xml",
  "robots.txt",
  "_headers",
  "_redirects",
];

const DIRS = ["css", "img", "lessons", "zh-hant", "data", "en"];

function copyTree(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

function copySiteJs(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (name.endsWith(".test.js")) {
      continue;
    }
    const from = path.join(src, name);
    if (!fs.statSync(from).isFile()) {
      continue;
    }
    fs.copyFileSync(from, path.join(dest, name));
  }
}

function stageSite(root, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const name of ROOT_FILES) {
    fs.copyFileSync(path.join(root, name), path.join(dest, name));
  }
  for (const dir of DIRS) {
    copyTree(path.join(root, dir), path.join(dest, dir));
  }
  copySiteJs(path.join(root, "js"), path.join(dest, "js"));
  return dest;
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const dest = stageSite(root, path.join(root, "dist"));
  console.log(`staged ${dest} for Cloudflare Pages project ${PAGES_PROJECT}`);
}

module.exports = { stageSite, PAGES_PROJECT, ROOT_FILES };
