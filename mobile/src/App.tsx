import { NavLink, Route, HashRouter as Router, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Queue from './pages/Queue'
import Scan from './pages/Scan'
import './App.css'

export default function App() {
  return (
    <Router>
      <main className="app-shell">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/queue" element={<Queue />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Home
        </NavLink>
        <NavLink to="/scan" className={({ isActive }) => (isActive ? 'active' : '')}>
          Scan
        </NavLink>
        <NavLink to="/queue" className={({ isActive }) => (isActive ? 'active' : '')}>
          Queue
        </NavLink>
      </nav>
    </Router>
  )
}
