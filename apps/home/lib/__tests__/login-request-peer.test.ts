import { Server, IncomingMessage, createServer } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { installLoginPeerBridge, trustedLoginClientIp } from "@/lib/login-request-peer";
import { allowLoginAttempt } from "@/lib/os-login-limits";

installLoginPeerBridge();
function peerRequest(peer: string, cf: string, email = "owner@example.com") {
  const server = new Server();
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", { value: peer });
  const incoming = new IncomingMessage(socket);
  incoming.url = "/api/os/login";
  return new Promise<{ ip: string | null; allowed: boolean }>(resolve => {
    server.on("request", async () => {
      await Promise.resolve();
      const req = new Request("http://localhost/api/os/login", { headers: { "cf-connecting-ip": cf, "x-forwarded-for": cf, "x-real-ip": cf } });
      const ip = trustedLoginClientIp(req);
      resolve({ ip, allowed: Boolean(ip && allowLoginAttempt(ip, email)) });
    });
    server.emit("request", incoming);
  });
}

describe("login socket peer bridge", () => {
  it("limits a LAN requester by its real peer despite cycling forged proxy headers", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await peerRequest("192.168.10.25", `203.0.113.${i}`)).toEqual({ ip: "192.168.10.25", allowed: true });
    }
    expect(await peerRequest("192.168.10.25", "203.0.113.99")).toEqual({ ip: "192.168.10.25", allowed: false });
    expect(await peerRequest("192.168.10.26", "203.0.113.99")).toEqual({ ip: "192.168.10.26", allowed: true });
  });
  it("isolates concurrent request contexts and trusts edge IP only through loopback", async () => {
    const results = await Promise.all([
      peerRequest("127.0.0.1", "203.0.113.41"), peerRequest("192.168.10.27", "203.0.113.42"),
    ]);
    expect(results.map(result => result.ip)).toEqual(["203.0.113.41", "192.168.10.27"]);
    expect(trustedLoginClientIp(new Request("http://localhost"))).toBeNull();
  });
  it("works through an actual HTTP server and an async handler", async () => {
    const server = createServer(async (req, res) => {
      await Promise.resolve();
      res.end(trustedLoginClientIp(new Request("http://localhost/api/os/login", { headers: { "cf-connecting-ip": String(req.headers["cf-connecting-ip"]) } })));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address() as { port: number };
      const response = await fetch(`http://127.0.0.1:${address.port}/api/os/login`, { headers: { "cf-connecting-ip": "203.0.113.43" } });
      expect(await response.text()).toBe("203.0.113.43");
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
