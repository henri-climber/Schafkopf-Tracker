import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Header,
  type HeaderGroup,
  type Row,
  type Cell,
} from '@tanstack/react-table'

interface GameTable {
  id: number
  name: string
  created_at: string
  is_open: boolean
  exclude_from_overall: boolean
}

interface Player {
  id: number
  name: string
  created_at: string
}

interface TablePlayer {
  player_id: number
  table_id: number
  player: {
    id: number
    name: string
    created_at: string
  }
}

interface Round {
  id: number
  table_id: number
  round_number: number
  created_at: string
}

interface RoundScore {
  round_id: number
  player_id: number
  raw_score: number
  created_at: string
}

interface PlayerScore {
  rank: number
  playerId: number
  playerName: string
  rounds: { [key: number]: number }
  overall: number
}

interface AvailablePlayer extends Player {
  isSelected?: boolean
}

export function GameDetails() {
  const { id } = useParams<{ id: string }>()
  const [gameTable, setGameTable] = useState<GameTable | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [roundScores, setRoundScores] = useState<RoundScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    loadGameData()
  }, [id])

  async function loadGameData() {
    setLoading(true)
    setError(null)
    try {
      // Load table details
      const { data: tableData, error: tableError } = await supabase
        .from('Tables')
        .select('*')
        .eq('id', id)
        .single()

      if (tableError) throw tableError
      setGameTable(tableData)

      // Load players for this table
      const { data: tablePlayers, error: playersError } = await supabase
        .from('table_players')
        .select(`
          player_id,
          table_id,
          player:Players (
            id,
            name,
            created_at
          )
        `)
        .eq('table_id', id) as { data: TablePlayer[] | null, error: any }

      if (playersError) throw playersError
      setPlayers(tablePlayers?.map(tp => tp.player) || [])

      // Load rounds for this table
      const { data: roundsData, error: roundsError } = await supabase
        .from('Rounds')
        .select('*')
        .eq('table_id', id)
        .order('round_number', { ascending: true })

      if (roundsError) throw roundsError
      setRounds(roundsData || [])

      // Load round scores
      if (roundsData && roundsData.length > 0) {
        const roundIds = roundsData.map(r => r.id)
        const { data: scoresData, error: scoresError } = await supabase
          .from('round_scores')
          .select('*')
          .in('round_id', roundIds)

        if (scoresError) throw scoresError
        setRoundScores(scoresData || [])
      }
    } catch (err) {
      console.error('Error loading game data:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while loading game data')
    } finally {
      setLoading(false)
    }
  }

  const playerScores = useMemo(() => {
    const scores: PlayerScore[] = players.map(player => ({
      rank: 0,
      playerId: player.id,
      playerName: player.name,
      rounds: {},
      overall: 0
    }))

    // Fill in round scores
    rounds.forEach(round => {
      const roundId = round.id
      scores.forEach(playerScore => {
        const score = roundScores.find(
          rs => rs.round_id === roundId && rs.player_id === playerScore.playerId
        )
        playerScore.rounds[round.round_number] = score?.raw_score || 0
      })
    })

    // Calculate overall scores and sort
    scores.forEach(playerScore => {
      playerScore.overall = Object.values(playerScore.rounds).reduce((a, b) => a + b, 0)
    })
    
    scores.sort((a, b) => b.overall - a.overall)
    
    // Assign ranks
    scores.forEach((score, index) => {
      score.rank = index + 1
    })

    return scores
  }, [players, rounds, roundScores])

  const columnHelper = createColumnHelper<PlayerScore>()

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor('rank', {
        header: 'Rank',
        cell: info => info.getValue(),
        size: 70,
      }),
      columnHelper.accessor('playerName', {
        header: 'Player',
        cell: info => info.getValue(),
        size: 150,
      }),
    ]

    const roundColumns = rounds.map(round =>
      columnHelper.accessor(row => row.rounds[round.round_number], {
        id: `round_${round.round_number}`,
        header: `Round ${round.round_number}`,
        cell: info => (
          <input
            type="number"
            value={info.getValue() || 0}
            onChange={e => handleScoreUpdate(
              round.id,
              info.row.original.playerId,
              parseInt(e.target.value) || 0
            )}
            className="w-full bg-transparent text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ),
        size: 100,
      })
    )

    const overallColumn = [
      columnHelper.accessor('overall', {
        header: 'Overall',
        cell: info => info.getValue(),
        size: 100,
      }),
    ]

    return [...baseColumns, ...roundColumns, ...overallColumn]
  }, [rounds])

  const reactTable = useReactTable({
    data: playerScores,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  async function handleScoreUpdate(roundId: number, playerId: number, newScore: number) {
    try {
      const { error } = await supabase
        .from('round_scores')
        .upsert({
          round_id: roundId,
          player_id: playerId,
          raw_score: newScore
        })

      if (error) throw error

      // Update local state
      setRoundScores(prev => {
        const newScores = [...prev]
        const index = newScores.findIndex(
          rs => rs.round_id === roundId && rs.player_id === playerId
        )
        if (index >= 0) {
          newScores[index] = { ...newScores[index], raw_score: newScore }
        } else {
          newScores.push({
            round_id: roundId,
            player_id: playerId,
            raw_score: newScore,
            created_at: new Date().toISOString()
          })
        }
        return newScores
      })
    } catch (error) {
      console.error('Error updating score:', error)
    }
  }

  async function handleAddRound() {
    try {
      // Create new round
      const newRoundNumber = rounds.length + 1
      const { data: newRound, error: roundError } = await supabase
        .from('Rounds')
        .insert([{
          table_id: id,
          round_number: newRoundNumber
        }])
        .select()
        .single()

      if (roundError) throw roundError

      // Initialize scores for all players
      const initialScores = players.map(player => ({
        round_id: newRound.id,
        player_id: player.id,
        raw_score: 0
      }))

      const { error: scoresError } = await supabase
        .from('round_scores')
        .insert(initialScores)

      if (scoresError) throw scoresError

      // Update local state
      setRounds(prev => [...prev, newRound])
      setRoundScores(prev => [...prev, ...initialScores.map(score => ({
        ...score,
        created_at: new Date().toISOString()
      }))])
    } catch (error) {
      console.error('Error adding round:', error)
    }
  }

  async function searchPlayers(search: string) {
    setSearchLoading(true)
    try {
      const { data, error } = await supabase
        .from('Players')
        .select('*')
        .ilike('name', `%${search}%`)
        .order('name')

      if (error) throw error

      // Filter out players already in the game
      const filteredPlayers = (data || []).filter(
        p => !players.some(existing => existing.id === p.id)
      )
      setAvailablePlayers(filteredPlayers)
    } catch (error) {
      console.error('Error searching players:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleAddPlayerToGame(playerId: number) {
    try {
      // Add player to table_players
      const { error: addError } = await supabase
        .from('table_players')
        .insert([{
          table_id: id,
          player_id: playerId
        }])

      if (addError) throw addError

      // Add initial scores for all existing rounds
      const initialScores = rounds.map(round => ({
        round_id: round.id,
        player_id: playerId,
        raw_score: 0
      }))

      if (initialScores.length > 0) {
        const { error: scoresError } = await supabase
          .from('round_scores')
          .insert(initialScores)

        if (scoresError) throw scoresError
      }

      // Reload game data to update everything
      await loadGameData()
      setIsAddingPlayer(false)
      setSearchTerm('')
    } catch (error) {
      console.error('Error adding player to game:', error)
    }
  }

  async function handleToggleGameStatus() {
    try {
      const newStatus = !gameTable?.is_open
      const { error } = await supabase
        .from('Tables')
        .update({ is_open: newStatus })
        .eq('id', id)

      if (error) throw error
      
      setGameTable(prev => prev ? { ...prev, is_open: newStatus } : null)
    } catch (error) {
      console.error('Error updating game status:', error)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!gameTable) return <div>Table not found</div>

  return (
    <div className="flex flex-col h-screen bg-white text-black">
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="text-2xl font-bold">{gameTable.name}</h1>
        <button
          onClick={handleAddRound}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Round
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-100">
              {reactTable.getHeaderGroups().map((headerGroup: HeaderGroup<PlayerScore>) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header: Header<PlayerScore, unknown>) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="p-3 text-left font-semibold border-b sticky top-0 bg-gray-100"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {reactTable.getRowModel().rows.map((row: Row<PlayerScore>) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell: Cell<PlayerScore, unknown>) => (
                    <td
                      key={cell.id}
                      className="p-3 border-b"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="p-3 border-b">
                  <button
                    onClick={() => {
                      setIsAddingPlayer(true)
                      searchPlayers('')
                    }}
                    className="text-sm flex items-center justify-center gap-1 p-1 text-gray-600 hover:text-gray-800"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Player
                  </button>
                </td>
                <td colSpan={rounds.length + 1} className="border-b"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Game Status Toggle */}
      <div className="border-t p-4">
        <label className="flex items-center justify-center cursor-pointer gap-3">
          <span className="text-sm font-medium text-gray-600">
            {gameTable.is_open ? 'Ongoing Game' : 'Game Finished'}
          </span>
          <div className="relative">
            <input
              type="checkbox"
              checked={gameTable.is_open}
              onChange={handleToggleGameStatus}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
          </div>
        </label>
      </div>

      {/* Add Player Dialog */}
      {isAddingPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Player to Game</h2>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  searchPlayers(e.target.value)
                }}
                placeholder="Search players..."
                className="w-full px-3 py-2 border rounded-lg mb-4"
                autoFocus
              />
              {searchLoading && (
                <div className="absolute right-3 top-2">
                  Loading...
                </div>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto">
              {availablePlayers.length === 0 ? (
                <div className="text-gray-500 text-center py-4">
                  {searchTerm ? 'No players found' : 'Start typing to search players'}
                </div>
              ) : (
                <div className="space-y-2">
                  {availablePlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleAddPlayerToGame(player.id)}
                      className="w-full text-left p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      {player.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAddingPlayer(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Add Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 