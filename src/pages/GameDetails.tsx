import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

interface GameTable {
  id: number;
  name: string;
  created_at: string;
  is_open: boolean;
  exclude_from_overall: boolean;
}

interface Player {
  id: number;
  name: string;
  created_at: string;
}

interface TablePlayer {
  player_id: number;
  table_id: number;
  player: Player;
}

interface Round {
  id: number;
  table_id: number;
  round_number: number;
  created_at: string;
}

interface RoundScore {
  round_id: number;
  player_id: number;
  raw_score: number;
  created_at: string;
}

interface AvailablePlayer extends Player {
  isSelected?: boolean;
}

// Data shape for the table row
interface RoundRow {
  roundNumber: number;
  roundId: number;
  scores: { [playerId: number]: number };
}

export function GameDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gameTable, setGameTable] = useState<GameTable | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundScores, setRoundScores] = useState<RoundScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI States
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ roundId: number; playerId: number } | null>(null);

  // Scroll to bottom ref
  const bottomRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (!id) return;
    loadGameData();
  }, [id]);

  // Scroll to bottom when rounds change
  useEffect(() => {
    if (rounds.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [rounds.length]);

  const loadGameData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load table details
      const { data: tableData, error: tableError } = await supabase
        .from('Tables')
        .select('*')
        .eq('id', id)
        .single();

      if (tableError) throw tableError;
      setGameTable(tableData);

      // 2. Load players
      const { data: tablePlayers, error: playersError } = await supabase
        .from('table_players')
        .select(`
          player_id,
          table_id,
          player:Players (id, name, created_at)
        `)
        .eq('table_id', id) as { data: TablePlayer[] | null, error: any };

      if (playersError) throw playersError;

      // Sort players by name or ID to keep consistent order
      const sortedPlayers = (tablePlayers?.map(tp => tp.player) || []).sort((a, b) => a.id - b.id);
      setPlayers(sortedPlayers);

      // 3. Load rounds
      const { data: roundsData, error: roundsError } = await supabase
        .from('Rounds')
        .select('*')
        .eq('table_id', id)
        .order('round_number', { ascending: true });

      if (roundsError) throw roundsError;
      setRounds(roundsData || []);

      // 4. Load scores
      if (roundsData && roundsData.length > 0) {
        const roundIds = roundsData.map(r => r.id);
        const { data: scoresData, error: scoresError } = await supabase
          .from('round_scores')
          .select('*')
          .in('round_id', roundIds);

        if (scoresError) throw scoresError;
        setRoundScores(scoresData || []);
      }
    } catch (err) {
      console.error('Error loading game data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Transform data for the table
  const tableData = useMemo(() => {
    return rounds.map(round => {
      const row: RoundRow = {
        roundNumber: round.round_number,
        roundId: round.id,
        scores: {}
      };

      roundScores
        .filter(rs => rs.round_id === round.id)
        .forEach(rs => {
          row.scores[rs.player_id] = rs.raw_score;
        });

      return row;
    });
  }, [rounds, roundScores]);

  // Calculate totals
  const playerTotals = useMemo(() => {
    const totals: { [key: number]: number } = {};
    players.forEach(p => totals[p.id] = 0);

    roundScores.forEach(rs => {
      if (totals[rs.player_id] !== undefined) {
        totals[rs.player_id] += rs.raw_score;
      }
    });
    return totals;
  }, [players, roundScores]);

  // Columns definition
  const columnHelper = createColumnHelper<RoundRow>();

  const columns = useMemo(() => {
    const roundNumberColumn = columnHelper.accessor('roundNumber', {
      header: '#',
      cell: info => {
        const sum = Object.values(info.row.original.scores).reduce((a, b) => a + b, 0);
        const isInvalid = sum !== 0;
        return (
          <div className="flex items-center justify-center gap-1">
            <span className={`text-sm font-mono ${isInvalid ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
              {info.getValue()}
            </span>
            {isInvalid && (
              <span title={`Sum is ${sum} (should be 0)`} className="text-red-500 text-xs cursor-help font-bold">
                !
              </span>
            )}
          </div>
        );
      },
      size: 50,
    });

    const playerColumns = players.map(player =>
      columnHelper.accessor(row => row.scores[player.id], {
        id: `player_${player.id}`,
        header: () => (
          <div className="flex flex-col items-center py-2">
            <span className="font-bold text-gray-800">{player.name}</span>
            <span className={`text-sm mt-1 font-mono font-medium px-2 py-0.5 rounded ${playerTotals[player.id] > 0 ? 'bg-green-100 text-green-700' :
              playerTotals[player.id] < 0 ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>
              {playerTotals[player.id] > 0 ? '+' : ''}{playerTotals[player.id]}
            </span>
          </div>
        ),
        cell: info => {
          const score = info.getValue() ?? 0;
          const isEditing = editingCell?.roundId === info.row.original.roundId &&
            editingCell?.playerId === player.id;

          return (
            <div
              className="h-full w-full flex items-center justify-center p-1"
              onClick={() => setEditingCell({ roundId: info.row.original.roundId, playerId: player.id })}
            >
              {isEditing ? (
                <input
                  type="number"
                  defaultValue={score === 0 ? '' : score}
                  className="w-16 text-center bg-white border-2 border-blue-500 rounded px-1 py-1 text-lg font-mono focus:outline-none shadow-lg z-10"
                  autoFocus
                  onBlur={(e) => {
                    const val = calculateScoreInput(e.target.value);
                    handleScoreUpdate(info.row.original.roundId, player.id, val);
                    setEditingCell(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = calculateScoreInput((e.target as HTMLInputElement).value);
                      handleScoreUpdate(info.row.original.roundId, player.id, val);
                      setEditingCell(null);
                    }
                  }}
                />
              ) : (
                <span className={`text-lg font-mono font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-50 px-3 py-1 rounded transition-colors ${score > 0 ? 'text-green-600' :
                  score < 0 ? 'text-red-600' :
                    'text-gray-300'
                  }`}>
                  {score === 0 ? '-' : score > 0 ? `+${score}` : score}
                </span>
              )}
            </div>
          );
        },
      })
    );

    return [roundNumberColumn, ...playerColumns];
  }, [players, playerTotals, editingCell, columnHelper]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const calculateScoreInput = (val: string): number => {
    if (!val) return 0;
    return parseInt(val) || 0;
  };

  const handleScoreUpdate = async (roundId: number, playerId: number, newScore: number) => {
    // Optimistic update could go here

    const { error } = await supabase
      .from('round_scores')
      .upsert({
        round_id: roundId,
        player_id: playerId,
        raw_score: newScore,
      });

    if (error) {
      console.error('Error updating score:', error);
      return;
    }

    // Refresh data (lightweight)
    const { data } = await supabase
      .from('round_scores')
      .select('*')
      .in('round_id', rounds.map(r => r.id));

    if (data) setRoundScores(data);
  };

  const handleAddRound = async () => {
    const newRoundNumber = rounds.length + 1;
    const { data: newRound, error } = await supabase
      .from('Rounds')
      .insert([{ table_id: id, round_number: newRoundNumber }])
      .select()
      .single();

    if (error) {
      console.error('Error adding round:', error);
      return;
    }

    // Initialize 0 scores
    const initialScores = players.map(p => ({
      round_id: newRound.id,
      player_id: p.id,
      raw_score: 0
    }));

    await supabase.from('round_scores').insert(initialScores);

    setRounds(prev => [...prev, newRound]);
    setRoundScores(prev => [...prev, ...initialScores.map(s => ({ ...s, created_at: new Date().toISOString() }))]);
  };

  const handleToggleIsOpen = async () => {
    if (!gameTable) return;
    const newValue = !gameTable.is_open;
    const { error } = await supabase
      .from('Tables')
      .update({ is_open: newValue })
      .eq('id', id);

    if (error) {
      console.error('Error toggling is_open:', error);
      return;
    }

    setGameTable(prev => prev ? { ...prev, is_open: newValue } : null);
  };

  const handleToggleExcludeFromOverall = async () => {
    if (!gameTable) return;
    const newValue = !gameTable.exclude_from_overall;
    const { error } = await supabase
      .from('Tables')
      .update({ exclude_from_overall: newValue })
      .eq('id', id);

    if (error) {
      console.error('Error toggling exclude_from_overall:', error);
      return;
    }

    setGameTable(prev => prev ? { ...prev, exclude_from_overall: newValue } : null);
  };

  const handleAddPlayerToGame = async (playerId: number) => {
    try {
      await supabase.from('table_players').insert([{ table_id: id, player_id: playerId }]);

      const scores = rounds.map(r => ({
        round_id: r.id,
        player_id: playerId,
        raw_score: 0,
      }));

      if (scores.length) {
        await supabase.from('round_scores').insert(scores);
      }

      await loadGameData();
      setIsAddingPlayer(false);
      setSearchTerm('');
    } catch (err) {
      console.error('Failed to add player:', err);
    }
  };

  const searchPlayers = async (search: string) => {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase.from('Players').select('*').ilike('name', `%${search}%`);
      if (error) throw error;
      setAvailablePlayers((data || []).filter(p => !players.find(x => x.id === p.id)));
    } catch (e) {
      console.error('Error searching players:', e);
    } finally {
      setSearchLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500">
      Error: {error}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      {/* Navbar / Header */}
      <div className="bg-white border-b sticky top-0 z-20 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="font-bold text-lg leading-tight">{gameTable?.name}</h1>
            <p className="text-xs text-gray-500">
              {new Date(gameTable?.created_at || '').toLocaleDateString()} • {rounds.length} Rounds
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleToggleIsOpen}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${gameTable?.is_open
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
          >
            {gameTable?.is_open ? 'Open' : 'Closed'}
          </button>

          <button
            onClick={handleToggleExcludeFromOverall}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${gameTable?.exclude_from_overall
              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {gameTable?.exclude_from_overall ? 'Excluded' : 'Included'}
          </button>

          <button
            onClick={() => {
              setIsAddingPlayer(true);
              searchPlayers('');
            }}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-gray-50 transition-colors"
          >
            Add Player
          </button>

          {gameTable?.is_open && (
            <button
              onClick={handleAddRound}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span className="text-xl leading-none">+</span> Round
            </button>
          )}
        </div>
      </div>

      {/* Main Score Sheet */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-100">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} className="p-2 min-w-[100px] first:min-w-[50px] first:w-[50px]">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.getRowModel().rows.map(row => {
                  const sum = Object.values(row.original.scores).reduce((a, b) => a + b, 0);
                  const isInvalid = sum !== 0;
                  return (
                    <tr key={row.id} className={`transition-colors ${isInvalid ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="p-0 border-r border-gray-50 last:border-0 text-center h-12">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* Scroll Anchor */}
                <tr ref={bottomRef}></tr>
              </tbody>
            </table>
          </div>

          {rounds.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No rounds played yet.</p>
              <button
                onClick={handleAddRound}
                className="mt-4 text-blue-600 hover:underline"
              >
                Start the game
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Player Modal */}
      {isAddingPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">Add Player</h2>
            <input
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                searchPlayers(e.target.value);
              }}
              placeholder="Search player name..."
              className="border w-full px-3 py-2 rounded mb-3"
              autoFocus
            />
            {searchLoading ? (
              <p className="text-gray-500 text-center py-4">Loading...</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {availablePlayers.length === 0 && searchTerm && (
                  <p className="text-gray-500 text-center py-2">No players found</p>
                )}
                {availablePlayers.map(player => (
                  <button
                    key={player.id}
                    onClick={() => handleAddPlayerToGame(player.id)}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsAddingPlayer(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}