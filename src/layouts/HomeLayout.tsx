import { useAuth } from "react-oidc-context";
import { Outlet, useLocation } from "react-router";
import { Spinner } from "@/shared/ui/Spinner";
import { AppLayout } from "./AppLayout";
import { AuthLayout } from "./AuthLayout";
import { WelcomePage } from "@/features/auth/pages/WelcomePage";
import { useIsRecoveringSession } from "@/auth/sessionRecoveryStatus";

// Keep the dashboard URL for signed-in users, welcome visitors at the same address.
export function HomeLayout() {
  const auth = useAuth();
  const isRecovering = useIsRecoveringSession();
  const { pathname } = useLocation();
  if (auth.isAuthenticated) { return <AppLayout />; }
  if (isRecovering || auth.isLoading) {
    return <div className="flex min-h-svh items-center justify-center"><Spinner /></div>;
  }
  return pathname === "/" ? <AuthLayout><WelcomePage /></AuthLayout> : <Outlet />;
}
