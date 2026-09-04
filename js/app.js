const LESSON_ID = "lle1-01";
const STORAGE_KEY = "voa-lle1-01-quiz";

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

function findLesson(payload) {
  const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];
  return lessons.find((lesson) => lesson.id === LESSON_ID);
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

function readStoredQuiz() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
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

function gradeQuiz(questions) {
  const answers = collectAnswers(questions);
  const score = questions.reduce((total, question) => {
    return total + (answers[question.id] === question.answerIndex ? 1 : 0);
  }, 0);
  const resultText = `Score: ${score} / ${questions.length}`;
  document.getElementById("quiz-result").textContent = resultText;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      lessonId: LESSON_ID,
      answers,
      score,
      total: questions.length,
      resultText,
    })
  );
}

function resetQuiz() {
  document.getElementById("quiz-form").reset();
  document.getElementById("quiz-result").textContent = "";
  localStorage.removeItem(STORAGE_KEY);
}

function renderLesson(lesson) {
  document.title = lesson.title;
  document.getElementById("lesson-title").textContent = lesson.title;
  document.getElementById("lesson-subtitle").textContent = lesson.subtitle;

  const video = document.getElementById("lesson-video");
  video.src = lesson.videoUrl;

  const youtubeLink = document.getElementById("youtube-link");
  if (lesson.youtubeId) {
    youtubeLink.href = `https://www.youtube.com/watch?v=${lesson.youtubeId}`;
  }
  document.getElementById("video-fallback").hidden = false;

  document.getElementById("attribution").textContent = lesson.attribution;
  renderDialogue(lesson.dialogue);
  renderQuiz(lesson.quiz);
}

async function init() {
  const result = document.getElementById("quiz-result");

  try {
    const payload = await loadLessons();
    const lesson = findLesson(payload);
    if (!lesson) {
      throw new Error("Lesson lle1-01 was not found.");
    }

    renderLesson(lesson);
    applyStoredQuiz(readStoredQuiz());

    document.getElementById("quiz-form").addEventListener("submit", (event) => {
      event.preventDefault();
      gradeQuiz(lesson.quiz);
    });
    document.getElementById("reset-quiz").addEventListener("click", resetQuiz);
  } catch (error) {
    result.textContent = error.message;
  }
}

init();
