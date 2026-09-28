const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { stageSite, PAGES_PROJECT } = require("../scripts/stage-pages.js");

const root = path.join(__dirname, "..");

test("Cloudflare Pages project name is eachsound and the workflow does not replace GitHub Pages", () => {
  assert.equal(PAGES_PROJECT, "eachsound");
  assert.equal(PAGES_PROJECT.toLowerCase().includes("voa"), false);
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/cloudflare-pages.yml"), "utf8");
  assert.match(workflow, /pages deploy dist --project-name=eachsound/);
  assert.doesNotMatch(workflow, /lle-learn/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /branches: \[main\]/);
  assert.doesNotMatch(workflow, /peaceiris|actions\/upload-pages-artifact|github-pages/);
  const names = fs.readdirSync(path.join(root, ".github/workflows")).sort();
  assert.deepEqual(names, ["cloudflare-pages.yml", "cloudflare-worker.yml"]);
  const workerFlow = fs.readFileSync(path.join(root, ".github/workflows/cloudflare-worker.yml"), "utf8");
  assert.match(workerFlow, /workflow_dispatch/);
  assert.doesNotMatch(workerFlow, /push:/);
  assert.match(workerFlow, /workingDirectory: worker/);
  assert.match(workerFlow, /command: deploy/);
  assert.doesNotMatch(workerFlow, /run:.*secret put/);
  const wrangler = fs.readFileSync(path.join(root, "worker/wrangler.toml"), "utf8");
  assert.match(wrangler, /name = "voa-lle-unlock"/);
  assert.match(wrangler, /id = "84110c8900934ac6abe4841117e9d8a3"/);
  assert.match(wrangler, /preview_id = "49aac2630d6b4030bbbd739bcbe707eb"/);
  assert.doesNotMatch(wrangler, /replace_me/);
});

test("staged site is served from the domain root and omits the Worker and miniprogram", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "lle-pages-"));
  stageSite(root, dest);
  assert.equal(fs.existsSync(path.join(dest, "index.html")), true);
  assert.equal(fs.existsSync(path.join(dest, "terms.html")), true);
  assert.equal(fs.existsSync(path.join(dest, "en/terms.html")), true);
  assert.equal(fs.existsSync(path.join(dest, "zh-hant/privacy.html")), true);
  assert.equal(fs.existsSync(path.join(dest, "zh-hant/index.html")), true);
  assert.equal(fs.existsSync(path.join(dest, "zh-hant/lessons/lle1-01.html")), true);
  assert.equal(fs.existsSync(path.join(dest, "robots.txt")), true);
  assert.equal(fs.existsSync(path.join(dest, "sitemap.xml")), true);
  assert.equal(fs.existsSync(path.join(dest, "_headers")), true);
  assert.equal(fs.existsSync(path.join(dest, "_redirects")), true);
  assert.equal(fs.existsSync(path.join(dest, "css/styles.css")), true);
  assert.equal(fs.existsSync(path.join(dest, "js/app.js")), true);
  assert.equal(fs.existsSync(path.join(dest, "js/app.test.js")), false);
  assert.equal(fs.existsSync(path.join(dest, "worker")), false);
  assert.equal(fs.existsSync(path.join(dest, "miniprogram")), false);
  assert.equal(fs.existsSync(path.join(dest, "docs")), false);
  const lesson = fs.readFileSync(path.join(dest, "zh-hant/lessons/lle1-01.html"), "utf8");
  assert.match(lesson, /href="\.\.\/\.\.\/css\/styles\.css"/);
  assert.doesNotMatch(lesson, /\/wx-extract-mvp\/css\//);
  const hans = fs.readFileSync(path.join(dest, "lessons/lle1-01.html"), "utf8");
  assert.match(hans, /href="\.\.\/css\/styles\.css"/);
  fs.rmSync(dest, { recursive: true, force: true });
});

test("Pages headers and legacy lesson redirects are present", () => {
  const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /Cache-Control: public, max-age=0, must-revalidate/);
  assert.match(headers, /\/css\/\*[\s\S]*! Cache-Control/);
  const redirects = fs.readFileSync(path.join(root, "_redirects"), "utf8");
  assert.match(redirects, /^\/lesson\.html\?id=:id \/lessons\/:id\.html 301$/m);
  assert.match(redirects, /^\/zh-hant\/lesson\.html\?id=:id \/zh-hant\/lessons\/:id\.html 301$/m);
});

test("runtime sources do not hardcode the GitHub project subpath", () => {
  for (const rel of [
    "js/app.js",
    "js/seo-pages.js",
    "js/messages.js",
    "js/unlock.js",
    "js/payment-client.js",
    "worker/src/app.js",
    "worker/src/waffo.js",
  ]) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    assert.equal(text.includes("wx-extract-mvp"), false, rel);
  }
});
