/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL_SCHAF: string
  readonly VITE_SUPABASE_ANON_KEY_SCHAF: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
