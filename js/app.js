const PROGRESS_KEY = "voa-lle-progress";
const OLD_QUIZ_KEY = "voa-lle1-01-quiz";

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
    return "Done";
  }
  if (status === "in-progress") {
    return "In progress";
  }
  return "Not started";
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

function renderCatalog(payload) {
  const course = payload.course || {};
  const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];
  const progress = migrateOldProgress();

  document.title = course.title || "Let's Learn English · Level 1";
  document.getElementById("course-title").textContent =
    course.title || "Let's Learn English · Level 1";
  document.getElementById("course-pitch").textContent = course.pitch || "";
  document.getElementById("course-disclaimer").textContent = course.disclaimer || "";

  const catalogHeading = document.querySelector(".catalog-section h2");
  if (catalogHeading) {
    catalogHeading.textContent = `Lessons · 课程 · ${lessons.length}`;
  }

  const root = document.getElementById("catalog");
  root.innerHTML = lessons
    .map((lesson) => {
      const entry = progress[lesson.id];
      const status = getLessonStatus(entry);
      const scoreText =
        status === "done" && typeof entry.score === "number"
          ? `Quiz ${entry.score} / ${entry.total}`
          : "";
      const action = status === "not-started" ? "Start" : status === "done" ? "Review" : "Continue";

      return `
        <article class="lesson-card" data-status="${status}">
          <div class="lesson-card-top">
            <p class="lesson-number">Lesson ${escapeHtml(lesson.number || "")}</p>
            <p class="status-badge status-${status}">${statusLabel(status)}</p>
          </div>
          <h3>${escapeHtml(lesson.title)}</h3>
          <p class="lesson-subtitle">${escapeHtml(lesson.subtitle)}</p>
          ${scoreText ? `<p class="lesson-score">${escapeHtml(scoreText)}</p>` : ""}
          <a class="btn primary" href="lesson.html?id=${encodeURIComponent(lesson.id)}">${action}</a>
        </article>
      `;
    })
    .join("");
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

function gradeQuiz(lesson) {
  const answers = collectAnswers(lesson.quiz);
  const score = lesson.quiz.reduce((total, question) => {
    return total + (answers[question.id] === question.answerIndex ? 1 : 0);
  }, 0);
  const resultText = `Score: ${score} / ${lesson.quiz.length}`;
  const wrongCount = VOAStudy.syncWrongbook(lesson, answers).length;
  VOAStudy.recordCheckin();
  updateWrongbookNavCount();

  const result = document.getElementById("quiz-result");
  result.textContent = `${resultText} · 已打卡 ${VOAStudy.todayKey()}`;
  if (wrongCount) {
    result.textContent += ` · 错题本 ${wrongCount} 题`;
  }

  const progress = readProgress();
  progress[lesson.id] = {
    score,
    total: lesson.quiz.length,
    completed: true,
    savedAt: new Date().toISOString(),
    answers,
    resultText,
  };
  writeProgress(progress);
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
    markLessonStarted(lesson.id);
    renderLesson(lesson);
    applyStoredQuiz(readProgress()[lesson.id]);
    updateWrongbookNavCount();

    document.getElementById("quiz-form").addEventListener("submit", (event) => {
      event.preventDefault();
      gradeQuiz(lesson);
    });
    document.getElementById("reset-quiz").addEventListener("click", () => {
      resetQuiz(lesson.id);
    });
  } catch (error) {
    result.textContent = error.message;
  }
}

function initProgress() {
  renderCheckinCalendar(document.getElementById("checkin-root"));
  updateWrongbookNavCount();
}

function initWrongbook() {
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
  }
}

init();
