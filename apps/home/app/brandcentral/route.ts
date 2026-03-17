import { htmlResponse, readBrandcentralHtml } from "./_shared";

export const dynamic = "force-static";

export async function GET() {
  return htmlResponse(readBrandcentralHtml("index.html"));
}
