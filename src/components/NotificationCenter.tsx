import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getDB, markAllNotificationsAsRead, clearNotifications } from '../lib/store';
import { AppNotification } from '../types';
import { Bell, X, Check, Trash2, AlertCircle, AlertTriangle, ShieldAlert, Clock, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync state with local database
  const syncNotifications = () => {
    const db = getDB();
    setNotifications(db.notifications || []);
  };

  useEffect(() => {
    syncNotifications();
    window.addEventListener('db_updated', syncNotifications);

    // Click outside to close panel
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Request desktop notification permission on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    return () => {
      window.removeEventListener('db_updated', syncNotifications);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen to cross-tab updates using BroadcastChannel
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('shop_attendance_notifications');
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'new_notification') {
          const newNotif = event.data.notification as AppNotification;
          
          // Set active toast for visual popup
          setActiveToast(newNotif);
          // Sync with db since it was updated by the other tab
          syncNotifications();

          // Auto-clear toast after 5 seconds
          setTimeout(() => {
            setActiveToast(prev => prev?.id === newNotif.id ? null : prev);
          }, 5000);
        }
      };

      channel.addEventListener('message', handleMessage);
      return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
      };
    } catch (err) {
      console.warn('BroadcastChannel not supported or failed to initialize:', err);
    }
  }, []);

  // Handle local toast for the active session (if triggered in this tab)
  useEffect(() => {
    // We listen to custom event to show a toast alert for actions triggered in the SAME tab
    const handleLocalNotification = (e: Event) => {
      const db = getDB();
      const latest = db.notifications?.[0];
      if (latest) {
        setActiveToast(latest);
        setTimeout(() => {
          setActiveToast(prev => prev?.id === latest.id ? null : prev);
        }, 5000);
      }
    };
    window.addEventListener('db_updated', handleLocalNotification);
    return () => {
      window.removeEventListener('db_updated', handleLocalNotification);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    syncNotifications();
  };

  const handleClearAll = () => {
    clearNotifications();
    syncNotifications();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'failed_geofence':
        return <AlertCircle className="text-red-500" size={16} />;
      case 'failed_gps':
        return <AlertTriangle className="text-amber-500" size={16} />;
      case 'failed_blocked':
        return <ShieldAlert className="text-rose-500" size={16} />;
      case 'late':
        return <Clock className="text-indigo-500" size={16} />;
      default:
        return <Info className="text-blue-500" size={16} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'failed_geofence':
        return 'bg-red-50 border-red-100 hover:bg-red-100/50';
      case 'failed_gps':
        return 'bg-amber-50 border-amber-100 hover:bg-amber-100/50';
      case 'failed_blocked':
        return 'bg-rose-50 border-rose-100 hover:bg-rose-100/50';
      case 'late':
        return 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100/50';
      default:
        return 'bg-blue-50 border-blue-100 hover:bg-blue-100/50';
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Trigger Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 transition shadow-sm text-gray-600 hover:text-gray-900"
        title="Real-Time Compliance Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="notification-panel"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Compliance & Timing Alerts</h3>
                <p className="text-[10px] text-gray-500">Real-time geofence & schedule tracking</p>
              </div>
              <div className="flex gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="p-1 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition text-xs font-bold flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <Check size={14} />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 transition"
                    title="Clear all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 transition flex items-start gap-3 border-l-4 ${
                      notif.read ? 'border-transparent bg-white hover:bg-gray-50' : 'border-indigo-500 bg-indigo-50/20'
                    }`}
                  >
                    <div className="mt-0.5">{getNotificationIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {notif.employeeName}
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Shop: <span className="font-semibold text-gray-700">{notif.shopName}</span>
                      </p>
                      <p className="text-xs text-gray-600 font-medium mt-1 leading-relaxed bg-white/70 border border-gray-100 rounded-lg p-2 shadow-sm">
                        {notif.details}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 px-4 text-center text-gray-500 flex flex-col items-center">
                  <Bell className="text-gray-300 mb-2 animate-bounce" size={32} />
                  <p className="text-xs font-bold">No active compliance alerts</p>
                  <p className="text-[10px] text-gray-400 mt-1 max-w-xs">
                    Failed geofence or late check-in attempts will be reported in real-time here.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time Dynamic Floating Toast Alert Popup */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            id="notification-toast"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Decorative colored top accent bar */}
            <div className={`h-1.5 w-full ${
              activeToast.type === 'late' ? 'bg-indigo-500' : 'bg-rose-500'
            }`} />
            
            <div className="p-4 flex gap-3">
              <div className="mt-1 p-2 bg-slate-50 border border-gray-200 rounded-xl h-10 w-10 flex items-center justify-center">
                {getNotificationIcon(activeToast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {activeToast.type === 'late' ? '⚠️ Late Attendance Alert' : '🚨 Geofence/GPS Alert'}
                  </span>
                  <button
                    onClick={() => setActiveToast(null)}
                    className="text-gray-400 hover:text-gray-600 p-0.5 rounded-lg hover:bg-gray-100 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
                <h4 className="text-sm font-bold text-gray-900 mt-1">
                  {activeToast.employeeName}
                </h4>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Location: <span className="font-semibold text-gray-700">{activeToast.shopName}</span>
                </p>
                <p className="text-xs text-gray-700 font-medium bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 mt-2 shadow-inner">
                  {activeToast.details}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
