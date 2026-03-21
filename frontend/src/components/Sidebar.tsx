import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Coins,
  Scale,
  LineChart,
  Map,
  ClipboardList,
  CalendarDays
} from 'lucide-react'

const navigation = [
  {
    name: '总览',
    href: '/',
    icon: LayoutDashboard,
    description: '投资组合概览'
  },
  {
    name: '资产管理',
    href: '/assets',
    icon: Coins,
    description: '管理您的资产'
  },
  {
    name: '再平衡',
    href: '/rebalance',
    icon: Scale,
    description: '配比调整建议'
  },
  {
    name: '分析报告',
    href: '/analysis',
    icon: LineChart,
    description: '风险指标与相关性'
  },
  {
    name: '路线图',
    href: '/roadmap',
    icon: Map,
    description: '配置计划与执行'
  },
  {
    name: '投资计划',
    href: '/plans',
    icon: ClipboardList,
    description: '分批建仓与执行跟踪'
  },
  {
    name: '宏观事件',
    href: '/events',
    icon: CalendarDays,
    description: '跟踪影响市场的关键事件'
  }
]

export default function Sidebar() {
  return (
    <div className="w-64 bg-card/80 border-r border-border/60 flex flex-col backdrop-blur-sm">
      {/* Logo区域 */}
      <div className="p-5 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
            <LayoutDashboard className="w-5 h-5 text-primary" strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-semibold text-base text-foreground tracking-tight">Portfolio</h1>
            <p className="text-xs text-muted-foreground font-medium">Manager</p>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`
              }
            >
              <Icon className="flex-shrink-0 w-5 h-5" strokeWidth={1.75} />
              <div className="flex-1 min-w-0">
                <div>{item.name}</div>
                <div className="text-xs text-muted-foreground/80 mt-0.5 truncate">
                  {item.description}
                </div>
              </div>
            </NavLink>
          )
        })}
      </nav>

      {/* 状态信息 */}
      <div className="p-3 border-t border-border/60">
        <div className="rounded-xl bg-secondary/40 p-3 ring-1 ring-border/40">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-foreground">系统状态</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>后端连接</span>
              <span className="text-emerald-400">正常</span>
            </div>
            <div className="flex justify-between">
              <span>最后更新</span>
              <span>2分钟前</span>
            </div>
          </div>
        </div>
        <div className="mt-3 text-center">
          <div className="text-xs text-muted-foreground/80">Portfolio Manager v1.0.0</div>
          <div className="text-xs text-muted-foreground/60 mt-0.5">© 2024 StarBlue</div>
        </div>
      </div>
    </div>
  )
}