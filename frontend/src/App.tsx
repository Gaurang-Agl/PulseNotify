import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TelemetryProvider, useTelemetry } from './context/TelemetryContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { AuthModal } from './components/common/AuthModal';
import { QuotaBanner } from './components/common/QuotaBanner';
import { FlightRadarView } from './pages/FlightRadarView';
import { AlertsManagerView } from './pages/AlertsManagerView';
import { NotificationsView } from './pages/NotificationsView';
import { AdminAnalyticsView } from './pages/AdminAnalyticsView';
import { SimulatorView } from './pages/SimulatorView';
import { SystemGuideView } from './pages/SystemGuideView';
import { listAlertsApi } from './api/alerts';
import { listNotificationsApi } from './api/notifications';

const DashboardContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { registerOnPriceTrigger } = useTelemetry();
  const [activeTab, setActiveTab] = useState<string>('radar');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Cross-tab route pre-fill state
  const [prefillOrigin, setPrefillOrigin] = useState<string>('');
  const [prefillDest, setPrefillDest] = useState<string>('');
  const [prefillThreshold, setPrefillThreshold] = useState<number | undefined>(undefined);

  // Badge counters
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);
  const [notificationsCount, setNotificationsCount] = useState<number>(0);

  const fetchBadgeCounts = async () => {
    if (!isAuthenticated) {
      setActiveAlertsCount(0);
      setNotificationsCount(0);
      return;
    }
    try {
      const [alerts, notifs] = await Promise.all([
        listAlertsApi('active').catch(() => []),
        listNotificationsApi().catch(() => []),
      ]);
      setActiveAlertsCount(alerts.length);
      setNotificationsCount(notifs.length);
    } catch {
      // Ignore background badge errors
    }
  };

  useEffect(() => {
    fetchBadgeCounts();
    // Live background sync every 8 seconds for real-time sidebar badges
    const interval = setInterval(fetchBadgeCounts, 8000);
    return () => clearInterval(interval);
  }, [isAuthenticated, activeTab]);

  // Immediately refresh badge counters whenever a route price trigger fires anywhere
  useEffect(() => {
    return registerOnPriceTrigger(() => {
      fetchBadgeCounts();
    });
  }, [registerOnPriceTrigger]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await fetchBadgeCounts();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleSelectRouteForAlert = (origin: string, destination: string, defaultPrice: number) => {
    setPrefillOrigin(origin);
    setPrefillDest(destination);
    setPrefillThreshold(defaultPrice);
    setActiveTab('alerts');
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertsCount={activeAlertsCount}
        unreadNotificationsCount={notificationsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onRefreshAll={handleRefreshAll} isRefreshing={isRefreshing} />

        {/* Real-time Third-Party API Quota Alert Banner */}
        <QuotaBanner />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">

          <div className="max-w-7xl mx-auto">
            {activeTab === 'radar' && (
              <FlightRadarView
                onSelectRouteForAlert={handleSelectRouteForAlert}
                onRefreshBadges={fetchBadgeCounts}
                onNavigateToAlerts={() => setActiveTab('alerts')}
              />
            )}
            {activeTab === 'alerts' && (
              <AlertsManagerView
                initialOrigin={prefillOrigin}
                initialDestination={prefillDest}
                initialThreshold={prefillThreshold}
                onClearInitialRoute={() => {
                  setPrefillOrigin('');
                  setPrefillDest('');
                  setPrefillThreshold(undefined);
                }}
              />
            )}
            {activeTab === 'notifications' && <NotificationsView />}
            {activeTab === 'admin' && <AdminAnalyticsView />}
            {activeTab === 'simulator' && <SimulatorView />}
            {activeTab === 'docs' && <SystemGuideView />}
          </div>
        </main>
      </div>

      {/* Authentication Modal */}
      <AuthModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <TelemetryProvider>
          <DashboardContent />
        </TelemetryProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
