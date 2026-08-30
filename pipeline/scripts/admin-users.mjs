#!/usr/bin/env node
/**
 * Operator-only CLI for the multi-user identity database (issue #37/#46/#62). This script runs
 * directly against `data/snowprep.sqlite`, the same trust model the password-recovery design
 * already leans on (CLAUDE.md's "Identity & multi-user progress" section: recovery is the operator
 * clearing `password_hash` via direct DB access).
 *
 * Issue #62 added a real web-based admin UI (`/admin`, `requireAdmin`-gated) for day-to-day user
 * management -- listing/adding/removing accounts and changing roles no longer needs filesystem
 * access. This script remains as the operator-level escape hatch below that: it works even with no
 * live session and no admin account at all (e.g. recovering from a database where the earliest
 * account -- the one `db.ts`'s migration auto-promotes -- was since deleted), the same reasoning
 * that already justified `remove`/`reset-all` existing here instead of only in the web app.
 *
 * Usage (run from `pipeline/`):
 *   npm run admin:users -- list
 *   npm run admin:users -- remove <email>              # dry run: shows what WOULD be deleted
 *   npm run admin:users -- remove <email> --yes         # actually deletes that account + their
 *                                                        # sessions + their progress row
 *   npm run admin:users -- promote <email>              # makes <email> an admin
 *   npm run admin:users -- demote <email>               # dry run: shows the demotion (blocked if
 *                                                        # <email> is the last admin)
 *   npm run admin:users -- demote <email> --yes         # actually demotes <email> to a regular user
 *   npm run admin:users -- reset-all                    # dry run: shows the full user count
 *   npm run admin:users -- reset-all --yes --i-am-sure  # actually deletes EVERY user/session/
 *                                                        # progress row -- both flags required,
 *                                                        # deliberately harder to fat-finger than
 *                                                        # a single --yes, since there's no undo
 *                                                        # and no backup taken automatically
 *
 * SNOWPRO_DATA_DIR overrides where the database is found (defaults to the repo's own `data/`,
 * matching docker-compose.yml's bind mount -- the same file the container reads/writes).
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(process.env.SNOWPRO_DATA_DIR ?? path.join(__dirname, "..", "..", "data"), "snowprep.sqlite");

function openDb() {
  if (!existsSync(DB_FILE)) {
    console.error(`No database found at ${DB_FILE} -- has the app ever been run?`);
    process.exit(1);
  }
  return new Database(DB_FILE);
}

function listUsers(db) {
  const users = db
    .prepare(
      `SELECT users.id, users.email, users.name, users.created_at AS createdAt, users.role,
              users.password_hash IS NOT NULL AS hasPassword,
              users.must_change_password AS mustChangePassword,
              (SELECT COUNT(*) FROM sessions WHERE sessions.user_id = users.id) AS sessionCount,
              progress.updated_at AS progressUpdatedAt
       FROM users LEFT JOIN progress ON progress.user_id = users.id
       ORDER BY users.id`,
    )
    .all();

  if (users.length === 0) {
    console.log("No users yet.");
    return;
  }
  console.log(`${users.length} user(s):\n`);
  for (const u of users) {
    console.log(
      `#${u.id}  ${u.email}  "${u.name}"  [${u.role}]  ` +
        `${!u.hasPassword ? "NO PASSWORD (legacy, unclaimed)" : u.mustChangePassword ? "temp password (pending first login)" : "password set"}  ` +
        `${u.sessionCount} active session(s)  ` +
        `progress: ${u.progressUpdatedAt ?? "none yet"}  ` +
        `created: ${u.createdAt}`,
    );
  }
}

function findUserByEmail(db, email) {
  const normalized = email.trim().toLowerCase();
  return db.prepare("SELECT id, email, name, role FROM users WHERE email = ?").get(normalized);
}

function countAdmins(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
}

function promoteUser(db, email) {
  const user = findUserByEmail(db, email);
  if (!user) {
    console.error(`No account found for "${email.trim().toLowerCase()}".`);
    process.exit(1);
  }
  if (user.role === "admin") {
    console.log(`#${user.id} (${user.email}) is already an admin.`);
    return;
  }
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
  console.log(`#${user.id} (${user.email}) is now an admin.`);
}

function demoteUser(db, email, actuallyDemote) {
  const user = findUserByEmail(db, email);
  if (!user) {
    console.error(`No account found for "${email.trim().toLowerCase()}".`);
    process.exit(1);
  }
  if (user.role !== "admin") {
    console.log(`#${user.id} (${user.email}) is already a regular user.`);
    return;
  }
  if (countAdmins(db) <= 1) {
    console.error(`Refusing: #${user.id} (${user.email}) is the last remaining admin.`);
    process.exit(1);
  }
  if (!actuallyDemote) {
    console.log(`DRY RUN -- would demote #${user.id} (${user.email}) to a regular user.`);
    console.log("Re-run with --yes to actually demote.");
    return;
  }
  db.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(user.id);
  console.log(`#${user.id} (${user.email}) is now a regular user.`);
}

function removeUser(db, email, actuallyDelete) {
  const user = findUserByEmail(db, email);
  if (!user) {
    console.error(`No account found for "${email.trim().toLowerCase()}".`);
    process.exit(1);
  }
  const sessionCount = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(user.id).n;
  const hasProgress = db.prepare("SELECT 1 FROM progress WHERE user_id = ?").get(user.id) !== undefined;

  if (!actuallyDelete) {
    console.log(
      `DRY RUN -- would delete account #${user.id} (${user.email}, "${user.name}"), ` +
        `${sessionCount} session(s), and ${hasProgress ? "their progress row" : "no progress row (none exists)"}.`,
    );
    console.log("Re-run with --yes to actually delete.");
    return;
  }

  const run = db.transaction((userId) => {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM progress WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });
  run(user.id);
  console.log(`Deleted account #${user.id} (${user.email}), its sessions, and its progress row.`);
}

function resetAll(db, actuallyDelete, confirmed) {
  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (userCount === 0) {
    console.log("No users to reset.");
    return;
  }

  if (!actuallyDelete || !confirmed) {
    console.log(`DRY RUN -- would delete ALL ${userCount} user(s), every session, and every progress row.`);
    console.log("This has no undo and this script takes no backup. Re-run with --yes --i-am-sure to proceed.");
    return;
  }

  const run = db.transaction(() => {
    db.prepare("DELETE FROM sessions").run();
    db.prepare("DELETE FROM progress").run();
    db.prepare("DELETE FROM users").run();
  });
  run();
  console.log(`Deleted all ${userCount} user(s) and their sessions/progress.`);
}

function usage() {
  console.log(
    "Usage:\n" +
      "  npm run admin:users -- list\n" +
      "  npm run admin:users -- remove <email> [--yes]\n" +
      "  npm run admin:users -- promote <email>\n" +
      "  npm run admin:users -- demote <email> [--yes]\n" +
      "  npm run admin:users -- reset-all [--yes --i-am-sure]",
  );
}

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const positional = rest.filter((a) => !a.startsWith("--"));

const db = command ? openDb() : null;
try {
  switch (command) {
    case "list":
      listUsers(db);
      break;
    case "remove": {
      const email = positional[0];
      if (!email) {
        console.error("Usage: npm run admin:users -- remove <email> [--yes]");
        process.exit(1);
      }
      removeUser(db, email, flags.has("--yes"));
      break;
    }
    case "promote": {
      const email = positional[0];
      if (!email) {
        console.error("Usage: npm run admin:users -- promote <email>");
        process.exit(1);
      }
      promoteUser(db, email);
      break;
    }
    case "demote": {
      const email = positional[0];
      if (!email) {
        console.error("Usage: npm run admin:users -- demote <email> [--yes]");
        process.exit(1);
      }
      demoteUser(db, email, flags.has("--yes"));
      break;
    }
    case "reset-all":
      resetAll(db, flags.has("--yes"), flags.has("--i-am-sure"));
      break;
    default:
      usage();
      process.exit(command ? 1 : 0);
  }
} finally {
  db?.close();
}
