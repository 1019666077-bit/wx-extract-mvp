const { WECHAT_CONTACT } = require("../../utils/progress.js");

Page({
  data: {
    contact: WECHAT_CONTACT,
    code: "",
    statusText: "",
    resultText: "",
    unlocked: false,
  },

  onShow() {
    getApp().syncWrongbookBadge();
    this.renderStatus();
  },

  renderStatus() {
    const unlock = getApp().unlock;
    const state = unlock.readUnlock();
    if (state) {
      const until = unlock.formatExpiryDate(state);
      this.setData({
        unlocked: true,
        statusText: `已解锁 · ${unlock.planLabel(state.plan)}${until ? ` · 到期 ${until}` : ""}`,
      });
      return;
    }
    this.setData({
      unlocked: false,
      statusText: "当前未解锁或已过期。仅 Level 1 第 1–5 课可免费试学。",
    });
  },

  onCodeInput(event) {
    this.setData({ code: event.detail.value });
  },

  onCopyContact() {
    wx.setClipboardData({
      data: WECHAT_CONTACT,
      success() {
        wx.showToast({ title: "已复制微信号", icon: "none" });
      },
    });
  },

  onRedeem() {
    const unlock = getApp().unlock;
    const match = unlock.findCode([], this.data.code);
    if (!match) {
      this.setData({ resultText: "兑换码无效，请核对后重试。" });
      return;
    }
    try {
      const state = unlock.redeem(match);
      const until = unlock.formatExpiryDate(state);
      this.setData({
        code: "",
        resultText: `解锁成功：${unlock.planLabel(match.plan)}${until ? ` · 到期 ${until}` : ""}。可学习全部已上线课程（含 Level 1 + Level 2 已发布课）。`,
      });
      this.renderStatus();
    } catch (error) {
      this.setData({ resultText: error.message || "解锁失败。" });
    }
  },

  onClear() {
    getApp().unlock.clearUnlock();
    this.setData({ resultText: "已退出解锁。除 Level 1 第 1–5 课外再次锁定。" });
    this.renderStatus();
  },
});
