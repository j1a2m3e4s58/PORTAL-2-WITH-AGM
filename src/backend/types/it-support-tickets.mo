import Time "mo:core/Time";
import Principal "mo:core/Principal";

module {
  public type TicketId = Nat;
  public type TicketStatus = { #Open; #Resolved };

  public type IncidentReport = {
    id : TicketId;
    agency : Text;
    issueCategory : Text;
    description : Text;
    reporterName : Text;
    contact : Text;
    status : TicketStatus;
    dateSubmitted : Time.Time;
    submittedBy : Principal;
  };

  public type ProfileAmendment = {
    id : TicketId;
    fullname : Text;
    phone : Text;
    t24Username : Text;
    agency : Text;
    requestType : Text;
    newRole : Text;
    deptChange : Text;
    transferLocation : Text;
    status : TicketStatus;
    dateSubmitted : Time.Time;
    submittedBy : Principal;
  };

  public type SubmitIncidentArgs = {
    agency : Text;
    issueCategory : Text;
    description : Text;
    reporterName : Text;
    contact : Text;
  };

  public type SubmitAmendmentArgs = {
    fullname : Text;
    phone : Text;
    t24Username : Text;
    agency : Text;
    requestType : Text;
    newRole : Text;
    deptChange : Text;
    transferLocation : Text;
  };

  public type TicketCounts = {
    openIncidents : Nat;
    openAmendments : Nat;
  };
};
