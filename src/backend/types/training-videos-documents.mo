import Time "mo:core/Time";
import Storage "mo:caffeineai-object-storage/Storage";

module {

  // ── Visibility & Storage variants ───────────────────────────────────────────
  public type Visibility   = { #General; #Department };
  public type StorageType  = { #Drive; #Local };

  // ── TrainingVideo ────────────────────────────────────────────────────────────
  public type TrainingVideo = {
    id             : Nat;
    title          : Text;
    description    : Text;
    visibility     : Visibility;
    department     : Text;           // relevant when visibility = #Department
    driveRef       : Text;           // Google Drive file ID (empty when Local)
    storageType    : StorageType;
    localFileKey   : Storage.ExternalBlob; // valid when storageType = #Local
    mandatory      : Bool;
    allowDownload  : Bool;
    uploadedBy     : Principal;
    uploadedByDept : Text;
    isArchived     : Bool;
    uploadDate     : Time.Time;
  };

  // ── TrainingWatchLog ─────────────────────────────────────────────────────────
  public type TrainingWatchLog = {
    userId    : Principal;
    videoId   : Nat;
    watchedAt : Time.Time;
  };

  // ── TrainingStrictProgress ───────────────────────────────────────────────────
  public type TrainingStrictProgress = {
    userId          : Principal;
    videoId         : Nat;
    var maxSeconds  : Nat;     // highest position reached
    durationSeconds : Nat;     // total video duration
    var completed   : Bool;
    var updatedAt   : Time.Time;
  };

  // Immutable public view (no var fields allowed across API boundary)
  public type TrainingStrictProgressView = {
    userId          : Principal;
    videoId         : Nat;
    maxSeconds      : Nat;
    durationSeconds : Nat;
    completed       : Bool;
    updatedAt       : Time.Time;
  };

  // ── TrainingDocument ─────────────────────────────────────────────────────────
  public type TrainingDocument = {
    id             : Nat;
    title          : Text;
    description    : Text;
    visibility     : Visibility;
    department     : Text;
    storageType    : StorageType;
    driveRef       : Text;
    localFileKey   : Storage.ExternalBlob;
    mandatory      : Bool;
    allowDownload  : Bool;
    uploadedBy     : Principal;
    uploadedByDept : Text;
    isArchived     : Bool;
    uploadDate     : Time.Time;
  };

  // ── TrainingDocumentViewLog ──────────────────────────────────────────────────
  public type TrainingDocumentViewLog = {
    userId     : Principal;
    documentId : Nat;
    opened     : Bool;
    openedAt   : Time.Time;
  };

  // ── Input types (for upload) ─────────────────────────────────────────────────
  public type UploadVideoInput = {
    title          : Text;
    description    : Text;
    visibility     : Visibility;
    department     : Text;
    driveRef       : Text;
    storageType    : StorageType;
    localFileKey   : Storage.ExternalBlob;
    mandatory      : Bool;
    allowDownload  : Bool;
    uploadedByDept : Text;
    durationSeconds: Nat;
  };

  public type UploadDocumentInput = {
    title          : Text;
    description    : Text;
    visibility     : Visibility;
    department     : Text;
    storageType    : StorageType;
    driveRef       : Text;
    localFileKey   : Storage.ExternalBlob;
    mandatory      : Bool;
    allowDownload  : Bool;
    uploadedByDept : Text;
  };

  // ── Stats / overview types ───────────────────────────────────────────────────
  public type VideoStats = {
    videoId              : Nat;
    eligibleCount        : Nat;
    watchedCount         : Nat;
    completionPercent    : Nat;
    mandatoryIncomplete  : [Principal];
  };

  public type DocumentStats = {
    documentId           : Nat;
    eligibleCount        : Nat;
    openedCount          : Nat;
    openedPercent        : Nat;
    mandatoryIncomplete  : [Principal];
  };

  public type VideoOverview = {
    video : TrainingVideo;
    stats : VideoStats;
  };

  public type DocumentOverview = {
    document : TrainingDocument;
    stats    : DocumentStats;
  };

  public type TrainingOverview = {
    videos    : [VideoOverview];
    documents : [DocumentOverview];
  };

  // ── Progress update input ────────────────────────────────────────────────────
  public type ProgressInput = {
    videoId        : Nat;
    currentSeconds : Nat;
    totalSeconds   : Nat;
  };
};
