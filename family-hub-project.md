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

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 — Design | Iterate on UI/UX mockups to nail look and feel | ✅ Complete |
| 2 — Navigable mockup | Interactive mockup with dummy data, all panels clickable | ✅ Complete |
| 3 — Real data | Convert to React, wire up Google APIs, deploy | 🔄 In progress — repo/scaffold/deploy pipeline live, all panels ported to React with dummy data, Google API wiring next |
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
| T-04 | Set up Google Cloud project + OAuth | Phase 3 | One-time trickiest step. Unlocks all Google APIs. |
| T-05 | Wire up weather (Open-Meteo) | Phase 3 | Free, no auth. Westminster, CO coords. Replace dummy weather data. |
| T-06 | Wire up Google Calendar API | Phase 3 | Month + week + agenda views. Enable person filter. |
| T-07 | Wire up Google Tasks API | Phase 3 | Today / this week / by date. Enable task filters. |
| T-08 | Wire up Google Tasks for groceries | Phase 3 | Store-based via named task lists. Also absorbs anything that would've used Google Keep (see T-04 note — Keep API is Workspace-only, dropped). |
| T-09 | Set up familyhub@gmail.com AI agent | Phase 3 | Google Apps Script watches inbox, parses with LLM, writes to Google services. |
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
- **Use Claude Code for Phase 3** — much better than chat for file editing, running commands, and iterating on a real codebase. Use GitHub to sync across machines.
- **Dark theme contrast** — defer readability tuning until app is on the actual wall display. Hardware + ambient light affects this significantly.
- **Open-Meteo for weather** — free, no API key, no auth. Just lat/long. Perfect for this use case.
