import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { drivesApi } from '../api/hiring';
import type { Drive } from '../types';

interface DrivesContextType {
  drives: Drive[];
  loading: boolean;
  fetchDrives: (silent?: boolean) => Promise<void>;
  setDrives: React.Dispatch<React.SetStateAction<Drive[]>>;
  clearDrives: () => void;
}

const DrivesContext = createContext<DrivesContextType | undefined>(undefined);

export const DrivesProvider = ({ children }: { children: ReactNode }) => {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchDrives = async (silent: boolean = false) => {
    // Only show loading indicator if it's the first time and not requested silently
    if (!silent && !hasFetched) {
      setLoading(true);
    }
    try {
      const res = await drivesApi.list();
      setDrives(res.data || []);
      setHasFetched(true);
    } catch (err) {
      console.error('Error fetching drives in context:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearDrives = () => {
    setDrives([]);
    setHasFetched(false);
  };

  return (
    <DrivesContext.Provider value={{ drives, loading, fetchDrives, setDrives, clearDrives }}>
      {children}
    </DrivesContext.Provider>
  );
};

export const useDrives = () => {
  const context = useContext(DrivesContext);
  if (!context) {
    throw new Error('useDrives must be used within a DrivesProvider');
  }
  return context;
};
