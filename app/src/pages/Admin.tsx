/**
 * Admin user management (issue #62) — list every account, add one (temp password emailed via the
 * same SMTP config #59 added), change roles, remove accounts. `requireAdmin` on the server is the
 * real gate; the `role !== "admin"` redirect below is UX only, so a non-admin who somehow lands
 * here (a stale bookmark after being demoted) doesn't see a flash of admin content before the
 * server rejects their first `/api/admin/*` call.
 *
 * Follows Setup.tsx's page conventions: inline `style` objects, `cardStyle`/`kicker` consts, no
 * CSS files, plain `useState`/`useEffect` for this page's own data (no shared store needed —
 * nothing else in the app reads the user list).
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSessionUser } from "../lib/session";
import { createUser, deleteUser, listUsers, setUserRole, type AdminUser, type CreatedUser } from "../lib/admin";

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--radius-card)",
  padding: 20,
};

const kicker: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
};

const inputStyle: React.CSSProperties = {
  boxSizing: "border-box",
  background: "var(--raised)",
  border: "1px solid var(--hairline)",
  borderRadius: 6,
  color: "var(--text-body)",
  fontSize: 13,
  padding: "8px 10px",
  minHeight: 36,
};

const buttonStyle: React.CSSProperties = {
  fontSize: 12,
  border: "1px solid var(--hairline)",
  borderRadius: 4,
  padding: "4px 10px",
  background: "transparent",
  color: "var(--text-body)",
  cursor: "pointer",
};

function statusLabel(u: AdminUser): string {
  if (!u.hasPassword) return "no password (legacy)";
  if (u.mustChangePassword) return "pending first login";
  return "active";
}

export function Admin() {
  const sessionUser = useSessionUser();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<number | null>(null);

  async function refresh() {
    const result = await listUsers();
    if (result.ok) {
      setUsers(result.data);
      setListError(null);
    } else {
      setListError(result.error);
    }
  }

  useEffect(() => {
    if (sessionUser?.role === "admin") void refresh();
  }, [sessionUser?.role]);

  if (sessionUser && sessionUser.role !== "admin") return <Navigate to="/" replace />;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreateError(null);
    setCreating(true);
    const result = await createUser(newEmail.trim(), newName.trim());
    setCreating(false);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    setCreated(result.data);
    setNewEmail("");
    setNewName("");
    await refresh();
  }

  async function handleRoleChange(user: AdminUser, role: "user" | "admin") {
    setRowError(null);
    const result = await setUserRole(user.id, role);
    if (!result.ok) {
      setRowError(result.error);
      return;
    }
    await refresh();
  }

  async function handleRemove(user: AdminUser) {
    if (confirmingRemoveId !== user.id) {
      setConfirmingRemoveId(user.id);
      setTimeout(() => setConfirmingRemoveId((id) => (id === user.id ? null : id)), 4000);
      return;
    }
    setConfirmingRemoveId(null);
    setRowError(null);
    const result = await deleteUser(user.id);
    if (!result.ok) {
      setRowError(result.error);
      return;
    }
    await refresh();
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>
        Admin
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px", maxWidth: "50em" }}>
        Manage who can sign in and who else has admin access.
      </p>

      <div style={{ ...kicker, marginBottom: 12 }}>Add a user</div>
      <form onSubmit={handleCreate} style={{ ...cardStyle, marginBottom: 24, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }} htmlFor="admin-new-email">
            Email
          </label>
          <input
            id="admin-new-email"
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="person@example.com"
            style={{ ...inputStyle, width: 220 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }} htmlFor="admin-new-name">
            Name
          </label>
          <input
            id="admin-new-name"
            type="text"
            required
            maxLength={100}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Display name"
            style={{ ...inputStyle, width: 180 }}
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          style={{
            minHeight: 36,
            padding: "0 16px",
            background: "var(--accent)",
            color: "var(--canvas)",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: creating ? "default" : "pointer",
            opacity: creating ? 0.7 : 1,
          }}
        >
          {creating ? "Adding…" : "Add user"}
        </button>
      </form>

      {createError && (
        <div style={{ color: "var(--status-incorrect)", fontSize: 13, marginBottom: 16 }}>{createError}</div>
      )}

      {created && (
        <div style={{ ...cardStyle, marginBottom: 24, borderLeft: "2px solid var(--accent)" }}>
          <div style={{ fontSize: 13, color: "var(--text-heading)", marginBottom: 8 }}>
            Account created for {created.user.email}
            {created.emailSent
              ? " — the temporary password was emailed to them."
              : " — email delivery failed or isn't configured, so share this manually:"}
          </div>
          {!created.emailSent && (
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 13, background: "var(--raised)", padding: "4px 8px", borderRadius: 4 }}>
              {created.tempPassword}
            </code>
          )}
          <button type="button" onClick={() => setCreated(null)} style={{ ...buttonStyle, display: "block", marginTop: 10 }}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ ...kicker, marginBottom: 12 }}>Users</div>
      {listError && <div style={{ color: "var(--status-incorrect)", fontSize: 13 }}>{listError}</div>}
      {rowError && <div style={{ color: "var(--status-incorrect)", fontSize: 13, marginBottom: 12 }}>{rowError}</div>}
      {!users && !listError && <div style={{ color: "var(--text-dim)" }}>Loading…</div>}

      {users && (
        <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                {["Email", "Name", "Role", "Status", "Sessions", "Created", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "var(--text-dim)", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.email === sessionUser?.email;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--hairline-faint)" }}>
                    <td style={{ padding: "10px 14px", color: "var(--text-body)" }}>
                      {u.email}
                      {isSelf && <span style={{ color: "var(--text-dim)" }}> (you)</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-body)" }}>{u.name}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-body)" }}>{u.role}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{statusLabel(u)}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{u.sessionCount}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => handleRoleChange(u, u.role === "admin" ? "user" : "admin")}
                          style={{ ...buttonStyle, marginRight: 8 }}
                        >
                          {u.role === "admin" ? "Make user" : "Make admin"}
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => handleRemove(u)}
                          style={{
                            ...buttonStyle,
                            color: confirmingRemoveId === u.id ? "var(--canvas)" : "var(--status-incorrect)",
                            background: confirmingRemoveId === u.id ? "var(--status-incorrect)" : "transparent",
                            borderColor: "var(--status-incorrect)",
                          }}
                        >
                          {confirmingRemoveId === u.id ? "Click again to confirm" : "Remove"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
