import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { getDB } from '../lib/store';
import { useShopContext } from '../contexts/ShopContext';
import { format, subDays, subMonths } from 'date-fns';

export default function DashboardAnalytics() {
  const { selectedShopId } = useShopContext();
  const db = getDB();

  const filteredEmployees = useMemo(() => {
    return selectedShopId === 'all' 
      ? db.employees 
      : db.employees.filter(e => e.shopId === selectedShopId);
  }, [db.employees, selectedShopId]);

  const filteredAttendance = useMemo(() => {
    return selectedShopId === 'all'
      ? db.attendance
      : db.attendance.filter(a => a.shopId === selectedShopId);
  }, [db.attendance, selectedShopId]);

  const filteredPayroll = useMemo(() => {
    return db.payroll.filter(p => {
      if (selectedShopId === 'all') return true;
      const emp = db.employees.find(e => e.id === p.employeeId);
      return emp?.shopId === selectedShopId;
    });
  }, [db.payroll, db.employees, selectedShopId]);

  const attendanceData = useMemo(() => {
    const data = [];
    const totalEmp = filteredEmployees.length;
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dayStart = new Date(d).setHours(0,0,0,0);
      const dayEnd = new Date(d).setHours(23,59,59,999);
      
      const attInDay = filteredAttendance.filter(
        a => a.timestamp >= dayStart && a.timestamp <= dayEnd && a.type === 'check-in'
      );
      
      const uniqueEmps = new Set(attInDay.map(a => a.employeeId)).size;
      const percentage = totalEmp === 0 ? 0 : Math.round((uniqueEmps / totalEmp) * 100);
      
      data.push({
        date: format(d, 'EEE'), // Mon, Tue
        percentage,
        count: uniqueEmps
      });
    }
    return data;
  }, [filteredAttendance, filteredEmployees.length]);

  const payrollData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const monthStr = format(d, 'yyyy-MM');
      const monthDisplay = format(d, 'MMM');
      
      const payrollInMonth = filteredPayroll.filter(p => p.month === monthStr);
      const total = payrollInMonth.reduce((sum, p) => sum + p.netSalary, 0);
      
      data.push({
        month: monthDisplay,
        total: Math.round(total)
      });
    }
    return data;
  }, [filteredPayroll]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div className="bg-white p-4 shadow rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">7-Day Attendance Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} unit="%" />
              <Tooltip 
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="percentage" name="Attendance Rate" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 shadow rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">6-Month Payroll Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={payrollData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `$${val}`} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [`$${value}`, 'Total Payroll']}
              />
              <Line type="monotone" dataKey="total" name="Total Payroll" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
