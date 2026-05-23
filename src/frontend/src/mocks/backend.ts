import type { _ImmutableObjectStorageCreateCertificateResult, _ImmutableObjectStorageRefillResult, backendInterface } from "../backend";
import { AnnouncementCategory, Branch, Department, FormCategory, Role, UserRole } from "../backend";
import { Principal } from "@icp-sdk/core/principal";

const samplePrincipal = Principal.fromText("2vxsx-fae");
const now = BigInt(Date.now()) * BigInt(1_000_000);

const sampleUser = {
  id: samplePrincipal,
  branch: Branch.HeadOffice,
  imageFile: undefined,
  role: Role.SuperAdmin,
  isArchived: false,
  isActive: true,
  email: "admin@bawjiasecommunitybank.com",
  fullname: "Kwame Mensah",
  isVerified: true,
  phone: "+233201234567",
  department: Department.IT,
  position: "IT Manager",
  registrationTime: now,
  lastSeen: now,
};

const sampleUser2 = {
  id: samplePrincipal,
  branch: Branch.Bawjiase,
  imageFile: undefined,
  role: Role.GeneralStaff,
  isArchived: false,
  isActive: true,
  email: "ama.asante@bawjiasecommunitybank.com",
  fullname: "Ama Asante",
  isVerified: true,
  phone: "+233209876543",
  department: Department.HR,
  position: "HR Officer",
  registrationTime: now,
  lastSeen: now,
};

const sampleAnnouncement = {
  id: BigInt(1),
  title: "Staff General Meeting – Q2 2026",
  isDeleted: false,
  imageFile: undefined,
  authorId: samplePrincipal.toText(),
  body: "All staff are invited to attend the Q2 general meeting scheduled for Friday, April 25, 2026, at 10:00 AM in the Head Office boardroom. Attendance is mandatory for all departments.",
  authorName: "Kwame Mensah",
  allowDownload: true,
  datePosted: now,
  category: AnnouncementCategory.General,
};

const sampleAnnouncement2 = {
  id: BigInt(2),
  title: "IT System Maintenance – Weekend Downtime",
  isDeleted: false,
  imageFile: undefined,
  authorId: samplePrincipal.toText(),
  body: "The core banking system will undergo scheduled maintenance from Saturday 10 PM to Sunday 4 AM. Please complete all critical transactions before the downtime window.",
  authorName: "Kwame Mensah",
  allowDownload: false,
  datePosted: now - BigInt(86400) * BigInt(1_000_000_000),
  category: AnnouncementCategory.IT,
};

const sampleNotification = {
  id: BigInt(1),
  title: "New Announcement Posted",
  userId: samplePrincipal.toText(),
  link: "/announcements",
  createdAt: now,
  isRead: false,
  message: "A new general announcement has been posted: Staff General Meeting – Q2 2026",
};

const sampleNotification2 = {
  id: BigInt(2),
  title: "Profile Updated",
  userId: samplePrincipal.toText(),
  link: "/profile",
  createdAt: now - BigInt(3600) * BigInt(1_000_000_000),
  isRead: true,
  message: "Your profile information has been successfully updated.",
};

const sampleForm = {
  id: BigInt(1),
  title: "Staff Leave Application Form",
  filename: "leave_application_2026.pdf",
  category: FormCategory.HR,
  uploadDate: now,
};

const sampleForm2 = {
  id: BigInt(2),
  title: "IT Support Request Form",
  filename: "it_support_request.pdf",
  category: FormCategory.IT,
  uploadDate: now - BigInt(86400) * BigInt(2) * BigInt(1_000_000_000),
};

const sampleAuditLog = {
  id: BigInt(1),
  action: "USER_LOGIN",
  actorName: "Kwame Mensah",
  target: "admin@bawjiasecommunitybank.com",
  timestamp: now,
  ipAddress: "192.168.1.10",
};

const samplePollResult = {
  question: "Do you prefer in-person or remote training sessions?",
  pollId: BigInt(1),
  options: [
    { optionId: BigInt(1), optionText: "In-Person", voteCount: BigInt(14), votedByMe: true },
    { optionId: BigInt(2), optionText: "Remote / Online", voteCount: BigInt(9), votedByMe: false },
    { optionId: BigInt(3), optionText: "Hybrid", voteCount: BigInt(7), votedByMe: false },
  ],
};

export const mockBackend: backendInterface = {
  archiveStaff: async (_userId) => ({ __kind__: "ok", ok: null }),
  assignCallerUserRole: async (_user, _role) => undefined,
  confirmPasswordReset: async (_token, _newPasswordHash) => ({ __kind__: "ok", ok: null }),
  createAnnouncement: async (input) => ({
    id: BigInt(Date.now()),
    title: input.title,
    isDeleted: false,
    imageFile: undefined,
    authorId: samplePrincipal.toText(),
    body: input.body,
    authorName: input.authorName,
    allowDownload: input.allowDownload,
    datePosted: now,
    category: input.category,
  }),
  createForm: async (input) => ({
    id: BigInt(Date.now()),
    title: input.title,
    filename: input.filename,
    category: input.category,
    uploadDate: now,
  }),
  createNotification: async (input) => ({
    id: BigInt(Date.now()),
    title: input.title,
    userId: samplePrincipal.toText(),
    link: input.link,
    createdAt: now,
    isRead: false,
    message: input.message,
  }),
  createPoll: async (input) => ({
    id: BigInt(Date.now()),
    question: input.question,
    announcementId: input.announcementId,
  }),
  deleteAnnouncement: async (_id) => true,
  deleteAuditLog: async (_id) => ({ __kind__: "ok", ok: null }),
  deleteAuditLogs: async (_ids) => ({ __kind__: "ok", ok: null }),
  deleteForm: async (_id) => true,
  deleteStaff: async (_userId) => ({ __kind__: "ok", ok: null }),
  getActiveStaff: async () => [sampleUser, sampleUser2],
  getAnnouncements: async () => [
    { announcement: sampleAnnouncement, poll: { ...samplePollResult, pollId: BigInt(1) } },
    { announcement: sampleAnnouncement2, poll: undefined },
  ],
  getArchivedStaff: async () => [],
  getAuditLogs: async () => [sampleAuditLog],
  getCallerUserRole: async () => UserRole.admin,
  getForms: async () => [sampleForm, sampleForm2],
  getMyProfile: async () => sampleUser,
  getNotifications: async () => [sampleNotification, sampleNotification2],
  getPollResult: async (_announcementId) => samplePollResult,
  getStaffMember: async (_userId) => sampleUser,
  getStaffStats: async () => ({
    branchesWithStaff: BigInt(6),
    activeCount: BigInt(47),
    archivedCount: BigInt(3),
  }),
  getTrashedAnnouncements: async () => [],
  getUnreadNotificationCount: async () => BigInt(1),
  hideAnnouncement: async (_announcementId) => undefined,
  isCallerAdmin: async () => true,
  logAction: async (_actorName, _action, _target, _ipAddress) => undefined,
  logAnnouncementDownload: async (_announcementId) => undefined,
  login: async (_email, _passwordHash) => ({ __kind__: "ok", ok: sampleUser }),
  logout: async () => undefined,
  markAllNotificationsRead: async () => undefined,
  markNotificationRead: async (_id) => true,
  permanentDeleteAnnouncement: async (_id) => true,
  register: async (_req) => ({ __kind__: "ok", ok: sampleUser }),
  requestPasswordReset: async (_email) => ({ __kind__: "ok", ok: "reset-token-sample-123" }),
  resendVerificationCode: async (_email) => ({ __kind__: "ok", ok: null }),
  restoreAnnouncement: async (_id) => true,
  restoreStaff: async (_userId) => ({ __kind__: "ok", ok: null }),
  updateAnnouncement: async (input) => ({
    id: input.id,
    title: input.title,
    isDeleted: false,
    imageFile: undefined,
    authorId: samplePrincipal.toText(),
    body: input.body,
    authorName: "Kwame Mensah",
    allowDownload: input.allowDownload,
    datePosted: now,
    category: input.category,
  }),
  updateForm: async (input) => ({
    id: input.id,
    title: input.title,
    filename: input.filename,
    category: input.category,
    uploadDate: now,
  }),
  updateLastSeen: async () => undefined,
  updateMyProfile: async (_req) => ({ __kind__: "ok", ok: sampleUser }),
  updateStaff: async (_userId, _req) => ({ __kind__: "ok", ok: sampleUser }),
  verifyEmail: async (_email, _code) => ({ __kind__: "ok", ok: null }),
  vote: async (_pollId, _optionId) => true,
  _immutableObjectStorageBlobsAreLive: async (_hashes) => [],
  _immutableObjectStorageBlobsToDelete: async () => [],
  _immutableObjectStorageConfirmBlobDeletion: async (_blobs) => undefined,
  _immutableObjectStorageCreateCertificate: async (_blobHash): Promise<_ImmutableObjectStorageCreateCertificateResult> => ({ method: "", blob_hash: "" }),
  _immutableObjectStorageRefillCashier: async (_refillInfo): Promise<_ImmutableObjectStorageRefillResult> => ({}),
  _immutableObjectStorageUpdateGatewayPrincipals: async () => undefined,
  _initializeAccessControl: async () => undefined,
};
