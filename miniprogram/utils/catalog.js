function findLevel(catalog, levelId) {
  return catalog.levels.find((level) => level.id === levelId) || catalog.levels[0];
}

function selectedLevelId(catalog, storedId) {
  if (storedId && catalog.levels.some((level) => level.id === storedId)) {
    return storedId;
  }
  return catalog.levels[0].id;
}

function catalogNoteText(catalog, unlocked, contact) {
  const l1 = findLevel(catalog, "lle1");
  const l2 = catalog.levels.find((level) => level.id === "lle2");
  const l1n = l1 ? l1.lessons.length : 0;
  const l2n = l2 ? l2.lessons.length : 0;
  if (unlocked) {
    return `已解锁全部已上线课程（Level 1 ${l1n} 课 + Level 2 ${l2n} 课）。打卡日历与错题本免费使用。免费试学仅 Level 1 第 1–5 课。`;
  }
  return `免费试学仅 Level 1 第 1–5 课。开通解锁全部已上线课程（含 Level 1 + Level 2 已发布课）。打卡日历与错题本免费使用（无需开通）。微信联系 ${contact} 付款（¥39 月 / ¥99 季），获兑换码后到开通页输入解锁。`;
}

function lessonPath(lessonId) {
  return `/packageLessons/lesson/lesson?id=${encodeURIComponent(lessonId)}`;
}

function checkinHintText(study) {
  const dates = study.readCheckins();
  const today = study.todayKey();
  const streak = study.currentStreak(dates);
  const checkedToday = dates.indexOf(today) !== -1;
  if (checkedToday) {
    return streak > 1 ? `今日已打卡 · 连续 ${streak} 天` : "今日已打卡";
  }
  if (streak > 0) {
    return `连续打卡 ${streak} 天，今天还没打`;
  }
  return "提交测验即可打卡";
}

function monthTitle(year, month) {
  return `${year}年${month}月`;
}

function shiftMonth(year, month, delta) {
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
  };
}

function calendarView(study, year, month) {
  const today = study.nowParts();
  const viewYear = year || today.year;
  const viewMonth = month || today.month;
  const dates = study.readCheckins();
  return {
    year: viewYear,
    month: viewMonth,
    title: monthTitle(viewYear, viewMonth),
    streak: study.currentStreak(dates),
    monthCount: study.daysCheckedInMonth(viewYear, viewMonth, dates),
    total: dates.length,
    weekdays: study.WEEKDAY_LABELS,
    cells: study.monthGrid(viewYear, viewMonth, dates).map((cell, index) => {
      if (!cell) {
        return { key: `empty-${index}`, empty: true, day: "", checked: false, today: false };
      }
      return {
        key: cell.dateKey,
        empty: false,
        day: cell.day,
        checked: cell.checked,
        today: cell.today,
      };
    }),
  };
}

module.exports = {
  findLevel,
  selectedLevelId,
  catalogNoteText,
  lessonPath,
  checkinHintText,
  monthTitle,
  shiftMonth,
  calendarView,
};
