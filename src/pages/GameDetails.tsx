import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import './GameDetails.css';

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
          <div className="round-number-cell">
            <span className={`round-number-text ${isInvalid ? 'round-number-invalid' : ''}`}>
              {info.getValue()}
            </span>
            {isInvalid && (
              <span title={`Sum is ${sum} (should be 0)`} className="round-error-icon">
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
          <div className="player-header">
            <span className="player-name">{player.name}</span>
            <span className={`player-total-badge ${playerTotals[player.id] > 0 ? 'total-positive' :
              playerTotals[player.id] < 0 ? 'total-negative' :
                'total-neutral'
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
              className="score-cell"
              onClick={() => setEditingCell({ roundId: info.row.original.roundId, playerId: player.id })}
            >
              {isEditing ? (
                <input
                  type="number"
                  defaultValue={score === 0 ? '' : score}
                  className="score-input"
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
                <span className={`score-display ${score > 0 ? 'score-positive' :
                  score < 0 ? 'score-negative' :
                    'score-zero'
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
    <div className="game-details-container">
      {/* Navbar / Header */}
      <div className="game-navbar">
        <div className="nav-left">
          <button
            onClick={() => navigate('/')}
            className="nav-back-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="nav-title-group">
            <h1 className="game-title">{gameTable?.name}</h1>
            <p className="game-subtitle">
              {new Date(gameTable?.created_at || '').toLocaleDateString()} • {rounds.length} Rounds
            </p>
          </div>
        </div>

        <div className="nav-right">
          <button
            onClick={handleToggleIsOpen}
            className={`status-button ${gameTable?.is_open
              ? 'status-button-open'
              : 'status-button-closed'
              }`}
          >
            {gameTable?.is_open ? 'Open' : 'Closed'}
          </button>

          <button
            onClick={handleToggleExcludeFromOverall}
            className={`status-button ${gameTable?.exclude_from_overall
              ? 'status-button-excluded'
              : 'status-button-included'
              }`}
          >
            {gameTable?.exclude_from_overall ? 'Excluded' : 'Included'}
          </button>

          <button
            onClick={() => {
              setIsAddingPlayer(true);
              searchPlayers('');
            }}
            className="btn-add-player-nav"
          >
            Add Player
          </button>

          {gameTable?.is_open && (
            <button
              onClick={handleAddRound}
              className="btn-add-round"
            >
              <span className="text-xl leading-none">+</span> Round
            </button>
          )}
        </div>
      </div>

      {/* Main Score Sheet */}
      <div className="main-score-sheet">
        <div className="score-table-container">
          <div className="score-table-wrapper">
            <table className="score-table">
              <thead className="table-header">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} className="table-th">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="table-body">
                {table.getRowModel().rows.map(row => {
                  const sum = Object.values(row.original.scores).reduce((a, b) => a + b, 0);
                  const isInvalid = sum !== 0;
                  return (
                    <tr key={row.id} className={`table-row ${isInvalid ? 'table-row-invalid' : ''}`}>
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="table-td">
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
            <div className="empty-state">
              <p>No rounds played yet.</p>
              <button
                onClick={handleAddRound}
                className="empty-state-btn"
              >
                Start the game
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Player Modal */}
      {isAddingPlayer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Add Player</h2>
            <input
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                searchPlayers(e.target.value);
              }}
              placeholder="Search player name..."
              className="modal-search-input"
              autoFocus
            />
            {searchLoading ? (
              <p className="modal-loading">Loading...</p>
            ) : (
              <div className="modal-list-container">
                {availablePlayers.length === 0 && searchTerm && (
                  <p className="modal-empty-search">No players found</p>
                )}
                {availablePlayers.map(player => (
                  <button
                    key={player.id}
                    onClick={() => handleAddPlayerToGame(player.id)}
                    className="modal-player-btn"
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            )}
            <div className="modal-footer">
              <button
                onClick={() => setIsAddingPlayer(false)}
                className="modal-cancel-btn"
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