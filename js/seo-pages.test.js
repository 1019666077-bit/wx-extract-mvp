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
  HANS,
  loadWaffoLinks,
  waffoPlansHtml,
  returnStatusHtml,
  buildPaymentConfigScript,
  sourceLastmod,
  checkAll,
  HANT,
  convertToHant,
  switcherHref,
  OVERRIDES,
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
      assert.match(description, /慢速英文|中英对照|中英字幕/);
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
  assert.match(html, /hreflang="zh-Hans"/);
  assert.match(html, /hreflang="zh-Hant"/);
  assert.match(html, /hreflang="x-default"/);
  assert.match(html, /data-script="zh-Hant"/);
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
  assert.equal(locs.length, 181);
  assert.equal(new Set(locs).size, locs.length);
  assert.ok(locs.includes(`${SITE}/`));
  assert.ok(locs.includes(`${SITE}/progress.html`));
  assert.ok(locs.includes(`${SITE}/wrongbook.html`));
  assert.ok(locs.includes(`${SITE}/pricing.html`));
  assert.ok(locs.includes(`${SITE}/lessons/lle1-01.html`));
  assert.ok(locs.includes(`${SITE}/lessons/lle1-52.html`));
  assert.ok(locs.includes(`${SITE}/lessons/lle2-30.html`));
  assert.ok(locs.includes(`${SITE}/zh-hant/`));
  assert.ok(locs.includes(`${SITE}/zh-hant/lessons/lle1-01.html`));
  assert.ok(locs.includes(`${SITE}/zh-hant/lessons/lle2-30.html`));
  assert.ok(locs.includes(`${SITE}/terms.html`));
  assert.ok(locs.includes(`${SITE}/zh-hant/privacy.html`));
  assert.ok(locs.includes(`${SITE}/en/refund.html`));
  assert.equal([...xml.matchAll(/<lastmod>/g)].length, locs.length);
  assert.equal([...xml.matchAll(/hreflang="zh-Hant"/g)].length, locs.length);
  assert.equal([...xml.matchAll(/hreflang="x-default"/g)].length, locs.length);
  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
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
  assert.equal(siteRoot("/wx-extract-mvp/zh-hant/lessons/lle1-01.html"), "/wx-extract-mvp/");
  assert.equal(siteRoot("/wx-extract-mvp/zh-hant/index.html"), "/wx-extract-mvp/");
  assert.equal(siteRoot("/wx-extract-mvp/zh-hant/"), "/wx-extract-mvp/");
  assert.equal(siteRoot("/wx-extract-mvp/zh-hant"), "/wx-extract-mvp/");
  assert.equal(siteRoot("/zh-hant/lessons/lle1-06.html"), "/");
  assert.equal(siteRoot("/zh-hant/progress.html"), "/");
  assert.equal(siteRoot("/zh-hant/"), "/");
  assert.equal(siteRoot("/zh-hant"), "/");
  assert.equal(siteRoot("/pricing.html"), "/");
  assert.equal(siteRoot("/pricing-return.html"), "/");
  assert.equal(siteRoot("/zh-hant/pricing.html"), "/");
  assert.equal(siteRoot("/zh-hant/pricing-return.html"), "/");
  assert.equal(siteRoot("/wx-extract-mvp/pricing-return.html"), "/wx-extract-mvp/");
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
  const hantIndex = fs.readFileSync(path.join(root, "zh-hant/index.html"), "utf8");
  assert.match(hantIndex, /lang="zh-Hant"/);
  assert.match(hantIndex, /lessons\/lle2-30\.html/);
  assert.match(hantIndex, /data-script="zh-Hans"/);
  const hantLesson = fs.readFileSync(path.join(root, "zh-hant/lessons/lle1-01.html"), "utf8");
  assert.match(hantLesson, /lang="zh-Hant"/);
  assert.doesNotMatch(hantLesson, /lang="zh-CN"/);
});

test("Traditional pages mirror Simplified urls and keep English lesson text", () => {
  const level = levels[0];
  const lesson = level.lessons[0];
  const html = buildLessonPage(level, lesson, null, level.lessons[1], HANT);
  assert.match(html, /lang="zh-Hant"/);
  assert.match(html, new RegExp(`canonical" href="${SITE}/zh-hant/lessons/lle1-01.html"`));
  assert.match(html, new RegExp(`hreflang="zh-Hans" href="${SITE}/lessons/lle1-01.html"`));
  assert.match(html, new RegExp(`hreflang="x-default" href="${SITE}/lessons/lle1-01.html"`));
  assert.match(html, /href="\.\.\/\.\.\/css\/styles\.css"/);
  assert.match(html, /href="\.\.\/pricing\.html"/);
  assert.match(html, /href="\.\.\/\.\.\/lessons\/lle1-01\.html"/);
  assert.match(html, new RegExp(lesson.dialogue[0].en));
  assert.match(html, new RegExp(lesson.subtitle));
  assert.doesNotMatch(html, new RegExp(lesson.dialogue[0].zh));
  assert.match(html, /課/);
  const locked = level.lessons.find((item) => item.id === "lle1-06");
  const lockedHtml = buildLessonPage(level, locked, level.lessons[4], level.lessons[6], HANT);
  assert.doesNotMatch(lockedHtml, /akamaized/);
  assert.doesNotMatch(lockedHtml, /id="lesson-data"/);
  assert.match(lockedHtml, /課文節選/);
  const stored = JSON.parse(fs.readFileSync(path.join(root, "data/web/zh-hant/lessons/lle1-01.json"), "utf8"));
  assert.equal(stored.dialogue[0].en, lesson.dialogue[0].en);
  assert.notEqual(stored.dialogue[0].zh, lesson.dialogue[0].zh);
  assert.equal(stored.videoUrl, lesson.videoUrl);
});

test("script switcher links the same page in the other script", () => {
  assert.equal(switcherHref("zh-Hans", "zh-Hant", "lessons/lle1-01.html"), "../zh-hant/lessons/lle1-01.html");
  assert.equal(switcherHref("zh-Hant", "zh-Hans", "lessons/lle1-01.html"), "../../lessons/lle1-01.html");
  assert.equal(switcherHref("zh-Hans", "zh-Hans", "lessons/lle1-01.html"), "lle1-01.html");
  assert.equal(switcherHref("zh-Hans", "zh-Hant", "index.html"), "zh-hant/index.html");
  assert.equal(switcherHref("zh-Hant", "zh-Hans", "progress.html"), "../progress.html");
  assert.equal(switcherHref("zh-Hant", "zh-Hant", "index.html"), "index.html");
  assert.equal(switcherHref("zh-Hans", "zh-Hant", "pricing.html"), "zh-hant/pricing.html");
});

test("OpenCC Taiwan phrases keep English and apply the override list", () => {
  assert.equal(convertToHant("Hello, I'm Anna!"), "Hello, I'm Anna!");
  assert.equal(convertToHant("课文视频与脚本来自"), "課文影片與腳本來自");
  assert.equal(convertToHant("属于公有领域"), "屬於公共領域");
  assert.equal(convertToHant("点击播放"), "點擊播放");
  assert.equal(convertToHant("我爱互联网"), "我愛網路");
  assert.equal(convertToHant("打开打卡页"), "打開打卡頁");
  assert.ok(OVERRIDES.length >= 4);
});

test("site origin comes only from site.config.json", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"));
  assert.equal(SITE, config.origin.replace(/\/+$/, ""));
  const host = new URL(SITE).host;
  for (const rel of ["js/seo-pages.js", "js/app.js", "js/messages.js"]) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.equal(source.includes(host), false, rel);
  }
  const lesson = buildLessonPage(levels[0], levels[0].lessons[0], null, levels[0].lessons[1], undefined, "https://lessons.example");
  assert.match(lesson, /https:\/\/lessons\.example\/lessons\/lle1-01\.html/);
  assert.match(lesson, /hreflang="zh-Hant" href="https:\/\/lessons\.example\/zh-hant\/lessons\/lle1-01\.html"/);
  assert.doesNotMatch(lesson, /github\.io/);
  const robots = buildRobots("https://lessons.example");
  assert.match(robots, /Sitemap: https:\/\/lessons\.example\/sitemap\.xml/);
  assert.match(robots, /https:\/\/lessons\.example\/robots\.txt/);
  assert.doesNotMatch(robots, /github\.io/);
  const sitemap = buildSitemap(levels, "2026-09-05", "https://lessons.example");
  assert.match(sitemap, /https:\/\/lessons\.example\/zh-hant\/lessons\/lle1-01\.html/);
  assert.doesNotMatch(sitemap, /github\.io/);
  const pagesOrigin = "https://lle-learn.pages.dev";
  const pagesLesson = buildLessonPage(levels[0], levels[0].lessons[0], null, levels[0].lessons[1], undefined, pagesOrigin);
  assert.match(pagesLesson, /https:\/\/lle-learn\.pages\.dev\/lessons\/lle1-01\.html/);
  assert.match(pagesLesson, /hreflang="zh-Hant" href="https:\/\/lle-learn\.pages\.dev\/zh-hant\/lessons\/lle1-01\.html"/);
  assert.doesNotMatch(pagesLesson, /wx-extract-mvp/);
  const pagesSitemap = buildSitemap(levels, "2026-09-05", pagesOrigin);
  assert.match(pagesSitemap, /https:\/\/lle-learn\.pages\.dev\/zh-hant\/lessons\/lle1-01\.html/);
  assert.doesNotMatch(pagesSitemap, /wx-extract-mvp/);
  const pagesRobots = buildRobots(pagesOrigin);
  assert.match(pagesRobots, /Sitemap: https:\/\/lle-learn\.pages\.dev\/sitemap\.xml/);
  assert.match(pagesRobots, /域名根/);
  assert.doesNotMatch(pagesRobots, /wx-extract-mvp/);
  const hostRootRobots = `${new URL(SITE).origin}/robots.txt`;
  for (const rel of ["sitemap.xml", "robots.txt", "index.html", "zh-hant/index.html", "lessons/lle1-01.html", "zh-hant/lessons/lle1-06.html"]) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    assert.equal(text.includes(SITE), true, rel);
    const urls = text.match(/https?:\/\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/g) || [];
    for (const url of urls) {
      if (!url.includes(host)) {
        continue;
      }
      const allowed = url.startsWith(SITE) || url === hostRootRobots;
      assert.equal(allowed, true, `${rel} has ${url}`);
    }
  }
});

test("empty Waffo links render disabled soon buttons", () => {
  assert.deepEqual(loadWaffoLinks(root), {
    monthlyUrl: "",
    quarterlyUrl: "",
    returnUrl: "",
    workerBaseUrl: "",
    unlockPublicKey: "",
    monthlyProductId: "",
    quarterlyProductId: "",
    domainVerify: "",
  });
  assert.equal(
    buildPaymentConfigScript(loadWaffoLinks(root)),
    'window.VOA_PAYMENT={"workerBaseUrl":"","unlockPublicKey":"","monthlyProductId":"","quarterlyProductId":""};\n'
  );
  assert.equal(convertToHant("即将开放"), "即將開放");
  const { MESSAGES, buildI18nScript } = require("./messages.js");
  assert.equal(MESSAGES.recoverFailed, "订单号或邮箱不匹配，或该订单无法找回");
  assert.match(buildI18nScript(convertToHant), /訂單號或郵箱不匹配，或該訂單無法找回/);
  assert.match(fs.readFileSync(path.join(root, "pricing.html"), "utf8"), /id="recover-form"/);
  assert.match(fs.readFileSync(path.join(root, "pricing-return.html"), "utf8"), /id="recover-form"/);
  assert.match(fs.readFileSync(path.join(root, "zh-hant/pricing.html"), "utf8"), /找回開通/);
  const terms = fs.readFileSync(path.join(root, "terms.html"), "utf8");
  const termsHant = fs.readFileSync(path.join(root, "zh-hant/terms.html"), "utf8");
  const termsEn = fs.readFileSync(path.join(root, "en/terms.html"), "utf8");
  assert.match(terms, /待幕僚长确认/);
  assert.match(termsHant, /待幕僚長確認/);
  assert.match(termsEn, /待幕僚长确认/);
  assert.doesNotMatch(terms, /生效日期/);
  assert.doesNotMatch(termsEn, /Effective date/i);
  assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8").includes('name="waffo-verify"'), false);
  assert.match(fs.readFileSync(path.join(root, "zh-hant/pricing-return.html"), "utf8"), /id="recover-form"/);
  const hans = waffoPlansHtml(HANS, { monthlyUrl: "", quarterlyUrl: "" });
  const hant = waffoPlansHtml(HANT, { monthlyUrl: "", quarterlyUrl: "   " });
  assert.equal((hans.match(/<button type="button" class="btn waffo-pay" disabled>即将开放<\/button>/g) || []).length, 2);
  assert.equal((hant.match(/<button type="button" class="btn waffo-pay" disabled>即將開放<\/button>/g) || []).length, 2);
  assert.match(hans, /US\$5\.99/);
  assert.match(hans, /US\$13\.99/);
  assert.match(hans, /30 天/);
  assert.match(hant, /90 天/);
  assert.doesNotMatch(hans, /href=/);
  assert.doesNotMatch(hant, /href=/);
  const hansPage = fs.readFileSync(path.join(root, "pricing.html"), "utf8");
  const hantPage = fs.readFileSync(path.join(root, "zh-hant/pricing.html"), "utf8");
  assert.match(hansPage, /disabled>即将开放</);
  assert.match(hantPage, /disabled>即將開放</);
  assert.doesNotMatch(hansPage, /15232188653/);
  assert.doesNotMatch(hantPage, /15232188653/);
  assert.doesNotMatch(hansPage, /微信|¥39|¥99/);
  assert.doesNotMatch(hantPage, /微信|¥39|¥99/);
  assert.match(hansPage, /US\$5\.99/);
  assert.match(hantPage, /US\$13\.99/);
  assert.doesNotMatch(hansPage, /¥39/);
  assert.doesNotMatch(hantPage, /href=""/);
  assert.doesNotMatch(hantPage, /href="#"/);
  assert.doesNotMatch(hansPage, /class="btn waffo-pay"[^>]*href/);
});

test("worker config enables checkout buttons without a static href", () => {
  const html = waffoPlansHtml(HANS, {
    workerBaseUrl: "https://pay.example",
    unlockPublicKey: "A".repeat(44),
    monthlyProductId: "PROD_monthly",
    quarterlyProductId: "PROD_quarterly",
  });
  const missingProduct = waffoPlansHtml(HANS, {
    workerBaseUrl: "https://pay.example",
    unlockPublicKey: "A".repeat(44),
  });
  assert.match(missingProduct, /disabled>即将开放</);
  assert.match(html, /data-plan="monthly"/);
  assert.match(html, /data-plan="quarterly"/);
  assert.match(html, /用 Waffo 支付 US\$5\.99/);
  assert.match(html, /用 Waffo 支付 US\$13\.99/);
  assert.doesNotMatch(html, /disabled/);
  assert.doesNotMatch(html, /即将开放/);
  assert.doesNotMatch(html, /href=/);
  assert.doesNotMatch(html, /github\.io/);
  const staticOnly = waffoPlansHtml(HANS, {
    monthlyUrl: "https://pay.example/waffo/monthly",
    quarterlyUrl: "https://pay.example/waffo/quarterly",
  });
  assert.match(staticOnly, /disabled>即将开放</);
  assert.doesNotMatch(staticOnly, /href=/);
  const level = levels.find((item) => item.id === "lle1");
  const lesson = level.lessons.find((item) => item.id === "lle1-06");
  const locked = buildLessonPage(level, lesson, level.lessons[4], level.lessons[6]);
  assert.match(locked, /Waffo/);
  assert.match(locked, /US\$5\.99/);
  assert.match(locked, /US\$13\.99/);
  assert.doesNotMatch(locked, /15232188653|微信|¥39|输入兑换码/);
  assert.match(locked, /自动开通/);
  const lockedHant = buildLessonPage(level, lesson, level.lessons[4], level.lessons[6], HANT);
  assert.match(lockedHant, /Waffo/);
  assert.match(lockedHant, /自動開通/);
  assert.doesNotMatch(lockedHant, /15232188653|微信/);
});

test("return page stays unpublished until payment.waffo.returnUrl is set", () => {
  const links = loadWaffoLinks(root);
  assert.equal(links.returnUrl, "");
  const hans = returnStatusHtml(HANS, links);
  const hant = returnStatusHtml(HANT, links);
  assert.match(hans, /data-live="false"/);
  assert.match(hans, /不会解锁课程/);
  assert.match(hant, /不會解鎖課程/);
  assert.doesNotMatch(hans, /微信|15232188653/);
  const live = "https://pay.example/return";
  const opened = returnStatusHtml(HANS, { returnUrl: live });
  assert.match(opened, /data-live="true"/);
  assert.match(opened, /自动开通/);
  const xml = buildSitemap(levels, "2026-09-05");
  assert.equal([...xml.matchAll(/<loc>/g)].length, 181);
  assert.doesNotMatch(xml, /pricing-return\.html/);
  const listed = buildSitemap(levels, "2026-09-05", "https://lessons.example", {
    returnUrl: "https://lessons.example/pricing-return.html",
  });
  assert.match(listed, /https:\/\/lessons\.example\/pricing-return\.html/);
  assert.match(listed, /https:\/\/lessons\.example\/zh-hant\/pricing-return\.html/);
  const page = fs.readFileSync(path.join(root, "pricing-return.html"), "utf8");
  const hantPage = fs.readFileSync(path.join(root, "zh-hant/pricing-return.html"), "utf8");
  assert.match(page, /name="robots" content="noindex"/);
  assert.match(hantPage, /name="robots" content="noindex"/);
  assert.match(page, /data-live="false"/);
  assert.doesNotMatch(page, /15232188653|微信|¥39/);
  assert.doesNotMatch(hantPage, /15232188653|微信|¥39/);
  for (const rel of ["js/app.js", "js/messages.js", "js/i18n.js", "index.html", "zh-hant/index.html"]) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    assert.equal(text.includes("15232188653"), false, rel);
    assert.equal(text.includes("微信"), false, rel);
  }
});

test("study state keys stay shared between scripts", () => {
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(app, /const PROGRESS_KEY = "voa-lle-progress"/);
  assert.match(app, /const SCRIPT_PREF_KEY = "voa-lle-script"/);
  assert.match(app, /function pagePath\(relative\)/);
  assert.match(app, /data\/web\/zh-hant\//);
  assert.match(app, /pagePath\(`lessons\//);
  assert.doesNotMatch(app, /voa-lle-progress-hant/);
  const unlock = fs.readFileSync(path.join(root, "js/unlock.js"), "utf8");
  assert.match(unlock, /voa-lle-unlock/);
  const study = fs.readFileSync(path.join(root, "js/study.js"), "utf8");
  assert.match(study, /voa-lle-checkins/);
  assert.match(study, /voa-lle-wrongbook/);
});
