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

function gradeQuiz(lesson) {
  const answers = collectAnswers(lesson.quiz);
  const score = lesson.quiz.reduce((total, question) => {
    return total + (answers[question.id] === question.answerIndex ? 1 : 0);
  }, 0);
  const resultText = `Score: ${score} / ${lesson.quiz.length}`;
  document.getElementById("quiz-result").textContent = resultText;

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

async function initCatalog() {
  const root = document.getElementById("catalog");
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

function init() {
  const page = document.body.dataset.page;
  if (page === "catalog") {
    initCatalog();
    return;
  }
  if (page === "lesson") {
    initLesson();
  }
}

init();
