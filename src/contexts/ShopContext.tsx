import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ShopContextType {
  selectedShopId: string;
  setSelectedShopId: (id: string) => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider = ({ children }: { children: ReactNode }) => {
  const [selectedShopId, setSelectedShopId] = useState<string>('all');

  return (
    <ShopContext.Provider value={{ selectedShopId, setSelectedShopId }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShopContext = () => {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShopContext must be used within a ShopProvider');
  }
  return context;
};
