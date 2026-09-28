const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const OpenCC = require("opencc-js");
const VOAUnlock = require("./unlock.js");
const { buildI18nScript } = require("./messages.js");

const TITLE_MIN = 16;
const TITLE_MAX = 34;
const DESC_MIN = 70;
const DESC_MAX = 120;
const SITE_NAME = "VOA慢速英文自学";

const HANS = {
  id: "zh-Hans",
  htmlLang: "zh-CN",
  inLanguage: "zh-Hans",
  ogLocale: "zh_CN",
  prefix: "",
  assetLesson: "../",
  pageLesson: "../",
};

const HANT = {
  id: "zh-Hant",
  htmlLang: "zh-Hant",
  inLanguage: "zh-Hant",
  ogLocale: "zh_TW",
  prefix: "zh-hant/",
  assetLesson: "../../",
  pageLesson: "../",
};

const LOCALES = [HANS, HANT];

/**
 * Applied after OpenCC s2twp. These fix phrase conversions that read oddly
 * in lesson dialogue or on-page copy.
 */
const OVERRIDES = [
  ["點選播放", "點擊播放"],
  ["指令碼", "腳本"],
  ["公有領域", "公共領域"],
  ["網際網路", "網路"],
  ["開啟打卡頁", "打開打卡頁"],
  ["開啟打卡", "打開打卡"],
  ["開啟課表", "打開課表"],
  ["開啟頁面", "打開頁面"],
];

const toTaiwan = OpenCC.Converter({ from: "cn", to: "twp" });

function loadSiteConfig(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"));
}

function loadSiteOrigin(root) {
  const config = loadSiteConfig(root);
  if (!config.origin || typeof config.origin !== "string" || !/^https?:\/\//.test(config.origin)) {
    throw new Error("site.config.json needs an absolute http(s) origin");
  }
  return config.origin.replace(/\/+$/, "");
}

function normalizePaymentUrl(value, key) {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value !== "string" || !/^https:\/\/\S+$/.test(value.trim()) || /\s/.test(value)) {
    throw new Error(`site.config.json payment.waffo.${key} must be an empty string or an https URL`);
  }
  return value.trim();
}

function loadWaffoLinks(root) {
  const config = loadSiteConfig(root);
  const waffo = config.payment && config.payment.waffo;
  if (!waffo || typeof waffo !== "object") {
    throw new Error("site.config.json needs payment.waffo.monthlyUrl and quarterlyUrl");
  }
  return {
    monthlyUrl: normalizePaymentUrl(waffo.monthlyUrl, "monthlyUrl"),
    quarterlyUrl: normalizePaymentUrl(waffo.quarterlyUrl, "quarterlyUrl"),
  };
}

function paymentButton(locale, url, label) {
  const href = typeof url === "string" ? url.trim() : "";
  if (!href) {
    return `<button type="button" class="btn waffo-pay" disabled>${escapeHtml(tx("即将开放", locale))}</button>`;
  }
  return `<a class="btn primary waffo-pay" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(tx(label, locale))}</a>`;
}

function waffoPlansHtml(locale, links) {
  const source = links || {};
  const plans = [
    {
      name: "月付",
      price: "US$5.99",
      note: "开通后 30 天有效",
      featured: false,
      url: source.monthlyUrl,
      label: "用 Waffo 支付 US$5.99",
    },
    {
      name: "季卡",
      price: "US$13.99",
      note: "开通后 90 天有效 · 约 US$4.66 / 月",
      featured: true,
      url: source.quarterlyUrl,
      label: "用 Waffo 支付 US$13.99",
    },
  ];
  const cards = plans
    .map((plan) => {
      const featured = plan.featured ? " is-featured" : "";
      return `        <article class="plan-card${featured}">
          <p class="plan-name">${escapeHtml(tx(plan.name, locale))}</p>
          <p class="plan-price">${escapeHtml(plan.price)}</p>
          <p class="plan-note">${escapeHtml(tx(plan.note, locale))}</p>
          ${paymentButton(locale, plan.url, plan.label)}
        </article>`;
    })
    .join("\n");
  return `<div class="plan-grid">\n${cards}\n      </div>`;
}

const SITE = loadSiteOrigin(path.join(__dirname, ".."));

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

function convertToHant(text) {
  let next = toTaiwan(String(text));
  for (const [from, to] of OVERRIDES) {
    if (next.includes(from)) {
      next = next.split(from).join(to);
    }
  }
  return next;
}

function convertValue(value) {
  if (typeof value === "string") {
    return convertToHant(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => convertValue(item));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = convertValue(item);
    }
    return out;
  }
  return value;
}

function tx(text, locale) {
  if (!locale || locale.id !== "zh-Hant") {
    return text;
  }
  return convertToHant(text);
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

function absoluteUrl(locale, rel, origin = SITE) {
  const tail = rel === "index.html" ? "" : rel;
  const base = locale.id === "zh-Hant" ? `${origin}/zh-hant` : origin;
  return tail ? `${base}/${tail}` : `${base}/`;
}

function switcherHref(fromId, toId, rel) {
  if (fromId === toId) {
    const slash = rel.lastIndexOf("/");
    return slash === -1 ? rel : rel.slice(slash + 1);
  }
  const inLesson = rel.startsWith("lessons/");
  if (fromId === "zh-Hans" && toId === "zh-Hant") {
    return inLesson ? `../zh-hant/${rel}` : `zh-hant/${rel}`;
  }
  return inLesson ? `../../${rel}` : `../${rel}`;
}

function scriptSwitcher(locale, rel) {
  const link = (id, label, lang) => {
    const href = switcherHref(locale.id, id, rel);
    const current = locale.id === id ? ' aria-current="true"' : "";
    return `<a href="${escapeHtml(href)}" hreflang="${lang}" lang="${lang}" data-script="${id}"${current}>${label}</a>`;
  };
  return `<nav class="script-switch" aria-label="简繁">${link("zh-Hans", "简", "zh-Hans")}${link("zh-Hant", "繁", "zh-Hant")}</nav>`;
}

function hreflangLinks(rel, origin) {
  const hans = absoluteUrl(HANS, rel, origin);
  const hant = absoluteUrl(HANT, rel, origin);
  return [
    `<link rel="alternate" hreflang="zh-Hans" href="${escapeHtml(hans)}" />`,
    `<link rel="alternate" hreflang="zh-Hant" href="${escapeHtml(hant)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(hans)}" />`,
  ].join("\n  ");
}

function lessonSeoTitle(lesson, locale = HANS) {
  const prefix = `VOA慢速英文第${lesson.number}课`;
  const subtitle = String(lesson.subtitle || "").trim();
  let title;
  if (!subtitle) {
    title = `${prefix} 中英对照听力`;
  } else {
    const withSuffix = `${prefix} ${subtitle}｜中英字幕`;
    if (textLength(withSuffix) <= TITLE_MAX) {
      title = withSuffix;
    } else {
      const plain = `${prefix} ${subtitle}`;
      if (textLength(plain) <= TITLE_MAX) {
        title = plain;
      } else {
        const budget = TITLE_MAX - textLength(`${prefix} …`);
        const trimmed = Array.from(subtitle).slice(0, Math.max(budget, 1)).join("");
        title = `${prefix} ${trimmed}…`;
      }
    }
  }
  return tx(title, locale);
}

function lessonSeoDescription(lesson, levelId, locale = HANS) {
  const free = isFreeLesson(lesson);
  const levelName = levelId === "lle2" ? "Level 2" : "Level 1";
  const subtitle = String(lesson.subtitle || lesson.title || "").trim();
  const access = free ? "本课免费试学。" : "开通后可看完整视频与测验。";
  const templates = [
    `VOA Let's Learn English ${levelName} 第${lesson.number}课「${subtitle}」。慢速英文听力，中英对照字幕，适合海外中文学习者跟读。${access}`,
    `VOA慢速英文 ${levelName} 第${lesson.number}课「${subtitle}」。中英对照字幕，适合海外中文学习者跟读自学。${access}`,
    `VOA Let's Learn English 第${lesson.number}课「${subtitle}」。慢速英文听力配中英对照字幕，适合自学跟读。${access}`,
  ];
  let text = templates[templates.length - 1];
  for (const candidate of templates) {
    const len = textLength(candidate);
    if (len >= DESC_MIN && len <= DESC_MAX) {
      text = candidate;
      break;
    }
  }
  if (textLength(text) < DESC_MIN || textLength(text) > DESC_MAX) {
    const shortLead = `VOA慢速英文${levelName}第${lesson.number}课「`;
    const shortTail = `」。中英对照字幕，适合跟读自学。${access}`;
    const room = DESC_MAX - textLength(shortLead) - textLength(shortTail) - 1;
    const trimmed = `${Array.from(subtitle).slice(0, Math.max(room, 4)).join("")}…`;
    text = `${shortLead}${trimmed}${shortTail}`;
    if (textLength(text) < DESC_MIN) {
      text = `VOA Let's Learn English ${levelName} 第${lesson.number}课「${subtitle}」。跟读慢速英文听力，看中英对照字幕，并完成课后小测验。${access}适合每天学一点。`;
    }
    if (textLength(text) > DESC_MAX) {
      text = `${Array.from(text).slice(0, DESC_MAX - 1).join("")}…`;
    }
  }
  return tx(text, locale);
}

function keyPages(origin = SITE) {
  return [
    {
      id: "home",
      file: "index.html",
      loc: `${origin}/`,
      title: "VOA慢速英文｜Let's Learn English 中英字幕",
      description:
        "VOA Let's Learn English 慢速英文课表，中英对照字幕加听力小测验。适合台湾、香港、新加坡与马来西亚的中文学习者，Level 1 与 Level 2 共 82 课，前 5 课免费。",
      ogType: "website",
      priority: "1.0",
    },
    {
      id: "progress",
      file: "progress.html",
      loc: `${origin}/progress.html`,
      title: "VOA慢速英文打卡日历｜Let's Learn English",
      description:
        "用打卡日历记下 VOA Let's Learn English 学习天数。提交任意一课测验即完成当日打卡，连续天数按 UTC+8 计算，方便坚持慢速英文。",
      ogType: "website",
      priority: "0.6",
    },
    {
      id: "wrongbook",
      file: "wrongbook.html",
      loc: `${origin}/wrongbook.html`,
      title: "VOA慢速英文错题本｜Let's Learn English",
      description:
        "把 VOA Let's Learn English 测验里错过的题收进错题本。按课程归类复习，答对后自动移除，方便对照中英字幕补上慢速英文听力。",
      ogType: "website",
      priority: "0.6",
    },
    {
      id: "pricing",
      file: "pricing.html",
      loc: `${origin}/pricing.html`,
      title: "开通 VOA Let's Learn English 慢速英文",
      description:
        "Level 1 第 1–5 课免费试学。开通后解锁 VOA Let's Learn English 已上线的全部慢速英文课，含 Level 1、Level 2 的中英对照听力与测验。",
      ogType: "website",
      priority: "0.5",
    },
  ];
}

function legacyPage(origin = SITE) {
  return {
    id: "legacy",
    file: "lesson.html",
    loc: `${origin}/lesson.html`,
    title: "VOA慢速英文课程｜Let's Learn English",
    description:
      "正在打开 VOA Let's Learn English 慢速英文课文。每课都有单独页面，含中英对照字幕，适合台湾、香港、新加坡与马来西亚的学习者。",
    ogType: "website",
    priority: null,
  };
}

function shellPages(origin = SITE) {
  return [...keyPages(origin), legacyPage(origin)];
}

function assertCopy(label, text, min, max) {
  const len = textLength(text);
  if (len < min || len > max) {
    throw new Error(`${label} length ${len} is outside ${min}-${max}: ${text}`);
  }
}

function validateCopy(levels) {
  for (const page of shellPages()) {
    assertCopy(page.id, page.description, DESC_MIN, DESC_MAX);
    assertCopy(`${page.id} title`, page.title, TITLE_MIN, 40);
    assertCopy(`${page.id} hant`, convertToHant(page.description), DESC_MIN, DESC_MAX);
    assertCopy(`${page.id} hant title`, convertToHant(page.title), TITLE_MIN, 40);
  }
  for (const locale of LOCALES) {
    for (const level of levels) {
      for (const lesson of level.lessons) {
        const title = lessonSeoTitle(lesson, locale);
        const description = lessonSeoDescription(lesson, level.id, locale);
        assertCopy(`${lesson.id} ${locale.id} title`, title, TITLE_MIN, TITLE_MAX);
        assertCopy(`${lesson.id} ${locale.id} description`, description, DESC_MIN, DESC_MAX);
        const marker = tx(`第${lesson.number}课`, locale);
        if (!title.includes(marker)) {
          throw new Error(`${lesson.id} title missing lesson number`);
        }
        if (!description.includes(marker)) {
          throw new Error(`${lesson.id} description missing lesson number`);
        }
        if (locale.id === "zh-Hans" && !/慢速英文|中英对照|中英字幕/.test(description)) {
          throw new Error(`${lesson.id} description missing search phrase`);
        }
      }
    }
  }
}

function seoHead({ title, description, canonical, ogType, jsonLd, locale, pageRel, origin }) {
  const loc = locale || HANS;
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    hreflangLinks(pageRel, origin || SITE),
    `<meta property="og:type" content="${escapeHtml(ogType || "website")}" />`,
    `<meta property="og:locale" content="${loc.ogLocale}" />`,
    `<meta property="og:site_name" content="${escapeHtml(tx(SITE_NAME, loc))}" />`,
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

function homeJsonLd(page, locale, canonical, origin) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: tx("VOA Let's Learn English 慢速英文", locale),
    description: tx(page.description, locale),
    url: canonical,
    inLanguage: ["en", locale.inLanguage],
    provider: {
      "@type": "Organization",
      name: tx(SITE_NAME, locale),
      url: absoluteUrl(locale, "index.html", origin),
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

function pagerLink(lesson, kind, locale) {
  if (!lesson) {
    const label = tx(kind === "prev" ? "已是第一课" : "已是最后一课", locale);
    return `<span class="pager-placeholder">${label}</span>`;
  }
  const locked = !isFreeLesson(lesson);
  const lockedMark = locked ? tx("（未解锁）", locale) : "";
  const text =
    kind === "prev"
      ? `← ${tx("上一课", locale)} · ${lesson.number}${lockedMark}`
      : `${tx("下一课", locale)} · ${lesson.number}${lockedMark} →`;
  const classes = ["btn"];
  if (!locked && kind === "next") {
    classes.push("primary");
  }
  if (locked) {
    classes.push("is-locked-link");
  }
  return `<a class="${classes.join(" ")}" href="${escapeHtml(lesson.id)}.html">${escapeHtml(text)}</a>`;
}

function lessonIntro(lesson, levelId, locale) {
  const levelName = levelId === "lle2" ? "Level 2" : "Level 1";
  const subtitle = lesson.subtitle || "";
  if (isFreeLesson(lesson)) {
    return tx(
      `这是 VOA Let's Learn English 慢速英文 ${levelName} 第 ${lesson.number} 课「${subtitle}」。本课可以免费试学：播放听力视频，看中英对照字幕，再做三道小测验。`,
      locale
    );
  }
  return tx(
    `这是 VOA Let's Learn English 慢速英文 ${levelName} 第 ${lesson.number} 课「${subtitle}」。下面是课题和开头两句中英对照。完整视频、对话和测验在开通后开放。`,
    locale
  );
}

function lessonJsonLd(lesson, level, title, description, canonical, locale, origin) {
  const levelName = level.id === "lle2" ? "Level 2" : "Level 1";
  const home = absoluteUrl(locale, "index.html", origin);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource",
        name: title,
        description,
        url: canonical,
        inLanguage: ["en", locale.inLanguage],
        learningResourceType: "lesson",
        isAccessibleForFree: isFreeLesson(lesson),
        teaches: "English listening",
        isPartOf: {
          "@type": "Course",
          name: `VOA Let's Learn English ${levelName}`,
          url: home,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: tx("课表", locale),
            item: home,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: levelName,
            item: levelHomeUrl(locale, level.id, origin),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: tx(`第${lesson.number}课 ${lesson.subtitle || ""}`, locale).trim(),
            item: canonical,
          },
        ],
      },
    ],
  };
}

function levelHomeUrl(locale, levelId, origin) {
  const home = absoluteUrl(locale, "index.html", origin);
  if (home.endsWith("/")) {
    return `${home}index.html?level=${levelId}`;
  }
  return `${home}?level=${levelId}`;
}

function buildLessonPage(level, lesson, prev, next, locale = HANS, origin = SITE) {
  const loc = locale || HANS;
  const view = loc.id === "zh-Hant" ? convertValue(lesson) : lesson;
  const free = isFreeLesson(view);
  const title = lessonSeoTitle(lesson, loc);
  const description = lessonSeoDescription(lesson, level.id, loc);
  const canonical = absoluteUrl(loc, `lessons/${lesson.id}.html`, origin);
  const levelName = level.id === "lle2" ? "Level 2" : "Level 1";
  const asset = loc.assetLesson;
  const pageBase = loc.pageLesson;
  const backHref = `${pageBase}index.html?level=${level.id}`;
  const poster = loc.id === "zh-Hant" ? `${asset}img/poster-hant.svg` : `${asset}img/poster.svg`;
  const videoBlock = free
    ? `        <video id="lesson-video" controls playsinline preload="none" poster="${poster}" src="${escapeHtml(view.videoUrl || "")}">
          ${escapeHtml(tx("你的浏览器不支持视频播放。", loc))}
        </video>`
    : `        <video id="lesson-video" controls playsinline preload="none" poster="${poster}">
          ${escapeHtml(tx("你的浏览器不支持视频播放。", loc))}
        </video>`;
  const youtube = free && view.youtubeId
    ? `<a id="youtube-link" href="https://www.youtube.com/watch?v=${escapeHtml(view.youtubeId)}" target="_blank" rel="noopener">${escapeHtml(tx("YouTube 备用", loc))}</a><span id="youtube-sep"> · </span>`
    : `<a id="youtube-link" href="#" target="_blank" rel="noopener" hidden>${escapeHtml(tx("YouTube 备用", loc))}</a><span id="youtube-sep" hidden> · </span>`;
  const sourceHref = escapeHtml(view.sourceUrl || "#");
  const excerpt = free
    ? ""
    : `    <section class="excerpt-section" aria-label="${escapeHtml(tx("课文节选", loc))}">
      <h2>${escapeHtml(tx("课文节选 · 中英对照", loc))}</h2>
      <p class="excerpt-note">${escapeHtml(tx("这里只放开头两句。开通后可以看完整对话、课文视频和听力小测验。", loc))}</p>
      <div class="dialogue">
${dialogueHtml((view.dialogue || []).slice(0, 2))}
      </div>
    </section>
    <section class="paywall-section" id="lesson-paywall" aria-label="${escapeHtml(tx("开通后学习", loc))}">
      <h2>${escapeHtml(tx("课程未解锁", loc))}</h2>
      <p>${escapeHtml(tx("免费试学仅 Level 1 第 1–5 课。开通解锁全部已上线课程（含 Level 1 + Level 2 已发布课）。打卡日历与错题本免费使用（无需开通）。", loc))}</p>
      <p>${escapeHtml(tx("下一步：到开通页用 Waffo 支付（月付 US$5.99，30 天；季卡 US$13.99，90 天），获兑换码后在开通页输入解锁。人在中国大陆也可以微信联系 ", loc))}<strong>15232188653</strong>${escapeHtml(tx(" 人工付款。", loc))}</p>
      <div class="quiz-actions">
        <a class="btn primary" href="${pageBase}pricing.html">${escapeHtml(tx("去开通 · 输入兑换码", loc))}</a>
        <a class="btn" href="${escapeHtml(backHref)}">${escapeHtml(tx("返回课表", loc))}</a>
      </div>
    </section>
`;
  const dialogue = free ? dialogueHtml(view.dialogue || []) : "";
  const quiz = free ? quizPreviewHtml(view.quiz || []) : "";
  const hidden = free ? "" : " hidden";
  const preconnect = free
    ? `  <link rel="preconnect" href="https://voa-video-ns.akamaized.net" crossorigin />\n`
    : "";
  const navJson = compactJson({
    levelId: level.id,
    level: view.level,
    prev: neighborBrief(prev),
    next: neighborBrief(next),
  });
  const dataScript = free
    ? `  <script type="application/json" id="lesson-data">${compactJson(loc.id === "zh-Hant" ? convertValue(webLesson(level, lesson, prev, next)) : webLesson(level, lesson, prev, next))}</script>\n`
    : "";
  const pager = `      ${pagerLink(prev, "prev", loc)}
      ${pagerLink(next, "next", loc)}`;
  const visibleTitle = title.replace(/｜中英字幕$/, "");
  const jsonLd = lessonJsonLd(view, level, title, description, canonical, loc, origin);

  return `<!DOCTYPE html>
<html lang="${loc.htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  ${seoHead({
    title,
    description,
    canonical,
    ogType: "article",
    jsonLd,
    locale: loc,
    pageRel: `lessons/${lesson.id}.html`,
    origin,
  })}
${preconnect}  <link rel="stylesheet" href="${asset}css/styles.css" />
</head>
<body data-page="lesson" data-lesson-id="${escapeHtml(view.id)}" data-lesson-number="${escapeHtml(view.number)}" data-lesson-level="${escapeHtml(view.level)}" data-level-id="${escapeHtml(level.id)}">
  <div class="page">
    <nav class="nav" aria-label="${escapeHtml(tx("站点", loc))}">
      <a href="${escapeHtml(backHref)}" class="back-link">← ${escapeHtml(levelName)} · ${escapeHtml(tx("课表", loc))}</a>
      <div class="site-nav-inline">
        <a href="${pageBase}progress.html">${escapeHtml(tx("打卡", loc))}</a>
        <a href="${pageBase}wrongbook.html" data-wrongbook-count>${escapeHtml(tx("错题本", loc))}</a>
        <a href="${pageBase}pricing.html" data-unlock-status>${escapeHtml(tx("开通", loc))}</a>
        ${scriptSwitcher(loc, `lessons/${lesson.id}.html`)}
      </div>
    </nav>
    <header class="header">
      <p class="eyebrow">${escapeHtml(tx("VOA 慢速英文 · 非官方自学", loc))}</p>
      <h1 id="lesson-title">${escapeHtml(visibleTitle)}</h1>
      <p id="lesson-subtitle" class="subtitle">${escapeHtml(levelName)} · ${escapeHtml(tx(`第${view.number}课`, loc))}</p>
      <p class="lesson-intro">${escapeHtml(lessonIntro(lesson, level.id, loc))}</p>
    </header>
    <nav class="lesson-pager" data-lesson-pager aria-label="${escapeHtml(tx("上下课", loc))}">
${pager}
    </nav>
${excerpt}    <section class="video-section" aria-label="${escapeHtml(tx("课文视频", loc))}"${hidden}>
      <div class="video-wrap">
${videoBlock}
      </div>
      <p class="video-fallback" id="video-fallback">
        ${youtube}
        <a id="voa-page-link" href="${sourceHref}" target="_blank" rel="noopener">${escapeHtml(tx("VOA 原文课文", loc))}</a>
      </p>
    </section>
    <section class="dialogue-section" aria-label="${escapeHtml(tx("对话", loc))}"${hidden}>
      <h2>${escapeHtml(tx("对话 · 中英对照", loc))}</h2>
      <div id="dialogue" class="dialogue">
${dialogue}
      </div>
    </section>
    <section class="quiz-section" id="quiz" aria-label="${escapeHtml(tx("练习", loc))}"${hidden}>
      <h2>${escapeHtml(tx("听力小测验", loc))}</h2>
      <form id="quiz-form">
${quiz}
      </form>
      <div class="quiz-actions">
        <button type="submit" form="quiz-form" id="submit-quiz" class="btn primary">${escapeHtml(tx("核对答案", loc))}</button>
        <button type="button" id="reset-quiz" class="btn">${escapeHtml(tx("重做", loc))}</button>
      </div>
      <p id="quiz-result" class="quiz-result" role="status" aria-live="polite"></p>
    </section>
    <nav class="lesson-pager" data-lesson-pager aria-label="${escapeHtml(tx("上下课", loc))}">
${pager}
    </nav>
    <footer class="footer">
      <p id="attribution">${escapeHtml(view.attribution || "")}</p>
    </footer>
  </div>
  <script type="application/json" id="lesson-nav">${navJson}</script>
${dataScript}  <script type="module" src="${asset}js/study.js"></script>
  <script type="module" src="${asset}js/unlock.js"></script>
  <script src="${asset}js/i18n.js" defer></script>
  <script src="${asset}js/app.js" defer></script>
</body>
</html>
`;
}

function catalogCard(lesson, locale) {
  const locked = !isFreeLesson(lesson);
  const href = `lessons/${lesson.id}.html`;
  const badge = locked
    ? `<p class="status-badge status-locked">${escapeHtml(tx("未解锁", locale))}</p>`
    : `<p class="status-badge status-not-started">${escapeHtml(tx("未开始", locale))}</p>`;
  const button = locked ? tx("开通解锁", locale) : tx("开始", locale);
  const buttonClass = locked ? "btn" : "btn primary";
  return `      <article class="lesson-card${locked ? " is-locked" : ""}" data-status="${locked ? "locked" : "not-started"}">
        <div class="lesson-card-top">
          <p class="lesson-number">Lesson ${escapeHtml(lesson.number || "")}</p>
          ${badge}
        </div>
        <h3>${escapeHtml(lesson.title || "")}</h3>
        <p class="lesson-subtitle">${escapeHtml(lesson.subtitle || "")}</p>
        <a class="${buttonClass}" href="${escapeHtml(href)}">${escapeHtml(button)}</a>
      </article>`;
}

function lessonDirectory(levels, locale) {
  const total = levels.reduce((sum, level) => sum + level.lessons.length, 0);
  const blocks = levels
    .map((level) => {
      const label = level.id === "lle2" ? "Level 2" : "Level 1";
      const items = level.lessons
        .map(
          (lesson) =>
            `        <li><a href="lessons/${escapeHtml(lesson.id)}.html">${escapeHtml(tx(`第${lesson.number}课`, locale))} ${escapeHtml(lesson.subtitle || lesson.title || "")}</a></li>`
        )
        .join("\n");
      return `    <h3>${escapeHtml(label)} · ${level.lessons.length} ${escapeHtml(tx("课", locale))}</h3>
    <ol>
${items}
    </ol>`;
    })
    .join("\n");
  return `    <h2>${escapeHtml(tx("全部课程目录", locale))}</h2>
    <p class="catalog-note">${escapeHtml(tx(`VOA Let's Learn English 慢速英文听力，中英对照字幕。共 ${total} 课，点进每一课都有单独页面。`, locale))}</p>
${blocks}`;
}

function buildSitemap(levels, lastmod, origin = SITE) {
  const pages = [
    ...keyPages(origin).map((page) => ({ rel: page.file, priority: page.priority })),
    ...levels.flatMap((level) =>
      level.lessons.map((lesson) => ({
        rel: `lessons/${lesson.id}.html`,
        priority: "0.8",
      }))
    ),
  ];
  const body = pages
    .flatMap((page) =>
      LOCALES.map((locale) => {
        const loc = absoluteUrl(locale, page.rel, origin);
        const hans = absoluteUrl(HANS, page.rel, origin);
        const hant = absoluteUrl(HANT, page.rel, origin);
        return `  <url>
    <loc>${escapeHtml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${page.priority}</priority>
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="${escapeHtml(hans)}" />
    <xhtml:link rel="alternate" hreflang="zh-Hant" href="${escapeHtml(hant)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(hans)}" />
  </url>`;
      })
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
}

function buildRobots(origin = SITE) {
  const host = new URL(origin).origin;
  return `# 搜索引擎只读取主机根目录的 robots.txt（${host}/robots.txt），不会自动读取子路径里的本文件。
# 部署在 GitHub 项目页时，请到站长平台手动提交下面的 Sitemap。
User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
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

function prefixAssets(html, prefix) {
  return html.replace(
    /(\s(?:href|src|poster)=")(?!(?:https?:|\/\/|#|data:|\.\.\/))(css\/|js\/|img\/|data\/)/g,
    `$1${prefix}$2`
  );
}

function prepareShell(root, file, locale) {
  let html = fs.readFileSync(path.join(root, file), "utf8");
  if (locale.id !== "zh-Hant") {
    return html;
  }
  html = html.replaceAll('lang="zh-CN"', 'lang="zh-Hant"');
  html = html.replaceAll('poster="img/poster.svg"', 'poster="img/poster-hant.svg"');
  html = convertToHant(html);
  html = prefixAssets(html, "../");
  return html;
}

function patchSitePage(html, page, levels, locale = HANS, origin = SITE, waffo = null) {
  const canonical = absoluteUrl(locale, page.file, origin);
  const title = tx(page.title, locale);
  const description = tx(page.description, locale);
  let next = replaceMarked(
    html,
    "seo",
    seoHead({
      title,
      description,
      canonical,
      ogType: page.ogType,
      jsonLd: page.id === "home" ? homeJsonLd(page, locale, canonical, origin) : null,
      locale,
      pageRel: page.file,
      origin,
    })
  );
  next = replaceMarked(next, "script-switch", scriptSwitcher(locale, page.file));
  if (page.id === "pricing") {
    next = replaceMarked(next, "waffo-plans", waffoPlansHtml(locale, waffo));
  }
  if (page.id !== "home") {
    return next;
  }
  next = replaceMarked(next, "home-pitch", escapeHtml(tx(homePitch(levels), locale)));
  next = replaceMarked(next, "home-disclaimer", escapeHtml(tx(homeDisclaimer(), locale)));
  const level1 = levels.find((level) => level.id === "lle1") || levels[0];
  const cards = (level1 ? level1.lessons : []).map((lesson) => catalogCard(lesson, locale)).join("\n");
  next = replaceMarked(next, "catalog-cards", cards);
  next = replaceMarked(next, "lesson-index", lessonDirectory(levels, locale));
  if (!/<script type="application\/json" id="catalog-data">[\s\S]*?<\/script>/.test(next)) {
    throw new Error("Missing catalog-data script");
  }
  const catalog = catalogPayloadFromLevels(levels);
  const payload = locale.id === "zh-Hant" ? convertValue(catalog) : catalog;
  next = next.replace(
    /<script type="application\/json" id="catalog-data">[\s\S]*?<\/script>/,
    `<script type="application/json" id="catalog-data">${compactJson(payload)}</script>`
  );
  return next;
}

function catalogPayloadFromLevels(levels) {
  return {
    course: {
      title: "VOA 慢速英文自学课",
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
  const waffo = loadWaffoLinks(root);
  const files = new Map();
  files.set("js/i18n.js", buildI18nScript(convertToHant));
  for (const locale of LOCALES) {
    for (const row of iterLessons(levels)) {
      files.set(
        `${locale.prefix}lessons/${row.lesson.id}.html`,
        buildLessonPage(row.level, row.lesson, row.prev, row.next, locale)
      );
      const lessonJson = webLesson(row.level, row.lesson, row.prev, row.next);
      const jsonRel =
        locale.id === "zh-Hant"
          ? `data/web/zh-hant/lessons/${row.lesson.id}.json`
          : `data/web/lessons/${row.lesson.id}.json`;
      files.set(jsonRel, prettyJson(locale.id === "zh-Hant" ? convertValue(lessonJson) : lessonJson));
    }
    const catalog = catalogPayloadFromLevels(levels);
    const catalogRel = locale.id === "zh-Hant" ? "data/web/zh-hant/catalog.json" : "data/web/catalog.json";
    files.set(catalogRel, prettyJson(locale.id === "zh-Hant" ? convertValue(catalog) : catalog));
    for (const page of shellPages()) {
      const shell = prepareShell(root, page.file, locale);
      files.set(`${locale.prefix}${page.file}`, patchSitePage(shell, page, levels, locale, SITE, waffo));
    }
  }
  files.set("sitemap.xml", buildSitemap(levels, lastmod));
  files.set("robots.txt", buildRobots());
  return files;
}

function readLessons(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "data", "lessons.json"), "utf8"));
}

function collectExtras(dir, prefix, files, problems, suffix) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(suffix)) {
      continue;
    }
    const rel = `${prefix}${name}`;
    if (!files.has(rel)) {
      problems.push(`unexpected ${rel}`);
    }
  }
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
  collectExtras(path.join(root, "lessons"), "lessons/", files, problems, ".html");
  collectExtras(path.join(root, "zh-hant"), "zh-hant/", files, problems, ".html");
  collectExtras(path.join(root, "zh-hant", "lessons"), "zh-hant/lessons/", files, problems, ".html");
  collectExtras(path.join(root, "data", "web", "lessons"), "data/web/lessons/", files, problems, ".json");
  collectExtras(
    path.join(root, "data", "web", "zh-hant", "lessons"),
    "data/web/zh-hant/lessons/",
    files,
    problems,
    ".json"
  );
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
  HANS,
  HANT,
  OVERRIDES,
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
  convertToHant,
  switcherHref,
  absoluteUrl,
  scriptSwitcher,
  loadWaffoLinks,
  paymentButton,
  waffoPlansHtml,
};
