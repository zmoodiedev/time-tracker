# Time Tracker ⏱

A phone app for tracking time at work, built for ADHD brains. It's the sibling of [Daily Planner](../DailyPlanner) and has the same look.

It's an installable web app (PWA): open the link in Chrome on your Android phone, tap **Install**, and it behaves like a normal app. It works offline, and **your data never leaves your phone**.

**Live app:** https://zmoodiedev.github.io/time-tracker/

## Install on your phone (one time)

1. Open the link above in **Chrome** on your phone.
2. Tap **Install** on the banner, or tap **⋮ → Add to Home screen / Install app**.
3. Open it from your home screen. It runs full-screen, without the browser bar.
4. Optional: **Settings → Running-timer notification**. While a timer runs, a notification shows what you're tracking, with a **Stop** button.

Long-press the app icon for shortcuts: **Stop timer** and **Today's log**.

## What's in it

**Track** (home screen)
- **One tap to start, one tap to switch.** Tap a project tile and the clock starts. Tap a different tile and it switches (the old one stops automatically).
- **Mis-tap protection:** tap the wrong tile and fix it within a minute, and it swaps the project without losing the start time.
- **"Started earlier?"** Tap −5m / −15m / −30m if you forgot to start the timer. The entry before it is trimmed so nothing overlaps.
- **Untracked since 10:42 (25m). Fill it in ›** appears when you've forgotten to start something.
- A daily goal bar (confetti when you hit it) and a 🔥 streak of workdays with time logged. Days off never break the streak.

**Day:** your timesheet numbers for the day (exact and rounded), plus a timeline. Gaps between entries show up as **Untracked · Fill ›**. Tap any entry to edit or delete it (with Undo).

**Week:** a bar per day, colored by project, plus a **timesheet grid** (projects × days, rounded). You can:
- **Share timesheet (CSV)**: send it to your work email and open it in Excel
- **Share every entry (CSV)**
- **Copy summary as text**

**Settings:** projects (name, color, timesheet code, order, archive), daily goal, workdays, week start, rounding (exact / 6 / 15 / 30 min), `1h 30m` vs `1.5h`, nudges, and backup/restore.

**Safety nets for forgotten timers**
- After a timer runs 3 hours (you can change this) or past midnight, it asks *"Still on Meetings?"* with **Yes** or **No, I stopped at [time]**.
- Timers shorter than 30 seconds are discarded as accidents.

## Your data

Everything is saved in Chrome's storage **on your phone only**. There's no server and no account. Clearing Chrome's site data for this app would erase it, so use **Settings → Back up** now and then (it shows how long since your last backup). **Restore** loads a backup file, e.g. onto a new phone.

## Development

```bash
npm install
npm run dev        # dev server, also reachable from your phone on the same Wi-Fi
npm run build      # production build into dist/
npm run typecheck
```

Pushing to `main` builds the app and deploys it to GitHub Pages automatically (`.github/workflows/deploy.yml`). Your installed app picks up the new version the next time you open it while online.

## Tech

React 19, Vite, Tailwind v4, shadcn/ui components, and Zustand (saved to localStorage). It shares the theme and components with Daily Planner. A hand-written service worker (`public/sw.js`) handles offline use and the notification's Stop button.

```
src/lib/        store, time math, stats, CSV/backup export, PWA plumbing
src/views/      Track, Day, Week, Settings
src/components/ dialogs, bottom nav, shared UI (shadcn components in components/ui)
public/         manifest, service worker, icons
```
