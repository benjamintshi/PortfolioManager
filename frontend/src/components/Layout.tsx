import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <Sidebar />
      
      {/* 主内容区域 */}
      <main className="flex-1 overflow-auto">
        <div className="h-full p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}