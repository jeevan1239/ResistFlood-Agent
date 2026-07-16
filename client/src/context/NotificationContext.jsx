import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import { socket } from '../socket.js';
import api from '../api/axios.js';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    // Fetch initial logs
    api.get('/api/admin/logs?limit=20')
      .then(res => res.data)
      .then(data => {
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      })
      .catch(err => console.error('Failed to fetch initial logs', err));

    const handleNotification = (newLog) => {
      setNotifications(prev => [newLog, ...prev]);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [user]);

  const unreadCount = notifications.length; // We can improve unread logic later

  return (
    <NotificationContext.Provider value={{ notifications, isOpen, setIsOpen, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
