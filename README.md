# Apex Racing — Live Race Strategy Optimization Platform

Real-time F1 race strategy command center with discrete-event simulation, live track visualization, strategy comparison, and one-click pit radio integration.

## Features

- **Live Operations** — Real-time race state with driver cards, sector times, weather, and DRS/alert overlays
- **Strategy Simulator** — Discrete-event simulator generating multi-stop strategy options with win/podium/top5 probabilities
- **Post-Race Analysis** — Actual vs predicted comparison with deviation events and auto-generated playbooks
- **Championship** — Multi-round standings, timeline with round filter, head-to-head sector radar + delta bars
- **What-If Builder** — Custom pit laps, compounds, pace modes with live delta-to-baseline
- **Pace Impact** — Rolling delta-from-baseline line, background pace-mode shading, change log
- **Radio Console** — One-click strategy export to pit box with queued/transmitting/delivered status
- **Data Export** — CSV/JSON export with session/lap/driver filters

## Architecture

```
src/
├── app/                    # Next.js 16 App Router (API routes + page)
├── components/
│   ├── racing/             # Domain components (track-view, driver-card, charts, etc.)
│   └── ui/                 # shadcn/ui primitives
├── hooks/                  # React hooks (race socket, mobile, toast)
├── lib/
│   ├── racing/
│   │   ├── data.ts         # Static driver/track/calibration data
│   │   ├── types.ts        # Shared TypeScript types
│   │   ├── simulation-engine.ts  # Core discrete-event simulator
│   │   ├── race-state.ts   # In-process race ticker + REST helpers
│   │   ├── history.ts      # Lap history, championship, pace log
│   │   ├── analysis.ts     # Post-race accuracy + playbooks
│   │   └── store.ts        # Zustand global state
│   ├── db.ts               # Prisma client
│   └── utils.ts
├── prisma/
│   └── schema.prisma       # SQLite models (sessions, laps, predictions, etc.)
└── mini-services/race-service/  # Independent WebSocket server (port 3003)
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client & push schema
npx prisma generate
npx prisma db push

# 3. Start dev server (port 3000)
npm run dev

# 4. In another terminal, start WebSocket mini-service (port 3003)
cd mini-services/race-service && bun run dev
```

Caddy reverse proxy (optional, port 81) routes `?XTransformPort=3003` to the WS service:
```bash
caddy run --config Caddyfile
```

## Environment

Create `.env`:
```
DATABASE_URL=file:./db/custom.db
```

## Key API Routes

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

## Simulation Engine

Deterministic discrete-event simulator calibrated from practice data (aero maps + tire degradation curves). Core functions:

- `simulateStrategy()` — Full race trace for a pit plan
- `simulateRaceOutcomes()` — All generated plans vs rival reference
- `simulateWhatIf()` — Custom config with delta-to-baseline
- `buildStrategyComparison()` — Multi-trace overlay data
- `computeFinishProbabilities()` — Monte Carlo sampling over normal distributions

Probabilities are derived by sampling 3000 draws from `N(ourMean, variance²)` and rival means; `variance = 1.5 + riskScore × 2.5`.

## Database

SQLite via Prisma. Models:
- `RaceSession`, `DriverState` — Live state
- `LapHistory` — Per-lap telemetry with S1/S2/S3
- `ChampionshipRound` — Round results (JSON)
- `PaceChange` — Pace-mode log
- `PredictionRun` — Pre-race predictions for accuracy tracking
- `SimulationRun`, `Alert`, `RadioCall`, `PostRaceAnalysis`, `Playbook`

## Docker

```bash
docker-compose up --build
# App:     http://localhost:3000
# WS:      ws://localhost:3003
# Caddy:   http://localhost:81
```

Production image builds standalone Next.js output (`Dockerfile` multi-stage).

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
1. **lint-and-typecheck** — ESLint + `tsc --noEmit`
2. **build** — `npm run build`
3. **test** — DB runtime build test script
4. **deploy-preview** — Upload standalone artifact on PR
5. **deploy-production** — Deploy on push to `main` (add secrets)

## License

MIT