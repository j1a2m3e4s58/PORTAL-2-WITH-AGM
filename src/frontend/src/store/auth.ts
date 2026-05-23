import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import {
  apiGetMyProfile,
  apiLogout,
  apiSetPresenceOffline,
  apiSyncCachedUser,
  apiUpdateLastSeen,
} from "@/lib/backend-client";
import type { User } from "../types";

// ── Theme ─────────────────────────────────────────────────────────────────────

type ThemeMode = "light" | "dark";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// ── Auth Storage ──────────────────────────────────────────────────────────────

const AUTH_KEY = "bcb_auth_user";
const THEME_KEY = "bcb_theme";
const AUTH_EXPIRY_KEY = "bcb_auth_expiry";
const AUTH_ACTIVITY_KEY = "bcb_last_activity";
const SESSION_EXPIRED_EVENT = "bcb:session-expired";
const USERS_UPDATED_EVENT = "bcb:users-updated";
const REMEMBER_DAYS = 30;
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const PRESENCE_PING_MS = 4 * 1000;
const PRESENCE_IDLE_MS = 10 * 60 * 1000;
const PRESENCE_CHECK_MS = 5 * 1000;
const PROFILE_SYNC_MS = 15 * 1000;

function markActivity(timestamp = Date.now()) {
  try {
    localStorage.setItem(AUTH_ACTIVITY_KEY, String(timestamp));
  } catch {
    // Ignore storage failures to keep the app usable.
  }
}

function loadStoredUser(): User | null {
  try {
    const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
    if (expiry && Date.now() > Number(expiry)) {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(AUTH_EXPIRY_KEY);
      localStorage.removeItem(AUTH_ACTIVITY_KEY);
      return null;
    }
    const lastActivity = localStorage.getItem(AUTH_ACTIVITY_KEY);
    if (lastActivity && Date.now() - Number(lastActivity) > INACTIVITY_LIMIT_MS) {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(AUTH_EXPIRY_KEY);
      localStorage.removeItem(AUTH_ACTIVITY_KEY);
      return null;
    }
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    // Re-hydrate bigints
    parsed.lastSeen = BigInt(parsed.lastSeen ?? 0);
    parsed.registrationTime = BigInt(parsed.registrationTime ?? 0);
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredUser(user: User, remember: boolean, updateActivity = true) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    if (updateActivity) {
      markActivity();
    }
    if (remember) {
      const expiry = Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(AUTH_EXPIRY_KEY, String(expiry));
    }
  } catch {
    // Ignore storage failures to keep the in-memory session alive.
  }
}

function clearStoredUser() {
  try {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_EXPIRY_KEY);
    localStorage.removeItem(AUTH_ACTIVITY_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function liveSyncSignature(user: User | null): string {
  if (!user) return "";
  return JSON.stringify({
    id: user.id,
    fullname: user.fullname,
    phone: user.phone,
    email: user.email,
    branch: user.branch,
    department: user.department,
    role: user.role,
    position: user.position,
    isActive: user.isActive,
    isArchived: user.isArchived,
    imageFile: user.imageFile ?? null,
    managedBranches: user.managedBranches ?? [],
    managedDepartmentsByBranch: user.managedDepartmentsByBranch ?? {},
    permissions: user.permissions,
  });
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (user: User, remember?: boolean) => void;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  themeMode: ThemeMode;
  toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => loadStoredUser());
  const [isLoading] = useState(false);
  const authSessionRef = useRef(0);
  const userRef = useRef<User | null>(user);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      return stored ?? "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    const handleSessionExpired = () => {
      authSessionRef.current += 1;
      setUser(null);
      clearStoredUser();
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const sessionId = authSessionRef.current;
    let cancelled = false;
    let timeoutId: number | undefined;
    let lastPing = 0;
    let lastActivityAt = Date.now();
    let presenceOnline = false;
    let presenceOfflinePending = false;

    const persistPresenceState = (updatedUser: User) => {
      if (cancelled || authSessionRef.current !== sessionId) return;
      const latestUser = userRef.current ?? user;
      const mergedUser = {
        ...latestUser,
        isOnlineNow: updatedUser.isOnlineNow,
        lastSeen: updatedUser.lastSeen,
        sessionToken:
          updatedUser.sessionToken ??
          latestUser?.sessionToken ??
          user.sessionToken,
      };
      setUser(mergedUser);
      const remember = !!localStorage.getItem(AUTH_EXPIRY_KEY);
      saveStoredUser(mergedUser, remember, false);
    };

    const sessionToken = user.sessionToken ?? null;

    const pingPresence = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastPing < PRESENCE_PING_MS) return;
      lastPing = now;
      const result = await apiUpdateLastSeen(user.id);
      if (cancelled || authSessionRef.current !== sessionId) return;
      if ("ok" in result) {
        presenceOnline = true;
        persistPresenceState(result.ok);
      }
    };

    const setPresenceOffline = async () => {
      if (presenceOfflinePending || !presenceOnline) return;
      presenceOfflinePending = true;
      try {
        await apiSetPresenceOffline(user.id, sessionToken);
      } finally {
        if (!cancelled && authSessionRef.current === sessionId) {
          presenceOnline = false;
        }
        presenceOfflinePending = false;
      }
    };

    const scheduleTimeout = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        if (cancelled || authSessionRef.current !== sessionId) return;
        void setPresenceOffline();
        setUser(null);
        clearStoredUser();
      }, INACTIVITY_LIMIT_MS);
    };

    const handleActivity = () => {
      const now = Date.now();
      lastActivityAt = now;
      markActivity(now);
      scheduleTimeout();
      if (document.visibilityState === "visible") {
        void pingPresence(!presenceOnline || presenceOfflinePending);
      }
    };

    handleActivity();

    const intervalId = window.setInterval(() => {
      if (cancelled || authSessionRef.current !== sessionId) return;
      const lastActivity = Number(localStorage.getItem(AUTH_ACTIVITY_KEY) ?? "0");
      if (!lastActivity || Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
        void setPresenceOffline();
        setUser(null);
        clearStoredUser();
        return;
      }
      if (document.visibilityState !== "visible") {
        void setPresenceOffline();
        return;
      }
      if (Date.now() - lastActivityAt > PRESENCE_IDLE_MS) {
        void setPresenceOffline();
        return;
      }
      void pingPresence(false);
    }, PRESENCE_CHECK_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        handleActivity();
      } else {
        void setPresenceOffline();
      }
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("focus", handleActivity);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("focus", handleActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  const login = useCallback((newUser: User, remember = true) => {
    authSessionRef.current += 1;
    userRef.current = newUser;
    apiSyncCachedUser(newUser);
    setUser(newUser);
    saveStoredUser(newUser, remember);
    window.dispatchEvent(new CustomEvent(USERS_UPDATED_EVENT));
  }, []);

  const logout = useCallback(async () => {
    const currentUserId = user?.id;
    const currentSessionToken = user?.sessionToken ?? null;
    if (currentUserId) {
      try {
        await Promise.race([
          apiLogout(currentUserId, currentSessionToken),
          new Promise((resolve) => window.setTimeout(resolve, 1500)),
        ]);
      } catch {
        // Ignore logout API failures so the local session can still clear.
      }
    }
    authSessionRef.current += 1;
    userRef.current = null;
    setUser(null);
    clearStoredUser();
    window.dispatchEvent(new CustomEvent(USERS_UPDATED_EVENT));
  }, [user]);

  const updateUser = useCallback((updatedUser: User) => {
    const latestUser = userRef.current;
    const mergedUser = {
      ...updatedUser,
      sessionToken: updatedUser.sessionToken ?? latestUser?.sessionToken,
    };
    userRef.current = mergedUser;
    apiSyncCachedUser(mergedUser);
    setUser(mergedUser);
    const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
    saveStoredUser(mergedUser, !!expiry);
    window.dispatchEvent(new CustomEvent(USERS_UPDATED_EVENT));
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let syncInFlight = false;

    const syncProfile = async () => {
      if (document.visibilityState !== "visible" || syncInFlight) return;
      syncInFlight = true;
      try {
        const profile = await apiGetMyProfile(user.id);
        if (cancelled || !profile) return;
        const current = userRef.current;
        if (liveSyncSignature(profile) !== liveSyncSignature(current)) {
          updateUser(profile);
        }
      } catch {
        // Keep current local auth state when sync is temporarily unavailable.
      } finally {
        syncInFlight = false;
      }
    };

    void syncProfile();
    const intervalId = window.setInterval(() => {
      void syncProfile();
    }, PROFILE_SYNC_MS);

    const handleFocus = () => {
      void syncProfile();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncProfile();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user?.id, updateUser]);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }, []);

  const value: AuthContextValue = {
    user,
    isLoggedIn: !!user,
    isLoading,
    login,
    logout,
    updateUser,
    themeMode,
    toggleTheme,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
