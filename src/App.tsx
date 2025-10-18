import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AffiliateTracker } from "@/components/AffiliateTracker";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Creator from "./pages/Creator";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import Contact from "./pages/Contact";
import CreditPurchaseSuccess from "./pages/CreditPurchaseSuccess";
import Admin from "./pages/Admin";
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
import { AppLayoutWithSidebar } from "./components/AppLayoutWithSidebar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AffiliateTracker />
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
              <ProtectedRoute requirePlan>
                <AppLayoutWithSidebar>
                  <Creator />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <ProtectedRoute requirePlan>
                <AppLayoutWithSidebar>
                  <Templates />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/library"
            element={
              <ProtectedRoute requirePlan>
                <AppLayoutWithSidebar>
                  <Library />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requirePlan>
                <AppLayoutWithSidebar>
                  <Dashboard />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/affiliate"
            element={
              <ProtectedRoute requirePlan>
                <AppLayoutWithSidebar>
                  <Affiliate />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute requirePlan>
                <AppLayoutWithSidebar>
                  <Profile />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <AppLayoutWithSidebar>
                  <Billing />
                </AppLayoutWithSidebar>
              </ProtectedRoute>
            }
          />
          <Route
            path="/credit-purchase-success"
            element={
              <ProtectedRoute>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
