import Debug "mo:core/Debug";

module {
  /// Unique identifier (Text, auto-generated UUID-like)
  public type Id = Text;

  /// Unix epoch milliseconds
  public type Timestamp = Int;

  /// Principal as Text (caller identity)
  public type UserId = Text;
};
