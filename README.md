# Schafkopf Tracker

> [!NOTE]
> This project was created to track Schafkopf games with friends at university and was fully "vibe coded" to try out LLM capabilities. There is no guarantee that any code is good, but it works! 🚀

A React application for tracking Schafkopf game scores and statistics. This project allows you to record game results, view leaderboards, and analyze past game history.

## Features

- **Game Tracking**: Easily record scores for Schafkopf games.
- **Leaderboards**: Track player performance and rankings.
- **Game History**: View a history of past games.
- **Detailed Game Views**: View the ongoing game with scores etc.

## Tech Stack

- **Framework**: React 19 with Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase
- **Routing**: React Router

## Prerequisites

Before you begin, ensure you have met the following requirements:

- **Node.js**: Make sure you have Node.js (and npm) installed.

## Getting Started

Follow these steps to get the project up and running on your local machine.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd schafkopf-tracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials.

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL_SCHAF=your_supabase_url
VITE_SUPABASE_ANON_KEY_SCHAF=your_supabase_anon_key
```

Both are required — `src/lib/supabase.ts` throws at import time if either is
missing, so the app will not boot without them.

### 4. Run the Development Server

```bash
npm run dev
```

Main is automatically deployed via vercel.

### 5. Useful Scripts

```bash
npm run typecheck    # tsc -b, also runs as part of npm run build
npm run lint
npm run test         # vitest, domain logic only
npm run format       # prettier --write .
npm run types:db     # regenerate Supabase types (requires `supabase login`)
```

## Database

The schema lives in the hosted Supabase project. Two things track it in git:

- **`src/shared/supabase/database.types.ts`** — generated, committed. This is the
  authoritative record of the schema's _shape_; its diffs read as a changelog.
  Regenerate with `npm run types:db` after any schema change. If that produces a
  diff you did not expect, the hosted schema drifted.
- **`supabase/migrations/`** — forward DDL changes, one file each.

There is no baseline dump yet: the project was built without migrations, so the
existing tables have no `CREATE TABLE` on record. To capture one (needs an
interactive login, so it has to be done by hand once):

```bash
npx supabase login
npx supabase link --project-ref jzxoesdbgykmqzmllrqc
npx supabase db dump --schema public -f supabase/migrations/00000000000000_baseline.sql
npx supabase migration repair --status applied 00000000000000
```

The `repair` step matters — without it the first `db push` tries to recreate
every table.

## Known Limitations

**There is no authentication, and the database is not access-controlled.** The
Supabase anon key ships in the client bundle, and every RLS policy is
`USING (true)` / `WITH CHECK (true)`. Anyone who has the deployed URL can read,
create, edit and delete every player, game and score.

This is a deliberate tradeoff: the app is a private link shared among about ten
friends, and adding accounts would cost more than it is worth. It stops being
acceptable the moment the URL spreads beyond that group — at which point the fix
is Supabase Auth plus RLS policies keyed to `authenticated`.

The UI also mixes German and English labels, which is untidy but harmless.

## Project Structure

Here's a quick overview of the project's structure:

- **`src/components/`**: Reusable UI components used throughout the application.
- **`src/pages/`**: Main application views:
  - `Home.tsx`: The landing page and game tracking interface.
  - `Leaderboard.tsx`: Displays player rankings.
  - `PastGames.tsx`: Shows a history of recorded games.
  - `GameDetails.tsx`: Detailed view of a specific game.
- **`src/lib/`**: Utility functions and Supabase client configuration.
- **`src/assets/`**: Static assets like images and global styles.

## Contributing

1. I will add you to the repo for contribution.
2. Create a feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request into main.
