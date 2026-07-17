import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Map as MapIcon, Activity, Users, ShieldAlert, FileText, HeartPulse } from 'lucide-react';

const ITEMS = [
  { id: 'reports', name: 'Reports', icon: FileText, route: '/report' },
  { id: 'danger', name: 'Danger Zones', icon: ShieldAlert, route: '/map' },
  { id: 'rescue', name: 'Rescue Tasks', icon: HeartPulse, route: '/rescue' },
  { id: 'users', name: 'Users / Admin', icon: Users, route: '/admin?tab=Overview' },
  { id: 'health', name: 'System Health', icon: Activity, route: '/admin?tab=Health' },
  { id: 'logs', name: 'Activity Logs', icon: FileText, route: '/admin?tab=Activity' },
];

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const filtered = ITEMS.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    let focusTimer;
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      focusTimer = setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => (i + 1) % (filtered.length || 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => (i - 1 + (filtered.length || 1)) % (filtered.length || 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          navigate(filtered[activeIndex].route);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, filtered, navigate, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center px-4 border-b border-gray-100/50">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full px-4 py-4 text-gray-800 bg-transparent outline-none placeholder-gray-400"
                placeholder="Search commands and pages..."
              />
              <span className="text-xs font-mono text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">ESC</span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No results found.</div>
              ) : (
                filtered.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => { navigate(item.route); onClose(); }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                      idx === activeIndex ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100/50'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${idx === activeIndex ? 'text-blue-200' : 'text-gray-400'}`} />
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
