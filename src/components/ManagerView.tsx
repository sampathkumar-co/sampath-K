import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { format } from 'date-fns';
import { Camera, MapPin, CheckCircle, LogOut, RefreshCcw, ArrowLeft, Clock, Wifi, WifiOff, CloudOff } from 'lucide-react';
import { getDB, getEmployeesForShop, getTodayAttendance, saveAttendance, setDB, addAuditLog, addAppNotification } from '../lib/store';
import { Employee, AttendanceRecord } from '../types';
import { getDistanceInMeters } from '../lib/utils';
import NotificationCenter from './NotificationCenter';

export default function ManagerView() {
  const navigate = useNavigate();
  const shopId = localStorage.getItem('auth_shop_id') || 'shop-1';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [step, setStep] = useState<'list' | 'camera' | 'success'>('list');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shopName, setShopName] = useState('Shop');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  const webcamRef = React.useRef<Webcam>(null);

  useEffect(() => {
    // Check auth
    if (localStorage.getItem('auth_role') !== 'manager') {
      navigate('/');
    }
    
    const db = getDB();
    const currentShop = db.shops.find(s => s.id === shopId);
    if (currentShop) {
      setShopName(currentShop.name);
    }
    
    const updateSyncStatus = () => {
      const currentDb = getDB();
      const shopAttendance = currentDb.attendance.filter(a => a.shopId === shopId);
      const unsynced = shopAttendance.filter(a => !a.synced).length;
      setUnsyncedCount(unsynced);
    };

    setEmployees(getEmployeesForShop(shopId));
    updateSyncStatus();

    const reloadDBData = () => {
      const currentDb = getDB();
      const shop = currentDb.shops.find(s => s.id === shopId);
      if (shop) {
        setShopName(shop.name);
      }
      setEmployees(getEmployeesForShop(shopId));
      updateSyncStatus();
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('db_updated', reloadDBData);
    // Also set up an interval to check unsynced count in case it changes
    const interval = setInterval(updateSyncStatus, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('db_updated', reloadDBData);
      clearInterval(interval);
    };
  }, [navigate, shopId]);

  const handleSelectEmployee = (emp: Employee) => {
    setError('');
    setSelectedEmployee(emp);
    setStep('camera');
    
    // Request GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (err) => {
          console.warn("GPS error:", err);
          // We won't block MVP entirely on GPS failure, but we could.
        }
      );
    }
  };

  const captureAndSubmit = () => {
    if (!selectedEmployee) return;
    setLoading(true);
    
    const photoSrc = webcamRef.current?.getScreenshot();
    
    // Determine check-in or check-out
    const todayRecords = getTodayAttendance(selectedEmployee.id);
    const hasCheckedIn = todayRecords.some(r => r.type === 'check-in');
    const hasCheckedOut = todayRecords.some(r => r.type === 'check-out');
    const currentShop = getDB().shops.find(s => s.id === shopId);

    if (hasCheckedIn && hasCheckedOut) {
      setError('Employee has already checked out for today.');
      addAuditLog(
        'manager',
        'Attendance Attempt Blocked',
        `Attempted check-in/out for employee ${selectedEmployee.name} (${selectedEmployee.id}) but employee already checked out today.`,
        shopId,
        location?.lat || undefined,
        location?.lng || undefined,
        new Date().toISOString(),
        'failed'
      );
      addAppNotification(
        'failed_blocked',
        selectedEmployee.name,
        selectedEmployee.id,
        currentShop?.name || 'Unknown Shop',
        shopId,
        'Attempted attendance but employee has already checked out for today.'
      );
      setLoading(false);
      return;
    }

    const type = hasCheckedIn ? 'check-out' : 'check-in';

    if (!location) {
      setError('GPS location is required for attendance.');
      addAuditLog(
        'manager',
        'Attendance Attempt Failed',
        `Attempted ${type} for employee ${selectedEmployee.name} (${selectedEmployee.id}) but GPS was unavailable or disabled.`,
        shopId,
        undefined,
        undefined,
        new Date().toISOString(),
        'failed'
      );
      addAppNotification(
        'failed_gps',
        selectedEmployee.name,
        selectedEmployee.id,
        currentShop?.name || 'Unknown Shop',
        shopId,
        'GPS location unavailable or disabled.'
      );
      setLoading(false);
      return;
    }
    if (currentShop) {
      const dist = getDistanceInMeters(location.lat, location.lng, currentShop.lat, currentShop.lng);
      if (dist > currentShop.radius) {
        setError(`You are ${Math.round(dist)}m away from the shop. Must be within ${currentShop.radius}m to check in.`);
        addAuditLog(
          'manager',
          'Attendance Geofence Violation',
          `Attempted ${type} for employee ${selectedEmployee.name} (${selectedEmployee.id}) but was out of bounds (${Math.round(dist)}m away, radius: ${currentShop.radius}m).`,
          shopId,
          location.lat,
          location.lng,
          new Date().toISOString(),
          'failed'
        );
        addAppNotification(
          'failed_geofence',
          selectedEmployee.name,
          selectedEmployee.id,
          currentShop.name,
          shopId,
          `Geofence Violation: User checked in ${Math.round(dist)}m away from shop (limit is ${currentShop.radius}m).`
        );
        setLoading(false);
        return;
      }
    }

    const isLate = (shiftStartStr?: string): boolean => {
      if (!shiftStartStr) return false;
      const parts = shiftStartStr.split(':');
      if (parts.length !== 2) return false;
      const shiftHours = parseInt(parts[0], 10);
      const shiftMinutes = parseInt(parts[1], 10);
      if (isNaN(shiftHours) || isNaN(shiftMinutes)) return false;

      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      if (currentHours > shiftHours) return true;
      if (currentHours === shiftHours && currentMinutes > shiftMinutes) return true;
      return false;
    };

    const isEmployeeLate = type === 'check-in' && isLate(selectedEmployee.shiftStart || '09:00');

    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: selectedEmployee.id,
      shopId,
      timestamp: Date.now(),
      type,
      lat: location?.lat || null,
      lng: location?.lng || null,
      photoUrl: photoSrc || undefined,
      synced: false, // Simulating offline queue, would sync via effect later
    };

    setTimeout(() => {
      saveAttendance(record);
      addAuditLog(
        'manager', 
        'Attendance Recorded', 
        `${type.toUpperCase()} recorded successfully for employee ${selectedEmployee.name} (${selectedEmployee.id})`, 
        shopId, 
        location?.lat || undefined, 
        location?.lng || undefined,
        new Date(record.timestamp).toISOString(),
        'success'
      );

      if (isEmployeeLate) {
        addAppNotification(
          'late',
          selectedEmployee.name,
          selectedEmployee.id,
          currentShop?.name || 'Unknown Shop',
          shopId,
          `Late check-in recorded at ${format(new Date(record.timestamp), 'hh:mm a')} (Scheduled shift start: ${selectedEmployee.shiftStart || '09:00'}).`
        );
      }

      setLoading(false);
      setStep('success');
      setTimeout(() => {
        setStep('list');
        setSelectedEmployee(null);
      }, 2000);
    }, 800);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleSync = () => {
    if (!isOnline) return;
    const currentDb = getDB();
    let syncedCount = 0;
    currentDb.attendance = currentDb.attendance.map(a => {
      if (a.shopId === shopId && !a.synced) {
        syncedCount++;
        return { ...a, synced: true };
      }
      return a;
    });
    
    if (syncedCount > 0) {
      setDB(currentDb);
      addAuditLog('manager', 'Synced Attendance', `Synced ${syncedCount} records for shop ${shopId}`, shopId);
      // Hacky way to trigger re-render and re-calculate
      setEmployees([...getEmployeesForShop(shopId)]);
      // Need to recount
      const shopAttendance = currentDb.attendance.filter(a => a.shopId === shopId);
      const unsynced = shopAttendance.filter(a => !a.synced).length;
      setUnsyncedCount(unsynced);
    }
  };

  if (step === 'camera') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <button onClick={() => setStep('list')} className="p-2">
            <ArrowLeft />
          </button>
          <h2 className="text-lg font-semibold">{selectedEmployee?.name} Attendance</h2>
          <div className="w-8" />
        </div>
        
        <div className="flex-1 relative flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-sm rounded-lg overflow-hidden border-2 border-gray-700 bg-gray-900 aspect-[3/4]">
            {/* @ts-ignore */}
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="absolute inset-0 w-full h-full object-cover"
              videoConstraints={{ facingMode: "user" }}
            />
            {location && (
              <div className="absolute bottom-4 left-4 bg-black/50 text-xs px-2 py-1 rounded backdrop-blur flex items-center">
                <MapPin size={12} className="mr-1" /> GPS Active
              </div>
            )}
          </div>
          
          {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
          
          <button
            onClick={captureAndSubmit}
            disabled={loading}
            className="mt-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-6 shadow-lg transform active:scale-95 transition"
          >
            <Camera size={32} />
          </button>
          <p className="mt-4 text-gray-400 text-sm">
            {getTodayAttendance(selectedEmployee?.id || '').some(r => r.type === 'check-in') 
              ? 'Capture Check-out' 
              : 'Capture Check-in'}
          </p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle size={64} className="text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Success!</h2>
        <p className="text-gray-600 mt-2">Attendance recorded for {selectedEmployee?.name}.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{shopName} Attendance</h1>
          <p className="text-xs text-gray-500">{format(new Date(), 'EEEE, MMM do')}</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center text-xs font-medium">
            {!isOnline ? (
              <span className="flex items-center text-red-500 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                <WifiOff size={12} className="mr-1" /> Offline
              </span>
            ) : unsyncedCount > 0 ? (
              <button onClick={handleSync} className="flex items-center text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-100 hover:bg-yellow-100 active:scale-95 transition">
                <CloudOff size={12} className="mr-1" /> {unsyncedCount} Pending (Tap to Sync)
              </button>
            ) : (
              <span className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                <Wifi size={12} className="mr-1" /> Online
              </span>
            )}
          </div>
          <NotificationCenter />
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        <div className="mb-6 flex justify-between items-end">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Select Staff</h2>
          <button className="text-blue-600 text-sm flex items-center" onClick={() => setEmployees([...getEmployeesForShop(shopId)])}>
            <RefreshCcw size={14} className="mr-1" /> Refresh
          </button>
        </div>

        <div className="space-y-3">
          {employees.map(emp => {
            const todayRecords = getTodayAttendance(emp.id);
            const checkIn = todayRecords.find(r => r.type === 'check-in');
            const checkOut = todayRecords.find(r => r.type === 'check-out');
            
            let statusText = 'Not checked in';
            let statusColor = 'text-gray-500';
            
            if (checkOut) {
              statusText = `Checked out at ${format(new Date(checkOut.timestamp), 'h:mm a')}`;
              statusColor = 'text-green-600';
            } else if (checkIn) {
              statusText = `Checked in at ${format(new Date(checkIn.timestamp), 'h:mm a')}`;
              statusColor = 'text-blue-600';
            }

            return (
              <button
                key={emp.id}
                onClick={() => handleSelectEmployee(emp)}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold mr-4">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{emp.name}</h3>
                    <p className={`text-sm flex items-center mt-1 ${statusColor}`}>
                      <Clock size={12} className="mr-1" /> {statusText}
                    </p>
                  </div>
                </div>
                <div className="text-gray-400">
                  <Camera size={20} />
                </div>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  );
}
