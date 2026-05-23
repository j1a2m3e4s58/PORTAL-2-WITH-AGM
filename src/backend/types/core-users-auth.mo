import Storage "mo:caffeineai-object-storage/Storage";

module {
  public type Role = {
    #GeneralStaff;
    #HRAdmin;
    #SuperAdmin;
  };

  public type Department = {
    #IT;
    #HR;
    #HeadOffice;
    #Bawjiase;
    #KasoaMain;
    #KasoaNewMarket;
    #Adeiso;
    #Ofaakor;
    #BankingOperations;
    #EBanking;
    #Microfinance;
    #Credit;
    #Recovery;
    #Susu;
    #Compliance;
    #Audit;
    #Admin;
  };

  public type Branch = {
    #HeadOffice;
    #Bawjiase;
    #Adeiso;
    #Ofaakor;
    #KasoaNewMarket;
    #KasoaMain;
  };

  // Internal user type (mutable fields for updates)
  public type UserInternal = {
    id : Principal;
    var fullname : Text;
    var phone : Text;
    email : Text;
    var passwordHash : Text;
    var role : Role;
    var position : Text;
    var department : Department;
    var branch : Branch;
    var imageFile : ?Storage.ExternalBlob;
    var isActive : Bool;
    var isVerified : Bool;
    var verificationCode : ?Text;
    var lastSeen : Int;
    registrationTime : Int;
    var isArchived : Bool;
    var passwordResetToken : ?Text;
    var passwordResetExpiry : ?Int;
  };

  // Public-facing user type (immutable, shareable)
  public type User = {
    id : Principal;
    fullname : Text;
    phone : Text;
    email : Text;
    role : Role;
    position : Text;
    department : Department;
    branch : Branch;
    imageFile : ?Blob;
    isActive : Bool;
    isVerified : Bool;
    lastSeen : Int;
    registrationTime : Int;
    isArchived : Bool;
  };

  public type RegisterRequest = {
    fullname : Text;
    phone : Text;
    email : Text;
    passwordHash : Text;
    position : Text;
    department : Department;
    branch : Branch;
    accessCode : ?Text;
  };

  public type UpdateProfileRequest = {
    fullname : ?Text;
    phone : ?Text;
    imageFile : ?Storage.ExternalBlob;
  };

  public type UpdateStaffRequest = {
    department : ?Department;
    branch : ?Branch;
    position : ?Text;
    role : ?Role;
  };

  public type StaffStats = {
    activeCount : Nat;
    branchesWithStaff : Nat;
    archivedCount : Nat;
  };

  public type AuditLog = {
    id : Nat;
    actorName : Text;
    action : Text;
    target : Text;
    ipAddress : Text;
    timestamp : Int;
  };
};
