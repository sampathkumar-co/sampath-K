import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { LogOut, Users, MapPin, Building, FileText, Settings, Plus, Minus, CheckCircle, RefreshCcw, Activity, UserPlus, Clock, ShieldAlert, BadgeInfo, Download, Trash2 } from 'lucide-react';
import { getDB, setDB, addAuditLog } from '../lib/store';
import { useShopContext } from '../contexts/ShopContext';
import ShopSwitcher from './ShopSwitcher';
import DashboardAnalytics from './DashboardAnalytics';
import { Employee, PayrollRecord } from '../types';
import { exportCSV } from '../lib/utils';
import EmployeeOnboardingWizard from './EmployeeOnboardingWizard';
import NotificationCenter from './NotificationCenter';

export default function AdminView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'staff' | 'attendance' | 'payroll' | 'audit'>('dashboard');
  const [db, setDb] = useState(getDB());
  const { selectedShopId } = useShopContext();
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState<Partial<Employee>>({ wageType: 'monthly', wageAmount: 0, shiftStart: '09:00' });
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [staffSubTab, setStaffSubTab] = useState<'staff' | 'shops'>('staff');
  const [showAddShop, setShowAddShop] = useState(false);
  const [newShop, setNewShop] = useState({ name: '', lat: 37.7749, lng: -122.4194, radius: 100, deviceId: '', capacity: 10 });
  const [adminLocation, setAdminLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (localStorage.getItem('auth_role') !== 'admin') {
      navigate('/');
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setAdminLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => {
          console.warn("Could not retrieve admin location for logging:", err);
        }
      );
    }
  }, [navigate]);

  useEffect(() => {
    const handleUpdate = () => {
      setDb(getDB());
    };
    window.addEventListener('db_updated', handleUpdate);
    return () => {
      window.removeEventListener('db_updated', handleUpdate);
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleAddShop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop.name || !newShop.deviceId) return;

    const shopId = `shop-${Math.random().toString(36).substr(2, 9)}`;
    const shop = {
      id: shopId,
      name: newShop.name,
      lat: Number(newShop.lat),
      lng: Number(newShop.lng),
      radius: Number(newShop.radius),
      deviceId: newShop.deviceId,
      capacity: Number(newShop.capacity || 10)
    };

    const newDb = { ...db, shops: [...db.shops, shop] };
    setDB(newDb);
    addAuditLog('admin', 'Added Shop', `Added shop ${shop.name} with device ID ${shop.deviceId}`, undefined, adminLocation?.lat, adminLocation?.lng);
    setDb(getDB());
    setShowAddShop(false);
    setNewShop({ name: '', lat: 37.7749, lng: -122.4194, radius: 100, deviceId: '', capacity: 10 });
  };

  const handleRemoveShop = (id: string, name: string) => {
    if (db.shops.length <= 1) {
      alert('Cannot delete the only remaining shop. At least one shop is required for system routing.');
      return;
    }
    const employeesAtShop = db.employees.filter(e => e.shopId === id);
    if (employeesAtShop.length > 0) {
      if (!confirm(`Warning: There are ${employeesAtShop.length} employee(s) associated with "${name}". Deleting this shop will leave them unassigned. Proceed?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to remove the shop "${name}"?`)) {
        return;
      }
    }

    const newDb = {
      ...db,
      shops: db.shops.filter(s => s.id !== id),
      employees: db.employees.map(e => e.shopId === id ? { ...e, shopId: '' } : e)
    };
    setDB(newDb);
    addAuditLog('admin', 'Removed Shop', `Removed shop ${name}`, undefined, adminLocation?.lat, adminLocation?.lng);
    setDb(getDB());
  };

  const handleUpdateCapacity = (shopId: string, change: number) => {
    const currentDb = getDB();
    const shop = currentDb.shops.find(s => s.id === shopId);
    if (!shop) return;
    
    const currentCapacity = shop.capacity !== undefined ? shop.capacity : 10;
    const newCapacity = Math.max(1, currentCapacity + change);
    
    shop.capacity = newCapacity;
    setDB(currentDb);
    addAuditLog(
      'admin', 
      'Shop Capacity Updated', 
      `Updated capacity for shop ${shop.name} from ${currentCapacity} to ${newCapacity}`, 
      undefined, 
      adminLocation?.lat || undefined, 
      adminLocation?.lng || undefined
    );
    setDb(getDB());
  };

  const filteredShops = selectedShopId === 'all' ? db.shops : db.shops.filter(s => s.id === selectedShopId);
  const filteredEmployees = selectedShopId === 'all' ? db.employees : db.employees.filter(e => e.shopId === selectedShopId);
  const filteredAttendance = selectedShopId === 'all' ? db.attendance : db.attendance.filter(a => a.shopId === selectedShopId);

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.wageAmount || !newStaff.shopId) return;
    
    const emp: Employee = {
      id: Math.random().toString(36).substr(2, 9),
      name: newStaff.name,
      shopId: newStaff.shopId,
      wageType: newStaff.wageType as any,
      wageAmount: Number(newStaff.wageAmount),
      shiftStart: newStaff.shiftStart || '09:00'
    };

    const newDb = { ...db, employees: [...db.employees, emp] };
    setDB(newDb);
    addAuditLog('admin', 'Added Staff', `Added ${emp.name} to shop ${emp.shopId}`, undefined, adminLocation?.lat, adminLocation?.lng);
    setDb(getDB()); // Refresh from store to get the audit log
    setShowAddStaff(false);
    setNewStaff({ wageType: 'monthly', wageAmount: 0, shiftStart: '09:00' });
  };

  const generatePayroll = () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    let updatedPayroll = [...db.payroll];

    filteredEmployees.forEach(emp => {
      // Find attendance for this month
      const empLogs = filteredAttendance.filter(a => a.employeeId === emp.id && format(new Date(a.timestamp), 'yyyy-MM') === currentMonth);
      
      // Calculate distinct days worked
      const daysWorked = new Set(empLogs.map(a => format(new Date(a.timestamp), 'yyyy-MM-dd'))).size;
      
      let baseSalaryAmount = 0;
      if (emp.wageType === 'monthly') {
        baseSalaryAmount = (emp.wageAmount / 30) * daysWorked;
      } else if (emp.wageType === 'daily') {
        baseSalaryAmount = emp.wageAmount * daysWorked;
      } else {
        // Hourly approximation: assuming 8 hours per day present for MVP simplicity since checkouts may be missed
        baseSalaryAmount = emp.wageAmount * (daysWorked * 8);
      }

      const existingRecordIndex = updatedPayroll.findIndex(p => p.employeeId === emp.id && p.month === currentMonth);
      const record: PayrollRecord = {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: emp.id,
        month: currentMonth,
        baseSalaryAmount: Math.round(baseSalaryAmount * 100) / 100,
        overtimeAmount: 0,
        bonusAmount: 0,
        deductionAmount: 0,
        netSalary: Math.round(baseSalaryAmount * 100) / 100,
        status: 'draft'
      };

      if (existingRecordIndex >= 0) {
        updatedPayroll[existingRecordIndex] = record;
      } else {
        updatedPayroll.push(record);
      }
    });

    const newDb = { ...db, payroll: updatedPayroll };
    setDB(newDb);
    addAuditLog('admin', 'Generated Payroll', `Drafted payroll for ${currentMonth} for ${filteredEmployees.length} employees`, undefined, adminLocation?.lat, adminLocation?.lng);
    setDb(getDB());
  };

  const handleExportAttendanceCSV = () => {
    const headers = ['Record ID', 'Employee Name', 'Shop Name', 'Type', 'Timestamp', 'Date', 'Synced', 'GPS Verification'];
    const data = filteredAttendance.map(record => {
      const emp = db.employees.find(e => e.id === record.employeeId);
      const shop = db.shops.find(s => s.id === record.shopId);
      const date = new Date(record.timestamp);
      return [
        record.id,
        emp?.name || 'Unknown',
        shop?.name || 'Unknown',
        record.type.toUpperCase(),
        record.timestamp,
        format(date, 'yyyy-MM-dd HH:mm:ss'),
        record.synced ? 'Yes' : 'No',
        record.lat && record.lng ? 'Verified' : 'Unverified'
      ];
    });
    
    exportCSV(`attendance_report_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, data);
    addAuditLog('admin', 'Exported Attendance CSV', `Exported ${data.length} attendance records`, undefined, adminLocation?.lat, adminLocation?.lng);
    setDb(getDB());
  };

  const handleExportPayrollCSV = () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const visiblePayroll = db.payroll.filter(p => p.month === currentMonth && (selectedShopId === 'all' ? true : db.employees.find(e => e.id === p.employeeId)?.shopId === selectedShopId));

    const headers = ['Payroll ID', 'Employee Name', 'Shop Name', 'Month', 'Base Salary', 'Overtime', 'Bonus', 'Deduction', 'Net Salary', 'Status'];
    const data = visiblePayroll.map(record => {
      const emp = db.employees.find(e => e.id === record.employeeId);
      const shop = db.shops.find(s => s.id === emp?.shopId);
      return [
        record.id,
        emp?.name || 'Unknown',
        shop?.name || 'Unknown',
        record.month,
        record.baseSalaryAmount,
        record.overtimeAmount,
        record.bonusAmount,
        record.deductionAmount,
        record.netSalary,
        record.status
      ];
    });
    
    exportCSV(`payroll_report_${currentMonth}.csv`, headers, data);
    addAuditLog('admin', 'Exported Payroll CSV', `Exported ${data.length} payroll records for ${currentMonth}`, undefined, adminLocation?.lat, adminLocation?.lng);
    setDb(getDB());
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                      <Building className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Shops</dt>
                        <dd className="text-lg font-medium text-gray-900">{filteredShops.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Staff</dt>
                        <dd className="text-lg font-medium text-gray-900">{filteredEmployees.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Today's Logs</dt>
                        <dd className="text-lg font-medium text-gray-900">{filteredAttendance.filter(a => {
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          return a.timestamp >= today.getTime();
                        }).length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DashboardAnalytics />

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Attendance Logs</h3>
              </div>
              <ul className="divide-y divide-gray-200">
                {filteredAttendance.slice(-5).reverse().map((record) => {
                  const emp = db.employees.find(e => e.id === record.employeeId);
                  const shop = db.shops.find(s => s.id === record.shopId);
                  return (
                    <li key={record.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center">
                        {record.photoUrl ? (
                          <img src={record.photoUrl} alt="Selfie" className="h-10 w-10 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Users size={16} className="text-gray-500" />
                          </div>
                        )}
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{emp?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{shop?.name || 'Unknown'} &middot; {format(new Date(record.timestamp), 'PP pp')}</p>
                        </div>
                      </div>
                      <div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.type === 'check-in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {record.type.replace('-', ' ')}
                        </span>
                      </div>
                    </li>
                  )
                })}
                {filteredAttendance.length === 0 && (
                  <li className="p-4 text-sm text-gray-500 text-center">No attendance records yet.</li>
                )}
              </ul>
            </div>
          </div>
        );

      case 'staff':
        return (
          <div className="space-y-6">
            {/* Sub-tab navigation */}
            <div className="flex border-b border-gray-200 bg-white p-2 rounded-xl shadow-sm space-x-2">
              <button
                onClick={() => setStaffSubTab('staff')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center space-x-1.5 ${
                  staffSubTab === 'staff'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Users size={16} />
                <span>Staff Directory & Onboarding</span>
              </button>
              <button
                onClick={() => setStaffSubTab('shops')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center space-x-1.5 ${
                  staffSubTab === 'shops'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Building size={16} />
                <span>Shops & Locations Management</span>
              </button>
            </div>

            {staffSubTab === 'staff' ? (
              <div className="bg-white shadow rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg leading-6 font-semibold text-gray-900">Staff Directory</h3>
                    <p className="mt-1 text-xs text-gray-500">Manage shop employees, salary bases, and biometric enrollment credentials.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button 
                      onClick={() => setShowOnboardingWizard(true)}
                      className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold rounded-xl hover:bg-indigo-700 transition flex items-center shadow-sm"
                    >
                      <UserPlus size={15} className="mr-1.5" /> ✨ Onboard Staff Wizard
                    </button>
                    <button 
                      onClick={() => setShowAddStaff(!showAddStaff)}
                      className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 text-xs font-bold rounded-xl transition flex items-center border border-blue-200"
                    >
                      <Plus size={15} className="mr-1.5" /> Quick Add Staff
                    </button>
                  </div>
                </div>

                {showAddStaff && (
                  <div className="p-6 bg-slate-50 border-b border-gray-200">
                    <div className="max-w-3xl">
                      <h4 className="text-sm font-bold text-gray-800 mb-3">Quick Staff Form (No Face Bio-Scan)</h4>
                      <form onSubmit={handleAddStaff} className="grid grid-cols-1 gap-4 sm:grid-cols-5 items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Name</label>
                          <input required type="text" value={newStaff.name || ''} onChange={e => setNewStaff({...newStaff, name: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" placeholder="Name" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Shop</label>
                          <select required value={newStaff.shopId || ''} onChange={e => setNewStaff({...newStaff, shopId: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                            <option value="">Select Shop...</option>
                            {db.shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Wage Type & Amount</label>
                          <div className="flex mt-1">
                            <select value={newStaff.wageType || 'monthly'} onChange={e => setNewStaff({...newStaff, wageType: e.target.value as any})} className="block w-1/2 px-2 py-2 border border-gray-300 rounded-l-md text-sm bg-white">
                              <option value="monthly">Monthly</option>
                              <option value="daily">Daily</option>
                              <option value="hourly">Hourly</option>
                            </select>
                            <input required type="number" value={newStaff.wageAmount || ''} onChange={e => setNewStaff({...newStaff, wageAmount: Number(e.target.value)})} className="block w-1/2 px-3 py-2 border-t border-b border-r border-gray-300 rounded-r-md text-sm bg-white" placeholder="Amount" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Shift Start Deadline</label>
                          <input required type="time" value={newStaff.shiftStart || '09:00'} onChange={e => setNewStaff({...newStaff, shiftStart: e.target.value})} className="mt-1 block w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white" />
                        </div>
                        <div>
                          <button type="submit" className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium transition">Save</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Profile</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop Assignment</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Salary Structure</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift Deadline</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Biometrics Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredEmployees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              {emp.facePhotoUrl ? (
                                <img 
                                  src={emp.facePhotoUrl} 
                                  alt={emp.name} 
                                  className="h-10 w-10 rounded-full object-cover border-2 border-emerald-400" 
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-gray-200 text-slate-500">
                                  <Users size={16} />
                                </div>
                              )}
                              <span className="text-sm font-bold text-gray-900">{emp.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-800 rounded-full border border-blue-100">
                              {db.shops.find(s => s.id === emp.shopId)?.name || 'Unassigned / Deleted Shop'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                            ${emp.wageAmount} <span className="text-xs text-gray-400 capitalize">/ {emp.wageType}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                            {emp.shiftStart || '09:00'} AM
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {emp.facePhotoUrl ? (
                              <span className="px-2 py-0.5 inline-flex text-[10px] leading-4 font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ENROLLED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 inline-flex text-[10px] leading-4 font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">
                                NO FACE MODEL
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                            No employees found in this directory context.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Shops management tab - Increment & Decrement */}
                <div className="bg-white shadow rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-lg leading-6 font-semibold text-gray-900">Retail Shops Configuration</h3>
                      <p className="mt-1 text-xs text-gray-500">Manage GPS geofences, terminal device bounds, and active branches.</p>
                    </div>
                    <button
                      onClick={() => setShowAddShop(!showAddShop)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold rounded-xl transition flex items-center shadow-sm"
                    >
                      <Plus size={16} className="mr-1" /> Add Shop (Increment)
                    </button>
                  </div>

                  {showAddShop && (
                    <div className="p-6 bg-slate-50 border-b border-gray-200">
                      <h4 className="text-sm font-bold text-gray-800 mb-3">Increment New Shop Location</h4>
                      <form onSubmit={handleAddShop} className="grid grid-cols-1 gap-4 sm:grid-cols-6 items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Shop Name</label>
                          <input required type="text" value={newShop.name} onChange={e => setNewShop({...newShop, name: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" placeholder="e.g. West Coast Terminal" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Terminal Device ID</label>
                          <input required type="text" value={newShop.deviceId} onChange={e => setNewShop({...newShop, deviceId: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" placeholder="e.g. tablet-04" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Latitude</label>
                          <input required type="number" step="any" value={newShop.lat} onChange={e => setNewShop({...newShop, lat: Number(e.target.value)})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Longitude</label>
                          <input required type="number" step="any" value={newShop.lng} onChange={e => setNewShop({...newShop, lng: Number(e.target.value)})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Radius (m)</label>
                          <input required type="number" min="10" value={newShop.radius} onChange={e => setNewShop({...newShop, radius: Number(e.target.value)})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
                        </div>
                        <div className="flex gap-2">
                          <div className="w-1/2">
                            <label className="block text-xs font-medium text-gray-700">Active Cap.</label>
                            <input required type="number" min="1" value={newShop.capacity} onChange={e => setNewShop({...newShop, capacity: Number(e.target.value)})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
                          </div>
                          <button type="submit" className="w-1/2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-xs font-bold h-9 mt-auto transition">
                            Increment
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {db.shops.map((shop) => {
                        const employeesCount = db.employees.filter(e => e.shopId === shop.id).length;
                        return (
                          <div key={shop.id} className="bg-slate-50 border border-gray-200 rounded-2xl p-5 hover:shadow-md transition duration-200 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start">
                                <h4 className="text-sm font-bold text-gray-900 flex items-center">
                                  <Building size={16} className="mr-1.5 text-blue-500" /> {shop.name}
                                </h4>
                                <button
                                  onClick={() => handleRemoveShop(shop.id, shop.name)}
                                  className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition"
                                  title="Decrement / Delete Shop"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                                <p className="flex items-center"><MapPin size={12} className="mr-1.5" /> Coordinates: {shop.lat.toFixed(4)}, {shop.lng.toFixed(4)}</p>
                                <p className="flex items-center"><Settings size={12} className="mr-1.5" /> Device Bound ID: <span className="font-mono bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[10px] ml-1">{shop.deviceId}</span></p>
                                <p className="flex items-center"><CheckCircle size={12} className="mr-1.5" /> Geofence Radius: <span className="font-semibold text-gray-700 ml-1">{shop.radius} meters</span></p>
                              </div>

                              {/* Capacity Increment / Decrement controls */}
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-gray-200 bg-white/60 p-2.5 rounded-xl border border-gray-100">
                                <span className="flex items-center text-xs font-semibold text-gray-700">
                                  Capacity Limit: <span className="font-bold text-indigo-700 ml-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{shop.capacity !== undefined ? shop.capacity : 10}</span>
                                </span>
                                <div className="flex items-center space-x-1.5">
                                  <button
                                    onClick={() => handleUpdateCapacity(shop.id, -1)}
                                    className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 transition shadow-sm active:scale-95"
                                    title="Decrement Active Capacity"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateCapacity(shop.id, 1)}
                                    className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 transition shadow-sm active:scale-95"
                                    title="Increment Active Capacity"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shop Personnel</span>
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{employeesCount} staff</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Employee Onboarding Wizard Overlay */}
            {showOnboardingWizard && (
              <EmployeeOnboardingWizard
                onClose={() => setShowOnboardingWizard(false)}
                onSuccess={() => {
                  setShowOnboardingWizard(false);
                  setDb(getDB()); // reload local database state
                }}
              />
            )}
          </div>
        );
      
      case 'attendance':
        return (
          <div className="bg-white shadow rounded-lg">
             <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">All Attendance Records</h3>
              <button 
                onClick={handleExportAttendanceCSV}
                className="bg-indigo-50 text-indigo-700 px-3 py-1.5 text-sm rounded-md hover:bg-indigo-100 flex items-center border border-indigo-200"
              >
                <Download size={16} className="mr-1.5" /> Export CSV
              </button>
            </div>
            <ul className="divide-y divide-gray-200">
                {filteredAttendance.slice().reverse().map((record) => {
                  const emp = db.employees.find(e => e.id === record.employeeId);
                  return (
                    <li key={record.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center">
                        {record.photoUrl ? (
                          <img src={record.photoUrl} alt="Selfie" className="h-10 w-10 rounded-md object-cover border border-gray-200" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-200" />
                        )}
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{emp?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{format(new Date(record.timestamp), 'PP pp')}</p>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        {record.lat && record.lng && (
                          <span className="flex items-center mr-4 text-xs">
                            <MapPin size={12} className="mr-1" /> GPS Verified
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${record.type === 'check-in' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {record.type.toUpperCase()}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
          </div>
        );

      case 'payroll':
        const currentMonth = format(new Date(), 'yyyy-MM');
        const visiblePayroll = db.payroll.filter(p => p.month === currentMonth && (selectedShopId === 'all' ? true : db.employees.find(e => e.id === p.employeeId)?.shopId === selectedShopId));

        return (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center justify-center text-center text-gray-500 border border-gray-200">
              <Settings size={48} className="mx-auto text-blue-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Payroll Generation ({currentMonth})</h3>
              <p className="mt-2 text-sm max-w-md">Calculates total pay based on attendance records and applied salary rules for the current month.</p>
              <button onClick={generatePayroll} className="mt-6 flex items-center bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 shadow-sm transition">
                <RefreshCcw size={18} className="mr-2" /> Generate Draft Payroll
              </button>
            </div>

            {visiblePayroll.length > 0 && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Payroll Drafts</h3>
                  <button 
                    onClick={handleExportPayrollCSV}
                    className="bg-indigo-50 text-indigo-700 px-3 py-1.5 text-sm rounded-md hover:bg-indigo-100 flex items-center border border-indigo-200"
                  >
                    <Download size={16} className="mr-1.5" /> Export CSV
                  </button>
                </div>
                <ul className="divide-y divide-gray-200">
                  {visiblePayroll.map((record) => {
                    const emp = db.employees.find(e => e.id === record.employeeId);
                    return (
                      <li key={record.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{emp?.name || 'Unknown Employee'}</p>
                          <p className="text-xs text-gray-500">Base: ${record.baseSalaryAmount} | Type: {emp?.wageType}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">${record.netSalary}</p>
                          <span className="px-2 py-1 text-[10px] uppercase font-semibold rounded bg-yellow-100 text-yellow-800">
                            {record.status}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );

      case 'audit':
        const getActionIcon = (action: string) => {
          if (action.includes('Staff')) return <UserPlus size={16} className="text-blue-500" />;
          if (action.includes('Payroll')) return <Settings size={16} className="text-purple-500" />;
          if (action.includes('Attendance')) return <CheckCircle size={16} className="text-green-500" />;
          return <BadgeInfo size={16} className="text-gray-500" />;
        };

        const getActorBadgeColor = (role: string) => {
          return role === 'admin' 
            ? 'bg-indigo-100 text-indigo-800 border-indigo-200' 
            : 'bg-emerald-100 text-emerald-800 border-emerald-200';
        };

        return (
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg leading-6 font-semibold text-gray-900 flex items-center">
                <ShieldAlert size={20} className="mr-2 text-gray-500" /> System Audit Logs
              </h3>
              <p className="mt-1 text-sm text-gray-500">Comprehensive record of all system events and actions.</p>
            </div>
            <ul className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {[...(db.auditLogs || [])].reverse().map((log) => (
                <li key={log.id} className="p-4 sm:px-6 hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                        {getActionIcon(log.action)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 flex items-center flex-wrap gap-1.5">
                          {log.action}
                          <span className={`px-2 inline-flex text-[10px] leading-4 font-semibold rounded-full border ${getActorBadgeColor(log.actorRole)}`}>
                            {log.actorRole.toUpperCase()}
                          </span>
                          {log.attemptStatus && (
                            <span className={`px-2 inline-flex text-[10px] leading-4 font-semibold rounded-full border ${
                              log.attemptStatus === 'success' 
                                ? 'bg-green-100 text-green-800 border-green-200' 
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}>
                              {log.attemptStatus.toUpperCase()}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">{log.details}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {log.lat !== undefined && log.lng !== undefined && (
                            <div className="flex items-center text-[10px] text-indigo-600 font-bold bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100 w-max">
                              <MapPin size={10} className="mr-1 text-indigo-500" />
                              <span>GPS: {log.lat.toFixed(6)}, {log.lng.toFixed(6)}</span>
                            </div>
                          )}
                          {log.deviceTimestamp && (
                            <div className="flex items-center text-[10px] text-slate-600 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-max">
                              <Clock size={10} className="mr-1 text-slate-400" />
                              <span>Device Time: {log.deviceTimestamp}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-xs text-gray-500 flex items-center justify-end">
                        <Clock size={12} className="mr-1" />
                        {format(new Date(log.timestamp), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs font-mono text-gray-400 mt-1">
                        {format(new Date(log.timestamp), 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
              {(!db.auditLogs || db.auditLogs.length === 0) && (
                <li className="p-8 text-center text-gray-500 flex flex-col items-center">
                  <Activity size={48} className="text-gray-300 mb-3" />
                  <p className="text-sm font-medium">No audit logs found.</p>
                  <p className="text-xs mt-1">Actions performed by managers and admins will appear here.</p>
                </li>
              )}
            </ul>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <div className="w-full md:w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 font-bold text-xl border-b border-slate-800 flex items-center">
          <Building className="mr-2" /> Admin Portal
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: FileText },
            { id: 'staff', label: 'Staff & Shops', icon: Users },
            { id: 'attendance', label: 'Attendance logs', icon: MapPin },
            { id: 'payroll', label: 'Payroll', icon: Settings },
            { id: 'audit', label: 'Audit Logs', icon: Activity },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center px-4 py-3 text-sm rounded-lg transition-colors ${
                activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center text-sm text-slate-400 hover:text-white transition">
            <LogOut className="mr-3 h-5 w-5" /> Logout
          </button>
        </div>
      </div>

      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-20">
        <div className="font-bold flex items-center">
          <Building className="mr-2 h-5 w-5" /> Admin
        </div>
        <button onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
        </button>
      </div>
      <div className="md:hidden bg-slate-800 p-2 overflow-x-auto flex space-x-2 sticky top-[60px] z-20">
         {['dashboard', 'staff', 'attendance', 'payroll', 'audit'].map((id) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`whitespace-nowrap px-4 py-2 text-sm rounded-full ${
                activeTab === id ? 'bg-blue-600 text-white' : 'text-slate-300 bg-slate-700'
              }`}
            >
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
         ))}
      </div>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 capitalize mb-4 sm:mb-0">
              {activeTab === 'dashboard' ? 'Overview Dashboard' : activeTab}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <NotificationCenter />
              <ShopSwitcher />
            </div>
          </div>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
