import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Creator from "./pages/Creator";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import Contact from "./pages/Contact";
import CreditPurchaseSuccess from "./pages/CreditPurchaseSuccess";
import Admin from "./pages/Admin";
import AdminCreateCustomerPage from "./pages/admin/CreateCustomer";
import ManageAmbassadors from "./pages/admin/ManageAmbassadors";
import Affiliate from "./pages/Affiliate";
import Profile from "./pages/Profile";
import DevenirPartenaire from "./pages/DevenirPartenaire";
import Privacy from "./pages/Privacy";
import Legal from "./pages/Legal";
import FAQ from "./pages/FAQ";
import BrandKitQuestionnaire from "./pages/BrandKitQuestionnaire";
import NotFound from "./pages/NotFound";
import Templates from "./pages/Templates";
import Library from "./pages/Library";
import Videos from "./pages/Videos";
import { AppLayoutWithSidebar } from "./components/AppLayoutWithSidebar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/devenir-partenaire" element={<DevenirPartenaire />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/faq" element={<FAQ />} />
          <Route
            path="/brand-kit-questionnaire"
            element={
              <ProtectedRoute>
                <AppLayoutWithSidebar>
                  <BrandKitQuestionnaire />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayoutWithSidebar>
                  <Creator />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <ProtectedRoute>
                <AppLayoutWithSidebar>
                  <Templates />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <AppLayoutWithSidebar>
                  <Library />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos"
            element={
              <ProtectedRoute>
                <AppLayoutWithSidebar>
                  <Videos />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayoutWithSidebar>
                  <Dashboard />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/affiliate"
            element={
              <ProtectedRoute>
                <AppLayoutWithSidebar>
                  <Affiliate />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppLayoutWithSidebar>
                  <Profile />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute allowPending>
                <AppLayoutWithSidebar>
                  <Billing />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/credit-purchase-success"
            element={
              <ProtectedRoute allowPending>
                <AppLayoutWithSidebar>
                  <CreditPurchaseSuccess />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AppLayoutWithSidebar>
                  <Admin />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/create-customer"
            element={
              <ProtectedRoute requireAdmin>
                <AppLayoutWithSidebar>
                  <AdminCreateCustomerPage />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ambassadors"
            element={
              <ProtectedRoute requireAdmin>
                <AppLayoutWithSidebar>
                  <ManageAmbassadors />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
