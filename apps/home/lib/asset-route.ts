import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

function isSafeSegment(segment: string) {
  return Boolean(segment) && !segment.includes("/") && !segment.includes("\\") && !segment.includes("..");
}

function resolveAssetPath(...segments: string[]) {
  if (!segments.every(isSafeSegment)) {
    return null;
  }

  return path.join(process.cwd(), ...segments);
}

function getMimeType(filename: string) {
  return MIME_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

async function respondWithAsset(
  request: NextRequest | null,
  resolvedPath: string,
  filename: string,
) {
  const fileStat = await stat(resolvedPath);
  const mimeType = getMimeType(filename);

  if (!request) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(fileStat.size),
        "Content-Type": mimeType,
      },
    });
  }

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
    const stream = Readable.toWeb(createReadStream(resolvedPath, { start, end })) as ReadableStream;

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

  const stream = Readable.toWeb(createReadStream(resolvedPath)) as ReadableStream;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(fileStat.size),
      "Content-Type": mimeType,
    },
  });
}

export async function headAsset(...segments: string[]) {
  const filename = segments.at(-1);
  const resolvedPath = filename ? resolveAssetPath(...segments) : null;

  if (!filename || !resolvedPath) {
    return NextResponse.json({ error: "Invalid asset path" }, { status: 400 });
  }

  try {
    return await respondWithAsset(null, resolvedPath, filename);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function getAsset(request: NextRequest, ...segments: string[]) {
  const filename = segments.at(-1);
  const resolvedPath = filename ? resolveAssetPath(...segments) : null;

  if (!filename || !resolvedPath) {
    return NextResponse.json({ error: "Invalid asset path" }, { status: 400 });
  }

  try {
    return await respondWithAsset(request, resolvedPath, filename);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
