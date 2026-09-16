// Deploy: supabase functions deploy send-push --no-verify-jwt
// Secret: supabase secrets set VAPID_PRIVATE_KEY=<sua_chave_privada_vapid>

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY  = 'BOPG8YX6ifi_CZDDM91lAMhTdKM6aR-J0kQzdaCXTdDZwRlzIt_r45QWHw3uCpk4pSOR2TIVDizf5H53S2akbKM'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''

webpush.setVapidDetails('mailto:axagentes@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  if (!VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: 'VAPID_PRIVATE_KEY secret não configurado' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const { title, body, url } = await req.json() as { title: string; body: string; url?: string }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: subs, error } = await supabase.from('push_subscriptions').select('subscription')
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'Nenhuma subscription encontrada. Ative as notificações no app primeiro.' }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const payload = JSON.stringify({ title, body, url: url ?? '/dashboard', icon: '/pwa-192x192.png' })
  const results: { ok: boolean; error?: string }[] = []

  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload)
      results.push({ ok: true })
    } catch (e) {
      const err = e as { statusCode?: number }
      if (err.statusCode === 410) {
        // Subscription expirada — remove do banco
        await supabase.from('push_subscriptions')
          .delete()
          .eq('subscription->>endpoint', (row.subscription as { endpoint: string }).endpoint)
      }
      results.push({ ok: false, error: String(e) })
    }
  }

  return new Response(JSON.stringify({ sent: results.filter(r => r.ok).length, total: subs.length, results }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
  })
})
