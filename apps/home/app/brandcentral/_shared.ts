import { readFileSync } from "fs";
import { resolve } from "path";

function candidatePaths(relativePath: string) {
  return [
    resolve(process.cwd(), "brandcentral", relativePath),
    resolve(process.cwd(), "public", "brandcentral", relativePath),
  ];
}

export function readBrandcentralHtml(relativePath: string) {
  const match = candidatePaths(relativePath).find((path) => {
    try {
      readFileSync(path, "utf8");
      return true;
    } catch {
      return false;
    }
  });

  if (!match) {
    throw new Error(`brandcentral_html_missing:${relativePath}`);
  }

  return readFileSync(match, "utf8");
}

export function htmlResponse(html: string) {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
