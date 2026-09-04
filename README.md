# VOA Learning English · Level 1

A small, static self-study shell for **Let's Learn English Level 1**.

This is frontend-only. There is no login, backend, or crawler. It is **not** an official VOA product.

## What it includes

- A course catalog on the home page
- Ten lessons: `lle1-01` through `lle1-10`
- Official VOA MP4 video in an HTML5 player (YouTube is an optional fallback link only)
- Dialogue lines in English and Chinese
- Three multiple-choice quiz questions per lesson
- Progress saved in `localStorage` under `voa-lle-progress` (`lessonId` → `{ score, total, completed, savedAt }`)
- Check-in / streak calendar (`voa-lle-checkins`) after each quiz submit
- Wrong-answer book (`voa-lle-wrongbook`) for missed quiz questions
- Clear VOA public-domain attribution

## Pages

| Page | File | Notes |
| --- | --- | --- |
| 课表 | `index.html` | Lesson cards plus a month check-in calendar |
| 打卡 | `progress.html` | Dedicated streak + month grid |
| 错题本 | `wrongbook.html` | Missed questions grouped by lesson |
| Lesson | `lesson.html?id=lle1-01` | Video, dialogue, quiz |

Shared render, quiz, progress, check-in, and wrong-book logic lives in `js/study.js` and `js/app.js`.

## localStorage

Dates use **Asia/Shanghai** (`YYYY-MM-DD`). There is no account; clearing site data clears study history.

| Key | Shape | When it updates |
| --- | --- | --- |
| `voa-lle-progress` | `{ [lessonId]: { score, total, completed, savedAt, answers, resultText } }` | Opening a lesson marks it in progress; submitting a quiz stores the score |
| `voa-lle-checkins` | `string[]` of `YYYY-MM-DD` | Any lesson quiz submit records today (deduped) |
| `voa-lle-wrongbook` | `{ lessonId, lessonTitle, questionId, prompt, choices, correctIndex, chosenIndex, savedAt }[]` | Wrong answers are upserted by `lessonId + questionId`. A later correct answer removes that item |

A day counts as checked-in when the learner **submits a lesson quiz that day**. Current streak is consecutive Shanghai dates ending today, or yesterday if today is not yet checked in.

## How to use

1. Open the catalog and start any lesson.
2. Watch the VOA MP4, read the dialogue, then submit the quiz.
3. That submit checks in today and writes misses to the wrong-answer book.
4. Open **打卡** to see streak, days this month, and the highlighted month grid.
5. Open **错题本** to review misses. **再练** returns to `lesson.html?id=...`. Clear one item or clear all. Answer the same question correctly on retry and it disappears. Empty state: 「暂无错题」.

## Lesson data

All lesson content lives in:

```text
data/lessons.json
```

## Local preview

Serve the repo root over HTTP so the browser can fetch `data/lessons.json`:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Opening `index.html` as a file URL will not load the JSON.

Check-in and wrong-book helpers can be unit-tested with:

```bash
node --test js/study.test.js
```

## Public preview

Open on phone or desktop:

https://1019666077-bit.github.io/wx-extract-mvp/

GitHub Pages is served from `main` at `/` (repo root). A newly published site can take about 30 seconds to stabilize; if it does not load, refresh once.

## Scope

In scope: catalog + ten static lessons with local progress, check-in, and a wrong-answer book.

Out of scope: login, accounts, payment, a crawler, or a backend.
