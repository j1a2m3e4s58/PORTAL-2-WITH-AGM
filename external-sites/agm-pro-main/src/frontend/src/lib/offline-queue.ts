import {
  CheckInMethod,
  RegistrationType,
  type ProxyData,
  type Registration,
  type RegistrationUpdate,
} from "@/backend";

const PENDING_KEY = "agm-pending-actions";
const CHANGE_EVENT = "agm-pending-actions-changed";

export type PendingAction =
  | {
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
    }
  | {
      id: string;
      type: "updateRegistration";
      queuedAt: number;
      attemptCount: number;
      lastError?: string;
      payload: {
        id: string;
        updates: RegistrationUpdate;
      };
    }
  | {
      id: string;
      type: "cancelRegistration";
      queuedAt: number;
      attemptCount: number;
      lastError?: string;
      payload: {
        id: string;
        reason: string;
      };
    }
  | {
      id: string;
      type: "validateProxyProof";
      queuedAt: number;
      attemptCount: number;
      lastError?: string;
      payload: {
        registrationId: string;
        validated: boolean;
        fraudFlags: string[];
      };
    }
  | {
      id: string;
      type: "checkInShareholder";
      queuedAt: number;
      attemptCount: number;
      lastError?: string;
      payload: {
        shareholderId: string;
        registrationId: string;
        method: CheckInMethod;
      };
    };

export type OfflineExecutor = {
  registerShareholder: (
    shareholderId: string,
    regType: RegistrationType,
    proxyData: ProxyData | null,
  ) => Promise<Registration>;
  updateRegistration: (
    id: string,
    updates: RegistrationUpdate,
  ) => Promise<Registration>;
  cancelRegistration: (id: string, reason: string) => Promise<void>;
  validateProxyProof: (
    registrationId: string,
    validated: boolean,
    fraudFlags: string[],
  ) => Promise<Registration>;
  checkInShareholder: (
    shareholderId: string,
    registrationId: string,
    method: CheckInMethod,
  ) => Promise<unknown>;
};

function emitQueueChanged() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function readQueue(): PendingAction[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]") as PendingAction[];
  } catch {
    return [];
  }
}

function writeQueue(actions: PendingAction[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(actions));
  emitQueueChanged();
}

export function listPendingActions(): PendingAction[] {
  return readQueue();
}

export function subscribePendingActions(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function enqueuePendingAction<T extends PendingAction>(
  action: Omit<T, "id" | "queuedAt" | "attemptCount">,
): T {
  const pending = {
    ...action,
    id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    attemptCount: 0,
  } as T;
  const queue = readQueue();
  queue.push(pending);
  writeQueue(queue);
  void registerBackgroundSync();
  return pending;
}

function updatePendingAction(actionId: string, updater: (current: PendingAction) => PendingAction) {
  const queue = readQueue().map((item) => (item.id === actionId ? updater(item) : item));
  writeQueue(queue);
}

function removePendingAction(actionId: string) {
  writeQueue(readQueue().filter((item) => item.id !== actionId));
}

export async function registerBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    if ("sync" in registration) {
      await (
        registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        }
      ).sync.register("sync-agm-actions");
    }
  } catch {
    // Best-effort only.
  }
}

export async function syncPendingActions(executor: OfflineExecutor) {
  const queue = readQueue();
  let processed = 0;
  let failed = 0;

  for (const action of queue) {
    try {
      switch (action.type) {
        case "registerShareholder":
          await executor.registerShareholder(
            action.payload.shareholderId,
            action.payload.regType,
            action.payload.proxyData,
          );
          break;
        case "updateRegistration":
          await executor.updateRegistration(action.payload.id, action.payload.updates);
          break;
        case "cancelRegistration":
          await executor.cancelRegistration(action.payload.id, action.payload.reason);
          break;
        case "validateProxyProof":
          await executor.validateProxyProof(
            action.payload.registrationId,
            action.payload.validated,
            action.payload.fraudFlags,
          );
          break;
        case "checkInShareholder":
          await executor.checkInShareholder(
            action.payload.shareholderId,
            action.payload.registrationId,
            action.payload.method,
          );
          break;
      }
      removePendingAction(action.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      updatePendingAction(action.id, (current) => ({
        ...current,
        attemptCount: current.attemptCount + 1,
        lastError: error instanceof Error ? error.message : "SYNC_FAILED",
      }));
      break;
    }
  }

  return { processed, failed, remaining: readQueue().length };
}

export function buildQueuedRegistration(
  action: PendingAction & { type: "registerShareholder" },
  currentUser: string,
): Registration {
  return {
    id: action.id,
    shareholderId: action.payload.shareholderId,
    registrationType: action.payload.regType,
    proxyName: action.payload.proxyData?.proxyName,
    proxyContact: action.payload.proxyData?.proxyContact,
    proxyProofKey: action.payload.proxyData?.proxyProofKey ?? undefined,
    proxyProofValidated: action.payload.regType === RegistrationType.Proxy ? false : true,
    proxyFraudFlags: [],
    verificationCode: `PENDING-${action.id.slice(-6).toUpperCase()}`,
    registeredBy: currentUser,
    registeredAt: BigInt(action.queuedAt) * BigInt(1_000_000),
    updatedAt: BigInt(action.queuedAt) * BigInt(1_000_000),
    updatedBy: currentUser,
    notes: "Queued for sync while offline",
  };
}
