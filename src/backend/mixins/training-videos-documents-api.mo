import Types      "../types/training-videos-documents";
import TrainingLib "../lib/training-videos-documents";
import List        "mo:core/List";
import Map         "mo:core/Map";
import Runtime     "mo:core/Runtime";

mixin (
  videos      : List.List<Types.TrainingVideo>,
  documents   : List.List<Types.TrainingDocument>,
  watchLogs   : List.List<Types.TrainingWatchLog>,
  viewLogs    : List.List<Types.TrainingDocumentViewLog>,
  progressMap : Map.Map<(Principal, Nat), Types.TrainingStrictProgress>,
  nextVideoId : Nat,
  nextDocId   : Nat,
  // Caller's role/department lookup — injected from auth mixin state
  getRoleOf   : (Principal) -> Text,
  getDeptOf   : (Principal) -> Text,
  allUsers    : List.List<Principal>,
) {

  // ── Videos ───────────────────────────────────────────────────────────────────

  /// List all videos visible to the authenticated caller.
  public shared query ({ caller }) func getTrainingVideos() : async [Types.TrainingVideo] {
    Runtime.trap("not implemented");
  };

  /// Get details of a single video.
  public shared query ({ caller }) func getTrainingVideo(videoId : Nat) : async ?Types.TrainingVideo {
    Runtime.trap("not implemented");
  };

  /// Upload a new training video (IT / HR / Super Admin only).
  public shared ({ caller }) func uploadTrainingVideo(input : Types.UploadVideoInput) : async Nat {
    Runtime.trap("not implemented");
  };

  /// Update watch progress for the authenticated user.
  public shared ({ caller }) func updateTrainingProgress(input : Types.ProgressInput) : async Types.TrainingStrictProgressView {
    Runtime.trap("not implemented");
  };

  /// Get the caller's progress for a specific video.
  public shared query ({ caller }) func getMyVideoProgress(videoId : Nat) : async ?Types.TrainingStrictProgressView {
    Runtime.trap("not implemented");
  };

  /// Get watch statistics for a video (admin only).
  public shared query ({ caller }) func getVideoWatchStats(videoId : Nat) : async Types.VideoStats {
    Runtime.trap("not implemented");
  };

  /// Archive a video (admin only).
  public shared ({ caller }) func archiveTrainingVideo(videoId : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Restore an archived video (admin only).
  public shared ({ caller }) func restoreTrainingVideo(videoId : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Permanently delete a video (admin only).
  public shared ({ caller }) func deleteTrainingVideo(videoId : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Send training reminder to users who have not completed a mandatory video (admin only).
  public shared ({ caller }) func sendVideoTrainingReminder(videoId : Nat) : async Nat {
    Runtime.trap("not implemented");
  };

  // ── Documents ────────────────────────────────────────────────────────────────

  /// List all documents visible to the authenticated caller.
  public shared query ({ caller }) func getTrainingDocuments() : async [Types.TrainingDocument] {
    Runtime.trap("not implemented");
  };

  /// Get details of a single document.
  public shared query ({ caller }) func getTrainingDocument(documentId : Nat) : async ?Types.TrainingDocument {
    Runtime.trap("not implemented");
  };

  /// Upload a new training document (admin only).
  public shared ({ caller }) func uploadTrainingDocument(input : Types.UploadDocumentInput) : async Nat {
    Runtime.trap("not implemented");
  };

  /// Record that the caller has opened a document.
  public shared ({ caller }) func markTrainingDocumentOpened(documentId : Nat) : async () {
    Runtime.trap("not implemented");
  };

  /// Get view statistics for a document (admin only).
  public shared query ({ caller }) func getDocumentViewStats(documentId : Nat) : async Types.DocumentStats {
    Runtime.trap("not implemented");
  };

  /// Archive a document (admin only).
  public shared ({ caller }) func archiveTrainingDocument(documentId : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Restore an archived document (admin only).
  public shared ({ caller }) func restoreTrainingDocument(documentId : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Permanently delete a document (admin only).
  public shared ({ caller }) func deleteTrainingDocument(documentId : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  // ── Admin overview ───────────────────────────────────────────────────────────

  /// Return a full overview of all training content with stats (admin only).
  public shared query ({ caller }) func getAdminTrainingOverview() : async Types.TrainingOverview {
    Runtime.trap("not implemented");
  };
};
