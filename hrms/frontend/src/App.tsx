import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "@/components/ProtectedRoute";
import CandidateDashboard from "./pages/CandidateDashboard";
import HrVerification from "./pages/HrVerification";
import ITAssetPage from "./pages/ITAsset";
import InductionPage from "./pages/Induction";
import ProbationPage from "./pages/Probation";
import UserProfile from "./pages/UserProfile";
import EditProfile from "./pages/EditProfile";
import WorkspaceSelect from "./pages/WorkspaceSelect";
// import EmployeeDetail from "./pages/EmployeeDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* <Route path="/dashboard/*" element={<Dashboard />} /> */}
<Route
  path="/workspace"
  element={
    <ProtectedRoute allowedRoles={["hr"]}>
      <WorkspaceSelect />
    </ProtectedRoute>
  }
/>

<Route
  path="/dashboard/*"
  element={
    <ProtectedRoute allowedRoles={["hr"]}>
      <Dashboard />
    </ProtectedRoute>
  }
/>

<Route
  path="/candidate"
  element={
    <ProtectedRoute allowedRoles={["candidate"]}>
      <CandidateDashboard />
    </ProtectedRoute>
  }
/>
<Route
  path="/candidate/profile"
  element={
    <ProtectedRoute allowedRoles={["candidate"]}>
      <UserProfile />
    </ProtectedRoute>
  }
/>
<Route
  path="/candidate/profile/edit"
  element={
    <ProtectedRoute allowedRoles={["candidate"]}>
      <EditProfile />
    </ProtectedRoute>
  }
/>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route
            path="/hr-verification"
            element={
              <ProtectedRoute allowedRoles={["candidate"]}>
                <HrVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/it-asset"
            element={
              <ProtectedRoute allowedRoles={["candidate"]}>
                <ITAssetPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/induction"
            element={
              <ProtectedRoute allowedRoles={["candidate"]}>
                <InductionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/probation"
            element={
              <ProtectedRoute allowedRoles={["candidate"]}>
                <ProbationPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
