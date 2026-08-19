#!/usr/bin/env node
/**
 * Operator-only CLI for the multi-user identity database (issue #37/#46) -- there is no admin UI
 * in the app itself, deliberately: a web-based admin surface would need its own auth story and
 * meaningfully expands this app's attack surface for a capability only the operator (whoever has
 * filesystem access to the host machine) will ever use. This script instead runs directly against
 * `data/snowprep.sqlite`, the same trust model the password-recovery design already leans on
 * (CLAUDE.md's "Identity & multi-user progress" section: recovery is the operator clearing
 * `password_hash` via direct DB access).
 *
 * Usage (run from `pipeline/`):
 *   npm run admin:users -- list
 *   npm run admin:users -- remove <email>              # dry run: shows what WOULD be deleted
 *   npm run admin:users -- remove <email> --yes         # actually deletes that account + their
 *                                                        # sessions + their progress row
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
      `SELECT users.id, users.email, users.name, users.created_at AS createdAt,
              users.password_hash IS NOT NULL AS hasPassword,
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
      `#${u.id}  ${u.email}  "${u.name}"  ` +
        `${u.hasPassword ? "password set" : "NO PASSWORD (legacy, unclaimed)"}  ` +
        `${u.sessionCount} active session(s)  ` +
        `progress: ${u.progressUpdatedAt ?? "none yet"}  ` +
        `created: ${u.createdAt}`,
    );
  }
}

function removeUser(db, email, actuallyDelete) {
  const normalized = email.trim().toLowerCase();
  const user = db.prepare("SELECT id, email, name FROM users WHERE email = ?").get(normalized);
  if (!user) {
    console.error(`No account found for "${normalized}".`);
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
