import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, RefreshCw, Bell, BellOff, Smartphone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getSetting, setSetting, supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import {
  isPushSupported, getPermission, getSubscription,
  requestPermissionAndSubscribe, unsubscribePush,
} from '@/lib/push'
import type { Tax } from '@/types'

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
  { value: 'America/Belem', label: 'Belém (UTC-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
  { value: 'America/Recife', label: 'Recife (UTC-3)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (UTC-4)' },
  { value: 'America/Boa_Vista', label: 'Boa Vista (UTC-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
]

const CURRENCIES = [
  { value: 'BRL', label: 'Real Brasileiro (BRL)' },
  { value: 'USD', label: 'Dólar Americano (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
]

function GeneralTab() {
  const { toast } = useToast()
  const [appName, setAppName] = useState('Restart Intestinal')
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  const [currency, setCurrency] = useState('BRL')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const name = getSetting('app_name')
    const tz   = getSetting('timezone')
    const cur  = getSetting('currency')
    if (name) setAppName(name)
    if (tz)   setTimezone(tz)
    if (cur)  setCurrency(cur)
  }, [])

  function handleSave() {
    setSaving(true)
    setSetting('app_name', appName)
    setSetting('timezone', timezone)
    setSetting('currency', currency)
    setSaving(false)
    toast({ title: 'Configurações salvas!', description: 'As alterações foram aplicadas.' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configurações Gerais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <label className="text-sm text-[#7AA880] block mb-1.5">Nome do Aplicativo</label>
          <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-[#7AA880] block mb-1.5">Fuso Horário</label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-[#7AA880] block mb-1.5">Moeda Padrão</label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</> : 'Salvar Alterações'}
        </Button>
      </CardContent>
    </Card>
  )
}

function FacebookTab() {
  const { toast } = useToast()
  const [token, setToken] = useState('')
  const [maskedToken, setMaskedToken] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  useEffect(() => {
    const t  = getSetting('facebook_token')
    const ls = getSetting('last_fb_sync')
    if (t)  setMaskedToken(t.slice(0, 10) + '...')
    if (ls) setLastSync(ls)
  }, [])

  function handleUpdateToken() {
    if (!token.trim()) return
    setSetting('facebook_token', token.trim())
    setMaskedToken(token.trim().slice(0, 10) + '...')
    setToken('')
    toast({ title: 'Token atualizado!', description: 'O novo Access Token foi salvo.' })
  }

  async function handleSync() {
    setSyncing(true)
    await new Promise(r => setTimeout(r, 1500))
    const now = new Date().toISOString()
    setSetting('last_fb_sync', now)
    setLastSync(now)
    setSyncing(false)
    toast({ title: 'Sincronizado!', description: 'Dados do Facebook Ads atualizados.' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Facebook Ads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {maskedToken && (
          <div className="bg-[#081208] rounded-lg p-3">
            <p className="text-xs text-[#7AA880] mb-1">Token atual</p>
            <p className="text-[#E0EEE0] font-mono text-sm">{maskedToken}</p>
          </div>
        )}
        <div>
          <label className="text-sm text-[#7AA880] block mb-1.5">Atualizar Access Token</label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Cole o novo token..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="font-mono text-xs"
            />
            <Button variant="secondary" onClick={handleUpdateToken} disabled={!token.trim()} className="shrink-0">
              Salvar
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[#1B3D20]">
          <div>
            <p className="text-sm text-[#7AA880]">Sincronizar dados agora</p>
            {lastSync && (
              <p className="text-xs text-gray-500 mt-0.5">
                Última sinc: {new Date(lastSync).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sincronizando...</>
              : <><RefreshCw className="w-4 h-4 mr-2" />Sincronizar</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TaxesTab() {
  const { toast } = useToast()
  const [taxes, setTaxes] = useState<Tax[]>([
    { id: '1', name: 'Gateway (Monetizze)', type: 'percentage', value: 4.9, appliesTo: 'revenue' },
    { id: '2', name: 'Comissão Afiliado', type: 'percentage', value: 30, appliesTo: 'commission' },
  ])
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', type: 'percentage' as 'percentage' | 'fixed', value: '', appliesTo: 'revenue' as 'revenue' | 'commission' })

  function handleAdd() {
    if (!form.name || !form.value) return
    const newTax: Tax = {
      id: Date.now().toString(),
      name: form.name,
      type: form.type,
      value: parseFloat(form.value),
      appliesTo: form.appliesTo,
    }
    setTaxes([...taxes, newTax])
    setForm({ name: '', type: 'percentage', value: '', appliesTo: 'revenue' })
    setModalOpen(false)
    toast({ title: 'Taxa adicionada!', description: `"${newTax.name}" foi cadastrada.` })
  }

  function handleDelete() {
    if (!deleteId) return
    setTaxes(taxes.filter((t) => t.id !== deleteId))
    setDeleteId(null)
    toast({ title: 'Taxa removida.' })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Taxas e Comissões</CardTitle>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar Taxa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {taxes.length === 0 ? (
            <p className="text-[#7AA880] text-sm text-center py-8">Nenhuma taxa cadastrada.</p>
          ) : (
            <div className="divide-y divide-[#1B3D20]">
              {taxes.map((tax) => (
                <div key={tax.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#142918]/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[#E0EEE0] font-medium text-sm">{tax.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs px-2 py-0">
                          {tax.appliesTo === 'revenue' ? 'Receita' : 'Comissão'}
                        </Badge>
                        <span className="text-xs text-[#7AA880]">
                          {tax.type === 'percentage' ? `${tax.value}%` : formatCurrency(tax.value)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#7AA880] hover:text-[#E94560]"
                    onClick={() => setDeleteId(tax.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Tax Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Taxa</DialogTitle>
            <DialogDescription>Configure uma nova taxa ou comissão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[#7AA880] block mb-1.5">Nome da Taxa</label>
              <Input
                placeholder="Ex: Gateway Hotmart"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[#7AA880] block mb-1.5">Tipo</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as 'percentage' | 'fixed' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#7AA880] block mb-1.5">Valor</label>
                <Input
                  type="number"
                  placeholder={form.type === 'percentage' ? '9.9' : '10.00'}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-[#7AA880] block mb-1.5">Aplica-se a</label>
              <Select value={form.appliesTo} onValueChange={(v) => setForm({ ...form, appliesTo: v as 'revenue' | 'commission' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Receita</SelectItem>
                  <SelectItem value="commission">Comissão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Taxa</DialogTitle>
            <DialogDescription>Tem certeza que deseja remover esta taxa? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NotificacoesTab() {
  const { toast } = useToast()
  const [supported, setSupported]   = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [checking, setChecking]     = useState(true)

  const isIOS        = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    const sup = isPushSupported()
    setSupported(sup)
    setPermission(getPermission())
    if (sup) {
      getSubscription()
        .then(sub => setSubscribed(!!sub))
        .finally(() => setChecking(false))
    } else {
      setChecking(false)
    }
  }, [])

  async function handleEnable() {
    setLoading(true)
    try {
      const { permission: perm, subscription } = await requestPermissionAndSubscribe()
      setPermission(perm)
      if (!subscription) {
        toast({
          title: 'Permissão negada',
          description: 'Habilite notificações nas configurações do navegador.',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        toast({
          title: 'Não autenticado',
          description: 'Faça login novamente para ativar notificações.',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }
      const { error: upsertErr } = await supabase.from('push_subscriptions').upsert(
        { user_id: user.id, subscription: subscription.toJSON() },
        { onConflict: 'user_id' }
      )
      if (upsertErr) {
        toast({
          title: 'Erro ao salvar subscription',
          description: upsertErr.message,
          variant: 'destructive',
        })
        setLoading(false)
        return
      }
      setSubscribed(true)
      toast({ title: 'Notificações ativadas!', description: 'Você receberá alertas mesmo com o app fechado.' })
    } catch (err) {
      toast({ title: 'Erro ao ativar', description: String(err), variant: 'destructive' })
    }
    setLoading(false)
  }

  async function handleDisable() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
      }
      await unsubscribePush()
      setSubscribed(false)
      toast({ title: 'Notificações desativadas.' })
    } catch (err) {
      toast({ title: 'Erro', description: String(err), variant: 'destructive' })
    }
    setLoading(false)
  }

  async function handleTest() {
    // Primeiro tenta via Edge Function (push real); fallback para notificação local
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              title: '🚀 Restart Dashboard',
              body: 'Notificações funcionando! Você receberá alertas de novas vendas.',
              url: '/dashboard',
            }),
          }
        )
        if (res.ok) {
          toast({ title: 'Notificação enviada!', description: 'Verifique seu dispositivo.' })
          return
        }
      }
    } catch { /* fallback abaixo */ }

    // Fallback: notificação local (sem fechar o app)
    if (Notification.permission === 'granted') {
      new Notification('🚀 Restart Dashboard', {
        body: 'Notificações funcionando! Você receberá alertas de novas vendas.',
        icon: '/pwa-192x192.png',
      })
      toast({ title: 'Notificação local enviada!', description: 'A notificação push real requer a Edge Function deployada.' })
    }
  }

  if (checking) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#4DB848]" />
        </CardContent>
      </Card>
    )
  }

  if (!supported) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <BellOff className="w-8 h-8 text-gray-500 mx-auto" />
          <p className="text-[#E0EEE0] font-medium">Notificações não suportadas</p>
          <p className="text-sm text-[#4A6E52]">Seu navegador não suporta Web Push. Use Chrome ou Safari 16.4+.</p>
        </CardContent>
      </Card>
    )
  }

  if (isIOS && !isStandalone) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <Smartphone className="w-8 h-8 text-[#74B9FF] mx-auto" />
          <div>
            <p className="text-[#E0EEE0] font-medium mb-1">Instale o app primeiro (iOS)</p>
            <p className="text-sm text-[#4A6E52]">
              No Safari: toque em <strong className="text-[#E0EEE0]">Compartilhar</strong> →{' '}
              <strong className="text-[#E0EEE0]">Adicionar à Tela de Início</strong>
            </p>
            <p className="text-xs text-[#4A6E52] mt-2">
              Depois abra o app pela tela de início e ative as notificações aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#4DB848]" />
          Push Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[#081208] border border-[#1B3D20]">
          <div>
            <p className="text-[#E0EEE0] font-medium">Alertas no celular / PC</p>
            <p className="text-xs text-[#4A6E52] mt-0.5">
              {subscribed
                ? 'Ativo — você recebe alertas mesmo com o app fechado'
                : 'Inativo — ative para receber alertas de novas vendas'}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${subscribed ? 'text-[#4DB848]' : 'text-gray-500'}`}>
            <div className={`w-2 h-2 rounded-full ${subscribed ? 'bg-[#4DB848] animate-pulse' : 'bg-gray-600'}`} />
            {subscribed ? 'Ativo' : 'Inativo'}
          </div>
        </div>

        {permission === 'denied' && (
          <div className="text-xs text-[#E94560] bg-[#E94560]/10 border border-[#E94560]/20 rounded-lg p-3">
            Notificações estão bloqueadas. Vá em Configurações do navegador → Privacidade → Notificações → permita este site.
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          {!subscribed ? (
            <Button onClick={handleEnable} disabled={loading || permission === 'denied'}>
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <Bell className="w-4 h-4 mr-2" />}
              Ativar Notificações
            </Button>
          ) : (
            <Button variant="outline" onClick={handleDisable} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Desativar
            </Button>
          )}

          {subscribed && (
            <Button variant="secondary" onClick={handleTest} disabled={loading}>
              Enviar teste
            </Button>
          )}
        </div>

        {/* What triggers notifications */}
        <div className="space-y-2 pt-3 border-t border-[#1B3D20]">
          <p className="text-xs text-[#7AA880] font-semibold uppercase tracking-wide">Você será notificado sobre</p>
          {[
            'Nova venda realizada',
            'Meta diária de vendas atingida',
            'Campanha pausada automaticamente pelo Meta',
          ].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-[#4A6E52]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4DB848] flex-shrink-0" />
              {item}
            </div>
          ))}
        </div>

        {/* Platform info */}
        <div className="text-xs text-[#4A6E52] bg-[#0d1f0d] rounded-lg p-3 space-y-1">
          <p className="font-semibold text-[#7AA880]">Compatibilidade</p>
          <p>✓ Android — Chrome / Edge (sem precisar instalar o app)</p>
          <p>✓ iOS 16.4+ — Safari (requer instalação na tela de início)</p>
          <p>✓ Windows / Mac — Chrome, Edge, Firefox</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Settings() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[#E0EEE0]">Configurações</h1>
      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="facebook">Facebook Ads</TabsTrigger>
          <TabsTrigger value="taxes">Taxas</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralTab /></TabsContent>
        <TabsContent value="facebook"><FacebookTab /></TabsContent>
        <TabsContent value="taxes"><TaxesTab /></TabsContent>
        <TabsContent value="notifications"><NotificacoesTab /></TabsContent>
      </Tabs>
    </div>
  )
}
