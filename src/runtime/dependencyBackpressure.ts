export type DependencyKind = "facilitator_verify" | "facilitator_settle" | "rpc";

export class DependencyBackpressureError extends Error {
  constructor(
    public readonly dependency: DependencyKind,
    public readonly reason: "saturated" | "circuit_open",
  ) {
    super(`dependency_${dependency}_${reason}`);
    this.name = "DependencyBackpressureError";
  }
}

export class DependencyTimeoutError extends Error {
  constructor(
    public readonly dependency: DependencyKind,
    public readonly timeoutMs: number,
  ) {
    super(`dependency_${dependency}_timeout`);
    this.name = "DependencyTimeoutError";
  }
}

type DependencyState = {
  inFlight: number;
  consecutiveFailures: number;
  circuitOpenedAt: number | null;
  rejectedSaturated: number;
  rejectedCircuitOpen: number;
  started: number;
  succeeded: number;
  failed: number;
  timedOut: number;
};

const states: Record<DependencyKind, DependencyState> = {
  facilitator_verify: freshState(),
  facilitator_settle: freshState(),
  rpc: freshState(),
};

function freshState(): DependencyState {
  return {
    inFlight: 0,
    consecutiveFailures: 0,
    circuitOpenedAt: null,
    rejectedSaturated: 0,
    rejectedCircuitOpen: 0,
    started: 0,
    succeeded: 0,
    failed: 0,
    timedOut: 0,
  };
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function maxInFlight(kind: DependencyKind): number {
  if (kind === "rpc") return positiveInteger("MISSING_RPC_MAX_IN_FLIGHT", 32);
  return positiveInteger("MISSING_FACILITATOR_MAX_IN_FLIGHT", 32);
}

function failureThreshold(kind: DependencyKind): number {
  if (kind === "rpc") return positiveInteger("MISSING_RPC_CIRCUIT_FAILURE_THRESHOLD", 5);
  return positiveInteger("MISSING_FACILITATOR_CIRCUIT_FAILURE_THRESHOLD", 5);
}

function cooldownMs(kind: DependencyKind): number {
  if (kind === "rpc") return positiveInteger("MISSING_RPC_CIRCUIT_COOLDOWN_MS", 1_000);
  return positiveInteger("MISSING_FACILITATOR_CIRCUIT_COOLDOWN_MS", 1_000);
}

export function dependencyDeadlineMs(kind: DependencyKind): number {
  if (kind === "rpc") return positiveInteger("MISSING_RPC_TIMEOUT_MS", 10_000);
  return positiveInteger("MISSING_FACILITATOR_TIMEOUT_MS", 10_000);
}

export function dependencyBackpressureEnabled(): boolean {
  return process.env.MISSING_DEPENDENCY_BACKPRESSURE_ENABLED !== "0";
}

export function dependencyDeadlinesEnabled(): boolean {
  return process.env.MISSING_DEPENDENCY_DEADLINES_ENABLED !== "0";
}

function maybeResetCircuit(kind: DependencyKind, now: number) {
  const state = states[kind];
  if (state.circuitOpenedAt === null) return;
  if (now - state.circuitOpenedAt >= cooldownMs(kind)) {
    state.circuitOpenedAt = null;
    state.consecutiveFailures = 0;
  }
}

async function executeWithDeadline<T>(kind: DependencyKind, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  if (!dependencyDeadlinesEnabled()) return operation(controller.signal);

  const timeoutMs = dependencyDeadlineMs(kind);
  const timeoutError = new DependencyTimeoutError(kind, timeoutMs);
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } catch (error) {
    // A fetch may surface its own AbortError before the timeout promise wins the
    // race. Preserve a deterministic dependency timeout classification.
    if (timedOut) throw timeoutError;
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function runDependencyOperation<T>(
  kind: DependencyKind,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const backpressureEnabled = dependencyBackpressureEnabled();
  const state = states[kind];
  const now = Date.now();
  if (backpressureEnabled) {
    maybeResetCircuit(kind, now);

    if (state.circuitOpenedAt !== null) {
      state.rejectedCircuitOpen += 1;
      throw new DependencyBackpressureError(kind, "circuit_open");
    }
    if (state.inFlight >= maxInFlight(kind)) {
      state.rejectedSaturated += 1;
      throw new DependencyBackpressureError(kind, "saturated");
    }
  }

  state.inFlight += 1;
  state.started += 1;
  try {
    const result = await executeWithDeadline(kind, operation);
    state.succeeded += 1;
    if (backpressureEnabled) {
      state.consecutiveFailures = 0;
      state.circuitOpenedAt = null;
    }
    return result;
  } catch (error) {
    state.failed += 1;
    if (error instanceof DependencyTimeoutError) state.timedOut += 1;
    if (backpressureEnabled) {
      state.consecutiveFailures += 1;
      if (state.consecutiveFailures >= failureThreshold(kind)) state.circuitOpenedAt = Date.now();
    }
    throw error;
  } finally {
    state.inFlight -= 1;
  }
}

export function dependencyBackpressureSnapshot() {
  const now = Date.now();
  for (const kind of Object.keys(states) as DependencyKind[]) maybeResetCircuit(kind, now);
  return {
    enabled: dependencyBackpressureEnabled(),
    deadlines_enabled: dependencyDeadlinesEnabled(),
    dependencies: Object.fromEntries((Object.keys(states) as DependencyKind[]).map(kind => {
      const state = states[kind];
      return [kind, {
        ...state,
        max_in_flight: maxInFlight(kind),
        failure_threshold: failureThreshold(kind),
        cooldown_ms: cooldownMs(kind),
        timeout_ms: dependencyDeadlineMs(kind),
        circuit_open: state.circuitOpenedAt !== null,
      }];
    })),
  };
}

/** Test/proof-only reset so formal drills do not inherit breaker state between scenarios. */
export function resetDependencyBackpressureForTest() {
  for (const kind of Object.keys(states) as DependencyKind[]) Object.assign(states[kind], freshState());
}
