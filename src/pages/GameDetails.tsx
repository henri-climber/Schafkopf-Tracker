import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameSubscription } from '../hooks/useGameSubscription';
import { supabase } from '../lib/supabase';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { LockOpenIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import './GameDetails.css';

// ── Interfaces ──────────────────────────────────────────────────────────────

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

interface RoundRow {
  roundNumber: number;
  roundId: number;
  scores: { [playerId: number]: number };
}

interface ScoreCellProps {
  score: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: number) => void;
  onTabNext?: () => void;
  onTabPrev?: () => void;
}

// ── Module-level helpers ─────────────────────────────────────────────────────

const columnHelper = createColumnHelper<RoundRow>();

function parseScore(val: string): number {
  if (!val) return 0;
  return parseInt(val, 10) || 0;
}

// ── ScoreCell component ──────────────────────────────────────────────────────

function ScoreCell({ score, isEditing, onStartEdit, onSave, onTabNext, onTabPrev }: ScoreCellProps) {
  const isTabNavigating = useRef(false);

  if (isEditing) {
    return (
      <div className="score-cell">
        <input
          type="number"
          defaultValue={score === 0 ? '' : score}
          className="score-input"
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={(e) => {
            if (isTabNavigating.current) {
              isTabNavigating.current = false;
              return;
            }
            onSave(parseScore(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(parseScore((e.target as HTMLInputElement).value));
            } else if (e.key === 'Tab' && (onTabNext || onTabPrev)) {
              e.preventDefault();
              onSave(parseScore((e.target as HTMLInputElement).value));
              isTabNavigating.current = true;
              if (e.shiftKey) onTabPrev?.();
              else onTabNext?.();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="score-cell"
      onClick={onStartEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStartEdit(); } }}
    >
      <span className={`score-display ${
        score > 0 ? 'score-positive' :
        score < 0 ? 'score-negative' :
        'score-zero'
      }`}>
        {score === 0 ? '-' : score > 0 ? `+${score}` : score}
      </span>
    </div>
  );
}

// ── GameDetails component ────────────────────────────────────────────────────

export function GameDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const [expandedRoundId, setExpandedRoundId] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadGameData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('Tables')
        .select('*')
        .eq('id', id)
        .single();
      if (tableError) throw tableError;
      setGameTable(tableData);

      const { data: tablePlayers, error: playersError } = await supabase
        .from('table_players')
        .select(`player_id, table_id, player:Players (id, name, created_at)`)
        .eq('table_id', id) as { data: TablePlayer[] | null; error: unknown };
      if (playersError) throw playersError;
      const sortedPlayers = (tablePlayers?.map(tp => tp.player) || []).sort((a, b) => a.id - b.id);
      setPlayers(sortedPlayers);

      const { data: roundsData, error: roundsError } = await supabase
        .from('Rounds')
        .select('*')
        .eq('table_id', id)
        .order('round_number', { ascending: true });
      if (roundsError) throw roundsError;
      setRounds(roundsData || []);

      if (roundsData && roundsData.length > 0) {
        const roundIds = roundsData.map(r => r.id);
        const { data: scoresData, error: scoresError } = await supabase
          .from('round_scores')
          .select('*')
          .in('round_id', roundIds);
        if (scoresError) throw scoresError;
        setRoundScores(scoresData || []);
      } else {
        setRoundScores([]);
      }
    } catch (err) {
      console.error('Error loading game data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadGameData();
  }, [id, loadGameData]);

  // ── Realtime ───────────────────────────────────────────────────────────────

  const handleScoreUpdateRealtime = useCallback((newScore: RoundScore) => {
    setRoundScores(prev => {
      const index = prev.findIndex(
        s => s.round_id === newScore.round_id && s.player_id === newScore.player_id
      );
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...prev[index], raw_score: newScore.raw_score };
        return next;
      }
      return [...prev, newScore];
    });
  }, []);

  useGameSubscription({
    gameId: id || '',
    roundIds: useMemo(() => rounds.map(r => r.id), [rounds]),
    onGameUpdate: loadGameData,
    onPlayerUpdate: loadGameData,
    onRoundsUpdate: loadGameData,
    onScoreUpdate: handleScoreUpdateRealtime,
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const tableData = useMemo<RoundRow[]>(() => rounds.map(round => {
    const row: RoundRow = { roundNumber: round.round_number, roundId: round.id, scores: {} };
    roundScores
      .filter(rs => rs.round_id === round.id)
      .forEach(rs => { row.scores[rs.player_id] = rs.raw_score; });
    return row;
  }), [rounds, roundScores]);

  const playerTotals = useMemo(() => {
    const totals: { [key: number]: number } = {};
    players.forEach(p => { totals[p.id] = 0; });
    roundScores.forEach(rs => {
      if (totals[rs.player_id] !== undefined) totals[rs.player_id] += rs.raw_score;
    });
    return totals;
  }, [players, roundScores]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleScoreUpdate = useCallback(async (roundId: number, playerId: number, newScore: number) => {
    // Optimistic update immediately
    handleScoreUpdateRealtime({
      round_id: roundId,
      player_id: playerId,
      raw_score: newScore,
      created_at: new Date().toISOString(),
    });

    const { error } = await supabase
      .from('round_scores')
      .upsert({ round_id: roundId, player_id: playerId, raw_score: newScore });

    if (error) {
      console.error('Error updating score:', error);
      loadGameData();
    }
  }, [handleScoreUpdateRealtime, loadGameData]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const handleAddRound = useCallback(async () => {
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

    const initialScores = players.map(p => ({
      round_id: newRound.id,
      player_id: p.id,
      raw_score: 0,
    }));
    await supabase.from('round_scores').insert(initialScores);

    setRounds(prev => [...prev, newRound]);
    setRoundScores(prev => [
      ...prev,
      ...initialScores.map(s => ({ ...s, created_at: new Date().toISOString() })),
    ]);
    setExpandedRoundId(newRound.id);
    scrollToBottom();
  }, [id, players, rounds.length, scrollToBottom]);

  const handleToggleIsOpen = useCallback(async () => {
    if (!gameTable) return;
    const newValue = !gameTable.is_open;
    const { error } = await supabase.from('Tables').update({ is_open: newValue }).eq('id', id);
    if (error) { console.error('Error toggling is_open:', error); return; }
    setGameTable(prev => prev ? { ...prev, is_open: newValue } : null);
  }, [gameTable, id]);

  const handleToggleExcludeFromOverall = useCallback(async () => {
    if (!gameTable) return;
    const newValue = !gameTable.exclude_from_overall;
    const { error } = await supabase.from('Tables').update({ exclude_from_overall: newValue }).eq('id', id);
    if (error) { console.error('Error toggling exclude_from_overall:', error); return; }
    setGameTable(prev => prev ? { ...prev, exclude_from_overall: newValue } : null);
  }, [gameTable, id]);

  const handleAddPlayerToGame = useCallback(async (playerId: number) => {
    try {
      await supabase.from('table_players').insert([{ table_id: id, player_id: playerId }]);
      const scores = rounds.map(r => ({ round_id: r.id, player_id: playerId, raw_score: 0 }));
      if (scores.length) await supabase.from('round_scores').insert(scores);
      await loadGameData();
      setIsAddingPlayer(false);
      setSearchTerm('');
    } catch (err) {
      console.error('Failed to add player:', err);
    }
  }, [id, rounds, loadGameData]);

  const searchPlayers = useCallback(async (search: string) => {
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
  }, [players]);

  // ── Table columns ──────────────────────────────────────────────────────────

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
              <span title={`Sum is ${sum} (should be 0)`} className="round-error-icon">!</span>
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
            <span className={`player-total-badge ${
              playerTotals[player.id] > 0 ? 'total-positive' :
              playerTotals[player.id] < 0 ? 'total-negative' :
              'total-neutral'
            }`}>
              {playerTotals[player.id] > 0 ? '+' : ''}{playerTotals[player.id]}
            </span>
          </div>
        ),
        cell: info => {
          const score = info.getValue() ?? 0;
          const { roundId } = info.row.original;
          const isEditing = editingCell?.roundId === roundId && editingCell?.playerId === player.id;
          const currentIdx = players.findIndex(p => p.id === player.id);
          return (
            <ScoreCell
              score={score}
              isEditing={isEditing}
              onStartEdit={() => setEditingCell({ roundId, playerId: player.id })}
              onSave={(val) => { handleScoreUpdate(roundId, player.id, val); setEditingCell(null); }}
              onTabNext={currentIdx < players.length - 1
                ? () => setEditingCell({ roundId, playerId: players[currentIdx + 1].id })
                : undefined}
              onTabPrev={currentIdx > 0
                ? () => setEditingCell({ roundId, playerId: players[currentIdx - 1].id })
                : undefined}
            />
          );
        },
      })
    );

    return [roundNumberColumn, ...playerColumns];
  }, [players, playerTotals, editingCell, handleScoreUpdate]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500">
      Error: {error}
    </div>
  );

  return (
    <div className="game-details-container">

      {/* Navbar */}
      <div className="game-navbar">
        <div className="nav-left">
          <button onClick={() => navigate('/')} className="nav-back-button">
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
            title={gameTable?.is_open ? 'Open' : 'Closed'}
            className={`status-button ${gameTable?.is_open ? 'status-button-open' : 'status-button-closed'}`}
          >
            <span className="status-icon-mobile">
              {gameTable?.is_open ? <LockOpenIcon className="w-5 h-5" /> : <LockClosedIcon className="w-5 h-5" />}
            </span>
            <span className="status-label-desktop">{gameTable?.is_open ? 'Open' : 'Closed'}</span>
          </button>

          <button
            onClick={handleToggleExcludeFromOverall}
            title={gameTable?.exclude_from_overall ? 'Excluded' : 'Included'}
            className={`status-button ${gameTable?.exclude_from_overall ? 'status-button-excluded' : 'status-button-included'}`}
          >
            <span className="status-icon-mobile">{gameTable?.exclude_from_overall ? '✕' : '✓'}</span>
            <span className="status-label-desktop">{gameTable?.exclude_from_overall ? 'Excluded' : 'Included'}</span>
          </button>

          <button
            onClick={() => { setIsAddingPlayer(true); searchPlayers(''); }}
            className="btn-add-player-nav"
          >
            <span className="min-[640px]:hidden">+P</span>
            <span className="hidden min-[640px]:inline">Add Player</span>
          </button>

          {gameTable?.is_open && (
            <button onClick={handleAddRound} className="btn-add-round">
              <span className="text-xl leading-none">+</span> Round
            </button>
          )}
        </div>
      </div>

      {/* Mobile-only sticky totals bar */}
      <div className="mobile-totals-bar">
        {players.map(player => (
          <div key={player.id} className="mobile-totals-item">
            <span className="mobile-totals-name">{player.name}</span>
            <span className={`mobile-totals-score ${
              playerTotals[player.id] > 0 ? 'total-positive' :
              playerTotals[player.id] < 0 ? 'total-negative' :
              'total-neutral'
            }`}>
              {playerTotals[player.id] > 0 ? '+' : ''}{playerTotals[player.id]}
            </span>
          </div>
        ))}
      </div>

      {/* Main Score Sheet */}
      <div className="main-score-sheet">

        {/* Desktop: Table view */}
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
                  return (
                    <tr key={row.id} className={`table-row ${sum !== 0 ? 'table-row-invalid' : ''}`}>
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="table-td">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr />
              </tbody>
            </table>
          </div>

          {rounds.length === 0 && (
            <div className="empty-state">
              <p>No rounds played yet.</p>
              <button onClick={handleAddRound} className="empty-state-btn">Start the game</button>
            </div>
          )}
        </div>

        {/* Mobile: Card view */}
        <div className="card-view-container">
          {rounds.length === 0 ? (
            <div className="empty-state">
              <p>No rounds played yet.</p>
              <button onClick={handleAddRound} className="empty-state-btn">Start the game</button>
            </div>
          ) : (
            tableData.map(row => {
              const sum = Object.values(row.scores).reduce((a, b) => a + b, 0);
              const isInvalid = sum !== 0;
              const isExpanded = expandedRoundId === row.roundId;
              return (
                <div key={row.roundId} className={`round-card ${isInvalid ? 'round-card-invalid' : ''}`}>
                  <div
                    className="round-card-header"
                    onClick={() => setExpandedRoundId(isExpanded ? null : row.roundId)}
                  >
                    <span className={`round-card-number ${isInvalid ? 'round-number-invalid' : ''}`}>
                      Runde {row.roundNumber}
                    </span>
                    <div className="round-card-header-right">
                      {isInvalid && (
                        <span className="round-error-icon" title={`Sum is ${sum} (should be 0)`}>!</span>
                      )}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`round-card-chevron ${isExpanded ? 'round-card-chevron-open' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <div className={`round-card-body ${isExpanded ? 'round-card-body-open' : ''}`}>
                    <div className="round-card-scores">
                      {players.map(player => {
                        const score = row.scores[player.id] ?? 0;
                        const isEditing = editingCell?.roundId === row.roundId && editingCell?.playerId === player.id;
                        return (
                          <div key={player.id} className="round-card-score-row">
                            <span className="round-card-player-name">{player.name}</span>
                            <ScoreCell
                              score={score}
                              isEditing={isEditing}
                              onStartEdit={() => setEditingCell({ roundId: row.roundId, playerId: player.id })}
                              onSave={(val) => { handleScoreUpdate(row.roundId, player.id, val); setEditingCell(null); }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {gameTable?.is_open && (
            <button onClick={handleAddRound} className="btn-add-round-mobile">
              <span className="text-2xl leading-none">+</span>
            </button>
          )}
        </div>
      </div>
      <div ref={bottomRef} />

      {/* Add Player Modal */}
      {isAddingPlayer && (
        <div className="modal-overlay" onClick={() => setIsAddingPlayer(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Add Player</h2>
            <input
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); searchPlayers(e.target.value); }}
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
              <button onClick={() => setIsAddingPlayer(false)} className="modal-cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
