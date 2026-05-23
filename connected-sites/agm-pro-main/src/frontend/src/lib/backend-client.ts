import { createActor } from "@/backend";
import type {
  AGMSettings,
  AppUser,
  AuditEntry,
  BulkCreateResult,
  CheckIn,
  DashboardMetrics,
  ImportBatch,
  LoginResponse,
  ProxyData,
  Registration,
  RegistrationUpdate,
  SearchResult,
  Session,
  Shareholder,
  ShareholderInput,
} from "@/backend";
import {
  CheckInMethod,
  ImportStatus,
  RegistrationType,
  ShareholderStatus,
  UserRole,
} from "@/backend";
import {
  buildQueuedRegistration,
  enqueuePendingAction,
  syncPendingActions,
  type OfflineExecutor,
} from "./offline-queue";
import { storage } from "./storage";
import { useAppActor } from "./use-app-actor";

// Re-export enums for convenience
export {
  CheckInMethod,
  ImportStatus,
  RegistrationType,
  ShareholderStatus,
  UserRole,
};
export type {
  AGMSettings,
  AppUser,
  AuditEntry,
  BulkCreateResult,
  CheckIn,
  DashboardMetrics,
  ImportBatch,
  LoginResponse,
  ProxyData,
  Registration,
  RegistrationUpdate,
  SearchResult,
  Session,
  Shareholder,
  ShareholderInput,
};

export class SessionExpiredError extends Error {
  constructor() {
    super("SESSION_EXPIRED");
    this.name = "SessionExpiredError";
  }
}

export type FirstTimeVerificationState = {
  phoneNumber: string;
  tokenHint: string;
  isVerified: boolean;
};

export type AgmYearRecord = {
  year: string;
  isLocked: boolean;
  isArchived: boolean;
  createdAt: bigint;
  createdBy: string;
  lockedAt?: bigint;
  lockedBy?: string;
  archivedAt?: bigint;
  archivedBy?: string;
  clonedFromYear?: string;
  settingsSnapshot: AGMSettings;
};

type OkErr<T> = { __kind__: "ok"; ok: T } | { __kind__: "err"; err: string };

function unwrapResult<T>(result: OkErr<T>): T {
  if (result.__kind__ === "err") {
    if (
      result.err.includes("SESSION_EXPIRED") ||
      result.err.includes("Invalid session") ||
      result.err.includes("Session expired")
    ) {
      throw new SessionExpiredError();
    }
    throw new Error(result.err);
  }
  return result.ok;
}

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function shouldQueueError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch") ||
    message.includes("offline")
  );
}

// useBackendClient hook — returns a typed client from the actor
export function useBackendActor() {
  return useAppActor(createActor);
}

// Standalone client builder (for use in hooks)
export function buildClient(actor: ReturnType<typeof createActor>) {
  const token = () => storage.getSessionToken() ?? "";
  const currentUsername = () =>
    storage.getUser<AppUser>()?.username ?? "offline-queue";
  const usesDirectOperatorIdentity = () =>
    typeof actor === "object" &&
    actor !== null &&
    "createUserWithPhone" in actor;
  const operatorIdentity = () =>
    usesDirectOperatorIdentity() ? currentUsername() : token();

  const immediate: OfflineExecutor = {
    async registerShareholder(
      shareholderId: string,
      regType: RegistrationType,
      proxyData: ProxyData | null,
    ) {
      const result = await actor.registerShareholder(
        shareholderId,
        regType,
        proxyData,
        operatorIdentity(),
      );
      return unwrapResult(result);
    },
    async updateRegistration(id: string, updates: RegistrationUpdate) {
      const result = await actor.updateRegistration(
        id,
        updates,
        operatorIdentity(),
      );
      return unwrapResult(result);
    },
    async cancelRegistration(id: string, reason: string) {
      const result = await actor.cancelRegistration(
        id,
        operatorIdentity(),
        reason,
      );
      unwrapResult(result);
    },
    async validateProxyProof(
      registrationId: string,
      validated: boolean,
      fraudFlags: string[],
    ) {
      const result = await actor.validateProxyProof(
        registrationId,
        validated,
        fraudFlags,
        operatorIdentity(),
      );
      return unwrapResult(result);
    },
    async checkInShareholder(
      shareholderId: string,
      registrationId: string,
      method: CheckInMethod,
    ) {
      const result = await actor.checkInShareholder(
        shareholderId,
        registrationId,
        method,
        operatorIdentity(),
      );
      return unwrapResult(result);
    },
  };

  return {
    // Auth
    async login(username: string, password: string): Promise<LoginResponse> {
      const result = await actor.login(username, password);
      return unwrapResult(result);
    },
    async logout(): Promise<void> {
      const t = token();
      if (t) await actor.logout(t);
      storage.clearSession();
    },
    async changePassword(
      username: string,
      oldPassword: string,
      newPassword: string,
    ): Promise<void> {
      void username;
      const result = await (
        actor as typeof actor & {
          changePasswordSecure?: (
            sessionToken: string,
            currentPassword: string,
            nextPassword: string,
          ) => Promise<OkErr<void>>;
        }
      ).changePasswordSecure?.(token(), oldPassword, newPassword);
      if (!result) {
        const legacyResult = await actor.changePassword(
          username,
          oldPassword,
          newPassword,
        );
        unwrapResult(legacyResult);
        return;
      }
      unwrapResult(result);
    },
    async resetPassword(
      username: string,
      resetCode: string,
      newPassword: string,
    ): Promise<void> {
      const result = await actor.resetPasswordWithCode(
        username,
        resetCode,
        newPassword,
      );
      unwrapResult(result);
    },
    async getFirstTimeVerificationState(): Promise<FirstTimeVerificationState> {
      const verificationActor = actor as typeof actor & {
        getFirstTimeVerificationState?: (
          sessionToken: string,
        ) => Promise<OkErr<FirstTimeVerificationState>>;
      };
      if (!verificationActor.getFirstTimeVerificationState) {
        throw new Error("FIRST_TIME_VERIFICATION_UNAVAILABLE");
      }
      return unwrapResult(
        await verificationActor.getFirstTimeVerificationState(token()),
      );
    },
    async completeFirstTimeVerification(
      phoneNumber: string,
      tokenCode: string,
    ): Promise<void> {
      const verificationActor = actor as typeof actor & {
        completeFirstTimeVerification?: (
          sessionToken: string,
          phoneNumber: string,
          tokenCode: string,
        ) => Promise<OkErr<void>>;
      };
      if (!verificationActor.completeFirstTimeVerification) {
        throw new Error("FIRST_TIME_VERIFICATION_UNAVAILABLE");
      }
      unwrapResult(
        await verificationActor.completeFirstTimeVerification(
          token(),
          phoneNumber,
          tokenCode,
        ),
      );
    },
    async validateSession(): Promise<Session> {
      const result = await actor.validateSession(token());
      return unwrapResult(result);
    },

    // Settings
    async getSettings(): Promise<AGMSettings> {
      return actor.getSettings();
    },
    async updateSettings(settings: AGMSettings): Promise<AGMSettings> {
      const result = await actor.updateSettings(token(), settings);
      return unwrapResult(result);
    },
    async getYearRegistry(): Promise<AgmYearRecord[]> {
      const governanceActor = actor as typeof actor & {
        getYearRegistry?: (sessionToken: string) => Promise<OkErr<AgmYearRecord[]>>;
      };
      if (!governanceActor.getYearRegistry) {
        return [];
      }
      return unwrapResult(await governanceActor.getYearRegistry(token()));
    },
    async updateYearRecord(
      year: string,
      updates: { isLocked?: boolean; isArchived?: boolean },
    ): Promise<AgmYearRecord> {
      const governanceActor = actor as typeof actor & {
        updateYearRecord?: (
          sessionToken: string,
          year: string,
          updates: { isLocked?: boolean; isArchived?: boolean },
        ) => Promise<OkErr<AgmYearRecord>>;
      };
      if (!governanceActor.updateYearRecord) {
        throw new Error("YEAR_GOVERNANCE_UNAVAILABLE");
      }
      return unwrapResult(
        await governanceActor.updateYearRecord(token(), year, updates),
      );
    },
    async cloneYearSettings(fromYear: string, toYear: string): Promise<AgmYearRecord> {
      const governanceActor = actor as typeof actor & {
        cloneYearSettings?: (
          sessionToken: string,
          fromYear: string,
          toYear: string,
        ) => Promise<OkErr<AgmYearRecord>>;
      };
      if (!governanceActor.cloneYearSettings) {
        throw new Error("YEAR_GOVERNANCE_UNAVAILABLE");
      }
      return unwrapResult(
        await governanceActor.cloneYearSettings(token(), fromYear, toYear),
      );
    },
    async recordAuditEvent(
      action: string,
      entityType: string,
      entityId: string,
      details: string,
    ): Promise<void> {
      const auditActor = actor as typeof actor & {
        recordAuditEvent?: (
          sessionToken: string,
          action: string,
          entityType: string,
          entityId: string,
          details: string,
        ) => Promise<OkErr<null>>;
      };
      if (!auditActor.recordAuditEvent) return;
      unwrapResult(
        await auditActor.recordAuditEvent(
          token(),
          action,
          entityType,
          entityId,
          details,
        ),
      );
    },

    // Dashboard
    async getDashboardMetrics(
      quorumThreshold: bigint,
    ): Promise<DashboardMetrics> {
      return actor.getDashboardMetrics(quorumThreshold);
    },

    // Shareholders
    async getAllShareholders(): Promise<Shareholder[]> {
      const secureActor = actor as typeof actor & {
        getAllShareholdersSecure?: (sessionToken: string) => Promise<OkErr<Shareholder[]>>;
      };
      if (secureActor.getAllShareholdersSecure) {
        return unwrapResult(await secureActor.getAllShareholdersSecure(token()));
      }
      return actor.getAllShareholders();
    },
    async getShareholder(id: string): Promise<Shareholder | null> {
      const secureActor = actor as typeof actor & {
        getShareholderSecure?: (
          sessionToken: string,
          shareholderId: string,
        ) => Promise<OkErr<Shareholder | null>>;
      };
      if (secureActor.getShareholderSecure) {
        return unwrapResult(await secureActor.getShareholderSecure(token(), id));
      }
      return actor.getShareholder(id);
    },
    async getShareholderByNumber(num: string): Promise<Shareholder | null> {
      const secureActor = actor as typeof actor & {
        getShareholderByNumberSecure?: (
          sessionToken: string,
          shareholderNumber: string,
        ) => Promise<OkErr<Shareholder | null>>;
      };
      if (secureActor.getShareholderByNumberSecure) {
        return unwrapResult(
          await secureActor.getShareholderByNumberSecure(token(), num),
        );
      }
      return actor.getShareholderByNumber(num);
    },
    async searchShareholders(
      query: string,
      status: ShareholderStatus | null,
      page: bigint,
      pageSize: bigint,
    ): Promise<SearchResult> {
      const secureActor = actor as typeof actor & {
        searchShareholdersSecure?: (
          sessionToken: string,
          searchQuery: string,
          status: ShareholderStatus | null,
          page: bigint,
          pageSize: bigint,
        ) => Promise<OkErr<SearchResult>>;
      };
      if (secureActor.searchShareholdersSecure) {
        return unwrapResult(
          await secureActor.searchShareholdersSecure(
            token(),
            query,
            status,
            page,
            pageSize,
          ),
        );
      }
      return actor.searchShareholders(query, status, page, pageSize);
    },
    async createShareholder(data: ShareholderInput): Promise<Shareholder> {
      const result = await actor.createShareholder(data, token());
      return unwrapResult(result);
    },
    async bulkCreateShareholders(
      items: ShareholderInput[],
    ): Promise<BulkCreateResult> {
      return actor.bulkCreateShareholders(items, operatorIdentity());
    },
    async updateShareholderStatus(
      id: string,
      status: ShareholderStatus,
    ): Promise<Shareholder> {
      const result = await actor.updateShareholderStatus(
        id,
        status,
        operatorIdentity(),
      );
      return unwrapResult(result);
    },
    async deleteAllShareholders(): Promise<bigint> {
      const result = await actor.deleteAllShareholders(operatorIdentity());
      return unwrapResult(result);
    },

    // Registration
    async getAllRegistrations(): Promise<Registration[]> {
      return actor.getAllRegistrations();
    },
    async getRegistration(id: string): Promise<Registration | null> {
      return actor.getRegistration(id);
    },
    async getRegistrationByShareholder(
      shareholderId: string,
    ): Promise<Registration | null> {
      return actor.getRegistrationByShareholder(shareholderId);
    },
    async registerShareholder(
      shareholderId: string,
      regType: RegistrationType,
      proxyData: ProxyData | null,
    ): Promise<Registration> {
      if (isOffline()) {
        const queued = enqueuePendingAction<{
          id: string;
          type: "registerShareholder";
          queuedAt: number;
          attemptCount: number;
          lastError?: string;
          payload: {
            shareholderId: string;
            regType: RegistrationType;
            proxyData: ProxyData | null;
          };
        }>({
          type: "registerShareholder",
          payload: { shareholderId, regType, proxyData },
        });
        return buildQueuedRegistration(queued, currentUsername());
      }
      try {
        return await immediate.registerShareholder(shareholderId, regType, proxyData);
      } catch (error) {
        if (!shouldQueueError(error)) throw error;
        const queued = enqueuePendingAction<{
          id: string;
          type: "registerShareholder";
          queuedAt: number;
          attemptCount: number;
          lastError?: string;
          payload: {
            shareholderId: string;
            regType: RegistrationType;
            proxyData: ProxyData | null;
          };
        }>({
          type: "registerShareholder",
          payload: { shareholderId, regType, proxyData },
        });
        return buildQueuedRegistration(queued, currentUsername());
      }
    },
    async updateRegistration(
      id: string,
      updates: RegistrationUpdate,
    ): Promise<Registration> {
      if (isOffline()) {
        enqueuePendingAction({
          type: "updateRegistration",
          payload: { id, updates },
        });
        return {
          id,
          shareholderId: "",
          registrationType: RegistrationType.InPerson,
          proxyName: updates.proxyData?.proxyName,
          proxyContact: updates.proxyData?.proxyContact,
          proxyProofKey: updates.proxyData?.proxyProofKey ?? undefined,
          proxyProofValidated: false,
          proxyFraudFlags: [],
          verificationCode: "PENDING",
          registeredBy: currentUsername(),
          registeredAt: BigInt(Date.now()) * BigInt(1_000_000),
          updatedAt: BigInt(Date.now()) * BigInt(1_000_000),
          updatedBy: currentUsername(),
          notes: updates.notes ?? "Queued for sync while offline",
        };
      }
      try {
        return await immediate.updateRegistration(id, updates);
      } catch (error) {
        if (!shouldQueueError(error)) throw error;
        enqueuePendingAction({
          type: "updateRegistration",
          payload: { id, updates },
        });
        return {
          id,
          shareholderId: "",
          registrationType: RegistrationType.InPerson,
          proxyName: updates.proxyData?.proxyName,
          proxyContact: updates.proxyData?.proxyContact,
          proxyProofKey: updates.proxyData?.proxyProofKey ?? undefined,
          proxyProofValidated: false,
          proxyFraudFlags: [],
          verificationCode: "PENDING",
          registeredBy: currentUsername(),
          registeredAt: BigInt(Date.now()) * BigInt(1_000_000),
          updatedAt: BigInt(Date.now()) * BigInt(1_000_000),
          updatedBy: currentUsername(),
          notes: updates.notes ?? "Queued for sync while offline",
        };
      }
    },
    async cancelRegistration(id: string, reason: string): Promise<void> {
      if (isOffline()) {
        enqueuePendingAction({
          type: "cancelRegistration",
          payload: { id, reason },
        });
        return;
      }
      try {
        await immediate.cancelRegistration(id, reason);
      } catch (error) {
        if (!shouldQueueError(error)) throw error;
        enqueuePendingAction({
          type: "cancelRegistration",
          payload: { id, reason },
        });
      }
    },
    async validateProxyProof(
      registrationId: string,
      validated: boolean,
      fraudFlags: string[],
    ): Promise<Registration> {
      if (isOffline()) {
        enqueuePendingAction({
          type: "validateProxyProof",
          payload: { registrationId, validated, fraudFlags },
        });
        return {
          id: registrationId,
          shareholderId: "",
          registrationType: RegistrationType.Proxy,
          proxyName: undefined,
          proxyContact: undefined,
          proxyProofKey: undefined,
          proxyProofValidated: validated,
          proxyFraudFlags: fraudFlags,
          verificationCode: "PENDING",
          registeredBy: currentUsername(),
          registeredAt: BigInt(Date.now()) * BigInt(1_000_000),
          updatedAt: BigInt(Date.now()) * BigInt(1_000_000),
          updatedBy: currentUsername(),
          notes: "Queued for sync while offline",
        };
      }
      try {
        return await immediate.validateProxyProof(
          registrationId,
          validated,
          fraudFlags,
        );
      } catch (error) {
        if (!shouldQueueError(error)) throw error;
        enqueuePendingAction({
          type: "validateProxyProof",
          payload: { registrationId, validated, fraudFlags },
        });
        return {
          id: registrationId,
          shareholderId: "",
          registrationType: RegistrationType.Proxy,
          proxyName: undefined,
          proxyContact: undefined,
          proxyProofKey: undefined,
          proxyProofValidated: validated,
          proxyFraudFlags: fraudFlags,
          verificationCode: "PENDING",
          registeredBy: currentUsername(),
          registeredAt: BigInt(Date.now()) * BigInt(1_000_000),
          updatedAt: BigInt(Date.now()) * BigInt(1_000_000),
          updatedBy: currentUsername(),
          notes: "Queued for sync while offline",
        };
      }
    },

    // Check-In
    async getAllCheckIns(): Promise<CheckIn[]> {
      return actor.getAllCheckIns();
    },
    async getCheckIn(id: string): Promise<CheckIn | null> {
      return actor.getCheckIn(id);
    },
    async getCheckInByShareholder(
      shareholderId: string,
    ): Promise<CheckIn | null> {
      return actor.getCheckInByShareholder(shareholderId);
    },
    async checkInShareholder(
      shareholderId: string,
      registrationId: string,
      method: CheckInMethod,
    ): Promise<CheckIn> {
      if (isOffline()) {
        enqueuePendingAction({
          type: "checkInShareholder",
          payload: { shareholderId, registrationId, method },
        });
        return {
          id: `queued-checkin-${Date.now()}`,
          shareholderId,
          registrationId,
          method,
          checkedInAt: BigInt(Date.now()) * BigInt(1_000_000),
          checkedInBy: currentUsername(),
        };
      }
      try {
        return (await immediate.checkInShareholder(
          shareholderId,
          registrationId,
          method,
        )) as CheckIn;
      } catch (error) {
        if (!shouldQueueError(error)) throw error;
        enqueuePendingAction({
          type: "checkInShareholder",
          payload: { shareholderId, registrationId, method },
        });
        return {
          id: `queued-checkin-${Date.now()}`,
          shareholderId,
          registrationId,
          method,
          checkedInAt: BigInt(Date.now()) * BigInt(1_000_000),
          checkedInBy: currentUsername(),
        };
      }
    },
    async undoCheckIn(shareholderId: string): Promise<void> {
      const result = await actor.undoCheckIn(shareholderId, token());
      unwrapResult(result);
    },

    // Import Batches
    async getImportBatches(): Promise<ImportBatch[]> {
      return actor.getImportBatches();
    },
    async getImportBatch(id: string): Promise<ImportBatch | null> {
      return actor.getImportBatch(id);
    },
    async createImportBatch(
      filename: string,
      totalRows: bigint,
    ): Promise<ImportBatch> {
      return actor.createImportBatch(filename, operatorIdentity(), totalRows);
    },
    async updateImportBatchStatus(
      id: string,
      status: ImportStatus,
      importedRows: bigint,
      duplicates: bigint,
    ): Promise<ImportBatch> {
      const result = await actor.updateImportBatchStatus(
        id,
        status,
        importedRows,
        duplicates,
      );
      return unwrapResult(result);
    },

    // Users (Admin)
    async getUsers(): Promise<AppUser[]> {
      const result = await actor.getUsers(token());
      return unwrapResult(result);
    },
    async createUser(
      username: string,
      password: string,
      role: UserRole,
      phoneNumber?: string,
    ): Promise<AppUser> {
      const extendedActor = actor as typeof actor & {
        createUserWithPhone?: (
          sessionToken: string,
          username: string,
          password: string,
          role: UserRole,
          phoneNumber: string,
        ) => Promise<OkErr<AppUser>>;
      };
      if (extendedActor.createUserWithPhone) {
        try {
          return unwrapResult(
            await extendedActor.createUserWithPhone(
              token(),
              username,
              password,
              role,
              phoneNumber ?? "",
            ),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const unsupportedPhonePath =
            message.includes("Unsupported method: createUserWithPhone") ||
            message.includes("createUserWithPhone is not a function") ||
            message.includes("createUserWithPhone");

          if (!unsupportedPhonePath) {
            throw error;
          }
        }
      }
      const result = await actor.createUser(token(), username, password, role);
      return unwrapResult(result);
    },
    async updateUserRole(username: string, role: UserRole): Promise<AppUser> {
      const result = await actor.updateUserRole(token(), username, role);
      return unwrapResult(result);
    },
    async deactivateUser(username: string): Promise<void> {
      const result = await actor.deactivateUser(token(), username);
      unwrapResult(result);
    },
    async getActiveSessions(): Promise<Session[]> {
      const result = await actor.getActiveSessions(token());
      return unwrapResult(result);
    },
    async forceLogout(username: string): Promise<void> {
      const result = await actor.forceLogout(token(), username);
      unwrapResult(result);
    },
    async createPasswordResetCode(username: string): Promise<{
      code: string;
      username: string;
      issuedBy: string;
      issuedAt: bigint;
      expiresAt: bigint;
      attempts: bigint;
    }> {
      const secureActor = actor as typeof actor & {
        createPasswordResetCode?: (
          adminToken: string,
          username: string,
        ) => Promise<
          OkErr<{
            code: string;
            username: string;
            issuedBy: string;
            issuedAt: bigint;
            expiresAt: bigint;
            attempts: bigint;
          }>
        >;
      };
      if (!secureActor.createPasswordResetCode) {
        throw new Error("RESET_CODE_UNAVAILABLE");
      }
      return unwrapResult(
        await secureActor.createPasswordResetCode(token(), username),
      );
    },

    // Audit
    async getAuditLog(
      entityType: string | null,
      entityId: string | null,
      limit: bigint,
    ): Promise<AuditEntry[]> {
      return actor.getAuditLog(entityType, entityId, limit);
    },
    async getAuditLogForExport(): Promise<AuditEntry[]> {
      return actor.getAuditLogForExport();
    },
    async deleteAuditEntries(entryIds: string[]): Promise<bigint> {
      const auditActor = actor as typeof actor & {
        deleteAuditEntries?: (
          sessionToken: string,
          entryIds: string[],
        ) => Promise<OkErr<bigint>>;
      };
      if (!auditActor.deleteAuditEntries) {
        throw new Error("AUDIT_DELETE_UNAVAILABLE");
      }
      return unwrapResult(await auditActor.deleteAuditEntries(token(), entryIds));
    },
    async syncPendingActions() {
      return syncPendingActions(immediate);
    },
  };
}
