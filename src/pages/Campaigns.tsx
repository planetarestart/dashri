import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, Search, WifiOff } from 'lucide-react'
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
  'Nome', 'Status', 'Gasto', 'Compras', 'Receita', 'ROAS', 'CPA',
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
      <InsightCells ins={ad.insights} />
    </tr>
  )
}

function AdSetRow({
  adSet, token, datePreset,
}: {
  adSet: FbAdSet
  token: string
  datePreset: string
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
        `https://graph.facebook.com/v19.0/${adSet.id}/ads?fields=id,name,status,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}&limit=100&access_token=${token}`
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
  campaign, token, datePreset,
}: {
  campaign: FbCampaign
  token: string
  datePreset: string
}) {
  const [open, setOpen] = useState(false)
  const [adSets, setAdSets] = useState<FbAdSet[]>(campaign.adSets ?? [])
  const [loading, setLoading] = useState(false)

  async function handleExpand() {
    const next = !open
    setOpen(next)
    if (!next || adSets.length > 0) return

    setLoading(true)
    try {
      const data = await fbFetch(
        `https://graph.facebook.com/v19.0/${campaign.id}/adsets?fields=id,name,status,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}&limit=100&access_token=${token}`
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
        <AdSetRow key={as.id} adSet={as} token={token} datePreset={datePreset} />
      ))}
    </>
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

  const fetchCampaigns = useCallback(async (tok: string, accId: string, preset: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fbFetch(
        `https://graph.facebook.com/v19.0/act_${accId}/campaigns` +
        `?fields=id,name,status,daily_budget,insights.date_preset(${preset}){${INSIGHT_FIELDS}}` +
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
    if (token && accountId) fetchCampaigns(token, accountId, datePreset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset])

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
            </SelectContent>
          </Select>
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
                      <CampaignRow key={c.id} campaign={c} token={token} datePreset={datePreset} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
