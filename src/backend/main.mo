import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import Types "types/core-users-auth";
import CoreUsersAuthApi "mixins/core-users-auth-api";
import AnnouncementTypes "types/announcements-polls-notifications-forms";
import AnnouncementsApi "mixins/announcements-polls-notifications-forms-api";

actor {
  // Authorization state (managed by MixinAuthorization)
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Object storage (managed by MixinObjectStorage)
  include MixinObjectStorage();

  // Core users & auth state
  let users = List.empty<Types.UserInternal>();
  let auditLogs = List.empty<Types.AuditLog>();
  let nextAuditIdCounter : { var value : Nat } = { var value = 0 };
  let resetTokens = Map.empty<Text, (Principal, Int)>();

  include CoreUsersAuthApi(
    accessControlState,
    users,
    auditLogs,
    nextAuditIdCounter,
    resetTokens,
  );

  // Announcements / polls / notifications / forms state
  let nextIdCounter : { var value : Nat } = { var value = 0 };
  let announcements       = List.empty<AnnouncementTypes.Announcement>();
  let polls               = List.empty<AnnouncementTypes.Poll>();
  let pollOptions         = List.empty<AnnouncementTypes.PollOption>();
  let pollVotes           = List.empty<AnnouncementTypes.PollVote>();
  let hiddenAnnouncements = List.empty<AnnouncementTypes.HiddenAnnouncement>();
  let notifications       = List.empty<AnnouncementTypes.Notification>();
  let forms               = List.empty<AnnouncementTypes.Form>();

  include AnnouncementsApi(
    announcements,
    polls,
    pollOptions,
    pollVotes,
    hiddenAnnouncements,
    notifications,
    forms,
    nextIdCounter,
  );
};
