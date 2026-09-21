const { calendarView, shiftMonth } = require("../../utils/catalog.js");

Component({
  lifetimes: {
    attached() {
      this.reload();
    },
  },
  pageLifetimes: {
    show() {
      this.reload();
    },
  },
  data: {
    view: {
      year: 2026,
      month: 1,
      title: "",
      streak: 0,
      monthCount: 0,
      total: 0,
      weekdays: [],
      cells: [],
    },
  },
  methods: {
    reload() {
      const app = getApp();
      const current = this.data.view;
      const hasView = current && current.year && current.month && current.title;
      const view = calendarView(
        app.study,
        hasView ? current.year : undefined,
        hasView ? current.month : undefined
      );
      this.setData({ view });
    },
    prevMonth() {
      this.changeMonth(-1);
    },
    nextMonth() {
      this.changeMonth(1);
    },
    changeMonth(delta) {
      const app = getApp();
      const next = shiftMonth(this.data.view.year, this.data.view.month, delta);
      this.setData({ view: calendarView(app.study, next.year, next.month) });
    },
  },
});
