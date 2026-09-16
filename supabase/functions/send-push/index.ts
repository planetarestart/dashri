// Supabase Edge Function — envia push notifications para todos os subscribers
// Deploy: supabase functions deploy send-push
// Secret: supabase secrets set VAPID_PRIVATE_KEY=<sua_chave_privada_vapid>

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY  = 'BOPG8YX6ifi_CZDDM91lAMhTdKM6aR-J0kQzdaCXTdDZwRlzIt_r45QWHw3uCpk4pSOR2TIVDizf5H53S2akbKM'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT     = 'mailto:axagentes@gmail.com'

function base64urlToUint8Array(b64: string): Uint8Array {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  return Uint8Array.from(atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
}

async function buildVapidAuth(audience: string): Promise<string> {
  const header  = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payload = btoa(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const sigInput  = `${header}.${payload}`
  const keyData   = base64urlToUint8Array(VAPID_PRIVATE_KEY)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, new TextEncoder().encode(sigInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${sigInput}.${sigB64}`

  return `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const { title, body, url } = await req.json() as { title: string; body: string; url?: string }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: subs, error } = await supabase.from('push_subscriptions').select('subscription')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const payload = JSON.stringify({ title, body, url: url ?? '/dashboard', icon: '/pwa-192x192.png' })
  const results: { endpoint: string; ok: boolean }[] = []

  for (const row of (subs ?? [])) {
    const sub = row.subscription as { endpoint: string; keys: { auth: string; p256dh: string } }
    try {
      const origin    = new URL(sub.endpoint).origin
      const vapidAuth = await buildVapidAuth(origin)

      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type':   'application/octet-stream',
          'TTL':            '86400',
          'Authorization':  vapidAuth,
          'Content-Encoding': 'aes128gcm',
        },
        body: new TextEncoder().encode(payload),
      })
      results.push({ endpoint: sub.endpoint, ok: res.ok })

      // Remove subscriptions that are no longer valid
      if (res.status === 410) {
        await supabase.from('push_subscriptions').delete().eq('subscription->>endpoint', sub.endpoint)
      }
    } catch (e) {
      results.push({ endpoint: sub.endpoint, ok: false })
      console.error(e)
    }
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
