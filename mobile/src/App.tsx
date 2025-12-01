
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import MobileDriver from './pages/MobileDriver';
import { initializeShareHandler } from './utils/shareHandler';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

const App = () => {
  useEffect(() => {
    // Inicializar handler de compartilhamento quando app montar
    initializeShareHandler();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<MobileDriver />} />
            <Route path="/driver" element={<MobileDriver />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
