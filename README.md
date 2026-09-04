# VOA Learning English MVP

Static, single-lesson preview of **Let's Learn English Level 1, Lesson 1: Welcome!** (`lle1-01`).

This MVP is frontend-only. There is no login, backend, crawler, or extra lessons.

## What it includes

- Lesson title and subtitle
- YouTube embed for the official VOA video
- Dialogue lines in English and Chinese
- Three multiple-choice quiz questions
- Quiz results saved in `localStorage` under `voa-lle1-01-quiz`
- VOA public-domain attribution in the footer

## Lesson data

All lesson content lives in:

```text
data/lessons.json
```

`js/app.js` loads that file, finds the lesson with id `lle1-01`, and renders the page.

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

The page is VOA Let's Learn English Lesson 1, with dialogue and quiz. A newly published GitHub Pages site can take about 30 seconds to stabilize; if it does not load, refresh once.

GitHub Pages is served from `main` at `/` (repo root).

## Scope

In scope: one static lesson page for `lle1-01`.

Out of scope: login, accounts, a crawler, a backend, or additional lessons.
