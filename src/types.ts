export type Role = 'admin' | 'manager';

export interface Shop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  deviceId: string;
  capacity?: number;
}

export interface Employee {
  id: string;
  name: string;
  shopId: string;
  wageType: 'monthly' | 'daily' | 'hourly';
  wageAmount: number;
  facePhotoUrl?: string;
  shiftStart?: string; // e.g. "09:00"
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  shopId: string;
  timestamp: number;
  type: 'check-in' | 'check-out';
  lat: number | null;
  lng: number | null;
  photoUrl?: string;
  synced: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  actorRole: Role;
  actorId?: string; // manager id or admin
  action: string;
  details: string;
  lat?: number;
  lng?: number;
  deviceTimestamp?: string;
  attemptStatus?: 'success' | 'failed';
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  baseSalaryAmount: number;
  overtimeAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  netSalary: number;
  status: 'draft' | 'approved';
}

export interface AppNotification {
  id: string;
  timestamp: number;
  type: 'failed_geofence' | 'failed_gps' | 'failed_blocked' | 'late';
  employeeName: string;
  employeeId: string;
  shopName: string;
  shopId: string;
  details: string;
  read: boolean;
}

