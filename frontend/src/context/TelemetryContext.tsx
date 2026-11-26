import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getFlightPriceApi, SUPPORTED_ROUTES, ROUTE_AIRPORTS } from '../api/flights';
import { formatCurrencyINR } from '../utils/formatters';
import { useToast } from './ToastContext';

export interface TelemetryRouteData {
  route: string;
  price: number;
  prevPrice: number | null;
  timestamp: Date;
  status: 'low' | 'mid' | 'high';
  provider: string;
  isRealTime: boolean;
  airline: string;
  flightNumber: string;
}

interface TelemetryContextValue {
  countdown: number;
  isScanning: boolean;
  routesData: Record<string, TelemetryRouteData>;
  scanAllPrices: (isManual?: boolean) => Promise<void>;
  registerOnPriceTrigger: (callback: () => void) => () => void;
}

const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { error, success, info } = useToast();
  const [routesData, setRoutesData] = useState<Record<string, TelemetryRouteData>>({});
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);
  const isScanningRef = useRef<boolean>(false);
  const triggerCallbacksRef = useRef<Set<() => void>>(new Set());

  const registerOnPriceTrigger = useCallback((callback: () => void) => {
    triggerCallbacksRef.current.add(callback);
    return () => {
      triggerCallbacksRef.current.delete(callback);
    };
  }, []);

  const scanAllPrices = useCallback(async (isManual = false) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);

    try {
      const updates: Record<string, TelemetryRouteData> = {};
      let newlyTriggeredCount = 0;

      await Promise.all(
        SUPPORTED_ROUTES.map(async (route) => {
          const res = await getFlightPriceApi(route, isManual);
          const meta = ROUTE_AIRPORTS[route];
          let status: 'low' | 'mid' | 'high' = 'mid';
          if (res.price <= meta.min + (meta.max - meta.min) * 0.35) {
            status = 'low';
          } else if (res.price >= meta.max - (meta.max - meta.min) * 0.35) {
            status = 'high';
          }

          if (res.triggered_alerts && res.triggered_alerts.length > 0) {
            newlyTriggeredCount += res.triggered_alerts.length;
            success(`🎉 Price Alert Triggered for ${route}! Ticket dropped to ${formatCurrencyINR(res.price)}!`);
          }

          setRoutesData((prev) => {
            const prevEntry = prev[route];
            updates[route] = {
              route,
              price: res.price,
              prevPrice: prevEntry ? prevEntry.price : null,
              timestamp: new Date(),
              status,
              provider: res.provider || 'amadeus',
              isRealTime: res.is_real_time ?? false,
              airline: res.airline || 'Domestic Carrier',
              flightNumber: res.flight_number || '',
            };
            return { ...prev, ...updates };
          });
        })
      );

      setCountdown(30);

      if (isManual) {
        info('Fresh real-time flight prices scanned and evaluated.');
      }

      if (newlyTriggeredCount > 0) {
        triggerCallbacksRef.current.forEach((cb) => {
          try {
            cb();
          } catch {
            // ignore callback errors
          }
        });
      }
    } catch {
      error('Failed to poll live flight price feed.');
    } finally {
      setIsScanning(false);
      isScanningRef.current = false;
    }
  }, [error, success, info]);

  // Initial load on application mount
  useEffect(() => {
    scanAllPrices(false);
  }, [scanAllPrices]);

  // Global continuous 1-second interval ticker running uninterrupted across all tabs
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          scanAllPrices(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [scanAllPrices]);

  return (
    <TelemetryContext.Provider
      value={{
        countdown,
        isScanning,
        routesData,
        scanAllPrices,
        registerOnPriceTrigger,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = (): TelemetryContextValue => {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};
