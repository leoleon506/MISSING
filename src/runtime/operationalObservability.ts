import { distributedMoneySnapshot } from "./distributedMoney.js";
import { settledReorgMonitorSnapshot } from "./settledReorgMonitor.js";

export type OperationalSignalLevel = "ok" | "warning" | "critical";

export interface OperationalSignal {
  name: string;
  level: OperationalSignalLevel;
  value: number | string | boolean | null;
  threshold: number | string | boolean | null;
  reason: string;
}

function nonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function operationalSloThresholds() {
  return {
    pool_waiting_warning: nonNegativeInteger(process.env.MISSING_SLO_POOL_WAITING_WARNING, 25),
    pool_waiting_critical: nonNegativeInteger(process.env.MISSING_SLO_POOL_WAITING_CRITICAL, 100),
    ambiguous_critical: nonNegativeInteger(process.env.MISSING_SLO_AMBIGUOUS_CRITICAL, 1),
    failed_warning: nonNegativeInteger(process.env.MISSING_SLO_FAILED_WARNING, 1),
  };
}

export function evaluateOperationalSignals(input: {
  money: ReturnType<typeof distributedMoneySnapshot>;
  monitor: ReturnType<typeof settledReorgMonitorSnapshot>;
}): OperationalSignal[] {
  const t = operationalSloThresholds();
  const waiting = input.money.pool_waiting;
  const signals: OperationalSignal[] = [];

  signals.push({
    name: "postgres_pool_waiting",
    level: waiting >= t.pool_waiting_critical ? "critical" : waiting >= t.pool_waiting_warning ? "warning" : "ok",
    value: waiting,
    threshold: waiting >= t.pool_waiting_critical ? t.pool_waiting_critical : t.pool_waiting_warning,
    reason: waiting >= t.pool_waiting_critical ? "postgres pool queue exceeded critical saturation threshold" : waiting >= t.pool_waiting_warning ? "postgres pool queue exceeded warning saturation threshold" : "postgres pool queue below warning threshold",
  });

  signals.push({
    name: "ambiguous_payments",
    level: input.money.ambiguous >= t.ambiguous_critical ? "critical" : "ok",
    value: input.money.ambiguous,
    threshold: t.ambiguous_critical,
    reason: input.money.ambiguous >= t.ambiguous_critical ? "one or more payments require fail-closed operator attention" : "no ambiguous payments above threshold",
  });

  signals.push({
    name: "failed_payments",
    level: input.money.failed >= t.failed_warning ? "warning" : "ok",
    value: input.money.failed,
    threshold: t.failed_warning,
    reason: input.money.failed >= t.failed_warning ? "failed payment count reached warning threshold" : "failed payment count below warning threshold",
  });

  const monitorError = input.monitor.last_error;
  signals.push({
    name: "settled_reorg_monitor_error",
    level: monitorError ? "critical" : "ok",
    value: monitorError,
    threshold: null,
    reason: monitorError ? "post-settlement reorg monitor has a recorded error" : "no post-settlement monitor error",
  });

  if (input.money.enabled) {
    signals.push({
      name: "settled_reorg_monitor_enabled",
      level: input.monitor.enabled ? "ok" : "warning",
      value: input.monitor.enabled,
      threshold: true,
      reason: input.monitor.enabled ? "post-settlement monitoring is enabled" : "distributed money is enabled while post-settlement monitoring is disabled",
    });
  }

  return signals;
}

export function operationalMetricsSnapshot() {
  const money = distributedMoneySnapshot();
  const monitor = settledReorgMonitorSnapshot();
  const signals = evaluateOperationalSignals({ money, monitor });
  return {
    generated_at: new Date().toISOString(),
    money,
    settled_reorg_monitor: monitor,
    thresholds: operationalSloThresholds(),
    signals,
    status: signals.some(signal => signal.level === "critical") ? "critical" as const : signals.some(signal => signal.level === "warning") ? "warning" as const : "ok" as const,
  };
}

function metric(name: string, value: number | boolean): string {
  return `missing_${name} ${typeof value === "boolean" ? (value ? 1 : 0) : value}`;
}

export function operationalPrometheusMetrics(): string {
  const snapshot = operationalMetricsSnapshot();
  const money = snapshot.money;
  const monitor = snapshot.settled_reorg_monitor;
  const lines = [
    "# TYPE missing_postgres_pool_total gauge",
    metric("postgres_pool_total", money.pool_total),
    "# TYPE missing_postgres_pool_idle gauge",
    metric("postgres_pool_idle", money.pool_idle),
    "# TYPE missing_postgres_pool_waiting gauge",
    metric("postgres_pool_waiting", money.pool_waiting),
    "# TYPE missing_x402_payments_total gauge",
    metric("x402_payments_total", money.payments),
    metric("x402_payments_reserved", money.reserved),
    metric("x402_payments_executing", money.executing),
    metric("x402_payments_provider_done", money.provider_done),
    metric("x402_payments_settling", money.settling),
    metric("x402_payments_settled", money.settled),
    metric("x402_payments_ambiguous", money.ambiguous),
    metric("x402_payments_failed", money.failed),
    metric("x402_request_bound", money.request_bound),
    metric("x402_legacy_unbound", money.legacy_unbound),
    metric("x402_settled_reorg_monitor_enabled", monitor.enabled),
    metric("x402_settled_reorg_monitor_running", monitor.running),
    metric("x402_settled_reorg_monitor_last_error", Boolean(monitor.last_error)),
  ];
  for (const signal of snapshot.signals) {
    lines.push(`missing_slo_signal{name="${signal.name}",level="${signal.level}"} 1`);
  }
  return `${lines.join("\n")}\n`;
}
