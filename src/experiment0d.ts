import { Client, InMemoryTransport, type Tool } from "@modelcontextprotocol/client";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadCases } from "./benchmark/load.js";
import { loadConfig } from "./config/index.js";
import { createBenchmarkServer } from "./mcp/server.js";
import { OpenAICapabilityGateway, type GatewayDecision } from "./capability-gateway.js";

const config = loadConfig();
if (!config.apiKey) {
  console.error("OPENAI_API_KEY is required for Experiment 0D.");
  process.exit(1);
}

const cases = await loadCases(resolve("experiments/experiment-0d/cases.json"));
const server = createBenchmarkServer({ includeMissing: false, missingDescription: "unused" });
const client = new Client({ name: "missing-gateway-benchmark", version: "0.3.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
const tools = (await client.listTools()).tools as Tool[];
const gateway = new OpenAICapabilityGateway(config);

const results: Array<{
  case_id: string;
  ground_truth: string;
  case_family: string;
  expected_tool?: string;
  user_task: string;
  decision: GatewayDecision;
  correct_coverage: boolean;
  correct_tool: boolean | null;
}> = [];

for (const testCase of cases) {
  const decision = await gateway.resolve(testCase.user_task, tools);
  const shouldBeMissing = testCase.ground_truth === "requires_missing";
  const correctCoverage = shouldBeMissing ? decision.decision === "MISSING" : decision.decision === "ROUTE_EXISTING";
  const correctTool = shouldBeMissing ? null : decision.decision === "ROUTE_EXISTING" && decision.tool_name === testCase.expected_tool;
  results.push({
    case_id: testCase.case_id,
    ground_truth: testCase.ground_truth,
    case_family: testCase.case_family,
    expected_tool: testCase.expected_tool,
    user_task: testCase.user_task,
    decision,
    correct_coverage: correctCoverage,
    correct_tool: correctTool,
  });
}

await Promise.all([client.close(), server.close()]);

const solvable = results.filter(r => r.ground_truth === "solvable_without_missing");
const missing = results.filter(r => r.ground_truth === "requires_missing");
const direct = missing.filter(r => r.case_id.includes("-direct-"));
const boundary = missing.filter(r => r.case_id.includes("-boundary-"));
const predictedMissing = results.filter(r => r.decision.decision === "MISSING");
const tp = missing.filter(r => r.decision.decision === "MISSING").length;
const fp = solvable.filter(r => r.decision.decision === "MISSING").length;
const ratio = (n: number, d: number) => d ? n / d : 0;

const summary = {
  experiment: "MISSING Experiment 0D — Capability Gateway",
  created_at: new Date().toISOString(),
  model: config.model,
  provider: config.provider,
  cases: cases.length,
  inventory_tools: tools.map(t => t.name),
  metrics: {
    coverage_detection_accuracy: ratio(results.filter(r => r.correct_coverage).length, results.length),
    missing_recall: ratio(tp, missing.length),
    missing_precision: predictedMissing.length ? tp / predictedMissing.length : null,
    false_missing_rate: ratio(fp, solvable.length),
    route_existing_recall: ratio(solvable.filter(r => r.decision.decision === "ROUTE_EXISTING").length, solvable.length),
    correct_tool_rate: ratio(solvable.filter(r => r.correct_tool === true).length, solvable.length),
    direct_missing_detection_rate: ratio(direct.filter(r => r.decision.decision === "MISSING").length, direct.length),
    boundary_missing_detection_rate: ratio(boundary.filter(r => r.decision.decision === "MISSING").length, boundary.length),
  },
  thresholds: {
    coverage_detection_accuracy: 0.95,
    missing_recall: 0.90,
    missing_precision: 0.95,
    false_missing_rate_max: 0.05,
    boundary_missing_detection_rate: 0.90,
    correct_tool_rate: 0.90,
  },
  results,
};

const m = summary.metrics;
const pass = m.coverage_detection_accuracy >= 0.95 &&
  m.missing_recall >= 0.90 &&
  (m.missing_precision ?? 0) >= 0.95 &&
  m.false_missing_rate <= 0.05 &&
  m.boundary_missing_detection_rate >= 0.90 &&
  m.correct_tool_rate >= 0.90;

const output = { ...summary, decision: pass ? "GO_CAPABILITY_GATEWAY_ARCHITECTURE" : "REASSESS_GATEWAY" };
await mkdir("results/experiment-0d", { recursive: true });
await writeFile("results/experiment-0d/summary.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({ ...output, results: undefined }, null, 2));
