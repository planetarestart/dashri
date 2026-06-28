export type SaleStatus = 'approved' | 'pending' | 'refunded'
export type SaleType = 'paid' | 'organic'
export type CheckoutPlatform = 'Monetizze' | 'Hotmart' | 'Kiwify' | 'Kirvano'
export type CampaignStatus = 'active' | 'paused'

export interface MetricCard {
  label: string
  value: string
  rawValue: number
  variation: number
  prefix?: string
  suffix?: string
}

export interface Ad {
  id: string
  name: string
  status: CampaignStatus
  spend: number
  sales: number
  revenue: number
  impressions: number
  clicks: number
  cpm: number
  cpc: number
  ctr: number
  roi: number
  roas: number
  cpa: number
}

export interface AdSet {
  id: string
  name: string
  status: CampaignStatus
  spend: number
  sales: number
  revenue: number
  impressions: number
  clicks: number
  cpm: number
  cpc: number
  ctr: number
  roi: number
  roas: number
  cpa: number
  ads: Ad[]
}

export interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  spend: number
  sales: number
  revenue: number
  impressions: number
  clicks: number
  cpm: number
  cpc: number
  ctr: number
  roi: number
  roas: number
  cpa: number
  adSets: AdSet[]
}

export interface Sale {
  id: string
  date: string
  product: string
  value: number
  checkout: CheckoutPlatform
  campaign: string
  adSet: string
  ad: string
  status: SaleStatus
  type: SaleType
}

export interface ChartDataPoint {
  date: string
  revenue: number
  spend: number
}

export interface SourceData {
  name: string
  value: number
  color: string
}

export interface Tax {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  appliesTo: 'revenue' | 'commission'
}

export interface Settings {
  appName: string
  timezone: string
  currency: string
  facebookToken: string
  facebookAdAccountId: string
  facebookAdAccountName: string
  lastFbSync: string
}
