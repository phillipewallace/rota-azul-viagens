
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import Navigation from '@/components/Navigation';
import Dashboard from '@/pages/Dashboard';
import Trucks from '@/pages/Trucks';
import Drivers from '@/pages/Drivers';
import Routes from '@/pages/Routes';
import Schedule from '@/pages/Schedule';
import Reports from '@/pages/Reports';
import Maintenance from '@/pages/Maintenance';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex flex-col min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <>
                <Navigation />
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/trucks" element={<Trucks />} />
                    <Route path="/drivers" element={<Drivers />} />
                    <Route path="/routes" element={<Routes />} />
                    <Route path="/schedule" element={<Schedule />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/maintenance" element={<Maintenance />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </main>
              </>
            } />
          </Routes>
        </div>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
