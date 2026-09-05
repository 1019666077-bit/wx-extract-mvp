# VOA Learning English

A small, static self-study shell for **Let's Learn English**.

This is frontend-only. There is no login, backend, or crawler. It is **not** an official VOA product.

## What it includes

- A course catalog on the home page with a Level 1 / Level 2 switcher
- Level 1 complete: fifty-two lessons, `lle1-01` through `lle1-52`
- Level 2 started: first twenty-five lessons, `lle2-01` through `lle2-25` (Budget Cuts, The Interview, He Said - She Said, Run Away With the Circus!, Greatest Vacation of All Time, Will It Float?, Tip Your Tour Guide, The Best Barbecue, Pets Are Family, Too!, Visit to Peru, The Big Snow, Run! Bees!, Save the Bees!, Made for Each Other, Before and After, Find Your Joy!, Flour Baby, Part 1, Flour Baby, Part 2, Movie Night, The Test Drive, Trash to Treasure, Part 1, Trash to Treasure, Part 2, Rock Star, I Feel Super!, Only Human)
- Official VOA MP4 video in an HTML5 player (YouTube is an optional fallback link only)
- Dialogue lines in English and Chinese
- Three multiple-choice quiz questions per lesson
- Progress saved in `localStorage` under `voa-lle-progress` (`lessonId` → `{ score, total, completed, savedAt }`)
- Check-in / streak calendar (`voa-lle-checkins`) after each quiz submit
- Wrong-answer book (`voa-lle-wrongbook`) for missed quiz questions
- Frontend paywall: only **Level 1 lessons 1–5** are free; all other published lessons (Level 1 6–52 and every Level 2 lesson) need a redeem code
- Clear VOA public-domain attribution

## Pages

| Page | File | Notes |
| --- | --- | --- |
| 课表 | `index.html` | Lesson cards plus a month check-in calendar. Locked cards show a lock badge |
| 打卡 | `progress.html` | Dedicated streak + month grid |
| 错题本 | `wrongbook.html` | Missed questions grouped by lesson |
| 开通 | `pricing.html` | Plans, manual-payment note, redeem-code unlock |
| Lesson | `lesson.html?id=lle1-01` | Video, dialogue, quiz. Paid lessons show a paywall until unlocked. Prev/next stay inside the current level |

Shared render, quiz, progress, check-in, unlock, and wrong-book logic lives in `js/study.js`, `js/unlock.js`, and `js/app.js`.

## localStorage

Dates use **Asia/Shanghai** (`YYYY-MM-DD`). There is no account; clearing site data clears study history.

| Key | Shape | When it updates |
| --- | --- | --- |
| `voa-lle-progress` | `{ [lessonId]: { score, total, completed, savedAt, answers, resultText } }` | Opening a lesson marks it in progress; submitting a quiz stores the score |
| `voa-lle-checkins` | `string[]` of `YYYY-MM-DD` | Any lesson quiz submit records today (deduped) |
| `voa-lle-wrongbook` | `{ lessonId, lessonTitle, questionId, prompt, choices, correctIndex, chosenIndex, savedAt }[]` | Wrong answers are upserted by `lessonId + questionId`. A later correct answer removes that item |
| `voa-lle-unlock` | `{ active, code, plan, unlockedAt }` | Set after a valid redeem code. While `active`, all lessons open |

A day counts as checked-in when the learner **submits a lesson quiz that day**. Current streak is consecutive Shanghai dates ending today, or yesterday if today is not yet checked in.

## How to use

1. Open the catalog and switch Level 1 / Level 2. Only Level 1 lessons 1–5 are free. Level 1 lessons 6–52 and every `lle2-*` lesson show a lock badge until unlocked.
2. Start a free lesson, watch the VOA MP4, read the dialogue, then submit the quiz.
3. That submit checks in today and writes misses to the wrong-answer book. Check-in and the wrong-answer book work without unlocking.
4. Open **打卡** to see streak, days this month, and the highlighted month grid.
5. Open **错题本** to review misses. **再练** returns to `lesson.html?id=...`. Clear one item or clear all. Answer the same question correctly on retry and it disappears. Empty state: 「暂无错题」.
6. To open paid lessons, go to **开通** (`pricing.html`): pick 月付 ¥39 or 季卡 ¥99, pay via WeChat **15232188653**, then enter the redeem code you receive. Nav shows **已解锁** afterward. Use **退出解锁** on the pricing page to reset this browser.

## Paywall / redeem codes

This is a frontend-only MVP. There is **no payment API, login, or backend**. Learners pay manually on WeChat; the operator sends a redeem code. The browser checks the code against `data/codes.json`.

This allowlist is **not security**. Anyone who can read the public repo can redeem or skip the lock. Treat unused codes as burnable inventory and rotate them if they leak.

**Operators:** follow [`docs/ops-redeem.md`](docs/ops-redeem.md) (sales copy, WeChat 15232188653, how to issue codes, how to generate a new batch with `scripts/gen-codes.py`). Do not publish unused codes on Moments, Xiaohongshu, or this README.

Site copy: 免费试学仅 Level 1 第 1–5 课 · 开通解锁全部已上线课程（含 Level 1 + Level 2 已发布课） · 微信联系 15232188653 人工付款后获兑换码。

## Lesson data

All lesson content lives in one file:

```text
data/lessons.json
```

Shape:

```json
{
  "course": { "title": "...", "pitch": "...", "disclaimer": "..." },
  "levels": [
    { "id": "lle1", "title": "Let's Learn English · Level 1", "lessons": [/* 52 */] },
    { "id": "lle2", "title": "Let's Learn English · Level 2", "lessons": [/* 25 so far */] }
  ]
}
```

Each lesson uses `{ id, number, title, subtitle, videoUrl, sourceUrl, dialogue, quiz, attribution }`. Level 2 lessons also set `"level": 2`. Unlock treats a lesson as free only when `level === 1` and `number <= 5` (`lle2-*` is always paid). The Level 1 通关 banner still uses the 52 `lle1` lessons only.

## Local preview

Serve the repo root over HTTP so the browser can fetch `data/lessons.json`:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Opening `index.html` as a file URL will not load the JSON.

Check-in, wrong-book, and unlock helpers can be unit-tested with:

```bash
node --test js/study.test.js js/unlock.test.js
```

Local testing note: there are **no public demo codes**. Unlock unit tests use their own fixtures. To try the redeem form locally, take a code from `data/codes.json` on your machine, or generate extras with `python3 scripts/gen-codes.py --monthly 1 --quarterly 1` and append them. Do not advertise those codes to end users.

## Public preview

Open on phone or desktop:

https://1019666077-bit.github.io/wx-extract-mvp/

GitHub Pages is served from `main` at `/` (repo root). A newly published site can take about 30 seconds to stabilize; if it does not load, refresh once.

## Scope

In scope: catalog + fifty-two Level 1 lessons and the first twenty-five Level 2 lessons, with local progress, check-in, a wrong-answer book, and a frontend redeem-code paywall.

Out of scope: login, accounts, a real payment gateway, a crawler, or a backend.
