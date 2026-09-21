const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const catalog = require("../miniprogram/data/catalog.json");
const loadLesson = require("../miniprogram/packageLessons/data/load-lesson.js");
const videoMap = require("../miniprogram/data/video-map.json");
const { createStudy, createMemoryStorage } = require("./study.js");
const { createUnlock } = require("./unlock.js");
const { createWxStorage, KEYS } = require("../miniprogram/utils/storage.js");
const { createProgress } = require("../miniprogram/utils/progress.js");
const { catalogNoteText, lessonPath, selectedLevelId } = require("../miniprogram/utils/catalog.js");
const { getMirrorUrl, videoStatusFor, TRIAL_LESSON_IDS } = require("../miniprogram/utils/video.js");

const ROOT = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

test("generated catalog lists 82 lessons without video fields", () => {
  const counts = Object.fromEntries(catalog.levels.map((level) => [level.id, level.lessons.length]));
  assert.deepEqual(counts, { lle1: 52, lle2: 30 });
  const ids = catalog.levels.flatMap((level) => level.lessons.map((lesson) => lesson.id));
  assert.equal(ids.length, 82);
  const blob = JSON.stringify(catalog);
  assert.equal(blob.includes("akamaized"), false);
  assert.equal(blob.includes("videoUrl"), false);
  assert.ok(fs.statSync(path.join(ROOT, "miniprogram/data/catalog.json")).size < 100 * 1024);
});

test("per-lesson JSON is loaded by id and never includes Akamai URLs", () => {
  const lesson = loadLesson["lle1-01"];
  assert.equal(lesson.id, "lle1-01");
  assert.ok(Array.isArray(lesson.dialogue) && lesson.dialogue.length > 0);
  assert.equal(lesson.quiz.length, 3);
  assert.equal(lesson.videoStatus, "m1-placeholder");
  assert.equal("videoUrl" in lesson, false);
  assert.equal("youtubeId" in lesson, false);

  const keys = Object.keys(loadLesson);
  assert.equal(keys.length, 82);
  keys.forEach((id) => {
    const body = JSON.stringify(loadLesson[id]);
    assert.equal(body.toLowerCase().includes("akamai"), false);
    assert.equal(body.includes("videoUrl"), false);
  });
});

test("miniprogram study/unlock copies stay byte-identical to js/", () => {
  assert.equal(read("miniprogram/utils/study.js"), read("js/study.js"));
  assert.equal(read("miniprogram/utils/unlock.js"), read("js/unlock.js"));
});

test("storage adapter falls back without wx and keeps localStorage-like keys", () => {
  const storage = createWxStorage(null);
  storage.setItem(KEYS.progress, JSON.stringify({ "lle1-01": { completed: true } }));
  assert.equal(JSON.parse(storage.getItem(KEYS.progress))["lle1-01"].completed, true);
  storage.removeItem(KEYS.progress);
  assert.equal(storage.getItem(KEYS.progress), null);
});

test("catalog → lle1-01 quiz submit writes progress, checkin, and wrongbook", () => {
  const storage = createMemoryStorage();
  const now = () => new Date("2026-09-21T02:00:00.000Z");
  const study = createStudy({ storage, now });
  const unlock = createUnlock({ storage, now });
  const progress = createProgress(storage);
  const lesson = loadLesson["lle1-01"];

  assert.equal(unlock.canOpenLesson(catalog.levels[0].lessons[0]), true);
  assert.equal(unlock.canOpenLesson(catalog.levels[0].lessons[5]), false);
  assert.equal(selectedLevelId(catalog, ""), "lle1");
  assert.match(catalogNoteText(catalog, false, "15232188653"), /第 1–5 课/);
  assert.equal(lessonPath("lle1-01"), "/packageLessons/lesson/lesson?id=lle1-01");

  progress.markLessonStarted(lesson.id);
  const answers = {};
  lesson.quiz.forEach((question, index) => {
    answers[question.id] = index === 0 ? question.answerIndex : (question.answerIndex + 1) % question.choices.length;
  });
  const score = lesson.quiz.reduce((total, question) => total + (answers[question.id] === question.answerIndex ? 1 : 0), 0);
  study.syncWrongbook(lesson, answers, now());
  study.recordCheckin(now());
  progress.saveQuizResult(lesson.id, {
    score,
    total: lesson.quiz.length,
    completed: true,
    savedAt: now().toISOString(),
    answers,
    resultText: `Score: ${score} / ${lesson.quiz.length}`,
  });

  assert.equal(score, 1);
  assert.equal(progress.readProgress()["lle1-01"].completed, true);
  assert.deepEqual(study.readCheckins(), ["2026-09-21"]);
  assert.equal(study.currentStreak(), 1);
  assert.ok(study.readWrongbook().length >= 1);
  assert.equal(unlock.isUnlocked(), false);
});

test("empty codes allowlist still accepts LLE format (same as H5)", () => {
  const unlock = createUnlock({ storage: createMemoryStorage(), now: () => new Date("2026-09-21T02:00:00.000Z") });
  const match = unlock.findCode([], "LLE-M-ABC123");
  assert.equal(match.plan, "monthly");
  const state = unlock.redeem(match);
  assert.equal(unlock.isUnlocked(), true);
  assert.equal(state.expiresAt.slice(0, 10), "2026-10-21");
});

test("D1 video-map is allowed; per-lesson JSON still has no Akamai or videoUrl", () => {
  TRIAL_LESSON_IDS.forEach((id) => {
    assert.equal(videoStatusFor(id, videoMap), "mirror");
    assert.match(getMirrorUrl(id, videoMap), /^https:\/\/media\.example\.com\/lle\/mp4\/lle1-0[1-5]\.mp4$/);
  });
  assert.equal(videoStatusFor("lle1-06", videoMap), "pending");
  assert.equal(JSON.stringify(videoMap).toLowerCase().includes("akamai"), false);
  assert.equal("videoUrl" in loadLesson["lle1-01"], false);
  assert.equal(loadLesson["lle1-01"].videoStatus, "m1-placeholder");
});

test("lesson page mounts <video> from video-map and never requestPayment", () => {
  const lessonJs = read("miniprogram/packageLessons/lesson/lesson.js");
  const lessonWxml = read("miniprogram/packageLessons/lesson/lesson.wxml");
  const pricingJs = read("miniprogram/pages/pricing/pricing.js");
  assert.match(lessonWxml, /<video/);
  assert.match(lessonWxml, /binderror="onVideoError"/);
  assert.match(lessonWxml, /本课视频正在同步到国内线路|videoErrorCopy/);
  assert.equal(lessonWxml.includes("视频将在 M1 接入"), false);
  assert.equal(lessonJs.includes("akamaized"), false);
  assert.equal(lessonJs.includes("videoUrl"), false);
  assert.match(lessonJs, /video-map\.json/);
  assert.match(lessonJs, /resolveLessonVideo/);
  assert.equal(pricingJs.includes("requestPayment"), false);
});
