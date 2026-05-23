// Re-export backend types for convenience throughout the app
export type {
  Shareholder,
  ShareholderInput,
  SearchResult,
  Registration,
  RegistrationUpdate,
  ProxyData,
  CheckIn,
  AppUser,
  Session,
  AuditEntry,
  ImportBatch,
  BulkCreateResult,
  DashboardMetrics,
  AGMSettings,
  LoginResponse,
} from "@/backend";

export {
  CheckInMethod,
  ImportStatus,
  RegistrationType,
  ShareholderStatus,
  UserRole,
} from "@/backend";

// UI-only helper types
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface AuthState {
  user: import("@/backend").AppUser | null;
  sessionToken: string | null;
  isLoading: boolean;
  mustChangePassword: boolean;
}
