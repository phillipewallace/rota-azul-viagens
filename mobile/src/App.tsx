
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from 'sonner';
import MobileDriver from './pages/MobileDriver';
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
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <Toaster 
          position="top-center"
          toastOptions={{
            className: 'bg-card text-card-foreground border-border',
          }}
        />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MobileDriver />} />
            <Route path="/driver" element={<MobileDriver />} />
          </Routes>
        </BrowserRouter>
      </div>
    </QueryClientProvider>
  );
};

export default App;
