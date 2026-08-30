/**
 * Client for the `/api/admin/*` routes (issue #62), following `session.ts`'s existing
 * typed-result-union + try/catch-network-error pattern. Every route this talks to is
 * `requireSession, requireAdmin`-gated server-side — a 403 here just means the caller's session
 * lost admin rights since the page loaded (e.g. another admin just demoted them), not a bug in
 * this client.
 */

export type UserRole = "user" | "admin";

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  role: UserRole;
  hasPassword: boolean;
  mustChangePassword: boolean;
  sessionCount: number;
}

export type AdminResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function parseError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

export async function listUsers(): Promise<AdminResult<AdminUser[]>> {
  try {
    const res = await fetch("/api/admin/users");
    if (!res.ok) return { ok: false, error: await parseError(res, `Failed (${res.status}).`) };
    const body = (await res.json()) as { users: AdminUser[] };
    return { ok: true, data: body.users };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

export interface CreatedUser {
  user: { id: number; email: string; name: string; role: UserRole };
  tempPassword: string;
  emailSent: boolean;
}

/** `tempPassword` is always returned, even when `emailSent` is `true` — a manual fallback the
 *  admin can relay themselves if delivery fails or SMTP isn't configured (see
 *  `sendAdminCreatedAccountEmail()`'s own doc comment; this action is authenticated/admin-only,
 *  not the enumeration-sensitive forgot-password flow, so revealing it here is safe). */
export async function createUser(email: string, name: string): Promise<AdminResult<CreatedUser>> {
  try {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) return { ok: false, error: await parseError(res, `Failed (${res.status}).`) };
    const data = (await res.json()) as CreatedUser;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

export async function deleteUser(id: number): Promise<AdminResult> {
  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) return { ok: false, error: await parseError(res, `Failed (${res.status}).`) };
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

export async function setUserRole(id: number, role: UserRole): Promise<AdminResult> {
  try {
    const res = await fetch(`/api/admin/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) return { ok: false, error: await parseError(res, `Failed (${res.status}).`) };
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
