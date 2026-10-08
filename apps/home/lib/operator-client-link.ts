// Browser helper. Signing happens only in the operator-gated issuance action.
export async function requestOperatorClientLink(typ: "quote" | "invoice", id: string): Promise<string> {
  const resource = typ === "quote" ? "quotes" : "invoices";
  const res = await fetch(`/api/os/${resource}/${encodeURIComponent(id)}/share-link`, { method: "POST" });
  const body = await res.json();
  if (!res.ok || typeof body.share_link_url !== "string") throw new Error("Share link unavailable");
  return body.share_link_url;
}
export async function copyOperatorClientLink(typ: "quote" | "invoice", id: string): Promise<void> {
  await navigator.clipboard.writeText(await requestOperatorClientLink(typ, id));
}
