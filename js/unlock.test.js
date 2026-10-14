const test = require("node:test");
const assert = require("node:assert/strict");
const { createUnlock, createMemoryStorage } = require("./unlock.js");
const catalog = require("../data/lessons.json");

async function testKeys() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const { signCredential } = await import("./credential.js");
  const publicKey = await crypto.subtle.exportKey("spki", pair.publicKey);
  let binary = "";
  const bytes = new Uint8Array(publicKey);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return {
    privateKey: pair.privateKey,
    publicKey: btoa(binary),
    signCredential,
  };
}

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

test("a verified credential opens paid lessons; unsigned storage does not", async () => {
  const storage = createMemoryStorage();
  const unlock = unlockAt("2026-09-04T02:00:00.000Z", storage);
  const keys = await testKeys();
  const token = await keys.signCredential(keys.privateKey, {
    orderId: "m1234567890abcdef1234567890abcd",
    plan: "monthly",
    issuedAt: "2026-09-04T02:00:00.000Z",
    expiresAt: "2026-10-04T02:00:00.000Z",
  });
  assert.equal(unlock.isUnlocked(), false);
  const state = await unlock.saveVerifiedCredential(token, keys.publicKey);
  assert.equal(state.plan, "monthly");
  assert.equal(state.orderId, "m1234567890abcdef1234567890abcd");
  assert.equal(unlock.isUnlocked(), true);
  assert.equal(unlock.canOpenLesson({ id: "lle1-06", number: 6 }), true);
  assert.equal(unlock.canOpenLesson({ id: "lle2-01", number: 1, level: 2 }), true);
  assert.equal(unlock.planLabel(state.plan), "月付 US$5.99");
  assert.equal(unlock.planLabel("quarterly"), "季卡 US$13.99");

  const unsigned = createMemoryStorage();
  unsigned.setItem(
    "voa-lle-unlock",
    JSON.stringify({
      active: true,
      code: "LLE-M-ABC123",
      plan: "monthly",
      unlockedAt: "2026-09-04T02:00:00.000Z",
      expiresAt: "2026-10-04T02:00:00.000Z",
    })
  );
  const legacy = unlockAt("2026-09-04T02:00:00.000Z", unsigned);
  assert.equal(legacy.isUnlocked(), false);
  assert.equal(unsigned.getItem("voa-lle-unlock"), null);
});

test("published catalog: L1 1-5 free, L1 6+ and all L2 locked until a credential", async () => {
  const unlock = unlockAt("2026-09-04T02:00:00.000Z");
  const levels = catalog.levels;
  const l1 = levels.find((level) => level.id === "lle1");
  const l2 = levels.find((level) => level.id === "lle2");
  assert.equal(l1.lessons.length, 52);
  assert.equal(l2.lessons.length, 30);
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
      "Find Your Joy!",
      "Flour Baby, Part 1",
      "Flour Baby, Part 2",
      "Movie Night",
      "The Test Drive",
      "Trash to Treasure, Part 1",
      "Trash to Treasure, Part 2",
      "Rock Star",
      "I Feel Super!",
      "Only Human",
      "Look-alikes",
      "Fish out of Water",
      "For the Birds",
      "Where There's Smoke...",
      "Dream a Little Dream",
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

  const keys = await testKeys();
  const token = await keys.signCredential(keys.privateKey, {
    orderId: "m1234567890abcdef1234567890abcd",
    plan: "quarterly",
    issuedAt: "2026-09-04T02:00:00.000Z",
    expiresAt: "2026-12-03T02:00:00.000Z",
  });
  await unlock.saveVerifiedCredential(token, keys.publicKey);
  l2.lessons.forEach((lesson) => {
    assert.equal(unlock.canOpenLesson(lesson), true, lesson.id);
  });
});

test("clearUnlock returns the catalog to locked", async () => {
  const storage = createMemoryStorage();
  const unlock = unlockAt("2026-09-04T02:00:00.000Z", storage);
  const keys = await testKeys();
  const token = await keys.signCredential(keys.privateKey, {
    orderId: "m1234567890abcdef1234567890abcd",
    plan: "quarterly",
    issuedAt: "2026-09-04T02:00:00.000Z",
    expiresAt: "2026-12-03T02:00:00.000Z",
  });
  await unlock.saveVerifiedCredential(token, keys.publicKey);
  assert.equal(unlock.canOpenLesson({ id: "lle1-07", number: 7 }), true);
  unlock.clearUnlock();
  assert.equal(storage.getItem("voa-lle-unlock"), null);
  assert.equal(unlock.isUnlocked(), false);
  assert.equal(unlock.canOpenLesson({ id: "lle1-07", number: 7 }), false);
});

test("format-only codes no longer unlock", () => {
  const unlock = unlockAt("2026-09-04T02:00:00.000Z");
  assert.equal(unlock.findCode([], "LLE-M-AAAAAA"), null);
  assert.equal(unlock.findCode([], "LLE-Q-ZZZZZ9"), null);
  assert.equal(unlock.findCode([{ code: "LLE-M-AAAAAA", plan: "monthly" }], "LLE-M-AAAAAA"), null);
  assert.equal(unlock.isUnlocked(), false);
});

test("credential expiry follows the signed expiresAt", async () => {
  const storage = createMemoryStorage();
  const keys = await testKeys();
  const monthlyToken = await keys.signCredential(keys.privateKey, {
    orderId: "m1234567890abcdef1234567890abcd",
    plan: "monthly",
    issuedAt: "2026-09-04T02:00:00.000Z",
    expiresAt: "2026-10-04T02:00:00.000Z",
  });
  const monthly = unlockAt("2026-09-04T02:00:00.000Z", storage);
  const monthlyState = await monthly.saveVerifiedCredential(monthlyToken, keys.publicKey);
  assert.equal(monthlyState.expiresAt, "2026-10-04T02:00:00.000Z");
  assert.equal(monthly.isUnlocked(), true);

  const stillValid = unlockAt("2026-10-04T02:00:00.000Z", storage);
  await stillValid.restore(keys.publicKey);
  assert.equal(stillValid.isUnlocked(), true);

  const expired = unlockAt("2026-10-04T02:00:00.001Z", storage);
  assert.equal(expired.isUnlocked(), false);
  assert.equal(expired.canOpenLesson({ id: "lle1-06", number: 6 }), false);
  assert.equal(storage.getItem("voa-lle-unlock"), null);
});

test("tampered credential is rejected and a stored token stays locked until restore", async () => {
  const storage = createMemoryStorage();
  const keys = await testKeys();
  const token = await keys.signCredential(keys.privateKey, {
    orderId: "m1234567890abcdef1234567890abcd",
    plan: "monthly",
    issuedAt: "2026-09-04T02:00:00.000Z",
    expiresAt: "2026-10-04T02:00:00.000Z",
  });
  const writer = unlockAt("2026-09-04T02:00:00.000Z", storage);
  await writer.saveVerifiedCredential(token, keys.publicKey);
  const fresh = unlockAt("2026-09-05T02:00:00.000Z", storage);
  assert.equal(fresh.isUnlocked(), false);
  assert.ok(storage.getItem("voa-lle-unlock"));
  await fresh.restore(keys.publicKey);
  assert.equal(fresh.isUnlocked(), true);

  const tampered = token.slice(0, -4) + (token.endsWith("aaaa") ? "bbbb" : "aaaa");
  storage.setItem(
    "voa-lle-unlock",
    JSON.stringify({
      active: true,
      credential: tampered,
      orderId: "m1234567890abcdef1234567890abcd",
      plan: "monthly",
      unlockedAt: "2026-09-04T02:00:00.000Z",
      expiresAt: "2026-10-04T02:00:00.000Z",
    })
  );
  const broken = unlockAt("2026-09-05T02:00:00.000Z", storage);
  assert.equal(await broken.restore(keys.publicKey), null);
  assert.equal(broken.isUnlocked(), false);
  assert.equal(storage.getItem("voa-lle-unlock"), null);

  storage.setItem(
    "voa-lle-unlock",
    JSON.stringify({
      active: true,
      credential: token,
      orderId: "m1234567890abcdef1234567890abcd",
      plan: "monthly",
      unlockedAt: "2026-09-04T02:00:00.000Z",
      expiresAt: "2026-10-04T02:00:00.000Z",
    })
  );
  const noKey = unlockAt("2026-09-05T02:00:00.000Z", storage);
  assert.equal(await noKey.restore(""), null);
  assert.equal(storage.getItem("voa-lle-unlock"), null);
});

test("legacy unlock without expiresAt is treated as expired", () => {
  const storage = createMemoryStorage();
  storage.setItem(
    "voa-lle-unlock",
    JSON.stringify({
      active: true,
      code: "VOA-DEMO-39",
      plan: "monthly",
      unlockedAt: "2026-09-04T02:00:00.000Z",
    })
  );
  const unlock = unlockAt("2026-09-04T02:00:00.000Z", storage);
  assert.equal(unlock.isUnlocked(), false);
  assert.equal(unlock.canOpenLesson({ id: "lle1-06", number: 6 }), false);
  assert.equal(storage.getItem("voa-lle-unlock"), null);
});
