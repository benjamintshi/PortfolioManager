import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Coins,
  Scale,
  LineChart,
  Map,
  ClipboardList,
  CalendarDays,
} from 'lucide-react'

const navigation = [
  { name: '总览', href: '/', icon: LayoutDashboard },
  { name: '资产管理', href: '/assets', icon: Coins },
  { name: '再平衡', href: '/rebalance', icon: Scale },
  { name: '分析报告', href: '/analysis', icon: LineChart },
  { name: '路线图', href: '/roadmap', icon: Map },
  { name: '投资计划', href: '/plans', icon: ClipboardList },
  { name: '宏观事件', href: '/events', icon: CalendarDays },
]

export default function Header() {
  return (
    <header className="glass-strong fixed top-0 right-0 left-0 z-50 h-16">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-[var(--arena-space-page)]">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2">
          <span className="text-xl">💼</span>
          <span className="text-gradient-primary text-lg font-bold tracking-wider">
            PORTFOLIO
          </span>
        </NavLink>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) =>
                  `relative rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'text-neutral-50'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-lg bg-primary-soft"
                        style={{ zIndex: -1 }}
                      />
                    )}
                    <Icon className="w-4 h-4 inline mr-1.5" strokeWidth={1.75} />
                    {item.name}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Right slot (reserved) */}
        <div className="flex items-center gap-3" />
      </div>
    </header>
  )
}
