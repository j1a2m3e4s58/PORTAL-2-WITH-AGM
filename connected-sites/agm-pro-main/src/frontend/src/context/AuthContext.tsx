import { createActor } from "@/backend";
import type { AppUser } from "@/backend";
import { buildClient } from "@/lib/backend-client";
import { storage } from "@/lib/storage";
import { useAppActor } from "@/lib/use-app-actor";
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FirstTimeVerificationState } from "@/lib/backend-client";

export interface AuthContextValue {
  user: AppUser | null;
  sessionToken: string | null;
  isLoading: boolean;
  mustChangePassword: boolean;
  requiresPhoneVerification: boolean;
  verificationPhoneNumber: string;
  login: (
    username: string,
    password: string,
  ) => Promise<{ mustChangePassword: boolean; requiresPhoneVerification: boolean }>;
  refreshFirstTimeVerification: () => Promise<FirstTimeVerificationState | null>;
  completeFirstTimeVerification: (
    phoneNumber: string,
    tokenCode: string,
  ) => Promise<void>;
  completePasswordChange: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_VALIDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const cachedUserAtBoot = storage.getUser<AppUser>();
const cachedSessionTokenAtBoot = storage.getSessionToken();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(cachedUserAtBoot);
  const [sessionToken, setSessionToken] = useState<string | null>(
    cachedSessionTokenAtBoot,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(
    cachedUserAtBoot?.mustChangePassword ?? false,
  );
  const [requiresPhoneVerification, setRequiresPhoneVerification] = useState(false);
  const [verificationPhoneNumber, setVerificationPhoneNumber] = useState("");
  const { actor, isFetching } = useAppActor(createActor);
  const actorRef = useRef(actor);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    actorRef.current = actor;
  }, [actor]);

  const clearAuth = useCallback(() => {
    storage.clearSession();
    setUser(null);
    setSessionToken(null);
    setMustChangePassword(false);
    setRequiresPhoneVerification(false);
    setVerificationPhoneNumber("");
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startSessionValidation = useCallback(
    (client: ReturnType<typeof buildClient>) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(async () => {
        try {
          await client.validateSession();
        } catch {
          clearAuth();
        }
      }, SESSION_VALIDATE_INTERVAL);
    },
    [clearAuth],
  );

  const waitForActor = useCallback(async () => {
    if (actorRef.current) return actorRef.current;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (actorRef.current) return actorRef.current;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return null;
  }, []);

  const refreshFirstTimeVerification = useCallback(async () => {
    const resolvedActor = actorRef.current ?? (await waitForActor());
    if (!resolvedActor || !storage.getSessionToken()) return null;
    const client = buildClient(resolvedActor);
    try {
      const state = await client.getFirstTimeVerificationState();
      setRequiresPhoneVerification(!state.isVerified);
      setVerificationPhoneNumber(state.phoneNumber ?? "");
      return state;
    } catch {
      setRequiresPhoneVerification(false);
      setVerificationPhoneNumber("");
      return null;
    }
  }, [waitForActor]);

  // Restore session on mount
  useEffect(() => {
    if (isFetching) return;
    const token = storage.getSessionToken();
    const cachedUser = storage.getUser<AppUser>();
    if (!actor) {
      if (!token) {
        setIsLoading(false);
      }
      return;
    }
    if (!token) {
      setIsLoading(false);
      return;
    }
    const client = buildClient(actor);
    client
      .validateSession()
      .then((session) => {
        setSessionToken(session.token);
        if (cachedUser) {
          setUser(cachedUser);
          setMustChangePassword(cachedUser.mustChangePassword);
        }
        startSessionValidation(client);
        void refreshFirstTimeVerification();
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => setIsLoading(false));
  }, [actor, isFetching, clearAuth, refreshFirstTimeVerification, startSessionValidation]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const login = useCallback(
    async (
      username: string,
      password: string,
    ): Promise<{
      mustChangePassword: boolean;
      requiresPhoneVerification: boolean;
    }> => {
      const resolvedActor = actorRef.current ?? (await waitForActor());
      if (!resolvedActor) throw new Error("Backend not ready");
      const client = buildClient(resolvedActor);
      const response = await client.login(username, password);
      storage.setSessionToken(response.token);
      setSessionToken(response.token);
      setMustChangePassword(response.mustChangePassword);
      // Build a partial AppUser from login response for immediate use
      const partialUser = {
        principal: "",
        username: response.username,
        role: response.role,
        isActive: true,
        passwordHash: "",
        createdAt: BigInt(0),
        mustChangePassword: response.mustChangePassword,
        phoneNumber: (
          response as unknown as AppUser & { phoneNumber?: string }
        ).phoneNumber,
        isPhoneVerified: (
          response as unknown as AppUser & { isPhoneVerified?: boolean }
        ).isPhoneVerified,
      } as AppUser;
      storage.setUser(partialUser);
      setUser(partialUser);
      startSessionValidation(client);
      let nextRequiresPhoneVerification = false;
      if (!response.mustChangePassword) {
        const verificationState = await client.getFirstTimeVerificationState();
        nextRequiresPhoneVerification = !verificationState.isVerified;
        setRequiresPhoneVerification(nextRequiresPhoneVerification);
        setVerificationPhoneNumber(verificationState.phoneNumber ?? "");
      } else {
        setRequiresPhoneVerification(false);
        setVerificationPhoneNumber("");
      }
      return {
        mustChangePassword: response.mustChangePassword,
        requiresPhoneVerification: nextRequiresPhoneVerification,
      };
    },
    [startSessionValidation, waitForActor],
  );

  const completeFirstTimeVerification = useCallback(
    async (phoneNumber: string, tokenCode: string) => {
      const resolvedActor = actorRef.current ?? (await waitForActor());
      if (!resolvedActor) throw new Error("Backend not ready");
      const client = buildClient(resolvedActor);
      await client.completeFirstTimeVerification(phoneNumber, tokenCode);
      setRequiresPhoneVerification(false);
      setVerificationPhoneNumber(phoneNumber.trim());
      if (user) {
        const updatedUser = {
          ...user,
          phoneNumber: phoneNumber.trim(),
          isPhoneVerified: true,
        } as AppUser;
        setUser(updatedUser);
        storage.setUser(updatedUser);
      }
    },
    [user, waitForActor],
  );

  const completePasswordChange = useCallback(async () => {
    setMustChangePassword(false);
    if (user) {
      const updatedUser = {
        ...user,
        mustChangePassword: false,
      };
      setUser(updatedUser);
      storage.setUser(updatedUser);
    }
    await refreshFirstTimeVerification();
  }, [refreshFirstTimeVerification, user]);

  const logout = useCallback(async () => {
    const resolvedActor = actorRef.current;
    if (resolvedActor) {
      const client = buildClient(resolvedActor);
      try {
        await client.logout();
      } catch {
        // ignore errors on logout
      }
    }
    clearAuth();
  }, [actor, clearAuth]);

  const value = useMemo(
    () => ({
      user,
      sessionToken,
      isLoading,
      mustChangePassword,
      requiresPhoneVerification,
      verificationPhoneNumber,
      login,
      refreshFirstTimeVerification,
      completeFirstTimeVerification,
      completePasswordChange,
      logout,
    }),
    [
      completeFirstTimeVerification,
      completePasswordChange,
      isLoading,
      login,
      logout,
      mustChangePassword,
      refreshFirstTimeVerification,
      requiresPhoneVerification,
      sessionToken,
      user,
      verificationPhoneNumber,
    ],
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}
