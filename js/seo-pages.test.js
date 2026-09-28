const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SITE,
  DESC_MIN,
  DESC_MAX,
  TITLE_MIN,
  TITLE_MAX,
  textLength,
  isFreeLesson,
  normalizeLevels,
  lessonSeoTitle,
  lessonSeoDescription,
  keyPages,
  buildLessonPage,
  buildSitemap,
  buildRobots,
  readLessons,
  sourceLastmod,
  checkAll,
} = require("./seo-pages.js");

const root = path.resolve(__dirname, "..");
const payload = readLessons(root);
const levels = normalizeLevels(payload);

test("every lesson gets a Chinese title and description in range", () => {
  assert.equal(levels.reduce((sum, level) => sum + level.lessons.length, 0), 82);
  for (const level of levels) {
    for (const lesson of level.lessons) {
      const title = lessonSeoTitle(lesson);
      const description = lessonSeoDescription(lesson, level.id);
      assert.ok(textLength(title) >= TITLE_MIN && textLength(title) <= TITLE_MAX, title);
      assert.ok(textLength(description) >= DESC_MIN && textLength(description) <= DESC_MAX, description);
      assert.match(title, new RegExp(`第${lesson.number}课`));
      assert.match(description, new RegExp(`第${lesson.number}课`));
      assert.match(title, /[\u4e00-\u9fff]/);
      assert.match(description, /慢速英语|中英对照/);
      const subtitle = String(lesson.subtitle || "");
      if (subtitle) {
        assert.ok(title.includes(Array.from(subtitle).slice(0, 6).join("")), title);
        assert.ok(description.includes("「"), description);
      }
    }
  }
});

test("free trial stays Level 1 lessons 1 through 5", () => {
  for (const level of levels) {
    for (const lesson of level.lessons) {
      const free = level.id === "lle1" && lesson.number <= 5;
      assert.equal(isFreeLesson(lesson), free, lesson.id);
    }
  }
});

test("locked lesson HTML keeps the paywall meaningful", () => {
  const level = levels.find((item) => item.id === "lle1");
  const lesson = level.lessons.find((item) => item.id === "lle1-06");
  const html = buildLessonPage(level, lesson, level.lessons[4], level.lessons[6]);
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /<h1 id="lesson-title">/);
  assert.match(html, /<meta name="description"/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/lessons/lle1-06.html"`));
  assert.match(html, /property="og:title"/);
  assert.match(html, /"@type":"LearningResource"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.doesNotMatch(html, /akamaized/);
  assert.doesNotMatch(html, /id="lesson-data"/);
  assert.doesNotMatch(html, new RegExp(lesson.quiz[0].prompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /课文节选/);
  assert.match(html, new RegExp(lesson.dialogue[0].zh));
  assert.match(html, /href="lle1-05\.html"/);
  assert.match(html, /href="lle1-07\.html"/);
  assert.match(html, /href="\.\.\/pricing\.html"/);
  assert.doesNotMatch(html, /去开通<\/a>\s*\n\s*<a class="btn primary" href="lle1/);
});

test("free lesson HTML includes dialogue and does not preload the video", () => {
  const level = levels[0];
  const lesson = level.lessons[0];
  const html = buildLessonPage(level, lesson, null, level.lessons[1]);
  assert.match(html, /type="module" src="\.\.\/js\/study\.js"/);
  assert.match(html, /type="module" src="\.\.\/js\/unlock\.js"/);
  assert.match(html, /preload="none"/);
  assert.match(html, /poster="\.\.\/img\/poster\.svg"/);
  assert.match(html, new RegExp(lesson.dialogue[0].zh));
  assert.match(html, /id="lesson-data"/);
  assert.match(html, /akamaized/);
  assert.doesNotMatch(html, /课文节选/);
  assert.match(html, /href="lle1-02\.html"/);
});

test("sitemap lists the home page, key pages, and all lessons", () => {
  const xml = buildSitemap(levels, "2026-09-05");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locs.length, 86);
  assert.equal(new Set(locs).size, locs.length);
  assert.ok(locs.includes(`${SITE}/`));
  assert.ok(locs.includes(`${SITE}/progress.html`));
  assert.ok(locs.includes(`${SITE}/wrongbook.html`));
  assert.ok(locs.includes(`${SITE}/pricing.html`));
  assert.ok(locs.includes(`${SITE}/lessons/lle1-01.html`));
  assert.ok(locs.includes(`${SITE}/lessons/lle1-52.html`));
  assert.ok(locs.includes(`${SITE}/lessons/lle2-30.html`));
  assert.equal([...xml.matchAll(/<lastmod>/g)].length, locs.length);
});

test("robots.txt allows crawling and names the sitemap", () => {
  const robots = buildRobots();
  assert.match(robots, /Allow: \//);
  assert.match(robots, new RegExp(`Sitemap: ${SITE}/sitemap.xml`));
  assert.doesNotMatch(robots, /Disallow: \//);
});

test("key pages use Simplified Chinese titles and descriptions", () => {
  for (const page of keyPages()) {
    assert.match(page.title, /[\u4e00-\u9fff]/);
    assert.ok(textLength(page.description) >= DESC_MIN && textLength(page.description) <= DESC_MAX);
    assert.ok(page.loc.startsWith(SITE));
  }
});

test("site root resolves GitHub project pages and local lesson urls", () => {
  const source = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  const body = source.match(/function siteRoot\(\) \{([\s\S]*?)\n\}/)[1].replace(
    "const path = window.location.pathname;",
    "const path = input;"
  );
  const siteRoot = new Function("input", body);
  assert.equal(siteRoot("/wx-extract-mvp/lessons/lle1-01.html"), "/wx-extract-mvp/");
  assert.equal(siteRoot("/wx-extract-mvp/index.html"), "/wx-extract-mvp/");
  assert.equal(siteRoot("/wx-extract-mvp/"), "/wx-extract-mvp/");
  assert.equal(siteRoot("/wx-extract-mvp"), "/wx-extract-mvp/");
  assert.equal(siteRoot("/lessons/lle2-30.html"), "/");
  assert.equal(siteRoot("/progress.html"), "/");
  assert.equal(siteRoot("/"), "/");
});

test("legacy lesson.html redirects old id links and is noindex", () => {
  const html = fs.readFileSync(path.join(root, "lesson.html"), "utf8");
  assert.match(html, /lessons\/" \+ id \+ "\.html"/);
  assert.match(html, /noindex/);
  assert.match(html, /lle\[12\]-\\d\{2\}/);
});

test("generated pages and sitemap match data/lessons.json", () => {
  const problems = checkAll(root);
  assert.deepEqual(problems, [], problems.slice(0, 8).join("\n"));
  assert.match(sourceLastmod(root), /^\d{4}-\d{2}-\d{2}$/);
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/web/catalog.json"), "utf8"));
  assert.equal(JSON.stringify(catalog).includes("dialogue"), false);
  assert.equal(JSON.stringify(catalog).includes("videoUrl"), false);
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(index, /rel="canonical"/);
  assert.match(index, /lessons\/lle2-30\.html/);
  assert.equal(index.includes("data/lessons.json"), false);
});
