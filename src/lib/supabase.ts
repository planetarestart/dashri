import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Settings: Supabase como fonte, localStorage como cache ───────────────────
// getSetting é síncrono (lê cache). syncSettings popula o cache na inicialização.
// setSetting / deleteSetting escrevem nos dois ao mesmo tempo.

const PREFIX = 'ri_setting_'

export function getSetting(key: string): string | null {
  try { return localStorage.getItem(PREFIX + key) } catch { return null }
}

export function setSetting(key: string, value: string): void {
  try { localStorage.setItem(PREFIX + key, value) } catch {}
  // escreve no Supabase em background (fire-and-forget)
  supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' })
    .then(() => {})
}

export function deleteSetting(key: string): void {
  try { localStorage.removeItem(PREFIX + key) } catch {}
  supabase.from('settings').delete().eq('key', key).then(() => {})
}

// Chama uma vez na inicialização do app: puxa todas as chaves do banco
// e preenche o localStorage. Assim qualquer device fica sincronizado.
export async function syncSettings(): Promise<void> {
  try {
    const { data } = await supabase.from('settings').select('key, value')
    if (data) {
      data.forEach(({ key, value }: { key: string; value: string }) => {
        try { localStorage.setItem(PREFIX + key, value) } catch {}
      })
    }
  } catch { /* sem internet ou tabela inexistente: silencia */ }
}
