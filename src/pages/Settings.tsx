import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getSetting, setSetting } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
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
    { id: '1', name: 'Gateway (Monetizze)', type: 'percentage', value: 7.9, appliesTo: 'revenue' },
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

export default function Settings() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[#E0EEE0]">Configurações</h1>
      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="facebook">Facebook Ads</TabsTrigger>
          <TabsTrigger value="taxes">Taxas</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralTab /></TabsContent>
        <TabsContent value="facebook"><FacebookTab /></TabsContent>
        <TabsContent value="taxes"><TaxesTab /></TabsContent>
      </Tabs>
    </div>
  )
}
