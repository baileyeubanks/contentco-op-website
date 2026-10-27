import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const paths = ["/", "/os", "/os/overview", "/os/login", "/login", "/api/os/invoices", "/share/quote/abc?token=x", "/api/webhooks/stripe", "/dashboard/quotes", "/portfolio"];

describe("admin.contentco-op.com through the real proxy", () => {
  it.each(paths)("redirects %s to Co-VideoPro without carrying the path", async path => {
    for (const method of ["GET", "HEAD", "POST"]) {
      const res = await proxy(new NextRequest(`http://127.0.0.1:4100${path}`, { method, headers: { host: "admin.contentco-op.com" } }));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://co-videopro.com/");
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("ignores a forged x-forwarded-host on other hosts", async () => {
    const res = await proxy(new NextRequest("http://127.0.0.1:4100/portfolio", { headers: { host: "contentco-op.com", "x-forwarded-host": "admin.contentco-op.com" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("leaves the public marketing host untouched", async () => {
    for (const path of ["/", "/portfolio", "/brief"]) {
      const res = await proxy(new NextRequest(`http://127.0.0.1:4100${path}`, { headers: { host: "contentco-op.com" } }));
      expect(res.status).toBe(200);
    }
  });
});
