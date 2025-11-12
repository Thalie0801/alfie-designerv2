import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
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

const queryClient = new QueryClient();

/** --- ChatWidget inline (guidance uniquement) --- */
function ChatWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg bg-black text-white w-12 h-12 grid place-items-center hover:scale-105 transition"
          aria-label="Ouvrir Alfie Chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[95vw] h-[520px] rounded-2xl shadow-2xl border bg-white flex flex-col">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="font-medium">Alfie Chat (conseils)</div>
            <button onClick={() => setOpen(false)} className="p-2 rounded hover:bg-gray-100" aria-label="Fermer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-3">
            <p className="text-sm text-gray-600">
              Pose-moi une question sur tes visuels, formats, idées… Je ne lance pas la génération — je te guide.
            </p>
          </div>
          <div className="p-3 border-t">
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring"
              placeholder="Pose une question…"
            />
          </div>
        </div>
      )}
    </>
  );
}

const AppRoutes = () => {
  const { pathname } = useLocation();
  // ❗️On cache la bulle sur la landing et la page de connexion uniquement
  const hideChatWidget = pathname === "/" || pathname === "/auth";

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

        {/* Route historique du chat (conservée mais plus dans la sidebar) */}
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

        {/* Rediriger /app vers /studio */}
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

      {/* Bulle de chat visible uniquement "à l'intérieur" */}
      {!hideChatWidget && <ChatWidget />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <AuthProvider>
      <TooltipProvider>
        <AppRoutes />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
