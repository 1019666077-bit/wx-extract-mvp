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
- Clear VOA public-domain attribution

## Lesson data

All lesson content lives in:

```text
data/lessons.json
```

`index.html` is the catalog. Each lesson opens as `lesson.html?id=lle1-01` (or `lle1-02` … `lle1-10`). Shared render, quiz, and progress logic is in `js/app.js`.

## Local preview

Serve the repo root over HTTP so the browser can fetch `data/lessons.json`:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Opening `index.html` as a file URL will not load the JSON.

## Public preview

Open on phone or desktop:

https://1019666077-bit.github.io/wx-extract-mvp/

GitHub Pages is served from `main` at `/` (repo root). A newly published site can take about 30 seconds to stabilize; if it does not load, refresh once.

## Scope

In scope: catalog + ten static lessons with local progress.

Out of scope: login, accounts, a crawler, or a backend.
