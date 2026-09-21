const catalog = require("../../data/catalog.json");
const { findLevel, selectedLevelId, catalogNoteText, lessonPath, checkinHintText } = require("../../utils/catalog.js");
const { WECHAT_CONTACT } = require("../../utils/progress.js");

function levelLabel(levelId) {
  return levelId === "lle2" ? "Level 2" : "Level 1";
}

Page({
  data: {
    course: catalog.course,
    levels: [],
    levelId: "lle1",
    heading: "",
    catalogNote: "",
    checkinHint: "",
    done: 0,
    total: 0,
    percent: 0,
    cleared: false,
    filter: "all",
    filters: [],
    cards: [],
  },

  onShow() {
    const app = getApp();
    app.syncWrongbookBadge();
    const levelId = selectedLevelId(catalog, app.progress.readLevelId());
    this.render(levelId, this.data.filter || "all");
  },

  render(levelId, filter) {
    const app = getApp();
    const level = findLevel(catalog, levelId);
    const progress = app.progress.readProgress();
    const unlocked = app.unlock.isUnlocked();
    app.progress.writeLevelId(level.id);

    const done = app.progress.completedCount(level.lessons, progress);
    const total = level.lessons.length;
    const filters = [
      { id: "all", label: "全部" },
      { id: "not-started", label: "未学" },
      { id: "in-progress", label: "进行中" },
      { id: "done", label: "已完成" },
    ];
    if (!unlocked) {
      filters.push({ id: "locked", label: "未解锁" });
    }
    const nextFilter = filters.some((item) => item.id === filter) ? filter : "all";

    const cards = level.lessons
      .map((lesson) => {
        const locked = !app.unlock.canOpenLesson(lesson);
        const entry = progress[lesson.id];
        const status = locked ? "locked" : app.progress.getLessonStatus(entry);
        const scoreText =
          !locked && status === "done" && entry && typeof entry.score === "number"
            ? `测验 ${entry.score} / ${entry.total}`
            : "";
        return {
          id: lesson.id,
          number: lesson.number,
          title: lesson.title,
          subtitle: lesson.subtitle,
          locked,
          status,
          badge: locked ? "未解锁" : app.progress.statusLabel(status),
          action: locked ? "开通解锁" : app.progress.actionLabel(status),
          scoreText,
        };
      })
      .filter((card) => nextFilter === "all" || card.status === nextFilter);

    this.setData({
      course: catalog.course,
      levels: catalog.levels.map((item) => ({
        id: item.id,
        label: levelLabel(item.id),
        count: item.lessons.length,
      })),
      levelId: level.id,
      heading: `${levelLabel(level.id)} · ${nextFilter === "all" ? total : `${cards.length} / ${total}`}`,
      catalogNote: catalogNoteText(catalog, unlocked, WECHAT_CONTACT),
      checkinHint: checkinHintText(app.study),
      done,
      total,
      percent: total ? Math.round((done / total) * 100) : 0,
      cleared: level.id === "lle1" && app.progress.isLevelCleared(level.lessons, progress),
      filter: nextFilter,
      filters,
      cards,
    });
  },

  onSwitchLevel(event) {
    const levelId = event.currentTarget.dataset.id;
    if (levelId === this.data.levelId) {
      return;
    }
    this.render(levelId, "all");
  },

  onFilter(event) {
    this.render(this.data.levelId, event.currentTarget.dataset.id);
  },

  onOpenLesson(event) {
    const id = event.currentTarget.dataset.id;
    const locked = Number(event.currentTarget.dataset.locked) === 1;
    if (locked) {
      wx.switchTab({ url: "/pages/pricing/pricing" });
      return;
    }
    wx.navigateTo({ url: lessonPath(id) });
  },
});
