import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RoundScore } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseGameSubscriptionProps {
  gameId: string;
  roundIds: number[];
  onGameUpdate: () => void;
  onPlayerUpdate: () => void;
  onRoundsUpdate: () => void;
  onScoreUpdate: (newScore: RoundScore) => void;
}

export function useGameSubscription({
  gameId,
  roundIds,
  onGameUpdate,
  onPlayerUpdate,
  onRoundsUpdate,
  onScoreUpdate,
}: UseGameSubscriptionProps) {
  // Keep refs up-to-date so subscription callbacks always use the latest versions
  const roundIdsRef = useRef(roundIds);
  const onGameUpdateRef = useRef(onGameUpdate);
  const onPlayerUpdateRef = useRef(onPlayerUpdate);
  const onRoundsUpdateRef = useRef(onRoundsUpdate);
  const onScoreUpdateRef = useRef(onScoreUpdate);

  useEffect(() => { roundIdsRef.current = roundIds; }, [roundIds]);
  useEffect(() => { onGameUpdateRef.current = onGameUpdate; }, [onGameUpdate]);
  useEffect(() => { onPlayerUpdateRef.current = onPlayerUpdate; }, [onPlayerUpdate]);
  useEffect(() => { onRoundsUpdateRef.current = onRoundsUpdate; }, [onRoundsUpdate]);
  useEffect(() => { onScoreUpdateRef.current = onScoreUpdate; }, [onScoreUpdate]);

  useEffect(() => {
    if (!gameId) return;

    let channel: RealtimeChannel;

    channel = supabase
      .channel(`game_${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Tables', filter: `id=eq.${gameId}` },
        () => onGameUpdateRef.current()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${gameId}` },
        () => onPlayerUpdateRef.current()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Rounds', filter: `table_id=eq.${gameId}` },
        () => onRoundsUpdateRef.current()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round_scores' },
        (payload) => {
          const newScore = payload.new as RoundScore;
          if (newScore && roundIdsRef.current.includes(newScore.round_id)) {
            onScoreUpdateRef.current(newScore);
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [gameId]);
}
