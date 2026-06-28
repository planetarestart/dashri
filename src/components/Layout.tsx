import { useState, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { Toaster } from './ui/toaster'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = useNavigate()

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setRefreshKey(k => k + 1)
    setTimeout(() => setRefreshing(false), 800)
  }, [])

  return (
    <div className="flex h-screen bg-[#061409] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          <Outlet key={refreshKey} context={{ navigate }} />
        </main>
      </div>

      <Toaster />
    </div>
  )
}
