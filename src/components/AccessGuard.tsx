import { ReactNode, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type GuardMode = "block" | "redirect";

interface AccessGuardProps {
  children: ReactNode;

  /** Rendu pendant le chargement auth (par défaut: null) */
  loadingFallback?: ReactNode;

  /** Rendu si non-authentifié en mode "block" (sinon une alerte est affichée) */
  unauthenticatedFallback?: ReactNode;

  /** Rendu si authentifié mais permissions insuffisantes (sinon une alerte est affichée) */
  unauthorizedFallback?: ReactNode;

  /** Mode de guard: "block" (affiche l'alerte) ou "redirect" (redirige vers /auth) */
  mode?: GuardMode;

  /** Route cible pour le login */
  loginPath?: string;

  /** Si défini, ajoute ?returnTo=<current> pour revenir après login */
  enableReturnTo?: boolean;

  /** Exigences facultatives */
  requireEmailVerified?: boolean;
  requiredRoles?: string[]; // ex: ['admin'] ou ['editor','admin']
  requiredScopes?: string[]; // ex: ['library:read', 'generator:use']
}

export function AccessGuard({
  children,
  loadingFallback = null,
  unauthenticatedFallback,
  unauthorizedFallback,
  mode = "block",
  loginPath = "/auth",
  enableReturnTo = true,
  requireEmailVerified = false,
  requiredRoles,
  requiredScopes,
}: AccessGuardProps) {
  const { user, loading } = useAuth() as {
    user: null | {
      id: string;
      email?: string | null;
      email_verified?: boolean;
      roles?: string[];
      scopes?: string[];
    };
    loading: boolean;
  };

  const navigate = useNavigate();
  const location = useLocation();

  // Helpers autorisation
  const hasRequiredRoles = !requiredRoles?.length || requiredRoles.some((r) => user?.roles?.includes(r));

  const hasRequiredScopes = !requiredScopes?.length || requiredScopes.every((s) => user?.scopes?.includes(s));

  const emailVerifiedOk = !requireEmailVerified || !!user?.email_verified;

  const isAuthenticated = !!user;
  const isAuthorized = isAuthenticated && hasRequiredRoles && hasRequiredScopes && emailVerifiedOk;

  // Redirection automatique si demandé
  useEffect(() => {
    if (loading) return;
    if (mode !== "redirect") return;
    if (isAuthorized) return;

    // construit l’URL de login avec returnTo
    const redirectUrl =
      enableReturnTo && location.pathname !== loginPath
        ? `${loginPath}?returnTo=${encodeURIComponent(location.pathname + location.search)}`
        : loginPath;

    navigate(redirectUrl, { replace: true });
  }, [loading, mode, isAuthorized, navigate, location.pathname, location.search, loginPath, enableReturnTo]);

  // Loading
  if (loading) {
    return <>{loadingFallback}</>;
  }

  // Si mode redirect, on ne rend rien ici (la redirection est gérée dans l’effet)
  if (mode === "redirect") {
    return isAuthorized ? <>{children}</> : null;
  }

  // Mode "block": pas connecté
  if (!isAuthenticated) {
    if (unauthenticatedFallback) return <>{unauthenticatedFallback}</>;

    const handleLogin = () => {
      const url =
        enableReturnTo && location.pathname !== loginPath
          ? `${loginPath}?returnTo=${encodeURIComponent(location.pathname + location.search)}`
          : loginPath;
      navigate(url);
    };

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert role="alert" aria-live="polite" className="border-orange-500/50 bg-orange-50 dark:bg-orange-900/20">
          <Lock className="h-5 w-5 text-orange-600" aria-hidden />
          <AlertTitle className="text-orange-700 dark:text-orange-300 font-semibold">Connexion requise</AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300 mt-2">
            Veuillez vous authentifier pour continuer.
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={handleLogin} variant="default">
                Se connecter
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Mode "block": connecté mais non autorisé
  if (!isAuthorized) {
    if (unauthorizedFallback) return <>{unauthorizedFallback}</>;

    const reasons: string[] = [];
    if (requireEmailVerified && !emailVerifiedOk) reasons.push("email non vérifié");
    if (requiredRoles?.length && !hasRequiredRoles) reasons.push("rôle manquant");
    if (requiredScopes?.length && !hasRequiredScopes) reasons.push("permissions insuffisantes");

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert role="alert" aria-live="polite" className="border-red-500/50 bg-red-50 dark:bg-red-900/20">
          <Lock className="h-5 w-5 text-red-600" aria-hidden />
          <AlertTitle className="text-red-700 dark:text-red-300 font-semibold">Accès refusé</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300 mt-2">
            Vous êtes connecté, mais vous n’avez pas les autorisations nécessaires
            {reasons.length ? ` (${reasons.join(", ")})` : ""}.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // OK
  return <>{children}</>;
}
