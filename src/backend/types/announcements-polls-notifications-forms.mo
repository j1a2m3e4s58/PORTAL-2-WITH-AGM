import Storage "mo:caffeineai-object-storage/Storage";

module {
  // ── Shared primitive aliases ──────────────────────────────────────────────
  public type UserId    = Principal;
  public type Timestamp = Int;

  // ── Announcement category ─────────────────────────────────────────────────
  public type AnnouncementCategory = { #HR; #IT; #General };

  // ── Announcement (internal — imageFile is ExternalBlob) ───────────────────
  public type Announcement = {
    id           : Nat;
    title        : Text;
    body         : Text;
    category     : AnnouncementCategory;
    authorId     : UserId;
    authorName   : Text;
    datePosted   : Timestamp;
    imageFile    : ?Storage.ExternalBlob;   // object-storage blob
    allowDownload: Bool;
    isDeleted    : Bool;                    // soft-delete / trash flag
  };

  // Immutable public-facing announcement (for API boundary)
  public type AnnouncementPublic = {
    id           : Nat;
    title        : Text;
    body         : Text;
    category     : AnnouncementCategory;
    authorId     : Text;   // Principal as Text
    authorName   : Text;
    datePosted   : Timestamp;
    imageFile    : ?Storage.ExternalBlob;
    allowDownload: Bool;
    isDeleted    : Bool;
  };

  // ── Poll ──────────────────────────────────────────────────────────────────
  public type Poll = {
    id             : Nat;
    announcementId : Nat;
    question       : Text;
  };

  public type PollOption = {
    id       : Nat;
    pollId   : Nat;
    optionText : Text;
  };

  public type PollVote = {
    id       : Nat;
    pollId   : Nat;
    optionId : Nat;
    userId   : UserId;
    votedAt  : Timestamp;
  };

  // ── PollResult (public shape returned to frontend) ────────────────────────
  public type PollOptionResult = {
    optionId   : Nat;
    optionText : Text;
    voteCount  : Nat;
    votedByMe  : Bool;
  };

  public type PollResult = {
    pollId   : Nat;
    question : Text;
    options  : [PollOptionResult];
  };

  // ── Announcement with poll result (for list endpoint) ────────────────────
  public type AnnouncementWithPoll = {
    announcement : AnnouncementPublic;
    poll         : ?PollResult;
  };

  // ── Hidden / dismissed announcements ─────────────────────────────────────
  public type HiddenAnnouncement = {
    userId         : UserId;
    announcementId : Nat;
  };

  // ── Notification ──────────────────────────────────────────────────────────
  public type Notification = {
    id        : Nat;
    userId    : UserId;
    title     : Text;
    message   : Text;
    link      : ?Text;
    isRead    : Bool;
    createdAt : Timestamp;
  };

  // Public shape (userId as Text)
  public type NotificationPublic = {
    id        : Nat;
    userId    : Text;
    title     : Text;
    message   : Text;
    link      : ?Text;
    isRead    : Bool;
    createdAt : Timestamp;
  };

  // ── Form ──────────────────────────────────────────────────────────────────
  public type FormCategory = { #General; #HR; #IT; #Finance; #Operations };

  public type Form = {
    id         : Nat;
    title      : Text;
    category   : FormCategory;
    filename   : Text;    // URL or Google Drive file ID
    uploadDate : Timestamp;
  };

  // ── Input types ───────────────────────────────────────────────────────────
  public type CreateAnnouncementInput = {
    title        : Text;
    body         : Text;
    category     : AnnouncementCategory;
    authorName   : Text;
    imageFile    : ?Storage.ExternalBlob;
    allowDownload: Bool;
  };

  public type UpdateAnnouncementInput = {
    id           : Nat;
    title        : Text;
    body         : Text;
    category     : AnnouncementCategory;
    imageFile    : ?Storage.ExternalBlob;
    allowDownload: Bool;
  };

  public type CreatePollInput = {
    announcementId : Nat;
    question       : Text;
    options        : [Text];
  };

  public type CreateNotificationInput = {
    userId  : UserId;
    title   : Text;
    message : Text;
    link    : ?Text;
  };

  public type CreateFormInput = {
    title    : Text;
    category : FormCategory;
    filename : Text;
  };

  public type UpdateFormInput = {
    id       : Nat;
    title    : Text;
    category : FormCategory;
    filename : Text;
  };

  // ── User role (used for access control) ──────────────────────────────────
  public type UserRole = { #GeneralStaff; #HRAdmin; #SuperAdmin; #ITAdmin };
};
