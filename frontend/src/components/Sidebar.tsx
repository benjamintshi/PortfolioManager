import { NavLink } from 'react-router-dom'
import { 
  PieChart,
  Wallet,
  BarChart3,
  TrendingUp,
  Target
} from 'lucide-react'

const navigation = [
  {
    name: '总览',
    href: '/',
    icon: PieChart,
    description: '投资组合概览'
  },
  {
    name: '资产管理',
    href: '/assets',
    icon: Wallet,
    description: '管理您的资产'
  },
  {
    name: '再平衡',
    href: '/rebalance',
    icon: Target,
    description: '配比调整建议'
  },
  {
    name: '分析报告',
    href: '/analysis',
    icon: BarChart3,
    description: '深度数据分析'
  },
  {
    name: '📋 路线图',
    href: '/roadmap',
    icon: Target,
    description: '配置计划与执行'
  }
]

export default function Sidebar() {
  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo区域 */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">Portfolio</h1>
            <p className="text-xs text-muted-foreground">Manager</p>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`
              }
            >
              <Icon className="mr-3 flex-shrink-0 h-5 w-5" />
              <div className="flex-1">
                <div>{item.name}</div>
                <div className="text-xs opacity-70 mt-0.5">
                  {item.description}
                </div>
              </div>
            </NavLink>
          )
        })}
      </nav>

      {/* 状态信息 */}
      <div className="p-4 border-t border-border">
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-foreground">系统状态</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>后端连接</span>
              <span className="text-green-500">正常</span>
            </div>
            <div className="flex justify-between">
              <span>最后更新</span>
              <span>2分钟前</span>
            </div>
          </div>
        </div>
        
        <div className="mt-3 text-center">
          <div className="text-xs text-muted-foreground">
            Portfolio Manager v1.0.0
          </div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            © 2024 StarBlue
          </div>
        </div>
      </div>
    </div>
  )
}