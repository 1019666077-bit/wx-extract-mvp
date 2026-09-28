const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const VOAUnlock = require("./unlock.js");

const SITE = "https://1019666077-bit.github.io/wx-extract-mvp";
const TITLE_MIN = 16;
const TITLE_MAX = 34;
const DESC_MIN = 70;
const DESC_MAX = 120;

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230b6e4f'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-size='16' fill='white' font-family='sans-serif'%3EV%3C/text%3E%3C/svg%3E";

/**
 * Paywall choice for generated HTML:
 * Free lessons (Level 1 lessons 1–5) ship the dialogue, quiz prompts, and
 * video URL in the page so crawlers and no-JS visitors see a real lesson.
 * Locked lessons ship only the Chinese title, intro, and the first two
 * dialogue lines. Video URL, remaining lines, and quiz prompts stay out of
 * the HTML. The player still loads data/web/lessons/{id}.json after unlock.
 * Those JSON files are public, same as the old lessons.json paywall: it is a
 * UX gate, not a secret. We just stop inlining the full lesson for crawlers.
 */

function textLength(value) {
  return Array.from(String(value)).length;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function compactJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isFreeLesson(lesson) {
  return VOAUnlock.isFreeTrialLesson(lesson);
}

function levelNumber(levelId, lesson) {
  if (Number.isFinite(Number(lesson.level))) {
    return Number(lesson.level);
  }
  return levelId === "lle2" ? 2 : 1;
}

function normalizeLevels(payload) {
  const levels = Array.isArray(payload.levels) ? payload.levels : [];
  return levels.map((level) => ({
    id: level.id,
    title: level.title || level.id,
    lessons: (Array.isArray(level.lessons) ? level.lessons : []).map((lesson) => ({
      ...lesson,
      level: levelNumber(level.id, lesson),
    })),
  }));
}

function lessonSeoTitle(lesson) {
  const prefix = `VOA慢速英语第${lesson.number}课`;
  const subtitle = String(lesson.subtitle || "").trim();
  if (!subtitle) {
    return `${prefix} 中英对照听力`;
  }
  const withSuffix = `${prefix} ${subtitle}｜中英听力`;
  if (textLength(withSuffix) <= TITLE_MAX) {
    return withSuffix;
  }
  const plain = `${prefix} ${subtitle}`;
  if (textLength(plain) <= TITLE_MAX) {
    return plain;
  }
  const budget = TITLE_MAX - textLength(`${prefix} …`);
  const trimmed = Array.from(subtitle).slice(0, Math.max(budget, 1)).join("");
  return `${prefix} ${trimmed}…`;
}

function lessonSeoDescription(lesson, levelId) {
  const free = isFreeLesson(lesson);
  const levelName = levelId === "lle2" ? "Level 2" : "Level 1";
  const subtitle = String(lesson.subtitle || lesson.title || "").trim();
  const access = free ? "本课免费试学。" : "开通后可看完整视频与测验。";
  const templates = [
    `VOA Let's Learn English ${levelName} 第${lesson.number}课「${subtitle}」。慢速英语听力，带中英对照字幕，适合中文学习者跟读自学。${access}`,
    `VOA慢速英语 ${levelName} 第${lesson.number}课「${subtitle}」。中英对照听力字幕，适合中文学习者跟读自学。${access}`,
    `VOA Let's Learn English 第${lesson.number}课「${subtitle}」。慢速英语听力配中英对照字幕，适合自学跟读。${access}`,
  ];
  for (const text of templates) {
    const len = textLength(text);
    if (len >= DESC_MIN && len <= DESC_MAX) {
      return text;
    }
  }
  const shortLead = `VOA慢速英语${levelName}第${lesson.number}课「`;
  const shortTail = `」。中英对照听力字幕，适合跟读自学。${access}`;
  const room = DESC_MAX - textLength(shortLead) - textLength(shortTail) - 1;
  const trimmed = `${Array.from(subtitle).slice(0, Math.max(room, 4)).join("")}…`;
  let text = `${shortLead}${trimmed}${shortTail}`;
  if (textLength(text) < DESC_MIN) {
    text = `VOA Let's Learn English ${levelName} 第${lesson.number}课「${subtitle}」。跟读慢速英语听力，看中英对照字幕，并完成课后小测验。${access}适合每天学一点。`;
  }
  if (textLength(text) > DESC_MAX) {
    text = `${Array.from(text).slice(0, DESC_MAX - 1).join("")}…`;
  }
  return text;
}

function keyPages() {
  return [
    {
      id: "home",
      file: "index.html",
      loc: `${SITE}/`,
      title: "VOA慢速英语自学｜Let's Learn English 听力",
      description:
        "VOA Let's Learn English 慢速英语听力课表，中英对照字幕加小测验。Level 1 与 Level 2 共 82 课，适合中文学习者自学，前 5 课免费试学。",
      ogType: "website",
      priority: "1.0",
    },
    {
      id: "progress",
      file: "progress.html",
      loc: `${SITE}/progress.html`,
      title: "VOA慢速英语打卡日历｜Let's Learn English",
      description:
        "用打卡日历记下 VOA Let's Learn English 学习天数。提交任意一课测验即完成当日打卡，连续天数按北京时间计算，方便坚持慢速英语。",
      ogType: "website",
      priority: "0.6",
    },
    {
      id: "wrongbook",
      file: "wrongbook.html",
      loc: `${SITE}/wrongbook.html`,
      title: "VOA慢速英语错题本｜Let's Learn English",
      description:
        "把 VOA Let's Learn English 测验里错过的题收进错题本。按课程归类复习，答对后自动移除，方便对照中英字幕补上慢速英语听力。",
      ogType: "website",
      priority: "0.6",
    },
    {
      id: "pricing",
      file: "pricing.html",
      loc: `${SITE}/pricing.html`,
      title: "开通 VOA Let's Learn English 慢速英语",
      description:
        "Level 1 第 1–5 课免费试学。开通后解锁 VOA Let's Learn English 已上线的全部慢速英语课，含 Level 1、Level 2 的中英对照听力与测验。",
      ogType: "website",
      priority: "0.5",
    },
  ];
}

function assertCopy(label, text, min, max) {
  const len = textLength(text);
  if (len < min || len > max) {
    throw new Error(`${label} length ${len} is outside ${min}-${max}: ${text}`);
  }
}

function validateCopy(levels) {
  for (const page of keyPages()) {
    assertCopy(page.id, page.description, DESC_MIN, DESC_MAX);
    assertCopy(`${page.id} title`, page.title, TITLE_MIN, 40);
  }
  for (const level of levels) {
    for (const lesson of level.lessons) {
      const title = lessonSeoTitle(lesson);
      const description = lessonSeoDescription(lesson, level.id);
      assertCopy(`${lesson.id} title`, title, TITLE_MIN, TITLE_MAX);
      assertCopy(`${lesson.id} description`, description, DESC_MIN, DESC_MAX);
      if (!title.includes(`第${lesson.number}课`)) {
        throw new Error(`${lesson.id} title missing lesson number`);
      }
      if (!description.includes(`第${lesson.number}课`)) {
        throw new Error(`${lesson.id} description missing lesson number`);
      }
    }
  }
}

function seoHead({ title, description, canonical, ogType, jsonLd }) {
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="${escapeHtml(ogType || "website")}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:site_name" content="VOA慢速英语自学" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="theme-color" content="#0b6e4f" />`,
    `<link rel="icon" href="${FAVICON}" />`,
  ];
  if (jsonLd) {
    lines.push(`<script type="application/ld+json">${compactJson(jsonLd)}</script>`);
  }
  return lines.join("\n  ");
}

function homePitch(levels) {
  const l1 = levels.find((level) => level.id === "lle1");
  const l2 = levels.find((level) => level.id === "lle2");
  const l1n = l1 ? l1.lessons.length : 0;
  const l2n = l2 ? l2.lessons.length : 0;
  return `跟读 VOA Let's Learn English：中英对照听力字幕，看课文视频，再做三道小测验。Level 1 共 ${l1n} 课，Level 2 共 ${l2n} 课。`;
}

function homeDisclaimer() {
  return "本站为非官方自学工具，与美国之音（Voice of America）没有隶属或背书关系。课文视频与脚本来自 VOA Learning English，属于公有领域。";
}

function homeJsonLd(page) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: "VOA Let's Learn English 慢速英语",
    description: page.description,
    url: page.loc,
    inLanguage: ["en", "zh-Hans"],
    provider: {
      "@type": "Organization",
      name: "VOA慢速英语自学",
      url: `${SITE}/`,
    },
    isAccessibleForFree: true,
  };
}

function neighborBrief(lesson) {
  if (!lesson) {
    return null;
  }
  return {
    id: lesson.id,
    number: lesson.number,
    level: lesson.level,
    title: lesson.title || "",
    subtitle: lesson.subtitle || "",
  };
}

function webLesson(level, lesson, prev, next) {
  return {
    id: lesson.id,
    number: lesson.number,
    level: lesson.level,
    levelId: level.id,
    title: lesson.title || "",
    subtitle: lesson.subtitle || "",
    videoUrl: lesson.videoUrl || "",
    youtubeId: lesson.youtubeId || "",
    sourceUrl: lesson.sourceUrl || "",
    attribution: lesson.attribution || "",
    dialogue: lesson.dialogue || [],
    quiz: lesson.quiz || [],
    prev: neighborBrief(prev),
    next: neighborBrief(next),
    levelLessonIds: level.lessons.map((item) => item.id),
  };
}

function dialogueHtml(lines) {
  return lines
    .map(
      (line) => `        <article class="line" data-speaker="${escapeHtml(line.speaker)}">
          <p class="speaker">${escapeHtml(line.speaker)}</p>
          <p class="en">${escapeHtml(line.en)}</p>
          <p class="zh">${escapeHtml(line.zh)}</p>
        </article>`
    )
    .join("\n");
}

function quizPreviewHtml(quiz) {
  return (quiz || [])
    .map((question, index) => {
      const choices = (question.choices || [])
        .map((choice) => `<li>${escapeHtml(choice)}</li>`)
        .join("");
      return `        <fieldset class="question">
          <legend>${index + 1}. ${escapeHtml(question.prompt)}</legend>
          <ul class="quiz-preview">${choices}</ul>
        </fieldset>`;
    })
    .join("\n");
}

function pagerLink(lesson, kind) {
  if (!lesson) {
    const label = kind === "prev" ? "已是第一课" : "已是最后一课";
    return `<span class="pager-placeholder">${label}</span>`;
  }
  const locked = !isFreeLesson(lesson);
  const text =
    kind === "prev"
      ? `← 上一课 · ${lesson.number}${locked ? "（未解锁）" : ""}`
      : `下一课 · ${lesson.number}${locked ? "（未解锁）" : ""} →`;
  const classes = ["btn"];
  if (!locked && kind === "next") {
    classes.push("primary");
  }
  if (locked) {
    classes.push("is-locked-link");
  }
  return `<a class="${classes.join(" ")}" href="${escapeHtml(lesson.id)}.html">${escapeHtml(text)}</a>`;
}

function lessonIntro(lesson, levelId) {
  const levelName = levelId === "lle2" ? "Level 2" : "Level 1";
  const subtitle = lesson.subtitle || "";
  if (isFreeLesson(lesson)) {
    return `这是 VOA Let's Learn English 慢速英语 ${levelName} 第 ${lesson.number} 课「${subtitle}」。本课可以免费试学：播放听力视频，看中英对照字幕，再做三道小测验。`;
  }
  return `这是 VOA Let's Learn English 慢速英语 ${levelName} 第 ${lesson.number} 课「${subtitle}」。下面是课题和开头两句中英对照。完整视频、对话和测验在开通后开放。`;
}

function lessonJsonLd(lesson, level, title, description, canonical) {
  const levelName = level.id === "lle2" ? "Level 2" : "Level 1";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource",
        name: title,
        description,
        url: canonical,
        inLanguage: ["en", "zh-Hans"],
        learningResourceType: "lesson",
        isAccessibleForFree: isFreeLesson(lesson),
        teaches: "English listening",
        isPartOf: {
          "@type": "Course",
          name: `VOA Let's Learn English ${levelName}`,
          url: `${SITE}/`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "课表",
            item: `${SITE}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: levelName,
            item: `${SITE}/index.html?level=${level.id}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `第${lesson.number}课 ${lesson.subtitle || ""}`.trim(),
            item: canonical,
          },
        ],
      },
    ],
  };
}

function buildLessonPage(level, lesson, prev, next) {
  const free = isFreeLesson(lesson);
  const title = lessonSeoTitle(lesson);
  const description = lessonSeoDescription(lesson, level.id);
  const canonical = `${SITE}/lessons/${lesson.id}.html`;
  const levelName = level.id === "lle2" ? "Level 2" : "Level 1";
  const backHref = `../index.html?level=${level.id}`;
  const videoBlock = free
    ? `        <video id="lesson-video" controls playsinline preload="none" poster="../img/poster.svg" src="${escapeHtml(lesson.videoUrl || "")}">
          你的浏览器不支持视频播放。
        </video>`
    : `        <video id="lesson-video" controls playsinline preload="none" poster="../img/poster.svg">
          你的浏览器不支持视频播放。
        </video>`;
  const youtube = free && lesson.youtubeId
    ? `<a id="youtube-link" href="https://www.youtube.com/watch?v=${escapeHtml(lesson.youtubeId)}" target="_blank" rel="noopener">YouTube 备用</a><span id="youtube-sep"> · </span>`
    : `<a id="youtube-link" href="#" target="_blank" rel="noopener" hidden>YouTube 备用</a><span id="youtube-sep" hidden> · </span>`;
  const sourceHref = escapeHtml(lesson.sourceUrl || "#");
  const excerpt = free
    ? ""
    : `    <section class="excerpt-section" aria-label="课文节选">
      <h2>课文节选 · 中英对照</h2>
      <p class="excerpt-note">这里只放开头两句。开通后可以看完整对话、课文视频和听力小测验。</p>
      <div class="dialogue">
${dialogueHtml((lesson.dialogue || []).slice(0, 2))}
      </div>
    </section>
    <section class="paywall-section" id="lesson-paywall" aria-label="开通后学习">
      <h2>课程未解锁</h2>
      <p>免费试学仅 Level 1 第 1–5 课。开通解锁全部已上线课程（含 Level 1 + Level 2 已发布课）。打卡日历与错题本免费使用（无需开通）。</p>
      <p>下一步：去开通页看方案，微信联系 <strong>15232188653</strong> 付款（¥39 月 / ¥99 季），获兑换码后在开通页输入解锁。</p>
      <div class="quiz-actions">
        <a class="btn primary" href="../pricing.html">去开通 · 输入兑换码</a>
        <a class="btn" href="${escapeHtml(backHref)}">返回课表</a>
      </div>
    </section>
`;
  const dialogue = free ? dialogueHtml(lesson.dialogue || []) : "";
  const quiz = free ? quizPreviewHtml(lesson.quiz || []) : "";
  const hidden = free ? "" : " hidden";
  const preconnect = free
    ? `  <link rel="preconnect" href="https://voa-video-ns.akamaized.net" crossorigin />\n`
    : "";
  const navJson = compactJson({
    levelId: level.id,
    level: lesson.level,
    prev: neighborBrief(prev),
    next: neighborBrief(next),
  });
  const dataScript = free
    ? `  <script type="application/json" id="lesson-data">${compactJson(webLesson(level, lesson, prev, next))}</script>\n`
    : "";
  const pager = `      ${pagerLink(prev, "prev")}
      ${pagerLink(next, "next")}`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  ${seoHead({
    title,
    description,
    canonical,
    ogType: "article",
    jsonLd: lessonJsonLd(lesson, level, title, description, canonical),
  })}
${preconnect}  <link rel="stylesheet" href="../css/styles.css" />
</head>
<body data-page="lesson" data-lesson-id="${escapeHtml(lesson.id)}" data-lesson-number="${escapeHtml(lesson.number)}" data-lesson-level="${escapeHtml(lesson.level)}" data-level-id="${escapeHtml(level.id)}">
  <div class="page">
    <nav class="nav" aria-label="站点">
      <a href="${escapeHtml(backHref)}" class="back-link">← ${escapeHtml(levelName)} · 课表</a>
      <div class="site-nav-inline">
        <a href="../progress.html">打卡</a>
        <a href="../wrongbook.html" data-wrongbook-count>错题本</a>
        <a href="../pricing.html" data-unlock-status>开通</a>
      </div>
    </nav>
    <header class="header">
      <p class="eyebrow">VOA 慢速英语 · 非官方自学</p>
      <h1 id="lesson-title">${escapeHtml(title.replace(/｜中英听力$/, ""))}</h1>
      <p id="lesson-subtitle" class="subtitle">${escapeHtml(levelName)} · 第${escapeHtml(lesson.number)}课</p>
      <p class="lesson-intro">${escapeHtml(lessonIntro(lesson, level.id))}</p>
    </header>
    <nav class="lesson-pager" data-lesson-pager aria-label="上下课">
${pager}
    </nav>
${excerpt}    <section class="video-section" aria-label="课文视频"${hidden}>
      <div class="video-wrap">
${videoBlock}
      </div>
      <p class="video-fallback" id="video-fallback">
        ${youtube}
        <a id="voa-page-link" href="${sourceHref}" target="_blank" rel="noopener">VOA 原文课文</a>
      </p>
    </section>
    <section class="dialogue-section" aria-label="对话"${hidden}>
      <h2>对话 · 中英对照</h2>
      <div id="dialogue" class="dialogue">
${dialogue}
      </div>
    </section>
    <section class="quiz-section" id="quiz" aria-label="练习"${hidden}>
      <h2>听力小测验</h2>
      <form id="quiz-form">
${quiz}
      </form>
      <div class="quiz-actions">
        <button type="submit" form="quiz-form" id="submit-quiz" class="btn primary">核对答案</button>
        <button type="button" id="reset-quiz" class="btn">重做</button>
      </div>
      <p id="quiz-result" class="quiz-result" role="status" aria-live="polite"></p>
    </section>
    <nav class="lesson-pager" data-lesson-pager aria-label="上下课">
${pager}
    </nav>
    <footer class="footer">
      <p id="attribution">${escapeHtml(lesson.attribution || "")}</p>
    </footer>
  </div>
  <script type="application/json" id="lesson-nav">${navJson}</script>
${dataScript}  <script type="module" src="../js/study.js"></script>
  <script type="module" src="../js/unlock.js"></script>
  <script src="../js/app.js" defer></script>
</body>
</html>
`;
}

function catalogCard(lesson) {
  const locked = !isFreeLesson(lesson);
  const href = `lessons/${lesson.id}.html`;
  const badge = locked
    ? `<p class="status-badge status-locked">未解锁</p>`
    : `<p class="status-badge status-not-started">未开始</p>`;
  const button = locked ? "开通解锁" : "开始";
  const buttonClass = locked ? "btn" : "btn primary";
  return `      <article class="lesson-card${locked ? " is-locked" : ""}" data-status="${locked ? "locked" : "not-started"}">
        <div class="lesson-card-top">
          <p class="lesson-number">Lesson ${escapeHtml(lesson.number || "")}</p>
          ${badge}
        </div>
        <h3>${escapeHtml(lesson.title || "")}</h3>
        <p class="lesson-subtitle">${escapeHtml(lesson.subtitle || "")}</p>
        <a class="${buttonClass}" href="${escapeHtml(href)}">${button}</a>
      </article>`;
}

function lessonDirectory(levels) {
  const total = levels.reduce((sum, level) => sum + level.lessons.length, 0);
  const blocks = levels
    .map((level) => {
      const label = level.id === "lle2" ? "Level 2" : "Level 1";
      const items = level.lessons
        .map(
          (lesson) =>
            `        <li><a href="lessons/${escapeHtml(lesson.id)}.html">第${escapeHtml(lesson.number)}课 ${escapeHtml(lesson.subtitle || lesson.title || "")}</a></li>`
        )
        .join("\n");
      return `    <h3>${escapeHtml(label)} · ${level.lessons.length} 课</h3>
    <ol>
${items}
    </ol>`;
    })
    .join("\n");
  return `    <h2>全部课程目录</h2>
    <p class="catalog-note">VOA Let's Learn English 慢速英语听力，中英对照字幕。共 ${total} 课，点进每一课都有单独页面。</p>
${blocks}`;
}

function buildSitemap(levels, lastmod) {
  const urls = [
    ...keyPages().map((page) => ({ loc: page.loc, priority: page.priority })),
    ...levels.flatMap((level) =>
      level.lessons.map((lesson) => ({
        loc: `${SITE}/lessons/${lesson.id}.html`,
        priority: "0.8",
      }))
    ),
  ];
  const body = urls
    .map(
      (url) => `  <url>
    <loc>${escapeHtml(url.loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${url.priority}</priority>
  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function buildRobots() {
  return `# GitHub 项目页：搜索引擎只读取域名根目录的 robots.txt
# （https://1019666077-bit.github.io/robots.txt），不会自动读取本文件。
# 请在站长平台手动提交下面的 Sitemap。
User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
}

function replaceMarked(html, name, inner) {
  const start = `<!--${name}:start-->`;
  const end = `<!--${name}:end-->`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (!pattern.test(html)) {
    throw new Error(`Missing marker ${name}`);
  }
  return html.replace(pattern, `${start}\n${inner}\n${end}`);
}

function patchSitePage(html, page, levels) {
  let next = replaceMarked(
    html,
    "seo",
    seoHead({
      title: page.title,
      description: page.description,
      canonical: page.loc,
      ogType: page.ogType,
      jsonLd: page.id === "home" ? homeJsonLd(page) : null,
    })
  );
  if (page.id !== "home") {
    return next;
  }
  next = replaceMarked(next, "home-pitch", escapeHtml(homePitch(levels)));
  next = replaceMarked(next, "home-disclaimer", escapeHtml(homeDisclaimer()));
  const level1 = levels.find((level) => level.id === "lle1") || levels[0];
  const cards = (level1 ? level1.lessons : []).map((lesson) => catalogCard(lesson)).join("\n");
  next = replaceMarked(next, "catalog-cards", cards);
  next = replaceMarked(next, "lesson-index", lessonDirectory(levels));
  if (!/<script type="application\/json" id="catalog-data">[\s\S]*?<\/script>/.test(next)) {
    throw new Error("Missing catalog-data script");
  }
  next = next.replace(
    /<script type="application\/json" id="catalog-data">[\s\S]*?<\/script>/,
    `<script type="application/json" id="catalog-data">${compactJson(catalogPayloadFromLevels(levels))}</script>`
  );
  return next;
}

function catalogPayloadFromLevels(levels) {
  return {
    course: {
      title: "VOA 慢速英语自学课",
      pitch: homePitch(levels),
      disclaimer: homeDisclaimer(),
    },
    levels: levels.map((level) => ({
      id: level.id,
      title: level.title,
      lessons: level.lessons.map((lesson) => ({
        id: lesson.id,
        number: lesson.number,
        title: lesson.title || "",
        subtitle: lesson.subtitle || "",
        level: lesson.level,
      })),
    })),
  };
}

function sourceLastmod(root) {
  try {
    const out = execSync("git log -1 --format=%cs -- data/lessons.json", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) {
      return out;
    }
  } catch (error) {
    /* git history is optional */
  }
  return "2026-09-05";
}

function iterLessons(levels) {
  const rows = [];
  for (const level of levels) {
    level.lessons.forEach((lesson, index) => {
      rows.push({
        level,
        lesson,
        prev: index > 0 ? level.lessons[index - 1] : null,
        next: index < level.lessons.length - 1 ? level.lessons[index + 1] : null,
      });
    });
  }
  return rows;
}

function expectedFiles(root, payload, lastmod) {
  const levels = normalizeLevels(payload);
  validateCopy(levels);
  const files = new Map();
  for (const row of iterLessons(levels)) {
    files.set(
      `lessons/${row.lesson.id}.html`,
      buildLessonPage(row.level, row.lesson, row.prev, row.next)
    );
    files.set(
      `data/web/lessons/${row.lesson.id}.json`,
      prettyJson(webLesson(row.level, row.lesson, row.prev, row.next))
    );
  }
  files.set("data/web/catalog.json", prettyJson(catalogPayloadFromLevels(levels)));
  files.set("sitemap.xml", buildSitemap(levels, lastmod));
  files.set("robots.txt", buildRobots());
  for (const page of keyPages()) {
    const full = path.join(root, page.file);
    const source = fs.readFileSync(full, "utf8");
    files.set(page.file, patchSitePage(source, page, levels));
  }
  return files;
}

function readLessons(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "data", "lessons.json"), "utf8"));
}

function checkAll(root) {
  const problems = [];
  let files;
  try {
    files = expectedFiles(root, readLessons(root), sourceLastmod(root));
  } catch (error) {
    return [error.message];
  }
  for (const [rel, content] of files) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      problems.push(`missing ${rel}`);
      continue;
    }
    const disk = fs.readFileSync(full, "utf8");
    if (disk !== content) {
      problems.push(`stale ${rel}`);
    }
  }
  const lessonDir = path.join(root, "lessons");
  if (fs.existsSync(lessonDir)) {
    for (const name of fs.readdirSync(lessonDir)) {
      if (!name.endsWith(".html")) {
        continue;
      }
      if (!files.has(`lessons/${name}`)) {
        problems.push(`unexpected lessons/${name}`);
      }
    }
  }
  const webLessonDir = path.join(root, "data", "web", "lessons");
  if (fs.existsSync(webLessonDir)) {
    for (const name of fs.readdirSync(webLessonDir)) {
      if (!name.endsWith(".json")) {
        continue;
      }
      if (!files.has(`data/web/lessons/${name}`)) {
        problems.push(`unexpected data/web/lessons/${name}`);
      }
    }
  }
  return problems;
}

function writeAll(root) {
  const files = expectedFiles(root, readLessons(root), sourceLastmod(root));
  for (const [rel, content] of files) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return files.size;
}

module.exports = {
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
  webLesson,
  sourceLastmod,
  checkAll,
  writeAll,
  readLessons,
};
