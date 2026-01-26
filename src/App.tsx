import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { GameDetails } from './pages/GameDetails'
import { Leaderboard } from './pages/Leaderboard'
import { PastGames } from './pages/PastGames'
import './App.css'
import ScrollToTop from './components/ScrollToTop'

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="app-container">
        <div className="main-content">
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
