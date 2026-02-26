import http from "node:http";
import { runPipeline } from "./steps.js";

const port = Number(process.env.ORCHESTRATOR_PORT || 4300);
const queue = [];

function json(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://localhost:${port}`);

  if (method === "GET" && url.pathname === "/health") {
    return json(res, 200, { status: "ok", service: "orchestrator" });
  }

  if (method === "POST" && url.pathname === "/jobs") {
    const payload = await readBody(req).catch(() => null);
    if (!payload) return json(res, 400, { error: "Invalid JSON" });

    const job = {
      id: `job_${Date.now()}`,
      type: payload.type || "script_generate",
      payload,
      status: "queued",
      created_at: new Date().toISOString()
    };
    queue.push(job);
    return json(res, 202, job);
  }

  if (method === "POST" && url.pathname.startsWith("/jobs/") && url.pathname.endsWith("/run")) {
    const id = url.pathname.split("/")[2];
    const job = queue.find((item) => item.id === id);
    if (!job) return json(res, 404, { error: "Job not found" });

    const steps = Array.isArray(job.payload?.steps)
      ? job.payload.steps
      : ["source_context", "brief_validation", "variant_generation"];

    const result = await runPipeline(job, steps);
    result.status = result.errors?.length ? "failed" : "completed";
    result.finished_at = new Date().toISOString();
    return json(res, 200, result);
  }

  if (method === "GET" && url.pathname === "/jobs") {
    return json(res, 200, { items: queue });
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  process.stdout.write(`orchestrator listening on ${port}\n`);
});

