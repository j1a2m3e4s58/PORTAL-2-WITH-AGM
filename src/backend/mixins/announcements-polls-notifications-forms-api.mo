import Types "../types/announcements-polls-notifications-forms";
import Lib   "../lib/announcements-polls-notifications-forms";
import List  "mo:core/List";
import Runtime "mo:core/Runtime";
import Storage "mo:caffeineai-object-storage/Storage";

// Mixin: exposes all public API methods for announcements, polls,
//        notifications, and forms.
mixin (
  announcements       : List.List<Types.Announcement>,
  polls               : List.List<Types.Poll>,
  pollOptions         : List.List<Types.PollOption>,
  pollVotes           : List.List<Types.PollVote>,
  hiddenAnnouncements : List.List<Types.HiddenAnnouncement>,
  notifications       : List.List<Types.Notification>,
  forms               : List.List<Types.Form>,
  nextIdCounter       : { var value : Nat }
) {

  // ── Announcements ─────────────────────────────────────────────────────────

  /// Returns active (non-deleted, non-hidden) announcements for the caller,
  /// each enriched with poll result and the caller's vote status.
  public shared query ({ caller }) func getAnnouncements() : async [Types.AnnouncementWithPoll] {
    Runtime.trap("not implemented");
  };

  /// Returns all soft-deleted announcements (trash view). Admin only.
  public shared query ({ caller }) func getTrashedAnnouncements() : async [Types.AnnouncementPublic] {
    Runtime.trap("not implemented");
  };

  /// Creates a new announcement. IT / HR / Super Admin only.
  /// Category auto-derived: HR if HR poster, otherwise IT.
  public shared ({ caller }) func createAnnouncement(
    input : Types.CreateAnnouncementInput
  ) : async Types.AnnouncementPublic {
    Runtime.trap("not implemented");
  };

  /// Updates an existing announcement. Admin only.
  public shared ({ caller }) func updateAnnouncement(
    input : Types.UpdateAnnouncementInput
  ) : async ?Types.AnnouncementPublic {
    Runtime.trap("not implemented");
  };

  /// Soft-deletes (moves to trash) an announcement. Admin only.
  public shared ({ caller }) func deleteAnnouncement(id : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Restores a soft-deleted announcement from trash. Admin only.
  public shared ({ caller }) func restoreAnnouncement(id : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Permanently removes an announcement (must already be soft-deleted). Admin only.
  public shared ({ caller }) func permanentDeleteAnnouncement(id : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Dismisses / hides an announcement for the calling user only.
  public shared ({ caller }) func hideAnnouncement(announcementId : Nat) : async () {
    Runtime.trap("not implemented");
  };

  /// Logs a download action for an announcement.
  public shared ({ caller }) func logAnnouncementDownload(announcementId : Nat) : async () {
    Runtime.trap("not implemented");
  };

  // ── Polls ─────────────────────────────────────────────────────────────────

  /// Attaches a poll to an announcement. Admin only.
  public shared ({ caller }) func createPoll(
    input : Types.CreatePollInput
  ) : async Types.Poll {
    Runtime.trap("not implemented");
  };

  /// Returns poll results (option counts + whether caller voted) for an announcement.
  public shared query ({ caller }) func getPollResult(
    announcementId : Nat
  ) : async ?Types.PollResult {
    Runtime.trap("not implemented");
  };

  /// Casts a vote on a poll option. One vote per user per poll; replaces prior vote.
  public shared ({ caller }) func vote(pollId : Nat, optionId : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  // ── Notifications ─────────────────────────────────────────────────────────

  /// Returns all notifications for the calling user, sorted newest-first.
  public shared query ({ caller }) func getNotifications() : async [Types.NotificationPublic] {
    Runtime.trap("not implemented");
  };

  /// Returns the count of unread notifications for the calling user.
  public shared query ({ caller }) func getUnreadNotificationCount() : async Nat {
    Runtime.trap("not implemented");
  };

  /// Marks a single notification as read. Caller must own the notification.
  public shared ({ caller }) func markNotificationRead(id : Nat) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Marks all of the calling user's notifications as read.
  public shared ({ caller }) func markAllNotificationsRead() : async () {
    Runtime.trap("not implemented");
  };

  /// Creates a notification for a target user. Admin / system use only.
  public shared ({ caller }) func createNotification(
    input : Types.CreateNotificationInput
  ) : async Types.NotificationPublic {
    Runtime.trap("not implemented");
  };

  // ── Forms ─────────────────────────────────────────────────────────────────

  /// Returns forms visible to the caller based on role and department.
  /// IT / HR / Super Admin see all; General Staff see General, HR, own dept.
  public shared query ({ caller }) func getForms() : async [Types.Form] {
    Runtime.trap("not implemented");
  };

  /// Creates a new form entry. Admin only.
  public shared ({ caller }) func createForm(
    input : Types.CreateFormInput
  ) : async Types.Form {
    Runtime.trap("not implemented");
  };

  /// Updates an existing form entry. Admin only.
  public shared ({ caller }) func updateForm(
    input : Types.UpdateFormInput
  ) : async ?Types.Form {
    Runtime.trap("not implemented");
  };

  /// Deletes a form entry. Admin only.
  public shared ({ caller }) func deleteForm(id : Nat) : async Bool {
    Runtime.trap("not implemented");
  };
};
