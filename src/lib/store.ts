import { Shop, Employee, AttendanceRecord, PayrollRecord, AuditLog, AppNotification } from '../types';

const DB_KEY = 'attendance_app_db';

interface DBState {
  shops: Shop[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  payroll: PayrollRecord[];
  auditLogs: AuditLog[];
  notifications: AppNotification[];
}

const defaultState: DBState = {
  shops: [
    {
      id: 'shop-1',
      name: 'Main Branch',
      lat: 37.7749,
      lng: -122.4194,
      radius: 100,
      deviceId: 'demo-shop-phone-001',
    },
    {
      id: 'shop-2',
      name: 'Downtown Branch',
      lat: 37.7849,
      lng: -122.4094,
      radius: 100,
      deviceId: 'demo-shop-phone-002',
    },
    {
      id: 'shop-3',
      name: 'Uptown Branch',
      lat: 37.7949,
      lng: -122.4294,
      radius: 100,
      deviceId: 'demo-shop-phone-003',
    },
  ],
  employees: [
    {
      id: 'emp-1',
      name: 'Alice Worker',
      shopId: 'shop-1',
      wageType: 'monthly',
      wageAmount: 3000,
    },
    {
      id: 'emp-2',
      name: 'Bob Staff',
      shopId: 'shop-1',
      wageType: 'hourly',
      wageAmount: 15,
    },
    {
      id: 'emp-3',
      name: 'Charlie Smith',
      shopId: 'shop-2',
      wageType: 'daily',
      wageAmount: 100,
    },
    {
      id: 'emp-4',
      name: 'Diana Prince',
      shopId: 'shop-3',
      wageType: 'monthly',
      wageAmount: 3500,
    },
  ],
  attendance: [],
  payroll: [],
  auditLogs: [],
  notifications: [],
};

export const getDB = (): DBState => {
  try {
    const data = localStorage.getItem(DB_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (!parsed.notifications) parsed.notifications = [];
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse DB from localStorage', e);
  }
  setDB(defaultState);
  return defaultState;
};

export const setDB = (state: DBState) => {
  localStorage.setItem(DB_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event('db_updated'));
};

export const saveAttendance = (record: AttendanceRecord) => {
  const db = getDB();
  db.attendance.push(record);
  setDB(db);
};

export const getEmployeesForShop = (shopId: string) => {
  const db = getDB();
  return db.employees.filter((e) => e.shopId === shopId);
};

export const getTodayAttendance = (employeeId: string) => {
  const db = getDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return db.attendance.filter(
    (a) => a.employeeId === employeeId && a.timestamp >= today.getTime()
  );
};

export const addAuditLog = (
  actorRole: 'admin' | 'manager', 
  action: string, 
  details: string, 
  actorId?: string, 
  lat?: number, 
  lng?: number,
  deviceTimestamp?: string,
  attemptStatus?: 'success' | 'failed'
) => {
  const db = getDB();
  db.auditLogs = db.auditLogs || [];
  db.auditLogs.push({
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    actorRole,
    actorId,
    action,
    details,
    lat,
    lng,
    deviceTimestamp,
    attemptStatus
  });
  setDB(db);
};

export const addAppNotification = (
  type: 'failed_geofence' | 'failed_gps' | 'failed_blocked' | 'late',
  employeeName: string,
  employeeId: string,
  shopName: string,
  shopId: string,
  details: string
) => {
  const db = getDB();
  db.notifications = db.notifications || [];
  
  const notification: AppNotification = {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    type,
    employeeName,
    employeeId,
    shopName,
    shopId,
    details,
    read: false
  };

  db.notifications.unshift(notification);
  if (db.notifications.length > 100) {
    db.notifications = db.notifications.slice(0, 100);
  }
  setDB(db);

  // Broadcast the notification cross-tab
  try {
    const channel = new BroadcastChannel('shop_attendance_notifications');
    channel.postMessage({ type: 'new_notification', notification });
    channel.close();
  } catch (err) {
    console.warn('BroadcastChannel error:', err);
  }

  // Native desktop push notification
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        const title = type === 'late' ? '⚠️ Late Check-in Alert' : '🚨 Failed Attendance Alert';
        new Notification(title, {
          body: `${employeeName} at ${shopName}: ${details}`,
        });
      } catch (e) {
        console.warn('Desktop notification error:', e);
      }
    }
  }
};

export const markAllNotificationsAsRead = () => {
  const db = getDB();
  db.notifications = (db.notifications || []).map(n => ({ ...n, read: true }));
  setDB(db);
};

export const clearNotifications = () => {
  const db = getDB();
  db.notifications = [];
  setDB(db);
};

