import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import Rebalance from './pages/Rebalance'
import Analysis from './pages/Analysis'
import Roadmap from './pages/Roadmap'
import InvestmentPlans from './pages/InvestmentPlans'
import MacroEvents from './pages/MacroEvents'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="assets" element={<Assets />} />
          <Route path="rebalance" element={<Rebalance />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="plans" element={<InvestmentPlans />} />
          <Route path="events" element={<MacroEvents />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App
