import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTable, listTables } from './tables'
import { fetchTablesWithScores, type DateRange, type StatsOptions } from './stats'

export const schafkopfKeys = {
  all: ['schafkopf'] as const,
  tables: (options: { isOpen: boolean }) => ['schafkopf', 'tables', options] as const,
  table: (tableId: number) => ['schafkopf', 'table', tableId] as const,
  rounds: (tableId: number) => ['schafkopf', 'rounds', tableId] as const,
  stats: (range: DateRange, options: StatsOptions) =>
    ['schafkopf', 'stats', range, options] as const,
}

export function useTables(options: { isOpen: boolean; ascending?: boolean }) {
  return useQuery({
    queryKey: schafkopfKeys.tables({ isOpen: options.isOpen }),
    queryFn: () => listTables(options),
    staleTime: 30_000,
  })
}

export function useCreateTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTable,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schafkopfKeys.all }),
  })
}

/**
 * The one query behind both the leaderboard and the score chart. Sharing a
 * query key is what stops them fetching the same data twice, and what
 * guarantees they are computed from the same snapshot.
 */
export function useTablesWithScores(range: DateRange, options: StatsOptions) {
  return useQuery({
    queryKey: schafkopfKeys.stats(range, options),
    queryFn: () => fetchTablesWithScores(range, options),
    staleTime: 60_000,
  })
}
