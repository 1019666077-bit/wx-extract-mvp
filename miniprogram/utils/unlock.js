const UNLOCK_KEY = "voa-lle-unlock";
const FREE_LESSON_MAX = 5;
const TIME_ZONE = "Asia/Shanghai";
const ISSUED_CODE_PATTERN = /^LLE-(M|Q)-[A-Z0-9]{6}$/;
const PLAN_DAYS = {
  monthly: 30,
  quarterly: 90,
};
const DEFAULT_PLAN_DAYS = 30;

const PLAN_LABELS = {
  monthly: "月付 ¥39",
  quarterly: "季卡 ¥99",
};

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

function createUnlock(options = {}) {
  const storage = options.storage || (typeof localStorage === "undefined" ? createMemoryStorage() : localStorage);
  const nowFn = options.now || (() => new Date());

  function normalizeCode(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function addCalendarDays(date, days) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  function planDurationDays(plan) {
    return PLAN_DAYS[plan] || DEFAULT_PLAN_DAYS;
  }

  function shanghaiDateKey(date) {
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
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  }

  function formatExpiryDate(state) {
    if (!state || !state.expiresAt) {
      return "";
    }
    const expires = new Date(state.expiresAt);
    if (Number.isNaN(expires.getTime())) {
      return "";
    }
    return shanghaiDateKey(expires);
  }

  function lessonNumber(lesson) {
    if (lesson && Number.isFinite(Number(lesson.number))) {
      return Number(lesson.number);
    }
    const match = String(lesson?.id || "").match(/(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  function lessonLevel(lesson) {
    if (lesson && Number.isFinite(Number(lesson.level))) {
      return Number(lesson.level);
    }
    const id = String(lesson?.id || "");
    const match = id.match(/^lle(\d+)/i);
    if (match) {
      return Number(match[1]);
    }
    return 1;
  }

  function isFreeTrialLesson(lesson) {
    return lessonLevel(lesson) === 1 && lessonNumber(lesson) <= FREE_LESSON_MAX;
  }

  function isPaidLesson(lesson) {
    return !isFreeTrialLesson(lesson);
  }

  function isExpiredState(parsed) {
    if (!parsed || parsed.active !== true) {
      return true;
    }
    if (!parsed.expiresAt) {
      return true;
    }
    const expires = new Date(parsed.expiresAt);
    if (Number.isNaN(expires.getTime())) {
      return true;
    }
    return nowFn().getTime() > expires.getTime();
  }

  function readUnlock() {
    try {
      const raw = storage.getItem(UNLOCK_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (isExpiredState(parsed)) {
        storage.removeItem(UNLOCK_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeUnlock(state) {
    storage.setItem(UNLOCK_KEY, JSON.stringify(state));
    return state;
  }

  function isUnlocked() {
    return Boolean(readUnlock());
  }

  function canOpenLesson(lesson) {
    return !isPaidLesson(lesson) || isUnlocked();
  }

  function planLabel(plan) {
    return PLAN_LABELS[plan] || plan || "已开通";
  }

  function findCode(codes, input) {
    const needle = normalizeCode(input);
    if (!needle) {
      return null;
    }
    const list = Array.isArray(codes) ? codes : [];
    if (list.length > 0) {
      return list.find((entry) => normalizeCode(entry && entry.code) === needle) || null;
    }
    const match = needle.match(ISSUED_CODE_PATTERN);
    if (!match) {
      return null;
    }
    return {
      code: needle,
      plan: match[1] === "Q" ? "quarterly" : "monthly",
    };
  }

  function redeem(codeEntry) {
    if (!codeEntry || !codeEntry.code) {
      throw new Error("兑换码无效");
    }
    const now = nowFn();
    const plan = codeEntry.plan || "unlocked";
    return writeUnlock({
      active: true,
      code: normalizeCode(codeEntry.code),
      plan,
      unlockedAt: now.toISOString(),
      expiresAt: addCalendarDays(now, planDurationDays(plan)).toISOString(),
    });
  }

  function clearUnlock() {
    storage.removeItem(UNLOCK_KEY);
    return null;
  }

  return {
    UNLOCK_KEY,
    FREE_LESSON_MAX,
    PLAN_LABELS,
    PLAN_DAYS,
    ISSUED_CODE_PATTERN,
    TIME_ZONE,
    normalizeCode,
    lessonNumber,
    lessonLevel,
    isFreeTrialLesson,
    isPaidLesson,
    readUnlock,
    isUnlocked,
    canOpenLesson,
    planLabel,
    formatExpiryDate,
    findCode,
    redeem,
    clearUnlock,
  };
}

const VOAUnlock = createUnlock();
VOAUnlock.createUnlock = createUnlock;
VOAUnlock.createMemoryStorage = createMemoryStorage;

if (typeof window !== "undefined") {
  window.VOAUnlock = VOAUnlock;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = VOAUnlock;
}
