import Types   "../types/training-videos-documents";
import List    "mo:core/List";
import Map     "mo:core/Map";
import Runtime "mo:core/Runtime";

module {

  // ── Video CRUD ───────────────────────────────────────────────────────────────

  /// Return all non-archived videos visible to the given user principal
  /// according to their role and department.
  public func getVideosForUser(
    videos     : List.List<Types.TrainingVideo>,
    caller     : Principal,
    role       : Text,
    department : Text,
  ) : [Types.TrainingVideo] {
    Runtime.trap("not implemented");
  };

  /// Return a single video by ID (ignores archive status — admin may fetch archived).
  public func getVideo(
    videos  : List.List<Types.TrainingVideo>,
    videoId : Nat,
  ) : ?Types.TrainingVideo {
    Runtime.trap("not implemented");
  };

  /// Persist a new video; returns the assigned ID.
  public func uploadVideo(
    videos    : List.List<Types.TrainingVideo>,
    nextId    : Nat,
    input     : Types.UploadVideoInput,
    uploader  : Principal,
    uploadDate: Int,
  ) : Nat {
    Runtime.trap("not implemented");
  };

  /// Archive (soft-delete) a video.
  public func archiveVideo(
    videos  : List.List<Types.TrainingVideo>,
    videoId : Nat,
  ) : Bool {
    Runtime.trap("not implemented");
  };

  /// Restore an archived video.
  public func restoreVideo(
    videos  : List.List<Types.TrainingVideo>,
    videoId : Nat,
  ) : Bool {
    Runtime.trap("not implemented");
  };

  /// Permanently remove a video from the list; returns true if found.
  public func deleteVideo(
    videos  : List.List<Types.TrainingVideo>,
    videoId : Nat,
  ) : Bool {
    Runtime.trap("not implemented");
  };

  // ── Progress tracking ────────────────────────────────────────────────────────

  /// Upsert a progress record; marks complete when >= 98 % and duration >= 30 s.
  public func updateProgress(
    progressMap : Map.Map<(Principal, Nat), Types.TrainingStrictProgress>,
    watchLogs   : List.List<Types.TrainingWatchLog>,
    caller      : Principal,
    input       : Types.ProgressInput,
    now         : Int,
  ) : Types.TrainingStrictProgressView {
    Runtime.trap("not implemented");
  };

  /// Return the current progress record for a user/video pair.
  public func getProgress(
    progressMap : Map.Map<(Principal, Nat), Types.TrainingStrictProgress>,
    caller      : Principal,
    videoId     : Nat,
  ) : ?Types.TrainingStrictProgressView {
    Runtime.trap("not implemented");
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  /// Compute watch stats for a video (admin view).
  public func getVideoStats(
    videos      : List.List<Types.TrainingVideo>,
    progressMap : Map.Map<(Principal, Nat), Types.TrainingStrictProgress>,
    allUsers    : [Principal],
    userDeptOf  : (Principal) -> Text,
    videoId     : Nat,
  ) : Types.VideoStats {
    Runtime.trap("not implemented");
  };

  /// List principals who have not completed a mandatory video.
  public func getMandatoryIncompleteUsers(
    progressMap : Map.Map<(Principal, Nat), Types.TrainingStrictProgress>,
    eligibles   : [Principal],
    videoId     : Nat,
  ) : [Principal] {
    Runtime.trap("not implemented");
  };

  // ── Document CRUD ────────────────────────────────────────────────────────────

  /// Return all non-archived documents visible to the caller.
  public func getDocumentsForUser(
    documents  : List.List<Types.TrainingDocument>,
    caller     : Principal,
    role       : Text,
    department : Text,
  ) : [Types.TrainingDocument] {
    Runtime.trap("not implemented");
  };

  /// Return a single document by ID.
  public func getDocument(
    documents  : List.List<Types.TrainingDocument>,
    documentId : Nat,
  ) : ?Types.TrainingDocument {
    Runtime.trap("not implemented");
  };

  /// Persist a new document; returns the assigned ID.
  public func uploadDocument(
    documents  : List.List<Types.TrainingDocument>,
    nextId     : Nat,
    input      : Types.UploadDocumentInput,
    uploader   : Principal,
    uploadDate : Int,
  ) : Nat {
    Runtime.trap("not implemented");
  };

  /// Archive a document.
  public func archiveDocument(
    documents  : List.List<Types.TrainingDocument>,
    documentId : Nat,
  ) : Bool {
    Runtime.trap("not implemented");
  };

  /// Restore an archived document.
  public func restoreDocument(
    documents  : List.List<Types.TrainingDocument>,
    documentId : Nat,
  ) : Bool {
    Runtime.trap("not implemented");
  };

  /// Permanently delete a document.
  public func deleteDocument(
    documents  : List.List<Types.TrainingDocument>,
    documentId : Nat,
  ) : Bool {
    Runtime.trap("not implemented");
  };

  // ── Document view log ────────────────────────────────────────────────────────

  /// Record that a user has opened a document (idempotent: one log per user/doc).
  public func markDocumentOpened(
    viewLogs   : List.List<Types.TrainingDocumentViewLog>,
    caller     : Principal,
    documentId : Nat,
    now        : Int,
  ) {
    Runtime.trap("not implemented");
  };

  // ── Document stats ───────────────────────────────────────────────────────────

  /// Compute view stats for a document (admin view).
  public func getDocumentStats(
    documents  : List.List<Types.TrainingDocument>,
    viewLogs   : List.List<Types.TrainingDocumentViewLog>,
    allUsers   : [Principal],
    userDeptOf : (Principal) -> Text,
    documentId : Nat,
  ) : Types.DocumentStats {
    Runtime.trap("not implemented");
  };

  // ── Training overview (admin) ────────────────────────────────────────────────

  /// Return a full overview combining all videos + documents with their stats.
  public func getTrainingOverview(
    videos      : List.List<Types.TrainingVideo>,
    documents   : List.List<Types.TrainingDocument>,
    progressMap : Map.Map<(Principal, Nat), Types.TrainingStrictProgress>,
    viewLogs    : List.List<Types.TrainingDocumentViewLog>,
    allUsers    : [Principal],
    userDeptOf  : (Principal) -> Text,
  ) : Types.TrainingOverview {
    Runtime.trap("not implemented");
  };
};
