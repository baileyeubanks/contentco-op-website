import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".webm": "video/webm",
};

const ASSET_ROOT_CANDIDATES = [
  ["content", "video"],
  ["public", "media"],
  ["public", "cc", "video"],
  ["apps", "home", "public", "media"],
  ["apps", "home", "public", "cc", "video"],
  [".next", "standalone", "apps", "home", "content", "video"],
  [".next", "standalone", "apps", "home", "public", "media"],
  [".next", "standalone", "apps", "home", "public", "cc", "video"],
] as const;

async function resolveAssetPath(filename: string) {
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return null;
  }

  for (const segments of ASSET_ROOT_CANDIDATES) {
    const candidate = path.join(process.cwd(), ...segments, filename);
    try {
      const fileStat = await stat(candidate);
      if (fileStat.isFile()) {
        return { filePath: candidate, fileStat };
      }
    } catch {
      // Try the next candidate root.
    }
  }

  return null;
}

function getMimeType(filename: string) {
  return MIME_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

export async function HEAD(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const resolved = await resolveAssetPath(filename);

  if (!resolved) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(resolved.fileStat.size),
      "Content-Type": getMimeType(filename),
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const resolved = await resolveAssetPath(filename);

  if (!resolved) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  try {
    const { filePath, fileStat } = resolved;
    const mimeType = getMimeType(filename);
    const range = request.headers.get("range");

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);

      if (!match) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileStat.size}` },
        });
      }

      const start = match[1] ? Number.parseInt(match[1], 10) : 0;
      const end = match[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileStat.size) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileStat.size}` },
        });
      }

      const chunkSize = end - start + 1;
      const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;

      return new NextResponse(stream, {
        status: 206,
        headers: {
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
          "Content-Type": mimeType,
        },
      });
    }

    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(fileStat.size),
        "Content-Type": mimeType,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
