import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Types "../types/it-support-tickets";

module {
  public type IncidentReport = Types.IncidentReport;
  public type ProfileAmendment = Types.ProfileAmendment;
  public type TicketCounts = Types.TicketCounts;
  public type SubmitIncidentArgs = Types.SubmitIncidentArgs;
  public type SubmitAmendmentArgs = Types.SubmitAmendmentArgs;
};

mixin (
  incidents : List.List<Types.IncidentReport>,
  amendments : List.List<Types.ProfileAmendment>,
  nextIncidentId : { var value : Nat },
  nextAmendmentId : { var value : Nat },
  auditLog : List.List<Text>,
) {
  /// Submit an IT incident report (any authenticated user)
  public shared ({ caller }) func submitIncidentReport(args : Types.SubmitIncidentArgs) : async Types.IncidentReport {
    Runtime.trap("not implemented");
  };

  /// Submit a profile amendment request (any authenticated user)
  public shared ({ caller }) func submitProfileAmendment(args : Types.SubmitAmendmentArgs) : async Types.ProfileAmendment {
    Runtime.trap("not implemented");
  };

  /// Get all incident reports, ordered by status then date (IT/Super Admin only)
  public shared ({ caller }) func getIncidentReports() : async [Types.IncidentReport] {
    Runtime.trap("not implemented");
  };

  /// Get all profile amendment requests, ordered by status then date (IT/Super Admin only)
  public shared ({ caller }) func getProfileAmendments() : async [Types.ProfileAmendment] {
    Runtime.trap("not implemented");
  };

  /// Resolve an incident report (IT/Super Admin only)
  public shared ({ caller }) func resolveIncidentReport(id : Types.TicketId) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Resolve a profile amendment request (IT/Super Admin only)
  public shared ({ caller }) func resolveProfileAmendment(id : Types.TicketId) : async Bool {
    Runtime.trap("not implemented");
  };

  /// Delete resolved incidents — pass null to delete ALL resolved, or specific ids (IT/Super Admin only)
  public shared ({ caller }) func deleteResolvedIncidents(ids : ?[Types.TicketId]) : async Nat {
    Runtime.trap("not implemented");
  };

  /// Delete resolved amendments — pass null to delete ALL resolved, or specific ids (IT/Super Admin only)
  public shared ({ caller }) func deleteResolvedAmendments(ids : ?[Types.TicketId]) : async Nat {
    Runtime.trap("not implemented");
  };

  /// Get open ticket counts for dashboard stats (any authenticated user)
  public query ({ caller }) func getTicketCounts() : async Types.TicketCounts {
    Runtime.trap("not implemented");
  };

  /// Export incidents as CSV text (IT/HR/Super Admin only)
  public shared ({ caller }) func exportIncidentsCsv() : async Text {
    Runtime.trap("not implemented");
  };

  /// Export amendments as CSV text (IT/HR/Super Admin only)
  public shared ({ caller }) func exportAmendmentsCsv() : async Text {
    Runtime.trap("not implemented");
  };
};
