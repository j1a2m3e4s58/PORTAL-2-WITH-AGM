from __future__ import annotations

import json
import os
import tempfile
import time
from copy import deepcopy
from typing import Any

from flask import Blueprint, Response, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))
DATA_DIR = os.getenv("PORTAL_DATA_DIR", BASE_DIR).strip() or BASE_DIR
AGM_STATE_PATH = os.path.join(DATA_DIR, "agm_runtime_state.json")
AGM_SEED_PATH = os.path.join(
    REPO_ROOT,
    "external-sites",
    "agm-pro-main",
    "src",
    "frontend",
    "src",
    "data",
    "bawjiase-shareholders.json",
)

AGM_RUNTIME_BP = Blueprint("agm_runtime", __name__, url_prefix="/agm-runtime")

BIGINT_SENTINEL = "__bigint__"
MOCK_STATE_VERSION = 3
DEFAULT_ADMIN = "T4N4AMEG8F5"
DEFAULT_PHONE_TOKEN = "1234"
DEFAULT_SETTINGS = {
    "venue": "",
    "sessionTimeoutMinutes": 120,
    "quorumThreshold": 50,
    "agmDate": "",
    "agmName": "BAWJIASE COMMUNITY BANK AGM",
}


def now_ns() -> int:
    return int(time.time() * 1000) * 1_000_000


def serialize_bigints(value: Any) -> str:
    def transform(current: Any) -> Any:
        if isinstance(current, bool) or current is None:
            return current
        if isinstance(current, int) and abs(current) > 9_007_199_254_740_991:
            return {BIGINT_SENTINEL: str(current)}
        if isinstance(current, list):
            return [transform(item) for item in current]
        if isinstance(current, dict):
            return {key: transform(item) for key, item in current.items()}
        return current

    return json.dumps(transform(value), ensure_ascii=True)


def deserialize_bigints(value: str) -> Any:
    def object_hook(obj: dict[str, Any]) -> Any:
        if set(obj.keys()) == {BIGINT_SENTINEL}:
            try:
                return int(obj[BIGINT_SENTINEL])
            except Exception:
                return obj
        return obj

    return json.loads(value, object_hook=object_hook)


def atomic_write_json(path: str, payload: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix="tmp-", suffix=".json", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(serialize_bigints(payload))
        os.replace(tmp_path, path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def read_json_file(path: str, default: Any) -> Any:
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return deserialize_bigints(handle.read())
    except Exception:
        return default


def ok(value: Any) -> dict[str, Any]:
    return {"__kind__": "ok", "ok": value}


def err(message: str) -> dict[str, Any]:
    return {"__kind__": "err", "err": message}


def result_username(result: dict[str, Any]) -> str | None:
    if result.get("__kind__") != "ok":
        return None
    payload = result.get("ok")
    if isinstance(payload, dict):
        return str(payload.get("username", "")).strip() or None
    return None


def make_id(prefix: str) -> str:
    return f"{prefix}_{int(time.time() * 1000):x}{os.urandom(3).hex()}"


def load_seed_rows() -> list[dict[str, Any]]:
    payload = read_json_file(AGM_SEED_PATH, {"shareholders": []})
    rows = payload.get("shareholders", []) if isinstance(payload, dict) else []
    return rows if isinstance(rows, list) else []


def build_year_record(year: str, created_by: str, base_settings: dict[str, Any], cloned_from_year: str | None = None) -> dict[str, Any]:
    return {
        "year": year,
        "isLocked": False,
        "isArchived": False,
        "createdAt": now_ns(),
        "createdBy": created_by,
        "lockedAt": None,
        "lockedBy": None,
        "archivedAt": None,
        "archivedBy": None,
        "clonedFromYear": cloned_from_year,
        "settingsSnapshot": {
            "venue": str(base_settings.get("venue", "")),
            "sessionTimeoutMinutes": int(base_settings.get("sessionTimeoutMinutes", 120)),
            "quorumThreshold": int(base_settings.get("quorumThreshold", 50)),
            "agmDate": str(base_settings.get("agmDate", "")),
            "agmName": str(base_settings.get("agmName", DEFAULT_SETTINGS["agmName"])),
        },
    }


def build_seed_shareholders(imported_by: str) -> list[dict[str, Any]]:
    imported_at = now_ns()
    shareholders: list[dict[str, Any]] = []
    for index, row in enumerate(load_seed_rows(), start=1):
        shareholders.append(
            {
                "id": f"sh_bawjiase_{index}",
                "status": "NotRegistered",
                "tags": list(row.get("tags", [])),
                "fullName": str(row.get("fullName", "")),
                "importedAt": imported_at,
                "importedBy": imported_by,
                "email": None,
                "shareholderNumber": str(row.get("shareholderNumber", "")),
                "idNumber": str(row.get("idNumber", "")),
                "phone": None,
                "shareholding": int(row.get("shareholding", 0) or 0),
            }
        )
    return shareholders


def build_initial_state() -> dict[str, Any]:
    created_at = now_ns()
    current_year = str(time.localtime().tm_year)
    return {
        "version": MOCK_STATE_VERSION,
        "settings": deepcopy(DEFAULT_SETTINGS),
        "yearRegistry": [build_year_record(current_year, DEFAULT_ADMIN, DEFAULT_SETTINGS)],
        "users": [
            {
                "principal": "",
                "username": DEFAULT_ADMIN,
                "createdAt": created_at,
                "role": "SuperAdmin",
                "isActive": True,
                "passwordHash": DEFAULT_ADMIN,
                "sessionExpiry": None,
                "lastLogin": None,
                "mustChangePassword": False,
                "plainPassword": DEFAULT_ADMIN,
                "phoneNumber": "0241234567",
                "isPhoneVerified": True,
            }
        ],
        "sessions": [],
        "shareholders": build_seed_shareholders(DEFAULT_ADMIN),
        "registrations": [],
        "checkIns": [],
        "importBatches": [],
        "auditEntries": [
            {
                "id": make_id("audit"),
                "action": "INIT",
                "entityId": "seed",
                "performedAt": created_at,
                "performedBy": DEFAULT_ADMIN,
                "details": f"Loaded {len(load_seed_rows())} shareholders from seed",
                "entityType": "system",
                "ipAddress": "127.0.0.1",
            }
        ],
        "passwordResetCodes": [],
    }


def load_state() -> dict[str, Any]:
    state = read_json_file(AGM_STATE_PATH, {})
    if not isinstance(state, dict) or not state.get("users"):
        state = build_initial_state()
        atomic_write_json(AGM_STATE_PATH, state)
    if not state.get("shareholders") and not state.get("registrations") and not state.get("checkIns"):
        state["shareholders"] = build_seed_shareholders(DEFAULT_ADMIN)
        atomic_write_json(AGM_STATE_PATH, state)
    return state


def save_state(state: dict[str, Any]) -> None:
    atomic_write_json(AGM_STATE_PATH, state)


def add_audit(state: dict[str, Any], action: str, entity_type: str, entity_id: str, performed_by: str, details: str) -> None:
    entries = state.setdefault("auditEntries", [])
    entries.insert(
        0,
        {
            "id": make_id("audit"),
            "action": action,
            "entityId": entity_id,
            "performedAt": now_ns(),
            "performedBy": performed_by,
            "details": details,
            "entityType": entity_type,
            "ipAddress": "127.0.0.1",
        },
    )


def get_user(state: dict[str, Any], username: str) -> dict[str, Any] | None:
    for user in state.get("users", []):
        if str(user.get("username", "")) == username:
            return user
    return None


def sanitize_user(user: dict[str, Any]) -> dict[str, Any]:
    safe_user = dict(user)
    safe_user.pop("plainPassword", None)
    return safe_user


def redact_shareholder(shareholder: dict[str, Any], session: dict[str, Any]) -> dict[str, Any]:
    if session.get("role") in {"SuperAdmin", "Admin"}:
        return dict(shareholder)
    redacted = dict(shareholder)
    redacted["idNumber"] = "REDACTED"
    redacted["email"] = None
    redacted["phone"] = None
    return redacted


def get_or_create_year_record(state: dict[str, Any], year: str, created_by: str) -> dict[str, Any]:
    registry = state.setdefault("yearRegistry", [])
    for record in registry:
        if str(record.get("year", "")) == year:
            return record
    record = build_year_record(year, created_by, state.get("settings", DEFAULT_SETTINGS))
    registry.append(record)
    return record


def extract_agm_year_from_notes(notes: str | None) -> str | None:
    if not notes:
        return None
    for line in str(notes).splitlines():
        if line.startswith("AGM Year:"):
            year = line.split(":", 1)[1].strip()
            return year or None
    return None


def assert_year_writable(state: dict[str, Any], year: str | None) -> dict[str, Any]:
    if not year:
        return ok(None)
    for record in state.get("yearRegistry", []):
        if str(record.get("year", "")) != year:
            continue
        if record.get("isArchived"):
            return err("AGM_YEAR_ARCHIVED")
        if record.get("isLocked"):
            return err("AGM_YEAR_LOCKED")
    return ok(None)


def require_session(state: dict[str, Any], token: str) -> dict[str, Any]:
    sessions = state.setdefault("sessions", [])
    current = now_ns()
    for session in sessions:
        if str(session.get("token", "")) != token:
            continue
        if int(session.get("expiresAt", 0) or 0) < current:
            sessions[:] = [item for item in sessions if item.get("token") != token]
            save_state(state)
            return err("SESSION_EXPIRED")
        session["expiresAt"] = current + int(state.get("settings", DEFAULT_SETTINGS).get("sessionTimeoutMinutes", 120)) * 60_000_000_000
        save_state(state)
        return ok(session)
    return err("INVALID_SESSION")


def require_role(state: dict[str, Any], token: str, allowed_roles: set[str]) -> dict[str, Any]:
    session = require_session(state, token)
    if session.get("__kind__") == "err":
        return session
    if str(session["ok"].get("role", "")) not in allowed_roles:
        return err("FORBIDDEN")
    return session


def compute_dashboard_metrics(state: dict[str, Any]) -> dict[str, Any]:
    shareholders = state.get("shareholders", [])
    total = len(shareholders)
    registered_in_person = sum(1 for item in shareholders if item.get("status") == "RegisteredInPerson")
    registered_proxy = sum(1 for item in shareholders if item.get("status") == "RegisteredProxy")
    checked_in = sum(1 for item in shareholders if item.get("status") == "CheckedIn")
    registered = registered_in_person + registered_proxy + checked_in
    not_registered = total - registered
    attendance_rate = 0 if total == 0 else checked_in / total
    settings = state.get("settings", DEFAULT_SETTINGS)
    return {
        "totalShareholders": total,
        "quorumStatus": checked_in >= int(settings.get("quorumThreshold", 50) or 50),
        "lastUpdated": now_ns(),
        "registeredInPerson": registered_in_person,
        "attendanceRate": attendance_rate,
        "registeredProxy": registered_proxy,
        "checkedIn": checked_in,
        "notRegistered": not_registered,
        "registered": registered,
    }


def agm_login(state: dict[str, Any], username: str, password: str) -> dict[str, Any]:
    user = get_user(state, username)
    if not user or str(user.get("plainPassword", "")) != password:
        return err("INVALID_CREDENTIALS")
    if not user.get("isActive", True):
        return err("ACCOUNT_DISABLED")
    token = make_id("session")
    expires_at = now_ns() + int(state.get("settings", DEFAULT_SETTINGS).get("sessionTimeoutMinutes", 120)) * 60_000_000_000
    session = {
        "token": token,
        "expiresAt": expires_at,
        "username": user["username"],
        "role": user["role"],
    }
    state.setdefault("sessions", []).append(session)
    user["lastLogin"] = now_ns()
    user["sessionExpiry"] = expires_at
    add_audit(state, "LOGIN", "user", user["username"], user["username"], "User logged in")
    save_state(state)
    return ok(
        {
            "token": token,
            "username": user["username"],
            "role": user["role"],
            "mustChangePassword": bool(user.get("mustChangePassword", False)),
            "phoneNumber": user.get("phoneNumber", "") or "",
            "isPhoneVerified": bool(user.get("isPhoneVerified", True)),
        }
    )


def agm_change_password(state: dict[str, Any], username: str, old_password: str, new_password: str) -> dict[str, Any]:
    user = get_user(state, username)
    if not user or str(user.get("plainPassword", "")) != old_password:
        return err("INVALID_CREDENTIALS")
    if len(new_password) < 8:
        return err("PASSWORD_TOO_SHORT")
    user["plainPassword"] = new_password
    user["passwordHash"] = new_password
    user["mustChangePassword"] = False
    add_audit(state, "CHANGE_PASSWORD", "user", username, username, "Password changed")
    save_state(state)
    return ok(None)


def dispatch_agm_rpc(state: dict[str, Any], method: str, args: list[Any]) -> Any:
    shareholders = state.setdefault("shareholders", [])
    registrations = state.setdefault("registrations", [])
    check_ins = state.setdefault("checkIns", [])
    sessions = state.setdefault("sessions", [])
    import_batches = state.setdefault("importBatches", [])
    password_reset_codes = state.setdefault("passwordResetCodes", [])

    if method == "login":
        return agm_login(state, str(args[0]), str(args[1]))
    if method == "validateSession":
        return require_session(state, str(args[0]))
    if method == "logout":
        token = str(args[0])
        state["sessions"] = [item for item in sessions if str(item.get("token", "")) != token]
        save_state(state)
        return None
    if method == "changePassword":
        return agm_change_password(state, str(args[0]), str(args[1]), str(args[2]))
    if method == "changePasswordSecure":
        session = require_session(state, str(args[0]))
        username = result_username(session)
        if not username:
            return session
        return agm_change_password(state, username, str(args[1]), str(args[2]))
    if method == "createPasswordResetCode":
        session = require_role(state, str(args[0]), {"SuperAdmin"})
        username = str(args[1])
        if session.get("__kind__") == "err":
            return session
        user = get_user(state, username)
        if not user:
            return err("USER_NOT_FOUND")
        code = {
            "code": f"RST-{make_id('code')[-8:].upper()}",
            "username": username,
            "issuedBy": session["ok"]["username"],
            "issuedAt": now_ns(),
            "expiresAt": now_ns() + 15 * 60_000_000_000,
            "attempts": 0,
        }
        state["passwordResetCodes"] = [item for item in password_reset_codes if item.get("username") != username]
        state["passwordResetCodes"].append(code)
        add_audit(state, "ISSUE_RESET_CODE", "user", username, session["ok"]["username"], "Issued password reset code")
        save_state(state)
        return ok(code)
    if method == "resetPasswordWithCode":
        username = str(args[0])
        reset_code = str(args[1])
        new_password = str(args[2])
        user = get_user(state, username)
        if not user:
            return err("USER_NOT_FOUND")
        issued = next((item for item in password_reset_codes if item.get("username") == username), None)
        if not issued or str(issued.get("code", "")) != reset_code:
            return err("INVALID_RESET_CODE")
        if int(issued.get("expiresAt", 0) or 0) < now_ns():
            state["passwordResetCodes"] = [item for item in password_reset_codes if item.get("username") != username]
            save_state(state)
            return err("RESET_CODE_EXPIRED")
        if len(new_password) < 8:
            return err("PASSWORD_TOO_SHORT")
        user["plainPassword"] = new_password
        user["passwordHash"] = new_password
        user["mustChangePassword"] = False
        state["passwordResetCodes"] = [item for item in password_reset_codes if item.get("username") != username]
        add_audit(state, "RESET_PASSWORD", "user", username, username, "Password reset")
        save_state(state)
        return ok(None)
    if method == "getFirstTimeVerificationState":
        session = require_session(state, str(args[0]))
        username = result_username(session)
        if not username:
            return session
        user = get_user(state, username)
        if not user:
            return err("USER_NOT_FOUND")
        return ok(
            {
                "phoneNumber": user.get("phoneNumber", "") or "",
                "tokenHint": DEFAULT_PHONE_TOKEN,
                "isVerified": bool(user.get("isPhoneVerified", True)),
            }
        )
    if method == "completeFirstTimeVerification":
        session = require_session(state, str(args[0]))
        username = result_username(session)
        if not username:
            return session
        phone_number = str(args[1]).strip()
        token_code = str(args[2]).strip()
        user = get_user(state, username)
        if not user:
            return err("USER_NOT_FOUND")
        if str(user.get("phoneNumber", "")).strip() != phone_number:
            return err("PHONE_NUMBER_DOES_NOT_MATCH_ADMIN_RECORD")
        if token_code != DEFAULT_PHONE_TOKEN:
            return err("INVALID_PHONE_VERIFICATION_TOKEN")
        user["isPhoneVerified"] = True
        add_audit(state, "VERIFY_PHONE", "user", username, username, "Completed first-time phone verification")
        save_state(state)
        return ok(None)
    if method == "getSettings":
        return state.get("settings", deepcopy(DEFAULT_SETTINGS))
    if method == "updateSettings":
        session = require_role(state, str(args[0]), {"SuperAdmin", "Admin", "RegistrationOfficer"})
        if session.get("__kind__") == "err":
            return session
        incoming = args[1] if isinstance(args[1], dict) else {}
        settings = state.setdefault("settings", deepcopy(DEFAULT_SETTINGS))
        settings.update(
            {
                "venue": str(incoming.get("venue", settings.get("venue", ""))),
                "sessionTimeoutMinutes": int(incoming.get("sessionTimeoutMinutes", settings.get("sessionTimeoutMinutes", 120)) or 120),
                "quorumThreshold": int(incoming.get("quorumThreshold", settings.get("quorumThreshold", 50)) or 50),
                "agmDate": str(incoming.get("agmDate", settings.get("agmDate", ""))),
                "agmName": str(incoming.get("agmName", settings.get("agmName", DEFAULT_SETTINGS["agmName"]))),
            }
        )
        add_audit(state, "UPDATE_SETTINGS", "settings", "agm", session["ok"]["username"], "Settings updated")
        save_state(state)
        return ok(settings)
    if method == "getYearRegistry":
        session = require_session(state, str(args[0]))
        if session.get("__kind__") == "err":
            return session
        registry = sorted(state.get("yearRegistry", []), key=lambda item: int(str(item.get("year", "0")) or "0"))
        return ok(registry)
    if method == "updateYearRecord":
        session = require_role(state, str(args[0]), {"SuperAdmin", "Admin"})
        if session.get("__kind__") == "err":
            return session
        year = str(args[1])
        updates = args[2] if isinstance(args[2], dict) else {}
        record = get_or_create_year_record(state, year, session["ok"]["username"])
        if "isLocked" in updates:
            record["isLocked"] = bool(updates.get("isLocked"))
            if record["isLocked"]:
                record["lockedAt"] = now_ns()
                record["lockedBy"] = session["ok"]["username"]
        if "isArchived" in updates:
            record["isArchived"] = bool(updates.get("isArchived"))
            if record["isArchived"]:
                record["archivedAt"] = now_ns()
                record["archivedBy"] = session["ok"]["username"]
        add_audit(state, "UPDATE_AGM_YEAR", "agmYear", year, session["ok"]["username"], f"Locked: {record['isLocked']} | Archived: {record['isArchived']}")
        save_state(state)
        return ok(record)
    if method == "cloneYearSettings":
        session = require_role(state, str(args[0]), {"SuperAdmin", "Admin"})
        if session.get("__kind__") == "err":
            return session
        from_year = str(args[1])
        to_year = str(args[2])
        if from_year == to_year:
            return err("TARGET_YEAR_MUST_BE_DIFFERENT")
        existing_target = next((item for item in state.get("yearRegistry", []) if str(item.get("year", "")) == to_year), None)
        if existing_target:
            return err("TARGET_YEAR_ALREADY_EXISTS")
        source = get_or_create_year_record(state, from_year, session["ok"]["username"])
        cloned = build_year_record(to_year, session["ok"]["username"], source.get("settingsSnapshot", state.get("settings", DEFAULT_SETTINGS)), from_year)
        cloned["settingsSnapshot"]["agmName"] = str(cloned["settingsSnapshot"].get("agmName", "")).replace(from_year, to_year)
        cloned["settingsSnapshot"]["agmDate"] = str(cloned["settingsSnapshot"].get("agmDate", "")).replace(from_year, to_year)
        state.setdefault("yearRegistry", []).append(cloned)
        add_audit(state, "CLONE_AGM_YEAR", "agmYear", to_year, session["ok"]["username"], f"Cloned settings from AGM Year {from_year} to AGM Year {to_year}")
        save_state(state)
        return ok(cloned)
    if method == "recordAuditEvent":
        session = require_session(state, str(args[0]))
        if session.get("__kind__") == "err":
            return session
        add_audit(state, str(args[1]), str(args[2]), str(args[3]), session["ok"]["username"], str(args[4]))
        save_state(state)
        return ok(None)
    if method == "getDashboardMetrics":
        return compute_dashboard_metrics(state)
    if method == "getAllShareholders":
        return [dict(item) for item in shareholders]
    if method == "getAllShareholdersSecure":
        session = require_session(state, str(args[0]))
        if session.get("__kind__") == "err":
            return session
        return ok([redact_shareholder(item, session["ok"]) for item in shareholders])
    if method == "getShareholder":
        shareholder = next((item for item in shareholders if item.get("id") == str(args[0])), None)
        return deepcopy(shareholder) if shareholder else None
    if method == "getShareholderSecure":
        session = require_session(state, str(args[0]))
        if session.get("__kind__") == "err":
            return session
        shareholder = next((item for item in shareholders if item.get("id") == str(args[1])), None)
        return ok(redact_shareholder(shareholder, session["ok"]) if shareholder else None)
    if method == "getShareholderByNumber":
        shareholder = next((item for item in shareholders if item.get("shareholderNumber") == str(args[0])), None)
        return deepcopy(shareholder) if shareholder else None
    if method == "getShareholderByNumberSecure":
        session = require_session(state, str(args[0]))
        if session.get("__kind__") == "err":
            return session
        shareholder = next((item for item in shareholders if item.get("shareholderNumber") == str(args[1])), None)
        return ok(redact_shareholder(shareholder, session["ok"]) if shareholder else None)
    if method in {"searchShareholders", "searchShareholdersSecure"}:
        session = None
        offset = 0
        if method.endswith("Secure"):
            session = require_session(state, str(args[0]))
            if session.get("__kind__") == "err":
                return session
            offset = 1
        query = str(args[offset]).lower()
        status_filter = args[offset + 1]
        page = int(args[offset + 2] or 0)
        page_size = int(args[offset + 3] or 0)
        filtered = []
        for item in shareholders:
            matches_query = (not query) or query in str(item.get("fullName", "")).lower() or query in str(item.get("shareholderNumber", "")).lower() or query in str(item.get("idNumber", "")).lower()
            matches_status = (not status_filter) or item.get("status") == status_filter
            if matches_query and matches_status:
                filtered.append(redact_shareholder(item, session["ok"]) if session else dict(item))
        start = page * page_size
        result = {"total": len(filtered), "page": page, "items": filtered[start:start + page_size]}
        return ok(result) if session else result
    if method == "createShareholder":
        data = args[0] if isinstance(args[0], dict) else {}
        imported_by = str(args[1])
        shareholder = {
            "id": make_id("sh"),
            "status": "NotRegistered",
            "tags": list(data.get("tags", [])),
            "fullName": str(data.get("fullName", "")),
            "importedAt": now_ns(),
            "importedBy": imported_by,
            "email": data.get("email"),
            "shareholderNumber": str(data.get("shareholderNumber", "")),
            "idNumber": str(data.get("idNumber", "")),
            "phone": data.get("phone"),
            "shareholding": int(data.get("shareholding", 0) or 0),
        }
        shareholders.append(shareholder)
        add_audit(state, "CREATE_SHAREHOLDER", "shareholder", shareholder["id"], imported_by, f"Created {shareholder['shareholderNumber']}")
        save_state(state)
        return ok(shareholder)
    if method == "bulkCreateShareholders":
        items = args[0] if isinstance(args[0], list) else []
        imported_by = str(args[1])
        created = 0
        duplicates = 0
        for current in items:
            if not isinstance(current, dict):
                continue
            exists = any(
                item.get("shareholderNumber") == current.get("shareholderNumber")
                or item.get("idNumber") == current.get("idNumber")
                for item in shareholders
            )
            if exists:
                duplicates += 1
                continue
            shareholders.append(
                {
                    "id": make_id("sh"),
                    "status": "NotRegistered",
                    "tags": list(current.get("tags", [])),
                    "fullName": str(current.get("fullName", "")),
                    "importedAt": now_ns(),
                    "importedBy": imported_by,
                    "email": current.get("email"),
                    "shareholderNumber": str(current.get("shareholderNumber", "")),
                    "idNumber": str(current.get("idNumber", "")),
                    "phone": current.get("phone"),
                    "shareholding": int(current.get("shareholding", 0) or 0),
                }
            )
            created += 1
        save_state(state)
        return {"created": created, "errors": [], "duplicates": duplicates}
    if method == "updateShareholderStatus":
        shareholder_id = str(args[0])
        status = str(args[1])
        updated_by = str(args[2])
        shareholder = next((item for item in shareholders if item.get("id") == shareholder_id), None)
        if not shareholder:
            return err("SHAREHOLDER_NOT_FOUND")
        shareholder["status"] = status
        add_audit(state, "UPDATE_STATUS", "shareholder", shareholder_id, updated_by, f"Status: {status}")
        save_state(state)
        return ok(shareholder)
    if method == "deleteAllShareholders":
        deleted_by = str(args[0])
        count = len(shareholders)
        state["shareholders"] = []
        state["registrations"] = []
        state["checkIns"] = []
        add_audit(state, "DELETE_ALL_SHAREHOLDERS", "shareholder", "*", deleted_by, "Cleared shareholder data")
        save_state(state)
        return ok(count)
    if method == "getAllRegistrations":
        return [dict(item) for item in registrations]
    if method == "getRegistration":
        item = next((entry for entry in registrations if entry.get("id") == str(args[0])), None)
        return deepcopy(item) if item else None
    if method == "getRegistrationByShareholder":
        item = next((entry for entry in registrations if entry.get("shareholderId") == str(args[0])), None)
        return deepcopy(item) if item else None
    if method == "registerShareholder":
        shareholder_id = str(args[0])
        reg_type = str(args[1])
        proxy_data = args[2] if isinstance(args[2], dict) else None
        registered_by = str(args[3])
        shareholder = next((item for item in shareholders if item.get("id") == shareholder_id), None)
        if not shareholder:
            return err("SHAREHOLDER_NOT_FOUND")
        registration = {
            "id": make_id("reg"),
            "shareholderId": shareholder_id,
            "verificationCode": make_id("verify").upper(),
            "proxyContact": proxy_data.get("proxyContact") if proxy_data else None,
            "proxyProofKey": proxy_data.get("proxyProofKey") if proxy_data else None,
            "updatedAt": now_ns(),
            "updatedBy": registered_by,
            "proxyFraudFlags": [],
            "notes": None,
            "proxyName": proxy_data.get("proxyName") if proxy_data else None,
            "proxyProofValidated": reg_type != "Proxy",
            "registrationType": reg_type,
            "registeredAt": now_ns(),
            "registeredBy": registered_by,
        }
        registrations.append(registration)
        shareholder["status"] = "RegisteredProxy" if reg_type == "Proxy" else "RegisteredInPerson"
        add_audit(state, "REGISTER_SHAREHOLDER", "registration", registration["id"], registered_by, reg_type)
        save_state(state)
        return ok(registration)
    if method == "updateRegistration":
        registration_id = str(args[0])
        updates = args[1] if isinstance(args[1], dict) else {}
        updated_by = str(args[2])
        registration = next((entry for entry in registrations if entry.get("id") == registration_id), None)
        if not registration:
            return err("REGISTRATION_NOT_FOUND")
        year_state = assert_year_writable(state, extract_agm_year_from_notes(registration.get("notes")))
        if year_state.get("__kind__") == "err":
            return year_state
        proxy_data = updates.get("proxyData") if isinstance(updates.get("proxyData"), dict) else {}
        if "notes" in updates:
            registration["notes"] = updates.get("notes")
        if proxy_data:
            registration["proxyContact"] = proxy_data.get("proxyContact", registration.get("proxyContact"))
            registration["proxyName"] = proxy_data.get("proxyName", registration.get("proxyName"))
            registration["proxyProofKey"] = proxy_data.get("proxyProofKey", registration.get("proxyProofKey"))
        registration["updatedAt"] = now_ns()
        registration["updatedBy"] = updated_by
        agm_year = extract_agm_year_from_notes(registration.get("notes"))
        next_year_state = assert_year_writable(state, agm_year)
        if next_year_state.get("__kind__") == "err":
            return next_year_state
        if agm_year:
            get_or_create_year_record(state, agm_year, updated_by)
        add_audit(state, "UPDATE_REGISTRATION", "registration", registration_id, updated_by, f"Updated | AGM Year: {agm_year}" if agm_year else "Updated")
        save_state(state)
        return ok(registration)
    if method == "cancelRegistration":
        registration_id = str(args[0])
        cancelled_by = str(args[1])
        reason = str(args[2])
        registration = next((entry for entry in registrations if entry.get("id") == registration_id), None)
        if not registration:
            return err("REGISTRATION_NOT_FOUND")
        year_state = assert_year_writable(state, extract_agm_year_from_notes(registration.get("notes")))
        if year_state.get("__kind__") == "err":
            return year_state
        state["registrations"] = [entry for entry in registrations if entry.get("id") != registration_id]
        shareholder = next((item for item in shareholders if item.get("id") == registration.get("shareholderId")), None)
        if shareholder:
            shareholder["status"] = "NotRegistered"
        add_audit(state, "CANCEL_REGISTRATION", "registration", registration_id, cancelled_by, reason)
        save_state(state)
        return ok(None)
    if method == "validateProxyProof":
        registration_id = str(args[0])
        validated = bool(args[1])
        fraud_flags = list(args[2] if isinstance(args[2], list) else [])
        validated_by = str(args[3])
        registration = next((entry for entry in registrations if entry.get("id") == registration_id), None)
        if not registration:
            return err("REGISTRATION_NOT_FOUND")
        year_state = assert_year_writable(state, extract_agm_year_from_notes(registration.get("notes")))
        if year_state.get("__kind__") == "err":
            return year_state
        registration["proxyProofValidated"] = validated
        registration["proxyFraudFlags"] = fraud_flags
        registration["updatedAt"] = now_ns()
        registration["updatedBy"] = validated_by
        add_audit(state, "VALIDATE_PROXY", "registration", registration_id, validated_by, str(validated))
        save_state(state)
        return ok(registration)
    if method == "getAllCheckIns":
        return [dict(item) for item in check_ins]
    if method == "getCheckIn":
        item = next((entry for entry in check_ins if entry.get("id") == str(args[0])), None)
        return deepcopy(item) if item else None
    if method == "getCheckInByShareholder":
        item = next((entry for entry in check_ins if entry.get("shareholderId") == str(args[0])), None)
        return deepcopy(item) if item else None
    if method == "checkInShareholder":
        shareholder_id = str(args[0])
        registration_id = str(args[1])
        method_name = str(args[2])
        checked_in_by = str(args[3])
        shareholder = next((item for item in shareholders if item.get("id") == shareholder_id), None)
        registration = next((entry for entry in registrations if entry.get("id") == registration_id), None)
        if not shareholder:
            return err("SHAREHOLDER_NOT_FOUND")
        if not registration or registration.get("shareholderId") != shareholder_id:
            return err("REGISTRATION_NOT_FOUND")
        year_state = assert_year_writable(state, extract_agm_year_from_notes(registration.get("notes")))
        if year_state.get("__kind__") == "err":
            return year_state
        check_in = {
            "id": make_id("checkin"),
            "shareholderId": shareholder_id,
            "method": method_name,
            "checkedInAt": now_ns(),
            "checkedInBy": checked_in_by,
            "registrationId": registration_id,
        }
        check_ins.append(check_in)
        shareholder["status"] = "CheckedIn"
        add_audit(state, "CHECK_IN", "checkin", check_in["id"], checked_in_by, method_name)
        save_state(state)
        return ok(check_in)
    if method == "undoCheckIn":
        shareholder_id = str(args[0])
        undone_by = str(args[1])
        item = next((entry for entry in check_ins if entry.get("shareholderId") == shareholder_id), None)
        if not item:
            return err("CHECKIN_NOT_FOUND")
        registration = next((entry for entry in registrations if entry.get("shareholderId") == shareholder_id), None)
        year_state = assert_year_writable(state, extract_agm_year_from_notes(registration.get("notes") if registration else None))
        if year_state.get("__kind__") == "err":
            return year_state
        state["checkIns"] = [entry for entry in check_ins if entry.get("id") != item.get("id")]
        shareholder = next((entry for entry in shareholders if entry.get("id") == shareholder_id), None)
        if shareholder:
            shareholder["status"] = "RegisteredProxy" if registration and registration.get("registrationType") == "Proxy" else "RegisteredInPerson" if registration else "NotRegistered"
        add_audit(state, "UNDO_CHECK_IN", "checkin", str(item.get("id")), undone_by, "Reverted")
        save_state(state)
        return ok(None)
    if method == "createImportBatch":
        batch = {
            "id": make_id("import"),
            "status": "Pending",
            "totalRows": int(args[2] or 0),
            "duplicatesSkipped": 0,
            "filename": str(args[0]),
            "importedRows": 0,
            "uploadedAt": now_ns(),
            "uploadedBy": str(args[1]),
        }
        import_batches.append(batch)
        add_audit(state, "CREATE_IMPORT_BATCH", "import", batch["id"], batch["uploadedBy"], batch["filename"])
        save_state(state)
        return batch
    if method == "updateImportBatchStatus":
        batch = next((entry for entry in import_batches if entry.get("id") == str(args[0])), None)
        if not batch:
            return err("IMPORT_BATCH_NOT_FOUND")
        batch["status"] = str(args[1])
        batch["importedRows"] = int(args[2] or 0)
        batch["duplicatesSkipped"] = int(args[3] or 0)
        save_state(state)
        return ok(batch)
    if method == "getImportBatch":
        batch = next((entry for entry in import_batches if entry.get("id") == str(args[0])), None)
        return deepcopy(batch) if batch else None
    if method == "getImportBatches":
        return [dict(item) for item in import_batches]
    if method == "getUsers":
        session = require_role(state, str(args[0]), {"SuperAdmin", "Admin", "RegistrationOfficer"})
        if session.get("__kind__") == "err":
            return session
        return ok([sanitize_user(user) for user in state.get("users", [])])
    if method == "createUser":
        session = require_role(state, str(args[0]), {"SuperAdmin"})
        if session.get("__kind__") == "err":
            return session
        username = str(args[1])
        password = str(args[2])
        role = str(args[3])
        if get_user(state, username):
            return err("USERNAME_TAKEN")
        user = {
            "principal": "",
            "username": username,
            "createdAt": now_ns(),
            "role": role,
            "isActive": True,
            "passwordHash": password,
            "sessionExpiry": None,
            "lastLogin": None,
            "mustChangePassword": True,
            "plainPassword": password,
            "phoneNumber": "",
            "isPhoneVerified": False,
        }
        state.setdefault("users", []).append(user)
        add_audit(state, "CREATE_USER", "user", username, session["ok"]["username"], role)
        save_state(state)
        return ok(sanitize_user(user))
    if method == "createUserWithPhone":
        session = require_role(state, str(args[0]), {"SuperAdmin"})
        if session.get("__kind__") == "err":
            return session
        username = str(args[1])
        password = str(args[2])
        role = str(args[3])
        phone_number = str(args[4]).strip()
        if get_user(state, username):
            return err("USERNAME_TAKEN")
        if not phone_number:
            return err("PHONE_NUMBER_REQUIRED")
        user = {
            "principal": "",
            "username": username,
            "createdAt": now_ns(),
            "role": role,
            "isActive": True,
            "passwordHash": password,
            "sessionExpiry": None,
            "lastLogin": None,
            "mustChangePassword": True,
            "plainPassword": password,
            "phoneNumber": phone_number,
            "isPhoneVerified": False,
        }
        state.setdefault("users", []).append(user)
        add_audit(state, "CREATE_USER", "user", username, session["ok"]["username"], f"{role} with phone {phone_number}")
        save_state(state)
        return ok(sanitize_user(user))
    if method == "updateUserRole":
        session = require_role(state, str(args[0]), {"SuperAdmin"})
        if session.get("__kind__") == "err":
            return session
        username = str(args[1])
        role = str(args[2])
        user = get_user(state, username)
        if not user:
            return err("USER_NOT_FOUND")
        user["role"] = role
        add_audit(state, "UPDATE_USER_ROLE", "user", username, session["ok"]["username"], role)
        save_state(state)
        return ok(sanitize_user(user))
    if method == "deactivateUser":
        session = require_role(state, str(args[0]), {"SuperAdmin"})
        if session.get("__kind__") == "err":
            return session
        username = str(args[1])
        user = get_user(state, username)
        if not user:
            return err("USER_NOT_FOUND")
        user["isActive"] = False
        add_audit(state, "DEACTIVATE_USER", "user", username, session["ok"]["username"], "Disabled")
        save_state(state)
        return ok(None)
    if method == "getActiveSessions":
        session = require_role(state, str(args[0]), {"SuperAdmin"})
        if session.get("__kind__") == "err":
            return session
        return ok([dict(item) for item in state.get("sessions", [])])
    if method == "forceLogout":
        session = require_role(state, str(args[0]), {"SuperAdmin"})
        if session.get("__kind__") == "err":
            return session
        username = str(args[1])
        state["sessions"] = [item for item in sessions if item.get("username") != username]
        add_audit(state, "FORCE_LOGOUT", "user", username, session["ok"]["username"], "Ended sessions")
        save_state(state)
        return ok(None)
    if method == "getAuditLog":
        entity_type = args[0]
        entity_id = args[1]
        limit = int(args[2] or 0)
        entries = [
            dict(entry)
            for entry in state.get("auditEntries", [])
            if (not entity_type or entry.get("entityType") == entity_type)
            and (not entity_id or entry.get("entityId") == entity_id)
        ]
        return entries[:limit]
    if method == "getAuditLogForExport":
        return [dict(entry) for entry in state.get("auditEntries", [])]
    if method == "deleteAuditEntries":
        session = require_role(state, str(args[0]), {"SuperAdmin"})
        if session.get("__kind__") == "err":
            return session
        targets = set(args[1] if isinstance(args[1], list) else [])
        before = len(state.get("auditEntries", []))
        state["auditEntries"] = [entry for entry in state.get("auditEntries", []) if entry.get("id") not in targets]
        deleted = before - len(state["auditEntries"])
        if deleted > 0:
            add_audit(state, "DELETE_AUDIT_ENTRIES", "audit", "*", session["ok"]["username"], f"Deleted {deleted} audit entries")
            save_state(state)
        return ok(deleted)
    raise ValueError(f"Unsupported method: {method}")


@AGM_RUNTIME_BP.route("/health", methods=["GET"])
def agm_runtime_health() -> Response:
    state = load_state()
    payload = {
        "status": "ok",
        "runtime": "portal-agm-runtime",
        "storageFile": AGM_STATE_PATH,
        "shareholderCount": len(state.get("shareholders", [])),
        "userCount": len(state.get("users", [])),
        "lastPersistedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(os.path.getmtime(AGM_STATE_PATH))) if os.path.exists(AGM_STATE_PATH) else None,
    }
    return Response(serialize_bigints(payload), mimetype="application/json")


@AGM_RUNTIME_BP.route("/rpc", methods=["POST", "OPTIONS"])
def agm_runtime_rpc() -> Response:
    if request.method == "OPTIONS":
        return Response(serialize_bigints({}), status=204, mimetype="application/json")

    try:
        payload = deserialize_bigints(request.get_data(as_text=True) or "{}")
        method = str(payload.get("method", ""))
        args = payload.get("args", [])
        if not isinstance(args, list):
            raise ValueError("RPC args must be an array")
        state = load_state()
        result = dispatch_agm_rpc(state, method, args)
        return Response(serialize_bigints({"result": result}), mimetype="application/json")
    except Exception as exc:
        return Response(serialize_bigints({"error": str(exc)}), status=500, mimetype="application/json")
