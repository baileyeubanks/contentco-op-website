export function clientQuoteReturnUrl(id: string, token: string, origin: string): string {
  const url = new URL("/client/quote/" + encodeURIComponent(id), origin);
  url.searchParams.set("t", token);
  return url.toString();
}
