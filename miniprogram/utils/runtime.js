const studyMod = require("./study.js");
const unlockMod = require("./unlock.js");
const { createWxStorage } = require("./storage.js");

const storage = createWxStorage();
const study = studyMod.createStudy({ storage });
const unlock = unlockMod.createUnlock({ storage });

module.exports = {
  storage,
  study,
  unlock,
  createStudy: studyMod.createStudy,
  createUnlock: unlockMod.createUnlock,
};
