import { AsyncLocalStorage } from "node:async_hooks";
import { Server, type IncomingMessage } from "node:http";
import { isIP } from "node:net";

type PeerContext = { storage: AsyncLocalStorage<string>; installed: boolean };
// Instrumentation and route bundles share this process-local context, never a header.
const runtime = globalThis as typeof globalThis & { __ccoLoginPeer?: PeerContext };
function context() {
  return runtime.__ccoLoginPeer ||= { storage: new AsyncLocalStorage<string>(), installed: false };
}

export function installLoginPeerBridge() {
  const state = context();
  if (state.installed) return;
  state.installed = true;
  const emit = Server.prototype.emit as (this: Server, event: string | symbol, ...args: unknown[]) => boolean;
  Server.prototype.emit = function (event: string | symbol, ...args: unknown[]) {
    const req = args[0] as IncomingMessage | undefined;
    if (event === "request" && req?.url?.split("?")[0] === "/api/os/login") {
      return state.storage.run(req.socket.remoteAddress || "unknown", () => emit.call(this, event, ...args));
    }
    return emit.call(this, event, ...args);
  };
}

export function trustedLoginClientIp(req: Request): string | null {
  const peer = context().storage.getStore();
  if (!peer || !isIP(peer)) return null;
  const loopback = peer === "::1" || peer === "::ffff:127.0.0.1" || peer === "127.0.0.1";
  const cf = req.headers.get("cf-connecting-ip") || "";
  return loopback && isIP(cf) ? cf : peer;
}
