import { useNotifications } from '../context/NotificationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff } from 'lucide-react';

export default function NotificationCenter() {
  const { user } = useAuth();
  const { notifications, isOpen, setIsOpen } = useNotifications();

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <>
      {/* Bell Button */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-medium w-4 h-4 rounded-full flex items-center justify-center">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="absolute top-14 right-4 w-80 bg-white/70 backdrop-blur-2xl border border-gray-200/50 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-200/50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Notifications</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500">
                <BellOff className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-700">No notifications</p>
                <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map(notif => (
                  <li key={notif._id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-blue-600">{notif.eventType.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{notif.description}</p>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
