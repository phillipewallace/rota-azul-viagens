import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmHost } from "@/lib/confirm";

// Componentes críticos (carregados imediatamente — auth + fallback)
import ProtectedRoute from "./components/ProtectedRoute";
import RouteFallback from "./components/RouteFallback";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import Login from "./pages/Login";

// Pages — lazy (code-splitting por rota)
const Index = lazy(() => import("./pages/Index"));
const Trucks = lazy(() => import("./pages/Trucks"));
const Drivers = lazy(() => import("./pages/Drivers"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const Settings = lazy(() => import("./pages/Settings"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MobileDriver = lazy(() => import("./pages/MobileDriver"));
const CreateRoute = lazy(() => import("./pages/CreateRoute"));
const Customers = lazy(() => import("./pages/Customers"));
const CompletedRoutes = lazy(() => import("./pages/CompletedRoutes"));
const Sanitarios = lazy(() => import("./pages/Sanitarios"));
const InternalManagement = lazy(() => import("./pages/InternalManagement"));
const Checklists = lazy(() => import("./pages/Checklists"));
const PublicChecklist = lazy(() => import("./pages/PublicChecklist"));
const Carretinhas = lazy(() => import("./pages/Carretinhas"));
const ErpQuotes = lazy(() => import("./pages/ErpQuotes"));
const ServiceOrders = lazy(() => import("./pages/ServiceOrders"));
const ErpLayout = lazy(() => import("./pages/erp/ErpLayout"));
const ErpDashboard = lazy(() => import("./pages/erp/ErpDashboard"));
const ErpCompanies = lazy(() => import("./pages/erp/ErpCompanies"));
const ErpFinanceiro = lazy(() => import("./pages/erp/ErpFinanceiro"));
const ErpContracts = lazy(() => import("./pages/erp/ErpContracts"));

// Ponto Digital (módulo REP-P)
const PontoLayout = lazy(() => import("./pages/ponto/PontoLayout"));
const PontoDashboard = lazy(() => import("./pages/ponto/PontoDashboard"));
const PontoRegistros = lazy(() => import("./pages/ponto/PontoRegistros"));
const PontoEspelho = lazy(() => import("./pages/ponto/PontoEspelho"));
const PontoJustificativas = lazy(() => import("./pages/ponto/PontoJustificativas"));
const PontoBancoHoras = lazy(() => import("./pages/ponto/PontoBancoHoras"));
const PontoFuncionarios = lazy(() => import("./pages/ponto/PontoFuncionarios"));
const PontoRelatorios = lazy(() => import("./pages/ponto/PontoRelatorios"));
const PontoConfiguracoes = lazy(() => import("./pages/ponto/PontoConfiguracoes"));

// Mobile Operator (lazy também — só pesa quando acessado)
const MobileOperatorMenuPage = lazy(
  () => import("./components/mobile/operator/MobileOperatorMenuPage"),
);

import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Helper para reduzir boilerplate de <ProtectedRoute>
const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ConfirmHost />
        <BrowserRouter>
          <RouteErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/mobile" element={<MobileDriver />} />
              <Route path="/checklist" element={<PublicChecklist />} />

              {/* Protected Routes */}
              <Route path="/" element={<Protected><Index /></Protected>} />
              <Route path="/trucks" element={<Protected><Trucks /></Protected>} />
              <Route path="/drivers" element={<Protected><Drivers /></Protected>} />
              <Route path="/routes" element={<Protected><RoutesPage /></Protected>} />
              <Route path="/routes/create" element={<Protected><CreateRoute /></Protected>} />
              <Route path="/routes/edit" element={<Protected><CreateRoute /></Protected>} />
              <Route path="/management" element={<Protected><Maintenance /></Protected>} />
              <Route path="/maintenance" element={<Protected><Maintenance /></Protected>} />
              <Route path="/settings" element={<Protected><Settings /></Protected>} />
              <Route path="/customers" element={<Protected><Customers /></Protected>} />
              <Route path="/rotas-concluidas" element={<Protected><CompletedRoutes /></Protected>} />
              <Route path="/sanitarios" element={<Protected><Sanitarios /></Protected>} />
              <Route path="/gestao-interna" element={<Protected><InternalManagement /></Protected>} />
              <Route path="/checklists" element={<Protected><Checklists /></Protected>} />
              <Route path="/carretinhas" element={<Protected><Carretinhas /></Protected>} />

              <Route path="/erp" element={<Protected><ErpLayout /></Protected>}>
                <Route index element={<ErpDashboard />} />
                <Route path="orcamentos" element={<ErpQuotes />} />
                <Route path="ordens-servico" element={<ServiceOrders />} />
                <Route path="financeiro" element={<ErpFinanceiro />} />
                <Route path="contratos" element={<ErpContracts />} />
                <Route path="clientes" element={<Customers />} />
                <Route path="estoque" element={<InternalManagement />} />
                <Route path="empresas" element={<ErpCompanies />} />
              </Route>

              <Route path="/ponto" element={<Protected><PontoLayout /></Protected>}>
                <Route index element={<PontoDashboard />} />
                <Route path="registros" element={<PontoRegistros />} />
                <Route path="espelho" element={<PontoEspelho />} />
                <Route path="justificativas" element={<PontoJustificativas />} />
                <Route path="banco-horas" element={<PontoBancoHoras />} />
                <Route path="funcionarios" element={<PontoFuncionarios />} />
                <Route path="relatorios" element={<PontoRelatorios />} />
                <Route path="configuracoes" element={<PontoConfiguracoes />} />
              </Route>

              <Route path="/operator/menu" element={<Protected><MobileOperatorMenuPage /></Protected>} />

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
