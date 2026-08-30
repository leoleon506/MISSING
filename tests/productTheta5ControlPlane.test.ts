import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeControlPlane, controlPlaneCycleOptions, controlPlaneEnabled } from "../src/runtime/controlPlane.js";
import { runTrustedWorkerCycle } from "../src/worker/acquisitionWorker.js";

afterEach(() => {
  delete process.env.MISSING_CONTROL_PLANE_TOKEN;
  delete process.env.MISSING_CONTROL_PLANE_CANDIDATE_LIMIT;
  delete process.env.MISSING_CONTROL_PLANE_TIMEOUT_MS;
});

describe("MISSING Product Theta.5 trusted worker control plane", () => {
  it("stays disabled without a sufficiently strong token", () => {
    expect(controlPlaneEnabled()).toBe(false);
    process.env.MISSING_CONTROL_PLANE_TOKEN = "short";
    expect(controlPlaneEnabled()).toBe(false);
  });

  it("authorizes only the exact bearer token", () => {
    const token = "a".repeat(48);
    process.env.MISSING_CONTROL_PLANE_TOKEN = token;
    expect(controlPlaneEnabled()).toBe(true);
    expect(authorizeControlPlane(`Bearer ${token}`)).toBe(true);
    expect(authorizeControlPlane(`Bearer ${"b".repeat(48)}`)).toBe(false);
    expect(authorizeControlPlane(undefined)).toBe(false);
  });

  it("bounds trusted cycle configuration", () => {
    process.env.MISSING_CONTROL_PLANE_CANDIDATE_LIMIT = "999";
    process.env.MISSING_CONTROL_PLANE_TIMEOUT_MS = "1";
    expect(controlPlaneCycleOptions()).toEqual({ candidateLimit: 20, timeoutMs: 100 });
  });

  it("worker sends an authenticated POST to the private control-plane endpoint", async () => {
    const token = "c".repeat(48);
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://missing.railway.internal:8080/internal/acquisition/run");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${token}`);
      return new Response(JSON.stringify({ status: "no_candidates", trace: [] }), { status: 200 });
    });
    const result = await runTrustedWorkerCycle({
      runtimeUrl: "http://missing.railway.internal:8080/",
      token,
      fetchFn: fetchFn as typeof fetch,
      timeoutMs: 1000,
    });
    expect(result.status).toBe("no_candidates");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("fails closed on an invalid control-plane response", async () => {
    const token = "d".repeat(48);
    await expect(runTrustedWorkerCycle({
      runtimeUrl: "http://missing.railway.internal:8080",
      token,
      fetchFn: async () => new Response(JSON.stringify({ status: "mystery" }), { status: 200 }),
    })).rejects.toThrow("invalid acquisition result");
  });
});
