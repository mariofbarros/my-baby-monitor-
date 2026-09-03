# Baby Diary

A web app (PWA) for tracking a newborn's routine and health: feedings,
diaper changes, and growth, with a dashboard to spot patterns.

**Live at:** https://mariofbarros.github.io/my-baby-monitor-/

Works in a phone browser and can be installed to the Android home screen
("Add to Home screen"), behaving like a native app, including offline.

## Features

**Feedings**
- Pick the breast to offer (left or right) and the timer starts immediately
- Automatic suggestion for the next breast, alternating from the last feeding
- The timer survives closing/reopening the app (the start time is saved)
- History with side, time, and duration of each feeding

**Diapers**
- One-tap logging: pee, poop, or both
- Shows how long it's been since the last change
- History with date and time

**Growth**
- Weight (kg) and height (cm) logged by date
- Weight and height trend charts

**Dashboard**
- Daily summary: last feeding, next breast, last diaper change, last measurement
- Feeding and diaper charts for a selectable time range (today, yesterday, last
  week, last 15/30/90 days, this month, or all time), grouped by hour, day,
  week, or month depending on the range
- Simple alerts: more than 4h without a feeding, or 6h without a diaper change

**Feeding and diaper history**
- Filterable by the same time ranges as the dashboard, each screen remembering
  its own choice
- Period summary (counts, total/average feeding time, breast split, diaper types)

## Data

Everything is stored locally on the device (IndexedDB) — nothing is sent to a
server. The "Baby" tab has an option to export all records as a JSON backup.

## Development

```bash
npm install
npm run dev      # local dev server at http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the production build
```

Stack: React + TypeScript + Vite, Dexie (IndexedDB), Recharts, vite-plugin-pwa.

## Deploy

Deploys automatically to GitHub Pages on every push to the default branch,
via the `.github/workflows/deploy.yml` workflow.

Before the first deploy, Pages needs to be enabled once in
**Settings > Pages > Build and deployment**, with **GitHub Actions** selected
as the "Source" (the workflow's token can't create the site on its own).

Since the site is served from a subdirectory (`/my-baby-monitor-/`), that path
is set as `base` in `vite.config.ts` — if the repository is ever renamed,
update that value too.
