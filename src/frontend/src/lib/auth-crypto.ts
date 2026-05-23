// Password hashing now happens on the server using a secure password hasher.
// We keep this helper so existing UI call sites can continue passing credentials
// through one function before submitting over HTTPS.
export function hashPassword(password: string) {
  return password;
}
