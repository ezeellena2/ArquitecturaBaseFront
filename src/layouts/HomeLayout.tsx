import { useAuth } from "react-oidc-context";
import { Outlet, useLocation } from "react-router";
import { Spinner } from "@/shared/ui/Spinner";
import { AppLayout } from "./AppLayout";
import { AuthLayout } from "./AuthLayout";
import { WelcomePage } from "@/features/auth/pages/WelcomePage";
import { useIsRecoveringSession } from "@/auth/sessionRecoveryStatus";
import { useIsSigningOut } from "@/auth/signOutStatus";

// Keep the dashboard URL for signed-in users, welcome visitors at the same address.
export function HomeLayout() {
  const auth = useAuth();
  const isRecovering = useIsRecoveringSession();
  const isSigningOut = useIsSigningOut();
  const { pathname } = useLocation();
  // Keep the sign-out transition mounted until /login is ready. Removing the OIDC user must not
  // expose ProtectedRoute, which would carry the previous account's private URL into the next login.
  if (auth.isAuthenticated || isSigningOut) { return <AppLayout />; }
  if (isRecovering || auth.isLoading) {
    return <div className="flex min-h-svh items-center justify-center"><Spinner /></div>;
  }
  return pathname === "/" ? <AuthLayout><WelcomePage /></AuthLayout> : <Outlet />;
}
