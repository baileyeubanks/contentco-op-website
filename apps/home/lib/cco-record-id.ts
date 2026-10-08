import { createHash } from "node:crypto";

/** Stable, namespaced UUIDv8 for server-owned replay keys (never an access token). */
export function ccoRecordId(kind: string, key: string): string {
  const bytes = createHash("sha256").update(JSON.stringify(["cco.record.v1", kind, key])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
