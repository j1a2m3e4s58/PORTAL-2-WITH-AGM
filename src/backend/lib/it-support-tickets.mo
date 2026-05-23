import List "mo:core/List";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Types "../types/it-support-tickets";

module {
  public type IncidentReport = Types.IncidentReport;
  public type ProfileAmendment = Types.ProfileAmendment;
  public type TicketStatus = Types.TicketStatus;
  public type TicketCounts = Types.TicketCounts;

  public func submitIncident(
    incidents : List.List<IncidentReport>,
    nextId : Nat,
    args : Types.SubmitIncidentArgs,
    caller : Principal,
  ) : IncidentReport {
    Runtime.trap("not implemented");
  };

  public func submitAmendment(
    amendments : List.List<ProfileAmendment>,
    nextId : Nat,
    args : Types.SubmitAmendmentArgs,
    caller : Principal,
  ) : ProfileAmendment {
    Runtime.trap("not implemented");
  };

  public func getAllIncidents(incidents : List.List<IncidentReport>) : [IncidentReport] {
    Runtime.trap("not implemented");
  };

  public func getAllAmendments(amendments : List.List<ProfileAmendment>) : [ProfileAmendment] {
    Runtime.trap("not implemented");
  };

  public func resolveIncident(
    incidents : List.List<IncidentReport>,
    ticketId : Types.TicketId,
  ) : Bool {
    Runtime.trap("not implemented");
  };

  public func resolveAmendment(
    amendments : List.List<ProfileAmendment>,
    ticketId : Types.TicketId,
  ) : Bool {
    Runtime.trap("not implemented");
  };

  public func deleteResolvedIncidents(
    incidents : List.List<IncidentReport>,
    ids : ?[Types.TicketId],
  ) : Nat {
    Runtime.trap("not implemented");
  };

  public func deleteResolvedAmendments(
    amendments : List.List<ProfileAmendment>,
    ids : ?[Types.TicketId],
  ) : Nat {
    Runtime.trap("not implemented");
  };

  public func getTicketCounts(
    incidents : List.List<IncidentReport>,
    amendments : List.List<ProfileAmendment>,
  ) : TicketCounts {
    Runtime.trap("not implemented");
  };

  public func exportIncidentsAsCsv(incidents : List.List<IncidentReport>) : Text {
    Runtime.trap("not implemented");
  };

  public func exportAmendmentsAsCsv(amendments : List.List<ProfileAmendment>) : Text {
    Runtime.trap("not implemented");
  };
};
