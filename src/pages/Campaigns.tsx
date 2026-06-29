import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, Search, WifiOff, History, DollarSign, Power, ImageIcon, Plus, Clock, Pencil, Check, X, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { getSetting } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FbInsights {
  spend: number
  impressions: number
  clicks: number
  cpm: number
  cpc: number
  ctr: number
  reach: number
  frequency: number
  purchases: number
  revenue: number
  roas: number
  cpa: number
  initiateCheckout: number
  costPerCheckout: number
  landingPageViews: number
}

interface FbAd {
  id: string
  name: string
  status: string
  insights: FbInsights | null
}

interface FbAdSet {
  id: string
  name: string
  status: string
  insights: FbInsights | null
  ads?: FbAd[]
  loadingAds?: boolean
}

interface FbCampaign {
  id: string
  name: string
  status: string
  daily_budget: number
  insights: FbInsights | null
  adSets?: FbAdSet[]
  loadingAdSets?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseInsights(raw: Record<string, unknown>[] | undefined): FbInsights | null {
  if (!raw || raw.length === 0) return null
  const d = raw[0] as Record<string, unknown>

  const getAction = (key: string): number => {
    const arr = (d.actions ?? []) as Array<{ action_type: string; value: string }>
    return parseFloat(arr.find(a => a.action_type === key)?.value ?? '0') || 0
  }
  const getActionValue = (key: string): number => {
    const arr = (d.action_values ?? []) as Array<{ action_type: string; value: string }>
    return parseFloat(arr.find(a => a.action_type === key)?.value ?? '0') || 0
  }
  const getCPA = (key: string): number => {
    const arr = (d.cost_per_action_type ?? []) as Array<{ action_type: string; value: string }>
    return parseFloat(arr.find(a => a.action_type === key)?.value ?? '0') || 0
  }
  const getRoas = (): number => {
    const arr = (d.purchase_roas ?? []) as Array<{ action_type: string; value: string }>
    return parseFloat(arr[0]?.value ?? '0') || 0
  }

  const purchases = getAction('offsite_conversion.fb_pixel_purchase') || getAction('purchase') || getAction('omni_purchase')
  const revenue = getActionValue('offsite_conversion.fb_pixel_purchase') || getActionValue('purchase') || getActionValue('omni_purchase')
  const cpa = getCPA('offsite_conversion.fb_pixel_purchase') || getCPA('purchase') || getCPA('omni_purchase')
  const initiateCheckout = getAction('offsite_conversion.fb_pixel_initiate_checkout') || getAction('initiate_checkout')
  const costPerCheckout = getCPA('offsite_conversion.fb_pixel_initiate_checkout') || getCPA('initiate_checkout')
  const landingPageViews = getAction('landing_page_view') || getAction('omni_landing_page_view')

  return {
    spend: parseFloat(d.spend as string) || 0,
    impressions: parseInt(d.impressions as string) || 0,
    clicks: parseInt(d.clicks as string) || 0,
    cpm: parseFloat(d.cpm as string) || 0,
    cpc: parseFloat(d.cpc as string) || 0,
    ctr: parseFloat(d.ctr as string) || 0,
    reach: parseInt(d.reach as string) || 0,
    frequency: parseFloat(d.frequency as string) || 0,
    purchases,
    revenue,
    roas: getRoas(),
    cpa,
    initiateCheckout,
    costPerCheckout,
    landingPageViews,
  }
}

async function fbFetch(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  const data = await res.json() as Record<string, unknown>
  if (data.error) throw new Error((data.error as Record<string, string>).message)
  return data
}

const INSIGHT_FIELDS =
  'spend,impressions,clicks,cpm,cpc,ctr,reach,frequency,actions,action_values,purchase_roas,cost_per_action_type'

// ─── Sub-components ───────────────────────────────────────────────────────────

const COLS = [
  'Nome', 'Status', 'Orçamento/dia', 'Gasto', 'Compras', 'Receita', 'ROAS', 'CPA',
  'Inic. Checkout', 'CPM', 'CPC', 'CTR', 'Impressões', 'Cliques', 'Freq.',
]

function MetricCell({ value, highlight }: { value: string; highlight?: boolean }) {
  return (
    <td className={`px-3 py-2.5 whitespace-nowrap text-sm ${highlight ? 'text-[#00B894] font-semibold' : 'text-gray-300'}`}>
      {value}
    </td>
  )
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE'
  return (
    <Badge variant={active ? 'active' : 'paused'}>
      {active ? 'Ativo' : 'Pausado'}
    </Badge>
  )
}

function InsightCells({ ins }: { ins: FbInsights | null }) {
  if (!ins) {
    return <>{Array.from({ length: 11 }).map((_, i) => <td key={i} className="px-3 py-2.5 text-gray-600 text-sm">—</td>)}</>
  }
  const roasColor = ins.roas >= 3 ? 'text-[#00B894] font-semibold' : ins.roas > 0 ? 'text-yellow-400 font-semibold' : 'text-gray-300'
  return (
    <>
      <MetricCell value={formatCurrency(ins.spend)} />
      <MetricCell value={ins.purchases > 0 ? formatNumber(ins.purchases) : '—'} />
      <MetricCell value={ins.revenue > 0 ? formatCurrency(ins.revenue) : '—'} highlight />
      <td className={`px-3 py-2.5 whitespace-nowrap text-sm ${roasColor}`}>
        {ins.roas > 0 ? `${ins.roas.toFixed(2)}x` : '—'}
      </td>
      <MetricCell value={ins.cpa > 0 ? formatCurrency(ins.cpa) : '—'} />
      <MetricCell value={ins.initiateCheckout > 0 ? formatNumber(ins.initiateCheckout) : '—'} />
      <MetricCell value={formatCurrency(ins.cpm)} />
      <MetricCell value={formatCurrency(ins.cpc)} />
      <MetricCell value={`${ins.ctr.toFixed(2)}%`} />
      <MetricCell value={formatNumber(ins.impressions)} />
      <MetricCell value={formatNumber(ins.clicks)} />
      <MetricCell value={ins.frequency.toFixed(2)} />
    </>
  )
}

function AdRow({ ad }: { ad: FbAd }) {
  return (
    <tr className="border-b border-[#2d2d4a]/20 bg-[#08081a] hover:bg-[#0d0d20]">
      <td className="px-3 py-2 pl-20">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-gray-600 flex-shrink-0" />
          <span className="text-gray-400 text-xs truncate max-w-[200px]" title={ad.name}>{ad.name}</span>
        </div>
      </td>
      <td className="px-3 py-2"><StatusBadge status={ad.status} /></td>
      <td className="px-3 py-2 text-gray-600 text-sm">—</td>
      <InsightCells ins={ad.insights} />
    </tr>
  )
}

function AdSetRow({
  adSet, token, datePreset, customStart, customEnd,
}: {
  adSet: FbAdSet
  token: string
  datePreset: string
  customStart?: string
  customEnd?: string
}) {
  const [open, setOpen] = useState(false)
  const [ads, setAds] = useState<FbAd[]>(adSet.ads ?? [])
  const [loading, setLoading] = useState(false)

  async function handleExpand() {
    const next = !open
    setOpen(next)
    if (!next || ads.length > 0) return

    setLoading(true)
    try {
      const data = await fbFetch(
        `https://graph.facebook.com/v19.0/${adSet.id}/ads?fields=id,name,status,` +
        (datePreset === 'custom' && customStart && customEnd
          ? `insights.time_range({"since":"${customStart}","until":"${customEnd}"})`
          : `insights.date_preset(${datePreset})`) +
        `{${INSIGHT_FIELDS}}&limit=100&access_token=${token}`
      )
      const rows = (data.data as Record<string, unknown>[]) ?? []
      setAds(rows.map(r => ({
        id: r.id as string,
        name: r.name as string,
        status: r.status as string,
        insights: parseInsights((r.insights as Record<string, unknown>)?.data as Record<string, unknown>[]),
      })))
    } catch { /* show empty */ }
    setLoading(false)
  }

  return (
    <>
      <tr
        className="border-b border-[#2d2d4a]/30 bg-[#0d0d28] hover:bg-[#111135] cursor-pointer"
        onClick={handleExpand}
      >
        <td className="px-3 py-2.5 pl-10">
          <div className="flex items-center gap-2">
            {open
              ? <ChevronDown className="w-3.5 h-3.5 text-[#74B9FF] flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
            <span className="text-gray-300 text-xs truncate max-w-[200px]" title={adSet.name}>{adSet.name}</span>
          </div>
        </td>
        <td className="px-3 py-2.5"><StatusBadge status={adSet.status} /></td>
        <td className="px-3 py-2.5 text-gray-600 text-sm">—</td>
        <InsightCells ins={adSet.insights} />
      </tr>
      {open && loading && (
        <tr className="bg-[#08081a]">
          <td colSpan={COLS.length} className="px-10 py-2">
            <Skeleton className="h-6 w-full" />
          </td>
        </tr>
      )}
      {open && !loading && ads.map(ad => <AdRow key={ad.id} ad={ad} />)}
    </>
  )
}

function CampaignRow({
  campaign, token, datePreset, customStart, customEnd,
}: {
  campaign: FbCampaign
  token: string
  datePreset: string
  customStart?: string
  customEnd?: string
}) {
  const [open, setOpen]     = useState(false)
  const [adSets, setAdSets] = useState<FbAdSet[]>(campaign.adSets ?? [])
  const [loading, setLoading] = useState(false)

  const [budget, setBudget]         = useState(campaign.daily_budget)
  const [editing, setEditing]       = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [saving, setSaving]         = useState(false)
  const [budgetErr, setBudgetErr]   = useState('')

  async function handleExpand() {
    const next = !open
    setOpen(next)
    if (!next || adSets.length > 0) return
    setLoading(true)
    try {
      const data = await fbFetch(
        `https://graph.facebook.com/v19.0/${campaign.id}/adsets?fields=id,name,status,` +
          (datePreset === 'custom' && customStart && customEnd
            ? `insights.time_range({"since":"${customStart}","until":"${customEnd}"})`
            : `insights.date_preset(${datePreset})`) +
          `{${INSIGHT_FIELDS}}&limit=100&access_token=${token}`
      )
      const rows = (data.data as Record<string, unknown>[]) ?? []
      setAdSets(rows.map(r => ({
        id: r.id as string,
        name: r.name as string,
        status: r.status as string,
        insights: parseInsights((r.insights as Record<string, unknown>)?.data as Record<string, unknown>[]),
      })))
    } catch { /* show empty */ }
    setLoading(false)
  }

  function startEdit(e: { stopPropagation(): void }) {
    e.stopPropagation()
    setBudgetInput(budget > 0 ? String(budget) : '')
    setBudgetErr('')
    setEditing(true)
  }

  function cancelEdit(e: { stopPropagation(): void }) {
    e.stopPropagation()
    setEditing(false)
  }

  async function saveBudget(e: { stopPropagation(): void }) {
    e.stopPropagation()
    const val = parseFloat(budgetInput.replace(',', '.'))
    if (isNaN(val) || val <= 0) { setBudgetErr('Valor inválido'); return }
    setSaving(true)
    setBudgetErr('')
    try {
      const body = new URLSearchParams({
        daily_budget: String(Math.round(val * 100)),
        access_token: token,
      })
      const res  = await fetch(`https://graph.facebook.com/v19.0/${campaign.id}`, { method: 'POST', body })
      const data = await res.json() as Record<string, unknown>
      if (data.error) throw new Error((data.error as Record<string, string>).message)
      setBudget(val)
      setEditing(false)
    } catch (err) {
      setBudgetErr(String(err).replace('Error: ', ''))
    }
    setSaving(false)
  }

  return (
    <>
      <tr
        className="border-b border-[#2d2d4a]/60 hover:bg-[#1f1f3a] cursor-pointer group"
        onClick={handleExpand}
      >
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {open
              ? <ChevronDown className="w-4 h-4 text-[#74B9FF] flex-shrink-0" />
              : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0 group-hover:text-gray-300" />}
            <span className="text-white font-medium text-sm truncate max-w-[220px]" title={campaign.name}>
              {campaign.name}
            </span>
          </div>
        </td>
        <td className="px-3 py-3"><StatusBadge status={campaign.status} /></td>

        {/* ─── Orçamento editável ─── */}
        <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
          {editing ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#7AA880]">R$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={budgetInput}
                    onChange={e => setBudgetInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveBudget(e); if (e.key === 'Escape') cancelEdit(e) }}
                    className="w-24 pl-7 pr-2 py-1 bg-[#081208] border border-[#4DB848] rounded text-sm text-white focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  onClick={saveBudget}
                  disabled={saving}
                  className="p-1 rounded hover:bg-[#4DB848]/20 text-[#4DB848] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={cancelEdit} className="p-1 rounded hover:bg-red-500/20 text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {budgetErr && <p className="text-[10px] text-red-400 max-w-[140px] leading-tight">{budgetErr}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/bud">
              <span className="text-[#C8900A] text-sm font-mono">
                {budget > 0 ? formatCurrency(budget) : '—'}
              </span>
              <button
                onClick={startEdit}
                className="opacity-0 group-hover/bud:opacity-100 p-1 rounded hover:bg-[#1B3D20] text-[#7AA880] transition-opacity"
                title="Editar orçamento"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </td>

        <InsightCells ins={campaign.insights} />
      </tr>
      {open && loading && (
        <tr className="bg-[#0d0d28]">
          <td colSpan={COLS.length} className="px-10 py-2">
            <Skeleton className="h-6 w-full" />
          </td>
        </tr>
      )}
      {open && !loading && adSets.map(as => (
        <AdSetRow key={as.id} adSet={as} token={token} datePreset={datePreset} customStart={customStart} customEnd={customEnd} />
      ))}
    </>
  )
}

// ─── Change History ───────────────────────────────────────────────────────────

interface ActivityEntry {
  event_time: string | number  // ISO string ou Unix timestamp
  event_type: string
  object_name: string
  object_type: string
  extra_data: string
  translated_event_type: string
}

// Facebook retorna event_time como ISO string ou Unix timestamp dependendo da versão
function parseEventTime(et: string | number): Date {
  if (typeof et === 'number') return new Date(et * 1000)
  const asNum = Number(et)
  if (!isNaN(asNum) && asNum > 1_000_000_000) return new Date(asNum * 1000)
  return new Date(et) // ISO 8601 string
}

const EVENT_LABELS: Record<string, string> = {
  update_campaign_budget:     'Orçamento de campanha alterado',
  update_campaign_run_status: 'Status de campanha alterado',
  create_campaign:            'Campanha criada',
  update_ad_creative:         'Criativo atualizado',
  create_ad_creative:         'Novo criativo criado',
  create_ad:                  'Anúncio criado',
  update_ad_run_status:       'Status de anúncio alterado',
  update_ad_name:             'Nome do anúncio alterado',
  create_ad_set:              'Conjunto de anúncios criado',
  update_ad_set_budget:       'Orçamento do conjunto alterado',
  update_ad_set_run_status:   'Status do conjunto alterado',
  update_ad_bid_amount:       'Lance de anúncio alterado',
}

const EVENT_STYLE: Record<string, { tag: string; dot: string; icon: React.ReactNode }> = {
  update_campaign_budget:     { tag: 'text-[#C8900A] bg-[#C8900A]/10 border-[#C8900A]/20', dot: 'bg-[#C8900A]', icon: <DollarSign className="w-3 h-3" /> },
  update_ad_set_budget:       { tag: 'text-[#C8900A] bg-[#C8900A]/10 border-[#C8900A]/20', dot: 'bg-[#C8900A]', icon: <DollarSign className="w-3 h-3" /> },
  update_ad_bid_amount:       { tag: 'text-[#C8900A] bg-[#C8900A]/10 border-[#C8900A]/20', dot: 'bg-[#C8900A]', icon: <DollarSign className="w-3 h-3" /> },
  update_campaign_run_status: { tag: 'text-[#D45820] bg-[#D45820]/10 border-[#D45820]/20', dot: 'bg-[#D45820]', icon: <Power className="w-3 h-3" /> },
  update_ad_run_status:       { tag: 'text-[#D45820] bg-[#D45820]/10 border-[#D45820]/20', dot: 'bg-[#D45820]', icon: <Power className="w-3 h-3" /> },
  update_ad_set_run_status:   { tag: 'text-[#D45820] bg-[#D45820]/10 border-[#D45820]/20', dot: 'bg-[#D45820]', icon: <Power className="w-3 h-3" /> },
  update_ad_creative:         { tag: 'text-[#4DB848] bg-[#4DB848]/10 border-[#4DB848]/20', dot: 'bg-[#4DB848]', icon: <ImageIcon className="w-3 h-3" /> },
  create_ad_creative:         { tag: 'text-[#4DB848] bg-[#4DB848]/10 border-[#4DB848]/20', dot: 'bg-[#4DB848]', icon: <ImageIcon className="w-3 h-3" /> },
  create_campaign:            { tag: 'text-[#7FCC5E] bg-[#7FCC5E]/10 border-[#7FCC5E]/20', dot: 'bg-[#7FCC5E]', icon: <Plus className="w-3 h-3" /> },
  create_ad_set:              { tag: 'text-[#7FCC5E] bg-[#7FCC5E]/10 border-[#7FCC5E]/20', dot: 'bg-[#7FCC5E]', icon: <Plus className="w-3 h-3" /> },
  create_ad:                  { tag: 'text-[#7FCC5E] bg-[#7FCC5E]/10 border-[#7FCC5E]/20', dot: 'bg-[#7FCC5E]', icon: <Plus className="w-3 h-3" /> },
}

const OBJ_TYPE_LABEL: Record<string, string> = {
  CAMPAIGN: 'Campanha', CAMPAIGN_GROUP: 'Campanha', AD_SET: 'Conjunto', AD: 'Anúncio', AD_CREATIVE: 'Criativo',
}

function extractNumeric(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') { const n = parseFloat(val); return isNaN(n) ? null : n }
  if (typeof val === 'object') {
    // extra_data de orçamento: {"amount": 5000, "currency": "BRL"} ou {"daily_budget": "5000"}
    const obj = val as Record<string, unknown>
    for (const k of ['amount', 'daily_budget', 'lifetime_budget', 'budget', 'value', 'bid_amount']) {
      const n = parseFloat(String(obj[k] ?? ''))
      if (!isNaN(n)) return n
    }
    // qualquer campo numérico positivo
    for (const v of Object.values(obj)) {
      const n = parseFloat(String(v))
      if (!isNaN(n) && n > 0) return n
    }
  }
  return null
}

function stringify(val: unknown): string {
  if (val === null || val === undefined) return '?'
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    // tentar pegar campo de texto legível
    for (const k of ['name', 'label', 'status', 'value', 'text']) {
      if (typeof obj[k] === 'string') return String(obj[k])
    }
    return JSON.stringify(val)
  }
  return String(val)
}

function parseExtraData(raw: string, eventType: string): string {
  if (!raw) return ''
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const before = data.before ?? data.old_value ?? data.prev_value
    const after  = data.after  ?? data.new_value ?? data.current_value
    if (before !== undefined && after !== undefined) {
      if (eventType.includes('budget') || eventType.includes('bid')) {
        const bNum = extractNumeric(before)
        const aNum = extractNumeric(after)
        if (bNum !== null && aNum !== null) {
          const fmt = (n: number) => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          return `${fmt(bNum)} → ${fmt(aNum)}`
        }
      }
      return `${stringify(before)} → ${stringify(after)}`
    }
    if (data.ad_creative_id) return `ID: ${data.ad_creative_id}`
    return ''
  } catch { return '' }
}

function ChangeHistory({ token, accountId }: { token: string; accountId: string }) {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading]       = useState(true)
  const [period, setPeriod]         = useState('last_7d')

  useEffect(() => {
    if (!token || !accountId) return
    setLoading(true)
    fbFetch(
      `https://graph.facebook.com/v19.0/act_${accountId}/activities` +
      `?fields=event_time,event_type,object_name,object_type,extra_data,translated_event_type` +
      `&date_preset=${period}&limit=100&access_token=${token}`
    )
      .then(data => setActivities((data.data as ActivityEntry[]) ?? []))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false))
  }, [token, accountId, period])

  const grouped: Record<string, ActivityEntry[]> = {}
  activities.forEach(a => {
    const d = parseEventTime(a.event_time)
    const key = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(a)
  })

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1B3D20]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#4DB848]" />
            <span className="text-sm font-semibold text-[#E0EEE0]">Histórico de Alterações</span>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
              <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <Clock className="w-8 h-8 text-[#1B3D20]" />
            <p className="text-sm text-[#4A6E52]">Nenhuma alteração encontrada no período.</p>
          </div>
        ) : (
          <div>
            {Object.entries(grouped).map(([date, entries]) => (
              <div key={date}>
                <div className="px-4 py-1.5 bg-[#081208] border-b border-[#1B3D20]">
                  <span className="text-[11px] font-semibold text-[#7AA880] uppercase tracking-wider">{date}</span>
                </div>
                {entries.map((entry, i) => {
                  const label    = EVENT_LABELS[entry.event_type] ?? entry.translated_event_type ?? entry.event_type
                  const style    = EVENT_STYLE[entry.event_type]
                  const tagCls   = style?.tag ?? 'text-[#7AA880] bg-[#1B3D20]/50 border-[#1B3D20]'
                  const dotCls   = style?.dot ?? 'bg-[#4A6E52]'
                  const detail   = parseExtraData(entry.extra_data ?? '{}', entry.event_type)
                  const dd       = parseEventTime(entry.event_time)
                  const time     = `${String(dd.getHours()).padStart(2,'0')}:${String(dd.getMinutes()).padStart(2,'0')}`
                  const objLabel = OBJ_TYPE_LABEL[entry.object_type] ?? entry.object_type
                  return (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-[#1B3D20]/40 hover:bg-[#142918]/30 transition-colors last:border-0">
                      <div className="pt-2 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${dotCls}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tagCls}`}>
                            {style?.icon}{label}
                          </span>
                          <span className="text-[10px] text-[#4A6E52]">{objLabel}</span>
                          <span className="text-[10px] text-[#4A6E52] ml-auto font-mono">{time}</span>
                        </div>
                        <p className="text-sm text-[#E0EEE0] mt-0.5 truncate">{entry.object_name || '—'}</p>
                        {detail && <p className="text-xs text-[#C8900A] mt-0.5 font-mono">{detail}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<FbCampaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [noConfig, setNoConfig]   = useState(false)
  const [token, setToken]         = useState('')
  const [accountId, setAccountId] = useState('')
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [datePreset, setDatePreset]     = useState('maximum')
  const [customStart, setCustomStart]   = useState('')
  const [customEnd, setCustomEnd]       = useState('')

  const fetchCampaigns = useCallback(async (tok: string, accId: string, preset: string, cs?: string, ce?: string) => {
    setLoading(true)
    setError(null)
    const insightsParam = preset === 'custom' && cs && ce
      ? `insights.time_range({"since":"${cs}","until":"${ce}"})`
      : `insights.date_preset(${preset})`
    try {
      const data = await fbFetch(
        `https://graph.facebook.com/v19.0/act_${accId}/campaigns` +
        `?fields=id,name,status,daily_budget,${insightsParam}{${INSIGHT_FIELDS}}` +
        `&limit=100&access_token=${tok}`
      )
      const rows = (data.data as Record<string, unknown>[]) ?? []
      setCampaigns(rows.map(r => ({
        id: r.id as string,
        name: r.name as string,
        status: r.status as string,
        daily_budget: parseInt(r.daily_budget as string ?? '0') / 100,
        insights: parseInsights((r.insights as Record<string, unknown>)?.data as Record<string, unknown>[]),
      })))
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const tok = getSetting('facebook_token')
    const acc = getSetting('facebook_ad_account_id')
    if (!tok || !acc) { setNoConfig(true); setLoading(false); return }
    setToken(tok)
    setAccountId(acc)
    fetchCampaigns(tok, acc, datePreset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (token && accountId && datePreset !== 'custom') fetchCampaigns(token, accountId, datePreset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset])

  function applyCustom() {
    if (token && accountId && customStart && customEnd && customStart <= customEnd) {
      fetchCampaigns(token, accountId, 'custom', customStart, customEnd)
    }
  }

  const filtered = campaigns.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === (statusFilter === 'active' ? 'ACTIVE' : 'PAUSED')
    return matchSearch && matchStatus
  })

  // ─── No config ──────────────────────────────────────────────────────────────
  if (noConfig) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">Campanhas</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <WifiOff className="w-10 h-10 text-gray-500" />
            <div>
              <p className="text-white font-medium mb-1">Facebook Ads não conectado</p>
              <p className="text-gray-400 text-sm">Vá em <strong>Integrações</strong> e conecte sua conta para ver as campanhas.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white">Campanhas</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar campanha..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-48"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="paused">Pausado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
              <SelectItem value="last_14d">Últimos 14 dias</SelectItem>
              <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
              <SelectItem value="this_month">Este mês</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
              <SelectItem value="maximum">Máximo</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="h-9 px-3 rounded-md border border-[#1B3D20] bg-[#081208] text-[#E0EEE0] text-sm focus:outline-none focus:ring-1 focus:ring-[#4DB848]"
              />
              <span className="text-[#7AA880] text-sm">até</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={e => setCustomEnd(e.target.value)}
                className="h-9 px-3 rounded-md border border-[#1B3D20] bg-[#081208] text-[#E0EEE0] text-sm focus:outline-none focus:ring-1 focus:ring-[#4DB848]"
              />
              <button
                onClick={applyCustom}
                disabled={!customStart || !customEnd || customStart > customEnd}
                className="h-9 px-4 rounded-md bg-[#4DB848] text-white text-sm font-medium hover:bg-[#3da038] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Aplicar
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-[#E94560]/10 border border-[#E94560]/30 rounded-lg p-4 text-sm text-[#E94560]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2d2d4a] bg-[#0F0F23]">
                    {COLS.map(col => (
                      <th key={col} className="text-left px-3 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={COLS.length} className="px-4 py-12 text-center text-gray-400">
                        {error ? 'Erro ao carregar campanhas.' : 'Nenhuma campanha encontrada.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map(c => (
                      <CampaignRow key={c.id} campaign={c} token={token} datePreset={datePreset} customStart={customStart} customEnd={customEnd} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Alterações */}
      {token && accountId && (
        <ChangeHistory token={token} accountId={accountId} />
      )}
    </div>
  )
}
