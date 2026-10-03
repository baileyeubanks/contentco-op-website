import type { PGlite } from "@electric-sql/pglite";

type Row = Record<string, any>;
const quote = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Unsupported fixture identifier: ${name}`);
  return `"${name}"`;
};
export class PgFixture {
  mutations: Array<{ table: string; operation: string }> = [];
  failures: Array<{ table: string; operation: string; after?: boolean }> = [];
  constructor(public db: PGlite) {}
  client(schema: "public" | "co_production") { return { from: (table: string) => new Query(this, schema, table) }; }
  fail(table: string, operation = "insert", after = false) { this.failures.push({ table, operation, after }); }
  async rows(table: string) { return (await this.db.query(`SELECT * FROM ${table} ORDER BY id`)).rows as Row[]; }
}
class Query {
  operation = "select"; payload: Row = {}; columns = "*"; filters: Array<[string, unknown]> = []; cap?: number; nullFilters: string[] = [];
  constructor(public fixture: PgFixture, public schema: string, public table: string) {}
  select(columns = "*") { this.columns = columns; return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  is(column: string, value: null) { if (value !== null) throw new Error("Only SQL IS NULL is supported"); this.nullFilters.push(column); return this; }
  limit(value: number) { this.cap = value; return this; }
  insert(payload: Row) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.operation = "update"; this.payload = payload; return this; }
  single() { return this.execute("one"); }
  maybeSingle() { return this.execute("maybe"); }
  then(resolve: (result: any) => unknown, reject: (error: any) => unknown) { return this.execute("many").then(resolve, reject); }
  async execute(mode: "one" | "maybe" | "many") {
    const name = `${this.schema}.${this.table}`;
    const failureIndex = this.fixture.failures.findIndex((f) => f.table === name && f.operation === this.operation);
    const failure = failureIndex >= 0 ? this.fixture.failures.splice(failureIndex, 1)[0] : null;
    if (failure && !failure.after) return { data: null, error: { code: "08006", message: `injected_${name}_${this.operation}_failure` } };
    const values: unknown[] = [];
    const bind = (value: unknown) => { values.push(value && typeof value === "object" ? JSON.stringify(value) : value); return `$${values.length}`; };
    const relation = `${quote(this.schema)}.${quote(this.table)}`;
    const columns = this.columns === "*" ? "*" : this.columns.split(",").map((s) => quote(s.trim())).join(",");
    let sql = "";
    if (this.operation === "select") sql = `SELECT ${columns} FROM ${relation}`;
    if (this.operation === "insert") sql = `INSERT INTO ${relation} (${Object.keys(this.payload).map(quote).join(",")}) VALUES (${Object.values(this.payload).map(bind).join(",")}) RETURNING ${columns}`;
    if (this.operation === "update") sql = `UPDATE ${relation} SET ${Object.entries(this.payload).map(([k, v]) => `${quote(k)}=${bind(v)}`).join(",")}`;
    const predicates = [...this.filters.map(([k, v]) => `${quote(k)}=${bind(v)}`), ...this.nullFilters.map((column) => `${quote(column)} IS NULL`)];
    if (this.operation !== "insert" && predicates.length) sql += ` WHERE ${predicates.join(" AND ")}`;
    if (this.operation === "select" && this.cap !== undefined) sql += ` LIMIT ${this.cap}`;
    if (this.operation === "update") sql += ` RETURNING ${columns}`;
    try {
      const result = await this.fixture.db.query(sql, values);
      const rows = JSON.parse(JSON.stringify(result.rows));
      if (this.operation !== "select") this.fixture.mutations.push({ table: name, operation: this.operation });
      if (failure?.after) return { data: null, error: { code: "08006", message: "injected_response_lost_after_commit" } };
      if ((mode === "one" && rows.length !== 1) || (mode === "maybe" && rows.length > 1)) return { data: null, error: { code: "PGRST116", message: "unexpected_row_count" } };
      return { data: mode === "many" ? rows : rows[0] || null, error: null };
    } catch (error) {
      return { data: null, error: { code: (error as Row).code, message: (error as Error).message } };
    }
  }
}
