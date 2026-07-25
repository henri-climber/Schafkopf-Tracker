import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPlayer, listPlayers } from './players'

export const playerKeys = {
  all: ['players'] as const,
}

export function usePlayers() {
  return useQuery({
    queryKey: playerKeys.all,
    queryFn: listPlayers,
    // The roster changes a few times a semester; no need to refetch on focus.
    staleTime: 5 * 60_000,
  })
}

export function useCreatePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPlayer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playerKeys.all }),
  })
}
