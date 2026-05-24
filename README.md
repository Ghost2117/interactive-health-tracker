# Interactive Health Tracker

A personal health tracking app built with Next.js. Log daily metrics, strength workouts, cardio sessions, and nutrition — all stored locally as CSV files. No database, no accounts, no cloud dependency.

---

## Features

### Dashboard (`/`)
- Summary cards: today's steps, last night's sleep, today's calories, today's protein, last workout date, cardio sessions this week
- 5 trend charts over the last 30 days: weight, steps, sleep, daily calories, cardio distance
- Each chart uses a bar + line combo (bars for magnitude, line connecting peaks)

### Daily Metrics (`/daily`)
- Log weight (kg), steps, sleep hours, water intake (ml), and notes
- One entry per day — submitting again overwrites the existing entry for that date
- Edit any row inline via pencil icon; delete with confirmation dialog
- Export all data as CSV

### Strength Training (`/strength`)
- Log exercises by sets, reps, and weight — multiple exercises per session
- Exercise autocomplete: dropdown suggests past exercise names as you type
- History table grouped by date with edit and delete per row
- Progression charts: select any exercise to see max weight and total volume (sets × reps × kg) over time
- Export all data as CSV

### Cardio (`/cardio`)
- Log sessions by activity type, duration, distance, and average heart rate
- Draw your route on an interactive Mapbox map — distance auto-calculates from the drawn polyline
- Saved routes are viewable from the history table (map pin icon)
- Distance display in km or mi (toggle in header, persisted to localStorage)
- Export all data as CSV

### Nutrition (`/nutrition`)
- Log meals by type (breakfast / lunch / dinner / snack) with per-meal calorie and macro breakdown
- History table with daily totals row at the bottom of each day
- 30-day stacked bar chart showing daily protein, carbs, and fat
- Today's macro split as a donut pie chart
- Export all data as CSV

---

## Tech Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.2.6 | Routing, server components, server actions, API routes |
| Language | TypeScript | ^5 | Type safety across the full stack |
| Styling | Tailwind CSS | ^4 | Utility-first CSS |
| UI Primitives | Base UI (`@base-ui/react`) | ^1.5 | Accessible headless components (Dialog, AlertDialog, etc.) |
| UI Scaffolding | shadcn/ui | ^4.8 | Component code generation on top of Base UI |
| Charts | Recharts | ^3.8 | Line, bar, composed, and pie charts |
| Map | Mapbox GL JS + react-map-gl | 3.24 / 8.1 | Interactive map rendering |
| Route Drawing | @mapbox/mapbox-gl-draw | ^1.5 | Polyline drawing tool on the map |
| Distance Calc | @turf/length | ^7.3 | GeoJSON LineString to km distance |
| CSV Parsing | PapaParse | ^5.5 | CSV read/write for local data storage |
| Icons | lucide-react | ^1.16 | Icon set |

---

## Project Structure

```
interactive-health-tracker/
├── app/                          # Next.js App Router pages and API routes
│   ├── page.tsx                  # Dashboard — summary cards + trend charts
│   ├── layout.tsx                # Root layout — nav bar, font, global styles
│   ├── globals.css               # Global CSS and Tailwind imports
│   ├── daily/page.tsx            # Daily metrics page
│   ├── strength/page.tsx         # Strength training page
│   ├── cardio/page.tsx           # Cardio page (thin server shell → CardioPageClient)
│   ├── nutrition/page.tsx        # Nutrition page
│   └── api/export/               # CSV download route handlers
│       ├── daily/route.ts
│       ├── strength/route.ts
│       ├── cardio/route.ts
│       └── nutrition/route.ts
│
├── components/
│   ├── nav.tsx                   # Top navigation bar
│   ├── MetricCard.tsx            # Summary stat card (title, value, unit, icon)
│   ├── TrendChart.tsx            # Reusable ComposedChart (bar + line) wrapper
│   ├── ExportButton.tsx          # "Export CSV" button — triggers browser download
│   │
│   ├── daily/
│   │   ├── DailyForm.tsx         # Add/edit a daily entry
│   │   └── DailyTable.tsx        # History table with edit + delete per row
│   │
│   ├── strength/
│   │   ├── StrengthForm.tsx      # Add/edit a strength exercise entry
│   │   ├── ExerciseInput.tsx     # Autocomplete input for exercise names
│   │   ├── StrengthTable.tsx     # History table grouped by date
│   │   └── ProgressionChart.tsx  # Per-exercise max weight + volume charts
│   │
│   ├── cardio/
│   │   ├── CardioPageClient.tsx  # Client wrapper — owns unit (km/mi) state
│   │   ├── CardioForm.tsx        # Add/edit a cardio session
│   │   ├── CardioTable.tsx       # History table with route viewer + edit + delete
│   │   ├── RouteMapPicker.tsx    # Mapbox map for drawing a route (browser-only)
│   │   └── RouteViewer.tsx       # Mapbox map for replaying a saved route
│   │
│   ├── nutrition/
│   │   ├── NutritionForm.tsx     # Add/edit a meal entry
│   │   ├── NutritionTable.tsx    # History table with daily totals rows
│   │   └── MacroChart.tsx        # 30-day macro bar chart + today's donut pie
│   │
│   └── ui/                       # shadcn/Base UI primitives (generated, not hand-edited)
│       ├── alert-dialog.tsx      # Confirmation dialog (used for delete actions)
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx            # Modal dialog (used for edit forms)
│       ├── input.tsx
│       ├── label.tsx
│       └── table.tsx
│
├── lib/
│   ├── types.ts                  # TypeScript types for all 4 data categories
│   ├── csv.ts                    # Generic readCsv<T> / writeCsv<T> helpers (server-only)
│   ├── actions.ts                # All Next.js Server Actions (CRUD for each category)
│   ├── routes.ts                 # GeoJSON route read/write helpers for routes.json
│   ├── units.ts                  # km <-> mi conversion utilities
│   └── utils.ts                  # Tailwind class merging utility (cn)
│
├── hooks/
│   └── useUnit.ts                # localStorage-backed km/mi unit preference (default: mi)
│
└── data/                         # Local data storage — plain files, committed to git
    ├── daily.csv                 # date, weight_kg, steps, sleep_hours, water_ml, notes
    ├── strength.csv              # date, exercise, muscle_group, sets, reps, weight_kg, notes
    ├── cardio.csv                # date, activity_type, duration_min, distance_km, avg_heart_rate, route_id, notes
    ├── nutrition.csv             # date, meal_type, food, calories, protein_g, carbs_g, fat_g, notes
    └── routes.json               # GeoJSON LineString features keyed by ISO timestamp (route_id)
```

---

## Data Layer

All data is stored as flat files in the `data/` directory — no database required.

- **CSV files** — one per category, read and written server-side via PapaParse. The `lib/csv.ts` helpers are generic: `readCsv<T>(filename)` and `writeCsv<T>(filename, rows)`.
- **routes.json** — GeoJSON features for drawn cardio routes, keyed by ISO timestamp. The `route_id` column in `cardio.csv` links a session to its stored route.
- **Server Actions** (`lib/actions.ts`) — all mutations go through Next.js server actions which call `revalidatePath()` after writing, so the page refreshes automatically without a manual reload.

CSV schemas:

```
daily.csv      → date | weight_kg | steps | sleep_hours | water_ml | notes
strength.csv   → date | exercise | muscle_group | sets | reps | weight_kg | notes
cardio.csv     → date | activity_type | duration_min | distance_km | avg_heart_rate | route_id | notes
nutrition.csv  → date | meal_type | food | calories | protein_g | carbs_g | fat_g | notes
```

---

## Getting Started

**Prerequisites:** Node.js 18+, a Mapbox account (free tier is sufficient)

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/Ghost2117/interactive-health-tracker.git
   cd interactive-health-tracker
   npm install
   ```

2. Create a `.env.local` file in the project root with your Mapbox public token:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiY...
   ```
   Get a free token at [mapbox.com](https://mapbox.com) → Account → Access Tokens.

3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. Build for production:
   ```bash
   npm run build
   npm start
   ```

---

## Key Design Decisions

**Server Components fetch, Client Components interact.** Pages are async server components that fetch data and pass it as props to client components. No browser-side data fetching except for Mapbox geocoding and CSV export downloads.

**Base UI, not Radix UI.** The shadcn components in this project use `@base-ui/react` as the primitive layer. The `asChild` prop does not exist — use the `render` prop pattern instead (e.g. `<Trigger render={<Button />}>`).

**Mapbox components are dynamically imported with `ssr: false`** because `mapbox-gl` uses browser-only WebGL APIs that break during server-side rendering.

**Distance is always stored in km internally.** The `lib/units.ts` helpers convert at display time based on the user's localStorage preference (default: miles).

**Edit pattern.** Each table manages its own `editing` state. A pencil icon sets it; a Dialog renders the existing form pre-filled; the form calls an update server action on submit and `onClose` to dismiss.
