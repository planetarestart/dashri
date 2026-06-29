import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, ComposedChart,
} from 'recharts'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { supabase, getSetting } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'yesterday' | '7d' | '30d' | 'maximum' | 'custom'

interface KPIs {
  grossRevenue: number
  adSpend: number
  metaTax: number
  profit: number
  sales: number
  roas: number
  cpa: number
  roi: number
  fbPurchases: number
}

interface ChartPoint { date: string; revenue: number; spend: number }
interface SourcePoint { name: string; value: number; color: string }
interface TopCampaign { id: string; name: string; status: string; spend: number; revenue: number; roas: number; cpa: number; purchases: number }
interface HourPoint { hour: string; count: number }
interface ProductPoint { name: string; count: number; pct: number }
interface WeekdayPoint { day: string; count: number }
interface DailyMetricsPoint { date: string; sales: number; roas: number; cpa: number }
interface FunnelData { lpv: number; ic: number; purchases: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodDates(
  period: Period,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string; prev_start: string; prev_end: string } {
  const today = new Date()
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const sub = (d: Date, days: number) => { const r = new Date(d); r.setDate(r.getDate() - days); return r }

  if (period === 'today') {
    return { start: fmt(today), end: fmt(today), prev_start: fmt(sub(today, 1)), prev_end: fmt(sub(today, 1)) }
  }
  if (period === 'yesterday') {
    const y = sub(today, 1)
    return { start: fmt(y), end: fmt(y), prev_start: fmt(sub(today, 2)), prev_end: fmt(sub(today, 2)) }
  }
  if (period === '7d') {
    return { start: fmt(sub(today, 7)), end: fmt(today), prev_start: fmt(sub(today, 14)), prev_end: fmt(sub(today, 8)) }
  }
  if (period === '30d') {
    return { start: fmt(sub(today, 30)), end: fmt(today), prev_start: fmt(sub(today, 60)), prev_end: fmt(sub(today, 31)) }
  }
  if (period === 'custom' && customStart && customEnd) {
    const s = new Date(customStart + 'T12:00:00')
    const e = new Date(customEnd   + 'T12:00:00')
    const diffDays = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1
    return { start: customStart, end: customEnd, prev_start: fmt(sub(s, diffDays)), prev_end: fmt(sub(s, 1)) }
  }
  return { start: '2020-01-01', end: fmt(today), prev_start: '2010-01-01', prev_end: '2019-12-31' }
}

// Para período custom usa time_range no lugar de date_preset
const FB_PRESET: Record<Exclude<Period, 'custom'>, string> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': 'last_7d',
  '30d': 'last_30d',
  maximum: 'maximum',
}

const INSIGHT_FIELDS = 'spend,actions,action_values,purchase_roas,cost_per_action_type'

function extractFbMetrics(data: Record<string, unknown>[] | undefined) {
  if (!data || data.length === 0) return { spend: 0, purchases: 0, revenue: 0, roas: 0, cpa: 0, initiateCheckout: 0, landingPageViews: 0 }
  const d = data[0] as Record<string, unknown>
  const getAction = (key: string) => {
    const arr = (d.actions ?? []) as Array<{ action_type: string; value: string }>
    return parseFloat(arr.find(a => a.action_type === key)?.value ?? '0') || 0
  }
  const getActionValue = (key: string) => {
    const arr = (d.action_values ?? []) as Array<{ action_type: string; value: string }>
    return parseFloat(arr.find(a => a.action_type === key)?.value ?? '0') || 0
  }
  const getCPA = (key: string) => {
    const arr = (d.cost_per_action_type ?? []) as Array<{ action_type: string; value: string }>
    return parseFloat(arr.find(a => a.action_type === key)?.value ?? '0') || 0
  }
  const getRoas = () => {
    const arr = (d.purchase_roas ?? []) as Array<{ action_type: string; value: string }>
    return parseFloat(arr[0]?.value ?? '0') || 0
  }
  const purchases        = getAction('offsite_conversion.fb_pixel_purchase') || getAction('purchase') || getAction('omni_purchase')
  const revenue          = getActionValue('offsite_conversion.fb_pixel_purchase') || getActionValue('purchase') || getActionValue('omni_purchase')
  const cpa              = getCPA('offsite_conversion.fb_pixel_purchase') || getCPA('purchase') || getCPA('omni_purchase')
  const initiateCheckout = getAction('offsite_conversion.fb_pixel_initiate_checkout') || getAction('initiate_checkout') || getAction('omni_initiated_checkout')
  const landingPageViews = getAction('landing_page_view') || getAction('omni_landing_page_view')
  return { spend: parseFloat(d.spend as string) || 0, purchases, revenue, roas: getRoas(), cpa, initiateCheckout, landingPageViews }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string; value: string; variation: number | null
  loading?: boolean
}

function MetricCard({ label, value, variation, loading }: MetricCardProps) {
  const isPositive = (variation ?? 0) >= 0
  const Arrow = isPositive ? ArrowUpRight : ArrowDownRight
  const color = isPositive ? 'text-[#4DB848]' : 'text-[#D45820]'

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="hover:border-[#4DB848]/30 transition-colors">
      <CardContent className="p-4">
        <span className="text-[10px] text-[#7AA880] font-semibold uppercase tracking-wider block mb-2 leading-tight">{label}</span>
        <p className="text-lg font-bold text-[#E0EEE0] mb-1 leading-tight truncate">{value}</p>
        {variation !== null ? (
          <div className={`flex items-center gap-1 text-[10px] font-medium ${color}`}>
            <Arrow className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{Math.abs(variation).toFixed(1)}% anterior</span>
          </div>
        ) : (
          <div className="text-[10px] text-[#4A6E52]">período completo</div>
        )}
      </CardContent>
    </Card>
  )
}

const LineTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D2114] border border-[#1B3D20] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-[#7AA880] mb-2">{label}</p>
      {payload.map((e) => (
        <div key={e.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-[#7AA880]">{e.name}:</span>
          <span className="text-[#E0EEE0] font-semibold">{formatCurrency(e.value)}</span>
        </div>
      ))}
    </div>
  )
}

const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D2114] border border-[#1B3D20] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-[#E0EEE0] font-semibold">{payload[0].name}</p>
      <p className="text-[#7AA880]">{payload[0].value}% das vendas</p>
    </div>
  )
}

const BarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D2114] border border-[#1B3D20] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-[#7AA880] mb-1">{label}</p>
      <p className="text-[#E0EEE0] font-semibold">{payload[0].value} {payload[0].value === 1 ? 'venda' : 'vendas'}</p>
    </div>
  )
}

const ComboTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D2114] border border-[#1B3D20] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-[#7AA880] mb-2">{label}</p>
      {payload.map(e => (
        <div key={e.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
          <span className="text-[#7AA880]">{e.name}:</span>
          <span className="text-[#E0EEE0] font-semibold">
            {e.name === 'ROAS' ? `${e.value.toFixed(2)}x`
              : e.name === 'CPA' ? formatCurrency(e.value)
              : formatNumber(e.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

const DonutTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D2114] border border-[#1B3D20] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-[#E0EEE0] font-semibold">{payload[0].name}</p>
      <p className="text-[#7AA880]">{payload[0].value} {payload[0].value === 1 ? 'venda' : 'vendas'}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [period, setPeriod]           = useState<Period>('30d')
  const [loading, setLoading]           = useState(true)
  const [kpis, setKpis]                 = useState<KPIs | null>(null)
  const [prevKpis, setPrevKpis]         = useState<KPIs | null>(null)
  const [chartData, setChartData]       = useState<ChartPoint[]>([])
  const [sourceData, setSourceData]     = useState<SourcePoint[]>([])
  const [topCampaigns, setTopCampaigns] = useState<TopCampaign[]>([])
  const [hourData, setHourData]         = useState<HourPoint[]>([])
  const [productData, setProductData]   = useState<ProductPoint[]>([])
  const [paymentData, setPaymentData]   = useState<SourcePoint[]>([])
  const [weekdayData, setWeekdayData]   = useState<WeekdayPoint[]>([])
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetricsPoint[]>([])
  const [funnelData, setFunnelData]     = useState<FunnelData | null>(null)
  const [customStart, setCustomStart]   = useState('')
  const [customEnd, setCustomEnd]       = useState('')

  const fetchAll = useCallback(async (p: Period, cs?: string, ce?: string) => {
    setLoading(true)
    const { start, end, prev_start, prev_end } = getPeriodDates(p, cs, ce)
    const token  = getSetting('facebook_token')
    const accId  = getSetting('facebook_ad_account_id')

    // Parâmetro de tempo para a API do Facebook
    const isCustom = p === 'custom'
    const fbTimeParam   = isCustom
      ? `time_range={"since":"${start}","until":"${end}"}`
      : `date_preset=${FB_PRESET[p as Exclude<Period,'custom'>]}`
    const fbDailyParam  = (isCustom || p === 'maximum')
      ? (isCustom ? `time_range={"since":"${start}","until":"${end}"}` : `date_preset=last_30d`)
      : fbTimeParam

    // ── Supabase: vendas do período atual ──
    const salesQuery = supabase
      .from('vendas')
      .select('valor_venda, data, utm_source, horario, produto_comprado, metodo_de_pagamento')
      .gte('data', start)
      .lte('data', end)

    // ── Supabase: vendas do período anterior ──
    const prevSalesQuery = supabase
      .from('vendas')
      .select('valor_venda')
      .gte('data', prev_start)
      .lte('data', prev_end)

    // ── Facebook: insights de campanha ──
    const fbCampaignPromise = (token && accId) ? fetch(
      `https://graph.facebook.com/v19.0/act_${accId}/insights` +
      `?fields=${INSIGHT_FIELDS}&${fbTimeParam}&access_token=${token}`
    ).then(r => r.json()).catch(() => null) : Promise.resolve(null)

    // ── Facebook: insights diários (para gráficos) ──
    const fbDailyPromise = (token && accId) ? fetch(
      `https://graph.facebook.com/v19.0/act_${accId}/insights` +
      `?fields=spend,date_start,actions,purchase_roas,cost_per_action_type&time_increment=1&${fbDailyParam}&limit=60&access_token=${token}`
    ).then(r => r.json()).catch(() => null) : Promise.resolve(null)

    // ── Facebook: top campanhas ──
    const fbCampaignsPromise = (token && accId) ? fetch(
      `https://graph.facebook.com/v19.0/act_${accId}/campaigns` +
      `?fields=id,name,status,insights{${INSIGHT_FIELDS},${fbTimeParam}}&limit=20&access_token=${token}`
    ).then(r => r.json()).catch(() => null) : Promise.resolve(null)

    const [salesRes, prevSalesRes, fbAll, fbDaily, fbCampaigns] = await Promise.all([
      salesQuery, prevSalesQuery, fbCampaignPromise, fbDailyPromise, fbCampaignsPromise,
    ])

    // ── Calcular KPIs atuais ──
    const sales    = (salesRes.data ?? []) as Array<{ valor_venda: number; data: string; utm_source: string; horario: string; produto_comprado: string; metodo_de_pagamento: string }>
    const prevSalesArr = (prevSalesRes.data ?? []) as Array<{ valor_venda: number }>

    const grossRevenue = sales.reduce((s, r) => s + (r.valor_venda ?? 0), 0)
    const prevRevenue  = prevSalesArr.reduce((s, r) => s + (r.valor_venda ?? 0), 0)

    const fbMetrics = extractFbMetrics(fbAll?.data)
    const adSpend   = fbMetrics.spend * 1.1215 // +12.15% imposto sobre anúncios
    const metaTax   = fbMetrics.spend * 0.1215 // só o imposto Meta
    const acquisitions = sales.length > 0 ? sales.length : fbMetrics.purchases

    // Lucro = Faturamento - taxa Monetizze 7.9% - Gasto com Ads (imposto incluso)
    const profit     = grossRevenue - (grossRevenue * 0.079) - adSpend
    const prevProfit = prevRevenue  - (prevRevenue  * 0.079)

    const currentKpis: KPIs = {
      grossRevenue,
      adSpend,
      metaTax,
      profit,
      sales: sales.length,
      roas: adSpend > 0 ? grossRevenue / adSpend : 0,
      cpa: acquisitions > 0 ? adSpend / acquisitions : 0,
      roi: adSpend > 0 ? ((grossRevenue - adSpend) / adSpend) * 100 : 0,
      fbPurchases: fbMetrics.purchases,
    }
    const prevKpisCalc: KPIs = {
      grossRevenue: prevRevenue,
      adSpend: 0, metaTax: 0, profit: prevProfit, sales: prevSalesArr.length, roas: 0, cpa: 0, roi: 0, fbPurchases: 0,
    }

    setKpis(currentKpis)
    setPrevKpis(prevKpisCalc)

    // ── Gráfico: receita diária (vendas) + gasto diário (Facebook) ──
    const revenueByDate: Record<string, number> = {}
    sales.forEach(s => {
      const d = s.data?.slice(0, 10) ?? ''
      if (d) revenueByDate[d] = (revenueByDate[d] ?? 0) + (s.valor_venda ?? 0)
    })

    const spendByDate: Record<string, number> = {}
    if (fbDaily?.data) {
      ;(fbDaily.data as Array<{ date_start: string; spend: string }>).forEach(row => {
        spendByDate[row.date_start] = (parseFloat(row.spend) || 0) * 1.1215
      })
    }

    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    // Exclui hoje só em períodos multi-dia (Facebook tem ~1 dia de delay no gasto).
    const noExclude = p === 'today' || p === 'yesterday' || p === 'custom'
    const allDates = [...new Set([...Object.keys(revenueByDate), ...Object.keys(spendByDate)])]
      .filter(d => noExclude || d < todayStr)
      .sort()

    const chartPoints: ChartPoint[] = allDates.slice(-30).map(d => ({
      date: d.slice(5),
      revenue: revenueByDate[d] ?? 0,
      spend: spendByDate[d] ?? 0,
    }))
    setChartData(chartPoints)

    // ── CPA × ROAS × Vendas (diário) ──
    if (fbDaily?.data) {
      const countByDate: Record<string, number> = {}
      sales.forEach(s => { if (s.data) countByDate[s.data] = (countByDate[s.data] ?? 0) + 1 })

      const dailyRows = (fbDaily.data as Array<Record<string, unknown>>)
        .filter(row => noExclude || (row.date_start as string) < todayStr)
        .map(row => {
          const dateStr = row.date_start as string
          const getAct = (key: string) => {
            const arr = (row.actions ?? []) as Array<{ action_type: string; value: string }>
            return parseFloat(arr.find(a => a.action_type === key)?.value ?? '0') || 0
          }
          const roas = (() => {
            const arr = (row.purchase_roas ?? []) as Array<{ value: string }>
            return parseFloat(arr[0]?.value ?? '0') || 0
          })()
          const purch = getAct('offsite_conversion.fb_pixel_purchase') || getAct('purchase') || getAct('omni_purchase')
          const spend = (parseFloat(row.spend as string) || 0) * 1.1215
          const cpa   = purch > 0 ? spend / purch : 0
          return { date: dateStr.slice(5), sales: countByDate[dateStr] ?? 0, roas, cpa }
        })
      setDailyMetrics(dailyRows)
    }

    // ── Funil de Conversão ──
    setFunnelData({ lpv: fbMetrics.landingPageViews, ic: fbMetrics.initiateCheckout, purchases: fbMetrics.purchases })

    // ── Pizza: utm_source ──
    const srcCount: Record<string, number> = {}
    sales.forEach(s => {
      const src = s.utm_source?.trim() || 'Orgânico'
      const label = src.toLowerCase().includes('instagram') || src.toLowerCase().includes('ig')
        ? 'Instagram'
        : src.toLowerCase().includes('facebook') || src.toLowerCase().includes('fb')
        ? 'Facebook'
        : src.toLowerCase().includes('google')
        ? 'Google'
        : src === 'Orgânico' ? 'Orgânico' : 'Outros'
      srcCount[label] = (srcCount[label] ?? 0) + 1
    })
    const srcColors: Record<string, string> = {
      Instagram: '#E4405F', Facebook: '#1877F2', Google: '#34A853', Orgânico: '#4DB848', Outros: '#7AA880',
    }
    const total = sales.length || 1
    const srcPoints: SourcePoint[] = Object.entries(srcCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name, value: Math.round((count / total) * 100), color: srcColors[name] ?? '#6C757D',
      }))
    setSourceData(srcPoints)

    // ── Vendas por Horário ──
    const hourCounts: Record<string, number> = {}
    for (let h = 0; h < 24; h++) hourCounts[String(h).padStart(2, '0')] = 0
    sales.forEach(s => {
      if (s.horario) { const hr = s.horario.slice(0, 2); hourCounts[hr] = (hourCounts[hr] ?? 0) + 1 }
    })
    // Monta em ordem 00→23 explicitamente (Object.entries ordena "10"-"23" antes de "00"-"09")
    const hourPoints: HourPoint[] = []
    for (let h = 0; h < 24; h++) { const k = String(h).padStart(2,'0'); hourPoints.push({ hour: k, count: hourCounts[k] ?? 0 }) }
    setHourData(hourPoints)

    // ── Vendas por Produto ──
    const prodCounts: Record<string, number> = {}
    sales.forEach(s => { if (s.produto_comprado) prodCounts[s.produto_comprado] = (prodCounts[s.produto_comprado] ?? 0) + 1 })
    const tot = sales.length || 1
    setProductData(Object.entries(prodCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, pct: (count / tot) * 100 })))

    // ── Vendas por Pagamento ──
    const payCounts: Record<string, number> = {}
    sales.forEach(s => {
      const m = (s.metodo_de_pagamento ?? '').toLowerCase()
      const key = m.includes('pix') ? 'PIX' : m.includes('cart') || m.includes('cred') ? 'Cartão' : m.includes('boleto') ? 'Boleto' : 'Outros'
      payCounts[key] = (payCounts[key] ?? 0) + 1
    })
    const PAY_COLORS: Record<string, string> = { PIX: '#4DB848', Cartão: '#C8900A', Boleto: '#D45820', Outros: '#7AA880' }
    setPaymentData(Object.entries(payCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, color: PAY_COLORS[name] ?? '#7AA880' })))

    // ── Vendas por Dia da Semana ──
    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    sales.forEach(s => { if (s.data) { const d = new Date(s.data + 'T12:00:00'); dayCounts[d.getDay()] = (dayCounts[d.getDay()] ?? 0) + 1 } })
    setWeekdayData([1, 2, 3, 4, 5, 6, 0].map(i => ({ day: DAYS[i], count: dayCounts[i] })))

    // ── Top campanhas ──
    if (fbCampaigns?.data) {
      const rows = (fbCampaigns.data as Array<Record<string, unknown>>)
        .map(c => {
          const ins = extractFbMetrics((c.insights as Record<string, unknown>)?.data as Record<string, unknown>[])
          return {
            id: c.id as string,
            name: c.name as string,
            status: c.status as string,
            spend: ins.spend,
            revenue: ins.revenue,
            roas: ins.roas,
            cpa: ins.cpa,
            purchases: ins.purchases,
          }
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
      setTopCampaigns(rows)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (period !== 'custom') fetchAll(period)
  }, [period, fetchAll])

  function applyCustom() {
    if (customStart && customEnd && customStart <= customEnd) {
      fetchAll('custom', customStart, customEnd)
    }
  }

  // ── Variation helpers ──
  const variation = (cur: number, prev: number): number | null => {
    if (period === 'maximum' || period === 'custom') return null
    if (prev === 0 && cur === 0) return null
    if (prev === 0) return cur > 0 ? 100 : -100
    return ((cur - prev) / prev) * 100
  }

  const metrics = kpis ? [
    { label: 'Faturamento Bruto', value: formatCurrency(kpis.grossRevenue), variation: variation(kpis.grossRevenue, prevKpis?.grossRevenue ?? 0) },
    { label: 'Gasto com Ads',     value: formatCurrency(kpis.adSpend),      variation: variation(kpis.adSpend, prevKpis?.adSpend ?? 0) },
    { label: 'Lucro',             value: formatCurrency(kpis.profit),       variation: variation(kpis.profit, prevKpis?.profit ?? 0) },
    { label: 'ROI',               value: `${kpis.roi.toFixed(1)}%`,         variation: variation(kpis.roi, prevKpis?.roi ?? 0) },
    { label: 'ROAS',              value: `${kpis.roas.toFixed(2)}x`,        variation: variation(kpis.roas, prevKpis?.roas ?? 0) },
    { label: 'CPA',               value: formatCurrency(kpis.cpa),          variation: kpis.cpa > 0 ? variation(kpis.cpa, prevKpis?.cpa ?? 0) : null },
    { label: 'Imposto Meta',      value: formatCurrency(kpis.metaTax),      variation: null },
    { label: 'Vendas',            value: formatNumber(kpis.sales),          variation: variation(kpis.sales, prevKpis?.sales ?? 0) },
    { label: 'Compras FB',        value: formatNumber(kpis.fbPurchases),    variation: null },
  ] : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#E0EEE0]">Visão Geral</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="maximum">Máximo</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
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
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
        {loading
          ? [...Array(9)].map((_, i) => <MetricCard key={i} label="" value="" variation={0} loading />)
          : metrics.map((m) => <MetricCard key={m.label} {...m} />)
        }
      </div>

      {/* CPA × ROAS × Vendas + Funil de Conversão */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CPA × ROAS × Vendas */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">CPA × ROAS × Vendas</CardTitle>
              <span className="text-[10px] text-[#4A6E52]">barras = vendas · linhas = métricas FB</span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : dailyMetrics.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#4A6E52] text-sm">
                {getSetting('facebook_token') ? 'Sem dados para o período.' : 'Conecte o Facebook Ads em Integrações.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={dailyMetrics} margin={{ top: 5, right: 50, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B3D20" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#7AA880', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="metrics" orientation="left" tick={{ fill: '#7AA880', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}x`} />
                  <YAxis yAxisId="sales" orientation="right" tick={{ fill: '#7AA880', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                  <Tooltip content={<ComboTooltip />} />
                  <Legend formatter={v => <span style={{ color: '#7AA880', fontSize: '12px' }}>{v}</span>} />
                  <Bar yAxisId="sales" dataKey="sales" name="Vendas" fill="#6C5CE7" fillOpacity={0.65} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="metrics" type="monotone" dataKey="roas" name="ROAS" stroke="#74B9FF" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line yAxisId="metrics" type="monotone" dataKey="cpa" name="CPA" stroke="#FF6B6B" strokeWidth={2} dot={false} activeDot={{ r: 4 }} hide={dailyMetrics.every(d => d.cpa === 0)} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Funil de Conversão */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Funil de Conversão</CardTitle>
              <span className="text-[10px] text-[#4A6E52]">clique → aprovado</span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : !funnelData || (funnelData.lpv === 0 && funnelData.ic === 0 && funnelData.purchases === 0) ? (
              <div className="h-64 flex items-center justify-center text-[#4A6E52] text-sm">
                {getSetting('facebook_token') ? 'Sem dados de funil.' : 'Conecte o Facebook Ads.'}
              </div>
            ) : (() => {
              const { lpv, ic, purchases } = funnelData
              const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—'
              const steps = [
                { label: 'Page View',         value: lpv,       pct: '100%',            bar: 100 },
                { label: 'Initiate Checkout',  value: ic,        pct: pct(ic, lpv),      bar: lpv > 0 ? (ic/lpv)*100 : 0 },
                { label: 'Purchase',           value: purchases, pct: pct(purchases, lpv), bar: lpv > 0 ? (purchases/lpv)*100 : 0 },
              ]
              const rates = [
                { label: 'Page View / Initiate Checkout',  value: pct(ic, lpv) },
                { label: 'Initiate Checkout / Purchase',    value: pct(purchases, ic) },
                { label: 'Page View / Purchase',            value: pct(purchases, lpv) },
              ]
              return (
                <div className="space-y-4">
                  {steps.map(s => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[#E0EEE0]">{s.label}</span>
                        <span className="text-[#7AA880]">{formatNumber(s.value)} · <span className="text-[#C8900A] font-semibold">{s.pct}</span></span>
                      </div>
                      <div className="h-1.5 bg-[#1B3D20] rounded-full overflow-hidden">
                        <div className="h-full bg-[#4DB848] rounded-full transition-all" style={{ width: `${Math.min(s.bar, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-[#1B3D20] pt-3 space-y-2">
                    {rates.map(r => (
                      <div key={r.label} className="flex items-center justify-between text-xs">
                        <span className="text-[#7AA880]">{r.label}</span>
                        <span className="text-[#C8900A] font-semibold">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Faturamento vs Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#4A6E52] text-sm">Sem dados para o período</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 45, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B3D20" />
                  <XAxis dataKey="date" tick={{ fill: '#7AA880', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="revenue" orientation="left"  tick={{ fill: '#C8900A', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="spend"   orientation="right" tick={{ fill: '#D45820', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v.toFixed(0)}`} width={55} />
                  <Tooltip content={<LineTooltip />} />
                  <Legend formatter={(v) => <span style={{ color: '#7AA880', fontSize: '12px' }}>{v}</span>} />
                  <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Faturamento" stroke="#C8900A" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  <Line yAxisId="spend"   type="monotone" dataKey="spend"   name="Gasto"       stroke="#D45820" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vendas por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : sourceData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#4A6E52] text-sm">Sem dados</div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {sourceData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {sourceData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[#7AA880]">{item.name}</span>
                      </div>
                      <span className="text-[#E0EEE0] font-medium">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vendas por Horário */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vendas por Horário</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-52 w-full" /> : hourData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-[#4A6E52] text-sm">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={hourData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B3D20" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: '#7AA880', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fill: '#7AA880', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="count" name="Vendas" fill="#4DB848" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Vendas por Produto · Pagamento · Dia da Semana */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vendas por Produto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vendas por Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : productData.length === 0 ? (
              <div className="py-10 text-center text-[#4A6E52] text-sm">Sem dados</div>
            ) : (
              productData.slice(0, 6).map((p, i) => {
                const colors = ['#4DB848', '#C8900A', '#D45820', '#7AA880', '#74B9FF', '#E4405F']
                return (
                  <div key={p.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-[#E0EEE0] truncate max-w-[180px]" title={p.name}>{p.name}</span>
                      <span className="text-[#7AA880] ml-2 flex-shrink-0">{p.pct.toFixed(1)}% · {p.count}</span>
                    </div>
                    <div className="h-1.5 bg-[#1B3D20] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${p.pct}%`, backgroundColor: colors[i] ?? '#7AA880' }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Vendas por Pagamento */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vendas por Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52 w-full" /> : paymentData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-[#4A6E52] text-sm">Sem dados</div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={3} dataKey="value">
                      {paymentData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
                  {paymentData.map(p => (
                    <div key={p.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-[#7AA880]">{p.name}</span>
                      <span className="text-[#E0EEE0] font-medium">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendas por Dia da Semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vendas por Dia da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52 w-full" /> : weekdayData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-[#4A6E52] text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={weekdayData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B3D20" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#7AA880', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7AA880', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="count" name="Vendas" fill="#C8900A" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top campaigns */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top Campanhas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : topCampaigns.length === 0 ? (
            <div className="px-6 py-10 text-center text-[#4A6E52] text-sm">
              {getSetting('facebook_token') ? 'Sem dados de campanha para o período.' : 'Conecte o Facebook Ads em Integrações.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1B3D20]">
                    {['Campanha', 'Gasto', 'Receita', 'ROAS', 'Compras', 'CPA', 'Status'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#7AA880] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((c, i) => (
                    <tr key={c.id} className={`border-b border-[#1B3D20]/50 hover:bg-[#142918]/50 transition-colors ${i === topCampaigns.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-[#E0EEE0] font-medium truncate max-w-[220px]">{c.name}</p>
                      </td>
                      <td className="px-4 py-3 text-[#7AA880] whitespace-nowrap">{formatCurrency(c.spend)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[#C8900A] font-medium">{c.revenue > 0 ? formatCurrency(c.revenue) : '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-semibold ${c.roas >= 3 ? 'text-[#4DB848]' : c.roas > 0 ? 'text-[#C8900A]' : 'text-[#4A6E52]'}`}>
                          {c.roas > 0 ? `${c.roas.toFixed(2)}x` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#7AA880] whitespace-nowrap">{c.purchases > 0 ? formatNumber(c.purchases) : '—'}</td>
                      <td className="px-4 py-3 text-[#7AA880] whitespace-nowrap">{c.cpa > 0 ? formatCurrency(c.cpa) : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.status === 'ACTIVE' ? 'active' : 'paused'}>
                          {c.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
