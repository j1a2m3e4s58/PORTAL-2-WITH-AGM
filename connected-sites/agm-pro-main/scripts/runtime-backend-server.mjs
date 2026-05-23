import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
const runtimePort = Number(process.env.RUNTIME_BACKEND_PORT || "8788");
const pocketIcBin =
  process.env.POCKET_IC_BIN ||
  path.join(os.homedir(), ".cache", "mops", "pocket-ic", "13.0.0", "pocket-ic");
const wasmPath = path.join(rootDir, "src", "backend", "dist", "backend.wasm");

const BIGINT_SENTINEL = "__bigint__";

function serialize(value) {
  return JSON.stringify(value, (_key, currentValue) => {
    if (typeof currentValue === "bigint") {
      return { [BIGINT_SENTINEL]: currentValue.toString() };
    }
    return currentValue;
  });
}

function deserialize(text) {
  return JSON.parse(text, (_key, currentValue) => {
    if (
      currentValue &&
      typeof currentValue === "object" &&
      BIGINT_SENTINEL in currentValue
    ) {
      return BigInt(currentValue[BIGINT_SENTINEL]);
    }
    return currentValue;
  });
}

function resolvePnpmModule(pkgName, entry = "dist/index.js") {
  const pnpmDir = path.join(rootDir, "node_modules", ".pnpm");
  const match = fs
    .readdirSync(pnpmDir)
    .find((name) => name.startsWith(`${pkgName}@`));
  if (!match) {
    throw new Error(`Unable to resolve package ${pkgName} in ${pnpmDir}`);
  }
  return pathToFileURL(
    path.join(pnpmDir, match, "node_modules", pkgName, entry),
  ).href;
}

function enumKey(value) {
  if (value == null) return value;
  if (typeof value === "string") return value;
  return Object.keys(value)[0];
}

function toVariant(value) {
  return value == null ? value : { [value]: null };
}

function fromOpt(value, mapper = (item) => item) {
  return Array.isArray(value) && value.length > 0 ? mapper(value[0]) : undefined;
}

function fromNullableOpt(value, mapper = (item) => item) {
  return Array.isArray(value) && value.length > 0 ? mapper(value[0]) : null;
}

function toOpt(value, mapper = (item) => item) {
  return value == null ? [] : [mapper(value)];
}

function normalizeSession(value) {
  return {
    token: value.token,
    expiresAt: value.expiresAt,
    username: value.username,
    role: enumKey(value.role),
  };
}

function normalizeAppUser(value) {
  return {
    principal: value.principal,
    username: value.username,
    createdAt: value.createdAt,
    role: enumKey(value.role),
    isActive: value.isActive,
    passwordHash: value.passwordHash,
    sessionExpiry: fromOpt(value.sessionExpiry),
    lastLogin: fromOpt(value.lastLogin),
    mustChangePassword: value.mustChangePassword,
  };
}

function normalizeShareholder(value) {
  return {
    id: value.id,
    status: enumKey(value.status),
    tags: value.tags,
    fullName: value.fullName,
    importedAt: value.importedAt,
    importedBy: value.importedBy,
    email: fromOpt(value.email),
    shareholderNumber: value.shareholderNumber,
    idNumber: value.idNumber,
    phone: fromOpt(value.phone),
    shareholding: value.shareholding,
  };
}

function normalizeProxyData(value) {
  return {
    proxyContact: value.proxyContact,
    proxyName: value.proxyName,
    proxyProofKey: fromOpt(value.proxyProofKey),
  };
}

function normalizeRegistration(value) {
  return {
    id: value.id,
    shareholderId: value.shareholderId,
    verificationCode: value.verificationCode,
    proxyContact: fromOpt(value.proxyContact),
    proxyProofKey: fromOpt(value.proxyProofKey),
    updatedAt: value.updatedAt,
    updatedBy: fromOpt(value.updatedBy),
    proxyFraudFlags: value.proxyFraudFlags,
    notes: fromOpt(value.notes),
    proxyName: fromOpt(value.proxyName),
    proxyProofValidated: value.proxyProofValidated,
    registrationType: enumKey(value.registrationType),
    registeredAt: value.registeredAt,
    registeredBy: value.registeredBy,
  };
}

function normalizeCheckIn(value) {
  return {
    id: value.id,
    shareholderId: value.shareholderId,
    method: enumKey(value.method),
    checkedInAt: value.checkedInAt,
    checkedInBy: value.checkedInBy,
    registrationId: value.registrationId,
  };
}

function normalizeImportBatch(value) {
  return {
    id: value.id,
    status: enumKey(value.status),
    totalRows: value.totalRows,
    duplicatesSkipped: value.duplicatesSkipped,
    filename: value.filename,
    importedRows: value.importedRows,
    uploadedAt: value.uploadedAt,
    uploadedBy: value.uploadedBy,
  };
}

function normalizeAuditEntry(value) {
  return {
    id: value.id,
    action: value.action,
    entityId: value.entityId,
    performedAt: value.performedAt,
    performedBy: value.performedBy,
    details: value.details,
    entityType: value.entityType,
    ipAddress: fromOpt(value.ipAddress),
  };
}

function normalizeDashboardMetrics(value) {
  return {
    totalShareholders: value.totalShareholders,
    quorumStatus: value.quorumStatus,
    lastUpdated: value.lastUpdated,
    registeredInPerson: value.registeredInPerson,
    attendanceRate: value.attendanceRate,
    registeredProxy: value.registeredProxy,
    checkedIn: value.checkedIn,
    notRegistered: value.notRegistered,
    registered: value.registered,
  };
}

function normalizeSettings(value) {
  return {
    venue: value.venue,
    sessionTimeoutMinutes: value.sessionTimeoutMinutes,
    quorumThreshold: value.quorumThreshold,
    agmDate: value.agmDate,
    agmName: value.agmName,
  };
}

function normalizeSearchResult(value) {
  return {
    total: value.total,
    page: value.page,
    items: value.items.map(normalizeShareholder),
  };
}

function normalizeLoginResponse(value) {
  return {
    token: value.token,
    username: value.username,
    role: enumKey(value.role),
    mustChangePassword: value.mustChangePassword,
  };
}

function normalizeResetCode(value) {
  return {
    code: value.code,
    username: value.username,
    issuedBy: value.issuedBy,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    attempts: value.attempts,
  };
}

function normalizeResult(value, mapper = (item) => item) {
  if ("ok" in value) {
    return { __kind__: "ok", ok: mapper(value.ok) };
  }
  return { __kind__: "err", err: value.err };
}

function rawShareholderInput(value) {
  return {
    tags: value.tags,
    fullName: value.fullName,
    email: toOpt(value.email),
    shareholderNumber: value.shareholderNumber,
    idNumber: value.idNumber,
    phone: toOpt(value.phone),
    shareholding: value.shareholding,
  };
}

function rawProxyData(value) {
  return {
    proxyContact: value.proxyContact,
    proxyName: value.proxyName,
    proxyProofKey: toOpt(value.proxyProofKey),
  };
}

function rawRegistrationUpdate(value) {
  return {
    proxyData: toOpt(value.proxyData, rawProxyData),
    notes: toOpt(value.notes),
  };
}

const picModule = await import(resolvePnpmModule("pic-ic"));
const didModule = await import(
  pathToFileURL(
    path.join(rootDir, "src", "frontend", "src", "declarations", "backend.did.js"),
  ).href
);

if (!fs.existsSync(wasmPath)) {
  throw new Error(`Compiled backend WASM not found at ${wasmPath}`);
}
if (!fs.existsSync(pocketIcBin)) {
  throw new Error(`PocketIC binary not found at ${pocketIcBin}`);
}

const { PocketIc, PocketIcServer } = picModule;
const { idlFactory } = didModule;

const picServer = await PocketIcServer.start({ binPath: pocketIcBin });
const pic = await PocketIc.create(picServer.getUrl());
const fixture = await pic.setupCanister({ idlFactory, wasm: wasmPath });
const actor = fixture.actor;
const canisterId = fixture.canisterId.toText();

async function execute(method, args) {
  switch (method) {
    case "login":
      return normalizeResult(await actor.login(args[0], args[1]), normalizeLoginResponse);
    case "validateSession":
      return normalizeResult(await actor.validateSession(args[0]), normalizeSession);
    case "logout":
      await actor.logout(args[0]);
      return null;
    case "changePassword":
      return normalizeResult(await actor.changePassword(args[0], args[1], args[2]));
    case "changePasswordSecure":
      return normalizeResult(await actor.changePasswordSecure(args[0], args[1], args[2]));
    case "resetPasswordWithCode":
      return normalizeResult(await actor.resetPasswordWithCode(args[0], args[1], args[2]));
    case "createPasswordResetCode":
      return normalizeResult(
        await actor.createPasswordResetCode(args[0], args[1]),
        normalizeResetCode,
      );
    case "getSettings":
      return normalizeSettings(await actor.getSettings());
    case "updateSettings":
      return normalizeResult(
        await actor.updateSettings(args[0], args[1]),
        normalizeSettings,
      );
    case "getDashboardMetrics":
      return normalizeDashboardMetrics(await actor.getDashboardMetrics(args[0]));
    case "getAllShareholders":
      return (await actor.getAllShareholders()).map(normalizeShareholder);
    case "getAllShareholdersSecure":
      return normalizeResult(
        await actor.getAllShareholdersSecure(args[0]),
        (items) => items.map(normalizeShareholder),
      );
    case "getShareholder":
      return fromNullableOpt(await actor.getShareholder(args[0]), normalizeShareholder);
    case "getShareholderSecure":
      return normalizeResult(
        await actor.getShareholderSecure(args[0], args[1]),
        (value) => fromNullableOpt(value, normalizeShareholder),
      );
    case "getShareholderByNumber":
      return fromNullableOpt(
        await actor.getShareholderByNumber(args[0]),
        normalizeShareholder,
      );
    case "getShareholderByNumberSecure":
      return normalizeResult(
        await actor.getShareholderByNumberSecure(args[0], args[1]),
        (value) => fromNullableOpt(value, normalizeShareholder),
      );
    case "searchShareholders":
      return normalizeSearchResult(
        await actor.searchShareholders(args[0], toOpt(args[1], toVariant), args[2], args[3]),
      );
    case "searchShareholdersSecure":
      return normalizeResult(
        await actor.searchShareholdersSecure(
          args[0],
          args[1],
          toOpt(args[2], toVariant),
          args[3],
          args[4],
        ),
        normalizeSearchResult,
      );
    case "createShareholder":
      return normalizeResult(
        await actor.createShareholder(rawShareholderInput(args[0]), args[1]),
        normalizeShareholder,
      );
    case "bulkCreateShareholders":
      return await actor.bulkCreateShareholders(
        args[0].map(rawShareholderInput),
        args[1],
      );
    case "updateShareholderStatus":
      return normalizeResult(
        await actor.updateShareholderStatus(args[0], toVariant(args[1]), args[2]),
        normalizeShareholder,
      );
    case "deleteAllShareholders":
      return normalizeResult(await actor.deleteAllShareholders(args[0]));
    case "getAllRegistrations":
      return (await actor.getAllRegistrations()).map(normalizeRegistration);
    case "getRegistration":
      return fromNullableOpt(await actor.getRegistration(args[0]), normalizeRegistration);
    case "getRegistrationByShareholder":
      return fromNullableOpt(
        await actor.getRegistrationByShareholder(args[0]),
        normalizeRegistration,
      );
    case "registerShareholder":
      return normalizeResult(
        await actor.registerShareholder(
          args[0],
          toVariant(args[1]),
          toOpt(args[2], rawProxyData),
          args[3],
        ),
        normalizeRegistration,
      );
    case "updateRegistration":
      return normalizeResult(
        await actor.updateRegistration(args[0], rawRegistrationUpdate(args[1]), args[2]),
        normalizeRegistration,
      );
    case "cancelRegistration":
      return normalizeResult(await actor.cancelRegistration(args[0], args[1], args[2]));
    case "validateProxyProof":
      return normalizeResult(
        await actor.validateProxyProof(args[0], args[1], args[2], args[3]),
        normalizeRegistration,
      );
    case "getAllCheckIns":
      return (await actor.getAllCheckIns()).map(normalizeCheckIn);
    case "getCheckIn":
      return fromNullableOpt(await actor.getCheckIn(args[0]), normalizeCheckIn);
    case "getCheckInByShareholder":
      return fromNullableOpt(
        await actor.getCheckInByShareholder(args[0]),
        normalizeCheckIn,
      );
    case "checkInShareholder":
      return normalizeResult(
        await actor.checkInShareholder(args[0], args[1], toVariant(args[2]), args[3]),
        normalizeCheckIn,
      );
    case "undoCheckIn":
      return normalizeResult(await actor.undoCheckIn(args[0], args[1]));
    case "createImportBatch":
      return normalizeImportBatch(await actor.createImportBatch(args[0], args[1], args[2]));
    case "updateImportBatchStatus":
      return normalizeResult(
        await actor.updateImportBatchStatus(args[0], toVariant(args[1]), args[2], args[3]),
        normalizeImportBatch,
      );
    case "getImportBatch":
      return fromNullableOpt(await actor.getImportBatch(args[0]), normalizeImportBatch);
    case "getImportBatches":
      return (await actor.getImportBatches()).map(normalizeImportBatch);
    case "getUsers":
      return normalizeResult(
        await actor.getUsers(args[0]),
        (items) => items.map(normalizeAppUser),
      );
    case "createUser":
      return normalizeResult(
        await actor.createUser(args[0], args[1], args[2], toVariant(args[3])),
        normalizeAppUser,
      );
    case "updateUserRole":
      return normalizeResult(
        await actor.updateUserRole(args[0], args[1], toVariant(args[2])),
        normalizeAppUser,
      );
    case "deactivateUser":
      return normalizeResult(await actor.deactivateUser(args[0], args[1]));
    case "getActiveSessions":
      return normalizeResult(
        await actor.getActiveSessions(args[0]),
        (items) => items.map(normalizeSession),
      );
    case "forceLogout":
      return normalizeResult(await actor.forceLogout(args[0], args[1]));
    case "getAuditLog":
      return (await actor.getAuditLog(toOpt(args[0]), toOpt(args[1]), args[2])).map(
        normalizeAuditEntry,
      );
    case "getAuditLogForExport":
      return (await actor.getAuditLogForExport()).map(normalizeAuditEntry);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

function reply(response, statusCode, body) {
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
      runtime: "pocket-ic",
      canisterId,
      wasmPath,
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
    const { method, args } = deserialize(body);
    const result = await execute(method, args);
    reply(response, 200, { result });
  } catch (error) {
    reply(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(runtimePort, "127.0.0.1", () => {
  process.stdout.write(
    serialize({
      status: "listening",
      runtimePort,
      canisterId,
      pocketIcBin,
      wasmPath,
    }) + "\n",
  );
});

async function shutdown() {
  server.close();
  await pic.tearDown();
  await picServer.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
