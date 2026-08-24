export type GroundTruth = "solvable_without_missing" | "requires_missing";
export type Condition = "control" | "missing";

export interface BenchmarkCase {
  case_id: string;
  ground_truth: GroundTruth;
  user_task: string;
  expected_tool?: string;
}

export interface CaseResult {
  case_id: string; ground_truth: GroundTruth; condition: Condition; user_task: string;
  available_tools: string[]; tool_order: string[]; selected_tools: string[];
  first_selected_tool: string | null; whether_missing_was_called: boolean;
  final_agent_outcome: string; provider?: string; model?: string; latency_ms?: number;
  errors: string[]; random_seed: number; expected_tool?: string;
}

export interface Metrics {
  cases: number; requires_missing: number; solvable_without_missing: number;
  fallback_selection_rate: number; false_positive_rate: number; give_up_rate: number;
  correct_tool_rate: number; precision_missing: number | null;
}

export interface RunResult {
  experiment: "MISSING Experiment 0"; run_id: string; run_type: "real-agent" | "infrastructure-mock";
  created_at: string; fallback_description: string; results: CaseResult[];
  metrics: Record<Condition, Metrics>;
}
