export type RuntimeInput = Record<string, unknown>;

export type ProjectionRule =
  | { op: "INPUT"; name: string }
  | { op: "FIELD"; path: string };

export interface SafePostReplaySignalEvidence {
  kind: "sandbox_server" | "dry_run_control" | "test_mode_control" | "provider_safe_declaration" | "idempotency_key";
  sufficient: boolean;
  source: string;
  detail: string;
  location?: "query" | "header" | "body";
  name?: string;
  input_name?: string;
  safe_value?: boolean;
}

export interface SafePostReplayEvidence {
  policy: "lambda2";
  signals: SafePostReplaySignalEvidence[];
  input_overrides: RuntimeInput;
  generated_headers: string[];
}

export type RecipeVerification =
  | {
      status: "replay_verified";
      source: "experiment";
      source_experiment: "5B14";
      resilience_experiment: "5B15";
      source_run_id: number;
    }
  | {
      status: "replay_verified";
      source: "product_live";
      verification_inputs: RuntimeInput[];
      verified_at: string;
      evidence_url: string;
      safe_post?: SafePostReplayEvidence;
    };

export type HttpMethod = "GET" | "POST";

export interface CredentialBinding {
  location: "header";
  name: string;
  credential_key: string;
  prefix?: string;
}

export interface GeneratedHeaderBinding {
  location: "header";
  name: string;
  generator: "uuid_v4";
}

export interface VerifiedRecipe {
  capability: string;
  family: string;
  provider: string;
  provider_candidate_id: string;
  recipe_fingerprint: string;
  method: HttpMethod;
  base_url: string;
  path_template: string;
  path_bindings: Record<string, string>;
  query_bindings: Record<string, string>;
  /** Top-level JSON request body field -> $input binding. POST only. */
  body_bindings?: Record<string, string>;
  /** Non-sensitive declarative headers. Secrets must use credential_bindings. */
  static_headers?: Record<string, string>;
  /** References to credentials resolved only at execution time. */
  credential_bindings?: CredentialBinding[];
  /** Non-secret per-request headers such as Idempotency-Key. */
  generated_headers?: GeneratedHeaderBinding[];
  projection: Record<string, ProjectionRule>;
  required: string[];
  example_input: RuntimeInput;
  verification: RecipeVerification;
}

export interface RuntimeAttempt {
  provider: string;
  recipe_fingerprint: string;
  url: string | null;
  ok: boolean;
  http_status: number | null;
  latency_ms: number;
  error: string | null;
}

export type ResolveResult =
  | {
      status: "resolved";
      capability: string;
      provider: string;
      recipe_fingerprint: string;
      output: Record<string, unknown>;
      attempts: RuntimeAttempt[];
    }
  | {
      status: "unavailable" | "provider_error";
      capability: string;
      reason: string;
      attempts: RuntimeAttempt[];
    };

export interface RuntimeHealth {
  recipe_fingerprint: string;
  provider: string;
  failures: number;
  state: "closed" | "open";
  open_until: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
}
