import { BrowserRouter as Router, Routes, Route } from 'react-router'
import { HomeRoute } from '@/app/HomeRoute'
import { GameDetailsPage } from '@/features/schafkopf/ui/GameDetailsPage'
import { LeaderboardPage } from '@/features/schafkopf/ui/LeaderboardPage'
import { PastGamesPage } from '@/features/schafkopf/ui/PastGamesPage'
import { TTMatchPage } from '@/features/tabletennis/ui/TTMatchPage'
import { TTLeaderboardPage } from '@/features/tabletennis/ui/TTLeaderboardPage'
import { TTPastMatchesPage } from '@/features/tabletennis/ui/TTPastMatchesPage'
import { Providers } from '@/app/Providers'
import '@/shared/styles/app.css'
import ScrollToTop from '@/shared/ui/ScrollToTop'

function App() {
  return (
    <Providers>
      <Router>
        <ScrollToTop />
        <div className="app-container">
          <div className="main-content">
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/game-details/:id" element={<GameDetailsPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/past-games" element={<PastGamesPage />} />
              <Route path="/tt/match/:id" element={<TTMatchPage />} />
              <Route path="/tt/leaderboard" element={<TTLeaderboardPage />} />
              <Route path="/tt/past-matches" element={<TTPastMatchesPage />} />
            </Routes>
          </div>
        </div>
      </Router>
    </Providers>
  )
}

export default App
