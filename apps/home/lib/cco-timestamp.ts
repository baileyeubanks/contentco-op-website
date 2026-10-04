/** Compare RFC3339 instants at PostgreSQL microsecond precision without changing
 * hashed snapshot bytes. Reject unsupported precision and normalized invalid dates. */
export function timestampMicros(value: unknown): bigint | null {
    if (typeof value !== "string")
        return null;
    const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
    if (!parts)
        return null;
    const wall = parts[1];
    const milliseconds = Date.parse(`${wall}Z`);
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 19) !== wall)
        return null;
    const hours = Number(parts[5] || 0);
    const minutes = Number(parts[6] || 0);
    if (hours > 23 || minutes > 59)
        return null;
    const offsetMinutes = (hours * 60 + minutes) * (parts[4] === "-" ? -1 : 1);
    return BigInt(milliseconds) * 1000n + BigInt((parts[2] || "").padEnd(6, "0")) - BigInt(offsetMinutes) * 60000000n;
}
export function sameTimestampInstant(left: unknown, right: unknown): boolean {
    const a = timestampMicros(left);
    const b = timestampMicros(right);
    return a !== null && b !== null && a === b;
}
/** Canonical UTC payload spelling only; never mutate frozen snapshot bytes. */
export function canonicalTimestamp(value: unknown): string | null {
    const micros = timestampMicros(value);
    if (micros === null) return null;
    let milliseconds = micros / 1000n;
    if (micros % 1000n < 0n) milliseconds -= 1n;
    const iso = new Date(Number(milliseconds)).toISOString();
    if (micros % 1000n === 0n) return iso;
    const fraction = ((micros % 1000000n) + 1000000n) % 1000000n;
    return iso.replace(/\.\d{3}Z$/, `.${fraction.toString().padStart(6, "0")}Z`);
}
