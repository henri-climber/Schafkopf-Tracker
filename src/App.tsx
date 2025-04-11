import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { GameDetails } from './pages/GameDetails'
import { Leaderboard } from './pages/Leaderboard'
import { PastGames } from './pages/PastGames'

function App() {
  return (
    <Router>
      <div className="min-h-screen w-full bg-white">
        <div className="container mx-auto px-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game-details/:id" element={<GameDetails />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/past-games" element={<PastGames />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
