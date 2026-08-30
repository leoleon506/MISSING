import { timingSafeEqual } from "node:crypto";

const MIN_TOKEN_LENGTH = 32;

export function controlPlaneToken(): string | null {
  const value = process.env.MISSING_CONTROL_PLANE_TOKEN?.trim();
  return value && value.length >= MIN_TOKEN_LENGTH ? value : null;
}

export function controlPlaneEnabled(): boolean {
  return controlPlaneToken() !== null;
}

export function authorizeControlPlane(authorization: string | undefined): boolean {
  const expected = controlPlaneToken();
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length).trim();
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length) return false;
  return timingSafeEqual(expectedBytes, suppliedBytes);
}

export function controlPlaneCycleOptions() {
  const rawLimit = Number(process.env.MISSING_CONTROL_PLANE_CANDIDATE_LIMIT ?? 5);
  const rawTimeout = Number(process.env.MISSING_CONTROL_PLANE_TIMEOUT_MS ?? 8000);
  return {
    candidateLimit: Number.isInteger(rawLimit) ? Math.max(1, Math.min(rawLimit, 20)) : 5,
    timeoutMs: Number.isInteger(rawTimeout) ? Math.max(100, Math.min(rawTimeout, 30000)) : 8000,
  };
}
