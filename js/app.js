const PROGRESS_KEY = "voa-lle-progress";
const OLD_QUIZ_KEY = "voa-lle1-01-quiz";
const WECHAT_CONTACT = "15232188653";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadLessons() {
  const response = await fetch("data/lessons.json");
  if (!response.ok) {
    throw new Error("Unable to load lesson data.");
  }
  return response.json();
}

async function loadCodes() {
  const response = await fetch("data/codes.json");
  if (!response.ok) {
    throw new Error("Unable to load redeem codes.");
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
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
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
        resultText: parsed.resultText || `Score: ${parsed.score} / ${parsed.total}`,
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
    return "已完成";
  }
  if (status === "in-progress") {
    return "学习中";
  }
  return "未开始";
}

function actionLabel(status) {
  if (status === "done") {
    return "复习";
  }
  if (status === "in-progress") {
    return "继续";
  }
  return "开始";
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

function catalogNoteText(lessonCount, unlocked) {
  if (unlocked) {
    return `已解锁 Level 1 全部 ${lessonCount} 课。免费试学第 1–5 课对所有人开放。坚持打卡、复习错题本，把这套课学下去。`;
  }
  return `免费试学第 1–5 课。开通解锁 Level 1 全部 ${lessonCount} 课，并保留打卡与错题本，帮你学得下去。微信联系 ${WECHAT_CONTACT} 付款（¥39 月 / ¥99 季），获兑换码后到开通页输入解锁。`;
}

function checkinHintText() {
  const dates = VOAStudy.readCheckins();
  const today = VOAStudy.todayKey();
  const streak = VOAStudy.currentStreak(dates);
  const checkedToday = dates.includes(today);
  if (checkedToday) {
    return streak > 1 ? `今日已打卡 · 连续 ${streak} 天` : "今日已打卡";
  }
  if (streak > 0) {
    return `连续打卡 ${streak} 天，今天还没打`;
  }
  return "提交测验即可打卡";
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
    el.textContent = unlocked ? "已解锁" : "开通";
    el.classList.toggle("is-unlocked", unlocked);
  });
}

function renderCatalog(payload) {
  const course = payload.course || {};
  const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];
  const progress = migrateOldProgress();
  const unlocked = VOAUnlock.isUnlocked();

  document.title = course.title || "Let's Learn English · Level 1";
  document.getElementById("course-title").textContent =
    course.title || "Let's Learn English · Level 1";
  document.getElementById("course-pitch").textContent = course.pitch || "";
  document.getElementById("course-disclaimer").textContent = course.disclaimer || "";

  const catalogHeading = document.querySelector(".catalog-section h2");
  if (catalogHeading) {
    catalogHeading.textContent = `Lessons · 课程 · ${lessons.length}`;
  }

  const catalogNote = document.querySelector(".catalog-note");
  if (catalogNote) {
    catalogNote.textContent = catalogNoteText(lessons.length, unlocked);
  }

  renderLevelProgress(lessons, progress);
  renderLevelClear(lessons, progress, unlocked);

  const root = document.getElementById("catalog");
  root.dataset.total = String(lessons.length);
  root.innerHTML = lessons
    .map((lesson) => {
      const locked = !VOAUnlock.canOpenLesson(lesson);
      const entry = progress[lesson.id];
      const status = getLessonStatus(entry);
      const scoreText =
        !locked && status === "done" && typeof entry.score === "number"
          ? `测验 ${entry.score} / ${entry.total}`
          : "";
      const href = locked
        ? "pricing.html"
        : `lesson.html?id=${encodeURIComponent(lesson.id)}`;
      const buttonLabel = locked ? "开通解锁" : actionLabel(status);
      const badge = locked
        ? `<p class="status-badge status-locked">未解锁</p>`
        : `<p class="status-badge status-${status}">${statusLabel(status)}</p>`;

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

function renderLevelProgress(lessons, progress) {
  const root = document.getElementById("level-progress");
  if (!root) {
    return;
  }

  const total = lessons.length;
  const done = completedCount(lessons, progress);
  const percent = total ? Math.round((done / total) * 100) : 0;
  root.hidden = false;
  root.innerHTML = `
    <div class="level-progress-row">
      <p class="level-progress-count">已完成 <strong>${done}</strong> / ${total}</p>
      <p class="level-progress-hint">${escapeHtml(checkinHintText())} · <a href="progress.html">打开打卡</a></p>
    </div>
    <div class="level-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-label="Level 1 完成进度">
      <span style="width: ${percent}%"></span>
    </div>
  `;
}

function renderLevelClear(lessons, progress, unlocked) {
  const root = document.getElementById("level-clear");
  if (!root) {
    return;
  }

  if (!isLevelCleared(lessons, progress)) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }

  const cta = unlocked
    ? `<a class="btn primary" href="progress.html">继续打卡</a>
       <a class="btn" href="wrongbook.html">复习错题本</a>`
    : `<a class="btn primary" href="pricing.html">开通解锁，把习惯学下去</a>
       <a class="btn" href="wrongbook.html">复习错题本</a>`;

  root.hidden = false;
  root.innerHTML = `
    <p class="eyebrow">Level 1</p>
    <h2>通关！你学完了这一级</h2>
    <p>恭喜完成全部 ${lessons.length} 课测验。坚持学完不容易——接下来用打卡保持节奏，用错题本把漏掉的句子补上。</p>
    <div class="quiz-actions">${cta}</div>
  `;
}

function applyCatalogFilter(filter, root) {
  const cards = root.querySelectorAll(".lesson-card");
  const empty = document.getElementById("catalog-filter-empty");
  const heading = document.querySelector(".catalog-section h2");
  const total = Number(root.dataset.total || cards.length);
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
      filter === "all" ? `Lessons · 课程 · ${total}` : `Lessons · 课程 · ${visible} / ${total}`;
  }
}

function bindCatalogFilters(root, unlocked) {
  const toolbar = document.getElementById("catalog-filters");
  if (!toolbar) {
    return;
  }

  const chips = [
    { id: "all", label: "全部" },
    { id: "not-started", label: "未学" },
    { id: "in-progress", label: "进行中" },
    { id: "done", label: "已完成" },
  ];
  if (!unlocked) {
    chips.push({ id: "locked", label: "未解锁" });
  }

  toolbar.hidden = false;
  toolbar.innerHTML = chips
    .map(
      (chip, index) => `
        <button type="button" class="filter-chip${index === 0 ? " is-active" : ""}" data-filter="${chip.id}" aria-pressed="${index === 0 ? "true" : "false"}">${chip.label}</button>
      `
    )
    .join("");

  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) {
      return;
    }
    toolbar.querySelectorAll("[data-filter]").forEach((el) => {
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
          <p class="en">${escapeHtml(line.en)}</p>
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
          <legend>${index + 1}. ${escapeHtml(question.prompt)}</legend>
          ${question.choices
            .map(
              (choice, choiceIndex) => `
                <label class="choice">
                  <input type="radio" name="${escapeHtml(question.id)}" value="${choiceIndex}" required />
                  <span>${escapeHtml(choice)}</span>
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
    el.textContent = count ? `错题本 (${count})` : "错题本";
  });
}

function monthTitle(year, month) {
  return `${year}年${month}月`;
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
      const label = cell.checked ? `${cell.day}，已打卡` : `${cell.day}`;
      return `<span class="${classes.join(" ")}" aria-label="${escapeHtml(label)}">${cell.day}</span>`;
    })
    .join("");

  root.innerHTML = `
    <div class="checkin-stats">
      <p><strong>${streak}</strong><span>连续天数</span></p>
      <p><strong>${monthCount}</strong><span>当月打卡</span></p>
      <p><strong>${dates.length}</strong><span>累计打卡</span></p>
    </div>
    <div class="cal-toolbar">
      <button type="button" class="btn cal-nav" data-cal-dir="-1" aria-label="上一月">‹</button>
      <h3 class="cal-title">${escapeHtml(monthTitle(year, month))}</h3>
      <button type="button" class="btn cal-nav" data-cal-dir="1" aria-label="下一月">›</button>
    </div>
    <div class="cal-grid" role="grid" aria-label="${escapeHtml(monthTitle(year, month))}打卡日历">
      ${weekdays}
      ${grid}
    </div>
    <p class="checkin-note">提交任意课程测验即计为当日打卡。日期按 Asia/Shanghai（北京时间）。</p>
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

function gradeQuiz(lesson, lessons = []) {
  const answers = collectAnswers(lesson.quiz);
  const score = lesson.quiz.reduce((total, question) => {
    return total + (answers[question.id] === question.answerIndex ? 1 : 0);
  }, 0);
  const resultText = `Score: ${score} / ${lesson.quiz.length}`;
  const wrongCount = VOAStudy.syncWrongbook(lesson, answers).length;
  VOAStudy.recordCheckin();
  updateWrongbookNavCount();

  const progress = readProgress();
  const remainingBefore = lessons.filter((item) => !progress[item.id]?.completed);
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
  let summary = `${resultText} · 已打卡 ${VOAStudy.todayKey()}`;
  if (wrongCount) {
    summary += ` · 错题本 ${wrongCount} 题`;
  }
  if (isLastIncomplete && lessons.length) {
    result.innerHTML = `${escapeHtml(summary)}<span class="clear-note">Level 1 通关！你完成了全部 ${lessons.length} 课测验。<a href="index.html">回课表看通关纪念</a></span>`;
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

function renderLessonPaywall(lesson, lessonCount = 52) {
  hideLessonBody();
  document.title = `${lesson.title} · 未解锁`;
  document.getElementById("lesson-title").textContent = lesson.title;
  document.getElementById("lesson-subtitle").textContent = "该课需开通后学习";
  document.getElementById("attribution").textContent = lesson.attribution || "";

  const existing = document.getElementById("lesson-paywall");
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement("section");
  overlay.id = "lesson-paywall";
  overlay.className = "paywall-section";
  overlay.setAttribute("aria-label", "Paywall");
  overlay.innerHTML = `
    <h2>课程未解锁</h2>
    <p>免费试学第 1–5 课。开通解锁 Level 1 全部 ${lessonCount} 课，并保留打卡与错题本，帮你学得下去。</p>
    <p>下一步：去开通页看方案，微信联系 <strong>${WECHAT_CONTACT}</strong> 付款（¥39 月 / ¥99 季），获兑换码后在开通页输入解锁。</p>
    <div class="quiz-actions">
      <a class="btn primary" href="pricing.html">去开通 · 输入兑换码</a>
      <a class="btn" href="index.html">返回课表</a>
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
      const label = kind === "prev" ? "已是第一课" : "已是最后一课";
      return `<span class="pager-placeholder">${label}</span>`;
    }
    const locked = !VOAUnlock.canOpenLesson(lesson);
    const href = locked ? "pricing.html" : `lesson.html?id=${encodeURIComponent(lesson.id)}`;
    const label = locked
      ? kind === "prev"
        ? "上一课未解锁 · 去开通"
        : "下一课未解锁 · 去开通"
      : kind === "prev"
        ? `← 上一课 · ${lesson.number}`
        : `下一课 · ${lesson.number} →`;
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
  document.title = lesson.title;
  document.getElementById("lesson-title").textContent = lesson.title;
  document.getElementById("lesson-subtitle").textContent = lesson.subtitle;

  const video = document.getElementById("lesson-video");
  video.src = lesson.videoUrl;

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
    root.innerHTML = `<p class="empty-state">暂无错题</p>`;
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
                  ? "正确答案"
                  : index === item.chosenIndex
                    ? "你的选择"
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
                <a class="btn primary" href="lesson.html?id=${encodeURIComponent(item.lessonId)}#quiz">再练</a>
                <button type="button" class="btn" data-remove-wrong>清除这题</button>
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
    const payload = await loadLessons();
    renderCatalog(payload);
  } catch (error) {
    root.innerHTML = `<p class="quiz-result">${escapeHtml(error.message)}</p>`;
  }
}

async function initLesson() {
  const result = document.getElementById("quiz-result");
  const lessonId = new URLSearchParams(window.location.search).get("id");

  if (!lessonId) {
    result.textContent = "No lesson selected.";
    return;
  }

  try {
    const payload = await loadLessons();
    const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} was not found.`);
    }

    migrateOldProgress();
    renderUnlockNav();
    updateWrongbookNavCount();

    if (!VOAUnlock.canOpenLesson(lesson)) {
      renderLessonPaywall(lesson, lessons.length);
      renderLessonPager(lessons, lesson);
      return;
    }

    markLessonStarted(lesson.id);
    renderLesson(lesson);
    renderLessonPager(lessons, lesson);
    applyStoredQuiz(readProgress()[lesson.id]);

    document.getElementById("quiz-form").addEventListener("submit", (event) => {
      event.preventDefault();
      gradeQuiz(lesson, lessons);
    });
    document.getElementById("reset-quiz").addEventListener("click", () => {
      resetQuiz(lesson.id);
    });
  } catch (error) {
    result.textContent = error.message;
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
    const when = state.unlockedAt ? String(state.unlockedAt).slice(0, 10) : "";
    status.textContent = `已解锁 · ${VOAUnlock.planLabel(state.plan)}${when ? ` · ${when}` : ""}`;
    if (clearBtn) {
      clearBtn.hidden = false;
    }
    return;
  }

  status.textContent = "当前未解锁。第 1–5 课可免费试学。";
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
          result.textContent = "兑换码无效，请核对后重试。";
          return;
        }
        VOAUnlock.redeem(match);
        if (input) {
          input.value = "";
        }
        renderPricingState();
        result.textContent = `解锁成功：${VOAUnlock.planLabel(match.plan)}。可学习 Level 1 全部课程。`;
      } catch (error) {
        result.textContent = error.message || "解锁失败。";
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      VOAUnlock.clearUnlock();
      renderPricingState();
      if (result) {
        result.textContent = "已退出解锁。第 6 课及之后再次锁定。";
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
      if (window.confirm("清除全部错题？")) {
        VOAStudy.clearWrongbook();
        updateWrongbookNavCount();
        renderWrongbookPage();
      }
    });
  }
}

function init() {
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
  }
}

init();
