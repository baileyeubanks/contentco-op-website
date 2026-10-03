// Materialize reviewed metadata only. No connection, credentials, or SQL execution.
import { readFile, writeFile } from "node:fs/promises";
const root = new URL("./", import.meta.url);
const metadata = JSON.parse(await readFile(new URL("applied-schema.json", root), "utf8"));
const statements = [
  "-- ISOLATED TEST FIXTURE ONLY. Never run against an existing or production database.",
  "CREATE SCHEMA auth; CREATE SCHEMA co_production;",
  'CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
  "CREATE TABLE auth.users(id uuid PRIMARY KEY);",
  "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
  "CREATE TABLE public.contacts(id uuid PRIMARY KEY); CREATE TABLE public.businesses(id uuid PRIMARY KEY); CREATE TABLE public.orgs(id uuid PRIMARY KEY); CREATE TABLE public.quotes(id uuid PRIMARY KEY);",
  "CREATE TABLE co_production.teams(id uuid PRIMARY KEY); CREATE TABLE co_production.versions(id uuid PRIMARY KEY);",
];
const tables = new Map();
for (const column of metadata.columns) {
  // The capture does not contain the generated fts expression. Do not invent it.
  if (column.column_name === "fts") continue;
  const name = `${column.table_schema}.${column.table_name}`;
  if (!tables.has(name)) tables.set(name, []);
  tables.get(name).push(column);
}
for (const [table, columns] of tables) {
  const definition = columns.sort((a, b) => a.ordinal_position - b.ordinal_position).map((column) =>
    `  "${column.column_name}" ${column.udt_name}${column.column_default ? ` DEFAULT ${column.column_default}` : ""}${column.is_nullable === "NO" ? " NOT NULL" : ""}`);
  statements.push(`CREATE TABLE ${table} (\n${definition.join(",\n")}\n);`);
}
const rank = (constraint) => /^(PRIMARY KEY|UNIQUE)/.test(constraint.definition) ? 0 : constraint.definition.startsWith("CHECK") ? 1 : 2;
for (const constraint of [...metadata.constraints].sort((a, b) => rank(a) - rank(b))) {
  statements.push(`ALTER TABLE ${constraint.schema_name}.${constraint.table_name} ADD CONSTRAINT "${constraint.constraint_name}" ${constraint.definition};`);
}
for (const index of metadata.indexes) {
  if (index.indexdef.includes("fts") || metadata.constraints.some((c) => c.schema_name === index.schemaname && c.constraint_name === index.indexname)) continue;
  statements.push(`${index.indexdef};`);
}
await writeFile(new URL("applied-schema.sql", root), statements.join("\n") + "\n");
