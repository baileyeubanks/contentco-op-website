export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installLoginPeerBridge } = await import("./lib/login-request-peer");
    installLoginPeerBridge();
  }
}
