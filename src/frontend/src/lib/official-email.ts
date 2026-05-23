export const OFFICIAL_EMAIL_DOMAIN = "@bawjiasecommunitybank.com";
export const LEGACY_EMAIL_DOMAIN = "@bawjiasearearuralbank.com";
export const OFFICIAL_EMAIL_EXAMPLE = `you${OFFICIAL_EMAIL_DOMAIN}`;

export function normalizeOfficialEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getOfficialEmailValidationMessage(email: string) {
  const normalized = normalizeOfficialEmail(email);
  if (!normalized) return "Please enter your official email address.";
  if (normalized.endsWith(OFFICIAL_EMAIL_DOMAIN)) return null;
  if (normalized.endsWith(LEGACY_EMAIL_DOMAIN)) {
    return `Please use your new official email address ending in ${OFFICIAL_EMAIL_DOMAIN}.`;
  }
  return `Please use your official email address ending in ${OFFICIAL_EMAIL_DOMAIN}.`;
}
