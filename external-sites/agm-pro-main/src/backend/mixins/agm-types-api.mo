import Debug "mo:core/Debug";
import Types "../types/agm-types";

/// Placeholder mixin — the agm-types domain only defines types.
/// No public endpoints are exposed from this mixin.
/// Concrete domain mixins (shareholders-api, registrations-api, etc.)
/// will import from types/agm-types.mo directly.
mixin () {
};
