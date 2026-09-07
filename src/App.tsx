import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import Sales from './pages/Sales'
import Financial from './pages/Financial'
import Integrations from './pages/Integrations'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { supabase, syncSettings } from './lib/supabase'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        syncSettings().finally(() => setReady(true))
      } else {
        setReady(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
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
        <Route
          path="/login"
          element={session ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/"
          element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
        />
        {session ? (
          <Route element={<Layout />}>
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/campaigns"    element={<Campaigns />} />
            <Route path="/sales"        element={<Sales />} />
            <Route path="/financial"    element={<Financial />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/settings"     element={<Settings />} />
          </Route>
        ) : null}
        <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
