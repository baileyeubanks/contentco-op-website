import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const res = NextResponse.json({ success: true });
  res.cookies.set("cco_session", "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return res;
}

