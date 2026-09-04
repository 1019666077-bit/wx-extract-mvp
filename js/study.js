const CHECKIN_KEY = "voa-lle-checkins";
const WRONGBOOK_KEY = "voa-lle-wrongbook";
const TIME_ZONE = "Asia/Shanghai";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function createStudy(options = {}) {
  const storage = options.storage || (typeof localStorage === "undefined" ? createMemoryStorage() : localStorage);
  const nowFn = options.now || (() => new Date());

  function nowParts(date = nowFn()) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = {};
    formatter.formatToParts(date).forEach((part) => {
      if (part.type !== "literal") {
        parts[part.type] = part.value;
      }
    });
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
    };
  }

  function formatDateKey(year, month, day) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  function todayKey(date = nowFn()) {
    const parts = nowParts(date);
    return formatDateKey(parts.year, parts.month, parts.day);
  }

  function shiftDateKey(dateKey, days) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day));
    utc.setUTCDate(utc.getUTCDate() + days);
    return formatDateKey(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function mondayOffset(year, month) {
    const weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return (weekday + 6) % 7;
  }

  function readJson(key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function readCheckins() {
    const parsed = readJson(CHECKIN_KEY, []);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [...new Set(parsed.filter((item) => typeof item === "string"))].sort();
  }

  function writeCheckins(dates) {
    writeJson(CHECKIN_KEY, [...new Set(dates)].sort());
  }

  function recordCheckin(date = nowFn()) {
    const dates = readCheckins();
    const key = todayKey(date);
    if (!dates.includes(key)) {
      dates.push(key);
      writeCheckins(dates);
    }
    return dates;
  }

  function currentStreak(dates = readCheckins(), date = nowFn()) {
    const set = new Set(dates);
    let cursor = todayKey(date);
    if (!set.has(cursor)) {
      cursor = shiftDateKey(cursor, -1);
      if (!set.has(cursor)) {
        return 0;
      }
    }
    let streak = 0;
    while (set.has(cursor)) {
      streak += 1;
      cursor = shiftDateKey(cursor, -1);
    }
    return streak;
  }

  function daysCheckedInMonth(year, month, dates = readCheckins()) {
    const prefix = `${year}-${pad2(month)}-`;
    return dates.filter((item) => item.startsWith(prefix)).length;
  }

  function monthGrid(year, month, dates = readCheckins(), date = nowFn()) {
    const checked = new Set(dates);
    const today = todayKey(date);
    const blanks = mondayOffset(year, month);
    const totalDays = daysInMonth(year, month);
    const cells = [];

    for (let i = 0; i < blanks; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const key = formatDateKey(year, month, day);
      cells.push({
        day,
        dateKey: key,
        checked: checked.has(key),
        today: key === today,
      });
    }

    return cells;
  }

  function itemKey(lessonId, questionId) {
    return `${lessonId}::${questionId}`;
  }

  function readWrongbook() {
    const parsed = readJson(WRONGBOOK_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function writeWrongbook(items) {
    writeJson(WRONGBOOK_KEY, items);
  }

  function syncWrongbook(lesson, answers, date = nowFn()) {
    const map = new Map(readWrongbook().map((item) => [itemKey(item.lessonId, item.questionId), item]));
    const savedAt = date.toISOString();

    (lesson.quiz || []).forEach((question) => {
      const key = itemKey(lesson.id, question.id);
      const chosenIndex = answers[question.id];
      const answered = Number.isInteger(chosenIndex);
      const correct = answered && chosenIndex === question.answerIndex;

      if (correct) {
        map.delete(key);
        return;
      }

      if (!answered) {
        return;
      }

      map.set(key, {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        questionId: question.id,
        prompt: question.prompt,
        choices: question.choices,
        correctIndex: question.answerIndex,
        chosenIndex,
        savedAt,
      });
    });

    const next = [...map.values()].sort((a, b) => {
      if (a.lessonId === b.lessonId) {
        return String(a.questionId).localeCompare(String(b.questionId));
      }
      return String(a.lessonId).localeCompare(String(b.lessonId));
    });
    writeWrongbook(next);
    return next;
  }

  function removeWrongItem(lessonId, questionId) {
    const next = readWrongbook().filter(
      (item) => !(item.lessonId === lessonId && item.questionId === questionId)
    );
    writeWrongbook(next);
    return next;
  }

  function clearWrongbook() {
    writeWrongbook([]);
    return [];
  }

  function groupWrongbook(items = readWrongbook()) {
    const groups = [];
    const indexByLesson = new Map();

    items.forEach((item) => {
      if (!indexByLesson.has(item.lessonId)) {
        indexByLesson.set(item.lessonId, groups.length);
        groups.push({
          lessonId: item.lessonId,
          lessonTitle: item.lessonTitle,
          items: [],
        });
      }
      groups[indexByLesson.get(item.lessonId)].items.push(item);
    });

    return groups;
  }

  return {
    CHECKIN_KEY,
    WRONGBOOK_KEY,
    TIME_ZONE,
    WEEKDAY_LABELS,
    todayKey,
    nowParts,
    shiftDateKey,
    readCheckins,
    recordCheckin,
    currentStreak,
    daysCheckedInMonth,
    monthGrid,
    readWrongbook,
    syncWrongbook,
    removeWrongItem,
    clearWrongbook,
    groupWrongbook,
  };
}

const VOAStudy = createStudy();
VOAStudy.createStudy = createStudy;
VOAStudy.createMemoryStorage = createMemoryStorage;

if (typeof window !== "undefined") {
  window.VOAStudy = VOAStudy;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = VOAStudy;
}
