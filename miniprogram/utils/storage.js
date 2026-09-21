function createWxStorage(wxApi) {
  const api = wxApi || (typeof wx !== "undefined" ? wx : null);
  if (!api || typeof api.getStorageSync !== "function") {
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

  return {
    getItem(key) {
      try {
        const value = api.getStorageSync(key);
        if (value === "" || value === undefined || value === null) {
          return null;
        }
        return typeof value === "string" ? value : JSON.stringify(value);
      } catch (error) {
        return null;
      }
    },
    setItem(key, value) {
      api.setStorageSync(key, String(value));
    },
    removeItem(key) {
      api.removeStorageSync(key);
    },
  };
}

const KEYS = {
  progress: "voa-lle-progress",
  checkins: "voa-lle-checkins",
  wrongbook: "voa-lle-wrongbook",
  unlock: "voa-lle-unlock",
  catalogLevel: "voa-lle-catalog-level",
};

module.exports = {
  createWxStorage,
  KEYS,
};
