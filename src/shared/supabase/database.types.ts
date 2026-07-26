// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run types:db
//
// This is the only version-controlled record of the database shape, so its
// diffs double as a schema changelog. If `npm run types:db` produces a diff
// here, the hosted schema changed without a migration in supabase/migrations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      Players: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      round_scores: {
        Row: {
          created_at: string
          player_id: number
          raw_score: number
          round_id: number
        }
        Insert: {
          created_at?: string
          player_id: number
          raw_score?: number
          round_id?: number
        }
        Update: {
          created_at?: string
          player_id?: number
          raw_score?: number
          round_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'round_scores_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'Players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'round_scores_round_id_fkey'
            columns: ['round_id']
            isOneToOne: false
            referencedRelation: 'Rounds'
            referencedColumns: ['id']
          },
        ]
      }
      Rounds: {
        Row: {
          created_at: string
          id: number
          round_number: number
          table_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          round_number: number
          table_id: number
        }
        Update: {
          created_at?: string
          id?: number
          round_number?: number
          table_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'Rounds_table_id_fkey'
            columns: ['table_id']
            isOneToOne: false
            referencedRelation: 'Tables'
            referencedColumns: ['id']
          },
        ]
      }
      table_players: {
        Row: {
          player_id: number
          table_id: number
        }
        Insert: {
          player_id: number
          table_id: number
        }
        Update: {
          player_id?: number
          table_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'table_players_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'Players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'table_players_table_id_fkey'
            columns: ['table_id']
            isOneToOne: false
            referencedRelation: 'Tables'
            referencedColumns: ['id']
          },
        ]
      }
      Tables: {
        Row: {
          after_photo_path: string | null
          before_photo_path: string | null
          created_at: string
          exclude_from_overall: boolean
          id: number
          is_open: boolean
          name: string
        }
        Insert: {
          after_photo_path?: string | null
          before_photo_path?: string | null
          created_at?: string
          exclude_from_overall?: boolean
          id?: number
          is_open?: boolean
          name?: string
        }
        Update: {
          after_photo_path?: string | null
          before_photo_path?: string | null
          created_at?: string
          exclude_from_overall?: boolean
          id?: number
          is_open?: boolean
          name?: string
        }
        Relationships: []
      }
      tt_match_players: {
        Row: {
          match_id: number
          player_id: number
          side: string
        }
        Insert: {
          match_id: number
          player_id: number
          side: string
        }
        Update: {
          match_id?: number
          player_id?: number
          side?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tt_match_players_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'tt_matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tt_match_players_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'Players'
            referencedColumns: ['id']
          },
        ]
      }
      tt_matches: {
        Row: {
          best_of: number
          created_at: string
          exclude_from_overall: boolean
          format: string
          id: number
          is_open: boolean
          name: string | null
        }
        Insert: {
          best_of?: number
          created_at?: string
          exclude_from_overall?: boolean
          format: string
          id?: number
          is_open?: boolean
          name?: string | null
        }
        Update: {
          best_of?: number
          created_at?: string
          exclude_from_overall?: boolean
          format?: string
          id?: number
          is_open?: boolean
          name?: string | null
        }
        Relationships: []
      }
      tt_sets: {
        Row: {
          created_at: string
          id: number
          match_id: number
          score_a: number
          score_b: number
          set_number: number
        }
        Insert: {
          created_at?: string
          id?: number
          match_id: number
          score_a?: number
          score_b?: number
          set_number: number
        }
        Update: {
          created_at?: string
          id?: number
          match_id?: number
          score_a?: number
          score_b?: number
          set_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'tt_sets_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'tt_matches'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_round: {
        Args: { p_table_id: number }
        Returns: {
          created_at: string
          id: number
          round_number: number
          table_id: number
        }
        SetofOptions: {
          from: '*'
          to: 'Rounds'
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
