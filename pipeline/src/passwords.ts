/**
 * Password hashing for the LAN password-login feature (issue #46). Uses Node's built-in
 * `node:crypto` scrypt rather than argon2/bcrypt -- this app's threat model is a trusted LAN with
 * no internet exposure by design (defending against a casual guess, not an offline GPU-cracking
 * farm against an exfiltrated database), so the stronger memory-hard guarantees argon2 buys aren't
 * worth a new native/WASM dependency here. Kept as its own module, separate from db.ts, so the
 * storage layer stays free of crypto concerns -- db.ts only ever sees the opaque stored string.
 *
 * Stored format is self-describing so the algorithm/cost parameters can change later without a
 * second schema migration: `scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>`.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const ALGO = "scrypt";
// Node's own documented scrypt defaults (see the node:crypto docs' scrypt example) -- N=16384 is
// the recommended minimum work factor as of 2026, appropriate for a small embedded app, not a
// high-value target needing a larger N at the cost of real request latency.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 8;

/** Issue #62: a one-time temporary password for an admin-provisioned account, emailed to the new
 *  user via `mailer.ts`'s `sendAdminCreatedAccountEmail()`. 9 random bytes, base64url-encoded, is
 *  12 URL-safe characters -- comfortably over `MIN_PASSWORD_LENGTH` and copy-paste-friendly (no
 *  `+`/`/` to mangle in an email client), unlike the hex tokens used elsewhere in this app for
 *  session/reset tokens, which are meant to be clicked as part of a URL, not typed/pasted as a
 *  password. */
export function generateTemporaryPassword(): string {
  return randomBytes(9).toString("base64url");
}

/** Hashes `plain` with a fresh random salt, returning the full self-describing stored string. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(plain, salt, KEYLEN, { N, r: R, p: P });
  return `${ALGO}$${N}$${R}$${P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Verifies `plain` against a stored hash produced by `hashPassword()`. Returns `false` (never
 *  throws) for a malformed stored value -- that's a data-integrity bug, not a reason to 500 a
 *  login attempt. Uses `timingSafeEqual` on the derived key bytes, never `===`/string comparison,
 *  so a wrong-length or wrong-content guess can't be distinguished by response timing. */
export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== ALGO) return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  if (saltHex === undefined || hashHex === undefined) return false;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = scryptSync(plain, salt, expected.length, { N: n, r, p });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
