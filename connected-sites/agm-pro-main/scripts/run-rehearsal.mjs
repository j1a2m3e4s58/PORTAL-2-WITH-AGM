const runtimeBaseUrl =
  process.env.RUNTIME_BACKEND_URL || "http://127.0.0.1:8788";
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

async function rpc(method, args) {
  const response = await fetch(`${runtimeBaseUrl}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: serialize({ method, args }),
  });
  const payload = deserialize(await response.text());
  if (!response.ok) {
    throw new Error(payload.error || `RPC ${method} failed`);
  }
  return payload.result;
}

function unwrap(result, label) {
  if (result.__kind__ === "err") {
    throw new Error(`${label}: ${result.err}`);
  }
  return result.ok;
}

const rehearsalSummary = [];
function note(step, details) {
  rehearsalSummary.push({ step, details });
}

const adminLogin = unwrap(
  await rpc("login", ["T4N4AMEG8F5", "T4N4AMEG8F5"]),
  "admin login",
);
note("Login", `Admin session created for ${adminLogin.username}`);

const officerUser = unwrap(
  await rpc("createUser", [
    adminLogin.token,
    "event.officer",
    "OfficerPass2026",
    "RegistrationOfficer",
  ]),
  "create officer",
);
note("Admin", `Created rehearsal officer ${officerUser.username}`);

const resetCode = unwrap(
  await rpc("createPasswordResetCode", [adminLogin.token, "event.officer"]),
  "issue reset code",
);
note("Admin", `Issued reset code for ${resetCode.username}`);

unwrap(
  await rpc("resetPasswordWithCode", [
    "event.officer",
    resetCode.code,
    "OfficerReady2026",
  ]),
  "reset officer password",
);
note("Admin", "Completed officer password reset flow");

const officerLogin = unwrap(
  await rpc("login", ["event.officer", "OfficerReady2026"]),
  "officer login",
);
note("Login", `Officer session created for ${officerLogin.username}`);

const importBatch = await rpc("createImportBatch", [
  "rehearsal-shareholders.csv",
  officerLogin.token,
  BigInt(2),
]);
note("Import", `Created import batch ${importBatch.id}`);

const bulkImport = await rpc("bulkCreateShareholders", [
  [
    {
      tags: ["Board"],
      fullName: "Abena Boateng",
      email: "abena@example.com",
      shareholderNumber: "RH-101",
      idNumber: "GHA-RH-101",
      phone: "+233201010101",
      shareholding: BigInt(1500),
    },
    {
      tags: ["Proxy"],
      fullName: "Yaw Bediako",
      email: "yaw@example.com",
      shareholderNumber: "RH-102",
      idNumber: "GHA-RH-102",
      phone: "+233202020202",
      shareholding: BigInt(900),
    },
  ],
  officerLogin.token,
]);
note(
  "Import",
  `Imported ${bulkImport.created.toString()} shareholders with ${bulkImport.duplicates.toString()} duplicates`,
);

unwrap(
  await rpc("updateImportBatchStatus", [
    importBatch.id,
    "Complete",
    bulkImport.created,
    bulkImport.duplicates,
  ]),
  "complete import batch",
);

const search = unwrap(
  await rpc("searchShareholdersSecure", [
    officerLogin.token,
    "RH-10",
    null,
    BigInt(0),
    BigInt(10),
  ]),
  "search shareholders",
);
note("Search", `Secure search returned ${search.total.toString()} results`);

const inPersonShareholder = search.items.find(
  (item) => item.shareholderNumber === "RH-101",
);
const proxyShareholder = search.items.find(
  (item) => item.shareholderNumber === "RH-102",
);
if (!inPersonShareholder || !proxyShareholder) {
  throw new Error("Expected rehearsal shareholders were not found");
}

const inPersonRegistration = unwrap(
  await rpc("registerShareholder", [
    inPersonShareholder.id,
    "InPerson",
    null,
    officerLogin.token,
  ]),
  "in-person registration",
);
note(
  "Registration",
  `Registered ${inPersonShareholder.shareholderNumber} in person with code ${inPersonRegistration.verificationCode}`,
);

const proxyRegistration = unwrap(
  await rpc("registerShareholder", [
    proxyShareholder.id,
    "Proxy",
    {
      proxyContact: "+233203030303",
      proxyName: "Delegate Kofi",
      proxyProofKey: "proxy-proof-rh102.pdf",
    },
    officerLogin.token,
  ]),
  "proxy registration",
);
note(
  "Registration",
  `Registered ${proxyShareholder.shareholderNumber} by proxy with code ${proxyRegistration.verificationCode}`,
);

unwrap(
  await rpc("validateProxyProof", [
    proxyRegistration.id,
    true,
    [],
    officerLogin.token,
  ]),
  "validate proxy proof",
);
note("Proxy", "Validated proxy proof successfully");

const checkIn = unwrap(
  await rpc("checkInShareholder", [
    inPersonShareholder.id,
    inPersonRegistration.id,
    "QRScan",
    officerLogin.token,
  ]),
  "qr check-in",
);
note("Check-In", `Checked in attendee with event ${checkIn.id}`);

unwrap(
  await rpc("undoCheckIn", [inPersonShareholder.id, officerLogin.token]),
  "undo check-in",
);
note("Check-In", "Undo check-in flow succeeded");

const dashboard = await rpc("getDashboardMetrics", [BigInt(50)]);
note(
  "Reports",
  `Dashboard totals: ${dashboard.totalShareholders.toString()} shareholders, ${dashboard.registered.toString()} registered`,
);

const auditLog = await rpc("getAuditLogForExport", []);
note("Audit", `Audit export contains ${auditLog.length.toString()} entries`);

process.stdout.write(`${serialize({ status: "ok", runtimeBaseUrl, rehearsalSummary })}\n`);
