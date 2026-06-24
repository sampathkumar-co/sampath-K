import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building, ShieldCheck } from 'lucide-react';
import { getDB } from '../lib/store';

export default function Login() {
  const [role, setRole] = useState<'admin' | 'manager'>('manager');
  const [password, setPassword] = useState('');
  const [selectedShop, setSelectedShop] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const db = getDB();

  useEffect(() => {
    if (db.shops.length > 0 && !selectedShop) {
      setSelectedShop(db.shops[0].id);
    }
  }, [db.shops]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'admin' && password === 'Admin@123') {
      localStorage.setItem('auth_role', 'admin');
      navigate('/admin');
    } else if (role === 'manager' && password === 'Manager@123') {
      if (!selectedShop) {
        setError('Please select a shop.');
        return;
      }
      localStorage.setItem('auth_role', 'manager');
      localStorage.setItem('auth_shop_id', selectedShop);
      navigate('/manager');
    } else {
      setError('Invalid credentials. Use Admin@123 or Manager@123.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <ShieldCheck size={48} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to Attendance App
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Demo: admin / Admin@123 OR manager / Manager@123
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('manager')}
                  className={`flex justify-center items-center px-4 py-3 border rounded-md shadow-sm text-sm font-medium ${
                    role === 'manager'
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                >
                  <Building className="mr-2 h-5 w-5" />
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`flex justify-center items-center px-4 py-3 border rounded-md shadow-sm text-sm font-medium ${
                    role === 'admin'
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                >
                  <Users className="mr-2 h-5 w-5" />
                  Admin
                </button>
              </div>
            </div>

            {role === 'manager' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Shop</label>
                <div className="mt-1">
                  <select
                    value={selectedShop}
                    onChange={(e) => setSelectedShop(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {db.shops.map(shop => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
