const loadLesson = require("../data/load-lesson.js");
const catalog = require("../../data/catalog.json");
const { lessonPath } = require("../../utils/catalog.js");
const { WECHAT_CONTACT } = require("../../utils/progress.js");

function neighborLabel(kind, neighbor, locked) {
  if (!neighbor) {
    return kind === "prev" ? "已是第一课" : "已是最后一课";
  }
  if (locked) {
    return kind === "prev" ? "上一课未解锁 · 去开通" : "下一课未解锁 · 去开通";
  }
  return kind === "prev" ? `← 上一课 · ${neighbor.number}` : `下一课 · ${neighbor.number} →`;
}

function toQuestions(quiz, storedAnswers) {
  const answers = storedAnswers || {};
  return (quiz || []).map((question) => ({
    id: question.id,
    prompt: question.prompt,
    choices: question.choices,
    answerIndex: question.answerIndex,
    selectedIndex: Number.isInteger(answers[question.id]) ? answers[question.id] : -1,
  }));
}

Page({
  data: {
    ready: false,
    paywall: false,
    contact: WECHAT_CONTACT,
    lesson: {},
    questions: [],
    resultText: "",
    prev: null,
    next: null,
    prevLabel: "",
    nextLabel: "",
  },

  onLoad(query) {
    this.lessonId = (query && query.id) || "";
    this.loadCurrent();
  },

  loadCurrent() {
    const app = getApp();
    const lesson = loadLesson[this.lessonId];
    if (!lesson) {
      wx.showToast({ title: "未找到该课", icon: "none" });
      this.setData({ ready: true, paywall: true, lesson: { title: this.lessonId, subtitle: "未找到", attribution: "" } });
      return;
    }

    wx.setNavigationBarTitle({ title: lesson.title || "课程" });
    const prevLocked = lesson.prev ? !app.unlock.canOpenLesson(lesson.prev) : false;
    const nextLocked = lesson.next ? !app.unlock.canOpenLesson(lesson.next) : false;
    const paywall = !app.unlock.canOpenLesson(lesson);

    if (paywall) {
      this.setData({
        ready: true,
        paywall: true,
        lesson,
        prev: lesson.prev,
        next: lesson.next,
        prevLabel: neighborLabel("prev", lesson.prev, prevLocked),
        nextLabel: neighborLabel("next", lesson.next, nextLocked),
        questions: [],
        resultText: "",
      });
      return;
    }

    app.progress.markLessonStarted(lesson.id);
    const stored = app.progress.readProgress()[lesson.id] || {};
    this.setData({
      ready: true,
      paywall: false,
      lesson,
      questions: toQuestions(lesson.quiz, stored.answers),
      resultText: stored.resultText || "",
      prev: lesson.prev,
      next: lesson.next,
      prevLabel: neighborLabel("prev", lesson.prev, prevLocked),
      nextLabel: neighborLabel("next", lesson.next, nextLocked),
    });
  },

  onAnswer(event) {
    const questionId = event.currentTarget.dataset.id;
    const selectedIndex = Number(event.detail.value);
    const questions = this.data.questions.map((question) => {
      if (question.id !== questionId) {
        return question;
      }
      return Object.assign({}, question, { selectedIndex });
    });
    this.setData({ questions });
  },

  onSubmit() {
    const app = getApp();
    const lesson = this.data.lesson;
    const unanswered = this.data.questions.filter((question) => !Number.isInteger(question.selectedIndex) || question.selectedIndex < 0);
    if (unanswered.length) {
      wx.showToast({ title: "请答完所有题", icon: "none" });
      return;
    }

    const answers = {};
    this.data.questions.forEach((question) => {
      answers[question.id] = question.selectedIndex;
    });
    const score = this.data.questions.reduce(
      (total, question) => total + (question.selectedIndex === question.answerIndex ? 1 : 0),
      0
    );
    const resultText = `Score: ${score} / ${lesson.quiz.length}`;
    const wrongCount = app.study.syncWrongbook(lesson, answers).length;
    app.study.recordCheckin();
    app.syncWrongbookBadge();

    const progress = app.progress.readProgress();
    const levelId = lesson.levelId;
    const level = catalog.levels.find((item) => item.id === levelId);
    const levelLessons = (level && level.lessons) || [];
    const remainingBefore = levelLessons.filter((item) => !(progress[item.id] && progress[item.id].completed));
    const isLastIncomplete = remainingBefore.length === 1 && remainingBefore[0].id === lesson.id;

    app.progress.saveQuizResult(lesson.id, {
      score,
      total: lesson.quiz.length,
      completed: true,
      savedAt: new Date().toISOString(),
      answers,
      resultText,
    });

    let summary = `${resultText} · 已打卡 ${app.study.todayKey()}`;
    if (wrongCount) {
      summary += ` · 错题本 ${wrongCount} 题`;
    }
    if (isLastIncomplete && levelId === "lle1" && levelLessons.length) {
      summary += ` · Level 1 通关！你完成了全部 ${levelLessons.length} 课测验。`;
    }
    this.setData({ resultText: summary });
  },

  onReset() {
    const app = getApp();
    app.progress.resetQuiz(this.data.lesson.id);
    this.setData({
      questions: toQuestions(this.data.lesson.quiz, {}),
      resultText: "",
    });
  },

  onNeighbor(event) {
    const kind = event.currentTarget.dataset.kind;
    const neighbor = kind === "prev" ? this.data.prev : this.data.next;
    if (!neighbor) {
      return;
    }
    if (!getApp().unlock.canOpenLesson(neighbor)) {
      wx.switchTab({ url: "/pages/pricing/pricing" });
      return;
    }
    wx.redirectTo({ url: lessonPath(neighbor.id) });
  },

  goPricing() {
    wx.switchTab({ url: "/pages/pricing/pricing" });
  },

  goCatalog() {
    wx.switchTab({ url: "/pages/index/index" });
  },
});
