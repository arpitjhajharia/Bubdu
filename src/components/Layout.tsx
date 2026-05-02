import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Milk, Baby, Pill, Scale, Eye, ClipboardList } from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/feeding', icon: Milk, label: 'Feeding' },
  { to: '/diapers', icon: Baby, label: 'Diapers' },
  { to: '/medicines', icon: Pill, label: 'Meds' },
  { to: '/weight', icon: Scale, label: 'Weight' },
  { to: '/nazar', icon: Eye, label: 'Daily' },
  { to: '/reports', icon: ClipboardList, label: 'Reports' },
]

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto">
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-purple-100 safe-bottom z-50">
        <div className="flex">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-purple-700' : 'text-gray-400'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
