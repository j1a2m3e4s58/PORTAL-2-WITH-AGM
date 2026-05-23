import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BIGINT_SENTINEL = "__bigint__";
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || process.env.RUNTIME_BACKEND_PORT || "8788");
const serverRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverRoot, "..");
const dataDir = path.join(projectRoot, "data");
const stateFilePath =
  process.env.AGM_SHARED_STATE_FILE ||
  path.join(dataDir, "agm-shared-backend-state.json");
const backupDir =
  process.env.AGM_SHARED_BACKUP_DIR || path.join(dataDir, "agm-shared-backups");
const MAX_BACKUPS = Number(process.env.AGM_SHARED_BACKUP_LIMIT || "10");

function ensureDirectory(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function serialize(value: unknown) {
  return JSON.stringify(value, (_key, currentValue) => {
    if (typeof currentValue === "bigint") {
      return { [BIGINT_SENTINEL]: currentValue.toString() };
    }
    return currentValue;
  });
}

function deserialize<T>(value: string): T {
  return JSON.parse(value, (_key, currentValue) => {
    if (
      currentValue &&
      typeof currentValue === "object" &&
      BIGINT_SENTINEL in currentValue
    ) {
      return BigInt((currentValue as Record<string, string>)[BIGINT_SENTINEL]);
    }
    return currentValue;
  }) as T;
}

class FileBackedLocalStorage {
  private lastRecoverySource: string | null = null;

  private persistRecoveredStore(store: Record<string, string>) {
    try {
      this.writeStore(store, false);
    } catch {
      // keep serving the recovered in-memory data path even if re-persist fails
    }
  }

  private readStore(): Record<string, string> {
    try {
      if (!fs.existsSync(stateFilePath)) {
        return this.readBackupStore();
      }
      const store = JSON.parse(fs.readFileSync(stateFilePath, "utf8")) as Record<
        string,
        string
      >;
      this.lastRecoverySource = null;
      return store;
    } catch {
      return this.readBackupStore();
    }
  }

  private readBackupStore(): Record<string, string> {
    try {
      if (!fs.existsSync(backupDir)) return {};
      const candidates = fs
        .readdirSync(backupDir)
        .filter((file) => file.endsWith(".json"))
        .sort()
        .reverse();
      for (const candidate of candidates) {
        try {
          const store = JSON.parse(
            fs.readFileSync(path.join(backupDir, candidate), "utf8"),
          ) as Record<string, string>;
          this.lastRecoverySource = candidate;
          this.persistRecoveredStore(store);
          return store;
        } catch {
          // try the next backup
        }
      }
      return {};
    } catch {
      return {};
    }
  }

  private rotateBackups(store: Record<string, string>) {
    ensureDirectory(path.join(backupDir, "placeholder"));
    const backupFile = path.join(
      backupDir,
      `agm-shared-backend-${Date.now()}.json`,
    );
    fs.writeFileSync(backupFile, JSON.stringify(store, null, 2), "utf8");
    const existing = fs
      .readdirSync(backupDir)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .reverse();
    for (const stale of existing.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(backupDir, stale));
    }
  }

  private writeStore(store: Record<string, string>, rotateBackup = true) {
    ensureDirectory(stateFilePath);
    const tempPath = `${stateFilePath}.tmp`;
    const serialized = JSON.stringify(store, null, 2);
    fs.writeFileSync(tempPath, serialized, "utf8");
    fs.renameSync(tempPath, stateFilePath);
    if (rotateBackup) {
      this.rotateBackups(store);
    }
    this.lastRecoverySource = null;
  }

  getItem(key: string) {
    const store = this.readStore();
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
  }

  setItem(key: string, value: string) {
    const store = this.readStore();
    store[key] = String(value);
    this.writeStore(store);
  }

  removeItem(key: string) {
    const store = this.readStore();
    delete store[key];
    this.writeStore(store);
  }

  clear() {
    this.writeStore({});
  }

  getDiagnostics() {
    const backupCount = fs.existsSync(backupDir)
      ? fs.readdirSync(backupDir).filter((file) => file.endsWith(".json")).length
      : 0;
    const stateExists = fs.existsSync(stateFilePath);
    const stateStats = stateExists ? fs.statSync(stateFilePath) : null;

    return {
      storageFile: stateFilePath,
      backupDirectory: backupDir,
      backupCount,
      persistenceMode: "atomic-file-with-rotation",
      lastPersistedAt: stateStats?.mtime.toISOString() ?? null,
      stateFileSizeBytes: stateStats?.size ?? 0,
      recoveredFromBackup: Boolean(this.lastRecoverySource),
      lastRecoverySource: this.lastRecoverySource,
    };
  }
}

const localStorage = new FileBackedLocalStorage();

Object.defineProperty(globalThis, "window", {
  value: { localStorage },
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: localStorage,
  configurable: true,
});

const backendModuleUrl = new URL(
  "../src/frontend/src/mocks/backend.js",
  import.meta.url,
);
const { mockBackend } = (await import(backendModuleUrl.href)) as {
  mockBackend: Record<string, (...args: unknown[]) => unknown>;
};

async function execute(method: string, args: unknown[]) {
  const candidate = mockBackend[method];
  if (typeof candidate !== "function") {
    throw new Error(`Unsupported method: ${method}`);
  }
  return await candidate.apply(mockBackend, args);
}

function reply(response: http.ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json",
  });
  response.end(serialize(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    reply(response, 204, {});
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    reply(response, 200, {
      status: "ok",
      runtime: "shared-mock-backend",
      ...localStorage.getDiagnostics(),
    });
    return;
  }

  if (request.method !== "POST" || request.url !== "/rpc") {
    reply(response, 404, { error: "NOT_FOUND" });
    return;
  }

  let body = "";
  for await (const chunk of request) {
    body += chunk;
  }

  try {
    const { method, args } = deserialize<{ method: string; args: unknown[] }>(body);
    const result = await execute(method, args);
    reply(response, 200, { result });
  } catch (error) {
    reply(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, host, () => {
  process.stdout.write(
    serialize({
      status: "listening",
      host,
      port,
      storageFile: stateFilePath,
    }) + "\n",
  );
});
