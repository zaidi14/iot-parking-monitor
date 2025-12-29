import React, { createContext, useContext, useState, useCallback } from 'react';

export type ParkingState = 'IDLE' | 'SOMETHING_DETECTED' | 'VEHICLE_DETECTED' | 'VIOLATION';

export interface ParkingSession {
  nodeId: string;
  state: ParkingState;
  timestamp: Date;
  confidence?: number;
  sessionId?: string;
  videoUrl?: string;
  timerDuration?: number;
  message: string;
}

interface ParkingContextType {
  sessions: { [nodeId: string]: ParkingSession };
  violations: { [nodeId: string]: any };
  timers: { [nodeId: string]: NodeJS.Timeout | null };
  updateSession: (nodeId: string, session: Partial<ParkingSession>) => void;
  setViolation: (nodeId: string, violation: any) => void;
  clearViolation: (nodeId: string) => void;
  startTimer: (nodeId: string, duration: number, onExpire: () => void) => void;
  stopTimer: (nodeId: string) => void;
  resetSession: (nodeId: string) => void;
}

const ParkingContext = createContext<ParkingContextType | undefined>(undefined);

export function ParkingProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<{ [nodeId: string]: ParkingSession }>({});
  const [violations, setViolations] = useState<{ [nodeId: string]: any }>({});
  const [timers, setTimers] = useState<{ [nodeId: string]: NodeJS.Timeout | null }>({});

  const updateSession = useCallback((nodeId: string, session: Partial<ParkingSession>) => {
    setSessions(prev => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] || {}),
        nodeId,
        timestamp: new Date(),
        ...session
      } as ParkingSession
    }));
  }, []);

  const setViolation = useCallback((nodeId: string, violation: any) => {
    setViolations(prev => ({
      ...prev,
      [nodeId]: violation
    }));
  }, []);

  const clearViolation = useCallback((nodeId: string) => {
    setViolations(prev => {
      const copy = { ...prev };
      delete copy[nodeId];
      return copy;
    });
  }, []);

  const startTimer = useCallback((nodeId: string, duration: number, onExpire: () => void) => {
    // Clear existing timer
    if (timers[nodeId]) {
      clearTimeout(timers[nodeId]!);
    }

    const timeoutId = setTimeout(() => {
      onExpire();
      setTimers(prev => ({
        ...prev,
        [nodeId]: null
      }));
    }, duration * 1000);

    setTimers(prev => ({
      ...prev,
      [nodeId]: timeoutId
    }));
  }, [timers]);

  const stopTimer = useCallback((nodeId: string) => {
    if (timers[nodeId]) {
      clearTimeout(timers[nodeId]!);
      setTimers(prev => ({
        ...prev,
        [nodeId]: null
      }));
    }
  }, [timers]);

  const resetSession = useCallback((nodeId: string) => {
    stopTimer(nodeId);
    clearViolation(nodeId);
    updateSession(nodeId, {
      state: 'IDLE',
      message: '✅ Idle - Ready for Detection'
    });
  }, [stopTimer, clearViolation, updateSession]);

  return (
    <ParkingContext.Provider value={{
      sessions,
      violations,
      timers,
      updateSession,
      setViolation,
      clearViolation,
      startTimer,
      stopTimer,
      resetSession
    }}>
      {children}
    </ParkingContext.Provider>
  );
}

export function useParking() {
  const context = useContext(ParkingContext);
  if (!context) {
    throw new Error('useParking must be used within ParkingProvider');
  }
  return context;
}
