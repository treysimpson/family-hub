# Family Hub — Project Living Document

> **How to use this file**
> Keep this alongside the project. At the start of any new chat session, paste the contents so Claude has full context. Update after every working session.

---

## Key context (read this first in any new chat)

- **Project:** A wall-mounted family command center running on a tablet or touchscreen + Raspberry Pi
- **Owner:** Trey — Westminster, CO. Basic coding background (scientist-level scripting, not software dev). Has built simple apps with Claude before.
- **Family:** Trey + wife Beryl (iPhone), kids Bryce and Emery
- **Ecosystem:** Primarily Google (Gmail, Google Calendar, Google Tasks). Beryl on iPhone — must work cross-platform. Google Keep is **not used** — its API is Workspace-only and unavailable on personal Gmail accounts (confirmed 2026-08-05); groceries and any Keep-style lists live in Google Tasks instead (separate task lists, same OAuth).
- **Stack decision:** Custom React app (not Home Assistant dashboard) hosted on GitHub Pages (free). Home Assistant may be added later as a hybrid backend for smart home control — designed to be addable without breaking existing code.
- **Cost constraint:** No ongoing subscription costs. Upfront hardware/one-time costs OK.
- **Google API note:** OAuth setup is the trickiest one-time step. Once done, all subsequent Google APIs reuse the same auth.
- **Display aspect ratio:** 16:9 landscape (most common wall-mount orientation). Locked via CSS padding-top trick. Easy to change. All sizing in `em` units so it scales to any screen size.
- **AI agent:** A dedicated Gmail address (e.g. familyhub@gmail.com) watched by a Google Apps Script that parses emails with an LLM and writes to Google services. Works from any device/platform.
- **App structure principle:** Modular panel/nav architecture — every feature is its own component behind a nav item. Makes adding new features (smart home, budget, etc.) trivial without touching existing code.
- **Current file:** `family-hub-d2.5.html` — single HTML file with full dummy data, all panels functional, dual light/dark theme with CSS variables.
- **Tooling:** Phase 3 onward should use Claude Code (CLI) for file editing + GitHub for version control and cross-machine sync.

---

## Resume on a new machine

Everything is committed and pushed to GitHub — nothing lives only on one PC. To pick this project back up anywhere:

1. **Install prerequisites** (if not already on the machine): [Node.js LTS](https://nodejs.org) and [GitHub CLI](https://cli.github.com). On Windows, `winget install OpenJS.NodeJS.LTS` and `winget install GitHub.cli` both work well via Claude Code's Bash/PowerShell tool.
2. **Clone the repo**: `git clone https://github.com/treysimpson/family-hub.git` (repo is public, so no auth needed just to clone — but `gh auth login` is needed for pushing later; walks through a one-time-code browser flow).
3. **Install deps**: `cd family-hub && npm install`.
4. **Open Claude Code in that folder** and paste this whole file into the chat (or just say "read family-hub-project.md and continue") — that's the standing instruction at the top of this doc, and it gives a fresh Claude session everything it needs.
5. **The very next task** is verifying the Google sign-in flow actually works end-to-end. This needs a human to click "Sign in with Google" in the app's Settings panel and complete the real OAuth consent — Claude cannot do this step itself (browser automation can drive clicks, but not a live Google account login). To test:
   - `npm run dev` (starts on `http://localhost:5183/family-hub/` — this exact origin is already authorized in the OAuth client, don't change the port without also adding the new one in Google Cloud Console → APIs & Services → Credentials → "Family Hub Web Client")
   - Open the app, click the ⚙️ settings icon, click "Sign in with Google"
   - Sign in as wdsimpson3@gmail.com (must be one of the two test users already configured — see T-04 below)
   - Confirm: Calendar month/week/agenda views show real events, Tasks/Groceries show real Google Tasks lists (7 lists get auto-created on first sign-in: Trey/Beryl/Kids/Family/Grocery/Costco/Other), checking things off actually round-trips to Google
   - If anything errors, check the browser console — `AppContext.jsx`'s `calendarError`/`tasksError` state and `googleAuth.js`'s `authError` are surfaced but not yet shown anywhere in the UI beyond the Settings panel's sign-in button, so console logs are the fastest way to see what broke.
6. Once sign-in is verified working, the remaining backlog is T-09 (the email AI agent) and whatever Future items get prioritized (see To-do list below).

**Nothing is machine-specific** — no local-only config, no secrets in untracked files, no machine-specific paths in the codebase. The OAuth client ID is public-safe and lives directly in `src/lib/googleAuth.js`.

---

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 — Design | Iterate on UI/UX mockups to nail look and feel | ✅ Complete |
| 2 — Navigable mockup | Interactive mockup with dummy data, all panels clickable | ✅ Complete |
| 3 — Real data | Convert to React, wire up Google APIs, deploy | 🔄 In progress — repo/scaffold/deploy live, all panels ported to React, Google Calendar + Tasks APIs wired and code-complete. **Not yet tested against a real signed-in Google account** — see "Resume on a new machine" below, that's the very next step. |
| 4 — Smart home (optional) | Add Home Assistant hybrid for device control | Not started |

---

## Design iterations

### d.1.0 through d.1.5 — Design phase
Initial mockup through Home Control tab. Dark Dakboard-inspired theme. Settled layout, navigation structure, calendar views, weather overlay, family color coding.

### d.2.0 through d.2.5 — Navigable mockup phase

**d.2.0** — First fully navigable mockup. All placeholder panels replaced with dummy data:
- Calendar (full page with Month/Week/Agenda toggle)
- Tasks (person + time filters, scrollable list)
- Groceries (store-based: Grocery / Costco / Other)
- Chores (per-person grid with progress bars)

**d.2.1** — UI fixes batch 1: working task filters, scrollable lists, touch-friendly inputs, home screen items navigate to tabs, calendar defaults to week view, event detail side panel.

**d.2.2** — UI fixes batch 2: home calendar events navigate to Calendar tab + open event panel, weather day detail panel, filter pill contrast fixed, frequent grocery items functional, clear checked items works.

**d.2.3** — Groceries redesigned as store-based lists (Grocery / Costco / Other). Placeholder controls labeled "live in Phase 3."

**d.2.4a/b** — Two theme variants built: Hearth (warm light mode) and Dakboard (premium dark). Compared side by side.

**d.2.5** — Both themes merged into one file using CSS custom properties. Settings panel added (⚙️ in top bar). Theme choice persists via localStorage. Dark is default. Filter pill contrast fixed on dark theme.

**Known deferred items (intentional placeholders until Phase 3):**
- Calendar person filter pills toggle visually but don't hide/show events (need real data)
- Chores week navigation buttons are dimmed/disabled (need real data)

---

## Current architecture (as of 2026-08-06)

The React app lives at the repo root (not in a subfolder). Key files for a fresh session to know about:

- **`src/lib/googleAuth.js`** — Google Identity Services (GIS) browser token flow. No backend, no client secret used. Exports `signIn()`, `signOut()`, `trySilentSignIn()`, `getStoredToken()`. Token is cached in `sessionStorage` (clears on tab close, which is fine/expected).
- **`src/context/AuthContext.jsx`** — wraps the above in React state (`isSignedIn`, `accessToken`, `signIn`, `signOut`, `signingIn`, `authError`). Auto-schedules silent token refresh 5 min before expiry. Wraps the whole app in `App.jsx`, outside `AppProvider` (Auth has to exist first since `AppContext` reads from it).
- **`src/lib/googleCalendar.js`** — `fetchEvents(accessToken, timeMin, timeMax)`, normalizes raw Calendar API events into `{id, title, allDay, start, end, location, notes, who, color}`.
- **`src/lib/googleTasks.js`** — full Tasks API wrapper: `ensureTaskLists` (auto-creates named lists), `fetchTasks`, `insertTask`, `setTaskStatus`, `deleteTask`, `clearCompletedTasks`. `PERSON_LISTS` and `STORE_LISTS` constants define the 7 list names.
- **`src/lib/dateGrid.js`** + **`src/lib/buildCalendarViews.js`** — pure date-math + transform functions that turn a flat list of Calendar events into the exact month-grid/week-days/agenda-groups shapes the view components expect. No date library dependency.
- **`src/context/AppContext.jsx`** — the hub. Fetches weather (always), calendar events + tasks (only when `isSignedIn`). Exposes `calendarViews` (either live-built or the original mock data, picked automatically) and `tasksLive`/`personTasks`/`groceryTasks` + action functions. **Every page component branches on `tasksLive`/`calendarViews.live`** to decide whether to render real data or fall back to `src/data/mockData.js` — so the app is always fully functional and demo-able even signed out.
- **`src/lib/weather.js`** — Open-Meteo fetch + normalize, no auth needed, independent of Google sign-in.
- **`src/data/mockData.js`** — still used for family member info (names/colors), chores, home control, and as the signed-out fallback for calendar/tasks. Weather mock data was removed (T-05) since weather has no signed-out/signed-in distinction — it's just always live.

**Design pattern to preserve going forward:** any new Google-backed feature should follow the same shape — a thin `src/lib/googleX.js` REST wrapper, state + derived view in `AppContext`, and the consuming page component branching on a `live` flag with a mock fallback. This keeps the app safely demoable at every commit and matches how Calendar/Tasks were done.

---

## Phase 3 — Build plan (up next)

**Recommended order:**

| Step | Task | Notes |
|------|------|-------|
| 3a | Set up GitHub repo | Enables cross-machine sync + is required for GitHub Pages deploy |
| 3b | Convert HTML mockup to React app | Use Claude Code. Scaffold with Vite + React. Each panel becomes a component. |
| 3c | Deploy skeleton to GitHub Pages | Get a real URL before touching OAuth |
| 3d | Set up Google Cloud project + OAuth | One-time. Unlocks all Google APIs. Requires a real URL. |
| 3e | Wire up weather API | Easiest first win — no OAuth needed. Use Open-Meteo (free, no key). |
| 3f | Wire up Google Calendar | OAuth required. Month + week + agenda views. |
| 3g | Wire up Google Tasks | Reuse same OAuth. Today / this week / by date filters. |
| 3h | Wire up Google Tasks for groceries | Same OAuth. Store-based lists via task list names. |
| 3i | Set up AI agent | familyhub@gmail.com + Google Apps Script. Watches inbox, parses, writes to Google services. |

---

## To-do list

### Pending

| # | Task | Phase | Notes |
|---|------|-------|-------|
| T-09 | Set up familyhub@gmail.com AI agent | Phase 3 | Google Apps Script watches inbox, parses with LLM, writes to Google services. Needs a real Google account created for familyhub@gmail.com — not something Claude can do; a manual step for Trey. |
| T-10 | (Future) Add Home Assistant for smart home | Phase 4 | Pi backend, React calls HA local REST API |
| T-11 | (Future) Budget tab | Phase 3+ | Track household spending/budgets |
| T-12 | (Future) Pin code lock for tabs | Phase 3+ | Lock any tab behind a PIN — useful on kids-facing display |
| T-13 | (Future) Sports scores & schedules | Phase 3+ | **Feasible.** ESPN undocumented API or free SportsDataIO tier. No auth for read-only scores. |
| T-14 | (Future) Solar generation — Enphase/Enlighten | Phase 3+ | **Feasible.** Free API for system owners. Requires Enlighten developer account + API key. |
| T-15 | (Future) Eufy doorbell/camera live feed | Phase 3+ | **Difficult.** No official API. Best path: Home Assistant Eufy integration as proxy → HLS stream. Requires Phase 4 first. |
| T-16 | (Future) Remote start — MySubaru | Phase 3+ | **Difficult/risky.** No official API. Community workarounds have been blocked by Subaru before. Not recommended yet. |
| T-17 | (Future) Paprika → grocery list | Phase 3+ | **Feasible with workaround.** No public API but supports Dropbox export. Script reads export → appends to Google Tasks. |
| T-18 | (Future) Dinner menu tab | Phase 3+ | **Feasible, design as standalone app first.** Pull from Paprika via Dropbox, show recipe cards, add to meal plan + grocery list. |
| T-19 | (Future) Google Photos screensaver | Phase 3+ | **Feasible.** On inactivity, switch to fullscreen slideshow with weather + time overlay. Reuses Google OAuth already planned. |
| T-20 | (Future) Spotify now playing / control | Phase 3+ | **Feasible.** Spotify Web API is free + well-documented. Show track, album art, play/pause/skip. Spotify Connect for speaker control. |

### Done

| # | Task | Completed | Notes |
|---|------|-----------|-------|
| — | Brainstorm project architecture | 2026-03-20 | Settled on React + Google APIs + GApps Script agent |
| — | Choose Home Assistant vs React app | 2026-03-20 | React app chosen; HA deferred to Phase 4 |
| — | Design phase (d.1.0 → d.1.5) | 2026-03-20 | Layout, nav, calendar, weather, home control, family names |
| — | Navigable mockup (d.2.0 → d.2.5) | 2026-05-16 | All panels functional, dual theme, settings panel, syntax errors fixed |
| T-01 | Set up GitHub repo | 2026-08-05 | Public repo at github.com/treysimpson/family-hub (public needed for free GitHub Pages) |
| T-02 | Scaffold Vite + React app | 2026-08-05 | Vite/React scaffold merged into repo root, base path set to `/family-hub/`. Panel conversion from mockup tracked separately as T-02b. |
| T-03 | Deploy skeleton to GitHub Pages | 2026-08-05 | Live at https://treysimpson.github.io/family-hub/ via GitHub Actions (deploys automatically on push to master) |
| T-02b | Convert each mockup panel to a React component | 2026-08-05 | All 7 panels ported (Home, Calendar, Tasks, Groceries, Chores, Home Control, Weather) with working filters/toggles/add-item state, event + weather-day detail panels, settings panel with persisted theme. Consolidated the mockup's duplicated month/week/agenda dummy data into one shared model (src/data/mockData.js) with reusable MonthView/WeekView/AgendaView components, so real Google Calendar data (T-06) can slot in without restructuring. Fixed a layout bug carried over from the mockup: `.aspect-wrap` had no `overflow:hidden`, so closed side panels (hidden via `transform: translateX(100%)`) were visible outside the screen bounds. Verified visually in both themes via Claude in Chrome. |
| T-04 | Set up Google Cloud project + OAuth | 2026-08-05 | GCP project "Family Hub" (ID `family-hub-504703`), Calendar API + Tasks API enabled. OAuth consent screen: External audience, Testing publishing status (no verification needed for a 2-person app), scopes `auth/calendar` + `auth/tasks`, test users wdsimpson3@gmail.com + beryl131@gmail.com. Web OAuth client "Family Hub Web Client" created with authorized JS origins `https://treysimpson.github.io` and `http://localhost:5183` (no redirect URI — app will use Google Identity Services' browser token flow, no backend). Client ID: `214844293769-vrmfljk6r20969u86vkb4706e4p7gkrd.apps.googleusercontent.com` (safe to reference in frontend code/config — not secret for public clients). Client secret was shown once but is unused and wasn't saved anywhere. |
| T-05 | Wire up weather (Open-Meteo) | 2026-08-05 | `src/lib/weather.js` fetches + normalizes live Open-Meteo data for Westminster, CO (no API key). Shared via AppContext (one fetch, refreshed every 15 min) — powers both the topbar's inline temp and the full Weather page, including day-detail panel. WMO weather codes mapped to the app's emoji icon set, with day/night icon variants. Removed now-dead dummy weather exports from mockData.js. |
| T-06 | Wire up Google Calendar API | 2026-08-06 | Google Identity Services browser token flow (`src/lib/googleAuth.js` + `AuthContext.jsx`) — no backend, no client secret, sign-in/out lives in the Settings panel. Real events (`googleCalendar.js`) get transformed (`buildCalendarViews.js` + `dateGrid.js`) into the same month/week/agenda/next-5-days shapes the UI already expects, computed from the actual current date. Home + Calendar page branch on `calendarViews.live`: real data + real per-day weather when signed in, original mock data when signed out. Person filter pills on the Calendar page stay visual-only — a single primary calendar has no per-family-member signal to filter by (would need separate per-person calendars merged together, a possible future item). **Not yet tested against a real account** — see "Resume on a new machine" above. |
| T-07, T-08 | Wire up Google Tasks API (tasks + groceries) | 2026-08-06 | `src/lib/googleTasks.js` — full REST wrapper. Both Tasks and Groceries need per-category data Google Tasks doesn't support as custom fields, so each gets its own auto-created named list (Trey/Beryl/Kids/Family for tasks; Grocery/Costco/Other for groceries) via `ensureTaskLists` on first sign-in — these lists also show up in Google Tasks on Trey/Beryl's phones. AppContext flattens all 7 lists into `personTasks`/`groceryTasks` with optimistic-update actions (toggle/add/delete/clear-completed). TasksPage, GroceriesPage, and Home's grocery teaser branch on `tasksLive`. **Not yet tested against a real account.** |

---

## Things to never forget

- **Module/panel architecture from day 1** — every feature is its own React component behind a nav item. Never build monolithic pages.
- **Google Home API is restricted** — no public API for device control. Must go through Home Assistant (Phase 4). Don't try to call Google Home directly from React.
- **Beryl is on iPhone** — any sync mechanism must work natively on iOS. Google Tasks + Calendar both have good iOS apps. Avoid Android-only solutions.
- **GitHub Pages is the deploy target** — static hosting, free. React app must be a static build (no Node server at runtime). Vite handles this cleanly.
- **Google Apps Script agent is serverless** — runs on Google's infrastructure. Pi not required for the agent.
- **Google Keep has no API for personal accounts** — Keep API is Workspace-only (admin-approved business accounts). Dropped from the plan 2026-08-05; everything Keep would've done lives in Google Tasks instead.
- **One Google OAuth setup covers Calendar + Tasks** — same credentials, no Keep scope needed.
- **OAuth requires a real URL** — set up GitHub Pages deploy before configuring Google Cloud OAuth consent screen.
- **OAuth app stays in "Testing" mode** — External audience, only the 2 test users (Trey + Beryl) can authorize it; no Google app verification needed since it never goes to Production. If either sign-in ever fails with an "app not verified" or "access blocked" error, check that their email is still listed under Audience → Test users in the Google Auth Platform console.
- **Beryl must complete her own Google sign-in/consent** the first time she uses the app on her device — Trey authorizing doesn't cover her account.
- **Use Claude Code for Phase 3** — much better than chat for file editing, running commands, and iterating on a real codebase. Use GitHub to sync across machines.
- **Dark theme contrast** — defer readability tuning until app is on the actual wall display. Hardware + ambient light affects this significantly.
- **Open-Meteo for weather** — free, no API key, no auth. Just lat/long. Perfect for this use case.
