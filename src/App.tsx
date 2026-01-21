import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import RoleSelection from "./pages/RoleSelection";
import CustomerAuth from "./pages/CustomerAuth";
import DriverAuth from "./pages/DriverAuth";
import CustomerDashboard from "./pages/CustomerDashboard";
import CustomerProfile from "./pages/CustomerProfile";
import DriverDashboard from "./pages/DriverDashboard";
import CustomerProfileView from "./pages/CustomerProfileView";
import DriverProfile from "./pages/DriverProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  console.log("App component rendering...");
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/role-selection" element={<RoleSelection />} />
            <Route path="/customer/auth" element={<CustomerAuth />} />
            <Route path="/driver/auth" element={<DriverAuth />} />
            <Route path="/customer/dashboard" element={<CustomerDashboard />} />
            <Route path="/customer/profile" element={<CustomerProfile />} />
            <Route path="/driver/dashboard" element={<DriverDashboard />} />
            <Route path="/driver/profile" element={<DriverProfile />} />
            <Route path="/driver/customer/:customerId" element={<CustomerProfileView />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );

};

export default App;
