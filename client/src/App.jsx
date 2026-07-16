import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Map from './pages/Map.jsx';
import Report from './pages/Report.jsx';
import Rescue from './pages/Rescue.jsx';
import Admin from './pages/Admin.jsx';
import { NotificationProvider, useNotifications } from './context/NotificationContext.jsx';
import NotificationCenter from './components/NotificationCenter.jsx';
import CommandPalette from './components/CommandPalette.jsx';

function GlobalShortcuts() {
  const navigate = useNavigate();
  const { setIsOpen } = useNotifications();
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      const tagName = e.target.tagName.toLowerCase();
      const isInput = tagName === 'input' || tagName === 'textarea' || e.target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
        return;
      }

      if (e.key === 'Escape') {
        setCmdOpen(false);
        setIsOpen(false);
        return;
      }

      if (isInput) return;

      switch (e.key.toLowerCase()) {
        case 'g': navigate('/map'); break;
        case 'r': navigate('/rescue'); break;
        case 'a': navigate('/admin'); break;
        case 'n': setIsOpen((o) => !o); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, setIsOpen]);

  return <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />;
}

function Nav() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-700 text-white' : 'text-blue-700 hover:bg-blue-50'
    }`;

  // Framer motion variants for subtle tap feedback
  const tapVariant = { scale: 0.96 };
  const springTransition = { type: "spring", bounce: 0, duration: 0.3 };

  return (
    <nav className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 px-6 py-3 flex items-center gap-2 flex-wrap shadow-sm">
      <motion.div whileTap={tapVariant} transition={springTransition}>
        <NavLink to="/" end className={linkClass}>Home</NavLink>
      </motion.div>
      <motion.div whileTap={tapVariant} transition={springTransition}>
        <NavLink to="/map" className={linkClass}>Map</NavLink>
      </motion.div>
      <motion.div whileTap={tapVariant} transition={springTransition}>
        <NavLink to="/report" className={linkClass}>Report</NavLink>
      </motion.div>
      <motion.div whileTap={tapVariant} transition={springTransition}>
        <NavLink to="/rescue" className={linkClass}>Rescue</NavLink>
      </motion.div>
      <motion.div whileTap={tapVariant} transition={springTransition}>
        <NavLink to="/admin" className={linkClass}>Admin</NavLink>
      </motion.div>
      <span className="flex-1" />
      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user.name}</span>
          <motion.button
            whileTap={tapVariant}
            transition={springTransition}
            onClick={logout}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Sign out
          </motion.button>
        </div>
      ) : (
        <motion.div whileTap={tapVariant} transition={springTransition}>
          <NavLink to="/login" className={linkClass}>Login</NavLink>
        </motion.div>
      )}
      <NotificationCenter />
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <GlobalShortcuts />
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/map" element={<Map />} />
          <Route path="/report" element={<Report />} />
          <Route path="/rescue" element={<Rescue />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}
