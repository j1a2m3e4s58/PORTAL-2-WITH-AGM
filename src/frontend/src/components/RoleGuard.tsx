import { userHasPermission } from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import type { Role, UserPermissions } from "@/types";
import type { ReactNode } from "react";

interface RoleGuardProps {
  roles?: Role[];
  permission?: keyof UserPermissions;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({
  roles,
  permission,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { user } = useAuth();
  if (!user) return <>{fallback}</>;
  if (roles && !roles.includes(user.role)) return <>{fallback}</>;
  if (permission && !userHasPermission(user, permission)) return <>{fallback}</>;
  return <>{children}</>;
}

export function useHasRole(roles: Role[], permission?: keyof UserPermissions): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (!roles.includes(user.role)) return false;
  if (permission && !userHasPermission(user, permission)) return false;
  return true;
}
