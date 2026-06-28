import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Megaphone, ShoppingCart, Plug, Settings, X, Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/campaigns', icon: Megaphone, label: 'Campanhas' },
  { to: '/sales', icon: ShoppingCart, label: 'Vendas' },
  { to: '/integrations', icon: Plug, label: 'Integrações' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/70 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-full w-64 bg-[#0A1C0E] border-r border-[#1B3D20] flex flex-col transition-transform duration-300',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#1B3D20]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4DB848] to-[#2D7A30] flex items-center justify-center shadow-lg shadow-[#4DB848]/20">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[#E0EEE0] font-bold text-sm leading-tight">Restart</p>
              <p className="text-[#7AA880] text-xs">Intestinal · Ads</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-[#7AA880] hover:text-[#E0EEE0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => { if (window.innerWidth < 1024) onClose() }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[#4DB848]/15 text-[#4DB848] border border-[#4DB848]/30'
                    : 'text-[#7AA880] hover:text-[#E0EEE0] hover:bg-[#142918]'
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#1B3D20]">
          <div className="bg-[#081208] rounded-lg p-3 text-xs text-[#7AA880]">
            <p className="font-semibold text-[#4DB848] mb-0.5">Restart Intestinal</p>
            <p>Painel de Rastreamento</p>
          </div>
        </div>
      </aside>
    </>
  )
}
