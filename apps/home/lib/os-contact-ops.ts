import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getRootContacts } from "@/lib/root-data";
import { batchComputeLeadScores, computeLeadScore, mergeContacts } from "@/lib/root-contacts-engine";
import { emitTypedEvent } from "@/lib/root-event-log";
import { getSupabase } from "@/lib/supabase";
import type { RootBusinessScope } from "@/lib/root-request-scope";

const execFileAsync = promisify(execFile);

const GOOGLE_WORKSPACE_SCRIPT =
  process.env.ROOT_GOOGLE_CONTACTS_CLI ||
  "/Users/baileyeubanks/Desktop/Projects/hermes-agent/skills/productivity/google-workspace/scripts/google_api.py";

export type RootContactImportScope = "ACS" | "CCO" | "CROSS";
export type RootContactImportSource = "csv" | "google_contacts" | "google_sheet";

export type RootContactImportRecord = {
  id: string;
  source: RootContactImportSource;
  scope: RootContactImportScope;
  status: "completed" | "processing" | "failed" | "projected";
  total_rows: number;
  created_count: number;
  updated_count: number;
  duplicate_count: number;
  created_at: string;
  note: string | null;
  source_ref: string | null;
  source_mode: "table" | "event";
};

type ParsedImportRow = {
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  client_code: string | null;
  account_code: string | null;
  preferred_channel: string | null;
  preferences_summary: string | null;
  tags: string[];
  notes: string | null;
  source_label: string;
  raw: Record<string, unknown>;
};

function cleanString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeEmail(value: unknown) {
  return cleanString(value)?.toLowerCase() || null;
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d+]/g, "").trim();
  return digits || null;
}

function asBusinessScope(value: unknown): RootContactImportScope {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ACS") return "ACS";
  if (["CCO", "CC", "CONTENT CO-OP", "CONTENT_CO_OP"].includes(normalized)) return "CCO";
  return "CROSS";
}

function toRootScope(scope: RootContactImportScope): RootBusinessScope {
  if (scope === "ACS") return "ACS";
  if (scope === "CCO") return "CC";
  return null;
}

function primaryBusinessUnit(scope: RootContactImportScope): "ACS" | "CC" {
  return scope === "ACS" ? "ACS" : "CC";
}

function businessUnitsForScope(scope: RootContactImportScope): Array<"ACS" | "CC"> {
  if (scope === "CROSS") return ["ACS", "CC"];
  return [primaryBusinessUnit(scope)];
}

function derivePreferredChannel(row: ParsedImportRow) {
  if (row.preferred_channel) return row.preferred_channel;
  if (row.phone && row.email) return "phone";
  if (row.phone) return "sms";
  if (row.email) return "email";
  return "manual_review";
}

function deriveTags(row: ParsedImportRow, scope: RootContactImportScope) {
  const tags = new Set(row.tags.map((tag) => tag.toLowerCase()).filter(Boolean));
  tags.add(scope.toLowerCase());
  if (row.email) tags.add("email");
  if (row.phone) tags.add("phone");
  if (row.company) tags.add("company-linked");
  return Array.from(tags);
}

function pickFirstRecord(records: Record<string, unknown>[], keys: string[]) {
  for (const key of keys) {
    const value = records.find((record) => cleanString(record[key]));
    if (value) return cleanString(value[key]);
  }
  return null;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      const next = line[index + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(text: string) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [] as Record<string, unknown>[];

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function parseSheetRows(rows: string[][]) {
  if (!Array.isArray(rows) || rows.length === 0) return [] as Record<string, unknown>[];
  const headers = (rows[0] || []).map((cell) => normalizeHeader(String(cell || "")));
  return rows.slice(1).map((values) => {
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function rowToParsedContact(row: Record<string, unknown>, sourceLabel: string): ParsedImportRow | null {
  const records = [row];
  const fullName =
    pickFirstRecord(records, ["full_name", "name", "contact_name", "display_name", "client_name"]) || "";
  const email =
    normalizeEmail(
      row.email ||
        row.email_address ||
        row.primary_email ||
        row.work_email ||
        row.personal_email ||
        (Array.isArray(row.emails) ? row.emails[0] : null),
    ) || null;
  const phone =
    normalizePhone(
      row.phone ||
        row.phone_number ||
        row.mobile ||
        row.cell ||
        row.primary_phone ||
        (Array.isArray(row.phones) ? row.phones[0] : null),
    ) || null;
  const company = pickFirstRecord(records, ["company", "company_name", "organization", "business"]);
  const clientCode = pickFirstRecord(records, ["client_code", "client_id", "client_number"]);
  const accountCode = pickFirstRecord(records, ["account_code", "account_id", "account_number"]);
  const preferredChannel = pickFirstRecord(records, ["preferred_channel", "channel", "communication_preference"]);
  const preferencesSummary = pickFirstRecord(records, ["preferences_summary", "preferences", "notes", "service_preferences"]);
  const tags = cleanString(row.tags)
    ? String(row.tags)
        .split(/[|,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  const notes = pickFirstRecord(records, ["notes", "memo", "context"]);

  if (!fullName && !email && !phone) return null;

  return {
    full_name: fullName || company || email || phone || "Imported contact",
    email,
    phone,
    company,
    client_code: clientCode,
    account_code: accountCode,
    preferred_channel: preferredChannel,
    preferences_summary: preferencesSummary,
    tags,
    notes,
    source_label: sourceLabel,
    raw: row,
  };
}

async function runGoogleWorkspaceCommand(args: string[]) {
  const { stdout } = await execFileAsync("python3", [GOOGLE_WORKSPACE_SCRIPT, ...args], {
    cwd: "/Users/baileyeubanks/Desktop/Projects",
    maxBuffer: 1024 * 1024 * 8,
  });
  return JSON.parse(stdout || "[]");
}

async function tableExists(table: string) {
  const sb = getSupabase();
  try {
    const { error } = await sb.from(table).select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function ensureBusinessMappings(scope: RootContactImportScope) {
  const sb = getSupabase();
  const requiredUnits = businessUnitsForScope(scope);
  const { data: existing } = await sb.from("businesses").select("id,business_unit,name").in("business_unit", requiredUnits);
  const byUnit = new Map<string, { id: string; business_unit: string; name: string }>();
  for (const row of existing || []) {
    byUnit.set(String(row.business_unit).toUpperCase(), row as { id: string; business_unit: string; name: string });
  }

  const ensured: Array<{ id: string; business_unit: "ACS" | "CC"; name: string }> = [];
  for (const unit of requiredUnits) {
    const current = byUnit.get(unit);
    if (current?.id) {
      ensured.push({ id: current.id, business_unit: unit, name: current.name });
      continue;
    }
    const name = unit === "ACS" ? "Astro Cleanings" : "Content Co-op";
    const { data } = await sb.from("businesses").insert({ name, business_unit: unit }).select("id,name,business_unit").single();
    if (data?.id) {
      ensured.push({ id: data.id, business_unit: unit, name: data.name });
    }
  }

  return ensured;
}

async function findExistingContact(row: ParsedImportRow) {
  const sb = getSupabase();
  if (row.email) {
    const { data } = await sb.from("contacts").select("*").eq("email", row.email).maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  if (row.phone) {
    const { data } = await sb.from("contacts").select("*").eq("phone", row.phone).maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  return null;
}

function buildImportMetadata(existing: Record<string, unknown> | null, row: ParsedImportRow, scope: RootContactImportScope, batchId: string) {
  const currentMetadata =
    existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};
  const currentTags = Array.isArray(existing?.tags) ? existing.tags.map((tag) => String(tag)) : [];
  return {
    ...currentMetadata,
    source: row.source_label,
    import_source: row.source_label,
    import_scope: scope,
    import_batch_id: batchId,
    last_imported_at: new Date().toISOString(),
    preferences_summary: row.preferences_summary || currentMetadata.preferences_summary || null,
    notes: row.notes || currentMetadata.notes || null,
    tags: Array.from(new Set([...currentTags, ...deriveTags(row, scope)])),
    provenance: {
      ...((currentMetadata.provenance && typeof currentMetadata.provenance === "object" && !Array.isArray(currentMetadata.provenance))
        ? (currentMetadata.provenance as Record<string, unknown>)
        : {}),
      last_import: {
        source: row.source_label,
        imported_at: new Date().toISOString(),
        fields: {
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          company: row.company,
          client_code: row.client_code,
          account_code: row.account_code,
          preferred_channel: row.preferred_channel,
          preferences_summary: row.preferences_summary,
        },
      },
    },
  };
}

async function writeImportRowToTables(options: {
  batchId: string;
  rows: ParsedImportRow[];
  scope: RootContactImportScope;
  source: RootContactImportSource;
  sourceRef?: string | null;
}) {
  const sb = getSupabase();
  const batchesEnabled = await tableExists("contact_import_batches");
  const rowsEnabled = await tableExists("contact_import_rows");

  if (!batchesEnabled) {
    return {
      batchId: options.batchId,
      sourceMode: "event" as const,
      updateBatch: async () => undefined,
      persistRows: async () => undefined,
    };
  }

  await sb.from("contact_import_batches").insert({
    id: options.batchId,
    source: options.source,
    business_scope: options.scope,
    status: "processing",
    source_ref: options.sourceRef || null,
    total_rows: options.rows.length,
    created_count: 0,
    updated_count: 0,
    duplicate_count: 0,
    note: `${options.rows.length} rows queued from ${options.source}`,
  });

  return {
    batchId: options.batchId,
    sourceMode: "table" as const,
    updateBatch: async (payload: Record<string, unknown>) => {
      await sb.from("contact_import_batches").update(payload).eq("id", options.batchId);
    },
    persistRows: rowsEnabled
      ? async (payload: Array<Record<string, unknown>>) => {
          if (payload.length === 0) return;
          await sb.from("contact_import_rows").insert(payload);
        }
      : async () => undefined,
  };
}

export async function listRootContactImports(limit = 20) {
  const sb = getSupabase();
  if (await tableExists("contact_import_batches")) {
    const { data, error } = await sb
      .from("contact_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));

    return {
      imports: (data || []).map((row) => ({
        id: String(row.id),
        source: String(row.source) as RootContactImportSource,
        scope: asBusinessScope(row.business_scope),
        status: String(row.status || "completed") as RootContactImportRecord["status"],
        total_rows: Number(row.total_rows || 0),
        created_count: Number(row.created_count || 0),
        updated_count: Number(row.updated_count || 0),
        duplicate_count: Number(row.duplicate_count || 0),
        created_at: String(row.created_at || new Date().toISOString()),
        note: cleanString(row.note),
        source_ref: cleanString(row.source_ref),
        source_mode: "table" as const,
      })),
      error: error?.message || null,
      source_mode: "table" as const,
    };
  }

  const { data, error } = await sb
    .from("events")
    .select("id, type, text, created_at, payload")
    .in("type", ["contacts.imported", "contacts.enriched", "contact.merged"])
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  return {
    imports: (data || []).map((row) => {
      const payload =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};
      return {
        id: String(row.id),
        source: String(payload.source || "csv") as RootContactImportSource,
        scope: asBusinessScope(payload.scope),
        status: "projected" as const,
        total_rows: Number(payload.total_rows || 0),
        created_count: Number(payload.created_count || 0),
        updated_count: Number(payload.updated_count || 0),
        duplicate_count: Number(payload.duplicate_count || 0),
        created_at: String(row.created_at || new Date().toISOString()),
        note: cleanString(row.text),
        source_ref: cleanString(payload.source_ref),
        source_mode: "event" as const,
      };
    }),
    error: error?.message || null,
    source_mode: "event" as const,
  };
}

async function importParsedRows(options: {
  source: RootContactImportSource;
  scope: RootContactImportScope;
  rows: ParsedImportRow[];
  sourceRef?: string | null;
}) {
  const sb = getSupabase();
  const batchId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const businessMappings = await ensureBusinessMappings(options.scope);
  const tracker = await writeImportRowToTables({
    batchId,
    rows: options.rows,
    scope: options.scope,
    source: options.source,
    sourceRef: options.sourceRef || null,
  });

  let createdCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;
  const importedContactIds: string[] = [];
  const stagedRows: Array<Record<string, unknown>> = [];

  for (const row of options.rows) {
    const existing = await findExistingContact(row);
    const metadata = buildImportMetadata(existing, row, options.scope, batchId);
    const payload = {
      full_name: row.full_name,
      name: row.full_name,
      email: row.email || existing?.email || null,
      phone: row.phone || existing?.phone || null,
      company: row.company || existing?.company || null,
      business_unit: cleanString(existing?.business_unit) || primaryBusinessUnit(options.scope),
      client_code: row.client_code || cleanString(existing?.client_code),
      account_code: row.account_code || cleanString(existing?.account_code),
      preferred_channel: derivePreferredChannel(row),
      metadata,
    };

    let contactId = cleanString(existing?.id);
    if (contactId) {
      duplicateCount += 1;
      updatedCount += 1;
      const { data, error } = await sb.from("contacts").update(payload).eq("id", contactId).select("id").single();
      if (error) continue;
      contactId = cleanString(data?.id) || contactId;
    } else {
      const { data, error } = await sb.from("contacts").insert(payload).select("id").single();
      if (error || !data?.id) continue;
      contactId = String(data.id);
      createdCount += 1;
    }

    importedContactIds.push(contactId);
    if (businessMappings.length > 0) {
      await Promise.all(
        businessMappings.map((business) =>
          sb.from("contact_business_map").upsert(
            {
              contact_id: contactId,
              business_id: business.id,
              role: "client",
            },
            { onConflict: "contact_id,business_id" },
          ),
        ),
      );
    }

    stagedRows.push({
      batch_id: batchId,
      contact_id: contactId,
      status: existing ? "matched" : "imported",
      duplicate_match_id: cleanString(existing?.id),
      source_row: row.raw,
      normalized_row: {
        ...payload,
        scope: options.scope,
        source: options.source,
      },
      review_summary: `${row.full_name} · ${row.email || row.phone || "manual review"}`,
    });
  }

  await tracker.persistRows(stagedRows);
  await tracker.updateBatch({
    status: "completed",
    created_count: createdCount,
    updated_count: updatedCount,
    duplicate_count: duplicateCount,
    note: `${createdCount} created · ${updatedCount} updated · ${duplicateCount} matched`,
  });

  if (importedContactIds.length > 0) {
    await Promise.all(importedContactIds.slice(0, 50).map((contactId) => computeLeadScore(contactId)));
  }

  await emitTypedEvent({
    type: "system.sync_completed",
    objectType: "contact",
    objectId: batchId,
    businessUnit: primaryBusinessUnit(options.scope),
    text: `${options.source} import completed`,
    payload: {
      batch_id: batchId,
      source: options.source,
      scope: options.scope,
      total_rows: options.rows.length,
      created_count: createdCount,
      updated_count: updatedCount,
      duplicate_count: duplicateCount,
      source_ref: options.sourceRef || null,
      source_mode: tracker.sourceMode,
    },
  });

  return {
    batch_id: batchId,
    status: "completed" as const,
    source: options.source,
    scope: options.scope,
    total_rows: options.rows.length,
    created_count: createdCount,
    updated_count: updatedCount,
    duplicate_count: duplicateCount,
    imported_contact_ids: importedContactIds,
    source_mode: tracker.sourceMode,
  };
}

export async function importRootContactsFromCsv(options: {
  csv: string;
  scope?: RootContactImportScope;
  sourceRef?: string | null;
}) {
  const rows = parseCsv(options.csv)
    .map((row) => rowToParsedContact(row, "csv"))
    .filter((row): row is ParsedImportRow => Boolean(row));
  return importParsedRows({
    source: "csv",
    scope: options.scope || "CROSS",
    rows,
    sourceRef: options.sourceRef || null,
  });
}

export async function importRootContactsFromGoogle(options?: {
  scope?: RootContactImportScope;
  limit?: number;
}) {
  const payload = await runGoogleWorkspaceCommand(["contacts", "list", "--max", String(options?.limit || 100)]);
  const rows = (Array.isArray(payload) ? payload : [])
    .map((row) => rowToParsedContact((row || {}) as Record<string, unknown>, "google_contacts"))
    .filter((row): row is ParsedImportRow => Boolean(row));
  return importParsedRows({
    source: "google_contacts",
    scope: options?.scope || "CROSS",
    rows,
    sourceRef: GOOGLE_WORKSPACE_SCRIPT,
  });
}

export async function importRootContactsFromSheet(options: {
  sheetId: string;
  range: string;
  scope?: RootContactImportScope;
}) {
  const payload = await runGoogleWorkspaceCommand(["sheets", "get", options.sheetId, options.range]);
  const rows = parseSheetRows(Array.isArray(payload) ? (payload as string[][]) : [])
    .map((row) => rowToParsedContact(row, "google_sheet"))
    .filter((row): row is ParsedImportRow => Boolean(row));
  return importParsedRows({
    source: "google_sheet",
    scope: options.scope || "CROSS",
    rows,
    sourceRef: `${options.sheetId}:${options.range}`,
  });
}

export async function enrichRootContacts(options?: {
  scope?: RootContactImportScope;
  limit?: number;
  contactId?: string | null;
}) {
  const sb = getSupabase();
  const scope = options?.scope || "CROSS";
  const limit = Math.min(Math.max(options?.limit || 200, 1), 750);

  if (options?.contactId) {
    await computeLeadScore(options.contactId);
  } else {
    await batchComputeLeadScores(toRootScope(scope), limit);
  }

  const result = await getRootContacts(limit, toRootScope(scope));
  const contacts = (result.contacts || []).filter((contact) => (options?.contactId ? contact.id === options.contactId : true));

  let updated = 0;
  for (const contact of contacts) {
    const aiSummary = `${contact.full_name} is a ${contact.relationship_band} ${contact.workspace_memberships.join("/") || "shared"} relationship with ${contact.quote_count} quotes and ${contact.open_invoice_count} open invoices.`;
    const derivedScope = contact.workspace_memberships.length > 1 ? "CROSS" : contact.workspace_memberships[0] === "ACS" ? "ACS" : "CCO";
    const preferredChannel =
      cleanString(contact.preferred_channel) ||
      cleanString(contact.conversation_channels?.[0]) ||
      (cleanString(contact.phone) ? "sms" : cleanString(contact.email) ? "email" : "manual_review");
    const clientCode =
      cleanString(contact.client_code) ||
      `${derivedScope === "ACS" ? "ACS" : derivedScope === "CCO" ? "CCO" : "X"}-${String(contact.id).slice(0, 6).toUpperCase()}`;
    const accountCode =
      cleanString(contact.account_code) ||
      `${derivedScope === "ACS" ? "AR-ACS" : derivedScope === "CCO" ? "AR-CCO" : "AR-X"}-${String(contact.id).slice(-4).toUpperCase()}`;

    const enrichment = {
      summary: aiSummary,
      scope: derivedScope,
      relationship_rank: Number(contact.relationship_rank || 0),
      relationship_band: contact.relationship_band,
      next_best_action: contact.next_best_action,
      preferred_channel: preferredChannel,
      refreshed_at: new Date().toISOString(),
    };

    const currentMetadata =
      contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata)
        ? (contact.metadata as Record<string, unknown>)
        : {};

    const { error } = await sb
      .from("contacts")
      .update({
        preferred_channel: preferredChannel,
        client_code: clientCode,
        account_code: accountCode,
        metadata: {
          ...currentMetadata,
          ai_enrichment: enrichment,
          preferences_summary: contact.preferences_summary || currentMetadata.preferences_summary || null,
        },
      })
      .eq("id", contact.id);

    if (!error) updated += 1;
  }

  await emitTypedEvent({
    type: "automation.completed",
    objectType: "contact",
    objectId: options?.contactId || `batch_${Date.now()}`,
    businessUnit: primaryBusinessUnit(scope),
    text: `Contact enrichment refreshed for ${updated} contacts`,
    payload: {
      scope,
      updated,
      requested_limit: limit,
      single_contact_id: options?.contactId || null,
    },
  });

  return {
    ok: true,
    scope,
    updated,
    reviewed: contacts.length,
  };
}

export async function mergeRootContacts(input: { sourceId: string; targetId: string }) {
  const result = await mergeContacts(input.sourceId, input.targetId);
  return result;
}

export const __rootContactOpsTestUtils = {
  asBusinessScope,
  derivePreferredChannel,
  deriveTags,
  parseCsv,
  parseSheetRows,
  rowToParsedContact,
};
