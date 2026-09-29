import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Feeding from './pages/Feeding'
import Diapers from './pages/Diapers'
import Growth from './pages/Growth'
import Checklist from './pages/Checklist'
import Settings from './pages/Settings'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/feeding" element={<Feeding />} />
          <Route path="/diapers" element={<Diapers />} />
          <Route path="/growth" element={<Growth />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
