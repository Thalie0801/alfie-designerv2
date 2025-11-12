import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
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

/** ---------------- ChatWidget (guidance only) ---------------- **/
type Msg = { role: "user" | "assistant"; text: string; rich?: React.ReactNode };

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);

  // Palette Alfie
  const BRAND = useMemo(
    () =>
      ({
        mint: "#90E3C2",
        mintDark: "#66C9A6",
        light: "#F5F5F5",
        text: "#000000",
        grayBorder: "#e5e7eb",
        ink: "#1f2937",
      }) as const,
    [],
  );

  /** --------- Intent heuristics (no AI, fast) --------- */
  function detectIntent(raw: string) {
    const q = raw.toLowerCase();

    // type
    const isCarousel = /(carou?sel|slides?)/.test(q);
    const isVideo = /(vid[eé]o|shorts?|reels?)/.test(q);
    const isImage = /(image|visuel|thumbnail|miniature)/.test(q) && !isCarousel && !isVideo;
    const mode: "carousel" | "video" | "image" = isCarousel ? "carousel" : isVideo ? "video" : "image";

    // platform -> default ratio
    const platform =
      (/(instagram|insta)/.test(q) && "instagram") ||
      (/tiktok/.test(q) && "tiktok") ||
      (/pinterest/.test(q) && "pinterest") ||
      (/linkedin/.test(q) && "linkedin") ||
      (/youtube|shorts?/.test(q) && "youtube") ||
      null;

    const ratioFromText = q.match(/\b(1:1|9:16|16:9|3:4|4:5)\b/)?.[1] as
      | "1:1"
      | "9:16"
      | "16:9"
      | "3:4"
      | "4:5"
      | undefined;

    const defaultRatioByPlatform: Record<string, "1:1" | "9:16" | "16:9" | "4:5" | "3:4"> = {
      instagram: isCarousel ? "4:5" : "1:1",
      tiktok: "9:16",
      pinterest: isCarousel ? ("2:3" as any) : ("2:3" as any), // tailwind-free; on suggère 2:3 mais Studio propose voisins
      linkedin: "1:1",
      youtube: "16:9",
    };
    const ratio =
      ratioFromText ||
      (platform ? defaultRatioByPlatform[platform] || "1:1" : isVideo ? "9:16" : isCarousel ? "4:5" : "1:1");

    // tone
    const tone =
      (/(apple|minimal|sobre|premium)/.test(q) && "premium/minimal") ||
      (/(fun|joueuse|pop|émoji)/.test(q) && "fun") ||
      (/(b2b|pro|corporate)/.test(q) && "b2b") ||
      null;

    // slides / count
    const slides = (() => {
      const m = q.match(/(\d+)\s*(slides?|pages?)/);
      if (m) return Math.min(10, Math.max(3, parseInt(m[1], 10)));
      if (mode === "carousel") return 5;
      return undefined;
    })();

    // CTA
    const mCTA = q.match(/\b(cta|appel\s*à\s*l[’']?action)\s*:?["“”']?([^"“”']+)["“”']?/);
    const cta = mCTA?.[2]?.trim() || null;

    // topic (rough)
    const topic = q
      .replace(
        /(donne|donnez|propose|proposez|id[ée]es?|fais|fais-moi|fais moi|cr[ée]e?|g[ée]n[èe]re?|aide( moi)?)/g,
        "",
      )
      .replace(/(de|des|du|un|une|le|la|les|sur|pour|en|d’|l’)/g, " ")
      .trim();

    return { mode, platform, ratio, tone, slides, cta, topic: topic || "ton sujet" };
  }

  function outlineForCarousel(slides: number, topic: string) {
    const ideas = [
      {
        t: "Problème → Solution",
        s: ["Le problème clé", "Pourquoi ça bloque", "La méthode", "Exemple rapide", "CTA clair"],
      },
      { t: "5 erreurs à éviter", s: ["Erreur 1", "Erreur 2", "Erreur 3", "Erreur 4", "Erreur 5 + CTA"] },
      { t: "Checklist pratique", s: ["Étape 1", "Étape 2", "Étape 3", "Étape 4", "Résumé + CTA"] },
      {
        t: "Mythes vs Réalité",
        s: ["Mythe 1 → Réalité", "Mythe 2 → Réalité", "Mythe 3 → Réalité", "Conseil final", "CTA"],
      },
      { t: "Avant / Après", s: ["Avant (constat)", "Après (objectif)", "Étapes", "Résultat attendu", "CTA"] },
    ];
    const base = ideas[0];
    const seq = (
      base.s.length === slides
        ? base.s
        : [...base.s, ...Array(Math.max(0, slides - base.s.length)).fill("Conseil bonus")]
    ).slice(0, slides);
    return { title: base.t, slides: seq.map((x, i) => `${i + 1}. ${x}`) };
  }

  function studioLink(params: Record<string, string | number | undefined>) {
    const q = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    return `/studio?${q}`;
  }

  function makeAssistantReply(q: string): Msg {
    const it = detectIntent(q);

    if (it.mode === "carousel") {
      const slides = it.slides ?? 5;
      const plan = outlineForCarousel(slides, it.topic);
      const prompt = `Carrousel ${slides} slides sur "${it.topic}" — ton ${it.tone ?? "cohérent marque"} — plateforme ${it.platform ?? "générique"} — ratio ${it.ratio}.`;
      const href = studioLink({ mode: "carousel", ratio: it.ratio, prompt, slides });

      const rich = (
        <div className="space-y-2">
          <p>
            <strong>Ok, carrousel {slides} slides</strong> — ratio <strong>{it.ratio}</strong>
            {it.platform ? (
              <>
                {" "}
                — plateforme <strong>{it.platform}</strong>
              </>
            ) : null}
            {it.tone ? (
              <>
                {" "}
                — ton <strong>{it.tone}</strong>
              </>
            ) : null}
            .
          </p>
          <p className="text-sm">
            Thème détecté : <em>{it.topic}</em>
          </p>
          <div className="text-sm">
            <p className="font-medium">Structure suggérée : {plan.title}</p>
            <ul className="list-disc ml-5">
              {plan.slides.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm">
            {it.cta ? (
              <>
                CTA choisi : <strong>{it.cta}</strong>
              </>
            ) : (
              <>
                CTA suggéré : <strong>Découvrir</strong>
              </>
            )}
          </p>
          <a
            href={href}
            className="inline-block mt-1 px-3 py-2 rounded-md text-sm font-medium text-white"
            style={{ background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})` }}
          >
            Pré-remplir Studio
          </a>
        </div>
      );

      return { role: "assistant", text: "", rich };
    }

    if (it.mode === "video") {
      const prompt = `Vidéo courte sur "${it.topic}" — ratio ${it.ratio} — plateforme ${it.platform ?? "générique"} — ton ${it.tone ?? "cohérent marque"}. Hook + 3 points + CTA.`;
      const href = studioLink({ mode: "video", ratio: it.ratio, prompt });
      const rich = (
        <div className="space-y-2">
          <p>
            <strong>Vidéo courte</strong> — ratio <strong>{it.ratio}</strong>
            {it.platform ? (
              <>
                {" "}
                — <strong>{it.platform}</strong>
              </>
            ) : null}
            {it.tone ? (
              <>
                {" "}
                — ton <strong>{it.tone}</strong>
              </>
            ) : null}
            .
          </p>
          <div className="text-sm">
            <p className="font-medium">Plan express :</p>
            <ul className="list-disc ml-5">
              <li>Hook (3–5s) : bénéfice clair</li>
              <li>3 points clés (preuves, tips)</li>
              <li>CTA court : {it.cta ?? "En savoir plus"}</li>
            </ul>
          </div>
          <a
            href={href}
            className="inline-block mt-1 px-3 py-2 rounded-md text-sm font-medium text-white"
            style={{ background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})` }}
          >
            Pré-remplir Studio
          </a>
        </div>
      );
      return { role: "assistant", text: "", rich };
    }

    // image / visuel
    const prompt = `Visuel ${it.ratio} sur "${it.topic}" — ton ${it.tone ?? "cohérent marque"} — plateforme ${it.platform ?? "générique"} — CTA ${it.cta ?? "Découvrir"}.`;
    const href = studioLink({ mode: "image", ratio: it.ratio, prompt });
    const rich = (
      <div className="space-y-2">
        <p>
          <strong>Visuel</strong> — ratio <strong>{it.ratio}</strong>
          {it.platform ? (
            <>
              {" "}
              — <strong>{it.platform}</strong>
            </>
          ) : null}
          {it.tone ? (
            <>
              {" "}
              — ton <strong>{it.tone}</strong>
            </>
          ) : null}
          .
        </p>
        <div className="text-sm">
          <p className="font-medium">Suggestion :</p>
          <ul className="list-disc ml-5">
            <li>Titre court avec bénéfice</li>
            <li>Sous-titre preuve (chiffre, résultat)</li>
            <li>Badge ou CTA : {it.cta ?? "Découvrir"}</li>
          </ul>
        </div>
        <a
          href={href}
          className="inline-block mt-1 px-3 py-2 rounded-md text-sm font-medium text-white"
          style={{ background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})` }}
        >
          Pré-remplir Studio
        </a>
      </div>
    );
    return { role: "assistant", text: "", rich };
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    const reply = makeAssistantReply(text);
    setTimeout(() => setMsgs((m) => [...m, reply]), 120);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg w-12 h-12 grid place-items-center hover:scale-105 transition"
          style={{ background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})`, color: "white" }}
          aria-label="Ouvrir Alfie Chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[95vw] h-[520px] rounded-2xl shadow-2xl border flex flex-col"
          style={{ background: BRAND.light, borderColor: BRAND.grayBorder }}
        >
          <div
            className="flex items-center justify-between p-3 border-b"
            style={{ background: `${BRAND.mint}22`, borderColor: BRAND.grayBorder }}
          >
            <div className="font-medium" style={{ color: BRAND.text }}>
              Alfie Chat (conseils)
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded"
              style={{ color: BRAND.text }}
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2" style={{ color: BRAND.ink }}>
            {msgs.length === 0 ? (
              <p className="text-sm">Une idée en tête ? Je l’affine avec toi. La fabrication, c’est côté Studio ✨</p>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  <span
                    className={
                      "inline-block rounded-2xl px-3 py-2 text-sm align-top " +
                      (m.role === "user" ? "bg-white border" : "bg-[rgba(144,227,194,0.18)] border")
                    }
                    style={{ borderColor: BRAND.grayBorder }}
                  >
                    {m.rich ?? m.text}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-top border-t flex gap-2" style={{ borderColor: BRAND.grayBorder }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: BRAND.grayBorder }}
              placeholder="Pose une question…"
            />
            <button
              onClick={handleSend}
              className="px-3 py-2 rounded-md text-sm font-medium text-white"
              style={{ background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})` }}
              disabled={!input.trim()}
            >
              Envoyer
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** ---------------- Routes + placement du widget ---------------- **/
const AppRoutes = () => {
  const { pathname } = useLocation();
  // pas de bulle sur la landing ni sur la page auth
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

        {/* route chat historique (non listée dans la sidebar) */}
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

        {/* Redirection legacy */}
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
