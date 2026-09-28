# VOA Learning English

A small, static self-study shell for **Let's Learn English**.

This is frontend-only. There is no login, backend, or crawler. It is **not** an official VOA product.

## What it includes

- A course catalog on the home page with a Level 1 / Level 2 switcher
- Level 1 complete: fifty-two lessons, `lle1-01` through `lle1-52`
- Level 2 complete: thirty lessons, `lle2-01` through `lle2-30` (Budget Cuts, The Interview, He Said - She Said, Run Away With the Circus!, Greatest Vacation of All Time, Will It Float?, Tip Your Tour Guide, The Best Barbecue, Pets Are Family, Too!, Visit to Peru, The Big Snow, Run! Bees!, Save the Bees!, Made for Each Other, Before and After, Find Your Joy!, Flour Baby, Part 1, Flour Baby, Part 2, Movie Night, The Test Drive, Trash to Treasure, Part 1, Trash to Treasure, Part 2, Rock Star, I Feel Super!, Only Human, Look-alikes, Fish out of Water, For the Birds, Where There's Smoke..., Dream a Little Dream)
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
| Lesson | `lessons/lle1-01.html` | One static page per lesson. Video, dialogue, quiz. Paid lessons show a paywall until unlocked. Prev/next stay inside the current level. Old `lesson.html?id=lle1-01` redirects here |

Shared render, quiz, progress, check-in, unlock, and wrong-book logic lives in `js/study.js`, `js/unlock.js`, and `js/app.js`.

## localStorage

Dates use **Asia/Shanghai** (`YYYY-MM-DD`). There is no account; clearing site data clears study history.

| Key | Shape | When it updates |
| --- | --- | --- |
| `voa-lle-progress` | `{ [lessonId]: { score, total, completed, savedAt, answers, resultText } }` | Opening a lesson marks it in progress; submitting a quiz stores the score |
| `voa-lle-checkins` | `string[]` of `YYYY-MM-DD` | Any lesson quiz submit records today (deduped) |
| `voa-lle-wrongbook` | `{ lessonId, lessonTitle, questionId, prompt, choices, correctIndex, chosenIndex, savedAt }[]` | Wrong answers are upserted by `lessonId + questionId`. A later correct answer removes that item |
| `voa-lle-unlock` | `{ active, code, plan, unlockedAt, expiresAt }` | Set after a valid redeem code. While `active` and `expiresAt` is in the future, paid lessons open. Missing `expiresAt` counts as expired. |
| `voa-lle-script` | `zh-Hans` or `zh-Hant` | Set only when the reader uses the 简/繁 switch. The next visit opens the same page in that script. Progress keys above are shared by both scripts. |

A day counts as checked-in when the learner **submits a lesson quiz that day**. Current streak is consecutive Shanghai dates ending today, or yesterday if today is not yet checked in.

## How to use

1. Open the catalog and switch Level 1 / Level 2. Only Level 1 lessons 1–5 are free. Level 1 lessons 6–52 and every `lle2-*` lesson show a lock badge until unlocked.
2. Start a free lesson, watch the VOA MP4, read the dialogue, then submit the quiz.
3. That submit checks in today and writes misses to the wrong-answer book. Check-in and the wrong-answer book work without unlocking.
4. Open **打卡** to see streak, days this month, and the highlighted month grid.
5. Open **错题本** to review misses. **再练** returns to `lessons/<id>.html#quiz`. Clear one item or clear all. Answer the same question correctly on retry and it disappears. Empty state: 「暂无错题」.
6. To open paid lessons, go to **开通** (`pricing.html`): pick 月付 US$5.99（30 天） or 季卡 US$13.99（90 天）. The buttons call the Cloudflare Worker in `worker/` only after `payment.worker.baseUrl` and `payment.worker.unlockPublicKey` in `site.config.json` are both set and the pages are rebuilt. While either is empty, the buttons stay disabled and say 即将开放 / 即將開放, and the page does not call the network. Setup steps are in `docs/waffo-cloudflare-setup.md`. Nothing here is deployed. Use **退出解锁** on the pricing page to reset this browser. Unlock is kept only when `localStorage` holds a signed, unexpired credential. The public site origin is only `site.config.json` `origin` (still the GitHub Pages URL). A later move to Cloudflare Pages is prepared in `.github/workflows/cloudflare-pages.yml`; do not change `origin` until that host is checked.

## Paywall / redeem codes

This is a frontend-only MVP. There is **no payment API, login, or backend** yet. The only purchase buttons are Waffo links from `site.config.json` (`payment.waffo.monthlyUrl`, `payment.waffo.quarterlyUrl`). Both are empty until checkout URLs exist, so the buttons render disabled. `payment.waffo.returnUrl` is the success-return URL for later; while it is empty, `pricing-return.html` stays out of the sitemap and is marked `noindex`. The intended flow is pay on Waffo, return to the site, and unlock automatically. See [`docs/payment-waffo-plan.md`](docs/payment-waffo-plan.md). [`docs/ops-redeem.md`](docs/ops-redeem.md) is obsolete history.

`data/codes.json` in this public repo **must stay** `{"codes":[]}`. Do not commit unused codes. When that allowlist is empty, the browser accepts codes matching `LLE-M-XXXXXX` (monthly, 30 days) or `LLE-Q-XXXXXX` (quarterly, 90 days). That format check is **not security**. Anyone who can guess the pattern or skip the lock in DevTools can still open paid lesson pages.

**Operators:** do not collect payment by hand. The old redeem-code runbook is marked obsolete in [`docs/ops-redeem.md`](docs/ops-redeem.md). Before merge, run `bash scripts/check-codes-json.sh` (fails if `codes.length > 0`).

Site copy: 免费试学仅 Level 1 第 1–5 课 · 打卡日历与错题本免费使用 · 开通解锁全部已上线课程（含 Level 1 + Level 2 已发布课）· 月付 US$5.99 / 30 天 · 季卡 US$13.99 / 90 天 · Waffo 付款按钮（链接为空时显示即将开放）· 付款确认后自动开通。

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
    { "id": "lle2", "title": "Let's Learn English · Level 2", "lessons": [/* 30 */] }
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

Install the Traditional Chinese converter, then run checks:

```bash
npm install
node --test js/*.test.js
bash scripts/check-codes-json.sh
bash scripts/build-mp-data.sh --check
bash scripts/sync-voa-videos.sh --dry-run
node scripts/build-pages.js --check
```

## Languages and site origin

Simplified Chinese lives at the site root. Traditional Chinese (Taiwan wording) is a full mirror under `zh-hant/`: catalog, every lesson, progress, wrong-answer book, pricing, and the old `lesson.html` redirect. English lesson lines stay English. A 简/繁 control on each page links to the same screen in the other script.

Both versions share one origin, so `localStorage` progress, check-in, wrong-book, and unlock carry across. `js/app.js` loads `data/web/` or `data/web/zh-hant/` from the site root, not from the `zh-hant/` folder.

The published origin is the single `origin` field in [`site.config.json`](site.config.json). Canonical links, hreflang, Open Graph URLs, JSON-LD, `sitemap.xml`, `robots.txt`, and the Worker `ALLOWED_ORIGIN` all read that value at build time. It is still the GitHub Pages URL. The next host is Cloudflare Pages at the domain root. The project name `lle-learn` is provisional until the brand name is chosen; do not create that project before then. Do not change `origin` until that host is checked. The same three steps apply when you do:

1. Change `origin` in `site.config.json` (no trailing slash).
2. Run `npm install` if needed, then `node scripts/build-pages.js`. That rewrite also copies `origin` into `worker/wrangler.toml`.
3. Commit the regenerated pages and deploy. Redeploy the Worker so CORS follows.

Do not paste the origin into HTML or JS. The generator test fails if `js/seo-pages.js` hardcodes the host. Setup for the Pages project is in `docs/waffo-cloudflare-setup.md`.

URL pattern, prefixed with that origin:

| Script | Example |
| --- | --- |
| zh-Hans catalog | `/` |
| zh-Hant catalog | `/zh-hant/` |
| zh-Hans lesson | `/lessons/lle1-01.html` |
| zh-Hant lesson | `/zh-hant/lessons/lle1-01.html` |
| Locked lesson | `/lessons/lle1-06.html` and `/zh-hant/lessons/lle1-06.html` |
| Level 2 | `/lessons/lle2-01.html` and `/zh-hant/lessons/lle2-01.html` |
| Sitemap | `/sitemap.xml` |

Each page sets `<html lang>` to `zh-CN` or `zh-Hant`, points its canonical at itself, and lists `zh-Hans`, `zh-Hant`, and `x-default` (the Simplified URL). The sitemap lists both sets with `xhtml:link` alternates.

## Crawlable lesson pages

Each lesson has a static HTML page generated from `data/lessons.json`. Traditional copy is produced in the same build with [OpenCC](https://github.com/nk2028/opencc-js) `s2twp` (Simplified to Taiwan phrases), then a short override list in `js/seo-pages.js` (`OVERRIDES`): 腳本, 公共領域, 點擊播放, 網路, and 打開打卡/課表/頁面. Regenerate after editing lesson content or `site.config.json`:

```bash
npm install
node scripts/build-pages.js
node scripts/build-pages.js --check
```

`--check` fails when `lessons/*.html`, `zh-hant/**/*.html`, `data/web/`, `js/i18n.js`, `sitemap.xml`, or `robots.txt` drift from `data/lessons.json`. The same check runs inside `node --test js/*.test.js`.

The catalog and lesson pages do not download the full `data/lessons.json`. The home page embeds a slim catalog (`data/web/catalog.json`, or `data/web/zh-hant/catalog.json` on the Traditional site). Opening a lesson reads that page, and loads the matching per-lesson JSON only when the lesson is free or already unlocked.

Locked lesson HTML includes the Chinese title, a short intro, and the first two dialogue lines. The video URL, the rest of the dialogue, and the quiz stay out of the HTML until unlock. The per-lesson JSON files are still public, same as the old single JSON file: the paywall is a frontend gate, not a secret.

`robots.txt` in this repo allows crawling and points at `{origin}/sitemap.xml`. On a GitHub **project** page, crawlers read robots from the host root (`{scheme}://{host}/robots.txt`), not from the project path. The generated file names that host-root URL from `site.config.json`. Submit the sitemap URL in webmaster tools.

Local testing note: there are **no public demo codes**, and `data/codes.json` stays empty in git. Unlock unit tests use their own fixtures. To try the redeem form locally, generate a code with `python3 scripts/gen-codes.py --monthly 1 --quarterly 0` and type it into the form (empty allowlist accepts `LLE-M-*` / `LLE-Q-*` format). Do not commit that code. Do not advertise codes to end users.

## Public preview

GitHub Pages still serves this repo from `main` at the origin in `site.config.json`. Open `/` for Simplified Chinese and `/zh-hant/` for Traditional Chinese. A newly published site can take about 30 seconds to stabilize; if it does not load, refresh once. Cloudflare Pages is a separate workflow and does not replace this until the checklist in `docs/waffo-cloudflare-setup.md` is done.

## WeChat miniprogram (paused)

The public launch is this website on GitHub Pages. The native `mp-weixin` app in [`miniprogram/`](miniprogram/README.md) is paused; leave that folder in place. Open it in WeChat DevTools with placeholder AppID `touristappid` only if you resume that track.

Lesson `<video>` reads **`miniprogram/data/video-map.json`** (D1 placeholder: L1 lessons 1–5 on `media.example.com`). Do **not** point the player at Akamai. COS keys stay off-repo (`.env.cos` / `mirror/` are gitignored). See the miniprogram README for the DevTools “don’t verify legal domain” switch.

Generate split lesson JSON (catalog + per-lesson, no `videoUrl`):

```bash
bash scripts/build-mp-data.sh
bash scripts/sync-voa-videos.sh --dry-run
node --test js/study.test.js js/unlock.test.js js/mp-scaffold.test.js js/video.test.js
```

## Scope

In scope: catalog + fifty-two Level 1 lessons and thirty Level 2 lessons, with local progress, check-in, a wrong-answer book, and a frontend redeem-code paywall.

Out of scope: login, accounts, a real payment gateway, a crawler, or a backend.
