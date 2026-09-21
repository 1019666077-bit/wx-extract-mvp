const { KEYS } = require("./storage.js");

const PROGRESS_KEY = KEYS.progress;
const CATALOG_LEVEL_KEY = KEYS.catalogLevel;
const WECHAT_CONTACT = "15232188653";

function createProgress(storage) {
  function readProgress() {
    try {
      const raw = storage.getItem(PROGRESS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function writeProgress(progress) {
    try {
      storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (error) {
      console.warn("Unable to save lesson progress.", error);
    }
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
    return lessons.filter((lesson) => progress[lesson.id] && progress[lesson.id].completed === true).length;
  }

  function isLevelCleared(lessons, progress) {
    return lessons.length > 0 && lessons.every((lesson) => progress[lesson.id] && progress[lesson.id].completed === true);
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

  function saveQuizResult(lessonId, payload) {
    const progress = readProgress();
    progress[lessonId] = payload;
    writeProgress(progress);
    return progress;
  }

  function resetQuiz(lessonId) {
    const progress = readProgress();
    progress[lessonId] = {
      completed: false,
      savedAt: new Date().toISOString(),
    };
    writeProgress(progress);
    return progress;
  }

  function readLevelId(fallback) {
    return storage.getItem(CATALOG_LEVEL_KEY) || fallback || "";
  }

  function writeLevelId(levelId) {
    storage.setItem(CATALOG_LEVEL_KEY, String(levelId));
  }

  return {
    PROGRESS_KEY,
    CATALOG_LEVEL_KEY,
    WECHAT_CONTACT,
    readProgress,
    writeProgress,
    getLessonStatus,
    statusLabel,
    actionLabel,
    completedCount,
    isLevelCleared,
    markLessonStarted,
    saveQuizResult,
    resetQuiz,
    readLevelId,
    writeLevelId,
  };
}

module.exports = {
  createProgress,
  PROGRESS_KEY,
  CATALOG_LEVEL_KEY,
  WECHAT_CONTACT,
};
