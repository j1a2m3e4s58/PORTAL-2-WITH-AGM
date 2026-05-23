import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface SearchResult {
    total: bigint;
    page: bigint;
    items: Array<Shareholder>;
}
export interface Shareholder {
    id: string;
    status: ShareholderStatus;
    tags: Array<string>;
    fullName: string;
    importedAt: bigint;
    importedBy: string;
    email?: string;
    shareholderNumber: string;
    idNumber: string;
    phone?: string;
    shareholding: bigint;
}
export interface RegistrationUpdate {
    proxyData?: ProxyData;
    notes?: string;
}
export interface ShareholderInput {
    tags: Array<string>;
    fullName: string;
    email?: string;
    shareholderNumber: string;
    idNumber: string;
    phone?: string;
    shareholding: bigint;
}
export interface ImportBatch {
    id: string;
    status: ImportStatus;
    totalRows: bigint;
    duplicatesSkipped: bigint;
    filename: string;
    importedRows: bigint;
    uploadedAt: bigint;
    uploadedBy: string;
}
export interface Registration {
    id: string;
    shareholderId: string;
    verificationCode: string;
    proxyContact?: string;
    proxyProofKey?: string;
    updatedAt: bigint;
    updatedBy?: string;
    proxyFraudFlags: Array<string>;
    notes?: string;
    proxyName?: string;
    proxyProofValidated: boolean;
    registrationType: RegistrationType;
    registeredAt: bigint;
    registeredBy: string;
}
export interface ProxyData {
    proxyContact: string;
    proxyProofKey?: string;
    proxyName: string;
}
export interface BulkCreateResult {
    created: bigint;
    errors: Array<string>;
    duplicates: bigint;
}
export interface CheckIn {
    id: string;
    shareholderId: string;
    method: CheckInMethod;
    checkedInAt: bigint;
    checkedInBy: string;
    registrationId: string;
}
export interface Session {
    token: string;
    expiresAt: bigint;
    username: string;
    role: UserRole;
}
export interface AuditEntry {
    id: string;
    action: string;
    entityId: string;
    performedAt: bigint;
    performedBy: string;
    details: string;
    entityType: string;
    ipAddress?: string;
}
export interface AppUser {
    principal: string;
    username: string;
    createdAt: bigint;
    role: UserRole;
    isActive: boolean;
    passwordHash: string;
    sessionExpiry?: bigint;
    lastLogin?: bigint;
    mustChangePassword: boolean;
    phoneNumber?: string;
    isPhoneVerified?: boolean;
}
export interface AGMSettings {
    venue: string;
    sessionTimeoutMinutes: bigint;
    quorumThreshold: bigint;
    agmDate: string;
    agmName: string;
}
export interface DashboardMetrics {
    totalShareholders: bigint;
    quorumStatus: boolean;
    lastUpdated: bigint;
    registeredInPerson: bigint;
    attendanceRate: number;
    registeredProxy: bigint;
    checkedIn: bigint;
    notRegistered: bigint;
    registered: bigint;
}
export interface LoginResponse {
    token: string;
    username: string;
    role: UserRole;
    mustChangePassword: boolean;
}
export enum CheckInMethod {
    ManualQuick = "ManualQuick",
    QRScan = "QRScan",
    Manual = "Manual"
}
export enum ImportStatus {
    Failed = "Failed",
    Complete = "Complete",
    Processing = "Processing",
    Pending = "Pending"
}
export enum RegistrationType {
    Proxy = "Proxy",
    InPerson = "InPerson"
}
export enum ShareholderStatus {
    RegisteredProxy = "RegisteredProxy",
    RegisteredInPerson = "RegisteredInPerson",
    NotRegistered = "NotRegistered",
    CheckedIn = "CheckedIn"
}
export enum UserRole {
    BoardViewer = "BoardViewer",
    ReportsViewer = "ReportsViewer",
    Admin = "Admin",
    Viewer = "Viewer",
    RegistrationOfficer = "RegistrationOfficer",
    SuperAdmin = "SuperAdmin"
}
export interface backendInterface {
    bulkCreateShareholders(items: Array<ShareholderInput>, importedBy: string): Promise<BulkCreateResult>;
    cancelRegistration(id: string, cancelledBy: string, reason: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    changePassword(username: string, oldPassword: string, newPassword: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    checkInShareholder(shareholderId: string, registrationId: string, method: CheckInMethod, checkedInBy: string): Promise<{
        __kind__: "ok";
        ok: CheckIn;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createImportBatch(filename: string, uploadedBy: string, totalRows: bigint): Promise<ImportBatch>;
    createShareholder(data: ShareholderInput, importedBy: string): Promise<{
        __kind__: "ok";
        ok: Shareholder;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createUser(adminToken: string, username: string, password: string, role: UserRole): Promise<{
        __kind__: "ok";
        ok: AppUser;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deactivateUser(adminToken: string, username: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteAllShareholders(deletedBy: string): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    forceLogout(adminToken: string, username: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getActiveSessions(adminToken: string): Promise<{
        __kind__: "ok";
        ok: Array<Session>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAllCheckIns(): Promise<Array<CheckIn>>;
    getAllRegistrations(): Promise<Array<Registration>>;
    getAllShareholders(): Promise<Array<Shareholder>>;
    getAuditLog(entityType: string | null, entityId: string | null, limit: bigint): Promise<Array<AuditEntry>>;
    getAuditLogForExport(): Promise<Array<AuditEntry>>;
    getCheckIn(id: string): Promise<CheckIn | null>;
    getCheckInByShareholder(shareholderId: string): Promise<CheckIn | null>;
    getDashboardMetrics(quorumThreshold: bigint): Promise<DashboardMetrics>;
    getImportBatch(id: string): Promise<ImportBatch | null>;
    getImportBatches(): Promise<Array<ImportBatch>>;
    getRegistration(id: string): Promise<Registration | null>;
    getRegistrationByShareholder(shareholderId: string): Promise<Registration | null>;
    getSettings(): Promise<AGMSettings>;
    getShareholder(id: string): Promise<Shareholder | null>;
    getShareholderByNumber(shareholderNumber: string): Promise<Shareholder | null>;
    getUsers(adminToken: string): Promise<{
        __kind__: "ok";
        ok: Array<AppUser>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    login(username: string, password: string): Promise<{
        __kind__: "ok";
        ok: LoginResponse;
    } | {
        __kind__: "err";
        err: string;
    }>;
    logout(token: string): Promise<void>;
    registerShareholder(shareholderId: string, regType: RegistrationType, proxyData: ProxyData | null, registeredBy: string): Promise<{
        __kind__: "ok";
        ok: Registration;
    } | {
        __kind__: "err";
        err: string;
    }>;
    resetPasswordWithCode(username: string, resetCode: string, newPassword: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    searchShareholders(searchQuery: string, statusFilter: ShareholderStatus | null, page: bigint, pageSize: bigint): Promise<SearchResult>;
    undoCheckIn(shareholderId: string, undoneBy: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateImportBatchStatus(id: string, status: ImportStatus, importedRows: bigint, duplicates: bigint): Promise<{
        __kind__: "ok";
        ok: ImportBatch;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateRegistration(id: string, updates: RegistrationUpdate, updatedBy: string): Promise<{
        __kind__: "ok";
        ok: Registration;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateSettings(adminToken: string, newSettings: AGMSettings): Promise<{
        __kind__: "ok";
        ok: AGMSettings;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateShareholderStatus(id: string, status: ShareholderStatus, updatedBy: string): Promise<{
        __kind__: "ok";
        ok: Shareholder;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateUserRole(adminToken: string, username: string, role: UserRole): Promise<{
        __kind__: "ok";
        ok: AppUser;
    } | {
        __kind__: "err";
        err: string;
    }>;
    validateProxyProof(registrationId: string, validated: boolean, fraudFlags: Array<string>, validatedBy: string): Promise<{
        __kind__: "ok";
        ok: Registration;
    } | {
        __kind__: "err";
        err: string;
    }>;
    validateSession(token: string): Promise<{
        __kind__: "ok";
        ok: Session;
    } | {
        __kind__: "err";
        err: string;
    }>;
}
