import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function Layout() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-16">
        <Outlet />
      </main>
      <footer className="relative border-t border-white/5 mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-8 flex items-center justify-between text-xs text-neutral-500">
          <span>Portfolio Manager v1.0.0</span>
          <span>Powered by React + Vite</span>
        </div>
      </footer>
    </div>
  )
}
