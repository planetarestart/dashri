import { useState, useEffect } from 'react'
import { Copy, CheckCircle, XCircle, Loader2, Zap, Share2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { getSetting, setSetting, deleteSetting } from '@/lib/supabase'

interface AdAccount {
  id: string
  name: string
  account_id: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <CheckCircle className="w-4 h-4 text-[#4DB848]" /> : <Copy className="w-4 h-4" />}
      <span className="ml-1.5 hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
    </Button>
  )
}

function WebhookCard({ platform, color }: { platform: string; color: string }) {
  const url = `https://seu-dominio.com/webhook/${platform.toLowerCase()}`
  const [active] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
              <Zap className="w-5 h-5 text-[#E0EEE0]" />
            </div>
            <div>
              <CardTitle className="text-base">{platform}</CardTitle>
              <CardDescription>Checkout</CardDescription>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? 'text-[#4DB848]' : 'text-[#4A6E52]'}`}>
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-[#4DB848]' : 'bg-gray-500'}`} />
            {active ? 'Ativo' : 'Inativo'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-[#7AA880] mb-1.5">URL do Webhook</p>
          <div className="flex items-center gap-2">
            <Input value={url} readOnly className="text-xs font-mono" />
            <CopyButton text={url} />
          </div>
        </div>
        <p className="text-xs text-[#4A6E52]">
          Cole esta URL nas configurações de webhook da {platform}. O status ficará Ativo após o primeiro evento recebido.
        </p>
      </CardContent>
    </Card>
  )
}

export default function Integrations() {
  const { toast } = useToast()
  const [token, setToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [connectedAccount, setConnectedAccount] = useState<{ name: string; id: string } | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  useEffect(() => {
    const savedId = getSetting('facebook_ad_account_id')
    const savedName = getSetting('facebook_ad_account_name')
    if (savedId && savedName) setConnectedAccount({ id: savedId, name: savedName })
    setLoadingStatus(false)
  }, [])

  async function handleConnect() {
    if (!token.trim()) {
      toast({ title: 'Token inválido', description: 'Cole um Access Token válido.', variant: 'destructive' })
      return
    }
    setConnecting(true)
    try {
      const all: AdAccount[] = []
      let url: string | null =
        `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_id&limit=100&access_token=${token.trim()}`

      while (url) {
        const res = await fetch(url)
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        all.push(...(data.data ?? []))
        url = data.paging?.next ?? null
      }

      all.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      setAdAccounts(all)
      setSetting('facebook_token', token.trim())
      toast({ title: 'Token validado!', description: `${all.length} conta(s) encontrada(s).` })
    } catch (err) {
      toast({ title: 'Erro ao conectar', description: String(err), variant: 'destructive' })
    } finally {
      setConnecting(false)
    }
  }

  function handleSelectAccount(value: string) {
    setSelectedAccount(value)
    const account = adAccounts.find((a) => a.account_id === value)
    if (!account) return
    setSetting('facebook_ad_account_id', account.account_id)
    setSetting('facebook_ad_account_name', account.name)
    setConnectedAccount({ id: account.account_id, name: account.name })
    toast({ title: 'Conta selecionada!', description: `${account.name} conectada com sucesso.` })
  }

  function handleDisconnect() {
    deleteSetting('facebook_token')
    deleteSetting('facebook_ad_account_id')
    deleteSetting('facebook_ad_account_name')
    setConnectedAccount(null)
    setAdAccounts([])
    setToken('')
    setSelectedAccount('')
    toast({ title: 'Desconectado', description: 'Facebook Ads desconectado com sucesso.' })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#E0EEE0]">Integrações</h1>

      {/* Facebook Ads */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1877F2] flex items-center justify-center">
              <Share2 className="w-5 h-5 text-[#E0EEE0]" />
            </div>
            <div>
              <CardTitle className="text-base">Facebook Ads</CardTitle>
              <CardDescription>Conecte via Access Token do Facebook</CardDescription>
            </div>
            {!loadingStatus && (
              <div className={`ml-auto flex items-center gap-1.5 text-sm font-medium ${connectedAccount ? 'text-[#4DB848]' : 'text-[#D45820]'}`}>
                {connectedAccount
                  ? <><CheckCircle className="w-4 h-4" /> Conectado</>
                  : <><XCircle className="w-4 h-4" /> Desconectado</>}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectedAccount ? (
            <div className="space-y-4">
              <div className="bg-[#4DB848]/10 border border-[#4DB848]/20 rounded-lg p-4">
                <p className="text-sm text-[#7AA880] mb-1">Conta conectada</p>
                <p className="text-[#E0EEE0] font-semibold">{connectedAccount.name}</p>
                <p className="text-[#7AA880] text-xs mt-0.5">ID: {connectedAccount.id}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#7AA880] mb-1.5">Access Token do Facebook</p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Cole seu Access Token aqui..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button onClick={handleConnect} disabled={connecting} className="shrink-0">
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Conectar'}
                  </Button>
                </div>
                <p className="text-xs text-[#4A6E52] mt-2">
                  Gere um token permanente no Facebook Business Manager → Ferramentas → Tokens de acesso do sistema.
                </p>
              </div>

              {adAccounts.length > 0 && (
                <div>
                  <p className="text-xs text-[#7AA880] mb-1.5">Selecione a conta de anúncio</p>
                  <Select value={selectedAccount} onValueChange={handleSelectAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma conta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {adAccounts.map((acc) => (
                        <SelectItem key={acc.account_id} value={acc.account_id}>
                          {acc.name} (ID: {acc.account_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WebhookCard platform="Monetizze" color="bg-orange-500" />
      </div>
    </div>
  )
}
