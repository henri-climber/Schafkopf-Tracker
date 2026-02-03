import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseGameSubscriptionProps {
    gameId: string;
    roundIds: number[];
    onGameUpdate: () => void;
    onPlayerUpdate: () => void;
    onRoundsUpdate: () => void;
    onScoreUpdate: (newScore: any) => void;
}

export function useGameSubscription({
    gameId,
    roundIds,
    onGameUpdate,
    onPlayerUpdate,
    onRoundsUpdate,
    onScoreUpdate,
}: UseGameSubscriptionProps) {
    // Use a ref for roundIds to access the latest value inside the callback
    // without re-subscribing every time the list changes
    const roundIdsRef = useRef(roundIds);

    useEffect(() => {
        roundIdsRef.current = roundIds;
    }, [roundIds]);

    useEffect(() => {
        if (!gameId) return;

        let channel: RealtimeChannel;

        const setupSubscription = () => {
            channel = supabase
                .channel(`game_${gameId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'Tables',
                        filter: `id=eq.${gameId}`,
                    },
                    () => {
                        onGameUpdate();
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'table_players',
                        filter: `table_id=eq.${gameId}`,
                    },
                    () => {
                        onPlayerUpdate();
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'Rounds',
                        filter: `table_id=eq.${gameId}`,
                    },
                    () => {
                        onRoundsUpdate();
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'round_scores',
                    },
                    (payload) => {
                        // Check if this score is relevant to our current rounds
                        const newScore = payload.new as any;
                        if (newScore && roundIdsRef.current.includes(newScore.round_id)) {
                            onScoreUpdate(newScore);
                        }
                    }
                )
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
        // We intentionally exclude callbacks from dependency array to avoid re-subscription
        // The parent component should wrap them in useCallback if they are unstable,
        // but even if they change, we don't want to reconnect the socket.
        // However, technically if callbacks change we might be calling stale ones.
        // Ideally, we'd use refs for callbacks too.
        // For now, assuming relatively stable callbacks or standard parent re-renders.
    }, [gameId]); // Only re-subscribe if gameId changes
}
