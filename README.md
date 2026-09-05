# VOA Learning English · Level 1

A small, static self-study shell for **Let's Learn English Level 1**.

This is frontend-only. There is no login, backend, or crawler. It is **not** an official VOA product.

## What it includes

- A course catalog on the home page
- Fifteen lessons: `lle1-01` through `lle1-15`
- Official VOA MP4 video in an HTML5 player (YouTube is an optional fallback link only)
- Dialogue lines in English and Chinese
- Three multiple-choice quiz questions per lesson
- Progress saved in `localStorage` under `voa-lle-progress` (`lessonId` → `{ score, total, completed, savedAt }`)
- Check-in / streak calendar (`voa-lle-checkins`) after each quiz submit
- Wrong-answer book (`voa-lle-wrongbook`) for missed quiz questions
- Frontend paywall: lessons 1–5 are free; lessons 6+ need a redeem code
- Clear VOA public-domain attribution

## Pages

| Page | File | Notes |
| --- | --- | --- |
| 课表 | `index.html` | Lesson cards plus a month check-in calendar. Locked cards show a lock badge |
| 打卡 | `progress.html` | Dedicated streak + month grid |
| 错题本 | `wrongbook.html` | Missed questions grouped by lesson |
| 开通 | `pricing.html` | Plans, manual-payment note, redeem-code unlock |
| Lesson | `lesson.html?id=lle1-01` | Video, dialogue, quiz. Paid lessons show a paywall until unlocked |

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

1. Open the catalog. Lessons 1–5 are free; 6–15 (and any later id with number > 5) show a lock badge until unlocked.
2. Start a free lesson, watch the VOA MP4, read the dialogue, then submit the quiz.
3. That submit checks in today and writes misses to the wrong-answer book. Check-in and the wrong-answer book work without unlocking.
4. Open **打卡** to see streak, days this month, and the highlighted month grid.
5. Open **错题本** to review misses. **再练** returns to `lesson.html?id=...`. Clear one item or clear all. Answer the same question correctly on retry and it disappears. Empty state: 「暂无错题」.
6. To open paid lessons, go to **开通** (`pricing.html`) and enter a redeem code. Nav shows **已解锁** afterward. Use **退出解锁** on the pricing page to reset for testing.

## Paywall / redeem codes

This is an MVP demo shell. There is **no payment API, login, or backend**. Codes are an allowlist in `data/codes.json` and are checked in the browser.

| Code | Plan |
| --- | --- |
| `VOA-DEMO-39` | 月付 ¥39 |
| `VOA-DEMO-99` | 季卡 ¥99 |

Do not treat this allowlist as security. Anyone who can read the repo can redeem.

Copy on the site: 免费试学：第 1–5 课 · 开通后解锁全部已上线课程 · 用兑换码解锁（演示码见 README）. Pricing also notes 非官方 · 基于 VOA Learning English 公版, and that payment is manual: 付款后联系发放兑换码, 微信号：（待填写微信号）.

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

Check-in, wrong-book, and unlock helpers can be unit-tested with:

```bash
node --test js/study.test.js js/unlock.test.js
```

## Public preview

Open on phone or desktop:

https://1019666077-bit.github.io/wx-extract-mvp/

GitHub Pages is served from `main` at `/` (repo root). A newly published site can take about 30 seconds to stabilize; if it does not load, refresh once.

## Scope

In scope: catalog + fifteen static lessons with local progress, check-in, a wrong-answer book, and a frontend redeem-code paywall.

Out of scope: login, accounts, a real payment gateway, a crawler, or a backend.
