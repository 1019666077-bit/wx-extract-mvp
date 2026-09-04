const test = require("node:test");
const assert = require("node:assert/strict");
const { createUnlock, createMemoryStorage } = require("./unlock.js");

const SAMPLE_CODES = [
  { code: "VOA-DEMO-39", plan: "monthly" },
  { code: "VOA-DEMO-99", plan: "quarterly" },
];

function unlockAt(iso, storage = createMemoryStorage()) {
  return createUnlock({
    storage,
    now: () => new Date(iso),
  });
}

test("lessons 1-5 are free and 6+ stay locked until redeem", () => {
  const unlock = unlockAt("2026-09-04T02:00:00.000Z");
  assert.equal(unlock.canOpenLesson({ id: "lle1-01", number: 1 }), true);
  assert.equal(unlock.canOpenLesson({ id: "lle1-05", number: 5 }), true);
  assert.equal(unlock.canOpenLesson({ id: "lle1-06", number: 6 }), false);
  assert.equal(unlock.canOpenLesson({ id: "lle1-10", number: 10 }), false);
  assert.equal(unlock.isPaidLesson({ id: "lle1-11" }), true);
});

test("future ids with a trailing number over 5 require unlock", () => {
  const unlock = unlockAt("2026-09-04T02:00:00.000Z");
  assert.equal(unlock.lessonNumber({ id: "lle1-12" }), 12);
  assert.equal(unlock.canOpenLesson({ id: "lle1-12" }), false);
});

test("redeem stores localStorage unlock state and opens paid lessons", () => {
  const storage = createMemoryStorage();
  const unlock = unlockAt("2026-09-04T02:00:00.000Z", storage);
  const match = unlock.findCode(SAMPLE_CODES, " voa-demo-39 ");
  assert.equal(match.plan, "monthly");

  const state = unlock.redeem(match);
  assert.deepEqual(JSON.parse(storage.getItem("voa-lle-unlock")), {
    active: true,
    code: "VOA-DEMO-39",
    plan: "monthly",
    unlockedAt: "2026-09-04T02:00:00.000Z",
  });
  assert.equal(state.active, true);
  assert.equal(unlock.isUnlocked(), true);
  assert.equal(unlock.canOpenLesson({ id: "lle1-06", number: 6 }), true);
  assert.equal(unlock.planLabel(state.plan), "月付 ¥39");
});

test("unknown codes fail and clearUnlock returns the catalog to locked", () => {
  const storage = createMemoryStorage();
  const unlock = unlockAt("2026-09-04T02:00:00.000Z", storage);
  assert.equal(unlock.findCode(SAMPLE_CODES, "NOT-A-CODE"), null);

  unlock.redeem(unlock.findCode(SAMPLE_CODES, "VOA-DEMO-99"));
  assert.equal(unlock.canOpenLesson({ id: "lle1-07", number: 7 }), true);

  unlock.clearUnlock();
  assert.equal(storage.getItem("voa-lle-unlock"), null);
  assert.equal(unlock.isUnlocked(), false);
  assert.equal(unlock.canOpenLesson({ id: "lle1-07", number: 7 }), false);
});
