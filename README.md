# Belegarth Practice Manager

A practice-night management app for Belegarth (or any foam combat / battle game) clubs. Track who shows up each week, manage your roster, maintain a library of battle game types, randomly select tonight's battle, and get auto-balanced teams in one click. Built on **Supabase** (Postgres + auth) and deployable to **Cloudflare Pages**.

## Features

- **Weekly sign-ins** — one-tap check-in for everyone present
- **Roster management** — players, field/character names, weapon styles, skill ratings (1–10)
- **Battle library** — pre-load battle game types (Open Field, Bridge, CTF, etc.); 10 are seeded for you
- **Random battle selector** — pulls from the games you've flagged as "in pool"
- **Auto-balanced team assignment** — snake draft using skill rating + K/D + win rate
- **Battle history** — record per-player kills/deaths, declare winners
- **Aggregated stats** — leaderboards by K/D, kills, wins, win %, attendance

## Tech stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Supabase (Postgres, REST API, optional auth)
- **Hosting**: Cloudflare Pages (free)

## Quickstart

### 1. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In the dashboard, open **SQL Editor** → **New query**.
3. Paste the contents of `supabase/schema.sql` and run it. This creates all tables, the stats view, RLS policies, and seeds 10 common battle game types.
4. Open **Project Settings** → **API**. You'll need:
   - `Project URL`
   - `anon` `public` key (NOT the service role key)

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Add a few players in the **Roster** tab, then head to **Tonight** and start signing people in.

### 4. Deploy to Cloudflare Pages

#### Option A: Git-connected (recommended)

1. Push this folder to a GitHub repo.
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Pick the repo. Build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Under **Environment variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Deploy. You'll get a `*.pages.dev` URL; you can attach a custom domain later.

#### Option B: Wrangler CLI direct upload

```bash
npx wrangler login
npm run build
npx wrangler pages deploy dist --project-name=belegarth-practice
```

(Set the env vars in the Cloudflare dashboard under your project's **Settings** → **Environment variables**.)

## How team balancing works

The snake-draft algorithm sorts present players by composite score:

```
score = skill_rating × 10 + min(kd_ratio, 5) × 4 + win_pct / 10
```

Players are then distributed across N teams in a serpentine pattern (1, 2, 2, 1, 1, 2, ...) so the strongest and weakest end up balanced. After assignment, members within each team are shuffled for visual variety. Tweak `src/lib/teamBalancer.js` if you want a different formula.

## Adapting / extending

- **Add auth**: Supabase has email/password and OAuth out of the box. Wrap routes with a sign-in gate and tighten the RLS policies in `schema.sql` (replace `USING (true)` with `USING (auth.role() = 'authenticated')`).
- **Add roles** (admin vs marshal vs player): add a `role` column to a `profiles` table linked to `auth.users`, and check it in RLS.
- **Real-time**: Supabase channels are already supported by the JS client. Wrap any list in a `supabase.channel(...).on('postgres_changes', ...)` subscription if you want live updates during practice.
- **Custom themes**: edit `tailwind.config.js` (the palette is `forest`, `blood`, `parchment`).

## File map

```
belegarth-app/
├── README.md                      ← you are here
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .env.example
├── supabase/
│   └── schema.sql                 ← run this once in Supabase
└── src/
    ├── main.jsx
    ├── App.jsx                    ← top-level layout + tab nav
    ├── index.css
    ├── lib/
    │   ├── supabase.js            ← Supabase client
    │   └── teamBalancer.js        ← snake-draft + random battle picker
    └── components/
        ├── Dashboard.jsx          ← Tonight: sign-ins, random battle, teams
        ├── Players.jsx            ← Roster CRUD
        ├── BattleLibrary.jsx      ← Battle game types CRUD
        ├── Stats.jsx              ← Leaderboards
        └── History.jsx            ← Past battles, K/D editing
```

## License

Use it however you want. For the realm. ⚔
