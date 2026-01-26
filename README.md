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

Create a `.env` file in the root directory of the project and add your Supabase credentials.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run the Development Server

```bash
npm run dev
```


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
