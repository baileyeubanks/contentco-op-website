/**
 * In-memory Supabase client fake for unit tests.
 *
 * Implements the small PostgREST subset used by the commercial pipeline:
 * select/eq/neq/in/order/limit/maybeSingle/single, insert/update/upsert/delete,
 * and `{ count: "exact", head: true }` count queries. Anything outside that
 * subset throws loudly so tests never silently pass on a wrong query shape.
 */

export type FakeRow = Record<string, unknown>;

type Filter = { col: string; op: "eq" | "neq" | "in"; value: unknown };

type FakeError = { message: string; code?: string };
type FakeResult = { data: unknown; error: FakeError | null; count: number | null };

let idCounter = 0;

export function fakeUuid() {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

function nowIso() {
  return new Date().toISOString();
}

class FakeQuery {
  private filters: Filter[] = [];
  private ordering: { col: string; ascending: boolean }[] = [];
  private limitN: number | null = null;
  private op: { kind: "select"; countExact: boolean; head: boolean } | { kind: "insert"; rows: FakeRow[] } | { kind: "update"; patch: FakeRow } | { kind: "upsert"; rows: FakeRow[]; onConflict: string[] } | { kind: "delete" } = {
    kind: "select",
    countExact: false,
    head: false,
  };
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(
    private readonly store: Map<string, FakeRow[]>,
    private readonly table: string,
    private readonly uniques: Record<string, string[]>,
  ) {}

  select(_columns?: string, opts?: { count?: "exact"; head?: boolean }) {
    if (this.op.kind === "select") {
      this.op = { kind: "select", countExact: opts?.count === "exact", head: opts?.head === true };
    }
    return this;
  }

  eq(col: string, value: unknown) {
    this.filters.push({ col, op: "eq", value });
    return this;
  }

  neq(col: string, value: unknown) {
    this.filters.push({ col, op: "neq", value });
    return this;
  }

  in(col: string, values: unknown[]) {
    this.filters.push({ col, op: "in", value: values });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.ordering.push({ col, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  insert(rows: FakeRow | FakeRow[]) {
    this.op = { kind: "insert", rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }

  update(patch: FakeRow) {
    this.op = { kind: "update", patch };
    return this;
  }

  upsert(rows: FakeRow | FakeRow[], opts?: { onConflict?: string }) {
    this.op = {
      kind: "upsert",
      rows: Array.isArray(rows) ? rows : [rows],
      onConflict: String(opts?.onConflict || "id").split(",").map((c) => c.trim()),
    };
    return this;
  }

  delete() {
    this.op = { kind: "delete" };
    return this;
  }

  single() {
    this.singleMode = "single";
    return this.execute();
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this.execute();
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private rows(): FakeRow[] {
    return this.store.get(this.table) || [];
  }

  private matches(row: FakeRow) {
    return this.filters.every((filter) => {
      const actual = row[filter.col];
      if (filter.op === "eq") return actual === filter.value;
      if (filter.op === "neq") return actual !== filter.value;
      return Array.isArray(filter.value) && filter.value.includes(actual);
    });
  }

  private selectedRows() {
    let rows = this.rows().filter((row) => this.matches(row));
    for (const order of [...this.ordering].reverse()) {
      rows = [...rows].sort((a, b) => {
        const left = a[order.col];
        const right = b[order.col];
        if (left === right) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        const cmp = left < right ? -1 : 1;
        return order.ascending ? cmp : -cmp;
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  private shape(data: unknown, error: FakeError | null, count: number | null = null): FakeResult {
    return { data, error, count };
  }

  private async execute(): Promise<FakeResult> {
    const op = this.op;

    if (op.kind === "select") {
      const rows = this.selectedRows();
      if (op.head || op.countExact) {
        return this.shape(op.head ? null : rows, null, rows.length);
      }
      if (this.singleMode === "single") {
        if (rows.length !== 1) return this.shape(null, { message: "fake_single_row_mismatch" });
        return this.shape(rows[0], null);
      }
      if (this.singleMode === "maybeSingle") {
        if (rows.length > 1) return this.shape(null, { message: "fake_maybe_single_multiple_rows" });
        return this.shape(rows[0] || null, null);
      }
      return this.shape(rows, null);
    }

    if (op.kind === "insert") {
      const table = this.store.get(this.table) || [];
      const uniqueCols = this.uniques[this.table];
      if (uniqueCols) {
        const violates = op.rows.some((row) =>
          row[uniqueCols[0]] != null &&
          uniqueCols.every((col) => row[col] != null) &&
          table.some((existing) => uniqueCols.every((col) => existing[col] === row[col])),
        );
        if (violates) {
          return this.shape(null, {
            message: `duplicate key value violates unique constraint on ${this.table}(${uniqueCols.join(",")})`,
            code: "23505",
          });
        }
      }
      const inserted = op.rows.map((row) => {
        const record: FakeRow = {
          id: row.id ?? fakeUuid(),
          created_at: row.created_at ?? nowIso(),
          ...row,
        };
        table.push(record);
        return record;
      });
      this.store.set(this.table, table);
      return this.shapeRowsAfterWrite(inserted);
    }

    if (op.kind === "upsert") {
      const table = this.store.get(this.table) || [];
      const written = op.rows.map((row) => {
        const existing = table.find((candidate) =>
          op.onConflict.every((col) => candidate[col] === row[col]),
        );
        if (existing) {
          Object.assign(existing, row);
          return existing;
        }
        const record: FakeRow = {
          id: row.id ?? fakeUuid(),
          created_at: row.created_at ?? nowIso(),
          ...row,
        };
        table.push(record);
        return record;
      });
      this.store.set(this.table, table);
      return this.shapeRowsAfterWrite(written);
    }

    if (op.kind === "update") {
      const updated = this.rows()
        .filter((row) => this.matches(row))
        .map((row) => {
          Object.assign(row, op.patch);
          return row;
        });
      return this.shapeRowsAfterWrite(updated);
    }

    if (op.kind === "delete") {
      const remaining = this.rows().filter((row) => !this.matches(row));
      this.store.set(this.table, remaining);
      return this.shape(null, null);
    }

    throw new Error("fake_supabase_unreachable");
  }

  private shapeRowsAfterWrite(rows: FakeRow[]): FakeResult {
    if (this.singleMode === "single") {
      if (rows.length !== 1) return this.shape(null, { message: "fake_single_row_mismatch" });
      return this.shape(rows[0], null);
    }
    if (this.singleMode === "maybeSingle") {
      return this.shape(rows[0] || null, null);
    }
    return this.shape(rows, null);
  }
}

export function createFakeSupabase(
  seed?: Record<string, FakeRow[]>,
  options?: { uniques?: Record<string, string[]> },
) {
  const store = new Map<string, FakeRow[]>();
  for (const [table, rows] of Object.entries(seed || {})) {
    store.set(table, rows.map((row) => ({ ...row })));
  }
  const uniques = options?.uniques || {};
  const client = {
    from(table: string) {
      return new FakeQuery(store, table, uniques);
    },
  };
  return { client, store };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
