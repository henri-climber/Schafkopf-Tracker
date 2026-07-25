import { BrowserRouter as Router, Routes, Route } from 'react-router'
import { Home } from './pages/Home'
import { GameDetails } from './pages/GameDetails'
import { Leaderboard } from './pages/Leaderboard'
import { PastGames } from './pages/PastGames'
import { TTMatchDetails } from './pages/tt/TTMatchDetails'
import { TTLeaderboard } from './pages/tt/TTLeaderboard'
import { TTPastMatches } from './pages/tt/TTPastMatches'
import { SportModeProvider } from './context/SportModeContext'
import './App.css'
import ScrollToTop from './components/ScrollToTop'

function App() {
  return (
    <SportModeProvider>
      <Router>
        <ScrollToTop />
        <div className="app-container">
          <div className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game-details/:id" element={<GameDetails />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/past-games" element={<PastGames />} />
              <Route path="/tt/match/:id" element={<TTMatchDetails />} />
              <Route path="/tt/leaderboard" element={<TTLeaderboard />} />
              <Route path="/tt/past-matches" element={<TTPastMatches />} />
            </Routes>
          </div>
        </div>
      </Router>
    </SportModeProvider>
  )
}

export default App
