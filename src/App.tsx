import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import Sales from './pages/Sales'
import Integrations from './pages/Integrations'
import Settings from './pages/Settings'
import { syncSettings } from './lib/supabase'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    syncSettings().finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#061409] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#4DB848] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
