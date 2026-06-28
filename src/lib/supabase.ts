import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Settings via localStorage ────────────────────────────────────────────────
// Evita dependência da tabela "settings" no Supabase.

const PREFIX = 'ri_setting_'

export function getSetting(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function setSetting(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch { /* ignore */ }
}

export function deleteSetting(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch { /* ignore */ }
}
