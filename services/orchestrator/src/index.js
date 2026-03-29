import http from "node:http";
import { randomUUID } from "node:crypto";
import { runPipeline } from "./steps.js";

const port = Number(process.env.ORCHESTRATOR_PORT || 4300);
const jobs = new Map();
const jobEvents = new Map();
const jobsByIdempotencyKey = new Map();
const defaultRetryPolicy = { maxAttempts: 3, backoffSeconds: 30 };

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

function getJobEvents(jobId) {
  return jobEvents.get(jobId) || [];
}

function appendJobEvent(jobId, type, detail = {}) {
  const event = {
    id: `evt_${randomUUID()}`,
    job_id: jobId,
    type,
    detail,
    created_at: new Date().toISOString(),
  };
  const current = getJobEvents(jobId);
  current.push(event);
  jobEvents.set(jobId, current);
  return event;
}

function summarizeJobs() {
  const summary = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    dead_lettered: 0,
    cancelled: 0,
  };
  for (const job of jobs.values()) {
    summary[job.status] = (summary[job.status] || 0) + 1;
  }
  return summary;
}

function sanitizeJob(job) {
  return {
    ...job,
    events: getJobEvents(job.id),
  };
}

function createJob(payload) {
  const now = new Date().toISOString();
  const id = `job_${randomUUID()}`;
  const steps = Array.isArray(payload.steps) && payload.steps.length
    ? payload.steps
    : ["source_context", "brief_validation", "variant_generation"];
  const job = {
    id,
    workflow_id: payload.workflowId || payload.workflow_id || payload.type || "workflow",
    type: payload.type || "workflow",
    entity: payload.entity || null,
    event: payload.event || null,
    payload,
    idempotency_key: payload.idempotencyKey || payload.idempotency_key || null,
    retry_policy: payload.retry_policy || defaultRetryPolicy,
    status: "queued",
    attempts: 0,
    replay_count: 0,
    created_at: now,
    updated_at: now,
    last_error: null,
    steps,
    last_run_result: null,
    dead_letter: null,
  };
  jobs.set(id, job);
  if (job.idempotency_key) {
    jobsByIdempotencyKey.set(job.idempotency_key, id);
  }
  appendJobEvent(id, "job.queued", {
    workflow_id: job.workflow_id,
    idempotency_key: job.idempotency_key,
  });
  return job;
}

async function executeJob(job, reason = "run") {
  job.attempts += 1;
  job.status = "running";
  job.updated_at = new Date().toISOString();
  appendJobEvent(job.id, "job.running", { reason, attempts: job.attempts });

  try {
    const result = await runPipeline(job, job.steps);
    const failed = Array.isArray(result.errors) && result.errors.length > 0;

    job.last_run_result = result;
    job.updated_at = new Date().toISOString();

    if (failed) {
      job.last_error = result.errors[result.errors.length - 1] || "workflow_failed";
      if (job.attempts >= job.retry_policy.maxAttempts) {
        job.status = "dead_lettered";
        job.dead_letter = {
          job_id: job.id,
          workflow_id: job.workflow_id,
          reason: "max_attempts_exhausted",
          last_error: job.last_error,
          attempts: job.attempts,
          moved_at: new Date().toISOString(),
        };
        appendJobEvent(job.id, "job.dead_lettered", job.dead_letter);
      } else {
        job.status = "failed";
        appendJobEvent(job.id, "job.failed", {
          attempts: job.attempts,
          last_error: job.last_error,
        });
      }
    } else {
      job.status = "completed";
      job.last_error = null;
      appendJobEvent(job.id, "job.completed", {
        attempts: job.attempts,
        replay_count: job.replay_count,
      });
    }

    return sanitizeJob(job);
  } catch (error) {
    job.updated_at = new Date().toISOString();
    job.last_error = error instanceof Error ? error.message : "unknown_error";
    if (job.attempts >= job.retry_policy.maxAttempts) {
      job.status = "dead_lettered";
      job.dead_letter = {
        job_id: job.id,
        workflow_id: job.workflow_id,
        reason: "exception",
        last_error: job.last_error,
        attempts: job.attempts,
        moved_at: new Date().toISOString(),
      };
      appendJobEvent(job.id, "job.dead_lettered", job.dead_letter);
    } else {
      job.status = "failed";
      appendJobEvent(job.id, "job.failed", {
        attempts: job.attempts,
        last_error: job.last_error,
      });
    }
    return sanitizeJob(job);
  }
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://localhost:${port}`);

  if (method === "GET" && url.pathname === "/health") {
    return json(res, 200, {
      status: "ok",
      service: "orchestrator",
      summary: summarizeJobs(),
      totals: { jobs: jobs.size, idempotency_keys: jobsByIdempotencyKey.size },
    });
  }

  if (method === "POST" && url.pathname === "/jobs") {
    const payload = await readBody(req).catch(() => null);
    if (!payload) return json(res, 400, { error: "Invalid JSON" });

    const idempotencyKey = payload.idempotencyKey || payload.idempotency_key || null;
    if (idempotencyKey && jobsByIdempotencyKey.has(idempotencyKey)) {
      const existingJob = jobs.get(jobsByIdempotencyKey.get(idempotencyKey));
      return json(res, 200, { deduped: true, job: sanitizeJob(existingJob) });
    }

    const job = createJob(payload);
    return json(res, 202, sanitizeJob(job));
  }

  if (method === "GET" && url.pathname === "/jobs") {
    return json(res, 200, {
      items: Array.from(jobs.values()).map(sanitizeJob),
      summary: summarizeJobs(),
    });
  }

  if (method === "GET" && /^\/jobs\/[^/]+$/.test(url.pathname)) {
    const id = url.pathname.split("/")[2];
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: "Job not found" });
    return json(res, 200, sanitizeJob(job));
  }

  if (method === "GET" && /^\/jobs\/[^/]+\/events$/.test(url.pathname)) {
    const id = url.pathname.split("/")[2];
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: "Job not found" });
    return json(res, 200, { job_id: id, events: getJobEvents(id) });
  }

  if (method === "POST" && /^\/jobs\/[^/]+\/run$/.test(url.pathname)) {
    const id = url.pathname.split("/")[2];
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: "Job not found" });
    const result = await executeJob(job, "run");
    return json(res, 200, result);
  }

  if (method === "POST" && /^\/jobs\/[^/]+\/replay$/.test(url.pathname)) {
    const id = url.pathname.split("/")[2];
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: "Job not found" });
    job.replay_count += 1;
    job.status = "queued";
    job.updated_at = new Date().toISOString();
    appendJobEvent(job.id, "job.replay_requested", { replay_count: job.replay_count });
    const result = await executeJob(job, "replay");
    return json(res, 200, result);
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  process.stdout.write(`orchestrator listening on ${port}\n`);
});
