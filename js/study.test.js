const test = require("node:test");
const assert = require("node:assert/strict");
const { createStudy, createMemoryStorage } = require("./study.js");

function studyAt(iso, storage = createMemoryStorage()) {
  return createStudy({
    storage,
    now: () => new Date(iso),
  });
}

test("todayKey uses Asia/Shanghai even when UTC is the previous day", () => {
  const study = studyAt("2026-09-03T16:30:00.000Z");
  assert.equal(study.todayKey(), "2026-09-04");
});

test("recordCheckin stores unique YYYY-MM-DD dates", () => {
  const storage = createMemoryStorage();
  const study = studyAt("2026-09-04T02:00:00.000Z", storage);
  study.recordCheckin();
  study.recordCheckin();
  assert.deepEqual(study.readCheckins(), ["2026-09-04"]);
});

test("current streak counts consecutive Shanghai days and stays alive until a missed day", () => {
  const storage = createMemoryStorage();
  storage.setItem("voa-lle-checkins", JSON.stringify(["2026-09-01", "2026-09-02", "2026-09-03"]));
  const today = studyAt("2026-09-04T02:00:00.000Z", storage);
  assert.equal(today.currentStreak(), 3);
  const missed = studyAt("2026-09-05T02:00:00.000Z", storage);
  assert.equal(missed.currentStreak(), 0);
});

test("daysCheckedInMonth counts only the viewed month", () => {
  const storage = createMemoryStorage();
  storage.setItem("voa-lle-checkins", JSON.stringify(["2026-08-31", "2026-09-01", "2026-09-04"]));
  const study = studyAt("2026-09-04T02:00:00.000Z", storage);
  assert.equal(study.daysCheckedInMonth(2026, 9), 2);
  assert.equal(study.daysCheckedInMonth(2026, 8), 1);
});

test("wrong book upserts misses and removes items answered correctly later", () => {
  const study = studyAt("2026-09-04T02:00:00.000Z");
  const lesson = {
    id: "lle1-01",
    title: "Lesson 1",
    quiz: [
      { id: "q1", prompt: "Who greets Anna first?", choices: ["Pete", "Anna"], answerIndex: 0 },
      { id: "q2", prompt: "How do you spell Anna?", choices: ["A-N-A", "A-N-N-A"], answerIndex: 1 },
    ],
  };

  study.syncWrongbook(lesson, { q1: 1, q2: 1 });
  assert.equal(study.readWrongbook().length, 1);
  assert.equal(study.readWrongbook()[0].questionId, "q1");
  assert.equal(study.readWrongbook()[0].chosenIndex, 1);

  study.syncWrongbook(lesson, { q1: 0, q2: 1 });
  assert.deepEqual(study.readWrongbook(), []);
});

test("wrong book keeps the latest miss for the same lessonId+questionId", () => {
  const storage = createMemoryStorage();
  const first = studyAt("2026-09-04T02:00:00.000Z", storage);
  const lesson = {
    id: "lle1-02",
    title: "Lesson 2",
    quiz: [{ id: "q1", prompt: "Where is Anna from?", choices: ["City", "Town"], answerIndex: 1 }],
  };
  first.syncWrongbook(lesson, { q1: 0 });
  const later = studyAt("2026-09-05T02:00:00.000Z", storage);
  later.syncWrongbook(lesson, { q1: 0 });
  const items = later.readWrongbook();
  assert.equal(items.length, 1);
  assert.equal(items[0].savedAt, "2026-09-05T02:00:00.000Z");
});
