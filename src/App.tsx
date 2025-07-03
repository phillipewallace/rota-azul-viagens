
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MobileNavigation from "@/components/MobileNavigation";
import Index from "./pages/Index";
import Reports from "./pages/Reports";
import Schedule from "./pages/Schedule";
import Drivers from "./pages/Drivers";
import Management from "./pages/Management";
import Settings from "./pages/Settings";
import Trucks from "./pages/Trucks";
import RoutesPage from "./pages/Routes";
import Maintenance from "./pages/Maintenance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/management" element={<Management />} />
            <Route path="/trucks" element={<Trucks />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <MobileNavigation />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
