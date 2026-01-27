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
import RideHistory from "./pages/RideHistory";
import DriverDashboard from "./pages/DriverDashboard";
import DriverProfile from "./pages/DriverProfile";
import DriverHistory from "./pages/DriverHistory";
import DriverOnboarding from "./pages/DriverOnboarding";
import DriverFinancials from "./pages/DriverFinancials";
import CustomerProfileView from "./pages/CustomerProfileView";
import DriverProfileView from "./pages/DriverProfileView";
import LocationPermission from "./pages/LocationPermission";
import NotFound from "./pages/NotFound";
import DriverLayout from "./components/DriverLayout";
import { useState } from "react";

const queryClient = new QueryClient();

const App = () => {
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
            <Route path="/driver/onboarding" element={<DriverOnboarding />} />
            <Route path="/driver/auth" element={<DriverAuth />} />

            <Route path="/customer/dashboard" element={<CustomerDashboard />} />
            <Route path="/customer/profile" element={<CustomerProfile />} />
            <Route path="/customer/history" element={<RideHistory />} />
            <Route path="/customer/driver/:driverId" element={<DriverProfileView />} />

            {/* Driver Routes Protected by Layout */}
            <Route element={<DriverLayout />}>
              <Route path="/driver/dashboard" element={<DriverDashboard />} />
              <Route path="/driver/profile" element={<DriverProfile />} />
              <Route path="/driver/history" element={<DriverHistory />} />
              <Route path="/driver/financials" element={<DriverFinancials />} />
              <Route path="/driver/customer/:customerId" element={<CustomerProfileView />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/location-permission" element={<LocationPermission />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
