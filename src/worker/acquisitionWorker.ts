import { pathToFileURL } from "node:url";

export interface WorkerCycleResult {
  status: "promoted" | "rejected" | "needs_evidence" | "no_candidates";
  [key: string]: unknown;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function runTrustedWorkerCycle(options: {
  runtimeUrl?: string;
  token?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
} = {}): Promise<WorkerCycleResult> {
  const runtimeUrl = (options.runtimeUrl ?? required("MISSING_RUNTIME_URL")).replace(/\/$/, "");
  const token = options.token ?? required("MISSING_CONTROL_PLANE_TOKEN");
  if (token.length < 32) throw new Error("MISSING_CONTROL_PLANE_TOKEN must be at least 32 characters");
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(`${runtimeUrl}/internal/acquisition/run`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "user-agent": "MISSING-Theta5-Worker/0.2",
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`MISSING control plane returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  const parsed = JSON.parse(text) as WorkerCycleResult;
  if (!parsed || typeof parsed !== "object" || !["promoted", "rejected", "needs_evidence", "no_candidates"].includes(parsed.status)) {
    throw new Error("MISSING control plane returned an invalid acquisition result");
  }
  return parsed;
}

export async function main() {
  const result = await runTrustedWorkerCycle();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
