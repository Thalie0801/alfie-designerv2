import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import VerifyReset from "./pages/VerifyReset";
import Quiz from "./pages/Quiz";
import Start from "./pages/Start";
import FreePack from "./pages/FreePack";
import Pack from "./pages/Pack";
import CheckoutExpress from "./pages/CheckoutExpress";
import UpsellVisuels from "./pages/UpsellVisuels";
import UpsellVisuelsDelivery from "./pages/UpsellVisuelsDelivery";

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
import BrandKit from "./pages/BrandKit";
import NotFound from "./pages/NotFound";
import Templates from "./pages/Templates";
import Library from "./pages/Library";
import CloudinaryTest from "./pages/CloudinaryTest";
import Creator from "./pages/Creator";
import Documentation from "./pages/Documentation";

import ActivateAccess from "./pages/onboarding/Activate";
import { AppLayoutWithSidebar } from "./components/AppLayoutWithSidebar";
import { ChatGenerator } from "@/features/studio";
import { StudioGenerator } from "@/pages/StudioGenerator";
import ChatWidget from "./components/chat/ChatWidget";
import StudioMulti from "./pages/StudioMulti";
import AITools from "./pages/AITools";
import JobConsolePage from "./pages/JobConsolePage";
import PromptOptimizer from "./pages/PromptOptimizer";

const queryClient = new QueryClient();
const PUBLIC_ROUTES_WITH_PROSPECT_BUBBLE = new Set(["/", "/auth"]);

const AppRoutes = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/start" element={<Start />} />
        <Route path="/free-pack" element={<FreePack />} />
        <Route path="/pack" element={<Pack />} />
        <Route path="/checkout/express" element={<CheckoutExpress />} />
        <Route path="/upsell-visuels" element={<UpsellVisuels />} />
        <Route path="/upsell-visuels/delivery" element={<UpsellVisuelsDelivery />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/verify-reset" element={<VerifyReset />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/devenir-partenaire" element={<DevenirPartenaire />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/faq" element={<FAQ />} />
        <Route
          path="/documentation"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <Documentation />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />
        {/* Legacy /guide route redirects to Documentation */}
        <Route path="/guide" element={<Navigate to="/documentation" replace />} />

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
          path="/brand-kit"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <BrandKit />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <StudioGenerator />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/studio-legacy"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <ChatGenerator />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/creator"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <Creator />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/studio/multi"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <StudioMulti />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/studio/tools"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <AITools />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/prompt-optimizer"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <PromptOptimizer />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/jobs/:jobId"
          element={
            <ProtectedRoute>
              <AppLayoutWithSidebar>
                <JobConsolePage />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />

        <Route path="/app" element={<Navigate to="/studio" replace />} />

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
        {/* Legacy /videos route redirects to Studio */}
        <Route path="/videos" element={<Navigate to="/studio" replace />} />
        <Route
          path="/cloudinary-test"
          element={
            <ProtectedRoute requireAdmin>
              <CloudinaryTest />
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
            <ProtectedRoute allowPending requireActivePlan={false}>
              <AppLayoutWithSidebar>
                <Billing />
              </AppLayoutWithSidebar>
            </ProtectedRoute>
          }
        />
        <Route
          path="/credit-purchase-success"
          element={
            <ProtectedRoute allowPending requireActivePlan={false}>
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
            <ProtectedRoute allowPending requireActivePlan={false}>
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

const App = () => {
  const location = useLocation();
  const shouldShowChatWidget = !PUBLIC_ROUTES_WITH_PROSPECT_BUBBLE.has(location.pathname);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <TooltipProvider>
          <AppRoutes />
          {shouldShowChatWidget && <ChatWidget />}
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
