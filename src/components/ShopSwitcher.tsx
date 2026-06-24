import React, { useState, useEffect } from 'react';
import { useShopContext } from '../contexts/ShopContext';
import { getDB, setDB, addAuditLog } from '../lib/store';
import { Plus, Minus } from 'lucide-react';

export default function ShopSwitcher() {
  const { selectedShopId, setSelectedShopId } = useShopContext();
  const [db, setDb] = useState(getDB());
  const [switcherLocation, setSwitcherLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setDb(getDB());
    };
    window.addEventListener('db_updated', handleUpdate);
    return () => {
      window.removeEventListener('db_updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSwitcherLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => {
          console.warn("Could not retrieve location for ShopSwitcher capacity adjustment:", err);
        }
      );
    }
  }, []);

  const selectedShop = db.shops.find(s => s.id === selectedShopId);
  const capacity = selectedShop?.capacity !== undefined ? selectedShop.capacity : 10;

  const handleUpdateCapacity = (change: number) => {
    if (!selectedShop) return;
    
    const currentDb = getDB();
    const shop = currentDb.shops.find(s => s.id === selectedShopId);
    if (!shop) return;

    const currentCapacity = shop.capacity !== undefined ? shop.capacity : 10;
    const newCapacity = Math.max(1, currentCapacity + change);

    shop.capacity = newCapacity;
    setDB(currentDb);

    const actorRole = (localStorage.getItem('auth_role') as 'admin' | 'manager') || 'admin';
    addAuditLog(
      actorRole,
      'Shop Capacity Updated via Switcher',
      `Updated capacity for shop ${shop.name} from ${currentCapacity} to ${newCapacity}`,
      selectedShopId,
      switcherLocation?.lat || undefined,
      switcherLocation?.lng || undefined
    );
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm w-full sm:w-auto">
      <div className="flex items-center">
        <label htmlFor="global-shop-filter" className="mr-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Filter Shop:</label>
        <select
          id="global-shop-filter"
          value={selectedShopId}
          onChange={(e) => setSelectedShopId(e.target.value)}
          className="block w-full sm:w-56 pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-xl border bg-white font-medium text-gray-800"
        >
          <option value="all">All Shops & Locations</option>
          {db.shops.map(shop => (
            <option key={shop.id} value={shop.id}>{shop.name}</option>
          ))}
        </select>
      </div>

      {selectedShop && (
        <div className="flex items-center justify-between sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-gray-200 pt-2.5 sm:pt-0 sm:pl-3">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap flex items-center">
            Active Capacity:
            <span className="font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg ml-1.5 min-w-[20px] text-center">
              {capacity}
            </span>
          </span>
          <div className="flex items-center space-x-1 ml-1">
            <button
              onClick={() => handleUpdateCapacity(-1)}
              className="p-1 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 transition hover:text-gray-900 active:scale-95 shadow-sm"
              title="Decrement Capacity"
            >
              <Minus size={11} />
            </button>
            <button
              onClick={() => handleUpdateCapacity(1)}
              className="p-1 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 transition hover:text-gray-900 active:scale-95 shadow-sm"
              title="Increment Capacity"
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
