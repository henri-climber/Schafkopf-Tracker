import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
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

interface PlayerScore {
  rank: number;
  playerId: number;
  playerName: string;
  rounds: { [key: number]: number };
  overall: number;
}

interface AvailablePlayer extends Player {
  isSelected?: boolean;
}

export function GameDetails() {
  const { id } = useParams<{ id: string }>();
  const [gameTable, setGameTable] = useState<GameTable | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundScores, setRoundScores] = useState<RoundScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ roundId: number; playerId: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    loadGameData();
  }, [id]);

  const loadGameData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load table details
      const { data: tableData, error: tableError } = await supabase
        .from('Tables')
        .select('*')
        .eq('id', id)
        .single();

      if (tableError) throw tableError;
      setGameTable(tableData);

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
        .eq('table_id', id) as { data: TablePlayer[] | null, error: any };

      if (playersError) throw playersError;
      setPlayers(tablePlayers?.map(tp => tp.player) || []);

      // Load rounds for this table
      const { data: roundsData, error: roundsError } = await supabase
        .from('Rounds')
        .select('*')
        .eq('table_id', id)
        .order('round_number', { ascending: true });

      if (roundsError) throw roundsError;
      setRounds(roundsData || []);

      // Load round scores
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
      setError(err instanceof Error ? err.message : 'An error occurred while loading game data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const playerScores = useMemo(() => {
    const scores: PlayerScore[] = players.map(player => ({
      rank: 0,
      playerId: player.id,
      playerName: player.name,
      rounds: {},
      overall: 0,
    }));

    // Fill in round scores
    rounds.forEach(round => {
      const roundId = round.id;
      scores.forEach(playerScore => {
        const score = roundScores.find(
          rs => rs.round_id === roundId && rs.player_id === playerScore.playerId
        );
        playerScore.rounds[round.round_number] = score?.raw_score || 0;
      });
    });

    // Calculate overall scores
    scores.forEach(playerScore => {
      playerScore.overall = Object.values(playerScore.rounds).reduce((a, b) => a + b, 0);
    });

    return scores;
  }, [players, rounds, roundScores]);

  const sortedPlayerScores = useMemo(() => {
    const sorted = [...playerScores].sort((a, b) => b.overall - a.overall);
    sorted.forEach((score, index) => {
      score.rank = index + 1;
    });
    return sorted;
  }, [playerScores]);

  const columnHelper = createColumnHelper<PlayerScore>();

  const columns = useMemo(()=> {
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
    ];

    const roundColumns = rounds.map(round => {
      console.log('rendering round', round.round_number);
      const roundSum = roundScores
        .filter(score => score.round_id === round.id)
        .reduce((sum, score) => sum + score.raw_score, 0);
      console.log('roundSum', roundSum);
      const isInvalid = roundSum !== 0;
    
      return columnHelper.accessor(row => row.rounds[round.round_number], {
        id: `round_${round.round_number}`,
        header: () => (
          <div className={isInvalid ? 'text-red-600 font-semibold' : ''}>
            Round {round.round_number}
          </div>
        ),
        cell: info => {
          const roundId = round.id;
          const playerId = info.row.original.playerId;
          const isEditing = editingCell?.roundId === roundId && editingCell?.playerId === playerId;
          const cellClass = isInvalid ? 'bg-red-100' : '';
    
          return isEditing ? (
            <input
              type="number"
              defaultValue={info.getValue()}
              onBlur={async (e) => {
                const value = parseInt(e.target.value) || 0;
                await handleScoreUpdate(roundId, playerId, value);
                setEditingCell(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  const value = parseInt((e.target as HTMLInputElement).value) || 0;
                  handleScoreUpdate(roundId, playerId, value);
                  setEditingCell(null);
                }
              }}
              className={`w-full text-center border border-gray-300 rounded px-1 py-0.5 ${cellClass}`}
              autoFocus
            />
          ) : (
            <div
              onClick={() => setEditingCell({ roundId, playerId })}
              className={`text-center cursor-pointer hover:bg-gray-100 rounded px-1 ${cellClass}`}
            >
              {info.getValue()}
            </div>
          );
        },
        size: 100,
      });
    });

    const overallColumn = [
      columnHelper.accessor('overall', {
        header: 'Overall',
        cell: info => info.getValue(),
        size: 100,
      }),
    ];

    return [...baseColumns, ...roundColumns, ...overallColumn];
  }, [rounds, editingCell]);

  const table = useReactTable({
    data: sortedPlayerScores,
    columns,
    getCoreRowModel: getCoreRowModel(),
    debugTable: false,
  });

  const handleScoreUpdate = (roundId: number, playerId: number, newScore: number) => {
    return supabase
      .from('round_scores')
      .upsert({
        round_id: roundId,
        player_id: playerId,
        raw_score: newScore,
      })
      .then(({ error }) => {
        if (error) throw error;
  
        setRoundScores(prev => {
          const updated = [...prev];
          const index = updated.findIndex(
            rs => rs.round_id === roundId && rs.player_id === playerId
          );
          if (index >= 0) {
            updated[index] = { ...updated[index], raw_score: newScore };
          } else {
            updated.push({
              round_id: roundId,
              player_id: playerId,
              raw_score: newScore,
              created_at: new Date().toISOString(),
            });
          }
          return updated;
        });
      });
  };

  const handleAddRound = async () => {
    const newRoundNumber = rounds.length + 1;
    const { data: newRound, error } = await supabase.from('Rounds').insert([{
      table_id: id,
      round_number: newRoundNumber,
    }]).select().single();

    if (error) return console.error('Error adding round:', error);

    const initialScores = players.map(p => ({
      round_id: newRound.id,
      player_id: p.id,
      raw_score: 0,
    }));

    const { error: scoreError } = await supabase.from('round_scores').insert(initialScores);
    if (scoreError) return console.error('Error initializing scores:', scoreError);

    setRounds(prev => [...prev, newRound]);
    setRoundScores(prev => [...prev, ...initialScores.map(s => ({ ...s, created_at: new Date().toISOString() }))]);
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

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (error) return <div className="p-4 text-red-600 text-center">{error}</div>;

  return (
    <div className="p-4 bg-white text-black">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{gameTable?.name}</h1>
        <button onClick={handleAddRound} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
          Add Round
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border border-collapse border-gray-300">
          <thead className="bg-gray-100">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="border px-3 py-2 text-left">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="border px-3 py-1">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td colSpan={2}>
                <button onClick={() => {
                  setIsAddingPlayer(true);
                  searchPlayers('');
                }} className="text-blue-600 text-sm hover:underline px-2 py-1">
                  + Add Player
                </button>
              </td>
              <td colSpan={rounds.length + 1}></td>
            </tr>
          </tbody>
        </table>
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
            />
            {searchLoading ? (
              <p>Loading...</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
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
            <button onClick={() => setIsAddingPlayer(false)} className="mt-4 text-gray-600 hover:text-gray-800">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}