const { lessonPath } = require("../../utils/catalog.js");

function choiceViews(item) {
  return (item.choices || []).map((text, index) => ({
    index,
    text,
    chosen: index === item.chosenIndex,
    correct: index === item.correctIndex,
    mark: index === item.correctIndex ? "正确答案" : index === item.chosenIndex ? "你的选择" : "",
  }));
}

Page({
  data: {
    hasItems: false,
    groups: [],
  },

  onShow() {
    this.reload();
  },

  reload() {
    const app = getApp();
    app.syncWrongbookBadge();
    const items = app.study.readWrongbook();
    const groups = app.study.groupWrongbook(items).map((group) => ({
      lessonId: group.lessonId,
      lessonTitle: group.lessonTitle || group.lessonId,
      items: group.items.map((item) => ({
        lessonId: item.lessonId,
        questionId: item.questionId,
        prompt: item.prompt,
        choiceViews: choiceViews(item),
      })),
    }));
    this.setData({
      hasItems: items.length > 0,
      groups,
    });
  },

  onRetry(event) {
    wx.navigateTo({ url: lessonPath(event.currentTarget.dataset.id) });
  },

  onRemove(event) {
    const { lessonId, questionId } = event.currentTarget.dataset;
    getApp().study.removeWrongItem(lessonId, questionId);
    this.reload();
  },

  onClearAll() {
    wx.showModal({
      title: "清除全部错题？",
      success: (res) => {
        if (res.confirm) {
          getApp().study.clearWrongbook();
          this.reload();
        }
      },
    });
  },
});
