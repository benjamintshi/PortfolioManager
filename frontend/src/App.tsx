import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Holdings from './pages/Holdings'
import Allocation from './pages/Allocation'
import Market from './pages/Market'

function App() {
  return (
    <div className="min-h-full flex flex-col relative">
      {/* Ambient background */}
      <div className="arena-ambient">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="arena-grid" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-full">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="holdings" element={<Holdings />} />
            <Route path="allocation" element={<Allocation />} />
            <Route path="market" element={<Market />} />
          </Route>
        </Routes>
      </div>
    </div>
  )
}

export default App
