# Apex Racing — Live Race Strategy Optimization Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

> Real-time F1 race strategy command center with discrete-event simulation, live track visualization, strategy comparison, and one-click pit radio integration.

---

## Features

- **Live Operations** — Real-time race state with driver cards, sector times, weather, and DRS/alert overlays
- **Strategy Simulator** — Discrete-event simulator generating multi-stop strategy options with win/podium/top5 probabilities
- **Post-Race Analysis** — Actual vs predicted comparison with deviation events and auto-generated playbooks
- **Championship** — Multi-round standings, timeline, head-to-head sector radar + delta bars
- **What-If Builder** — Custom pit laps, compounds, pace modes with live delta-to-baseline
- **Pace Impact** — Rolling delta-from-baseline line, background pace-mode shading, change log
- **Radio Console** — One-click strategy export to pit box with queued/transmitting/delivered status
- **Data Export** — CSV/JSON export with session/lap/driver filters

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4, shadcn/ui |
| Database | Prisma + SQLite |
| Charts | Recharts |
| State | Zustand |
| Real-time | WebSocket (port 3003) |
| Animation | Framer Motion |

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) >= 1.2 or Node.js >= 20

### Setup

```bash
git clone https://github.com/hemv-857/apex-racing-live-strategy.git
cd apex-racing-live-strategy

bun install
bunx prisma generate
bunx prisma db push
bunx tsx scripts/seed.ts

bun run dev
```

Open **http://localhost:3000**.

### Environment Variables

Copy `.env.example` to `.env`:

```env
DATABASE_URL=file:./db/custom.db
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/race/state` | GET | Current in-process session |
| `/api/race/tick` | POST | No-op (server-side ticker) |
| `/api/race/reset` | POST | Reset session (opt. `trackId`) |
| `/api/simulation/run` | POST | Generate strategy options |
| `/api/comparison` | POST | Overlaid lap traces for chart |
| `/api/pace-log` | GET/POST | Pace change history + mutation |
| `/api/predictions` | GET/POST | Pre-race predictions for accuracy |
| `/api/analysis` | POST | Post-race actual vs predicted |
| `/api/alerts` | POST | Generate alerts for session |
| `/api/radio/send` | POST | Queue radio call |
| `/api/history` | GET | Lap history with sectors |
| `/api/standings` | GET | Championship standings |
| `/api/timeline` | GET | Points progression timeline |
| `/api/head-to-head` | GET | Sector-by-sector comparison |

---

## Simulation Engine

Deterministic discrete-event simulator calibrated from practice data:

- `simulateStrategy()` — Full race trace for a pit plan
- `simulateRaceOutcomes()` — All generated plans vs rival reference
- `simulateWhatIf()` — Custom config with delta-to-baseline
- `buildStrategyComparison()` — Multi-trace overlay data
- `computeFinishProbabilities()` — Monte Carlo sampling over normal distributions

Probabilities derived by sampling 3000 draws from `N(ourMean, variance²)`.

---

## Database

SQLite via Prisma. Models: `RaceSession`, `DriverState`, `LapHistory`, `ChampionshipRound`, `PaceChange`, `PredictionRun`, `SimulationRun`, `Alert`, `RadioCall`, `PostRaceAnalysis`, `Playbook`.

---

## License

MIT — see [LICENSE](LICENSE).
