const test = require("node:test");
const assert = require("node:assert/strict");
const { createUnlock, createMemoryStorage } = require("./unlock.js");
const catalog = require("../data/lessons.json");

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

test("only Level 1 lessons 1-5 are free; Level 2 stays locked until redeem", () => {
  const unlock = unlockAt("2026-09-04T02:00:00.000Z");
  assert.equal(unlock.canOpenLesson({ id: "lle1-01", number: 1, level: 1 }), true);
  assert.equal(unlock.canOpenLesson({ id: "lle1-05", number: 5, level: 1 }), true);
  assert.equal(unlock.canOpenLesson({ id: "lle1-06", number: 6, level: 1 }), false);
  assert.equal(unlock.canOpenLesson({ id: "lle1-10", number: 10, level: 1 }), false);
  assert.equal(unlock.isPaidLesson({ id: "lle1-11" }), true);
  assert.equal(unlock.isFreeTrialLesson({ id: "lle2-01", number: 1, level: 2 }), false);
  assert.equal(unlock.canOpenLesson({ id: "lle2-01", number: 1, level: 2 }), false);
  assert.equal(unlock.canOpenLesson({ id: "lle2-05", number: 5, level: 2 }), false);
  assert.equal(unlock.isPaidLesson({ id: "lle2-01", number: 1 }), true);
});

test("future ids with a trailing number over 5 require unlock", () => {
  const unlock = unlockAt("2026-09-04T02:00:00.000Z");
  assert.equal(unlock.lessonNumber({ id: "lle1-12" }), 12);
  assert.equal(unlock.canOpenLesson({ id: "lle1-12" }), false);
});

test("lle2 ids and level:2 are paid even when the lesson number is 1-5", () => {
  const unlock = unlockAt("2026-09-04T02:00:00.000Z");
  assert.equal(unlock.lessonLevel({ id: "lle2-01" }), 2);
  assert.equal(unlock.lessonLevel({ id: "lle1-03" }), 1);
  assert.equal(unlock.lessonLevel({ level: 2, id: "custom-01" }), 2);
  assert.equal(unlock.canOpenLesson({ id: "lle2-03", number: 3 }), false);
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
  assert.equal(unlock.canOpenLesson({ id: "lle2-01", number: 1, level: 2 }), true);
  assert.equal(unlock.planLabel(state.plan), "月付 ¥39");
});

test("published catalog: L1 1-5 free, L1 6+ and all L2 locked until redeem", () => {
  const unlock = unlockAt("2026-09-04T02:00:00.000Z");
  const levels = catalog.levels;
  const l1 = levels.find((level) => level.id === "lle1");
  const l2 = levels.find((level) => level.id === "lle2");
  assert.equal(l1.lessons.length, 52);
  assert.equal(l2.lessons.length, 15);
  assert.deepEqual(
    l2.lessons.map((lesson) => lesson.subtitle),
    [
      "Budget Cuts",
      "The Interview",
      "He Said - She Said",
      "Run Away With the Circus!",
      "Greatest Vacation of All Time",
      "Will It Float?",
      "Tip Your Tour Guide",
      "The Best Barbecue",
      "Pets Are Family, Too!",
      "Visit to Peru",
      "The Big Snow",
      "Run! Bees!",
      "Save the Bees!",
      "Made for Each Other",
      "Before and After",
    ]
  );

  l1.lessons.forEach((lesson) => {
    const expectedFree = lesson.number <= 5;
    assert.equal(unlock.canOpenLesson(lesson), expectedFree, lesson.id);
  });
  l2.lessons.forEach((lesson) => {
    assert.equal(lesson.level, 2);
    assert.equal(unlock.canOpenLesson(lesson), false, lesson.id);
    assert.match(lesson.videoUrl, /voa-video-ns\.akamaized\.net\/.*_720p\.mp4$/);
    assert.equal(lesson.quiz.length, 3);
    assert.ok(lesson.dialogue.length >= 8);
  });

  unlock.redeem({ code: "VOA-DEMO-39", plan: "monthly" });
  l2.lessons.forEach((lesson) => {
    assert.equal(unlock.canOpenLesson(lesson), true, lesson.id);
  });
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
