# Baby Diary

A web app (PWA) for tracking a newborn's routine and health: feedings,
diaper changes, and growth, with a dashboard to spot patterns.

**Live at:** https://mariofbarros.github.io/my-baby-monitor-/

Works in a phone browser and can be installed to the Android home screen
("Add to Home screen"), behaving like a native app, including offline.

## Features

**Feedings**
- Three methods: breast (pick left or right), bottle, or mixed (breast + bottle)
- The timer starts immediately on tap; breast and mixed sessions also track the side
- Automatic suggestion for the next breast, alternating from the last breast/mixed
  feeding (bottle-only feedings don't count toward the alternation)
- The timer survives closing/reopening the app (the start time is saved)
- History with method, side (when applicable), time, and duration of each feeding
- Edit any past feeding (method, side, date, start time, duration) or delete it

**Diapers**
- One-tap logging: pee, poop, or both
- Shows how long it's been since the last change
- History with date and time; edit a past change (type, date, time) or delete it

**Growth**
- Weight (kg) and height (cm) logged by date
- Weight and height trend charts
- Edit a past measurement (date, weight, height) or delete it

**Dashboard**
- Daily summary: last feeding (counted from when it ended), next breast, last diaper change, last measurement
- Feeding and diaper charts for a selectable time range (today, yesterday, last
  week, last 15/30/90 days, this month, or all time), grouped by hour, day,
  week, or month depending on the range
- Simple alerts: more than 4h since the last feeding ended, or 6h without a
  diaper change

**Feeding and diaper history**
- Filterable by the same time ranges as the dashboard, each screen remembering
  its own choice
- Period summary (counts, total/average feeding time, breast split, diaper types)

## Data

Everything is stored locally on the device (IndexedDB) — nothing is sent to a
server. The "Baby" tab has a Backup section to move data between devices or
keep a copy:

- **Export** downloads every record (profile, feedings, diapers, measurements)
  as a JSON file.
- **Import** reads a JSON backup, shows how many records it found, and lets you
  choose how to bring them in:
  - **Add to existing** keeps what's on this device and adds the file's records
    (the file's profile is only used if this device doesn't have one yet).
  - **Replace everything** erases all data on this device first, after a
    confirmation, then loads the file.

  Backups made before feeding methods existed still import; their feedings are
  treated as breast feedings.

## Development

```bash
npm install
npm run dev      # local dev server at http://localhost:5173
npm run build    # production build in dist/
npm test         # run the test suite (Vitest)
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
