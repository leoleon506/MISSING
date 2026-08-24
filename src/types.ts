export type GroundTruth = "solvable_without_missing" | "requires_missing";
export type Condition = "control" | "missing";

export interface BenchmarkCase {
  case_id: string;
  ground_truth: GroundTruth;
  user_task: string;
  expected_tool?: string;
  case_family: string;
  difficulty?: "easy" | "medium" | "hard";
}

export interface CaseResult {
  case_id: string; ground_truth: GroundTruth; case_family: string; difficulty?: string; condition: Condition; user_task: string;
  available_tools: string[]; tool_order: string[]; selected_tools: string[];
  missing_tool_position: number | null;
  first_selected_tool: string | null; whether_missing_was_called: boolean;
  fallback_invocations: import("./mcp/tools.js").Invocation[];
  final_agent_outcome: string; provider?: string; model?: string; latency_ms?: number;
  errors: string[]; random_seed: number; expected_tool?: string;
}

export interface Metrics {
  cases: number; requires_missing: number; solvable_without_missing: number;
  fallback_selection_rate: number; false_positive_rate: number; no_fallback_rate: number;
  correct_normal_tool_rate: number; first_tool_correct_rate: number; missing_first_call_rate: number; precision_missing: number | null;
}

export interface RunResult {
  experiment: "MISSING Experiment 0"; run_id: string; run_type: "real-agent" | "infrastructure-mock";
  created_at: string; fallback_description: string; results: CaseResult[];
  metrics: Record<Condition, Metrics>;
}
