import type { NextFunction, Request, Response } from "express";

export interface SandboxSnapshot {
  started_at: string;
  requests_total: number;
  rate_limited_total: number;
  by_protocol: Record<string, number>;
  by_status_class: Record<string, number>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const startedAt = new Date().toISOString();
const buckets = new Map<string, Bucket>();
const telemetry: SandboxSnapshot = {
  started_at: startedAt,
  requests_total: 0,
  rate_limited_total: 0,
  by_protocol: {},
  by_status_class: {},
};

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function sandboxConfig() {
  return {
    enabled: process.env.MISSING_SANDBOX_ENABLED !== "0",
    requests_per_window: positiveInteger(process.env.MISSING_SANDBOX_REQUESTS_PER_WINDOW, 60),
    window_ms: positiveInteger(process.env.MISSING_SANDBOX_WINDOW_MS, 60_000),
  };
}

function protocolOf(req: Request): string {
  if (req.path === "/mcp") return "mcp";
  if (req.path === "/.well-known/agent-card.json") return "agent-card";
  if (req.path === "/healthz" || req.path === "/livez" || req.path === "/readyz" || req.path === "/sandboxz") return "control";
  return req.method === "POST" ? "a2a" : "other";
}

export function sandboxMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = sandboxConfig();
  const protocol = protocolOf(req);
  telemetry.requests_total += 1;
  telemetry.by_protocol[protocol] = (telemetry.by_protocol[protocol] ?? 0) + 1;

  res.on("finish", () => {
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    telemetry.by_status_class[statusClass] = (telemetry.by_status_class[statusClass] ?? 0) + 1;
  });

  if (!config.enabled || protocol === "control" || protocol === "agent-card") return next();

  const now = Date.now();
  const client = req.ip || req.socket.remoteAddress || "unknown";
  const existing = buckets.get(client);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + config.window_ms }
    : existing;

  if (bucket.count >= config.requests_per_window) {
    telemetry.rate_limited_total += 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({ error: "sandbox_rate_limit", retry_after_seconds: retryAfterSeconds });
    return;
  }

  bucket.count += 1;
  buckets.set(client, bucket);
  next();
}

export function sandboxSnapshot(): SandboxSnapshot {
  return {
    started_at: telemetry.started_at,
    requests_total: telemetry.requests_total,
    rate_limited_total: telemetry.rate_limited_total,
    by_protocol: { ...telemetry.by_protocol },
    by_status_class: { ...telemetry.by_status_class },
  };
}

export function resetSandboxState() {
  buckets.clear();
  telemetry.requests_total = 0;
  telemetry.rate_limited_total = 0;
  telemetry.by_protocol = {};
  telemetry.by_status_class = {};
}
