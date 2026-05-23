from __future__ import annotations

import json
import os
import secrets
import smtplib
import tempfile
import time
from email.message import EmailMessage
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from agm_runtime import AGM_RUNTIME_BP

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
DATA_DIR = os.getenv("PORTAL_DATA_DIR", BASE_DIR).strip() or BASE_DIR
FRONTEND_PUBLIC_DIR = os.getenv("PORTAL_FRONTEND_DIR", os.path.join(BASE_DIR, "public")).strip() or os.path.join(BASE_DIR, "public")

OFFICIAL_EMAIL_DOMAIN = (
    str(os.getenv("OFFICIAL_EMAIL_DOMAIN", "") or "").strip().lower()
    or "@bawjiasecommunitybank.com"
)
LEGACY_EMAIL_DOMAIN = "@bawjiasearearuralbank.com"
PRESENCE_STORE_PATH = os.path.join(DATA_DIR, "presence_store.json")
PASSWORD_STORE_PATH = os.path.join(DATA_DIR, "password_store.json")
USERS_STORE_PATH = os.path.join(DATA_DIR, "users_store.json")
PENDING_VERIFICATIONS_PATH = os.path.join(DATA_DIR, "pending_verifications.json")
RESET_TOKENS_PATH = os.path.join(DATA_DIR, "reset_tokens.json")
SESSIONS_STORE_PATH = os.path.join(DATA_DIR, "sessions_store.json")
ANNOUNCEMENTS_STORE_PATH = os.path.join(DATA_DIR, "announcements_store.json")
FORMS_STORE_PATH = os.path.join(DATA_DIR, "forms_store.json")
TRAINING_VIDEOS_STORE_PATH = os.path.join(DATA_DIR, "training_videos_store.json")
TRAINING_DOCUMENTS_STORE_PATH = os.path.join(DATA_DIR, "training_documents_store.json")
NOTIFICATIONS_STORE_PATH = os.path.join(DATA_DIR, "notifications_store.json")
TRAINING_VIDEO_PROGRESS_STORE_PATH = os.path.join(DATA_DIR, "training_video_progress_store.json")
TRAINING_DOCUMENT_OPENS_STORE_PATH = os.path.join(DATA_DIR, "training_document_opens_store.json")
TRAINING_REMINDERS_STORE_PATH = os.path.join(DATA_DIR, "training_reminders_store.json")
AUDIT_LOGS_STORE_PATH = os.path.join(DATA_DIR, "audit_logs_store.json")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
PRESENCE_TTL_SECONDS = 20
ONLINE_WINDOW_SECONDS = 20
RESET_TOKEN_TTL_SECONDS = 30 * 60
VERIFICATION_TTL_SECONDS = 15 * 60
SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
TRAINING_REMINDER_COOLDOWN_SECONDS = 24 * 60 * 60


def env_secret(name: str) -> str:
    return str(os.getenv(name, "") or "").strip()


DEFAULT_INITIAL_PASSWORD = env_secret("PORTAL_DEFAULT_INITIAL_PASSWORD")
FALLBACK_INITIAL_PASSWORD = "BcbPortal@2026"
IT_ACCESS_CODE = env_secret("IT_ACCESS_CODE")
HR_ACCESS_CODE = env_secret("HR_ACCESS_CODE")

INITIAL_USERS = [
    {
        "id": "db-user-6",
        "fullname": "Desmond Tettey Quarshie",
        "phone": "0243670230",
        "email": "dquarshie@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "position": "Staff",
        "department": "BANKING OPERATIONS",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1772637593885,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-9",
        "fullname": "Jane Afua Bruku",
        "phone": "0248154869",
        "email": "jbruku@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "position": "Staff",
        "department": "COMPLIANCE",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1770741882598,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-5",
        "fullname": "Kwabena Asare",
        "phone": "0599779664",
        "email": "kasare@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "position": "Staff",
        "department": "COMPLIANCE",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1770990814598,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-8",
        "fullname": "Kwesi Adu Snr Yeenu-Prah",
        "phone": "0555443053",
        "email": "kyeenu-prah@bawjiasecommunitybank.com",
        "role": "HRAdmin",
        "position": "Staff",
        "department": "HR",
        "branch": "HEAD OFFICE",
        "imageFile": "profile_pics/f658de3c2aa8ca6d.jpeg",
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1770296150530,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-4",
        "fullname": "Ato Asiedu Mensah",
        "phone": "0247554428",
        "email": "amensah@bawjiasecommunitybank.com",
        "role": "SuperAdmin",
        "position": "Staff",
        "department": "IT",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1770975614364,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-2",
        "fullname": "James Lincoln Awuah",
        "phone": "0536799490",
        "email": "lawuah@bawjiasecommunitybank.com",
        "role": "SuperAdmin",
        "position": "Staff",
        "department": "IT",
        "branch": "HEAD OFFICE",
        "imageFile": "profile_pics/88efb134d068db11.jpg",
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1775309044811,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-3",
        "fullname": "Nathaniel Oglie Narh",
        "phone": "0246377830",
        "email": "nnarh@bawjiasecommunitybank.com",
        "role": "SuperAdmin",
        "position": "Staff",
        "department": "IT",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1769519876185,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-7",
        "fullname": "GABRIEL OWUSU",
        "phone": "0246315586",
        "email": "gowusu@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "position": "Staff",
        "department": "RECOVERY",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1769689048721,
        "registrationTime": 0,
        "isArchived": False,
    },
]
app = Flask(__name__, static_folder=None)
app.register_blueprint(AGM_RUNTIME_BP)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)


STORE_DEFAULTS: dict[str, object] = {
    PRESENCE_STORE_PATH: {},
    PASSWORD_STORE_PATH: {},
    USERS_STORE_PATH: [],
    PENDING_VERIFICATIONS_PATH: {},
    RESET_TOKENS_PATH: {},
    SESSIONS_STORE_PATH: {},
    ANNOUNCEMENTS_STORE_PATH: [],
    FORMS_STORE_PATH: [],
    TRAINING_VIDEOS_STORE_PATH: [],
    TRAINING_DOCUMENTS_STORE_PATH: [],
    NOTIFICATIONS_STORE_PATH: [],
    TRAINING_VIDEO_PROGRESS_STORE_PATH: [],
    TRAINING_DOCUMENT_OPENS_STORE_PATH: [],
    TRAINING_REMINDERS_STORE_PATH: [],
    AUDIT_LOGS_STORE_PATH: [],
}


def initialize_data_directory() -> None:
    for path, default in STORE_DEFAULTS.items():
        if os.path.exists(path):
            continue
        legacy_path = os.path.join(BASE_DIR, os.path.basename(path))
        if path != legacy_path and os.path.exists(legacy_path):
            try:
                os.replace(legacy_path, path)
                continue
            except OSError:
                pass
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(default, handle, ensure_ascii=True, indent=2)


initialize_data_directory()


def seed_password_store_if_needed() -> None:
    existing = read_json_file(PASSWORD_STORE_PATH, {})
    if not isinstance(existing, dict) or existing:
        return
    initial_password = get_initial_password_seed_value()
    if not initial_password:
        return
    seeded = {
        user["email"]: hash_password_for_storage(initial_password)
        for user in INITIAL_USERS
    }
    save_password_store(seeded)


def get_initial_password_seed_value() -> str:
    configured = str(DEFAULT_INITIAL_PASSWORD or "").strip()
    if configured:
        return configured
    return FALLBACK_INITIAL_PASSWORD


def reconcile_initial_user_passwords() -> None:
    initial_password = get_initial_password_seed_value()
    if not initial_password:
        return
    passwords = load_password_store()
    changed = False
    for user in INITIAL_USERS:
        email = str(user.get("email", "")).strip().lower()
        stored = passwords.get(email, "")
        if not email:
            continue
        if not stored:
            passwords[email] = hash_password_for_storage(initial_password)
            changed = True
            continue
        if not is_secure_password_hash(stored):
            passwords[email] = hash_password_for_storage(initial_password)
            changed = True
            continue
    if changed:
        save_password_store(passwords)


def is_initial_user_email(email: str) -> bool:
    normalized = str(email or "").strip().lower()
    return any(
        str(user.get("email", "")).strip().lower() == normalized for user in INITIAL_USERS
    )


def allowed_origins() -> set[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "")
    return {item.strip() for item in raw.split(",") if item.strip()}


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    origins = allowed_origins()
    if "*" in origins:
        response.headers["Access-Control-Allow-Origin"] = origin or "*"
        response.headers["Vary"] = "Origin"
    elif origin and origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


def require_json():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify({"error": "JSON body required"}), 400)
    return data, None


def extract_drive_file_id(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if raw.startswith("DRIVE:"):
        return raw[6:].strip()
    if "drive.google.com" not in raw:
        return raw
    if "/d/" in raw:
        return raw.split("/d/")[1].split("/")[0].split("?")[0].strip()
    if "id=" in raw:
        return raw.split("id=")[1].split("&")[0].strip()
    return raw


def normalize_visibility_and_department(data: dict) -> tuple[str, str | None]:
    visibility = str(data.get("visibility", "General")).strip()
    if visibility not in {"General", "Department"}:
        raise ValueError("Visibility must be General or Department")
    department = str(data.get("department", "") or "").strip().upper() or None
    if visibility == "Department" and not department:
        raise ValueError("Department is required for department visibility")
    if visibility == "General":
        department = None
    return visibility, department


def normalize_scope_list(value: object, *, empty_default: list[str] | None = None) -> list[str]:
    if not isinstance(value, list):
        return list(empty_default or [])
    normalized: list[str] = []
    seen = set()
    for item in value:
        current = str(item or "").strip().upper()
        if not current:
            continue
        if current == "ALL":
            return ["ALL"]
        if current in seen:
            continue
        seen.add(current)
        normalized.append(current)
    return normalized or list(empty_default or [])


def default_permissions_for_role(role: str) -> dict[str, bool]:
    if role in {"SuperAdmin", "HRAdmin"}:
        return {
            "announcements": True,
            "forms": True,
            "trainingVideos": True,
            "trainingDocuments": True,
            "support": True,
            "userManagement": True,
        }
    return {
        "announcements": False,
        "forms": False,
        "trainingVideos": False,
        "trainingDocuments": False,
        "support": False,
        "userManagement": False,
    }


def normalize_user_permissions(value: object, role: str) -> dict[str, bool]:
    defaults = default_permissions_for_role(role)
    if not isinstance(value, dict):
        return defaults
    normalized = dict(defaults)
    for key in defaults:
        if key in value:
            normalized[key] = bool(value.get(key))
    return normalized


def normalize_managed_departments_by_branch(value: object) -> dict[str, list[str]]:
    if not isinstance(value, dict):
        return {}
    normalized: dict[str, list[str]] = {}
    for branch, departments in value.items():
        branch_key = str(branch or "").strip().upper()
        if not branch_key:
            continue
        normalized_departments = normalize_scope_list(departments, empty_default=[])
        if normalized_departments:
            normalized[branch_key] = normalized_departments
    return normalized


def validate_supervisor_configuration(user: dict) -> None:
    if str(user.get("role", "")).strip() != "Supervisor":
        return
    managed_branches = normalize_scope_list(user.get("managedBranches"), empty_default=[])
    permissions = normalize_user_permissions(user.get("permissions"), "Supervisor")
    managed_departments = normalize_managed_departments_by_branch(
        user.get("managedDepartmentsByBranch")
    )
    assignable_permissions = [
        "announcements",
        "forms",
        "trainingVideos",
        "trainingDocuments",
        "support",
    ]
    if not managed_branches:
        raise ValueError("Supervisors must be assigned at least one branch.")
    if not any(bool(permissions.get(key, False)) for key in assignable_permissions):
        raise ValueError("Supervisors must have at least one module permission enabled.")
    for branch in managed_branches:
        if branch == "ALL":
            raise ValueError("Supervisors cannot be assigned to all branches.")
        branch_departments = managed_departments.get(branch, [])
        if not branch_departments:
            raise ValueError(f"{branch} needs at least one department assignment.")


def derive_content_scope(
    data: dict,
    *,
    visibility: str,
    department: str | None,
    existing: dict | None = None,
) -> tuple[list[str], list[str]]:
    branch_scope = normalize_scope_list(
        data.get("branchScope", existing.get("branchScope") if existing else None),
        empty_default=["ALL"],
    )
    department_scope = normalize_scope_list(
        data.get("departmentScope", existing.get("departmentScope") if existing else None),
        empty_default=[],
    )
    if not department_scope:
        department_scope = [department] if visibility == "Department" and department else ["ALL"]
    return branch_scope, department_scope


def normalize_non_empty_title(value: object, label: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise ValueError(f"{label} is required")
    return normalized


def normalize_storage_type(value: object) -> str:
    normalized = str(value or "Drive").strip()
    if normalized not in {"Drive", "Local"}:
        raise ValueError("Storage type must be Drive or Local")
    return normalized


def normalize_local_filename(value: object) -> str:
    filename = secure_filename(str(value or "").strip())
    if not filename:
        raise ValueError("A valid uploaded file is required")
    if not os.path.isfile(os.path.join(UPLOADS_DIR, filename)):
        raise ValueError("Uploaded file could not be found")
    return filename


def normalize_form_file_url(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Form link is required")
    if "docs.google.com" in raw:
        return raw
    drive_id = extract_drive_file_id(raw)
    if not drive_id:
        raise ValueError("A valid Google Drive link or file ID is required")
    return drive_id


def normalize_announcement_payload(data: dict, actor: dict, existing: dict | None = None) -> dict:
    title = normalize_non_empty_title(
        data.get("title", existing.get("title") if existing else ""),
        "Announcement title",
    )
    content = str(data.get("content", existing.get("content") if existing else "")).strip()
    if not content:
        raise ValueError("Announcement content is required")
    category = str(data.get("category", existing.get("category") if existing else "")).strip() or actor["department"]
    poll = data.get("poll", existing.get("poll") if existing else None)
    if poll is not None and not isinstance(poll, dict):
        raise ValueError("Poll data is invalid")
    allow_download = bool(
        data.get("allowDownload", existing.get("allowDownload", True) if existing else True)
    )
    image_url = data.get("imageUrl", existing.get("imageUrl") if existing else None)
    file_url = data.get("fileUrl", existing.get("fileUrl") if existing else None)
    attachment_name = data.get("attachmentName", existing.get("attachmentName") if existing else None)
    visibility, department = normalize_visibility_and_department(
        {
            "visibility": data.get("visibility", existing.get("visibility") if existing else "General"),
            "department": data.get("department", existing.get("department") if existing else None),
        }
    )
    branch_scope, department_scope = derive_content_scope(
        data,
        visibility=visibility,
        department=department,
        existing=existing,
    )
    return {
        "title": title,
        "content": content,
        "category": category,
        "imageUrl": image_url,
        "fileUrl": file_url,
        "attachmentName": attachment_name,
        "allowDownload": allow_download,
        "poll": poll if isinstance(poll, dict) else None,
        "visibility": visibility,
        "department": department,
        "branchScope": branch_scope,
        "departmentScope": department_scope,
    }


def normalize_training_video_payload(data: dict, actor: dict) -> dict:
    title = normalize_non_empty_title(data.get("title"), "Video title")
    visibility, department = normalize_visibility_and_department(data)
    branch_scope, department_scope = derive_content_scope(
        data,
        visibility=visibility,
        department=department,
    )
    storage_type = normalize_storage_type(data.get("storageType", "Drive"))
    if storage_type == "Drive":
        drive_ref = extract_drive_file_id(data.get("driveRef") or data.get("videoUrl"))
        if not drive_ref:
            raise ValueError("A valid Google Drive file ID or link is required")
        video_url = f"DRIVE:{drive_ref}"
        local_filename = None
    else:
        local_filename = normalize_local_filename(data.get("localFilename"))
        video_url = f"LOCAL:{local_filename}"
        drive_ref = None
    return {
        "id": next_content_id(load_json_list_store(TRAINING_VIDEOS_STORE_PATH)),
        "title": title,
        "description": str(data.get("description", "")).strip(),
        "videoUrl": video_url,
        "thumbnailUrl": data.get("thumbnailUrl"),
        "duration": max(0, int(data.get("duration", 0) or 0)),
        "category": str(data.get("category", "")).strip() or (department or "General"),
        "visibleTo": [],
        "visibility": visibility,
        "department": department,
        "branchScope": branch_scope,
        "departmentScope": department_scope,
        "isMandatory": bool(data.get("isMandatory", False)),
        "allowDownload": bool(data.get("allowDownload", False)),
        "storageType": storage_type,
        "driveRef": drive_ref,
        "localFilename": local_filename,
        "uploadedBy": actor["fullname"],
        "uploadedAt": now_ms(),
        "viewCount": max(0, int(data.get("viewCount", 0) or 0)),
        "isArchived": bool(data.get("isArchived", False)),
    }


def normalize_training_document_payload(data: dict, actor: dict) -> dict:
    title = normalize_non_empty_title(data.get("title"), "Document title")
    visibility, department = normalize_visibility_and_department(data)
    branch_scope, department_scope = derive_content_scope(
        data,
        visibility=visibility,
        department=department,
    )
    storage_type = normalize_storage_type(data.get("storageType", "Drive"))
    if storage_type == "Drive":
        drive_ref = str(data.get("driveRef") or "").strip()
        file_url_raw = str(data.get("fileUrl") or "").strip()
        if "docs.google.com" in file_url_raw:
            file_url = file_url_raw
            drive_ref = file_url_raw
        else:
            drive_ref = extract_drive_file_id(drive_ref or file_url_raw)
            if not drive_ref:
                raise ValueError("A valid Google Drive document link or file ID is required")
            file_url = f"DRIVE:{drive_ref}"
        local_filename = None
    else:
        local_filename = normalize_local_filename(data.get("localFilename"))
        file_url = f"LOCAL:{local_filename}"
        drive_ref = None
    return {
        "id": next_content_id(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)),
        "title": title,
        "description": str(data.get("description", "")).strip(),
        "fileUrl": file_url,
        "fileType": str(data.get("fileType", "")).strip() or "application/octet-stream",
        "category": str(data.get("category", "")).strip() or (department or "General"),
        "visibleTo": [],
        "visibility": visibility,
        "department": department,
        "branchScope": branch_scope,
        "departmentScope": department_scope,
        "isMandatory": bool(data.get("isMandatory", False)),
        "allowDownload": bool(data.get("allowDownload", False)),
        "storageType": storage_type,
        "driveRef": drive_ref,
        "localFilename": local_filename,
        "uploadedBy": actor["fullname"],
        "uploadedAt": now_ms(),
        "downloadCount": max(0, int(data.get("downloadCount", 0) or 0)),
        "isArchived": bool(data.get("isArchived", False)),
    }


def parse_session_token() -> str:
    header = str(request.headers.get("Authorization", "")).strip()
    if header.startswith("Bearer "):
        return header[7:].strip()
    query_token = str(request.args.get("sessionToken", "")).strip()
    return query_token


def validate_email(email: str) -> str:
    normalized = (email or "").strip().lower()
    if not normalized.endswith(OFFICIAL_EMAIL_DOMAIN):
        if normalized.endswith(LEGACY_EMAIL_DOMAIN):
            raise ValueError(
                f"Please use your new official email address ending in {OFFICIAL_EMAIL_DOMAIN}"
            )
        raise ValueError(
            f"Please use your official email address ending in {OFFICIAL_EMAIL_DOMAIN}"
        )
    return normalized


def role_from_department(department: str) -> str:
    normalized = (department or "").strip().upper()
    if normalized == "IT":
        return "SuperAdmin"
    if normalized == "HR":
        return "HRAdmin"
    return "GeneralStaff"


def is_global_manager(user: dict | None) -> bool:
    return bool(user) and str(user.get("role", "")).strip() in {"SuperAdmin", "HRAdmin"}


def user_has_permission(user: dict, permission_key: str) -> bool:
    if is_global_manager(user):
        return True
    permissions = user.get("permissions")
    if not isinstance(permissions, dict):
        return False
    return bool(permissions.get(permission_key, False))


def now_ms() -> int:
    return int(time.time() * 1000)


def now_seconds() -> int:
    return int(time.time())


def legacy_hash_password(password: str) -> str:
    h = 0
    for char in password:
        h = ((31 * h) + ord(char)) & 0xFFFFFFFF
        if h & 0x80000000:
            h -= 0x100000000
    return str(abs(h))


def is_secure_password_hash(value: str) -> bool:
    return value.startswith("pbkdf2:") or value.startswith("scrypt:")


def hash_password_for_storage(password: str) -> str:
    return generate_password_hash(password)


def verify_password(stored_value: str, password: str) -> bool:
    if is_secure_password_hash(stored_value):
        try:
            return check_password_hash(stored_value, password)
        except ValueError:
            return False
    return stored_value == legacy_hash_password(password)


def atomic_write_json(path: str, payload) -> None:
    directory = os.path.dirname(path)
    fd, tmp_path = tempfile.mkstemp(prefix="tmp-", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=True, indent=2)
        os.replace(tmp_path, path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def read_json_file(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return default


def normalize_user(raw: dict) -> dict:
    email = validate_email(str(raw.get("email", "")))
    department = str(raw.get("department", "")).strip().upper()
    branch = str(raw.get("branch", "")).strip().upper()
    role = str(raw.get("role", role_from_department(department))).strip() or role_from_department(department)
    return {
        "id": str(raw.get("id", "")).strip(),
        "fullname": str(raw.get("fullname", "")).strip(),
        "phone": str(raw.get("phone", "")).strip(),
        "email": email,
        "role": role,
        "position": str(raw.get("position", "")).strip() or "Staff",
        "department": department,
        "branch": branch,
        "imageFile": raw.get("imageFile"),
        "managedBranches": normalize_scope_list(
            raw.get("managedBranches"),
            empty_default=["ALL"] if role in {"SuperAdmin", "HRAdmin"} else [],
        ),
        "managedDepartmentsByBranch": normalize_managed_departments_by_branch(
            raw.get("managedDepartmentsByBranch")
        ),
        "permissions": normalize_user_permissions(raw.get("permissions"), role),
        "isActive": bool(raw.get("isActive", True)),
        "isVerified": bool(raw.get("isVerified", True)),
        "lastSeen": normalize_last_seen_ms(raw.get("lastSeen", 0)),
        "registrationTime": int(raw.get("registrationTime", 0) or 0),
        "isArchived": bool(raw.get("isArchived", False)),
    }


def load_user_store() -> list[dict]:
    raw = read_json_file(USERS_STORE_PATH, [])
    users_by_email = {}
    for default_user in INITIAL_USERS:
        normalized = normalize_user(default_user)
        users_by_email[normalized["email"]] = normalized
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                try:
                    normalized = normalize_user(item)
                    users_by_email[normalized["email"]] = normalized
                except ValueError:
                    continue
    return list(users_by_email.values())


def save_user_store(users: list[dict]) -> None:
    normalized = []
    for user in users:
        try:
            normalized.append(normalize_user(user))
        except ValueError:
            continue
    atomic_write_json(USERS_STORE_PATH, normalized)


def find_user_by_email(users: list[dict], email: str):
    return next((user for user in users if user["email"] == email), None)


def find_user_by_id(users: list[dict], user_id: str):
    return next((user for user in users if user["id"] == user_id), None)


def load_presence_store() -> dict[str, int]:
    raw = read_json_file(PRESENCE_STORE_PATH, {})
    if not isinstance(raw, dict):
        return {}
    return {
        str(user_id): int(timestamp)
        for user_id, timestamp in raw.items()
        if str(user_id) and isinstance(timestamp, (int, float, str))
    }


def normalize_last_seen_ms(value: object) -> int:
    try:
        last_seen = int(value or 0)
    except (TypeError, ValueError):
        return 0
    if last_seen <= 0:
        return 0
    current = now_ms()
    if last_seen > current + 60_000:
        return 0
    return last_seen


def user_has_active_session(user_id: str) -> bool:
    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        return False
    sessions = load_sessions()
    return any(str(session.get("userId", "")).strip() == normalized_user_id for session in sessions.values())


def presence_is_online(presence_timestamp: object, user_id: str | None = None) -> bool:
    value = normalize_presence_timestamp(int(presence_timestamp or 0))
    if value <= 0:
        return False
    return value >= now_seconds() - ONLINE_WINDOW_SECONDS


def set_user_last_seen(user_id: str, last_seen_ms: int | None) -> None:
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return
    user["lastSeen"] = normalize_last_seen_ms(last_seen_ms or 0)
    save_user_store(users)


def normalize_presence_timestamp(timestamp: int) -> int:
    value = int(timestamp or 0)
    if value <= 0:
        return 0
    # Older builds may have written milliseconds instead of seconds.
    if value > 10_000_000_000:
        value = value // 1000
    now = int(time.time())
    # Discard obviously broken future timestamps.
    if value > now + 60:
        return 0
    return value


def save_presence_store(store: dict[str, int]) -> None:
    atomic_write_json(PRESENCE_STORE_PATH, store)


def prune_presence(store: dict[str, int]) -> dict[str, int]:
    cutoff = int(time.time()) - PRESENCE_TTL_SECONDS
    return {
        str(user_id): normalize_presence_timestamp(timestamp)
        for user_id, timestamp in store.items()
        if str(user_id).strip()
        and normalize_presence_timestamp(timestamp) >= cutoff
    }


def serialize_user_with_presence(user: dict, presence: dict[str, int] | None = None) -> dict:
    presence_map = presence if presence is not None else prune_presence(load_presence_store())
    serialized = dict(user)
    user_id = str(serialized.get("id", "")).strip()
    last_seen = normalize_last_seen_ms(serialized.get("lastSeen", 0))
    serialized["lastSeen"] = last_seen
    serialized["isOnlineNow"] = presence_is_online(presence_map.get(user_id, 0), user_id)
    return serialized


def serialize_users_with_presence(users: list[dict]) -> list[dict]:
    presence = prune_presence(load_presence_store())
    save_presence_store(presence)
    return [serialize_user_with_presence(user, presence) for user in users]


def load_password_store() -> dict[str, str]:
    raw = read_json_file(PASSWORD_STORE_PATH, {})
    if not isinstance(raw, dict):
        return {}
    return {
        email.strip().lower(): password_hash
        for email, password_hash in raw.items()
        if isinstance(email, str) and isinstance(password_hash, str) and password_hash
    }


def save_password_store(store: dict[str, str]) -> None:
    normalized = {
        str(email).strip().lower(): str(password_hash).strip()
        for email, password_hash in store.items()
        if str(email).strip() and str(password_hash).strip()
    }
    atomic_write_json(PASSWORD_STORE_PATH, normalized)


def replace_legacy_email_domain(email: str) -> str:
    normalized = str(email or "").strip().lower()
    if normalized.endswith(LEGACY_EMAIL_DOMAIN):
        return (
            normalized[: -len(LEGACY_EMAIL_DOMAIN)] + OFFICIAL_EMAIL_DOMAIN
        )
    return normalized


def migrate_legacy_email_domain_data() -> None:
    users_raw = read_json_file(USERS_STORE_PATH, [])
    if isinstance(users_raw, list):
        users_changed = False
        for item in users_raw:
            if not isinstance(item, dict):
                continue
            current_email = str(item.get("email", "")).strip()
            migrated_email = replace_legacy_email_domain(current_email)
            if current_email.strip().lower() != migrated_email:
                item["email"] = migrated_email
                users_changed = True
        if users_changed:
            atomic_write_json(USERS_STORE_PATH, users_raw)

    passwords_raw = read_json_file(PASSWORD_STORE_PATH, {})
    if isinstance(passwords_raw, dict):
        migrated_passwords = {}
        passwords_changed = False
        for email, password_hash in passwords_raw.items():
            if not isinstance(email, str) or not isinstance(password_hash, str):
                continue
            migrated_email = replace_legacy_email_domain(email)
            if email.strip().lower() != migrated_email:
                passwords_changed = True
            migrated_passwords[migrated_email] = password_hash
        if passwords_changed:
            atomic_write_json(PASSWORD_STORE_PATH, migrated_passwords)

    pending_raw = read_json_file(PENDING_VERIFICATIONS_PATH, {})
    if isinstance(pending_raw, dict):
        migrated_pending = {}
        pending_changed = False
        for email, item in pending_raw.items():
            if not isinstance(email, str) or not isinstance(item, dict):
                continue
            migrated_email = replace_legacy_email_domain(email)
            user = item.get("user")
            if isinstance(user, dict):
                user_email = str(user.get("email", "")).strip()
                migrated_user_email = replace_legacy_email_domain(user_email)
                if user_email.strip().lower() != migrated_user_email:
                    user["email"] = migrated_user_email
                    pending_changed = True
            if email.strip().lower() != migrated_email:
                pending_changed = True
            migrated_pending[migrated_email] = item
        if pending_changed:
            atomic_write_json(PENDING_VERIFICATIONS_PATH, migrated_pending)

    reset_tokens_raw = read_json_file(RESET_TOKENS_PATH, {})
    if isinstance(reset_tokens_raw, dict):
        reset_changed = False
        for item in reset_tokens_raw.values():
            if not isinstance(item, dict):
                continue
            current_email = str(item.get("email", "")).strip()
            migrated_email = replace_legacy_email_domain(current_email)
            if current_email.strip().lower() != migrated_email:
                item["email"] = migrated_email
                reset_changed = True
        if reset_changed:
            atomic_write_json(RESET_TOKENS_PATH, reset_tokens_raw)


migrate_legacy_email_domain_data()
seed_password_store_if_needed()
reconcile_initial_user_passwords()


def load_pending_verifications() -> dict[str, dict]:
    raw = read_json_file(PENDING_VERIFICATIONS_PATH, {})
    if not isinstance(raw, dict):
        return {}
    pending = {}
    current = int(time.time())
    for email, item in raw.items():
        if not isinstance(item, dict):
            continue
        try:
            normalized_email = validate_email(email)
        except ValueError:
            continue
        expires_at = int(item.get("expiresAt", 0) or 0)
        if expires_at <= current:
            continue
        user = item.get("user")
        password_hash = str(item.get("passwordHash", "")).strip()
        code = "".join(ch for ch in str(item.get("code", "")) if ch.isdigit())
        if not isinstance(user, dict) or len(code) != 6 or not password_hash:
            continue
        try:
            pending[normalized_email] = {
                "user": normalize_user(user),
                "passwordHash": password_hash,
                "code": code,
                "expiresAt": expires_at,
            }
        except ValueError:
            continue
    return pending


def save_pending_verifications(store: dict[str, dict]) -> None:
    atomic_write_json(PENDING_VERIFICATIONS_PATH, store)


def load_reset_tokens() -> dict[str, dict]:
    raw = read_json_file(RESET_TOKENS_PATH, {})
    if not isinstance(raw, dict):
        return {}
    current = int(time.time())
    tokens = {}
    for token, item in raw.items():
        if not isinstance(token, str) or not isinstance(item, dict):
            continue
        expires_at = int(item.get("expiresAt", 0) or 0)
        if expires_at <= current:
            continue
        try:
            email = validate_email(str(item.get("email", "")))
        except ValueError:
            continue
        tokens[token] = {
            "email": email,
            "expiresAt": expires_at,
        }
    return tokens


def save_reset_tokens(store: dict[str, dict]) -> None:
    atomic_write_json(RESET_TOKENS_PATH, store)


def load_json_list_store(path: str) -> list[dict]:
    raw = read_json_file(path, [])
    return raw if isinstance(raw, list) else []


def save_json_list_store(path: str, items: list[dict]) -> None:
    atomic_write_json(path, items)


def next_content_id(items: list[dict], floor: int = 1000) -> int:
    current = floor - 1
    for item in items:
        try:
            current = max(current, int(item.get("id", 0) or 0))
        except Exception:
            continue
    return current + 1


def request_ip_address() -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or "unknown"
    return str(request.remote_addr or "unknown")


def load_audit_logs_store() -> list[dict]:
    items = load_json_list_store(AUDIT_LOGS_STORE_PATH)
    normalized = []
    for item in items:
        try:
            normalized.append(
                {
                    "id": int(item.get("id", 0) or 0),
                    "actorId": str(item.get("actorId", "") or "system"),
                    "actorName": str(item.get("actorName", "") or "System"),
                    "action": str(item.get("action", "")).strip(),
                    "target": str(item.get("target", "")).strip(),
                    "ipAddress": str(item.get("ipAddress", "") or "unknown"),
                    "timestamp": int(item.get("timestamp", 0) or 0),
                }
            )
        except Exception:
            continue
    return [
        item
        for item in normalized
        if item["id"] > 0 and item["action"] and item["target"] and item["timestamp"] > 0
    ]


def save_audit_logs_store(items: list[dict]) -> None:
    save_json_list_store(AUDIT_LOGS_STORE_PATH, items[:1000])


def record_audit_log(
    actor: dict | None,
    action: str,
    target: object,
    ip_address: str | None = None,
) -> dict:
    logs = load_audit_logs_store()
    target_text = (
        target
        if isinstance(target, str)
        else json.dumps(target, ensure_ascii=True, sort_keys=True)
    )
    entry = {
        "id": next_content_id(logs, floor=1),
        "actorId": str(actor.get("id", "system") if actor else "system"),
        "actorName": str(actor.get("fullname", "System") if actor else "System"),
        "action": str(action or "").strip().upper(),
        "target": str(target_text or "").strip(),
        "ipAddress": ip_address or request_ip_address(),
        "timestamp": now_ms(),
    }
    logs.insert(0, entry)
    save_audit_logs_store(logs)
    return entry


def record_content_audit(actor: dict, action: str, module: str, item: dict | None) -> None:
    if not item:
        return
    record_audit_log(
        actor,
        action,
        {
            "module": module,
            "id": int(item.get("id", 0) or 0),
            "title": str(item.get("title", "")).strip(),
            "branchScope": item_branch_scope(item),
            "departmentScope": item_department_scope(item),
        },
    )


def staff_audit_target(user: dict, extra: dict | None = None) -> dict:
    target = {
        "staffId": str(user.get("id", "")),
        "staffName": str(user.get("fullname", "")),
        "email": str(user.get("email", "")),
        "role": str(user.get("role", "")),
        "department": str(user.get("department", "")),
        "branch": str(user.get("branch", "")),
    }
    if extra:
        target.update(extra)
    return target


def load_training_video_progress_store() -> list[dict]:
    items = load_json_list_store(TRAINING_VIDEO_PROGRESS_STORE_PATH)
    normalized = []
    for item in items:
        try:
            normalized.append(
                {
                    "userId": str(item.get("userId", "")).strip(),
                    "videoId": int(item.get("videoId", 0) or 0),
                    "progressPercent": max(0, min(100, int(item.get("progressPercent", 0) or 0))),
                    "isComplete": bool(item.get("isComplete", False)),
                    "lastWatched": int(item.get("lastWatched", 0) or 0),
                }
            )
        except Exception:
            continue
    return [item for item in normalized if item["userId"] and item["videoId"] > 0]


def save_training_video_progress_store(items: list[dict]) -> None:
    atomic_write_json(TRAINING_VIDEO_PROGRESS_STORE_PATH, items)


def load_training_document_opens_store() -> list[dict]:
    items = load_json_list_store(TRAINING_DOCUMENT_OPENS_STORE_PATH)
    normalized = []
    for item in items:
        try:
            normalized.append(
                {
                    "userId": str(item.get("userId", "")).strip(),
                    "documentId": int(item.get("documentId", 0) or 0),
                    "openedAt": int(item.get("openedAt", 0) or 0),
                }
            )
        except Exception:
            continue
    return [item for item in normalized if item["userId"] and item["documentId"] > 0]


def save_training_document_opens_store(items: list[dict]) -> None:
    atomic_write_json(TRAINING_DOCUMENT_OPENS_STORE_PATH, items)


def load_training_reminders_store() -> list[dict]:
    items = load_json_list_store(TRAINING_REMINDERS_STORE_PATH)
    normalized = []
    for item in items:
        try:
            normalized.append(
                {
                    "kind": str(item.get("kind", "")).strip(),
                    "itemId": int(item.get("itemId", 0) or 0),
                    "userId": str(item.get("userId", "")).strip(),
                    "sentAt": int(item.get("sentAt", 0) or 0),
                }
            )
        except Exception:
            continue
    return [
        item
        for item in normalized
        if item["kind"] and item["itemId"] > 0 and item["userId"] and item["sentAt"] > 0
    ]


def save_training_reminders_store(items: list[dict]) -> None:
    atomic_write_json(TRAINING_REMINDERS_STORE_PATH, items)


def load_sessions() -> dict[str, dict]:
    raw = read_json_file(SESSIONS_STORE_PATH, {})
    if not isinstance(raw, dict):
        return {}
    current = now_seconds()
    sessions = {}
    for token, item in raw.items():
        if not isinstance(token, str) or not isinstance(item, dict):
            continue
        user_id = str(item.get("userId", "")).strip()
        expires_at = int(item.get("expiresAt", 0) or 0)
        if not user_id or expires_at <= current:
            continue
        sessions[token] = {
            "userId": user_id,
            "expiresAt": expires_at,
        }
    return sessions


def save_sessions(store: dict[str, dict]) -> None:
    atomic_write_json(SESSIONS_STORE_PATH, store)


def issue_session(user_id: str) -> str:
    sessions = load_sessions()
    token = secrets.token_urlsafe(32)
    sessions[token] = {
        "userId": user_id,
        "expiresAt": now_seconds() + SESSION_TTL_SECONDS,
    }
    save_sessions(sessions)
    return token


def revoke_session(token: str) -> None:
    sessions = load_sessions()
    if token in sessions:
        sessions.pop(token, None)
        save_sessions(sessions)


def revoke_user_sessions(user_id: str) -> None:
    sessions = load_sessions()
    filtered = {
        token: session
        for token, session in sessions.items()
        if session.get("userId") != user_id
    }
    if filtered != sessions:
        save_sessions(filtered)

def require_authenticated_user():
    token = parse_session_token()
    if not token:
        return None, None, (jsonify({"error": "Authentication required"}), 401)
    sessions = load_sessions()
    session = sessions.get(token)
    if not session:
        return None, None, (jsonify({"error": "Invalid or expired session"}), 401)
    users = load_user_store()
    user = find_user_by_id(users, session["userId"])
    if not user or user["isArchived"] or not user["isActive"] or not user["isVerified"]:
        revoke_session(token)
        return None, None, (jsonify({"error": "Invalid or expired session"}), 401)
    return token, user, None


def require_staff_manager():
    token, user, error = require_authenticated_user()
    if error:
        return token, user, error
    if user["role"] not in {"SuperAdmin", "HRAdmin"}:
        return token, user, (jsonify({"error": "Admin access required"}), 403)
    return token, user, None


def require_module_manager(permission_key: str):
    token, user, error = require_authenticated_user()
    if error:
        return token, user, error
    if not user_has_permission(user, permission_key):
        return token, user, (jsonify({"error": "Admin access required"}), 403)
    return token, user, None


def generate_verification_code() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


def build_reset_url(base_url: str, token: str) -> str:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("A valid reset page URL is required")
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["token"] = token
    return urlunparse(parsed._replace(query=urlencode(query)))


def mail_config() -> dict[str, str | int]:
    required = {
        "MAIL_SERVER": os.getenv("MAIL_SERVER", ""),
        "MAIL_USERNAME": os.getenv("MAIL_USERNAME", ""),
        "MAIL_PASSWORD": os.getenv("MAIL_PASSWORD", ""),
        "MAIL_DEFAULT_SENDER": os.getenv("MAIL_DEFAULT_SENDER", ""),
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"Missing mail configuration: {', '.join(missing)}")
    return {
        **required,
        "MAIL_PORT": int(os.getenv("MAIL_PORT", "465")),
    }


def send_mail(to_email: str, subject: str, text_body: str, html_body: str):
    cfg = mail_config()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = str(cfg["MAIL_DEFAULT_SENDER"])
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP_SSL(str(cfg["MAIL_SERVER"]), int(cfg["MAIL_PORT"]), timeout=30) as smtp:
        smtp.login(str(cfg["MAIL_USERNAME"]), str(cfg["MAIL_PASSWORD"]))
        smtp.send_message(msg)


def send_verification_code_email(email: str, code: str) -> None:
    text_body = (
        "Dear Staff,\n\n"
        f"Your Bawjiase Staff Portal verification code is: {code}\n\n"
        "This code expires in 15 minutes.\n\n"
        "Thank you.\nBawjiase Community Bank PLC"
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #15803d; text-align: center;">Email Verification</h2>
          <p>Dear Staff,</p>
          <p>Use this code to verify your email address for the <strong>Bawjiase Staff Portal</strong>:</p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; border: 2px solid #15803d; color: #15803d; padding: 14px 28px; font-size: 24px; font-weight: 700; border-radius: 8px; letter-spacing: 5px;">{code}</span>
          </div>
          <p>This code expires in 15 minutes.</p>
          <p>If you did not request this code, please ignore this email.</p>
          <p style="font-weight: 700; color: #4b5563;">Bawjiase Community Bank PLC</p>
        </div>
      </body>
    </html>
    """
    send_mail(email, "Bawjiase Staff Portal - Email Verification Code", text_body, html_body)


def send_password_reset_link_email(email: str, reset_url: str) -> None:
    text_body = (
        "Dear Staff,\n\n"
        "Use the link below to reset your Bawjiase Staff Portal password:\n"
        f"{reset_url}\n\n"
        "This link expires in 30 minutes.\n\n"
        "Bawjiase Community Bank PLC"
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #15803d; text-align: center;">Password Reset</h2>
          <p>Dear Staff,</p>
          <p>Use the button below to reset your Bawjiase Staff Portal password.</p>
          <p style="text-align: center; margin: 28px 0;">
            <a href="{reset_url}" style="background: #15803d; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 700;">Reset Password</a>
          </p>
          <p>This link expires in 30 minutes.</p>
          <p style="font-weight: 700; color: #4b5563;">Bawjiase Community Bank PLC</p>
        </div>
      </body>
    </html>
    """
    send_mail(email, "Bawjiase Staff Portal - Password Reset", text_body, html_body)


def portal_public_url() -> str:
    return os.getenv("PORTAL_PUBLIC_URL", "").strip().rstrip("/")


def build_portal_link(path: str) -> str | None:
    base = portal_public_url()
    if not base:
        return None
    return f"{base}{path if path.startswith('/') else f'/{path}'}"


def eligible_users_for_visibility(visibility: str, department: str | None = None) -> list[dict]:
    normalized_visibility = str(visibility or "General").strip()
    normalized_department = str(department or "").strip().upper()
    users = load_user_store()
    eligible = [
        user
        for user in users
        if user["isActive"] and user["isVerified"] and not user["isArchived"]
    ]
    if normalized_visibility == "Department" and normalized_department:
        return [
            user
            for user in eligible
            if str(user.get("department", "")).strip().upper() == normalized_department
        ]
    return eligible


def item_branch_scope(item: dict) -> list[str]:
    return normalize_scope_list(item.get("branchScope"), empty_default=["ALL"])


def item_department_scope(item: dict) -> list[str]:
    derived_department = str(item.get("department", "")).strip().upper()
    empty_default = [derived_department] if derived_department and str(item.get("visibility", "General")).strip() == "Department" else ["ALL"]
    return normalize_scope_list(item.get("departmentScope"), empty_default=empty_default)


def value_in_scope(scope: list[str], current_value: str) -> bool:
    if "ALL" in scope:
        return True
    return str(current_value or "").strip().upper() in scope


def branch_allowed_for_user(user: dict, branch: str) -> bool:
    if is_global_manager(user):
        return True
    managed_branches = normalize_scope_list(user.get("managedBranches"), empty_default=[])
    return value_in_scope(managed_branches, branch)


def department_allowed_for_user(user: dict, branch: str, department: str) -> bool:
    if is_global_manager(user):
        return True
    managed = normalize_managed_departments_by_branch(user.get("managedDepartmentsByBranch"))
    branch_departments = managed.get(str(branch or "").strip().upper())
    if not branch_departments:
        return False
    return value_in_scope(branch_departments, department)


def can_manage_scope(user: dict, branch_scope: list[str], department_scope: list[str]) -> bool:
    if is_global_manager(user):
        return True
    if "ALL" in branch_scope:
        return False
    normalized_departments = department_scope if department_scope else ["ALL"]
    managed_departments = normalize_managed_departments_by_branch(
        user.get("managedDepartmentsByBranch")
    )
    for branch in [item for item in branch_scope if item != "ALL"]:
        if not branch_allowed_for_user(user, branch):
            return False
        branch_managed_departments = managed_departments.get(branch, [])
        for department in normalized_departments:
            if department == "ALL":
                if "ALL" not in branch_managed_departments:
                    return False
            elif not department_allowed_for_user(user, branch, department):
                return False
    return True


def manageable_scope_message(user: dict) -> str:
    if is_global_manager(user):
        return "You can manage all branches and departments."
    managed_branches = normalize_scope_list(user.get("managedBranches"), empty_default=[])
    managed_departments = normalize_managed_departments_by_branch(
        user.get("managedDepartmentsByBranch")
    )
    if not managed_branches:
        return "No supervisor branch scope is assigned to your account."
    parts = []
    for branch in managed_branches:
        departments = managed_departments.get(branch, [])
        label = "all departments" if "ALL" in departments else ", ".join(departments)
        parts.append(f"{branch} > {label or 'no departments'}")
    return f"You can only manage: {'; '.join(parts)}."


def ensure_content_management_access(
    user: dict,
    *,
    permission_key: str,
    branch_scope: list[str],
    department_scope: list[str],
) -> tuple[bool, tuple]:
    if not user_has_permission(user, permission_key):
        return False, (jsonify({"error": "You do not have permission to manage this module"}), 403)
    if not can_manage_scope(user, branch_scope, department_scope):
        return False, (
            jsonify({"error": manageable_scope_message(user)}),
            403,
        )
    return True, ()


def scoped_access_denial(user: dict):
    return jsonify({"error": manageable_scope_message(user)}), 403


def eligible_users_for_item(item: dict) -> list[dict]:
    users = load_user_store()
    eligible = [
        user
        for user in users
        if user["isActive"] and user["isVerified"] and not user["isArchived"]
    ]
    branch_scope = item_branch_scope(item)
    department_scope = item_department_scope(item)
    return [
        user
        for user in eligible
        if value_in_scope(branch_scope, str(user.get("branch", "")))
        and value_in_scope(department_scope, str(user.get("department", "")))
    ]


def user_can_access_item(user: dict, item: dict) -> bool:
    if bool(item.get("isArchived", False)):
        return False
    return value_in_scope(item_branch_scope(item), str(user.get("branch", ""))) and value_in_scope(
        item_department_scope(item), str(user.get("department", ""))
    )


def filter_items_for_user(items: list[dict], user: dict) -> list[dict]:
    return [item for item in items if user_can_access_item(user, item)]


def user_can_manage_item(user: dict, item: dict, permission_key: str) -> bool:
    if is_global_manager(user):
        return True
    if not user_has_permission(user, permission_key):
        return False
    return can_manage_scope(user, item_branch_scope(item), item_department_scope(item))


def create_notifications_for_users(
    users: list[dict],
    *,
    kind: str,
    title: str,
    message: str,
    link_to: str | None,
) -> int:
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    created_at = now_ms()
    count = 0
    for user in users:
        items.insert(
            0,
            {
                "id": next_content_id(items, floor=1),
                "userId": user["id"],
                "kind": kind,
                "title": title,
                "message": message,
                "linkTo": link_to,
                "isRead": False,
                "createdAt": created_at,
            },
        )
        count += 1
    save_json_list_store(NOTIFICATIONS_STORE_PATH, items)
    return count


def send_content_notification_email(
    *,
    to_email: str,
    subject: str,
    headline: str,
    intro: str,
    item_title: str,
    link_to: str | None,
) -> None:
    action_line = f"Open the portal here: {link_to}" if link_to else "Open the staff portal to view the new item."
    text_body = (
        "Dear Staff,\n\n"
        f"{intro}\n\n"
        f"Item: {item_title}\n"
        f"{action_line}\n\n"
        "Bawjiase Community Bank PLC"
    )
    action_html = (
        f'<p style="text-align: center; margin: 28px 0;">'
        f'<a href="{link_to}" style="background: #15803d; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 700;">Open Portal</a>'
        f"</p>"
        if link_to
        else "<p>Open the staff portal to view the new item.</p>"
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #15803d; text-align: center;">{headline}</h2>
          <p>Dear Staff,</p>
          <p>{intro}</p>
          <div style="margin: 18px 0; padding: 16px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0;">
            <strong>{item_title}</strong>
          </div>
          {action_html}
          <p style="font-weight: 700; color: #4b5563;">Bawjiase Community Bank PLC</p>
        </div>
      </body>
    </html>
    """
    send_mail(to_email, subject, text_body, html_body)


def fanout_content_notification(
    *,
    kind: str,
    title: str,
    message: str,
    email_subject: str,
    email_headline: str,
    email_intro: str,
    item_title: str,
    visibility: str,
    department: str | None,
    link_to: str | None,
    branch_scope: list[str] | None = None,
    department_scope: list[str] | None = None,
    send_external_emails: bool = False,
) -> dict[str, int]:
    users = eligible_users_for_item(
        {
            "visibility": visibility,
            "department": department,
            "branchScope": branch_scope or ["ALL"],
            "departmentScope": department_scope or ([department] if department else ["ALL"]),
        }
    )
    notification_count = create_notifications_for_users(
        users,
        kind=kind,
        title=title,
        message=message,
        link_to=link_to,
    )
    email_count = 0
    email_attempted = 0
    if send_external_emails:
        for user in users:
            email = str(user.get("email", "")).strip().lower()
            if not email:
                continue
            email_attempted += 1
            try:
                send_content_notification_email(
                    to_email=email,
                    subject=email_subject,
                    headline=email_headline,
                    intro=email_intro,
                    item_title=item_title,
                    link_to=build_portal_link(link_to) if link_to else None,
                )
                email_count += 1
            except Exception:
                app.logger.exception("Failed sending content notification email", extra={"email": email})
    return {
        "notifications": notification_count,
        "emails": email_count,
        "emailsAttempted": email_attempted,
        "emailsFailed": max(0, email_attempted - email_count),
    }


def serialize_video_progress(item: dict) -> dict:
    return {
        "videoId": int(item.get("videoId", 0) or 0),
        "progressPercent": int(item.get("progressPercent", 0) or 0),
        "isComplete": bool(item.get("isComplete", False)),
        "lastWatched": int(item.get("lastWatched", 0) or 0),
    }


def serialize_document_open_state(item: dict | None) -> dict:
    opened_at = int(item.get("openedAt", 0) or 0) if item else 0
    return {
        "isOpened": opened_at > 0,
        "openedAt": opened_at or None,
    }


def get_video_watched_user_ids(video_id: int) -> set[str]:
    return {
        item["userId"]
        for item in load_training_video_progress_store()
        if int(item.get("videoId", 0) or 0) == video_id and int(item.get("progressPercent", 0) or 0) > 0
    }


def get_video_completed_user_ids(video_id: int) -> set[str]:
    return {
        item["userId"]
        for item in load_training_video_progress_store()
        if int(item.get("videoId", 0) or 0) == video_id and bool(item.get("isComplete", False))
    }


def get_document_opened_user_ids(document_id: int) -> set[str]:
    return {
        item["userId"]
        for item in load_training_document_opens_store()
        if int(item.get("documentId", 0) or 0) == document_id and int(item.get("openedAt", 0) or 0) > 0
    }


def refresh_training_video_counts(items: list[dict]) -> list[dict]:
    watched_by_video: dict[int, set[str]] = {}
    for entry in load_training_video_progress_store():
        if int(entry.get("progressPercent", 0) or 0) <= 0:
            continue
        video_id = int(entry.get("videoId", 0) or 0)
        watched_by_video.setdefault(video_id, set()).add(entry["userId"])
    changed = False
    for item in items:
        video_id = int(item.get("id", 0) or 0)
        count = len(watched_by_video.get(video_id, set()))
        if int(item.get("viewCount", 0) or 0) != count:
            item["viewCount"] = count
            changed = True
    if changed:
        save_json_list_store(TRAINING_VIDEOS_STORE_PATH, items)
    return items


def refresh_training_document_counts(items: list[dict]) -> list[dict]:
    opened_by_document: dict[int, set[str]] = {}
    for entry in load_training_document_opens_store():
        if int(entry.get("openedAt", 0) or 0) <= 0:
            continue
        document_id = int(entry.get("documentId", 0) or 0)
        opened_by_document.setdefault(document_id, set()).add(entry["userId"])
    changed = False
    for item in items:
        document_id = int(item.get("id", 0) or 0)
        count = len(opened_by_document.get(document_id, set()))
        if int(item.get("downloadCount", 0) or 0) != count:
            item["downloadCount"] = count
            changed = True
    if changed:
        save_json_list_store(TRAINING_DOCUMENTS_STORE_PATH, items)
    return items


def get_training_video_by_id(item_id: int) -> dict | None:
    items = refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    return next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)


def get_training_document_by_id(item_id: int) -> dict | None:
    items = refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    return next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)


def reminder_link_for_kind(kind: str, item_id: int) -> str:
    if kind == "video":
        return f"/training/video/{item_id}"
    return f"/training/document/{item_id}"


def find_video_by_local_filename(filename: str) -> dict | None:
    items = load_json_list_store(TRAINING_VIDEOS_STORE_PATH)
    return next(
        (
            item
            for item in items
            if str(item.get("storageType", "")).strip() == "Local"
            and str(item.get("localFilename", "")).strip() == filename
        ),
        None,
    )


def find_document_by_local_filename(filename: str) -> dict | None:
    items = load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)
    return next(
        (
            item
            for item in items
            if str(item.get("storageType", "")).strip() == "Local"
            and str(item.get("localFilename", "")).strip() == filename
        ),
        None,
    )


def is_local_upload_ref(value: object, filename: str) -> bool:
    return str(value or "").strip() == f"LOCAL:{filename}"


def find_announcement_by_local_filename(filename: str) -> dict | None:
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    return next(
        (
            item
            for item in items
            if is_local_upload_ref(item.get("imageUrl"), filename)
            or is_local_upload_ref(item.get("fileUrl"), filename)
        ),
        None,
    )


def find_user_by_local_image(filename: str) -> dict | None:
    users = load_user_store()
    return next(
        (
            user
            for user in users
            if is_local_upload_ref(user.get("imageFile"), filename)
        ),
        None,
    )


def local_filename_from_ref(value: object) -> str:
    raw = str(value or "").strip()
    if not raw.startswith("LOCAL:"):
        return ""
    return raw.replace("LOCAL:", "", 1).strip()


def cleanup_local_announcement_assets(item: dict) -> None:
    for key in ("imageUrl", "fileUrl"):
        filename = local_filename_from_ref(item.get(key))
        if filename:
            remove_uploaded_file_if_unused(filename)


def remove_uploaded_file_if_unused(filename: str) -> None:
    if not filename:
        return
    video_match = find_video_by_local_filename(filename)
    document_match = find_document_by_local_filename(filename)
    announcement_match = find_announcement_by_local_filename(filename)
    profile_match = find_user_by_local_image(filename)
    if video_match or document_match or announcement_match or profile_match:
        return
    file_path = os.path.join(UPLOADS_DIR, filename)
    if os.path.isfile(file_path):
        os.remove(file_path)


def send_training_reminders(kind: str, item_id: int) -> dict[str, int]:
    kind_key = "video" if kind == "video" else "document"
    item = get_training_video_by_id(item_id) if kind_key == "video" else get_training_document_by_id(item_id)
    if not item or item.get("isArchived"):
        raise ValueError("Training item not found")
    eligible = eligible_users_for_item(item)
    completed_or_opened = (
        get_video_completed_user_ids(item_id)
        if kind_key == "video"
        else get_document_opened_user_ids(item_id)
    )
    target_users = [user for user in eligible if user["id"] not in completed_or_opened]
    if not target_users:
        return {"notifications": 0, "emails": 0}

    reminders = load_training_reminders_store()
    cutoff = now_seconds() - TRAINING_REMINDER_COOLDOWN_SECONDS
    reminders = [entry for entry in reminders if int(entry.get("sentAt", 0) or 0) >= cutoff]
    recent_pairs = {
        (entry["kind"], int(entry["itemId"]), entry["userId"])
        for entry in reminders
    }
    pending_users = [
        user
        for user in target_users
        if (kind_key, item_id, user["id"]) not in recent_pairs
    ]
    if not pending_users:
        save_training_reminders_store(reminders)
        return {"notifications": 0, "emails": 0}

    title = "Mandatory Training Reminder"
    item_name = str(item.get("title", "")).strip()
    message = (
        f'Please complete "{item_name}" in the training portal.'
        if kind_key == "video"
        else f'Please open and review "{item_name}" in the training portal.'
    )
    link_to = reminder_link_for_kind(kind_key, item_id)
    notification_count = create_notifications_for_users(
        pending_users,
        kind="training",
        title=title,
        message=message,
        link_to=link_to,
    )
    email_count = 0
    for user in pending_users:
        email = str(user.get("email", "")).strip().lower()
        if not email:
            continue
        try:
            send_content_notification_email(
                to_email=email,
                subject="Bawjiase Staff Portal - Mandatory Training Reminder",
                headline=title,
                intro=message,
                item_title=item_name,
                link_to=build_portal_link(link_to),
            )
            email_count += 1
        except Exception:
            app.logger.exception("Failed sending training reminder email", extra={"email": email})
        reminders.append(
            {
                "kind": kind_key,
                "itemId": item_id,
                "userId": user["id"],
                "sentAt": now_seconds(),
            }
        )
    save_training_reminders_store(reminders)
    return {"notifications": notification_count, "emails": email_count}


def handle_options():
    if request.method == "OPTIONS":
        return ("", 204)
    return None


def upload_public_url(filename: str) -> str:
    return f"/uploads/{filename}"


def save_uploaded_media(file_storage, kind: str) -> dict:
    if not file_storage or not getattr(file_storage, "filename", ""):
        raise ValueError("A file is required")
    original_name = secure_filename(str(file_storage.filename))
    if not original_name:
        raise ValueError("Invalid file name")
    ext = os.path.splitext(original_name)[1].lower()
    if kind == "video":
        allowed = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    elif kind == "profile":
        allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    elif kind == "announcement":
        allowed = {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".gif",
            ".pdf",
            ".doc",
            ".docx",
            ".xls",
            ".xlsx",
            ".ppt",
            ".pptx",
        }
    else:
        allowed = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"}
    if ext not in allowed:
        raise ValueError("Unsupported file type")
    filename = f"{kind}-{secrets.token_hex(8)}{ext}"
    target_path = os.path.join(UPLOADS_DIR, filename)
    file_storage.save(target_path)
    return {
        "filename": filename,
        "url": upload_public_url(filename),
        "contentType": str(getattr(file_storage, "mimetype", "") or "application/octet-stream"),
    }


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


@app.route("/uploads/<path:filename>", methods=["GET"])
def get_uploaded_media(filename: str):
    safe_name = secure_filename(filename)
    if not safe_name or safe_name != filename:
        return jsonify({"error": "Invalid file name"}), 400
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    training_item = find_video_by_local_filename(safe_name) or find_document_by_local_filename(safe_name)
    if training_item:
        if not user_can_access_item(auth_user, training_item):
            return jsonify({"error": "Access denied"}), 403
        return send_from_directory(UPLOADS_DIR, safe_name, conditional=True)
    if find_announcement_by_local_filename(safe_name):
        return send_from_directory(UPLOADS_DIR, safe_name, conditional=True)
    if find_user_by_local_image(safe_name):
        return send_from_directory(UPLOADS_DIR, safe_name, conditional=True)
    return jsonify({"error": "File not found"}), 404


@app.route("/mail-api/uploads/<path:filename>", methods=["GET"])
def get_uploaded_media_legacy(filename: str):
    return get_uploaded_media(filename)


@app.route("/mail-api/api/<path:path>", methods=["GET", "POST", "OPTIONS"])
def legacy_mail_api(path: str):
    destination = f"/api/{path}"
    query = request.query_string.decode("utf-8", errors="ignore").strip()
    if query:
        destination = f"{destination}?{query}"
    return redirect(destination, code=307)


@app.route("/api/presence", methods=["GET"])
def get_presence():
    _, _, error = require_authenticated_user()
    if error:
        return error
    store = prune_presence(load_presence_store())
    save_presence_store(store)
    return jsonify({"presence": store})


@app.route("/api/presence/ping", methods=["POST", "OPTIONS"])
def ping_presence():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    user_id = str(data.get("userId", "")).strip()
    if not user_id:
        return jsonify({"error": "userId is required"}), 400
    if auth_user["id"] != user_id:
        return jsonify({"error": "Cannot update another user's presence"}), 403
    current_ms = now_ms()
    set_user_last_seen(user_id, current_ms)
    store = prune_presence(load_presence_store())
    store[user_id] = int(time.time())
    save_presence_store(store)
    return jsonify({"ok": True, "lastSeen": current_ms})


@app.route("/api/presence/logout", methods=["POST", "OPTIONS"])
def logout_presence():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    user_id = str(data.get("userId", "")).strip()
    if not user_id:
        return jsonify({"error": "userId is required"}), 400
    if auth_user["id"] != user_id:
        return jsonify({"error": "Cannot update another user's presence"}), 403
    set_user_last_seen(user_id, now_ms())
    store = prune_presence(load_presence_store())
    store.pop(user_id, None)
    save_presence_store(store)
    return jsonify({"ok": True})


@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    user_items = [
        item
        for item in items
        if str(item.get("userId", "")).strip() == auth_user["id"]
    ]
    user_items.sort(key=lambda item: int(item.get("createdAt", 0) or 0), reverse=True)
    return jsonify({"notifications": user_items})


@app.route("/api/notifications/unread-count", methods=["GET"])
def get_unread_notification_count():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    count = sum(
        1
        for item in items
        if str(item.get("userId", "")).strip() == auth_user["id"]
        and not bool(item.get("isRead", False))
    )
    return jsonify({"count": count})


@app.route("/api/notifications/<int:item_id>/read", methods=["POST", "OPTIONS"])
def mark_notification_read(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    notification = next(
        (
            item
            for item in items
            if int(item.get("id", 0) or 0) == item_id
            and str(item.get("userId", "")).strip() == auth_user["id"]
        ),
        None,
    )
    if not notification:
        return jsonify({"error": "Notification not found"}), 404
    notification["isRead"] = True
    save_json_list_store(NOTIFICATIONS_STORE_PATH, items)
    return jsonify({"ok": True})


@app.route("/api/notifications/read-all", methods=["POST", "OPTIONS"])
def mark_all_notifications_read():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    changed = False
    for item in items:
        if str(item.get("userId", "")).strip() == auth_user["id"] and not bool(item.get("isRead", False)):
            item["isRead"] = True
            changed = True
    if changed:
        save_json_list_store(NOTIFICATIONS_STORE_PATH, items)
    return jsonify({"ok": True})


@app.route("/api/notifications/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_notification(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    filtered = [
        item
        for item in items
        if not (
            int(item.get("id", 0) or 0) == item_id
            and str(item.get("userId", "")).strip() == auth_user["id"]
        )
    ]
    if len(filtered) == len(items):
        return jsonify({"error": "Notification not found"}), 404
    save_json_list_store(NOTIFICATIONS_STORE_PATH, filtered)
    return jsonify({"ok": True})


@app.route("/api/audit-logs", methods=["GET"])
def get_audit_logs():
    _, _, error = require_staff_manager()
    if error:
        return error
    logs = sorted(load_audit_logs_store(), key=lambda item: int(item["timestamp"]), reverse=True)
    return jsonify({"logs": logs})


@app.route("/api/audit-logs", methods=["POST", "OPTIONS"])
def create_audit_log():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    action = str(data.get("action", "")).strip().upper()
    target = str(data.get("target", "")).strip()
    if not action or not target:
        return jsonify({"error": "Action and target are required"}), 400
    entry = record_audit_log(
        auth_user,
        action,
        target,
        str(data.get("ipAddress", "") or request_ip_address()),
    )
    return jsonify({"ok": True, "log": entry})


@app.route("/api/audit-logs/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_audit_log(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_staff_manager()
    if error:
        return error
    logs = load_audit_logs_store()
    filtered = [item for item in logs if int(item.get("id", 0) or 0) != item_id]
    if len(filtered) == len(logs):
        return jsonify({"error": "Log entry not found"}), 404
    save_audit_logs_store(filtered)
    return jsonify({"ok": True})


@app.route("/api/audit-logs/delete", methods=["POST", "OPTIONS"])
def delete_audit_logs():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_staff_manager()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    ids = {
        int(item)
        for item in data.get("ids", [])
        if isinstance(item, (int, float, str)) and str(item).strip().isdigit()
    }
    if not ids:
        return jsonify({"ok": True})
    logs = load_audit_logs_store()
    save_audit_logs_store(
        [item for item in logs if int(item.get("id", 0) or 0) not in ids]
    )
    return jsonify({"ok": True})


@app.route("/api/backup/export", methods=["GET"])
def export_production_backup():
    _, auth_user, error = require_staff_manager()
    if error:
        return error
    backup = {
        "metadata": {
            "app": "bawjiase-staff-portal",
            "generatedAt": now_ms(),
            "generatedBy": {
                "id": auth_user["id"],
                "fullname": auth_user["fullname"],
                "email": auth_user["email"],
                "role": auth_user["role"],
            },
            "dataDir": DATA_DIR,
            "schemaVersion": 1,
        },
        "stores": {
            "users": load_user_store(),
            "sessions": load_sessions(),
            "presence": load_presence_store(),
            "announcements": load_json_list_store(ANNOUNCEMENTS_STORE_PATH),
            "forms": load_json_list_store(FORMS_STORE_PATH),
            "trainingVideos": load_json_list_store(TRAINING_VIDEOS_STORE_PATH),
            "trainingDocuments": load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH),
            "notifications": load_json_list_store(NOTIFICATIONS_STORE_PATH),
            "trainingVideoProgress": load_training_video_progress_store(),
            "trainingDocumentOpens": load_training_document_opens_store(),
            "trainingReminders": load_training_reminders_store(),
            "auditLogs": load_audit_logs_store(),
        },
    }
    response = jsonify(backup)
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    response.headers["Content-Disposition"] = (
        f'attachment; filename="bawjiase-portal-backup-{stamp}.json"'
    )
    response.headers["X-Backup-Filename"] = f"bawjiase-portal-backup-{stamp}.json"
    record_audit_log(
        auth_user,
        "EXPORT_PRODUCTION_BACKUP",
        {
            "stores": list(backup["stores"].keys()),
            "generatedAt": backup["metadata"]["generatedAt"],
        },
    )
    return response


@app.route("/api/users", methods=["GET"])
def list_users():
    _, _, error = require_authenticated_user()
    if error:
        return error
    return jsonify({"users": serialize_users_with_presence(load_user_store())})


@app.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id: str):
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if auth_user["id"] != user_id and auth_user["role"] not in {"SuperAdmin", "HRAdmin"}:
        return jsonify({"error": "Access denied"}), 403
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    presence = prune_presence(load_presence_store())
    save_presence_store(presence)
    return jsonify({"user": serialize_user_with_presence(user, presence)})


@app.route("/api/users/<user_id>/profile", methods=["POST", "OPTIONS"])
def update_profile(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if auth_user["id"] != user_id and auth_user["role"] not in {"SuperAdmin", "HRAdmin"}:
        return jsonify({"error": "Access denied"}), 403
    data, error = require_json()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    can_manage_org_fields = auth_user["role"] in {"SuperAdmin", "HRAdmin"}
    previous_image = str(user.get("imageFile") or "").strip()
    requested_department = str(data.get("department", user["department"])).strip().upper()
    if requested_department == "IT" and user["department"] != "IT":
        if not IT_ACCESS_CODE:
            return jsonify({"error": "IT security code is not configured on the server."}), 500
        if str(data.get("accessCode", "")).strip() != IT_ACCESS_CODE:
            return jsonify({"error": "Access denied: invalid IT security code."}), 400
    if "fullname" in data:
        user["fullname"] = str(data.get("fullname", "")).strip() or user["fullname"]
    if "phone" in data:
        user["phone"] = str(data.get("phone", "")).strip() or user["phone"]
    if "position" in data:
        user["position"] = str(data.get("position", "")).strip() or user["position"]
    if "department" in data and can_manage_org_fields and requested_department:
        user["department"] = requested_department
        if user.get("role") != "Supervisor":
            user["role"] = role_from_department(requested_department)
        user["permissions"] = normalize_user_permissions(user.get("permissions"), user["role"])
        user["managedBranches"] = normalize_scope_list(
            user.get("managedBranches"),
            empty_default=["ALL"] if user["role"] in {"SuperAdmin", "HRAdmin"} else [],
        )
        if user["role"] != "Supervisor":
            user["managedDepartmentsByBranch"] = {}
    if "branch" in data and can_manage_org_fields:
        branch = str(data.get("branch", "")).strip().upper()
        if branch:
            user["branch"] = branch
    if "imageFile" in data:
        image_file = data.get("imageFile")
        user["imageFile"] = str(image_file) if image_file else None
        if previous_image.startswith("LOCAL:") and previous_image != user["imageFile"]:
            remove_uploaded_file_if_unused(previous_image.replace("LOCAL:", "", 1).strip())
    save_user_store(users)
    current_image = str(user.get("imageFile") or "").strip()
    if "imageFile" in data and current_image != previous_image:
        if previous_image and current_image:
            action = "CHANGE_PROFILE_PHOTO"
        elif current_image:
            action = "ADD_PROFILE_PHOTO"
        else:
            action = "REMOVE_PROFILE_PHOTO"
        record_audit_log(
            auth_user,
            action,
            staff_audit_target(
                user,
                {"changedBySelf": auth_user["id"] == user["id"]},
            ),
        )
    return jsonify({"ok": True, "user": user})


@app.route("/api/staff/active", methods=["GET"])
def get_active_staff():
    _, _, error = require_authenticated_user()
    if error:
        return error
    users = load_user_store()
    active_users = [
        user for user in users
        if user["isActive"] and not user["isArchived"] and user["fullname"] not in {"MASTER ADMIN", "System Admin"}
    ]
    return jsonify({"users": serialize_users_with_presence(active_users)})


@app.route("/api/staff/archived", methods=["GET"])
def get_archived_staff():
    _, _, error = require_authenticated_user()
    if error:
        return error
    users = load_user_store()
    return jsonify({"users": [user for user in users if user["isArchived"]]})


@app.route("/api/staff/stats", methods=["GET"])
def get_staff_stats():
    _, _, error = require_authenticated_user()
    if error:
        return error
    users = load_user_store()
    active = [user for user in users if user["isActive"] and not user["isArchived"]]
    by_department = {}
    by_branch = {}
    by_role = {}
    for user in active:
        by_department[user["department"]] = by_department.get(user["department"], 0) + 1
        by_branch[user["branch"]] = by_branch.get(user["branch"], 0) + 1
        by_role[user["role"]] = by_role.get(user["role"], 0) + 1
    return jsonify({
        "total": len(users),
        "active": len(active),
        "archived": len([user for user in users if user["isArchived"]]),
        "byDepartment": by_department,
        "byBranch": by_branch,
        "byRole": by_role,
    })


@app.route("/api/staff/<user_id>", methods=["GET"])
def get_staff_member(user_id: str):
    _, _, error = require_authenticated_user()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    return jsonify({"user": user})


@app.route("/api/staff/<user_id>/update", methods=["POST", "OPTIONS"])
def update_staff(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_staff_manager()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    previous_active = bool(user.get("isActive", False))
    previous_supervisor_access = {
        "role": str(user.get("role", "")),
        "managedBranches": normalize_scope_list(user.get("managedBranches"), empty_default=[]),
        "managedDepartmentsByBranch": normalize_managed_departments_by_branch(
            user.get("managedDepartmentsByBranch")
        ),
        "permissions": normalize_user_permissions(user.get("permissions"), str(user.get("role", ""))),
    }

    requested_department = str(data.get("department", user["department"])).strip().upper()
    if requested_department == "IT" and user["department"] != "IT":
        if not IT_ACCESS_CODE:
            return jsonify({"error": "IT security code is not configured on the server."}), 500
        if str(data.get("accessCode", "")).strip() != IT_ACCESS_CODE:
            return jsonify({"error": "Access denied: invalid IT security code."}), 400

    if "fullname" in data:
        user["fullname"] = str(data.get("fullname", "")).strip() or user["fullname"]
    if "phone" in data:
        user["phone"] = str(data.get("phone", "")).strip() or user["phone"]
    if "position" in data:
        user["position"] = str(data.get("position", "")).strip() or user["position"]
    if "department" in data and requested_department:
        user["department"] = requested_department
        if user.get("role") != "Supervisor":
            user["role"] = role_from_department(requested_department)
    if "branch" in data:
        branch = str(data.get("branch", "")).strip().upper()
        if branch:
            user["branch"] = branch
    if "role" in data:
        requested_role = str(data.get("role", "")).strip()
        if requested_role in {"GeneralStaff", "Supervisor", "HRAdmin", "SuperAdmin"}:
            user["role"] = requested_role
    if "managedBranches" in data:
        user["managedBranches"] = normalize_scope_list(
            data.get("managedBranches"),
            empty_default=["ALL"] if user["role"] in {"SuperAdmin", "HRAdmin"} else [],
        )
    if "managedDepartmentsByBranch" in data:
        user["managedDepartmentsByBranch"] = normalize_managed_departments_by_branch(
            data.get("managedDepartmentsByBranch")
        )
    if user["role"] != "Supervisor":
        user["managedBranches"] = normalize_scope_list(
            user.get("managedBranches"),
            empty_default=["ALL"] if user["role"] in {"SuperAdmin", "HRAdmin"} else [],
        )
        user["managedDepartmentsByBranch"] = {}
    if "permissions" in data:
        user["permissions"] = normalize_user_permissions(data.get("permissions"), user["role"])
    else:
        user["permissions"] = normalize_user_permissions(user.get("permissions"), user["role"])
    try:
        validate_supervisor_configuration(user)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if "imageFile" in data:
        previous_image = str(user.get("imageFile") or "").strip()
        image_file = data.get("imageFile")
        user["imageFile"] = str(image_file) if image_file else None
        if previous_image.startswith("LOCAL:") and previous_image != user["imageFile"]:
            remove_uploaded_file_if_unused(previous_image.replace("LOCAL:", "", 1).strip())
    if "isActive" in data:
        user["isActive"] = bool(data.get("isActive"))
    save_user_store(users)
    if "isActive" in data and bool(user.get("isActive", False)) != previous_active:
        record_audit_log(
            auth_user,
            "ACTIVATE_STAFF" if bool(user.get("isActive", False)) else "DEACTIVATE_STAFF",
            staff_audit_target(
                user,
                {
                    "before": {"isActive": previous_active},
                    "after": {"isActive": bool(user.get("isActive", False))},
                },
            ),
        )
    current_supervisor_access = {
        "role": str(user.get("role", "")),
        "managedBranches": normalize_scope_list(user.get("managedBranches"), empty_default=[]),
        "managedDepartmentsByBranch": normalize_managed_departments_by_branch(
            user.get("managedDepartmentsByBranch")
        ),
        "permissions": normalize_user_permissions(user.get("permissions"), str(user.get("role", ""))),
    }
    if current_supervisor_access != previous_supervisor_access:
        record_audit_log(
            auth_user,
            "SUPERVISOR_ACCESS_UPDATE",
            {
                "staffId": user["id"],
                "staffName": user["fullname"],
                "before": previous_supervisor_access,
                "after": current_supervisor_access,
            },
        )
    return jsonify({"ok": True, "user": user})


@app.route("/api/staff/<user_id>/archive", methods=["POST", "OPTIONS"])
def archive_staff(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_staff_manager()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    if user["role"] == "SuperAdmin":
        return jsonify({"error": "Cannot archive Super Admin."}), 400
    user["isArchived"] = True
    user["isActive"] = False
    save_user_store(users)
    revoke_user_sessions(user_id)
    record_audit_log(auth_user, "ARCHIVE_STAFF", staff_audit_target(user))
    return jsonify({"ok": True})


@app.route("/api/staff/<user_id>/restore", methods=["POST", "OPTIONS"])
def restore_staff(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_staff_manager()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    user["isArchived"] = False
    user["isActive"] = True
    save_user_store(users)
    record_audit_log(auth_user, "RESTORE_STAFF", staff_audit_target(user))
    return jsonify({"ok": True})


@app.route("/api/staff/<user_id>/delete", methods=["POST", "OPTIONS"])
def delete_staff(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_staff_manager()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    users = [item for item in users if item["id"] != user_id]
    passwords = load_password_store()
    passwords.pop(user["email"], None)
    pending = load_pending_verifications()
    pending.pop(user["email"], None)
    save_user_store(users)
    save_password_store(passwords)
    save_pending_verifications(pending)
    revoke_user_sessions(user_id)
    record_audit_log(auth_user, "DELETE_STAFF", staff_audit_target(user))
    return jsonify({"ok": True})


@app.route("/api/auth/register", methods=["POST", "OPTIONS"])
def auth_register():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        password = str(data.get("passwordHash", ""))
        department = str(data.get("department", "")).strip().upper()
        branch = str(data.get("branch", "")).strip().upper()
        if not password:
            return jsonify({"error": "Password is required"}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        if not department or not branch:
            return jsonify({"error": "Department and branch are required"}), 400
        if department == "IT" and not IT_ACCESS_CODE:
            return jsonify({"error": "IT access code is not configured on the server."}), 500
        if department == "HR" and not HR_ACCESS_CODE:
            return jsonify({"error": "HR access code is not configured on the server."}), 500
        if department == "IT" and str(data.get("accessCode", "")).strip() != IT_ACCESS_CODE:
            return jsonify({"error": "Incorrect IT access code. Registration blocked."}), 400
        if department == "HR" and str(data.get("accessCode", "")).strip() != HR_ACCESS_CODE:
            return jsonify({"error": "Incorrect HR access code. Registration blocked."}), 400

        users = load_user_store()
        existing = find_user_by_email(users, email)
        if existing and existing["isVerified"]:
            return jsonify({"error": "Email already registered"}), 400

        pending = load_pending_verifications()
        new_user = normalize_user({
            "id": existing["id"] if existing else f"user-{int(time.time() * 1000)}",
            "fullname": str(data.get("fullname", "")).strip(),
            "phone": str(data.get("phone", "")).strip(),
            "email": email,
            "role": role_from_department(department),
            "position": str(data.get("position", "Staff")).strip() or "Staff",
            "department": department,
            "branch": branch,
            "imageFile": None,
            "isActive": True,
            "isVerified": False,
            "lastSeen": now_ms(),
            "registrationTime": now_ms(),
            "isArchived": False,
        })
        code = generate_verification_code()
        pending[email] = {
            "user": new_user,
            "passwordHash": hash_password_for_storage(password),
            "code": code,
            "expiresAt": int(time.time()) + VERIFICATION_TTL_SECONDS,
        }
        save_pending_verifications(pending)
        send_verification_code_email(email, code)
        record_audit_log(None, "REGISTRATION_STARTED", staff_audit_target(new_user))
        return jsonify({"ok": True, "user": new_user})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Registration failed")
        return jsonify({"error": f"Registration failed: {exc}"}), 500


@app.route("/api/auth/verify-email", methods=["POST", "OPTIONS"])
def auth_verify_email():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        code = "".join(ch for ch in str(data.get("code", "")) if ch.isdigit())
        if len(code) != 6:
            return jsonify({"error": "A 6-digit verification code is required"}), 400

        pending = load_pending_verifications()
        entry = pending.get(email)
        if not entry:
            record_audit_log(
                None,
                "VERIFY_EMAIL_FAILED",
                {"email": email, "reason": "no_pending_verification"},
            )
            return jsonify({"error": "No pending verification for this email"}), 404
        if entry["code"] != code:
            record_audit_log(
                None,
                "VERIFY_EMAIL_FAILED",
                {"email": email, "reason": "incorrect_code"},
            )
            return jsonify({"error": "Incorrect verification code"}), 400

        user = entry["user"]
        user["isVerified"] = True

        users = load_user_store()
        existing = find_user_by_email(users, email)
        if existing:
            existing.update(user)
        else:
            users.append(user)

        passwords = load_password_store()
        passwords[email] = entry["passwordHash"]

        pending.pop(email, None)
        save_user_store(users)
        save_password_store(passwords)
        save_pending_verifications(pending)
        record_audit_log(user, "REGISTRATION_VERIFIED", staff_audit_target(user))
        return jsonify({"ok": True, "user": user})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/auth/resend-verification", methods=["POST", "OPTIONS"])
def auth_resend_verification():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        pending = load_pending_verifications()
        entry = pending.get(email)
        if not entry:
            return jsonify({"error": "Email not found"}), 404
        entry["code"] = generate_verification_code()
        entry["expiresAt"] = int(time.time()) + VERIFICATION_TTL_SECONDS
        pending[email] = entry
        save_pending_verifications(pending)
        send_verification_code_email(email, entry["code"])
        return jsonify({"ok": True})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Verification email failed")
        return jsonify({"error": f"Email could not be sent: {exc}"}), 500


@app.route("/api/auth/login", methods=["POST", "OPTIONS"])
def auth_login():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        password = str(data.get("passwordHash", ""))
        if not password:
            return jsonify({"error": "Password is required"}), 400

        passwords = load_password_store()
        stored_password = passwords.get(email)
        initial_password_seed = get_initial_password_seed_value()
        default_initial_password_match = (
            bool(initial_password_seed)
            and password == initial_password_seed
            and is_initial_user_email(email)
        )
        if not stored_password and default_initial_password_match:
            stored_password = hash_password_for_storage(initial_password_seed)
            passwords[email] = stored_password
            save_password_store(passwords)

        password_matches = bool(stored_password) and verify_password(stored_password, password)
        if (
            default_initial_password_match
            and is_initial_user_email(email)
            and not password_matches
        ):
            passwords[email] = hash_password_for_storage(password)
            save_password_store(passwords)
            stored_password = passwords[email]
            password_matches = True

        if not stored_password or not password_matches:
            record_audit_log(
                None,
                "LOGIN_FAILED",
                {"email": email, "reason": "invalid_credentials"},
            )
            return jsonify({"error": "Invalid email or password"}), 401

        users = load_user_store()
        user = find_user_by_email(users, email)
        if not user or user["isArchived"] or not user["isActive"]:
            record_audit_log(
                None,
                "LOGIN_FAILED",
                {"email": email, "reason": "inactive_or_missing_account"},
            )
            return jsonify({"error": "Invalid email or password"}), 401
        if not user["isVerified"]:
            record_audit_log(
                None,
                "LOGIN_FAILED",
                {"email": email, "reason": "email_not_verified"},
            )
            return jsonify({"error": "Email not verified"}), 403

        if not is_secure_password_hash(stored_password):
            passwords[email] = hash_password_for_storage(password)
            save_password_store(passwords)

        user["lastSeen"] = now_ms()
        save_user_store(users)
        session_token = issue_session(user["id"])
        record_audit_log(user, "LOGIN", staff_audit_target(user))
        return jsonify({"ok": True, "user": user, "sessionToken": session_token})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/auth/logout", methods=["POST", "OPTIONS"])
def auth_logout():
    preflight = handle_options()
    if preflight:
        return preflight
    token, auth_user, error = require_authenticated_user()
    if error:
        return error
    set_user_last_seen(auth_user["id"], now_ms())
    store = prune_presence(load_presence_store())
    store.pop(auth_user["id"], None)
    save_presence_store(store)
    revoke_session(token)
    record_audit_log(auth_user, "LOGOUT", staff_audit_target(auth_user))
    return jsonify({"ok": True})


@app.route("/api/auth/request-password-reset", methods=["POST", "OPTIONS"])
def auth_request_password_reset():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        reset_page_url = str(data.get("resetPageUrl", "")).strip()

        users = load_user_store()
        user = find_user_by_email(users, email)
        if not user:
            return jsonify({"error": "Email not found"}), 404

        token = secrets.token_urlsafe(32)
        reset_url = build_reset_url(reset_page_url, token)
        tokens = load_reset_tokens()
        tokens[token] = {
            "email": email,
            "expiresAt": int(time.time()) + RESET_TOKEN_TTL_SECONDS,
        }
        save_reset_tokens(tokens)
        send_password_reset_link_email(email, reset_url)
        record_audit_log(None, "REQUEST_PASSWORD_RESET", staff_audit_target(user))
        return jsonify({"ok": True})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Password reset email failed")
        return jsonify({"error": f"Email could not be sent: {exc}"}), 500


@app.route("/api/auth/password-reset", methods=["POST", "OPTIONS"])
def auth_password_reset():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    token = str(data.get("token", "")).strip()
    new_password = str(data.get("newPasswordHash", ""))
    if not token:
        return jsonify({"error": "token is required"}), 400
    if not new_password:
        return jsonify({"error": "Password is required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    tokens = load_reset_tokens()
    entry = tokens.get(token)
    if not entry:
        return jsonify({"error": "Invalid or expired reset token"}), 400

    email = entry["email"]
    users = load_user_store()
    if not find_user_by_email(users, email):
        return jsonify({"error": "Invalid or expired reset token"}), 400

    passwords = load_password_store()
    passwords[email] = hash_password_for_storage(new_password)
    tokens.pop(token, None)
    save_password_store(passwords)
    save_reset_tokens(tokens)
    user = find_user_by_email(users, email)
    if user:
        revoke_user_sessions(user["id"])
        record_audit_log(None, "COMPLETE_PASSWORD_RESET", staff_audit_target(user))
    return jsonify({"ok": True})


@app.route("/api/content/announcements", methods=["GET"])
def get_shared_announcements():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    return jsonify({"announcements": filter_items_for_user(load_json_list_store(ANNOUNCEMENTS_STORE_PATH), auth_user)})


@app.route("/api/content/announcements", methods=["POST", "OPTIONS"])
def create_shared_announcement():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    try:
        payload = normalize_announcement_payload(data, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="announcements",
        branch_scope=item_branch_scope(payload),
        department_scope=item_department_scope(payload),
    )
    if not allowed:
        return denial
    announcement = {
        "id": next_content_id(items),
        **payload,
        "authorId": actor["id"],
        "authorName": actor["fullname"],
        "createdAt": now_ms(),
        "updatedAt": now_ms(),
        "isDismissed": False,
        "isTrashed": False,
    }
    items.insert(0, announcement)
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, items)
    record_content_audit(actor, "CREATE_ANNOUNCEMENT", "announcement", announcement)
    return jsonify({"ok": True, "announcement": announcement})


@app.route("/api/content/announcements/<int:item_id>/update", methods=["POST", "OPTIONS"])
def update_shared_announcement(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    announcement = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
    if not user_can_manage_item(actor, announcement, "announcements"):
        return scoped_access_denial(actor)
    try:
        payload = normalize_announcement_payload(data, actor, announcement)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="announcements",
        branch_scope=item_branch_scope(payload),
        department_scope=item_department_scope(payload),
    )
    if not allowed:
        return denial
    previous_image = str(announcement.get("imageUrl") or "").strip()
    previous_file = str(announcement.get("fileUrl") or "").strip()
    announcement.update(payload)
    announcement["updatedAt"] = now_ms()
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, items)
    record_content_audit(actor, "UPDATE_ANNOUNCEMENT", "announcement", announcement)
    if previous_image.startswith("LOCAL:") and previous_image != str(announcement.get("imageUrl") or "").strip():
        remove_uploaded_file_if_unused(previous_image.replace("LOCAL:", "", 1).strip())
    if previous_file.startswith("LOCAL:") and previous_file != str(announcement.get("fileUrl") or "").strip():
        remove_uploaded_file_if_unused(previous_file.replace("LOCAL:", "", 1).strip())
    return jsonify({"ok": True, "announcement": announcement})


@app.route("/api/content/announcements/<int:item_id>/trash", methods=["POST", "OPTIONS"])
def trash_shared_announcement(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    announcement = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
    if not user_can_manage_item(actor, announcement, "announcements"):
        return scoped_access_denial(actor)
    announcement["isTrashed"] = True
    announcement["updatedAt"] = now_ms()
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, items)
    record_content_audit(actor, "TRASH_ANNOUNCEMENT", "announcement", announcement)
    return jsonify({"ok": True})


@app.route("/api/content/announcements/<int:item_id>/restore", methods=["POST", "OPTIONS"])
def restore_shared_announcement(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    announcement = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
    if not user_can_manage_item(actor, announcement, "announcements"):
        return scoped_access_denial(actor)
    announcement["isTrashed"] = False
    announcement["updatedAt"] = now_ms()
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, items)
    record_content_audit(actor, "RESTORE_ANNOUNCEMENT", "announcement", announcement)
    return jsonify({"ok": True})


@app.route("/api/content/announcements/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_shared_announcement(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    target = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not target:
        return jsonify({"error": "Announcement not found"}), 404
    if not user_can_manage_item(actor, target, "announcements"):
        return scoped_access_denial(actor)
    filtered = [item for item in items if int(item.get("id", 0) or 0) != item_id]
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, filtered)
    record_content_audit(actor, "DELETE_ANNOUNCEMENT", "announcement", target)
    cleanup_local_announcement_assets(target)
    return jsonify({"ok": True})


@app.route("/api/content/announcements/empty-trash", methods=["POST", "OPTIONS"])
def empty_shared_announcement_trash():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_staff_manager()
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    trashed_items = [item for item in items if bool(item.get("isTrashed", False))]
    save_json_list_store(
        ANNOUNCEMENTS_STORE_PATH,
        [item for item in items if not bool(item.get("isTrashed", False))],
    )
    for item in trashed_items:
        cleanup_local_announcement_assets(item)
    record_audit_log(
        actor,
        "EMPTY_ANNOUNCEMENT_TRASH",
        {"module": "announcement", "deletedCount": len(trashed_items)},
    )
    return jsonify({"ok": True})


@app.route("/api/content/forms", methods=["GET"])
def get_shared_forms():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    return jsonify({"forms": filter_items_for_user(load_json_list_store(FORMS_STORE_PATH), auth_user)})


@app.route("/api/uploads/training-video", methods=["POST", "OPTIONS"])
def upload_training_video_file():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_module_manager("trainingVideos")
    if error:
        return error
    try:
        saved = save_uploaded_media(request.files.get("file"), "video")
        return jsonify({"ok": True, **saved})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/uploads/training-document", methods=["POST", "OPTIONS"])
def upload_training_document_file():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_module_manager("trainingDocuments")
    if error:
        return error
    try:
        saved = save_uploaded_media(request.files.get("file"), "document")
        return jsonify({"ok": True, **saved})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/uploads/announcement-asset", methods=["POST", "OPTIONS"])
def upload_announcement_asset_file():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_module_manager("announcements")
    if error:
        return error
    try:
        saved = save_uploaded_media(request.files.get("file"), "announcement")
        return jsonify({"ok": True, **saved})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/uploads/profile-photo", methods=["POST", "OPTIONS"])
def upload_profile_photo_file():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_authenticated_user()
    if error:
        return error
    try:
        saved = save_uploaded_media(request.files.get("file"), "profile")
        return jsonify({"ok": True, **saved})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/content/forms", methods=["POST", "OPTIONS"])
def create_shared_form():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("forms")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    send_external_emails = bool(data.get("sendExternalEmails", False))
    items = load_json_list_store(FORMS_STORE_PATH)
    try:
        visibility, department = normalize_visibility_and_department(data)
        branch_scope, department_scope = derive_content_scope(
            data,
            visibility=visibility,
            department=department,
        )
        form = {
            "id": next_content_id(items),
            "title": normalize_non_empty_title(data.get("title"), "Form title"),
            "description": str(data.get("description", "")).strip(),
            "fileUrl": normalize_form_file_url(data.get("fileUrl")),
            "category": str(data.get("category", "")).strip() or actor["department"],
            "visibleTo": [],
            "visibility": visibility,
            "department": department,
            "branchScope": branch_scope,
            "departmentScope": department_scope,
            "createdAt": now_ms(),
            "updatedAt": now_ms(),
        }
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="forms",
        branch_scope=branch_scope,
        department_scope=department_scope,
    )
    if not allowed:
        return denial
    items.insert(0, form)
    save_json_list_store(FORMS_STORE_PATH, items)
    record_content_audit(actor, "CREATE_FORM", "form", form)
    delivery = fanout_content_notification(
        kind="system",
        title="New Form Available",
        message=f"{form['title']} has been added to the forms centre.",
        email_subject="Bawjiase Staff Portal - New Form Available",
        email_headline="New Form Available",
        email_intro="A new form has been added to the Bawjiase Staff Portal for eligible staff.",
        item_title=form["title"],
        visibility=form["visibility"],
        department=form.get("department"),
        branch_scope=form.get("branchScope"),
        department_scope=form.get("departmentScope"),
        link_to="/forms",
        send_external_emails=send_external_emails,
    )
    return jsonify({"ok": True, "form": form, "delivery": delivery})


@app.route("/api/content/forms/<int:item_id>/update", methods=["POST", "OPTIONS"])
def update_shared_form(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("forms")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    items = load_json_list_store(FORMS_STORE_PATH)
    form = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not form:
        return jsonify({"error": "Form not found"}), 404
    if not user_can_manage_item(actor, form, "forms"):
        return scoped_access_denial(actor)
    try:
        if "title" in data:
            form["title"] = normalize_non_empty_title(data.get("title"), "Form title")
        if "description" in data:
            form["description"] = str(data.get("description", "")).strip()
        if "fileUrl" in data:
            form["fileUrl"] = normalize_form_file_url(data.get("fileUrl"))
        if "category" in data:
            form["category"] = str(data.get("category", "")).strip() or form["category"]
        if (
            "visibility" in data
            or "department" in data
            or "branchScope" in data
            or "departmentScope" in data
        ):
            merged = {
                "visibility": data.get("visibility", form.get("visibility")),
                "department": data.get("department", form.get("department")),
                "branchScope": data.get("branchScope", form.get("branchScope")),
                "departmentScope": data.get("departmentScope", form.get("departmentScope")),
            }
            visibility, department = normalize_visibility_and_department(merged)
            branch_scope, department_scope = derive_content_scope(
                merged,
                visibility=visibility,
                department=department,
                existing=form,
            )
            form["visibility"] = visibility
            form["department"] = department
            form["branchScope"] = branch_scope
            form["departmentScope"] = department_scope
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="forms",
        branch_scope=item_branch_scope(form),
        department_scope=item_department_scope(form),
    )
    if not allowed:
        return denial
    form["updatedAt"] = now_ms()
    save_json_list_store(FORMS_STORE_PATH, items)
    record_content_audit(actor, "UPDATE_FORM", "form", form)
    return jsonify({"ok": True, "form": form})


@app.route("/api/content/forms/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_shared_form(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("forms")
    if error:
        return error
    items = load_json_list_store(FORMS_STORE_PATH)
    target = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not target:
        return jsonify({"error": "Form not found"}), 404
    if not user_can_manage_item(actor, target, "forms"):
        return scoped_access_denial(actor)
    filtered = [item for item in items if int(item.get("id", 0) or 0) != item_id]
    save_json_list_store(FORMS_STORE_PATH, filtered)
    record_content_audit(actor, "DELETE_FORM", "form", target)
    return jsonify({"ok": True})


@app.route("/api/content/training/videos", methods=["GET"])
def get_shared_training_videos():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    return jsonify({"videos": filter_items_for_user(items, auth_user)})


@app.route("/api/content/training/videos", methods=["POST", "OPTIONS"])
def create_shared_training_video():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingVideos")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    send_external_emails = bool(data.get("sendExternalEmails", False))
    items = load_json_list_store(TRAINING_VIDEOS_STORE_PATH)
    try:
        video = normalize_training_video_payload(data, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="trainingVideos",
        branch_scope=item_branch_scope(video),
        department_scope=item_department_scope(video),
    )
    if not allowed:
        return denial
    items.insert(0, video)
    save_json_list_store(TRAINING_VIDEOS_STORE_PATH, items)
    record_content_audit(actor, "CREATE_TRAINING_VIDEO", "trainingVideo", video)
    video_subject = (
        "Bawjiase Staff Portal - Mandatory Training Assigned"
        if video["isMandatory"]
        else "Bawjiase Staff Portal - New Training Video"
    )
    video_title = (
        "Mandatory Training Assigned"
        if video["isMandatory"]
        else "New Training Video"
    )
    video_intro = (
        "A mandatory training video has been assigned to eligible staff."
        if video["isMandatory"]
        else "A new training video has been uploaded for eligible staff."
    )
    delivery = fanout_content_notification(
        kind="training",
        title=video_title,
        message=f"{video['title']} is now available in the training portal.",
        email_subject=video_subject,
        email_headline=video_title,
        email_intro=video_intro,
        item_title=video["title"],
        visibility=video["visibility"],
        department=video.get("department"),
        branch_scope=video.get("branchScope"),
        department_scope=video.get("departmentScope"),
        link_to="/training",
        send_external_emails=send_external_emails,
    )
    return jsonify({"ok": True, "video": video, "delivery": delivery})


@app.route("/api/content/training/videos/<int:item_id>/progress", methods=["GET"])
def get_my_training_video_progress(item_id: int):
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    video = get_training_video_by_id(item_id)
    if not video or bool(video.get("isArchived", False)):
        return jsonify({"error": "Video not found"}), 404
    if not user_can_access_item(auth_user, video):
        return jsonify({"error": "Access denied"}), 403
    progress_items = load_training_video_progress_store()
    item = next(
        (
            entry
            for entry in progress_items
            if entry["userId"] == auth_user["id"] and int(entry["videoId"]) == item_id
        ),
        None,
    )
    return jsonify({"progress": serialize_video_progress(item or {"videoId": item_id}) if item else None})


@app.route("/api/content/training/videos/<int:item_id>/progress", methods=["POST", "OPTIONS"])
def update_my_training_video_progress(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    video = get_training_video_by_id(item_id)
    if not video or bool(video.get("isArchived", False)):
        return jsonify({"error": "Video not found"}), 404
    if not user_can_access_item(auth_user, video):
        return jsonify({"error": "Access denied"}), 403
    progress_percent = max(0, min(100, int(data.get("progressPercent", 0) or 0)))
    progress_items = load_training_video_progress_store()
    entry = next(
        (
            item
            for item in progress_items
            if item["userId"] == auth_user["id"] and int(item["videoId"]) == item_id
        ),
        None,
    )
    payload = {
        "userId": auth_user["id"],
        "videoId": item_id,
        "progressPercent": progress_percent,
        "isComplete": progress_percent >= 98,
        "lastWatched": now_ms(),
    }
    previous_percent = int(entry.get("progressPercent", 0) or 0) if entry else 0
    is_local_video = str(video.get("storageType", "")).strip() == "Local"
    if is_local_video:
        if progress_percent < previous_percent:
            progress_percent = previous_percent
        elif progress_percent > previous_percent + 20:
            return jsonify({"error": "Invalid progress update"}), 400
        if progress_percent >= 98 and previous_percent < 80:
            return jsonify({"error": "Progress jumped too far ahead"}), 400
        payload["progressPercent"] = progress_percent
        payload["isComplete"] = progress_percent >= 98
    if entry:
        entry.update(payload)
    else:
        progress_items.append(payload)
    save_training_video_progress_store(progress_items)
    refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    return jsonify({"ok": True, "progress": serialize_video_progress(payload)})


@app.route("/api/content/training/videos/stats", methods=["GET"])
def get_training_video_stats():
    _, auth_user, error = require_module_manager("trainingVideos")
    if error:
        return error
    items = refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    progress_items = load_training_video_progress_store()
    stats = []
    for video in items:
        if bool(video.get("isArchived", False)):
            continue
        if not user_can_manage_item(auth_user, video, "trainingVideos"):
            continue
        video_id = int(video.get("id", 0) or 0)
        watched_count = len(
            {
                entry["userId"]
                for entry in progress_items
                if int(entry["videoId"]) == video_id and int(entry["progressPercent"]) > 0
            }
        )
        completed_count = len(
            {
                entry["userId"]
                for entry in progress_items
                if int(entry["videoId"]) == video_id and bool(entry["isComplete"])
            }
        )
        stats.append(
            {
                "videoId": video_id,
                "title": str(video.get("title", "")),
                "totalWatched": watched_count,
                "completedCount": completed_count,
            }
        )
    return jsonify({"stats": stats})


@app.route("/api/content/training/videos/<int:item_id>/archive", methods=["POST", "OPTIONS"])
def archive_shared_training_video(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingVideos")
    if error:
        return error
    items = load_json_list_store(TRAINING_VIDEOS_STORE_PATH)
    video = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not video:
        return jsonify({"error": "Video not found"}), 404
    if not user_can_manage_item(actor, video, "trainingVideos"):
        return scoped_access_denial(actor)
    video["isArchived"] = True
    save_json_list_store(TRAINING_VIDEOS_STORE_PATH, items)
    record_content_audit(actor, "ARCHIVE_TRAINING_VIDEO", "trainingVideo", video)
    return jsonify({"ok": True})


@app.route("/api/content/training/videos/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_shared_training_video(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingVideos")
    if error:
        return error
    items = load_json_list_store(TRAINING_VIDEOS_STORE_PATH)
    target = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not target:
        return jsonify({"error": "Video not found"}), 404
    if not user_can_manage_item(actor, target, "trainingVideos"):
        return scoped_access_denial(actor)
    filtered = [item for item in items if int(item.get("id", 0) or 0) != item_id]
    save_json_list_store(TRAINING_VIDEOS_STORE_PATH, filtered)
    record_content_audit(actor, "DELETE_TRAINING_VIDEO", "trainingVideo", target)
    if target and str(target.get("storageType", "")).strip() == "Local":
        remove_uploaded_file_if_unused(str(target.get("localFilename", "")).strip())
    return jsonify({"ok": True})


@app.route("/api/content/training/documents", methods=["GET"])
def get_shared_training_documents():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    return jsonify({"documents": filter_items_for_user(items, auth_user)})


@app.route("/api/content/training/documents", methods=["POST", "OPTIONS"])
def create_shared_training_document():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingDocuments")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    send_external_emails = bool(data.get("sendExternalEmails", False))
    items = load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)
    try:
        document = normalize_training_document_payload(data, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="trainingDocuments",
        branch_scope=item_branch_scope(document),
        department_scope=item_department_scope(document),
    )
    if not allowed:
        return denial
    items.insert(0, document)
    save_json_list_store(TRAINING_DOCUMENTS_STORE_PATH, items)
    record_content_audit(actor, "CREATE_TRAINING_DOCUMENT", "trainingDocument", document)
    document_subject = (
        "Bawjiase Staff Portal - Mandatory Training Document"
        if document["isMandatory"]
        else "Bawjiase Staff Portal - New Training Document"
    )
    document_title = (
        "Mandatory Training Document"
        if document["isMandatory"]
        else "New Training Document"
    )
    document_intro = (
        "A mandatory training document has been shared with eligible staff."
        if document["isMandatory"]
        else "A new training document has been uploaded for eligible staff."
    )
    delivery = fanout_content_notification(
        kind="training",
        title=document_title,
        message=f"{document['title']} is now available in the training portal.",
        email_subject=document_subject,
        email_headline=document_title,
        email_intro=document_intro,
        item_title=document["title"],
        visibility=document["visibility"],
        department=document.get("department"),
        branch_scope=document.get("branchScope"),
        department_scope=document.get("departmentScope"),
        link_to="/training",
        send_external_emails=send_external_emails,
    )
    return jsonify({"ok": True, "document": document, "delivery": delivery})


@app.route("/api/content/training/documents/<int:item_id>/open-state", methods=["GET"])
def get_my_training_document_open_state(item_id: int):
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    document = get_training_document_by_id(item_id)
    if not document or bool(document.get("isArchived", False)):
        return jsonify({"error": "Document not found"}), 404
    if not user_can_access_item(auth_user, document):
        return jsonify({"error": "Access denied"}), 403
    open_items = load_training_document_opens_store()
    item = next(
        (
            entry
            for entry in open_items
            if entry["userId"] == auth_user["id"] and int(entry["documentId"]) == item_id
        ),
        None,
    )
    return jsonify({"state": serialize_document_open_state(item)})


@app.route("/api/content/training/documents/<int:item_id>/open", methods=["POST", "OPTIONS"])
def mark_training_document_opened(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    document = get_training_document_by_id(item_id)
    if not document or bool(document.get("isArchived", False)):
        return jsonify({"error": "Document not found"}), 404
    if not user_can_access_item(auth_user, document):
        return jsonify({"error": "Access denied"}), 403
    open_items = load_training_document_opens_store()
    entry = next(
        (
            item
            for item in open_items
            if item["userId"] == auth_user["id"] and int(item["documentId"]) == item_id
        ),
        None,
    )
    payload = {
        "userId": auth_user["id"],
        "documentId": item_id,
        "openedAt": now_ms(),
    }
    if entry:
        entry.update(payload)
    else:
        open_items.append(payload)
    save_training_document_opens_store(open_items)
    refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    return jsonify({"ok": True, "state": serialize_document_open_state(payload)})


@app.route("/api/content/training/documents/stats", methods=["GET"])
def get_training_document_stats():
    _, auth_user, error = require_module_manager("trainingDocuments")
    if error:
        return error
    items = refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    open_items = load_training_document_opens_store()
    stats = []
    for document in items:
        if bool(document.get("isArchived", False)):
            continue
        if not user_can_manage_item(auth_user, document, "trainingDocuments"):
            continue
        document_id = int(document.get("id", 0) or 0)
        opened_count = len(
            {
                entry["userId"]
                for entry in open_items
                if int(entry["documentId"]) == document_id and int(entry["openedAt"]) > 0
            }
        )
        stats.append(
            {
                "docId": document_id,
                "title": str(document.get("title", "")),
                "openedCount": opened_count,
            }
        )
    return jsonify({"stats": stats})


@app.route("/api/content/training/documents/<int:item_id>/archive", methods=["POST", "OPTIONS"])
def archive_shared_training_document(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingDocuments")
    if error:
        return error
    items = load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)
    document = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not document:
        return jsonify({"error": "Document not found"}), 404
    if not user_can_manage_item(actor, document, "trainingDocuments"):
        return scoped_access_denial(actor)
    document["isArchived"] = True
    save_json_list_store(TRAINING_DOCUMENTS_STORE_PATH, items)
    record_content_audit(actor, "ARCHIVE_TRAINING_DOCUMENT", "trainingDocument", document)
    return jsonify({"ok": True})


@app.route("/api/content/training/documents/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_shared_training_document(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingDocuments")
    if error:
        return error
    items = load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)
    target = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not target:
        return jsonify({"error": "Document not found"}), 404
    if not user_can_manage_item(actor, target, "trainingDocuments"):
        return scoped_access_denial(actor)
    filtered = [item for item in items if int(item.get("id", 0) or 0) != item_id]
    save_json_list_store(TRAINING_DOCUMENTS_STORE_PATH, filtered)
    record_content_audit(actor, "DELETE_TRAINING_DOCUMENT", "trainingDocument", target)
    if target and str(target.get("storageType", "")).strip() == "Local":
        remove_uploaded_file_if_unused(str(target.get("localFilename", "")).strip())
    return jsonify({"ok": True})


@app.route("/api/content/training/admin-overview", methods=["GET"])
def get_admin_training_overview():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if not (
        user_has_permission(auth_user, "trainingVideos")
        or user_has_permission(auth_user, "trainingDocuments")
    ):
        return jsonify({"error": "Admin access required"}), 403
    videos = refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    documents = refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    users = [
        user
        for user in load_user_store()
        if user["isActive"] and user["isVerified"] and not user["isArchived"]
    ]
    progress_items = load_training_video_progress_store()
    open_items = load_training_document_opens_store()
    video_stats = []
    for video in videos:
        if bool(video.get("isArchived", False)):
            continue
        if not user_can_manage_item(auth_user, video, "trainingVideos"):
            continue
        video_id = int(video.get("id", 0) or 0)
        eligible_users = eligible_users_for_item(video)
        watched_user_ids = {
            entry["userId"]
            for entry in progress_items
            if int(entry["videoId"]) == video_id and int(entry["progressPercent"]) > 0
        }
        completed_user_ids = {
            entry["userId"]
            for entry in progress_items
            if int(entry["videoId"]) == video_id and bool(entry["isComplete"])
        }
        eligible_count = len(eligible_users)
        incomplete_users = [
            user["fullname"] for user in eligible_users if user["id"] not in completed_user_ids
        ]
        video_stats.append(
            {
                "id": video_id,
                "title": str(video.get("title", "")),
                "eligibleCount": eligible_count,
                "watchedCount": len(watched_user_ids),
                "completionPct": round((len(completed_user_ids) / eligible_count) * 100) if eligible_count else 0,
                "isMandatory": bool(video.get("isMandatory", False)),
                "branchScope": item_branch_scope(video),
                "departmentScope": item_department_scope(video),
                "incompleteCount": len(incomplete_users),
                "incompleteUsers": incomplete_users[:100],
            }
        )
    document_stats = []
    for document in documents:
        if bool(document.get("isArchived", False)):
            continue
        if not user_can_manage_item(auth_user, document, "trainingDocuments"):
            continue
        document_id = int(document.get("id", 0) or 0)
        eligible_users = eligible_users_for_item(document)
        opened_user_ids = {
            entry["userId"]
            for entry in open_items
            if int(entry["documentId"]) == document_id and int(entry["openedAt"]) > 0
        }
        eligible_count = len(eligible_users)
        incomplete_users = [
            user["fullname"] for user in eligible_users if user["id"] not in opened_user_ids
        ]
        document_stats.append(
            {
                "id": document_id,
                "title": str(document.get("title", "")),
                "eligibleCount": eligible_count,
                "openedCount": len(opened_user_ids),
                "openedPct": round((len(opened_user_ids) / eligible_count) * 100) if eligible_count else 0,
                "isMandatory": bool(document.get("isMandatory", False)),
                "branchScope": item_branch_scope(document),
                "departmentScope": item_department_scope(document),
                "incompleteCount": len(incomplete_users),
                "incompleteUsers": incomplete_users[:100],
            }
        )
    return jsonify(
        {
            "overview": {
                "totalVideos": len([item for item in videos if not bool(item.get("isArchived", False))]),
                "totalDocuments": len([item for item in documents if not bool(item.get("isArchived", False))]),
                "totalStaff": len(users),
                "videoStats": video_stats,
                "docStats": document_stats,
            }
        }
    )


@app.route("/api/content/training/videos/<int:item_id>/remind", methods=["POST", "OPTIONS"])
def send_video_training_reminder(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_module_manager("trainingVideos")
    if error:
        return error
    video = get_training_video_by_id(item_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404
    if not user_can_manage_item(auth_user, video, "trainingVideos"):
        return scoped_access_denial(auth_user)
    try:
        delivery = send_training_reminders("video", item_id)
    except ValueError:
        return jsonify({"error": "Video not found"}), 404
    return jsonify({"ok": True, "delivery": delivery})


@app.route("/api/content/training/documents/<int:item_id>/remind", methods=["POST", "OPTIONS"])
def send_document_training_reminder(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_module_manager("trainingDocuments")
    if error:
        return error
    document = get_training_document_by_id(item_id)
    if not document:
        return jsonify({"error": "Document not found"}), 404
    if not user_can_manage_item(auth_user, document, "trainingDocuments"):
        return scoped_access_denial(auth_user)
    try:
        delivery = send_training_reminders("document", item_id)
    except ValueError:
        return jsonify({"error": "Document not found"}), 404
    return jsonify({"ok": True, "delivery": delivery})


@app.route("/", defaults={"path": ""}, methods=["GET"])
@app.route("/<path:path>", methods=["GET"])
def serve_frontend(path: str):
    requested = str(path or "").strip().lstrip("/")
    if not os.path.isdir(FRONTEND_PUBLIC_DIR):
        return jsonify({"error": "Frontend build is not installed on this server."}), 404

    if requested:
        candidate = os.path.join(FRONTEND_PUBLIC_DIR, requested)
        if os.path.isfile(candidate):
            return send_from_directory(FRONTEND_PUBLIC_DIR, requested, conditional=True)
        nested_index = os.path.join(candidate, "index.html")
        if os.path.isfile(nested_index):
            return send_from_directory(
                FRONTEND_PUBLIC_DIR,
                os.path.join(requested, "index.html"),
                conditional=True,
            )

    index_path = os.path.join(FRONTEND_PUBLIC_DIR, "index.html")
    if os.path.isfile(index_path):
        return send_from_directory(FRONTEND_PUBLIC_DIR, "index.html", conditional=True)

    return jsonify({"error": "Frontend entry point not found."}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4185")))
