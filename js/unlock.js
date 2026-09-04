const UNLOCK_KEY = "voa-lle-unlock";
const FREE_LESSON_MAX = 5;

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

  function lessonNumber(lesson) {
    if (lesson && Number.isFinite(Number(lesson.number))) {
      return Number(lesson.number);
    }
    const match = String(lesson?.id || "").match(/(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  function isPaidLesson(lesson) {
    return lessonNumber(lesson) > FREE_LESSON_MAX;
  }

  function readUnlock() {
    try {
      const raw = storage.getItem(UNLOCK_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.active !== true) {
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
    return (
      list.find((entry) => normalizeCode(entry && entry.code) === needle) || null
    );
  }

  function redeem(codeEntry) {
    if (!codeEntry || !codeEntry.code) {
      throw new Error("兑换码无效");
    }
    return writeUnlock({
      active: true,
      code: normalizeCode(codeEntry.code),
      plan: codeEntry.plan || "unlocked",
      unlockedAt: nowFn().toISOString(),
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
    normalizeCode,
    lessonNumber,
    isPaidLesson,
    readUnlock,
    isUnlocked,
    canOpenLesson,
    planLabel,
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
