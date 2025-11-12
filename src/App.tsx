import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import Contact from "./pages/Contact";
import CreditPurchaseSuccess from "./pages/CreditPurchaseSuccess";
import Admin from "./pages/Admin";
import AdminCreateCustomerPage from "./pages/admin/CreateCustomer";
import ManageAmbassadors from "./pages/admin/ManageAmbassadors";
import ResetUserPassword from "./pages/admin/ResetUserPassword";
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
import CloudinaryTest from "./pages/CloudinaryTest";
import ActivateAccess from "./pages/onboarding/Activate";
import { AlfieChat } from "./components/AlfieChat";
import { AppLayoutWithSidebar } from "./components/AppLayoutWithSidebar";
import { ChatGenerator } from "@/features/studio";

// Lazy load du ChatWidget
const ChatWidget = lazy(() => import("@/components/chat/ChatWidget"));

const queryClient = new QueryClient();

const AppRoutes = () => {
  return (
    <>
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
          path="/cloudinary-test"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <CloudinaryTest />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <AlfieChat />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <ChatGenerator />
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
          path="/admin/manage-ambassadors"
          element={
            <ProtectedRoute requireAdmin>
              <AppLayoutWithSidebar>
                <ManageAmbassadors />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reset-password"
          element={
            <ProtectedRoute requireAdmin>
              <AppLayoutWithSidebar>
                <ResetUserPassword />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/activate"
          element={
            <ProtectedRoute allowPending={true}>
              <AppLayoutWithSidebar>
                <ActivateAccess />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

// UNE SEULE définition de App
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
          {/* ChatWidget en lazy loading, à l'intérieur de TooltipProvider */}
          <Suspense fallback={null}>
            <ChatWidget />
          </Suspense>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
