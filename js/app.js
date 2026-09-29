const PROGRESS_KEY = "voa-lle-progress";
const OLD_QUIZ_KEY = "voa-lle1-01-quiz";
const CATALOG_LEVEL_KEY = "voa-lle-catalog-level";
const SCRIPT_PREF_KEY = "voa-lle-script";
const WECHAT_CONTACT = "15232188653";

function siteRoot() {
  const path = window.location.pathname;
  const markers = ["/zh-hant/lessons/", "/lessons/", "/zh-hant/"];
  for (let i = 0; i < markers.length; i += 1) {
    const at = path.lastIndexOf(markers[i]);
    if (at !== -1) {
      return path.slice(0, at + 1);
    }
  }
  let bare = path;
  if (bare.endsWith("/zh-hant")) {
    bare = bare.slice(0, -"/zh-hant".length);
  }
  if (bare.endsWith("/")) {
    return bare || "/";
  }
  const segment = bare.slice(bare.lastIndexOf("/") + 1);
  if (segment.includes(".")) {
    return bare.slice(0, bare.lastIndexOf("/") + 1);
  }
  return `${bare}/`;
}

function t(key, vars) {
  const packs = window.VOA_I18N || {};
  const lang = document.documentElement.lang === "zh-Hant" ? "zh-Hant" : "zh-Hans";
  const pack = packs[lang] || packs["zh-Hans"] || {};
  let text = pack[key];
  if (text == null) {
    text = (packs["zh-Hans"] || {})[key] || key;
  }
  if (vars) {
    text = String(text).replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? "" : String(vars[name])));
  }
  return text;
}

function localizedPlan(plan) {
  if (plan === "monthly") {
    return t("planMonthly");
  }
  if (plan === "quarterly") {
    return t("planQuarterly");
  }
  return t("planOpened");
}

function webDataDir() {
  if (document.documentElement.lang === "zh-Hant") {
    return "data/web/zh-hant/";
  }
  return "data/web/";
}

function currentScript() {
  return document.documentElement.lang === "zh-Hant" ? "zh-Hant" : "zh-Hans";
}

function syncSwitcherLinks() {
  document.querySelectorAll("[data-script]").forEach((link) => {
    const url = new URL(link.getAttribute("href"), window.location.href);
    url.search = window.location.search;
    url.hash = window.location.hash;
    link.href = `${url.pathname}${url.search}${url.hash}`;
  });
}

function rememberScriptChoice() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-script]");
    if (!link) {
      return;
    }
    try {
      localStorage.setItem(SCRIPT_PREF_KEY, link.getAttribute("data-script"));
    } catch (error) {
      /* ignore quota / private mode */
    }
  });
}

function applyScriptPreference() {
  let pref = "";
  try {
    pref = localStorage.getItem(SCRIPT_PREF_KEY) || "";
  } catch (error) {
    return false;
  }
  if (pref !== "zh-Hans" && pref !== "zh-Hant") {
    return false;
  }
  if (pref === currentScript()) {
    return false;
  }
  const link = document.querySelector(`[data-script="${pref}"]`);
  if (!link) {
    return false;
  }
  window.location.replace(link.href);
  return true;
}

function sitePath(relative) {
  const clean = String(relative || "").replace(/^\//, "");
  return `${siteRoot()}${clean}`;
}

function pagePath(relative) {
  const clean = String(relative || "").replace(/^\//, "");
  const prefix = document.documentElement.lang === "zh-Hant" ? "zh-hant/" : "";
  return sitePath(`${prefix}${clean}`);
}

function readJsonScript(id) {
  const node = document.getElementById(id);
  if (!node) {
    return null;
  }
  const text = node.textContent.trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadLessons() {
  const embedded = readJsonScript("catalog-data");
  if (embedded && Array.isArray(embedded.levels)) {
    return embedded;
  }
  const response = await fetch(sitePath(`${webDataDir()}catalog.json`));
  if (!response.ok) {
    throw new Error(t("loadLessonsError"));
  }
  return response.json();
}

function normalizeCatalog(payload) {
  const course = payload.course || {};
  if (Array.isArray(payload.levels) && payload.levels.length) {
    return {
      course,
      levels: payload.levels.map((level) => ({
        id: level.id,
        title: level.title || level.id,
        lessons: Array.isArray(level.lessons) ? level.lessons : [],
      })),
    };
  }

  const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];
  return {
    course,
    levels: [
      {
        id: "lle1",
        title: course.title || "Let's Learn English · Level 1",
        lessons,
      },
    ],
  };
}

function findLevel(catalog, levelId) {
  return catalog.levels.find((level) => level.id === levelId) || catalog.levels[0];
}

function findLessonInCatalog(catalog, lessonId) {
  for (const level of catalog.levels) {
    const lesson = level.lessons.find((item) => item.id === lessonId);
    if (lesson) {
      return { lesson, level };
    }
  }
  return { lesson: null, level: null };
}

function readStoredLevelId() {
  try {
    return sessionStorage.getItem(CATALOG_LEVEL_KEY) || "";
  } catch (error) {
    return "";
  }
}

function writeStoredLevelId(levelId) {
  try {
    sessionStorage.setItem(CATALOG_LEVEL_KEY, levelId);
  } catch (error) {
    /* ignore quota / private mode */
  }
}

function selectedLevelId(catalog) {
  const fromUrl = new URLSearchParams(window.location.search).get("level");
  const requested = fromUrl || readStoredLevelId();
  if (requested && catalog.levels.some((level) => level.id === requested)) {
    return requested;
  }
  return catalog.levels[0].id;
}

async function loadCodes() {
  const response = await fetch(sitePath("data/codes.json"));
  if (!response.ok) {
    throw new Error(t("loadCodesError"));
  }
  const payload = await response.json();
  return Array.isArray(payload.codes) ? payload.codes : [];
}

function readProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function writeProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn("Unable to save lesson progress.", error);
  }
}

function migrateOldProgress() {
  const progress = readProgress();
  if (progress["lle1-01"]) {
    return progress;
  }

  try {
    const raw = localStorage.getItem(OLD_QUIZ_KEY);
    if (!raw) {
      return progress;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.score === "number") {
      progress["lle1-01"] = {
        score: parsed.score,
        total: parsed.total,
        completed: true,
        savedAt: new Date().toISOString(),
        answers: parsed.answers || {},
        resultText: parsed.resultText || `测验 ${parsed.score} / ${parsed.total}`,
      };
      writeProgress(progress);
    }
  } catch (error) {
    return progress;
  }

  return progress;
}

function getLessonStatus(entry) {
  if (!entry) {
    return "not-started";
  }
  if (entry.completed) {
    return "done";
  }
  return "in-progress";
}

function statusLabel(status) {
  if (status === "done") {
    return t("statusDone");
  }
  if (status === "in-progress") {
    return t("statusInProgress");
  }
  return t("statusNotStarted");
}

function actionLabel(status) {
  if (status === "done") {
    return t("actionReview");
  }
  if (status === "in-progress") {
    return t("actionContinue");
  }
  return t("actionStart");
}

function completedCount(lessons, progress) {
  return lessons.filter((lesson) => progress[lesson.id]?.completed === true).length;
}

function isLevelCleared(lessons, progress) {
  return lessons.length > 0 && lessons.every((lesson) => progress[lesson.id]?.completed === true);
}

function neighborLessons(lessons, currentId) {
  const index = lessons.findIndex((lesson) => lesson.id === currentId);
  return {
    prev: index > 0 ? lessons[index - 1] : null,
    next: index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null,
  };
}

function catalogNoteText(catalog, unlocked) {
  const l1 = findLevel(catalog, "lle1");
  const l2 = catalog.levels.find((level) => level.id === "lle2");
  const l1n = l1 ? l1.lessons.length : 0;
  const l2n = l2 ? l2.lessons.length : 0;
  if (unlocked) {
    return t("catalogNoteUnlocked", { l1: l1n, l2: l2n });
  }
  return t("catalogNoteLocked", { wechat: WECHAT_CONTACT });
}

function checkinHintText() {
  const dates = VOAStudy.readCheckins();
  const today = VOAStudy.todayKey();
  const streak = VOAStudy.currentStreak(dates);
  const checkedToday = dates.includes(today);
  if (checkedToday) {
    return streak > 1 ? t("checkinTodayStreak", { streak }) : t("checkinToday");
  }
  if (streak > 0) {
    return t("checkinStreakPending", { streak });
  }
  return t("checkinPrompt");
}

function markLessonStarted(lessonId) {
  const progress = readProgress();
  if (!progress[lessonId]) {
    progress[lessonId] = {
      completed: false,
      savedAt: new Date().toISOString(),
    };
    writeProgress(progress);
  }
}

function renderUnlockNav() {
  const unlocked = VOAUnlock.isUnlocked();
  document.querySelectorAll("[data-unlock-status]").forEach((el) => {
    el.textContent = unlocked ? t("navUnlocked") : t("navUnlock");
    el.classList.toggle("is-unlocked", unlocked);
  });
}

function renderCatalog(catalog, levelId) {
  const level = findLevel(catalog, levelId);
  const lessons = level.lessons;
  const progress = migrateOldProgress();
  const unlocked = VOAUnlock.isUnlocked();
  writeStoredLevelId(level.id);

  const catalogHeading = document.querySelector(".catalog-section h2");
  if (catalogHeading) {
    catalogHeading.textContent = `${level.id === "lle2" ? "Level 2" : "Level 1"} · ${lessons.length}`;
  }

  const catalogNote = document.querySelector(".catalog-note");
  if (catalogNote) {
    catalogNote.textContent = catalogNoteText(catalog, unlocked);
  }

  renderLevelSwitcher(catalog, level.id);
  renderLevelProgress(level, progress);
  renderLevelClear(level, progress, unlocked);

  const root = document.getElementById("catalog");
  root.dataset.total = String(lessons.length);
  root.dataset.level = level.id;
  root.innerHTML = lessons
    .map((lesson) => {
      const locked = !VOAUnlock.canOpenLesson(lesson);
      const entry = progress[lesson.id];
      const status = getLessonStatus(entry);
      const scoreText =
        !locked && status === "done" && typeof entry.score === "number"
          ? t("scoreText", { score: entry.score, total: entry.total })
          : "";
      const href = pagePath(`lessons/${encodeURIComponent(lesson.id)}.html`);
      const buttonLabel = locked ? t("buttonUnlock") : actionLabel(status);
      const badge = locked
        ? `<p class="status-badge status-locked">${escapeHtml(t("badgeLocked"))}</p>`
        : `<p class="status-badge status-${status}">${escapeHtml(statusLabel(status))}</p>`;

      return `
        <article class="lesson-card${locked ? " is-locked" : ""}" data-status="${locked ? "locked" : status}">
          <div class="lesson-card-top">
            <p class="lesson-number">Lesson ${escapeHtml(lesson.number || "")}</p>
            ${badge}
          </div>
          <h3>${escapeHtml(lesson.title)}</h3>
          <p class="lesson-subtitle">${escapeHtml(lesson.subtitle)}</p>
          ${scoreText ? `<p class="lesson-score">${escapeHtml(scoreText)}</p>` : ""}
          <a class="btn${locked ? "" : " primary"}" href="${href}">${buttonLabel}</a>
        </article>
      `;
    })
    .join("");

  bindCatalogFilters(root, unlocked);
}

function renderLevelSwitcher(catalog, levelId) {
  const root = document.getElementById("level-switcher");
  if (!root || catalog.levels.length < 2) {
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
    }
    return;
  }

  root.hidden = false;
  root.innerHTML = catalog.levels
    .map((level) => {
      const active = level.id === levelId;
      const label = level.id === "lle2" ? "Level 2" : "Level 1";
      return `
        <button type="button" class="level-tab${active ? " is-active" : ""}" data-level="${escapeHtml(level.id)}" aria-pressed="${active ? "true" : "false"}">
          ${escapeHtml(label)} · ${level.lessons.length}
        </button>
      `;
    })
    .join("");

  root.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextId = button.dataset.level;
      if (nextId === levelId) {
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set("level", nextId);
      window.history.replaceState({}, "", url);
      renderCatalog(catalog, nextId);
    });
  });
}

function renderLevelProgress(level, progress) {
  const root = document.getElementById("level-progress");
  if (!root) {
    return;
  }

  const lessons = level.lessons;
  const total = lessons.length;
  const done = completedCount(lessons, progress);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const label = level.id === "lle2" ? "Level 2" : "Level 1";
  root.hidden = false;
  root.innerHTML = `
    <div class="level-progress-row">
      <p class="level-progress-count">${escapeHtml(t("progressDone"))} <strong>${done}</strong> / ${total}</p>
      <p class="level-progress-hint">${escapeHtml(checkinHintText())} · <a href="${pagePath("progress.html")}">${escapeHtml(t("openCheckin"))}</a></p>
    </div>
    <div class="level-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-label="${escapeHtml(t("progressAria", { label }))}">
      <span style="width: ${percent}%"></span>
    </div>
  `;
}

function renderLevelClear(level, progress, unlocked) {
  const root = document.getElementById("level-clear");
  if (!root) {
    return;
  }

  const lessons = level.lessons;
  if (level.id !== "lle1" || !isLevelCleared(lessons, progress)) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }

  const cta = unlocked
    ? `<a class="btn primary" href="${pagePath("progress.html")}">${escapeHtml(t("continueCheckin"))}</a>
       <a class="btn" href="${pagePath("wrongbook.html")}">${escapeHtml(t("reviewWrongbook"))}</a>`
    : `<a class="btn primary" href="${pagePath("pricing.html")}">${escapeHtml(t("unlockHabit"))}</a>
       <a class="btn" href="${pagePath("wrongbook.html")}">${escapeHtml(t("reviewWrongbook"))}</a>`;

  root.hidden = false;
  root.innerHTML = `
    <p class="eyebrow">Level 1</p>
    <h2>${escapeHtml(t("clearTitle"))}</h2>
    <p>${escapeHtml(t("clearBody", { count: lessons.length }))}</p>
    <div class="quiz-actions">${cta}</div>
  `;
}

function applyCatalogFilter(filter, root) {
  const cards = root.querySelectorAll(".lesson-card");
  const empty = document.getElementById("catalog-filter-empty");
  const heading = document.querySelector(".catalog-section h2");
  const total = Number(root.dataset.total || cards.length);
  const levelLabel = root.dataset.level === "lle2" ? "Level 2" : "Level 1";
  let visible = 0;

  cards.forEach((card) => {
    const show = filter === "all" || card.dataset.status === filter;
    card.hidden = !show;
    if (show) {
      visible += 1;
    }
  });

  if (empty) {
    empty.hidden = visible > 0;
  }
  if (heading) {
    heading.textContent =
      filter === "all"
        ? `${levelLabel} · ${total}`
        : `${levelLabel} · ${visible} / ${total}`;
  }
}

function bindCatalogFilters(root, unlocked) {
  const toolbar = document.getElementById("catalog-filters");
  if (!toolbar) {
    return;
  }

  const chips = [
    { id: "all", label: t("filterAll") },
    { id: "not-started", label: t("filterNotStarted") },
    { id: "in-progress", label: t("filterInProgress") },
    { id: "done", label: t("filterDone") },
  ];
  if (!unlocked) {
    chips.push({ id: "locked", label: t("filterLocked") });
  }

  toolbar.hidden = false;
  const fresh = toolbar.cloneNode(false);
  fresh.hidden = false;
  fresh.innerHTML = chips
    .map(
      (chip, index) => `
        <button type="button" class="filter-chip${index === 0 ? " is-active" : ""}" data-filter="${chip.id}" aria-pressed="${index === 0 ? "true" : "false"}">${chip.label}</button>
      `
    )
    .join("");
  toolbar.replaceWith(fresh);

  fresh.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) {
      return;
    }
    fresh.querySelectorAll("[data-filter]").forEach((el) => {
      const active = el === button;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-pressed", active ? "true" : "false");
    });
    applyCatalogFilter(button.dataset.filter, root);
  });

  applyCatalogFilter("all", root);
}

function renderDialogue(dialogue) {
  const root = document.getElementById("dialogue");
  root.innerHTML = dialogue
    .map(
      (line) => `
        <article class="line" data-speaker="${escapeHtml(line.speaker)}">
          <p class="speaker">${escapeHtml(line.speaker)}</p>
          <p class="en" lang="en">${escapeHtml(line.en)}</p>
          <p class="zh">${escapeHtml(line.zh)}</p>
        </article>
      `
    )
    .join("");
}

function renderQuiz(questions) {
  const form = document.getElementById("quiz-form");
  form.innerHTML = questions
    .map(
      (question, index) => `
        <fieldset class="question">
          <legend lang="en">${index + 1}. ${escapeHtml(question.prompt)}</legend>
          ${question.choices
            .map(
              (choice, choiceIndex) => `
                <label class="choice">
                  <input type="radio" name="${escapeHtml(question.id)}" value="${choiceIndex}" required />
                  <span lang="en">${escapeHtml(choice)}</span>
                </label>
              `
            )
            .join("")}
        </fieldset>
      `
    )
    .join("");
}

function applyStoredQuiz(stored) {
  if (!stored || !stored.answers) {
    return;
  }

  Object.entries(stored.answers).forEach(([questionId, answerIndex]) => {
    const input = document.querySelector(
      `input[name="${CSS.escape(questionId)}"][value="${Number(answerIndex)}"]`
    );
    if (input) {
      input.checked = true;
    }
  });

  if (stored.resultText) {
    document.getElementById("quiz-result").textContent = stored.resultText;
  }
}

function collectAnswers(questions) {
  const answers = {};
  questions.forEach((question) => {
    const selected = document.querySelector(`input[name="${CSS.escape(question.id)}"]:checked`);
    answers[question.id] = selected ? Number(selected.value) : null;
  });
  return answers;
}

function updateWrongbookNavCount() {
  const count = VOAStudy.readWrongbook().length;
  document.querySelectorAll("[data-wrongbook-count]").forEach((el) => {
    el.textContent = count ? t("wrongbookCount", { count }) : t("wrongbook");
  });
}

function monthTitle(year, month) {
  return t("monthTitle", { year, month });
}

function renderCheckinCalendar(root, view) {
  if (!root) {
    return view;
  }

  const today = VOAStudy.nowParts();
  const year = view?.year || today.year;
  const month = view?.month || today.month;
  const dates = VOAStudy.readCheckins();
  const streak = VOAStudy.currentStreak(dates);
  const monthCount = VOAStudy.daysCheckedInMonth(year, month, dates);
  const cells = VOAStudy.monthGrid(year, month, dates);
  const weekdays = VOAStudy.WEEKDAY_LABELS.map(
    (label) => `<span class="cal-weekday">${escapeHtml(label)}</span>`
  ).join("");
  const grid = cells
    .map((cell) => {
      if (!cell) {
        return `<span class="cal-day is-empty" aria-hidden="true"></span>`;
      }
      const classes = ["cal-day"];
      if (cell.checked) classes.push("is-checked");
      if (cell.today) classes.push("is-today");
      const label = cell.checked ? t("dayChecked", { day: cell.day }) : `${cell.day}`;
      return `<span class="${classes.join(" ")}" aria-label="${escapeHtml(label)}">${cell.day}</span>`;
    })
    .join("");

  root.innerHTML = `
    <div class="checkin-stats">
      <p><strong>${streak}</strong><span>${escapeHtml(t("statStreak"))}</span></p>
      <p><strong>${monthCount}</strong><span>${escapeHtml(t("statMonth"))}</span></p>
      <p><strong>${dates.length}</strong><span>${escapeHtml(t("statTotal"))}</span></p>
    </div>
    <div class="cal-toolbar">
      <button type="button" class="btn cal-nav" data-cal-dir="-1" aria-label="${escapeHtml(t("prevMonth"))}">‹</button>
      <h3 class="cal-title">${escapeHtml(monthTitle(year, month))}</h3>
      <button type="button" class="btn cal-nav" data-cal-dir="1" aria-label="${escapeHtml(t("nextMonth"))}">›</button>
    </div>
    <div class="cal-grid" role="group" aria-label="${escapeHtml(t("calendarAria", { title: monthTitle(year, month) }))}">
      ${weekdays}
      ${grid}
    </div>
    <p class="checkin-note">${escapeHtml(t("checkinNote"))}</p>
  `;

  root.querySelectorAll("[data-cal-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = new Date(Date.UTC(year, month - 1 + Number(button.dataset.calDir), 1));
      renderCheckinCalendar(root, {
        year: next.getUTCFullYear(),
        month: next.getUTCMonth() + 1,
      });
    });
  });

  return { year, month };
}

function gradeQuiz(lesson, level = null) {
  const answers = collectAnswers(lesson.quiz);
  const score = lesson.quiz.reduce((total, question) => {
    return total + (answers[question.id] === question.answerIndex ? 1 : 0);
  }, 0);
  const resultText = `测验 ${score} / ${lesson.quiz.length}`;
  const wrongCount = VOAStudy.syncWrongbook(lesson, answers).length;
  VOAStudy.recordCheckin();
  updateWrongbookNavCount();

  const progress = readProgress();
  const levelLessons = level?.lessons || [];
  const remainingBefore = levelLessons.filter((item) => !progress[item.id]?.completed);
  const isLastIncomplete =
    remainingBefore.length === 1 && remainingBefore[0].id === lesson.id;

  progress[lesson.id] = {
    score,
    total: lesson.quiz.length,
    completed: true,
    savedAt: new Date().toISOString(),
    answers,
    resultText,
  };
  writeProgress(progress);

  const result = document.getElementById("quiz-result");
  let summary = t("quizChecked", { score, total: lesson.quiz.length, day: VOAStudy.todayKey() });
  if (wrongCount) {
    summary += t("quizWrongSuffix", { count: wrongCount });
  }
  if (isLastIncomplete && level?.id === "lle1" && levelLessons.length) {
    result.innerHTML = `${escapeHtml(summary)}<span class="clear-note">${escapeHtml(t("levelClearNote", { count: levelLessons.length }))}<a href="${pagePath("index.html?level=lle1")}">${escapeHtml(t("backToClear"))}</a></span>`;
    return;
  }
  result.textContent = summary;
}

function resetQuiz(lessonId) {
  document.getElementById("quiz-form").reset();
  document.getElementById("quiz-result").textContent = "";
  const progress = readProgress();
  progress[lessonId] = {
    completed: false,
    savedAt: new Date().toISOString(),
  };
  writeProgress(progress);
}

function hideLessonBody() {
  document.querySelectorAll(".video-section, .dialogue-section, .quiz-section").forEach((el) => {
    el.hidden = true;
  });
}

function showLessonBody() {
  document.querySelectorAll(".video-section, .dialogue-section, .quiz-section").forEach((el) => {
    el.hidden = false;
  });
  const wall = document.getElementById("lesson-paywall");
  if (wall) {
    wall.hidden = true;
  }
  const excerpt = document.querySelector(".excerpt-section");
  if (excerpt) {
    excerpt.hidden = true;
  }
}

function renderLessonPaywall(lesson, level) {
  hideLessonBody();
  const excerpt = document.querySelector(".excerpt-section");
  if (excerpt) {
    excerpt.hidden = false;
  }
  const attribution = document.getElementById("attribution");
  if (attribution && lesson.attribution) {
    attribution.textContent = lesson.attribution;
  }

  const existing = document.getElementById("lesson-paywall");
  if (existing) {
    existing.hidden = false;
    return;
  }

  const backHref = pagePath(`index.html?level=${encodeURIComponent(level?.id || "lle1")}`);
  const overlay = document.createElement("section");
  overlay.id = "lesson-paywall";
  overlay.className = "paywall-section";
  overlay.setAttribute("aria-label", t("paywallAria"));
  overlay.innerHTML = `
    <h2>${escapeHtml(t("paywallTitle"))}</h2>
    <p>${escapeHtml(t("paywallBody"))}</p>
    <p>${escapeHtml(t("paywallNext", { wechat: WECHAT_CONTACT })).replace(WECHAT_CONTACT, `<strong>${WECHAT_CONTACT}</strong>`)}</p>
    <div class="quiz-actions">
      <a class="btn primary" href="${pagePath("pricing.html")}">${escapeHtml(t("paywallCta"))}</a>
      <a class="btn" href="${backHref}">${escapeHtml(t("backCatalog"))}</a>
    </div>
  `;
  const header = document.querySelector(".header");
  const pager = header && header.nextElementSibling;
  if (pager && pager.hasAttribute("data-lesson-pager")) {
    pager.after(overlay);
  } else if (header) {
    header.after(overlay);
  }
}

function renderLessonPager(lessons, current) {
  const pagers = document.querySelectorAll("[data-lesson-pager]");
  if (!pagers.length || !current) {
    return;
  }

  const { prev, next } = neighborLessons(lessons, current.id);
  const linkFor = (lesson, kind) => {
    if (!lesson) {
      const label = kind === "prev" ? t("pagerFirst") : t("pagerLast");
      return `<span class="pager-placeholder">${escapeHtml(label)}</span>`;
    }
    const locked = !VOAUnlock.canOpenLesson(lesson);
    const href = pagePath(`lessons/${encodeURIComponent(lesson.id)}.html`);
    const lockedMark = locked ? t("lockedSuffix") : "";
    const label =
      kind === "prev"
        ? `${t("pagerPrev", { n: lesson.number })}${lockedMark}`
        : `${t("pagerNext", { n: lesson.number })}${lockedMark}`;
    const cls = ["btn"];
    if (!locked && kind === "next") {
      cls.push("primary");
    }
    if (locked) {
      cls.push("is-locked-link");
    }
    return `<a class="${cls.join(" ")}" href="${href}">${escapeHtml(label)}</a>`;
  };

  pagers.forEach((pager) => {
    pager.hidden = false;
    pager.innerHTML = `${linkFor(prev, "prev")}${linkFor(next, "next")}`;
  });
}

function renderLesson(lesson) {
  const heading = document.getElementById("lesson-title");
  if (heading) {
    const sub = lesson.subtitle ? ` ${lesson.subtitle}` : "";
    heading.textContent = t("lessonHeading", { n: lesson.number, sub });
  }
  const subtitle = document.getElementById("lesson-subtitle");
  if (subtitle) {
    const levelName = Number(lesson.level) === 2 || lesson.levelId === "lle2" ? "Level 2" : "Level 1";
    subtitle.textContent = t("lessonMeta", { level: levelName, n: lesson.number });
  }

  const video = document.getElementById("lesson-video");
  if (video) {
    video.preload = "none";
    if (!video.getAttribute("poster")) {
      const poster = document.documentElement.lang === "zh-Hant" ? "img/poster-hant.svg" : "img/poster.svg";
      video.poster = sitePath(poster);
    }
    if (lesson.videoUrl && video.getAttribute("src") !== lesson.videoUrl) {
      video.src = lesson.videoUrl;
    }
  }

  const youtubeLink = document.getElementById("youtube-link");
  const youtubeSep = document.getElementById("youtube-sep");
  if (lesson.youtubeId) {
    youtubeLink.href = `https://www.youtube.com/watch?v=${lesson.youtubeId}`;
    youtubeLink.hidden = false;
    if (youtubeSep) youtubeSep.hidden = false;
  } else {
    youtubeLink.hidden = true;
    if (youtubeSep) youtubeSep.hidden = true;
  }

  const voaLink = document.getElementById("voa-page-link");
  if (lesson.sourceUrl) {
    voaLink.href = lesson.sourceUrl;
  }

  document.getElementById("video-fallback").hidden = false;
  document.getElementById("attribution").textContent = lesson.attribution;
  renderDialogue(lesson.dialogue);
  renderQuiz(lesson.quiz);
}

function renderWrongbookPage() {
  const root = document.getElementById("wrongbook");
  if (!root) {
    return;
  }

  const items = VOAStudy.readWrongbook();
  const clearAll = document.getElementById("clear-wrongbook");
  if (clearAll) {
    clearAll.hidden = items.length === 0;
  }

  if (!items.length) {
    root.innerHTML = `<p class="empty-state">${escapeHtml(t("emptyWrong"))}</p>`;
    return;
  }

  root.innerHTML = VOAStudy.groupWrongbook(items)
    .map((group) => {
      const cards = group.items
        .map((item) => {
          const choices = (item.choices || [])
            .map((choice, index) => {
              const classes = ["wrong-choice"];
              if (index === item.chosenIndex) classes.push("is-chosen");
              if (index === item.correctIndex) classes.push("is-correct");
              const mark =
                index === item.correctIndex
                  ? t("markCorrect")
                  : index === item.chosenIndex
                    ? t("markChosen")
                    : "";
              return `
                <li class="${classes.join(" ")}">
                  <span>${escapeHtml(choice)}</span>
                  ${mark ? `<em>${mark}</em>` : ""}
                </li>
              `;
            })
            .join("");

          return `
            <article class="wrong-card" data-lesson-id="${escapeHtml(item.lessonId)}" data-question-id="${escapeHtml(item.questionId)}">
              <p class="wrong-prompt">${escapeHtml(item.prompt)}</p>
              <ul class="wrong-choices">${choices}</ul>
              <div class="wrong-actions">
                <a class="btn primary" href="${pagePath(`lessons/${encodeURIComponent(item.lessonId)}.html`)}#quiz">${escapeHtml(t("practiceAgain"))}</a>
                <button type="button" class="btn" data-remove-wrong>${escapeHtml(t("removeWrong"))}</button>
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <section class="wrong-group">
          <h3>${escapeHtml(group.lessonTitle || group.lessonId)}</h3>
          ${cards}
        </section>
      `;
    })
    .join("");

  root.querySelectorAll("[data-remove-wrong]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".wrong-card");
      VOAStudy.removeWrongItem(card.dataset.lessonId, card.dataset.questionId);
      updateWrongbookNavCount();
      renderWrongbookPage();
    });
  });
}

async function initCatalog() {
  const root = document.getElementById("catalog");
  renderUnlockNav();
  renderCheckinCalendar(document.getElementById("checkin-root"));
  updateWrongbookNavCount();
  try {
    const catalog = normalizeCatalog(await loadLessons());
    renderCatalog(catalog, selectedLevelId(catalog));
  } catch (error) {
    root.innerHTML = `<p class="quiz-result">${escapeHtml(error.message)}</p>`;
  }
}

function lessonLevelId(lesson) {
  if (lesson.levelId) {
    return lesson.levelId;
  }
  return Number(lesson.level) === 2 || String(lesson.id || "").startsWith("lle2") ? "lle2" : "lle1";
}

function lessonStub() {
  const params = new URLSearchParams(window.location.search);
  const nav = readJsonScript("lesson-nav") || {};
  const id = document.body.dataset.lessonId || params.get("id") || "";
  const level = Number(
    document.body.dataset.lessonLevel || nav.level || (String(id).startsWith("lle2") ? 2 : 1)
  );
  return {
    id,
    number: Number(document.body.dataset.lessonNumber || String(id).match(/(\d+)$/)?.[1] || 0),
    level,
    levelId: document.body.dataset.levelId || nav.levelId || (level === 2 ? "lle2" : "lle1"),
    prev: nav.prev || null,
    next: nav.next || null,
    attribution: document.getElementById("attribution")?.textContent || "",
  };
}

function levelView(lesson) {
  const ids = Array.isArray(lesson.levelLessonIds) ? lesson.levelLessonIds : [];
  return {
    id: lessonLevelId(lesson),
    lessons: ids.map((lessonId) => ({ id: lessonId })),
  };
}

function pagerChain(lesson) {
  return [lesson.prev, lesson, lesson.next].filter(Boolean);
}

function bindLessonChrome(lesson) {
  const levelId = lessonLevelId(lesson);
  writeStoredLevelId(levelId);
  const backLink = document.querySelector(".back-link");
  if (backLink) {
    const label = levelId === "lle2" ? "Level 2" : "Level 1";
    backLink.href = pagePath(`index.html?level=${encodeURIComponent(levelId)}`);
    backLink.textContent = t("backToLevel", { level: label });
  }
}

async function loadLessonDocument(lessonId) {
  const embedded = readJsonScript("lesson-data");
  if (embedded && embedded.id === lessonId) {
    return embedded;
  }
  const response = await fetch(sitePath(`${webDataDir()}lessons/${encodeURIComponent(lessonId)}.json`));
  if (!response.ok) {
    throw new Error(t("lessonMissing", { id: lessonId }));
  }
  return response.json();
}

async function initLesson() {
  const result = document.getElementById("quiz-result");
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get("id");
  if (!document.body.dataset.lessonId && queryId && /^lle[12]-\d{2}$/.test(queryId)) {
    window.location.replace(`${pagePath(`lessons/${queryId}.html`)}${window.location.hash}`);
    return;
  }

  const stub = lessonStub();
  if (!stub.id) {
    if (result) {
      result.textContent = t("pickLesson");
    }
    return;
  }

  try {
    migrateOldProgress();
    renderUnlockNav();
    updateWrongbookNavCount();
    bindLessonChrome(stub);

    if (!VOAUnlock.canOpenLesson(stub)) {
      renderLessonPaywall(stub, levelView(stub));
      renderLessonPager(pagerChain(stub), stub);
      return;
    }

    const lesson = await loadLessonDocument(stub.id);
    markLessonStarted(lesson.id);
    showLessonBody();
    renderLesson(lesson);
    renderLessonPager(pagerChain(lesson), lesson);
    applyStoredQuiz(readProgress()[lesson.id]);

    document.getElementById("quiz-form").addEventListener("submit", (event) => {
      event.preventDefault();
      gradeQuiz(lesson, levelView(lesson));
    });
    document.getElementById("reset-quiz").addEventListener("click", () => {
      resetQuiz(lesson.id);
    });
  } catch (error) {
    if (result) {
      result.textContent = error.message;
    }
  }
}

function renderPricingState() {
  const status = document.getElementById("unlock-status");
  const clearBtn = document.getElementById("clear-unlock");
  const state = VOAUnlock.readUnlock();
  renderUnlockNav();

  if (!status) {
    return;
  }

  if (state) {
    const until = VOAUnlock.formatExpiryDate(state);
    status.textContent = t("unlockStatus", {
      plan: localizedPlan(state.plan),
      until: until ? t("untilSuffix", { date: until }) : "",
    });
    if (clearBtn) {
      clearBtn.hidden = false;
    }
    return;
  }

  status.textContent = t("unlockLocked");
  if (clearBtn) {
    clearBtn.hidden = true;
  }
}

async function initPricing() {
  updateWrongbookNavCount();
  renderPricingState();

  const form = document.getElementById("redeem-form");
  const result = document.getElementById("redeem-result");
  const clearBtn = document.getElementById("clear-unlock");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      result.textContent = "";
      const input = document.getElementById("redeem-code");
      const raw = input ? input.value : "";

      try {
        const codes = await loadCodes();
        const match = VOAUnlock.findCode(codes, raw);
        if (!match) {
          result.textContent = t("redeemInvalid");
          return;
        }
        const state = VOAUnlock.redeem(match);
        if (input) {
          input.value = "";
        }
        renderPricingState();
        const until = VOAUnlock.formatExpiryDate(state);
        result.textContent = t("redeemOk", {
          plan: localizedPlan(match.plan),
          until: until ? t("untilSuffix", { date: until }) : "",
        });
      } catch (error) {
        result.textContent = error.message === "兑换码无效" ? t("redeemInvalidShort") : error.message || t("redeemFail");
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      VOAUnlock.clearUnlock();
      renderPricingState();
      if (result) {
        result.textContent = t("redeemCleared");
      }
    });
  }
}

function initProgress() {
  renderUnlockNav();
  renderCheckinCalendar(document.getElementById("checkin-root"));
  updateWrongbookNavCount();
}

function initWrongbook() {
  renderUnlockNav();
  updateWrongbookNavCount();
  renderWrongbookPage();
  const clearAll = document.getElementById("clear-wrongbook");
  if (clearAll) {
    clearAll.addEventListener("click", () => {
      if (VOAStudy.readWrongbook().length === 0) {
        return;
      }
      if (window.confirm(t("confirmClearWrong"))) {
        VOAStudy.clearWrongbook();
        updateWrongbookNavCount();
        renderWrongbookPage();
      }
    });
  }
}

function init() {
  syncSwitcherLinks();
  rememberScriptChoice();
  if (applyScriptPreference()) {
    return;
  }
  const page = document.body.dataset.page;
  if (page === "catalog") {
    initCatalog();
    return;
  }
  if (page === "lesson") {
    initLesson();
    return;
  }
  if (page === "progress") {
    initProgress();
    return;
  }
  if (page === "wrongbook") {
    initWrongbook();
    return;
  }
  if (page === "pricing") {
    initPricing();
    return;
  }
  if (page === "terms" || page === "privacy" || page === "refund") {
    // Legal pages only need the shared nav state.
    renderUnlockNav();
    updateWrongbookNavCount();
  }
}

init();
