import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import DashboardPage from './pages/DashboardPage.jsx';
import JobsPage from './pages/JobsPage.jsx';
import KanbanPage from './pages/KanbanPage.jsx';
import AddJobPage from './pages/AddJobPage.jsx';
import GmailPage from './pages/GmailPage.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/jobs', label: 'Applications', icon: '☰' },
  { to: '/kanban', label: 'Kanban', icon: '⊞' },
  { to: '/gmail', label: 'Gmail Sync', icon: '✉' },
];

function Sidebar({ mobile, onClose }) {
  return (
    <aside className={`flex flex-col bg-gray-900 border-r border-gray-800 ${mobile ? 'fixed inset-y-0 left-0 z-50 w-64' : 'w-60 min-h-screen hidden md:flex'}`}>
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white tracking-tight">💼 JobTrack</h1>
        <p className="text-xs text-gray-500 mt-0.5">Application Dashboard</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              }`
            }
          >
            <span className="text-lg">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <NavLink
          to="/jobs/new"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full btn-primary text-sm"
        >
          + Add Job
        </NavLink>
      </div>
    </aside>
  );
}

function MobileHeader({ onMenuOpen }) {
  const location = useLocation();
  const current = NAV.find(n => n.to === location.pathname) || { label: 'Dashboard' };
  return (
    <header className="md:hidden sticky top-0 z-40 bg-gray-950 border-b border-gray-800 flex items-center px-4 h-14">
      <button onClick={onMenuOpen} className="text-gray-400 hover:text-white mr-3">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <span className="font-semibold text-white">💼 {current.label}</span>
    </header>
  );
}

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMenuOpen(false)} />
          <Sidebar mobile onClose={() => setMenuOpen(false)} />
        </>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader onMenuOpen={() => setMenuOpen(true)} />
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/new" element={<AddJobPage />} />
            <Route path="/jobs/:id/edit" element={<AddJobPage />} />
            <Route path="/kanban" element={<KanbanPage />} />
            <Route path="/gmail" element={<GmailPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
