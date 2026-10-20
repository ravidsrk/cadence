import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";
import { pendingMigrations } from "./migration-plan.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const migrations = new URL("../migrations/", import.meta.url);
const repairMigration = "0004_board_calendar_columns.sql";

async function database(t, legacy = false) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec("create table _migrations (name text primary key)");
  if (legacy) {
    // The original 0002 was already applied before its file gained cache columns.
    await db.exec(`
      create table board_profiles (
        username text primary key,
        added_at timestamptz not null default now()
      );
      insert into board_profiles (username) values ('legacy-builder');
      insert into _migrations (name) values ('0002_board.sql');
    `);
  }
  return db;
}

async function applyPending(db) {
  const applied = await db.query("select name from _migrations");
  const pending = pendingMigrations(
    await readdir(migrations),
    applied.rows.map((row) => row.name),
  );
  for (const { name } of pending) {
    const text = await readFile(new URL(name, migrations), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(text);
      await tx.query("insert into _migrations (name) values ($1)", [name]);
    });
  }
  return pending.map((entry) => entry.name);
}

async function assertCacheColumns(db) {
  const result = await db.query(`
    select column_name, data_type from information_schema.columns
    where table_name = 'board_profiles'
      and column_name in ('calendar_json', 'cached_today', 'updated_at')
  `);
  assert.deepEqual(Object.fromEntries(result.rows.map((row) => [row.column_name, row.data_type])), {
    calendar_json: "jsonb",
    cached_today: "text",
    updated_at: "timestamp with time zone",
  });
}

test("a new migration upgrades a database that already recorded the old 0002", async (t) => {
  const db = await database(t, true);
  const applied = await applyPending(db);
  assert.ok(!applied.includes("0002_board.sql"));
  assert.ok(applied.includes(repairMigration));
  await assertCacheColumns(db);
  assert.deepEqual((await db.query("select username from board_profiles")).rows, [
    { username: "legacy-builder" },
  ]);
  assert.deepEqual(await applyPending(db), []);
});

test("the cache-column migration is safe on a fresh database and when repeated", async (t) => {
  const db = await database(t);
  await applyPending(db);
  const repair = await readFile(new URL(repairMigration, migrations), "utf8");
  await db.exec(repair);
  await db.exec(repair);
  await assertCacheColumns(db);
});

test("the indexer alone repairs the legacy schema before writing a profile", async (t) => {
  const db = await database(t, true);
  await assert.rejects(
    db.query("select calendar_json from board_profiles"),
    /column "calendar_json" does not exist/,
  );

  // Load the actual server worker without a web app, live providers, or a
  // configured production database. The guard and upsert use the injected SQL.
  const stubs = {
    "@/lib/db": "export function getSql() { throw new Error('Unexpected database lookup'); }",
    "./fetch.server": `
      export function hasGithubToken() { return false; }
      export function fetchCalendar() { throw new Error('Unexpected calendar fetch'); }
      export function githubGraphql() { throw new Error('Unexpected GraphQL fetch'); }
    `,
    "./load": "export function todayIso() { return '2026-10-20'; }",
  };
  const server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true },
    plugins: [
      {
        name: "indexer-test-io",
        enforce: "pre",
        resolveId(id, importer) {
          if (importer?.endsWith("/github/indexer.server.ts") && id in stubs) {
            return `\0indexer-test:${id}`;
          }
        },
        load(id) {
          const key = id.replace(/^\0indexer-test:/, "");
          if (key in stubs) return stubs[key];
        },
      },
    ],
  });
  t.after(() => server.close());
  const { ensureIndexerSchema, upsertIndexedProfile } = await server.ssrLoadModule(
    "/src/lib/github/indexer.server.ts",
  );
  const sql = (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
    return sql.query(text, values);
  };
  sql.query = async (text, values = []) => (await db.query(text, values)).rows;

  await ensureIndexerSchema(sql);
  await ensureIndexerSchema(sql);
  await assertCacheColumns(db);
  const result = await upsertIndexedProfile(
    sql,
    {
      profile: {
        login: "legacy-builder",
        name: "Legacy Builder",
        avatarUrl: "https://github.com/legacy-builder.png",
        htmlUrl: "https://github.com/legacy-builder",
        bio: null,
        followers: 5,
      },
      days: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-10-${14 + i}`,
        count: i + 1,
        level: 1,
      })),
      commits: 24,
      pullRequests: 2,
      reviews: 1,
      issues: 1,
      restricted: 0,
      total: 28,
    },
    "2026-10-20",
    "seed",
  );
  assert.equal(result.indexed, true);
  const {
    rows: [row],
  } = await db.query(`
    select calendar_json, cached_today, updated_at, total_7d
    from board_profiles where username = 'legacy-builder'
  `);
  assert.equal(row.calendar_json.stats.total, 28);
  assert.equal(row.cached_today, "2026-10-20");
  assert.ok(row.updated_at);
  assert.equal(row.total_7d, 28);
});
