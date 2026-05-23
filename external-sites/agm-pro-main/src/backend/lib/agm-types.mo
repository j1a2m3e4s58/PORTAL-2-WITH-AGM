import Debug "mo:core/Debug";
import Types "../types/agm-types";

module {

  /// Placeholder — domain logic lives in specialised lib modules.
  /// This file exists to satisfy the multi-file contract requirement
  /// for the agm-types domain; it re-exports the type module.

  public type Shareholder = Types.Shareholder;
  public type ShareholderStatus = Types.ShareholderStatus;
  public type Registration = Types.Registration;
  public type RegistrationType = Types.RegistrationType;
  public type CheckIn = Types.CheckIn;
  public type CheckInMethod = Types.CheckInMethod;
  public type AppUser = Types.AppUser;
  public type UserRole = Types.UserRole;
  public type AuditEntry = Types.AuditEntry;
  public type ImportBatch = Types.ImportBatch;
  public type ImportStatus = Types.ImportStatus;
  public type ColumnMapping = Types.ColumnMapping;
  public type AGMSettings = Types.AGMSettings;
  public type DashboardMetrics = Types.DashboardMetrics;

};
