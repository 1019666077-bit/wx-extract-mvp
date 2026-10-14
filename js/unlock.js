const UNLOCK_KEY = "voa-lle-unlock";
const FREE_LESSON_MAX = 5;
const TIME_ZONE = "Asia/Shanghai";
const PLAN_DAYS = {
  monthly: 30,
  quarterly: 90,
};

const PLAN_LABELS = {
  monthly: "月付 US$5.99",
  quarterly: "季卡 US$13.99",
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
  let trusted = null;

  function pad2(value) {
    return String(value).padStart(2, "0");
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
    if (!parsed || parsed.active !== true || !parsed.expiresAt) {
      return true;
    }
    const expires = new Date(parsed.expiresAt);
    if (Number.isNaN(expires.getTime())) {
      return true;
    }
    return nowFn().getTime() > expires.getTime();
  }

  function readStored() {
    try {
      const raw = storage.getItem(UNLOCK_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      storage.removeItem(UNLOCK_KEY);
      trusted = null;
      return null;
    }
  }

  function readUnlock() {
    const parsed = readStored();
    if (!parsed) {
      return null;
    }
    if (!parsed.credential || typeof parsed.credential !== "string") {
      storage.removeItem(UNLOCK_KEY);
      trusted = null;
      return null;
    }
    if (isExpiredState(parsed)) {
      storage.removeItem(UNLOCK_KEY);
      trusted = null;
      return null;
    }
    if (trusted !== parsed.credential) {
      return null;
    }
    return parsed;
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

  async function verifier() {
    if (typeof window !== "undefined" && window.VOACredential) {
      return window.VOACredential;
    }
    return import("./credential.js");
  }

  async function restore(publicKey) {
    const parsed = readStored();
    if (!parsed) {
      trusted = null;
      return null;
    }
    if (!parsed.credential || typeof parsed.credential !== "string") {
      storage.removeItem(UNLOCK_KEY);
      trusted = null;
      return null;
    }
    if (!publicKey) {
      storage.removeItem(UNLOCK_KEY);
      trusted = null;
      return null;
    }
    const { verifyCredential } = await verifier();
    const result = await verifyCredential(parsed.credential, publicKey, nowFn());
    if (!result.ok) {
      storage.removeItem(UNLOCK_KEY);
      trusted = null;
      return null;
    }
    trusted = parsed.credential;
    return readUnlock();
  }

  async function saveVerifiedCredential(token, publicKey) {
    if (!publicKey) {
      throw new Error("missing public key");
    }
    const { verifyCredential } = await verifier();
    const result = await verifyCredential(token, publicKey, nowFn());
    if (!result.ok) {
      throw new Error(result.reason || "bad credential");
    }
    const state = {
      active: true,
      credential: token,
      orderId: result.payload.orderId,
      plan: result.payload.plan,
      unlockedAt: result.payload.issuedAt,
      expiresAt: result.payload.expiresAt,
    };
    storage.setItem(UNLOCK_KEY, JSON.stringify(state));
    trusted = token;
    return state;
  }

  function findCode() {
    return null;
  }

  function clearUnlock() {
    storage.removeItem(UNLOCK_KEY);
    trusted = null;
    return null;
  }

  return {
    UNLOCK_KEY,
    FREE_LESSON_MAX,
    PLAN_LABELS,
    PLAN_DAYS,
    TIME_ZONE,
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
    restore,
    saveVerifiedCredential,
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
