import { useState, useEffect, useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const ITEMS_PER_PAGE = 15

type DatePreset = 'today' | 'yesterday' | '7d' | '14d' | '30d' | 'this_month' | 'last_month' | 'maximum' | 'custom'

interface VendaRow {
  id: number
  data: string
  horario: string
  plano_produto: string
  nome_do_comprador: string
  email: string
  celular: string
  produto_comprado: string
  cod_do_produto: string | null
  valor_venda: number
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
  utm_term: string
  src: string
  metodo_de_pagamento: string
}

function getDateRange(preset: DatePreset, cs?: string, ce?: string): { start: string | null; end: string | null } {
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const sub = (d: Date, days: number) => { const r = new Date(d); r.setDate(r.getDate() - days); return r }
  const today = new Date()

  if (preset === 'today')      return { start: fmt(today),          end: fmt(today) }
  if (preset === 'yesterday')  return { start: fmt(sub(today, 1)),  end: fmt(sub(today, 1)) }
  if (preset === '7d')         return { start: fmt(sub(today, 7)),  end: fmt(today) }
  if (preset === '14d')        return { start: fmt(sub(today, 14)), end: fmt(today) }
  if (preset === '30d')        return { start: fmt(sub(today, 30)), end: fmt(today) }
  if (preset === 'this_month') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1)
    return { start: fmt(s), end: fmt(today) }
  }
  if (preset === 'last_month') {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const e = new Date(today.getFullYear(), today.getMonth(), 0)
    return { start: fmt(s), end: fmt(e) }
  }
  if (preset === 'custom') return { start: cs ?? null, end: ce ?? null }
  return { start: null, end: null } // maximum
}

function PaymentBadge({ method }: { method: string }) {
  const m = (method ?? '').toLowerCase()
  const isPix  = m.includes('pix')
  const isCard = m.includes('cart')
  const cls = isPix
    ? 'bg-[#C8900A]/20 text-[#C8900A] border-[#C8900A]/30'
    : isCard
    ? 'bg-[#74B9FF]/20 text-[#74B9FF] border-[#74B9FF]/30'
    : 'bg-gray-500/20 text-[#7AA880] border-gray-500/30'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>
      {method || '—'}
    </span>
  )
}

function SourceBadge({ source }: { source: string }) {
  if (!source) return <span className="text-[#4A6E52] text-xs">—</span>
  const s = source.toLowerCase()
  const cls = s.includes('instagram') || s.includes('ig')
    ? 'bg-pink-500/20 text-pink-400 border-pink-500/30'
    : s.includes('facebook') || s.includes('fb')
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-gray-500/20 text-[#7AA880] border-gray-500/30'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold max-w-[120px] truncate ${cls}`} title={source}>
      {source}
    </span>
  )
}

export default function Sales() {
  const [allSales, setAllSales]   = useState<VendaRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState<DatePreset>('maximum')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd]     = useState('')

  const [search, setSearch]                 = useState('')
  const [paymentFilter, setPaymentFilter]   = useState('all')
  const [productFilter, setProductFilter]   = useState('all')
  const [page, setPage]                     = useState(1)

  const fetchSales = useCallback(async (preset: DatePreset, cs?: string, ce?: string) => {
    setLoading(true)
    setError(null)
    const { start, end } = getDateRange(preset, cs, ce)

    let query = supabase
      .from('vendas')
      .select('*')
      .order('data', { ascending: false })
      .order('horario', { ascending: false })

    if (start) query = query.gte('data', start)
    if (end)   query = query.lte('data', end)

    const { data, error: err } = await query
    if (err) { setError(err.message); setLoading(false); return }
    setAllSales((data ?? []) as VendaRow[])
    setLoading(false)
  }, [])

  useEffect(() => { if (datePreset !== 'custom') fetchSales(datePreset) }, [datePreset, fetchSales])

  function applyCustom() {
    if (customStart && customEnd && customStart <= customEnd) {
      setPage(1)
      fetchSales('custom', customStart, customEnd)
    }
  }

  const uniquePayments = [...new Set(allSales.map(s => s.metodo_de_pagamento).filter(Boolean))]
  const uniqueProducts  = [...new Set(allSales.map(s => s.produto_comprado).filter(Boolean))]

  const filtered = allSales.filter((s) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !search ||
      s.nome_do_comprador?.toLowerCase().includes(q) ||
      s.produto_comprado?.toLowerCase().includes(q) ||
      s.utm_campaign?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    const matchesPayment = paymentFilter === 'all' || s.metodo_de_pagamento === paymentFilter
    const matchesProduct  = productFilter === 'all'  || s.produto_comprado === productFilter
    return matchesSearch && matchesPayment && matchesProduct
  })

  const totalPages   = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated    = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  const totalRevenue = filtered.reduce((acc, s) => acc + (s.valor_venda ?? 0), 0)

  const resetPage = (fn: () => void) => { fn(); setPage(1) }

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#E0EEE0]">Vendas</h1>
          <p className="text-sm text-[#7AA880] mt-0.5">
            {loading ? 'Carregando...' : (
              <>
                {filtered.length} {filtered.length === 1 ? 'venda' : 'vendas'} ·{' '}
                Total: <span className="text-[#C8900A] font-semibold">{formatCurrency(totalRevenue)}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date preset */}
          <Select value={datePreset} onValueChange={v => resetPage(() => setDatePreset(v as DatePreset))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="14d">Últimos 14 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
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

          <div className="relative">
            <Input
              placeholder="Buscar comprador, produto..."
              value={search}
              onChange={(e) => resetPage(() => setSearch(e.target.value))}
              className="w-52"
            />
          </div>

          <Select value={productFilter} onValueChange={(v) => resetPage(() => setProductFilter(v))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Produtos</SelectItem>
              {uniqueProducts.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paymentFilter} onValueChange={(v) => resetPage(() => setPaymentFilter(v))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Pagamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Métodos</SelectItem>
              {uniquePayments.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 bg-[#D45820]/10 border border-[#D45820]/30 rounded-lg p-4 text-sm text-[#D45820]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Erro ao buscar vendas: {error}</span>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1B3D20] bg-[#081208]">
                      {['Data', 'Comprador', 'Produto', 'Plano', 'Valor', 'Pagamento', 'Campanha', 'Origem', 'Conjunto'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#7AA880] uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-[#7AA880]">
                          {error ? 'Não foi possível carregar os dados.' : 'Nenhuma venda encontrada.'}
                        </td>
                      </tr>
                    ) : (
                      paginated.map((sale, i) => (
                        <tr
                          key={sale.id}
                          className={`border-b border-[#1B3D20]/50 hover:bg-[#142918]/40 transition-colors ${i === paginated.length - 1 ? 'border-0' : ''}`}
                        >
                          <td className="px-4 py-3 text-[#7AA880] whitespace-nowrap text-xs">
                            <div>{sale.data ?? '—'}</div>
                            {sale.horario && <div className="text-[#4A6E52]">{sale.horario.slice(0, 5)}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[#E0EEE0] font-medium truncate max-w-[150px] text-sm">{sale.nome_do_comprador || '—'}</p>
                            <p className="text-[#4A6E52] text-xs truncate max-w-[150px]">{sale.email || ''}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-200 truncate max-w-[150px] text-xs">{sale.produto_comprado || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[#7AA880] truncate max-w-[130px] text-xs">{sale.plano_produto || '—'}</p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-[#C8900A] font-semibold">{formatCurrency(sale.valor_venda ?? 0)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <PaymentBadge method={sale.metodo_de_pagamento} />
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[#7AA880] truncate max-w-[140px] text-xs" title={sale.utm_campaign}>
                              {sale.utm_campaign || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <SourceBadge source={sale.utm_source} />
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[#7AA880] truncate max-w-[130px] text-xs" title={sale.utm_content}>
                              {sale.utm_content || '—'}
                            </p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#1B3D20]">
                  <p className="text-xs text-[#7AA880]">
                    {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length} vendas
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2 h-8 rounded text-xs text-[#7AA880] hover:bg-[#142918] disabled:opacity-30"
                    >
                      ←
                    </button>
                    {[...Array(Math.min(totalPages, 8))].map((_, i) => {
                      const p = i + 1
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded text-xs font-medium transition-colors ${page === p ? 'bg-[#C8900A] text-[#E0EEE0]' : 'text-[#7AA880] hover:bg-[#142918]'}`}
                        >
                          {p}
                        </button>
                      )
                    })}
                    {totalPages > 8 && <span className="text-[#4A6E52] text-xs px-1">…{totalPages}</span>}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-2 h-8 rounded text-xs text-[#7AA880] hover:bg-[#142918] disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
