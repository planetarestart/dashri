import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Leaf } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou senha incorretos.')
    } else {
      navigate('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#061409] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4DB848] to-[#2D7A30] flex items-center justify-center shadow-lg shadow-[#4DB848]/20 mb-4">
            <Leaf className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-[#E0EEE0] font-bold text-xl leading-tight">Restart Intestinal</h1>
          <p className="text-[#7AA880] text-sm mt-1">Painel de Rastreamento</p>
        </div>

        {/* Card */}
        <div className="bg-[#0D2114] border border-[#1B3D20] rounded-2xl p-6">
          <h2 className="text-[#E0EEE0] font-semibold text-base mb-5">Entrar na sua conta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[#7AA880] text-sm block mb-1.5">E-mail</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-[#061409] border-[#1B3D20] text-[#E0EEE0] placeholder:text-[#3D6642] focus:border-[#4DB848] focus:ring-[#4DB848]/20"
              />
            </div>

            <div>
              <label className="text-[#7AA880] text-sm block mb-1.5">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-[#061409] border-[#1B3D20] text-[#E0EEE0] placeholder:text-[#3D6642] focus:border-[#4DB848] focus:ring-[#4DB848]/20"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4DB848] hover:bg-[#3DA038] text-white font-medium"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
