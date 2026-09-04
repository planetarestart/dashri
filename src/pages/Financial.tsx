import { useState, useEffect, useCallback, ElementType } from 'react'
import { TrendingDown, TrendingUp, DollarSign, Package, Truck, Percent } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { supabase, getSetting } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const FRETE_POR_VENDA   = 32
const CUSTO_POR_KIT     = 32
const TAXA_MONETIZZE    = 0.049
const IMPOSTO_META_RATE = 0.1215

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'yesterday' | '7d' | '30d' | 'maximum' | 'custom'

interface VendaRow {
  valor_venda: number
  data: string
  plano_produto: string
  produto_comprado: string
}

interface FinancialKPIs {
  grossRevenue: number
  numSales: number
  numKits: number
  monetizzeFee: number
  adSpend: number
  metaTax: number
  freteCost: number
  produtoCost: number
  totalCosts: number
  lucroLiquido: number
  margem: number
}

interface MonthlyPoint { mes: string; receita: number; custos: number; lucro: number }
interface ProductCost { produto: string; vendas: number; kits: number; frete: number; custo: number; total: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string
const SB_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function fetchAllVendas(start: string, end: string): Promise<VendaRow[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SB_KEY
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${token}` }
  const all: VendaRow[] = []
  let offset = 0
  while (true) {
    const qs = new URLSearchParams()
    qs.set('select', 'valor_venda,data,plano_produto,produto_comprado')
    qs.set('limit', '1000')
    qs.set('offset', String(offset))
    if (start !== '2020-01-01') qs.append('data', `gte.${start}`)
    qs.append('data', `lte.${end}`)
    const res  = await fetch(`${SB_URL}/rest/v1/vendas?${qs}`, { headers })
    const page: VendaRow[] = await res.json()
    if (!Array.isArray(page) || page.length === 0) break
    all.push(...page)
    if (page.length < 1000) break
    offset += 1000
  }
  return all
}

function parseKits(plano: string): number {
  const match = (plano ?? '').match(/^(\d+)/)
  return match ? parseInt(match[1]) : 1
}

function getPeriodDates(period: Period, cs?: string, ce?: string) {
  const today = new Date()
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const sub = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() - n); return r }
  if (period === 'today')     return { start: fmt(today),        end: fmt(today) }
  if (period === 'yesterday') return { start: fmt(sub(today,1)), end: fmt(sub(today,1)) }
  if (period === '7d')        return { start: fmt(sub(today,7)), end: fmt(today) }
  if (period === '30d')       return { start: fmt(sub(today,30)),end: fmt(today) }
  if (period === 'custom' && cs && ce) return { start: cs, end: ce }
  return { start: '2020-01-01', end: fmt(today) }
}

const FB_PRESET: Record<Exclude<Period,'custom'>, string> = {
  today: 'today', yesterday: 'yesterday', '7d': 'last_7d', '30d': 'last_30d', maximum: 'maximum',
}
const INSIGHT_FIELDS = 'spend'

function fmtPct(n: number) { return `${n.toFixed(1)}%` }

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color = '#4DB848', loading }: {
  icon: ElementType; label: string; value: string; sub?: string
  color?: string; loading?: boolean
}) {
  if (loading) return (
    <Card><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-32 mb-1" /><Skeleton className="h-3 w-20" /></CardContent></Card>
  )
  return (
    <Card className="hover:border-[#4DB848]/30 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] text-[#7AA880] font-semibold uppercase tracking-wider leading-tight">{label}</span>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
        </div>
        <p className="text-lg font-bold text-[#E0EEE0] leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-[#7AA880] mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D2114] border border-[#1B3D20] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-[#7AA880] mb-2">{label}</p>
      {payload.map(e => (
        <div key={e.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-[#7AA880]">{e.name}:</span>
          <span className="text-[#E0EEE0] font-semibold">{formatCurrency(e.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Financial() {
  const [period, setPeriod]     = useState<Period>('maximum')
  const [loading, setLoading]   = useState(true)
  const [kpis, setKpis]         = useState<FinancialKPIs | null>(null)
  const [monthly, setMonthly]   = useState<MonthlyPoint[]>([])
  const [byCost, setByCost]     = useState<{ name: string; value: number; color: string }[]>([])
  const [byProduct, setByProduct] = useState<ProductCost[]>([])
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd]     = useState('')

  const fetchAll = useCallback(async (p: Period, cs?: string, ce?: string) => {
    setLoading(true)
    const { start, end } = getPeriodDates(p, cs, ce)
    const token  = getSetting('facebook_token')
    const accId  = getSetting('facebook_ad_account_id')

    const [vendas, fbRes] = await Promise.all([
      fetchAllVendas(start, end),
      (token && accId)
        ? fetch(`https://graph.facebook.com/v19.0/act_${accId}/insights?fields=${INSIGHT_FIELDS}&date_preset=${FB_PRESET[p as Exclude<Period,'custom'>] ?? 'maximum'}&access_token=${token}`).then(r => r.json()).catch(() => null)
        : Promise.resolve(null),
    ])

    const grossRevenue = vendas.reduce((s, r) => s + (r.valor_venda ?? 0), 0)
    const numSales     = vendas.length
    const numKits      = vendas.reduce((s, r) => s + parseKits(r.plano_produto), 0)

    const fbSpend      = parseFloat(fbRes?.data?.[0]?.spend ?? '0') || 0
    const adSpend      = fbSpend * 1.1215
    const metaTax      = fbSpend * IMPOSTO_META_RATE

    const monetizzeFee = grossRevenue * TAXA_MONETIZZE
    const freteCost    = numSales * FRETE_POR_VENDA
    const produtoCost  = numKits  * CUSTO_POR_KIT
    const totalCosts   = monetizzeFee + adSpend + freteCost + produtoCost
    const lucroLiquido = grossRevenue - totalCosts
    const margem       = grossRevenue > 0 ? (lucroLiquido / grossRevenue) * 100 : 0

    setKpis({ grossRevenue, numSales, numKits, monetizzeFee, adSpend, metaTax, freteCost, produtoCost, totalCosts, lucroLiquido, margem })

    // Composição dos custos (para gráfico de barras)
    setByCost([
      { name: 'Gateway (4.9%)', value: monetizzeFee, color: '#C8900A' },
      { name: 'Ads + Imposto', value: adSpend,      color: '#D45820' },
      { name: 'Frete',         value: freteCost,    color: '#74B9FF' },
      { name: 'Produto',       value: produtoCost,  color: '#A29BFE' },
    ])

    // Evolução mensal
    const byMonth: Record<string, { receita: number; custos: number }> = {}
    vendas.forEach(v => {
      const mes = v.data?.slice(0, 7) ?? ''
      if (!mes) return
      if (!byMonth[mes]) byMonth[mes] = { receita: 0, custos: 0 }
      const kits  = parseKits(v.plano_produto)
      byMonth[mes].receita += v.valor_venda ?? 0
      byMonth[mes].custos  += (v.valor_venda * TAXA_MONETIZZE) + FRETE_POR_VENDA + (kits * CUSTO_POR_KIT)
    })
    const monthlyPoints: MonthlyPoint[] = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, d]) => ({ mes, receita: d.receita, custos: d.custos, lucro: d.receita - d.custos }))
    setMonthly(monthlyPoints)

    // Custos por produto
    const prodMap: Record<string, { vendas: number; kits: number }> = {}
    vendas.forEach(v => {
      const key = v.produto_comprado?.trim() || 'Sem produto'
      if (!prodMap[key]) prodMap[key] = { vendas: 0, kits: 0 }
      prodMap[key].vendas++
      prodMap[key].kits += parseKits(v.plano_produto)
    })
    setByProduct(
      Object.entries(prodMap)
        .sort(([,a],[,b]) => b.vendas - a.vendas)
        .map(([produto, d]) => ({
          produto,
          vendas:  d.vendas,
          kits:    d.kits,
          frete:   d.vendas * FRETE_POR_VENDA,
          custo:   d.kits   * CUSTO_POR_KIT,
          total:   d.vendas * FRETE_POR_VENDA + d.kits * CUSTO_POR_KIT,
        }))
    )

    setLoading(false)
  }, [])

  useEffect(() => {
    if (period !== 'custom') fetchAll(period)
  }, [period, fetchAll])

  function applyCustom() {
    if (customStart && customEnd && customStart <= customEnd) fetchAll('custom', customStart, customEnd)
  }

  // ─── Linhas do DRE ──────────────────────────────────────────────────────────
  const dreLines = kpis ? [
    { label: '(+) Faturamento Bruto',           value: kpis.grossRevenue,  pct: 100,                                             color: '#4DB848',  bold: true  },
    { label: '(−) Taxa Gateway Monetizze 4,9%', value: -kpis.monetizzeFee, pct: -(kpis.monetizzeFee / kpis.grossRevenue) * 100,  color: '#C8900A',  bold: false },
    { label: '(−) Gasto Ads + Imposto Meta',    value: -kpis.adSpend,      pct: -(kpis.adSpend / kpis.grossRevenue) * 100,       color: '#D45820',  bold: false },
    { label: '(−) Custo de Frete',              value: -kpis.freteCost,    pct: -(kpis.freteCost / kpis.grossRevenue) * 100,     color: '#74B9FF',  bold: false },
    { label: '(−) Custo de Produto',            value: -kpis.produtoCost,  pct: -(kpis.produtoCost / kpis.grossRevenue) * 100,   color: '#A29BFE',  bold: false },
    { label: '(=) Lucro Líquido',               value: kpis.lucroLiquido,  pct: kpis.margem,                                     color: kpis.lucroLiquido >= 0 ? '#4DB848' : '#E74C3C', bold: true },
  ] : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#E0EEE0]">Financeiro</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
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
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="h-9 px-3 rounded-md border border-[#1B3D20] bg-[#081208] text-[#E0EEE0] text-sm focus:outline-none focus:ring-1 focus:ring-[#4DB848]" />
              <span className="text-[#7AA880] text-sm">até</span>
              <input type="date" value={customEnd} min={customStart} onChange={e => setCustomEnd(e.target.value)}
                className="h-9 px-3 rounded-md border border-[#1B3D20] bg-[#081208] text-[#E0EEE0] text-sm focus:outline-none focus:ring-1 focus:ring-[#4DB848]" />
              <button onClick={applyCustom} disabled={!customStart || !customEnd || customStart > customEnd}
                className="h-9 px-4 rounded-md bg-[#4DB848] text-white text-sm font-medium hover:bg-[#3da038] disabled:opacity-40 transition-colors">
                Aplicar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard loading={loading} icon={DollarSign}   label="Faturamento Bruto"  value={kpis ? formatCurrency(kpis.grossRevenue) : '—'} sub={`${kpis?.numSales ?? 0} vendas`} color="#4DB848" />
        <KpiCard loading={loading} icon={TrendingDown}  label="Total de Custos"    value={kpis ? formatCurrency(kpis.totalCosts)   : '—'} sub={kpis ? fmtPct((kpis.totalCosts / kpis.grossRevenue) * 100) + ' da receita' : ''} color="#D45820" />
        <KpiCard loading={loading} icon={TrendingUp}    label="Lucro Líquido"      value={kpis ? formatCurrency(kpis.lucroLiquido) : '—'} sub={kpis ? `Margem ${fmtPct(kpis.margem)}` : ''} color={kpis && kpis.lucroLiquido >= 0 ? '#4DB848' : '#E74C3C'} />
        <KpiCard loading={loading} icon={Percent}       label="Margem Líquida"     value={kpis ? fmtPct(kpis.margem) : '—'} color="#74B9FF" />
        <KpiCard loading={loading} icon={Truck}         label="Custo Frete Total"  value={kpis ? formatCurrency(kpis.freteCost)   : '—'} sub={`R$${FRETE_POR_VENDA} × ${kpis?.numSales ?? 0} vendas`} color="#74B9FF" />
        <KpiCard loading={loading} icon={Package}       label="Custo Produto Total" value={kpis ? formatCurrency(kpis.produtoCost) : '—'} sub={`R$${CUSTO_POR_KIT} × ${kpis?.numKits ?? 0} kits`} color="#A29BFE" />
      </div>

      {/* DRE + Composição Custos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DRE */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Demonstrativo de Resultado</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{[...Array(6)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div>
                {dreLines.map((line, i) => (
                  <div key={i} className={`flex items-center justify-between px-6 py-3 ${i < dreLines.length - 1 ? 'border-b border-[#1B3D20]/50' : 'border-t-2 border-[#1B3D20] bg-[#0A1E10]'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: line.color }} />
                      <span className={`text-sm ${line.bold ? 'font-bold text-[#E0EEE0]' : 'text-[#B0C8B4]'}`}>{line.label}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-xs text-[#4A6E52] w-16 text-right">{fmtPct(line.pct)}</span>
                      <span className={`text-sm font-semibold w-32 text-right ${line.bold ? '' : 'text-[#B0C8B4]'}`} style={{ color: line.bold ? line.color : undefined }}>
                        {formatCurrency(Math.abs(line.value))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composição dos Custos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Composição dos Custos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : byCost.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#4A6E52] text-sm">Sem dados</div>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={byCost} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B3D20" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#7AA880', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#7AA880', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Custo']} contentStyle={{ background: '#0D2114', border: '1px solid #1B3D20', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#7AA880' }} itemStyle={{ color: '#E0EEE0' }} />
                    <Bar dataKey="value" radius={[4,4,0,0]}>
                      {byCost.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {byCost.map(c => (
                    <div key={c.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-[#7AA880]">{c.name}</span>
                      </div>
                      <span className="text-[#E0EEE0] font-medium">{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evolução Mensal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução Mensal — Receita vs Custos vs Lucro</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : monthly.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-[#4A6E52] text-sm">Sem dados para o período</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthly} margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B3D20" />
                <XAxis dataKey="mes" tick={{ fill: '#7AA880', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7AA880', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={v => <span style={{ color: '#7AA880', fontSize: '12px' }}>{v}</span>} />
                <Line type="monotone" dataKey="receita" name="Receita"  stroke="#4DB848" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="custos"  name="Custos"   stroke="#D45820" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="lucro"   name="Lucro"    stroke="#74B9FF" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Custos por Produto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Custos por Produto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : byProduct.length === 0 ? (
            <div className="px-6 py-10 text-center text-[#4A6E52] text-sm">Sem dados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1B3D20]">
                    {['Produto','Vendas','Kits','Frete (R$32×vnd)','Produto (R$32×kit)','Total Custo Variável'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#7AA880] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byProduct.map((p, i) => (
                    <tr key={p.produto} className={`border-b border-[#1B3D20]/50 hover:bg-[#142918]/50 transition-colors ${i === byProduct.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3 text-[#E0EEE0] font-medium max-w-[200px] truncate">{p.produto}</td>
                      <td className="px-4 py-3 text-[#7AA880] whitespace-nowrap">{p.vendas}</td>
                      <td className="px-4 py-3 text-[#7AA880] whitespace-nowrap">{p.kits}</td>
                      <td className="px-4 py-3 text-[#74B9FF] whitespace-nowrap">{formatCurrency(p.frete)}</td>
                      <td className="px-4 py-3 text-[#A29BFE] whitespace-nowrap">{formatCurrency(p.custo)}</td>
                      <td className="px-4 py-3 font-semibold text-[#C8900A] whitespace-nowrap">{formatCurrency(p.total)}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-[#0A1E10] border-t-2 border-[#1B3D20]">
                    <td className="px-4 py-3 text-[#E0EEE0] font-bold">TOTAL</td>
                    <td className="px-4 py-3 text-[#7AA880] font-bold">{byProduct.reduce((s,p) => s + p.vendas, 0)}</td>
                    <td className="px-4 py-3 text-[#7AA880] font-bold">{byProduct.reduce((s,p) => s + p.kits, 0)}</td>
                    <td className="px-4 py-3 text-[#74B9FF] font-bold">{formatCurrency(byProduct.reduce((s,p) => s + p.frete, 0))}</td>
                    <td className="px-4 py-3 text-[#A29BFE] font-bold">{formatCurrency(byProduct.reduce((s,p) => s + p.custo, 0))}</td>
                    <td className="px-4 py-3 text-[#C8900A] font-bold">{formatCurrency(byProduct.reduce((s,p) => s + p.total, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
