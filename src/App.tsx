
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/hooks/use-toast";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import Index from "./pages/Index";
import Routes as RoutesPage from "./pages/Routes";
import Trucks from "./pages/Trucks";
import Drivers from "./pages/Drivers";
import Schedule from "./pages/Schedule";
import Reports from "./pages/Reports";
import Maintenance from "./pages/Maintenance";
import Management from "./pages/Management";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import MobileDriver from "./pages/MobileDriver";

// OTIMIZAÇÃO: Configuração otimizada do React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos - aumentado
      gcTime: 10 * 60 * 1000, // 10 minutos - cache mais longo
      retry: 2,
      refetchOnWindowFocus: false, // OTIMIZAÇÃO: Reduzir refetch desnecessário
      refetchOnMount: 'always',
      refetchInterval: false, // CORREÇÃO: Sem polling automático
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/mobile" element={<MobileDriver />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/routes"
              element={
                <ProtectedRoute>
                  <RoutesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trucks"
              element={
                <ProtectedRoute>
                  <Trucks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/drivers"
              element={
                <ProtectedRoute>
                  <Drivers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/schedule"
              element={
                <ProtectedRoute>
                  <Schedule />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/maintenance"
              element={
                <ProtectedRoute>
                  <Maintenance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/management"
              element={
                <ProtectedRoute>
                  <Management />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
