import { useLocation } from 'react-router-dom'
import { Menu, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  onMenuClick: () => void
  onRefresh: () => void
  refreshing: boolean
}

const routeNames: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/campaigns':   'Campanhas',
  '/sales':       'Vendas',
  '/integrations':'Integrações',
  '/settings':    'Configurações',
}

export function Header({ onMenuClick, onRefresh, refreshing }: HeaderProps) {
  const location = useLocation()
  const pageName = routeNames[location.pathname] ?? 'Dashboard'

  return (
    <header className="h-16 bg-[#0A1C0E] border-b border-[#1B3D20] flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-[#7AA880] hover:text-[#E0EEE0] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm text-[#7AA880]">
          <span>Restart Intestinal</span>
          <span className="text-[#1B3D20]">/</span>
          <span className="text-[#E0EEE0] font-medium">{pageName}</span>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">Atualizar</span>
      </Button>
    </header>
  )
}
