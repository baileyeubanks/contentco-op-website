import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

const MANIFEST = resolve(process.cwd(), "public/media/thumbnail-manifest.json");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const surface = url.searchParams.get("surface") || "home";

  if (!existsSync(MANIFEST)) {
    return NextResponse.json({ surface, items: [] });
  }

  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  return NextResponse.json({ surface, items: manifest.approved ?? [] });
}

