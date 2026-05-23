import type { UserRole } from "@/backend";
import { AppSplashScreen } from "@/components/AppSplashScreen";
import { useAuth } from "@/hooks/use-auth";
import { Navigate, useLocation } from "@tanstack/react-router";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const {
    user,
    isLoading,
    mustChangePassword,
    requiresPhoneVerification,
    sessionToken,
  } = useAuth();
  const location = useLocation();

  if (isLoading && sessionToken && user) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <AppSplashScreen label="Restoring secure session" />;
  }

  if (!sessionToken || !user) {
    return <Navigate to="/login" search={{ redirect: location.pathname }} />;
  }

  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" />;
  }

  if (requiresPhoneVerification && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}
