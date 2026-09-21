#!/usr/bin/env python3
"""Generate miniprogram catalog + per-lesson JSON from data/lessons.json.

M0 rules:
- Do not copy videoUrl / youtubeId (no Akamai in the mini program).
- Keep catalog small for cold start; full dialogue/quiz live in per-lesson files
  under the lessons subpackage.
"""

from __future__ import annotations

import argparse
import json
import shutil
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "lessons.json"
MP = ROOT / "miniprogram"
CATALOG_PATH = MP / "data" / "catalog.json"
LESSON_DIR = MP / "packageLessons" / "data" / "lessons"
LOADER_PATH = MP / "packageLessons" / "data" / "load-lesson.js"
UTILS = MP / "utils"

CATALOG_WARN_BYTES = 100 * 1024
LESSON_WARN_BYTES = 150 * 1024
FORBIDDEN_SNIPPETS = ("akamaized", "akamai", "videoUrl", "youtubeId")


def lesson_level_num(level_id: str, lesson: dict) -> int:
    if isinstance(lesson.get("level"), (int, float)):
        return int(lesson["level"])
    if str(level_id).startswith("lle2"):
        return 2
    return 1


def catalog_entry(level_id: str, lesson: dict) -> dict:
    return {
        "id": lesson["id"],
        "number": lesson.get("number"),
        "title": lesson.get("title") or "",
        "subtitle": lesson.get("subtitle") or "",
        "level": lesson_level_num(level_id, lesson),
        "levelId": level_id,
    }


def neighbor_ref(level_id: str, lesson: dict | None) -> dict | None:
    if not lesson:
        return None
    return {
        "id": lesson["id"],
        "number": lesson.get("number"),
        "level": lesson_level_num(level_id, lesson),
        "title": lesson.get("title") or "",
    }


def lesson_payload(level: dict, lesson: dict, prev_lesson: dict | None, next_lesson: dict | None) -> dict:
    level_id = level["id"]
    return {
        "id": lesson["id"],
        "number": lesson.get("number"),
        "title": lesson.get("title") or "",
        "subtitle": lesson.get("subtitle") or "",
        "level": lesson_level_num(level_id, lesson),
        "levelId": level_id,
        "levelTitle": level.get("title") or level_id,
        "levelLessonCount": len(level.get("lessons") or []),
        "sourceUrl": lesson.get("sourceUrl") or "",
        "attribution": lesson.get("attribution") or "",
        "dialogue": lesson.get("dialogue") or [],
        "quiz": lesson.get("quiz") or [],
        "prev": neighbor_ref(level_id, prev_lesson),
        "next": neighbor_ref(level_id, next_lesson),
        "videoStatus": "m1-placeholder",
    }


def assert_no_video(blob: str, label: str) -> None:
    lowered = blob.lower()
    for snippet in FORBIDDEN_SNIPPETS:
        if snippet.lower() in lowered:
            raise SystemExit(f"{label} contains forbidden snippet {snippet!r} (M0 must not ship Akamai/video URLs)")


def write_json(path: Path, payload: dict) -> int:
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    assert_no_video(text, str(path.relative_to(ROOT)))
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = text.encode("utf-8")
    path.write_bytes(encoded)
    return len(encoded)


def copy_logic() -> None:
    UTILS.mkdir(parents=True, exist_ok=True)
    for name in ("study.js", "unlock.js"):
        src = ROOT / "js" / name
        dest = UTILS / name
        shutil.copyfile(src, dest)


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int, rgb: tuple[int, int, int]) -> None:
    raw = b"".join(b"\x00" + (bytes(rgb) * width) for _ in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    payload = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", zlib.compress(raw, 9)) + png_chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def write_tab_icons() -> None:
    images = MP / "images"
    palette = {
        "tab-catalog.png": (91, 107, 116),
        "tab-catalog-active.png": (11, 110, 79),
        "tab-progress.png": (91, 107, 116),
        "tab-progress-active.png": (11, 110, 79),
        "tab-wrongbook.png": (91, 107, 116),
        "tab-wrongbook-active.png": (11, 110, 79),
        "tab-pricing.png": (91, 107, 116),
        "tab-pricing-active.png": (11, 110, 79),
    }
    for name, rgb in palette.items():
        write_png(images / name, 81, 81, rgb)


def build() -> dict:
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    course = payload.get("course") or {}
    levels_in = payload.get("levels") or []
    catalog_levels = []
    lesson_files: list[tuple[str, dict]] = []

    for level in levels_in:
        lessons = list(level.get("lessons") or [])
        catalog_levels.append(
            {
                "id": level.get("id"),
                "title": level.get("title") or level.get("id"),
                "lessons": [catalog_entry(level["id"], lesson) for lesson in lessons],
            }
        )
        for index, lesson in enumerate(lessons):
            prev_lesson = lessons[index - 1] if index > 0 else None
            next_lesson = lessons[index + 1] if index + 1 < len(lessons) else None
            lesson_files.append((lesson["id"], lesson_payload(level, lesson, prev_lesson, next_lesson)))

    if LESSON_DIR.exists():
        shutil.rmtree(LESSON_DIR)
    LESSON_DIR.mkdir(parents=True, exist_ok=True)

    catalog = {
        "course": {
            "title": course.get("title") or "Let's Learn English",
            "pitch": course.get("pitch") or "",
            "disclaimer": course.get("disclaimer") or "",
        },
        "levels": catalog_levels,
    }
    catalog_bytes = write_json(CATALOG_PATH, catalog)

    loader_lines = [
        "/* Generated by scripts/build-mp-data.sh — do not edit. */",
        "/* Per-lesson JSON lives in the lessons subpackage so cold start only loads catalog.json. */",
        "module.exports = {",
    ]
    sizes: dict[str, int] = {}
    for lesson_id, body in lesson_files:
        sizes[lesson_id] = write_json(LESSON_DIR / f"{lesson_id}.json", body)
        loader_lines.append(f'  "{lesson_id}": require("./lessons/{lesson_id}.json"),')
    loader_lines.append("};")
    loader_text = "\n".join(loader_lines) + "\n"
    assert_no_video(loader_text, str(LOADER_PATH.relative_to(ROOT)))
    LOADER_PATH.write_text(loader_text, encoding="utf-8")

    copy_logic()
    write_tab_icons()

    oversized = {lid: size for lid, size in sizes.items() if size > LESSON_WARN_BYTES}
    summary = {
        "catalogBytes": catalog_bytes,
        "lessonCount": len(lesson_files),
        "levelCounts": {level["id"]: len(level["lessons"]) for level in catalog_levels},
        "maxLessonBytes": max(sizes.values()) if sizes else 0,
        "oversizedLessons": oversized,
        "catalogWarn": catalog_bytes > CATALOG_WARN_BYTES,
    }
    return summary


def check() -> int:
    """Rebuild in a temp tree is heavy; compare in-place by regenerating to sidecar then diffing.

    Instead: rebuild is deterministic — generate to memory-equivalent files next to a fingerprint.
    Simplest reliable check: rebuild into a temp dir under /tmp and diff key outputs.
    """
    before_catalog = CATALOG_PATH.read_bytes() if CATALOG_PATH.exists() else b""
    before_loader = LOADER_PATH.read_text(encoding="utf-8") if LOADER_PATH.exists() else ""
    before_ids = sorted(p.name for p in LESSON_DIR.glob("*.json")) if LESSON_DIR.exists() else []
    study_src = (ROOT / "js" / "study.js").read_bytes()
    unlock_src = (ROOT / "js" / "unlock.js").read_bytes()
    before_study = (UTILS / "study.js").read_bytes() if (UTILS / "study.js").exists() else b""
    before_unlock = (UTILS / "unlock.js").read_bytes() if (UTILS / "unlock.js").exists() else b""

    summary = build()
    after_catalog = CATALOG_PATH.read_bytes()
    after_loader = LOADER_PATH.read_text(encoding="utf-8")
    after_ids = sorted(p.name for p in LESSON_DIR.glob("*.json"))

    problems = []
    if before_catalog != after_catalog:
        problems.append("miniprogram/data/catalog.json is stale; re-run scripts/build-mp-data.sh")
    if before_loader != after_loader:
        problems.append("miniprogram/packageLessons/data/load-lesson.js is stale; re-run scripts/build-mp-data.sh")
    if before_ids != after_ids:
        problems.append("per-lesson JSON set does not match generator output")
    if before_study != study_src:
        problems.append("miniprogram/utils/study.js is out of sync with js/study.js")
    if before_unlock != unlock_src:
        problems.append("miniprogram/utils/unlock.js is out of sync with js/unlock.js")
    if summary["lessonCount"] != 82:
        problems.append(f"expected 82 lessons, got {summary['lessonCount']}")
    if problems:
        for item in problems:
            print(item, file=sys.stderr)
        return 1
    print(
        f"mp-data ok: catalog {summary['catalogBytes']}B, "
        f"{summary['lessonCount']} lessons, levels {summary['levelCounts']}"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify generated files are up to date")
    args = parser.parse_args()
    if args.check:
        return check()

    summary = build()
    print(
        f"wrote catalog {summary['catalogBytes']}B, "
        f"{summary['lessonCount']} lessons, levels {summary['levelCounts']}, "
        f"max lesson {summary['maxLessonBytes']}B"
    )
    if summary["catalogWarn"]:
        print(f"warn: catalog.json is {summary['catalogBytes']}B (threshold {CATALOG_WARN_BYTES}B)", file=sys.stderr)
    if summary["oversizedLessons"]:
        for lid, size in summary["oversizedLessons"].items():
            print(f"warn: {lid} is {size}B (threshold {LESSON_WARN_BYTES}B)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
