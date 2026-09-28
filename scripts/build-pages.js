#!/usr/bin/env node
// Generate crawlable lesson pages, sitemap.xml, and robots.txt.
// Usage:
//   node scripts/build-pages.js
//   node scripts/build-pages.js --check
const path = require("node:path");
const { checkAll, writeAll } = require("../js/seo-pages.js");

const root = path.resolve(__dirname, "..");
const check = process.argv.includes("--check");

if (check) {
  const problems = checkAll(root);
  if (problems.length) {
    console.error(`seo pages are stale (${problems.length})`);
    for (const problem of problems.slice(0, 30)) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }
  console.log("seo pages are up to date");
} else {
  const count = writeAll(root);
  console.log(`wrote ${count} seo files`);
}
