// Run only against an isolated built Next server; all paths use synthetic keys.
import assert from "node:assert/strict";
import { request } from "node:http";
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:44189");
assert.equal(origin.hostname, "127.0.0.1");
assert.equal(origin.protocol, "http:");
function call(path, host, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: origin.hostname, port: origin.port, path, method,
      headers: { Host: host, "X-Forwarded-Host": "evil.example" } }, response => {
      response.resume(); response.on("end", () => resolve({ status: response.statusCode, headers: response.headers }));
    });
    req.on("error", reject); req.setTimeout(10_000, () => req.destroy(new Error("fixture request timed out"))); req.end();
  });
}
let ready = false;
for (let i = 0; i < 120; i++) {
  try { await call("/review/rwsynthetichandoff000", "evil.example"); ready = true; break; }
  catch { await new Promise(resolve => setTimeout(resolve, 500)); }
}
assert.ok(ready, "isolated Next server must start");
let checks = 0;
for (const [path, expectedPath] of [
  ["/review/rwsynthetichandoff000?v=1&next=https%3A%2F%2Fevil.example&v=2&note=one%20two", "/review/rwsynthetichandoff000?v=1&v=2&next=https%3A%2F%2Fevil.example&note=one+two"],
  ["/review-k7qp2m9xa4?a=1&b=2&a=3", "/review-k7qp2m9xa4?a=1&a=3&b=2"],
  ["/weftec-sizzle-v12-k7qp2m9xa4?a=1", "/weftec-sizzle-v12-k7qp2m9xa4?a=1"],
]) for (const host of ["contentco-op.com", "www.contentco-op.com"]) for (const method of ["GET", "HEAD"]) {
  const response = await call(path, host, method);
  assert.equal(response.status, 308);
  assert.equal(response.headers.location, `https://client.contentco-op.com${expectedPath}`);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["referrer-policy"], "no-referrer"); checks++;
}
for (const host of ["evil.example", "client.contentco-op.com", "contentco-op.com.evil.example"]) {
  assert.equal((await call("/review/rwsynthetichandoff000", host)).headers.location, undefined); checks++;
}
for (const path of ["/reviews", "/review", "/review-not-a-key"]) {
  assert.equal((await call(path, "contentco-op.com")).headers.location, undefined); checks++;
}
assert.equal((await call("/review/rwsynthetichandoff000", "contentco-op.com", "POST")).headers.location, undefined); checks++;
assert.equal((await call("/os", "contentco-op.com")).headers.location, "https://admin.contentco-op.com/os"); checks++;
assert.equal((await call("/login", "contentco-op.com")).headers.location, "https://client.contentco-op.com/login"); checks++;
// Must stay relative on the self-hosted server, never expose its bind address.
const adminResponse = await call("/os/overview", "admin.contentco-op.com");
assert.equal(adminResponse.status, 307);
assert.equal(adminResponse.headers.location, "/os"); checks++;
console.log(`Built Next HTTP handoff: ${checks} checks passed; fixed host, no-store, per-key query order and same-origin admin redirect.`);
