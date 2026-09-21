const runtime = require("./utils/runtime.js");
const { createProgress } = require("./utils/progress.js");

App({
  study: runtime.study,
  unlock: runtime.unlock,
  progress: createProgress(runtime.storage),
  storage: runtime.storage,

  onLaunch() {
    this.syncWrongbookBadge();
  },

  syncWrongbookBadge() {
    const count = this.study.readWrongbook().length;
    if (count > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: String(count > 99 ? "99+" : count),
        fail() {},
      });
    } else {
      wx.removeTabBarBadge({ index: 2, fail() {} });
    }
  },
});
