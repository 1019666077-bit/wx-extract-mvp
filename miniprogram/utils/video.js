const COPY = {
  unavailable: "本课视频正在同步到国内线路，请稍后再试。",
  error: "视频加载失败。请检查网络；若仅开发者工具失败，请在真机预览或联系客服。",
  sourceHint: "也可在浏览器打开 VOA 官网观看（公版）。",
};

const TRIAL_LESSON_IDS = ["lle1-01", "lle1-02", "lle1-03", "lle1-04", "lle1-05"];
const FORBIDDEN_HOST_SNIPPETS = ["akamai", "akamaized"];

function lessonsOf(map) {
  if (!map || typeof map !== "object" || !map.lessons || typeof map.lessons !== "object") {
    return {};
  }
  return map.lessons;
}

function hostnameOf(url) {
  const match = String(url || "").match(/^https:\/\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : "";
}

function isForbiddenHost(url) {
  const host = hostnameOf(url);
  if (!host) {
    return true;
  }
  return FORBIDDEN_HOST_SNIPPETS.some((snippet) => host.includes(snippet));
}

function isValidMirrorUrl(url) {
  if (typeof url !== "string" || !url.startsWith("https://")) {
    return false;
  }
  return !isForbiddenHost(url);
}

function getMirrorUrl(lessonId, map) {
  const url = lessonsOf(map)[lessonId];
  return isValidMirrorUrl(url) ? url : "";
}

function videoStatusFor(lessonId, map) {
  return getMirrorUrl(lessonId, map) ? "mirror" : "pending";
}

function resolveLessonVideo(lessonId, map, sourceUrl) {
  const videoSrc = getMirrorUrl(lessonId, map);
  if (!videoSrc) {
    return {
      videoSrc: "",
      videoState: "unavailable",
      videoErrorCopy: COPY.unavailable,
      sourceUrl: sourceUrl || "",
      sourceHint: sourceUrl ? COPY.sourceHint : "",
      videoStatus: "pending",
    };
  }
  return {
    videoSrc,
    videoState: "loading",
    videoErrorCopy: "",
    sourceUrl: sourceUrl || "",
    sourceHint: sourceUrl ? COPY.sourceHint : "",
    videoStatus: "mirror",
  };
}

function onVideoError(sourceUrl) {
  return {
    videoState: "error",
    videoErrorCopy: COPY.error,
    sourceHint: sourceUrl ? COPY.sourceHint : "",
  };
}

function onVideoReady() {
  return { videoState: "playing" };
}

function validateVideoMap(map) {
  const problems = [];
  if (!map || typeof map !== "object") {
    return ["video-map must be an object"];
  }
  if (map.version !== 1) {
    problems.push("version must be 1");
  }
  if (typeof map.baseUrl !== "string" || !map.baseUrl.startsWith("https://")) {
    problems.push("baseUrl must be https");
  }
  if (isForbiddenHost(`${map.baseUrl}/`)) {
    problems.push("baseUrl host must not be Akamai");
  }
  const lessons = lessonsOf(map);
  TRIAL_LESSON_IDS.forEach((id) => {
    if (!isValidMirrorUrl(lessons[id])) {
      problems.push(`trial lesson ${id} needs an https mirror URL`);
    }
  });
  Object.keys(lessons).forEach((id) => {
    if (!isValidMirrorUrl(lessons[id])) {
      problems.push(`${id} is not a valid mirror URL`);
    }
  });
  return problems;
}

const videoApi = {
  COPY,
  TRIAL_LESSON_IDS,
  getMirrorUrl,
  videoStatusFor,
  resolveLessonVideo,
  onVideoError,
  onVideoReady,
  isValidMirrorUrl,
  validateVideoMap,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = videoApi;
}

if (typeof window !== "undefined") {
  window.VOAVideo = videoApi;
}
