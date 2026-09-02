import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import {
  closeDistributedMoney,
  distributedMoneySnapshot,
  initializeDistributedMoney,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";
import { settledReorgMonitorSnapshot } from "./runtime/settledReorgMonitor.js";
import {
  evaluateOperationalSignals,
  operationalMetricsSnapshot,
  operationalPrometheusMetrics,
} from "./runtime/operationalObservability.js";

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_SETTLED_REORG_MONITOR_ENABLED = "1";
process.env.MISSING_SLO_POOL_WAITING_WARNING = "1";
process.env.MISSING_SLO_POOL_WAITING_CRITICAL = "2";
process.env.MISSING_SLO_AMBIGUOUS_CRITICAL = "1";
process.env.MISSING_SLO_FAILED_WARNING = "1";

const databaseUrl = process.env.MISSING_POSTGRES_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Operational Readiness 2 requires PostgreSQL");

await initializeDistributedMoney();
await truncateDistributedMoney();

const pool = new Pool({ connectionString: databaseUrl, max: 2, application_name: "missing-or2-proof" });
await pool.query(`
  INSERT INTO missing_x402_payments(payment_hash,request_hash,execution_id,capability,state,recovery_protocol_version)
  VALUES
    ('or2-ambiguous','or2-request-1','or2-exec-1','or2_observability','ambiguous',1),
    ('or2-failed','or2-request-2','or2-exec-2','or2_observability','failed',1),
    ('or2-settled','or2-request-3','or2-exec-3','or2_observability','settled',1),
    ('or2-reserved','or2-request-4','or2-exec-4','or2_observability','reserved',1)
`);
await pool.end();

await initializeDistributedMoney();
const money = distributedMoneySnapshot();
const monitor = settledReorgMonitorSnapshot();
const metricsSnapshot = operationalMetricsSnapshot();
const prometheus = operationalPrometheusMetrics();

const injectedSaturation = evaluateOperationalSignals({
  money: { ...money, pool_waiting: 3 },
  monitor: { ...monitor, last_error: "synthetic_rpc_outage_for_alert_proof" },
});

const signal = (name: string) => injectedSaturation.find(item => item.name === name);
const assertions = {
  real_database_state_is_visible: money.payments === 4 && money.ambiguous === 1 && money.failed === 1 && money.settled === 1 && money.reserved === 1,
  ambiguous_payment_is_critical: metricsSnapshot.signals.some(item => item.name === "ambiguous_payments" && item.level === "critical"),
  failed_payment_is_warning: metricsSnapshot.signals.some(item => item.name === "failed_payments" && item.level === "warning"),
  pool_saturation_crosses_critical_threshold: signal("postgres_pool_waiting")?.level === "critical",
  monitor_error_is_critical: signal("settled_reorg_monitor_error")?.level === "critical",
  prometheus_exposes_money_states: prometheus.includes("missing_x402_payments_ambiguous 1") && prometheus.includes("missing_x402_payments_failed 1") && prometheus.includes("missing_x402_payments_settled 1"),
  prometheus_exposes_pool_and_monitor: prometheus.includes("missing_postgres_pool_waiting") && prometheus.includes("missing_x402_settled_reorg_monitor_enabled 1"),
  machine_readable_status_is_critical: metricsSnapshot.status === "critical",
};

const passed = Object.values(assertions).every(Boolean);
const artifact = {
  product: "Operational Readiness 2",
  invariant: "distributed-money operational hazards are machine-visible as structured SLO signals and Prometheus metrics",
  observed: {
    money,
    monitor,
    status: metricsSnapshot.status,
    signals: metricsSnapshot.signals,
    injected_saturation_signals: injectedSaturation,
    prometheus_sample: prometheus.split("\n").filter(Boolean),
  },
  assertions,
  result: passed ? "GO_OPERATIONAL_OBSERVABILITY_SLO" : "NO_GO_OPERATIONAL_OBSERVABILITY_SLO",
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/operational-readiness-2-observability-slo.json", `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: artifact.result, assertions, status: metricsSnapshot.status }, null, 2));
closeDistributedMoney();
if (!passed) process.exitCode = 1;
