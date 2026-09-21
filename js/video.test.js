const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const video = require("../miniprogram/utils/video.js");
const committedMap = require("../miniprogram/data/video-map.json");

const ROOT = path.join(__dirname, "..");

const sampleMap = {
  version: 1,
  baseUrl: "https://media.example.com",
  objectPrefix: "lle/mp4",
  lessons: {
    "lle1-01": "https://media.example.com/lle/mp4/lle1-01.mp4",
    "lle1-02": "https://media.example.com/lle/mp4/lle1-02.mp4",
  },
};

test("getMirrorUrl returns https mirror and rejects Akamai / missing ids", () => {
  assert.equal(video.getMirrorUrl("lle1-01", sampleMap), "https://media.example.com/lle/mp4/lle1-01.mp4");
  assert.equal(video.getMirrorUrl("lle1-06", sampleMap), "");
  assert.equal(video.getMirrorUrl("lle1-01", null), "");
  assert.equal(
    video.getMirrorUrl("lle1-01", {
      lessons: { "lle1-01": "https://voa-video-ns.akamaized.net/pangeavideo/x.mp4" },
    }),
    ""
  );
  assert.equal(video.getMirrorUrl("lle1-01", { lessons: { "lle1-01": "http://media.example.com/x.mp4" } }), "");
});

test("resolveLessonVideo uses unavailable copy when the map has no entry", () => {
  const resolved = video.resolveLessonVideo("lle1-06", sampleMap, "https://learningenglish.voanews.com/a/x.html");
  assert.equal(resolved.videoSrc, "");
  assert.equal(resolved.videoState, "unavailable");
  assert.equal(resolved.videoStatus, "pending");
  assert.equal(resolved.videoErrorCopy, video.COPY.unavailable);
  assert.equal(resolved.sourceHint, video.COPY.sourceHint);
});

test("resolveLessonVideo + binderror / loadedmetadata state machine", () => {
  const ready = video.resolveLessonVideo("lle1-01", sampleMap, "https://learningenglish.voanews.com/a/x.html");
  assert.equal(ready.videoSrc, sampleMap.lessons["lle1-01"]);
  assert.equal(ready.videoState, "loading");
  assert.equal(ready.videoStatus, "mirror");
  assert.equal(ready.videoErrorCopy, "");

  const failed = video.onVideoError(ready.sourceUrl);
  assert.equal(failed.videoState, "error");
  assert.equal(failed.videoErrorCopy, video.COPY.error);
  assert.equal(failed.sourceHint, video.COPY.sourceHint);

  assert.deepEqual(video.onVideoReady(), { videoState: "playing" });
});

test("committed D1 video-map covers L1 1–5 only and never names Akamai", () => {
  const ids = Object.keys(committedMap.lessons).sort();
  assert.deepEqual(ids, video.TRIAL_LESSON_IDS);
  assert.equal(committedMap.version, 1);
  assert.equal(committedMap.baseUrl, "https://media.example.com");
  assert.deepEqual(video.validateVideoMap(committedMap), []);
  const blob = JSON.stringify(committedMap).toLowerCase();
  assert.equal(blob.includes("akamai"), false);
  video.TRIAL_LESSON_IDS.forEach((id) => {
    assert.equal(video.getMirrorUrl(id, committedMap), committedMap.lessons[id]);
    assert.equal(video.videoStatusFor(id, committedMap), "mirror");
  });
  assert.equal(video.videoStatusFor("lle1-06", committedMap), "pending");
  assert.equal(video.videoStatusFor("lle2-01", committedMap), "pending");
});

test("sync-voa-videos.sh --dry-run lists lessons and writes nothing", () => {
  const before = fs.readFileSync(path.join(ROOT, "miniprogram/data/video-map.json"), "utf8");
  const out = execFileSync("bash", ["scripts/sync-voa-videos.sh", "--dry-run", "--only", "lle1-01,lle1-05"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(out, /lle1-01/);
  assert.match(out, /lle1-05/);
  assert.equal(out.includes("lle1-02"), false);
  assert.match(out, /dry-run: 2 lesson/);
  assert.equal(fs.readFileSync(path.join(ROOT, "miniprogram/data/video-map.json"), "utf8"), before);
  assert.equal(fs.existsSync(path.join(ROOT, "mirror/mp4/lle1-01.mp4")), false);
});
